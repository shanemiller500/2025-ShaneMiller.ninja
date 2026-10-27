/* ------------------------------------------------------------------ */
/*  Walls that join up. A run of wall should meet what it's built      */
/*  against: a tower, a Dragon Shield, another wall, a corner, or the  */
/*  water's edge.                                                      */
/*  Left a tile or two short, it leaves a gap a raptor walks through,  */
/*  so wherever a run ends near one of those, the gap is filled with   */
/*  wall pieces of the same kind (builders put them up like any other  */
/*  wall) and the player is told what was joined.                      */
/*                                                                     */
/*  Only loose ends are looked at (a piece with at most one join), and */
/*  only straight on from the run (or any way for a lone piece), so    */
/*  two walls side by side are never stitched together. A run that    */
/*  stops one tile diagonally short of another wall or a tower gets    */
/*  the corner piece. Runs after drawing walls, after moving them,     */
/*  and once over an old save's walls (1-tile gaps only).              */
/* ------------------------------------------------------------------ */
import { MAP_W, T, TILE as TILE_PX, type Wall } from "./types";
import type { World } from "./world";

/** Gaps up to this many tiles are closed when the player draws or moves walls. */
export const JOIN_GAP = 2;

/** Ground a wall can end against and still be sealed (water, cliffs, mountains, lava rock). */
const NATURAL = new Set<T>([T.Deep, T.Shallow, T.River, T.Mountain, T.Cliff, T.Volcano]);

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

export type JoinedTo = "tower" | "shield" | "wall" | "water" | "corner";

export interface WallJoin {
  tx: number;
  ty: number;
  to: JoinedTo;
}

/** Something a wall piece joins onto here (another wall piece that isn't stairs, a tower or a Dragon Shield). */
function anchor(w: World, tx: number, ty: number): "tower" | "shield" | "wall" | null {
  const o = w.tribe.wallAt(tx, ty);
  if (o && o.part !== "stairs") return "wall";
  return w.tribe.wallAnchorAt(w, tx, ty);
}

const natural = (w: World, tx: number, ty: number) => NATURAL.has(w.terrain.tiles[ty * MAP_W + tx] as T);

/** Fill the tiles between a wall end and what it should meet (all or nothing). */
function fill(w: World, from: Wall, tiles: [number, number][], to: JoinedTo, out: WallJoin[]) {
  if (!tiles.every(([x, y]) => w.tribe.wallSpotOk(w, x, y))) return false;
  const kind = from.upgrade ? from.upTo ?? from.kind : from.kind;
  for (const [x, y] of tiles) if (w.tribe.addWall(w, x, y, kind, "wall")) out.push({ tx: x, ty: y, to });
  return true;
}

/** Join one loose wall end to whatever it nearly meets. */
function joinEnd(w: World, wl: Wall, gap: number, out: WallJoin[]) {
  if (wl.part === "stairs") return;
  const links = DIRS.filter(([dx, dy]) => anchor(w, wl.tx + dx, wl.ty + dy));
  if (links.length >= 2) return;
  // straight on from the run (a lone piece: any way)
  const ways = links.length === 1 ? [[-links[0][0], -links[0][1]] as const] : DIRS;
  for (const [dx, dy] of ways) {
    const gapTiles: [number, number][] = [];
    for (let k = 1; k <= gap + 1; k++) {
      const x = wl.tx + dx * k;
      const y = wl.ty + dy * k;
      const a = anchor(w, x, y);
      if (a) {
        if (k > 1 && fill(w, wl, gapTiles, a, out)) return;
        break;
      }
      if (natural(w, x, y)) {
        if (k > 1 && fill(w, wl, gapTiles, "water", out)) return;
        break;
      }
      if (!w.tribe.wallSpotOk(w, x, y)) break;
      gapTiles.push([x, y]);
    }
    // a corner: the next wall or tower is one tile diagonally on; the piece straight ahead joins them
    if (links.length === 1) {
      const ax = wl.tx + dx;
      const ay = wl.ty + dy;
      const side = dx === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
      for (const [sx, sy] of side) {
        if (anchor(w, ax + sx, ay + sy) && !anchor(w, wl.tx + sx, wl.ty + sy) && fill(w, wl, [[ax, ay]], "corner", out)) return;
      }
    }
  }
}

/**
 * Close the small gaps at the loose ends of these walls (all walls if none given). Returns every
 * piece added; the caller tells the player (see joinMessage).
 */
export function connectWalls(w: World, walls: Wall[] = w.tribe.walls, gap = JOIN_GAP): WallJoin[] {
  const out: WallJoin[] = [];
  for (const wl of [...walls]) if (w.tribe.walls.includes(wl)) joinEnd(w, wl, gap, out);
  if (out.length) w.nav.sync(w);
  return out;
}

/** "🧱 Walls joined up: …" for a toast (null when nothing was added). */
export function joinMessage(joins: WallJoin[]) {
  if (!joins.length) return null;
  const what = new Set(joins.map((j) => j.to));
  const names = [what.has("tower") && "the tower", what.has("shield") && "the Dragon Shield", what.has("wall") && "the next wall", what.has("corner") && "the corner", what.has("water") && "the water's edge"].filter(Boolean).join(", ");
  return `Walls joined up: ${joins.length} piece${joins.length === 1 ? "" : "s"} added to connect to ${names}, so nothing slips through the gap.`;
}

/* ------------------------------ lining up a move ------------------------------ */

/** A tile box (inclusive). */
export interface TileBox {
  tx0: number;
  ty0: number;
  tx1: number;
  ty1: number;
}

/**
 * A measuring line from a piece being placed to the nearest wall / gate / tower it would line up
 * with (one per side). ok = it's in line (it will join or run on straight); otherwise it's 1–2 tiles
 * off that line (`off`). gap = the open tiles between them along the line (0 = touching).
 */
export interface AlignGuide {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ok: boolean;
  gap: number;
  off: number;
}

/** How far along a row / column the guides look for something to line up with (tiles). */
const GUIDE_REACH = 12;
/** Up to this many tiles out of line still shows (red): further off, it isn't meant to line up. */
const GUIDE_SLACK = 2;

/**
 * Measuring lines for a piece (or group) being moved to `box`: to the nearest wall, gate or tower to
 * the east, west, north and south. Pieces being moved (`movingWalls`, `movingTower`) don't count.
 */
export function alignGuides(w: World, box: TileBox, movingWalls: Set<number> = new Set(), movingTower = 0): AlignGuide[] {
  const boxes: TileBox[] = [];
  const near = (b: TileBox) => b.tx1 >= box.tx0 - GUIDE_REACH && b.tx0 <= box.tx1 + GUIDE_REACH && b.ty1 >= box.ty0 - GUIDE_REACH && b.ty0 <= box.ty1 + GUIDE_REACH;
  for (const wl of w.tribe.walls) {
    if (movingWalls.has(wl.id) || wl.part === "stairs") continue;
    const b = { tx0: wl.tx, ty0: wl.ty, tx1: wl.tx, ty1: wl.ty };
    if (near(b)) boxes.push(b);
  }
  for (const t of w.tribe.towers) {
    if (t.id === movingTower) continue;
    const b = { tx0: t.tx, ty0: t.ty, tx1: t.tx + 1, ty1: t.ty + 1 };
    if (near(b)) boxes.push(b);
  }
  const out: AlignGuide[] = [];
  const mid = (a: number, b: number) => ((a + b + 1) / 2) * TILE_PX;
  // east / west: something to the side whose rows meet the box's rows (or are a tile or two off)
  for (const side of [1, -1]) {
    let best: { b: TileBox; dist: number; off: number } | null = null;
    for (const b of boxes) {
      const dist = side > 0 ? b.tx0 - box.tx1 - 1 : box.tx0 - b.tx1 - 1;
      if (dist < 0 || dist > GUIDE_REACH) continue;
      const off = b.ty1 < box.ty0 ? box.ty0 - b.ty1 : b.ty0 > box.ty1 ? b.ty0 - box.ty1 : 0;
      if (off > GUIDE_SLACK) continue;
      if (!best || off < best.off || (off === best.off && dist < best.dist)) best = { b, dist, off };
    }
    if (best) {
      const y = best.off ? mid(best.b.ty0, best.b.ty1) : mid(Math.max(box.ty0, best.b.ty0), Math.min(box.ty1, best.b.ty1));
      const from = side > 0 ? (box.tx1 + 1) * TILE_PX : box.tx0 * TILE_PX;
      const to = side > 0 ? best.b.tx0 * TILE_PX : (best.b.tx1 + 1) * TILE_PX;
      out.push({ x0: from, y0: best.off ? mid(box.ty0, box.ty1) : y, x1: to, y1: y, ok: best.off === 0, gap: best.dist, off: best.off });
    }
  }
  // north / south
  for (const side of [1, -1]) {
    let best: { b: TileBox; dist: number; off: number } | null = null;
    for (const b of boxes) {
      const dist = side > 0 ? b.ty0 - box.ty1 - 1 : box.ty0 - b.ty1 - 1;
      if (dist < 0 || dist > GUIDE_REACH) continue;
      const off = b.tx1 < box.tx0 ? box.tx0 - b.tx1 : b.tx0 > box.tx1 ? b.tx0 - box.tx1 : 0;
      if (off > GUIDE_SLACK) continue;
      if (!best || off < best.off || (off === best.off && dist < best.dist)) best = { b, dist, off };
    }
    if (best) {
      const x = best.off ? mid(best.b.tx0, best.b.tx1) : mid(Math.max(box.tx0, best.b.tx0), Math.min(box.tx1, best.b.tx1));
      const from = side > 0 ? (box.ty1 + 1) * TILE_PX : box.ty0 * TILE_PX;
      const to = side > 0 ? best.b.ty0 * TILE_PX : (best.b.ty1 + 1) * TILE_PX;
      out.push({ x0: best.off ? mid(box.tx0, box.tx1) : x, y0: from, x1: x, y1: to, ok: best.off === 0, gap: best.dist, off: best.off });
    }
  }
  return out;
}
