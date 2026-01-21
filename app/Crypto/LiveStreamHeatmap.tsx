"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTable, FaThLarge, FaFire } from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

/* Types ------------------------------------------------------------ */
interface TradeInfo {
  price: number;
  prev?: number;
  bump?: number;
}

interface CoinGeckoInfo {
  high: number;
  low: number;
}

/* Constants -------------------------------------------------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";
const WS_TIMEOUT = 600_000; // 10 minutes
const POLL_INTERVAL = 5_000; // 5 seconds

/* Utilities -------------------------------------------------------- */
const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const fmt = {
  usd: (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? "—" : currencyFmt.format(n);
  },
  pct: (s: any) => s != null ? `${parseFloat(String(s)).toFixed(2)}%` : "N/A",
};

/* Component -------------------------------------------------------- */
export default function LiveStreamHeatmap() {
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeInfo>>({});
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [topIds, setTopIds] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsAvailable, setWsAvailable] = useState(true);
  const [wsClosed, setWsClosed] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [cgInfo, setCgInfo] = useState<Record<string, CoinGeckoInfo>>({});

  const socketRef = useRef<WebSocket | null>(null);

  /* Load CoinGecko logos and 24h high/low data */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const logoMap: Record<string, string> = {};
        const infoMap: Record<string, CoinGeckoInfo> = {};

        json.forEach((c: any) => {
          const key = c.symbol?.toLowerCase?.();
          if (!key) return;
          logoMap[key] = c.image;
          infoMap[key] = { high: c.high_24h, low: c.low_24h };
        });

        setLogos(logoMap);
        setCgInfo(infoMap);
      } catch {}
    })();
  }, []);

  /* Bootstrap CoinCap metadata and initial prices */
  useEffect(() => {
    let canceled = false;

    (async () => {
      if (!API_KEY) {
        setWsAvailable(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`);
        if (res.status === 403) {
          setWsAvailable(false);
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
          if (!Number.isNaN(p)) {
            initialPrices[a.id] = { price: p, prev: undefined, bump: 0 };
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

    return () => { canceled = true; };
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

  /* WebSocket for live price updates */
  useEffect(() => {
    if (!API_KEY || !topIds.length || !wsAvailable) return;

    socketRef.current?.close();
    setWsClosed(false);

    const assetsParam = topIds.join(",");
    const ws = new WebSocket(`wss://wss.coincap.io/prices?assets=${encodeURIComponent(assetsParam)}&apiKey=${API_KEY}`);
    socketRef.current = ws;

    const wsTimeout = window.setTimeout(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    }, WS_TIMEOUT);

    ws.onmessage = (e) => {
      if (typeof e.data === "string" && e.data.startsWith("Unauthorized")) {
        setWsAvailable(false);
        ws.close();
        setLoading(false);
        return;
      }

      let update: Record<string, string> | null = null;
      try {
        update = JSON.parse(e.data);
      } catch {
        return;
      }

      if (!update) return;

      setTradeInfoMap((prev) => {
        const next = { ...prev };
        for (const [id, priceStr] of Object.entries(update)) {
          const p = parseFloat(priceStr as string);
          if (!Number.isFinite(p)) continue;
          const old = prev[id]?.price;
          const nextBump = (prev[id]?.bump || 0) + 1;
          next[id] = { price: p, prev: old, bump: nextBump };
        }
        return next;
      });

      setLoading(false);
    };

    ws.onclose = () => {
      window.clearTimeout(wsTimeout);
      setWsClosed(true);
    };

    return () => {
      window.clearTimeout(wsTimeout);
      socketRef.current?.close();
    };
  }, [topIds, wsAvailable]);

  /* Polling fallback for free tier without WebSocket */
  useEffect(() => {
    if (wsAvailable || !API_KEY) return;

    const fetchPrices = async () => {
      try {
        const res = await fetch(`https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`);
        const json = await res.json();
        const upd: Record<string, number> = {};
        const meta: Record<string, any> = {};
        const ids: string[] = [];

        (json.data || []).forEach((a: any) => {
          if (!a?.id) return;
          meta[a.id] = a;
          ids.push(a.id);
          const p = parseFloat(a.priceUsd);
          if (Number.isFinite(p)) upd[a.id] = p;
        });

        ids.sort((a, b) => (+meta[a]?.rank || 9999) - (+meta[b]?.rank || 9999));

        setTopIds(ids.slice(0, 200));
        setMetaData((prev) => ({ ...prev, ...meta }));

        setTradeInfoMap((prev) => {
          const next = { ...prev };
          for (const [id, p] of Object.entries(upd)) {
            const old = prev[id]?.price;
            const nextBump = (prev[id]?.bump || 0) + 1;
            next[id] = { price: p, prev: old, bump: nextBump };
          }
          return next;
        });

        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = window.setInterval(fetchPrices, POLL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [wsAvailable]);

  /* Sorted list of crypto IDs */
  const sortedIds = useMemo(() => {
    if (topIds.length) return topIds.slice(0, 200);
    const all = Object.keys(tradeInfoMap).sort(
      (a, b) => (+metaData[a]?.rank || 9999) - (+metaData[b]?.rank || 9999)
    );
    return all.slice(0, 200);
  }, [topIds, tradeInfoMap, metaData]);

  if (loading) {
    return (
     <div className="
  fixed inset-0 z-50 flex items-center justify-center
  bg-white/80 backdrop-blur-sm
  dark:bg-brand-900/90
">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20 dark:from-brand-900 dark:via-brand-900 dark:to-brand-800 pb-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6">
          {/* Warning Banner */}
          <AnimatePresence>
            {!wsAvailable && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200">
                    WebSocket unavailable—polling every 5 seconds
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
                  <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl shadow-lg">
                    <FaFire className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Live Crypto Heatmap
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    Real-time price movements • Top 200 by market cap
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
                className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-3 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all duration-200 font-semibold text-sm"
              >
                {viewMode === "grid" ? <FaTable className="w-4 h-4" /> : <FaThLarge className="w-4 h-4" />}
                <span>{viewMode === "grid" ? "Table View" : "Grid View"}</span>
              </motion.button>
            </div>
          </div>

          {/* Grid View */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1 sm:gap-1">
              {sortedIds.map((id) => {
                const { price, prev, bump } = tradeInfoMap[id] || {};
                const md = metaData[id] || {};
                const pct = parseFloat(String(md.changePercent24Hr ?? ""));
                const pctPos = Number.isFinite(pct) && pct > 0;
                const pctNeg = Number.isFinite(pct) && pct < 0;

                let isPositive = false;
                let isNegative = false;
                let arrow = "";

                if (prev != null && price != null) {
                  isPositive = price > prev;
                  isNegative = price < prev;
                  arrow = isPositive ? "↑" : isNegative ? "↓" : "";
                } else {
                  isPositive = pctPos;
                  isNegative = pctNeg;
                }

                const logo = logos[md.symbol?.toLowerCase()];

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
    {/* soft hover glow */}
    <div className="absolute inset-0 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />

    {(() => {
          const cardTone = isPositive
            ? "bg-gradient-to-br from-green-500 to-emerald-600 border-green-400/35 shadow-lg shadow-green-500/20"
            : isNegative
            ? "bg-gradient-to-br from-red-500 to-rose-600 border-red-400/35 shadow-lg shadow-red-500/20"
            : "bg-gradient-to-br from-gray-400 to-gray-500 border-gray-300/30 shadow-lg shadow-gray-500/10";

const flashBg = isPositive
  ? "radial-gradient(circle at center, rgba(34,197,94,0.88) 0%, rgba(34,197,94,0.38) 36%, rgba(34,197,94,0) 72%)"
  : "radial-gradient(circle at center, rgba(239,68,68,0.88) 0%, rgba(239,68,68,0.38) 36%, rgba(239,68,68,0) 72%)";

      return (
        <div
          className={[
            "relative overflow-hidden rounded-2xl cursor-pointer",
            "border-2 transition-all duration-300",
            cardTone,
          ].join(" ")}
        >
          {/* Flash overlay on price update (GREEN/RED flash) */}
          <AnimatePresence>
            {prev != null && price != null && bump != null && bump > 0 && (
              <motion.div
                key={`${id}-${bump}`}
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                style={{ background: flashBg }}
              />
            )}
          </AnimatePresence>

          <div className="relative p-3 sm:p-4">
            {/* Rank badge */}
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
              <div className="bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                <span className="text-[9px] sm:text-[10px] font-bold text-white/90">
                  #{md.rank || "—"}
                </span>
              </div>
            </div>

            {/* Logo and symbol */}
            <div className="flex items-center gap-2 mb-3">
              {logo ? (
                <div className="relative flex-shrink-0">
                  {/* removed the shiny white blur; keep it clean */}
                  <div className="relative bg-white/90 rounded-full p-1.5 shadow-md">
                    <img
                      src={logo}
                      alt={md.symbol}
                      className="w-6 h-6 sm:w-7 sm:h-7"
                      loading="lazy"
                    />
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex-shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <h3 className="font-black text-sm sm:text-base text-white truncate drop-shadow-lg">
                  {md.symbol || id}
                </h3>
              </div>
            </div>

            {/* Price */}
            <div className="mb-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-black text-white drop-shadow-lg">
                  {fmt.usd(price)}
                </span>
                {arrow && (
                  <span className="text-sm sm:text-base font-black text-white/90 drop-shadow-lg">
                    {arrow}
                  </span>
                )}
              </div>
            </div>

            {/* 24h change */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1 bg-black/20 backdrop-blur-sm px-2 py-1 rounded-full">
                <span className="text-[10px] sm:text-xs font-bold text-white/90">
                  {fmt.pct(md.changePercent24Hr)}
                </span>
              </div>

              {(pctPos || pctNeg) && (
                <div
                  className={[
                    "text-xs sm:text-sm font-black drop-shadow-lg",
                    pctPos ? "text-emerald-200" : "text-rose-200",
                  ].join(" ")}
                >
                  {pctPos ? "↑" : "↓"}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}
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
                    {sortedIds.map((id) => {
                      const md = metaData[id] || {};
                      const { price, prev, bump } = tradeInfoMap[id] || {};
                      const pct = parseFloat(String(md.changePercent24Hr ?? ""));
                      const pctPos = Number.isFinite(pct) && pct > 0;
                      const pctNeg = Number.isFinite(pct) && pct < 0;
                      const tickPos = price != null && prev != null && price > prev;
                      const tickNeg = price != null && prev != null && price < prev;
                      const pos = prev != null ? tickPos : pctPos;
                      const neg = prev != null ? tickNeg : pctNeg;
                      const logo = logos[String(md.symbol ?? "").toLowerCase()];

                      return (
                        <motion.tr
                          key={`${id}-${bump ?? 0}`}
                          className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors duration-200"
                          onClick={() => {
                            setSelectedAsset(md);
                            trackEvent("CryptoAssetClick", { id });
                          }}
                          initial={false}
                          animate={{
                            backgroundColor: bump
                              ? pos
                                ? "rgba(16,185,129,0.12)"
                                : neg
                                ? "rgba(244,63,94,0.12)"
                                : "rgba(0,0,0,0)"
                              : "rgba(0,0,0,0)",
                          }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="inline-flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded-full px-2.5 py-1">
                              <span className="text-[11px] sm:text-sm font-bold text-gray-700 dark:text-white/90">
                                #{md.rank ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-3">
                              {logo ? (
                                <div className="relative flex-shrink-0">
                                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-md" />
                                  <div className="relative bg-white dark:bg-brand-800 rounded-full p-1.5 ring-2 ring-gray-200/50 dark:ring-white/10 shadow-lg">
                                    <img
                                      src={logo}
                                      alt={md.symbol}
                                      className="w-6 h-6 sm:w-8 sm:h-8"
                                      loading="lazy"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-white/10 dark:to-white/5 flex-shrink-0" />
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
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm ${
                                pos
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : neg
                                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                  : "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white/70"
                              }`}
                            >
                              <span aria-hidden className="text-base">
                                {pos ? "↑" : neg ? "↓" : ""}
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

      {/* WebSocket Closed Modal */}
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
                    The live price stream ended automatically after 10 minutes.
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/25 transition-all duration-200"
                    onClick={() => window.location.reload()}
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