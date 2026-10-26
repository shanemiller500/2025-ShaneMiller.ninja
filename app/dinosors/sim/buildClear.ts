import { BUILDINGS } from "../data/colony";
import { MAP_H, MAP_W, TILE } from "./types";
import type { World } from "./world";

type Footprint = { x0: number; y0: number; x1: number; y1: number };

/** Ground covered by placed camp work. Keep unplanted vineyards until their bushes become cuttings. */
function footprints(w: World): Footprint[] {
  const areas: Footprint[] = [];
  const tileRect = (tx: number, ty: number, width = 1, height = 1) =>
    areas.push({ x0: tx * TILE, y0: ty * TILE, x1: (tx + width) * TILE, y1: (ty + height) * TILE });

  for (const b of w.colony.buildings) {
    if (b.lift) continue;
    const def = BUILDINGS[b.kind];
    tileRect(b.tx, b.ty, def.w, def.h);
  }
  for (const wall of w.tribe.walls) tileRect(wall.tx, wall.ty);
  for (const tower of w.tribe.towers) tileRect(tower.tx, tower.ty, 2, 2);
  for (const scorpion of w.colony.scorpions) if (scorpion.mount === "ground") tileRect(scorpion.tx, scorpion.ty);
  for (const shelter of w.shelters) if (!shelter.lift) areas.push({ x0: shelter.x - 36, y0: shelter.y - 38, x1: shelter.x + 36, y1: shelter.y + 10 });
  // Farms joined by the renderer form one continuous field. Clear its gaps as well.
  const farms = w.tribe.farms;
  const seen = new Set<number>();
  for (let i = 0; i < farms.length; i++) {
    if (seen.has(i)) continue;
    const group = [i];
    seen.add(i);
    for (let head = 0; head < group.length; head++) {
      const a = farms[group[head]];
      for (let j = 0; j < farms.length; j++) {
        const b = farms[j];
        if (seen.has(j) || (a.crop === "grape") !== (b.crop === "grape") || Math.abs(a.x - b.x) >= 100 || Math.abs(a.y - b.y) >= 62) continue;
        seen.add(j);
        group.push(j);
      }
    }
    const plots = group.map((index) => farms[index]);
    if (plots[0].crop === "grape" && !plots.every((farm) => farm.planted)) {
      for (const farm of plots) if (farm.planted) areas.push({ x0: farm.x - 38, y0: farm.y - 22, x1: farm.x + 38, y1: farm.y + 22 });
      continue;
    }
    areas.push({
      x0: Math.min(...plots.map((farm) => farm.x)) - 38,
      y0: Math.min(...plots.map((farm) => farm.y)) - 22,
      x1: Math.max(...plots.map((farm) => farm.x)) + 38,
      y1: Math.max(...plots.map((farm) => farm.y)) + 22,
    });
  }
  // The central work area should stay open in existing camps too.
  areas.push({ x0: w.camp.x - 170, y0: w.camp.y - 105, x1: w.camp.x + 170, y1: w.camp.y + 105 });
  for (const fire of w.campfires) areas.push({ x0: fire.x - 18, y0: fire.y - 14, x1: fire.x + 18, y1: fire.y + 14 });
  return areas;
}

/** Remove wild plants rooted beneath camp work, including paths and old saved layouts. */
export function clearPlantsUnderBuilds(w: World) {
  if (!w.plants.length) return 0;
  const areas = footprints(w);
  if (!areas.length) return 0;
  const byTile = new Map<number, Footprint[]>();
  for (const area of areas) {
    const x0 = Math.max(0, Math.floor(area.x0 / TILE));
    const y0 = Math.max(0, Math.floor(area.y0 / TILE));
    const x1 = Math.min(MAP_W - 1, Math.floor(area.x1 / TILE));
    const y1 = Math.min(MAP_H - 1, Math.floor(area.y1 / TILE));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const key = ty * MAP_W + tx;
      const local = byTile.get(key);
      if (local) local.push(area);
      else byTile.set(key, [area]);
    }
  }
  let removed = 0;
  const unplantedVines = w.tribe.farms.filter((farm) => farm.crop === "grape" && !farm.planted);
  for (let i = w.plants.length - 1; i >= 0; i--) {
    const plant = w.plants[i];
    if (unplantedVines.some((farm) => Math.hypot(plant.x - farm.x, (plant.y - farm.y) * 1.4) <= 62)) continue;
    const local = byTile.get(Math.floor(plant.y / TILE) * MAP_W + Math.floor(plant.x / TILE));
    if (!local?.some((a) => plant.x >= a.x0 && plant.x <= a.x1 && plant.y >= a.y0 && plant.y <= a.y1)) continue;
    w.plants.splice(i, 1);
    removed++;
  }
  if (removed) w.plantsDirty = true;
  return removed;
}
