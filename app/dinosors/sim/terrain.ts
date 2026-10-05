/* ------------------------------------------------------------------ */
/*  Terrain: a hand-shaped macro layout (so every world has the same   */
/*  landmarks kids can learn) + seeded noise for natural edges.        */
/* ------------------------------------------------------------------ */
import { fbm, hash2 } from "./rng";
import { MAP_H, MAP_W, T, TILE } from "./types";

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
} as const;

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

export const coastY = (x: number, seed: number) => 98 + (fbm(x / 10, 0.5, seed + 3) - 0.5) * 9 - Math.max(0, 46 - x) * 0.75;
export const mountY = (x: number, seed: number) => 9 + (fbm(x / 8, 3.3, seed + 5) - 0.5) * 9;
export const cliffY = (x: number, seed: number) => 30 + (fbm(x / 9, 5.1, seed + 9) - 0.5) * 2.4;

export class Terrain {
  seed: number;
  tiles = new Uint8Array(MAP_W * MAP_H);
  /** original generated tiles (so edits can be diffed for saves) */
  base = new Uint8Array(MAP_W * MAP_H);
  height = new Float32Array(MAP_W * MAP_H);
  salt = new Uint8Array(MAP_W * MAP_H);
  /** bumps whenever a chunk's ground changes (renderer re-bakes it) */
  chunkVersion = new Uint32Array(CHUNKS_X * CHUNKS_Y);
  version = 0;
  /** walkable tiles next to fresh water, bucketed per chunk */
  private waterBuckets: number[][] = [];
  private waterDirty = true;

  constructor(seed: number) {
    this.seed = seed;
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
        const my = mountY(x, s);
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
        if (Math.hypot(x - LM.tar.x, y - LM.tar.y) < 2.4) t = T.Tar;

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
    default:
      return 1;
  }
}

export const VEG_TILES = new Set<T>([T.Grass, T.Jungle, T.Forest, T.Swamp, T.Nest]);

export const tileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
