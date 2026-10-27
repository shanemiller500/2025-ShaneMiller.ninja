/* ------------------------------------------------------------------ */
/*  Firefighting: who puts out which fire, in what order.              */
/*                                                                     */
/*  The camp's protection area is the settlement itself (settlement.ts */
/*  footprint: homes, buildings, walls, towers, fields, Scorpions) plus */
/*  a ring round it, not the whole map: a grass fire far off in the     */
/*  plains is left to burn out.                                         */
/*                                                                     */
/*  Every burning tile inside it is ranked:                             */
/*    1 people in danger · 2 occupied homes · 3 critical buildings      */
/*    (healer, water, fire station, hatchery, energy, shields) ·        */
/*    4 defences (walls, gates, towers, Scorpions) · 5 food + stores ·  */
/*    6 work buildings + empty homes · 7 vegetation that could spread   */
/*    into camp · 8 small fires just outside it.                        */
/*  Firefighters (the 🧑‍🚒 role, and Auto people the balancer puts on    */
/*  it) take the worst fire first, nearest first among equals; each     */
/*  burning spot takes at most a couple of them so the crew spreads out */
/*  and works through the area. Regular workers only drop their work    */
/*  for a major emergency (people / homes / critical buildings burning, */
/*  or a big blaze) near them. Everyone throws from a safe spot beside  */
/*  the flames (never in them, never on lava), and goes back to normal  */
/*  work once nothing in the area is burning.                           */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { distToCamp } from "./settlement";
import { MAP_W, TILE, type BuildingKind, type Human, type Role } from "./types";
import type { World } from "./world";

/** Fires this close to anything we've built are ours to fight (px). */
export const PROTECT_R = 260;
/** Beyond PROTECT_R, small fires out to here still get the crew when nothing worse is burning. */
export const OUTER_R = 420;
/** A burning spot takes at most this many firefighters (spread the crew out). */
const PER_SPOT = 2;
/** Tiles within this of each other count as one burning spot (px). */
const SPOT_R = 64;
/** Seconds the ranked list is reused. */
const EVERY = 0.75;

export const CRITICAL = new Set<BuildingKind>(["healer", "waterStore", "well", "fireStation", "hatchery", "energyTower", "dragonShield"]);
export const STORES = new Set<BuildingKind>(["storage", "foodStore", "post"]);
/** Workers who'll grab a bucket in a major emergency (never guards, hunters, keepers…). */
const HELPERS = new Set<Role>(["gatherer", "builder", "farmer", "cook"]);

export interface FireSpot {
  /** tile index */
  i: number;
  x: number;
  y: number;
  /** 1 (worst) … 8 */
  pri: number;
  heat: number;
}

export const PRI_LABEL = ["", "people in danger", "a home", "a critical building", "the defences", "food + stores", "a work building", "spreading toward camp", "near the camp"];

const cache = new WeakMap<World, { t: number; list: FireSpot[] }>();
/** who's on which burning spot (human id → tile index) */
const claims = new WeakMap<World, Map<number, number>>();
const claimsOf = (w: World) => {
  let m = claims.get(w);
  if (!m) claims.set(w, (m = new Map()));
  return m;
};

const near = (ax: number, ay: number, bx: number, by: number, r: number) => Math.abs(ax - bx) < r && Math.hypot(ax - bx, ay - by) < r;

/** How bad a burning tile at (x, y) is (0 = not ours to fight). */
function rank(w: World, x: number, y: number): number {
  const d = distToCamp(w, x, y);
  if (d > OUTER_R) return 0;
  if (w.humans.some((h) => !h.under && !h.stranger && h.state !== "hide" && near(h.x, h.y, x, y, 56))) return 1;
  for (const s of w.shelters) {
    if (s.stage <= 0 || !near(s.x, s.y, x, y, 70)) continue;
    return w.humans.some((h) => h.home === s.id) ? 2 : 6;
  }
  let best = 0;
  const take = (p: number) => {
    if (!best || p < best) best = p;
  };
  for (const b of w.colony.buildings) {
    const def = BUILDINGS[b.kind];
    if (!def || !near(b.x, b.y, x, y, 40 + def.w * 14)) continue;
    take(CRITICAL.has(b.kind) ? 3 : STORES.has(b.kind) ? 5 : 6);
  }
  if (best === 3) return 3;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  for (let dy = -1; dy <= 1 && best !== 4; dy++) for (let dx = -1; dx <= 1; dx++) if (w.tribe.wallAt(tx + dx, ty + dy)) take(4);
  if (w.tribe.towers.some((t) => near(t.x, t.y, x, y, 60)) || w.colony.scorpions.some((s) => near(s.x, s.y, x, y, 50))) take(4);
  if (best) return best;
  if (near(w.camp.pileX, w.camp.pileY, x, y, 70) || w.tribe.farms.some((f) => near(f.x, f.y, x, y, 50))) return 5;
  return d <= PROTECT_R ? 7 : 8;
}

/** Every fire we should be fighting, worst first. Cheap: cached a moment; only burning tiles are looked at. */
export function fireThreats(w: World): FireSpot[] {
  const c = cache.get(w);
  if (c && Math.abs(w.elapsed - c.t) < EVERY) return c.list;
  const list: FireSpot[] = [];
  w.fire.active.forEach((i) => {
    if (w.lava.heat[i] > 0.15) return; // lava burns on: nothing a bucket can do
    const heat = w.fire.heat[i];
    if (heat <= 0.1) return;
    const x = (i % MAP_W) * TILE + TILE / 2;
    const y = Math.floor(i / MAP_W) * TILE + TILE / 2;
    const pri = rank(w, x, y);
    if (pri) list.push({ i, x, y, pri, heat });
  });
  list.sort((a, b) => a.pri - b.pri || Math.hypot(a.x - w.camp.x, a.y - w.camp.y) - Math.hypot(b.x - w.camp.x, b.y - w.camp.y));
  cache.set(w, { t: w.elapsed, list });
  // forget claims on fires that went out
  const cl = claimsOf(w);
  for (const [id, i] of Array.from(cl)) if (!list.some((f) => f.i === i)) cl.delete(id);
  return list;
}

/** Forget the cached list (tests, or right after a big change). */
export const refreshFires = (w: World) => cache.delete(w);

/** A big blaze, or people / homes / critical buildings burning: regular workers help out. */
export function majorFire(w: World, list = fireThreats(w)) {
  return list.some((f) => f.pri <= 3) || list.length >= 10;
}

/** How many people this fire needs right now. */
export function crewWanted(w: World, list = fireThreats(w)) {
  if (!list.length) return 0;
  return Math.min(8, Math.ceil(list.length / 3) + (majorFire(w, list) ? 2 : 0));
}

/** Is this person someone who goes out to fight fires? (role-based; the tech is checked by the caller) */
export function isFirefighter(w: World, h: Human) {
  return w.tribe.roleOf(h) === "firefighter";
}

/**
 * The fire this person should be fighting (claimed, so the crew spreads out): the worst one first,
 * nearest to them among equals; a spot already busy with PER_SPOT people is skipped while there's
 * another. Null = nothing in the protection area is burning.
 */
export function claimFire(w: World, h: Human): FireSpot | null {
  const list = fireThreats(w);
  const cl = claimsOf(w);
  if (!list.length) {
    cl.delete(h.id);
    return null;
  }
  const busy = (f: FireSpot) => {
    let n = 0;
    for (const [id, i] of Array.from(cl)) {
      if (id === h.id) continue;
      const o = list.find((g) => g.i === i);
      if (o && near(o.x, o.y, f.x, f.y, SPOT_R)) n++;
    }
    return n;
  };
  let best: FireSpot | null = null;
  let bs = Infinity;
  for (const f of list) {
    // priority first; then the free spots; then distance (a few hundred px is worth one step of priority… not)
    const s = f.pri * 1e6 + (busy(f) >= PER_SPOT ? 5e5 : 0) + Math.hypot(f.x - h.x, f.y - h.y);
    if (s < bs) {
      bs = s;
      best = f;
    }
  }
  if (best) cl.set(h.id, best.i);
  return best;
}

/** The fire they're on (if it's still burning). */
export function claimedFire(w: World, h: Human): FireSpot | null {
  const i = claimsOf(w).get(h.id);
  if (i === undefined) return null;
  return fireThreats(w).find((f) => f.i === i) ?? null;
}

/** Done with fires for now: let the spot go (and stop aiming at it). */
export function dropClaim(w: World, h: Human) {
  claimsOf(w).delete(h.id);
  aimsOf(w).delete(h.id);
}

/** Where each person's next bucket goes (set as they pick a fire; read when they throw). */
const aims = new WeakMap<World, Map<number, { x: number; y: number }>>();
const aimsOf = (w: World) => {
  let m = aims.get(w);
  if (!m) aims.set(w, (m = new Map()));
  return m;
};
export function setDouseAim(w: World, h: Human, at: { x: number; y: number } | null) {
  if (at) aimsOf(w).set(h.id, { x: at.x, y: at.y });
  else aimsOf(w).delete(h.id);
}
/** The fire they're throwing at, if they're close enough to reach it. */
export function douseAim(w: World, h: Human) {
  const a = aimsOf(w).get(h.id);
  return a && Math.hypot(a.x - h.x, a.y - h.y) < 110 ? a : null;
}

/** Is it safe to stand at (x, y)? (no flames, no lava, solid ground) */
export function safeToStand(w: World, x: number, y: number) {
  const i = Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE);
  if (i < 0 || i >= w.fire.heat.length) return false;
  return w.fire.heat[i] < 0.12 && w.lava.heat[i] <= 0.05 && w.nav.passable("human", x, y);
}

/** Where to throw from: a safe spot just beside the fire, on the side nearest the firefighter. */
export function throwSpot(w: World, f: { x: number; y: number }, from: { x: number; y: number }) {
  const base = Math.atan2(from.y - f.y, from.x - f.x);
  for (const r of [40, 56, 72]) {
    for (let k = 0; k < 8; k++) {
      // alternate either side of the direct line
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
      const x = f.x + Math.cos(a) * r;
      const y = f.y + Math.sin(a) * r * 0.8;
      if (safeToStand(w, x, y)) return { x, y };
    }
  }
  return null;
}

/**
 * Should this person drop what they're doing for a fire? Firefighters: any fire in the area.
 * Regular workers: only a major emergency within reach, and only while the crew is short.
 */
export function answersFire(w: World, h: Human): boolean {
  if (h.child || h.stranger || h.captive || h.under) return false;
  if (!w.camp.learned.has("firefighting") && !w.camp.learned.has("sonicFire")) return false;
  const list = fireThreats(w);
  if (!list.length) return false;
  if (isFirefighter(w, h)) return true;
  if (!HELPERS.has(w.tribe.roleOf(h)) || !majorFire(w, list)) return false;
  // already on it
  if (claimsOf(w).has(h.id)) return true;
  if (claimsOf(w).size >= crewWanted(w, list)) return false;
  return list.some((f) => f.pri <= 3 && near(f.x, f.y, h.x, h.y, 520)) || near(list[0].x, list[0].y, h.x, h.y, 420);
}
