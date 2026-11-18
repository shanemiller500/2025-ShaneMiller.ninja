/* ------------------------------------------------------------------ */
/*  The river beasts: crocodiles, hippos and giant snakes.             */
/*                                                                     */
/*   • Crocodiles lurk in the rivers, streams, swamp and lakes: just    */
/*     their eyes and the ridges of their backs show. Anything that     */
/*     comes to the water's edge (or wades in) gets a lunge and a bite. */
/*   • Hippos wallow in the water by day (eyes, ears and a broad back)  */
/*     and come up onto the banks to graze at night. They're the        */
/*     grumpiest things in the land: anything that comes near gets      */
/*     charged, jaws wide.                                              */
/*   • Giant snakes lie coiled in the jungle + swamp grass and strike   */
/*     at anything that passes: venom that leaves it dizzy and slow.    */
/*                                                                     */
/*  All three eat anything: our people, the other peoples, every        */
/*  animal (not a Lava Monster: that just burns). Someone of ours they   */
/*  knock down is gone (except on Calm). They live well away from the   */
/*  camp, never stray far from home, and their numbers are kept up      */
/*  (out of sight, with their own dice: the rest of the world plays     */
/*  out the same).                                                      */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { addDino, emote, setState, sizeOf, walkable } from "./dinos";
import { damSites } from "./beavers";
import { dies } from "./death";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { say } from "./humans";
import { isWaterTile } from "./terrain";
import { hitDino } from "./tribe";
import { MAP_H, MAP_W, T, TILE, type Brute, type Dino, type Human, type SpeciesId } from "./types";
import type { World } from "./world";

export type RiverKind = "croc" | "hippo" | "snake";
export const RIVER_BEASTS = new Set<SpeciesId>(["croc", "hippo", "snake"]);
export const isRiverBeast = (d: Pick<Dino, "species">) => RIVER_BEASTS.has(d.species);

interface Cfg {
  /** goes for anything this close to it (px) */
  ambush: number;
  /** never this far from home (px) */
  leash: number;
  /** what a bite does: to one of ours / a Neanderthal (0..1 of their health), to an animal (hp) */
  bite: number;
  dino: number;
  /** seconds between bites */
  cd: number;
  /** how far from home it roams at rest (px) */
  roam: number;
  /** how many the land keeps */
  keep: number;
  /** attack speed (px/s) */
  lunge: number;
}
export const CFG: Record<RiverKind, Cfg> = {
  croc: { ambush: 120, leash: 260, bite: 0.34, dino: 48, cd: 1.4, roam: 150, keep: 7, lunge: 150 },
  hippo: { ambush: 170, leash: 330, bite: 0.4, dino: 62, cd: 1.6, roam: 220, keep: 5, lunge: 110 },
  snake: { ambush: 70, leash: 150, bite: 0.18, dino: 20, cd: 1.2, roam: 110, keep: 6, lunge: 130 },
};
/** None of them lives this close to the camp (px). */
export const CAMP_CLEAR = 1150;
/** How long the venom leaves something dizzy (s). */
const VENOM = 5;

const SEEN: Record<RiverKind, { flag: string; icon: string; text: string }> = {
  croc: { flag: "crocSeen", icon: "🐊", text: "A CROCODILE! It was lying in the water with just its eyes showing. Crocodiles eat anything that comes to the water's edge: take care fetching water and fording rivers out in the wild." },
  hippo: { flag: "hippoSeen", icon: "🦛", text: "A HIPPO! Hippos look sleepy, wallowing in the river… but they're the grumpiest animals in the land and charge anything that comes near, jaws wide. Give them room." },
  snake: { flag: "snakeSeen", icon: "🐍", text: "A GIANT SNAKE! It was coiled in the long grass. Snakes strike at anything that walks past: their venom leaves you dizzy and slow." },
};

/** Water a crocodile or hippo lives in (rivers, streams, shallows, the swamp; not the salt sea). */
export function homeWater(w: World, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  const i = ty * MAP_W + tx;
  const t = w.terrain.tiles[i] as T;
  return (t === T.River || t === T.Shallow || t === T.Swamp || t === T.Deep) && !w.terrain.salt[i];
}
/** In the water right now (crocs + hippos sit low in it). */
export function inWater(w: World, x: number, y: number) {
  const t = w.terrain.tileAt(x, y);
  return t === T.River || t === T.Shallow || t === T.Swamp || t === T.Deep;
}

type Foe = { kind: "human"; h: Human } | { kind: "brute"; b: Brute } | { kind: "dino"; d: Dino };
const posOf = (f: Foe) => (f.kind === "human" ? f.h : f.kind === "brute" ? f.b : f.d);

function okHuman(h: Human) {
  return !h.under && !h.aloft && !h.hung && !h.yetiHeld && !h.captive && h.level === 0 && h.state !== "down" && h.state !== "hide" && !h.chariot;
}
function okBrute(b: Brute) {
  return b.hp > 0 && !b.snatched && !b.falling && !b.captive && b.z <= 20 && !b.boat && !b.onDragon;
}
function okDino(me: Dino, d: Dino) {
  return d !== me && d.species !== me.species && d.species !== "lavaFolk" && !d.under && !d.caged && !d.netted && d.health > 0 && d.state !== "faint" && d.state !== "carried" && d.z < 8 && sp(d.species).move !== "fly";
}

function foeById(w: World, me: Dino, id: number): Foe | null {
  if (!id) return null;
  const h = w.humans.find((x) => x.id === id);
  if (h) return okHuman(h) ? { kind: "human", h } : null;
  const b = w.rivals.byId(id);
  if (b) return okBrute(b) ? { kind: "brute", b } : null;
  const d = w.dinoById(id);
  return d && okDino(me, d) ? { kind: "dino", d } : null;
}

/** The nearest thing to eat within r of it (and in reach of its home). */
function nearestFoe(w: World, me: Dino, r: number, leash: number): Foe | null {
  let best: Foe | null = null;
  let bd = r;
  const ok = (x: number, y: number) => Math.hypot(x - me.homeX, y - me.homeY) < leash;
  for (const h of w.humans) {
    if (Math.abs(h.x - me.x) > bd || !okHuman(h) || !ok(h.x, h.y)) continue;
    const dist = Math.hypot(h.x - me.x, h.y - me.y);
    if (dist < bd) {
      bd = dist;
      best = { kind: "human", h };
    }
  }
  for (const b of w.rivals.brutes) {
    if (Math.abs(b.x - me.x) > bd || !okBrute(b) || !ok(b.x, b.y)) continue;
    const dist = Math.hypot(b.x - me.x, b.y - me.y);
    if (dist < bd) {
      bd = dist;
      best = { kind: "brute", b };
    }
  }
  for (const d of w.dinos) {
    if (Math.abs(d.x - me.x) > bd || !okDino(me, d) || !ok(d.x, d.y)) continue;
    const dist = Math.hypot(d.x - me.x, d.y - me.y);
    if (dist < bd) {
      bd = dist;
      best = { kind: "dino", d };
    }
  }
  return best;
}

/* ------------------------------ their own dice ------------------------------ */

interface Life {
  rng: Rng;
  acc: number;
  next: Partial<Record<RiverKind, number>>;
}
const lives = new WeakMap<World, Life>();
function lifeOf(w: World): Life {
  let l = lives.get(w);
  if (!l) lives.set(w, (l = { rng: makeRng(w.seed * 389 + 61), acc: 0, next: {} }));
  return l;
}
/** Eating what it caught: it stays put, chewing, till then (elapsed s). */
const feeding = new WeakMap<Dino, number>();

/* ------------------------------ the brain ------------------------------ */

const kindOf = (d: Dino) => d.species as RiverKind;

/** Its brain (thinkDino hands it over). Always decides. */
export function riverThink(w: World, d: Dino): boolean {
  if (d.state === "faint" || d.state === "knocked" || d.state === "carried" || d.state === "tussle") return false;
  const k = kindOf(d);
  const c = CFG[k];
  const l = lifeOf(w);
  d.hunger = 0;
  d.thirst = 0;
  d.layT = 1e9;
  d.fear = 0;
  // still chewing what it caught
  if ((feeding.get(d) ?? 0) > w.elapsed) {
    if (d.state !== "idle") setState(d, "idle", d.x, d.y);
    if (l.rng() < 0.4) emote(d, "🍖", 1.2);
    return true;
  }
  // after something: keep at it while it's in reach of home
  const cur = foeById(w, d, d.targetId);
  if (cur) {
    const p = posOf(cur);
    if (Math.hypot(p.x - d.homeX, p.y - d.homeY) < c.leash * 1.3 && d.stateT < 12) return true;
    d.targetId = 0;
  }
  // anything close enough to eat
  const foe = nearestFoe(w, d, k === "hippo" ? c.ambush : c.ambush * (k === "croc" && !inWater(w, d.x, d.y) ? 0.6 : 1), c.leash);
  if (foe) {
    const p = posOf(foe);
    d.targetId = p.id;
    setState(d, "chase", p.x, p.y);
    emote(d, k === "hippo" ? "😡" : "❗", 1.2);
    w.sfx(sp(d.species).sound.kind, d.x, d.y, 0.9, sp(d.species).sound.pitch);
    const seen = SEEN[k];
    if (foe.kind === "human" && !w.flags.has(seen.flag)) {
      w.flags.add(seen.flag);
      w.toast(seen.icon, seen.text, d.x, d.y);
      w.discover(k, d.x, d.y);
    }
    return true;
  }
  d.targetId = 0;
  // at rest
  const night = w.daylight < 0.3;
  const wantWater = k === "croc" || (k === "hippo" && !night);
  if (wantWater && !inWater(w, d.x, d.y)) {
    // back into the water (the nearest bit of its home water)
    const spot = waterNear(w, d.homeX, d.homeY, l.rng, c.roam);
    if (spot) {
      setState(d, "wander", spot.x, spot.y);
      return true;
    }
  }
  if (d.state === "wander" && Math.hypot(d.tx - d.x, d.ty - d.y) > 10 && d.stateT < 20) return true;
  // lurking (a croc), wallowing (a hippo by day), coiled up (a snake): a good long while, then a little shuffle
  if ((d.state === "idle" || d.state === "stalk") && d.stateT < (k === "snake" ? 14 : 10) + (d.id % 6)) return true;
  if (l.rng() < 0.55) {
    setState(d, k === "croc" ? "stalk" : "idle", d.x, d.y);
    return true;
  }
  for (let t = 0; t < 8; t++) {
    const a = l.rng() * Math.PI * 2;
    const r = 30 + l.rng() * c.roam;
    const x = d.homeX + Math.cos(a) * r;
    const y = d.homeY + Math.sin(a) * r * 0.7;
    if (wantWater ? homeWater(w, x, y) : walkable(w, d, x, y) && (k !== "hippo" || !isWaterTile(w.terrain.tileAt(x, y)) || l.rng() < 0.3)) {
      setState(d, "wander", x, y);
      return true;
    }
  }
  setState(d, "idle", d.x, d.y);
  return true;
}

/** A spot in its home water near (x, y), or null. */
function waterNear(w: World, x: number, y: number, rng: Rng, r: number) {
  for (let k = 0; k < 24; k++) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.7;
    if (homeWater(w, px, py)) return { x: px, y: py };
  }
  return homeWater(w, x, y) ? { x, y } : null;
}

/** Per frame (actDino hands it over): the lunge + the bite. True = it moved itself this frame. */
export function riverAct(w: World, d: Dino, dt: number): boolean {
  d.clawCd = Math.max(0, (d.clawCd ?? 0) - dt);
  d.strike = Math.max(0, (d.strike ?? 0) - dt * 1.5);
  if (d.state !== "chase") return false;
  const k = kindOf(d);
  const c = CFG[k];
  const foe = foeById(w, d, d.targetId);
  if (!foe || Math.hypot(d.x - d.homeX, d.y - d.homeY) > c.leash * 1.3 || d.stateT > 12) {
    d.targetId = 0;
    setState(d, "wander", d.homeX, d.homeY);
    return false;
  }
  const p = posOf(foe);
  const dist = Math.hypot(p.x - d.x, p.y - d.y);
  const reach = sizeOf(d) * 0.45 + (foe.kind === "dino" ? sizeOf(foe.d) * 0.3 : 12);
  d.dir = p.x > d.x ? 1 : -1;
  d.tx = p.x;
  d.ty = p.y;
  if (dist > reach) {
    // the lunge (a hippo's charge, a snake's strike): straight at it
    const v = c.lunge * (d.slowT ? 0.45 : 1);
    const nx = d.x + ((p.x - d.x) / dist) * v * dt;
    const ny = d.y + ((p.y - d.y) / dist) * v * dt;
    if (walkable(w, d, nx, ny) || (k !== "snake" && isWaterTile(w.terrain.tileAt(nx, ny)))) {
      d.x = nx;
      d.y = ny;
    } else d.stuckT += dt;
    d.vx = ((p.x - d.x) / dist) * v;
    d.vy = ((p.y - d.y) / dist) * v;
    d.anim += dt * 6;
    if (inWater(w, d.x, d.y) && w.inView(d.x, d.y, 60) && lifeOf(w).rng() < dt * 8) w.particles.spawn(P.Ripple, d.x, d.y + 4, { size: 6, max: 0.8 });
    return true;
  }
  d.vx = d.vy = 0;
  if (!d.clawCd) {
    d.clawCd = c.cd;
    d.strike = 1;
    bite(w, d, foe, k);
  }
  return true;
}

const OUCH: Record<RiverKind, string[]> = {
  croc: ["CROC!", "It's got my leg!", "Get it off!"],
  hippo: ["HIPPO!", "Run!", "It's charging!"],
  snake: ["Snake!", "Ow, it bit me!", "Everything's spinning…"],
};
const HOW: Record<RiverKind, string> = { croc: "dragged into the water by a crocodile", hippo: "trampled and bitten by a hippo", snake: "killed by a giant snake" };

/** A bite (and, for a snake, venom). Something of ours knocked down is gone: they eat anything. */
function bite(w: World, d: Dino, foe: Foe, k: RiverKind) {
  const c = CFG[k];
  const l = lifeOf(w);
  const p = posOf(foe);
  w.sfx(k === "hippo" ? "chomp" : "chomp", p.x, p.y, 1, k === "hippo" ? 0.6 : k === "croc" ? 0.8 : 1.3);
  w.particles.burst(k === "croc" || k === "hippo" ? P.Splash : P.Dust, p.x, p.y, 6, 50, { size: 6, max: 0.6, color: "rgba(200,225,240,0.8)" });
  if (foe.kind === "human") {
    const h = foe.h;
    say(h, pick(l.rng, OUCH[k]), 1.6);
    if (k === "snake") h.slowT = Math.max(h.slowT ?? 0, VENOM);
    const down = hurtHuman(w, h, c.bite, d.x, d.y, "bite");
    if (down && w.tribe.danger !== "calm") {
      dies(w, h, `${h.name} was ${HOW[k]}.`);
      fed(w, d);
    }
  } else if (foe.kind === "brute") {
    w.rivals.hit(w, foe.b, c.bite, d.x, d.y, true);
    if (k === "snake") foe.b.slowT = Math.max(foe.b.slowT ?? 0, VENOM);
    if (foe.b.hp <= 0) fed(w, d);
  } else {
    const o = foe.d;
    hitDino(w, o, c.dino, d.x, d.y);
    if (k === "snake" && w.dinos.includes(o)) {
      o.slowT = Math.max(o.slowT ?? 0, VENOM);
      emote(o, "💫", 1.6);
    }
    if (!w.dinos.includes(o) || o.health <= 0) fed(w, d);
  }
}

/** It caught something: it stays put and eats for a while. */
function fed(w: World, d: Dino) {
  d.targetId = 0;
  feeding.set(d, w.elapsed + 14);
  setState(d, "idle", d.x, d.y);
  emote(d, "😋", 2);
}

/* ------------------------------ their numbers ------------------------------ */

/** Somewhere a newcomer of this kind could live: away from the camp, out of sight, on the right ground. */
function homeSpot(w: World, k: RiverKind, rng: Rng, unseen: boolean) {
  for (let t = 0; t < 600; t++) {
    const tx = 2 + Math.floor(rng() * (MAP_W - 4));
    const ty = 2 + Math.floor(rng() * (MAP_H - 4));
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    if (Math.hypot(x - w.camp.x, y - w.camp.y) < CAMP_CLEAR || (unseen && w.inView(x, y, 300))) continue;
    const i = ty * MAP_W + tx;
    const tile = w.terrain.tiles[i] as T;
    if (w.terrain.salt[i]) continue;
    // (the beavers' stretch of stream is theirs: beavers.ts)
    if (damSites(w).some((s) => Math.hypot(s.px - x, s.py - y) < 520)) continue;
    if (k === "croc" && (tile === T.River || tile === T.Swamp || tile === T.Shallow)) return { x, y };
    if (k === "hippo" && (tile === T.River || tile === T.Shallow)) {
      // (a hippo pool: wide water, not a trickle of a stream)
      let wet = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (homeWater(w, x + dx * TILE, y + dy * TILE)) wet++;
      if (wet >= 9) return { x, y };
    }
    if (k === "snake" && (tile === T.Jungle || tile === T.Swamp || (tile === T.Grass && w.terrain.region[i] === 0))) return { x, y };
  }
  return null;
}

/** Once a second: the land keeps its crocodiles, hippos and snakes (newcomers arrive out of sight, one at a time). */
export function riverLifeTick(w: World, dt: number) {
  const l = lifeOf(w);
  l.acc += dt;
  if (l.acc < 1) return;
  l.acc = 0;
  if (!w.wildlife.enabled || w.extinction.wasteland) return;
  for (const k of ["croc", "hippo", "snake"] as RiverKind[]) {
    const n = w.dinos.filter((d) => d.species === k && !d.under && !d.caged).length;
    if (n >= CFG[k].keep) continue;
    // the first ones are there from the start; after that, one every so often
    if ((l.next[k] ?? 0) > w.elapsed && n > 0) continue;
    l.next[k] = w.elapsed + 120 + l.rng() * 120;
    // (the first ones are simply there; a newcomer turns up out of sight)
    const spot = homeSpot(w, k, l.rng, n > 0);
    if (!spot) continue;
    const many = n === 0 ? (k === "hippo" ? 3 : 3) : 1;
    for (let j = 0; j < many; j++) {
      const x = spot.x + (j ? (l.rng() - 0.5) * 60 : 0);
      const y = spot.y + (j ? (l.rng() - 0.5) * 40 : 0);
      ownDice(w, l, () => {
        const d = addDino(w, k, x, y, { growth: 1, homeX: spot.x, homeY: spot.y, hunger: 0, thirst: 0 });
        d.layT = 1e9;
      });
    }
  }
}

/** Newcomers are made with their own dice, not the world's (so they change nothing else). */
function ownDice(w: World, l: Life, fn: () => void) {
  const shared = w.rng;
  w.rng = l.rng;
  try {
    fn();
  } finally {
    w.rng = shared;
  }
}

