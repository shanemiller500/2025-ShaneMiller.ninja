/* ------------------------------------------------------------------ */
/*  Renderer: reads the World and paints a frame. No sim state lives   */
/*  here except cosmetic stuff (rain streaks, cloud drift, fireflies). */
/*  Layers: terrain → water/lava/fire ground FX → shadows → y-sorted   */
/*  entities → flyers → particles → sky FX → light map → UI overlays.  */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { CRAFT_STEPS } from "../sim/camp";
import { isBaby, sizeOf } from "../sim/dinos";
import { P, type Particle } from "../sim/particles";
import { PLANT_H, TALL } from "../sim/plants";
import { hash2, valueNoise } from "../sim/rng";
import { CHUNKS_X, CHUNK_TILES } from "../sim/terrain";
import { MAP_H, MAP_W, T, TILE, WORLD_H, WORLD_W, type Dino, type Human, type Plant } from "../sim/types";
import type { World } from "../sim/world";
import { drawDino, restPose, type DinoPose } from "./drawDino";
import { drawCampfire, drawEgg, drawFish, drawFlame, drawHuman, drawItem, drawPlant, drawProp, drawShelter, drawStockpile, drawVolcano } from "./sprites";
import { TerrainRenderer } from "./terrainRenderer";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Overlay {
  selectedId: number;
  followId: number;
  hover: { x: number; y: number; icon: string; radius: number } | null;
  shakeX: number;
  shakeY: number;
  flash: number;
  flashColor: string;
}

type Drawable = { y: number; k: number; i: number };
const K_PLANT = 0;
const K_DINO = 1;
const K_HUMAN = 2;
const K_ITEM = 3;
const K_EGG = 4;
const K_PROP = 5;
const K_SHELTER = 6;
const K_FIRE = 7;
const K_CAMPFIRE = 8;
const K_PILE = 9;
const K_VOLCANO = 10;
const K_PEAK = 11;
const K_ROCK = 12;

interface Drop {
  x: number;
  y: number;
  s: number;
  l: number;
}

function sprite(size: number, paint: (c: CanvasRenderingContext2D, s: number) => void) {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  paint(cv.getContext("2d")!, size);
  return cv;
}

const radial = (inner: string, outer: string) =>
  sprite(128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrainR: TerrainRenderer;
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private t = 0;
  private drops: Drop[] = [];
  private drawables: Drawable[] = [];
  private visPlants: Plant[] = [];
  private peaks: { x: number; y: number; s: number }[] = [];
  private cloudX = 0;
  private cloudY = 0;
  private warmLight = radial("rgba(255,170,90,1)", "rgba(255,150,70,0)");
  private warmSprite = radial("rgba(255,170,70,0.9)", "rgba(255,120,40,0)");
  private cloudSprite = radial("rgba(255,255,255,0.95)", "rgba(255,255,255,0)");
  private shadowSprite = radial("rgba(20,30,40,0.55)", "rgba(20,30,40,0)");
  private pose: DinoPose = restPose();
  /** fraction of the view that is water (for ambient audio) */
  waterInView = 0;
  fireInView = 0;
  /** smoothed frame cost (ms) for adaptive quality */
  cost = 0;

  constructor(private canvas: HTMLCanvasElement, private world: World) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.terrainR = new TerrainRenderer(world.terrain);
    this.light = document.createElement("canvas");
    this.lctx = this.light.getContext("2d")!;
    this.buildPeaks();
  }

  get mapImage() {
    return this.terrainR.mapImage;
  }

  setWorld(w: World) {
    this.world = w;
    this.terrainR = new TerrainRenderer(w.terrain);
    this.buildPeaks();
  }

  private buildPeaks() {
    this.peaks = [];
    const t = this.world.terrain;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (t.tiles[y * MAP_W + x] !== T.Mountain) continue;
        if (hash2(x, y, t.seed + 31) > 0.16) continue;
        if (Math.hypot(x - 128, y - 20) < 4) continue;
        this.peaks.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE, s: 0.7 + hash2(x, y, t.seed + 32) * 0.7 });
      }
    }
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.light.width = Math.max(1, Math.round(w / 2));
    this.light.height = Math.max(1, Math.round(h / 2));
  }

  /** screen px → world px */
  toWorld(cam: Camera, sx: number, sy: number) {
    return { x: cam.x + (sx - this.w / 2) / cam.zoom, y: cam.y + (sy - this.h / 2) / cam.zoom };
  }
  toScreen(cam: Camera, wx: number, wy: number) {
    return { x: (wx - cam.x) * cam.zoom + this.w / 2, y: (wy - cam.y) * cam.zoom + this.h / 2 };
  }

  viewRect(cam: Camera) {
    const hw = this.w / 2 / cam.zoom;
    const hh = this.h / 2 / cam.zoom;
    return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
  }

  render(cam: Camera, ov: Overlay, dt: number) {
    const t0 = performance.now();
    this.t += dt;
    const w = this.world;
    const c = this.ctx;
    const z = cam.zoom;
    const cx = cam.x + ov.shakeX;
    const cy = cam.y + ov.shakeY;
    const d = this.dpr;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = "#1f5f8a";
    c.fillRect(0, 0, this.w, this.h);
    c.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 - cx * z), d * (this.h / 2 - cy * z));
    const v = this.viewRect({ x: cx, y: cy, zoom: z });
    const pad = 160;
    const x0 = v.x0 - pad;
    const y0 = v.y0 - pad;
    const x1 = v.x1 + pad;
    const y1 = v.y1 + pad * 2;

    this.terrainR.draw(c, v.x0, v.y0, v.x1, v.y1, z);
    this.groundFx(c, v.x0, v.y0, v.x1, v.y1, z);

    const lod = z < 0.5;
    const night = 1 - w.daylight;

    // collect drawables
    const list = this.drawables;
    list.length = 0;
    this.visPlants.length = 0;
    w.plantHash.rect(x0, y0, x1, y1 + 120, this.visPlants);
    w.visiblePlants = this.visPlants;
    for (let i = 0; i < this.visPlants.length; i++) list.push({ y: this.visPlants[i].y, k: K_PLANT, i });
    for (let i = 0; i < w.dinos.length; i++) {
      const dn = w.dinos[i];
      if (sp(dn.species).move === "fly" && dn.z > 6) continue;
      if (dn.x < x0 || dn.x > x1 || dn.y < y0 || dn.y > y1 + 150) continue;
      list.push({ y: dn.y, k: K_DINO, i });
    }
    for (let i = 0; i < w.humans.length; i++) {
      const h = w.humans[i];
      if (h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1) continue;
      if (this.hidden(h)) continue;
      list.push({ y: h.y, k: K_HUMAN, i });
    }
    for (let i = 0; i < w.items.length; i++) {
      const it = w.items[i];
      if (it.x > x0 && it.x < x1 && it.y > y0 && it.y < y1) list.push({ y: it.y, k: K_ITEM, i });
    }
    for (let i = 0; i < w.eggs.length; i++) {
      const e = w.eggs[i];
      if (e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1) list.push({ y: e.y, k: K_EGG, i });
    }
    for (let i = 0; i < w.props.length; i++) {
      const p = w.props[i];
      if (p.kind === "nest") continue;
      if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) list.push({ y: p.y, k: K_PROP, i });
    }
    for (let i = 0; i < w.shelters.length; i++) {
      const s = w.shelters[i];
      if (s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1 + 60) list.push({ y: s.y, k: K_SHELTER, i });
    }
    for (let i = 0; i < w.campfires.length; i++) list.push({ y: w.campfires[i].y, k: K_CAMPFIRE, i });
    if (w.camp.pileX > x0 && w.camp.pileX < x1 && w.camp.pileY > y0 && w.camp.pileY < y1) list.push({ y: w.camp.pileY, k: K_PILE, i: 0 });
    const vo = w.volcano;
    if (vo.x + 450 > x0 && vo.x - 450 < x1 && vo.y - 400 < y1 && vo.y + 200 > y0) list.push({ y: vo.y + 150, k: K_VOLCANO, i: 0 });
    for (let i = 0; i < this.peaks.length; i++) {
      const p = this.peaks[i];
      if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 + 120) list.push({ y: p.y, k: K_PEAK, i });
    }
    // fire cells (flames are tall, so they sort with everything else)
    let fires = 0;
    w.fire.active.forEach((idx) => {
      const fx = (idx % MAP_W) * TILE + TILE / 2;
      const fy = Math.floor(idx / MAP_W) * TILE + TILE / 2;
      if (fx > x0 && fx < x1 && fy > y0 && fy < y1) {
        list.push({ y: fy + 8, k: K_FIRE, i: idx });
        fires++;
      }
    });
    this.fireInView = fires;
    for (let i = 0; i < vo.rocks.length; i++) list.push({ y: vo.rocks[i].y, k: K_ROCK, i });

    // shadows first (cheap sprite stamps), offset by the sun
    const sunX = (w.time - 12) * -3;
    const shadowA = 0.25 + w.daylight * 0.55;
    c.globalAlpha = shadowA * (1 - w.weather.cloud * 0.5);
    for (const it of list) {
      let sx = 0;
      let sy = 0;
      let r = 0;
      if (it.k === K_PLANT) {
        const p = this.visPlants[it.i];
        if (p.stump) continue;
        sx = p.x;
        sy = p.y;
        r = TALL.has(p.kind) ? PLANT_H[p.kind] * p.size * 0.32 : 10;
      } else if (it.k === K_DINO) {
        const dn = w.dinos[it.i];
        if (sp(dn.species).move === "swim") continue;
        sx = dn.x;
        sy = dn.y;
        r = sizeOf(dn) * 0.42;
      } else if (it.k === K_HUMAN) {
        const h = w.humans[it.i];
        sx = h.x;
        sy = h.y;
        r = 8;
      } else continue;
      c.drawImage(this.shadowSprite, sx - r + sunX * (r / 40), sy - r * 0.35, r * 2, r * 0.7);
    }
    // flyer shadows on the ground
    for (const dn of w.dinos) {
      if (sp(dn.species).move !== "fly" || dn.z <= 6) continue;
      if (dn.x < x0 || dn.x > x1 || dn.y < y0 || dn.y > y1) continue;
      const r = sizeOf(dn) * 0.5;
      c.globalAlpha = shadowA * 0.5;
      c.drawImage(this.shadowSprite, dn.x - r + dn.z * 0.2, dn.y - r * 0.3, r * 2, r * 0.6);
    }
    c.globalAlpha = 1;

    // nest decal
    for (const p of w.props) if (p.kind === "nest") {
      c.save();
      c.translate(p.x, p.y);
      drawProp(c, p, this.t);
      c.restore();
    }

    // fish schools under the surface
    for (const s of w.schools) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      c.globalAlpha = 0.55;
      for (let i = 0; i < s.n; i++) {
        const a = this.t * 0.8 + i * 1.9 + s.id;
        const fx = s.x + Math.cos(a) * (10 + (i % 4) * 7);
        const fy = s.y + Math.sin(a * 1.3) * (6 + (i % 3) * 4);
        c.save();
        c.translate(fx, fy);
        c.scale(Math.cos(a) > 0 ? -1 : 1, 1);
        drawFish(c, 0, 0, 9, i % 3 ? "#cfe3ef" : "#f2c46a");
        c.restore();
      }
      c.globalAlpha = 1;
    }

    list.sort((a, b) => a.y - b.y);
    const hasSpear = w.camp.learned.has("spear");
    for (const it of list) {
      switch (it.k) {
        case K_PLANT: {
          const p = this.visPlants[it.i];
          c.save();
          c.translate(p.x, p.y);
          drawPlant(c, p, this.t, w.weather.wind, lod);
          c.restore();
          break;
        }
        case K_DINO:
          this.drawDinoAt(c, w.dinos[it.i], ov);
          break;
        case K_HUMAN: {
          const h = w.humans[it.i];
          c.save();
          c.translate(h.x, h.y - h.z);
          drawHuman(c, h, this.t, hasSpear);
          c.restore();
          break;
        }
        case K_ITEM: {
          const item = w.items[it.i];
          c.save();
          c.translate(item.x, item.y);
          drawItem(c, item, this.t);
          c.restore();
          break;
        }
        case K_EGG: {
          const e = w.eggs[it.i];
          c.save();
          c.translate(e.x, e.y);
          drawEgg(c, e, this.t);
          c.restore();
          break;
        }
        case K_PROP: {
          const p = w.props[it.i];
          c.save();
          c.translate(p.x, p.y);
          drawProp(c, p, this.t);
          c.restore();
          break;
        }
        case K_SHELTER: {
          const s = w.shelters[it.i];
          c.save();
          c.translate(s.x, s.y);
          drawShelter(c, s, night > 0.5);
          c.restore();
          break;
        }
        case K_CAMPFIRE: {
          const f = w.campfires[it.i];
          c.save();
          c.translate(f.x, f.y);
          drawCampfire(c, f.lit, this.t);
          c.restore();
          break;
        }
        case K_PILE:
          c.save();
          c.translate(w.camp.pileX, w.camp.pileY);
          drawStockpile(c, w.camp.stock);
          c.restore();
          break;
        case K_VOLCANO:
          c.save();
          c.translate(vo.x, vo.y);
          drawVolcano(c, vo.glow, vo.phase === "erupt" || vo.phase === "ash", this.t);
          c.restore();
          break;
        case K_PEAK: {
          const p = this.peaks[it.i];
          this.drawPeak(c, p.x, p.y, p.s);
          break;
        }
        case K_FIRE: {
          const idx = it.i;
          const fx = (idx % MAP_W) * TILE + TILE / 2;
          const fy = Math.floor(idx / MAP_W) * TILE + TILE / 2;
          const h = w.fire.heat[idx];
          const s = 0.6 + h * 0.7;
          drawFlame(c, fx - 8, fy + 6, s * 0.8, this.t + idx);
          drawFlame(c, fx + 6, fy + 2, s, this.t + idx * 1.7);
          if (!lod) drawFlame(c, fx, fy + 12, s * 0.7, this.t + idx * 0.7);
          break;
        }
        case K_ROCK: {
          const r = vo.rocks[it.i];
          c.fillStyle = "#3a2a24";
          c.beginPath();
          c.arc(r.x, r.y - r.z, r.size, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "rgba(255,120,40,0.8)";
          c.beginPath();
          c.arc(r.x, r.y - r.z, r.size * 0.5, 0, Math.PI * 2);
          c.fill();
          break;
        }
      }
    }

    // flyers above everything else on the ground
    const flyers: Dino[] = [];
    for (const dn of w.dinos) if (sp(dn.species).move === "fly" && dn.z > 6 && dn.x > x0 && dn.x < x1 && dn.y - dn.z > y0 - 200 && dn.y - dn.z < y1) flyers.push(dn);
    flyers.sort((a, b) => a.y - b.y);
    for (const dn of flyers) this.drawDinoAt(c, dn, ov);

    this.drawParticles(c, x0, y0, x1, y1);
    this.skyWorld(c, v, z);

    // lightning + meteors
    for (const b of w.bolts) this.drawBolt(c, b.x, b.y, b.seed, 1 - b.t / 0.6);
    for (const m of w.meteors) this.drawMeteor(c, m.x, m.y, m.t / m.dur);

    // screen-space passes
    c.setTransform(d, 0, 0, d, 0, 0);
    this.lighting(c, { x: cx, y: cy, zoom: z });
    this.screenWeather(c, dt);

    // overlays that should stay readable at night
    c.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 - cx * z), d * (this.h / 2 - cy * z));
    this.overlays(c, ov, x0, y0, x1, y1, z);

    c.setTransform(d, 0, 0, d, 0, 0);
    if (ov.flash > 0.01) {
      c.globalAlpha = Math.min(1, ov.flash);
      c.fillStyle = ov.flashColor;
      c.fillRect(0, 0, this.w, this.h);
      c.globalAlpha = 1;
    }
    this.cost = this.cost * 0.92 + (performance.now() - t0) * 0.08;
  }

  hidden(h: Human) {
    if (h.state !== "hide" && h.state !== "sleep") return false;
    const w = this.world;
    if (Math.hypot(h.x - w.camp.caveX, h.y - w.camp.caveY) < 30) return true;
    return w.shelters.some((s) => s.stage >= 4 && Math.hypot(h.x - s.x, h.y - s.y) < 30);
  }

  /* ----------------------------- dinos ----------------------------- */

  poseFor(dn: Dino): DinoPose {
    const p = this.pose;
    const def = sp(dn.species);
    const v = Math.hypot(dn.vx, dn.vy);
    const st = dn.state;
    p.walk = dn.anim * Math.PI;
    p.stride = Math.min(1, v / Math.max(10, def.speed * 0.6));
    p.t = this.t + dn.id * 0.37;
    p.headDown = st === "eat" || st === "drink" || st === "investigate" ? 0.6 + Math.sin(this.t * 6 + dn.id) * 0.3 : st === "defend" ? 0.8 : st === "stalk" ? 0.4 : st === "sleep" ? 0.7 : 0;
    // brachiosaurs browse up in the trees
    if (st === "eat" && def.reach === "high") p.headDown = 0;
    p.headUp = st === "roar" || st === "lookUp" || st === "annoyed" ? 1 : st === "flee" ? 0.4 : 0;
    p.mouth = st === "roar" ? Math.min(1, dn.stateT * 4) : st === "eat" ? (Math.sin(this.t * 10 + dn.id) + 1) * 0.3 : st === "chase" || st === "annoyed" ? 0.6 : st === "lookUp" ? 0.4 : 0;
    p.lie = st === "sleep" ? Math.min(1, dn.stateT) : st === "wallow" ? 0.9 : st === "faint" ? 1 : 0;
    p.flip = st === "knocked" ? Math.min(1, (dn.stateT + 2) * 3) * (dn.stateT > 1.6 ? Math.max(0, (2 - dn.stateT) / 0.4) : 1) : st === "wallow" ? Math.abs(Math.sin(dn.stateT * 1.5)) * 0.9 : 0;
    p.eyesClosed = st === "sleep" || st === "faint" || (Math.sin(this.t * 0.7 + dn.id * 3) > 0.985);
    p.dangle = st === "carried";
    p.flying = def.move === "fly" && dn.z > 4;
    p.wing = this.t * (st === "dive" || st === "flee" ? 14 : 7) + dn.id;
    p.submerged = def.move === "swim" ? (dn.z > 2 ? 0 : 1) : 1;
    p.baby = 1 - dn.growth;
    p.muddy = dn.muddy;
    p.tailSwing = st === "defend" && def.shape.club ? Math.sin(this.t * 8) : st === "scratch" ? Math.sin(this.t * 6) * 0.5 : 0;
    if (st === "scratch" || st === "stuck" || st === "tussle") p.walk = this.t * 8;
    if (st === "carried") {
      p.walk = this.t * 12;
      p.stride = 1;
    }
    return p;
  }

  private drawDinoAt(c: CanvasRenderingContext2D, dn: Dino, ov: Overlay) {
    const def = sp(dn.species);
    const L = sizeOf(dn);
    const pose = this.poseFor(dn);
    c.save();
    let jx = 0;
    if (dn.state === "tussle") jx = Math.sin(this.t * 40 + dn.id) * 3;
    if (dn.state === "stuck") jx = Math.sin(this.t * 25) * 2;
    c.translate(dn.x + jx, dn.y - dn.z);
    if (def.move === "swim" && dn.z < 2) {
      // a dark shape gliding under the waves
      c.globalAlpha = 0.6;
    }
    if (dn.id === ov.selectedId || dn.id === ov.followId) {
      c.strokeStyle = dn.id === ov.followId ? "rgba(255,215,90,0.95)" : "rgba(255,255,255,0.9)";
      c.lineWidth = 2.5;
      c.setLineDash([6, 5]);
      c.lineDashOffset = -this.t * 20;
      c.beginPath();
      c.ellipse(0, dn.z, L * 0.5, L * 0.18, 0, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    drawDino(c, def, L, dn.dir, pose);
    if (dn.state === "tussle") {
      // cartoon dust cloud hides the scuffle
      c.globalAlpha = 0.85;
      c.fillStyle = "#efe4cc";
      for (let i = 0; i < 6; i++) {
        const a = this.t * 6 + i;
        c.beginPath();
        c.arc(Math.cos(a) * L * 0.25, -L * 0.2 + Math.sin(a * 1.3) * L * 0.12, L * 0.16, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  private drawPeak(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const W = 46 * s;
    const H = 70 * s;
    c.fillStyle = "#6f665d";
    c.beginPath();
    c.moveTo(x - W, y);
    c.lineTo(x - W * 0.1, y - H);
    c.lineTo(x + W, y);
    c.closePath();
    c.fill();
    c.fillStyle = "#857b70";
    c.beginPath();
    c.moveTo(x - W, y);
    c.lineTo(x - W * 0.1, y - H);
    c.lineTo(x - W * 0.05, y);
    c.closePath();
    c.fill();
    c.fillStyle = "#f4f6fb";
    c.beginPath();
    c.moveTo(x - W * 0.32, y - H * 0.7);
    c.lineTo(x - W * 0.1, y - H);
    c.lineTo(x + W * 0.25, y - H * 0.68);
    c.lineTo(x + W * 0.05, y - H * 0.75);
    c.lineTo(x - W * 0.1, y - H * 0.66);
    c.closePath();
    c.fill();
  }

  /* ----------------------------- ground FX ----------------------------- */

  private groundFx(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number, z: number) {
    const w = this.world;
    const t = this.t;
    const tx0 = Math.max(0, Math.floor(vx0 / TILE));
    const ty0 = Math.max(0, Math.floor(vy0 / TILE));
    const tx1 = Math.min(MAP_W - 1, Math.ceil(vx1 / TILE));
    const ty1 = Math.min(MAP_H - 1, Math.ceil(vy1 / TILE));
    const night = 1 - w.daylight;
    const terr = this.terrainR;
    const detail = z > 0.45;

    // water: shimmer, shoreline foam, flowing river, night stars
    let water = 0;
    let total = 0;
    const cx0 = Math.floor(tx0 / CHUNK_TILES);
    const cx1 = Math.floor(tx1 / CHUNK_TILES);
    const cy0 = Math.floor(ty0 / CHUNK_TILES);
    const cy1 = Math.floor(ty1 / CHUNK_TILES);
    c.lineWidth = 1.4;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const list = terr.waterTiles[cy * CHUNKS_X + cx];
        if (!list) continue;
        total += CHUNK_TILES * CHUNK_TILES;
        for (const i of list) {
          const x = i % MAP_W;
          const y = (i - x) / MAP_W;
          if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
          water++;
          if (!detail) continue;
          const hsh = hash2(x, y, 5);
          const px = x * TILE;
          const py = y * TILE;
          const tile = w.terrain.tiles[i];
          if (tile === T.River) {
            const off = (t * 30 + hsh * TILE) % TILE;
            c.strokeStyle = "rgba(255,255,255,0.22)";
            c.beginPath();
            c.moveTo(px + hsh * 20 + 4, py + off);
            c.lineTo(px + hsh * 20 + 4, py + off + 7);
            c.stroke();
          } else if (hsh < 0.3) {
            const a = (Math.sin(t * 1.5 + hsh * 20) + 1) / 2;
            c.strokeStyle = `rgba(255,255,255,${0.08 + a * 0.16})`;
            c.beginPath();
            const yy = py + 10 + hsh * 12;
            c.moveTo(px + 6, yy);
            c.quadraticCurveTo(px + 16, yy - 3 - a * 2, px + 26, yy);
            c.stroke();
          }
          if (night > 0.4 && hsh > 0.93) {
            const tw = (Math.sin(t * 3 + hsh * 50) + 1) / 2;
            c.fillStyle = `rgba(255,255,240,${(night - 0.4) * 1.2 * tw})`;
            c.fillRect(px + hsh * 30, py + hsh * 20, 1.6, 1.6);
          }
        }
        // gentle lapping: foam brightens + fades along the shore
        const shore = terr.shoreTiles[cy * CHUNKS_X + cx];
        if (detail && shore) {
          c.fillStyle = "#ffffff";
          for (const i of shore) {
            const x = i % MAP_W;
            const y = (i - x) / MAP_W;
            if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
            const ph = Math.sin(t * 1.4 + hash2(x, y, 9) * 6.28);
            if (ph < 0.2) continue;
            c.globalAlpha = (ph - 0.2) * (0.16 + w.weather.storm * 0.2);
            c.beginPath();
            c.ellipse(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE * 0.62, TILE * 0.5, 0, 0, Math.PI * 2);
            c.fill();
          }
          c.globalAlpha = 1;
        }
      }
    }
    this.waterInView = total ? water / total : 0;

    // moon glinting on the lake at night
    if (night > 0.3) {
      const lx = 76 * TILE;
      const ly = 54 * TILE;
      c.globalAlpha = (night - 0.3) * 0.6;
      c.drawImage(this.cloudSprite, lx - 80, ly - 30, 160, 60);
      c.globalAlpha = 1;
    }

    // waterfall: one band per cliff row the river pours over
    const rows = new Map<number, [number, number]>();
    for (const i of terr.waterfallTiles) {
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      if (x < tx0 - 3 || x > tx1 + 3 || y < ty0 - 3 || y > ty1 + 3) continue;
      const r = rows.get(y);
      rows.set(y, r ? [Math.min(r[0], x), Math.max(r[1], x)] : [x, x]);
    }
    rows.forEach(([a, b], y) => {
      const x0 = a * TILE + 4;
      const x1 = (b + 1) * TILE - 4;
      const top = y * TILE + 2;
      const bot = (y + 1) * TILE + 10;
      const g = c.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, "rgba(120,190,225,0.95)");
      g.addColorStop(0.6, "rgba(190,230,250,0.95)");
      g.addColorStop(1, "rgba(240,250,255,0.9)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x0, top);
      c.lineTo(x1, top);
      c.quadraticCurveTo(x1 + 4, (top + bot) / 2, x1 + 2, bot);
      c.lineTo(x0 - 2, bot);
      c.quadraticCurveTo(x0 - 4, (top + bot) / 2, x0, top);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.75)";
      c.lineWidth = 1.6;
      c.beginPath();
      for (let k = x0 + 4; k < x1 - 2; k += 7) {
        const off = (t * 70 + hash2(k, y, 2) * 40) % (bot - top);
        c.moveTo(k, top + off);
        c.lineTo(k + 0.5, Math.min(bot, top + off + 9));
      }
      c.stroke();
      // churning foam at the bottom
      c.fillStyle = "rgba(255,255,255,0.85)";
      for (let k = x0; k <= x1; k += 9) {
        const r = 5 + Math.sin(t * 6 + k) * 2;
        c.beginPath();
        c.arc(k, bot + 1, r, 0, Math.PI * 2);
        c.fill();
      }
      if (Math.random() < 0.5 && w.particles.active < 1000) w.particles.spawn(P.Splash, x0 + Math.random() * (x1 - x0), bot, { z: 2, vz: 40 + Math.random() * 40, vx: (Math.random() - 0.5) * 40, g: 140, size: 2, max: 0.7 });
      if (Math.random() < 0.15) w.particles.spawn(P.Steam, x0 + Math.random() * (x1 - x0), bot + 6, { vz: 8, size: 16, max: 1.8, color: "rgba(255,255,255,0.3)" });
    });

    // scorched ground
    c.fillStyle = "#2c2622";
    w.fire.scorched.forEach((i) => {
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      if (x < tx0 || x > tx1 || y < ty0 || y > ty1) return;
      c.globalAlpha = w.fire.burnt[i] * 0.42;
      c.beginPath();
      c.ellipse(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE * 0.7, TILE * 0.6, 0, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;

    this.drawLava(c);

    // puddles after rain
    const wet = w.weather.wet;
    if (wet > 0.25 && detail) {
      for (let y = ty0; y <= ty1; y++) {
        for (let x = tx0; x <= tx1; x++) {
          const hsh = hash2(x, y, 77);
          if (hsh > (wet - 0.25) * 0.25) continue;
          const tile = w.terrain.tiles[y * MAP_W + x];
          if (tile !== T.Grass && tile !== T.Dirt && tile !== T.Sand && tile !== T.Nest && tile !== T.Rock) continue;
          const px = x * TILE + hash2(x, y, 78) * TILE;
          const py = y * TILE + hash2(x, y, 79) * TILE;
          c.fillStyle = "rgba(90,120,140,0.45)";
          c.beginPath();
          c.ellipse(px, py, 8 + hsh * 40, 4 + hsh * 18, 0, 0, Math.PI * 2);
          c.fill();
          if (w.weather.rain > 0.2) {
            const rr = ((t * 2 + hsh * 10) % 1) * 7;
            c.strokeStyle = `rgba(255,255,255,${0.5 - rr / 14})`;
            c.lineWidth = 0.8;
            c.beginPath();
            c.ellipse(px, py, rr, rr * 0.5, 0, 0, Math.PI * 2);
            c.stroke();
          }
        }
      }
    }
    void WORLD_W;
    void WORLD_H;
  }

  private lavaCv: HTMLCanvasElement | null = null;

  /** Molten rock: the heat grid sampled bilinearly + animated noise, painted at 3px/tile and upscaled. */
  private drawLava(c: CanvasRenderingContext2D) {
    const lava = this.world.lava;
    if (!lava.active.size) return;
    const R = 4;
    if (!this.lavaCv) {
      this.lavaCv = document.createElement("canvas");
      this.lavaCv.width = MAP_W * R;
      this.lavaCv.height = MAP_H * R;
    }
    let x0 = MAP_W;
    let y0 = MAP_H;
    let x1 = 0;
    let y1 = 0;
    lava.active.forEach((i) => {
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    });
    x0 = Math.max(0, x0 - 1);
    y0 = Math.max(0, y0 - 1);
    x1 = Math.min(MAP_W - 1, x1 + 1);
    y1 = Math.min(MAP_H - 1, y1 + 1);
    const w = (x1 - x0 + 1) * R;
    const h = (y1 - y0 + 1) * R;
    const lc = this.lavaCv.getContext("2d")!;
    const img = lc.createImageData(w, h);
    const d = img.data;
    const heat = lava.heat;
    const H = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? 0 : Math.min(1.1, heat[y * MAP_W + x]));
    const t = this.t;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const fx = x0 + (px + 0.5) / R - 0.5;
        const fy = y0 + (py + 0.5) / R - 0.5;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const ax = fx - ix;
        const ay = fy - iy;
        const v0 = H(ix, iy) * (1 - ax) * (1 - ay) + H(ix + 1, iy) * ax * (1 - ay) + H(ix, iy + 1) * (1 - ax) * ay + H(ix + 1, iy + 1) * ax * ay;
        if (v0 < 0.05) continue;
        const n = valueNoise(fx * 1.4 - t * 0.25, fy * 1.4 + t * 0.12, 7);
        const n2 = valueNoise(fx * 4, fy * 4, 9);
        const v = v0 * 1.3 + (n - 0.5) * 0.5;
        if (v < 0.22) continue;
        const o = (py * w + px) * 4;
        // cooling crust shows up as dark plates over the glow
        const crust = v0 < 0.55 && n2 > 0.35 + v0 * 0.5;
        let r: number, g: number, b: number;
        if (crust) {
          r = 58 + n2 * 30;
          g = 34 + n2 * 14;
          b = 28;
        } else if (v > 1.2) {
          // bright veins where the flow is hottest
          r = 255;
          g = 200 + Math.min(45, (v - 1.2) * 200);
          b = 90;
        } else if (v > 0.7) {
          r = 250;
          g = 95 + (v - 0.7) * 200;
          b = 25;
        } else {
          r = 150 + (v - 0.22) * 200;
          g = 32 + (v - 0.22) * 120;
          b = 20;
        }
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
        d[o + 3] = Math.min(255, (v - 0.22) * 520);
      }
    }
    lc.clearRect(x0 * R, y0 * R, w, h);
    lc.putImageData(img, x0 * R, y0 * R);
    c.imageSmoothingEnabled = true;
    // soft heat glow under the flow
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = 0.35;
    c.drawImage(this.lavaCv, x0 * R, y0 * R, w, h, x0 * TILE - 10, y0 * TILE - 10, (x1 - x0 + 1) * TILE + 20, (y1 - y0 + 1) * TILE + 20);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.drawImage(this.lavaCv, x0 * R, y0 * R, w, h, x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
  }

  /* ----------------------------- particles ----------------------------- */

  private drawParticles(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const pool = this.world.particles.pool;
    let additive = false;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.on || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 + 300) continue;
      const k = p.life / p.max;
      const glow = p.k === P.Ember || p.k === P.Spark || p.k === P.Firefly;
      if (glow !== additive) {
        c.globalCompositeOperation = glow ? "lighter" : "source-over";
        additive = glow;
      }
      this.particle(c, p, k);
    }
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
  }

  private particle(c: CanvasRenderingContext2D, p: Particle, k: number) {
    const x = p.x;
    const y = p.y - p.z;
    switch (p.k) {
      case P.Dust:
      case P.Smoke:
      case P.Steam:
      case P.Poof: {
        const grow = p.k === P.Poof ? 1 + (1 - k) * 1.2 : 1 + (1 - k) * 1.6;
        c.globalAlpha = k * (p.k === P.Poof ? 1 : 0.9);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(x, y, p.size * grow, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case P.Ember:
      case P.Spark:
        c.globalAlpha = k;
        c.fillStyle = p.color;
        c.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
        break;
      case P.Firefly: {
        const a = (Math.sin(this.t * 5 + p.rot * 10) + 1) / 2;
        c.globalAlpha = a * Math.min(1, k * 3);
        c.fillStyle = "#e9ff8a";
        c.beginPath();
        c.arc(x + Math.sin(this.t + p.rot) * 6, y + Math.cos(this.t * 1.3 + p.rot) * 4, 1.8, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case P.Splash:
      case P.Drop:
        c.globalAlpha = Math.min(1, k * 1.5);
        c.fillStyle = "rgba(220,240,255,0.9)";
        c.beginPath();
        c.arc(x, y, p.size, 0, Math.PI * 2);
        c.fill();
        break;
      case P.Mud:
      case P.Crumb:
      case P.Rock:
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = p.k === P.Mud ? p.color === "#fff" ? "#6b4a2a" : p.color : p.color;
        c.beginPath();
        c.arc(x, y, p.size, 0, Math.PI * 2);
        c.fill();
        break;
      case P.Leaf:
      case P.Ash:
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = p.color;
        c.save();
        c.translate(x, y);
        c.rotate(p.rot + this.t * 3);
        c.beginPath();
        c.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
        if (p.z > 0 && p.g === 0) p.z = Math.max(0, p.z - 0.4);
        break;
      case P.Ripple:
      case P.Ring: {
        const r = p.size * (1 + (1 - k) * (p.k === P.Ring ? 6 : 2.5));
        c.globalAlpha = k;
        c.strokeStyle = p.k === P.Ring ? p.color : "rgba(255,255,255,0.8)";
        c.lineWidth = p.k === P.Ring ? 3 : 1.2;
        c.beginPath();
        c.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
        c.stroke();
        break;
      }
      case P.Star: {
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = "#ffe14a";
        c.font = `${p.size * 1.6}px sans-serif`;
        c.textAlign = "center";
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + (i * Math.PI * 2) / 3;
          c.fillText("★", x + Math.cos(a) * p.size * 2, y + Math.sin(a) * p.size * 0.7);
        }
        break;
      }
      case P.Heart:
        c.globalAlpha = Math.min(1, k * 2);
        c.font = `${p.size * 2}px sans-serif`;
        c.textAlign = "center";
        c.fillText("💗", x, y);
        break;
      case P.Note:
        c.globalAlpha = Math.min(1, k * 1.5);
        c.fillStyle = "#e9f1ff";
        c.font = `bold ${p.size * (1.6 - k * 0.6)}px sans-serif`;
        c.textAlign = "center";
        c.fillText(p.color === "z" ? "z" : "♪", x, y);
        break;
    }
  }

  /* ----------------------------- sky + weather ----------------------------- */

  private skyWorld(c: CanvasRenderingContext2D, v: { x0: number; y0: number; x1: number; y1: number }, z: number) {
    const w = this.world;
    const wt = w.weather;
    this.cloudX += wt.windX * 0.016 * 4;
    this.cloudY += wt.windY * 0.016 * 4;
    const n = Math.round(4 + wt.cloud * 22);
    // cloud shadows drifting over the ground
    c.globalAlpha = 0.12 + wt.cloud * 0.12;
    for (let i = 0; i < n; i++) {
      const bx = ((hash2(i, 1, 9) * WORLD_W + this.cloudX * (0.8 + hash2(i, 2, 9) * 0.4)) % WORLD_W + WORLD_W) % WORLD_W;
      const by = ((hash2(i, 3, 9) * WORLD_H + this.cloudY) % WORLD_H + WORLD_H) % WORLD_H;
      const s = 260 + hash2(i, 4, 9) * 380;
      if (bx + s < v.x0 || bx - s > v.x1 || by + s < v.y0 || by - s > v.y1) continue;
      c.drawImage(this.shadowSprite, bx - s, by - s * 0.5, s * 2, s);
    }
    // the clouds themselves when zoomed out
    if (z < 0.85) {
      const a = (0.85 - z) * (0.4 + wt.cloud * 0.6);
      for (let i = 0; i < n; i++) {
        const bx = ((hash2(i, 1, 9) * WORLD_W + this.cloudX * (0.8 + hash2(i, 2, 9) * 0.4)) % WORLD_W + WORLD_W) % WORLD_W;
        const by = ((hash2(i, 3, 9) * WORLD_H + this.cloudY) % WORLD_H + WORLD_H) % WORLD_H - 300;
        const s = 200 + hash2(i, 4, 9) * 300;
        if (bx + s < v.x0 || bx - s > v.x1 || by + s < v.y0 || by - s > v.y1) continue;
        const grey = wt.storm > 0.3 ? 0.6 : 1;
        c.globalAlpha = a * grey;
        for (let k = 0; k < 4; k++) c.drawImage(this.cloudSprite, bx - s + k * s * 0.4, by - s * 0.35 - (k % 2) * s * 0.15, s * 1.1, s * 0.7);
      }
    }
    c.globalAlpha = 1;
    // fireflies at night (cosmetic)
    if (w.daylight < 0.25 && Math.random() < 0.4 && w.particles.active < 900) {
      const x = v.x0 + Math.random() * (v.x1 - v.x0);
      const y = v.y0 + Math.random() * (v.y1 - v.y0);
      const t = w.terrain.tileAt(x, y);
      if (t === T.Jungle || t === T.Forest || t === T.Swamp || t === T.Grass) w.particles.spawn(P.Firefly, x, y, { z: 10 + Math.random() * 30, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 6, max: 4 + Math.random() * 4, size: 2 });
    }
    // falling ash when the volcano has been busy
    if (w.volcano.ash > 0.15 && Math.random() < w.volcano.ash) {
      w.particles.spawn(P.Ash, v.x0 + Math.random() * (v.x1 - v.x0), v.y0 + Math.random() * (v.y1 - v.y0), { z: 120, vz: -30, vx: wt.windX * 3, size: 2, max: 4, color: "rgba(90,85,80,0.8)" });
    }
  }

  private drawBolt(c: CanvasRenderingContext2D, x: number, y: number, seed: number, a: number) {
    let px = x + ((seed % 100) - 50) * 3;
    let py = y - 900;
    c.strokeStyle = `rgba(210,225,255,${a})`;
    c.lineWidth = 6;
    c.shadowColor = "rgba(150,180,255,0.9)";
    c.shadowBlur = 20;
    c.beginPath();
    c.moveTo(px, py);
    for (let i = 1; i <= 12; i++) {
      const k = i / 12;
      px = x + ((seed % 100) - 50) * 3 * (1 - k) + (hash2(seed, i, 1) - 0.5) * 60 * (1 - k * 0.5);
      py = y - 900 + 900 * k;
      c.lineTo(px, py);
    }
    c.stroke();
    c.strokeStyle = `rgba(255,255,255,${a})`;
    c.lineWidth = 2.5;
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = `rgba(255,255,240,${a * 0.6})`;
    c.beginPath();
    c.ellipse(x, y, 40, 16, 0, 0, Math.PI * 2);
    c.fill();
  }

  private drawMeteor(c: CanvasRenderingContext2D, x: number, y: number, k: number) {
    // warning ring on the ground
    c.strokeStyle = `rgba(255,80,40,${0.4 + Math.sin(this.t * 12) * 0.3})`;
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(x, y, 90 * (1.2 - k * 0.6), 34 * (1.2 - k * 0.6), 0, 0, Math.PI * 2);
    c.stroke();
    const mx = x + (1 - k) * 900;
    const my = y - (1 - k) * 1300;
    const g = c.createLinearGradient(mx, my, mx + 260, my - 380);
    g.addColorStop(0, "rgba(255,240,180,0.95)");
    g.addColorStop(0.3, "rgba(255,140,50,0.7)");
    g.addColorStop(1, "rgba(255,80,20,0)");
    c.strokeStyle = g;
    c.lineCap = "round";
    c.lineWidth = 26;
    c.beginPath();
    c.moveTo(mx, my);
    c.lineTo(mx + 260, my - 380);
    c.stroke();
    c.fillStyle = "#fff6d8";
    c.beginPath();
    c.arc(mx, my, 16, 0, Math.PI * 2);
    c.fill();
  }

  private lighting(c: CanvasRenderingContext2D, cam: Camera) {
    const w = this.world;
    const night = 1 - w.daylight;
    const dusk = w.time > 16.5 && w.time < 21 ? Math.max(0, 1 - Math.abs(w.time - 19) / 2) : w.time > 4.5 && w.time < 8 ? Math.max(0, 1 - Math.abs(w.time - 6) / 1.5) : 0;
    const dark = Math.min(0.78, night * 0.66 + w.weather.storm * 0.28 + w.weather.cloud * 0.06 + w.volcano.ash * 0.3 + w.weather.rain * 0.08);
    // warm sunrise / sunset wash
    if (dusk > 0.02) {
      c.fillStyle = `rgba(255,120,60,${dusk * 0.16})`;
      c.fillRect(0, 0, this.w, this.h);
    }
    if (w.weather.temp > 0.8) {
      c.fillStyle = `rgba(255,190,80,${(w.weather.temp - 0.8) * 0.5})`;
      c.fillRect(0, 0, this.w, this.h);
    }
    if (dark < 0.03) return;
    const L = this.lctx;
    const lw = this.light.width;
    const lh = this.light.height;
    const ash = w.volcano.ash;
    const k = dark / 0.78;
    // the tint we multiply the world by: white → moonlit blue (or ashy brown)
    const nr = 62 + ash * 60 + w.weather.storm * 20;
    const ng = 84 + ash * 20 + w.weather.storm * 20;
    const nb = 158 - ash * 60;
    const mr = Math.round(255 + (nr - 255) * k);
    const mg = Math.round(255 + (ng - 255) * k);
    const mb = Math.round(255 + (nb - 255) * k);
    L.globalCompositeOperation = "source-over";
    L.globalAlpha = 1;
    L.fillStyle = `rgb(${mr},${mg},${mb})`;
    L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = "lighter";
    const lights: [number, number, number, number][] = [];
    const z = cam.zoom;
    const add = (wx: number, wy: number, rad: number, a: number) => {
      const sx = ((wx - cam.x) * z + this.w / 2) / 2;
      const sy = ((wy - cam.y) * z + this.h / 2) / 2;
      const rr = (rad * z) / 2;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > lw || sy - rr > lh) return;
      lights.push([sx, sy, rr, a]);
    };
    for (const f of w.campfires) if (f.lit) add(f.x, f.y - 10, 240 + Math.sin(this.t * 9) * 8, 1);
    let n = 0;
    w.fire.active.forEach((i) => {
      if (n++ % 3) return;
      add((i % MAP_W) * TILE + 16, Math.floor(i / MAP_W) * TILE + 10, 170, 0.8);
    });
    n = 0;
    w.lava.active.forEach((i) => {
      if (n++ % 4) return;
      add((i % MAP_W) * TILE + 16, Math.floor(i / MAP_W) * TILE + 16, 150, 0.7 * Math.min(1, w.lava.heat[i]));
    });
    add(w.volcano.x, w.volcano.y - 150, 160 + w.volcano.glow * 240, 0.4 + w.volcano.glow * 0.5);
    for (const s of w.shelters) if (s.stage >= 2) add(s.x, s.y - 8, 80, 0.6);
    for (const m of w.meteors) add(m.x + (1 - m.t / m.dur) * 900, m.y - (1 - m.t / m.dur) * 1300, 300, 1);
    for (const b of w.bolts) add(b.x, b.y, 900, 1 - b.t / 0.6);
    for (const [sx, sy, rr, a] of lights) {
      L.globalAlpha = a;
      L.drawImage(this.warmLight, sx - rr, sy - rr, rr * 2, rr * 2);
    }
    L.globalAlpha = 1;
    L.globalCompositeOperation = "source-over";
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = "multiply";
    c.drawImage(this.light, 0, 0, this.w, this.h);
    // shift hues toward moonlight blue (fires keep their warmth via the glow pass below)
    if (night > 0.2) {
      c.globalCompositeOperation = "color";
      c.globalAlpha = Math.min(0.32, (night - 0.2) * 0.45) * (1 - ash);
      c.fillStyle = "#30508f";
      c.fillRect(0, 0, this.w, this.h);
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = "source-over";
    // warm additive glow around fire sources
    c.globalCompositeOperation = "lighter";
    for (const [sx, sy, rr, a] of lights) {
      c.globalAlpha = a * dark * 0.55;
      c.drawImage(this.warmSprite, sx * 2 - rr * 1.2, sy * 2 - rr * 1.2, rr * 2.4, rr * 2.4);
    }
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
  }

  private screenWeather(c: CanvasRenderingContext2D, dt: number) {
    const w = this.world;
    const wt = w.weather;
    // rain streaks
    const want = Math.round(wt.rain * 420 * Math.min(1, w.particles.budget + 0.3));
    while (this.drops.length < want) this.drops.push({ x: Math.random() * this.w, y: Math.random() * this.h, s: 700 + Math.random() * 500, l: 10 + Math.random() * 12 });
    if (this.drops.length > want) this.drops.length = want;
    if (this.drops.length) {
      const slant = wt.windX * 18;
      c.strokeStyle = wt.storm > 0.5 ? "rgba(200,215,240,0.5)" : "rgba(200,220,255,0.42)";
      c.lineWidth = 1.2;
      c.beginPath();
      for (const d of this.drops) {
        d.y += d.s * dt;
        d.x += slant * dt * 6;
        if (d.y > this.h) {
          d.y = -20;
          d.x = Math.random() * (this.w + 200) - 100;
        }
        if (d.x > this.w + 50) d.x -= this.w + 100;
        if (d.x < -50) d.x += this.w + 100;
        c.moveTo(d.x, d.y);
        c.lineTo(d.x + slant * 0.04 * d.l, d.y + d.l);
      }
      c.stroke();
    }
    // fog banks
    if (wt.fog > 0.02) {
      c.fillStyle = `rgba(225,230,235,${wt.fog * 0.35})`;
      c.fillRect(0, 0, this.w, this.h);
      c.globalAlpha = wt.fog * 0.6;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 337 + this.t * (14 + i * 3)) % (this.w + 600)) - 300;
        const y = (i / 7) * this.h + Math.sin(this.t * 0.2 + i) * 30;
        c.drawImage(this.cloudSprite, x - 300, y - 120, 700, 260);
      }
      c.globalAlpha = 1;
    }
    // volcanic haze
    if (w.volcano.ash > 0.02) {
      c.fillStyle = `rgba(110,90,70,${w.volcano.ash * 0.22})`;
      c.fillRect(0, 0, this.w, this.h);
    }
    // rainbow
    if (wt.rainbow > 0.01 && w.daylight > 0.4) {
      const cols = ["#ff4b4b", "#ff9f3b", "#ffe14a", "#5fd35f", "#4ba8ff", "#8a63ff"];
      c.globalAlpha = Math.min(1, wt.rainbow * 1.5) * 0.16;
      c.lineWidth = Math.max(5, this.h * 0.012);
      for (let i = 0; i < cols.length; i++) {
        c.strokeStyle = cols[i];
        c.beginPath();
        c.arc(this.w * 0.62, this.h * 0.95, this.h * 0.8 - i * c.lineWidth, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    // shooting stars
    for (const s of w.randomEvents.stars) {
      const k = s.t / 1.6;
      const x = this.w * (0.1 + s.a * 0.6) + k * this.w * 0.35;
      const y = this.h * (0.05 + s.b * 0.2) + k * this.h * 0.2;
      const g = c.createLinearGradient(x, y, x - 120, y - 70);
      g.addColorStop(0, `rgba(255,255,255,${1 - k})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.strokeStyle = g;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 120, y - 70);
      c.stroke();
    }
    // a soft vignette keeps the eye in the middle
    const vg = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.22)");
    c.fillStyle = vg;
    c.fillRect(0, 0, this.w, this.h);
  }

  /* ----------------------------- UI overlays ----------------------------- */

  private overlays(c: CanvasRenderingContext2D, ov: Overlay, x0: number, y0: number, x1: number, y1: number, z: number) {
    const w = this.world;
    const inv = 1 / Math.max(0.35, z);
    // emotes over dinos
    for (const dn of w.dinos) {
      if (!dn.emote || dn.x < x0 || dn.x > x1 || dn.y < y0 || dn.y > y1) continue;
      const L = sizeOf(dn);
      const k = Math.min(1, dn.emote.t * 3);
      const hy = dn.y - dn.z - L * (sp(dn.species).plan === "sauropod" ? 0.85 : 0.6) - 10 - (1 - k) * 8;
      this.bubbleIcon(c, dn.x + dn.dir * L * 0.2, hy, dn.emote.icon, inv * 0.9, k);
    }
    // speech bubbles over people
    c.textAlign = "center";
    for (const h of w.humans) {
      if (!h.bubble || h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1 || this.hidden(h)) continue;
      const k = Math.min(1, h.bubble.t * 3);
      this.speech(c, h.x, h.y - h.z - 34, h.bubble.text, inv, k);
    }
    // crafting progress
    const cr = w.camp.crafting;
    if (cr) {
      const steps = CRAFT_STEPS[cr.tech];
      const prog = Math.min(1, cr.t / cr.dur);
      const step = steps[Math.min(steps.length - 1, Math.floor(prog * steps.length))];
      const x = w.camp.craftX;
      const y = w.camp.craftY - 46;
      c.strokeStyle = "rgba(255,255,255,0.35)";
      c.lineWidth = 4 * inv;
      c.beginPath();
      c.arc(x, y, 12 * inv, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "#ffd447";
      c.beginPath();
      c.arc(x, y, 12 * inv, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      c.stroke();
      this.speech(c, x, y - 18 * inv, step, inv, 1);
    }
    // names over the selected / followed dino
    const sel = w.dinoById(ov.selectedId) ?? w.dinoById(ov.followId);
    if (sel) {
      const L = sizeOf(sel);
      c.font = `700 ${12 * inv}px ui-rounded, system-ui, sans-serif`;
      const label = `${sel.name}${isBaby(sel) ? " (baby)" : ""}`;
      const tw = c.measureText(label).width;
      const lx = sel.x;
      const ly = sel.y - sel.z - L * 0.75 - 24 * inv;
      c.fillStyle = "rgba(15,23,42,0.75)";
      this.roundRect(c, lx - tw / 2 - 8 * inv, ly - 12 * inv, tw + 16 * inv, 18 * inv, 9 * inv);
      c.fill();
      c.fillStyle = "#fff";
      c.fillText(label, lx, ly + 2 * inv);
    }
    // tool preview
    if (ov.hover) {
      const { x, y, icon, radius } = ov.hover;
      c.strokeStyle = "rgba(255,255,255,0.85)";
      c.lineWidth = 2 * inv;
      c.setLineDash([5 * inv, 4 * inv]);
      c.beginPath();
      c.ellipse(x, y, radius, radius * 0.5, 0, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 0.85;
      c.font = `${26 * inv}px sans-serif`;
      c.textAlign = "center";
      c.fillText(icon, x, y - 10 * inv);
      c.globalAlpha = 1;
    }
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private bubbleIcon(c: CanvasRenderingContext2D, x: number, y: number, icon: string, s: number, k: number) {
    c.globalAlpha = k;
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.beginPath();
    c.arc(x, y, 13 * s, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(x - 4 * s, y + 10 * s);
    c.lineTo(x, y + 18 * s);
    c.lineTo(x + 4 * s, y + 10 * s);
    c.fill();
    c.font = `${16 * s}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(icon, x, y + 1 * s);
    c.textBaseline = "alphabetic";
    c.globalAlpha = 1;
  }

  private speech(c: CanvasRenderingContext2D, x: number, y: number, text: string, s: number, k: number) {
    c.globalAlpha = k;
    c.font = `700 ${11 * s}px ui-rounded, system-ui, sans-serif`;
    const tw = c.measureText(text).width;
    c.fillStyle = "rgba(255,255,255,0.95)";
    this.roundRect(c, x - tw / 2 - 7 * s, y - 12 * s, tw + 14 * s, 18 * s, 8 * s);
    c.fill();
    c.beginPath();
    c.moveTo(x - 4 * s, y + 5 * s);
    c.lineTo(x, y + 11 * s);
    c.lineTo(x + 4 * s, y + 5 * s);
    c.fill();
    c.fillStyle = "#1f2937";
    c.textAlign = "center";
    c.fillText(text, x, y + 1.5 * s);
    c.globalAlpha = 1;
  }
}

/** Paint one species portrait into a small canvas (UI toy box + info card). */
export function paintPortrait(cv: HTMLCanvasElement, speciesId: Parameters<typeof sp>[0], opts: { baby?: boolean; t?: number } = {}) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const def = sp(speciesId);
  const W = cv.width;
  const H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const pose = restPose();
  pose.t = opts.t ?? 0;
  pose.baby = opts.baby ? 0.8 : 0;
  pose.flying = def.move === "fly";
  pose.wing = 1.2;
  pose.submerged = def.move === "swim" ? 0 : 1;
  // fit tall sauropods + wide flyers
  const tall = def.plan === "sauropod" ? 1.05 : def.plan === "pterosaur" ? 1.3 : 0.7;
  const L = Math.min(W * 0.78, (H * 0.8) / tall);
  ctx.save();
  ctx.translate(W * (def.plan === "sauropod" ? 0.5 : 0.52), def.move === "fly" ? H * 0.5 : def.move === "swim" ? H * 0.55 : H * 0.88);
  drawDino(ctx, def, L, 1, pose);
  ctx.restore();
}
