/* ------------------------------------------------------------------ */
/*  War chariots + the chariot dragon hunt.                            */
/*                                                                     */
/*  A war chariot (built like any building; it rolls out when it's     */
/*  finished) is a big timber fighting wagon drawn by one of our tamed */
/*  Triceratops, a huge trike skull on its prow, a Scorpion on top at  */
/*  the front and another at the back that aim + shoot by themselves,  */
/*  and room for 10: five spearmen down each side behind hide-and-bone */
/*  shields, throwing nasty barbed spears while they're protected      */
/*  (egg runners ride inside too, safe until it's time to dash).       */
/*                                                                     */
/*  The hunt is an event you win or lose:                              */
/*   1. muster: everyone boards; nobody leaves till all are aboard     */
/*      (whoever doesn't fit marches on foot beside them);             */
/*   2. march: out to the nest. Clans along the way pelt the chariots  */
/*      (sometimes they hit), and the crews shoot back;                */
/*   3. surround: the chariots take up the formation round the nest    */
/*      (a ring, a pincer from both flanks, or a wedge);               */
/*   4. battle: Scorpions + spears from every side at the dragon. Once */
/*      it's hurt or busy, the runners jump down, grab the eggs and    */
/*      get back aboard. Won: the eggs are ours / the dragon's beaten. */
/*      Lost: too many fallen, or every chariot smashed.               */
/*   5. home: back to camp, eggs to the incubator.                     */
/*  Too many hits and a chariot falls apart: some of its crew die in   */
/*  the wreck, the rest scatter and fight on, on foot.                 */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { sizeOf, setState } from "./dinos";
import { go, say } from "./humans";
import { goalKey, nodePos } from "./nav";
import { P } from "./particles";
import { killHuman } from "./rivals";
import { pick } from "./rng";
import { eggCapacity, eggsCarried, pickEgg, raidTarget, settleCarried, slayerDamage } from "./dragonRaid";
import { nestEggs, nestLost, parentOf, revealNest } from "./dragonNests";
import { canFly, mountDragon, rideable } from "./dragonKeep";
import { mount } from "./tasks";
import { partnerOf } from "./riders";
import { sp } from "../data/species";
import type { Building, Chariot, Dino, Dragon, DragonEgg, DragonHunt, Human, HuntFormation } from "./types";
import type { World } from "./world";

export const SEATS = 10;
export const CHARIOT_HP = 320;
const SPEED = 62;
/** how far round the nest the formation stands */
const RING_R = 300;
export const MUSTER_FOR = 120;
const BATTLE_FOR = 260;
/** Scorpion bolt reload (s), reach */
const SC_RELOAD = 2.6;
const SC_RANGE = 620;
const SPEAR_RANGE = 340;

/* ------------------------------ the vehicle ------------------------------ */

function rollOut(w: World, b: Building): Chariot {
  const c: Chariot = {
    id: w.nextId(), x: b.x, y: b.y, dir: 1, hp: CHARIOT_HP, maxHp: CHARIOT_HP, trike: 0, homeX: b.x, homeY: b.y,
    to: null, path: null, pathI: 0, pathKey: 0, cd: [0, 1.3], aim: [0, Math.PI], anim: 0, hit: 0,
  };
  return c;
}

/** Where crew member `seat` stands on the deck (five down each side). */
export function seatPos(c: Chariot, seat: number) {
  const row = seat < 5 ? 0 : 1;
  const k = seat % 5;
  // standing high on the deck: heads + shoulders over the shield wall, the rest behind it
  return { x: c.x + (k - 2) * 15 * c.dir + (row ? 7 : -3) * c.dir, y: c.y - 1 - (row ? 0 : 1), z: 34 };
}

const trikeOf = (w: World, c: Chariot) => (c.trike ? w.dinoById(c.trike) : null);
export const crewOf = (w: World, c: Chariot) => w.humans.filter((h) => h.chariot === c.id);

/** A Triceratops of ours that can pull a chariot. */
const puller = (w: World) => w.dinos.find((d) => d.owner && d.species === "trike" && !d.chariot && !d.rider && !d.under && d.health > 0.3 && d.growth > 0.7);

/** Drive toward c.to (around obstacles). True once it's there. */
function drive(w: World, c: Chariot, dt: number) {
  if (!c.to) return true;
  const trike = trikeOf(w, c);
  if (!trike) return false;
  const key = goalKey(c.to.x, c.to.y);
  if (c.pathKey !== key) {
    c.pathKey = key;
    c.pathI = 0;
    c.path = w.nav.lineClear("bigDino", c.x, c.y, c.to.x, c.to.y) ? null : w.nav.find(w, "bigDino", c.x, c.y, 0, c.to.x, c.to.y, 0, 9000) ?? null;
  }
  let tx = c.to.x;
  let ty = c.to.y;
  if (c.path && c.pathI < c.path.length) {
    const np = nodePos(c.path[c.pathI]);
    tx = np.x;
    ty = np.y;
  }
  const d = Math.hypot(tx - c.x, ty - c.y);
  if (d < 8) {
    if (c.path && c.pathI < c.path.length) {
      c.pathI++;
      return false;
    }
    c.to = null;
    return true;
  }
  const step = Math.min(d, SPEED * dt);
  c.x += ((tx - c.x) / d) * step;
  c.y += ((ty - c.y) / d) * step;
  if (Math.abs(tx - c.x) > 2) c.dir = tx > c.x ? 1 : -1;
  c.anim += step / 12;
  return false;
}

/** Keep the trike in the traces and the crew in their seats. */
function sync(w: World, c: Chariot, dt: number, moving: boolean) {
  const trike = trikeOf(w, c);
  if (trike) {
    trike.chariot = c.id;
    trike.x = c.x + c.dir * (58 + sizeOf(trike) * 0.32);
    trike.y = c.y + 2;
    trike.z = 0;
    trike.dir = c.dir;
    trike.vx = moving ? SPEED * c.dir : 0;
    trike.vy = 0;
    if (moving) trike.anim += (SPEED * dt) / Math.max(8, sizeOf(trike) * 0.22);
    if (trike.state !== (moving ? "wander" : "idle")) setState(trike, moving ? "wander" : "idle", trike.x, trike.y);
    trike.hunger = Math.min(trike.hunger, 0.5);
    trike.thirst = Math.min(trike.thirst, 0.5);
  }
  const hunt = w.colony.hunt;
  for (const h of crewOf(w, c)) {
    const m = hunt?.crew.find((x) => x.id === h.id);
    const p = seatPos(c, m?.seat ?? 0);
    h.x = p.x;
    h.y = p.y;
    h.z = p.z;
    h.vx = h.vy = 0;
    h.anim += dt;
    if (h.state !== "guard" && h.state !== "hunt") h.state = "guard";
    if (h.bubble) {
      h.bubble.t -= dt;
      if (h.bubble.t <= 0) h.bubble = null;
    }
  }
}

/** Something to shoot at from a chariot: the dragon first, then Neanderthals in range. */
function targetFor(w: World, c: Chariot, range: number): { kind: "dragon"; dr: Dragon } | { kind: "brute"; id: number; x: number; y: number; vx: number; vy: number } | null {
  let best: Dragon | null = null;
  let bd = range;
  for (const dr of w.dragons.list) {
    if (dr.z > 320 || dr.hp <= 0) continue;
    const g = Math.hypot(dr.x - c.x, dr.y - c.y);
    if (g < bd) {
      bd = g;
      best = dr;
    }
  }
  if (best) return { kind: "dragon", dr: best };
  let bb: { kind: "brute"; id: number; x: number; y: number; vx: number; vy: number } | null = null;
  bd = Math.min(range, 300);
  for (const b of w.rivals.brutes) {
    if (b.hp <= 0 || b.captive || b.snatched || !w.rivals.hostile(w, b)) continue;
    const g = Math.hypot(b.x - c.x, b.y - c.y);
    if (g < bd) {
      bd = g;
      bb = { kind: "brute", id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy };
    }
  }
  return bb;
}

/** The two Scorpions aim + shoot by themselves; the spearmen throw from behind their shields. */
function fight(w: World, c: Chariot, dt: number) {
  for (const k of [0, 1] as const) {
    c.cd[k] = Math.max(0, c.cd[k] - dt);
    const t = targetFor(w, c, SC_RANGE);
    if (!t) continue;
    const sx = c.x + c.dir * (k === 0 ? 30 : -30);
    const tx = t.kind === "dragon" ? t.dr.x : t.x;
    const ty = t.kind === "dragon" ? t.dr.y - t.dr.z : t.y;
    c.aim[k] = Math.atan2(ty - (c.y - 46), tx - sx);
    if (c.cd[k] > 0) continue;
    c.cd[k] = SC_RELOAD * (0.85 + w.rng() * 0.3);
    const target = t.kind === "dragon"
      ? { id: t.dr.id, x: t.dr.x, y: t.dr.y, z: t.dr.z, vx: t.dr.vx, vy: t.dr.vy, dragon: true }
      : { id: t.id, x: t.x, y: t.y, z: 18, vx: t.vx, vy: t.vy, dragon: false };
    w.tribe.fireBolt(w, sx, c.y, 46, target, t.kind === "dragon" ? 150 : 0.6, 640, 1.6);
    w.sfx("twang", sx, c.y, 0.7, 0.8);
  }
  for (const h of crewOf(w, c)) {
    if (w.colony.hunt?.crew.some((m) => m.id === h.id && m.runner)) continue;
    h.cd = Math.max(0, (h.cd ?? 0) - dt);
    if (h.cd > 0) continue;
    const t = targetFor(w, c, SPEAR_RANGE);
    if (!t) {
      h.state = "guard";
      continue;
    }
    const tx = t.kind === "dragon" ? t.dr.x : t.x;
    const ty = t.kind === "dragon" ? t.dr.y : t.y;
    const tz = t.kind === "dragon" ? t.dr.z + 10 : 18;
    const vx = t.kind === "dragon" ? t.dr.vx : t.vx;
    const vy = t.kind === "dragon" ? t.dr.vy : t.vy;
    h.cd = 2.2 + w.rng() * 1.2;
    h.dir = tx > h.x ? 1 : -1;
    h.state = "hunt";
    const dist = Math.hypot(tx - h.x, ty - h.y);
    const flight = Math.max(0.15, dist / 380);
    const ax = tx + vx * flight + (w.rng() - 0.5) * 30;
    const ay = ty + vy * flight + (w.rng() - 0.5) * 18;
    const sz = h.z + 18;
    w.tribe.projectiles.push({
      x: h.x + h.dir * 6, y: h.y, z: sz, vx: (ax - h.x) / flight, vy: (ay - h.y) / flight, vz: (tz - sz) / flight + 0.5 * 260 * flight,
      t: 0, dur: flight, kind: "spear", target: t.kind === "dragon" ? t.dr.id : t.id,
      // barbed war spears: mean against dragons
      dmg: (t.kind === "dragon" ? 46 : 0.32) * (t.kind === "dragon" ? slayerDamage(h) : 1), hit: false, big: 1.1,
    });
    w.sfx("whoosh", h.x, h.y, 0.4);
  }
}

/** Damage to a chariot (clan rocks, dragon fire). Too much and it falls apart. */
export function hitChariot(w: World, c: Chariot, dmg: number, why: string) {
  c.hp -= dmg;
  c.hit = 1;
  w.particles.burst(P.Crumb, c.x + (w.rng() - 0.5) * 50, c.y - 20, 4, 50, { z: 20, vz: 60, g: 220, size: 3, max: 0.7, color: "#8a6238" });
  if (c.hp <= 0) wreck(w, c, why);
}

/** It falls apart: the wreck kills some of the crew; the rest scatter and fight on, on foot. */
function wreck(w: World, c: Chariot, why: string) {
  const col = w.colony;
  w.particles.burst(P.Crumb, c.x, c.y - 20, 40, 160, { z: 30, vz: 160, g: 300, size: 5, max: 1.4, color: "#8a6238" });
  w.particles.burst(P.Rock, c.x, c.y - 10, 12, 100, { z: 20, size: 5, max: 1, color: "#e9e0c8" });
  w.particles.burst(P.Dust, c.x, c.y, 10, 80, { size: 18, max: 1.2, color: "rgba(150,125,95,0.6)" });
  w.sfx("timber", c.x, c.y, 1.1);
  w.sfx("crack", c.x, c.y, 1.2, 0.7);
  w.shake(5, 0.5);
  const hunt = col.hunt;
  const parent = hunt ? parentOf(w, w.dragons.nests.find((n) => n.id === hunt.nest)!) : null;
  let lost = 0;
  for (const h of crewOf(w, c)) {
    h.chariot = undefined;
    h.z = 0;
    if (w.rng() < 0.25) {
      lost++;
      killHuman(w, h, `${h.name} was crushed when the war chariot broke apart.`);
      continue;
    }
    h.x += (w.rng() - 0.5) * 80;
    h.y += 20 + w.rng() * 30;
    h.hp = Math.min(h.hp, 0.7);
    say(h, pick(w.rng, ["Fight on!", "Get up! Fight!", "It's broken! Spears out!"]));
    if (hunt && hunt.phase === "battle" && parent) h.order = { kind: "hunt", id: parent.id };
    else go(h, "idle", h.x, h.y);
    const m = hunt?.crew.find((x) => x.id === h.id);
    if (m) m.chariot = 0;
  }
  const trike = trikeOf(w, c);
  if (trike) {
    trike.chariot = undefined;
    trike.health = Math.max(0.2, trike.health - 0.25);
    setState(trike, "flee", c.homeX, c.homeY);
  }
  col.chariots.splice(col.chariots.indexOf(c), 1);
  w.toast("💥", `A war chariot was smashed apart by ${why}!${lost ? ` ${lost} of its crew died in the wreck;` : ""} the rest scatter and fight on.`, c.x, c.y);
}

/* ------------------------------ per frame ------------------------------ */

export function chariotsUpdate(w: World, dt: number) {
  const col = w.colony;
  // a finished chariot rolls out of the yard
  for (const b of [...col.buildings]) {
    if (b.kind !== "warChariot" || b.built < 1) continue;
    const c = rollOut(w, b);
    col.removeBuilding(b);
    col.chariots.push(c);
    w.sfx("build", c.x, c.y, 0.8);
    w.toast("🛡️", `A war chariot is ready! Two Scorpions, ten seats, a Triceratops skull on the prow.${puller(w) ? "" : " It needs a tamed Triceratops to pull it."}`, c.x, c.y);
  }
  const second = Math.floor(w.elapsed) !== Math.floor(w.elapsed - dt);
  for (const c of [...col.chariots]) {
    c.hit = Math.max(0, c.hit - dt * 3);
    let trike = trikeOf(w, c);
    if (!trike || trike.health <= 0) {
      if (trike) trike.chariot = undefined;
      c.trike = 0;
      trike = null;
    }
    // harness a Triceratops to it
    if (!trike && second) {
      const d = puller(w);
      if (d) {
        d.chariot = c.id;
        c.trike = d.id;
        d.rider = 0;
        w.toast("🦕", `${d.name} the Triceratops is harnessed to a war chariot.`, c.x, c.y);
      }
    }
    const moving = !!c.to && !!trikeOf(w, c);
    drive(w, c, dt);
    sync(w, c, dt, moving);
    fight(w, c, dt);
    // Neanderthals pelt it as it goes by (sometimes they hit)
    if (second) {
      for (const b of w.rivals.brutes) {
        if (b.hp <= 0 || b.captive || b.snatched || (b.age ?? 180) < 180 || b.weapon === "catapult" || !w.rivals.hostile(w, b)) continue;
        if (Math.hypot(b.x - c.x, b.y - c.y) > 280 || w.rng() > 0.22) continue;
        b.dir = c.x > b.x ? 1 : -1;
        hitChariot(w, c, 9 + w.rng() * 12, b.tree ? "the Tree People" : `the ${w.rivals.clan(b.clan)?.name ?? ""} clan`);
        if (!w.flags.has(`chariotPelt${c.id}`)) {
          w.flags.add(`chariotPelt${c.id}`);
          w.toast("🪨", `Neanderthals are pelting the war chariot with rocks + spears as it goes by! The crew shoot back.`, c.x, c.y);
        }
        if (!col.chariots.includes(c)) break;
      }
    }
  }
  if (col.hunt) huntUpdate(w, col.hunt, dt);
}

/* ------------------------------ expeditions: the hunt / the clan attack ------------------------------ */
/*
 * Anyone sent against a dragon's nest or a clan's camp goes out as one force. Everyone gets to their
 * fastest ride first: dragon riders climb onto their dragons, dino riders onto their dinos, everybody else
 * fills the war chariots' seats; only the rest walk. Nobody sets out till (almost) everyone's ready, and
 * nobody attacks till 98% of them are in their places in the formation round the target.
 */

/** Of the force, what share must be in place before they attack. */
export const READY_SHARE = 0.98;

/** Where the chariots (and those on foot) stand round the target in each formation. */
export function formationSlots(w: World, nestX: number, nestY: number, f: HuntFormation, n: number, r = RING_R) {
  const a0 = Math.atan2(w.camp.y - nestY, w.camp.x - nestX);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let a: number;
    if (f === "ring") a = a0 + (i / Math.max(1, n)) * Math.PI * 2;
    else if (f === "pincer") a = a0 + (i % 2 ? 1 : -1) * (1.05 + Math.floor(i / 2) * 0.35);
    else a = a0 + (i - (n - 1) / 2) * 0.32;
    out.push({ x: nestX + Math.cos(a) * r, y: nestY + Math.sin(a) * r * 0.8 });
  }
  return out;
}

export const FORMATIONS: { id: HuntFormation; icon: string; name: string; tip: string }[] = [
  { id: "ring", icon: "⭕", name: "Ring", tip: "Surround the target from every side" },
  { id: "pincer", icon: "🦀", name: "Pincer", tip: "Two arms close in from both flanks" },
  { id: "wedge", icon: "🔺", name: "Wedge", tip: "One hard V-shaped push from the camp side" },
];

type Member = DragonHunt["crew"][number];

/** What the force is attacking. */
function targetOf(w: World, hunt: DragonHunt): { x: number; y: number; r: number; name: string } | null {
  if (hunt.dragon) {
    const dr = w.dragons.list.find((d) => d.id === hunt.dragon && d.hp > 0);
    return dr ? { x: dr.x, y: dr.y, r: 260, name: dr.name } : null;
  }
  if (hunt.clan) {
    const c = w.rivals.clan(hunt.clan);
    return c ? { x: c.x, y: c.y, r: (c.colors?.length ?? 1) > 1 || (c.campTier ?? 0) >= 4 ? 380 : 270, name: `the ${c.name} camp` } : null;
  }
  const n = w.dragons.nests.find((x) => x.id === hunt.nest);
  const p = n ? parentOf(w, n) : null;
  return n ? { x: n.x, y: n.y, r: RING_R, name: p ? `${p.name}'s nest` : "the empty nest" } : null;
}

/** Where everyone gathers before setting out: the camp's edge, on the way. */
function musterPoint(w: World, tx: number, ty: number) {
  const a = Math.atan2(ty - w.camp.y, tx - w.camp.x);
  return { x: w.camp.x + Math.cos(a) * 340, y: w.camp.y + Math.sin(a) * 260 };
}

/** Their own dragon (war-ready to carry them) or their own dino. */
function ownDragon(w: World, h: Human) {
  const dr = w.dragons.owned.find((d) => d.partner === h.id) ?? null;
  return dr && rideable(dr) && canFly(dr) && dr.hp > dr.maxHp * 0.4 && (dr.stamina ?? 1) > 0.3 ? dr : null;
}
function ownDino(w: World, h: Human) {
  const d = partnerOf(w, h);
  return d && d.owner && !d.chariot && d.health > 0.3 && sp(d.species).move === "walk" ? d : null;
}

export interface ExpeditionOpts {
  /** the people sent (else: the fighters, topped up to fill the chariots) */
  people?: Human[];
  /** attack this clan's camp (else a dragon's nest) */
  clan?: number;
  nest?: number;
  /** hunt this wild dragon wherever it goes */
  dragon?: number;
}

/** Send a force out (returns why not). */
export function startHunt(w: World, formation: HuntFormation, opts: ExpeditionOpts = {}): string | null {
  const col = w.colony;
  if (col.hunt) return "An attack is already under way.";
  let nestId = 0;
  if (opts.dragon) {
    if (!w.dragons.list.some((d) => d.id === opts.dragon && d.hp > 0)) return "That dragon is gone.";
  } else if (opts.clan) {
    if (!w.rivals.clan(opts.clan)) return "That clan is gone.";
  } else {
    const nest = opts.nest ? w.dragons.nests.find((n) => n.id === opts.nest) ?? null : raidTarget(w);
    if (!nest) return "No known dragon nest yet. Track a wild dragon home, or send scouts to find one.";
    nestId = nest.id;
  }
  const cars = col.chariots.filter((c) => c.trike && c.hp > c.maxHp * 0.3);
  if (!opts.people && !cars.length) return col.chariots.length ? "The war chariots need a tamed Triceratops to pull them (or repairs)." : "Build a war chariot first (Build → Defense).";
  const ok = (h: Human) => !h.child && !h.stranger && !h.captive && !h.under && h.state !== "down" && !h.chariot;
  const role = (h: Human) => w.tribe.roleOf(h);
  let band: Human[];
  if (opts.people) band = opts.people.filter(ok);
  else {
    const fighters = w.humans.filter((h) => ok(h) && !h.aloft && ["dragonSlayer", "eggRunner", "guard", "hunter"].includes(role(h)));
    // top up with whoever else is free so the chariots go out full
    const others = w.humans.filter((h) => ok(h) && !h.aloft && !fighters.includes(h)).sort((a, b) => b.hp - a.hp);
    band = [...fighters, ...others].slice(0, Math.max(fighters.length, cars.length * SEATS));
  }
  if (!band.length || (!opts.people && band.length < 2)) return "Not enough people to send.";
  const runners = opts.clan || opts.dragon ? [] : band.filter((h) => role(h) === "eggRunner");
  if (nestId) {
    const nest = w.dragons.nests.find((n) => n.id === nestId)!;
    const eggs = nestEggs(w, nest).length;
    const capacity = () => runners.reduce((total, h) => total + eggCapacity(h), 0);
    // Give the party enough hands for the whole clutch on this trip. Runner kits carry two.
    const helpers = band.filter((h) => !runners.includes(h)).sort((a, b) =>
      Number(b.gear.outfit === "runnerKit") - Number(a.gear.outfit === "runnerKit") ||
      Number(!!ownDragon(w, a) || !!ownDino(w, a)) - Number(!!ownDragon(w, b) || !!ownDino(w, b)) ||
      Number(role(a) === "dragonSlayer") - Number(role(b) === "dragonSlayer"));
    const keepFighters = parentOf(w, nest) && band.length > 1 ? 1 : 0;
    for (const h of helpers) {
      if (capacity() >= eggs && runners.length) break;
      if (runners.length >= band.length - keepFighters) break;
      runners.push(h);
    }
  }
  const crew: Member[] = [];
  const seats = new Map(cars.map((c) => [c.id, 0]));
  // their own dragons + dinos first, then every chariot seat filled, then the rest on foot
  const ordered = [...runners, ...band.filter((h) => !runners.includes(h))];
  for (const h of ordered) {
    const runner = runners.includes(h);
    const dr = !runner ? ownDragon(w, h) : null;
    if (dr) {
      crew.push({ id: h.id, chariot: 0, seat: 0, runner, ride: "dragon", mount: dr.id });
      continue;
    }
    const d = !runner ? ownDino(w, h) : null;
    if (d) {
      crew.push({ id: h.id, chariot: 0, seat: 0, runner, ride: "dino", mount: d.id });
      continue;
    }
    const c = cars.find((x) => (seats.get(x.id) ?? 0) < SEATS && (!runner || crew.filter((m) => m.chariot === x.id && m.runner).length < 2)) ?? null;
    if (c) {
      const s = seats.get(c.id)!;
      seats.set(c.id, s + 1);
      crew.push({ id: h.id, chariot: c.id, seat: s, runner });
    } else crew.push({ id: h.id, chariot: 0, seat: 0, runner });
  }
  for (const h of band) {
    h.order = null;
    const old = w.tasks.get(h.taskId);
    if (old) old.people = old.people.filter((id) => id !== h.id);
    h.task = null;
    h.taskId = 0;
  }
  col.hunt = { nest: nestId, ...(opts.clan ? { clan: opts.clan } : {}), ...(opts.dragon ? { dragon: opts.dragon } : {}), formation, phase: "muster", t: 0, crew, start: crew.length, eggs: 0 };
  const tgt = targetOf(w, col.hunt)!;
  const n = (k: (m: Member) => boolean) => crew.filter(k).length;
  const parts = [
    n((m) => !!m.chariot) && `${n((m) => !!m.chariot)} in ${new Set(crew.filter((m) => m.chariot).map((m) => m.chariot)).size} war chariot${new Set(crew.filter((m) => m.chariot).map((m) => m.chariot)).size > 1 ? "s" : ""}`,
    n((m) => m.ride === "dragon") && `${n((m) => m.ride === "dragon")} on dragons`,
    n((m) => m.ride === "dino") && `${n((m) => m.ride === "dino")} on their dinos`,
    n((m) => !m.chariot && !m.ride) && `${n((m) => !m.chariot && !m.ride)} on foot`,
  ].filter(Boolean);
  w.sfx("drums", w.camp.x, w.camp.y, 1.2, 0.8);
  w.toast("🛡️", `To arms! ${crew.length} set out for ${tgt.name}: ${parts.join(", ")}. Formation: ${FORMATIONS.find((f) => f.id === formation)!.name}. Everyone to their mounts; nobody attacks till they're all in place.`, tgt.x, tgt.y);
  return null;
}

/* ------------------------------ a raid set up from a chariot ------------------------------ */

export type RaidTarget = { kind: "nest" | "clan" | "dragon"; id: number };

/** The chariot under a tap (its body + shield wall). */
export function chariotAt(w: World, x: number, y: number) {
  return w.colony.chariots.find((c) => Math.abs(x - c.x) < 62 && y > c.y - 74 && y < c.y + 16) ?? null;
}

/** Somebody who can go out on a raid. */
function canGo(w: World, h: Human) {
  return !h.child && !h.stranger && !h.captive && !h.under && h.state !== "down" && !h.chariot && !h.catapult && h.hp > 0.4;
}

/** Who's available for a unit: the riders (with their own dragon / dino) and everyone else to fill the seats. */
export function raidPool(w: World) {
  const cars = w.colony.chariots.filter((c) => c.trike && c.hp > c.maxHp * 0.3);
  const free = w.humans.filter((h) => canGo(w, h) && !h.aloft);
  const dragonRiders = w.humans.filter((h) => canGo(w, h) && !!ownDragon(w, h));
  const dinoRiders = free.filter((h) => !ownDragon(w, h) && !!ownDino(w, h));
  const fillers = free.filter((h) => !ownDragon(w, h) && !ownDino(w, h));
  return { cars, seats: cars.length * SEATS, dragonRiders, dinoRiders, fillers };
}

/** Where a unit can go: known dragon nests, and the clan camps. */
export function raidTargets(w: World) {
  const nests = w.dragons.nests
    .filter((n) => n.found)
    .map((n) => {
      const eggs = nestEggs(w, n).length;
      const parent = parentOf(w, n);
      const young = w.dragons.list.filter((d) => d.young && d.nest === n.id).length;
      return { kind: "nest" as const, id: n.id, icon: parent ? "🐉" : "🪺", name: parent ? `${parent.name} at its nest` : "An empty nest", note: `${parent ? `${parent.breed ?? "fire"} · ` : ""}${eggs} egg${eggs === 1 ? "" : "s"}${young ? ` · ${young} young` : ""}`, dist: Math.hypot(n.x - w.camp.x, n.y - w.camp.y) };
    });
  // wild dragons out roaming (no nest of their own): hunt them down wherever they go
  const roaming = w.dragons.list
    .filter((d) => d.hp > 0 && !d.nest && !d.young && d.state !== "leave")
    .map((d) => ({ kind: "dragon" as const, id: d.id, icon: "🐲", name: d.name, note: `${d.breed ?? "fire"} · roaming${d.fury ? " · furious" : ""}`, dist: Math.hypot(d.x - w.camp.x, d.y - w.camp.y) }));
  const clans = w.rivals.clans.map((c) => {
    const held = w.rivals.captives(w, c.id).length;
    const n = w.rivals.members(c.id).filter((b) => b.hp > 0).length;
    return { kind: "clan" as const, id: c.id, icon: "⛺", name: `The ${c.name} camp`, note: `${n} fighter${n === 1 ? "" : "s"}${held ? ` · ${held} of ours held` : ""}`, dist: Math.hypot(c.x - w.camp.x, c.y - w.camp.y) };
  });
  return [...nests, ...roaming, ...clans].sort((a, b) => a.dist - b.dist);
}

/** Pick the unit: the chosen number of dragon + dino riders (strongest first), then every chariot seat filled (fighters first). */
export function pickUnit(w: World, dragons: number, dinos: number, target: RaidTarget) {
  const pool = raidPool(w);
  const fit = (a: Human, b: Human) => b.hp - a.hp;
  const drs = pool.dragonRiders.sort((a, b) => (ownDragon(w, b)!.hp - ownDragon(w, a)!.hp)).slice(0, Math.max(0, dragons));
  const dns = pool.dinoRiders.sort(fit).slice(0, Math.max(0, dinos));
  const rank = (h: Human) => {
    const r = w.tribe.roleOf(h);
    if (target.kind === "nest" && r === "eggRunner") return 0;
    return r === "dragonSlayer" || r === "guard" || r === "hunter" ? 1 : r === "eggRunner" ? 2 : 3;
  };
  const seat = pool.fillers.sort((a, b) => rank(a) - rank(b) || fit(a, b)).slice(0, pool.seats);
  return { people: [...drs, ...dns, ...seat], dragons: drs.length, dinos: dns.length, seated: seat.length, seats: pool.seats, cars: pool.cars.length };
}

/** Form the unit and send it (returns why not). */
export function startRaid(w: World, target: RaidTarget, formation: HuntFormation, dragons: number, dinos: number): string | null {
  if (w.colony.hunt) return "A raid is already under way.";
  const unit = pickUnit(w, dragons, dinos, target);
  if (!unit.cars) return w.colony.chariots.length ? "The war chariots need a tamed Triceratops to pull them (or repairs)." : "Build a war chariot first (Build → Defense).";
  if (unit.people.length < 2) return "Not enough people free to form a unit.";
  return startHunt(w, formation, { people: unit.people, ...(target.kind === "clan" ? { clan: target.id } : target.kind === "dragon" ? { dragon: target.id } : { nest: target.id }) });
}

const huntChariots = (w: World, hunt: DragonHunt) => w.colony.chariots.filter((c) => hunt.crew.some((m) => m.chariot === c.id));
const person = (w: World, m: Member) => w.humans.find((h) => h.id === m.id) ?? null;

/** Ready to set out: aboard, mounted, or at the muster point. */
function ready(w: World, m: Member, mp: { x: number; y: number }) {
  const h = person(w, m);
  if (!h) return false;
  if (m.chariot) return h.chariot === m.chariot || !w.colony.chariots.some((c) => c.id === m.chariot);
  if (m.ride === "dragon") return h.aloft === m.mount;
  if (m.ride === "dino") return h.riding === m.mount;
  return Math.hypot(h.x - mp.x, h.y - mp.y) < 110;
}

/** In their place round the target. */
function inPlace(w: World, m: Member) {
  const h = person(w, m);
  if (!h || m.sx === undefined || m.sy === undefined) return false;
  if (m.chariot) {
    const c = w.colony.chariots.find((x) => x.id === m.chariot);
    if (!c) return Math.hypot(h.x - m.sx, h.y - m.sy) < 120;
    return Math.hypot(c.x - m.sx, c.y - m.sy) < 60;
  }
  return Math.hypot(h.x - m.sx, h.y - m.sy) < 120;
}

/** The nearest Neanderthal of the clan still fighting round its camp. */
function clanFoe(w: World, clanId: number, x: number, y: number) {
  const c = w.rivals.clan(clanId);
  if (!c) return null;
  let best: { id: number; x: number; y: number } | null = null;
  let bd = Infinity;
  for (const b of w.rivals.members(c.id)) {
    if (b.hp <= 0 || b.captive || b.snatched || b.falling || b.weapon === "catapult" || Math.hypot(b.x - c.x, b.y - c.y) > 700) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

function huntUpdate(w: World, hunt: DragonHunt, dt: number) {
  hunt.t += dt;
  const tgt = targetOf(w, hunt);
  const cars = huntChariots(w, hunt);
  const alive = hunt.crew.filter((m) => !!person(w, m));
  if (!tgt) return endHunt(w, hunt, hunt.clan || hunt.dragon ? "won" : "lost", hunt.clan ? "The clan is broken and scattered!" : hunt.dragon ? "The dragon is dead!" : "The nest is gone.");
  const nest = hunt.nest ? w.dragons.nests.find((n) => n.id === hunt.nest) ?? null : null;
  const parent = nest ? parentOf(w, nest) : null;
  const need = Math.ceil(alive.length * READY_SHARE);
  // the dragons carry their riders: steer them from here (a rider aloft doesn't think for themselves)
  steerDragons(w, hunt, tgt, parent);
  switch (hunt.phase) {
    case "muster": {
      const mp = musterPoint(w, tgt.x, tgt.y);
      const set = alive.filter((m) => ready(w, m, mp)).length;
      hunt.ready = set;
      hunt.need = need;
      if ((set >= need && alive.length) || hunt.t > MUSTER_FOR) {
        hunt.phase = "march";
        hunt.t = 0;
        placeSlots(w, hunt, tgt);
        w.sfx("drums", tgt.x, tgt.y, 1, 0.8);
        w.toast("🛡️", `${set} of ${alive.length} ready: the force sets out for ${tgt.name}${cars.length ? ", the war chariots in front" : ""}!`, mp.x, mp.y);
      }
      return;
    }
    case "march": {
      // a threat on the way: stop and deal with it, then carry on (the clock stops while they fight)
      if (marchFight(w, hunt, cars, alive, dt)) {
        hunt.t = Math.max(0, hunt.t - dt);
        break;
      }
      // a dragon on the move: lay the formation out again round where it is now
      if (hunt.dragon && Math.hypot(tgt.x - (hunt.cx ?? tgt.x), tgt.y - (hunt.cy ?? tgt.y)) > 260) placeSlots(w, hunt, tgt);
      const placed = alive.filter((m) => inPlace(w, m)).length;
      if (nest && cars.some((c) => Math.hypot(c.x - nest.x, c.y - nest.y) < RING_R + 220)) revealNest(w, nest, "the chariot crews");
      if ((placed >= need && alive.length) || hunt.t > 300) {
        hunt.phase = "battle";
        hunt.t = 0;
        w.sfx("drums", tgt.x, tgt.y, 1.3, 0.7);
        w.toast("⚔️", hunt.clan || hunt.dragon ? `${placed} of ${alive.length} in place round ${tgt.name}: ATTACK!` : parent ? `Surrounded! ${placed} of ${alive.length} in place: spears + Scorpions at ${parent.name} from every side!` : "The nest is unguarded: runners, go!", tgt.x, tgt.y);
      }
      break;
    }
    case "battle": {
      if (alive.length < Math.ceil(hunt.start * 0.35) || hunt.t > BATTLE_FOR) {
        endHunt(w, hunt, "lost", hunt.clan ? `The ${w.rivals.clan(hunt.clan)?.name ?? ""} clan drove us off.` : hunt.dragon ? `${tgt.name} beat off the attack.` : parent ? `${parent.name} beat off the attack.` : "The attack fell apart.");
        return;
      }
      if (hunt.dragon) {
        const dr = w.dragons.list.find((d) => d.id === hunt.dragon);
        if (dr && (dr.hp < dr.maxHp * 0.2 || dr.state === "flee" || dr.state === "leave")) endHunt(w, hunt, "won", `${dr.name} is beaten and flees!`);
        break;
      }
      if (hunt.clan) {
        // won when nobody's left fighting round their camp: their food is ours, our people come home
        if (!clanFoe(w, hunt.clan, tgt.x, tgt.y)) {
          const clan = w.rivals.clan(hunt.clan);
          let freed = 0;
          if (clan) {
            for (const h of w.rivals.captives(w, clan.id)) {
              w.rivals.free(w, h, `${h.name} is free!`);
              freed++;
            }
            const got = w.rivals.plunder(w, clan);
            endHunt(w, hunt, "won", `The ${clan.name} camp is ours${got ? `: ${got} food carried off` : ""}${freed ? `, and ${freed} of our people freed` : ""}!`);
          } else endHunt(w, hunt, "won", "The clan is beaten!");
        }
        break;
      }
      if (!nest) break;
      // runners jump down once the dragon's hurt, busy or gone
      const busy = !parent || parent.hp < parent.maxHp * 0.75 || parent.z > 40 || Math.hypot(parent.x - nest.x, parent.y - nest.y) > 160 || hunt.t > 30;
      if (busy && nestEggs(w, nest).length) {
        // If a runner was lost, anyone with empty hands can take their place.
        let freeHands = alive.reduce((n, m) => {
          const h = person(w, m);
          return n + (m.runner && h ? Math.max(0, eggCapacity(h) - eggsCarried(h)) : 0);
        }, 0);
        for (const m of alive) {
          if (freeHands >= nestEggs(w, nest).length) break;
          const h = person(w, m);
          if (!h || m.runner || h.aloft || h.riding || (parent && alive.filter((x) => !x.runner).length <= 1)) continue;
          m.runner = true;
          h.order = null;
          freeHands += eggCapacity(h);
          say(h, "I'll help carry eggs!");
        }
        for (const c of cars) {
          for (const h of crewOf(w, c)) {
            const m = hunt.crew.find((x) => x.id === h.id);
            if (!m?.runner || eggsCarried(h)) continue;
            h.chariot = undefined;
            h.z = 0;
            m.chariot = 0;
            say(h, "Eggs! Go go go!");
          }
        }
      }
      const runnersOut = alive.some((m) => m.runner && eggsCarried(person(w, m)!) > 0);
      const beaten = !parent || parent.hp < parent.maxHp * 0.35 || parent.state === "flee";
      const eggsLeft = nestEggs(w, nest).length;
      if (!cars.length && !beaten && hunt.t > 20 && !alive.some((m) => m.ride === "dragon")) {
        endHunt(w, hunt, "lost", parent ? `${parent.name} smashed the chariots.` : "The attack fell apart.");
        return;
      }
      if ((!eggsLeft && (runnersOut || hunt.eggs > 0 || beaten)) || (beaten && hunt.t > 12 && !eggsLeft) || (beaten && !alive.some((m) => m.runner))) {
        endHunt(w, hunt, "won", beaten ? `${parent ? parent.name : "The dragon"} is beaten${eggsLeft ? "" : " and the eggs are ours"}!` : "The eggs are ours!");
      }
      break;
    }
    case "collect": {
      // more eggs than free hands on the ground: crews climb down to help
      if (Math.floor(hunt.t) !== Math.floor(hunt.t - dt)) {
        const left = eggsToCollect(w, hunt).length;
        const hands = hunt.crew.map((m) => person(w, m)).filter((h): h is Human => !!h && !h.chariot && !h.aloft && h.state !== "down").reduce((n, h) => n + Math.max(0, eggCapacity(h) - eggsCarried(h)), 0);
        if (left > hands) {
          for (const c of cars) for (const h of crewOf(w, c)) if (!eggsCarried(h)) {
            dismount(w, h);
            break;
          }
        }
      }
      // gathering up every egg: once they're all in hand and everyone's back aboard, home they go
      const left = eggsToCollect(w, hunt).length;
      const aboard = hunt.crew.every((m) => !m.chariot || !person(w, m) || person(w, m)!.chariot === m.chariot || !cars.some((c) => c.id === m.chariot));
      if ((!left && aboard) || hunt.t > 150) {
        hunt.phase = "return";
        hunt.t = 0;
        for (const c of cars) c.to = { x: c.homeX, y: c.homeY };
        const got = hunt.crew.reduce((n, m) => n + eggsCarried(person(w, m) ?? ({} as Human)), 0);
        w.toast("🥚", `${got} dragon egg${got === 1 ? "" : "s"} gathered up: the unit heads home with them!`, cars[0]?.x ?? w.camp.x, cars[0]?.y ?? w.camp.y);
      }
      break;
    }
    case "return": {
      for (const c of cars) if (!c.to && Math.hypot(c.x - c.homeX, c.y - c.homeY) > 20) c.to = { x: c.homeX, y: c.homeY };
      const home = cars.every((c) => Math.hypot(c.x - c.homeX, c.y - c.homeY) < 24);
      // (nobody heads off for good while one of our eggs still lies out there)
      const dropped = hunt.result === "won" && w.dragons.eggs.some((e) => e.at === "ground" && hunt.crew.some((m) => person(w, m) && Math.hypot(person(w, m)!.x - e.x, person(w, m)!.y - e.y) < 600));
      const back = !dropped && alive.every((m) => m.chariot || Math.hypot(person(w, m)!.x - w.camp.x, person(w, m)!.y - w.camp.y) < 420);
      if ((home && back) || hunt.t > 300) {
        // everyone climbs down at home; runners take the eggs to the incubator
        for (const c of cars) for (const h of crewOf(w, c)) dismount(w, h);
        for (const m of hunt.crew) {
          const h = person(w, m);
          if (!h) continue;
          if (eggsCarried(h)) settleCarried(w, h);
          if (h.order?.kind === "hunt") h.order = null;
        }
        w.colony.hunt = null;
      }
      break;
    }
  }
}

/** Lay the formation out round the target: chariots on the outer line, riders + those on foot just inside. */
function placeSlots(w: World, hunt: DragonHunt, tgt: { x: number; y: number; r: number }) {
  const cars = huntChariots(w, hunt);
  hunt.cx = tgt.x;
  hunt.cy = tgt.y;
  const slots = formationSlots(w, tgt.x, tgt.y, hunt.formation, cars.length, tgt.r);
  cars.forEach((c, i) => {
    c.to = slots[i];
    for (const m of hunt.crew) if (m.chariot === c.id) {
      m.sx = slots[i].x;
      m.sy = slots[i].y;
    }
  });
  const rest = hunt.crew.filter((m) => !m.chariot);
  const inner = formationSlots(w, tgt.x, tgt.y, hunt.formation, rest.length, tgt.r - 70);
  rest.forEach((m, i) => {
    m.sx = inner[i].x;
    m.sy = inner[i].y;
  });
}

/** Where a foe is (a dino, a Neanderthal or a wild dragon), if it's still about. */
function foePos(w: World, id: number): { x: number; y: number } | null {
  const d = w.dinoById(id);
  if (d && d.health > 0) return d;
  const b = w.rivals.byId(id);
  if (b && b.hp > 0) return b;
  return w.dragons.list.find((x) => x.id === id && x.hp > 0) ?? null;
}

/** How far out the unit spots trouble on the march. */
export const SPOT_R = 320;

/** The nearest threat to the unit on its way (not the target itself, not a wild baby dragon). */
export function marchThreat(w: World, hunt: DragonHunt): { id: number; x: number; y: number; name: string } | null {
  const pts: { x: number; y: number }[] = [...huntChariots(w, hunt)];
  for (const m of hunt.crew) {
    const h = person(w, m);
    if (h && !h.chariot) pts.push(h);
  }
  const near = (x: number, y: number) => pts.some((p) => Math.hypot(p.x - x, p.y - y) < SPOT_R);
  const nest = hunt.nest ? w.dragons.nests.find((n) => n.id === hunt.nest) : null;
  const skip = new Set([hunt.dragon ?? 0, nest?.parent ?? 0]);
  let best: { id: number; x: number; y: number; name: string } | null = null;
  let bd = Infinity;
  const consider = (id: number, x: number, y: number, name: string) => {
    if (skip.has(id) || !near(x, y)) return;
    const d = Math.min(...pts.map((p) => Math.hypot(p.x - x, p.y - y)));
    if (d < bd) {
      bd = d;
      best = { id, x, y, name };
    }
  };
  // out in the wild any awake predator is a threat (the tribe's own "hostile" rule only counts ones near the camp)
  const predator = (d: Dino) => d.raider || (sp(d.species).diet !== "herbivore" && sp(d.species).move === "walk" && sizeOf(d) > 30 && d.state !== "sleep");
  for (const d of w.dinos) if (d.health > 0 && !d.owner && !d.under && !d.chariot && predator(d)) consider(d.id, d.x, d.y, `a ${sp(d.species).nick}`);
  for (const b of w.rivals.brutes) if (b.hp > 0 && !b.captive && !b.snatched && b.clan !== hunt.clan && w.rivals.hostile(w, b)) consider(b.id, b.x, b.y, `${b.name} of the clans`);
  for (const dr of w.dragons.list) if (dr.hp > 0 && !dr.young && dr.z < 220 && dr.state !== "leave") consider(dr.id, dr.x, dr.y, dr.name);
  return best;
}

/** On the march: stop to fight whatever threatens the unit, then carry on. True while they're fighting. */
function marchFight(w: World, hunt: DragonHunt, cars: Chariot[], alive: Member[], dt: number) {
  if (hunt.engage) {
    hunt.engageT = (hunt.engageT ?? 0) + dt;
    const p = foePos(w, hunt.engage);
    const lead = person(w, alive[0] ?? hunt.crew[0]);
    const center = cars[0] ?? lead ?? w.camp;
    if (p && hunt.engageT < 45 && Math.hypot(p.x - center.x, p.y - center.y) < SPOT_R * 2) {
      for (const c of cars) c.to = null;
      return true;
    }
    // dealt with (or it got away): back on the march
    hunt.engage = undefined;
    hunt.engageT = 0;
    for (const m of hunt.crew) {
      const h = person(w, m);
      if (h?.order?.kind === "hunt") h.order = null;
      if (m.chariot) {
        const c = cars.find((x) => x.id === m.chariot);
        if (c && m.sx !== undefined && m.sy !== undefined) c.to = { x: m.sx, y: m.sy };
      }
    }
    w.toast("🛡️", "Threat dealt with: the unit forms up and carries on with the mission.", center.x, center.y);
    return false;
  }
  if (Math.floor(hunt.t) === Math.floor(hunt.t - dt)) return false;
  const threat = marchThreat(w, hunt);
  if (!threat) return false;
  hunt.engage = threat.id;
  hunt.engageT = 0;
  for (const c of cars) c.to = null;
  w.sfx("drums", threat.x, threat.y, 0.9, 0.9);
  w.toast("⚔️", `The unit spotted ${threat.name} on the way and stops to fight!`, threat.x, threat.y);
  return true;
}

/** Point a unit that's still gathering or marching at a new target (returns why not). */
export function retargetHunt(w: World, target: RaidTarget): string | null {
  const hunt = w.colony.hunt;
  if (!hunt) return "No unit is out.";
  if (hunt.phase !== "muster" && hunt.phase !== "march") return "Too late to change: they're already fighting.";
  const nest = target.kind === "nest" ? w.dragons.nests.find((n) => n.id === target.id) : null;
  if (target.kind === "nest" && !nest) return "That nest is gone.";
  if (target.kind === "clan" && !w.rivals.clan(target.id)) return "That clan is gone.";
  if (target.kind === "dragon" && !w.dragons.list.some((d) => d.id === target.id && d.hp > 0)) return "That dragon is gone.";
  hunt.nest = nest ? nest.id : 0;
  hunt.clan = target.kind === "clan" ? target.id : undefined;
  hunt.dragon = target.kind === "dragon" ? target.id : undefined;
  hunt.engage = undefined;
  const tgt = targetOf(w, hunt)!;
  if (hunt.phase === "march") placeSlots(w, hunt, tgt);
  w.sfx("drums", tgt.x, tgt.y, 0.8, 1);
  w.toast("🎯", `New orders: the unit ${hunt.phase === "muster" ? "will head" : "turns"} for ${tgt.name}.`, tgt.x, tgt.y);
  return null;
}

/** What the unit is heading for (for the card). */
export function huntTargetName(w: World) {
  const hunt = w.colony.hunt;
  return hunt ? targetOf(w, hunt)?.name ?? "?" : "";
}

/** The name of what the unit stopped to fight. */
export function huntFoeName(w: World, id: number) {
  const d = w.dinoById(id);
  if (d) return `a ${sp(d.species).nick}`;
  const b = w.rivals.byId(id);
  if (b) return b.name;
  return w.dragons.list.find((x) => x.id === id)?.name ?? "something";
}

/** Is this one of our dragons carrying a rider on the raid? (it waits for them, not off on patrol) */
export function onExpedition(w: World, dr: Dragon) {
  return !!w.colony.hunt?.crew.some((m) => m.ride === "dragon" && m.mount === dr.id);
}

/** Dragons carrying riders: down to pick them up, out to their place, at the enemy, then home. */
function steerDragons(w: World, hunt: DragonHunt, tgt: { x: number; y: number }, parent: Dragon | null) {
  for (const m of hunt.crew) {
    if (m.ride !== "dragon") continue;
    const h = person(w, m);
    const dr = w.dragons.owned.find((d) => d.id === m.mount);
    if (!h || !dr) {
      m.ride = undefined;
      continue;
    }
    if (h.aloft !== dr.id) {
      // come down by the rider so they can climb on
      if (hunt.phase === "muster" || hunt.phase === "march") {
        if (dr.cmd?.kind !== "land" || Math.hypot((dr.cmd.x ?? 0) - h.x, (dr.cmd.y ?? 0) - h.y) > 120) dr.cmd = { kind: "land", x: h.x + 50, y: h.y + 10, t: 0, i: 1 };
      }
      continue;
    }
    const cmd = dr.cmd;
    if (hunt.phase === "muster") {
      if (!cmd || cmd.kind !== "stay") dr.cmd = { kind: "stay", x: dr.x, y: dr.y, t: 0, i: 1 };
    } else if (hunt.phase === "march" && hunt.engage) {
      const p = foePos(w, hunt.engage);
      if (p && (!cmd || cmd.kind !== "attack" || cmd.target !== hunt.engage)) dr.cmd = { kind: "attack", x: p.x, y: p.y, target: hunt.engage, t: 0, i: 1 };
    } else if (hunt.phase === "march" && m.sx !== undefined && m.sy !== undefined) {
      if (!cmd || (cmd.kind !== "flyTo" && cmd.kind !== "stay") || Math.hypot(cmd.x - m.sx, cmd.y - m.sy) > 40) dr.cmd = { kind: "flyTo", x: m.sx, y: m.sy, t: 0, i: 1 };
    } else if (hunt.phase === "battle") {
      const foe = hunt.clan ? clanFoe(w, hunt.clan, dr.x, dr.y) : hunt.dragon ? w.dragons.list.find((d) => d.id === hunt.dragon) ?? null : parent;
      if (foe && (!cmd || cmd.kind !== "attack" || cmd.target !== foe.id)) dr.cmd = { kind: "attack", x: foe.x, y: foe.y, target: foe.id, t: 0, i: 1 };
    } else if (hunt.phase === "collect") {
      if (!cmd || cmd.kind !== "stay") dr.cmd = { kind: "stay", x: dr.x, y: dr.y, t: 0, i: 1 };
    } else if (hunt.phase === "return" && (!cmd || cmd.kind !== "home")) dr.cmd = { kind: "home", x: 0, y: 0, t: 0, i: 1 };
  }
}

function dismount(w: World, h: Human) {
  h.chariot = undefined;
  h.z = 0;
  h.y += 24;
  go(h, "idle", h.x, h.y);
}

export function endHunt(w: World, hunt: DragonHunt, result: "won" | "lost", why: string) {
  hunt.result = result;
  hunt.phase = "return";
  hunt.t = 0;
  // a win at a nest: every egg there is ours. The beaten dragon abandons it, and the unit gathers them all up first.
  const nest = result === "won" && hunt.nest ? w.dragons.nests.find((n) => n.id === hunt.nest) ?? null : null;
  if (nest) {
    const parent = parentOf(w, nest);
    if (parent) {
      nestLost(w, parent);
      parent.nest = undefined;
      parent.state = "flee";
      parent.t = 0;
      const a = Math.atan2(parent.y - w.camp.y, parent.x - w.camp.x);
      parent.tx = parent.x + Math.cos(a) * 6000;
      parent.ty = parent.y + Math.sin(a) * 6000;
    }
    if (eggsToCollect(w, hunt).length) {
      hunt.phase = "collect";
      for (const c of huntChariots(w, hunt)) c.to = null;
    }
  }
  const fell = hunt.start - hunt.crew.filter((m) => !!person(w, m)).length;
  const eggs = hunt.crew.reduce((n, m) => n + eggsCarried(person(w, m) ?? ({} as Human)), 0) + hunt.eggs;
  for (const m of hunt.crew) {
    const h = person(w, m);
    if (h?.order?.kind === "hunt") h.order = null;
  }
  if (hunt.phase === "return") for (const c of huntChariots(w, hunt)) c.to = { x: c.homeX, y: c.homeY };
  if (result === "won") {
    w.celebrate("Victory!");
    w.sfx("cheer", w.camp.x, w.camp.y, 1);
    const left = hunt.phase === "collect" ? eggsToCollect(w, hunt).length : 0;
    w.toast("🏆", `VICTORY! ${why} ${left ? `Every egg is ours: the unit gathers up all ${left + eggs} before heading home. ` : eggs ? `${eggs} egg${eggs > 1 ? "s" : ""} coming home. ` : ""}${fell ? `${fell} fell in the fight. ` : ""}${left ? "" : "Everyone heads home."}`, w.camp.x, w.camp.y);
    if (!hunt.clan) w.discover("dragonRaid", w.camp.x, w.camp.y);
  } else {
    w.toast("💀", `DEFEAT. ${why} ${fell ? `${fell} lost. ` : ""}The survivors fall back to camp.`, w.camp.x, w.camp.y);
  }
}

/** A member's own part when not riding in a chariot or on a dragon. True = handled. */
export function huntThink(w: World, h: Human): boolean {
  const hunt = w.colony.hunt;
  if (!hunt || h.chariot || h.aloft) return false;
  const m = hunt.crew.find((x) => x.id === h.id);
  if (!m) return false;
  const tgt = targetOf(w, hunt);
  if (!tgt) return false;
  const car = m.chariot ? w.colony.chariots.find((c) => c.id === m.chariot) ?? null : null;
  if (m.chariot && !car) m.chariot = 0;
  const dino = m.ride === "dino" ? w.dinoById(m.mount ?? 0) : null;
  if (m.ride === "dino" && (!dino || dino.health <= 0)) m.ride = undefined;
  if (hunt.phase === "collect") return collectThink(w, h, hunt, m, car);
  if (hunt.phase === "return") {
    // an egg somebody dropped on the way (knocked down carrying it): whoever's near with a free hand takes it on
    if (hunt.result === "won" && eggsCarried(h) < eggCapacity(h)) {
      const loose = w.dragons.eggs.filter((e) => e.at === "ground" && Math.hypot(e.x - h.x, e.y - h.y) < 320 && !hunt.crew.some((o) => o.id !== h.id && person(w, o)?.targetId === -e.id - 1))
        .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (loose) {
        h.targetId = -loose.id - 1;
        if (Math.hypot(h.x - loose.x, h.y - loose.y) < 18) {
          pickEgg(w, h, loose);
          h.targetId = 0;
          say(h, "Got it, I'll carry it!");
        } else go(h, "walk", loose.x, loose.y + 4);
        return true;
      }
    }
    if (eggsCarried(h) && car && Math.hypot(h.x - car.x, h.y - car.y) < 160) return board(w, h, car, m);
    const home = { x: w.camp.x + ((h.id % 5) - 2) * 20, y: w.camp.y + 40 };
    go(h, "walk", home.x, home.y);
    if (Math.hypot(h.x - w.camp.x, h.y - w.camp.y) < 160) {
      if (eggsCarried(h)) settleCarried(w, h);
      hunt.crew = hunt.crew.filter((x) => x.id !== h.id);
      return false;
    }
    return true;
  }
  // first: get to their ride (a chariot seat, their dino, their dragon)
  if (hunt.phase === "muster" || hunt.phase === "march") {
    if (car) return board(w, h, car, m);
    if (m.ride === "dino" && dino && h.riding !== dino.id) {
      if (Math.hypot(h.x - dino.x, h.y - dino.y) < 44 && !dino.rider) mount(w, h, dino);
      else go(h, "walk", dino.x - dino.dir * 10, dino.y + 6);
      return true;
    }
    if (m.ride === "dragon") {
      const dr = w.dragons.owned.find((d) => d.id === m.mount);
      if (dr) {
        if (Math.hypot(h.x - dr.x, h.y - dr.y) < 50 && dr.z < 4 && !dr.rider) {
          mountDragon(w, h, dr);
          dr.cmd = { kind: "stay", x: dr.x, y: dr.y, t: 0, i: 1 };
          say(h, `Up, ${dr.name}!`);
        } else go(h, "walk", dr.x - 30, dr.y + 8);
        return true;
      }
    }
  }
  if (hunt.phase === "muster") {
    // mounted (or on foot): wait at the muster point
    const mp = musterPoint(w, tgt.x, tgt.y);
    const spot = { x: mp.x + ((h.id % 5) - 2) * 26, y: mp.y + ((h.id >> 2) % 3) * 18 };
    if (Math.hypot(h.x - spot.x, h.y - spot.y) > 20) go(h, "walk", spot.x, spot.y);
    else if (h.state !== "idle") go(h, "idle", h.x, h.y);
    return true;
  }
  if (hunt.phase === "march" && hunt.engage) {
    // stopped to fight something on the way
    h.order = { kind: "hunt", id: hunt.engage };
    return false;
  }
  if (hunt.phase === "march") {
    if (h.order?.kind === "hunt") h.order = null;
    // to their place round the target
    if (m.sx !== undefined && m.sy !== undefined) {
      if (Math.hypot(h.x - m.sx, h.y - m.sy) > 30) go(h, "walk", m.sx, m.sy);
      else if (h.state !== "guard") go(h, "guard", h.x, h.y);
    }
    return true;
  }
  // battle
  if (hunt.dragon) {
    h.order = { kind: "hunt", id: hunt.dragon };
    return false;
  }
  if (hunt.clan) {
    const foe = clanFoe(w, hunt.clan, h.x, h.y);
    if (foe) {
      h.order = { kind: "hunt", id: foe.id };
      return false; // the hunt order does the fighting (roleThink)
    }
    return false;
  }
  const nest = w.dragons.nests.find((n) => n.id === hunt.nest);
  if (!nest) return false;
  const parent = parentOf(w, nest);
  if (m.runner) {
    if (eggsCarried(h) >= eggCapacity(h) || (eggsCarried(h) && !nestEggs(w, nest).length)) {
      // back aboard with them (or run home if the chariot's gone)
      if (car) return board(w, h, car, m);
      go(h, "walk", w.camp.x, w.camp.y + 40);
      return true;
    }
    const egg = nestEggs(w, nest)[0];
    if (!egg) return false;
    if (Math.hypot(h.x - egg.x, h.y - egg.y) < 18) {
      pickEgg(w, h, egg);
      return true;
    }
    go(h, "walk", egg.x, egg.y + 4);
    return true;
  }
  if (parent) {
    h.order = { kind: "hunt", id: parent.id };
    return false; // the hunt order does the fighting (roleThink)
  }
  return false;
}

/** Every egg still to be gathered after a win: in the nest, or lying loose round about it. */
export function eggsToCollect(w: World, hunt: DragonHunt) {
  const nest = hunt.nest ? w.dragons.nests.find((n) => n.id === hunt.nest) : null;
  if (!nest) return [];
  return w.dragons.eggs.filter((e) => (e.at === "nest" && e.nest === nest.id) || (e.at === "ground" && Math.hypot(e.x - nest.x, e.y - nest.y) < 600));
}

/** After a win: pick up the nearest egg nobody else is going for, until hands are full; then back aboard. */
function collectThink(w: World, h: Human, hunt: DragonHunt, m: Member, car: Chariot | null) {
  if (eggsCarried(h) < eggCapacity(h)) {
    const mine = (e: DragonEgg) => !hunt.crew.some((o) => o.id !== h.id && person(w, o)?.targetId === -e.id - 1);
    const egg = eggsToCollect(w, hunt).filter(mine).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (egg) {
      h.targetId = -egg.id - 1;
      if (Math.hypot(h.x - egg.x, h.y - egg.y) < 18) {
        pickEgg(w, h, egg);
        h.targetId = 0;
        say(h, eggsCarried(h) > 1 ? "Two!" : "Got one!");
      } else go(h, "walk", egg.x, egg.y + 4);
      return true;
    }
  }
  h.targetId = 0;
  // hands full (or none left): back aboard, or wait by the nest for the others
  if (car) return board(w, h, car, m);
  if (h.state !== "guard") go(h, "guard", h.x, h.y);
  return true;
}

/** Walk to the chariot and climb into the seat. */
function board(w: World, h: Human, c: Chariot, m: Member) {
  const p = seatPos(c, m.seat);
  if (Math.hypot(h.x - c.x, h.y - c.y) < 34) {
    h.chariot = c.id;
    h.order = null;
    h.x = p.x;
    h.y = p.y;
    h.z = p.z;
    say(h, pick(w.rng, ["Aboard!", "Spears ready!", "Let's go!"]));
    return true;
  }
  go(h, "walk", c.x, c.y + 10);
  return true;
}

/** Dino stepping: a harnessed trike is moved by its chariot. */
export const harnessed = (d: Dino) => !!d.chariot;

/** Building cost line for the UI. */
export const CHARIOT_DEF = BUILDINGS.warChariot;
