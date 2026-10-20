/* ------------------------------------------------------------------ */
/*  Dragon keepers: one person, one egg, one dragon for life.          */
/*                                                                     */
/*  Whoever runs a dragon egg home becomes its 🐉 Dragon keeper (eggs   */
/*  that arrived without anyone get the best free person: egg runners  */
/*  first). A keeper sits with their egg in the incubation shelter,    */
/*  stokes the fire and turns the egg (a tended egg hatches faster).   */
/*  When it hatches the baby bonds to them; they feed it, teach it its */
/*  lessons, play with it (chase, fetch, little hops) and put on shows */
/*  in the dragon pit. Once it can take a rider, its keeper is the one */
/*  who flies it.                                                      */
/* ------------------------------------------------------------------ */
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import type { Dragon, DragonEgg, Human } from "./types";
import type { World } from "./world";
import { bondDragon, dragonStats, nextDragonLesson, ownedDragon, rideable } from "./dragonKeep";
import { atEggHome, eggDropOff } from "./dragonNests";
import { carriesEgg, eggCapacity, eggsCarried, pickEgg, settleCarried } from "./dragonRaid";

const claimedBy = (w: World, e: DragonEgg) => w.humans.find((o) => o.eggFor === e.id) ?? null;

/** Somebody who can look after an egg or a dragon. */
const fit = (h: Human) => !h.child && !h.stranger && !h.captive && !h.under && h.state !== "down";

/** The keeper of an egg / dragon (if they're still around). */
export function keeperOf(w: World, thing: { keeper?: number }): Human | null {
  if (!thing.keeper) return null;
  const h = w.humans.find((x) => x.id === thing.keeper);
  return h && !h.stranger && !h.captive ? h : null;
}

/** What this person keeps: their egg or their dragon. */
export function chargeOf(w: World, h: Human): { egg?: DragonEgg; dragon?: Dragon } | null {
  const dragon = w.dragons.owned.find((d) => d.keeper === h.id);
  if (dragon) return { dragon };
  const egg = w.dragons.eggs.find((e) => e.keeper === h.id && (e.at === "camp" || e.at === "carried" || e.at === "ground"));
  return egg ? { egg } : null;
}

const keeping = (w: World, h: Human) => w.dragons.owned.some((d) => d.keeper === h.id) || w.dragons.eggs.some((e) => e.keeper === h.id && e.at !== "nest");

/** Make someone a keeper (their job becomes Dragon keeper). */
export function makeKeeper(w: World, thing: DragonEgg | Dragon, h: Human, quiet = false) {
  const old = keeperOf(w, thing);
  if (old && old !== h && !chargeOfOther(w, old, thing)) old.role = old.role === "dragonKeeper" ? "auto" : old.role;
  thing.keeper = h.id;
  h.role = "dragonKeeper";
  h.think = 0;
  if (!quiet) {
    const what = "breed" in thing && "progress" in thing ? "egg" : (thing as Dragon).name;
    w.toast("🥚", `${h.name} is now the keeper of ${what === "egg" ? "a dragon egg" : what}: they'll look after it from egg to sky.`, h.x, h.y);
  }
}

const chargeOfOther = (w: World, h: Human, not: DragonEgg | Dragon) =>
  w.dragons.owned.some((d) => d !== not && d.keeper === h.id) || w.dragons.eggs.some((e) => e !== not && e.keeper === h.id && e.at !== "nest");

/** The best free person to keep something (Auto people first, egg runners late: they carry the eggs in). */
export function pickKeeper(w: World, near: { x: number; y: number }): Human | null {
  const score = (h: Human) => {
    const r = h.role === "auto" ? h.autoRole : h.role;
    // free keepers + Auto people first; egg runners stay free to carry eggs in (they keep the ones they carry home)
    const base = r === "dragonKeeper" ? 0 : h.role === "auto" ? 100 : r === "trainer" ? 300 : r === "eggRunner" ? 600 : r === "guard" || r === "dragonSlayer" ? 900 : 500;
    return base + Math.hypot(h.x - near.x, h.y - near.y) * 0.1;
  };
  return w.humans.filter((h) => fit(h) && !keeping(w, h)).sort((a, b) => score(a) - score(b))[0] ?? null;
}

/** Every egg at home and every dragon gets a keeper (every couple of seconds). */
export function assignKeepers(w: World) {
  for (const e of w.dragons.eggs) {
    if (e.at !== "camp" || keeperOf(w, e)) continue;
    const h = pickKeeper(w, e);
    if (h) makeKeeper(w, e, h);
  }
  for (const d of w.dragons.owned) {
    if (keeperOf(w, d)) continue;
    // its rider (if it has one) is the natural keeper
    const rider = d.partner ? w.humans.find((x) => x.id === d.partner) : null;
    const h = rider && fit(rider) && !keeping(w, rider) ? rider : pickKeeper(w, d);
    if (h) makeKeeper(w, d, h);
  }
  // a dragon old + trained enough to take a rider: its keeper is the one who flies it
  for (const d of w.dragons.owned) {
    const k = keeperOf(w, d);
    if (k && fit(k) && rideable(d) && d.partner !== k.id) bondDragon(w, d, k);
  }
  // a keeper whose egg + dragon are both gone goes back to Auto
  for (const h of w.humans) if (h.role === "dragonKeeper" && !keeping(w, h)) h.role = "auto";
}

/** The egg hatched: the baby is its keeper's. */
export function keeperAtHatch(w: World, egg: DragonEgg, dr: Dragon) {
  const h = keeperOf(w, egg);
  if (!h) return;
  dr.keeper = h.id;
  dr.trainer = h.id;
  say(h, pick(w.rng, [`Hello, ${dr.name}!`, "It's here! It's mine!", "Look at those little wings!"]));
  w.toast("🐣", `${h.name} was there when ${dr.name} hatched, and the little dragon has bonded to its keeper.`, dr.x, dr.y);
}

/* ------------------------------ the keeper's day ------------------------------ */

/** A keeper looks after their egg or dragon (from roleThink). */
export function keeperThink(w: World, h: Human): boolean {
  const c = chargeOf(w, h);
  if (!c) return false;
  if (c.egg) return eggKeeper(w, h, c.egg);
  return dragonKeeper(w, h, c.dragon!);
}

function eggKeeper(w: World, h: Human, egg: DragonEgg) {
  // out by the fire / where it was put: into the incubator first (an egg runner does it if one's free)
  if (needsCarrying(w, egg) || ((h.egg || h.egg2) && carriesEgg(h, egg.id))) {
    const runner = w.humans.some((o) => o !== h && w.tribe.roleOf(o) === "eggRunner" && !o.taskId && o.state !== "down" && !o.under);
    if (!runner || claimedBy(w, egg) === h || carriesEgg(h, egg.id)) return eggCourierThink(w, h, egg);
  }
  if (egg.at !== "camp") return false;
  // keep its shelter fuelled
  const hatch = w.colony.buildings.find((b) => b.kind === "hatchery" && b.built >= 1 && Math.hypot(b.x - egg.x, b.y - egg.y) < 70);
  if (hatch && (w.dragons.fuel[hatch.id] ?? 0) < 90 && stockFuel(w)) {
    if (Math.hypot(h.x - hatch.x, h.y - hatch.y) > 30) {
      go(h, "walk", hatch.x, hatch.y + 14);
      return true;
    }
    stoke(w, hatch.id);
    say(h, "Warm enough in there?");
    return true;
  }
  // sit with it (a tended egg comes along faster)
  h.targetId = egg.id;
  if (Math.hypot(h.x - egg.x, h.y - egg.y) < 22) go(h, "dragonCare", h.x, h.y);
  else go(h, "walk", egg.x + 16, egg.y + 6);
  return true;
}

function dragonKeeper(w: World, h: Human, dr: Dragon) {
  if (dr.z > 6 || dr.cmd || h.aloft) return false;
  if (w.dragons.show) return false; // the show runs itself (shows.ts)
  const reach = 40 + 30 * dragonStats(dr).scale;
  const close = Math.hypot(h.x - dr.x, h.y - dr.y) < reach;
  // hungry or a lesson to learn: the usual dragon care (feeding comes first, then lessons)
  if (((dr.hunger ?? 0) > 0.6 || nextDragonLesson(dr)) && dr.state !== "sleep") {
    dr.trainer = h.id;
    dr.lesson = nextDragonLesson(dr);
    h.targetId = dr.id;
    if (close) go(h, "dragonCare", h.x, h.y);
    else go(h, "walk", dr.x + (h.x < dr.x ? -reach * 0.8 : reach * 0.8), dr.y + 8);
    return true;
  }
  // otherwise: playtime (and sometimes just a rest together)
  if (dr.state === "sleep" || w.daylight < 0.3) return false;
  h.targetId = dr.id;
  if (!close) {
    go(h, "walk", dr.x - 30, dr.y + 10);
    return true;
  }
  go(h, "dragonPlay", h.x, h.y);
  return true;
}

/** Per frame while playing with their dragon: a game of chase, fetch, or hide-and-hop. */
export function playTick(w: World, h: Human, dt: number) {
  const dr = ownedDragon(w, h.targetId);
  if (!dr || dr.keeper !== h.id || dr.z > 6 || dr.cmd || h.stateT > 24) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
    return;
  }
  // the keeper dashes about in little loops; the dragon bounds after them
  const a = h.stateT * 1.6 + h.id;
  const r = 30 + 20 * dragonStats(dr).scale;
  const tx = dr.x + Math.cos(a) * r;
  const ty = dr.y + Math.sin(a) * r * 0.5 + 6;
  h.dir = tx > h.x ? 1 : -1;
  h.x += (tx - h.x) * Math.min(1, dt * 2.5);
  h.y += (ty - h.y) * Math.min(1, dt * 2.5);
  h.anim += dt * 7;
  dr.state = "play";
  dr.dir = h.x > dr.x ? 1 : -1;
  if (!dr.hop) dr.hop = 0.9 + w.rng() * 0.5;
  if (w.rng() < dt * 0.25) {
    // fetch: a stick goes flying
    w.particles.spawn(P.Crumb, h.x, h.y - 14, { z: 16, vz: 120, vx: (w.rng() - 0.5) * 140, g: 260, size: 3, max: 0.9, color: "#8a6238" });
    say(h, pick(w.rng, ["Fetch!", "Catch me!", "Over here!", "Good dragon!", "Wheee!"]));
  }
  if (w.rng() < dt * 0.1) w.sfx("chirp", dr.x, dr.y, 0.4, 1.6);
  dr.hunger = Math.min(1, (dr.hunger ?? 0) + dt * 0.001);
  dr.skills = dr.skills ?? {};
  // playing builds trust (up to the full lesson)
  dr.skills.trust = Math.min(1, (dr.skills.trust ?? 0) + dt / 400);
}

/* ------------------------------ carrying eggs to the incubator ------------------------------ */

/** The incubation shelter an egg should be in (null = there isn't one). */
const shelter = (w: World) => w.colony.buildings.find((b) => b.kind === "hatchery" && b.built >= 1) ?? null;

/** An egg at home that isn't in the incubation shelter yet (dropped by the fire, placed with the Eggs tool…). */
export function needsCarrying(w: World, e: DragonEgg) {
  if ((e.at !== "camp" && e.at !== "ground") || e.hatchT > 0) return false;
  const hb = shelter(w);
  return !!hb && Math.hypot(e.x - hb.x, e.y - hb.y) > 60;
}

/** Someone else already on their way to this egg? */
const claimed = (w: World, e: DragonEgg, me: Human) => w.humans.some((o) => o !== me && o.eggFor === e.id);

/**
 * Carry loose eggs to the incubator: walk over, pick one up (two with a runner's kit), take them
 * in. Egg runners do this between raids; a keeper does it for their own egg if no runner is free.
 * Returns true while busy with it.
 */
export function eggCourierThink(w: World, h: Human, only?: DragonEgg): boolean {
  if (h.child) return false;
  // already carrying: into the shelter with them
  if (h.egg || h.egg2) {
    const home = eggDropOff(w);
    if (atEggHome(w, h)) {
      settleCarried(w, h);
      h.eggFor = undefined;
      say(h, "Safe and warm!");
      return true;
    }
    // room for one more close by? (runner's kit)
    if (eggsCarried(h) < eggCapacity(h)) {
      const more = w.dragons.eggs.find((e) => needsCarrying(w, e) && !claimed(w, e, h) && Math.hypot(e.x - h.x, e.y - h.y) < 18);
      if (more) pickEgg(w, h, more);
    }
    go(h, "walk", home.x, home.y);
    return true;
  }
  const target = only && needsCarrying(w, only) ? only : only ? null
    : w.dragons.eggs.filter((e) => needsCarrying(w, e) && !claimed(w, e, h)).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0] ?? null;
  if (!target) {
    h.eggFor = undefined;
    return false;
  }
  h.eggFor = target.id;
  if (Math.hypot(h.x - target.x, h.y - target.y) < 16) {
    pickEgg(w, h, target);
    say(h, "To the incubator!");
    return true;
  }
  go(h, "walk", target.x, target.y + 4);
  return true;
}

/* ------------------------------ incubator helpers ------------------------------ */

const stockFuel = (w: World) => w.camp.stock.coal >= 1 || w.camp.stock.wood >= 1 || w.camp.stock.stick >= 2;

/** Put fuel on an incubation shelter's fire (coal lasts longest). Returns false if there's none. */
export function stoke(w: World, hatchId: number) {
  const s = w.camp.stock;
  const add = s.coal >= 1 ? (s.coal--, 420) : s.wood >= 1 ? (s.wood--, 240) : s.stick >= 2 ? ((s.stick -= 2), 150) : 0;
  if (!add) return false;
  w.dragons.fuel[hatchId] = (w.dragons.fuel[hatchId] ?? 0) + add;
  const b = w.colony.buildings.find((x) => x.id === hatchId);
  if (b) w.particles.burst(P.Ember, b.x, b.y - 10, 6, 30, { z: 10, size: 3, max: 0.8, color: "#ffb347" });
  return true;
}

/** "Call the keeper": they drop what they're doing and come to their egg / dragon. */
export function callKeeper(w: World, thing: DragonEgg | Dragon): string | null {
  const h = keeperOf(w, thing);
  if (!h) return "It has no keeper yet.";
  if (h.state === "down" || h.under) return `${h.name} can't come right now.`;
  h.order = null;
  h.think = 0;
  h.targetId = thing.id;
  go(h, "walk", thing.x + 16, thing.y + 6);
  say(h, "On my way!");
  return null;
}
