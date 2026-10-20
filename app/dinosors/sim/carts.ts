/* ------------------------------------------------------------------ */
/*  Hand carts + spreading the gatherers.                              */
/*                                                                     */
/*  Once the tribe has axes (carts are wood), anyone going out for a   */
/*  bulky load (stone, clay, wood, ore, obsidian from the lava fields) */
/*  pulls a two-wheeled cart: twice the load each trip.                */
/*                                                                     */
/*  Who goes for what: the supplies the camp is lowest on come first,  */
/*  and each gets a crew of two before anyone is sent for the next     */
/*  lowest. With 10 people free, the 5 lowest supplies get 2 each;     */
/*  then round again. People already sent count, so it re-balances    */
/*  itself as stocks change.                                           */
/* ------------------------------------------------------------------ */
import type { Human, Resource } from "./types";
import type { World } from "./world";

/** What's worth taking a cart out for. */
export const BULKY = new Set<Resource>(["stone", "limestone", "clay", "wood", "iron", "gold", "silver", "copper", "obsidian", "flint", "salt", "tar", "quartz", "magnetite", "crystal", "meteorite", "coal"]);

/** Gatherers per supply before the next-lowest gets anyone. */
export const CREW = 2;

/** Pulling a cart right now: heading out for (or hauling home) a bulky load. */
export function hasCart(w: World, h: Human) {
  if (h.child || h.stranger || h.riding || h.aloft || h.captive || h.level || !w.camp.learned.has("axe")) return false;
  if (h.task && BULKY.has(h.task as Resource)) return true;
  return !!h.carry && BULKY.has(h.carry) && h.state === "carry";
}

/** How many people are already out after each supply. */
export function crews(w: World, me: Human) {
  const sent = new Map<Resource, number>();
  for (const o of w.humans) {
    if (o === me || o.child || o.stranger || !o.task) continue;
    const r = o.task as Resource;
    sent.set(r, (sent.get(r) ?? 0) + 1);
  }
  return sent;
}

/**
 * Pick what this person should fetch: the lowest supply still short of a crew of two (that they can
 * actually find), then the next lowest, and so on; once every supply has two, round again for four.
 */
export function pickNeed<S>(w: World, h: Human, needs: Resource[], find: (r: Resource) => S | null): { r: Resource; src: S } | null {
  if (!needs.length) return null;
  const sent = crews(w, h);
  const found = new Map<Resource, S | null>();
  const src = (r: Resource) => {
    if (!found.has(r)) found.set(r, find(r));
    return found.get(r)!;
  };
  const rounds = Math.max(1, Math.ceil(w.humans.length / Math.max(1, needs.length * CREW)) + 1);
  for (let k = 1; k <= rounds; k++) {
    for (const r of needs) {
      if ((sent.get(r) ?? 0) >= CREW * k) continue;
      const s = src(r);
      if (s) return { r, src: s };
    }
  }
  // everyone's covered: help with the lowest one we can reach
  for (const r of needs) {
    const s = src(r);
    if (s) return { r, src: s };
  }
  return null;
}
