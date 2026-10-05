/* ------------------------------------------------------------------ */
/*  Arenas: original, procedurally painted stages with parallax depth.  */
/*                                                                      */
/*  drawBack  — screen space (sky + parallax layers)                    */
/*  drawFloor — world space (floor, back ledge); y up, negated on draw  */
/*  drawProp  — world space destructible props                          */
/*  drawFront — screen space foreground atmosphere                      */
/* ------------------------------------------------------------------ */

import type { Prop } from "../engine/match";
import { FLOOR_Y, VH, glow, hash, withAlpha } from "./util";
import { bolt } from "./effects";

export type ArenaId = "rooftop" | "avenue" | "lab" | "station" | "magma" | "sanctum";

export interface ArenaDef {
  id: ArenaId;
  variant?: string;
  name: string;
  tagline: string;
  music: number;
  /** UI card gradient */
  colors: [string, string];
  props: { kind: string; x: number; w: number; h: number; hp?: number }[];
}

export const ARENAS: ArenaDef[] = [
  { id: "rooftop", name: "Skyline Rooftop", tagline: "Midnight above the city — helicopters, searchlights and wind.", music: 0, colors: ["#1e1b4b", "#be185d"], props: [{ kind: "vent", x: -640, w: 110, h: 80 }, { kind: "vent", x: 640, w: 110, h: 80 }] },
  { id: "avenue", name: "Ruined Avenue", tagline: "A street after the battle. Burning wrecks you can smash through.", music: 1, colors: ["#431407", "#f97316"], props: [{ kind: "car", x: -600, w: 170, h: 74, hp: 3 }, { kind: "barrel", x: 520, w: 46, h: 64 }, { kind: "car", x: 680, w: 150, h: 70, hp: 3 }] },
  { id: "lab", name: "Secret Lab", tagline: "Reactor core online. Try not to break the experiments.", music: 2, colors: ["#042f2e", "#22d3ee"], props: [{ kind: "console", x: -620, w: 120, h: 92 }, { kind: "tank", x: 620, w: 70, h: 150, hp: 2 }] },
  { id: "station", name: "Orbital Station", tagline: "Low orbit observation deck. A planet fills the window.", music: 3, colors: ["#0f172a", "#6366f1"], props: [{ kind: "crate", x: -600, w: 96, h: 96 }, { kind: "crate", x: 620, w: 96, h: 96 }] },
  { id: "magma", name: "Magma Core", tagline: "Lava falls, rising embers and a very hot floor.", music: 4, colors: ["#450a0a", "#ef4444"], props: [{ kind: "rock", x: -640, w: 120, h: 80 }, { kind: "rock", x: 600, w: 100, h: 70 }] },
  { id: "sanctum", name: "Mystic Sanctum", tagline: "A temple between dimensions. Everything floats.", music: 5, colors: ["#2e1065", "#d946ef"], props: [{ kind: "urn", x: -560, w: 56, h: 84 }, { kind: "urn", x: 560, w: 56, h: 84 }] },
];

export const arenaById = (id: string) => ARENAS.find((a) => a.id === id) ?? ARENAS[0];

export interface View {
  VW: number;
  camX: number;
  zoom: number;
  t: number;
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Screen x for a parallax layer at depth k (0 = infinitely far, 1 = stage). */
const px = (v: View, worldX: number, k: number) => v.VW / 2 + (worldX - v.camX * k) * (1 + (v.zoom - 1) * k) * 0.5;

function skyline(ctx: CanvasRenderingContext2D, v: View, seed: number, k: number, base: number, minH: number, maxH: number, color: string, windowColor: string | null, lit = 0.35, crumble = 0) {
  const span = 4200;
  let x = -span / 2;
  let i = 0;
  while (x < span / 2) {
    const w = 70 + hash(seed + i) * 130;
    const h = minH + hash(seed + i * 3.3) * (maxH - minH);
    const sx = px(v, x, k);
    const sw = w * (1 + (v.zoom - 1) * k) * 0.5;
    if (sx + sw > -50 && sx < v.VW + 50) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(sx, base);
      ctx.lineTo(sx, base - h);
      if (crumble) {
        const steps = 5;
        for (let s = 1; s <= steps; s++) ctx.lineTo(sx + (sw * s) / steps, base - h + hash(seed + i * 7 + s) * crumble);
      } else {
        if (hash(seed + i * 5) > 0.7) {
          ctx.lineTo(sx + sw * 0.45, base - h);
          ctx.lineTo(sx + sw * 0.5, base - h - 40);
          ctx.lineTo(sx + sw * 0.55, base - h);
        }
        ctx.lineTo(sx + sw, base - h);
      }
      ctx.lineTo(sx + sw, base);
      ctx.closePath();
      ctx.fill();
      if (windowColor) {
        const cols = Math.max(2, Math.floor(sw / 14));
        const rows = Math.floor(h / 18);
        for (let r = 1; r < rows - 1; r++) {
          for (let c = 0; c < cols; c++) {
            const hv = hash(seed + i * 91 + r * 13 + c * 7);
            if (hv > 1 - lit) {
              const flick = hv > 0.985 ? 0.5 + Math.sin(v.t * 6 + c) * 0.5 : 1;
              ctx.fillStyle = withAlpha(windowColor, (0.35 + hv * 0.5) * flick);
              ctx.fillRect(sx + 4 + c * (sw - 8) / cols, base - h + r * 18, Math.max(2, (sw - 8) / cols - 4), 9);
            }
          }
        }
      }
    }
    x += w + hash(seed + i * 2.1) * 30;
    i++;
  }
}

function stars(ctx: CanvasRenderingContext2D, v: View, n: number, seed: number, maxY: number, k = 0.02) {
  for (let i = 0; i < n; i++) {
    const x = ((hash(seed + i) * v.VW * 1.4 - v.camX * k + v.VW * 4) % (v.VW * 1.4)) - v.VW * 0.2;
    const y = hash(seed + i * 7.7) * maxY;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(v.t * (0.5 + hash(i) * 2) + i));
    const r = hash(seed + i * 3) > 0.92 ? 2.2 : 1.1;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.6})`;
    ctx.fillRect(x, y, r, r);
    if (r > 2) glow(ctx, "#c7d2fe", x, y, 8, tw * 0.6);
  }
}

/* ================================================================== */
/*  BACK LAYERS                                                         */
/* ================================================================== */
export function drawBack(ctx: CanvasRenderingContext2D, a: ArenaDef, v: View) {
  const W = v.VW;
  const t = v.t;
  switch (a.id) {
    case "rooftop": {
      const neon = a.variant === "neon";
      ctx.fillStyle = vgrad(ctx, 0, FLOOR_Y, neon ? [[0, "#020617"], [0.55, "#1e0b3a"], [1, "#0e7490"]] : [[0, "#050816"], [0.55, "#1b1446"], [0.88, "#5b2168"], [1, "#a8326b"]]);
      ctx.fillRect(0, 0, W, VH);
      stars(ctx, v, 140, 3, FLOOR_Y * 0.55);
      // Moon
      const mx = W * 0.76 - v.camX * 0.03;
      glow(ctx, neon ? "#22d3ee" : "#fde68a", mx, 210, 220, 0.35);
      ctx.fillStyle = vgrad(ctx, 140, 280, [[0, "#fffbeb"], [1, "#e2d6b0"]]);
      ctx.beginPath();
      ctx.arc(mx, 210, 68, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(120,110,90,0.25)";
      for (const [dx, dy, r] of [[-20, -10, 14], [18, 16, 10], [10, -26, 7], [-24, 24, 6]]) {
        ctx.beginPath();
        ctx.arc(mx + dx, 210 + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Searchlights
      ctx.globalCompositeOperation = "lighter";
      for (const [bx, sp] of [[W * 0.25, 0.5], [W * 0.62, -0.38]]) {
        const ang = Math.sin(t * sp) * 0.5 - Math.PI / 2;
        const sx = bx - v.camX * 0.1;
        const g = ctx.createLinearGradient(sx, FLOOR_Y - 120, sx + Math.cos(ang) * 900, FLOOR_Y - 120 + Math.sin(ang) * 900);
        g.addColorStop(0, "rgba(186,230,253,0.22)");
        g.addColorStop(1, "rgba(186,230,253,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx, FLOOR_Y - 120);
        ctx.lineTo(sx + Math.cos(ang - 0.06) * 1000, FLOOR_Y - 120 + Math.sin(ang - 0.06) * 1000);
        ctx.lineTo(sx + Math.cos(ang + 0.06) * 1000, FLOOR_Y - 120 + Math.sin(ang + 0.06) * 1000);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      skyline(ctx, v, 11, 0.1, FLOOR_Y - 70, 160, 420, "#121735", "#fde68a", 0.25);
      // Helicopter
      const hx = ((t * 70) % (W + 800)) - 400;
      const hy = 300 + Math.sin(t * 0.8) * 30;
      ctx.fillStyle = "#0b0f22";
      ctx.beginPath();
      ctx.ellipse(hx, hy, 46, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(hx - 90, hy - 4, 56, 6);
      ctx.fillRect(hx - 100, hy - 14, 8, 20);
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hx, hy - 20, 70 * Math.abs(Math.sin(t * 40)) + 10, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (Math.floor(t * 2) % 2) glow(ctx, "#ef4444", hx - 96, hy - 12, 16, 1);
      ctx.globalCompositeOperation = "lighter";
      const cone = ctx.createLinearGradient(hx, hy, hx + 120, FLOOR_Y);
      cone.addColorStop(0, "rgba(254,249,195,0.18)");
      cone.addColorStop(1, "rgba(254,249,195,0)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(hx + 10, hy + 10);
      ctx.lineTo(hx + 260, FLOOR_Y - 40);
      ctx.lineTo(hx - 40, FLOOR_Y - 40);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      skyline(ctx, v, 47, 0.3, FLOOR_Y - 20, 220, 560, neon ? "#1e1b4b" : "#1b2150", neon ? "#f0abfc" : "#fcd34d", neon ? 0.45 : 0.3);
      // Water tower
      const wx = px(v, 420, 0.6);
      ctx.fillStyle = "#0e1224";
      ctx.fillRect(wx - 70, FLOOR_Y - 330, 140, 120);
      ctx.beginPath();
      ctx.moveTo(wx - 80, FLOOR_Y - 330);
      ctx.lineTo(wx, FLOOR_Y - 390);
      ctx.lineTo(wx + 80, FLOOR_Y - 330);
      ctx.fill();
      for (const lx of [-60, -20, 20, 60]) ctx.fillRect(wx + lx - 4, FLOOR_Y - 210, 8, 190);
      glow(ctx, "#ef4444", wx, FLOOR_Y - 392, 18, Math.floor(t * 1.5) % 2 ? 1 : 0.2);
      break;
    }
    case "avenue": {
      const day = a.variant === "day";
      ctx.fillStyle = vgrad(ctx, 0, FLOOR_Y, day ? [[0, "#1d4ed8"], [0.6, "#60a5fa"], [1, "#dbeafe"]] : [[0, "#0d0605"], [0.5, "#4a1608"], [0.85, "#b13f0c"], [1, "#f59e0b"]]);
      ctx.fillRect(0, 0, W, VH);
      if (!day) {
        // Smoke columns
        for (let i = 0; i < 6; i++) {
          const bx = px(v, -1400 + i * 560, 0.08);
          for (let k = 0; k < 7; k++) {
            const yy = FLOOR_Y - 200 - k * 90 - ((t * 25 + i * 40) % 90);
            ctx.fillStyle = `rgba(20,14,12,${0.32 - k * 0.035})`;
            ctx.beginPath();
            ctx.arc(bx + Math.sin(t * 0.4 + k + i) * 30 + k * 18, yy, 70 + k * 22, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const cx = ((i * 520 + t * 12) % (W + 600)) - 300;
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          for (const [dx, dy, r] of [[0, 0, 40], [40, 8, 34], [-36, 10, 28], [70, 16, 22]]) {
            ctx.beginPath();
            ctx.arc(cx + dx, 160 + i * 30 + dy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      skyline(ctx, v, 5, 0.12, FLOOR_Y - 60, 200, 460, day ? "#64748b" : "#1a0d0a", day ? "#e2e8f0" : "#fb923c", day ? 0.35 : 0.18, day ? 0 : 70);
      skyline(ctx, v, 19, 0.35, FLOOR_Y - 10, 260, 600, day ? "#334155" : "#140a08", day ? "#fef3c7" : "#f97316", day ? 0.3 : 0.12, day ? 0 : 120);
      if (!day) {
        // Fires in the ruins
        for (let i = 0; i < 5; i++) {
          const fx = px(v, -1100 + i * 520, 0.35);
          const fy = FLOOR_Y - 260 - hash(i) * 200;
          glow(ctx, "#f97316", fx, fy, 90 + Math.sin(t * 9 + i) * 14, 0.75);
          glow(ctx, "#fde047", fx, fy, 30, 0.7);
        }
      }
      // Street lamps
      for (let i = 0; i < 6; i++) {
        const lx = px(v, -1500 + i * 600, 0.75);
        ctx.fillStyle = "#0f0b0a";
        ctx.fillRect(lx - 5, FLOOR_Y - 330, 10, 330);
        ctx.fillRect(lx, FLOOR_Y - 330, 60, 8);
        const on = day ? 0 : hash(i + Math.floor(t * 8)) > 0.12 ? 1 : 0.15;
        glow(ctx, "#fde68a", lx + 58, FLOOR_Y - 318, 80, 0.6 * on);
      }
      break;
    }
    case "lab": {
      const bunker = a.variant === "bunker";
      const training = a.variant === "training";
      ctx.fillStyle = vgrad(ctx, 0, FLOOR_Y, bunker ? [[0, "#0c0505"], [1, "#2a0d0d"]] : training ? [[0, "#0b1120"], [1, "#1e293b"]] : [[0, "#041014"], [1, "#0b2b33"]]);
      ctx.fillRect(0, 0, W, VH);
      // Wall panels
      ctx.strokeStyle = bunker ? "rgba(248,113,113,0.08)" : "rgba(34,211,238,0.09)";
      ctx.lineWidth = 2;
      const off = (-v.camX * 0.45 * v.zoom) % 160;
      for (let x = off - 160; x < W + 160; x += 160) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, FLOOR_Y);
        ctx.stroke();
      }
      for (let y = 80; y < FLOOR_Y; y += 120) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // Reactor core
      const cx = px(v, 0, 0.22);
      const coreColor = bunker ? "#ef4444" : training ? "#f59e0b" : "#22d3ee";
      const pulse = 0.75 + Math.sin(t * 3) * 0.2;
      glow(ctx, coreColor, cx, FLOOR_Y - 330, 380 * pulse, 0.45);
      ctx.fillStyle = vgrad(ctx, FLOOR_Y - 640, FLOOR_Y - 40, [[0, withAlpha(coreColor, 0.15)], [0.5, withAlpha(coreColor, 0.55)], [1, withAlpha(coreColor, 0.15)]]);
      ctx.fillRect(cx - 70, FLOOR_Y - 640, 140, 600);
      ctx.strokeStyle = withAlpha(coreColor, 0.9);
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const yy = FLOOR_Y - 140 - ((t * 60 + i * 130) % 520);
        ctx.beginPath();
        ctx.ellipse(cx, yy, 110, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (Math.floor(t * 7) % 3 === 0) bolt(ctx, cx - 60, -(FLOOR_Y - 500), cx + 70, -(FLOOR_Y - 200), Math.floor(t * 20), 2.5, coreColor);
      // Specimen tubes
      for (let i = 0; i < 8; i++) {
        const tx = px(v, -1750 + i * 500, 0.5);
        if (Math.abs(tx - cx) < 180) continue;
        const liquid = bunker ? "#7f1d1d" : training ? "#a16207" : "#14b8a6";
        ctx.fillStyle = withAlpha(liquid, 0.35);
        ctx.fillRect(tx - 34, FLOOR_Y - 360, 68, 300);
        ctx.strokeStyle = "rgba(226,232,240,0.45)";
        ctx.lineWidth = 3;
        ctx.strokeRect(tx - 34, FLOOR_Y - 360, 68, 300);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(tx - 44, FLOOR_Y - 380, 88, 24);
        ctx.fillRect(tx - 44, FLOOR_Y - 64, 88, 24);
        for (let b = 0; b < 6; b++) {
          const by = FLOOR_Y - 70 - ((t * 60 + b * 50 + i * 30) % 280);
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.beginPath();
          ctx.arc(tx + Math.sin(t * 3 + b) * 14, by, 3 + (b % 3), 0, Math.PI * 2);
          ctx.fill();
        }
        glow(ctx, liquid, tx, FLOOR_Y - 210, 120, 0.25);
      }
      // Ceiling lights
      for (let i = 0; i < 8; i++) {
        const lx = px(v, -1800 + i * 520, 0.8);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(lx - 60, 0, 120, 10);
        const g = ctx.createLinearGradient(lx, 0, lx, FLOOR_Y);
        g.addColorStop(0, bunker ? "rgba(248,113,113,0.12)" : "rgba(226,232,240,0.12)");
        g.addColorStop(1, "rgba(226,232,240,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(lx - 60, 10);
        ctx.lineTo(lx + 60, 10);
        ctx.lineTo(lx + 200, FLOOR_Y);
        ctx.lineTo(lx - 200, FLOOR_Y);
        ctx.fill();
      }
      if (bunker) {
        const ang = t * 3;
        glow(ctx, "#ef4444", W / 2 + Math.cos(ang) * W * 0.4, 120, 260, 0.25);
      }
      break;
    }
    case "station": {
      const planet = a.variant === "planet";
      ctx.fillStyle = planet ? vgrad(ctx, 0, FLOOR_Y, [[0, "#0b0420"], [0.6, "#3b0764"], [1, "#9d174d"]]) : vgrad(ctx, 0, FLOOR_Y, [[0, "#02030a"], [1, "#0b1030"]]);
      ctx.fillRect(0, 0, W, VH);
      stars(ctx, v, 260, 9, FLOOR_Y, 0.015);
      // Nebula
      glow(ctx, "#7c3aed", W * 0.3 - v.camX * 0.02, 300, 520, 0.28);
      glow(ctx, "#0891b2", W * 0.7 - v.camX * 0.02, 220, 420, 0.22);
      if (planet) {
        for (const [mx, my, r, c] of [[0.2, 180, 60, "#e9d5ff"], [0.82, 140, 34, "#fecdd3"]] as [number, number, number, string][]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(W * mx - v.camX * 0.03, my, r, 0, Math.PI * 2);
          ctx.fill();
          glow(ctx, c, W * mx - v.camX * 0.03, my, r * 3, 0.25);
        }
        // Alien spires + crystals
        for (let i = 0; i < 9; i++) {
          const sx = px(v, -2000 + i * 480, 0.3);
          const h = 200 + hash(i * 3) * 320;
          ctx.fillStyle = "#1e0b3a";
          ctx.beginPath();
          ctx.moveTo(sx - 70, FLOOR_Y);
          ctx.lineTo(sx - 10, FLOOR_Y - h);
          ctx.lineTo(sx + 20, FLOOR_Y - h * 0.8);
          ctx.lineTo(sx + 80, FLOOR_Y);
          ctx.fill();
        }
        for (let i = 0; i < 7; i++) {
          const cx = px(v, -1600 + i * 520, 0.6);
          const g = 0.6 + Math.sin(t * 2 + i) * 0.3;
          ctx.fillStyle = withAlpha("#22d3ee", 0.55);
          ctx.beginPath();
          ctx.moveTo(cx, FLOOR_Y - 140);
          ctx.lineTo(cx + 26, FLOOR_Y - 20);
          ctx.lineTo(cx - 26, FLOOR_Y - 20);
          ctx.fill();
          glow(ctx, "#22d3ee", cx, FLOOR_Y - 80, 80, g * 0.5);
        }
      } else {
        // Ringed planet
        const pxp = W * 0.62 - v.camX * 0.04;
        const py = FLOOR_Y - 260;
        const r = 260;
        glow(ctx, "#38bdf8", pxp, py, r * 1.45, 0.35);
        const g = ctx.createRadialGradient(pxp - r * 0.4, py - r * 0.4, r * 0.1, pxp, py, r);
        g.addColorStop(0, "#7dd3fc");
        g.addColorStop(0.5, "#2563eb");
        g.addColorStop(1, "#0b1236");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pxp, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 14;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(pxp, py, r * (0.95 - i * 0.18), r * 0.12, 0.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(226,232,240,0.45)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(pxp, py, r * 1.6, r * 0.32, -0.18, Math.PI * 1.05, Math.PI * 1.95, true);
        ctx.stroke();
        // Window struts
        ctx.fillStyle = "#070a17";
        const s = (-v.camX * 0.85 * v.zoom * 0.5) % 640;
        for (let x = s - 640; x < W + 640; x += 640) {
          ctx.beginPath();
          ctx.moveTo(x - 30, 0);
          ctx.lineTo(x + 30, 0);
          ctx.lineTo(x + 70, FLOOR_Y);
          ctx.lineTo(x - 70, FLOOR_Y);
          ctx.fill();
        }
        ctx.fillRect(0, 0, W, 40);
      }
      break;
    }
    case "magma": {
      ctx.fillStyle = vgrad(ctx, 0, FLOOR_Y, [[0, "#140303"], [0.55, "#5b0f0f"], [0.9, "#b91c1c"], [1, "#fb923c"]]);
      ctx.fillRect(0, 0, W, VH);
      // Volcanoes
      for (const [x0, h, k] of [[-900, 520, 0.08], [600, 640, 0.1], [1800, 480, 0.08]] as [number, number, number][]) {
        const vx = px(v, x0, k);
        ctx.fillStyle = "#1c0707";
        ctx.beginPath();
        ctx.moveTo(vx - 520, FLOOR_Y);
        ctx.lineTo(vx - 80, FLOOR_Y - h);
        ctx.lineTo(vx + 80, FLOOR_Y - h);
        ctx.lineTo(vx + 520, FLOOR_Y);
        ctx.fill();
        glow(ctx, "#f97316", vx, FLOOR_Y - h, 160 + Math.sin(t * 2 + x0) * 20, 0.7);
        ctx.fillStyle = vgrad(ctx, FLOOR_Y - h, FLOOR_Y, [[0, "#fde047"], [1, "rgba(234,88,12,0.2)"]]);
        ctx.beginPath();
        ctx.moveTo(vx - 20, FLOOR_Y - h);
        ctx.lineTo(vx + 20, FLOOR_Y - h);
        ctx.lineTo(vx + 50 + Math.sin(t) * 10, FLOOR_Y);
        ctx.lineTo(vx - 10, FLOOR_Y);
        ctx.fill();
      }
      // Lava falls (scrolling bands)
      for (let i = 0; i < 4; i++) {
        const lx = px(v, -1300 + i * 900, 0.4);
        const g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
        const o = (((t * 0.6 + i * 0.3) % 1) + 1) % 1 || 0;
        g.addColorStop(0, "#fde047");
        g.addColorStop(o * 0.5, "#f97316");
        g.addColorStop(Math.min(1, o * 0.5 + 0.3), "#fde047");
        g.addColorStop(1, "#ea580c");
        ctx.fillStyle = g;
        ctx.fillRect(lx - 26, FLOOR_Y * 0.25, 52, FLOOR_Y * 0.75);
        glow(ctx, "#f97316", lx, FLOOR_Y * 0.6, 200, 0.35);
      }
      break;
    }
    case "sanctum": {
      ctx.fillStyle = vgrad(ctx, 0, FLOOR_Y, [[0, "#0c0418"], [0.5, "#2e0a54"], [0.85, "#6b21a8"], [1, "#c026d3"]]);
      ctx.fillRect(0, 0, W, VH);
      stars(ctx, v, 100, 21, FLOOR_Y * 0.6);
      // Giant rune circle
      const cx = px(v, 0, 0.15);
      const cy = FLOOR_Y - 360;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        ctx.rotate(t * (k % 2 ? -0.15 : 0.1));
        ctx.strokeStyle = `rgba(251,191,36,${0.35 - k * 0.08})`;
        ctx.lineWidth = 4;
        const r = 330 - k * 70;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.save();
          ctx.rotate(a);
          ctx.strokeRect(r - 16, -8, 16, 16);
          ctx.restore();
        }
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        }
        ctx.stroke();
      }
      ctx.restore();
      glow(ctx, "#f59e0b", cx, cy, 300, 0.2);
      // Floating islands
      for (let i = 0; i < 6; i++) {
        const ix = px(v, -1500 + i * 600, 0.3);
        const iy = FLOOR_Y - 420 - hash(i) * 200 + Math.sin(t * 0.8 + i) * 14;
        ctx.fillStyle = "#1e0b3a";
        ctx.beginPath();
        ctx.moveTo(ix - 80, iy);
        ctx.lineTo(ix + 80, iy);
        ctx.lineTo(ix + 20, iy + 90);
        ctx.lineTo(ix - 10, iy + 110);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#4c1d95";
        ctx.fillRect(ix - 80, iy - 6, 160, 8);
        glow(ctx, "#c084fc", ix, iy + 50, 60, 0.25);
      }
      // Pillars with runes
      for (let i = 0; i < 7; i++) {
        const lx = px(v, -1650 + i * 550, 0.55);
        ctx.fillStyle = "#170a2b";
        ctx.fillRect(lx - 34, FLOOR_Y - 520, 68, 520);
        ctx.fillRect(lx - 48, FLOOR_Y - 540, 96, 28);
        for (let r = 0; r < 4; r++) glow(ctx, "#e879f9", lx, FLOOR_Y - 120 - r * 100, 18, 0.5 + Math.sin(t * 3 + r + i) * 0.3);
      }
      // Floating books / orbs
      for (let i = 0; i < 8; i++) {
        const bx = px(v, -1400 + i * 380, 0.85);
        const by = FLOOR_Y - 300 - hash(i * 9) * 220 + Math.sin(t * 1.4 + i) * 20;
        if (i % 2) {
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(Math.sin(t + i) * 0.3);
          ctx.fillStyle = "#7c2d12";
          ctx.fillRect(-20, -14, 40, 28);
          ctx.fillStyle = "#fde68a";
          ctx.fillRect(-16, -11, 32, 3);
          ctx.restore();
        } else glow(ctx, "#a78bfa", bx, by, 26, 0.8);
      }
      break;
    }
  }
}

/* ================================================================== */
/*  FLOOR (world space)                                                 */
/* ================================================================== */
const FLOOR_COLORS: Record<ArenaId, [string, string, string]> = {
  rooftop: ["#2c3148", "#141726", "rgba(148,163,184,0.12)"],
  avenue: ["#2b2a2d", "#121113", "rgba(250,204,21,0.5)"],
  lab: ["#1a2a33", "#0a1418", "rgba(34,211,238,0.22)"],
  station: ["#1e2438", "#0b0f1d", "rgba(99,102,241,0.35)"],
  magma: ["#2a1512", "#100706", "rgba(249,115,22,0.6)"],
  sanctum: ["#2a1d45", "#110a20", "rgba(232,121,249,0.35)"],
};

export function drawFloor(ctx: CanvasRenderingContext2D, a: ArenaDef, t: number) {
  const [top, bottom, line] = FLOOR_COLORS[a.id];
  const D = 700; // floor depth below the fighters' line (screen side)
  ctx.fillStyle = vgrad(ctx, 0, D, [[0, top], [1, bottom]]);
  ctx.fillRect(-3200, 0, 6400, D);

  // Back ledge / horizon lip
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-3200, -6, 6400, 10);
  ctx.fillStyle = withAlpha("#ffffff", 0.06);
  ctx.fillRect(-3200, 2, 6400, 3);

  // Perspective lines
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (let x = -3200; x <= 3200; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x * 1.9, D);
    ctx.stroke();
  }
  for (const y of [70, 170, 320, 520]) {
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-3200, y);
    ctx.lineTo(3200, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  switch (a.id) {
    case "avenue": {
      // Dashed lane line + cracks
      ctx.fillStyle = a.variant === "day" ? "rgba(250,204,21,0.8)" : "rgba(250,204,21,0.55)";
      for (let x = -3200; x < 3200; x += 220) ctx.fillRect(x, 130, 120, 10);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 18; i++) {
        const cx = -1600 + hash(i) * 3200;
        ctx.beginPath();
        ctx.moveTo(cx, 20 + hash(i * 2) * 300);
        for (let k = 0; k < 4; k++) ctx.lineTo(cx + (hash(i + k) - 0.5) * 120, 20 + hash(i * 2 + k) * 300);
        ctx.stroke();
      }
      break;
    }
    case "magma": {
      for (let i = 0; i < 14; i++) {
        const cx = -1800 + i * 260;
        const pulse = 0.5 + Math.sin(t * 2 + i) * 0.3;
        ctx.strokeStyle = `rgba(251,146,60,${pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, 30 + hash(i) * 60);
        ctx.lineTo(cx + 60, 90 + hash(i * 3) * 120);
        ctx.lineTo(cx + 20, 220 + hash(i * 5) * 200);
        ctx.stroke();
        glow(ctx, "#f97316", cx + 40, 140, 70, pulse * 0.25);
      }
      break;
    }
    case "sanctum": {
      ctx.save();
      ctx.scale(1, 0.22);
      ctx.translate(0, 900);
      ctx.rotate(t * 0.2);
      ctx.strokeStyle = "rgba(232,121,249,0.5)";
      ctx.lineWidth = 6;
      for (const r of [260, 380]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const ang = (i * 2 * Math.PI) / 6;
        ctx.lineTo(Math.cos(ang) * 380, Math.sin(ang) * 380);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "lab":
    case "station": {
      const c = a.id === "lab" ? (a.variant === "bunker" ? "#ef4444" : a.variant === "training" ? "#f59e0b" : "#22d3ee") : "#818cf8";
      for (const x of [-780, 780]) {
        glow(ctx, c, x, 10, 120, 0.4 + Math.sin(t * 3) * 0.1);
      }
      ctx.fillStyle = withAlpha(c, 0.55);
      ctx.fillRect(-3200, 36, 6400, 3);
      if (a.variant === "training") {
        for (let x = -3200; x < 3200; x += 80) {
          ctx.fillStyle = (x / 80) % 2 === 0 ? "#facc15" : "#111827";
          ctx.fillRect(x, -2, 80, 8);
        }
      }
      break;
    }
    case "rooftop": {
      // Rain-sheen reflections of the skyline
      for (let i = 0; i < 12; i++) glow(ctx, i % 2 ? "#f472b6" : "#fbbf24", -1600 + i * 280, 60 + hash(i) * 120, 60, 0.12);
      break;
    }
  }
}

/* ================================================================== */
/*  PROPS (world space)                                                 */
/* ================================================================== */
export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, a: ArenaDef, t: number) {
  const x = p.x;
  const w = p.w;
  const h = p.h;
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.6, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  if (p.broken) {
    ctx.fillStyle = "#1f2937";
    for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + hash(p.id + i) * w, -10 - hash(p.id * 2 + i) * 16, 14 + hash(i) * 16, 10);
    if (p.kind === "car" || p.kind === "console" || p.kind === "tank") glow(ctx, a.id === "lab" ? "#22d3ee" : "#f97316", 0, -20, 50 + Math.sin(t * 10) * 8, 0.4);
    ctx.restore();
    return;
  }
  const ink = "#0a0c14";
  switch (p.kind) {
    case "car": {
      const body = a.variant === "day" ? "#2563eb" : "#3f3f46";
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 3, -h * 0.62 - 3, w + 6, h * 0.5 + 6, 10);
      ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h * 0.62, w, h * 0.5, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.28, -h * 0.62);
      ctx.lineTo(-w * 0.16, -h);
      ctx.lineTo(w * 0.2, -h);
      ctx.lineTo(w * 0.32, -h * 0.62);
      ctx.fill();
      ctx.fillStyle = "rgba(186,230,253,0.35)";
      ctx.fillRect(-w * 0.14, -h * 0.95, w * 0.32, h * 0.28);
      for (const s of [-1, 1]) {
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(s * w * 0.3, -h * 0.14, h * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      if (a.variant !== "day") glow(ctx, "#f97316", w * 0.2, -h * 0.9, 40 + Math.sin(t * 11 + p.id) * 8, 0.6);
      break;
    }
    case "barrel": {
      ctx.fillStyle = ink;
      ctx.fillRect(-w / 2 - 3, -h - 3, w + 6, h + 3);
      ctx.fillStyle = "#b45309";
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-w / 2, -h * 0.7, w, 6);
      ctx.fillRect(-w / 2, -h * 0.3, w, 6);
      glow(ctx, "#f97316", 0, -h - 10, 34 + Math.sin(t * 14) * 6, 0.7);
      break;
    }
    case "console": {
      ctx.fillStyle = ink;
      ctx.fillRect(-w / 2 - 3, -h - 3, w + 6, h + 3);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-w / 2, -h, w, h);
      const sc = a.variant === "bunker" ? "#f87171" : "#22d3ee";
      ctx.fillStyle = withAlpha(sc, 0.25);
      ctx.fillRect(-w / 2 + 10, -h + 10, w - 20, h * 0.45);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = withAlpha(sc, 0.7);
        ctx.fillRect(-w / 2 + 16, -h + 18 + i * 9, ((Math.sin(t * 3 + i * 2) + 1) / 2) * (w - 34), 4);
      }
      for (let i = 0; i < 5; i++) glow(ctx, i % 2 ? "#4ade80" : "#f87171", -w / 2 + 18 + i * 20, -16, 6, Math.floor(t * 3 + i) % 2 ? 1 : 0.3);
      break;
    }
    case "tank": {
      ctx.fillStyle = "rgba(20,184,166,0.35)";
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.strokeStyle = "rgba(226,232,240,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeRect(-w / 2, -h, w, h);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-w / 2 - 6, -h - 12, w + 12, 14);
      glow(ctx, "#2dd4bf", 0, -h / 2, 70, 0.35);
      break;
    }
    case "crate": {
      ctx.fillStyle = ink;
      ctx.fillRect(-w / 2 - 3, -h - 3, w + 6, h + 3);
      ctx.fillStyle = "#334155";
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 5;
      ctx.strokeRect(-w / 2 + 8, -h + 8, w - 16, h - 16);
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 8, -h + 8);
      ctx.lineTo(w / 2 - 8, -8);
      ctx.stroke();
      ctx.fillStyle = "#818cf8";
      ctx.fillRect(-w / 2, -h + 12, w, 4);
      break;
    }
    case "rock": {
      ctx.fillStyle = "#1c1210";
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w * 0.35, -h * 0.8);
      ctx.lineTo(w * 0.05, -h);
      ctx.lineTo(w * 0.4, -h * 0.65);
      ctx.lineTo(w / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(251,146,60,${0.5 + Math.sin(t * 2 + p.id) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, -h * 0.7);
      ctx.lineTo(0, -h * 0.4);
      ctx.lineTo(w * 0.15, -h * 0.2);
      ctx.stroke();
      break;
    }
    case "urn": {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.45, w / 2 + 3, h * 0.45 + 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6d28d9";
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.45, w / 2, h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-w / 2, -h * 0.5, w, 5);
      glow(ctx, "#e879f9", 0, -h - 10, 30, 0.6);
      break;
    }
    case "vent": {
      ctx.fillStyle = ink;
      ctx.fillRect(-w / 2 - 3, -h - 3, w + 6, h + 3);
      ctx.fillStyle = "#475569";
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.fillStyle = "#1e293b";
      for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 10, -h + 12 + i * 12, w - 20, 5);
      ctx.save();
      ctx.translate(0, -h - 6);
      ctx.rotate(t * 6);
      ctx.fillStyle = "#94a3b8";
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.fillRect(-3, 0, 6, 22);
      }
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

/* ================================================================== */
/*  FRONT ATMOSPHERE (screen space)                                     */
/* ================================================================== */
export function drawFront(ctx: CanvasRenderingContext2D, a: ArenaDef, v: View) {
  const W = v.VW;
  const t = v.t;
  if (a.id === "magma" || (a.id === "avenue" && a.variant !== "day")) {
    for (let i = 0; i < 46; i++) {
      const x = ((hash(i) * W * 1.2 + Math.sin(t * 0.7 + i) * 40 - v.camX * 0.6 + W * 10) % (W * 1.2)) - W * 0.1;
      const y = VH - ((t * (40 + hash(i * 3) * 80) + hash(i * 7) * VH) % VH);
      glow(ctx, i % 3 ? "#fb923c" : "#fde047", x, y, 5 + hash(i) * 6, 0.8);
    }
  }
  if (a.id === "rooftop") {
    ctx.strokeStyle = "rgba(226,232,240,0.07)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const x = W - ((t * 900 + hash(i) * W * 2) % (W * 1.4));
      const y = hash(i * 5) * VH;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 160, y - 6);
      ctx.stroke();
    }
  }
  if (a.id === "sanctum") {
    for (let i = 0; i < 30; i++) {
      const x = (hash(i) * W + Math.sin(t * 0.5 + i) * 60 + W) % W;
      const y = (hash(i * 3) * VH - t * 18 + VH * 10) % VH;
      glow(ctx, "#e9d5ff", x, y, 4 + hash(i) * 4, 0.6);
    }
  }
  if (a.id === "lab" || a.id === "station") {
    for (let i = 0; i < 24; i++) {
      const x = (hash(i) * W + t * 10 * (hash(i * 2) - 0.5) + W) % W;
      const y = (hash(i * 9) * VH + Math.sin(t * 0.6 + i) * 30 + VH) % VH;
      ctx.fillStyle = "rgba(226,232,240,0.12)";
      ctx.fillRect(x, y, 2, 2);
    }
  }
}
