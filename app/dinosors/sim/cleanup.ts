/* ------------------------------------------------------------------ */
/*  Keeping the town clean (a priority job).                           */
/*                                                                     */
/*  Anything dead lying inside our borders gets dealt with first:      */
/*  dinosaur bodies are cut up (meat, hide, teeth and every last       */
/*  bone carried to the stores) and loose bones + meat lying about     */
/*  are picked up. Everyone free pitches in (not the guards on watch   */
/*  or the dragon keepers), a few to a body, and the rest carry on     */
/*  with their own work.                                               */
/* ------------------------------------------------------------------ */
import { harvesters, hasYield } from "./carcass";
import { inTown } from "./feast";
import { go } from "./humans";
import { butcherThink } from "./tasks";
import type { Human, Item, Resource } from "./types";
import type { World } from "./world";

/** How far past the town's edge still counts as "ours" to clean. */
export const CLEAN_PAD = 150;

/** Roles that stay at their posts instead. */
const STAY = new Set(["guard", "dragonKeeper"]);

/** Somebody free to help clean up. */
function free(w: World, h: Human) {
  return !h.child && !h.stranger && !h.captive && !h.under && !h.riding && !h.aloft && !h.chariot && !h.catapult && !h.taskId && !h.order && h.state !== "down" && h.state !== "sleep" && h.hp > 0.35 && !STAY.has(w.tribe.roleOf(h));
}

const unsafe = (w: World, x: number, y: number) => w.dinos.some((d) => w.tribe.hostile(w, d) && Math.hypot(d.x - x, d.y - y) < 220);

/** A dinosaur body in town that still has something to take (and isn't being roasted or eaten right now). */
export function messyBody(w: World, it: Item) {
  if (!it.carcass || !hasYield(it) || it.draggedBy) return false;
  if (!inTown(w, it.x, it.y, CLEAN_PAD)) return false;
  if (it.claimed && w.dinoById(it.claimed)) return false;
  if (w.dragons.owned.some((d) => d.cook === it.id && (d.cookT ?? 0) > 0)) return false;
  return !unsafe(w, it.x, it.y);
}

/** Loose bones / meat lying in town. */
export function looseMess(w: World, it: Item) {
  return (it.kind === "bones" || it.kind === "meat") && it.z <= 2 && !it.draggedBy && !it.claimed && inTown(w, it.x, it.y, CLEAN_PAD) && !unsafe(w, it.x, it.y);
}

/** Everything still to clear up in town. */
export function townMess(w: World) {
  return w.items.filter((it) => messyBody(w, it) || looseMess(w, it));
}

/** How many people may be on clean-up at once (so the camp's other work doesn't stop). */
function crewCap(w: World) {
  const adults = w.humans.filter((h) => !h.child && !h.stranger && !h.captive).length;
  return Math.max(2, Math.ceil(adults * 0.45));
}

/** A free person helps clear up the town. True = they're on it. */
export function cleanupThink(w: World, h: Human): boolean {
  // already carrying something from it: off to the stores (the carry state drops it)
  if (h.cleaning && h.carry) {
    if (h.state !== "carry") {
      const drop = w.colony.dropOff(w, h.x, h.y, h.carry);
      go(h, "carry", drop.x, drop.y);
    }
    return true;
  }
  if (!free(w, h)) {
    h.cleaning = false;
    return false;
  }
  if (h.carry && !h.cleaning) return false;
  const mess = townMess(w);
  if (!mess.length) {
    h.cleaning = false;
    return false;
  }
  const busy = w.humans.filter((o) => o !== h && o.cleaning && !o.taskId && !o.order).length;
  if (!h.cleaning && busy >= crewCap(w)) return false;
  // the nearest job with room for another pair of hands
  let best: Item | null = null;
  let bd = Infinity;
  for (const it of mess) {
    if (it.carcass) {
      const room = Math.min(4, 1 + Math.floor(it.carcass.size / 50));
      if (harvesters(w, it) >= room && h.targetId !== -it.id) continue;
    } else if (w.humans.some((o) => o !== h && o.targetId === it.id && o.cleaning)) continue;
    const d = Math.hypot(it.x - h.x, it.y - h.y);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  if (!best) return false;
  if (!h.cleaning) {
    h.cleaning = true;
    if (!w.flags.has("townCleanup")) {
      w.flags.add("townCleanup");
      w.toast("🧹", "Keeping the town clean comes first: free hands cut up any dead animal inside our borders and carry the meat, hide and bones to the stores.", best.x, best.y);
    }
  }
  if (best.carcass) return butcherThink(w, h, best);
  return pickUp(w, h, best);
}

/** Walk over to a loose bone / bit of meat, pick it up and take it to the stores. */
function pickUp(w: World, h: Human, it: Item) {
  h.targetId = it.id;
  if (Math.hypot(h.x - it.x, h.y - it.y) > 14) {
    go(h, "walk", it.x, it.y + 2);
    return true;
  }
  const r: Resource = it.kind === "bones" ? "bone" : "meat";
  const n = Math.max(1, Math.round(it.amount * 2));
  w.removeItem(it);
  h.carry = r;
  h.carryN = n;
  h.targetId = 0;
  w.sfx(r === "bone" ? "clack" : "chop", h.x, h.y, 0.4);
  const drop = w.colony.dropOff(w, h.x, h.y, r);
  go(h, "carry", drop.x, drop.y);
  return true;
}
