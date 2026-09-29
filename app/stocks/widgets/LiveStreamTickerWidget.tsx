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


import { WidgetCard } from "@/components/ui/widget-card";
import { useMarketData } from "../hooks/useMarketData";
import { TICKER_SYMBOLS } from "../lib/tickers";
import type { TradeInfo } from "../lib/types";
import { useQuoteModal } from "../hooks/useQuoteModal";

/* ─── Constants ────────────────────────────────────────────────────── */
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

  // Quote modal (shared fetch + popup)
  const { openQuote, quoteModal } = useQuoteModal();

  /* ── Derived UI ───────────────────────────────────────────────────── */
  const sub =
    marketState === "open"       ? (wsConnected ? "Live" : "Reconnecting") :
    marketState === "premarket"  ? "Pre-market"  :
    marketState === "afterhours" ? "After hours" : "Market closed";

  const statusPill =
    marketState === "open"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20"
      : marketState === "closed"
      ? "bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10"
      : "bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20";

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <>
      <WidgetCard
        title="Markets"
        subtitle="12 large caps · tap a tile for details"
        href="/stocks"
        hrefLabel="More market data"
        action={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${statusPill}`}
            title="Market session"
          >
            <span className="relative flex h-1.5 w-1.5">
              {marketState === "open" && wsConnected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            {sub}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TICKER_SYMBOLS.map((sym) => {
            const td   = tickerMap[sym];
            const info = flashMap[sym];
            const logo = td?.logo || LOGO_FALLBACK;

            const flashDir = info?.dir ?? "flat";
            const flashBg =
              flashDir === "up"   ? "bg-emerald-400/10" :
              flashDir === "down" ? "bg-rose-400/10"    :
                                   "bg-transparent";

            const pct          = td?.quote?.dp ?? info?.percentChange ?? 0;
            const pctColor     =
              pct > 0 ? "text-emerald-600 dark:text-emerald-400" :
              pct < 0 ? "text-rose-500 dark:text-rose-400"       :
                        "text-slate-400";
            const displayPrice = fmt.usd(info?.price ?? td?.quote?.c);
            const displayPct   = pct ? `${pct > 0 ? "+" : ""}${fmt.pct(pct)}` : "0.00%";

            return (
              <motion.button
                key={sym}
                type="button"
                onClick={() => openQuote(sym)}
                className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/20"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                title={`${sym} details`}
              >
                <AnimatePresence initial={false}>
                  {info?.flashKey ? (
                    <motion.div
                      key={`${sym}-${info.flashKey}`}
                      className={`pointer-events-none absolute inset-0 ${flashBg}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.6 }}
                    />
                  ) : null}
                </AnimatePresence>

                <div className="relative flex items-center gap-2">
                  <img
                    src={logo}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-md bg-white object-contain ring-1 ring-slate-200/70 dark:ring-white/10"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK;
                    }}
                  />
                  <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {sym}
                  </span>
                </div>

                <div className="relative mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {displayPrice}
                  </span>
                  <span className={`text-[11px] font-medium tabular-nums ${pctColor}`}>
                    {displayPct}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </WidgetCard>

      {quoteModal}
    </>
  );
}
