/* ------------------------------------------------------------------ */
/*  Dinosaur entities: spawning, needs, steering + per-frame motion.   */
/*  Decisions live in behavior/*; this file only moves bodies.         */
/* ------------------------------------------------------------------ */
import { DINO_NAMES } from "../data/facts";
import { sp } from "../data/species";
import { P } from "./particles";
import { clamp, pick } from "./rng";
import { baseGenes } from "./genetics";
import { groundSpeed, isSwimTile, isWalkTile } from "./terrain";
import { T, TILE, WORLD_H, WORLD_W, type Dino, type DinoState, type SpeciesDef, type SpeciesId } from "./types";
import { goalKey, nodePos, tileOf } from "./nav";
import type { World } from "./world";

export const scaleOf = (d: Dino) => 0.42 + 0.58 * d.growth;
export const sizeOf = (d: Dino) => sp(d.species).size * scaleOf(d) * (1 + d.tier * 0.14) * d.genes.size;
export const isBaby = (d: Dino) => d.growth < 0.5;

export function makeDino(w: World, species: SpeciesId, x: number, y: number, o: Partial<Dino> = {}): Dino {
  const def = sp(species);
  const d: Dino = {
    id: w.nextId(),
    kind: "dino",
    species,
    name: pick(w.rng, DINO_NAMES),
    x,
    y,
    z: def.move === "fly" ? 60 + w.rng() * 60 : 0,
    vx: 0,
    vy: 0,
    dir: w.rng() < 0.5 ? 1 : -1,
    age: 0,
    growth: 1,
    hunger: 0.15 + w.rng() * 0.3,
    thirst: 0.1 + w.rng() * 0.3,
    energy: 0.7 + w.rng() * 0.3,
    health: 1,
    fear: 0,
    state: "idle",
    stateT: 0,
    think: w.rng() * 0.5,
    tx: x,
    ty: y,
    targetId: 0,
    anim: w.rng() * 10,
    herd: 0,
    parent: 0,
    homeX: x,
    homeY: y,
    emote: null,
    taps: [],
    annoy: 0,
    poopT: 40 + w.rng() * 120,
    roarT: 20 + w.rng() * 60,
    layT: 120 + w.rng() * 240,
    migrant: false,
    stuckT: 0,
    lastX: x,
    lastY: y,
    threat: 0,
    sleeping: false,
    lead: false,
    raider: false,
    tier: 0,
    genes: baseGenes(w.rng),
    gen: 1,
    wet: 0,
    muddy: 0,
    tame: 0,
    owner: false,
    rider: 0,
    burn: 99,
    path: null,
    pathI: 0,
    pathKey: 0,
    ...o,
  };
  return d;
}

export function addDino(w: World, species: SpeciesId, x: number, y: number, o: Partial<Dino> = {}) {
  const d = makeDino(w, species, x, y, o);
  w.dinos.push(d);
  return d;
}

/** Spawn a herd (or a lone animal for solitary species) near a point. */
export function spawnGroup(w: World, species: SpeciesId, x: number, y: number, n: number, o: Partial<Dino> = {}) {
  const def = sp(species);
  const herd = def.herd > 0.3 ? w.nextId() : 0;
  const out: Dino[] = [];
  for (let i = 0; i < n; i++) {
    const spot = findSpawnSpot(w, def, x, y, 40 + n * 24);
    if (!spot) continue;
    out.push(addDino(w, species, spot.x, spot.y, { herd, ...o }));
  }
  return out;
}

export function canStand(w: World, def: SpeciesDef, x: number, y: number) {
  if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return false;
  const t = w.terrain.tileAt(x, y);
  if (def.move === "fly") return true;
  if (def.move === "swim") return t === T.Deep;
  return isWalkTile(t) && t !== T.Tar;
}

export function findSpawnSpot(w: World, def: SpeciesDef, x: number, y: number, r: number) {
  for (let k = 0; k < 50; k++) {
    const a = w.rng() * Math.PI * 2;
    const rr = Math.sqrt(w.rng()) * (r + k * 6);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (canStand(w, def, px, py)) return { x: px, y: py };
  }
  return null;
}

export function setState(d: Dino, s: DinoState, tx = d.tx, ty = d.ty) {
  if (d.state !== s) d.stateT = 0;
  d.state = s;
  d.tx = tx;
  d.ty = ty;
  d.sleeping = s === "sleep";
}

export function emote(d: Dino, icon: string, t = 1.8) {
  d.emote = { icon, t };
}

/** Desired movement speed for the current state (px/s). */
function stateSpeed(d: Dino, def: SpeciesDef) {
  return stateSpeedBase(d, def) * d.genes.speed;
}

function stateSpeedBase(d: Dino, def: SpeciesDef) {
  const tired = d.energy < 0.15 ? 0.6 : 1;
  const baby = isBaby(d) ? 0.85 : 1;
  switch (d.state) {
    case "chase":
    case "flee":
    case "defend":
    case "steal":
      return def.run * tired * baby;
    case "migrate":
      return def.speed * 1.4;
    case "raid":
      return def.run * 0.6;
    case "attackWall":
      return 0;
    case "stalk":
      return def.speed * 0.8;
    case "wander":
    case "investigate":
    case "seekFood":
    case "seekWater":
    case "shelter":
    case "nest":
    case "follow":
      return def.speed * (d.hunger > 0.8 || d.thirst > 0.8 ? 1.5 : 1) * baby;
    case "play":
      return def.speed * 1.6;
    case "dive":
      return def.run;
    case "perch":
      return def.speed;
    default:
      return 0;
  }
}

const MOVING = new Set<DinoState>([
  "wander",
  "investigate",
  "seekFood",
  "seekWater",
  "shelter",
  "nest",
  "follow",
  "chase",
  "flee",
  "defend",
  "stalk",
  "steal",
  "migrate",
  "play",
  "dive",
  "perch",
  "raid",
]);

export function isMoving(d: Dino) {
  return MOVING.has(d.state);
}

/** Can a walker step onto this point? Walls, closed gates, buildings block; avoids lava + fire unless panicking. */
export function walkable(w: World, d: Dino, x: number, y: number) {
  if (x < 6 || y < 6 || x > WORLD_W - 6 || y > WORLD_H - 6) return d.migrant;
  const t = w.terrain.tileAt(x, y);
  if (!isWalkTile(t) && !w.nav.passable("dino", x, y)) return false;
  const i = tileOf(x, y);
  if (!w.nav.ok("dino", i) && t !== T.Tar) return false;
  if (w.lava.heat[i] > 0.15) return false;
  if (d.state !== "flee" && w.fire.heat[i] > 0.2) return false;
  if (t === T.Tar && d.state !== "flee") return false;
  return true;
}

/**
 * Plan a route when the straight line to the goal is blocked (walls,
 * water, cliffs). Cheap: only re-plans when the goal tile changes.
 */
function planRoute(w: World, d: Dino, dist: number) {
  const key = goalKey(d.tx, d.ty);
  if (d.pathKey === key) return;
  d.pathKey = key;
  d.path = null;
  d.pathI = 0;
  if (dist < 70 || w.nav.lineClear("dino", d.x, d.y, d.tx, d.ty)) return;
  // far-off animals don't need perfect routes every time
  if (!w.inView(d.x, d.y, 600) && w.rng() < 0.5 && !d.raider) return;
  const path = w.nav.find(w, "dino", d.x, d.y, 0, d.tx, d.ty, 0, d.raider ? 9000 : 4000);
  if (path === undefined) d.pathKey = 0;
  else if (path === null) d.pathI = -1; // no way there at all (raiders take that as "smash through")
  else d.path = path;
}

function swimmable(w: World, x: number, y: number) {
  return isSwimTile(w.terrain.tileAt(x, y)) && w.terrain.tileAt(x, y) === T.Deep;
}

/** Steer toward (tx, ty) with whisker probes around blocked tiles. */
function steer(w: World, d: Dino, speed: number, dt: number) {
  const def = sp(d.species);
  const dx = d.tx - d.x;
  const dy = d.ty - d.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4 || speed <= 0) {
    d.vx *= 0.8;
    d.vy *= 0.8;
    return dist;
  }
  let tgx = d.tx;
  let tgy = d.ty;
  if (def.move === "walk") {
    planRoute(w, d, dist);
    if (d.path && d.pathI < d.path.length) {
      const np = nodePos(d.path[d.pathI]);
      if (Math.hypot(np.x - d.x, np.y - d.y) < Math.max(14, sizeOf(d) * 0.3)) d.pathI++;
      if (d.pathI < d.path.length) {
        tgx = np.x;
        tgy = np.y;
      }
    }
  }
  let ang = Math.atan2(tgy - d.y, tgx - d.x);
  const look = Math.max(18, sizeOf(d) * 0.45);
  const ok = (a: number) => {
    const px = d.x + Math.cos(a) * look;
    const py = d.y + Math.sin(a) * look;
    if (def.move === "fly") return px > 0 && py > 0 && px < WORLD_W && py < WORLD_H;
    if (def.move === "swim") return swimmable(w, px, py);
    return walkable(w, d, px, py);
  };
  if (!ok(ang)) {
    let found = false;
    // bias whiskers toward the side we turned last time to avoid dithering
    const side = (d.id & 1) === 0 ? 1 : -1;
    for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
      if (ok(ang + off * side)) {
        ang += off * side;
        found = true;
        break;
      }
    }
    if (!found) {
      d.stuckT += dt * 3;
      d.vx *= 0.5;
      d.vy *= 0.5;
      return dist;
    }
  }
  let mul = 1;
  if (def.move === "walk") mul = groundSpeed(w.terrain.tileAt(d.x, d.y)) * (1 - w.snow.at(d.x, d.y) * 0.3) * (w.nav.cost[tileOf(d.x, d.y)] < 0.9 ? 1.1 : 1);
  if (def.move === "fly") {
    // wind pushes flyers around a little
    mul = 1;
  }
  const s = Math.min(speed * mul, dist / dt);
  const desVx = Math.cos(ang) * s;
  const desVy = Math.sin(ang) * s;
  const k = Math.min(1, dt * 6);
  d.vx += (desVx - d.vx) * k;
  d.vy += (desVy - d.vy) * k;
  return dist;
}

/** Per-frame update: needs, motion, timers. Decisions happen in the brain. */
export function moveDino(w: World, d: Dino, dt: number) {
  const def = sp(d.species);
  d.stateT += dt;
  d.age += dt;
  if (d.growth < 1) d.growth = Math.min(1, d.growth + dt / 300);
  if (d.emote) {
    d.emote.t -= dt;
    if (d.emote.t <= 0) d.emote = null;
  }
  d.annoy = Math.max(0, d.annoy - dt * 0.2);
  d.fear = Math.max(0, d.fear - dt * 0.08);
  d.wet = Math.max(0, d.wet - dt * 0.05);
  d.muddy = Math.max(0, d.muddy - dt * 0.01);

  // needs
  const active = d.state === "chase" || d.state === "flee" ? 2.2 : 1;
  const resting = d.state === "sleep" || (d.state === "perch" && d.z < 2);
  if (!resting) d.energy = clamp(d.energy - dt * 0.0022 * active, 0, 1);
  else d.energy = clamp(d.energy + dt * 0.02, 0, 1);
  const appetite = d.genes.size * d.genes.size * (0.85 + d.genes.speed * 0.15);
  d.hunger = clamp(d.hunger + dt * def.hungerRate * appetite * (d.state === "sleep" ? 0.4 : 1) * (isBaby(d) ? 1.3 : 1), 0, 1);
  d.thirst = clamp(d.thirst + dt * def.thirstRate * (w.weather.temp > 0.75 ? 1.8 : 1), 0, 1);
  if (d.hunger >= 1 || d.thirst >= 1) d.health -= dt * 0.006;
  else if (d.hunger < 0.6 && d.thirst < 0.6) d.health = Math.min(1, d.health + dt * 0.01);

  if (d.state === "carried") {
    d.vx = 0;
    d.vy = 0;
    return;
  }
  // a rider steers: the body just follows them (see moveHuman)
  if (d.state === "ridden") {
    const r = w.humans.find((h) => h.id === d.rider);
    if (!r || r.riding !== d.id) {
      d.rider = 0;
      setState(d, "idle", d.x, d.y);
    } else {
      d.hunger = Math.max(0, d.hunger - dt * 0.001);
      const v = Math.hypot(r.vx, r.vy);
      if (v > 4) d.dir = r.vx > 0 ? 1 : r.vx < 0 ? -1 : d.dir;
      if (v > 20 && w.rng() < dt * 5) w.particles.spawn(P.Dust, d.x - d.dir * sizeOf(d) * 0.3, d.y, { vz: 8, size: 5 + sizeOf(d) / 20, max: 0.8, color: "rgba(180,160,120,0.5)" });
      return;
    }
  }
  d.burn += dt;

  const speed = isMoving(d) ? stateSpeed(d, def) : 0;
  steer(w, d, speed, dt);

  // wind drifts flyers
  if (def.move === "fly" && d.z > 4) {
    d.vx += w.weather.windX * dt * 8;
    d.vy += w.weather.windY * dt * 8;
  }

  const nx = d.x + d.vx * dt;
  const ny = d.y + d.vy * dt;
  if (def.move === "walk") {
    // panicking animals run through fire + tar, but never through walls or into deep water
    const panicOk = d.state === "flee" && w.nav.ok("dino", tileOf(nx, ny)) && w.lava.heat[tileOf(nx, ny)] < 0.5;
    if (walkable(w, d, nx, ny) || panicOk || !w.nav.ok("dino", tileOf(d.x, d.y))) {
      d.x = nx;
      d.y = ny;
    } else if (walkable(w, d, nx, d.y)) {
      // slide along walls instead of sticking on corners
      d.x = nx;
      d.vy *= 0.3;
    } else if (walkable(w, d, d.x, ny)) {
      d.y = ny;
      d.vx *= 0.3;
    } else {
      d.vx *= -0.2;
      d.vy *= -0.2;
    }
  } else if (def.move === "swim") {
    if (swimmable(w, nx, ny)) {
      d.x = nx;
      d.y = ny;
    } else {
      d.vx *= -0.3;
      d.vy *= -0.3;
    }
  } else {
    d.x = clamp(nx, 10, WORLD_W - 10);
    d.y = clamp(ny, 10, WORLD_H - 10);
  }

  if (!d.migrant) {
    d.x = clamp(d.x, 8, WORLD_W - 8);
    d.y = clamp(d.y, 8, WORLD_H - 8);
  }

  const v = Math.hypot(d.vx, d.vy);
  if (Math.abs(d.vx) > 4) d.dir = d.vx > 0 ? 1 : -1;
  d.anim += (v * dt) / Math.max(8, sizeOf(d) * 0.22);

  // stuck detection → the brain picks something else
  if (isMoving(d) && v < 2) d.stuckT += dt;
  else d.stuckT = Math.max(0, d.stuckT - dt);

  // terrain interactions
  if (def.move === "walk" && d.z <= 0.5) {
    const t = w.terrain.tileAt(d.x, d.y);
    if ((t === T.Shallow || t === T.River) && v > 20 && w.rng() < dt * (v / 30)) {
      w.particles.spawn(P.Splash, d.x + (w.rng() - 0.5) * sizeOf(d) * 0.5, d.y, { vz: 40 + w.rng() * 50, g: 160, size: 2 + sizeOf(d) / 40, max: 0.7, vx: (w.rng() - 0.5) * 40 });
      d.wet = 1;
    } else if (t === T.Mud && v > 10 && w.rng() < dt * 3) {
      w.particles.spawn(P.Mud, d.x, d.y, { vz: 30 + w.rng() * 30, g: 140, size: 3, max: 0.6, vx: (w.rng() - 0.5) * 30 });
      d.muddy = Math.min(1, d.muddy + 0.1);
    } else if (v > def.run * 0.6 && w.rng() < dt * 6) {
      w.particles.spawn(P.Dust, d.x - d.dir * sizeOf(d) * 0.3, d.y, { vz: 8, size: 4 + sizeOf(d) / 20, max: 0.8, color: "rgba(180,160,120,0.5)" });
    }
    if (t === T.Tar && d.state !== "stuck") {
      setState(d, "stuck");
      emote(d, "😖", 3);
      w.discover("tar", d.x, d.y);
      // little animals get properly trapped
      if (sizeOf(d) < 45) {
        d.stateT = -18;
        if (!w.flags.has("tarTrapFact") && w.inView(d.x, d.y, 200)) {
          w.flags.add("tarTrapFact");
          w.discover("tarTrap", d.x, d.y);
          w.toast("🪤", `A little ${sp(d.species).nick} is stuck fast in the tar pit! Easy prey for hunters…`, d.x, d.y);
        }
      }
    }
    // footsteps for the big ones
    if (def.size > 85 && v > 8) {
      const step = Math.floor(d.anim);
      if (step !== Math.floor(d.anim - (v * dt) / Math.max(8, sizeOf(d) * 0.22))) w.sfx("step", d.x, d.y, (def.size / 150) * scaleOf(d));
    }
  }

  // lava + fire hurt (cartoon hot-foot hop)
  const tx = Math.floor(d.x / TILE);
  const ty = Math.floor(d.y / TILE);
  if (d.z < 4 && (w.lava.heatAt(tx, ty) > 0.15 || w.fire.at(tx, ty) > 0.3)) {
    d.health -= dt * 0.25;
    d.burn = 0;
    d.fear = 1;
    if (w.rng() < dt * 4) w.particles.spawn(P.Smoke, d.x, d.y - 10, { vz: 20, size: 6, max: 1, color: "rgba(90,90,90,0.5)" });
    if (d.state !== "flee") {
      emote(d, "🔥", 1.2);
      setState(d, "flee", d.x + (w.rng() - 0.5) * 400, d.y + 200 + w.rng() * 200);
    }
  }
}
