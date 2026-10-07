"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { RES_INFO, type Cost } from "../data/colony";
import type { Engine, InspectInfo, Snapshot } from "../game/engine";
import type { Resource } from "../sim/types";
import { GameIcon } from "./GameIcon";

/* ------------------------------------------------------------------ */
/*  Tap a home, building, Scorpion, gate or tower → this card.         */
/*  Homes list who lives there (and who's inside right now) with a     */
/*  "send them out to work" button and the next upgrade.               */
/* ------------------------------------------------------------------ */

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
  const stock = snap.camp.stock;
  return (
    <motion.aside
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
            </div>
          )}
        </>
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
              <Bar value={info.hp / info.maxHp} color="linear-gradient(90deg,#22c55e,#a3e635)" />
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
            </div>
          )}
        </>
      )}
      {info.kind === "gate" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">🚪</span>
            <div>
              <div className="text-lg font-bold leading-tight">{info.material} gate</div>
              <div className="text-xs text-white/60">{info.open ? "Open — anything can come through" : "Shut — only people (side door)"}</div>
            </div>
          </div>
          <div className="mt-2">
            <Bar value={info.hp / info.maxHp} color="linear-gradient(90deg,#22c55e,#a3e635)" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => engine.toggleGate(info.id)} className="rounded-2xl bg-amber-400 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300 active:scale-95">
              {info.open ? "🔒 Close" : "🔓 Open"}
            </button>
            <button type="button" disabled={info.auto} onClick={() => engine.setGateAuto(info.id)} className="rounded-2xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-50">
              {info.auto ? "✨ Auto" : "✨ Back to auto"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/55">On auto the tribe shuts it when danger comes and opens it again after.</p>
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
      {info.kind === "tower" && (
        <>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">🗼</span>
            <div>
              <div className="text-lg font-bold leading-tight">Watchtower</div>
              <div className="text-xs text-white/60">{info.stage >= 3 ? `${info.guards} on watch up top` : `Building (stage ${info.stage + 1}/3)`}</div>
            </div>
          </div>
          {info.stage >= 3 && (
            <div className="mt-2">
              <Bar value={info.hp / 400} color="linear-gradient(90deg,#22c55e,#a3e635)" />
            </div>
          )}
          <p className="mt-2 text-[12px] text-white/70">Archers up here shoot further and better. Place a 🎯 Scorpion on top for dragons. Pick people and tap the tower to send them up.</p>
        </>
      )}
    </motion.aside>
  );
}
