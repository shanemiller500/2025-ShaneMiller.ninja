/* ------------------------------------------------------------------ */
/*  Carcasses. A downed dinosaur stays in the world as a body people   */
/*  can harvest for meat, hide, bone and teeth/claws (amounts scale    */
/*  with its size). Predators come to eat the meat. Left alone it      */
/*  spoils: meat first, then hide, until only bleached bones remain.   */
/*                                                                     */
/*  Stages (what the renderer shows):                                  */
/*    fresh → partial → mostly → bones → gone                          */
/* ------------------------------------------------------------------ */
import { carcassYield } from "../data/colony";
import { sp } from "../data/species";
import { sizeOf } from "./dinos";
import { P } from "./particles";
import type { Carcass, Dino, Item, Resource } from "./types";
import type { World } from "./world";

export type CarcassStage = "fresh" | "partial" | "mostly" | "bones" | "gone";

/** Order people take things off a body. */
const CUT_ORDER: Resource[] = ["meat", "hide", "tooth", "bone"];

export function makeCarcass(w: World, d: Dino, opts: { burnt?: boolean } = {}): Item {
  const def = sp(d.species);
  const size = sizeOf(d);
  const y = carcassYield(size, def.diet !== "herbivore", !!def.shape.horns || !!def.shape.spikes || !!def.shape.club);
  const burnt = !!opts.burnt;
  const c: Carcass = {
    meat: burnt ? 0 : y.meat,
    hide: burnt ? 0 : y.hide,
    bone: y.bone,
    tooth: y.tooth,
    max: { meat: y.meat, hide: y.hide, bone: y.bone, tooth: y.tooth },
    size,
    dir: d.dir,
    burnt,
    rot: 0,
  };
  const it = w.addItem("carcass", d.x, d.y, { species: d.species, amount: c.meat, carcass: c, z: def.move === "fly" ? Math.max(0, d.z) : 0 });
  return it;
}

/** How "used up" the soft parts are (0 = untouched, 1 = only bones). */
export function harvested(c: Carcass) {
  const soft = c.max.meat + c.max.hide;
  if (soft <= 0) return 1;
  return 1 - (c.meat + c.hide) / soft;
}

export function carcassStage(c: Carcass): CarcassStage {
  if (c.meat + c.hide + c.bone + c.tooth <= 0) return "gone";
  if (c.burnt) return "bones";
  const k = harvested(c);
  if (k < 0.15) return "fresh";
  if (k < 0.5) return "partial";
  if (k < 0.92) return "mostly";
  return "bones";
}

export const STAGE_LABEL: Record<CarcassStage, string> = {
  fresh: "Fresh",
  partial: "Partly harvested",
  mostly: "Mostly harvested",
  bones: "Bones",
  gone: "Cleared",
};

export function carcassTotal(c: Carcass) {
  return c.meat + c.hide + c.bone + c.tooth;
}

/** Is there anything worth taking (optionally: of this kind)? */
export function hasYield(it: Item, r?: Resource) {
  const c = it.carcass;
  if (!c) return false;
  if (!r) return carcassTotal(c) > 0;
  return r === "meat" || r === "hide" || r === "bone" || r === "tooth" ? c[r] > 0 : false;
}

/** Seconds per cut (bone knives make it much quicker). */
export function cutTime(w: World) {
  return w.colony.kits.has("boneKnives") ? 1.4 : 2.4;
}

/** One cut: takes a load off the body. Returns what came off (or null if it's bare). */
export function cutCarcass(w: World, it: Item, prefer?: Resource | null, cap = 2): { r: Resource; n: number } | null {
  const c = it.carcass;
  if (!c) return null;
  const order = prefer && hasYield(it, prefer) ? [prefer, ...CUT_ORDER.filter((r) => r !== prefer)] : CUT_ORDER;
  for (const r of order) {
    const left = c[r as "meat"];
    if (left > 0) {
      const per = r === "meat" ? 2 : r === "bone" ? 2 : 1;
      const n = Math.min(left, Math.max(1, Math.round(per * (cap / 2))));
      c[r as "meat"] = left - n;
      it.amount = c.meat;
      it.t = Math.min(it.t, 400);
      const bits = r === "meat" ? "#c8584a" : r === "hide" ? "#8a5a36" : "#efe6cf";
      w.particles.burst(P.Crumb, it.x, it.y, 5, 50, { z: 8, vz: 50, g: 200, size: 2.4, max: 0.6, color: bits });
      w.sfx(r === "bone" || r === "tooth" ? "clack" : "chop", it.x, it.y, 0.45);
      if (carcassTotal(c) <= 0) clearCarcass(w, it);
      return { r, n };
    }
  }
  return null;
}

/** Nothing left: a puff of dust and it's gone. */
export function clearCarcass(w: World, it: Item) {
  w.particles.burst(P.Dust, it.x, it.y, 8, 40, { size: 9, max: 0.8, color: "rgba(190,175,150,0.6)" });
  w.removeItem(it);
}

/** A predator tearing at the meat (amount in "meat units"). Returns true if the meat's all gone. */
export function eatCarcass(it: Item, units: number) {
  const c = it.carcass;
  if (!c) return true;
  c.meat = Math.max(0, c.meat - units);
  // tearing at a body ruins some of the hide too
  if (c.hide > 0 && c.meat < c.max.meat * 0.5) c.hide = Math.max(0, c.hide - units * 0.25);
  it.amount = c.meat;
  return c.meat <= 0;
}

/** Bodies spoil if nobody harvests them: meat, then hide; bones last a long time. */
export function updateCarcass(w: World, it: Item, dt: number) {
  const c = it.carcass;
  if (!c) return;
  const t = it.t;
  // after a couple of minutes the meat starts to go off, then the hide
  const meatCap = c.max.meat * Math.max(0, Math.min(1, 1 - (t - 120) / 150));
  const hideCap = c.max.hide * Math.max(0, Math.min(1, 1 - (t - 240) / 220));
  if (c.meat > meatCap) c.meat = meatCap;
  if (c.hide > hideCap) c.hide = hideCap;
  c.rot = Math.max(0, Math.min(1, (t - 90) / 260));
  it.amount = c.meat;
  // a few cartoon flies over a ripe one
  if (c.rot > 0.15 && c.meat > 0 && w.inView(it.x, it.y, 60) && w.rng() < dt * 3) {
    w.particles.spawn(P.Note, it.x + (w.rng() - 0.5) * c.size * 0.5, it.y, { z: 10 + w.rng() * 16, vz: 6, vx: (w.rng() - 0.5) * 20, size: 3, max: 1, color: "fly" });
  }
  if (t > 900 || carcassTotal(c) <= 0.01) clearCarcass(w, it);
}

/** People who are cutting at (or walking to) this body. */
export function harvesters(w: World, it: Item) {
  return w.humans.filter((h) => h.targetId === -it.id && (h.state === "gather" || h.state === "walk")).length;
}
