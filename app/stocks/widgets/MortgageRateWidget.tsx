"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────── */

interface RatePoint {
  rate: number | null;
  prev: number | null;
  date: string | null;
}

interface MortgageData {
  rate30: RatePoint;
  rate15: RatePoint;
  fetchedAt: string;
}

/* ─── Module-level 24-hour in-browser cache ─────────────────────────── */

let _cache: { data: MortgageData; ts: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1_000;

/* ─── Helpers ──────────────────────────────────────────────────────── */

function fmtRate(v: number | null) {
  return v !== null && Number.isFinite(v) ? v.toFixed(2) + "%" : "—";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return iso; }
}

function delta(rate: number | null, prev: number | null) {
  if (rate === null || prev === null) return null;
  return parseFloat((rate - prev).toFixed(3));
}

/* ─── RateRow — full-width stacked layout ──────────────────────────── */

function RateRow({ label, term, point }: { label: string; term: "30yr" | "15yr"; point: RatePoint }) {
  const d      = delta(point.rate, point.prev);
  const isUp   = d !== null && d > 0;
  const isDown = d !== null && d < 0;

  const borderCls = term === "30yr"
    ? "border-indigo-200/50 dark:border-indigo-500/15"
    : "border-violet-200/50 dark:border-violet-500/15";

  const gradCls = term === "30yr"
    ? "from-indigo-500/8 to-transparent"
    : "from-violet-500/8 to-transparent";

  const labelCls = term === "30yr"
    ? "text-indigo-600 dark:text-indigo-400"
    : "text-violet-600 dark:text-violet-400";

  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const trendCls  = isUp
    ? "text-rose-500 dark:text-rose-400"
    : isDown
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-gray-400";

  return (
    <div className={`relative flex-1 overflow-hidden rounded-xl border ${borderCls} bg-white dark:bg-white/[0.03] px-3.5 py-3 flex flex-col justify-between`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradCls}`} />

      <div className="relative flex items-start justify-between gap-2">
        {/* Label */}
        <p className={`text-[9px] font-black uppercase tracking-widest ${labelCls}`}>{label}</p>
        {/* Date */}
        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium shrink-0">
          {fmtDate(point.date)}
        </p>
      </div>

      {/* Big rate */}
      <div className="relative mt-2 flex items-end justify-between gap-2">
        <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-gray-900 dark:text-white leading-none">
          {fmtRate(point.rate)}
        </span>
        {d !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-bold leading-none mb-0.5 ${trendCls}`}>
            <TrendIcon className="h-3.5 w-3.5 shrink-0" />
            {Math.abs(d).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 flex-1 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="flex-1 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-3 space-y-2">
          <div className="h-2.5 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-7 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

/* ─── MortgageRateWidget ───────────────────────────────────────────── */

export default function MortgageRateWidget() {
  const [data, setData]       = useState<MortgageData | null>(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
      setData(_cache.data);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/mortgage-rates")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: MortgageData) => { if (!cancelled) { _cache = { data: d, ts: Date.now() }; setData(d); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm flex flex-col">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
        <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative px-4 pt-3.5 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          US Mortgage Rates · Weekly
        </span>
        <a
          href="https://fred.stlouisfed.org/series/MORTGAGE30US"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-[9px] font-semibold text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 transition-colors"
        >
          FRED <ExternalLink className="h-2 w-2" />
        </a>
      </div>

      {/* Rate cards — flex-1 so they fill available height */}
      <div className="relative flex-1 flex flex-col gap-2 px-4 py-3">
        {loading ? (
          <Skeleton />
        ) : error || !data ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[10px] text-rose-500 dark:text-rose-400">Could not load rates.</p>
          </div>
        ) : (
          <>
            <RateRow label="30-Year Fixed" term="30yr" point={data.rate30} />
            <RateRow label="15-Year Fixed" term="15yr" point={data.rate15} />
          </>
        )}
      </div>

      <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
    </div>
  );
}
