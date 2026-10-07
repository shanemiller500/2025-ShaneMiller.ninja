/* ------------------------------------------------------------------ */
/*  Colony data: buildings, housing tiers, weapons + shields, Scorpion */
/*  tiers and resource deposits. Pure data: the sim and the UI both    */
/*  read it, so a cost shown on a button is the cost the builders pay. */
/* ------------------------------------------------------------------ */
import type { Building, BuildingKind, NodeKind, ProjectileKind, Resource, TechId, WeaponKind } from "../sim/types";
import { PYRAMID_STAGES, type CivTechId } from "./civ";

export type Cost = Partial<Record<Resource, number>>;

export const RES_INFO: Record<Resource, { icon: string; name: string }> = {
  stick: { icon: "🪵", name: "Sticks" },
  stone: { icon: "🪨", name: "Stone" },
  grass: { icon: "🌾", name: "Grass" },
  leaves: { icon: "🍃", name: "Leaves" },
  wood: { icon: "🪓", name: "Logs" },
  fish: { icon: "🐟", name: "Fish" },
  berries: { icon: "🫐", name: "Berries" },
  meat: { icon: "🥩", name: "Raw meat" },
  cooked: { icon: "🍗", name: "Roast" },
  crop: { icon: "🌽", name: "Crops" },
  water: { icon: "💧", name: "Water" },
  clay: { icon: "🏺", name: "Clay" },
  iron: { icon: "⛓️", name: "Iron" },
  gold: { icon: "🪙", name: "Gold" },
  obsidian: { icon: "🔮", name: "Obsidian" },
  flint: { icon: "🔷", name: "Flint" },
  tar: { icon: "🛢️", name: "Tar" },
  salt: { icon: "🧂", name: "Salt" },
  hide: { icon: "🟫", name: "Hide" },
  bone: { icon: "🦴", name: "Bone" },
  tooth: { icon: "🦷", name: "Teeth & claws" },
  copper: { icon: "🟠", name: "Copper" },
  quartz: { icon: "💠", name: "Quartz" },
  magnetite: { icon: "🧲", name: "Magnetite" },
  crystal: { icon: "🔮", name: "Crystal" },
  meteorite: { icon: "☄️", name: "Meteor fragment" },
  shaped: { icon: "🔷", name: "Shaped stone" },
  diamond: { icon: "💎", name: "Diamond" },
  silver: { icon: "🪨", name: "Silver ore" },
  goldBar: { icon: "🟨", name: "Gold bars" },
  silverBar: { icon: "⬜", name: "Silver bars" },
  copperBar: { icon: "🟧", name: "Copper bars" },
};

export const costTotal = (c: Cost) => Object.values(c).reduce((s, n) => s + (n ?? 0), 0);

/* ------------------------------ buildings ------------------------------ */

export interface BuildingDef {
  kind: BuildingKind;
  icon: string;
  name: string;
  tip: string;
  cost: Cost;
  /** footprint in tiles */
  w: number;
  h: number;
  /** blocks movement (people use the door in front) */
  solid: boolean;
  tech?: TechId;
  /** civilization research it needs (see data/civ) */
  civ?: CivTechId;
  /** seconds of hammering once the materials are in */
  work: number;
  hp: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  storage: { kind: "storage", icon: "📦", name: "Storage", tip: "A drop-off point: gatherers unload here instead of walking back to camp.", cost: { wood: 3, stick: 4 }, w: 2, h: 1, solid: true, tech: "axe", work: 5, hp: 260 },
  workshop: { kind: "workshop", icon: "🛠️", name: "Workshop", tip: "Crafts blades, reinforced bows and shields.", cost: { wood: 5, stone: 4 }, w: 2, h: 2, solid: true, tech: "tools", work: 7, hp: 320 },
  blacksmith: { kind: "blacksmith", icon: "⚒️", name: "Blacksmith", tip: "Forges metal weapons, metal shields and Scorpion parts.", cost: { stone: 8, wood: 4, clay: 4 }, w: 2, h: 2, solid: true, tech: "smelting", work: 9, hp: 420 },
  foodStore: { kind: "foodStore", icon: "🍱", name: "Food store", tip: "Keeps food safe: raiders steal far less.", cost: { wood: 4, leaves: 4 }, w: 2, h: 1, solid: true, tech: "basket", work: 5, hp: 260 },
  waterStore: { kind: "waterStore", icon: "🏺", name: "Water store", tip: "Clay jars of water for fighting fires and greener fields.", cost: { clay: 4, wood: 2 }, w: 1, h: 1, solid: true, tech: "fire", work: 4, hp: 220 },
  healer: { kind: "healer", icon: "🌿", name: "Healing hut", tip: "Hurt people rest here and heal twice as fast.", cost: { wood: 4, leaves: 6 }, w: 2, h: 2, solid: true, tech: "medicine", work: 6, hp: 280 },
  pen: { kind: "pen", icon: "🐾", name: "Animal pen", tip: "Home for befriended dinosaurs.", cost: { stick: 8, wood: 2 }, w: 3, h: 2, solid: false, tech: "taming", work: 5, hp: 200 },
  post: { kind: "post", icon: "🚩", name: "Gathering post", tip: "A far-away drop-off for wood, stone and ore.", cost: { stick: 4 }, w: 1, h: 1, solid: false, work: 2, hp: 120 },
  trap: { kind: "trap", icon: "🪤", name: "Spike trap", tip: "Hurts and slows dinosaurs that step on it.", cost: { stick: 3, wood: 1 }, w: 1, h: 1, solid: false, tech: "spear", work: 3, hp: 3 },
  bridge: { kind: "bridge", icon: "🌉", name: "Bridge", tip: "Walk across rivers and shallows at full speed.", cost: { wood: 3 }, w: 1, h: 1, solid: false, tech: "axe", work: 4, hp: 200 },
  path: { kind: "path", icon: "🟨", name: "Path", tip: "Packed stone: people walk faster.", cost: { stone: 1 }, w: 1, h: 1, solid: false, work: 1, hp: 100 },
  tannery: { kind: "tannery", icon: "🪵", name: "Hide rack", tip: "Stretch + dry dinosaur hides. Makes cloaks, rainproof gear, tunics, furs and hide tent covers.", cost: { stick: 6, bone: 2 }, w: 2, h: 1, solid: true, tech: "tools", work: 5, hp: 220 },
  spikes: { kind: "spikes", icon: "🦴", name: "Bone spikes", tip: "Sharpened bones angled outward. Hurt + slow small and medium attackers; big ones just get slowed. Drag to line your walls.", cost: { bone: 2, stick: 1 }, w: 1, h: 1, solid: false, tech: "spear", work: 3, hp: 10 },
  barricade: { kind: "barricade", icon: "✖️", name: "Bone barricade", tip: "A low crossed-bone barrier. Blocks the way like a short wall and pricks anything that shoves it.", cost: { bone: 4, wood: 1 }, w: 1, h: 1, solid: true, tech: "palisade", work: 4, hp: 170 },
  totem: { kind: "totem", icon: "💀", name: "Bone totem", tip: "A tall skull totem. Wild predators think twice about coming near (raiders don't care).", cost: { bone: 3, tooth: 1, stick: 2 }, w: 1, h: 1, solid: true, work: 4, hp: 150 },
  refinery: { kind: "refinery", icon: "🏭", name: "Refinery", tip: "Smelts raw gold, silver and copper from the mine into bars (burns a log per bar). Raw ore and stacks of bars pile up outside it.", cost: { stone: 6, clay: 4, iron: 2 }, w: 3, h: 2, solid: true, tech: "smelting", work: 10, hp: 520 },
  shelterDeep: { kind: "shelterDeep", icon: "🕳️", name: "Deep shelter", tip: "A bunker dug deep and roofed with stone. When the sky falls, the people inside have a chance.", cost: { stone: 14, wood: 8 }, w: 3, h: 2, solid: true, civ: "deepShelter", work: 18, hp: 1200 },
  resTable: { kind: "resTable", icon: "🔔", name: "Resonance table", tip: "Researchers study here (twice as fast). Tap it to run tuning experiments.", cost: { stone: 4, wood: 2 }, w: 2, h: 1, solid: true, civ: "resonance", work: 5, hp: 260 },
  chamber: { kind: "chamber", icon: "🔮", name: "Crystal chamber", tip: "A small stone room around a tuned crystal: makes and stores a little energy.", cost: { stone: 6, quartz: 2, crystal: 1 }, w: 2, h: 2, solid: true, civ: "quartzTuning", work: 9, hp: 420 },
  shapingYard: { kind: "shapingYard", icon: "🔷", name: "Shaping yard", tip: "Stone shapers cut raw stone into many-sided blocks (shaped stone) for polygon walls + monuments.", cost: { stone: 6, wood: 3 }, w: 2, h: 2, solid: true, civ: "precisionStone", work: 7, hp: 380 },
  energyTower: { kind: "energyTower", icon: "⚡", name: "Energy tower", tip: "A copper-wound stone spire: makes and stores Resonance energy. Glows brighter in storms.", cost: { stone: 4, copper: 3, quartz: 1 }, w: 1, h: 1, solid: true, civ: "copperRes", work: 7, hp: 320 },
  condenser: { kind: "condenser", icon: "💧", name: "Air condenser", tip: "Pulls water from the air into the jars. Best in rain + fog, slow in dry heat. Uses a little energy.", cost: { copper: 2, clay: 3, stone: 2 }, w: 1, h: 1, solid: true, civ: "waterAir", work: 6, hp: 260 },
  obelisk: { kind: "obelisk", icon: "🗿", name: "Obelisk", tip: "A tall shaped-stone needle with a quartz tip: hums out a steady trickle of energy.", cost: { shaped: 3, quartz: 1 }, w: 1, h: 1, solid: true, civ: "precisionStone", work: 9, hp: 600 },
  stoneCircle: { kind: "stoneCircle", icon: "⭕", name: "Stone circle", tip: "Standing megaliths in a ring. Makes energy, and plant-eaters like to gather around it.", cost: { shaped: 6 }, w: 3, h: 3, solid: false, civ: "monumental", work: 12, hp: 900 },
  levPad: { kind: "levPad", icon: "🪶", name: "Lift pad", tip: "Floats shaped blocks to monuments within range (much faster building) and lets you place megaliths with the Levitate tool.", cost: { shaped: 2, magnetite: 2, copper: 1 }, w: 2, h: 2, solid: false, civ: "levitation", work: 8, hp: 400 },
  beamTower: { kind: "beamTower", icon: "🔆", name: "Beam tower", tip: "Fires a crystal beam at attackers and dragons (uses energy, needs to cool down). Beams can light dry grass!", cost: { shaped: 2, crystal: 1, copper: 2 }, w: 1, h: 1, solid: true, civ: "energyWeapons", work: 10, hp: 520 },
  pylon: { kind: "pylon", icon: "🔹", name: "Pylon", tip: "Pylons near each other link into a humming barrier that pushes dinosaurs back. Uses energy.", cost: { copper: 1, magnetite: 1, stone: 2 }, w: 1, h: 1, solid: true, civ: "defensiveEnergy", work: 5, hp: 320 },
  pyramid: { kind: "pyramid", icon: "🔺", name: "Pyramid", tip: "A huge project in 6 stages: foundation, lower courses, main structure, inner chamber, capstone, activation. Then it powers everything.", cost: PYRAMID_STAGES[0].cost, w: 5, h: 4, solid: true, civ: "monumental", work: PYRAMID_STAGES[0].work, hp: 4000 },
  resShield: { kind: "resShield", icon: "🌀", name: "Resonance shield", tip: "Raises a dome of energy over the camp. With enough stored energy it might hold when the sky falls.", cost: { crystal: 3, meteorite: 2, shaped: 4, copper: 4 }, w: 2, h: 2, solid: true, civ: "advancedArch", work: 16, hp: 900 },
};

/** What a building still costs right now (the pyramid goes up stage by stage). */
export function buildingCost(b: Pick<Building, "kind" | "stage">): Cost {
  if (b.kind === "pyramid") return PYRAMID_STAGES[Math.min(b.stage ?? 0, PYRAMID_STAGES.length - 1)].cost;
  return BUILDINGS[b.kind].cost;
}
export function buildingWork(b: Pick<Building, "kind" | "stage">): number {
  if (b.kind === "pyramid") return PYRAMID_STAGES[Math.min(b.stage ?? 0, PYRAMID_STAGES.length - 1)].work;
  return BUILDINGS[b.kind].work;
}

/* ------------------------------ housing ------------------------------ */

export interface HousingTier {
  icon: string;
  name: string;
  /** people it sleeps */
  cap: number;
  /** 0..1 how warm it is inside */
  warmth: number;
  /** 0..1 protection from storms, fire and claws */
  protect: number;
  /** contained hearth fire inside */
  hearth: boolean;
  /** cost to upgrade INTO this tier */
  cost: Cost;
  /** needs the polygon age (shaped stone): Precision stone or Dressed masonry */
  polygon?: boolean;
}

export const HOUSING: HousingTier[] = [
  { icon: "⛺", name: "Tent", cap: 2, warmth: 0.3, protect: 0.2, hearth: false, cost: {} },
  { icon: "🏕️", name: "Hide tent", cap: 3, warmth: 0.46, protect: 0.4, hearth: false, cost: { stick: 3, hide: 3, grass: 2 } },
  { icon: "🛖", name: "Wooden hut", cap: 4, warmth: 0.58, protect: 0.5, hearth: false, cost: { wood: 4, stick: 4, leaves: 4 } },
  { icon: "🏠", name: "Reinforced house", cap: 5, warmth: 0.78, protect: 0.72, hearth: true, cost: { wood: 6, stone: 4, clay: 2 } },
  { icon: "🏡", name: "Stone house", cap: 6, warmth: 0.92, protect: 0.92, hearth: true, cost: { stone: 8, clay: 3, wood: 2 } },
  { icon: "💠", name: "Polygon house", cap: 8, warmth: 1, protect: 1, hearth: true, cost: { shaped: 6, stone: 2, copperBar: 1 }, polygon: true },
];

/** Quick blueprint stages: a tent goes up fast. (Huts use SHELTER_STAGES.) */
export const TENT_STAGES: { label: string; need: "stick" | "leaves"; n: number }[] = [
  { label: "Poles", need: "stick", n: 3 },
  { label: "Cover", need: "leaves", n: 3 },
];

/* ------------------------------ weapons ------------------------------ */

export interface WeaponDef {
  id: string;
  kind: WeaponKind;
  tier: number;
  name: string;
  icon: string;
  /** melee weapons hit from `range`; ranged ones throw / shoot */
  melee: boolean;
  proj?: ProjectileKind;
  range: number;
  dmg: number;
  cd: number;
  /** projectile speed */
  speed: number;
  /** biggest prey (body px) a hunter picks with it */
  prey: number;
  cost: Cost;
  /** building that crafts it */
  at: Station;
  tech?: TechId;
  civ?: CivTechId;
}

/** Where things get made. */
export type Station = "camp" | "workshop" | "blacksmith" | "tannery";

export const WEAPONS: WeaponDef[] = [
  { id: "spear1", kind: "spear", tier: 1, name: "Wooden spear", icon: "🗡️", melee: false, proj: "spear", range: 120, dmg: 26, cd: 2, speed: 360, prey: 60, cost: { stick: 2, stone: 1 }, at: "camp", tech: "spear" },
  { id: "spearB", kind: "spear", tier: 1, name: "Bone spear", icon: "🦴", melee: false, proj: "spear", range: 125, dmg: 34, cd: 2, speed: 380, prey: 70, cost: { stick: 2, bone: 2 }, at: "camp", tech: "spear" },
  { id: "spear2", kind: "spear", tier: 2, name: "Metal spear", icon: "🔱", melee: false, proj: "spear", range: 135, dmg: 40, cd: 2, speed: 400, prey: 85, cost: { wood: 1, iron: 2 }, at: "blacksmith" },
  { id: "spear3", kind: "spear", tier: 3, name: "Heavy war spear", icon: "⚜️", melee: false, proj: "spear", range: 145, dmg: 62, cd: 2.3, speed: 420, prey: 120, cost: { wood: 2, iron: 3, obsidian: 1 }, at: "blacksmith" },
  { id: "sword1", kind: "sword", tier: 1, name: "Flint blade", icon: "🔪", melee: true, range: 34, dmg: 30, cd: 1.1, speed: 0, prey: 55, cost: { stick: 1, flint: 2 }, at: "workshop" },
  { id: "knifeB", kind: "sword", tier: 1, name: "Bone knife", icon: "🔪", melee: true, range: 30, dmg: 24, cd: 0.8, speed: 0, prey: 50, cost: { bone: 2, stick: 1 }, at: "camp", tech: "tools" },
  { id: "sword2", kind: "sword", tier: 2, name: "Metal sword", icon: "🗡️", melee: true, range: 36, dmg: 46, cd: 1.1, speed: 0, prey: 80, cost: { wood: 1, iron: 3 }, at: "blacksmith" },
  { id: "sword3", kind: "sword", tier: 3, name: "Battle sword", icon: "⚔️", melee: true, range: 40, dmg: 72, cd: 1.4, speed: 0, prey: 130, cost: { iron: 4, gold: 1 }, at: "blacksmith" },
  { id: "axe1", kind: "axe", tier: 1, name: "Stone axe", icon: "🪓", melee: true, range: 32, dmg: 28, cd: 1.3, speed: 0, prey: 55, cost: { stick: 1, stone: 2 }, at: "camp", tech: "axe" },
  { id: "axeB", kind: "axe", tier: 1, name: "Bone-edge axe", icon: "🪓", melee: true, range: 32, dmg: 36, cd: 1.3, speed: 0, prey: 65, cost: { wood: 1, bone: 2, tooth: 1 }, at: "camp", tech: "axe" },
  { id: "axe2", kind: "axe", tier: 2, name: "Metal axe", icon: "🪓", melee: true, range: 34, dmg: 44, cd: 1.3, speed: 0, prey: 80, cost: { wood: 1, iron: 2 }, at: "blacksmith" },
  { id: "axe3", kind: "axe", tier: 3, name: "Battle axe", icon: "🪓", melee: true, range: 38, dmg: 70, cd: 1.7, speed: 0, prey: 130, cost: { iron: 4, obsidian: 1 }, at: "blacksmith" },
  { id: "bow1", kind: "bow", tier: 1, name: "Simple bow", icon: "🏹", melee: false, proj: "arrow", range: 250, dmg: 22, cd: 1.3, speed: 620, prey: 95, cost: { stick: 3, grass: 2 }, at: "camp", tech: "bow" },
  { id: "bow2", kind: "bow", tier: 2, name: "Reinforced bow", icon: "🏹", melee: false, proj: "arrow", range: 290, dmg: 31, cd: 1.3, speed: 680, prey: 120, cost: { wood: 2, tar: 1, grass: 2 }, at: "workshop" },
  { id: "bow3", kind: "bow", tier: 3, name: "Heavy bow", icon: "🎯", melee: false, proj: "bolt", range: 340, dmg: 46, cd: 2, speed: 820, prey: 150, cost: { wood: 2, iron: 1, tar: 1 }, at: "blacksmith" },
  // fantasy tech: a crystal-tipped staff that throws a bolt of light
  { id: "lance", kind: "spear", tier: 3, name: "Resonance lance", icon: "🔆", melee: false, proj: "beam", range: 300, dmg: 58, cd: 1.9, speed: 1500, prey: 140, cost: { copper: 2, crystal: 1, wood: 1 }, at: "workshop", civ: "precisionStone" },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export const WEAPON_KINDS: { kind: WeaponKind; icon: string; name: string }[] = [
  { kind: "spear", icon: "🗡️", name: "Spear" },
  { kind: "bow", icon: "🏹", name: "Bow" },
  { kind: "sword", icon: "⚔️", name: "Sword" },
  { kind: "axe", icon: "🪓", name: "Axe" },
];

export interface ShieldDef {
  id: string;
  tier: number;
  name: string;
  /** fraction of damage blocked */
  block: number;
  cost: Cost;
  at: "workshop" | "blacksmith";
}

export const SHIELDS: ShieldDef[] = [
  { id: "shield1", tier: 1, name: "Wood shield", block: 0.18, cost: { wood: 2 }, at: "workshop" },
  { id: "shield2", tier: 2, name: "Reinforced shield", block: 0.3, cost: { wood: 2, tar: 1, stone: 1 }, at: "workshop" },
  { id: "shield3", tier: 3, name: "Metal shield", block: 0.45, cost: { iron: 3 }, at: "blacksmith" },
];

export const SHIELD_BY_ID: Record<string, ShieldDef> = Object.fromEntries(SHIELDS.map((s) => [s.id, s]));

/* ------------------------------ hide clothing ------------------------------ */

export interface OutfitDef {
  id: string;
  name: string;
  icon: string;
  /** 0..1 how much rain + wet it keeps off */
  rain: number;
  /** 0..1 how much cold it keeps out */
  warmth: number;
  /** fraction of bites blocked (stacks with shields) */
  armor: number;
  cost: Cost;
  at: Station;
  tip: string;
  /** how it's drawn */
  color: string;
  trim: string;
  hood: boolean;
}

export const OUTFITS: OutfitDef[] = [
  { id: "cloak", name: "Hide cloak", icon: "🧥", rain: 0.35, warmth: 0.35, armor: 0, cost: { hide: 2 }, at: "tannery", tip: "A warm hide cloak. Keeps off some rain and chill.", color: "#9b6b43", trim: "#6b4527", hood: false },
  { id: "raincloak", name: "Rainproof cloak", icon: "🌧️", rain: 0.92, warmth: 0.3, armor: 0, cost: { hide: 3, tar: 1 }, at: "tannery", tip: "Tar-sealed hide with a hood. Workers keep going in rain and storms.", color: "#4f5a3c", trim: "#2c321f", hood: true },
  { id: "tunic", name: "Hide tunic", icon: "🦺", rain: 0.2, warmth: 0.25, armor: 0.12, cost: { hide: 2, bone: 1 }, at: "tannery", tip: "Thick hide with bone toggles: light armour against bites.", color: "#7d5233", trim: "#e9dcc0", hood: false },
  { id: "furs", name: "Insulated furs", icon: "🧣", rain: 0.45, warmth: 0.88, armor: 0.06, cost: { hide: 4, grass: 2 }, at: "tannery", tip: "Double hide stuffed with grass. For snow, blizzards and mountain trips.", color: "#a88a68", trim: "#f4efe6", hood: true },
];

export const OUTFIT_BY_ID: Record<string, OutfitDef> = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

/* ------------------------------ helmets (metal from the mine) ------------------------------ */

export interface HelmetDef {
  id: string;
  name: string;
  icon: string;
  /** fraction of damage blocked (bites, rocks, cave-ins) */
  armor: number;
  cost: Cost;
  at: Station;
  civ?: CivTechId;
  color: string;
  trim: string;
  /** a magical glow (the crystal helm) */
  glow?: boolean;
  tip: string;
}

export const HELMETS: HelmetDef[] = [
  { id: "helmCopper", name: "Copper helmet", icon: "🪖", armor: 0.12, cost: { copperBar: 1 }, at: "blacksmith", color: "#d07a42", trim: "#8f4a22", tip: "Hammered copper: takes the edge off bites and falling rock." },
  { id: "helmIron", name: "Iron helmet", icon: "⛑️", armor: 0.18, cost: { iron: 2 }, at: "blacksmith", color: "#9aa3ad", trim: "#5d646d", tip: "Plain and tough." },
  { id: "helmSilver", name: "Silver helmet", icon: "🪖", armor: 0.22, cost: { silverBar: 1, iron: 1 }, at: "blacksmith", color: "#e4e8ee", trim: "#9aa3b2", tip: "Bright silver over an iron cap." },
  { id: "helmGold", name: "Gold helmet", icon: "👑", armor: 0.24, cost: { goldBar: 1, iron: 1 }, at: "blacksmith", color: "#f4c84a", trim: "#b8861d", tip: "Gold-plated: heavy, shiny and very proud." },
  { id: "helmCrystal", name: "Crystal helm", icon: "💠", armor: 0.32, cost: { silverBar: 1, crystal: 1, shaped: 1 }, at: "blacksmith", civ: "precisionStone", color: "#8fe3ff", trim: "#e4e8ee", glow: true, tip: "Polygon-cut crystal set in silver. It hums and glows." },
];

export const HELMET_BY_ID: Record<string, HelmetDef> = Object.fromEntries(HELMETS.map((h) => [h.id, h]));

/* ------------------------------ tribe kits (one-time crafts) ------------------------------ */

export interface KitDef {
  id: string;
  name: string;
  icon: string;
  cost: Cost;
  at: Station;
  tip: string;
  civ?: CivTechId;
}

export const KITS: KitDef[] = [
  { id: "boneKnives", name: "Bone knives", icon: "🔪", cost: { bone: 3, flint: 1 }, at: "camp", tip: "Everyone harvests carcasses much faster." },
  { id: "waterSkins", name: "Water skins", icon: "💧", cost: { hide: 2 }, at: "tannery", tip: "Carry twice the water: faster fire fighting, fuller jars." },
  { id: "storageWraps", name: "Storage wraps", icon: "📦", cost: { hide: 3 }, at: "tannery", tip: "Food wrapped in hide: raiders steal far less from the stockpile." },
  { id: "hideCovers", name: "Hide tent covers", icon: "⛺", cost: { hide: 4, stick: 2 }, at: "tannery", tip: "Every tent + hut gets a hide cover: warmer, drier, fires stay lit." },
  // Resonance tools (fantasy tech)
  { id: "cutter", name: "Resonance cutters", icon: "🪚", cost: { copper: 2, quartz: 1 }, at: "workshop", civ: "precisionStone", tip: "Stone shapers cut twice as fast; quarries give more stone." },
  { id: "drill", name: "Crystal drills", icon: "🔩", cost: { copper: 2, crystal: 1 }, at: "workshop", civ: "quartzTuning", tip: "Miners dig copper, quartz, magnetite + crystal twice as fast." },
  { id: "harness", name: "Levitation harnesses", icon: "🪢", cost: { magnetite: 2, hide: 2 }, at: "workshop", civ: "levitation", tip: "Builders carry three times as much shaped stone." },
  { id: "torch", name: "Energy torches", icon: "🔦", cost: { copper: 1, crystal: 1 }, at: "workshop", civ: "energyStorage", tip: "Builders hammer 50% faster; technicians fix overloads quicker." },
  { id: "precision", name: "Precision tools", icon: "📐", cost: { quartz: 2, copper: 1 }, at: "workshop", civ: "precisionStone", tip: "Polygon walls + monuments go up 50% faster." },
  // from the Deep
  { id: "diamondDrill", name: "Diamond drill", icon: "💎", cost: { diamond: 2, iron: 2 }, at: "blacksmith", tip: "Down the mine: cuts granite + volcanic rock twice as fast (and counts as a drill)." },
];

export const KIT_BY_ID: Record<string, KitDef> = Object.fromEntries(KITS.map((k) => [k.id, k]));

export type ForgeCat = "weapons" | "shields" | "gear" | "kits";

export interface ForgeItem {
  id: string;
  name: string;
  icon: string;
  tier: number;
  cost: Cost;
  at: string;
  tech: TechId | undefined;
  civ?: CivTechId;
  cat: ForgeCat;
  tip?: string;
}

/** Anything a smith / tanner can make. */
export const FORGE_ITEMS: ForgeItem[] = [
  ...WEAPONS.map((w) => ({ id: w.id, name: w.name, icon: w.icon, tier: w.tier, cost: w.cost, at: w.at as string, tech: w.tech, civ: w.civ, cat: "weapons" as ForgeCat })),
  ...SHIELDS.map((s) => ({ id: s.id, name: s.name, icon: "🛡️", tier: s.tier, cost: s.cost, at: s.at as string, tech: undefined, cat: "shields" as ForgeCat })),
  ...OUTFITS.map((o) => ({ id: o.id, name: o.name, icon: o.icon, tier: 1, cost: o.cost, at: o.at as string, tech: undefined, cat: "gear" as ForgeCat, tip: o.tip })),
  ...HELMETS.map((h) => ({ id: h.id, name: h.name, icon: h.icon, tier: 2, cost: h.cost, at: h.at as string, tech: undefined, civ: h.civ, cat: "gear" as ForgeCat, tip: h.tip })),
  ...KITS.map((k) => ({ id: k.id, name: k.name, icon: k.icon, tier: 1, cost: k.cost, at: k.at as string, tech: undefined, civ: k.civ, cat: "kits" as ForgeCat, tip: k.tip })),
];

/** What a dead dinosaur gives (scales with its size). */
export function carcassYield(size: number, carnivore: boolean, horned: boolean) {
  return {
    meat: Math.max(1, Math.round(size / 13)),
    hide: Math.max(1, Math.round(size / 24)),
    bone: Math.max(1, Math.round(size / 15)),
    tooth: carnivore ? Math.max(1, Math.round(size / 40)) : horned ? 1 : 0,
  };
}

/* ------------------------------ scorpions ------------------------------ */

export interface ScorpionTier {
  name: string;
  /** cost to build (tier 1) or upgrade into this tier */
  cost: Cost;
  range: number;
  dmg: number;
  reload: number;
  speed: number;
  hp: number;
  /** bonus vs dragons */
  big: number;
  at?: "blacksmith";
}

export const SCORPION_TIERS: ScorpionTier[] = [
  { name: "Scorpion", cost: { wood: 4, stick: 4, stone: 2 }, range: 520, dmg: 70, reload: 4.2, speed: 900, hp: 300, big: 1.8 },
  { name: "Reinforced Scorpion", cost: { wood: 4, iron: 2, tar: 1 }, range: 600, dmg: 105, reload: 3.6, speed: 980, hp: 420, big: 2, at: "blacksmith" },
  { name: "Heavy Siege Scorpion", cost: { wood: 4, iron: 4, obsidian: 1, gold: 1 }, range: 700, dmg: 160, reload: 3.4, speed: 1060, hp: 560, big: 2.3, at: "blacksmith" },
];

/* ------------------------------ deposits ------------------------------ */

export const NODES: Record<NodeKind, { icon: string; name: string; gives: Resource | null; per: number; amount: [number, number]; hidden: boolean; color: string; needs?: TechId }> = {
  stone: { icon: "🪨", name: "Stone quarry", gives: "stone", per: 2, amount: [14, 22], hidden: false, color: "#9b958b" },
  clay: { icon: "🟫", name: "Clay bank", gives: "clay", per: 2, amount: [10, 16], hidden: false, color: "#b6764f" },
  flint: { icon: "🔷", name: "Flint", gives: "flint", per: 2, amount: [8, 14], hidden: false, color: "#5f7d99" },
  iron: { icon: "⛓️", name: "Iron ore", gives: "iron", per: 1, amount: [10, 16], hidden: true, color: "#9a5a46", needs: "tools" },
  gold: { icon: "🪙", name: "Gold", gives: "gold", per: 1, amount: [4, 7], hidden: true, color: "#f2c94c", needs: "tools" },
  obsidian: { icon: "🔮", name: "Obsidian", gives: "obsidian", per: 1, amount: [5, 9], hidden: true, color: "#2b2238", needs: "tools" },
  salt: { icon: "🧂", name: "Salt flat", gives: "salt", per: 2, amount: [8, 12], hidden: true, color: "#efeae0" },
  tar: { icon: "🛢️", name: "Tar seep", gives: "tar", per: 1, amount: [8, 12], hidden: false, color: "#1d1a17" },
  artifact: { icon: "🏺", name: "Strange mound", gives: null, per: 1, amount: [1, 1], hidden: true, color: "#c2a26d" },
  fossil: { icon: "🦴", name: "Bone bed", gives: null, per: 1, amount: [2, 3], hidden: true, color: "#e8dcc0" },
  copper: { icon: "🟠", name: "Copper vein", gives: "copper", per: 1, amount: [10, 16], hidden: false, color: "#c8743f", needs: "tools" },
  quartz: { icon: "💠", name: "Quartz outcrop", gives: "quartz", per: 1, amount: [8, 12], hidden: true, color: "#dff1f7", needs: "tools" },
  magnetite: { icon: "🧲", name: "Magnetite", gives: "magnetite", per: 1, amount: [6, 10], hidden: true, color: "#3d414b", needs: "tools" },
  crystal: { icon: "🔮", name: "Crystal geode", gives: "crystal", per: 1, amount: [4, 7], hidden: true, color: "#8fe3ff", needs: "tools" },
  meteorite: { icon: "☄️", name: "Meteor fragment", gives: "meteorite", per: 1, amount: [2, 4], hidden: false, color: "#5d4d70", needs: "tools" },
};

/** Deposits the civilization paths care about (older saves get them scattered on load). */
export const CIV_NODES: NodeKind[] = ["copper", "quartz", "magnetite", "crystal", "meteorite"];

/** Little treasures diggers find in artifact mounds. */
export const ARTIFACTS = [
  { icon: "🦟", name: "an insect trapped in amber" },
  { icon: "🪈", name: "a bone flute" },
  { icon: "🐚", name: "a shell necklace" },
  { icon: "🗿", name: "a tiny carved statue" },
  { icon: "🪶", name: "a giant fossil feather" },
  { icon: "🦷", name: "a T. rex tooth" },
  { icon: "🌀", name: "a spiral ammonite" },
];

/** Species gentle enough (and big enough) to ride. */
export const RIDEABLE = new Set(["trike", "para", "iguano", "stego", "ankylo"]);
/** Herbivores the tribe can befriend at all. */
export const TAMEABLE = new Set(["trike", "para", "iguano", "stego", "ankylo", "pachy", "apato"]);
