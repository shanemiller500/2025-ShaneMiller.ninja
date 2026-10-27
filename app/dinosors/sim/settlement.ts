/* ------------------------------------------------------------------ */
/*  The settlement's footprint: where "our camp" actually is.          */
/*                                                                     */
/*  The camp grows well past the cave: neighbourhoods (zones.ts),      */
/*  walls, towers, fields, workshops. Anything that needs to know       */
/*  "how far does the camp reach?" asks here instead of guessing from   */
/*  the cave + a fixed radius:                                          */
/*   • raids spawn on a ring outside it (never in or beside the camp),  */
/*   • firefighters protect it (not the whole map).                     */
/*  Also: the other peoples' camps (raids never appear inside those).   */
/*  Cached per world for a couple of seconds (it only changes as things */
/*  get built).                                                         */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { canStand } from "./dinos";
import { MAP_W, TILE } from "./types";
import type { SpeciesId } from "./types";
import type { World } from "./world";

export interface Footprint {
  /** bounding box of everything we've built (px) */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** its centre + the radius of a circle that holds all of it */
  cx: number;
  cy: number;
  r: number;
  /** every structure point (for "is this beside a building?" checks) */
  points: { x: number; y: number }[];
}

/** Seconds a footprint is reused. */
const EVERY = 2;
/** Small things still take up room: padding added round each structure (px). */
const PAD = 48;

const cache = new WeakMap<World, { t: number; f: Footprint }>();

/** Our settlement's extent: the cave, homes, buildings, walls, towers, fields, Scorpions + zones. */
export function footprint(w: World): Footprint {
  const c = cache.get(w);
  if (c && Math.abs(w.elapsed - c.t) < EVERY) return c.f;
  const pts: { x: number; y: number }[] = [{ x: w.camp.x, y: w.camp.y }];
  for (const s of w.shelters) pts.push({ x: s.x, y: s.y });
  for (const f of w.campfires) pts.push({ x: f.x, y: f.y });
  for (const b of w.colony.buildings) pts.push({ x: b.x, y: b.y });
  for (const s of w.colony.scorpions) pts.push({ x: s.x, y: s.y });
  for (const wl of w.tribe.walls) pts.push({ x: wl.tx * TILE + 16, y: wl.ty * TILE + 16 });
  for (const t of w.tribe.towers) pts.push({ x: t.x, y: t.y });
  for (const f of w.tribe.farms) pts.push({ x: f.x, y: f.y });
  for (const z of w.tribe.zones ?? []) pts.push({ x: z.x, y: z.y });
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x - PAD);
    minY = Math.min(minY, p.y - PAD);
    maxX = Math.max(maxX, p.x + PAD);
    maxY = Math.max(maxY, p.y + PAD);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let r = 0;
  for (const p of pts) r = Math.max(r, Math.hypot(p.x - cx, p.y - cy) + PAD);
  const f = { minX, minY, maxX, maxY, cx, cy, r, points: pts };
  cache.set(w, { t: w.elapsed, f });
  return f;
}

/** Forget the cached footprint (tests, or right after a big change). */
export const refreshFootprint = (w: World) => cache.delete(w);

/** Distance from (x, y) to the nearest thing we've built (px). */
export function distToCamp(w: World, x: number, y: number) {
  let best = Infinity;
  for (const p of footprint(w).points) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  return best;
}

/** Is (x, y) within `pad` px of anything we've built? */
export const nearCamp = (w: World, x: number, y: number, pad: number) => distToCamp(w, x, y) < pad;

/** The other peoples' camps: centre + how much ground they hold. */
export function otherCamps(w: World): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (const c of w.rivals?.clans ?? []) out.push({ x: c.x, y: c.y, r: 300 });
  for (const t of w.sandFolk?.tribes ?? []) out.push({ x: t.x, y: t.y, r: Math.max(260, t.r ?? 0) });
  for (const t of w.snowFolk?.tribes ?? []) out.push({ x: t.x, y: t.y, r: Math.max(240, t.r ?? 0) });
  for (const t of w.forest?.tribes ?? []) out.push({ x: t.x, y: t.y, r: 240 });
  for (const t of w.seaFolk?.tribes ?? []) out.push({ x: t.x, y: t.y, r: 220 });
  return out;
}

/* ----------------------------- raid spawning ----------------------------- */

/** A raid appears at least this far beyond the edge of the camp (px): far enough to be seen coming. */
export const RAID_MARGIN = 900;
/** …and no further than this beyond it (so it's still a raid on us, not a trek). */
export const RAID_MAX = 1500;
/** Nobody of ours within this of a raider when it appears. */
const CLEAR_OF_PEOPLE = 320;

/** Why a raid can't appear at (x, y) (null = it can). Used to validate every spawn. */
export function raidSpotProblem(w: World, species: SpeciesId, x: number, y: number): string | null {
  const def = sp(species);
  if (!canStand(w, def, x, y)) return def.move === "swim" ? "not water" : "not walkable ground";
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (w.lava.heatAt(tx, ty) > 0.05) return "lava";
  if (w.fire.at(tx, ty) > 0.05) return "on fire";
  if (w.tribe.blocks(tx, ty)) return "a wall";
  if (w.colony.occupied(w).has(ty * MAP_W + tx)) return "a building";
  if (w.tribe.walledIn(w, x, y)) return "inside our walls";
  if (nearCamp(w, x, y, RAID_MARGIN)) return "too close to the camp";
  if (otherCamps(w).some((c) => Math.hypot(c.x - x, c.y - y) < c.r)) return "another people's camp";
  if (w.humans.some((h) => Math.hypot(h.x - x, h.y - y) < CLEAR_OF_PEOPLE)) return "beside someone";
  return null;
}

/**
 * Where a raid gathers before it comes in: a valid spot on a ring outside the whole settlement (not
 * just the cave), on ground the pack can walk, with a way to the camp. Null if nowhere fits.
 */
export function raidGathering(w: World, species: SpeciesId): { x: number; y: number } | null {
  const f = footprint(w);
  for (let k = 0; k < 60; k++) {
    const a = w.rng() * Math.PI * 2;
    // a ring round the footprint's circle, out past the margin
    const d = f.r + RAID_MARGIN + 40 + w.rng() * (RAID_MAX - RAID_MARGIN);
    const x = f.cx + Math.cos(a) * d;
    const y = f.cy + Math.sin(a) * d;
    if (raidSpotProblem(w, species, x, y)) continue;
    // must be able to walk in (not a cut-off island or a ledge)
    if (!w.nav.passable("dino", x, y)) continue;
    return { x, y };
  }
  return null;
}

/** Spots for each member of the pack, close together round `from`; every one validated. */
export function raidPackSpots(w: World, pack: SpeciesId[], from: { x: number; y: number }) {
  const out: { x: number; y: number }[] = [];
  for (const s of pack) {
    let spot: { x: number; y: number } | null = null;
    for (let k = 0; k < 30 && !spot; k++) {
      const a = w.rng() * Math.PI * 2;
      const rr = 30 + Math.sqrt(w.rng()) * (110 + k * 6);
      const x = from.x + Math.cos(a) * rr;
      const y = from.y + Math.sin(a) * rr;
      if (!raidSpotProblem(w, s, x, y) && !out.some((o) => Math.hypot(o.x - x, o.y - y) < 26)) spot = { x, y };
    }
    out.push(spot ?? { x: NaN, y: NaN });
  }
  return out;
}
