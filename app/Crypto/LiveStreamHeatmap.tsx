"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTable, FaThLarge, FaFire } from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

/* Types ------------------------------------------------------------ */
interface TradeInfo {
  price: number;
  direction: "up" | "down" | "neutral";
  bump: number;
}

interface CoinMeta {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  priceUsd: string;
  changePercent24Hr: string;
}

type StreamStatus = "connecting" | "live" | "error";

/* Constants -------------------------------------------------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

const PAGE_SIZE = 78;
const SESSION_TIMEOUT_MS = 300_000; // 5 minutes - this is for the entire session
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

/* Currency formatter (created once) */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatUsd = (v: number | string | undefined): string => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? currencyFmt.format(n) : "—";
};

const formatPct = (v: string | number | null | undefined): string => {
  if (v == null) return "N/A";
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "N/A";
};

/* Memoized Image Component */
const CoinImage = memo(function CoinImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`${className} rounded-full bg-black/10 dark:bg-white/20`}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.15s" }}
    />
  );
});

/* Grid Card Component */
const GridCard = memo(function GridCard({
  id,
  meta,
  tradeInfo,
  logo,
  onClick,
}: {
  id: string;
  meta: CoinMeta;
  tradeInfo?: TradeInfo;
  logo?: string;
  onClick: () => void;
}) {
  const price = tradeInfo?.price;
  const direction = tradeInfo?.direction || "neutral";
  const bump = tradeInfo?.bump || 0;

  const pct = parseFloat(String(meta.changePercent24Hr ?? ""));
  const pctPos = Number.isFinite(pct) && pct > 0;

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
      layout
      className="group relative"
      whileHover={{ scale: 1.03, zIndex: 10 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      <div
        className={`relative overflow-hidden rounded-2xl cursor-pointer border-2 transition-colors duration-100 ${cardTone}`}
      >
        {/* Ultra-fast flash */}
        <AnimatePresence>
          {bump > 0 && (
            <motion.div
              key={bump}
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.1, ease: "linear" }}
              style={{
                background: flashBg,
                mixBlendMode: "screen",
                filter: "saturate(1.6) contrast(1.15)",
              }}
            />
          )}
        </AnimatePresence>

        <div className="relative p-2.5 sm:p-4">
          {/* Rank badge */}
          <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3">
            <div className="bg-black/15 dark:bg-black/30 backdrop-blur-sm px-1.5 py-0.5 sm:px-2 rounded-full">
              <span className="text-[9px] sm:text-[10px] font-bold text-gray-900 dark:text-white/90">
                #{meta.rank || "—"}
              </span>
            </div>
          </div>

          {/* Logo and symbol */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 pr-10 sm:pr-12">
            <div className="relative flex-shrink-0">
              <div className="relative bg-white/90 dark:bg-white/90 rounded-full p-1 sm:p-1.5 shadow-sm">
                <CoinImage
                  src={logo}
                  alt={meta.symbol}
                  className="w-5 h-5 sm:w-7 sm:h-7"
                />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-base font-bold text-gray-900 dark:text-white">
                {meta.symbol || id}
              </h3>
            </div>
          </div>

          {/* Price */}
          <div className="mb-1.5 sm:mb-2">
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">
                {formatUsd(price)}
              </span>
              {direction !== "neutral" && (
                <span
                  className={`text-xs sm:text-base font-bold ${
                    direction === "up"
                      ? "text-emerald-800 dark:text-white"
                      : "text-rose-800 dark:text-white"
                  }`}
                >
                  {direction === "up" ? "↑" : "↓"}
                </span>
              )}
            </div>
          </div>

          {/* 24h change */}
          <div className="flex items-center justify-between">
            <div
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full backdrop-blur-sm ${
                Number.isFinite(pct) && pct !== 0
                  ? pctPos
                    ? "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200"
                    : "bg-rose-500/15 text-rose-800 dark:bg-rose-500/25 dark:text-rose-200"
                  : "bg-black/10 dark:bg-black/20 text-gray-900 dark:text-white/90"
              }`}
            >
              <span className="text-[9px] sm:text-xs font-semibold whitespace-nowrap">
                24h: {formatPct(meta.changePercent24Hr)}
              </span>
              {Number.isFinite(pct) && pct !== 0 && (
                <span className="text-[10px] sm:text-sm font-black">
                  {pctPos ? "↑" : "↓"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* Table Row Component */
const TableRow = memo(function TableRow({
  id,
  meta,
  tradeInfo,
  logo,
  onClick,
}: {
  id: string;
  meta: CoinMeta;
  tradeInfo?: TradeInfo;
  logo?: string;
  onClick: () => void;
}) {
  const price = tradeInfo?.price;
  const direction = tradeInfo?.direction || "neutral";

  const pct = parseFloat(String(meta.changePercent24Hr ?? ""));
  const pctPos = Number.isFinite(pct) && pct > 0;
  const pctNeg = Number.isFinite(pct) && pct < 0;

  const rowBg =
    direction === "up"
      ? "bg-emerald-300/70 dark:bg-emerald-700/50"
      : direction === "down"
        ? "bg-rose-300/70 dark:bg-rose-700/50"
        : "";

  return (
    <tr
      className={`cursor-pointer transition-colors duration-100 ${rowBg} hover:bg-black/5 dark:hover:bg-white/5`}
      onClick={onClick}
    >
      <td className="px-3 sm:px-6 py-3 sm:py-4">
        <div className="inline-flex items-center justify-center bg-black/10 dark:bg-white/10 rounded-full px-2.5 py-1">
          <span className="text-[11px] sm:text-sm font-bold text-gray-800 dark:text-white/90">
            #{meta.rank ?? "—"}
          </span>
        </div>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="relative bg-white/90 dark:bg-white/90 rounded-full p-1.5 shadow-sm">
              <CoinImage
                src={logo}
                alt={meta.symbol}
                className="w-6 h-6 sm:w-8 sm:h-8"
              />
            </div>
          </div>
          <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
            {meta.symbol ?? id}
          </span>
        </div>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4">
        <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-white/80 line-clamp-1">
          {meta.name ?? "—"}
        </span>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
            {formatUsd(price)}
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
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm ${
            pctPos
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              : pctNeg
                ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
                : "bg-black/10 dark:bg-white/10 text-gray-800 dark:text-white/70"
          }`}
        >
          <span aria-hidden className="text-base">
            {pctPos ? "↑" : pctNeg ? "↓" : ""}
          </span>
          {formatPct(meta.changePercent24Hr)}
        </div>
      </td>
    </tr>
  );
});

/* WebSocket Hook */
function useWebSocketStream(
  assetIds: string[],
  enabled: boolean,
  onPriceUpdate: (updates: Record<string, number>) => void
) {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [sessionEnded, setSessionEnded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  const cleanupSession = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    cleanup();
  }, [cleanup]);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled || !API_KEY || assetIds.length === 0 || sessionEnded)
      return;

    cleanup();

    const assetsParam = assetIds.join(",");
    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=${encodeURIComponent(assetsParam)}&apiKey=${API_KEY}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("live");
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;

      if (typeof e.data === "string" && e.data.startsWith("Unauthorized")) {
        setStatus("error");
        cleanup();
        return;
      }

      try {
        const data = JSON.parse(e.data) as Record<string, string>;
        const updates: Record<string, number> = {};

        for (const [id, priceStr] of Object.entries(data)) {
          const price = parseFloat(priceStr);
          if (Number.isFinite(price)) {
            updates[id] = price;
          }
        }

        if (Object.keys(updates).length > 0) {
          onPriceUpdate(updates);
        }
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current || sessionEnded) return;

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        setTimeout(connect, RECONNECT_DELAY_MS * reconnectAttempts.current);
      } else {
        setStatus("error");
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      // onclose will handle reconnection
    };
  }, [assetIds, enabled, cleanup, onPriceUpdate, sessionEnded]);

  const restart = useCallback(() => {
    setSessionEnded(false);
    reconnectAttempts.current = 0;
    setStatus("connecting");
    
    // Start new session timer
    sessionTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      cleanupSession();
      setStatus("error");
      setSessionEnded(true);
    }, SESSION_TIMEOUT_MS);
    
    connect();
  }, [connect, cleanupSession]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled && assetIds.length > 0 && !sessionEnded) {
      // Start session timer on initial mount
      sessionTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        cleanupSession();
        setStatus("error");
        setSessionEnded(true);
      }, SESSION_TIMEOUT_MS);
      
      connect();
    }
    
    return () => {
      mountedRef.current = false;
      cleanupSession();
    };
  }, [assetIds, enabled, connect, cleanupSession, sessionEnded]);

  return { status, sessionEnded, restart };
}

/* Main Component --------------------------------------------------- */
export default function LiveStreamHeatmap() {
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeInfo>>(
    {}
  );
  const [metaData, setMetaData] = useState<Record<string, CoinMeta>>({});
  const [topIds, setTopIds] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<CoinMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  /* Fetch CoinGecko logos */
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        if (!res.ok) return;
        const json = await res.json();
        if (canceled) return;

        const logoMap: Record<string, string> = {};
        for (const c of json || []) {
          const key = c.symbol?.toLowerCase?.();
          if (key && c.image) {
            logoMap[key] = c.image;
          }
        }
        setLogos(logoMap);
      } catch (e) {
        console.warn("Failed to fetch CoinGecko data:", e);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  /* Fetch CoinCap metadata */
  useEffect(() => {
    let canceled = false;

    (async () => {
      if (!API_KEY) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`
        );
        if (!res.ok || canceled) {
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (canceled) return;

        const meta: Record<string, CoinMeta> = {};
        const initialPrices: Record<string, TradeInfo> = {};
        const ids: string[] = [];

        for (const a of json.data || []) {
          if (!a?.id) continue;
          meta[a.id] = a;
          ids.push(a.id);

          const p = parseFloat(a.priceUsd);
          if (Number.isFinite(p)) {
            const pct = parseFloat(String(a.changePercent24Hr ?? ""));
            initialPrices[a.id] = {
              price: p,
              direction:
                Number.isFinite(pct) && pct !== 0
                  ? pct > 0
                    ? "up"
                    : "down"
                  : "neutral",
              bump: 0,
            };
          }
        }

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

  /* Sorted and visible IDs */
  const sortedIds = useMemo(() => {
    if (topIds.length) return topIds;
    return Object.keys(metaData)
      .sort(
        (a, b) => (+metaData[a]?.rank || 9999) - (+metaData[b]?.rank || 9999)
      )
      .slice(0, 200);
  }, [topIds, metaData]);

  const visibleIds = useMemo(
    () => sortedIds.slice(0, visibleCount),
    [sortedIds, visibleCount]
  );

  /* Price update handler */
  const handlePriceUpdate = useCallback(
    (updates: Record<string, number>) => {
      setTradeInfoMap((prev) => {
        const next = { ...prev };
        let changed = false;

        for (const [id, newPrice] of Object.entries(updates)) {
          const existing = prev[id];
          const oldPrice = existing?.price;

          if (oldPrice === undefined) {
            next[id] = { price: newPrice, direction: "neutral", bump: 1 };
            changed = true;
          } else if (newPrice !== oldPrice) {
            next[id] = {
              price: newPrice,
              direction: newPrice > oldPrice ? "up" : "down",
              bump: (existing?.bump || 0) + 1,
            };
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    },
    []
  );

  /* WebSocket connection */
  const { status, sessionEnded, restart } = useWebSocketStream(
    visibleIds,
    !loading && visibleIds.length > 0,
    handlePriceUpdate
  );

  /* Get logo for asset */
  const getLogoUrl = useCallback(
    (symbol: string): string | undefined => {
      const sym = symbol?.toLowerCase();
      return (
        logos[sym] ||
        (sym ? `https://assets.coincap.io/assets/icons/${sym}@2x.png` : undefined)
      );
    },
    [logos]
  );

  /* Click handlers */
  const handleAssetClick = useCallback(
    (asset: CoinMeta) => {
      setSelectedAsset(asset);
      trackEvent("CryptoAssetClick", { ...asset });
    },
    []
  );

  const handleViewToggle = useCallback(() => {
    setViewMode((v) => {
      const next = v === "grid" ? "table" : "grid";
      trackEvent("CryptoViewToggle", { view: next });
      return next;
    });
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(sortedIds.length, c + PAGE_SIZE));
  }, [sortedIds.length]);

  const handleShowTop = useCallback(() => {
    setVisibleCount(PAGE_SIZE);
  }, []);

  /* Loading state */
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
      <div className="min-h-screen dark:bg-brand-900 bg-white pb-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-xl opacity-40" />
                  <div className="relative bg-indigo-500/50 dark:bg-indigo-900/40 p-3 rounded-2xl shadow-sm">
                    <FaFire className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Live Crypto Heatmap
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    Live WebSocket prices • Top 200 by market cap • Colors
                    reflect real-time price movement
                  </p>
                </div>
              </div>

              <motion.button
                onClick={handleViewToggle}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2.5 bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white px-5 py-3 rounded-2xl transition-all duration-200 font-semibold text-sm"
              >
                {viewMode === "grid" ? (
                  <FaTable className="w-4 h-4" />
                ) : (
                  <FaThLarge className="w-4 h-4" />
                )}
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
            </div>

            {/* Connection status */}
            <div className="pointer-events-none">
              <AnimatePresence mode="wait">
                {status === "connecting" && !sessionEnded && (
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

                {status === "error" && !sessionEnded && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-md cursor-pointer hover:bg-rose-500/30 transition-colors"
                    onClick={restart}
                  >
                    <div className="w-2 h-2 bg-rose-500 rounded-full" />
                    <span className="text-xs font-semibold text-rose-900 dark:text-rose-100">
                      Disconnected • Click to reconnect
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2">
              {visibleCount > PAGE_SIZE && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShowTop}
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
              {visibleIds.map((id) => (
                <GridCard
                  key={id}
                  id={id}
                  meta={metaData[id] || ({ id } as CoinMeta)}
                  tradeInfo={tradeInfoMap[id]}
                  logo={getLogoUrl(metaData[id]?.symbol)}
                  onClick={() => handleAssetClick(metaData[id])}
                />
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-2xl border border-gray-200/50 dark:border-white/10 bg-white/80 dark:bg-brand-900/80 backdrop-blur-xl shadow-2xl">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-brand-800 dark:to-brand-900/50 border-b border-gray-200/50 dark:border-white/10">
                      {["Rank", "Asset", "Name", "Price", "24h Change"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-700 dark:text-white/80"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {visibleIds.map((id) => (
                      <TableRow
                        key={id}
                        id={id}
                        meta={metaData[id] || ({ id } as CoinMeta)}
                        tradeInfo={tradeInfoMap[id]}
                        logo={getLogoUrl(metaData[id]?.symbol)}
                        onClick={() => handleAssetClick(metaData[id])}
                      />
                    ))}
                    {sortedIds.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-gray-500 dark:text-white/60"
                        >
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

      {visibleCount < sortedIds.length && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLoadMore}
          className="px-4 m-10 py-2 rounded-2xl bg-white/70 dark:bg-white/10 border border-gray-200/60 dark:border-white/10 text-gray-800 dark:text-white/80 text-xs sm:text-sm font-semibold backdrop-blur-md"
        >
          Load more
        </motion.button>
      )}

      {/* Asset Detail Modal */}
      <CryptoAssetPopup
        asset={selectedAsset}
        logos={logos}
        onClose={() => setSelectedAsset(null)}
        tradeInfo={selectedAsset ? tradeInfoMap[selectedAsset.id] : undefined}
      />

      {/* WebSocket Session Ended Modal */}
      <AnimatePresence>
        {sessionEnded && (
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
                  onClick={() => restart()}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl mb-4 shadow-lg">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
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
                    className="w-full px-6 py-3 bg-indigo-500/50 dark:bg-indigo-900/40 dark:text-white text-gray-900 rounded-2xl font-bold shadow-lg shadow-indigo-500/25 transition-all duration-200"
                    onClick={restart}
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