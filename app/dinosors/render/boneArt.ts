/* ------------------------------------------------------------------ */
/*  Bodies + bones: dinosaur carcasses at every harvest stage, and the */
/*  bone defences (spikes, barricades, totems) + the hide rack.        */
/*  Stylised on purpose: cartoon ✖ eyes, a neat "cut" patch with ribs, */
/*  clean bones — readable, a little intense, never gory.              */
/* ------------------------------------------------------------------ */
import { shade } from "./drawDino";

export interface CarcassLook {
  body: string;
  belly: string;
  plan: string;
  carnivore: boolean;
  horned: boolean;
  plates: boolean;
  /** 0 = untouched … 1 = only bones */
  k: number;
  stage: "fresh" | "partial" | "mostly" | "bones";
  burnt: boolean;
  rot: number;
}

/** A body lying on its side. Origin: ground centre; `dir` = which way the head points. */
export function drawCarcass(c: CanvasRenderingContext2D, size: number, dir: 1 | -1, look: CarcassLook, t: number) {
  // a body lying down looks as big as the animal did standing up
  const L = size * 1.3;
  const long = look.plan === "sauropod";
  const a = L * (long ? 0.26 : 0.3);
  const b = L * (long ? 0.13 : 0.13);
  const cy = -b * 0.9;
  c.save();
  c.scale(dir, 1);
  // churned earth underneath (no blood)
  c.fillStyle = "rgba(60,42,28,0.28)";
  c.beginPath();
  c.ellipse(0, 1, a * 1.5, b * 0.75, 0, 0, Math.PI * 2);
  c.fill();
  const headX = long ? a + L * 0.36 : a + L * 0.1;
  const headY = long ? cy + L * 0.02 : cy - b * 0.1;
  const tailX = -a - L * (long ? 0.42 : 0.34);
  if (look.stage === "fresh" || look.stage === "partial") {
    const body = look.rot > 0.3 ? shade(look.body, -0.25 * look.rot) : look.body;
    c.fillStyle = body;
    // tail
    c.beginPath();
    c.moveTo(-a * 0.8, cy - b * 0.6);
    c.quadraticCurveTo(-a - L * 0.12, cy - b * 0.2, tailX, cy + b * 0.5);
    c.quadraticCurveTo(-a - L * 0.1, cy + b * 0.9, -a * 0.7, cy + b * 0.85);
    c.closePath();
    c.fill();
    if (long) {
      c.beginPath();
      c.moveTo(a * 0.7, cy - b * 0.7);
      c.quadraticCurveTo(a + L * 0.18, cy - b * 0.9, headX - L * 0.03, headY - L * 0.02);
      c.lineTo(headX - L * 0.02, headY + L * 0.04);
      c.quadraticCurveTo(a + L * 0.16, cy + b * 0.2, a * 0.7, cy + b * 0.5);
      c.closePath();
      c.fill();
    }
    // stiff cartoon legs
    c.strokeStyle = shade(body, -0.2);
    c.lineCap = "round";
    c.lineWidth = Math.max(2, L * 0.05);
    for (const x of [-a * 0.45, a * 0.4]) {
      c.beginPath();
      c.moveTo(x, cy + b * 0.6);
      c.lineTo(x + L * 0.07, cy + b * 1.35);
      c.stroke();
    }
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(0, cy, a, b, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = look.belly;
    c.beginPath();
    c.ellipse(a * 0.05, cy + b * 0.45, a * 0.82, b * 0.42, 0, 0, Math.PI * 2);
    c.fill();
    if (look.plates) {
      c.fillStyle = shade(body, -0.25);
      for (let i = 0; i < 5; i++) {
        const x = -a * 0.6 + i * a * 0.3;
        c.beginPath();
        c.moveTo(x - L * 0.03, cy - b * 0.85);
        c.lineTo(x, cy - b * 0.85 - L * 0.07);
        c.lineTo(x + L * 0.03, cy - b * 0.85);
        c.fill();
      }
    }
    // head + ✖ eye
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(headX, headY, L * 0.09, L * 0.055, 0.15, 0, Math.PI * 2);
    c.fill();
    if (look.horned) {
      c.fillStyle = "#efe6cf";
      c.beginPath();
      c.moveTo(headX + L * 0.04, headY - L * 0.03);
      c.lineTo(headX + L * 0.12, headY - L * 0.08);
      c.lineTo(headX + L * 0.06, headY);
      c.fill();
    }
    c.strokeStyle = "#2a1e16";
    c.lineWidth = Math.max(1.2, L * 0.012);
    const ex = headX + L * 0.02;
    const ey = headY - L * 0.015;
    const e = L * 0.018;
    c.beginPath();
    c.moveTo(ex - e, ey - e);
    c.lineTo(ex + e, ey + e);
    c.moveTo(ex + e, ey - e);
    c.lineTo(ex - e, ey + e);
    c.stroke();
    if (look.stage === "partial") {
      // hide peeled back in a neat patch, ribs showing
      const k = Math.min(1, (look.k - 0.15) / 0.35);
      const pw = a * (0.35 + k * 0.45);
      const ph = b * (0.55 + k * 0.3);
      c.fillStyle = "#d9786b";
      c.beginPath();
      c.ellipse(-a * 0.05, cy - b * 0.05, pw, ph, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,210,200,0.55)";
      c.beginPath();
      c.ellipse(-a * 0.1, cy - b * 0.25, pw * 0.6, ph * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#f5eedf";
      c.lineWidth = Math.max(1.4, L * 0.018);
      const ribs = 3 + Math.round(k * 2);
      for (let i = 0; i < ribs; i++) {
        const x = -pw * 0.7 + (i * pw * 1.4) / Math.max(1, ribs - 1) - a * 0.05;
        c.beginPath();
        c.moveTo(x, cy - ph * 0.75);
        c.quadraticCurveTo(x + L * 0.03, cy, x, cy + ph * 0.75);
        c.stroke();
      }
      c.strokeStyle = shade(body, -0.3);
      c.lineWidth = 1.2;
      c.beginPath();
      for (let i = 0; i <= 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const r = i % 2 ? 1.08 : 1;
        const x = -a * 0.05 + Math.cos(ang) * pw * r;
        const y = cy - b * 0.05 + Math.sin(ang) * ph * r;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  } else drawSkeleton(c, L, a, b, cy, headX, headY, tailX, look, t);
  c.restore();
}

function drawSkeleton(c: CanvasRenderingContext2D, L: number, a: number, b: number, cy: number, headX: number, headY: number, tailX: number, look: CarcassLook, t: number) {
  const bone = look.burnt ? "#4a4440" : look.stage === "bones" ? "#efe8d6" : "#f5eedf";
  const shadow = look.burnt ? "#2a2522" : "#b9ad95";
  const lw = Math.max(1.8, L * 0.03);
  c.lineCap = "round";
  const spine: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const s = i / 14;
    const x = tailX + (headX - L * 0.06 - tailX) * s;
    const y = cy - b * 0.6 * Math.sin(s * Math.PI) + (1 - s) * b * 0.5 + (s > 0.85 ? (headY - cy) * ((s - 0.85) / 0.15) : 0);
    spine.push([x, y]);
  }
  if (look.stage === "mostly") {
    // a few chunks still on the bones + a scrap of hide
    const k = Math.max(0, Math.min(1, (0.92 - look.k) / 0.42));
    c.fillStyle = look.rot > 0.4 ? "#a46a5c" : "#d9786b";
    for (let i = 0; i < 3 + Math.round(k * 3); i++) {
      const x = -a * 0.6 + ((i * 37) % 10) * a * 0.12;
      c.beginPath();
      c.ellipse(x, cy + b * (((i * 13) % 5) * 0.12 - 0.15), L * (0.035 + k * 0.03), L * (0.025 + k * 0.02), 0.3, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = shade(look.body, -0.1);
    c.beginPath();
    c.ellipse(-a * 0.8, cy + b * 1.1, L * 0.08 * k + L * 0.03, L * 0.025, -0.2, 0, Math.PI * 2);
    c.fill();
  }
  // ribs (shadow, then bone)
  for (const [col, w, dy] of [
    [shadow, lw * 1.25, 0.05],
    [bone, lw, 0],
  ] as [string, number, number][]) {
    c.strokeStyle = col;
    c.lineWidth = w;
    for (let i = 0; i < 7; i++) {
      const x = -a * 0.75 + i * a * 0.25;
      c.beginPath();
      c.moveTo(x, cy - b * (0.6 - dy));
      c.quadraticCurveTo(x + L * 0.04, cy + b * (0.15 + dy), x - L * 0.01, cy + b * (0.75 + dy));
      c.stroke();
    }
  }
  c.fillStyle = bone;
  for (let i = 0; i < spine.length; i++) {
    const [x, y] = spine[i];
    c.beginPath();
    c.arc(x, y, Math.max(1.2, L * (0.012 + 0.012 * Math.sin((i / spine.length) * Math.PI))), 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = bone;
  c.lineWidth = lw * 1.2;
  for (const x of [-a * 0.45, a * 0.4]) {
    c.beginPath();
    c.moveTo(x, cy + b * 0.3);
    c.lineTo(x + L * 0.06, cy + b * 1.0);
    c.lineTo(x + L * 0.1, cy + b * 1.35);
    c.stroke();
  }
  if (look.plates) {
    for (let i = 0; i < 4; i++) {
      const x = -a * 0.5 + i * a * 0.3;
      c.beginPath();
      c.moveTo(x - L * 0.025, cy - b * 0.6);
      c.lineTo(x, cy - b * 0.6 - L * 0.06);
      c.lineTo(x + L * 0.025, cy - b * 0.6);
      c.fill();
    }
  }
  // skull
  c.beginPath();
  c.ellipse(headX, headY, L * 0.08, L * 0.048, 0.12, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = look.burnt ? "#1a1614" : "#3a2f26";
  c.beginPath();
  c.ellipse(headX - L * 0.01, headY - L * 0.012, L * 0.02, L * 0.016, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = shadow;
  c.lineWidth = Math.max(0.8, L * 0.008);
  c.beginPath();
  c.moveTo(headX - L * 0.05, headY + L * 0.022);
  c.lineTo(headX + L * 0.075, headY + L * 0.01);
  c.stroke();
  c.fillStyle = bone;
  if (look.carnivore) {
    for (let i = 0; i < 4; i++) {
      const x = headX - L * 0.02 + i * L * 0.022;
      c.beginPath();
      c.moveTo(x, headY + L * 0.014);
      c.lineTo(x + L * 0.008, headY + L * 0.04);
      c.lineTo(x + L * 0.016, headY + L * 0.014);
      c.fill();
    }
  }
  if (look.horned) {
    c.beginPath();
    c.moveTo(headX + L * 0.03, headY - L * 0.03);
    c.lineTo(headX + L * 0.11, headY - L * 0.08);
    c.lineTo(headX + L * 0.05, headY);
    c.fill();
    c.strokeStyle = bone;
    c.lineWidth = lw;
    c.beginPath();
    c.arc(headX - L * 0.07, headY - L * 0.01, L * 0.06, Math.PI * 0.7, Math.PI * 1.5);
    c.stroke();
  }
  if (look.burnt) {
    c.fillStyle = "rgba(120,115,110,0.25)";
    const p = (t * 0.5) % 1;
    c.beginPath();
    c.arc(0, cy - b - p * 20, 3 + p * 5, 0, Math.PI * 2);
    c.fill();
  }
}

/** Sharpened bones in a dirt mound, leaning toward `out` (ground-plane angle away from the walls). */
export function drawSpikes(c: CanvasRenderingContext2D, out: number, built: number, hpFrac: number, seed: number) {
  const lean = Math.cos(out);
  const toward = Math.sin(out);
  c.fillStyle = "rgba(95,72,48,0.55)";
  c.beginPath();
  c.ellipse(0, 0, 15, 5.5, 0, 0, Math.PI * 2);
  c.fill();
  const shown = Math.max(1, Math.round(5 * Math.min(1, built) * (hpFrac < 0.4 ? 0.6 : 1)));
  for (let i = 0; i < shown; i++) {
    const x = -11 + i * 5.5;
    const y = ((i * 7 + seed) % 3) - 1;
    const len = 15 + ((i * 13 + seed) % 5) * 2.2;
    const tipX = x + lean * len * 0.55;
    const tipY = y - len * (0.75 - Math.max(0, toward) * 0.25) + Math.min(0, toward) * 4;
    c.strokeStyle = "#cfc4ab";
    c.lineWidth = 3.4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(tipX, tipY);
    c.stroke();
    c.strokeStyle = "#f3ecd9";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x - 0.6, y - 1);
    c.lineTo(tipX - 0.4, tipY + 1);
    c.stroke();
    c.fillStyle = "#e8dfc9";
    c.beginPath();
    c.arc(x, y, 2.3, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "#8a6238";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-12, -4);
  c.lineTo(12, -4);
  c.stroke();
}

/** Crossed big bones lashed into X-frames. */
export function drawBarricade(c: CanvasRenderingContext2D, built: number, hpFrac: number) {
  const h = 22 * Math.min(1, built);
  c.fillStyle = "rgba(95,72,48,0.5)";
  c.beginPath();
  c.ellipse(0, 0, 17, 5, 0, 0, Math.PI * 2);
  c.fill();
  const xs = [-9, 7];
  for (const x of xs) {
    c.strokeStyle = "#cfc4ab";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x - 8, 0);
    c.lineTo(x + 8, -h);
    c.moveTo(x + 8, 0);
    c.lineTo(x - 8, -h);
    c.stroke();
    c.fillStyle = "#efe6cf";
    for (const [px, py] of [
      [x - 8, 0],
      [x + 8, -h],
      [x + 8, 0],
      [x - 8, -h],
    ]) {
      c.beginPath();
      c.arc(px, py, 2.6, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.strokeStyle = "#ddd3bb";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-18, -h * 0.55);
  c.lineTo(17, -h * 0.55);
  c.stroke();
  c.strokeStyle = "#8a6238";
  c.lineWidth = 1.4;
  for (const x of xs) {
    c.beginPath();
    c.arc(x, -h * 0.55, 2.2, 0, Math.PI * 2);
    c.stroke();
  }
  if (hpFrac < 0.5) {
    c.strokeStyle = "rgba(40,30,20,0.7)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-4, -h * 0.7);
    c.lineTo(0, -h * 0.4);
    c.stroke();
  }
}

/** Pole + big skull + horns + feathers. */
export function drawTotem(c: CanvasRenderingContext2D, built: number, t: number) {
  const k = Math.min(1, built);
  const H = 58 * k;
  c.fillStyle = "rgba(95,72,48,0.5)";
  c.beginPath();
  c.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#6b4a2a";
  c.fillRect(-3, -H, 6, H);
  c.fillStyle = "#b43a2c";
  c.fillRect(-3, -H * 0.45, 6, 3);
  c.fillStyle = "#e0b04c";
  c.fillRect(-3, -H * 0.3, 6, 3);
  if (k < 1) return;
  c.strokeStyle = "#e8dfc9";
  c.lineWidth = 2.4;
  c.lineCap = "round";
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(0, -H * 0.62 + i * 6);
      c.quadraticCurveTo(s * 12, -H * 0.66 + i * 6, s * 16, -H * 0.55 + i * 7);
      c.stroke();
    }
  }
  c.fillStyle = "#f1ead7";
  c.beginPath();
  c.ellipse(0, -H - 6, 11, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(6, -H - 2, 7, 4.5, 0.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#2a1e16";
  c.beginPath();
  c.ellipse(-3, -H - 7, 2.6, 2.2, 0, 0, Math.PI * 2);
  c.ellipse(4, -H - 7, 2.2, 2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#fbf6ea";
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(1 + i * 3, -H + 1);
    c.lineTo(2.5 + i * 3, -H + 5);
    c.lineTo(4 + i * 3, -H + 1);
    c.fill();
  }
  c.fillStyle = "#efe1c3";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 6, -H - 11);
    c.quadraticCurveTo(s * 14, -H - 20, s * 10, -H - 26);
    c.lineTo(s * 8, -H - 12);
    c.fill();
  }
  const sw = Math.sin(t * 2.2) * 2;
  for (const [x, col] of [
    [-8, "#d9473a"],
    [-11, "#f2c94c"],
  ] as [number, string][]) {
    c.strokeStyle = col;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, -H * 0.5);
    c.quadraticCurveTo(x - 4 + sw, -H * 0.4, x - 2 + sw, -H * 0.28);
    c.stroke();
  }
}

/** Hide-drying frames with stretched pelts + a scraping log. */
export function drawTannery(c: CanvasRenderingContext2D, W: number, built: number, hides: number, t: number) {
  const k = Math.min(1, built);
  const H = 36 * k;
  c.strokeStyle = "#6b4a2a";
  c.lineWidth = 2.5;
  c.lineCap = "round";
  const frames = [-W / 4, W / 4];
  for (const x of frames) {
    c.beginPath();
    c.moveTo(x - 13, 0);
    c.lineTo(x - 11, -H);
    c.moveTo(x + 13, 0);
    c.lineTo(x + 11, -H);
    c.moveTo(x - 13, -H + 2);
    c.lineTo(x + 13, -H + 2);
    c.moveTo(x - 13, -4);
    c.lineTo(x + 13, -4);
    c.stroke();
  }
  if (k < 1) return;
  const show = Math.min(2, Math.max(1, hides));
  for (let i = 0; i < show; i++) {
    const x = frames[i];
    const flap = Math.sin(t * 1.8 + i) * 0.6;
    c.fillStyle = i ? "#a8794e" : "#8f5f3a";
    c.beginPath();
    c.moveTo(x - 10, -H + 5);
    c.quadraticCurveTo(x, -H + 2 + flap, x + 10, -H + 5);
    c.quadraticCurveTo(x + 12 + flap, -H / 2, x + 10, -7);
    c.quadraticCurveTo(x, -9, x - 10, -7);
    c.quadraticCurveTo(x - 12, -H / 2, x - 10, -H + 5);
    c.fill();
    c.fillStyle = "rgba(60,38,20,0.35)";
    c.beginPath();
    c.arc(x - 3, -H / 2, 2.5, 0, Math.PI * 2);
    c.arc(x + 4, -H / 2 + 6, 2, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#7a5230";
  c.beginPath();
  c.ellipse(0, -3, 8, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#efe6cf";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-3, -7);
  c.lineTo(4, -10);
  c.stroke();
}
