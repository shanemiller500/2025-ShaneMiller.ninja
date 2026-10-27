"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { RES_INFO, type Cost } from "../data/colony";
import { IncubatorSection, PitSection } from "./DragonSites";
import type { Engine, InspectInfo, Snapshot } from "../game/engine";
import type { Resource } from "../sim/types";
import { ChariotRaidCard } from "./ChariotRaidCard";
import { GameIcon } from "./GameIcon";
import { useClickAway } from "./useClickAway";
import { UpgradeAllButton } from "./UpgradeAllButton";
import { PriorityPicker } from "./PriorityPicker";

function InspectPriorityControl({ priority, engine, wall }: { priority: NonNullable<Snapshot["inspectPrio"]>; engine: Engine; wall: boolean }) {
  const [scope, setScope] = useState<"one" | "all">("one");
  return (
    <div>
      {priority.sameCount > 1 && (
        <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Apply priority to">
          {(["one", "all"] as const).map((choice) => (
            <button key={choice} type="button" role="radio" aria-checked={scope === choice} onClick={() => setScope(choice)}
              className={`min-h-8 rounded-full px-2.5 text-[11px] font-bold transition active:scale-95 ${scope === choice ? "bg-amber-300 text-slate-900" : "bg-white/10 text-white/75 hover:bg-white/20"}`}>
              {choice === "one" ? (wall ? "This wall run" : "This one") : `All ${priority.sameName} (${priority.sameCount})`}
            </button>
          ))}
        </div>
      )}
      <PriorityPicker
        value={priority.p}
        onPick={(p) => engine.setPriority(priority.key, p, scope)}
        label={`Priority (${priority.what}${wall && scope === "one" ? ", the whole run of wall" : ""})`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tap a home, building, Scorpion, gate or tower → this card.         */
/*  Homes list who lives there (and who's inside right now) with a     */
/*  "send them out to work" button and the next upgrade.               */
/* ------------------------------------------------------------------ */

/** "🔧 Repair now": for anything of ours that's damaged at all (the next free hands fix it, right after Urgent jobs). */
function RepairButton({ info, engine }: { info: InspectInfo; engine: Engine }) {
  let key: string | null = null;
  let frac = 1;
  if (info.kind === "building" && info.built >= 1) { key = `building:${info.id}`; frac = info.hp / info.maxHp; }
  else if (info.kind === "wall" && info.built >= 1) { key = `wall:${info.id}`; frac = info.hp / info.maxHp; }
  else if (info.kind === "scorpion" && info.built >= 1) { key = `scorpion:${info.id}`; frac = info.hp / info.maxHp; }
  else if (info.kind === "tower") { key = `tower:${info.id}`; frac = info.hp / info.maxHp; }
  else if (info.kind === "shelter" && info.built) { key = `upgrade:${info.id}`; frac = info.hp; }
  else if (info.kind === "chariot") { key = info.repairKey; frac = info.hp / 100; }
  if (!key || frac >= 0.999) return null;
  const asked = engine.repairAsked(key);
  return (
    <button type="button" disabled={asked} onClick={() => engine.requestRepair(key!)}
      className="mt-2 w-full rounded-xl bg-amber-400/90 py-2 text-sm font-bold text-slate-900 transition hover:bg-amber-300 active:scale-95 disabled:bg-white/10 disabled:text-white/70">
      {asked ? `🔧 Repair on the way · ${Math.round(frac * 100)}% sound` : `🔧 Repair now (${Math.round(frac * 100)}% sound)`}
    </button>
  );
}

/** "🛡️ Fit on all Scorpions": every one that can take the Obsidian Fire Shield right now. */
function ObsidianAllButton({ engine }: { engine: Engine }) {
  const { available, fitting } = engine.obsidianStatus();
  return (
    <button type="button" disabled={available === 0} onClick={() => engine.fitObsidianAll()}
      className="mt-2 w-full rounded-xl bg-violet-400/80 py-2 text-sm font-bold text-slate-950 transition hover:bg-violet-300 active:scale-95 disabled:bg-white/10 disabled:text-white/60">
      {available ? `🛡️ Fit on all Scorpions (${available})` : fitting ? `🛡️ ${fitting} being fitted` : "🛡️ All Scorpions shielded"}
    </button>
  );
}

function CostChips({ cost, have, stock }: { cost: Cost; have?: Cost; stock: Record<string, number> }) {
  const entries = Object.entries(cost) as [Resource, number][];
  if (!entries.length) return <span className="text-[12px] text-white/55">Free</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([r, n]) => {
        const got = have ? have[r] ?? 0 : 0;
        const done = have ? got >= n : (stock[r] ?? 0) >= n;
        return (
          <span key={r} title={RES_INFO[r].name} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${done ? "bg-emerald-500/30" : "bg-white/10"}`}>
            <GameIcon id={r} size={13} /> {have ? `${got}/${n}` : n}
            {!have && <span className="ml-0.5 text-[10px] font-medium text-white/50">({stock[r] ?? 0})</span>}
          </span>
        );
      })}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }} />
    </div>
  );
}

export default function InspectPanel({ info, snap, engine }: { info: InspectInfo; snap: Snapshot; engine: Engine }) {
  const panelRef = useRef<HTMLElement>(null);
  useClickAway(true, panelRef, () => engine.closeInspect());
  const stock = snap.camp.stock;
  return (
    <motion.aside
      ref={panelRef}
      key={`${info.kind}-${info.id}`}
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="dl-glass dl-scroll pointer-events-auto absolute inset-x-2 bottom-[84px] z-20 max-h-[46vh] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:max-h-[calc(100vh-220px)] sm:w-[320px]"
    >
      <button type="button" aria-label="Close" onClick={() => engine.closeInspect()} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-5 w-5" />
      </button>
      {info.kind === "shelter" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-amber-300/30 to-orange-500/20 text-3xl">{info.icon}</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.name}</div>
              <div className="text-xs text-white/60">{info.built ? `Sleeps ${info.cap} · warmth ${Math.round(info.warmth * 100)}%${info.hearth ? " · 🔥 hearth" : ""}` : info.progress}</div>
            </div>
          </div>
          {info.built && info.hp < 0.95 && (
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-semibold text-white/60">Condition</div>
              <Bar value={info.hp} color="linear-gradient(90deg,#f97316,#facc15)" />
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm font-bold">
            <span>
              Lives here ({info.residents.length}/{info.cap})
            </span>
            <span className="text-[11px] font-semibold text-white/55">{info.residents.filter((r) => r.inside).length} inside now</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {info.residents.length === 0 && <p className="text-[12px] text-white/55">Nobody yet — people move in automatically.</p>}
            {info.residents.map((r) => (
              <button key={r.id} type="button" onClick={() => engine.selectPeople([r.id])} className="flex w-full items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5 text-left text-[13px] transition hover:bg-white/10">
                <span className="font-semibold">
                  {r.child ? "🧒" : "🧑"} {r.name}
                </span>
                <span className={`text-[11px] ${r.inside ? "text-amber-200" : "text-white/55"}`}>{r.inside ? "🏠 inside" : r.state}</span>
              </button>
            ))}
          </div>
          {info.residents.some((r) => !r.child) && (
            <button type="button" onClick={() => engine.selectResidents(info.id)} className="mt-2 w-full rounded-2xl bg-amber-400 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300 active:scale-95">
              👥 Send them out to work
            </button>
          )}
          {info.upgrade && (
            <div className="mt-3 rounded-2xl bg-white/5 p-3">
              <div className="text-sm font-bold">
                ⬆️ Next: {info.upgrade.icon} {info.upgrade.name}
              </div>
              <div className="mt-1.5">
                <CostChips cost={info.upgrade.cost} have={info.upgrade.started ? info.upgrade.have : undefined} stock={stock} />
              </div>
              {info.upgrade.started ? (
                <p className="mt-1.5 text-[11px] text-emerald-300">Builders are on it — they'll fetch whatever is missing.</p>
              ) : (
                <button type="button" onClick={() => engine.upgradeHome(info.id)} className="mt-2 w-full rounded-xl bg-white/10 py-2 text-sm font-bold transition hover:bg-white/20 active:scale-95">
                  Upgrade
                </button>
              )}
              <UpgradeAllButton engine={engine} kind="homes" label="Upgrade all homes" className="mt-2 w-full" />
            </div>
          )}
        </>
      )}
      {(["building", "shelter", "gate", "wall", "farm", "tower"] as string[]).includes(info.kind) && (
        <button type="button" onClick={() => (engine.moveAim ? engine.cancelMove() : engine.startMoveSelected())}
          className={`absolute right-12 top-3 z-10 rounded-xl px-2.5 py-1.5 text-xs font-bold transition active:scale-95 ${engine.moveAim ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}
          title="Pick it up and carry it somewhere else">
          {engine.moveAim ? "✕ Cancel move" : "🚚 Move"}
        </button>
      )}
      {info.kind !== "chariot" && <RepairButton info={info} engine={engine} />}
      {info.kind === "wall" && (
        <div className="pr-8">
          <div className="text-lg font-bold">🔷 {info.material} {info.part}</div>
          <p className="mt-1 text-xs text-white/60">{info.built < 1 ? "Blueprint" : "Built"} · Drag after choosing Move, or tap a new tile. Workers levitate and reshape the existing stones.</p>
          <div className="mt-3"><Bar value={info.hp / info.maxHp} color="linear-gradient(90deg,#22c55e,#a3e635)" /></div>
          <button type="button" onClick={() => engine.toggleWallEditMode(true)} title="Pick several wall pieces and drag them somewhere else together, keeping their shape"
            className="mt-2 w-full rounded-xl bg-cyan-400/20 py-2 text-sm font-bold text-cyan-50 transition hover:bg-cyan-400/30 active:scale-95">✏️ Edit walls (move many pieces at once)</button>
        </div>
      )}
      {info.kind === "farm" && (
        <div className="pr-8">
          <div className="text-lg font-bold">🌾 {info.crop} farm</div>
          <p className="mt-1 text-xs text-white/60">{info.planted ? `Growing · ${Math.round(info.growth * 100)}%` : "Ready to plant"} · Choose Move, then drag the field or tap a new spot.</p>
        </div>
      )}
      {info.kind === "building" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">{info.icon}</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.name}</div>
              <div className="text-xs text-white/60">{info.built >= 1 ? "Finished" : info.stage ? `Stage ${info.stage.n + 1} of ${info.stage.of}: ${info.stage.name}` : `Under construction · ${Math.round(info.built * 100)}%`}</div>
            </div>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-white/80">{info.tip}</p>
          {info.stage && (
            <div className="mt-2 flex gap-1" aria-label="Stages">
              {Array.from({ length: info.stage.of }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${info.built >= 1 || i < info.stage!.n ? "bg-amber-300" : i === info.stage!.n ? "bg-amber-300/50" : "bg-white/10"}`} />
              ))}
            </div>
          )}
          {info.stage?.next && info.built < 1 && <p className="mt-1 text-[11px] text-white/55">Then: {info.stage.next}</p>}
          {info.note && <p className="mt-2 rounded-xl bg-cyan-500/10 px-2.5 py-1.5 text-[12px] text-cyan-100">{info.note}</p>}
          {info.built >= 1 && info.bkind === "hatchery" && <IncubatorSection engine={engine} id={info.id} />}
          {info.built >= 1 && info.bkind === "dragonPit" && <PitSection engine={engine} />}
          {info.shield && (
            <div className="mt-2 rounded-2xl bg-cyan-400/10 p-2.5">
              <div className="flex items-center justify-between text-[11.5px] font-semibold text-cyan-50">
                <span>Field {info.shield.r} px · {info.shield.linked ? `knitted to ${info.shield.linked} shield${info.shield.linked === 1 ? "" : "s"}` : "on its own"}</span>
                <span className="tabular-nums">{info.shield.powered ? `⚡ ${Math.round(info.shield.charge * 100)}%` : "🔌 off"}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" style={{ width: `${Math.round(info.shield.charge * 100)}%` }} /></div>
              <div className="mt-2 space-y-1">
                {info.shield.ups.map((u) => (
                  <button key={u.key} type="button" disabled={!u.ok} onClick={() => engine.upgradeDragonShield(info.id, u.key)} title={u.tip}
                    className="flex w-full items-center gap-2 rounded-xl bg-white/[0.07] px-2 py-1.5 text-left text-[11.5px] transition hover:bg-white/15 disabled:opacity-45">
                    <span className="text-base">{u.icon}</span>
                    <span className="min-w-0 flex-1"><b>{u.name}</b> <span className="text-white/55">{"●".repeat(u.lvl)}{"○".repeat(u.max - u.lvl)}</span><br /><span className="text-[10.5px] text-white/55">{u.tip}</span></span>
                    {u.lvl < u.max ? <CostChips cost={u.cost} stock={stock} /> : <span className="text-[10.5px] text-emerald-300">max</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {info.built < 1 ? (
            <div className="mt-3">
              <div className="mb-1 text-[11px] font-semibold text-white/60">Materials delivered</div>
              <CostChips cost={info.cost} have={info.have} stock={stock} />
            </div>
          ) : (
            info.hp < info.maxHp && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-semibold text-white/60">Condition</div>
                <Bar value={info.hp / info.maxHp} color="linear-gradient(90deg,#f97316,#facc15)" />
              </div>
            )
          )}
        </>
      )}
      {info.kind === "scorpion" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">🎯</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.name}</div>
              <div className="text-xs text-white/60">
                On the {info.mount} · {info.built < 1 ? `building ${Math.round(info.built * 100)}%` : info.drone ? "⚡ powered: aims + fires on its own" : info.crew ? `crewed by ${info.crew}` : "nobody crewing it"}
              </div>
            </div>
          </div>
          {info.built >= 1 && (
            <div className="mt-2">
              <Bar value={info.hp / info.maxHp} color={info.obsidian ? "linear-gradient(90deg,#3b3355,#a78bfa)" : "linear-gradient(90deg,#22c55e,#a3e635)"} />
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${info.conditionTone === "good" ? "bg-emerald-500/20 text-emerald-200" : info.conditionTone === "warn" ? "bg-amber-500/20 text-amber-200" : info.conditionTone === "bad" ? "bg-rose-500/25 text-rose-200" : "bg-sky-500/20 text-sky-200"}`}>{info.condition}</span>
                {info.obsidian && <span className="rounded-full bg-violet-500/25 px-2 py-0.5 font-semibold text-violet-100">🛡️ Obsidian Fire Shield</span>}
                {!info.working && info.conditionTone !== "bad" && <span className="text-white/60">its wall / tower needs rebuilding first</span>}
                {info.hp < info.maxHp * 0.75 && <span className="text-white/60">· builders will repair it</span>}
              </div>
            </div>
          )}
          {info.built < 1 && (
            <div className="mt-3">
              <CostChips cost={info.cost} have={info.have} stock={stock} />
            </div>
          )}
          {info.built >= 1 && !info.crew && <p className="mt-2 text-[12px] text-white/70">Guards jump on it when danger comes. Or pick someone and tap the Scorpion.</p>}
          {info.built >= 1 && info.next && (
            <div className="mt-3 rounded-2xl bg-white/5 p-3">
              <div className="text-sm font-bold">⬆️ {info.next.name}</div>
              <div className="mt-1.5">
                <CostChips cost={info.next.cost} have={info.upgrading ? info.have : undefined} stock={stock} />
              </div>
              {info.upgrading ? (
                <p className="mt-1.5 text-[11px] text-emerald-300">Upgrade underway.</p>
              ) : (
                <button type="button" disabled={info.next.locked} onClick={() => engine.upgradeScorpion(info.id)} className="mt-2 w-full rounded-xl bg-white/10 py-2 text-sm font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-40">
                  {info.next.locked ? "Needs a Blacksmith" : "Upgrade"}
                </button>
              )}
              <UpgradeAllButton engine={engine} kind="scorpions" label="Upgrade all Scorpions" className="mt-2 w-full" />
            </div>
          )}
          {info.built >= 1 && info.obsidianOffer && (
            <div className="mt-3 rounded-2xl bg-violet-950/40 p-3 ring-1 ring-violet-400/20">
              <div className="text-sm font-bold">🛡️ Obsidian Fire Shield</div>
              <p className="mt-1 text-[11px] text-white/65">Polished black volcanic glass over the frame: fire, dragon breath, lava splash, energy heat and catapult boulders mostly glance off. Fits any Scorpion and stays on through its upgrades.</p>
              <div className="mt-1.5">
                <CostChips cost={info.obsidianOffer.cost} have={info.obsidianOffer.fitting ? info.have : undefined} stock={stock} />
              </div>
              {info.obsidianOffer.fitting ? (
                <p className="mt-1.5 text-[11px] text-emerald-300">Builders are fitting the plates.</p>
              ) : (
                <button type="button" disabled={!!info.obsidianOffer.blocked} onClick={() => engine.fitObsidian(info.id)} className="mt-2 w-full rounded-xl bg-violet-500/25 py-2 text-sm font-bold transition hover:bg-violet-500/40 active:scale-95 disabled:opacity-40">
                  {info.obsidianOffer.blocked ?? "Fit the shield"}
                </button>
              )}
              <ObsidianAllButton engine={engine} />
            </div>
          )}
        </>
      )}
      {info.kind === "gate" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">{info.mega ? "🦈" : "🚪"}</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.material} gate</div>
              <div className="text-xs text-white/60">{info.open ? "Open — anything can come through" : info.mega ? "Jaws shut — only our people cross" : "Shut — only people (side door)"}</div>
            </div>
          </div>
          <div className="mt-2">
            <Bar value={info.hp / info.maxHp} color="linear-gradient(90deg,#22c55e,#a3e635)" />
          </div>
          <div className={`mt-3 grid gap-2 ${info.mega ? "grid-cols-1" : "grid-cols-2"}`}>
            <button type="button" onClick={() => engine.toggleGate(info.id)} className="rounded-2xl bg-amber-400 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300 active:scale-95">
              {info.open ? "🔒 Close" : "🔓 Open"}
            </button>
            {!info.mega && <button type="button" disabled={info.auto} onClick={() => engine.setGateAuto(info.id)} className="rounded-2xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-50">
              {info.auto ? "✨ Auto" : "✨ Back to auto"}
            </button>}
          </div>
          <p className="mt-2 text-[11px] text-white/55">{info.mega ? "Shut by default. Our people walk the jaw; dinos and strangers stay out until you open it." : "On auto the tribe shuts it when danger comes and opens it again after."}</p>
        </>
      )}
      {info.kind === "carcass" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-rose-300/25 to-amber-500/15 text-3xl">{info.burnt ? "🔥" : "🦴"}</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.name} body</div>
              <div className="text-xs text-white/60">
                {info.stage}
                {info.working ? ` · ${info.working} harvesting` : ""}
                {!info.burnt && info.fresh > 0 ? ` · meat stays fresh ~${Math.ceil(info.fresh / 60)} min` : ""}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {info.left.map((l) => (
              <div key={l.r} className="flex items-center gap-2 text-[13px]">
                <GameIcon id={l.r} size={18} />
                <span className="w-24 font-semibold">{RES_INFO[l.r as Resource].name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400 transition-[width] duration-300" style={{ width: `${(l.n / Math.max(1, l.max)) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-[12px] font-bold">
                  {l.n}/{l.max}
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => engine.harvestWithIdle(info.id)} className="mt-3 w-full rounded-2xl bg-amber-400 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300 active:scale-95">
            🔪 Send free hands to harvest it
          </button>
          <p className="mt-2 text-[11px] leading-snug text-white/55">Meat feeds the tribe, hide makes clothes + tents, bones make tools, spikes + totems. Predators come for the meat, and it spoils if it's left too long.</p>
        </>
      )}
      {info.kind === "chariot" && (
        <ChariotRaidCard info={info} snap={snap} engine={engine}>
          <RepairButton info={info} engine={engine} />
          {info.hp < 100 && !info.parked && <p className="mt-1 text-[11px] text-white/55">It's repaired once it's back home.</p>}
          {info.next ? (
            <div className="mt-3 rounded-2xl bg-white/5 p-3">
              <div className="text-sm font-bold">⬆️ {info.next.icon} {info.next.name}</div>
              <p className="mt-0.5 text-[11px] text-white/60">{info.next.tip} ({info.next.hp} toughness)</p>
              <div className="mt-1.5">
                <CostChips cost={info.next.cost} have={info.up ? info.have : undefined} stock={stock} />
              </div>
              {info.up ? (
                <p className="mt-1.5 text-[11px] text-emerald-300">Upgrade under way{info.parked ? "" : ": fitted once it's back home"}.</p>
              ) : (
                <button type="button" disabled={!!info.upProblem} onClick={() => engine.upgradeChariot(info.id)} className="mt-2 w-full rounded-xl bg-white/10 py-2 text-sm font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-40">
                  {info.upProblem ?? "⬆️ Upgrade"}
                </button>
              )}
              <UpgradeAllButton engine={engine} kind="chariots" label="Upgrade all war chariots" className="mt-2 w-full" />
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-emerald-300">⭐ Fully upgraded.</p>
          )}
        </ChariotRaidCard>
      )}
      {info.kind === "tower" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">{info.stone ? "🏰" : "🗼"}</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.stone ? "Stone tower" : "Watchtower"}</div>
              <div className="text-xs text-white/60">{info.up ? "Being rebuilt in stone…" : info.stage >= 3 ? `${info.guards} on watch up top` : `Building (stage ${info.stage + 1}/3)`}</div>
            </div>
          </div>
          {info.stage >= 3 && (
            <div className="mt-2">
              <Bar value={info.hp / info.maxHp} color="linear-gradient(90deg,#22c55e,#a3e635)" />
            </div>
          )}
          {info.canUpgrade && (
            <div className="mt-2 space-y-2">
              <button type="button" onClick={() => engine.upgradeTower(info.id)} className="w-full rounded-xl bg-white/10 py-2 text-sm font-bold transition hover:bg-white/20 active:scale-95">
                🏰 Rebuild in stone (🪨 {info.upCost}) + 🎯 Scorpion
              </button>
              <UpgradeAllButton engine={engine} kind="towers" label="Upgrade all towers" className="w-full" />
            </div>
          )}
          <p className="mt-2 text-[12px] text-white/70">{info.stone ? "Stone towers are much tougher and come with a 🎯 Scorpion on top (once it's invented)." : "Archers up here shoot further and better. Place a 🎯 Scorpion on top for dragons."} Pick people and tap the tower to send them up.</p>
        </>
      )}
      {info.kind === "monks" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-amber-300/30 to-rose-700/25 text-3xl">🛕</span>
            <div>
              <div className="text-lg font-bold leading-tight">Mountain Monks</div>
              <div className="text-xs text-white/60">
                {info.n} monk{info.n === 1 ? "" : "s"}
                {info.pilgrims ? ` · ${info.pilgrims} pilgrim${info.pilgrims === 1 ? "" : "s"} on the way up` : ""}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[13px] font-semibold">{info.rite ? `🔔 The offering: ${info.rite}` : info.activity}</p>
          <p className="mt-1 text-[12px] text-white/70">A small, peaceful order. Nobody harms them and they harm no one: no beast, raider or dragon will ever go for them. Pilgrims climb up to join them (up to about ten).</p>
          {info.names.length > 0 && <p className="mt-2 text-[11.5px] text-white/60">{info.names.join(" · ")}</p>}
          <div className="mt-3 rounded-2xl bg-white/[0.06] p-3">
            <div className="text-[12px] font-bold">🐉 The yearly offering</div>
            <p className="mt-1 text-[11.5px] text-white/70">
              Once a year, on the last day of winter, they climb in a line to the high ledge and give themselves to the dragons in a ceremony of light. The eldest stay and the order slowly grows again.
              {!info.rite && ` Next: ${info.daysToRite === 0 ? "today, around midday" : `in ${info.daysToRite} day${info.daysToRite === 1 ? "" : "s"}`}.`}
            </p>
            {!info.rite && info.n >= 3 && (
              <button type="button" onClick={() => engine.startMonkRite()} className="mt-2 w-full rounded-xl bg-amber-400/90 py-2 text-sm font-bold text-[#3a2414] transition hover:bg-amber-300 active:scale-95">
                🔔 Watch the offering now
              </button>
            )}
          </div>
        </>
      )}
      {info.kind === "sandCamp" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: `linear-gradient(180deg, ${info.color}55, #d8bd8a33)` }}>🏜️</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.name} Sand People</div>
              <div className="text-xs text-white/60">
                {info.folk} warriors{info.young ? ` · ${info.young} young` : ""} · {info.camels} camel{info.camels === 1 ? "" : "s"}
                {info.raiding ? " · out raiding!" : ""}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {info.roles.map((r) => (
              <span key={r.name} className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-bold">
                {r.icon} {r.n} {r.name}
              </span>
            ))}
          </div>
          {info.dragons.length > 0 && <p className="mt-2 text-[12.5px] font-semibold text-amber-200">🐉 Sand Dragon{info.dragons.length > 1 ? "s" : ""}: {info.dragons.join(", ")} (hot sand breath!)</p>}
          <p className="mt-2 text-[12px] text-white/70">Hostile to everyone. Out on the open sand their robes hide them: guards only notice them up close or once they strike. They ride out in groups (patrols, caravans, raiding parties), never alone.</p>
        </>
      )}
      {snap.inspectPrio && (
        <InspectPriorityControl key={snap.inspectPrio.key} priority={snap.inspectPrio} engine={engine} wall={info.kind === "wall" || info.kind === "gate"} />
      )}
    </motion.aside>
  );
}
