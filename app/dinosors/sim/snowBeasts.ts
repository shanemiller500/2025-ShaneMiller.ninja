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
import { makeRng, type Rng } from "./rng";
import { EAST_CAVES, REGION } from "./terrain";
import { hitDino } from "./tribe";
import { MAP_W, T, TILE, type Brute, type Dino, type Human, type SpeciesId } from "./types";
import type { World } from "./world";

const SNOW_LIST: SpeciesId[] = ["snowLeopard", "yeti", "snowRex", "frosthorn", "rimeclaw", "glacierback"];
export const SNOW_SPECIES = new Set<SpeciesId>(SNOW_LIST);
export const isSnowBeast = (d: Pick<Dino, "species">) => SNOW_SPECIES.has(d.species);
/** The legends: only ever one of each, and they never lay eggs. */
const RARE = new Set<SpeciesId>(["yeti", "snowRex"]);
/** How many of each the peaks keep (SnowLife tops them up slowly; the common ones may also breed up to this). */
export const SNOW_KEEP: Partial<Record<SpeciesId, number>> = { snowLeopard: 3, rimeclaw: 4, frosthorn: 6, glacierback: 3, snowRex: 1, yeti: 1 };
/** Where each lives (tiles): the high snowfields, the passes' meadows, the ice. */
const SNOW_HOMES: Record<SpeciesId, [number, number][]> = {
  snowLeopard: [[226, 20], [262, 34], [238, 13]],
  rimeclaw: [[234, 30], [258, 27]],
  frosthorn: [[230, 44], [262, 50]],
  glacierback: [[236, 37], [266, 40]],
  snowRex: [[240, 31]],
  yeti: [[271, 26]],
} as Record<SpeciesId, [number, number][]>;

/** The Yeti treats anything this close to its cave as an intruder (px)… */
export const YETI_R = 330;
/** …gives up a chase this far from it… */
const YETI_LEASH = 640;
/** …and throws ice from this far (px). */
const HURL = { min: 110, max: 330, cd: 4.2 };
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

function intruder(w: World, d: Dino, r: number): Prey | null {
  let best: Prey | null = null;
  let bd = r;
  const hx = d.homeX;
  const hy = d.homeY;
  for (const h of w.humans) {
    if (h.under || h.aloft || h.captive || h.state === "down" || h.state === "hide" || h.falling) continue;
    const dd = Math.hypot(h.x - hx, h.y - hy);
    if (dd < bd) {
      bd = dd;
      best = { kind: "human", h };
    }
  }
  for (const b of w.rivals.brutes) {
    if (b.hp <= 0 || b.snatched || b.falling || b.z > 20 || b.captive) continue;
    const dd = Math.hypot(b.x - hx, b.y - hy);
    if (dd < bd) {
      bd = dd;
      best = { kind: "brute", b };
    }
  }
  for (const o of w.dinos) {
    if (o === d || o.under || o.species === "yeti" || o.state === "faint" || sp(o.species).move !== "walk" || sizeOf(o) > 150) continue;
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
  if (h) return h.under || h.aloft || h.captive || h.state === "down" ? null : { kind: "human", h };
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
    if (!w.flags.has("snowRexSeen")) {
      w.flags.add("snowRexSeen");
      w.toast("🦖", "A Snow Rex! A white-furred giant of the peaks: on the snowfields it's almost invisible until it moves, and it hunts hardest in a blizzard. Its roar carries for miles.", d.x, d.y);
      w.discover("snowRex", d.x, d.y);
    }
    return true;
  }
  return false;
}

/** The Yeti's own brain: guard the cave; roar, hurl ice, charge; back home when it's done. */
function yetiThink(w: World, d: Dino): boolean {
  const home = { x: d.homeX, y: d.homeY };
  const fromHome = Math.hypot(d.x - home.x, d.y - home.y);
  if (d.state === "chase" && d.targetId) {
    const p = preyById(w, d.targetId);
    const pp = p ? posOf(p) : null;
    if (p && pp && Math.hypot(pp.x - home.x, pp.y - home.y) < YETI_R * 1.9 && fromHome < YETI_LEASH) return true;
    d.targetId = 0;
    setState(d, "wander", home.x, home.y);
    emote(d, "😤", 1.6);
    return true;
  }
  const foe = intruder(w, d, YETI_R);
  if (foe) {
    const fp = posOf(foe);
    d.targetId = fp.id;
    if (d.state !== "roar" && d.state !== "chase") {
      setState(d, "roar", d.x, d.y);
      d.dir = fp.x > d.x ? 1 : -1;
      emote(d, "❗", 1.4);
      w.sfx("roar", d.x, d.y, 1.2, 0.35);
      w.alarm(d.x, d.y, 600, 0.8, "😱", foe.kind === "human");
      if (foe.kind === "human" && !w.flags.has("yetiSeen")) {
        w.flags.add("yetiSeen");
        w.toast("❄️", "A YETI! A shaggy giant guarding its ice cave. It hurls blocks of ice and charges anything that comes near. Keep well away from its cave (or bring a lot of spears).", d.x, d.y);
        w.discover("yeti", d.x, d.y);
      }
    }
    return true;
  }
  // nothing about: by night it prowls round its ground, by day it rests in the cave mouth
  if (w.daylight > 0.3) {
    if (fromHome > 30) setState(d, "wander", home.x, home.y);
    else if (d.state !== "sleep") setState(d, "sleep", d.x, d.y);
    return true;
  }
  if (d.state === "sleep") setState(d, "idle", d.x, d.y);
  if (d.state === "wander" && Math.hypot(d.tx - d.x, d.ty - d.y) > 12 && d.stateT < 25) return true;
  for (let k = 0; k < 6; k++) {
    const a = w.rng() * Math.PI * 2;
    const r = 60 + w.rng() * YETI_R * 0.7;
    const x = home.x + Math.cos(a) * r;
    const y = home.y + Math.sin(a) * r * 0.7;
    if (snowGround(w, x, y) && w.nav.passable("dino", x, y)) {
      setState(d, "wander", x, y);
      return true;
    }
  }
  setState(d, "idle", d.x, d.y);
  return true;
}

/** Per frame (actDino hands it over while the Yeti is roaring or charging). True = it handled the frame. */
export function snowAct(w: World, d: Dino, dt: number): boolean {
  if (d.species !== "yeti" || d.owner) return false;
  d.hurlCd = Math.max(0, (d.hurlCd ?? 0) - dt);
  d.clawCd = Math.max(0, (d.clawCd ?? 0) - dt);
  d.strike = Math.max(0, (d.strike ?? 0) - dt * 1.4);
  if (d.state === "roar") {
    d.vx *= 0.8;
    d.vy *= 0.8;
    if (d.stateT > 1.3) {
      const p = d.targetId ? preyById(w, d.targetId) : null;
      if (!p) setState(d, "idle", d.x, d.y);
      else setState(d, "chase", posOf(p).x, posOf(p).y);
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
  // a block of ice, hurled from range
  if (!d.hurlCd && dist > HURL.min && dist < HURL.max) {
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
        this.arrive(w, s, n);
      }
      return;
    }
    for (const s of SNOW_LIST) {
      let n = 0;
      for (const d of w.dinos) if (d.species === s && !d.under) n++;
      for (const e of w.eggs) if (e.species === s) n++;
      const keep = SNOW_KEEP[s] ?? 2;
      if (n >= Math.min(keep, RARE.has(s) ? 1 : 2)) continue;
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
    const [hx, hy] = homes[Math.floor(this.rng() * homes.length)];
    const base = { x: hx * TILE + TILE / 2, y: hy * TILE + TILE / 2 };
    const herd = def.herd > 0.3 && n > 1 ? w.nextId() : 0;
    for (let i = 0; i < n; i++) {
      let spot: { x: number; y: number } | null = null;
      for (let k = 0; k < 6 && !spot; k++) {
        const p = findSpawnSpot(w, def, base.x + (this.rng() - 0.5) * 80, base.y + (this.rng() - 0.5) * 60, 160);
        if (p && w.nav.passable("dino", p.x, p.y) && (k > 3 || !w.inView(p.x, p.y, 80))) spot = p;
      }
      if (!spot) continue;
      const d = addDino(w, s, spot.x, spot.y, { growth: 1, herd, homeX: base.x, homeY: base.y, hunger: 0.25, thirst: 0.2 });
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

