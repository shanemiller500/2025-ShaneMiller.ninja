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
import { MAP_H, MAP_W, T, TILE, WORLD_H, WORLD_W, type Dino, type Human, type Plant, type SpeciesDef } from "../sim/types";

/** shade() returns rgb(); species looks want #hex */
function toHex(rgb: string) {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  return "#" + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, "0")).join("");
}
import type { World } from "../sim/world";
import { drawDino, restPose, shade, type DinoPose } from "./drawDino";
import { lookKey } from "../sim/genetics";
import { drawCampfire, drawEgg, drawFarm, drawFish, drawFlame, drawHuman, drawItem, drawPlant, drawProp, drawShelter, drawStockpile, drawVolcano, type WeaponLook } from "./sprites";
import { ROLES } from "../data/facts";
import { BUILDINGS, HOUSING } from "../data/colony";
import { drawBar, drawBones, drawBuilding, drawDragon, drawHome, drawNode, drawScaffold, drawScorpion, drawTower2, drawWall } from "./colonyArt";
import { shelterDone, stagesOf, wallMaxHp } from "../sim/build";
import { BUILD_BY_ID } from "../game/tools";
import { TOWER_Z } from "../sim/nav";
import { condition, CONDITION_LABEL } from "../sim/injury";
import { drawBarricade, drawCarcass, drawSpikes, drawTannery, drawTotem } from "./boneArt";
import { carcassStage, harvested } from "../sim/carcass";
import { HELMET_BY_ID, OUTFIT_BY_ID } from "../data/colony";
import { drawRefinery } from "./metalArt";
import { drawBrute, drawBruteMissile, drawClanCamp } from "./bruteArt";
import { TerrainRenderer } from "./terrainRenderer";
import { drawEruptionColumn, drawGhost, drawPyroclastic } from "./civArt";
import { CIV_KINDS, drawAsteroid, drawBeam, drawBeamBolt, drawChamber, drawCivBuilding, drawLift, drawLiftGhost, drawMegalith, drawPylonLink, drawShieldDome, drawShockwave } from "./civArt";
import { EXT_TIMES } from "../sim/extinction";
import { LIFT } from "../data/civ";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Overlay {
  selectedId: number;
  followId: number;
  selection: number[];
  /** shift-drag box (screen px) */
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  /** what tapping here would make the selected people do */
  hint: { x: number; y: number; icon: string; label: string } | null;
  marker: { x: number; y: number; t: number; icon: string } | null;
  inspect: { kind: string; id: number } | null;
  buildPreview: { x: number; y: number; build: string } | null;
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
const K_WALL = 13;
const K_TOWER = 14;
const K_BUILDING = 15;
const K_SCORPION = 16;
const K_NODE = 17;
const K_DRAGON = 18;
const K_BRUTE = 19;
const K_CLAN = 20;
const K_BMISSILE = 21;

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
  private glowSprite = radial("rgba(95,243,230,0.85)", "rgba(95,243,230,0)");
  private charSprite = sprite(128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(38,32,28,1)");
    g.addColorStop(0.5, "rgba(52,44,36,0.75)");
    g.addColorStop(1, "rgba(60,50,40,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
  private snowSprite = sprite(128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(250,252,255,1)");
    g.addColorStop(0.55, "rgba(240,246,255,0.9)");
    g.addColorStop(1, "rgba(235,242,252,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
  private pose: DinoPose = restPose();
  /** cosmetic gate swing per wall id (eases open / shut) */
  private swing = new Map<number, number>();
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
    this.snowFx(c, v.x0, v.y0, v.x1, v.y1, z);
    this.flatStructures(c, x0, y0, x1, y1);

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
      // up on a wall / tower: draw after the structure underneath; riders after their mount
      list.push({ y: h.level === 1 ? h.y + 44 : h.riding ? h.y + 0.5 : h.y, k: K_HUMAN, i });
    }
    const col = w.colony;
    for (let i = 0; i < col.buildings.length; i++) {
      const b = col.buildings[i];
      if (b.kind === "path" || b.kind === "bridge" || b.kind === "pen" || b.kind === "trap") continue;
      if (b.x > x0 - 80 && b.x < x1 + 80 && b.y > y0 && b.y < y1 + 80) list.push({ y: b.y - 1, k: K_BUILDING, i });
    }
    for (let i = 0; i < col.scorpions.length; i++) {
      const s = col.scorpions[i];
      if (s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1 + 80) list.push({ y: s.mount === "ground" ? s.y : s.y + 46, k: K_SCORPION, i });
    }
    for (let i = 0; i < col.nodes.length; i++) {
      const n = col.nodes[i];
      if (n.found && n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) list.push({ y: n.y, k: K_NODE, i });
    }
    for (let i = 0; i < w.dragons.list.length; i++) {
      const dr = w.dragons.list[i];
      if (dr.z <= 6 && dr.x > x0 - 100 && dr.x < x1 + 100 && dr.y > y0 && dr.y < y1 + 100) list.push({ y: dr.y, k: K_DRAGON, i });
    }
    // Neanderthals, their camps and anything they've thrown
    const rv = w.rivals;
    for (let i = 0; i < rv.clans.length; i++) {
      const cl = rv.clans[i];
      if (cl.x > x0 - 160 && cl.x < x1 + 160 && cl.y > y0 - 40 && cl.y < y1 + 100) list.push({ y: cl.y - 40, k: K_CLAN, i });
    }
    for (let i = 0; i < rv.brutes.length; i++) {
      const b = rv.brutes[i];
      if (b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1 + 40) list.push({ y: b.y, k: K_BRUTE, i });
    }
    for (let i = 0; i < rv.missiles.length; i++) {
      const m = rv.missiles[i];
      if (m.x > x0 && m.x < x1 && m.y > y0 && m.y < y1) list.push({ y: m.y, k: K_BMISSILE, i });
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
    const tribe = w.tribe;
    for (let i = 0; i < tribe.walls.length; i++) {
      const wl = tribe.walls[i];
      const wx = wl.tx * TILE + TILE / 2;
      const wy = wl.ty * TILE + TILE;
      if (wx > x0 && wx < x1 && wy > y0 && wy < y1 + 40) list.push({ y: wy - (tribe.walls[i].bone ? 1.5 : 2), k: K_WALL, i });
    }
    for (let i = 0; i < tribe.towers.length; i++) {
      const tw = tribe.towers[i];
      if (tw.x > x0 && tw.x < x1 && tw.y > y0 && tw.y < y1 + 160) list.push({ y: tw.y, k: K_TOWER, i });
    }

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
    for (const dr of w.dragons.list) {
      if (dr.x < x0 - 200 || dr.x > x1 + 200 || dr.y < y0 || dr.y > y1 + 200) continue;
      c.globalAlpha = shadowA * (dr.z > 6 ? 0.45 : 0.8);
      const r = 70 - Math.min(30, dr.z * 0.08);
      c.drawImage(this.shadowSprite, dr.x - r + dr.z * 0.25, dr.y - r * 0.3, r * 2, r * 0.6);
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

    // farm fields
    for (const f of w.tribe.farms) {
      if (f.x < x0 - 60 || f.x > x1 + 60 || f.y < y0 - 40 || f.y > y1 + 40) continue;
      c.save();
      c.translate(f.x, f.y);
      drawFarm(c, f.growth, f.planted, this.t);
      c.restore();
    }

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
    const learned = w.camp.learned;
    const weapon: WeaponLook = learned.has("crossbow") ? "crossbow" : learned.has("bow") ? "bow" : learned.has("spear") ? "spear" : null;
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
          const picked = ov.selection.includes(h.id);
          if (picked || h.id === ov.followId) {
            c.save();
            c.strokeStyle = picked ? "rgba(255,214,80,0.95)" : "rgba(255,255,255,0.8)";
            c.lineWidth = 2;
            c.setLineDash([5, 4]);
            c.lineDashOffset = -this.t * 16;
            c.beginPath();
            c.ellipse(h.x, h.y - h.z + 1, 12, 5, 0, 0, Math.PI * 2);
            c.stroke();
            c.setLineDash([]);
            c.restore();
          }
          c.save();
          c.translate(h.x, h.y - h.z);
          if (h.stranger) c.globalAlpha = 0.85;
          const role = tribe.roleOf(h);
          const wp = !h.child ? tribe.weaponFor(w, h) : null;
          const look: WeaponLook = wp ? (wp.proj === "beam" ? "lance" : wp.kind === "bow" ? (wp.tier >= 3 ? "crossbow" : "bow") : wp.kind) : weapon;
          const helmDef = h.gear.helmet ? HELMET_BY_ID[h.gear.helmet] : null;
          const coat = h.gear.outfit ? OUTFIT_BY_ID[h.gear.outfit] : null;
          drawHuman(c, h, this.t, look, role === "guard" || role === "hunter" || !!h.order || h.taskId > 0 || tribe.raid !== null, h.gear.shield, wp?.tier ?? 1, coat, w.weather.rain, helmDef ? { color: helmDef.color, trim: helmDef.trim, glow: helmDef.glow } : null);
          if (h.state === "down") {
            const a = this.t * 3;
            c.font = "9px sans-serif";
            c.textAlign = "center";
            c.fillText("💫", Math.cos(a) * 6, -10 + Math.sin(a) * 2);
          }
          c.restore();
          break;
        }
        case K_BUILDING: {
          const b = col.buildings[it.i];
          const def = BUILDINGS[b.kind];
          c.save();
          c.translate(b.x, b.y);
          if (b.kind === "spikes") drawSpikes(c, Math.atan2(b.y - (w.camp.y + 30), b.x - w.camp.x), b.built, b.hp / def.hp, b.tx * 7 + b.ty);
          else if (b.kind === "barricade") drawBarricade(c, b.built, b.hp / def.hp);
          else if (b.kind === "totem") drawTotem(c, b.built, this.t);
          else if (b.kind === "tannery") drawTannery(c, def.w * TILE, b.built, w.camp.stock.hide, this.t);
          else if (b.kind === "refinery" && b.built >= 1) drawRefinery(c, def.w * TILE, w.camp.stock, this.t, night > 0.5);
          else if (CIV_KINDS.has(b.kind)) drawCivBuilding(c, b, def.w, def.h, { power: w.civ.energy > 1, night: night > 0.5, storm: w.weather.storm, t: this.t });
          else drawBuilding(c, b, def.w, def.h, night > 0.5, this.t);
          if (b.built < 1 && (b.kind === "spikes" || b.kind === "barricade" || b.kind === "totem" || b.kind === "tannery")) {
            c.strokeStyle = "rgba(255,255,255,0.75)";
            c.setLineDash([4, 3]);
            c.lineWidth = 1.2;
            c.strokeRect(-def.w * 16 + 3, -def.h * 32 + 3, def.w * 32 - 6, def.h * 32 - 6);
            c.setLineDash([]);
          }
          if (b.built >= 1 && b.hp < def.hp * 0.6) this.damageBadge(c, 0, -46);
          c.restore();
          break;
        }
        case K_SCORPION: {
          const s = col.scorpions[it.i];
          c.save();
          const lift = s.mount === "tower" ? TOWER_Z : s.mount === "wall" ? 26 : 0;
          c.translate(s.x, s.y - lift);
          drawScorpion(c, s);
          if (s.drone) {
            // the crystal that powers it, bobbing over the bow
            const bob = Math.sin(this.t * 3 + s.id) * 2;
            c.fillStyle = "#bff6ff";
            c.beginPath();
            c.moveTo(0, -30 + bob);
            c.lineTo(4, -24 + bob);
            c.lineTo(0, -18 + bob);
            c.lineTo(-4, -24 + bob);
            c.closePath();
            c.fill();
            c.strokeStyle = "rgba(150,240,255,0.5)";
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(0, -18 + bob);
            c.lineTo(0, -8);
            c.stroke();
          }
          c.restore();
          break;
        }
        case K_NODE: {
          const n = col.nodes[it.i];
          c.save();
          c.translate(n.x, n.y);
          drawNode(c, n, this.t);
          c.restore();
          break;
        }
        case K_CLAN: {
          const cl = w.rivals.clans[it.i];
          c.save();
          c.translate(cl.x, cl.y);
          drawClanCamp(c, cl, this.t, night > 0.5, w.rivals.members(cl.id).length);
          c.restore();
          break;
        }
        case K_BRUTE: {
          const b = w.rivals.brutes[it.i];
          c.save();
          c.translate(b.x, b.y - b.z);
          drawBrute(c, b, this.t, w.rivals.clan(b.clan)?.color ?? "#c0392b");
          c.restore();
          break;
        }
        case K_BMISSILE: {
          const m = w.rivals.missiles[it.i];
          c.save();
          c.translate(m.x, m.y);
          drawBruteMissile(c, m.kind, m.z, Math.atan2(m.vy - m.vz * 0.6, m.vx));
          c.restore();
          break;
        }
        case K_DRAGON: {
          const dr = w.dragons.list[it.i];
          c.save();
          c.translate(dr.x, dr.y - dr.z);
          drawDragon(c, dr, this.t);
          c.restore();
          break;
        }
        case K_ITEM: {
          const item = w.items[it.i];
          c.save();
          c.translate(item.x, item.y);
          if (item.kind === "carcass" && item.carcass && item.species) {
            const cc = item.carcass;
            const stage = carcassStage(cc);
            if (stage !== "gone") {
              const def = sp(item.species);
              drawCarcass(c, cc.size, cc.dir, { body: def.look.body, belly: def.look.belly, plan: def.plan, carnivore: def.diet !== "herbivore", horned: !!def.shape.horns, plates: !!def.shape.plates, k: harvested(cc), stage, burnt: cc.burnt, rot: cc.rot }, this.t);
            }
          } else if (item.kind === "bones") drawBones(c, item.amount);
          else drawItem(c, item, this.t);
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
          if (p.kind === "chamber") drawChamber(c, this.t, w.civ.path === "none" ? (w.civ.found ? "found" : "hidden") : w.civ.path);
          else if (p.kind === "megalith") drawMegalith(c, p);
          else drawProp(c, p, this.t);
          c.restore();
          break;
        }
        case K_SHELTER: {
          const s = w.shelters[it.i];
          c.save();
          c.translate(s.x, s.y);
          const done = shelterDone(s);
          const inside = done ? w.humans.filter((h) => h.home === s.id && (h.state === "hide" || h.state === "sleep" || h.state === "rest")).length : 0;
          if (!drawHome(c, s, done, night > 0.5, this.t, inside)) {
            if (s.plan === "tent" && !done) {
              // tent going up: dashed footprint, then poles
              c.strokeStyle = "rgba(255,255,255,0.75)";
              c.setLineDash([4, 4]);
              c.lineWidth = 1.5;
              c.beginPath();
              c.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2);
              c.stroke();
              c.setLineDash([]);
              if (s.stage >= 1) {
                c.strokeStyle = "#6b4a2a";
                c.lineWidth = 2.4;
                c.beginPath();
                c.moveTo(-18, 0);
                c.lineTo(3, -38);
                c.moveTo(18, 0);
                c.lineTo(-3, -38);
                c.stroke();
              }
            } else drawShelter(c, { ...s, stage: done ? stagesOf(s).length : s.stage }, night > 0.5);
          }
          if (s.up) drawScaffold(c, Object.values(s.upHave).reduce((a, b) => a + (b ?? 0), 0) / Math.max(1, Object.values(HOUSING[s.tier + 1]?.cost ?? {}).reduce((a, b) => a + (b ?? 0), 0)));
          if (done && s.hp < 0.6) this.damageBadge(c, 0, -60);
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
          if (vo.crack > 0.01) this.volcanoCracks(c, vo.crack);
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
        case K_WALL: {
          const wl = tribe.walls[it.i];
          c.save();
          c.translate(wl.tx * TILE + TILE / 2, wl.ty * TILE + TILE);
          const linked = (dx: number, dy: number) => {
            const o = tribe.wallAt(wl.tx + dx, wl.ty + dy);
            if (o && o.part !== "stairs" && (o.built >= 1) === (wl.built >= 1)) return true;
            // walls join onto towers too
            return tribe.towers.some((t) => wl.tx + dx >= t.tx && wl.tx + dx <= t.tx + 1 && wl.ty + dy >= t.ty && wl.ty + dy <= t.ty + 1 && t.stage > 0);
          };
          const stairsMask = wl.part === "stairs" ? (tribe.wallAt(wl.tx, wl.ty - 1) ? 1 : tribe.wallAt(wl.tx + 1, wl.ty) ? 2 : tribe.wallAt(wl.tx - 1, wl.ty) ? 8 : 4) : 0;
          const mask = wl.part === "stairs" ? stairsMask : (linked(0, -1) ? 1 : 0) | (linked(1, 0) ? 2 : 0) | (linked(0, 1) ? 4 : 0) | (linked(-1, 0) ? 8 : 0);
          let sw = this.swing.get(wl.id) ?? (wl.open ? 1 : 0);
          sw += ((wl.open ? 1 : 0) - sw) * Math.min(1, dt * 4);
          this.swing.set(wl.id, sw);
          drawWall(c, wl, { mask, hpFrac: wl.built >= 1 ? wl.hp / wallMaxHp(wl) : 1, swing: sw, t: this.t });
          if (ov.inspect?.kind === "gate" && ov.inspect.id === wl.id) this.inspectRing(c, 0, -10, 22);
          c.restore();
          break;
        }
        case K_TOWER: {
          const tw = tribe.towers[it.i];
          c.save();
          c.translate(tw.x, tw.y);
          drawTower2(c, tw.stage, tw.hp / 400, this.t, w.camp.learned.has("stonewall"));
          if (ov.inspect?.kind === "tower" && ov.inspect.id === tw.id) this.inspectRing(c, 0, -4, 40);
          c.restore();
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
    for (const dr of w.dragons.list) {
      if (dr.z <= 6 || dr.x < x0 - 200 || dr.x > x1 + 200 || dr.y - dr.z > y1 || dr.y - dr.z < y0 - 260) continue;
      c.save();
      c.translate(dr.x, dr.y - dr.z);
      drawDragon(c, dr, this.t);
      c.restore();
    }

    // carcass ropes + flying arrows / bolts / spears
    for (const it of w.items) {
      if (!it.draggedBy) continue;
      const h = w.humans.find((x) => x.id === it.draggedBy);
      if (!h || h.x < x0 || h.x > x1) continue;
      c.strokeStyle = "#c9a56a";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(h.x - h.dir * 6, h.y - 10);
      c.quadraticCurveTo((h.x + it.x) / 2, (h.y + it.y) / 2 - 2, it.x, it.y - 6);
      c.stroke();
    }
    for (const p of tribe.projectiles) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const sx = p.x;
      const sy = p.y - p.z;
      const ang = Math.atan2(p.vy - p.vz, p.vx);
      if (p.kind === "beam" || p.glow) {
        drawBeamBolt(c, sx, sy, ang);
        if (p.glow) drawBeamBolt(c, sx - Math.cos(ang) * 14, sy - Math.sin(ang) * 14, ang);
        continue;
      }
      const len = p.kind === "spear" ? 22 : p.kind === "scorpion" ? 30 : p.kind === "bolt" ? 13 : 15;
      c.save();
      c.translate(sx, sy);
      c.rotate(ang);
      c.strokeStyle = p.kind === "bolt" || p.kind === "scorpion" ? "#3d2b1c" : "#7a5534";
      c.lineWidth = p.kind === "scorpion" ? 4 : p.kind === "bolt" ? 2.4 : p.kind === "spear" ? 2 : 1.4;
      c.beginPath();
      c.moveTo(-len, 0);
      c.lineTo(0, 0);
      c.stroke();
      c.fillStyle = "#9aa3ad";
      c.beginPath();
      c.moveTo(0, -2.2);
      c.lineTo(5, 0);
      c.lineTo(0, 2.2);
      c.fill();
      if (p.kind !== "spear") {
        c.fillStyle = p.kind === "bolt" ? "#c0392b" : "#f2f2f2";
        c.beginPath();
        c.moveTo(-len, 0);
        c.lineTo(-len - 4, -3);
        c.lineTo(-len + 3, 0);
        c.lineTo(-len - 4, 3);
        c.fill();
      }
      c.restore();
      // ground shadow
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.beginPath();
      c.ellipse(p.x, p.y, 5, 1.6, 0, 0, Math.PI * 2);
      c.fill();
    }

    // civilization effects: pylon barriers, crystal beams, floating blocks
    const civ = w.civ;
    if (civ.path !== "none") {
      for (const [a, b] of civ.pylonLinks(w)) if (a.x > x0 - 300 && a.x < x1 + 300) drawPylonLink(c, a.x, a.y, b.x, b.y, this.t, civ.energy > 0);
    }
    for (const b of civ.beams) drawBeam(c, b);
    for (const l of civ.lifts) drawLift(c, l);
    const ex = w.extinction;
    if (ex.stats?.shieldHeld && (ex.phase === "impact" || ex.phase === "aftermath")) {
      const sh = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
      if (sh) drawShieldDome(c, sh.x, sh.y, 420, this.t, ex.phase === "impact" ? 1 : Math.max(0, 1 - ex.t / EXT_TIMES.aftermath));
    }

    this.drawParticles(c, x0, y0, x1, y1);
    this.skyWorld(c, v, z);
    if (ex.phase === "incoming") drawAsteroid(c, ex.x, ex.y, Math.min(1, ex.t / EXT_TIMES.incoming), this.t);
    const sv = ex.cause === "supervolcano";
    if (ex.phase === "impact" && !sv) drawShockwave(c, ex.x, ex.y, ex.wave, Math.max(0, 1 - ex.t / EXT_TIMES.impact));

    // lightning + meteors
    for (const b of w.bolts) this.drawBolt(c, b.x, b.y, b.seed, 1 - b.t / 0.6);
    for (const m of w.meteors) this.drawMeteor(c, m.x, m.y, m.t / m.dur, m.size ?? 1);

    // screen-space passes
    c.setTransform(d, 0, 0, d, 0, 0);
    this.lighting(c, { x: cx, y: cy, zoom: z });
    this.screenWeather(c, dt);

    // overlays that should stay readable at night
    c.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 - cx * z), d * (this.h / 2 - cy * z));
    this.overlays(c, ov, x0, y0, x1, y1, z);
    // the supervolcano glows through the darkness: drawn after the lighting pass
    const exv = w.extinction;
    if (exv.cause === "supervolcano" && (exv.phase === "impact" || exv.phase === "aftermath")) {
      drawPyroclastic(c, exv.x, exv.y, exv.wave, this.t, exv.phase === "impact" ? 1 : Math.max(0, 1 - exv.t / 6));
      drawEruptionColumn(c, exv.x, exv.y, exv.phase === "impact" ? exv.t / EXT_TIMES.impact : 1, this.t);
    }
    for (const g of exv.ghosts) if (g.x > x0 - 200 && g.x < x1 + 200 && g.y > y0 - 200 && g.y < y1 + 200) drawGhost(c, g);

    c.setTransform(d, 0, 0, d, 0, 0);
    if (ov.flash > 0.01) {
      c.globalAlpha = Math.min(1, ov.flash);
      c.fillStyle = ov.flashColor;
      c.fillRect(0, 0, this.w, this.h);
      c.globalAlpha = 1;
    }
    this.raidArrows({ x: cx, y: cy, zoom: z });
    // shift-drag selection box
    if (ov.box) {
      const b = ov.box;
      c.fillStyle = "rgba(255,214,80,0.12)";
      c.strokeStyle = "rgba(255,214,80,0.9)";
      c.lineWidth = 1.5;
      c.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      c.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
    this.cost = this.cost * 0.92 + (performance.now() - t0) * 0.08;
  }

  hidden(h: Human) {
    if (h.state !== "hide" && h.state !== "sleep" && h.state !== "rest") return false;
    const w = this.world;
    if (Math.hypot(h.x - w.camp.caveX, h.y - w.camp.caveY) < 30) return true;
    if (w.colony.buildings.some((b) => b.kind === "healer" && b.built >= 1 && Math.hypot(h.x - w.colony.door(b).x, h.y - w.colony.door(b).y) < 24)) return true;
    return w.shelters.some((s) => shelterDone(s) && Math.hypot(h.x - s.x, h.y - s.y) < 30);
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

  private looks = new Map<string, SpeciesDef>();

  /** The species' look, tweaked by this individual's genes (colour, mutations). */
  private lookFor(dn: Dino): SpeciesDef {
    const base = sp(dn.species);
    const g = dn.genes;
    if (!g || (Math.abs(g.hue) < 0.13 && !g.mut)) return base;
    const key = `${dn.species}|${lookKey(g)}`;
    const hit = this.looks.get(key);
    if (hit) return hit;
    const k = Math.round(g.hue * 4) / 4;
    const tint = (hex: string) => toHex(shade(hex, k * 0.3));
    let look = { ...base.look, body: tint(base.look.body), belly: tint(base.look.belly) };
    const shape = { ...base.shape };
    switch (g.mut) {
      case "albino":
        look = { ...look, body: "#efe9dd", belly: "#fffaf2", accent: "#e7a9a9" };
        break;
      case "spotted":
        look = { ...look, pattern: "spots", accent: toHex(shade(base.look.body, -0.55)) };
        break;
      case "striped":
        look = { ...look, pattern: "stripes", accent: toHex(shade(base.look.body, -0.6)) };
        break;
      case "glow":
        look = { ...look, accent: "#5ff3e6" };
        break;
      case "crested":
        if (!shape.crest) shape.crest = base.plan === "pterosaur" ? "ptera" : "small";
        if (base.plan === "hadrosaur") shape.crest = "tube";
        look = { ...look, accent: "#e0457b" };
        break;
      case "spiky":
        shape.spikes = true;
        shape.plates = shape.plates || base.plan === "stegosaur";
        if (base.plan === "theropod" || base.plan === "pachy") shape.horns = "carno";
        break;
      case "feathered":
        shape.feathers = true;
        look = { ...look, accent: "#4fa3e0" };
        break;
    }
    const def = { ...base, look, shape };
    this.looks.set(key, def);
    return def;
  }

  private drawDinoAt(c: CanvasRenderingContext2D, dn: Dino, ov: Overlay) {
    const def = this.lookFor(dn);
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
    if (dn.genes?.mut === "glow" && this.world.daylight < 0.5) {
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = (0.5 - this.world.daylight) * (0.8 + Math.sin(this.t * 2 + dn.id) * 0.2);
      c.drawImage(this.glowSprite, -L * 0.7, -L * 0.75, L * 1.4, L * 1.1);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }
    if (dn.raider) {
      // war paint: a pulsing aura under raiders, gold for evolved alphas
      const pulse = 0.55 + Math.sin(this.t * 6 + dn.id) * 0.2;
      c.strokeStyle = dn.tier >= 2 ? `rgba(255,205,60,${pulse})` : dn.tier >= 1 ? `rgba(255,120,40,${pulse})` : `rgba(230,50,50,${pulse})`;
      c.lineWidth = 3 + dn.tier * 1.5;
      c.beginPath();
      c.ellipse(0, dn.z, L * 0.48, L * 0.16, 0, 0, Math.PI * 2);
      c.stroke();
    }
    drawDino(c, def, L, dn.dir, pose);
    if (dn.tier >= 2 || (dn.raider && dn.tier >= 1)) {
      c.font = `${Math.max(14, L * 0.22)}px sans-serif`;
      c.textAlign = "center";
      c.fillText(dn.tier >= 2 ? "👑" : "💢", dn.dir * L * 0.3, -L * (def.plan === "sauropod" ? 0.9 : 0.62) + Math.sin(this.t * 3) * 2);
    }
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

  /** Glowing fractures down the cone (MEGA eruption). */
  private volcanoCracks(c: CanvasRenderingContext2D, k: number) {
    c.save();
    c.globalCompositeOperation = "lighter";
    c.lineCap = "round";
    const lines: [number, number, number][] = [
      [-40, -130, -1],
      [30, -128, 1],
      [-10, -140, -0.3],
      [55, -110, 1.4],
      [-70, -100, -1.4],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [x, y, dir] = lines[i];
      const len = 40 + k * 230;
      const pulse = 0.6 + Math.sin(this.t * 6 + i) * 0.3;
      c.strokeStyle = `rgba(255,${120 + i * 15},40,${Math.min(1, k * 1.4) * pulse})`;
      c.lineWidth = 3 + k * 4;
      c.beginPath();
      c.moveTo(x, y);
      let px = x;
      let py = y;
      for (let s = 1; s <= 6; s++) {
        px += dir * (len / 6) * 0.4 + Math.sin(i * 3 + s) * 8;
        py += len / 6;
        c.lineTo(px, py);
      }
      c.stroke();
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

    // scorched ground: soft overlapping char that blends into one burn scar, grey ash,
    // and green shoots poking through as it heals
    w.fire.scorched.forEach((i) => {
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      if (x < tx0 || x > tx1 || y < ty0 || y > ty1) return;
      const b = w.fire.burnt[i];
      const h = hash2(x, y, 41);
      const cx = x * TILE + TILE / 2 + (h - 0.5) * 8;
      const cy = y * TILE + TILE / 2 + (hash2(y, x, 42) - 0.5) * 8;
      c.globalAlpha = Math.min(0.55, b * 0.55);
      c.drawImage(this.charSprite, cx - TILE * 1.05, cy - TILE * 0.95, TILE * 2.1, TILE * 1.9);
      if (!detail) return;
      if (b > 0.35) {
        c.globalAlpha = Math.min(0.7, b);
        c.fillStyle = "#8d8780";
        for (let k = 0; k < 3; k++) {
          const hx = hash2(x * 3 + k, y, 43);
          const hy = hash2(x, y * 3 + k, 44);
          c.fillRect(x * TILE + hx * TILE, y * TILE + hy * TILE, 2, 1.5);
        }
      } else {
        // healing: little green tufts
        c.globalAlpha = Math.min(0.9, (0.45 - b) * 2.5);
        c.strokeStyle = "#6faa45";
        c.lineWidth = 1.4;
        c.beginPath();
        for (let k = 0; k < 3; k++) {
          const gx = x * TILE + hash2(x * 5 + k, y, 45) * TILE;
          const gy = y * TILE + hash2(x, y * 5 + k, 46) * TILE;
          c.moveTo(gx, gy);
          c.lineTo(gx - 1.5, gy - 4);
          c.moveTo(gx, gy);
          c.lineTo(gx + 1.5, gy - 4);
        }
        c.stroke();
      }
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
        if (p.color === "fly") {
          // a cartoon fly buzzing about
          c.fillStyle = "#1f1a17";
          c.beginPath();
          c.arc(x + Math.sin(this.t * 20 + p.x) * 2, y, 1.4, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "rgba(220,235,255,0.7)";
          c.beginPath();
          c.ellipse(x + Math.sin(this.t * 20 + p.x) * 2, y - 1.6, 1.6, 0.8, 0, 0, Math.PI * 2);
          c.fill();
        } else c.fillText(p.color === "z" ? "z" : "♪", x, y);
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

  private drawMeteor(c: CanvasRenderingContext2D, x: number, y: number, k: number, S = 1) {
    // warning ring on the ground
    if (S > 0.3) {
      c.strokeStyle = `rgba(255,80,40,${0.4 + Math.sin(this.t * 12) * 0.3})`;
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(x, y, 90 * S * (1.2 - k * 0.6), 34 * S * (1.2 - k * 0.6), 0, 0, Math.PI * 2);
      c.stroke();
    }
    const mx = x + (1 - k) * 900;
    const my = y - (1 - k) * 1300;
    const tail = 120 + 140 * S;
    const g = c.createLinearGradient(mx, my, mx + tail, my - tail * 1.46);
    g.addColorStop(0, "rgba(255,240,180,0.95)");
    g.addColorStop(0.3, "rgba(255,140,50,0.7)");
    g.addColorStop(1, "rgba(255,80,20,0)");
    c.strokeStyle = g;
    c.lineCap = "round";
    c.lineWidth = Math.max(5, 26 * S);
    c.beginPath();
    c.moveTo(mx, my);
    c.lineTo(mx + tail, my - tail * 1.46);
    c.stroke();
    c.fillStyle = "#fff6d8";
    c.beginPath();
    c.arc(mx, my, Math.max(4, 16 * S), 0, Math.PI * 2);
    c.fill();
  }

  private lighting(c: CanvasRenderingContext2D, cam: Camera) {
    const w = this.world;
    const night = 1 - w.daylight;
    const dusk = w.time > 16.5 && w.time < 21 ? Math.max(0, 1 - Math.abs(w.time - 19) / 2) : w.time > 4.5 && w.time < 8 ? Math.max(0, 1 - Math.abs(w.time - 6) / 1.5) : 0;
    const dark = Math.min(0.78, night * 0.66 + w.weather.storm * 0.28 + w.weather.cloud * 0.06 + w.volcano.ash * 0.3 + w.weather.rain * 0.08 + w.extinction.ash * 0.35);
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
    for (const s of w.shelters) if (s.stage >= 2) add(s.x, s.y - 8, HOUSING[s.tier]?.hearth && shelterDone(s) ? 120 : 80, HOUSING[s.tier]?.hearth && shelterDone(s) ? 0.85 : 0.6);
    for (const b of w.colony.buildings) if (b.kind === "blacksmith" && b.built >= 1) add(b.x - 10, b.y - 12, 110, 0.75);
    // crystals light up the night (brighter in storms)
    if (w.civ.energy > 1) for (const b of w.colony.buildings) if (b.built >= 1 && (b.kind === "energyTower" || b.kind === "chamber" || b.kind === "beamTower" || b.kind === "obelisk" || b.kind === "pyramid" || b.kind === "resShield")) add(b.x, b.y - (b.kind === "pyramid" ? 120 : 50), b.kind === "pyramid" ? 260 : 90, 0.55 + w.weather.storm * 0.3);
    if (w.civ.chamberX && w.civ.path !== "traditional") add(w.civ.chamberX, w.civ.chamberY - 14, 70, 0.6);
    for (const b of w.civ.beams) add(b.x1, b.y1, 160, 1 - b.t / 0.35);
    for (const dr of w.dragons.list) if (dr.breath > 0.1) add(dr.x + dr.dir * 80, dr.y - dr.z * 0.5, 260, dr.breath);
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
    // the end of an age: a blood-red omen sky, then choking ash
    const ex = w.extinction;
    if (ex.phase === "omen" || ex.phase === "incoming") {
      const k = ex.phase === "omen" ? Math.min(1, ex.t / EXT_TIMES.omen) : 1;
      const g = c.createLinearGradient(0, 0, 0, this.h);
      g.addColorStop(0, `rgba(170,40,20,${0.32 * k})`);
      g.addColorStop(1, `rgba(90,20,40,${0.12 * k})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
    }
    if (ex.cause === "supervolcano" && ex.phase !== "idle") {
      // a burning sky: deep red under black ash, embers raining down
      const k = ex.phase === "omen" ? Math.min(1, ex.t / EXT_TIMES.omen) * 0.5 : 1;
      const g = c.createLinearGradient(0, 0, 0, this.h);
      g.addColorStop(0, `rgba(30,8,6,${0.55 * k})`);
      g.addColorStop(1, `rgba(150,40,10,${0.35 * k})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
      if (ex.phase !== "omen") {
        for (let i = 0; i < 140; i++) {
          const x = (i * 131.7 + this.t * (30 + (i % 9) * 8)) % this.w;
          const y = (i * 71.3 + this.t * (60 + (i % 7) * 14)) % this.h;
          c.fillStyle = i % 3 ? `rgba(255,${120 + (i % 5) * 20},40,0.85)` : "rgba(255,230,140,0.9)";
          c.fillRect(x, y, 2 + (i % 2), 2 + (i % 2));
        }
      }
    }
    if (ex.ash > 0.01) {
      c.fillStyle = ex.cause === "supervolcano" ? `rgba(40,18,14,${ex.ash * 0.55})` : `rgba(55,45,40,${ex.ash * 0.6})`;
      c.fillRect(0, 0, this.w, this.h);
      // drifting ash flakes
      c.fillStyle = `rgba(200,195,190,${0.25 + ex.ash * 0.4})`;
      for (let i = 0; i < 90 * ex.ash; i++) {
        const x = (i * 97.3 + this.t * (8 + (i % 7) * 3)) % this.w;
        const y = (i * 53.1 + this.t * (20 + (i % 5) * 6)) % this.h;
        c.fillRect(x, y, 2, 2);
      }
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
    // …and over Neanderthals, plus a name plate over each clan camp
    for (const b of w.rivals.brutes) {
      if (!b.bubble || b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
      this.speech(c, b.x, b.y - 46, b.bubble.text, inv, Math.min(1, b.bubble.t * 3));
    }
    for (const cl of w.rivals.clans) {
      if (cl.x < x0 - 100 || cl.x > x1 + 100 || cl.y < y0 || cl.y > y1 + 80) continue;
      const held = w.rivals.captives(w, cl.id).length;
      this.speech(c, cl.x + 44, cl.y - 72, `🪓 ${cl.name} clan${held ? ` · ${held} captive${held > 1 ? "s" : ""}` : ""}`, inv * 0.9, 1);
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
    // job badges on cave people when zoomed in
    if (z >= 0.95) {
      c.font = `${11 * inv}px sans-serif`;
      c.textAlign = "center";
      for (const h of w.humans) {
        if (h.child || h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1 || this.hidden(h) || h.bubble) continue;
        const role = w.tribe.roleOf(h);
        if (role === "gatherer" && h.role === "auto") continue;
        const icon = h.order ? "🎯" : ROLES.find((r) => r.id === role)?.icon ?? "";
        c.globalAlpha = 0.9;
        c.fillText(icon, h.x, h.y - h.z - 34);
        c.globalAlpha = 1;
      }
    }
    // hurt people: a little health bar (+ condition icon) when zoomed in
    if (z >= 0.7) {
      for (const h of w.humans) {
        if (h.hp >= 0.95 || h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1 || this.hidden(h)) continue;
        const cnd = condition(h);
        drawBar(c, h.x, h.y - h.z - 40, 18 * inv, h.hp, CONDITION_LABEL[cnd].color);
      }
    }
    // dragons: a big health bar
    for (const dr of w.dragons.list) {
      if (dr.x < x0 - 200 || dr.x > x1 + 200) continue;
      drawBar(c, dr.x, dr.y - dr.z - 80, 80, dr.hp / dr.maxHp, dr.hp < dr.maxHp * 0.35 ? "#fbbf24" : "#ef4444");
      c.font = `700 ${11 * inv}px ui-rounded, system-ui, sans-serif`;
      c.textAlign = "center";
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.fillText(dr.name, dr.x, dr.y - dr.z - 86);
    }
    // Scorpions: crew + reload ring
    for (const s of w.colony.scorpions) {
      if (s.built < 1 || s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const lift = s.mount === "tower" ? TOWER_Z : s.mount === "wall" ? 26 : 0;
      if (!s.crew && (w.tribe.raid || w.dragons.list.length)) this.bubbleIcon(c, s.x, s.y - lift - 42, "❔", inv * 0.8, 0.9);
      if (ov.inspect?.kind === "scorpion" && ov.inspect.id === s.id) this.inspectRing(c, s.x, s.y - lift, 26);
    }
    // inspected home / building
    if (ov.inspect?.kind === "shelter") {
      const s = w.shelters.find((x) => x.id === ov.inspect!.id);
      if (s) this.inspectRing(c, s.x, s.y, 36);
    } else if (ov.inspect?.kind === "building") {
      const b = w.colony.buildings.find((x) => x.id === ov.inspect!.id);
      if (b) this.inspectRing(c, b.x, b.y, BUILDINGS[b.kind].w * 18);
    }
    // order marker (where the selected people were sent)
    if (ov.marker) {
      const m = ov.marker;
      const k = m.t / 1.6;
      c.strokeStyle = `rgba(255,214,80,${1 - k})`;
      c.lineWidth = 3 * inv;
      c.beginPath();
      c.ellipse(m.x, m.y, 10 + k * 26, (10 + k * 26) * 0.45, 0, 0, Math.PI * 2);
      c.stroke();
      this.bubbleIcon(c, m.x, m.y - 30 - k * 12, m.icon, inv, 1 - k * 0.6);
    }
    // build ghost: footprint in green (ok) or red (blocked)
    if (ov.buildPreview) this.buildGhost(c, ov.buildPreview, inv);
    // what a click would do right here
    if (ov.hint) {
      const { x, y, icon, label } = ov.hint;
      c.font = `700 ${12 * inv}px ui-rounded, system-ui, sans-serif`;
      const text = `${icon}  ${label}`;
      const tw = c.measureText(text).width;
      const bx = x + 16 * inv;
      const by = y + 22 * inv;
      c.fillStyle = "rgba(15,23,42,0.86)";
      this.roundRect(c, bx, by - 13 * inv, tw + 16 * inv, 20 * inv, 10 * inv);
      c.fill();
      c.strokeStyle = "rgba(255,214,80,0.7)";
      c.lineWidth = 1 * inv;
      c.stroke();
      c.fillStyle = "#fff";
      c.textAlign = "left";
      c.fillText(text, bx + 8 * inv, by + 1.5 * inv);
      c.textAlign = "center";
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

  private inspectRing(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    c.strokeStyle = `rgba(125,211,252,${0.7 + Math.sin(this.t * 5) * 0.25})`;
    c.lineWidth = 2.5;
    c.setLineDash([7, 5]);
    c.lineDashOffset = -this.t * 18;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }

  private damageBadge(c: CanvasRenderingContext2D, x: number, y: number) {
    c.font = "12px sans-serif";
    c.textAlign = "center";
    c.globalAlpha = 0.7 + Math.sin(this.t * 4) * 0.3;
    c.fillText("🔧", x, y);
    c.globalAlpha = 1;
  }

  /** Where a building would go (green = fine, red = blocked). */
  private buildGhost(c: CanvasRenderingContext2D, p: { x: number; y: number; build: string }, inv: number) {
    const w = this.world;
    if (p.build === "levitate") {
      const pads = w.colony.buildings.filter((b) => b.kind === "levPad" && b.built >= 1);
      drawLiftGhost(c, pads, LIFT.range, p.x, p.y, !("why" in w.civ.liftCheck(w, p.x, p.y)), this.t);
      return;
    }
    const def = BUILD_BY_ID[p.build as keyof typeof BUILD_BY_ID];
    if (!def) return;
    let tx = Math.floor(p.x / TILE);
    let ty = Math.floor(p.y / TILE);
    let tw = 1;
    let th = 1;
    let ok = true;
    const bdef = BUILDINGS[p.build as keyof typeof BUILDINGS];
    if (bdef) {
      const fp = w.colony.footprint(bdef.kind, p.x, p.y);
      tx = fp.tx;
      ty = fp.ty;
      tw = fp.w;
      th = fp.h;
      ok = !w.colony.canPlace(w, bdef.kind, p.x, p.y);
    } else if (p.build === "tower") {
      tx = Math.floor(p.x / TILE - 0.5);
      ty = Math.floor(p.y / TILE) - 1;
      tw = th = 2;
    } else if (p.build === "tent" || p.build === "hut" || p.build === "farm" || p.build === "campfire") return;
    if (def.tech && !w.camp.learned.has(def.tech)) ok = false;
    if (bdef?.civ && !w.civ.has(bdef.civ)) ok = false;
    c.fillStyle = ok ? "rgba(74,222,128,0.22)" : "rgba(248,113,113,0.25)";
    c.strokeStyle = ok ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.95)";
    c.lineWidth = 2 * inv;
    c.fillRect(tx * TILE, ty * TILE, tw * TILE, th * TILE);
    c.strokeRect(tx * TILE, ty * TILE, tw * TILE, th * TILE);
  }

  /** Snow lying on the ground (per tile, soft edges). */
  private snowFx(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number, z: number) {
    const w = this.world;
    const d = w.snow.depth;
    const tx0 = Math.max(0, Math.floor(vx0 / TILE));
    const ty0 = Math.max(0, Math.floor(vy0 / TILE));
    const tx1 = Math.min(MAP_W - 1, Math.ceil(vx1 / TILE));
    const ty1 = Math.min(MAP_H - 1, Math.ceil(vy1 / TILE));
    const step = z < 0.4 ? 2 : 1;
    const R = TILE * step * 1.55;
    for (let ty = ty0; ty <= ty1; ty += step) {
      for (let tx = tx0; tx <= tx1; tx += step) {
        const s = d[ty * MAP_W + tx];
        if (s < 0.06) continue;
        // overlapping soft drifts so no tile edges show
        const h = hash2(tx, ty, 77);
        const jx = (h - 0.5) * 10;
        const jy = (hash2(ty, tx, 78) - 0.5) * 8;
        c.globalAlpha = Math.min(0.85, s * 0.9);
        c.drawImage(this.snowSprite, tx * TILE + (TILE * step) / 2 - R + jx, ty * TILE + (TILE * step) / 2 - R * 0.8 + jy, R * 2, R * 1.6);
      }
    }
    c.globalAlpha = 1;
  }

  /** Paths, bridges, pens + traps lie flat under everything. */
  private flatStructures(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const w = this.world;
    const night = 1 - w.daylight;
    for (const b of w.colony.buildings) {
      if (b.kind !== "path" && b.kind !== "bridge" && b.kind !== "pen" && b.kind !== "trap") continue;
      if (b.x < x0 - 80 || b.x > x1 + 80 || b.y < y0 - 60 || b.y > y1 + 60) continue;
      const def = BUILDINGS[b.kind];
      c.save();
      c.translate(b.x, b.y + (b.kind === "pen" ? 0 : TILE / 2));
      drawBuilding(c, b, def.w, def.h, night > 0.5, this.t);
      c.restore();
    }
  }

  /** Red markers at the screen edge pointing at raiders you can't see. */
  raidArrows(cam: Camera) {
    const w = this.world;
    const raid = w.tribe.raid;
    if (!raid) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const m = 42;
    for (const id of raid.ids) {
      const d = w.dinoById(id);
      if (!d || !d.raider) continue;
      const s = this.toScreen(cam, d.x, d.y - d.z);
      if (s.x > 0 && s.x < this.w && s.y > 60 && s.y < this.h - 90) continue;
      const cx = this.w / 2;
      const cy = this.h / 2;
      const a = Math.atan2(s.y - cy, s.x - cx);
      const k = Math.min((this.w / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (this.h / 2 - m - 50) / Math.abs(Math.sin(a) || 1e-6));
      const ex = cx + Math.cos(a) * k;
      const ey = cy + Math.sin(a) * k;
      const pulse = 1 + Math.sin(this.t * 8) * 0.08;
      c.save();
      c.translate(ex, ey);
      c.fillStyle = d.tier >= 2 ? "rgba(234,179,8,0.95)" : "rgba(220,38,38,0.92)";
      c.beginPath();
      c.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
      c.fill();
      c.rotate(a);
      c.beginPath();
      c.moveTo(24 * pulse, 0);
      c.lineTo(14, -8);
      c.lineTo(14, 8);
      c.fill();
      c.restore();
      c.font = "18px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(d.tier >= 2 ? "👑" : sp(d.species).emoji, ex, ey + 1);
      c.textBaseline = "alphabetic";
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
