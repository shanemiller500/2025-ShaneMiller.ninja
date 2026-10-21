/* ------------------------------------------------------------------ */
/*  Dragon nests + eggs (fantasy!).                                    */
/*                                                                     */
/*  A couple of nests sit in the most remote mountain, cliff and       */
/*  volcanic country. A wild dragon lives at each: it perches there,   */
/*  hunts, guards its eggs and treasure, and chases anyone who steals  */
/*  one. Nests are hidden until someone gets close (people, a flying   */
/*  scout team, one of our dragons) or tracks the dragon home.         */
/*                                                                     */
/*  An egg the tribe brings home only hatches if it's kept warm: a     */
/*  fuelled incubation shelter, a lit campfire, or hot volcanic rock.  */
/*  Let it go cold and it's lost.                                      */
/* ------------------------------------------------------------------ */
import { BREED_LIST, BREEDS, DRAGON_NAMES, INCUBATE_SECONDS, type DragonBreed } from "../data/dragons";
import { go, say } from "./humans";
import { P } from "./particles";
import { makeRng, pick } from "./rng";
import { MAP_H, MAP_W, T, TILE, type Dragon, type DragonEgg, type DragonNest, type Human, type Resource } from "./types";
import type { World } from "./world";
import { newDragonStats } from "./dragonKeep";
import { keeperAtHatch, keeperOf, makeKeeper } from "./keepers";

/** Nests per world. */
const NESTS = 2;
/** People this close to a hidden nest find it. */
const SEE_NEST = 380;
/** A nest with fewer eggs than this gets another every so often. */
const MAX_EGGS = 6;
/** Seconds between eggs. */
const LAY_EVERY = 900;
/** Seconds before a new dragon moves into a nest whose parent was driven off. */
const EMPTY_FOR = 1100;
/** Wild dragons take a while to settle in (the world is quiet at first). */
const SETTLE_AT = 420;

const ROCKY = new Set<T>([T.Mountain, T.Cliff, T.Volcano, T.Basalt, T.Rock]);
const HOT = new Set<T>([T.Volcano, T.Basalt]);

/* ------------------------------ placing nests ------------------------------ */

/** Pick remote, rocky, reachable spots for the nests (once per world). */
export function seedNests(w: World) {
  const ds = w.dragons;
  ds.seeded = true;
  // nests + eggs roll their own dice, so adding them never changes the rest of the world's luck
  ds.rng = makeRng(w.seed * 31 + 7);
  if (ds.nests.length) return;
  const tiles = w.terrain.tiles;
  const cands: { x: number; y: number; score: number; hot: boolean; rocky: number }[] = [];
  for (let ty = 5; ty < MAP_H - 5; ty += 2) {
    for (let tx = 5; tx < MAP_W - 5; tx += 2) {
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      if (!w.nav.passable("human", x, y)) continue;
      const t = tiles[ty * MAP_W + tx];
      if (t === T.Shallow || t === T.River || t === T.Swamp) continue;
      let rocky = 0;
      let hot = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const n = tiles[(ty + dy) * MAP_W + tx + dx];
        if (ROCKY.has(n)) rocky++;
        if (HOT.has(n)) hot++;
      }
      const far = Math.hypot(x - w.camp.x, y - w.camp.y);
      if (far < 1300 || rocky < 5) continue;
      cands.push({ x, y, score: far * 0.6 + rocky * 70 + hot * 40, hot: hot >= 3, rocky });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  // fall back to any far-off ground (a remote plateau) on very flat maps
  if (!cands.length) {
    for (let k = 0; k < 400 && cands.length < 6; k++) {
      const x = 200 + w.dragons.rng() * (MAP_W * TILE - 400);
      const y = 200 + w.dragons.rng() * (MAP_H * TILE - 400);
      if (w.nav.passable("human", x, y) && Math.hypot(x - w.camp.x, y - w.camp.y) > 1500) cands.push({ x, y, score: 0, hot: false, rocky: 0 });
    }
  }
  for (const c of cands) {
    if (ds.nests.length >= NESTS) break;
    if (ds.nests.some((n) => Math.hypot(n.x - c.x, n.y - c.y) < 1300)) continue;
    const breed: DragonBreed = c.hot ? (w.dragons.rng() < 0.75 ? "fire" : "heavy") : weightedBreed(w, ["mountain", "swift", "fire", "heavy"]);
    const site = c.hot ? "volcanic" : c.rocky >= 16 ? "peak" : c.rocky >= 10 ? "cliff" : c.rocky ? "plateau" : "plateau";
    const nest: DragonNest = {
      id: w.dragons.nextId(),
      x: c.x,
      y: c.y,
      breed,
      site,
      found: false,
      parent: 0,
      loot: nestLoot(w, c.hot),
      layT: LAY_EVERY * (0.5 + w.dragons.rng()),
      emptyT: SETTLE_AT + w.dragons.rng() * 200,
    };
    ds.nests.push(nest);
    // a clutch of three to start with (rarely a golden-flecked one)
    for (let i = 0; i < 3; i++) layEgg(w, nest);
  }
}

function weightedBreed(w: World, from: DragonBreed[]) {
  const total = from.reduce((s, b) => s + BREEDS[b].weight, 0);
  let r = w.dragons.rng() * total;
  for (const b of from) {
    r -= BREEDS[b].weight;
    if (r <= 0) return b;
  }
  return from[0];
}

function nestLoot(w: World, hot: boolean): Partial<Record<Resource, number>> {
  const loot: Partial<Record<Resource, number>> = { bone: 4 + Math.floor(w.dragons.rng() * 5), gold: 1 + Math.floor(w.dragons.rng() * 3) };
  if (w.dragons.rng() < 0.7) loot.crystal = 1 + Math.floor(w.dragons.rng() * 2);
  if (hot) loot.obsidian = 2 + Math.floor(w.dragons.rng() * 3);
  else if (w.dragons.rng() < 0.6) loot.silver = 1 + Math.floor(w.dragons.rng() * 2);
  if (w.dragons.rng() < 0.35) loot.meteorite = 1;
  if (w.dragons.rng() < 0.5) loot.hide = 2;
  return loot;
}

/** Where egg number i sits in a nest. */
/** Where egg number i sits: three in the first bowl, three more in the nest joined on beside it. */
export const eggSpot = (nest: DragonNest, i: number) => {
  const bowl = Math.floor(i / 3);
  const j = i % 3;
  return { x: nest.x - 10 + j * 14 + bowl * NEST_JOIN.x, y: nest.y + 2 + (j % 2) * 4 + bowl * NEST_JOIN.y };
};
/** Where the second, joined-on nest sits. */
export const NEST_JOIN = { x: 62, y: -10 };
/** Eggs a nest holds (3 per bowl). */
export const nestCapacity = (nest: DragonNest) => 3 * (nest.size ?? 1);
/** How long a parent is expecting (and building up its nest). */
export const GRAVID_SECONDS = 240;

export function nestEggs(w: World, nest: DragonNest) {
  return w.dragons.eggs.filter((e) => e.at === "nest" && e.nest === nest.id);
}

export function layEgg(w: World, nest: DragonNest) {
  const i = nestEggs(w, nest).length;
  if (i >= 3) nest.size = Math.max(nest.size ?? 1, 2);
  const spot = eggSpot(nest, i);
  const egg: DragonEgg = {
    id: w.dragons.nextId(),
    breed: w.dragons.rng() < 0.8 ? nest.breed : pick(w.dragons.rng, BREED_LIST).id,
    x: spot.x,
    y: spot.y,
    at: "nest",
    nest: nest.id,
    carrier: 0,
    heat: 1,
    progress: w.dragons.rng() * 0.15,
    health: 1,
    rare: w.dragons.rng() < 0.12,
    hatchT: 0,
  };
  w.dragons.eggs.push(egg);
  return egg;
}

/* ------------------------------ the wild parents ------------------------------ */

/** A wild dragon that lives at this nest (perched on it). */
function settleParent(w: World, nest: DragonNest) {
  const def = BREEDS[nest.breed];
  const dr: Dragon = {
    id: w.dragons.nextId(),
    kind: "dragon",
    name: pick(w.dragons.rng, DRAGON_NAMES),
    x: nest.x + 30,
    y: nest.y - 10,
    z: 0,
    vx: 0,
    vy: 0,
    dir: w.dragons.rng() < 0.5 ? 1 : -1,
    hp: def.hp,
    maxHp: def.hp,
    state: "perch",
    t: w.dragons.rng() * 40,
    target: 0,
    tx: nest.x,
    ty: nest.y,
    breath: 0,
    anim: 0,
    hue: 0,
    passes: 0,
    hit: 0,
    breed: nest.breed,
    nest: nest.id,
    growth: 1,
  };
  w.dragons.list.push(dr);
  nest.parent = dr.id;
  return dr;
}

/** Nests that still have eggs but no dragon left to guard them. */
export function orphanNests(w: World) {
  return w.dragons.nests.filter((n) => !parentOf(w, n) && nestEggs(w, n).length > 0);
}

/**
 * Send a new dragon to take over an orphaned nest. It's made the same way as any dragon that settles
 * a nest (its own id range + the dragons' own dice, so nothing else in the world shifts; the breed of
 * the eggs it finds), and flies in from the nearest edge of the map to adopt them.
 */
export function claimNest(w: World, nest: DragonNest): Dragon | null {
  if (parentOf(w, nest) || !nestEggs(w, nest).length) return null;
  const dr = settleParent(w, nest);
  const W = MAP_W * TILE;
  const H = MAP_H * TILE;
  const sides = [{ x: -200, y: nest.y }, { x: W + 200, y: nest.y }, { x: nest.x, y: -200 }, { x: nest.x, y: H + 200 }];
  const from = sides.sort((a, b) => Math.hypot(a.x - nest.x, a.y - nest.y) - Math.hypot(b.x - nest.x, b.y - nest.y))[0];
  dr.x = from.x + (w.dragons.rng() - 0.5) * 300;
  dr.y = from.y + (w.dragons.rng() - 0.5) * 300;
  dr.z = 260;
  dr.dir = nest.x > dr.x ? 1 : -1;
  dr.state = "home";
  dr.t = 0;
  w.toast("🐉", `A ${BREEDS[nest.breed].name.toLowerCase()}, ${dr.name}, is flying in to take over the ${nest.found ? "" : "hidden "}nest and its ${nestEggs(w, nest).length} egg${nestEggs(w, nest).length > 1 ? "s" : ""}. It'll guard them as its own.`, nest.x, nest.y);
  return dr;
}

/** The parent at its nest (if it's alive and still lives here). */
export function parentOf(w: World, nest: DragonNest) {
  const dr = nest.parent ? w.dragons.byId(nest.parent) : null;
  return dr && dr.nest === nest.id ? dr : null;
}

/** A wild resident dragon is gone (driven off / killed): the nest stands empty for a while. */
export function nestLost(w: World, dr: Dragon) {
  const nest = w.dragons.nests.find((n) => n.id === dr.nest);
  if (!nest || nest.parent !== dr.id) return;
  nest.parent = 0;
  nest.emptyT = EMPTY_FOR;
  if (nest.found) w.toast("🪺", `${dr.name} has abandoned its nest. Its eggs are unguarded… for now.`, nest.x, nest.y);
}

/* ------------------------------ per frame ------------------------------ */

export function nestsUpdate(w: World, dt: number) {
  const ds = w.dragons;
  if (!ds.seeded) seedNests(w);
  // (older saves) every nest starts with its clutch of three
  if (!ds.topped) {
    ds.topped = true;
    for (const nest of ds.nests) while (nestEggs(w, nest).length < 3) layEgg(w, nest);
  }
  ds.seeT -= dt;
  const look = ds.seeT <= 0;
  if (look) ds.seeT = 1;
  for (const nest of ds.nests) {
    // a parent moves in (or back in)
    if (!parentOf(w, nest)) {
      nest.parent = 0;
      nest.emptyT -= dt;
      if (nest.emptyT <= 0 && w.elapsed > SETTLE_AT) settleParent(w, nest);
    } else {
      const parent = parentOf(w, nest)!;
      if ((nest.gravid ?? 0) > 0) {
        // expecting: the nest grows as it builds (fetching branches, see dragons.ts), then it lays
        nest.gravid = (nest.gravid ?? 0) - dt;
        nest.grow = Math.min(1, (nest.grow ?? 1) + dt / GRAVID_SECONDS);
        parent.gravid = true;
        if ((nest.gravid ?? 0) <= 0) layClutch(w, nest);
      } else {
        parent.gravid = false;
        nest.layT -= dt;
        if (nest.layT <= 0) {
          nest.layT = LAY_EVERY * (0.8 + w.dragons.rng() * 0.6);
          if (nestEggs(w, nest).length < MAX_EGGS) startGravid(w, nest);
        }
      }
    }
    if (look && !nest.found) spotNest(w, nest);
  }
  for (const egg of [...ds.eggs]) eggTick(w, egg, dt);
}

/** The parent is expecting: it starts building up the nest (a bigger, joined one if eggs are already there). */
function startGravid(w: World, nest: DragonNest) {
  const have = nestEggs(w, nest).length;
  nest.clutch = 3;
  nest.gravid = GRAVID_SECONDS * (0.85 + w.dragons.rng() * 0.3);
  // building from scratch (an empty nest) or adding a second bowl beside the full one
  nest.grow = have ? 0 : 0.25;
  if (have + 3 > 3) nest.size = 2;
  const p = parentOf(w, nest);
  if (p) p.gravid = true;
  if (nest.found && p) w.toast("🪺", `${p.name} is expecting and building up its nest${have ? " (a second nest joined on!)" : ""}: a clutch of eggs is coming.`, nest.x, nest.y);
}

/** Lay the clutch. */
function layClutch(w: World, nest: DragonNest) {
  const n = Math.min(nest.clutch ?? 3, MAX_EGGS - nestEggs(w, nest).length);
  for (let i = 0; i < n; i++) layEgg(w, nest);
  nest.gravid = 0;
  nest.grow = 1;
  const p = parentOf(w, nest);
  if (p) p.gravid = false;
  if (nest.found && n > 0) w.toast("🥚", `${n} new dragon egg${n > 1 ? "s" : ""} in ${p?.name ?? "the"}${p ? "'s" : ""} nest!`, nest.x, nest.y);
}

/** The Eggs tool: a dragon egg. Near a nest it goes in the nest (a second nest joins on past 3); elsewhere it sits where it's put. */
export function placeDragonEgg(w: World, breed: DragonEgg["breed"], x: number, y: number) {
  const nest = w.dragons.nests.find((n) => Math.hypot(n.x - x, n.y - y) < 140);
  if (nest) {
    if (nestEggs(w, nest).length >= MAX_EGGS) return "That nest is full (six eggs).";
    const egg = layEgg(w, nest);
    egg.breed = breed;
    return null;
  }
  const egg: DragonEgg = { id: w.dragons.nextId(), breed, x, y, at: "camp", nest: 0, carrier: 0, heat: 0.5, progress: 0, health: 1, rare: w.dragons.rng() < 0.12, hatchT: 0 };
  w.dragons.eggs.push(egg);
  return null;
}

/** Does anyone see this hidden nest? */
function spotNest(w: World, nest: DragonNest) {
  let who: string | null = null;
  for (const h of w.humans) {
    if (h.under || h.stranger || h.captive) continue;
    if (Math.hypot(h.x - nest.x, h.y - nest.y) < SEE_NEST) {
      who = h.name;
      break;
    }
  }
  if (!who) for (const d of w.dinos) {
    if (d.owner && d.work?.partner && d.z > 20 && Math.hypot(d.x - nest.x, d.y - nest.y) < SEE_NEST * 1.4) {
      who = `${d.name}'s rider`;
      break;
    }
  }
  if (!who) for (const dr of w.dragons.owned) {
    if (Math.hypot(dr.x - nest.x, dr.y - nest.y) < SEE_NEST * 1.6) {
      who = dr.rider ? w.humans.find((h) => h.id === dr.rider)?.name ?? dr.name : dr.name;
      break;
    }
  }
  if (who) revealNest(w, nest, who);
}

export function revealNest(w: World, nest: DragonNest, who: string) {
  if (nest.found) return;
  nest.found = true;
  const eggs = nestEggs(w, nest).length;
  w.toast("🪺", `${who} found a ${BREEDS[nest.breed].name.toLowerCase()}'s nest${nest.site === "volcanic" ? " on a volcanic ridge" : nest.site === "peak" ? " high on a peak" : nest.site === "cliff" ? " on a cliff ledge" : ""}! ${eggs ? `${eggs} egg${eggs > 1 ? "s" : ""}, and treasure.` : "Treasure, but no eggs right now."} Select armed people and tap it to steal an egg.`, nest.x, nest.y);
  w.discover("dragonNest", nest.x, nest.y);
  w.pois.push({ x: nest.x, y: nest.y, t: w.elapsed });
}

/* ------------------------------ eggs ------------------------------ */

/** How warm the spot an egg sits at is (0..1), and whether it has a roof. */
export function eggWarmth(w: World, x: number, y: number) {
  let heat = 0.15;
  let src = "nothing";
  const hatch = w.colony.buildings.find((b) => b.kind === "hatchery" && b.built >= 1 && Math.hypot(b.x - x, b.y - y) < 60);
  if (hatch && (w.dragons.fuel[hatch.id] ?? 0) > 0) {
    heat = 0.95;
    src = "the incubation shelter";
  }
  if (heat < 0.7) {
    const fire = w.campfires.find((f) => f.lit && Math.hypot(f.x - x, f.y - y) < 80);
    if (fire) {
      heat = 0.68;
      src = "the campfire";
    }
  }
  if (heat < 0.8) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    for (let dy = -2; dy <= 2 && heat < 0.8; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = (ty + dy) * MAP_W + tx + dx;
      if (i >= 0 && i < w.terrain.tiles.length && HOT.has(w.terrain.tiles[i])) {
        heat = 0.8;
        src = "the hot volcanic rock";
        break;
      }
    }
  }
  // cold weather + rain steal heat (an incubation shelter has a roof)
  if (!hatch) heat -= w.weather.rain * 0.25 + w.weather.snow * 0.3;
  heat -= Math.max(0, 0.4 - w.weather.temp) * 0.3;
  return { heat: Math.max(0, Math.min(1, heat)), src, hatchery: hatch ?? null };
}

function eggTick(w: World, egg: DragonEgg, dt: number) {
  switch (egg.at) {
    case "nest":
      egg.heat = 1;
      egg.health = Math.min(1, egg.health + dt * 0.01);
      return;
    case "carried": {
      const h = w.humans.find((x) => x.id === egg.carrier);
      if (!h || (h.egg !== egg.id && h.egg2 !== egg.id) || h.state === "down" || h.captive || h.under) {
        dropEgg(w, egg, h ?? null);
        return;
      }
      egg.x = h.x + h.dir * 6;
      egg.y = h.y;
      egg.heat = Math.max(0.3, egg.heat - dt * 0.002);
      return;
    }
    case "ground":
      egg.heat = Math.max(0, egg.heat - dt * 0.01);
      if (egg.heat < 0.3) egg.health -= dt * 0.002;
      if (egg.health <= 0) loseEgg(w, egg, "went cold out in the wild");
      return;
    case "camp": {
      if (egg.hatchT > 0) {
        egg.hatchT -= dt;
        if (w.dragons.rng() < dt * 6) w.particles.spawn(P.Crumb, egg.x + (w.dragons.rng() - 0.5) * 14, egg.y - 8, { z: 10, vz: 50, vx: (w.dragons.rng() - 0.5) * 50, g: 200, size: 2.5, max: 0.6, color: BREEDS[egg.breed].look.egg });
        if (egg.hatchT <= 0) hatch(w, egg);
        return;
      }
      const warm = eggWarmth(w, egg.x, egg.y);
      egg.heat += (warm.heat - egg.heat) * Math.min(1, dt * 0.05);
      const tended = w.humans.some((h) => h.state === "dragonCare" && h.targetId === egg.id);
      const rate = egg.heat >= 0.6 ? 1 : egg.heat >= 0.45 ? 0.4 : 0;
      egg.progress = Math.min(1, egg.progress + (dt / INCUBATE_SECONDS) * rate * (tended ? 1.3 : 1));
      if (egg.heat < 0.3) egg.health -= dt * 0.0025;
      else if (egg.heat > 0.55) egg.health = Math.min(1, egg.health + dt * 0.001);
      if (egg.health <= 0.25 && !w.flags.has(`eggCold${egg.id}`)) {
        w.flags.add(`eggCold${egg.id}`);
        w.toast("🥶", "A dragon egg is getting dangerously cold! Keep it by a fire or in a fuelled incubation shelter.", egg.x, egg.y);
      }
      if (egg.health <= 0) {
        loseEgg(w, egg, "went cold");
        return;
      }
      if (egg.progress >= 1) {
        egg.hatchT = 3.2;
        w.sfx("crack", egg.x, egg.y, 1, 1.2);
        w.toast("🥚", "The dragon egg is hatching!", egg.x, egg.y);
      }
      // the incubation shelter burns fuel while an egg is in it
      if (warm.hatchery) w.dragons.fuel[warm.hatchery.id] = Math.max(0, (w.dragons.fuel[warm.hatchery.id] ?? 0) - dt);
      return;
    }
  }
}

export function dropEgg(w: World, egg: DragonEgg, h: Human | null) {
  if (h && h.egg === egg.id) h.egg = h.egg2;
  if (h && (h.egg === egg.id || h.egg2 === egg.id)) h.egg2 = undefined;
  egg.at = "ground";
  egg.carrier = 0;
  w.toast("🥚", `${h ? h.name : "Someone"} dropped the dragon egg!`, egg.x, egg.y);
}

function loseEgg(w: World, egg: DragonEgg, why: string) {
  w.dragons.eggs.splice(w.dragons.eggs.indexOf(egg), 1);
  w.particles.burst(P.Poof, egg.x, egg.y, 8, 40, { size: 8, max: 0.8, color: "rgba(200,200,210,0.8)" });
  w.toast("💔", `A dragon egg ${why}. It won't hatch now.`, egg.x, egg.y);
}

/** The shell breaks: a baby dragon of our very own. */
export function hatch(w: World, egg: DragonEgg) {
  const ds = w.dragons;
  ds.eggs.splice(ds.eggs.indexOf(egg), 1);
  const def = BREEDS[egg.breed];
  const used = new Set([...ds.owned, ...ds.list].map((d) => d.name));
  const name = DRAGON_NAMES.find((n) => !used.has(n) && w.dragons.rng() < 0.5) ?? pick(w.dragons.rng, DRAGON_NAMES);
  const dr: Dragon = {
    id: w.dragons.nextId(),
    kind: "dragon",
    name,
    x: egg.x,
    y: egg.y + 4,
    z: 0,
    vx: 0,
    vy: 0,
    dir: 1,
    hp: 1,
    maxHp: 1,
    state: "play",
    t: 0,
    target: 0,
    tx: egg.x,
    ty: egg.y,
    breath: 0,
    anim: 0,
    hue: 0,
    passes: 0,
    hit: 0,
    breed: egg.breed,
    owner: true,
    age: 0,
    growth: 0,
    skills: {},
    lesson: null,
    stamina: 1,
    energy: 1,
    hunger: 0.4,
    fireCd: 0,
    burst: 0,
    cmd: null,
    auto: true,
    rare: egg.rare,
  };
  // no two alike: its own shade of the breed's colours, its own markings + eyes (the dragons' own dice)
  dr.tint = Math.round((ds.rng() - 0.5) * 70);
  dr.marks = Math.floor(ds.rng() * 4) as Dragon["marks"];
  dr.eye = pick(ds.rng, ["#9be36b", "#ffd23f", "#5ad1ff", "#ff8a3d", "#c38bff", "#ff5d7a"]);
  newDragonStats(dr);
  ds.owned.push(dr);
  keeperAtHatch(w, egg, dr);
  dr.hatchedBy = dr.keeper;
  w.events.push({ type: "hatched", dragon: dr.id });
  // hatched from a stolen egg, and the parent is still out there: it will never forgive this
  const from = egg.nest ? ds.nests.find((n) => n.id === egg.nest) : null;
  if (from) {
    dr.fromNest = from.id;
    const parent = parentOf(w, from);
    if (parent && !parent.fury) {
      parent.fury = true;
      parent.furyT = 150;
      parent.waves = 0;
      newDragonStats(parent);
      w.sfx("screech", w.camp.x, w.camp.y, 1.4, 0.3);
      w.toast("😡", `Far away, ${parent.name} lets out a terrible roar. It knows its egg hatched here. It's growing bigger, and it's coming for the town…`, w.camp.x, w.camp.y);
    }
  }
  w.particles.burst(P.Poof, egg.x, egg.y, 14, 70, { size: 10, max: 1, color: "rgba(255,240,220,0.9)" });
  w.particles.burst(P.Star, egg.x, egg.y, 10, 60, { z: 14, size: 6, max: 1.2 });
  for (let i = 0; i < 10; i++) w.particles.spawn(P.Crumb, egg.x, egg.y - 8, { z: 12, vz: 70 + w.dragons.rng() * 60, vx: (w.dragons.rng() - 0.5) * 120, g: 240, size: 3, max: 1, color: i % 2 ? def.look.egg : def.look.spots });
  w.sfx("crack", egg.x, egg.y, 1.2, 1);
  w.sfx("screech", egg.x, egg.y, 0.5, 2.2);
  w.toast("🐣", `A ${def.name.toLowerCase()} hatched${egg.rare ? " from a golden-flecked egg" : ""}! Meet ${name}. An animal trainer will feed it, calm it and start its lessons.`, egg.x, egg.y);
  w.discover("dragonHatch", egg.x, egg.y);
  w.celebrate("A baby dragon!");
  return dr;
}

/** Where a carried egg should go: the incubation shelter, else the campfire, else the stockpile. */
export function eggHome(w: World): { x: number; y: number } {
  const hatch = w.colony.buildings.find((b) => b.kind === "hatchery" && b.built >= 1);
  // the next free spot in the shelter (rows of three)
  const taken = hatch ? w.dragons.eggs.filter((e) => e.at === "camp" && Math.hypot(e.x - hatch.x, e.y - hatch.y) < 60).length : w.dragons.eggs.filter((e) => e.at === "camp").length;
  if (hatch) return { x: hatch.x - 14 + (taken % 3) * 14, y: hatch.y - 6 - Math.floor(taken / 3) * 8 };
  const fire = [...w.campfires].filter((f) => f.lit).sort((a, b) => Math.hypot(a.x - w.camp.x, a.y - w.camp.y) - Math.hypot(b.x - w.camp.x, b.y - w.camp.y))[0];
  if (fire) return { x: fire.x + 34 + taken * 12, y: fire.y + 10 };
  return { x: w.camp.pileX + 30 + taken * 12, y: w.camp.pileY + 10 };
}

/** Where a carrier walks to hand an egg in (the shelter's door: its egg spots are inside). */
export function eggDropOff(w: World): { x: number; y: number } {
  const hatch = w.colony.buildings.find((b) => b.kind === "hatchery" && b.built >= 1);
  return hatch ? w.colony.door(hatch) : eggHome(w);
}

/** Close enough to hand an egg in? */
export function atEggHome(w: World, h: Human) {
  const hatch = w.colony.buildings.find((b) => b.kind === "hatchery" && b.built >= 1);
  if (hatch) return Math.hypot(h.x - hatch.x, h.y - hatch.y) < 64;
  const home = eggHome(w);
  return Math.hypot(h.x - home.x, h.y - home.y) < 16;
}

/** Set an egg down at camp to incubate. */
export function settleEgg(w: World, egg: DragonEgg, h: Human | null) {
  const spot = eggHome(w);
  egg.at = "camp";
  egg.carrier = 0;
  egg.x = spot.x;
  egg.y = spot.y;
  // whoever ran it home keeps it
  if (h && !h.child && !keeperOf(w, egg)) makeKeeper(w, egg, h, true);
  if (h) {
    if (h.egg === egg.id) h.egg = h.egg2;
    h.egg2 = undefined;
    if (h.egg === egg.id) h.egg = undefined;
  }
  const warm = eggWarmth(w, egg.x, egg.y);
  w.toast("🥚", `A ${BREEDS[egg.breed].name.toLowerCase()} egg is home! It's warmed by ${warm.src}. ${warm.heat < 0.6 ? "It needs more heat: build an incubation shelter (with fuel) or keep a fire lit beside it." : "Keep it warm until it hatches."}`, egg.x, egg.y);
  if (!w.flags.has("firstDragonEgg")) {
    w.flags.add("firstDragonEgg");
    w.discover("dragonEgg", egg.x, egg.y);
    w.celebrate("A dragon egg!");
  }
}

/* ------------------------------ egg hunts (task) ------------------------------ */

/**
 * The egg-hunt party: walk to the nest; the first one there takes an egg, the rest fill their
 * packs with treasure and escort the carrier home. A dropped egg gets picked up again.
 * Returns true if it decided what to do; `done` ends this person's part.
 */
export function eggHuntThink(w: World, h: Human, t: { target: number; people: number[]; x: number; y: number }, done: () => void): boolean {
  const nest = w.dragons.nests.find((n) => n.id === t.target);
  if (!nest) {
    done();
    return false;
  }
  const party = w.humans.filter((p) => t.people.includes(p.id));
  // carrying the egg: home with it
  if (h.egg) {
    const egg = w.dragons.eggs.find((e) => e.id === h.egg);
    if (!egg) {
      h.egg = undefined;
      done();
      return false;
    }
    const home = eggDropOff(w);
    if (atEggHome(w, h)) {
      settleEgg(w, egg, h);
      say(h, "Got it home!");
      for (const p of party) if (p !== h) p.taskStep = 2;
      done();
      return true;
    }
    go(h, "walk", home.x, home.y);
    return true;
  }
  // an egg lying about (dropped): pick it up
  const loose = w.dragons.eggs.find((e) => e.at === "ground" && Math.hypot(e.x - h.x, e.y - h.y) < 500);
  if (loose && !h.child) {
    if (Math.hypot(h.x - loose.x, h.y - loose.y) < 14) {
      takeEgg(w, h, loose);
      return true;
    }
    go(h, "walk", loose.x, loose.y);
    return true;
  }
  const carrier = party.find((p) => p.egg);
  if (carrier) {
    // escort: stay close, fight whatever comes after the egg
    h.order = { kind: "guard", x: carrier.x, y: carrier.y };
    const d = Math.hypot(h.x - carrier.x, h.y - carrier.y);
    if (d > 50) go(h, "walk", carrier.x + ((h.id % 3) - 1) * 26, carrier.y + 16);
    return d > 50;
  }
  if (h.taskStep === 2) {
    h.order = null;
    done();
    return false;
  }
  // on the way: sneak up to the nest
  if (Math.hypot(h.x - nest.x, h.y - nest.y) > 30) {
    if (h.stateT > 4 || h.state !== "walk") go(h, "walk", nest.x + ((h.id % 5) - 2) * 10, nest.y + 14);
    return true;
  }
  revealNest(w, nest, h.name);
  const egg = nestEggs(w, nest)[0];
  if (egg && !party.some((p) => p.egg)) {
    takeEgg(w, h, egg);
    const parent = parentOf(w, nest);
    if (parent && Math.hypot(parent.x - nest.x, parent.y - nest.y) < 1400) {
      parent.foe = h.id;
      parent.state = "chase";
      parent.t = 0;
      w.sfx("screech", parent.x, parent.y, 1.2, 0.4);
      w.toast("🐉", `${parent.name} saw that! It's coming after the egg. Run!`, parent.x, parent.y);
    }
    return true;
  }
  // treasure: whatever fits in a pack
  const r = (Object.keys(nest.loot) as Resource[]).find((k) => (nest.loot[k] ?? 0) > 0);
  if (r && !h.carry) {
    const n = Math.min(4, nest.loot[r] ?? 0);
    nest.loot[r] = (nest.loot[r] ?? 0) - n;
    h.carry = r;
    h.carryN = n;
    say(h, r === "gold" ? "Shiny!" : "Treasure!");
  }
  if (!party.some((p) => p.egg)) {
    say(h, "No eggs here…");
    h.taskStep = 2;
  }
  done();
  return false;
}

function takeEgg(w: World, h: Human, egg: DragonEgg) {
  egg.at = "carried";
  egg.carrier = h.id;
  h.egg = egg.id;
  if (h.carry) {
    // hands full of treasure: it goes in the stores later
    w.camp.stock[h.carry] += h.carryN;
    h.carry = null;
    h.carryN = 0;
  }
  say(h, "I've got an egg!");
  w.sfx("pop", h.x, h.y, 0.8);
  if (!w.flags.has("eggTaken")) {
    w.flags.add("eggTaken");
    w.toast("🥚", `${h.name} has a dragon egg! Get it home safely and keep it warm. Eggs are heavy: they slow you down.`, h.x, h.y);
  }
}

/** Follow a wild dragon's trail home: walk towards its nest until you find it. */
export function trackThink(w: World, h: Human, t: { target: number }, done: () => void): boolean {
  const dr = w.dragons.byId(t.target);
  const nest = dr?.nest ? w.dragons.nests.find((n) => n.id === dr.nest) : w.dragons.nests.find((n) => n.id === t.target);
  if (!nest) {
    say(h, "It's just passing through…");
    done();
    return false;
  }
  if (nest.found) {
    say(h, "There's its nest!");
    done();
    return false;
  }
  // the trail wanders a bit: head for the nest with some drift
  if (h.state !== "walk" || h.stateT > 6) {
    const d = Math.hypot(nest.x - h.x, nest.y - h.y);
    const step = Math.min(d, 420);
    const a = Math.atan2(nest.y - h.y, nest.x - h.x) + (w.dragons.rng() - 0.5) * 0.5;
    go(h, "walk", h.x + Math.cos(a) * step, h.y + Math.sin(a) * step);
    if (w.dragons.rng() < 0.3) say(h, pick(w.dragons.rng, ["Scorch marks…", "A big claw print!", "Scales on the ground!", "This way!"]));
  }
  return true;
}
