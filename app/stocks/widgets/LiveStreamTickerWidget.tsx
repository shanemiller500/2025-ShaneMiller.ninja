"use client";
/**
 * LiveStreamTickerWidget.tsx — Compact 12-symbol live ticker grid.
 *
 * Previously fetched quotes + profiles independently on every mount with
 * no caching. Now delegates all data fetching to the shared marketStore
 * via useMarketData — profiles are served from the 24h localStorage cache,
 * quotes from the 10min in-memory cache.
 *
 * WebSocket is the single shared connection managed by the store.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useMarketData } from "../hooks/useMarketData";
import { TICKER_SYMBOLS } from "../lib/tickers";
import type { TradeInfo } from "../lib/types";
import StockQuoteModal from "../StockQuoteModal";

/* ─── Constants ────────────────────────────────────────────────────── */
const PROXY_BASE = "https://u-mail.co/api/finnhubProxy";
const LOGO_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="%23EEF2FF"/><text x="50%" y="54%" font-family="Arial" font-size="7" text-anchor="middle" fill="%234C1D95">Loading</text></svg>';

type MarketState = "open" | "premarket" | "afterhours" | "closed";

/* ─── Helpers ──────────────────────────────────────────────────────── */
const fmt = {
  usd: (n: number | null | undefined) =>
    typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—",
  pct: (n: number | null | undefined) =>
    typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : "",
};

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
export default function LiveStreamTickerWidget() {
  // Market clock — sync init so wsEnabled is correct on first render
  const [marketState, setMarketState] = useState<MarketState>(calcMarketState);
  useEffect(() => {
    const interval = window.setInterval(
      () => setMarketState(calcMarketState()),
      60_000
    );
    return () => window.clearInterval(interval);
  }, []);

  // All data from the shared store — HIGH priority; WS disabled when market is closed
  const { tickerMap, wsConnected } = useMarketData(TICKER_SYMBOLS, "high", {
    wsEnabled: marketState !== "closed",
  });

  // Flash-animation state derived from incoming price changes
  const [flashMap, setFlashMap] = useState<Record<string, TradeInfo>>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setFlashMap((prev) => {
      const next = { ...prev };
      const now  = Date.now();

      for (const sym of TICKER_SYMBOLS) {
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
          flashKey: now + Math.random(),
        };
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerMap]);

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

      if (!quote || typeof quote.c !== "number" || quote.c <= 0) {
        toast.error(`No data found for "${sym}".`);
        return;
      }

      const profileData = profile?.name
        ? profile
        : { ...profile, name: sym, ticker: sym, exchange: profile?.exchange ?? "", logo: profile?.logo ?? "" };

      setSelectedStockData({ profile: profileData, quote, metric });
      setSelectedNewsData(Array.isArray(news) ? news : []);
      setSelectedSymbol(sym);
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch symbol data.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedSymbol(null);
    setSelectedStockData(null);
    setSelectedNewsData([]);
  };

  /* ── Derived UI ───────────────────────────────────────────────────── */
  const banner =
    marketState === "closed"  ? "Markets Closed"       :
    marketState === "premarket"  ? "Pre-Market Trading"   :
    marketState === "afterhours" ? "After-Hours Trading"  : null;

  const bannerColor = marketState === "closed" ? "text-red-600" : "text-yellow-500";
  const sub =
    marketState === "open"       ? "Live"   :
    marketState === "premarket"  ? "Pre"    :
    marketState === "afterhours" ? "After"  : "Closed";

  const statusPill =
    marketState === "open"
      ? "bg-green-500/15 text-green-700 dark:text-green-200 ring-green-500/20"
      : marketState === "closed"
      ? "bg-red-500/15 text-red-700 dark:text-red-200 ring-red-500/20"
      : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200 ring-yellow-500/20";

  const wsLabel =
    marketState === "premarket"  ? (wsConnected ? "Pre-Market Stream" : "Pre-Market")  :
    marketState === "afterhours" ? (wsConnected ? "After-Hours Stream" : "After-Hours") :
    marketState === "open"       ? (wsConnected ? "Stream Live"        : "Reconnecting") :
    null; // closed — hide the pill entirely

  const wsPill = wsConnected
    ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 ring-indigo-500/20"
    : "bg-gray-500/10 text-gray-700 dark:text-gray-300 ring-white/10";

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <>
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar pauseOnHover />

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-brand-900 shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Live Stock Ticker
                </h2>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPill}`}
                  title="Market session"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {sub}
                </span>
                {wsLabel && (
                  <span
                    className={`hidden sm:inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${wsPill}`}
                    title="WebSocket status"
                  >
                    {wsLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {banner && (
            <div className={`mt-4 text-center text-xs font-semibold ${bannerColor} animate-pulse`}>
              {banner}
            </div>
          )}
        </div>

        <div className="px-3 pb-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {TICKER_SYMBOLS.map((sym) => {
              const td   = tickerMap[sym];
              const info = flashMap[sym];
              const dp   = td?.quote?.dp ?? 0;
              const logo = td?.logo || LOGO_FALLBACK;

              const baseBg =
                dp > 0 ? "bg-green-200/80 dark:bg-green-800/40" :
                dp < 0 ? "bg-red-200/80 dark:bg-red-800/40"     :
                         "bg-gray-100 dark:bg-brand-900/60";

              const flashDir = info?.dir ?? "flat";
              const flashBg =
                flashDir === "up"   ? "bg-green-400/70 dark:bg-green-500/35" :
                flashDir === "down" ? "bg-red-400/70 dark:bg-red-500/35"     :
                                     "bg-white/0";

              const pct          = td?.quote?.dp ?? info?.percentChange ?? 0;
              const pctColor     = pct >= 0
                ? "text-green-800 dark:text-green-200"
                : "text-red-800 dark:text-red-200";
              const displayPrice = fmt.usd(info?.price ?? td?.quote?.c);
              const displayPct   = fmt.pct(pct);

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
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={logo}
                      alt={sym}
                      className="h-13 w-13 object-contain opacity-80"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK;
                      }}
                    />
                  </div>

                  {/* Persistent daily-change tint — always visible over the logo */}
                  {dp !== 0 && (
                    <div className={`absolute inset-0 ${
                      dp > 0
                        ? "bg-green-400/40 dark:bg-green-500/25"
                        : "bg-red-400/40 dark:bg-red-500/25"
                    }`} />
                  )}

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

                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 px-2 py-1.5 bg-white/75 dark:bg-black/30">
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white">
                      {displayPrice}
                    </span>
                    <span className={`text-[11px] font-semibold ${pctColor}`}>
                      {displayPct}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <p className="mt-4 mb-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            See more stock market data{" "}
            <a href="/stocks" className="text-indigo-600 dark:text-indigo-300 underline">
              here
            </a>
            .
          </p>
        </div>
      </section>

      {modalLoading && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="rounded-xl bg-white/10 px-4 py-3 text-white text-sm backdrop-blur">
            Loading…
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
}
