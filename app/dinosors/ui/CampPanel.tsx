"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SHELTER_STAGES, TECH, TECH_ORDER } from "../data/facts";
import { CRAFT_STEPS } from "../sim/camp";
import type { Engine, Snapshot } from "../game/engine";
import type { TechId } from "../sim/types";

/* ------------------------------------------------------------------ */
/*  The cave people's camp: what they've gathered, what they're        */
/*  inventing, and huts going up stage by stage. Kids pick the next    */
/*  invention and can bring supplies to speed things along.            */
/* ------------------------------------------------------------------ */

const RES: [string, string, string][] = [
  ["stick", "🪵", "Sticks"],
  ["stone", "🪨", "Stones"],
  ["grass", "🌾", "Dry grass"],
  ["leaves", "🍃", "Leaves"],
  ["wood", "🪓", "Wood"],
  ["fish", "🐟", "Fish"],
  ["berries", "🫐", "Berries"],
];
const RES_ICON = Object.fromEntries(RES.map(([k, i]) => [k, i]));

export default function CampPanel({ snap, engine, onClose }: { snap: Snapshot; engine: Engine; onClose: () => void }) {
  const camp = snap.camp;
  const [factFor, setFactFor] = useState<TechId | null>(null);
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (cool <= 0) return;
    const id = window.setTimeout(() => setCool((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cool]);

  const learned = new Set(camp.learned);
  const available = (t: TechId) => !learned.has(t) && (TECH[t].after ?? []).every((a) => learned.has(a));
  const goal = camp.goal;
  const site = camp.shelters.findIndex((s) => s.stage < SHELTER_STAGES.length);

  return (
    <motion.aside
      initial={{ opacity: 0, x: -24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="dl-glass dl-scroll pointer-events-auto absolute inset-x-2 bottom-[84px] z-20 max-h-[52vh] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-24 sm:max-h-[calc(100vh-220px)] sm:w-[340px]"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 pr-8">
        <span className="text-3xl">🏕️</span>
        <div>
          <h2 className="text-xl font-bold leading-tight">Cave Camp</h2>
          <p className="text-xs text-white/60">Help the cave people invent things!</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {RES.map(([k, icon, label]) => (
          <div key={k} title={label} className="flex flex-col items-center rounded-xl bg-white/5 py-1.5">
            <span className="text-lg leading-none">{icon}</span>
            <span className="mt-0.5 text-[12px] font-bold">{camp.stock[k] ?? 0}</span>
          </div>
        ))}
      </div>

      {camp.crafting ? (
        <div className="mt-3 rounded-2xl bg-amber-300/15 p-3">
          <div className="text-sm font-bold">
            {TECH[camp.crafting.tech].icon} Inventing {TECH[camp.crafting.tech].name}…
          </div>
          <ol className="mt-1.5 space-y-0.5 text-[13px]">
            {CRAFT_STEPS[camp.crafting.tech].map((s, i, arr) => {
              const at = Math.floor(camp.crafting!.prog * arr.length);
              return (
                <li key={s} className={i < at ? "text-emerald-300" : i === at ? "font-bold text-white" : "text-white/40"}>
                  {i < at ? "✓" : i === at ? "▸" : "·"} {s}
                </li>
              );
            })}
          </ol>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${camp.crafting.prog * 100}%` }} />
          </div>
        </div>
      ) : goal && goal !== "shelter" ? (
        <div className="mt-3 rounded-2xl bg-white/5 p-3">
          <div className="text-sm font-bold">
            {TECH[goal].icon} Working toward: {TECH[goal].name}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(TECH[goal].needs).map(([r, n]) => {
              const have = Math.min(n!, camp.stock[r] ?? 0);
              return (
                <span key={r} className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${have >= n! ? "bg-emerald-500/30" : "bg-white/10"}`}>
                  {RES_ICON[r]} {have}/{n}
                </span>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-white/55">They'll gather what they need, then try it out by the cave.</p>
        </div>
      ) : null}

      <div className="mt-3 text-sm font-bold">Inventions</div>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {TECH_ORDER.map((t) => {
          const d = TECH[t];
          const done = learned.has(t);
          const can = available(t);
          const isGoal = goal === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                if (done) setFactFor(factFor === t ? null : t);
                else if (can) engine.setCampGoal(t);
                else setFactFor(factFor === t ? null : t);
              }}
              className={`relative flex flex-col items-center rounded-2xl px-1 py-2 transition active:scale-95 ${
                done ? "bg-emerald-500/25" : isGoal ? "bg-amber-400/30 ring-2 ring-amber-300" : can ? "bg-white/10 hover:bg-white/20" : "bg-white/5 opacity-60"
              }`}
            >
              <span className={`text-2xl leading-none ${done || can ? "" : "grayscale"}`}>{d.icon}</span>
              <span className="mt-1 text-center text-[10.5px] font-semibold leading-tight">{d.name}</span>
              {done && <span className="absolute right-1 top-0.5 text-[11px]">✅</span>}
              {!done && !can && <span className="absolute right-1 top-0.5 text-[11px]">🔒</span>}
            </button>
          );
        })}
      </div>
      {factFor && (
        <p className="mt-2 rounded-2xl bg-amber-300/15 p-2.5 text-[13px] leading-snug">
          {learned.has(factFor) ? "💡 " + TECH[factFor].fact : `🔒 First they need: ${(TECH[factFor].after ?? []).map((a) => TECH[a].name).join(" + ")}`}
        </p>
      )}

      {camp.shelters.length > 0 && (
        <>
          <div className="mt-3 text-sm font-bold">Huts</div>
          <div className="mt-1.5 space-y-1.5">
            {camp.shelters.map((s, i) => (
              <div key={i} className={`rounded-2xl p-2 text-[12px] ${i === site ? "bg-white/10" : "bg-white/5"}`}>
                <div className="flex gap-1">
                  {SHELTER_STAGES.map((st, k) => (
                    <span key={st.label} className={`flex-1 rounded-lg px-1 py-1 text-center font-semibold ${k < s.stage ? "bg-emerald-500/40" : k === s.stage ? "bg-amber-400/30" : "bg-white/5 text-white/40"}`}>
                      {st.label}
                    </span>
                  ))}
                </div>
                {s.stage < SHELTER_STAGES.length ? (
                  <div className="mt-1 text-white/70">
                    Needs {RES_ICON[SHELTER_STAGES[s.stage].need]} {s.have}/{SHELTER_STAGES[s.stage].n}
                    {SHELTER_STAGES[s.stage].need === "wood" && !learned.has("axe") ? " — invent the 🪓 axe first!" : ""}
                  </div>
                ) : (
                  <div className="mt-1 text-emerald-300">🛖 Finished! Cozy and dry.</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={cool > 0}
          onClick={() => {
            engine.helpCamp();
            setCool(15);
          }}
          className="rounded-2xl bg-amber-400 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300 active:scale-95 disabled:opacity-50"
        >
          {cool > 0 ? `🎁 ${cool}s` : "🎁 Bring supplies"}
        </button>
        <button
          type="button"
          onClick={() => {
            const c = engine.world.camp;
            engine.flyTo(c.x, c.y, Math.max(engine.cam.zoom, 0.95));
          }}
          className="rounded-2xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/20 active:scale-95"
        >
          📍 Go to camp
        </button>
      </div>
    </motion.aside>
  );
}
