/* ------------------------------------------------------------------ */
/*  War animals on guard duty: a full-time job.                        */
/*                                                                     */
/*  Once a dinosaur or a dragon is war-trained it never just stands    */
/*  about. It's always doing one of three things:                      */
/*   1. fighting: anything that threatens the person it's guarding,    */
/*      itself, or (when we're under attack) the camp, with or         */
/*      without its rider;                                             */
/*   2. guarding someone out in the wild: one animal per person,       */
/*      sticking close but not on top of them, so they can work;       */
/*   3. patrolling: a ring round the camp (dinos just outside the      */
/*      walls; dragons in the sky above), round and round.             */
/*  A won fight means straight back to guarding / patrolling.          */
/*                                                                     */
/*  And they go out with their rider: a bonded rider climbs on and     */
/*  rides the patrol (by day; at night the animal keeps watch alone).  */
/* ------------------------------------------------------------------ */
import { CAMP_LEVELS } from "../data/facts";
import { sp } from "../data/species";
import { isBaby, setState, sizeOf } from "./dinos";
import { warTrained } from "./dragonKeep";
import { go, say } from "./humans";
import { pick } from "./rng";
import { mount } from "./tasks";
import type { Dino, Dragon, Human } from "./types";
import type { World } from "./world";

/** A ground dinosaur trained for war (flyers scout instead). */
export const isWarDino = (d: Dino) => d.owner && (d.warTraining ?? 0) >= 0.35 && !isBaby(d) && !d.under && sp(d.species).move === "walk" && d.health > 0.25;
export const isWarDragon = (dr: Dragon) => !!dr.owner && warTrained(dr) && dr.hp > 0;

const campR = (w: World) => CAMP_LEVELS[w.tribe.level]?.radius ?? 300;
/** Out in the wild (beyond the camp) and needing a guard. */
const outInWild = (w: World, h: Human) => !h.child && !h.stranger && !h.captive && !h.aloft && !h.under && !h.snatched && h.state !== "down" && Math.hypot(h.x - w.camp.x, h.y - w.camp.y) > campR(w) + 80;

/** Something worth fighting near (x, y): raiders, hunting predators, Neanderthals, low wild dragons. */
export function threatAt(w: World, x: number, y: number, r: number, dragons = false): { kind: "dino" | "brute" | "dragon"; id: number; x: number; y: number } | null {
  let best: { kind: "dino" | "brute" | "dragon"; id: number; x: number; y: number } | null = null;
  let bd = r;
  for (const d of w.dinos) {
    if (d.owner || d.health <= 0 || d.under || d.state === "faint" || d.state === "carried") continue;
    const def = sp(d.species);
    if (def.move === "swim") continue;
    const g = Math.hypot(d.x - x, d.y - y);
    // raiders; meat-eaters on the hunt; and any big meat-eater right up close
    const meat = def.diet === "carnivore" && sizeOf(d) > 45;
    const danger = d.raider || (meat && (d.state === "chase" || d.state === "stalk" || d.state === "tussle" || d.state === "eat")) || (meat && sizeOf(d) > 60 && g < Math.min(r, 220));
    if (!danger) continue;
    if (g < bd) {
      bd = g;
      best = { kind: "dino", id: d.id, x: d.x, y: d.y };
    }
  }
  for (const b of w.rivals.brutes) {
    if (b.hp <= 0 || b.captive || b.snatched || b.falling || !w.rivals.hostile(w, b)) continue;
    const g = Math.hypot(b.x - x, b.y - y);
    if (g < bd) {
      bd = g;
      best = { kind: "brute", id: b.id, x: b.x, y: b.y };
    }
  }
  if (dragons) {
    for (const dr of w.dragons.list) {
      if (dr.z > 260 || dr.state === "perch" || dr.state === "leave" || dr.state === "flee") continue;
      const g = Math.hypot(dr.x - x, dr.y - y);
      if (g < bd) {
        bd = g;
        best = { kind: "dragon", id: dr.id, x: dr.x, y: dr.y };
      }
    }
  }
  return best;
}

/** We're under attack at home (a raid, or something dangerous inside the camp's reach). */
export const homeUnderAttack = (w: World) => !!w.tribe.raid || !!threatAt(w, w.camp.x, w.camp.y, campR(w) + 120);

/**
 * Once a second: who guards whom. Everyone out in the wild gets one war animal (its own rider first,
 * then the nearest free one); the rest patrol.
 */
export function assignWards(w: World) {
  const dinos = w.dinos.filter(isWarDino);
  const dragons = w.dragons.owned.filter(isWarDragon);
  for (const d of dinos) d.ward = undefined;
  for (const dr of dragons) dr.ward = undefined;
  const out = w.humans.filter((h) => outInWild(w, h) && !(h.riding && w.dinoById(h.riding) && isWarDino(w.dinoById(h.riding)!)));
  if (!out.length) return;
  const taken = new Set<number>();
  // its own person first (when they're out there on foot)
  for (const d of dinos) {
    const p = d.work?.partner ? out.find((h) => h.id === d.work!.partner && h.riding !== d.id) : null;
    if (p && !taken.has(p.id)) {
      d.ward = p.id;
      taken.add(p.id);
    }
  }
  for (const dr of dragons) {
    const p = dr.partner ? out.find((h) => h.id === dr.partner && h.aloft !== dr.id) : null;
    if (p && !taken.has(p.id)) {
      dr.ward = p.id;
      taken.add(p.id);
    }
  }
  // then the nearest free guard for everyone else
  // (one with its rider aboard can guard someone too: the rider steers it there)
  const free: (Dino | Dragon)[] = [...dinos.filter((d) => !d.ward), ...dragons.filter((dr) => !dr.ward)];
  for (const h of out) {
    if (taken.has(h.id)) continue;
    let best: Dino | Dragon | null = null;
    let bd = 1800;
    for (const g of free) {
      if (g.ward) continue;
      const dd = Math.hypot(g.x - h.x, g.y - h.y);
      if (dd < bd) {
        bd = dd;
        best = g;
      }
    }
    if (!best) break;
    best.ward = h.id;
    taken.add(h.id);
  }
}

/** A point on the patrol ring round the camp (just outside the walls). */
function ringPoint(w: World, a: number, extra = 150) {
  const r = campR(w) + extra;
  return { x: w.camp.x + Math.cos(a) * r, y: w.camp.y + Math.sin(a) * r * 0.75 };
}

/** Where a guard keeps to beside its person: close, but not on top of them. */
function besideSpot(h: Human, id: number) {
  const side = id % 2 ? 1 : -1;
  return { x: h.x + side * 80, y: h.y + 30 + ((id >> 1) % 2 ? -50 : 0) };
}

/** A war dino with nobody on its back: fight, guard its person, or patrol. True = it's on duty. */
export function warDinoThink(w: World, d: Dino): boolean {
  if (!isWarDino(d) || d.rider) return false;
  // its own needs still come first (a starving guard is no guard)
  if (d.hunger > 0.8 || d.thirst > 0.8 || d.energy < 0.12) return false;
  const ward = d.ward ? w.humans.find((h) => h.id === d.ward) ?? null : null;
  // 1. a fight: near its person, near itself, or (under attack) anywhere round the camp
  let foe = ward ? threatAt(w, ward.x, ward.y, 340) : null;
  foe ??= threatAt(w, d.x, d.y, 280);
  if (!foe && homeUnderAttack(w)) foe = threatAt(w, w.camp.x, w.camp.y, campR(w) + 320);
  if (foe && foe.kind !== "dragon") {
    d.targetId = foe.id;
    d.hurry = false;
    if (d.state !== "war") setState(d, "war", foe.x, foe.y);
    return true;
  }
  // 2. guarding someone out in the wild
  if (ward) {
    const s = besideSpot(ward, d.id);
    const far = Math.hypot(d.x - s.x, d.y - s.y);
    if (far > 50) {
      d.hurry = far > 300;
      if (d.state !== "wander" || Math.hypot(d.tx - s.x, d.ty - s.y) > 40) setState(d, "wander", s.x, s.y);
    } else if (d.state !== "idle") {
      d.hurry = false;
      setState(d, "idle", d.x, d.y);
    }
    return true;
  }
  // 3. the patrol: round and round the camp
  d.hurry = false;
  d.patrolA ??= Math.atan2(d.y - w.camp.y, d.x - w.camp.x);
  const p = ringPoint(w, d.patrolA);
  if (Math.hypot(d.x - p.x, d.y - p.y) < 50 || (d.state === "wander" && d.stuckT > 1.5)) {
    d.patrolA += (d.id % 2 ? 1 : -1) * 0.45;
    const n = ringPoint(w, d.patrolA);
    setState(d, "wander", n.x, n.y);
  } else if (d.state !== "wander" || Math.hypot(d.tx - p.x, d.ty - p.y) > 40) setState(d, "wander", p.x, p.y);
  return true;
}

/**
 * A war dino's rider: they climb on and ride its duty with it (by day). Riding, the person steers:
 * at a threat, beside the one they're guarding, or round the patrol ring. Null = not on duty now.
 */
export function warRiderThink(w: World, h: Human, d: Dino): boolean | null {
  if (!isWarDino(d) || w.daylight < 0.35 || h.child || h.order) return null;
  if (d.hunger > 0.8 || d.thirst > 0.8 || d.energy < 0.12) return null;
  if (h.riding !== d.id) {
    if (d.rider) return null;
    if (Math.hypot(h.x - d.x, h.y - d.y) < 44) {
      mount(w, h, d);
      say(h, pick(w.rng, [`On patrol, ${d.name}!`, "Let's ride!", "Up we go."]));
      return true;
    }
    go(h, "walk", d.x - d.dir * 10, d.y + 6);
    return true;
  }
  const ward = d.ward ? w.humans.find((x) => x.id === d.ward) ?? null : null;
  let foe = ward ? threatAt(w, ward.x, ward.y, 340) : null;
  foe ??= threatAt(w, h.x, h.y, 300);
  if (!foe && homeUnderAttack(w)) foe = threatAt(w, w.camp.x, w.camp.y, campR(w) + 320);
  if (foe && foe.kind !== "dragon") {
    h.targetId = foe.id;
    go(h, "walk", foe.x + (h.id % 2 ? 14 : -14), foe.y);
    return true;
  }
  if (ward) {
    const s = besideSpot(ward, d.id);
    if (Math.hypot(h.x - s.x, h.y - s.y) > 50) go(h, "walk", s.x, s.y);
    else if (h.state !== "guard") go(h, "guard", h.x, h.y);
    return true;
  }
  d.patrolA ??= Math.atan2(h.y - w.camp.y, h.x - w.camp.x);
  const p = ringPoint(w, d.patrolA);
  if (Math.hypot(h.x - p.x, h.y - p.y) < 40 || (h.state === "walk" && h.stateT > 25)) {
    d.patrolA += (d.id % 2 ? 1 : -1) * 0.45;
    const n = ringPoint(w, d.patrolA);
    go(h, "walk", n.x, n.y);
  } else if (h.state !== "walk" || Math.hypot(h.tx - p.x, h.ty - p.y) > 40) go(h, "walk", p.x, p.y);
  return true;
}
