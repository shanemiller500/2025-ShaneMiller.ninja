/* ------------------------------------------------------------------ */
/*  Captured catapults.                                                */
/*                                                                     */
/*  A clan catapult can be taken: at least two of our people at it     */
/*  (one of them on foot), with none of its clan left close enough to  */
/*  defend it. Close up, our people seize it rather than smash it.     */
/*                                                                     */
/*  The one on foot who took it becomes its keeper, bonded to it for   */
/*  good: they man it whenever enemies come in range, keep it repaired */
/*  (every boulder wears it; worn out it can't throw until fixed, with */
/*  wood) and it can be upgraded (longer reach, bigger boulders,       */
/*  faster reload).                                                    */
/* ------------------------------------------------------------------ */
import { CATAPULT_RANGE } from "./clanTowns";
import { emote, setState, sizeOf } from "./dinos";
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import type { Rivals } from "./rivals";
import { sp } from "../data/species";
import type { Human, OurCatapult, Resource } from "./types";
import type { World } from "./world";

export const MAX_LEVEL = 3;
export const rangeOf = (c: OurCatapult) => CATAPULT_RANGE + (c.level - 1) * 60;
const reloadOf = (c: OurCatapult) => 7 - (c.level - 1) * 1.5;
const powerOf = (c: OurCatapult) => 0.8 + 0.4 * c.level;
const MIN_RANGE = 110;
/** wear per boulder thrown */
const WEAR = 0.035;

/** A boulder in flight from one of our catapults. */
export interface OurShot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  dur: number;
  power: number;
}

/** What the next upgrade costs. */
export function upgradeCost(c: OurCatapult): Partial<Record<Resource, number>> {
  return { wood: 8 * c.level, stone: 6 * c.level, ...(c.level >= 2 ? { iron: 3 } : {}) };
}

/** Upgrade it (returns why not, or null). */
export function upgradeCatapult(w: World, c: OurCatapult): string | null {
  if (c.level >= MAX_LEVEL) return "It's as good as it gets.";
  const cost = upgradeCost(c);
  for (const [r, n] of Object.entries(cost) as [Resource, number][]) if (w.camp.stock[r] < n) return `Needs ${n} ${r}.`;
  for (const [r, n] of Object.entries(cost) as [Resource, number][]) w.camp.stock[r] -= n;
  c.level++;
  c.wear = Math.max(0, c.wear - 0.3);
  const k = w.humans.find((h) => h.id === c.keeper);
  w.toast("🪨", `${k ? `${k.name} upgraded` : "We upgraded"} our catapult to level ${c.level}: it throws further, harder and faster.`, c.x, c.y);
  return null;
}

/** Once a second: two of ours at an undefended clan catapult take it. */
export function seizeTick(w: World, r: Rivals) {
  for (const b of [...r.brutes]) {
    if (b.weapon !== "catapult" || b.hp <= 0) continue;
    const near = w.humans.filter((h) => !h.child && !h.captive && !h.stranger && !h.aloft && h.state !== "down" && h.hp > 0.2 && Math.hypot(h.x - b.x, h.y - b.y) < 52);
    const onFoot = near.filter((h) => !h.riding);
    if (near.length < 2 || !onFoot.length) continue;
    if (r.brutes.some((o) => o !== b && o.clan === b.clan && o.weapon !== "catapult" && o.hp > 0 && !o.captive && Math.hypot(o.x - b.x, o.y - b.y) < 140)) continue;
    const keeper = onFoot.find((h) => !h.catapult) ?? onFoot[0];
    const clan = r.clan(b.clan);
    r.brutes.splice(r.brutes.indexOf(b), 1);
    w.events.push({ type: "removed", id: b.id });
    const c: OurCatapult = { id: w.nextId(), x: b.x, y: b.y, dir: b.dir, keeper: keeper.id, level: 1, wear: 0.25, cd: 3, anim: 0 };
    r.taken.push(c);
    keeper.catapult = c.id;
    say(keeper, "She's ours now!");
    w.sfx("cheer", c.x, c.y, 0.8);
    w.toast("🪨", `We seized the ${clan?.name ?? "clan"} catapult! ${keeper.name} took it and is its keeper for good: they'll crew it, repair it and upgrade it.`, c.x, c.y);
    w.celebrate("Catapult!");
  }
}

/** Something worth a boulder near one of our catapults. */
function targetFor(w: World, r: Rivals, c: OurCatapult): { x: number; y: number; vx: number; vy: number } | null {
  const reach = rangeOf(c);
  let best: { x: number; y: number; vx: number; vy: number } | null = null;
  let bd = reach;
  const consider = (x: number, y: number, vx: number, vy: number) => {
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < MIN_RANGE || d > bd) return;
    // never lob it onto our own people
    if (w.humans.some((h) => !h.captive && Math.hypot(h.x - x, h.y - y) < 50)) return;
    bd = d;
    best = { x, y, vx, vy };
  };
  for (const b of r.brutes) if (b.hp > 0 && !b.snatched && !b.falling && r.hostile(w, b)) consider(b.x, b.y, b.vx, b.vy);
  for (const d of w.dinos) if (d.raider && !d.under) consider(d.x, d.y, d.vx, d.vy);
  for (const dr of w.dragons.list) if (dr.z < 140 && dr.state !== "perch") consider(dr.x, dr.y, dr.vx, dr.vy);
  return best;
}

/** A keeper's own business: man it when enemies come in range, keep it repaired. True = busy with it. */
export function keeperThink(w: World, h: Human): boolean {
  const c = w.rivals.taken.find((x) => x.id === h.catapult);
  if (!c) {
    h.catapult = undefined;
    return false;
  }
  if (h.riding || h.aloft || h.captive) return false;
  const spot = { x: c.x - c.dir * 26, y: c.y + 8 };
  const there = Math.hypot(h.x - spot.x, h.y - spot.y) < 14;
  const enemy = targetFor(w, w.rivals, c);
  const fix = c.wear > 0.5 && w.camp.stock.wood >= 1;
  if (!enemy && !fix) return false;
  if (!there) {
    go(h, "walk", spot.x, spot.y);
    if (enemy && h.stateT < 0.1) say(h, "To the catapult!");
    return true;
  }
  h.dir = c.dir;
  if (fix && !enemy) {
    w.camp.stock.wood -= 1;
    c.wear = Math.max(0, c.wear - 0.25);
    go(h, "build", h.x, h.y);
    h.think = 2.5;
    if (h.stateT < 0.1 || w.rng() < 0.3) say(h, pick(w.rng, ["Fixing her up.", "New rope…", "There. Good as new."]));
    if (c.wear < 0.05 && w.rng() < 0.5) w.particles.burst(P.Star, c.x, c.y - 20, 4, 30, { z: 20, size: 5, max: 0.7 });
    return true;
  }
  go(h, "watch", h.x, h.y);
  return true;
}

/** Every frame: crewed catapults throw at whatever's in range; boulders fly + land. */
export function ourCatapultsUpdate(w: World, r: Rivals, dt: number) {
  for (const c of r.taken) {
    c.cd = Math.max(0, c.cd - dt);
    c.anim = Math.max(0, c.anim - dt * 1.5);
    let k = w.humans.find((h) => h.id === c.keeper) ?? null;
    if (!k) {
      // its keeper is gone: someone else takes it on
      const next = w.humans.filter((h) => !h.child && !h.captive && !h.stranger && !h.catapult).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      c.keeper = next?.id ?? 0;
      if (next) {
        next.catapult = c.id;
        w.toast("🪨", `${next.name} is our catapult's new keeper.`, c.x, c.y);
      }
      k = next ?? null;
    }
    if (!k || k.captive || k.state === "down" || Math.hypot(k.x - c.x, k.y - c.y) > 70 || c.cd > 0) continue;
    if (c.wear >= 1) {
      if (!w.flags.has(`catWorn${c.id}`)) {
        w.flags.add(`catWorn${c.id}`);
        w.toast("🔧", `Our catapult is worn out and can't throw until ${k.name} repairs it (needs wood).`, c.x, c.y);
      }
      continue;
    }
    w.flags.delete(`catWorn${c.id}`);
    const t = targetFor(w, r, c);
    if (!t) continue;
    const flight = 2.1;
    const tx = t.x + t.vx * flight * 0.6 + (w.rng() - 0.5) * 24;
    const ty = t.y + t.vy * flight * 0.6 + (w.rng() - 0.5) * 16;
    c.dir = tx > c.x ? 1 : -1;
    r.ourShots.push({ x: c.x, y: c.y, z: 30, vx: (tx - c.x) / flight, vy: (ty - c.y) / flight, vz: (10 - 30) / flight + 0.5 * 260 * flight, t: 0, dur: flight, power: powerOf(c) });
    c.cd = reloadOf(c);
    c.anim = 1;
    c.wear = Math.min(1, c.wear + WEAR);
    w.sfx("thud", c.x, c.y, 0.9, 0.55);
    if (w.rng() < 0.25) say(k, pick(w.rng, ["Loose!", "Take that!", "Fire!"]));
  }
  for (const s of [...r.ourShots]) {
    s.t += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vz -= 260 * dt;
    s.z += s.vz * dt;
    if (s.t < s.dur && s.z > 0) continue;
    r.ourShots.splice(r.ourShots.indexOf(s), 1);
    land(w, r, s);
  }
}

function land(w: World, r: Rivals, s: OurShot) {
  w.particles.burst(P.Rock, s.x, s.y, 10, 70, { z: 20, size: 5, max: 0.8, color: "#8f877a" });
  w.particles.burst(P.Dust, s.x, s.y, 6, 50, { size: 14, max: 1, color: "rgba(150,130,100,0.6)" });
  w.sfx("boom", s.x, s.y, 0.8, 0.9);
  w.shake(2, 0.2);
  for (const b of [...r.brutes]) if (b.hp > 0 && Math.hypot(b.x - s.x, b.y - s.y) < 44) r.hit(w, b, 0.45 * s.power, s.x, s.y, true, "boulder");
  for (const d of w.dinos) {
    if (!d.raider || Math.hypot(d.x - s.x, d.y - s.y) > 40 + sizeOf(d) * 0.3) continue;
    d.health -= 0.3 * s.power;
    d.fear = 1;
    emote(d, "😵", 1);
    if (sp(d.species).move === "walk" && d.state !== "flee") setState(d, "flee", d.x + (d.x - s.x) * 3, d.y + (d.y - s.y) * 3);
  }
  for (const dr of [...w.dragons.list]) if (dr.z < 160 && Math.hypot(dr.x - s.x, dr.y - s.y) < 60) w.dragons.hit(w, dr, 260 * s.power);
}
