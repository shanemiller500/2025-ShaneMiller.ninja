/* ------------------------------------------------------------------ */
/*  Shared visual effects for the surface renderer:                    */
/*    · the sun / moon model (where shadows fall, how long, how warm)  */
/*    · tinted soft sprites (glows, smoke puffs) cached by colour      */
/*    · the particle painter (soft smoke, streaking sparks, leaves…)   */
/*    · selection rings, progress bars                                 */
/*    · Feedback: watches the world between frames and answers what    */
/*      happened with a visible beat: hits flash, stock gains float    */
/*      up, finished buildings ring out, new ideas sparkle.            */
/*  Cosmetic only: nothing here is read by the simulation.             */
/* ------------------------------------------------------------------ */
import { RES_INFO } from "../data/colony";
import { P, type Particle } from "../sim/particles";
import { shelterDone } from "../sim/build";
import type { World } from "../sim/world";
import { Q } from "./quality";

type Ctx = CanvasRenderingContext2D;
type Canvas = HTMLCanvasElement;

/* ------------------------------- sun + moon ------------------------------- */

export interface Sun {
  /** unit direction shadows fall along the ground (world px) */
  dx: number;
  dy: number;
  /** shadow length per unit of height */
  len: number;
  /** shadow darkness 0..1 */
  alpha: number;
  /** golden hour 0..1 (sunrise / sunset) */
  warm: number;
  /** 1 = morning, -1 = evening (which side the low sun is on) */
  side: number;
  /** 0..1 how much of the light is the moon's */
  moon: number;
}

const sun: Sun = { dx: 0, dy: 1, len: 0.6, alpha: 0.5, warm: 0, side: 1, moon: 0 };

/** Where the light comes from right now (the same object every call: read it, don't keep it). */
export function sunAt(time: number, daylight: number, cloud: number): Sun {
  // the sun's arc: up at 6, overhead at 12:30, down at 19
  const p = Math.max(0, Math.min(1, (time - 6) / 13));
  const high = Math.sin(Math.PI * p);
  const day = Math.max(0, Math.min(1, (daylight - 0.25) / 0.5));
  // morning shadows fall west, evening shadows east; always a little toward the camera so they show
  let dx = -Math.cos(Math.PI * p);
  let dy = 0.3 + high * 0.25;
  let len = 0.5 + Math.pow(1 - high, 1.6) * 1.9;
  // by night the moon lights the land from the north-west
  const mx = 0.55;
  const my = 0.45;
  dx = dx * day + mx * (1 - day);
  dy = dy * day + my * (1 - day);
  len = len * day + 0.75 * (1 - day);
  const n = Math.hypot(dx, dy) || 1;
  sun.dx = dx / n;
  sun.dy = dy / n;
  sun.len = len;
  sun.alpha = (0.2 + day * 0.34) * (1 - cloud * 0.55);
  sun.warm = Math.max(0, 1 - high * 2.2) * day;
  sun.side = p < 0.5 ? 1 : -1;
  sun.moon = 1 - day;
  return sun;
}

/* ----------------------------- tinted sprites ----------------------------- */

function radialSprite(stops: [number, string][], size = 64): Canvas {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return cv;
}

let whiteGlow: Canvas | null = null;
let whitePuff: Canvas | null = null;
const tinted = new Map<string, Canvas>();

function tint(base: Canvas, color: string): Canvas {
  const cv = document.createElement("canvas");
  cv.width = base.width;
  cv.height = base.height;
  const c = cv.getContext("2d")!;
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

function cached(kind: "g" | "p", color: string): Canvas {
  const key = kind + color;
  let cv = tinted.get(key);
  if (cv) return cv;
  if (!whiteGlow) {
    whiteGlow = radialSprite([[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]);
    whitePuff = radialSprite([[0, "rgba(255,255,255,0.9)"], [0.45, "rgba(255,255,255,0.6)"], [0.8, "rgba(255,255,255,0.16)"], [1, "rgba(255,255,255,0)"]]);
  }
  // the palette of particle colours is small; if something generates endless new ones, start over
  if (tinted.size > 160) tinted.clear();
  cv = tint(kind === "g" ? whiteGlow! : whitePuff!, color);
  tinted.set(key, cv);
  return cv;
}

/** A soft round glow in this colour (bright core). */
export const glowSprite = (color: string) => cached("g", color);
/** A soft smoke / dust puff in this colour. */
export const puffSprite = (color: string) => cached("p", color);

/* -------------------------------- shadows -------------------------------- */

/**
 * A soft shadow for something `h` tall standing on a base `r` wide: a blob at its feet
 * stretched away from the sun. `sprite` is the renderer's dark radial sprite.
 */
export function castShadow(c: Ctx, sprite: Canvas, x: number, y: number, r: number, h: number, s: Sun, ca: number, sa: number) {
  const L = h * s.len;
  const major = r + L * 0.5;
  const minor = Math.max(2, r * 0.42);
  const cx = x + s.dx * L * 0.5;
  const cy = y + s.dy * L * 0.5;
  c.save();
  c.transform(ca, sa, -sa, ca, cx, cy);
  c.drawImage(sprite, -major, -minor, major * 2, minor * 2);
  c.restore();
}

/** Add a quad to the current path with a fixed winding, so overlapping pieces union instead of cancelling. */
function quad(c: Ctx, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay) + (cx - ax) * (dy - ay) - (dx - ax) * (cy - ay);
  c.moveTo(ax, ay);
  if (area >= 0) {
    c.lineTo(bx, by);
    c.lineTo(cx, cy);
    c.lineTo(dx, dy);
  } else {
    c.lineTo(dx, dy);
    c.lineTo(cx, cy);
    c.lineTo(bx, by);
  }
  c.closePath();
}

/**
 * Add the shadow of a box (ground rectangle x0..x1 × y0..y1, `h` tall) to the current path.
 * Everything added between one beginPath / fill shares one darkness: neighbours never double up.
 */
export function boxShadowPath(c: Ctx, x0: number, y0: number, x1: number, y1: number, h: number, s: Sun) {
  const ox = s.dx * h * s.len;
  const oy = s.dy * h * s.len;
  quad(c, x0 + ox, y0 + oy, x1 + ox, y0 + oy, x1 + ox, y1 + oy, x0 + ox, y1 + oy);
  quad(c, x0, y0, x1, y0, x1 + ox, y0 + oy, x0 + ox, y0 + oy);
  quad(c, x1, y0, x1, y1, x1 + ox, y1 + oy, x1 + ox, y0 + oy);
  quad(c, x1, y1, x0, y1, x0 + ox, y1 + oy, x1 + ox, y1 + oy);
  quad(c, x0, y1, x0, y0, x0 + ox, y0 + oy, x0 + ox, y1 + oy);
}

/* ------------------------------- particles ------------------------------- */

const SOFT = new Set<P>([P.Dust, P.Smoke, P.Steam, P.Poof]);

/** Paint one particle (k = life left 0..1). `t` = renderer clock. Returns false for kinds it leaves to the caller. */
export function drawParticle(c: Ctx, p: Particle, k: number, t: number): boolean {
  const x = p.x;
  const y = p.y - p.z;
  if (SOFT.has(p.k)) {
    const poof = p.k === P.Poof;
    const grow = poof ? 1 + (1 - k) * 1.2 : 1 + (1 - k) * 1.8;
    // ease in fast, fade out slowly: a puff that swells and thins
    const a = Math.min(1, (1 - k) * 8) * k * (poof ? 1 : 0.85);
    const r = p.size * grow * 1.55;
    c.globalAlpha = a;
    c.drawImage(puffSprite(p.color), x - r, y - r, r * 2, r * 2);
    return true;
  }
  switch (p.k) {
    case P.Ember:
    case P.Spark: {
      // a hot core, a soft halo, and a streak along the way it's flying
      const r = p.size * (p.k === P.Spark ? 2.6 : 3.4);
      c.globalAlpha = k * 0.75;
      c.drawImage(glowSprite(p.color), x - r, y - r, r * 2, r * 2);
      const sp = Math.hypot(p.vx, p.vy - p.vz);
      if (sp > 30) {
        const f = Math.min(0.05, 6 / sp);
        c.globalAlpha = k * 0.8;
        c.strokeStyle = p.color;
        c.lineWidth = Math.max(0.8, p.size * 0.55);
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - p.vx * f, y - (p.vy - p.vz) * f);
        c.stroke();
      }
      c.globalAlpha = k;
      c.fillStyle = "#fff8e0";
      const s = Math.max(0.8, p.size * 0.45);
      c.fillRect(x - s / 2, y - s / 2, s, s);
      return true;
    }
    case P.Firefly: {
      const a = (Math.sin(t * 5 + p.rot * 10) + 1) / 2;
      const fx = x + Math.sin(t + p.rot) * 6;
      const fy = y + Math.cos(t * 1.3 + p.rot) * 4;
      c.globalAlpha = a * Math.min(1, k * 3) * 0.8;
      c.drawImage(glowSprite("#d9ff7a"), fx - 7, fy - 7, 14, 14);
      c.globalAlpha = a * Math.min(1, k * 3);
      c.fillStyle = "#f6ffc8";
      c.fillRect(fx - 0.8, fy - 0.8, 1.6, 1.6);
      return true;
    }
    case P.Splash:
    case P.Drop: {
      // a bead of water: a pale body with a bright glint, stretched as it falls
      const fall = Math.min(2.2, 1 + Math.abs(p.vz) / 160);
      c.globalAlpha = Math.min(1, k * 1.6) * 0.85;
      c.fillStyle = "rgba(196,228,250,0.9)";
      c.beginPath();
      c.ellipse(x, y, p.size * 0.8, p.size * 0.8 * fall, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffff";
      c.fillRect(x - p.size * 0.3, y - p.size * 0.5, p.size * 0.5, p.size * 0.5);
      return true;
    }
    case P.Mud:
    case P.Crumb:
    case P.Rock: {
      c.globalAlpha = Math.min(1, k * 2);
      const col = p.k === P.Mud && p.color === "#fff" ? "#6b4a2a" : p.color;
      c.fillStyle = col;
      c.beginPath();
      c.arc(x, y, p.size, 0, Math.PI * 2);
      c.fill();
      if (p.size > 1.6) {
        // lit from above
        c.globalAlpha *= 0.35;
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(x - p.size * 0.25, y - p.size * 0.3, p.size * 0.45, 0, Math.PI * 2);
        c.fill();
      }
      // a speck of shadow under anything in the air
      if (p.z > 3) {
        c.globalAlpha = Math.min(0.25, k) * Math.max(0, 1 - p.z / 90);
        c.fillStyle = "#101820";
        c.beginPath();
        c.ellipse(x, p.y, p.size * 1.1, p.size * 0.45, 0, 0, Math.PI * 2);
        c.fill();
      }
      return true;
    }
    case P.Leaf:
    case P.Ash: {
      c.globalAlpha = Math.min(1, k * 2);
      const tumble = p.rot + t * 3;
      // tumbling: the leaf narrows as it turns edge-on
      const flat = 0.2 + Math.abs(Math.sin(tumble * 0.7 + p.rot)) * 0.5;
      c.fillStyle = p.color;
      c.beginPath();
      c.ellipse(x + Math.sin(t * 2.2 + p.rot * 3) * 3, y, p.size, p.size * flat, tumble, 0, Math.PI * 2);
      c.fill();
      if (p.z > 0 && p.g === 0) p.z = Math.max(0, p.z - 0.4);
      return true;
    }
    case P.Ripple:
    case P.Ring: {
      const ring = p.k === P.Ring;
      const e = 1 - k;
      const r = p.size * (1 + (1 - k * k) * (ring ? 6 : 2.5));
      c.strokeStyle = ring ? p.color : "rgba(255,255,255,0.85)";
      c.globalAlpha = k * (ring ? 0.9 : 0.8);
      c.lineWidth = ring ? 3.2 * k + 0.6 : 1.2;
      c.beginPath();
      c.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
      c.stroke();
      if (ring) {
        // a second, fainter wave chasing the first
        c.globalAlpha = k * 0.4;
        c.lineWidth = 1.4;
        c.beginPath();
        c.ellipse(x, y, r * (0.55 + e * 0.2), r * 0.45 * (0.55 + e * 0.2), 0, 0, Math.PI * 2);
        c.stroke();
      }
      return true;
    }
    default:
      return false;
  }
}

/* --------------------------- rings + bars + text --------------------------- */

/** The ring under a picked person / creature: a soft halo, a crisp ring, four ticks orbiting it. */
export function selectRing(c: Ctx, x: number, y: number, rx: number, ry: number, t: number, color: string, strong = true) {
  c.save();
  c.lineCap = "round";
  const pulse = 1 + Math.sin(t * 4) * 0.035;
  rx *= pulse;
  ry *= pulse;
  c.strokeStyle = color;
  c.globalAlpha = 0.2;
  c.lineWidth = 5;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  c.globalAlpha = strong ? 0.95 : 0.7;
  c.lineWidth = 1.6;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  if (strong) {
    c.lineWidth = 2.6;
    c.strokeStyle = "#ffffff";
    c.globalAlpha = 0.9;
    for (let i = 0; i < 4; i++) {
      const a = t * 1.4 + (i * Math.PI) / 2;
      c.beginPath();
      c.ellipse(x, y, rx + 2.2, ry + 1.1, 0, a, a + 0.42);
      c.stroke();
    }
  }
  c.restore();
}

/** A rounded progress / health bar: dark track, coloured fill with a glossy top edge. */
export function progressBar(c: Ctx, x: number, y: number, w: number, frac: number, color: string) {
  const f = Math.max(0, Math.min(1, frac));
  const h = 4;
  c.fillStyle = "rgba(10,16,26,0.72)";
  c.beginPath();
  c.roundRect(x - w / 2 - 1, y - 1, w + 2, h + 2, 3);
  c.fill();
  if (f > 0.01) {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x - w / 2, y, Math.max(h, w * f), h, 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.fillRect(x - w / 2 + 1, y + 0.6, Math.max(1, w * f - 2), 1.1);
  }
}

/* ------------------------------- feedback ------------------------------- */

interface Floater {
  x: number;
  y: number;
  t: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

interface Flash {
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
  color: string;
}

const FLOATER_MAX = 28;

export class Feedback {
  private world: World | null = null;
  private floaters: Floater[] = [];
  private flashes: Flash[] = [];
  private stock = new Map<string, number>();
  private hp = new Map<number, number>();
  private built = new Map<string, number>();
  private learned = 0;
  private civDone = 0;
  private stockT = 0;
  private scanT = 0;
  /** floaters queued at the stockpile wait their turn so they don't print on top of each other */
  private lane = 0;

  /** Forget everything (new world / loaded save): the first look only takes notes. */
  reset(w: World) {
    this.world = w;
    this.floaters.length = 0;
    this.flashes.length = 0;
    this.stock.clear();
    this.hp.clear();
    this.built.clear();
    this.learned = w.camp.learned.size;
    this.civDone = w.civ.done.size;
    for (const [k, v] of Object.entries(w.camp.stock)) this.stock.set(k, v as number);
    this.noteBuilt(w, false);
  }

  private float(x: number, y: number, text: string, color: string, size = 12, max = 1.5) {
    if (this.floaters.length >= FLOATER_MAX) this.floaters.shift();
    this.floaters.push({ x, y, t: 0, max, text, color, size });
  }

  private flash(x: number, y: number, r: number, color: string, max = 0.22) {
    if (this.flashes.length > 40) this.flashes.shift();
    this.flashes.push({ x, y, r, t: 0, max, color });
  }

  private noteBuilt(w: World, celebrate: boolean) {
    const seen = this.built;
    const done = (key: string, v: number, x: number, y: number, r: number) => {
      const was = seen.get(key);
      seen.set(key, v);
      if (!celebrate || was === undefined || was >= 1 || v < 1) return;
      this.complete(w, x, y, r);
    };
    for (const b of w.colony.buildings) done("b" + b.id, b.built, b.x, b.y - 14, 34);
    for (const s of w.shelters) done("s" + s.id, shelterDone(s) ? 1 : 0, s.x, s.y - 12, 30);
    for (const tw of w.tribe.towers) done("t" + tw.id, tw.stage >= 3 ? 1 : 0, tw.x, tw.y - 20, 30);
    for (const wl of w.tribe.walls) done("w" + wl.id, wl.built >= 1 ? 1 : 0, wl.tx * 32 + 16, wl.ty * 32 + 10, 16);
    if (seen.size > 6000) seen.clear();
  }

  /** Something was just finished here: a ring rolls out, sparks pop, a tick floats up. */
  private complete(w: World, x: number, y: number, r: number) {
    const v = w.view;
    if (x < v.x0 - 60 || x > v.x1 + 60 || y < v.y0 - 60 || y > v.y1 + 60) return;
    w.particles.spawn(P.Ring, x, y + 12, { size: r * 0.5, max: 0.7, color: "rgba(140,255,170,0.95)" });
    w.particles.burst(P.Spark, x, y, Math.round(8 * Q.particles), 70, { z: 10, vz: 60, g: 160, size: 2, max: 0.7, color: "#c8ffb0" });
    w.particles.burst(P.Dust, x, y + 10, Math.round(5 * Q.particles), 30, { size: 6, max: 0.8, color: "rgba(214,196,160,0.5)" });
    if (r > 20) this.float(x, y - 26, "✓ Built", "#b6ffc4", 12, 1.6);
  }

  /** Look at the world once a frame (cheaply: full scans only a few times a second). */
  update(w: World, dt: number, zoom: number) {
    if (this.world !== w) this.reset(w);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t >= f.max) this.floaters.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      if (f.t >= f.max) this.flashes.splice(i, 1);
    }
    const v = w.view;
    const inView = (x: number, y: number) => x > v.x0 - 40 && x < v.x1 + 40 && y > v.y0 - 40 && y < v.y1 + 80;

    // hits: anything in view that just lost health flashes and sheds a few specks
    const hit = (id: number, hp: number, x: number, y: number, r: number, blood: boolean, hot = false) => {
      const was = this.hp.get(id);
      this.hp.set(id, hp);
      if (was === undefined || hp >= was - 0.004 || !inView(x, y) || zoom < 0.3) return;
      const big = was - hp > 0.12;
      // burning (lava): an orange flare and sparks, not a white flash and blood
      if (hot) {
        this.flash(x, y - r * 0.6, r * (big ? 1.4 : 1.05), "#ff8a2a", 0.18);
        w.particles.burst(P.Spark, x, y - r * 0.6, Math.round((big ? 5 : 2) * Q.particles), 70, { z: r * 0.6, vz: 50, g: 120, size: 1.8, max: 0.4, color: "#ffb03a" });
        return;
      }
      this.flash(x, y - r * 0.6, r * (big ? 1.5 : 1.15), "#ffffff");
      if (blood) w.particles.burst(P.Crumb, x, y - r * 0.6, Math.round((big ? 7 : 3) * Q.particles), 60, { z: r * 0.6, vz: 50, g: 320, size: 1.5, max: 0.55, color: "#b3261e" });
      else w.particles.burst(P.Dust, x, y - r * 0.5, Math.round(4 * Q.particles), 40, { size: 5, max: 0.5, color: "rgba(230,220,200,0.6)" });
      w.particles.burst(P.Spark, x, y - r * 0.6, Math.round((big ? 5 : 2) * Q.particles), 90, { z: r * 0.6, vz: 30, g: 200, size: 1.6, max: 0.3, color: "#fff2c0" });
    };
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.08;
      for (const h of w.humans) if (!h.under) hit(h.id, h.hp, h.x, h.y - h.z, 14, true, (h.aflame ?? 0) > 0);
      for (const d of w.dinos) if (!d.under) hit(d.id, d.health, d.x, d.y - d.z, 22, true, (d.aflame ?? 0) > 0);
      for (const b of w.rivals.brutes) hit(b.id, b.hp, b.x, b.y - b.z, 16, true, (b.aflame ?? 0) > 0);
      if (this.hp.size > 4000) this.hp.clear();
    }

    // stock: gains float up from the stockpile ("+3 🪵"), a few at a time
    this.stockT -= dt;
    if (this.stockT <= 0) {
      this.stockT = 0.45;
      const px = w.camp.pileX;
      const py = w.camp.pileY;
      const show = inView(px, py) && zoom > 0.45;
      let lanes = 0;
      for (const [k, raw] of Object.entries(w.camp.stock)) {
        const now = raw as number;
        const was = this.stock.get(k) ?? now;
        this.stock.set(k, now);
        const gain = Math.round(now - was);
        if (!show || gain < 1 || lanes >= 3) continue;
        const info = RES_INFO[k as keyof typeof RES_INFO];
        if (!info) continue;
        this.lane = (this.lane + 1) % 5;
        this.float(px + (this.lane - 2) * 17, py - 26 - lanes * 5, `+${gain} ${info.icon}`, "#ffffff", 13, 1.6);
        lanes++;
      }
      this.noteBuilt(w, true);
      // a new idea / discovery: light sweeps out from the fire
      const learned = w.camp.learned.size;
      const civ = w.civ.done.size;
      if (learned > this.learned || civ > this.civDone) {
        const x = civ > this.civDone && w.civ.chamberX ? w.civ.chamberX : w.camp.x;
        const y = civ > this.civDone && w.civ.chamberX ? w.civ.chamberY : w.camp.y;
        if (inView(x, y)) {
          w.particles.spawn(P.Ring, x, y, { size: 26, max: 1.1, color: "rgba(255,226,120,0.95)" });
          w.particles.burst(P.Spark, x, y - 20, Math.round(16 * Q.particles), 110, { z: 20, vz: 90, g: 150, size: 2.2, max: 1, color: "#ffe27a" });
          this.float(x, y - 44, "✦ New idea!", "#ffe89a", 13, 2);
        }
      }
      this.learned = learned;
      this.civDone = civ;
    }
  }

  /** White-hot flashes over whatever was just hit (world space, drawn over the entities). */
  drawFlashes(c: Ctx) {
    if (!this.flashes.length) return;
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const f of this.flashes) {
      const k = 1 - f.t / f.max;
      c.globalAlpha = k * 0.45;
      const r = f.r * (1 + (1 - k) * 0.5);
      c.drawImage(glowSprite(f.color), f.x - r, f.y - r, r * 2, r * 2);
    }
    c.restore();
  }

  /** Floating text (world space, after the light map so it stays readable at night). */
  drawFloaters(c: Ctx, inv: number) {
    if (!this.floaters.length) return;
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    for (const f of this.floaters) {
      const k = f.t / f.max;
      // pop in, drift up, fade out
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 1.2);
      const y = f.y - (1 - Math.pow(1 - k, 2)) * 26;
      c.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      c.font = `700 ${f.size * pop * inv}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      c.lineWidth = 3 * inv;
      c.strokeStyle = "rgba(8,14,24,0.85)";
      c.strokeText(f.text, f.x, y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, y);
    }
    c.restore();
  }
}
