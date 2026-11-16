/* ------------------------------------------------------------------ */
/*  Shared pieces for drawing people in the storybook style of the     */
/*  cave-people artwork: a three-quarter face (two big bright eyes,    */
/*  heavy brows, a round nose, an expressive mouth), rounded shading   */
/*  for bodies and robes, and fists. The cave people are drawn in      */
/*  sprites.ts; every other folk (Neanderthals, Tree / Sea / Sand /    */
/*  Snow People, the Monks) keeps its own costume and poses and uses   */
/*  these so they all read as one cast.                                */
/* ------------------------------------------------------------------ */
import { Q } from "./quality";

type Ctx = CanvasRenderingContext2D;

export type Mood = "calm" | "happy" | "fierce" | "scared" | "asleep";

export interface FaceLook {
  /** half the width of the face (px): everything is sized from it */
  r: number;
  skin: string;
  /** brow colour (usually the hair) */
  brow: string;
  mood: Mood;
  /** whose face (so everyone blinks on their own beat) */
  id: number;
  t: number;
  /** a heavy brow ridge (Neanderthals) */
  ridge?: boolean;
  /** nose size (1 = normal); 0 = hidden (wrapped faces) */
  nose?: number;
  /** false = no mouth (wrapped / masked faces) */
  mouth?: boolean;
  /** iris colour (default near-black) */
  eye?: string;
  ink?: string;
}

const mixCache = new Map<string, string>();
/** Mix two #rrggbb colours. */
function mix(a: string, b: string, t: number) {
  if (a.charCodeAt(0) !== 35 || a.length !== 7) return a;
  const key = a + b + t;
  let out = mixCache.get(key);
  if (out) return out;
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  out = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  if (mixCache.size > 1000) mixCache.clear();
  mixCache.set(key, out);
  return out;
}

/**
 * The face, three-quarters on and looking toward +x, centred on (x, y). The caller has already drawn the
 * head, hair and any paint; this adds the features on top.
 */
export function storyFace(c: Ctx, x: number, y: number, o: FaceLook) {
  const r = o.r;
  const ink = o.ink ?? "rgba(43,28,18,0.85)";
  const ey = y - r * 0.1;
  const scared = o.mood === "scared";
  const fierce = o.mood === "fierce";
  const asleep = o.mood === "asleep";
  const blink = asleep || ((o.t * 0.9 + o.id * 0.37) % 3.7 < 0.11 && !scared);
  /** [centre x, half width, half height]: the far eye, then the near one */
  const eyes: [number, number, number][] = [
    [x + r * 0.16, r * 0.22, r * 0.3],
    [x + r * 0.62, r * 0.25, r * 0.33],
  ];
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  if (o.ridge) {
    // the shadow under a heavy brow
    c.fillStyle = "rgba(70,34,20,0.3)";
    c.beginPath();
    c.ellipse(x + r * 0.42, ey - r * 0.2, r * 0.62, r * 0.24, -0.05, 0, Math.PI * 2);
    c.fill();
  }
  if (blink) {
    c.strokeStyle = "#1d1813";
    c.lineWidth = Math.max(0.6, r * 0.13);
    c.beginPath();
    for (const [ex, rx] of eyes) {
      c.moveTo(ex - rx, ey + r * 0.03);
      c.quadraticCurveTo(ex, ey + r * 0.2, ex + rx, ey + r * 0.03);
    }
    c.stroke();
  } else {
    for (const [ex, rx, ry0] of eyes) {
      const ry = fierce ? ry0 * 0.78 : ry0;
      c.fillStyle = "#fffdf6";
      c.strokeStyle = ink;
      c.lineWidth = Math.max(0.4, r * 0.09);
      c.beginPath();
      c.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = o.eye ?? "#1d1813";
      c.beginPath();
      c.arc(ex + r * 0.07, ey + r * 0.04, r * (scared ? 0.09 : 0.15), 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(ex + r * 0.12, ey - r * 0.05, r * 0.05, 0, Math.PI * 2);
      c.fill();
    }
  }
  // brows: level when calm, slanting down to the nose in a fight, flying up in a fright
  c.strokeStyle = o.brow;
  c.lineWidth = r * (o.ridge ? 0.27 : 0.2);
  c.beginPath();
  if (fierce) {
    c.moveTo(x - r * 0.08, ey - r * 0.62);
    c.lineTo(x + r * 0.38, ey - r * 0.36);
    c.moveTo(x + r * 0.5, ey - r * 0.38);
    c.lineTo(x + r * 0.96, ey - r * 0.62);
  } else {
    const lift = scared ? r * 0.16 : 0;
    c.moveTo(x - r * 0.05, ey - r * 0.45 - lift);
    c.lineTo(x + r * 0.36, ey - r * 0.53 - lift * 1.4);
    c.moveTo(x + r * 0.5, ey - r * 0.56 - lift * 1.4);
    c.lineTo(x + r * 0.92, ey - r * 0.44 - lift);
  }
  c.stroke();
  const ns = o.nose ?? 1;
  if (ns > 0) {
    // the nose: big, round and a little ruddy
    c.fillStyle = mix(o.skin, "#e2733f", 0.32);
    c.strokeStyle = ink;
    c.lineWidth = Math.max(0.4, r * 0.1);
    c.beginPath();
    c.arc(x + r * 0.98, y + r * 0.2, r * 0.3 * ns, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,246,230,0.55)";
    c.beginPath();
    c.arc(x + r * 1.04, y + r * 0.11, r * 0.08 * ns, 0, Math.PI * 2);
    c.fill();
  }
  if (o.mouth !== false) {
    const mx = x + r * 0.58;
    const my = y + r * 0.6;
    if (scared) {
      c.fillStyle = "#4a1d1d";
      c.beginPath();
      c.ellipse(mx + r * 0.05, my + r * 0.12, r * 0.2, r * 0.27, 0, 0, Math.PI * 2);
      c.fill();
    } else if (asleep) {
      c.strokeStyle = "#4a1d1d";
      c.lineWidth = Math.max(0.5, r * 0.1);
      c.beginPath();
      c.moveTo(mx - r * 0.15, my + r * 0.1);
      c.lineTo(mx + r * 0.2, my + r * 0.1);
      c.stroke();
    } else if (fierce) {
      // teeth bared: a hard-cornered mouth full of teeth
      c.fillStyle = "#4a1512";
      c.strokeStyle = ink;
      c.lineWidth = Math.max(0.4, r * 0.09);
      c.beginPath();
      c.moveTo(mx - r * 0.38, my - r * 0.02);
      c.lineTo(mx + r * 0.42, my - r * 0.08);
      c.lineTo(mx + r * 0.36, my + r * 0.3);
      c.lineTo(mx - r * 0.3, my + r * 0.32);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = "#fffaf0";
      c.beginPath();
      c.moveTo(mx - r * 0.3, my + r * 0.02);
      c.lineTo(mx + r * 0.36, my - r * 0.03);
      c.lineTo(mx + r * 0.34, my + r * 0.12);
      c.lineTo(mx - r * 0.28, my + r * 0.15);
      c.closePath();
      c.fill();
    } else if (o.mood === "happy") {
      // a wide open grin, a row of white teeth along the top
      c.fillStyle = "#5a1c16";
      c.strokeStyle = ink;
      c.lineWidth = Math.max(0.4, r * 0.09);
      c.beginPath();
      c.moveTo(mx - r * 0.4, my - r * 0.02);
      c.quadraticCurveTo(mx, my + r * 0.58, mx + r * 0.42, my - r * 0.05);
      c.quadraticCurveTo(mx, my + r * 0.08, mx - r * 0.4, my - r * 0.02);
      c.fill();
      c.stroke();
      c.fillStyle = "#fffaf0";
      c.beginPath();
      c.moveTo(mx - r * 0.3, my + r * 0.03);
      c.quadraticCurveTo(mx, my + r * 0.13, mx + r * 0.33, my);
      c.quadraticCurveTo(mx + r * 0.2, my + r * 0.2, mx, my + r * 0.22);
      c.quadraticCurveTo(mx - r * 0.18, my + r * 0.2, mx - r * 0.3, my + r * 0.03);
      c.fill();
    } else {
      // an easy closed smile
      c.strokeStyle = "#4a1d1d";
      c.lineWidth = Math.max(0.5, r * 0.11);
      c.beginPath();
      c.moveTo(mx - r * 0.28, my + r * 0.02);
      c.quadraticCurveTo(mx + r * 0.02, my + r * 0.24, mx + r * 0.34, my - r * 0.02);
      c.stroke();
    }
  }
  c.restore();
}

/** Light on the front shoulder, shade down the back: laid over a round body part (an ellipse). */
export function shadeEllipse(c: Ctx, cx: number, cy: number, rx: number, ry: number) {
  if (!Q.shading) return;
  const g = c.createLinearGradient(cx + rx * 0.8, cy - ry, cx - rx * 0.8, cy + ry);
  g.addColorStop(0, "rgba(255,244,222,0.3)");
  g.addColorStop(0.45, "rgba(255,244,222,0)");
  g.addColorStop(1, "rgba(60,24,20,0.3)");
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

/**
 * The same light, laid over whatever path was just filled (a robe, a coat): call it straight after `fill()`,
 * with the box the shape sits in. Optionally inks the outline too.
 */
export function shadeCurrentPath(c: Ctx, x0: number, y0: number, x1: number, y1: number, ink?: string, lw = 0.9) {
  if (Q.shading) {
    const g = c.createLinearGradient(x1, y0, x0, y1);
    g.addColorStop(0, "rgba(255,246,226,0.3)");
    g.addColorStop(0.45, "rgba(255,246,226,0)");
    g.addColorStop(1, "rgba(50,26,30,0.28)");
    c.fillStyle = g;
    c.fill();
  }
  if (ink) {
    c.strokeStyle = ink;
    c.lineWidth = lw;
    c.lineJoin = "round";
    c.stroke();
  }
}

/** A round fist at the end of an arm. */
export function fist(c: Ctx, x: number, y: number, r: number, fill: string, ink: string) {
  c.fillStyle = fill;
  c.strokeStyle = ink;
  c.lineWidth = Math.max(0.6, r * 0.3);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

/** Scale what's drawn next about a pivot (a head growing up from the neck). Pair with save / restore. */
export function scaleAbout(c: Ctx, px: number, py: number, k: number) {
  c.translate(px, py);
  c.scale(k, k);
  c.translate(-px, -py);
}

/** A small rounded health bar over someone's head. */
export function healthBar(c: Ctx, y: number, hp: number) {
  c.fillStyle = "rgba(10,16,26,0.7)";
  c.beginPath();
  c.roundRect(-12, y, 24, 4.6, 2.3);
  c.fill();
  c.fillStyle = hp > 0.5 ? "#facc15" : "#ef4444";
  c.beginPath();
  c.roundRect(-11, y + 0.9, Math.max(2.8, 22 * Math.max(0, hp)), 2.8, 1.4);
  c.fill();
}
