/* ------------------------------------------------------------------ */
/*  Dragon data: breeds, growth stages, lessons and training stages.   */
/*  (Fantasy! Dragons never lived alongside dinosaurs.)                */
/* ------------------------------------------------------------------ */

export type DragonBreed = "fire" | "mountain" | "swift" | "heavy" | "ice" | "sand";

/** What comes out when it breathes: fire, a freezing blast (Ice Dragons), or super-heated sand (Sand Dragons). */
export type BreathKind = "fire" | "frost" | "sand";
export const breathOf = (b: DragonBreed | undefined): BreathKind => (b === "ice" ? "frost" : b === "sand" ? "sand" : "fire");

export interface BreedDef {
  id: DragonBreed;
  name: string;
  icon: string;
  tip: string;
  /** body scale (1 = the classic dragon) */
  size: number;
  /** flying speed, px/s */
  speed: number;
  /** full-grown hit points */
  hp: number;
  /** stamina pool: flying + fire drain it */
  stamina: number;
  /** fire breath strength (range, damage, how much it lights) */
  fire: number;
  /** cargo units a grown one carries */
  carry: number;
  /** 0..1: how quickly it learns */
  smarts: number;
  /** 0..1: how readily a wild one attacks */
  aggression: number;
  /** 0..1: how calm a hatchling is (trust comes faster) */
  temper: number;
  /** colours: body, belly, wing membrane, horns, egg shell + spots */
  look: { body: string; belly: string; wing: string; horn: string; egg: string; spots: string };
  /** how rare an egg of this breed is (higher = more common) */
  weight: number;
}

export const BREEDS: Record<DragonBreed, BreedDef> = {
  fire: {
    id: "fire", name: "Fire Dragon", icon: "🔥", tip: "Strong fire breath, balanced flyer.",
    size: 1, speed: 300, hp: 2600, stamina: 1, fire: 1.35, carry: 6, smarts: 0.6, aggression: 0.7, temper: 0.45,
    look: { body: "#b7342b", belly: "#f2b45a", wing: "#7e1f1a", horn: "#efe1c3", egg: "#c8462f", spots: "#ffcf6a" }, weight: 4,
  },
  mountain: {
    id: "mountain", name: "Mountain Dragon", icon: "⛰️", tip: "Slower, but much tougher and stronger.",
    size: 1.15, speed: 240, hp: 3600, stamina: 1.2, fire: 0.95, carry: 9, smarts: 0.5, aggression: 0.55, temper: 0.55,
    look: { body: "#5d6670", belly: "#c9c1a8", wing: "#3b434c", horn: "#f1ead6", egg: "#7d8790", spots: "#d9d2bd" }, weight: 3,
  },
  swift: {
    id: "swift", name: "Swift Dragon", icon: "💨", tip: "A fast scout. Lighter, with less health.",
    size: 0.8, speed: 400, hp: 1700, stamina: 1.35, fire: 0.8, carry: 3, smarts: 0.75, aggression: 0.4, temper: 0.6,
    look: { body: "#2f6d4f", belly: "#c9d77a", wing: "#1e4636", horn: "#efe1c3", egg: "#3f8a63", spots: "#d9ef8f" }, weight: 3,
  },
  heavy: {
    id: "heavy", name: "Heavy Dragon", icon: "🏋️", tip: "Huge and strong: carries the most, flies slowly.",
    size: 1.35, speed: 210, hp: 4200, stamina: 0.9, fire: 1.05, carry: 16, smarts: 0.45, aggression: 0.6, temper: 0.4,
    look: { body: "#3b3f73", belly: "#a7b4ff", wing: "#262a52", horn: "#f3e7c9", egg: "#4c5299", spots: "#c4ccff" }, weight: 1,
  },
  // only from their own homes (weight 0: never a random egg): the snowy peaks, the Sand People's roosts
  ice: {
    id: "ice", name: "Ice Dragon", icon: "❄️", tip: "Lives high in the snowy peaks. Its freezing breath slows and chills whatever it hits, and leaves the ground iced over.",
    size: 1.1, speed: 270, hp: 3200, stamina: 1.2, fire: 1.1, carry: 8, smarts: 0.6, aggression: 0.55, temper: 0.5,
    look: { body: "#bcd9ee", belly: "#f4fbff", wing: "#7fa9cc", horn: "#eaf7ff", egg: "#c3e4f6", spots: "#ffffff" }, weight: 0,
  },
  sand: {
    id: "sand", name: "Sand Dragon", icon: "🏜️", tip: "The Sand People's desert dragon: sand-coloured, at home on the dunes. It blasts super-heated sand that scorches and leaves the ground glowing hot.",
    size: 1.05, speed: 290, hp: 2800, stamina: 1.25, fire: 1.15, carry: 7, smarts: 0.55, aggression: 0.75, temper: 0.4,
    look: { body: "#d2ac72", belly: "#f3dfb0", wing: "#b38652", horn: "#fff1d0", egg: "#d9b77c", spots: "#f6e3b5" }, weight: 0,
  },
};

export const BREED_LIST = Object.values(BREEDS);

export const DRAGON_NAMES = ["Emberwing", "Ashfang", "Cinderclaw", "Scorchtail", "Pyrrha", "Smoulder", "Blazebeak", "Stormscale", "Flint", "Basalt", "Zephyr", "Kindle", "Obsidia", "Thunderhide", "Spark", "Vesper"];

/* ------------------------------ growth ------------------------------ */

/** Seconds from hatching to full-grown (about three game days). */
export const GROW_SECONDS = 1260;
/** Seconds of steady warmth an egg needs to hatch (about one game day). */
export const INCUBATE_SECONDS = 420;

export type GrowthStage = "hatchling" | "juvenile" | "youngAdult" | "adult";

export const GROWTH: { id: GrowthStage; name: string; from: number }[] = [
  { id: "hatchling", name: "Hatchling", from: 0 },
  { id: "juvenile", name: "Juvenile", from: 0.25 },
  { id: "youngAdult", name: "Young adult", from: 0.55 },
  { id: "adult", name: "Adult", from: 0.85 },
];

export function growthStage(growth: number): GrowthStage {
  let s: GrowthStage = "hatchling";
  for (const g of GROWTH) if (growth >= g.from) s = g.id;
  return s;
}

/* ------------------------------ training ------------------------------ */

export type DragonSkill = "trust" | "follow" | "flight" | "carry" | "rider" | "combat" | "fire";

export interface LessonDef {
  id: DragonSkill;
  icon: string;
  name: string;
  /** what the trainer does */
  how: string;
  /** youngest growth the lesson can start at */
  minGrowth: number;
  /** lessons that must be done first */
  after: DragonSkill[];
  /** trainer-seconds for a full lesson (before speed-ups) */
  secs: number;
}

export const LESSONS: LessonDef[] = [
  { id: "trust", icon: "🍖", name: "Feeding + calming", how: "feeds it by hand and keeps it calm", minGrowth: 0, after: [], secs: 70 },
  { id: "follow", icon: "🚶", name: "Walking + following", how: "walks it round the camp on a lead", minGrowth: 0.08, after: ["trust"], secs: 80 },
  { id: "flight", icon: "🪽", name: "Flying practice", how: "runs it through short hops and glides", minGrowth: 0.25, after: ["follow"], secs: 110 },
  { id: "fire", icon: "🔥", name: "Fire-breath control", how: "teaches it to breathe only on command", minGrowth: 0.35, after: ["flight"], secs: 120 },
  { id: "carry", icon: "📦", name: "Carrying loads", how: "straps on bundles, heavier each day", minGrowth: 0.55, after: ["flight"], secs: 90 },
  { id: "rider", icon: "🧗", name: "Rider acceptance", how: "climbs on, a little longer each time", minGrowth: 0.55, after: ["carry"], secs: 130 },
  { id: "combat", icon: "⚔️", name: "Combat commands", how: "drills dives, guard + retreat calls", minGrowth: 0.6, after: ["rider", "fire"], secs: 140 },
];

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l])) as Record<DragonSkill, LessonDef>;

export const DRAGON_STAGES = ["Wild", "Hatched", "Trusting", "Trained", "Rideable", "War-Trained", "Fully Bonded"] as const;
export type DragonStage = (typeof DRAGON_STAGES)[number];

/* ------------------------------ commands ------------------------------ */

export type DragonCmdKind = "follow" | "stay" | "flyTo" | "land" | "patrol" | "route" | "guard" | "attack" | "retreat" | "fire" | "carry" | "home" | "volcano"
  // a Dragon Rider's job for the tribe (riderDuty.ts; never a button)
  | "duty";

export const DRAGON_COMMANDS: { id: DragonCmdKind; icon: string; name: string; tip: string; aim: boolean; needs: DragonSkill }[] = [
  { id: "follow", icon: "🚶", name: "Follow", tip: "Stay with its rider (or trainer)", aim: false, needs: "follow" },
  { id: "stay", icon: "✋", name: "Stay", tip: "Hold still right here", aim: false, needs: "trust" },
  { id: "flyTo", icon: "🪽", name: "Fly here", tip: "Take off and fly to a spot (the rider climbs on first)", aim: true, needs: "flight" },
  { id: "land", icon: "🛬", name: "Land", tip: "Come down on the nearest clear ground", aim: false, needs: "flight" },
  { id: "patrol", icon: "🌀", name: "Patrol", tip: "Circle an area, watching for trouble", aim: true, needs: "flight" },
  { id: "route", icon: "🧭", name: "Route", tip: "Tap up to 5 waypoints, then fly them in a loop", aim: true, needs: "flight" },
  { id: "guard", icon: "🛡️", name: "Guard", tip: "Hover over a spot and drive off anything hostile", aim: true, needs: "combat" },
  { id: "attack", icon: "⚔️", name: "Attack", tip: "Dive at a hostile creature", aim: true, needs: "combat" },
  { id: "volcano", icon: "🌋", name: "Volcano Drop", tip: "Snatch a Neanderthal and drop them into the volcano", aim: true, needs: "combat" },
  { id: "fire", icon: "🔥", name: "Fire Breath", tip: "Breathe fire on a spot (sets plants + wood alight!)", aim: true, needs: "fire" },
  { id: "carry", icon: "📦", name: "Carry", tip: "Fly supplies from the stores to a building site", aim: true, needs: "carry" },
  { id: "retreat", icon: "↩️", name: "Retreat", tip: "Break off and fly home", aim: false, needs: "flight" },
  { id: "home", icon: "🏠", name: "Return to roost", tip: "Go home to the roost and rest", aim: false, needs: "trust" },
];
