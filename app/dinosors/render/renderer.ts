/* ------------------------------------------------------------------ */
/*  Renderer: reads the World and paints a frame. No sim state lives   */
/*  here except cosmetic stuff (rain streaks, cloud drift, fireflies). */
/*  Layers: terrain → water/lava/fire ground FX → shadows → y-sorted   */
/*  entities → flyers → particles → sky FX → light map → UI overlays.  */
/* ------------------------------------------------------------------ */
import { dragonFor, hallFolk, hallOf, hallRing, hallTiers, inRoom, roomOf } from "../sim/riderHall";
import { scorpionMaxHp } from "../sim/scorpionArmor";
import { drawHallBack, drawHallFront } from "./riderHallArt";
import { pitOf } from "../sim/shows";
import { drawChariot } from "./chariotArt";
import { pitScale } from "../sim/shows";
import { hasCart } from "../sim/carts";
import { drawCart } from "./cartArt";
import { sp } from "../data/species";
import { CRAFT_STEPS } from "../sim/camp";
import { isBaby, sizeOf } from "../sim/dinos";
import { P, type Particle } from "../sim/particles";
import { PLANT_H, TALL } from "../sim/plants";
import { hash2, valueNoise } from "../sim/rng";
import { CHUNKS_X, CHUNK_TILES, isWaterTile } from "../sim/terrain";
import { MAP_H, MAP_W, T, TILE, WORLD_H, WORLD_W, type Building, type Dino, type Dragon, type Human, type Plant, type SpeciesDef } from "../sim/types";

/** shade() returns rgb(); species looks want #hex */
function toHex(rgb: string) {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  return "#" + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, "0")).join("");
}
import type { World } from "../sim/world";
import { drawDino, restPose, shade, type DinoPose } from "./drawDino";
import { lookKey } from "../sim/genetics";
import { drawCampfire, drawEgg, type GarbLevel, drawFarm, drawWinery, drawFish, drawFlame, drawHuman, drawItem, drawPlant, drawPlantLod, drawProp, drawShelter, drawStockpile, drawVolcano, type WeaponLook } from "./sprites";
import { ROLES } from "../data/facts";
import { BUILDINGS, HOUSING } from "../data/colony";
import { drawBar, drawBones, drawBuilding, drawHome, drawNode, drawScaffold, drawScorpion, drawTower2, drawWall } from "./colonyArt";
import { drawMegaGate } from "./megaGateArt";
import { drawDragon, drawDragonEgg, drawNest, drawPit } from "./dragonArt";
import { clusters, drawEstateVines, drawField, drawVineyardField, drawPaddock, drawSeatRing } from "./mergedArt";
import { wineryEstates } from "../sim/wineEstate";
import { RING_R, SHADE, shadeCentre } from "../sim/shade";
import { moveSpotOk, type MoveRef } from "../sim/moving";
import { shelterTiles } from "../sim/nav";
import { dragonStats } from "../sim/dragonKeep";
import { shelterDone, stagesOf, towerMaxHp, wallMaxHp } from "../sim/build";
import { BUILD_BY_ID } from "../game/tools";
import { TOWER_Z } from "../sim/nav";
import { condition, CONDITION_LABEL } from "../sim/injury";
import { drawBarricade, drawCarcass, drawSpikes, drawTannery, drawTotem } from "./boneArt";
import { carcassStage, harvested } from "../sim/carcass";
import { feastTable } from "../sim/feast";
import { drawFeastTable, drawRoastPile } from "./feastArt";
import { drawDragonBones } from "./dragonBonesArt";
import { ARMOR_BY_ID, HELMET_BY_ID, METAL_COLOR, OUTFIT_BY_ID } from "../data/colony";
import { drawRefinery } from "./metalArt";
import { drawBrute, drawCatapult, drawBruteMissile, drawClanCamp } from "./bruteArt";
import { drawTreeCanopy, drawTreeFolk, drawTreeGround, drawTreeSign } from "./treeFolkArt";
import { drawSeaFolk, drawSeaHut, drawSeaSign, drawSeaWalks } from "./seaFolkArt";
import { drawSandFolk, drawSandTent } from "./sandFolkArt";
import { boxOf, drawAlignGuides, drawClearBox, drawClearJobs, drawWallEdit, type WallEditView } from "./editArt";
import { alignGuides } from "../sim/wallLinks";
import { drawShieldFields } from "./shieldArt";
import { drawSnowFolk, drawSnowLodge } from "./snowFolkArt";
import type { SnowLodge, SnowTribe } from "../sim/snowFolk";
import { hangTrees, snowCamo } from "../sim/snowBeasts";
import { PeaksFx, drawHangTree } from "./snowArt";
import { shieldView } from "../sim/dragonShield";
import { drawMonk, drawMonkPlace } from "./monkArt";
import { strength } from "../sim/breath";
import { REGION, isSandTile } from "../sim/terrain";
import { PRIOS } from "../sim/priority";
import { siteKey } from "../sim/build";
import type { SandTent, SandTribe } from "../sim/sandFolk";
import { drawClanBuilding, drawClanHold, drawClanTrap } from "./clanLifeArt";
import { fenceSize, siteOf } from "../sim/clanLife";
import type { Brute, Clan, Wall, ClanBuild, SeaHut, SeaSign, SeaTribe, TreeSign } from "../sim/types";
import { TerrainRenderer } from "./terrainRenderer";
import { drawEruptionColumn, drawGhost, drawPyroclastic } from "./civArt";
import { CIV_KINDS, drawAsteroid, drawBeam, drawBeamBolt, drawChamber, drawCivBuilding, drawLift, drawLiftGhost, drawMegalith, drawPylonLink, drawShieldDome, drawShockwave } from "./civArt";
import { EXT_TIMES } from "../sim/extinction";
import { LIFT, pyramidAwake, pyramidCased } from "../data/civ";

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
  hoverItem: { x: number; y: number; radius: number } | null;
  marker: { x: number; y: number; t: number; icon: string } | null;
  inspect: { kind: string; id: number } | null;
  buildPreview: { x: number; y: number; build: string } | null;
  /** choosing where a building / home is carried to (see moving.ts) */
  movePreview?: { x: number; y: number; ref: MoveRef } | null;
  hover: { x: number; y: number; icon: string; radius: number } | null;
  /** the box is marking an area to clear (🪓 Clear area), not picking people */
  boxClear?: boolean;
  /** 🪓 Clear area mode is waiting for a box */
  clearMode?: boolean;
  /** ✏️ wall edit mode: picked pieces + the drag preview */
  wallEdit?: WallEditView | null;
  shakeX: number;
  shakeY: number;
  flash: number;
  flashColor: string;
}

type Drawable = { y: number; k: number; i: number };
const K_PLANT = 0;
const K_DINO = 1;
/** sort key offset for ridden flyers (and their riders): after everything on the ground */
const SKY_Y = 1e6;
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
const K_MINE_LOAD = 22;
const K_NEST = 23;
const K_DEGG = 24;
const K_CBUILD = 40;
const K_CTRAP = 41;
const K_HOLD = 42;
const K_OURCAT = 43;
const K_OURSHOT = 44;
const K_CHARIOT = 45;
const K_HALL_BACK = 46;
const K_HALL_FRONT = 47;
const K_FEAST = 48;
/** Zoomed out past these, people / dinos are drawn as quick little stand-ins (they're tiny on screen anyway). */
const PEOPLE_LOD = 0.35;
const DINO_LOD = 0.27;
/** Zoomed out past this: no chatter / emote bubbles (except for whoever's picked). */
const BUBBLE_LOD = 0.5;
/** Speech bubbles shown at once (besides the people you've picked). */
const MAX_BUBBLES = 3;
/** the Tree People: a camp's canopy village, its ground ring, a warning display */
const K_TREECAMP = 49;
const K_TREEGROUND = 50;
const K_TREESIGN = 51;
/** the Sea People: a village's boardwalks, one stilt-house, a shore marker */
const K_SEAWALK = 52;
const K_SEAHUT = 53;
const K_SEASIGN = 54;
const K_SANDTENT = 55;
const K_MONK = 56;
const K_MONKPLACE = 57;
const K_SNOWLODGE = 58;
const K_HANGTREE = 59;

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
  /** the screen's own pixel ratio (dpr drops below it when zoomed far out: far fewer pixels to fill) */
  private baseDpr = 1;
  private t = 0;
  private drops: Drop[] = [];
  private drawables: Drawable[] = [];
  private visPlants: Plant[] = [];
  /** finished healer huts' doors (people resting there aren't drawn); rebuilt when the colony changes */
  private healerDoors: { v: number; n: number; doors: { x: number; y: number }[] } = { v: -1, n: -1, doors: [] };
  /** shelter id -> people resting inside, counted once per frame */
  private insideCount = new Map<number, number>();
  private insideFrame = -1;
  /** mountain peaks to draw: where, how big, how snowy (0..1), a shape seed */
  private peaks: { x: number; y: number; s: number; snow: number; v: number }[] = [];
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
        const i = y * MAP_W + x;
        if (t.tiles[i] !== T.Mountain) continue;
        const e = t.elev[i];
        // the Great Peaks crowd together (the bigger the higher); the old ridges stay sparse
        if (hash2(x, y, t.seed + 31) > (e > 0.8 ? 0.22 : 0.16)) continue;
        if (Math.hypot(x - 128, y - 20) < 4) continue;
        const s = (0.7 + hash2(x, y, t.seed + 32) * 0.7) * (e > 0.8 ? 1 + (e - 0.8) * 3 : 1);
        const snow = e > 0.84 ? 1 : e > 0.6 ? 0.55 + (e - 0.6) * 1.8 : y < 8 ? 0.5 : 0.3;
        this.peaks.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE, s, snow: Math.min(1, snow), v: hash2(y, x, t.seed + 33) });
      }
    }
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.baseDpr = dpr;
    dpr = this.zoomDpr(dpr, this.lastZoom);
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.light.width = Math.max(1, Math.round(w / 2));
    this.light.height = Math.max(1, Math.round(h / 2));
  }

  private lastZoom = 1;

  /** Pixel ratio for this zoom: full detail close up; fewer pixels the further out (with a gap so it doesn't flicker). */
  private zoomDpr(base: number, z: number) {
    const cur = this.dpr / Math.max(0.01, this.baseDpr);
    let k = 1;
    if (z < 0.28 || (z < 0.31 && cur < 0.9)) k = 0.8 / base;
    else if (z < 0.4 || (z < 0.45 && cur < 0.99)) k = 1 / base;
    return Math.min(base, base * k);
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
    this.lastZoom = z;
    // zoomed out: drop the pixel ratio (a canvas resize only when it actually changes)
    const want = this.zoomDpr(this.baseDpr, z);
    if (Math.abs(want - this.dpr) > 0.01) {
      this.dpr = want;
      this.canvas.width = Math.round(this.w * want);
      this.canvas.height = Math.round(this.h * want);
    }
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
    this.footpaths(c, v.x0, v.y0, v.x1, v.y1);
    this.trailFx(c, v.x0, v.y0, v.x1, v.y1);
    this.groundFx(c, v.x0, v.y0, v.x1, v.y1, z);
    this.snowFx(c, v.x0, v.y0, v.x1, v.y1, z);
    // the peaks: footprints in the snow + spindrift (render/snowArt.ts)
    this.peaksFx.draw(c, w, v.x0, v.y0, v.x1, v.y1, this.t, z);
    this.hazardFx(c, v.x0, v.y0, v.x1, v.y1);
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
      // an airborne flyer is drawn in the sky pass, unless it carries a rider: then it goes last
      // in this pass, with its rider straight after it (so the rider sits on top)
      const aloft = sp(dn.species).move === "fly" && dn.z > 6;
      if (dn.under || (aloft && !dn.rider && !dn.passengers?.length)) continue;
      if (dn.x < x0 || dn.x > x1 || dn.y < y0 || dn.y > y1 + 150) continue;
      list.push({ y: aloft ? SKY_Y + dn.y : dn.y, k: K_DINO, i });
    }
    for (let i = 0; i < w.humans.length; i++) {
      const h = w.humans[i];
      if (h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1) continue;
      if (this.hidden(h) || h.aloft || h.ferry) continue;
      // up on a wall / tower: draw after the structure underneath; riders after their mount
      const mount = h.riding ? w.dinoById(h.riding) : null;
      const sky = !!mount && sp(mount.species).move === "fly" && mount.z > 6;
      list.push({ y: h.level === 1 ? h.y + 44 : sky ? SKY_Y + mount!.y + 0.5 : h.riding ? h.y + 0.5 : h.y, k: K_HUMAN, i });
    }
    const col = w.colony;
    for (let i = 0; i < col.buildings.length; i++) {
      const b = col.buildings[i];
      if (b.kind === "path" || b.kind === "bridge" || b.kind === "pen" || b.kind === "trap" || ((b.kind === "seatRing" || b.kind === "dragonPit" || b.kind === "riderHall") && b.built >= 1)) continue;
      const by = b.lift ? b.lift.y + 4 : b.y;
      if ((b.lift?.x ?? b.x) > x0 - 80 && (b.lift?.x ?? b.x) < x1 + 80 && by > y0 && by < y1 + 80) list.push({ y: by - 1, k: K_BUILDING, i });
    }
    for (let i = 0; i < col.scorpions.length; i++) {
      const s = col.scorpions[i];
      if (s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1 + 80) list.push({ y: s.mount === "ground" ? s.y : s.y + 46, k: K_SCORPION, i });
    }
    for (let i = 0; i < col.nodes.length; i++) {
      const n = col.nodes[i];
      if (n.found && n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) list.push({ y: n.y, k: K_NODE, i });
    }
    this.drs = w.dragons.all();
    for (let i = 0; i < this.drs.length; i++) {
      const dr = this.drs[i];
      if (dr.z <= 6 && dr.x > x0 - 100 && dr.x < x1 + 100 && dr.y > y0 && dr.y < y1 + 100) list.push({ y: dr.y, k: K_DRAGON, i });
    }
    for (let i = 0; i < w.dragons.nests.length; i++) {
      const n = w.dragons.nests[i];
      if (n.x > x0 - 60 && n.x < x1 + 60 && n.y > y0 && n.y < y1 + 40) list.push({ y: n.y - 6, k: K_NEST, i });
    }
    for (let i = 0; i < w.dragons.eggs.length; i++) {
      const e = w.dragons.eggs[i];
      if ((e.at === "ground" || e.at === "camp") && e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1 + 20) list.push({ y: e.y, k: K_DEGG, i });
    }
    // Neanderthals, their camps and anything they've thrown
    const rv = w.rivals;
    for (let i = 0; i < rv.clans.length; i++) {
      const cl = rv.clans[i];
      if (cl.x > x0 - 210 && cl.x < x1 + 210 && cl.y > y0 - 70 && cl.y < y1 + 110) list.push({ y: cl.y - 40, k: K_CLAN, i });
    }
    for (let i = 0; i < rv.brutes.length; i++) {
      const b = rv.brutes[i];
      // a Tree Person up in a tree goes after the tree (and the deck) it's sitting in
      // …and a Sea Person riding a sea dragon goes straight after the dragon (sitting on its back)
      // (a Sand Dragon Rider is drawn on their dragon, with it)
      if (b.onDragon) continue;
      if (b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1 + 160) list.push({ y: b.tree && b.z > 8 ? b.y + 70 : b.mount ? b.y + 1 : b.y, k: K_BRUTE, i });
    }
    // Sand People camps: each tent, the pen, the roost sort on their own
    this.sandTents.length = 0;
    for (const tr of w.sandFolk.tribes) {
      if (tr.x + 320 < x0 || tr.x - 320 > x1 || tr.y + 200 < y0 || tr.y - 200 > y1 + 200) continue;
      for (const s of tr.tents) {
        list.push({ y: s.kind === "pen" ? s.y - 34 : s.y, k: K_SANDTENT, i: this.sandTents.length });
        this.sandTents.push({ s, tr });
      }
    }
    // the Yetis' hanging trees by their dens
    this.hangTreeList = hangTrees(w).filter((t) => t.x > x0 - 60 && t.x < x1 + 60 && t.y > y0 && t.y < y1 + 120);
    for (let i = 0; i < this.hangTreeList.length; i++) list.push({ y: this.hangTreeList[i].y, k: K_HANGTREE, i });
    // Snow People camps: each igloo, the longhouse, the pen… sort on their own
    this.snowLodges.length = 0;
    for (const tr of w.snowFolk.tribes) {
      if (tr.x + 320 < x0 || tr.x - 320 > x1 || tr.y + 200 < y0 || tr.y - 200 > y1 + 200) continue;
      for (const s of tr.lodges) {
        list.push({ y: s.kind === "pen" ? s.y - 34 : s.y, k: K_SNOWLODGE, i: this.snowLodges.length });
        this.snowLodges.push({ s, tr });
      }
    }
    // the Mountain Monks and their places
    const mk = w.monks;
    for (let i = 0; i < mk.list.length; i++) {
      const m = mk.list[i];
      if (m.x > x0 && m.x < x1 && m.y > y0 && m.y < y1 + 60) list.push({ y: m.y, k: K_MONK, i });
    }
    for (let i = 0; i < mk.places.length; i++) {
      const p = mk.places[i];
      if (p.x > x0 - 110 && p.x < x1 + 110 && p.y > y0 - (p.kind === "chapel" ? 170 : 40) && p.y < y1 + 400) list.push({ y: p.kind === "flags" ? p.y - 30 : p.y, k: K_MONKPLACE, i });
    }
    // Tree People camps: the village up in the canopy (after its trees), the ground ring, the warning signs
    const fo = w.forest;
    for (let i = 0; i < fo.tribes.length; i++) {
      const tr = fo.tribes[i];
      const R = 230 + tr.tier * 30;
      if (tr.x + R < x0 || tr.x - R > x1 || tr.y + R < y0 || tr.y - R > y1 + 200) continue;
      let maxY = tr.y;
      for (const p of tr.pods) maxY = Math.max(maxY, p.y);
      list.push({ y: maxY + 4, k: K_TREECAMP, i });
      list.push({ y: tr.y - 60, k: K_TREEGROUND, i });
    }
    // Sea People villages out on the water
    const sf = w.seaFolk;
    this.seaHuts.length = 0;
    this.seaSigns.length = 0;
    for (let i = 0; i < sf.tribes.length; i++) {
      const tr = sf.tribes[i];
      const R = tr.r;
      if (tr.x + R < x0 || tr.x - R > x1 || tr.y + R < y0 || tr.y - R > y1 + 200) continue;
      let minY = tr.y;
      for (const h of tr.huts) {
        minY = Math.min(minY, h.y);
        if (h.x > x0 - 80 && h.x < x1 + 80 && h.y > y0 - 20 && h.y < y1 + 120) {
          list.push({ y: h.y, k: K_SEAHUT, i: this.seaHuts.length });
          this.seaHuts.push({ h, tr });
        }
      }
      list.push({ y: minY - 40, k: K_SEAWALK, i });
      for (const s of tr.signs) {
        if (s.x < x0 - 40 || s.x > x1 + 40 || s.y < y0 || s.y > y1 + 80) continue;
        list.push({ y: s.y, k: K_SEASIGN, i: this.seaSigns.length });
        this.seaSigns.push({ s, color: tr.color });
      }
    }
    this.signs.length = 0;
    for (const tr of fo.tribes) {
      for (const s of tr.signs) {
        if (s.x < x0 - 40 || s.x > x1 + 40 || s.y < y0 || s.y > y1 + 80) continue;
        list.push({ y: s.y, k: K_TREESIGN, i: this.signs.length });
        this.signs.push({ s, color: tr.color });
      }
    }
    // what they've built at home, and their hidden pits
    this.cbs.length = 0;
    for (const cl of rv.clans) {
      for (const [kind, lv] of Object.entries(cl.builds ?? {}) as [ClanBuild, number][]) {
        if (!lv) continue;
        const s = siteOf(cl, kind);
        if (kind === "boneFence") {
          // a ring right round the camp: the back half sorts behind it, the front half in front
          const f = fenceSize(cl);
          if (s.x + f.rx > x0 && s.x - f.rx < x1 && s.y + f.ry > y0 - 60 && s.y - f.ry < y1 + 60) {
            for (const part of ["back", "front"] as const) {
              list.push({ y: s.y + (part === "back" ? -f.ry : f.ry), k: K_CBUILD, i: this.cbs.length });
              this.cbs.push({ clan: cl, kind, lv, x: s.x, y: s.y, part });
            }
          }
          continue;
        }
        if (s.x > x0 - 140 && s.x < x1 + 140 && s.y > y0 - 30 && s.y < y1 + 140) {
          list.push({ y: s.y, k: K_CBUILD, i: this.cbs.length });
          this.cbs.push({ clan: cl, kind, lv, x: s.x, y: s.y });
        }
      }
    }
    // the riders' colosseum round the pit: its tall back half behind the pit, the low front half in front
    const hallB = hallOf(w);
    const hallPit = hallB ? pitOf(w) : null;
    if (hallB && hallPit) {
      const r = hallRing(hallPit);
      if (r.cx + r.rx + 120 > x0 && r.cx - r.rx - 120 < x1 && r.cy + r.ry + 60 > y0 && r.cy - r.ry - 200 < y1) {
        list.push({ y: r.cy - r.ry - 30, k: K_HALL_BACK, i: 0 });
        list.push({ y: r.cy + r.ry + 26, k: K_HALL_FRONT, i: 0 });
      }
    }
    for (let i = 0; i < w.colony.chariots.length; i++) {
      const chr = w.colony.chariots[i];
      if (chr.x > x0 - 140 && chr.x < x1 + 140 && chr.y > y0 - 40 && chr.y < y1 + 120) list.push({ y: chr.y, k: K_CHARIOT, i });
    }
    for (let i = 0; i < rv.holds.length; i++) {
      const hd = rv.holds[i];
      if (hd.x > x0 - hd.r && hd.x < x1 + hd.r && hd.y > y0 - 60 && hd.y < y1 + 60) list.push({ y: hd.y, k: K_HOLD, i });
    }
    for (let i = 0; i < rv.taken.length; i++) {
      const tc = rv.taken[i];
      if (tc.x > x0 - 60 && tc.x < x1 + 60 && tc.y > y0 && tc.y < y1 + 40) list.push({ y: tc.y, k: K_OURCAT, i });
    }
    for (let i = 0; i < rv.ourShots.length; i++) {
      const sh = rv.ourShots[i];
      if (sh.x > x0 && sh.x < x1 && sh.y > y0 && sh.y < y1) list.push({ y: sh.y, k: K_OURSHOT, i });
    }
    for (let i = 0; i < rv.traps.length; i++) {
      const tr = rv.traps[i];
      if (tr.x > x0 && tr.x < x1 && tr.y > y0 && tr.y < y1 + 20) list.push({ y: tr.y - 30, k: K_CTRAP, i });
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
      const sx = s.lift?.x ?? s.x;
      const sy = s.lift ? s.lift.y + 4 : s.y;
      if (sx > x0 && sx < x1 && sy > y0 && sy < y1 + 60) list.push({ y: sy, k: K_SHELTER, i });
    }
    for (let i = 0; i < w.campfires.length; i++) {
      const f = w.campfires[i];
      if (f.x > x0 - 80 && f.x < x1 + 80 && f.y > y0 - 80 && f.y < y1 + 80) {
        list.push({ y: f.y, k: K_CAMPFIRE, i });
      }
    }
    if (w.camp.pileX > x0 && w.camp.pileX < x1 && w.camp.pileY > y0 && w.camp.pileY < y1) list.push({ y: w.camp.pileY, k: K_PILE, i: 0 });
    // the feast table by the fire (once a dragon has roasted anything)
    if (w.colony.feast.food > 0 || w.colony.feast.eaten > 0 || w.flags.has("dragonCook")) {
      const ft = feastTable(w);
      if (ft.x > x0 - 80 && ft.x < x1 + 80 && ft.y > y0 - 60 && ft.y < y1 + 60) list.push({ y: ft.y, k: K_FEAST, i: 0 });
    }
    if (Object.values(w.mineLoads).some((n) => (n ?? 0) > 0) && w.camp.caveX > x0 - 100 && w.camp.caveX < x1 + 100 && w.camp.caveY > y0 - 80 && w.camp.caveY < y1 + 80) list.push({ y: w.camp.caveY + 36, k: K_MINE_LOAD, i: 0 });
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
      // a bone gate turned in a north-south wall straddles it: drawn over the wall pieces just in front of it
      const turned = wl.bone && wl.part === "gate" && !tribe.wallAt(wl.tx - 1, wl.ty) && !tribe.wallAt(wl.tx + 1, wl.ty) && (!!tribe.wallAt(wl.tx, wl.ty - 1) || !!tribe.wallAt(wl.tx, wl.ty + 1));
      if (wx > x0 && wx < x1 && wy > y0 && wy < y1 + 40) list.push({ y: turned ? wy + TILE * 1.6 : wy - (wl.bone ? 1.5 : 2), k: K_WALL, i });
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
    for (const dr of w.dragons.all()) {
      if (dr.x < x0 - 200 || dr.x > x1 + 200 || dr.y < y0 || dr.y > y1 + 200) continue;
      c.globalAlpha = shadowA * (dr.z > 6 ? 0.45 : 0.8);
      const r = (70 - Math.min(30, dr.z * 0.08)) * dragonStats(dr).scale;
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

    // wine estates: rows of vines on the open land round joined wineries (wineEstate.ts)
    for (const e of wineryEstates(w)) if (e.vines.length) drawEstateVines(c, e.vines, new Set(e.vines), MAP_W, TILE, this.t, { x0, y0, x1, y1 });

    // farm fields (plots next to each other are one big field)
    const farms = w.tribe.farms;
    // (vineyards join up with other vineyards, fields with fields)
    for (const g of clusters(farms, (a, b) => (a.crop === "grape") === (b.crop === "grape") && Math.abs(a.x - b.x) < 100 && Math.abs(a.y - b.y) < 62)) {
      if (g.length > 1) {
        const fs = g.map((i) => farms[i]);
        const fx0 = Math.min(...fs.map((f) => f.x)) - 38;
        const fx1 = Math.max(...fs.map((f) => f.x)) + 38;
        const fy0 = Math.min(...fs.map((f) => f.y)) - 22;
        const fy1 = Math.max(...fs.map((f) => f.y)) + 22;
        if (fx0 > x1 + 20 || fx1 < x0 - 20 || fy0 > y1 + 20 || fy1 < y0 - 20) continue;
        if (fs[0].crop === "grape") drawVineyardField(c, fx0, fy0, fx1, fy1, fs, this.t);
        else drawField(c, fx0, fy0, fx1, fy1, fs, this.t);
        continue;
      }
      const f = farms[g[0]];
      if (f.x < x0 - 60 || f.x > x1 + 60 || f.y < y0 - 40 || f.y > y1 + 40) continue;
      c.save();
      c.translate(f.x, f.y);
      drawFarm(c, f.growth, f.planted, this.t, f.crop ?? "wheat");
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
          // zoomed out: a plain blob drawn in place (no save/translate/restore per plant)
          if (lod && !p.stump) {
            drawPlantLod(c, p, p.x, p.y);
            break;
          }
          c.save();
          c.translate(p.x, p.y);
          drawPlant(c, p, this.t, w.weather.wind, lod);
          c.restore();
          break;
        }
        case K_DINO: {
          const dn = w.dinos[it.i];
          if (z < DINO_LOD && dn.id !== ov.selectedId && dn.id !== ov.followId) this.drawTinyDino(c, dn);
          else this.drawDinoAt(c, dn, ov);
          break;
        }
        case K_HUMAN: {
          const h = w.humans[it.i];
          if (z < PEOPLE_LOD && !ov.selection.includes(h.id) && h.id !== ov.followId) this.drawTinyPerson(c, h);
          else this.drawPerson(c, h, ov, weapon);
          break;
        }
        case K_BUILDING: {
          const b = col.buildings[it.i];
          const def = BUILDINGS[b.kind];
          if (b.lift) this.liftShadow(c, b.lift, def.w * TILE * 0.5);
          c.save();
          c.translate(b.lift?.x ?? b.x, (b.lift?.y ?? b.y) - (b.lift?.z ?? 0));
          if (b.kind === "spikes") drawSpikes(c, Math.atan2(b.y - (w.camp.y + 30), b.x - w.camp.x), b.built, b.hp / def.hp, b.tx * 7 + b.ty);
          else if (b.kind === "barricade") drawBarricade(c, b.built, b.hp / def.hp);
          else if (b.kind === "totem") drawTotem(c, b.built, this.t);
          else if (b.kind === "dragonBones") drawDragonBones(c, def.w * TILE, b, this.t);
          else if (b.kind === "winery" && b.built >= 1) drawWinery(c, def.w * TILE, b.built, w.camp.stock.wine, this.t);
          else if (b.kind === "tannery") drawTannery(c, def.w * TILE, b.built, w.camp.stock.hide, this.t);
          else if (b.kind === "refinery" && b.built >= 1) drawRefinery(c, def.w * TILE, w.camp.stock, this.t, night > 0.5);
          else if (CIV_KINDS.has(b.kind)) drawCivBuilding(c, b, def.w, def.h, { power: w.civ.energy > 1, night: night > 0.5, storm: w.weather.storm, t: this.t, charge: b.kind === "dragonShield" ? shieldView(w).charge.get(b.id) ?? 0 : 0 });
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
          const bc = w.rivals.clan(b.clan);
          // after dark, a Tree Person nobody has spotted is only a shadow with glinting eyes
          if (b.tree) drawTreeFolk(c, b, this.t, b.tint ?? "#d94f2a", w.daylight < 0.3 && !((b.spotT ?? 0) > 0));
          // a Sand Person: faint out on the dunes until someone spots them
          else if (b.sand) drawSandFolk(c, b, this.t, b.tint ?? "#c0392b", !w.sandFolk.seen(w, b) ? 2 : isSandTile(w.terrain.tileAt(b.x, b.y)) ? 1 : 0);
          // a Snow Person in their furs
          else if (b.snow) drawSnowFolk(c, b, this.t, b.tint ?? "#2e86c1");
          // a Sea Person (in their canoe on the water); a canoe in the dark is a shadow until it's spotted
          else if (b.sea) drawSeaFolk(c, b, this.t, b.tint ?? "#2fb7c9", !!b.boat && w.daylight < 0.3 && !((b.spotT ?? 0) > 0));
          else if (b.look) this.drawTurned(c, b, bc);
          else if (b.weapon === "catapult") drawCatapult(c, b, bc?.colors?.length ? bc.colors : [bc?.color ?? "#c0392b"], this.t);
          else drawBrute(c, b, this.t, b.tint ?? bc?.color ?? "#c0392b", (bc?.smarts ?? 0) >= 2);
          c.restore();
          break;
        }
        case K_TREECAMP: {
          const tr = w.forest.tribes[it.i];
          if (tr) drawTreeCanopy(c, tr, this.t, night > 0.5);
          break;
        }
        case K_TREEGROUND: {
          const tr = w.forest.tribes[it.i];
          if (tr) drawTreeGround(c, tr, this.t, night > 0.5, !!tr.found);
          break;
        }
        case K_SANDTENT: {
          const st = this.sandTents[it.i];
          if (st) drawSandTent(c, st.s, st.tr, this.t, night > 0.5);
          break;
        }
        case K_HANGTREE: {
          const ht = this.hangTreeList[it.i];
          if (!ht) break;
          c.save();
          c.translate(ht.x, ht.y);
          drawHangTree(c, this.t, w.humans.some((h) => h.hung?.by === ht.id));
          c.restore();
          break;
        }
        case K_SNOWLODGE: {
          const sl = this.snowLodges[it.i];
          if (sl) drawSnowLodge(c, sl.s, sl.tr, this.t, night > 0.5);
          break;
        }
        case K_MONK: {
          const m = w.monks.list[it.i];
          if (!m) break;
          c.save();
          c.translate(m.x, m.y - m.z);
          drawMonk(c, m, this.t, m.slot === 0 && !m.pilgrim, night > 0.45);
          c.restore();
          break;
        }
        case K_MONKPLACE: {
          const p = w.monks.places[it.i];
          if (p) drawMonkPlace(c, p, this.t, night > 0.45, !!w.monks.rite && (w.monks.rite.phase !== "gather" || p.kind === "shrine"));
          break;
        }
        case K_SEAWALK: {
          const tr = w.seaFolk.tribes[it.i];
          if (tr) drawSeaWalks(c, tr, this.t);
          break;
        }
        case K_SEAHUT: {
          const sh = this.seaHuts[it.i];
          if (sh) drawSeaHut(c, sh.h, sh.tr, this.t, night > 0.5);
          break;
        }
        case K_SEASIGN: {
          const sg = this.seaSigns[it.i];
          c.save();
          c.translate(sg.s.x, sg.s.y);
          c.scale(1.5, 1.5);
          drawSeaSign(c, sg.s, sg.color, this.t);
          c.restore();
          break;
        }
        case K_TREESIGN: {
          const sg = this.signs[it.i];
          c.save();
          c.translate(sg.s.x, sg.s.y);
          // big enough to read as a warning from a way off
          c.scale(1.5, 1.5);
          drawTreeSign(c, sg.s, sg.color, this.t);
          c.restore();
          break;
        }
        case K_CBUILD: {
          const cb = this.cbs[it.i];
          c.save();
          c.translate(cb.x, cb.y);
          drawClanBuilding(c, cb.clan, cb.kind, cb.lv, this.t, night > 0.5, cb.part);
          c.restore();
          break;
        }
        case K_HALL_BACK:
        case K_HALL_FRONT: {
          const pit = pitOf(w);
          if (!pit) break;
          const r = hallRing(pit);
          const rooms = hallFolk(w).map((h) => {
            const rm = roomOf(w, h);
            return { a: rm?.a ?? 0, eye: dragonFor(w, h)?.eye ?? "#e0b43a", lit: h.state === "sleep" || h.state === "rest" };
          });
          c.save();
          c.translate(r.cx, r.cy);
          if (it.k === K_HALL_BACK) drawHallBack(c, r.rx, r.ry, hallTiers(w), rooms, this.t, night > 0.5);
          else drawHallFront(c, r.rx, r.ry, rooms, this.t, night > 0.5);
          c.restore();
          break;
        }
        case K_CHARIOT: {
          const chr = w.colony.chariots[it.i];
          c.save();
          c.translate(chr.x, chr.y);
          drawChariot(c, chr, this.t);
          c.restore();
          break;
        }
        case K_HOLD: {
          const hd = w.rivals.holds[it.i];
          c.save();
          c.translate(hd.x, hd.y);
          drawClanHold(c, hd, w.rivals.clan(hd.clan), this.t);
          c.restore();
          break;
        }
        case K_OURCAT: {
          const tc = w.rivals.taken[it.i];
          c.save();
          c.translate(tc.x, tc.y);
          // drawn like theirs, but flying our blue + gold (and showing its level + wear)
          drawCatapult(c, { id: tc.id, dir: tc.dir, cd: tc.cd > 0 ? tc.cd : 0 } as Brute, ["#3a6fb0", "#e0b43a"], this.t);
          c.font = "10px sans-serif";
          c.textAlign = "center";
          c.fillText("⭐".repeat(tc.level), 0, -60);
          if (tc.wear > 0.6) {
            c.fillStyle = `rgba(80,70,60,${0.3 + tc.wear * 0.3})`;
            c.beginPath();
            c.arc(Math.sin(this.t * 2) * 4, -40 - ((this.t * 10) % 14), 6, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = "rgba(0,0,0,0.45)";
          c.fillRect(-18, 10, 36, 4);
          c.fillStyle = tc.wear < 0.5 ? "#7ed37e" : tc.wear < 0.85 ? "#e0b040" : "#e05040";
          c.fillRect(-18, 10, 36 * (1 - tc.wear), 4);
          c.restore();
          break;
        }
        case K_OURSHOT: {
          const sh = w.rivals.ourShots[it.i];
          c.save();
          c.translate(sh.x, sh.y);
          drawBruteMissile(c, "boulder", sh.z, Math.atan2(sh.vy - sh.vz * 0.6, sh.vx));
          c.restore();
          break;
        }
        case K_CTRAP: {
          const tr = w.rivals.traps[it.i];
          c.save();
          c.translate(tr.x, tr.y);
          drawClanTrap(c, tr);
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
        case K_DRAGON:
          this.drawDragonAt(c, this.drs[it.i], ov, weapon);
          break;
        case K_NEST: {
          const n = w.dragons.nests[it.i];
          c.save();
          c.translate(n.x, n.y);
          drawNest(c, n, w.dragons.eggs.filter((e) => e.at === "nest" && e.nest === n.id), this.t);
          c.restore();
          break;
        }
        case K_DEGG: {
          const e = w.dragons.eggs[it.i];
          c.save();
          c.translate(e.x, e.y);
          drawDragonEgg(c, e, this.t);
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
            if (cc.roast) drawRoastPile(c, cc.roast, cc.size, this.t);
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
          if (s.lift) this.liftShadow(c, s.lift, 34);
          c.save();
          c.translate(s.lift?.x ?? s.x, (s.lift?.y ?? s.y) - (s.lift?.z ?? 0));
          const done = shelterDone(s);
          const inside = done ? this.restingIn(s.id) : 0;
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
        case K_FEAST: {
          const ft = feastTable(w);
          c.save();
          c.translate(ft.x, ft.y);
          drawFeastTable(c, w.colony.feast.food, this.t);
          c.restore();
          break;
        }
        case K_CAMPFIRE: {
          const f = w.campfires[it.i];
          c.save();
          c.translate(f.x, f.y);
          drawCampfire(c, f.lit, this.t, 1, w.camp.learned.has("smelting"));
          c.restore();
          break;
        }
        case K_PILE:
          c.save();
          c.translate(w.camp.pileX, w.camp.pileY);
          drawStockpile(c, w.camp.stock);
          c.restore();
          break;
        case K_MINE_LOAD: {
          c.save();
          c.translate(w.camp.caveX + 36, w.camp.caveY + 32);
          const loads = Object.entries(w.mineLoads).filter(([, n]) => (n ?? 0) > 0).slice(0, 4);
          for (let i = 0; i < loads.length; i++) {
            const [r] = loads[i];
            const x = i * 16 - 20;
            const y = (i % 2) * 6;
            c.fillStyle = "rgba(18,20,15,0.24)"; c.beginPath(); c.ellipse(x, y + 2, 11, 4, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = "#785337"; c.strokeStyle = "#d6b986"; c.lineWidth = 1.5;
            c.beginPath(); c.roundRect(x - 9, y - 13, 18, 14, 2); c.fill(); c.stroke();
            c.strokeStyle = "#4b3328"; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x, y); c.stroke();
            c.fillStyle = r === "gold" ? "#f4ca57" : r === "silver" ? "#d9e2ea" : r === "copper" ? "#b77559" : "#9ea7a5";
            c.beginPath(); c.arc(x, y - 7, 3, 0, Math.PI * 2); c.fill();
          }
          c.restore();
          break;
        }
        case K_VOLCANO:
          c.save();
          c.translate(vo.x, vo.y);
          drawVolcano(c, vo.glow, vo.phase === "erupt" || vo.phase === "ash", this.t);
          if (vo.crack > 0.01) this.volcanoCracks(c, vo.crack);
          c.restore();
          break;
        case K_PEAK: {
          const p = this.peaks[it.i];
          this.drawPeak(c, p.x, p.y, p.s, p.snow, p.v);
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
          if (wl.mega) {
            // a Megalodon gate is one shark mouth across the water, drawn from its west (or south) end
            const mg = (dx: number, dy: number) => !!tribe.wallAt(wl.tx + dx, wl.ty + dy)?.mega;
            if (mg(-1, 0)) break;
            let n = 1;
            let vertical = false;
            if (mg(1, 0)) while (mg(n, 0)) n++;
            else {
              if (mg(0, 1)) break;
              while (mg(0, -n)) n++;
              vertical = n > 1;
            }
            const span: Wall[] = [];
            for (let k = 0; k < n; k++) span.push(tribe.wallAt(wl.tx + (vertical ? 0 : k), wl.ty - (vertical ? k : 0))!);
            const ghost = span.some((o) => o.built < 1);
            // the jaws gape for our own people (and when the player opens them); shut on everyone else
            const x0m = wl.tx * TILE - 24;
            const x1m = (wl.tx + (vertical ? 1 : n)) * TILE + 24;
            const y0m = (wl.ty - (vertical ? n - 1 : 0)) * TILE - 24;
            const y1m = (wl.ty + 1) * TILE + 24;
            const ours = !ghost && w.humans.some((h) => !h.stranger && h.x > x0m && h.x < x1m && h.y > y0m && h.y < y1m);
            const open = !ghost && (span.some((o) => o.open) || ours);
            let sw = this.swing.get(wl.id) ?? (open ? 1 : 0);
            sw += ((open ? 1 : 0) - sw) * Math.min(1, dt * 3);
            this.swing.set(wl.id, sw);
            const hp = Math.min(...span.map((o) => (o.built >= 1 ? o.hp / wallMaxHp(o) : 1)));
            c.save();
            c.translate(wl.tx * TILE + TILE / 2, wl.ty * TILE + TILE);
            drawMegaGate(c, n, vertical, sw, this.t, hp, ghost);
            if (ov.inspect?.kind === "gate" && span.some((o) => o.id === ov.inspect!.id)) this.inspectRing(c, vertical ? 0 : ((n - 1) * TILE) / 2, vertical ? -((n - 1) * TILE) / 2 : -20, 22 + n * 8);
            c.restore();
            break;
          }
          // bone gates side by side are one grand gate, drawn from the west (or south) end
          let run: { n: number; vertical: boolean } | undefined;
          if (wl.part === "gate" && wl.bone && wl.built >= 1) {
            const bg = (dx: number, dy: number) => {
              const o = tribe.wallAt(wl.tx + dx, wl.ty + dy);
              return !!o && o.part === "gate" && !!o.bone && o.built >= 1;
            };
            if (bg(-1, 0)) break;
            let e = 0;
            while (bg(e + 1, 0)) e++;
            if (e > 0) run = { n: e + 1, vertical: false };
            else {
              if (bg(0, 1)) break;
              let nn = 0;
              while (bg(0, -nn - 1)) nn++;
              if (nn > 0) run = { n: nn + 1, vertical: true };
            }
          }
          c.save();
          c.translate(wl.tx * TILE + TILE / 2, wl.ty * TILE + TILE);
          const linked = (dx: number, dy: number) => {
            const o = tribe.wallAt(wl.tx + dx, wl.ty + dy);
            if (o && o.part !== "stairs" && (o.built >= 1) === (wl.built >= 1)) return true;
            // walls join onto towers + Dragon Shield pylons too
            return !!tribe.wallAnchorAt(w, wl.tx + dx, wl.ty + dy);
          };
          const stairsMask = wl.part === "stairs" ? (tribe.wallAt(wl.tx, wl.ty - 1) ? 1 : tribe.wallAt(wl.tx + 1, wl.ty) ? 2 : tribe.wallAt(wl.tx - 1, wl.ty) ? 8 : 4) : 0;
          const mask = wl.part === "stairs" ? stairsMask : (linked(0, -1) ? 1 : 0) | (linked(1, 0) ? 2 : 0) | (linked(0, 1) ? 4 : 0) | (linked(-1, 0) ? 8 : 0);
          const towerAt = (dx: number, dy: number) => !!tribe.wallAnchorAt(w, wl.tx + dx, wl.ty + dy);
          const towerMask = wl.part === "stairs" ? 0 : (towerAt(0, -1) ? 1 : 0) | (towerAt(1, 0) ? 2 : 0) | (towerAt(-1, 0) ? 8 : 0);
          let sw = this.swing.get(wl.id) ?? (wl.open ? 1 : 0);
          sw += ((wl.open ? 1 : 0) - sw) * Math.min(1, dt * 4);
          this.swing.set(wl.id, sw);
          drawWall(c, wl, { mask, tower: towerMask, hpFrac: wl.built >= 1 ? wl.hp / wallMaxHp(wl) : 1, swing: sw, t: this.t, run });
          if (ov.inspect?.kind === "gate" && ov.inspect.id === wl.id) this.inspectRing(c, 0, -10, 22);
          c.restore();
          break;
        }
        case K_TOWER: {
          const tw = tribe.towers[it.i];
          c.save();
          c.translate(tw.x, tw.y);
          drawTower2(c, tw.stage, tw.hp / towerMaxHp(tw), this.t, w.camp.learned.has("stonewall"), !!tw.stone);
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
    for (const dn of w.dinos) if (sp(dn.species).move === "fly" && dn.z > 6 && !dn.rider && !dn.passengers?.length && dn.x > x0 && dn.x < x1 && dn.y - dn.z > y0 - 200 && dn.y - dn.z < y1) flyers.push(dn);
    flyers.sort((a, b) => a.y - b.y);
    for (const dn of flyers) this.drawDinoAt(c, dn, ov);
    for (const dr of w.dragons.all()) {
      if (dr.z <= 6 || dr.x < x0 - 200 || dr.x > x1 + 200 || dr.y - dr.z > y1 || dr.y - dr.z < y0 - 260) continue;
      this.drawDragonAt(c, dr, ov, weapon);
    }

    // carcass ropes + flying arrows / bolts / spears
    for (const it of w.items) {
      if (!it.draggedBy) continue;
      const h = w.creatureById(it.draggedBy);
      if (!h || h.kind !== "human" || h.x < x0 || h.x > x1) continue;
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
    // Dragon Shields: rings, links, the hum on a rattled dragon; the full coverage while placing / inspecting one
    {
      const placing = ov.buildPreview?.build === "dragonShield" ? ov.buildPreview : null;
      const picked = ov.inspect?.kind === "building" && w.colony.buildings.some((b) => b.id === ov.inspect!.id && b.kind === "dragonShield");
      drawShieldFields(c, w, this.t, !!placing || picked, placing ? { x: placing.x, y: placing.y, ok: !w.colony.canPlace(w, "dragonShield", placing.x, placing.y) } : null, x0, y0, x1, y1);
    }
    this.stringLights(c, x0, y0, x1, y1);
    const ex = w.extinction;
    if (ex.stats?.shieldHeld && (ex.phase === "impact" || ex.phase === "aftermath")) {
      const sh = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
      if (sh) drawShieldDome(c, sh.x, sh.y, 420, this.t, ex.phase === "impact" ? 1 : Math.max(0, 1 - ex.t / EXT_TIMES.aftermath));
    }

    this.drawParticles(c, x0, y0, x1, y1);
    this.heatHaze(c, v.x0, v.y0, v.x1, v.y1);
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
    this.peaksFx.coldLight(c, w, this.peaksFx.coldness(w, v.x0, v.y0, v.x1, v.y1), this.w, this.h);
    this.screenWeather(c, dt);

    // overlays that should stay readable at night
    c.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 - cx * z), d * (this.h / 2 - cy * z));
    this.overlays(c, ov, x0, y0, x1, y1, z);
    {
      // edit overlays: Clear area jobs + the box being marked, and wall edit picks (render/editArt.ts)
      const inv = 1 / Math.max(0.35, z);
      drawClearJobs(c, w, this.t, inv, x0, y0, x1, y1);
      if (ov.box && ov.boxClear) {
        const a = this.toWorld(cam, Math.min(ov.box.x0, ov.box.x1), Math.min(ov.box.y0, ov.box.y1));
        const b = this.toWorld(cam, Math.max(ov.box.x0, ov.box.x1), Math.max(ov.box.y0, ov.box.y1));
        drawClearBox(c, w, { x0: a.x, y0: a.y, x1: b.x, y1: b.y }, this.t, inv);
      }
      if (ov.wallEdit) drawWallEdit(c, w, ov.wallEdit, this.t, inv);
    }
    this.priorityBadges(c, x0, y0, x1, y1);
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
    // shift-drag selection box (a Clear area box is drawn in the world, with what it'll clear)
    if (ov.box && !ov.boxClear) {
      const b = ov.box;
      c.fillStyle = "rgba(255,214,80,0.12)";
      c.strokeStyle = "rgba(255,214,80,0.9)";
      c.lineWidth = 1.5;
      c.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      c.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
    this.cost = this.cost * 0.92 + (performance.now() - t0) * 0.08;
  }

  /** One person (also used for riders on a dragon's back). */
  private drawPerson(c: CanvasRenderingContext2D, h: Human, ov: Overlay, weapon: WeaponLook) {
    const w = this.world;
    const tribe = w.tribe;
    if (hasCart(w, h)) {
      c.save();
      c.translate(h.x, h.y - h.z);
      drawCart(c, h.dir, h.anim, h.state === "carry" ? h.carry : null, h.carryN);
      c.restore();
    }
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
      // hung up by a Yeti: a rope from the bough to their feet, dangling head-down (snowBeasts.ts)
      if (h.hung) {
        const sw = Math.sin(this.t * 1.6 + h.id) * 0.1;
        c.strokeStyle = "#a8875a";
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(0, -79);
        c.lineTo(Math.sin(sw) * 17, -62);
        c.stroke();
        c.translate(Math.sin(sw) * 17, -62);
        c.rotate(Math.PI + sw);
      }
      if (h.stranger) c.globalAlpha = 0.85;
      const role = tribe.roleOf(h);
      const wp = !h.child ? tribe.weaponFor(w, h) : null;
      const look: WeaponLook = wp ? (wp.id === "shockStick" ? "shock" : wp.id === "rayGun" ? "ray" : wp.proj === "beam" ? "lance" : wp.kind === "bow" ? (wp.tier >= 3 ? "crossbow" : "bow") : wp.kind) : weapon;
      const helmDef = h.gear.helmet ? HELMET_BY_ID[h.gear.helmet] : null;
      const coat = h.gear.outfit ? OUTFIT_BY_ID[h.gear.outfit] : null;
      // everyday clothes get better as the tribe learns
      const garb: GarbLevel = w.civ.polygonAge ? 3 : w.camp.learned.has("smelting") ? 2 : w.camp.learned.has("palisade") ? 1 : 0;
      const armorDef = h.gear.armor ? ARMOR_BY_ID[h.gear.armor] : null;
      const metal = wp ? (wp.metal ? METAL_COLOR[wp.metal] : wp.tier >= 2 ? METAL_COLOR.iron : METAL_COLOR.stone) : null;
      drawHuman(c, h, this.t, look, role === "guard" || role === "hunter" || !!h.order || h.taskId > 0 || tribe.raid !== null, h.gear.shield, wp?.tier ?? 1, coat, w.weather.rain, helmDef ? { color: helmDef.color, trim: helmDef.trim, glow: helmDef.glow } : null, garb, w.shifts.poweredOutfit(w, h), { armor: armorDef, metal });
      if (h.state === "down") {
        const a = this.t * 3;
        c.font = "9px sans-serif";
        c.textAlign = "center";
        c.fillText("💫", Math.cos(a) * 6, -10 + Math.sin(a) * 2);
      }
      c.restore();
    if (h.captive && h.clanGarb) this.captiveRags(c, h);
    if (h.sonic) this.drawEmitter(c, h);
    // dragon eggs in their arms (a runner can carry two)
    for (const [k, id] of [[0, h.egg], [1, h.egg2]] as const) {
      const egg = id ? w.dragons.eggs.find((e) => e.id === id) : null;
      if (!egg) continue;
      c.save();
      c.translate(h.x + h.dir * (6 + k * 7), h.y - h.z - 6 - k * 3);
      drawDragonEgg(c, egg, this.t, 0.9);
      c.restore();
    }
  }

  /** Someone who joined a clan from our tribe (or their child): drawn as themselves, in the clan's rags with a club. */
  private drawTurned(c: CanvasRenderingContext2D, b: Brute, cl: Clan | null) {
    const st = b.state;
    const pose = st === "sleep" ? "sleep" : st === "fight" || st === "bash" || st === "hunt" ? "hunt" : st === "dance" || st === "cheer" ? "celebrate"
      : Math.hypot(b.vx, b.vy) > 4 || st === "walk" || st === "wander" || st === "home" || st === "flee" || st === "carry" ? "walk" : st === "gather" || st === "build" || st === "tame" || st === "trap" ? "gather" : "idle";
    const child = (b.age ?? 180) < 180;
    const look = b.look!;
    const me = {
      id: b.id, kind: "human", name: b.name, child, skin: look.skin, hair: look.hair, fur: look.fur, state: pose, anim: b.anim, dir: b.dir, z: 0,
      carry: null, carryN: 0, riding: 0, aloft: undefined, gear: { weapon: null, shield: 0 }, bubble: null,
    } as unknown as Human;
    drawHuman(c, me, this.t, child ? null : "axe", !child && pose === "hunt", 0, 1, null, 0, null, 0, false);
    if (!cl) return;
    const cols = cl.colors?.length ? cl.colors : [cl.color];
    const H = child ? 20 : 29;
    const top = -H * 0.82;
    c.fillStyle = "#7b5a3a";
    c.strokeStyle = "#24170e";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-H * 0.17, top);
    c.lineTo(H * 0.17, top);
    c.lineTo(H * 0.19, top + H * 0.36);
    for (let i = 0; i < 4; i++) c.lineTo(H * (0.19 - i * 0.12) - H * 0.04, top + H * (i % 2 ? 0.32 : 0.4));
    c.lineTo(-H * 0.19, top + H * 0.36);
    c.closePath();
    c.fill();
    c.stroke();
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(-H * 0.15, top + H * 0.08 + i * 3, H * 0.3, 2.2);
    });
  }

  /** A captive in a clan's rags, with a rope collar tying them to the next captive along. */
  private captiveRags(c: CanvasRenderingContext2D, h: Human) {
    const w = this.world;
    const cl = w.rivals.clan(h.clanGarb!);
    if (!cl) return;
    const cols = cl.colors?.length ? cl.colors : [cl.color];
    const sitting = h.state === "captive" && h.z <= 0;
    const H = h.child ? 20 : 29;
    const top = h.y - h.z - (sitting ? H * 0.62 : H * 0.82);
    c.save();
    // a ragged hide tabard daubed in their colours
    c.fillStyle = "#7b5a3a";
    c.strokeStyle = "#24170e";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(h.x - H * 0.17, top);
    c.lineTo(h.x + H * 0.17, top);
    c.lineTo(h.x + H * 0.19, top + H * 0.36);
    for (let i = 0; i < 4; i++) c.lineTo(h.x + H * (0.19 - i * 0.12) - H * 0.04, top + H * (i % 2 ? 0.32 : 0.4));
    c.lineTo(h.x - H * 0.19, top + H * 0.36);
    c.closePath();
    c.fill();
    c.stroke();
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(h.x - H * 0.15, top + H * 0.08 + i * 3, H * 0.3, 2.2);
    });
    // rope collar
    c.strokeStyle = "#b89a62";
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(h.x, top - 1, H * 0.12, H * 0.04, 0, 0, Math.PI * 2);
    c.stroke();
    // roped to the next captive of this clan
    const next = w.humans.filter((o) => o !== h && o.captive === h.captive && o.clanGarb && o.id > h.id && Math.hypot(o.x - h.x, o.y - h.y) < 220).sort((a, b) => a.id - b.id)[0];
    if (next) {
      const ny = next.y - next.z - (next.state === "captive" && next.z <= 0 ? H * 0.62 : H * 0.82);
      const sag = 14 + Math.hypot(next.x - h.x, next.y - h.y) * 0.08;
      c.beginPath();
      c.moveTo(h.x, top);
      c.quadraticCurveTo((h.x + next.x) / 2, (top + ny) / 2 + sag, next.x, ny);
      c.stroke();
    }
    c.restore();
  }

  /** An ultrasonic fire emitter in someone's hands, and its waves when it's blasting. */
  private drawEmitter(c: CanvasRenderingContext2D, h: Human) {
    const hx = h.x + h.dir * 9;
    const hy = h.y - h.z - 15;
    const aim = h.state === "sonic" ? h.aim : undefined;
    const ang = aim ? Math.atan2(aim.y - hy, aim.x - hx) : h.dir > 0 ? 0 : Math.PI;
    c.save();
    c.translate(hx, hy);
    c.rotate(ang);
    // a copper horn with a crystal at the throat
    c.fillStyle = "#c27a3a";
    c.beginPath(); c.moveTo(-4, -2); c.lineTo(4, -2.5); c.lineTo(10, -6); c.lineTo(10, 6); c.lineTo(4, 2.5); c.lineTo(-4, 2); c.closePath(); c.fill();
    c.strokeStyle = "#7d4a22"; c.lineWidth = 1;
    c.stroke();
    c.fillStyle = aim ? "#c9f6ff" : "#8be0ff";
    c.fillRect(-3, -1.5, 3, 3);
    c.restore();
    if (!aim) return;
    // the waves: arcs racing from the horn to the flames
    const len = Math.hypot(aim.x - hx, aim.y - hy);
    c.save();
    c.translate(hx, hy);
    c.rotate(ang);
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const k = (this.t * 1.8 + i / 6) % 1;
      const x = 10 + k * (len - 10);
      const r = 6 + k * 26;
      c.strokeStyle = `rgba(140,230,255,${0.7 * (1 - k)})`;
      c.lineWidth = 2 - k;
      c.beginPath();
      c.arc(x - r, 0, r, -0.5, 0.5);
      c.stroke();
    }
    c.fillStyle = "rgba(140,230,255,0.07)";
    c.beginPath(); c.moveTo(10, -5); c.lineTo(len, -30); c.lineTo(len, 30); c.lineTo(10, 5); c.closePath(); c.fill();
    c.restore();
  }

  hidden(h: Human) {
    if (h.state !== "hide" && h.state !== "sleep" && h.state !== "rest") return false;
    const w = this.world;
    if (Math.hypot(h.x - w.camp.caveX, h.y - w.camp.caveY) < 30) return true;
    // tucked up in their room in the colosseum
    if (inRoom(w, h)) return true;
    for (const d of this.healerDoorList()) if (Math.hypot(h.x - d.x, h.y - d.y) < 24) return true;
    return w.shelters.some((s) => shelterDone(s) && Math.hypot(h.x - s.x, h.y - s.y) < 30);
  }

  private healerDoorList() {
    const col = this.world.colony;
    const c = this.healerDoors;
    if (c.v !== col.version || c.n !== col.buildings.length) {
      c.v = col.version;
      c.n = col.buildings.length;
      c.doors = col.buildings.filter((b) => b.kind === "healer" && b.built >= 1).map((b) => col.door(b));
    }
    return c.doors;
  }

  /** People resting inside a home (counted for every shelter once per frame). */
  private restingIn(id: number) {
    if (this.insideFrame !== this.world.frame) {
      this.insideFrame = this.world.frame;
      this.insideCount.clear();
      for (const h of this.world.humans) if (h.home && (h.state === "hide" || h.state === "sleep" || h.state === "rest")) this.insideCount.set(h.home, (this.insideCount.get(h.home) ?? 0) + 1);
    }
    return this.insideCount.get(id) ?? 0;
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
    // a Dinosaur Scorpion's claws + tail strike follow its attack timer
    if (dn.species === "dinoScorpion") p.mouth = Math.max(st === "chase" ? 0.15 : 0, dn.strike ?? 0);
    p.lie = st === "sleep" ? Math.min(1, dn.stateT) : st === "wallow" ? 0.9 : st === "faint" ? 1 : 0;
    p.flip = st === "knocked" ? Math.min(1, (dn.stateT + 2) * 3) * (dn.stateT > 1.6 ? Math.max(0, (2 - dn.stateT) / 0.4) : 1) : st === "wallow" ? Math.abs(Math.sin(dn.stateT * 1.5)) * 0.9 : 0;
    p.eyesClosed = st === "sleep" || st === "faint" || (Math.sin(this.t * 0.7 + dn.id * 3) > 0.985);
    p.dangle = st === "carried";
    p.flying = def.move === "fly" && dn.z > 4;
    p.wing = this.t * (st === "dive" || st === "flee" ? 14 : 7) + dn.id;
    // swimmers cruise at the surface (backs + necks out of the water); only a stalker sinks right down
    p.submerged = def.move === "swim" ? (dn.z > 2 ? 0 : dn.state === "stalk" ? 1 : 0.3) : 1;
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

  /** The shadow on the ground under something a crew is carrying. */
  private liftShadow(c: CanvasRenderingContext2D, lift: { x: number; y: number; z: number }, r: number) {
    c.fillStyle = `rgba(20,14,8,${0.18 + lift.z * 0.006})`;
    c.beginPath();
    c.ellipse(lift.x, lift.y + 2, r * (1 - lift.z * 0.004), r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
  }

  /** dragons visible this frame (wild + ours), indexed by the depth sort */
  private drs: Dragon[] = [];
  /** clan buildings in view this frame */
  private cbs: { clan: Clan; kind: ClanBuild; lv: number; x: number; y: number; part?: "back" | "front" }[] = [];
  /** Tree People warning signs in view this frame (with their tribe's paint) */
  private signs: { s: TreeSign; color: string }[] = [];
  /** Sea People stilt-houses + shore markers in view this frame */
  private seaHuts: { h: SeaHut; tr: SeaTribe }[] = [];
  /** Sand People tents etc. in view this frame */
  private sandTents: { s: SandTent; tr: SandTribe }[] = [];
  private snowLodges: { s: SnowLodge; tr: SnowTribe }[] = [];
  private peaksFx = new PeaksFx();
  private hangTreeList: { id: number; x: number; y: number }[] = [];
  private seaSigns: { s: SeaSign; color: string }[] = [];

  /** A dragon (selection ring, the dragon, then whoever is riding it). */
  private drawDragonAt(c: CanvasRenderingContext2D, dr: Dragon, ov: Overlay, weapon: WeaponLook) {
    if (dr.id === ov.selectedId || dr.id === ov.followId) {
      const s = dragonStats(dr).scale;
      c.save();
      c.strokeStyle = dr.id === ov.followId ? "rgba(255,215,90,0.95)" : "rgba(160,255,190,0.95)";
      c.lineWidth = 2.5;
      c.setLineDash([7, 5]);
      c.lineDashOffset = -this.t * 20;
      c.beginPath();
      c.ellipse(dr.x, dr.y + 2, 46 * s, 16 * s, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    c.save();
    c.translate(dr.x, dr.y - dr.z);
    // a Sand Dragon low over the dunes melts into them (like its riders)
    const w = this.world;
    const rider = dr.sandRider ? w.rivals.byId(dr.sandRider) : null;
    if (dr.breed === "sand" && dr.z < 70 && isSandTile(w.terrain.tileAt(dr.x, dr.y)) && !((rider?.spotT ?? 0) > 0)) c.globalAlpha = 0.55;
    drawDragon(c, dr, this.t);
    c.restore();
    // someone getting a lift sits behind the rider
    for (const p of w.humans) if (p.ferry === dr.id) this.drawPerson(c, p, ov, weapon);
    const h = dr.rider ? w.humans.find((x) => x.id === dr.rider && x.aloft === dr.id) : null;
    if (h) this.drawPerson(c, h, ov, weapon);
    if (rider && rider.onDragon === dr.id) {
      c.save();
      c.translate(rider.x, rider.y - rider.z);
      drawSandFolk(c, rider, this.t, rider.tint ?? "#c0392b", dr.breed === "sand" && c.globalAlpha < 1 ? 1 : 0);
      c.restore();
    }
  }

  /**
   * A swimmer at the surface: underneath, the dark shape of the body below the water + a V-shaped
   * wake behind it when it's moving; on top, a line of foam where the water meets its sides.
   */
  private swimWater(c: CanvasRenderingContext2D, dn: Dino, L: number, top: boolean) {
    const v = Math.hypot(dn.vx, dn.vy);
    c.save();
    c.scale(dn.dir, 1);
    if (!top) {
      c.fillStyle = "rgba(10,40,60,0.28)";
      c.beginPath();
      c.ellipse(0, L * 0.05, L * 0.3, L * 0.08, 0, 0, Math.PI * 2);
      c.fill();
      if (v > 5) {
        // the wake: two lines spreading out behind, fading
        const k = Math.min(1, v / 50);
        c.strokeStyle = `rgba(255,255,255,${0.45 * k})`;
        c.lineWidth = Math.max(1.2, L * 0.012);
        for (const s of [-1, 1]) {
          c.beginPath();
          c.moveTo(-L * 0.18, L * 0.05 + s * L * 0.03);
          c.quadraticCurveTo(-L * 0.45, L * 0.05 + s * L * 0.09, -L * 0.75, L * 0.05 + s * L * 0.16);
          c.stroke();
        }
        c.fillStyle = `rgba(255,255,255,${0.3 * k})`;
        for (let i = 0; i < 4; i++) {
          const f = (this.t * 1.5 + i / 4 + dn.id * 0.1) % 1;
          c.beginPath();
          c.arc(-L * (0.25 + f * 0.5), L * 0.05 + Math.sin(i * 2.1) * L * 0.05 * f, L * 0.012 * (1 - f) + 1, 0, Math.PI * 2);
          c.fill();
        }
      }
    } else {
      // foam along the waterline, rippling as it swims
      c.strokeStyle = "rgba(235,248,255,0.75)";
      c.lineWidth = Math.max(1.2, L * 0.014);
      c.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = -L * 0.24 + (i / 12) * L * 0.5;
        const y = L * 0.06 + Math.sin(this.t * 6 + i * 1.3 + dn.id) * L * 0.006;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      if (v > 5) {
        // a bow wave at the front
        c.beginPath();
        c.arc(L * 0.24, L * 0.05, L * 0.03, -Math.PI * 0.4, Math.PI * 0.4);
        c.stroke();
      }
    }
    c.restore();
  }

  /** A clan war-dino: a crude hide-and-bone harness daubed in the clan's colours, a skull on a pole. */
  private clanHarness(c: CanvasRenderingContext2D, dn: Dino, L: number, fly: boolean) {
    const cl = this.world.rivals.clan(dn.clan!);
    if (!cl) return;
    const cols = cl.colors?.length ? cl.colors : [cl.color];
    const y = fly ? -L * 0.12 : -L * 0.42;
    c.save();
    c.scale(dn.dir, 1);
    c.fillStyle = "#7b5a3a";
    c.strokeStyle = "#24170e";
    c.lineWidth = Math.max(1, L * 0.012);
    c.beginPath(); c.ellipse(0, y + L * 0.03, L * 0.16, L * 0.05, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(-L * 0.12, y + L * 0.01 + i * L * 0.016, L * 0.24, L * 0.014);
    });
    // a bone strap round the chest
    c.strokeStyle = "#e9e0c8";
    c.lineWidth = Math.max(1.4, L * 0.018);
    c.beginPath(); c.moveTo(L * 0.14, y); c.lineTo(L * 0.18, y + L * 0.2); c.stroke();
    // skull on a short pole
    const px = -L * 0.16;
    const top = y - L * 0.2 - 4;
    c.strokeStyle = "#5e3f24";
    c.lineWidth = Math.max(1.2, L * 0.012);
    c.beginPath(); c.moveTo(px, y); c.lineTo(px, top); c.stroke();
    c.fillStyle = "#e9e0c8";
    c.beginPath(); c.arc(px, top, Math.max(2.5, L * 0.03), 0, Math.PI * 2); c.fill();
    c.fillStyle = "#24170e";
    c.fillRect(px - L * 0.012, top - L * 0.006, L * 0.008, L * 0.008);
    c.fillRect(px + L * 0.004, top - L * 0.006, L * 0.008, L * 0.008);
    c.restore();
  }

  /** Far out: a person is a little body + head in their own colours (no gear, no shadow detail). */
  private drawTinyPerson(c: CanvasRenderingContext2D, h: Human) {
    const s = h.child ? 0.7 : 1;
    const y = h.y - h.z;
    if (h.state === "down") {
      c.fillStyle = h.fur;
      c.fillRect(h.x - 7 * s, y - 4 * s, 14 * s, 5 * s);
      return;
    }
    c.fillStyle = "rgba(0,0,0,0.2)";
    c.fillRect(h.x - 5 * s, y - 1, 10 * s, 3);
    c.fillStyle = h.fur;
    c.fillRect(h.x - 4.5 * s, y - 15 * s, 9 * s, 14 * s);
    c.fillStyle = h.skin;
    c.fillRect(h.x - 4 * s, y - 23 * s, 8 * s, 8 * s);
    c.fillStyle = h.hair;
    c.fillRect(h.x - 4 * s, y - 24 * s, 8 * s, 3 * s);
  }

  /** Far out: a dino is a quick silhouette in its colours (body, belly, head, legs), sized + facing right. */
  private drawTinyDino(c: CanvasRenderingContext2D, dn: Dino) {
    const def = this.lookFor(dn);
    const L = sizeOf(dn);
    const y = dn.y - dn.z;
    const d = dn.dir;
    const fly = def.move === "fly";
    const swim = def.move === "swim";
    if (swim && dn.z < 2) {
      c.fillStyle = "rgba(20,40,60,0.35)";
      c.beginPath();
      c.ellipse(dn.x, y, L * 0.45, L * 0.12, 0, 0, Math.PI * 2);
      c.fill();
      return;
    }
    const sauropod = def.plan === "sauropod";
    const bodyH = L * (sauropod ? 0.2 : 0.16);
    const lift = fly ? 0 : L * (sauropod ? 0.28 : 0.2);
    if (!fly) {
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillRect(dn.x - L * 0.32, y - 2, L * 0.64, 4);
      // legs
      c.fillStyle = def.look.accent;
      c.fillRect(dn.x - L * 0.18, y - lift, L * 0.07, lift);
      c.fillRect(dn.x + L * 0.1, y - lift, L * 0.07, lift);
    }
    // body + tail
    c.fillStyle = def.look.body;
    c.beginPath();
    c.ellipse(dn.x, y - lift - bodyH * 0.5, L * (fly ? 0.18 : 0.3), bodyH * 0.6, 0, 0, Math.PI * 2);
    c.fill();
    if (fly) {
      c.beginPath();
      c.moveTo(dn.x - L * 0.45, y - lift - bodyH);
      c.lineTo(dn.x, y - lift - bodyH * 0.4);
      c.lineTo(dn.x + L * 0.45, y - lift - bodyH);
      c.lineTo(dn.x, y - lift - bodyH * 0.1);
      c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(dn.x - d * L * 0.25, y - lift - bodyH * 0.6);
      c.lineTo(dn.x - d * L * 0.62, y - lift - bodyH * 0.2);
      c.lineTo(dn.x - d * L * 0.25, y - lift - bodyH * 0.1);
      c.closePath();
      c.fill();
    }
    c.fillStyle = def.look.belly;
    c.fillRect(dn.x - L * 0.14, y - lift - bodyH * 0.25, L * 0.28, bodyH * 0.3);
    // neck + head
    c.fillStyle = def.look.body;
    const hx = dn.x + d * L * (sauropod ? 0.32 : 0.3);
    const hy = y - lift - bodyH * (sauropod ? 2.4 : 1.1);
    if (sauropod) c.fillRect(Math.min(dn.x + d * L * 0.2, hx), hy, Math.abs(hx - (dn.x + d * L * 0.2)) + L * 0.05, L * 0.05);
    c.beginPath();
    c.ellipse(hx, hy, L * 0.09, L * 0.06, 0, 0, Math.PI * 2);
    c.fill();
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
    // a snow animal lying still on the snow melts into it (snowBeasts.ts): faint until it moves (or you pick it)
    if (snowCamo(this.world, dn) && dn.id !== ov.selectedId && dn.id !== ov.followId) c.globalAlpha *= dn.state === "stalk" ? 0.42 : 0.6;
    const cruising = def.move === "swim" && dn.z < 2 && dn.state !== "stalk";
    if (def.move === "swim" && dn.z < 2 && !cruising) {
      // lying low while it stalks: barely a shadow under the waves
      c.globalAlpha = 0.3;
    }
    if (cruising) this.swimWater(c, dn, L, false);
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
    if (cruising) this.swimWater(c, dn, L, true);
    if (dn.clan) this.clanHarness(c, dn, L, def.move === "fly");
    if (dn.work?.partner && !isBaby(dn)) {
      // a Dino Rider team: a riding blanket + the team pennant on a pole at the back of the saddle
      const fly = def.move === "fly";
      const y = fly ? -L * 0.12 : -L * 0.42;
      c.save();
      c.scale(dn.dir, 1);
      c.fillStyle = "#3a6fb0";
      c.strokeStyle = "#e7d9b0";
      c.lineWidth = Math.max(1, L * 0.012);
      c.beginPath(); c.ellipse(0, y + L * 0.03, L * (fly ? 0.1 : 0.17), L * 0.045, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      const px = -L * (fly ? 0.1 : 0.2);
      const top = y - L * (fly ? 0.18 : 0.26) - 6;
      c.strokeStyle = "#5e3f24"; c.lineWidth = Math.max(1.2, L * 0.012);
      c.beginPath(); c.moveTo(px, y); c.lineTo(px, top); c.stroke();
      c.fillStyle = "#e0b43a";
      const flap = Math.sin(this.t * 6 + dn.id) * 1.5;
      c.beginPath(); c.moveTo(px, top); c.lineTo(px - 10 - L * 0.04, top + 3 + flap); c.lineTo(px, top + 7); c.closePath(); c.fill();
      c.restore();
    }
    if (dn.work?.harness && !isBaby(dn)) {
      const work = dn.work;
      c.save();
      c.scale(dn.dir, 1);
      const sway = dn.state === "work" ? Math.sin(dn.anim * 5) * L * 0.012 : Math.sin(this.t * 1.7 + dn.id) * L * 0.006;
      const y = -L * 0.40 + sway;
      // Curved hide saddle, stitched edging and the two load-bearing straps.
      c.fillStyle = "#674733";
      c.strokeStyle = "#c8a879";
      c.lineWidth = Math.max(1.2, L * 0.015);
      c.beginPath(); c.moveTo(-L * 0.34, y + L * 0.05); c.quadraticCurveTo(0, y - L * 0.15, L * 0.32, y + L * 0.05); c.lineTo(L * 0.24, y + L * 0.13); c.quadraticCurveTo(0, y - L * 0.025, -L * 0.25, y + L * 0.13); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = "#3d281d"; c.lineWidth = Math.max(2, L * 0.033);
      for (const x of [-0.22, 0.22]) { c.beginPath(); c.moveTo(L * x, y - L * 0.025); c.quadraticCurveTo(L * (x + 0.06), y + L * 0.31, L * x, y + L * 0.48); c.stroke(); }
      c.strokeStyle = "#d8c293"; c.lineWidth = Math.max(1, L * 0.009);
      for (const x of [-0.22, 0.22]) { c.beginPath(); c.moveTo(L * x, y - L * 0.025); c.quadraticCurveTo(L * (x + 0.06), y + L * 0.31, L * x, y + L * 0.48); c.stroke(); }
      if (work.harness > 1) { c.strokeStyle = "#859798"; c.lineWidth = Math.max(2, L * 0.025); c.beginPath(); c.moveTo(-L * 0.31, y + L * 0.035); c.lineTo(L * 0.31, y + L * 0.035); c.stroke(); }
      if (work.cargo && work.cargoN > 0) {
        const stone = ["stone", "shaped", "clay", "obsidian"].includes(work.cargo);
        const metal = ["iron", "gold", "silver", "copper", "magnetite"].includes(work.cargo);
        const wood = ["wood", "stick"].includes(work.cargo);
        const color = stone ? "#a4a6a0" : metal ? work.cargo === "gold" ? "#e8c45d" : work.cargo === "silver" ? "#cdd8de" : "#9d6950" : wood ? "#ad7646" : "#b8a17c";
        const stacks = Math.min(4, Math.max(1, Math.ceil(work.cargoN / Math.max(1, 60))));
        for (let i = 0; i < stacks; i++) {
          const x = (i - (stacks - 1) / 2) * L * 0.14;
          const cy = y - L * (0.035 + (i % 2) * 0.06);
          c.fillStyle = color; c.strokeStyle = "#473b31"; c.lineWidth = Math.max(1, L * 0.012);
          c.beginPath();
          if (wood) c.roundRect(x - L * 0.09, cy - L * 0.06, L * 0.18, L * 0.095, L * 0.025);
          else c.roundRect(x - L * 0.072, cy - L * 0.085, L * 0.145, L * 0.13, L * 0.022);
          c.fill(); c.stroke();
          c.strokeStyle = "#dec99e"; c.beginPath(); c.moveTo(x, cy - L * 0.08); c.lineTo(x, cy + L * 0.04); c.stroke();
        }
      }
      c.restore();
    }
    if (dn.owner && (dn.warArmor ?? 0) > 0 && !isBaby(dn)) {
      // Layered hide and bone plates leave a strong spiked outline even at game zoom.
      const heavy = (dn.warArmor ?? 0) >= 2;
      c.save();
      c.scale(dn.dir, 1);
      c.lineWidth = Math.max(1.5, L * 0.024);
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * L * 0.17;
        const top = -L * (0.43 + (i === 1 || i === 2 ? 0.035 : 0));
        c.fillStyle = heavy ? "#566b70" : "#76573d";
        c.strokeStyle = heavy ? "#aab9b7" : "#bb9465";
        c.beginPath();
        c.moveTo(x - L * 0.095, top + L * 0.045);
        c.lineTo(x - L * 0.065, top - L * 0.018);
        c.lineTo(x + L * 0.067, top - L * 0.018);
        c.lineTo(x + L * 0.1, top + L * 0.05);
        c.closePath();
        c.fill();
        c.stroke();
        // Ivory spines grow out of each plate, with a second row on strong armor.
        c.fillStyle = "#f2e7c7";
        c.strokeStyle = "#7b6b56";
        c.beginPath();
        c.moveTo(x - L * 0.035, top - L * 0.012);
        c.quadraticCurveTo(x - L * 0.055, top - L * (heavy ? 0.22 : 0.17), x + L * 0.012, top - L * (heavy ? 0.27 : 0.2));
        c.lineTo(x + L * 0.045, top - L * 0.012);
        c.closePath();
        c.fill();
        c.stroke();
        if (heavy) {
          c.beginPath();
          c.moveTo(x + L * 0.04, top);
          c.lineTo(x + L * 0.09, top - L * 0.13);
          c.lineTo(x + L * 0.09, top + L * 0.015);
          c.closePath();
          c.fill();
        }
      }
      // Forward curved tusks turn a charge into a visible collision weapon.
      c.fillStyle = "#f4ead0";
      c.strokeStyle = "#76654d";
      for (const y of [-0.28, -0.12]) {
        c.beginPath();
        c.moveTo(L * 0.32, L * y);
        c.quadraticCurveTo(L * 0.56, L * (y + 0.11), L * 0.7, L * (y - 0.09));
        c.quadraticCurveTo(L * 0.56, L * (y + 0.025), L * 0.33, L * (y + 0.07));
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.restore();
    }
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

  /**
   * A mountain peak: a jagged silhouette with a sunlit west face and a shaded east face, a ridge line,
   * a few rock bands, and a snowcap that comes further down the higher the mountain (with snow
   * streaking down the gullies). `v` varies the shape so no two peaks match.
   */
  private drawPeak(c: CanvasRenderingContext2D, x: number, y: number, s: number, snow = 0.3, v = 0.5) {
    const W = 46 * s;
    const H = 70 * s * (0.85 + v * 0.35);
    const tipX = x - W * (0.25 - v * 0.3);
    const tipY = y - H;
    // the outline: shoulders + notches down each side
    const left: [number, number][] = [[x - W, y], [x - W * 0.66, y - H * (0.32 + v * 0.1)], [x - W * 0.5, y - H * 0.38], [tipX - W * 0.18, y - H * 0.78], [tipX, tipY]];
    const right: [number, number][] = [[tipX, tipY], [tipX + W * 0.2, y - H * 0.74], [x + W * 0.34, y - H * (0.5 - v * 0.1)], [x + W * 0.5, y - H * 0.44], [x + W, y]];
    // a soft shadow at the foot
    c.fillStyle = "rgba(30,26,34,0.18)";
    c.beginPath();
    c.ellipse(x, y - 2, W * 1.05, W * 0.22, 0, 0, Math.PI * 2);
    c.fill();
    // the shaded east face (the whole body)
    const dark = c.createLinearGradient(x, tipY, x, y);
    dark.addColorStop(0, "#5e5866");
    dark.addColorStop(1, "#4a443f");
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(left[0][0], left[0][1]);
    for (const [px, py] of left.slice(1)) c.lineTo(px, py);
    for (const [px, py] of right.slice(1)) c.lineTo(px, py);
    c.closePath();
    c.fill();
    // the sunlit west face, down to the ridge line
    const ridgeX = tipX + W * 0.08;
    const lit = c.createLinearGradient(x - W, y, tipX, tipY);
    lit.addColorStop(0, "#8a7f72");
    lit.addColorStop(1, "#a69d92");
    c.fillStyle = lit;
    c.beginPath();
    c.moveTo(left[0][0], left[0][1]);
    for (const [px, py] of left.slice(1)) c.lineTo(px, py);
    c.lineTo(ridgeX + W * 0.06, y - H * 0.55);
    c.lineTo(ridgeX - W * 0.05, y - H * 0.25);
    c.lineTo(x + W * 0.05, y);
    c.closePath();
    c.fill();
    // rock bands (strata) across both faces
    c.strokeStyle = "rgba(40,34,38,0.28)";
    c.lineWidth = Math.max(1, s);
    c.beginPath();
    for (let k = 1; k <= 2; k++) {
      const by = y - H * (0.18 + k * 0.17);
      const half = W * (1 - (y - by) / H) * 0.9;
      c.moveTo(tipX - half, by + 2);
      c.quadraticCurveTo(tipX, by - 3, tipX + half, by + 3);
    }
    c.stroke();
    // the snowcap: further down on high peaks, with streaks down the gullies
    if (snow > 0.05) {
      const d = 0.22 + snow * 0.42;
      const sy = y - H * (1 - d);
      const half = W * d * 0.92;
      c.fillStyle = "#f4f7fc";
      c.beginPath();
      c.moveTo(tipX, tipY);
      c.lineTo(tipX - half, sy);
      c.lineTo(tipX - half * 0.6, sy - H * 0.04);
      c.lineTo(tipX - half * 0.42, sy + H * 0.07 * snow);
      c.lineTo(tipX - half * 0.15, sy - H * 0.03);
      c.lineTo(tipX + half * 0.12, sy + H * 0.1 * snow);
      c.lineTo(tipX + half * 0.38, sy - H * 0.02);
      c.lineTo(tipX + half * 0.62, sy + H * 0.05 * snow);
      c.lineTo(tipX + half, sy);
      c.closePath();
      c.fill();
      // the shaded side of the snow is blue
      c.fillStyle = "rgba(150,175,215,0.55)";
      c.beginPath();
      c.moveTo(tipX, tipY);
      c.lineTo(ridgeX + W * 0.04, sy + H * 0.02);
      c.lineTo(tipX + half * 0.62, sy + H * 0.05 * snow);
      c.lineTo(tipX + half, sy);
      c.closePath();
      c.fill();
    }
    // a crisp lit ridge line
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = Math.max(1, 1.2 * s);
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.lineTo(ridgeX + W * 0.06, y - H * 0.55);
    c.stroke();
  }

  /* ----------------------------- ground FX ----------------------------- */

  /** Hot sand (glowing, cooling to plain sand) and frost (icy patches) left by dragon breath. */
  private hazardFx(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    const list = this.world.hazards.list;
    if (!list.length) return;
    for (const h of list) {
      if (h.x + h.r < vx0 || h.x - h.r > vx1 || h.y + h.r < vy0 || h.y - h.r > vy1) continue;
      const s = strength(h);
      const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      if (h.kind === "hotSand") {
        // white-hot in the middle → orange → dull red, cooling to the colour of sand
        const fl = 0.85 + Math.sin(this.t * 7 + h.x) * 0.15;
        g.addColorStop(0, s > 0.5 ? `rgba(255,${200 + 40 * s},${120 * s},${0.85 * fl})` : `rgba(${200 + 55 * s * 2},${150 + 30 * s},${100},${0.55 + s * 0.4})`);
        g.addColorStop(0.55, s > 0.3 ? `rgba(240,110,40,${0.55 * s})` : `rgba(212,180,120,${0.5})`);
        g.addColorStop(1, "rgba(214,184,128,0)");
      } else {
        g.addColorStop(0, `rgba(235,248,255,${0.75 * s + 0.1})`);
        g.addColorStop(0.7, `rgba(190,225,250,${0.45 * s})`);
        g.addColorStop(1, "rgba(190,225,250,0)");
      }
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(h.x, h.y, h.r, h.r * 0.62, 0, 0, Math.PI * 2);
      c.fill();
      if (h.kind === "frost" && s > 0.2) {
        // crystals radiating out
        c.strokeStyle = `rgba(255,255,255,${0.6 * s})`;
        c.lineWidth = 1;
        c.beginPath();
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + h.x;
          c.moveTo(h.x, h.y);
          c.lineTo(h.x + Math.cos(a) * h.r * 0.75, h.y + Math.sin(a) * h.r * 0.45);
        }
        c.stroke();
      }
    }
  }

  /** Heat shimmer over the desert on a hot day (a few wavering bands of light; cheap). */
  private heatHaze(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    const w = this.world;
    if (w.daylight < 0.55 || w.weather.rain > 0.3) return;
    const t = w.terrain;
    let desert = 0;
    for (let k = 0; k < 16; k++) {
      const x = vx0 + ((k % 4) + 0.5) * ((vx1 - vx0) / 4);
      const y = vy0 + (Math.floor(k / 4) + 0.5) * ((vy1 - vy0) / 4);
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && t.region[ty * MAP_W + tx] === REGION.desert) desert++;
    }
    if (desert < 3) return;
    const a = (desert / 16) * Math.min(1, (w.daylight - 0.55) * 3) * 0.09;
    const H = vy1 - vy0;
    for (let k = 0; k < 6; k++) {
      const y = vy0 + ((k + 0.5) / 6) * H + Math.sin(this.t * 0.7 + k * 1.7) * 14;
      const g = c.createLinearGradient(0, y - 18, 0, y + 18);
      g.addColorStop(0, "rgba(255,240,210,0)");
      g.addColorStop(0.5, `rgba(255,240,210,${a})`);
      g.addColorStop(1, "rgba(255,240,210,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(vx0, y);
      for (let x = vx0; x <= vx1 + 40; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + this.t * 2.2 + k) * 5 - 18);
      for (let x = vx1 + 40; x >= vx0; x -= 40) c.lineTo(x, y + Math.sin(x * 0.02 + this.t * 2.2 + k + 1) * 5 + 18);
      c.closePath();
      c.fill();
    }
  }

  /** High + Urgent (and Low) badges over prioritized building sites, so it's obvious what comes first. */
  private priorityBadges(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const w = this.world;
    if (!w.priority.entries().length) return;
    const want = new Map(w.priority.entries());
    for (const s of w.buildSites()) {
      const p = want.get(siteKey(s));
      if (p === undefined || s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const info = PRIOS[p];
      const y = s.y - 70 + Math.sin(this.t * 3 + s.id) * (p === 3 ? 3 : 1.5);
      c.fillStyle = "rgba(20,12,6,0.75)";
      c.beginPath();
      c.roundRect(s.x - 22, y - 11, 44, 20, 9);
      c.fill();
      c.strokeStyle = info.color;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = info.color;
      c.font = "bold 11px system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(`${info.icon} ${info.name}`, s.x, y);
    }
  }

  /** Worn footpaths: soft bare-earth patches where people walk a lot (four strengths, one fill each). */
  private footpaths(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    const worn = this.world.trails.worn;
    const tx0 = Math.max(0, Math.floor(vx0 / TILE));
    const tx1 = Math.min(MAP_W - 1, Math.floor(vx1 / TILE));
    const ty0 = Math.max(0, Math.floor(vy0 / TILE));
    const ty1 = Math.min(MAP_H - 1, Math.floor(vy1 / TILE));
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    let any = false;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const v = worn[ty * MAP_W + tx];
        if (v < 24) continue;
        any = true;
        const k = v < 40 ? 0 : v < 80 ? 1 : v < 150 ? 2 : 3;
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE / 2;
        paths[k].moveTo(x + TILE * 0.62, y);
        paths[k].ellipse(x, y, TILE * 0.62, TILE * 0.45, 0, 0, Math.PI * 2);
      }
    if (!any) return;
    const alpha = [0.08, 0.14, 0.2, 0.26];
    for (let k = 0; k < 4; k++) {
      c.fillStyle = `rgba(150,118,78,${alpha[k]})`;
      c.fill(paths[k]);
    }
  }

  private trailFx(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    const detail = this.world.trails.detail;
    const step = TILE / 4;
    const stride = MAP_W * 4;
    const height = MAP_H * 4;
    const fx0 = Math.max(0, Math.floor(vx0 / step) - 1);
    const fy0 = Math.max(0, Math.floor(vy0 / step) - 1);
    const fx1 = Math.min(stride - 1, Math.ceil(vx1 / step) + 1);
    const fy1 = Math.min(height - 1, Math.ceil(vy1 / step) + 1);
    const active = (x: number, y: number) => x >= 0 && y >= 0 && x < stride && y < height && detail[y * stride + x] >= 5;
    const directions = [[1, 0], [0, 1], [1, 1], [-1, 1]] as const;
    const point = (x: number, y: number) => ({
      x: (x + 0.5) * step + (hash2(x, y, 561) - 0.5) * 2.5,
      y: (y + 0.5) * step + (hash2(y, x, 562) - 0.5) * 2.5,
    });
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
      if (!active(x, y)) continue;
      const from = point(x, y);
      // Join footsteps into thin continuous tracks. Diagonals only fill bends,
      // so a busy area does not turn into a square mesh.
      for (const [dx, dy] of directions) {
        if (!active(x + dx, y + dy)) continue;
        if (dx && dy && (active(x + dx, y) || active(x, y + dy))) continue;
        const to = point(x + dx, y + dy);
        c.moveTo(from.x, from.y);
        c.lineTo(to.x, to.y);
      }
    }
    c.strokeStyle = "rgba(112,76,43,0.27)";
    c.lineWidth = 10;
    c.stroke();
    c.strokeStyle = "rgba(194,149,93,0.42)";
    c.lineWidth = 6;
    c.stroke();
    c.restore();
  }

  private stringLights(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const dark = Math.max(0, 1 - this.world.daylight);
    for (const [a, b] of this.world.trails.builtLinks(this.world)) {
      if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1 || Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) continue;
      const count = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 28));
      const point = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 43 + Math.sin(Math.PI * t) * 11 });
      c.save();
      c.strokeStyle = "#55402a";
      c.lineWidth = 2.2;
      c.beginPath();
      for (let i = 0; i <= 16; i++) {
        const p = point(i / 16);
        if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y);
      }
      c.stroke();
      for (let i = 1; i < count; i++) {
        const p = point(i / count);
        c.strokeStyle = "#bba276";
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y + 5); c.stroke();
        if (dark > 0.1) {
          c.fillStyle = `rgba(255,167,65,${dark * 0.2})`;
          c.beginPath(); c.arc(p.x, p.y + 6, 9, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = "#f7cd74";
        c.beginPath(); c.arc(p.x, p.y + 6, 3, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
  }

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
    const lights: [number, number, number, number, boolean?][] = [];
    const z = cam.zoom;
    const add = (wx: number, wy: number, rad: number, a: number, cool = false) => {
      const sx = ((wx - cam.x) * z + this.w / 2) / 2;
      const sy = ((wy - cam.y) * z + this.h / 2) / 2;
      const rr = (rad * z) / 2;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > lw || sy - rr > lh) return;
      lights.push([sx, sy, rr, a, cool]);
    };
    for (const f of w.campfires) if (f.lit) add(f.x, f.y - 10, 240 + Math.sin(this.t * 9) * 8, 1);
    for (const b of w.colony.buildings) if (b.kind === "boneTorch" && b.built >= 1 && b.hp > 0) add(b.x, b.y - 43, 135 + Math.sin(this.t * 11 + b.id) * 5, 0.9);
    for (const [a, b] of w.trails.builtLinks(w)) {
      const count = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 28));
      for (let i = 1; i < count; i++) {
        const t = i / count;
        add(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - 37 + Math.sin(Math.PI * t) * 11, 80, 0.7);
      }
    }
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
    // Sea People villages: firelit doorways over the water + the shrine's fire bowl
    for (const tr of w.seaFolk.tribes) for (const h of tr.huts) if (h.hp > 0 && (h.kind === "hut" || h.kind === "longhouse" || h.kind === "shrine")) add(h.x, h.y - 24, h.kind === "longhouse" ? 90 : 60, 0.6 + Math.sin(this.t * 5 + h.x) * 0.06);
    // Tree People camps: the ritual fire below, firelit doorways + the fire bowl up in the canopy
    for (const tr of w.forest.tribes) {
      add(tr.x, tr.y + 10, 200 + Math.sin(this.t * 8 + tr.id) * 10, 0.85);
      for (const p of tr.pods) if (p.hp > 0 && (p.kind === "hut" || p.kind === "ritual")) add(p.x + (p.kind === "ritual" ? 9 : 2), p.y - p.h - 6, p.kind === "ritual" ? 70 : 55, 0.6 + Math.sin(this.t * 6 + p.x) * 0.06);
    }
    // crystals light up the night (brighter in storms)
    if (w.civ.energy > 1) for (const b of w.colony.buildings) if ((b.built >= 1 || pyramidAwake(b)) && (b.kind === "energyTower" || b.kind === "chamber" || b.kind === "beamTower" || b.kind === "obelisk" || b.kind === "pyramid" || b.kind === "resShield")) add(b.x, b.y - (b.kind === "pyramid" ? 120 : 50), b.kind === "pyramid" ? (pyramidCased(b) ? 340 : 260) : 90, 0.55 + w.weather.storm * 0.3);
    for (const h of w.humans) if (!h.under && h.state !== "sleep" && h.state !== "hide" && w.shifts.poweredOutfit(w, h)) add(h.x, h.y - h.z - 14, 135, 0.58, true);
    if (w.civ.chamberX && w.civ.path !== "traditional") add(w.civ.chamberX, w.civ.chamberY - 14, 70, 0.6);
    for (const b of w.civ.beams) add(b.x1, b.y1, 160, 1 - b.t / 0.35);
    for (const dr of w.dragons.all()) if (dr.breath > 0.1) add(dr.burst && dr.aimX !== undefined ? dr.aimX : dr.x + dr.dir * 80, dr.burst && dr.aimY !== undefined ? dr.aimY : dr.y - dr.z * 0.5, 260, dr.breath);
    for (const e of w.dragons.eggs) if (e.at === "camp" && e.heat > 0.55) add(e.x, e.y - 8, 40, 0.4);
    for (const m of w.meteors) add(m.x + (1 - m.t / m.dur) * 900, m.y - (1 - m.t / m.dur) * 1300, 300, 1);
    for (const b of w.bolts) add(b.x, b.y, 900, 1 - b.t / 0.6);
    for (const [sx, sy, rr, a, cool] of lights) {
      L.globalAlpha = a;
      L.drawImage(cool ? this.glowSprite : this.warmLight, sx - rr, sy - rr, rr * 2, rr * 2);
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
    for (const [sx, sy, rr, a, cool] of lights) {
      c.globalAlpha = a * dark * 0.55;
      c.drawImage(cool ? this.glowSprite : this.warmSprite, sx * 2 - rr * 1.2, sy * 2 - rr * 1.2, rr * 2.4, rr * 2.4);
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
    // emotes over dinos (not when zoomed far out: too small to read, and costly in a crowd)
    for (const dn of w.dinos) {
      if (!dn.emote || dn.x < x0 || dn.x > x1 || dn.y < y0 || dn.y > y1) continue;
      if (z < BUBBLE_LOD && dn.id !== ov.selectedId && dn.id !== ov.followId) continue;
      const L = sizeOf(dn);
      const k = Math.min(1, dn.emote.t * 3);
      const hy = dn.y - dn.z - L * (sp(dn.species).plan === "sauropod" ? 0.85 : 0.6) - 10 - (1 - k) * 8;
      this.bubbleIcon(c, dn.x + dn.dir * L * 0.2, hy, dn.emote.icon, inv * 0.9, k);
    }
    // speech bubbles over people: whoever's picked always, plus only the few newest elsewhere (and never piled
    // on top of each other), so a busy town doesn't turn into a wall of chatter
    c.textAlign = "center";
    const talking = w.humans.filter((h) => h.bubble && h.x >= x0 && h.x <= x1 && h.y >= y0 && h.y <= y1 && !this.hidden(h));
    const mine = (h: Human) => ov.selection.includes(h.id) || h.id === ov.followId || h.id === ov.selectedId;
    talking.sort((a, b) => (mine(b) ? 1 : 0) - (mine(a) ? 1 : 0) || b.bubble!.t - a.bubble!.t);
    const shown: { x: number; y: number }[] = [];
    let others = 0;
    for (const h of talking) {
      const picked = mine(h);
      if (!picked && z < BUBBLE_LOD) continue;
      if (!picked && (others >= MAX_BUBBLES || shown.some((p) => Math.abs(p.x - h.x) < 90 && Math.abs(p.y - h.y) < 40))) continue;
      if (!picked) others++;
      shown.push({ x: h.x, y: h.y });
      const k = Math.min(1, h.bubble!.t * 3);
      this.speech(c, h.x, h.y - h.z - 34, h.bubble!.text, inv, k);
    }
    // …and over Neanderthals, plus a name plate over each clan camp
    for (const b of w.rivals.brutes) {
      if (!b.bubble || b.hidden || b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
      this.speech(c, b.x, b.y - b.z - (b.tree ? 40 : 46), b.bubble.text, inv, Math.min(1, b.bubble.t * 3));
    }
    // …over each Sea People village we've spotted
    for (const tr of w.seaFolk.tribes) {
      if (!tr.found || tr.x < x0 - 100 || tr.x > x1 + 100 || tr.y < y0 || tr.y > y1 + 200) continue;
      this.speech(c, tr.x, tr.y - 80, `🛶 ${tr.name} Sea People · ${w.seaFolk.members(tr.id).length}`, inv * 0.9, 1);
    }
    // …over each Sand People settlement we've found (camp, town, city or kingdom)
    for (const tr of w.sandFolk.tribes) {
      if (!tr.found || tr.x < x0 - 100 || tr.x > x1 + 100 || tr.y < y0 || tr.y > y1 + 200) continue;
      const t = w.sandFolk.title(tr);
      this.speech(c, tr.x, tr.y - (tr.tier >= 5 ? 130 : 90), `${tr.tier >= 5 ? "👑" : "🏜️"} ${t.charAt(0).toUpperCase() + t.slice(1)} · ${w.sandFolk.members(tr.id).length}`, inv * 0.9, 1);
    }
    // …over each Snow People camp we've found
    for (const tr of w.snowFolk.tribes) {
      if (!tr.found || tr.x < x0 - 100 || tr.x > x1 + 100 || tr.y < y0 || tr.y > y1 + 200) continue;
      this.speech(c, tr.x, tr.y - 92, `🏔️ ${tr.name} Snow People · ${w.snowFolk.members(tr.id).length}${tr.grudge > 0 ? " · angry with us" : ""}`, inv * 0.9, 1);
    }
    // …and over each Tree People camp we've scouted
    for (const tr of w.forest.tribes) {
      if (!tr.found || tr.x < x0 - 100 || tr.x > x1 + 100 || tr.y < y0 || tr.y > y1 + 200) continue;
      const top = tr.pods.reduce((m, p) => Math.min(m, p.y - p.h), tr.y);
      this.speech(c, tr.x, top - 52, `🌿 ${tr.name} Tree People · ${w.forest.members(tr.id).length}`, inv * 0.9, 1);
    }
    for (const cl of w.rivals.clans) {
      if (cl.x < x0 - 100 || cl.x > x1 + 100 || cl.y < y0 || cl.y > y1 + 80) continue;
      const held = w.rivals.captives(w, cl.id).length;
      this.speech(c, cl.x + 44, cl.y - 72, `🪓 ${cl.name} ${cl.sea ? "Sea clan" : "clan"}${held ? ` · ${held} captive${held > 1 ? "s" : ""}` : ""}`, inv * 0.9, 1);
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
    for (const dr of w.dragons.all()) {
      if (dr.x < x0 - 200 || dr.x > x1 + 200) continue;
      const top = dr.y - dr.z - 80 * dragonStats(dr).scale;
      if (dr.owner) {
        // ours: a name tag, and a green bar only when hurt
        if (dr.hp < dr.maxHp * 0.98) drawBar(c, dr.x, top, 60, dr.hp / dr.maxHp, "#4ade80");
        c.font = `700 ${10 * inv}px ui-rounded, system-ui, sans-serif`;
        c.textAlign = "center";
        c.fillStyle = "rgba(190,255,200,0.92)";
        c.fillText(`🐉 ${dr.name}`, dr.x, top - 6);
        continue;
      }
      if (dr.state === "perch" && dr.hp >= dr.maxHp * 0.98) continue;
      drawBar(c, dr.x, top, 80, dr.hp / dr.maxHp, dr.hp < dr.maxHp * 0.35 ? "#fbbf24" : "#ef4444");
      c.font = `700 ${11 * inv}px ui-rounded, system-ui, sans-serif`;
      c.textAlign = "center";
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.fillText(dr.fury ? `😡 ${dr.name} · RAGING` : dr.name, dr.x, top - 6);
    }
    // Scorpions: crew + reload ring
    for (const s of w.colony.scorpions) {
      if (s.built < 1 || s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const lift = s.mount === "tower" ? TOWER_Z : s.mount === "wall" ? 26 : 0;
      const maxHp = scorpionMaxHp(s);
      if (s.hp < maxHp) drawBar(c, s.x, s.y - lift - 46, 46, Math.max(0, s.hp / maxHp), s.hp < maxHp * 0.3 ? "#ef4444" : "#f59e0b");
      if (!s.crew && (w.tribe.raid || w.dragons.menacing(w))) this.bubbleIcon(c, s.x, s.y - lift - 42, "❔", inv * 0.8, 0.9);
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
    if (ov.movePreview) this.moveGhost(c, ov.movePreview, inv);
    if (ov.hoverItem) this.inspectRing(c, ov.hoverItem.x, ov.hoverItem.y, ov.hoverItem.radius);
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
    } else if (p.build === "scorpion") {
      const spot = w.colony.scorpionSpot(w, p.x, p.y);
      tx = spot.tx;
      ty = spot.ty;
      tw = th = spot.mount === "tower" ? 2 : 1;
      ok = !spot.why && Math.hypot(spot.x - w.camp.x, spot.y - w.camp.y) < 1600;
    } else if (p.build === "tower") {
      // show the 2x2 it will snap to, or each square that's blocked if there's no fit
      const spot = w.tribe.towerSpot(w, p.x, p.y);
      tx = spot?.tx ?? Math.floor(p.x / TILE - 0.5);
      ty = spot?.ty ?? Math.floor(p.y / TILE) - 1;
      tw = th = 2;
      if (!spot) {
        c.lineWidth = 2 * inv;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const good = w.tribe.towerTileOk(w, tx + dx, ty + dy);
            c.fillStyle = good ? "rgba(74,222,128,0.22)" : "rgba(248,113,113,0.3)";
            c.strokeStyle = good ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.95)";
            c.fillRect((tx + dx) * TILE, (ty + dy) * TILE, TILE, TILE);
            c.strokeRect((tx + dx) * TILE, (ty + dy) * TILE, TILE, TILE);
          }
        return;
      }
    } else if (p.build === "tent" || p.build === "hut" || p.build === "campfire") {
      // homes + fires: the square under the pointer needs firm ground or a finished deck
      ok = w.colony.footing(w, tx, ty) && !w.colony.occupied(w).has(ty * MAP_W + tx);
    } else if (p.build === "farm") return;
    if (def.tech && !w.camp.learned.has(def.tech)) ok = false;
    if (bdef?.civ && !w.civ.has(bdef.civ)) ok = false;
    c.fillStyle = ok ? "rgba(74,222,128,0.22)" : "rgba(248,113,113,0.25)";
    c.strokeStyle = ok ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.95)";
    c.lineWidth = 2 * inv;
    c.fillRect(tx * TILE, ty * TILE, tw * TILE, th * TILE);
    c.strokeRect(tx * TILE, ty * TILE, tw * TILE, th * TILE);
    if (p.build === "scorpion") {
      const spot = w.colony.scorpionSpot(w, p.x, p.y);
      const label = spot.why ?? (ok ? `Place on ${spot.mount === "tower" ? "tower" : spot.mount === "wall" ? "wall" : "ground"}` : "Too far from camp");
      c.font = `700 ${12 * inv}px ui-rounded, system-ui, sans-serif`;
      c.textAlign = "center";
      c.fillStyle = ok ? "#bbf7d0" : "#fecaca";
      c.fillText(label, (tx + tw / 2) * TILE, ty * TILE - 12 * inv);
    }
  }

  /** Where a carried building / home would go: its footprint in green (fits) or red (doesn't), with the reason. */
  private moveGhost(c: CanvasRenderingContext2D, p: { x: number; y: number; ref: MoveRef }, inv: number) {
    const w = this.world;
    const why = moveSpotOk(w, p.ref, p.x, p.y);
    const ok = !why;
    const tiles: [number, number][] = [];
    if (p.ref.kind === "building") {
      const b = w.colony.buildings.find((x) => x.id === p.ref.id);
      if (!b) return;
      const fp = w.colony.footprint(b.kind, p.x, p.y);
      for (let dy = 0; dy < fp.h; dy++) for (let dx = 0; dx < fp.w; dx++) tiles.push([fp.tx + dx, fp.ty + dy]);
    } else if (p.ref.kind === "wall") tiles.push([Math.floor(p.x / TILE), Math.floor(p.y / TILE)]);
    else if (p.ref.kind === "tower") {
      const t = w.tribe.towers.find((o) => o.id === p.ref.id);
      if (!t) return;
      const s = w.tribe.towerMoveSpot(w, t, p.x, p.y) ?? { tx: Math.floor(p.x / TILE - 0.5), ty: Math.floor(p.y / TILE) - 1 };
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) tiles.push([s.tx + dx, s.ty + dy]);
    }
    else if (p.ref.kind === "farm") {
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push([tx + dx, ty + dy]);
    } else for (const i of shelterTiles(p.x, p.y)) tiles.push([i % MAP_W, Math.floor(i / MAP_W)]);
    if (!tiles.length) return;
    // walls + towers: measuring lines to what it lines up with (green in line, red a tile or two off)
    if (p.ref.kind === "wall" || p.ref.kind === "tower") {
      const box = boxOf(tiles.map(([tx, ty]) => ({ tx, ty })));
      drawAlignGuides(c, alignGuides(w, box, p.ref.kind === "wall" ? new Set([p.ref.id]) : new Set(), p.ref.kind === "tower" ? p.ref.id : 0), inv, this.t);
    }
    c.fillStyle = ok ? "rgba(74,222,128,0.22)" : "rgba(248,113,113,0.25)";
    c.strokeStyle = ok ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.95)";
    c.lineWidth = 2 * inv;
    const xs = tiles.map((t) => t[0]);
    const ys = tiles.map((t) => t[1]);
    const tx0 = Math.min(...xs);
    const ty0 = Math.min(...ys);
    const tw = Math.max(...xs) - tx0 + 1;
    const th = Math.max(...ys) - ty0 + 1;
    c.fillRect(tx0 * TILE, ty0 * TILE, tw * TILE, th * TILE);
    c.setLineDash([6 * inv, 4 * inv]);
    c.lineDashOffset = -this.t * 18 * inv;
    c.strokeRect(tx0 * TILE, ty0 * TILE, tw * TILE, th * TILE);
    c.setLineDash([]);
    c.font = `700 ${12 * inv}px ui-rounded, system-ui, sans-serif`;
    c.textAlign = "center";
    c.fillStyle = ok ? "#bbf7d0" : "#fecaca";
    c.fillText(ok ? p.ref.kind === "wall" || p.ref.kind === "farm" || p.ref.kind === "tower" ? "🔷 Move here" : "🚚 Carry it here" : why ?? "", (tx0 + tw / 2) * TILE, ty0 * TILE - 10 * inv);
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
    const bridges = new Set(w.colony.buildings.filter((b) => b.kind === "bridge").map((b) => b.ty * MAP_W + b.tx));
    // pens that touch are one big paddock
    const pens = w.colony.buildings.filter((b) => b.kind === "pen" && b.built >= 1);
    const merged = new Set<Building>();
    if (pens.length > 1) {
      const pw = BUILDINGS.pen.w;
      const ph = BUILDINGS.pen.h;
      const touch = (a: Building, b: Building) => a.tx <= b.tx + pw && b.tx <= a.tx + pw && a.ty <= b.ty + ph && b.ty <= a.ty + ph;
      for (const g of clusters(pens, touch)) {
        if (g.length < 2) continue;
        const ps = g.map((i) => pens[i]);
        for (const p of ps) merged.add(p);
        const tx0 = Math.min(...ps.map((p) => p.tx));
        const ty0 = Math.min(...ps.map((p) => p.ty));
        const tx1 = Math.max(...ps.map((p) => p.tx + pw));
        const ty1 = Math.max(...ps.map((p) => p.ty + ph));
        const px = tx0 * TILE;
        const py = ty0 * TILE - TILE / 2;
        if (px > x1 + 40 || (tx1 * TILE) < x0 - 40 || py > y1 + 40 || ty1 * TILE < y0 - 60) continue;
        c.save();
        c.translate(px, py);
        drawPaddock(c, (tx1 - tx0) * TILE, (ty1 - ty0) * TILE, ps.length, this.t, tx0 * 7 + ty0 * 13);
        c.restore();
      }
    }
    for (const b of w.colony.buildings) {
      if (b.kind === "dragonPit" && b.built >= 1) {
        // the dragons' arena lies flat: dragons, keepers + the crowd stand on and round it
        const def = BUILDINGS.dragonPit;
        const px = b.lift?.x ?? b.x;
        const py = (b.lift?.y ?? b.y) - (b.lift?.z ?? 0);
        // dug out wider as the dragons grow in number + size: it widens round the same arena centre
        const s = pitScale(b);
        if (px < x0 - 200 * s || px > x1 + 200 * s || py < y0 - 160 * s || py > y1 + 160 * s) continue;
        c.save();
        c.translate(px, py + def.h * TILE * 0.4 * (s - 1));
        drawPit(c, def.w * TILE * s, def.h * TILE * s, this.t, w.dragons.show?.pit === b.id);
        c.restore();
        continue;
      }
      if (b.kind === "seatRing" && b.built >= 1) {
        // log seats round the campfire, flat under the fire + the people sitting on them
        const ctr = shadeCentre(w, b);
        if (ctr.x < x0 - 120 || ctr.x > x1 + 120 || ctr.y < y0 - 80 || ctr.y > y1 + 80) continue;
        c.save();
        c.translate(ctr.x, ctr.y);
        drawSeatRing(c, RING_R, SHADE.seatRing!.seats, b.id);
        c.restore();
        continue;
      }
      if (b.kind !== "path" && b.kind !== "bridge" && b.kind !== "pen" && b.kind !== "trap") continue;
      if (merged.has(b)) continue;
      if (b.x < x0 - 80 || b.x > x1 + 80 || b.y < y0 - 60 || b.y > y1 + 60) continue;
      const def = BUILDINGS[b.kind];
      let bridgeMask = 0;
      if (b.kind === "bridge") {
        const neighbours = [
          [b.tx, b.ty - 1, 1], [b.tx + 1, b.ty, 2],
          [b.tx, b.ty + 1, 4], [b.tx - 1, b.ty, 8],
        ];
        for (const [tx, ty, bit] of neighbours) {
          if (bridges.has(ty * MAP_W + tx)) bridgeMask |= bit;
        }
        // A single shore tile still points toward the bank before the next
        // bridge section is placed. Neighbouring bridges take precedence.
        if (!bridgeMask) {
          for (const [tx, ty, bit] of neighbours) {
            if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && !isWaterTile(w.terrain.tiles[ty * MAP_W + tx] as T)) bridgeMask |= bit;
          }
        }
      }
      c.save();
      c.translate(b.lift?.x ?? b.x, (b.lift?.y ?? b.y) - (b.lift?.z ?? 0) + (b.kind === "pen" ? 0 : TILE / 2));
      drawBuilding(c, b, def.w, def.h, night > 0.5, this.t, bridgeMask);
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
