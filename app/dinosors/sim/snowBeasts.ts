/* ------------------------------------------------------------------ */
/*  The animals of the snowy Great Peaks.                              */
/*                                                                     */
/*  • Snow leopards: lone ambush hunters, smoky-spotted, almost        */
/*    invisible lying still on the snowy rocks.                        */
/*  • Rimeclaws: fluffy white pack raptors of the snowfields.          */
/*  • Frosthorns: shaggy horned herds of the passes (the Snow People's */
/*    mounts) and Glacierbacks: woolly armoured giants of the ice.     */
/*  • The Snow Rex: a white-furred tyrannosaur, the peaks' apex        */
/*    hunter. Camouflaged on the snowfields, it hunts hardest in a     */
/*    blizzard, sleeps in a mountain cave, and its roar carries for    */
/*    miles. Only ever one.                                            */
/*  • The Yeti: a rare make-believe giant guarding its ice cave. It    */
/*    roars, hurls blocks of ice, then charges anything that comes too */
/*    near, and never strays far from home. Only ever one.             */
/*                                                                     */
/*  They use the shared creature AI (hunting, herding, fleeing, eating */
/*  …) from behavior.ts. This adds what the cold gives them: they keep */
/*  to the snow (anything that strays off it heads back up), shelter   */
/*  in caves, blend in on snow (`snowCamo`), and the Yeti's own den    */
/*  brain. `SnowLife` keeps their numbers (its own dice, so the rest   */
/*  of the world plays out the same): rare ones never breed, the rest  */
/*  are topped up slowly from the high ground, never in view.          */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { addDino, emote, findSpawnSpot, setState, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { go, say } from "./humans";
import { EAST_CAVES, REGION } from "./terrain";
import { hitDino } from "./tribe";
import { yetiDueling } from "./yetiFeud";
import { MAP_W, T, TILE, type Brute, type Dino, type Human, type SpeciesId } from "./types";
import type { World } from "./world";

const SNOW_LIST: SpeciesId[] = ["snowLeopard", "yeti", "snowRex", "frosthorn", "rimeclaw", "glacierback"];
export const SNOW_SPECIES = new Set<SpeciesId>(SNOW_LIST);
export const isSnowBeast = (d: Pick<Dino, "species">) => SNOW_SPECIES.has(d.species);
/** The legends never lay eggs (they arrive from the high snow instead)… */
const RARE = new Set<SpeciesId>(["yeti", "snowRex"]);
/** …and there is only ever one Snow Rex (a few Yetis, each with its own den). */
const ONLY_ONE = new Set<SpeciesId>(["snowRex"]);
/** How many of each the peaks keep (SnowLife tops them up slowly; the common ones may also breed up to this). */
export const SNOW_KEEP: Partial<Record<SpeciesId, number>> = { snowLeopard: 3, rimeclaw: 4, frosthorn: 6, glacierback: 3, snowRex: 1, yeti: 3 };
/** Where each lives (tiles): the high snowfields, the passes' meadows, the ice. */
const SNOW_HOMES: Record<SpeciesId, [number, number][]> = {
  snowLeopard: [[226, 20], [262, 34], [238, 13]],
  rimeclaw: [[234, 30], [258, 27]],
  frosthorn: [[230, 44], [262, 50]],
  glacierback: [[236, 37], [266, 40]],
  snowRex: [[240, 31]],
  // each Yeti its own den: the ice caves + the high snowfields
  yeti: [[271, 26], [233, 42], [241, 13], [258, 34], [226, 19]],
} as Record<SpeciesId, [number, number][]>;

/** The Yeti treats anything this close to its cave as an intruder (px)… */
export const YETI_R = 330;
/** …gives up a chase this far from it… */
const YETI_LEASH = 640;
/** …and throws ice from this far (px). */
const HURL = { min: 110, max: 330, cd: 4.2 };
/** …but it lets people walk right up before it springs its ambush (px), then lunges this fast (px/s). */
const AMBUSH_R = 150;
const LUNGE = 125;
/** Out of the cold this far from home (px): head back up. */
const STRAY = 700;

type Prey = { kind: "human"; h: Human } | { kind: "dino"; d: Dino } | { kind: "brute"; b: Brute };
const posOf = (p: Prey) => (p.kind === "human" ? p.h : p.kind === "dino" ? p.d : p.b);

/** Cold ground: snow, ice, the bare peaks, the high rock (or anywhere deep snow has fallen). */
export function snowGround(w: World, x: number, y: number) {
  const t = w.terrain.tileAt(x, y);
  if (t === T.Snow || t === T.Ice || t === T.Mountain) return true;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const i = ty * MAP_W + tx;
  if (i < 0 || i >= w.terrain.tiles.length) return false;
  if (w.terrain.region[i] === REGION.peaks && (t === T.Rock || w.terrain.elev[i] > 0.5)) return true;
  return w.snow.at(x, y) > 0.5;
}

/** Blending in: a pale snow animal standing still (or stalking) on snow is hard to make out. */
export function snowCamo(w: World, d: Dino) {
  if (!isSnowBeast(d) || d.owner) return false;
  if (d.species !== "snowLeopard" && d.species !== "snowRex" && d.species !== "rimeclaw" && d.species !== "yeti") return false;
  const still = d.state === "idle" || d.state === "stalk" || d.state === "sleep" || Math.hypot(d.vx, d.vy) < 18;
  return still && snowGround(w, d.x, d.y);
}

/** The nearest mountain cave mouth (px), for sheltering at night / in a blizzard. */
function caveNear(x: number, y: number) {
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const c of EAST_CAVES) {
    if (c.kind !== "mountain") continue;
    const cx = (c.x + 0.5) * TILE;
    const cy = (c.y + 1.4) * TILE;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bd) {
      bd = d;
      best = { x: cx, y: cy };
    }
  }
  return best && bd < 1400 ? best : null;
}

/** Unbroken, walkable snow in a straight run from a to b (a Yeti goes nowhere else). */
export function snowPath(w: World, a: { x: number; y: number }, b: { x: number; y: number }) {
  for (let i = 1; i <= 8; i++) {
    const f = i / 8;
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    if (!snowGround(w, x, y) || !w.nav.passable("dino", x, y)) return false;
  }
  return true;
}

/** a Yeti that has just hung someone up leaves people alone until then (elapsed s) */
const contentUntil = new WeakMap<Dino, number>();
/** a charging Yeti: the nearest it has got to its prey, and when */
const closing = new WeakMap<Dino, { gap: number; t: number }>();
const PLEASED_FOR = 90;

function intruder(w: World, d: Dino, r: number, snowOnly = false, sparePeople = false, humanR = r): Prey | null {
  const ok = (x: number, y: number) => !snowOnly || snowPath(w, d, { x, y });
  let best: Prey | null = null;
  let bd = r;
  const hx = d.homeX;
  const hy = d.homeY;
  for (const h of w.humans) {
    if (Math.abs(h.x - d.x) > humanR + 40 || Math.hypot(h.x - d.x, h.y - d.y) > humanR) continue;
    if (sparePeople || h.under || h.aloft || h.captive || h.hung || h.yetiHeld || h.state === "down" || h.state === "hide" || h.falling || !ok(h.x, h.y)) continue;
    const dd = Math.hypot(h.x - hx, h.y - hy);
    if (dd < bd) {
      bd = dd;
      best = { kind: "human", h };
    }
  }
  for (const b of w.rivals.brutes) {
    if (b.hp <= 0 || b.snatched || b.falling || b.z > 20 || b.captive || !ok(b.x, b.y)) continue;
    const dd = Math.hypot(b.x - hx, b.y - hy);
    if (dd < bd) {
      bd = dd;
      best = { kind: "brute", b };
    }
  }
  for (const o of w.dinos) {
    if (o === d || o.under || o.species === "yeti" || o.state === "faint" || sp(o.species).move !== "walk" || sizeOf(o) > 150 || !ok(o.x, o.y)) continue;
    const dd = Math.hypot(o.x - hx, o.y - hy);
    if (dd < bd) {
      bd = dd;
      best = { kind: "dino", d: o };
    }
  }
  return best;
}

function preyById(w: World, id: number): Prey | null {
  const h = w.humans.find((x) => x.id === id);
  if (h) return h.under || h.aloft || h.captive || h.hung || h.yetiHeld || h.state === "down" ? null : { kind: "human", h };
  const b = w.rivals.byId(id);
  if (b) return b.hp > 0 && !b.snatched ? { kind: "brute", b } : null;
  const o = w.dinoById(id);
  return o && o.state !== "faint" ? { kind: "dino", d: o } : null;
}

/**
 * Its brain's cold-weather part (thinkDino calls it first). True = decided (the Yeti always decides
 * for itself); false = carry on with the shared creature AI.
 */
export function snowThink(w: World, d: Dino): boolean {
  if (d.owner || d.rider || d.raider || d.clan || d.snowRider || d.sandRider) return false;
  if (d.state === "faint" || d.state === "knocked" || d.state === "carried") return false;
  // the legends fear nothing (not even the alarm their own roar raises)
  if (RARE.has(d.species)) d.fear = 0;
  if (d.species === "yeti") return yetiThink(w, d);
  const fromHome = Math.hypot(d.x - d.homeX, d.y - d.homeY);
  // strayed down out of the cold (chasing something, or pushed): head back up to the snow
  if (fromHome > STRAY && !snowGround(w, d.x, d.y) && d.state !== "chase" && d.state !== "flee" && d.state !== "eat") {
    setState(d, "wander", d.homeX + (w.rng() - 0.5) * 160, d.homeY + (w.rng() - 0.5) * 120);
    return true;
  }
  if (d.species === "snowRex") return rexThink(w, d);
  return false;
}

/** The Snow Rex: roars over its range, shelters in a cave by night, hunts hardest in a blizzard. */
function rexThink(w: World, d: Dino): boolean {
  const blizzard = w.weather.snow > 0.5 || w.weather.storm > 0.5;
  // night (and not a blizzard): back to the cave to sleep
  if (w.daylight < 0.22 && !blizzard && d.state !== "chase" && d.hunger < 0.75) {
    const cave = caveNear(d.homeX, d.homeY);
    const spot = cave ?? { x: d.homeX, y: d.homeY };
    if (Math.hypot(d.x - spot.x, d.y - spot.y) > 40) setState(d, "wander", spot.x, spot.y);
    else if (d.state !== "sleep") setState(d, "sleep", d.x, d.y);
    return true;
  }
  if (d.state === "sleep" && w.daylight >= 0.22) setState(d, "idle", d.x, d.y);
  // a blizzard sharpens its hunger: it goes looking even when it isn't starving
  if (blizzard && d.hunger < 0.5) d.hunger = Math.min(1, d.hunger + 0.04);
  // its presence: a great roar now and then when people are within earshot (everything round about hears it)
  if (d.state !== "chase" && d.state !== "roar" && w.rng() < 0.06 && w.humans.some((h) => !h.under && Math.abs(h.x - d.x) < 700 && Math.hypot(h.x - d.x, h.y - d.y) < 700)) {
    setState(d, "roar", d.x, d.y);
    emote(d, "❄️", 1.6);
    w.sfx("roar", d.x, d.y, 1.2, 0.4);
    w.alarm(d.x, d.y, 900, 0.7, "😨", false);
    d.fear = 0;
    if (!w.flags.has("snowRexSeen")) {
      w.flags.add("snowRexSeen");
      w.toast("🦖", "A Snow Rex! A white-furred giant of the peaks: on the snowfields it's almost invisible until it moves, and it hunts hardest in a blizzard. Its roar carries for miles.", d.x, d.y);
      w.discover("snowRex", d.x, d.y);
    }
    return true;
  }
  return false;
}

/* ------------------------------ the Yetis ------------------------------ */

/**
 * The Yetis: several of them, each with a den on the high snow (a cave mouth or a snowfield) and a
 * frosted dead "hanging tree" beside it. They never set foot off the snow. By day they lie in wait,
 * half-buried and all but invisible; anyone of ours who comes walking over their snow gets ambushed:
 * a roar, a charge, and (if it catches them) it grabs them, carries them off to its hanging tree and
 * hangs them up by the feet, for fun. They hang there (cold, miserable, shouting for help) until
 * someone walks out and cuts them down (rescueHungThink). Anything else that trespasses (Neanderthals,
 * the other peoples, dinosaurs) gets clubbed and pelted with ice.
 */
function yetiThink(w: World, d: Dino): boolean {
  // fighting a dragon: nothing else matters till one of them is down (yetiFeud.ts)
  if (yetiDueling(w, d)) return true;
  const home = { x: d.homeX, y: d.homeY };
  const fromHome = Math.hypot(d.x - home.x, d.y - home.y);
  // carrying someone off: to the hanging tree
  if (d.holding) {
    const h = w.humans.find((x) => x.id === d.holding);
    if (!h || h.yetiHeld !== d.id) {
      d.holding = undefined;
    } else {
      const tree = hangTree(w, d);
      setState(d, "wander", tree.x - 16, tree.y + 6);
      return true;
    }
  }
  if (d.state === "chase" && d.targetId) {
    const p = preyById(w, d.targetId);
    const pp = p ? posOf(p) : null;
    // it never follows anyone off the snow (or too far from its den)
    // …and gives up when it can't close in (a drift, a ledge in the way)
    const gap = pp ? Math.hypot(pp.x - d.x, pp.y - d.y) : 0;
    const best = closing.get(d);
    if (!best || gap < best.gap - 8) closing.set(d, { gap, t: w.elapsed });
    const stalled = !!best && w.elapsed - best.t > 5;
    if (p && pp && !stalled && snowPath(w, d, pp) && Math.hypot(pp.x - home.x, pp.y - home.y) < YETI_R * 2.2 && fromHome < YETI_LEASH) return true;
    closing.delete(d);
    d.targetId = 0;
    setState(d, "wander", home.x, home.y);
    emote(d, "😤", 1.6);
    return true;
  }
  // pleased with itself after hanging someone up: it leaves people be for a while (a rescue can get in)
  const pleased = (contentUntil.get(d) ?? -1) > w.elapsed;
  const foe = intruder(w, d, YETI_R, true, pleased, AMBUSH_R);
  if (foe) {
    const fp = posOf(foe);
    d.targetId = fp.id;
    if (d.state !== "roar" && d.state !== "chase") {
      // the ambush: up out of the snow with a roar (the alarm sends everything round about running, itself included: raise it first)
      w.alarm(d.x, d.y, 600, 0.8, "😱", foe.kind === "human");
      d.fear = 0;
      setState(d, "roar", d.x, d.y);
      d.dir = fp.x > d.x ? 1 : -1;
      emote(d, "❗", 1.4);
      w.sfx("roar", d.x, d.y, 1.2, 0.35);
      w.particles.burst(P.Poof, d.x, d.y, 12, 70, { size: 14, max: 1, color: "rgba(240,248,255,0.85)" });
      if (foe.kind === "human" && !w.flags.has("yetiSeen")) {
        w.flags.add("yetiSeen");
        w.toast("❄️", "A YETI! It was lying in wait under the snow. Yetis never leave the snow, they ambush anyone who walks on it, and they like to hang people upside down from their trees for fun. Keep off their snowfields (or go in numbers).", d.x, d.y);
        w.discover("yeti", d.x, d.y);
      }
    }
    return true;
  }
  if (d.state === "sleep") setState(d, "idle", d.x, d.y);
  // lying in wait: half-buried in the snow near the den, still as a drift
  if (d.state === "stalk" && d.stateT < 30) return true;
  if (fromHome > 40 && w.rng() < 0.5) {
    for (let k = 0; k < 6; k++) {
      const a = w.rng() * Math.PI * 2;
      const r = 40 + w.rng() * YETI_R * 0.6;
      const x = home.x + Math.cos(a) * r;
      const y = home.y + Math.sin(a) * r * 0.7;
      if (snowGround(w, x, y) && w.nav.passable("dino", x, y)) {
        setState(d, "wander", x, y);
        return true;
      }
    }
  }
  if (d.state === "wander" && Math.hypot(d.tx - d.x, d.ty - d.y) > 12 && d.stateT < 20) return true;
  setState(d, "stalk", d.x, d.y);
  return true;
}

/** Per frame (actDino hands it over): roaring, charging, grabbing, carrying, hanging. True = it handled the frame. */
export function snowAct(w: World, d: Dino, dt: number): boolean {
  if (d.species !== "yeti" || d.owner) return false;
  d.hurlCd = Math.max(0, (d.hurlCd ?? 0) - dt);
  d.clawCd = Math.max(0, (d.clawCd ?? 0) - dt);
  d.strike = Math.max(0, (d.strike ?? 0) - dt * 1.4);
  // a step off the snow is a step it won't take: back onto it
  if (!snowGround(w, d.x, d.y) && d.state !== "roar") {
    d.x -= d.vx * dt * 1.5;
    d.y -= d.vy * dt * 1.5;
    if (!d.holding) {
      d.targetId = 0;
      setState(d, "wander", d.homeX, d.homeY);
    }
  }
  // carrying someone: they come along in its arms; at the tree, up they go by the feet
  if (d.holding) {
    const h = w.humans.find((x) => x.id === d.holding);
    if (!h || h.yetiHeld !== d.id) d.holding = undefined;
    else {
      h.x = d.x + d.dir * 14;
      h.y = d.y - 1;
      h.z = 30;
      h.dir = d.dir;
      if (w.rng() < dt * 0.6) say(h, pick(w.rng, ["Put me down!", "HELP!", "Aaaah!", "Not the tree!"]));
      const tree = hangTree(w, d);
      if (Math.hypot(d.x - (tree.x - 16), d.y - (tree.y + 6)) < 26) hangUp(w, d, h, tree);
      return false;
    }
  }
  // (a dragon fight is run by yetiFeud.ts)
  if (d.state === "defend" && yetiDueling(w, d)) return true;
  if (d.state === "stalk") {
    d.vx *= 0.7;
    d.vy *= 0.7;
    return true;
  }
  if (d.state === "roar") {
    d.vx *= 0.8;
    d.vy *= 0.8;
    // (an ambush on one of ours is a short roar: it's already on them)
    const prey0 = d.targetId ? preyById(w, d.targetId) : null;
    if (d.stateT > (prey0?.kind === "human" ? 0.45 : 1.3)) {
      if (!prey0) setState(d, "idle", d.x, d.y);
      else setState(d, "chase", posOf(prey0).x, posOf(prey0).y);
    }
    return true;
  }
  if (d.state !== "chase") return false;
  const p = d.targetId ? preyById(w, d.targetId) : null;
  if (!p) {
    d.targetId = 0;
    setState(d, "idle", d.x, d.y);
    return true;
  }
  const pp = posOf(p);
  d.tx = pp.x;
  d.ty = pp.y;
  const dist = Math.hypot(pp.x - d.x, pp.y - d.y);
  // the lunge: bounding across the snow after one of ours, far quicker than they can run (never off the snow)
  if (p.kind === "human" && dist < 260) {
    const k = Math.min(1, (LUNGE * dt) / Math.max(1, dist));
    const nx = d.x + (pp.x - d.x) * k;
    const ny = d.y + (pp.y - d.y) * k;
    if (snowGround(w, nx, ny) && w.nav.passable("dino", nx, ny)) {
      d.x = nx;
      d.y = ny;
      d.dir = pp.x > d.x ? 1 : -1;
      d.anim += dt * 6;
      if (w.rng() < dt * 6) w.particles.spawn(P.Poof, d.x, d.y, { size: 7, max: 0.5, color: "rgba(240,248,255,0.8)" });
    }
  }
  // one of ours, caught: grabbed and carried off (never a child: it just roars at them)
  if (p.kind === "human" && dist < sizeOf(d) * 0.45 && !p.h.child) {
    grab(w, d, p.h);
    return false;
  }
  // anything else: a block of ice from range, a clubbing up close
  if (p.kind !== "human" && !d.hurlCd && dist > HURL.min && dist < HURL.max) {
    d.hurlCd = HURL.cd;
    d.strike = 1;
    d.dir = pp.x > d.x ? 1 : -1;
    hurlIce(w, d, p);
    return false;
  }
  if (dist < sizeOf(d) * 0.5) {
    d.dir = pp.x > d.x ? 1 : -1;
    d.vx *= 0.6;
    d.vy *= 0.6;
    if (!d.clawCd) {
      d.clawCd = 1.3;
      d.strike = 0.7;
      smash(w, d, p);
    }
  }
  if (d.stateT > 28) {
    d.targetId = 0;
    setState(d, "wander", d.homeX, d.homeY);
  }
  return false;
}

/** Grabbed: whatever they were doing is over, the Yeti has them. */
function grab(w: World, d: Dino, h: Human) {
  const task = w.tasks.get(h.taskId);
  if (task) task.people = task.people.filter((id) => id !== h.id);
  h.taskId = 0;
  h.order = null;
  h.task = null;
  h.site = "";
  if (h.riding) h.riding = 0;
  h.yetiHeld = d.id;
  d.holding = h.id;
  d.targetId = 0;
  d.strike = 1;
  w.sfx("roar", d.x, d.y, 1, 0.5);
  say(h, pick(w.rng, ["Aaah! Let go!", "HELP!", "Put me down, you big snowball!"]), 2);
  const tree = hangTree(w, d);
  setState(d, "wander", tree.x - 16, tree.y + 6);
}

/** Up they go, by the feet, from the hanging tree's branch. */
function hangUp(w: World, d: Dino, h: Human, tree: { x: number; y: number }) {
  h.yetiHeld = undefined;
  d.holding = undefined;
  h.hung = { by: d.id, x: tree.x + 20, y: tree.y + 2, t: w.elapsed };
  h.x = h.hung.x;
  h.y = h.hung.y;
  h.vx = h.vy = 0;
  emote(d, "😄", 2);
  contentUntil.set(d, w.elapsed + PLEASED_FOR);
  w.sfx("thud", tree.x, tree.y, 0.6, 0.8);
  w.particles.burst(P.Poof, tree.x, tree.y - 40, 10, 50, { size: 9, max: 0.8, color: "rgba(240,248,255,0.85)" });
  setState(d, "wander", d.homeX, d.homeY);
  w.toast("❄️", `A Yeti has hung ${h.name} upside down from its tree by the feet! They're freezing up there. Send someone to cut them down (watch out, the Yeti's den is right there).`, h.x, h.y);
  w.alarm(h.x, h.y, 900, 0.5, "😱", false);
}

/**
 * A Yeti's hanging tree: a frosted dead tree on the snow beside its den (the same spot every time for
 * that den, so there's always one there to see). Never off the snow.
 */
export function hangTree(w: World, d: Pick<Dino, "id" | "homeX" | "homeY">): { x: number; y: number } {
  let trees = treesOf.get(w);
  if (!trees) treesOf.set(w, (trees = new Map()));
  const hit = trees.get(d.id);
  if (hit && hit.hx === d.homeX && hit.hy === d.homeY) return hit;
  let spot = { x: d.homeX + 70, y: d.homeY - 10 };
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2 + 0.4;
    const r = 70 + (k % 3) * 24;
    const x = d.homeX + Math.cos(a) * r;
    const y = d.homeY + Math.sin(a) * r * 0.6;
    if (snowGround(w, x, y) && w.nav.passable("dino", x - 16, y + 6)) {
      spot = { x, y };
      break;
    }
  }
  const out = { ...spot, hx: d.homeX, hy: d.homeY };
  trees.set(d.id, out);
  return out;
}
const treesOf = new WeakMap<World, Map<number, { x: number; y: number; hx: number; hy: number }>>();

/** The hanging trees of the Yetis in the world (for the art). */
export function hangTrees(w: World) {
  return w.dinos.filter((d) => d.species === "yeti" && !d.owner).map((d) => ({ id: d.id, ...hangTree(w, d) }));
}

/** Cut them down: they drop into the snow, cold but alive. */
export function cutDown(w: World, h: Human, by?: Human) {
  if (!h.hung) return;
  h.hung = undefined;
  h.z = 0;
  h.y += 8;
  h.warmth = Math.min(h.warmth, 0.4);
  h.think = 0;
  w.particles.burst(P.Poof, h.x, h.y, 8, 40, { size: 8, max: 0.7, color: "rgba(240,248,255,0.85)" });
  say(h, pick(w.rng, ["Thank you!", "Finally! My head!", "Never again…"]), 2);
  if (by) w.toast("🙌", `${by.name} cut ${h.name} down from the Yeti's tree.`, h.x, h.y);
}

/** Every frame while hung (from updateHuman): dangling, cold, shouting. */
export function hungTick(w: World, h: Human, dt: number) {
  const g = h.hung!;
  h.x = g.x;
  h.y = g.y;
  h.vx = h.vy = 0;
  h.anim += dt * 2;
  h.warmth = Math.max(0.08, h.warmth - dt * 0.004);
  if (h.bubble) {
    h.bubble.t -= dt;
    if (h.bubble.t <= 0) h.bubble = null;
  }
  if (w.rng() < dt * 0.08) say(h, pick(w.rng, ["Help! Get me down!", "The blood's going to my head!", "Somebody!", "It's so cold…"]), 2.2);
}

/** How long a rescuer must work at the knots (s). */
const CUT_FOR = 2.4;
const cutting = new WeakMap<Human, { id: number; since: number }>();

/**
 * Someone free goes to cut a hung person down (from think: the two nearest free grown-ups to each one).
 * True = they're on it.
 */
export function rescueHungThink(w: World, h: Human, brave = false): boolean {
  if (h.child || h.stranger || h.captive || h.under || h.aloft || h.hung || h.yetiHeld || h.taskId || h.order || h.state === "down" || h.hp < 0.35) return false;
  const hungList = w.humans.filter((o) => o.hung);
  if (!hungList.length) return false;
  for (const v of hungList) {
    // first thing (before any fear of the Yeti) only while it's pleased with itself, or gone: a window to get them down
    if (brave) {
      const y = w.dinos.find((d) => d.id === v.hung!.by);
      if (y && (contentUntil.get(y) ?? -1) <= w.elapsed && Math.hypot(y.x - v.x, y.y - v.y) < 500) continue;
    }
    const free = w.humans.filter((o) => !o.child && !o.stranger && !o.captive && !o.under && !o.aloft && !o.hung && !o.yetiHeld && !o.taskId && !o.order && o.state !== "down" && o.hp >= 0.35)
      .sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y)).slice(0, 2);
    if (!free.includes(h)) continue;
    // somewhere to stand beside them (walkable), and cut the rope from arm's reach
    const stand = [[-12, 10], [12, 10], [0, 16], [-22, 4], [22, 4], [0, 28]].map(([dx, dy]) => ({ x: v.x + dx, y: v.y + dy })).find((p) => w.nav.passable("human", p.x, p.y)) ?? { x: v.x, y: v.y + 10 };
    const d = Math.min(Math.hypot(h.x - stand.x, h.y - stand.y), Math.hypot(h.x - v.x, h.y - v.y) - 26);
    if (d > 16) {
      cutting.delete(h);
      go(h, "walk", stand.x, stand.y);
      if (w.rng() < 0.05) say(h, pick(w.rng, ["Hang on, I'm coming!", "I'll get you down!"]));
      return true;
    }
    const c = cutting.get(h);
    if (!c || c.id !== v.id) cutting.set(h, { id: v.id, since: w.elapsed });
    else if (w.elapsed - c.since >= CUT_FOR) {
      cutting.delete(h);
      cutDown(w, v, h);
      return false;
    }
    go(h, "idle", h.x, h.y);
    h.dir = v.x > h.x ? 1 : -1;
    return true;
  }
  return false;
}

function smash(w: World, d: Dino, p: Prey) {
  const pp = posOf(p);
  w.sfx("thud", pp.x, pp.y, 1, 0.5);
  w.particles.burst(P.Spark, pp.x, pp.y, 6, 60, { z: 16, size: 3, max: 0.5, color: "#e8f8ff" });
  if (p.kind === "human") {
    hurtHuman(w, p.h, 0.34, d.x, d.y, "club");
    p.h.fear = 1;
  } else if (p.kind === "dino") hitDino(w, p.d, 42, d.x, d.y);
  else w.rivals.hit(w, p.b, 0.32, d.x, d.y, true);
}

/** The ice block lands a moment later: a hit (and a chill) where it comes down. */
function hurlIce(w: World, d: Dino, p: Prey) {
  const pp = posOf(p);
  const tx = pp.x + (w.rng() - 0.5) * 24;
  const ty = pp.y + (w.rng() - 0.5) * 16;
  w.sfx("whoosh", d.x, d.y, 0.9, 0.55);
  // (a frost patch marks where it shattered; the hit is resolved at once against whoever's there)
  w.particles.burst(P.Spark, tx, ty, 12, 90, { z: 20, vz: 60, g: 200, size: 4, max: 0.8, color: "#d9f4ff" });
  w.particles.burst(P.Poof, tx, ty, 6, 40, { size: 12, max: 0.8, color: "rgba(230,245,255,0.7)" });
  w.hazards.add(w, "frost", tx, ty, 40, false);
  if (Math.hypot(pp.x - tx, pp.y - ty) > 26) return;
  if (p.kind === "human") {
    hurtHuman(w, p.h, 0.24, d.x, d.y, "rock");
    p.h.slowT = Math.max(p.h.slowT ?? 0, 2.5);
  } else if (p.kind === "dino") hitDino(w, p.d, 30, d.x, d.y);
  else w.rivals.hit(w, p.b, 0.22, d.x, d.y, true);
}

/* ------------------------------ their numbers ------------------------------ */

/** Can this snow species lay an egg now? (The legends never do; the rest up to their number.) */
export function snowMayLay(w: World, s: SpeciesId) {
  if (RARE.has(s)) return false;
  let n = 0;
  for (const d of w.dinos) if (d.species === s && !d.under) n++;
  for (const e of w.eggs) if (e.species === s) n++;
  return n < (SNOW_KEEP[s] ?? 3);
}

/**
 * Keeps the peaks stocked: the first time round (a little after the start, in a real game) every
 * species arrives at its home; after that, one that's dropped below its number gets a newcomer every
 * so often, walking in from the high ground out of sight. Its own dice + a slow tick.
 */
export class SnowLife {
  /** off in bare test worlds (and wherever wildlife is off); on in every real game */
  enabled = true;
  seeded = false;
  private rng: Rng;
  private tickT = 0;
  private backT: Partial<Record<SpeciesId, number>> = {};

  constructor(seed = 1) {
    this.rng = makeRng(seed * 131 + 71);
  }

  update(w: World, dt: number) {
    if (!this.enabled || !w.wildlife.enabled || w.extinction.wasteland) return;
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 5;
    if (!this.seeded) {
      if (w.elapsed < 200) return;
      this.seeded = true;
      for (const s of SNOW_LIST) {
        const n = s === "frosthorn" ? 5 : s === "rimeclaw" ? 4 : s === "glacierback" ? 2 : s === "snowLeopard" ? 2 : 1;
        // (the Yetis come one to a den)
        if (s === "yeti") for (let i = 0; i < (SNOW_KEEP.yeti ?? 1); i++) this.arrive(w, s, 1);
        else this.arrive(w, s, n);
      }
      return;
    }
    for (const s of SNOW_LIST) {
      let n = 0;
      for (const d of w.dinos) if (d.species === s && !d.under) n++;
      for (const e of w.eggs) if (e.species === s) n++;
      const keep = SNOW_KEEP[s] ?? 2;
      if (n >= (ONLY_ONE.has(s) ? 1 : s === "yeti" ? keep : Math.min(keep, 2))) continue;
      const t = (this.backT[s] = (this.backT[s] ?? (RARE.has(s) ? 900 : 300) * (0.7 + this.rng() * 0.6)) - 5);
      if (t > 0) continue;
      this.backT[s] = undefined;
      this.arrive(w, s, RARE.has(s) ? 1 : 2);
    }
  }

  /** `n` of a species turn up at one of their homes (out of view). Returns them. */
  arrive(w: World, s: SpeciesId, n: number): Dino[] {
    const def = sp(s);
    const homes = SNOW_HOMES[s] ?? [[240, 30]];
    const out: Dino[] = [];
    // a Yeti takes a den no other Yeti has; everyone else any of their homes
    const taken = (x: number, y: number) => s === "yeti" && w.dinos.some((o) => o.species === "yeti" && Math.hypot(o.homeX - (x * TILE + TILE / 2), o.homeY - (y * TILE + TILE / 2)) < 300);
    const open = homes.filter(([x, y]) => !taken(x, y));
    if (!open.length) return [];
    const [hx, hy] = open[Math.floor(this.rng() * open.length)];
    const base = { x: hx * TILE + TILE / 2, y: hy * TILE + TILE / 2 };
    const herd = def.herd > 0.3 && n > 1 ? w.nextId() : 0;
    for (let i = 0; i < n; i++) {
      let spot: { x: number; y: number } | null = null;
      // (a Yeti only ever stands on snow: its den is on the snowfield itself)
      const tries = s === "yeti" ? 40 : 6;
      for (let k = 0; k < tries && !spot; k++) {
        const p = findSpawnSpot(w, def, base.x + (this.rng() - 0.5) * 80, base.y + (this.rng() - 0.5) * 60, 160 + (s === "yeti" ? k * 12 : 0));
        if (p && w.nav.passable("dino", p.x, p.y) && (s !== "yeti" || snowGround(w, p.x, p.y)) && (k > 3 || !w.inView(p.x, p.y, 80))) spot = p;
      }
      if (!spot) continue;
      const home = s === "yeti" ? spot : base;
      const d = addDino(w, s, spot.x, spot.y, { growth: 1, herd, homeX: home.x, homeY: home.y, hunger: 0.25, thirst: 0.2 });
      if (RARE.has(s)) d.layT = 1e9;
      out.push(d);
    }
    return out;
  }

  serialize() {
    return { seeded: this.seeded };
  }

  load(d: { seeded?: boolean } | undefined) {
    this.enabled = true;
    // saves from before the snow came: they arrive a little into the game, as in a new one
    this.seeded = !!d?.seeded;
  }
}

