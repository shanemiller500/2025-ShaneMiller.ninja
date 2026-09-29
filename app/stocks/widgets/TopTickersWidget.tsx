"use client";

import { Star, TrendingDown, TrendingUp } from "lucide-react";

import { IconBadge } from "@/components/ui/icon-badge";
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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">

      {/* Header */}
      <div className="relative px-4 py-3 border-b border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={Star} tone="amber" size="md" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Top Tickers
            </p>
            <p className="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
              {topList.length} large-cap US equities
            </p>
          </div>
        </div>

        {topList.length > 0 && (
          <div
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 tabular-nums",
              up
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                : "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
            )}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" aria-hidden />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden />
            )}
            avg {Math.abs(avgChange).toFixed(2)}%
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

    </div>
  );
}
