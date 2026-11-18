/* ------------------------------------------------------------------ */
/*  Plants: generated per biome, eaten, shaken, burnt, chopped and     */
/*  regrown. Updated round-robin so 1500 plants cost almost nothing.   */
/* ------------------------------------------------------------------ */
import { P } from "./particles";
import { hash2, valueNoise } from "./rng";
import { keptClear } from "./clearArea";
import { baseFuel } from "./fire";
import { SpatialHash } from "./spatial";
import { LM, REGION } from "./terrain";
import { MAP_H, MAP_W, T, TILE, type Plant, type PlantKind, type PlantSeed } from "./types";
import { seedSoilTick } from "./plantCycle";
import type { World } from "./world";
import { season } from "./seasons";

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

function mixFor(t: T, tx: number, ty: number, region = 0): { density: number; mix: Mix } | null {
  // the desert: a scrubby bush here and there; palms + ferns crowd round an oasis
  if (region === REGION.oasis && (t === T.Grass || t === T.Jungle || t === T.Sand)) return { density: 0.3, mix: [["palm", 0.55], ["fern", 0.25], ["fruit", 0.1], ["reeds", 0.1]] };
  if (region === REGION.desert) return t === T.Sand || t === T.Dune || t === T.Rock ? { density: t === T.Dune ? 0.006 : 0.014, mix: [["bush", 0.7], ["cycad", 0.3]] } : null;
  // the Great Peaks: pines, a few hardy bushes on the meadows, nothing on the snow
  if (region === REGION.peaks) {
    if (t === T.Forest) return { density: 0.24, mix: [["conifer", 0.85], ["bush", 0.1], ["fern", 0.05]] };
    if (t === T.Grass) return { density: 0.03, mix: [["conifer", 0.45], ["bush", 0.45], ["fern", 0.1]] };
    if (t === T.Rock) return { density: 0.008, mix: [["conifer", 1]] };
    return null;
  }
  const feeding = Math.hypot(tx - LM.feeding.x, ty - LM.feeding.y) < 9;
  const glade = Math.hypot(tx - LM.glade.x, ty - LM.glade.y) < 3.4;
  if (glade) return { density: 0.12, mix: [["fruit", 0.6], ["fern", 0.4]] };
  switch (t) {
    case T.Jungle:
      return { density: 0.22, mix: [["palm", 0.22], ["cycad", 0.2], ["fern", 0.33], ["broadleaf", 0.12], ["fruit", 0.13]] };
    case T.Forest:
      return { density: 0.24, mix: [["conifer", 0.36], ["fern", 0.22], ["broadleaf", 0.24], ["bush", 0.06], ["fruit", 0.06], ["cycad", 0.06]] };
    case T.Grass:
      return feeding
        ? { density: 0.2, mix: [["fern", 0.35], ["bush", 0.3], ["cycad", 0.2], ["fruit", 0.15]] }
        : { density: 0.055, mix: [["broadleaf", 0.3], ["bush", 0.12], ["fruit", 0.16], ["fern", 0.2], ["conifer", 0.1], ["cycad", 0.12]] };
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

export const NATURAL_FLORA = "naturalFlora1";

/** Broad connected clearings and smaller groves, rather than uniform random confetti. */
export function plantHabitat(w: World, tx: number, ty: number) {
  const i = ty * MAP_W + tx, t = w.terrain.tiles[i] as T;
  const m = mixFor(t, tx, ty, w.terrain.region[i]);
  if (!m) return null;
  const landmark = Math.hypot(tx - LM.feeding.x, ty - LM.feeding.y) < 9 || Math.hypot(tx - LM.glade.x, ty - LM.glade.y) < 4;
  const meadow = !landmark && w.terrain.region[i] !== REGION.oasis && (t === T.Grass || t === T.Forest || t === T.Jungle)
    && valueNoise(tx / 12, ty / 12, w.seed + 9301) > 0.64;
  const cover = valueNoise(tx / 5, ty / 5, w.seed + 4807);
  return { mix: m.mix, density: meadow ? 0 : m.density * (0.45 + cover * 1.1), meadow };
}

/** Independent channels keep species choice separate from the density lottery. */
const floraRoll = (w: World, tx: number, ty: number, channel: number) => hash2(tx + channel * 193, ty - channel * 137, w.seed + 77);

/** Natural recruitment is sparse, biome appropriate and bounded even after hundreds of days. */
export function sproutWildPlant(w: World, x: number, y: number, seed?: PlantSeed): Plant | null {
  if (w.extinction.wasteland || keptClear(w, x, y)) return null;
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!w.terrain.inBounds(tx, ty)) return null;
  const habitat = plantHabitat(w, tx, ty);
  if (!habitat || habitat.meadow || (!seed && floraRoll(w, tx, ty, 0) > habitat.density)) return null;
  if (seed && !habitat.mix.some(([kind]) => kind === seed.kind)) return null;
  if (w.colony.occupied(w, false).has(ty * MAP_W + tx) || w.tribe.farms.some((f) => Math.hypot(f.x - x, f.y - y) < 70)) return null;
  const kind = seed?.kind ?? pickMix(habitat.mix, floraRoll(w, tx, ty, 1));
  const gap = TALL.has(kind) ? 42 : 25;
  // Read the live list: two deposits in one frame must not both pass a stale spatial hash.
  if (w.plants.some((p) => Math.hypot(p.x - x, p.y - y) < gap)) return null;
  if (seed && (w.plants.filter((p) => !p.planted).length >= 2400 || w.plants.filter((p) => Math.hypot(p.x - x, p.y - y) < 160).length >= Math.max(3, Math.ceil(habitat.density * 80)))) return null;
  const p = makePlant(w, kind, x, y, 0.15);
  if (seed) { p.variant = seed.variant % 4; p.vigor = 1.12; }
  w.plants.push(p); w.plantsDirty = true;
  return p;
}

export function consumePlant(w: World, p: Plant, amount: number) {
  const before = p.food;
  p.food = Math.max(0, p.food - amount);
  if (before >= .08 && p.food < .08 && !p.planted && !TALL.has(p.kind) && w.rng() < .22) {
    p.stump = true; p.decay = 35; p.fruit = 0;
  }
}

/** One-time cleanup of old, overgrown wilderness. Gardens and camp work retain their plants. */
export function naturalizePlants(w: World) {
  if (w.flags.has(NATURAL_FLORA) || w.extinction.wasteland) return;
  w.flags.add(NATURAL_FLORA);
  if (w.plants.length < 250) return;
  const protectedTiles = new Set(w.colony.occupied(w, false));
  for (const p of w.plants) if (p.planted) protectedTiles.add(Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE));
  const protectedAt = (x: number, y: number) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (protectedTiles.has((ty + dy) * MAP_W + tx + dx)) return true;
    return w.tribe.farms.some((f) => Math.hypot(f.x - x, f.y - y) < 110) || w.clearJobs.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
  };
  const counts = new Map<number, number>();
  const patchOf = (x: number, y: number) => Math.floor(y / (TILE * 8)) * MAP_W + Math.floor(x / (TILE * 8));
  for (const p of w.plants) counts.set(patchOf(p.x, p.y), (counts.get(patchOf(p.x, p.y)) ?? 0) + 1);
  const active = new Set([...w.humans, ...w.dinos].map((c) => c.targetId));
  const occupied = new Set<number>();
  const retained = new SpatialHash<Plant>(64);
  w.plants = w.plants.filter((p) => {
    if (p.planted || p.stump || p.burnt > 0 || active.has(p.id) || protectedAt(p.x, p.y)) { retained.insert(p); return true; }
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE), i = ty * MAP_W + tx;
    if ((w.terrain.tiles[i] !== w.terrain.base[i] && w.terrain.tiles[i] !== T.Grass) || keptClear(w, p.x, p.y)) { retained.insert(p); return true; }
    const h = plantHabitat(w, tx, ty);
    if (!h) { retained.insert(p); return true; }
    const share = Math.min(1, h.density * 64 / (counts.get(patchOf(p.x, p.y)) ?? 1));
    if (h.meadow || occupied.has(i) || hash2(Math.round(p.x), Math.round(p.y), w.seed + 721) > share) return false;
    occupied.add(i);
    if (p.kind === "bush" || p.kind === "fern") {
      p.kind = pickMix(h.mix, floraRoll(w, tx, ty, 1));
      p.fruit = p.kind === "fruit" ? 3 : 0;
    }
    let crowded = false;
    retained.each(p.x, p.y, TALL.has(p.kind) ? 42 : 22, () => { crowded = true; return true; });
    if (crowded) return false;
    retained.insert(p);
    return true;
  });
  // Only untouched natural forest floor changes: preserve water, terrain edits, farms and buildings.
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const i = ty * MAP_W + tx, t = w.terrain.tiles[i];
    if ((t !== T.Forest && t !== T.Jungle) || t !== w.terrain.base[i]) continue;
    if (!plantHabitat(w, tx, ty)?.meadow || protectedAt((tx + .5) * TILE, (ty + .5) * TILE)) continue;
    w.terrain.setTile(tx, ty, T.Grass); w.fire.fuel[i] = baseFuel(T.Grass);
  }
  w.plantsDirty = true;
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

/** Scatter the wild plants (only where `only` says, when given: an older world's new lands). */
export function generatePlants(w: World, only?: (tx: number, ty: number) => boolean) {
  const seed = w.seed + 77;
  const scatter = new SpatialHash<Plant>(64);
  scatter.rebuild(w.plants);
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (only && !only(tx, ty)) continue;
      const m = plantHabitat(w, tx, ty);
      if (!m) continue;
      if (m.meadow) continue;
      if (floraRoll(w, tx, ty, 0) > m.density) continue;
      const kind = pickMix(m.mix, floraRoll(w, tx, ty, 1));
      const x = tx * TILE + 4 + hash2(tx, ty, seed + 2) * (TILE - 8);
      const y = ty * TILE + 4 + hash2(tx, ty, seed + 3) * (TILE - 8);
      let crowded = false;
      scatter.each(x, y, TALL.has(kind) ? 42 : 22, () => { crowded = true; return true; });
      if (crowded) continue;
      const p = makePlant(w, kind, x, y, 0.65 + hash2(tx, ty, seed + 4) * 0.35);
      w.plants.push(p); scatter.insert(p);
    }
  }
  w.plantsDirty = true;
  if (!only) naturalizePlants(w);
}

/** Is this plant reachable for a herbivore with this reach? */
export function canReach(p: Plant, reach: "low" | "mid" | "high") {
  if (p.stump || p.burnt > 0.6 || p.food < 0.15 || p.size < 0.3) return false;
  const tall = TALL.has(p.kind);
  if (reach === "low") return !tall;
  if (reach === "high") return tall || p.kind === "cycad";
  return true;
}

/** which plant each world's slow growth pass is up to */
const cursors = new WeakMap<World, number>();

export function updatePlants(w: World, dt: number) {
  seedSoilTick(w);
  // after the supervolcano nothing grows until the ash thins
  if (w.extinction.wasteland) return;
  const n = w.plants.length;
  if (!n) return;
  // ~1/40th of plants per frame, scaled dt
  const batch = Math.max(1, Math.ceil(n / 40));
  const step = dt * n / batch;
  const decomposed = new Set<Plant>();
  // rain helps; the season + droughts / spring rains set the pace
  const grow = (1 + w.weather.rain * 2.5) * season(w).plants * w.almanac.plantsMul();
  for (let k = 0; k < batch; k++) {
    const cursor = ((cursors.get(w) ?? 0) + 1) % n;
    cursors.set(w, cursor);
    const p = w.plants[cursor];
    if (!p) continue;
    if (p.decay !== undefined) {
      p.decay -= step;
      if (p.decay <= 0) decomposed.add(p);
      continue;
    }
    if (p.burnt > 0) {
      const ti = Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE);
      // charred plants recover once the fire is out (a couple of minutes, faster in rain)
      if (w.fire.heat[ti] === 0 && w.lava.heat[ti] === 0) p.burnt = Math.max(0, p.burnt - step * 0.006 * grow);
      if (p.burnt <= 0.05 && p.stump) {
        p.stump = false;
        p.size = 0.18;
        p.food = 0.5;
      }
      continue;
    }
    if (p.stump) {
      // chopped stumps sprout again
      if (w.rng() < step * 0.008 * grow) {
        p.stump = false;
        p.size = 0.18;
      }
      continue;
    }
    // saplings shoot up quickly, then slow down as they fill out
    p.size = Math.min(p.vigor ?? 1, p.size + step * (p.size < 0.5 ? 0.006 : 0.003) * grow * (p.vigor ?? 1));
    p.food = Math.min(1, p.food + step * 0.006 * grow * (p.vigor ?? 1));
    if (p.kind === "fruit" && p.fruit < 4 && w.rng() < step * 0.004 * grow) p.fruit++;
  }
  if (decomposed.size) { w.plants = w.plants.filter((p) => !decomposed.has(p)); w.plantsDirty = true; }
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
