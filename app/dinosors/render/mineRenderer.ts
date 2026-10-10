/* ------------------------------------------------------------------ */
/*  The Deep, drawn side-on. Rock is baked into chunk canvases (only   */
/*  rebuilt when the mine changes); water, gas, magma, ore glow, the  */
/*  lift, scanner pings and the selection are drawn live on top.      */
/*  Look: dark rock with a cyan "survey scanner" overlay — uncharted  */
/*  rock is a faint grid, charted rock gets real texture.             */
/* ------------------------------------------------------------------ */
import { BANDS, DEEP_DEFS, FLOODED, LAMP_REACH, LIFT_X, M, MAGMA_FROM, MATERIALS, MILESTONES, MINE_H, MINE_W, type Content, type DeepKind } from "../data/mine";
import type { DeepBuilding } from "../sim/deepBuild";
import { idx, type Mine } from "../sim/mine";
import { fbm, hash2 } from "../sim/rng";

export const CELL = 32;
/** rows of sky + ground drawn above the barrier */
export const SKY_ROWS = 6;
const CHUNK = 16;

export interface DeepCam {
  x: number;
  y: number;
  zoom: number;
}

/** What the renderer needs to draw one miner. */
export interface CrewLook {
  id: number;
  x: number;
  y: number;
  face: 1 | -1;
  mode: string;
  anim: number;
  load: number;
  skin: string;
  hair: string;
  fur: string;
  hp: number;
  bubble: string | null;
  /** 0..1 progress on the cell being worked */
  progress: number;
  jobCell: number | null;
}

export interface DeepOverlay {
  /** the camp stockpile (vaults show their ore) */
  stock: Record<string, number>;
  /** where a building would go (build mode) */
  ghost: { kind: DeepKind; x: number; y: number; ok: boolean } | null;
  crew: CrewLook[];
  selectedMiners?: number[];
  lantern?: boolean;
  /** painting mode (shows a hint on hover) */
  mode: string;
  sel: number | null;
  hover: number | null;
  pings: { x: number; y: number; t: number }[];
  daylight: number;
  /** 0..1 black fade (the dive transition) */
  fade: number;
}

const CONTENT_LOOK: Partial<Record<Exclude<Content, null>, { color: string; glow: string; icon: string }>> = {
  copper: { color: "#3fbf9f", glow: "90,230,190", icon: "🟠" },
  iron: { color: "#b5654a", glow: "220,120,90", icon: "⛓️" },
  coal: { color: "#272a2f", glow: "105,120,140", icon: "⚫" },
  gold: { color: "#f6cf4a", glow: "255,215,90", icon: "🪙" },
  quartz: { color: "#e6f6fb", glow: "220,245,255", icon: "💠" },
  crystal: { color: "#8fe3ff", glow: "140,230,255", icon: "🔮" },
  magnetite: { color: "#5a6170", glow: "160,170,200", icon: "🧲" },
  obsidian: { color: "#5b3f78", glow: "180,140,255", icon: "🔮" },
  flint: { color: "#7d93aa", glow: "170,190,210", icon: "🔷" },
  salt: { color: "#f3efe6", glow: "250,250,240", icon: "🧂" },
  clay: { color: "#c07a52", glow: "220,150,110", icon: "🏺" },
  meteorite: { color: "#8b6fb0", glow: "255,120,90", icon: "☄️" },
  silver: { color: "#e6eaf0", glow: "235,240,255", icon: "🥈" },
  diamond: { color: "#f4fbff", glow: "220,250,255", icon: "💎" },
  lode: { color: "#c0634a", glow: "230,120,90", icon: "⛓️" },
  skeleton: { color: "#efe4c8", glow: "255,245,220", icon: "🦕" },
  geode: { color: "#8fe3ff", glow: "140,230,255", icon: "💠" },
  core: { color: "#a77fe0", glow: "255,140,110", icon: "☄️" },
  fossil: { color: "#efe4c8", glow: "255,245,220", icon: "🦴" },
  artifact: { color: "#cda974", glow: "220,175,110", icon: "🏺" },
  spring: { color: "#4fb6ff", glow: "90,180,255", icon: "💧" },
  caveIn: { color: "#ff9d5c", glow: "255,150,90", icon: "⚠️" },
  gas: { color: "#9be36b", glow: "150,230,110", icon: "☁️" },
};
export const contentLook = (c: Content) => (c ? CONTENT_LOOK[c] : undefined);

const shadeHex = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) * k : v * k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export class MineRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private t = 0;
  private chunks = new Map<number, { v: number; c: HTMLCanvasElement }>();
  private motes: { x: number; y: number; s: number; v: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 60; i++) this.motes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.5, v: 4 + Math.random() * 10 });
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  toWorld(cam: DeepCam, sx: number, sy: number) {
    return { x: cam.x + (sx - this.w / 2) / cam.zoom, y: cam.y + (sy - this.h / 2) / cam.zoom };
  }
  toScreen(cam: DeepCam, x: number, y: number) {
    return { x: (x - cam.x) * cam.zoom + this.w / 2, y: (y - cam.y) * cam.zoom + this.h / 2 };
  }
  /** Mine cell under a screen point (or null). */
  cellAt(cam: DeepCam, sx: number, sy: number) {
    const p = this.toWorld(cam, sx, sy);
    const cx = Math.floor(p.x / CELL);
    const cy = Math.floor(p.y / CELL);
    if (cx < 0 || cy < 0 || cx >= MINE_W || cy >= MINE_H) return null;
    return { x: cx, y: cy };
  }
  get size() {
    return { w: this.w, h: this.h };
  }

  /* ------------------------------ chunks (baked rock) ------------------------------ */

  private chunk(mine: Mine, k: number) {
    const have = this.chunks.get(k);
    if (have && have.v === mine.version) return have.c;
    const c = have?.c ?? document.createElement("canvas");
    c.width = MINE_W * CELL;
    c.height = CHUNK * CELL;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    for (let ry = 0; ry < CHUNK; ry++) {
      const y = k * CHUNK + ry;
      if (y >= MINE_H) break;
      for (let x = 0; x < MINE_W; x++) this.bakeCell(g, mine, x, y, x * CELL, ry * CELL);
    }
    this.chunks.set(k, { v: mine.version, c });
    // keep memory in check: drop chunks far from this one
    if (this.chunks.size > 8) for (const key of Array.from(this.chunks.keys())) if (Math.abs(key - k) > 4) this.chunks.delete(key);
    return c;
  }

  private bakeCell(g: CanvasRenderingContext2D, mine: Mine, x: number, y: number, px: number, py: number) {
    const i = idx(x, y);
    const m = mine.cells[i] as M;
    const seen = mine.seen[i];
    const s = mine.seed;
    if (m === M.Magma) return; // drawn live
    if (seen === 0 && m !== M.Shaft) {
      // uncharted: near-black with a faint survey grid
      g.fillStyle = "#06080a";
      g.fillRect(px, py, CELL, CELL);
      g.strokeStyle = "rgba(80,200,230,0.06)";
      g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
      if (hash2(x, y, s + 3) > 0.93) {
        g.fillStyle = "rgba(120,220,255,0.12)";
        g.fillRect(px + 14, py + 14, 2, 2);
      }
      return;
    }
    if (m === M.Open || m === M.Shaft) {
      // tunnel: the back wall, darker and a bit warmer with depth
      const depth = y / MINE_H;
      g.fillStyle = m === M.Shaft ? "#101317" : `rgb(${26 - depth * 8},${20 - depth * 8},${17 - depth * 6})`;
      g.fillRect(px, py, CELL, CELL);
      if (m === M.Open) {
        g.fillStyle = "rgba(255,255,255,0.025)";
        for (let k = 0; k < 3; k++) g.fillRect(px + hash2(x, y + k, s) * 28, py + hash2(y, x + k, s) * 28, 3, 2);
        // floor where there's rock below
        if (MATERIALS[mine.cells[i + MINE_W] as M]?.solid) {
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.fillRect(px, py + CELL - 4, CELL, 4);
        }
      } else {
        // the shaft: guide rails + rungs
        g.fillStyle = "#3b4350";
        g.fillRect(px + 5, py, 3, CELL);
        g.fillRect(px + CELL - 8, py, 3, CELL);
        g.fillStyle = "rgba(120,200,230,0.18)";
        g.fillRect(px + 8, py + 14, CELL - 16, 2);
      }
      return;
    }
    // charted rock
    const def = MATERIALS[m];
    const base = def.color;
    // soft large-scale shading so neighbouring cells blend instead of checkering
    const v = (fbm(x / 5, y / 5, s + 61, 2) - 0.5) * 0.3 + (hash2(x, y, s + 11) - 0.5) * 0.05;
    g.fillStyle = shadeHex(base, v);
    g.fillRect(px, py, CELL, CELL);
    // texture by rock type
    if (m === M.Soil || m === M.Clay) {
      g.fillStyle = shadeHex(base, -0.25);
      for (let k = 0; k < 6; k++) g.fillRect(px + hash2(x * 7 + k, y, s) * 30, py + hash2(x, y * 7 + k, s) * 30, 2, 2);
    } else if (m === M.Sandstone) {
      g.strokeStyle = shadeHex(base, -0.18);
      g.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        const yy = py + k * 8 + Math.sin(x * 0.7 + k) * 1.5;
        g.beginPath();
        g.moveTo(px, yy);
        g.lineTo(px + CELL, yy + 1);
        g.stroke();
      }
    } else if (m === M.Stone || m === M.Granite) {
      g.fillStyle = shadeHex(base, m === M.Granite ? 0.3 : -0.2);
      for (let k = 0; k < (m === M.Granite ? 10 : 4); k++) g.fillRect(px + hash2(x * 5 + k, y, s) * 30, py + hash2(x, y * 5 + k, s) * 30, m === M.Granite ? 2 : 4, m === M.Granite ? 2 : 3);
      if (m === M.Granite) {
        g.fillStyle = "rgba(255,200,210,0.25)";
        for (let k = 0; k < 3; k++) g.fillRect(px + hash2(x + k, y * 3, s) * 30, py + hash2(x * 3, y + k, s) * 30, 2, 2);
      }
    } else if (m === M.Volcanic) {
      g.strokeStyle = "rgba(255,90,40,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px + hash2(x, y, s) * 32, py);
      g.lineTo(px + 16, py + 16);
      g.lineTo(px + hash2(y, x, s) * 32, py + 32);
      g.stroke();
    } else if (m === M.Rubble) {
      for (let k = 0; k < 5; k++) {
        g.fillStyle = shadeHex(base, (hash2(x + k, y, s) - 0.5) * 0.5);
        g.beginPath();
        g.arc(px + 4 + hash2(x * 3 + k, y, s) * 24, py + 4 + hash2(x, y * 3 + k, s) * 24, 3 + hash2(k, x + y, s) * 4, 0, Math.PI * 2);
        g.fill();
      }
    } else if (m === M.Bedrock) {
      // dense, banded, faintly glittering
      g.fillStyle = "#2c2e36";
      g.fillRect(px, py, CELL, CELL);
      g.strokeStyle = "rgba(120,130,160,0.35)";
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const yy = py + 6 + k * 10 + Math.sin(x * 0.9 + k) * 2;
        g.beginPath();
        g.moveTo(px, yy);
        g.lineTo(px + CELL, yy + 1);
        g.stroke();
      }
      g.fillStyle = "rgba(170,190,230,0.35)";
      for (let k = 0; k < 3; k++) g.fillRect(px + hash2(x + k, y, s) * 30, py + hash2(x, y + k, s) * 30, 1.5, 1.5);
    } else if (m === M.Barrier) {
      g.strokeStyle = "rgba(120,200,255,0.35)";
      g.lineWidth = 1.5;
      g.beginPath();
      for (let xx = 0; xx <= CELL; xx += 4) g.lineTo(px + xx, py + 16 + Math.sin((x * CELL + xx) * 0.2) * 3);
      g.stroke();
    }
    // carved edges facing open space: lit rim + shadow
    const open = (a: number, b: number) => {
      if (a < 0 || b < 0 || a >= MINE_W || b >= MINE_H) return false;
      const n = mine.cells[idx(a, b)];
      return (n === M.Open || n === M.Shaft) && mine.seen[idx(a, b)] > 0;
    };
    g.fillStyle = shadeHex(base, 0.35);
    if (open(x, y - 1)) g.fillRect(px, py, CELL, 3);
    if (open(x - 1, y)) g.fillRect(px, py, 2, CELL);
    if (open(x + 1, y)) g.fillRect(px + CELL - 2, py, 2, CELL);
    g.fillStyle = "rgba(0,0,0,0.35)";
    if (open(x, y + 1)) g.fillRect(px, py + CELL - 3, CELL, 3);
    // what's inside, once known
    if (seen === 2) {
      const c = mine.known.get(i) ?? null;
      const look = contentLook(c);
      // a vein / seam: streaks joining up with the same ore next door
      const ore = mine.ore[i];
      if (ore && look) {
        g.strokeStyle = look.color;
        g.lineCap = "round";
        g.lineWidth = 7;
        let joined = false;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]]) {
          const a = x + dx;
          const b = y + dy;
          if (a < 0 || b < 0 || a >= MINE_W || b >= MINE_H) continue;
          const j = idx(a, b);
          if (mine.ore[j] !== ore || (mine.seen[j] !== 2 && MATERIALS[mine.cells[j] as M].solid)) continue;
          joined = true;
          g.beginPath();
          g.moveTo(px + 16, py + 16);
          g.lineTo(px + 16 + dx * 16, py + 16 + dy * 16);
          g.stroke();
        }
        if (!joined) {
          g.fillStyle = look.color;
          g.beginPath();
          g.arc(px + 16, py + 16, 5, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = shadeHex(look.color, -0.35);
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(px + 16, py + 16, 6, 0, Math.PI * 2);
        g.stroke();
      }
      if (look) this.bakeContent(g, c!, look.color, px, py, x, y, s);
    }
  }

  private bakeContent(g: CanvasRenderingContext2D, c: Exclude<Content, null>, color: string, px: number, py: number, x: number, y: number, s: number) {
    if (c === "spring" || c === "caveIn" || c === "gas") {
      // hazard marker: a hollow diamond
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(px + 16, py + 7);
      g.lineTo(px + 25, py + 16);
      g.lineTo(px + 16, py + 25);
      g.lineTo(px + 7, py + 16);
      g.closePath();
      g.stroke();
      return;
    }
    if (c === "skeleton") {
      // a vertebra / rib section
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(px + 3, py + 16);
      g.lineTo(px + 29, py + 16);
      for (let k = 0; k < 4; k++) {
        g.moveTo(px + 6 + k * 7, py + 16);
        g.quadraticCurveTo(px + 9 + k * 7, py + 4, px + 5 + k * 7, py + 3);
        g.moveTo(px + 6 + k * 7, py + 16);
        g.lineTo(px + 6 + k * 7, py + 24);
      }
      g.stroke();
      return;
    }
    if (c === "geode") {
      g.fillStyle = "rgba(20,40,60,0.6)";
      g.beginPath();
      g.arc(px + 16, py + 16, 13, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + hash2(x, y, s) * 2;
        g.fillStyle = k % 2 ? color : "#c7b8ff";
        g.beginPath();
        g.moveTo(px + 16 + Math.cos(a) * 12, py + 16 + Math.sin(a) * 12);
        g.lineTo(px + 16 + Math.cos(a + 0.25) * 4, py + 16 + Math.sin(a + 0.25) * 4);
        g.lineTo(px + 16 + Math.cos(a - 0.25) * 4, py + 16 + Math.sin(a - 0.25) * 4);
        g.closePath();
        g.fill();
      }
      return;
    }
    if (c === "core") {
      g.fillStyle = "#3c3141";
      g.beginPath();
      g.arc(px + 16, py + 16, 13, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,140,90,0.8)";
      g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(px + 6 + k * 7, py + 8);
        g.lineTo(px + 10 + k * 6, py + 18);
        g.lineTo(px + 7 + k * 7, py + 26);
        g.stroke();
      }
      return;
    }
    if (c === "diamond") {
      g.fillStyle = "#e9f8ff";
      g.beginPath();
      g.moveTo(px + 16, py + 7);
      g.lineTo(px + 24, py + 14);
      g.lineTo(px + 16, py + 26);
      g.lineTo(px + 8, py + 14);
      g.closePath();
      g.fill();
      g.strokeStyle = "#8fd8ff";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px + 8, py + 14);
      g.lineTo(px + 24, py + 14);
      g.moveTo(px + 13, py + 7);
      g.lineTo(px + 16, py + 14);
      g.lineTo(px + 19, py + 7);
      g.stroke();
      return;
    }
    if (c === "fossil") {
      g.strokeStyle = color;
      g.lineWidth = 2.5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(px + 8, py + 18);
      g.quadraticCurveTo(px + 16, py + 10, px + 25, py + 15);
      for (let k = 0; k < 3; k++) {
        g.moveTo(px + 11 + k * 5, py + 15);
        g.lineTo(px + 10 + k * 5, py + 22);
      }
      g.stroke();
      return;
    }
    if (c === "artifact") {
      g.fillStyle = "#8c6949";
      g.fillRect(px + 10, py + 8, 13, 17);
      g.fillStyle = color;
      g.fillRect(px + 12, py + 10, 9, 13);
      g.strokeStyle = "#fae6b7";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px + 14, py + 14);
      g.lineTo(px + 18, py + 14);
      g.lineTo(px + 16, py + 19);
      g.stroke();
      return;
    }
    if (c === "gold" || c === "silver") {
      // Irregular metallic nuggets are easy to tell apart from stone and crystal.
      const light = c === "gold" ? "#fff3ae" : "#ffffff";
      const shadow = c === "gold" ? "#8f5b17" : "#667b90";
      for (let k = 0; k < 3; k++) {
        const nx = px + 7 + hash2(x * 13 + k, y, s + 71) * 18;
        const ny = py + 7 + hash2(x, y * 13 + k, s + 71) * 18;
        const r = 3 + hash2(k, x + y, s + 19) * 3;
        g.fillStyle = shadow;
        g.beginPath();
        g.ellipse(nx + 1, ny + 1, r + 2, r, -0.35, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(nx, ny, r + 1, r - 0.5, -0.35, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = light;
        g.fillRect(nx - r * 0.35, ny - r * 0.5, Math.max(1, r * 0.7), 1.5);
      }
      return;
    }
    // ore: a few faceted nuggets / a vein
    for (let k = 0; k < 4; k++) {
      const cx = px + 6 + hash2(x * 9 + k, y, s + 5) * 20;
      const cy = py + 6 + hash2(x, y * 9 + k, s + 5) * 20;
      const r = 2.5 + hash2(k, x + y, s) * 3;
      g.fillStyle = shadeHex(color, -0.25);
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.fill();
      g.fillStyle = color;
      g.fillRect(cx - r * 0.3, cy - r * 0.6, r * 0.6, r * 0.6);
    }
  }

  /* ------------------------------ frame ------------------------------ */

  render(mine: Mine, cam: DeepCam, ov: DeepOverlay, dt: number) {
    this.t += dt;
    const c = this.ctx;
    const d = this.dpr;
    const z = cam.zoom;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = "#040506";
    c.fillRect(0, 0, this.w, this.h);
    c.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 - cam.x * z), d * (this.h / 2 - cam.y * z));
    const v0 = this.toWorld(cam, 0, 0);
    const v1 = this.toWorld(cam, this.w, this.h);
    const y0 = Math.max(0, Math.floor(v0.y / CELL));
    const y1 = Math.min(MINE_H - 1, Math.ceil(v1.y / CELL));
    const x0 = Math.max(0, Math.floor(v0.x / CELL));
    const x1 = Math.min(MINE_W - 1, Math.ceil(v1.x / CELL));

    this.drawSurface(c, ov.daylight);
    c.imageSmoothingEnabled = z < 1;
    for (let k = Math.floor(y0 / CHUNK); k <= Math.floor(y1 / CHUNK); k++) c.drawImage(this.chunk(mine, k), 0, k * CHUNK * CELL);

    this.drawMagma(c, x0, x1, y0, y1);
    this.drawLive(c, mine, x0, x1, y0, y1);
    for (const [i, find] of Array.from(mine.loose)) {
      const x = i % MINE_W;
      const y = Math.floor(i / MINE_W);
      if (x < x0 || x > x1 || y < y0 || y > y1 || !mine.seen[i] || mine.cells[i] !== M.Open) continue;
      const px = x * CELL + 16;
      const py = y * CELL + 24;
      const r = find.size === "giant" ? 10 : find.size === "large" ? 8 : find.size === "small" ? 6 : 4;
      c.fillStyle = find.metal === "gold" ? "#a36d1b" : "#66798d";
      c.beginPath();
      c.ellipse(px + 1, py + 2, r + 2, r * 0.62, -0.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = find.metal === "gold" ? "#f9d361" : "#e2eaf2";
      c.beginPath();
      c.ellipse(px, py, r, r * 0.6, -0.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffff";
      c.fillRect(px - r * 0.3, py - r * 0.35, Math.max(1, r * 0.6), 1.5);
    }
    this.drawSupports(c, mine, x0, x1, y0, y1);
    for (const b of mine.builds) if (b.x <= x1 + 1 && b.x + DEEP_DEFS[b.kind].w >= x0 - 1 && b.y <= y1 + 1 && b.y + DEEP_DEFS[b.kind].h >= y0 - 1) this.drawDeepBuilding(c, b, ov.stock);
    this.drawDarkness(c, mine, ov, x0, x1, y0, y1);
    if (ov.ghost) this.drawGhost(c, ov.ghost);
    this.drawOrders(c, mine, x0, x1, y0, y1);
    for (const worker of ov.crew) {
      if (worker.jobCell === null || worker.mode !== "dig" || worker.progress <= 0) continue;
      const px = (worker.jobCell % MINE_W) * CELL;
      const py = Math.floor(worker.jobCell / MINE_W) * CELL;
      c.fillStyle = `rgba(8,6,5,${Math.min(0.5, worker.progress * 0.5)})`;
      c.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      c.strokeStyle = "rgba(242,216,166,0.7)";
      c.lineWidth = 1 + worker.progress * 2;
      c.beginPath();
      c.moveTo(px + 9, py + 4);
      c.lineTo(px + 13 + worker.progress * 12, py + 15);
      c.lineTo(px + 8, py + 27);
      c.moveTo(px + 22, py + 2);
      c.lineTo(px + 20 - worker.progress * 9, py + 14);
      c.stroke();
      c.fillStyle = "#e6c991";
      c.fillRect(px + 3, py + CELL - 4, (CELL - 6) * worker.progress, 2);
    }
    this.drawLift(c, mine);
    this.drawCrates(c, mine);
    for (const find of mine.finds) {
      const x = (find.cell % MINE_W + 0.5) * CELL;
      const y = (Math.floor(find.cell / MINE_W) + 0.5) * CELL;
      c.save();
      c.globalAlpha = Math.max(0, 1 - find.t / 1.5);
      c.fillStyle = find.metal === "gold" ? "#ffe477" : "#e3f4ff";
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + hash2(k, find.cell, mine.seed) * 0.35;
        const dist = find.t * (18 + k * 2);
        const size = k % 3 === 0 ? 4 : 2;
        c.fillRect(x + Math.cos(a) * dist - size / 2, y + Math.sin(a) * dist - size / 2 - find.t * 12, size, size);
      }
      c.restore();
    }
    for (const cr of mine.critters) this.drawTroglodon(c, cr);
    for (const m of ov.crew) {
      if (ov.selectedMiners?.includes(m.id)) {
        c.strokeStyle = "#67e8f9";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(m.x * CELL, m.y * CELL + 12, 14, 5, 0, 0, Math.PI * 2);
        c.stroke();
      }
      this.drawMiner(c, m);
    }
    this.drawCharges(c, mine);
    this.drawRuler(c, mine, cam, y0, y1);
    this.drawPings(c, ov.pings);
    this.drawCursor(c, mine, ov);

    // screen-space: dust motes, vignette, the dive fade
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = "rgba(200,220,230,0.18)";
    for (const m of this.motes) {
      m.y += (m.v * dt) / this.h;
      if (m.y > 1) m.y -= 1;
      c.fillRect(m.x * this.w + Math.sin(this.t + m.v) * 6, m.y * this.h, m.s, m.s);
    }
    const g = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.65)");
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    // a faint scanline sweep (the survey overlay)
    const sweep = ((this.t * 0.12) % 1) * (this.h + 200) - 100;
    const sg = c.createLinearGradient(0, sweep - 60, 0, sweep);
    sg.addColorStop(0, "rgba(90,220,255,0)");
    sg.addColorStop(1, "rgba(90,220,255,0.05)");
    c.fillStyle = sg;
    c.fillRect(0, sweep - 60, this.w, 60);
    if (ov.fade > 0) {
      c.fillStyle = `rgba(0,0,0,${Math.min(1, ov.fade)})`;
      c.fillRect(0, 0, this.w, this.h);
    }
  }

  private drawDarkness(c: CanvasRenderingContext2D, mine: Mine, ov: DeepOverlay, x0: number, x1: number, y0: number, y1: number) {
    const lamps = mine.builds.filter((b) => (b.kind === "lamp" || b.kind === "torch") && b.built >= 1 && b.x >= x0 - 6 && b.x <= x1 + 6 && b.y >= y0 - 6 && b.y <= y1 + 6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (!mine.seen[i] || mine.cells[i] === M.Magma) continue;
      let brightness = x === LIFT_X && y <= mine.liftMax ? 0.7 : y <= 2 ? 0.45 : 0.06;
      for (const lamp of lamps) brightness = Math.max(brightness, 1 - Math.hypot(lamp.x - x, lamp.y - y) / (lamp.kind === "torch" ? 4 : LAMP_REACH + 1));
      for (const miner of ov.crew) brightness = Math.max(brightness, 1 - Math.hypot(miner.x - x - 0.5, miner.y - y - 0.5) / (ov.lantern ? 5 : 2));
      const content = mine.known.get(i);
      if (mine.seen[i] === 2 && (content === "crystal" || content === "geode")) brightness = Math.max(brightness, 0.65);
      const alpha = Math.max(0, Math.min(0.78, (1 - brightness) * 0.73));
      if (alpha > 0.02) {
        c.fillStyle = `rgba(1,4,9,${alpha})`;
        c.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  /** Black fade drawn over whatever is on the canvas (for the dive). */
  fade(a: number) {
    if (a <= 0) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`;
    c.fillRect(0, 0, this.w, this.h);
  }

  /** Sky, grass and the headframe over the shaft, above row 0. */
  private drawSurface(c: CanvasRenderingContext2D, day: number) {
    const top = -SKY_ROWS * CELL;
    const W = MINE_W * CELL;
    const sky = c.createLinearGradient(0, top, 0, 0);
    sky.addColorStop(0, day > 0.4 ? "#5fb6e8" : "#0d1630");
    sky.addColorStop(1, day > 0.4 ? "#bfe6f7" : "#2a2f4f");
    c.fillStyle = sky;
    c.fillRect(-W, top, W * 3, -top);
    // grass + topsoil lip
    c.fillStyle = "#4f8f3a";
    c.fillRect(-W, -10, W * 3, 10);
    c.fillStyle = "#3d6f2c";
    for (let x = -W; x < W * 2; x += 9) c.fillRect(x, -14 - (x % 3), 2, 6);
    // the cliff + cave mouth on the left, where the lift comes up
    const sx = LIFT_X * CELL;
    c.fillStyle = "#6f655b";
    c.beginPath();
    c.moveTo(-W, -10);
    c.lineTo(-W, top + 30);
    c.lineTo(sx - 70, top + 50);
    c.lineTo(sx - 30, -10);
    c.closePath();
    c.fill();
    c.fillStyle = "#1c1612";
    c.beginPath();
    c.ellipse(sx - 44, -10, 22, 30, 0, Math.PI, 0);
    c.fill();
    // headframe: two struts, a wheel and a glowing cable
    c.strokeStyle = "#8a96a8";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(sx - 6, -10);
    c.lineTo(sx + 16, top + 40);
    c.lineTo(sx + 38, -10);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.arc(sx + 16, top + 40, 12, 0, Math.PI * 2);
    c.stroke();
    c.save();
    c.translate(sx + 16, top + 40);
    c.rotate(this.t);
    c.beginPath();
    c.moveTo(-12, 0);
    c.lineTo(12, 0);
    c.moveTo(0, -12);
    c.lineTo(0, 12);
    c.stroke();
    c.restore();
    c.fillStyle = `rgba(90,220,255,${0.6 + Math.sin(this.t * 3) * 0.3})`;
    c.beginPath();
    c.arc(sx + 16, top + 22, 3, 0, Math.PI * 2);
    c.fill();
  }

  private drawMagma(c: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number) {
    if (y1 < MAGMA_FROM - 9) return;
    const L = x0 * CELL - CELL;
    const R = (x1 + 2) * CELL;
    const top = (MAGMA_FROM - 1) * CELL;
    // heat haze above the magma
    const haze = c.createLinearGradient(0, top - 7 * CELL, 0, top);
    haze.addColorStop(0, "rgba(255,90,30,0)");
    haze.addColorStop(1, "rgba(255,90,30,0.38)");
    c.fillStyle = haze;
    c.fillRect(L, top - 7 * CELL, R - L, 7 * CELL);
    // the molten sea: a slow wavy surface over a hot gradient
    const g = c.createLinearGradient(0, top - 10, 0, MINE_H * CELL);
    g.addColorStop(0, "#ffd36b");
    g.addColorStop(0.08, "#ff8a2a");
    g.addColorStop(0.4, "#e2471a");
    g.addColorStop(1, "#7a1a0c");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(L, MINE_H * CELL + 40);
    for (let x = L; x <= R; x += 12) c.lineTo(x, top - 6 + Math.sin(x * 0.02 + this.t * 1.3) * 5 + Math.sin(x * 0.051 - this.t * 0.8) * 3);
    c.lineTo(R, MINE_H * CELL + 40);
    c.closePath();
    c.fill();
    // glowing crust plates drifting on top
    c.fillStyle = "rgba(60,20,12,0.45)";
    for (let k = 0; k < 14; k++) {
      const px = L + ((k * 211 + this.t * 9) % (R - L));
      const py = top + 18 + (k % 4) * 40;
      c.beginPath();
      c.ellipse(px, py, 26 + (k % 3) * 10, 7, 0, 0, Math.PI * 2);
      c.fill();
    }
    // bubbles
    for (let k = 0; k < 10; k++) {
      const ph = (this.t * 0.6 + k * 0.37) % 1;
      const px = L + ((k * 397) % (R - L));
      c.fillStyle = `rgba(255,235,150,${(1 - ph) * 0.9})`;
      c.beginPath();
      c.arc(px, top - 2 - ph * 10, 2 + ph * 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  private drawLive(c: CanvasRenderingContext2D, mine: Mine, x0: number, x1: number, y0: number, y1: number) {
    const t = this.t;
    c.save();
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        const px = x * CELL;
        const py = y * CELL;
        const wv = mine.water[i];
        if (wv > 0.01 && mine.seen[i]) {
          const h = Math.min(1, wv) * CELL;
          const g = c.createLinearGradient(0, py + CELL - h, 0, py + CELL);
          g.addColorStop(0, wv > FLOODED ? "rgba(70,170,255,0.75)" : "rgba(70,170,255,0.5)");
          g.addColorStop(1, "rgba(20,70,140,0.85)");
          c.fillStyle = g;
          c.fillRect(px, py + CELL - h, CELL, h);
          c.fillStyle = "rgba(200,240,255,0.6)";
          c.fillRect(px, py + CELL - h, CELL, 1.5 + Math.sin(t * 4 + x) * 0.5);
        }
        if (mine.springs.has(i) && mine.seen[i]) {
          const k = (t * 2 + x) % 1;
          c.fillStyle = "rgba(160,220,255,0.9)";
          c.beginPath();
          c.arc(px + 16, py + 4 + k * 22, 2, 0, Math.PI * 2);
          c.fill();
        }
        if (mine.gas.has(i)) {
          c.fillStyle = `rgba(150,230,110,${0.12 + Math.sin(t * 2 + x * 0.7 + y) * 0.05})`;
          c.beginPath();
          c.arc(px + 16 + Math.sin(t + y) * 4, py + 16, 18, 0, Math.PI * 2);
          c.fill();
        }
        // known ore + crystals glow softly
        if (mine.seen[i] === 2 && mine.known.has(i)) {
          const look = contentLook(mine.known.get(i) ?? null);
          if (look) {
            const pulse = 0.25 + (Math.sin(t * 2.2 + x * 1.3 + y) + 1) * 0.15;
            const g = c.createRadialGradient(px + 16, py + 16, 0, px + 16, py + 16, 24);
            g.addColorStop(0, `rgba(${look.glow},${pulse})`);
            g.addColorStop(1, `rgba(${look.glow},0)`);
            c.fillStyle = g;
            c.fillRect(px - 8, py - 8, CELL + 16, CELL + 16);
          }
        }
      }
    c.restore();
  }

  private drawSupports(c: CanvasRenderingContext2D, mine: Mine, x0: number, x1: number, y0: number, y1: number) {
    for (const i of Array.from(mine.supports)) {
      const x = i % MINE_W;
      const y = (i - x) / MINE_W;
      if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
      const px = x * CELL;
      const py = y * CELL;
      c.fillStyle = "#8a5d34";
      c.fillRect(px + 4, py, 5, CELL);
      c.fillRect(px + CELL - 9, py, 5, CELL);
      c.fillStyle = "#a8743f";
      c.fillRect(px + 1, py, CELL - 2, 5);
      c.fillStyle = "rgba(90,220,255,0.5)";
      c.fillRect(px + CELL / 2 - 1, py + 6, 2, 2);
    }
  }

  private drawLift(c: CanvasRenderingContext2D, mine: Mine) {
    const sx = LIFT_X * CELL;
    // cable from the headframe
    c.strokeStyle = "rgba(160,200,230,0.7)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(sx + 16, -SKY_ROWS * CELL + 40);
    c.lineTo(sx + 16, mine.liftY * CELL + 2);
    c.stroke();
    // the deepest stop
    c.fillStyle = "rgba(90,220,255,0.8)";
    c.fillRect(sx + 2, (mine.liftMax + 1) * CELL - 3, CELL - 4, 3);
    // the car: a caged platform with running lights
    const py = mine.liftY * CELL;
    c.fillStyle = "#2b3440";
    c.fillRect(sx + 2, py + 2, CELL - 4, CELL - 4);
    c.strokeStyle = "#8a96a8";
    c.lineWidth = 2;
    c.strokeRect(sx + 3, py + 3, CELL - 6, CELL - 6);
    c.beginPath();
    c.moveTo(sx + 3, py + 16);
    c.lineTo(sx + CELL - 3, py + 16);
    c.stroke();
    const blink = Math.sin(this.t * 6) > 0;
    c.fillStyle = blink ? "#5fe3ff" : "#1f6f86";
    c.fillRect(sx + 5, py + 5, 3, 3);
    c.fillRect(sx + CELL - 8, py + 5, 3, 3);
    // lamp light
    const g = c.createRadialGradient(sx + 16, py + 16, 0, sx + 16, py + 16, 90);
    g.addColorStop(0, "rgba(255,230,180,0.22)");
    g.addColorStop(1, "rgba(255,230,180,0)");
    c.fillStyle = g;
    c.fillRect(sx - 80, py - 80, 190, 190);
  }

  /** Depth ruler + band names along the left edge of the mine. */
  private drawRuler(c: CanvasRenderingContext2D, mine: Mine, cam: DeepCam, y0: number, y1: number) {
    const inv = 1 / cam.zoom;
    c.save();
    c.font = `${11 * inv}px ui-monospace, monospace`;
    c.textBaseline = "middle";
    for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) {
      const py = y * CELL;
      c.fillStyle = "rgba(90,220,255,0.55)";
      c.fillRect(-14 * inv, py, 10 * inv, 1.2 * inv);
      c.textAlign = "right";
      c.fillText(`${y * 6} ft`, -18 * inv, py);
    }
    for (const b of BANDS) {
      if (b.from < y0 - 2 || b.from > y1) continue;
      const py = b.from * CELL;
      c.strokeStyle = "rgba(90,220,255,0.18)";
      c.setLineDash([8 * inv, 6 * inv]);
      c.lineWidth = inv;
      c.beginPath();
      c.moveTo(0, py);
      c.lineTo(MINE_W * CELL, py);
      c.stroke();
      c.setLineDash([]);
      c.textAlign = "left";
      c.fillStyle = "rgba(180,240,255,0.75)";
      c.font = `bold ${12 * inv}px ui-sans-serif, system-ui`;
      c.fillText(b.name.toUpperCase(), (MINE_W * CELL) + 10 * inv, py + 10 * inv);
      c.font = `${11 * inv}px ui-monospace, monospace`;
    }
    // depth milestones (gold once reached)
    for (const ms of MILESTONES) {
      if (ms.row < y0 - 1 || ms.row > y1 + 1) continue;
      const py = ms.row * CELL;
      const got = mine.milestones.has(ms.id);
      c.fillStyle = got ? "rgba(255,210,90,0.9)" : "rgba(255,255,255,0.35)";
      c.beginPath();
      c.moveTo(-26 * inv, py);
      c.lineTo(-20 * inv, py - 5 * inv);
      c.lineTo(-14 * inv, py);
      c.lineTo(-20 * inv, py + 5 * inv);
      c.closePath();
      c.fill();
      c.textAlign = "right";
      c.font = `${10 * inv}px ui-sans-serif, system-ui`;
      c.fillText(`${ms.icon} ${ms.name}`, -30 * inv, py + 12 * inv);
      c.font = `${11 * inv}px ui-monospace, monospace`;
    }
    // the deepest anyone has dug
    if (mine.stats.deepest > 0) {
      const py = (mine.stats.deepest + 1) * CELL;
      c.fillStyle = "rgba(255,200,90,0.7)";
      c.fillRect(-14 * inv, py, 10 * inv, 2 * inv);
    }
    c.restore();
  }

  /* ------------------------------ rooms ------------------------------ */

  private drawDeepBuilding(c: CanvasRenderingContext2D, b: DeepBuilding, stock: Record<string, number>) {
    const d = DEEP_DEFS[b.kind];
    const X = b.x * CELL;
    const Y = b.y * CELL;
    const W = d.w * CELL;
    const H = d.h * CELL;
    const floor = Y + H;
    const t = this.t;
    if (b.built < 1) {
      // a site: marked out, scaffolding rising with the work
      c.strokeStyle = "rgba(95,227,255,0.7)";
      c.setLineDash([6, 4]);
      c.lineWidth = 1.5;
      c.strokeRect(X + 2, Y + 2, W - 4, H - 4);
      c.setLineDash([]);
      if (b.have) {
        c.fillStyle = "#9a6b3c";
        c.fillRect(X + 4, floor - 8, 10, 7);
        c.fillRect(X + 15, floor - 6, 8, 5);
      }
      const k = b.built;
      c.strokeStyle = "#8a6238";
      c.lineWidth = 2;
      c.beginPath();
      for (const x of [X + 4, X + W - 4]) {
        c.moveTo(x, floor);
        c.lineTo(x, floor - (H - 6) * k);
      }
      c.moveTo(X + 4, floor - (H - 6) * k);
      c.lineTo(X + W - 4, floor - (H - 6) * k);
      c.stroke();
      c.font = "bold 10px ui-sans-serif, system-ui";
      c.textAlign = "center";
      c.fillStyle = "rgba(200,245,255,0.9)";
      c.fillText(`${d.icon} ${b.have ? Math.round(k * 100) + "%" : "needs supplies"}`, X + W / 2, Y + 12);
      return;
    }
    // finished: a carved, lined room
    c.fillStyle = "rgba(40,30,22,0.65)";
    c.fillRect(X + 1, Y + 1, W - 2, H - 2);
    c.strokeStyle = "#7a5a3a";
    c.lineWidth = 3;
    c.strokeRect(X + 2.5, Y + 2.5, W - 5, H - 5);
    switch (b.kind) {
      case "home": {
        // two bunks, a round door, a warm lamp + a window glow
        const glow = c.createRadialGradient(X + W * 0.7, Y + H * 0.45, 0, X + W * 0.7, Y + H * 0.45, W * 0.7);
        glow.addColorStop(0, "rgba(255,190,110,0.35)");
        glow.addColorStop(1, "rgba(255,190,110,0)");
        c.fillStyle = glow;
        c.fillRect(X, Y, W, H);
        c.fillStyle = "#6b4a2a";
        c.fillRect(X + 6, Y + 14, 34, 4);
        c.fillRect(X + 6, Y + 38, 34, 4);
        c.fillStyle = "#c9775a";
        c.fillRect(X + 8, Y + 10, 28, 4);
        c.fillStyle = "#5f7da8";
        c.fillRect(X + 8, Y + 34, 28, 4);
        c.fillStyle = "#3a2a1c";
        c.beginPath();
        c.ellipse(X + W - 22, floor - 14, 10, 14, 0, Math.PI, 0);
        c.fillRect(X + W - 32, floor - 14, 20, 12);
        c.fill();
        c.fillStyle = "#f2b33d";
        c.beginPath();
        c.arc(X + W - 16, floor - 10, 1.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `rgba(255,214,140,${0.75 + Math.sin(t * 3) * 0.15})`;
        c.beginPath();
        c.arc(X + W * 0.62, Y + 12, 4, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case "pump": {
        // a pipe up through the rock, a turning wheel and a water gauge
        c.fillStyle = "#4a5260";
        c.fillRect(X + 12, Y - 4, 8, H + 4);
        c.fillStyle = "#7d8796";
        c.fillRect(X + 13, Y - 4, 2, H + 4);
        c.save();
        c.translate(X + 16, Y + 18);
        c.rotate(b.grow * Math.PI * 2);
        c.strokeStyle = "#c8743f";
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(0, 0, 9, 0, Math.PI * 2);
        for (let k = 0; k < 4; k++) {
          c.moveTo(0, 0);
          c.lineTo(Math.cos((k * Math.PI) / 2) * 9, Math.sin((k * Math.PI) / 2) * 9);
        }
        c.stroke();
        c.restore();
        // tank + gauge
        c.fillStyle = "#2c3a4a";
        c.fillRect(X + 5, floor - 22, 22, 20);
        const lvl = Math.min(1, (stock.water ?? 0) / 100);
        c.fillStyle = "rgba(80,170,255,0.85)";
        c.fillRect(X + 7, floor - 4 - 16 * lvl, 18, 16 * lvl);
        c.fillStyle = "rgba(200,240,255,0.7)";
        c.fillRect(X + 7, floor - 4 - 16 * lvl, 18, 1.5);
        break;
      }
      case "vault": {
        // heaps of raw ore on the floor
        const heap = (hx: number, n: number, col: string, dark: string) => {
          const r = Math.min(9, 2 + Math.sqrt(n) * 1.4);
          if (n <= 0) return;
          c.fillStyle = dark;
          c.beginPath();
          c.ellipse(hx, floor - 2, r + 1, r * 0.55 + 1, 0, Math.PI, 0);
          c.fill();
          c.fillStyle = col;
          for (let k = 0; k < Math.min(8, 2 + n / 3); k++) c.fillRect(hx - r + ((k * 7) % (r * 2)), floor - 3 - ((k * 5) % (r * 0.6 + 1)), 2.5, 2.5);
        };
        heap(X + 10, stock.gold ?? 0, "#f6cf4a", "#8a6b1c");
        heap(X + 22, stock.silver ?? 0, "#e6eaf0", "#6a6f78");
        heap(X + 34, stock.copper ?? 0, "#e07b3c", "#7a3f1c");
        heap(X + 50, stock.iron ?? 0, "#b5654a", "#5a2f22");
        // shelves of crates, a blue lock light
        c.fillStyle = "#5a4330";
        for (const yy of [Y + 20, floor - 6]) c.fillRect(X + 4, yy, W - 8, 3);
        c.fillStyle = "#9a6b3c";
        for (let k = 0; k < 3; k++) {
          c.fillRect(X + 7 + k * 17, Y + 8, 13, 12);
          c.fillRect(X + 7 + k * 17, floor - 18, 13, 12);
        }
        c.fillStyle = "#f6cf4a";
        c.fillRect(X + 10, Y + 5, 4, 3);
        c.fillStyle = "#e07b3c";
        c.fillRect(X + 28, floor - 21, 4, 3);
        c.fillStyle = `rgba(90,220,255,${0.6 + Math.sin(t * 4) * 0.3})`;
        c.fillRect(X + W - 9, Y + H / 2 - 2, 4, 4);
        break;
      }
      case "gallery": {
        c.fillStyle = "#6b5137";
        c.fillRect(X + 6, floor - 9, W - 12, 4);
        c.fillRect(X + 13, floor - 19, 3, 10);
        c.fillRect(X + W - 16, floor - 19, 3, 10);
        c.strokeStyle = "#e6ddc8";
        c.lineWidth = 4;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(X + 20, Y + 28);
        c.lineTo(X + 72, Y + 28);
        for (let k = 0; k < 5; k++) {
          const bx = X + 29 + k * 9;
          c.moveTo(bx, Y + 28);
          c.quadraticCurveTo(bx - 3, Y + 14, bx - 8, Y + 16);
          c.moveTo(bx, Y + 28);
          c.quadraticCurveTo(bx + 1, Y + 40, bx + 6, Y + 39);
        }
        c.stroke();
        c.fillStyle = "#f0e5cb";
        c.beginPath();
        c.ellipse(X + 16, Y + 25, 10, 8, -0.2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#3a302a";
        c.fillRect(X + 12, Y + 21, 3, 3);
        c.fillStyle = "#c8a16c";
        c.fillRect(X + 16, floor - 7, W - 32, 2);
        break;
      }
      case "mushroom": {
        // glowing mushrooms, growing toward the next harvest
        const g = 0.35 + b.grow * 0.65;
        for (let k = 0; k < 7; k++) {
          const mx = X + 8 + k * ((W - 16) / 6);
          const h = (8 + ((k * 7) % 5) * 2) * g;
          c.fillStyle = "#d9d2c0";
          c.fillRect(mx - 1, floor - 3 - h, 2, h);
          const cap = 4 + ((k * 3) % 3) * 1.5;
          const glow = c.createRadialGradient(mx, floor - 3 - h, 0, mx, floor - 3 - h, cap * 3);
          glow.addColorStop(0, `rgba(120,255,200,${0.35 * g})`);
          glow.addColorStop(1, "rgba(120,255,200,0)");
          c.fillStyle = glow;
          c.fillRect(mx - cap * 3, floor - 3 - h - cap * 3, cap * 6, cap * 6);
          c.fillStyle = k % 2 ? "#5ef0c0" : "#7fd6ff";
          c.beginPath();
          c.ellipse(mx, floor - 3 - h, cap * g + 1, (cap * g + 1) * 0.6, 0, Math.PI, 0);
          c.fill();
        }
        c.fillStyle = "#4a3828";
        c.fillRect(X + 3, floor - 4, W - 6, 3);
        break;
      }
      case "torch": {
        const r = 3.5 * CELL;
        c.save();
        c.globalCompositeOperation = "lighter";
        const glow = c.createRadialGradient(X + 16, Y + 9, 0, X + 16, Y + 9, r);
        glow.addColorStop(0, `rgba(255,170,65,${0.3 + Math.sin(t * 9) * 0.04})`);
        glow.addColorStop(1, "rgba(255,170,65,0)");
        c.fillStyle = glow;
        c.fillRect(X + 16 - r, Y + 9 - r, r * 2, r * 2);
        c.restore();
        c.fillStyle = "#8c6037";
        c.fillRect(X + 14, Y + 12, 4, 19);
        c.fillStyle = "#ffb54e";
        c.beginPath();
        c.ellipse(X + 16 + Math.sin(t * 8) * 1.5, Y + 8, 5, 8, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff2b4";
        c.fillRect(X + 15, Y + 4, 2, 6);
        break;
      }
      case "lamp": {
        const r = (LAMP_REACH + 0.5) * CELL;
        c.save();
        c.globalCompositeOperation = "lighter";
        const glow = c.createRadialGradient(X + 16, Y + 12, 0, X + 16, Y + 12, r);
        glow.addColorStop(0, `rgba(150,235,255,${0.32 + Math.sin(t * 2) * 0.04})`);
        glow.addColorStop(1, "rgba(150,235,255,0)");
        c.fillStyle = glow;
        c.fillRect(X + 16 - r, Y + 12 - r, r * 2, r * 2);
        c.restore();
        c.fillStyle = "#c8743f";
        c.fillRect(X + 15, Y + 14, 2, 16);
        c.fillRect(X + 10, floor - 3, 12, 3);
        c.fillStyle = "#8fe3ff";
        c.beginPath();
        c.moveTo(X + 16, Y + 3);
        c.lineTo(X + 21, Y + 11);
        c.lineTo(X + 16, Y + 16);
        c.lineTo(X + 11, Y + 11);
        c.closePath();
        c.fill();
        break;
      }
      case "mess": {
        // a table, two stools and a steaming pot
        c.fillStyle = "#7a5230";
        c.fillRect(X + 8, floor - 16, 30, 4);
        c.fillRect(X + 11, floor - 12, 3, 11);
        c.fillRect(X + 32, floor - 12, 3, 11);
        c.fillStyle = "#5a4330";
        c.fillRect(X + 2, floor - 9, 6, 8);
        c.fillRect(X + 40, floor - 9, 6, 8);
        c.fillStyle = "#3b3f46";
        c.beginPath();
        c.ellipse(X + W - 14, floor - 26, 8, 6, 0, 0, Math.PI);
        c.fill();
        c.fillStyle = "rgba(255,140,60,0.9)";
        c.fillRect(X + W - 18, floor - 18, 8, 4);
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.6 + k / 3) % 1;
          c.fillStyle = `rgba(230,230,230,${(1 - ph) * 0.45})`;
          c.beginPath();
          c.arc(X + W - 14 + Math.sin(ph * 6 + k) * 3, floor - 32 - ph * 18, 3 + ph * 4, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#e9dcc0";
        c.fillRect(X + 16, floor - 19, 6, 3);
        break;
      }
    }
  }

  private drawGhost(c: CanvasRenderingContext2D, g: NonNullable<DeepOverlay["ghost"]>) {
    const d = DEEP_DEFS[g.kind];
    const X = g.x * CELL;
    const Y = g.y * CELL;
    c.fillStyle = g.ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.22)";
    c.strokeStyle = g.ok ? "rgba(74,222,128,0.95)" : "rgba(248,113,113,0.95)";
    c.lineWidth = 2;
    c.fillRect(X, Y, d.w * CELL, d.h * CELL);
    c.strokeRect(X + 1, Y + 1, d.w * CELL - 2, d.h * CELL - 2);
    c.font = "18px serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(d.icon, X + (d.w * CELL) / 2, Y + (d.h * CELL) / 2);
  }

  /** The player's marks: dig (cyan), prop up (amber), blast (red), pump (blue). */
  private drawOrders(c: CanvasRenderingContext2D, mine: Mine, x0: number, x1: number, y0: number, y1: number) {
    if (!mine.orders.size) return;
    const COL: Record<string, string> = { dig: "95,227,255", support: "255,190,90", blast: "255,90,80", pump: "90,170,255" };
    const pulse = 0.55 + Math.sin(this.t * 4) * 0.2;
    c.save();
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    c.lineDashOffset = -this.t * 12;
    for (const [i, kind] of Array.from(mine.orders)) {
      const x = i % MINE_W;
      const y = (i - x) / MINE_W;
      if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
      const px = x * CELL;
      const py = y * CELL;
      const col = COL[kind];
      c.fillStyle = `rgba(${col},0.13)`;
      c.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      c.strokeStyle = `rgba(${col},${pulse})`;
      c.strokeRect(px + 2.5, py + 2.5, CELL - 5, CELL - 5);
      c.fillStyle = `rgba(${col},0.95)`;
      if (kind === "dig") {
        // a little pick
        c.fillRect(px + 15, py + 11, 2, 11);
        c.beginPath();
        c.moveTo(px + 9, py + 13);
        c.quadraticCurveTo(px + 16, py + 7, px + 23, py + 13);
        c.lineTo(px + 22, py + 14);
        c.quadraticCurveTo(px + 16, py + 10, px + 10, py + 14);
        c.fill();
      } else if (kind === "support") {
        c.fillRect(px + 10, py + 10, 3, 13);
        c.fillRect(px + 19, py + 10, 3, 13);
        c.fillRect(px + 8, py + 9, 16, 3);
      } else if (kind === "blast") {
        c.fillRect(px + 12, py + 12, 8, 11);
        c.fillRect(px + 15, py + 8, 2, 4);
      } else {
        c.beginPath();
        c.moveTo(px + 16, py + 9);
        c.quadraticCurveTo(px + 23, py + 19, px + 16, py + 23);
        c.quadraticCurveTo(px + 9, py + 19, px + 16, py + 9);
        c.fill();
      }
    }
    c.restore();
  }

  /** A miner: hard hat with a lamp, pick, sack when loaded. (x, y = cell coords, centre .5) */
  private drawMiner(c: CanvasRenderingContext2D, m: CrewLook) {
    const px = m.x * CELL;
    const feet = (m.y + 0.5) * CELL - 1;
    const f = m.face;
    const walking = m.mode === "walk" || m.mode === "flee";
    const step = walking ? Math.sin(m.anim * 12) : 0;
    // lamp light (a soft cone ahead + a glow)
    c.save();
    c.globalCompositeOperation = "lighter";
    const lx = px + f * 4;
    const ly = feet - 21;
    const cone = c.createRadialGradient(lx, ly, 2, lx + f * 40, ly + 6, 70);
    cone.addColorStop(0, "rgba(255,236,190,0.35)");
    cone.addColorStop(1, "rgba(255,236,190,0)");
    c.fillStyle = cone;
    c.beginPath();
    c.moveTo(lx, ly);
    c.lineTo(lx + f * 110, ly - 40);
    c.lineTo(lx + f * 110, ly + 50);
    c.closePath();
    c.fill();
    const glow = c.createRadialGradient(px, feet - 12, 0, px, feet - 12, 34);
    glow.addColorStop(0, "rgba(255,230,180,0.25)");
    glow.addColorStop(1, "rgba(255,230,180,0)");
    c.fillStyle = glow;
    c.fillRect(px - 34, feet - 46, 68, 68);
    c.restore();
    // legs
    c.strokeStyle = "#3a2a1c";
    c.lineWidth = 2.6;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(px - 2, feet - 8);
    c.lineTo(px - 2 - step * 3, feet);
    c.moveTo(px + 2, feet - 8);
    c.lineTo(px + 2 + step * 3, feet);
    c.stroke();
    // sack on the back
    if (m.load > 0) {
      c.fillStyle = "#a07a4a";
      c.beginPath();
      c.ellipse(px - f * 6, feet - 13, 5 + Math.min(3, m.load * 0.5), 6, 0, 0, Math.PI * 2);
      c.fill();
    }
    // body
    c.fillStyle = m.fur;
    c.beginPath();
    c.roundRect(px - 4.5, feet - 17, 9, 10, 3);
    c.fill();
    // head
    c.fillStyle = m.skin;
    c.beginPath();
    c.arc(px, feet - 21, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = m.hair;
    c.fillRect(px - 4 - (f > 0 ? 0 : -5), feet - 22, 3, 4);
    // hard hat + lamp
    c.fillStyle = "#f2b33d";
    c.beginPath();
    c.ellipse(px, feet - 24, 5.5, 3.2, 0, Math.PI, 0);
    c.fill();
    c.fillRect(px - 6, feet - 24.5, 12, 1.6);
    c.fillStyle = "#fffbe0";
    c.beginPath();
    c.arc(px + f * 4.5, feet - 25, 1.6, 0, Math.PI * 2);
    c.fill();
    // tool by job
    c.save();
    c.translate(px + f * 4, feet - 14);
    if (m.mode === "dig") {
      c.rotate(f * (-0.6 + Math.sin(m.anim * 11) * 0.9));
      c.strokeStyle = "#8a6238";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(f * 10, -6);
      c.stroke();
      c.strokeStyle = "#b9c2cc";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(f * 7, -11);
      c.quadraticCurveTo(f * 12, -6, f * 11, 0);
      c.stroke();
    } else if (m.mode === "pump") {
      c.fillStyle = "#6b7a8a";
      c.fillRect(f * 2, -2 + Math.sin(m.anim * 8) * 2, 5, 6);
    } else if (m.mode === "build" || m.mode === "plant") {
      c.rotate(Math.sin(m.anim * 9) * 0.5);
      c.fillStyle = m.mode === "plant" ? "#d8452e" : "#8a6238";
      c.fillRect(0, -2, f * 8, 3);
    }
    c.restore();
    // health pip when hurt
    if (m.hp < 0.7) {
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(px - 8, feet - 34, 16, 3);
      c.fillStyle = m.hp < 0.35 ? "#f87171" : "#facc15";
      c.fillRect(px - 8, feet - 34, 16 * m.hp, 3);
    }
    // progress on the job
    if (m.jobCell !== null && m.progress > 0 && m.progress < 1) {
      const jx = (m.jobCell % MINE_W) * CELL;
      const jy = Math.floor(m.jobCell / MINE_W) * CELL;
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.fillRect(jx + 4, jy + CELL - 7, CELL - 8, 4);
      c.fillStyle = "#5fe3ff";
      c.fillRect(jx + 4, jy + CELL - 7, (CELL - 8) * m.progress, 4);
      if (Math.random() < 0.3) {
        c.fillStyle = "rgba(220,210,190,0.7)";
        c.fillRect(jx + 8 + Math.random() * 16, jy + 6 + Math.random() * 16, 2, 2);
      }
    }
    if (m.bubble) {
      c.font = "bold 9px ui-sans-serif, system-ui";
      const tw = c.measureText(m.bubble).width + 8;
      c.fillStyle = "rgba(10,20,30,0.85)";
      c.beginPath();
      c.roundRect(px - tw / 2, feet - 46, tw, 13, 5);
      c.fill();
      c.fillStyle = "#dff8ff";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(m.bubble, px, feet - 39.5);
    }
  }

  /** A pale, blind cave lizard with glowing eyes. */
  private drawTroglodon(c: CanvasRenderingContext2D, t: { x: number; y: number; face: 1 | -1; hit: number; anim: number; path: number[]; pi: number }) {
    const px = t.x * CELL;
    const feet = (t.y + 0.5) * CELL - 2;
    const f = t.face;
    const moving = t.path.length > 0 && t.pi < t.path.length;
    const wig = moving ? Math.sin(t.anim * 14) : Math.sin(t.anim * 2) * 0.3;
    c.save();
    c.translate(px, feet);
    c.scale(f, 1);
    if (t.hit > 0) c.filter = "brightness(2)";
    // tail
    c.strokeStyle = "#cfc7d8";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-6, -5);
    c.quadraticCurveTo(-14, -6 + wig * 3, -20, -2 - wig * 2);
    c.stroke();
    // body
    c.fillStyle = "#e3dcea";
    c.beginPath();
    c.ellipse(0, -6, 10, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(200,150,190,0.6)";
    c.beginPath();
    c.ellipse(0, -4, 8, 2.5, 0, 0, Math.PI);
    c.fill();
    // legs
    c.strokeStyle = "#cfc7d8";
    c.lineWidth = 2;
    c.beginPath();
    for (const lx of [-6, 5]) {
      c.moveTo(lx, -4);
      c.lineTo(lx + wig * 3, 0);
    }
    c.stroke();
    // head + glowing eyes
    c.fillStyle = "#ece6f2";
    c.beginPath();
    c.ellipse(11, -7, 6, 4, 0.1, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.save();
    c.globalCompositeOperation = "lighter";
    const ex = px + f * 13;
    const g = c.createRadialGradient(ex, feet - 8, 0, ex, feet - 8, 9);
    g.addColorStop(0, "rgba(255,80,60,0.9)");
    g.addColorStop(1, "rgba(255,80,60,0)");
    c.fillStyle = g;
    c.fillRect(ex - 9, feet - 17, 18, 18);
    c.restore();
  }

  private drawCharges(c: CanvasRenderingContext2D, mine: Mine) {
    for (const ch of mine.charges) {
      const x = (ch.cell % MINE_W) * CELL;
      const y = Math.floor(ch.cell / MINE_W) * CELL;
      c.fillStyle = "#c0392b";
      c.fillRect(x + 11, y + 12, 4, 12);
      c.fillRect(x + 16, y + 12, 4, 12);
      c.strokeStyle = "#e9d8a6";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 15, y + 12);
      c.quadraticCurveTo(x + 20, y + 4, x + 24, y + 6);
      c.stroke();
      c.fillStyle = Math.sin(this.t * 30) > 0 ? "#fff5b0" : "#ff9a3c";
      c.beginPath();
      c.arc(x + 24, y + 6, 2.5, 0, Math.PI * 2);
      c.fill();
      c.font = "bold 12px ui-monospace, monospace";
      c.textAlign = "center";
      c.fillStyle = "#ffdf8a";
      c.fillText(String(Math.ceil(ch.t)), x + 16, y - 3);
    }
    for (const b of mine.blasts) {
      const x = (b.cell % MINE_W) * CELL + 16;
      const y = Math.floor(b.cell / MINE_W) * CELL + 16;
      const k = b.t;
      const g = c.createRadialGradient(x, y, 0, x, y, 30 + k * 90);
      g.addColorStop(0, `rgba(255,240,200,${(1 - k) * 0.95})`);
      g.addColorStop(0.5, `rgba(255,140,60,${(1 - k) * 0.6})`);
      g.addColorStop(1, "rgba(255,90,40,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, 30 + k * 90, 0, Math.PI * 2);
      c.fill();
    }
  }

  /** Loads riding up the shaft to the surface. */
  private drawCrates(c: CanvasRenderingContext2D, mine: Mine) {
    for (const cr of mine.crates) {
      const k = Math.min(1, cr.t / 2.2);
      const y = (cr.y * (1 - k) - SKY_ROWS * k * 0.6) * CELL + 8;
      const x = LIFT_X * CELL + 8;
      c.fillStyle = "#9a6b3c";
      c.fillRect(x, y, 16, 12);
      c.strokeStyle = "#5d3d1f";
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, 15, 11);
      c.fillStyle = "#f6cf4a";
      c.fillRect(x + 4, y - 2, 3, 3);
      c.fillStyle = "#e07b3c";
      c.fillRect(x + 9, y - 2, 3, 3);
    }
  }

  private drawPings(c: CanvasRenderingContext2D, pings: DeepOverlay["pings"]) {
    for (const p of pings) {
      const k = Math.min(1, p.t / 1.4);
      const r = (2 + k * 5.5) * CELL;
      c.strokeStyle = `rgba(90,230,255,${(1 - k) * 0.8})`;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(p.x * CELL + 16, p.y * CELL + 16, r, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = `rgba(90,230,255,${(1 - k) * 0.3})`;
      c.lineWidth = 10;
      c.stroke();
    }
  }

  private drawCursor(c: CanvasRenderingContext2D, mine: Mine, ov: DeepOverlay) {
    const box = (i: number, color: string, pulse: boolean) => {
      const x = (i % MINE_W) * CELL;
      const y = Math.floor(i / MINE_W) * CELL;
      const g = pulse ? 2 + Math.sin(this.t * 5) * 1.5 : 0;
      c.strokeStyle = color;
      c.lineWidth = 2;
      const L = 9;
      c.beginPath();
      for (const [cx, cy, sx, sy] of [[x - g, y - g, 1, 1], [x + CELL + g, y - g, -1, 1], [x - g, y + CELL + g, 1, -1], [x + CELL + g, y + CELL + g, -1, -1]] as [number, number, number, number][]) {
        c.moveTo(cx, cy + sy * L);
        c.lineTo(cx, cy);
        c.lineTo(cx + sx * L, cy);
      }
      c.stroke();
    };
    if (ov.hover !== null && ov.hover !== ov.sel) box(ov.hover, "rgba(255,255,255,0.45)", false);
    if (ov.sel !== null) {
      box(ov.sel, "#5fe3ff", true);
      const x = (ov.sel % MINE_W) * CELL;
      const y = Math.floor(ov.sel / MINE_W) * CELL;
      c.fillStyle = "rgba(95,227,255,0.12)";
      c.fillRect(x, y, CELL, CELL);
    }
    void mine;
  }
}
