/* ------------------------------------------------------------------ */
/*  The great beasts: Yetis and Dinosaur Scorpions.                    */
/*                                                                     */
/*  Each lives in a den you can see: a Yeti in an ice cave high on the */
/*  peaks (snowBeasts.yetiDens), a Dinosaur Scorpion in a burrow under */
/*  a rock slab. They are what the tribe is afraid of:                 */
/*                                                                     */
/*   • at night a Yeti howls from its cave mouth. The howl carries a   */
/*     long way: everyone who hears it is frightened, children run     */
/*     indoors, and the camp's dread grows;                            */
/*   • nobody goes near a den of their own accord. People with nothing */
/*     to do there turn round and hurry away (people you send, and     */
/*     hunting parties, still go);                                     */
/*   • dread fades slowly, and lifts when a beast is killed or caged.  */
/*                                                                     */
/*  So the answer to a Yeti is an expedition (chariots.ts): a party    */
/*  goes up to the den to kill it, or to net it and bring it home to   */
/*  the zoo (zoo.ts).                                                  */
/*                                                                     */
/*  Nothing here uses the world's dice (the rest of the world plays    */
/*  out the same), and none of it is saved: dread starts again at 0.   */
/* ------------------------------------------------------------------ */
import { addDino, emote } from "./dinos";
import { denGround, denNear } from "./dinoScorpions";
import { go, say, shelterSpot } from "./humans";
import { P } from "./particles";
import { inCave, yetiDenOf, yetiDens } from "./snowBeasts";
import { TILE, type Dino, type Human } from "./types";
import type { World } from "./world";

export const isBigGame = (d: Pick<Dino, "species">) => d.species === "yeti" || d.species === "dinoScorpion";
/** Still out there: not ours, not netted, not down. */
export const wildBeast = (d: Dino) => isBigGame(d) && !d.owner && !d.caged && !d.netted && d.health > 0 && d.state !== "faint";
export const beastName = (d: Pick<Dino, "species">) => (d.species === "yeti" ? "Yeti" : "Dinosaur Scorpion");

/** People with no business there keep this far from a den (px). */
export const FEAR_R = 430;
/** How far a Yeti's howl carries (px). */
export const HOWL_R = 2000;
/** Where the Dinosaur Scorpions' dens are looked for (tiles): a lost one is replaced here, slowly. */
const SCORPION_HAUNTS: [number, number][] = [[196, 64], [167, 58], [138, 44]];
const SCORPION_BACK = 900;

export interface Den {
  kind: "yeti" | "scorpion";
  x: number;
  y: number;
  /** the beast living there now (null = empty) */
  beast: Dino | null;
  /** it's inside, asleep: only its eyes show */
  asleep: boolean;
}

/** Every den in the world: all the Yeti caves (lived in or not) and each wild Dinosaur Scorpion's burrow. */
export function beastDens(w: World): Den[] {
  const out: Den[] = yetiDens(w).map((p) => ({ kind: "yeti" as const, x: p.x, y: p.y, beast: null, asleep: false }));
  for (const d of w.dinos) {
    if (!wildBeast(d) && !(isBigGame(d) && d.netted)) continue;
    if (d.owner) continue;
    if (d.species === "yeti") {
      const den = yetiDenOf(w, d);
      const slot = den ? out.find((o) => o.kind === "yeti" && o.x === den.x && o.y === den.y) : null;
      if (slot && !d.netted) {
        slot.beast = d;
        slot.asleep = inCave(w, d);
      }
    } else if (!d.netted && denGround(w, d.homeX, d.homeY)) {
      out.push({ kind: "scorpion", x: d.homeX, y: d.homeY, beast: d, asleep: d.state === "sleep" && Math.hypot(d.x - d.homeX, d.y - d.homeY) < 50 });
    }
  }
  return out;
}

/** The den this beast lives in (null = none: a stray). */
export function denOf(w: World, d: Dino): { x: number; y: number } | null {
  if (d.species === "yeti") return yetiDenOf(w, d);
  return d.species === "dinoScorpion" && denGround(w, d.homeX, d.homeY) ? { x: d.homeX, y: d.homeY } : null;
}

/* ------------------------------ dread ------------------------------ */

interface Mood {
  dread: number;
  acc: number;
  howlAt: Map<number, number>;
  backAt: number;
}
const moods = new WeakMap<World, Mood>();
function moodOf(w: World) {
  let m = moods.get(w);
  if (!m) moods.set(w, (m = { dread: 0, acc: 0, howlAt: new Map(), backAt: 0 }));
  return m;
}

/** 0..1: how frightened the camp is of the beasts right now. */
export const dreadOf = (w: World) => moodOf(w).dread;
export function addDread(w: World, n: number) {
  const m = moodOf(w);
  m.dread = Math.max(0, Math.min(1, m.dread + n));
}
export function dreadLabel(n: number) {
  return n >= 0.7 ? "Terrified" : n >= 0.4 ? "Frightened" : n >= 0.15 ? "Uneasy" : "Calm";
}

const HOWL_LINES = ["Did you hear that?!", "The Yeti…", "It's awake up there.", "I'm not going near the peaks.", "Brr. That howl.", "Somebody should deal with that thing."];
const CHILD_LINES = ["Mummy!", "The Yeti's coming!", "I want to go inside!"];
const AWAY_LINES = ["Not near its cave!", "Nope. Not going in there.", "That's the beast's den!", "Back, back, back!"];

/** A long howl from the cave mouth: everyone in earshot is frightened, children run for home. */
export function howl(w: World, d: Dino) {
  emote(d, "🌙", 2.4);
  w.sfx("roar", d.x, d.y, 1.4, 0.3);
  w.particles.spawn(P.Ring, d.x, d.y, { z: 34, size: 26, max: 1.8, color: "rgba(205,228,255,0.7)" });
  w.particles.spawn(P.Ring, d.x, d.y, { z: 34, size: 12, max: 1.2, color: "rgba(205,228,255,0.9)" });
  let heard = 0;
  const beat = Math.floor(w.elapsed);
  for (const h of w.humans) {
    if (h.stranger || h.under || h.aloft || h.captive || h.hung || h.state === "down") continue;
    const dist = Math.hypot(h.x - d.x, h.y - d.y);
    if (dist > HOWL_R) continue;
    heard++;
    h.fear = Math.max(h.fear, 0.3 + (1 - dist / HOWL_R) * 0.6);
    const indoors = h.state === "hide" || h.state === "sleep";
    if (h.child) {
      if (!indoors && !h.taskId) {
        const s = shelterSpot(w, h);
        go(h, "flee", s.x, s.y);
        say(h, CHILD_LINES[(h.id + beat) % CHILD_LINES.length]);
      }
    } else if (!indoors && (h.id + beat) % 3 === 0) say(h, HOWL_LINES[(h.id + beat) % HOWL_LINES.length]);
  }
  if (!heard) return;
  addDread(w, 0.08);
  if (!w.flags.has("yetiHowl")) {
    w.flags.add("yetiHowl");
    w.toast("🌙", "A long howl rolls down from the peaks: a Yeti, in its ice cave high on the snow. People are frightened of it and won't go near its den unless you send them. Send a hunting party up to kill it, or build a zoo enclosure and bring it back alive.", d.x, d.y);
  }
}

/**
 * Nobody wanders up to a den: someone with nothing to do there turns round and hurries off.
 * (People on a job, under orders, on a hunt, or going to cut a friend down still go.) True = handled.
 */
export function dreadThink(w: World, h: Human): boolean {
  if (h.stranger || h.captive || h.under || h.aloft || h.riding || h.chariot || h.hung || h.yetiHeld) return false;
  if (h.taskId || h.order || h.rally || h.selfHealing) return false;
  if (h.state === "down" || h.state === "hide" || h.state === "sleep" || h.state === "hunt" || h.state === "aim" || h.state === "heal") return false;
  if (w.colony.hunt?.crew.some((m) => m.id === h.id)) return false;
  for (const d of w.dinos) {
    if (!wildBeast(d)) continue;
    const den = denOf(w, d);
    if (!den) continue;
    const dist = Math.hypot(h.x - den.x, h.y - den.y);
    if (dist > FEAR_R) continue;
    // it's already after someone: fighting back / running is decided elsewhere
    if (d.state === "chase" || d.state === "roar") return false;
    // a friend hanging from its tree: they go in anyway (snowBeasts.rescueHungThink)
    if (w.humans.some((o) => o.hung)) return false;
    const a = dist > 4 ? Math.atan2(h.y - den.y, h.x - den.x) : Math.atan2(w.camp.y - den.y, w.camp.x - den.x);
    let x = den.x + Math.cos(a) * (FEAR_R + 150);
    let y = den.y + Math.sin(a) * (FEAR_R + 150);
    if (!w.nav.passable("human", x, y)) {
      const b = Math.atan2(w.camp.y - den.y, w.camp.x - den.x);
      x = h.x + Math.cos(b) * 260;
      y = h.y + Math.sin(b) * 260;
    }
    h.fear = 1;
    if (h.state !== "walk" || Math.hypot(h.tx - x, h.ty - y) > 60) {
      go(h, "walk", x, y);
      say(h, AWAY_LINES[(h.id + Math.floor(w.elapsed)) % AWAY_LINES.length]);
    }
    return true;
  }
  return false;
}

/** A great beast has been killed: the camp breathes again. (From tribe.downDino.) */
export function beastDown(w: World, d: Dino) {
  if (!isBigGame(d) || d.owner) return;
  addDread(w, -1);
  w.discover("beastHunt", d.x, d.y);
  w.toast("🏆", `The ${beastName(d)} is dead! ${d.species === "yeti" ? "Its cave stands empty (until another comes down from the high snow, one day)." : "Its den is quiet."} Harvest it: a beast that size gives a lot of hide, bone and teeth. The whole camp sleeps easier.`, d.x, d.y);
  for (const h of w.humans) if (!h.stranger) h.fear = 0;
}

/** Once a second: howls in the night, dread fading, a lost Dinosaur Scorpion replaced in the end. */
export function beastsTick(w: World, dt: number) {
  const m = moodOf(w);
  m.acc += dt;
  if (m.acc < 1) return;
  const step = m.acc;
  m.acc = 0;
  m.dread = Math.max(0, m.dread - 0.0025 * step);
  const night = w.daylight < 0.3;
  let scorpions = 0;
  for (const d of w.dinos) {
    if (d.species === "dinoScorpion" && !d.caged) scorpions++;
    if (d.species !== "yeti" || !wildBeast(d) || !yetiDenOf(w, d)) continue;
    if (!night) {
      m.howlAt.delete(d.id);
      continue;
    }
    // at the cave (asleep in it, or standing at its mouth): the first howl a little after dark, then every couple of minutes
    if (Math.hypot(d.x - d.homeX, d.y - d.homeY) > 60 || d.state === "chase" || d.state === "roar") continue;
    const at = m.howlAt.get(d.id);
    if (at === undefined) m.howlAt.set(d.id, w.elapsed + 8 + (d.id % 5) * 6);
    else if (w.elapsed >= at) {
      m.howlAt.set(d.id, w.elapsed + 95 + (d.id % 7) * 13);
      howl(w, d);
    }
  }
  // the desert keeps its monsters: one that was killed (or carried off to the zoo) is replaced after a long while, out of sight
  if (!w.wildlife.enabled || scorpions >= SCORPION_HAUNTS.length || !w.flags.has("dinoScorpionSeen")) {
    m.backAt = 0;
    return;
  }
  if (!m.backAt) m.backAt = w.elapsed + SCORPION_BACK;
  if (w.elapsed < m.backAt) return;
  m.backAt = 0;
  for (const [tx, ty] of SCORPION_HAUNTS) {
    const x = tx * TILE;
    const y = ty * TILE;
    if (w.inView(x, y, 500) || w.dinos.some((d) => d.species === "dinoScorpion" && !d.caged && Math.hypot(d.homeX - x, d.homeY - y) < 700)) continue;
    const den = denNear(w, x, y, 380);
    if (!den) continue;
    const d = addDino(w, "dinoScorpion", den.x, den.y, { growth: 1 });
    d.homeX = den.x;
    d.homeY = den.y;
    return;
  }
}
