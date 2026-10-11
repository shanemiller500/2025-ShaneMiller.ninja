"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { sp } from "../data/species";
import type { Engine } from "../game/engine";
import { capacity, eligible, trainingStage, workOf, type WorkSkill } from "../sim/workDinos";
import type { Resource } from "../sim/types";
import { useClickAway } from "./useClickAway";

const SKILLS: { id: WorkSkill; icon: string; label: string; detail: string }[] = [
  { id: "hauler", icon: "🪵", label: "Hauler", detail: "Wood, stone, food and supplies" },
  { id: "riding", icon: "🏇", label: "Riding", detail: "Carry a person across the world" },
  { id: "heavy", icon: "🪨", label: "Heavy", detail: "Large construction and mine loads" },
  { id: "runner", icon: "⛏️", label: "Runner", detail: "Mine and storage routes" },
];
const CARGO: Resource[] = ["stone", "wood", "shaped", "iron", "gold", "silver", "copper", "crop", "cooked", "stick", "clay", "crystal"];

function Meter({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center gap-2 text-xs"><span className="w-16 text-amber-100">{label}</span><div className="h-2 flex-1 rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-lime-300 transition-all" style={{ width: `${Math.round(value * 100)}%` }} /></div><span className="w-9 text-right">{Math.round(value * 100)}%</span></div>;
}

export default function TrainPanel({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [id, setId] = useState(engine.world.dinoById(engine.selectedId)?.id ?? 0);
  const [skill, setSkill] = useState<WorkSkill>("hauler");
  const [trainerId, setTrainerId] = useState(0);
  const sheetTouchY = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  useClickAway(true, panelRef, onClose);
  const w = engine.world;
  const dinos = w.dinos.filter((d) => sp(d.species).diet === "herbivore" && sp(d.species).move === "walk" && d.growth >= 0.5).sort((a, b) => Number(b.owner) - Number(a.owner));
  const d = dinos.find((x) => x.id === id) ?? dinos[0];
  const work = d ? workOf(d) : null;
  const trainers = w.humans.filter((h) => !h.child && !h.under && !h.stranger && h.state !== "down");
  const trainer = trainers.find((h) => h.id === trainerId) ?? trainers.find((h) => h.id === work?.trainer) ?? trainers[0];
  const trained = d && work ? Object.entries(work.skills).filter(([, v]) => (v ?? 0) >= 0.35).map(([key]) => key) : [];

  return <>
    <section ref={panelRef} className="dl-glass pointer-events-auto absolute inset-x-2 bottom-[82px] z-[25] mx-auto max-h-[min(68vh,560px)] w-auto max-w-[420px] overflow-y-auto rounded-3xl border border-amber-200/30 p-3 shadow-2xl dl-scroll sm:bottom-24" aria-label="Dinosaur training">
      <div onTouchStart={(e) => { sheetTouchY.current = e.touches[0]?.clientY ?? null; }} onTouchEnd={(e) => { if (sheetTouchY.current !== null && (e.changedTouches[0]?.clientY ?? 0) - sheetTouchY.current > 70) onClose(); sheetTouchY.current = null; }} className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-xl bg-[#48301f]/95 px-2 py-1.5 backdrop-blur"><div><div className="text-base font-black">🦕 Train dinosaurs</div><div className="text-[11px] text-amber-100/75">Teach, equip, then send them to work</div></div><button type="button" aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15"><X size={20} /></button></div>
      {!d ? <p className="p-3 text-sm">Find a friendly adult herbivore, then teach Taming at camp.</p> : <div className="space-y-3">
        <label className="block text-xs font-bold text-amber-100">Dinosaur<select value={d.id} onChange={(e) => { setId(Number(e.target.value)); engine.select(Number(e.target.value)); }} className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-[#5d3e29] px-3 text-sm text-white">{dinos.map((x) => <option key={x.id} value={x.id}>{x.name} · {sp(x.species).nick} · {x.owner ? trainingStage(x) : "Wild"}</option>)}</select></label>
        <div className="rounded-2xl bg-white/10 p-3"><div className="flex items-center justify-between"><div><strong>{d.name}</strong><span className="ml-2 text-xs text-amber-100/75">{sp(d.species).name}</span></div><span className="rounded-full bg-lime-400/20 px-2 py-1 text-xs font-bold">{trainingStage(d)}</span></div><p className="mt-1 text-xs text-white/70">{sp(d.species).aggression < 0.15 ? "Gentle" : sp(d.species).aggression < 0.35 ? "Steady" : "Wary"} · Carry {capacity(d)} units · {work?.job ?? (work?.focus ? "Training" : "Resting")}{work?.cargoN ? ` · ${work.cargoN} ${work.cargo}` : ""}</p><div className="mt-2 space-y-1.5"><Meter label="Trust" value={d.tame} /><Meter label="Training" value={work?.focus ? work.skills[work.focus] ?? 0 : Math.max(0, ...Object.values(work?.skills ?? {}))} /></div><p className="mt-2 text-xs text-white/70">Learned: {trained.length ? trained.join(", ") : "No work skills yet"} · Skill {Math.round(Math.max(0, ...Object.values(work?.skills ?? {})) * 100)}%</p></div>
        {!d.owner && <p className="rounded-xl bg-amber-500/15 p-2 text-xs">Befriend this dinosaur first. Select it in the world and choose Befriend.</p>}
        <div className="grid grid-cols-2 gap-1.5">{SKILLS.map((s) => <button key={s.id} type="button" disabled={!eligible(d, s.id)} onClick={() => setSkill(s.id)} aria-pressed={skill === s.id} className={`min-h-12 rounded-xl p-2 text-left text-xs transition active:scale-95 disabled:opacity-35 ${skill === s.id ? "bg-amber-400 text-[#322012]" : "bg-white/10 hover:bg-white/20"}`}><span className="font-bold">{s.icon} {s.label}</span><span className="mt-0.5 block opacity-75">{s.detail}</span></button>)}</div>
        <label className="block text-xs font-bold text-amber-100">Trainer<select value={trainer?.id ?? 0} onChange={(e) => setTrainerId(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-[#5d3e29] px-3 text-sm text-white">{trainers.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.role}</option>)}</select></label>
        <button type="button" disabled={!d.owner || !trainer || !eligible(d, skill) || !w.camp.learned.has("taming") || (work?.skills[skill] ?? 0) >= 1} onClick={() => { if (trainer && engine.startWorkTraining(d.id, skill, trainer.id)) onClose(); }} className="min-h-11 w-full rounded-xl bg-amber-400 px-3 font-black text-[#322012] transition hover:bg-amber-300 active:scale-95 disabled:opacity-40">{work?.focus === skill ? "Continue training" : `Train ${skill}`}</button>
        <div className="flex gap-2"><button type="button" disabled={!d.owner || !work || work.harness >= 2 || Math.max(work.skills.hauler ?? 0, work.skills.heavy ?? 0, work.skills.runner ?? 0) < 0.35} onClick={() => { if (engine.equipWorkHarness(d.id)) onClose(); }} className="min-h-11 flex-1 rounded-xl bg-white/15 px-2 text-xs font-bold hover:bg-white/25 disabled:opacity-40">🧰 {work?.harness ? "Upgrade harness" : "Equip harness"}<span className="block opacity-70">{work?.harness ? "3 hide · 4 wood" : "2 hide · 2 wood"}</span></button><button type="button" onClick={() => engine.setDinoAutoWork(d.id, !work?.auto)} aria-pressed={!!work?.auto} className={`min-h-11 flex-1 rounded-xl px-2 text-xs font-bold ${work?.auto ? "bg-lime-500/30" : "bg-white/15"}`}>Auto Work {work?.auto ? "ON" : "OFF"}</button></div>
        <label className="block text-xs font-bold text-amber-100">Next cargo<select value={work?.cargo ?? "stone"} onChange={(e) => engine.chooseDinoCargo(d.id, e.target.value as Resource)} disabled={!!work?.cargoN} className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-[#5d3e29] px-3 text-sm text-white">{CARGO.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <p className="text-xs leading-relaxed text-white/65">Select this dinosaur, then tap mine or storage to load. Tap a building site to deliver. Riding trained dinosaurs can travel to a tapped destination.</p>
      </div>}
    </section>
  </>;
}
