/* ------------------------------------------------------------------ */
/*  Render helpers: glow sprites, palettes, fonts, colour math          */
/* ------------------------------------------------------------------ */

import type { FxKind } from "../engine/types";

/** The game renders to a 1920×1080 virtual screen scaled to the real canvas. */
export const VH = 1080;
export const FLOOR_Y = VH * 0.865;

export const FX_COLORS: Record<FxKind, { core: string; glow: string }> = {
  punch: { core: "#fff7d6", glow: "#ffb020" },
  claw: { core: "#ffffff", glow: "#9fd8ff" },
  web: { core: "#ffffff", glow: "#dbe4ff" },
  energy: { core: "#e0fbff", glow: "#22d3ee" },
  lightning: { core: "#ffffff", glow: "#7dd3fc" },
  fire: { core: "#fff1c1", glow: "#f97316" },
  magic: { core: "#fff4d6", glow: "#f59e0b" },
  shield: { core: "#ffffff", glow: "#60a5fa" },
  hammer: { core: "#ffffff", glow: "#93c5fd" },
  repulsor: { core: "#ecfeff", glow: "#38bdf8" },
  missile: { core: "#fff7ed", glow: "#fb923c" },
  kinetic: { core: "#f5f3ff", glow: "#a78bfa" },
  magnet: { core: "#fdf2f8", glow: "#ec4899" },
  cosmic: { core: "#fef9c3", glow: "#a855f7" },
  symbiote: { core: "#f1f5f9", glow: "#64748b" },
  sword: { core: "#ffffff", glow: "#cbd5e1" },
  bullet: { core: "#fffbeb", glow: "#fbbf24" },
  ground: { core: "#fde68a", glow: "#b45309" },
  beam: { core: "#ecfeff", glow: "#22d3ee" },
};

/* ── Glow sprites: radial gradients baked once per colour ──────────── */
const glowCache = new Map<string, HTMLCanvasElement>();

export function glowSprite(color: string, size = 128): HTMLCanvasElement {
  const key = `${color}|${size}`;
  let c = glowCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, withAlpha(color, 1));
    grad.addColorStop(0.25, withAlpha(color, 0.55));
    grad.addColorStop(0.6, withAlpha(color, 0.14));
    grad.addColorStop(1, withAlpha(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowCache.set(key, c);
  }
  return c;
}

/** Draw an additive glow centred at (x, y) with radius r. */
export function glow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha = 1) {
  if (r <= 0 || alpha <= 0) return;
  const prevA = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = prevA * alpha;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

/* ── Colour math ───────────────────────────────────────────────────── */
const parseCache = new Map<string, [number, number, number]>();

/** Parse #rgb/#rrggbb/hsl(...) via a 1×1 canvas (cached). */
export function rgb(color: string): [number, number, number] {
  let v = parseCache.get(color);
  if (v) return v;
  if (color.startsWith("#")) {
    let h = color.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  } else if (typeof document !== "undefined") {
    const c = document.createElement("canvas").getContext("2d")!;
    c.fillStyle = color;
    const norm = c.fillStyle as string;
    v = norm.startsWith("#") ? rgb(norm) : (norm.match(/\d+/g)?.slice(0, 3).map(Number) as [number, number, number]) ?? [128, 128, 128];
  } else v = [128, 128, 128];
  parseCache.set(color, v);
  return v;
}

export function withAlpha(color: string, a: number) {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mix toward black (t<0) or white (t>0). */
export function shade(color: string, t: number) {
  const [r, g, b] = rgb(color);
  const f = (c: number) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/* ── Fonts (reuse the site's loaded families) ──────────────────────── */
let fonts: { display: string; body: string } | null = null;

export function gameFonts() {
  if (fonts) return fonts;
  if (typeof document === "undefined") return { display: "system-ui", body: "system-ui" };
  const root = getComputedStyle(document.documentElement);
  const aspekta = root.getPropertyValue("--font-aspekta").trim();
  const inter = root.getPropertyValue("--font-inter").trim();
  fonts = {
    display: aspekta ? `${aspekta}, "Arial Black", system-ui, sans-serif` : `"Arial Black", system-ui, sans-serif`,
    body: inter ? `${inter}, system-ui, sans-serif` : "system-ui, sans-serif",
  };
  return fonts;
}

/** Seeded 0..1 noise for stable procedural scenery. */
export function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(t, 0, 1) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
};
