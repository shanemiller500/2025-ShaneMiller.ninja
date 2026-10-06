"use client";

import type { FighterDef, MoveData, MoveSlot } from "../engine/types";
import type { Settings } from "../data/storage";
import { keyLabel } from "../input/input";
import { usePadConnected } from "./usePad";

type Entry = { id: string; slot?: MoveSlot; name: string; pad: string; keyboard: string; note: string; chain?: string };

function describe(move: MoveData) {
  const parts = [move.projectile || move.volley ? "Projectile" : move.counter ? "Counter stance" : move.teleport ? "Teleport strike" : move.lunge ? "Rushing strike" : move.buff ? `${move.buff.kind} buff` : move.heal ? "Healing move" : "Strike"];
  if (move.armor) parts.push("armor");
  if (move.knockdown) parts.push("knockdown");
  if (move.cooldown) parts.push(`${(move.cooldown / 60).toFixed(1)}s cooldown`);
  return parts.join(" · ");
}

export function guideFor(def: FighterDef, settings: Settings, player: 0 | 1): Entry[] {
  const b = settings.bindings[player];
  const k = (a: keyof typeof b) => keyLabel(b[a][0] ?? "");
  const entries: Entry[] = [
    { id: "lp", slot: "lp", name: def.moves.lp.name, pad: "X", keyboard: k("lp"), note: "Fast close strike", chain: "Chains into another attack" },
    { id: "hp", slot: "hp", name: def.moves.hp.name, pad: "Y", keyboard: k("hp"), note: "Heavy strike with more recovery", chain: "Can finish a combo" },
    { id: "kick", slot: "kick", name: def.moves.kick.name, pad: "B", keyboard: k("kick"), note: "Mid range kick", chain: "Can finish a combo" },
    { id: "low", slot: "low", name: def.moves.low.name, pad: "↓ + B", keyboard: `${k("down")} + ${k("kick")}`, note: "Low sweep; crouch to perform" },
    { id: "launcher", slot: "launcher", name: def.moves.launcher.name, pad: "↓ + Y", keyboard: `${k("down")} + ${k("hp")}`, note: "Launches the opponent for follow ups" },
    { id: "air", slot: "air", name: def.moves.air.name, pad: "A, then B / X / Y", keyboard: `${k("up")}, then ${k("kick")} / ${k("lp")} / ${k("hp")}`, note: "Aerial attack while airborne" },
    { id: "throw", slot: "throw", name: def.moves.throw.name, pad: "X + B", keyboard: `${k("lp")} + ${k("kick")}`, note: "Close grab; beats block" },
    { id: "block", name: "Guard / counter", pad: "Hold RT or LT", keyboard: `Hold ${k("block")}`, note: "Block standing or crouching; time it for a counter" },
    { id: "dodge", name: "Dodge", pad: "RT + ← / →", keyboard: `${k("block")} + ${k("left")} / ${k("right")}`, note: "Roll away from an attack; double tap back to dash" },
    { id: "s1", slot: "s1", name: def.moves.s1.name, pad: "RB", keyboard: k("special"), note: describe(def.moves.s1), chain: "Finishes a normal combo on contact" },
    { id: "s2", slot: "s2", name: def.moves.s2.name, pad: "↓ + RB", keyboard: `${k("down")} + ${k("special")}`, note: describe(def.moves.s2), chain: "Finishes a normal combo on contact" },
    { id: "s3", slot: "s3", name: def.moves.s3.name, pad: "Forward + RB", keyboard: `Forward + ${k("special")}`, note: describe(def.moves.s3), chain: "Finishes a normal combo on contact" },
    { id: "ult", slot: "ult", name: def.moves.ult.name, pad: "LT + RT", keyboard: k("ult"), note: `${describe(def.moves.ult)} · requires full meter`, chain: "Can cancel from a move that connects" },
  ];
  for (const c of def.combos) entries.push({ id: `combo-${c.name}`, name: c.name, pad: c.seq.map((s) => ({ lp: "X", hp: "Y", kick: "B", low: "↓B", launcher: "↓Y", air: "A+B", throw: "X+B", s1: "RB", s2: "↓RB", s3: "Forward+RB", ult: "LT+RT" })[s]).join(" → "), keyboard: c.seq.map((s) => ({ lp: k("lp"), hp: k("hp"), kick: k("kick"), low: `${k("down")}+${k("kick")}`, launcher: `${k("down")}+${k("hp")}`, air: `${k("up")}+${k("kick")}`, throw: `${k("lp")}+${k("kick")}`, s1: k("special"), s2: `${k("down")}+${k("special")}`, s3: `Forward+${k("special")}`, ult: k("ult") })[s]).join(" → "), note: `Named combo · ${Math.round((c.bonus - 1) * 100)}% finisher bonus`, chain: "Perform in sequence" });
  entries.push({ id: "passive", name: def.passive.name, pad: "Automatic", keyboard: "Automatic", note: def.passive.desc });
  return entries;
}

export function HowToPlay({ def, settings, player = 0 }: { def: FighterDef; settings: Settings; player?: 0 | 1 }) {
  const pad = !!usePadConnected();
  const guide = guideFor(def, settings, player);
  const input = (slot: string) => {
    const move = guide.find((entry) => entry.id === slot);
    return move ? (pad ? move.pad : move.keyboard) : slot;
  };
  const distance = def.archetype === "tank" || def.archetype === "brawler" ? "Stay close and press with heavy attacks." : def.archetype === "power" ? "Control mid range with your specials." : "Move in and out; use your speed to choose openings.";
  const opener = def.combos[0];
  return <div className="space-y-3 text-sm leading-relaxed text-white/80">
    <p>{def.blurb}</p><p>{distance}</p>
    <p><strong className="text-white">Starter:</strong> {opener ? `${opener.name} (${opener.seq.map(input).join(" → ")})` : `${input("lp")} → ${input("lp")} → ${input("hp")}`}.</p>
    <p><strong className="text-white">Defense:</strong> {input("block")} to guard. Crouch for low attacks; {input("dodge")} to dodge.</p>
    <p><strong className="text-white">Key special:</strong> {def.moves.s1.name} ({input("s1")}). Use {def.moves.s2.name} with {input("s2")}.</p>
    <p><strong className="text-white">Ultimate:</strong> Save a full meter for {def.moves.ult.name}; use {input("ult")} when you have an opening.</p>
    <p><strong className="text-white">Passive — {def.passive.name}:</strong> {def.passive.desc}</p>
  </div>;
}

export function MoveGuide({ def, settings, player, pinned, onTogglePin }: { def: FighterDef; settings: Settings; player: 0 | 1; pinned?: string[]; onTogglePin?: (id: string) => void }) {
  const pad = !!usePadConnected();
  return <div className="space-y-2">
    <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/55">{def.name} · {pad ? `${pad} controls` : "Keyboard controls"}</p>
    {guideFor(def, settings, player).map((e) => <div key={e.id} className="flex items-center gap-3 border-l-2 border-amber-300/50 bg-white/[0.045] px-3 py-2">
      <div className="min-w-0 flex-1"><p className="font-bold text-white">{e.name}{e.slot && <span className="ml-2 text-xs font-normal text-amber-200/70">{def.moves[e.slot].damage} damage</span>}</p><p className="text-xs text-white/55">{e.note}{e.chain ? ` · ${e.chain}` : ""}</p></div>
      <div className="shrink-0 text-right font-mono text-xs"><p className="text-amber-200">{e.pad}</p><p className="text-white/55">{e.keyboard}</p></div>
      {onTogglePin && e.id !== "passive" && <button type="button" onClick={() => onTogglePin(e.id)} aria-label={`${pinned?.includes(e.id) ? "Unpin" : "Pin"} ${e.name}`} className="rounded border border-white/20 px-2 py-1 text-xs text-white/70 hover:border-amber-300">{pinned?.includes(e.id) ? "★" : "☆"}</button>}
    </div>)}
  </div>;
}
