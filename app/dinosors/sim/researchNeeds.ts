import { TECH } from "../data/facts";
import type { Resource } from "./types";
import type { World } from "./world";

/** Every material still needed by the active invention and civilization study. */
export function researchShortages(w: World): Resource[] {
  const missing: Resource[] = [];
  const add = (cost: Partial<Record<Resource, number>>) => {
    for (const [resource, amount] of Object.entries(cost) as [Resource, number][]) {
      if (w.camp.stock[resource] < amount && !missing.includes(resource)) missing.push(resource);
    }
  };
  if (w.camp.goal && !w.camp.crafting && w.camp.goal !== "shelter") add(TECH[w.camp.goal].needs);
  if (w.civ.current && !w.civ.paid) add(w.civ.costOf(w.civ.current));
  return missing;
}
