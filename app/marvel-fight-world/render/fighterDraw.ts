/* ------------------------------------------------------------------ */
/*  Procedural fighter: a skeletal rig posed per state/move, drawn as   */
/*  inked, shaded limbs with the character's portrait as the head.      */
/*                                                                      */
/*  Angles are degrees. Limbs: 0° points straight down, positive        */
/*  rotates forward (toward the opponent). Torso: 0° is upright.        */
/* ------------------------------------------------------------------ */

import type { Fighter } from "../engine/fighter";
import type { Pose } from "../engine/types";
import { clamp, easeOut, easeOutBack, glow, lerp, shade, withAlpha } from "./util";
import {
  INK as BODY_INK,
  boot,
  drawCape,
  drawHair,
  drawHeadgear,
  drawHeadShape,
  fist,
  limb,
  paintGroup,
  drawNeck,
  drawTorso,
  flashPaths,
  silhouetteFill,
  torsoFrame,
  type LimbProfile,
  type Paint,
  type TorsoFrame,
  type V,
} from "./body";
import { costumeFor } from "./costume";

export interface Joints {
  lean: number;
  head: number;
  fU: number; // front upper arm
  fF: number; // front forearm
  bU: number; // back upper arm
  bF: number;
  fT: number; // front thigh
  fS: number; // front shin
  bT: number;
  bS: number;
  /** Whole-body rotation around the hip (launches, knockdowns) */
  rot: number;
  /** Extra hip drop (0..1 of leg length) for crouching poses that don't solve from feet */
  drop: number;
}

const STANCE: Joints = { lean: 8, head: 0, fU: 38, fF: 132, bU: 18, bF: 150, fT: 16, fS: -8, bT: -16, bS: -26, rot: 0, drop: 0 };
const CROUCH: Partial<Joints> = { lean: 20, fT: 78, fS: -30, bT: 34, bS: -72 };
const BLOCK_ARMS: Partial<Joints> = { fU: 78, fF: 168, bU: 66, bF: 160, lean: -4, head: -6 };

type Key = Partial<Joints>;
const ATTACK: Record<Pose, { w: Key; s: Key; crouch?: boolean }> = {
  jab: { w: { fU: 28, fF: 150 }, s: { fU: 88, fF: 92, lean: 14 } },
  cross: { w: { bU: -8, bF: 120, lean: -2 }, s: { bU: 90, bF: 90, lean: 24, fU: 18, fF: 140, fT: 32, bT: -34 } },
  uppercut: { w: { fU: 20, fF: 60, lean: 24, fT: 50, fS: -20 }, s: { fU: 168, fF: 176, lean: -10, fT: 20, bT: -10 } },
  kick: { w: { fT: 72, fS: -12, lean: -6 }, s: { fT: 96, fS: 96, lean: -20, bT: -6, bS: -12, fU: 18, fF: 100 } },
  lowKick: { w: { fT: 62, fS: 20 }, s: { fT: 86, fS: 90, lean: 24, bT: 60, bS: -70 }, crouch: true },
  lowJab: { w: { fU: 28, fF: 150 }, s: { fU: 85, fF: 88, lean: 18 }, crouch: true },
  airKick: { w: { fT: 40, fS: -30, bT: 60, bS: -40 }, s: { fT: 62, fS: 56, bT: 72, bS: -28, lean: -12 } },
  airPunch: { w: { fU: 120, fF: 170 }, s: { fU: 60, fF: 45, lean: 22 } },
  throw: { w: { fU: 76, fF: 86, bU: 70, bF: 86, lean: 14 }, s: { fU: 160, fF: 170, bU: 150, bF: 168, lean: -16 } },
  cast: { w: { fU: 20, fF: 100, bU: 10, bF: 100, lean: -4 }, s: { fU: 88, fF: 86, bU: 82, bF: 86, lean: 12 } },
  slam: { w: { fU: 172, fF: 178, bU: 166, bF: 178, lean: -12 }, s: { fU: 52, fF: 12, bU: 46, bF: 8, lean: 42, fT: 70, fS: -30, bT: 20, bS: -70 } },
  dash: { w: { lean: 30, fU: 40, fF: 130 }, s: { lean: 36, fU: 88, fF: 92, bU: -32, bF: -10, fT: 52, fS: -8, bT: -42, bS: -62 } },
  spin: { w: { fU: 90, fF: 90, bU: -90, bF: -90, lean: 10 }, s: { fU: 95, fF: 95, bU: 95, bF: 95, lean: 14 } },
  rise: { w: { fU: 30, fF: 60, lean: 20 }, s: { fU: 172, fF: 178, fT: 72, fS: -22, bT: 18, bS: -62, lean: -6 } },
  beam: { w: { fU: -20, fF: -10, bU: -25, bF: -10, lean: -6 }, s: { fU: -38, fF: -30, bU: -42, bF: -34, lean: -16, head: -10 } },
  toss: { w: { fU: -70, fF: -100, lean: -12 }, s: { fU: 106, fF: 100, lean: 24 } },
  claw: { w: { fU: 152, fF: 172, lean: -2 }, s: { fU: 52, fF: 24, lean: 26, bU: 70, bF: 130 } },
  counter: { w: { fU: 70, fF: 112, bU: 60, bF: 122 }, s: { fU: 82, fF: 112, bU: 72, bF: 124, lean: 4 } },
};

function mix(a: Joints, b: Key, t: number): Joints {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof Joints)[]) out[k] = lerp(a[k], b[k]!, t);
  return out;
}

const sinD = (d: number) => Math.sin((d * Math.PI) / 180);
const cosD = (d: number) => Math.cos((d * Math.PI) / 180);

/* ── Pose selection ────────────────────────────────────────────────── */
/**
 * Fighting stance per archetype — how a hero *stands* sells who they are:
 * speedsters crouch low and springy (Spider-Man), powerhouses hunch wide
 * with heavy fists (Hulk), brawlers keep a tight boxer's guard, technical
 * fighters stand side-on with a palm forward.
 */
const STANCES: Record<string, Key> = {
  speed: { lean: 20, fT: 34, fS: -34, bT: -8, bS: -56, fU: 62, fF: 112, bU: -24, bF: 52, head: 6 },
  power: { lean: 16, fT: 24, fS: -14, bT: -24, bS: -36, fU: 30, fF: 76, bU: 22, bF: 66, head: 4 },
  tank: { lean: 18, fT: 26, fS: -16, bT: -26, bS: -38, fU: 28, fF: 70, bU: 24, bF: 62, head: 6 },
  brawler: { lean: 10, fT: 20, fS: -10, bT: -20, bS: -30, fU: 42, fF: 142, bU: 28, bF: 150 },
  technical: { lean: 2, fT: 12, fS: -4, bT: -14, bS: -20, fU: 72, fF: 96, bU: 8, bF: 124 },
  balanced: {},
};

/** Signature victory poses (fallback by archetype). */
function victoryPose(f: Fighter, t: number): Key {
  const bob = Math.sin(t * 6) * 6;
  switch (f.def.name) {
    case "Hulk":
      return { fU: 100, fF: 175 + bob, bU: 100, bF: 175 - bob, lean: -8, head: -18, fT: 26, bT: -26 }; // double-biceps roar
    case "Captain America":
      return { bU: 125, bF: 172, fU: 10, fF: 110, lean: -4, head: -6 }; // shield raised
    case "Spider-Man":
      return { ...CROUCH, lean: 30, fU: 10, fF: 4, bU: 120, bF: 150 + bob, head: 10 }; // perched spider pose
    case "Iron Man":
      return { fU: 92, fF: 90, bU: 20, bF: 40, lean: -2 }; // repulsor aim
    case "Doctor Strange":
      return { fU: 70, fF: 160, bU: 60, bF: 150 + bob, lean: -2 }; // casting hands
  }
  switch (f.def.archetype) {
    case "power":
    case "tank":
      return { fU: 100, fF: 175 + bob, bU: 100, bF: 175 - bob, lean: -6, head: -10 };
    case "speed":
      return { ...CROUCH, lean: 24, fU: 172, fF: 178 + bob, bU: -20, bF: 40 };
    case "technical":
      return { fU: 64, fF: 150, bU: 60, bF: 150, lean: -4 }; // arms folded
    default:
      return { fU: 172, fF: 178 + bob, bU: 14, bF: 140, lean: -6, head: -6 };
  }
}

/** Per-fighter animation memory (smoothing, flips, landings). */
interface Memory {
  j: Joints;
  t: number;
  airJumps: number;
  flipAt: number;
  flipDir: number;
  peakY: number;
  wasAir: boolean;
  landAt: number;
}
const memory = new WeakMap<Fighter, Memory>();

export function poseFor(f: Fighter, t: number): Joints {
  let m = memory.get(f);
  if (m && m.t === t) return m.j; // same frame (afterimages ask again)
  const raw = rawPose(f, t, m);
  if (!m) {
    m = { j: raw, t, airJumps: f.airJumpsLeft, flipAt: -1, flipDir: 1, peakY: 0, wasAir: false, landAt: -1 };
    memory.set(f, m);
    return raw;
  }
  // Critically-damped style smoothing: crisp for strikes and hits, fluid otherwise
  const dt = t - m.t;
  m.t = t;
  if (dt <= 0 || dt > 0.25) {
    m.j = raw;
    return raw;
  }
  const rate = f.state === "attack" ? 38 : f.state === "hit" || f.state === "launched" || f.state === "thrown" || f.state === "blockstun" ? 30 : 15;
  const a = 1 - Math.exp(-rate * dt);
  const out = { ...raw };
  for (const k of Object.keys(raw) as (keyof Joints)[]) {
    if (k === "rot") continue; // flips / spins stay exact
    out[k] = lerp(m.j[k], raw[k], a);
  }
  m.j = out;
  return out;
}

function rawPose(f: Fighter, t: number, mem: Memory | undefined): Joints {
  const st = f.stateTime;
  const arch = f.def.archetype;
  // Archetype stance + a rhythmic fighter's bounce (knees + guard)
  const stance = mix({ ...STANCE }, STANCES[arch] ?? {}, 1);
  const bounce = (Math.sin(t * 5.2 + f.index * 1.7) + 1) / 2;
  const breathe = Math.sin(t * 2.6 + f.index) * 2;
  let j: Joints = {
    ...stance,
    lean: stance.lean + breathe * 0.5,
    fT: stance.fT + bounce * 7,
    fS: stance.fS - bounce * 11,
    bT: stance.bT + bounce * 5,
    bS: stance.bS - bounce * 10,
    fF: stance.fF + bounce * 5,
    bF: stance.bF - bounce * 4,
  };

  // Airborne tracking for flips and superhero landings
  const airborne = f.y > 1;
  if (mem) {
    if (airborne) {
      mem.peakY = mem.wasAir ? Math.max(mem.peakY, f.y) : f.y;
      // Double jump (or a speedster's forward leap) → front flip
      const usedAirJump = f.airJumpsLeft < mem.airJumps;
      const forwardLeap = !mem.wasAir && arch === "speed" && f.vx * f.facing > 2;
      if (usedAirJump || forwardLeap) {
        mem.flipAt = t;
        mem.flipDir = 1;
      }
    } else if (mem.wasAir) {
      if (mem.peakY > 120 && (f.state === "idle" || f.state === "walk" || f.state === "crouch" || f.state === "run")) mem.landAt = t;
      mem.peakY = 0;
    }
    mem.wasAir = airborne;
    mem.airJumps = f.airJumpsLeft;
  }

  switch (f.state) {
    case "walk": {
      const ph = f.x * 0.05 * f.facing;
      const s = Math.sin(ph);
      j = mix(j, { fT: 8 + s * 28, bT: 8 - s * 28, fS: 8 + s * 28 - 14 - Math.max(0, -s) * 34, bS: 8 - s * 28 - 14 - Math.max(0, s) * 34, fU: j.fU - s * 10, bU: j.bU + s * 10 }, 1);
      break;
    }
    case "run": {
      const ph = f.x * 0.045 * f.facing;
      const s = Math.sin(ph);
      const legs = { fT: 14 + s * 50, bT: 14 - s * 50, fS: -10 - Math.max(0, -s) * 66, bS: -10 - Math.max(0, s) * 66 };
      // Speedsters sprint like heroes (arms swept back); others pump their arms
      j = arch === "speed" ? mix(j, { lean: 38, ...legs, fU: -48, fF: -20, bU: -58, bF: -30, head: -8 }, 1) : mix(j, { lean: 26, ...legs, fU: 40 - s * 50, fF: 120, bU: 20 + s * 50, bF: 110 }, 1);
      break;
    }
    case "jumpSquat":
      j = mix(j, { ...CROUCH, lean: 16, fU: 20, bU: -30 }, 0.8);
      break;
    case "air": {
      j = f.vy > 0 ? mix(j, { fT: 62, fS: -40, bT: 22, bS: -72, fU: 70, fF: 140, bU: 40, bF: 130 }, 1) : mix(j, { fT: 26, fS: 4, bT: -10, bS: -26, fU: 60, fF: 110, bU: -20, bF: 40 }, 1);
      if (f.def.passive.id === "flight" && f.hoverFrames > 0) j = mix(j, { fT: 10, fS: 0, bT: -6, bS: -6, lean: 4, fU: 80, fF: 90 }, 0.8);
      // Front flip: tuck tight and rotate a full turn
      if (mem && mem.flipAt >= 0) {
        const k = (t - mem.flipAt) / 0.5;
        if (k < 1) {
          j = mix(j, { fT: 100, fS: -120, bT: 90, bS: -125, fU: 80, fF: 60, bU: 70, bF: 60, lean: 20 }, Math.sin(Math.PI * k));
          j.rot = 360 * easeOut(k);
        }
      }
      break;
    }
    case "crouch":
      j = mix(j, CROUCH, 1);
      break;
    case "block":
      j = mix(j, BLOCK_ARMS, 1);
      break;
    case "crouchBlock":
      j = mix(mix(j, CROUCH, 1), BLOCK_ARMS, 1);
      break;
    case "blockstun":
      j = mix(mix(j, BLOCK_ARMS, 1), { lean: -14 }, Math.max(0, 1 - st / 10));
      break;
    case "hit": {
      const k = Math.max(0, 1 - st / 16);
      j = mix(j, { lean: -30, head: -26, fU: -24, fF: 10, bU: -14, bF: 20, fT: 6, bT: -28 }, 0.35 + k * 0.65);
      break;
    }
    case "dizzy":
      j = mix(j, { lean: Math.sin(t * 5) * 14, head: Math.sin(t * 7) * 18, fU: 8, fF: 20, bU: 6, bF: 18 }, 1);
      break;
    case "trapped":
      j = mix(j, { fU: 4, fF: 6, bU: 4, bF: 6, fT: 4, fS: 0, bT: -4, bS: 0, lean: Math.sin(t * 22) * 2 }, 1);
      break;
    case "launched":
    case "thrown": {
      const spin = clamp(-f.vy * 3.5, -80, 70) - 40;
      j = mix(j, { lean: -30, head: -20, fU: 140, fF: 160, bU: -60, bF: -40, fT: 44, fS: 20, bT: -26, bS: -8, rot: spin }, 1);
      break;
    }
    case "knockdown":
    case "defeated":
      j = mix(j, { lean: 0, head: -10, fU: 160, fF: 170, bU: 20, bF: 40, fT: 10, fS: 0, bT: -6, bS: 0, rot: -90 }, 1);
      break;
    case "getup": {
      // Kip-up: roll from the floor through a crouch back into stance
      const k = clamp(st / 18, 0, 1);
      j = mix(mix(j, CROUCH, 1 - k * 0.6), { rot: -90 * (1 - easeOut(k)) }, 1);
      break;
    }
    case "dodge":
      j = mix(j, { ...CROUCH, lean: -8, fU: 70, fF: 150, bU: 60, bF: 150 }, 0.85);
      break;
    case "victory":
      j = mix(j, victoryPose(f, t), clamp(st / 12, 0, 1));
      break;
    case "attack": {
      const m = f.move;
      if (!m) break;
      const key = ATTACK[m.pose] ?? ATTACK.jab;
      if (key.crouch || f.slot === "low") j = mix(j, CROUCH, 1);
      const ft = f.moveTime;
      if (ft < m.startup) {
        // Anticipation: ease into the wind-up
        j = mix(j, key.w, easeOut(clamp(ft / Math.max(1, m.startup), 0, 1)));
      } else if (ft < m.startup + m.active) {
        // Strike with a little overshoot for snap
        j = mix(mix(j, key.w, 1), key.s, easeOutBack(clamp((ft - m.startup + 1) / 3, 0, 1)));
        if (m.pose === "spin") j.rot = ((ft * 40) % 360) * 0.25;
        if (m.rehit && m.pose !== "spin") {
          // Multi-hit flurry: alternate arms each rehit
          const alt = Math.floor((ft - m.startup) / (m.rehit || 4)) % 2 === 1;
          if (alt) j = mix(j, { fU: 30, fF: 140, bU: 90, bF: 90 }, 1);
        }
      } else {
        // Follow-through: hold the strike, then settle back into stance
        const r = clamp((ft - m.startup - m.active) / Math.max(1, m.recovery), 0, 1);
        const settle = { ...stance, ...(key.crouch ? CROUCH : {}) };
        j = mix(mix(mix(j, key.w, 1), key.s, 1), settle, r * r);
      }
      if (!f.grounded && m.kind !== "air") j = mix(j, { fT: 50, fS: -30, bT: 20, bS: -60 }, 0.6);
      break;
    }
  }

  // Superhero landing: one knee down, fist to the floor, then rise
  if (mem && mem.landAt >= 0 && (f.state === "idle" || f.state === "crouch" || f.state === "walk")) {
    const k = (t - mem.landAt) / 0.42;
    if (k < 1) {
      const w = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      j = mix(j, { lean: 36, head: 14, fT: 88, fS: -40, bT: 38, bS: -96, fU: 8, fF: 2, bU: -64, bF: -30 }, w);
    } else mem.landAt = -1;
  }
  return j;
}

/* ── Rig → points ──────────────────────────────────────────────────── */
export interface Rig {
  hip: [number, number];
  neck: [number, number];
  head: [number, number];
  headR: number;
  fShoulder: [number, number];
  bShoulder: [number, number];
  fElbow: [number, number];
  fHand: [number, number];
  bElbow: [number, number];
  bHand: [number, number];
  fKnee: [number, number];
  fFoot: [number, number];
  bKnee: [number, number];
  bFoot: [number, number];
  scale: number;
  bulk: number;
}

export function buildRig(f: Fighter, j: Joints): Rig {
  const H = f.def.look.height;
  const B = f.def.look.bulk;
  const L = { thigh: 49 * H, shin: 47 * H, torso: 62 * H * (0.96 + B * 0.04), upper: 33 * H * (0.92 + B * 0.08), fore: 31 * H, neck: 7 * H, headR: 21 * H * (0.92 + B * 0.08) };
  const dir = f.facing;
  const limb = (o: [number, number], ang: number, len: number): [number, number] => [o[0] + dir * sinD(ang) * len, o[1] - cosD(ang) * len];

  // Legs from a provisional hip at 0, then lift so the lowest foot touches the floor
  const hip0: [number, number] = [0, 0];
  const fK0 = limb(hip0, j.fT, L.thigh);
  const fF0 = limb(fK0, j.fS, L.shin);
  const bK0 = limb([-dir * 4 * B, 0], j.bT, L.thigh);
  const bF0 = limb(bK0, j.bS, L.shin);
  const lowest = Math.min(fF0[1], bF0[1]);
  const airborne = f.y > 0.5 || f.state === "launched" || f.state === "thrown";
  const lying = f.state === "knockdown" || f.state === "defeated";
  let hipY = airborne ? L.thigh + L.shin * 0.92 : -lowest;
  if (lying) hipY = 14 * B;
  hipY -= j.drop * (L.thigh + L.shin);

  const off = (p: [number, number]): [number, number] => [p[0], p[1] + hipY];
  const hip: [number, number] = [0, hipY];
  const lean = j.lean;
  const neck: [number, number] = [hip[0] + dir * sinD(lean) * L.torso, hip[1] + cosD(lean) * L.torso];
  const head: [number, number] = [neck[0] + dir * sinD(lean + j.head) * (L.neck + L.headR), neck[1] + cosD(lean + j.head) * (L.neck + L.headR)];
  // Shoulder sockets sit inside the deltoids, following the torso lean
  const fw: [number, number] = [dir * cosD(lean), -sinD(lean)];
  const upv: [number, number] = [dir * sinD(lean), cosD(lean)];
  const sock = (s: number, d: number): [number, number] => [neck[0] + fw[0] * s - upv[0] * d, neck[1] + fw[1] * s - upv[1] * d];
  const fem = f.def.look.body === "female";
  const fShoulder = sock((fem ? 9 : 11) * B, 9 * H);
  const bShoulder = sock((fem ? -7.5 : -9) * B, 10 * H);
  // Arms: angles are relative to the body (torso lean added) so punches follow the lean
  const fElbow = limb(fShoulder, j.fU + lean * 0.3, L.upper);
  const fHand = limb(fElbow, j.fF + lean * 0.3, L.fore);
  const bElbow = limb(bShoulder, j.bU + lean * 0.3, L.upper);
  const bHand = limb(bElbow, j.bF + lean * 0.3, L.fore);

  return {
    hip,
    neck,
    head,
    headR: L.headR,
    fShoulder,
    bShoulder,
    fElbow,
    fHand,
    bElbow,
    bHand,
    fKnee: off(fK0),
    fFoot: off(fF0),
    bKnee: off(bK0),
    bFoot: off(bF0),
    scale: H,
    bulk: B,
  };
}

/* ── Drawing ───────────────────────────────────────────────────────── */
const INK = BODY_INK;

function seg(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], w: number, fill: string, ink = true) {
  ctx.lineCap = "round";
  if (ink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 5;
    ctx.beginPath();
    ctx.moveTo(a[0], -a[1]);
    ctx.lineTo(b[0], -b[1]);
    ctx.stroke();
  }
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a[0], -a[1]);
  ctx.lineTo(b[0], -b[1]);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: [number, number], r: number, fill: string) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(p[0], -p[1], r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(p[0], -p[1], r, 0, Math.PI * 2);
  ctx.fill();
}

export interface DrawOpts {
  portrait: HTMLImageElement | null;
  t: number;
  /** White flash 0..1 after taking a hit */
  flash: number;
  /** Ghost silhouette (afterimage) colour */
  ghost?: string;
  /** Player ring colour */
  ring: string;
  /** Weapon currently thrown (hide it from the hand) */
  weaponOut: boolean;
  /** Arena light colour used for the rim light */
  rim?: string;
}

const P2 = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, j: Joints, rig: Rig, o: DrawOpts) {
  const look = f.def.look;
  const B = rig.bulk;
  const H = rig.scale;
  const dir = f.facing;
  const ghost = o.ghost;

  ctx.save();
  ctx.translate(f.x, -f.y);
  if (j.rot) {
    ctx.translate(rig.hip[0], -rig.hip[1]);
    ctx.rotate((-j.rot * Math.PI * dir) / 180);
    ctx.translate(-rig.hip[0], rig.hip[1]);
  }
  if (ghost) ctx.globalAlpha *= 0.28;

  const paths: Path2D[] = [];
  const front: Paint = { ctx, ghost, rim: o.rim ?? "#93c5fd", depth: 0, ink: 1, paths };
  const back: Paint = { ...front, depth: 1 };

  // Muscle profiles (W = girth; heavier characters are visibly beefier)
  const female = look.body === "female";
  const W = B * (0.86 + 0.14 * H) * (female ? 0.86 : 1);
  const UPPER: LimbProfile = { r0: 9.4 * W, r1: 10.8 * W, r1b: 9.4 * W, r2: 6.2 * W, at: 0.44 };
  const FORE: LimbProfile = { r0: 7 * W, r1: 8.6 * W, r1b: 7.4 * W, r2: 5 * W, at: 0.24 };
  const CUFF: LimbProfile = { r0: 7.2 * W, r1: 6.9 * W, r2: 5.9 * W, at: 0.5 };
  const THIGH: LimbProfile = { r0: 13.4 * W * (female ? 1.12 : 1), r1: 13.8 * W * (female ? 1.06 : 1), r1b: 12 * W, r2: 7.6 * W, at: 0.26 };
  const SHIN: LimbProfile = { r0: 7.8 * W, r1: 7.6 * W, r1b: 10 * W, r2: 5.2 * W, at: 0.28 };
  const SHAFT: LimbProfile = { r0: 8.6 * W, r1: 8.1 * W, r2: 6.6 * W, at: 0.4 };
  const DELT: LimbProfile = { r0: 11.6 * W, r1: 12 * W, r2: 9.4 * W, at: 0.4 };

  const c = costumeFor(look, f.def.name);
  const casting = !!f.move && (f.move.kind === "special" || f.move.kind === "ultimate") && f.movePhase !== "recovery";

  // Torso frame (screen space) and hip sockets
  const fr = torsoFrame(rig.hip, rig.neck, dir);
  const toW = (v: V): [number, number] => [v[0], -v[1]];
  const fHip = toW(fr.at(5 * B, 6));
  const bHip = toW(fr.at(-6 * B, 8));

  // ── Cape (behind everything) ─────────────────────────────────────
  if (look.cape && !ghost) {
    const sway = Math.sin(o.t * 3 + f.index) * 6 - clamp(f.vx, -12, 12) * dir * 1.5;
    drawCape(front, rig.bShoulder, rig.fShoulder, look.cape, dir, H, sway);
  }

  // Each limb is one inked silhouette (no seams at the joints); costume
  // pieces (gloves, boots, bracers, torn pants) are seamed overlays.
  const leg = (pt: Paint, hip: [number, number], knee: [number, number], foot: [number, number], bootSize: number) => {
    const parts = [
      limb(pt, hip, knee, THIGH, c.thigh, { stripe: c.legStripe, costume: c, gloss: c.gloss }),
      limb(pt, knee, foot, SHIN, c.shin, { stripe: c.tornPants ? undefined : c.legStripe, costume: c, gloss: c.gloss }),
    ];
    if (c.tornPants) parts.push(limb(pt, knee, P2(knee, foot, 0.3), { ...SHIN, r0: SHIN.r0 * 1.12, r1: SHIN.r1 * 1.14, r1b: (SHIN.r1b ?? SHIN.r1) * 1.1, r2: SHIN.r1 * 1.08 }, c.thigh, { seam: true, ragged: true }));
    if (!c.barefoot) parts.push(limb(pt, P2(knee, foot, c.bootTall ? 0.1 : 0.42), foot, c.bootTall ? { ...SHAFT, r0: SHIN.r0 * 1.1, r1: SHIN.r1b! * 1.06 } : SHAFT, c.boot, { gloss: 0.45, seam: true, costume: c }));
    parts.push(boot(pt, knee, foot, bootSize, c.barefoot ? c.shin : c.boot, dir, c.barefoot));
    paintGroup(pt, parts);
  };
  const arm = (pt: Paint, sh: [number, number], el: [number, number], hand: [number, number], fistSize: number, open: boolean, gems: boolean) => {
    const parts = [
      limb(pt, P2(sh, el, -0.12), P2(sh, el, 0.34), DELT, c.yoke ?? c.upperArm, { costume: c, gloss: c.gloss }),
      limb(pt, sh, el, UPPER, c.upperArm, { stripe: c.armStripe, costume: c, gloss: c.gloss }),
      limb(pt, el, hand, FORE, c.foreArm, { stripe: c.armStripe, costume: c, gloss: c.gloss }),
    ];
    if (c.bracer) parts.push(limb(pt, P2(el, hand, 0.5), P2(el, hand, 0.9), CUFF, c.bracer, { gloss: 0.55, seam: true }));
    else parts.push(limb(pt, P2(el, hand, c.gloveLong ? 0.18 : 0.55), hand, c.gloveLong ? { ...CUFF, r0: FORE.r1b! * 1.06, r1: FORE.r1b! * 1.02 } : CUFF, c.glove, { gloss: 0.45, seam: true, costume: c }));
    parts.push(fist(pt, el, hand, fistSize, c.hand, open, gems));
    paintGroup(pt, parts);
  };

  // ── Long hair (behind the body) ──────────────────────────────────
  if (look.hair && female && !ghost) drawHair(front, rig.head, rig.neck, rig.headR, look.hair, dir, o.t, -clamp(f.vx, -10, 10) * dir);

  // ── Back leg + arm ───────────────────────────────────────────────
  leg(back, bHip, rig.bKnee, rig.bFoot, 10 * W);
  arm(back, rig.bShoulder, rig.bElbow, rig.bHand, 12.5 * W, false, false);
  if (look.shield && !o.weaponOut && !ghost) drawShield(ctx, rig.bElbow, rig.bHand, B);
  if (look.claws && !ghost) drawClaws(ctx, rig.bElbow, rig.bHand, look.claws, B);

  // ── Torso ────────────────────────────────────────────────────────
  if (look.swords && !ghost) drawSwordHilts(ctx, rig, dir, B);
  drawTorso(front, fr, look, B, c);
  if (!ghost) {
    const chestS = fr.at(8 * B, fr.T * 0.72);
    if (c.chest === "reactor") glow(ctx, look.glow ?? "#9fe7ff", chestS[0], chestS[1], 44 * B, 0.95);
    if (f.rage > 0 || (f.def.passive.id === "rage" && f.health < f.def.maxHealth * 0.35 && f.alive)) {
      glow(ctx, "#ef4444", chestS[0], chestS[1], 130 * B, 0.35 + Math.sin(o.t * 18) * 0.12);
    }
  }

  // ── Front leg ────────────────────────────────────────────────────
  leg(front, fHip, rig.fKnee, rig.fFoot, 10.5 * W);

  // ── Neck + head ──────────────────────────────────────────────────
  drawNeck(front, rig.neck, rig.head, (female ? 6.6 : 7.8) * W, c.torso === look.skin || look.bareArms ? look.skin : c.yoke ?? c.torso);
  // Iconic headgear silhouettes frame the portrait head (fins, wings, collar)
  const tilt = j.lean * 0.35 + j.head;
  if (look.headgear && !ghost) drawHeadgear(front, rig.head, rig.headR, tilt, dir, look.headgear, "back");
  const headShape = drawHeadShape(front, rig.head, rig.headR, tilt, dir, ghost ? null : o.portrait, look.primary);
  if (!ghost) {
    // Light the portrait face with the fighter's state instead of drawing
    // artificial features over the source artwork.
    const mood = f.state === "hit" || f.state === "launched" || f.state === "thrown" ? "rgba(255,95,78,0.25)" :
      f.state === "block" || f.state === "blockstun" ? "rgba(104,192,255,0.15)" :
      f.state === "attack" && f.move?.kind === "ultimate" ? "rgba(255,219,95,0.28)" :
      f.state === "attack" ? "rgba(255,180,108,0.12)" :
      f.state === "victory" ? "rgba(255,227,139,0.17)" :
      f.state === "defeated" ? "rgba(15,23,42,0.28)" : null;
    if (mood) {
      ctx.save();
      ctx.clip(headShape);
      ctx.fillStyle = mood;
      ctx.fillRect(rig.head[0] - rig.headR * 1.2, -rig.head[1] - rig.headR * 1.2, rig.headR * 2.4, rig.headR * 2.4);
      ctx.restore();
    }
  }
  if (look.headgear && !ghost) drawHeadgear(front, rig.head, rig.headR, tilt, dir, look.headgear, "front");

  // ── Front arm ────────────────────────────────────────────────────
  arm(front, rig.fShoulder, rig.fElbow, rig.fHand, 13.5 * W, casting, !!c.gauntlet);
  if (!ghost) {
    if (look.claws) drawClaws(ctx, rig.fElbow, rig.fHand, look.claws, B);
    if (look.hammer && !o.weaponOut) drawHammer(ctx, rig.fElbow, rig.fHand, B);
    if (casting && look.glow) {
      glow(ctx, look.glow, rig.fHand[0], -rig.fHand[1], 52 * B, 0.85);
      glow(ctx, look.glow, rig.bHand[0], -rig.bHand[1], 36 * B, 0.6);
    }
    if (f.move?.fx === "sword" && f.movePhase === "active") drawBlade(ctx, rig.fElbow, rig.fHand, B);
  }

  // Hit flash: re-light the whole silhouette; afterimages fill it once
  flashPaths(front, o.flash);
  if (ghost) silhouetteFill(front, ghost, 1);

  ctx.restore();
}

function drawClaws(ctx: CanvasRenderingContext2D, elbow: [number, number], hand: [number, number], color: string, B: number) {
  const dx = hand[0] - elbow[0];
  const dy = hand[1] - elbow[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  ctx.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    const ox = -uy * i * 5 * B;
    const oy = ux * i * 5 * B;
    const a: [number, number] = [hand[0] + ox, hand[1] + oy];
    const b: [number, number] = [hand[0] + ux * 30 * B + ox, hand[1] + uy * 30 * B + oy];
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a[0], -a[1]);
    ctx.lineTo(b[0], -b[1]);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(a[0], -a[1]);
    ctx.lineTo(b[0], -b[1]);
    ctx.stroke();
  }
}

function drawShield(ctx: CanvasRenderingContext2D, elbow: [number, number], hand: [number, number], B: number) {
  const cx = lerp(elbow[0], hand[0], 0.55);
  const cy = -lerp(elbow[1], hand[1], 0.55);
  const r = 27 * B;
  const rings = ["#c8102e", "#f8fafc", "#c8102e", "#1f3f8f"];
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.fill();
  rings.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1 - i * 0.22), 0, Math.PI * 2);
    ctx.fill();
  });
  star(ctx, cx, cy, r * 0.3, "#f8fafc");
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, "rgba(255,255,255,0.35)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

export function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHammer(ctx: CanvasRenderingContext2D, elbow: [number, number], hand: [number, number], B: number) {
  const dx = hand[0] - elbow[0];
  const dy = hand[1] - elbow[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const tip: [number, number] = [hand[0] + ux * 34 * B, hand[1] + uy * 34 * B];
  seg(ctx, [hand[0] - ux * 10, hand[1] - uy * 10], tip, 6 * B, "#8b5a2b");
  ctx.save();
  ctx.translate(tip[0], -tip[1]);
  ctx.rotate(-Math.atan2(uy, ux));
  ctx.fillStyle = INK;
  ctx.fillRect(-4 * B, -19 * B, 32 * B, 38 * B);
  const g = ctx.createLinearGradient(0, -17 * B, 0, 17 * B);
  g.addColorStop(0, "#e2e8f0");
  g.addColorStop(1, "#64748b");
  ctx.fillStyle = g;
  ctx.fillRect(-2 * B, -17 * B, 28 * B, 34 * B);
  ctx.restore();
}

function drawSwordHilts(ctx: CanvasRenderingContext2D, rig: Rig, dir: number, B: number) {
  for (const s of [-1, 1]) {
    const a: [number, number] = [rig.neck[0] - dir * 6 + s * 10, rig.neck[1] + 16 * B];
    const b: [number, number] = [rig.hip[0] - dir * 12 - s * 18, rig.hip[1] + 10];
    seg(ctx, a, b, 4 * B, "#475569");
    dot(ctx, a, 3.5 * B, "#1e293b");
  }
}

function drawBlade(ctx: CanvasRenderingContext2D, elbow: [number, number], hand: [number, number], B: number) {
  const dx = hand[0] - elbow[0];
  const dy = hand[1] - elbow[1];
  const l = Math.hypot(dx, dy) || 1;
  const tip: [number, number] = [hand[0] + (dx / l) * 78 * B, hand[1] + (dy / l) * 78 * B];
  seg(ctx, hand, tip, 4.5 * B, "#e2e8f0");
  glow(ctx, "#e2e8f0", tip[0], -tip[1], 26, 0.6);
}

/** Floor shadow */
export function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter) {
  const w = f.def.width * 1.15 * Math.max(0.35, 1 - f.y / 400);
  ctx.fillStyle = withAlpha("#000000", 0.38 * Math.max(0.3, 1 - f.y / 500));
  ctx.beginPath();
  ctx.ellipse(f.x, 0, w, w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}
