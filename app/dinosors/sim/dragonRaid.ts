/* ------------------------------------------------------------------ */
/*  Dragon raids (fantasy!): a war band that goes after a dragon nest. */
/*                                                                     */
/*  Invent 🐉 Dragon hunting and two jobs open up:                      */
/*   ⚔️ Dragon slayers drill (they get better at hurting dragons and    */
/*      at shrugging off fire) and wear scaled, fire-proofed armour.   */
/*   🥚 Egg runners are quick on their feet, wear a light runner's kit  */
/*      with a padded satchel, and can carry two eggs at once.          */
/*                                                                     */
/*  A raid (select people and tap a known nest, or the camp's Dragon   */
/*  raid button): everyone gathers a little way off; the slayers go in */
/*  and take on the parent dragon; once it's busy the runners dash to  */
/*  the nest, grab as many eggs as they can carry and run home. The    */
/*  slayers hold the dragon off until the runners are clear, then fall */
/*  back. Nobody in the band runs from the dragon.                     */
/* ------------------------------------------------------------------ */
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { issue, type Task } from "./tasks";
import type { DragonEgg, DragonNest, Human } from "./types";
import type { World } from "./world";
import { atEggHome, eggDropOff, nestEggs, parentOf, revealNest, settleEgg } from "./dragonNests";

/** Most eggs a runner can carry (with the runner's kit). */
export const RUNNER_EGGS = 2;
/** How far from the nest the band gathers before going in. */
const STAGE_R = 480;
/** Seconds the band waits for stragglers before going in anyway. */
const GATHER_FOR = 25;

export const OUTFIT_SLAYER = "dragonMail";
export const OUTFIT_RUNNER = "runnerKit";

export const isRunner = (w: World, h: Human) => w.tribe.roleOf(h) === "eggRunner" || raidRunners.has(h.id);
export const isSlayer = (w: World, h: Human) => w.tribe.roleOf(h) === "dragonSlayer";

/** Runners picked for a raid (when nobody has the Egg runner job). Not saved: raids are orders. */
const raidRunners = new Set<number>();
/** Per raid task: when the band was told to go in. */
const goAt = new Map<number, number>();

/* ------------------------------ eggs in a runner's arms ------------------------------ */

export const eggsCarried = (h: Human) => (h.egg ? 1 : 0) + (h.egg2 ? 1 : 0);
export const eggCapacity = (h: Human) => (h.gear.outfit === OUTFIT_RUNNER ? RUNNER_EGGS : 1);
export const carriesEgg = (h: Human, id: number) => h.egg === id || h.egg2 === id;

/** Pick up one more egg (if there's room). */
export function pickEgg(w: World, h: Human, egg: DragonEgg) {
  if (eggsCarried(h) >= eggCapacity(h)) return false;
  egg.at = "carried";
  egg.carrier = h.id;
  if (!h.egg) h.egg = egg.id;
  else h.egg2 = egg.id;
  if (h.carry) {
    w.camp.stock[h.carry] += h.carryN;
    h.carry = null;
    h.carryN = 0;
  }
  say(h, eggsCarried(h) > 1 ? "Two eggs! Go go go!" : "Got one!");
  w.sfx("pop", h.x, h.y, 0.8);
  return true;
}

/** Walking speed with eggs: heavy for most people; a runner in their kit flies along. */
export function eggSpeed(w: World, h: Human) {
  const kit = h.gear.outfit === OUTFIT_RUNNER;
  if (eggsCarried(h)) return kit ? 1.4 : isRunner(w, h) ? 0.9 : 0.72;
  return kit ? 1.25 : 1;
}

/** Set all carried eggs down at home. */
export function settleCarried(w: World, h: Human) {
  for (const id of [h.egg, h.egg2]) {
    const egg = id ? w.dragons.eggs.find((e) => e.id === id) : null;
    if (egg) settleEgg(w, egg, egg.keeper ? null : h);
  }
  h.egg = undefined;
  h.egg2 = undefined;
}

/* ------------------------------ slayer training ------------------------------ */

/** A dragon slayer with nothing to do drills: spear thrusts + dodging at the training area. */
export function slayerDrillThink(w: World, h: Human): boolean {
  if ((h.slayer ?? 0) >= 1 && w.rng() < 0.5) return false;
  const yard = w.colony.buildings.find((b) => (b.kind === "dragonYard" || b.kind === "tack") && b.built >= 1);
  const spot = yard ? { x: yard.x + ((h.id % 5) - 2) * 18, y: yard.y + 14 } : { x: w.camp.x - 90 + ((h.id % 5) - 2) * 16, y: w.camp.y + 110 };
  if (Math.hypot(h.x - spot.x, h.y - spot.y) > 14) {
    go(h, "walk", spot.x, spot.y);
    return true;
  }
  go(h, "drill", h.x, h.y);
  return true;
}

/** Per frame while drilling. */
export function drillTick(w: World, h: Human, dt: number) {
  h.anim += dt * 6;
  const yard = w.colony.buildings.some((b) => b.kind === "dragonYard" && b.built >= 1 && Math.hypot(b.x - h.x, b.y - h.y) < 200);
  h.slayer = Math.min(1, (h.slayer ?? 0) + (dt / 240) * (yard ? 1.5 : 1));
  if (h.stateT % 1.2 < dt) {
    h.dir = h.dir === 1 ? -1 : 1;
    w.particles.spawn(P.Dust, h.x + h.dir * 8, h.y, { size: 5, max: 0.4, color: "rgba(200,180,150,0.5)" });
  }
  if (w.rng() < dt * 0.05) say(h, pick(w.rng, ["Duck the fire!", "Aim for the wing!", "Again!", "Hyah!"]));
  if (h.stateT > 25) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
  }
}

/** How much harder a slayer hits a dragon (training + armour). */
export function slayerDamage(h: Human) {
  return 1 + (h.slayer ?? 0) * 2 + (h.gear.outfit === OUTFIT_SLAYER ? 0.5 : 0);
}

/** Fire hurts a slayer less (drilled to roll away; the armour is fire-proofed). */
export function burnGuard(h: Human) {
  return (1 - (h.slayer ?? 0) * 0.45) * (h.gear.outfit === OUTFIT_SLAYER ? 0.3 : 1);
}

/** A drilled slayer sometimes rolls clear of a blast of fire altogether. */
export const rollsClear = (w: World, h: Human) => (h.slayer ?? 0) > 0 && w.rng() < (h.slayer ?? 0) * 0.35;

/* ------------------------------ the raid ------------------------------ */

/** The known nest closest to camp that's worth raiding. */
export function raidTarget(w: World): DragonNest | null {
  const nests = w.dragons.nests.filter((n) => n.found).sort((a, b) => nestEggs(w, b).length - nestEggs(w, a).length || Math.hypot(a.x - w.camp.x, a.y - w.camp.y) - Math.hypot(b.x - w.camp.x, b.y - w.camp.y));
  return nests[0] ?? null;
}

/** Send a band at a nest: picks runners (the Egg runner job first, else the quickest people). */
export function launchRaid(w: World, people: Human[], nest: DragonNest): Task | null {
  const band = people.filter((h) => !h.child && !h.stranger && !h.captive && !h.under && h.state !== "down");
  if (band.length < 2) return null;
  const want = Math.max(1, Math.min(3, Math.round(band.length * 0.25)));
  let runners = band.filter((h) => w.tribe.roleOf(h) === "eggRunner");
  if (runners.length < want) {
    const rest = band.filter((h) => !runners.includes(h) && w.tribe.roleOf(h) !== "dragonSlayer").sort((a, b) => (b.gear.outfit === OUTFIT_RUNNER ? 1 : 0) - (a.gear.outfit === OUTFIT_RUNNER ? 1 : 0) || b.hp - a.hp);
    runners = runners.concat(rest.slice(0, want - runners.length));
  }
  for (const h of runners) raidRunners.add(h.id);
  for (const h of band) if (!runners.includes(h)) raidRunners.delete(h.id);
  const t = issue(w, band, { kind: "dragonRaid", icon: "🐉", label: `Dragon raid: ${band.length - runners.length} fighting, ${runners.length} running eggs`, x: nest.x, y: nest.y, target: nest.id });
  if (!t) return null;
  goAt.delete(t.id);
  w.toast("🐉", `A dragon raid sets out: ${band.length - runners.length} fighters to hold the dragon, ${runners.length} egg runner${runners.length > 1 ? "s" : ""} (${runners.map((h) => h.name).join(", ")}).`, nest.x, nest.y);
  if (!w.flags.has("dragonRaid")) {
    w.flags.add("dragonRaid");
    w.discover("dragonRaid", nest.x, nest.y);
  }
  return t;
}

/** One band member's part in the raid. */
export function raidThink(w: World, h: Human, t: Task, done: () => void): boolean {
  const nest = w.dragons.nests.find((n) => n.id === t.target);
  if (!nest) {
    done();
    return false;
  }
  const band = w.humans.filter((p) => t.people.includes(p.id));
  const runner = raidRunners.has(h.id) || w.tribe.roleOf(h) === "eggRunner";
  const home = eggDropOff(w);
  // the staging point: on the camp side of the nest
  const a = Math.atan2(w.camp.y - nest.y, w.camp.x - nest.x);
  const stage = { x: nest.x + Math.cos(a) * STAGE_R + ((h.id % 5) - 2) * 18, y: nest.y + Math.sin(a) * STAGE_R * 0.8 + ((h.id >> 2) % 3) * 14 };
  const parent = parentOf(w, nest);
  const eggs = nestEggs(w, nest);
  const loose = w.dragons.eggs.filter((e) => e.at === "ground" && Math.hypot(e.x - nest.x, e.y - nest.y) < 900);

  // runner with eggs: straight home, fast
  if (runner && eggsCarried(h)) {
    if (eggsCarried(h) < eggCapacity(h) && (eggs.length || loose.length) && Math.hypot(h.x - nest.x, h.y - nest.y) < 60) {
      const more = eggs[0] ?? loose[0];
      if (more) pickEgg(w, h, more);
    }
    if (atEggHome(w, h)) {
      const n = eggsCarried(h);
      settleCarried(w, h);
      say(h, n > 1 ? "Two eggs home!" : "Egg home!");
      raidRunners.delete(h.id);
      done();
      return true;
    }
    go(h, "walk", home.x, home.y);
    return true;
  }
  const gather = goAt.get(t.id);
  // gathering: everyone to the staging point first
  if (gather === undefined) {
    // counted round the middle of the staging line (everyone's own spot is a little to the side)
    const mid = { x: nest.x + Math.cos(a) * STAGE_R, y: nest.y + Math.sin(a) * STAGE_R * 0.8 + 14 };
    const there = band.filter((p) => Math.hypot(p.x - mid.x, p.y - mid.y) < 90).length;
    // 98% gathered (or the dragon comes at them while they wait: then they charge right away)
    const jumped = !!parent && band.some((p) => Math.hypot(p.x - parent.x, p.y - parent.y) < 220 || p.state === "down");
    const ready = there >= Math.ceil(band.length * 0.98) || jumped || t.t > GATHER_FOR + 30;
    if (ready && band.some((p) => Math.hypot(p.x - nest.x, p.y - nest.y) < STAGE_R + 100)) {
      goAt.set(t.id, w.elapsed);
      revealNest(w, nest, h.name);
      w.toast("⚔️", parent ? `The raid goes in! Slayers take on ${parent.name}; runners wait for their chance.` : "The nest is unguarded: runners, go!", nest.x, nest.y);
      w.sfx("drums", nest.x, nest.y, 0.9);
    } else {
      if (Math.hypot(h.x - stage.x, h.y - stage.y) > 20) go(h, "walk", stage.x, stage.y);
      else if (h.state !== "idle") go(h, "idle", h.x, h.y);
      return true;
    }
  }
  const busy = !parent || Math.hypot(parent.x - nest.x, parent.y - nest.y) > 260 || parent.state === "defend" || parent.state === "chase" || parent.hit > 0 || band.some((p) => !raidRunners.has(p.id) && Math.hypot(p.x - parent.x, p.y - parent.y) < 140);
  if (runner) {
    // wait for the slayers to draw the dragon off, then dash in
    if (!busy && (w.elapsed - (goAt.get(t.id) ?? w.elapsed)) < 30) {
      if (Math.hypot(h.x - stage.x, h.y - stage.y) > 20) go(h, "walk", stage.x, stage.y);
      return true;
    }
    const target = eggs[0] ?? loose.sort((p, q) => Math.hypot(p.x - h.x, p.y - h.y) - Math.hypot(q.x - h.x, q.y - h.y))[0];
    if (!target) {
      say(h, "No eggs left!");
      raidRunners.delete(h.id);
      done();
      return false;
    }
    if (Math.hypot(h.x - target.x, h.y - target.y) < 18) {
      if (target.at === "nest" || target.at === "ground") pickEgg(w, h, target);
      return true;
    }
    go(h, "walk", target.x, target.y + 4);
    return true;
  }
  // a slayer: fight the parent while it's anywhere near the band, then cover the runners' escape
  const runnersOut = band.some((p) => raidRunners.has(p.id) && (eggsCarried(p) > 0 || Math.hypot(p.x - nest.x, p.y - nest.y) < 300));
  const runnersLeft = band.some((p) => raidRunners.has(p.id));
  if (parent && parent.hp > 0 && (runnersOut || Math.hypot(parent.x - nest.x, parent.y - nest.y) < 400)) {
    h.order = { kind: "hunt", id: parent.id };
    if (w.rng() < 0.01) say(h, pick(w.rng, ["Keep it busy!", "Over here, dragon!", "Shields up!", "For the eggs!"]));
    return false; // the hunt (roleThink) does the fighting
  }
  h.order = null;
  // the dragon's gone (or driven off): follow the runners home, or finish
  if (runnersLeft && !eggs.length) {
    const r = band.find((p) => raidRunners.has(p.id) && eggsCarried(p));
    if (r) {
      go(h, "walk", r.x + ((h.id % 3) - 1) * 24, r.y + 18);
      return true;
    }
  }
  if (runnersLeft && eggs.length) {
    // hold the nest for the runners
    if (Math.hypot(h.x - nest.x, h.y - nest.y) > 80) go(h, "walk", nest.x + ((h.id % 5) - 2) * 20, nest.y + 30);
    return true;
  }
  say(h, pick(w.rng, ["Raid done!", "Back home!", "What a fight!"]));
  done();
  return false;
}

/** Is this person on a dragon raid (they don't run from the dragon)? */
export const onRaid = (w: World, h: Human) => w.tasks.get(h.taskId)?.kind === "dragonRaid";
