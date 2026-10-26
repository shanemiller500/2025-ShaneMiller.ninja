/* ------------------------------------------------------------------ */
/*  Terrain: a hand-shaped macro layout (so every world has the same   */
/*  landmarks kids can learn) + seeded noise for natural edges.        */
/* ------------------------------------------------------------------ */
import { fbm, hash2 } from "./rng";
import { MAP_H, MAP_W, OLD_MAP_W, T, TILE } from "./types";

export const CHUNK_TILES = 16;
export const CHUNKS_X = Math.ceil(MAP_W / CHUNK_TILES);
export const CHUNKS_Y = Math.ceil(MAP_H / CHUNK_TILES);

/** Landmarks in tile coordinates. */
export const LM = {
  volcano: { x: 128, y: 20 },
  lavaField: { x: 134, y: 40 },
  camp: { x: 56, y: 36 },
  cave: { x: 56, y: 30 },
  lake: { x: 76, y: 54 },
  waterfall: { x: 73, y: 30 },
  nest: { x: 102, y: 54 },
  swamp: { x: 110, y: 82 },
  tar: { x: 118, y: 88 },
  secretCave: { x: 92, y: 30 },
  glade: { x: 18, y: 25 },
  fossil: { x: 148, y: 64 },
  feeding: { x: 96, y: 70 },
  beach: { x: 40, y: 82 },
  jungle: { x: 24, y: 55 },
  forest: { x: 30, y: 22 },
  grass: { x: 110, y: 55 },
  mountains: { x: 80, y: 6 },
  /** the snowy Frostpeak range in the south-east (generation 1–2 maps; generation 3 has the Great Peaks) */
  frost: { x: 147, y: 80 },
  /** the central desert (generation 3 + the eastern lands) */
  desert: { x: 180, y: 62 },
  oasis: { x: 187, y: 50 },
  /** the Great Peaks: the big snowy massif in the east */
  peaks: { x: 250, y: 30 },
  /** a sheltered high valley in the Great Peaks (the Mountain Monks live here) */
  monastery: { x: 246, y: 46 },
  /** the high ledge where the monks meet the dragons once a year */
  altar: { x: 257, y: 21 },
  eastLake: { x: 236, y: 95 },
} as const;

/* ------------------------------ the eastern lands ------------------------------ */

/** The Great Peaks massif: centre + radii (tiles). */
const PEAKS = { x: 250, y: 30, rx: 42, ry: 40 };
/** Valley floors through the Great Peaks (walkable passes) and how deep each is carved (0..1). */
export const VALLEYS: { pts: [number, number][]; carve: number }[] = [
  // the west pass: up from the desert's edge into the high valley, and on out east
  { pts: [[206, 50], [220, 47], [234, 46], [246, 46], [261, 51], [287, 57]], carve: 0.62 },
  // the south valley: up from the lakes (past the falls) to the high valley
  { pts: [[238, 88], [242, 78], [244, 66], [245, 56], [246, 46]], carve: 0.62 },
  // the monks' path, high + snowy, up to the dragon ledge
  { pts: [[246, 46], [250, 37], [254, 28], [257, 21]], carve: 0.34 },
];
/** Frozen tarns high in the peaks (ice) and the lower mountain lake that feeds the falls. */
const TARNS = [
  { x: 239, y: 37, r: 2.1, ice: true },
  { x: 264, y: 41, r: 1.9, ice: true },
  { x: 244, y: 61, r: 2.3, ice: false },
];
/** The stream from the mountain lake, over the falls, to the east lake and the sea. */
const RIVER_EAST: [number, number][] = [
  [244, 62],
  [246, 70],
  [246, 74],
  [242, 82],
  [238, 89],
  [236, 95],
];
const RIVER_EAST_OUT: [number, number][] = [
  [236, 95],
  [233, 102],
  [236, 112],
];
/** the rock ledge the stream falls over (row, columns) */
const FALLS = { y: 72, x0: 245, x1: 251 };
/** Cave mouths in the peaks + in the desert's rock outcrops (tile of the mouth). */
export const EAST_CAVES = [
  { x: 233, y: 41, kind: "mountain" as const },
  { x: 262, y: 59, kind: "mountain" as const },
  { x: 271, y: 25, kind: "mountain" as const },
  { x: 197, y: 69, kind: "desert" as const },
  { x: 161, y: 50, kind: "desert" as const },
];
/** Desert oases: fresh water ringed with green. */
export const OASES = [
  { x: 187, y: 50, r: 2.4 },
  { x: 168, y: 72, r: 2.1 },
  { x: 197, y: 79, r: 1.8 },
];
/** A dry riverbed winding across the desert to the sea. */
const WADI: [number, number][] = [
  [205, 43],
  [195, 54],
  [183, 65],
  [171, 77],
  [161, 89],
  [155, 99],
];
const EAST_LAKE = { x: 236, y: 95, rx: 7, ry: 4.5 };

/** Big named regions (Terrain.region). 0 = the old valley + ordinary open country. */
export const REGION = { none: 0, desert: 1, peaks: 2, oasis: 3 } as const;

const smooth = (a: number, b: number, v: number) => {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** How far into the central desert a tile is (< 1 = desert, < 0.72 = the dunes). */
export function desertMask(x: number, y: number, seed: number) {
  const n = fbm(x / 14, y / 14, seed);
  return ((x - LM.desert.x) / 32) ** 2 + ((y - LM.desert.y) / 30) ** 2 + (n - 0.5) * 0.55;
}

/** Height of the Great Peaks at a tile (0 = not in the mountains, 0.8+ = bare peaks). */
export function peaksElev(x: number, y: number, seed: number) {
  const r = Math.hypot((x - PEAKS.x) / PEAKS.rx, (y - PEAKS.y) / PEAKS.ry) + (fbm(x / 11, y / 11, seed + 41) - 0.5) * 0.35;
  if (r >= 1.05) return 0;
  const mask = smooth(0, 0.55, 1.05 - r);
  // sharp ridges (cubed): bare rock only along the crests, broad snowfields + valleys between them
  const ridge = (1 - Math.abs(fbm(x / 7, y / 7, seed + 43) * 2 - 1)) ** 3;
  let e = mask * (0.42 + 0.6 * ridge);
  for (const v of VALLEYS) {
    const d = distToPolyline(x, y, v.pts);
    if (d < 9) e *= 1 - v.carve * Math.exp(-((d / 3.2) ** 2));
  }
  return Math.min(1, e);
}

/** Tar pits (tile coords + radius). The first is the original swamp pit. */
export const TAR_PITS = [
  { x: LM.tar.x, y: LM.tar.y, r: 2.4 },
  { x: 104, y: 79, r: 1.6 },
  { x: 132, y: 62, r: 1.4 },
];

/** Frostpeak ridge line (tile coords). */
export const FROST_RIDGE: [number, number][] = [
  [137, 77],
  [146, 79],
  [151, 81],
  [156, 85],
];

export type LandmarkId = keyof typeof LM;

const RIVER_TOP: [number, number][] = [
  [69, 0],
  [71, 8],
  [73, 16],
  [72, 24],
  [73, 31],
];
const RIVER_MID: [number, number][] = [
  [73, 31],
  [74, 38],
  [76, 46],
];
const RIVER_LOW: [number, number][] = [
  [77, 60],
  [83, 69],
  [80, 79],
  [87, 89],
  [84, 99],
  [87, 112],
];

function distToPolyline(px: number, py: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const ex = ax + dx * t - px;
    const ey = ay + dy * t - py;
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d < best) best = d;
  }
  return best;
}

export const coastY = (x: number, seed: number) => 98 + (fbm(x / 10, 0.5, seed + 3) - 0.5) * 9 - Math.max(0, 46 - x) * 0.75
  // the eastern lands reach a little further south
  + smooth(160, 205, x) * 7;
export const mountY = (x: number, seed: number) => 9 + (fbm(x / 8, 3.3, seed + 5) - 0.5) * 9;
export const cliffY = (x: number, seed: number) => 30 + (fbm(x / 9, 5.1, seed + 9) - 0.5) * 2.4;

/**
 * Map generations. Saved worlds remember theirs (the ground is saved as changes from what
 * was generated), so a newer generator only ever shapes brand-new worlds.
 *   1  the original map
 *   2  the northern range bulges south across the middle into big snowy peaks, cut by
 *      two valley passes (it always leaves the plateau, the cave + the waterfall clear)
 *   3  the world grows east: the central desert takes over Frostpeak's ground, and the
 *      Great Peaks (a real snowy massif) rise beyond it. Older worlds keep their own valley
 *      exactly as it was and get the new eastern lands beside it.
 */
export const TERRAIN_GEN = 3;
/** where the two passes cut through the bigger range (map columns) */
const PASSES = [63, 97];

/** How far south (extra rows) the northern range reaches at column x, in a generation-2 map. */
function rangeBulge(x: number, seed: number) {
  if (x <= 48 || x >= 112) return 0;
  const envelope = Math.sin((Math.PI * (x - 48)) / 64);
  let rows = envelope * (4 + fbm(x / 6, 7.7, seed + 21) * 5);
  for (const p of PASSES) rows *= 1 - Math.exp(-(((x - p) / 2.6) ** 2));
  // the plateau below always keeps at least six rows (the waterfall, the cave, the secret cave)
  return Math.max(0, Math.min(rows, cliffY(x, seed) - 6 - mountY(x, seed)));
}

export class Terrain {
  seed: number;
  tiles = new Uint8Array(MAP_W * MAP_H);
  /** original generated tiles (so edits can be diffed for saves) */
  base = new Uint8Array(MAP_W * MAP_H);
  height = new Float32Array(MAP_W * MAP_H);
  salt = new Uint8Array(MAP_W * MAP_H);
  /** how high up a tile is (0 = lowland … 1 = the bare peaks): snowcaps, cold, mountain life */
  elev = new Float32Array(MAP_W * MAP_H);
  /** the desert's dry riverbed (drawn as cracked mud) */
  wadi = new Uint8Array(MAP_W * MAP_H);
  /** which big region a tile belongs to (REGION): the desert, the Great Peaks, an oasis */
  region = new Uint8Array(MAP_W * MAP_H);
  /** bumps whenever a chunk's ground changes (renderer re-bakes it) */
  chunkVersion = new Uint32Array(CHUNKS_X * CHUNKS_Y);
  version = 0;
  /** walkable tiles next to fresh water, bucketed per chunk */
  private waterBuckets: number[][] = [];
  private waterDirty = true;

  /** which map generator shaped this world (see TERRAIN_GEN) */
  readonly gen: number;

  constructor(seed: number, gen = 1) {
    this.seed = seed;
    this.gen = gen;
    this.generate();
    this.base.set(this.tiles);
  }

  private generate() {
    const s = this.seed;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const n = fbm(x / 14, y / 14, s);
        const n2 = fbm(x / 5, y / 5, s + 7);
        let t: T = T.Grass;
        // gentle tilt toward the sea so lava + rivers flow south
        let h = 0.6 - (y / MAP_H) * 0.5 + (n - 0.5) * 0.12;

        const cy = coastY(x, s);
        const my = this.mountLine(x);
        const vd = Math.hypot(x - LM.volcano.x, (y - LM.volcano.y) * 1.15);
        const vRad = 13 + (n - 0.5) * 4;

        if (x < 46 + (n - 0.5) * 12 && y > 34) t = T.Jungle;
        if (x < 52 + (n - 0.5) * 10 && y <= 34) t = T.Forest;
        if (Math.hypot(x - LM.glade.x, y - LM.glade.y) < 3.2) t = T.Grass;
        if (x > 140 && n2 > 0.55) t = T.Rock;
        else if (n2 > 0.76 && t === T.Grass) t = T.Rock;

        // feeding grounds: soft fern meadow (just grass; plants make it lush)
        // swamp + mud + tar
        const sd = Math.hypot(x - LM.swamp.x, y - LM.swamp.y);
        if (sd < 15 + (n - 0.5) * 10) {
          t = T.Swamp;
          if (n2 > 0.63) t = T.Mud;
          else if (n2 < 0.3) t = T.Shallow;
          h -= 0.04;
        }
        for (const pit of TAR_PITS) if (Math.hypot(x - pit.x, y - pit.y) < pit.r + (n2 - 0.5) * 0.6) t = T.Tar;

        // Frostpeak: a short snowy ridge with snowfield skirts (generation 3 has the desert here instead)
        const fr = this.gen < 3 ? distToPolyline(x, y, FROST_RIDGE) + (n - 0.5) * 2.2 : 99;
        if (fr < 2.3) {
          t = T.Mountain;
          h += 0.9;
          this.elev[i] = 0.85;
        } else if (fr < 5.2) {
          t = n2 > 0.7 ? T.Mountain : n2 < 0.45 ? T.Snow : T.Rock;
          h += 0.45;
          this.elev[i] = 0.6;
        }

        // lava field from old eruptions
        if (Math.hypot(x - LM.lavaField.x, y - LM.lavaField.y) < 12 + (n2 - 0.5) * 6) t = T.Basalt;

        // volcano cone
        if (vd < vRad) {
          t = vd < 2.6 ? T.Mountain : T.Volcano;
          h += (1 - vd / (vRad + 3)) * 1.6;
        }

        // northern mountains + the plateau above the cliffs
        if (y < my) {
          t = y < my - 3 ? T.Mountain : T.Rock;
          h += (my - y) * 0.06 + 0.3;
          this.elev[i] = Math.max(this.elev[i], Math.min(0.95, 0.5 + (my - y) * 0.06));
        } else if (x >= 42 && x <= 102 && y < cliffY(x, s) && vd > vRad) {
          h += 0.25;
          if (t === T.Forest || t === T.Grass) t = n2 > 0.6 ? T.Rock : T.Grass;
        }

        // cliff line with a waterfall + caves
        const cly = cliffY(x, s);
        if (x >= 42 && x <= 102 && Math.abs(y - cly) < 0.95) {
          t = T.Cliff;
          h += 0.15;
        }

        // lake
        const le = ((x - LM.lake.x) / 12) ** 2 + ((y - LM.lake.y) / 8) ** 2 + (n2 - 0.5) * 0.5;
        if (le < 1) {
          t = le < 0.5 ? T.Deep : T.Shallow;
          h = 0.18;
        } else if (le < 1.25 && t !== T.Cliff) t = T.Sand;

        // river
        const rTop = distToPolyline(x, y, RIVER_TOP);
        const rMid = distToPolyline(x, y, RIVER_MID);
        const rLow = distToPolyline(x, y, RIVER_LOW);
        const rw = 1.5 + n * 1.2;
        const rd = Math.min(rTop, rMid, rLow);
        if (rd < rw) {
          if (rTop < rw && y <= 31 && t === T.Cliff) t = T.Cliff; // waterfall is drawn on the cliff
          else if (t !== T.Mountain || rTop < 1) t = T.River;
          h -= 0.05;
        } else if (rd < rw + 1.2 && (t === T.Grass || t === T.Jungle || t === T.Forest) && n2 > 0.45) t = T.Sand;

        // the eastern lands (and, in a generation-3 world, the desert's western reaches)
        if (x >= OLD_MAP_W || this.gen >= 3) {
          const east = this.eastLands(x, y, i, t, h, n, n2);
          t = east.t;
          h = east.h;
        }

        // ocean
        if (y > cy + 1.5) {
          t = y > cy + 5 + (n2 - 0.5) * 4 ? T.Deep : T.Shallow;
          this.salt[i] = 1;
          h = -0.2;
        } else if (y > cy - 3 + (n2 - 0.5) * 2) {
          if (t !== T.River) t = T.Sand;
        }

        // camp + nesting area + caves
        if (Math.hypot(x - LM.camp.x, (y - LM.camp.y) * 1.2) < 5.5) t = T.Dirt;
        if (Math.hypot(x - LM.nest.x, y - LM.nest.y) < 4) t = T.Nest;
        if (Math.abs(x - LM.cave.x) <= 1 && Math.abs(y - Math.round(cliffY(LM.cave.x, s))) < 1) t = T.Cave;
        if (Math.abs(x - LM.secretCave.x) < 1 && Math.abs(y - Math.round(cliffY(LM.secretCave.x, s))) < 1) t = T.Cave;

        this.tiles[i] = t;
        this.height[i] = h;
      }
    }
    // cave mouths need a walkable tile right below so you can reach them
    for (const c of [LM.cave, LM.secretCave]) {
      const cy = Math.round(cliffY(c.x, s));
      for (let dx = -1; dx <= 1; dx++) {
        const below = (cy + 1) * MAP_W + c.x + dx;
        if (this.tiles[below] === T.Cliff) this.tiles[below] = T.Dirt;
      }
    }
    // a land bridge so the plateau isn't cut off: open the cliff at both ends
    for (let y = 26; y < 34; y++) {
      for (const x of [42, 43, 101, 102]) {
        const i = y * MAP_W + x;
        if (this.tiles[i] === T.Cliff) this.tiles[i] = T.Rock;
      }
    }
    this.carveEast();
  }

  /**
   * One tile of the eastern lands: the central desert (dunes, rock outcrops, a dry riverbed,
   * oases), the Great Peaks (bare peaks, snowfields, glaciers, scree, alpine meadows, a pine
   * belt, carved passes) and the green lake country south of them.
   */
  private eastLands(x: number, y: number, i: number, t: T, h: number, n: number, n2: number) {
    const s = this.seed;
    const east = x >= OLD_MAP_W;
    if (east) {
      // open country by default: grassland with stands of forest (the old rocky east thins out)
      if ((t === T.Rock || t === T.Grass || t === T.Forest || t === T.Jungle) && y >= this.mountLine(x)) {
        const wood = fbm(x / 9, y / 9, s + 51);
        t = wood > 0.6 ? T.Forest : n2 > 0.8 ? T.Rock : T.Grass;
      }
    }
    // the desert (a generation-3 world's desert starts just past the volcano's lava field)
    const dm = desertMask(x, y, s);
    if (dm < 1 && t !== T.Mountain && t !== T.Volcano && t !== T.Basalt && t !== T.Tar && t !== T.Cliff) {
      t = dm < 0.72 ? T.Dune : T.Sand;
      this.region[i] = REGION.desert;
      if (n2 > 0.77 || (dm > 0.55 && n2 > 0.7)) t = T.Rock;
      // dune ridges: long low swells
      h += 0.05 + Math.sin(x * 0.55 + y * 0.18 + n * 6) * 0.03;
      this.elev[i] = Math.max(this.elev[i], 0.12);
      if (distToPolyline(x, y, WADI) < 1.1 + (n2 - 0.5) * 0.6) {
        t = T.Dirt;
        this.wadi[i] = 1;
        h -= 0.04;
      }
      for (const o of OASES) {
        const d = Math.hypot(x - o.x, (y - o.y) * 1.2) + (n2 - 0.5) * 0.8;
        if (d < o.r * 0.45) t = T.Deep;
        else if (d < o.r) t = T.Shallow;
        else if (d < o.r + 2.3) t = n2 > 0.5 ? T.Grass : T.Jungle;
        if (d < o.r) h = 0.2;
        if (d < o.r + 2.3) this.region[i] = REGION.oasis;
      }
    } else if (dm < 1.25 && (t === T.Grass || t === T.Forest || t === T.Jungle)) {
      // the desert's edge: scrubby, sandy, rocky
      t = n2 > 0.6 ? T.Rock : n2 > 0.4 ? T.Sand : T.Grass;
    }
    if (!east) return { t, h };
    // the Great Peaks
    const e = peaksElev(x, y, s);
    if (e > 0.2) this.region[i] = REGION.peaks;
    if (e > 0.2 && t !== T.Mountain) {
      this.elev[i] = Math.max(this.elev[i], e);
      h += e * 1.5;
      if (e > 0.8) t = T.Mountain;
      else if (e > 0.67) t = n2 > 0.78 ? T.Ice : T.Snow;
      else if (e > 0.56) t = n2 < 0.5 ? T.Snow : T.Rock;
      else if (e > 0.45) t = n2 > 0.58 ? T.Rock : T.Grass;
      else if (e > 0.31) t = T.Forest;
      else if (t !== T.Dune && t !== T.Sand) t = n2 > 0.55 ? T.Forest : T.Grass;
    } else if (t === T.Mountain) this.elev[i] = Math.max(this.elev[i], 0.85);
    for (const tn of TARNS) {
      const d = Math.hypot(x - tn.x, y - tn.y) + (n2 - 0.5) * 0.7;
      if (d < tn.r) {
        t = tn.ice ? T.Ice : d < tn.r * 0.5 ? T.Deep : T.Shallow;
        h = tn.ice ? h : 0.5;
      } else if (d < tn.r + 1.4 && t === T.Mountain) t = tn.ice ? T.Snow : T.Rock;
    }
    // the stream down from the mountain lake, the east lake, and out to the sea
    const rd = Math.min(distToPolyline(x, y, RIVER_EAST), distToPolyline(x, y, RIVER_EAST_OUT));
    if (rd < 1.2 + n * 0.8 && t !== T.Ice) {
      t = T.River;
      h -= 0.05;
    }
    const le = ((x - EAST_LAKE.x) / EAST_LAKE.rx) ** 2 + ((y - EAST_LAKE.y) / EAST_LAKE.ry) ** 2 + (n2 - 0.5) * 0.5;
    if (le < 1) {
      t = le < 0.5 ? T.Deep : T.Shallow;
      h = 0.18;
    } else if (le < 1.3 && t !== T.River) t = T.Sand;
    return { t, h };
  }

  /** After the main pass: cliffs on the steepest mountainsides, the falls, and the cave mouths. */
  private carveEast() {
    const s = this.seed;
    const { tiles, elev } = this;
    const E = (x: number, y: number) => elev[Math.max(0, Math.min(MAP_H - 1, y)) * MAP_W + Math.max(0, Math.min(MAP_W - 1, x))];
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = OLD_MAP_W; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        const t = tiles[i] as T;
        if (t !== T.Rock && t !== T.Snow && t !== T.Grass) continue;
        const e = elev[i];
        if (e < 0.46 || e > 0.79) continue;
        const grad = Math.hypot(E(x + 1, y) - E(x - 1, y), E(x, y + 1) - E(x, y - 1));
        // keep the passes open
        if (grad < 0.2 || hash2(x, y, s + 61) < 0.45 || VALLEYS.some((v) => distToPolyline(x, y, v.pts) < 3.5)) continue;
        tiles[i] = T.Cliff;
      }
    }
    // a lone cliff tile is just a speck: cliffs come in runs along the steep slopes
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = OLD_MAP_W; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        if (tiles[i] !== T.Cliff) continue;
        let run = 0;
        for (const j of [i - 1, i + 1, i - MAP_W, i + MAP_W, i - MAP_W - 1, i - MAP_W + 1, i + MAP_W - 1, i + MAP_W + 1]) if (tiles[j] === T.Cliff) run++;
        // (always snow: nothing grows on it, so the wild plants come out the same)
        if (run < 2) tiles[i] = T.Snow;
      }
    }
    // the falls: a rock ledge across the stream (the waterfall is drawn where river meets cliff)
    for (let x = FALLS.x0; x <= FALLS.x1; x++) {
      const i = FALLS.y * MAP_W + x;
      if (tiles[i] !== T.Deep && tiles[i] !== T.Shallow) tiles[i] = T.Cliff;
    }
    // cave mouths: a rock face with the opening at its foot, and open ground below it
    for (const c of EAST_CAVES) {
      if (c.x < OLD_MAP_W && this.gen < 3) continue;
      for (let dy = -3; dy <= 0; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.hypot(dx, dy * 1.3) > 3.2) continue;
          const i = (c.y + dy) * MAP_W + c.x + dx;
          if (tiles[i] !== T.Mountain) tiles[i] = dy === 0 && Math.abs(dx) <= 1 ? T.Cliff : T.Rock;
          elev[i] = Math.max(elev[i], c.kind === "desert" ? 0.3 : elev[i]);
        }
      tiles[c.y * MAP_W + c.x] = T.Cave;
      for (let dx = -1; dx <= 1; dx++) {
        const below = (c.y + 1) * MAP_W + c.x + dx;
        if (!isWalkTile(tiles[below] as T) || isWaterTile(tiles[below] as T)) tiles[below] = c.kind === "desert" ? T.Sand : T.Rock;
      }
    }
  }

  /** Where the northern mountains end, going south (in rows) at column x. */
  mountLine(x: number) {
    return mountY(x, this.seed) + (this.gen >= 2 ? rangeBulge(x, this.seed) : 0);
  }

  inBounds(tx: number, ty: number) {
    return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
  }

  tileAt(px: number, py: number): T {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (!this.inBounds(tx, ty)) return T.Mountain;
    return this.tiles[ty * MAP_W + tx];
  }

  heightAt(px: number, py: number) {
    const tx = Math.max(0, Math.min(MAP_W - 1, Math.floor(px / TILE)));
    const ty = Math.max(0, Math.min(MAP_H - 1, Math.floor(py / TILE)));
    return this.height[ty * MAP_W + tx];
  }

  isSalt(px: number, py: number) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    return this.inBounds(tx, ty) && this.salt[ty * MAP_W + tx] === 1;
  }

  setTile(tx: number, ty: number, t: T) {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * MAP_W + tx;
    if (this.tiles[i] === t) return;
    this.tiles[i] = t;
    this.chunkVersion[Math.floor(ty / CHUNK_TILES) * CHUNKS_X + Math.floor(tx / CHUNK_TILES)]++;
    this.version++;
    this.waterDirty = true;
  }

  /** tile index → type for every tile that differs from the generated map */
  edits(): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] !== this.base[i]) out.push([i, this.tiles[i]]);
    return out;
  }

  applyEdits(list: [number, number][]) {
    for (const [i, t] of list) {
      if (i < 0 || i >= this.tiles.length) continue;
      this.setTile(i % MAP_W, Math.floor(i / MAP_W), t as T);
    }
  }

  private rebuildWater() {
    this.waterBuckets = Array.from({ length: CHUNKS_X * CHUNKS_Y }, () => []);
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        if (!isWalkTile(this.tiles[i]) || isWaterTile(this.tiles[i])) continue;
        const nb = [i - 1, i + 1, i - MAP_W, i + MAP_W];
        if (nb.some((j) => isWaterTile(this.tiles[j]) && !this.salt[j])) {
          this.waterBuckets[Math.floor(y / CHUNK_TILES) * CHUNKS_X + Math.floor(x / CHUNK_TILES)].push(i);
        }
      }
    }
    this.waterDirty = false;
  }

  /** Nearest walkable spot beside fresh water, in world px (or null). */
  nearestDrink(px: number, py: number, maxDist = 2400): { x: number; y: number } | null {
    if (this.waterDirty) this.rebuildWater();
    const cx = Math.floor(px / TILE / CHUNK_TILES);
    const cy = Math.floor(py / TILE / CHUNK_TILES);
    let best = -1;
    let bestD = maxDist * maxDist;
    const maxRing = Math.ceil(maxDist / (TILE * CHUNK_TILES));
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let by = cy - ring; by <= cy + ring; by++) {
        for (let bx = cx - ring; bx <= cx + ring; bx++) {
          if (Math.max(Math.abs(bx - cx), Math.abs(by - cy)) !== ring) continue;
          if (bx < 0 || by < 0 || bx >= CHUNKS_X || by >= CHUNKS_Y) continue;
          for (const i of this.waterBuckets[by * CHUNKS_X + bx]) {
            const wx = (i % MAP_W) * TILE + TILE / 2;
            const wy = Math.floor(i / MAP_W) * TILE + TILE / 2;
            const d = (wx - px) ** 2 + (wy - py) ** 2;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
      // anything found in this ring beats anything further out (roughly)
      if (best >= 0 && ring >= 1) break;
    }
    if (best < 0) return null;
    return { x: (best % MAP_W) * TILE + TILE / 2, y: Math.floor(best / MAP_W) * TILE + TILE / 2 };
  }

  /** random tile center of a given type near a point (for spawning) */
  findTile(px: number, py: number, radius: number, ok: (t: T) => boolean, rnd: () => number, tries = 40) {
    for (let k = 0; k < tries; k++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * radius;
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      if (ok(this.tileAt(x, y))) return { x, y };
    }
    return null;
  }

  /** stable per-tile detail value */
  detail(tx: number, ty: number) {
    return hash2(tx, ty, this.seed);
  }
}

export const isWaterTile = (t: T) => t === T.Deep || t === T.Shallow || t === T.River;

export const isWalkTile = (t: T) => t !== T.Deep && t !== T.Mountain && t !== T.Cliff;

export const isSwimTile = (t: T) => t === T.Deep || t === T.Shallow;

/** Movement speed multiplier for ground walkers. */
export function groundSpeed(t: T) {
  switch (t) {
    case T.Shallow:
    case T.River:
      return 0.55;
    case T.Swamp:
      return 0.75;
    case T.Mud:
      return 0.6;
    case T.Tar:
      return 0.15;
    case T.Volcano:
      return 0.7;
    case T.Sand:
      return 0.9;
    case T.Dune:
      return 0.78;
    case T.Snow:
      return 0.72;
    case T.Ice:
      return 0.82;
    default:
      return 1;
  }
}

/** Open sand (the desert's dunes, beaches, sandy flats): Sand People blend in here, camels stride across it. */
export const isSandTile = (t: T) => t === T.Sand || t === T.Dune;

/** Snow + ice + bare rock high up: Ice Dragon + Mountain Monk country. */
export const isHighTile = (t: T) => t === T.Snow || t === T.Ice || t === T.Mountain;

export const VEG_TILES = new Set<T>([T.Grass, T.Jungle, T.Forest, T.Swamp, T.Nest]);
