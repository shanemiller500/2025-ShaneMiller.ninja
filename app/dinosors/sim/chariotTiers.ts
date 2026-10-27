/* ------------------------------------------------------------------ */
/*  War chariot upkeep: repairs + upgrades, done by builders like any  */
/*  other job (build.ts "chariot" sites) while it's parked at home.    */
/*                                                                     */
/*  A damaged chariot is patched up where it stands (no materials,     */
/*  just a builder's time; Auto workers do it once it's under 75%,     */
/*  "🔧 Repair now" fixes any damage). Upgrades plate it heavier and   */
/*  tune its Scorpions: builders bring the materials, then fit them.   */
/* ------------------------------------------------------------------ */
import type { Cost } from "../data/colony";
import type { Chariot } from "./types";
import type { World } from "./world";

export interface ChariotTier {
  name: string;
  icon: string;
  tip: string;
  hp: number;
  /** Scorpion reload, as a share of the base */
  reload: number;
  /** to reach this tier */
  cost: Cost;
  /** needs a finished blacksmith to fit */
  smith?: boolean;
  /** scythe-spiked wheels: whatever it rolls into gets cut (damage per second) */
  spikes?: number;
}

export const CHARIOT_TIERS: ChariotTier[] = [
  { name: "War chariot", icon: "🛡️", tip: "", hp: 900, reload: 1, cost: {} },
  { name: "Bone-plated chariot", icon: "🦴", tip: "Bone plates over the shields: much tougher, and the Scorpions are tuned to reload quicker.", hp: 1300, reload: 0.88, cost: { wood: 10, bone: 8, hide: 4 } },
  { name: "Iron-shod chariot", icon: "⚙️", tip: "Iron-bound wheels and frame from the blacksmith: much tougher again, and its Scorpions reload faster.", hp: 1800, reload: 0.75, cost: { wood: 8, iron: 6, stone: 6 }, smith: true },
  { name: "Steel war fortress", icon: "🏰", tip: "A rolling fortress: steel-plated sides with battlements, a steel ram, and scythe-spiked wheels that cut anything it rolls into. The toughest there is; its Scorpions reload fastest.", hp: 2600, reload: 0.6, cost: { steel: 4, iron: 3, wood: 6, bone: 4 }, smith: true, spikes: 70 },
];

export const chariotTier = (c: Chariot) => CHARIOT_TIERS[c.tier ?? 0] ?? CHARIOT_TIERS[0];
export const nextChariotTier = (c: Chariot) => CHARIOT_TIERS[(c.tier ?? 0) + 1] ?? null;

/** Only worked on while it's parked at home (not out on a raid, not driving). */
export const chariotParked = (w: World, c: Chariot) => !c.to && !w.colony.hunt;

/** Why it can't be upgraded right now (null = it can). */
export function chariotUpgradeProblem(w: World, c: Chariot): string | null {
  const next = nextChariotTier(c);
  if (!next) return "Fully upgraded.";
  if (c.up) return "Upgrade already under way.";
  if (next.smith && !w.colony.finished("blacksmith")) return "Needs a finished ⚒️ Blacksmith.";
  return null;
}

/** Order the next upgrade (builders bring the materials and fit it once it's home). */
export function orderChariotUpgrade(w: World, c: Chariot): string | null {
  const why = chariotUpgradeProblem(w, c);
  if (why) return why;
  c.up = true;
  c.have = {};
  return null;
}

/** Fitted: the new tier's plating (topped up to its full strength). */
export function finishChariotUpgrade(c: Chariot) {
  c.tier = (c.tier ?? 0) + 1;
  c.up = false;
  c.have = {};
  c.maxHp = chariotTier(c).hp;
  c.hp = c.maxHp;
}
