import { P } from "./particles";
import { sproutWildPlant } from "./plants";
import { season } from "./seasons";
import type { Human, Item, Plant, PlantSeed, SeedCarrier } from "./types";
import type { World } from "./world";

/** One chance per meal interval, not one chance every simulation frame. */
export function swallowSeed(w: World, animal: SeedCarrier & { x: number; y: number }, plant: Pick<Plant, "kind" | "variant" | "x" | "y">, human = false) {
  if (animal.seedMeal || w.elapsed < (animal.nextSeedMeal ?? 0)) return;
  animal.nextSeedMeal = w.elapsed + 420 + w.rng() * 480;
  if (w.rng() > (human ? .14 : .26)) return;
  animal.seedMeal = { kind: plant.kind, variant: plant.variant, originX: plant.x, originY: plant.y, readyAt: w.elapsed + 70 + w.rng() * 100 };
}

/** Digestion and movement matter; a stationary animal cannot keep reseeding its food bowl. */
export function passedSeed(w: World, animal: SeedCarrier & { x: number; y: number }): PlantSeed | undefined {
  const seed = animal.seedMeal;
  if (!seed) return;
  if (w.elapsed > seed.readyAt + 900) { animal.seedMeal = undefined; return; }
  if (w.elapsed < seed.readyAt || Math.hypot(animal.x - seed.originX, animal.y - seed.originY) < 96) return;
  animal.seedMeal = undefined;
  return seed;
}

/** People occasionally leave compost after eating berries, without changing their work orders. */
export function humanSeedTick(w: World, h: Human, dt: number) {
  if (!h.seedMeal || h.child || h.stranger || h.captive || h.under || h.aloft || h.riding || h.chariot || h.state === "down" || h.hp <= 0) return;
  if (w.rng() > dt * .025) return;
  const seed = passedSeed(w, h);
  if (seed) w.addItem("poop", h.x, h.y + 4, { amount: .25, seed });
}

/** Poop first decomposes, then a viable seed spends time in the soil. Most deposits grow nothing. */
export function compostDeposit(w: World, item: Item) {
  if (w.extinction.wasteland) return;
  for (const p of w.plants) if (!p.stump && Math.hypot(p.x - item.x, p.y - item.y) < 48) p.vigor = Math.min(1.12, (p.vigor ?? 1) + .015);
  if (!item.seed || w.seedBeds.length >= 48 || w.rng() > .6) return;
  w.seedBeds.push({ seed: { ...item.seed }, x: item.x, y: item.y, readyAt: w.elapsed + 25 + w.rng() * 35, expiresAt: w.elapsed + 1200 });
}

export function seedSoilTick(w: World) {
  if (!w.seedBeds.length) return;
  const expired = new Set<(typeof w.seedBeds)[number]>();
  for (const bed of w.seedBeds) {
    if (w.elapsed > bed.expiresAt) { expired.add(bed); continue; }
    if (w.elapsed < bed.readyAt || w.elapsed < w.seedGrowthAt || season(w).id === "winter" || w.extinction.wasteland) continue;
    bed.readyAt = w.elapsed + 20;
    // A seed settles close to where it was deposited, never beside its original parent.
    for (let i = 0; i < 6; i++) {
      const a = w.rng() * Math.PI * 2, r = i ? 12 + w.rng() * 48 : 0;
      const x = bed.x + Math.cos(a) * r, y = bed.y + Math.sin(a) * r;
      if (Math.hypot(x - bed.seed.originX, y - bed.seed.originY) < 96) continue;
      const p = sproutWildPlant(w, x, y, bed.seed);
      if (!p) continue;
      w.seedGrowthAt = w.elapsed + 6;
      expired.add(bed);
      if (w.inView(x, y)) w.particles.burst(P.Leaf, x, y, 5, 20, { color: "#a8c96f", size: 3, max: 1.2 });
      if (!w.flags.has("travellingSeed")) {
        w.flags.add("travellingSeed");
        w.toast("🌱", "A travelling seed took root! Food, movement and compost help the landscape change. Open meadows stay clear.", x, y);
      }
      break;
    }
  }
  w.seedBeds = w.seedBeds.filter((bed) => !expired.has(bed));
}

