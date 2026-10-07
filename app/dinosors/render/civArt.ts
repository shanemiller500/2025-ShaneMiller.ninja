/* ------------------------------------------------------------------ */
/*  Art for the civilization paths: resonance buildings (stone, copper */
/*  and glowing crystal), the pyramid stage by stage, the humming      */
/*  chamber, megaliths, new deposits, beams, floating blocks, pylon     */
/*  barriers and the shield dome. Origin = the building's base centre. */
/* ------------------------------------------------------------------ */
import type { Beam, Lift } from "../sim/civ";
import { TILE, type Building, type BuildingKind, type Prop, type ResNode } from "../sim/types";
import { shade } from "./drawDino";

const T = TILE;
const STONE = "#b9b1a2";
const STONE_D = "#8f8879";
const STONE_L = "#d8d1c3";
const COPPER = "#c8743f";
const CRYSTAL = "#8fe3ff";

export const CIV_KINDS = new Set<BuildingKind>(["shelterDeep", "resTable", "chamber", "shapingYard", "energyTower", "condenser", "obelisk", "stoneCircle", "levPad", "beamTower", "pylon", "pyramid", "resShield"]);

export interface CivLook {
  /** the grid has power */
  power: boolean;
  night: boolean;
  /** 0..1 storm (crystals glow brighter) */
  storm: number;
  t: number;
}

const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A glowing crystal shard. */
function crystal(c: CanvasRenderingContext2D, x: number, y: number, h: number, glow: number, color = CRYSTAL) {
  if (glow > 0.05) {
    const g = c.createRadialGradient(x, y - h * 0.5, 0, x, y - h * 0.5, h * 1.6);
    g.addColorStop(0, `rgba(160,240,255,${0.45 * glow})`);
    g.addColorStop(1, "rgba(160,240,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y - h * 0.5, h * 1.6, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = shade(color, -0.25);
  c.beginPath();
  c.moveTo(x - h * 0.22, y);
  c.lineTo(x - h * 0.16, y - h * 0.7);
  c.lineTo(x, y - h);
  c.lineTo(x + h * 0.16, y - h * 0.7);
  c.lineTo(x + h * 0.22, y);
  c.closePath();
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x - h * 0.05, y);
  c.lineTo(x - h * 0.1, y - h * 0.7);
  c.lineTo(x, y - h);
  c.lineTo(x + h * 0.06, y - h * 0.68);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fillRect(x - h * 0.07, y - h * 0.8, 1.2, h * 0.3);
}

/** Many-sided interlocking blocks across a rectangle (the polygon masonry look). */
export function polyBlocks(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number, base = STONE) {
  c.fillStyle = shade(base, -0.12);
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rows = Math.max(1, Math.round((y1 - y0) / 9));
  const rh = (y1 - y0) / rows;
  c.strokeStyle = "rgba(60,54,46,0.55)";
  c.lineWidth = 0.9;
  for (let r = 0; r < rows; r++) {
    let x = x0;
    let k = 0;
    while (x < x1 - 0.5) {
      const bw = Math.min(x1 - x, 7 + seeded(seed + r * 13 + k) * 9);
      const ya = y0 + r * rh;
      const yb = ya + rh;
      const j1 = (seeded(seed + k * 7 + r) - 0.5) * rh * 0.5;
      const j2 = (seeded(seed + k * 3 + r * 5) - 0.5) * rh * 0.5;
      c.fillStyle = shade(base, (seeded(seed + k + r * 31) - 0.5) * 0.18);
      c.beginPath();
      c.moveTo(x + 1.2, ya + 0.6);
      c.lineTo(x + bw * 0.6, ya + 0.4);
      c.lineTo(x + bw - 0.6, ya + rh * 0.35 + j1 * 0.3);
      c.lineTo(x + bw - 0.6, yb - 0.6 + Math.min(0, j2) * 0.2);
      c.lineTo(x + bw * 0.35, yb - 0.4);
      c.lineTo(x + 0.6, yb - rh * 0.4 + j2 * 0.3);
      c.closePath();
      c.fill();
      c.stroke();
      x += bw;
      k++;
    }
  }
}

/** Stone courses rising as something is built (the generic civ scaffold). */
function rising(c: CanvasRenderingContext2D, W: number, Hpx: number, built: number) {
  c.strokeStyle = "rgba(200,240,255,0.75)";
  c.setLineDash([5, 4]);
  c.lineWidth = 1.2;
  c.strokeRect(-W / 2 + 2, -Hpx + 2, W - 4, Hpx - 4);
  c.setLineDash([]);
  if (built <= 0.02) return;
  const h = 6 + 26 * built;
  polyBlocks(c, -W / 2 + 6, -h, W / 2 - 6, 0, Math.round(W), STONE);
  c.strokeStyle = "#8a6238";
  c.lineWidth = 1.5;
  for (const x of [-W / 2 + 4, W / 2 - 4]) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, -h - 10);
    c.stroke();
  }
}

export function drawCivBuilding(c: CanvasRenderingContext2D, b: Building, wt: number, ht: number, L: CivLook) {
  const W = wt * T;
  const built = Math.max(0, Math.min(1, b.built));
  const t = L.t;
  const glow = (L.power ? 0.6 + Math.sin(t * 2 + b.id) * 0.25 : 0.1) + L.storm * 0.4 + (L.night ? 0.2 : 0);
  if (b.kind === "pyramid") return drawPyramid(c, b, W, L);
  if (built < 1) return rising(c, W, ht * T, built);
  switch (b.kind) {
    case "shelterDeep": {
      // a low stone-roofed mound with a ramp down to a heavy door
      c.fillStyle = "#6f6a5f";
      c.beginPath();
      c.ellipse(0, -10, W / 2, 20, 0, Math.PI, 0);
      c.fill();
      polyBlocks(c, -W / 2 + 4, -18, W / 2 - 4, -2, 77, "#9e978a");
      c.fillStyle = "#3a352e";
      c.beginPath();
      c.moveTo(-12, 0);
      c.lineTo(-9, -16);
      c.lineTo(9, -16);
      c.lineTo(12, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "#5b4630";
      c.fillRect(-8, -14, 16, 14);
      c.strokeStyle = "#2c2116";
      c.lineWidth = 1;
      for (let x = -6; x <= 6; x += 4) {
        c.beginPath();
        c.moveTo(x, -14);
        c.lineTo(x, 0);
        c.stroke();
      }
      c.fillStyle = "#7a5f3e";
      c.fillRect(-W / 2 + 10, -26, 6, 10);
      break;
    }
    case "resTable": {
      // a stone slab on legs with tuning stones + copper rods
      c.fillStyle = STONE_D;
      c.fillRect(-W / 2 + 8, -12, 5, 12);
      c.fillRect(W / 2 - 13, -12, 5, 12);
      c.fillStyle = STONE;
      c.fillRect(-W / 2 + 4, -18, W - 8, 7);
      c.fillStyle = STONE_L;
      c.fillRect(-W / 2 + 4, -19, W - 8, 2);
      const mats = ["#9b958b", COPPER, "#dff1f7", "#3d414b", CRYSTAL];
      mats.forEach((col, i) => {
        const x = -W / 2 + 12 + i * ((W - 24) / 4);
        if (col === CRYSTAL) crystal(c, x, -19, 10, glow);
        else {
          c.fillStyle = col;
          c.beginPath();
          c.ellipse(x, -21, 3.4, 2.6, 0, 0, Math.PI * 2);
          c.fill();
        }
      });
      // resonance rings above the slab
      const k = (t * 0.8) % 1;
      c.strokeStyle = `rgba(150,235,255,${(1 - k) * 0.5 * (L.power ? 1 : 0.4)})`;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, -24, 6 + k * 18, 2 + k * 6, 0, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case "chamber": {
      polyBlocks(c, -W / 2 + 4, -34, W / 2 - 4, 0, b.id, STONE);
      c.fillStyle = STONE_L;
      c.beginPath();
      c.moveTo(-W / 2 + 2, -34);
      c.lineTo(0, -48);
      c.lineTo(W / 2 - 2, -34);
      c.closePath();
      c.fill();
      c.fillStyle = "#2a3540";
      c.fillRect(-8, -22, 16, 22);
      crystal(c, 0, -2, 18, glow);
      break;
    }
    case "shapingYard": {
      // work floor, a half-cut block, finished polygon blocks stacked
      c.fillStyle = "rgba(170,160,145,0.6)";
      c.beginPath();
      c.ellipse(0, -8, W / 2 - 2, 14, 0, 0, Math.PI * 2);
      c.fill();
      polyBlocks(c, -W / 2 + 6, -20, -4, -2, 11, STONE);
      polyBlocks(c, 4, -14, W / 2 - 6, -2, 19, STONE);
      polyBlocks(c, 8, -24, W / 2 - 10, -14, 23, STONE_L);
      c.fillStyle = "#8a837a";
      c.beginPath();
      c.moveTo(-14, -30);
      c.lineTo(-2, -36);
      c.lineTo(4, -26);
      c.lineTo(-10, -22);
      c.closePath();
      c.fill();
      c.strokeStyle = "#6b4a2a";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-W / 2 + 4, -2);
      c.lineTo(-W / 2 + 4, -42);
      c.lineTo(-6, -42);
      c.stroke();
      c.strokeStyle = "#cfc6b6";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-8, -42);
      c.lineTo(-8, -32);
      c.stroke();
      break;
    }
    case "energyTower": {
      // stepped stone spire wound in copper, crystal on top
      polyBlocks(c, -12, -40, 12, 0, b.id + 3, STONE);
      polyBlocks(c, -8, -62, 8, -40, b.id + 5, STONE_L);
      c.strokeStyle = COPPER;
      c.lineWidth = 1.6;
      for (let y = -58; y < -4; y += 5) {
        c.beginPath();
        c.moveTo(y > -40 ? -12 : -8, y);
        c.lineTo(y > -40 ? 12 : 8, y + 2.5);
        c.stroke();
      }
      crystal(c, 0, -62, 16, glow);
      if (L.power && L.storm > 0.3 && Math.sin(t * 13 + b.id) > 0.85) {
        c.strokeStyle = "rgba(220,250,255,0.9)";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(0, -76);
        c.lineTo(5, -86);
        c.lineTo(-2, -92);
        c.lineTo(4, -104);
        c.stroke();
      }
      break;
    }
    case "condenser": {
      // copper-ribbed clay tower with a dripping basin
      c.fillStyle = "#b27b55";
      c.beginPath();
      c.moveTo(-12, 0);
      c.lineTo(-8, -44);
      c.lineTo(8, -44);
      c.lineTo(12, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = COPPER;
      c.lineWidth = 2;
      for (const x of [-6, 0, 6]) {
        c.beginPath();
        c.moveTo(x * 1.3, -2);
        c.lineTo(x, -44);
        c.stroke();
      }
      c.fillStyle = "#d9d2c5";
      c.beginPath();
      c.ellipse(0, -46, 11, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#6fb6d9";
      c.beginPath();
      c.ellipse(0, -1, 14, 4, 0, 0, Math.PI * 2);
      c.fill();
      const k = (t * 1.3 + b.id) % 1;
      c.fillStyle = `rgba(180,230,255,${0.9 - k * 0.6})`;
      c.beginPath();
      c.arc(9, -8 + k * 7, 1.4, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "obelisk": {
      c.fillStyle = STONE_D;
      c.fillRect(-11, -6, 22, 6);
      const g = c.createLinearGradient(-7, 0, 7, 0);
      g.addColorStop(0, STONE_L);
      g.addColorStop(1, STONE_D);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-7, -6);
      c.lineTo(-4.5, -78);
      c.lineTo(4.5, -78);
      c.lineTo(7, -6);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(70,62,52,0.45)";
      c.lineWidth = 0.8;
      for (let y = -66; y < -8; y += 13) {
        c.beginPath();
        c.moveTo(-6, y);
        c.lineTo(6, y + 2);
        c.stroke();
      }
      // carved glyphs glow when powered
      c.fillStyle = `rgba(150,235,255,${0.25 + glow * 0.5})`;
      for (let i = 0; i < 4; i++) c.fillRect(-1.5, -60 + i * 12, 3, 5);
      crystal(c, 0, -78, 11, glow, "#dff1f7");
      break;
    }
    case "stoneCircle": {
      // ring of standing megaliths (back half first)
      c.fillStyle = "rgba(150,140,120,0.35)";
      c.beginPath();
      c.ellipse(0, -T * 1.5, W / 2 - 4, T * 1.1, 0, 0, Math.PI * 2);
      c.fill();
      const stones: [number, number][] = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        stones.push([Math.cos(a) * (W / 2 - 10), -T * 1.5 + Math.sin(a) * (T * 1.05)]);
      }
      stones.sort((a, b2) => a[1] - b2[1]);
      for (const [x, y] of stones) {
        megalithShape(c, x, y, 0.75, x + y);
        if (L.power) {
          c.fillStyle = `rgba(150,235,255,${glow * 0.35})`;
          c.fillRect(x - 1.5, y - 22, 3, 6);
        }
      }
      crystal(c, 0, -T * 1.5 + 4, 14, glow);
      break;
    }
    case "levPad": {
      // a polished stone disc with magnetite studs; blocks hover over it when powered
      c.fillStyle = STONE_D;
      c.beginPath();
      c.ellipse(0, -T, W / 2 - 4, T * 0.62, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = STONE_L;
      c.beginPath();
      c.ellipse(0, -T - 2, W / 2 - 8, T * 0.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#3d414b";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.beginPath();
        c.arc(Math.cos(a) * (W / 2 - 14), -T - 2 + Math.sin(a) * (T * 0.4), 2.6, 0, Math.PI * 2);
        c.fill();
      }
      if (L.power) {
        const hover = Math.sin(t * 2 + b.id) * 3;
        c.fillStyle = "rgba(0,0,0,0.18)";
        c.beginPath();
        c.ellipse(0, -T - 2, 10, 4, 0, 0, Math.PI * 2);
        c.fill();
        c.save();
        c.translate(0, -T - 18 + hover);
        c.rotate(Math.sin(t * 0.7) * 0.2);
        polyBlocks(c, -9, -8, 9, 6, 41, STONE);
        c.restore();
        c.strokeStyle = `rgba(150,235,255,${0.4 + glow * 0.3})`;
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(0, -T - 2, W / 2 - 10 + Math.sin(t * 3) * 2, T * 0.45, 0, 0, Math.PI * 2);
        c.stroke();
      }
      break;
    }
    case "beamTower": {
      polyBlocks(c, -12, -34, 12, 0, b.id + 7, STONE);
      c.fillStyle = COPPER;
      c.fillRect(-13, -36, 26, 4);
      c.fillStyle = STONE_L;
      c.beginPath();
      c.moveTo(-9, -36);
      c.lineTo(-5, -46);
      c.lineTo(5, -46);
      c.lineTo(9, -36);
      c.closePath();
      c.fill();
      const ready = (b.cd ?? 0) <= 0.05;
      crystal(c, 0, -44, 14, ready ? glow : glow * 0.3, ready ? CRYSTAL : "#5f8fa0");
      break;
    }
    case "pylon": {
      c.fillStyle = STONE_D;
      c.fillRect(-7, -6, 14, 6);
      polyBlocks(c, -5, -36, 5, -6, b.id + 11, STONE);
      c.fillStyle = "#3d414b";
      c.beginPath();
      c.arc(0, -40, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(150,235,255,${0.3 + glow * 0.6})`;
      c.beginPath();
      c.arc(0, -40, 2.6, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "resShield": {
      polyBlocks(c, -W / 2 + 6, -24, W / 2 - 6, 0, b.id + 13, STONE);
      c.strokeStyle = COPPER;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, -24, W / 2 - 10, Math.PI, 0);
      c.stroke();
      crystal(c, -12, -24, 14, glow);
      crystal(c, 12, -24, 14, glow);
      crystal(c, 0, -26, 22, glow, "#bff6ff");
      break;
    }
  }
}

/** The pyramid, stage by stage (foundation → … → activated). */
function drawPyramid(c: CanvasRenderingContext2D, b: Building, W: number, L: CivLook) {
  const stage = b.stage ?? 0;
  const k = stage === 0 ? Math.max(0, Math.min(1, b.built)) : Math.max(0, Math.min(1, (b.built - 0.4) / 0.6));
  const done = stage >= 5 && b.built >= 1;
  const H = 150;
  const half = W / 2 - 2;
  // footprint marked out while it's still a building site
  if (!done) {
    c.strokeStyle = "rgba(200,240,255,0.6)";
    c.setLineDash([6, 5]);
    c.lineWidth = 1.2;
    c.strokeRect(-half, -T * 4 + 4, half * 2, T * 4 - 4);
    c.setLineDash([]);
  }
  const levels = stage === 0 ? 0 : stage === 1 ? 1 + k * 2 : stage === 2 ? 3 + k * 4 : 7;
  const foundH = 8;
  const fk = stage === 0 ? k : 1;
  polyBlocks(c, -half, -foundH * fk, -half + half * 2 * fk, 0, 501, STONE_D);
  if (levels <= 0) return;
  // the stepped body: each level a little narrower
  const steps = 9;
  const lh = (H - foundH) / steps;
  for (let i = 0; i < Math.floor(levels); i++) {
    const wHalf = half * (1 - (i + 1) / (steps + 1.5));
    const y = -foundH - i * lh;
    // left (lit) and right (shaded) faces
    polyBlocks(c, -wHalf, y - lh, 0, y, 600 + i * 17, i % 2 ? STONE : STONE_L);
    polyBlocks(c, 0, y - lh, wHalf, y, 700 + i * 17, STONE_D);
  }
  // inner chamber: a doorway + glow
  if (stage >= 3) {
    const glow = done ? 0.7 + Math.sin(L.t * 2) * 0.25 : stage >= 4 ? 0.35 : 0.15 + (stage === 3 ? k * 0.2 : 0);
    c.fillStyle = "#2a2a30";
    c.fillRect(-7, -foundH - 20, 14, 20);
    c.fillStyle = `rgba(150,235,255,${glow})`;
    c.fillRect(-5, -foundH - 18, 10, 18);
  }
  // capstone
  if (stage >= 4) {
    const top = -foundH - 7 * lh;
    const ck = stage === 4 ? k : 1;
    c.fillStyle = "#e9c46a";
    c.beginPath();
    c.moveTo(-half * 0.22, top);
    c.lineTo(0, top - 26 * ck);
    c.lineTo(half * 0.22, top);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.beginPath();
    c.moveTo(-half * 0.22, top);
    c.lineTo(0, top - 26 * ck);
    c.lineTo(-half * 0.05, top);
    c.closePath();
    c.fill();
    if (stage >= 5) {
      const on = done ? 1 : k * 0.6;
      crystal(c, 0, top - 22, 18, on * (L.power ? 1 : 0.5));
      if (done) {
        const r = (L.t * 0.5) % 1;
        c.strokeStyle = `rgba(150,235,255,${(1 - r) * 0.6})`;
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(0, top - 30, 20 + r * 140, 6 + r * 40, 0, 0, Math.PI * 2);
        c.stroke();
        // beam of light into the sky
        const g = c.createLinearGradient(0, top - 40, 0, top - 340);
        g.addColorStop(0, "rgba(170,240,255,0.5)");
        g.addColorStop(1, "rgba(170,240,255,0)");
        c.fillStyle = g;
        c.fillRect(-3, top - 340, 6, 300);
      }
    }
  }
  // scaffolding + ramps while it's going up
  if (!done && stage < 5) {
    c.strokeStyle = "#8a6238";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(half + 4, 0);
    c.lineTo(half * 0.35, -foundH - Math.max(1, levels) * lh);
    c.stroke();
  }
}

function megalithShape(c: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number) {
  const h = 30 * s;
  const w = 9 * s;
  const j = (seeded(seed) - 0.5) * 3;
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(x, y, w * 1.2, 3 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = STONE_D;
  c.beginPath();
  c.moveTo(x - w, y);
  c.lineTo(x - w * 0.8 + j, y - h);
  c.lineTo(x + w * 0.3 + j, y - h - 3 * s);
  c.lineTo(x + w * 0.9, y - h * 0.7);
  c.lineTo(x + w, y);
  c.closePath();
  c.fill();
  c.fillStyle = STONE;
  c.beginPath();
  c.moveTo(x - w, y);
  c.lineTo(x - w * 0.8 + j, y - h);
  c.lineTo(x + w * 0.1 + j, y - h - 2 * s);
  c.lineTo(x, y);
  c.closePath();
  c.fill();
}

/** A megalith floated into place with the Levitate tool. */
export function drawMegalith(c: CanvasRenderingContext2D, p: Prop) {
  megalithShape(c, 0, 0, p.size, p.id);
}

/** The humming chamber in the rocks. */
export function drawChamber(c: CanvasRenderingContext2D, t: number, state: "hidden" | "found" | "resonance" | "traditional") {
  // a half-buried stone doorway with crystals poking out of the rubble
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(0, 0, 34, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#8a837a";
  c.beginPath();
  c.ellipse(0, -6, 32, 16, 0, Math.PI, 0);
  c.fill();
  polyBlocks(c, -20, -30, 20, -4, 999, "#a39b8d");
  c.fillStyle = "#a39b8d";
  c.fillRect(-23, -34, 46, 6);
  const sealed = state === "traditional";
  c.fillStyle = sealed ? "#6d665c" : "#1f2730";
  c.fillRect(-9, -26, 18, 22);
  if (sealed) {
    c.strokeStyle = "rgba(40,35,30,0.6)";
    c.lineWidth = 1;
    for (let y = -22; y < -4; y += 6) {
      c.beginPath();
      c.moveTo(-9, y);
      c.lineTo(9, y);
      c.stroke();
    }
    return;
  }
  const pulse = (Math.sin(t * 2.2) + 1) / 2;
  const g = state === "resonance" ? 0.8 + pulse * 0.2 : state === "found" ? 0.5 + pulse * 0.3 : 0.2 + pulse * 0.25;
  crystal(c, -2, -4, 16, g);
  crystal(c, -24, -2, 10, g * 0.8);
  crystal(c, 22, -3, 12, g * 0.8, "#c7b8ff");
  // sound rings
  const k = (t * 0.6) % 1;
  c.strokeStyle = `rgba(160,235,255,${(1 - k) * 0.45 * g})`;
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(0, -14, 14 + k * 50, 5 + k * 18, 0, 0, Math.PI * 2);
  c.stroke();
  if (state === "hidden") {
    c.font = "12px serif";
    c.textAlign = "center";
    c.fillStyle = `rgba(255,255,255,${0.6 + pulse * 0.4})`;
    c.fillText("🎵", 16 + pulse * 4, -40 - pulse * 6);
  }
}

/** Copper, quartz, magnetite, crystal + meteor fragments. */
export function drawCivNode(c: CanvasRenderingContext2D, n: ResNode, t: number) {
  const k = 0.55 + 0.45 * (n.amount / Math.max(1, n.max));
  const v = n.variant;
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.beginPath();
  c.ellipse(0, 0, 20 * k, 6 * k, 0, 0, Math.PI * 2);
  c.fill();
  switch (n.kind) {
    case "copper": {
      const rocks: [number, number, number][] = [[-9, -3, 10], [8, -2, 8], [0, -10, 9]];
      for (const [x, y, r] of rocks) {
        c.fillStyle = "#6f6157";
        c.beginPath();
        c.ellipse(x, y, r * k, r * 0.75 * k, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = (x + v) % 2 ? "#4fa38a" : COPPER;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - r * 0.5 * k, y);
        c.lineTo(x + r * 0.4 * k, y - r * 0.3 * k);
        c.stroke();
      }
      break;
    }
    case "quartz":
      for (const [x, h] of [[-8, 14], [0, 20], [7, 12], [12, 9]] as [number, number][]) crystal(c, x, -1, h * k, 0.15, "#e9f6fa");
      break;
    case "magnetite": {
      c.fillStyle = "#3d414b";
      c.beginPath();
      c.moveTo(-14 * k, 0);
      c.lineTo(-10 * k, -12 * k);
      c.lineTo(2, -16 * k);
      c.lineTo(13 * k, -8 * k);
      c.lineTo(14 * k, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "#6b7280";
      c.fillRect(-6, -10 * k, 5, 2);
      // little iron filings standing up
      c.strokeStyle = "#20232a";
      c.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const a = -2.4 + i * 0.4 + Math.sin(t + i) * 0.05;
        c.beginPath();
        c.moveTo(Math.cos(a) * 16, -6 + Math.sin(a) * 10);
        c.lineTo(Math.cos(a) * 20, -6 + Math.sin(a) * 13);
        c.stroke();
      }
      break;
    }
    case "crystal": {
      c.fillStyle = "#5d5a66";
      c.beginPath();
      c.ellipse(0, -4, 17 * k, 10 * k, 0, Math.PI, 0);
      c.fill();
      const pulse = (Math.sin(t * 1.8 + v) + 1) / 2;
      crystal(c, -5, -2, 16 * k, 0.35 + pulse * 0.4);
      crystal(c, 5, -2, 12 * k, 0.3 + pulse * 0.3, "#c7b8ff");
      break;
    }
    case "meteorite": {
      c.fillStyle = "#3c3141";
      c.beginPath();
      c.ellipse(0, -6, 13 * k, 9 * k, 0.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#5d4d70";
      c.beginPath();
      c.ellipse(-3, -9, 7 * k, 4 * k, 0.3, 0, Math.PI * 2);
      c.fill();
      const a = (Math.sin(t * 3 + v) + 1) / 2;
      c.fillStyle = `rgba(255,140,90,${0.3 + a * 0.4})`;
      c.beginPath();
      c.arc(4, -5, 2, 0, Math.PI * 2);
      c.fill();
      break;
    }
  }
}

/* ------------------------------ effects (world space) ------------------------------ */

export function drawBeam(c: CanvasRenderingContext2D, b: Beam) {
  const a = 1 - b.t / 0.35;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.lineCap = "round";
  for (const [wd, col] of [[9, `rgba(80,200,255,${0.25 * a})`], [4, `rgba(160,240,255,${0.7 * a})`], [1.6, `rgba(255,255,255,${a})`]] as [number, string][]) {
    c.strokeStyle = col;
    c.lineWidth = wd;
    c.beginPath();
    c.moveTo(b.x0, b.y0 - b.z0);
    c.lineTo(b.x1, b.y1 - b.z1);
    c.stroke();
  }
  c.restore();
}

/** Glowing resonance bolt (the lance's "projectile"). */
export function drawBeamBolt(c: CanvasRenderingContext2D, x: number, y: number, ang: number) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.globalCompositeOperation = "lighter";
  c.strokeStyle = "rgba(120,220,255,0.5)";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(-22, 0);
  c.lineTo(2, 0);
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-18, 0);
  c.lineTo(2, 0);
  c.stroke();
  // a spiral of sparkles wound around the bolt
  const tt = performance.now() / 1000;
  for (let k = 0; k < 8; k++) {
    const f = k / 8;
    const yy = Math.sin(f * 12 + tt * 30) * 4;
    c.fillStyle = k % 2 ? "rgba(190,240,255,0.95)" : "rgba(255,240,180,0.9)";
    c.fillRect(-26 * f - 1, yy - 1, 2, 2);
  }
  const head = c.createRadialGradient(2, 0, 0, 2, 0, 9);
  head.addColorStop(0, "rgba(255,255,255,1)");
  head.addColorStop(1, "rgba(120,220,255,0)");
  c.fillStyle = head;
  c.beginPath();
  c.arc(2, 0, 9, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** A block (or megalith) floating along its arc, slowly turning, then dropping into place. */
export function drawLift(c: CanvasRenderingContext2D, l: Lift) {
  const k = Math.min(1, l.t / l.dur);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const x = l.x0 + (l.x1 - l.x0) * e;
  const y = l.y0 + (l.y1 - l.y0) * e;
  const lift = Math.sin(Math.min(1, k * 1.15) * Math.PI) * (l.mega ? 120 : 70) + (k < 0.15 ? k * 60 : 0);
  // shadow on the ground
  c.fillStyle = `rgba(0,0,0,${0.12 + (1 - lift / 140) * 0.12})`;
  c.beginPath();
  c.ellipse(x, y, l.mega ? 14 : 9, l.mega ? 4 : 3, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(x, y - lift);
  c.rotate(l.spin * (1 - e) * 0.6);
  c.strokeStyle = "rgba(150,235,255,0.5)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(0, l.mega ? 6 : 4, l.mega ? 16 : 11, 4, 0, 0, Math.PI * 2);
  c.stroke();
  if (l.mega) megalithShape(c, 0, 0, 0.9, 3);
  else polyBlocks(c, -8, -10, 8, 3, 77, STONE);
  c.restore();
  // a tether of light back toward the pad
  c.strokeStyle = "rgba(150,235,255,0.18)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(l.x0, l.y0 - 34);
  c.lineTo(x, y - lift);
  c.stroke();
}

/** Humming barrier between two pylons. */
export function drawPylonLink(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, t: number, on: boolean) {
  if (!on) return;
  c.save();
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const h = 10 + i * 9;
    c.strokeStyle = `rgba(120,220,255,${0.22 + Math.sin(t * 6 + i) * 0.08})`;
    c.lineWidth = 1.4;
    c.beginPath();
    const n = 10;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const x = ax + (bx - ax) * f;
      const y = ay + (by - ay) * f - h - 8 + Math.sin(t * 9 + f * 12 + i) * 1.6;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = "rgba(120,220,255,0.08)";
  c.beginPath();
  c.moveTo(ax, ay - 6);
  c.lineTo(bx, by - 6);
  c.lineTo(bx, by - 38);
  c.lineTo(ax, ay - 38);
  c.closePath();
  c.fill();
  c.restore();
}

/** The resonance shield dome (shown while it's charged and the sky is falling). */
export function drawShieldDome(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, a: number) {
  c.save();
  c.globalCompositeOperation = "lighter";
  const g = c.createRadialGradient(x, y - r * 0.2, r * 0.2, x, y - r * 0.2, r);
  g.addColorStop(0, `rgba(120,220,255,${0.02 * a})`);
  g.addColorStop(0.85, `rgba(120,220,255,${0.12 * a})`);
  g.addColorStop(1, `rgba(200,250,255,${0.35 * a})`);
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, r, r * 0.62, 0, Math.PI, 0);
  c.ellipse(x, y, r, r * 0.25, 0, 0, Math.PI);
  c.fill();
  c.strokeStyle = `rgba(200,250,255,${0.4 * a})`;
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(x, y, r, r * 0.62, 0, Math.PI, 0);
  c.stroke();
  for (let i = 0; i < 5; i++) {
    const k = ((t * 0.15 + i / 5) % 1) * Math.PI;
    c.strokeStyle = `rgba(160,240,255,${0.15 * a})`;
    c.beginPath();
    c.ellipse(x, y, r * Math.cos(k - Math.PI / 2) * 0.999 + 0.1, r * 0.62, 0, Math.PI, 0);
    c.stroke();
  }
  c.restore();
}

/** Levitate tool ghost: range rings around pads + the stone that would be placed. */
export function drawLiftGhost(c: CanvasRenderingContext2D, pads: { x: number; y: number }[], range: number, x: number, y: number, ok: boolean, t: number) {
  c.save();
  c.setLineDash([8, 6]);
  c.lineWidth = 2;
  for (const p of pads) {
    c.strokeStyle = "rgba(150,235,255,0.55)";
    c.beginPath();
    c.ellipse(p.x, p.y, range, range * 0.72, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.setLineDash([]);
  c.globalAlpha = 0.6 + Math.sin(t * 5) * 0.15;
  megalithShape(c, x, y, 0.95, 3);
  c.globalAlpha = 1;
  c.strokeStyle = ok ? "rgba(120,255,170,0.9)" : "rgba(255,110,110,0.9)";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(x, y, 16, 6, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

/* ------------------------------ the end of an age ------------------------------ */

/** Asteroid streaking in (world space): k 0..1 of the incoming phase. */
export function drawAsteroid(c: CanvasRenderingContext2D, x: number, y: number, k: number, t: number) {
  const e = Math.pow(k, 1.4);
  const sx = x + (1 - e) * 1100;
  const sy = y - (1 - e) * 1600;
  const r = 30 + e * 90;
  // fiery tail
  const g = c.createLinearGradient(sx, sy, sx + 900, sy - 1300);
  g.addColorStop(0, "rgba(255,230,170,0.9)");
  g.addColorStop(0.2, "rgba(255,140,60,0.5)");
  g.addColorStop(1, "rgba(255,90,40,0)");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(sx - r * 0.8, sy + r * 0.3);
  c.lineTo(sx + 900, sy - 1300);
  c.lineTo(sx + r * 0.6, sy - r * 0.9);
  c.closePath();
  c.fill();
  const glow = c.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 2.4);
  glow.addColorStop(0, "rgba(255,220,160,0.8)");
  glow.addColorStop(1, "rgba(255,120,40,0)");
  c.fillStyle = glow;
  c.beginPath();
  c.arc(sx, sy, r * 2.4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#3b2f2a";
  c.beginPath();
  c.arc(sx, sy, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(255,170,90,0.7)";
  c.beginPath();
  c.arc(sx - r * 0.35, sy + r * 0.3, r * 0.55, 0, Math.PI * 2);
  c.fill();
  // target marker on the ground
  const p = (Math.sin(t * 8) + 1) / 2;
  c.strokeStyle = `rgba(255,80,60,${0.4 + p * 0.5})`;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(x, y, 140, 60, 0, 0, Math.PI * 2);
  c.stroke();
}

/** The supervolcano's column: fire and ash punching into the sky, a mushroom of smoke on top. */
export function drawEruptionColumn(c: CanvasRenderingContext2D, x: number, y: number, k: number, t: number) {
  // tall enough to dwarf everything, short enough that the cap stays on the map
  const H = Math.max(500, Math.min(1700, y + 150)) * Math.min(1, k * 1.6);
  const top = y - 140 - H;
  c.save();
  // white-hot base where the mountain used to be
  c.globalCompositeOperation = "lighter";
  const base = c.createRadialGradient(x, y - 80, 0, x, y - 80, 520);
  base.addColorStop(0, `rgba(255,250,220,${0.75 * Math.min(1, k * 3)})`);
  base.addColorStop(0.3, "rgba(255,160,60,0.45)");
  base.addColorStop(1, "rgba(255,90,30,0)");
  c.fillStyle = base;
  c.beginPath();
  c.arc(x, y - 80, 520, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";
  // the fire stem
  const stem = c.createLinearGradient(0, y - 120, 0, top);
  stem.addColorStop(0, "rgba(255,240,180,0.95)");
  stem.addColorStop(0.15, "rgba(255,150,50,0.9)");
  stem.addColorStop(0.6, "rgba(160,50,20,0.75)");
  stem.addColorStop(1, "rgba(40,25,25,0.0)");
  c.fillStyle = stem;
  c.beginPath();
  c.moveTo(x - 260, y - 100);
  for (let k2 = 0; k2 <= 20; k2++) {
    const f = k2 / 20;
    c.lineTo(x - 260 + f * 120 + Math.sin(t * 3 + f * 9) * 40, y - 100 - H * f);
  }
  for (let k2 = 20; k2 >= 0; k2--) {
    const f = k2 / 20;
    c.lineTo(x + 260 - f * 120 + Math.sin(t * 3.3 + f * 8) * 40, y - 100 - H * f);
  }
  c.closePath();
  c.fill();
  // the mushroom cap: billowing dark smoke lit from below
  if (k > 0.25) {
    const cap = Math.min(1, (k - 0.25) * 2);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 700 * cap * (0.7 + 0.3 * Math.sin(i * 1.7));
      const px = x + Math.cos(a) * r * 1.4 + Math.sin(t + i) * 30;
      const py = top + Math.sin(a) * r * 0.35;
      const s = 320 * cap + (i % 4) * 40;
      const g = c.createRadialGradient(px, py, 0, px, py, s);
      // lit from below by the fire
      const under = Math.sin(a) > 0;
      g.addColorStop(0, under ? "rgba(255,150,70,0.85)" : "rgba(150,85,55,0.85)");
      g.addColorStop(0.5, under ? "rgba(170,70,35,0.6)" : "rgba(90,55,45,0.55)");
      g.addColorStop(1, "rgba(30,22,22,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(px, py, s, 0, Math.PI * 2);
      c.fill();
    }
    // lightning in the ash cloud
    if (Math.sin(t * 11) > 0.93) {
      c.strokeStyle = "rgba(220,230,255,0.95)";
      c.lineWidth = 6;
      c.beginPath();
      let lx = x + (Math.sin(t * 7) * 500);
      let ly = top;
      c.moveTo(lx, ly);
      for (let s2 = 0; s2 < 6; s2++) {
        lx += (Math.sin(t * 13 + s2) * 0.5) * 160;
        ly += 120;
        c.lineTo(lx, ly);
      }
      c.stroke();
    }
  }
  c.restore();
}

/** The supervolcano's pyroclastic flow: a boiling wall of fire and ash rolling outward. */
export function drawPyroclastic(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, a: number) {
  if (r <= 0) return;
  c.save();
  // scorched interior
  c.fillStyle = `rgba(40,12,8,${0.25 * a})`;
  c.beginPath();
  c.ellipse(x, y, r, r / 1.1, 0, 0, Math.PI * 2);
  c.fill();
  // the billowing front
  const n = Math.max(40, Math.min(160, Math.floor(r / 40)));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const wob = Math.sin(i * 2.3 + t * 4) * 30;
    const px = x + Math.cos(ang) * (r + wob);
    const py = y + (Math.sin(ang) * (r + wob)) / 1.1;
    const s = 120 + (i % 5) * 26;
    const g = c.createRadialGradient(px, py, 0, px, py, s);
    g.addColorStop(0, `rgba(255,200,90,${0.85 * a})`);
    g.addColorStop(0.35, `rgba(220,80,30,${0.7 * a})`);
    g.addColorStop(0.75, `rgba(60,35,30,${0.55 * a})`);
    g.addColorStop(1, "rgba(30,20,20,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(px, py, s, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** A creature caught by the blast: white flash → charred skeleton with embers → crumbling to dust. */
export function drawGhost(c: CanvasRenderingContext2D, g: { x: number; y: number; size: number; t: number; kind: string; face: number }) {
  const L = g.size;
  const k = g.t;
  c.save();
  c.translate(g.x, g.y);
  c.scale(g.face < 0 ? -1 : 1, 1);
  if (k < 0.18) {
    // vaporizing flash: a white-hot silhouette
    const s = 1 + k * 3;
    c.fillStyle = `rgba(255,255,240,${1 - k * 3})`;
    c.beginPath();
    c.ellipse(0, -L * 0.3, L * 0.55 * s, L * 0.35 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }
  const crumble = Math.max(0, (k - 1.4) / 1.6);
  const a = 1 - crumble;
  // charred bones (a generic ribcage + skull, scaled to the body)
  c.strokeStyle = `rgba(28,22,20,${a})`;
  c.fillStyle = `rgba(28,22,20,${a})`;
  c.lineWidth = Math.max(1.2, L * 0.05);
  c.lineCap = "round";
  const sink = crumble * L * 0.3;
  c.translate(0, sink);
  if (g.kind === "human") {
    c.beginPath();
    c.arc(0, -L * 1.25, L * 0.22, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(0, -L);
    c.lineTo(0, -L * 0.35);
    c.moveTo(-L * 0.3, -L * 0.75);
    c.lineTo(L * 0.3, -L * 0.75);
    c.moveTo(0, -L * 0.35);
    c.lineTo(-L * 0.2, 0);
    c.moveTo(0, -L * 0.35);
    c.lineTo(L * 0.2, 0);
    c.stroke();
  } else {
    // spine with ribs, a skull, a tail
    c.beginPath();
    c.moveTo(-L * 0.55, -L * 0.25);
    c.quadraticCurveTo(0, -L * 0.42, L * 0.38, -L * 0.3);
    c.stroke();
    for (let i = 0; i < 5; i++) {
      const rx = -L * 0.25 + i * L * 0.12;
      c.beginPath();
      c.moveTo(rx, -L * 0.36);
      c.quadraticCurveTo(rx + L * 0.03, -L * 0.18, rx - L * 0.02, -L * 0.1);
      c.stroke();
    }
    c.beginPath();
    c.ellipse(L * 0.48, -L * 0.32, L * 0.12, L * 0.08, 0.2, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-L * 0.55, -L * 0.25);
    c.lineTo(-L * 0.85, -L * 0.12);
    c.stroke();
  }
  // embers still glowing in the bones
  if (k < 2) {
    c.fillStyle = `rgba(255,120,40,${(1 - k / 2) * 0.9})`;
    for (let i = 0; i < 6; i++) c.fillRect(Math.sin(i * 7.3) * L * 0.4, -L * (0.2 + (i % 3) * 0.08) - (g.kind === "human" ? L * 0.5 : 0), 2, 2);
  }
  c.restore();
}

/** The shockwave front rolling over the land. */
export function drawShockwave(c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  c.save();
  c.strokeStyle = `rgba(255,236,200,${0.55 * a})`;
  c.lineWidth = 26;
  c.beginPath();
  c.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = `rgba(150,110,80,${0.45 * a})`;
  c.lineWidth = 60;
  c.beginPath();
  c.ellipse(x, y, Math.max(1, r - 50), Math.max(1, (r - 50) * 0.7), 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}
