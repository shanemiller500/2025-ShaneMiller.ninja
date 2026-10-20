/* ------------------------------------------------------------------ */
/*  Sea hunters: Mosasaurus, Plesiosaurus + Liopleurodon (a pliosaur). */
/*                                                                     */
/*  Not friendly. They hunt anything that comes to the water's edge:   */
/*  people (fishers most of all), Neanderthals, and other dinosaurs    */
/*  that wade in to drink. And they're patient about it: a hunter      */
/*  picks its prey, sinks low and glides in under the surface to the   */
/*  deep water right by it (a dark shape and a few ripples are all     */
/*  you see), waits… then bursts out, grabs, and drags it under.       */
/*                                                                     */
/*  A plesiosaur's long neck reaches furthest up the bank; a pliosaur  */
/*  has the biggest bite. After a kill they go quiet for a while.      */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { emote, setState, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { killHuman } from "./rivals";
import { MAP_H, MAP_W, T, TILE, type Brute, type Dino, type Human, type SpeciesId } from "./types";
import type { World } from "./world";

export const SEA_HUNTERS = new Set<SpeciesId>(["mosa", "plesio", "plio"]);
export const isSeaHunter = (d: Dino) => SEA_HUNTERS.has(d.species);

/** How far up the bank it can strike from the deep water. */
export const reachOf = (d: Dino) => (d.species === "plesio" ? 95 : d.species === "plio" ? 72 : 62) + sizeOf(d) * 0.08;
/** It must wait in ambush this long before striking. */
export const STALK_MIN = 3;

type Prey = { kind: "human"; h: Human } | { kind: "brute"; b: Brute } | { kind: "dino"; d: Dino };
const pos = (p: Prey) => (p.kind === "human" ? p.h : p.kind === "brute" ? p.b : p.d);

/** The nearest deep-water tile centre within r of (x, y) (where it can lie in wait). */
export function deepNear(w: World, x: number, y: number, r: number): { x: number; y: number } | null {
  const tx0 = Math.max(0, Math.floor((x - r) / TILE));
  const tx1 = Math.min(MAP_W - 1, Math.floor((x + r) / TILE));
  const ty0 = Math.max(0, Math.floor((y - r) / TILE));
  const ty1 = Math.min(MAP_H - 1, Math.floor((y + r) / TILE));
  let best: { x: number; y: number } | null = null;
  let bd = r;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d >= bd || w.terrain.tileAt(cx, cy) !== T.Deep) continue;
      bd = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

function preyById(w: World, kind: Prey["kind"], id: number): Prey | null {
  if (kind === "human") {
    const h = w.humans.find((x) => x.id === id);
    return h && catchable(h) ? { kind, h } : null;
  }
  if (kind === "brute") {
    const b = w.rivals.byId(id);
    return b && b.hp > 0 && !b.snatched && !b.falling ? { kind, b } : null;
  }
  const d = w.dinoById(id);
  return d && d.health > 0 && !d.under ? { kind, d } : null;
}

/** A person it can get at: on the ground (no children: they're too quick and it never goes for them). */
const catchable = (h: Human) => !h.child && !h.aloft && !h.under && !h.captive && !h.snatched && !h.falling && !h.riding && !h.level && h.z <= 1;

/** Pick something at the water's edge worth stalking. */
function pickPrey(w: World, d: Dino): { p: Prey; spot: { x: number; y: number } } | null {
  const range = sp(d.species).sense * 1.6;
  const reach = reachOf(d);
  let best: { p: Prey; spot: { x: number; y: number } } | null = null;
  let bs = -Infinity;
  const consider = (p: Prey, bonus: number) => {
    const at = pos(p);
    const far = Math.hypot(at.x - d.x, at.y - d.y);
    if (far > range) return;
    const spot = deepNear(w, at.x, at.y, reach);
    if (!spot) return;
    const s = bonus - far * 0.4;
    if (s > bs) {
      bs = s;
      best = { p, spot };
    }
  };
  for (const h of w.humans) if (catchable(h)) consider({ kind: "human", h }, (h.state === "fish" ? 260 : 120) + (h.hp < 0.5 ? 40 : 0));
  for (const b of w.rivals.brutes) if (b.hp > 0 && !b.snatched && !b.falling && !b.captive && b.weapon !== "catapult") consider({ kind: "brute", b }, 100);
  for (const o of w.dinos) {
    if (o === d || o.under || isSeaHunter(o) || sp(o.species).move !== "walk" || sizeOf(o) > sizeOf(d) * 1.2) continue;
    consider({ kind: "dino", d: o }, (o.state === "drink" ? 140 : 60) - sizeOf(o) * 0.2);
  }
  return best;
}

/** The hunter's brain (true = it's busy hunting). */
export function seaHuntThink(w: World, d: Dino): boolean {
  if (!isSeaHunter(d)) return false;
  d.huntCd = Math.max(0, (d.huntCd ?? 0) - d.think);
  const hunt = d.seaHunt;
  if (hunt) {
    if (d.state === "lunge") return true;
    const p = preyById(w, hunt.kind, hunt.prey);
    // it walked off, or it's taking too long: give up
    if (!p || d.stateT > 45 || d.stuckT > 2.5) {
      d.seaHunt = undefined;
      d.huntCd = 12;
      setState(d, "wander", d.x, d.y);
      return true;
    }
    const at = pos(p);
    const spot = deepNear(w, at.x, at.y, reachOf(d));
    if (!spot) {
      d.seaHunt = undefined;
      d.huntCd = 8;
      setState(d, "wander", d.x, d.y);
      return true;
    }
    hunt.sx = spot.x;
    hunt.sy = spot.y;
    if (d.state !== "stalk" || Math.hypot(d.tx - spot.x, d.ty - spot.y) > 40) setState(d, "stalk", spot.x, spot.y);
    // in position, and it has waited long enough: strike
    const close = Math.hypot(d.x - spot.x, d.y - spot.y) < 46;
    hunt.wait = close ? (hunt.wait ?? 0) + d.think : 0;
    if (close && (hunt.wait ?? 0) >= STALK_MIN) lunge(w, d, p);
    return true;
  }
  if ((d.huntCd ?? 0) > 0 || (d.hunger < 0.2 && w.rng() < 0.6)) return false;
  const pick = pickPrey(w, d);
  if (!pick) return false;
  const p = pick.p;
  d.seaHunt = { kind: p.kind, prey: p.kind === "human" ? p.h.id : p.kind === "brute" ? p.b.id : p.d.id, sx: pick.spot.x, sy: pick.spot.y, wait: 0 };
  setState(d, "stalk", pick.spot.x, pick.spot.y);
  return true;
}

function lunge(w: World, d: Dino, p: Prey) {
  setState(d, "lunge", d.x, d.y);
  const at = pos(p);
  d.dir = at.x > d.x ? 1 : -1;
  w.particles.burst(P.Splash, d.x, d.y, 22, 110, { vz: 140, g: 240, size: 4, max: 1 });
  w.sfx("splash", d.x, d.y, 1.3);
  w.sfx(sp(d.species).sound.kind, d.x, d.y, 1, sp(d.species).sound.pitch);
  if (p.kind === "human") w.alarm(at.x, at.y, 400, 1, "😱", false);
  else if (p.kind === "dino") {
    p.d.fear = 1;
    emote(p.d, "😱", 1);
  }
  if (!w.flags.has("seaHunters")) {
    w.flags.add("seaHunters");
    w.toast("🌊", `A ${sp(d.species).name} burst out of the water! Sea hunters stalk the shore from below: keep away from deep water, and never fish alone.`, at.x, at.y);
  }
}

/** Per frame: the strike itself (stalking is ordinary slow swimming). True = handled. */
export function seaHuntAct(w: World, d: Dino, dt: number): boolean {
  const hunt = d.seaHunt;
  if (!hunt) return false;
  if (d.state === "stalk") {
    // low in the water: just a few ripples give it away
    if (w.rng() < dt * 0.8) w.particles.spawn(P.Ripple, d.x + (w.rng() - 0.5) * 30, d.y, { size: 5, max: 1.2 });
    return true;
  }
  if (d.state !== "lunge") return false;
  d.vx = d.vy = 0;
  const reach = reachOf(d);
  if (hunt.back) {
    // back under with whatever it caught
    const k = Math.min(1, dt * 4);
    d.x += (hunt.sx - d.x) * k;
    d.y += (hunt.sy - d.y) * k;
    d.z = Math.max(0, d.z - dt * 80);
    if (Math.hypot(hunt.sx - d.x, hunt.sy - d.y) < 6) {
      d.x = hunt.sx;
      d.y = hunt.sy;
      d.z = 0;
      w.particles.burst(P.Splash, d.x, d.y, 14, 80, { vz: 100, g: 220, size: 4, max: 1 });
      d.seaHunt = undefined;
      setState(d, "wander", d.x, d.y);
    }
    return true;
  }
  const p = preyById(w, hunt.kind, hunt.prey);
  if (!p || d.stateT > 2.2) {
    // missed: back into the water
    hunt.back = true;
    d.huntCd = 20;
    return true;
  }
  const at = pos(p);
  // a burst of speed up the bank, never further than its reach from the water
  const sp0 = sp(d.species).run * 2.2;
  const dist = Math.hypot(at.x - d.x, at.y - d.y);
  const k = Math.min(1, (sp0 * dt) / Math.max(1, dist));
  let nx = d.x + (at.x - d.x) * k;
  let ny = d.y + (at.y - d.y) * k;
  const out = Math.hypot(nx - hunt.sx, ny - hunt.sy);
  if (out > reach) {
    nx = hunt.sx + ((nx - hunt.sx) / out) * reach;
    ny = hunt.sy + ((ny - hunt.sy) / out) * reach;
  }
  d.x = nx;
  d.y = ny;
  d.z = 6 + Math.sin(Math.min(1, d.stateT / 0.6) * Math.PI) * 26;
  d.anim += dt * 6;
  if (Math.hypot(at.x - d.x, at.y - d.y) < 28 + sizeOf(d) * 0.12) {
    seize(w, d, p);
    hunt.back = true;
    d.hunger = 0;
    d.huntCd = 90 + w.rng() * 60;
  }
  return true;
}

/** Jaws shut. */
function seize(w: World, d: Dino, p: Prey) {
  const at = pos(p);
  const who = sp(d.species).name;
  w.particles.burst(P.Splash, at.x, at.y, 26, 120, { vz: 150, g: 260, size: 4, max: 1.1 });
  w.particles.burst(P.Splash, at.x, at.y, 10, 70, { z: 10, vz: 80, size: 3, max: 0.8, color: "#b3121e" });
  w.sfx("chomp", at.x, at.y, 1.3, 0.5);
  w.shake(3, 0.3);
  if (p.kind === "human") {
    const h = p.h;
    // a strong, armed fighter can wrench free (hurt, but alive)
    const role = w.tribe.roleOf(h);
    if ((role === "guard" || role === "hunter") && h.hp > 0.6 && w.rng() < 0.35) {
      hurtHuman(w, h, 0.45, d.x, d.y, "bite");
      d.health -= 0.15;
      w.toast("💪", `${h.name} fought off a ${who} that burst out of the water!`, h.x, h.y);
      return;
    }
    killHuman(w, h, `A ${who} burst out of the water and dragged ${h.name} under${h.state === "fish" ? " while they were fishing" : ""}!`);
    return;
  }
  if (p.kind === "brute") {
    w.toast("🌊", `A ${who} dragged ${p.b.name} the Neanderthal into the water!`, at.x, at.y);
    w.rivals.kill(w, p.b);
    return;
  }
  const o = p.d;
  if (sizeOf(o) < sizeOf(d) * 0.9) {
    if (w.inView(o.x, o.y)) w.toast("🌊", `A ${who} dragged a ${sp(o.species).nick} under the water!`, o.x, o.y);
    w.removeDino(o);
  } else {
    // too big to drag under: a terrible bite, and it bolts
    o.health -= 0.4;
    o.fear = 1;
    emote(o, "😱", 1.5);
    if (o.health > 0) setState(o, "flee", o.x + (o.x - d.x) * 4, o.y + (o.y - d.y) * 4);
  }
}
