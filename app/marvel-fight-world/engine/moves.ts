/* ------------------------------------------------------------------ */
/*  Move library                                                        */
/*                                                                      */
/*  Everything here is data: frame timings, hitboxes, projectiles. The  */
/*  engine reads it generically, so a new fighter is a new kit, not new */
/*  code. Damage numbers are BASE values — fighters.ts scales them.     */
/* ------------------------------------------------------------------ */

import type { Archetype, ComboDef, FxKind, MoveData, MoveSlot, Passive, ProjectileSpec } from "./types";

type MoveInit = Partial<MoveData> & Pick<MoveData, "id" | "name" | "kind" | "pose">;

/** Fill sensible defaults so kits stay short. */
export function mv(m: MoveInit): MoveData {
  return {
    startup: 8,
    active: 4,
    recovery: 14,
    damage: 50,
    hitstun: 18,
    blockstun: 12,
    guard: 10,
    knockback: { x: 5, y: 0 },
    meter: 6,
    fx: "punch",
    sfx: "jab",
    ...m,
  };
}

const proj = (p: Partial<ProjectileSpec> & Pick<ProjectileSpec, "fx">): ProjectileSpec => ({
  speed: 13,
  w: 46,
  h: 34,
  life: 70,
  offset: { x: 50, y: 100 },
  ...p,
});

/* ── Shared normals (every fighter) ────────────────────────────────── */
export const NORMALS: Record<"lp" | "hp" | "kick" | "low" | "launcher" | "air" | "throw", MoveData> = {
  lp: mv({
    id: "lp", name: "Jab", kind: "light", pose: "jab",
    startup: 4, active: 3, recovery: 8, damage: 30, hitstun: 15, blockstun: 9, guard: 6,
    knockback: { x: 3, y: 0 }, hitbox: { x: 56, y: 104, w: 62, h: 30 }, meter: 4, sfx: "jab",
  }),
  hp: mv({
    id: "hp", name: "Heavy Punch", kind: "heavy", pose: "cross",
    startup: 9, active: 4, recovery: 16, damage: 62, hitstun: 21, blockstun: 14, guard: 16,
    knockback: { x: 8, y: 0 }, hitbox: { x: 66, y: 96, w: 78, h: 38 }, meter: 9, sfx: "heavy",
  }),
  kick: mv({
    id: "kick", name: "Kick", kind: "kick", pose: "kick",
    startup: 7, active: 4, recovery: 14, damage: 46, hitstun: 18, blockstun: 12, guard: 11,
    knockback: { x: 6, y: 0 }, hitbox: { x: 70, y: 58, w: 88, h: 36 }, meter: 7, sfx: "kick",
  }),
  low: mv({
    id: "low", name: "Sweep", kind: "low", pose: "lowKick",
    startup: 8, active: 4, recovery: 19, damage: 40, hitstun: 22, blockstun: 12, guard: 10,
    knockback: { x: 3, y: 6 }, knockdown: true, low: true, hitbox: { x: 72, y: 0, w: 96, h: 30 }, meter: 7, sfx: "kick",
  }),
  launcher: mv({
    id: "launcher", name: "Uppercut", kind: "launcher", pose: "uppercut",
    startup: 7, active: 5, recovery: 21, damage: 56, hitstun: 26, blockstun: 14, guard: 14,
    knockback: { x: 2, y: 15 }, launch: true, invuln: [0, 6], hitbox: { x: 42, y: 80, w: 62, h: 120 }, meter: 9, sfx: "heavy",
  }),
  air: mv({
    id: "air", name: "Jump Attack", kind: "air", pose: "airKick",
    startup: 5, active: 9, recovery: 6, damage: 48, hitstun: 19, blockstun: 12, guard: 12,
    knockback: { x: 5, y: 0 }, overhead: true, hitbox: { x: 46, y: 18, w: 74, h: 64 }, meter: 7, sfx: "kick",
  }),
  throw: mv({
    id: "throw", name: "Throw", kind: "throw", pose: "throw",
    startup: 4, active: 2, recovery: 26, damage: 92, hitstun: 30, blockstun: 0, guard: 0,
    knockback: { x: 11, y: 9 }, knockdown: true, unblockable: true, grabRange: 100,
    hitbox: { x: 40, y: 40, w: 70, h: 120 }, meter: 12, sfx: "throw",
  }),
};

/* ── Kit shape ─────────────────────────────────────────────────────── */
export interface Kit {
  s1: MoveData;
  s2: MoveData;
  s3: MoveData;
  ult: MoveData;
  passive: Passive;
  combos: ComboDef[];
  blurb: string;
  /** Optional replacements for the shared normals (names / fx) */
  normals?: Partial<Record<"lp" | "hp" | "kick" | "air", Partial<MoveData>>>;
}

/* ── Generic special builders ──────────────────────────────────────── */
const shot = (id: string, name: string, fx: FxKind, dmg = 52, extra: Partial<ProjectileSpec> = {}, m: Partial<MoveData> = {}) =>
  mv({
    id, name, kind: "special", pose: "cast", startup: 12, active: 2, recovery: 20, damage: dmg,
    hitstun: 22, blockstun: 14, guard: 14, knockback: { x: 6, y: 0 }, meter: 8, cooldown: 70, fx, sfx: "energy",
    projectile: proj({ fx, ...extra }), ...m,
  });

const lungeStrike = (id: string, name: string, fx: FxKind, dmg = 76, m: Partial<MoveData> = {}) =>
  mv({
    id, name, kind: "special", pose: "dash", startup: 8, active: 12, recovery: 18, damage: dmg,
    hitstun: 24, blockstun: 16, guard: 20, knockback: { x: 10, y: 4 }, knockdown: true,
    lunge: { vx: 14, from: 6, frames: 14 }, hitbox: { x: 50, y: 60, w: 80, h: 90 }, meter: 10, cooldown: 80, fx, sfx: "heavy", ...m,
  });

const slam = (id: string, name: string, fx: FxKind, dmg = 88, m: Partial<MoveData> = {}) =>
  mv({
    id, name, kind: "special", pose: "slam", startup: 14, active: 5, recovery: 24, damage: dmg,
    hitstun: 26, blockstun: 16, guard: 24, knockback: { x: 6, y: 13 }, launch: true, low: true,
    hitbox: { x: 30, y: 0, w: 280, h: 60 }, meter: 10, cooldown: 110, fx, sfx: "smash", ...m,
  });

const riser = (id: string, name: string, fx: FxKind, dmg = 70, m: Partial<MoveData> = {}) =>
  mv({
    id, name, kind: "special", pose: "rise", startup: 5, active: 10, recovery: 22, damage: dmg,
    hitstun: 26, blockstun: 14, guard: 16, knockback: { x: 3, y: 16 }, launch: true, invuln: [0, 8],
    lunge: { vx: 4, vy: 14, from: 4, frames: 6 }, hitbox: { x: 36, y: 50, w: 70, h: 140 }, meter: 10, cooldown: 90, fx, sfx: "whoosh", ...m,
  });

const rush = (id: string, name: string, fx: FxKind, perHit: number, frames: number, m: Partial<MoveData> = {}) =>
  mv({
    id, name, kind: "ultimate", pose: "dash", startup: 10, active: frames, recovery: 26, damage: perHit,
    hitstun: 20, blockstun: 10, guard: 8, knockback: { x: 2, y: 0 }, rehit: 5, cost: 100, cinematic: true,
    lunge: { vx: 9, from: 8, frames: 10 }, hitbox: { x: 56, y: 40, w: 110, h: 130 }, meter: 0, fx, sfx: "super", ...m,
  });

const buff = (id: string, name: string, kind: "rage" | "shield", frames: number, m: Partial<MoveData> = {}) =>
  mv({
    id, name, kind: "special", pose: "cast", startup: 10, active: 1, recovery: 16, damage: 0, hitstun: 0, blockstun: 0,
    guard: 0, knockback: { x: 0, y: 0 }, meter: 0, cooldown: 600, fx: "energy", sfx: "energy", buff: { kind, frames }, ...m,
  });

const counterStance = (id: string, name: string, fx: FxKind, dmg = 84) =>
  mv({
    id, name, kind: "special", pose: "counter", startup: 3, active: 26, recovery: 18, damage: dmg, hitstun: 28, blockstun: 0,
    guard: 0, knockback: { x: 10, y: 8 }, knockdown: true, counter: true, unblockable: true, hitbox: { x: 50, y: 40, w: 90, h: 130 },
    meter: 12, cooldown: 100, fx, sfx: "block",
  });

const sky = (id: string, name: string, fx: FxKind, perHit: number, count: number, every: number, m: Partial<MoveData> = {}) =>
  mv({
    id, name, kind: "special", pose: "cast", startup: 14, active: count * every + 2, recovery: 18, damage: perHit,
    hitstun: 22, blockstun: 12, guard: 12, knockback: { x: 3, y: 4 }, meter: 6, cooldown: 120, fx, sfx: "lightning",
    volley: { count, every, from: "sky", spec: proj({ fx, speed: 0, vy: -22, w: 50, h: 80, life: 40 }) }, ...m,
  });

const beamUlt = (id: string, name: string, fx: FxKind, perHit: number) =>
  mv({
    id, name, kind: "ultimate", pose: "beam", startup: 16, active: 40, recovery: 26, damage: perHit, hitstun: 18, blockstun: 10,
    guard: 6, knockback: { x: 3, y: 0 }, rehit: 5, cost: 100, cinematic: true, hitbox: { x: 380, y: 80, w: 720, h: 60 },
    meter: 0, fx, sfx: "super",
  });

/* ── Passives ──────────────────────────────────────────────────────── */
export const PASSIVES: Record<string, Passive> = {
  rage: { id: "rage", name: "Rage", desc: "Hits 25% harder below 35% health." },
  regen: { id: "regen", name: "Healing Factor", desc: "Slowly regenerates health when not being hit." },
  doubleJump: { id: "doubleJump", name: "Agile", desc: "Can jump again in mid-air." },
  armor: { id: "armor", name: "Unstoppable", desc: "Heavy attacks and specials shrug off light hits." },
  counter: { id: "counter", name: "Parry", desc: "Blocking right as a hit lands parries it completely." },
  meterGain: { id: "meterGain", name: "Overcharge", desc: "Builds the ultimate meter 35% faster." },
  spiderSense: { id: "spiderSense", name: "Spider-Sense", desc: "Double jump, and dodges are faster with longer invulnerability." },
  flight: { id: "flight", name: "Flight", desc: "Hold jump in the air to hover and drift." },
};

/* ── Archetype kits (every fighter without a custom kit) ───────────── */
export function archetypeKit(a: Archetype, fx: FxKind): Kit {
  const energy: FxKind = fx === "punch" ? "energy" : fx;
  switch (a) {
    case "brawler":
      return {
        s1: slam("s1", "Ground Pound", "ground", 80, { hitbox: { x: 40, y: 0, w: 240, h: 60 }, cooldown: 90 }),
        s2: riser("s2", "Haymaker Uppercut", "punch", 74),
        s3: lungeStrike("s3", "Bull Rush", "punch", 82, { armor: true }),
        ult: rush("ult", "Seismic Beatdown", "ground", 30, 40),
        passive: PASSIVES.rage,
        combos: [
          { name: "One-Two Smash", seq: ["lp", "lp", "hp"], bonus: 1.25 },
          { name: "Brute Force", seq: ["lp", "hp", "s3"], bonus: 1.3 },
        ],
        blurb: "Hits like a truck. Close the gap and don't let go.",
      };
    case "speed":
      return {
        s1: lungeStrike("s1", "Blitz Rush", fx, 30, { rehit: 5, active: 16, knockdown: false, knockback: { x: 3, y: 0 }, lunge: { vx: 16, from: 4, frames: 14 } }),
        s2: riser("s2", "Flash Kick", fx, 64),
        s3: mv({ id: "s3", name: "Afterimage", kind: "special", pose: "dash", startup: 4, active: 6, recovery: 10, damage: 52, hitstun: 22, blockstun: 12, guard: 12, knockback: { x: 7, y: 0 }, teleport: "behind", invuln: [0, 8], hitbox: { x: 50, y: 60, w: 80, h: 90 }, meter: 8, cooldown: 90, fx, sfx: "dodge" }),
        ult: rush("ult", "Thousand Strikes", fx, 24, 46, { rehit: 4 }),
        passive: PASSIVES.doubleJump,
        combos: [
          { name: "Blitz Combo", seq: ["lp", "lp", "kick"], bonus: 1.25 },
          { name: "Flash Chain", seq: ["lp", "kick", "s2"], bonus: 1.3 },
        ],
        blurb: "Fast and slippery. Double jump, dart in, dart out.",
      };
    case "technical":
      return {
        s1: shot("s1", "Gadget Shot", energy, 48),
        s2: counterStance("s2", "Read & Counter", fx === "punch" ? "kinetic" : fx),
        s3: mv({ id: "s3", name: "Trap Mine", kind: "special", pose: "toss", startup: 10, active: 2, recovery: 18, damage: 40, hitstun: 20, blockstun: 10, guard: 10, knockback: { x: 2, y: 0 }, meter: 8, cooldown: 140, fx: "energy", sfx: "zap", projectile: proj({ fx: "energy", speed: 6, ground: true, trap: 55, life: 150, w: 40, h: 26, offset: { x: 50, y: 6 } }) }),
        ult: mv({ id: "ult", name: "Tactical Barrage", kind: "ultimate", pose: "cast", startup: 14, active: 40, recovery: 24, damage: 34, hitstun: 20, blockstun: 10, guard: 8, knockback: { x: 4, y: 2 }, cost: 100, cinematic: true, meter: 0, fx: "missile", sfx: "super", volley: { count: 8, every: 5, from: "self", spec: proj({ fx: "missile", speed: 13, homing: 0.18, life: 90 }) } }),
        passive: PASSIVES.counter,
        combos: [
          { name: "Calculated Strike", seq: ["lp", "hp", "s1"], bonus: 1.3 },
          { name: "Exploit Weakness", seq: ["lp", "lp", "low"], bonus: 1.25 },
        ],
        blurb: "Thinks three moves ahead. Traps, counters and clean punishes.",
      };
    case "power":
      return {
        s1: shot("s1", "Power Blast", energy, 56),
        s2: riser("s2", "Rising Surge", energy, 66, { pose: "rise" }),
        s3: mv({ id: "s3", name: "Power Wave", kind: "special", pose: "cast", startup: 16, active: 2, recovery: 24, damage: 74, hitstun: 24, blockstun: 16, guard: 20, knockback: { x: 9, y: 3 }, meter: 10, cooldown: 120, fx: energy, sfx: "energy", projectile: proj({ fx: energy, speed: 9, w: 70, h: 130, life: 60, offset: { x: 60, y: 30 } }) }),
        ult: beamUlt("ult", "Overload Beam", fx === "punch" ? "beam" : fx, 32),
        passive: PASSIVES.meterGain,
        combos: [
          { name: "Power Surge", seq: ["lp", "hp", "s1"], bonus: 1.3 },
          { name: "Overcharge", seq: ["kick", "hp", "s3"], bonus: 1.3 },
        ],
        blurb: "Keeps you away with blasts, then lights up the stage.",
      };
    case "tank":
      return {
        s1: lungeStrike("s1", "Shoulder Charge", "punch", 80, { armor: true, lunge: { vx: 12, from: 6, frames: 14 } }),
        s2: slam("s2", "Earthquake", "ground", 84),
        s3: mv({ id: "s3", name: "Grab Slam", kind: "special", pose: "throw", startup: 6, active: 3, recovery: 28, damage: 118, hitstun: 32, blockstun: 0, guard: 0, knockback: { x: 6, y: 14 }, knockdown: true, unblockable: true, grabRange: 120, hitbox: { x: 46, y: 30, w: 80, h: 130 }, meter: 14, cooldown: 140, fx: "ground", sfx: "smash" }),
        ult: mv({ id: "ult", name: "Unstoppable Force", kind: "ultimate", pose: "slam", startup: 18, active: 30, recovery: 26, damage: 64, hitstun: 30, blockstun: 14, guard: 20, knockback: { x: 6, y: 12 }, launch: true, rehit: 8, armor: true, cost: 100, cinematic: true, lunge: { vx: 7, vy: 16, from: 8, frames: 10 }, hitbox: { x: 30, y: 0, w: 420, h: 90 }, meter: 0, fx: "ground", sfx: "super" }),
        passive: PASSIVES.armor,
        combos: [
          { name: "Wall Crusher", seq: ["hp", "hp", "s1"], bonus: 1.25 },
          { name: "Tremor", seq: ["lp", "low", "s2"], bonus: 1.25 },
        ],
        blurb: "Soaks hits, walks through jabs, and throws people around.",
      };
    default:
      return {
        s1: shot("s1", "Hero Shot", energy, 50),
        s2: riser("s2", "Rising Strike", fx, 64),
        s3: lungeStrike("s3", "Leaping Strike", fx, 74, { lunge: { vx: 12, vy: 9, from: 6, frames: 12 }, overhead: true, pose: "dash" }),
        ult: rush("ult", "Hero Rush", fx, 28, 40),
        passive: PASSIVES.counter,
        combos: [
          { name: "Hero Combo", seq: ["lp", "lp", "hp"], bonus: 1.25 },
          { name: "Leap of Faith", seq: ["lp", "hp", "s3"], bonus: 1.3 },
        ],
        blurb: "A bit of everything — a solid pick for anyone.",
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Signature kits — hand-tuned fighters (by dataset name)             */
/* ------------------------------------------------------------------ */
export const SIGNATURE_KITS: Record<string, Kit> = {
  "Spider-Man": {
    s1: shot("s1", "Web Pull", "web", 34, { pull: true, speed: 17 }, { sfx: "web", cooldown: 60 }),
    s2: shot("s2", "Web Trap", "web", 22, { ground: true, trap: 70, speed: 10, w: 56, h: 30, offset: { x: 50, y: 8 } }, { sfx: "web", cooldown: 150 }),
    s3: lungeStrike("s3", "Web Swing Kick", "web", 78, { lunge: { vx: 15, vy: 7, from: 5, frames: 16 }, pose: "airKick", sfx: "web" }),
    ult: rush("ult", "Maximum Spider", "web", 26, 46, { rehit: 4, lunge: { vx: 10, vy: 4, from: 8, frames: 12 } }),
    passive: PASSIVES.spiderSense,
    combos: [
      { name: "Spidey Flurry", seq: ["lp", "lp", "kick"], bonus: 1.25 },
      { name: "Thwip Combo", seq: ["lp", "kick", "s1"], bonus: 1.3 },
      { name: "Wall-Crawler Special", seq: ["kick", "launcher", "s3"], bonus: 1.35 },
    ],
    blurb: "Webs, wall-crawler agility and a double jump.",
    normals: { lp: { name: "Quick Jab" }, kick: { name: "Spin Kick" } },
  },
  Hulk: {
    s1: shot("s1", "Thunder Clap", "ground", 66, { speed: 11, w: 80, h: 120, life: 45, offset: { x: 60, y: 30 } }, { sfx: "smash", pose: "cast", startup: 14 }),
    s2: slam("s2", "Ground Smash", "ground", 96, { hitbox: { x: 0, y: 0, w: 320, h: 64 } }),
    s3: lungeStrike("s3", "Gamma Charge", "punch", 88, { armor: true, lunge: { vx: 14, from: 6, frames: 18 }, knockback: { x: 16, y: 6 } }),
    ult: mv({ id: "ult", name: "World Breaker", kind: "ultimate", pose: "slam", startup: 18, active: 28, recovery: 28, damage: 72, hitstun: 32, blockstun: 14, guard: 24, knockback: { x: 7, y: 14 }, launch: true, rehit: 7, armor: true, cost: 100, cinematic: true, lunge: { vx: 9, vy: 18, from: 6, frames: 12 }, hitbox: { x: 20, y: 0, w: 480, h: 100 }, meter: 0, fx: "ground", sfx: "super" }),
    passive: PASSIVES.rage,
    combos: [
      { name: "HULK SMASH", seq: ["lp", "hp", "s2"], bonus: 1.35 },
      { name: "Gamma Pummel", seq: ["hp", "hp", "s3"], bonus: 1.3 },
    ],
    blurb: "The strongest one there is. Slow, huge, and furious when hurt.",
    normals: { hp: { name: "Giant Punch" }, lp: { name: "Backhand" } },
  },
  Wolverine: {
    s1: lungeStrike("s1", "Claw Lunge", "claw", 72, { lunge: { vx: 17, from: 4, frames: 10 }, sfx: "slash", pose: "claw" }),
    s2: buff("s2", "Berserker Rage", "rage", 420, { heal: 0.04, sfx: "heal", cooldown: 900 }),
    s3: mv({ id: "s3", name: "Rapid Claws", kind: "special", pose: "claw", startup: 6, active: 22, recovery: 18, damage: 20, hitstun: 16, blockstun: 8, guard: 7, knockback: { x: 2, y: 0 }, rehit: 5, lunge: { vx: 4, from: 4, frames: 18 }, hitbox: { x: 56, y: 60, w: 86, h: 90 }, meter: 3, cooldown: 80, fx: "claw", sfx: "slash" }),
    ult: rush("ult", "Berserker Barrage", "claw", 27, 44, { rehit: 4, sfx: "super" }),
    passive: PASSIVES.regen,
    combos: [
      { name: "Snikt Combo", seq: ["lp", "lp", "s3"], bonus: 1.3 },
      { name: "Feral Fury", seq: ["lp", "hp", "s1"], bonus: 1.3 },
    ],
    blurb: "Claws out, healing factor on. Aggressive and hard to put down.",
    normals: { lp: { name: "Claw Jab", fx: "claw", sfx: "slash" }, hp: { name: "Claw Slash", fx: "claw", sfx: "slash", pose: "claw" } },
  },
  "Iron Man": {
    s1: shot("s1", "Repulsor Blast", "repulsor", 54, { speed: 17 }, { sfx: "zap", cooldown: 55 }),
    s2: buff("s2", "Energy Shield", "shield", 260, { sfx: "zap", cooldown: 720 }),
    s3: mv({ id: "s3", name: "Micro Missiles", kind: "special", pose: "cast", startup: 12, active: 16, recovery: 20, damage: 28, hitstun: 18, blockstun: 10, guard: 8, knockback: { x: 4, y: 3 }, meter: 4, cooldown: 140, fx: "missile", sfx: "gun", volley: { count: 3, every: 6, from: "self", spec: proj({ fx: "missile", speed: 11, homing: 0.22, life: 80, w: 34, h: 18, offset: { x: 40, y: 130 } }) } }),
    ult: beamUlt("ult", "Unibeam", "beam", 34),
    passive: PASSIVES.flight,
    combos: [
      { name: "Armored Assault", seq: ["lp", "hp", "s1"], bonus: 1.3 },
      { name: "Full Payload", seq: ["kick", "hp", "s3"], bonus: 1.3 },
    ],
    blurb: "Flying zoner. Repulsors, missiles and one very big beam.",
    normals: { hp: { name: "Gauntlet Punch" } },
  },
  Thor: {
    s1: shot("s1", "Hammer Throw", "hammer", 62, { returns: true, speed: 15, life: 70, hits: 2 }, { sfx: "heavy", pose: "toss", cooldown: 80 }),
    s2: sky("s2", "Lightning Strike", "lightning", 82, 1, 6, { cooldown: 110 }),
    s3: lungeStrike("s3", "Flying Hammer", "hammer", 86, { lunge: { vx: 15, vy: 8, from: 5, frames: 18 }, sfx: "lightning" }),
    ult: sky("ult", "God of Thunder", "lightning", 40, 7, 6, { kind: "ultimate", cost: 100, cinematic: true, cooldown: 0, meter: 0, sfx: "super", startup: 16 }),
    passive: PASSIVES.armor,
    combos: [
      { name: "Thunder Combo", seq: ["lp", "hp", "s2"], bonus: 1.3 },
      { name: "Worthy Strike", seq: ["hp", "kick", "s3"], bonus: 1.3 },
    ],
    blurb: "Hammer, lightning and the strength of a god.",
    normals: { hp: { name: "Hammer Swing", fx: "hammer" } },
  },
  "Captain America": {
    s1: shot("s1", "Shield Throw", "shield", 54, { returns: true, hits: 2, speed: 14 }, { sfx: "heavy", pose: "toss", cooldown: 70 }),
    s2: counterStance("s2", "Shield Counter", "shield", 88),
    s3: lungeStrike("s3", "Shield Bash", "shield", 72, { guard: 34, knockdown: false, knockback: { x: 13, y: 2 }, lunge: { vx: 12, from: 5, frames: 10 } }),
    ult: rush("ult", "Star-Spangled Barrage", "shield", 27, 42),
    passive: PASSIVES.counter,
    combos: [
      { name: "Super-Soldier Combo", seq: ["lp", "lp", "hp"], bonus: 1.25 },
      { name: "Shield Rebound", seq: ["lp", "kick", "s1"], bonus: 1.3 },
    ],
    blurb: "Shield first. Blocks, parries and counters you into the floor.",
  },
  "Black Panther": {
    s1: shot("s1", "Kinetic Blast", "kinetic", 50, { speed: 13 }, { sfx: "zap" }),
    s2: buff("s2", "Vibranium Absorb", "shield", 220, { cooldown: 640, fx: "kinetic" }),
    s3: lungeStrike("s3", "Panther Pounce", "claw", 74, { lunge: { vx: 16, vy: 9, from: 5, frames: 16 }, overhead: true, pose: "claw", sfx: "slash" }),
    ult: rush("ult", "Wakandan Fury", "claw", 26, 44, { rehit: 4 }),
    passive: PASSIVES.meterGain,
    combos: [
      { name: "Panther Claws", seq: ["lp", "lp", "s3"], bonus: 1.3 },
      { name: "Kinetic Release", seq: ["lp", "hp", "s1"], bonus: 1.3 },
    ],
    blurb: "Quick claws and a suit that turns hits into power.",
    normals: { lp: { name: "Claw Jab", fx: "claw", sfx: "slash" }, hp: { name: "Vibranium Slash", fx: "claw", sfx: "slash", pose: "claw" } },
  },
  "Doctor Strange": {
    s1: shot("s1", "Bolts of Bedevilment", "magic", 50, { speed: 13 }, { sfx: "magic" }),
    s2: buff("s2", "Shield of the Seraphim", "shield", 300, { sfx: "magic", cooldown: 700, fx: "magic" }),
    s3: mv({ id: "s3", name: "Portal Step", kind: "special", pose: "cast", startup: 8, active: 6, recovery: 14, damage: 60, hitstun: 22, blockstun: 12, guard: 12, knockback: { x: 8, y: 4 }, teleport: "behind", invuln: [0, 10], hitbox: { x: 50, y: 60, w: 90, h: 100 }, meter: 8, cooldown: 100, fx: "magic", sfx: "magic" }),
    ult: mv({ id: "ult", name: "Eye of Agamotto", kind: "ultimate", pose: "cast", startup: 16, active: 42, recovery: 26, damage: 36, hitstun: 22, blockstun: 10, guard: 8, knockback: { x: 2, y: 3 }, rehit: 6, cost: 100, cinematic: true, hitbox: { x: 120, y: 0, w: 640, h: 260 }, meter: 0, fx: "magic", sfx: "super" }),
    passive: PASSIVES.meterGain,
    combos: [
      { name: "Mystic Arts", seq: ["lp", "hp", "s1"], bonus: 1.3 },
      { name: "Sorcerer's Snare", seq: ["kick", "lp", "s3"], bonus: 1.3 },
    ],
    blurb: "Spells, portals and shields. Controls the whole screen.",
  },
  Deadpool: {
    s1: mv({ id: "s1", name: "Pistol Pop", kind: "special", pose: "cast", startup: 8, active: 14, recovery: 16, damage: 22, hitstun: 14, blockstun: 8, guard: 6, knockback: { x: 2, y: 0 }, meter: 4, cooldown: 70, fx: "bullet", sfx: "gun", volley: { count: 3, every: 5, from: "self", spec: proj({ fx: "bullet", speed: 24, w: 20, h: 10, life: 40, offset: { x: 50, y: 110 } }) } }),
    s2: mv({ id: "s2", name: "Bamf! Teleport", kind: "special", pose: "kick", startup: 6, active: 6, recovery: 14, damage: 56, hitstun: 22, blockstun: 12, guard: 12, knockback: { x: 9, y: 3 }, teleport: "behind", invuln: [0, 9], hitbox: { x: 56, y: 50, w: 90, h: 90 }, meter: 8, cooldown: 100, fx: "sword", sfx: "dodge" }),
    s3: mv({ id: "s3", name: "Katana Dance", kind: "special", pose: "spin", startup: 6, active: 22, recovery: 18, damage: 20, hitstun: 16, blockstun: 8, guard: 7, knockback: { x: 2, y: 0 }, rehit: 5, lunge: { vx: 5, from: 4, frames: 18 }, hitbox: { x: 40, y: 50, w: 140, h: 100 }, meter: 3, cooldown: 80, fx: "sword", sfx: "slash" }),
    ult: rush("ult", "Maximum Effort", "sword", 26, 46, { rehit: 4 }),
    passive: PASSIVES.regen,
    combos: [
      { name: "Chimichanga Combo", seq: ["lp", "lp", "s3"], bonus: 1.3 },
      { name: "Fourth Wall Break", seq: ["kick", "hp", "s1"], bonus: 1.35 },
    ],
    blurb: "Swords, guns, teleports and a healing factor. Pure chaos.",
    normals: { hp: { name: "Katana Slash", fx: "sword", sfx: "slash" } },
  },
  Venom: {
    s1: shot("s1", "Tendril Snare", "symbiote", 40, { pull: true, speed: 16 }, { sfx: "web" }),
    s2: slam("s2", "Symbiote Spikes", "symbiote", 84, { hitbox: { x: 20, y: 0, w: 260, h: 90 }, sfx: "slash" }),
    s3: lungeStrike("s3", "Venom Pounce", "symbiote", 80, { lunge: { vx: 15, vy: 8, from: 5, frames: 16 }, overhead: true, pose: "claw" }),
    ult: rush("ult", "We Are Venom", "symbiote", 28, 44),
    passive: PASSIVES.rage,
    combos: [
      { name: "Lethal Protector", seq: ["lp", "hp", "s1"], bonus: 1.3 },
      { name: "Feeding Frenzy", seq: ["lp", "lp", "s3"], bonus: 1.3 },
    ],
    blurb: "Symbiote tendrils that drag you in for a beating.",
    normals: { hp: { name: "Tendril Lash", fx: "symbiote" } },
  },
  Magneto: {
    s1: shot("s1", "Magnetic Pulse", "magnet", 54, { speed: 12, w: 60, h: 60 }, { sfx: "zap" }),
    s2: sky("s2", "Metal Rain", "magnet", 32, 4, 6, { sfx: "smash" }),
    s3: shot("s3", "Polarity Pull", "magnet", 36, { pull: true, speed: 18, life: 50 }, { sfx: "zap", cooldown: 90 }),
    ult: sky("ult", "Master of Magnetism", "magnet", 36, 8, 5, { kind: "ultimate", cost: 100, cinematic: true, cooldown: 0, meter: 0, sfx: "super", startup: 16 }),
    passive: PASSIVES.flight,
    combos: [
      { name: "Polarity Shift", seq: ["lp", "hp", "s3"], bonus: 1.3 },
      { name: "Iron Storm", seq: ["kick", "hp", "s2"], bonus: 1.3 },
    ],
    blurb: "Floats above the fight and drops scrap metal on your head.",
  },
  Thanos: {
    s1: shot("s1", "Titan Beam", "cosmic", 60, { speed: 15, w: 60, h: 30 }, { sfx: "energy" }),
    s2: slam("s2", "Gauntlet Slam", "cosmic", 94),
    s3: lungeStrike("s3", "Mad Titan Charge", "punch", 88, { armor: true, knockback: { x: 15, y: 6 } }),
    ult: mv({ id: "ult", name: "Cosmic Snap", kind: "ultimate", pose: "cast", startup: 18, active: 36, recovery: 28, damage: 44, hitstun: 26, blockstun: 12, guard: 12, knockback: { x: 3, y: 5 }, rehit: 6, cost: 100, cinematic: true, hitbox: { x: 140, y: 0, w: 720, h: 280 }, meter: 0, fx: "cosmic", sfx: "super" }),
    passive: PASSIVES.armor,
    combos: [
      { name: "Inevitable", seq: ["lp", "hp", "s2"], bonus: 1.3 },
      { name: "Titan Crush", seq: ["hp", "hp", "s3"], bonus: 1.3 },
    ],
    blurb: "Slow, armored and devastating. Every hit hurts.",
  },
};

export const SIGNATURE_NAMES = Object.keys(SIGNATURE_KITS);

/** Which slot a move id belongs to (used by combo matching) */
export const SLOT_ORDER: MoveSlot[] = ["lp", "hp", "kick", "low", "launcher", "air", "throw", "s1", "s2", "s3", "ult"];
