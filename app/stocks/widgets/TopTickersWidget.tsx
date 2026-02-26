"use client";

import type { TickerData } from "../lib/types";
import { TickerTile, SkeletonTile, cn } from "./TickerTile";

interface TopTickersWidgetProps {
  topList: TickerData[];
  loadingSet: Set<string>;
  onSelect: (sym: string) => void;
}

export default function TopTickersWidget({
  topList,
  loadingSet,
  onSelect,
}: TopTickersWidgetProps) {
  const avgChange =
    topList.length
      ? topList.reduce((s, i) => s + (i.quote?.dp ?? 0), 0) / topList.length
      : 0;
  const up = avgChange >= 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
        <div className="absolute -top-16 -left-16 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Top Tickers
          </p>
          <p className="mt-0.5 text-xs font-extrabold text-gray-900 dark:text-white">
            {topList.length} large-cap US equities
          </p>
        </div>

        {topList.length > 0 && (
          <div
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 tabular-nums",
              up
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                : "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
            )}
          >
            {up ? "▲" : "▼"} avg {Math.abs(avgChange).toFixed(2)}%
          </div>
        )}
      </div>

      {/* Responsive grid — unified for all breakpoints */}
      <div className="relative p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {topList.map((item) => (
            <TickerTile key={item.symbol} item={item} onSelect={onSelect} size="md" />
          ))}
          {Array.from(loadingSet).map((sym) => (
            <SkeletonTile key={sym} size="md" />
          ))}
        </div>
      </div>

      <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
    </div>
  );
}
