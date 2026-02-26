"use client";

import React, { useMemo, useState, useEffect } from "react";
import { X, Info } from "lucide-react";

interface FearGreedWidgetProps {
  index: number;
  title?: string;
  updatedAt?: string;
  overallChange?: number;
  tickerCount?: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const getFearGreedLabel = (index: number): string => {
  if (index < 20) return "Extreme Fear";
  if (index < 40) return "Fear";
  if (index < 60) return "Neutral";
  if (index < 80) return "Greed";
  return "Extreme Greed";
};

const getTone = (index: number) => {
  if (index < 20) return { chip: "bg-red-500/15 text-red-700 dark:text-red-200 ring-red-500/30",    score: "text-red-600 dark:text-red-300" };
  if (index < 40) return { chip: "bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-amber-500/30", score: "text-amber-600 dark:text-amber-300" };
  if (index < 60) return { chip: "bg-slate-500/15 text-slate-800 dark:text-slate-200 ring-slate-500/30", score: "text-slate-600 dark:text-slate-300" };
  if (index < 80) return { chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/30", score: "text-emerald-600 dark:text-emerald-300" };
  return { chip: "bg-green-600/15 text-green-800 dark:text-green-200 ring-green-500/30", score: "text-green-600 dark:text-green-300" };
};

const ZONES = [
  { min: 0,  max: 19,  label: "Extreme Fear", color: "bg-red-500" },
  { min: 20, max: 39,  label: "Fear",          color: "bg-amber-500" },
  { min: 40, max: 59,  label: "Neutral",       color: "bg-slate-400" },
  { min: 60, max: 79,  label: "Greed",         color: "bg-emerald-500" },
  { min: 80, max: 100, label: "Extreme Greed", color: "bg-green-600" },
];

/* ─── Info modal ──────────────────────────────────────────────────────── */
function InfoModal({
  open, onClose, index, label, overallChange, tickerCount,
}: {
  open: boolean; onClose: () => void;
  index: number; label: string;
  overallChange?: number; tickerCount?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const n   = tickerCount ?? 24;
  const avg = overallChange ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.07] dark:border-white/[0.08]">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">How Fear &amp; Greed Works</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Powered by live Finnhub quotes</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-1">Right Now</p>
              <p className="text-2xl font-black tabular-nums leading-none text-gray-900 dark:text-white">
                {index.toFixed(0)}
              </p>
            </div>
            <span className="text-sm font-extrabold text-gray-500 dark:text-gray-400">{label}</span>
          </div>

          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              We look at how the top <span className="font-bold">{n} major US stocks</span> are moving today and turn that into a single 0–100 score.
            </p>
            <p>
              Right now they're averaging{" "}
              <span className="font-bold tabular-nums">{avg >= 0 ? "+" : ""}{avg.toFixed(2)}%</span> on the day.
              A big drop pushes the score toward <span className="font-bold text-red-600 dark:text-red-400">0 (Extreme Fear)</span>, a big rally pushes it toward <span className="font-bold text-green-700 dark:text-green-400">100 (Extreme Greed)</span>.
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Prices are delayed ~15 min per Finnhub's free tier and update whenever new quote data arrives.
            </p>
          </div>

          <div className="space-y-1.5">
            {ZONES.map((z) => {
              const active = index >= z.min && index <= z.max;
              return (
                <div
                  key={z.label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ${active ? "ring-1 ring-indigo-400/40 bg-indigo-50 dark:bg-indigo-950/30" : ""}`}
                >
                  <div className={`h-2 w-2 rounded-full shrink-0 ${z.color}`} />
                  <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 w-14 shrink-0">{z.min}–{z.max}</span>
                  <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">{z.label}</span>
                  {active && <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">← now</span>}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
            This is a simplified sentiment proxy, not affiliated with CNN's Fear &amp; Greed Index or any official financial product.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── FearGreedWidget ─────────────────────────────────────────────────── */
const FearGreedWidget: React.FC<FearGreedWidgetProps> = ({
  index, title = "Fear & Greed", updatedAt, overallChange, tickerCount,
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const safe       = useMemo(() => clamp(Number.isFinite(index) ? index : 0, 0, 100), [index]);
  const label      = useMemo(() => getFearGreedLabel(safe), [safe]);
  const tone       = useMemo(() => getTone(safe), [safe]);
  const markerLeft = useMemo(() => `${clamp(safe, 1, 99)}%`, [safe]);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm flex flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-10 -left-14 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-fuchsia-400/20 blur-3xl" />
        </div>

        {/* Top label row */}
        <div className="relative px-4 pt-3.5 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {title}
          </span>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="rounded-full p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            aria-label="How is this calculated?"
          >
            <Info className="h-3 w-3" />
          </button>
        </div>

        {/* Hero: big score + label chip */}
        <div className="relative flex flex-col items-center gap-2 px-4 pt-4 pb-3">
          <div className={`text-5xl sm:text-6xl font-black tabular-nums leading-none tracking-tight ${tone.score}`}>
            {safe.toFixed(0)}
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold ring-1 ${tone.chip}`}>
            {label}
          </span>
          {updatedAt && (
            <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40">{updatedAt}</span>
          )}
        </div>

        {/* Gauge — fills remaining space */}
        <div className="relative flex-1 flex flex-col justify-end px-4 pb-4 gap-2">
          {/* Bar */}
          <div className="relative h-3.5 sm:h-4 rounded-full overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-slate-200 to-green-500" />
            <div className="absolute top-1/2 -translate-y-1/2" style={{ left: markerLeft }} aria-hidden="true">
              <div className="relative">
                <div className="h-5 sm:h-6 w-1.5 rounded-full bg-gray-900 dark:bg-white shadow" />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-gray-900 dark:bg-white shadow" />
              </div>
            </div>
          </div>

          {/* Axis labels */}
          <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-white/50">
            <span>Fear</span>
            <span>Neutral</span>
            <span>Greed</span>
          </div>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>

      <InfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        index={safe}
        label={label}
        overallChange={overallChange}
        tickerCount={tickerCount}
      />
    </>
  );
};

export default FearGreedWidget;
