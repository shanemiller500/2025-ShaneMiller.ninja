/* ------------------------------------------------------------------ */
/*  Fight World map: 11 zones, each a side-scrolling street built from  */
/*  an arena painter (+ variant). Residents are chosen deterministically */
/*  per zone so the world feels persistent between visits.              */
/* ------------------------------------------------------------------ */

import type { FighterDef } from "../engine/types";
import { Rng } from "../engine/rng";
import { arenaById, type ArenaDef, type ArenaId } from "../render/arenas";

export interface Zone {
  id: string;
  name: string;
  blurb: string;
  arena: ArenaDef;
  /** Grid position on the overview map (col, row) */
  map: [number, number];
  /** Prefer residents of this alignment / archetype flavour */
  favors?: "good" | "bad";
  residents: number;
}

/** Half-width of a walkable zone in world units (a fight stage is 780). */
export const ZONE_HALF = 1700;

function zoneArena(id: ArenaId, name: string, tagline: string, variant?: string): ArenaDef {
  const base = arenaById(id);
  return { ...base, variant, name, tagline };
}

export const ZONES: Zone[] = [
  { id: "queens", name: "Queens Streets", blurb: "Sunny neighbourhood blocks — friendly faces, mostly.", arena: zoneArena("avenue", "Queens Streets", "Daylight on a quiet block.", "day"), map: [0, 1], favors: "good", residents: 4 },
  { id: "skyline", name: "Skyline Rooftops", blurb: "Water towers, searchlights and a long way down.", arena: zoneArena("rooftop", "Skyline Rooftops", "Midnight above the city."), map: [1, 0], residents: 3 },
  { id: "neon", name: "Neon District", blurb: "Signs never sleep. Neither do the people here.", arena: zoneArena("rooftop", "Neon District", "Cyan glow and wet rooftops.", "neon"), map: [2, 0], favors: "bad", residents: 4 },
  { id: "downtown", name: "Ruined Downtown", blurb: "The aftermath of something big. Cars still burning.", arena: zoneArena("avenue", "Ruined Downtown", "Smoke, sirens and wrecks."), map: [1, 1], residents: 4 },
  { id: "lab", name: "Research Lab", blurb: "Reactor online. Somebody is always experimenting.", arena: zoneArena("lab", "Research Lab", "Glowing tanks and humming consoles."), map: [2, 1], residents: 3 },
  { id: "training", name: "Training Facility", blurb: "Sparring partners welcome. Hazard stripes optional.", arena: zoneArena("lab", "Training Facility", "Practice floor with hazard lights.", "training"), map: [3, 1], favors: "good", residents: 4 },
  { id: "bunker", name: "Underground Bunker", blurb: "Red alarms. Restricted access. You're not supposed to be here.", arena: zoneArena("lab", "Underground Bunker", "Deep underground, on alert.", "bunker"), map: [2, 2], favors: "bad", residents: 3 },
  { id: "orbital", name: "Orbital Station", blurb: "Observation deck in low orbit.", arena: zoneArena("station", "Orbital Station", "A planet fills the window."), map: [3, 0], residents: 3 },
  { id: "frontier", name: "Alien Frontier", blurb: "A strange world under a ringed sky.", arena: zoneArena("station", "Alien Frontier", "An outpost on an alien planet.", "planet"), map: [4, 0], residents: 3 },
  { id: "sanctum", name: "Mystic Sanctum", blurb: "A temple between dimensions. Mind the floating stones.", arena: zoneArena("sanctum", "Mystic Sanctum", "Everything floats."), map: [3, 2], residents: 3 },
  { id: "magma", name: "Magma Core", blurb: "The hottest fight club on (or under) Earth.", arena: zoneArena("magma", "Magma Core", "Lava falls and rising embers."), map: [4, 2], favors: "bad", residents: 3 },
];

export const zoneById = (id: string) => ZONES.find((z) => z.id === id) ?? ZONES[0];

/** Neighbouring zones walking off the left / right edge (ordered loop). */
export function neighbours(id: string): [Zone, Zone] {
  const i = ZONES.findIndex((z) => z.id === id);
  return [ZONES[(i - 1 + ZONES.length) % ZONES.length], ZONES[(i + 1) % ZONES.length]];
}

function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface Resident {
  def: FighterDef;
  x: number;
}

/** Pick zone residents: featured fighters sprinkled in, the rest from the full roster. */
export function residentsFor(zone: Zone, all: FighterDef[], featured: FighterDef[], exclude: number): Resident[] {
  const rng = new Rng(seedOf(zone.id));
  const pool = all.filter((d) => d.id !== exclude && (!zone.favors || d.alignment === zone.favors || rng.chance(0.25)));
  const feat = featured.filter((d) => d.id !== exclude);
  const picked: FighterDef[] = [];
  // One featured character per zone (rotates through the cast)
  if (feat.length) picked.push(feat[ZONES.indexOf(zone) % feat.length]);
  let guard = 0;
  while (picked.length < zone.residents && guard++ < 200) {
    const d = rng.pick(pool.length ? pool : all);
    if (!picked.some((p) => p.id === d.id) && d.id !== exclude) picked.push(d);
  }
  const span = (ZONE_HALF * 2 - 700) / Math.max(1, picked.length);
  return picked.map((def, i) => ({ def, x: -ZONE_HALF + 500 + span * (i + 0.5) + rng.range(-120, 120) }));
}
