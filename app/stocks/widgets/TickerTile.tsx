"use client";

import { motion } from "framer-motion";
import { formatDate } from "@/utils/formatters";
import type { TickerData } from "../lib/types";

/* ─── Utilities ────────────────────────────────────────────────────── */

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const pct = (n: number) =>
  `${n >= 0 ? "+" : ""}${Number.isFinite(n) ? n.toFixed(2) : "0.00"}%`;

export function cleanLogo(url?: string): string {
  if (!url) return "";
  const s = String(url).trim();
  if (!s || s.startsWith("data:")) return "";
  return s;
}

/* ─── TickerTile ────────────────────────────────────────────────────── */

export function TickerTile({
  item,
  onSelect,
  size = "md",
}: {
  item: TickerData;
  onSelect: (sym: string) => void;
  size?: "sm" | "md";
}) {
  const c    = item.quote?.c  ?? 0;
  const dp   = item.quote?.dp ?? 0;
  const up   = dp >= 0;
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

export function SkeletonTile({ size = "md" }: { size?: "sm" | "md" }) {
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
