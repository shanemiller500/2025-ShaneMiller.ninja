/* ------------------------------------------------------------------ */
/*  Land clearing: a big work dinosaur tramples trees + shrubs.        */
/*                                                                     */
/*  Pick a strong tribe dinosaur and tap the jungle (or use Clear land */
/*  on its card): it walks over and knocks down every plant round that */
/*  spot, one by one. Trees drop wood + sticks for the stores, shrubs  */
/*  leaves + sticks. The trampled ground turns to bare dirt, and a few */
/*  minutes later grass grows back over it.                            */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { baseFuel } from "./fire";
import { setState, sizeOf } from "./dinos";
import { P } from "./particles";
import { MAP_W, T, TILE, type Dino, type Plant, type Resource } from "./types";
import type { World } from "./world";

/** How far round the tapped spot the dino clears. */
export const CLEAR_R = 120;
/** Seconds before trampled dirt grows back into grass. */
export const REGROW_SECONDS = 240;

const TREES = new Set<Plant["kind"]>(["conifer", "palm", "cycad", "broadleaf", "fruit"]);

/** Strong enough to push trees over: a grown herbivore of some size, or a trained worker. */
export function canClear(d: Dino) {
  if (!d.owner || d.rider || d.health <= 0) return false;
  const def = sp(d.species);
  const skill = Math.max(d.work?.skills.hauler ?? 0, d.work?.skills.heavy ?? 0, d.work?.skills.runner ?? 0, d.warTraining ?? 0);
  return def.move === "walk" && (sizeOf(d) >= 55 || skill >= 0.35);
}

/** Send a dinosaur to clear the land round (x, y). Returns why not, or null. */
export function commandClear(w: World, d: Dino, x: number, y: number): string | null {
  if (!canClear(d)) return `${d.name} isn't big or trained enough to push trees over.`;
  const work = d.work;
  if (!work) return `${d.name} needs some work training first.`;
  if (!plantNear(w, x, y, CLEAR_R)) return "Nothing to clear there.";
  work.job = "clear";
  work.clearX = x;
  work.clearY = y;
  work.targetX = x;
  work.targetY = y;
  work.manual = true;
  work.loadT = 0;
  d.think = 0;
  setState(d, "work", x, y);
  return null;
}

function plantNear(w: World, x: number, y: number, r: number): Plant | null {
  if (w.plantsDirty) {
    w.plantHash.rebuild(w.plants);
    w.plantsDirty = false;
  }
  let best: Plant | null = null;
  let bd = Infinity;
  w.plantHash.each(x, y, r, (p, d2) => {
    if (d2 < bd) {
      bd = d2;
      best = p;
    }
  });
  return best;
}

/** Per frame while clearing: walk to the next plant, shove it over, trample the ground. */
export function clearTick(w: World, d: Dino, dt: number) {
  const work = d.work!;
  const cx = work.clearX ?? work.targetX;
  const cy = work.clearY ?? work.targetY;
  if (w.plantsDirty) {
    w.plantHash.rebuild(w.plants);
    w.plantsDirty = false;
  }
  // the next plant: whichever is closest to the dino, inside the clearing
  let next: Plant | null = null;
  let bd = Infinity;
  w.plantHash.each(cx, cy, CLEAR_R, (p) => {
    const dd = Math.hypot(p.x - d.x, p.y - d.y);
    if (dd < bd) {
      bd = dd;
      next = p;
    }
  });
  if (!next) {
    work.job = null;
    work.manual = false;
    work.clearX = work.clearY = undefined;
    setState(d, "idle", d.x, d.y);
    w.toast("🌱", `${d.name} cleared the land. Grass will grow back over the trampled dirt.`, cx, cy);
    return;
  }
  const p = next as Plant;
  const reach = sizeOf(d) * 0.4 + 14;
  if (bd > reach) {
    work.targetX = p.x;
    work.targetY = p.y + 6;
    work.loadT = 0;
    if (d.state !== "work" || Math.hypot(d.tx - p.x, d.ty - p.y - 6) > 8) setState(d, "work", p.x, p.y + 6);
    return;
  }
  d.vx *= 0.3;
  d.vy *= 0.3;
  d.dir = p.x >= d.x ? 1 : -1;
  const tree = TREES.has(p.kind);
  work.loadT += dt * (1 + (d.work?.skills.heavy ?? 0) * 0.6);
  p.shake = Math.max(p.shake, 0.6);
  if (w.rng() < dt * 6) w.particles.spawn(P.Leaf, p.x + (w.rng() - 0.5) * 20, p.y - 10, { z: 20 + w.rng() * 20, vz: 30, vx: (w.rng() - 0.5) * 60, g: 120, size: 3, max: 0.8, color: "#5f8f3a" });
  if (work.loadT < (tree ? 1.4 * p.size + 0.4 : 0.6)) return;
  work.loadT = 0;
  knockDown(w, d, p, tree);
}

function knockDown(w: World, d: Dino, p: Plant, tree: boolean) {
  const i = w.plants.indexOf(p);
  if (i >= 0) w.plants.splice(i, 1);
  w.plantsDirty = true;
  // timber for the stores
  const got: Partial<Record<Resource, number>> = tree ? { wood: 1 + Math.round(p.size * 2), stick: 1 } : { leaves: 1, stick: w.rng() < 0.5 ? 1 : 0 };
  for (const [r, n] of Object.entries(got) as [Resource, number][]) if (n) w.camp.stock[r] += n;
  w.particles.burst(P.Leaf, p.x, p.y - 12, tree ? 14 : 6, 70, { z: 18, size: 3.5, max: 1, color: "#6b9a3f" });
  w.particles.burst(P.Dust, p.x, p.y, 6, 50, { size: 9, max: 0.7, color: "rgba(140,110,70,0.55)" });
  w.sfx(tree ? "timber" : "rustle", p.x, p.y, 0.7);
  // the ground underneath is trampled to dirt (and grows back later)
  trample(w, p.x, p.y, tree ? 1 : 0);
  if (!w.flags.has("firstClearing")) {
    w.flags.add("firstClearing");
    w.toast("🌳", `${d.name} is pushing over trees! Timber goes to the stores, and the trampled ground grows back as grass.`, p.x, p.y);
  }
}

const TRAMPLE = new Set<T>([T.Jungle, T.Forest, T.Grass, T.Swamp]);

function trample(w: World, x: number, y: number, r: number) {
  const tx0 = Math.floor(x / TILE);
  const ty0 = Math.floor(y / TILE);
  for (let ty = ty0 - r; ty <= ty0 + r; ty++) for (let tx = tx0 - r; tx <= tx0 + r; tx++) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty * MAP_W >= w.terrain.tiles.length) continue;
    const i = ty * MAP_W + tx;
    const t = w.terrain.tiles[i] as T;
    if (!TRAMPLE.has(t)) continue;
    w.terrain.setTile(tx, ty, T.Dirt);
    w.fire.fuel[i] = baseFuel(T.Dirt);
    w.cleared.push({ i, at: w.elapsed + REGROW_SECONDS * (0.8 + w.rng() * 0.4) });
  }
}

/** Trampled dirt grows back into grass (checked every couple of seconds). */
export function regrowTick(w: World) {
  if (!w.cleared.length) return;
  const keep: { i: number; at: number }[] = [];
  for (const c of w.cleared) {
    if (w.elapsed < c.at) {
      keep.push(c);
      continue;
    }
    const tx = c.i % MAP_W;
    const ty = Math.floor(c.i / MAP_W);
    if (w.terrain.tiles[c.i] === T.Dirt && !w.colony.occupied(w).has(c.i)) {
      w.terrain.setTile(tx, ty, T.Grass);
      w.fire.fuel[c.i] = baseFuel(T.Grass);
    }
  }
  w.cleared = keep;
}
