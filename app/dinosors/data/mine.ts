/* ------------------------------------------------------------------ */
/*  The Deep: data for the underground mine under the cave.            */
/*  A cross-section about 48 cells wide and 200 deep (each cell is    */
/*  ~6 ft, so ~1200 ft down). Rock gets harder and richer with depth.  */
/*  Inspired by MinerVGA (1989): what's in a cell isn't known until    */
/*  it's dug or scanned, and tools make digging cheaper and safer.    */
/* ------------------------------------------------------------------ */
import type { Resource } from "../sim/types";

export const MINE_W = 48;
export const MINE_H = 200;
/** The lift shaft column (under the cave mouth). */
export const LIFT_X = 4;
/** How deep the lift reaches at the start (rows). */
export const LIFT_START = 30;
/** Rows added per lift upgrade (~60 ft). */
export const LIFT_STEP = 10;
/** The lift can never go into the magma floor. */
export const LIFT_MAX = MINE_H - 12;

/** Rock. 0 = open space (dug out, or a natural cavern). */
export enum M {
  Open = 0,
  Soil = 1,
  Clay = 2,
  Sandstone = 3,
  Stone = 4,
  Granite = 5,
  Volcanic = 6,
  /** loose fill after a cave-in: quick to clear */
  Rubble = 7,
  /** the molten floor: impassable */
  Magma = 8,
  /** groundwater barrier under the surface (only the shaft goes through) */
  Barrier = 9,
  Shaft = 10,
  /** sheets + walls of solid bedrock that section the mine: only dynamite breaks them */
  Bedrock = 11,
}

export interface MaterialDef {
  name: string;
  /** seconds to dig one cell with bare hands */
  dig: number;
  /** can it be dug at all, and what's needed */
  needs?: "drill" | "blast";
  solid: boolean;
  /** what a cell of plain rock gives (sometimes) */
  spoil?: Resource;
  color: string;
}

export const MATERIALS: Record<M, MaterialDef> = {
  [M.Open]: { name: "Open", dig: 0, solid: false, color: "#14100d" },
  [M.Soil]: { name: "Soil", dig: 2, solid: true, color: "#6b4a2f" },
  [M.Clay]: { name: "Clay", dig: 2.6, solid: true, spoil: "clay", color: "#8a5a3c" },
  [M.Sandstone]: { name: "Sandstone", dig: 3.2, solid: true, spoil: "stone", color: "#a9845a" },
  [M.Stone]: { name: "Stone", dig: 5, solid: true, spoil: "stone", color: "#6f6a63" },
  [M.Granite]: { name: "Granite", dig: 9, needs: "drill", solid: true, spoil: "stone", color: "#8b8590" },
  [M.Volcanic]: { name: "Volcanic rock", dig: 7, solid: true, spoil: "obsidian", color: "#3a2a2e" },
  [M.Rubble]: { name: "Rubble", dig: 1.2, solid: true, color: "#5a4c40" },
  [M.Magma]: { name: "Magma", dig: 0, solid: true, color: "#ff5a1f" },
  [M.Barrier]: { name: "Groundwater barrier", dig: 0, solid: true, color: "#2c4a5a" },
  [M.Shaft]: { name: "Lift shaft", dig: 0, solid: false, color: "#22201e" },
  [M.Bedrock]: { name: "Bedrock", dig: 0, needs: "blast", solid: true, color: "#3a3c46" },
};

/** What a cell holds (hidden until dug or scanned). */
export type Content = Resource | "fossil" | "spring" | "caveIn" | "gas" | LandmarkKind | null;

export interface Band {
  name: string;
  /** first row of the band */
  from: number;
  /** base rock, then the rarer ones with their share */
  rock: [M, number][];
  /** chance a cell holds anything at all */
  rich: number;
  /** what it holds, by weight */
  finds: [Exclude<Content, null>, number][];
  /** base cave-in risk per cell dug */
  collapse: number;
  /** natural caverns (0 = none) */
  caverns: number;
  /** hot enough to hurt people (per second) */
  heat: number;
}

export const BANDS: Band[] = [
  {
    name: "Topsoil",
    from: 1,
    rock: [[M.Soil, 0.7], [M.Clay, 0.22], [M.Sandstone, 0.08]],
    rich: 0.035,
    finds: [["spring", 1.6], ["caveIn", 0.8], ["fossil", 0.3]],
    collapse: 0.02,
    caverns: 0,
    heat: 0,
  },
  {
    name: "Bedrock",
    from: 30,
    rock: [[M.Stone, 0.62], [M.Sandstone, 0.24], [M.Granite, 0.14]],
    rich: 0.045,
    finds: [["spring", 1.4], ["caveIn", 1], ["gas", 0.5], ["fossil", 0.4]],
    collapse: 0.03,
    caverns: 0.12,
    heat: 0,
  },
  {
    name: "Granite deep",
    from: 70,
    rock: [[M.Granite, 0.5], [M.Stone, 0.45], [M.Sandstone, 0.05]],
    rich: 0.04,
    finds: [["spring", 1], ["caveIn", 0.8], ["gas", 0.8]],
    collapse: 0.018,
    caverns: 0.16,
    heat: 0,
  },
  {
    name: "Fossil & crystal caverns",
    from: 110,
    rock: [[M.Stone, 0.55], [M.Granite, 0.35], [M.Sandstone, 0.1]],
    rich: 0.09,
    finds: [["fossil", 1.6], ["diamond", 0.15], ["spring", 0.7], ["caveIn", 0.7], ["gas", 0.6]],
    collapse: 0.025,
    caverns: 0.3,
    heat: 0,
  },
  {
    name: "The Furnace",
    from: 150,
    rock: [[M.Volcanic, 0.6], [M.Granite, 0.3], [M.Stone, 0.1]],
    rich: 0.07,
    finds: [["diamond", 0.5], ["caveIn", 1], ["gas", 1.2]],
    collapse: 0.04,
    caverns: 0.14,
    heat: 0.015,
  },
];

/** The molten floor starts here. */
export const MAGMA_FROM = MINE_H - 8;

export function bandAt(y: number): Band {
  let b = BANDS[0];
  for (const x of BANDS) if (y >= x.from) b = x;
  return b;
}

/** Units a find gives per dig. */
export const FIND_AMOUNT: Partial<Record<Resource, [number, number]>> = {
  flint: [1, 3],
  clay: [2, 3],
  copper: [1, 3],
  salt: [1, 2],
  iron: [1, 3],
  quartz: [1, 2],
  gold: [1, 2],
  magnetite: [1, 2],
  crystal: [1, 2],
  obsidian: [1, 3],
  meteorite: [1, 1],
  diamond: [1, 1],
  silver: [1, 2],
};

/** Lift upgrades get pricier the deeper they go. */
export function liftUpgradeCost(max: number): Partial<Record<Resource, number>> {
  const step = Math.max(0, Math.round((max - LIFT_START) / LIFT_STEP));
  const cost: Partial<Record<Resource, number>> = { wood: 3 + step, stone: 2 + step };
  if (step >= 3) cost.iron = Math.ceil((step - 2) / 2);
  if (step >= 9) cost.copper = step - 8;
  return cost;
}

export const SUPPORT_COST: Partial<Record<Resource, number>> = { wood: 1 };
export const BLAST_COST: Partial<Record<Resource, number>> = { tar: 1, stick: 1 };
/** How far a support beam holds the roof up (cells, square). */
export const SUPPORT_REACH = 2;
/** Water above this blocks walking. */
export const FLOODED = 0.55;

/* ------------------------------ building down here (Phase 4) ------------------------------ */

export type DeepKind = "home" | "vault" | "mushroom" | "lamp" | "mess" | "pump";

export interface DeepDef {
  kind: DeepKind;
  name: string;
  icon: string;
  tip: string;
  /** footprint in cells (placed by its top-left cell) */
  w: number;
  h: number;
  cost: Partial<Record<Resource, number>>;
  /** seconds of work once the materials are down */
  work: number;
  /** needs solid rock under its whole floor */
  floor: boolean;
  /** extra people the tribe can house */
  room?: number;
}

export const DEEP_DEFS: Record<DeepKind, DeepDef> = {
  home: { kind: "home", name: "Burrow home", icon: "🏠", tip: "A snug home carved into the rock: room for 4 more people in the tribe. Warm, dry and safe from raids.", w: 3, h: 2, cost: { wood: 4, stone: 3, hide: 1 }, work: 14, floor: true, room: 4 },
  vault: { kind: "vault", name: "Deep vault", icon: "🗄️", tip: "Miners unload here instead of walking to the lift (it's sent up for them). Food stored down here is safe from raiders.", w: 2, h: 2, cost: { wood: 3, stone: 4 }, work: 10, floor: true },
  mushroom: { kind: "mushroom", name: "Glowshroom farm", icon: "🍄", tip: "Glowing mushrooms grow in the dark: crops come up the lift. Faster with water close by.", w: 3, h: 1, cost: { wood: 2, clay: 2, grass: 2 }, work: 8, floor: true },
  lamp: { kind: "lamp", name: "Crystal lamp", icon: "💡", tip: "Lights up the rock around it for good: digging nearby goes 25% faster and gas can't build up.", w: 1, h: 1, cost: { stick: 2, tar: 1 }, work: 4, floor: false },
  pump: { kind: "pump", name: "Pump station", icon: "🚰", tip: "Drains flooded tunnels nearby by itself and pipes the water up to the camp's water store.", w: 1, h: 2, cost: { copper: 2, wood: 2, stone: 2 }, work: 8, floor: true },
  mess: { kind: "mess", name: "Mess hall", icon: "🍲", tip: "A table and a cook-pot: hurt miners rest and heal here instead of going up.", w: 2, h: 2, cost: { wood: 3, stone: 2, clay: 1 }, work: 10, floor: true },
};

export const DEEP_ORDER: DeepKind[] = ["home", "vault", "pump", "mushroom", "lamp", "mess"];
/** how far a pump station reaches (cells) */
export const PUMP_REACH = 8;
/** how far a crystal lamp lights (cells) */
export const LAMP_REACH = 4;

/* ------------------------------ Phase 5: landmarks, milestones, cave life ------------------------------ */

/** One-of-a-kind finds hidden somewhere in every world's mine. */
export type LandmarkKind = "lode" | "skeleton" | "geode" | "core";

export interface LandmarkDef {
  kind: LandmarkKind;
  name: string;
  icon: string;
  /** shape (cells wide x high) */
  w: number;
  h: number;
  /** rows it can sit in */
  rows: [number, number];
  /** what each cell gives */
  gives: Partial<Record<Resource, number>>;
  /** shown when the scanner first picks it up */
  signal: string;
  /** shown when the whole thing is dug out */
  done: string;
  color: string;
}

export const LANDMARKS: Record<LandmarkKind, LandmarkDef> = {
  lode: { kind: "lode", name: "Iron mother lode", icon: "⛓️", w: 5, h: 3, rows: [75, 104], gives: { iron: 4 }, signal: "A huge mass of iron shows up on the scanner!", done: "The mother lode is dug out — a mountain of iron for the forges!", color: "#c0634a" },
  skeleton: { kind: "skeleton", name: "Giant fossil skeleton", icon: "🦕", w: 7, h: 2, rows: [114, 140], gives: { bone: 3, tooth: 1 }, signal: "Something long and bony is buried in the cavern rock…", done: "A whole giant skeleton! The tribe will be telling this story for generations.", color: "#efe4c8" },
  geode: { kind: "geode", name: "Resonant geode", icon: "💠", w: 3, h: 3, rows: [118, 145], gives: { crystal: 3, quartz: 1 }, signal: "A hollow full of humming crystal — a giant geode!", done: "The geode is open: a cave of singing crystal.", color: "#8fe3ff" },
  core: { kind: "core", name: "Buried meteor core", icon: "☄️", w: 3, h: 3, rows: [160, 182], gives: { meteorite: 3, gold: 1 }, signal: "Something very dense and very old fell here long ago…", done: "The meteor core is out! Rare star-metal for the tribe.", color: "#8b6fb0" },
};

export const LANDMARK_ORDER: LandmarkKind[] = ["lode", "skeleton", "geode", "core"];

/** Depth milestones (instead of MinerVGA's win condition): each one pays out once. */
export const MILESTONES: { id: string; row: number; name: string; icon: string; gift: Partial<Record<Resource, number>>; text: string }[] = [
  { id: "deep30", row: 30, name: "Through the topsoil", icon: "🪨", gift: { stone: 10, wood: 4 }, text: "Bedrock! The tribe sends down a celebration crate." },
  { id: "deep70", row: 70, name: "Granite deep", icon: "⛰️", gift: { iron: 4, cooked: 6 }, text: "Granite country. The smiths send iron to celebrate." },
  { id: "deep110", row: 110, name: "The cavern world", icon: "🦇", gift: { crystal: 2, quartz: 2 }, text: "Caverns of crystal and bone… the deepest anyone has ever been." },
  { id: "deep150", row: 150, name: "The Furnace", icon: "🌋", gift: { obsidian: 4, gold: 2 }, text: "The rock is hot to the touch. The Furnace begins." },
  { id: "deep185", row: 185, name: "The bottom of the world", icon: "🏆", gift: { gold: 4, diamond: 1 }, text: "You reached the magma floor — the very bottom of the world!" },
];

/** Troglodon: a blind, pale cave lizard that lives in the caverns. */
export const TROG = { hp: 1, bite: 0.12, biteEvery: 1.6, sense: 6, speed: 1.8, loot: { hide: 2, bone: 2, tooth: 1 } as Partial<Record<Resource, number>> };

/* ------------------------------ ore bodies ------------------------------ */
/*  Minerals come in real shapes: seams follow the rock layers (long and   */
/*  thin), veins wander and branch through cracks, pockets are small       */
/*  rich clusters and pipes run straight down. Most bodies are small; a    */
/*  few are huge (sizes are drawn from a steep curve).                    */

export type OreShape = "seam" | "vein" | "pocket" | "pipe";

export interface OreBody {
  r: Resource;
  shape: OreShape;
  /** relative chance among this band's bodies */
  weight: number;
  /** length (seams, veins, pipes) or radius x10 (pockets) */
  size: [number, number];
}

/** How many bodies each band gets, and which. */
export const ORE_BODIES: { band: number; count: number; bodies: OreBody[] }[] = [
  {
    band: 0,
    count: 22,
    bodies: [
      { r: "clay", shape: "seam", weight: 3, size: [6, 30] },
      { r: "flint", shape: "pocket", weight: 3, size: [10, 22] },
      { r: "flint", shape: "seam", weight: 1.5, size: [5, 18] },
      { r: "copper", shape: "vein", weight: 2.5, size: [4, 16] },
      { r: "salt", shape: "seam", weight: 1.2, size: [6, 24] },
    ],
  },
  {
    band: 1,
    count: 26,
    bodies: [
      { r: "iron", shape: "seam", weight: 3, size: [8, 40] },
      { r: "iron", shape: "vein", weight: 2, size: [6, 28] },
      { r: "copper", shape: "vein", weight: 3, size: [6, 30] },
      { r: "silver", shape: "vein", weight: 1.2, size: [4, 16] },
      { r: "quartz", shape: "pocket", weight: 1.5, size: [10, 20] },
      { r: "salt", shape: "seam", weight: 0.8, size: [6, 20] },
    ],
  },
  {
    band: 2,
    count: 26,
    bodies: [
      { r: "iron", shape: "vein", weight: 3, size: [8, 44] },
      { r: "gold", shape: "vein", weight: 1.6, size: [4, 22] },
      { r: "silver", shape: "vein", weight: 2, size: [5, 26] },
      { r: "copper", shape: "seam", weight: 1.5, size: [8, 30] },
      { r: "magnetite", shape: "pocket", weight: 1.6, size: [10, 24] },
      { r: "quartz", shape: "vein", weight: 1.4, size: [5, 18] },
    ],
  },
  {
    band: 3,
    count: 24,
    bodies: [
      { r: "crystal", shape: "pocket", weight: 3, size: [10, 26] },
      { r: "quartz", shape: "vein", weight: 2, size: [5, 22] },
      { r: "gold", shape: "vein", weight: 2, size: [5, 26] },
      { r: "silver", shape: "seam", weight: 1.6, size: [8, 30] },
      { r: "magnetite", shape: "pocket", weight: 1, size: [10, 20] },
    ],
  },
  {
    band: 4,
    count: 24,
    bodies: [
      { r: "obsidian", shape: "seam", weight: 3, size: [8, 36] },
      { r: "gold", shape: "vein", weight: 3, size: [6, 34] },
      { r: "crystal", shape: "pocket", weight: 1.2, size: [10, 20] },
      { r: "meteorite", shape: "pocket", weight: 0.6, size: [10, 15] },
      { r: "diamond", shape: "pipe", weight: 0.8, size: [3, 9] },
    ],
  },
];
