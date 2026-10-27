/* ------------------------------------------------------------------ */
/*  Nature is deadlier than any spear: what the world itself can do    */
/*  to a dragon (any dragon: wild, the Sand People's, or ours).        */
/*                                                                     */
/*  • Lightning: a storm's bolt goes for the tallest thing about, and  */
/*    a dragon up in the sky is the tallest thing there is. A strike    */
/*    takes about a third of its strength.                              */
/*  • Meteors: anything under (or flying low over) an impact is         */
/*    smashed, a big rock can kill outright.                           */
/*  • Volcanoes: the eruption's ash + fire column scorches dragons      */
/*    flying through it, falling lava bombs hit them, and standing on   */
/*    molten lava burns.                                               */
/*                                                                     */
/*  Nature ignores a wild dragon's thick scales and a furious one's     */
/*  rage (those only blunt weapons), and it never starts a fight: the   */
/*  dragon doesn't turn on anyone for it. The one exception: a dragon   */
/*  at the monks' offering is under the mountain's peace.              */
/* ------------------------------------------------------------------ */
import type { Dragon } from "./types";
import type { World } from "./world";

export type PerilCause = "lightning" | "meteor" | "volcano" | "lava" | "yeti";

const CAUSE_TEXT: Record<PerilCause, string> = {
  lightning: "was struck by lightning",
  meteor: "was smashed by a falling meteor",
  volcano: "was caught in the volcano's fire",
  lava: "was burned by the lava",
  yeti: "was brought down by a Yeti",
};

/** Every dragon in the world: wild, the Sand People's, the monks' visitor, and ours. */
function everyDragon(w: World): Dragon[] {
  return [...w.dragons.list, ...w.dragons.owned];
}

/** Nature hurts a dragon (absolute harm: no armour, no rage). Returns true if it died of it. */
export function harmDragon(w: World, dr: Dragon, dmg: number, cause: PerilCause): boolean {
  if (dr.monkRite || dr.hp <= 0 || dmg <= 0) return false;
  dr.hp -= dmg;
  dr.hit = 1;
  if (dr.hp > 0) return false;
  dr.hp = 0;
  const near = w.humans.some((h) => !h.under && Math.hypot(h.x - dr.x, h.y - dr.y) < 1400);
  // (a Yeti's win is told by the feud itself)
  if ((near || dr.owner) && cause !== "yeti") w.toast(cause === "lightning" ? "⚡" : cause === "meteor" ? "☄️" : "🌋", `${dr.name} ${CAUSE_TEXT[cause]} and fell from the sky!`, dr.x, dr.y);
  // ours are mourned by ownedUpdate (bones, the bond); everyone else falls where it is
  if (!dr.owner) w.dragons.fall(w, dr);
  return true;
}

/** A lightning strike at (x, y): any dragon right there takes it. */
export function lightningHits(w: World, x: number, y: number) {
  for (const dr of everyDragon(w)) {
    const d = Math.hypot(dr.x - x, dr.y - y);
    if (d > 70) continue;
    harmDragon(w, dr, dr.maxHp * (dr.z > 40 ? 0.34 : 0.2) * (1 - d / 140), "lightning");
  }
}

/** Is there a dragon up in the air near (x, y) for a storm's bolt to go for? (no dice: the rest of the storm plays out the same) */
export function dragonForBolt(w: World, x: number, y: number, r: number): Dragon | null {
  let best: Dragon | null = null;
  let bd = r;
  for (const dr of everyDragon(w)) {
    if (dr.z < 40 || dr.monkRite) continue;
    const d = Math.hypot(dr.x - x, dr.y - y);
    if (d < bd) {
      bd = d;
      best = dr;
    }
  }
  return best;
}

/** A meteor hit (x, y), blast radius r, size s (≈1 a big one): dragons under it or flying low over it are smashed. */
export function meteorHits(w: World, x: number, y: number, r: number, s: number) {
  for (const dr of everyDragon(w)) {
    const d = Math.hypot(dr.x - x, dr.y - y);
    if (d > r || dr.z > 260) continue;
    harmDragon(w, dr, dr.maxHp * Math.min(1.2, 0.75 * s) * (1 - (d / r) * 0.6), "meteor");
  }
}

/** A lava bomb from the volcano lands at (x, y) (size ≈ 6..20). */
export function bombHits(w: World, x: number, y: number, size: number) {
  for (const dr of everyDragon(w)) {
    if (Math.hypot(dr.x - x, dr.y - y) > 40 + size * 3 || dr.z > 220) continue;
    harmDragon(w, dr, dr.maxHp * (0.05 + size * 0.008), "volcano");
  }
}

/**
 * Every frame (from Dragons.update): an erupting volcano's fire + ash column scorches anything flying
 * through it, and molten lava burns a dragon standing on it. Cheap: a handful of dragons.
 */
export function perilTick(w: World, dt: number) {
  const v = w.volcano;
  const erupting = v.phase === "erupt" || v.phase === "ash";
  for (const dr of everyDragon(w)) {
    if (dr.monkRite || dr.hp <= 0) continue;
    if (erupting) {
      const d = Math.hypot(dr.x - v.x, (dr.y - v.y) * 1.2);
      const col = v.phase === "erupt" ? 320 : 220;
      if (d < col) harmDragon(w, dr, dr.maxHp * (v.phase === "erupt" ? 0.07 : 0.03) * (1 - d / col) * dt, "volcano");
    }
    if (dr.z < 8) {
      const tx = Math.floor(dr.x / 32);
      const ty = Math.floor(dr.y / 32);
      if (w.lava.heatAt(tx, ty) > 0.35) harmDragon(w, dr, dr.maxHp * 0.05 * dt, "lava");
    }
  }
}
