/* ------------------------------------------------------------------ */
/*  Civilization paths. Once the tribe finds the humming chamber they  */
/*  pick one: keep refining the Old Ways (metal, farms, siege, cavalry) */
/*  or study the Resonance — a made-up, fantasy technology of tuned    */
/*  crystals, shaped stone and floating blocks. None of the Resonance  */
/*  is real-world science; it's a game mechanic.                       */
/* ------------------------------------------------------------------ */
import type { Resource } from "../sim/types";
import type { Cost } from "./colony";

export type CivPath = "none" | "traditional" | "resonance";

export type CivTechId =
  // the Old Ways
  | "masonry"
  | "ironForge"
  | "cropRotation"
  | "herbalism"
  | "granary"
  | "huntingHorns"
  | "siegecraft"
  | "cavalry"
  | "greatHalls"
  | "deepShelter"
  // the Resonance (fantasy)
  | "resonance"
  | "copperRes"
  | "quartzTuning"
  | "precisionStone"
  | "waterAir"
  | "levitation"
  | "monumental"
  | "energyStorage"
  | "energyWeapons"
  | "defensiveEnergy"
  | "advancedArch";

export interface CivTechDef {
  id: CivTechId;
  path: Exclude<CivPath, "none">;
  icon: string;
  name: string;
  /** what it does in the game */
  what: string;
  /** research points (researchers make ~1/s each) */
  rp: number;
  /** materials used up when the research starts */
  cost: Cost;
  after: CivTechId[];
  /** the other path may study it late (at double cost) */
  cross?: boolean;
}

const T = (d: CivTechDef) => d;

export const CIV_TECH: Record<CivTechId, CivTechDef> = {
  // ---------------- the Old Ways ----------------
  masonry: T({ id: "masonry", path: "traditional", icon: "🧱", name: "Dressed masonry", what: "Stone walls get 50% tougher, and your masons learn polygon stonework: shaped stone, polygon walls and polygon houses.", rp: 40, cost: { stone: 8, clay: 4 }, after: [] }),
  ironForge: T({ id: "ironForge", path: "traditional", icon: "⚒️", name: "Iron forging", what: "Every metal weapon hits 35% harder.", rp: 55, cost: { iron: 4, wood: 4 }, after: ["masonry"], cross: true }),
  cropRotation: T({ id: "cropRotation", path: "traditional", icon: "🌾", name: "Crop rotation", what: "Farms grow twice as fast and give more.", rp: 45, cost: { grass: 6, berries: 4 }, after: [], cross: true }),
  herbalism: T({ id: "herbalism", path: "traditional", icon: "🌿", name: "Herbal medicine", what: "Injuries heal twice as fast; the healing hut saves more people.", rp: 45, cost: { leaves: 8, salt: 1 }, after: ["cropRotation"] }),
  granary: T({ id: "granary", path: "traditional", icon: "🏚️", name: "Granaries", what: "Food keeps: raiders steal almost nothing; bodies spoil slower.", rp: 50, cost: { clay: 6, wood: 4 }, after: ["cropRotation"] }),
  huntingHorns: T({ id: "huntingHorns", path: "traditional", icon: "📯", name: "Hunting horns", what: "Hunters work in pairs: they go after bigger prey and hit harder.", rp: 50, cost: { bone: 4, tooth: 2 }, after: ["ironForge"] }),
  siegecraft: T({ id: "siegecraft", path: "traditional", icon: "🎯", name: "Siegecraft", what: "Scorpions shoot farther, reload faster and hit 40% harder.", rp: 70, cost: { wood: 6, iron: 4, tar: 2 }, after: ["ironForge"] }),
  cavalry: T({ id: "cavalry", path: "traditional", icon: "🐎", name: "Dino cavalry", what: "Riders hit twice as hard and taming goes faster.", rp: 70, cost: { hide: 4, bone: 4 }, after: ["huntingHorns"] }),
  greatHalls: T({ id: "greatHalls", path: "traditional", icon: "🏛️", name: "Great halls", what: "Every finished home sleeps 2 more people and stays warmer.", rp: 80, cost: { stone: 12, wood: 8, clay: 4 }, after: ["masonry", "granary"] }),
  deepShelter: T({ id: "deepShelter", path: "traditional", icon: "🕳️", name: "Deep shelters", what: "Unlocks the Deep shelter: a dug-out bunker that might survive the end of the world.", rp: 110, cost: { stone: 10, wood: 6 }, after: ["greatHalls"] }),

  // ---------------- the Resonance (fantasy tech) ----------------
  resonance: T({ id: "resonance", path: "resonance", icon: "🔔", name: "Resonance discovery", what: "Unlocks the Resonance table: tune materials to find their hidden notes.", rp: 30, cost: { stone: 4 }, after: [] }),
  copperRes: T({ id: "copperRes", path: "resonance", icon: "🟠", name: "Copper resonance", what: "Copper wire carries the hum: unlocks Energy towers and Copper deposits get mined.", rp: 45, cost: { copper: 3 }, after: ["resonance"] }),
  quartzTuning: T({ id: "quartzTuning", path: "resonance", icon: "💠", name: "Quartz tuning", what: "Tuned quartz rings at one note: energy builds faster, unlocks the Obelisk.", rp: 55, cost: { quartz: 3, copper: 1 }, after: ["copperRes"] }),
  precisionStone: T({ id: "precisionStone", path: "resonance", icon: "🔷", name: "Precision stone", what: "Shaping yard + polygon walls: many-sided blocks that lock together with no mortar.", rp: 60, cost: { stone: 8, quartz: 1 }, after: ["quartzTuning"], cross: true }),
  waterAir: T({ id: "waterAir", path: "resonance", icon: "💧", name: "Atmospheric water", what: "Condenser towers pull water out of damp air (best in rain and fog).", rp: 55, cost: { copper: 2, clay: 4 }, after: ["copperRes"], cross: true }),
  levitation: T({ id: "levitation", path: "resonance", icon: "🪶", name: "Levitation", what: "Lift pads float shaped blocks to monuments. Lets you place megaliths with energy.", rp: 85, cost: { magnetite: 3, crystal: 1 }, after: ["precisionStone"] }),
  monumental: T({ id: "monumental", path: "resonance", icon: "🔺", name: "Monumental construction", what: "Pyramid, Stone circle and monumental gates.", rp: 90, cost: { shaped: 6, crystal: 1 }, after: ["levitation"] }),
  energyStorage: T({ id: "energyStorage", path: "resonance", icon: "🔋", name: "Energy storage", what: "Crystal banks: every energy tower stores twice as much.", rp: 70, cost: { crystal: 2, copper: 2 }, after: ["quartzTuning"] }),
  energyWeapons: T({ id: "energyWeapons", path: "resonance", icon: "⚡", name: "Energy weapons", what: "Beam towers + resonance lances. Beams can set dry grass on fire!", rp: 95, cost: { crystal: 2, copper: 3, meteorite: 1 }, after: ["energyStorage"] }),
  defensiveEnergy: T({ id: "defensiveEnergy", path: "resonance", icon: "🛡️", name: "Defensive energy", what: "Pylons: nearby pylons link into humming barriers that push dinosaurs back.", rp: 85, cost: { magnetite: 2, copper: 2 }, after: ["energyStorage"] }),
  advancedArch: T({ id: "advancedArch", path: "resonance", icon: "🌀", name: "Advanced resonance architecture", what: "The Resonance shield: a dome that might survive the end of the world.", rp: 130, cost: { crystal: 3, meteorite: 2, shaped: 6 }, after: ["monumental", "defensiveEnergy"] }),
};

export const CIV_ORDER: Record<Exclude<CivPath, "none">, CivTechId[]> = {
  traditional: ["masonry", "cropRotation", "ironForge", "herbalism", "granary", "huntingHorns", "siegecraft", "cavalry", "greatHalls", "deepShelter"],
  resonance: ["resonance", "copperRes", "quartzTuning", "precisionStone", "waterAir", "energyStorage", "levitation", "monumental", "energyWeapons", "defensiveEnergy", "advancedArch"],
};

/** Techs the tribe must have done in its own path before it may look over the fence. */
export const CROSS_AFTER = 6;
/** Cross-research costs this much more. */
export const CROSS_MULT = 2;

export const PATH_INFO: Record<Exclude<CivPath, "none">, { icon: string; name: string; tag: string; color: string; pros: string[]; feel: string }> = {
  traditional: {
    icon: "🔥",
    name: "Continue the Old Ways",
    tag: "Metal, farms, siege and cavalry",
    color: "#e0893a",
    feel: "Seal the chamber. Trust what works: fire, iron, walls and well-fed people.",
    pros: ["Stronger metal weapons + hunting", "Better farms, granaries + medicine", "Tougher stone walls + siege Scorpions", "Dino cavalry + great halls", "Deep shelters for the worst days"],
  },
  resonance: {
    icon: "💠",
    name: "Study the Resonance",
    tag: "Fantasy tech: crystals, shaped stone, floating blocks",
    color: "#59d0e6",
    feel: "Learn the chamber's song. Tuned crystals, stone that floats and towers that hum. (A made-up technology — this is a game!)",
    pros: ["Resonance energy + experiments", "Polygon walls + monuments + the Pyramid", "Water from the air", "Levitating megaliths", "Beam towers + energy barriers"],
  },
};

/* ------------------------------ experiments ------------------------------ */

/** Materials you can test on the Resonance table, each with a hidden "true note". */
export const EXPERIMENT_MATS: { r: Resource; icon: string; name: string; color: string }[] = [
  { r: "stone", icon: "🪨", name: "Stone", color: "#9b958b" },
  { r: "copper", icon: "🟠", name: "Copper", color: "#d7834a" },
  { r: "quartz", icon: "💠", name: "Quartz", color: "#cfe8f2" },
  { r: "magnetite", icon: "🧲", name: "Magnetite", color: "#4a4f5a" },
  { r: "crystal", icon: "🔮", name: "Crystal", color: "#8fe3ff" },
  { r: "meteorite", icon: "☄️", name: "Meteor fragment", color: "#6d5b80" },
];
export const FREQ_MIN = 60;
export const FREQ_MAX = 960;

/* ------------------------------ the pyramid ------------------------------ */

export const PYRAMID_STAGES: { name: string; cost: Cost; work: number; energy?: number }[] = [
  { name: "Foundation", cost: { stone: 12 }, work: 10 },
  { name: "Lower courses", cost: { shaped: 8, stone: 6 }, work: 12 },
  { name: "Main structure", cost: { shaped: 12 }, work: 14 },
  { name: "Inner chamber", cost: { shaped: 6, crystal: 2, copper: 2 }, work: 12 },
  { name: "Capstone", cost: { shaped: 4, gold: 1, quartz: 2 }, work: 10 },
  { name: "Activation", cost: { crystal: 2 }, work: 6, energy: 60 },
];

/** Energy (per second) made / stored by finished Resonance buildings. */
export const ENERGY_GEN: Partial<Record<string, number>> = { chamber: 0.35, energyTower: 0.8, obelisk: 0.5, stoneCircle: 0.7, pyramid: 2.5 };
export const ENERGY_STORE: Partial<Record<string, number>> = { chamber: 40, energyTower: 80, pyramid: 200 };
/** Constant drain while they work. */
export const ENERGY_USE: Partial<Record<string, number>> = { condenser: 0.25, pylon: 0.12, resShield: 0.6 };

export const BEAM = { range: 460, dmg: 95, cost: 10, reload: 3.2 };
export const LIFT = { range: 760, cost: 18, shaped: 2 };
/** Energy the Resonance shield needs to hold through an impact. */
export const SHIELD_HOLD = 160;
