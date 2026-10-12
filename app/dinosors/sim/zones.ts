/* ------------------------------------------------------------------ */
/*  Camp zones: the neighbourhoods the settlement has grown into.      */
/*  Nothing is drawn by hand: every few seconds the finished homes,    */
/*  campfires and stores are clustered (anything within ZONE_R of a    */
/*  zone joins it). The cave camp is always zone 0. The planner reads  */
/*  them to give each neighbourhood its own fire + store; people live, */
/*  eat, gather and sit by the fire in their own zone.                 */
/* ------------------------------------------------------------------ */
import { HOUSING } from "../data/colony";
import { shelterDone } from "./build";
import { T, WORLD_H, WORLD_W } from "./types";
import type { World } from "./world";

export interface Zone {
  id: number;
  /** centre (the average of what's in it) */
  x: number;
  y: number;
  /** finished homes in it (shelter ids) */
  homes: number[];
  beds: number;
  residents: number;
  /** lit campfires */
  fires: number;
  /** drop-off stores (storage huts, gathering posts, food stores) */
  stores: number;
}

/** Things this far apart belong to different neighbourhoods. */
export const ZONE_R = 330;
/** Seconds between re-clustering. */
const EVERY = 5;

const STORES = new Set(["storage", "post", "foodStore"]);

/** Group the settlement into zones (called by the tribe on a timer; read it from `w.tribe.zones`). */
export function buildZones(w: World): Zone[] {
  const zones: Zone[] = [{ id: 0, x: w.camp.x, y: w.camp.y, homes: [], beds: 0, residents: 0, fires: 0, stores: 0 }];
  const sums = [{ x: w.camp.x, y: w.camp.y, n: 1 }];
  const join = (x: number, y: number) => {
    let best = -1;
    let bd = ZONE_R;
    zones.forEach((z, i) => {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) {
      zones.push({ id: zones.length, x, y, homes: [], beds: 0, residents: 0, fires: 0, stores: 0 });
      sums.push({ x: 0, y: 0, n: 0 });
      best = zones.length - 1;
    }
    // the cave camp stays put; other zones drift to the middle of what's in them
    if (best > 0) {
      const s = sums[best];
      s.x += x;
      s.y += y;
      s.n++;
      zones[best].x = s.x / s.n;
      zones[best].y = s.y / s.n;
    }
    return zones[best];
  };
  const zoneOfHome = new Map<number, Zone>();
  for (const s of w.shelters) {
    if (!shelterDone(s)) continue;
    const z = join(s.x, s.y);
    z.homes.push(s.id);
    z.beds += HOUSING[s.tier].cap;
    zoneOfHome.set(s.id, z);
  }
  for (const f of w.campfires) if (f.lit) join(f.x, f.y).fires++;
  for (const b of w.colony.buildings) if (b.built >= 1 && STORES.has(b.kind)) join(b.x, b.y).stores++;
  for (const h of w.humans) {
    if (h.stranger || !h.home) continue;
    const z = zoneOfHome.get(h.home);
    if (z) z.residents++;
  }
  return zones;
}

/** Keep `w.tribe.zones` fresh (cheap: a few dozen buildings every few seconds). */
export function updateZones(w: World, dt: number) {
  const t = w.tribe;
  t.zoneT -= dt;
  if (t.zoneT > 0 && t.zones.length) return;
  t.zoneT = EVERY;
  t.zones = buildZones(w);
}

/* ------------------------------ growing new neighbourhoods ------------------------------ */

/** Homes round the cave before Auto starts building out in the neighbourhoods. */
export const MAIN_HOMES = 8;
/** Homes a neighbourhood holds before Auto founds another. */
export const ZONE_HOMES = 6;
/** How far out a new neighbourhood goes (px from the cave camp). */
const FOUND_RANGE: [number, number] = [650, 1000];

const BAD_GROUND = new Set<T>([T.Deep, T.Shallow, T.River, T.Swamp, T.Mud, T.Tar, T.Basalt, T.Volcano, T.Mountain, T.Cliff, T.Cave, T.Nest]);

/** A clear spot for a home: walkable, dry, firm ground, not on top of another home or building. */
function homeFits(w: World, x: number, y: number) {
  if (x < 80 || y < 80 || x > WORLD_W - 80 || y > WORLD_H - 120) return false;
  const t = w.terrain.tileAt(x, y);
  if (BAD_GROUND.has(t) || !w.nav.passable("human", x, y)) return false;
  if (w.shelters.some((s) => Math.hypot(s.x - x, s.y - y) < 60)) return false;
  if (w.colony.buildings.some((b) => Math.hypot(b.x - x, b.y - y) < 55)) return false;
  return !w.tribe.farms.some((f) => Math.hypot(f.x - x, f.y - y) < 60);
}

function spotNear(w: World, x: number, y: number, r0: number, r1: number) {
  for (let r = r0; r <= r1; r += 25)
    for (let k = 0; k < 12; k++) {
      const a = k * (Math.PI / 6) + r * 0.01;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.7;
      if (homeFits(w, px, py)) return { x: px, y: py };
    }
  return null;
}

/** Somewhere good for a new neighbourhood: water + trees close by, away from the volcano, swamps and rival camps. */
function foundingSpot(w: World) {
  const c = w.camp;
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let r = FOUND_RANGE[0]; r <= FOUND_RANGE[1]; r += 115)
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r * 0.75;
      if (!homeFits(w, x, y)) continue;
      if (Math.hypot(x - w.volcano.x, y - w.volcano.y) < 1300) continue;
      if (w.rivals.clans.some((cl) => Math.hypot(cl.x - x, cl.y - y) < 900)) continue;
      if (w.tribe.zones.some((z) => Math.hypot(z.x - x, z.y - y) < 450)) continue;
      let score = 0;
      const water = w.terrain.nearestDrink(x, y, 500);
      if (water) score += 3 - Math.hypot(water.x - x, water.y - y) / 250;
      let trees = 0;
      w.plantHash.each(x, y, 260, (p) => {
        if (!p.stump) trees++;
      });
      score += Math.min(8, trees) * 0.3;
      score -= r / 600;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  return best;
}

/**
 * Where Auto should put the next home: round the cave until it's full, then in a
 * neighbourhood with room, then a new neighbourhood (null = the old ring round the cave).
 */
export function homeSpot(w: World): { x: number; y: number; founded: boolean } | null {
  const zones = w.tribe.zones.length ? w.tribe.zones : buildZones(w);
  if (zones[0].homes.length < MAIN_HOMES) return null;
  const open = zones.filter((z) => z.id > 0 && z.homes.length < ZONE_HOMES).sort((a, b) => a.homes.length - b.homes.length);
  for (const z of open) {
    const p = spotNear(w, z.x, z.y, 70, 170);
    if (p) return { ...p, founded: false };
  }
  const f = foundingSpot(w);
  return f ? { ...f, founded: true } : null;
}
