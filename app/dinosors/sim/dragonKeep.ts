/* ------------------------------------------------------------------ */
/*  Tamed dragons (fantasy!): growing up, lessons, the Dragon Rider    */
/*  bond, flight, player commands, fire breath and Auto mode.          */
/*                                                                     */
/*  Our dragons live in Dragons.owned (never in the wild `list`, so    */
/*  archers, Scorpions and frightened people leave them alone).        */
/*                                                                     */
/*  Growth: hatchling → juvenile → young adult → adult over about      */
/*  three game days (slower when hungry). Size, health, speed, cargo,  */
/*  stamina and fire all grow with it.                                 */
/*                                                                     */
/*  Lessons (an animal trainer teaches them, one at a time):           */
/*  feeding + calming → following → flying → fire control, carrying →  */
/*  rider acceptance → combat. Stages: Hatched → Trusting → Trained →  */
/*  Rideable → War-Trained → Fully Bonded (with a Dragon Rider).       */
/*                                                                     */
/*  Fire breath is real fire: it lights grass, trees and wood through  */
/*  the wildfire system, scorches buildings and burns whatever is in   */
/*  the cone. Bursts cost stamina, have a cooldown, and are short and  */
/*  weak in young or untrained dragons.                                */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { BREEDS, GROW_SECONDS, GROWTH, LESSON_BY_ID, LESSONS, growthStage, type DragonCmdKind, type DragonSkill, type DragonStage } from "../data/dragons";
import { deliver, sites } from "./build";
import { emote, setState, sizeOf } from "./dinos";
import { go, say } from "./humans";
import { hurtHuman } from "./injury";
import { eggWarmth } from "./dragonNests";
import { pitOf, pitSpot } from "./shows";
import { P } from "./particles";
import { pick } from "./rng";
import { TILE, T, WORLD_H, WORLD_W, type Brute, type Dino, type Dragon, type DragonCmd, type Human, type Resource } from "./types";
import { isWaterTile } from "./terrain";
import type { World } from "./world";

/* ------------------------------ stats ------------------------------ */

const sk = (dr: Dragon, s: DragonSkill) => dr.skills?.[s] ?? 0;
export const dragonSkill = sk;

/** Everything that grows with the dragon. */
export function dragonStats(dr: Dragon) {
  const def = BREEDS[dr.breed ?? "fire"];
  const g = dr.owner || dr.young ? dr.growth ?? 0 : 1;
  // battle-hardened war dragons keep growing: up to half as big again, much tougher
  const vet = dr.vet ?? 0;
  return {
    def,
    /** drawing scale (a furious wild parent swells to half again its size) */
    scale: def.size * (0.38 + 0.62 * g) * (dr.fury ? 1.5 : 1) * (1 + vet * 0.45),
    speed: def.speed * (0.45 + 0.55 * g) * (1 + vet * 0.1),
    maxHp: Math.round(def.hp * (0.22 + 0.78 * g) * (1 + vet * 0.7)),
    carry: Math.floor(def.carry * Math.min(1, g * 1.15) * (dr.owner ? sk(dr, "carry") : 1)),
    /** fire strength 0..~1.4 */
    fire: def.fire * Math.min(1, g * 1.15) * (dr.owner ? 0.35 + 0.65 * sk(dr, "fire") : 1) * (1 + vet * 0.3),
  };
}

/** Set max hp from its growth (keeping how hurt it is). */
export function newDragonStats(dr: Dragon) {
  const st = dragonStats(dr);
  const frac = dr.maxHp > 1 ? dr.hp / dr.maxHp : 1;
  dr.maxHp = st.maxHp;
  dr.hp = Math.max(1, Math.round(st.maxHp * frac));
}

export function canFly(dr: Dragon) {
  return (dr.growth ?? 0) >= 0.25 && sk(dr, "flight") >= 0.3;
}

export function dragonStage(dr: Dragon): DragonStage {
  if (!dr.owner) return "Wild";
  const war = sk(dr, "combat") >= 1 && sk(dr, "fire") >= 1;
  if (dr.partner && war && sk(dr, "rider") >= 1) return "Fully Bonded";
  if (war && sk(dr, "rider") >= 1) return "War-Trained";
  if (sk(dr, "rider") >= 1 && (dr.growth ?? 0) >= 0.55) return "Rideable";
  if (sk(dr, "follow") >= 1 && sk(dr, "flight") >= 1) return "Trained";
  if (sk(dr, "trust") >= 0.5) return "Trusting";
  return "Hatched";
}

export const rideable = (dr: Dragon) => !!dr.owner && sk(dr, "rider") >= 1 && (dr.growth ?? 0) >= 0.55;
export const warTrained = (dr: Dragon) => sk(dr, "combat") >= 1 && sk(dr, "fire") >= 0.5 && (dr.growth ?? 0) >= 0.55;

/** The lesson it needs next (null = nothing it can learn yet / fully trained). */
export function nextDragonLesson(dr: Dragon): DragonSkill | null {
  if (!dr.owner) return null;
  for (const l of LESSONS) {
    if (sk(dr, l.id) >= 1) continue;
    if ((dr.growth ?? 0) < l.minGrowth) continue;
    if (l.after.some((a) => sk(dr, a) < 1)) continue;
    return l.id;
  }
  return null;
}

/** What it's still waiting to grow into (for the UI): the next lesson it'll be old enough for. */
export function waitingFor(dr: Dragon) {
  for (const l of LESSONS) {
    if (sk(dr, l.id) >= 1) continue;
    if (l.after.some((a) => sk(dr, a) < 1)) continue;
    if ((dr.growth ?? 0) < l.minGrowth) return { lesson: l, growth: l.minGrowth };
  }
  return null;
}

/** Commands this dragon knows well enough to obey. */
export function knows(dr: Dragon, s: DragonSkill) {
  return s === "trust" ? sk(dr, "trust") >= 0.3 : sk(dr, s) >= 1 && (s !== "flight" || canFly(dr));
}

/* ------------------------------ lookups ------------------------------ */

export const ownedDragon = (w: World, id?: number) => (id ? w.dragons.owned.find((d) => d.id === id) ?? null : null);

export function dragonRiderOf(w: World, dr: Dragon): Human | null {
  if (!dr.partner) return null;
  const h = w.humans.find((x) => x.id === dr.partner) ?? null;
  return h && h.dragon === dr.id && !h.stranger && !h.captive ? h : null;
}

/** The dragon a person is bonded to. */
export function dragonOf(w: World, h: Human): Dragon | null {
  const dr = ownedDragon(w, h.dragon);
  return dr && dr.partner === h.id ? dr : null;
}

/* ------------------------------ the bond ------------------------------ */

export function bondDragon(w: World, dr: Dragon, h: Human): string | null {
  if (!rideable(dr)) return `${dr.name} has to be grown and trained to accept a rider first.`;
  if (h.child || h.stranger || h.captive) return "Only a grown-up can become a Dragon Rider.";
  const old = dragonOf(w, h);
  if (old && old !== dr) unbondDragon(w, old);
  const prev = dragonRiderOf(w, dr);
  if (prev && prev !== h) {
    if (prev.aloft === dr.id) dismountDragon(w, prev);
    prev.dragon = undefined;
  }
  dr.partner = h.id;
  h.dragon = dr.id;
  w.toast("🐉", `${h.name} is now a Dragon Rider, bonded for life to ${dr.name} the ${BREEDS[dr.breed ?? "fire"].name.toLowerCase()}!`, dr.x, dr.y);
  w.discover("dragonRider", dr.x, dr.y);
  w.celebrate("Dragon Rider!");
  return null;
}

export function unbondDragon(w: World, dr: Dragon) {
  const h = dragonRiderOf(w, dr);
  if (h) {
    if (h.aloft === dr.id) dismountDragon(w, h);
    h.dragon = undefined;
  }
  dr.partner = undefined;
}

/** Who should become this dragon's rider: a fit grown-up, fighters first. */
export function chooseDragonRider(w: World, dr: Dragon): Human | null {
  // its keeper raised it: they're the one who flies it
  const keeper = dr.keeper ? w.humans.find((h) => h.id === dr.keeper && !h.child && !h.stranger && !h.captive && h.state !== "down") : null;
  if (keeper && !dragonOf(w, keeper)) return keeper;
  const pref = (h: Human) => {
    const r = w.tribe.roleOf(h);
    return (r === "guard" || r === "hunter" ? 0 : r === "trainer" ? 300 : 150) + (h.partner ? 200 : 0) + Math.hypot(h.x - dr.x, h.y - dr.y) * 0.2 - h.hp * 100;
  };
  return w.humans.filter((h) => !h.child && !h.stranger && !h.under && !h.captive && h.state !== "down" && !dragonOf(w, h)).sort((a, b) => pref(a) - pref(b))[0] ?? null;
}

/** Climb on (the dragon must be on the ground, close by). */
export function mountDragon(w: World, h: Human, dr: Dragon) {
  if (h.aloft || dr.rider || h.riding) return false;
  h.aloft = dr.id;
  dr.rider = h.id;
  h.egg = undefined;
  go(h, "idle", dr.x, dr.y);
  say(h, pick(w.rng, [`Up, ${dr.name}!`, "Hold on!", "Let's fly!"]));
  w.sfx("whoosh", dr.x, dr.y, 0.7, 0.8);
  if (!w.flags.has("firstDragonRide")) {
    w.flags.add("firstDragonRide");
    w.toast("🐉", `${h.name} climbs onto ${dr.name}'s back for the first time!`, dr.x, dr.y);
  }
  return true;
}

export function dismountDragon(w: World, h: Human) {
  const dr = ownedDragon(w, h.aloft);
  h.aloft = undefined;
  h.z = 0;
  if (dr) {
    if (dr.rider === h.id) dr.rider = undefined;
    h.x = dr.x + 22 * dr.dir;
    h.y = dr.y + 10;
    if (dr.z > 10) {
      // jumped off in mid-air (the dragon was lost / ran out of strength): a hard landing
      hurtHuman(w, h, Math.min(0.5, dr.z / 600), h.x, h.y, "rock");
    }
  }
  go(h, "idle", h.x, h.y);
  h.think = 0.5;
}

/** Per frame for a person on a dragon's back: they go where it goes. */
export function aloftTick(w: World, h: Human, dt: number) {
  const dr = ownedDragon(w, h.aloft);
  if (!dr || dr.rider !== h.id || dr.hp <= 0) {
    dismountDragon(w, h);
    return;
  }
  const st = dragonStats(dr);
  h.x = dr.x - dr.dir * 6 * st.scale;
  h.y = dr.y + 0.5;
  h.z = dr.z + 26 * st.scale;
  h.dir = dr.dir;
  h.vx = dr.vx;
  h.vy = dr.vy;
  h.anim += dt;
  h.stateT += dt;
  h.fear = 0;
  if (h.bubble) {
    h.bubble.t -= dt;
    if (h.bubble.t <= 0) h.bubble = null;
  }
}

/* ------------------------------ commands ------------------------------ */

const FLIGHT_CMDS = new Set<DragonCmdKind>(["flyTo", "patrol", "route", "guard", "attack", "fire", "carry", "volcano"]);
/** orders that are a fight (a hurt dragon breaks off and heals instead) */
const FIGHT_CMDS = new Set<DragonCmdKind>(["patrol", "route", "guard", "attack", "volcano"]);
const NEEDS: Record<DragonCmdKind, DragonSkill> = {
  follow: "follow", stay: "trust", flyTo: "flight", land: "flight", patrol: "flight", route: "flight", guard: "combat",
  attack: "combat", fire: "fire", carry: "carry", retreat: "flight", home: "trust", volcano: "combat",
};

/** Give a tamed dragon an order. Returns why not (or null when it obeys). */
export function commandDragon(w: World, dr: Dragon, kind: DragonCmdKind, o: { x?: number; y?: number; target?: number; pts?: { x: number; y: number }[] } = {}): string | null {
  if (!dr.owner) return "That's a wild dragon!";
  const need = NEEDS[kind];
  if (!knows(dr, need)) {
    const l = LESSON_BY_ID[need];
    return `${dr.name} hasn't learned that yet (needs ${l.icon} ${l.name}${need === "flight" && (dr.growth ?? 0) < 0.25 ? ", and to grow a bit" : ""}).`;
  }
  if (kind === "fire" && (dr.fireCd ?? 0) > 0) return `${dr.name} is catching its breath (${Math.ceil(dr.fireCd ?? 0)} s).`;
  if ((FLIGHT_CMDS.has(kind) || kind === "retreat") && (dr.stamina ?? 1) < 0.2) return `${dr.name} is too tired to fly. Let it rest at its roost.`;
  if (kind === "carry" && dragonStats(dr).carry < 1) return `${dr.name} is too small to carry anything yet.`;
  if (kind === "route" && (!o.pts || o.pts.length < 2)) return "Pick at least two waypoints.";
  if (kind === "volcano" && (dr.growth ?? 0) < 0.55) return `${dr.name} is too small to carry a Neanderthal yet.`;
  dr.cmd = { kind, x: o.x ?? dr.x, y: o.y ?? dr.y, target: o.target, pts: o.pts, i: 0, t: 0 };
  dr.foe = undefined;
  emote2(w, dr, kind);
  return null;
}

function emote2(w: World, dr: Dragon, kind: DragonCmdKind) {
  const h = dragonRiderOf(w, dr);
  if (h && h.aloft === dr.id) {
    const line: Partial<Record<DragonCmdKind, string>> = { fire: "Breathe fire!", attack: "Get them!", volcano: "Grab that one!", patrol: "Let's look around!", flyTo: "Fly!", land: "Down we go!", retreat: "Back, back!", home: "Home, boy!", guard: "Watch this spot!" };
    if (line[kind]) say(h, line[kind]!);
  }
}

/* ------------------------------ moving ------------------------------ */

const clampX = (x: number) => Math.max(80, Math.min(WORLD_W - 80, x));
const clampY = (y: number) => Math.max(80, Math.min(WORLD_H - 80, y));

/** Smooth flight toward (tx, ty) at altitude tz. Returns the distance left. */
function flyToward(w: World, dr: Dragon, tx: number, ty: number, tz: number, dt: number, mul = 1) {
  const st = dragonStats(dr);
  tx = clampX(tx);
  ty = clampY(ty);
  let dx = tx - dr.x;
  let dy = ty - dr.y;
  const d = Math.hypot(dx, dy);
  // steer clear of an erupting volcano
  const v = w.volcano;
  if (v.phase !== "idle") {
    const vd = Math.hypot(dr.x - v.x, dr.y - v.y);
    if (vd < 560) {
      const push = (560 - vd) / 560;
      dx += ((dr.x - v.x) / (vd || 1)) * d * push * 1.5;
      dy += ((dr.y - v.y) / (vd || 1)) * d * push * 1.5;
    }
  }
  const len = Math.hypot(dx, dy) || 1;
  const storm = w.weather.storm > 0.55 ? 0.6 : 1;
  const speed = st.speed * mul * storm;
  const s = d > 1 ? Math.min(speed, d / Math.max(dt, 0.016) * 0.9) : 0;
  const k = Math.min(1, dt * 1.5);
  const ovx = dr.vx;
  dr.vx += ((dx / len) * s - dr.vx) * k;
  dr.vy += ((dy / len) * s - dr.vy) * k;
  dr.x = clampX(dr.x + dr.vx * dt);
  dr.y = clampY(dr.y + dr.vy * dt);
  // don't skim through mountains + cliffs
  const under = w.terrain.tileAt(dr.x, dr.y);
  const floor = under === T.Mountain || under === T.Cliff ? 200 : under === T.Volcano ? 240 : 0;
  const goalZ = Math.max(tz, floor);
  dr.z += (goalZ - dr.z) * Math.min(1, dt * (goalZ > dr.z ? 1.1 : 0.9));
  if (Math.abs(dr.vx) > 12) dr.dir = dr.vx > 0 ? 1 : -1;
  // banking into turns, a quicker wingbeat climbing
  const turn = (dr.vx - ovx) / Math.max(dt, 0.016);
  dr.bank = (dr.bank ?? 0) + (Math.max(-0.35, Math.min(0.35, turn * 0.0012)) - (dr.bank ?? 0)) * Math.min(1, dt * 3);
  dr.anim += dt * (dr.z > 8 ? (goalZ > dr.z + 20 ? 7.5 : 4.6) : 2);
  return d;
}

/** Walk on the ground (dragons too young to fly, short hops round camp). */
function walkToward(w: World, dr: Dragon, tx: number, ty: number, dt: number) {
  const dx = tx - dr.x;
  const dy = ty - dr.y;
  const d = Math.hypot(dx, dy);
  dr.z = Math.max(0, dr.z - dt * 120);
  if (d < 2) {
    dr.vx = dr.vy = 0;
    return d;
  }
  const speed = 46 + 50 * (dr.growth ?? 0);
  const nx = dr.x + (dx / d) * Math.min(d, speed * dt);
  const ny = dr.y + (dy / d) * Math.min(d, speed * dt);
  if (!isWaterTile(w.terrain.tileAt(nx, ny)) || dr.z > 4) {
    dr.x = nx;
    dr.y = ny;
  }
  dr.vx = (dx / d) * speed;
  dr.vy = (dy / d) * speed;
  if (Math.abs(dx) > 2) dr.dir = dx > 0 ? 1 : -1;
  dr.anim += dt * 3;
  return d;
}

/** Get somewhere: fly if it can, else walk. */
function travel(w: World, dr: Dragon, tx: number, ty: number, tz: number, dt: number, mul = 1) {
  if (canFly(dr) && (Math.hypot(tx - dr.x, ty - dr.y) > 140 || dr.z > 8 || tz > 0)) return flyToward(w, dr, tx, ty, tz, dt, mul);
  return walkToward(w, dr, tx, ty, dt);
}

/** Clear ground to land on: walkable, dry, no lava, no building in the way. */
export function landingSpot(w: World, x: number, y: number, scale = 1) {
  const cx = Math.floor(clampX(x) / TILE);
  const cy = Math.floor(clampY(y) / TILE);
  for (let r = 0; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = cx + dx;
      const ty = cy + dy;
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      if (!w.nav.passable("human", px, py) || isWaterTile(w.terrain.tileAt(px, py))) continue;
      if (w.lava.heatAt(tx, ty) > 0.05 || w.fire.at(tx, ty) > 0.1) continue;
      if (w.colony.buildings.some((b) => b.kind !== "roost" && b.kind !== "dragonYard" && Math.abs(b.x - px) < 34 * scale + 16 && Math.abs(b.y - py) < 24 * scale + 12)) continue;
      return { x: px, y: py };
    }
  }
  return { x: clampX(x), y: clampY(y) };
}

/** Come down (to a clear spot near tx, ty). Returns true once on the ground. */
function landAt(w: World, dr: Dragon, tx: number, ty: number, dt: number) {
  const d = Math.hypot(tx - dr.x, ty - dr.y);
  if (d > 30 || dr.z > 2) {
    if (!canFly(dr)) return walkToward(w, dr, tx, ty, dt) < 6;
    flyToward(w, dr, tx, ty, d > 160 ? 140 : 0, dt, d > 160 ? 1 : 0.55);
    dr.anim += dt * (dr.z < 60 ? 3 : 0); // flare the wings coming in
    if (dr.z < 3 && d < 34) {
      dr.z = 0;
      dr.vx = dr.vy = 0;
      w.particles.burst(P.Poof, dr.x, dr.y, 8, 60, { size: 12, max: 0.8, color: "rgba(200,185,160,0.6)" });
      w.sfx("thud", dr.x, dr.y, 0.7, 0.6);
      return true;
    }
    return false;
  }
  dr.z = 0;
  return true;
}

/** Where it rests: its roost (any roost), else the incubation shelter, else camp. */
export function roostOf(w: World, dr: Dragon) {
  // the dragon pit is home (each dragon has its own spot in the arena)
  const pit = pitOf(w);
  if (pit) {
    const n = w.dragons.owned.indexOf(dr);
    const s = pitSpot(pit, Math.max(0, n), Math.max(1, w.dragons.owned.length));
    return { x: s.x, y: s.y, roost: true };
  }
  const all = w.colony.buildings.filter((b) => b.kind === "roost" && b.built >= 1);
  const mine = all.find((b) => b.id === dr.roost) ?? all[w.dragons.owned.indexOf(dr) % Math.max(1, all.length)];
  if (mine) {
    dr.roost = mine.id;
    const n = w.dragons.owned.filter((o) => o.roost === mine.id).indexOf(dr);
    return { x: mine.x + (n % 2 ? 36 : -36), y: mine.y - 10, roost: true };
  }
  const h = w.colony.buildings.find((b) => b.kind === "hatchery" && b.built >= 1);
  if (h && (dr.growth ?? 0) < 0.4) return { x: h.x + 40, y: h.y + 20, roost: false };
  return { x: w.camp.x + 120 + (w.dragons.owned.indexOf(dr) % 3) * 50, y: w.camp.y + 140, roost: false };
}

/* ------------------------------ threats ------------------------------ */

type Foe = { kind: "dino"; d: Dino } | { kind: "brute"; b: Brute } | { kind: "dragon"; dr: Dragon };
const foeXY = (f: Foe) => (f.kind === "dino" ? f.d : f.kind === "brute" ? f.b : f.dr);

function foeById(w: World, id: number): Foe | null {
  const d = w.dinoById(id);
  if (d && !d.owner && d.health > 0) return { kind: "dino", d };
  const b = w.rivals.byId(id);
  if (b && b.hp > 0) return { kind: "brute", b };
  const dr = w.dragons.byId(id);
  if (dr && dr.hp > 0) return { kind: "dragon", dr };
  return null;
}

/** A real threat worth a dragon's attention (not a little lizard): raiders, Neanderthals, big predators, wild dragons. */
export function threatNear(w: World, x: number, y: number, r: number): Foe | null {
  let best: Foe | null = null;
  let bd = r;
  for (const d of w.dinos) {
    if (d.owner || d.health <= 0 || d.under || sp(d.species).move === "swim") continue;
    if (!d.raider && !(sp(d.species).diet === "carnivore" && sizeOf(d) > 60)) continue;
    const dd = Math.hypot(d.x - x, d.y - y);
    if (dd < bd) {
      bd = dd;
      best = { kind: "dino", d };
    }
  }
  for (const b of w.rivals.brutes) {
    if (b.hp <= 0 || !w.rivals.hostile(w, b)) continue;
    const raiding = !!w.tribe.raid || Math.hypot(b.x - w.camp.x, b.y - w.camp.y) < 900;
    if (!raiding) continue;
    const dd = Math.hypot(b.x - x, b.y - y);
    if (dd < bd) {
      bd = dd;
      best = { kind: "brute", b };
    }
  }
  for (const dr of w.dragons.list) {
    if (dr.state === "leave" || dr.state === "flee" || dr.state === "perch") continue;
    const dd = Math.hypot(dr.x - x, dr.y - y);
    if (dd < bd) {
      bd = dd;
      best = { kind: "dragon", dr };
    }
  }
  return best;
}

/** Fly at a foe: bite it close up, breathe fire on it when trained. Returns false when it's over. */
function engage(w: World, dr: Dragon, foe: Foe, dt: number, auto: boolean) {
  const p = foeXY(foe);
  const st = dragonStats(dr);
  const tz = foe.kind === "dragon" ? Math.max(40, foe.dr.z) : 40;
  const d = travel(w, dr, p.x - dr.dir * 30, p.y, tz, dt, 1.1);
  // fire first, from a little way off
  if (d < 70 + 110 * st.fire && d > 40 && sk(dr, "fire") >= 0.5 && (dr.fireCd ?? 0) <= 0 && (dr.stamina ?? 1) > 0.3 && !(dr.burst ?? 0)) {
    // Auto never torches its own people
    if (!auto || !w.humans.some((h) => !h.aloft && !h.under && Math.hypot(h.x - p.x, h.y - p.y) < 80)) startBurst(w, dr, p.x, p.y);
  }
  if (d < 60 + 20 * st.scale && dr.t > 0.9) {
    dr.t = 0;
    const power = 0.4 + 0.6 * (dr.growth ?? 0);
    w.sfx("chomp", p.x, p.y, 1, 0.6);
    if (foe.kind === "dino") {
      foe.d.health -= 0.14 * power * (sizeOf(foe.d) > 120 ? 0.6 : 1);
      foe.d.fear = 1;
      emote(foe.d, "😱", 1);
      if (sp(foe.d.species).move === "walk" && foe.d.state !== "flee") setState(foe.d, "flee", foe.d.x + (foe.d.x - dr.x) * 3, foe.d.y + (foe.d.y - dr.y) * 3);
    } else if (foe.kind === "brute") {
      // jaws + claws: a Neanderthal (or their catapult) doesn't last long
      const b = foe.b;
      w.rivals.hit(w, b, (b.weapon === "catapult" ? 0.7 : 0.45) * power * (1 + (dr.vet ?? 0) * 0.5), dr.x, dr.y, true, "dragon");
      if (!w.rivals.brutes.includes(b)) {
        tornApart(w, b.x, b.y, b.weapon === "catapult");
        w.toast("🐉", `${dr.name} tore ${b.weapon === "catapult" ? "the clan's catapult" : `${b.name} the Neanderthal`} apart!`, b.x, b.y);
        harden(w, dr, 0.05);
      }
    } else {
      w.dragons.hit(w, foe.dr, 180 * power * (1 + (dr.vet ?? 0) * 0.5));
      if (!w.dragons.list.includes(foe.dr)) harden(w, dr, 0.15);
    }
    if (foe.kind === "dino" && foe.d.health <= 0) {
      tornApart(w, foe.d.x, foe.d.y, false);
      harden(w, dr, 0.03);
    }
  }
  return foeById(w, foe.kind === "dino" ? foe.d.id : foe.kind === "brute" ? foe.b.id : foe.dr.id) !== null;
}

/** Blood + bits (or, for a catapult, splinters + rope). */
function tornApart(w: World, x: number, y: number, timber: boolean) {
  if (timber) {
    w.particles.burst(P.Crumb, x, y, 26, 110, { z: 20, vz: 120, g: 300, size: 4, max: 1.2, color: "#8a6238" });
    w.particles.burst(P.Rock, x, y, 8, 70, { z: 10, size: 5, max: 0.9, color: "#8f877a" });
    w.sfx("crack", x, y, 1.1, 0.6);
    return;
  }
  w.particles.burst(P.Splash, x, y, 24, 120, { z: 18, vz: 130, g: 320, size: 4, max: 1, color: "#b3121e" });
  w.particles.burst(P.Crumb, x, y, 14, 90, { z: 14, vz: 100, g: 280, size: 3, max: 1.1, color: "#7d0a12" });
  w.sfx("crack", x, y, 0.9, 0.8);
}

/** Every fight it wins, a war dragon gets a little bigger + stronger. */
export function harden(w: World, dr: Dragon, n: number) {
  if (!dr.owner) return;
  const before = dr.vet ?? 0;
  dr.vet = Math.min(1, before + n);
  if (Math.floor(before * 4) !== Math.floor(dr.vet * 4)) {
    newDragonStats(dr);
    dr.hp = Math.min(dr.maxHp, dr.hp + dr.maxHp * 0.2);
    w.toast("🐉", dr.vet >= 1 ? `${dr.name} is a legend of the skies: a huge, scarred battle dragon!` : `${dr.name} is battle-hardened: bigger and stronger after every fight (${Math.round(dr.vet * 100)}%).`, dr.x, dr.y);
  }
}

/* ------------------------------ fire breath ------------------------------ */

/** Start a burst of fire at (x, y): needs breath (cooldown) and stamina. */
export function startBurst(w: World, dr: Dragon, x: number, y: number) {
  if ((dr.fireCd ?? 0) > 0 || (dr.stamina ?? 1) < 0.15 || sk(dr, "fire") < 0.3 || (dr.growth ?? 0) < 0.25) return false;
  const g = Math.min(1, (dr.growth ?? 0) * 1.15);
  dr.burst = 0.5 + 2.3 * sk(dr, "fire") * g;
  dr.aimX = x;
  dr.aimY = y;
  dr.fireCd = 11 - 5 * sk(dr, "fire");
  dr.stamina = Math.max(0, (dr.stamina ?? 1) - 0.08);
  dr.dir = x > dr.x ? 1 : -1;
  w.sfx("whoosh", dr.x, dr.y, 1, 0.5);
  w.sfx("ignite", x, y, 1, 0.6);
  if (!w.flags.has("dragonFire")) {
    w.flags.add("dragonFire");
    w.discover("dragonFire", x, y);
  }
  return true;
}

/** Per frame during a burst: the cone of fire from the mouth to the aim point. */
function burstTick(w: World, dr: Dragon, dt: number) {
  const st = dragonStats(dr);
  dr.burst = Math.max(0, (dr.burst ?? 0) - dt);
  dr.breath = 1;
  dr.stamina = Math.max(0, (dr.stamina ?? 1) - (dt * 0.1) / st.def.stamina);
  const ax = dr.aimX ?? dr.x;
  const ay = dr.aimY ?? dr.y;
  dr.dir = ax >= dr.x ? 1 : -1;
  const mx = dr.x + dr.dir * 50 * st.scale;
  const my = dr.y;
  // reach: older + better-trained dragons breathe further
  const reach = 80 + 150 * st.fire;
  const dd = Math.hypot(ax - mx, ay - my) || 1;
  const k = Math.min(1, reach / dd);
  const ex = mx + (ax - mx) * k;
  const ey = my + (ay - my) * k;
  if (w.inView(ex, ey, 300)) {
    for (let i = 0; i < 4; i++) {
      const t = w.rng();
      w.particles.spawn(P.Ember, mx + (ex - mx) * t + (w.rng() - 0.5) * 20 * t, my + (ey - my) * t + (w.rng() - 0.5) * 12 * t, { z: dr.z * (1 - t) + 30 * st.scale * (1 - t) + 4, vz: 30 + w.rng() * 40, vx: (ex - mx) * 0.3, size: 4 + w.rng() * 5 * st.fire, max: 0.5 + w.rng() * 0.4, color: w.rng() < 0.4 ? "#fff1a8" : w.rng() < 0.7 ? "#ffb02e" : "#ff5a1f" });
    }
    if (w.rng() < dt * 8) w.particles.spawn(P.Smoke, ex, ey - 10, { vz: 40, vx: w.weather.windX * 8, size: 16 + w.rng() * 10, max: 2, color: "rgba(60,55,50,0.4)" });
  }
  w.dragons.pulse -= dt;
  if (w.dragons.pulse > 0) return;
  w.dragons.pulse = 0.15;
  const r = 26 + 30 * st.fire;
  const tx = Math.floor(ex / TILE);
  const ty = Math.floor(ey / TILE);
  const tr = Math.ceil(r / TILE);
  for (let y = ty - tr; y <= ty + tr; y++) for (let x = tx - tr; x <= tx + tr; x++) {
    if (Math.hypot(x * TILE + TILE / 2 - ex, y * TILE + TILE / 2 - ey) > r + 8) continue;
    if (w.rng() < 0.5) w.fire.ignite(w, x, y, 0.6 + 0.3 * Math.min(1, st.fire));
  }
  // the line of the cone scorches plants on the way
  w.burnPlantsAt(ex, ey, 0.45 * st.fire);
  w.burnPlantsAt((mx + ex) / 2, (my + ey) / 2, 0.25 * st.fire);
  const hit = (x: number, y: number, rr: number) => Math.hypot(x - ex, y - ey) < r + rr || Math.hypot(x - (mx + ex) / 2, y - (my + ey) / 2) < r * 0.6 + rr;
  for (const d of w.dinos) {
    if (d.owner || d.under || sp(d.species).move === "swim" || !hit(d.x, d.y, sizeOf(d) * 0.3)) continue;
    d.health -= 0.1 * st.fire;
    d.fear = 1;
    emote(d, "🔥", 1.2);
    if (sp(d.species).move === "walk" && d.state !== "flee") setState(d, "flee", d.x + (d.x - ex) * 4, d.y + (d.y - ey) * 4);
  }
  for (const b of w.rivals.brutes) if (b.hp > 0 && hit(b.x, b.y, 10)) w.rivals.hit(w, b, 0.32 * st.fire, dr.x, dr.y, false, "fire");
  for (const wd of [...w.dragons.list]) if (hit(wd.x, wd.y, 40) && wd.z < dr.z + 120) w.dragons.hit(w, wd, 70 * st.fire);
  for (const h of w.humans) {
    if (h.aloft || h.under || !hit(h.x, h.y, 6)) continue;
    const home = h.state === "hide" || h.state === "sleep" ? w.shelters.find((s) => s.id === h.home) : null;
    if (home && home.tier >= 3) continue;
    hurtHuman(w, h, 0.18 * st.fire, ex, ey, "burn");
  }
  // wooden things catch: huts, buildings, palisades
  for (const b of w.colony.buildings) if (hit(b.x, b.y, 20)) b.hp -= (b.kind === "blacksmith" || b.kind === "roost" || b.kind === "hatchery" ? 2 : 12) * st.fire;
  for (const s of w.shelters) if (s.stage > 0 && hit(s.x, s.y, 20)) s.hp = Math.max(0, s.hp - (s.tier >= 4 ? 0.005 : s.tier >= 3 ? 0.02 : 0.07) * st.fire);
  const wl = w.tribe.wallAt(tx, ty);
  if (wl && wl.built >= 1) wl.hp -= (wl.kind === "palisade" ? 18 : 3) * st.fire;
  // Neanderthal camps: their stores + shelters burn
  for (const c of w.rivals.clans) {
    if (Math.hypot(c.x - ex, c.y - ey) > 140) continue;
    c.food = Math.max(0, c.food - 1.5 * st.fire);
    c.campWork = 0;
    const heat = (w.dragons.scorch[c.id] = (w.dragons.scorch[c.id] ?? 0) + st.fire);
    if (heat > 14 && (c.campTier ?? 0) > 0) {
      w.dragons.scorch[c.id] = 0;
      c.campTier = (c.campTier ?? 0) - 1;
      w.toast("🔥", `Dragon fire burned down part of the ${c.name} camp!`, c.x, c.y);
    }
  }
}

/* ------------------------------ per frame ------------------------------ */

export function ownedUpdate(w: World, dt: number) {
  for (const dr of [...w.dragons.owned]) {
    if (dr.hp <= 0) {
      loseDragon(w, dr);
      continue;
    }
    stepOwned(w, dr, dt);
  }
}

function loseDragon(w: World, dr: Dragon) {
  const h = dragonRiderOf(w, dr);
  const on = w.humans.find((x) => x.aloft === dr.id);
  if (on) dismountDragon(w, on);
  if (h) h.dragon = undefined;
  w.dragons.owned.splice(w.dragons.owned.indexOf(dr), 1);
  w.particles.burst(P.Poof, dr.x, dr.y, 16, 80, { size: 16, max: 1.2, color: "rgba(220,210,200,0.9)" });
  w.toast("💔", `${dr.name} was badly hurt and flew off into the mountains. It may never come back…`, dr.x, dr.y);
}

function stepOwned(w: World, dr: Dragon, dt: number) {
  dr.t += dt;
  dr.hit = Math.max(0, dr.hit - dt * 3);
  dr.hop = Math.max(0, (dr.hop ?? 0) - dt);
  if (!(dr.burst ?? 0)) dr.breath = Math.max(0, dr.breath - dt * 2.5);
  dr.fireCd = Math.max(0, (dr.fireCd ?? 0) - dt);
  dr.restT = Math.max(0, (dr.restT ?? 0) - dt);
  if (dr.cmd) dr.cmd.t += dt;
  grow(w, dr, dt);
  // on stage: the show moves it (shows.ts)
  if (w.dragons.show?.acts.includes(dr.id)) {
    dr.breath = Math.max(0, dr.breath - dt * 2.5);
    return;
  }
  const air = dr.z > 6;
  const def = BREEDS[dr.breed ?? "fire"];
  // stamina: flying drains it (more with a rider, cargo or a storm); resting brings it back
  if (air) dr.stamina = Math.max(0, (dr.stamina ?? 1) - (dt * (0.0045 + (dr.rider ? 0.0025 : 0) + (dr.carrying ? 0.003 : 0)) * (w.weather.storm > 0.55 ? 2 : 1)) / def.stamina);
  else dr.stamina = Math.min(1, (dr.stamina ?? 1) + dt * (dr.state === "sleep" ? 0.05 : 0.025) * (nearRoost(w, dr) ? 1.5 : 1));
  dr.energy = Math.max(0, Math.min(1, (dr.energy ?? 1) + (dr.state === "sleep" ? dt * 0.02 : -dt * (air ? 0.0025 : 0.0012))));
  dr.hunger = Math.min(1, (dr.hunger ?? 0) + dt * ((dr.growth ?? 0) < 0.25 ? 0.0055 : 0.003));
  if (!air && dr.state !== "walk") dr.hp = Math.min(dr.maxHp, dr.hp + dt * dr.maxHp * (dr.state === "sleep" ? 0.006 : 0.003));
  else if (air && !dr.foe) dr.hp = Math.min(dr.maxHp, dr.hp + dt * dr.maxHp * 0.001);
  // holding a Neanderthal with no order to drop them: let go (they fall)
  if (dr.prey && dr.cmd?.kind !== "volcano") {
    const b = w.rivals.byId(dr.prey);
    dr.prey = undefined;
    dr.preyBrute = false;
    if (b && b.snatched === dr.id) w.dragons.dropBody(w, dr, b, false, false, "");
  }
  if (dr.burst) burstTick(w, dr, dt);
  // out of strength in the air: down it comes (wherever it is)
  if (air && (dr.stamina ?? 1) < 0.06 && dr.cmd?.kind !== "land") {
    dr.cmd = { kind: "land", x: dr.x, y: dr.y, t: 0, auto: true };
    if (!w.flags.has("dragonTired")) {
      w.flags.add("dragonTired");
      w.toast("😮‍💨", `${dr.name} is exhausted and has to land! Dragons need rest between long flights.`, dr.x, dr.y);
    }
  }
  if (dr.cmd) {
    if (runCmd(w, dr, dr.cmd, dt)) return;
    dr.cmd = null;
  }
  if (dr.auto !== false) autoThink(w, dr, dt);
  else idle(w, dr, dt);
}

function grow(w: World, dr: Dragon, dt: number) {
  if ((dr.growth ?? 0) >= 1) return;
  const before = growthStage(dr.growth ?? 0);
  const fed = (dr.hunger ?? 0) < 0.8;
  dr.age = (dr.age ?? 0) + dt * (fed ? 1 : 0.35);
  dr.growth = Math.min(1, ((dr.age ?? 0) / GROW_SECONDS) * (dr.rare ? 1.15 : 1));
  const after = growthStage(dr.growth);
  if (after !== before) {
    newDragonStats(dr);
    const g = GROWTH.find((x) => x.id === after)!;
    w.toast("🐉", `${dr.name} is growing up: now a ${g.name.toLowerCase()}!${after === "juvenile" ? " Old enough to start flying lessons." : after === "youngAdult" ? " Big enough to carry loads and learn to take a rider." : after === "adult" ? " Full-grown, at full strength." : ""}`, dr.x, dr.y);
    if (after === "adult") w.discover("dragonGrown", dr.x, dr.y);
  } else if (w.rng() < dt * 0.05) newDragonStats(dr);
}

const nearRoost = (w: World, dr: Dragon) => w.colony.buildings.some((b) => b.kind === "roost" && b.built >= 1 && Math.hypot(b.x - dr.x, b.y - dr.y) < 120);

/** Hold still (hovering if airborne). */
function idle(w: World, dr: Dragon, dt: number) {
  if (dr.z > 6) {
    hover(w, dr, dr.x, dr.y, Math.max(120, dr.z), dt);
    return;
  }
  dr.vx = dr.vy = 0;
  dr.anim += dt * 0.6;
  if (dr.state !== "sleep" && dr.state !== "play") dr.state = "idle";
}

function hover(w: World, dr: Dragon, x: number, y: number, z: number, dt: number) {
  const a = dr.t * 0.5 + dr.id;
  flyToward(w, dr, x + Math.cos(a) * 60, y + Math.sin(a) * 34, z, dt, 0.45);
  dr.state = "hover";
}

/* ------------------------------ orders ------------------------------ */

/** Run an order. Returns false when it's finished. */
function runCmd(w: World, dr: Dragon, cmd: DragonCmd, dt: number): boolean {
  // tired out: home, whatever the order was
  if (FLIGHT_CMDS.has(cmd.kind) && (dr.stamina ?? 1) < 0.18 && !(dr.burst ?? 0)) {
    dr.cmd = { kind: "home", x: 0, y: 0, t: 0, auto: true };
    w.toast("😮‍💨", `${dr.name} is getting tired and heads home to rest.`, dr.x, dr.y);
    return true;
  }
  // losing a fight: break off and fly home to heal (it'll live to fight again)
  if (FIGHT_CMDS.has(cmd.kind) && dr.hp < dr.maxHp * 0.3 && !cmd.auto) {
    dr.cmd = { kind: "home", x: 0, y: 0, t: 0, auto: true };
    w.toast("🩹", `${dr.name} is badly hurt and pulls out of the fight to heal at its roost.`, dr.x, dr.y);
    return true;
  }
  if (FIGHT_CMDS.has(cmd.kind) && dr.hp < dr.maxHp * 0.3 && cmd.auto) {
    dr.cmd = { kind: "home", x: 0, y: 0, t: 0, auto: true };
    if (!w.flags.has(`heal${dr.id}`)) {
      w.flags.add(`heal${dr.id}`);
      w.toast("🩹", `${dr.name} is hurt and smart enough to pull back: it heals at its roost, then goes again.`, dr.x, dr.y);
    }
    return true;
  }
  // the rider climbs on first (if they're close enough to come)
  if (FLIGHT_CMDS.has(cmd.kind) && (cmd.i ?? 0) === 0 && boarding(w, dr, cmd, dt)) return true;
  if ((cmd.i ?? 0) === 0) cmd.i = 1;
  switch (cmd.kind) {
    case "stay":
      if (dr.z > 6) hover(w, dr, cmd.x, cmd.y, Math.max(100, Math.min(200, dr.z)), dt);
      else {
        dr.vx = dr.vy = 0;
        dr.state = "idle";
      }
      return cmd.t < 240 || !cmd.auto;
    case "follow": {
      const h = dragonRiderOf(w, dr) ?? w.humans.find((x) => x.id === dr.trainer) ?? null;
      if (!h || h.aloft === dr.id) return false;
      const d = Math.hypot(h.x - dr.x, h.y - dr.y);
      if (d > 280 && canFly(dr)) flyToward(w, dr, h.x - 50, h.y + 20, 80, dt);
      else if (dr.z > 6) landAt(w, dr, h.x - 50, h.y + 20, dt);
      else if (d > 60) walkToward(w, dr, h.x - 44 * dr.dir, h.y + 16, dt);
      else idle(w, dr, dt);
      dr.state = dr.z > 6 ? "fly" : d > 60 ? "walk" : "idle";
      return true;
    }
    case "flyTo": {
      dr.state = "fly";
      const d = flyToward(w, dr, cmd.x, cmd.y, 220, dt);
      if (d < 50) {
        // arrived: circle overhead until told otherwise
        dr.cmd = { kind: "stay", x: cmd.x, y: cmd.y, t: 0, i: 1, auto: cmd.auto };
      }
      return true;
    }
    case "land": {
      if ((cmd.i ?? 1) === 1) {
        const s = landingSpot(w, cmd.x, cmd.y, dragonStats(dr).scale);
        cmd.x = s.x;
        cmd.y = s.y;
        cmd.i = 2;
      }
      dr.state = "fly";
      if (landAt(w, dr, cmd.x, cmd.y, dt)) {
        const h = w.humans.find((x) => x.aloft === dr.id);
        if (h) dismountDragon(w, h);
        dr.state = "idle";
        return false;
      }
      return true;
    }
    case "patrol":
    case "route": {
      dr.state = "fly";
      const foe = dr.foe ? foeById(w, dr.foe) : null;
      if (foe && warTrained(dr)) {
        if (engage(w, dr, foe, dt, true)) return true;
        dr.foe = undefined;
      }
      // patrolling the skies hardens it a little too
      if (warTrained(dr) && (dr.vet ?? 0) < 0.3) harden(w, dr, dt * 0.0006);
      if (cmd.t % 1 < dt) {
        const f = threatNear(w, dr.x, dr.y, 540);
        if (f && warTrained(dr)) {
          const p = foeXY(f);
          dr.foe = f.kind === "dino" ? f.d.id : f.kind === "brute" ? f.b.id : f.dr.id;
          w.toast("🐉", `${dr.name} spotted trouble on patrol and dives at it!`, p.x, p.y);
        }
      }
      if (cmd.kind === "patrol") {
        // an Auto patrol sweeps wide round the whole town
        const a = cmd.t * (cmd.auto ? 0.28 : 0.38) + dr.id;
        const rx = cmd.auto ? 460 : 270;
        flyToward(w, dr, cmd.x + Math.cos(a) * rx, cmd.y + Math.sin(a) * rx * 0.66, cmd.auto ? 230 : 200, dt, 0.75);
      } else {
        const pts = cmd.pts ?? [];
        if (!pts.length) return false;
        const i = ((cmd.i ?? 1) - 1) % pts.length;
        const p = pts[i];
        if (flyToward(w, dr, p.x, p.y, 210, dt, 0.85) < 60) cmd.i = (cmd.i ?? 1) + 1;
      }
      // an Auto patrol is a round, not forever
      return !cmd.auto || cmd.t < 100;
    }
    case "guard": {
      const foe = dr.foe ? foeById(w, dr.foe) : null;
      if (foe) {
        dr.state = "fly";
        if (engage(w, dr, foe, dt, !!cmd.auto) && Math.hypot(foeXY(foe).x - cmd.x, foeXY(foe).y - cmd.y) < 700) return true;
        dr.foe = undefined;
      }
      if (cmd.t % 1 < dt) {
        const f = threatNear(w, cmd.x, cmd.y, 400);
        if (f) dr.foe = f.kind === "dino" ? f.d.id : f.kind === "brute" ? f.b.id : f.dr.id;
        else if (cmd.auto && cmd.t > 12) return false;
      }
      if (canFly(dr)) hover(w, dr, cmd.x, cmd.y, 120, dt);
      else walkToward(w, dr, cmd.x, cmd.y, dt);
      return true;
    }
    case "attack": {
      const foe = cmd.target ? foeById(w, cmd.target) : null;
      if (!foe || cmd.t > 60) {
        if (!foe) say2(w, dr, pick(w.rng, ["Got it!", "Ha! Gone!", "Good dragon!"]));
        return false;
      }
      dr.state = "fly";
      return engage(w, dr, foe, dt, !!cmd.auto);
    }
    case "fire": {
      dr.state = "fly";
      if ((cmd.i ?? 1) === 2) {
        // breathing: circle the target until the burst runs out, then hold there
        hover(w, dr, cmd.x - dr.dir * 90, cmd.y, 90, dt);
        dr.dir = cmd.x >= dr.x ? 1 : -1;
        if (!(dr.burst ?? 0)) {
          dr.cmd = { kind: "stay", x: dr.x, y: dr.y, t: 0, i: 1, auto: true };
        }
        return true;
      }
      const st = dragonStats(dr);
      const range = 70 + 130 * st.fire;
      const d = travel(w, dr, cmd.x - (cmd.x >= dr.x ? 1 : -1) * range * 0.8, cmd.y, 90, dt);
      if (Math.hypot(cmd.x - dr.x, cmd.y - dr.y) < range + 30 || d < 20) {
        if (startBurst(w, dr, cmd.x, cmd.y)) cmd.i = 2;
        else return cmd.t < 8; // no breath left: give up shortly
      }
      return true;
    }
    case "carry":
      return carryCmd(w, dr, cmd, dt);
    case "volcano":
      return volcanoCmd(w, dr, cmd, dt);
    case "retreat":
    case "home": {
      const home = roostOf(w, dr);
      dr.state = "fly";
      if (landAt(w, dr, home.x, home.y, dt)) {
        const h = w.humans.find((x) => x.aloft === dr.id);
        if (h) dismountDragon(w, h);
        dr.state = w.daylight < 0.3 || (dr.energy ?? 1) < 0.4 ? "sleep" : "idle";
        dr.restT = 90;
        return false;
      }
      return true;
    }
  }
  return false;
}

function say2(w: World, dr: Dragon, text: string) {
  const h = w.humans.find((x) => x.aloft === dr.id);
  if (h) say(h, text);
}

/** The bonded rider is close: wait for them to climb on (they walk over, it comes down to meet them). */
function boarding(w: World, dr: Dragon, cmd: DragonCmd, dt: number) {
  const h = dragonRiderOf(w, dr);
  if (!h || h.aloft === dr.id || dr.rider) return false;
  if (h.state === "down" || h.under || h.captive || h.child || h.riding || cmd.t > 30) return false;
  const d = Math.hypot(h.x - dr.x, h.y - dr.y);
  if (d > 520) return false;
  if (d < 46 && dr.z < 4) {
    mountDragon(w, h, dr);
    cmd.i = 1;
    return false;
  }
  // come down near the rider
  if (dr.z > 4) landAt(w, dr, h.x + 40, h.y + 10, dt);
  else if (d > 40) walkToward(w, dr, h.x + 30, h.y + 6, dt * 0.6);
  return true;
}

/** Volcano Drop: swoop on a Neanderthal, climb high over the volcano with them, let go. */
function volcanoCmd(w: World, dr: Dragon, cmd: DragonCmd, dt: number) {
  dr.state = "fly";
  const held = dr.prey ? w.rivals.byId(dr.prey) : null;
  if (held && held.snatched === dr.id) {
    const v = w.volcano;
    const d = flyToward(w, dr, v.x, v.y, 440, dt, 1);
    if (d < 90 && dr.z > 380) {
      dr.prey = undefined;
      dr.preyBrute = false;
      const clan = w.rivals.clan(held.clan);
      w.dragons.dropBody(w, dr, held, true, true, `${dr.name} dropped ${held.name} of the ${clan?.name ?? "?"} clan into the volcano!`);
      say2(w, dr, pick(w.rng, ["Into the fire!", "Bye bye!", "Ha! Gone!"]));
      harden(w, dr, 0.04);
      return false;
    }
    return true;
  }
  const b = cmd.target ? w.rivals.byId(cmd.target) : null;
  if (!b || b.snatched || b.falling || b.hp <= 0 || cmd.t > 60) return false;
  const near = Math.hypot(b.x - dr.x, b.y - dr.y);
  travel(w, dr, b.x, b.y, near < 200 ? 22 : 160, dt, 1.15);
  if (near < 42 && dr.z < 50) {
    w.rivals.dropCaptive(w, b, false);
    b.snatched = dr.id;
    b.raid = false;
    dr.prey = b.id;
    dr.preyBrute = true;
    w.sfx("screech", dr.x, dr.y, 1.2, 0.5);
    w.toast("🐉", `${dr.name} snatched ${b.name} the Neanderthal! Off to the volcano…`, b.x, b.y);
  }
  return true;
}

/** Carry: land at the stores, load what the nearest building site needs, fly it over, unload. */
function carryCmd(w: World, dr: Dragon, cmd: DragonCmd, dt: number) {
  const st = dragonStats(dr);
  const site = sites(w).filter((s) => s.need && !s.locked).sort((a, b) => Math.hypot(a.x - cmd.x, a.y - cmd.y) - Math.hypot(b.x - cmd.x, b.y - cmd.y))[0];
  if (!dr.carrying) {
    if (!site || Math.hypot(site.x - cmd.x, site.y - cmd.y) > 400) {
      say2(w, dr, "Nothing to carry there.");
      return false;
    }
    const r = site.need as Resource;
    if (w.camp.stock[r] < 1) {
      w.toast("📦", `No ${r} in the stores for ${dr.name} to carry.`, dr.x, dr.y);
      return false;
    }
    dr.state = "fly";
    if (landAt(w, dr, w.camp.pileX + 40, w.camp.pileY + 20, dt)) {
      const n = Math.min(st.carry, w.camp.stock[r]);
      w.camp.stock[r] -= n;
      dr.carrying = { r, n };
      w.sfx("thud", dr.x, dr.y, 0.6);
    }
    return true;
  }
  if (!site) {
    w.camp.stock[dr.carrying.r] += dr.carrying.n;
    dr.carrying = null;
    return false;
  }
  dr.state = "fly";
  if (landAt(w, dr, site.sx + 30, site.sy + 10, dt)) {
    const used = deliver(w, site, dr.carrying.r, dr.carrying.n, dr.x, dr.y);
    const left = dr.carrying.n - used;
    if (left > 0) w.camp.stock[dr.carrying.r] += left;
    w.toast("📦", `${dr.name} flew in ${used} ${dr.carrying.r} for the building site.`, dr.x, dr.y);
    dr.carrying = null;
    return false;
  }
  return true;
}

/* ------------------------------ Auto ------------------------------ */

function autoThink(w: World, dr: Dragon, dt: number) {
  const g = dr.growth ?? 0;
  const home = roostOf(w, dr);
  const night = w.daylight < 0.25;
  // asleep: stay asleep until morning (and rested)
  if (dr.state === "sleep") {
    if ((!night && (dr.energy ?? 1) > 0.6) || dr.hit > 0.5) dr.state = "idle";
    else {
      dr.vx = dr.vy = 0;
      return;
    }
  }
  // hungry: the feeding area / stores, else (big enough) hunt
  if ((dr.hunger ?? 0) > 0.75 && eat(w, dr, dt)) return;
  // tired or night: home to the roost to sleep
  if (night || (dr.energy ?? 1) < 0.25 || ((dr.stamina ?? 1) < 0.3 && dr.z > 6)) {
    if (Math.hypot(home.x - dr.x, home.y - dr.y) > 40 || dr.z > 2) {
      dr.state = "fly";
      landAt(w, dr, home.x, home.y, dt);
      return;
    }
    dr.state = "sleep";
    return;
  }
  // trouble near camp: a trained war dragon answers it (not a little lizard)
  if (warTrained(dr) && (dr.stamina ?? 1) > 0.35 && dr.hp > dr.maxHp * 0.45 && w.dragons.scanT <= 0) {
    const rider = dragonRiderOf(w, dr);
    const f = threatNear(w, w.camp.x, w.camp.y, 1100) ?? (rider && !rider.aloft ? threatNear(w, rider.x, rider.y, 500) : null);
    if (f) {
      const p = foeXY(f);
      const id = f.kind === "dino" ? f.d.id : f.kind === "brute" ? f.b.id : f.dr.id;
      // a big war dragon now and then carries a Neanderthal off to the volcano instead
      const drop = f.kind === "brute" && f.b.weapon !== "catapult" && (dr.growth ?? 0) >= 0.55 && w.rng() < 0.35;
      dr.cmd = { kind: drop ? "volcano" : "attack", x: p.x, y: p.y, target: id, t: 0, auto: true };
      if (!w.flags.has(`dragonDefend${dr.id}`)) {
        w.flags.add(`dragonDefend${dr.id}`);
        w.toast("🐉", `${dr.name} takes off to defend the camp!`, dr.x, dr.y);
      }
      return;
    }
  }
  // a bonded war dragon + its rider patrol the camp now and then
  // a bonded battle dragon + its rider patrol the skies over the town (the rider leaves their work for it)
  if (dr.partner && warTrained(dr) && !dr.restT && (dr.stamina ?? 1) > 0.7 && dr.hp > dr.maxHp * 0.6 && w.daylight > 0.5 && w.weather.storm < 0.4) {
    const h = dragonRiderOf(w, dr);
    if (h && !h.order && h.state !== "down" && !h.under && !h.captive) {
      dr.cmd = { kind: "patrol", x: w.camp.x, y: w.camp.y, t: 0, auto: true };
      dr.restT = 140;
      if (!w.flags.has(`skyPatrol${dr.id}`)) {
        w.flags.add(`skyPatrol${dr.id}`);
        w.toast("🐉", `${dr.name} and ${h.name} take to the skies on patrol: they'll swoop on anything that threatens the town.`, dr.x, dr.y);
      }
      return;
    }
  }
  // a dragon and its rider stay together: it keeps close to them wherever they are
  const mate = dragonRiderOf(w, dr);
  if (mate && !mate.aloft && !mate.under && !mate.captive && mate.state !== "sleep" && (dr.growth ?? 0) >= 0.25) {
    const d = Math.hypot(mate.x - dr.x, mate.y - dr.y);
    if (d > 170) {
      if (d > 520 && canFly(dr)) flyToward(w, dr, mate.x - 60, mate.y + 20, 110, dt, 0.8);
      else if (dr.z > 6) landAt(w, dr, mate.x - 60, mate.y + 20, dt);
      else walkToward(w, dr, mate.x - 50, mate.y + 16, dt);
      dr.state = dr.z > 6 ? "fly" : "walk";
      return;
    }
  }
  // babies tag along after their trainer; everyone else potters about near home + plays
  const trainer = dr.trainer ? w.humans.find((h) => h.id === dr.trainer && h.state !== "dragonCare") : null;
  if (g < 0.25 && trainer && Math.hypot(trainer.x - dr.x, trainer.y - dr.y) < 400) {
    if (Math.hypot(trainer.x - dr.x, trainer.y - dr.y) > 46) {
      walkToward(w, dr, trainer.x - 30, trainer.y + 12, dt);
      dr.state = "walk";
      return;
    }
  }
  if (dr.z > 6) {
    landAt(w, dr, home.x, home.y, dt);
    dr.state = "fly";
    return;
  }
  // potter: wander a little, play (hops, little flaps), sit
  if (dr.state === "walk" && Math.hypot(dr.tx - dr.x, dr.ty - dr.y) > 6) {
    walkToward(w, dr, dr.tx, dr.ty, dt);
    return;
  }
  if (dr.t > 4 + (dr.id % 5)) {
    dr.t = 0;
    const r = w.rng();
    if (r < 0.35) {
      dr.tx = home.x + (w.rng() - 0.5) * 140;
      dr.ty = home.y + (w.rng() - 0.5) * 80;
      dr.state = "walk";
    } else if (r < 0.6 + (g < 0.55 ? 0.2 : 0)) {
      dr.state = "play";
      dr.hop = 1.2;
      if (g < 0.4 && w.rng() < 0.5) w.sfx("chirp", dr.x, dr.y, 0.5, 1.6);
    } else dr.state = "idle";
  }
  if (dr.state !== "walk") dr.vx = dr.vy = 0;
}

const FOOD: Resource[] = ["meat", "cooked", "fish"];

/** Eat: at the feeding area (or the stores), else hunt a small wild dino. */
function eat(w: World, dr: Dragon, dt: number) {
  const pit = w.colony.buildings.find((b) => b.kind === "feedPit" && b.built >= 1);
  const food = FOOD.find((r) => w.camp.stock[r] > 0);
  if (food) {
    const spot = pit ? { x: pit.x, y: pit.y + 16 } : { x: w.camp.pileX + 40, y: w.camp.pileY + 24 };
    const d = Math.hypot(spot.x - dr.x, spot.y - dr.y);
    if (d > 30 || dr.z > 2) {
      if (canFly(dr) && d > 160) landAt(w, dr, spot.x, spot.y, dt);
      else walkToward(w, dr, spot.x, spot.y, dt);
      dr.state = dr.z > 6 ? "fly" : "walk";
      return true;
    }
    const n = Math.min(w.camp.stock[food], (dr.growth ?? 0) < 0.25 ? 1 : 2);
    w.camp.stock[food] -= n;
    dr.hunger = Math.max(0, (dr.hunger ?? 0) - 0.3 * n * (pit ? 1.3 : 1));
    dr.state = "idle";
    w.sfx("munch", dr.x, dr.y, 0.7, 0.7);
    return true;
  }
  if ((dr.growth ?? 0) < 0.55 || !canFly(dr)) return false;
  // nothing in the stores: hunt something small
  const prey = w.dinos.filter((d) => !d.owner && !d.raider && !d.under && sp(d.species).move === "walk" && sp(d.species).diet === "herbivore" && sizeOf(d) < 90 && Math.hypot(d.x - dr.x, d.y - dr.y) < 1100).sort((a, b) => Math.hypot(a.x - dr.x, a.y - dr.y) - Math.hypot(b.x - dr.x, b.y - dr.y))[0];
  if (!prey) return false;
  dr.state = "fly";
  if (flyToward(w, dr, prey.x, prey.y, 30, dt) < 40) {
    w.particles.burst(P.Poof, prey.x, prey.y, 8, 50, { size: 10, max: 0.8, color: "rgba(230,220,200,0.9)" });
    w.sfx("chomp", prey.x, prey.y, 1, 0.6);
    w.removeDino(prey);
    dr.hunger = 0.05;
  }
  return true;
}

/* ------------------------------ people ------------------------------ */

/** A Dragon Rider's own business (before their job): climb on when their dragon wants them. */
export function dragonRiderThink(w: World, h: Human): boolean {
  const dr = dragonOf(w, h);
  if (!dr) {
    if (h.dragon) h.dragon = undefined;
    return false;
  }
  const cmd = dr.cmd;
  // their dragon is grounded far off (and can't come to them): go to it
  if ((!cmd || !FLIGHT_CMDS.has(cmd.kind)) && dr.z < 6 && !canFly(dr) && !h.order && w.daylight > 0.3 && Math.hypot(h.x - dr.x, h.y - dr.y) > 600) {
    go(h, "walk", dr.x - 30, dr.y + 10);
    if (h.stateT < 0.1) say(h, `Where are you, ${dr.name}?`);
    return true;
  }
  if (!cmd || !FLIGHT_CMDS.has(cmd.kind) || (cmd.i ?? 0) !== 0 || dr.rider || cmd.t > 30) return false;
  if (Math.hypot(h.x - dr.x, h.y - dr.y) > 520) return false;
  go(h, "walk", dr.x - 20 * dr.dir, dr.y + 6);
  if (h.stateT < 0.1) say(h, `Coming, ${dr.name}!`);
  return true;
}

/** Danger close by and a war dragon of their own: rider and dragon answer it together. */
export function dragonRiderDefend(w: World, h: Human, danger: { x: number; y: number; kind: string }) {
  if (danger.kind !== "raid" && danger.kind !== "predator" && danger.kind !== "dragon") return false;
  const dr = dragonOf(w, h);
  if (!dr || !warTrained(dr) || (dr.stamina ?? 1) < 0.3 || (dr.cmd && !dr.cmd.auto)) return false;
  if (Math.hypot(dr.x - h.x, dr.y - h.y) > 520) return false;
  if (!dr.cmd || dr.cmd.kind !== "guard") dr.cmd = { kind: "guard", x: danger.x, y: danger.y, t: 0, auto: true };
  return dragonRiderThink(w, h);
}

/* ------------------------------ the dragon trainer ------------------------------ */

/** Anything dragon-related for a trainer to do? (eggs at camp count too) */
export function dragonWork(w: World) {
  if (w.dragons.eggs.some((e) => e.at === "camp")) return 1;
  return w.dragons.owned.some((d) => nextDragonLesson(d) || (d.hunger ?? 0) > 0.6 || (rideable(d) && !d.partner)) ? 1 : 0;
}

/** Its keeper is around to look after it themselves (so trainers help elsewhere). */
const keeperHere = (w: World, thing: { keeper?: number }) => {
  const k = thing.keeper ? w.humans.find((x) => x.id === thing.keeper) : null;
  return !!k && k.state !== "down" && !k.under && !k.captive;
};

/** A trainer looks after the eggs + dragons first (they're the precious ones). */
export function dragonTrainerThink(w: World, h: Human): boolean {
  if (h.child) return false;
  const ds = w.dragons;
  // an incubation shelter with eggs in it running low on fuel: stoke it
  for (const b of w.colony.buildings) {
    if (b.kind !== "hatchery" || b.built < 1) continue;
    if (!ds.eggs.some((e) => e.at === "camp" && Math.hypot(e.x - b.x, e.y - b.y) < 60)) continue;
    if ((ds.fuel[b.id] ?? 0) > 90) continue;
    const s = w.camp.stock;
    if (s.wood < 1 && s.stick < 2 && s.coal < 1) continue;
    if (Math.hypot(h.x - b.x, h.y - b.y) > 30) {
      go(h, "walk", b.x, b.y + 14);
      return true;
    }
    if (s.coal >= 1) {
      s.coal--;
      ds.fuel[b.id] = (ds.fuel[b.id] ?? 0) + 420;
    } else if (s.wood >= 1) {
      s.wood--;
      ds.fuel[b.id] = (ds.fuel[b.id] ?? 0) + 240;
    } else {
      s.stick -= 2;
      ds.fuel[b.id] = (ds.fuel[b.id] ?? 0) + 150;
    }
    say(h, "Keep warm, little eggs!");
    w.particles.burst(P.Ember, b.x, b.y - 10, 6, 30, { z: 10, size: 3, max: 0.8, color: "#ffb347" });
    return true;
  }
  // a cold egg with no fire or fuelled shelter beside it: light a fire next to it
  if (w.camp.learned.has("fire") && w.camp.stock.stick >= 2) {
    const cold = ds.eggs.find((e) => e.at === "camp" && eggWarmth(w, e.x, e.y).heat < 0.6 && !w.campfires.some((f) => Math.hypot(f.x - e.x, f.y - e.y) < 80));
    if (cold) {
      const fx = cold.x - 36;
      const fy = cold.y + 6;
      if (Math.hypot(h.x - fx, h.y - fy) > 20) {
        go(h, "walk", fx + 14, fy + 10);
        return true;
      }
      w.camp.stock.stick -= 2;
      w.campfires.push({ id: w.nextId(), x: fx, y: fy, lit: true, fuel: 1, cook: 0 });
      say(h, "A fire for the egg!");
      w.sfx("ignite", fx, fy, 0.6);
      return true;
    }
  }
  // a ready dragon gets its rider
  for (const dr of ds.owned) {
    if (!rideable(dr) || dragonRiderOf(w, dr)) continue;
    const r = chooseDragonRider(w, dr);
    if (r) bondDragon(w, dr, r);
  }
  // hungry dragons get fed (babies often)
  const hungry = ds.owned.find((d) => (d.hunger ?? 0) > 0.6 && d.z < 6 && Math.hypot(d.x - h.x, d.y - h.y) < 900);
  if (hungry && FOOD.some((r) => w.camp.stock[r] > 0)) return attendDragon(w, h, hungry);
  // lessons: the dragon that's furthest behind
  let pupil = ds.owned.find((d) => d.trainer === h.id && nextDragonLesson(d) && d.z < 6 && !d.cmd) ?? null;
  if (!pupil) {
    pupil = ds.owned.filter((d) => nextDragonLesson(d) && !keeperHere(w, d) && (!d.trainer || d.trainer === h.id || !w.humans.some((o) => o.id === d.trainer && w.tribe.roleOf(o) === "trainer")) && d.z < 6 && !d.cmd && d.state !== "sleep").sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0] ?? null;
  }
  if (pupil) {
    pupil.trainer = h.id;
    pupil.lesson = nextDragonLesson(pupil);
    return attendDragon(w, h, pupil);
  }
  // eggs: sit with them (tended eggs come along faster)
  const egg = ds.eggs.find((e) => e.at === "camp" && !e.hatchT && !keeperHere(w, e) && !w.humans.some((o) => o !== h && o.state === "dragonCare" && o.targetId === e.id));
  if (egg) {
    h.targetId = egg.id;
    if (Math.hypot(h.x - egg.x, h.y - egg.y) < 22) go(h, "dragonCare", h.x, h.y);
    else go(h, "walk", egg.x + 16, egg.y + 6);
    return true;
  }
  return false;
}

function attendDragon(w: World, h: Human, dr: Dragon) {
  h.targetId = dr.id;
  const reach = 34 + 30 * dragonStats(dr).scale;
  if (Math.hypot(h.x - dr.x, h.y - dr.y) < reach) go(h, "dragonCare", h.x, h.y);
  else go(h, "walk", dr.x + (h.x < dr.x ? -reach * 0.8 : reach * 0.8), dr.y + 8);
  return true;
}

/** Per frame while a person is caring for a dragon (or an egg). */
export function dragonCareTick(w: World, h: Human, dt: number) {
  const egg = w.dragons.eggs.find((e) => e.id === h.targetId);
  if (egg) {
    h.anim += dt * 2;
    if (egg.at !== "camp" || h.stateT > 24) {
      go(h, "idle", h.x, h.y);
      h.think = 0;
    } else if (w.rng() < dt * 0.05) say(h, pick(w.rng, ["Nice and warm…", "Is it moving?", "Shh, it's sleeping."]));
    return;
  }
  const dr = ownedDragon(w, h.targetId);
  if (!dr || dr.z > 6 || dr.cmd) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
    return;
  }
  const reach = 40 + 34 * dragonStats(dr).scale;
  if (Math.hypot(h.x - dr.x, h.y - dr.y) > reach) {
    go(h, "walk", dr.x - 20, dr.y + 8);
    return;
  }
  h.dir = dr.x > h.x ? 1 : -1;
  h.anim += dt * 3;
  // feeding first
  if ((dr.hunger ?? 0) > 0.6) {
    const food = FOOD.find((r) => w.camp.stock[r] > 0);
    if (food) {
      w.camp.stock[food]--;
      dr.hunger = Math.max(0, (dr.hunger ?? 0) - 0.45);
      dr.skills = dr.skills ?? {};
      dr.skills.trust = Math.min(1, (dr.skills.trust ?? 0) + 0.06);
      say(h, pick(w.rng, [`Here, ${dr.name}!`, "Good dragon!", "Not my fingers!"]));
      w.sfx("munch", dr.x, dr.y, 0.6, 1.2);
    }
    go(h, "idle", h.x, h.y);
    h.think = 1;
    return;
  }
  const lesson = dr.lesson ?? nextDragonLesson(dr);
  if (!lesson || (dr.growth ?? 0) < LESSON_BY_ID[lesson].minGrowth) {
    dr.lesson = null;
    go(h, "idle", h.x, h.y);
    h.think = 0;
    return;
  }
  dr.lesson = lesson;
  dr.trainer = h.id;
  const def = LESSON_BY_ID[lesson];
  const yard = w.colony.buildings.some((b) => b.kind === "dragonYard" && b.built >= 1 && Math.hypot(b.x - dr.x, b.y - dr.y) < 280);
  const rate = (w.tribe.roleOf(h) === "trainer" ? 1.5 : 1) * (yard ? 1.4 : 1) * (0.7 + 0.6 * BREEDS[dr.breed ?? "fire"].smarts) * (dr.rare ? 1.2 : 1) * ((dr.hunger ?? 0) > 0.85 ? 0.4 : 1);
  dr.skills = dr.skills ?? {};
  dr.skills[lesson] = Math.min(1, (dr.skills[lesson] ?? 0) + (dt * rate) / def.secs);
  // the dragon does the lesson: little hops + flaps, a puff of smoke, a crouch for the rider
  dr.dir = h.x > dr.x ? 1 : -1;
  if (lesson === "flight" || lesson === "carry") {
    if (!dr.hop) dr.hop = 1.4;
  } else if (lesson === "fire" && w.rng() < dt * 0.6) {
    dr.breath = 0.5;
    w.particles.spawn(P.Smoke, dr.x + dr.dir * 40, dr.y - 30, { vz: 30, size: 8, max: 1.2, color: "rgba(80,80,80,0.5)" });
  }
  dr.state = "play";
  if (w.rng() < dt * 0.06) say(h, pick(w.rng, [def.icon + " Again!", "Good!", "That's it!", "Steady…"]));
  if ((dr.skills[lesson] ?? 0) >= 1) {
    w.toast(def.icon, `${dr.name} has learned ${def.name.toLowerCase()}! (${dragonStage(dr)})`, dr.x, dr.y);
    dr.lesson = null;
    go(h, "idle", h.x, h.y);
    h.think = 0.5;
    return;
  }
  if (h.stateT > 40) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
  }
}

/* ------------------------------ helpers for the UI ------------------------------ */

export function dragonInfo(w: World, dr: Dragon) {
  const st = dragonStats(dr);
  const rider = dragonRiderOf(w, dr);
  return {
    stage: dragonStage(dr),
    growth: growthStage(dr.growth ?? 0),
    stats: st,
    rider,
    aloft: !!rider && rider.aloft === dr.id,
    next: nextDragonLesson(dr),
    waiting: waitingFor(dr),
  };
}

