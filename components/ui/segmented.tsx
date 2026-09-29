"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export interface SegmentedOption<K extends string> {
  key: K;
  label: ReactNode;
  /** Tooltip + accessible name (needed when label is an icon) */
  title?: string;
}

interface SegmentedProps<K extends string> {
  /** Unique per page — scopes the sliding pill animation */
  id: string;
  value: K;
  onChange: (key: K) => void;
  options: SegmentedOption<K>[];
  ariaLabel?: string;
  className?: string;
}

/** Compact pill toggle with a sliding active indicator (dark pill on light, light pill on dark). */
export function Segmented<K extends string>({ id, value, onChange, options, ariaLabel, className = "" }: SegmentedProps<K>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/[0.04] ${className}`}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            title={o.title}
            aria-label={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
              active
                ? "text-white dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${id}Pill`}
                className="absolute inset-0 rounded-lg bg-slate-900 dark:bg-white"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
