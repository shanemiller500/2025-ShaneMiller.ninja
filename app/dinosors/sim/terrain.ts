/* ------------------------------------------------------------------ */
/*  Terrain: a hand-shaped macro layout (so every world has the same   */
/*  landmarks kids can learn) + seeded noise for natural edges.        */
/* ------------------------------------------------------------------ */
import { fbm, hash2 } from "./rng";
import { MAP_H, MAP_W, OLD_MAP_W, PREV_MAP_W, T, TILE } from "./types";

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
  /** the Mountain Monks' chapel on a high shoulder of the Great Peaks */
  monastery: { x: 254, y: 32 },
  /** the high ledge where the monks meet the dragons once a year */
  altar: { x: 257, y: 21 },
  eastLake: { x: 236, y: 95 },
  /** the second volcano, out in the far east (the land added at the map's east edge) + its old lava field */
  volcano2: { x: 318, y: 50 },
  lavaField2: { x: 322, y: 66 },
} as const;

/* ------------------------------ streams ------------------------------ */

/**
 * Small streams: narrow, wadeable water (River tiles) running down to the sea, with stretches of rapids
 * (white water over rocks: `rapids` on the segments listed). The far-east ones are in every world (that
 * land is new for everyone); the rest only in worlds made since (terrain generation 4), so no older
 * save finds a stream running through its buildings.
 */
export const STREAMS: { pts: [number, number][]; rapids: number[]; gen: number }[] = [
  // the far east: down from the northern mountains, past the second volcano, to the sea
  { pts: [[298, 12], [296, 30], [298, 46], [300, 62], [304, 80], [306, 96], [308, 107]], rapids: [0, 1, 4], gen: 0 },
  // a brook along the far east's western edge
  { pts: [[289, 66], [291, 80], [288, 94], [290, 106]], rapids: [1], gen: 0 },
  // through the western jungle
  { pts: [[14, 34], [16, 50], [22, 66], [30, 80], [35, 93]], rapids: [0, 2], gen: 4 },
  // south of the volcano, through the grassland
  { pts: [[132, 52], [136, 66], [134, 80], [138, 96], [140, 103]], rapids: [1, 3], gen: 4 },
  // the eastern lake country
  { pts: [[212, 60], [214, 76], [218, 92], [222, 105]], rapids: [0, 2], gen: 4 },
];

/** Distance from a point to a polyline, and which segment is nearest. */
function nearSeg(px: number, py: number, pts: [number, number][]) {
  let best = Infinity;
  let seg = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(ax + dx * t - px, ay + dy * t - py);
    if (d < best) {
      best = d;
      seg = i;
    }
  }
  return { d: best, seg };
}

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
export const REGION = { none: 0, desert: 1, peaks: 2, oasis: 3, crags: 4, alps: 5 } as const;

/* ------------------------------ the mountain ranges (generation 5) ------------------------------ */

/**
 * Mountain ranges between the map's sections (terrain generation 5). Each is a long ridge: an unbroken
 * crest of bare mountain nobody can climb, steep slopes with cliff runs, scree + alpine meadows, then a
 * pine-forest belt down its flanks. The only ways across are its passes (a worn trail over a saddle) and
 * the gorges its streams cut. Snow-capped ones rise above the snow line and stay white all year; rocky ones
 * stay just under it (bare rock, white only in winter, like the rest of the map). Each runs into the
 * northern mountains or out into the sea (as sea cliffs), so there's no walking round the end.
 */
export interface MountainRange {
  id: string;
  name: string;
  /** the crest line (tiles) */
  pts: [number, number][];
  /** half-width to the foot of the foothills (tiles) */
  w: number;
  /** above the snow line: white peaks + snowfields all year */
  snowy: boolean;
  /** dry country: scrub + bare rock lower down, not pine forest */
  dry?: boolean;
  /** the ways over: a line across the range (tiles) + how wide the saddle is */
  passes: { name: string; pts: [number, number][]; r: number }[];
}

export const RANGES: MountainRange[] = [
  {
    id: "mossback", name: "Mossback Ridge", snowy: false, w: 7,
    pts: [[42, 6], [42, 22], [40, 36], [37, 50], [40, 64], [38, 78], [39, 94], [38, 106]],
    passes: [{ name: "Glade Pass", pts: [[32, 22], [50, 22]], r: 2.6 }, { name: "Jungle Pass", pts: [[30, 56], [47, 56]], r: 2.6 }, { name: "Beach Pass", pts: [[30, 84], [47, 84]], r: 3 }],
  },
  {
    id: "sentinel", name: "Sentinel Range", snowy: true, w: 10,
    pts: [[150, 6], [152, 22], [151, 38], [154, 56], [151, 72], [152, 88], [158, 99], [160, 108]],
    passes: [{ name: "Ashfall Pass", pts: [[142, 42], [159, 42]], r: 2.8 }, { name: "Fossil Pass", pts: [[140, 64], [158, 64]], r: 3 }, { name: "Gull Pass", pts: [[141, 92], [158, 92]], r: 2.8 }],
  },
  {
    id: "redrock", name: "Redrock Range", snowy: false, dry: true, w: 7,
    pts: [[205, 54], [207, 68], [204, 82], [206, 96], [205, 110]],
    passes: [{ name: "Red Gate", pts: [[197, 74], [214, 74]], r: 2.8 }, { name: "Saltwind Pass", pts: [[197, 95], [214, 95]], r: 3 }],
  },
  {
    id: "icefang", name: "Icefang Range", snowy: true, w: 9,
    pts: [[285, 4], [286, 24], [282, 44], [279, 64], [277, 84], [276, 108]],
    passes: [{ name: "Pilgrim Pass", pts: [[273, 57], [293, 57]], r: 3 }, { name: "Southwind Pass", pts: [[268, 86], [286, 86]], r: 3 }],
  },
];

/** The gorges: streams + rivers cut through any range they cross. */
const GORGES = (gen: number) => [...STREAMS.filter((st) => gen >= st.gen).map((st) => st.pts), RIVER_EAST, RIVER_EAST_OUT];

/** How high a mountain range stands at a tile: 0 off every range, ~1 on a crest. `crest` = the unclimbable ridge line. */
export function rangeElev(x: number, y: number, seed: number, gen: number): { e: number; k: number; crest: boolean; raw: number; trail: boolean } {
  let best = { e: 0, k: -1, crest: false, raw: 0, trail: false };
  for (let k = 0; k < RANGES.length; k++) {
    const r = RANGES[k];
    const d0 = distToPolyline(x, y, r.pts);
    if (d0 > r.w + 4) continue;
    // ragged edges: the foothills wander in and out
    const d = d0 + (fbm(x / 6, y / 6, seed + 71 + k * 13) - 0.5) * r.w * 0.55;
    if (d >= r.w) continue;
    // a broad high shoulder either side of the crest, falling away to the foothills
    const core = smooth(r.w, 0, d) ** 0.55;
    // knobbly crests + side spurs
    const noise = fbm(x / 4, y / 4, seed + 81 + k * 7);
    const spur = (1 - Math.abs(fbm(x / 5, y / 5, seed + 91 + k * 5) * 2 - 1)) ** 2;
    const raw = core * (0.8 + 0.25 * noise) + spur * 0.12 * core;
    // the passes: a saddle across the ridge
    let carve = 1;
    let trail = false;
    for (const p of r.passes) {
      const dp = distToPolyline(x, y, p.pts);
      carve *= 1 - 0.9 * Math.exp(-((dp / p.r) ** 2));
      if (dp < 0.9) trail = true;
    }
    // the gorges: water cuts right through
    for (const g of GORGES(gen)) {
      const ds = distToPolyline(x, y, g);
      if (ds < 7) carve *= 1 - 0.95 * Math.exp(-((ds / 2.3) ** 2));
    }
    const e = raw * carve;
    if (e <= best.e) continue;
    best = { e, k, crest: d < 1.6 && carve > 0.5, raw, trail: trail && raw > 0.35 };
  }
  return best;
}

/** The pass a tile is in (right on its saddle), with its range: or null. (tiles) */
export function passAt(x: number, y: number): { range: MountainRange; pass: MountainRange["passes"][number] } | null {
  for (const r of RANGES) {
    if (distToPolyline(x, y, r.pts) > r.w * 0.6) continue;
    for (const p of r.passes) if (distToPolyline(x, y, p.pts) < p.r) return { range: r, pass: p };
  }
  return null;
}

/** Is (x, y) within a range's pass, where nothing must block the way? (tiles) */
export function inPass(x: number, y: number, pad = 3.5) {
  for (const r of RANGES) for (const p of r.passes) if (distToPolyline(x, y, p.pts) < p.r + pad) return true;
  return false;
}

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
/**
 * The newest map generator: worlds started in the game use it (engine.ts). Generation 4 adds the small
 * streams through the old lands (STREAMS); generation 5 the mountain ranges between the sections (RANGES),
 * with their passes, pine forests + mountain animals. The far east (the second volcano's land) is in every generation.
 */
export const TERRAIN_GEN = 5;
/**
 * What `new World(seed)` builds when no generation is given: the layout before the old lands' streams, so
 * every scripted / seeded world (the tests' worlds) keeps exactly the land it was written for.
 */
export const BASE_TERRAIN_GEN = 3;
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
  /** white water: a stream's rapids (STREAMS) */
  rapids = new Uint8Array(MAP_W * MAP_H);
  /** which big region a tile belongs to (REGION): the desert, the Great Peaks, an oasis */
  region = new Uint8Array(MAP_W * MAP_H);
  /** which mountain range a tile is part of (RANGES index + 1; 0 = none), generation 5 */
  range = new Uint8Array(MAP_W * MAP_H);
  /** how high its range stands there (0..1; for the cliffs + the animals' slopes) */
  rangeHeight = new Float32Array(MAP_W * MAP_H);
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

        // the far east's volcano: its old lava field, then the cone
        if (x >= PREV_MAP_W - 20) {
          if (Math.hypot(x - LM.lavaField2.x, y - LM.lavaField2.y) < 9 + (n2 - 0.5) * 5) t = T.Basalt;
          const vd2 = Math.hypot(x - LM.volcano2.x, (y - LM.volcano2.y) * 1.15);
          if (vd2 < vRad) {
            t = vd2 < 2.6 ? T.Mountain : T.Volcano;
            h += (1 - vd2 / (vRad + 3)) * 1.6;
            this.elev[i] = Math.max(this.elev[i], 0.3);
          }
        }

        // the mountain ranges between the sections (generation 5)
        if (this.gen >= 5) {
          const rg = this.rangeTile(x, y, i, t, h, n2);
          t = rg.t;
          h = rg.h;
        }

        // small streams (with rapids) running down to the sea
        for (const st of STREAMS) {
          if (this.gen < st.gen) continue;
          const ns = nearSeg(x, y, st.pts);
          const sw = 0.7 + n * 0.5;
          if (ns.d >= sw + 1.3) continue;
          if (t === T.Mountain || t === T.Cliff || t === T.Cave || t === T.Volcano || t === T.Tar || t === T.Deep) continue;
          if (ns.d < sw) {
            t = T.River;
            h -= 0.05;
            if (st.rapids.includes(ns.seg)) this.rapids[i] = 1;
          } else if ((t === T.Grass || t === T.Jungle || t === T.Forest) && n2 > 0.55) t = T.Sand;
        }

        // ocean (a mountain range runs on out into the shallows as sea stacks: no wading round its end)
        if (this.gen >= 5 && y > cy + 1.5 && this.range[i] && this.rangeHeight[i] > 0.72 && y < cy + 6) {
          t = T.Mountain;
        } else if (y > cy + 1.5) {
          t = y > cy + 5 + (n2 - 0.5) * 4 ? T.Deep : T.Shallow;
          this.salt[i] = 1;
          h = -0.2;
        } else if (y > cy - 3 + (n2 - 0.5) * 2) {
          // (a mountain range meets the sea in cliffs, not a beach to walk round it on)
          if (t !== T.River && !(this.range[i] && (t === T.Mountain || t === T.Cliff || t === T.Rock || t === T.Snow))) t = T.Sand;
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
    if (this.gen >= 5) this.carveRanges();
  }

  /** One tile of a mountain range (generation 5): crest, slopes, scree, meadows, the forest belt, a pass's trail. */
  private rangeTile(x: number, y: number, i: number, t: T, h: number, n2: number) {
    // water, the volcanoes + their lava, tar and caves keep their ground
    if (t === T.Deep || t === T.Shallow || t === T.River || t === T.Volcano || t === T.Basalt || t === T.Tar || t === T.Cave || t === T.Nest) return { t, h };
    const r = rangeElev(x, y, this.seed, this.gen);
    // (a pass's trail runs right over the low saddle, where the range has all but dipped away)
    if (r.k < 0 || (r.e < 0.12 && !r.trail)) return { t, h };
    const def = RANGES[r.k];
    const e = r.e;
    // (the northern mountains + the old cliffs stay as they are: a range never opens a way round its end)
    const keep = (t === T.Mountain || t === T.Cliff) && !r.trail;
    this.range[i] = r.k + 1;
    this.rangeHeight[i] = e;
    if (this.region[i] !== REGION.peaks) this.region[i] = def.snowy ? REGION.alps : REGION.crags;
    h += e * 1.4;
    const lift = (v: number) => (this.elev[i] = Math.max(this.elev[i], v));
    if (keep) return { t, h };
    if (r.crest || e > 0.8) {
      t = T.Mountain;
      lift(def.snowy ? Math.min(0.95, 0.62 + e * 0.33) : 0.5);
    } else if (r.trail) {
      // a worn trail over the saddle
      t = T.Dirt;
      lift(def.snowy ? Math.min(0.58, e) : Math.min(0.42, e * 0.6));
    } else if (def.snowy) {
      if (e > 0.64) t = n2 < 0.6 ? T.Snow : T.Rock;
      else if (e > 0.5) t = n2 < 0.4 ? T.Grass : T.Rock;
      else if (e > 0.3) t = n2 > 0.76 ? T.Grass : T.Forest;
      else t = n2 > 0.45 ? T.Forest : T.Grass;
      lift(e > 0.64 ? Math.max(0.62, e) : e > 0.5 ? e : e * 0.85);
    } else {
      // (rocky ranges stay under the snow line: no snow on them but winter's)
      if (e > 0.6) t = T.Rock;
      else if (e > 0.45) t = n2 > 0.45 ? T.Rock : T.Grass;
      else if (def.dry) t = e > 0.28 ? (n2 > 0.55 ? T.Rock : T.Grass) : n2 > 0.6 ? T.Sand : T.Grass;
      else if (e > 0.28) t = n2 > 0.78 ? T.Grass : T.Forest;
      else t = n2 > 0.5 ? T.Forest : T.Grass;
      lift(Math.min(0.5, e * 0.62));
    }
    return { t, h };
  }

  /** Cliff runs on a range's steepest slopes (never in a pass), after the main pass. */
  private carveRanges() {
    const s = this.seed;
    const { tiles, rangeHeight: E0, range } = this;
    const E = (x: number, y: number) => E0[Math.max(0, Math.min(MAP_H - 1, y)) * MAP_W + Math.max(0, Math.min(MAP_W - 1, x))];
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        if (!range[i]) continue;
        const t = tiles[i] as T;
        if (t !== T.Rock && t !== T.Snow && t !== T.Grass) continue;
        const e = E0[i];
        if (e < 0.5 || e > 0.8) continue;
        const grad = Math.hypot(E(x + 1, y) - E(x - 1, y), E(x, y + 1) - E(x, y - 1));
        if (grad < 0.22 || hash2(x, y, s + 67) < 0.5 || inPass(x, y)) continue;
        tiles[i] = T.Cliff;
      }
    }
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        if (tiles[i] !== T.Cliff || !range[i]) continue;
        let run = 0;
        for (const j of [i - 1, i + 1, i - MAP_W, i + MAP_W, i - MAP_W - 1, i - MAP_W + 1, i + MAP_W - 1, i + MAP_W + 1]) if (tiles[j] === T.Cliff || tiles[j] === T.Mountain) run++;
        if (run < 2) tiles[i] = T.Rock;
      }
    }
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
        if (grad < 0.2 || hash2(x, y, s + 61) < 0.45 || VALLEYS.some((v) => distToPolyline(x, y, v.pts) < 3.5) || (this.gen >= 5 && inPass(x, y))) continue;
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
