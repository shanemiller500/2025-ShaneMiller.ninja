/* ------------------------------------------------------------------ */
/*  Clear an area: drag a box over the wild growth (🪓 Clear area by   */
/*  Group select) and the people you picked (and a strong dinosaur)    */
/*  clear everything in it down to grass: trees, berry bushes, ferns.  */
/*  With nobody picked, a few free hands (and any big tame dino) go.   */
/*                                                                     */
/*  People chop one plant at a time (bigger trees take longer), the    */
/*  timber, sticks, leaves + berries go to the stores, and the ground  */
/*  underneath turns to grass. Dinos push trees over inside the box.   */
/*  Once it's empty the area is kept clear: nothing sprouts back.      */
/* ------------------------------------------------------------------ */
import { canClear, commandClear } from "./clearing";
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { MAP_W, T, TILE, type Dino, type Human, type Plant, type Resource } from "./types";
import type { World } from "./world";

export interface ClearRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ClearJob extends ClearRect {
  id: number;
  people: number[];
  dinos: number[];
}

const TREES = new Set<Plant["kind"]>(["conifer", "palm", "cycad", "broadleaf", "fruit"]);
const GROWN_OVER = new Set<T>([T.Jungle, T.Forest, T.Swamp, T.Dirt]);

const inRect = (r: ClearRect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** Is (x, y) in an area the tribe keeps clear (nothing sprouts there)? */
export function keptClear(w: World, x: number, y: number) {
  return w.keepClear.some((r) => inRect(r, x, y));
}

/** Plants still standing in a box. */
export function plantsIn(w: World, r: ClearRect) {
  return w.plants.filter((p) => inRect(r, p.x, p.y));
}

/** Start clearing a box (returns why not, or a short summary). */
export function startClearJob(w: World, r: ClearRect, people: Human[], dinos: Dino[]): { ok: boolean; msg: string } {
  const rect = { x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) };
  if (rect.x1 - rect.x0 < TILE || rect.y1 - rect.y0 < TILE) return { ok: false, msg: "Drag a bigger box over the area to clear." };
  const left = plantsIn(w, rect).length;
  if (!left) {
    groundToGrass(w, rect);
    w.keepClear.push(rect);
    return { ok: false, msg: "Nothing growing there to clear: it's open ground already (kept clear now)." };
  }
  let crew = people.filter(free);
  let beasts = dinos.filter((d) => canClear(d));
  // nobody picked: a few free hands, and any big tame dino nearby
  if (!crew.length && !beasts.length) {
    const cx = (rect.x0 + rect.x1) / 2;
    const cy = (rect.y0 + rect.y1) / 2;
    crew = w.humans.filter((h) => free(h) && !h.taskId && !h.order && w.tribe.roleOf(h) !== "guard")
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, Math.min(6, 2 + Math.floor(left / 10)));
    beasts = w.dinos.filter((d) => canClear(d) && !d.chariot && !(d.work?.job === "clear"))
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 2);
  }
  // people picked but no dino: a strong tame one nearby lends a hand too (it pushes the trees over)
  if (crew.length && !beasts.length) {
    const cx = (rect.x0 + rect.x1) / 2;
    const cy = (rect.y0 + rect.y1) / 2;
    const helper = w.dinos.filter((d) => canClear(d) && !d.chariot && d.work?.job !== "clear" && Math.hypot(d.x - cx, d.y - cy) < 1600)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    if (helper) beasts = [helper];
  }
  if (!crew.length && !beasts.length) return { ok: false, msg: "Nobody is free to clear it. Pick some people (or a big tame dino) first." };
  const job: ClearJob = { id: w.nextId(), ...rect, people: crew.map((h) => h.id), dinos: beasts.map((d) => d.id) };
  w.clearJobs.push(job);
  for (const h of crew) {
    const old = w.tasks.get(h.taskId);
    if (old) old.people = old.people.filter((id) => id !== h.id);
    h.taskId = 0;
    h.order = null;
    h.task = null;
    h.clearJob = job.id;
    h.think = 0;
  }
  for (const d of beasts) if (d.work) d.work.clearRect = rect;
  const who = [crew.length ? `${crew.length} ${crew.length === 1 ? "person" : "people"}` : "", beasts.length ? beasts.map((d) => d.name).join(" + ") : ""].filter(Boolean).join(" and ");
  return { ok: true, msg: `${who} set to clearing ${left} plant${left === 1 ? "" : "s"} down to grass.` };
}

function free(h: Human) {
  return !h.child && !h.stranger && !h.captive && !h.under && !h.aloft && !h.chariot && h.state !== "down" && h.hp > 0.3;
}

/** A clearer's turn (from think): on to the nearest plant left in the box. True = busy with it. */
export function clearThink(w: World, h: Human): boolean {
  const job = w.clearJobs.find((j) => j.id === h.clearJob);
  if (!job || h.taskId || h.order) {
    h.clearJob = undefined;
    return false;
  }
  if (h.state === "clear") return true;
  // nearest plant nobody else is on
  let best: Plant | null = null;
  let bd = Infinity;
  for (const p of w.plants) {
    if (!inRect(job, p.x, p.y)) continue;
    if (w.humans.some((o) => o !== h && o.clearJob === job.id && o.targetId === p.id && (o.state === "clear" || o.state === "walk"))) continue;
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  if (!best) return true; // the others are on the last few: wait (finishJob releases everyone)
  h.targetId = best.id;
  const side = h.x < best.x ? -1 : 1;
  const sx = best.x + side * (TREES.has(best.kind) ? 16 : 10);
  if (Math.hypot(h.x - sx, h.y - best.y - 4) < 12) {
    go(h, "clear", h.x, h.y);
    h.dir = best.x > h.x ? 1 : -1;
  } else go(h, "walk", sx, best.y + 4);
  return true;
}

/** Chopping / pulling up the plant in front of them. */
export function clearTick(w: World, h: Human, dt: number) {
  const p = w.plants.find((x) => x.id === h.targetId);
  if (!p) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
    return;
  }
  h.anim += dt * 6;
  p.shake = Math.max(p.shake, 0.5);
  const tree = TREES.has(p.kind) && !p.stump;
  if (w.rng() < dt * (tree ? 3 : 5)) w.sfx(tree ? "chop" : "rustle", p.x, p.y, 0.35);
  if (w.rng() < dt * 4) w.particles.spawn(tree ? P.Crumb : P.Leaf, p.x + (w.rng() - 0.5) * 16, p.y - 10, { z: 14, vz: 40, vx: (w.rng() - 0.5) * 50, g: 160, size: 2.5, max: 0.6, color: tree ? "#a07a4a" : "#6b9a3f" });
  const time = tree ? 1.2 + p.size * 2.6 : 1;
  if (h.stateT < time) return;
  // down it comes: what it gives goes to the stores; the ground underneath turns to grass
  const i = w.plants.indexOf(p);
  if (i >= 0) w.plants.splice(i, 1);
  w.plantsDirty = true;
  const got: Partial<Record<Resource, number>> = tree
    ? { wood: 1 + Math.round(p.size * 2), stick: 1 }
    : { leaves: 1, stick: w.rng() < 0.4 ? 1 : 0, berries: p.kind === "bush" ? Math.max(0, Math.floor(p.fruit ?? 0)) : 0 };
  if (p.kind === "fruit") got.berries = Math.max(0, Math.floor(p.fruit ?? 0));
  for (const [r, n] of Object.entries(got) as [Resource, number][]) if (n) w.camp.stock[r] += n;
  w.particles.burst(P.Leaf, p.x, p.y - 10, tree ? 10 : 5, 60, { z: 14, size: 3, max: 0.9, color: "#6b9a3f" });
  if (tree) w.sfx("timber", p.x, p.y, 0.6);
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);
  const ti = ty * MAP_W + tx;
  if (ti >= 0 && ti < w.terrain.tiles.length && GROWN_OVER.has(w.terrain.tiles[ti] as T)) w.terrain.setTile(tx, ty, T.Grass);
  if (w.rng() < 0.15) say(h, pick(w.rng, ["Timber!", "One more down!", "Clearing it!", "Room to build!"]));
  go(h, "idle", h.x, h.y);
  h.think = 0;
}

/** Once a second: dinos keep trampling inside the box; an empty box is finished (grass, kept clear). */
export function clearJobsTick(w: World) {
  for (const job of [...w.clearJobs]) {
    const left = plantsIn(w, job);
    if (!left.length) {
      finishJob(w, job);
      continue;
    }
    for (const id of job.dinos) {
      const d = w.dinoById(id);
      if (!d || !canClear(d) || d.work?.job === "clear") continue;
      // its last patch is done: on to the nearest plant still standing in the box
      const p = left.sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
      if (d.work) d.work.clearRect = job;
      commandClear(w, d, p.x, p.y);
    }
    // nobody left on it (they were given other jobs): the job's dropped
    if (!w.humans.some((h) => h.clearJob === job.id) && !job.dinos.some((id) => w.dinoById(id)?.work?.clearRect === job)) {
      w.clearJobs.splice(w.clearJobs.indexOf(job), 1);
    }
  }
}

function finishJob(w: World, job: ClearJob) {
  w.clearJobs.splice(w.clearJobs.indexOf(job), 1);
  groundToGrass(w, job);
  w.keepClear.push({ x0: job.x0, y0: job.y0, x1: job.x1, y1: job.y1 });
  for (const h of w.humans) if (h.clearJob === job.id) {
    h.clearJob = undefined;
    if (h.state === "clear") go(h, "idle", h.x, h.y);
    h.think = 0;
  }
  for (const id of job.dinos) {
    const d = w.dinoById(id);
    if (d?.work && d.work.clearRect === job) d.work.clearRect = undefined;
  }
  w.sfx("cheer", (job.x0 + job.x1) / 2, (job.y0 + job.y1) / 2, 0.6);
  w.toast("🌱", "Area cleared down to grass: room for the camp to grow. It'll be kept clear.", (job.x0 + job.x1) / 2, (job.y0 + job.y1) / 2);
}

/** Overgrown ground in a box (jungle floor, forest litter, bog, bare dirt) becomes grass. */
function groundToGrass(w: World, r: ClearRect) {
  const tx0 = Math.max(0, Math.floor(r.x0 / TILE));
  const ty0 = Math.max(0, Math.floor(r.y0 / TILE));
  const tx1 = Math.min(MAP_W - 1, Math.floor(r.x1 / TILE));
  const ty1 = Math.floor(r.y1 / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * MAP_W + tx;
    if (i >= w.terrain.tiles.length) continue;
    if (GROWN_OVER.has(w.terrain.tiles[i] as T)) w.terrain.setTile(tx, ty, T.Grass);
  }
}
