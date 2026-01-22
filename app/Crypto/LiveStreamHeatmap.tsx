// Filename: LiveStreamHeatmap.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTable, FaThLarge, FaFire } from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

/* Types ------------------------------------------------------------ */
interface TradeInfo {
  price: number;
  prev?: number;
  bump?: number;
  dir?: 1 | -1 | 0;
}

interface CoinGeckoInfo {
  high: number;
  low: number;
}

type StreamStatus = "connecting" | "live" | "reconnecting" | "down";

/* Constants -------------------------------------------------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

const PAGE_SIZE = 78;

/* Utilities -------------------------------------------------------- */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 8,
});

const fmt = {
  usd: (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? "—" : currencyFmt.format(n);
  },
  pct: (s: any) => (s != null ? `${parseFloat(String(s)).toFixed(2)}%` : "N/A"),
};

/* Small helper: image that reliably loads when revealed later */
function LazyImg({
  src,
  alt,
  className,
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    // If already on-screen, reveal immediately
    const reveal = () => setRevealed(true);

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) {
          reveal();
          io.disconnect();
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  // If it becomes revealed, force a decode/load (helps with "Load more" images sitting there)
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    if (!revealed) return;
    // kick the browser a bit
    try {
      // decode is best-effort
      (el as any).decode?.().catch?.(() => {});
    } catch {}
  }, [revealed]);

  return (
    <img
      ref={imgRef}
      src={revealed ? src : undefined}
      data-src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      // if the browser doesn't load from src until revealed, set it on demand
      onLoad={(e) => {
        // ensure it stays loaded
        const t = e.currentTarget;
        if (!t.src && (t as any).dataset?.src) t.src = (t as any).dataset.src;
      }}
      onError={(e) => {
        // If we hid src until reveal, set it now and try once more
        const t = e.currentTarget as HTMLImageElement & { dataset?: any };
        const ds = t.dataset?.src;
        if (ds && t.src !== ds) t.src = ds;
      }}
    />
  );
}

/* Component -------------------------------------------------------- */
export default function LiveStreamHeatmap() {
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeInfo>>({});
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [topIds, setTopIds] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // WS-only status
  const [wsAvailable, setWsAvailable] = useState(true);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [wsSession, setWsSession] = useState(0); // flash when (re)connected

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [cgInfo, setCgInfo] = useState<Record<string, CoinGeckoInfo>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // WS refs
  const socketRef = useRef<WebSocket | null>(null);
  const closeIntentionallyRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Keep latest ids without triggering reconnects on every render
  const latestIdsRef = useRef<string[]>([]);
  const latestIdsKeyRef = useRef<string>("");

  /* Load CoinGecko logos and 24h high/low data */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const logoMap: Record<string, string> = {};
        const infoMap: Record<string, CoinGeckoInfo> = {};

        (json || []).forEach((c: any) => {
          const key = c.symbol?.toLowerCase?.();
          if (!key) return;
          logoMap[key] = c.image;
          infoMap[key] = { high: c.high_24h, low: c.low_24h };
        });

        setLogos(logoMap);
        setCgInfo(infoMap);
      } catch {
        // ignore
      }
    })();
  }, []);

  /* Bootstrap CoinCap metadata and initial prices */
  useEffect(() => {
    let canceled = false;

    (async () => {
      if (!API_KEY) {
        setWsAvailable(false);
        setStreamStatus("down");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`);
        if (res.status === 403) {
          setWsAvailable(false);
          setStreamStatus("down");
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (canceled) return;

        const meta: Record<string, any> = {};
        const initialPrices: Record<string, TradeInfo> = {};
        const ids: string[] = [];

        (json.data || []).forEach((a: any) => {
          if (!a?.id) return;
          meta[a.id] = a;
          ids.push(a.id);

          const p = parseFloat(a.priceUsd);
          if (Number.isFinite(p)) {
            initialPrices[a.id] = { price: p, prev: undefined, bump: 0, dir: 0 };
          }
        });

        ids.sort((a, b) => (+meta[a]?.rank || 9999) - (+meta[b]?.rank || 9999));

        setMetaData(meta);
        setTopIds(ids.slice(0, 200));
        setTradeInfoMap((prev) => ({ ...prev, ...initialPrices }));
        setLoading(false);
      } catch {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  /* Force enable scroll while component is mounted */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      htmlPosition: html.style.position,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyTouchAction: (body.style as any).touchAction,
    };

    html.style.overflow = "auto";
    html.style.height = "auto";
    html.style.position = "static";

    body.style.overflow = "auto";
    body.style.height = "auto";
    body.style.position = "static";
    body.style.top = "";
    body.style.width = "auto";
    (body.style as any).touchAction = "pan-y";

    const unlock = () => {
      html.style.overflow = "auto";
      body.style.overflow = "auto";
      (body.style as any).touchAction = "pan-y";
    };

    const t1 = window.setTimeout(unlock, 0);
    const t2 = window.setTimeout(unlock, 50);
    const t3 = window.setTimeout(unlock, 250);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);

      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      html.style.position = prev.htmlPosition;

      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      (body.style as any).touchAction = prev.bodyTouchAction;
    };
  }, []);

  /* Sorted list of crypto IDs */
  const sortedIds = useMemo(() => {
    if (topIds.length) return topIds.slice(0, 200);
    const all = Object.keys(metaData).sort((a, b) => (+metaData[a]?.rank || 9999) - (+metaData[b]?.rank || 9999));
    return all.slice(0, 200);
  }, [topIds, metaData]);

  const visibleIds = useMemo(() => sortedIds.slice(0, visibleCount), [sortedIds, visibleCount]);
  const wsIds = useMemo(() => sortedIds.slice(0, visibleCount), [sortedIds, visibleCount]);

  // keep latest ids (and a stable key) in refs so WS doesn't rebuild on rerenders
  useEffect(() => {
    latestIdsRef.current = wsIds;
    latestIdsKeyRef.current = wsIds.join(",");
  }, [wsIds]);

  /* Apply WS update -> drives card colors + flashes */
  const applyUpdateRef = useRef<(u: Record<string, string>) => void>(() => {});
  applyUpdateRef.current = (update: Record<string, string>) => {
    setTradeInfoMap((prev) => {
      const next = { ...prev };

      for (const [id, priceStr] of Object.entries(update)) {
        const p = parseFloat(String(priceStr));
        if (!Number.isFinite(p)) continue;

        const oldPrice = prev[id]?.price;
        const oldDir = prev[id]?.dir ?? 0;

        let dir: 1 | -1 | 0 = oldDir;
        if (oldPrice != null) {
          if (p > oldPrice) dir = 1;
          else if (p < oldPrice) dir = -1;
        } else {
          dir = 0;
        }

        const nextBump = (prev[id]?.bump || 0) + 1;
        next[id] = { price: p, prev: oldPrice, bump: nextBump, dir };
      }

      return next;
    });

    setLoading(false);
  };

  /* WS-only stream manager (no polling) */
  useEffect(() => {
    if (!API_KEY) {
      setWsAvailable(false);
      setStreamStatus("down");
      return;
    }

    let disposed = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const closeSocket = () => {
      try {
        closeIntentionallyRef.current = true;
        socketRef.current?.close();
      } catch {}
      socketRef.current = null;
      closeIntentionallyRef.current = false;
    };

    const scheduleReconnect = (reason: "close" | "error" | "manual") => {
      if (disposed) return;

      setStreamStatus("reconnecting");

      const attempt = (reconnectAttemptRef.current = reconnectAttemptRef.current + 1);
      const delay = Math.min(12_000, 400 * Math.pow(2, attempt)); // 0.4s, 0.8, 1.6, 3.2, ... max 12s

      clearReconnect();
      reconnectTimerRef.current = window.setTimeout(() => {
        if (!disposed) connect("reconnect:" + reason);
      }, delay);
    };

    const connect = (why: string) => {
      if (disposed) return;

      const ids = latestIdsRef.current;
      if (!ids?.length) return;

      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      if (socketRef.current?.readyState === WebSocket.CONNECTING) return;

      closeSocket();
      clearReconnect();

      setStreamStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

      const assetsParam = ids.join(",");
      const url = `wss://wss.coincap.io/prices?assets=${encodeURIComponent(assetsParam)}&apiKey=${API_KEY}`;
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        reconnectAttemptRef.current = 0;

        setWsAvailable(true);
        setStreamStatus("live");

        // 🔥 flash UI on websocket connect / reconnect
        setWsSession((n) => n + 1);
      };

      ws.onmessage = (e) => {
        if (disposed) return;

        if (typeof e.data === "string" && e.data.startsWith("Unauthorized")) {
          setWsAvailable(false);
          setStreamStatus("down");
          closeSocket();
          return;
        }

        let update: Record<string, string> | null = null;
        try {
          update = JSON.parse(e.data);
        } catch {
          return;
        }
        if (!update) return;

        applyUpdateRef.current(update);
      };

      ws.onerror = () => {
        if (disposed) return;
        // onclose usually follows
      };

      ws.onclose = () => {
        if (disposed) return;

        const intentional = closeIntentionallyRef.current;
        closeIntentionallyRef.current = false;

        if (intentional) return;

        scheduleReconnect("close");
      };
    };

    connect("initial");

    const resubscribe = () => {
      if (disposed) return;

      const nextKey = latestIdsKeyRef.current;
      const ws = socketRef.current;

      if (!ws || (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING)) {
        connect("resubscribe-no-socket");
        return;
      }

      closeIntentionallyRef.current = true;
      try {
        ws.close();
      } catch {}
      socketRef.current = null;

      clearReconnect();
      reconnectTimerRef.current = window.setTimeout(() => {
        connect("resubscribe:" + nextKey.slice(0, 32));
      }, 200);
    };

    let lastKey = latestIdsKeyRef.current;
    const keyWatcher = window.setInterval(() => {
      if (disposed) return;
      const k = latestIdsKeyRef.current;
      if (k && k !== lastKey) {
        lastKey = k;
        resubscribe();
      }
    }, 500);

    const onVisibility = () => {
      if (disposed) return;
      if (document.visibilityState === "visible") {
        if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
          connect("visibility");
        }
      }
    };

    const onOnline = () => {
      if (disposed) return;
      connect("online");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;

      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);

      window.clearInterval(keyWatcher);
      clearReconnect();

      closeIntentionallyRef.current = true;
      try {
        socketRef.current?.close();
      } catch {}
      socketRef.current = null;
      closeIntentionallyRef.current = false;
    };
  }, [API_KEY]);

  if (loading) {
    return (
      <div
        className="
          fixed inset-0 z-50 flex items-center justify-center
          bg-white/80 backdrop-blur-sm
          dark:bg-brand-900/90
        "
      >
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-20 h-20 border-4 border-indigo-200 dark:border-indigo-900 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-700 dark:text-white/80">Loading heatmap...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Flash banner when websocket connects/reconnects */}
      <AnimatePresence>
        {streamStatus === "live" && (
          <motion.div
            key={`ws-session-${wsSession}`}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 dark:bg-emerald-400/15 border border-emerald-500/30 dark:border-emerald-400/25 backdrop-blur-md">
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                Live stream connected
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen dark:bg-brand-900 bg-white pb-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6">
          {/* WS Status Banner (WS ONLY, no polling) */}
          <AnimatePresence>
            {!wsAvailable && (
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-rose-500/10 to-orange-500/10 dark:from-rose-500/20 dark:to-orange-500/20 border border-rose-500/20 dark:border-rose-500/30 rounded-2xl backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  <p className="text-xs sm:text-sm font-semibold text-rose-900 dark:text-rose-200">
                    WebSocket unavailable (no polling fallback). Check API key / connection.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-xl opacity-40" />
                  <div className="relative bg-indigo-600/50 dark:bg-indigo-900/40 p-3 rounded-2xl shadow-sm">
                    <FaFire className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Live Crypto Heatmap
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    WebSocket-only live updates • Top 200 by market cap
                  </p>
                </div>
              </div>

              <motion.button
                onClick={() => {
                  const next = viewMode === "grid" ? "table" : "grid";
                  setViewMode(next);
                  trackEvent("CryptoViewToggle", { view: next });
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2.5 bg-indigo-600/50 dark:bg-indigo-900/40 text-white px-5 py-3 rounded-2xl transition-all duration-200 font-semibold text-sm"
              >
                {viewMode === "grid" ? <FaTable className="w-4 h-4" /> : <FaThLarge className="w-4 h-4" />}
                <span>{viewMode === "grid" ? "Table View" : "Grid View"}</span>
              </motion.button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
              Showing{" "}
              <span className="font-bold text-gray-900 dark:text-white">{Math.min(visibleCount, sortedIds.length)}</span>{" "}
              of <span className="font-bold text-gray-900 dark:text-white">{sortedIds.length}</span>
            </div>

            <div className="flex items-center gap-2">
              {visibleCount < sortedIds.length && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setVisibleCount((c) => Math.min(sortedIds.length, c + PAGE_SIZE))}
                  className="px-4 py-2 rounded-2xl bg-white/70 dark:bg-white/10 border border-gray-200/60 dark:border-white/10 text-gray-800 dark:text-white/80 text-xs sm:text-sm font-semibold backdrop-blur-md"
                >
                  Load more
                </motion.button>
              )}

              {visibleCount > PAGE_SIZE && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                  className="px-4 py-2 rounded-2xl bg-white/70 dark:bg-white/10 border border-gray-200/60 dark:border-white/10 text-gray-800 dark:text-white/80 text-xs sm:text-sm font-semibold backdrop-blur-md"
                >
                  Show top {PAGE_SIZE}
                </motion.button>
              )}
            </div>
          </div>

          {/* Grid View */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1 sm:gap-1">
              {visibleIds.map((id) => {
                const { price, prev, bump, dir } = tradeInfoMap[id] || {};
                const md = metaData[id] || {};
                const pct = parseFloat(String(md.changePercent24Hr ?? ""));
                const pctPos = Number.isFinite(pct) && pct > 0;
                const pctNeg = Number.isFinite(pct) && pct < 0;

                let isPositive = false;
                let isNegative = false;
                let arrow = "";

                if (prev != null && price != null) {
                  const d = dir ?? 0;
                  isPositive = d === 1;
                  isNegative = d === -1;
                  arrow = d === 1 ? "↑" : d === -1 ? "↓" : "";
                } else {
                  isPositive = pctPos;
                  isNegative = pctNeg;
                }

                const logo = logos[md.symbol?.toLowerCase?.()];

                const cardTone = isPositive
                  ? "bg-emerald-300 border-emerald-600/40 shadow-sm dark:bg-emerald-800/60 dark:border-emerald-700/40"
                  : isNegative
                  ? "bg-rose-300 border-rose-600/40 shadow-sm dark:bg-rose-800/60 dark:border-rose-700/40"
                  : "bg-gray-200 border-gray-400/40 shadow-sm dark:bg-gray-800/60 dark:border-gray-700/40";

                const flashBg = isPositive
                  ? "radial-gradient(circle at 35% 35%, rgba(34,197,94,0.95) 0%, rgba(34,197,94,0.35) 38%, rgba(34,197,94,0) 72%)"
                  : isNegative
                  ? "radial-gradient(circle at 35% 35%, rgba(244,63,94,0.95) 0%, rgba(244,63,94,0.35) 38%, rgba(244,63,94,0) 72%)"
                  : "radial-gradient(circle at 35% 35%, rgba(99,102,241,0.85) 0%, rgba(99,102,241,0.28) 40%, rgba(99,102,241,0) 72%)";

                return (
                  <motion.div
                    key={id}
                    layout
                    className="group relative"
                    whileHover={{ scale: 1.03, zIndex: 10 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setSelectedAsset(md);
                      trackEvent("CryptoAssetClick", { id, ...md });
                    }}
                  >
                    <div
                      className={[
                        "relative overflow-hidden rounded-2xl cursor-pointer",
                        "border-2 transition-all duration-300",
                        cardTone,
                      ].join(" ")}
                    >
                      {/* Flash overlay on price update */}
                      <AnimatePresence>
                        {prev != null && price != null && bump != null && bump > 0 && (
                          <motion.div
                            key={`${id}-${bump}`}
                            className="absolute inset-0 pointer-events-none"
                            initial={{ opacity: 0, scale: 1 }}
                            animate={{ opacity: [0, 0.95, 0.35, 0], scale: [1, 1.02, 1.008, 1] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.42, times: [0, 0.12, 0.35, 1], ease: "easeOut" }}
                            style={{
                              background: flashBg,
                              mixBlendMode: "screen",
                              filter: "saturate(1.8) contrast(1.25)",
                              willChange: "opacity, transform",
                            }}
                          />
                        )}
                      </AnimatePresence>

                      <div className="relative p-3 sm:p-4">
                        {/* Rank badge */}
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                          <div className="bg-black/15 dark:bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            <span className="text-[9px] sm:text-[10px] font-bold text-gray-900 dark:text-white/90">
                              #{md.rank || "—"}
                            </span>
                          </div>
                        </div>

                        {/* Logo and symbol */}
                        <div className="flex items-center gap-2 mb-3">
                          {logo ? (
                            <div className="relative flex-shrink-0">
                              <div className="relative bg-white/90 dark:bg-white/90 rounded-full p-1.5 shadow-sm">
                                <LazyImg src={logo} alt={md.symbol} className="w-6 h-6 sm:w-7 sm:h-7" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/10 dark:bg-white/20 flex-shrink-0" />
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm sm:text-base text-gray-900 dark:text-white truncate">{md.symbol || id}</h3>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="mb-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base sm:text-lg text-gray-900 dark:text-white">{fmt.usd(price)}</span>
                            {arrow && <span className="text-sm sm:text-base text-gray-700 dark:text-white/90">{arrow}</span>}
                          </div>
                        </div>

                        {/* 24h change */}
                        <div className="flex items-center justify-between">
                          <div className="inline-flex items-center gap-1 bg-black/10 dark:bg-black/20 backdrop-blur-sm px-2 py-1 rounded-full">
                            <span className="text-[10px] sm:text-xs text-gray-900 dark:text-white/90">
                              {fmt.pct(md.changePercent24Hr)}
                            </span>
                          </div>

                          {(pctPos || pctNeg) && (
                            <div
                              className={[
                                "text-xs sm:text-sm font-black",
                                pctPos ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200",
                              ].join(" ")}
                            >
                              {pctPos ? "↑" : "↓"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-2xl border border-gray-200/50 dark:border-white/10 bg-white/80 dark:bg-brand-900/80 backdrop-blur-xl shadow-2xl">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-brand-800 dark:to-brand-900/50 border-b border-gray-200/50 dark:border-white/10">
                      {["Rank", "Asset", "Name", "Price", "24h Change"].map((h) => (
                        <th
                          key={h}
                          className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-700 dark:text-white/80"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {visibleIds.map((id) => {
                      const md = metaData[id] || {};
                      const { price, prev, bump, dir } = tradeInfoMap[id] || {};

                      const pct = parseFloat(String(md.changePercent24Hr ?? ""));
                      const pctPos = Number.isFinite(pct) && pct > 0;
                      const pctNeg = Number.isFinite(pct) && pct < 0;

                      // ✅ match GRID logic: prefer WS direction if available
                      let isPositive = false;
                      let isNegative = false;
                      if (prev != null && price != null) {
                        const d = dir ?? 0;
                        isPositive = d === 1;
                        isNegative = d === -1;
                      } else {
                        isPositive = pctPos;
                        isNegative = pctNeg;
                      }

                      // ✅ match GRID backgrounds in LIGHT + DARK
                      const rowBg = isPositive
                        ? "bg-emerald-300/60 dark:bg-emerald-800/30"
                        : isNegative
                        ? "bg-rose-300/60 dark:bg-rose-800/30"
                        : "";

                      const logo = logos[String(md.symbol ?? "").toLowerCase()];

                      return (
                        <motion.tr
                          key={`${id}-${bump ?? 0}`}
                          className={[
                            "cursor-pointer transition-colors duration-200",
                            rowBg,
                            "hover:bg-black/5 dark:hover:bg-white/5",
                          ].join(" ")}
                          onClick={() => {
                            setSelectedAsset(md);
                            trackEvent("CryptoAssetClick", { id });
                          }}
                          initial={false}
                          animate={{
                            // keep a subtle pulse on updates without breaking the base bg
                            opacity: bump ? [1, 0.98, 1] : 1,
                          }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="inline-flex items-center justify-center bg-black/10 dark:bg-white/10 rounded-full px-2.5 py-1">
                              <span className="text-[11px] sm:text-sm font-bold text-gray-800 dark:text-white/90">
                                #{md.rank ?? "—"}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-3">
                              {logo ? (
                                <div className="relative flex-shrink-0">
                                  <div className="relative bg-white/90 dark:bg-white/90 rounded-full p-1.5 shadow-sm">
                                    <LazyImg src={logo} alt={md.symbol} className="w-6 h-6 sm:w-8 sm:h-8" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/10 dark:bg-white/10 flex-shrink-0" />
                              )}

                              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                                {md.symbol ?? id}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-white/80 line-clamp-1">
                              {md.name ?? "—"}
                            </span>
                          </td>

                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                              {fmt.usd(price)}
                            </span>
                          </td>

                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div
                              className={[
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm",
                                isPositive
                                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                  : isNegative
                                  ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
                                  : "bg-black/10 dark:bg-white/10 text-gray-800 dark:text-white/70",
                              ].join(" ")}
                            >
                              <span aria-hidden className="text-base">{isPositive ? "↑" : isNegative ? "↓" : ""}</span>
                              {fmt.pct(md.changePercent24Hr)}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}

                    {sortedIds.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-white/60">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Asset Detail Modal */}
      <CryptoAssetPopup
        asset={selectedAsset}
        logos={logos}
        onClose={() => setSelectedAsset(null)}
        tradeInfo={selectedAsset ? tradeInfoMap[selectedAsset.id] : undefined}
      />
    </>
  );
}
