import type { Shelter } from "./types";
import type { World } from "./world";
import { MAP_W, TILE } from "./types";
import { shelterDone } from "./build";
import { clearPlantsUnderBuilds } from "./buildClear";
import { wingUnits, type CastleCompound } from "./castleCompound";

export const WING_STAGES = [
  { label: "Stone foundations", need: "stone" as const, n: 8 },
  { label: "Rooms and floors", need: "wood" as const, n: 6 },
  { label: "Stone walls and balcony", need: "stone" as const, n: 10 },
  { label: "Roof and six beds", need: "leaves" as const, n: 6 },
];

export interface HomeLink { a: Shelter; b: Shelter }
export interface Estate { homes: Shelter[]; links: HomeLink[]; garden: { x: number; y: number } | null; compound?: CastleCompound }

/** Connections follow nearby homes; nothing is moved, merged away or given free capacity. */
export function estates(w: World): Estate[] {
  const managed = new Set((w.castleCompounds ?? []).flatMap((c) => c.wings.flatMap((g) => g.ids)));
  const homes = w.shelters.filter((s) => !managed.has(s.id) && s.tier >= 4 && shelterDone(s) && s.hp > 0 && !s.lift);
  const links: HomeLink[] = [];
  for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) {
    const a = homes[i], b = homes[j];
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (Math.hypot(dx, dy) <= 128 && corridorClear(w, a, b)) links.push({ a, b });
  }
  const left = new Set(homes);
  const out: Estate[] = [];
  while (left.size) {
    const seed = left.values().next().value!;
    const group = [seed]; left.delete(seed);
    for (let i = 0; i < group.length; i++) for (const link of links) {
      const other = link.a === group[i] ? link.b : link.b === group[i] ? link.a : null;
      if (other && left.delete(other)) group.push(other);
    }
    const own = links.filter((l) => group.includes(l.a));
    const x = (Math.min(...group.map((s) => s.x)) + Math.max(...group.map((s) => s.x))) / 2;
    const y = (Math.min(...group.map((s) => s.y)) + Math.max(...group.map((s) => s.y))) / 2;
    const surrounded = group.some((s) => s.x < x - 45) && group.some((s) => s.x > x + 45) && group.some((s) => s.y < y - 35) && group.some((s) => s.y > y + 35);
    const garden = group.length >= 4 && surrounded && clearWingGround(w, x, y, 38, 28) ? { x, y } : null;
    out.push({ homes: group, links: own, garden });
  }
  for (const compound of w.castleCompounds ?? []) {
    const units = w.shelters.filter((s) => managed.has(s.id) && compound.wings.some((g) => g.ids.includes(s.id)) && shelterDone(s) && s.hp > 0 && !s.lift);
    const wings = units.filter((s) => wingUnits(w, s)[0]?.id === s.id);
    const links: HomeLink[] = [];
    for (let i = 0; i < wings.length; i++) for (let j = i + 1; j < wings.length; j++) {
      const a = wings[i], b = wings[j];
      if ((Math.abs(a.y - b.y) < 2 && Math.abs(a.x - b.x) <= 65) || (Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) <= 97)) links.push({ a, b });
    }
    if (units.length) out.push({ homes: units, links, garden: null, compound });
  }
  return out;
}

function corridorClear(w: World, a: Shelter, b: Shelter) {
  for (let k = 1; k < 8; k++) {
    const x = a.x + (b.x - a.x) * k / 8, y = a.y + (b.y - a.y) * k / 8;
    if (!w.colony.footing(w, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    if (w.colony.buildings.some((o) => Math.hypot(o.x - x, o.y - y) < 28)) return false;
    if (w.shelters.some((o) => o !== a && o !== b && Math.hypot(o.x - x, o.y - y) < 32)) return false;
    if (w.tribe.walls.some((o) => Math.hypot((o.tx + 0.5) * TILE - x, (o.ty + 0.5) * TILE - y) < 18)) return false;
  }
  return true;
}

/** Check the whole room footprint, including its approach, instead of just its centre tile. */
export function clearWingGround(w: World, x: number, y: number, rx = 42, ry = 32) {
  const occupied = w.colony.occupied(w);
  for (let py = y - ry; py <= y + 12; py += 12) for (let px = x - rx; px <= x + rx; px += 12) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (!w.colony.footing(w, tx, ty) || occupied.has(ty * MAP_W + tx)) return false;
  }
  return !w.shelters.some((s) => Math.abs(s.x - x) < rx + 34 && Math.abs(s.y - y) < ry + 24)
    && !w.campfires.some((f) => Math.hypot(f.x - x, f.y - y) < 52)
    && !w.tribe.farms.some((f) => Math.hypot(f.x - x, f.y - y) < 60)
    && !w.tribe.towers.some((t) => Math.hypot(t.x - x, t.y - y) < 70)
    && !w.tribe.walls.some((t) => Math.abs((t.tx + 0.5) * TILE - x) < rx + 16 && Math.abs((t.ty + 0.5) * TILE - y) < ry + 16);
}

/** Grow around an open central square, then extend outward in wings. */
export function wingSpot(w: World, home: Shelter) {
  const group = estates(w).find((e) => e.homes.some((s) => s.id === home.id));
  const seed = (group?.homes ?? [home]).reduce((a, b) => a.id < b.id ? a : b);
  const candidates: { x: number; y: number }[] = [];
  for (let ring = 1; ring <= 3; ring++) for (let gy = -ring + 1; gy <= ring + 1; gy++) for (let gx = -ring + 1; gx <= ring + 1; gx++) {
    if (Math.max(Math.abs(gx - 1), Math.abs(gy - 1)) !== ring || (gx === 0 && gy === 0)) continue;
    candidates.push({ x: seed.x + gx * 104, y: seed.y + gy * 80 });
  }
  return candidates.filter((p) => w.shelters.some((s) => s.tier >= 4 && Math.hypot(s.x - p.x, s.y - p.y) <= 110))
    .sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))
    .find((p) => clearWingGround(w, p.x, p.y)) ?? null;
}

export function planWing(w: World, homeId: number): Shelter | string {
  const home = w.shelters.find((s) => s.id === homeId && shelterDone(s) && s.hp > 0 && !s.lift);
  if (!home || home.tier < 4) return "Choose a finished stone home to extend.";
  const spot = wingSpot(w, home);
  if (!spot) return "No room beside this castle. Clear space around its wings first.";
  const wing = w.camp.addShelter(w, spot.x, spot.y, "castle");
  clearPlantsUnderBuilds(w);
  return wing;
}
