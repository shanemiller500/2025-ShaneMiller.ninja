"use client";

import { Building2, CalendarClock } from "lucide-react";

import { IconBadge } from "@/components/ui/icon-badge";
import { formatDate } from "@/utils/formatters";
import type { MarketStatus } from "../lib/types";
import { cn } from "./TickerTile";

interface MarketStatusWidgetProps {
  marketStatus: MarketStatus | null;
}

export default function MarketStatusWidget({ marketStatus }: MarketStatusWidgetProps) {
  if (!marketStatus) return null;

  const open = !!marketStatus.isOpen;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02] flex flex-col">

      {/* Top label */}
      <div className="relative px-4 pt-3.5 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          <IconBadge icon={Building2} tone={open ? "emerald" : "rose"} size="sm" />
          Market Status
        </span>
        <div
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[9px] font-semibold ring-1",
            open
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
              : "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
          )}
        >
          {open ? "Live" : "After hours"}
        </div>
      </div>

      {/* Hero center — fills remaining space */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-3 px-4 py-5">
        {/* Pulse ring visual */}
        <div className="relative flex items-center justify-center">
          {open ? (
            <>
              <span className="animate-ping absolute h-14 w-14 rounded-full bg-emerald-400/20" />
              <span className="animate-ping absolute h-9 w-9 rounded-full bg-emerald-400/30 [animation-delay:150ms]" />
              <span className="relative flex h-5 w-5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40" />
            </>
          ) : (
            <span className="flex h-5 w-5 rounded-full bg-rose-500/60 shadow-sm" />
          )}
        </div>

        {/* Big status word */}
        <div
          className={cn(
            "text-3xl sm:text-4xl font-mono font-semibold tracking-tight tabular-nums",
            open
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          )}
        >
          {open ? "OPEN" : "CLOSED"}
        </div>

        {/* Subtitle */}
        <div className="text-[11px] font-semibold text-gray-500 dark:text-white/50 text-center leading-relaxed">
          {open ? "US equity markets are trading" : "US equity markets are closed"}
        </div>
      </div>

      {/* Bottom timestamp */}
      {marketStatus.t && (
        <div className="relative px-4 pb-3.5 text-center">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-white/40">
            <CalendarClock className="h-3 w-3" aria-hidden />
            {formatDate(marketStatus.t, "short")}
          </span>
        </div>
      )}

    </div>
  );
}
