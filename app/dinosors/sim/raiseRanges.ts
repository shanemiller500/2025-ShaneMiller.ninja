/* ------------------------------------------------------------------ */
/*  Raising the mountain ranges into a world that already exists.      */
/*                                                                     */
/*  New worlds are born with the ranges (terrain generation 5). An     */
/*  older saved world gets them raised once, when the game loads it:   */
/*  the same four ranges, on the same lines, but only on untouched     */
/*  ground. Everything the world has built or settled is kept clear,   */
/*  with a margin: our buildings, walls, towers, Scorpions, homes,     */
/*  farms, roads + anything we've dug or cleared, the camp itself,     */
/*  every other people's camp, the dragons' nests, the deposits, the   */
/*  landmarks + caves, and wherever anyone's standing. Where a range   */
/*  meets one of those, its crest simply stops short (a way through).  */
/*                                                                     */
/*  After the rise: anyone left on new rock is moved to open ground,   */
/*  trees on the new peaks + trails go, pines grow on the new forest   */
/*  belts, a little ore turns up on the slopes, and snow, fire fuel +  */
/*  paths are worked out afresh. Which tiles were kept clear is saved  */
/*  with the world, so the ranges' heights come back on every load.    */
/* ------------------------------------------------------------------ */
import { BUILDINGS, NODES } from "../data/colony";
import { CAMP_LEVELS } from "../data/facts";
import { generatePlants } from "./plants";
import { hash2 } from "./rng";
import { EAST_CAVES, isWalkTile, LM, OASES, RANGES } from "./terrain";
import { MAP_H, MAP_W, T, TILE } from "./types";
import type { World } from "./world";

const N = MAP_W * MAP_H;

/** Mark a disc of tiles (centre in px, radius in tiles). */
function disc(m: Uint8Array, px: number, py: number, rTiles: number) {
  const cx = px / TILE;
  const cy = py / TILE;
  const r = Math.max(0.5, rTiles);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m[y * MAP_W + x] = 1;
    }
  }
}
/** Mark a box of tiles (inclusive, with a margin). */
function box(m: Uint8Array, tx0: number, ty0: number, tx1: number, ty1: number, pad: number) {
  for (let y = ty0 - pad; y <= ty1 + pad; y++) {
    for (let x = tx0 - pad; x <= tx1 + pad; x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      m[y * MAP_W + x] = 1;
    }
  }
}
const pts = <T extends { x: number; y: number }>(list: T[] | undefined | null) => (Array.isArray(list) ? list : []);

/** Every tile the ranges must stay off in this world. */
export function rangeKeepMask(w: World): Uint8Array {
  const m = new Uint8Array(N);
  const t = w.terrain;
  // anything we've dug, paved, cleared or bridged: the world's own edits to the ground
  for (let i = 0; i < N; i++) if (t.tiles[i] !== t.base[i]) disc(m, (i % MAP_W) * TILE + TILE / 2, Math.floor(i / MAP_W) * TILE + TILE / 2, 1.5);
  // the camp and the whole settlement round it
  disc(m, w.camp.x, w.camp.y, CAMP_LEVELS[w.tribe.level].radius / TILE + 6);
  for (const b of w.colony.buildings) {
    const def = BUILDINGS[b.kind];
    box(m, b.tx, b.ty, b.tx + (def?.w ?? 2) - 1, b.ty + (def?.h ?? 2) - 1, 3);
  }
  for (const wl of w.tribe.walls) box(m, wl.tx, wl.ty, wl.tx, wl.ty, 3);
  for (const tw of w.tribe.towers) box(m, tw.tx, tw.ty, tw.tx + 1, tw.ty + 1, 3);
  for (const s of w.colony.scorpions) box(m, s.tx, s.ty, s.tx, s.ty, 3);
  for (const f of w.tribe.farms) disc(m, f.x, f.y, 4);
  for (const s of w.shelters) disc(m, s.x, s.y, 4);
  for (const n of w.colony.nodes) disc(m, n.x, n.y, 2);
  for (const g of w.colony.wagons) disc(m, g.homeX, g.homeY, 3);
  for (const c of w.colony.chariots) disc(m, c.homeX, c.homeY, 4);
  // the other peoples' camps, villages + holds (their own ground, and room round it)
  const camps: { x: number; y: number; r?: number }[] = [
    ...pts(w.forest.tribes), ...pts(w.seaFolk.tribes), ...pts(w.sandFolk.tribes), ...pts(w.snowFolk.tribes),
    ...pts(w.rivals.clans), ...pts(w.rivals.holds),
  ];
  for (const c of camps) disc(m, c.x, c.y, (c.r ?? 160) / TILE + 5);
  for (const nest of w.dragons.nests) disc(m, nest.x, nest.y, 6);
  for (const e of w.eggs) disc(m, e.x, e.y, 2);
  // everyone standing about (nobody gets walled in)
  for (const h of w.humans) disc(m, h.x, h.y, 2);
  for (const b of w.rivals.brutes) disc(m, b.x, b.y, 1.5);
  // the landmarks, caves + oases
  for (const p of Object.values(LM)) disc(m, p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, 3);
  for (const c of EAST_CAVES) disc(m, c.x * TILE + TILE / 2, c.y * TILE + TILE / 2, 4);
  for (const o of OASES) disc(m, o.x * TILE, o.y * TILE, o.r + 4);
  return m;
}

/** Nearest open, walkable ground to (px) within `r` tiles (or null). */
function openNear(w: World, x: number, y: number, r = 10) {
  const tx0 = Math.floor(x / TILE);
  const ty0 = Math.floor(y / TILE);
  for (let ring = 1; ring <= r; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const tx = tx0 + dx;
        const ty = ty0 + dy;
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
        const tt = w.terrain.tiles[ty * MAP_W + tx] as T;
        if (isWalkTile(tt) && tt !== T.Shallow && tt !== T.River) return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      }
    }
  }
  return null;
}

/** Ground nothing grows on now (the new crests, cliffs, snowfields + the passes' trails). */
const BARE = new Set<T>([T.Mountain, T.Cliff, T.Snow, T.Ice, T.Dirt]);

/**
 * Raise the ranges into an older world (once). Returns how many tiles rose, or 0 if it already has them.
 * Runs when the game loads a saved world (engine.ts), never on a world being made.
 */
export function raiseRanges(w: World): number {
  const t = w.terrain;
  if (t.hasRanges) return 0;
  const keep = rangeKeepMask(w);
  const before = t.tiles.slice();
  const changed = t.applyRanges(keep, true);
  t.raised = true;
  t.rangeKeep = keep;
  if (!changed) return 0;
  // anyone (or anything) left standing on new rock steps off it onto open ground
  for (const e of [...w.humans, ...w.dinos, ...w.rivals.brutes] as { x: number; y: number; z?: number; kind?: string; species?: string }[]) {
    if ((e.z ?? 0) > 4) continue;
    const tt = t.tileAt(e.x, e.y);
    if (isWalkTile(tt)) continue;
    // (sea creatures in the deep are fine where they are)
    if (tt === T.Deep && e.kind === "dino") continue;
    const p = openNear(w, e.x, e.y);
    if (p) {
      e.x = p.x;
      e.y = p.y;
    }
  }
  for (const it of w.items) {
    if (isWalkTile(t.tileAt(it.x, it.y))) continue;
    const p = openNear(w, it.x, it.y);
    if (p) {
      it.x = p.x;
      it.y = p.y;
    }
  }
  // trees on the new peaks + trails go; pines + scrub grow on the new forest belts + slopes
  const rose = (i: number) => t.tiles[i] !== before[i];
  w.plants = w.plants.filter((p) => {
    const i = Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE);
    return !(rose(i) && BARE.has(t.tiles[i] as T)) && isWalkTile(t.tiles[i] as T);
  });
  generatePlants(w, (tx, ty) => {
    const i = ty * MAP_W + tx;
    return rose(i) && !BARE.has(t.tiles[i] as T);
  });
  w.plantsDirty = true;
  // a little ore on each range's slopes
  for (let k = 0; k < RANGES.length; k++) {
    const r = RANGES[k];
    const want: (keyof typeof NODES)[] = ["iron", "iron", "stone", r.snowy ? "silver" : "copper"];
    let placed = 0;
    for (let i = 0; i < N && placed < want.length; i++) {
      if (t.range[i] !== k + 1 || keep[i] || !rose(i)) continue;
      const e = t.rangeHeight[i];
      if (e < 0.4 || e > 0.75 || !isWalkTile(t.tiles[i] as T) || t.tiles[i] === T.Dirt) continue;
      const tx = i % MAP_W;
      const ty = Math.floor(i / MAP_W);
      if (hash2(tx, ty, t.seed + 97 + k) > 0.04) continue;
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      if (w.colony.nodes.some((o) => Math.hypot(o.x - x, o.y - y) < 160)) continue;
      const kind = want[placed++];
      const def = NODES[kind];
      const amount = Math.round(def.amount[0] + hash2(ty, tx, t.seed + 5) * (def.amount[1] - def.amount[0]));
      w.colony.nodes.push({ id: w.nextId(), kind, x, y, amount, max: amount, found: !def.hidden, variant: Math.floor(hash2(tx, ty, t.seed) * 4) });
    }
  }
  w.colony.version++;
  // the snowcaps, what burns + the paths, worked out afresh for the new ground
  w.fire.initFuel(w);
  w.snow.init(w);
  w.nav.sync(w);
  w.toast("⛰️", "The mountains have risen! Four ranges now divide the lands: Mossback Ridge, the snow-capped Sentinel Range, the red Redrock Range and the snow-capped Icefang Range. Cross them at their passes. Mountain goats, bighorn sheep + mountain lions will make them home. (Your settlement and every camp were left just as they were.)");
  return changed;
}
