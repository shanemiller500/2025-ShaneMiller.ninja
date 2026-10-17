"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

/* ------------------------------------------------------------------ */
/*  HUD kit for full-screen atlas maps: glass panels floating over the */
/*  globe, a cyan accent, mono micro-labels in either site theme.      */
/* ------------------------------------------------------------------ */

export const hudGlass =
  "atlas-hud rounded-2xl border border-slate-200/80 bg-white/85 shadow-[0_10px_36px_-18px_rgba(30,41,59,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60 dark:shadow-[0_0_0_1px_rgba(34,211,238,0.05),0_18px_50px_-18px_rgba(0,0,0,0.85)]";

export function useAtlasTheme() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme !== "light";
}

export function HudPanel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`${hudGlass} ${className}`}>{children}</div>;
}

export function HudLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[10px] uppercase tracking-[0.2em] text-indigo-600/80 dark:text-cyan-200/60 ${className}`}>{children}</p>;
}

/** Square icon button for the HUD rail. */
export function HudIconButton({ icon: Icon, label, active, onClick, badge }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void; badge?: string | number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
        active
          ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-[0_4px_14px_-8px_rgba(99,102,241,0.5)] dark:border-cyan-300/50 dark:bg-cyan-400/15 dark:text-cyan-200 dark:shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]"
          : "border-slate-200/80 bg-white/85 text-slate-600 backdrop-blur-xl hover:border-indigo-300 hover:text-indigo-700 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-cyan-300/30 dark:hover:text-white"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      {badge != null && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-cyan-400 px-1 font-mono text-[9px] font-bold leading-[18px] text-slate-950">{badge}</span>
      )}
    </button>
  );
}

export interface HudOption<K extends string> {
  key: K;
  label: ReactNode;
  title?: string;
}

/** Pill switch with a glowing sliding indicator. */
export function HudSwitch<K extends string>({ id, value, onChange, options, ariaLabel, className = "" }: { id: string; value: K; onChange: (k: K) => void; options: HudOption<K>[]; ariaLabel: string; className?: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className={`${hudGlass} flex p-1 ${className}`}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            title={o.title}
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={`relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              on ? "text-indigo-700 dark:text-cyan-100" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            {on && (
              <motion.span
                layoutId={`${id}HudPill`}
                className="absolute inset-0 rounded-xl border border-indigo-300/60 bg-indigo-50 shadow-[0_3px_10px_-6px_rgba(99,102,241,0.5)] dark:border-cyan-300/40 dark:bg-cyan-400/15 dark:shadow-[0_0_18px_-4px_rgba(34,211,238,0.55)]"
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

/** One readout in the HUD status strip. */
export function HudStat({ label, value, tone = "text-slate-900 dark:text-white", onClick }: { label: string; value: ReactNode; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag {...(onClick ? { type: "button" as const, onClick } : {})} className={`min-w-0 text-left ${onClick ? "group" : ""}`}>
      <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`block truncate font-mono text-sm font-semibold ${tone} ${onClick ? "group-hover:text-indigo-600 dark:group-hover:text-cyan-200" : ""}`}>{value}</span>
    </Tag>
  );
}
