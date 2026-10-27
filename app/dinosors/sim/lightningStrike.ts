/* ------------------------------------------------------------------ */
/*  A lightning bolt hitting the ground: anyone standing right where   */
/*  it lands is killed — people and animals alike — and the weapons    */
/*  people are holding are burnt to cinders. Close by, it still hurts  */
/*  and fries what they're carrying. Indoors, in hiding or down in the */
/*  deep you're safe. (Dragons up in the sky: dragonPeril.ts.)          */
/* ------------------------------------------------------------------ */
import { WEAPON_BY_ID } from "../data/colony";
import { sp } from "../data/species";
import { makeCarcass } from "./carcass";
import { dies } from "./death";
import { sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import type { Human } from "./types";
import type { World } from "./world";

/** A direct hit: killed outright (px). */
export const KILL_R = 34;
/** Close by: hurt, and the weapon in their hands is destroyed (px). */
export const SHOCK_R = 80;

/** Safe from the bolt: indoors, hiding, underground or up on a dragon's back (that's dragonPeril's job). */
const sheltered = (h: Human) => !!h.under || !!h.aloft || h.state === "hide" || h.state === "sleep";

/** Burn up whatever weapons + shield this person has on them. Returns what was lost (for the toast). */
function fryGear(w: World, h: Human): string | null {
  const lost: string[] = [];
  for (const id of [h.gear.weapon, h.gear.sidearm]) if (id && WEAPON_BY_ID[id]) lost.push(WEAPON_BY_ID[id].name.toLowerCase());
  if (h.gear.shield) lost.push("shield");
  h.gear.weapon = null;
  h.gear.sidearm = null;
  h.gear.shield = 0;
  if (!lost.length) return null;
  w.particles.burst(P.Smoke, h.x, h.y, 5, 25, { z: 20, vz: 30, size: 7, max: 1, color: "rgba(60,55,50,0.6)" });
  return lost.join(" + ");
}

export function strikeGround(w: World, x: number, y: number) {
  for (const h of w.humans.slice()) {
    if (sheltered(h)) continue;
    const d = Math.hypot(h.x - x, h.y - y);
    if (d > SHOCK_R) continue;
    const lost = fryGear(w, h);
    if (d <= KILL_R) {
      dies(w, h, `${h.name} was struck by lightning${lost ? ` (their ${lost} burnt up with them)` : ""}.`);
      continue;
    }
    hurtHuman(w, h, 0.45 * (1 - d / SHOCK_R) + 0.15, x, y, "rock");
    if (lost && w.humans.includes(h)) {
      h.bubble = { text: "My weapon!", t: 1.8 };
      w.toast("⚡", `Lightning struck beside ${h.name}: their ${lost} burnt to cinders!`, h.x, h.y);
    }
  }
  for (const d of w.dinos.slice()) {
    if (d.state === "carried" || sp(d.species).move === "swim") continue;
    const dist = Math.hypot(d.x - x, d.y - y);
    // bigger animals stand taller: the bolt reaches them from further off
    if (dist <= KILL_R + sizeOf(d) * 0.3) {
      makeCarcass(w, d, { burnt: true });
      w.particles.burst(P.Smoke, d.x, d.y, 8, 30, { vz: 30, size: 10, max: 1.4, color: "rgba(60,55,50,0.6)" });
      if (d.owner || w.inView(d.x, d.y)) w.toast("⚡", `${d.name} the ${sp(d.species).nick} was struck by lightning.`, d.x, d.y);
      w.removeDino(d);
    } else if (dist <= SHOCK_R) d.health = Math.max(0.05, d.health - 0.35 * (1 - dist / SHOCK_R));
  }
}
