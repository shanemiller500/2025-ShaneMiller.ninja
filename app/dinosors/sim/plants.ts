/* ------------------------------------------------------------------ */
/*  Plants: generated per biome, eaten, shaken, burnt, chopped and     */
/*  regrown. Updated round-robin so 1500 plants cost almost nothing.   */
/* ------------------------------------------------------------------ */
import { FACTS } from "../data/facts";
import { P } from "./particles";
import { hash2 } from "./rng";
import { LM } from "./terrain";
import { MAP_H, MAP_W, T, TILE, type Plant, type PlantKind } from "./types";
import type { World } from "./world";

export const TALL = new Set<PlantKind>(["conifer", "palm", "broadleaf", "fruit"]);

/** world-px height of a fully grown plant (for drawing + lightning) */
export const PLANT_H: Record<PlantKind, number> = {
  conifer: 110,
  palm: 95,
  broadleaf: 90,
  fruit: 80,
  cycad: 36,
  fern: 22,
  bush: 26,
  reeds: 24,
  horsetail: 30,
};

type Mix = [PlantKind, number][];

function mixFor(t: T, tx: number, ty: number): { density: number; mix: Mix } | null {
  const feeding = Math.hypot(tx - LM.feeding.x, ty - LM.feeding.y) < 9;
  const glade = Math.hypot(tx - LM.glade.x, ty - LM.glade.y) < 3.4;
  if (glade) return { density: 0.12, mix: [["fruit", 0.6], ["fern", 0.4]] };
  switch (t) {
    case T.Jungle:
      return { density: 0.22, mix: [["palm", 0.22], ["cycad", 0.2], ["fern", 0.33], ["broadleaf", 0.12], ["fruit", 0.13]] };
    case T.Forest:
      return { density: 0.27, mix: [["conifer", 0.62], ["fern", 0.2], ["broadleaf", 0.12], ["bush", 0.06]] };
    case T.Grass:
      return feeding
        ? { density: 0.2, mix: [["fern", 0.35], ["bush", 0.3], ["cycad", 0.2], ["fruit", 0.15]] }
        : { density: 0.035, mix: [["broadleaf", 0.28], ["bush", 0.34], ["fruit", 0.14], ["fern", 0.16], ["conifer", 0.08]] };
    case T.Swamp:
      return { density: 0.14, mix: [["reeds", 0.4], ["horsetail", 0.35], ["cycad", 0.12], ["conifer", 0.13]] };
    case T.Sand:
      return ty > 64 ? { density: 0.035, mix: [["palm", 1]] } : null;
    case T.Nest:
      return { density: 0.02, mix: [["fern", 1]] };
    case T.Rock:
      return { density: 0.012, mix: [["cycad", 0.5], ["conifer", 0.5]] };
    case T.Volcano:
      return { density: 0.01, mix: [["fern", 1]] };
    default:
      return null;
  }
}

function pickMix(mix: Mix, r: number): PlantKind {
  let acc = 0;
  for (const [k, p] of mix) {
    acc += p;
    if (r <= acc) return k;
  }
  return mix[mix.length - 1][0];
}

export function makePlant(w: World, kind: PlantKind, x: number, y: number, size = 1): Plant {
  return {
    id: w.nextId(),
    kind,
    x,
    y,
    size,
    food: 1,
    burnt: 0,
    fruit: kind === "fruit" ? 3 : 0,
    variant: Math.floor(w.rng() * 4),
    shake: 0,
    stump: false,
  };
}

export function generatePlants(w: World) {
  const seed = w.seed + 77;
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const t = w.terrain.tiles[ty * MAP_W + tx];
      const m = mixFor(t, tx, ty);
      if (!m) continue;
      if (hash2(tx, ty, seed) > m.density) continue;
      const kind = pickMix(m.mix, hash2(tx, ty, seed + 1));
      const x = tx * TILE + 4 + hash2(tx, ty, seed + 2) * (TILE - 8);
      const y = ty * TILE + 4 + hash2(tx, ty, seed + 3) * (TILE - 8);
      w.plants.push(makePlant(w, kind, x, y, 0.65 + hash2(tx, ty, seed + 4) * 0.35));
    }
  }
  w.plantsDirty = true;
}

/** Is this plant reachable for a herbivore with this reach? */
export function canReach(p: Plant, reach: "low" | "mid" | "high") {
  if (p.stump || p.burnt > 0.6 || p.food < 0.15 || p.size < 0.3) return false;
  const tall = TALL.has(p.kind);
  if (reach === "low") return !tall;
  if (reach === "high") return tall || p.kind === "cycad";
  return true;
}

let cursor = 0;

export function updatePlants(w: World, dt: number) {
  const n = w.plants.length;
  if (!n) return;
  // ~1/40th of plants per frame, scaled dt
  const batch = Math.max(1, Math.ceil(n / 40));
  const step = dt * 40;
  const grow = 1 + w.weather.rain * 2.5;
  for (let k = 0; k < batch; k++) {
    cursor = (cursor + 1) % n;
    const p = w.plants[cursor];
    if (!p) continue;
    if (p.burnt > 0) {
      const ti = Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE);
      // charred plants recover once the ground has healed
      if (w.fire.heat[ti] === 0 && w.lava.heat[ti] === 0) p.burnt = Math.max(0, p.burnt - step * 0.002 * grow);
      if (p.burnt <= 0.05 && p.stump) {
        p.stump = false;
        p.size = 0.15;
        p.food = 0.5;
      }
      continue;
    }
    if (p.stump) {
      // chopped stumps sprout again
      if (w.rng() < step * 0.003 * grow) {
        p.stump = false;
        p.size = 0.15;
      }
      continue;
    }
    p.size = Math.min(1, p.size + step * 0.002 * grow);
    p.food = Math.min(1, p.food + step * 0.006 * grow);
    if (p.kind === "fruit" && p.fruit < 4 && w.rng() < step * 0.004 * grow) p.fruit++;
  }
  for (const p of w.visiblePlants) if (p.shake > 0) p.shake = Math.max(0, p.shake - dt * 2);
}

export function burnPlantsAt(w: World, x: number, y: number, amt: number) {
  w.plantHash.each(x, y, 26, (p) => {
    if (p.stump && p.burnt >= 1) return;
    p.burnt = Math.min(1, p.burnt + amt);
    p.food = Math.max(0, p.food - amt);
    if (p.burnt >= 1) {
      p.stump = true;
      p.fruit = 0;
    }
  });
}

export function plantFuelNear(w: World, x: number, y: number) {
  let f = 0;
  w.plantHash.each(x, y, 24, (p) => {
    if (!p.stump && p.burnt < 0.8) f += (TALL.has(p.kind) ? 0.6 : 0.3) * p.size;
  });
  return Math.min(1, f);
}

/** A big herbivore bumps a fruit tree: fruit rains down. */
export function shakeFruit(w: World, p: Plant) {
  p.shake = 1;
  const n = Math.min(p.fruit, 2 + Math.floor(w.rng() * 2));
  p.fruit -= n;
  for (let i = 0; i < n; i++) {
    w.addItem("fruit", p.x + (w.rng() - 0.5) * 40, p.y + 4 + w.rng() * 14, { z: 60 + w.rng() * 20, vz: 10 });
  }
  for (let i = 0; i < 5; i++) w.particles.spawn(P.Leaf, p.x + (w.rng() - 0.5) * 40, p.y, { z: 50 + w.rng() * 40, vz: -10, vx: (w.rng() - 0.5) * 30, size: 4, max: 2, color: "#5d8c3a" });
  w.sfx("rustle", p.x, p.y, 0.7);
}

/** Lightning prefers tall trees near the strike point. */
export function tallestNear(w: World, x: number, y: number, r: number) {
  let best: Plant | null = null;
  let bestH = 0;
  w.plantHash.each(x, y, r, (p) => {
    if (p.stump) return;
    const h = PLANT_H[p.kind] * p.size;
    if (h > bestH) {
      bestH = h;
      best = p;
    }
  });
  return best as Plant | null;
}

export const POOP_FACT = FACTS.poop;
