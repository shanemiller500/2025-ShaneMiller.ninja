/* ------------------------------------------------------------------ */
/*  Procedural fighter: a skeletal rig posed per state/move, drawn as   */
/*  inked, shaded limbs with the character's portrait as the head.      */
/*                                                                      */
/*  Angles are degrees. Limbs: 0° points straight down, positive        */
/*  rotates forward (toward the opponent). Torso: 0° is upright.        */
/* ------------------------------------------------------------------ */

import type { Fighter } from "../engine/fighter";
import type { Pose } from "../engine/types";
import { clamp, glow, lerp, shade, withAlpha } from "./util";

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
export function poseFor(f: Fighter, t: number): Joints {
  const breathe = Math.sin(t * 2.6 + f.index) * 2;
  let j: Joints = { ...STANCE, lean: STANCE.lean + breathe * 0.6, fF: STANCE.fF + breathe, bF: STANCE.bF - breathe };
  const st = f.stateTime;

  switch (f.state) {
    case "walk": {
      const ph = (f.x * 0.05) * f.facing;
      const s = Math.sin(ph);
      j = mix(j, { fT: 8 + s * 28, bT: 8 - s * 28, fS: 8 + s * 28 - 14 - Math.max(0, -s) * 34, bS: 8 - s * 28 - 14 - Math.max(0, s) * 34 }, 1);
      break;
    }
    case "run": {
      const ph = (f.x * 0.045) * f.facing;
      const s = Math.sin(ph);
      j = mix(j, { lean: 26, fT: 14 + s * 46, bT: 14 - s * 46, fS: -10 - Math.max(0, -s) * 60, bS: -10 - Math.max(0, s) * 60, fU: 40 - s * 50, fF: 120, bU: 20 + s * 50, bF: 110 }, 1);
      break;
    }
    case "jumpSquat":
      j = mix(j, { ...CROUCH, lean: 14 }, 0.7);
      break;
    case "air":
      j = f.vy > 0 ? mix(j, { fT: 62, fS: -40, bT: 22, bS: -72, fU: 70, fF: 140, bU: 40, bF: 130 }, 1) : mix(j, { fT: 26, fS: 4, bT: -10, bS: -26, fU: 60, fF: 110, bU: -20, bF: 40 }, 1);
      if (f.def.passive.id === "flight" && f.hoverFrames > 0) j = mix(j, { fT: 10, fS: 0, bT: -6, bS: -6, lean: 4 }, 0.8);
      break;
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
      j = mix(mix(j, BLOCK_ARMS, 1), { lean: -12 }, Math.max(0, 1 - st / 10));
      break;
    case "hit": {
      const k = Math.max(0, 1 - st / 16);
      j = mix(j, { lean: -26, head: -22, fU: -18, fF: 14, bU: -10, bF: 24, fT: 6, bT: -26 }, 0.35 + k * 0.65);
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
      const k = clamp(st / 18, 0, 1);
      j = mix(mix(j, CROUCH, 1 - k * 0.6), { rot: -90 * (1 - k) }, 1);
      break;
    }
    case "dodge":
      j = mix(j, { ...CROUCH, lean: -8 }, 0.8);
      break;
    case "victory": {
      const bob = Math.sin(t * 6) * 6;
      j = mix(j, { fU: 172, fF: 178 + bob, bU: 14, bF: 140, lean: -6, head: -6 }, clamp(st / 12, 0, 1));
      break;
    }
    case "attack": {
      const m = f.move;
      if (!m) break;
      const key = ATTACK[m.pose] ?? ATTACK.jab;
      if (key.crouch || f.slot === "low") j = mix(j, CROUCH, 1);
      const ft = f.moveTime;
      if (ft < m.startup) j = mix(j, key.w, clamp(ft / Math.max(1, m.startup), 0, 1));
      else if (ft < m.startup + m.active) {
        j = mix(mix(j, key.w, 1), key.s, clamp((ft - m.startup + 1) / 3, 0, 1));
        if (m.pose === "spin") j.rot = ((ft * 40) % 360) * 0.25;
        if (m.rehit && m.pose !== "spin") {
          // Multi-hit flurry: alternate arms each rehit
          const alt = Math.floor((ft - m.startup) / (m.rehit || 4)) % 2 === 1;
          if (alt) j = mix(j, { fU: 30, fF: 140, bU: 90, bF: 90 }, 1);
        }
      } else {
        const r = clamp((ft - m.startup - m.active) / Math.max(1, m.recovery), 0, 1);
        j = mix(mix(mix(j, key.w, 1), key.s, 1), {}, 0);
        j = mix(j, { ...STANCE, ...(key.crouch ? CROUCH : {}) }, r);
      }
      if (!f.grounded && m.kind !== "air") j = mix(j, { fT: 50, fS: -30, bT: 20, bS: -60 }, 0.6);
      break;
    }
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
  const L = { thigh: 46 * H, shin: 44 * H, torso: 62 * H * (0.96 + B * 0.04), upper: 33 * H * (0.92 + B * 0.08), fore: 31 * H, neck: 7 * H, headR: 21 * H * (0.92 + B * 0.08) };
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
  const shoulderW = 12 * B;
  const fShoulder: [number, number] = [neck[0] + dir * shoulderW * 0.3, neck[1] - 6 * H];
  const bShoulder: [number, number] = [neck[0] - dir * shoulderW * 0.5, neck[1] - 8 * H];
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
const INK = "#0a0c14";

function seg(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], w: number, fill: string, ink = true) {
  ctx.lineCap = "round";
  if (ink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 6;
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
  // rim highlight
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = w * 0.32;
  ctx.beginPath();
  ctx.moveTo(a[0] - w * 0.18, -a[1] - w * 0.18);
  ctx.lineTo(b[0] - w * 0.18, -b[1] - w * 0.18);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: [number, number], r: number, fill: string) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(p[0], -p[1], r + 3, 0, Math.PI * 2);
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
}

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

  const col = (c: string, back = false) => (ghost ? ghost : back ? shade(c, -0.32) : c);
  const ink = !ghost;

  // ── Cape (behind everything) ───────────────────────────────────────
  if (look.cape && !ghost) {
    const sway = Math.sin(o.t * 3 + f.index) * 6 - clamp(f.vx, -12, 12) * dir * 1.5;
    const top1 = rig.bShoulder;
    const top2 = rig.fShoulder;
    const len = 118 * H;
    ctx.fillStyle = shade(look.cape, -0.15);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(top1[0] - dir * 6, -top1[1]);
    ctx.quadraticCurveTo(top1[0] - dir * (26 + sway), -(top1[1] - len * 0.55), top1[0] - dir * (34 + sway * 1.6), -(top1[1] - len));
    ctx.lineTo(top2[0] - dir * (6 + sway), -(top2[1] - len * 0.96));
    ctx.quadraticCurveTo(top2[0] - dir * 4, -(top2[1] - len * 0.5), top2[0], -top2[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ── Back limbs ────────────────────────────────────────────────────
  seg(ctx, rig.hip, rig.bKnee, 19 * B, col(look.secondary, true), ink);
  seg(ctx, rig.bKnee, rig.bFoot, 15 * B, col(look.secondary, true), ink);
  dot(ctx, rig.bFoot, 8 * B, col(look.accent, true));
  seg(ctx, rig.bShoulder, rig.bElbow, 15 * B, col(look.primary, true), ink);
  seg(ctx, rig.bElbow, rig.bHand, 13 * B, col(look.skin, true), ink);
  if (look.shield && !o.weaponOut && !ghost) drawShield(ctx, rig.bElbow, rig.bHand, B);
  dot(ctx, rig.bHand, 8.5 * B, col(look.accent, true));
  if (look.claws && !ghost) drawClaws(ctx, rig.bElbow, rig.bHand, look.claws, B);

  // ── Torso ─────────────────────────────────────────────────────────
  const tw = 30 * B;
  const hw = 21 * B;
  const nx = rig.neck[0] - rig.hip[0];
  const ny = rig.neck[1] - rig.hip[1];
  const len = Math.hypot(nx, ny) || 1;
  const px = -ny / len;
  const py = nx / len;
  ctx.beginPath();
  ctx.moveTo(rig.hip[0] + px * hw, -(rig.hip[1] + py * hw));
  ctx.lineTo(rig.neck[0] + px * tw, -(rig.neck[1] + py * tw));
  ctx.quadraticCurveTo(rig.neck[0] + nx * 0.08, -(rig.neck[1] + ny * 0.12), rig.neck[0] - px * tw, -(rig.neck[1] - py * tw));
  ctx.lineTo(rig.hip[0] - px * hw, -(rig.hip[1] - py * hw));
  ctx.closePath();
  if (ghost) ctx.fillStyle = ghost;
  else {
    const g = ctx.createLinearGradient(rig.hip[0] - px * tw * dir, -rig.hip[1], rig.hip[0] + px * tw * dir, -rig.hip[1]);
    g.addColorStop(0, shade(look.primary, 0.18));
    g.addColorStop(0.55, look.primary);
    g.addColorStop(1, shade(look.primary, -0.3));
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (ink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  if (!ghost) {
    // Belt
    seg(ctx, [rig.hip[0] - px * hw, rig.hip[1] - py * hw + 4], [rig.hip[0] + px * hw, rig.hip[1] + py * hw + 4], 8 * B, look.secondary, false);
    const chest: [number, number] = [lerp(rig.hip[0], rig.neck[0], 0.68), lerp(rig.hip[1], rig.neck[1], 0.68)];
    if (look.webLines) drawWebLines(ctx, rig, px, py, tw, hw);
    if (look.emblem) drawEmblem(ctx, chest, look.emblem, f.def.name, B);
    if (look.reactor) {
      glow(ctx, look.glow ?? "#9fe7ff", chest[0], -chest[1], 34 * B, 0.9);
      dot(ctx, chest, 7 * B, "#e0fbff");
    }
    if (f.rage > 0 || (f.def.passive.id === "rage" && f.health < f.def.maxHealth * 0.35 && f.alive)) {
      glow(ctx, "#ef4444", chest[0], -chest[1], 120 * B, 0.35 + Math.sin(o.t * 18) * 0.12);
    }
  }

  // ── Front leg ─────────────────────────────────────────────────────
  seg(ctx, rig.hip, rig.fKnee, 21 * B, col(look.secondary), ink);
  seg(ctx, rig.fKnee, rig.fFoot, 17 * B, col(look.secondary), ink);
  dot(ctx, rig.fFoot, 9 * B, col(look.accent));

  // ── Head (portrait) ───────────────────────────────────────────────
  seg(ctx, rig.neck, [lerp(rig.neck[0], rig.head[0], 0.4), lerp(rig.neck[1], rig.head[1], 0.4)], 11 * B, col(look.skin), ink);
  drawHead(ctx, rig, o, look.primary, ghost);

  // ── Front arm ─────────────────────────────────────────────────────
  if (look.swords && !ghost) drawSwordHilts(ctx, rig, dir, B);
  seg(ctx, rig.fShoulder, rig.fElbow, 17 * B, col(look.primary), ink);
  seg(ctx, rig.fElbow, rig.fHand, 15 * B, col(look.skin), ink);
  dot(ctx, rig.fHand, 10 * B, col(look.accent));
  if (!ghost) {
    if (look.claws) drawClaws(ctx, rig.fElbow, rig.fHand, look.claws, B);
    if (look.hammer && !o.weaponOut) drawHammer(ctx, rig.fElbow, rig.fHand, B);
    const casting = f.move && (f.move.kind === "special" || f.move.kind === "ultimate") && f.movePhase !== "recovery";
    if (casting && look.glow) {
      glow(ctx, look.glow, rig.fHand[0], -rig.fHand[1], 46 * B, 0.85);
      glow(ctx, look.glow, rig.bHand[0], -rig.bHand[1], 32 * B, 0.6);
    }
    if (f.move?.fx === "sword" && f.movePhase === "active") drawBlade(ctx, rig.fElbow, rig.fHand, B);
  }

  // Hit flash overlay: re-stroke limbs in white
  if (o.flash > 0 && !ghost) {
    ctx.globalAlpha = o.flash * 0.75;
    ctx.globalCompositeOperation = "lighter";
    for (const [a, b, w] of [
      [rig.hip, rig.neck, 30 * B],
      [rig.fShoulder, rig.fElbow, 17 * B],
      [rig.fElbow, rig.fHand, 15 * B],
      [rig.hip, rig.fKnee, 21 * B],
      [rig.fKnee, rig.fFoot, 17 * B],
    ] as [[number, number], [number, number], number][]) seg(ctx, a, b, w, "#ffffff", false);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  void H;
}

function drawHead(ctx: CanvasRenderingContext2D, rig: Rig, o: DrawOpts, rim: string, ghost?: string) {
  const [hx, hy] = rig.head;
  const r = rig.headR;
  ctx.save();
  // Ink + rim ring
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx, -hy, r + 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ghost ?? rim;
  ctx.beginPath();
  ctx.arc(hx, -hy, r + 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (!ghost) {
    ctx.beginPath();
    ctx.arc(hx, -hy, r, 0, Math.PI * 2);
    ctx.clip();
    if (o.portrait && o.portrait.complete && o.portrait.naturalWidth) {
      // Dataset portraits are 320×480 head-and-shoulders; crop the face area
      const img = o.portrait;
      const sw = img.naturalWidth * 0.78;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = img.naturalHeight * 0.04;
      ctx.drawImage(img, sx, sy, sw, sw, hx - r, -hy - r, r * 2, r * 2);
      // soft shading for roundness
      const g = ctx.createRadialGradient(hx - r * 0.35, -hy - r * 0.4, r * 0.2, hx, -hy, r * 1.05);
      g.addColorStop(0, "rgba(255,255,255,0.18)");
      g.addColorStop(0.6, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = g;
      ctx.fillRect(hx - r, -hy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = shade(rim, -0.2);
      ctx.fillRect(hx - r, -hy - r, r * 2, r * 2);
    }
  }
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

function drawWebLines(ctx: CanvasRenderingContext2D, rig: Rig, px: number, py: number, tw: number, hw: number) {
  ctx.strokeStyle = "rgba(10,12,20,0.55)";
  ctx.lineWidth = 1.3;
  const c: [number, number] = [lerp(rig.hip[0], rig.neck[0], 0.7), lerp(rig.hip[1], rig.neck[1], 0.7)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c[0], -c[1]);
    ctx.lineTo(c[0] + Math.cos(a) * tw, -(c[1] + Math.sin(a) * tw * 1.2));
    ctx.stroke();
  }
  for (const r of [10, 20]) {
    ctx.beginPath();
    ctx.arc(c[0], -c[1], r, 0, Math.PI * 2);
    ctx.stroke();
  }
  void px;
  void py;
  void hw;
}

function drawEmblem(ctx: CanvasRenderingContext2D, p: [number, number], color: string, name: string, B: number) {
  if (name === "Captain America") {
    star(ctx, p[0], -p[1], 13 * B, color);
    return;
  }
  // Spider emblem (Venom / generic)
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3 * B;
  ctx.beginPath();
  ctx.ellipse(p[0], -p[1], 5 * B, 9 * B, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    for (const k of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(p[0], -p[1] + k * 8 * B);
      ctx.quadraticCurveTo(p[0] + s * 14 * B, -p[1] + k * 8 * B - 8 * B, p[0] + s * 22 * B, -p[1] + k * 16 * B);
      ctx.stroke();
    }
  }
}

/** Floor shadow */
export function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter) {
  const w = f.def.width * 1.15 * Math.max(0.35, 1 - f.y / 400);
  ctx.fillStyle = withAlpha("#000000", 0.38 * Math.max(0.3, 1 - f.y / 500));
  ctx.beginPath();
  ctx.ellipse(f.x, 0, w, w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}
