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

/* ─── RateCard — compact, always-horizontal ─────────────────────────── */

function RateCard({ label, term, point }: { label: string; term: "30yr" | "15yr"; point: RatePoint }) {
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
    <div className={`relative flex-1 overflow-hidden rounded-xl border ${borderCls} bg-white dark:bg-white/[0.03] p-2.5 sm:p-3`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradCls}`} />

      <div className="relative space-y-1">
        {/* Label */}
        <p className={`text-[9px] font-black uppercase tracking-widest ${labelCls}`}>{label}</p>

        {/* Rate + delta on one line */}
        <div className="flex items-center gap-1.5">
          <span className="text-lg sm:text-xl font-black tabular-nums tracking-tight text-gray-900 dark:text-white leading-none">
            {fmtRate(point.rate)}
          </span>
          {d !== null && (
            <span className={`flex items-center gap-0.5 text-[11px] font-bold leading-none ${trendCls}`}>
              <TrendIcon className="h-3 w-3 shrink-0" />
              {Math.abs(d).toFixed(2)}
            </span>
          )}
        </div>

        {/* As-of date */}
        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">
          {fmtDate(point.date)}
        </p>
      </div>
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="flex gap-2 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="flex-1 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-2.5 space-y-1.5">
          <div className="h-2.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 w-14 rounded bg-gray-100 dark:bg-gray-800" />
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
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
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

      {loading ? (
        <Skeleton />
      ) : error || !data ? (
        <p className="text-[10px] text-rose-500 dark:text-rose-400">Could not load rates.</p>
      ) : (
        <div className="flex gap-2">
          <RateCard label="30-Year Fixed" term="30yr" point={data.rate30} />
          <RateCard label="15-Year Fixed" term="15yr" point={data.rate15} />
        </div>
      )}
    </div>
  );
}
