"use client";

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
    <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm flex flex-col">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
        <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-fuchsia-400/15 blur-3xl" />
      </div>

      {/* Top label */}
      <div className="relative px-4 pt-3.5 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Market Status
        </span>
        <div
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[9px] font-extrabold ring-1",
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
            "text-3xl sm:text-4xl font-black tracking-tight tabular-nums",
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
          <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40">
            {formatDate(marketStatus.t, "short")}
          </span>
        </div>
      )}

      <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
    </div>
  );
}
