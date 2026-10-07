/* ------------------------------------------------------------------ */
/*  Cave people: a small state machine per person. They gather for     */
/*  the camp's current goal, fish, build, sit by the fire, hide from   */
/*  dinosaurs and storms, and sleep in the cave at night.              */
/* ------------------------------------------------------------------ */
import { CAVE_NAMES } from "../data/facts";
import { HOUSING, NODES } from "../data/colony";
import { sp } from "../data/species";
import { sizeOf } from "./dinos";
import { P } from "./particles";
import { clamp, pick } from "./rng";
import { LM, groundSpeed } from "./terrain";
import { T, TILE, type Dino, type Dragon, type Human, type HumanState, type Plant, type Resource } from "./types";
import type { World } from "./world";
import { TALL } from "./plants";
import { roleAct, roleThink } from "./tribe";
import { goalKey, nodePos, tileOf, TOWER_Z, WALK_Z, type NavClass } from "./nav";
import { shelterDone, stagesOf } from "./build";
import { buildAct, deliverToSite, douseThink, joinTask, leaveScorpion, taskCarrying, taskThink } from "./tasks";
import { healTick, hurtHuman, recover } from "./injury";
import { autoButcher } from "./tasks";
import { cutCarcass, cutTime, hasYield } from "./carcass";
import { OUTFIT_BY_ID } from "../data/colony";

/** How much rain + wet this person's clothes keep off (0..1). */
export function rainGuard(h: Human) {
  const o = h.gear.outfit ? OUTFIT_BY_ID[h.gear.outfit] : null;
  return o ? o.rain : 0;
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

const navClass = (h: Human): NavClass => (h.riding ? "rider" : "human");

/** Can this person step here (ground level)? Also avoids hot ground. */
function walkOk(w: World, h: Human, x: number, y: number) {
  if (!w.nav.passable(navClass(h), x, y)) return false;
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
    const easy = h.level === 0 && wantLevel === 0 && w.nav.ok(navClass(h), goalTile) && w.nav.lineClear(navClass(h), h.x, h.y, h.tx, h.ty);
    if (!easy) {
      const path = w.nav.find(w, navClass(h), h.x, h.y, h.level, h.tx, h.ty, wantLevel);
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
    } else if (final && !w.nav.ok(navClass(h), tileOf(h.tx, h.ty))) {
      // goal is inside something solid (a tree, a wall to fix): stop at the end of the path
      wx = np.x;
      wy = np.y;
    }
  }
  // goal inside something solid (a wall to fix, a doorway): close enough counts
  if ((!h.path || h.pathI >= h.path.length - 1) && wantLevel === 0 && !w.nav.ok(navClass(h), tileOf(h.tx, h.ty)) && Math.hypot(h.tx - h.x, h.ty - h.y) < 30) {
    h.vx = h.vy = 0;
    return true;
  }
  const dx = wx - h.x;
  const dy = wy - h.y;
  const d = Math.hypot(dx, dy);
  const base = h.child ? 30 : 36;
  const fast = h.state === "flee" || h.state === "hunt" || (w.tribe.raid !== null && h.state === "walk");
  const snow = w.snow.at(h.x, h.y);
  // a sprinting person can't outrun a hungry predator for long, and hurt people limp
  // rain + snow slow people down, unless their hide clothes keep them dry + warm
  const wet = w.weather.rain * 0.28 * (1 - rainGuard(h));
  let speed = (fast ? base * (h.state === "flee" ? 1.9 : 1.6) : base) * (h.level ? 0.9 : groundSpeed(w.terrain.tileAt(h.x, h.y))) * (1 - snow * 0.3 * (1 - coatWarmth(h) * 0.6)) * (1 - wet) * (0.55 + 0.45 * Math.min(1, h.hp * 1.4));
  if (mount) speed = sp(mount.species).run * 0.8 * mount.genes.speed * (h.state === "haul" ? 0.7 : 1) * (1 - snow * 0.25);
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
  w.creatureHash.each(h.x, h.y, 230, (e, d2) => {
    if (e.kind !== "dino") return;
    const def = sp(e.species);
    if (def.move === "swim" || (def.move === "fly" && e.z > 10)) return;
    if (e.owner || e.state === "ridden") return;
    if (e.state === "sleep" || e.state === "carried" || e.state === "knocked") return;
    const scary = (def.diet !== "herbivore" && sizeOf(e) > 30) || (sizeOf(e) > 70 && (e.state === "flee" || e.state === "defend" || e.state === "annoyed"));
    const r = def.diet !== "herbivore" ? 230 : 120;
    // stuck in tar, or on the other side of a wall: can't get us
    if (e.state === "stuck" || (scary && d2 < r * r && w.nav.wallBetween(e.x, e.y, h.x, h.y))) return;
    if (scary && d2 < r * r && d2 < best) {
      best = d2;
      worst = e;
    }
  });
  return worst;
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

/** Find somewhere to collect a resource. */
export function sourceFor(w: World, h: Human, r: Resource): { x: number; y: number; id: number } | null {
  const cx = w.camp.x;
  const cy = w.camp.y;
  switch (r) {
    case "stick":
    case "wood": {
      const p = nearPlant(w, cx, cy, 900, (p) => TALL.has(p.kind) && !p.stump && p.burnt < 0.5 && (r === "stick" || p.size > 0.6));
      return p ? { x: p.x + (p.x > cx ? -16 : 16), y: p.y + 6, id: p.id } : null;
    }
    case "leaves":
    case "berries": {
      const p = nearPlant(w, cx, cy, 900, (p) => (p.kind === "bush" || p.kind === "fern" || p.kind === "cycad") && p.food > 0.3 && !p.stump);
      return p ? { x: p.x + 14, y: p.y + 4, id: p.id } : null;
    }
    case "stone": {
      const b = w.props.find((p) => p.kind === "boulder" && Math.hypot(p.x - cx, p.y - cy) < 900);
      if (b) return { x: b.x + 18, y: b.y + 6, id: b.id };
      const n = nearestNode(w, cx, cy, "stone", 1100);
      if (n) return n;
      const t = w.terrain.findTile(cx, cy - 40, 700, (t) => t === T.Rock || t === T.Basalt, w.rng, 80);
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
      let bd = 1800;
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
      return nearestNode(w, cx, cy, r, 2600);
    case "grass": {
      const t = w.terrain.findTile(cx, cy, 500, (t) => t === T.Grass, w.rng, 60);
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

/** Where this person goes to hide / sleep: their home, else the cave. */
export function shelterSpot(w: World, h?: Human): { x: number; y: number } {
  const home = h?.home ? w.shelters.find((s) => s.id === h.home && shelterDone(s)) : undefined;
  const s = home ?? w.shelters.find((s) => shelterDone(s));
  if (s) return { x: s.x, y: s.y + 6 };
  return { x: w.camp.caveX, y: w.camp.caveY };
}

/** Somewhere warm: the nearest lit fire, or home if it has a hearth / is cosy. */
function warmSpot(w: World, h: Human): { x: number; y: number; home: boolean } | null {
  const home = h.home ? w.shelters.find((s) => s.id === h.home && shelterDone(s)) : undefined;
  if (home && (HOUSING[home.tier].warmth >= 0.55 || w.weather.snow > 0.6)) return { x: home.x, y: home.y + 6, home: true };
  let best: { x: number; y: number; home: boolean } | null = null;
  let bd = 1400;
  for (const f of w.campfires) {
    if (!f.lit) continue;
    const d = Math.hypot(f.x - h.x, f.y - h.y);
    if (d < bd) {
      bd = d;
      const a = (h.id * 2.4) % (Math.PI * 2);
      best = { x: f.x + Math.cos(a) * 34, y: f.y + Math.sin(a) * 18, home: false };
    }
  }
  if (best) return best;
  return home ? { x: home.x, y: home.y + 6, home: true } : { x: w.camp.caveX, y: w.camp.caveY, home: true };
}

function think(w: World, h: Human) {
  const camp = w.camp;
  h.think = 0.4 + w.rng() * 0.5;
  if (h.state === "tossed" || h.state === "lookUp" || h.state === "celebrate" || h.state === "down") return;
  if (h.state === "craft" && camp.crafting?.by === h.id) return;
  if (h.stranger) return strangerThink(w, h);

  const tribe = w.tribe;
  const role = tribe.roleOf(h);
  const weapon = tribe.weaponFor(w, h);
  const task = w.tasks.get(h.taskId);
  const fightTask = !!task && (task.kind === "hunt" || task.kind === "guard" || task.kind === "defend" || task.kind === "operate");
  const fighter = !!weapon && (role === "guard" || role === "hunter" || !!h.order || fightTask || h.state === "operate");

  // raid or a dragon overhead! non-fighters (and kids) run home…
  const dragon = dragonNear(w, h);
  const dragonAttack = !!dragon && (dragon.state === "strafe" || dragon.state === "circle" || dragon.state === "hunt");
  // …unless it's a raid, they're inside the walls and the automatic defenses have it covered
  const safe = !!tribe.raid && !dragonAttack && tribe.safeInside(w, h);
  if (safe && !w.flags.has("safeInside")) {
    w.flags.add("safeInside");
    w.toast("🛡️", "Raid! But the walls are shut and the auto-defenses are up — everyone inside keeps working.", h.x, h.y);
  }
  if (safe && h.state === "hide" && h.stateT > 1) {
    go(h, "idle", h.x, h.y);
    say(h, "We're safe in here!");
  }
  if ((tribe.raid || dragonAttack) && !safe && (!fighter || h.child) && !(task && task.kind === "douse")) {
    if (h.state === "hide") return;
    if (h.state === "operate") leaveScorpion(w, h);
    const s = shelterSpot(w, h);
    if (Math.hypot(h.x - s.x, h.y - s.y) < 14) go(h, "hide", h.x, h.y);
    else {
      if (h.state !== "flee") say(h, pick(w.rng, dragon && !tribe.raid ? ["DRAGON!", "Get inside!", "Fire from the sky!"] : h.child ? ["Mama!", "Hide!", "Eek!"] : ["Raid!!", "Hide!", "To the cave!"]));
      if (h.carry && h.carry !== "fish" && h.carry !== "water") {
        // drop what you're carrying and run
        h.carry = null;
        h.carryN = 0;
      }
      go(h, "flee", s.x, s.y);
    }
    return;
  }

  // a Neanderthal coming at me: fight back if armed, otherwise run for it
  const brute = h.child ? null : w.rivals.brutes.find((b) => b.state === "fight" && b.targetId === h.id && Math.hypot(b.x - h.x, b.y - h.y) < 160);
  if (brute && h.level === 0 && h.state !== "aim" && h.state !== "hunt" && h.state !== "operate") {
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
    if (tribe.raid || w.dragons.list.length || h.stateT < 30) return;
    leaveScorpion(w, h);
  }

  // 1. danger → fight (if armed + on duty) or run for the cave. Scorpion crews head for their Scorpion.
  const crewing = w.colony.scorpions.some((s) => s.crew === h.id);
  const threat = crewing ? null : dangerNear(w, h);
  if (threat && fighter && Math.hypot(threat.x - h.x, threat.y - h.y) > 50) {
    h.targetId = threat.id;
    go(h, "aim", h.x, h.y);
    return;
  }
  if (!crewing && dragon && fighter && weapon && !weapon.melee && dragon.z < 220) {
    h.targetId = dragon.id;
    go(h, "aim", h.x, h.y);
    return;
  }
  if (threat) {
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
    const s = h.riding ? { x: camp.x, y: camp.y + 40 } : shelterSpot(w, h);
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
        if (h.state !== "walk") say(h, pick(w.rng, ["Brrr!", "So cold!", "Fire, please!"]));
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

  // 4. storms + night → shelter / cave (player tasks keep going until dark)
  const night = w.daylight < 0.25;
  const onWatch = (role === "guard" || h.state === "operate") && !h.child && h.energy > 0.15;
  const busy = !!task && !night;
  // rainproof hides keep people out working in the wet; furs keep them going in the snow
  const guard = rainGuard(h);
  const tooWet = (w.weather.rain > 0.55 && guard < 0.6) || (w.weather.storm > 0.5 && guard < 0.85) || w.weather.storm > 0.95;
  const tooCold = w.weather.snow > 0.85 && coatWarmth(h) < 0.6;
  if (!onWatch && !busy && (tooWet || tooCold || (night && h.energy < 0.6))) {
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
    if (!night || h.energy > 0.95) go(h, "idle", h.x, h.y + 20);
    else return;
  }
  if (h.state === "flee" || h.state === "hide" || h.state === "rest") {
    go(h, "walk", camp.x + (w.rng() - 0.5) * 120, camp.y + (w.rng() - 0.5) * 60);
    if (w.tribe.wonCheer > 0 && w.rng() < 0.5) {
      go(h, "celebrate", h.x, h.y);
      say(h, pick(w.rng, ["We made it!", "Hooray!", "Phew!"]));
    }
  }

  // busy with something that finishes on its own
  if (h.state === "gather" || h.state === "fish" || h.state === "build" || h.state === "eat" || h.state === "heal" || h.state === "tame" || h.state === "smith" || h.state === "douse" || h.state === "research" || h.state === "resonate") return;
  if (h.state === "hunt" || h.state === "aim" || h.state === "haul" || h.state === "cook" || h.state === "farm" || h.state === "repair") return;
  if (h.state === "carry" || h.state === "walk" || h.state === "explore") {
    if (Math.hypot(h.tx - h.x, h.ty - h.y) > 6) return;
  }

  // 5. hungry → eat from the stockpile
  if (h.hunger > (task ? 0.85 : 0.6) && tribe.foodTotal(w) + (h.hunger > 0.9 ? camp.stock.meat : 0) > 0) {
    if (Math.hypot(h.x - camp.pileX, h.y - camp.pileY) < 20) go(h, "eat", h.x, h.y);
    else go(h, "walk", camp.pileX - 14, camp.pileY + 8);
    return;
  }

  // 6. the player's orders come before anything the tribe would choose
  if (task && taskThink(w, h)) return;
  if (h.taskId && w.tasks.get(h.taskId)?.kind === "operate") return;

  // 7. a friend is knocked out nearby → help them up
  if (!h.child && !h.taskId) {
    const hurt = w.humans.find((o) => o !== h && o.state === "down" && Math.hypot(o.x - h.x, o.y - h.y) < 500 && !w.humans.some((q) => q !== h && q.state === "heal" && q.targetId === o.id));
    if (hurt && !tribe.raid) {
      if (Math.hypot(h.x - hurt.x - 14, h.y - hurt.y) < 12) {
        go(h, "heal", h.x, h.y);
        h.targetId = hurt.id;
        h.dir = hurt.x > h.x ? 1 : -1;
      } else {
        say(h, `${hurt.name}!`);
        go(h, "walk", hurt.x + 14, hurt.y);
      }
      return;
    }
  }

  // 8. fire near camp → bucket brigade
  if (!h.child && !h.taskId && (role === "gatherer" || role === "builder" || role === "farmer" || role === "cook") && w.tribe.fireAlarm && camp.learned.has("firefighting")) {
    if (douseThink(w, h, () => undefined)) return;
  }

  // 4. evening by the fire (except whoever is on duty)
  const fire = w.campfires.find((f) => f.lit);
  const offDuty = role === "gatherer" || h.child;
  if (fire && offDuty && !h.order && (w.daylight < 0.45 || (h.child && w.rng() < 0.2))) {
    const a = (h.id * 2.4) % (Math.PI * 2);
    const sx = fire.x + Math.cos(a) * 34;
    const sy = fire.y + Math.sin(a) * 18;
    if (Math.hypot(h.x - sx, h.y - sy) < 6) go(h, "sitFire", sx, sy);
    else go(h, "walk", sx, sy);
    return;
  }

  if (h.child) return childThink(w, h);

  // riders with nothing to do take their mount home to rest
  if (h.riding && !h.taskId && role !== "gatherer" && role !== "builder" && role !== "hunter") {
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

  // 5b. the job they've been given (or picked up automatically)
  if (roleThink(w, h)) return;

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

  // gather what the camp needs most (or fish / sticks for the fire / water for the jars)
  let need = camp.missing(w) ?? w.colony.missing(w) ?? w.civ.missing(w);
  if (!need) {
    const r = w.rng();
    if (r < 0.25) need = "fish";
    else if (r < 0.35 && camp.stock.stick < 8) need = "stick";
    else if (r < 0.45) need = "berries";
    else if (r < 0.52 && w.colony.finished("waterStore") && camp.stock.water < 10) need = "water";
  }
  if (need) {
    const src = sourceFor(w, h, need);
    if (src) {
      h.task = need;
      h.targetId = src.id;
      go(h, "walk", src.x, src.y);
      return;
    }
  }

  // 8. leisure: chat, explore, wander
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
  go(h, "walk", camp.x + (w.rng() - 0.5) * 260, camp.y + (w.rng() - 0.5) * 140);
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
  const ride = h.riding ? 3 : 1;
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

export function updateHuman(w: World, h: Human, dt: number) {
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
    if (h.state !== "captive") h.state = "captive";
    return;
  }
  updateWarmth(w, h, dt);
  recover(w, h, dt);
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
      const s = shelterSpot(w);
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
    const z = h.riding ? 16 : h.level === 1 ? (onTower ? TOWER_Z : WALK_Z) : 0;
    h.z += (z - h.z) * Math.min(1, dt * 10);
  }
  if (h.riding) {
    const m = w.dinoById(h.riding);
    if (m) {
      m.x = h.x;
      m.y = h.y;
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
          go(h, "hide", h.x, h.y);
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
      if (w.rng() < dt * 0.05) say(h, pick(w.rng, ["Warm…", "Mmm.", "Story time!", "Stars!"]));
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
  if (h.warmth < 0.06 && w.rng() < dt * 0.2 && h.hp > 0.25) hurtHuman(w, h, 0.03, h.x, h.y, "cold");
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
  const scared = !!w.tribe.raid || w.dragons.list.some((d) => d.state === "strafe");
  if (scared) {
    go(h, "idle", h.x, h.y);
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
    h.riding = 0;
    d.rider = 0;
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

