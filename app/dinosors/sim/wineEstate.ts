/* ------------------------------------------------------------------ */
/*  Wine estates: wineries built side by side (touching, or a tile     */
/*  apart) get rows of trellised vines planted on the open land round  */
/*  them. Each winery still looks + presses as its own; the vines are  */
/*  only drawn.                                                        */
/*                                                                     */
/*  The vines follow the land: they spread tile by tile out from the   */
/*  wineries over dry open ground only (grass, forest floor), never onto */
/*  water, beach or bog, and keep a tile clear of anything we've built */
/*  (walls, towers, homes, paths, fields, the camp floor). Wild growth */
/*  on those tiles is cleared (buildClear.ts) so the rows show.        */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { clusters } from "./cluster";
import { MAP_H, MAP_W, T, TILE, type Building } from "./types";
import type { World } from "./world";

export interface WineEstate {
  wineries: Building[];
  /** the joined wineries' footprint (px) */
  house: { x0: number; y0: number; x1: number; y1: number };
  /** the vine tiles (tile indices) */
  vines: number[];
}

/** Ground vines will grow on. */
const VINE_GROUND = new Set<T>([T.Grass, T.Jungle, T.Forest, T.Dirt]);
const WATER = new Set<T>([T.Deep, T.Shallow, T.River, T.Swamp, T.Mud, T.Tar, T.Ice]);
/** Seconds the estates are reused (the land + what's built round them change slowly). */
const EVERY = 2;

const cache = new WeakMap<World, { t: number; v: number; n: number; list: WineEstate[] }>();

/** Every estate (two or more joined wineries), with its vines. */
export function wineryEstates(w: World): WineEstate[] {
  const ws = w.colony.buildings.filter((b) => b.kind === "winery" && b.built >= 1 && !b.lift);
  const c = cache.get(w);
  if (c && c.v === w.colony.version && c.n === ws.length && Math.abs(w.elapsed - c.t) < EVERY) return c.list;
  const list: WineEstate[] = [];
  if (ws.length > 1) {
    const { w: bw, h: bh } = BUILDINGS.winery;
    // touching, or with one tile between them
    const touch = (a: Building, b: Building) => a.tx <= b.tx + bw + 1 && b.tx <= a.tx + bw + 1 && a.ty <= b.ty + bh + 1 && b.ty <= a.ty + bh + 1;
    let built: Set<number> | null = null;
    for (const g of clusters(ws, touch)) {
      if (g.length < 2) continue;
      const wineries = g.map((i) => ws[i]);
      const tx0 = Math.min(...wineries.map((b) => b.tx));
      const ty0 = Math.min(...wineries.map((b) => b.ty));
      const tx1 = Math.max(...wineries.map((b) => b.tx + bw));
      const ty1 = Math.max(...wineries.map((b) => b.ty + bh));
      const house = { x0: tx0 * TILE, y0: ty0 * TILE, x1: tx1 * TILE, y1: ty1 * TILE };
      built ??= builtTiles(w);
      list.push({ wineries, house, vines: spreadVines(w, tx0, ty0, tx1, ty1, 2 + Math.min(3, wineries.length), built) });
    }
  }
  cache.set(w, { t: w.elapsed, v: w.colony.version, n: ws.length, list });
  return list;
}

/** Everything we've built, by tile (the vines keep a tile clear of all of it). */
function builtTiles(w: World) {
  const s = w.colony.occupied(w);
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty <= Math.min(MAP_H - 1, Math.floor(y1 / TILE)); ty++)
      for (let tx = Math.max(0, Math.floor(x0 / TILE)); tx <= Math.min(MAP_W - 1, Math.floor(x1 / TILE)); tx++) s.add(ty * MAP_W + tx);
  };
  for (const b of w.colony.buildings) if (b.kind === "path" || b.kind === "bridge") {
    const d = BUILDINGS[b.kind];
    rect(b.tx * TILE, b.ty * TILE, (b.tx + d.w) * TILE - 1, (b.ty + d.h) * TILE - 1);
  }
  for (const f of w.tribe.farms) rect(f.x - 38, f.y - 22, f.x + 38, f.y + 22);
  for (const f of w.campfires) rect(f.x - 18, f.y - 14, f.x + 18, f.y + 14);
  for (const z of w.tribe.zones ?? []) rect(z.x - 20, z.y - 20, z.x + 20, z.y + 20);
  rect(w.camp.x - 170, w.camp.y - 105, w.camp.x + 170, w.camp.y + 105);
  return s;
}

/** The vine tiles: out from the wineries, step by step over good dry ground, up to `reach` tiles. */
function spreadVines(w: World, tx0: number, ty0: number, tx1: number, ty1: number, reach: number, built: Set<number>) {
  const tiles = w.terrain.tiles;
  const own = (tx: number, ty: number) => tx >= tx0 && tx < tx1 && ty >= ty0 && ty < ty1;
  const ok = (tx: number, ty: number) => {
    if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return false;
    if (!VINE_GROUND.has(tiles[ty * MAP_W + tx] as T)) return false;
    // a tile clear of water, beach and anything built (other than these wineries) all round
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = (ty + dy) * MAP_W + tx + dx;
      const t = tiles[i] as T;
      if (WATER.has(t) || t === T.Sand || t === T.Dune) return false;
      if (built.has(i) && !own(tx + dx, ty + dy)) return false;
    }
    return true;
  };
  const dist = new Map<number, number>();
  const queue: number[] = [];
  // start from the ring of tiles right round the wineries
  for (let ty = ty0 - 1; ty <= ty1; ty++) for (let tx = tx0 - 1; tx <= tx1; tx++) {
    if (own(tx, ty) || !ok(tx, ty)) continue;
    const i = ty * MAP_W + tx;
    dist.set(i, 1);
    queue.push(i);
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const d = dist.get(i)!;
    if (d >= reach) continue;
    const tx = i % MAP_W;
    const ty = (i - tx) / MAP_W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = tx + dx;
      const ny = ty + dy;
      const n = ny * MAP_W + nx;
      if (dist.has(n) || own(nx, ny) || !ok(nx, ny)) continue;
      dist.set(n, d + 1);
      queue.push(n);
    }
  }
  // the door side stays open: a lane straight out from the wineries' front
  const mid = Math.floor((tx0 + tx1) / 2);
  return queue.filter((i) => {
    const tx = i % MAP_W;
    const ty = (i - tx) / MAP_W;
    return !(ty >= ty1 && (tx === mid || tx === mid - 1));
  });
}

/** Once, when the first wineries join up: tell the player. */
export function announceEstates(w: World) {
  if (w.flags.has("wineVines")) return;
  const e = wineryEstates(w)[0];
  if (!e) return;
  w.flags.add("wineVines");
  w.toast("🍷", "The wineries are planting rows of vines on the open land round them!", (e.house.x0 + e.house.x1) / 2, e.house.y1);
}
