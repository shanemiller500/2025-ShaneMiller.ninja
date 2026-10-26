"use client";

import { PRIOS, type Prio } from "../sim/priority";

/* ------------------------------------------------------------------ */
/*  Low · Normal · High · Urgent: one row of pills, the current one     */
/*  lit in its colour. Used for build sites, the build queue and mine   */
/*  orders.                                                            */
/* ------------------------------------------------------------------ */

export function PriorityPicker({ value, onPick, compact = false, label = "Priority" }: { value: Prio; onPick: (p: Prio) => void; compact?: boolean; label?: string }) {
  return (
    <div className={compact ? "flex items-center gap-1" : "mt-3"}>
      {!compact && <div className="mb-1 text-[11px] font-semibold text-white/60">{label}</div>}
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {PRIOS.map((p) => {
          const on = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={p.id === 3 ? "Urgent: everyone free helps gather, haul and build it first" : p.id === 2 ? "High: done before normal work" : p.id === 0 ? "Low: only when there's nothing better to do" : "Normal"}
              onClick={() => onPick(p.id)}
              className={`flex items-center gap-1 rounded-full font-bold transition active:scale-95 ${compact ? "px-1.5 py-0.5 text-[10px]" : "min-h-9 px-2.5 text-[12px]"} ${on ? "text-slate-900" : "bg-white/10 text-white/75 hover:bg-white/20"}`}
              style={on ? { background: p.color } : undefined}
            >
              <span aria-hidden>{p.icon}</span>
              {compact ? (on ? p.name : "") : p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
