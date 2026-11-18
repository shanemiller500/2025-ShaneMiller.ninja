/* ------------------------------------------------------------------ */
/*  Water wagons: our answer to the Lava Monsters.                       */
/*                                                                     */
/*   • Built like any building (Firefighting). When it's finished it   */
/*     rolls out of the yard: a timber cart on four wheels with a big  */
/*     hooped water tank on the back, a see-through gauge, a seesaw    */
/*     pump and a bronze nozzle up top.                                */
/*   • It takes a crew of 3: two push it along (and pump the handle    */
/*     once it's spraying), one stands up top and aims the hose.       */
/*   • On Auto, whenever a Lava Monster comes near the settlement the   */
/*     crew drop what they're doing, run to it and roll it out. They   */
/*     stand off out of reach and hose it till it sets solid, a lava-  */
/*     stone statue (lavaFolk.ts) that miners can dig for lava stone.  */
/*   • The tank empties as it sprays. Dry, it rolls home to refill     */
/*     (from the water stores, or a river right by its yard), then     */
/*     goes back out if there's still a Lava Monster about.             */
/*   • A Lava Monster that reaches it burns it, and lava balls splat on */
/*     it; too much and it breaks apart (the crew jump clear). It's    */
/*     patched up again while it stands at home.                       */
/* ------------------------------------------------------------------ */
import { CAMP_LEVELS } from "../data/facts";
import { go, moveHuman, say } from "./humans";
import { hurtHuman } from "./injury";
import { isLavaFolk, lavaBalls, lavaStatues, TOUCH, waterSquirt } from "./lavaFolk";
import { goalKey, nodePos } from "./nav";
import { P } from "./particles";
import { pick } from "./rng";
import { sizeOf } from "./dinos";
import { release, leaveScorpion } from "./tasks";
import { isWaterTile } from "./terrain";
import { MAP_H, MAP_W, TILE, type Building, type Dino, type Human, type T, type WaterWagon } from "./types";
import type { World } from "./world";

/** People it takes: [0] aims the hose up top, the others push + pump. */
export const WAGON_CREW = 3;
/** Water the tank holds (one unit per squirt). */
export const WAGON_TANK = 60;
export const WAGON_HP = 320;
/** Pushed by hand: about a brisk walk. */
const SPEED = 58;
/** Hose reach, and how close it lets a Lava Monster get before backing off. */
export const HOSE_RANGE = 230;
const TOO_CLOSE = 115;
/** Seconds between squirts, and how much each one cools a Lava Monster (≈ 6 s of hosing to set one solid). */
const SQUIRT = 0.3;
const COOL = 0.05;
/** How far it goes after a Lava Monster (from its yard, or from camp). */
const GUARD_R = 1100;
/** Refill rate at home: from the stores, or free from a river right next to the yard. */
const FILL = 6;
const RIVER_FILL = 3;
/** Seconds a parked wagon keeps its crew before letting them go back to work. */
const STAND_DOWN = 10;
/** Seconds the crew get to reach it before it sets off with whoever's there. */
const MUSTER_FOR = 25;
const REPLAN = 3;

/* ------------------------------ finding things ------------------------------ */

const wagonById = (w: World, id: number) => w.colony.wagons.find((g) => g.id === id) ?? null;

/** A Lava Monster worth going after: near our settlement or the wagon's yard. */
function lavaTarget(w: World, g: WaterWagon, far = false): Dino | null {
  const campR = CAMP_LEVELS[w.tribe.level].radius + 500;
  let best: Dino | null = null;
  let bd = Infinity;
  for (const d of w.dinos) {
    if (!isLavaFolk(d) || d.health <= 0) continue;
    const fromHome = Math.hypot(d.x - g.homeX, d.y - g.homeY);
    const fromCamp = Math.hypot(d.x - w.camp.x, d.y - w.camp.y);
    if (!far && fromHome > GUARD_R && fromCamp > campR) continue;
    const dist = Math.hypot(d.x - g.x, d.y - g.y);
    if (dist < bd) {
      bd = dist;
      best = d;
    }
  }
  return best;
}

/** Someone who can crew a wagon right now. */
function canCrew(w: World, h: Human) {
  if (h.child || h.stranger || h.captive || h.under || h.state === "down" || h.hp < 0.55) return false;
  if (h.chariot || h.wagon || h.catapult || h.riding || h.aloft || h.ferry || h.hung || h.yetiHeld || h.falling) return false;
  if (w.colony.hunt?.crew.some((m) => m.id === h.id)) return false;
  return true;
}

/** Call up the crew: firefighters first, then guards, then whoever's nearest. */
function draft(w: World, g: WaterWagon) {
  const need = WAGON_CREW - g.crew.length;
  if (need <= 0) return;
  const rank = (h: Human) => {
    const role = w.tribe.roleOf(h);
    const r = role === "firefighter" ? 0 : role === "guard" ? 400 : role === "hunter" ? 600 : 900;
    return r + Math.hypot(h.x - g.x, h.y - g.y);
  };
  const pool = w.humans.filter((h) => canCrew(w, h) && Math.hypot(h.x - g.x, h.y - g.y) < 1600).sort((a, b) => rank(a) - rank(b));
  for (const h of pool.slice(0, need)) {
    release(w, h);
    h.taskId = 0;
    leaveScorpion(w, h);
    h.order = null;
    h.wagon = g.id;
    h.wagonOn = false;
    g.crew.push(h.id);
    say(h, pick(w.rng, ["To the water wagon!", "Lava Monster! Wagon crew!", "I'll push!", "Grab the hose!"]), 1.8);
  }
}

/** Let the crew go back to work. */
function standDown(w: World, g: WaterWagon) {
  for (const id of g.crew) {
    const h = w.humans.find((x) => x.id === id);
    if (!h) continue;
    h.wagon = undefined;
    h.wagonOn = false;
    h.z = 0;
    go(h, "idle", h.x, h.y + 18);
    h.think = 0;
  }
  g.crew = [];
}

const crewOf = (w: World, g: WaterWagon) => g.crew.map((id) => w.humans.find((h) => h.id === id)).filter((h): h is Human => !!h);
const aboard = (w: World, g: WaterWagon) => crewOf(w, g).filter((h) => h.wagonOn);

/** Where crew member `seat` stands: [0] up on the deck behind the nozzle, the others at the push bar behind. */
export function wagonSeat(g: WaterWagon, seat: number) {
  if (seat === 0) return { x: g.x + g.dir * 2, y: g.y + 1, z: 24 };
  const side = seat === 1 ? -1 : 1;
  return { x: g.x - g.dir * 40, y: g.y + side * 7 + 2, z: 0 };
}

/* ------------------------------ moving ------------------------------ */

function setMode(g: WaterWagon, m: WaterWagon["mode"]) {
  if (g.mode !== m) g.modeT = 0;
  g.mode = m;
}

/** Hot ground it won't roll onto (lava, fire). */
function hot(w: World, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  const i = ty * MAP_W + tx;
  return w.lava.heat[i] > 0.15 || w.fire.heat[i] > 0.3;
}

/** Roll toward g.to (around walls, through open gates). True once it's there (or can't get closer). */
function drive(w: World, g: WaterWagon, dt: number, crew: number) {
  if (!g.to) return true;
  const key = goalKey(g.to.x, g.to.y);
  if (g.pathKey !== key || w.elapsed - (g.pathT ?? -Infinity) > REPLAN) {
    if (g.pathKey !== key) g.pathI = 0;
    g.pathKey = key;
    g.pathT = w.elapsed;
    if (w.nav.lineClear("bigDino", g.x, g.y, g.to.x, g.to.y)) {
      g.path = null;
      g.stuck = false;
    } else {
      const path = w.nav.find(w, "bigDino", g.x, g.y, 0, g.to.x, g.to.y, 0, 9000);
      g.pathI = 0;
      g.path = path ?? null;
      g.stuck = !path;
    }
  }
  if (g.stuck) {
    if (!w.flags.has(`wagonStuck${g.id}`)) {
      w.flags.add(`wagonStuck${g.id}`);
      w.toast("🚧", "A water wagon can't find a way through the walls. Open a gate (or leave a gap) and it'll roll on.", g.x, g.y);
    }
    return false;
  }
  w.flags.delete(`wagonStuck${g.id}`);
  let tx = g.to.x;
  let ty = g.to.y;
  if (g.path && g.pathI < g.path.length) {
    const np = nodePos(g.path[g.pathI]);
    tx = np.x;
    ty = np.y;
  }
  const d = Math.hypot(tx - g.x, ty - g.y);
  if (d < 8) {
    if (g.path && g.pathI < g.path.length) {
      g.pathI++;
      return false;
    }
    g.to = null;
    return true;
  }
  // short-handed it's heavy going
  const speed = SPEED * (crew >= WAGON_CREW ? 1 : crew === 2 ? 0.75 : 0.5);
  const step = Math.min(d, speed * dt);
  const nx = g.x + ((tx - g.x) / d) * step;
  const ny = g.y + ((ty - g.y) / d) * step;
  // never onto lava or through a fire: it stops at the edge
  if (hot(w, nx, ny)) {
    g.to = null;
    return true;
  }
  if (!w.nav.passable("bigDino", nx, ny) && w.nav.passable("bigDino", g.x, g.y)) {
    g.pathT = -Infinity;
    return false;
  }
  g.x = nx;
  g.y = ny;
  if (Math.abs(tx - g.x) > 2) g.dir = tx > g.x ? 1 : -1;
  g.anim += step / 12;
  return false;
}

/** Keep the boarded crew in their places on (and behind) the wagon. */
function sync(w: World, g: WaterWagon, dt: number, moving: boolean) {
  const crew = crewOf(w, g);
  for (let k = 0; k < crew.length; k++) {
    const h = crew[k];
    if (!h.wagonOn) continue;
    const seat = g.crew.indexOf(h.id);
    const p = wagonSeat(g, seat);
    h.x = p.x;
    h.y = p.y;
    h.z = p.z;
    h.vx = moving ? SPEED * g.dir : 0;
    h.vy = 0;
    h.dir = g.dir;
    if (seat === 0) {
      h.state = g.spray > 0 ? "aim" : "guard";
      if (g.spray > 0) h.dir = Math.cos(g.aim) >= 0 ? 1 : -1;
    } else {
      // pushing (walking legs) or working the pump handle
      h.state = moving ? "walk" : g.spray > 0 ? "build" : "idle";
    }
    h.anim += moving ? (SPEED * dt) / 8 : dt * (g.spray > 0 ? 3 : 1);
    if (h.bubble) {
      h.bubble.t -= dt;
      if (h.bubble.t <= 0) h.bubble = null;
    }
  }
}

/* ------------------------------ the hose ------------------------------ */

function hose(w: World, g: WaterWagon, d: Dino, dt: number) {
  const want = Math.atan2(d.y - g.y, d.x - g.x);
  let da = (want - g.aim) % (Math.PI * 2);
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  g.aim += da * Math.min(1, dt * 5);
  g.dir = d.x > g.x ? 1 : -1;
  g.cd -= dt;
  if (g.cd > 0) return;
  g.cd = SQUIRT;
  g.tank = Math.max(0, g.tank - 1);
  g.spray = 0.5;
  const nz = { x: g.x + Math.cos(g.aim) * 22, y: g.y + Math.sin(g.aim) * 10 - 1, z: 34 };
  waterSquirt(w, nz.x, nz.y, nz.z, d, COOL, 420);
  if (w.rng() < 0.25) w.sfx("splash", g.x, g.y, 0.55, 1.15 + w.rng() * 0.2);
  if (!w.flags.has("wagonHose")) {
    w.flags.add("wagonHose");
    w.toast("💦", "The water wagon is hosing a Lava Monster! Two pump, one aims: keep it on there and it sets solid into a lava-stone statue.", g.x, g.y);
  }
  const gunner = w.humans.find((h) => h.id === g.crew[0]);
  if (gunner && w.rng() < 0.03) say(gunner, pick(w.rng, ["Soak it!", "Keep pumping!", "Cool off, lava-head!", "More water!", "It's going grey!"]), 1.4);
}

/* ------------------------------ getting hurt ------------------------------ */

const splatted = new WeakSet<object>();

function burnTick(w: World, g: WaterWagon, dt: number) {
  // a Lava Monster right up against it: it scorches the timber (and whoever's at the push bar)
  for (const d of w.dinos) {
    if (!isLavaFolk(d) || d.health <= 0) continue;
    const reach = sizeOf(d) * 0.42 + TOUCH + 34;
    if (Math.abs(d.x - g.x) > reach + 40 || Math.hypot(d.x - g.x, d.y - g.y) > reach) continue;
    hitWagon(w, g, 40 * dt, "a Lava Monster");
    for (const h of aboard(w, g)) if (w.rng() < dt * 0.8) hurtHuman(w, h, 0.08, d.x, d.y, "burn");
  }
  // lava balls splatting on it
  for (const b of lavaBalls(w)) {
    if (splatted.has(b) || b.z > 14 || Math.hypot(b.x - g.x, b.y - g.y) > 46) continue;
    splatted.add(b);
    hitWagon(w, g, 45, "a lava ball");
  }
}

export function hitWagon(w: World, g: WaterWagon, dmg: number, why: string) {
  g.hp -= dmg;
  g.hit = 1;
  // a full tank damps it down: the timber steams instead of catching
  if (w.rng() < 0.3) w.particles.spawn(P.Steam, g.x + (w.rng() - 0.5) * 40, g.y - 20, { z: 20, vz: 40, size: 9, max: 0.9, color: "rgba(230,230,230,0.6)" });
  if (g.hp <= 0) wreck(w, g, why);
}

function wreck(w: World, g: WaterWagon, why: string) {
  w.particles.burst(P.Crumb, g.x, g.y - 18, 30, 140, { z: 24, vz: 140, g: 300, size: 4, max: 1.2, color: "#8a6238" });
  w.particles.burst(P.Spark, g.x, g.y - 20, 24, 120, { z: 26, vz: 90, g: 220, size: 3, max: 0.9, color: "#8fd0ff" });
  w.sfx("timber", g.x, g.y, 1);
  w.sfx("splash", g.x, g.y, 1, 0.6);
  for (const h of crewOf(w, g)) {
    h.x += (w.rng() - 0.5) * 60;
    h.y += 16 + w.rng() * 20;
  }
  standDown(w, g);
  w.colony.wagons.splice(w.colony.wagons.indexOf(g), 1);
  w.toast("💥", `A water wagon was smashed by ${why}! The crew jumped clear. Build another (Build → Defense).`, g.x, g.y);
}

/* ------------------------------ the crew's side (from updateHuman) ------------------------------ */

/**
 * One of a wagon's crew (from humans.updateHuman). Not aboard yet: they run to their place on it.
 * Aboard: the wagon carries them. True = handled (their usual brain sits it out).
 */
export function wagonCrewTick(w: World, h: Human, dt: number): boolean {
  const g = h.wagon ? wagonById(w, h.wagon) : null;
  if (!g || !g.crew.includes(h.id) || h.state === "down") {
    if (g) g.crew = g.crew.filter((id) => id !== h.id);
    h.wagon = undefined;
    h.wagonOn = false;
    h.z = 0;
    return false;
  }
  if (h.wagonOn) return true;
  const p = wagonSeat(g, g.crew.indexOf(h.id));
  if (Math.hypot(p.x - h.x, p.y - h.y) < 22) {
    h.wagonOn = true;
    if (g.crew.indexOf(h.id) === 0) w.sfx("knock", g.x, g.y, 0.4, 1.2);
    return true;
  }
  if (h.state !== "walk" || Math.hypot(h.tx - p.x, h.ty - p.y) > 20) go(h, "walk", p.x, p.y + (g.crew.indexOf(h.id) === 0 ? 10 : 0));
  moveHuman(w, h, dt * 1.35);
  return true;
}

/* ------------------------------ per frame ------------------------------ */

function rollOut(w: World, b: Building): WaterWagon {
  return {
    id: w.nextId(), x: b.x, y: b.y, dir: 1, hp: WAGON_HP, maxHp: WAGON_HP, tank: WAGON_TANK, tankMax: WAGON_TANK,
    homeX: b.x, homeY: b.y, mode: "home", target: 0, crew: [], auto: true, to: null, path: null, pathI: 0, pathKey: 0,
    aim: 0, cd: 0, spray: 0, anim: 0, hit: 0, modeT: 0, stoned: 0,
  };
}

/** A river or lake right beside the yard: it fills itself for free there. */
function riverByHome(w: World, g: WaterWagon) {
  const cx = Math.floor(g.homeX / TILE);
  const cy = Math.floor(g.homeY / TILE);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx;
    const y = cy + dy;
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    if (isWaterTile(w.terrain.tiles[y * MAP_W + x] as T)) return true;
  }
  return false;
}

/** Did the Lava Monster it was after just set solid? */
function stoned(w: World, id: number) {
  return lavaStatues(w).some((s) => s.id === id);
}

export function wagonsUpdate(w: World, dt: number) {
  const col = w.colony;
  for (const b of [...col.buildings]) {
    if (b.kind !== "waterWagon" || b.built < 1) continue;
    const g = rollOut(w, b);
    col.removeBuilding(b);
    col.wagons.push(g);
    w.sfx("build", g.x, g.y, 0.8);
    w.toast("💦", "A water wagon is ready, its tank full! When a Lava Monster comes near, a crew of 3 rolls it out and hoses it into stone. Tap it to send it out or call it home.", g.x, g.y);
  }
  for (const g of [...col.wagons]) {
    g.hit = Math.max(0, g.hit - dt * 3);
    g.spray = Math.max(0, g.spray - dt);
    g.modeT += dt;
    // crew who fell / were hurt badly drop off it
    g.crew = g.crew.filter((id) => {
      const h = w.humans.find((x) => x.id === id);
      if (!h || h.state === "down" || h.hp < 0.3 || h.wagon !== g.id) {
        if (h && h.wagon === g.id) {
          h.wagon = undefined;
          h.wagonOn = false;
          h.z = 0;
        }
        return false;
      }
      return true;
    });
    const on = aboard(w, g).length;
    let target = g.target ? w.dinoById(g.target) : null;
    if (g.target && (!target || !isLavaFolk(target))) {
      if (stoned(w, g.target)) {
        g.stoned++;
        w.sfx("cheer", g.x, g.y, 0.9);
        w.particles.burst(P.Spark, g.x, g.y - 40, 14, 90, { z: 40, vz: 120, g: 200, size: 2.5, max: 0.9, color: "#bfe6ff" });
        for (const h of aboard(w, g)) if (w.rng() < 0.7) say(h, pick(w.rng, ["Got it! Solid stone! 🎉", "Ha! A statue!", "Lava stone for the walls!", "Who's next?!"]), 1.8);
        if (!w.flags.has("wagonStoned")) {
          w.flags.add("wagonStoned");
          w.toast("🗿", "The water wagon turned a Lava Monster to stone! Send miners to dig the statue: lava stone builds Lava-stone walls, the toughest there are.", g.x, g.y);
        }
      }
      g.target = 0;
      target = null;
    }
    const moving = !!g.to;
    switch (g.mode) {
      case "home": {
        // refill + patch up
        if (g.tank < g.tankMax) {
          const river = riverByHome(w, g);
          const want = Math.min(g.tankMax - g.tank, FILL * dt);
          const fromStore = Math.min(want, w.camp.stock.water);
          w.camp.stock.water -= fromStore;
          g.tank += fromStore + (river ? Math.min(want - fromStore, RIVER_FILL * dt) : 0);
          if (w.rng() < dt * 2 && w.inView(g.x, g.y, 80)) w.particles.spawn(P.Spark, g.x - g.dir * 18, g.y - 30, { z: 30, vz: -30, size: 2, max: 0.4, color: "#9fd4ff" });
        }
        g.hp = Math.min(g.maxHp, g.hp + dt * 4);
        if (g.x !== g.homeX || g.y !== g.homeY) g.to = { x: g.homeX, y: g.homeY };
        if (g.to) drive(w, g, dt, Math.max(on, 1));
        const foe = g.auto ? lavaTarget(w, g) : null;
        if (foe && g.tank >= g.tankMax * 0.35 && g.hp > g.maxHp * 0.3) {
          g.target = foe.id;
          setMode(g, "muster");
          draft(w, g);
          if (!w.flags.has("wagonMuster")) {
            w.flags.add("wagonMuster");
            w.toast("🚨", "A Lava Monster is near! The water wagon crew are running to it.", g.x, g.y);
          }
        } else if (g.crew.length && g.modeT > STAND_DOWN) standDown(w, g);
        break;
      }
      case "muster": {
        if (!target) target = lavaTarget(w, g, true);
        if (!target) {
          setMode(g, "home");
          break;
        }
        g.target = target.id;
        draft(w, g);
        if (on >= WAGON_CREW || (g.modeT > MUSTER_FOR && on >= 1)) {
          setMode(g, "out");
          for (const h of aboard(w, g)) if (w.rng() < 0.5) say(h, pick(w.rng, ["Roll out!", "Push!", "Water wagon, go!"]), 1.6);
          w.sfx("knock", g.x, g.y, 0.6, 0.8);
        }
        break;
      }
      case "out": {
        if (!target) target = g.auto ? lavaTarget(w, g) : lavaTarget(w, g, true);
        if (!target || on === 0) {
          g.to = { x: g.homeX, y: g.homeY };
          setMode(g, "back");
          break;
        }
        g.target = target.id;
        if (g.tank <= 0) {
          g.to = { x: g.homeX, y: g.homeY };
          setMode(g, "back");
          const gunner = w.humans.find((h) => h.id === g.crew[0]);
          if (gunner) say(gunner, "Tank's dry! Back to refill!", 1.8);
          if (!w.flags.has("wagonDry")) {
            w.flags.add("wagonDry");
            w.toast("🪣", "The water wagon's tank is empty: it's rolling home to refill from the water stores. Keep them full!", g.x, g.y);
          }
          break;
        }
        const dist = Math.hypot(target.x - g.x, target.y - g.y);
        if (dist < TOO_CLOSE) {
          // too close: it burns. Back off
          const a = Math.atan2(g.y - target.y, g.x - target.x);
          g.to = { x: g.x + Math.cos(a) * 90, y: g.y + Math.sin(a) * 60 };
          drive(w, g, dt, on);
          if (dist < HOSE_RANGE) hose(w, g, target, dt);
        } else if (dist > HOSE_RANGE - 20) {
          // into hosing range: aim for a spot short of it
          const a = Math.atan2(g.y - target.y, g.x - target.x);
          const sx = target.x + Math.cos(a) * (HOSE_RANGE - 50);
          const sy = target.y + Math.sin(a) * (HOSE_RANGE - 50);
          if (!g.to || Math.hypot(g.to.x - sx, g.to.y - sy) > 40) g.to = { x: sx, y: sy };
          const stopped = drive(w, g, dt, on);
          // can't get any closer (lava, fire): hose from here if it reaches
          if (stopped && dist < HOSE_RANGE + 30) hose(w, g, target, dt);
        } else {
          g.to = null;
          hose(w, g, target, dt);
        }
        break;
      }
      case "back": {
        if (!g.to) g.to = { x: g.homeX, y: g.homeY };
        if (drive(w, g, dt, Math.max(on, 1)) || Math.hypot(g.x - g.homeX, g.y - g.homeY) < 12) {
          g.x = g.homeX;
          g.y = g.homeY;
          g.to = null;
          setMode(g, "home");
        }
        break;
      }
    }
    sync(w, g, dt, moving && !!g.to);
    burnTick(w, g, dt);
  }
}

/* ------------------------------ from the player (Inspect card) ------------------------------ */

/** Send it after the nearest Lava Monster (anywhere). Returns why it can't go, or null. */
export function sendWagon(w: World, g: WaterWagon): string | null {
  const foe = lavaTarget(w, g, true);
  if (!foe) return "No Lava Monsters about.";
  if (g.tank < 6) return "The tank is nearly dry: let it refill first.";
  g.target = foe.id;
  setMode(g, g.mode === "out" ? "out" : "muster");
  draft(w, g);
  return null;
}

/** Call it home (it refills there). */
export function recallWagon(w: World, g: WaterWagon) {
  g.target = 0;
  g.to = { x: g.homeX, y: g.homeY };
  setMode(g, "back");
}

/** The wagon (and its crew) at a spot on the map, for taps. */
export function wagonAt(w: World, x: number, y: number) {
  return w.colony.wagons.find((g) => Math.abs(x - g.x) < 46 && y < g.y + 14 && y > g.y - 62) ?? null;
}

export const WAGON_MODE_LABEL: Record<WaterWagon["mode"], string> = {
  home: "Parked at home",
  muster: "Crew running to it",
  out: "Out hosing a Lava Monster",
  back: "Rolling home to refill",
};

/** Saved: where it is + what's in it (crew + targets start fresh). */
export function serializeWagon(g: WaterWagon) {
  return { x: Math.round(g.homeX), y: Math.round(g.homeY), hp: Math.round(g.hp), tank: Math.round(g.tank), dir: g.dir, auto: g.auto ? 1 : 0, stoned: g.stoned };
}

export function loadWagon(w: World, s: ReturnType<typeof serializeWagon>): WaterWagon {
  return {
    id: w.nextId(), x: s.x, y: s.y, dir: s.dir ?? 1, hp: s.hp ?? WAGON_HP, maxHp: WAGON_HP, tank: s.tank ?? WAGON_TANK, tankMax: WAGON_TANK,
    homeX: s.x, homeY: s.y, mode: "home", target: 0, crew: [], auto: s.auto !== 0, to: null, path: null, pathI: 0, pathKey: 0,
    aim: 0, cd: 0, spray: 0, anim: 0, hit: 0, modeT: 0, stoned: s.stoned ?? 0,
  };
}
