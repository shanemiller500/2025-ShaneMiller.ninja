/* ------------------------------------------------------------------ */
/*  Portrait palette: read a fighter's real costume colours from their  */
/*  artwork. Portraits are head-and-shoulders, so the lower band shows  */
/*  the suit. Pixels are bucketed by hue (weighted by saturation), skin */
/*  tones and background-ish greys are skipped, and the strongest       */
/*  buckets become primary / secondary / accent.                        */
/* ------------------------------------------------------------------ */

import type { FighterDef } from "../engine/types";

interface Bucket {
  w: number;
  r: number;
  g: number;
  b: number;
  n: number;
}

const done = new Set<number>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** Normalise lightness so suits read well under the cel shader. */
function tame(r: number, g: number, b: number, lo: number, hi: number) {
  const [, , l] = rgbToHsl(r, g, b);
  const target = Math.min(hi, Math.max(lo, l));
  const k = l > 0 ? target / l : 1;
  return hex(r * k, g * k, b * k);
}

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
}

export function extractPalette(img: HTMLImageElement): Palette | null {
  if (!img.naturalWidth) return null;
  const W = 40;
  const H = 60;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  let data: Uint8ClampedArray;
  try {
    // Lower 40% (chest / shoulders), central 70% (avoid background edges)
    data = ctx.getImageData(Math.round(W * 0.15), Math.round(H * 0.58), Math.round(W * 0.7), Math.round(H * 0.4)).data;
  } catch {
    return null; // cross-origin image without CORS
  }
  const buckets: Bucket[] = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0, n: 0 }));
  let dark = 0;
  let total = 0;
  const darkAcc = { r: 0, g: 0, b: 0 };
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    total++;
    if (l < 0.16) {
      dark++;
      darkAcc.r += r;
      darkAcc.g += g;
      darkAcc.b += b;
      continue;
    }
    if (s < 0.22 || l > 0.9) continue; // greys / highlights / paper backgrounds
    const skin = h >= 12 && h <= 42 && s < 0.62 && l > 0.42 && l < 0.85;
    if (skin) continue;
    const k = Math.floor(h / 30) % 12;
    const w = s * (1 - Math.abs(l - 0.5));
    const bk = buckets[k];
    bk.w += w;
    bk.r += r * w;
    bk.g += g * w;
    bk.b += b * w;
    bk.n++;
  }
  const ranked = buckets
    .map((b, i) => ({ ...b, i }))
    .filter((b) => b.n >= 6)
    .sort((a, b) => b.w - a.w);
  const avg = (b: Bucket) => [b.r / b.w, b.g / b.w, b.b / b.w] as const;

  const darkSuit = dark / Math.max(1, total) > 0.42;
  if (!ranked.length) {
    if (!darkSuit) return null;
    return { primary: "#1c1c26", secondary: "#2a2a36", accent: "#64748b" };
  }
  const first = ranked[0];
  const second = ranked.find((b) => Math.min(Math.abs(b.i - first.i), 12 - Math.abs(b.i - first.i)) >= 2 && b.w > first.w * 0.18);
  const [r1, g1, b1] = avg(first);
  const main = tame(r1, g1, b1, 0.34, 0.56);
  if (darkSuit) {
    const n = dark || 1;
    const blk = tame(darkAcc.r / n, darkAcc.g / n, darkAcc.b / n, 0.1, 0.16);
    return { primary: blk, secondary: second ? tame(...avg(second), 0.2, 0.32) : "#20202a", accent: main };
  }
  if (second) {
    const [r2, g2, b2] = avg(second);
    return { primary: main, secondary: tame(r2, g2, b2, 0.2, 0.34), accent: tame(r2, g2, b2, 0.4, 0.6) };
  }
  return { primary: main, secondary: tame(r1 * 0.55, g1 * 0.55, b1 * 0.55, 0.16, 0.26), accent: tame(r1, g1, b1, 0.58, 0.7) };
}

/** Sample the face region only when it contains enough plausible uncovered skin. */
export function extractSkinTone(img: HTMLImageElement): string | null {
  if (!img.naturalWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 60;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 40, 60);
  let pixels: Uint8ClampedArray;
  try { pixels = ctx.getImageData(13, 9, 14, 20).data; } catch { return null; }
  const samples: [number, number, number][] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    if (h >= 9 && h <= 48 && s >= 0.13 && s <= 0.72 && l >= 0.18 && l <= 0.87 && r > g * 1.08 && g > b * 0.9) samples.push([r, g, b]);
  }
  if (samples.length < 38) return null;
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const mid = samples.slice(Math.floor(samples.length * 0.35), Math.ceil(samples.length * 0.65));
  const avg = mid.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0]);
  return hex(avg[0] / mid.length, avg[1] / mid.length, avg[2] / mid.length);
}

/**
 * Re-colour a generic fighter's costume from its portrait (once per
 * fighter). Signature fighters keep their hand-authored suits.
 */
export function applyPortraitPalette(def: FighterDef, img: HTMLImageElement | null) {
  if (!img || def.custom || done.has(def.id)) return;
  done.add(def.id);
  const pal = extractPalette(img);
  if (pal) {
    def.look.primary = pal.primary;
    def.look.secondary = pal.secondary;
    def.look.accent = pal.accent;
  }
  const skin = extractSkinTone(img);
  if (skin && !def.look.headgear) def.look.skin = skin;
}
