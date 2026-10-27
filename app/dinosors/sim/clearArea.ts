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
/*                                                                     */
/*  A job never sticks half-done: plants nobody can reach (in water,   */
/*  up a cliff) are skipped, a crew pulled off onto other work is      */
/*  replaced by free hands, and jobs are saved, so a reload carries    */
/*  on where it left off.                                              */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
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
  /** plants nobody can get to (left standing; they don't hold the job up) */
  skip: number[];
  /** how many plants it started with (for the progress label) */
  total: number;
  /** seconds with nobody at all on it (it's dropped after a while) */
  idle: number;
}

const TREES = new Set<Plant["kind"]>(["conifer", "palm", "cycad", "broadleaf", "fruit"]);
const GROWN_OVER = new Set<T>([T.Jungle, T.Forest, T.Swamp, T.Dirt]);
/** seconds a clearer may spend failing to reach one plant before it's given up as out of reach */
const REACH_FOR = 20;
/** seconds a job may sit with nobody on it (and nobody free to take it over) before it's dropped */
const ABANDON_AFTER = 90;
/** undergrowth (ferns, bushes, reeds) this close to a plant coming down is swept up with it (px) */
const SWEEP_R = 26;
/** the most people on one job (the crew grows as hands come free) */
const CREW_MAX = 12;

const inRect = (r: ClearRect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const sameRect = (a: ClearRect | undefined, b: ClearRect) => !!a && a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;

/** Each clearer's current plant + since when they've been trying to reach it. */
const tries = new WeakMap<Human, { id: number; since: number }>();

/** Is (x, y) in an area the tribe keeps clear (nothing sprouts there)? */
export function keptClear(w: World, x: number, y: number) {
  return w.keepClear.some((r) => inRect(r, x, y));
}

/** Wild plants we keep: the bushes an unplanted vineyard will be planted from (buildClear.ts keeps them too). */
function kept(w: World) {
  const vines = w.tribe.farms.filter((f) => f.crop === "grape" && !f.planted);
  return vines.length ? (p: Plant) => vines.some((f) => Math.hypot(p.x - f.x, (p.y - f.y) * 1.4) <= 62) : null;
}

/** Plants still standing in a box (only nature: trees, bushes, ferns, reeds; never the vineyard's cuttings). */
export function plantsIn(w: World, r: ClearRect) {
  const keep = kept(w);
  return w.plants.filter((p) => inRect(r, p.x, p.y) && !keep?.(p));
}

/** Plants a job still has to clear (not the ones out of reach). */
export function plantsLeft(w: World, job: ClearJob) {
  const skip = job.skip.length ? new Set(job.skip) : null;
  return plantsIn(w, job).filter((p) => !skip?.has(p.id));
}

/** Wild ground on this tile back to grass; anything we built (camp floor, paths, under buildings) stays as it is. */
function toGrass(w: World, tx: number, ty: number, built: Set<number>) {
  const i = ty * MAP_W + tx;
  if (i < 0 || i >= w.terrain.tiles.length || built.has(i) || !GROWN_OVER.has(w.terrain.tiles[i] as T)) return;
  // the trodden camp floor round the cave is ours
  if (w.terrain.tiles[i] === T.Dirt && Math.abs((tx + 0.5) * TILE - w.camp.x) < 170 && Math.abs((ty + 0.5) * TILE - w.camp.y) < 105) return;
  w.terrain.setTile(tx, ty, T.Grass);
}

const builtTiles = (w: World) => {
  const s = w.colony.occupied(w);
  for (const b of w.colony.buildings) {
    if (b.kind !== "path" && b.kind !== "bridge") continue;
    const d = BUILDINGS[b.kind];
    for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) s.add((b.ty + dy) * MAP_W + b.tx + dx);
  }
  return s;
};

/** Where a clearer stands to chop this plant (beside it on open ground), or null when there's nowhere. */
function standSpot(w: World, h: Pick<Human, "x">, p: Plant) {
  const off = TREES.has(p.kind) ? 16 : 10;
  const first = h.x < p.x ? -1 : 1;
  for (const [dx, dy] of [[first * off, 4], [-first * off, 4], [0, 14], [0, -10]] as const) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (w.nav.passable("human", x, y)) return { x, y };
  }
  return null;
}

function free(h: Human) {
  return !h.child && !h.stranger && !h.captive && !h.under && !h.aloft && !h.chariot && h.state !== "down" && h.hp > 0.3;
}

/**
 * Free hands to put on a job: grown-ups not on a task, order or watch. `spare` = only the ones with
 * nothing better on (gatherers, whose work is harvesting the wild anyway, and anyone standing idle).
 */
function freeHands(w: World, r: ClearRect, n: number, spare = false) {
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2;
  return w.humans.filter((h) => free(h) && !h.taskId && !h.order && !h.clearJob && w.tribe.roleOf(h) !== "guard" && (!spare || h.state === "idle" || w.tribe.roleOf(h) === "gatherer"))
    .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, n);
}

function enlist(w: World, job: ClearJob, crew: Human[]) {
  for (const h of crew) {
    const old = w.tasks.get(h.taskId);
    if (old) old.people = old.people.filter((id) => id !== h.id);
    h.taskId = 0;
    h.order = null;
    h.task = null;
    h.clearJob = job.id;
    h.think = 0;
    if (!job.people.includes(h.id)) job.people.push(h.id);
  }
}

/** How many people a job with this many plants left wants. */
const crewFor = (left: number) => Math.min(CREW_MAX, 3 + Math.ceil(left / 25));

/** Start clearing a box (returns why not, or a short summary). */
export function startClearJob(w: World, r: ClearRect, people: Human[], dinos: Dino[]): { ok: boolean; msg: string } {
  const rect = { x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) };
  if (rect.x1 - rect.x0 < TILE || rect.y1 - rect.y0 < TILE) return { ok: false, msg: "Drag a bigger box over the area to clear." };
  const plants = plantsIn(w, rect);
  if (!plants.length) {
    groundToGrass(w, rect);
    w.keepClear.push(rect);
    return { ok: false, msg: "Nothing growing there to clear: it's open ground already (kept clear now)." };
  }
  // a box over (most of) one already being cleared: that's the same job
  const dup = w.clearJobs.find((j) => Math.max(0, Math.min(j.x1, rect.x1) - Math.max(j.x0, rect.x0)) * Math.max(0, Math.min(j.y1, rect.y1) - Math.max(j.y0, rect.y0)) > 0.8 * (rect.x1 - rect.x0) * (rect.y1 - rect.y0));
  if (dup) return { ok: false, msg: `That area is already being cleared (${plantsLeft(w, dup).length} plants left).` };
  const left = plants.length;
  let crew = people.filter(free);
  let beasts = dinos.filter((d) => canClear(d));
  // nobody picked: a few free hands, and any big tame dino nearby
  if (!crew.length && !beasts.length) {
    const cx = (rect.x0 + rect.x1) / 2;
    const cy = (rect.y0 + rect.y1) / 2;
    crew = freeHands(w, rect, crewFor(left));
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
  const job: ClearJob = { id: w.nextId(), ...rect, people: [], dinos: beasts.map((d) => d.id), skip: [], total: left, idle: 0 };
  w.clearJobs.push(job);
  enlist(w, job, crew);
  // the dinos keep to this box (the job's own rect, so the checks below always match it)
  for (const d of beasts) if (d.work) d.work.clearRect = { x0: job.x0, y0: job.y0, x1: job.x1, y1: job.y1 };
  const who = [crew.length ? `${crew.length} ${crew.length === 1 ? "person" : "people"}` : "", beasts.length ? beasts.map((d) => d.name).join(" + ") : ""].filter(Boolean).join(" and ");
  return { ok: true, msg: `${who} set to clearing ${left} plant${left === 1 ? "" : "s"} down to grass.` };
}

/** A clearer's turn (from think): on to the nearest plant left in the box. True = busy with it. */
export function clearThink(w: World, h: Human): boolean {
  const job = w.clearJobs.find((j) => j.id === h.clearJob);
  if (!job || h.taskId || h.order) {
    h.clearJob = undefined;
    tries.delete(h);
    return false;
  }
  if (h.state === "clear") return true;
  // still walking to the same plant: give it a while, then call it out of reach
  const tr = tries.get(h);
  if (tr && tr.id === h.targetId && w.plants.some((p) => p.id === tr.id) && w.elapsed - tr.since > REACH_FOR) {
    if (!job.skip.includes(tr.id)) job.skip.push(tr.id);
    tries.delete(h);
  }
  const skip = new Set(job.skip);
  const keep = kept(w);
  // the plants the rest of the crew are on
  const taken = new Set<number>();
  for (const o of w.humans) if (o !== h && o.clearJob === job.id && (o.state === "clear" || o.state === "walk")) taken.add(o.targetId);
  // nearest plant nobody else is on
  let best: Plant | null = null;
  let spot: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const p of w.plants) {
    if (!inRect(job, p.x, p.y) || skip.has(p.id) || taken.has(p.id)) continue;
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d >= bd || keep?.(p)) continue;
    const s = standSpot(w, h, p);
    // nowhere to stand beside it (in the water, on a cliff): out of reach
    if (!s) {
      job.skip.push(p.id);
      skip.add(p.id);
      continue;
    }
    bd = d;
    best = p;
    spot = s;
  }
  if (!best || !spot) return true; // the others are on the last few: wait (the job tick finishes it + releases everyone)
  if (h.targetId !== best.id || !tries.has(h)) tries.set(h, { id: best.id, since: w.elapsed });
  h.targetId = best.id;
  if (Math.hypot(h.x - spot.x, h.y - spot.y) < 12) {
    go(h, "clear", h.x, h.y);
    h.dir = best.x > h.x ? 1 : -1;
  } else go(h, "walk", spot.x, spot.y);
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
  const time = tree ? 0.6 + p.size * 1.2 : 0.45;
  if (h.stateT < time) return;
  // down it comes, and the ferns + bushes round its foot are pulled up with it: what they give goes to
  // the stores (timber, sticks, leaves, berries); the ground underneath turns to grass
  const job = w.clearJobs.find((j) => j.id === h.clearJob);
  const keep = kept(w);
  const skip = job?.skip.length ? new Set(job.skip) : null;
  const down = [p];
  if (job) for (const o of w.plants) {
    if (o === p || TREES.has(o.kind) && !o.stump || Math.abs(o.x - p.x) > SWEEP_R || Math.hypot(o.x - p.x, o.y - p.y) > SWEEP_R) continue;
    if (inRect(job, o.x, o.y) && !skip?.has(o.id) && !keep?.(o)) down.push(o);
  }
  const gone = new Set(down);
  for (let i = w.plants.length - 1; i >= 0; i--) if (gone.has(w.plants[i])) w.plants.splice(i, 1);
  w.plantsDirty = true;
  tries.delete(h);
  const got: Partial<Record<Resource, number>> = {};
  const add = (r: Resource, n: number) => {
    if (n > 0) got[r] = (got[r] ?? 0) + n;
  };
  const built = builtTiles(w);
  for (const o of down) {
    if (TREES.has(o.kind) && !o.stump) {
      add("wood", 1 + Math.round(o.size * 2));
      add("stick", 1);
    } else {
      add("leaves", 1);
      add("stick", w.rng() < 0.4 ? 1 : 0);
    }
    if (o.kind === "bush" || o.kind === "fruit") add("berries", Math.max(0, Math.floor(o.fruit ?? 0)));
    toGrass(w, Math.floor(o.x / TILE), Math.floor(o.y / TILE), built);
  }
  for (const [r, n] of Object.entries(got) as [Resource, number][]) w.camp.stock[r] += n;
  w.particles.burst(P.Leaf, p.x, p.y - 10, tree ? 10 : 5 + down.length, 60, { z: 14, size: 3, max: 0.9, color: "#6b9a3f" });
  if (tree) w.sfx("timber", p.x, p.y, 0.6);
  if (w.rng() < 0.15) say(h, pick(w.rng, ["Timber!", "One more down!", "Clearing it!", "Room to build!"]));
  go(h, "idle", h.x, h.y);
  h.think = 0;
}

/** Once a second: dinos keep trampling inside the box; a crew that's gone gets replaced; an empty box is finished. */
export function clearJobsTick(w: World) {
  for (const job of [...w.clearJobs]) {
    const left = plantsLeft(w, job);
    if (!left.length) {
      finishJob(w, job);
      continue;
    }
    const dinos = job.dinos.map((id) => w.dinoById(id)).filter((d): d is Dino => !!d && canClear(d) && sameRect(d.work?.clearRect, job));
    job.dinos = dinos.map((d) => d.id);
    for (const d of dinos) {
      if (d.work?.job === "clear") continue;
      // its last patch is done: on to the nearest plant still standing in the box
      const p = left.sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
      commandClear(w, d, p.x, p.y);
    }
    // whoever's still on it (people get pulled off onto other jobs, hurt, or sent down the mine)
    job.people = job.people.filter((id) => w.humans.some((h) => h.id === id && h.clearJob === job.id));
    if (job.people.length || job.dinos.length) {
      job.idle = 0;
      // a big job takes on spare hands as they come free (gatherers, anyone idle), so it goes quicker
      const want = crewFor(left.length) - job.people.length;
      if (want > 0) enlist(w, job, freeHands(w, job, Math.min(2, want), true));
      continue;
    }
    // nobody: free hands take it over, so it isn't left half done
    const hands = freeHands(w, job, Math.min(4, 1 + Math.ceil(left.length / 12)));
    if (hands.length) {
      enlist(w, job, hands);
      job.idle = 0;
      continue;
    }
    job.idle += 1;
    if (job.idle > ABANDON_AFTER) {
      w.clearJobs.splice(w.clearJobs.indexOf(job), 1);
      w.toast("🪓", `Nobody was free to finish clearing (${left.length} plant${left.length === 1 ? "" : "s"} left). Mark it again with 🪓 Clear area when hands are free.`, (job.x0 + job.x1) / 2, (job.y0 + job.y1) / 2);
    }
  }
}

function finishJob(w: World, job: ClearJob) {
  w.clearJobs.splice(w.clearJobs.indexOf(job), 1);
  groundToGrass(w, job);
  w.keepClear.push({ x0: job.x0, y0: job.y0, x1: job.x1, y1: job.y1 });
  for (const h of w.humans) if (h.clearJob === job.id) {
    h.clearJob = undefined;
    tries.delete(h);
    if (h.state === "clear") go(h, "idle", h.x, h.y);
    h.think = 0;
  }
  // every dino that was limited to this box is free again (matched by the box, so a reload can't strand one)
  for (const d of w.dinos) if (d.work && sameRect(d.work.clearRect, job)) d.work.clearRect = undefined;
  const out = job.skip.filter((id) => w.plants.some((p) => p.id === id)).length;
  w.sfx("cheer", (job.x0 + job.x1) / 2, (job.y0 + job.y1) / 2, 0.6);
  w.toast("🌱", `Area cleared down to grass: room for the camp to grow. It'll be kept clear.${out ? ` (${out} plant${out === 1 ? "" : "s"} out of reach were left.)` : ""}`, (job.x0 + job.x1) / 2, (job.y0 + job.y1) / 2);
}

/** Drop a box limit from any dino whose Clear area job no longer exists (old saves, cancelled jobs). */
export function releaseStrayClearRects(w: World) {
  for (const d of w.dinos) {
    const r = d.work?.clearRect;
    if (r && !w.clearJobs.some((j) => sameRect(r, j))) d.work!.clearRect = undefined;
  }
}

/** Overgrown ground in a box (jungle floor, forest litter, bog, bare dirt) becomes grass. */
function groundToGrass(w: World, r: ClearRect) {
  const tx0 = Math.max(0, Math.floor(r.x0 / TILE));
  const ty0 = Math.max(0, Math.floor(r.y0 / TILE));
  const tx1 = Math.min(MAP_W - 1, Math.floor(r.x1 / TILE));
  const ty1 = Math.floor(r.y1 / TILE);
  const built = builtTiles(w);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) toGrass(w, tx, ty, built);
}

/** Save form: the box + its progress (the crew re-forms itself on load). */
export function serializeClearJobs(w: World) {
  const r = Math.round;
  return w.clearJobs.map((j) => ({ id: j.id, x0: r(j.x0), y0: r(j.y0), x1: r(j.x1), y1: r(j.y1), total: j.total, skip: [...j.skip], dinos: [...j.dinos] }));
}

export function loadClearJobs(w: World, d: ReturnType<typeof serializeClearJobs> | undefined) {
  w.clearJobs = (d ?? []).map((j) => ({ ...j, people: [], skip: [...(j.skip ?? [])], dinos: [...(j.dinos ?? [])], total: j.total ?? 0, idle: 0 }));
  // saved dino boxes keep their exact numbers only after rounding: match them to the (rounded) jobs
  for (const dn of w.dinos) {
    const r = dn.work?.clearRect;
    if (!r) continue;
    const job = w.clearJobs.find((j) => j.dinos.includes(dn.id));
    if (job) dn.work!.clearRect = { x0: job.x0, y0: job.y0, x1: job.x1, y1: job.y1 };
  }
  releaseStrayClearRects(w);
}
