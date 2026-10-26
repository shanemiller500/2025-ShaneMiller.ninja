"use client";

import { X } from "lucide-react";
import type { Engine, Snapshot } from "../game/engine";
import { BREEDS, DRAGON_COMMANDS, DRAGON_STAGES, GROWTH, LESSONS, growthStage } from "../data/dragons";
import { chooseDragonRider, dragonInfo, dragonOf, dragonSkill, knows } from "../sim/dragonKeep";
import { eggWarmth } from "../sim/dragonNests";
import { keeperOf } from "../sim/keepers";
import { dutyLabel } from "../sim/riderDuty";
import { ROLES } from "../data/facts";

/* ------------------------------------------------------------------ */
/*  Tap one of our dragons (or a dragon egg at camp) → this panel.     */
/*  Stage ladder, health / stamina / hunger, lessons, the rider bond   */
/*  and the command buttons (aimed ones wait for a tap in the world).  */
/* ------------------------------------------------------------------ */

function Meter({ label, value, tone = "from-amber-500 to-lime-300" }: { label: string; value: number; tone?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-amber-100">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-black/30">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all`} style={{ width: `${Math.round(v * 100)}%` }} />
      </div>
      <span className="w-9 text-right tabular-nums">{Math.round(v * 100)}%</span>
    </div>
  );
}

const shell = "dl-glass pointer-events-auto absolute inset-x-2 bottom-[82px] z-[25] mx-auto max-h-[min(62vh,600px)] w-auto max-w-[440px] overflow-y-auto rounded-3xl border border-emerald-200/30 p-3 shadow-2xl dl-scroll sm:bottom-24 md:left-auto md:right-3 md:top-24 md:mx-0 md:max-h-[calc(100vh-13rem)] md:w-[400px]";

export default function DragonPanel({ engine, snap }: { engine: Engine; snap: Snapshot }) {
  void snap; // re-renders with every snapshot
  const w = engine.world;
  const dr = engine.selectedDragon();
  const egg = !dr && engine.selectedEgg ? w.dragons.eggs.find((e) => e.id === engine.selectedEgg) ?? null : null;
  if (!dr && !egg) return null;

  if (egg) {
    const def = BREEDS[egg.breed];
    const warm = egg.at === "camp" ? eggWarmth(w, egg.x, egg.y) : null;
    return (
      <section className={shell} aria-label="Dragon egg">
        <div className="mb-2 flex items-center justify-between rounded-xl bg-[#1f3b2c]/90 px-2 py-1.5">
          <div>
            <div className="text-base font-black">🥚 {def.name} egg{egg.rare ? " ✨" : ""}</div>
            <div className="text-[11px] text-emerald-100/75">{egg.rare ? "Golden-flecked: a rare egg (the hatchling learns + grows faster)" : def.tip}</div>
          </div>
          <button type="button" aria-label="Close" onClick={() => engine.selectEgg(0)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15"><X size={20} /></button>
        </div>
        <div className="space-y-1.5 rounded-2xl bg-white/10 p-3">
          <Meter label="Incubation" value={egg.progress} />
          <Meter label="Warmth" value={egg.heat} tone={egg.heat >= 0.6 ? "from-orange-500 to-amber-300" : "from-sky-500 to-sky-300"} />
          <Meter label="Health" value={egg.health} tone="from-rose-500 to-emerald-300" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/75">
          {egg.hatchT > 0 ? "It's hatching right now!" : egg.at === "camp"
            ? `${warm && warm.heat >= 0.6 ? `Kept warm by ${warm.src}.` : "Too cold to grow!"} An egg needs 60% warmth or more: a fuelled incubation shelter, a campfire beside it, or hot volcanic rock. Cold eggs weaken and can be lost. A trainer stokes the shelter and sits with the eggs.${egg.progress > 0.85 ? " Nearly ready to hatch!" : ""}`
            : "Lying out in the open: select someone and tap it to carry it home before it goes cold (or its parent comes back)."}
        </p>
      </section>
    );
  }

  const d = dr!;
  const info = dragonInfo(w, d);
  const def = BREEDS[d.breed ?? "fire"];
  const stage = DRAGON_STAGES.indexOf(info.stage);
  const rider = info.rider;
  const people = w.humans.filter((h) => !h.child && !h.stranger && !h.under && !h.captive && (h.id === rider?.id || !dragonOf(w, h)));
  const suggested = rider ?? chooseDragonRider(w, d);
  const aim = engine.dragonAim && engine.dragonAim.id === d.id ? engine.dragonAim : null;
  const g = d.growth ?? 0;
  const gStage = GROWTH.find((x) => x.id === growthStage(g))!;
  const next = info.next ? LESSONS.find((l) => l.id === info.next) : null;
  const doing = d.cmd ? DRAGON_COMMANDS.find((c) => c.id === d.cmd!.kind) : null;

  return (
    <section className={shell} aria-label={`Dragon ${d.name}`}>
      <div className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-xl bg-[#1f3b2c]/95 px-2 py-1.5 backdrop-blur">
        <div className="min-w-0">
          <div className="truncate text-base font-black">🐉 {d.name}{d.rare ? " ✨" : ""}</div>
          <div className="text-[11px] text-emerald-100/75">{def.icon} {def.name} · {gStage.name} · {info.stage}{(d.vet ?? 0) > 0.01 ? ` · ⚔️ battle-hardened ${Math.round((d.vet ?? 0) * 100)}%` : ""}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => engine.watchHatch(d.id)} className="h-10 rounded-xl px-2 text-xs font-bold hover:bg-white/15" aria-label="Watch its hatching again" title="Watch its hatching again">🎬</button>
          <button type="button" onClick={() => engine.follow(d.id)} className="h-10 rounded-xl px-2 text-xs font-bold hover:bg-white/15" aria-label="Follow with the camera">🎥</button>
          <button type="button" aria-label="Close" onClick={() => { engine.cancelDragonAim(); engine.select(0); }} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15"><X size={20} /></button>
        </div>
      </div>

      <ol className="mb-2 grid grid-cols-7 gap-0.5" aria-label="Dragon stage">
        {DRAGON_STAGES.map((s, i) => (
          <li key={s} title={s} className={`truncate rounded-md px-0.5 py-0.5 text-center text-[9px] font-bold leading-tight ${i <= stage ? "bg-emerald-400/30 text-emerald-100" : "bg-black/20 text-white/40"}`}>{s}</li>
        ))}
      </ol>

      <div className="space-y-1.5 rounded-2xl bg-white/10 p-3">
        <Meter label="Health" value={d.hp / d.maxHp} tone="from-rose-500 to-emerald-300" />
        <Meter label="Stamina" value={d.stamina ?? 1} tone="from-sky-500 to-cyan-300" />
        <Meter label="Fed" value={1 - (d.hunger ?? 0)} tone="from-orange-500 to-amber-300" />
        <Meter label="Growth" value={g} tone="from-violet-500 to-fuchsia-300" />
        <p className="pt-1 text-[11px] text-white/70">
          Speed {Math.round(info.stats.speed)} · Fire {Math.round(info.stats.fire * 100)}% · Carries {info.stats.carry} · {doing ? `${doing.icon} ${doing.name}` : d.state === "sleep" ? "😴 Sleeping" : d.z > 6 ? "🪽 Flying" : "On the ground"}
          {(d.fireCd ?? 0) > 0 ? ` · 🔥 ready in ${Math.ceil(d.fireCd ?? 0)}s` : ""}
        </p>
      </div>

      <div className="mt-2 rounded-2xl bg-white/10 p-3 text-xs">
        <div className="mb-1.5 flex items-center justify-between"><strong className="text-sm">🎓 Training</strong><span className="text-white/60">{next ? `Next: ${next.icon} ${next.name}` : info.waiting ? `Grows into ${info.waiting.lesson.name.toLowerCase()} at ${Math.round(info.waiting.growth * 100)}%` : "Fully trained"}</span></div>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {LESSONS.map((l) => {
            const v = dragonSkill(d, l.id);
            const locked = g < l.minGrowth;
            return (
              <li key={l.id} className="flex items-center gap-1.5">
                <span className="w-5 text-center">{l.icon}</span>
                <span className={`w-24 truncate ${locked ? "text-white/40" : ""}`}>{l.name}</span>
                <div className="h-1.5 flex-1 rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.round(v * 100)}%` }} /></div>
                <span className="w-7 text-right tabular-nums text-white/60">{locked ? "🔒" : `${Math.round(v * 100)}`}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[11px] text-white/55">An animal trainer teaches lessons one at a time (faster at a training area). Each lesson waits until {d.name} is old enough.</p>
      </div>

      <div className="mt-2 rounded-2xl bg-white/10 p-3 text-xs">
        <div className="flex items-center justify-between"><strong className="text-sm">🧑‍🍼 Keeper</strong><span className="text-white/60">{keeperOf(w, d)?.name ?? "none yet"}</span></div>
        <p className="mt-1 text-white/60">Their keeper feeds, trains and plays with them, puts them in shows, and flies them once they can take a rider.</p>
        <div className="mt-2 flex gap-2">
          <select aria-label="Keeper" value={d.keeper ?? 0} onChange={(e) => engine.setKeeper("dragon", d.id, Number(e.target.value))} className="h-10 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#2a4a38] px-2 text-sm text-white">
            {!d.keeper && <option value={0}>No keeper yet…</option>}
            {w.humans.filter((h) => !h.child && !h.stranger && !h.captive && !h.under).map((h) => <option key={h.id} value={h.id}>{h.name} · {ROLES.find((r) => r.id === w.tribe.roleOf(h))?.name ?? w.tribe.roleOf(h)}</option>)}
          </select>
          <button type="button" disabled={!d.keeper} onClick={() => engine.callKeeperOf("dragon", d.id)} className="min-h-10 rounded-xl bg-amber-400 px-3 font-black text-slate-900 disabled:opacity-40">📣 Call</button>
        </div>
      </div>

      <div className="mt-2 rounded-2xl bg-white/10 p-3 text-xs">
        <div className="flex items-center justify-between"><strong className="text-sm">🐉 Dragon Rider</strong>{rider && <span className="rounded-full bg-emerald-400/25 px-2 py-0.5 font-bold">{rider.name}{info.aloft ? " · flying" : ""}</span>}</div>
        {rider && <p className="mt-1 text-[11.5px] text-emerald-100/85">{dutyLabel(d) ?? "Between jobs: the rider works on the ground until the next one (scouting, patrols, lifts, cargo, far-off supplies, alerts)."}</p>}
        {rider ? <p className="mt-1 text-white/75">{rider.name} is bonded to {d.name} for life. Flight orders: the rider climbs on first if they're close by.</p>
          : <p className="mt-1 text-white/65">{info.stage === "Rideable" || info.stage === "War-Trained" ? "Ready to bond with a rider." : `Needs to be a young adult and learn rider acceptance first.`}</p>}
        <div className="mt-2 flex gap-2">
          <select aria-label="Rider" defaultValue={suggested?.id ?? 0} key={`${d.id}-${rider?.id ?? 0}`} id={`dragon-rider-${d.id}`} disabled={!!rider || !(dragonSkill(d, "rider") >= 1 && g >= 0.55)} className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#2a4a38] px-2 text-sm text-white disabled:opacity-40">
            {people.map((h) => <option key={h.id} value={h.id}>{h.name} · {w.tribe.roleOf(h)}</option>)}
          </select>
          {rider ? (
            <>
              {info.aloft && <button type="button" onClick={() => engine.dragonDismount(d.id)} className="min-h-11 rounded-xl bg-white/15 px-3 font-bold hover:bg-white/25">⬇️ Off</button>}
              <button type="button" onClick={() => engine.unbondDragonRider(d.id)} className="min-h-11 rounded-xl bg-white/15 px-3 font-bold hover:bg-white/25">Unbond</button>
            </>
          ) : (
            <button type="button" disabled={!(dragonSkill(d, "rider") >= 1 && g >= 0.55)} onClick={() => { const el = document.getElementById(`dragon-rider-${d.id}`) as HTMLSelectElement | null; engine.bondDragonRider(d.id, Number(el?.value ?? 0)); }} className="min-h-11 rounded-xl bg-emerald-400 px-3 font-black text-[#11281b] hover:bg-emerald-300 disabled:opacity-40">Bond</button>
          )}
        </div>
      </div>

      <div className="mt-2 rounded-2xl bg-white/10 p-3 text-xs">
        <div className="mb-1.5 flex items-center justify-between">
          <strong className="text-sm">📣 Commands</strong>
          <button type="button" aria-pressed={d.auto !== false} onClick={() => engine.setDragonAuto(d.id, d.auto === false)} className={`rounded-full px-2.5 py-1 font-bold ${d.auto !== false ? "bg-emerald-400/30" : "bg-white/15"}`}>Auto {d.auto !== false ? "ON" : "OFF"}</button>
        </div>
        {aim ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-400/20 p-2">
            <span className="flex-1 font-bold">{DRAGON_COMMANDS.find((c) => c.id === aim.kind)?.icon} {aim.kind === "route" ? `Tap waypoints (${aim.pts.length}/5)` : "Tap in the world…"}</span>
            {aim.kind === "route" && <button type="button" disabled={aim.pts.length < 2} onClick={() => engine.finishRoute()} className="rounded-lg bg-emerald-400 px-2 py-1 font-black text-[#11281b] disabled:opacity-40">Fly route</button>}
            <button type="button" onClick={() => engine.cancelDragonAim()} className="rounded-lg bg-white/15 px-2 py-1 font-bold">Cancel</button>
          </div>
        ) : null}
        <div className="grid grid-cols-4 gap-1.5">
          {DRAGON_COMMANDS.map((c) => {
            const ok = knows(d, c.needs) && !(c.id === "fire" && (d.fireCd ?? 0) > 0);
            const active = d.cmd?.kind === c.id || aim?.kind === c.id;
            return (
              <button key={c.id} type="button" title={c.tip} disabled={!ok} onClick={() => engine.dragonCommand(c.id)} className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-30 ${active ? "bg-emerald-400 text-[#11281b]" : c.id === "fire" ? "bg-orange-500/30 hover:bg-orange-500/45" : "bg-white/10 hover:bg-white/20"}`}>
                <span className="text-base leading-none">{c.icon}</span>
                <span className="mt-0.5 leading-tight">{c.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-white/55">Orders override Auto until they're done. Fire breath is real fire: it lights grass, trees and wooden buildings, so aim away from home!</p>
      </div>
    </section>
  );
}
