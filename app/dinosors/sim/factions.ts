/* ------------------------------------------------------------------ */
/*  Sides + friendly fire: who an attack belongs to, and what it may   */
/*  hurt. Every blast, missile, boulder and breath that can damage our */
/*  settlement's defences goes through here, so "our own fire never    */
/*  hurts our own Scorpions" is one rule, not a check in each weapon.  */
/*                                                                     */
/*  "us" is the player's tribe (its people, tamed dragons + dinos,     */
/*  Scorpions, catapults, beam towers, pylons). "nature" is the world  */
/*  itself (meteors, the volcano, the asteroid): it hurts everyone.    */
/* ------------------------------------------------------------------ */
import { armourHit, type ScorpionHit } from "./scorpionArmor";
import type { Brute, Dragon, Scorpion } from "./types";
import type { World } from "./world";

export type Side = "us" | "wild" | "clan" | "tree" | "sea" | "sand" | "snow" | "nature";

/** Whose side a dragon fights for. */
export function sideOfDragon(dr: Pick<Dragon, "owner" | "sandTribe">): Side {
  if (dr.owner) return "us";
  if (dr.sandTribe) return "sand";
  return "wild";
}

/** Whose side one of the other peoples is on. */
export function sideOfBrute(b: Pick<Brute, "tree" | "sea" | "sand" | "snow">): Side {
  return b.tree ? "tree" : b.sea ? "sea" : b.sand ? "sand" : b.snow ? "snow" : "clan";
}

/** Does an attack from `by` damage something that belongs to `owner`? (Nature and the wild hurt everyone.) */
export function canHurt(by: Side, owner: Side) {
  return by === "nature" || by === "wild" || by !== owner;
}

/**
 * Damage one of our Scorpions (the war machine). Our own side's attacks never hurt it; what does get
 * through is cut down by its armour for that kind of hit (scorpionArmor.ts). Returns the damage done.
 */
export function hitScorpion(w: World, s: Scorpion, dmg: number, by: Side, kind: ScorpionHit = "missile"): number {
  if (!canHurt(by, "us") || s.hp <= 0 || dmg <= 0) return 0;
  return armourHit(w, s, dmg, kind);
}

/** Every Scorpion inside a blast round (x, y) takes `dmg` (unless the blast is ours). */
export function hitScorpionsAt(w: World, x: number, y: number, r: number, dmg: number, by: Side, kind: ScorpionHit = "blast") {
  if (!canHurt(by, "us")) return;
  for (const s of w.colony.scorpions) if (Math.abs(s.x - x) < r && Math.hypot(s.x - x, s.y - y) < r) hitScorpion(w, s, dmg, by, kind);
}
