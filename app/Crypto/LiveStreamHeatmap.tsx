// Filename: LiveStreamHeatmap.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTable, FaThLarge, FaFire } from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

/* Types ------------------------------------------------------------ */
interface TradeInfo {
  price: number;
  prev?: number;
  direction: "up" | "down" | "neutral";
  lastUpdate: number;
  bump: number; // increments per update for flash keying
}

interface CoinGeckoInfo {
  high: number;
  low: number;
}

type StreamStatus = "connecting" | "live" | "error";

/* Constants -------------------------------------------------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

const PAGE_SIZE = 78;

// ✅ Stop WebSocket after 5 minutes (popup MUST appear)
const WS_TIMEOUT = 300_000; // 5 minutes

// ✅ Keep-alive / resilience (no UI spam)
const SILENCE_MS = 18_000; // if no messages for this long, restart socket
const CONNECT_GUARD_MS = 1_250; // minimum delay between reconnect attempts
const MAX_RESTARTS_WITHIN_WINDOW = 8;
const RESTART_WINDOW_MS = 60_000;

/* Utilities -------------------------------------------------------- */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const fmt = {
  usd: (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? "—" : currencyFmt.format(n);
  },
  pct: (s: any) => (s != null ? `${parseFloat(String(s)).toFixed(2)}%` : "N/A"),
};

/* Lazy image loader */
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

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={revealed ? src : undefined}
      data-src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
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

  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [messageCount, setMessageCount] = useState(0);

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [cgInfo, setCgInfo] = useState<Record<string, CoinGeckoInfo>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ✅ WebSocket timeout popup state (ONLY for WS_TIMEOUT close)
  const [wsClosed, setWsClosed] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const isUnmountedRef = useRef(false);

  // ✅ ONE global “stop stream” timer (like your old working code)
  // This does NOT depend on ws.onopen and does NOT get reset by reconnects.
  const streamStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Silence watchdog (ensures "continuous stream" feel)
  const lastMsgAtRef = useRef<number>(0);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ✅ Restart guard to prevent rapid flapping
  const lastConnectAtRef = useRef<number>(0);
  const restartTimesRef = useRef<number[]>([]);

  // ✅ Hard stop guard: once timed out, NEVER auto-reconnect until user clicks Restart
  const hardStoppedRef = useRef(false);

  /* Clear stop timer */
  const clearStopTimer = useCallback(() => {
    if (streamStopTimerRef.current) {
      clearTimeout(streamStopTimerRef.current);
      streamStopTimerRef.current = null;
    }
  }, []);

  /* Clear silence watchdog */
  const clearSilenceWatchdog = useCallback(() => {
    if (silenceIntervalRef.current) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
  }, []);

  // ✅ This is the ONLY timeout that should show the popup.
  const hardStopNow = useCallback(() => {
    // enter hard stopped mode (blocks any reconnect)
    hardStoppedRef.current = true;

    clearSilenceWatchdog();
    clearStopTimer();

    // close socket
    try {
      socketRef.current?.close(1000, "timeout");
    } catch {
      try {
        socketRef.current?.close();
      } catch {}
    } finally {
      socketRef.current = null;
    }

    // show popup immediately (do NOT rely on ws.onclose firing)
    setStreamStatus("error");
    setWsClosed(true);
  }, [clearSilenceWatchdog, clearStopTimer]);

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
      } catch (e) {
        console.warn("Failed to fetch CoinGecko data:", e);
      }
    })();
  }, []);

  /* Bootstrap CoinCap metadata and initial prices */
  useEffect(() => {
    let canceled = false;

    (async () => {
      if (!API_KEY) {
        setStreamStatus("error");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`
        );
        if (res.status === 403) {
          setStreamStatus("error");
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
            const pct = parseFloat(String(a.changePercent24Hr ?? ""));
            const direction: "up" | "down" | "neutral" =
              Number.isFinite(pct) && pct !== 0 ? (pct > 0 ? "up" : "down") : "neutral";

            initialPrices[a.id] = {
              price: p,
              prev: undefined,
              direction,
              lastUpdate: Date.now(),
              bump: 0,
            };
          }
        });

        ids.sort((a, b) => (+meta[a]?.rank || 9999) - (+meta[b]?.rank || 9999));

        setMetaData(meta);
        setTopIds(ids.slice(0, 200));
        setTradeInfoMap(initialPrices);
        setLoading(false);
      } catch (e) {
        console.error("Failed to fetch initial data:", e);
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

    return () => {
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
    const all = Object.keys(metaData).sort(
      (a, b) => (+metaData[a]?.rank || 9999) - (+metaData[b]?.rank || 9999)
    );
    return all.slice(0, 200);
  }, [topIds, metaData]);

  const visibleIds = useMemo(
    () => sortedIds.slice(0, visibleCount),
    [sortedIds, visibleCount]
  );

  /**
   * ✅ Socket connect/restart
   * - keeps it streaming (silent restarts)
   * - BUT once hardStoppedRef is true, it will NEVER reconnect (so popup stays)
   */
  const connectSocket = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (hardStoppedRef.current) return; // ✅ stop all reconnect loops once timed out
    if (!API_KEY || sortedIds.length === 0) return;

    const now = Date.now();

    // prevent tight loops
    if (now - lastConnectAtRef.current < CONNECT_GUARD_MS) return;

    // rolling window limiter
    restartTimesRef.current = restartTimesRef.current.filter((t) => now - t < RESTART_WINDOW_MS);
    if (restartTimesRef.current.length >= MAX_RESTARTS_WITHIN_WINDOW) {
      setStreamStatus("error");
      return;
    }
    restartTimesRef.current.push(now);
    lastConnectAtRef.current = now;

    // close current
    try {
      socketRef.current?.close();
    } catch {}
    socketRef.current = null;

    // keep UI stable: don't spam “connecting” after first live
    setStreamStatus((s) => (s === "connecting" ? "connecting" : "live"));

    const assetsParam = sortedIds.join(",");
    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=${encodeURIComponent(assetsParam)}&apiKey=${API_KEY}`
    );
    socketRef.current = ws;

    ws.onopen = () => {
      if (isUnmountedRef.current) return;
      if (hardStoppedRef.current) return;
      setStreamStatus("live");
    };

    ws.onmessage = (e) => {
      if (isUnmountedRef.current) return;
      if (hardStoppedRef.current) return;

      if (typeof e.data === "string" && e.data.startsWith("Unauthorized")) {
        setStreamStatus("error");
        try {
          ws.close();
        } catch {}
        return;
      }

      let update: Record<string, string>;
      try {
        update = JSON.parse(e.data);
      } catch {
        return;
      }

      const ts = Date.now();
      lastMsgAtRef.current = ts;

      setMessageCount((c) => c + 1);

      setTradeInfoMap((prev) => {
        let changedAny = false;
        const next = { ...prev };

        for (const [id, priceStr] of Object.entries(update)) {
          const newPrice = parseFloat(String(priceStr));
          if (!Number.isFinite(newPrice)) continue;

          const existing = prev[id];
          const oldPrice = existing?.price;

          if (oldPrice === undefined) {
            next[id] = {
              price: newPrice,
              prev: undefined,
              direction: "neutral",
              lastUpdate: ts,
              bump: 1,
            };
            changedAny = true;
            continue;
          }

          if (newPrice === oldPrice) continue;

          const direction: "up" | "down" = newPrice > oldPrice ? "up" : "down";

          next[id] = {
            price: newPrice,
            prev: oldPrice,
            direction,
            lastUpdate: ts,
            bump: (existing?.bump || 0) + 1,
          };
          changedAny = true;
        }

        return changedAny ? next : prev;
      });

      setLoading(false);
      setStreamStatus("live");
    };

    ws.onclose = () => {
      if (isUnmountedRef.current) return;

      // If we timed out, do nothing (popup already shown)
      if (hardStoppedRef.current) return;

      // Otherwise: silent restart
      setTimeout(() => connectSocket(), CONNECT_GUARD_MS);
    };

    ws.onerror = () => {
      if (isUnmountedRef.current) return;
      if (hardStoppedRef.current) return;
      setTimeout(() => connectSocket(), CONNECT_GUARD_MS);
    };
  }, [API_KEY, sortedIds]);

  /* Start stream + start the ONE global timeout (like old code) */
  useEffect(() => {
    isUnmountedRef.current = false;

    if (sortedIds.length > 0 && API_KEY) {
      // reset
      hardStoppedRef.current = false;
      setWsClosed(false);
      setStreamStatus("connecting");

      restartTimesRef.current = [];
      lastConnectAtRef.current = 0;

      // ✅ start ONE timer that always ends the stream + popup (not tied to ws.onopen)
      clearStopTimer();
      streamStopTimerRef.current = setTimeout(() => {
        if (isUnmountedRef.current) return;
        hardStopNow();
      }, WS_TIMEOUT);

      lastMsgAtRef.current = Date.now();
      connectSocket();
    }

    return () => {
      isUnmountedRef.current = true;
      clearStopTimer();
      clearSilenceWatchdog();
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
        socketRef.current = null;
      }
    };
  }, [sortedIds.length, API_KEY, connectSocket, hardStopNow, clearStopTimer, clearSilenceWatchdog]);

  /* Silence watchdog: restart only while NOT timed out */
  useEffect(() => {
    clearSilenceWatchdog();

    if (!API_KEY || sortedIds.length === 0) return;

    lastMsgAtRef.current = Date.now();

    silenceIntervalRef.current = setInterval(() => {
      if (isUnmountedRef.current) return;
      if (hardStoppedRef.current) return;

      const now = Date.now();
      const since = now - (lastMsgAtRef.current || 0);

      if (since > SILENCE_MS) {
        connectSocket();
      }
    }, 1500);

    return () => clearSilenceWatchdog();
  }, [API_KEY, sortedIds.length, connectSocket, clearSilenceWatchdog]);

  /* Manual restart (from error pill or from popup button) */
  const handleReconnect = useCallback(() => {
    // full reset + start a fresh 5-min timer from this click
    hardStoppedRef.current = false;
    setWsClosed(false);

    restartTimesRef.current = [];
    lastConnectAtRef.current = 0;

    clearSilenceWatchdog();
    clearStopTimer();

    setStreamStatus("connecting");
    lastMsgAtRef.current = Date.now();

    streamStopTimerRef.current = setTimeout(() => {
      if (isUnmountedRef.current) return;
      hardStopNow();
    }, WS_TIMEOUT);

    connectSocket();
  }, [connectSocket, clearSilenceWatchdog, clearStopTimer, hardStopNow]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-brand-900/90">
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-20 h-20 border-4 border-indigo-200 dark:border-indigo-900 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-700 dark:text-white/80">
            Loading heatmap...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Connection status indicator */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
        <AnimatePresence mode="wait">
          {streamStatus === "connecting" && !wsClosed && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 backdrop-blur-md"
            >
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                Connecting...
              </span>
            </motion.div>
          )}

          {/* ✅ Hide red pill when timeout popup is active */}
          {streamStatus === "error" && !wsClosed && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-md cursor-pointer hover:bg-rose-500/30 transition-colors"
              onClick={handleReconnect}
            >
              <div className="w-2 h-2 bg-rose-500 rounded-full" />
              <span className="text-xs font-semibold text-rose-900 dark:text-rose-100">
                Disconnected • Click to reconnect
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-screen dark:bg-brand-900 bg-white pb-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6">
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
                    Real-time WebSocket prices • Top 200 by market cap
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
              <span className="font-bold text-gray-900 dark:text-white">
                {Math.min(visibleCount, sortedIds.length)}
              </span>{" "}
              of{" "}
              <span className="font-bold text-gray-900 dark:text-white">
                {sortedIds.length}
              </span>
              <span className="ml-2 opacity-70">• msgs {messageCount}</span>
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
                const tradeInfo = tradeInfoMap[id];
                const price = tradeInfo?.price;
                const direction = tradeInfo?.direction || "neutral";
                const bump = tradeInfo?.bump || 0;
                const md = metaData[id] || {};

                const pct = parseFloat(String(md.changePercent24Hr ?? ""));
                const pctPos = Number.isFinite(pct) && pct > 0;
                const pctNeg = Number.isFinite(pct) && pct < 0;

                const logo = logos[md.symbol?.toLowerCase?.()];

                const cardTone =
                  direction === "up"
                    ? "bg-emerald-400 border-emerald-600/50 dark:bg-emerald-600 dark:border-emerald-500/50"
                    : direction === "down"
                    ? "bg-rose-400 border-rose-600/50 dark:bg-rose-600 dark:border-rose-500/50"
                    : "bg-gray-200 border-gray-400/40 dark:bg-gray-800/60 dark:border-gray-700/40";

                const flashBg =
                  direction === "up"
                    ? "radial-gradient(circle at 50% 45%, rgba(16,185,129,0.85) 0%, rgba(16,185,129,0.25) 55%, rgba(16,185,129,0) 75%)"
                    : direction === "down"
                    ? "radial-gradient(circle at 50% 45%, rgba(244,63,94,0.85) 0%, rgba(244,63,94,0.25) 55%, rgba(244,63,94,0) 75%)"
                    : "transparent";

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
                    <motion.div
                      className={[
                        "relative overflow-hidden rounded-2xl cursor-pointer",
                        "border-2 transition-colors duration-150",
                        cardTone,
                      ].join(" ")}
                    >
                      {/* Fast flash on every price change */}
                      <AnimatePresence>
                        {bump > 0 && (
                          <motion.div
                            key={`${id}-${bump}`}
                            className="absolute inset-0 pointer-events-none"
                            initial={{ opacity: 0, scale: 1 }}
                            animate={{ opacity: [0, 1, 0], scale: [1, 1.02, 1] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.16, ease: "easeOut" }}
                            style={{
                              background: flashBg,
                              mixBlendMode: "screen",
                              filter: "saturate(1.6) contrast(1.15)",
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
                                <LazyImg
                                  src={logo}
                                  alt={md.symbol}
                                  className="w-6 h-6 sm:w-7 sm:h-7"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/10 dark:bg-white/20 flex-shrink-0" />
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                              {md.symbol || id}
                            </h3>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="mb-2">
                          <div className="flex items-baseline gap-1.5">
                            <motion.span
                              key={`${id}-price-${bump}`}
                              initial={{ y: 2, opacity: 0.9 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ duration: 0.12 }}
                              className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
                            >
                              {fmt.usd(price)}
                            </motion.span>

                            {direction !== "neutral" && (
                              <motion.span
                                className={`text-sm sm:text-base font-bold ${
                                  direction === "up"
                                    ? "text-emerald-800 dark:text-white"
                                    : "text-rose-800 dark:text-white"
                                }`}
                                initial={{ opacity: 0, y: direction === "up" ? 5 : -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.12 }}
                              >
                                {direction === "up" ? "↑" : "↓"}
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* 24h change */}
                        <div className="flex items-center justify-between">
                          <div className="inline-flex items-center gap-1 bg-black/10 dark:bg-black/20 backdrop-blur-sm px-2 py-1 rounded-full">
                            <span className="text-[10px] sm:text-xs font-semibold text-gray-900 dark:text-white/90">
                              24h: {fmt.pct(md.changePercent24Hr)}
                            </span>
                          </div>

                          {Number.isFinite(pct) && pct !== 0 && (
                            <div
                              className={[
                                "text-xs sm:text-sm font-black",
                                pctPos
                                  ? "text-emerald-700 dark:text-emerald-200"
                                  : "text-rose-700 dark:text-rose-200",
                              ].join(" ")}
                            >
                              {pctPos ? "↑" : "↓"}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
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
                      const tradeInfo = tradeInfoMap[id];
                      const price = tradeInfo?.price;
                      const direction = tradeInfo?.direction || "neutral";

                      const pct = parseFloat(String(md.changePercent24Hr ?? ""));
                      const pctPos = Number.isFinite(pct) && pct > 0;
                      const pctNeg = Number.isFinite(pct) && pct < 0;

                      const rowBg =
                        direction === "up"
                          ? "bg-emerald-300/70 dark:bg-emerald-700/50"
                          : direction === "down"
                          ? "bg-rose-300/70 dark:bg-rose-700/50"
                          : "";

                      const logo = logos[String(md.symbol ?? "").toLowerCase()];

                      return (
                        <motion.tr
                          key={id}
                          className={[
                            "cursor-pointer transition-all duration-150",
                            rowBg,
                            "hover:bg-black/5 dark:hover:bg-white/5",
                          ].join(" ")}
                          onClick={() => {
                            setSelectedAsset(md);
                            trackEvent("CryptoAssetClick", { id });
                          }}
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
                                    <LazyImg
                                      src={logo}
                                      alt={md.symbol}
                                      className="w-6 h-6 sm:w-8 sm:h-8"
                                    />
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
                            <div className="flex items-center gap-2">
                              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                                {fmt.usd(price)}
                              </span>
                              {direction !== "neutral" && (
                                <span
                                  className={`text-lg font-bold ${
                                    direction === "up" ? "text-emerald-700" : "text-rose-700"
                                  }`}
                                >
                                  {direction === "up" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div
                              className={[
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm",
                                pctPos
                                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                  : pctNeg
                                  ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
                                  : "bg-black/10 dark:bg-white/10 text-gray-800 dark:text-white/70",
                              ].join(" ")}
                            >
                              <span aria-hidden className="text-base">
                                {pctPos ? "↑" : pctNeg ? "↓" : ""}
                              </span>
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

      {/* ✅ WebSocket Closed Modal (WS_TIMEOUT only) */}
      <AnimatePresence>
        {wsClosed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

              <div className="p-6 sm:p-8">
                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  onClick={() => setWsClosed(false)}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl mb-4 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-3">
                    Stream Ended
                  </h3>

                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
                    The live price stream ended automatically after 5 minutes.
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/25 transition-all duration-200"
                    onClick={() => {
                      setWsClosed(false);
                      handleReconnect();
                    }}
                  >
                    Restart Stream
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
