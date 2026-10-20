/* ------------------------------------------------------------------ */
/*  Clan life: the Neanderthals run their camps the way we run ours.   */
/*                                                                     */
/*  Grown-ups go out and fetch what their camp needs: dino bones off   */
/*  carcasses, wood off trees. Builders put it into the next project   */
/*  (a longhouse, a smokehouse, a bone weapon rack, a training ring,   */
/*  a dragon altar) and level them up. Warriors spar at the ring and   */
/*  get better at fighting. Hunters go out in packs and take bigger    */
/*  dinosaurs. And they dig hidden pit traps out where our people      */
/*  work: whoever falls in is fetched back to the camp (and, once      */
/*  there's an altar, offered to a dragon: see clanRite.ts).           */
/*                                                                     */
/*  With a dino pen they tame wild dinosaurs. Their war-dinos live in  */
/*  the pen, and charge our walls alongside them when they raid.       */
/* ------------------------------------------------------------------ */
import { CAMP_LEVELS } from "../data/facts";
import { P } from "./particles";
import { pick } from "./rng";
import { GROWN_AGE, moveBrute, say, setB, type Rivals } from "./rivals";
import { isTown } from "./clanTowns";
import { hasTech } from "./clanTech";
import { sp } from "../data/species";
import { isBaby, setState, sizeOf } from "./dinos";
import type { Brute, Clan, ClanBuild, ClanTrap, Dino, Human } from "./types";
import type { World } from "./world";

export interface BuildDef {
  label: string;
  icon: string;
  max: number;
  /** what the next level costs */
  cost: (lv: number) => { bones: number; wood: number; food: number };
  /** builder-seconds of work */
  work: number;
}

export const CLAN_BUILDS: Record<ClanBuild, BuildDef> = {
  longhouse: { label: "longhouse", icon: "🛖", max: 3, cost: (lv) => ({ bones: 2 + lv, wood: 4 + lv * 2, food: 1 }), work: 14 },
  smokehouse: { label: "smokehouse", icon: "🍖", max: 2, cost: (lv) => ({ bones: 1, wood: 3 + lv * 2, food: 2 }), work: 10 },
  boneRack: { label: "bone weapon rack", icon: "🦴", max: 2, cost: (lv) => ({ bones: 4 + lv * 2, wood: 2, food: 0 }), work: 10 },
  trainingRing: { label: "training ring", icon: "🤼", max: 2, cost: (lv) => ({ bones: 2 + lv * 2, wood: 4, food: 1 }), work: 12 },
  dragonAltar: { label: "dragon altar", icon: "🐉", max: 1, cost: () => ({ bones: 8, wood: 3, food: 2 }), work: 16 },
  dinoPen: { label: "dino pen", icon: "🦖", max: 2, cost: (lv) => ({ bones: 3 + lv * 2, wood: 6 + lv * 2, food: 2 }), work: 14 },
  // the dino bones they collect go into a fence of ribs, tusks + skulls right round the camp
  boneFence: { label: "bone fence", icon: "🦴", max: 2, cost: (lv) => ({ bones: 10 + lv * 6, wood: 4, food: 0 }), work: 16 },
  // (once they've worked out bone totems: clanTech.ts) each one speeds up their learning
  boneTotem: { label: "bone totem", icon: "🗿", max: 3, cost: (lv) => ({ bones: 5 + lv * 2, wood: 1, food: 1 }), work: 10 },
};

/** Buildings they have to invent first. */
const LOCKED: Partial<Record<ClanBuild, Parameters<typeof hasTech>[1]>> = { boneTotem: "boneTotems" };

/** The order a clan builds things in (a name repeated = its next level). */
const PLAN: ClanBuild[] = ["longhouse", "smokehouse", "trainingRing", "boneFence", "dinoPen", "dragonAltar", "boneTotem", "boneRack", "longhouse", "boneFence", "dinoPen", "boneTotem", "trainingRing", "boneRack", "smokehouse", "boneTotem", "longhouse"];

/** Where each building stands, from the middle of the camp. */
const SITES: Record<ClanBuild, [number, number]> = {
  longhouse: [-245, -24],
  smokehouse: [235, -44],
  boneRack: [-215, 86],
  trainingRing: [250, 96],
  dragonAltar: [0, -190],
  dinoPen: [-10, 190],
  boneFence: [0, 0],
  boneTotem: [-120, -95],
};

/** The bone fence goes right round everything they've built. */
export function fenceSize(c: Clan) {
  return isTown(c) ? { rx: 440, ry: 330 } : { rx: 310, ry: 240 };
}

export const lvOf = (c: Clan, k: ClanBuild) => c.builds?.[k] ?? 0;

export function siteOf(c: Clan, k: ClanBuild) {
  const s = isTown(c) ? 1.45 : 1;
  return { x: c.x + SITES[k][0] * s, y: c.y + SITES[k][1] * s };
}
export const altarOf = (c: Clan) => siteOf(c, "dragonAltar");

/** The next thing the clan wants to build (null = all done). */
export function nextProject(c: Clan): ClanBuild | null {
  const want: Partial<Record<ClanBuild, number>> = {};
  for (const k of PLAN) {
    const need = LOCKED[k];
    if (need && !hasTech(c, need)) continue;
    want[k] = (want[k] ?? 0) + 1;
    if (lvOf(c, k) < Math.min(want[k]!, CLAN_BUILDS[k].max)) return k;
  }
  return null;
}

export const costOf = (c: Clan, k: ClanBuild) => CLAN_BUILDS[k].cost(lvOf(c, k));
export function canAfford(c: Clan, k: ClanBuild) {
  const n = costOf(c, k);
  return (c.bones ?? 0) >= n.bones && (c.wood ?? 0) >= n.wood && c.food >= n.food + 2;
}

/** Food spoils slower with a smokehouse. */
export const spoilRate = (c: Clan) => 1 - lvOf(c, "smokehouse") * 0.3;
/** A longhouse makes room for more of them. */
export const extraRoom = (c: Clan) => lvOf(c, "longhouse") * 2;
/** Bone-tipped weapons from the rack: they hit (dinos) harder. */
export const huntPower = (b: Brute, c: Clan | null) => (1 + (b.skill ?? 0) * 0.6) * (1 + (c ? lvOf(c, "boneRack") : 0) * 0.25);

const grown = (b: Brute) => (b.age ?? GROWN_AGE) >= GROWN_AGE;
/** free to be given a job */
export const freeHand = (b: Brute) => grown(b) && !b.raid && !b.war && !b.captive && !b.ambush && !b.loot && !b.forage && !b.haul && !b.snatched && b.weapon !== "catapult" && b.hp > 0.4 && ["idle", "wander", "home"].includes(b.state);

const JOB_STATES = new Set<Brute["state"]>(["gather", "build", "train", "trap", "collect", "tame"]);

/** The clan's tamed war-dinos. */
export const clanDinos = (w: World, clan: Clan) => w.dinos.filter((d) => d.clan === clan.id);
/** room in the pen: two beasts a level */
const penRoom = (w: World, clan: Clan) => lvOf(clan, "dinoPen") * 2 - clanDinos(w, clan).length;

/** A wild beast worth taming: plant-eaters up to a good size, or a smaller hunter. */
function tameable(w: World, d: Dino, clan: Clan) {
  if (d.owner || d.raider || d.clan || d.migrant || d.under || isBaby(d) || d.health < 0.5) return false;
  const def = sp(d.species);
  if (def.move !== "walk") return false;
  const size = sizeOf(d);
  if (def.diet === "herbivore" ? size > 95 : size > 70) return false;
  return Math.hypot(d.x - clan.x, d.y - clan.y) < 950;
}

/* ------------------------------ choosing a job ------------------------------ */

/** Everyday work for a grown-up at home (true = it's busy with something). */
export function clanJob(w: World, r: Rivals, b: Brute, clan: Clan): boolean {
  if (JOB_STATES.has(b.state)) return true;
  // the pen has room: go and tame a beast for it
  if (penRoom(w, clan) > 0 && w.rng() < 0.25 && !r.members(clan.id).some((o) => o.state === "tame")) {
    const d = w.dinos.filter((x) => tameable(w, x, clan)).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
    if (d) {
      b.targetId = d.id;
      b.work = 0;
      setB(b, "tame", d.x, d.y);
      say(b, "Me get beast.", 1.6);
      return true;
    }
  }
  const project = nextProject(clan);
  const roll = w.rng();
  if (project) {
    const need = costOf(clan, project);
    if (canAfford(clan, project)) {
      const builders = r.members(clan.id).filter((o) => o.state === "build").length;
      if (builders < 3 && roll < 0.6) {
        const s = siteOf(clan, project);
        b.job = project;
        setB(b, "build", s.x + (w.rng() - 0.5) * 60, s.y + 16 + w.rng() * 12);
        if (w.rng() < 0.5) say(b, pick(w.rng, ["Build!", "Make big!", "Ugh. Lift."]), 1.6);
        return true;
      }
    } else if (roll < 0.7) {
      const bonesShort = (clan.bones ?? 0) < need.bones;
      const woodShort = (clan.wood ?? 0) < need.wood;
      const src = (bonesShort && boneSource(w, r, clan, b)) || (woodShort && woodSource(w, r, clan, b)) || null;
      if (src) {
        b.job = src.key;
        setB(b, "gather", src.x, src.y);
        return true;
      }
    }
  }
  const ring = lvOf(clan, "trainingRing");
  if (ring && (b.skill ?? 0) < ring * 0.5 && roll > 0.7) {
    const s = siteOf(clan, "trainingRing");
    const a = w.rng() * Math.PI * 2;
    setB(b, "train", s.x + Math.cos(a) * 26, s.y + Math.sin(a) * 14);
    return true;
  }
  return false;
}

/** Bones to strip: a carcass, or loose bones / fossils lying about. */
function boneSource(w: World, r: Rivals, clan: Clan, b: Brute) {
  let best: { key: string; x: number; y: number } | null = null;
  let bd = 900;
  for (const it of w.items) {
    const ok = it.kind === "carcass" ? (it.carcass?.bone ?? 0) > 0 && !it.draggedBy : (it.kind === "bones" || it.kind === "fossil") && it.amount > 0 && !it.claimed;
    if (!ok || Math.hypot(it.x - clan.x, it.y - clan.y) > 900) continue;
    const key = `i${it.id}`;
    if (r.brutes.some((o) => o !== b && o.state === "gather" && o.job === key)) continue;
    const d = Math.hypot(it.x - b.x, it.y - b.y);
    if (d < bd && w.nav.passable("dino", it.x, it.y)) {
      bd = d;
      best = { key, x: it.x, y: it.y };
    }
  }
  return best;
}

/** A tree to take branches from (a bush or a dropped stick will do). */
function woodSource(w: World, r: Rivals, clan: Clan, b: Brute) {
  let best: { key: string; x: number; y: number } | null = null;
  let bs = Infinity;
  const consider = (key: string, x: number, y: number, penalty: number) => {
    if (Math.hypot(x - clan.x, y - clan.y) > 1000) return;
    if (r.brutes.some((o) => o !== b && o.state === "gather" && o.job === key)) return;
    const s = Math.hypot(x - b.x, y - b.y) + penalty;
    if (s < bs && w.nav.passable("dino", x, y)) {
      bs = s;
      best = { key, x, y };
    }
  };
  for (const p of w.plants) {
    if (p.stump || p.burnt > 0.4 || p.size < 0.4 || p.kind === "reeds") continue;
    const tree = p.kind === "conifer" || p.kind === "broadleaf" || p.kind === "palm" || p.kind === "fruit" || p.kind === "cycad";
    consider(`p${p.id}`, p.x, p.y + 10, tree ? 0 : 250);
  }
  for (const it of w.items) if (it.kind === "stick" && it.amount > 0 && !it.claimed) consider(`i${it.id}`, it.x, it.y, 0);
  return best;
}

/* ------------------------------ doing it ------------------------------ */

const home = (w: World, b: Brute, clan: Clan) => setB(b, "home", clan.x + (w.rng() - 0.5) * 60, clan.y + 14 + w.rng() * 10);

/** Bodies for the job states (true = handled). */
export function lifeAct(w: World, r: Rivals, b: Brute, clan: Clan | null, dt: number): boolean {
  if (!JOB_STATES.has(b.state)) return false;
  if (!clan) {
    setB(b, "idle", b.x, b.y);
    return true;
  }
  switch (b.state) {
    case "gather": {
      if (Math.hypot(b.x - b.tx, b.y - b.ty) > 22) {
        moveBrute(w, b, dt, 34);
        if (b.stateT > 60) setB(b, "idle", b.x, b.y);
        b.stateT = Math.min(b.stateT, 50);
        return true;
      }
      b.vx = b.vy = 0;
      b.anim += dt * 5;
      if (w.rng() < dt * 2) {
        w.sfx(b.job?.startsWith("p") ? "chop" : "crack", b.x, b.y, 0.4, 0.8);
        w.particles.burst(b.job?.startsWith("p") ? P.Leaf : P.Crumb, b.x + b.dir * 10, b.y, 3, 30, { z: 14, size: 2.5, max: 0.6, color: b.job?.startsWith("p") ? "#6b9a3f" : "#e8dfc8" });
      }
      if (!b.work) b.work = 0;
      b.work += dt;
      // bone tools: quicker at it
      if (b.work < (hasTech(clan, "boneTools") ? 2 : 3)) return true;
      b.work = 0;
      const got = take(w, b);
      if (got) {
        b.haul = got;
        say(b, got.r === "bones" ? "BONES!" : "Wood.", 1.4);
      }
      home(w, b, clan);
      return true;
    }
    case "build": {
      const k = b.job as ClanBuild | undefined;
      if (!k || nextProject(clan) !== k || !canAfford(clan, k) || b.stateT > 50) {
        setB(b, "idle", b.x, b.y);
        return true;
      }
      if (Math.hypot(b.x - b.tx, b.y - b.ty) > 10) {
        moveBrute(w, b, dt, 36);
        return true;
      }
      b.vx = b.vy = 0;
      b.anim += dt * 4;
      const s = siteOf(clan, k);
      b.dir = s.x > b.x ? 1 : -1;
      if (w.rng() < dt * 1.6) {
        w.sfx("knock", b.x, b.y, 0.4, 0.7 + w.rng() * 0.2);
        w.particles.burst(P.Dust, s.x + (w.rng() - 0.5) * 50, s.y, 3, 30, { size: 9, max: 0.8, color: "rgba(150,125,95,0.55)" });
      }
      clan.buildWork = (clan.buildWork ?? 0) + dt * 0.3 * (1 + (b.skill ?? 0) * 0.3) * (hasTech(clan, "boneTools") ? 1.3 : 1);
      if (clan.buildWork >= CLAN_BUILDS[k].work) finish(w, r, clan, k);
      return true;
    }
    case "train": {
      if (Math.hypot(b.x - b.tx, b.y - b.ty) > 8) {
        moveBrute(w, b, dt, 40);
        if (b.stateT > 40) setB(b, "idle", b.x, b.y);
        return true;
      }
      b.vx = b.vy = 0;
      const s = siteOf(clan, "trainingRing");
      // spar with whoever else is in the ring (or the hide dummy)
      const mate = r.brutes.find((o) => o !== b && o.state === "train" && o.clan === b.clan && Math.hypot(o.x - b.x, o.y - b.y) < 70);
      b.dir = (mate ? mate.x : s.x) > b.x ? 1 : -1;
      b.anim += dt * 5;
      b.cd -= dt;
      if (b.cd <= 0) {
        b.cd = 0.9 + w.rng() * 0.5;
        w.sfx("thunk", b.x, b.y, 0.25, 0.9 + w.rng() * 0.3);
        w.particles.burst(P.Star, b.x + b.dir * 14, b.y, 2, 24, { z: 22, size: 4, max: 0.4 });
        if (w.rng() < 0.15) say(b, pick(w.rng, ["HUH!", "Hah!", "Again!", "Strong!"]), 1.1);
      }
      const ring = lvOf(clan, "trainingRing");
      b.skill = Math.min(ring * 0.5, (b.skill ?? 0) + dt * 0.004 * ring);
      if (b.stateT > 25 || (b.skill ?? 0) >= ring * 0.5) setB(b, "idle", b.x, b.y);
      return true;
    }
    case "trap": {
      if (Math.hypot(b.x - b.tx, b.y - b.ty) > 8) {
        moveBrute(w, b, dt, 36);
        if (b.stateT > 90) home(w, b, clan);
        return true;
      }
      b.vx = b.vy = 0;
      b.anim += dt * 4;
      b.work = (b.work ?? 0) + dt;
      if (w.rng() < dt * 3) w.particles.burst(P.Dust, b.x + b.dir * 10, b.y, 2, 30, { size: 8, max: 0.7, color: "rgba(120,95,60,0.6)" });
      if (b.work >= 4) {
        b.work = 0;
        r.traps.push({ id: w.nextId(), clan: clan.id, x: b.tx, y: b.ty, t: 0, caught: 0 });
        say(b, "Heh heh.", 1.6);
        home(w, b, clan);
      }
      return true;
    }
    case "tame": {
      const d = w.dinoById(b.targetId);
      if (!d || !tameable(w, d, clan) || b.stateT > 70) {
        b.work = 0;
        home(w, b, clan);
        return true;
      }
      b.tx = d.x;
      b.ty = d.y;
      const reach = 22 + sizeOf(d) * 0.4;
      if (Math.hypot(d.x - b.x, d.y - b.y) > reach) {
        moveBrute(w, b, dt, 34);
        return true;
      }
      // calm it down: grunts, a hand held out, something to eat
      b.vx = b.vy = 0;
      b.dir = d.x > b.x ? 1 : -1;
      b.anim += dt * 2;
      if (d.state !== "idle") setState(d, "idle", d.x, d.y);
      d.fear = 0;
      b.work = (b.work ?? 0) + dt;
      if (w.rng() < dt * 0.5) say(b, pick(w.rng, ["Easy…", "Good beast.", "Hrrm. Stay.", "Eat. Eat."]), 1.4);
      if (b.work >= 6) {
        b.work = 0;
        const pen = siteOf(clan, "dinoPen");
        d.clan = clan.id;
        d.homeX = pen.x;
        d.homeY = pen.y;
        d.hunger = Math.min(d.hunger, 0.3);
        setState(d, "wander", pen.x + (w.rng() - 0.5) * 60, pen.y + (w.rng() - 0.5) * 24);
        w.particles.burst(P.Heart, d.x, d.y, 3, 30, { z: sizeOf(d) * 0.5, size: 8, max: 1 });
        say(b, "MINE now!", 1.8);
        if (!w.flags.has(`clanTame${clan.id}`)) {
          w.flags.add(`clanTame${clan.id}`);
          w.toast("🦖", `The ${clan.name} clan tamed a wild ${sp(d.species).nick} for their pen. It'll charge with them when they raid us!`, d.x, d.y);
        }
        home(w, b, clan);
      }
      return true;
    }
    case "collect": {
      const h = w.humans.find((o) => o.id === b.targetId);
      if (!h || h.captive !== clan.id || r.brutes.some((o) => o !== b && o.captive === h.id)) {
        home(w, b, clan);
        return true;
      }
      b.tx = h.x;
      b.ty = h.y;
      if (Math.hypot(h.x - b.x, h.y - b.y) > 20) {
        moveBrute(w, b, dt, 44);
        return true;
      }
      // haul them out of the pit and off home
      const trap = r.traps.find((t) => t.caught === h.id);
      if (trap) r.traps.splice(r.traps.indexOf(trap), 1);
      h.captive = 0;
      r.grab(w, b, h);
      return true;
    }
  }
  return false;
}

/** Strip what the job was after. */
function take(w: World, b: Brute): Brute["haul"] | null {
  const id = Number(b.job?.slice(1));
  if (b.job?.startsWith("p")) {
    const p = w.plants.find((x) => x.id === id && !x.stump);
    if (!p) return null;
    p.shake = 0.6;
    return { r: "wood", n: 2 };
  }
  const it = w.items.find((x) => x.id === id);
  if (!it) return null;
  if (it.kind === "stick") {
    it.amount -= 1;
    if (it.amount <= 0.01) w.removeItem(it);
    return { r: "wood", n: 2 };
  }
  if (it.kind === "carcass" && it.carcass) {
    const n = Math.min(2, it.carcass.bone);
    if (n <= 0) return null;
    it.carcass.bone -= n;
    return { r: "bones", n: Math.max(1, Math.round(n)) };
  }
  const n = Math.min(1, it.amount);
  it.amount -= n;
  if (it.amount <= 0.01) w.removeItem(it);
  return { r: "bones", n: 2 };
}

function finish(w: World, r: Rivals, clan: Clan, k: ClanBuild) {
  const n = costOf(clan, k);
  clan.bones = (clan.bones ?? 0) - n.bones;
  clan.wood = (clan.wood ?? 0) - n.wood;
  clan.food -= n.food;
  clan.buildWork = 0;
  clan.builds = { ...(clan.builds ?? {}), [k]: lvOf(clan, k) + 1 };
  const s = siteOf(clan, k);
  w.particles.burst(P.Dust, s.x, s.y, 14, 70, { size: 16, max: 1.1, color: "rgba(160,135,100,0.6)" });
  w.sfx("build", s.x, s.y, 0.7, 0.8);
  for (const b of r.members(clan.id)) if (b.state === "build") {
    setB(b, "idle", b.x, b.y);
    say(b, "UGH! Done!", 1.8);
  }
  const lv = lvOf(clan, k);
  const what = CLAN_BUILDS[k];
  const extra = k === "dragonAltar" ? " They mean to make friends with the dragons… keep your people away from their traps!" : k === "trainingRing" ? " Their warriors will spar there and get tougher." : k === "boneRack" ? " Bone-tipped weapons: their hunters hit harder." : "";
  w.toast(what.icon, `The ${clan.name} clan ${lv > 1 ? `upgraded their ${what.label} (level ${lv})` : `built a ${what.label}`}.${extra}`, s.x, s.y);
}

/* ------------------------------ pit traps ------------------------------ */

const campR = (w: World) => CAMP_LEVELS[w.tribe.level]?.radius ?? 300;

/** Once a second: maybe send someone to dig a pit where our people walk. */
export function trapTick(w: World, r: Rivals, clan: Clan, dt: number) {
  if (!((clan.smarts ?? 0) >= 1 || lvOf(clan, "trainingRing") > 0)) return;
  if (w.tribe.danger === "calm" || w.daylight < 0.45 || w.elapsed < 400) return;
  if (r.traps.filter((t) => t.clan === clan.id).length >= 2) return;
  clan.trapT = (clan.trapT ?? 120 + w.rng() * 80) - dt;
  if (clan.trapT > 0) return;
  clan.trapT = 160 + w.rng() * 120;
  // one of ours out working beyond the camp: dig a pit on their way home
  const c = w.camp;
  const out = w.humans.filter((h) => !h.child && !h.captive && !h.stranger && !h.aloft && !h.under && !h.riding && Math.hypot(h.x - c.x, h.y - c.y) > campR(w) + 60);
  if (!out.length) return;
  const h = pick(w.rng, out);
  const a = Math.atan2(c.y - h.y, c.x - h.x);
  const k = 50 + w.rng() * 50;
  const x = h.x + Math.cos(a) * k + (w.rng() - 0.5) * 20;
  const y = h.y + Math.sin(a) * k + (w.rng() - 0.5) * 14;
  if (!w.nav.passable("human", x, y) || !w.nav.passable("dino", x, y)) return;
  const digger = r.members(clan.id).filter(freeHand).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0];
  if (!digger) return;
  setB(digger, "trap", x, y);
  digger.work = 0;
  say(digger, "Shh.", 1.4);
}

/** Every frame: anyone walking over a hidden pit falls in, and the clan comes to fetch them. */
export function trapsUpdate(w: World, r: Rivals, dt: number) {
  for (let i = r.traps.length - 1; i >= 0; i--) {
    const t = r.traps[i];
    const clan = r.clan(t.clan);
    if (!clan) {
      if (t.caught) freeFromPit(w, t);
      r.traps.splice(i, 1);
      continue;
    }
    t.t += dt;
    if (t.caught) {
      const h = w.humans.find((o) => o.id === t.caught);
      // rescued (or gone)
      if (!h || h.captive !== clan.id) {
        r.traps.splice(i, 1);
        continue;
      }
      if (!r.brutes.some((b) => b.captive === h.id)) {
        h.x = t.x;
        h.y = t.y;
        h.z = -8;
        if (w.rng() < dt * 0.25) say(h, pick(w.rng, ["Help! I'm stuck!", "Get me out!", "HELP!"]), 2);
      }
      // nobody's coming yet: send someone
      if (!r.brutes.some((b) => (b.state === "collect" && b.targetId === h.id) || b.captive === h.id)) {
        const b = r.members(clan.id).filter((o) => freeHand(o) || o.state === "gather" || o.state === "train").sort((p, q) => Math.hypot(p.x - t.x, p.y - t.y) - Math.hypot(q.x - t.x, q.y - t.y))[0];
        if (b) {
          b.targetId = h.id;
          setB(b, "collect", t.x, t.y);
          say(b, "Got one!", 1.6);
        }
      }
      continue;
    }
    if (t.t > 600) {
      r.traps.splice(i, 1);
      continue;
    }
    const h = w.humans.find((o) => !o.captive && !o.aloft && !o.under && !o.riding && !o.stranger && o.level === 0 && o.state !== "down" && Math.hypot(o.x - t.x, o.y - t.y) < 13);
    if (h) fallIn(w, r, t, clan, h);
  }
}

function fallIn(w: World, r: Rivals, t: ClanTrap, clan: Clan, h: Human) {
  t.caught = h.id;
  h.captive = clan.id;
  h.state = "captive";
  h.stateT = 0;
  h.path = null;
  h.task = null;
  h.order = null;
  h.taskId = 0;
  h.carry = null;
  h.carryN = 0;
  h.vx = h.vy = 0;
  h.x = t.x;
  h.y = t.y;
  w.particles.burst(P.Leaf, t.x, t.y, 12, 60, { z: 8, size: 3, max: 0.9, color: "#7a9a48" });
  w.particles.burst(P.Dust, t.x, t.y, 8, 50, { size: 12, max: 0.9, color: "rgba(120,95,60,0.6)" });
  w.sfx("crack", t.x, t.y, 0.9, 0.7);
  w.sfx("yelp", t.x, t.y, 1);
  say(h, "AAAH! A pit!", 2.5);
  w.alarm(t.x, t.y, 500, 0.8, "😱", false);
  w.toast("🕳️", `${h.name} fell into a hidden ${clan.name} clan pit trap! They're coming to collect: send people to pull ${h.name} out!`, t.x, t.y);
  if (!w.flags.has("pitTrapTip")) {
    w.flags.add("pitTrapTip");
    w.toast("🌿", "Neanderthals dig pits under leaves where our people walk. A patch of loose leaves out in the wild is a trap: go out in packs!", t.x, t.y);
  }
}

function freeFromPit(w: World, t: ClanTrap) {
  const h = w.humans.find((o) => o.id === t.caught);
  if (h) {
    h.captive = 0;
    h.z = 0;
    h.state = "idle";
  }
}

/* ------------------------------ war-dinos ------------------------------ */

/** Where a clan beast belongs. */
function penOf(clan: Clan) {
  return lvOf(clan, "dinoPen") ? siteOf(clan, "dinoPen") : { x: clan.x, y: clan.y + 60 };
}

/** A clan beast's brain at home (true = handled; raiding uses the normal raider brain). */
export function clanDinoThink(w: World, d: Dino): boolean {
  const clan = w.rivals.clan(d.clan!);
  if (!clan) {
    // its clan is gone: it's wild again
    d.clan = undefined;
    return false;
  }
  if (d.raider) return false;
  // they feed it
  d.hunger = Math.min(d.hunger, 0.35);
  d.thirst = Math.min(d.thirst, 0.35);
  const pen = penOf(clan);
  d.homeX = pen.x;
  d.homeY = pen.y;
  const far = Math.hypot(d.x - pen.x, d.y - pen.y);
  if (far > 120) {
    if (d.state !== "wander" || Math.hypot(d.tx - pen.x, d.ty - pen.y) > 80) setState(d, "wander", pen.x + (w.rng() - 0.5) * 70, pen.y + (w.rng() - 0.5) * 26);
    return true;
  }
  if ((d.state === "idle" && d.stateT > 3 + (d.id % 4)) || (d.state !== "idle" && d.state !== "wander" && d.state !== "sleep")) {
    setState(d, w.rng() < 0.5 ? "idle" : "wander", pen.x + (w.rng() - 0.5) * 80, pen.y + (w.rng() - 0.5) * 30);
    return true;
  }
  return d.state === "idle" || d.state === "wander" || d.state === "sleep";
}

/** Once a second per clan: its war-dinos join a raid on us (and come home after). */
export function warDinoTick(w: World, r: Rivals, clan: Clan) {
  const mine = clanDinos(w, clan).filter((d) => !isBaby(d));
  if (!mine.length) return;
  const raid = w.tribe.raid;
  const raiding = !!raid && raid.by === "brute" && raid.phase === "attack" && raid.ids.some((id) => r.byId(id)?.clan === clan.id);
  for (const d of mine) {
    if (raiding && !d.raider && d.health > 0.4) {
      d.raider = true;
      d.think = 0;
      setState(d, "raid", w.camp.x, w.camp.y);
      if (!w.flags.has(`warDinos${clan.id}`)) {
        w.flags.add(`warDinos${clan.id}`);
        w.toast("🦖", `The ${clan.name} clan's war-dinos are charging with them! Their beasts smash walls like any raider.`, d.x, d.y);
      }
    } else if (!raiding && d.raider) {
      d.raider = false;
      const pen = penOf(clan);
      setState(d, "wander", pen.x, pen.y);
    }
  }
}
