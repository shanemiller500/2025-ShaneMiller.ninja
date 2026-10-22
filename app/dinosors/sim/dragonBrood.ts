/* ------------------------------------------------------------------ */
/*  The wild dragons' life cycle (fantasy!).                           */
/*                                                                     */
/*  Brooding: a parent with eggs keeps its nest stocked with wood and  */
/*  now and then breathes fire into it. While the nest is hot the eggs */
/*  grow; left cold (no parent, no wood) they just wait. When one is   */
/*  ready it wobbles, cracks and a wild baby dragon climbs out.        */
/*                                                                     */
/*  Growing up: the youngster lives at the nest, guards it and fights  */
/*  beside its parent. Once it's full-grown it flies off, finds a      */
/*  remote rocky spot of its own and builds a nest there, which in     */
/*  time has eggs too. If its parent is killed, a grown-up youngster   */
/*  takes over the old nest instead. So dragons spread across the land */
/*  and keep on going, unless we (or the clans) stop them.             */
/*                                                                     */
/*  Strict dragon creation rule: new dragons + nests use the dragons'  */
/*  own ids (`w.dragons.nextId`) and dice (`w.dragons.rng`).           */
/* ------------------------------------------------------------------ */
import { BREEDS, DRAGON_NAMES, GROW_SECONDS } from "../data/dragons";
import { newDragonStats } from "./dragonKeep";
import { nestEggs, parentOf } from "./dragonNests";
import { inTown } from "./feast";
import { P } from "./particles";
import { pick } from "./rng";
import { MAP_H, MAP_W, T, TILE, type Dragon, type DragonEgg, type DragonNest } from "./types";
import type { World } from "./world";

/** Seconds of a hot nest an egg needs to hatch. */
export const WILD_INCUBATE = 600;
/** How long one fire keeps a nest hot (s). Hot volcanic nests hold their heat longer. */
export const NEST_HEAT_FOR = 150;
/** Seconds of breathing to light the nest. */
const FIRE_FOR = 3;
/** Most nests + wild dragons the land holds (beyond this, grown youngsters stay at home). */
export const MAX_NESTS = 8;
export const MAX_WILD = 18;
/** A youngster flies the nest once it's this old (s). */
export const FLEDGE_AT = GROW_SECONDS * 1.1;

const ROCKY = new Set<T>([T.Mountain, T.Cliff, T.Volcano, T.Basalt, T.Rock]);
const HOT = new Set<T>([T.Volcano, T.Basalt]);

/* ------------------------------ the parent, at its nest ------------------------------ */

/**
 * A perched parent tending its eggs: wood in, fire in. Called from its perch each frame (dragons.ts).
 * True = it's busy with it this frame.
 */
export function broodStep(w: World, dr: Dragon, nest: DragonNest, dt: number): boolean {
  // back from fetching: the wood goes on the nest
  if (dr.wood) {
    dr.wood = false;
    nest.wood = Math.min(6, (nest.wood ?? 0) + 2);
    if (w.inView(nest.x, nest.y, 200)) w.particles.burst(P.Leaf, nest.x, nest.y - 6, 8, 40, { z: 10, size: 3, max: 0.8, color: "#7a5534" });
  }
  if (!nestEggs(w, nest).length) return false;
  // breathing fire into the nest
  if ((nest.fireT ?? 0) > 0) {
    nest.fireT = (nest.fireT ?? 0) - dt;
    dr.breath = 1;
    dr.fireAt = { x: nest.x, y: nest.y };
    dr.dir = nest.x < dr.x ? -1 : 1;
    if (w.inView(nest.x, nest.y, 240)) {
      const mx = dr.x + dr.dir * 34;
      for (let i = 0; i < 3; i++) {
        const t = w.dragons.rng();
        w.particles.spawn(P.Ember, mx + (nest.x - mx) * t, dr.y - 4 + (nest.y - dr.y) * t, { z: 26 * (1 - t) + 6, vz: 30 + w.dragons.rng() * 40, vx: (nest.x - mx) * 0.4, size: 3 + w.dragons.rng() * 4, max: 0.55, color: w.dragons.rng() < 0.5 ? "#ffd447" : "#ff6a1f" });
      }
    }
    if ((nest.fireT ?? 0) <= 0) {
      nest.fireT = 0;
      dr.fireAt = undefined;
      nest.warmth = 1;
      nest.wood = Math.max(0, (nest.wood ?? 0) - 1);
      w.sfx("ignite", nest.x, nest.y, 0.6, 0.6);
      if (nest.found && !w.flags.has(`broodFire${nest.id}`)) {
        w.flags.add(`broodFire${nest.id}`);
        w.toast("🔥", `${dr.name} breathes fire into its nest of wood: it keeps its eggs hot so they'll hatch.`, nest.x, nest.y);
      }
    }
    return true;
  }
  // the nest's going cold: light it (if there's wood), else fetch some
  if ((nest.warmth ?? 0) < 0.45 && dr.t > 3) {
    if ((nest.wood ?? 0) > 0) {
      nest.fireT = FIRE_FOR;
      w.sfx("whoosh", dr.x, dr.y, 0.7, 0.5);
      return true;
    }
  }
  if ((nest.wood ?? 0) < 3 && !dr.gravid && dr.t > 10) {
    const a = w.dragons.rng() * Math.PI * 2;
    dr.tx = nest.x + Math.cos(a) * (260 + w.dragons.rng() * 360);
    dr.ty = nest.y + Math.sin(a) * (180 + w.dragons.rng() * 220);
    dr.wood = true;
    dr.state = "fetch";
    dr.t = 0;
    return true;
  }
  return false;
}

/* ------------------------------ eggs, hatching, growing up ------------------------------ */

/** Per frame (from nestsUpdate): nests cool, hot eggs grow + hatch, grown youngsters move out or take over. */
export function broodUpdate(w: World, dt: number) {
  const ds = w.dragons;
  for (const nest of ds.nests) {
    const hot = nest.site === "volcanic";
    nest.warmth = Math.max(0, (nest.warmth ?? 0) - (dt / NEST_HEAT_FOR) * (hot ? 0.4 : 1) * (1 + w.weather.rain * 0.6));
    const tended = !!parentOf(w, nest);
    for (const egg of nestEggs(w, nest)) {
      egg.heat = 0.3 + 0.7 * (nest.warmth ?? 0);
      if (egg.hatchT > 0) {
        egg.hatchT -= dt;
        if (w.inView(egg.x, egg.y, 120) && ds.rng() < dt * 6) w.particles.spawn(P.Crumb, egg.x + (ds.rng() - 0.5) * 12, egg.y - 8, { z: 10, vz: 50, vx: (ds.rng() - 0.5) * 50, g: 200, size: 2.4, max: 0.6, color: BREEDS[egg.breed].look.egg });
        if (egg.hatchT <= 0) wildHatch(w, egg, nest);
        continue;
      }
      if (!tended || (nest.warmth ?? 0) < 0.35) continue;
      // every egg its own pace (some a good deal slower)
      egg.progress = Math.min(1, egg.progress + (dt / WILD_INCUBATE) * (0.6 + ((egg.id * 7919) % 100) / 125));
      if (egg.progress >= 1) {
        // not every egg takes: a few just never hatch, and the parent clears the shell away
        if (ds.rng() < 0.3) {
          ds.eggs.splice(ds.eggs.indexOf(egg), 1);
          continue;
        }
        egg.hatchT = 3.2;
        w.sfx("crack", egg.x, egg.y, 0.8, 1.2);
      }
    }
  }
  // grown youngsters fly the nest and build their own
  for (const dr of ds.list) {
    if (!dr.young || (dr.growth ?? 0) < 1 || (dr.age ?? 0) < FLEDGE_AT + (dr.id % 9) * 40) continue;
    if (ds.nests.length >= MAX_NESTS) continue;
    const from = ds.nests.find((n) => n.id === dr.nest);
    if (from && !parentOf(w, from)) continue;
    fledge(w, dr, from ?? null);
    break;
  }
}

/** The parent's gone: a grown-up youngster of the nest takes it over (before any stranger moves in). True if one did. */
export function heirTakeover(w: World, nest: DragonNest) {
  const heir = w.dragons.list.find((d) => d.young && d.nest === nest.id && (d.growth ?? 0) >= 0.55 && d.hp > 0);
  if (!heir) return false;
  heir.young = false;
  nest.parent = heir.id;
  heir.state = "home";
  heir.t = 0;
  newDragonStats(heir);
  if (nest.found) w.toast("🐉", `${heir.name} has grown up enough to take over its parent's nest. The eggs have a guardian again.`, nest.x, nest.y);
  return true;
}

/** A wild egg hatches in its nest: a baby dragon that grows up there. */
export function wildHatch(w: World, egg: DragonEgg, nest: DragonNest): Dragon | null {
  const ds = w.dragons;
  ds.eggs.splice(ds.eggs.indexOf(egg), 1);
  const wild = ds.list.filter((d) => d.hp > 0).length;
  // too many dragons in the land: the shell's empty (it never takes)
  if (wild >= MAX_WILD) return null;
  const used = new Set([...ds.owned, ...ds.list].map((d) => d.name));
  const name = DRAGON_NAMES.find((n) => !used.has(n) && ds.rng() < 0.5) ?? pick(ds.rng, DRAGON_NAMES);
  const dr: Dragon = {
    id: ds.nextId(),
    kind: "dragon",
    name,
    x: nest.x - 46,
    y: nest.y + 10,
    z: 0,
    vx: 0,
    vy: 0,
    dir: 1,
    hp: 1,
    maxHp: 1,
    state: "perch",
    t: 0,
    target: 0,
    tx: nest.x,
    ty: nest.y,
    breath: 0,
    anim: 0,
    hue: 0,
    passes: 0,
    hit: 0,
    breed: egg.breed,
    nest: nest.id,
    young: true,
    age: 0,
    growth: 0,
    rare: egg.rare,
  };
  dr.tint = Math.round((ds.rng() - 0.5) * 70);
  dr.marks = Math.floor(ds.rng() * 4) as Dragon["marks"];
  dr.eye = pick(ds.rng, ["#9be36b", "#ffd23f", "#5ad1ff", "#ff8a3d", "#c38bff", "#ff5d7a"]);
  newDragonStats(dr);
  dr.hp = dr.maxHp;
  ds.list.push(dr);
  const def = BREEDS[egg.breed];
  if (w.inView(egg.x, egg.y, 200)) {
    w.particles.burst(P.Poof, egg.x, egg.y, 10, 50, { size: 9, max: 0.9, color: "rgba(255,240,220,0.9)" });
    for (let i = 0; i < 8; i++) w.particles.spawn(P.Crumb, egg.x, egg.y - 8, { z: 12, vz: 70 + ds.rng() * 50, vx: (ds.rng() - 0.5) * 100, g: 240, size: 3, max: 1, color: i % 2 ? def.look.egg : def.look.spots });
  }
  w.sfx("crack", egg.x, egg.y, 1, 1);
  w.sfx("screech", egg.x, egg.y, 0.4, 2.3);
  if (nest.found) {
    const p = parentOf(w, nest);
    w.toast("🐣", `A wild ${def.name.toLowerCase()} hatched in ${p ? `${p.name}'s` : "the"} nest: ${name}! It'll grow up there, then one day fly off to make a nest of its own.`, nest.x, nest.y);
  }
  return dr;
}

/** Full-grown: off it flies to build its own nest somewhere remote. */
export function fledge(w: World, dr: Dragon, from: DragonNest | null): DragonNest | null {
  const ds = w.dragons;
  const spot = newNestSite(w, from ?? { x: dr.x, y: dr.y });
  if (!spot) return null;
  const nest: DragonNest = {
    id: ds.nextId(),
    x: spot.x,
    y: spot.y,
    breed: dr.breed ?? "fire",
    site: spot.hot ? "volcanic" : spot.rocky >= 16 ? "peak" : spot.rocky >= 10 ? "cliff" : "plateau",
    found: false,
    parent: dr.id,
    loot: { bone: 2 + Math.floor(ds.rng() * 4), ...(ds.rng() < 0.5 ? { gold: 1 } : {}) },
    // a while to settle in, then it's expecting its first clutch
    layT: 240 + ds.rng() * 360,
    emptyT: 0,
    grow: 0.3,
    wood: 0,
    warmth: 0,
  };
  ds.nests.push(nest);
  dr.young = false;
  dr.nest = nest.id;
  dr.state = "home";
  dr.t = 0;
  newDragonStats(dr);
  dr.hp = Math.min(dr.hp, dr.maxHp);
  if (from?.found || !w.flags.has("dragonFledge")) {
    w.flags.add("dragonFledge");
    w.toast("🐉", `${dr.name} is full-grown and flies off to build a nest of its own somewhere far away. The dragons are spreading…`, dr.x, dr.y);
  }
  return nest;
}

/** A remote, rocky spot for a new nest: far from the town, the clans and the other nests. */
export function newNestSite(w: World, near: { x: number; y: number }) {
  const ds = w.dragons;
  const tiles = w.terrain.tiles;
  const ok = (x: number, y: number, minRocky: number) => {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 5 || ty < 5 || tx >= MAP_W - 5 || ty >= MAP_H - 5) return null;
    if (!w.nav.passable("human", x, y)) return null;
    const t = tiles[ty * MAP_W + tx];
    if (t === T.Shallow || t === T.River || t === T.Swamp) return null;
    if (Math.hypot(x - w.camp.x, y - w.camp.y) < 1300 || inTown(w, x, y, 400)) return null;
    if (ds.nests.some((n) => Math.hypot(n.x - x, n.y - y) < 900)) return null;
    if (w.rivals.clans.some((c) => Math.hypot(c.x - x, c.y - y) < 700)) return null;
    let rocky = 0;
    let hot = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const n = tiles[(ty + dy) * MAP_W + tx + dx];
      if (ROCKY.has(n)) rocky++;
      if (HOT.has(n)) hot++;
    }
    return rocky >= minRocky ? { x, y, rocky, hot: hot >= 3 } : null;
  };
  // rocky country first (near where it grew up, then anywhere), then any remote ground
  for (const minRocky of [5, 2, 0]) {
    for (let k = 0; k < 160; k++) {
      const far = k < 80;
      const x = far ? near.x + (ds.rng() - 0.5) * 3600 : 200 + ds.rng() * (MAP_W * TILE - 400);
      const y = far ? near.y + (ds.rng() - 0.5) * 2600 : 200 + ds.rng() * (MAP_H * TILE - 400);
      const s = ok(x, y, minRocky);
      if (s) return s;
    }
  }
  return null;
}

/** The young dragons of a nest. */
export const youngOf = (w: World, nest: DragonNest) => w.dragons.list.filter((d) => d.young && d.nest === nest.id);
