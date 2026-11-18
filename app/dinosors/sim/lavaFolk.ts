/* ------------------------------------------------------------------ */
/*  The Lava Monsters: not people at all, but walking lumps of molten    */
/*  rock that live on the volcano and its lava fields.                 */
/*                                                                     */
/*   • They hate everything: our tribe, the clans, the Sand, Snow,     */
/*     Tree and Sea People, every animal, every dragon. Nobody can     */
/*     trade with them or make peace: they aren't in Diplomacy at all. */
/*   • They're slow, but anything they touch burns, and they ball up   */
/*     lava and lob it: at people, animals, and dragons flying past.   */
/*     A lava ball splatters, melts whoever it lands on, and the splat */
/*     cools into lava stone (basalt).                                 */
/*   • They run hot: on the volcano they stay molten, and they swim in */
/*     the lava pool at its foot to heat back up (and heal). Out in    */
/*     the cold they cool off: snow + rain hiss off them, their crust  */
/*     greys over and they slow down; too cold, and they set solid.    */
/*   • Fire and lava don't hurt them; water is the one thing they      */
/*     won't step into.                                                */
/*   • Fire can't kill them (flames, dragon fire, hot sand, lightning). */
/*     Spears and clubs barely scratch them: they melt. What kills a   */
/*     Lava Monster is cold: water (people throw buckets of it, or hose */
/*     it down with water skins), snow + snowballs, a Yeti's ice, an   */
/*     Ice Dragon's frost. Cooled right down, it sets solid: a stone   */
/*     statue of dense lava stone to dig (no bones, no body).        */
/*   • They love dinosaur eggs: any nest near the volcano gets raided, */
/*     the eggs gobbled up and the nest set alight.                    */
/*   • When the volcano erupts they cheer, then ride the lava flows    */
/*     down the mountain like a slide.                                 */
/*   • Tap one and it moans "LAVA… lava…" like a zombie.               */
/*   • The volcano keeps their numbers up: a new one heaves itself out */
/*     of the lava every so often, faster while it erupts.             */
/*                                                                     */
/*  They're a creature (species "lavaFolk", body plan "lava") run by   */
/*  their own brain here, with their own dice, so the rest of the      */
/*  world plays out the same. Heat, lava balls + speech aren't saved.  */
/* ------------------------------------------------------------------ */
import { addDino, emote, setState, sizeOf } from "./dinos";
import { sp } from "../data/species";
import { dies } from "./death";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { go, moveHuman, say } from "./humans";
import { isWaterTile, LM, VEG_TILES } from "./terrain";
import { downDino, hitDino } from "./tribe";
import { MAP_H, MAP_W, T, TILE, type Brute, type Dino, type Dragon, type Egg, type Human } from "./types";
import type { World } from "./world";

export const LAVA_FOLK = "lavaFolk" as const;
export const isLavaFolk = (d: Pick<Dino, "species">) => d.species === LAVA_FOLK;

/** How many the volcano keeps. */
export const LAVA_KEEP = 6;
/** They roam this far from the crater (px)… */
export const LAVA_HOME_R = 760;
/** …give up a chase this far from it (twice that while it erupts)… */
const LEASH = 1400;
/** …and go for anything alive this close to them (px). */
export const LAVA_SENSE = 380;
/** Anything this close (beyond their own bulk) is touching them, and burns (px). */
export const TOUCH = 14;
/** Seconds between burns on one victim. */
const BURN_EVERY = 0.75;
/** Seconds between new ones heaving out of the lava (a quarter of that in an eruption). */
const BIRTH_EVERY = 150;

/** Lava balls: thrown from this far … to this far (px); seconds to ball one up; seconds between throws. */
export const THROW = { min: 70, max: 340, wind: 0.7, cd: 4 };
/** A dragon flying past this close (px, on the ground plane) and this low gets a ball lobbed at it. */
const DRAGON_R = 380;
const DRAGON_Z = 300;
/** What a lava ball does where it lands (px) */
export const SPLAT_R = 46;
const G = 340;

/** Cooling: below this they're slowed, below COLD they head home to the lava, below SOLID they start setting solid. */
export const HEAT = { slow: 0.5, cold: 0.4, solid: 0.12 };

const LINES = ["Hot! HOT!", "It's on fire!", "Don't let it touch you!", "Run, it's slow!", "My club's burning!"];
const LAVA_ONE = ["LAAAVA…", "LaVa…", "laaavaaa…", "LAVAAA…"];
const LAVA_TWO = ["LAVA… lava…", "lava… LAVA…", "LaVa… LAAAVA…", "LAVA… LaVa…"];

/** The ground they're at home on: the cone, cooled lava, live lava. */
export function lavaGround(w: World, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  const i = ty * MAP_W + tx;
  const t = w.terrain.tiles[i];
  return t === T.Volcano || t === T.Basalt || w.lava.heat[i] > 0.1;
}

/** Standing in live lava right now (swimming). */
export function inLava(w: World, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  return w.lava.heat[ty * MAP_W + tx] > 0.2;
}

/** The volcano they come from (px): the first one (the far east's has its own: see lavaTick). */
const crater = (w: World) => ({ x: w.volcano.x, y: w.volcano.y });
const isErupting = (v: World["volcano"]) => v.phase === "erupt" || v.phase === "build" || v.megaOn;
/** Either volcano erupting. */
const erupting = (w: World) => w.volcanoes.some(isErupting);
const leashOf = (w: World) => (erupting(w) ? LEASH * 2 : LEASH);
export const heatOf = (d: Pick<Dino, "lavaHeat">) => d.lavaHeat ?? 1;

type Foe = { kind: "human"; h: Human } | { kind: "brute"; b: Brute } | { kind: "dino"; d: Dino };
const posOf = (f: Foe) => (f.kind === "human" ? f.h : f.kind === "brute" ? f.b : f.d);

/** Alive, on the ground and somewhere a Lava Monster can get at. */
function okHuman(h: Human) {
  return !h.under && !h.aloft && !h.hung && !h.yetiHeld && !h.captive && h.level === 0 && h.state !== "down";
}
function okBrute(b: Brute) {
  return b.hp > 0 && !b.snatched && !b.falling && !b.captive && b.z <= 20 && !b.boat && !b.onDragon;
}
function okDino(d: Dino) {
  return !isLavaFolk(d) && !d.under && !d.caged && !d.netted && d.health > 0 && d.state !== "faint" && d.z < 8;
}

function foeById(w: World, id: number): Foe | null {
  if (!id) return null;
  const h = w.humans.find((x) => x.id === id);
  if (h) return okHuman(h) ? { kind: "human", h } : null;
  const b = w.rivals.byId(id);
  if (b) return okBrute(b) ? { kind: "brute", b } : null;
  const d = w.dinoById(id);
  return d && okDino(d) ? { kind: "dino", d } : null;
}

/** The nearest living thing (anything at all) within r of (x, y). */
function nearestFoe(w: World, x: number, y: number, r: number): Foe | null {
  let best: Foe | null = null;
  let bd = r;
  for (const h of w.humans) {
    if (Math.abs(h.x - x) > bd || !okHuman(h)) continue;
    const dist = Math.hypot(h.x - x, h.y - y);
    if (dist < bd) {
      bd = dist;
      best = { kind: "human", h };
    }
  }
  for (const b of w.rivals.brutes) {
    if (Math.abs(b.x - x) > bd || !okBrute(b)) continue;
    const dist = Math.hypot(b.x - x, b.y - y);
    if (dist < bd) {
      bd = dist;
      best = { kind: "brute", b };
    }
  }
  for (const d of w.dinos) {
    if (Math.abs(d.x - x) > bd || !okDino(d)) continue;
    const dist = Math.hypot(d.x - x, d.y - y);
    if (dist < bd) {
      bd = dist;
      best = { kind: "dino", d };
    }
  }
  return best;
}

/* ------------------------------ their own dice + state ------------------------------ */

export interface LavaBall {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  r: number;
  /** a dragon it was lobbed at (checked in the air) */
  dragon: number;
}

/** A bucket of water or a snowball one of ours throws at a Lava Monster. */
export interface Splash {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  dur: number;
  kind: "water" | "hose" | "snow" | "cannon";
  target: number;
  /** how much it cools on a hit (else the kind's usual amount) */
  cool?: number;
}

/** A Lava Monster that set solid: a stone statue of it is a lava-stone deposit until it is dug away. */
export interface Statue {
  node: number;
  x: number;
  y: number;
  L: number;
  dir: 1 | -1;
  id: number;
}

/** The Lava Monsters' hot tub (px): an oval of lava in a ring of rocks, at the foot of the volcano. */
export interface Tub {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

interface Life {
  rng: Rng;
  acc: number;
  seeded: boolean;
  birthAt: number;
  pool: number[] | null;
  tub: Tub | null;
  balls: LavaBall[];
  splashes: Splash[];
  statues: Statue[];
  phase: string;
  /** everything on fire right now (and what it is) */
  burning: Map<Human | Brute | Dino, "human" | "brute" | "dino">;
}
const lives = new WeakMap<World, Life>();
function lifeOf(w: World): Life {
  let l = lives.get(w);
  if (!l) lives.set(w, (l = { rng: makeRng(w.seed * 977 + 13), acc: 0, seeded: false, birthAt: 0, pool: null, tub: null, balls: [], splashes: [], statues: [], phase: "idle", burning: new Map() }));
  return l;
}

/** Buckets of water + snowballs in the air (for the art). */
export function lavaSplashes(w: World): readonly Splash[] {
  return lives.get(w)?.splashes ?? [];
}

/** The stone statues of Lava Monsters that set solid (while their lava stone is still there to dig). */
export function lavaStatues(w: World): readonly Statue[] {
  const l = lives.get(w);
  if (!l || !l.statues.length) return [];
  l.statues = l.statues.filter((s) => w.colony.nodes.some((n) => n.id === s.node && n.amount > 0));
  return l.statues;
}

/** Riding a lava flow down the volcano (the flow it's on). */
const rides = new WeakMap<Dino, { x: number; y: number; vol: number }>();
export const isRidingLava = (d: Dino) => rides.has(d);

/** The lava balls in the air right now (for the art). */
export function lavaBalls(w: World): readonly LavaBall[] {
  return lives.get(w)?.balls ?? [];
}

/* ------------------------------ the lava pool they swim in ------------------------------ */

/** The volcano whose cone this point is on (each is drawn as one big slope), or null. (px) */
export function coneUnder(w: World, x: number, y: number) {
  for (const v of w.volcanoes) {
    const dy = y - v.y;
    if (dy < -150 || dy > 150) continue;
    if (Math.abs(x - v.x) < 70 + ((dy + 150) / 300) * 350) return v;
  }
  return null;
}
/** Is this point up on a volcano's cone (the tub never goes there)? (px) */
export const onCone = (w: World, x: number, y: number) => !!coneUnder(w, x, y);

/**
 * The Lava Monsters' hot tub: a round pool of lava kept molten on open ground just below the volcano's cone
 * (never on the cone itself), the tiles inside an oval about 4 x 2.4 tiles. Chosen once per world from the
 * terrain: the nearest spot below the cone where the whole oval is ground a Lava Monster can stand on.
 */
export function lavaPool(w: World): number[] {
  const l = lifeOf(w);
  if (l.pool) return l.pool;
  const rx = 1.9;
  const ry = 1.2;
  const ok = (tx: number, ty: number) => {
    if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return false;
    const t = w.terrain.tiles[ty * MAP_W + tx] as T;
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    return t !== T.Mountain && t !== T.Cliff && t !== T.Cave && !isWaterTile(t) && !onCone(w, x, y) && lavaWalkable(w, x, y);
  };
  const ax = LM.volcano.x;
  const ay = LM.volcano.y + 7;
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (let dy = -2; dy <= 10; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const cx = ax + dx;
      const cy = ay + dy;
      let fits = true;
      for (let oy = -2; oy <= 2 && fits; oy++) for (let ox = -2; ox <= 2 && fits; ox++) {
        if ((ox / (rx + 0.6)) ** 2 + (oy / (ry + 0.6)) ** 2 > 1) continue;
        if (!ok(cx + ox, cy + oy)) fits = false;
      }
      const d = Math.hypot(dx, dy * 1.4);
      if (fits && d < bd) {
        bd = d;
        best = { x: cx, y: cy };
      }
    }
  }
  const pool: number[] = [];
  if (best) {
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      if ((ox / rx) ** 2 + (oy / ry) ** 2 > 1) continue;
      pool.push((best.y + oy) * MAP_W + best.x + ox);
    }
    l.tub = { x: (best.x + 0.5) * TILE, y: (best.y + 0.5) * TILE, rx: (rx + 0.5) * TILE, ry: (ry + 0.45) * TILE };
  }
  l.pool = pool;
  return pool;
}

/** The hot tub (null = this volcano has no room for one). */
export function lavaTub(w: World): Tub | null {
  lavaPool(w);
  return lifeOf(w).tub;
}

/** Sitting in the hot tub right now. */
export function inTub(w: World, x: number, y: number) {
  const tub = lavaTub(w);
  return !!tub && ((x - tub.x) / tub.rx) ** 2 + ((y - tub.y) / tub.ry) ** 2 < 0.8;
}

/** Keep the pool molten (never so hot it sets the country round it alight). */
function warmPool(w: World) {
  for (const i of lavaPool(w)) {
    const h = w.lava.heat[i];
    if (h < 0.45) w.lava.warm(w, i % MAP_W, Math.floor(i / MAP_W), 0.48 - h, true);
  }
}

/** A seat in the hot tub (a random one, or the near edge), or null. */
function poolSpot(w: World, x: number, y: number, rng?: Rng) {
  const tub = lavaTub(w);
  if (!tub) return null;
  if (!rng) {
    const a = Math.atan2((y - tub.y) / tub.ry, (x - tub.x) / tub.rx);
    return { x: tub.x + Math.cos(a) * tub.rx * 0.45, y: tub.y + Math.sin(a) * tub.ry * 0.45 };
  }
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * 0.6;
  return { x: tub.x + Math.cos(a) * tub.rx * r, y: tub.y + Math.sin(a) * tub.ry * r };
}

/** How many are sitting in the tub right now. */
const inTubNow = (w: World) => w.dinos.filter((d) => isLavaFolk(d) && inTub(w, d.x, d.y)).length;

/* ------------------------------ the brain ------------------------------ */

/** Its brain (thinkDino calls it). Always decides for itself. */
export function lavaThink(w: World, d: Dino): boolean {
  if (d.state === "faint" || d.state === "knocked" || d.state === "carried") return false;
  const l = lifeOf(w);
  calm(d);
  // balling up a lava ball: it stands still for that
  if (d.lavaWind) return true;
  const home = { x: d.homeX, y: d.homeY };
  const leash = leashOf(w);
  const heat = heatOf(d);
  const cur = foeById(w, d.targetId);
  // riding a lava flow down the mountain: nothing else matters
  if (rides.has(d)) return true;
  // the volcano's erupting: off to the lava to ride it down (unless something's right on top of it)
  if (w.lava.heads.length && !(cur && Math.hypot(posOf(cur).x - d.x, posOf(cur).y - d.y) < 110)) {
    let best: { x: number; y: number } | null = null;
    let bd = 1000;
    for (const hd of w.lava.heads) {
      const px = (hd.x + 0.5) * TILE;
      const py = (hd.y + 0.5) * TILE;
      const dist = Math.hypot(px - d.x, py - d.y);
      if (dist < bd) {
        bd = dist;
        best = { x: px, y: py };
      }
    }
    if (best) {
      march(d, best.x, best.y);
      return true;
    }
  }
  // gone cold: back to the lava to heat up (unless something's right on top of it)
  if (heat < HEAT.cold && !(cur && Math.hypot(posOf(cur).x - d.x, posOf(cur).y - d.y) < 110)) {
    const pool = poolSpot(w, d.x, d.y);
    // the lava pool if it's in reach; else home, and out of the cold
    const spot = pool && Math.hypot(pool.x - d.x, pool.y - d.y) < 1600 ? pool : Math.hypot(home.x - d.x, home.y - d.y) > 60 ? home : null;
    if (spot) {
      d.targetId = 0;
      march(d, spot.x, spot.y);
      if (l.rng() < 0.3) emote(d, "🥶", 1.6);
      return true;
    }
  }
  // a dinosaur egg near the volcano: a treat. Off to gobble it (and burn its nest), unless a foe's right on top of it
  const egg = eggNear(w, d);
  if (egg && !(cur && Math.hypot(posOf(cur).x - d.x, posOf(cur).y - d.y) < 150)) {
    d.targetId = 0;
    march(d, egg.x, egg.y);
    if (!w.flags.has("lavaEggs") && w.inView(d.x, d.y, 200)) {
      w.flags.add("lavaEggs");
      w.toast("🥚", "A Lava Monster has spotted a nest of dinosaur eggs! They LOVE eggs: any nest near the volcano gets raided, the eggs gobbled up and the nest set on fire.", egg.x, egg.y);
    }
    return true;
  }
  // after something already: keep at it while it's in reach of home
  if (cur) {
    const p = posOf(cur);
    if (Math.hypot(p.x - home.x, p.y - home.y) < leash && Math.hypot(p.x - d.x, p.y - d.y) < LAVA_SENSE * 2.2) {
      march(d, p.x, p.y);
      return true;
    }
    d.targetId = 0;
  }
  // anything alive close by: it lurches at it
  const foe = nearestFoe(w, d.x, d.y, LAVA_SENSE);
  if (foe) {
    const p = posOf(foe);
    if (Math.hypot(p.x - home.x, p.y - home.y) < leash) {
      d.targetId = p.id;
      march(d, p.x, p.y);
      emote(d, "🔥", 1.4);
      w.sfx("roar", d.x, d.y, 0.8, 0.3);
      if (foe.kind === "human" && !w.flags.has("lavaSeen")) {
        w.flags.add("lavaSeen");
        w.toast("🌋", "LAVA PEOPLE! Walking lumps of molten rock from the volcano. They hate everything alive (people, animals, dragons, the other peoples), anything they touch burns, and they lob balls of lava. They're slow: run, or fight them from a distance with spears and bows. They won't cross water, and the cold (snow, rain) cools them off and slows them down.", d.x, d.y);
        w.discover("lavaFolk", d.x, d.y);
      }
      return true;
    }
  }
  // too far from the volcano (carried off, or dropped by the toy box): it trudges back
  const fromHome = Math.hypot(d.x - home.x, d.y - home.y);
  if (fromHome > LAVA_HOME_R * (erupting(w) ? 1.6 : 1)) {
    march(d, home.x + (l.rng() - 0.5) * 300, home.y + (l.rng() - 0.5) * 200);
    return true;
  }
  // otherwise: a swim in the lava pool, or a shuffle about its lava fields
  if (d.state === "wander" && Math.hypot(d.tx - d.x, d.ty - d.y) > 12 && d.stateT < 25) return true;
  const soaking = inTub(w, d.x, d.y);
  // a good long soak in the hot tub (shuffling to a new seat now and then)
  if (d.state === "idle" && d.stateT < (soaking ? 14 : 3) + (d.id % 5)) return true;
  if (heat < 0.9 || (soaking ? l.rng() < 0.7 : l.rng() < 0.35 && inTubNow(w) < 4)) {
    const spot = poolSpot(w, d.x, d.y, l.rng);
    if (spot) {
      setState(d, "wander", spot.x + (l.rng() - 0.5) * 16, spot.y + (l.rng() - 0.5) * 12);
      return true;
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = l.rng() * Math.PI * 2;
    const r = 60 + l.rng() * LAVA_HOME_R * 0.8;
    const x = home.x + Math.cos(a) * r;
    const y = home.y + Math.sin(a) * r * 0.7;
    if ((k > 4 || lavaGround(w, x, y)) && lavaWalkable(w, x, y)) {
      setState(d, "wander", x, y);
      return true;
    }
  }
  setState(d, "idle", d.x, d.y);
  return true;
}

/** Nothing frightens it, and it never hungers or thirsts (it eats nothing, and water is its death). */
function calm(d: Dino) {
  d.fear = 0;
  d.hunger = 0;
  d.thirst = 0;
  d.layT = 1e9;
}

/** Walk at (x, y) without restarting its route every time the target shifts a little. */
function march(d: Dino, x: number, y: number) {
  if (d.state !== "wander") setState(d, "wander", x, y);
  else {
    d.tx = x;
    d.ty = y;
    d.stateT = Math.min(d.stateT, 5);
  }
}

/** Ground a Lava Monster can step on: anything but water (fire + lava are home). */
export function lavaWalkable(w: World, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  const t = w.terrain.tiles[ty * MAP_W + tx] as T;
  return !isWaterTile(t) && w.nav.passable("dino", x, y);
}

const burnt = new WeakMap<object, number>();
const aimOf = new WeakMap<Dino, { dragon: number; foe: number }>();

/** Per frame (actDino calls it): heat + cold, the touch that burns, lava balls. False = walk as usual. */
export function lavaAct(w: World, d: Dino, dt: number): boolean {
  calm(d);
  if (d.speech) {
    d.speech.t -= dt;
    if (d.speech.t <= 0) d.speech = undefined;
  }
  if (d.lavaJoy) d.lavaJoy = Math.max(0, d.lavaJoy - dt);
  // a hit from anything doesn't make it run: it turns on what hit it instead (lavaHit)
  if (d.state === "flee" || d.state === "chase" || d.state === "stalk" || d.state === "eat" || d.state === "drink" || d.state === "sleep") {
    setState(d, "idle", d.x, d.y);
    d.think = 0;
  }
  if (d.state === "faint") return false;
  const l = lifeOf(w);
  const L = sizeOf(d);
  const R = L * 0.42 + TOUCH;
  // heat: the lava warms it, the cold takes it away
  if (cool(w, d, dt, l)) return true;
  // riding a lava flow down the volcano like a slide
  const riding = ride(w, d, dt, l);
  // the touch
  for (const h of w.humans) {
    if (Math.abs(h.x - d.x) > R || Math.abs(h.y - d.y) > R || !okHuman(h)) continue;
    if (Math.hypot(h.x - d.x, h.y - d.y) > R || (burnt.get(h) ?? 0) > w.elapsed) continue;
    burnt.set(h, w.elapsed + BURN_EVERY);
    if (h.state === "hunt" || h.state === "aim") say(h, pick(l.rng, LINES), 1.4);
    melt(w, h, 0.3 * (0.5 + heatOf(d) * 0.5), "burned up by a Lava Monster");
    if (w.humans.includes(h) && heatOf(d) > 0.25) setAflame(w, h, "human");
    scorch(w, h.x, h.y);
  }
  for (const b of w.rivals.brutes) {
    if (Math.abs(b.x - d.x) > R || Math.abs(b.y - d.y) > R || !okBrute(b)) continue;
    if (Math.hypot(b.x - d.x, b.y - d.y) > R || (burnt.get(b) ?? 0) > w.elapsed) continue;
    burnt.set(b, w.elapsed + BURN_EVERY);
    w.rivals.hit(w, b, 0.3, d.x, d.y, true);
    if (heatOf(d) > 0.25) setAflame(w, b, "brute");
    scorch(w, b.x, b.y);
  }
  for (const o of w.dinos) {
    if (o === d || Math.abs(o.x - d.x) > R + sizeOf(o) * 0.4 || !okDino(o)) continue;
    if (Math.hypot(o.x - d.x, o.y - d.y) > R + sizeOf(o) * 0.35 || (burnt.get(o) ?? 0) > w.elapsed) continue;
    burnt.set(o, w.elapsed + BURN_EVERY);
    o.burn = 0;
    hitDino(w, o, 40, d.x, d.y);
    if (heatOf(d) > 0.25 && w.dinos.includes(o)) setAflame(w, o, "dino");
    scorch(w, o.x, o.y);
  }
  // buildings it walks up against smoulder (and walls it's stuck at burn through)
  for (const b of w.colony.buildings) {
    if (b.built < 1 || b.hp <= 0 || Math.abs(b.x - d.x) > R + 70 || Math.abs(b.y - d.y) > R + 50) continue;
    if (Math.hypot(b.x - d.x, b.y - d.y) > R + 40) continue;
    b.hp = Math.max(0, b.hp - dt * 30);
    if (l.rng() < dt * 0.6) w.fire.ignite(w, Math.floor(b.x / TILE), Math.floor(b.y / TILE), 0.5);
  }
  if (d.stuckT > 0.6) {
    for (const wl of w.tribe.walls) {
      if (wl.hp <= 0 || Math.hypot(wl.tx * TILE + TILE / 2 - d.x, wl.ty * TILE + TILE / 2 - d.y) > R + 30) continue;
      // lava stone is made of them: it won't burn through its own kind
      if (wl.kind === "lava" && wl.built >= 1) break;
      wl.hp = Math.max(0, wl.hp - dt * 45);
      if (l.rng() < dt * 3) w.particles.spawn(P.Ember, wl.tx * TILE + TILE / 2, wl.ty * TILE + TILE / 2, { z: 14, vz: 60, size: 3, max: 0.8, color: "#ff8a2a" });
      break;
    }
  }
  // grass + trees catch where it walks (while it's hot)
  const tx = Math.floor(d.x / TILE);
  const ty = Math.floor(d.y / TILE);
  if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && heatOf(d) > HEAT.cold) {
    const moving = Math.hypot(d.vx, d.vy) > 4;
    if (moving && VEG_TILES.has(w.terrain.tiles[ty * MAP_W + tx] as T) && l.rng() < dt * 0.45 * heatOf(d)) w.fire.ignite(w, tx, ty, 0.45);
  }
  // an egg within reach: gobbled, and its nest set alight
  if (!riding && w.eggs.length) {
    for (const e of w.eggs) {
      if (Math.abs(e.x - d.x) > R + 6 || Math.hypot(e.x - d.x, e.y - d.y) > R * 0.7 + 10) continue;
      eatEgg(w, d, e, l);
      break;
    }
  }
  // lava balls (not while it's sliding)
  if (!riding) throwTick(w, d, dt, l);
  // embers (fewer as it cools)
  if (l.rng() < dt * 2.4 * heatOf(d) && w.inView(d.x, d.y, 100)) w.particles.spawn(P.Ember, d.x + (l.rng() - 0.5) * L * 0.5, d.y, { z: L * (0.4 + l.rng() * 0.5), vz: 40 + l.rng() * 50, vx: (l.rng() - 0.5) * 30, g: -10, size: 2 + l.rng() * 2, max: 1.1, color: l.rng() < 0.5 ? "#ffd04a" : "#ff6a1f" });
  return riding;
}

const WHEE = ["LAAAVAAA!", "Wheee… LAVA!", "LAVA! LAVA!", "LaVaaa!"];

/**
 * The volcano's erupting and a lava flow is crawling down it: hop on and ride it down like a slide. True
 * while it's riding (it moves with the flow, not on its own feet).
 */
function ride(w: World, d: Dino, dt: number, l: Life): boolean {
  let hd = rides.get(d);
  if (hd && (hd.vol <= 0 || !w.lava.heads.includes(hd as (typeof w.lava.heads)[number]))) {
    // the flow's run out: hop off, grinning
    rides.delete(d);
    hd = undefined;
    emote(d, "😄", 1.6);
    d.lavaJoy = 1.5;
    d.think = 0;
  }
  if (!hd) {
    if (!w.lava.heads.length || d.lavaWind || d.state === "knocked" || d.state === "tussle") return false;
    // (a flow coming past within a good leap: it jumps on)
    let bd = 200;
    for (const h of w.lava.heads) {
      if (h.vol <= 0.05) continue;
      const dist = Math.hypot((h.x + 0.5) * TILE - d.x, (h.y + 0.5) * TILE - d.y);
      if (dist < bd) {
        bd = dist;
        hd = h;
      }
    }
    if (!hd) return false;
    rides.set(d, hd);
    d.targetId = 0;
    d.speech = { text: pick(l.rng, WHEE), t: 2 };
    emote(d, "🎢", 2);
    w.particles.burst(P.Ember, d.x, d.y, 10, 70, { z: 6, vz: 80, g: 200, size: 3, max: 0.8, color: "#ffb03a" });
  }
  // slide along with the head of the flow (it moves a tile at a time: glide between)
  const px = (hd.x + 0.5) * TILE;
  const py = (hd.y + 0.5) * TILE;
  const k = Math.min(1, dt * 4);
  if (Math.abs(px - d.x) > 2) d.dir = px > d.x ? 1 : -1;
  d.x += (px - d.x) * k;
  d.y += (py - d.y) * k;
  d.vx = d.vy = 0;
  d.anim += dt * 2;
  d.lavaHeat = 1;
  d.lavaJoy = Math.max(d.lavaJoy ?? 0, 0.5);
  if (l.rng() < dt * 0.4) d.speech = { text: pick(l.rng, WHEE), t: 1.6 };
  if (l.rng() < dt * 6 && w.inView(d.x, d.y, 80)) w.particles.spawn(P.Ember, d.x - d.dir * 16, d.y, { z: 6, vz: 50, vx: -d.dir * 30, size: 3, max: 0.7, color: "#ffd04a" });
  return true;
}

/** Once per frame (world-wide): when the volcano blows, every Lava Monster cheers. */
function cheerTick(w: World, l: Life) {
  const phase = w.volcanoes.some((v) => v.phase === "erupt") ? "erupt" : "idle";
  if (phase === l.phase) return;
  const was = l.phase;
  l.phase = phase;
  if (phase !== "erupt" || was === "erupt") return;
  let seen = false;
  for (const d of w.dinos) {
    if (!isLavaFolk(d) || d.under) continue;
    d.lavaJoy = 4;
    emote(d, "🎉", 3);
    if (l.rng() < 0.6) d.speech = { text: pick(l.rng, ["LAVA! LAVA!", "LAAAVAAA!", "LaVa! LaVa!"]), t: 2.6 };
    d.think = 0;
    if (w.inView(d.x, d.y, 200)) seen = true;
  }
  if (seen || w.flags.has("lavaSeen")) {
    w.sfx("lava2", w.volcano.x, w.volcano.y, 1, 1.15);
    if (!w.flags.has("lavaCheer")) {
      w.flags.add("lavaCheer");
      w.toast("🎉", "The volcano's erupting… and the Lava Monsters are CHEERING! Watch them: they ride the lava flows down the mountain like a slide.", w.volcano.x, w.volcano.y);
    }
  }
}

/**
 * Its heat for this frame. Swimming in lava heats it fast (and heals it); the volcano's ground keeps it warm;
 * snow cools it fast (it melts the snow, in clouds of steam), rain cools it, and anywhere else it slowly
 * cools off. Cool, it's slowed; cold, it sets solid. True = it set solid (gone).
 */
function cool(w: World, d: Dino, dt: number, l: Life): boolean {
  const tx = Math.floor(d.x / TILE);
  const ty = Math.floor(d.y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  const i = ty * MAP_W + tx;
  const t = w.terrain.tiles[i] as T;
  const swimming = w.lava.heat[i] > 0.2 || rides.has(d);
  const lavaRock = t === T.Volcano || t === T.Basalt;
  const nearHome = Math.hypot(d.x - d.homeX, d.y - d.homeY) < LAVA_HOME_R;
  const snow = Math.max(t === T.Snow || t === T.Ice ? 1 : 0, w.snow.depth[i]);
  let heat = heatOf(d);
  if (swimming) {
    heat += dt * 0.6;
    d.health = Math.min(1, d.health + dt * 0.04);
    if (l.rng() < dt * 1.5 && w.inView(d.x, d.y, 80)) w.particles.spawn(P.Ember, d.x + (l.rng() - 0.5) * 30, d.y + 4, { z: 4, vz: 60, size: 3, max: 0.7, color: "#ffd04a" });
  } else if (snow > 0.05) heat -= dt * 0.07 * Math.min(1, 0.4 + snow);
  else if (lavaRock) heat += dt * 0.1;
  else if (nearHome) heat += dt * 0.02;
  else heat -= dt * 0.0035;
  if (!swimming && w.weather.rain > 0.3) heat -= dt * 0.02 * w.weather.rain;
  heat = Math.max(0, Math.min(1, heat));
  d.lavaHeat = heat;
  // snow + rain hiss off it: the snow under it melts away in clouds of steam
  if (snow > 0.05 || (w.weather.rain > 0.3 && !swimming)) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      const j = y * MAP_W + x;
      if (!w.snow.cap[j]) w.snow.depth[j] = Math.max(0, w.snow.depth[j] - dt * (dx || dy ? 0.25 : 0.6) * (0.3 + heat));
    }
    if (l.rng() < dt * 4 && w.inView(d.x, d.y, 80)) w.particles.spawn(P.Steam, d.x + (l.rng() - 0.5) * 24, d.y, { z: sizeOf(d) * (0.3 + l.rng() * 0.6), vz: 35, size: 10, max: 1.2, color: "rgba(235,235,235,0.65)" });
    if (l.rng() < dt * 0.4) w.sfx("hiss", d.x, d.y, 0.5, 0.9);
  }
  // cool: slow; cold: setting solid
  if (heat < HEAT.slow) d.slowT = Math.max(d.slowT ?? 0, 0.3);
  if (heat < HEAT.solid) {
    d.health -= dt * 0.03;
    if (d.health <= 0) {
      setSolid(w, d);
      return true;
    }
  }
  return false;
}

/** Cooled right down: it sets solid, into a lava-stone statue of itself (a deposit to dig). */
function setSolid(w: World, d: Dino) {
  if (!w.flags.has("lavaFroze")) {
    w.flags.add("lavaFroze");
    w.toast("🥶", "A Lava Monster cooled right down and set solid: it's a stone statue now! Water, snow and ice are what beat them.", d.x, d.y);
  }
  downDino(w, d);
}

/**
 * Cold on a Lava Monster (water, snow, a Yeti's ice, an Ice Dragon's frost): it hisses + steams and cools by
 * `amt`; cooled right down, it sets solid there and then.
 */
export function coolLava(w: World, d: Dino, amt: number) {
  if (!isLavaFolk(d) || !w.dinos.includes(d)) return;
  const l = lifeOf(w);
  d.lavaHeat = Math.max(0, heatOf(d) - amt);
  const L = sizeOf(d);
  w.particles.burst(P.Steam, d.x, d.y, 6, 40, { z: L * 0.6, vz: 50, size: 12, max: 1.2, color: "rgba(235,235,235,0.75)" });
  w.sfx("hiss", d.x, d.y, 0.9, 0.7 + l.rng() * 0.3);
  if (l.rng() < 0.5) emote(d, "🥶", 1.2);
  // the cold hurts it too, a little (the real harm is the cooling)
  d.health = Math.max(0, d.health - amt * 0.12);
  if (d.lavaHeat <= 0.02) setSolid(w, d);
}

/** Hurt one of ours (it melts them): a knock-out from lava is the end (except in Calm). */
function melt(w: World, h: Human, dmg: number, how: string) {
  const down = hurtHuman(w, h, dmg, h.x - 1, h.y, "burn");
  if (down && w.tribe.danger !== "calm") dies(w, h, `${h.name} was ${how}.`);
}

/** A spot it burned: a scorch + a puff. */
function scorch(w: World, x: number, y: number) {
  w.particles.burst(P.Ember, x, y, 5, 50, { z: 16, vz: 50, size: 3, max: 0.8, color: "#ffb03a" });
  w.particles.spawn(P.Smoke, x, y, { z: 18, vz: 30, size: 12, max: 1.2, color: "rgba(60,50,46,0.5)" });
  w.sfx("hiss", x, y, 0.6, 0.8);
}

/* ------------------------------ lava balls ------------------------------ */

/** A dragon flying past (any dragon: wild or ours) close enough to lob a ball at. */
function dragonNear(w: World, d: Dino): Dragon | null {
  let best: Dragon | null = null;
  let bd = DRAGON_R;
  for (const dr of w.dragons.all()) {
    if (dr.hp <= 0 || dr.z < 20 || dr.z > DRAGON_Z) continue;
    const dist = Math.hypot(dr.x - d.x, dr.y - d.y);
    if (dist < bd) {
      bd = dist;
      best = dr;
    }
  }
  return best;
}

/** Ball one up, then let it fly: at a dragon going over, else at whatever it's after. */
function throwTick(w: World, d: Dino, dt: number, l: Life) {
  d.lavaCd = Math.max(0, (d.lavaCd ?? 1 + (d.id % 3)) - dt);
  if (d.lavaWind) {
    d.vx *= 0.5;
    d.vy *= 0.5;
    d.lavaWind += dt;
    const aim = aimOf.get(d);
    const tgt = aim?.dragon ? w.dragons.all().find((x) => x.id === aim.dragon && x.hp > 0) ?? null : null;
    const foe = aim && !aim.dragon ? foeById(w, aim.foe) : null;
    const p = tgt ?? (foe ? posOf(foe) : null);
    if (p) d.dir = p.x > d.x ? 1 : -1;
    if (d.lavaWind < THROW.wind) return;
    d.lavaWind = 0;
    d.lavaCd = THROW.cd * (0.85 + l.rng() * 0.5);
    d.think = 0;
    if (!p) return;
    const L = sizeOf(d);
    const from = { x: d.x + d.dir * L * 0.15, y: d.y - 2, z: L * 1.15 };
    const flight = Math.max(0.55, Math.min(1.5, Math.hypot(p.x - from.x, p.y - from.y) / 240));
    // lead a moving target a little, and aim a touch wide (it's a lump of lava, not a spear)
    const tx = p.x + (p.vx ?? 0) * flight * 0.8 + (l.rng() - 0.5) * 18;
    const ty = p.y + (p.vy ?? 0) * flight * 0.8 + (l.rng() - 0.5) * 12;
    const tz = tgt ? tgt.z : 0;
    l.balls.push({
      x: from.x, y: from.y, z: from.z,
      vx: (tx - from.x) / flight, vy: (ty - from.y) / flight, vz: (tz - from.z + 0.5 * G * flight * flight) / flight,
      t: 0, r: Math.max(5, L * 0.1), dragon: tgt?.id ?? 0,
    });
    w.sfx("whoosh", d.x, d.y, 0.8, 0.6);
    return;
  }
  if (d.lavaCd || heatOf(d) < 0.25 || d.state === "knocked" || d.state === "tussle") return;
  const dr = dragonNear(w, d);
  const foe = foeById(w, d.targetId);
  const fp = foe ? posOf(foe) : null;
  const fd = fp ? Math.hypot(fp.x - d.x, fp.y - d.y) : 0;
  if (!dr && !(fp && fd > THROW.min && fd < THROW.max)) return;
  aimOf.set(d, { dragon: dr?.id ?? 0, foe: dr ? 0 : fp!.id });
  d.lavaWind = 0.001;
  d.dir = (dr ?? fp)!.x > d.x ? 1 : -1;
  if (dr && !w.flags.has("lavaVsDragon") && w.inView(d.x, d.y, 200)) {
    w.flags.add("lavaVsDragon");
    w.toast("🌋", `A Lava Monster is balling up lava to throw at ${dr.name} as it flies over!`, d.x, d.y);
  }
}

/** Every frame: the lava balls in flight; each splatters where it comes down (or on the dragon it hits). */
export function lavaBallsTick(w: World, dt: number) {
  const l = lives.get(w);
  if (!l) return;
  cheerTick(w, l);
  if (l.burning.size) burnTick(w, dt, l);
  if (l.splashes.length) splashTick(w, dt, l);
  if (!l.balls.length) return;
  const keep: LavaBall[] = [];
  for (const b of l.balls) {
    b.t += dt;
    b.vz -= G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (l.rng() < dt * 14 && w.inView(b.x, b.y, 100)) w.particles.spawn(P.Ember, b.x, b.y, { z: b.z, vz: 10, size: 2 + l.rng() * 2, max: 0.6, color: l.rng() < 0.5 ? "#ffd04a" : "#ff6a1f" });
    if (b.dragon) {
      const dr = w.dragons.all().find((x) => x.id === b.dragon);
      if (dr && dr.hp > 0 && Math.hypot(dr.x - b.x, dr.y - b.y) < 60 && Math.abs(dr.z - b.z) < 70) {
        w.dragons.hit(w, dr, 70);
        w.particles.burst(P.Ember, b.x, b.y, 14, 90, { z: b.z, vz: 40, g: 200, size: 3, max: 1, color: "#ffb03a" });
        w.particles.spawn(P.Smoke, b.x, b.y, { z: b.z, vz: 20, size: 18, max: 1.4, color: "rgba(60,50,46,0.55)" });
        w.sfx("thud", b.x, b.y, 0.9, 0.7);
        continue;
      }
    }
    if (b.z <= 0) {
      splat(w, b.x, b.y, l);
      continue;
    }
    if (b.t < 4) keep.push(b);
  }
  l.balls = keep;
}

/** A lava ball lands: it splatters, melts whatever it lands on, and the splat cools into lava stone. */
function splat(w: World, x: number, y: number, l: Life) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
  const water = inside && isWaterTile(w.terrain.tiles[ty * MAP_W + tx] as T);
  if (water) {
    // into the water: a hiss and a cloud of steam, nothing more
    w.particles.burst(P.Steam, x, y, 8, 40, { vz: 40, size: 14, max: 1.4, color: "rgba(235,235,235,0.7)" });
    w.sfx("hiss", x, y, 0.9, 0.8);
    return;
  }
  w.particles.burst(P.Ember, x, y, 16, 110, { z: 6, vz: 80, g: 260, size: 3, max: 0.9, color: "#ff9a2a" });
  w.particles.burst(P.Rock, x, y, 6, 70, { z: 4, vz: 60, g: 260, size: 4, max: 0.8, color: "#ff6a1f" });
  w.particles.spawn(P.Smoke, x, y, { z: 10, vz: 30, size: 20, max: 1.6, color: "rgba(55,45,42,0.55)" });
  w.sfx("hiss", x, y, 1, 0.7);
  // the splat: live lava on the ground that cools into basalt (volcano.ts)
  if (inside) w.lava.warm(w, tx, ty, 0.55);
  for (const h of w.humans) {
    if (Math.abs(h.x - x) > SPLAT_R || !okHuman(h) || Math.hypot(h.x - x, h.y - y) > SPLAT_R) continue;
    melt(w, h, 0.45, "melted by a ball of lava");
    if (w.humans.includes(h)) setAflame(w, h, "human");
    if (h.state !== "down") say(h, pick(l.rng, ["AAAH! LAVA!", "It burns!", "Hot hot HOT!"]), 1.4);
  }
  for (const b of w.rivals.brutes) {
    if (Math.abs(b.x - x) > SPLAT_R || !okBrute(b) || Math.hypot(b.x - x, b.y - y) > SPLAT_R) continue;
    w.rivals.hit(w, b, 0.4, x, y, true);
    setAflame(w, b, "brute");
  }
  for (const o of w.dinos) {
    if (Math.abs(o.x - x) > SPLAT_R + sizeOf(o) * 0.3 || !okDino(o) || Math.hypot(o.x - x, o.y - y) > SPLAT_R + sizeOf(o) * 0.3) continue;
    o.burn = 0;
    hitDino(w, o, 60, x, y);
    if (w.dinos.includes(o)) setAflame(w, o, "dino");
  }
  for (const b of w.colony.buildings) if (b.built >= 1 && b.hp > 0 && Math.hypot(b.x - x, b.y - y) < SPLAT_R + 20) b.hp = Math.max(0, b.hp - 40);
}

/* ------------------------------ dinosaur eggs ------------------------------ */

/** How far a Lava Monster goes for an egg (px from it), and how far from the volcano a nest is "near" it. */
export const EGG_SENSE = 520;
export const EGG_RANGE = LAVA_HOME_R * 1.3;
const YUM = ["Mmm… EGG…", "LAVA… EGG!", "Nom… LaVa…", "EGGS… lava…"];

/** The nearest dinosaur egg it'll go for: close to it, and close to its volcano (its home). */
function eggNear(w: World, d: Dino): Egg | null {
  if (!w.eggs.length || heatOf(d) < HEAT.cold) return null;
  let best: Egg | null = null;
  let bd = EGG_SENSE;
  for (const e of w.eggs) {
    if (Math.abs(e.x - d.x) > bd || Math.hypot(e.x - d.homeX, e.y - d.homeY) > EGG_RANGE) continue;
    if (!lavaWalkable(w, e.x, e.y)) continue;
    const dist = Math.hypot(e.x - d.x, e.y - d.y);
    if (dist < bd) {
      bd = dist;
      best = e;
    }
  }
  return best;
}

/** Gobbled: the egg's gone, and the nest it lay in goes up in flames. */
export function eatEgg(w: World, d: Dino, e: Egg, l = lifeOf(w)) {
  const i = w.eggs.indexOf(e);
  if (i < 0) return;
  w.eggs.splice(i, 1);
  w.particles.burst(P.Crumb, e.x, e.y, 10, 60, { z: 6, vz: 60, g: 260, size: 2.5, max: 0.7, color: "#f4efe2" });
  w.particles.burst(P.Crumb, e.x, e.y, 5, 40, { z: 4, vz: 40, g: 260, size: 2.5, max: 0.6, color: "#ffcf3a" });
  w.sfx("chomp", e.x, e.y, 0.9, 0.7);
  emote(d, "😋", 2);
  d.speech = { text: pick(l.rng, YUM), t: 2 };
  // a hot meal: it perks up
  d.health = Math.min(1, d.health + 0.12);
  d.lavaHeat = Math.min(1, heatOf(d) + 0.15);
  // …and the nest burns: the straw and the ground round it catch
  const tx = Math.floor(e.x / TILE);
  const ty = Math.floor(e.y / TILE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) w.fire.ignite(w, tx + dx, ty + dy, dx || dy ? 0.5 : 0.8);
  w.burnPlantsAt(e.x, e.y, 0.6);
  w.particles.burst(P.Ember, e.x, e.y, 12, 70, { z: 6, vz: 80, g: 120, size: 3, max: 1, color: "#ffb03a" });
  w.particles.spawn(P.Smoke, e.x, e.y, { z: 14, vz: 30, size: 18, max: 1.8, color: "rgba(55,45,42,0.55)" });
  // the parent (if it's about) is frantic
  const parent = e.parent ? w.dinoById(e.parent) : null;
  if (parent && Math.hypot(parent.x - e.x, parent.y - e.y) < 500) emote(parent, "😱", 2);
}

/* ------------------------------ on fire ------------------------------ */

/** How long something set alight by lava burns (s), and what it does to it a second. */
export const AFLAME = { secs: 5, dino: 0.05, human: 0.07, brute: 0.06 };
const PANIC = ["I'm on fire!", "AAAH! HOT!", "Water! WATER!", "Put me out!"];

/** Set it alight (a Lava Monster's touch, a lava ball): it bursts into flames, panics and runs. */
export function setAflame(w: World, e: Human | Brute | Dino, kind: "human" | "brute" | "dino") {
  if (kind === "dino" && isLavaFolk(e as Dino)) return;
  const l = lifeOf(w);
  const was = (e.aflame ?? 0) > 0;
  e.aflame = Math.max(e.aflame ?? 0, AFLAME.secs * (0.8 + l.rng() * 0.4));
  l.burning.set(e, kind);
  if (was) return;
  w.sfx("ignite", e.x, e.y, 0.8);
  // it runs, flapping (away from where it is, anywhere)
  const a = l.rng() * Math.PI * 2;
  if (kind === "dino") {
    const d = e as Dino;
    d.fear = 1;
    if (sp(d.species).move === "walk" && d.state !== "faint" && d.state !== "carried") setState(d, "flee", d.x + Math.cos(a) * 320, d.y + Math.sin(a) * 240);
    emote(d, "🔥", 2);
  } else if (kind === "human") {
    const h = e as Human;
    h.fear = 1;
    if (h.state !== "down" && !h.riding && !h.chariot && !h.aloft) {
      // (to water, if there's some close by)
      const wet = w.terrain.nearestDrink(h.x, h.y, 320);
      go(h, "flee", wet ? wet.x : h.x + Math.cos(a) * 200, wet ? wet.y : h.y + Math.sin(a) * 150);
    }
    say(h, pick(l.rng, PANIC), 1.8);
  }
}

/** Is it standing somewhere that puts a fire out (water, deep snow), or getting rained on? */
function doused(w: World, x: number, y: number) {
  const t = w.terrain.tileAt(x, y);
  return isWaterTile(t) || w.snow.at(x, y) > 0.3 || w.weather.rain > 0.45;
}

/** Every frame: everything that's on fire burns down a little (or gets put out). */
function burnTick(w: World, dt: number, l: Life) {
  for (const [e, kind] of Array.from(l.burning)) {
    const gone = kind === "dino" ? !w.dinos.includes(e as Dino) : kind === "human" ? !w.humans.includes(e as Human) || (e as Human).under : (e as Brute).hp <= 0 || !w.rivals.brutes.includes(e as Brute);
    if (gone) {
      l.burning.delete(e);
      continue;
    }
    // a splash of water, a roll in the snow, a downpour: out it goes, in a puff of steam
    if (doused(w, e.x, e.y)) e.aflame = 0;
    e.aflame = Math.max(0, (e.aflame ?? 0) - dt);
    if (!e.aflame) {
      l.burning.delete(e);
      w.particles.burst(P.Steam, e.x, e.y, 5, 30, { z: 16, vz: 40, size: 9, max: 1, color: "rgba(225,225,225,0.6)" });
      if (kind === "human" && (e as Human).state !== "down") say(e as Human, pick(l.rng, ["Phew…", "It's out!", "My hair…"]), 1.6);
      continue;
    }
    if (kind === "dino") {
      const d = e as Dino;
      d.health -= dt * AFLAME.dino;
      d.burn = 0;
      d.fear = 1;
      if (d.health <= 0 && d.state !== "faint") setState(d, "faint", d.x, d.y);
      // on fire, it panics: no fighting back, it just runs (and keeps running while it burns)
      else if (d.state !== "flee" && d.state !== "faint" && d.state !== "carried" && d.state !== "knocked" && sp(d.species).move === "walk") {
        const a = l.rng() * Math.PI * 2;
        d.targetId = 0;
        setState(d, "flee", d.x + Math.cos(a) * 320, d.y + Math.sin(a) * 240);
      }
    } else if (kind === "human") {
      const h = e as Human;
      // (no dice: a steady burn, a little every half second)
      const k = Math.floor((w.elapsed + h.id * 0.13) * 2);
      if (k !== Math.floor((w.elapsed - dt + h.id * 0.13) * 2) && h.state !== "down") hurtHuman(w, h, AFLAME.human * 0.5, h.x - 1, h.y, "burn");
    } else {
      const b = e as Brute;
      const k = Math.floor((w.elapsed + b.id * 0.13) * 2);
      if (k !== Math.floor((w.elapsed - dt + b.id * 0.13) * 2)) w.rivals.hit(w, b, AFLAME.brute * 0.5, b.x - 1, b.y, true);
    }
    // smoke + sparks streaming off it, and the grass under it catching
    if (w.inView(e.x, e.y, 80)) {
      if (l.rng() < dt * 10) w.particles.spawn(P.Ember, e.x + (l.rng() - 0.5) * 20, e.y, { z: 14 + l.rng() * 30, vz: 50, vx: (l.rng() - 0.5) * 20, g: -10, size: 2 + l.rng() * 2, max: 0.8, color: l.rng() < 0.5 ? "#ffd04a" : "#ff6a1f" });
      if (l.rng() < dt * 4) w.particles.spawn(P.Smoke, e.x, e.y, { z: 30, vz: 30, size: 10, max: 1.4, color: "rgba(55,48,44,0.5)" });
    }
    if (l.rng() < dt * 0.3) {
      const tx = Math.floor(e.x / TILE);
      const ty = Math.floor(e.y / TILE);
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && VEG_TILES.has(w.terrain.tiles[ty * MAP_W + tx] as T)) w.fire.ignite(w, tx, ty, 0.4);
    }
  }
}

/** Everything on fire right now (for the art). */
export function aflameNow(w: World) {
  return lives.get(w)?.burning ?? null;
}

/* ------------------------------ hit, killed, poked ------------------------------ */

/** Hit by something (from tribe.hitDino): it doesn't run, it turns on whatever did it. */
export function lavaHit(w: World, d: Dino, fx: number, fy: number) {
  const foe = nearestFoe(w, fx, fy, 420);
  if (foe) {
    const p = posOf(foe);
    d.targetId = p.id;
    if (!d.lavaWind) march(d, p.x, p.y);
  }
  d.fear = 0;
  emote(d, "😡", 1.2);
}

/** Killed: it cools into a lump of obsidian where it fell (from tribe.downDino). */
export function coolDown(w: World, d: Dino) {
  w.particles.burst(P.Steam, d.x, d.y, 14, 60, { vz: 40, size: 14, max: 1.6, color: "rgba(220,220,220,0.7)" });
  w.particles.burst(P.Rock, d.x, d.y, 10, 70, { z: 16, vz: 60, g: 200, size: 5, max: 0.9, color: "#2b2238" });
  w.sfx("hiss", d.x, d.y, 1.1, 0.5);
  // the statue is dense, high-quality lava stone (the toughest wall there is); a big one gives more
  const n = Math.round(4 + Math.min(4, sizeOf(d) / 20));
  const node = { id: w.nextId(), kind: "lavaStone" as const, x: d.x, y: d.y + 6, amount: n, max: n, found: true, variant: d.id % 4 };
  w.colony.nodes.push(node);
  w.colony.version++;
  rides.delete(d);
  // no bones, no body: it stands there turned to stone (until the obsidian under it is dug away)
  lifeOf(w).statues.push({ node: node.id, x: d.x, y: d.y, L: sizeOf(d), dir: d.dir, id: d.id });
  if (!w.flags.has("lavaCooled")) {
    w.flags.add("lavaCooled");
    w.toast("🗿", "The Lava Monster has turned to stone! Lava Monsters have no bones: they set solid into a statue of dense black lava stone. Send miners to dig it: lava stone builds Lava-stone walls, the toughest walls there are (Build → Defense).", d.x, d.y);
  }
}

/** Tapped: a slow, zombie moan of "LAVA… lava…" (one word or two). */
export function lavaSpeak(w: World, d: Dino) {
  if (d.speech && d.speech.t > 0.6) return;
  const l = lifeOf(w);
  const two = l.rng() < 0.5;
  d.speech = { text: pick(l.rng, two ? LAVA_TWO : LAVA_ONE), t: two ? 2.8 : 1.8 };
  w.sfx(two ? "lava2" : "lava1", d.x, d.y, 1, 0.9 + l.rng() * 0.2);
}

/* ------------------------------ placed with the People tool ------------------------------ */

/** A few Lava Monsters where you tap (they make that spot their home). Returns why not, or the newcomers. */
export function placeLavaFolk(w: World, x: number, y: number): Dino[] | string {
  if (!lavaWalkable(w, x, y)) return "Lava Monsters can't go in the water (or up a cliff): try dry ground.";
  const out: Dino[] = [];
  const l = lifeOf(w);
  for (let k = 0; k < 3; k++) {
    let p = { x, y };
    for (let t = 0; t < 12 && k > 0; t++) {
      const a = l.rng() * Math.PI * 2;
      const q = { x: x + Math.cos(a) * (40 + l.rng() * 50), y: y + Math.sin(a) * 30 };
      if (lavaWalkable(w, q.x, q.y)) {
        p = q;
        break;
      }
    }
    const d = spawnLavaFolk(w, p.x, p.y);
    d.homeX = x;
    d.homeY = y;
    out.push(d);
  }
  return out;
}

/** What one of ours can throw at a Lava Monster right here: snow (free) on snowy ground, else water from the stores. */
function ammoFor(w: World, h: Human): Splash["kind"] | null {
  const t = w.terrain.tileAt(h.x, h.y);
  if (t === T.Snow || t === T.Ice || w.snow.at(h.x, h.y) > 0.15) return "snow";
  if (w.camp.stock.water >= 1) return w.colony.kits.has("waterSkins") ? "hose" : "water";
  return null;
}
const COOLS: Record<Splash["kind"], number> = { water: 0.28, hose: 0.3, snow: 0.16, cannon: 0.34 };
const RELOAD: Record<Splash["kind"], number> = { water: 1.4, hose: 0.8, snow: 1, cannon: 0 };
const SHOUT: Record<Splash["kind"], string[]> = {
  cannon: ["Water cannon!", "Soak it!"],
  water: ["Water! Put it out!", "Bucket!", "Douse it!"],
  hose: ["Hose it down!", "Keep the water on it!", "Soak it!"],
  snow: ["Snowball!", "Cool off!", "Take that!"],
};

/**
 * One of ours fighting a Lava Monster (from tribe.roleAct, hunting / aiming at one). Spears and clubs just
 * melt, so they keep out of reach and throw buckets of water (or hose it down, with water skins), or
 * snowballs on snowy ground. No water and no snow: back to their weapons (which barely scratch it).
 * True = handled.
 */
export function lavaFightAct(w: World, h: Human, dt: number): boolean {
  if (h.state !== "hunt" && h.state !== "aim") return false;
  const d = w.dinoById(h.targetId);
  if (!d || !isLavaFolk(d)) return false;
  if (!w.flags.has("lavaWater")) {
    w.flags.add("lavaWater");
    w.toast("💧", "Spears and clubs just melt in a Lava Monster: it's water, snow and ice that beat them. Our people throw buckets of water from the stores (water skins let them hose it down), and snowballs on snowy ground. Keep the water stores full!", d.x, d.y);
  }
  const ammo = ammoFor(w, h);
  if (!ammo) {
    if (h.stateT < 0.2) say(h, "We need water!", 1.6);
    return false;
  }
  const dist = Math.hypot(d.x - h.x, d.y - h.y);
  h.dir = d.x > h.x ? 1 : -1;
  if (h.stateT > 60) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
    return true;
  }
  const near = sizeOf(d) * 0.42 + TOUCH + 50;
  if (dist > 175) {
    // into throwing range
    if (h.state !== "hunt") h.state = "hunt";
    h.tx = d.x;
    h.ty = d.y;
    moveHuman(w, h, dt);
    return true;
  }
  if (dist < near) {
    // too close: it burns. Back off a step
    const a = Math.atan2(h.y - d.y, h.x - d.x);
    h.tx = h.x + Math.cos(a) * 70;
    h.ty = h.y + Math.sin(a) * 50;
    if (h.state !== "hunt") h.state = "hunt";
    moveHuman(w, h, dt);
    return true;
  }
  if (h.state !== "aim") h.state = "aim";
  h.vx = h.vy = 0;
  if (h.cd > 0) return true;
  h.cd = RELOAD[ammo];
  if (ammo !== "snow") w.camp.stock.water = Math.max(0, w.camp.stock.water - 1);
  const l = lifeOf(w);
  const dur = Math.max(0.35, Math.min(0.8, dist / 300));
  const tz = sizeOf(d) * 0.55;
  const from = { x: h.x + h.dir * 6, y: h.y - 1, z: 24 };
  l.splashes.push({
    x: from.x, y: from.y, z: from.z,
    vx: (d.x - from.x) / dur, vy: (d.y - from.y) / dur, vz: (tz - from.z + 0.5 * G * dur * dur) / dur,
    t: 0, dur, kind: ammo, target: d.id,
  });
  w.sfx(ammo === "snow" ? "whoosh" : "splash", h.x, h.y, 0.7, ammo === "snow" ? 1.3 : 1);
  if (l.rng() < 0.35) say(h, pick(l.rng, SHOUT[ammo]), 1.3);
  return true;
}

/**
 * A squirt of water at a Lava Monster from (x, y, z): it arcs over, leading it a little, and cools it by
 * `cool` if it lands on it (a Scorpion's water cannon, a water wagon's hose).
 */
export function waterSquirt(w: World, x: number, y: number, z: number, d: Dino, cool: number, speed: number, kind: Splash["kind"] = "hose") {
  const l = lifeOf(w);
  const dist = Math.hypot(d.x - x, d.y - y);
  const dur = Math.max(0.25, Math.min(1.1, dist / speed));
  const tx = d.x + d.vx * dur;
  const ty = d.y + d.vy * dur;
  const tz = sizeOf(d) * 0.55;
  l.splashes.push({
    x, y, z,
    vx: (tx - x) / dur, vy: (ty - y) / dur, vz: (tz - z + 0.5 * G * dur * dur) / dur,
    t: 0, dur, kind, target: d.id, cool,
  });
}

/** How fast a Scorpion's water cannon throws its jet (px / s). */
export const CANNON_SPEED = 520;

/**
 * A Scorpion aimed at a Lava Monster turns into a water cannon: a bolt would just melt, so instead it
 * fires a hard jet of water that cools it (from tribe.fireBolt, so wall, tower + chariot Scorpions all do
 * it). It draws a skin of water from the stores when there is some; dry stores, and the crew pump what
 * they can from the ditches (a weaker jet). `power` scales the cooling (powered Scorpions hit harder).
 */
export function scorpionWaterJet(w: World, x: number, y: number, z: number, d: Dino, power = 1) {
  const wet = w.camp.stock.water >= 0.5;
  if (wet) w.camp.stock.water = Math.max(0, w.camp.stock.water - 0.5);
  waterSquirt(w, x, y, z, d, COOLS.cannon * power * (wet ? 1 : 0.55), CANNON_SPEED, "cannon");
  w.sfx("splash", x, y, 0.9, 0.75);
  w.particles.burst(P.Spark, x, y, 6, 50, { z, vz: 30, g: 220, size: 2.4, max: 0.4, color: "#9fd4ff" });
  if (!w.flags.has("scorpionWater")) {
    w.flags.add("scorpionWater");
    w.toast("💦", "Our Scorpions turn into water cannons when a Lava Monster comes near: bolts just melt, so they blast it with water instead. Each jet draws a little from the water stores (dry stores make a weaker jet).", x, y);
  }
}

/** Every frame: the water + snowballs in the air; each lands on the Lava Monster it was thrown at (or the ground). */
function splashTick(w: World, dt: number, l: Life) {
  const keep: Splash[] = [];
  for (const s of l.splashes) {
    s.t += dt;
    s.vz -= G * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    if (s.kind !== "snow" && l.rng() < dt * 20 && w.inView(s.x, s.y, 60)) w.particles.spawn(P.Spark, s.x, s.y, { z: s.z, vz: -20, size: 2, max: 0.4, color: "#9fd4ff" });
    if (s.t < s.dur && s.z > 0) {
      keep.push(s);
      continue;
    }
    const d = w.dinoById(s.target);
    const hitIt = !!d && isLavaFolk(d) && Math.hypot(d.x - s.x, d.y - s.y) < sizeOf(d) * 0.6 + 22;
    if (s.kind === "snow") w.particles.burst(P.Poof, s.x, s.y, 6, 40, { z: Math.max(0, s.z), size: 7, max: 0.6, color: "rgba(245,250,255,0.9)" });
    else w.particles.burst(P.Spark, s.x, s.y, 10, 70, { z: Math.max(0, s.z), vz: 40, g: 220, size: 3, max: 0.6, color: "#8fd0ff" });
    if (hitIt) coolLava(w, d!, s.cool ?? COOLS[s.kind]);
  }
  l.splashes = keep;
}

/* ------------------------------ their numbers ------------------------------ */

/** A spot on a volcano's slopes or its lava fields for a new one to heave itself out (or null). */
function birthSpot(w: World, rng: Rng, c: { x: number; y: number } = crater(w)) {
  for (let k = 0; k < 80; k++) {
    const a = rng() * Math.PI * 2;
    const r = 70 + Math.sqrt(rng()) * LAVA_HOME_R * 0.55;
    const x = c.x + Math.cos(a) * r;
    const y = c.y + Math.sin(a) * r * 0.7;
    if (lavaGround(w, x, y) && lavaWalkable(w, x, y)) return { x, y };
  }
  for (let k = 0; k < 40; k++) {
    const a = rng() * Math.PI * 2;
    const r = 120 + rng() * 300;
    const x = c.x + Math.cos(a) * r;
    const y = c.y + Math.sin(a) * r * 0.7;
    if (lavaWalkable(w, x, y)) return { x, y };
  }
  return null;
}

/** One heaves itself up out of the lava (at home on the volcano it came from: the nearer one). */
export function spawnLavaFolk(w: World, x: number, y: number) {
  const c = w.volcanoes.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) <= Math.hypot(b.x - x, b.y - y) ? a : b));
  const d = addDino(w, LAVA_FOLK, x, y, { growth: 1, homeX: c.x, homeY: c.y, hunger: 0, thirst: 0 });
  d.layT = 1e9;
  d.lavaHeat = 1;
  w.particles.burst(P.Ember, x, y, 12, 80, { z: 10, vz: 90, g: 160, size: 3, max: 1, color: "#ffb03a" });
  w.particles.burst(P.Smoke, x, y, 5, 40, { z: 20, vz: 30, size: 16, max: 1.6, color: "rgba(55,45,42,0.55)" });
  return d;
}

/**
 * The far east volcano's newcomers are made with the Lava Monsters' own dice, not the world's (the first
 * volcano's always used the world's): so adding the second volcano changed nothing else in the world.
 */
function farDice<T>(w: World, vi: number, l: Life, fn: () => T): T {
  if (!vi) return fn();
  const shared = w.rng;
  w.rng = l.rng;
  try {
    return fn();
  } finally {
    w.rng = shared;
  }
}

/** Once a second: the volcano tops up its Lava Monsters and keeps their pool molten. */
export function lavaTick(w: World, dt: number) {
  const l = lifeOf(w);
  l.acc += dt;
  if (l.acc < 1) return;
  l.acc = 0;
  if (!w.wildlife.enabled || w.extinction.wasteland || LM.volcano.x <= 0) return;
  warmPool(w);
  // each volcano keeps its own Lava Monsters (counted by where they call home)
  const vs = w.volcanoes;
  const counts = vs.map((v) => w.dinos.filter((d) => isLavaFolk(d) && !d.under && Math.hypot(d.homeX - v.x, d.homeY - v.y) < 900).length);
  if (!l.seeded) {
    // the first time round (a new world, or a save from before them): the volcanoes' people are there already
    l.seeded = true;
    l.birthAt = w.elapsed + BIRTH_EVERY;
    vs.forEach((v, vi) => {
      for (let k = counts[vi]; k < LAVA_KEEP - 1; k++) {
        const p = birthSpot(w, l.rng, v);
        if (p) farDice(w, vi, l, () => spawnLavaFolk(w, p.x, p.y));
      }
    });
    return;
  }
  if (w.elapsed < l.birthAt) return;
  // the volcano that's shortest of its people gets the next one (an erupting one keeps more)
  let pick = -1;
  let need = 0;
  vs.forEach((v, vi) => {
    const keep = isErupting(v) ? LAVA_KEEP + 3 : LAVA_KEEP;
    if (keep - counts[vi] > need) {
      need = keep - counts[vi];
      pick = vi;
    }
  });
  const hot = erupting(w);
  if (pick < 0) {
    l.birthAt = w.elapsed + (hot ? BIRTH_EVERY / 4 : BIRTH_EVERY) * 0.5;
    return;
  }
  l.birthAt = w.elapsed + (hot ? BIRTH_EVERY / 4 : BIRTH_EVERY) * (0.7 + l.rng() * 0.6);
  const p = birthSpot(w, l.rng, vs[pick]);
  if (!p) return;
  farDice(w, pick, l, () => spawnLavaFolk(w, p.x, p.y));
  if (w.flags.has("lavaSeen") && w.inView(p.x, p.y, 200)) w.toast("🌋", hot ? "The eruption spits out another Lava Monster!" : "A lump of lava heaves itself up and starts walking: another Lava Monster.", p.x, p.y);
}
