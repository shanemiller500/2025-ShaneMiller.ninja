/* ------------------------------------------------------------------ */
/*  Injuries. People have health (0..1) and a condition:               */
/*    healthy → injured → badly injured → knocked out → (rarely) gone  */
/*  Shields block part of a hit. Knocked-out people lie still until a  */
/*  friend helps them up (or they slowly come round). Only a raider    */
/*  biting someone who's already down ends in the cartoon "gobble".    */
/* ------------------------------------------------------------------ */
import { OUTFIT_BY_ID, SHIELDS } from "../data/colony";
import { P } from "./particles";
import { pick } from "./rng";
import type { Human } from "./types";
import type { World } from "./world";

export type Condition = "healthy" | "injured" | "badly" | "down";

export function condition(h: Human): Condition {
  if (h.state === "down" || h.hp <= 0) return "down";
  if (h.hp < 0.4) return "badly";
  if (h.hp < 0.75) return "injured";
  return "healthy";
}

export const CONDITION_LABEL: Record<Condition, { icon: string; label: string; color: string }> = {
  healthy: { icon: "💚", label: "Healthy", color: "#4ade80" },
  injured: { icon: "🩹", label: "Injured", color: "#facc15" },
  badly: { icon: "🤕", label: "Badly hurt", color: "#fb923c" },
  down: { icon: "😵", label: "Knocked out", color: "#f87171" },
};

export type HurtCause = "bite" | "burn" | "rock" | "cold" | "kick";

/** Damage a person. Returns true if it knocked them out. */
export function hurtHuman(w: World, h: Human, dmg: number, fx: number, fy: number, cause: HurtCause): boolean {
  if (h.stranger && cause === "cold") return false;
  const shield = h.gear.shield ? SHIELDS[h.gear.shield - 1] : null;
  if (shield && cause !== "cold") dmg *= 1 - shield.block * (cause === "burn" ? 0.5 : 1);
  // hide tunics + furs soften bites
  const coat = h.gear.outfit ? OUTFIT_BY_ID[h.gear.outfit] : null;
  if (coat && (cause === "bite" || cause === "kick")) dmg *= 1 - coat.armor;
  if (h.child) dmg *= 0.8;
  if (h.state === "down") return false;
  h.hp = Math.max(0, h.hp - dmg);
  h.fear = 1;
  if (cause !== "cold") {
    w.particles.spawn(P.Star, h.x, h.y, { z: 22 + h.z, size: 6, max: 0.9 });
    w.particles.burst(P.Dust, h.x, h.y, 3, 30, { size: 5, max: 0.5, color: "rgba(200,180,150,0.6)" });
    h.bubble = { text: cause === "burn" ? "Hot hot hot!" : pick(w.rng, ["Ow!", "Ouch!", "Oof!"]), t: 1.6 };
    w.sfx("yelp", h.x, h.y, 0.7);
    // knocked back a little
    const a = Math.atan2(h.y - fy, h.x - fx);
    const nx = h.x + Math.cos(a) * 14;
    const ny = h.y + Math.sin(a) * 10;
    if (w.nav.passable("human", nx, ny)) {
      h.x = nx;
      h.y = ny;
    }
  }
  if (h.hp > 0) return false;
  knockOut(w, h);
  return true;
}

export function knockOut(w: World, h: Human) {
  h.hp = 0;
  h.state = "down";
  h.stateT = 0;
  h.z = 0;
  h.level = 0;
  h.path = null;
  h.carry = null;
  h.carryN = 0;
  h.task = null;
  h.bubble = null;
  if (h.riding) {
    const d = w.dinoById(h.riding);
    if (d) {
      d.rider = 0;
      d.state = "idle";
    }
    h.riding = 0;
  }
  w.particles.spawn(P.Star, h.x, h.y, { z: 14, size: 7, max: 2.2 });
  if (!h.stranger) w.toast("😵", `${h.name} is knocked out! Someone should help them up.`, h.x, h.y);
}

/** One tick of a friend patching someone up. Returns true once they're back on their feet. */
export function healTick(w: World, patient: Human, dt: number) {
  const hut = w.colony.buildings.some((b) => b.kind === "healer" && b.built >= 1 && Math.hypot(b.x - patient.x, b.y - patient.y) < 160);
  const rate = 0.12 * (w.camp.learned.has("medicine") ? 1.6 : 1) * (hut ? 1.6 : 1);
  patient.hp = Math.min(1, patient.hp + rate * dt);
  if (w.rng() < dt * 2) w.particles.spawn(P.Heart, patient.x, patient.y, { z: 16, vz: 20, size: 5, max: 1 });
  if (patient.state === "down" && patient.hp > 0.3) {
    patient.state = "idle";
    patient.stateT = 0;
    patient.think = 0;
    patient.bubble = { text: "Thank you!", t: 2 };
    w.discover("healer", patient.x, patient.y);
    return true;
  }
  return patient.hp >= 0.95;
}

/** Slow natural recovery (faster resting, in houses, in the healing hut). */
export function recover(w: World, h: Human, dt: number) {
  if (h.hp >= 1) return;
  const resting = h.state === "sleep" || h.state === "hide" || h.state === "rest" || h.state === "sitFire";
  let rate = resting ? 0.008 : 0.0015;
  if (h.state === "rest") {
    const hut = w.colony.buildings.some((b) => b.kind === "healer" && b.built >= 1 && Math.hypot(b.x - h.x, b.y - h.y) < 80);
    if (hut) rate *= 3;
  }
  if (w.camp.learned.has("medicine")) rate *= 1.4;
  if (w.civ.has("herbalism")) rate *= 2;
  if (h.state === "down") {
    rate = 0.004;
    // nobody came: they come round by themselves eventually
    if (h.stateT > 50 && h.hp > 0.18) {
      h.state = "idle";
      h.stateT = 0;
      h.think = 0;
      h.bubble = { text: "Ugh… my head.", t: 2 };
    }
  }
  h.hp = Math.min(1, h.hp + rate * dt);
}
