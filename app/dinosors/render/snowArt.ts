/* ------------------------------------------------------------------ */
/*  The snowy peaks, up close (render only: nothing here is saved or   */
/*  touches the sim):                                                  */
/*  • footprints: anyone walking on snow leaves a trail of prints      */
/*    (paws, boots, the Snow Rex's great three-toed tracks) that fade; */
/*  • drifting snow: wind-blown spindrift streaming over the snowfields */
/*    (more in a storm, along the wind);                               */
/*  • cold light: a faint blue cast + snow glare while the view is up  */
/*    in the peaks.                                                    */
/*  Kept cheap: prints only for what's in view (a capped ring buffer), */
/*  streaks placed by a hash of time, no particles.                    */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { sizeOf } from "../sim/dinos";
import { REGION } from "../sim/terrain";
import { MAP_W, T, TILE } from "../sim/types";
import type { World } from "../sim/world";

interface Print {
  x: number;
  y: number;
  a: number;
  s: number;
  kind: 0 | 1 | 2;
  t: number;
}

const MAX_PRINTS = 420;
const PRINT_LIFE = 28;

const snowy = (w: World, x: number, y: number) => {
  const t = w.terrain.tileAt(x, y);
  return t === T.Snow || t === T.Ice || w.snow.at(x, y) > 0.45;
};

export class PeaksFx {
  private prints: Print[] = [];
  private head = 0;
  private last = new Map<number, { x: number; y: number; foot: number }>();

  /** How much of the view is up in the cold (0..1), from a few sample points. */
  coldness(w: World, x0: number, y0: number, x1: number, y1: number) {
    let n = 0;
    for (let i = 0; i < 9; i++) {
      const x = x0 + ((i % 3) + 0.5) * (x1 - x0) / 3;
      const y = y0 + (Math.floor(i / 3) + 0.5) * (y1 - y0) / 3;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= w.terrain.tiles.length / MAP_W) continue;
      const k = ty * MAP_W + tx;
      if (w.terrain.region[k] === REGION.peaks || snowy(w, x, y)) n++;
    }
    return n / 9;
  }

  private step(w: World, id: number, x: number, y: number, s: number, kind: 0 | 1 | 2, stride: number) {
    const l = this.last.get(id);
    if (!l) {
      this.last.set(id, { x, y, foot: 0 });
      return;
    }
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < stride) return;
    if (d > stride * 6) {
      l.x = x;
      l.y = y;
      return;
    }
    if (snowy(w, x, y)) {
      const a = Math.atan2(y - l.y, x - l.x);
      const side = l.foot ? 1 : -1;
      const p: Print = { x: x + Math.cos(a + Math.PI / 2) * s * 0.5 * side, y: y + Math.sin(a + Math.PI / 2) * s * 0.3 * side, a, s, kind, t: w.elapsed };
      if (this.prints.length < MAX_PRINTS) this.prints.push(p);
      else this.prints[(this.head = (this.head + 1) % MAX_PRINTS)] = p;
    }
    l.x = x;
    l.y = y;
    l.foot ^= 1;
  }

  /** Footprints + spindrift (world space, under everything that stands up). */
  draw(c: CanvasRenderingContext2D, w: World, x0: number, y0: number, x1: number, y1: number, t: number, z: number) {
    const cold = this.coldness(w, x0, y0, x1, y1);
    if (cold <= 0 && !this.prints.length) return;
    if (cold > 0 && z > 0.3) {
      // lay new prints for whatever's walking in view
      for (const h of w.humans) if (!h.under && !h.aloft && h.level === 0 && h.x > x0 && h.x < x1 && h.y > y0 && h.y < y1) this.step(w, h.id, h.x, h.y, 3.2, 0, 9);
      for (const b of w.rivals.brutes) if (!b.mount && b.z < 4 && b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1) this.step(w, b.id, b.x, b.y, 3.4, 0, 9);
      for (const d of w.dinos) {
        if (d.z > 4 || sp(d.species).move !== "walk" || d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
        const L = sizeOf(d);
        this.step(w, d.id, d.x, d.y, Math.max(2.5, L * 0.06), d.species === "snowRex" || sp(d.species).plan === "theropod" ? 2 : 1, Math.max(8, L * 0.16));
      }
      if (this.last.size > 600) this.last.clear();
    }
    // the prints, fading (and drifting over faster in falling snow)
    const life = PRINT_LIFE * (1 - Math.min(0.6, w.weather.snow * 0.6));
    c.save();
    for (const p of this.prints) {
      const age = w.elapsed - p.t;
      if (age > life || age < 0 || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const a = (1 - age / life) * 0.45;
      c.fillStyle = `rgba(95,125,165,${a})`;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.a);
      if (p.kind === 2) {
        // three great toes
        for (const k of [-1, 0, 1]) {
          c.beginPath();
          c.ellipse(p.s * 0.6, k * p.s * 0.45, p.s * 0.55, p.s * 0.16, k * 0.4, 0, Math.PI * 2);
          c.fill();
        }
      } else if (p.kind === 1) {
        c.beginPath();
        c.ellipse(0, 0, p.s * 0.7, p.s * 0.55, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.beginPath();
        c.ellipse(0, 0, p.s, p.s * 0.45, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    c.restore();
    if (cold <= 0) return;
    // spindrift: low streaks of blown snow running with the wind over the snowfields
    const wind = Math.max(-1.4, Math.min(1.4, (w.weather.windX || 3) / 6)) * (1 + w.weather.storm * 1.5 + w.weather.snow);
    const n = Math.round(26 * cold * (0.6 + w.weather.snow + w.weather.storm));
    c.save();
    c.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const seed = i * 97.13;
      const life2 = 2.4 + (i % 5) * 0.4;
      const ph = ((t / life2 + (seed % 1)) % 1);
      const gen = Math.floor(t / life2 + (seed % 1));
      const h1 = Math.abs(Math.sin(seed + gen * 12.9898) * 43758.5453) % 1;
      const h2 = Math.abs(Math.sin(seed * 1.7 + gen * 78.233) * 12345.678) % 1;
      const sx = x0 + h1 * (x1 - x0);
      const sy = y0 + h2 * (y1 - y0);
      if (!snowy(w, sx, sy)) continue;
      const len = 30 + (i % 4) * 14;
      const x = sx + ph * wind * 120;
      const y = sy + Math.sin(ph * 6 + i) * 3;
      const a = Math.sin(ph * Math.PI) * 0.5;
      c.strokeStyle = `rgba(255,255,255,${a})`;
      c.lineWidth = 1.4 + (i % 3) * 0.6;
      c.beginPath();
      c.moveTo(x - len * 0.5 * Math.sign(wind || 1), y);
      c.quadraticCurveTo(x, y - 3, x + len * 0.5 * Math.sign(wind || 1), y + 1);
      c.stroke();
    }
    c.restore();
  }

  /** Screen space, after the lighting: a cool cast + a little glare off the snow by day. */
  coldLight(c: CanvasRenderingContext2D, w: World, cold: number, width: number, height: number) {
    if (cold <= 0.05) return;
    c.fillStyle = `rgba(150,190,255,${0.05 * cold + w.weather.snow * 0.04 * cold})`;
    c.fillRect(0, 0, width, height);
    if (w.daylight > 0.6) {
      c.fillStyle = `rgba(245,250,255,${0.05 * cold * (w.daylight - 0.6) * 2.5})`;
      c.fillRect(0, 0, width, height);
    }
  }
}

/**
 * A Yeti's hanging tree (origin = its foot on the snow): a dead, frost-white tree, bare branches with
 * icicles, one long bough reaching out to the right with a frayed rope tied round it.
 */
export function drawHangTree(c: CanvasRenderingContext2D, t: number, inUse: boolean) {
  c.save();
  c.fillStyle = "rgba(60,80,110,0.22)";
  c.beginPath();
  c.ellipse(0, 1, 18, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.lineCap = "round";
  c.strokeStyle = "#4b4038";
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-3, -40, 2, -82);
  c.stroke();
  c.lineWidth = 4;
  c.beginPath();
  // the hanging bough + the bare branches
  c.moveTo(1, -70);
  c.quadraticCurveTo(10, -80, 26, -76);
  c.moveTo(0, -56);
  c.lineTo(-16, -70);
  c.moveTo(2, -82);
  c.lineTo(-6, -96);
  c.moveTo(2, -84);
  c.lineTo(12, -94);
  c.stroke();
  // frost along the top of every branch
  c.strokeStyle = "rgba(245,250,255,0.9)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(3, -72);
  c.quadraticCurveTo(11, -82, 26, -78);
  c.moveTo(-1, -58);
  c.lineTo(-16, -72);
  c.moveTo(2, -84);
  c.lineTo(-6, -98);
  c.stroke();
  c.fillStyle = "rgba(220,240,255,0.9)";
  for (const [x, y] of [[8, -75], [16, -77], [22, -77], [-9, -64]] as const) {
    c.beginPath();
    c.moveTo(x - 1.5, y);
    c.lineTo(x, y + 6 + Math.sin(t + x) * 0.5);
    c.lineTo(x + 1.5, y);
    c.closePath();
    c.fill();
  }
  // the rope knotted round the bough (hanging loose when nobody's on it)
  if (!inUse) {
    c.strokeStyle = "#a8875a";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(20, -77);
    c.quadraticCurveTo(21 + Math.sin(t * 1.3) * 2, -64, 20, -52);
    c.stroke();
  }
  c.restore();
}
