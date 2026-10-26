/* ------------------------------------------------------------------ */
/*  Cave people: a small state machine per person. They gather for     */
/*  the camp's current goal, fish, build, sit by the fire, hide from   */
/*  dinosaurs and storms, and sleep in the cave at night.              */
/* ------------------------------------------------------------------ */
import { roomOf } from "./riderHall";
import { huntThink } from "./chariots";
import { feastThink } from "./feast";
import { cleanupThink } from "./cleanup";
import { maybeDrink, pressTick } from "./vineyard";
import { clearThink, clearTick as clearAreaTick } from "./clearArea";
import { CAVE_NAMES } from "../data/facts";
import { HOUSING, NODES } from "../data/colony";
import { sp } from "../data/species";
import { sizeOf } from "./dinos";
import { P } from "./particles";
import { clamp, pick } from "./rng";
import { LM, groundSpeed } from "./terrain";
import { T, TILE, WORLD_H, WORLD_W, type Campfire, type Dino, type Dragon, type Human, type HumanState, type Plant, type Resource } from "./types";
import type { World } from "./world";
import { season } from "./seasons";
import { goRelax, relaxTick, sitIfAtShade } from "./shade";
import { aloftTick, dragonCareTick, dragonRiderDefend, dragonRiderThink } from "./dragonKeep";
import { ferryTick, riderDutyThink } from "./riderDuty";import { sitePrio, urgentSite, URGENT } from "./priority";

import { returnEmitter, sonicTick } from "./sonic";
import { drillTick, eggSpeed } from "./dragonRaid";
import { insideWalls, outsideSpot } from "./dinoBounds";
import { playTick } from "./keepers";
import { watchThink } from "./shows";
import { partnerOf, riderCanFight, riderDefend, riderThink, riderType, trainBoost } from "./riders";
import { TALL } from "./plants";
import { roleAct, roleThink } from "./tribe";
import { goalKey, nodePos, tileOf, TOWER_Z, WALK_Z, type NavClass } from "./nav";
import { shelterDone, stagesOf } from "./build";
import { buildAct, buildThink, deliverToSite, dismount, douseThink, joinTask, leaveScorpion, taskCarrying, taskThink } from "./tasks";
import { healTick, hurtHuman, recover } from "./injury";
import { autoButcher, type Task } from "./tasks";
import { COURAGE, bandNear, canFight, courageScore, foesNear, onMission } from "./courage";
import { cutCarcass, cutTime, hasYield } from "./carcass";
import { hasCart, pickNeed } from "./carts";
import { keeperThink } from "./ourCatapults";
import { researchShortages } from "./researchNeeds";
import { OUTFIT_BY_ID } from "../data/colony";

/**
 * Go and patch up someone who's knocked out. `comrade`: only a teammate on the same job (or in the same raid
 * unit) who's been down a while, but then even in the thick of a fight. True = on their way / patching them up.
 */
function rescueThink(w: World, h: Human, comrade: boolean): boolean {
  if (h.child || h.riding || h.aloft || h.chariot || h.captive || h.under || h.state === "down" || h.state === "heal") return false;
  const unit = (o: Human) => !!w.colony.hunt?.crew.some((m) => m.id === o.id) && !!w.colony.hunt?.crew.some((m) => m.id === h.id);
  let best: Human | null = null;
  let bd = comrade ? 450 : 500;
  for (const o of w.humans) {
    if (o === h || o.state !== "down") continue;
    if (comrade && !((h.taskId && o.taskId === h.taskId) || unit(o))) continue;
    if (comrade && (o.downT ?? 0) < 8) continue;
    // don't run into the fire: wait till the dragon (or the predator) isn't right on top of them
    // (a dragon that's badly hurt and sulking on its nest lets them be dragged clear)
    if (w.dragons.list.some((d) => !d.young && d.hp > 0 && Math.hypot(d.x - o.x, d.y - o.y) < 260 && d.z < 160 && !(d.state === "perch" && d.hp < d.maxHp * 0.6))) continue;
    if (w.dinos.some((d) => !d.owner && d.health > 0 && sp(d.species).diet !== "herbivore" && sizeOf(d) > 30 && Math.hypot(d.x - o.x, d.y - o.y) < 180)) continue;
    if (w.humans.some((q) => q !== h && q.state === "heal" && q.targetId === o.id)) continue;
    const d = Math.hypot(o.x - h.x, o.y - h.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  if (!best) return false;
  if (Math.hypot(h.x - best.x - 14, h.y - best.y) < 12) {
    go(h, "heal", h.x, h.y);
    h.targetId = best.id;
    h.dir = best.x > h.x ? 1 : -1;
  } else {
    say(h, `${best.name}!`);
    go(h, "walk", best.x + 14, best.y);
  }
  return true;
}

/** How much rain + wet this person's clothes keep off (0..1). */
export function rainGuard(h: Human) {
  const o = h.gear.outfit ? OUTFIT_BY_ID[h.gear.outfit] : null;
  return o ? o.rain : 0;
}

/** Rain gear at least this good (the tar-sealed cloak, night suits) is "proper rainproof": ordinary rain + storms don't stop the work. */
export const RAINPROOF = 0.85;
/** A storm this strong sends everyone under cover, rain gear or not. */
export const SEVERE_STORM = 0.95;

/**
 * Does the weather send this person under cover right now? Proper rain gear keeps them out working
 * through ordinary rain and storms; only genuinely dangerous weather (a severe storm, lightning
 * striking close by) brings them in. Shared by the shelter decision and the covered rest seats.
 */
export function rainSendsIn(w: World, h: Human) {
  const wt = w.weather;
  if (wt.storm > SEVERE_STORM) return true;
  // lightning striking right by you is dangerous whatever you're wearing
  if (wt.storm > 0.3 && w.bolts.some((b) => Math.abs(b.x - h.x) < 240 && Math.abs(b.y - h.y) < 240)) return true;
  const guard = rainGuard(h);
  if (guard >= RAINPROOF) return false;
  return (wt.rain > 0.55 && guard < 0.6) || wt.storm > 0.5;
}

/** How warm this person's clothes are (0..1). */
export function coatWarmth(h: Human) {
  const o = h.gear.outfit ? OUTFIT_BY_ID[h.gear.outfit] : null;
  return o ? o.warmth : 0;
}

const HAIR = ["#3b2416", "#5a3a22", "#1f1a17", "#8a4b23", "#c58f4a"];
const SKIN = ["#e0b48a", "#c98e62", "#a86b45", "#7c4c2f", "#f0c9a0"];
const FUR = ["#e39a35", "#d9892a", "#eaa748", "#c97a22", "#a87a45", "#8a5a2b"];

export function addHuman(w: World, x: number, y: number, child = false, o: Partial<Human> = {}): Human {
  const h: Human = {
    id: w.nextId(),
    kind: "human",
    name: pick(w.rng, CAVE_NAMES),
    child,
    x,
    y,
    z: 0,
    vz: 0,
    vx: 0,
    vy: 0,
    dir: 1,
    state: "idle",
    stateT: 0,
    think: w.rng(),
    tx: x,
    ty: y,
    targetId: 0,
    task: null,
    carry: null,
    carryN: 0,
    anim: w.rng() * 10,
    bubble: null,
    hair: pick(w.rng, HAIR),
    skin: pick(w.rng, SKIN),
    fur: pick(w.rng, FUR),
    energy: 0.8,
    hunger: 0.2,
    fear: 0,
    role: "auto",
    autoRole: "gatherer",
    order: null,
    age: child ? 0 : 400,
    cd: 0,
    hp: 1,
    warmth: 1,
    gear: { weapon: null, shield: 0 },
    taskId: 0,
    taskStep: 0,
    path: null,
    pathI: 0,
    pathKey: 0,
    level: 0,
    riding: 0,
    home: 0,
    family: 0,
    site: "",
    wantTop: false,
    stranger: false,
    ...o,
  };
  w.humans.push(h);
  return h;
}

export function say(h: Human, text: string, t = 2.2) {
  h.bubble = { text, t };
}

export function go(h: Human, s: HumanState, x: number, y: number) {
  if (h.state !== s) h.stateT = 0;
  h.state = s;
  h.tx = x;
  h.ty = y;
}

const replanAt = new WeakMap<Human, number>();

const navClass = (w: World, h: Human): NavClass => {
  const mount = h.riding ? w.dinoById(h.riding) : null;
  return mount && (sizeOf(mount) >= 110 || ((mount.species === "apato" || mount.species === "brachio") && mount.growth >= 0.5)) ? (mount.owner ? "trainedHugeDino" : "hugeDino") : mount ? "rider" : "human";
};

/** Can this person step here (ground level)? Also avoids hot ground. */
function walkOk(w: World, h: Human, x: number, y: number) {
  if (!w.nav.passable(navClass(w, h), x, y)) return false;
  const i = tileOf(x, y);
  return w.lava.heat[i] < 0.1 && w.fire.heat[i] < 0.2;
}

/**
 * Walk toward (tx, ty) along a nav path (around walls, through gates,
 * up stairs onto walkways). Returns true on arrival.
 */
export function moveHuman(w: World, h: Human, dt: number) {
  const mount = h.riding ? w.dinoById(h.riding) : null;
  if (h.riding && !mount) h.riding = 0;
  const wantLevel = h.wantTop ? 1 : 0;
  const key = goalKey(h.tx, h.ty, wantLevel);
  if (h.pathKey !== key) {
    h.pathKey = key;
    h.pathI = 0;
    h.path = null;
    const goalTile = tileOf(h.tx, h.ty);
    const startTile = tileOf(h.x, h.y);
    // A worn tile at either end alone should not funnel every errand onto one trail.
    const markedRoute = Math.hypot(h.tx - h.x, h.ty - h.y) > TILE * 2
      && w.trails.wear[startTile] >= 5 && w.trails.wear[goalTile] >= 5;
    const easy = !markedRoute && h.level === 0 && wantLevel === 0 && w.nav.ok(navClass(w, h), goalTile) && w.nav.lineClear(navClass(w, h), h.x, h.y, h.tx, h.ty);
    if (!easy) {
      const path = w.nav.find(w, navClass(w, h), h.x, h.y, h.level, h.tx, h.ty, wantLevel);
      if (path === undefined) h.pathKey = 0; // out of budget: ask again next frame
      else h.path = path;
    }
  }
  // next waypoint: the path, then the exact goal
  let wx = h.tx;
  let wy = h.ty;
  let wl = wantLevel;
  let final = true;
  if (h.path && h.pathI < h.path.length) {
    const np = nodePos(h.path[h.pathI]);
    final = h.pathI === h.path.length - 1;
    wl = np.level;
    if (!final || (np.level === 1 && !wantLevel)) {
      wx = np.x;
      wy = np.y;
    } else if (final && np.level === 1) {
      wx = np.x;
      wy = np.y;
    } else if (final && !w.nav.ok(navClass(w, h), tileOf(h.tx, h.ty))) {
      // goal is inside something solid (a tree, a wall to fix): stop at the end of the path
      wx = np.x;
      wy = np.y;
    }
  }
  // Give walkers their own line along an open trail. Keep the tile centre at
  // gates, bridges and other tight turns so the nav path remains reachable.
  if (!h.level && !h.riding && h.path && h.pathI > 0 && h.pathI < h.path.length - 1 && wl === 0) {
    const previous = nodePos(h.path[h.pathI - 1]);
    const vx = wx - previous.x;
    const vy = wy - previous.y;
    const length = Math.hypot(vx, vy);
    const lane = ((h.id * 3) % 5 - 2) * 6;
    if (length > 1 && lane !== 0) {
      const lx = wx - vy / length * lane;
      const ly = wy + vx / length * lane;
      const midX = (h.x + lx) * 0.5;
      const midY = (h.y + ly) * 0.5;
      if (walkOk(w, h, lx, ly) && walkOk(w, h, midX, midY)) {
        wx = lx;
        wy = ly;
      }
    }
  }
  // goal inside something solid (a wall to fix, a doorway): close enough counts
  if ((!h.path || h.pathI >= h.path.length - 1) && wantLevel === 0 && !w.nav.ok(navClass(w, h), tileOf(h.tx, h.ty)) && Math.hypot(h.tx - h.x, h.ty - h.y) < 30) {
    h.vx = h.vy = 0;
    return true;
  }
  const dx = wx - h.x;
  const dy = wy - h.y;
  const d = Math.hypot(dx, dy);
  const base = h.child ? 28 : 34;
  // running: fleeing, hunting, or hurrying to a dinosaur (a rally, a call)
  const rideTask = h.taskId ? w.tasks.get(h.taskId) : null;
  const fast = h.state === "flee" || h.state === "hunt" || (rideTask?.kind === "ride" && !h.riding);
  const snow = w.snow.at(h.x, h.y);
  // a sprinting person can't outrun a hungry predator for long, and hurt people limp
  // rain + snow slow people down, unless their hide clothes keep them dry + warm
  const wet = w.weather.rain * 0.28 * (1 - rainGuard(h));
  let speed = (fast ? (h.child ? 30 : 36) * (h.state === "flee" ? 1.9 : 1.6) : base) * (h.level ? 0.9 : groundSpeed(w.terrain.tileAt(h.x, h.y))) * (1 - snow * 0.3 * (1 - coatWarmth(h) * 0.6)) * (1 - wet) * (0.55 + 0.45 * Math.min(1, h.hp * 1.4)) * eggSpeed(w, h) * (h.slowT ? 0.45 : 1);
  if (mount) {
    // mounted: an easy walk about camp, a flat-out run into battle, a rally or anywhere the player sends them
    const k = rideTask?.kind;
    const running = fast || !!h.order || !!w.tribe.raid || w.flags.has("rallyDinos") || k === "hunt" || k === "guard" || k === "defend" || k === "dragonRaid" || !!mount.work?.rideTo || mount.state === "war";
    const def = sp(mount.species);
    speed = (running ? def.run * 1.08 : Math.max(def.speed * 1.3, def.run * 0.5)) * mount.genes.speed * (h.state === "haul" ? 0.7 : 1) * (1 - snow * 0.25);
  }
  if (w.nav.cost[tileOf(h.x, h.y)] < 0.9 && !h.level) speed *= 1.25; // paved path
  if (d < 3) {
    if (h.path && h.pathI < h.path.length) {
      h.level = nodePos(h.path[h.pathI]).level;
      h.pathI++;
      if (h.pathI < h.path.length || !final) return false;
    }
    const done = Math.hypot(h.tx - h.x, h.ty - h.y) < 3 || !h.path || h.pathI >= h.path.length;
    if (done) {
      h.vx = 0;
      h.vy = 0;
      h.level = wl === 1 && wantLevel ? 1 : h.level;
      return true;
    }
    return false;
  }
  let a = Math.atan2(dy, dx);
  const look = 14;
  if (!h.level && !walkOk(w, h, h.x + Math.cos(a) * look, h.y + Math.sin(a) * look) && walkOk(w, h, h.x, h.y)) {
    for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5]) {
      if (walkOk(w, h, h.x + Math.cos(a + off) * look, h.y + Math.sin(a + off) * look)) {
        a += off;
        break;
      }
    }
  }
  // A shared destination is common, but people need not stand inside one
  // another on the way there. Choose a clear shoulder when someone is ahead.
  if (!h.level && !mount && d > 24 && !w.nav.isGate(tileOf(h.x, h.y)) && !w.nav.isBridge(tileOf(h.x, h.y))) {
    const nearby = w.humans.filter((other) => other !== h && !other.under && other.state !== "hide" && other.state !== "sleep" && other.state !== "down" && other.level === 0 && Math.hypot(other.x - h.x, other.y - h.y) < 38);
    if (nearby.length) {
      const preferred = h.id % 2 ? 1 : -1;
      let bestAngle = a;
      let bestScore = Infinity;
      for (const off of [0, preferred * 0.45, -preferred * 0.45, preferred * 0.8, -preferred * 0.8]) {
        const angle = a + off;
        const px = h.x + Math.cos(angle) * 18;
        const py = h.y + Math.sin(angle) * 18;
        if (!walkOk(w, h, px, py) || w.nav.isGate(tileOf(px, py)) || w.nav.isBridge(tileOf(px, py))) continue;
        let score = Math.abs(off) * 0.32 + (off && Math.sign(off) !== preferred ? 0.02 : 0);
        for (const other of nearby) {
          const gap = Math.hypot(px - (other.x + other.vx * 0.15), py - (other.y + other.vy * 0.15));
          if (gap < 22) score += (22 - gap) / 9;
        }
        if (score < bestScore) {
          bestScore = score;
          bestAngle = angle;
        }
      }
      a = bestAngle;
    }
  }
  const s = Math.min(speed, d / dt);
  h.vx = Math.cos(a) * s;
  h.vy = Math.sin(a) * s;
  const nx = h.x + h.vx * dt;
  const ny = h.y + h.vy * dt;
  // up on the walkway the path itself keeps us safe; on the ground, don't walk into walls
  const climbing = wl === 1 || h.level === 1;
  if (climbing || walkOk(w, h, nx, ny) || !walkOk(w, h, h.x, h.y)) {
    h.x = nx;
    h.y = ny;
  } else if (walkOk(w, h, nx, h.y)) {
    // slide along walls + corners
    h.x = nx;
  } else if (walkOk(w, h, h.x, ny)) {
    h.y = ny;
  } else if (h.path || w.elapsed - (replanAt.get(h) ?? -9) > 1.5) {
    // bumped into something new (a wall went up): re-plan, but not every frame
    replanAt.set(h, w.elapsed);
    h.pathKey = 0;
  }
  if (wl === 1 && d < 18) h.level = 1;
  else if (wl === 0 && h.level === 1 && h.path && h.pathI < h.path.length && d < 18) h.level = 0;
  if (Math.abs(h.vx) > 3) h.dir = h.vx > 0 ? 1 : -1;
  h.anim += (s * dt) / 7;
  if (mount) {
    mount.x = h.x;
    mount.y = h.y;
    mount.vx = h.vx;
    mount.vy = h.vy;
    mount.dir = h.dir;
    mount.anim += (s * dt) / Math.max(8, sizeOf(mount) * 0.22);
  }
  return false;
}

function dangerNear(w: World, h: Human): Dino | null {
  let worst: Dino | null = null;
  let best = Infinity;
  // up on the wall, ground dinos can't reach us (unless the wall gets smashed)
  if (h.level === 1) return null;
  const reach = h.child || h.hp < 0.45 ? 320 : 230;
  w.creatureHash.each(h.x, h.y, reach, (e, d2) => {
    if (e.kind !== "dino") return;
    const def = sp(e.species);
    if (def.move === "swim" || (def.move === "fly" && e.z > 10)) return;
    if (e.owner || e.state === "ridden") return;
    if (e.state === "sleep" || e.state === "carried" || e.state === "knocked") return;
    const scary = (def.diet !== "herbivore" && sizeOf(e) > 30) || (sizeOf(e) > 70 && (e.state === "flee" || e.state === "defend" || e.state === "annoyed"));
    const r = (def.diet !== "herbivore" ? 230 : 120) + (reach - 230) + (e.raider ? 90 : 0);
    // stuck in tar, or on the other side of a wall: can't get us
    if (e.state === "stuck" || (scary && d2 < r * r && w.nav.wallBetween(e.x, e.y, h.x, h.y))) return;
    if (scary && d2 < r * r && d2 < best) {
      best = d2;
      worst = e;
    }
  });
  return worst;
}

type LocalDanger = { x: number; y: number; kind: "raid" | "dragon" | "predator" | "fire" | "volcano" };

/** Called on each person's throttled think tick, using the creature grid and nearby tiles. */
function localDanger(w: World, h: Human): LocalDanger | null {
  const sensitive = h.child || h.hp < 0.45;
  let best: LocalDanger | null = null;
  let distance = Infinity;
  const offer = (x: number, y: number, r: number, kind: LocalDanger["kind"]) => {
    const d = Math.hypot(x - h.x, y - h.y);
    if (d < r && d / r < distance) { distance = d / r; best = { x, y, kind }; }
  };
  w.creatureHash.each(h.x, h.y, sensitive ? 460 : 380, (e) => {
    if (e.kind !== "dino" || e.owner || e.state === "sleep" || e.state === "knocked" || e.state === "carried" || e.state === "stuck") return;
    const def = sp(e.species);
    if (e.raider) offer(e.x, e.y, sensitive ? 460 : 380, "raid");
    else if (def.diet !== "herbivore" && sizeOf(e) > 30 && def.move !== "swim" && !(def.move === "fly" && e.z > 10)) {
      if (!w.nav.wallBetween(e.x, e.y, h.x, h.y)) offer(e.x, e.y, sensitive ? 320 : 230, "predator");
    }
  });
  for (const b of w.rivals.brutes) if (w.rivals.hostile(w, b) && b.hp > 0 && b.state !== "flee" && b.state !== "home") offer(b.x, b.y, sensitive ? 440 : 340, "raid");
  for (const dr of w.dragons.list) if (dr.state !== "leave" && dr.state !== "flee" && dr.z < 250) offer(dr.x, dr.y, sensitive ? 680 : 560, "dragon");
  const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
  // the bucket brigade fights fires instead of fleeing them (unless they're standing in one); lava is never safe
  const role = w.tribe.roleOf(h);
  // (someone holding an ultrasonic emitter works from a distance: flames only matter right on top of them)
  // (a dragon raid doesn't stop for burning grass either)
  const firefighter = !sensitive && (!!h.sonic || w.tasks.get(h.taskId)?.kind === "dragonRaid" || (w.camp.learned.has("firefighting") && w.tribe.fireAlarm && (role === "gatherer" || role === "builder" || role === "farmer" || role === "cook")));
  for (let y = ty - 5; y <= ty + 5; y++) for (let x = tx - 5; x <= tx + 5; x++) {
    if (w.lava.heatAt(x, y) > 0.14) offer((x + 0.5) * TILE, (y + 0.5) * TILE, sensitive ? 210 : 165, "fire");
    else if (w.fire.at(x, y) > 0.24) offer((x + 0.5) * TILE, (y + 0.5) * TILE, firefighter ? 40 : sensitive ? 210 : 165, "fire");
  }
  if (w.volcano.phase !== "idle" && w.volcano.phase !== "rumble") offer(w.volcano.x, w.volcano.y, w.volcano.megaOn ? 1800 : 850, "volcano");
  return best;
}

function emergencySpot(w: World, h: Human, danger: LocalDanger): { x: number; y: number; open?: boolean } {
  const candidates: { x: number; y: number; protection: number; capacity: number }[] = [];
  for (const s of w.shelters) if (shelterDone(s) && s.hp > 0.2) candidates.push({ x: s.x, y: s.y + 6, protection: 110 + s.tier * 35, capacity: HOUSING[s.tier].cap });
  if (Math.hypot(h.x - w.camp.caveX, h.y - w.camp.caveY) < 650) candidates.push({ x: w.camp.caveX, y: w.camp.caveY, protection: 140, capacity: 12 });
  if (danger.kind !== "dragon" && danger.kind !== "fire" && danger.kind !== "volcano") {
    const wall = w.tribe.walledRefuge(w, h);
    if (wall) candidates.push({ ...wall, protection: 170, capacity: 8 });
    const bridge = w.tribe.coveredBridge(w, h);
    if (bridge) candidates.push({ ...bridge, protection: 100, capacity: 3 });
  }
  let best: { x: number; y: number } | null = null;
  let score = Infinity;
  for (const c of candidates) {
    const travel = Math.hypot(c.x - h.x, c.y - h.y);
    if (travel > 760) continue;
    const fromThreat = Math.hypot(c.x - danger.x, c.y - danger.y);
    if (fromThreat < (danger.kind === "dragon" ? 180 : danger.kind === "fire" ? 115 : 90)) continue;
    const tile = tileOf(c.x, c.y);
    if (w.fire.heat[tile] > 0.12 || w.lava.heat[tile] > 0.08) continue;
    const occupied = w.humans.filter((o) => o !== h && (o.state === "hide" || o.state === "flee") && Math.hypot(o.tx - c.x, o.ty - c.y) < 35).length;
    if (occupied >= c.capacity) continue;
    const kind = navClass(w, h);
    const route = w.nav.lineClear(kind, h.x, h.y, c.x, c.y) || !!w.nav.find(w, kind, h.x, h.y, h.level, c.x, c.y, 0)?.length;
    if (!route) continue;
    const midpoint = tileOf((h.x + c.x) / 2, (h.y + c.y) / 2);
    const routeHeat = w.fire.heat[midpoint] + w.lava.heat[midpoint];
    if (routeHeat > 0.18) continue;
    const toward = Math.max(0, Math.hypot(h.x - danger.x, h.y - danger.y) - fromThreat);
    const value = travel + toward * 1.5 + occupied * 35 + routeHeat * 500 - c.protection;
    if (value < score) { score = value; best = c; }
  }
  if (best) return best;
  const a = Math.atan2(h.y - danger.y, h.x - danger.x);
  const escape = danger.kind === "volcano" ? 520 : 220;
  // no cover in reach: just open ground further away — somewhere to run, not somewhere to hide
  return { x: clamp(h.x + Math.cos(a) * escape, TILE, WORLD_W - TILE), y: clamp(h.y + Math.sin(a) * escape, TILE, WORLD_H - TILE), open: true };
}

/** A dragon swooping low nearby. */
function dragonNear(w: World, h: Human): Dragon | null {
  for (const dr of w.dragons.list) {
    if (dr.z > 230 || dr.state === "leave" || dr.state === "flee") continue;
    if (Math.hypot(dr.x - h.x, dr.y - h.y) < 520) return dr;
  }
  return null;
}

function nearPlant(w: World, x: number, y: number, r: number, ok: (p: Plant) => boolean) {
  return w.plantHash.nearest(x, y, r, ok);
}

/** Find somewhere to collect a resource: searched around the camp unless another centre is given. */
export function homeArea(w: World, h: Human): { x: number; y: number } {
  const home = h.home ? w.shelters.find((s) => s.id === h.home && shelterDone(s)) : null;
  return home ? { x: home.x, y: home.y } : { x: w.camp.x, y: w.camp.y };
}

export function sourceFor(w: World, h: Human, r: Resource, cx = homeArea(w, h).x, cy = homeArea(w, h).y, maxDistance = 900): { x: number; y: number; id: number } | null {
  switch (r) {
    case "stick":
    case "wood": {
      const p = nearPlant(w, cx, cy, maxDistance, (p) => TALL.has(p.kind) && !p.stump && p.burnt < 0.5 && (r === "stick" || p.size > 0.6));
      return p ? { x: p.x + (p.x > cx ? -16 : 16), y: p.y + 6, id: p.id } : null;
    }
    case "leaves":
    case "berries": {
      const p = nearPlant(w, cx, cy, maxDistance, (p) => (p.kind === "bush" || p.kind === "fern" || p.kind === "cycad") && p.food > 0.3 && !p.stump);
      return p ? { x: p.x + 14, y: p.y + 4, id: p.id } : null;
    }
    case "stone": {
      const b = w.props.find((p) => p.kind === "boulder" && Math.hypot(p.x - cx, p.y - cy) < maxDistance);
      if (b) return { x: b.x + 18, y: b.y + 6, id: b.id };
      const n = nearestNode(w, cx, cy, "stone", maxDistance);
      if (n) return n;
      const t = w.terrain.findTile(cx, cy - 40, maxDistance, (t) => t === T.Rock || t === T.Basalt, w.rng, 80);
      return t ? { ...t, id: 0 } : null;
    }
    case "water": {
      const s = w.colony.nearestWater(w, h.x, h.y, 1600);
      return s ? { ...s, id: 0 } : null;
    }
    case "meat":
    case "hide":
    case "bone":
    case "tooth": {
      // the nearest dinosaur body that still has some
      let best: { x: number; y: number; id: number } | null = null;
      let bd = maxDistance;
      for (const it of w.items) {
        if (!it.carcass || !hasYield(it, r) || (it.claimed && w.dinoById(it.claimed))) continue;
        const d = Math.hypot(it.x - cx, it.y - cy);
        if (d < bd) {
          bd = d;
          const side = h.x < it.x ? -1 : 1;
          best = { x: it.x + side * (Math.max(14, it.carcass.size * 0.42) + 8), y: it.y + 8, id: -it.id };
        }
      }
      return best;
    }
    case "clay":
    case "iron":
    case "gold":
    case "obsidian":
    case "flint":
    case "salt":
    case "tar":
    case "copper":
    case "quartz":
    case "magnetite":
    case "crystal":
    case "meteorite":
      return nearestNode(w, cx, cy, r, maxDistance);
    case "grass": {
      const t = w.terrain.findTile(cx, cy, maxDistance, (t) => t === T.Grass, w.rng, 60);
      return t ? { ...t, id: 0 } : null;
    }
    case "fish": {
      const s = w.terrain.nearestDrink(cx + 300, cy + 40, 1400);
      return s ? { ...s, id: 0 } : null;
    }
    default:
      // meat comes from hunting, crops from farms, cooked food from cooks
      return null;
  }
}

/** Nearest discovered deposit that gives this resource (and that we have the tools for). */
function nearestNode(w: World, x: number, y: number, r: Resource, max: number): { x: number; y: number; id: number } | null {
  let best: { x: number; y: number; id: number } | null = null;
  let bd = max;
  for (const n of w.colony.nodes) {
    const def = NODES[n.kind];
    if (!n.found || def.gives !== r || n.amount <= 0) continue;
    if (def.needs && !w.camp.learned.has(def.needs)) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      best = { x: n.x + 18, y: n.y + 10, id: n.id };
    }
  }
  return best;
}

/**
 * Refill the lowest relative supply first, counting loads already on their way home.
 * `all`: everything we collect, lowest first, even once it's all past its target (keep topping up).
 */
export function stockPriorities(w: World, all = false): Resource[] {
  const adults = w.humans.filter((h) => !h.child && !h.stranger).length;
  const target = Math.max(6, Math.ceil(adults * 0.6));
  const goals: [Resource, number][] = [
    ["stick", target], ["stone", target], ["grass", target], ["leaves", target],
    // food targets rise in autumn (stocking up for winter)
    ["berries", Math.round(target * 2 * season(w).stockpile)], ["fish", Math.round(target * 2 * season(w).stockpile)],
  ];
  if (w.camp.learned.has("axe")) goals.push(["wood", target]);
  if (w.colony.finished("waterStore")) goals.push(["water", target * 2]);
  for (const node of w.colony.nodes) {
    const def = NODES[node.kind];
    if (!node.found || node.amount <= 0 || !def.gives || (def.needs && !w.camp.learned.has(def.needs))) continue;
    if (!goals.some(([r]) => r === def.gives)) goals.push([def.gives, Math.max(3, Math.ceil(target / 2))]);
  }
  return goals.map(([r, n]) => ({
    r,
    ratio: (w.camp.stock[r] + w.humans.reduce((sum, h) => sum + (h.carry === r ? h.carryN : h.task === r ? 1 : 0), 0)) / n,
  })).filter((x) => x.ratio < (all ? 4 : 1)).sort((a, b) => a.ratio - b.ratio).map((x) => x.r);
}

/** Where this person goes to hide / sleep: their home, else the cave. */
export function shelterSpot(w: World, h?: Human): { x: number; y: number } {
  // dragon riders + keepers sleep in their own rooms in the colosseum, next to their dragons
  const room = h ? roomOf(w, h) : null;
  if (room) return { x: room.x, y: room.y };
  const home = h?.home ? w.shelters.find((s) => s.id === h.home && shelterDone(s)) : undefined;
  const s = home ?? w.shelters.find((s) => shelterDone(s));
  if (s) return { x: s.x, y: s.y + 6 };
  return { x: w.camp.caveX, y: w.camp.caveY };
}

/** Seats round one campfire (people beyond that pick another fire, or go home). */
export const FIRE_SEATS = 8;
/** How far people will walk to a fire for the evening (warming up, they'll go further). */
const FIRE_REACH = 1400;

/** Where seat n of a fire is. */
const seatAt = (f: Campfire, n: number) => {
  const a = (n / FIRE_SEATS) * Math.PI * 2 + 0.3;
  return { x: f.x + Math.cos(a) * 34, y: f.y + Math.sin(a) * 18 };
};

/** Seats taken at a fire: people sitting there, or on their way to their seat. */
function seatsTaken(w: World, f: Campfire, me: Human) {
  const taken = new Set<number>();
  for (const o of w.humans) {
    if (o === me || o.fireId !== f.id || o.seat === undefined) continue;
    const s = seatAt(f, o.seat);
    if (o.state === "sitFire" || (o.state === "walk" && Math.hypot(o.tx - s.x, o.ty - s.y) < 4)) taken.add(o.seat);
  }
  return taken;
}

/**
 * A lit campfire with a free seat for this person, picked sensibly: close to home (or to
 * where they are, when they're cold), not already packed, where their family is sitting,
 * and the ones that are crowded already count for less. Keeps a seat they already have.
 */
export function pickFire(w: World, h: Human, from: { x: number; y: number } = homeArea(w, h), reach = FIRE_REACH): { fire: Campfire; x: number; y: number } | null {
  let best: { fire: Campfire; seat: number } | null = null;
  let bestScore = Infinity;
  for (const f of w.campfires) {
    if (!f.lit) continue;
    const d = Math.hypot(f.x - from.x, f.y - from.y);
    if (d > reach) continue;
    const taken = seatsTaken(w, f, h);
    const mine = h.fireId === f.id && h.seat !== undefined && !taken.has(h.seat);
    if (!mine && taken.size >= FIRE_SEATS) continue;
    let family = 0;
    if (h.family) for (const o of w.humans) if (o !== h && o.family === h.family && o.fireId === f.id && o.state === "sitFire") family++;
    const score = d + taken.size * 45 - family * 120 - (mine ? 200 : 0);
    if (score < bestScore) {
      bestScore = score;
      let seat = mine ? h.seat! : 0;
      if (!mine) while (taken.has(seat)) seat++;
      best = { fire: f, seat };
    }
  }
  if (!best) return null;
  h.fireId = best.fire.id;
  h.seat = best.seat;
  return { fire: best.fire, ...seatAt(best.fire, best.seat) };
}

/** Somewhere warm: a fire with room (nearest to where they are), or home if it has a hearth / is cosy. */
function warmSpot(w: World, h: Human): { x: number; y: number; home: boolean } | null {
  const home = h.home ? w.shelters.find((s) => s.id === h.home && shelterDone(s)) : undefined;
  if (home && (HOUSING[home.tier].warmth >= 0.55 || w.weather.snow > 0.6)) return { x: home.x, y: home.y + 6, home: true };
  const fire = pickFire(w, h, h);
  if (fire) return { x: fire.x, y: fire.y, home: false };
  return home ? { x: home.x, y: home.y + 6, home: true } : { x: w.camp.caveX, y: w.camp.caveY, home: true };
}

/** Jobs that stay at their posts even for an Urgent build (watch, the dragon slayers, the deep). */
const URGENT_SKIP = new Set<string>(["guard", "dragonSlayer", "miner", "researcher", "technician"]);

/**
 * A material an open build site needs that the stockpile has none of: anyone with nothing
 * better to do fetches it, so the builders (capped per site) aren't left waiting.
 */
function siteShortage(w: World): Resource | null {
  // the most urgent site's shortage first (priority.ts), then any other
  let best: Resource | null = null;
  let bp = -1;
  for (const s of w.buildSites()) {
    if (s.locked || !s.need || w.camp.stock[s.need] > 0) continue;
    const p = sitePrio(w, s);
    if (p > bp) {
      bp = p;
      best = s.need;
    }
  }
  return best;
}

/** Riding a heavy partner (a big work mount): carries four times as much. */
export function heavyRider(w: World, h: Human) {
  const d = h.riding && h.partner === h.riding ? partnerOf(w, h) : null;
  return !!d && riderType(d) === "heavy";
}

/**
 * Someone out on a job meets a predator, raider or Neanderthal: if the armed friends around
 * them could win the fight, they stand and fight it together ("fight"); if not, they run
 * for it ("run" — even a guard or hunter, when they're badly outnumbered out there).
 * null = courage doesn't apply (not on a job, unarmed, a child, or sent to fight anyway).
 */
function rally(w: World, h: Human, task: Task | null | undefined, fightTask: boolean): "fight" | "run" | null {
  // people sent to fight (a hunt / guard / defend order) fight whatever the odds; this is for everyone out working
  if (fightTask || h.order || !onMission(h, task) || !canFight(w, h)) {
    h.rally = undefined;
    return null;
  }
  const foes = foesNear(w, h);
  if (!foes.length) return null;
  const band = bandNear(w, h);
  const holding = !!h.rally;
  if (courageScore(w, h, band, foes) < (holding ? COURAGE.hold : COURAGE.start)) {
    if (holding) say(h, band.length > 1 ? pick(w.rng, ["Too many — fall back!", "Back! Back!"]) : "I can't hold it alone!");
    h.rally = undefined;
    return "run";
  }
  const f = foes[0];
  const id = f.kind === "dino" ? f.d.id : f.b.id;
  const fx = f.kind === "dino" ? f.d.x : f.b.x;
  const fy = f.kind === "dino" ? f.d.y : f.b.y;
  if (!holding) {
    say(h, band.length >= 3 ? pick(w.rng, ["Together!", "There's more of us!", "Hold the line!"]) : band.length === 2 ? pick(w.rng, ["With me!", "We can take it!"]) : pick(w.rng, ["I've got this!", "Come on then!"]));
    if (!w.flags.has("courage")) {
      w.flags.add("courage");
      w.toast("⚔️", band.length > 1 ? `Strength in numbers! ${band.length} of your people stood their ground instead of running.` : `${h.name} stood their ground!`, h.x, h.y);
    }
  }
  h.rally = { id, band: band.length };
  // already fighting one of them: carry on
  if ((h.state === "hunt" || h.state === "aim") && foes.some((x) => (x.kind === "dino" ? x.d.id : x.b.id) === h.targetId)) return "fight";
  h.targetId = id;
  go(h, "hunt", fx, fy);
  return "fight";
}

function think(w: World, h: Human) {
  const camp = w.camp;
  h.think = 0.4 + w.rng() * 0.5;
  if (h.state === "tossed" || h.state === "lookUp" || h.state === "celebrate" || h.state === "down") return;
  if (h.state === "craft" && camp.crafting?.by === h.id && (w.shifts.active(w, h) || h.stateT < 3)) return;

  // a comrade on the same job (a raid, the unit) is down and fading: get to them, even mid-fight (death.ts)
  if (rescueThink(w, h, true)) return;
  // a nest raid that's falling back: everyone breaks off and heads home (dragonRaid.ts)
  const raid = w.tasks.get(h.taskId);
  if (raid?.kind === "dragonRaid" && raid.retreat && h.state !== "heal" && !h.egg) {
    const home = { x: w.camp.x, y: w.camp.y + 40 };
    if (Math.hypot(h.x - home.x, h.y - home.y) < 140) {
      raid.people = raid.people.filter((id) => id !== h.id);
      h.taskId = 0;
      h.order = null;
      go(h, "idle", h.x, h.y);
    } else if (h.state !== "walk" || Math.hypot(h.tx - home.x, h.ty - home.y) > 20) {
      h.order = null;
      go(h, "walk", home.x, home.y);
    }
    return;
  }
  // on a chariot hunt: boarding, marching beside the chariots, fighting, fetching eggs (chariots.ts)
  if (w.colony.hunt && huntThink(w, h)) return;
  const tribe = w.tribe;
  const role = tribe.roleOf(h);
  const weapon = tribe.weaponFor(w, h);
  const task = w.tasks.get(h.taskId);
  const fightTask = !!task && (task.kind === "hunt" || task.kind === "guard" || task.kind === "defend" || task.kind === "operate");
  const fighter = !!weapon && (role === "guard" || role === "hunter" || !!h.order || fightTask || h.state === "operate" || (h.shift === "night" && h.gear.weapon === "nightSidearm"));
  const battleRider = !!h.riding && role === "guard" && w.flags.has("rallyDinos");

  // Each civilian responds to danger around their own position, not an event elsewhere.
  const nearby = localDanger(w, h);
  const dragon = dragonNear(w, h);
  const safe = nearby?.kind === "raid" && tribe.safeInside(w, h);
  if (safe && !w.flags.has("safeInside")) {
    w.flags.add("safeInside");
    w.toast("🛡️", "Raid! But the walls are shut and the auto-defenses are up — everyone inside keeps working.", h.x, h.y);
  }
  if (safe && h.state === "hide" && h.stateT > 1) {
    go(h, "idle", h.x, h.y);
    say(h, "We're safe in here!");
  }
  // a Dragon Rider whose dragon is war-trained: they take to the air together and face it
  if (nearby && !safe && !task && h.dragon && dragonRiderDefend(w, h, nearby)) return;
  // a Dino Rider whose partner can fight rides at local danger instead of running from it
  if (nearby && !safe && !task && h.partner && riderCanFight(w, h) && riderDefend(w, h, nearby)) return;
  // a catapult's keeper mans it when enemies come in range (and keeps it repaired)
  if (h.catapult && !h.child && h.hp > 0.35 && !task && keeperThink(w, h)) return;
  // strength in numbers: armed people out on a job size up the fight, and a band that can win stands its ground
  const courage = nearby && !safe && (nearby.kind === "predator" || nearby.kind === "raid") ? rally(w, h, task, fightTask) : null;
  if (courage === "fight") return;
  if (h.rally && (!nearby || safe)) {
    // the danger's gone (or the walls have us): back to the job
    h.rally = undefined;
    if (h.state === "hunt" || h.state === "aim") go(h, "idle", h.x, h.y);
  }
  // (out on a job and badly outnumbered, even a guard or hunter runs for it)
  const civilian = h.child || h.hp < 0.45 || !fighter || courage === "run";
  if (nearby && !safe && civilian && !(task && (task.kind === "douse" || (task.kind === "dragonRaid" && nearby.kind === "dragon")))) {
    h.dangerUntil = w.elapsed + 3;
    if (!h.interrupted && h.state !== "flee" && h.state !== "hide") h.interrupted = { state: h.state, x: h.x, y: h.y, tx: h.tx, ty: h.ty };
    const keepDistance = nearby.kind === "volcano" ? (w.volcano.megaOn ? 1800 : 850) : nearby.kind === "fire" ? 115 : 110;
    const s = h.refuge && Math.hypot(h.refuge.x - nearby.x, h.refuge.y - nearby.y) > keepDistance
      && w.fire.heat[tileOf(h.refuge.x, h.refuge.y)] < 0.12 ? h.refuge : emergencySpot(w, h, nearby);
    h.refuge = s;
    if (h.state === "hide" && Math.hypot(h.x - s.x, h.y - s.y) < 14) return;
    if (h.state === "operate") leaveScorpion(w, h);
    if (Math.hypot(h.x - s.x, h.y - s.y) < 14 && s.open) {
      // reached open ground with the danger still close: crouching here hides nothing, so keep running
      const next = emergencySpot(w, h, nearby);
      h.refuge = next;
      go(h, "flee", next.x, next.y);
    } else if (Math.hypot(h.x - s.x, h.y - s.y) < 14) go(h, "hide", h.x, h.y);
    else {
      if (h.state !== "flee") say(h, nearby.kind === "dragon" ? "Dragon!" : nearby.kind === "fire" || nearby.kind === "volcano" ? "Fire!" : "Get to safety!");
      h.wantTop = false;
      go(h, "flee", s.x, s.y);
    }
    return;
  }
  if (h.dangerUntil && w.elapsed < h.dangerUntil && (h.state === "hide" || h.state === "flee")) return;
  if (h.dangerUntil && w.elapsed >= h.dangerUntil) {
    h.dangerUntil = 0;
    h.refuge = undefined;
    const old = h.interrupted;
    h.interrupted = undefined;
    if (old && (h.state === "hide" || h.state === "flee")) {
      if (old.state === "walk" || old.state === "carry" || old.state === "explore") go(h, old.state, old.tx, old.ty);
      else if (old.state === "gather" || old.state === "fish" || old.state === "build" || old.state === "farm") go(h, "walk", old.x, old.y);
      else go(h, "idle", h.x, h.y);
      return;
    }
  }
  if (h.stranger) return strangerThink(w, h);

  // a Neanderthal coming at me: fight back if armed, otherwise run for it
  const brute = h.child ? null : w.rivals.brutes.find((b) => b.state === "fight" && b.targetId === h.id && Math.hypot(b.x - h.x, b.y - h.y) < 160);
  if (brute && !battleRider && h.level === 0 && h.state !== "aim" && h.state !== "hunt" && h.state !== "operate") {
    if (weapon && h.hp > 0.35) {
      h.targetId = brute.id;
      go(h, "hunt", brute.x, brute.y);
      say(h, pick(w.rng, ["Neanderthal!", "Back off, brute!", "Fight!"]));
    } else {
      const a = Math.atan2(h.y - brute.y, h.x - brute.x);
      if (h.state !== "flee") say(h, pick(w.rng, ["RUN!", "Big brute!", "Help!"]));
      go(h, "flee", h.x + Math.cos(a) * 220, h.y + Math.sin(a) * 170);
    }
    return;
  }

  // a scorpion crew stays put while there's anything to shoot
  if (h.state === "operate") {
    if (task?.kind === "operate") return;
    if (tribe.raid || w.dragons.menacing(w) || h.stateT < 30) return;
    leaveScorpion(w, h);
  }

  // 1. danger → fight (if armed + on duty) or run for the cave. Scorpion crews head for their Scorpion.
  const crewing = w.colony.scorpions.some((s) => s.crew === h.id);
  const threat = crewing ? null : dangerNear(w, h);
  if (threat && fighter && !battleRider && Math.hypot(threat.x - h.x, threat.y - h.y) > 50) {
    h.targetId = threat.id;
    go(h, "aim", h.x, h.y);
    return;
  }
  if (!crewing && dragon && fighter && !battleRider && weapon && !weapon.melee && dragon.z < 220) {
    const dist = Math.hypot(dragon.x - h.x, dragon.y - h.y);
    const chasing = task?.kind === "dragonRaid" || (h.order?.kind === "hunt" && h.order.id === dragon.id);
    if (dist <= weapon.range) {
      h.targetId = dragon.id;
      go(h, "aim", h.x, h.y);
      return;
    }
    // out of bow range: a raider (or someone sent after it) closes in; everyone else carries on
    if (chasing) {
      h.targetId = dragon.id;
      go(h, "hunt", dragon.x, dragon.y);
      return;
    }
  }
  if (threat && !battleRider) {
    const def = sp(threat.species);
    const brave = !h.child && camp.learned.has("spear") && Math.hypot(h.x - camp.x, h.y - camp.y) < 220 && def.size < 110;
    const hunting = threat.targetId === h.id || ((threat.state === "chase" || threat.state === "stalk") && Math.hypot(threat.x - h.x, threat.y - h.y) < 140);
    if (brave) {
      // wave it off, then get back to work (only stop working if it's actually coming for us)
      if (h.stateT > 1.5 || h.state !== "idle") {
        say(h, pick(w.rng, ["Shoo!", "Go away!", "Hyaaa!"]));
        threat.fear = Math.min(1, threat.fear + 0.5);
        if (w.rng() < 0.5) w.scare(threat, h.x, h.y);
        h.dir = threat.x > h.x ? 1 : -1;
      }
      if (hunting) {
        go(h, "idle", h.x, h.y);
        return;
      }
    } else {
    if (h.state !== "flee" && h.state !== "hide") {
      say(h, pick(w.rng, ["Eek!", "RUN!", "Dino!!", "Aaah!"]));
      w.sfx("yelp", h.x, h.y, 0.6);
      if (h.carry && h.carry !== "fish") {
        h.carry = null;
        h.carryN = 0;
      }
    }
    // riders just gallop away
    const s = emergencySpot(w, h, { x: threat.x, y: threat.y, kind: "predator" });
    go(h, "flee", s.x, s.y);
    return;
    }
  }

  // 2. freezing → warm up by a fire or at home
  if (h.warmth < 0.3 && !fightTask) {
    const spot = warmSpot(w, h);
    if (spot) {
      if (Math.hypot(h.x - spot.x, h.y - spot.y) < 14) go(h, spot.home ? "hide" : "sitFire", h.x, h.y);
      else {
        if (h.state !== "walk" && w.rng() < 0.25) say(h, pick(w.rng, ["Brrr!", "So cold!", "Fire, please!"]));
        go(h, "walk", spot.x, spot.y);
      }
      return;
    }
  }
  if ((h.state === "sitFire" || h.state === "hide") && h.warmth < 0.7 && w.snow.chill(w, h.x, h.y) > 0.3) return;

  // 3. hurt → rest up (unless the player says otherwise)
  if (h.hp < 0.35 && !task && h.state !== "rest") {
    const hut = w.colony.buildings.find((b) => b.kind === "healer" && b.built >= 1);
    const spot = hut ? w.colony.door(hut) : shelterSpot(w, h);
    if (Math.hypot(h.x - spot.x, h.y - spot.y) < 14) go(h, "rest", h.x, h.y);
    else go(h, "walk", spot.x, spot.y);
    return;
  }
  if (h.state === "rest" && h.hp < 0.8 && !task) return;

  // Shift change: an ongoing action finishes its current beat; its task stays on
  // the board for the incoming crew. Workers peel off at different clock times.
  const scheduled = w.shifts.mode === "split" && !!h.shift && !h.child;
  const shiftOff = scheduled && !w.shifts.active(w, h);
  const finishing = ["gather", "fish", "build", "farm", "repair", "carry", "haul", "craft", "smith", "research", "resonate", "train", "tame", "cook", "walk", "explore"].includes(h.state) && (h.stateT < 3 || (!!h.carry && h.state === "carry"));
  const eveningMeal = h.shift === "day" && w.time >= 18 && w.time < 19.2 && h.energy > 0.32;
  if (shiftOff && !finishing && !h.order && !fightTask && task?.kind !== "douse" && h.state !== "operate") {
    if (task?.open) {
      task.people = task.people.filter((id) => id !== h.id);
      h.taskId = 0;
      h.taskStep = 0;
      h.site = "";
    }
    if (h.shift === "night" && h.energy > 0.88 && w.time >= 10 && w.time < 17.5 && goRelax(w, h, { covered: true, reach: 500, from: h })) return;
    if (eveningMeal && h.state !== "sleep") {
      const seat = pickFire(w, h);
      if (seat) { if (Math.hypot(h.x - seat.x, h.y - seat.y) < 6) go(h, "sitFire", seat.x, seat.y); else go(h, "walk", seat.x, seat.y); return; }
    }
    if (h.state !== "sleep") {
      if (h.riding) dismountHome(w, h);
      const s = shelterSpot(w, h);
      if (Math.hypot(h.x - s.x, h.y - s.y) < 14) go(h, "sleep", h.x, h.y);
      else go(h, "walk", s.x, s.y);
    }
    return;
  }

  // 4. storms + night → shelter / cave (player tasks keep going until dark)
  const night = w.daylight < 0.25;
  const onWatch = (role === "guard" || h.state === "operate") && !h.child && h.energy > 0.15;
  const busy = !!task && (!night || (scheduled && h.shift === "night"));
  // rainproof hides keep people out working in the wet; furs keep them going in the snow
  const tooWet = rainSendsIn(w, h);
  const tooCold = w.weather.snow > 0.85 && coatWarmth(h) < 0.6;
  // caught in the rain by day: a covered rest area close by is as good as home
  if (!onWatch && !busy && tooWet && !tooCold && !night && h.state !== "relax" && goRelax(w, h, { covered: true, reach: 350, from: h })) return;
  if (h.state === "relax" && tooWet) return;
  if (!onWatch && !busy && (tooWet || tooCold || (night && !scheduled && h.energy < 0.6))) {
    if (h.state === "hide" || h.state === "sleep") return;
    if (h.riding) dismountHome(w, h);
    const s = shelterSpot(w, h);
    if (Math.hypot(h.x - s.x, h.y - s.y) < 14) {
      go(h, night ? "sleep" : "hide", h.x, h.y);
      if ((w.weather.storm > 0.5 || w.weather.snow > 0.5) && w.rng() < 0.3) say(h, "Brrr!");
    } else {
      if (h.child && w.weather.storm > 0.5 && h.state !== "walk") say(h, "Storm! Run inside!");
      go(h, "walk", s.x, s.y);
    }
    return;
  }
  if (h.state === "hide" && h.stateT < 4) return;
  if (h.state === "sleep") {
    if ((scheduled && !shiftOff) || (!scheduled && (!night || h.energy > 0.95))) go(h, "idle", h.x, h.y + 20);
    else return;
  }
  if (h.state === "flee" || h.state === "hide" || h.state === "rest") {
    go(h, "idle", h.x, h.y);
    if (w.tribe.wonCheer > 0 && w.rng() < 0.5) {
      go(h, "celebrate", h.x, h.y);
      say(h, pick(w.rng, ["We made it!", "Hooray!", "Phew!"]));
    }
  }

  // busy with something that finishes on its own
  if (h.state === "gather" || h.state === "fish" || h.state === "build" || h.state === "eat" || h.state === "heal" || h.state === "tame" || h.state === "train" || h.state === "smith" || h.state === "douse" || h.state === "research" || h.state === "resonate" || h.state === "stargaze" || h.state === "relax" || h.state === "dragonCare" || h.state === "sonic" || h.state === "drill" || h.state === "lift" || h.state === "dragonPlay" || h.state === "show" || h.state === "watch" || h.state === "press" || h.state === "clear") return;
  if (h.state === "hunt" || h.state === "aim" || h.state === "haul" || h.state === "cook" || h.state === "farm" || h.state === "repair") return;
  if (h.state === "carry" || h.state === "walk" || h.state === "explore") {
    if (Math.hypot(h.tx - h.x, h.ty - h.y) > 6 && !(h.riding && w.flags.has("rallyDinos") && role === "guard" && !h.taskId)) return;
  }

  // the feast table: carrying the dragon roast over, or in line for a plate (feast.ts)
  if (feastThink(w, h, !!task)) return;

  // 5. hungry → eat from the stockpile
  if (h.hunger > (task ? 0.85 : 0.6) && tribe.foodTotal(w) + (h.hunger > 0.9 ? camp.stock.meat : 0) > 0) {
    const area = homeArea(w, h);
    const meal = w.colony.dropOff(w, area.x, area.y, "cooked");
    if (Math.hypot(h.x - meal.x, h.y - meal.y) < 20) go(h, "eat", h.x, h.y);
    else go(h, "walk", meal.x, meal.y);
    return;
  }

  // a Clear area job: chop the box down to grass (clearArea.ts)
  if (h.clearJob && clearThink(w, h)) return;

  // the town gets cleaned up first: dead animals + loose bones inside our borders (cleanup.ts)
  if (!task && cleanupThink(w, h)) return;

  // 6. the player's orders come before anything the tribe would choose
  if (task && taskThink(w, h)) return;
  if (h.taskId && w.tasks.get(h.taskId)?.kind === "operate") return;

  // 7. a friend is knocked out nearby → help them up (see rescueThink, which runs earlier for comrades on a job)
  if (!h.child && !h.taskId && !nearby && rescueThink(w, h, false)) return;

  // 8. fire near camp → bucket brigade
  if (!h.child && !h.taskId && (role === "gatherer" || role === "builder" || role === "farmer" || role === "cook") && w.tribe.fireAlarm && Math.hypot(h.x - w.tribe.fireAlarm.x, h.y - w.tribe.fireAlarm.y) < 520 && camp.learned.has("firefighting")) {
    if (douseThink(w, h, () => undefined)) return;
  }

  // a dragon show is on: the audience goes to sit round the pit (keepers perform)
  if (w.dragons.show && (watchThink(w, h) || w.dragons.show.acts.some((id) => w.dragons.owned.find((d) => d.id === id)?.keeper === h.id))) return;

  // a Dragon Rider climbs on when their dragon is called out
  if (!h.child && h.dragon && !h.taskId && dragonRiderThink(w, h)) return;
  // …and between fights, the pair take on jobs for the tribe: scouting, ferrying, cargo, patrols (riderDuty.ts)
  if (!h.child && h.dragon && !h.taskId && riderDutyThink(w, h)) return;

  // a Dino Rider looks after their partner, scouts, and rides to work
  if (!h.child && h.partner && !h.taskId && riderThink(w, h)) return;

  // 4. evening by the fire: everyone off duty (guards keep watch; builders finish what's open first)
  const offDuty = h.child || (role !== "guard" && !(role === "builder" && tribe.nextJob(w)));
  if (offDuty && !h.order && (w.daylight < 0.45 || (h.child && w.rng() < 0.2))) {
    const seat = pickFire(w, h);
    if (seat) {
      if (Math.hypot(h.x - seat.x, h.y - seat.y) < 6) go(h, "sitFire", seat.x, seat.y);
      else go(h, "walk", seat.x, seat.y);
      return;
    }
    // every fire full: the seating ring beside one
    if (goRelax(w, h, { nearFire: true })) return;
  }

  if (h.child) return childThink(w, h);

  // riders with nothing to do take their mount home to rest
  if (h.riding && !h.taskId && role !== "gatherer" && role !== "builder" && role !== "hunter" && !(role === "guard" && w.flags.has("rallyDinos")) && (w.dinoById(h.riding)?.work?.boardUntil ?? 0) < w.elapsed) {
    dismountHome(w, h);
    return;
  }

  // pitch in on an open player task close by
  if (role === "gatherer" && h.state === "idle" && joinTask(w, h, true)) return;

  // craft when the goal is ready (gatherers + builders are the inventors)
  if ((role === "gatherer" || role === "builder") && !h.order && camp.ready() && !camp.crafting && !w.humans.some((o) => o !== h && o.task === "craft")) {
    h.task = "craft";
    go(h, "walk", camp.craftX + 12, camp.craftY);
    return;
  }

  // still holding a load that no job wants any more (the order ended, Auto changed their role):
  // put it away first, or a new guard would stand watch with a bag of bones forever
  if (h.carry && h.carryN > 0 && !h.site && !h.taskId && h.state !== "carry") {
    const drop = w.colony.dropOff(w, h.x, h.y, h.carry);
    go(h, "carry", drop.x, drop.y);
    return;
  }

  // a break in the shade between jobs: when tired, in the midday heat, or now and then
  if (!h.order && !h.taskId && !h.carry && !h.riding && role !== "guard" && w.daylight > 0.45 && !w.tribe.raid) {
    const hot = w.weather.temp > 0.8 && w.time > 11 && w.time < 15;
    if ((h.energy < 0.4 || (hot && w.rng() < 0.3) || w.rng() < 0.03) && goRelax(w, h, { reach: 450, from: h })) return;
  }

  // fire's out: the emitter goes back on the fire station's rack
  if (h.sonic && !h.taskId && returnEmitter(w, h)) return;

  // an Urgent build (priority.ts): everyone free who isn't on watch drops their usual job to gather, haul and build for it
  if (!h.order && !h.taskId && !URGENT_SKIP.has(role) && urgentSite(w) && buildThink(w, h, (s) => sitePrio(w, s) === URGENT)) return;

  // 5b. the job they've been given (or picked up automatically)
  if (roleThink(w, h)) return;

  // Once their assigned work runs out, adults help finish new builds and upgrades.
  if (role !== "builder" && !h.order && !h.taskId && buildThink(w, h, () => true)) return;

  // build the shelter stage if the materials are in
  const site = camp.activeShelter(w);
  if (site) {
    const st = stagesOf(site)[site.stage];
    if (site.have >= st.n && !w.humans.some((o) => o !== h && o.task === "build")) {
      h.task = "build";
      go(h, "walk", site.x + 26, site.y + 6);
      return;
    }
    // carry materials from the pile to the site
    if (site.have < st.n && camp.stock[st.need] > 0 && !h.carry) {
      const n = Math.min(camp.stock[st.need], camp.learned.has("basket") ? 2 : 1);
      camp.stock[st.need] -= n;
      h.carry = st.need;
      h.carryN = n;
      go(h, "carry", site.x + 20, site.y + 4);
      return;
    }
  }

  // a dinosaur body lying near camp: harvest it
  if (role === "gatherer" && autoButcher(w, h, 700)) return;

  // Urgent plans first (including whatever a build site is stuck waiting for), then restock the lowest supplies evenly.
  const research = researchShortages(w);
  const urgent = camp.missing(w) ?? w.colony.missing(w) ?? siteShortage(w);
  const priority = [...(urgent ? [urgent] : []), ...research.filter((r) => r !== urgent)];
  let needs = [...priority, ...stockPriorities(w).filter((r) => !priority.includes(r))];
  // nothing short: keep topping up whatever's lowest (now and then they take a break or go exploring instead)
  if (!needs.length && w.rng() < 0.7) needs = stockPriorities(w, true);
  // the lowest supplies first, two people each, then the next lowest… (carts for the bulky loads)
  const job = pickNeed(w, h, needs, (r) => sourceFor(w, h, r, undefined, undefined, research.includes(r) ? Math.hypot(WORLD_W, WORLD_H) : 900));
  if (job) {
    h.task = job.r;
    h.targetId = job.src.id;
    go(h, "walk", job.src.x, job.src.y);
    if (hasCart(w, h) && !w.flags.has("carts")) {
      w.flags.add("carts");
      w.toast("🛒", `${h.name} took a cart out: twice the load of ${job.r} each trip! Everyone heads for whatever the camp is lowest on, two at a time.`, h.x, h.y);
    }
    return;
  }

  // 8. leisure: a seat in the shade (most of all on hot days), chat, explore, wander
  if (w.daylight > 0.45 && (w.weather.temp > 0.75 || w.rng() < 0.45) && goRelax(w, h)) return;
  const r = w.rng();
  if (r < 0.2) {
    const friend = w.humans.find((o) => o !== h && Math.hypot(o.x - h.x, o.y - h.y) < 80 && (o.state === "idle" || o.state === "talk"));
    if (friend) {
      go(h, "talk", h.x, h.y);
      h.dir = friend.x > h.x ? 1 : -1;
      say(h, pick(w.rng, ["Ooga?", "Booga!", "Ugh.", "Mmm, fire.", "Big dino!", "Rock good.", "Hungry…"]));
      w.sfx("babble", h.x, h.y, 0.5);
      return;
    }
  }
  if (r < 0.32) {
    // scouts wander toward unexplored corners (hidden deposits get found this way)
    const hidden = w.colony.nodes.filter((n) => !n.found);
    if (hidden.length && r < 0.24) {
      const n = hidden[Math.floor(w.rng() * hidden.length)];
      go(h, "explore", n.x + (w.rng() - 0.5) * 260, n.y + (w.rng() - 0.5) * 200);
      return;
    }
    const lm = pick(w.rng, [LM.lake, LM.beach, LM.feeding, LM.waterfall]);
    go(h, "explore", lm.x * TILE + (w.rng() - 0.5) * 200, lm.y * TILE + 120 + (w.rng() - 0.5) * 100);
    return;
  }
  const leisureHome = homeArea(w, h);
  go(h, "walk", leisureHome.x + (w.rng() - 0.5) * 260, leisureHome.y + (w.rng() - 0.5) * 140);
}

function arrive(w: World, h: Human) {
  const camp = w.camp;
  if (h.state === "carry") {
    if (h.site === "douse" && h.carry === "water") {
      go(h, "douse", h.x, h.y);
      return;
    }
    if (h.carry && h.site && deliverToSite(w, h)) return;
    const site = camp.activeShelter(w);
    if (site && h.carry && Math.hypot(h.x - site.x, h.y - site.y) < 50) {
      const used = camp.deliverToShelter(w, site, h.carry, h.carryN);
      const left = h.carryN - used;
      if (left > 0) camp.stock[h.carry] += left;
    } else if (h.carry) {
      camp.stock[h.carry] += h.carryN;
      if (h.carry === "fish") say(h, "Fish!");
    }
    h.carry = null;
    h.carryN = 0;
    h.task = null;
    h.wantTop = false;
    go(h, "idle", h.x, h.y);
    return;
  }
  if (h.state === "walk") {
    h.wantTop = h.wantTop && (!!h.order || !!h.taskId);
    if (h.task === "craft") {
      if (camp.startCraft(w, h.id)) {
        go(h, "craft", h.x, h.y);
        h.dir = -1;
        say(h, "Hmm…", 3);
      } else h.task = null;
      return;
    }
    if (h.task === "build") {
      go(h, "build", h.x, h.y);
      h.dir = -1;
      return;
    }
    if (h.task === "fish") {
      go(h, "fish", h.x, h.y);
      return;
    }
    if (h.task === null) {
      if (!h.taskId && sitIfAtShade(w, h)) return;
      go(h, "idle", h.x, h.y);
      return;
    }
    go(h, "gather", h.x, h.y);
    return;
  }
  if (h.state === "explore") {
    go(h, "idle", h.x, h.y);
    if (w.rng() < 0.5) say(h, pick(w.rng, ["Ooh!", "Pretty!", "Water!", "Wow."]));
  }
}

function finishGather(w: World, h: Human) {
  const r = h.task as Resource;
  const basket = w.camp.learned.has("basket");
  // a cart (or a dino to carry it) takes a much bigger load
  const ride = h.riding ? (heavyRider(w, h) ? 4 : 3) : hasCart(w, h) ? 2 : 1;
  // deposits: ore, clay, flint, artifacts…
  const node = h.targetId > 0 ? w.colony.nodeById(h.targetId) : null;
  if (node && Math.hypot(node.x - h.x, node.y - h.y) < 60) {
    const got = w.colony.mine(w, node);
    h.task = null;
    if (!got.r) {
      go(h, "idle", h.x, h.y);
      taskCarrying(w, h);
      return;
    }
    h.carry = got.r;
    h.carryN = Math.max(1, got.amount) * (basket ? 2 : 1) * ride;
    taskCarrying(w, h);
    const drop = w.colony.dropOff(w, h.x, h.y, h.carry);
    go(h, "carry", drop.x, drop.y);
    return;
  }
  // a thing lying on the ground (or a dinosaur body: cut a load off it)
  if (h.targetId < 0) {
    const it = w.items.find((i) => i.id === -h.targetId);
    if (it && it.carcass) {
      const got = cutCarcass(w, it, r, (basket ? 4 : 2) * ride);
      h.task = null;
      if (!got) {
        go(h, "idle", h.x, h.y);
        taskCarrying(w, h);
        return;
      }
      h.carry = got.r;
      h.carryN = got.n;
      if (!w.flags.has("firstHarvest")) {
        w.flags.add("firstHarvest");
        w.discover("butcher", h.x, h.y);
        w.toast("🔪", "Harvesting a dinosaur: meat for food, hide for clothes + tents, bones for tools + spikes!", h.x, h.y);
      }
      if ((got.r === "hide" || got.r === "bone") && !w.flags.has(`first-${got.r}`)) {
        w.flags.add(`first-${got.r}`);
        w.toast(got.r === "hide" ? "🟫" : "🦴", got.r === "hide" ? "First dinosaur hide! Build a Hide rack to make cloaks + rainproof gear." : "First bones! Use them for bone spears, knives, spikes + totems.", h.x, h.y);
      }
      taskCarrying(w, h);
      const drop = w.colony.dropOff(w, h.x, h.y, got.r);
      go(h, "carry", drop.x + (w.rng() - 0.5) * 16, drop.y);
      return;
    }
    if (it) w.removeItem(it);
  }
  const plant = h.targetId > 0 ? w.plants.find((p) => p.id === h.targetId) : undefined;
  if (r === "wood") {
    if (!w.camp.learned.has("axe")) {
      h.task = null;
      say(h, "Need an axe!");
      go(h, "idle", h.x, h.y);
      taskCarrying(w, h);
      return;
    }
    if (plant && !plant.stump) {
      plant.stump = true;
      plant.food = 0;
      plant.fruit = 0;
      plant.shake = 1;
      w.sfx("timber", plant.x, plant.y, 0.8);
      for (let i = 0; i < 6; i++) w.particles.spawn(P.Leaf, plant.x, plant.y, { z: 30 + w.rng() * 50, vx: (w.rng() - 0.5) * 60, vz: 20, g: 40, size: 4, max: 1.6, color: "#6b8f3c" });
    }
  } else if (plant && (r === "leaves" || r === "berries")) {
    plant.food = Math.max(0, plant.food - 0.3);
    plant.shake = 0.6;
  } else if (plant && r === "stick") plant.shake = 0.5;
  if (r === "stone" && h.targetId > 0) {
    // boulders crumble a little each time
    const b = w.props.find((p) => p.id === h.targetId && p.kind === "boulder");
    if (b) {
      b.size -= 0.12;
      w.particles.burst(P.Rock, b.x, b.y, 4, 40, { vz: 60, g: 200, size: 2.5, max: 0.7, color: "#8f8a82" });
      if (b.size < 0.35) w.props.splice(w.props.indexOf(b), 1);
    }
  }
  if (r === "tar" && !w.flags.has("tarScoop")) {
    w.flags.add("tarScoop");
    w.toast("🛢️", "Sticky tar! Great for waterproofing bows and shields.", h.x, h.y);
  }
  h.carry = r;
  h.carryN = (r === "wood" ? 1 + (basket ? 1 : 0) : basket ? 2 : 1) * ride * (h.child ? 0.5 : 1);
  h.carryN = Math.max(1, Math.round(h.carryN));
  h.task = null;
  taskCarrying(w, h);
  if (h.site === "douse" && r === "water") {
    const near = w.tribe.fireAlarm ?? null;
    go(h, "carry", near ? near.x : h.x, near ? near.y + 26 : h.y);
    return;
  }
  const drop = w.colony.dropOff(w, h.x, h.y, r);
  go(h, "carry", drop.x + (w.rng() - 0.5) * 16, drop.y);
}

const STORIES = {
  sky: ["…and the stars wheel round the cold one that never moves.", "When the moon is fat, the river runs high. Remember that.", "A fire fell from the sky once, and the ground shook for days…"],
  old: ["Long ago, the first fire was stolen from the mountain…", "Grandmother tamed a three-horn, you know. Bare-handed!", "Never camp where the tar smells sweet. Never."],
  hunt: ["So I said to the big-tooth: not today!", "Track the herd at dawn, the big ones sleep late.", "The best spear is the one you didn't throw."],
};

/**
 * Evenings at the fire. The adult who's been sitting longest tells stories now and then:
 * star tales teach the sky watchers a little, old tales feed research, and children at the
 * fire learn from it all (they grow up faster than kids left on their own).
 */
function fireTime(w: World, h: Human, dt: number) {
  if (!h.fireId) {
    if (w.rng() < dt * 0.05) say(h, pick(w.rng, ["Warm…", "Mmm.", "Stars!"]));
    return;
  }
  let teller: Human | null = null;
  for (const o of w.humans) if (o.fireId === h.fireId && o.state === "sitFire" && !o.child && (!teller || o.stateT > teller.stateT)) teller = o;
  if (h.child) {
    // a grown-up at the fire: listening + learning
    if (teller) h.age += dt * 0.6;
    if (w.rng() < dt * 0.03) say(h, pick(w.rng, ["And then what?", "Again!", "Ooh…"]));
    return;
  }
  if (teller !== h) {
    if (w.rng() < dt * 0.03) say(h, pick(w.rng, ["Ha!", "Mmm.", "Tell the one about the volcano!"]));
    return;
  }
  // the storyteller: a tale every 20 s or so, if anyone's listening
  if (w.rng() > dt / 20) return;
  if (!w.humans.some((o) => o !== h && o.fireId === h.fireId && o.state === "sitFire")) return;
  const kind = pick(w.rng, ["sky", "old", "hunt"] as const);
  say(h, pick(w.rng, STORIES[kind]), 4);
  if (kind === "sky") w.sky.knowledge += 2;
  else if (kind === "old" && w.civ.current) w.civ.addRp(w, 0.5);
  if (!w.flags.has("storyTime")) {
    w.flags.add("storyTime");
    w.toast("📖", "Story time by the fire! Children who listen grow up faster, and old tales help the sky watchers + research.", h.x, h.y);
  }
}

/** How high a rider sits: on the back of the animal (up with it, on a flyer; long-necked giants are tall at the shoulder). */
export function saddleZ(d: Dino) {
  const def = sp(d.species);
  if (def.move === "fly") return d.z + Math.max(6, sizeOf(d) * 0.13);
  const tall = d.species === "brachio" ? 0.5 : d.species === "apato" ? 0.45 : 0.38;
  return Math.max(18, sizeOf(d) * tall);
}

export function updateHuman(w: World, h: Human, dt: number) {
  const passengerMount = h.riding ? w.dinoById(h.riding) : null;
  if (passengerMount && h.id !== passengerMount.rider && passengerMount.passengers?.includes(h.id)) {
    const seat = passengerMount.passengers.indexOf(h.id);
    h.x = passengerMount.x + (seat === 0 ? -15 : 15) * passengerMount.dir;
    h.y = passengerMount.y - 2;
    h.z = saddleZ(passengerMount);
    h.anim += dt * Math.max(0.2, Math.hypot(passengerMount.vx, passengerMount.vy) / 30);
    return;
  }
  if (h.aloft) {
    aloftTick(w, h, dt);
    return;
  }
  if (h.ferry) {
    // a passenger on someone's dragon (riderDuty.ts)
    ferryTick(w, h, dt);
    return;
  }
  if (h.slowT) h.slowT = Math.max(0, h.slowT - dt);
  if (h.chariot) {
    // aboard a war chariot: it carries them (chariots.ts)
    return;
  }
  if (h.falling) {
    // dropped from a dragon's claws: falling (the dragons move the body)
    h.vx = h.vy = 0;
    return;
  }
  if (h.rescuedBy) {
    // caught by one of our dragons: held safe in its claws on the way down
    const dr = w.dragons.owned.find((d) => d.id === h.rescuedBy);
    if (!dr || dr.saved !== h.id) {
      h.rescuedBy = undefined;
      h.z = 0;
    } else {
      h.x = dr.x;
      h.y = dr.y + 2;
      h.z = Math.max(0, dr.z - 26);
      h.state = "tossed";
      h.anim += dt * 4;
      return;
    }
  }
  if (h.snatched) {
    // in a wild dragon's claws: dangling under it, kicking
    const dr = w.dragons.byId(h.snatched);
    if (!dr || dr.prey !== h.id) {
      h.snatched = undefined;
      h.z = 0;
    } else {
      h.x = dr.x;
      h.y = dr.y + 2;
      h.z = Math.max(0, dr.z - 26);
      h.state = "tossed";
      h.anim += dt * 8;
      if (w.rng() < dt * 0.6) say(h, pick(w.rng, ["HELP!", "Put me down!", "Aaaah!"]));
      return;
    }
  }
  if (h.riding && passengerMount && passengerMount.owner && h.level === 0 && insideWalls(w, h.x, h.y)) {
    // animals stay outside the walls: the rider hops off at the gate
    const d = passengerMount;
    dismount(w, h);
    say(h, `Wait out here, ${d.name}!`);
    const out = outsideSpot(w, d.x, d.y);
    d.x = out.x;
    d.y = out.y;
  }
  h.stateT += dt;
  h.hunger = clamp(h.hunger + dt * 0.0025, 0, 1);
  h.energy = clamp(h.energy + (h.state === "sleep" ? dt * 0.03 : -dt * 0.002), 0, 1);
  h.fear = Math.max(0, h.fear - dt * 0.2);
  if (h.bubble) {
    h.bubble.t -= dt;
    if (h.bubble.t <= 0) h.bubble = null;
  }
  if (h.captive) {
    // carried off or held at a Neanderthal camp: the clan moves them, nothing else happens
    h.vx = h.vy = 0;
    // (out on a chore for the clan, clanCaptives.ts moves them)
    if (h.state !== "captive" && !h.chore) h.state = "captive";
    return;
  }
  updateWarmth(w, h, dt);
  recover(w, h, dt);
  // didn't make it (death.ts): they're gone
  if (!w.humans.includes(h)) return;
  if (h.state === "down") {
    h.vx = h.vy = 0;
    h.z = 0;
    return;
  }
  // fire + lava underfoot
  const here = tileOf(h.x, h.y);
  if (h.level === 0 && (w.fire.heat[here] > 0.35 || w.lava.heat[here] > 0.15) && w.rng() < dt * 2) hurtHuman(w, h, 0.12, h.x, h.y - 10, "burn");
  // explorers find hidden deposits just by walking past
  if ((w.frame + h.id) % 12 === 0) w.colony.discoverAround(w, h.x, h.y);

  if (h.state === "tossed") {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.z += h.vz * dt;
    h.vz -= 420 * dt;
    if (!walkOk(w, h, h.x, h.y) && h.z < 20) {
      h.vx *= -0.5;
      h.vy *= -0.5;
    }
    if (h.z <= 0 && h.vz < 0) {
      h.z = 0;
      w.particles.burst(P.Dust, h.x, h.y, 6, 40, { size: 6, max: 0.8, color: "rgba(170,150,110,0.6)" });
      w.particles.spawn(P.Star, h.x, h.y, { z: 22, size: 6, max: 1.8 });
      say(h, "Ow ow ow!");
      const s = emergencySpot(w, h, { x: h.x - Math.sign(h.vx || 1) * 100, y: h.y, kind: "predator" });
      go(h, "flee", s.x, s.y);
    }
    return;
  }
  if (h.state === "lookUp") {
    if (h.stateT > 3.5) go(h, "idle", h.x, h.y);
    return;
  }

  h.think -= dt;
  if (h.think <= 0) think(w, h);
  // stand on the walkway / tower platform, otherwise on the ground
  if (h.state !== "celebrate") {
    const onTower = h.level === 1 && w.nav.isTower(tileOf(h.x, h.y));
    const mount = h.riding ? w.dinoById(h.riding) : null;
    // on its back (up in the air with it, on a flyer)
    const z = mount ? saddleZ(mount) : h.level === 1 ? (onTower ? TOWER_Z : WALK_Z) : 0;
    h.z += (z - h.z) * Math.min(1, dt * 10);
  }
  if (h.riding) {
    const m = w.dinoById(h.riding);
    if (m) {
      m.x = h.x;
      m.y = h.y;
      if (m.work?.job === "travel" && m.work.manual && Math.hypot(h.x - m.work.targetX, h.y - m.work.targetY) < 18) {
        m.work.job = null;
        m.work.manual = false;
        for (const id of [...(m.passengers ?? [])]) {
          const passenger = w.humans.find((other) => other.id === id);
          if (passenger) { dismount(w, passenger); go(passenger, "idle", passenger.x, passenger.y); }
        }
        dismount(w, h);
        go(h, "idle", h.x, h.y);
      }
    }
  }

  if (roleAct(w, h, dt)) return;

  switch (h.state) {
    case "walk":
    case "carry":
    case "flee":
    case "explore":
      if (moveHuman(w, h, dt)) {
        if (h.state === "flee") {
          // cover hides you; open ground doesn't — stand there and let the danger check decide (run on, or get back to work)
          if (h.refuge?.open && Math.hypot(h.x - h.refuge.x, h.y - h.refuge.y) < 20) go(h, "idle", h.x, h.y);
          else go(h, "hide", h.x, h.y);
          break;
        }
        arrive(w, h);
      } else if (h.stateT > 40) go(h, "idle", h.x, h.y);
      break;
    case "gather": {
      h.anim += dt * 4;
      const body = h.targetId < 0 ? w.items.find((i) => i.id === -h.targetId && i.carcass) : undefined;
      if (body) {
        h.dir = body.x > h.x ? 1 : -1;
        if (w.rng() < dt * 3 && w.inView(h.x, h.y, 50)) w.particles.spawn(P.Crumb, body.x + (w.rng() - 0.5) * 16, body.y - 4, { z: 8, vz: 40, vx: (w.rng() - 0.5) * 40, g: 160, size: 2, max: 0.5, color: w.rng() < 0.5 ? "#c8584a" : "#efe6cf" });
      }
      // wet hands work slowly (unless dressed for it)
      const slow = 1 + w.weather.rain * 0.6 * (1 - rainGuard(h));
      const dur = (body ? cutTime(w) : h.task === "wood" ? 4 : 2.2) * slow;
      if (h.stateT > dur) finishGather(w, h);
      else if (w.rng() < dt * 2 && w.inView(h.x, h.y, 50)) {
        w.particles.spawn(h.task === "wood" ? P.Crumb : P.Leaf, h.x + h.dir * 8, h.y, { z: 10, vz: 30, vx: (w.rng() - 0.5) * 30, g: 120, size: 2.5, max: 0.6, color: h.task === "stone" ? "#9a958c" : "#7a9a4a" });
        if (h.task === "wood") w.sfx("chop", h.x, h.y, 0.5);
      }
      break;
    }
    case "fish": {
      const dur = w.camp.learned.has("fishing") ? 5 : 11;
      if (h.stateT > dur) {
        const lucky = w.camp.learned.has("fishing") || w.rng() < 0.55;
        if (lucky) {
          h.carry = "fish";
          h.carryN = w.camp.learned.has("basket") ? 2 : 1;
          say(h, "Got one!");
          w.particles.burst(P.Splash, h.x + h.dir * 14, h.y - 4, 5, 40, { vz: 60, g: 200, size: 2, max: 0.6 });
          w.sfx("splash", h.x, h.y, 0.5);
        } else say(h, "Nope.");
        h.task = null;
        if (h.carry) go(h, "carry", w.camp.pileX, w.camp.pileY + 10);
        else go(h, "idle", h.x, h.y);
      }
      break;
    }
    case "build": {
      if (buildAct(w, h, dt)) break;
      const site = w.camp.activeShelter(w);
      if (!site) {
        h.task = null;
        go(h, "idle", h.x, h.y);
        break;
      }
      if (w.rng() < dt * 6) {
        w.particles.spawn(P.Crumb, site.x + (w.rng() - 0.5) * 30, site.y - 10, { z: 20, vz: 40, vx: (w.rng() - 0.5) * 40, g: 160, size: 2, max: 0.5, color: "#a07a4a" });
        if (w.rng() < 0.4) w.sfx("knock", site.x, site.y, 0.4);
      }
      if (h.stateT > 4) {
        w.camp.advanceShelter(w, site);
        h.task = null;
        go(h, "idle", h.x, h.y);
      }
      break;
    }
    case "craft":
      if (w.camp.crafting?.by !== h.id) {
        h.task = null;
        go(h, "idle", h.x, h.y);
      }
      break;
    case "eat":
      if (h.stateT > 2.5) {
        const s = w.camp.stock;
        // best food first: roast > fish > crops > berries > (raw meat if starving)
        const pickFood = (["cooked", "fish", "crop", "berries", "meat"] as Resource[]).find((r) => s[r] > 0);
        if (pickFood) {
          s[pickFood]--;
          h.hunger = pickFood === "cooked" ? -0.3 : pickFood === "meat" ? 0.3 : 0;
          if (pickFood === "cooked") h.energy = Math.min(1, h.energy + 0.2);
          say(h, pickFood === "cooked" ? "Yum! Roast!" : pickFood === "meat" ? "Raw?! Ugh…" : pickFood === "crop" ? "Crunchy!" : "Munch munch");
        }
        go(h, "idle", h.x, h.y);
      }
      break;
    case "celebrate":
      h.z = Math.abs(Math.sin(h.stateT * 8)) * 8;
      if (h.stateT > 3) {
        h.z = 0;
        go(h, "idle", h.x, h.y);
      }
      break;
    case "talk":
      if (h.stateT > 3) go(h, "idle", h.x, h.y);
      break;
    case "sitFire":
      fireTime(w, h, dt);
      // an evening cup of wine by the fire (vineyard.ts)
      if (w.rng() < dt * 0.05) maybeDrink(w, h);
      break;
    case "press":
      pressTick(w, h, dt);
      break;
    case "clear":
      clearAreaTick(w, h, dt);
      break;
    case "relax":
      relaxTick(w, h, dt);
      break;
    case "dragonCare":
      dragonCareTick(w, h, dt);
      break;
    case "sonic":
      sonicTick(w, h, dt);
      break;
    case "drill":
      drillTick(w, h, dt);
      break;
    case "lift":
      // heaving a building up (moving.ts moves the crew + the building)
      h.vx = h.vy = 0;
      h.anim += dt * 3;
      break;
    case "dragonPlay":
      playTick(w, h, dt);
      break;
    case "show":
    case "watch":
      // performing / watching a dragon show (shows.ts runs it)
      h.vx = h.vy = 0;
      h.anim += dt * (h.state === "show" ? 4 : 1);
      if (!w.dragons.show) {
        go(h, "idle", h.x, h.y);
        h.think = 0;
      }
      break;
    case "sleep":
      if (w.rng() < dt * 0.3 && w.inView(h.x, h.y, 50)) w.particles.spawn(P.Note, h.x, h.y, { z: 16, vz: 12, vx: 6, size: 8, max: 1.6, color: "z" });
      break;
    case "rest":
      if (w.rng() < dt * 0.4 && w.inView(h.x, h.y, 50)) w.particles.spawn(P.Heart, h.x, h.y, { z: 18, vz: 12, size: 4, max: 1.2 });
      break;
    case "heal": {
      const p = w.humans.find((o) => o.id === h.targetId);
      h.anim += dt * 3;
      if (!p || Math.hypot(p.x - h.x, p.y - h.y) > 40 || healTick(w, p, dt) || h.stateT > 14) {
        go(h, "idle", h.x, h.y);
        h.think = 0;
      }
      break;
    }
    case "tame": {
      const d = w.dinoById(h.targetId);
      if (!d || d.owner) {
        go(h, "idle", h.x, h.y);
        break;
      }
      if (w.rng() < dt * 1.2) w.particles.spawn(P.Heart, d.x, d.y, { z: sizeOf(d) * 0.6, vz: 16, size: 5, max: 1.2 });
      d.fear = 0;
      if (d.state !== "eat" && d.state !== "idle") {
        d.state = "idle";
        d.vx = d.vy = 0;
      }
      if (h.stateT > 3) {
        // a snack makes friends faster
        const snack = (["crop", "berries"] as Resource[]).find((r) => w.camp.stock[r] > 0);
        if (snack) w.camp.stock[snack]--;
        d.tame = Math.min(1, d.tame + (snack ? 0.34 : 0.15));
        say(h, d.tame >= 1 ? "Friends!" : pick(w.rng, ["Easy there…", "Good dino!", "Nice and slow…"]));
        h.stateT = 0;
        if (d.tame >= 1) {
          d.owner = true;
          d.homeX = w.camp.x + 160;
          d.homeY = w.camp.y + 160;
          const pen = w.colony.buildings.find((b) => b.kind === "pen" && b.built >= 1);
          if (pen) {
            d.homeX = pen.x;
            d.homeY = pen.y;
          }
          d.herd = 0;
          w.celebrate("New friend!");
          w.toast("🐾", `${h.name} befriended ${d.name} the ${sp(d.species).nick}!${sp(d.species).size > 60 ? " Select a person and tap it to ride." : ""}`, d.x, d.y);
          go(h, "idle", h.x, h.y);
          h.think = 0;
        }
      }
      break;
    }
    case "train": {
      const d = w.dinoById(h.targetId);
      if (!d || !d.owner || Math.hypot(d.x - h.x, d.y - h.y) > sizeOf(d) * 0.5 + 36) {
        go(h, "idle", h.x, h.y);
        h.think = 0;
        break;
      }
      d.vx = d.vy = 0;
      if (d.state !== "idle") d.state = "idle";
      const work = d.work;
      if (work?.trainer === h.id && work.focus) {
        const skill = work.focus;
        const snack = (["crop", "berries"] as Resource[]).find((r) => w.camp.stock[r] > 0);
        work.practice += dt;
        if (work.practice >= 10) {
          work.practice = 0;
          if (snack) w.camp.stock[snack]--;
          d.tame = Math.min(1, d.tame + (snack ? 0.06 : 0.025));
          say(h, snack ? `Good, ${d.name}!` : `Practice, ${d.name}!`);
        }
        work.skills[skill] = Math.min(1, (work.skills[skill] ?? 0) + (dt * trainBoost(w, h, d)) / (snack ? 90 : 135));
        if (w.rng() < dt * 0.5) w.particles.spawn(P.Heart, d.x, d.y, { z: sizeOf(d) * 0.5, vz: 12, size: 4, max: 1 });
        if (work.skills[skill] >= 1) {
          work.focus = null; work.trainer = 0;
          // every fully trained dinosaur can at least stand up for its people
          d.warTraining = Math.max(d.warTraining ?? 0, 0.35);
          say(h, `${d.name} learned ${skill}!`);
          w.toast("🦕", `${d.name} is trained for ${skill}.`, d.x, d.y);
          go(h, "idle", h.x, h.y); h.think = 0;
        }
        break;
      }
      d.warTraining = Math.min(1, (d.warTraining ?? 0) + (dt * trainBoost(w, h, d)) / (w.civ.has("cavalry") ? 30 : 45));
      const armor = d.warTraining >= 0.8 ? 2 : d.warTraining >= 0.35 ? 1 : 0;
      if (armor > (d.warArmor ?? 0)) {
        d.warArmor = armor;
        w.toast("🛡️", `${d.name} grew ${armor === 2 ? "strong battle plates" : "protective plates"} from training!`, d.x, d.y);
      }
      if (w.rng() < dt * 0.8) w.particles.spawn(P.Heart, d.x, d.y, { z: sizeOf(d) * 0.5, vz: 12, size: 4, max: 1 });
      if (d.warTraining >= 1) {
        say(h, `${d.name} is ready for battle!`);
        go(h, "idle", h.x, h.y);
        h.think = 0;
      }
      break;
    }
    case "research":
    case "resonate":
      w.civ.work(w, h, dt);
      break;
    case "smith":
      h.anim += dt * 4;
      if (!w.colony.forgeTick(w, h, dt) && !w.colony.current(w)) go(h, "idle", h.x, h.y);
      else if (w.colony.current(w) && !w.colony.affordable(w, w.colony.craftCost(w.colony.queue[0])) && w.colony.craftT <= 0) {
        say(h, "Need more stuff!");
        go(h, "idle", h.x, h.y);
      }
      break;
    case "douse": {
      if (h.stateT > 0.8) {
        w.fire.extinguish(w, h.x, h.y - 26, TILE * 2.2);
        w.particles.burst(P.Splash, h.x + h.dir * 10, h.y - 20, 10, 70, { vz: 80, g: 220, size: 2.5, max: 0.7 });
        w.particles.burst(P.Steam, h.x, h.y - 28, 4, 20, { vz: 30, size: 10, max: 1.2, color: "rgba(230,230,230,0.6)" });
        w.sfx("hiss", h.x, h.y, 0.7);
        h.carryN--;
        if (h.carryN <= 0) {
          h.carry = null;
          h.carryN = 0;
          h.site = "";
          go(h, "idle", h.x, h.y);
          h.think = 0;
        } else h.stateT = 0;
      }
      break;
    }
    case "operate":
      h.vx = h.vy = 0;
      break;
  }
}

/** Cold weather drains body heat; fires, homes + hearths restore it. */
function updateWarmth(w: World, h: Human, dt: number) {
  // getting soaked chills you; hide clothes keep the wet + cold out
  const outside = h.state !== "hide" && h.state !== "sleep" && h.state !== "rest";
  const soaked = outside ? w.weather.rain * 0.3 * (1 - rainGuard(h)) : 0;
  const chill = Math.min(1, (w.snow.chill(w, h.x, h.y) + soaked) * (1 - coatWarmth(h) * 0.75));
  let warm = 0;
  for (const f of w.campfires) if (f.lit && Math.abs(f.x - h.x) < 110 && Math.hypot(f.x - h.x, f.y - h.y) < 110) warm = Math.max(warm, 1);
  if ((h.state === "hide" || h.state === "sleep" || h.state === "rest") && h.home) {
    const s = w.shelters.find((x) => x.id === h.home);
    if (s && shelterDone(s)) warm = Math.max(warm, HOUSING[s.tier].warmth + (HOUSING[s.tier].hearth ? 0.3 : 0) + (w.colony.kits.has("hideCovers") ? 0.15 : 0));
  } else if (h.state === "hide" || h.state === "sleep") warm = Math.max(warm, 0.5);
  if (h.riding) warm = Math.max(warm, 0.2);
  h.warmth = clamp(h.warmth + dt * (warm * 0.05 - chill * 0.012 * (1 - warm) + (chill < 0.05 ? 0.02 : 0)), 0, 1);
  // frostbite: good winter gear keeps most of it off
  if (h.warmth < 0.06 && w.rng() < dt * 0.2 && h.hp > 0.25) hurtHuman(w, h, 0.03 * (1 - coatWarmth(h) * 0.7), h.x, h.y, "cold");
}

/** Kids: stay near camp, carry little things, tag along with grown-ups, play. Never fight. */
function childThink(w: World, h: Human) {
  const camp = w.camp;
  const r = w.rng();
  const nearCamp = (x: number, y: number) => Math.hypot(x - camp.x, y - camp.y) < 280;
  if (r < 0.22 && h.age > 80) {
    // little helpers: sticks + berries close to home
    const need: Resource = w.rng() < 0.5 ? "stick" : "berries";
    const src = sourceFor(w, h, need);
    if (src && nearCamp(src.x, src.y)) {
      h.task = need;
      h.targetId = src.id;
      go(h, "walk", src.x, src.y);
      say(h, need === "stick" ? "I'll get sticks!" : "Berries!");
      return;
    }
  }
  if (r < 0.4) {
    // learn by watching: follow a grown-up who's working near camp
    const busy = w.humans.find((o) => !o.child && !o.stranger && (o.state === "build" || o.state === "cook" || o.state === "farm" || o.state === "gather" || o.state === "smith") && nearCamp(o.x, o.y));
    if (busy) {
      go(h, "walk", busy.x + (w.rng() - 0.5) * 30, busy.y + 14);
      if (w.rng() < 0.4) say(h, pick(w.rng, ["What's that?", "Can I try?", "Ooh!", "I'm helping!"]));
      return;
    }
  }
  if (r < 0.62) go(h, "walk", camp.x + (w.rng() - 0.5) * 220, camp.y + (w.rng() - 0.5) * 120);
  else if (r < 0.74) go(h, "celebrate", h.x, h.y);
  else if (r < 0.82) say(h, pick(w.rng, ["Dino!", "Hee hee", "Look!", "Rawr!", "Tag, you're it!"]));
  else go(h, "idle", h.x, h.y);
}

/** Wanderers walk to the camp; once there (and it's safe) they join. */
function strangerThink(w: World, h: Human) {
  const c = w.camp;
  const dist = Math.hypot(h.x - c.x, h.y - c.y);
  if (dist < 300) {
    w.population.arrived(w, h);
    return;
  }
  const a = Math.atan2(c.y - h.y, c.x - h.x);
  go(h, "walk", c.x - Math.cos(a) * 200, c.y - Math.sin(a) * 120);
}

/** Leave the mount near camp (or the pen) and walk on. */
function dismountHome(w: World, h: Human) {
  const d = w.dinoById(h.riding);
  if (!d) {
    h.riding = 0;
    return;
  }
  const pen = w.colony.buildings.find((b) => b.kind === "pen" && b.built >= 1);
  const spot = pen ? { x: pen.x, y: pen.y } : { x: w.camp.x + 160, y: w.camp.y + 150 };
  if (Math.hypot(h.x - spot.x, h.y - spot.y) < 30) {
    for (const id of [...(d.passengers ?? [])]) {
      const passenger = w.humans.find((other) => other.id === id);
      if (passenger) { dismount(w, passenger); go(passenger, "idle", passenger.x, passenger.y); }
    }
    dismount(w, h);
    d.state = "idle";
    d.homeX = spot.x;
    d.homeY = spot.y;
    h.x += 12;
    h.y += 8;
    say(h, "Rest, buddy.");
    go(h, "idle", h.x, h.y);
  } else go(h, "walk", spot.x, spot.y);
}

/** A predator caught a cave person: cartoon yeet, nobody gets hurt. */
export function toss(w: World, h: Human, fromX: number) {
  if (h.state === "down" || h.riding) return;
  const dir = h.x >= fromX ? 1 : -1;
  h.state = "tossed";
  h.stateT = 0;
  h.vx = dir * (120 + w.rng() * 80);
  h.vy = (w.rng() - 0.5) * 60;
  h.vz = 240 + w.rng() * 80;
  h.z = 4;
  h.carry = null;
  h.task = null;
  say(h, "WAAAH!");
  w.sfx("yelp", h.x, h.y, 0.9);
  w.discover("tossed", h.x, h.y);
}

export function setHumanState(h: Human, s: HumanState) {
  if (h.state === "down") return;
  go(h, s, h.x, h.y);
}

