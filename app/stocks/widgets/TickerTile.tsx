"use client";

/* eslint-disable @next/next/no-img-element */
import { HEAT_SCALES, heatTone } from "@/utils/heat";
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

/* ─── TickerTile — logo on a heat-tinted tile ──────────────────────── */

export function TickerTile({
  item,
  onSelect,
}: {
  item: TickerData;
  onSelect: (sym: string) => void;
  size?: "sm" | "md";
}) {
  const c = item.quote?.c ?? 0;
  const dp = item.quote?.dp ?? 0;
  const logo = cleanLogo(item.logo || item.profile?.logo);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.symbol)}
      title={`${item.profile?.name ?? item.symbol} · ${pct(dp)}`}
      className={cn(
        "group relative isolate flex items-center gap-2.5 overflow-hidden rounded-xl p-2.5 text-left ring-1 ring-inset",
        "transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-[1.04] active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        heatTone(dp, HEAT_SCALES.stocks)
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/[0.06]" />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105">
        {logo ? (
          <img src={logo} alt="" loading="lazy" className="h-6 w-6 object-contain" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
        ) : (
          <span className="font-mono text-[9px] font-semibold text-slate-400">{item.symbol.slice(0, 3)}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-1">
          <span className="font-mono text-[12px] font-semibold">{item.symbol}</span>
          <span className="font-mono text-[10px] tabular-nums opacity-80">{pct(dp)}</span>
        </span>
        <span className="block font-mono text-[12px] tabular-nums opacity-90">
          {Number.isFinite(c) && c > 0 ? `$${c.toFixed(2)}` : "—"}
        </span>
      </span>
    </button>
  );
}

/* ─── SkeletonTile ──────────────────────────────────────────────────── */

export function SkeletonTile(_: { size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-slate-100 p-2.5 dark:bg-white/[0.04]">
      <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200 dark:bg-white/[0.06]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-12 animate-pulse rounded bg-slate-200 dark:bg-white/[0.06]" />
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-white/[0.06]" />
      </div>
    </div>
  );
}
