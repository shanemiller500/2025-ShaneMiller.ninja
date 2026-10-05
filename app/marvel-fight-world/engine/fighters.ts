/* ------------------------------------------------------------------ */
/*  FighterDefinition builder + balancing layer                         */
/*                                                                      */
/*  Dataset stats (0–100) are a starting point, never raw damage. Each   */
/*  stat is mapped into a narrow, playable band so Hulk feels far        */
/*  stronger than Captain America without one-shotting him.              */
/* ------------------------------------------------------------------ */

import { NORMALS, SIGNATURE_KITS, archetypeKit, type Kit } from "./moves";
import type { Alignment, Archetype, FighterDef, FxKind, Look, MoveData, MoveSlot, Stats } from "./types";

/** Minimal shape we need from the dataset (app/Marvel/lib/roster Hero). */
export interface HeroLike {
  id: number;
  name: string;
  powerstats: Stats;
  biography: { fullName: string; alignment: string };
  images: { xs: string; sm: string; md: string; lg: string };
  appearance?: { gender?: string; hairColor?: string };
}

/* ── Archetypes ────────────────────────────────────────────────────── */
export const ARCHETYPE_INFO: Record<Archetype, { label: string; color: string; desc: string }> = {
  brawler: { label: "Brawler", color: "#f97316", desc: "High strength and toughness. Wins up close." },
  speed: { label: "Speed", color: "#22d3ee", desc: "Fast movement and attacks. Double jump." },
  technical: { label: "Technical", color: "#a78bfa", desc: "Smart fighter with traps and counters." },
  power: { label: "Power", color: "#facc15", desc: "Energy specials and big beams from range." },
  tank: { label: "Tank", color: "#94a3b8", desc: "Absorbs punishment, armored attacks." },
  balanced: { label: "Balanced", color: "#4ade80", desc: "No weak spots. Great for learning." },
};

/** Manual archetype overrides where the raw stats tell the wrong story. */
const ARCHETYPE_OVERRIDES: Record<string, Archetype> = {
  "Spider-Man": "speed",
  Hulk: "brawler",
  Wolverine: "brawler",
  "Iron Man": "power",
  Thor: "power",
  "Captain America": "balanced",
  "Black Panther": "speed",
  "Doctor Strange": "technical",
  Deadpool: "speed",
  Venom: "brawler",
  Magneto: "power",
  Thanos: "tank",
};

/** Pick the archetype whose profile best fits the stats. */
export function deriveArchetype(s: Stats): Archetype {
  const scores: Record<Archetype, number> = {
    tank: s.durability * 1.3 - s.speed * 0.9 + s.strength * 0.3,
    brawler: s.strength * 0.8 + s.durability * 0.4 + s.combat * 0.3 + s.speed * 0.2 - s.power * 0.25,
    speed: s.speed * 1.1 + s.combat * 0.5 - s.strength * 0.2,
    technical: s.intelligence * 0.8 + s.combat * 0.6 - s.strength * 0.25,
    power: s.power * 1.15 - s.combat * 0.15 + s.intelligence * 0.1,
    balanced: 0,
  };
  const vals = Object.values(s);
  const spread = Math.max(...vals) - Math.min(...vals);
  // Even stat lines read as balanced
  scores.balanced = spread < 35 ? 999 : (vals.reduce((a, b) => a + b, 0) / vals.length) * 0.9;
  return (Object.keys(scores) as Archetype[]).reduce((best, k) => (scores[k] > scores[best] ? k : best), "balanced");
}

/* ── Looks ─────────────────────────────────────────────────────────── */
const LOOKS: Record<string, Partial<Look>> = {
  "Spider-Man": { primary: "#d4202f", secondary: "#1f45b8", accent: "#d4202f", skin: "#d4202f", webLines: true, bulk: 0.95, height: 0.98 },
  Hulk: { primary: "#4f9e3a", secondary: "#6b3fa0", accent: "#4f9e3a", skin: "#4f9e3a", bareArms: true, bareChest: true, bulk: 1.45, height: 1.14 },
  Wolverine: { headgear: "wolverine", primary: "#f2c21a", secondary: "#1d3f8f", accent: "#1d3f8f", skin: "#e0b48f", claws: "#dfe4ea", bulk: 1.08, height: 0.9 },
  "Iron Man": { primary: "#b3121b", secondary: "#c9a227", accent: "#e7c34a", skin: "#c9a227", reactor: true, glow: "#9fe7ff", bulk: 1.1, height: 1.0 },
  Thor: { headgear: "thor", primary: "#3b4a5e", secondary: "#262a33", accent: "#c3c9d3", skin: "#f0c7a0", cape: "#b3121b", hammer: true, bulk: 1.18, height: 1.06 },
  "Captain America": { headgear: "cap", primary: "#1f3f8f", secondary: "#1f3f8f", accent: "#c8102e", skin: "#1f3f8f", shield: true, emblem: "#f8fafc", bulk: 1.08, height: 1.02 },
  "Black Panther": { headgear: "panther", primary: "#1c1c26", secondary: "#1c1c26", accent: "#8b7ad6", skin: "#1c1c26", claws: "#cfd5e2", glow: "#9b8cff", bulk: 1.0, height: 1.0 },
  "Doctor Strange": { headgear: "strange", primary: "#1d3f8f", secondary: "#2b2240", accent: "#c79a2a", skin: "#f0c7a0", cape: "#c8102e", glow: "#ffb347", bulk: 0.96, height: 1.02 },
  Deadpool: { primary: "#b3121b", secondary: "#1a1a1a", accent: "#1a1a1a", skin: "#b3121b", swords: true, bulk: 1.0, height: 1.0 },
  Venom: { primary: "#14141c", secondary: "#14141c", accent: "#f1f5f9", skin: "#14141c", emblem: "#f1f5f9", bulk: 1.25, height: 1.08 },
  Magneto: { headgear: "magneto", primary: "#8a1538", secondary: "#4b2a6b", accent: "#8a1538", skin: "#f0c7a0", cape: "#6b2a8a", glow: "#ff6ad5", bulk: 1.02, height: 1.02 },
  Thanos: { headgear: "thanos", primary: "#2f4b8f", secondary: "#2f4b8f", accent: "#d4a429", skin: "#7a5aa8", bulk: 1.32, height: 1.12 },
};

const ARCHETYPE_FX: Record<Archetype, FxKind> = {
  brawler: "punch",
  speed: "kinetic",
  technical: "energy",
  power: "energy",
  tank: "ground",
  balanced: "energy",
};

/** Stable 0–359 hue from a name (generic fighters get distinct costumes). */
export function nameHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

const HAIR: Record<string, string> = {
  black: "#1c1714",
  brown: "#5b3a24",
  "light brown": "#8a6142",
  blond: "#e8c46a",
  "strawberry blond": "#d9925b",
  gold: "#e0b13c",
  red: "#b83a1e",
  auburn: "#8a3324",
  orange: "#e0701e",
  white: "#e8eaee",
  silver: "#b8bec8",
  grey: "#9ca3af",
  green: "#3f9d4a",
  purple: "#7c3aed",
  blue: "#2563eb",
  indigo: "#4338ca",
  pink: "#ec6fae",
  magenta: "#c026d3",
};

function hairColor(raw?: string) {
  if (!raw) return undefined;
  const k = raw.toLowerCase().split("/")[0].trim();
  return HAIR[k];
}

function lookFor(name: string, s: Stats, alignment: Alignment, gender?: string, hair?: string): Look {
  const hue = nameHue(name);
  const tint = alignment === "bad" ? 0 : alignment === "good" ? 0 : 0;
  const base: Look = {
    bulk: 0.9 + (s.strength + s.durability) / 650,
    height: 0.94 + s.durability / 1200,
    primary: hsl(hue + tint, 62, 42),
    secondary: hsl(hue + 200, 35, 24),
    accent: hsl(hue + 35, 70, 58),
    skin: "#e0b48f",
    glow: s.power >= 80 ? hsl(hue + 180, 90, 65) : undefined,
    mark: (["diamond", "bolt", "circle", "chevron", "stripe"] as const)[(hue >> 2) % 5],
    bareArms: false,
    body: gender?.toLowerCase() === "female" ? "female" : "male",
    hair: hairColor(hair),
  };
  if (base.body === "female") base.bulk = Math.min(base.bulk, 1.08);
  return LOOKS[name] ? { ...base, mark: undefined, bareArms: false, hair: undefined, ...LOOKS[name] } : base;
}

/* ── Balancing ─────────────────────────────────────────────────────── */
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t / 100));

export function balance(s: Stats) {
  return {
    maxHealth: Math.round(lerp(950, 1500, s.durability)),
    defense: lerp(1.12, 0.9, s.durability),
    physMul: lerp(0.82, 1.27, s.strength),
    powerMul: lerp(0.82, 1.27, s.power),
    walk: lerp(2.9, 5.6, s.speed),
    jump: lerp(15.5, 19, s.speed),
    weight: lerp(0.85, 1.35, (s.strength + s.durability) / 2),
    cancelWindow: Math.round(lerp(6, 11, s.combat)),
    cooldownMul: lerp(1.25, 0.75, s.intelligence),
    /** Faster fighters shave frames off their normals */
    startupCut: Math.round(lerp(0, 2, s.speed)),
  };
}

function withStartup(m: MoveData, cut: number): MoveData {
  return { ...m, startup: Math.max(3, m.startup - cut) };
}

/* ── Build ─────────────────────────────────────────────────────────── */
export function buildFighter(hero: HeroLike): FighterDef {
  const s = hero.powerstats;
  const alignment: Alignment = hero.biography.alignment === "good" || hero.biography.alignment === "bad" ? hero.biography.alignment : "neutral";
  const archetype = ARCHETYPE_OVERRIDES[hero.name] ?? deriveArchetype(s);
  const look = lookFor(hero.name, s, alignment, hero.appearance?.gender, hero.appearance?.hairColor);
  const fx: FxKind = look.claws ? "claw" : ARCHETYPE_FX[archetype];
  const custom = !!SIGNATURE_KITS[hero.name];
  const kit: Kit = SIGNATURE_KITS[hero.name] ?? archetypeKit(archetype, fx);
  const b = balance(s);

  const normal = (slot: "lp" | "hp" | "kick" | "air"): MoveData => withStartup({ ...NORMALS[slot], ...(kit.normals?.[slot] ?? {}) }, slot === "air" ? 0 : b.startupCut);

  const moves: Record<MoveSlot, MoveData> = {
    lp: normal("lp"),
    hp: normal("hp"),
    kick: normal("kick"),
    air: normal("air"),
    low: withStartup(NORMALS.low, b.startupCut),
    launcher: NORMALS.launcher,
    throw: NORMALS.throw,
    s1: kit.s1,
    s2: kit.s2,
    s3: kit.s3,
    ult: { ...kit.ult, kind: "ultimate", cost: 100, cinematic: true },
  };

  const passive = kit.passive;
  const airJumps = passive.id === "doubleJump" || passive.id === "spiderSense" ? 1 : archetype === "speed" ? 1 : 0;

  return {
    id: hero.id,
    name: hero.name,
    realName: hero.biography.fullName && hero.biography.fullName !== "-" ? hero.biography.fullName : hero.name,
    alignment,
    portrait: hero.images,
    stats: s,
    archetype,
    custom,
    maxHealth: b.maxHealth,
    walk: b.walk,
    run: b.walk * 1.85,
    jump: b.jump,
    airJumps,
    weight: b.weight,
    defense: b.defense,
    physMul: b.physMul,
    powerMul: b.powerMul,
    cancelWindow: b.cancelWindow,
    cooldownMul: passive.id === "meterGain" && archetype === "technical" ? b.cooldownMul * 0.8 : b.cooldownMul,
    width: Math.round(56 * look.bulk),
    height: Math.round(176 * look.height),
    look,
    moves,
    passive,
    combos: kit.combos,
    blurb: kit.blurb,
  };
}

/** Moves worth listing in the UI (specials + ultimate). */
export function specialList(def: FighterDef) {
  return [
    { input: "Special", move: def.moves.s1 },
    { input: "↓ + Special", move: def.moves.s2 },
    { input: "→ + Special", move: def.moves.s3 },
    { input: "Ultimate (full meter)", move: def.moves.ult },
  ];
}
