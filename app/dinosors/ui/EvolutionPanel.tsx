"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SPECIES_BY_ID } from "../data/species";
import { MUTATIONS } from "../sim/genetics";
import type { Engine, Snapshot } from "../game/engine";
import Portrait from "./Portrait";

/* ------------------------------------------------------------------ */
/*  Evolution: how every species has changed since the world began,   */
/*  a big "a million years pass" button, and an auto-evolve toggle.   */
/* ------------------------------------------------------------------ */

function Gene({ icon, label, v }: { icon: string; label: string; v: number }) {
  // 1.0 = the ancestors; the bar grows/shrinks from the middle mark
  const pct = Math.max(0, Math.min(100, ((v - 0.7) / 0.9) * 100));
  const up = v >= 1.03;
  const down = v <= 0.97;
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${Math.round(v * 100)}% of the ancestors`}>
      <span className="w-4 text-center text-[11px]">{icon}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${up ? "bg-emerald-400" : down ? "bg-rose-400" : "bg-white/50"}`} style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${(0.3 / 0.9) * 100}%` }} />
      </div>
      <span className={`w-9 text-right text-[10.5px] font-bold ${up ? "text-emerald-300" : down ? "text-rose-300" : "text-white/60"}`}>
        {up ? "+" : ""}
        {Math.round((v - 1) * 100)}%
      </span>
    </div>
  );
}

export default function EvolutionPanel({ snap, engine, onClose }: { snap: Snapshot; engine: Engine; onClose: () => void }) {
  const evo = snap.evolution;
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (cool <= 0) return;
    const id = window.setTimeout(() => setCool((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cool]);
  const alive = evo.species.filter((s) => s.n > 0);
  const extinct = evo.species.filter((s) => s.n === 0 && snap.seen.includes(s.id));
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="dl-glass dl-scroll pointer-events-auto absolute inset-x-2 bottom-[84px] z-30 max-h-[60vh] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:max-h-[calc(100vh-200px)] sm:w-[380px]"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 pr-8">
        <span className="text-3xl">🧬</span>
        <div>
          <h2 className="text-xl font-bold leading-tight">Evolution</h2>
          <p className="text-xs text-white/60">{evo.leaps ? `${evo.leaps} million years have passed` : "Babies inherit their parents' traits"}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={cool > 0}
        onClick={() => {
          engine.evolve();
          setCool(3);
        }}
        className="mt-3 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 py-3 text-base font-extrabold shadow-lg shadow-violet-900/40 transition hover:brightness-110 active:scale-95 disabled:opacity-60"
      >
        {cool > 0 ? "⏳ Evolving…" : "⏩ Evolve! (+1 million years)"}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={evo.auto}
        onClick={() => engine.setEvoAuto(!evo.auto)}
        className="mt-2 flex w-full items-center justify-between rounded-2xl bg-white/5 px-3 py-2.5 text-sm font-semibold transition hover:bg-white/10"
      >
        <span>🔁 Auto-evolve every few minutes</span>
        <span className={`relative h-6 w-11 rounded-full transition ${evo.auto ? "bg-emerald-400" : "bg-white/20"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${evo.auto ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>
      <p className="mt-2 text-[11px] leading-snug text-white/55">
        Bars compare each species to its ancestors. Plant-eaters chased by hunters get faster + tougher; hunters chasing fast prey get faster; lots of food makes bodies bigger. Watch eggs for rare mutants!
      </p>

      <div className="mt-3 space-y-2">
        {alive.map((s) => {
          const def = SPECIES_BY_ID[s.id];
          return (
            <div key={s.id} className="flex items-center gap-2.5 rounded-2xl bg-white/5 p-2">
              <div className="relative shrink-0">
                <Portrait species={s.id} w={64} h={46} />
                {s.mut && <span className="absolute -right-1 -top-1 text-sm" title={MUTATIONS[s.mut].name}>{MUTATIONS[s.mut].icon}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-[13px] font-bold">
                  <span>{def.nick}</span>
                  <span className="text-[10.5px] font-semibold text-white/50">
                    ×{s.n} · gen {s.gen}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  <Gene icon="📏" label="Size" v={s.size} />
                  <Gene icon="💨" label="Speed" v={s.speed} />
                  <Gene icon="🛡️" label="Toughness" v={s.tough} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {extinct.length > 0 && (
        <p className="mt-3 rounded-2xl bg-rose-500/15 p-2.5 text-[12px] text-rose-100">
          🦴 Gone from your world: {extinct.map((s) => SPECIES_BY_ID[s.id].nick).join(", ")}. Hatch an egg to bring them back!
        </p>
      )}
    </motion.aside>
  );
}
