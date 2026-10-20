/* ------------------------------------------------------------------ */
/*  Clan towns + unions + catapults (the Neanderthals grow up).        */
/*                                                                     */
/*  The clans are all friends now: instead of feuding they unite. Two  */
/*  bands that join become one, flying both colours (a third adds its  */
/*  colour, and so on) and their camp grows into a clan town: a ring   */
/*  of mammoth-tusk + bone stakes, big domed huts, a skull war totem   */
/*  and striped banners (nothing like ours).                           */
/*                                                                     */
/*  A clan town builds catapults. One rolls along with each raid,      */
/*  stops just out of reach of our Scorpions (they top out at 700) and */
/*  lobs flaming boulders at them, then at towers + walls. It's tough, */
/*  but people (and dragons) can still get at it.                      */
/* ------------------------------------------------------------------ */
import { hurtHuman } from "./injury";
import { P } from "./particles";
import type { Brute, Clan } from "./types";
import type { World } from "./world";

/** Highest camp tier (3 = a big camp; 4 + 5 = a clan town). */
export const MAX_CAMP_TIER = 5;
/** A catapult throws this far: just past our heaviest Scorpion (700). */
export const CATAPULT_RANGE = 940;
export const CATAPULT_RELOAD = 4.5;
export const BOULDER_DMG = 170;

/** Every colour the clan flies (its own, plus each band that joined it). */
export const colorsOf = (c: Clan) => (c.colors?.length ? c.colors : [c.color]);

/** A town (not just a camp): a union of clans, or a camp grown big. */
export const isTown = (c: Clan) => colorsOf(c).length > 1 || (c.campTier ?? 0) >= 4;

/** Has this clan learned to build catapults? */
export const hasEngines = (c: Clan) => isTown(c) && (c.campTier ?? 0) >= 3;

/** Two bands become one: colours + names combine, and the camp grows into a town. */
export function unite(from: Clan, into: Clan) {
  const cols = colorsOf(into).concat(colorsOf(from).filter((c) => !colorsOf(into).includes(c)));
  into.colors = cols;
  // "Grak-Thud", then "Grak-Thud-Mog"; bigger unions keep the first three names
  const names = (into.name + "-" + from.name).split("-");
  into.name = names.slice(0, 3).join("-");
  into.campTier = Math.min(MAX_CAMP_TIER, Math.max(into.campTier ?? 0, from.campTier ?? 0) + 1);
}

/** What a catapult should smash first: Scorpions, then towers, then walls (null = nothing in sight). */
export function siegeTarget(w: World, b: Brute): { x: number; y: number; kind: "scorpion" | "tower" | "wall" | "camp"; id: number } {
  let best: { x: number; y: number; kind: "scorpion" | "tower" | "wall" | "camp"; id: number } | null = null;
  let bd = Infinity;
  for (const s of w.colony.scorpions) {
    if (s.built < 1 || s.hp <= 0) continue;
    const d = Math.hypot(s.x - b.x, s.y - b.y);
    if (d < bd) {
      bd = d;
      best = { x: s.x, y: s.y, kind: "scorpion", id: s.id };
    }
  }
  if (best) return best;
  for (const t of w.tribe.towers) {
    if (t.hp <= 0 || t.stage <= 0) continue;
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (d < bd) {
      bd = d;
      best = { x: t.x, y: t.y, kind: "tower", id: t.id };
    }
  }
  if (best) return best;
  for (const wl of w.tribe.walls) {
    if (wl.built < 1 || wl.hp <= 0) continue;
    const x = wl.tx * 32 + 16;
    const y = wl.ty * 32 + 16;
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < bd) {
      bd = d;
      best = { x, y, kind: "wall", id: wl.id };
    }
  }
  return best ?? { x: w.camp.pileX, y: w.camp.pileY, kind: "camp", id: 0 };
}

/** A flaming boulder lands: smashes what it hit and sets the ground alight. */
export function boulderLands(w: World, x: number, y: number, target: number, kind: "scorpion" | "tower" | "wall" | "camp" | undefined, damage = BOULDER_DMG, fireball = false) {
  w.particles.burst(P.Rock, x, y, 10, 70, { z: 20, size: 5, max: 0.8, color: "#8f877a" });
  w.particles.burst(P.Ember, x, y, 10, 60, { z: 10, vz: 60, size: 4, max: 0.9, color: "#ff8a2a" });
  if (fireball) w.particles.burst(P.Ember, x, y, 24, 110, { z: 18, vz: 95, g: 110, size: 7, max: 1.2, color: "#ff5a1f" });
  w.particles.burst(P.Dust, x, y, 6, 50, { size: 14, max: 1, color: "rgba(150,130,100,0.6)" });
  w.sfx("boom", x, y, 0.8, 0.9);
  const tx = Math.floor(x / 32);
  const ty = Math.floor(y / 32);
  const radius = fireball ? 2 : 1;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (w.rng() < (fireball ? 0.55 : 0.35)) w.fire.ignite(w, tx + dx, ty + dy, fireball ? 1 : 0.7);
  if (kind === "scorpion") {
    const sc = w.colony.scorpions.find((s) => s.id === target && s.built >= 1);
    if (sc && Math.hypot(sc.x - x, sc.y - y) < 44) {
      sc.hp = Math.max(0, sc.hp - damage);
      if (sc.hp <= 0) w.toast("🪨", "A clan catapult smashed one of our Scorpions!", sc.x, sc.y);
    }
  } else if (kind === "tower") {
    const t = w.tribe.towers.find((o) => o.id === target);
    if (t && Math.hypot(t.x - x, t.y - y) < 50) t.hp = Math.max(0, t.hp - damage * 0.8);
  } else if (kind === "wall") {
    const wl = w.tribe.walls.find((o) => o.id === target);
    if (wl && Math.hypot(wl.tx * 32 + 16 - x, wl.ty * 32 + 16 - y) < 40) wl.hp -= damage * 0.9;
  }
  // anyone standing there gets knocked flat
  for (const h of w.humans) if (!h.aloft && Math.hypot(h.x - x, h.y - y) < (fireball ? 65 : 30)) hurtHuman(w, h, fireball ? 0.35 : 0.25, x, y, fireball ? "burn" : "rock");
}
