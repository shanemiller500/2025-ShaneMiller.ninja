/* ------------------------------------------------------------------ */
/*  The toy box. Tool + option definitions (for the UI) and what each  */
/*  one does when it touches the world (for the engine).               */
/* ------------------------------------------------------------------ */
import { TECH } from "../data/facts";
import { sp } from "../data/species";
import { addHuman } from "../sim/humans";
import { P } from "../sim/particles";
import { makePlant } from "../sim/plants";
import { isWaterTile, isWalkTile } from "../sim/terrain";
import { MAP_W, T, TILE, type PlantKind, type SpeciesId, type WeatherKind } from "../sim/types";
import type { World } from "../sim/world";

export type ToolId = "hand" | "dino" | "egg" | "food" | "plant" | "land" | "fire" | "weather" | "disaster" | "people" | "build" | "erase";
export type FoodOpt = "meat" | "fish" | "fruit" | "berries";
export type LandOpt = "water" | "rock" | "mud" | "grass";
export type DisasterOpt = "lightning" | "meteor" | "volcano" | "quake" | "raid";
export type PeopleOpt = "adult" | "child";
export type BuildOpt = "hut" | "wall" | "stonewall" | "tower" | "farm" | "campfire";

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
];
export const DISASTER_OPTS: Opt<DisasterOpt>[] = [
  { value: "lightning", icon: "⚡", label: "Lightning" },
  { value: "meteor", icon: "☄️", label: "Meteor" },
  { value: "volcano", icon: "🌋", label: "Erupt!" },
  { value: "quake", icon: "🫨", label: "Quake" },
  { value: "raid", icon: "🥁", label: "Dino raid!" },
];
export const PEOPLE_OPTS: Opt<PeopleOpt>[] = [
  { value: "adult", icon: "🧔", label: "Cave person" },
  { value: "child", icon: "🧒", label: "Cave kid" },
];
export const BUILD_OPTS: Opt<BuildOpt>[] = [
  { value: "wall", icon: "🪵", label: "Wood wall" },
  { value: "stonewall", icon: "🧱", label: "Stone wall" },
  { value: "tower", icon: "🗼", label: "Watchtower" },
  { value: "hut", icon: "🛖", label: "Hut" },
  { value: "farm", icon: "🌾", label: "Farm" },
  { value: "campfire", icon: "🔥", label: "Campfire" },
];

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
  { id: "build", icon: "🛠️", label: "Build", tip: "Plan walls, towers, huts + farms. Drag to draw walls!", brush: true },
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
      return { icon: BUILD_OPTS.find((o) => o.value === t.build)!.icon, radius: t.build === "wall" || t.build === "stonewall" ? 16 : t.build === "farm" ? 38 : 30 };
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
      if (w.humans.length >= 30) {
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
  const tile = w.terrain.tileAt(x, y);
  const near = Math.hypot(x - c.x, y - c.y) < 1100;
  if (!near) {
    if (!drag) hint(w, "🏕️", "Build close to the cave camp so the tribe can reach it.");
    return false;
  }
  switch (tool.build) {
    case "wall":
    case "stonewall": {
      const kind = tool.build === "wall" ? "palisade" : "stone";
      const tech = kind === "palisade" ? "palisade" : "stonewall";
      if (!c.learned.has(tech)) {
        hint(w, TECH[tech].icon, `The tribe needs to invent ${TECH[tech].name} first — tap the camp to choose it!`);
        return false;
      }
      const wl = w.tribe.addWall(w, Math.floor(x / TILE), Math.floor(y / TILE), kind);
      if (wl && !drag) w.sfx("knock", x, y, 0.4);
      return !!wl;
    }
    case "tower": {
      if (drag) return false;
      if (!c.learned.has("tower")) {
        hint(w, "🗼", "Invent the Watchtower first — tap the camp to choose it!");
        return false;
      }
      const t = w.tribe.addTower(w, x, y);
      if (t) w.toast("🗼", "Tower planned! Builders will need wood + stone.");
      return !!t;
    }
    case "farm": {
      if (drag) return false;
      if (!c.learned.has("farming")) {
        hint(w, "🌾", "Invent Farming first — tap the camp to choose it!");
        return false;
      }
      const f = w.tribe.addFarm(w, x, y);
      if (f) w.toast("🌾", "New field! Farmers plant it with grass seeds.");
      else hint(w, "🌾", "Fields need open soil (and a little space).");
      return !!f;
    }
    case "hut": {
      if (drag) return false;
      if (!isWalkTile(tile) || isWaterTile(tile)) return false;
      c.addShelter(w, x, y);
      if (!c.learned.has("axe")) hint(w, "🪓", `They'll need a ${TECH.axe.name} to chop wood for the frame!`);
      else w.toast("🛖", "Hut planned! More huts = room for more babies.");
      return true;
    }
    case "campfire": {
      if (drag) return false;
      if (!c.learned.has("fire")) {
        hint(w, "🔥", "The cave people haven't discovered fire yet! Tap their camp to help.");
        return false;
      }
      if (!isWalkTile(tile) || isWaterTile(tile)) return false;
      w.campfires.push({ id: w.nextId(), x, y, lit: true, fuel: 1, cook: 0 });
      w.sfx("ignite", x, y, 0.7);
      return true;
    }
  }
  return false;
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
