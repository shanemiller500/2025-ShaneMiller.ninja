"use client";
/**
 * MarketWidgets.tsx — Sidebar panel for the Stock Quote tab.
 *
 * Data is now served by marketStore (shared singleton) via the
 * useMarketData hook. No local fetch logic, no local caches.
 * All rate-limiting, deduplication, and queuing is handled centrally.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";
import { formatDate } from "@/utils/formatters";
import { useMarketData } from "../hooks/useMarketData";
import { marketStore } from "../lib/marketStore";
import { TOP_TICKERS, MOVER_POOL } from "../lib/tickers";
import type { TickerData, MarketStatus } from "../lib/types";
import FearGreedWidget from "./FearGreedWidget";
import MortgageRateWidget from "./MortgageRateWidget";


/* ─── Props ────────────────────────────────────────────────────────── */
interface MarketWidgetsProps {
  onSelectTicker: (ticker: string) => void;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const pct = (n: number) =>
  `${n >= 0 ? "+" : ""}${Number.isFinite(n) ? n.toFixed(2) : "0.00"}%`;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function cleanLogo(url?: string): string {
  if (!url) return "";
  const s = String(url).trim();
  if (!s || s.startsWith("data:")) return "";
  return s;
}

/* ─── TickerTile ────────────────────────────────────────────────────── */
function TickerTile({
  item,
  onSelect,
  size = "md",
}: {
  item: TickerData;
  onSelect: (sym: string) => void;
  size?: "sm" | "md";
}) {
  const c   = item.quote?.c  ?? 0;
  const dp  = item.quote?.dp ?? 0;
  const up  = dp >= 0;
  const logo = cleanLogo(item.logo);

  const accent = up
    ? "from-emerald-500/20 via-emerald-500/10 to-transparent"
    : "from-rose-500/20 via-rose-500/10 to-transparent";

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(item.symbol)}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "group relative w-full overflow-hidden text-left",
        "rounded-xl border border-black/10 dark:border-white/10",
        "bg-white/75 dark:bg-white/[0.06]",
        "shadow-sm hover:shadow-md hover:border-black/15 dark:hover:border-white/15",
        "ring-1 ring-black/5 dark:ring-white/5",
        "transition-all duration-200",
        "p-2"
      )}
    >
      {/* Company logo as background */}
      <div
        className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
        style={{
          backgroundImage: logo ? `url(${logo})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: logo ? 0.45 : 0,
          filter: "saturate(1.1) contrast(1.05)",
        }}
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 opacity-90">
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-indigo-500/8 blur-2xl" />
        <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-fuchsia-500/8 blur-2xl" />
        <div className={cn("absolute inset-0 bg-gradient-to-br", accent)} />
      </div>

      {/* Readability overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/45 to-white/25 dark:from-black/55 dark:via-black/35 dark:to-black/20" />

      {/* Hover shine */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-90">
        <div className="absolute -inset-8 -left-1/2 w-[130%] rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-sm" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-1">
          <div className="text-xs sm:text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
            {item.symbol}
          </div>
          <div className="text-xs sm:text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            ${Number.isFinite(c) ? c.toFixed(2) : "0.00"}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div
            className={cn(
              "text-[10px] sm:text-xs font-semibold tabular-nums",
              up ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
            )}
          >
            {up ? "▲" : "▼"} {pct(dp)}
          </div>

          {item.quote?.t && size === "md" && (
            <div className="hidden sm:block text-[9px] font-semibold text-gray-600 dark:text-white/50 truncate">
              {formatDate(item.quote.t, "short")}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ─── SkeletonTile ──────────────────────────────────────────────────── */
function SkeletonTile({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-black/10 dark:border-white/10",
        "bg-white/70 dark:bg-white/[0.06]",
        size === "sm" ? "p-2.5" : "p-3"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-16 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-4 w-14 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="h-3 w-12 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-3 w-16 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */
export default function MarketWidgets({ onSelectTicker }: MarketWidgetsProps) {
  // HIGH priority for top tickers (first to display), LOW for movers pool
  const { tickerMap: topMap,   loadingSet: topLoading }  = useMarketData(TOP_TICKERS, "high");
  const { tickerMap: moverMap, loadingSet: moverLoading } = useMarketData(MOVER_POOL,  "low");

  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [moversTab,    setMoversTab]    = useState<"gainers" | "losers">("gainers");

  // Single shared market-status call (cached 5min inside the store)
  useEffect(() => {
    marketStore.getMarketStatus().then((s) => { if (s) setMarketStatus(s); });
  }, []);

  /* ── Derived data ─────────────────────────────────────────────────── */
  const topList = useMemo<TickerData[]>(
    () => TOP_TICKERS.map((s) => topMap[s]).filter((x): x is TickerData => !!x),
    [topMap]
  );

  const moverList = useMemo<TickerData[]>(
    () => MOVER_POOL.map((s) => moverMap[s]).filter((x): x is TickerData => !!x),
    [moverMap]
  );

  const topGainers = useMemo(
    () =>
      moverList
        .filter((i) => (i.quote?.dp ?? 0) > 0)
        .sort((a, b) => (b.quote.dp ?? 0) - (a.quote.dp ?? 0))
        .slice(0, 8),
    [moverList]
  );

  const topLosers = useMemo(
    () =>
      moverList
        .filter((i) => (i.quote?.dp ?? 0) < 0)
        .sort((a, b) => (a.quote.dp ?? 0) - (b.quote.dp ?? 0))
        .slice(0, 8),
    [moverList]
  );

  const overallChange = useMemo(() => {
    if (!topList.length) return 0;
    return topList.reduce((s, i) => s + (i.quote?.dp ?? 0), 0) / topList.length;
  }, [topList]);

  const fearGreedIndex = useMemo(
    () => clamp(((overallChange + 3) / 6) * 100, 0, 100),
    [overallChange]
  );

  const perfText = useMemo(() => {
    if (!topList.length) return "";
    if (overallChange > 0)
      return `Markets are up ~${overallChange.toFixed(2)}% across top tickers.`;
    if (overallChange < 0)
      return `Markets are down ~${Math.abs(overallChange).toFixed(2)}% across top tickers.`;
    return "Markets are roughly flat across top tickers.";
  }, [topList.length, overallChange]);

  /* ── Today's Market info popup ───────────────────────────────────── */
  const [showMarketInfo, setShowMarketInfo] = useState(false);

  /* ── Stat banner ──────────────────────────────────────────────────── */
  const StatBanner = () => {
    if (!marketStatus) return null;
    const open = !!marketStatus.isOpen;
    return (
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
          <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl" />
        </div>

        <div className="relative px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
                Markets:{" "}
                <span
                  className={
                    open
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }
                >
                  {open ? "OPEN" : "CLOSED"}
                </span>
              </div>
              {marketStatus.t && (
                <div className="mt-0.5 text-[10px] font-semibold text-gray-600 dark:text-white/60">
                  {formatDate(marketStatus.t, "short")}
                </div>
              )}
            </div>

            <div
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1",
                open
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                  : "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
              )}
            >
              {open ? "Live" : "After hours"}
            </div>
          </div>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>
    );
  };

  /* ── Loading skeleton (shown until at least 1 ticker arrives) ─────── */
  if (topList.length === 0) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6"
            >
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Full render ──────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Status + Fear/Greed */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <StatBanner />
        <FearGreedWidget
          index={fearGreedIndex}
          overallChange={overallChange}
          tickerCount={topList.length}
        />
      </div>

        {/* Mortgage rates — always visible, updated weekly from FRED */}
        <div className="relative mt-5 pt-5 border-t border-black/[0.06] dark:border-white/[0.08]">
          <MortgageRateWidget />
        </div>

      {/* Overall market performance */}
      {topList.length > 0 && (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-3 py-2.5 shadow-sm">
            <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
              <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/12 blur-3xl" />
              <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/12 blur-3xl" />
            </div>

            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
                    Today's Market
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMarketInfo(true)}
                    className="rounded-full p-0.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    aria-label="How is today's market calculated?"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-0.5 text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-white/70">
                  {perfText}
                </div>
              </div>

              <div
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 tabular-nums",
                  overallChange > 0
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                    : overallChange < 0
                    ? "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
                    : "bg-slate-500/15 text-slate-800 dark:text-slate-200 ring-slate-500/25"
                )}
              >
                {pct(overallChange)}
              </div>
            </div>

            <div className="mt-2 h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
          </div>

          {/* Today's Market info modal */}
          {showMarketInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMarketInfo(false)} />
              <div className="relative z-10 w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.07] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-base font-extrabold text-gray-900 dark:text-white">How Today's Market Works</h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Powered by live Finnhub quotes</p>
                  </div>
                  <button
                    onClick={() => setShowMarketInfo(false)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-1">Right Now</p>
                      <p className={cn("text-2xl font-black tabular-nums leading-none", overallChange >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                        {pct(overallChange)}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-gray-500 dark:text-gray-400">avg across {topList.length} tickers</span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>The <span className="font-bold">Today's Market</span> figure is the <span className="font-bold">simple arithmetic mean</span> of the current-day percentage price change (<code className="text-[11px] bg-gray-100 dark:bg-white/10 rounded px-1">dp</code>) across the top <span className="font-bold">{topList.length} US large-cap tickers</span> tracked by this dashboard.</p>
                    <div className="rounded-lg bg-gray-900 dark:bg-black/40 px-3 py-2.5 font-mono text-[11px] text-emerald-400">
                      avgChange = Σ(dp) / {topList.length}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Tickers include AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA, and other large-cap US equities. Prices are delayed ~15 min per Finnhub's free tier. The figure updates whenever new quote data arrives.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    

      {/* Top tickers */}
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm flex-1 flex flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
          <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl" />
        </div>

        <div className="relative px-3 py-2.5 border-b border-black/10 dark:border-white/10">
          <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
            Top Tickers ({topList.length})
          </h3>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {/* Mobile: horizontal scroll */}
          <div className="sm:hidden h-full overflow-x-auto overflow-y-hidden no-scrollbar">
            <div className="flex gap-2 p-3 h-full">
              {topList.map((item) => (
                <div key={item.symbol} className="shrink-0 w-[160px]">
                  <TickerTile item={item} onSelect={onSelectTicker} size="sm" />
                </div>
              ))}
              {Array.from(topLoading).map((sym) => (
                <div key={sym} className="shrink-0 w-[160px]">
                  <SkeletonTile size="sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: scrollable grid */}
          <div
            className="hidden sm:block h-full overflow-y-auto p-3"
            style={{ scrollbarWidth: "thin" }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {topList.map((item) => (
                <TickerTile
                  key={item.symbol}
                  item={item}
                  onSelect={onSelectTicker}
                  size="md"
                />
              ))}
              {Array.from(topLoading).map((sym) => (
                <SkeletonTile key={sym} size="md" />
              ))}
            </div>
          </div>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>

      {/* Movers — mobile tabbed */}
      <div className="sm:hidden relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
          <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/14 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/14 blur-3xl" />
        </div>

        <div className="relative px-2 py-2 border-b border-black/10 dark:border-white/10 flex gap-2">
          {(["gainers", "losers"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMoversTab(tab)}
              className={cn(
                "flex-1 rounded-xl px-3 py-1.5 text-xs font-extrabold ring-1 ring-black/10 dark:ring-white/10 transition",
                moversTab === tab
                  ? "bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white"
                  : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06]"
              )}
            >
              {tab === "gainers"
                ? `Gainers (${topGainers.length})`
                : `Losers (${topLosers.length})`}
            </button>
          ))}
        </div>

        <div className="relative p-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={moversTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {moversTab === "gainers"
                ? topGainers.map((i) => (
                    <TickerTile
                      key={i.symbol}
                      item={i}
                      onSelect={onSelectTicker}
                      size="sm"
                    />
                  ))
                : topLosers.map((i) => (
                    <TickerTile
                      key={i.symbol}
                      item={i}
                      onSelect={onSelectTicker}
                      size="sm"
                    />
                  ))}
              {moverLoading.size > 0 && moverList.length === 0 && (
                <div className="text-center text-[10px] font-semibold text-gray-500 dark:text-white/40 py-2">
                  Loading movers…
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>

      {/* Movers — desktop side-by-side */}
      <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Gainers */}
        <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
          </div>

          <div className="relative px-3 py-2.5 border-b border-black/10 dark:border-white/10">
            <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
              Top Gainers ({topGainers.length})
            </h3>
          </div>

          <div className="relative p-2 space-y-2">
            {topGainers.length > 0 ? (
              topGainers.map((item) => (
                <TickerTile
                  key={item.symbol}
                  item={item}
                  onSelect={onSelectTicker}
                  size="sm"
                />
              ))
            ) : moverLoading.size > 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <SkeletonTile key={i} size="sm" />
              ))
            ) : (
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-4 text-center">
                <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                  No data
                </div>
              </div>
            )}
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-emerald-500/30 via-emerald-500/20 to-emerald-500/10" />
        </div>

        {/* Losers */}
        <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-rose-400/15 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-rose-400/15 blur-3xl" />
          </div>

          <div className="relative px-3 py-2.5 border-b border-black/10 dark:border-white/10">
            <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
              Top Losers ({topLosers.length})
            </h3>
          </div>

          <div className="relative p-2 space-y-2">
            {topLosers.length > 0 ? (
              topLosers.map((item) => (
                <TickerTile
                  key={item.symbol}
                  item={item}
                  onSelect={onSelectTicker}
                  size="sm"
                />
              ))
            ) : moverLoading.size > 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <SkeletonTile key={i} size="sm" />
              ))
            ) : (
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-4 text-center">
                <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                  No data
                </div>
              </div>
            )}
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-rose-500/30 via-rose-500/20 to-rose-500/10" />
        </div>
      </div>
    </div>
  );
}
