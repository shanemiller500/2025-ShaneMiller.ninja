"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Utensils, Video, X } from "lucide-react";
import { sp } from "../data/species";
import type { DinoInfo, Engine, HumanInfo } from "../game/engine";
import Portrait from "./Portrait";
import { GUIDE_IMG } from "../data/guide";
import { ROLES } from "../data/facts";
import { WEAPON_KINDS } from "../data/colony";
import { CONDITION_LABEL } from "../sim/injury";
import { GameIcon } from "./GameIcon";

/* ------------------------------------------------------------------ */
/*  Tap a dino → this little card. Live stats, a mood, kid-sized       */
/*  comparisons and one fact at a time.                                */
/* ------------------------------------------------------------------ */

const DIET = {
  herbivore: { icon: "🌿", label: "Plant-eater" },
  carnivore: { icon: "🥩", label: "Meat-eater" },
  piscivore: { icon: "🐟", label: "Fish-eater" },
};

function lengthLike(m: number) {
  if (m <= 1.2) return "as long as a cat";
  if (m <= 2.5) return "as long as a sofa";
  if (m <= 5) return "as long as a car";
  if (m <= 9.5) return "as long as a big truck";
  if (m <= 14) return "as long as a school bus";
  return "as long as two school buses";
}

function weightLike(kg: number) {
  if (kg <= 5) return "as heavy as a house cat";
  if (kg <= 40) return "as heavy as a big dog";
  if (kg <= 600) return "as heavy as a horse";
  if (kg <= 3000) return "as heavy as a hippo";
  if (kg <= 7000) return "as heavy as an elephant";
  return `as heavy as ${Math.round(kg / 6000)} elephants`;
}

const fmtKg = (kg: number) => (kg >= 1000 ? `${Math.round(kg / 100) / 10} t` : `${kg} kg`);

export default function DinoCard({ info, engine, onClose, onCamp }: { info: DinoInfo | HumanInfo; engine: Engine; onClose: () => void; onCamp: () => void }) {
  return (
    <motion.aside
      key={info.id}
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="dl-glass pointer-events-auto absolute inset-x-2 bottom-[84px] z-20 max-h-[46vh] overflow-y-auto rounded-3xl p-4 shadow-2xl dl-scroll sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:max-h-[calc(100vh-220px)] sm:w-[330px]"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-5 w-5" />
      </button>
      {info.kind === "dino" ? <DinoBody info={info} engine={engine} /> : <HumanBody info={info} engine={engine} onCamp={onCamp} onClose={onClose} />}
    </motion.aside>
  );
}

function Bar({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <span className="w-6 text-center text-lg">{icon}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }} />
      </div>
      <span className="w-14 text-right text-[11px] font-semibold text-white/70">{label}</span>
    </div>
  );
}

function DinoBody({ info, engine }: { info: DinoInfo; engine: Engine }) {
  const def = sp(info.species);
  const [fact, setFact] = useState(0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(info.name);
  const following = engine.followId === info.id;
  useEffect(() => {
    setFact(0);
    setEditing(false);
    setName(info.name);
  }, [info.id, info.name]);
  const diet = DIET[def.diet];
  return (
    <>
      <div className="flex items-center gap-3 pr-6">
        <div className="relative shrink-0 rounded-2xl bg-gradient-to-b from-sky-300/30 to-emerald-400/20 p-1">
          <Portrait species={info.species} baby={info.baby} w={104} h={76} />
        </div>
        <div className="min-w-0">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                engine.renameSelected(name);
                setEditing(false);
              }}
            >
              <input autoFocus value={name} maxLength={18} onChange={(e) => setName(e.target.value)} onBlur={() => { engine.renameSelected(name); setEditing(false); }} className="w-full rounded-lg bg-white/15 px-2 py-0.5 text-xl font-bold outline-none ring-2 ring-amber-300" />
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="group flex items-center gap-1.5 text-left text-xl font-bold leading-tight" title="Rename">
              {info.name}
              <Pencil className="h-3.5 w-3.5 text-white/40 group-hover:text-white" />
            </button>
          )}
          <div className="text-sm font-semibold text-amber-200">{def.nick}</div>
          <div className="truncate text-xs italic text-white/60">{def.name}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-semibold">
        <span className="rounded-full bg-white/10 px-2.5 py-1">
          {diet.icon} {diet.label}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1">{info.baby ? "🐣 Baby" : `🎂 ${info.ageDays} days old`}</span>
        <span className="rounded-full bg-white/10 px-2.5 py-1">
          {info.mood.icon} {info.mood.label}
        </span>
        <span className="rounded-full bg-cyan-400/20 px-2.5 py-1" title="Generation — how many parents came before it">
          🧬 Gen {info.gen}
        </span>
        {info.traits.map((t) => (
          <span key={t.name} className="rounded-full bg-violet-400/25 px-2.5 py-1">
            {t.icon} {t.name}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        <Bar icon="🍽️" label="Tummy" value={1 - info.hunger} color="linear-gradient(90deg,#f97316,#fbbf24)" />
        {def.thirstRate > 0 && <Bar icon="💧" label="Water" value={1 - info.thirst} color="linear-gradient(90deg,#0ea5e9,#67e8f9)" />}
        <Bar icon="❤️" label="Health" value={info.health} color="linear-gradient(90deg,#22c55e,#a3e635)" />
        <Bar icon="⚡" label="Energy" value={info.energy} color="linear-gradient(90deg,#eab308,#fde047)" />
        {info.baby && <Bar icon="📏" label="Growing" value={info.growth} color="linear-gradient(90deg,#a78bfa,#f0abfc)" />}
        {info.owner && <Bar icon="🛡️" label="Training" value={info.warTraining} color="linear-gradient(90deg,#f59e0b,#fcd34d)" />}
        {!info.owner && info.tamingKnown && def.diet === "herbivore" && <Bar icon="💚" label="Trust" value={info.tame} color="linear-gradient(90deg,#10b981,#86efac)" />}
      </div>

      <div className="mt-3 rounded-2xl bg-amber-300/10 p-3 text-xs text-amber-100">
        {info.owner ? (
          <>
            <div className="font-bold">🐾 Tribe friend {info.warTraining >= 1 ? "· Battle ready" : ""}</div>
            <div className="mt-1 text-white/70">{info.warArmor ? `${info.warArmor === 2 ? "Strong" : "Young"} grown armor · ` : ""}{info.rideable ? "An adult can ride this dino into battle." : "This dino can defend the camp on foot."}</div>
            {info.warTraining < 1 && <button type="button" onClick={() => engine.trainSelectedDino()} className="mt-2 rounded-xl bg-amber-400 px-3 py-2 font-bold text-slate-900">Train for battle</button>}
            {info.rideable && !info.baby && !info.ridden && <button type="button" onClick={() => engine.rideSelectedDino()} className="ml-2 mt-2 rounded-xl bg-white/15 px-3 py-2 font-bold text-white">Ride into battle</button>}
          </>
        ) : (
          <>
            <div className="font-bold">🐾 Befriend this dino</div>
            <div className="mt-1 text-white/70">{info.tamingKnown ? "An adult can earn its trust, then train it to defend the tribe." : "Learn Taming at camp to befriend gentle dinosaurs."}</div>
            {info.tamingKnown && def.diet === "herbivore" && <button type="button" onClick={() => engine.trainSelectedDino()} className="mt-2 rounded-xl bg-amber-400 px-3 py-2 font-bold text-slate-900">Send a person to befriend</button>}
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="font-bold">📏 {def.move === "fly" ? `${def.lengthM} m wings` : `${def.lengthM} m long`}</div>
          <div className="text-white/60">{lengthLike(def.lengthM)}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="font-bold">⚖️ {fmtKg(def.weightKg)}</div>
          <div className="text-white/60">{weightLike(def.weightKg)}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="font-bold">🕰️ When</div>
          <div className="text-white/60">{def.period}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="font-bold">🦴 Fossils</div>
          <div className="text-white/60">{def.fossils}</div>
        </div>
      </div>

      <button type="button" onClick={() => setFact((f) => (f + 1) % def.facts.length)} className="mt-2 w-full rounded-2xl bg-amber-300/15 p-2.5 text-left text-sm leading-snug transition hover:bg-amber-300/25 active:scale-[0.98]">
        <span className="mr-1">💡</span>
        {def.facts[fact]}
        <span className="mt-1 block text-[11px] font-semibold text-amber-200/80">Tap for another fact ({fact + 1}/{def.facts.length})</span>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => engine.follow(following ? 0 : info.id)} className={`flex flex-col items-center rounded-2xl py-2 text-xs font-semibold transition active:scale-95 ${following ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
          <Video className="mb-0.5 h-5 w-5" /> {following ? "Stop" : "Follow"}
        </button>
        <button type="button" onClick={() => engine.feedSelected()} className="flex flex-col items-center rounded-2xl bg-white/10 py-2 text-xs font-semibold transition hover:bg-white/20 active:scale-95">
          <Utensils className="mb-0.5 h-5 w-5" /> Feed
        </button>
        <button type="button" onClick={() => engine.removeSelected()} className="flex flex-col items-center rounded-2xl bg-white/10 py-2 text-xs font-semibold transition hover:bg-rose-500/40 active:scale-95">
          <Trash2 className="mb-0.5 h-5 w-5" /> Remove
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/45">Tip: double-tap a dino to follow it · hold to pick it up</p>
    </>
  );
}

/** A cut-out from the cave-people art that suits their job. */
function portraitFor(role: string, id: number) {
  const by: Record<string, string[]> = {
    hunter: ["hunter", "spearmaker"],
    guard: ["hunter", "spearmaker"],
    builder: ["builder", "logs", "stonecutter"],
    miner: ["crystal-miner", "stonecutter"],
    gatherer: ["forager", "berries", "water-carrier", "water"],
    farmer: ["berries", "forager"],
    cook: ["basket", "berries"],
    smith: ["knapper", "spearmaker"],
    researcher: ["weaver", "knapper"],
    shaper: ["stonecutter", "builder"],
    technician: ["crystal-miner", "builder"],
  };
  const list = by[role] ?? ["forager", "berries", "builder", "basket", "weaver", "logs"];
  return list[id % list.length];
}

function HumanBody({ info, engine, onCamp, onClose }: { info: HumanInfo; engine: Engine; onCamp: () => void; onClose: () => void }) {
  const eff = info.role === "auto" ? info.autoRole : info.role;
  const effRole = ROLES.find((r) => r.id === eff);
  const cond = CONDITION_LABEL[info.condition];
  return (
    <div>
      <div className="flex items-center gap-3 pr-6">
        {info.child ? (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-amber-300/30 to-orange-500/20 text-4xl">🧒</span>
        ) : (
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-300/40 to-emerald-400/30 ring-1 ring-white/15">
            <img src={GUIDE_IMG(portraitFor(eff, info.id))} alt="" width={64} height={64} className="h-[86px] w-16 object-cover object-top" />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-xl font-bold">{info.name}</div>
          <div className="text-sm font-semibold text-amber-200">
            {info.child ? "Cave kid" : `${effRole?.icon} ${effRole?.name}${info.role === "auto" ? " (auto)" : ""}`}
          </div>
          <div className="truncate text-sm text-white/70">{info.task ? `${info.task.icon} ${info.task.label}` : info.activity}</div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Bar icon={cond.icon} label={cond.label} value={info.hp} color={`linear-gradient(90deg,${cond.color},#a3e635)`} />
        <Bar icon={info.warmth < 0.3 ? "🥶" : "🔥"} label={info.warmth < 0.3 ? "Freezing" : "Warmth"} value={info.warmth} color="linear-gradient(90deg,#38bdf8,#fb923c)" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold">
        <span className="rounded-full bg-white/10 px-2.5 py-1">{info.home}</span>
        {info.weapon && (
          <span className="rounded-full bg-white/10 px-2.5 py-1">
            {info.weapon.icon} {info.weapon.name}
          </span>
        )}
        {info.shield > 0 && <span className="rounded-full bg-white/10 px-2.5 py-1">🛡️ Shield {info.shield}</span>}
        {info.outfit ? (
          <span className="flex items-center gap-1 rounded-full bg-sky-400/20 px-2.5 py-1" title={`Keeps off ${Math.round(info.outfit.rain * 100)}% of the rain, ${Math.round(info.outfit.warmth * 100)}% of the cold`}>
            {info.outfit.id === "raincloak" ? <GameIcon id="rainproof" size={14} /> : info.outfit.icon} {info.outfit.name}
          </span>
        ) : (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/50" title="Make hide clothes at a Hide rack">No hide clothes</span>
        )}
        {info.riding && <span className="rounded-full bg-emerald-500/25 px-2.5 py-1">🏇 {info.riding}</span>}
      </div>
      {!info.child && info.canEquip.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px]">
          <span className="text-white/60">Armory:</span>
          {WEAPON_KINDS.filter((k) => info.canEquip.includes(k.kind)).map((k) => (
            <button key={k.kind} type="button" title={`Take the best ${k.name.toLowerCase()}`} onClick={() => engine.equipSelected(k.kind)} className="rounded-lg bg-white/10 px-2 py-1 text-base transition hover:bg-white/20 active:scale-90">
              {k.icon}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 rounded-2xl bg-amber-300/10 p-2 text-[12px] leading-snug text-amber-50/90">👆 {info.name} is picked: tap a tree, rock, water, a dino, a wall, a hurt friend… they'll work out what to do.</p>
      {info.child ? (
        <p className="mt-3 rounded-2xl bg-white/5 p-2.5 text-sm text-white/80">🧒 Kids carry little things, follow grown-ups to learn, and hide when danger comes. They never fight.</p>
      ) : (
        <>
          <div className="mt-3 text-sm font-bold">Job</div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                title={r.tip}
                onClick={() => { engine.setRole(info.id, r.id); onClose(); }}
                className={`flex flex-col items-center rounded-2xl py-1.5 transition active:scale-95 ${info.role === r.id ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}
              >
                <span className="text-xl leading-none">{r.icon}</span>
                <span className="mt-0.5 text-[10.5px] font-bold">{r.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-white/55">{ROLES.find((r) => r.id === info.role)?.tip}</p>
          {!info.child && info.condition !== "down" && (
            <button type="button" onClick={() => { if (engine.sendToDeep(info.id)) onClose(); }} className="mt-3 w-full rounded-2xl bg-cyan-500/80 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 active:scale-95">
              ⛏️ Send down the mine
            </button>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {info.ordered ? (
              <button type="button" onClick={() => engine.cancelOrders()} className="rounded-2xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/20 active:scale-95">
                ✋ Cancel order
              </button>
            ) : info.riding ? (
              <button type="button" onClick={() => engine.dismountSelected()} className="rounded-2xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/20 active:scale-95">
                ⬇️ Hop off
              </button>
            ) : (
              <button type="button" onClick={() => engine.selectAll(true)} className="rounded-2xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/20 active:scale-95">
                👥 + idle people
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const c = engine.world.camp;
                engine.flyTo(c.x, c.y, Math.max(engine.cam.zoom, 0.9));
                onCamp();
              }}
              className="rounded-2xl bg-amber-400 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300 active:scale-95"
            >
              🏕️ Camp
            </button>
          </div>
        </>
      )}
    </div>
  );
}
