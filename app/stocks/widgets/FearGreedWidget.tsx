"use client";

import React, { useMemo, useState } from "react";
import { Gauge, Info } from "lucide-react";

import { IconBadge } from "@/components/ui/icon-badge";
import { Modal } from "@/components/ui/modal";

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
  const n   = tickerCount ?? 24;
  const avg = overallChange ?? 0;

  return (
    <Modal open={open} onClose={onClose} labelledBy="fg-widget-title" size="sm">
      <div className="overflow-y-auto p-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Market sentiment</p>
        <h2 id="fg-widget-title" className="mt-1 text-base font-semibold text-slate-900 dark:text-white">How Fear &amp; Greed works</h2>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/70 px-4 py-3 dark:border-white/[0.08]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Right now</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{index.toFixed(0)}</p>
          </div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        </div>

        <div className="mt-4 space-y-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            It takes how the top <span className="font-medium text-slate-900 dark:text-white">{n} large US stocks</span> are moving today and maps that to a 0–100 score.
          </p>
          <p>
            They&apos;re averaging{" "}
            <span className="font-mono font-medium tabular-nums text-slate-900 dark:text-white">{avg >= 0 ? "+" : ""}{avg.toFixed(2)}%</span> today.
            A broad drop pushes toward <span className="font-medium text-rose-500">0 (extreme fear)</span>, a broad rally toward{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">100 (extreme greed)</span>.
          </p>
        </div>

        <div className="mt-4 space-y-1">
          {ZONES.map((z) => {
            const active = index >= z.min && index <= z.max;
            return (
              <div key={z.label} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ${active ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-400/10 dark:ring-indigo-400/20" : ""}`}>
                <div className={`h-2 w-2 shrink-0 rounded-full ${z.color}`} />
                <span className="w-14 shrink-0 font-mono text-[11px] text-slate-400">{z.min}–{z.max}</span>
                <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{z.label}</span>
                {active && <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-indigo-500">now</span>}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          A simplified sentiment proxy from delayed Finnhub quotes. Not affiliated with CNN&apos;s Fear &amp; Greed Index.
        </p>
      </div>
    </Modal>
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
  const badgeTone  = safe >= 55 ? "emerald" : safe <= 45 ? "rose" : "amber";

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02] flex flex-col">

        {/* Top label row */}
        <div className="relative px-4 pt-3.5 flex items-center justify-between">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            <IconBadge icon={Gauge} tone={badgeTone} size="sm" />
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
          <div className={`text-5xl sm:text-6xl font-mono font-semibold tabular-nums leading-none tracking-tight ${tone.score}`}>
            {safe.toFixed(0)}
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${tone.chip}`}>
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
