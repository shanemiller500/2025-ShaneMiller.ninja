/* ------------------------------------------------------------------ */
/*  The zoo: an iron-barred enclosure for one captured great beast.    */
/*                                                                     */
/*  A capture party (chariots.ts, `hunt.capture`) wears a Yeti or a    */
/*  Dinosaur Scorpion down instead of killing it; at a third of its    */
/*  strength the nets go over it. Bound, it's hauled home behind the   */
/*  party and put in a free enclosure. There it paces, roars at        */
/*  whoever comes to stare, and has to be fed: meat from the stores    */
/*  every so often. Miss two meals and it breaks the bars and is gone. */
/*                                                                     */
/*  A caged beast is `owner` (nothing treats it as a threat, nobody    */
/*  hunts it) with `caged` = its enclosure; its own brain is replaced  */
/*  by zooThink / zooAct. Visiting caravans marvel at it (diplomacy).  */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { emote, setState } from "./dinos";
import { say } from "./humans";
import { P } from "./particles";
import { addDread, beastName, isBigGame } from "./beasts";
import { TILE, type Building, type Dino, type DragonHunt, type Human, type Resource } from "./types";
import type { World } from "./world";

/** Netted once it's worn down to this much health. */
export const CAPTURE_AT = 0.3;
/** Seconds between meals, and what a meal is. */
export const FEED_EVERY = 300;
export const MEAL = 2;
const MEAL_FOODS: Resource[] = ["meat", "fish", "cooked"];
/** Meals it can miss before it breaks out. */
const MISSED_MAX = 2;
/** The kit a capture needs (data/colony KITS). */
export const NETS_KIT = "beastNets";

const finished = (b: Building) => b.kind === "zoo" && b.built >= 1 && b.hp > 0;

export function zoos(w: World) {
  return w.colony.buildings.filter(finished);
}
/** The beast in that enclosure. */
export function beastIn(w: World, b: Building) {
  return w.dinos.find((d) => d.caged === b.id) ?? null;
}
export function zooBeasts(w: World) {
  return w.dinos.filter((d) => !!d.caged);
}
/** An enclosure with nothing in it (nearest to the camp first). */
export function freeZoo(w: World): Building | null {
  return zoos(w).filter((b) => !beastIn(w, b)).sort((a, b) => Math.hypot(a.x - w.camp.x, a.y - w.camp.y) - Math.hypot(b.x - w.camp.x, b.y - w.camp.y))[0] ?? null;
}
/** Why a capture can't be tried right now (null = it can). */
export function captureBlock(w: World): string | null {
  if (!w.colony.kits.has(NETS_KIT)) return "make capture nets at the blacksmith first";
  if (!zoos(w).length) return "build a zoo enclosure first";
  if (!freeZoo(w)) return "every zoo enclosure is full: build another";
  return null;
}

/** The inside of an enclosure (px), and its middle. */
export function pen(b: Building) {
  const def = BUILDINGS.zoo;
  const x0 = b.tx * TILE + 16;
  const x1 = (b.tx + def.w) * TILE - 16;
  const y0 = b.ty * TILE + 22;
  const y1 = (b.ty + def.h) * TILE - 22;
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/* ------------------------------ the capture ------------------------------ */

/** The nets go over it: bound and helpless, nothing more can hurt it. */
export function netBeast(w: World, d: Dino) {
  if (d.netted) return;
  d.netted = true;
  d.health = Math.max(d.health, CAPTURE_AT);
  d.targetId = 0;
  d.fear = 0;
  d.vx = d.vy = 0;
  // (a Yeti carrying someone drops them)
  if (d.holding) {
    const h = w.humans.find((x) => x.id === d.holding);
    if (h) {
      h.yetiHeld = undefined;
      h.z = 0;
      h.think = 0;
    }
    d.holding = undefined;
  }
  setState(d, "carried", d.x, d.y);
  emote(d, "🕸️", 3);
  w.sfx("thud", d.x, d.y, 1, 0.7);
  w.particles.burst(P.Dust, d.x, d.y, 12, 70, { size: 10, max: 0.9, color: "rgba(220,210,190,0.7)" });
  w.particles.burst(P.Star, d.x, d.y, 4, 40, { z: 20, size: 6, max: 1 });
}

/**
 * A blow landed on the beast a capture party is after (from tribe.hitDino, before it can die of it):
 * worn down far enough, it's netted instead. True = netted (the blow does nothing more).
 */
export function captureHit(w: World, d: Dino): boolean {
  const hunt = w.colony.hunt;
  if (!hunt?.capture || hunt.beast !== d.id || hunt.phase !== "battle" || d.netted) return false;
  if (d.health > CAPTURE_AT) return false;
  netBeast(w, d);
  return true;
}

/** Hauling it home: the bound beast is dragged along behind whoever leads the party (or the first chariot). */
export function haulTick(w: World, hunt: DragonHunt, dt: number) {
  const d = hunt.beast ? w.dinoById(hunt.beast) : null;
  if (!d || !d.netted) {
    hunt.haul = false;
    return;
  }
  const car = w.colony.chariots.find((c) => hunt.crew.some((m) => m.chariot === c.id));
  const walker = hunt.crew.map((m) => w.humans.find((h) => h.id === m.id)).find((h): h is Human => !!h && !h.chariot && !h.aloft && h.state !== "down");
  const lead = car ?? walker;
  if (!lead) {
    // nobody left to haul it: it tears free and makes for home
    freeBeast(w, d, "tore out of the nets");
    hunt.haul = false;
    return;
  }
  if (d.state !== "carried") setState(d, "carried", d.x, d.y);
  const gap = Math.hypot(lead.x - d.x, lead.y - d.y);
  const want = car ? 96 : 46;
  if (gap > want) {
    const k = Math.min(1, ((gap - want) * 3 * dt + 70 * dt) / gap);
    d.x += (lead.x - d.x) * k;
    d.y += (lead.y - d.y) * k;
    d.dir = lead.x > d.x ? 1 : -1;
    d.anim += dt * 4;
    if ((Math.floor(w.elapsed * 3) + d.id) % 4 === 0) w.particles.spawn(P.Dust, d.x, d.y, { size: 6, max: 0.5, color: "rgba(200,185,160,0.5)" });
  }
}

/** Out of the nets (the haul failed): wild again where it stands. */
function freeBeast(w: World, d: Dino, how: string) {
  d.netted = false;
  d.health = Math.max(d.health, 0.5);
  setState(d, "idle", d.x, d.y);
  d.think = 0;
  w.toast("💥", `The ${beastName(d)} ${how}! It's loose again.`, d.x, d.y);
}

/** Home with it: into a free enclosure (or, with none free any more, it gets away). */
export function finishHaul(w: World, hunt: DragonHunt) {
  const d = hunt.beast ? w.dinoById(hunt.beast) : null;
  hunt.haul = false;
  if (!d || !d.netted) return;
  const b = freeZoo(w);
  if (!b) return freeBeast(w, d, "broke loose at the gate (there was no free enclosure for it)");
  cageBeast(w, d, b);
}

/** Into the enclosure. */
export function cageBeast(w: World, d: Dino, b: Building) {
  const p = pen(b);
  d.netted = false;
  d.caged = b.id;
  d.owner = true;
  d.raider = false;
  d.migrant = false;
  d.targetId = 0;
  d.holding = undefined;
  d.yetiPack = undefined;
  d.herd = 0;
  d.fear = 0;
  d.health = Math.max(d.health, 0.6);
  d.hunger = 0.2;
  d.thirst = 0.2;
  d.x = d.homeX = p.cx;
  d.y = d.homeY = p.cy;
  d.z = 0;
  d.vx = d.vy = 0;
  setState(d, "idle", d.x, d.y);
  meals.set(d, { at: w.elapsed, missed: 0 });
  addDread(w, -1);
  w.particles.burst(P.Poof, d.x, d.y, 12, 60, { size: 12, max: 0.9, color: "rgba(235,228,210,0.9)" });
  w.sfx("thud", d.x, d.y, 1, 0.6);
  w.discover("zoo", b.x, b.y);
  w.celebrate(d.species === "yeti" ? "We caught the Yeti!" : "We caught it!");
  w.toast("🎪", `The ${beastName(d)} is in the zoo! It's bound to this enclosure now: it can't hurt anyone, and nobody's afraid of it any more. Keep meat (or fish) in the stores: it eats ${MEAL} every so often, and a starving beast breaks out. Caravans that visit will marvel at it.`, b.x, b.y);
}

/* ------------------------------ life in the enclosure ------------------------------ */

const meals = new WeakMap<Dino, { at: number; missed: number }>();
const pace = new WeakMap<Dino, number>();
const ticks = new WeakMap<World, number>();

/** Its brain while caged (from thinkDino). Always decides. */
export function zooThink(w: World, d: Dino): boolean {
  if (!d.caged) return false;
  const b = w.colony.buildings.find((x) => x.id === d.caged);
  if (!b || !finished(b)) {
    // the enclosure is gone (torn down, burnt, smashed): the beast is out
    breakOut(w, d, b && b.kind === "zoo" ? "smashed its way out of the broken enclosure" : "is loose: its enclosure is gone");
    return true;
  }
  if (d.state === "roar" && d.stateT < 1.2) return true;
  if (w.daylight < 0.2) {
    if (d.state !== "sleep") setState(d, "sleep", d.x, d.y);
    return true;
  }
  const p = pen(b);
  // someone at the bars: a roar for them, now and then
  const watcher = w.humans.find((h) => !h.under && h.state !== "sleep" && Math.abs(h.x - p.cx) < (p.x1 - p.x0) / 2 + 60 && Math.abs(h.y - p.cy) < (p.y1 - p.y0) / 2 + 70);
  const beat = Math.floor(w.elapsed / 9) + d.id;
  if (watcher && pace.get(d) !== -beat && beat % 3 === 0) {
    pace.set(d, -beat);
    setState(d, "roar", d.x, d.y);
    d.dir = watcher.x > d.x ? 1 : -1;
    w.sfx("roar", d.x, d.y, 0.8, d.species === "yeti" ? 0.4 : 0.6);
    emote(d, "😤", 1.4);
    say(watcher, watcher.child ? ["Eek!", "It looked at me!", "Do it again!"][(watcher.id + beat) % 3] : ["Whoa!", "Look at the size of it!", "Glad there are bars."][(watcher.id + beat) % 3]);
    return true;
  }
  // pacing: from one end to the other, with a rest in between
  if (d.state === "wander" && Math.hypot(d.tx - d.x, d.ty - d.y) > 6 && d.stateT < 12) return true;
  if (d.state === "idle" && d.stateT < 2 + (d.id % 3)) return true;
  const n = ((pace.get(d) ?? 0) < 0 ? 0 : pace.get(d) ?? 0) + 1;
  pace.set(d, n);
  const fx = ((n * 7 + d.id) % 10) / 9;
  const fy = ((n * 3 + d.id) % 7) / 6;
  setState(d, n % 3 === 0 ? "idle" : "wander", p.x0 + (p.x1 - p.x0) * fx, p.y0 + (p.y1 - p.y0) * fy);
  return true;
}

/** Its body while caged (from actDino): it walks its pen and never leaves it. True = handled. */
export function zooAct(w: World, d: Dino, dt: number): boolean {
  if (!d.caged) return false;
  const b = w.colony.buildings.find((x) => x.id === d.caged);
  if (!b) return false;
  const p = pen(b);
  const meal = meals.get(d);
  d.hunger = meal && meal.missed ? 0.75 : 0.2;
  d.thirst = 0.2;
  d.fear = 0;
  d.strike = Math.max(0, (d.strike ?? 0) - dt * 1.6);
  if (d.state === "wander") {
    const dx = d.tx - d.x;
    const dy = d.ty - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) setState(d, "idle", d.x, d.y);
    else {
      const v = 26;
      d.vx = (dx / dist) * v;
      d.vy = (dy / dist) * v;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.dir = dx > 0 ? 1 : -1;
      d.anim += dt * 3;
    }
  } else {
    d.vx = d.vy = 0;
    if (d.state === "roar") d.strike = Math.max(d.strike ?? 0, 0.6);
  }
  d.x = Math.max(p.x0, Math.min(p.x1, d.x));
  d.y = Math.max(p.y0, Math.min(p.y1, d.y));
  d.z = 0;
  return true;
}

/** It gets out and is gone (back to the wild, out of sight: the peaks and the desert restock themselves). */
function breakOut(w: World, d: Dino, how: string) {
  const b = w.colony.buildings.find((x) => x.id === d.caged);
  if (b) b.hp = Math.max(1, b.hp - BUILDINGS.zoo.hp * 0.5);
  w.particles.burst(P.Dust, d.x, d.y, 16, 90, { size: 12, max: 1, color: "rgba(210,200,180,0.8)" });
  w.particles.burst(P.Rock, d.x, d.y, 8, 80, { z: 10, vz: 60, g: 200, size: 5, max: 0.8, color: "#6d6f76" });
  w.sfx("roar", d.x, d.y, 1.3, d.species === "yeti" ? 0.35 : 0.5);
  w.alarm(d.x, d.y, 500, 0.8, "😱", false);
  addDread(w, 0.5);
  w.toast("💥", `The ${beastName(d)} ${how}, and bounded off into the wild! The enclosure needs repairing.`, d.x, d.y);
  d.caged = undefined;
  w.removeDino(d);
}

/** Once a second: meals, and beasts whose enclosure has gone. */
export function zooTick(w: World) {
  if (Math.abs(w.elapsed - (ticks.get(w) ?? -9)) < 1) return;
  ticks.set(w, w.elapsed);
  for (const d of zooBeasts(w)) {
    if (!isBigGame(d)) continue;
    let meal = meals.get(d);
    if (!meal) meals.set(d, (meal = { at: w.elapsed, missed: 0 }));
    if (w.elapsed - meal.at < FEED_EVERY) continue;
    meal.at = w.elapsed;
    const food = MEAL_FOODS.find((r) => w.camp.stock[r] >= MEAL);
    if (food) {
      w.camp.stock[food] -= MEAL;
      meal.missed = 0;
      emote(d, "🍖", 2);
      continue;
    }
    meal.missed++;
    if (meal.missed > MISSED_MAX) {
      breakOut(w, d, "was starving, broke the bars");
      continue;
    }
    emote(d, "😡", 2.5);
    w.toast("🍖", `The ${beastName(d)} in the zoo has nothing to eat (it needs ${MEAL} meat or fish a meal). It's getting angry: ${MISSED_MAX + 1 - meal.missed} more missed meal${MISSED_MAX + 1 - meal.missed === 1 ? "" : "s"} and it breaks out.`, d.x, d.y);
  }
}

/** For the enclosure's card. */
export function zooView(w: World, b: Building) {
  const d = beastIn(w, b);
  const meal = d ? meals.get(d) : null;
  return {
    beast: d ? { id: d.id, name: beastName(d), emoji: d.species === "yeti" ? "❄️" : "🦂", health: d.health, hungry: !!meal?.missed, nextMeal: meal ? Math.max(0, Math.round(FEED_EVERY - (w.elapsed - meal.at))) : FEED_EVERY } : null,
    nets: w.colony.kits.has(NETS_KIT),
    meal: MEAL,
  };
}
