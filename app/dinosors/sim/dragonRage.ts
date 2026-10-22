/* ------------------------------------------------------------------ */
/*  Wild dragons fight back (fantasy!).                                */
/*                                                                     */
/*  Attack a wild dragon and it doesn't just take it: it turns on      */
/*  whoever's attacking it (a person, a war chariot or one of our      */
/*  dragons), hunting them down with fire, then goes back to what it   */
/*  was doing. Hurt its young and the parent flies in to defend them.  */
/*                                                                     */
/*  Rage: kill a dragon's young and its rage grows (up to 3). Every    */
/*  level makes it much harder to hurt, its fire fiercer, its body     */
/*  bigger, and it fights on far longer before it gives up. Left alone */
/*  a long while, the rage slowly cools.                               */
/* ------------------------------------------------------------------ */
import { newDragonStats } from "./dragonKeep";
import { P } from "./particles";
import type { Dragon } from "./types";
import type { World } from "./world";

/** Most rage a dragon can build up. */
export const MAX_RAGE = 3;
/** It turns on attackers this close. */
export const FIGHT_R = 760;
/** How long it keeps after one foe (s). */
const RETALIATE_FOR = 30;
/** Calm this long (s) and one level of rage cools. */
const COOL_AFTER = 600;

/** What it might be doing when it's attacked "out of nowhere". */
const PEACEFUL = new Set(["perch", "home", "fetch", "eat", "land", "retaliate"]);

type Foe = { kind: "human" | "chariot" | "dragon"; id: number; x: number; y: number; z: number };

/** The hp share at which it gives up and flies off to heal (rage keeps it fighting longer). */
export function giveUpAt(dr: Dragon) {
  if (dr.fury) return 0.12;
  return Math.max(0.08, 0.35 - (dr.rage ?? 0) * 0.09);
}

/** Who's attacking it: the nearest of our people with a weapon, war chariots and our dragons. */
export function attackerOf(w: World, dr: Dragon, r = FIGHT_R): Foe | null {
  let best: Foe | null = null;
  let bd = r;
  const take = (f: Foe, bias = 1) => {
    const d = Math.hypot(f.x - dr.x, f.y - dr.y) * bias;
    if (d < bd) {
      bd = d;
      best = f;
    }
  };
  for (const o of w.dragons.owned) if (o.hp > 0) take({ kind: "dragon", id: o.id, x: o.x, y: o.y, z: o.z }, 0.8);
  for (const c of w.colony.chariots) if (c.hp > 0) take({ kind: "chariot", id: c.id, x: c.x, y: c.y, z: 0 }, 0.9);
  for (const h of w.humans) {
    if (h.child || h.under || h.captive || h.chariot || h.aloft || h.state === "down" || h.stranger) continue;
    if (!w.tribe.weaponFor(w, h) && w.tribe.roleOf(h) !== "dragonSlayer") continue;
    take({ kind: "human", id: h.id, x: h.x, y: h.y, z: 0 });
  }
  return best;
}

/** Where its foe is now (null: gone / down / out of reach). */
function foeNow(w: World, dr: Dragon): Foe | null {
  const id = dr.foe ?? 0;
  if (dr.foeKind === "dragon") {
    const o = w.dragons.owned.find((x) => x.id === id && x.hp > 0);
    return o ? { kind: "dragon", id, x: o.x, y: o.y, z: o.z } : null;
  }
  if (dr.foeKind === "chariot") {
    const c = w.colony.chariots.find((x) => x.id === id && x.hp > 0);
    return c ? { kind: "chariot", id, x: c.x, y: c.y, z: 0 } : null;
  }
  const h = w.humans.find((x) => x.id === id);
  if (!h || h.state === "down" || h.under || h.captive) return null;
  // up on one of our dragons: go for the dragon it's riding
  if (h.aloft) {
    const o = w.dragons.owned.find((x) => x.id === h.aloft);
    return o ? { kind: "dragon", id: o.id, x: o.x, y: o.y, z: o.z } : null;
  }
  return { kind: "human", id, x: h.x, y: h.y, z: 0 };
}

/** It was hit: turn on the attacker (and a parent comes to defend its young). True if it's now fighting back. */
export function fightBack(w: World, dr: Dragon): boolean {
  if (dr.owner || dr.hp <= 0) return false;
  // only a dragon minding its own business turns on its attackers: one that's already attacking (raiding the town,
  // chasing a thief, defending its nest, snatching someone) keeps at it, and one fleeing to heal keeps going
  const busy = !PEACEFUL.has(dr.state) || (dr.state === "home" && dr.hp < dr.maxHp * giveUpAt(dr) * 1.3);
  // a youngster under attack: its parent comes to defend it
  if (dr.young && dr.nest) {
    const nest = w.dragons.nests.find((n) => n.id === dr.nest);
    const parent = nest ? w.dragons.list.find((d) => d.id === nest.parent && d.hp > 0) : null;
    if (parent && parent.state !== "retaliate" && parent.hp > parent.maxHp * giveUpAt(parent)) {
      const foe = attackerOf(w, dr);
      if (foe) {
        turnOn(w, parent, foe);
        if (!w.flags.has(`defendYoung${parent.id}`)) {
          w.flags.add(`defendYoung${parent.id}`);
          w.toast("🐉", `${parent.name} sees its young ${dr.name} attacked and dives in to defend it!`, parent.x, parent.y);
        }
      }
    }
    if ((dr.growth ?? 0) < 0.3) return false;
  }
  if (busy) return false;
  if (dr.state === "retaliate" && foeNow(w, dr)) return true;
  const foe = attackerOf(w, dr);
  if (!foe) return false;
  turnOn(w, dr, foe);
  if (!w.flags.has(`fightBack${dr.id}`)) {
    w.flags.add(`fightBack${dr.id}`);
    w.toast("🐉", `${dr.name} won't just take it: it turns on its attackers and fights back!`, dr.x, dr.y);
  }
  return true;
}

function turnOn(w: World, dr: Dragon, foe: Foe) {
  if (dr.prey) return;
  dr.foe = foe.id;
  dr.foeKind = foe.kind;
  dr.state = "retaliate";
  dr.t = 0;
  w.sfx("screech", dr.x, dr.y, 1.1, 0.5 - (dr.rage ?? 0) * 0.05);
}

/**
 * Fighting back: after its foe, fire when it's close (a new foe if that one's down). True when it's done
 * (the foe's gone, it's been long enough, or it's strayed too far from home).
 */
export function retaliateStep(w: World, dr: Dragon, dt: number, fly: (x: number, y: number, speed: number, z: number) => number, breathe: () => void): boolean {
  let foe = foeNow(w, dr);
  if (!foe) {
    const next = attackerOf(w, dr, 520);
    if (next && dr.t < RETALIATE_FOR) {
      dr.foe = next.id;
      dr.foeKind = next.kind;
      foe = next;
    }
  }
  const nest = dr.nest ? w.dragons.nests.find((n) => n.id === dr.nest) : null;
  if (!foe || dr.t > RETALIATE_FOR + (dr.rage ?? 0) * 10 || (nest && Math.hypot(dr.x - nest.x, dr.y - nest.y) > 1500)) {
    dr.foe = undefined;
    dr.foeKind = undefined;
    return true;
  }
  const rage = dr.rage ?? 0;
  const d = Math.hypot(foe.x - dr.x, foe.y - dr.y);
  const tz = foe.kind === "dragon" && foe.z > 20 ? foe.z + 30 : d < 260 ? 70 : 150;
  fly(foe.x, foe.y, 300 + rage * 40, tz);
  // fire in blasts (longer, the angrier it is), with a breath between: a well-armed band gets its chances
  if (d < 210 + rage * 20 && dr.t % 4 < 1 + rage * 0.6) breathe();
  return false;
}

/** One of its young was killed: the parent's rage grows. */
export function youngLost(w: World, young: Dragon) {
  const nest = young.nest ? w.dragons.nests.find((n) => n.id === young.nest) : null;
  const parent = nest ? w.dragons.list.find((d) => d.id === nest.parent && d.hp > 0) : null;
  if (!parent) return;
  const before = parent.rage ?? 0;
  parent.rage = Math.min(MAX_RAGE, before + 1);
  parent.calmT = 0;
  // it swells with rage, its wounds forgotten in the fury
  const hp = parent.hp / Math.max(1, parent.maxHp);
  newDragonStats(parent);
  parent.hp = Math.min(parent.maxHp, parent.maxHp * Math.min(1, hp + 0.25));
  w.particles.burst(P.Ember, parent.x, parent.y, 16, 90, { z: parent.z + 30, vz: 60, size: 6, max: 1.1, color: "#ff3a1a" });
  w.sfx("screech", parent.x, parent.y, 1.5, 0.3);
  w.toast("😡", parent.rage > before
    ? `${parent.name}'s young ${young.name} was killed! It roars with rage: bigger, fiercer fire and much harder to kill (rage ${parent.rage}/${MAX_RAGE}).`
    : `${parent.name} is already at the height of its rage!`, parent.x, parent.y);
  w.alarm(parent.x, parent.y, 900, 1, "😱", false);
  const foe = attackerOf(w, parent, 1600);
  if (foe) turnOn(w, parent, foe);
}

/** Rage cools, slowly, when it's left alone. */
export function rageTick(w: World, dr: Dragon, dt: number) {
  if (!dr.rage) return;
  if ((dr.calmT ?? 0) > COOL_AFTER) {
    dr.rage -= 1;
    dr.calmT = 0;
    newDragonStats(dr);
    if (dr.rage <= 0) dr.rage = undefined;
  }
  void dt;
  void w;
}
