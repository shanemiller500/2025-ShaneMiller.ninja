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
