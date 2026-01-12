"use client";

import React, { useMemo } from "react";

interface FearGreedWidgetProps {
  index: number; // 0..100
  title?: string; // optional if you reuse in multiple spots
  updatedAt?: string; // optional display (e.g. "Updated 10:30 AM")
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
  if (index < 20) return { chip: "bg-red-500/15 text-red-700 dark:text-red-200 ring-red-500/30" };
  if (index < 40) return { chip: "bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-amber-500/30" };
  if (index < 60) return { chip: "bg-slate-500/15 text-slate-800 dark:text-slate-200 ring-slate-500/30" };
  if (index < 80) return { chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/30" };
  return { chip: "bg-green-600/15 text-green-800 dark:text-green-200 ring-green-500/30" };
};

const FearGreedWidget: React.FC<FearGreedWidgetProps> = ({ index, title = "Fear & Greed", updatedAt }) => {
  const safe = useMemo(() => clamp(Number.isFinite(index) ? index : 0, 0, 100), [index]);
  const label = useMemo(() => getFearGreedLabel(safe), [safe]);
  const tone = useMemo(() => getTone(safe), [safe]);

  // Keep marker fully inside the bar even at 0/100.
  const markerLeft = useMemo(() => `${clamp(safe, 1, 99)}%`, [safe]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
      {/* subtle background */}
      <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
        <div className="absolute -top-10 -left-14 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <div className="relative p-4 sm:p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
              {title}
            </h3>
            
          </div>

          <div className="flex flex-col items-end gap-1">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1",
                "text-[11px] sm:text-xs font-extrabold",
                "ring-1",
                tone.chip,
              ].join(" ")}
            >
              <span className="tabular-nums">{safe.toFixed(0)}</span>
              <span className="opacity-80">•</span>
              <span className="truncate max-w-[120px] sm:max-w-none">{label}</span>
            </span>

            {updatedAt ? (
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-white/50">
                {updatedAt}
              </span>
            ) : null}
          </div>
        </div>

        {/* bar */}
        <div className="mt-4">
          <div className="relative h-3.5 sm:h-4 rounded-full overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-slate-200 to-green-500" />

            {/* marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: markerLeft }}
              aria-hidden="true"
            >
              <div className="relative">
                {/* pin */}
                <div className="h-5 sm:h-6 w-1.5 rounded-full bg-gray-900 dark:bg-white shadow" />
                {/* little cap */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-gray-900 dark:bg-white shadow" />
              </div>
            </div>
          </div>

          {/* labels */}
          <div className="mt-2 flex justify-between text-[11px] sm:text-xs font-semibold text-gray-600 dark:text-white/60">
            <span>Fear</span>
            <span>Neutral</span>
            <span>Greed</span>
          </div>

          {/* tiny helper text for mobile */}
          <div className="mt-2 text-[11px] sm:text-xs font-semibold text-gray-600 dark:text-white/60">
            <span className="tabular-nums font-extrabold text-gray-900 dark:text-white">{safe.toFixed(0)}</span>{" "}
            sits in <span className="font-extrabold">{label}</span>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FearGreedWidget;
