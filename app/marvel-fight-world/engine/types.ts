/* ------------------------------------------------------------------ */
/*  Fight World — engine types (DOM-free; shared by sim, AI, renderer)  */
/*                                                                      */
/*  Units: world pixels. x = 0 is stage centre, y = 0 is the floor and  */
/*  grows upward. Time is measured in simulation frames (60 per second).*/
/* ------------------------------------------------------------------ */

export const SIM_HZ = 60;

/* ── Input ─────────────────────────────────────────────────────────── */
export const ACTIONS = ["left", "right", "up", "down", "lp", "hp", "kick", "special", "block", "ult"] as const;
export type Action = (typeof ACTIONS)[number];
/** Held state of every action for one fighter on one frame. */
export type InputFrame = Record<Action, boolean>;
export const emptyInput = (): InputFrame => ({
  left: false,
  right: false,
  up: false,
  down: false,
  lp: false,
  hp: false,
  kick: false,
  special: false,
  block: false,
  ult: false,
});

/* ── Stats / archetypes ────────────────────────────────────────────── */
export const STAT_KEYS = ["intelligence", "strength", "speed", "durability", "power", "combat"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export type Archetype = "brawler" | "speed" | "technical" | "power" | "tank" | "balanced";
export type Alignment = "good" | "bad" | "neutral";

/* ── Visual / audio hooks (engine only names them) ─────────────────── */
export type FxKind =
  | "punch"
  | "claw"
  | "web"
  | "energy"
  | "lightning"
  | "fire"
  | "magic"
  | "shield"
  | "hammer"
  | "repulsor"
  | "missile"
  | "kinetic"
  | "magnet"
  | "cosmic"
  | "symbiote"
  | "sword"
  | "bullet"
  | "ground"
  | "beam";

export type SfxKey =
  | "jab"
  | "heavy"
  | "kick"
  | "whoosh"
  | "block"
  | "jump"
  | "land"
  | "throw"
  | "energy"
  | "lightning"
  | "explosion"
  | "web"
  | "slash"
  | "zap"
  | "magic"
  | "smash"
  | "gun"
  | "ko"
  | "super"
  | "dodge"
  | "heal"
  | "guardBreak";

export type Pose =
  | "jab"
  | "cross"
  | "uppercut"
  | "kick"
  | "lowKick"
  | "lowJab"
  | "airKick"
  | "airPunch"
  | "throw"
  | "cast"
  | "slam"
  | "dash"
  | "spin"
  | "rise"
  | "beam"
  | "toss"
  | "claw"
  | "counter";

/** Axis-aligned box relative to the fighter: x = forward offset of the box centre, y = height of the box bottom. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectileSpec {
  /** Horizontal speed (px/frame), in the fighter's facing direction */
  speed: number;
  /** Vertical speed (px/frame); negative falls */
  vy?: number;
  /** Gravity applied each frame (arcing throws) */
  gravity?: number;
  w: number;
  h: number;
  /** Lifetime in frames */
  life: number;
  fx: FxKind;
  /** Spawn offset (forward, up) from the fighter */
  offset?: { x: number; y: number };
  /** Number of times it can hit before disappearing */
  hits?: number;
  /** Boomerang: comes back to the thrower */
  returns?: boolean;
  /** Pulls the victim toward the thrower on hit */
  pull?: boolean;
  /** Freezes the victim in place for N frames (web trap) */
  trap?: number;
  /** Travels along the floor */
  ground?: boolean;
  /** Homes toward the opponent's x a little each frame */
  homing?: number;
}

export type MoveKind = "light" | "heavy" | "kick" | "low" | "launcher" | "air" | "throw" | "special" | "ultimate";

export interface MoveData {
  id: string;
  name: string;
  kind: MoveKind;
  pose: Pose;
  /** Frame data */
  startup: number;
  active: number;
  recovery: number;
  /** Base damage before the balancing layer (see stats.ts) */
  damage: number;
  hitstun: number;
  blockstun: number;
  /** Guard meter damage when blocked */
  guard: number;
  knockback: { x: number; y: number };
  launch?: boolean;
  knockdown?: boolean;
  /** Melee hitbox */
  hitbox?: Box;
  /** Fired once when the move becomes active */
  projectile?: ProjectileSpec;
  /** Fires several projectiles over the active window (storms, barrages) */
  volley?: { count: number; every: number; from: "self" | "sky"; spec: ProjectileSpec };
  /** Melee hits re-trigger every `rehit` frames during the active window */
  rehit?: number;
  /** Self movement while the move runs (applied from `from` frame for `frames`) */
  lunge?: { vx: number; vy?: number; from?: number; frames?: number };
  /** Invulnerable between these move frames */
  invuln?: [number, number];
  /** Takes hits without flinching while active (super armor) */
  armor?: boolean;
  low?: boolean;
  overhead?: boolean;
  unblockable?: boolean;
  /** Meter gained on hit (half on block) */
  meter: number;
  /** Meter cost (ultimates cost 100) */
  cost?: number;
  /** Frames before the move can be used again (specials) */
  cooldown?: number;
  fx: FxKind;
  sfx: SfxKey;
  /** Ultimate presentation: super-flash freeze + camera zoom */
  cinematic?: boolean;
  /** Heals the user (fraction of max health) when the move starts */
  heal?: number;
  /** Relocate when the move becomes active */
  teleport?: "behind" | "away";
  /** Counter stance: if struck during the active window, cancel the hit and riposte */
  counter?: boolean;
  /** Grants a timed buff when the move starts */
  buff?: { kind: "rage" | "shield"; frames: number };
  /** Throws: max distance between fighters */
  grabRange?: number;
}

export type PassiveId = "rage" | "regen" | "doubleJump" | "armor" | "counter" | "meterGain" | "spiderSense" | "flight" | "none";

export interface Passive {
  id: PassiveId;
  name: string;
  desc: string;
}

export interface ComboDef {
  name: string;
  /** Sequence of move slot ids, e.g. ["lp", "lp", "kick"] */
  seq: MoveSlot[];
  /** Extra damage multiplier for the finishing hit */
  bonus: number;
}

export type MoveSlot = "lp" | "hp" | "kick" | "low" | "launcher" | "air" | "throw" | "s1" | "s2" | "s3" | "ult";

export interface Look {
  /** Body width multiplier (Hulk ~1.35) */
  bulk: number;
  /** Height multiplier */
  height: number;
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
  cape?: string;
  claws?: string;
  shield?: boolean;
  hammer?: boolean;
  swords?: boolean;
  reactor?: boolean;
  webLines?: boolean;
  emblem?: string;
  glow?: string;
}

export interface FighterDef {
  /** Dataset id */
  id: number;
  name: string;
  realName: string;
  alignment: Alignment;
  portrait: { xs: string; sm: string; md: string; lg: string };
  stats: Stats;
  archetype: Archetype;
  /** Hand-tuned fighter (true) or archetype-generated (false) */
  custom: boolean;
  /** Derived, balanced numbers */
  maxHealth: number;
  walk: number;
  run: number;
  jump: number;
  airJumps: number;
  /** Knockback resistance (1 = normal) */
  weight: number;
  /** Incoming damage multiplier */
  defense: number;
  /** Physical / special damage multipliers */
  physMul: number;
  powerMul: number;
  /** Extra cancel window frames (combat stat) */
  cancelWindow: number;
  /** Special cooldown multiplier (intelligence) */
  cooldownMul: number;
  width: number;
  height: number;
  look: Look;
  moves: Record<MoveSlot, MoveData>;
  passive: Passive;
  combos: ComboDef[];
  /** One-line summary of the fighting style */
  blurb: string;
}

/* ── Fighter state machine ─────────────────────────────────────────── */
export type FighterState =
  | "idle"
  | "walk"
  | "run"
  | "jumpSquat"
  | "air"
  | "crouch"
  | "attack"
  | "block"
  | "crouchBlock"
  | "blockstun"
  | "hit"
  | "launched"
  | "knockdown"
  | "getup"
  | "dizzy"
  | "trapped"
  | "dodge"
  | "thrown"
  | "victory"
  | "defeated";

/* ── Match events (consumed by renderer / audio / UI) ──────────────── */
export type MatchEvent =
  | { type: "hit"; x: number; y: number; fx: FxKind; power: number; attacker: number; blocked: boolean; counter: boolean; damage: number }
  | { type: "sfx"; key: SfxKey; volume?: number }
  | { type: "combo"; player: number; hits: number; label?: string }
  | { type: "text"; text: string; player?: number; big?: boolean }
  | { type: "shake"; amount: number }
  | { type: "super"; player: number; move: string }
  | { type: "ko"; winner: number; loser: number }
  | { type: "round"; round: number }
  | { type: "fight" }
  | { type: "roundOver"; winner: number | null; perfect: boolean; timeOver: boolean }
  | { type: "matchOver"; winner: number | null }
  | { type: "dust"; x: number; y: number }
  | { type: "heal"; player: number }
  | { type: "propBreak"; x: number; y: number; w: number; h: number };
