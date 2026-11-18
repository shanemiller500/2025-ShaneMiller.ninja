import type { World } from "../sim/world";
import { shelterDone } from "../sim/build";
import type { BuildOpt } from "./tools";

/** Completed structures belonging to the player's camp, never rival settlements. */
export function ownedBuildCounts(w: World): Partial<Record<BuildOpt, number>> {
  const counts: Partial<Record<BuildOpt, number>> = {};
  const add = (kind: BuildOpt) => { counts[kind] = (counts[kind] ?? 0) + 1; };
  for (const b of w.colony.buildings) if (b.built >= 1 && b.hp > 0) add(b.kind);
  for (const s of w.shelters) if (shelterDone(s) && s.hp > 0) add(s.tier < 2 ? "tent" : "hut");
  for (const wall of w.tribe.walls) {
    if (wall.built < 1 || wall.hp <= 0) continue;
    if (wall.part === "stairs") {
      add("stairs");
      if (wall.pulley) add("pulley");
    } else if (wall.part === "gate") {
      add(wall.mega ? "megagate" : wall.bone ? "bonegate" : wall.kind === "lava" ? "lavagate" : wall.kind === "polygon" ? "polygate" : "gate");
    } else add(wall.kind === "lava" ? "lavawall" : wall.kind === "polygon" ? "polywall" : wall.kind === "stone" ? "stonewall" : "wall");
  }
  for (const t of w.tribe.towers) if (t.stage >= 3 && t.hp > 0) add("tower");
  for (const s of w.colony.scorpions) if (s.built >= 1 && s.hp > 0) add("scorpion");
  counts.farm = w.tribe.farms.length;
  counts.campfire = w.campfires.length;
  return counts;
}
