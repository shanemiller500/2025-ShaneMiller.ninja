"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import type { TickerData } from "../lib/types";
import { cn, pct } from "./TickerTile";

interface TodayMarketWidgetProps {
  overallChange: number;
  topList: TickerData[];
  perfText: string;
}

export default function TodayMarketWidget({
  overallChange,
  topList,
  perfText,
}: TodayMarketWidgetProps) {
  const [showInfo, setShowInfo] = useState(false);

  const up      = overallChange > 0;
  const down    = overallChange < 0;
  const heroColor = up
    ? "text-emerald-700 dark:text-emerald-300"
    : down
    ? "text-rose-700 dark:text-rose-300"
    : "text-gray-600 dark:text-white/60";

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm flex flex-col">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
          <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-indigo-400/12 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-fuchsia-400/12 blur-3xl" />
        </div>

        {/* Top label row */}
        <div className="relative px-4 pt-3.5 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Today's Market
          </span>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="rounded-full p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            aria-label="How is today's market calculated?"
          >
            <Info className="h-3 w-3" />
          </button>
        </div>

        {/* Hero center — fills remaining space */}
        <div className="relative flex-1 flex flex-col items-center justify-center gap-2 px-4 py-5">
          {/* Big percentage */}
          <div className={cn("text-4xl sm:text-5xl font-black tabular-nums tracking-tight leading-none", heroColor)}>
            {pct(overallChange)}
          </div>

          {/* Direction label */}
          <div
            className={cn(
              "rounded-full px-3 py-1 text-[10px] font-extrabold ring-1 tabular-nums",
              up
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                : down
                ? "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
                : "bg-slate-500/15 text-slate-800 dark:text-slate-200 ring-slate-500/25"
            )}
          >
            {up ? "▲ Trending Up" : down ? "▼ Trending Down" : "— Flat"}
          </div>

          {/* Description */}
          <div className="text-[11px] font-semibold text-gray-500 dark:text-white/50 text-center leading-relaxed max-w-[180px]">
            {perfText}
          </div>
        </div>

        {/* Bottom: ticker count */}
        <div className="relative px-4 pb-3.5 text-center">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40">
            avg across {topList.length} tickers
          </span>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>

      {/* Info modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.07] dark:border-white/[0.08]">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                  How Today's Market Works
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Powered by live Finnhub quotes
                </p>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-1">
                    Right Now
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-black tabular-nums leading-none",
                      overallChange >= 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {pct(overallChange)}
                  </p>
                </div>
                <span className="text-sm font-extrabold text-gray-500 dark:text-gray-400">
                  avg across {topList.length} tickers
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  The <span className="font-bold">Today's Market</span> figure is the{" "}
                  <span className="font-bold">simple arithmetic mean</span> of the current-day
                  percentage price change (
                  <code className="text-[11px] bg-gray-100 dark:bg-white/10 rounded px-1">dp</code>
                  ) across the top{" "}
                  <span className="font-bold">{topList.length} US large-cap tickers</span> tracked
                  by this dashboard.
                </p>
                <div className="rounded-lg bg-gray-900 dark:bg-black/40 px-3 py-2.5 font-mono text-[11px] text-emerald-400">
                  avgChange = Σ(dp) / {topList.length}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Tickers include AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA, and other large-cap
                  US equities. Prices are delayed ~15 min per Finnhub's free tier. The figure
                  updates whenever new quote data arrives.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
