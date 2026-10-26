/* ------------------------------------------------------------------ */
/*  Vineyards + wine.                                                  */
/*                                                                     */
/*  A vineyard is a field of trellised grape vines (Farm tool → 🍇).   */
/*  Planting it clears the wild growth in and round the plot (bushes,  */
/*  ferns, saplings: their berries + sticks go to the stores) and sets */
/*  out neat rows; wild berry bushes cleared there become the cuttings */
/*  it's planted with (else a farmer brings 2 berries). Vines are      */
/*  perennial: after each harvest they grow back, no replanting.       */
/*                                                                     */
/*  A Winery presses the grapes into wine (cooks + farmers work it).   */
/*  Grown-ups enjoy a cup at the evening fire: a lift of energy and    */
/*  good cheer. (Children never drink it.)                             */
/* ------------------------------------------------------------------ */
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import type { Farm, Human, Plant } from "./types";
import type { World } from "./world";

/** How far round a vineyard the wild growth is cleared when it's planted. */
export const VINE_CLEAR_R = 62;
/** Grapes per harvest (plus a berry or two to eat). */
export const GRAPE_YIELD = 4;
/** Grapes pressed into one wine. */
export const GRAPES_PER_WINE = 3;
/** The wine stores hold this much (then the press rests). */
export const WINE_CAP = 30;
/** Seconds of pressing per wine. */
const PRESS_FOR = 4;

const WILD = new Set<Plant["kind"]>(["bush", "fern", "horsetail", "cycad", "reeds"]);

/** Planting a vineyard: clear the wild growth round it. Returns how many wild berry bushes became cuttings. */
export function clearForVines(w: World, f: Farm) {
  let cuttings = 0;
  let cleared = 0;
  for (let i = w.plants.length - 1; i >= 0; i--) {
    const p = w.plants[i];
    if (Math.hypot(p.x - f.x, (p.y - f.y) * 1.4) > VINE_CLEAR_R) continue;
    // The planted plot itself stays clear, including large tree trunks.
    const onPlot = Math.abs(p.x - f.x) <= 38 && Math.abs(p.y - f.y) <= 22;
    if (!onPlot && !WILD.has(p.kind) && !(p.size < 0.6 && !p.stump)) continue;
    w.plants.splice(i, 1);
    cleared++;
    if (p.kind === "bush") {
      cuttings++;
      w.camp.stock.berries += Math.max(0, Math.floor(p.fruit ?? 0));
    }
    w.camp.stock.stick += p.size > 0.4 ? 1 : 0;
    if (cleared < 8) w.particles.burst(P.Leaf, p.x, p.y - 8, 5, 40, { z: 10, size: 3, max: 0.8, color: "#6b9a3f" });
  }
  if (cleared) w.plantsDirty = true;
  return cuttings;
}

/** Wild berry bushes standing on the plot (they become its cuttings). */
function wildBushes(w: World, f: Farm) {
  return w.plants.filter((p) => p.kind === "bush" && Math.hypot(p.x - f.x, (p.y - f.y) * 1.4) <= VINE_CLEAR_R).length;
}

/** Can a farmer plant this vineyard now? (cuttings from the wild bushes on it, or 2 berries from the stores) */
export function vinesReady(w: World, f: Farm) {
  return w.camp.stock.berries >= 2 || wildBushes(w, f) > 0;
}

/** The farm tick for a vineyard: plant (clearing the wild growth), or harvest (the vines stay). */
export function tendVines(w: World, h: Human, f: Farm) {
  if (!f.planted) {
    if (!vinesReady(w, f)) return false;
    // the wild growth comes out; its berry bushes are the cuttings (else 2 berries from the stores)
    if (clearForVines(w, f) === 0) w.camp.stock.berries -= 2;
    f.planted = true;
    f.growth = 0;
    say(h, "Vines in rows!");
    if (!w.flags.has("vineyard")) {
      w.flags.add("vineyard");
      w.toast("🍇", `${h.name} cleared the wild growth and planted a vineyard in neat rows. Grapes in a while, and the vines grow back after every harvest.`, f.x, f.y);
    }
    return true;
  }
  if (f.growth < 1) return false;
  // pick the grapes; the vines stay and fruit again
  w.camp.stock.grapes += GRAPE_YIELD;
  w.camp.stock.berries += 1;
  f.growth = 0.3;
  say(h, `Grapes! +${GRAPE_YIELD}`);
  w.particles.burst(P.Crumb, f.x, f.y - 6, 8, 40, { z: 10, vz: 40, g: 200, size: 3, max: 0.7, color: "#7b3fa0" });
  w.discover("harvest", f.x, f.y);
  if (!w.flags.has("grapes")) {
    w.flags.add("grapes");
    w.toast("🍇", `The first grapes are in! ${w.colony.finished("winery") ? "The winery can press them into wine." : "Build a 🍷 Winery (Build → Work) to press them into wine."}`, f.x, f.y);
  }
  return true;
}

/** A cook or farmer with nothing else on: off to the winery to press grapes (true = on it). */
export function wineThink(w: World, h: Human) {
  if (h.child) return false;
  const s = w.camp.stock;
  if (s.grapes < GRAPES_PER_WINE || s.wine >= WINE_CAP) return false;
  const winery = w.colony.buildings.find((b) => b.kind === "winery" && b.built >= 1 && b.hp > 0);
  if (!winery) return false;
  if (w.humans.some((o) => o !== h && o.state === "press" && o.targetId === winery.id)) return false;
  const d = w.colony.door(winery);
  h.targetId = winery.id;
  if (Math.hypot(h.x - d.x, h.y - d.y) < 14) go(h, "press", h.x, h.y);
  else {
    h.task = null;
    go(h, "walk", d.x, d.y);
  }
  return true;
}

/** Pressing: every few seconds 3 grapes become a wine. */
export function pressTick(w: World, h: Human, dt: number) {
  const s = w.camp.stock;
  const winery = w.colony.buildings.find((b) => b.id === h.targetId && b.kind === "winery" && b.built >= 1);
  if (!winery || s.grapes < GRAPES_PER_WINE || s.wine >= WINE_CAP) {
    go(h, "idle", h.x, h.y);
    return;
  }
  h.anim += dt * 6;
  h.z = Math.abs(Math.sin(h.stateT * 6)) * 3; // treading the grapes
  if (w.rng() < dt * 4) w.particles.spawn(P.Drop, winery.x + (w.rng() - 0.5) * 20, winery.y - 10, { z: 6, vz: 30, vx: (w.rng() - 0.5) * 30, g: 200, size: 2, max: 0.5, color: "#6d1f4a" });
  if (h.stateT < PRESS_FOR) return;
  h.stateT = 0;
  s.grapes -= GRAPES_PER_WINE;
  s.wine += 1;
  if (!w.flags.has("wine")) {
    w.flags.add("wine");
    w.toast("🍷", `${h.name} pressed the first wine! Grown-ups will enjoy a cup at the evening fire.`, winery.x, winery.y);
  }
}

/** By the evening fire (or after a meal), a grown-up now and then enjoys a cup of wine: energy + cheer. */
export function maybeDrink(w: World, h: Human) {
  if (h.child || h.stranger || w.camp.stock.wine < 1) return false;
  if (w.time < 17 && w.time > 4) return false;
  if ((h.drankAt ?? -999) > w.elapsed - 240 || w.rng() > 0.35) return false;
  w.camp.stock.wine -= 1;
  h.drankAt = w.elapsed;
  h.energy = Math.min(1, h.energy + 0.25);
  h.fear = Math.max(0, h.fear - 0.3);
  if (w.rng() < 0.4) say(h, pick(w.rng, ["Cheers! 🍷", "Good wine!", "Ahh, that's nice.", "To the tribe!"]));
  return true;
}
