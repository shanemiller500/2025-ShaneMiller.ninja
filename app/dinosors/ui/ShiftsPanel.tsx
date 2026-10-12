"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { CIV_TECH, type CivTechId } from "../data/civ";
import type { Engine, Snapshot } from "../game/engine";
import { useClickAway } from "./useClickAway";

const NIGHT: CivTechId[] = ["nightWork", "nightClothing", "energyLitClothing", "nightDefenseGear", "advancedNightOps"];
const GEAR = ["nightHide", "nightLit", "nightArmor", "nightSidearm"];

export default function ShiftsPanel({ snap, engine, onClose, onResearch }: { snap: Snapshot; engine: Engine; onClose: () => void; onResearch: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useClickAway(true, ref, onClose);
  const s = snap.shifts;
  const learned = new Set(snap.civ.done);
  return <motion.aside ref={ref} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="dl-glass dl-scroll pointer-events-auto absolute bottom-[84px] left-1/2 z-30 max-h-[min(62vh,560px)] w-[min(390px,calc(100vw-16px))] -translate-x-1/2 overflow-y-auto rounded-3xl p-4 shadow-2xl sm:bottom-[96px]">
    <div className="flex items-start justify-between gap-2">
      <div><h2 className="text-lg font-bold">🌗 Shifts</h2><p className="text-xs text-white/65">Keep the settlement working around the clock.</p></div>
      <button type="button" onClick={onClose} aria-label="Close shifts" className="rounded-full p-1.5 hover:bg-white/10"><X className="h-5 w-5" /></button>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {([ ["all", "All Day"], ["split", "Split Shifts"] ] as const).map(([mode, label]) => <button key={mode} type="button" onClick={() => engine.setShiftMode(mode)} aria-pressed={s.mode === mode} className={`rounded-xl px-3 py-2 text-sm font-bold ${s.mode === mode ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>{label}</button>)}
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-xl bg-amber-400/15 p-2"><strong className="block text-lg text-amber-200">{s.day}</strong>Day</div>
      <div className="rounded-xl bg-indigo-400/20 p-2"><strong className="block text-lg text-indigo-200">{s.night}</strong>Night</div>
      <div className="rounded-xl bg-cyan-400/15 p-2"><strong className="block text-lg text-cyan-200">{s.required.toFixed(2)}</strong>energy/s needed</div>
    </div>
    {s.mode === "split" && <>
      <label className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">Auto Balance <input type="checkbox" checked={s.auto} onChange={(e) => engine.setShiftAuto(e.target.checked)} className="h-5 w-5 accent-amber-400" /></label>
      <p className="mt-2 text-xs text-white/65">Manual assignments stay fixed when Auto Balance is on. Workers finish their current action at handoff.</p>
      <details className="mt-3 rounded-xl bg-white/5 p-2">
        <summary className="cursor-pointer px-1 py-1 text-sm font-bold">Assign workers ({s.people.length})</summary>
      <div className="mt-2 space-y-1">
        {s.people.map((p) => <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-xs">
          <div className="min-w-0 flex-1"><div className="truncate font-bold">{p.name} {p.powered ? "✦" : ""}</div><div className="truncate text-white/55">{p.job}{p.outfit ? ` · ${p.outfit.replace("night", "Night ")}` : ""}{p.manual ? " · manual" : ""}</div></div>
          <button type="button" onClick={() => engine.assignShift(p.id, "day")} aria-label={`${p.name} Day Shift`} aria-pressed={p.shift === "day"} className={`rounded-lg px-2 py-1.5 font-bold ${p.shift === "day" ? "bg-amber-400 text-slate-900" : "bg-white/10"}`}>Day</button>
          <button type="button" onClick={() => engine.assignShift(p.id, "night")} aria-label={`${p.name} Night Shift`} aria-pressed={p.shift === "night"} className={`rounded-lg px-2 py-1.5 font-bold ${p.shift === "night" ? "bg-indigo-400 text-slate-950" : "bg-white/10"}`}>Night</button>
        </div>)}
      </div>
      </details>
    </>}
    <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs">
      <div className="font-bold">Fantasy night operations</div>
      <p className="mt-1 text-white/70">Night gear: {learned.has("nightClothing") ? "unlocked" : "locked"} · Powered suits: {learned.has("energyLitClothing") ? `${s.powered} active` : "locked"} · Defense: {learned.has("nightDefenseGear") ? "unlocked" : "locked"}</p>
      <p className="mt-1 text-white/60">Pyramid {s.pyramid ? "complete" : "needed for powered outfits"} · Grid {snap.civ.energy.toFixed(1)}/{snap.civ.cap.toFixed(0)} · Current draw {s.draw.toFixed(2)}/s</p>
      <p className="mt-1 text-white/55">Suit lights use a trickle of energy. Energy sidearms cost 1.5 per shot; towers and shields use more.</p>
      <div className="mt-2 flex flex-wrap gap-1">{NIGHT.map((id) => <span key={id} className={`rounded-full px-2 py-1 ${learned.has(id) ? "bg-cyan-400/25" : "bg-white/10 text-white/55"}`}>{learned.has(id) ? "✓" : "○"} {CIV_TECH[id].name}</span>)}</div>
      <button type="button" onClick={onResearch} className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 font-bold hover:bg-white/20">Open research</button>
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">{GEAR.map((id) => { const item = snap.forge.items.find((f) => f.id === id); return item && <button key={id} type="button" disabled={!item.can} title={item.why ?? item.tip} onClick={() => engine.queueForge(id)} className="rounded-lg bg-cyan-400/15 px-2.5 py-1.5 text-xs font-bold hover:bg-cyan-400/25 disabled:opacity-40">{item.icon} Forge {item.name}</button>; })}</div>
  </motion.aside>;
}
