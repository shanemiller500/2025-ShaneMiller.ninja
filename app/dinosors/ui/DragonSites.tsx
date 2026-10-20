"use client";

import type { Engine } from "../game/engine";
import { BREEDS, GROWTH, growthStage } from "../data/dragons";
import { eggWarmth } from "../sim/dragonNests";
import { dragonStage } from "../sim/dragonKeep";
import { keeperOf } from "../sim/keepers";
import { showReady, SHOW_SECONDS } from "../sim/shows";
import type { Human } from "../sim/types";
import { ROLES } from "../data/facts";

const ROLE_NAME: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.name]));

/* ------------------------------------------------------------------ */
/*  Panels for the incubation shelter (manage the eggs + their         */
/*  keepers) and the dragon pit (the troupe + Put on a show). Shown    */
/*  inside the building's info card.                                   */
/* ------------------------------------------------------------------ */

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-1.5 flex-1 rounded-full bg-black/30">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

function KeeperPicker({ engine, kind, id, keeper }: { engine: Engine; kind: "egg" | "dragon"; id: number; keeper: Human | null }) {
  const w = engine.world;
  const people = w.humans.filter((h) => !h.child && !h.stranger && !h.captive && !h.under);
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <select aria-label="Keeper" value={keeper?.id ?? 0} onChange={(e) => engine.setKeeper(kind, id, Number(e.target.value))}
        className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-2 text-xs text-white">
        {!keeper && <option value={0}>No keeper yet…</option>}
        {people.map((h) => <option key={h.id} value={h.id}>{h.id === keeper?.id ? "🐉 " : ""}{h.name} · {ROLE_NAME[w.tribe.roleOf(h)] ?? w.tribe.roleOf(h)}</option>)}
      </select>
      <button type="button" disabled={!keeper} onClick={() => engine.callKeeperOf(kind, id)} className="h-9 shrink-0 rounded-lg bg-amber-400 px-2.5 text-xs font-black text-slate-900 active:scale-95 disabled:opacity-40">📣 Call</button>
    </div>
  );
}

/** The incubation shelter: every egg at home, its keeper, warmth, health, progress + the fuel. */
export function IncubatorSection({ engine, id }: { engine: Engine; id: number }) {
  const w = engine.world;
  const b = w.colony.buildings.find((x) => x.id === id);
  if (!b) return null;
  const fuel = w.dragons.fuel[id] ?? 0;
  const eggs = w.dragons.eggs.filter((e) => e.at === "camp").sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y));
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-2 text-xs">
        <span>🔥 Fuel</span>
        <Bar value={fuel / 480} tone={fuel > 60 ? "bg-orange-400" : "bg-rose-500"} />
        <span className="w-12 text-right tabular-nums text-white/70">{Math.round(fuel)}s</span>
        <button type="button" onClick={() => engine.stokeHatchery(id)} className="rounded-lg bg-white/10 px-2 py-1 font-bold hover:bg-white/20 active:scale-95">+ Add</button>
      </div>
      {!eggs.length && <p className="text-xs text-white/60">No eggs here yet. Egg runners bring them home from dragon nests, and the runner becomes the egg&apos;s keeper.</p>}
      {eggs.map((e) => {
        const def = BREEDS[e.breed];
        const k = keeperOf(w, e);
        const warm = eggWarmth(w, e.x, e.y);
        const tended = !!k && k.state === "dragonCare" && k.targetId === e.id;
        return (
          <div key={e.id} className="rounded-xl bg-white/5 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold">🥚 {def.name} egg{e.rare ? " ✨" : ""}</span>
              <span className={e.hatchT > 0 ? "font-bold text-amber-300" : "text-white/60"}>{e.hatchT > 0 ? "Hatching!" : `${Math.round(e.progress * 100)}%`}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-[3.5rem_1fr] items-center gap-x-2 gap-y-1">
              <span className="text-white/60">Growing</span><Bar value={e.progress} tone="bg-lime-400" />
              <span className="text-white/60">Warmth</span><Bar value={e.heat} tone={e.heat >= 0.6 ? "bg-orange-400" : "bg-sky-400"} />
              <span className="text-white/60">Health</span><Bar value={e.health} tone={e.health > 0.5 ? "bg-emerald-400" : "bg-rose-500"} />
            </div>
            <p className="mt-1 text-[11px] text-white/55">
              {warm.heat >= 0.6 ? `Warm (${warm.src}).` : "Too cold! Add fuel or move it by a fire."} {k ? `${k.name} keeps it${tended ? " and is with it now" : ""}.` : "Needs a keeper."}
            </p>
            <KeeperPicker engine={engine} kind="egg" id={e.id} keeper={k} />
          </div>
        );
      })}
    </div>
  );
}

/** The dragon pit: the troupe (each with its keeper) + Put on a show. */
export function PitSection({ engine }: { engine: Engine }) {
  const w = engine.world;
  const show = w.dragons.show;
  const why = showReady(w);
  return (
    <div className="mt-3 space-y-2">
      <button type="button" disabled={!!why} onClick={() => engine.putOnShow()} title={why ?? "Every keeper brings their dragon into the arena for tricks; everyone free comes to watch"}
        className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-amber-500 py-2.5 text-sm font-black active:scale-95 disabled:opacity-50">
        {show ? `🎪 Show on! ${Math.max(0, Math.ceil(SHOW_SECONDS - show.t))}s left · ${show.crowd.length} watching` : "🎪 Put on a show"}
      </button>
      {why && !show && <p className="text-center text-[11px] text-white/55">{why}</p>}
      {!w.dragons.owned.length && <p className="text-xs text-white/60">No dragons yet. Hatch an egg in the incubation shelter: the dragon will live here.</p>}
      {w.dragons.owned.map((d) => {
        const k = keeperOf(w, d);
        const g = GROWTH.find((x) => x.id === growthStage(d.growth ?? 0))!;
        return (
          <div key={d.id} className="rounded-xl bg-white/5 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold">🐉 {d.name}</span>
              <span className="text-white/60">{BREEDS[d.breed ?? "fire"].icon} {g.name} · {dragonStage(d)}</span>
            </div>
            <KeeperPicker engine={engine} kind="dragon" id={d.id} keeper={k} />
          </div>
        );
      })}
    </div>
  );
}
