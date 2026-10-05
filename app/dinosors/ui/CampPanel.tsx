"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { CAMP_LEVELS, ROLES, SHELTER_STAGES, TECH, TECH_ORDER } from "../data/facts";
import { CRAFT_STEPS } from "../sim/camp";
import type { Engine, Snapshot } from "../game/engine";
import type { Danger, Role, TechId } from "../sim/types";

/* ------------------------------------------------------------------ */
/*  The tribe's HQ. Tabs:                                              */
/*   Camp   – level, growth, food + supplies, huts                     */
/*   Jobs   – who does what (Auto or a chosen job), rally, all-auto    */
/*   Defend – walls, towers, raids, danger level                       */
/*   Invent – the tech tree                                            */
/* ------------------------------------------------------------------ */

type Tab = "camp" | "jobs" | "defend" | "invent";

const RES: [string, string, string][] = [
  ["stick", "🪵", "Sticks"],
  ["stone", "🪨", "Stones"],
  ["grass", "🌾", "Grass"],
  ["leaves", "🍃", "Leaves"],
  ["wood", "🪓", "Wood"],
  ["meat", "🥩", "Raw meat"],
  ["cooked", "🍗", "Roast"],
  ["fish", "🐟", "Fish"],
  ["crop", "🌽", "Crops"],
  ["berries", "🫐", "Berries"],
];
const RES_ICON = Object.fromEntries(RES.map(([k, i]) => [k, i]));
const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, (typeof ROLES)[number]>;

export default function CampPanel({ snap, engine, onClose, tab: initial = "camp" }: { snap: Snapshot; engine: Engine; onClose: () => void; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);
  useEffect(() => setTab(initial), [initial]);
  const tribe = snap.tribe;
  return (
    <motion.aside
      initial={{ opacity: 0, x: -24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="dl-glass dl-scroll pointer-events-auto absolute inset-x-2 bottom-[84px] z-20 max-h-[56vh] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-24 sm:max-h-[calc(100vh-200px)] sm:w-[370px]"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 pr-8">
        <span className="text-3xl">{tribe.levelIcon}</span>
        <div>
          <h2 className="text-xl font-bold leading-tight">{tribe.levelName}</h2>
          <p className="text-xs text-white/60">
            {snap.humans} people · room for {tribe.capacity} · {tribe.raidsWon} raids beaten
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1 text-[12px] font-bold">
        {(
          [
            ["camp", "🏕️ Camp"],
            ["jobs", "👥 Jobs"],
            ["defend", "🛡️ Defend"],
            ["invent", "💡 Invent"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-xl py-2 transition active:scale-95 ${tab === k ? "bg-amber-400 text-slate-900" : "hover:bg-white/10"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "camp" && <CampTab snap={snap} engine={engine} />}
      {tab === "jobs" && <JobsTab snap={snap} engine={engine} />}
      {tab === "defend" && <DefendTab snap={snap} engine={engine} />}
      {tab === "invent" && <InventTab snap={snap} engine={engine} />}
    </motion.aside>
  );
}

function CampTab({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const camp = snap.camp;
  const tribe = snap.tribe;
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (cool <= 0) return;
    const id = window.setTimeout(() => setCool((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cool]);
  const next = tribe.next;
  const food = (camp.stock.cooked ?? 0) + (camp.stock.fish ?? 0) + (camp.stock.crop ?? 0) + (camp.stock.berries ?? 0);
  return (
    <>
      {next ? (
        <div className="mt-3 rounded-2xl bg-white/5 p-3">
          <div className="text-sm font-bold">
            Next: {next.icon} {next.name}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[12px] font-bold">
            <span className={`rounded-full px-2.5 py-1 ${next.havePeople >= next.people ? "bg-emerald-500/30" : "bg-white/10"}`}>
              👥 {next.havePeople}/{next.people} people
            </span>
            <span className={`rounded-full px-2.5 py-1 ${next.haveHuts >= next.huts ? "bg-emerald-500/30" : "bg-white/10"}`}>
              🛖 {next.haveHuts}/{next.huts} huts
            </span>
            {next.need && <span className={`rounded-full px-2.5 py-1 ${next.haveTech ? "bg-emerald-500/30" : "bg-white/10"}`}>{TECH[next.need as TechId].icon} {TECH[next.need as TechId].name}</span>}
          </div>
          <p className="mt-1.5 text-[11px] text-white/55">Plenty of food + room in huts = babies are born. Kids grow up into helpers.</p>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-emerald-500/20 p-3 text-sm font-bold">🏰 The biggest camp in Dinosaur Land!</div>
      )}
      <div className="mt-3 flex items-center justify-between text-sm font-bold">
        <span>Supplies</span>
        <span className="text-xs text-white/60">🍽️ {food} meals</span>
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1">
        {RES.map(([k, icon, label]) => (
          <div key={k} title={label} className="flex flex-col items-center rounded-xl bg-white/5 py-1.5">
            <span className="text-lg leading-none">{icon}</span>
            <span className="mt-0.5 text-[12px] font-bold">{camp.stock[k] ?? 0}</span>
          </div>
        ))}
      </div>
      {camp.shelters.length > 0 && (
        <>
          <div className="mt-3 text-sm font-bold">Huts</div>
          <div className="mt-1.5 space-y-1.5">
            {camp.shelters.map((s, i) => (
              <div key={i} className="rounded-2xl bg-white/5 p-2 text-[12px]">
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
                    {SHELTER_STAGES[s.stage].need === "wood" && !camp.learned.includes("axe") ? " — invent the 🪓 axe first!" : ""}
                  </div>
                ) : (
                  <div className="mt-1 text-emerald-300">🛖 Finished — room for 3 more people</div>
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
    </>
  );
}

function JobsTab({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const people = snap.tribe.people;
  const adults = people.filter((p) => !p.child);
  const counts = new Map<Role, number>();
  for (const p of adults) {
    const r = p.role === "auto" ? p.autoRole : p.role;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-bold">
        {ROLES.filter((r) => r.id !== "auto").map((r) => (
          <span key={r.id} title={r.tip} className={`rounded-full px-2.5 py-1 ${counts.get(r.id) ? "bg-white/15" : "bg-white/5 text-white/40"}`}>
            {r.icon} {counts.get(r.id) ?? 0}
          </span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={snap.rallied}
          onClick={() => engine.rally()}
          className={`rounded-2xl py-2.5 text-sm font-bold transition active:scale-95 ${snap.rallied ? "bg-white text-rose-700 hover:bg-rose-50" : "bg-rose-500 hover:bg-rose-400"}`}
        >
          {snap.rallied ? "🏳️ Stand down" : "📣 Rally! Everyone fight"}
        </button>
        <button type="button" onClick={() => engine.allAuto()} className="rounded-2xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/20 active:scale-95">
          ✨ All on Auto
        </button>
      </div>
      <p className="mt-2 text-[11px] text-white/55">Tap a job to give it to someone. ✨ Auto means the tribe decides. Tap a person in the world to send them on a mission!</p>
      <div className="mt-2 space-y-1.5">
        {adults.map((p) => {
          const eff = p.role === "auto" ? p.autoRole : p.role;
          return (
            <div key={p.id} className="rounded-2xl bg-white/5 p-2">
              <div className="flex items-center justify-between text-[13px] font-bold">
                <button type="button" onClick={() => { const h = engine.world.humans.find((x) => x.id === p.id); if (h) { engine.select(h.id); engine.flyTo(h.x, h.y); } }} className="hover:underline">
                  {ROLE_BY_ID[eff]?.icon} {p.name}
                </button>
                <span className="text-[11px] font-semibold text-white/50">{p.role === "auto" ? `Auto → ${ROLE_BY_ID[eff]?.name}` : ROLE_BY_ID[p.role].name}</span>
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    title={`${r.name}: ${r.tip}`}
                    onClick={() => engine.setRole(p.id, r.id)}
                    className={`rounded-lg py-1 text-base transition active:scale-90 ${p.role === r.id ? "bg-amber-400 shadow" : "bg-white/5 hover:bg-white/15"}`}
                  >
                    {r.icon}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {people.some((p) => p.child) && <p className="text-[12px] text-white/60">🧒 {people.filter((p) => p.child).length} kids are too little for jobs — they'll grow up soon!</p>}
      </div>
    </>
  );
}

function DefendTab({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const t = snap.tribe;
  const learned = new Set(snap.camp.learned);
  const dangers: [Danger, string, string][] = [
    ["calm", "🕊️ Calm", "No raids"],
    ["normal", "🦖 Normal", "Raids now and then"],
    ["wild", "🔥 Wild", "Big, frequent raids"],
  ];
  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <Stat icon="🪵" value={`${t.walls.built}/${t.walls.planned}`} label="walls" />
        <Stat icon="🗼" value={String(t.towers)} label="towers" />
        <Stat icon="🧬" value={["Normal", "Tough", "Alpha"][Math.min(2, t.evolution)] ?? "Alpha"} label="raiders" />
      </div>
      {t.walls.damaged > 0 && <p className="mt-2 rounded-xl bg-rose-500/20 p-2 text-[12px] font-semibold">💥 {t.walls.damaged} wall pieces are damaged — builders will fix them.</p>}
      <div className="mt-3 text-sm font-bold">Build defences</div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <button type="button" disabled={!learned.has("palisade")} onClick={() => engine.planWalls("palisade")} className="rounded-2xl bg-white/10 p-2.5 text-left text-[13px] font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-40">
          🪵 Wall around camp
          <span className="block text-[11px] font-medium text-white/60">{learned.has("palisade") ? "2 sticks per piece" : "Needs 🪵 Palisade"}</span>
        </button>
        <button type="button" disabled={!learned.has("stonewall")} onClick={() => engine.planWalls("stone")} className="rounded-2xl bg-white/10 p-2.5 text-left text-[13px] font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-40">
          🧱 Upgrade to stone
          <span className="block text-[11px] font-medium text-white/60">{learned.has("stonewall") ? "2 stones per piece" : "Needs 🧱 Stone walls"}</span>
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-white/55">Or use the 🛠️ Build toy to draw walls, towers and farms wherever you like.</p>
      <div className="mt-3 text-sm font-bold">Danger level</div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {dangers.map(([k, label, sub]) => (
          <button key={k} type="button" onClick={() => engine.setDanger(k)} className={`rounded-2xl p-2 text-[12px] font-bold transition active:scale-95 ${t.danger === k ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
            {label}
            <span className={`block text-[10.5px] font-medium ${t.danger === k ? "text-slate-800" : "text-white/55"}`}>{sub}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/55">Each raid you beat makes the next raiders a bit more evolved — watch out for 👑 Alphas!</p>
    </>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/5 py-2">
      <div className="text-xl leading-none">{icon}</div>
      <div className="mt-1 text-[13px] font-bold">{value}</div>
      <div className="text-[10.5px] text-white/55">{label}</div>
    </div>
  );
}

function InventTab({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const camp = snap.camp;
  const [factFor, setFactFor] = useState<TechId | null>(null);
  const learned = new Set(camp.learned);
  const available = (t: TechId) => !learned.has(t) && (TECH[t].after ?? []).every((a) => learned.has(a));
  const goal = camp.goal;
  return (
    <>
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
          <p className="mt-1.5 text-[11px] text-white/55">{TECH[goal].what}</p>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
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
                if (can && !done) engine.setCampGoal(t);
                setFactFor(factFor === t ? null : t);
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
        <div className="mt-2 rounded-2xl bg-amber-300/15 p-2.5 text-[13px] leading-snug">
          <div className="font-bold">
            {TECH[factFor].icon} {TECH[factFor].name}
          </div>
          <div>{TECH[factFor].what}</div>
          <div className="mt-1 text-amber-100/90">
            {learned.has(factFor) ? "💡 " + TECH[factFor].fact : available(factFor) ? "👉 Picked! The cave people will work on it." : `🔒 First: ${(TECH[factFor].after ?? []).map((a) => TECH[a].name).join(" + ")}`}
          </div>
        </div>
      )}
      <p className="mt-2 text-[11px] text-white/45">Level {snap.tribe.level + 1} of {CAMP_LEVELS.length}</p>
    </>
  );
}
