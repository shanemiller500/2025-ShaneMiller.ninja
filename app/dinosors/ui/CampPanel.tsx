"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { CAMP_LEVELS, ROLES, SHELTER_STAGES, TECH, TECH_ORDER } from "../data/facts";
import { RES_INFO } from "../data/colony";
import { GameIcon } from "./GameIcon";
import { CRAFT_STEPS } from "../sim/camp";
import { shelterDone } from "../sim/build";
import type { Engine, Snapshot } from "../game/engine";
import { TILE, type Danger, type Role, type TechId } from "../sim/types";

/* ------------------------------------------------------------------ */
/*  The tribe's HQ. Tabs:                                              */
/*   Camp   – level, growth, food + supplies, huts                     */
/*   Jobs   – individual and bulk duties, rally, Auto                   */
/*   Defend – walls, towers, raids, danger level                       */
/*   Invent – the tech tree                                            */
/* ------------------------------------------------------------------ */

type Tab = "camp" | "jobs" | "defend" | "invent" | "forge";

const RES: [string, string, string][] = Object.entries(RES_INFO).map(([k, v]) => [k, v.icon, v.name]);
const RES_ICON = Object.fromEntries(RES.map(([k, i]) => [k, i]));
const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, (typeof ROLES)[number]>;

/** Keep stock counts readable in the six-column supplies grid. */
function amountLabel(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 1) return "<1";
  const whole = Math.trunc(value);
  if (Math.abs(whole) < 1000) return String(whole);
  const unit = Math.floor(Math.log10(Math.abs(whole)) / 3);
  if (unit > 5) return whole.toExponential(1).replace("e+", "e");
  const scaled = whole / 1000 ** unit;
  const rounded = Math.abs(scaled) < 10 ? Number(scaled.toFixed(1)) : Math.round(scaled);
  if (Math.abs(rounded) >= 1000) return unit < 5 ? `${Math.sign(whole)}${["", "K", "M", "B", "T", "Q"][unit + 1]}` : whole.toExponential(1).replace("e+", "e");
  return `${rounded}${["", "K", "M", "B", "T", "Q"][unit]}`;
}

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
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 rounded-t-3xl border-b border-white/10 bg-[#392315]/95 px-4 pb-2 pt-4 backdrop-blur-xl">
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

      <div className="mt-3 grid grid-cols-5 gap-1 rounded-2xl bg-white/5 p-1 text-[11.5px] font-bold">
        {(
          [
            ["camp", "🏕️", "Camp"],
            ["jobs", "👥", "Jobs"],
            ["defend", "🛡️", "Defend"],
            ["forge", "⚒️", "Forge"],
            ["invent", "💡", "Invent"],
          ] as [Tab, string, string][]
        ).map(([k, icon, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex flex-col items-center rounded-xl py-1.5 transition active:scale-95 ${tab === k ? "bg-amber-400 text-slate-900" : "hover:bg-white/10"}`}>
            <span className="text-base leading-none">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      </div>

      {tab === "camp" && <CampTab snap={snap} engine={engine} />}
      {tab === "jobs" && <JobsTab snap={snap} engine={engine} />}
      {tab === "defend" && <DefendTab snap={snap} engine={engine} />}
      {tab === "invent" && <InventTab snap={snap} engine={engine} />}
      {tab === "forge" && <ForgeTab snap={snap} engine={engine} />}
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
  const w = engine.world;
  const outlyingHomes = w.shelters.filter((s) => shelterDone(s) && Math.hypot(s.x - w.camp.x, s.y - w.camp.y) > 380);
  const near = (x: number, y: number, s: { x: number; y: number }, r: number) => Math.hypot(x - s.x, y - s.y) < r;
  const needFood = outlyingHomes.some((s) => !w.colony.buildings.some((b) => b.built >= 1 && b.kind === "foodStore" && near(b.x, b.y, s, 240)));
  const needLight = outlyingHomes.some((s) => !w.campfires.some((f) => f.lit && near(f.x, f.y, s, 210)) && !w.colony.buildings.some((b) => b.built >= 1 && b.kind === "boneTorch" && near(b.x, b.y, s, 210)));
  const needDefense = outlyingHomes.some((s) => !w.tribe.towers.some((t) => t.stage >= 3 && near(t.x, t.y, s, 240)) && !w.tribe.walls.some((wall) => wall.built >= 1 && near(wall.tx * TILE, wall.ty * TILE, s, 180)));
  return (
    <>
      <div className="mt-3 rounded-2xl bg-white/5 p-2.5">
        <button type="button" onClick={() => engine.upgradeAll()} className="w-full rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">⬆️ Upgrade all available</button>
        <p className="mt-1.5 text-[11px] leading-snug text-white/60">Queues every eligible home, tower, Scorpion and wall upgrade. Builders collect the materials; research unlocks later tiers.</p>
      </div>
      <div className="mt-2 rounded-2xl bg-emerald-500/10 p-2.5 text-[11px] leading-snug text-emerald-50/85">
        <strong className="text-[12px]">Growing into new areas</strong>
        <p className="mt-1">{outlyingHomes.length ? `${outlyingHomes.length} finished homes are away from the original camp. Families will settle there and look for work near their homes.` : "Finish homes in another area to let families settle there."}</p>
        <p className="mt-1">{outlyingHomes.length ? [needFood && "Add a food store nearby for meals", needLight && "add a fire or bone torches for light", needDefense && "build walls or a tower for safety", "keep enough beds, water and stocked supplies"].filter(Boolean).join(" · ") : "Add food, water, a fire for warmth, torches for light, and walls or towers for safety."}</p>
      </div>
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
        <span className="text-xs text-white/60" title={`${food.toLocaleString("en-US", { maximumFractionDigits: 2 })} meals`}>🍽️ {amountLabel(food)} meals</span>
      </div>
      <div className="mt-1.5 grid grid-cols-6 gap-1">
        {RES.filter(([k]) => (camp.stock[k] ?? 0) > 0 || ["stick", "stone", "wood", "grass", "leaves", "berries", "hide", "bone"].includes(k)).map(([k, icon, label]) => (
          <div key={k} title={`${label}: ${(camp.stock[k] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`} className="flex min-w-0 flex-col items-center rounded-xl bg-white/5 py-1.5">
            <GameIcon id={k} fallback={icon} size={20} />
            <span className="mt-0.5 max-w-full truncate px-0.5 text-[11px] font-bold tabular-nums">{amountLabel(camp.stock[k] ?? 0)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Stat icon="🏡" value={`${snap.colony.homes}`} label="homes" />
        <Stat icon="⛏️" value={`${snap.colony.found}/${snap.colony.deposits}`} label="deposits found" />
        <Stat icon="🏗️" value={`${snap.colony.buildings}`} label="buildings" />
      </div>
      {snap.rivals.clans.length > 0 && (
        <>
          <div className="mt-3 flex items-center justify-between text-sm font-bold">
            <span>🪓 Neanderthal clans</span>
            <span className="text-[11px] font-semibold text-white/55">growing rival settlements</span>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {snap.rivals.clans.map((cl) => (
              <div key={cl.id} className="flex items-center gap-2 rounded-2xl bg-white/5 p-2 text-[12px]">
                <span className="h-3 w-3 shrink-0 rounded-full border-2 border-black/40" style={{ background: cl.color }} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {cl.name} clan <span className="font-semibold text-white/60">· {cl.size - cl.children} grown · {cl.children} young</span>
                  </div>
                  <div className="text-white/65">{cl.style} camp · level {cl.campTier + 1} · {cl.food} food</div>
                  <div className="truncate text-white/65">
                    {cl.wars.length ? `⚔️ at war with ${cl.wars.join(", ")}` : cl.pacts.length ? `🤝 friends with ${cl.pacts.join(", ")}` : "Keeping to themselves"}
                  </div>
                  {cl.captives.length > 0 && <div className="font-bold text-rose-300">😢 Holding {cl.captives.join(", ")}: send armed people to bring them home!</div>}
                </div>
                <button type="button" onClick={() => engine.flyTo(cl.x, cl.y, 0.9)} className="shrink-0 rounded-xl bg-white/10 px-2.5 py-1.5 font-bold hover:bg-white/20 active:scale-95">
                  📍 Look
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {snap.colony.strangers > 0 && <p className="mt-2 rounded-xl bg-sky-500/20 p-2 text-[12px] font-semibold">🚶 {snap.colony.strangers} newcomer{snap.colony.strangers > 1 ? "s are" : " is"} on the way to camp.</p>}
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
  const available = adults.filter((p) => p.availableForJob);
  const [bulkRole, setBulkRole] = useState<Role>("auto");
  const [amount, setAmount] = useState("1");
  const selected = ROLE_BY_ID[bulkRole];
  const requested = Number(amount);
  const validAmount = amount.trim() !== "" && Number.isInteger(requested) && requested >= 0 && requested <= available.length;
  const counts = new Map<Role, number>();
  for (const p of adults) {
    const r = p.role === "auto" ? p.autoRole : p.role;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return (
    <>
      <p className="mt-3 text-[10.5px] font-semibold text-white/55">Current duties, including Auto picks</p>
      <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] font-bold">
        {ROLES.filter((r) => r.id !== "auto").map((r) => (
          <span key={r.id} title={r.tip} className={`rounded-full px-2.5 py-1 ${counts.get(r.id) ? "bg-white/15" : "bg-white/5 text-white/40"}`}>
            {r.icon} {counts.get(r.id) ?? 0}
          </span>
        ))}
      </div>
      <div className="mt-2">
        <button
          type="button"
          role="switch"
          aria-checked={snap.rallied}
          onClick={() => engine.rally()}
          className={`w-full rounded-2xl py-2.5 text-sm font-bold transition active:scale-95 ${snap.rallied ? "bg-white text-rose-700 hover:bg-rose-50" : "bg-rose-500 hover:bg-rose-400"}`}
        >
          {snap.rallied ? "🏳️ Stand down" : "📣 Rally! Everyone fight"}
        </button>
      </div>
      <div className="mt-2 rounded-2xl bg-white/5 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-bold">Assign a duty</h3>
          <span className="text-[10.5px] text-white/55">{available.length} available adults</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {ROLES.map((r) => (
            <button key={r.id} type="button" aria-pressed={bulkRole === r.id} title={r.tip} onClick={() => setBulkRole(r.id)}
              className={`flex min-h-9 items-center gap-1 rounded-lg px-1.5 text-left text-[10.5px] font-semibold transition ${bulkRole === r.id ? "bg-amber-400 text-slate-950" : "bg-white/[0.07] text-white/80 hover:bg-white/15"}`}>
              <span className="text-sm">{r.icon}</span><span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="tabular-nums opacity-70">{available.filter((p) => p.role === r.id).length}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-end gap-1.5">
          <label className="min-w-0 flex-1 text-[10.5px] font-semibold text-white/65">How many {selected.name.toLowerCase()}?
            <input type="number" min={0} max={available.length} step={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/35 px-2 py-1.5 text-sm font-bold tabular-nums text-white outline-none focus:border-amber-300" />
          </label>
          <button type="button" disabled={!validAmount} onClick={() => engine.setRoleCount(bulkRole, requested)}
            className="rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-bold hover:bg-white/25 disabled:opacity-40">Set number</button>
          <button type="button" disabled={!available.length} onClick={() => engine.setAllRoles(bulkRole)}
            className="rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40">All</button>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-snug text-white/55">Set number makes exactly that many manual assignments. All gives every available adult this duty. Auto balances supplies and plans a building or upgrade each day after day one.</p>
        {bulkRole === "miner" && <p className="mt-1 text-[10.5px] text-cyan-100/75">Miner works surface deposits. Send a crew underground from the Deep panel.</p>}
      </div>
      <p className="mt-2 text-[11px] text-white/55">Tap a job below to assign one person. Tap a person in the world to send them on a mission.</p>
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
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
        <Stat icon="🪵" value={`${t.walls.built}/${t.walls.planned}`} label="walls" />
        <Stat icon="🗼" value={String(t.towers)} label="towers" />
        <Stat icon="🎯" value={String(snap.colony.scorpions)} label="Scorpions" />
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
      <button type="button" onClick={() => engine.upgradeAll("walls")} className="mt-2 w-full rounded-2xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">⬆️ Upgrade all built walls</button>
      <button type="button" disabled={!learned.has("spear")} onClick={() => engine.planSpikes()} className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-white/10 p-2.5 text-left text-[13px] font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-40">
        <GameIcon id="spikes" size={26} />
        <span>
          Line the walls with bone spikes
          <span className="block text-[11px] font-medium text-white/60">{learned.has("spear") ? `2 bones each · you have ${amountLabel(snap.camp.stock.bone ?? 0)} — harvest dinosaurs for more` : "Needs 🗡️ Spear"}</span>
        </span>
      </button>
      <p className="mt-1.5 text-[11px] text-white/55">The ring comes with gates + stairs. Use the 🛠️ Build toy to draw more walls, gates, stairs, towers and 🎯 Scorpions. Tap a built gate to open/close it.</p>
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

function ForgeTab({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const f = snap.forge;
  const [kind, setKind] = useState<"weapons" | "shields" | "gear" | "kits">("gear");
  // looking at the forge clears the NEW badges (after a moment, so you see them first)
  useEffect(() => {
    const id = window.setTimeout(() => engine.seenRecipes(), 4000);
    return () => window.clearTimeout(id);
  }, [engine]);
  const items = f.items.filter((i) => i.cat === kind);
  const newIn = (c: string) => f.items.some((i) => i.cat === c && i.fresh);
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-bold">
        <span className={`rounded-full px-2.5 py-1 ${f.hasWorkshop ? "bg-emerald-500/30" : "bg-white/10 text-white/50"}`}>🛠️ Workshop {f.hasWorkshop ? "✓" : "—"}</span>
        <span className={`rounded-full px-2.5 py-1 ${f.hasSmith ? "bg-emerald-500/30" : "bg-white/10 text-white/50"}`}>⚒️ Blacksmith {f.hasSmith ? "✓" : "—"}</span>
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${f.hasTannery ? "bg-emerald-500/30" : "bg-white/10 text-white/50"}`}>
          <GameIcon id="tannery" size={14} /> Hide rack {f.hasTannery ? "✓" : "—"}
        </span>
      </div>
      <div className="mt-3 text-sm font-bold">Armory</div>
      <div className="mt-1.5 flex min-h-[32px] flex-wrap gap-1.5">
        {f.armory.length ? (
          f.armory.map((a) => (
            <span key={a.id} className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-bold">
              {a.icon} {a.name} ×{a.n}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-white/55">Empty — fighters grab gear from here automatically.</span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm font-bold">
        <span>Queue</span>
        <span className="text-[11px] font-semibold text-white/50">a ⚒️ smith works through it</span>
      </div>
      <div className="mt-1.5 space-y-1">
        {f.queue.length === 0 && <p className="text-[12px] text-white/55">Nothing queued. Pick something below.</p>}
        {f.queue.map((q, i) => (
          <div key={`${q.id}-${i}`} className="flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5 text-[13px]">
            <span className={q.ok ? "" : "text-white/50"}>
              {i === 0 ? "▸ " : ""}
              {q.icon} {q.name}
              {!q.ok && " (waiting for its workshop)"}
            </span>
            <button type="button" onClick={() => engine.unqueueForge(i)} className="rounded-lg px-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Remove">
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1 text-[11.5px] font-bold">
        {(
          [
            ["gear", "Clothes"],
            ["weapons", "Weapons"],
            ["shields", "Shields"],
            ["kits", "Kits"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`relative flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${kind === k ? "bg-amber-400 text-slate-900" : "hover:bg-white/10"}`}>
            {k === "gear" ? <GameIcon id="rainproof" size={14} /> : <span>{k === "weapons" ? "⚔️" : k === "shields" ? "🛡️" : "🧰"}</span>}
            {label}
            {newIn(k) && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">NEW</span>}
          </button>
        ))}
      </div>
      {kind === "gear" && <p className="mt-1.5 text-[11px] text-white/60">Hide clothes keep workers going in rain + snow. People put on whatever suits the weather.</p>}
      {kind === "kits" && <p className="mt-1.5 text-[11px] text-white/60">Made once, they help the whole tribe for good.</p>}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            disabled={it.done || (!!it.why && it.why.startsWith("Invent"))}
            onClick={() => engine.queueForge(it.id)}
            title={it.tip ? `${it.name}: ${it.tip}` : it.why ?? `Queue a ${it.name}`}
            className={`relative flex flex-col items-center rounded-2xl px-1 py-2 transition active:scale-95 disabled:opacity-50 ${it.fresh ? "bg-amber-300/25 ring-2 ring-amber-300" : it.can ? "bg-white/10 hover:bg-white/20" : "bg-white/5"}`}
          >
            {it.id === "raincloak" ? <GameIcon id="rainproof" size={26} /> : <span className="text-2xl leading-none">{it.icon}</span>}
            <span className="mt-1 text-center text-[10.5px] font-semibold leading-tight">{it.name}</span>
            <span className="mt-1 flex flex-wrap justify-center gap-0.5">
              {Object.entries(it.cost).map(([r, n]) => (
                <span key={r} className={`flex items-center gap-0.5 rounded-full px-1 text-[10px] font-bold ${(snap.camp.stock[r] ?? 0) >= (n ?? 0) ? "bg-white/10" : "bg-rose-500/30"}`}>
                  <GameIcon id={r} fallback={RES_INFO[r as keyof typeof RES_INFO]?.icon} size={11} />
                  {n}
                </span>
              ))}
            </span>
            {it.cat === "weapons" || it.cat === "shields" ? <span className="absolute left-1 top-0.5 text-[10px] font-black text-amber-300">{"★".repeat(it.tier)}</span> : null}
            {it.fresh && <span className="absolute right-1 top-0.5 rounded-full bg-rose-500 px-1 text-[8.5px] font-black text-white">NEW</span>}
            {it.why && <span className={`mt-0.5 text-[9.5px] ${it.done ? "font-bold text-emerald-300" : "text-white/50"}`}>{it.why}</span>}
          </button>
        ))}
      </div>
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
                  {RES_ICON[r]} {amountLabel(have)}/{n}
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
