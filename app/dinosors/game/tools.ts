/* ------------------------------------------------------------------ */
/*  The toy box. Tool + option definitions (for the UI) and what each  */
/*  one does when it touches the world (for the engine).               */
/* ------------------------------------------------------------------ */
import { TECH } from "../data/facts";
import { CIV_TECH, LIFT, type CivTechId } from "../data/civ";
import { BUILDINGS, HOUSING, SCORPION_TIERS, TENT_STAGES, type Cost } from "../data/colony";
import { SHELTER_STAGES } from "../data/facts";
import { sp } from "../data/species";
import { addHuman } from "../sim/humans";
import { P } from "../sim/particles";
import { makePlant } from "../sim/plants";
import { isWaterTile, isWalkTile } from "../sim/terrain";
import { MAP_W, MAX_PEOPLE, T, TILE, type BuildingKind, type PlantKind, type SpeciesId, type TechId, type WallKind, type WeatherKind } from "../sim/types";
import type { World } from "../sim/world";

export type ToolId = "hand" | "dino" | "egg" | "food" | "plant" | "land" | "fire" | "weather" | "disaster" | "people" | "build" | "erase";
export type FoodOpt = "meat" | "fish" | "fruit" | "berries";
export type LandOpt = "water" | "rock" | "mud" | "grass";
export type DisasterOpt = "lightning" | "meteor" | "volcano" | "quake" | "raid" | "dragon" | "supervolcano";
export type PeopleOpt = "adult" | "child";
export type BuildOpt = "tent" | "hut" | "wall" | "stonewall" | "polywall" | "polygate" | "bonegate" | "levitate" | "gate" | "stairs" | "tower" | "scorpion" | "farm" | "campfire" | "cleanMud" | BuildingKind;

export interface ToolState {
  id: ToolId;
  species: SpeciesId;
  egg: SpeciesId;
  food: FoodOpt;
  plant: PlantKind;
  land: LandOpt;
  weather: WeatherKind;
  disaster: DisasterOpt;
  people: PeopleOpt;
  build: BuildOpt;
}

export const DEFAULT_TOOL: ToolState = {
  id: "hand",
  species: "trike",
  egg: "trike",
  food: "meat",
  plant: "broadleaf",
  land: "water",
  weather: "rain",
  disaster: "lightning",
  people: "adult",
  build: "wall",
};

export interface Opt<V extends string> {
  value: V;
  icon: string;
  label: string;
}

export const FOOD_OPTS: Opt<FoodOpt>[] = [
  { value: "meat", icon: "🍖", label: "Meat" },
  { value: "fish", icon: "🐟", label: "Fish" },
  { value: "fruit", icon: "🍎", label: "Fruit" },
  { value: "berries", icon: "🫐", label: "Berries" },
];
export const PLANT_OPTS: Opt<PlantKind>[] = [
  { value: "broadleaf", icon: "🌳", label: "Tree" },
  { value: "conifer", icon: "🌲", label: "Pine" },
  { value: "palm", icon: "🌴", label: "Palm" },
  { value: "fruit", icon: "🍎", label: "Fruit tree" },
  { value: "bush", icon: "🫐", label: "Berry bush" },
  { value: "fern", icon: "🌿", label: "Fern" },
  { value: "cycad", icon: "🪴", label: "Cycad" },
  { value: "reeds", icon: "🌾", label: "Reeds" },
];
export const LAND_OPTS: Opt<LandOpt>[] = [
  { value: "water", icon: "💧", label: "Water" },
  { value: "rock", icon: "🪨", label: "Rock" },
  { value: "mud", icon: "🟤", label: "Mud" },
  { value: "grass", icon: "🟩", label: "Grass" },
];
export const WEATHER_OPTS: Opt<WeatherKind>[] = [
  { value: "clear", icon: "☀️", label: "Sun" },
  { value: "cloudy", icon: "⛅", label: "Clouds" },
  { value: "rain", icon: "🌦️", label: "Rain" },
  { value: "heavyRain", icon: "🌧️", label: "Downpour" },
  { value: "storm", icon: "⛈️", label: "Storm" },
  { value: "fog", icon: "🌫️", label: "Fog" },
  { value: "windy", icon: "💨", label: "Wind" },
  { value: "hot", icon: "🥵", label: "Heat" },
  { value: "snow", icon: "🌨️", label: "Snow" },
  { value: "blizzard", icon: "❄️", label: "Blizzard" },
];
export const DISASTER_OPTS: Opt<DisasterOpt>[] = [
  { value: "lightning", icon: "⚡", label: "Lightning" },
  { value: "meteor", icon: "☄️", label: "Meteor" },
  { value: "volcano", icon: "🌋", label: "Erupt!" },
  { value: "quake", icon: "🫨", label: "Quake" },
  { value: "raid", icon: "🥁", label: "Dino raid!" },
  { value: "dragon", icon: "🐉", label: "Dragon!" },
  { value: "supervolcano", icon: "☄️🌋", label: "SUPERVOLCANO" },
];
export const PEOPLE_OPTS: Opt<PeopleOpt>[] = [
  { value: "adult", icon: "🧔", label: "Cave person" },
  { value: "child", icon: "🧒", label: "Cave kid" },
];
export interface BuildDef extends Opt<BuildOpt> {
  cat: "homes" | "defense" | "work" | "land" | "wonders";
  cost: Cost;
  tech?: TechId;
  /** civilization research it needs */
  civ?: CivTechId;
  tip: string;
  /** drag to paint a line of them */
  line?: boolean;
  /** what it costs once the tribe builds it in stone (gates, stairs, towers) */
  stoneCost?: Cost;
}

const hutCost = () => SHELTER_STAGES.reduce<Cost>((c, s) => ({ ...c, [s.need]: (c[s.need] ?? 0) + s.n }), {});
const tentCost = () => TENT_STAGES.reduce<Cost>((c, s) => ({ ...c, [s.need]: (c[s.need] ?? 0) + s.n }), {});
const bld = (kind: BuildingKind, cat: BuildDef["cat"], line = false): BuildDef => ({ value: kind, icon: BUILDINGS[kind].icon, label: BUILDINGS[kind].name, cat, cost: BUILDINGS[kind].cost, tech: BUILDINGS[kind].tech, civ: BUILDINGS[kind].civ, tip: BUILDINGS[kind].tip, line });

export const BUILD_DEFS: BuildDef[] = [
  { value: "tent", icon: HOUSING[0].icon, label: "Tent", cat: "homes", cost: tentCost(), tip: `Quick shelter for ${HOUSING[0].cap}. Upgrade it later: tent → hut → house → stone house.` },
  { value: "hut", icon: HOUSING[2].icon, label: "Hut", cat: "homes", cost: hutCost(), tech: "axe", tip: `A wooden hut for ${HOUSING[2].cap}. Tap a finished home to upgrade it.` },
  { value: "campfire", icon: "🔥", label: "Campfire", cat: "homes", cost: { stick: 2 }, tech: "fire", tip: "Warmth, light and cooking. Scares small dinos. Once you can smelt iron, fires burn in iron baskets: safe on wooden decks + bridges." },
  bld("healer", "homes"),
  { value: "wall", icon: "🪵", label: "Wood wall", cat: "defense", cost: { stick: 2 }, tech: "palisade", tip: "Drag to draw. Dinos can't walk through (but can bash it).", line: true },
  { value: "stonewall", icon: "🧱", label: "Stone wall", cat: "defense", cost: { stone: 2 }, tech: "stonewall", tip: "Drag to draw. Much tougher. Draw over wood walls to upgrade them.", line: true },
  { value: "gate", icon: "🚪", label: "Gate", cat: "defense", cost: { wood: 2 }, stoneCost: { stone: 3 }, tech: "palisade", tip: "Put it in a wall. People use the side door; dinos only get through when it's open. Closes itself when danger comes." },
  { value: "bonegate", icon: "🦴", label: "Bone gate", cat: "defense", cost: { bone: 5 }, tech: "palisade", tip: "The grand entrance: giant crossed tusks, a dino rib-cage arch to walk through and bone doors that shut dinos out. Tap a gap, a wall or an old gate to put one in." },
  { value: "stairs", icon: "🪜", label: "Stairs", cat: "defense", cost: { stick: 2 }, stoneCost: { stone: 2 }, tech: "palisade", tip: "Next to a wall: lets people climb up and defend from the walkway." },
  { value: "tower", icon: "🗼", label: "Watchtower", cat: "defense", cost: { wood: 4, stone: 2 }, stoneCost: { stone: 8 }, tech: "tower", tip: "Guards climb up to see + shoot further. Joins up with walls. Once you know stone walls, towers go up in stone with a Scorpion on top: tap an old wooden tower with this to rebuild it in stone." },
  { value: "scorpion", icon: "🎯", label: "Scorpion", cat: "defense", cost: SCORPION_TIERS[0].cost, tech: "scorpion", tip: "A giant crossbow. Put it on a wall, a tower or the ground. Someone has to crew it." },
  bld("trap", "defense"),
  bld("spikes", "defense", true),
  bld("barricade", "defense", true),
  bld("totem", "defense"),
  { value: "farm", icon: "🌾", label: "Farm", cat: "work", cost: {}, tech: "farming", tip: "Farmers plant grass seed and harvest crops." },
  bld("storage", "work"),
  bld("foodStore", "work"),
  bld("waterStore", "work"),
  bld("well", "land"),
  bld("tannery", "work"),
  bld("workshop", "work"),
  bld("blacksmith", "work"),
  bld("refinery", "work"),
  bld("pen", "work"),
  bld("post", "work"),
  bld("path", "land", true),
  bld("boneTorch", "land", true),
  bld("bridge", "land", true),
  { value: "cleanMud", icon: "🧹", label: "Clean mud", cat: "land", cost: {}, tip: "Tap or drag over mud, swamp or bare dirt near camp to turn it into clean grass. The change is saved and stays clean.", line: true },
  // civilization projects (each needs its research)
  { value: "polywall", icon: "🔷", label: "Polygon wall", cat: "defense", cost: { shaped: 2 }, civ: "precisionStone", tip: "Drag to draw. Many-sided shaped blocks that lock together: the toughest wall. Draw over old walls to upgrade them (their materials come back).", line: true },
  { value: "polygate", icon: "⛩️", label: "Monumental gate", cat: "defense", cost: { shaped: 3 }, civ: "precisionStone", tip: "A shaped-stone gate. Put it in a wall (or draw over an old gate)." },
  bld("beamTower", "defense"),
  bld("pylon", "defense"),
  bld("shelterDeep", "wonders"),
  bld("resTable", "wonders"),
  bld("chamber", "wonders"),
  bld("shapingYard", "wonders"),
  bld("energyTower", "wonders"),
  bld("condenser", "wonders"),
  bld("obelisk", "wonders"),
  bld("stoneCircle", "wonders"),
  bld("levPad", "wonders"),
  { value: "levitate", icon: "🪶", label: "Levitate stone", cat: "wonders", cost: { shaped: LIFT.shaped }, civ: "levitation", tip: `Float a megalith from a Lift pad to anywhere in its range (${LIFT.cost} energy + ${LIFT.shaped} shaped stone). The ring shows how far each pad reaches.` },
  bld("pyramid", "wonders"),
  bld("resShield", "wonders"),
];

export const BUILD_BY_ID = Object.fromEntries(BUILD_DEFS.map((b) => [b.value, b])) as Record<BuildOpt, BuildDef>;

/** Has the tribe invented (and researched) everything this needs? */
export function buildUnlocked(b: BuildDef, learned: (t: TechId) => boolean, civ: (c: CivTechId) => boolean) {
  return (!b.tech || learned(b.tech)) && (!b.civ || civ(b.civ));
}

/** Old versions give way once a better one is known (best first): wood → stone → polygon walls, tents → huts. */
const BETTER: Partial<Record<BuildOpt, BuildOpt[]>> = {
  wall: ["polywall", "stonewall"],
  stonewall: ["polywall"],
  gate: ["polygate"],
  tent: ["hut"],
};

/** The version of this build option the tribe should actually make now. */
export function bestBuild(opt: BuildOpt, learned: (t: TechId) => boolean, civ: (c: CivTechId) => boolean): BuildOpt {
  for (const o of BETTER[opt] ?? []) if (buildUnlocked(BUILD_BY_ID[o], learned, civ)) return o;
  return opt;
}

/** Shown in the build menu: unlocked, and not replaced by a better version. */
export function buildVisible(b: BuildDef, learned: (t: TechId) => boolean, civ: (c: CivTechId) => boolean) {
  return buildUnlocked(b, learned, civ) && bestBuild(b.value, learned, civ) === b.value;
}

/** What it costs right now (gates, stairs + towers are stone once stone walls are known). */
export function buildCost(b: BuildDef, learned: (t: TechId) => boolean): Cost {
  return b.stoneCost && learned("stonewall") ? b.stoneCost : b.cost;
}
export const BUILD_OPTS: Opt<BuildOpt>[] = BUILD_DEFS;

export interface ToolDef {
  id: ToolId;
  icon: string;
  label: string;
  tip: string;
  /** drag keeps painting instead of panning */
  brush?: boolean;
}

export const TOOLS: ToolDef[] = [
  { id: "hand", icon: "✋", label: "Explore", tip: "Drag to look around. Tap things! Hold a dino to pick it up." },
  { id: "dino", icon: "🦖", label: "Dinos", tip: "Tap the ground to add a dinosaur" },
  { id: "egg", icon: "🥚", label: "Eggs", tip: "Place an egg and watch it hatch" },
  { id: "food", icon: "🍖", label: "Food", tip: "Drop food for hungry dinos" },
  { id: "plant", icon: "🌳", label: "Plants", tip: "Grow trees and bushes", brush: true },
  { id: "land", icon: "🏞️", label: "Land", tip: "Paint water, rocks, mud or grass", brush: true },
  { id: "fire", icon: "🔥", label: "Fire", tip: "Light a fire (careful!)", brush: true },
  { id: "weather", icon: "🌦️", label: "Weather", tip: "Change the weather" },
  { id: "disaster", icon: "💥", label: "Boom", tip: "Lightning, meteors, volcano, quakes" },
  { id: "people", icon: "🧔", label: "People", tip: "Add cave people (tap one to give them a job!)" },
  { id: "build", icon: "🛠️", label: "Build", tip: "Plan homes, walls, gates, towers, Scorpions + workshops. Drag to draw walls + paths!", brush: true },
  { id: "erase", icon: "🧽", label: "Erase", tip: "Remove things", brush: true },
];

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;

/** Icon + radius shown under the pointer for the active tool. */
export function toolCursor(t: ToolState): { icon: string; radius: number } | null {
  switch (t.id) {
    case "hand":
      return null;
    case "dino":
      return { icon: sp(t.species).emoji, radius: 30 };
    case "egg":
      return { icon: "🥚", radius: 16 };
    case "food":
      return { icon: FOOD_OPTS.find((o) => o.value === t.food)!.icon, radius: 14 };
    case "plant":
      return { icon: PLANT_OPTS.find((o) => o.value === t.plant)!.icon, radius: 18 };
    case "land":
      return { icon: LAND_OPTS.find((o) => o.value === t.land)!.icon, radius: TILE * 1.6 };
    case "fire":
      return { icon: "🔥", radius: 22 };
    case "weather":
      return null;
    case "disaster":
      return t.disaster === "lightning" ? { icon: "⚡", radius: 40 } : t.disaster === "meteor" ? { icon: "☄️", radius: 90 } : null;
    case "people":
      return { icon: PEOPLE_OPTS.find((o) => o.value === t.people)!.icon, radius: 16 };
    case "build":
      return { icon: BUILD_BY_ID[t.build].icon, radius: t.build === "cleanMud" ? TILE * 1.6 : BUILD_BY_ID[t.build].line || t.build === "gate" || t.build === "bonegate" || t.build === "stairs" || t.build === "scorpion" ? 16 : t.build === "farm" ? 38 : 30 };
    case "erase":
      return { icon: "🧽", radius: 28 };
  }
}

function paintTiles(w: World, x: number, y: number, r: number, fn: (t: T, tx: number, ty: number, d: number) => T | null) {
  const cx = Math.floor(x / TILE);
  const cy = Math.floor(y / TILE);
  const rr = Math.ceil(r);
  let n = 0;
  for (let ty = cy - rr; ty <= cy + rr; ty++) {
    for (let tx = cx - rr; tx <= cx + rr; tx++) {
      if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= 111) continue;
      const d = Math.hypot(tx + 0.5 - x / TILE, ty + 0.5 - y / TILE);
      if (d > r) continue;
      const t = w.terrain.tiles[ty * MAP_W + tx] as T;
      if (t === T.Mountain || t === T.Cliff || t === T.Cave || t === T.Volcano) continue;
      const next = fn(t, tx, ty, d);
      if (next !== null && next !== t) {
        w.terrain.setTile(tx, ty, next);
        n++;
      }
    }
  }
  return n;
}

let lastHint = 0;
function hint(w: World, icon: string, text: string) {
  if (w.elapsed - lastHint < 2.5) return;
  lastHint = w.elapsed;
  w.toast(icon, text);
}

/**
 * Apply the active tool at a world point. `drag` is true for brush strokes
 * after the first touch (so single-shot tools don't spam).
 */
export function applyTool(w: World, tool: ToolState, x: number, y: number, drag: boolean): boolean {
  const tile = w.terrain.tileAt(x, y);
  switch (tool.id) {
    case "dino": {
      if (drag) return false;
      if (!w.unlocked.has(tool.species)) {
        hint(w, "🔒", `Find a ${sp(tool.species).nick} in the world to unlock it!`);
        return false;
      }
      const d = w.spawnDino(tool.species, x, y);
      if (!d) hint(w, "🤔", sp(tool.species).move === "swim" ? "Mosasaurus needs deep water!" : "Can't put a dino there.");
      return !!d;
    }
    case "egg": {
      if (drag) return false;
      if (!isWalkTile(tile) || isWaterTile(tile)) return false;
      if (!w.unlocked.has(tool.egg)) {
        hint(w, "🔒", `Find a ${sp(tool.egg).nick} to unlock its eggs!`);
        return false;
      }
      if (sp(tool.egg).move === "swim") {
        hint(w, "🐋", "Fun fact: Mosasaurs gave birth to live babies — no eggs!");
        return false;
      }
      w.placeEgg(tool.egg, x, y);
      w.sfx("pop", x, y, 0.6);
      w.toast("🥚", `A ${sp(tool.egg).nick} egg! Watch it wobble…`);
      return true;
    }
    case "food": {
      if (drag) return false;
      if (!isWalkTile(tile) && tool.food !== "fish") return false;
      w.addItem(tool.food, x, y, { z: 50, vz: 0, amount: tool.food === "meat" ? 1.5 : 1 });
      w.sfx("plop", x, y, 0.6);
      return true;
    }
    case "plant": {
      if (!isWalkTile(tile) || isWaterTile(tile) || tile === T.Tar || tile === T.Basalt) {
        if (!drag) hint(w, "🌱", "Plants need soil to grow.");
        return false;
      }
      // brushes only plant if there's room
      let crowded = false;
      w.plantHash.each(x, y, drag ? 34 : 12, () => {
        crowded = true;
        return true;
      });
      if (crowded) return false;
      const p = makePlant(w, tool.plant, x, y, 0.25);
      w.plants.push(p);
      w.plantsDirty = true;
      w.particles.burst(P.Leaf, x, y, 4, 30, { z: 6, vz: 30, g: 60, size: 3, max: 0.8, color: "#6f9a3c" });
      w.sfx("rustle", x, y, 0.5);
      return true;
    }
    case "land": {
      const r = 1.6;
      let n = 0;
      if (tool.land === "water") {
        n = paintTiles(w, x, y, r, (t, _tx, _ty, d) => (t === T.Shallow && d < 0.9 ? T.Deep : isWaterTile(t) ? null : T.Shallow));
        w.fire.extinguish(w, x, y, TILE * 2.5);
        if (n) w.particles.burst(P.Splash, x, y, 8, 50, { vz: 60, g: 200, size: 2.5, max: 0.6 });
        if (n && !drag) w.sfx("splash", x, y, 0.7);
      } else if (tool.land === "mud") {
        n = paintTiles(w, x, y, r, (t) => (isWaterTile(t) ? null : T.Mud));
        if (n) w.particles.burst(P.Mud, x, y, 6, 40, { vz: 40, g: 160, size: 3, max: 0.6 });
      } else if (tool.land === "grass") {
        n = paintTiles(w, x, y, r, () => T.Grass);
        if (n) w.fire.extinguish(w, x, y, TILE * 2);
      } else {
        n = paintTiles(w, x, y, 1.1, (t) => (isWaterTile(t) ? null : T.Rock));
        if (!drag || w.rng() < 0.3) {
          w.addProp("boulder", x, y, 0.6 + w.rng() * 0.6);
          w.sfx("thud", x, y, 0.6);
          n++;
        }
      }
      if (n) w.fire.initFuel(w);
      return n > 0;
    }
    case "fire": {
      if (w.weather.rain > 0.5 && !drag) hint(w, "🌧️", "It's so wet the flames fizzle out! Try when it's dry.");
      const ok = w.fire.ignite(w, Math.floor(x / TILE), Math.floor(y / TILE), 0.8);
      if (!ok && !drag) hint(w, "🔥", "Nothing to burn here — try grass or trees.");
      if (ok) w.pois.push({ x, y, t: w.elapsed });
      return ok;
    }
    case "disaster": {
      if (drag) return false;
      if (tool.disaster === "raid") return false;
      if (tool.disaster === "lightning") w.lightning(x, y, true);
      else if (tool.disaster === "meteor") {
        if (w.meteors.length > 2) return false;
        w.meteor(x, y);
      }
      return true;
    }
    case "people": {
      if (drag) return false;
      if (!isWalkTile(tile) || isWaterTile(tile)) return false;
      if (w.humans.length >= MAX_PEOPLE) {
        hint(w, "🛖", "The camp is full!");
        return false;
      }
      const h = addHuman(w, x, y, tool.people === "child");
      h.bubble = { text: "Hello!", t: 2 };
      w.sfx("babble", x, y, 0.7);
      return true;
    }
    case "build":
      return build(w, tool, x, y, drag);
    case "erase":
      return erase(w, x, y, drag);
    default:
      return false;
  }
}

function build(w: World, tool: ToolState, x: number, y: number, drag: boolean): boolean {
  const c = w.camp;
  // an old option (wood wall, tent…) builds its better version once that's known
  const opt = bestBuild(tool.build, (t) => c.learned.has(t), (k) => w.civ.has(k));
  const def = BUILD_BY_ID[opt];
  // solid footing: dry land, or the deck of a finished bridge
  const footing = w.colony.footing(w, Math.floor(x / TILE), Math.floor(y / TILE));
  const near = Math.hypot(x - c.x, y - c.y) < 1600;
  if (!near) {
    if (!drag) hint(w, "🏕️", "Build closer to camp so the tribe can reach it.");
    return false;
  }
  if (def.tech && !c.learned.has(def.tech)) {
    if (!drag) hint(w, TECH[def.tech].icon, `The tribe needs to invent ${TECH[def.tech].name} first — open the camp's 💡 Invent tab!`);
    return false;
  }
  if (def.civ && !w.civ.has(def.civ)) {
    if (!drag) hint(w, CIV_TECH[def.civ].icon, `Research ${CIV_TECH[def.civ].name} first — open the 🏛️ Civilization panel!`);
    return false;
  }
  if (drag && !def.line) return false;
  switch (opt) {
    case "levitate": {
      if (drag) return false;
      const why = w.civ.levitate(w, x, y);
      if (why) hint(w, "🪶", why);
      return !why;
    }
    case "cleanMud": {
      const n = paintTiles(w, x, y, 1.6, (t) => (t === T.Mud || t === T.Swamp || t === T.Dirt ? T.Grass : null));
      if (n) {
        w.particles.burst(P.Leaf, x, y, 5, 30, { z: 6, vz: 25, g: 60, size: 3, max: 0.8, color: "#79ad58" });
        if (!drag) w.sfx("rustle", x, y, 0.4);
      } else if (!drag) hint(w, "🧹", "Tap mud, swamp or bare dirt near camp to clean it.");
      return n > 0;
    }
    case "bonegate": {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      const nb = [w.tribe.wallAt(tx, ty), w.tribe.wallAt(tx - 1, ty), w.tribe.wallAt(tx + 1, ty), w.tribe.wallAt(tx, ty - 1), w.tribe.wallAt(tx, ty + 1)].find((o) => o && o.part !== "stairs");
      const kind: WallKind = nb?.kind ?? (w.civ.polygonAge ? "polygon" : c.learned.has("stonewall") ? "stone" : "palisade");
      const ex = w.tribe.wallAt(tx, ty);
      if (ex?.bone || ex?.boneUp) {
        hint(w, "🦴", "That's already a bone gate.");
        return false;
      }
      const wl = w.tribe.planBoneGate(w, tx, ty, kind);
      if (wl) {
        w.sfx("knock", x, y, 0.4);
        w.toast("🦴", ex ? "Bone gate planned! Builders swap it in once they have 🦴 5 bones." : "Bone gate planned in the gap! Builders need 🦴 5 bones.", x, y);
      } else hint(w, "🦴", "A bone gate goes in a wall, an old gate or a gap between walls.");
      return !!wl;
    }
    case "wall":
    case "stonewall":
    case "polywall":
    case "polygate":
    case "gate":
    case "stairs": {
      // once stone walls are known everything here is built in stone
      const kind: WallKind = opt === "polywall" || opt === "polygate" ? "polygon" : opt === "stonewall" || c.learned.has("stonewall") ? "stone" : "palisade";
      const part = opt === "gate" || opt === "polygate" ? "gate" : opt === "stairs" ? "stairs" : "wall";
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (part === "stairs" && ![w.tribe.wallAt(tx + 1, ty), w.tribe.wallAt(tx - 1, ty), w.tribe.wallAt(tx, ty + 1), w.tribe.wallAt(tx, ty - 1)].some((o) => o && o.part !== "stairs")) {
        hint(w, "🪜", "Stairs go right next to a wall.");
        return false;
      }
      const wl = w.tribe.addWall(w, tx, ty, kind, part);
      if (wl && !drag) w.sfx("knock", x, y, 0.4);
      if (wl && part === "gate" && !w.flags.has("gateTip")) {
        w.flags.add("gateTip");
        w.toast("🚪", "Gate planned! Tap it once it's built to open or close it.", x, y);
      }
      return !!wl;
    }
    case "tower": {
      // tapping an old wooden tower rebuilds it in stone
      const old = w.tribe.towers.find((o) => x > o.tx * TILE - 6 && x < (o.tx + 2) * TILE + 6 && y > o.ty * TILE - 90 && y < (o.ty + 2) * TILE + 4);
      if (old) {
        if (drag) return false;
        if (w.tribe.upgradeTower(w, old)) {
          w.toast("🏰", "Builders will rebuild this tower in stone, with a Scorpion on top!", old.x, old.y);
          return true;
        }
        hint(w, "🗼", old.stone ? "That's already a stone tower." : old.stage < 3 ? "Let them finish building it first." : "Invent 🧱 Stone walls to rebuild towers in stone.");
        return false;
      }
      const t = w.tribe.addTower(w, x, y);
      if (t) w.toast(t.stone ? "🏰" : "🗼", t.stone ? "Stone tower planned! Builders will need stone. Walls can join right onto it." : "Tower planned! Builders will need wood + stone. Walls can join right onto it.");
      else hint(w, "🗼", "A tower needs 2×2 squares of solid ground or finished bridge deck, with nothing else on them (the green squares).");
      return !!t;
    }
    case "scorpion": {
      const s = w.colony.addScorpion(w, x, y);
      if (typeof s === "string") {
        hint(w, "🎯", s);
        return false;
      }
      w.toast("🎯", `Scorpion planned ${s.mount === "ground" ? "on the ground" : `on the ${s.mount}`}! Builders bring wood, sticks + stone.`, x, y);
      return true;
    }
    case "tent": {
      if (!footing) return false;
      if (w.colony.occupied(w).has(Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE))) return false;
      c.addShelter(w, x, y, "tent");
      w.toast("⛺", "Tent planned! Quick to build — upgrade it later.");
      return true;
    }
    case "farm": {
      const f = w.tribe.addFarm(w, x, y);
      if (f) w.toast("🌾", "New field! Farmers plant it with grass seeds.");
      else hint(w, "🌾", "Fields need open soil (and a little space).");
      return !!f;
    }
    case "hut": {
      if (!footing) return false;
      if (w.colony.occupied(w).has(Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE))) return false;
      c.addShelter(w, x, y);
      w.toast("🛖", "Hut planned! More homes = room for more people.");
      return true;
    }
    case "campfire": {
      if (!footing) return false;
      w.campfires.push({ id: w.nextId(), x, y, lit: true, fuel: 1, cook: 0 });
      w.sfx("ignite", x, y, 0.7);
      return true;
    }
    case "boneTorch": {
      // Brush strokes run every few pixels; space the actual lights along the route.
      const torches = w.colony.buildings.filter((b) => b.kind === "boneTorch" && b.hp > 0);
      if (torches.some((b) => Math.hypot(b.x - x, b.y - y) < 96)) return false;
      const b = w.colony.addBuilding(w, "boneTorch", x, y);
      if (!b) {
        if (!drag) hint(w, "🔥", w.colony.canPlace(w, "boneTorch", x, y) ?? "Choose open ground for a torch.");
        return false;
      }
      const stroke = torches.find((torch) => torch.id === w.trails.lastTorch);
      const nearest = drag && stroke ? stroke : torches.sort((a, other) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(other.x - b.x, other.y - b.y))[0];
      if (nearest) w.trails.connect(w, nearest.x, nearest.y, b.x, b.y);
      w.trails.lastTorch = b.id;
      if (!drag) w.toast("🔥", "Bone torch planned. Drag to string warm lights along a path. No energy needed.", b.x, b.y);
      return true;
    }
    default: {
      const kind = opt as BuildingKind;
      const why = w.colony.canPlace(w, kind, x, y);
      if (why) {
        if (!drag) hint(w, BUILDINGS[kind].icon, why);
        return false;
      }
      const b = w.colony.addBuilding(w, kind, x, y);
      if (b && !drag) w.toast(BUILDINGS[kind].icon, `${BUILDINGS[kind].name} planned! Builders are on it.`, b.x, b.y);
      return !!b;
    }
  }
}

function erase(w: World, x: number, y: number, drag: boolean) {
  const R = 28;
  const wl = w.tribe.wallAt(Math.floor(x / TILE), Math.floor(y / TILE));
  if (wl) {
    w.tribe.removeWall(wl);
    w.particles.burst(P.Dust, x, y, 5, 30, { size: 8, max: 0.6, color: "rgba(160,130,90,0.6)" });
    w.sfx("pop", x, y, 0.4);
    return true;
  }
  const tower = w.tribe.towers.find((t) => Math.hypot(t.x - x, t.y - 30 - y) < 40);
  if (tower && !drag) {
    w.tribe.towers.splice(w.tribe.towers.indexOf(tower), 1);
    w.tribe.version++;
    return true;
  }
  const sc = w.colony.scorpions.find((s) => Math.hypot(s.x - x, s.y - 8 - y) < 22);
  if (sc && !drag) {
    w.colony.scorpions.splice(w.colony.scorpions.indexOf(sc), 1);
    w.colony.version++;
    return true;
  }
  // things built on a bridge go before the bridge itself
  const hit = (bd: (typeof w.colony.buildings)[number]) => x > bd.tx * TILE && x < (bd.tx + BUILDINGS[bd.kind].w) * TILE && y > bd.ty * TILE - 24 && y < bd.y + 6;
  const onDeck = w.colony.bridgeAt(Math.floor(x / TILE), Math.floor(y / TILE)) && (w.shelters.some((s) => Math.hypot(s.x - x, s.y - 16 - y) < 40) || w.campfires.some((f) => Math.hypot(f.x - x, f.y - y) < R));
  const b = w.colony.buildings.find((bd) => bd.kind !== "bridge" && hit(bd)) ?? (onDeck ? undefined : w.colony.buildings.find(hit));
  if (b) {
    w.colony.removeBuilding(b);
    if (b.kind === "boneTorch") w.trails.disconnectTorch(w, b.x, b.y);
    w.particles.burst(P.Dust, b.x, b.y, 8, 40, { size: 9, max: 0.7, color: "rgba(160,130,90,0.6)" });
    w.sfx("pop", x, y, 0.4);
    return true;
  }
  const farm = w.tribe.farms.find((f) => Math.hypot(f.x - x, (f.y - y) * 1.6) < 40);
  if (farm && !drag) {
    w.tribe.farms.splice(w.tribe.farms.indexOf(farm), 1);
    return true;
  }
  const poof = (px: number, py: number) => {
    w.particles.burst(P.Poof, px, py, 6, 40, { size: 10, max: 0.6, color: "rgba(255,255,255,0.9)" });
    w.sfx("pop", px, py, 0.4);
  };
  const dino = w.dinos.find((d) => Math.hypot(d.x - x, d.y - d.z - y) < Math.max(R, sp(d.species).size * 0.4));
  if (dino && !drag) {
    w.removeDino(dino);
    poof(dino.x, dino.y);
    return true;
  }
  const egg = w.eggs.find((e) => Math.hypot(e.x - x, e.y - y) < R);
  if (egg) {
    w.eggs.splice(w.eggs.indexOf(egg), 1);
    poof(egg.x, egg.y);
    return true;
  }
  const item = w.items.find((i) => Math.hypot(i.x - x, i.y - y) < R);
  if (item) {
    w.removeItem(item);
    poof(item.x, item.y);
    return true;
  }
  const human = w.humans.find((h) => Math.hypot(h.x - x, h.y - 10 - y) < 16);
  if (human && !drag && w.humans.length > 2) {
    w.humans.splice(w.humans.indexOf(human), 1);
    poof(human.x, human.y);
    return true;
  }
  const fire = w.campfires.find((f) => Math.hypot(f.x - x, f.y - y) < R);
  if (fire) {
    w.campfires.splice(w.campfires.indexOf(fire), 1);
    poof(fire.x, fire.y);
    return true;
  }
  const shelter = w.shelters.find((s) => Math.hypot(s.x - x, s.y - 16 - y) < 40);
  if (shelter && !drag) {
    w.shelters.splice(w.shelters.indexOf(shelter), 1);
    w.shelterVersion++;
    for (const h of w.humans) if (h.home === shelter.id) h.home = 0;
    poof(shelter.x, shelter.y);
    return true;
  }
  const boulder = w.props.find((p) => p.kind === "boulder" && Math.hypot(p.x - x, p.y - y) < R);
  if (boulder) {
    w.props.splice(w.props.indexOf(boulder), 1);
    poof(boulder.x, boulder.y);
    return true;
  }
  let plant: (typeof w.plants)[number] | null = null;
  w.plantHash.each(x, y, R, (p) => {
    plant = p;
    return true;
  });
  if (plant) {
    w.plants.splice(w.plants.indexOf(plant), 1);
    w.plantsDirty = true;
    poof(x, y);
    return true;
  }
  // nothing there: undo terrain painting + douse fire
  const n = paintTiles(w, x, y, 1.4, (_t, tx, ty) => w.terrain.base[ty * MAP_W + tx] as T);
  w.fire.extinguish(w, x, y, TILE * 1.5);
  if (n) w.fire.initFuel(w);
  return n > 0;
}
