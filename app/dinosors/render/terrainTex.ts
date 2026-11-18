/* ------------------------------------------------------------------ */
/*  Ground textures. Small pre-painted "stamps" (grass tufts, leaf     */
/*  litter, pebbles, sand ripples, snow dimples…) that the terrain     */
/*  baker scatters over each chunk, plus a fine grain sheet laid over  */
/*  everything. Painted once, at twice the world resolution, so the    */
/*  ground stays crisp when the camera is close.                       */
/* ------------------------------------------------------------------ */

import type { SeasonId } from "../sim/seasons";

type Canvas = HTMLCanvasElement;
type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

/** stamp size in world px (painted at STAMP_RES× that) */
export const STAMP = 48;
const STAMP_RES = 2;

function rng(seed: number): Rand {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function set(n: number, seed: number, paint: (c: Ctx, r: Rand, i: number) => void): Canvas[] {
  const out: Canvas[] = [];
  for (let i = 0; i < n; i++) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = STAMP * STAMP_RES;
    const c = cv.getContext("2d")!;
    c.scale(STAMP_RES, STAMP_RES);
    c.lineCap = "round";
    c.lineJoin = "round";
    paint(c, rng(seed * 977 + i * 131 + 7), i);
    out.push(cv);
  }
  return out;
}

const pick = <T,>(r: Rand, a: readonly T[]) => a[Math.floor(r() * a.length)];
/** a point near the middle of the stamp (so nothing is cut off at its edge) */
const near = (r: Rand, spread = 15): [number, number] => {
  const a = r() * Math.PI * 2;
  const d = Math.sqrt(r()) * spread;
  return [STAMP / 2 + Math.cos(a) * d, STAMP / 2 + Math.sin(a) * d * 0.8];
};

function blades(c: Ctx, r: Rand, n: number, cols: readonly string[], hMin: number, hMax: number, spread = 15) {
  for (let i = 0; i < n; i++) {
    const [x, y] = near(r, spread);
    const h = hMin + r() * (hMax - hMin);
    const lean = (r() - 0.5) * h * 0.9;
    c.strokeStyle = pick(r, cols);
    c.globalAlpha = 0.5 + r() * 0.4;
    c.lineWidth = 0.8 + r() * 0.7;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, x + lean, y - h);
    c.stroke();
  }
  c.globalAlpha = 1;
}

function speckle(c: Ctx, r: Rand, n: number, cols: readonly string[], aMin: number, aMax: number, size = 1) {
  for (let i = 0; i < n; i++) {
    const [x, y] = near(r, 20);
    c.fillStyle = pick(r, cols);
    c.globalAlpha = aMin + r() * (aMax - aMin);
    const s = (0.5 + r() * 0.8) * size;
    c.fillRect(x, y, s, s);
  }
  c.globalAlpha = 1;
}

/** a small stone: a lit top, a shaded underside and a contact shadow */
function pebble(c: Ctx, x: number, y: number, rw: number, rh: number, rot: number, base: string, lit: string, dark: string) {
  c.fillStyle = "rgba(20,24,20,0.28)";
  c.beginPath();
  c.ellipse(x + rw * 0.25, y + rh * 0.55, rw * 1.05, rh * 0.6, rot, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = dark;
  c.beginPath();
  c.ellipse(x, y, rw, rh, rot, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = base;
  c.beginPath();
  c.ellipse(x - rw * 0.06, y - rh * 0.14, rw * 0.92, rh * 0.8, rot, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = lit;
  c.beginPath();
  c.ellipse(x - rw * 0.25, y - rh * 0.38, rw * 0.45, rh * 0.3, rot, 0, Math.PI * 2);
  c.fill();
}

function cracks(c: Ctx, r: Rand, n: number, dark: string, lit: string) {
  for (let i = 0; i < n; i++) {
    let [x, y] = near(r, 14);
    const pts: [number, number][] = [[x, y]];
    let a = r() * Math.PI * 2;
    for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
      a += (r() - 0.5) * 1.3;
      x += Math.cos(a) * (3 + r() * 4);
      y += Math.sin(a) * (3 + r() * 4);
      pts.push([x, y]);
    }
    for (const [col, off, lw] of [[lit, 0.8, 0.8], [dark, 0, 0.9]] as const) {
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.beginPath();
      pts.forEach(([px, py], j) => (j ? c.lineTo(px + off, py + off) : c.moveTo(px + off, py + off)));
      c.stroke();
    }
  }
}

function leafShape(c: Ctx, x: number, y: number, len: number, wid: number, rot: number, fill: string, rib: string) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(len * 0.5, -wid, len, 0);
  c.quadraticCurveTo(len * 0.5, wid, 0, 0);
  c.fill();
  c.strokeStyle = rib;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(len * 0.08, 0);
  c.lineTo(len * 0.9, 0);
  c.stroke();
  c.restore();
}

const GRASS = ["#3f7d2b", "#4f9233", "#62a83d", "#7dbd4c", "#98cf5e"] as const;
const DRY = ["#b9b060", "#cdbf6c", "#a39a4e", "#8fa04a"] as const;

export interface TerrainStamps {
  grass: Canvas[];
  tallGrass: Canvas[];
  clover: Canvas[];
  flowers: Canvas[];
  dryGrass: Canvas[];
  litter: Canvas[];
  moss: Canvas[];
  jungle: Canvas[];
  swamp: Canvas[];
  sand: Canvas[];
  beach: Canvas[];
  rock: Canvas[];
  crag: Canvas[];
  pebbles: Canvas[];
  dirt: Canvas[];
  snow: Canvas[];
  mud: Canvas[];
  basalt: Canvas[];
  straw: Canvas[];
}

let stamps: TerrainStamps | null = null;
const seasonalStamps = new Map<SeasonId, TerrainStamps>();

/** Tint each small vegetation image once; avoid expensive filters on every terrain stamp. */
export function seasonTerrainStamps(season: SeasonId): TerrainStamps {
  const original = terrainStamps();
  if (season === "spring") return original;
  const cached = seasonalStamps.get(season);
  if (cached) return cached;
  const result = { ...original };
  const tone = season === "winter" ? "#e3ebe6" : season === "autumn" ? "#b58a4e" : "#c1b96d";
  const opacity = season === "winter" ? 0.85 : season === "autumn" ? 0.65 : 0.18;
  for (const key of ["grass", "tallGrass", "clover", "dryGrass", "litter", "moss", "jungle", "swamp", "straw"] as const) {
    result[key] = original[key].map((source) => {
      const cv = document.createElement("canvas"); cv.width = source.width; cv.height = source.height;
      const c = cv.getContext("2d")!; c.drawImage(source, 0, 0);
      c.globalCompositeOperation = "source-atop"; c.globalAlpha = opacity; c.fillStyle = tone; c.fillRect(0, 0, cv.width, cv.height);
      return cv;
    });
  }
  seasonalStamps.set(season, result);
  return result;
}

export function terrainStamps(): TerrainStamps {
  if (stamps) return stamps;
  stamps = {
    grass: set(8, 1, (c, r) => blades(c, r, 16 + Math.floor(r() * 12), GRASS, 3, 7)),
    tallGrass: set(5, 2, (c, r) => {
      blades(c, r, 14, GRASS, 6, 12, 9);
      // a few seed heads catching the light
      for (let i = 0; i < 3; i++) {
        const [x, y] = near(r, 8);
        c.fillStyle = "rgba(226,214,140,0.8)";
        c.beginPath();
        c.ellipse(x, y - 9 - r() * 3, 0.9, 2, (r() - 0.5) * 0.6, 0, Math.PI * 2);
        c.fill();
      }
    }),
    clover: set(5, 3, (c, r) => {
      for (let i = 0; i < 9; i++) {
        const [x, y] = near(r, 13);
        c.fillStyle = pick(r, ["rgba(52,112,44,0.3)", "rgba(74,140,52,0.28)", "rgba(40,96,40,0.26)"]);
        c.beginPath();
        c.ellipse(x, y, 2.5 + r() * 4, 1.6 + r() * 2.4, r() * 3, 0, Math.PI * 2);
        c.fill();
      }
      for (let i = 0; i < 6; i++) {
        const [x, y] = near(r, 12);
        c.fillStyle = "rgba(150,205,96,0.45)";
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          c.arc(x + Math.cos(k * 2.09) * 1.1, y + Math.sin(k * 2.09) * 1.1, 0.9, 0, Math.PI * 2);
          c.fill();
        }
      }
    }),
    flowers: set(6, 4, (c, r, i) => {
      blades(c, r, 8, GRASS, 3, 6, 10);
      const col = ["#fff4c9", "#ffd84a", "#ff9ec4", "#c9a6ff", "#ffffff", "#ff8a5c"][i % 6];
      for (let k = 0; k < 4 + Math.floor(r() * 4); k++) {
        const [x, y] = near(r, 11);
        c.strokeStyle = "rgba(70,130,50,0.8)";
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (r() - 0.5), y - 3.5);
        c.stroke();
        c.fillStyle = col;
        for (let p = 0; p < 5; p++) {
          c.beginPath();
          c.arc(x + Math.cos(p * 1.257) * 1.15, y - 4 + Math.sin(p * 1.257) * 1.15, 0.85, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#e9a520";
        c.beginPath();
        c.arc(x, y - 4, 0.6, 0, Math.PI * 2);
        c.fill();
      }
    }),
    dryGrass: set(4, 5, (c, r) => blades(c, r, 12, DRY, 3, 8, 11)),
    litter: set(7, 6, (c, r) => {
      for (let i = 0; i < 16; i++) {
        const [x, y] = near(r, 17);
        c.globalAlpha = 0.35 + r() * 0.3;
        leafShape(c, x, y, 2.5 + r() * 2.5, 0.9 + r() * 0.8, r() * 6.3, pick(r, ["#6b4a2a", "#8a5a2c", "#a36a2e", "#4d3a22", "#7d6a34", "#3d5a2c"]), "rgba(40,26,14,0.5)");
      }
      c.globalAlpha = 1;
      for (let i = 0; i < 2; i++) {
        const [x, y] = near(r, 13);
        const a = r() * 6.3;
        c.strokeStyle = "rgba(74,52,32,0.7)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 4);
        c.stroke();
      }
    }),
    moss: set(5, 7, (c, r) => {
      for (let i = 0; i < 7; i++) {
        const [x, y] = near(r, 14);
        c.fillStyle = pick(r, ["rgba(34,70,36,0.3)", "rgba(52,96,44,0.28)", "rgba(28,58,34,0.3)"]);
        c.beginPath();
        c.ellipse(x, y, 3 + r() * 6, 2 + r() * 3.5, r() * 3, 0, Math.PI * 2);
        c.fill();
      }
      // a small ground fern
      const [fx, fy] = near(r, 8);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.5;
        c.strokeStyle = pick(r, ["rgba(46,108,52,0.85)", "rgba(66,132,60,0.85)"]);
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(fx, fy);
        c.quadraticCurveTo(fx + Math.cos(a) * 4, fy + Math.sin(a) * 6, fx + Math.cos(a) * 8, fy + Math.sin(a) * 3.5);
        c.stroke();
      }
    }),
    jungle: set(7, 8, (c, r) => {
      for (let i = 0; i < 5; i++) {
        const [x, y] = near(r, 14);
        c.fillStyle = "rgba(20,56,26,0.26)";
        c.beginPath();
        c.ellipse(x, y, 4 + r() * 6, 2.5 + r() * 3, r() * 3, 0, Math.PI * 2);
        c.fill();
      }
      for (let i = 0; i < 4 + Math.floor(r() * 3); i++) {
        const [x, y] = near(r, 13);
        c.globalAlpha = 0.6 + r() * 0.3;
        leafShape(c, x, y, 6 + r() * 6, 2 + r() * 2, r() * 6.3, pick(r, ["#2c7534", "#3b8f3f", "#236329", "#4aa348"]), "rgba(18,58,24,0.6)");
      }
      c.globalAlpha = 1;
    }),
    swamp: set(6, 9, (c, r) => {
      for (let i = 0; i < 7; i++) {
        const [x, y] = near(r, 15);
        c.fillStyle = pick(r, ["rgba(146,174,62,0.3)", "rgba(70,96,74,0.32)", "rgba(110,138,60,0.28)"]);
        c.beginPath();
        c.ellipse(x, y, 3 + r() * 6, 1.8 + r() * 3, r() * 3, 0, Math.PI * 2);
        c.fill();
      }
      // standing water catching the sky
      const [x, y] = near(r, 9);
      c.fillStyle = "rgba(96,132,128,0.42)";
      c.beginPath();
      c.ellipse(x, y, 5 + r() * 4, 2.2 + r() * 1.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(220,240,235,0.4)";
      c.fillRect(x - 2, y - 0.8, 3, 0.8);
      blades(c, r, 7, ["#6b7a3a", "#839246", "#55682f"], 4, 9, 12);
    }),
    sand: set(7, 10, (c, r) => {
      speckle(c, r, 46, ["#b99458", "#fff4d2", "#d9b878", "#a8834c"], 0.25, 0.6);
      for (let i = 0; i < 2; i++) {
        const [x, y] = near(r, 10);
        const w = 9 + r() * 9;
        c.strokeStyle = "rgba(255,244,214,0.5)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x - w, y);
        c.quadraticCurveTo(x, y - 2.5, x + w, y + (r() - 0.5) * 2);
        c.stroke();
        c.strokeStyle = "rgba(140,104,56,0.22)";
        c.beginPath();
        c.moveTo(x - w, y + 1.3);
        c.quadraticCurveTo(x, y - 1.2, x + w, y + 1.3 + (r() - 0.5) * 2);
        c.stroke();
      }
    }),
    beach: set(6, 11, (c, r, i) => {
      const [x, y] = near(r, 8);
      if (i % 3 === 0) {
        // a shell
        c.fillStyle = "rgba(60,44,30,0.25)";
        c.beginPath();
        c.ellipse(x + 0.6, y + 1, 3.2, 1.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#f7ead9";
        c.beginPath();
        c.arc(x, y, 3, Math.PI, 0);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(190,150,120,0.8)";
        c.lineWidth = 0.5;
        for (let k = -2; k <= 2; k++) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + k * 1.2, y - 2.7);
          c.stroke();
        }
      } else if (i % 3 === 1) {
        // driftwood
        const a = r() * Math.PI;
        c.strokeStyle = "rgba(60,44,30,0.25)";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x - Math.cos(a) * 7 + 0.8, y - Math.sin(a) * 3 + 1.2);
        c.lineTo(x + Math.cos(a) * 7 + 0.8, y + Math.sin(a) * 3 + 1.2);
        c.stroke();
        c.strokeStyle = "#b9a384";
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 3);
        c.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 3);
        c.stroke();
        c.strokeStyle = "rgba(240,228,204,0.7)";
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 3 - 0.6);
        c.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 3 - 0.6);
        c.stroke();
      } else {
        for (let k = 0; k < 3; k++) {
          const [px, py] = near(r, 7);
          pebble(c, px, py, 1.6 + r() * 1.6, 1.1 + r(), r(), "#b7ad9c", "#e4dccd", "#857c6e");
        }
      }
    }),
    rock: set(7, 12, (c, r) => {
      speckle(c, r, 34, ["#5d564d", "#d9d2c4", "#7d756a", "#f0ebe0"], 0.2, 0.5, 1.2);
      cracks(c, r, 2 + Math.floor(r() * 2), "rgba(46,40,36,0.4)", "rgba(255,255,255,0.2)");
      if (r() > 0.45) {
        const [x, y] = near(r, 10);
        c.fillStyle = pick(r, ["rgba(150,166,92,0.3)", "rgba(196,170,96,0.26)", "rgba(120,150,110,0.28)"]);
        c.beginPath();
        c.ellipse(x, y, 3 + r() * 4, 2 + r() * 3, r() * 3, 0, Math.PI * 2);
        c.fill();
      }
    }),
    crag: set(6, 13, (c, r) => {
      // a faceted outcrop: a sunlit face, a shaded face, a cast shadow
      const [x, y] = near(r, 6);
      const w = 7 + r() * 7;
      const h = 6 + r() * 7;
      const px = x + (r() - 0.5) * w * 0.5;
      c.fillStyle = "rgba(24,22,30,0.26)";
      c.beginPath();
      c.ellipse(x + w * 0.35, y + 1.5, w * 1.15, h * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#6c645c";
      c.beginPath();
      c.moveTo(px, y - h);
      c.lineTo(x + w, y);
      c.lineTo(x + w * 0.1, y + 1.5);
      c.closePath();
      c.fill();
      c.fillStyle = "#b3aa9c";
      c.beginPath();
      c.moveTo(px, y - h);
      c.lineTo(x - w, y);
      c.lineTo(x + w * 0.1, y + 1.5);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(255,252,244,0.55)";
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x - w, y);
      c.lineTo(px, y - h);
      c.stroke();
    }),
    pebbles: set(6, 14, (c, r) => {
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
        const [px, py] = near(r, 9);
        pebble(c, px, py, 1.8 + r() * 2.6, 1.2 + r() * 1.5, r() * 0.8, "#9b948a", "#d6d0c4", "#6a635a");
      }
    }),
    dirt: set(6, 15, (c, r) => {
      speckle(c, r, 44, ["#7d5a34", "#d6b384", "#96703f", "#5f4426"], 0.2, 0.46, 1.2);
      if (r() > 0.7) cracks(c, r, 1, "rgba(84,56,30,0.2)", "rgba(255,236,200,0.1)");
      if (r() > 0.5) {
        const [px, py] = near(r, 10);
        pebble(c, px, py, 1.4 + r() * 1.4, 1 + r() * 0.8, r(), "#a08f78", "#d3c6b0", "#6e604e");
      }
    }),
    snow: set(6, 16, (c, r) => {
      for (let i = 0; i < 3; i++) {
        const [x, y] = near(r, 12);
        const w = 5 + r() * 8;
        c.fillStyle = "rgba(146,176,220,0.24)";
        c.beginPath();
        c.ellipse(x + 1.2, y + 1.6, w, 2.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.75)";
        c.beginPath();
        c.ellipse(x, y, w, 2.4, 0, Math.PI, 0);
        c.fill();
      }
      speckle(c, r, 10, ["#ffffff"], 0.7, 1, 1);
    }),
    mud: set(5, 17, (c, r) => {
      for (let i = 0; i < 4; i++) {
        const [x, y] = near(r, 12);
        const w = 3 + r() * 5;
        c.fillStyle = "rgba(64,44,26,0.36)";
        c.beginPath();
        c.ellipse(x, y, w, w * 0.5, r() * 0.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(230,214,190,0.32)";
        c.beginPath();
        c.ellipse(x - w * 0.3, y - w * 0.15, w * 0.3, w * 0.1, 0, 0, Math.PI * 2);
        c.fill();
      }
    }),
    basalt: set(6, 18, (c, r) => {
      speckle(c, r, 26, ["#1c1818", "#8a8280", "#2c2626"], 0.25, 0.5, 1.2);
      cracks(c, r, 2, "rgba(16,12,12,0.5)", "rgba(255,150,70,0.12)");
    }),
    straw: set(4, 19, (c, r) => {
      for (let i = 0; i < 14; i++) {
        const [x, y] = near(r, 13);
        const a = r() * Math.PI;
        c.strokeStyle = pick(r, ["rgba(150,112,58,0.6)", "rgba(226,196,128,0.6)", "rgba(110,80,40,0.5)"]);
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 2);
        c.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 2);
        c.stroke();
      }
    }),
  };
  return stamps;
}

let grain: Canvas | null = null;
/** A tileable sheet of fine light/dark grain, laid over the ground with soft-light. */
export function grainSheet(): Canvas {
  if (grain) return grain;
  const S = 256;
  grain = document.createElement("canvas");
  grain.width = grain.height = S;
  const c = grain.getContext("2d")!;
  const img = c.createImageData(S, S);
  const r = rng(4242);
  // two octaves: per-pixel grit + soft 4px mottling (both wrap, since they're pure hashes of the pixel)
  const coarse = new Float32Array((S / 4) * (S / 4));
  for (let i = 0; i < coarse.length; i++) coarse[i] = r();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = x / 4;
      const cy = y / 4;
      const x0 = Math.floor(cx) % (S / 4);
      const y0 = Math.floor(cy) % (S / 4);
      const x1 = (x0 + 1) % (S / 4);
      const y1 = (y0 + 1) % (S / 4);
      const ax = cx - Math.floor(cx);
      const ay = cy - Math.floor(cy);
      const m = coarse[y0 * (S / 4) + x0] * (1 - ax) * (1 - ay) + coarse[y0 * (S / 4) + x1] * ax * (1 - ay) + coarse[y1 * (S / 4) + x0] * (1 - ax) * ay + coarse[y1 * (S / 4) + x1] * ax * ay;
      const v = 0.5 + (r() - 0.5) * 0.55 + (m - 0.5) * 0.5;
      const o = (y * S + x) * 4;
      const g = Math.max(0, Math.min(255, Math.round(v * 255)));
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return grain;
}

let caustic: Canvas | null = null;
/** A tileable web of light for moving water (two layers of it slide over each other). */
export function causticSheet(): Canvas {
  if (caustic) return caustic;
  const S = 256;
  caustic = document.createElement("canvas");
  caustic.width = caustic.height = S;
  const c = caustic.getContext("2d")!;
  const img = c.createImageData(S, S);
  // cellular ridges: bright where the two nearest feature points are equally far (wrapped so it tiles)
  const N = 7;
  const r = rng(977);
  const pts: [number, number][] = [];
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) pts.push([(gx + r()) / N, (gy + r()) / N]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fx = x / S;
      const fy = y / S;
      const gx = Math.floor(fx * N);
      const gy = Math.floor(fy * N);
      let d1 = 9;
      let d2 = 9;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = (gx + ox + N) % N;
          const cy = (gy + oy + N) % N;
          const p = pts[cy * N + cx];
          let dx = Math.abs(p[0] - fx);
          let dy = Math.abs(p[1] - fy);
          if (dx > 0.5) dx = 1 - dx;
          if (dy > 0.5) dy = 1 - dy;
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      const ridge = Math.max(0, 1 - (d2 - d1) * N * 2.6);
      const a = ridge * ridge * ridge;
      const o = (y * S + x) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(a * 255);
    }
  }
  c.putImageData(img, 0, 0);
  return caustic;
}
