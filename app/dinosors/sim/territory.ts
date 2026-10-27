/* ------------------------------------------------------------------ */
/*  Our territory, and keeping it ours.                                */
/*                                                                     */
/*  The settlement's ground is the camp's working area, everything     */
/*  inside our walls, plus a margin round everything we've built       */
/*  (settlement.ts footprint), so it grows as the camp does.           */
/*                                                                     */
/*  Every grown-up carries a sidearm: a shock stick or a ray gun (a    */
/*  mix of both; each runs on its own crystal cell). With it they      */
/*  stand and fight instead of running (only a dragon still sends     */
/*  them for cover): hostile people are fought off as usual, but wild  */
/*  animals (not ours, not a friendly people's) are repelled, not      */
/*  killed: a jolt and they bolt for the edge of the settlement and    */
/*  out. Free hands nearby see strays off by themselves; a group sent  */
/*  on a ⚡ Sweep goes after every stray in the settlement until it's  */
/*  clear.                                                             */
/* ------------------------------------------------------------------ */
import { WEAPON_BY_ID } from "../data/colony";
import { CAMP_LEVELS } from "../data/facts";
import { sp } from "../data/species";
import { setState } from "./dinos";
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { distToCamp } from "./settlement";
import type { Dino, Human } from "./types";
import type { World } from "./world";

/** Past our walls, this close to anything we've built is still ours (px). */
export const TERRITORY_PAD = 140;
/** A free person sees off strays this close (px); people on a sweep go any distance. */
const SEE_OFF_R = 650;
/** At most this many people on one stray. */
const PER_STRAY = 2;
/** The two sidearms. */
export const SIDEARMS = ["shockStick", "rayGun"] as const;

/** Is (x, y) our ground? The camp's own working area, inside the walls, or near anything we've built. */
export function inTerritory(w: World, x: number, y: number) {
  if (Math.hypot(x - w.camp.x, y - w.camp.y) < CAMP_LEVELS[w.tribe.level].radius) return true;
  return distToCamp(w, x, y) < TERRITORY_PAD || w.tribe.enclosed(w, x, y);
}

/** A wild animal that doesn't belong here: not ours, not a friendly people's, not working for us. */
export function isStray(d: Dino) {
  if (d.owner || d.seaTribe || d.chariot || d.ward || d.under || d.health <= 0) return false;
  if (d.tame >= 0.3) return false; // being befriended
  if (d.state === "carried" || d.state === "faint") return false;
  return sp(d.species).move === "walk";
}

/** Someone is taming it or hunting it on purpose: leave it to them. */
function spoken(w: World, d: Dino) {
  return w.humans.some((h) => h.targetId === d.id && !h.repelId && (h.state === "tame" || h.order?.kind === "hunt" || w.tasks.get(h.taskId)?.kind === "hunt" || w.tasks.get(h.taskId)?.kind === "tame"));
}

/** Strays standing on our ground right now (not one somebody's taming or hunting). */
export function straysIn(w: World) {
  return w.dinos.filter((d) => isStray(d) && inTerritory(w, d.x, d.y) && !spoken(w, d));
}

/** Should this shot drive the animal out rather than hurt it? A sidearm (or someone seeing it off) on our ground; a hunt still hunts. */
export function repelsHere(w: World, h: Human, d: Dino, sidearm = false) {
  if (!isStray(d) || !inTerritory(w, d.x, d.y)) return false;
  const task = w.tasks.get(h.taskId);
  if (h.order?.kind === "hunt" || task?.kind === "hunt") return false;
  return sidearm || h.repelId === d.id;
}

/** The way out: straight away from the middle of the camp, to just past the edge of our ground. */
export function exitPoint(w: World, d: { x: number; y: number }) {
  const a = Math.atan2(d.y - w.camp.y, d.x - w.camp.x);
  let x = d.x;
  let y = d.y;
  for (let k = 0; k < 60 && inTerritory(w, x, y); k++) {
    x += Math.cos(a) * 48;
    y += Math.sin(a) * 48;
  }
  return { x: x + Math.cos(a) * 220, y: y + Math.sin(a) * 220 };
}

/** A jolt from a shock stick or a ray gun: it hurts a little (never lethal) and the animal bolts for the edge. */
export function repelHit(w: World, d: Dino, fx: number, fy: number) {
  d.health = Math.max(Math.min(d.health, 0.3), d.health - 0.04);
  d.fear = 1;
  d.raider = false;
  d.targetId = 0;
  d.shooed = w.elapsed + 25;
  const out = exitPoint(w, d);
  setState(d, "flee", out.x, out.y);
  w.particles.burst(P.Spark, d.x, d.y - 14, 8, 70, { z: 16, vz: 60, g: 180, size: 2.2, max: 0.45, color: w.rng() < 0.5 ? "#9ef0ff" : "#ffffff" });
  if (w.rng() < 0.4) w.sfx("zap", d.x, d.y, 0.5);
  void fx;
  void fy;
  if (!w.flags.has("repelTip")) {
    w.flags.add("repelTip");
    w.toast("⚡", "Shock sticks + ray guns drive wild animals out of the settlement: they're chased off our ground, not killed. Hostile people are fought off.", d.x, d.y);
  }
}

/** A driven-out animal keeps running for the edge till it's off our ground (from the dino brain). True = it's on it. */
export function shooedThink(w: World, d: Dino) {
  if (!d.shooed) return false;
  if (w.elapsed > d.shooed || !inTerritory(w, d.x, d.y)) {
    d.shooed = undefined;
    return false;
  }
  const out = exitPoint(w, d);
  setState(d, "flee", out.x, out.y);
  d.fear = 1;
  return true;
}

/** Everyone's sidearm: pick one up from the armory, keeping the tribe's mix of shock sticks + ray guns even. */
export function carrySidearm(w: World, h: Human) {
  if (h.child || h.stranger || h.gear.sidearm) return;
  const armory = w.colony.armory;
  const carried = (id: string) => w.humans.filter((o) => o.gear.sidearm === id).length;
  const [a, b] = SIDEARMS;
  const order = carried(a) <= carried(b) ? [a, b] : [b, a];
  const id = order.find((k) => (armory[k] ?? 0) > 0);
  if (!id) return;
  armory[id]--;
  h.gear.sidearm = id;
  h.bubble = { text: id === "rayGun" ? "Pew pew!" : "Bzzzt!", t: 1.6 };
}

/** The sidearm the auto smith should make next (the scarcer of the two), or null once everyone has one. */
export function sidearmWanted(w: World, people: Human[]): string | null {
  const owned = (id: string) => (w.colony.armory[id] ?? 0) + people.filter((h) => h.gear.sidearm === id).length;
  const total = SIDEARMS.reduce((n, id) => n + owned(id), 0);
  if (total >= people.filter((h) => !h.child).length) return null;
  return owned(SIDEARMS[0]) <= owned(SIDEARMS[1]) ? SIDEARMS[0] : SIDEARMS[1];
}

/** Can this person go and see a stray off? */
function canSeeOff(w: World, h: Human) {
  if (h.child || h.stranger || h.captive || h.under || h.aloft || h.riding || h.level !== 0 || h.hp < 0.5) return false;
  if (h.state === "down" || h.state === "sleep" || h.state === "operate" || h.state === "hide") return false;
  // free hands see strays off with their sidearm; a sweep goes with whatever they're armed with
  if (h.sweep) return !!w.tribe.weaponFor(w, h);
  return !!h.gear.sidearm && !h.taskId && !h.order && !h.clearJob;
}

/** Their part in it (from think): chase the stray they're seeing off. True = busy with it. */
export function repelThink(w: World, h: Human) {
  if (!h.repelId) return false;
  const d = w.dinoById(h.repelId);
  if (!d || !isStray(d) || !inTerritory(w, d.x, d.y) || !canSeeOff(w, h)) {
    h.repelId = undefined;
    if (h.state === "hunt" || h.state === "aim") go(h, "idle", h.x, h.y);
    return false;
  }
  if (h.state !== "hunt" && h.state !== "aim") {
    h.targetId = d.id;
    go(h, "hunt", d.x, d.y);
    if (w.rng() < 0.3) say(h, pick(w.rng, ["Off our land!", "Shoo!", "Go on, get out!", "Out you go!"]));
  }
  return true;
}

/**
 * Once a second: every stray on our ground gets someone to see it off (people on a sweep first, then the
 * nearest free hands with a weapon). When a sweep has nothing left to chase, it's over.
 */
export function territoryTick(w: World) {
  const strays = straysIn(w);
  const sweepers = w.humans.filter((h) => h.sweep);
  if (!strays.length) {
    if (sweepers.length) {
      for (const h of sweepers) {
        h.sweep = false;
        h.repelId = undefined;
        h.think = 0;
      }
      w.toast("✅", "The settlement is clear: every stray animal has been driven off our ground.", w.camp.x, w.camp.y);
    }
    return;
  }
  const on = new Map<number, number>();
  for (const h of w.humans) if (h.repelId) on.set(h.repelId, (on.get(h.repelId) ?? 0) + 1);
  for (const d of strays) {
    if ((on.get(d.id) ?? 0) >= PER_STRAY) continue;
    let best: Human | null = null;
    let bs = Infinity;
    for (const h of w.humans) {
      if (h.repelId || !canSeeOff(w, h)) continue;
      const dist = Math.hypot(h.x - d.x, h.y - d.y);
      if (!h.sweep && dist > SEE_OFF_R) continue;
      const s = dist - (h.sweep ? 5000 : 0);
      if (s < bs) {
        bs = s;
        best = h;
      }
    }
    if (!best) continue;
    best.repelId = d.id;
    best.think = 0;
    on.set(d.id, (on.get(d.id) ?? 0) + 1);
  }
}

/** Send these people on a sweep: they drive every stray out of the settlement. Returns how many strays there are. */
export function startSweep(w: World, people: Human[]) {
  const strays = straysIn(w).length;
  for (const h of people) {
    if (h.child || h.stranger) continue;
    const t = w.tasks.get(h.taskId);
    if (t) t.people = t.people.filter((id) => id !== h.id);
    h.taskId = 0;
    h.order = null;
    h.sweep = true;
    h.think = 0;
  }
  return strays;
}

/** Is this the sidearm kind of weapon? */
export const isSidearm = (id: string | null | undefined) => !!id && !!WEAPON_BY_ID[id]?.sidearm;
