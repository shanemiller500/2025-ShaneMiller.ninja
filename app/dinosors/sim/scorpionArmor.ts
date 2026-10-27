/* ------------------------------------------------------------------ */
/*  Scorpion durability: how a war machine takes a beating.            */
/*                                                                     */
/*  Why they used to be lost + rebuilt all the time: a Scorpion was     */
/*  deleted the moment its hit points hit zero (a passing dragon's      */
/*  breath did ~80 a second against 300), blueprints took damage too,   */
/*  and a Scorpion whose wall or tower was rebuilt vanished, so a fresh */
/*  blueprint got planned on the tower. Now:                            */
/*   • every hit has a kind (fire, breath, blast, missile, heavy), and  */
/*     the machine resists each (more with each tier + the Obsidian     */
/*     Fire Shield);                                                    */
/*   • condition goes Healthy → Damaged → Heavily Damaged → Disabled →  */
/*     Destroyed. Fire, small missiles + stray blasts can knock one out  */
/*     (Disabled: it stops shooting) but never destroy it; only heavy   */
/*     attacks (boulders, siege, meteors) and an enemy dragon's breath   */
/*     can finish it;                                                   */
/*   • a destroyed one is a wreck on its spot (rebuilt there, never a   */
/*     second one beside it), and one whose mount is gone drops to the  */
/*     ground instead of disappearing;                                  */
/*   • Auto builders repair damaged ones (build.ts) instead of planning */
/*     replacements.                                                    */
/*  Friendly fire is ruled out before any of this (factions.ts).        */
/* ------------------------------------------------------------------ */
import { SCORPION_TIERS, type Cost } from "../data/colony";
import { P } from "./particles";
import type { Scorpion } from "./types";
import type { World } from "./world";

/** What hit it. */
export type ScorpionHit = "fire" | "breath" | "blast" | "missile" | "heavy" | "energy" | "siege";

/**
 * The Obsidian Fire Shield: polished black volcanic glass plates over the frame. Fits a Scorpion of
 * any tier (and stays on through its upgrades); fire, breath + catapult boulders glance off it.
 */
export const OBSIDIAN_SHIELD = {
  name: "Obsidian Fire Shield",
  cost: { obsidian: 3, iron: 1, tar: 1 } as Cost,
  /** extra toughness from the plates */
  hpMul: 1.15,
};

/** Share of each kind of damage a Scorpion takes: [plain, obsidian-shielded]. */
const TAKES: Record<ScorpionHit, [number, number]> = {
  fire: [0.45, 0.08],
  breath: [0.5, 0.15],
  energy: [0.6, 0.25],
  blast: [0.7, 0.5],
  missile: [0.55, 0.5],
  heavy: [1, 0.9],
  // clan catapult boulders (and their fireballs): the angled glass plates turn most of the blow
  siege: [1, 0.35],
};
/** Heavier frames shrug off more (tier 1, 2, 3). */
const FRAME = [1, 0.82, 0.68];
/** Only these can destroy one outright; anything else stops at Disabled. */
const LETHAL = new Set<ScorpionHit>(["heavy", "breath", "siege"]);

export type ScorpionCondition = "blueprint" | "healthy" | "damaged" | "heavy" | "disabled" | "destroyed";

export const CONDITION_LABEL: Record<ScorpionCondition, string> = {
  blueprint: "Being built",
  healthy: "Healthy",
  damaged: "Damaged",
  heavy: "Heavily damaged",
  disabled: "Disabled (can't shoot)",
  destroyed: "Destroyed",
};

/** A Scorpion's full strength (its tier + the obsidian plates). */
export function scorpionMaxHp(s: Pick<Scorpion, "tier" | "obsidian">) {
  return (SCORPION_TIERS[s.tier - 1]?.hp ?? SCORPION_TIERS[0].hp) * (s.obsidian ? OBSIDIAN_SHIELD.hpMul : 1);
}

/** Below these shares of full strength it's damaged / heavily damaged / disabled. */
export const DAMAGED = 0.75;
export const HEAVY = 0.4;
export const DISABLED = 0.15;

export function scorpionCondition(s: Scorpion): ScorpionCondition {
  if (s.built < 1) return "blueprint";
  if (s.hp <= 0) return "destroyed";
  const f = s.hp / scorpionMaxHp(s);
  return f < DISABLED ? "disabled" : f < HEAVY ? "heavy" : f < DAMAGED ? "damaged" : "healthy";
}

/** Can it shoot? (built, not knocked out, still on a standing wall / finished tower) */
export function scorpionWorks(w: World, s: Scorpion) {
  if (s.built < 1 || s.hp <= 0 || s.hp < scorpionMaxHp(s) * DISABLED) return false;
  if (s.mount === "wall") {
    const wl = w.tribe.wallAt(s.tx, s.ty);
    return !!wl && wl.built >= 1;
  }
  if (s.mount === "tower") {
    const t = w.tribe.towers.find((o) => s.tx >= o.tx && s.tx <= o.tx + 1 && s.ty >= o.ty && s.ty <= o.ty + 1);
    return !!t && t.stage >= 3;
  }
  return true;
}

/**
 * Apply one hit (after friendly fire has been ruled out). Returns the damage actually done.
 * Blueprints aren't machines yet: nothing to break.
 */
export function armourHit(w: World, s: Scorpion, dmg: number, kind: ScorpionHit): number {
  if (s.built < 1 || s.hp <= 0 || dmg <= 0) return 0;
  const takes = TAKES[kind][s.obsidian ? 1 : 0] * (FRAME[s.tier - 1] ?? 1);
  let d = dmg * takes;
  // fire, missiles + stray blasts can knock it out, never wreck it
  if (!LETHAL.has(kind)) d = Math.min(d, Math.max(0, s.hp - scorpionMaxHp(s) * (DISABLED * 0.6)));
  d = Math.min(s.hp, d);
  s.hp -= d;
  const hot = kind === "fire" || kind === "breath" || kind === "energy" || kind === "siege";
  if (w.inView(s.x, s.y, 80)) {
    if (hot && s.obsidian) reflect(w, s);
    else if (w.rng() < 0.5) w.particles.burst(P.Rock, s.x, s.y - 12, 3, 30, { z: 18, size: 3, max: 0.45, color: "#baa77f" });
  }
  if (s.hp <= 0) wreck(w, s);
  return d;
}

/** Heat (or a boulder) bouncing off the glassy plates: a glint + sparks thrown off (never the fire itself). */
function reflect(w: World, s: Scorpion) {
  s.glint = 1;
  if (w.rng() < 0.6) {
    w.particles.burst(P.Spark, s.x, s.y - 14, 5, 70, { z: 20, vz: 60, g: 200, size: 2.5, max: 0.45, color: w.rng() < 0.5 ? "#ffd27a" : "#fff4d6" });
    w.particles.spawn(P.Ring, s.x, s.y - 12, { z: 18, size: 10, max: 0.35, color: "rgba(255,200,120,0.55)" });
  }
  if (w.rng() < 0.15) w.sfx("hiss", s.x, s.y, 0.35, 1.4);
}

/** Destroyed: a wreck on the same spot that builders put back together (a fresh tier-1 frame). */
export function wreck(w: World, s: Scorpion) {
  s.hp = 0;
  s.built = 0;
  s.have = {};
  s.tier = 1;
  s.up = false;
  s.obsidian = false;
  s.obsidianUp = false;
  if (s.crew) {
    const h = w.humans.find((o) => o.id === s.crew);
    if (h && h.state === "operate") h.state = "idle";
    s.crew = 0;
  }
  w.colony.version++;
  w.particles.burst(P.Dust, s.x, s.y, 10, 60, { size: 9, max: 1, color: "rgba(160,130,90,0.6)" });
  w.sfx("crack", s.x, s.y, 0.9);
  w.toast("💥", "A Scorpion was destroyed! Builders will rebuild it on the same spot.", s.x, s.y);
}

/** Can the Obsidian Fire Shield be fitted to this one? (null = yes; otherwise why not) */
export function obsidianProblem(w: World, s: Scorpion): string | null {
  if (s.obsidian) return "Already shielded";
  if (s.built < 1) return "Finish building it first";
  if (!w.colony.finished("blacksmith")) return "Needs a Blacksmith";
  return null;
}

/** Ask builders to fit the shield (materials are delivered like any upgrade). */
export function orderObsidian(w: World, s: Scorpion): boolean {
  if (s.up || s.obsidianUp || obsidianProblem(w, s)) return false;
  s.obsidianUp = true;
  s.have = {};
  return true;
}

/** Fit the shield to every Scorpion that can take one now (not mid-upgrade). Returns how many were ordered. */
export function orderObsidianAll(w: World): number {
  let n = 0;
  for (const s of w.colony.scorpions) if (orderObsidian(w, s)) n++;
  return n;
}

/** For the "Fit on all" button: how many could take it now, and how many are being fitted. */
export function obsidianStatus(w: World) {
  let available = 0;
  let fitting = 0;
  for (const s of w.colony.scorpions) {
    if (s.obsidianUp) fitting++;
    else if (!s.up && !obsidianProblem(w, s)) available++;
  }
  return { available, fitting };
}

/** What builders are bringing to it right now. */
export function scorpionCost(s: Scorpion): Cost {
  if (s.built < 1) return SCORPION_TIERS[0].cost;
  if (s.up) return SCORPION_TIERS[s.tier]?.cost ?? {};
  if (s.obsidianUp) return OBSIDIAN_SHIELD.cost;
  return {};
}
