/* eslint-disable @next/next/no-img-element */
"use client";
/**
 * LiveStreamHeatmapSection.tsx — Exchange Heatmap with live price tiles.
 *
 * All REST fetching (quotes, profiles, logos) is now delegated to the
 * shared marketStore via useMarketData. The component only owns:
 *   - Local market-clock state (no API calls — pure JS)
 *   - Flash-animation state derived from incoming tickerMap updates
 *   - The click-to-modal handler (fires its own fresh 4-call fetch —
 *     acceptable for a deliberate user action, not on mount)
 *
 * WebSocket is also managed by the store (single shared connection).
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useMarketData } from "../hooks/useMarketData";
import { HEATMAP_SYMBOLS } from "../lib/tickers";
import type { TradeInfo } from "../lib/types";
import StockQuoteModal from "../StockQuoteModal";

/* ─── Constants ────────────────────────────────────────────────────── */
const PROXY_BASE = "https://u-mail.co/api/finnhubProxy";

const LOGO_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="%23EEF2FF"/><text x="50%" y="54%" font-family="Arial" font-size="7" text-anchor="middle" fill="%234C1D95">Loading</text></svg>';

type MarketState = "open" | "premarket" | "afterhours" | "closed";

/* ─── Helpers ──────────────────────────────────────────────────────── */
const usd = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";

const pctText = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : "";

const calcMarketState = (): MarketState => {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const mins = est.getHours() * 60 + est.getMinutes();
  if (day === 0 || day === 6) return "closed";
  if (mins >= 570 && mins < 960) return "open";
  if (mins >= 240 && mins < 570) return "premarket";
  if (mins >= 960 && mins < 1200) return "afterhours";
  return "closed";
};

/* ─── Component ────────────────────────────────────────────────────── */
const LiveStreamHeatmapSection: React.FC = () => {
  // All quote + profile data from the shared store
  const { tickerMap, wsConnected } = useMarketData(HEATMAP_SYMBOLS, "medium");

  // Flash-animation state — tracks tick direction per symbol
  const [flashMap, setFlashMap] = useState<Record<string, TradeInfo>>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  // Derive TradeInfo (flash direction) whenever tickerMap updates
  useEffect(() => {
    setFlashMap((prev) => {
      const next = { ...prev };
      const now  = Date.now();

      for (const sym of HEATMAP_SYMBOLS) {
        const td = tickerMap[sym];
        if (!td) continue;

        const price     = td.quote.c;
        const prevClose = td.quote.pc;
        const prevTick  = prevPricesRef.current[sym];
        prevPricesRef.current[sym] = price;

        const base =
          typeof prevClose === "number" && prevClose > 0
            ? prevClose
            : typeof prevTick === "number" && prevTick > 0
            ? prevTick
            : null;

        const percentChange =
          typeof base === "number" && base > 0
            ? ((price - base) / base) * 100
            : (td.quote.dp ?? 0);

        const dir: TradeInfo["dir"] =
          typeof prevTick === "number" && prevTick > 0
            ? price > prevTick ? "up" : price < prevTick ? "down" : "flat"
            : typeof prevClose === "number" && prevClose > 0
            ? price > prevClose ? "up" : price < prevClose ? "down" : "flat"
            : prev[sym]?.dir ?? "flat";

        next[sym] = {
          timestamp:     now,
          price,
          prevClose,
          prevTick,
          percentChange,
          dir,
          flashKey: now + Math.random(), // unique key forces AnimatePresence re-mount
        };
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerMap]);

  // Market clock — pure JS, no API calls
  const [marketState, setMarketState] = useState<MarketState>("closed");
  useEffect(() => {
    const tick = () => setMarketState(calcMarketState());
    tick();
    const int = window.setInterval(tick, 60_000);
    return () => window.clearInterval(int);
  }, []);

  // Modal state
  const [selectedSymbol,    setSelectedSymbol]    = useState<string | null>(null);
  const [selectedStockData, setSelectedStockData] = useState<any | null>(null);
  const [selectedNewsData,  setSelectedNewsData]  = useState<any[]>([]);
  const [modalLoading,      setModalLoading]      = useState(false);

  const openSymbolModal = async (sym: string) => {
    setModalLoading(true);
    try {
      const [quote, profile, metric, news] = await Promise.all([
        fetch(`${PROXY_BASE}/quote/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/profile/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/metric/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/news/${sym}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (!quote || typeof quote.c !== "number" || quote.c <= 0) return;

      const profileData = profile?.name
        ? profile
        : { ...profile, name: sym, ticker: sym, exchange: profile?.exchange ?? "", logo: profile?.logo ?? "" };

      setSelectedStockData({ profile: profileData, quote, metric });
      setSelectedNewsData(Array.isArray(news) ? news : []);
      setSelectedSymbol(sym);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedSymbol(null);
    setSelectedStockData(null);
    setSelectedNewsData([]);
  };

  /* ── Derived UI values ────────────────────────────────────────────── */
  const banner =
    marketState === "closed"
      ? "Markets Closed — Showing Last Price as of market close."
      : marketState === "premarket"
      ? "Pre-Market Trading"
      : marketState === "afterhours"
      ? "After-Hours Trading"
      : null;

  const bannerColor =
    marketState === "closed" ? "text-red-600" : "text-yellow-500";

  const sub =
    marketState === "open"   ? "Live"  :
    marketState === "premarket" ? "Pre"  :
    marketState === "afterhours" ? "After" : "Closed";

  const statusPill =
    marketState === "open"
      ? "bg-green-500/15 text-green-700 dark:text-green-200 ring-green-500/20"
      : marketState === "closed"
      ? "bg-red-500/15 text-red-700 dark:text-red-200 ring-red-500/20"
      : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200 ring-yellow-500/20";

  const wsPill = wsConnected
    ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 ring-indigo-500/20"
    : "bg-gray-500/10 text-gray-700 dark:text-gray-300 ring-white/10";

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <>
      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-brand-900 shadow-sm">
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Exchange Heatmap
                </h2>

                <span
                  className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPill}`}
                  title="Market session"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {sub}
                </span>

                <span
                  className={`hidden sm:inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${wsPill}`}
                  title="WebSocket status"
                >
                  {wsConnected
                    ? "Stream OK"
                    : marketState === "closed"
                    ? "Stream paused"
                    : "Reconnecting"}
                </span>
              </div>

              <p className="mt-2 text-xs font-semibold text-gray-600 dark:text-white/60">
                Live price updates when markets are open. Off-hours shows last
                price &amp; daily % change. Click a tile for details.
              </p>
            </div>
          </div>

          {banner && (
            <div className={`mt-3 text-center text-xs font-semibold ${bannerColor} animate-pulse`}>
              {banner}
            </div>
          )}
        </div>

        {/* Heatmap grid */}
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {HEATMAP_SYMBOLS.map((sym) => {
              const td   = tickerMap[sym];
              const info = flashMap[sym];
              const p    = info?.percentChange ?? td?.quote?.dp ?? 0;
              const logo = td?.logo || LOGO_FALLBACK;

              // Tile background intensity from daily % change
              const baseBg =
                p >= 2   ? "bg-emerald-400/80 dark:bg-emerald-700/45" :
                p >= 0.2 ? "bg-emerald-300/70 dark:bg-emerald-700/30" :
                p <= -2  ? "bg-rose-400/80 dark:bg-rose-700/45" :
                p <= -0.2 ? "bg-rose-300/70 dark:bg-rose-700/30" :
                            "bg-gray-100 dark:bg-brand-900/60";

              // Flash overlay on each new WS tick
              const flashBg =
                info?.dir === "up"   ? "bg-emerald-500/55 dark:bg-emerald-500/25" :
                info?.dir === "down" ? "bg-rose-500/55 dark:bg-rose-500/25" :
                                       "bg-white/0";

              const price    = usd(info?.price ?? td?.quote?.c);
              const ptxt     = pctText(p);
              const pctColor = p >= 0
                ? "text-emerald-900 dark:text-emerald-200"
                : "text-rose-900 dark:text-rose-200";
              const profileName = td?.profile?.name ?? "";

              return (
                <motion.button
                  key={sym}
                  type="button"
                  onClick={() => openSymbolModal(sym)}
                  className={`relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200/60 dark:border-white/10 ${baseBg} shadow-sm`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  title={`${sym} details`}
                >
                  {/* Center logo */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-white/35 dark:bg-black/0" />
                    <img
                      src={logo}
                      alt={sym}
                      className="h-13 w-13 object-contain opacity-85"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK;
                      }}
                    />
                  </div>

                  {/* Flash overlay */}
                  <AnimatePresence initial={false}>
                    {info?.flashKey ? (
                      <motion.div
                        key={`${sym}-${info.flashKey}`}
                        className={`absolute inset-0 ${flashBg}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      />
                    ) : null}
                  </AnimatePresence>

                  {/* Symbol + company name chip */}
                  <div className="absolute left-2 top-2 rounded-md bg-white/75 dark:bg-black/25 px-2 py-1 text-[10px] font-extrabold tracking-wide text-gray-900 dark:text-white ring-1 ring-black/5 dark:ring-white/10">
                    {sym}
                    {profileName && (
                      <div className="mt-0.5 max-w-[92px] text-[9px] font-semibold text-gray-700/90 dark:text-white/70 line-clamp-1">
                        {profileName}
                      </div>
                    )}
                  </div>

                  {/* Bottom price bar */}
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 px-2 py-1.5 bg-white/80 dark:bg-black/30">
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white">
                      {price}
                    </span>
                    <span className={`text-[11px] font-semibold ${pctColor}`}>
                      {ptxt}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            See more stock market data{" "}
            <a href="/stocks" className="text-indigo-600 dark:text-indigo-300 underline">
              here
            </a>
            .
          </p>
        </div>
      </section>

      {/* Modal loading overlay */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl bg-white/10 p-4 shadow-xl ring-1 ring-white/10">
            <div className="animate-spin h-10 w-10 border-t-4 border-indigo-400 rounded-full" />
          </div>
        </div>
      )}

      {selectedSymbol && selectedStockData && (
        <StockQuoteModal
          stockData={selectedStockData}
          newsData={selectedNewsData}
          onClose={closeModal}
        />
      )}
    </>
  );
};

export default LiveStreamHeatmapSection;
