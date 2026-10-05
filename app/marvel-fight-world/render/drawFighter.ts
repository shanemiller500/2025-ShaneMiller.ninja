/* ------------------------------------------------------------------ */
/*  Procedural fighter figure                                           */
/*                                                                      */
/*  Each fighter is an articulated comic figure (capsule limbs, torso,  */
/*  head) whose pose is computed from its state and current move. The   */
/*  look (colours, cape, claws, shield, hammer...) comes from the        */
/*  FighterDef, so all 270+ characters render without custom art.       */
/* ------------------------------------------------------------------ */

import type { FighterDef, FighterState, Look, MoveData, Pose } from "../engine/types";

/** Angles in radians: 0 = pointing down, positive = rotate toward facing. */
export interface PoseAngles {
  /** torso lean */
  lean: number;
  /** hip height as a fraction of standing */
  crouch: number;
  /** upper/lower arm (front = facing side, back = far side) */
  fu: number;
  fl: number;
  bu: number;
  bl: number;
  /** thigh/shin */
  ft: number;
  fs: number;
  bt: number;
  bs: number;
  /** whole-body rotation (spins, knockdown) */
  spin: number;
}

const BASE: PoseAngles = { lean: 0.05, crouch: 1, fu: 0.5, fl: 1.6, bu: -0.1, bl: 1.4, ft: 0.18, fs: -0.1, bt: -0.18, bs: -0.05, spin: 0 };

function lerpPose(a: PoseAngles, b: PoseAngles, t: number): PoseAngles {
  const o = { ...a };
  for (const k of Object.keys(a) as (keyof PoseAngles)[]) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

/** Pose targets for each attack pose at full extension. */
const STRIKE: Record<Pose, Partial<PoseAngles>> = {
  jab: { fu: 1.55, fl: 0.05, bu: 0.3, bl: 1.6, lean: 0.12 },
  cross: { fu: 1.6, fl: 0, bu: -0.4, bl: 1.2, lean: 0.28, ft: 0.4, bt: -0.4 },
  uppercut: { fu: 2.8, fl: 0.2, bu: -0.3, bl: 1.3, lean: -0.1, crouch: 0.96 },
  kick: { ft: 1.6, fs: 0, bt: -0.2, lean: -0.25, fu: 0.9, fl: 1.4 },
  lowKick: { crouch: 0.6, ft: 1.5, fs: 0.05, bt: -0.9, bs: -1.6, lean: 0.35 },
  lowJab: { crouch: 0.62, fu: 1.4, fl: 0.1, lean: 0.3, bt: -0.8, bs: -1.5, ft: 0.9, fs: -1.4 },
  airKick: { ft: 1.1, fs: 0.5, bt: -0.6, bs: -1.4, lean: 0.1, fu: 0.8, fl: 1.2 },
  airPunch: { fu: 1.2, fl: 0.1, ft: 0.8, fs: -1.2, bt: -0.4, bs: -1.4 },
  throw: { fu: 1.4, fl: 0.6, bu: 1.4, bl: 0.6, lean: 0.25 },
  cast: { fu: 1.5, fl: 0.05, bu: 1.4, bl: 0.1, lean: 0.1, ft: 0.35, bt: -0.35 },
  slam: { fu: 2.4, fl: 0.3, bu: 2.3, bl: 0.3, crouch: 0.75, lean: 0.5, ft: 0.6, bt: -0.6, fs: -0.6 },
  dash: { fu: 1.5, fl: 0.1, bu: -0.8, bl: 1.2, lean: 0.55, ft: 0.9, fs: -0.4, bt: -0.8, bs: -0.6 },
  spin: { fu: 1.6, fl: 0, bu: -1.6, bl: 0, lean: 0 },
  rise: { fu: 2.9, fl: 0.1, bu: 0.4, bl: 1.2, ft: 1.2, fs: -1.2, bt: -0.2, bs: -0.3, lean: -0.15 },
  beam: { fu: 1.55, fl: 0, bu: 1.5, bl: 0, lean: -0.05, ft: 0.5, bt: -0.5 },
  toss: { fu: 1.7, fl: 0.2, bu: -0.6, bl: 1.2, lean: 0.25, ft: 0.4, bt: -0.4 },
  claw: { fu: 1.4, fl: 0.4, bu: 0.9, bl: 0.5, lean: 0.35, ft: 0.5, bt: -0.5 },
  counter: { fu: 1.0, fl: 1.6, bu: 0.9, bl: 1.7, lean: -0.05, crouch: 0.92 },
};

const WIND: Partial<PoseAngles> = { fu: -0.4, fl: 1.8, lean: -0.1 };

export interface FighterView {
  def: FighterDef;
  x: number;
  y: number;
  facing: 1 | -1;
  state: FighterState;
  stateTime: number;
  move: MoveData | null;
  moveTime: number;
  vy: number;
  invuln: number;
  rage: number;
  shield: number;
  flash: number;
  meter?: number;
}

export function computePose(f: FighterView, t: number): PoseAngles {
  const breathe = Math.sin(t * 3 + f.def.id) * 0.04;
  let p: PoseAngles = { ...BASE, fu: BASE.fu + breathe, bu: BASE.bu - breathe };
  switch (f.state) {
    case "walk": {
      const c = Math.sin(f.stateTime * 0.22);
      p = { ...p, ft: 0.15 + c * 0.55, fs: -0.15 - Math.max(0, -c) * 0.6, bt: -0.15 - c * 0.55, bs: -0.15 - Math.max(0, c) * 0.6, fu: 0.6 - c * 0.2, bu: -0.1 + c * 0.25 };
      break;
    }
    case "run": {
      const c = Math.sin(f.stateTime * 0.38);
      p = { ...p, lean: 0.45, ft: 0.4 + c * 1.0, fs: -0.3 - Math.max(0, -c) * 1.3, bt: -0.1 - c * 1.0, bs: -0.3 - Math.max(0, c) * 1.3, fu: 0.9 - c * 0.8, fl: 1.8, bu: -0.3 + c * 0.8, bl: 1.6 };
      break;
    }
    case "crouch":
      p = { ...p, crouch: 0.62, lean: 0.25, ft: 1.0, fs: -1.6, bt: 0.4, bs: -1.6, fu: 0.7, fl: 1.8 };
      break;
    case "block":
      p = { ...p, fu: 1.1, fl: 2.4, bu: 0.9, bl: 2.5, lean: -0.08 };
      break;
    case "crouchBlock":
      p = { ...p, crouch: 0.62, lean: 0.15, ft: 1.0, fs: -1.6, bt: 0.4, bs: -1.6, fu: 1.2, fl: 2.4, bu: 1.0, bl: 2.5 };
      break;
    case "blockstun":
      p = { ...p, fu: 1.1, fl: 2.5, bu: 0.9, bl: 2.6, lean: -0.2 };
      break;
    case "jumpSquat":
      p = { ...p, crouch: 0.8, ft: 0.6, fs: -0.9, bt: 0.2, bs: -0.9 };
      break;
    case "air":
      p =
        f.vy > 0
          ? { ...p, ft: 1.2, fs: -1.6, bt: 0.2, bs: -1.2, fu: 1.2, fl: 1.2, bu: -0.6, bl: 1.2 }
          : { ...p, ft: 0.5, fs: -0.4, bt: -0.2, bs: -0.3, fu: 1.6, fl: 0.6, bu: -1.0, bl: 0.6 };
      break;
    case "hit":
      p = { ...p, lean: -0.45, fu: -0.4, fl: 0.6, bu: -0.8, bl: 0.4, ft: 0.3, bt: -0.4 };
      break;
    case "launched":
    case "thrown":
      p = { ...p, lean: -0.9, fu: -1.2, fl: 0.3, bu: -1.6, bl: 0.2, ft: 0.6, fs: -0.8, bt: 0.2, bs: -0.4, spin: f.state === "thrown" ? -f.stateTime * 0.25 : -0.4 - Math.min(0.9, f.stateTime * 0.03) };
      break;
    case "knockdown":
    case "defeated":
      p = { ...p, spin: -Math.PI / 2, crouch: 1, fu: 2.9, fl: 0.2, bu: 2.6, bl: 0.4, ft: 0.1, bt: -0.1 };
      break;
    case "getup":
      p = lerpPose({ ...p, spin: -Math.PI / 2 }, { ...p, crouch: 0.7 }, Math.min(1, f.stateTime / 16));
      break;
    case "dizzy":
    case "trapped":
      p = { ...p, lean: Math.sin(f.stateTime * 0.15) * 0.25, fu: 0.2, fl: 0.4, bu: -0.2, bl: 0.4, crouch: 0.95 };
      break;
    case "dodge":
      p = { ...p, lean: 0.6, crouch: 0.7, spin: f.stateTime * -0.3, ft: 1.2, fs: -1.4, bt: 0.6, bs: -1.4, fu: 1.6, fl: 1.8 };
      break;
    case "victory":
      p = { ...p, fu: 2.9 + Math.sin(f.stateTime * 0.2) * 0.15, fl: 0.2, bu: -0.3, bl: 1.6, lean: -0.08 };
      break;
    case "attack": {
      const m = f.move;
      if (!m) break;
      const strike = { ...p, ...STRIKE[m.pose] };
      const wind = { ...p, ...WIND };
      if (f.moveTime < m.startup) p = lerpPose(p, wind, f.moveTime / Math.max(1, m.startup));
      else if (f.moveTime < m.startup + m.active) {
        p = strike;
        if (m.pose === "spin") p.spin = (f.moveTime - m.startup) * 0.5;
        if (m.rehit && m.pose !== "beam") {
          // flurries alternate arms
          const alt = Math.floor((f.moveTime - m.startup) / 3) % 2;
          if (alt) p = { ...p, fu: p.bu, bu: p.fu, fl: p.bl, bl: p.fl };
        }
      } else {
        const r = (f.moveTime - m.startup - m.active) / Math.max(1, m.recovery);
        p = lerpPose(strike, p, Math.min(1, r * 1.3));
      }
      break;
    }
  }
  return p;
}

/* ── Drawing ──────────────────────────────────────────────────────── */
function limb(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, color: string, outline: string) {
  const ex = x + Math.sin(ang) * len;
  const ey = y + Math.cos(ang) * len;
  g.lineCap = "round";
  g.strokeStyle = outline;
  g.lineWidth = w + 4;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(ex, ey);
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(ex, ey);
  g.stroke();
  return [ex, ey] as const;
}

/**
 * Draw a fighter in world space. The context must already be transformed so
 * that (0,0) is the stage origin and +y points DOWN on screen (we negate y).
 */
export function drawFighter(g: CanvasRenderingContext2D, f: FighterView, t: number, rim: string, showShadow = true) {
  const d = f.def;
  const L: Look = d.look;
  const H = d.height;
  const bulk = L.bulk;
  const pose = computePose(f, t);
  const outline = "#0b0b12";

  // Shadow
  if (showShadow) {
    const sw = d.width * 0.9 * Math.max(0.4, 1 - f.y / 400);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(f.x, -2, sw, 9, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Proportions
  const thigh = H * 0.24;
  const shin = H * 0.23;
  const upper = H * 0.18;
  const lower = H * 0.17;
  const torso = H * 0.3;
  const head = H * 0.085;
  const hipY = (thigh + shin) * pose.crouch;
  const limbW = 17 * bulk;
  const armW = 15 * bulk;

  g.save();
  g.translate(f.x, -f.y);
  if (pose.spin) {
    // spin around the hips; grounded fighters lying down rest on the floor
    const floored = f.state === "knockdown" || f.state === "defeated" || f.state === "getup";
    if (floored) g.translate(0, (hipY - limbW) * Math.abs(Math.sin(pose.spin)));
    g.translate(0, -hipY);
    g.rotate(pose.spin * f.facing);
    g.translate(0, hipY);
  }
  g.scale(f.facing, 1);

  // Hit flash / invulnerability shimmer
  const flashing = f.flash > 0 && Math.floor(f.flash / 2) % 2 === 0;
  const ghost = f.invuln > 0 && f.state === "dodge";
  g.globalAlpha = ghost ? 0.55 : 1;

  const hx = 0;
  const hy = -hipY;
  const sx = Math.sin(pose.lean) * torso;
  const sy = hy - Math.cos(pose.lean) * torso;

  const primary = flashing ? "#ffffff" : L.primary;
  const secondary = flashing ? "#ffffff" : L.secondary;
  const skin = flashing ? "#ffffff" : L.skin;
  const accent = flashing ? "#ffffff" : L.accent;

  // Aura (rage / shield / full meter)
  if (f.rage > 0 || (f.meter ?? 0) >= 100) {
    g.save();
    g.globalCompositeOperation = "lighter";
    const col = f.rage > 0 ? "rgba(239,68,68,0.35)" : `rgba(250,204,21,${0.18 + 0.1 * Math.sin(t * 8)})`;
    const grd = g.createRadialGradient(sx * 0.5, (hy + sy) / 2, 10, sx * 0.5, (hy + sy) / 2, H * 0.7);
    grd.addColorStop(0, col);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(-H, -H * 1.3, H * 2, H * 1.5);
    g.restore();
  }

  // Cape (behind everything)
  if (L.cape) {
    g.fillStyle = flashing ? "#fff" : L.cape;
    g.strokeStyle = outline;
    g.lineWidth = 3;
    const sway = Math.sin(t * 4) * 6 + (f.state === "run" || f.state === "air" ? -30 : 0);
    g.beginPath();
    g.moveTo(sx - 12 * bulk, sy + 6);
    g.quadraticCurveTo(sx - 40 * bulk + sway, (sy + hy) / 2, -34 * bulk + sway * 1.6, -6);
    g.lineTo(-6 * bulk + sway, -4);
    g.lineTo(sx + 8 * bulk, sy + 6);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Back limbs (darker)
  const backCol = flashing ? "#ddd" : L.secondary;
  const [bkx, bky] = limb(g, hx - 4, hy, pose.bt, thigh, limbW, backCol, outline);
  limb(g, bkx, bky, pose.bt + pose.bs, shin, limbW * 0.9, backCol, outline);
  const backArmCol = flashing ? "#ddd" : L.primary;
  const [bex, bey] = limb(g, sx - 14 * bulk, sy + 10, pose.bu, upper, armW, backArmCol, outline);
  const [bhx, bhy] = limb(g, bex, bey, pose.bu + pose.bl, lower, armW * 0.9, backArmCol, outline);

  // Shield on back arm (Captain America)
  if (L.shield) drawShield(g, bhx + 6, bhy - 4, 26 * bulk, flashing, f.state === "block" || f.state === "crouchBlock" || f.state === "blockstun");

  // Torso
  g.save();
  g.translate(hx, hy);
  g.rotate(pose.lean);
  const tw = 42 * bulk;
  g.fillStyle = primary;
  g.strokeStyle = outline;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-tw * 0.55, 0);
  g.lineTo(tw * 0.55, 0);
  g.lineTo(tw * 0.75, -torso * 0.95);
  g.quadraticCurveTo(0, -torso * 1.08, -tw * 0.75, -torso * 0.95);
  g.closePath();
  g.fill();
  g.stroke();
  // belt / trunks
  g.fillStyle = secondary;
  g.fillRect(-tw * 0.56, -torso * 0.16, tw * 1.12, torso * 0.16);
  // chest details
  if (L.webLines) {
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(-tw * 0.7, -torso * (0.2 + i * 0.2));
      g.quadraticCurveTo(0, -torso * (0.12 + i * 0.2), tw * 0.7, -torso * (0.2 + i * 0.2));
      g.stroke();
    }
    g.fillStyle = "#111";
    g.beginPath();
    g.ellipse(0, -torso * 0.62, 5, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = secondary;
    g.fillRect(-tw * 0.75, -torso * 0.95, tw * 0.35, torso * 0.6);
  }
  if (L.reactor) {
    g.fillStyle = L.glow ?? "#9fe7ff";
    g.shadowColor = L.glow ?? "#9fe7ff";
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(0, -torso * 0.7, 7 * bulk, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = accent;
    g.fillRect(-tw * 0.55, -torso * 0.5, tw * 1.1, torso * 0.12);
  }
  if (L.emblem) {
    g.fillStyle = flashing ? "#fff" : L.emblem;
    if (L.shield) {
      star(g, 0, -torso * 0.68, 9 * bulk);
    } else {
      // symbiote / generic spider-ish emblem
      g.beginPath();
      g.moveTo(0, -torso * 0.5);
      g.quadraticCurveTo(-tw * 0.6, -torso * 0.9, -tw * 0.7, -torso * 0.5);
      g.quadraticCurveTo(-tw * 0.3, -torso * 0.75, 0, -torso * 0.5);
      g.quadraticCurveTo(tw * 0.3, -torso * 0.75, tw * 0.7, -torso * 0.5);
      g.quadraticCurveTo(tw * 0.6, -torso * 0.9, 0, -torso * 0.5);
      g.fill();
    }
  }
  if (!L.webLines && !L.reactor && !L.emblem) {
    // generic hero chevron in accent colour
    g.fillStyle = accent;
    g.beginPath();
    g.moveTo(-tw * 0.4, -torso * 0.8);
    g.lineTo(0, -torso * 0.55);
    g.lineTo(tw * 0.4, -torso * 0.8);
    g.lineTo(tw * 0.4, -torso * 0.68);
    g.lineTo(0, -torso * 0.43);
    g.lineTo(-tw * 0.4, -torso * 0.68);
    g.fill();
  }
  g.restore();

  // Head
  const headX = sx + Math.sin(pose.lean) * head * 1.1;
  const headY = sy - head * 1.05;
  g.fillStyle = skin;
  g.strokeStyle = outline;
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(headX, headY, head * 0.85 * Math.min(1.15, bulk), head, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  drawFace(g, d.name, L, headX, headY, head, flashing, f.state);

  // Front legs
  const frontLeg = flashing ? "#fff" : L.secondary === L.primary ? L.primary : L.secondary;
  const [fkx, fky] = limb(g, hx + 4, hy, pose.ft, thigh, limbW, frontLeg, outline);
  const [fax, fay] = limb(g, fkx, fky, pose.ft + pose.fs, shin, limbW * 0.9, frontLeg, outline);
  // boots
  g.fillStyle = flashing ? "#fff" : L.accent;
  g.beginPath();
  g.ellipse(fax + 6, fay, 10 * bulk, 6, 0, 0, Math.PI * 2);
  g.fill();

  // Front arm
  const armCol = flashing ? "#fff" : L.primary;
  const [fex, fey] = limb(g, sx + 12 * bulk, sy + 10, pose.fu, upper, armW, armCol, outline);
  const [fhx, fhy] = limb(g, fex, fey, pose.fu + pose.fl, lower, armW * 0.9, armCol, outline);
  // fist
  g.fillStyle = flashing ? "#fff" : L.webLines || L.reactor ? L.primary : L.skin === L.primary ? L.accent : L.skin;
  g.beginPath();
  g.arc(fhx, fhy, armW * 0.75, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = outline;
  g.lineWidth = 3;
  g.stroke();

  // Weapons
  const attacking = f.state === "attack";
  if (L.claws) {
    g.strokeStyle = flashing ? "#fff" : L.claws;
    g.lineWidth = 3;
    const ca = Math.atan2(fhy - fey, fhx - fex);
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(fhx, fhy + i * 4);
      g.lineTo(fhx + Math.cos(ca + i * 0.08) * 28, fhy + Math.sin(ca + i * 0.08) * 28 + i * 4);
      g.stroke();
    }
  }
  if (L.hammer) {
    const ca = Math.atan2(fhy - fey, fhx - fex);
    g.save();
    g.translate(fhx, fhy);
    g.rotate(ca - Math.PI / 2);
    g.fillStyle = "#6b4f2a";
    g.fillRect(-3, -4, 6, 30);
    g.fillStyle = flashing ? "#fff" : "#9ca3af";
    g.strokeStyle = outline;
    g.lineWidth = 3;
    g.fillRect(-18, 24, 36, 22);
    g.strokeRect(-18, 24, 36, 22);
    g.restore();
  }
  if (L.swords) {
    g.strokeStyle = "#e5e7eb";
    g.lineWidth = 4;
    const ca = attacking ? Math.atan2(fhy - fey, fhx - fex) : -2.4;
    g.beginPath();
    g.moveTo(fhx, fhy);
    g.lineTo(fhx + Math.cos(ca) * 58, fhy + Math.sin(ca) * 58);
    g.stroke();
    if (!attacking) {
      g.beginPath();
      g.moveTo(sx - 10, sy + 4);
      g.lineTo(sx - 34, sy - 40);
      g.stroke();
    }
  }
  if (L.glow && (f.move?.kind === "special" || f.move?.kind === "ultimate")) {
    g.save();
    g.globalCompositeOperation = "lighter";
    const grd = g.createRadialGradient(fhx, fhy, 0, fhx, fhy, 34);
    grd.addColorStop(0, L.glow);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(fhx - 40, fhy - 40, 80, 80);
    g.restore();
  }

  // Rim light for readability against dark stages
  g.globalAlpha = 0.35;
  g.strokeStyle = rim;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(headX, headY, head * 0.85 * Math.min(1.15, bulk) + 2, head + 2, 0, -Math.PI * 0.9, -Math.PI * 0.2);
  g.stroke();
  g.globalAlpha = 1;

  // Energy shield bubble
  if (f.shield > 0) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = `rgba(125,211,252,${0.5 + 0.3 * Math.sin(t * 10)})`;
    g.fillStyle = "rgba(125,211,252,0.08)";
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(0, -H * 0.5, d.width * 1.1, H * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  // Dizzy stars
  if (f.state === "dizzy") {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      g.fillStyle = "#fde047";
      star(g, headX + Math.cos(a) * 26, headY - head * 1.4 + Math.sin(a) * 8, 7);
    }
  }
  if (f.state === "trapped") {
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(-d.width, -i * H * 0.12);
      g.lineTo(d.width, -i * H * 0.12 - 20);
      g.stroke();
    }
  }
  g.restore();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function drawShield(g: CanvasRenderingContext2D, x: number, y: number, r: number, flashing: boolean, raised: boolean) {
  const cols = flashing ? ["#fff", "#fff", "#fff", "#fff"] : ["#c8102e", "#f8fafc", "#c8102e", "#1f3f8f"];
  const rr = raised ? r * 1.15 : r;
  cols.forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, rr * (1 - i * 0.24), 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#f8fafc";
  star(g, x, y, rr * 0.22);
  g.strokeStyle = "#0b0b12";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, rr, 0, Math.PI * 2);
  g.stroke();
}

function drawFace(g: CanvasRenderingContext2D, name: string, L: Look, x: number, y: number, r: number, flashing: boolean, state: FighterState) {
  if (flashing) return;
  const hurt = state === "hit" || state === "launched" || state === "dizzy" || state === "knockdown" || state === "defeated";
  // Masked heroes get big lenses; others get eyes + hair
  const masked = L.skin === L.primary || L.webLines || L.reactor || name === "Black Panther" || name === "Deadpool" || name === "Venom";
  if (masked) {
    g.fillStyle = L.reactor ? (L.glow ?? "#e0f2fe") : "#f8fafc";
    g.strokeStyle = "#0b0b12";
    g.lineWidth = 2;
    for (const s of [-1, 1]) {
      g.beginPath();
      if (name === "Venom") {
        g.ellipse(x + 2 + s * r * 0.38, y - r * 0.15, r * 0.34, r * 0.5, s * 0.5, 0, Math.PI * 2);
      } else {
        g.ellipse(x + 3 + s * r * 0.35, y - r * 0.1, r * (hurt ? 0.18 : 0.26), r * (hurt ? 0.08 : 0.2), s * 0.35, 0, Math.PI * 2);
      }
      g.fill();
      g.stroke();
    }
    if (name === "Venom") {
      g.fillStyle = "#f8fafc";
      g.beginPath();
      g.ellipse(x + 3, y + r * 0.5, r * 0.55, r * 0.22, 0, 0, Math.PI);
      g.fill();
    }
    if (name === "Captain America") {
      g.fillStyle = "#f8fafc";
      g.font = `bold ${Math.round(r * 0.8)}px sans-serif`;
      g.textAlign = "center";
      g.fillText("A", x, y - r * 0.35);
    }
    return;
  }
  // hair / helmet
  g.fillStyle = name === "Thor" ? "#f2c94c" : name === "Wolverine" ? "#1a1a1a" : name === "Magneto" ? L.primary : name === "Doctor Strange" ? "#2b2118" : "#3b2a1a";
  g.beginPath();
  g.ellipse(x - r * 0.1, y - r * 0.55, r * 0.95, r * 0.55, 0, Math.PI, Math.PI * 2);
  g.fill();
  if (name === "Wolverine") {
    // cowl fins
    g.fillStyle = L.primary;
    g.beginPath();
    g.moveTo(x - r * 0.6, y - r * 0.7);
    g.lineTo(x - r * 1.0, y - r * 1.6);
    g.lineTo(x - r * 0.1, y - r * 0.9);
    g.fill();
  }
  if (name === "Thor" || name === "Magneto") {
    g.fillStyle = name === "Thor" ? "#cbd5e1" : L.primary;
    g.fillRect(x - r * 0.9, y - r * 0.85, r * 1.8, r * 0.35);
  }
  g.fillStyle = "#0b0b12";
  if (hurt) {
    g.fillRect(x + r * 0.2, y - r * 0.15, r * 0.3, 2);
  } else {
    g.beginPath();
    g.arc(x + r * 0.35, y - r * 0.1, r * 0.11, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(x + r * 0.15, y + r * 0.42, r * 0.4, 2);
}
