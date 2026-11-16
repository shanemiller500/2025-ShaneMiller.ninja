/* ------------------------------------------------------------------ */
/*  The healing hut grows into a hospital.                             */
/*                                                                     */
/*  Someone hurt (below half health) stops work and walks to the       */
/*  nearest healing hut that has a free bed. They're admitted, stay a  */
/*  short while (a couple of game hours at most), and walk out mended. */
/*  A hut only has so many beds: when they're all taken the rest wait  */
/*  at home (healing slowly) and the camp is told it needs a bigger    */
/*  one, or another.                                                   */
/*                                                                     */
/*    Healing hut  → 2 beds                                            */
/*    Infirmary    → 4 beds, faster (copper tools from the refinery)   */
/*    Hospital     → 8 beds, fastest (silver instruments + salt)       */
/*                                                                     */
/*  Beds are held by `Human.bed` (the building's id). Not saved: after */
/*  a load the hurt simply get admitted again.                         */
/* ------------------------------------------------------------------ */
import type { Cost } from "../data/colony";
import type { Building, Human } from "./types";
import type { World } from "./world";

export interface HealerTier {
  icon: string;
  name: string;
  beds: number;
  /** how much faster than the plain hut people mend in its beds */
  speed: number;
  /** cost to upgrade INTO this tier (the hut itself is the building cost) */
  cost: Cost;
  tip: string;
}

export const HEALER_TIERS: HealerTier[] = [
  { icon: "🌿", name: "Healing hut", beds: 2, speed: 1, cost: {}, tip: "Two beds of leaves and a pot of herbs." },
  { icon: "⚕️", name: "Infirmary", beds: 4, speed: 1.4, cost: { wood: 8, stone: 6, clay: 4, copperBar: 1 }, tip: "A second room, four beds, and copper tools from the refinery: people are back on their feet sooner." },
  { icon: "🏥", name: "Hospital", beds: 8, speed: 2, cost: { stone: 14, wood: 8, silverBar: 1, salt: 2 }, tip: "A proper stone hospital: eight beds, silver instruments and salt to keep wounds clean. Nobody stays long." },
];

/** Mending in a bed, health per second, before the tier's speed (0.4 of health = about 25 s in the plain hut). */
export const BED_RATE = 0.016;
/** How far someone hurt will walk for a bed (px). */
export const BED_REACH = 2600;
/** Seconds between "the hut is full" warnings. */
const FULL_EVERY = 150;

export const healerLevel = (b: Pick<Building, "level">) => Math.max(1, Math.min(HEALER_TIERS.length, b.level ?? 1));
export const healerTier = (b: Pick<Building, "level">) => HEALER_TIERS[healerLevel(b) - 1];

const open = (b: Building) => b.kind === "healer" && b.built >= 1 && b.hp > 0;

/** Everyone holding a bed there. */
export function patientsOf(w: World, b: Building): Human[] {
  return w.humans.filter((h) => h.bed === b.id);
}

/** Finished healing places, with their beds. */
export function wards(w: World) {
  return w.colony.buildings.filter(open).map((b) => ({ b, tier: healerTier(b), taken: patientsOf(w, b).length }));
}

/**
 * The bed for someone hurt: the one they already hold, else the nearest place with a free one
 * (they're booked in at once, so two people never walk to the same last bed). Null = none free.
 */
export function bedFor(w: World, h: Human): Building | null {
  if (h.bed) {
    const mine = w.colony.buildings.find((b) => b.id === h.bed);
    if (mine && open(mine)) return mine;
    h.bed = undefined;
  }
  let best: Building | null = null;
  let bd = BED_REACH;
  for (const b of w.colony.buildings) {
    if (!open(b)) continue;
    const d = Math.hypot(b.x - h.x, b.y - h.y);
    if (d >= bd || patientsOf(w, b).length >= healerTier(b).beds) continue;
    bd = d;
    best = b;
  }
  if (best) h.bed = best.id;
  return best;
}

/** Is there a healing place in reach at all (full or not)? */
export function wardInReach(w: World, h: Human) {
  return w.colony.buildings.some((b) => open(b) && Math.hypot(b.x - h.x, b.y - h.y) < BED_REACH);
}

/** In their bed right now (inside the building, resting)? */
export function inBed(w: World, h: Human): Building | null {
  if (!h.bed || h.state !== "rest") return null;
  const b = w.colony.buildings.find((x) => x.id === h.bed);
  if (!b || !open(b)) return null;
  const door = w.colony.door(b);
  return Math.hypot(door.x - h.x, door.y - h.y) < 30 ? b : null;
}

/**
 * Someone resting at a healing place's door without a bed (sent there by hand, "Rest at the healing hut"):
 * they take a free one while they need it.
 */
export function claimBedAtDoor(w: World, h: Human): Building | null {
  if (h.bed || h.hp >= 0.95 || h.stranger) return null;
  for (const b of w.colony.buildings) {
    if (!open(b)) continue;
    const door = w.colony.door(b);
    if (Math.hypot(door.x - h.x, door.y - h.y) > 30 || patientsOf(w, b).length >= healerTier(b).beds) continue;
    h.bed = b.id;
    return b;
  }
  return null;
}

/** Health per second for someone in that bed. */
export function bedRate(w: World, b: Building) {
  return BED_RATE * healerTier(b).speed * (w.camp.learned.has("medicine") ? 1.15 : 1) * (w.civ.has("herbalism") ? 1.3 : 1);
}

/** Mended (or gone elsewhere): the bed is free for the next one. */
export function discharge(w: World, h: Human, well = true) {
  if (!h.bed) return;
  const b = w.colony.buildings.find((x) => x.id === h.bed);
  h.bed = undefined;
  if (well && b) {
    h.bubble = { text: "All better!", t: 2 };
    w.discover("healer", b.x, b.y);
  }
}

/** The next tier and whether the stores can pay for it (null = already a hospital). */
export function healerUpgrade(w: World, b: Building) {
  const next = HEALER_TIERS[healerLevel(b)];
  return next ? { ...next, ok: w.colony.affordable(w, next.cost) } : null;
}

/** Pay for the next tier and build it (returns why not). */
export function upgradeHealer(w: World, b: Building): string | null {
  if (!open(b)) return "Finish (or repair) it first.";
  const next = HEALER_TIERS[healerLevel(b)];
  if (!next) return "It's already a full hospital.";
  if (!w.colony.affordable(w, next.cost)) return `Not enough in the stores for the ${next.name}.`;
  for (const [r, n] of Object.entries(next.cost) as [keyof typeof w.camp.stock, number][]) w.camp.stock[r] -= n;
  b.level = healerLevel(b) + 1;
  w.colony.version++;
  w.toast(next.icon, `The healing hut is now ${next.name === "Infirmary" ? "an" : "a"} ${next.name}: ${next.beds} beds, and people mend ${Math.round(next.speed * 100 - 100)}% faster.`, b.x, b.y);
  return null;
}

/** People hurt enough to need a bed who haven't got one. */
export function waiting(w: World): Human[] {
  return w.humans.filter((h) => h.selfHealing && !h.bed && !h.stranger && !h.captive && !h.under && !h.hung && h.state !== "down");
}

const lastFull = new WeakMap<World, number>();
const lastTick = new WeakMap<World, number>();

/** Once a second: free the beds of people who've gone, and say so when the beds have run out. */
export function hospitalTick(w: World) {
  if (Math.abs(w.elapsed - (lastTick.get(w) ?? -9)) < 1) return;
  lastTick.set(w, w.elapsed);
  for (const h of w.humans) {
    if (!h.bed) continue;
    // back on their feet, carried off, or sent underground: the bed is free again
    const resting = h.state === "rest" && h.hp < 0.95;
    if ((!h.selfHealing && !resting) || h.captive || h.under || h.hung || h.yetiHeld || h.state === "down") h.bed = undefined;
  }
  const all = wards(w);
  if (!all.length) return;
  const queue = waiting(w).filter((h) => wardInReach(w, h));
  if (!queue.length || all.some((x) => x.taken < x.tier.beds)) return;
  if (w.elapsed - (lastFull.get(w) ?? -1e9) < FULL_EVERY) return;
  lastFull.set(w, w.elapsed);
  const beds = all.reduce((n, x) => n + x.tier.beds, 0);
  const big = all.every((x) => healerLevel(x.b) >= HEALER_TIERS.length);
  w.toast("🏥", `Every bed is taken (${beds} bed${beds === 1 ? "" : "s"}) and ${queue.length} more hurt ${queue.length === 1 ? "person is" : "people are"} waiting at home. ${big ? "Build another hospital." : "Tap the healing hut to make it bigger, or build another."}`, all[0].b.x, all[0].b.y);
}

/** For the building's card. */
export function wardView(w: World, b: Building) {
  const tier = healerTier(b);
  const inside = patientsOf(w, b);
  return {
    level: healerLevel(b),
    name: tier.name,
    icon: tier.icon,
    beds: tier.beds,
    patients: inside.map((h) => ({ id: h.id, name: h.name, hp: h.hp, here: !!inBed(w, h) })),
    waiting: waiting(w).length,
    /** seconds a half-dead patient stays */
    stay: Math.round(0.4 / bedRate(w, b)),
    next: healerUpgrade(w, b),
  };
}
