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
import { eggCapacity, eggsCarried, isRunner, pickEgg, raidTarget, settleCarried, slayerDamage } from "./dragonRaid";
import { nestEggs, parentOf, revealNest } from "./dragonNests";
import { canFly, mountDragon, rideable } from "./dragonKeep";
import { mount } from "./tasks";
import { partnerOf } from "./riders";
import { sp } from "../data/species";
import type { Building, Chariot, Dino, Dragon, DragonHunt, Human, HuntFormation } from "./types";
import type { World } from "./world";

export const SEATS = 10;
export const CHARIOT_HP = 320;
const SPEED = 62;
/** how far round the nest the formation stands */
const RING_R = 300;
const MUSTER_FOR = 120;
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
    if (isRunner(w, h)) continue;
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
        hitChariot(w, c, 9 + w.rng() * 12, `the ${w.rivals.clan(b.clan)?.name ?? ""} clan`);
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
  if (hunt.clan) {
    const c = w.rivals.clan(hunt.clan);
    return c ? { x: c.x, y: c.y, r: (c.colors?.length ?? 1) > 1 || (c.campTier ?? 0) >= 4 ? 380 : 270, name: `the ${c.name} camp` } : null;
  }
  const n = w.dragons.nests.find((x) => x.id === hunt.nest);
  return n ? { x: n.x, y: n.y, r: RING_R, name: "the dragon's nest" } : null;
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
}

/** Send a force out (returns why not). */
export function startHunt(w: World, formation: HuntFormation, opts: ExpeditionOpts = {}): string | null {
  const col = w.colony;
  if (col.hunt) return "An attack is already under way.";
  let nestId = 0;
  if (opts.clan) {
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
  const runners = opts.clan ? [] : band.filter((h) => role(h) === "eggRunner");
  if (!opts.clan && !runners.length) runners.push(...band.filter((h) => role(h) !== "dragonSlayer" && !ownDragon(w, h) && !ownDino(w, h)).slice(0, Math.min(2, Math.max(1, cars.length * 2))));
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
  col.hunt = { nest: nestId, ...(opts.clan ? { clan: opts.clan } : {}), formation, phase: "muster", t: 0, crew, start: crew.length, eggs: 0 };
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
  if (!tgt) return endHunt(w, hunt, hunt.clan ? "won" : "lost", hunt.clan ? "The clan is broken and scattered!" : "The nest is gone.");
  const nest = hunt.nest ? w.dragons.nests.find((n) => n.id === hunt.nest) ?? null : null;
  const parent = nest ? parentOf(w, nest) : null;
  const need = Math.ceil(alive.length * READY_SHARE);
  // the dragons carry their riders: steer them from here (a rider aloft doesn't think for themselves)
  steerDragons(w, hunt, tgt, parent);
  switch (hunt.phase) {
    case "muster": {
      const mp = musterPoint(w, tgt.x, tgt.y);
      const set = alive.filter((m) => ready(w, m, mp)).length;
      if ((set >= need && alive.length) || hunt.t > MUSTER_FOR) {
        hunt.phase = "march";
        hunt.t = 0;
        // places in the formation: chariots on the outer line, riders + those on foot just inside
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
        w.sfx("drums", tgt.x, tgt.y, 1, 0.8);
        w.toast("🛡️", `${set} of ${alive.length} ready: the force sets out for ${tgt.name}${cars.length ? ", the war chariots in front" : ""}!`, mp.x, mp.y);
      }
      return;
    }
    case "march": {
      const placed = alive.filter((m) => inPlace(w, m)).length;
      if (nest && cars.some((c) => Math.hypot(c.x - nest.x, c.y - nest.y) < RING_R + 220)) revealNest(w, nest, "the chariot crews");
      if ((placed >= need && alive.length) || hunt.t > 300) {
        hunt.phase = "battle";
        hunt.t = 0;
        w.sfx("drums", tgt.x, tgt.y, 1.3, 0.7);
        w.toast("⚔️", hunt.clan ? `${placed} of ${alive.length} in place round ${tgt.name}: ATTACK!` : parent ? `Surrounded! ${placed} of ${alive.length} in place: spears + Scorpions at ${parent.name} from every side!` : "The nest is unguarded: runners, go!", tgt.x, tgt.y);
      }
      break;
    }
    case "battle": {
      if (alive.length < Math.ceil(hunt.start * 0.35) || hunt.t > BATTLE_FOR) {
        endHunt(w, hunt, "lost", hunt.clan ? `The ${w.rivals.clan(hunt.clan)?.name ?? ""} clan drove us off.` : parent ? `${parent.name} beat off the attack.` : "The attack fell apart.");
        return;
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
        for (const c of cars) {
          for (const h of crewOf(w, c)) {
            if (!isRunner(w, h) || eggsCarried(h)) continue;
            h.chariot = undefined;
            h.z = 0;
            const m = hunt.crew.find((x) => x.id === h.id);
            if (m) m.chariot = 0;
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
    case "return": {
      for (const c of cars) if (!c.to && Math.hypot(c.x - c.homeX, c.y - c.homeY) > 20) c.to = { x: c.homeX, y: c.homeY };
      const home = cars.every((c) => Math.hypot(c.x - c.homeX, c.y - c.homeY) < 24);
      const back = alive.every((m) => m.chariot || Math.hypot(person(w, m)!.x - w.camp.x, person(w, m)!.y - w.camp.y) < 420);
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
    } else if (hunt.phase === "march" && m.sx !== undefined && m.sy !== undefined) {
      if (!cmd || (cmd.kind !== "flyTo" && cmd.kind !== "stay") || Math.hypot(cmd.x - m.sx, cmd.y - m.sy) > 40) dr.cmd = { kind: "flyTo", x: m.sx, y: m.sy, t: 0, i: 1 };
    } else if (hunt.phase === "battle") {
      const foe = hunt.clan ? clanFoe(w, hunt.clan, dr.x, dr.y) : parent;
      if (foe && (!cmd || cmd.kind !== "attack" || cmd.target !== foe.id)) dr.cmd = { kind: "attack", x: foe.x, y: foe.y, target: foe.id, t: 0, i: 1 };
    } else if (hunt.phase === "return" && (!cmd || cmd.kind !== "home")) dr.cmd = { kind: "home", x: 0, y: 0, t: 0, i: 1 };
  }
}

function dismount(w: World, h: Human) {
  h.chariot = undefined;
  h.z = 0;
  h.y += 24;
  go(h, "idle", h.x, h.y);
}

function endHunt(w: World, hunt: DragonHunt, result: "won" | "lost", why: string) {
  hunt.result = result;
  hunt.phase = "return";
  hunt.t = 0;
  const fell = hunt.start - hunt.crew.filter((m) => !!person(w, m)).length;
  const eggs = hunt.crew.reduce((n, m) => n + eggsCarried(person(w, m) ?? ({} as Human)), 0) + hunt.eggs;
  for (const m of hunt.crew) {
    const h = person(w, m);
    if (h?.order?.kind === "hunt") h.order = null;
  }
  for (const c of huntChariots(w, hunt)) c.to = { x: c.homeX, y: c.homeY };
  if (result === "won") {
    w.celebrate("Victory!");
    w.sfx("cheer", w.camp.x, w.camp.y, 1);
    w.toast("🏆", `VICTORY! ${why} ${eggs ? `${eggs} egg${eggs > 1 ? "s" : ""} coming home. ` : ""}${fell ? `${fell} fell in the fight. ` : ""}Everyone heads home.`, w.camp.x, w.camp.y);
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
  if (hunt.phase === "return") {
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
  if (hunt.phase === "march") {
    // to their place round the target
    if (m.sx !== undefined && m.sy !== undefined) {
      if (Math.hypot(h.x - m.sx, h.y - m.sy) > 30) go(h, "walk", m.sx, m.sy);
      else if (h.state !== "guard") go(h, "guard", h.x, h.y);
    }
    return true;
  }
  // battle
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
