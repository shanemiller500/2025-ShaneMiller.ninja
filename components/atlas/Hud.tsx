"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  HUD kit for full-screen atlas maps: glass panels floating over the */
/*  globe, a cyan accent, mono micro-labels. Always dark — wrap the    */
/*  page in `.dark` so every dark: style applies.                      */
/* ------------------------------------------------------------------ */

export const hudGlass =
  "rounded-2xl border border-white/10 bg-slate-950/60 shadow-[0_0_0_1px_rgba(34,211,238,0.05),0_18px_50px_-18px_rgba(0,0,0,0.85)] backdrop-blur-xl";

export function HudPanel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`${hudGlass} ${className}`}>{children}</div>;
}

export function HudLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/60 ${className}`}>{children}</p>;
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
          ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-200 shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]"
          : "border-white/10 bg-slate-950/60 text-slate-300 backdrop-blur-xl hover:border-cyan-300/30 hover:text-white"
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
              on ? "text-cyan-100" : "text-slate-400 hover:text-slate-100"
            }`}
          >
            {on && (
              <motion.span
                layoutId={`${id}HudPill`}
                className="absolute inset-0 rounded-xl border border-cyan-300/40 bg-cyan-400/15 shadow-[0_0_18px_-4px_rgba(34,211,238,0.55)]"
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
export function HudStat({ label, value, tone = "text-white", onClick }: { label: string; value: ReactNode; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag {...(onClick ? { type: "button" as const, onClick } : {})} className={`min-w-0 text-left ${onClick ? "group" : ""}`}>
      <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <span className={`block truncate font-mono text-sm font-semibold ${tone} ${onClick ? "group-hover:text-cyan-200" : ""}`}>{value}</span>
    </Tag>
  );
}
