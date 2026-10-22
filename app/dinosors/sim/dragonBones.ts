/* ------------------------------------------------------------------ */
/*  Dragon bones: a monument.                                          */
/*                                                                     */
/*  When one of OUR dragons dies, its great skeleton is laid out where */
/*  it fell, on a stone plinth with its name carved in: a shrine the   */
/*  tribe can carry anywhere (the Move tool, like any building). Wild  */
/*  dragons just leave a scatter of bones (dragons.ts).                */
/* ------------------------------------------------------------------ */
import { dragonStats } from "./dragonKeep";
import { P } from "./particles";
import { TILE, type Building, type Dragon } from "./types";
import type { World } from "./world";

/** Lay a dead dragon's bones out as a monument near where it fell (null if there's nowhere to put it). */
export function raiseBones(w: World, dr: Dragon, ours: boolean): Building | null {
  const size = Math.max(0.5, Math.min(1.8, dragonStats(dr).scale));
  // where it fell (straight down if it was flying), else the nearest open ground round about
  let b: Building | null = null;
  for (let k = 0; k < 40 && !b; k++) {
    const a = k * 2.4;
    const r = k === 0 ? 0 : TILE * (1 + k * 0.6);
    b = w.colony.addBuilding(w, "dragonBones", dr.x + Math.cos(a) * r, dr.y + Math.sin(a) * r * 0.7);
  }
  if (!b) return null;
  b.built = 1;
  b.label = dr.name;
  b.breed = dr.breed ?? "fire";
  b.size = Math.round(size * 100) / 100;
  b.ours = ours;
  w.colony.version++;
  w.particles.burst(P.Dust, b.x, b.y - 10, 18, 70, { size: 14, max: 1.2, color: "rgba(220,210,190,0.7)" });
  w.toast("🦴", ours
    ? `${dr.name} has died. The tribe lays its great bones out on a stone plinth: a monument to ${dr.name}. (Carry it anywhere with the Move tool.)`
    : `${dr.name} has fallen! Its great bones lie where it crashed: a monument to the hunt. (Carry it home with the Move tool.)`, b.x, b.y);
  return b;
}
