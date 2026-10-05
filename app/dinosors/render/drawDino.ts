/* ------------------------------------------------------------------ */
/*  Procedural dinosaur sprites. One painter per body plan; species    */
/*  only supply proportions, colors and feature flags (crests, horns,  */
/*  plates, sails…). Local space: facing +x, feet at y=0, up is -y.    */
/* ------------------------------------------------------------------ */
import type { BodyPlan, SpeciesDef } from "../sim/types";

export interface DinoPose {
  /** walk cycle phase (radians) */
  walk: number;
  /** 0..1 leg swing amount */
  stride: number;
  headDown: number;
  headUp: number;
  mouth: number;
  /** 0..1 lying down (sleep / wallow) */
  lie: number;
  /** 0..1 knocked onto its side */
  flip: number;
  eyesClosed: boolean;
  dangle: boolean;
  /** seconds, for idle motion */
  t: number;
  /** pterosaurs */
  flying: boolean;
  wing: number;
  /** mosasaur: 0 = leaping clear, 1 = cruising underwater */
  submerged: number;
  baby: number;
  muddy: number;
  tailSwing: number;
}

export const restPose = (): DinoPose => ({
  walk: 0,
  stride: 0,
  headDown: 0,
  headUp: 0,
  mouth: 0,
  lie: 0,
  flip: 0,
  eyesClosed: false,
  dangle: false,
  t: 0,
  flying: false,
  wing: 0,
  submerged: 1,
  baby: 0,
  muddy: 0,
  tailSwing: 0,
});

const shadeCache = new Map<string, string>();
/** Lighten (+) or darken (-) a hex color. */
export function shade(hex: string, amt: number) {
  const key = hex + amt;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const out = `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  shadeCache.set(key, out);
  return out;
}

const OUTLINE = "rgba(35,28,22,0.55)";

interface Ctx2 {
  c: CanvasRenderingContext2D;
  L: number;
  def: SpeciesDef;
  p: DinoPose;
  body: string;
  dark: string;
  belly: string;
  accent: string;
  lw: number;
}

function fillStroke(k: Ctx2, fill: string) {
  k.c.fillStyle = fill;
  k.c.fill();
  k.c.strokeStyle = OUTLINE;
  k.c.lineWidth = k.lw;
  k.c.stroke();
}

function limb(k: Ctx2, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, w0: number, w1: number, color: string) {
  const c = k.c;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = OUTLINE;
  c.lineWidth = w0 + k.lw * 2;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.lineWidth = w1 + k.lw * 2;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = w0;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.lineWidth = w1;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

/** Bird-like hind leg with a knee that bends backwards. */
function bipedLeg(k: Ctx2, hx: number, hy: number, legH: number, phase: number, color: string, thick: number) {
  const { p } = k;
  const sw = Math.sin(phase) * p.stride;
  const lift = Math.max(0, Math.cos(phase)) * p.stride * legH * 0.22;
  const kneeX = hx + legH * 0.18 + sw * legH * 0.3;
  const kneeY = hy + legH * 0.48;
  const footX = hx + sw * legH * 0.55;
  const footY = -lift;
  limb(k, hx, hy, kneeX, kneeY, footX - legH * 0.04, footY - legH * 0.06, thick, thick * 0.55, color);
  k.c.fillStyle = color;
  k.c.beginPath();
  k.c.ellipse(footX + legH * 0.06, footY - legH * 0.03, legH * 0.13, legH * 0.05, 0, 0, Math.PI * 2);
  k.c.fill();
}

/** Pillar leg for quadrupeds. */
function pillarLeg(k: Ctx2, hx: number, hy: number, legH: number, phase: number, color: string, thick: number) {
  const { p } = k;
  const sw = Math.sin(phase) * p.stride;
  const lift = Math.max(0, Math.cos(phase)) * p.stride * legH * 0.18;
  const footX = hx + sw * legH * 0.35;
  limb(k, hx, hy, hx + sw * legH * 0.15, hy + (0 - lift - hy) * 0.5, footX, -lift, thick, thick * 0.85, color);
  k.c.fillStyle = shade(k.def.look.body, -0.35);
  k.c.beginPath();
  k.c.ellipse(footX + thick * 0.1, -lift - thick * 0.1, thick * 0.55, thick * 0.22, 0, 0, Math.PI * 2);
  k.c.fill();
}

function eye(k: Ctx2, x: number, y: number, r: number, angry: boolean) {
  const c = k.c;
  const big = r * (1 + k.p.baby * 0.6);
  if (k.p.eyesClosed) {
    c.strokeStyle = "#1d1813";
    c.lineWidth = Math.max(1, big * 0.45);
    c.beginPath();
    c.arc(x, y, big * 0.8, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
    return;
  }
  c.fillStyle = "#fffdf4";
  c.beginPath();
  c.arc(x, y, big, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1d1813";
  c.beginPath();
  c.arc(x + big * 0.25, y + big * (k.p.headUp > 0.5 ? -0.3 : 0.05), big * 0.55, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#fff";
  c.beginPath();
  c.arc(x + big * 0.4, y - big * 0.2, big * 0.18, 0, Math.PI * 2);
  c.fill();
  if (angry) {
    c.strokeStyle = shade(k.def.look.body, -0.45);
    c.lineWidth = Math.max(1, big * 0.5);
    c.beginPath();
    c.moveTo(x - big * 1.1, y - big * 1.2);
    c.lineTo(x + big * 1.1, y - big * 0.6);
    c.stroke();
  }
}

function pattern(k: Ctx2, cx: number, cy: number, rx: number, ry: number, rot: number) {
  const { c, def } = k;
  if (def.look.pattern === "none") return;
  c.save();
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = def.look.accent;
  c.globalAlpha *= 0.32;
  if (def.look.pattern === "stripes" || def.look.pattern === "bands") {
    const n = def.look.pattern === "stripes" ? 6 : 4;
    const w = def.look.pattern === "stripes" ? rx * 0.12 : rx * 0.2;
    for (let i = 0; i < n; i++) {
      const x = cx - rx + ((i + 0.6) / n) * rx * 2;
      c.beginPath();
      c.moveTo(x - w, cy - ry);
      c.lineTo(x + w, cy - ry);
      c.lineTo(x + w * 0.3, cy + ry * 0.2);
      c.lineTo(x - w * 0.6, cy + ry * 0.2);
      c.closePath();
      c.fill();
    }
  } else {
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.arc(cx - rx * 0.7 + ((i * 37) % 10) / 10 * rx * 1.4, cy - ry * 0.6 + ((i * 53) % 10) / 10 * ry * 0.8, ry * (0.12 + ((i * 7) % 3) * 0.05), 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

function mud(k: Ctx2, cx: number, cy: number, rx: number, ry: number) {
  if (k.p.muddy < 0.15) return;
  const c = k.c;
  c.fillStyle = `rgba(100,70,40,${0.55 * k.p.muddy})`;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.ellipse(cx + (((i * 41) % 13) / 13 - 0.5) * rx * 1.6, cy + (((i * 29) % 7) / 7 - 0.3) * ry, rx * 0.16, ry * 0.2, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function tail(k: Ctx2, x0: number, yTop: number, yBot: number, tipX: number, tipY: number) {
  const c = k.c;
  const sway = Math.sin(k.p.t * 2.2 + k.p.walk * 0.5) * k.L * 0.02 + k.p.tailSwing * k.L * 0.12;
  c.beginPath();
  c.moveTo(x0, yTop);
  c.quadraticCurveTo((x0 + tipX) / 2, yTop - k.L * 0.02 + sway * 0.5, tipX, tipY + sway);
  c.quadraticCurveTo((x0 + tipX) / 2, yBot + k.L * 0.01 + sway * 0.5, x0, yBot);
  c.closePath();
  fillStroke(k, k.body);
  return { tipX, tipY: tipY + sway };
}

/* ---------------------------- body plans ---------------------------- */

function theropod(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const lie = p.lie;
  const legH = L * 0.27 * (s.legs ?? 1) * (1 - lie * 0.8);
  const hipX = -L * 0.06;
  const hipY = -legH - L * 0.02;
  const bodyCx = L * 0.04;
  const bodyCy = hipY - L * 0.05;
  const rx = L * 0.2;
  const ry = L * 0.105;
  const tilt = -0.12 + p.headDown * 0.25 - p.headUp * 0.25;
  const thick = L * 0.075;

  // far leg
  if (lie < 0.9) bipedLeg(k, hipX, hipY, -hipY, p.walk + Math.PI, k.dark, thick);

  // sail sits behind the body
  if (s.sail) {
    c.beginPath();
    c.moveTo(bodyCx - rx * 0.9, bodyCy - ry * 0.6);
    c.bezierCurveTo(bodyCx - rx * 0.6, bodyCy - ry * 4.2, bodyCx + rx * 0.6, bodyCy - ry * 4.2, bodyCx + rx * 0.95, bodyCy - ry * 0.6);
    c.closePath();
    fillStroke(k, shade(def.look.accent, -0.05));
    c.strokeStyle = shade(def.look.accent, -0.35);
    c.lineWidth = k.lw;
    for (let i = 1; i < 7; i++) {
      const x = bodyCx - rx * 0.9 + (i / 7) * rx * 1.85;
      c.beginPath();
      c.moveTo(x, bodyCy - ry * 0.5);
      c.lineTo(x + (i - 3.5) * L * 0.004, bodyCy - ry * (1.2 + Math.sin((i / 7) * Math.PI) * 2.6));
      c.stroke();
    }
  }

  // tail
  const tailLen = L * 0.52 * (s.tail ?? 1);
  const t = tail(k, bodyCx - rx * 0.7, bodyCy - ry * 0.75, bodyCy + ry * 0.55, bodyCx - rx - tailLen, bodyCy - L * 0.02 + lie * L * 0.08);
  if (s.feathers) {
    c.strokeStyle = def.look.accent;
    c.lineWidth = k.lw * 1.6;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(t.tipX + i * L * 0.03, t.tipY);
      c.lineTo(t.tipX + i * L * 0.03 - L * 0.04, t.tipY - L * 0.04 + i * L * 0.025);
      c.stroke();
    }
  }

  // body
  c.beginPath();
  c.ellipse(bodyCx, bodyCy, rx, ry, tilt, 0, Math.PI * 2);
  fillStroke(k, k.body);
  c.beginPath();
  c.ellipse(bodyCx + rx * 0.15, bodyCy + ry * 0.45, rx * 0.7, ry * 0.45, tilt, 0, Math.PI * 2);
  c.fillStyle = k.belly;
  c.fill();
  pattern(k, bodyCx, bodyCy - ry * 0.2, rx, ry * 0.8, tilt);
  mud(k, bodyCx, bodyCy, rx, ry);

  // near leg
  if (lie < 0.9) bipedLeg(k, hipX + L * 0.02, hipY, -hipY, p.walk, k.body, thick * 1.1);
  else {
    c.beginPath();
    c.ellipse(hipX, -L * 0.03, L * 0.1, L * 0.05, 0, 0, Math.PI * 2);
    fillStroke(k, k.body);
  }

  // neck + head
  const neckBaseX = bodyCx + rx * 0.75;
  const neckBaseY = bodyCy - ry * 0.4;
  const headSize = L * 0.1 * (s.head ?? 1) * (1 + p.baby * 0.35);
  const ang = -0.6 + p.headDown * 1.2 - p.headUp * 0.9;
  const neckLen = L * 0.13;
  const hx = neckBaseX + Math.cos(ang) * neckLen + lie * L * 0.05;
  const hy = neckBaseY + Math.sin(ang) * neckLen + lie * L * 0.08;
  c.lineCap = "round";
  c.strokeStyle = OUTLINE;
  c.lineWidth = L * 0.09 + k.lw * 2;
  c.beginPath();
  c.moveTo(neckBaseX - L * 0.03, neckBaseY + L * 0.02);
  c.lineTo(hx, hy);
  c.stroke();
  c.strokeStyle = k.body;
  c.lineWidth = L * 0.09;
  c.stroke();

  // arm
  const armLen = L * 0.12 * (s.arms ?? 0.5);
  const ax = bodyCx + rx * 0.6;
  const ay = bodyCy + ry * 0.2;
  const armSw = Math.sin(p.walk * 0.5 + p.t * 2) * 0.2;
  limb(k, ax, ay, ax + armLen * 0.5, ay + armLen * (0.6 + armSw), ax + armLen * (1 + armSw), ay + armLen * 0.4, L * 0.03, L * 0.022, k.body);
  if (s.feathers) {
    c.strokeStyle = def.look.accent;
    c.lineWidth = k.lw * 1.5;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      c.moveTo(ax + armLen * (0.3 + i * 0.25), ay + armLen * 0.5);
      c.lineTo(ax + armLen * (0.1 + i * 0.25), ay + armLen * 1.1);
    }
    c.stroke();
  }
  if (s.thumb) {
    c.fillStyle = "#efe6cf";
    c.beginPath();
    c.moveTo(ax + armLen, ay + armLen * 0.35);
    c.lineTo(ax + armLen * 1.3, ay + armLen * 0.1);
    c.lineTo(ax + armLen * 1.05, ay + armLen * 0.55);
    c.fill();
  }

  // head
  drawTheropodHead(k, hx, hy, headSize, ang * 0.5);
}

function drawTheropodHead(k: Ctx2, hx: number, hy: number, hs: number, rot: number) {
  const { c, def, p } = k;
  const s = def.shape;
  const snout = hs * 1.25 * (s.snout ?? 1);
  const carn = def.diet !== "herbivore";
  c.save();
  c.translate(hx, hy);
  c.rotate(rot);
  const jawOpen = p.mouth * 0.5;

  // crests behind the skull
  if (s.crest === "double") {
    c.fillStyle = def.look.accent;
    for (const off of [0, hs * 0.18]) {
      c.beginPath();
      c.moveTo(-hs * 0.3 + off, -hs * 0.45);
      c.quadraticCurveTo(hs * 0.2 + off, -hs * 1.6, hs * 1.0 + off * 0.3, -hs * 0.4);
      c.closePath();
      c.fill();
      c.strokeStyle = OUTLINE;
      c.lineWidth = k.lw;
      c.stroke();
    }
  }
  // lower jaw
  c.save();
  c.translate(-hs * 0.1, hs * 0.15);
  c.rotate(jawOpen);
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(snout * 0.95, hs * 0.05);
  c.quadraticCurveTo(snout, hs * 0.35, snout * 0.7, hs * 0.38);
  c.lineTo(0, hs * 0.4);
  c.closePath();
  fillStroke(k, k.belly);
  if (carn && p.mouth > 0.1) {
    c.fillStyle = "#fffaf0";
    for (let i = 0; i < 4; i++) {
      const x = snout * (0.2 + i * 0.2);
      c.beginPath();
      c.moveTo(x, hs * 0.05);
      c.lineTo(x + hs * 0.06, -hs * 0.12);
      c.lineTo(x + hs * 0.12, hs * 0.05);
      c.fill();
    }
  }
  c.restore();
  if (p.mouth > 0.1) {
    c.fillStyle = "#7a2a2a";
    c.beginPath();
    c.moveTo(-hs * 0.1, hs * 0.12);
    c.lineTo(snout * 0.9, hs * 0.1);
    c.lineTo(snout * 0.6, hs * 0.1 + jawOpen * snout * 0.7);
    c.closePath();
    c.fill();
  }
  // skull
  c.beginPath();
  c.moveTo(-hs * 0.45, -hs * 0.25);
  c.quadraticCurveTo(-hs * 0.3, -hs * 0.62, hs * 0.2, -hs * 0.55);
  c.quadraticCurveTo(snout * 0.9, -hs * 0.35, snout * 1.05, -hs * 0.02);
  c.quadraticCurveTo(snout * 1.02, hs * 0.2, snout * 0.85, hs * 0.18);
  c.lineTo(-hs * 0.2, hs * 0.22);
  c.quadraticCurveTo(-hs * 0.55, hs * 0.1, -hs * 0.45, -hs * 0.25);
  c.closePath();
  fillStroke(k, k.body);
  if (carn && p.mouth <= 0.1) {
    // a hint of teeth along the closed jaw
    c.fillStyle = "#fffaf0";
    for (let i = 0; i < 3; i++) {
      const x = snout * (0.35 + i * 0.18);
      c.beginPath();
      c.moveTo(x, hs * 0.17);
      c.lineTo(x + hs * 0.05, hs * 0.3);
      c.lineTo(x + hs * 0.1, hs * 0.17);
      c.fill();
    }
  }
  // nostril + eye
  c.fillStyle = shade(def.look.body, -0.5);
  c.beginPath();
  c.arc(snout * 0.9, -hs * 0.12, hs * 0.05, 0, Math.PI * 2);
  c.fill();
  eye(k, hs * 0.05, -hs * 0.22, hs * 0.14, carn && def.aggression > 0.5);

  if (s.crest === "small") {
    c.fillStyle = def.look.accent;
    c.beginPath();
    c.moveTo(-hs * 0.05, -hs * 0.45);
    c.lineTo(hs * 0.12, -hs * 0.75);
    c.lineTo(hs * 0.25, -hs * 0.45);
    c.fill();
  }
  if (s.horns === "carno") {
    c.fillStyle = shade(def.look.accent, 0.2);
    c.beginPath();
    c.moveTo(-hs * 0.15, -hs * 0.45);
    c.quadraticCurveTo(-hs * 0.35, -hs * 0.95, -hs * 0.05, -hs * 1.0);
    c.lineTo(hs * 0.1, -hs * 0.5);
    c.closePath();
    c.fill();
    c.strokeStyle = OUTLINE;
    c.lineWidth = k.lw;
    c.stroke();
  }
  if (s.feathers) {
    c.strokeStyle = def.look.accent;
    c.lineWidth = k.lw * 1.4;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      c.moveTo(-hs * 0.3 + i * hs * 0.1, -hs * 0.5);
      c.lineTo(-hs * 0.55 + i * hs * 0.1, -hs * 0.85);
    }
    c.stroke();
  }
  c.restore();
}

function sauropod(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const lie = p.lie;
  const legH = L * 0.26 * (s.legs ?? 1) * (1 - lie * 0.75);
  const isBrachio = (s.neckUp ?? 0) > 0.6;
  const tilt = isBrachio ? -0.12 : 0;
  const bodyCx = 0;
  const bodyCy = -legH - L * 0.09;
  const rx = L * 0.24;
  const ry = L * 0.13;
  const thick = L * 0.075;
  const frontH = legH * (isBrachio ? 1.18 : 1);

  // far legs
  pillarLeg(k, bodyCx - rx * 0.55, bodyCy + ry * 0.4, legH + L * 0.03, p.walk + Math.PI, k.dark, thick);
  pillarLeg(k, bodyCx + rx * 0.55, bodyCy + ry * 0.2 - (frontH - legH), frontH + L * 0.03, p.walk, k.dark, thick);

  tail(k, bodyCx - rx * 0.8, bodyCy - ry * 0.5, bodyCy + ry * 0.5, bodyCx - rx - L * 0.55 * (s.tail ?? 1), bodyCy + L * 0.1 + lie * L * 0.05);

  // neck
  const ang = -(0.25 + (s.neckUp ?? 0.3) * 1.0) + p.headDown * (isBrachio ? 0.7 : 1.4) - p.headUp * 0.3;
  const nl = L * 0.5 * (s.neck ?? 1);
  const nx0 = bodyCx + rx * 0.7;
  const ny0 = bodyCy - ry * 0.35;
  const sway = Math.sin(p.t * 0.9) * L * 0.015;
  const hx = nx0 + Math.cos(ang) * nl + sway;
  const hy = ny0 + Math.sin(ang) * nl;
  const cx1 = nx0 + Math.cos(ang - 0.3) * nl * 0.5;
  const cy1 = ny0 + Math.sin(ang - 0.3) * nl * 0.5;
  c.lineCap = "round";
  c.strokeStyle = OUTLINE;
  c.lineWidth = L * 0.085 + k.lw * 2;
  c.beginPath();
  c.moveTo(nx0 - L * 0.04, ny0 + L * 0.03);
  c.quadraticCurveTo(cx1, cy1, hx, hy);
  c.stroke();
  c.strokeStyle = k.body;
  c.lineWidth = L * 0.085;
  c.stroke();
  c.strokeStyle = k.belly;
  c.lineWidth = L * 0.03;
  c.beginPath();
  c.moveTo(nx0, ny0 + L * 0.04);
  c.quadraticCurveTo(cx1 + L * 0.02, cy1 + L * 0.04, hx + L * 0.01, hy + L * 0.025);
  c.stroke();

  // body
  c.beginPath();
  c.ellipse(bodyCx, bodyCy, rx, ry, tilt, 0, Math.PI * 2);
  fillStroke(k, k.body);
  c.beginPath();
  c.ellipse(bodyCx, bodyCy + ry * 0.5, rx * 0.75, ry * 0.4, tilt, 0, Math.PI * 2);
  c.fillStyle = k.belly;
  c.fill();
  pattern(k, bodyCx, bodyCy - ry * 0.2, rx, ry * 0.8, tilt);
  mud(k, bodyCx, bodyCy, rx, ry);

  // near legs
  pillarLeg(k, bodyCx - rx * 0.45, bodyCy + ry * 0.45, legH + L * 0.03, p.walk, k.body, thick * 1.1);
  pillarLeg(k, bodyCx + rx * 0.62, bodyCy + ry * 0.25 - (frontH - legH), frontH + L * 0.03, p.walk + Math.PI, k.body, thick * 1.1);

  // head
  const hs = L * 0.05 * (s.head ?? 0.6) * 1.6 * (1 + p.baby * 0.4);
  c.save();
  c.translate(hx, hy);
  c.rotate(ang * 0.25 + 0.2);
  c.beginPath();
  c.ellipse(hs * 0.3, 0, hs * 1.15, hs * 0.65, 0, 0, Math.PI * 2);
  fillStroke(k, k.body);
  if (isBrachio) {
    c.beginPath();
    c.ellipse(-hs * 0.1, -hs * 0.55, hs * 0.5, hs * 0.35, 0, 0, Math.PI * 2);
    fillStroke(k, k.body);
  }
  c.strokeStyle = shade(def.look.body, -0.5);
  c.lineWidth = k.lw;
  c.beginPath();
  c.moveTo(hs * 0.6, hs * 0.25 + p.mouth * hs * 0.2);
  c.lineTo(hs * 1.35, hs * 0.1);
  c.stroke();
  eye(k, hs * 0.2, -hs * 0.15, hs * 0.22, false);
  c.restore();
}

function quadBase(k: Ctx2, legH: number, rx: number, ry: number, tilt: number, frontScale = 1) {
  const { c, L, p } = k;
  const bodyCx = -L * 0.03;
  const bodyCy = -legH - ry * 0.6;
  const thick = L * 0.08;
  pillarLeg(k, bodyCx - rx * 0.55, bodyCy + ry * 0.4, legH + ry * 0.2, p.walk + Math.PI, k.dark, thick);
  pillarLeg(k, bodyCx + rx * 0.55, bodyCy + ry * 0.4, (legH + ry * 0.2) * frontScale, p.walk, k.dark, thick * 0.9);
  return { bodyCx, bodyCy, thick, draw: () => {
    c.beginPath();
    c.ellipse(bodyCx, bodyCy, rx, ry, tilt, 0, Math.PI * 2);
    fillStroke(k, k.body);
    c.beginPath();
    c.ellipse(bodyCx, bodyCy + ry * 0.5, rx * 0.8, ry * 0.42, tilt, 0, Math.PI * 2);
    c.fillStyle = k.belly;
    c.fill();
    pattern(k, bodyCx, bodyCy - ry * 0.2, rx, ry * 0.8, tilt);
    mud(k, bodyCx, bodyCy, rx, ry);
  }, near: () => {
    pillarLeg(k, bodyCx - rx * 0.45, bodyCy + ry * 0.5, legH + ry * 0.1, p.walk, k.body, thick * 1.1);
    pillarLeg(k, bodyCx + rx * 0.62, bodyCy + ry * 0.5, (legH + ry * 0.1) * frontScale, p.walk + Math.PI, k.body, thick);
  } };
}

function ceratopsian(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const legH = L * 0.17 * (s.legs ?? 1) * (1 - p.lie * 0.8);
  const rx = L * 0.27;
  const ry = L * 0.15;
  const q = quadBase(k, legH, rx, ry, 0.04);
  tail(k, q.bodyCx - rx * 0.85, q.bodyCy - ry * 0.4, q.bodyCy + ry * 0.4, q.bodyCx - rx - L * 0.22 * (s.tail ?? 1), q.bodyCy + L * 0.05);
  q.draw();
  q.near();
  // head + frill
  const hs = L * 0.13 * (s.head ?? 1) * (1 + p.baby * 0.3);
  const hx = q.bodyCx + rx * 0.95;
  const hy = q.bodyCy + ry * 0.1 + p.headDown * L * 0.08 - p.headUp * L * 0.05;
  c.save();
  c.translate(hx, hy);
  c.rotate(-0.15 + p.headDown * 0.35 - p.headUp * 0.4);
  // frill
  c.beginPath();
  c.ellipse(-hs * 0.35, -hs * 0.45, hs * 0.95, hs * 1.05, -0.5, 0, Math.PI * 2);
  fillStroke(k, def.look.accent);
  c.beginPath();
  c.ellipse(-hs * 0.3, -hs * 0.4, hs * 0.72, hs * 0.82, -0.5, 0, Math.PI * 2);
  c.fillStyle = shade(def.look.body, 0.1);
  c.fill();
  c.fillStyle = shade(def.look.accent, -0.2);
  for (let i = 0; i < 6; i++) {
    const a = -2.6 + i * 0.5;
    c.beginPath();
    c.arc(-hs * 0.35 + Math.cos(a) * hs * 0.98, -hs * 0.45 + Math.sin(a) * hs * 1.05, hs * 0.1, 0, Math.PI * 2);
    c.fill();
  }
  // face
  c.beginPath();
  c.moveTo(-hs * 0.3, -hs * 0.3);
  c.quadraticCurveTo(hs * 0.6, -hs * 0.55, hs * 1.15, hs * 0.05);
  c.lineTo(hs * 0.95, hs * 0.45);
  c.quadraticCurveTo(hs * 0.2, hs * 0.6, -hs * 0.3, hs * 0.35);
  c.closePath();
  fillStroke(k, k.body);
  // beak
  c.beginPath();
  c.moveTo(hs * 0.95, hs * 0.0);
  c.lineTo(hs * 1.35, hs * 0.25);
  c.lineTo(hs * 0.95, hs * 0.48);
  c.closePath();
  fillStroke(k, shade(def.look.body, -0.35));
  // horns
  if (s.horns === "trike") {
    c.fillStyle = "#f3ead2";
    c.strokeStyle = OUTLINE;
    c.lineWidth = k.lw;
    for (const off of [0, hs * 0.12]) {
      c.beginPath();
      c.moveTo(hs * 0.1 + off, -hs * 0.35);
      c.quadraticCurveTo(hs * 0.7 + off, -hs * 0.8, hs * 1.35 + off, -hs * 1.05);
      c.lineTo(hs * 0.35 + off, -hs * 0.25);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.beginPath();
    c.moveTo(hs * 0.85, -hs * 0.1);
    c.lineTo(hs * 1.05, -hs * 0.45);
    c.lineTo(hs * 1.08, -hs * 0.05);
    c.closePath();
    c.fill();
    c.stroke();
  }
  eye(k, hs * 0.2, -hs * 0.1, hs * 0.13, false);
  c.restore();
}

function stegosaur(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const legH = L * 0.2 * (s.legs ?? 1) * (1 - p.lie * 0.8);
  const rx = L * 0.25;
  const ry = L * 0.15;
  const q = quadBase(k, legH, rx, ry, 0.14, 0.72);
  // plates sit behind the body
  if (s.plates) {
    for (let i = 0; i < 9; i++) {
      const tt = i / 8;
      const a = Math.PI + tt * Math.PI;
      const bx = q.bodyCx + Math.cos(a) * rx * 0.92 * -1;
      const by = q.bodyCy + Math.sin(a) * ry * 0.92 - L * 0.01 + tt * L * 0.02;
      const ph = L * (0.06 + Math.sin(tt * Math.PI) * 0.09) * (i % 2 ? 0.8 : 1);
      c.beginPath();
      c.moveTo(bx - ph * 0.4, by + ph * 0.1);
      c.lineTo(bx - ph * 0.1, by - ph);
      c.lineTo(bx + ph * 0.4, by + ph * 0.1);
      c.closePath();
      fillStroke(k, i % 2 ? shade(def.look.accent, -0.15) : def.look.accent);
    }
  }
  const tl = tail(k, q.bodyCx - rx * 0.85, q.bodyCy - ry * 0.5, q.bodyCy + ry * 0.35, q.bodyCx - rx - L * 0.38 * (s.tail ?? 1), q.bodyCy - L * 0.06);
  if (s.spikes) {
    c.fillStyle = "#efe6cf";
    c.strokeStyle = OUTLINE;
    c.lineWidth = k.lw;
    for (let i = 0; i < 4; i++) {
      const x = tl.tipX + L * 0.03 + (i >> 1) * L * 0.05;
      const up = i % 2 ? -1 : -0.6;
      c.beginPath();
      c.moveTo(x - L * 0.012, tl.tipY);
      c.lineTo(x - L * 0.05, tl.tipY + up * L * 0.09);
      c.lineTo(x + L * 0.012, tl.tipY);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
  q.draw();
  q.near();
  // tiny head, low to the ground
  const hs = L * 0.07 * (s.head ?? 0.6) * 1.4 * (1 + p.baby * 0.4);
  const hx = q.bodyCx + rx * 1.1;
  const hy = q.bodyCy + ry * 0.45 + p.headDown * L * 0.06;
  c.strokeStyle = OUTLINE;
  c.lineWidth = L * 0.05 + k.lw * 2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(q.bodyCx + rx * 0.8, q.bodyCy + ry * 0.1);
  c.lineTo(hx, hy);
  c.stroke();
  c.strokeStyle = k.body;
  c.lineWidth = L * 0.05;
  c.stroke();
  c.beginPath();
  c.ellipse(hx + hs * 0.3, hy, hs * 1.1, hs * 0.6, 0.2, 0, Math.PI * 2);
  fillStroke(k, k.body);
  eye(k, hx + hs * 0.2, hy - hs * 0.15, hs * 0.22, false);
}

function ankylosaur(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const legH = L * 0.11 * (s.legs ?? 1) * (1 - p.lie * 0.7);
  const rx = L * 0.3;
  const ry = L * 0.15;
  const bodyCx = -L * 0.02;
  const bodyCy = -legH - ry * 0.35;
  const thick = L * 0.085;
  pillarLeg(k, bodyCx - rx * 0.5, bodyCy, legH + ry * 0.35, p.walk + Math.PI, k.dark, thick);
  pillarLeg(k, bodyCx + rx * 0.5, bodyCy, legH + ry * 0.35, p.walk, k.dark, thick);
  // tail + club
  const tl = tail(k, bodyCx - rx * 0.8, bodyCy - ry * 0.4, bodyCy + ry * 0.3, bodyCx - rx - L * 0.32 * (s.tail ?? 1), bodyCy - L * 0.01);
  if (s.club) {
    c.beginPath();
    c.ellipse(tl.tipX, tl.tipY, L * 0.065, L * 0.045, 0, 0, Math.PI * 2);
    fillStroke(k, shade(def.look.body, -0.2));
  }
  // armored dome
  c.beginPath();
  c.ellipse(bodyCx, bodyCy, rx, ry * 1.25, 0, Math.PI, 0);
  c.lineTo(bodyCx + rx, bodyCy + ry * 0.35);
  c.quadraticCurveTo(bodyCx, bodyCy + ry * 0.7, bodyCx - rx, bodyCy + ry * 0.35);
  c.closePath();
  fillStroke(k, k.body);
  c.fillStyle = shade(def.look.body, -0.18);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + ((i + 0.5 + (r % 2) * 0.5) / 6.5) * Math.PI;
      const rr = 0.85 - r * 0.28;
      c.beginPath();
      c.arc(bodyCx + Math.cos(a) * rx * rr, bodyCy + Math.sin(a) * ry * 1.2 * rr, L * 0.022, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = "#efe6cf";
  for (let i = 0; i < 5; i++) {
    const x = bodyCx - rx * 0.85 + i * rx * 0.42;
    c.beginPath();
    c.moveTo(x - L * 0.02, bodyCy + ry * 0.3);
    c.lineTo(x, bodyCy + ry * 0.62);
    c.lineTo(x + L * 0.02, bodyCy + ry * 0.3);
    c.fill();
  }
  mud(k, bodyCx, bodyCy, rx, ry);
  pillarLeg(k, bodyCx - rx * 0.4, bodyCy + ry * 0.3, legH + ry * 0.05, p.walk, k.body, thick * 1.1);
  pillarLeg(k, bodyCx + rx * 0.6, bodyCy + ry * 0.3, legH + ry * 0.05, p.walk + Math.PI, k.body, thick * 1.1);
  // wedge head
  const hs = L * 0.08 * (s.head ?? 0.7) * 1.3 * (1 + p.baby * 0.4);
  const hx = bodyCx + rx * 1.02;
  const hy = bodyCy + ry * 0.2 + p.headDown * L * 0.04;
  c.beginPath();
  c.moveTo(hx - hs * 0.4, hy - hs * 0.55);
  c.lineTo(hx + hs * 0.9, hy - hs * 0.2);
  c.lineTo(hx + hs * 1.0, hy + hs * 0.35);
  c.lineTo(hx - hs * 0.3, hy + hs * 0.5);
  c.closePath();
  fillStroke(k, k.body);
  c.fillStyle = "#efe6cf";
  c.beginPath();
  c.moveTo(hx - hs * 0.35, hy - hs * 0.5);
  c.lineTo(hx - hs * 0.7, hy - hs * 0.75);
  c.lineTo(hx - hs * 0.15, hy - hs * 0.4);
  c.fill();
  eye(k, hx + hs * 0.2, hy - hs * 0.1, hs * 0.18, false);
}

function hadrosaur(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const lie = p.lie;
  const legH = L * 0.27 * (s.legs ?? 1) * (1 - lie * 0.8);
  const hipX = -L * 0.08;
  const hipY = -legH - L * 0.02;
  const lean = Math.min(1, p.headDown + p.stride * 0.3);
  const bodyCx = L * 0.02;
  const bodyCy = hipY - L * 0.04 + lean * L * 0.04;
  const rx = L * 0.22;
  const ry = L * 0.12;
  const tilt = -0.05 + lean * 0.3;
  const thick = L * 0.085;
  bipedLeg(k, hipX, hipY, -hipY, p.walk + Math.PI, k.dark, thick);
  // front legs reach the ground when leaning
  const fx = bodyCx + rx * 0.7;
  const fy = bodyCy + ry * 0.4;
  const armReach = -fy * (0.55 + lean * 0.45);
  const sw = Math.sin(p.walk + Math.PI / 2) * p.stride * L * 0.05;
  limb(k, fx, fy, fx + L * 0.03 + sw * 0.5, fy + armReach * 0.5, fx + sw + L * 0.02, fy + armReach, L * 0.035, L * 0.03, k.dark);
  tail(k, bodyCx - rx * 0.7, bodyCy - ry * 0.7, bodyCy + ry * 0.5, bodyCx - rx - L * 0.45 * (s.tail ?? 1), bodyCy - L * 0.06 + lean * L * 0.02);
  c.beginPath();
  c.ellipse(bodyCx, bodyCy, rx, ry, tilt, 0, Math.PI * 2);
  fillStroke(k, k.body);
  c.beginPath();
  c.ellipse(bodyCx + rx * 0.1, bodyCy + ry * 0.45, rx * 0.75, ry * 0.42, tilt, 0, Math.PI * 2);
  c.fillStyle = k.belly;
  c.fill();
  pattern(k, bodyCx, bodyCy - ry * 0.2, rx, ry * 0.8, tilt);
  mud(k, bodyCx, bodyCy, rx, ry);
  bipedLeg(k, hipX + L * 0.02, hipY, -hipY, p.walk, k.body, thick * 1.1);
  limb(k, fx + L * 0.02, fy, fx + L * 0.05 - sw * 0.5, fy + armReach * 0.5, fx - sw + L * 0.04, fy + armReach, L * 0.035, L * 0.03, k.body);
  if (s.thumb) {
    c.fillStyle = "#efe6cf";
    c.beginPath();
    c.moveTo(fx - sw + L * 0.04, fy + armReach * 0.85);
    c.lineTo(fx - sw + L * 0.09, fy + armReach * 0.7);
    c.lineTo(fx - sw + L * 0.06, fy + armReach * 0.95);
    c.fill();
  }
  // neck + head
  const ang = -0.9 + lean * 1.1 - p.headUp * 0.5;
  const nl = L * 0.18;
  const nx0 = bodyCx + rx * 0.8;
  const ny0 = bodyCy - ry * 0.3;
  const hx = nx0 + Math.cos(ang) * nl;
  const hy = ny0 + Math.sin(ang) * nl;
  c.lineCap = "round";
  c.strokeStyle = OUTLINE;
  c.lineWidth = L * 0.07 + k.lw * 2;
  c.beginPath();
  c.moveTo(nx0 - L * 0.03, ny0 + L * 0.03);
  c.lineTo(hx, hy);
  c.stroke();
  c.strokeStyle = k.body;
  c.lineWidth = L * 0.07;
  c.stroke();
  const hs = L * 0.085 * (s.head ?? 0.85) * (1 + p.baby * 0.4);
  c.save();
  c.translate(hx, hy);
  c.rotate(ang * 0.4 + 0.35);
  if (s.crest === "tube") {
    c.strokeStyle = OUTLINE;
    c.lineWidth = hs * 0.45 + k.lw * 2;
    c.beginPath();
    c.moveTo(0, -hs * 0.3);
    c.quadraticCurveTo(-hs * 1.2, -hs * 0.9, -hs * 2.4, -hs * 0.6);
    c.stroke();
    c.strokeStyle = def.look.accent;
    c.lineWidth = hs * 0.45;
    c.stroke();
  }
  c.beginPath();
  c.moveTo(-hs * 0.5, -hs * 0.35);
  c.quadraticCurveTo(hs * 0.3, -hs * 0.65, hs * 1.4, -hs * 0.1);
  c.quadraticCurveTo(hs * 1.7, hs * 0.15, hs * 1.4, hs * 0.35);
  c.quadraticCurveTo(hs * 0.3, hs * 0.5 + p.mouth * hs * 0.3, -hs * 0.4, hs * 0.35);
  c.closePath();
  fillStroke(k, k.body);
  c.fillStyle = shade(def.look.body, -0.4);
  c.beginPath();
  c.ellipse(hs * 1.45, hs * 0.12, hs * 0.22, hs * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  eye(k, hs * 0.1, -hs * 0.15, hs * 0.17, false);
  c.restore();
}

function pachy(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const lie = p.lie;
  const legH = L * 0.3 * (s.legs ?? 1) * (1 - lie * 0.8);
  const hipX = -L * 0.06;
  const hipY = -legH - L * 0.02;
  const bodyCx = L * 0.02;
  const bodyCy = hipY - L * 0.05;
  const rx = L * 0.2;
  const ry = L * 0.13;
  const tilt = -0.1 + p.headDown * 0.25;
  const thick = L * 0.08;
  bipedLeg(k, hipX, hipY, -hipY, p.walk + Math.PI, k.dark, thick);
  tail(k, bodyCx - rx * 0.7, bodyCy - ry * 0.6, bodyCy + ry * 0.5, bodyCx - rx - L * 0.45 * (s.tail ?? 1), bodyCy - L * 0.04);
  c.beginPath();
  c.ellipse(bodyCx, bodyCy, rx, ry, tilt, 0, Math.PI * 2);
  fillStroke(k, k.body);
  c.beginPath();
  c.ellipse(bodyCx + rx * 0.1, bodyCy + ry * 0.45, rx * 0.7, ry * 0.42, tilt, 0, Math.PI * 2);
  c.fillStyle = k.belly;
  c.fill();
  pattern(k, bodyCx, bodyCy - ry * 0.2, rx, ry * 0.8, tilt);
  mud(k, bodyCx, bodyCy, rx, ry);
  bipedLeg(k, hipX + L * 0.02, hipY, -hipY, p.walk, k.body, thick * 1.1);
  const ax = bodyCx + rx * 0.6;
  const ay = bodyCy + ry * 0.2;
  limb(k, ax, ay, ax + L * 0.05, ay + L * 0.06, ax + L * 0.09, ay + L * 0.04, L * 0.03, L * 0.025, k.body);
  // dome head
  const hs = L * 0.12 * (s.head ?? 1) * (1 + p.baby * 0.35);
  const ang = -0.4 + p.headDown * 1.0 - p.headUp * 0.6;
  const hx = bodyCx + rx * 0.9 + Math.cos(ang) * L * 0.1;
  const hy = bodyCy - ry * 0.4 + Math.sin(ang) * L * 0.1;
  c.lineCap = "round";
  c.strokeStyle = OUTLINE;
  c.lineWidth = L * 0.08 + k.lw * 2;
  c.beginPath();
  c.moveTo(bodyCx + rx * 0.7, bodyCy - ry * 0.3);
  c.lineTo(hx, hy);
  c.stroke();
  c.strokeStyle = k.body;
  c.lineWidth = L * 0.08;
  c.stroke();
  c.save();
  c.translate(hx, hy);
  c.rotate(ang * 0.5);
  c.beginPath();
  c.moveTo(-hs * 0.4, hs * 0.1);
  c.lineTo(hs * 0.95, hs * 0.25);
  c.quadraticCurveTo(hs * 1.1, hs * 0.5, hs * 0.6, hs * 0.55);
  c.lineTo(-hs * 0.3, hs * 0.5);
  c.closePath();
  fillStroke(k, k.body);
  c.beginPath();
  c.ellipse(hs * 0.15, -hs * 0.05, hs * 0.7, hs * 0.6, 0, Math.PI, 0);
  c.closePath();
  fillStroke(k, def.look.accent);
  c.fillStyle = shade(def.look.accent, -0.25);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 5);
    c.beginPath();
    c.arc(hs * 0.15 + Math.cos(a) * hs * 0.72, -hs * 0.05 + Math.sin(a) * hs * 0.62, hs * 0.08, 0, Math.PI * 2);
    c.fill();
  }
  eye(k, hs * 0.35, hs * 0.18, hs * 0.13, false);
  c.restore();
}

function pterosaur(k: Ctx2) {
  const { c, L, def, p } = k;
  const s = def.shape;
  const span = L * 1.25 * (s.wings ?? 1);
  const isPtera = s.crest === "ptera";
  const hs = L * 0.12 * (s.head ?? 1) * (1 + p.baby * 0.3);
  if (p.flying) {
    // side view, wings sweeping up and down together (far wing a beat ahead)
    const flap = Math.sin(p.wing);
    const wingPath = (lift: number, color: string, near: boolean) => {
      const tipY = -span * 0.62 * lift;
      const elbY = -span * 0.32 * lift;
      c.beginPath();
      c.moveTo(L * 0.1, -L * 0.03);
      c.quadraticCurveTo(L * 0.02, elbY - L * 0.04, -L * 0.06, elbY);
      c.lineTo(-L * 0.38, tipY);
      c.quadraticCurveTo(-L * 0.3, tipY * 0.45 + L * 0.06, -L * 0.2, L * 0.02);
      c.closePath();
      fillStroke(k, color);
      // wing finger along the leading edge
      c.strokeStyle = shade(def.look.body, near ? -0.35 : -0.45);
      c.lineWidth = k.lw * 1.3;
      c.beginPath();
      c.moveTo(L * 0.08, -L * 0.03);
      c.quadraticCurveTo(L * 0.02, elbY - L * 0.04, -L * 0.06, elbY);
      c.lineTo(-L * 0.38, tipY);
      c.stroke();
    };
    wingPath(flap * 0.95 + 0.15, shade(def.look.body, -0.18), false);
    if (s.tail) {
      const tw = Math.sin(p.t * 6) * L * 0.03;
      c.strokeStyle = k.body;
      c.lineWidth = k.lw * 1.6;
      c.beginPath();
      c.moveTo(-L * 0.15, 0);
      c.quadraticCurveTo(-L * 0.35, tw, -L * 0.55, tw * 1.5);
      c.stroke();
      c.fillStyle = def.look.accent;
      c.beginPath();
      c.moveTo(-L * 0.55, tw * 1.5);
      c.lineTo(-L * 0.6, tw * 1.5 - L * 0.04);
      c.lineTo(-L * 0.65, tw * 1.5);
      c.lineTo(-L * 0.6, tw * 1.5 + L * 0.04);
      c.closePath();
      c.fill();
    }
    // body + little tucked legs
    c.strokeStyle = k.dark;
    c.lineWidth = k.lw * 1.4;
    c.beginPath();
    c.moveTo(-L * 0.1, L * 0.03);
    c.lineTo(-L * 0.2, L * 0.07);
    c.stroke();
    c.beginPath();
    c.ellipse(0, 0, L * 0.17, L * 0.065, -0.08, 0, Math.PI * 2);
    fillStroke(k, k.body);
    c.beginPath();
    c.ellipse(L * 0.02, L * 0.025, L * 0.12, L * 0.03, -0.08, 0, Math.PI * 2);
    c.fillStyle = k.belly;
    c.fill();
    c.save();
    c.translate(L * 0.2, -L * 0.04);
    c.rotate(0.1);
    ptHead(k, hs, isPtera);
    c.restore();
    wingPath(flap * 0.95 - 0.1, k.body, true);
    return;
  }
  // perched / walking on folded wings
  const legH = L * 0.18 * (1 - p.lie * 0.6);
  bipedLeg(k, -L * 0.05, -legH, legH, p.walk + Math.PI, k.dark, L * 0.035);
  c.beginPath();
  c.ellipse(0, -legH - L * 0.08, L * 0.13, L * 0.12, -0.6, 0, Math.PI * 2);
  fillStroke(k, k.body);
  // folded wing
  c.beginPath();
  c.moveTo(L * 0.05, -legH - L * 0.15);
  c.lineTo(L * 0.18, -L * 0.02);
  c.lineTo(-L * 0.12, -legH - L * 0.02);
  c.closePath();
  fillStroke(k, shade(def.look.body, -0.15));
  bipedLeg(k, -L * 0.02, -legH, legH, p.walk, k.body, L * 0.04);
  c.save();
  c.translate(L * 0.1, -legH - L * 0.2 + p.headDown * L * 0.1);
  c.rotate(-0.2 + p.headDown * 0.6 - p.headUp * 0.5);
  ptHead(k, hs, isPtera);
  c.restore();
}

function ptHead(k: Ctx2, hs: number, isPtera: boolean) {
  const { c, def, p } = k;
  if (isPtera) {
    c.beginPath();
    c.moveTo(-hs * 0.3, -hs * 0.2);
    c.lineTo(-hs * 1.7, -hs * 0.9);
    c.lineTo(-hs * 0.1, -hs * 0.45);
    c.closePath();
    fillStroke(k, def.look.accent);
  }
  c.beginPath();
  c.ellipse(0, -hs * 0.1, hs * 0.45, hs * 0.38, 0, 0, Math.PI * 2);
  fillStroke(k, k.body);
  // beak
  const beak = isPtera ? hs * 2.2 : hs * 1.1;
  c.beginPath();
  c.moveTo(hs * 0.25, -hs * 0.25);
  c.lineTo(beak, hs * 0.05 - p.mouth * hs * 0.1);
  c.lineTo(hs * 0.25, hs * 0.15 + p.mouth * hs * 0.25);
  c.closePath();
  fillStroke(k, isPtera ? shade(def.look.accent, 0.35) : shade(def.look.body, 0.25));
  if (!isPtera) {
    c.fillStyle = "#fffaf0";
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(hs * 0.45 + i * hs * 0.18, hs * 0.05, hs * 0.05, 0, Math.PI * 2);
      c.fill();
    }
  }
  eye(k, hs * 0.05, -hs * 0.18, hs * 0.13, false);
}

function mosasaur(k: Ctx2) {
  const { c, L, def, p } = k;
  const under = p.submerged;
  c.save();
  c.globalAlpha *= 1 - under * 0.45;
  const arch = (1 - under) * 0.5;
  c.rotate(-arch * 0.6);
  // flippers
  const fl = Math.sin(p.t * 3) * 0.3;
  c.beginPath();
  c.ellipse(L * 0.12, L * 0.06, L * 0.1, L * 0.03, 0.6 + fl, 0, Math.PI * 2);
  fillStroke(k, k.dark);
  c.beginPath();
  c.ellipse(-L * 0.12, L * 0.06, L * 0.08, L * 0.025, 0.6 - fl, 0, Math.PI * 2);
  fillStroke(k, k.dark);
  // tail with fin
  const sw = Math.sin(p.t * 2.5) * L * 0.04;
  c.beginPath();
  c.moveTo(-L * 0.15, -L * 0.05);
  c.quadraticCurveTo(-L * 0.35, -L * 0.02 + sw, -L * 0.5, sw);
  c.quadraticCurveTo(-L * 0.35, L * 0.04 + sw, -L * 0.15, L * 0.05);
  c.closePath();
  fillStroke(k, k.body);
  c.beginPath();
  c.moveTo(-L * 0.47, sw);
  c.lineTo(-L * 0.58, sw - L * 0.09);
  c.lineTo(-L * 0.56, sw + L * 0.05);
  c.closePath();
  fillStroke(k, k.dark);
  // body
  c.beginPath();
  c.ellipse(0, 0, L * 0.22, L * 0.075, 0, 0, Math.PI * 2);
  fillStroke(k, k.body);
  c.beginPath();
  c.ellipse(L * 0.02, L * 0.035, L * 0.17, L * 0.035, 0, 0, Math.PI * 2);
  c.fillStyle = k.belly;
  c.fill();
  // head
  c.beginPath();
  c.moveTo(L * 0.18, -L * 0.05);
  c.quadraticCurveTo(L * 0.35, -L * 0.06, L * 0.42, -L * 0.005);
  c.lineTo(L * 0.2, L * 0.045 + p.mouth * L * 0.05);
  c.closePath();
  fillStroke(k, k.body);
  c.fillStyle = "#fffaf0";
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(L * (0.24 + i * 0.04), L * 0.0);
    c.lineTo(L * (0.25 + i * 0.04), L * 0.018);
    c.lineTo(L * (0.26 + i * 0.04), L * 0.0);
    c.fill();
  }
  eye(k, L * 0.27, -L * 0.03, L * 0.014, true);
  c.restore();
  void def;
}

const PAINTERS: Record<BodyPlan, (k: Ctx2) => void> = {
  theropod,
  sauropod,
  ceratopsian,
  stegosaur,
  ankylosaur,
  hadrosaur,
  pachy,
  pterosaur,
  mosasaur,
};

/**
 * Draw a dinosaur with its feet at (0,0) of the current transform.
 * `L` = body length in px, `dir` = facing.
 */
export function drawDino(c: CanvasRenderingContext2D, def: SpeciesDef, L: number, dir: 1 | -1, p: DinoPose) {
  const k: Ctx2 = {
    c,
    L,
    def,
    p,
    body: def.look.body,
    dark: shade(def.look.body, -0.22),
    belly: def.look.belly,
    accent: def.look.accent,
    lw: Math.max(0.8, L * 0.012),
  };
  c.save();
  c.scale(dir, 1);
  if (p.flip > 0) {
    // cartoon knock-over: tip onto its side around the belly
    c.translate(0, -L * 0.12);
    c.rotate(-p.flip * 1.4);
    c.translate(0, L * 0.12 * (1 - p.flip * 0.6));
  }
  if (p.dangle) c.rotate(Math.sin(p.t * 5) * 0.12);
  const breathe = 1 + Math.sin(p.t * 2.4) * 0.012;
  c.scale(1, breathe);
  PAINTERS[def.plan](k);
  c.restore();
}
