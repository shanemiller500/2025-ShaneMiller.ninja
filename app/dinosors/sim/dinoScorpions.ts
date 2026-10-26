/* ------------------------------------------------------------------ */
/*  Dinosaur Scorpions: rare fantasy giants (species "dinoScorpion").  */
/*                                                                     */
/*  NOT the Scorpion war machine (colony.scorpions): this is a beast.  */
/*  Each one guards a den in rocky desert, the dunes or the volcano's  */
/*  lava fields. Anything that walks into its territory (dinosaurs,    */
/*  our people, Neanderthals, Tree / Sea / Sand People) gets a threat  */
/*  display, then a charge: pincers up close, and a venom tail strike  */
/*  that leaves the victim dizzy and slow. It never chases far from    */
/*  its den, and goes back to it once the intruder is gone. Hungry, it */
/*  hunts camels + small dinosaurs near home.                          */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { emote, setState, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { pick } from "./rng";
import { REGION } from "./terrain";
import { MAP_W, T, TILE, type Brute, type Dino, type Human } from "./types";
import type { World } from "./world";
import { hitDino } from "./tribe";

export const SCORPION_SPECIES = "dinoScorpion" as const;
/** how far from its den it treats anything as an intruder (px) */
export const DEN_R = 300;
/** it gives up a chase this far from its den */
const LEASH = 620;
/** seconds between pincer snaps / tail strikes */
const CLAW_CD = 1.1;
const STING_CD = 3.4;
/** how long the venom leaves a victim dizzy + slow (s) */
export const VENOM_FOR = 5;

type Prey = { kind: "human"; h: Human } | { kind: "dino"; d: Dino } | { kind: "brute"; b: Brute };

const posOf = (p: Prey) => (p.kind === "human" ? p.h : p.kind === "dino" ? p.d : p.b);
const idOf = (p: Prey) => posOf(p).id;

export const isDinoScorpion = (d: Dino) => d.species === SCORPION_SPECIES;

/** Ground a Dinosaur Scorpion likes for its den. */
export function denGround(w: World, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const t = w.terrain.tileAt(x, y);
  const reg = w.terrain.region[ty * MAP_W + tx];
  return t === T.Rock || t === T.Basalt || t === T.Volcano || t === T.Dune || (t === T.Sand && reg === REGION.desert);
}

function intruder(w: World, d: Dino, r: number): Prey | null {
  const dx = d.homeX;
  const dy = d.homeY;
  let best: Prey | null = null;
  let bd = r;
  for (const h of w.humans) {
    if (h.under || h.aloft || h.captive || h.state === "down" || h.state === "hide" || h.falling) continue;
    const dist = Math.hypot(h.x - dx, h.y - dy);
    if (dist < bd) {
      bd = dist;
      best = { kind: "human", h };
    }
  }
  for (const b of w.rivals.brutes) {
    if (b.hp <= 0 || b.snatched || b.falling || (b.up ?? 0) > 0 || b.z > 20) continue;
    const dist = Math.hypot(b.x - dx, b.y - dy);
    if (dist < bd) {
      bd = dist;
      best = { kind: "brute", b };
    }
  }
  for (const o of w.dinos) {
    if (o === d || o.under || o.species === SCORPION_SPECIES || o.state === "faint" || sp(o.species).move !== "walk") continue;
    const dist = Math.hypot(o.x - dx, o.y - dy);
    if (dist < bd) {
      bd = dist;
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
  const d = w.dinoById(id);
  return d && d.state !== "faint" ? { kind: "dino", d } : null;
}

/** Its brain (thinkDino hands it over). Returns true when it decided something. */
export function scorpionThink(w: World, d: Dino): boolean {
  if (d.owner || d.rider) return false;
  if (d.state === "faint" || d.state === "knocked" || d.state === "carried") return false;
  const home = { x: d.homeX, y: d.homeY };
  const fromDen = Math.hypot(d.x - home.x, d.y - home.y);
  // already after something: keep at it unless it's left the territory (or we've chased too far)
  if (d.state === "chase" && d.targetId) {
    const p = preyById(w, d.targetId);
    const pp = p ? posOf(p) : null;
    if (p && pp && Math.hypot(pp.x - home.x, pp.y - home.y) < DEN_R * 1.8 && fromDen < LEASH) return true;
    d.targetId = 0;
    setState(d, "wander", home.x + (w.rng() - 0.5) * 80, home.y + (w.rng() - 0.5) * 50);
    emote(d, "😤", 1.6);
    return true;
  }
  // intruder in the territory: rear up (a roar), then charge
  const foe = intruder(w, d, DEN_R);
  if (foe) {
    const fp = posOf(foe);
    d.targetId = idOf(foe);
    if (d.state !== "roar" && d.state !== "chase") {
      setState(d, "roar", d.x, d.y);
      d.dir = fp.x > d.x ? 1 : -1;
      emote(d, "❗", 1.4);
      w.sfx("hiss", d.x, d.y, 1, 0.35);
      if (foe.kind === "human" && !w.flags.has("dinoScorpionSeen")) {
        w.flags.add("dinoScorpionSeen");
        w.toast("🦂", `A giant Dinosaur Scorpion! It guards its den here and attacks anything that comes too close. Its tail sting leaves you dizzy: keep away, or bring plenty of spears.`, d.x, d.y);
        w.discover("dinoScorpion", d.x, d.y);
      }
    }
    return true;
  }
  // hungry: hunt something small near home (camels, little dinosaurs)
  if (d.hunger > 0.6) {
    const prey = w.dinos.find((o) => o !== d && !o.owner && o.species !== SCORPION_SPECIES && sp(o.species).move === "walk" && sizeOf(o) < 100 && Math.hypot(o.x - home.x, o.y - home.y) < LEASH);
    if (prey) {
      d.targetId = prey.id;
      setState(d, "chase", prey.x, prey.y);
      return true;
    }
  }
  // night: dig in at the den
  if (w.daylight < 0.25) {
    if (fromDen > 40) setState(d, "wander", home.x, home.y);
    else if (d.state !== "sleep") setState(d, "sleep", d.x, d.y);
    return true;
  }
  if (d.state === "sleep") setState(d, "idle", d.x, d.y);
  // patrol the den on its favourite ground
  if (d.state === "wander" && Math.hypot(d.tx - d.x, d.ty - d.y) > 12 && d.stateT < 20) return true;
  if (d.state === "idle" && d.stateT < 4 + (d.id % 4)) return true;
  for (let k = 0; k < 6; k++) {
    const a = w.rng() * Math.PI * 2;
    const r = 40 + w.rng() * DEN_R * 0.6;
    const x = home.x + Math.cos(a) * r;
    const y = home.y + Math.sin(a) * r * 0.7;
    if (denGround(w, x, y) && w.nav.passable("dino", x, y)) {
      setState(d, "wander", x, y);
      return true;
    }
  }
  setState(d, "idle", d.x, d.y);
  return true;
}

/** Per frame (actDino hands it over while it's roaring or charging). Returns true when it handled the frame. */
export function scorpionAct(w: World, d: Dino, dt: number): boolean {
  if (d.owner) return false;
  d.stingCd = Math.max(0, (d.stingCd ?? 0) - dt);
  d.clawCd = Math.max(0, (d.clawCd ?? 0) - dt);
  d.strike = Math.max(0, (d.strike ?? 0) - dt * 1.6);
  if (d.state === "roar") {
    d.vx *= 0.8;
    d.vy *= 0.8;
    d.strike = Math.max(d.strike ?? 0, 0.6 + Math.sin(d.stateT * 9) * 0.2);
    if (d.stateT > 1.1) {
      const p = d.targetId ? preyById(w, d.targetId) : null;
      if (!p) setState(d, "idle", d.x, d.y);
      else {
        const pp = posOf(p);
        setState(d, "chase", pp.x, pp.y);
        w.sfx("roar", d.x, d.y, 0.9, 0.3);
      }
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
  const reach = sizeOf(d) * 0.55;
  if (dist < reach) {
    d.dir = pp.x > d.x ? 1 : -1;
    d.vx *= 0.7;
    d.vy *= 0.7;
    // the tail strike: a long reach, venom that leaves them dizzy
    if (!d.stingCd) {
      d.stingCd = STING_CD;
      d.strike = 1;
      sting(w, d, p);
    } else if (!d.clawCd) {
      d.clawCd = CLAW_CD;
      d.strike = Math.max(d.strike ?? 0, 0.5);
      claw(w, d, p);
    }
  }
  // tired of a long chase
  if (d.stateT > 25) {
    d.targetId = 0;
    setState(d, "wander", d.homeX, d.homeY);
  }
  return true;
}

function claw(w: World, d: Dino, p: Prey) {
  const pp = posOf(p);
  w.sfx("chomp", pp.x, pp.y, 0.9, 0.5);
  w.particles.burst(P.Dust, pp.x, pp.y, 5, 50, { size: 8, max: 0.6, color: "rgba(215,190,150,0.7)" });
  if (p.kind === "human") {
    hurtHuman(w, p.h, 0.3, d.x, d.y, "bite");
    p.h.fear = 1;
  } else if (p.kind === "dino") hitDino(w, p.d, 38, d.x, d.y);
  else w.rivals.hit(w, p.b, 0.28, d.x, d.y, true);
}

function sting(w: World, d: Dino, p: Prey) {
  const pp = posOf(p);
  w.sfx("whoosh", d.x, d.y, 0.8, 0.6);
  w.particles.burst(P.Spark, pp.x, pp.y, 8, 70, { z: 20, size: 3, max: 0.6, color: sp(d.species).look.accent });
  w.particles.burst(P.Poof, pp.x, pp.y, 4, 30, { z: 14, size: 9, max: 0.9, color: "rgba(190,230,90,0.55)" });
  if (p.kind === "human") {
    hurtHuman(w, p.h, 0.22, d.x, d.y, "bite");
    p.h.slowT = VENOM_FOR;
    p.h.bubble = { text: pick(w.rng, ["So… dizzy…", "Stung!", "Everything's spinning!"]), t: 2 };
  } else if (p.kind === "dino") {
    hitDino(w, p.d, 30, d.x, d.y);
    p.d.slowT = VENOM_FOR;
    emote(p.d, "💫", 2);
  } else {
    w.rivals.hit(w, p.b, 0.22, d.x, d.y, true);
    p.b.slowT = VENOM_FOR;
  }
}

/** A den spot for a new Dinosaur Scorpion near (x, y) (px), or null. */
export function denNear(w: World, x: number, y: number, r = 400) {
  for (let k = 0; k < 60; k++) {
    const a = w.rng() * Math.PI * 2;
    const rr = Math.sqrt(w.rng()) * r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (denGround(w, px, py) && w.nav.passable("dino", px, py)) return { x: px, y: py };
  }
  return null;
}
