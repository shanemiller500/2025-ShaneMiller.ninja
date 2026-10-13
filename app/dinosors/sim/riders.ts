/* ------------------------------------------------------------------ */
/*  Animal trainers + Dino Riders.                                     */
/*                                                                     */
/*  Trainers (a job): befriend wild herbivores (and pteranodons),      */
/*  feed + harness them, and work through each one's lessons:          */
/*    Wild → Friendly → Trained → War-Trained → Expert                 */
/*  (riding first, then its work skill, then battle training). Once a  */
/*  dinosaur can carry a rider, the trainer pairs it with a person:    */
/*  a Dino Rider team. The bond is saved (Human.partner ↔ work.partner).*/
/*                                                                     */
/*  Riders ride their partner for the day's work (carrying more), feed */
/*  it, and take it into a fight when danger comes close (a mounted    */
/*  charge; the dinosaur's own battle training does the rest). Scout   */
/*  teams ride out to find deposits; flyer teams take to the air to    */
/*  scout + warn the camp of raids. Partner dinosaurs stay near their  */
/*  rider, sleep at the stable and perch on the flyer perch.           */
/*  The existing systems do the work: taming + training states, the    */
/*  mount/passenger code, war-dino behaviour, deposit discovery.       */
/* ------------------------------------------------------------------ */
import { TAMEABLE } from "../data/colony";
import { WEAPON_BY_ID } from "../data/colony";
import { warTarget } from "./behavior";
import { sp } from "../data/species";
import { isBaby, setState, sizeOf } from "./dinos";
import { go, say, sourceFor } from "./humans";
import { pick } from "./rng";
import { dismount, issue, mount } from "./tasks";
import { sites } from "./build";
import type { Dino, Human, Resource } from "./types";
import { eligible, workOf, type WorkSkill } from "./workDinos";
import { dragonTrainerThink, dragonWork } from "./dragonKeep";
import type { World } from "./world";

export type RiderType = "hauler" | "heavy" | "war" | "scout" | "flyer";

export const RIDER_TYPES: Record<RiderType, { icon: string; name: string; tip: string }> = {
  hauler: { icon: "🪵", name: "Hauler Rider", tip: "Rides to work and carries three times as much" },
  heavy: { icon: "🪨", name: "Heavy Rider", tip: "A big mount: carries four times as much and holds the line" },
  war: { icon: "⚔️", name: "War Rider", tip: "First to answer when danger comes near the camp" },
  scout: { icon: "🧭", name: "Scout Rider", tip: "Rides out to find hidden deposits and keep an eye on the land" },
  flyer: { icon: "🪽", name: "Flying Rider", tip: "Scouts from the air and warns the camp of raids" },
};

/** Riding skill a dinosaur needs before it can be bonded to a rider. */
export const BOND_AT = 0.7;
/** Seconds between a scout / flyer team's trips. */
const TRIP_EVERY = 140;
const FOODS: Resource[] = ["crop", "berries", "leaves"];

const isFlyer = (d: Dino) => sp(d.species).move === "fly";

/** What the trainer teaches this dinosaur, in order (skills it can't learn are skipped). */
export function lessonPlan(d: Dino): (WorkSkill | "war")[] {
  if (isFlyer(d)) return eligible(d, "flyer") ? ["flyer"] : [];
  const out: (WorkSkill | "war")[] = [];
  if (eligible(d, "riding")) out.push("riding");
  if (eligible(d, "heavy")) out.push("heavy");
  else if (eligible(d, "hauler")) out.push("hauler");
  if (eligible(d, "scout") && !eligible(d, "heavy")) out.push("scout");
  out.push("war");
  return out;
}

/** The next lesson this dinosaur needs (null = fully trained). */
export function nextLesson(d: Dino): WorkSkill | "war" | null {
  if (!d.owner || isBaby(d)) return null;
  const work = workOf(d);
  for (const l of lessonPlan(d)) {
    if (l === "war" ? (d.warTraining ?? 0) < 1 : (work.skills[l] ?? 0) < 1) return l;
  }
  return null;
}

/** Can carry a rider: well along in riding (or flying). */
export function riderReady(d: Dino) {
  const s = workOf(d).skills;
  return d.owner && !isBaby(d) && d.health > 0 && ((s.riding ?? 0) >= BOND_AT || (s.flyer ?? 0) >= BOND_AT);
}

/** What kind of team this dinosaur makes, from what it's best at. */
export function riderType(d: Dino): RiderType {
  const s = workOf(d).skills;
  if ((s.flyer ?? 0) >= BOND_AT) return "flyer";
  if ((s.heavy ?? 0) >= BOND_AT) return "heavy";
  if ((s.scout ?? 0) >= BOND_AT) return "scout";
  if ((s.hauler ?? 0) >= BOND_AT) return "hauler";
  return "war";
}

/** A person's partner dinosaur (if the bond still holds both ways). */
export function partnerOf(w: World, h: Human): Dino | null {
  if (!h.partner) return null;
  const d = w.dinoById(h.partner) ?? w.dinos.find((x) => x.id === h.partner) ?? null;
  return d && d.work?.partner === h.id && d.health > 0 && !d.under ? d : null;
}

export function riderOf(w: World, d: Dino): Human | null {
  const id = d.work?.partner;
  if (!id) return null;
  const h = w.humans.find((x) => x.id === id) ?? null;
  return h && h.partner === d.id && !h.stranger && !h.captive ? h : null;
}

/** Pair a person with a dinosaur (null = done, else why not). */
export function bond(w: World, d: Dino, h: Human): string | null {
  if (!riderReady(d)) return `${d.name} needs more riding training first.`;
  if (h.child || h.stranger) return "Only grown-ups can ride.";
  const old = partnerOf(w, h);
  if (old && old !== d) unbond(w, old);
  const oldRider = riderOf(w, d);
  if (oldRider && oldRider !== h) oldRider.partner = undefined;
  const work = workOf(d);
  work.partner = h.id;
  work.auto = false;
  work.missionAt = 0;
  h.partner = d.id;
  const t = RIDER_TYPES[riderType(d)];
  w.toast(t.icon, `${h.name} and ${d.name} are now a Dino Rider team: ${t.name}! ${t.tip}.`, d.x, d.y);
  w.discover("riderBond", d.x, d.y);
  if (riderType(d) === "flyer") w.discover("skyRider", d.x, d.y);
  w.celebrate("New rider team!");
  return null;
}

export function unbond(w: World, d: Dino) {
  const h = riderOf(w, d);
  if (h) h.partner = undefined;
  if (d.work) {
    d.work.partner = undefined;
    d.work.mission = null;
  }
}

/** Who should ride this dinosaur: a free grown-up, ideally not someone the camp can't spare. */
export function chooseRider(w: World, d: Dino): Human | null {
  const pref = (h: Human) => {
    const r = w.tribe.roleOf(h);
    return (r === "guard" || r === "hunter" ? 0 : r === "gatherer" || r === "builder" ? 200 : r === "trainer" ? 900 : 400) + Math.hypot(h.x - d.x, h.y - d.y) * 0.3;
  };
  return w.humans.filter((h) => !h.child && !h.stranger && !h.under && !h.captive && h.state !== "down" && !partnerOf(w, h)).sort((a, b) => pref(a) - pref(b))[0] ?? null;
}

/** Trainers (+ a tack station, + a stable nearby) train faster. */
export function trainBoost(w: World, h: Human, d: Dino) {
  let k = w.tribe.roleOf(h) === "trainer" ? 1.6 : 1;
  if (w.colony.finished("tack")) k *= 1.25;
  if (w.colony.buildings.some((b) => b.kind === "stable" && b.built >= 1 && Math.hypot(b.x - d.x, b.y - d.y) < 260)) k *= 1.2;
  return k;
}

/** Is there anything for a trainer to do? (Auto gives the camp one or two when there is.) */
export function trainerWork(w: World) {
  // dragon eggs + hatchlings need a keeper even before Taming is learned
  const dragons = dragonWork(w);
  if (!w.camp.learned.has("taming")) return dragons;
  const owned = w.dinos.filter((d) => d.owner && !isBaby(d) && !d.under);
  const pupils = owned.filter((d) => nextLesson(d) !== null || (riderReady(d) && !riderOf(w, d))).length;
  const wild = w.dinos.some((d) => wildPupil(w, d));
  return Math.min(2, (pupils >= 4 ? 2 : pupils || wild ? 1 : 0) + dragons);
}

function wildPupil(w: World, d: Dino) {
  return !d.owner && !d.raider && !d.migrant && !isBaby(d) && TAMEABLE.has(d.species) && d.health > 0.5 && Math.hypot(d.x - w.camp.x, d.y - w.camp.y) < 1500;
}

const near = (h: Human, d: Dino, extra = 30) => Math.hypot(d.x - h.x, d.y - h.y) < sizeOf(d) * 0.5 + extra;

/** Walk over to a dinosaur and do something there (the state when close). */
function attend(h: Human, d: Dino, state: "train" | "tame") {
  h.targetId = d.id;
  if (near(h, d)) go(h, state, h.x, h.y);
  else go(h, "walk", d.x + (h.x < d.x ? -1 : 1) * (sizeOf(d) * 0.4 + 10), d.y + 6);
}

/* ------------------------------ the trainer's day ------------------------------ */

export function trainerThink(w: World, h: Human): boolean {
  if (h.child) return false;
  // dragons + their eggs first: they're the precious ones
  if (dragonTrainerThink(w, h)) return true;
  if (!w.camp.learned.has("taming")) return false;
  // keep on with the current pupil
  let d = w.dinos.find((x) => x.work?.trainer === h.id) ?? null;
  if (d && (!d.owner || d.health <= 0 || d.under || nextLesson(d) === null)) {
    d.work!.trainer = 0;
    d.work!.focus = null;
    d = null;
  }
  if (!d) {
    const owned = w.dinos.filter((x) => x.owner && !isBaby(x) && !x.under && x.health > 0);
    // fully ready ones get their rider
    for (const x of owned) {
      if (!riderReady(x) || riderOf(w, x)) continue;
      const r = chooseRider(w, x);
      if (r) bond(w, x, r);
    }
    // working animals get a harness when the stores allow
    for (const x of owned) {
      const work = workOf(x);
      if (work.harness || Math.max(work.skills.hauler ?? 0, work.skills.heavy ?? 0) < 0.35) continue;
      const s = w.camp.stock;
      if (s.hide >= 2 && s.wood >= 2) {
        s.hide -= 2;
        s.wood -= 2;
        work.harness = 1;
        say(h, `A harness for ${x.name}!`);
        break;
      }
    }
    // feed whoever is hungry (riders feed their own)
    const hungry = owned.find((x) => x.hunger > 0.7 && !riderOf(w, x) && Math.hypot(x.x - h.x, x.y - h.y) < 700);
    if (hungry && FOODS.some((r) => w.camp.stock[r] > 0)) return feed(w, h, hungry);
    // the next pupil: nearest one with lessons left that nobody's teaching
    d = owned.filter((x) => nextLesson(x) !== null && !x.work?.trainer && x.state !== "sleep").sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0] ?? null;
    if (d) {
      const lesson = nextLesson(d)!;
      const work = workOf(d);
      work.trainer = h.id;
      work.focus = lesson === "war" ? null : lesson;
      say(h, lesson === "war" ? `Battle drills for ${d.name}!` : `${d.name}: ${lesson} lessons!`);
    }
  }
  if (d) {
    attend(h, d, "train");
    return true;
  }
  // nobody to teach: make a new friend
  const wild = w.dinos.filter((x) => wildPupil(w, x) && x.state !== "flee").sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  if (wild) {
    attend(h, wild, "tame");
    return true;
  }
  return false;
}

/** Walk to a dinosaur with food from the stores and feed it. */
function feed(w: World, h: Human, d: Dino) {
  if (!near(h, d, 40)) {
    go(h, "walk", d.x, d.y + 8);
    return true;
  }
  const food = FOODS.find((r) => w.camp.stock[r] > 0);
  if (!food) return false;
  w.camp.stock[food]--;
  d.hunger = Math.max(0, d.hunger - 0.5);
  d.tame = Math.min(1, d.tame + 0.02);
  say(h, pick(w.rng, [`Here, ${d.name}!`, "Dinner time!", "Good dino."]));
  go(h, "idle", h.x, h.y);
  h.think = 1;
  return true;
}

/* ------------------------------ riders ------------------------------ */

/** A rider whose partner can fight: they don't run from danger close by, they ride at it. */
export function riderCanFight(w: World, h: Human) {
  if (h.child || h.hp < 0.35) return false;
  const d = partnerOf(w, h);
  return !!d && !isFlyer(d) && (d.warTraining ?? 0) >= 0.35 && d.health > 0.35 && !d.under;
}

/** Danger close by and a fighting partner: mount up (or call it over) and charge. */
export function riderDefend(w: World, h: Human, danger: { x: number; y: number; kind: string }) {
  if (danger.kind !== "raid" && danger.kind !== "predator") return false;
  const d = partnerOf(w, h)!;
  if (!h.riding) {
    if (!d.rider && Math.hypot(d.x - h.x, d.y - h.y) < 160) mount(w, h, d);
    else {
      // the partner comes running (its own battle training takes over); stay out of reach meanwhile
      go(h, "walk", d.x, d.y);
      return true;
    }
  }
  if (h.riding !== d.id) return false;
  workOf(d).boardUntil = w.elapsed + 30;
  if (h.state !== "walk" || Math.hypot(h.tx - danger.x, h.ty - danger.y) > 40) say(h, pick(w.rng, [`Charge, ${d.name}!`, "Ride!", "For the camp!"]));
  go(h, "walk", danger.x, danger.y);
  if (!w.flags.has("riderCharge")) {
    w.flags.add("riderCharge");
    w.toast("⚔️", `${h.name} rides ${d.name} into the fight! Rider teams answer danger instead of running from it.`, h.x, h.y);
  }
  return true;
}

/* ------------------------------ meeting the rider ------------------------------ */

/**
 * Someone is on their way to ride this dinosaur (a rally, a call from its card): it runs to meet
 * them instead of waiting. Returns true while it's doing that.
 */
export function meetRider(w: World, d: Dino): boolean {
  if (d.rider || isBaby(d) || d.health <= 0) {
    d.hurry = false;
    return false;
  }
  const h = w.humans.find((x) => {
    const t = x.taskId ? w.tasks.get(x.taskId) : null;
    return t?.kind === "ride" && t.target === d.id && x.state !== "down";
  });
  if (!h) {
    d.hurry = false;
    return false;
  }
  if (Math.hypot(h.x - d.x, h.y - d.y) < sizeOf(d) * 0.5 + 22) {
    // met up: on they get, right away
    d.hurry = false;
    mount(w, h, d);
    if (h.riding === d.id) {
      go(h, "idle", h.x, h.y);
      h.think = 0;
    } else setState(d, "idle", d.x, d.y);
    return true;
  }
  d.hurry = true;
  setState(d, "wander", h.x + (d.x < h.x ? -10 : 10), h.y + 4);
  d.think = 0.4;
  return true;
}

/* ------------------------------ fighting from the saddle ------------------------------ */

/**
 * A rider on a war-trained dinosaur shoots at anything hostile in range (arrows if the tribe has
 * bows, else thrown spears), a little more accurately from up there.
 */
export function saddleVolley(w: World, h: Human) {
  const d = h.riding ? w.dinoById(h.riding) : null;
  if (!d || !d.owner || (d.warTraining ?? 0) < 0.35 || h.child) return;
  const wp = w.tribe.weaponFor(w, h);
  const ranged = wp && !wp.melee ? wp : w.camp.learned.has("bow") ? WEAPON_BY_ID.bow1 : w.camp.learned.has("spear") ? WEAPON_BY_ID.spear1 : null;
  if (!ranged) return;
  const foe = warTarget(w, d, Math.min(300, ranged.range ?? 260));
  if (!foe) return;
  w.tribe.shoot(w, h, foe, ranged, 0.15);
  if (w.rng() < 0.15) say(h, pick(w.rng, ["From the saddle!", "Take that!", "Got one!"]));
}

/* ------------------------------ player orders: call the rider, ride somewhere ------------------------------ */

/** Where this person's work is right now (for "ride to work"). */
export function jobSpot(w: World, h: Human): { x: number; y: number; label: string } {
  const t = w.tasks.get(h.taskId);
  if (t) return { x: t.x, y: t.y, label: t.label };
  const role = w.tribe.roleOf(h);
  const near = <T extends { x: number; y: number }>(list: T[]) => list.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  switch (role) {
    case "builder": {
      const s = near(sites(w).filter((x) => !x.locked));
      if (s) return { x: s.sx, y: s.sy, label: "the building site" };
      break;
    }
    case "farmer": {
      const f = near([...w.tribe.farms]);
      if (f) return { x: f.x, y: f.y + 26, label: "the fields" };
      break;
    }
    case "miner":
      return { x: w.camp.caveX + 20, y: w.camp.caveY + 30, label: "the mine" };
    case "smith": {
      const s = w.colony.station(w);
      return { x: s.x, y: s.y + 10, label: "the forge" };
    }
    case "cook": {
      const f = near(w.campfires.filter((x) => x.lit));
      if (f) return { x: f.x + 20, y: f.y + 16, label: "the cooking fire" };
      break;
    }
    case "guard": {
      const tw = near(w.tribe.towers.filter((x) => x.hp > 0));
      if (tw) return { x: tw.x, y: tw.y + 30, label: "the watchtower" };
      break;
    }
    case "trainer": {
      const st = w.colony.buildings.find((b) => b.kind === "stable" || b.kind === "pen");
      if (st) return { x: st.x, y: st.y + 30, label: "the animal pens" };
      break;
    }
    case "gatherer":
    case "hunter": {
      // the nearest thing the stores are short of
      const need = w.colony.missing(w) ?? (w.camp.stock.wood < 20 ? "wood" : w.camp.stock.stone < 20 ? "stone" : "berries");
      const src = sourceFor(w, h, need);
      if (src) return { x: src.x, y: src.y + 20, label: `the ${need}` };
      break;
    }
  }
  return { x: w.camp.pileX + 30, y: w.camp.pileY + 30, label: "camp" };
}

/** Call a dinosaur's bonded rider over to climb on. Returns why not (or null). */
export function callRider(w: World, d: Dino): string | null {
  const h = riderOf(w, d);
  if (!h) return `${d.name} has no rider yet.`;
  if (h.riding === d.id) return null;
  if (h.state === "down" || h.under) return `${h.name} can't come right now.`;
  if (h.riding) dismount(w, h);
  const work = workOf(d);
  work.boardUntil = w.elapsed + 120;
  // the dinosaur waits where it is
  if (!d.rider && d.state !== "war") setState(d, "idle", d.x, d.y);
  d.think = 4;
  const t = issue(w, [h], { kind: "ride", icon: "🏇", label: `Ride ${d.name}`, x: d.x, y: d.y, target: d.id });
  if (!t) return `${h.name} can't come right now.`;
  say(h, `Coming, ${d.name}!`);
  return null;
}

/** Send the rider team somewhere (calling the rider first if they're on foot). */
export function rideTeamTo(w: World, d: Dino, where: "job" | "camp" | { x: number; y: number }): string | null {
  const h = riderOf(w, d);
  if (!h) return `${d.name} has no rider yet.`;
  const spot = where === "job" ? jobSpot(w, h) : where === "camp" ? { x: w.camp.pileX + 30, y: w.camp.pileY + 30, label: "camp" } : { ...where, label: "there" };
  const work = workOf(d);
  work.rideTo = spot;
  // stay mounted for a good while after arriving (riders carry three times as much)
  work.boardUntil = w.elapsed + 600;
  if (h.riding !== d.id) return callRider(w, d);
  h.think = 0;
  return null;
}

/** A rider's own business: care for the partner, scouting trips, and riding to work. */
export function riderThink(w: World, h: Human): boolean {
  const d = partnerOf(w, h);
  if (!d) {
    if (h.partner) h.partner = undefined;
    return false;
  }
  const work = workOf(d);
  // the player sent them somewhere: get on, ride there, then back to the day's work (still mounted)
  if (work.rideTo) {
    const to = work.rideTo;
    if (h.riding !== d.id) {
      if (!d.rider && near(h, d, 40)) mount(w, h, d);
      else if (d.rider) work.rideTo = null;
      else go(h, "walk", d.x - d.dir * 10, d.y + 6);
      return true;
    }
    if (Math.hypot(h.x - to.x, h.y - to.y) < 34) {
      work.rideTo = null;
      work.boardUntil = Math.max(work.boardUntil ?? 0, w.elapsed + 240);
      say(h, to.label === "camp" ? "Home!" : "Here we are!");
      return false;
    }
    if (h.state !== "walk" || Math.hypot(h.tx - to.x, h.ty - to.y) > 4) go(h, "walk", to.x, to.y);
    return true;
  }
  // a hungry partner gets fed first
  if (d.hunger > 0.65 && !h.riding && FOODS.some((r) => w.camp.stock[r] > 0)) return feed(w, h, d);
  if (isFlyer(d)) return flyerRiderThink(w, h, d);
  const type = riderType(d);
  const day = w.daylight > 0.45;
  // scouts ride out now and then towards land nobody has looked at
  if (type === "scout" && day && w.elapsed >= (work.missionAt ?? 0) && !w.tribe.raid) {
    const hidden = w.colony.nodes.filter((n) => !n.found);
    if (hidden.length) {
      if (!h.riding) {
        if (!d.rider && near(h, d, 120)) mount(w, h, d);
        else return false;
      }
      const n = pick(w.rng, hidden);
      work.missionAt = w.elapsed + TRIP_EVERY;
      work.boardUntil = w.elapsed + 60;
      go(h, "explore", n.x + (w.rng() - 0.5) * 160, n.y + (w.rng() - 0.5) * 120);
      say(h, `Let's see what's out there, ${d.name}!`);
      return true;
    }
  }
  // ride to the day's work: partner close by + nobody on it → hop on
  if (!h.riding && day && !d.rider && near(h, d, 120) && d.state !== "war" && d.state !== "eat" && d.state !== "drink" && d.state !== "sleep" && d.state !== "faint") {
    mount(w, h, d);
    work.boardUntil = w.elapsed + 45;
  }
  return false;
}

/** Flyer teams: board on the ground, then the flyer takes them out scouting (or to meet a raid). */
function flyerRiderThink(w: World, h: Human, d: Dino) {
  const work = workOf(d);
  if (h.riding === d.id) return true; // in the air: the flyer flies
  const raid = w.tribe.raid;
  const warn = !!raid && raid.phase === "warn" && !work.mission;
  const due = w.daylight > 0.45 && w.elapsed >= (work.missionAt ?? 0) && w.weather.storm < 0.3 && w.weather.rain < 0.5 && !raid;
  if (!warn && !due) return false;
  if (!near(h, d, 60) || d.z > 6) {
    // call the flyer down; wait where it can land
    work.mission = null;
    go(h, "walk", d.x, d.y + 6);
    return true;
  }
  // board as its passenger (the flyer does the flying)
  h.riding = d.id;
  d.passengers = [h.id];
  const target = warn ? { x: raid!.fromX, y: raid!.fromY } : scoutTarget(w);
  work.mission = { x: target.x, y: target.y, kind: warn ? "warn" : "scout", home: false };
  work.missionAt = w.elapsed + TRIP_EVERY;
  say(h, warn ? "Up! Let's see who's coming!" : `Fly, ${d.name}!`);
  d.think = 0;
  return true;
}

/** Somewhere worth a look from the air: hidden deposits first, else a far corner. */
function scoutTarget(w: World) {
  const hidden = w.colony.nodes.filter((n) => !n.found);
  if (hidden.length) {
    const n = pick(w.rng, hidden);
    return { x: n.x, y: n.y };
  }
  const a = w.rng() * Math.PI * 2;
  return { x: w.camp.x + Math.cos(a) * 1500, y: w.camp.y + Math.sin(a) * 1000 };
}

/* ------------------------------ partner dinosaurs ------------------------------ */

/** A bonded dinosaur's brain (before its ordinary one): stay with the rider, sleep at the stable, fly missions. */
export function partnerThink(w: World, d: Dino): boolean {
  if (!d.work?.partner) return false;
  const h = riderOf(w, d);
  if (!h) {
    d.work.partner = undefined;
    return false;
  }
  if (isFlyer(d)) return flyerThink(w, d, h);
  if (d.rider) return false;
  // its own needs come first
  if (d.hunger > 0.75 || d.thirst > 0.75 || d.energy < 0.15) return false;
  // night: rest at the stable
  if (w.daylight < 0.25) {
    const st = w.colony.buildings.find((b) => b.kind === "stable" && b.built >= 1);
    if (st && Math.hypot(st.x - d.x, st.y - d.y) > 40) {
      setState(d, "wander", st.x + ((d.id % 3) - 1) * 30, st.y + 10);
      return true;
    }
    return false;
  }
  if (h.under || h.state === "sleep" || h.state === "hide") return false;
  // keep close to the rider
  const dist = Math.hypot(d.x - h.x, d.y - h.y);
  if (dist > 150) {
    setState(d, "wander", h.x + (d.id % 2 ? 50 : -50), h.y + 18);
    return true;
  }
  return false;
}

function flyerThink(w: World, d: Dino, h: Human) {
  const work = workOf(d);
  const m = work.mission;
  if (m && h.riding === d.id) {
    const dist = Math.hypot(d.x - m.x, d.y - m.y);
    if (dist > 70) {
      setState(d, "wander", m.x, m.y);
      return true;
    }
    if (!m.home) {
      // over the target: look around
      if (m.kind === "warn") {
        const dir = Math.abs(m.x - w.camp.x) > Math.abs(m.y - w.camp.y) ? (m.x > w.camp.x ? "east" : "west") : m.y > w.camp.y ? "south" : "north";
        w.toast("🪽", `${h.name} spotted the raiders from the air, coming from the ${dir}!`, m.x, m.y);
        w.alarm(m.x, m.y, 600, 0.3, "🪽");
      } else {
        const before = w.colony.nodes.filter((n) => n.found).length;
        w.colony.discoverAround(w, m.x, m.y, 320);
        const found = w.colony.nodes.filter((n) => n.found).length - before;
        const threats = w.dinos.filter((x) => !x.owner && sp(x.species).diet !== "herbivore" && sizeOf(x) > 60 && Math.hypot(x.x - m.x, x.y - m.y) < 600).length + w.rivals.brutes.filter((b) => Math.hypot(b.x - m.x, b.y - m.y) < 600).length;
        if (found || threats) w.toast("🪽", `${h.name} scouted from the air: ${found ? `${found} new deposit${found > 1 ? "s" : ""}` : "nothing new"}${threats ? `, and ${threats} danger${threats > 1 ? "s" : ""} out there` : ""}.`, m.x, m.y);
      }
      const home = perchOf(w) ?? { x: w.camp.x + 60, y: w.camp.y + 80 };
      work.mission = { ...m, x: home.x, y: home.y, home: true };
      setState(d, "wander", home.x, home.y);
      return true;
    }
    // home again: the rider climbs down
    d.passengers = (d.passengers ?? []).filter((id) => id !== h.id);
    h.riding = 0;
    h.x = d.x + 14;
    h.y = d.y + 8;
    h.z = 0;
    go(h, "idle", h.x, h.y);
    work.mission = null;
    return false;
  }
  if (m && h.riding !== d.id) work.mission = null;
  // its own needs come first
  if (d.hunger > 0.75 || d.thirst > 0.75 || d.energy < 0.15) return false;
  // between flights: rest on the perch (or near the rider)
  const perch = perchOf(w);
  const spot = perch ?? { x: h.x + 30, y: h.y + 10 };
  if (Math.hypot(d.x - spot.x, d.y - spot.y) > 60) {
    setState(d, "wander", spot.x, spot.y);
    return true;
  }
  if (d.state !== "perch" && d.state !== "sleep") setState(d, "perch", spot.x, spot.y);
  return true;
}

function perchOf(w: World) {
  const p = w.colony.buildings.find((b) => b.kind === "perch" && b.built >= 1);
  return p ? { x: p.x, y: p.y } : null;
}

/** For the snapshot / UI: every rider team. */
export function riderTeams(w: World) {
  const out: { dino: Dino; rider: Human; type: RiderType }[] = [];
  for (const d of w.dinos) {
    const h = d.work?.partner ? riderOf(w, d) : null;
    if (h) out.push({ dino: d, rider: h, type: riderType(d) });
  }
  return out;
}
