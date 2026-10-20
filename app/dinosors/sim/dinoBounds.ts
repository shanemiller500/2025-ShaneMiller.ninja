/* ------------------------------------------------------------------ */
/*  Animals stay outside the walls.                                    */
/*                                                                     */
/*  The tribe's own dinosaurs aren't allowed inside the wall ring: a   */
/*  loose one never steps in through a gate, one that's already in     */
/*  walks back out, and a rider heading inside hops off at the wall    */
/*  (the dino waits outside). Pens, stables, perches + other animal    */
/*  buildings can only go outside the walls; any already inside are    */
/*  moved out.                                                         */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { sp } from "../data/species";
import { isBaby } from "./dinos";
import { P } from "./particles";
import { TILE, type BuildingKind, type Dino } from "./types";
import type { World } from "./world";

/** Buildings for animals: they belong outside the walls. */
export const ANIMAL_KINDS = new Set<BuildingKind>(["pen", "stable", "perch", "tack", "roost", "dragonYard", "feedPit", "dragonPit"]);

/** Is (x, y) inside the settlement's walls (gates count as shut)? */
export function insideWalls(w: World, x: number, y: number) {
  return w.tribe.walledIn(w, x, y);
}

/**
 * The rule: no grown dinosaur inside the walls. Babies may stay; raiders are the enemy (they break
 * in, that's what the walls are for); flyers fly over everything; a dino carrying its rider stops
 * at the wall and its rider hops off.
 */
export function bannedInside(d: Dino) {
  return !isBaby(d) && !d.raider && !d.under && !d.rider && sp(d.species).move === "walk";
}

/** A grown dinosaur may not step from outside the walls to inside. */
export function blockedForDino(w: World, d: Dino, x: number, y: number) {
  if (!w.tribe.walls.length || !bannedInside(d)) return false;
  return w.tribe.walledIn(w, x, y) && !w.tribe.walledIn(w, d.x, d.y);
}

/** The nearest open ground outside the walls (searching outward from x, y). */
export function outsideSpot(w: World, x: number, y: number) {
  if (!insideWalls(w, x, y)) return { x, y };
  for (let r = TILE * 2; r < TILE * 50; r += TILE) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + r * 0.01;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (w.nav.passable("dino", px, py) && !w.tribe.walledIn(w, px, py)) return { x: px, y: py };
    }
  }
  return { x, y };
}

/**
 * A grown dinosaur that's inside walks back out (through a gate). If it's stuck (a shut gate),
 * it's led straight out. Returns where it's headed (or false).
 */
/** When each dino started trying to leave (per world, not saved). */
const leaving = new WeakMap<World, Map<number, number>>();

export function leaveWalls(w: World, d: Dino) {
  const since = leaving.get(w) ?? new Map<number, number>();
  leaving.set(w, since);
  if (!w.tribe.walls.length || !bannedInside(d) || !insideWalls(w, d.x, d.y)) {
    since.delete(d.id);
    return false;
  }
  const s = outsideSpot(w, d.x, d.y);
  if (!since.has(d.id)) since.set(d.id, w.elapsed);
  // can't find the way out (a shut gate, a corner): led straight out
  if (d.stuckT > 3 || w.elapsed - since.get(d.id)! > 8) {
    since.delete(d.id);
    w.particles.burst(P.Dust, d.x, d.y, 8, 50, { size: 10, max: 0.7, color: "rgba(180,160,120,0.6)" });
    d.x = s.x;
    d.y = s.y;
    d.stuckT = 0;
    d.path = null;
  }
  if (d.owner && !w.flags.has("dinosOutside")) {
    w.flags.add("dinosOutside");
    w.toast("🚫", `${d.name} has to stay outside: no grown dinosaurs inside the walls. Pens go outside the gates.`, d.x, d.y);
  }
  return s;
}

/**
 * Animal buildings inside the walls are moved out (kept finished). Runs every so often from the
 * tribe's planner; returns how many moved.
 */
export function moveAnimalBuildingsOut(w: World) {
  if (!w.tribe.walls.length) return 0;
  let n = 0;
  for (const b of [...w.colony.buildings]) {
    if (!ANIMAL_KINDS.has(b.kind) || !w.tribe.walledIn(w, b.x, b.y)) continue;
    const s = outsideSpot(w, b.x, b.y);
    if (s.x === b.x && s.y === b.y) continue;
    const def = BUILDINGS[b.kind];
    // try a few spots round the first open one outside
    let moved = null;
    for (let k = 0; k < 12 && !moved; k++) {
      const a = (k / 12) * Math.PI * 2;
      const px = s.x + Math.cos(a) * (k ? 40 + def.w * TILE * 0.5 : 0);
      const py = s.y + Math.sin(a) * (k ? 30 + def.h * TILE * 0.5 : 0);
      if (w.tribe.walledIn(w, px, py)) continue;
      w.colony.removeBuilding(b);
      const nb = w.colony.addBuilding(w, b.kind, px, py);
      if (nb) {
        nb.built = b.built;
        nb.hp = b.hp;
        nb.have = { ...b.have };
        moved = nb;
      } else w.colony.buildings.push(b);
    }
    if (moved) {
      n++;
      w.toast(def.icon, `${def.name} moved outside the walls: animals live outside the gates.`, moved.x, moved.y);
    }
  }
  if (n) w.colony.version++;
  return n;
}
