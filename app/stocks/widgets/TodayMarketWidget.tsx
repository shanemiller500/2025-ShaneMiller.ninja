"use client";

import { useState } from "react";
import { Activity, Info } from "lucide-react";

import { IconBadge } from "@/components/ui/icon-badge";
import { Modal } from "@/components/ui/modal";
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02] flex flex-col">

        {/* Top label row */}
        <div className="relative px-4 pt-3.5 flex items-center justify-between">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            <IconBadge
              icon={Activity}
              tone={overallChange > 0 ? "emerald" : overallChange < 0 ? "rose" : "neutral"}
              size="sm"
            />
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
          <div className={cn("text-4xl sm:text-5xl font-mono font-semibold tabular-nums tracking-tight leading-none", heroColor)}>
            {pct(overallChange)}
          </div>

          {/* Direction label */}
          <div
            className={cn(
              "rounded-full px-3 py-1 text-[10px] font-semibold ring-1 tabular-nums",
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

      </div>

      {/* Info modal */}
      <Modal open={showInfo} onClose={() => setShowInfo(false)} labelledBy="today-info-title" size="sm">
        <div className="overflow-y-auto p-6">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Methodology</p>
          <h2 id="today-info-title" className="mt-1 text-base font-semibold text-slate-900 dark:text-white">How today&apos;s market is calculated</h2>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/70 px-4 py-3 dark:border-white/[0.08]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Right now</p>
              <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", overallChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                {pct(overallChange)}
              </p>
            </div>
            <span className="font-mono text-[11px] text-slate-400">avg of {topList.length} tickers</span>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            A simple average of today&apos;s percent change across the {topList.length} large-cap US stocks this dashboard tracks.
          </p>
          <div className="mt-3 rounded-xl bg-slate-900 px-3 py-2.5 font-mono text-[11px] text-emerald-400 dark:bg-black/40">
            avgChange = Σ(dp) / {topList.length}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Includes AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA and other large caps. Quotes are delayed ~15 min.
          </p>
        </div>
      </Modal>
    </>
  );
}
