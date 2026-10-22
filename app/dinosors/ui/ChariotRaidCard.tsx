"use client";

import { useState } from "react";
import { FORMATIONS } from "../sim/chariots";
import type { HuntFormation } from "../sim/types";
import type { Engine, InspectInfo, Snapshot } from "../game/engine";

/* ------------------------------------------------------------------ */
/*  Tap a war chariot → set up a raid. Pick where (a dragon's nest or  */
/*  a clan camp), the formation and how many dragon + dino riders go;  */
/*  every chariot seat is filled automatically (fighters first) and   */
/*  the whole unit musters together before it sets out.                */
/* ------------------------------------------------------------------ */

type Info = Extract<InspectInfo, { kind: "chariot" }>;

const PHASE: Record<string, string> = { muster: "Mustering", march: "On the march", battle: "Battle!", collect: "🥚 Gathering the eggs", return: "Heading home" };

function Stepper({ icon, label, value, max, onChange }: { icon: string; label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5 text-[13px]">
      <span className="font-semibold">
        {icon} {label} <span className="text-[11px] font-normal text-white/50">({max} ready)</span>
      </span>
      <span className="flex items-center gap-1.5">
        <button type="button" aria-label={`Fewer ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)} className="h-7 w-7 rounded-lg bg-white/10 font-bold transition hover:bg-white/20 disabled:opacity-30">
          −
        </button>
        <span className="w-5 text-center font-bold">{value}</span>
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="h-7 w-7 rounded-lg bg-white/10 font-bold transition hover:bg-white/20 disabled:opacity-30">
          +
        </button>
      </span>
    </div>
  );
}

export function ChariotRaidCard({ info, snap, engine }: { info: Info; snap: Snapshot; engine: Engine }) {
  const [target, setTarget] = useState<string>(info.targets[0] ? `${info.targets[0].kind}:${info.targets[0].id}` : "");
  const [formation, setFormation] = useState<HuntFormation>("ring");
  const [dragons, setDragons] = useState(Math.min(2, info.dragonRiders));
  const [dinos, setDinos] = useState(Math.min(3, info.dinoRiders));
  const d = Math.min(dragons, info.dragonRiders);
  const n = Math.min(dinos, info.dinoRiders);
  const seated = Math.min(info.seats, info.fillers);
  const picked = info.targets.find((t) => `${t.kind}:${t.id}` === target) ?? null;
  const h = snap.hunt;
  return (
    <>
      <div className="flex items-center gap-3 pr-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-sky-300/25 to-amber-500/20 text-3xl">🛡️</span>
        <div>
          <div className="text-lg font-bold leading-tight">War chariot</div>
          <div className="text-xs text-white/60">
            {info.hp}% sound · {info.trike ? "🦏 trike harnessed" : "needs a tamed trike"}
            {info.crew ? ` · ${info.crew} aboard` : ""}
          </div>
        </div>
      </div>

      {h ? (
        <>
          <div className={`mt-3 rounded-xl p-2.5 text-[13px] font-bold ${h.result === "won" ? "bg-emerald-500/25" : h.result === "lost" ? "bg-rose-500/25" : h.fighting ? "bg-rose-500/20" : "bg-amber-500/20"}`}>
            {h.result === "won" ? "🏆 Victory! " : h.result === "lost" ? "💀 Defeat. " : "⚔️ "}
            {PHASE[h.phase] ?? h.phase} · {h.alive}/{h.start} standing{h.eggs ? ` · 🥚 ${h.eggs}` : ""}
            <div className="mt-0.5 text-[12px] font-semibold text-white/80">🎯 {h.target}</div>
            {h.phase === "muster" && (
              <div className="mt-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-white/70">
                  <span>{h.ready}/{h.alive} ready to go</span>
                  <span>sets out in {h.left}s</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-[width] duration-300" style={{ width: `${Math.round((h.ready / Math.max(1, h.need)) * 100)}%` }} />
                </div>
              </div>
            )}
            {h.fighting && <div className="mt-1 text-[12px] text-rose-200">Stopped to fight {h.fighting} on the way: then on with the mission.</div>}
            {!(h.phase === "muster" || h.phase === "march") && <p className="mt-1 text-[11px] font-normal text-white/60">One raid at a time: wait for this unit to come home.</p>}
          </div>
          {(h.phase === "muster" || h.phase === "march") && info.targets.length > 0 && (
            <>
              <div className="mt-3 text-[12px] font-bold text-white/70">Change target</div>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                {info.targets.map((t) => {
                  const id = `${t.kind}:${t.id}`;
                  const on = h.targetKey === id;
                  return (
                    <button key={id} type="button" aria-pressed={on} disabled={on} onClick={() => engine.retargetRaid({ kind: t.kind, id: t.id })}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[13px] transition ${on ? "bg-amber-400 text-slate-950" : "bg-white/5 hover:bg-white/10"}`}>
                      <span className="font-semibold">{t.icon} {t.name}</span>
                      <span className={`text-[11px] ${on ? "text-slate-800" : "text-white/55"}`}>{on ? "current target" : t.note}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : !info.cars ? (
        <p className="mt-3 rounded-xl bg-white/5 p-2.5 text-[12px] text-white/70">Harness a tamed Triceratops to a chariot (one that isn't too badly damaged) to set up a raid.</p>
      ) : (
        <>
          <div className="mt-3 text-[12px] font-bold text-white/70">Which dragon (or camp) to attack?</div>
          {info.targets.length === 0 ? (
            <p className="mt-1 text-[12px] text-white/55">No known dragon, nest or clan camp yet. Track a wild dragon home or scout the valley.</p>
          ) : (
            <div className="mt-1 max-h-36 space-y-1 overflow-y-auto">
              {info.targets.map((t) => {
                const id = `${t.kind}:${t.id}`;
                return (
                  <button key={id} type="button" aria-pressed={target === id} onClick={() => setTarget(id)}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[13px] transition ${target === id ? "bg-amber-400 text-slate-950" : "bg-white/5 hover:bg-white/10"}`}>
                    <span className="font-semibold">{t.icon} {t.name}</span>
                    <span className={`text-[11px] ${target === id ? "text-slate-800" : "text-white/55"}`}>{t.note}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-[12px] font-bold text-white/70">Formation</div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {FORMATIONS.map((f) => (
              <button key={f.id} type="button" title={f.tip} aria-pressed={formation === f.id} onClick={() => setFormation(f.id)}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition ${formation === f.id ? "bg-amber-400 text-slate-950" : "bg-white/[0.07] hover:bg-white/15"}`}>
                {f.icon} {f.name}
              </button>
            ))}
          </div>

          <div className="mt-3 text-[12px] font-bold text-white/70">The unit</div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5 text-[13px]">
              <span className="font-semibold">🛡️ {info.cars} chariot{info.cars === 1 ? "" : "s"}</span>
              <span className={`text-[12px] font-bold ${seated < info.seats ? "text-amber-300" : "text-emerald-300"}`}>
                {seated}/{info.seats} seats filled
              </span>
            </div>
            <Stepper icon="🐉" label="Dragon riders" value={d} max={info.dragonRiders} onChange={setDragons} />
            <Stepper icon="🦖" label="Dino riders" value={n} max={info.dinoRiders} onChange={setDinos} />
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-white/55">
            Seats are filled automatically, fighters first{picked?.kind === "nest" ? " (plus egg runners to grab the eggs)" : ""}. Everyone gathers at the camp's edge, and nobody attacks till 98% are in place round the target.
          </p>
          <button type="button" disabled={!picked}
            onClick={() => picked && engine.chariotRaid({ kind: picked.kind, id: picked.id }, formation, d, n)}
            className="mt-2 w-full rounded-2xl bg-gradient-to-r from-sky-700 to-amber-600 py-2.5 text-sm font-bold transition hover:brightness-110 active:scale-95 disabled:opacity-40">
            ⚔️ Form the unit · {seated + d + n} go{picked ? ` to ${picked.name.replace(/^(The|An) /, (m) => m.toLowerCase())}` : ""}
          </button>
        </>
      )}
    </>
  );
}
