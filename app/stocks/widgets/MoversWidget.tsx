"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TickerData } from "../lib/types";
import { cn } from "./TickerTile";

interface MoversWidgetProps {
  gainers: TickerData[];
  losers: TickerData[];
  moverLoading: Set<string>;
  moverList: TickerData[];
  onSelect: (sym: string) => void;
}

/* ─── Compact row for a single mover ───────────────────────────────── */
function MoverRow({
  item,
  onSelect,
}: {
  item: TickerData;
  onSelect: (s: string) => void;
}) {
  const c    = item.quote?.c  ?? 0;
  const dp   = item.quote?.dp ?? 0;
  const up   = dp >= 0;
  const logo = item.logo ?? item.profile?.logo ?? "";
  const name = item.profile?.name ?? "";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.symbol)}
      className="group w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.07] dark:hover:bg-white/[0.04] transition-colors"
    >
      {/* Logo — all screen sizes */}
      {logo ? (
        <img
          src={logo}
          alt={item.symbol}
          className="h-7 w-7 shrink-0 rounded-full object-contain bg-white ring-1 ring-black/10 dark:ring-white/10"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 items-center justify-center ring-1 ring-black/10 dark:ring-white/10">
          <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400">
            {item.symbol.slice(0, 2)}
          </span>
        </div>
      )}

      {/* Symbol + company name — centered */}
      <div className="flex-1 min-w-0 text-center">
        <span className="block text-xs font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {item.symbol}
        </span>
        {name && (
          <span className="block text-[10px] font-medium text-gray-500 dark:text-white/40 truncate">
            {name}
          </span>
        )}
      </div>

      {/* Price + change */}
      <div className="shrink-0 flex items-center gap-2.5">
        <span className="text-[11px] font-semibold tabular-nums text-gray-500 dark:text-white/50">
          ${Number.isFinite(c) ? c.toFixed(2) : "—"}
        </span>
        <span
          className={cn(
            "text-[11px] font-extrabold tabular-nums w-[58px] text-right",
            up
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          )}
        >
          {up ? "▲" : "▼"} {Math.abs(dp).toFixed(2)}%
        </span>
      </div>
    </button>
  );
}

/* ─── Skeleton row ──────────────────────────────────────────────────── */
function MoverSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="h-3.5 w-14 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
      <div className="flex items-center gap-2.5">
        <div className="h-3 w-12 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-3 w-14 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
      </div>
    </div>
  );
}

/* ─── MoversWidget ──────────────────────────────────────────────────── */
export default function MoversWidget({
  gainers,
  losers,
  moverLoading,
  moverList,
  onSelect,
}: MoversWidgetProps) {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers");

  const topGainer = gainers[0];
  const topLoser  = losers[0];

  const isLoading = moverLoading.size > 0 && moverList.length === 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
      {/* Ambient blobs — split emerald/rose */}
      <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25">
        <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-rose-400/20 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl" />
      </div>

      {/* ── Mobile: tabs ──────────────────────────────────────────────── */}
      <div className="sm:hidden">
        {/* Tab bar */}
        <div className="relative grid grid-cols-2">
          {(["gainers", "losers"] as const).map((tab) => {
            const active = activeTab === tab;
            const isGain = tab === "gainers";
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative py-3 text-xs font-extrabold transition-colors border-b",
                  active
                    ? isGain
                      ? "text-emerald-700 dark:text-emerald-300 border-emerald-500"
                      : "text-rose-700 dark:text-rose-300 border-rose-500"
                    : "text-gray-500 dark:text-white/40 border-black/10 dark:border-white/10 hover:text-gray-800 dark:hover:text-white/70"
                )}
              >
                {isGain ? `▲ Gainers (${gainers.length})` : `▼ Losers (${losers.length})`}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="relative min-h-[120px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: activeTab === "gainers" ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === "gainers" ? 12 : -12 }}
              transition={{ duration: 0.15 }}
              className="py-1"
            >
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <MoverSkeleton key={i} />)
                : (activeTab === "gainers" ? gainers : losers).length > 0
                ? (activeTab === "gainers" ? gainers : losers).map((i) => (
                    <MoverRow key={i.symbol} item={i} onSelect={onSelect} />
                  ))
                : (
                  <div className="flex items-center justify-center py-8 text-xs font-semibold text-gray-400 dark:text-white/30">
                    No data yet
                  </div>
                )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Desktop: split columns ────────────────────────────────────── */}
      <div className="hidden sm:grid grid-cols-2 divide-x divide-black/10 dark:divide-white/10">

        {/* Gainers column */}
        <div className="flex flex-col">
          <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
              ▲ Gainers
            </span>
            <div className="flex items-center gap-2">
              {topGainer && (
                <span className="text-[10px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  Best: +{(topGainer.quote?.dp ?? 0).toFixed(2)}%
                </span>
              )}
              <span className="text-[10px] font-bold text-gray-400 dark:text-white/40">
                ({gainers.length})
              </span>
            </div>
          </div>

          <div className="py-1">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <MoverSkeleton key={i} />)
              : gainers.length > 0
              ? gainers.map((item) => (
                  <MoverRow key={item.symbol} item={item} onSelect={onSelect} />
                ))
              : (
                <div className="flex items-center justify-center py-8 text-xs font-semibold text-gray-400 dark:text-white/30">
                  No gainers yet
                </div>
              )}
          </div>
        </div>

        {/* Losers column */}
        <div className="flex flex-col">
          <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-rose-700 dark:text-rose-400">
              ▼ Losers
            </span>
            <div className="flex items-center gap-2">
              {topLoser && (
                <span className="text-[10px] font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                  Worst: {(topLoser.quote?.dp ?? 0).toFixed(2)}%
                </span>
              )}
              <span className="text-[10px] font-bold text-gray-400 dark:text-white/40">
                ({losers.length})
              </span>
            </div>
          </div>

          <div className="py-1">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <MoverSkeleton key={i} />)
              : losers.length > 0
              ? losers.map((item) => (
                  <MoverRow key={item.symbol} item={item} onSelect={onSelect} />
                ))
              : (
                <div className="flex items-center justify-center py-8 text-xs font-semibold text-gray-400 dark:text-white/30">
                  No losers yet
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Semantic gradient: emerald → rose */}
      <div className="h-[1px] w-full bg-gradient-to-r from-emerald-500/40 via-indigo-500/20 to-rose-500/40" />
    </div>
  );
}
