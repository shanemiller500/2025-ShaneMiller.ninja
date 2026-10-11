/* ------------------------------------------------------------------ */
/*  Pack dinosaurs in the Deep. Small + medium trained haulers ride    */
/*  the lift down and walk the tall tunnels (two cells of headroom:    */
/*  the shaft, river banks, caverns), never the one-high crawlways.    */
/*  A pack waits near whichever miner is carrying the most; miners     */
/*  hand full sacks to it instead of walking back to the lift, and it  */
/*  carries the big load up. Big dinosaurs stay on the surface and     */
/*  haul from the cave mouth (workDinos.ts). Only the mine's RNG.      */
/* ------------------------------------------------------------------ */
import { LIFT_X, M, MINE_W } from "../data/mine";
import { sp } from "../data/species";
import { setState, sizeOf } from "./dinos";
import { N, idx, inMine, type Mine } from "./mine";
import { load, sendUp } from "./miners";
import type { Dino, Resource } from "./types";
import { canWork, capacity } from "./workDinos";
import type { World } from "./world";

export interface Pack {
  /** the dinosaur's id */
  id: number;
  x: number;
  y: number;
  path: number[];
  pi: number;
  carry: Partial<Record<Resource, number>>;
  mode: "idle" | "walk" | "wait";
  /** heading back up (full, recalled, or nobody left to help) */
  home: boolean;
  thinkT: number;
  face: 1 | -1;
  anim: number;
  /** seconds with no crew down here */
  lonely: number;
}

export const PACK = {
  /** body length a dinosaur can be and still fit the tunnels */
  maxSize: 100,
  /** how many can work down here at once */
  max: 3,
  /** cells per second (the lift is faster) */
  speed: 3,
  shaftSpeed: 7,
  /** waits within this many cells of the miner it's helping */
  reach: 2,
  /** share of its surface carrying load it manages in the tunnels (no cart down here) */
  capShare: 0.45,
  minCap: 15,
  /** goes home after this long with no crew down */
  lonely: 20,
};

const cx = (i: number) => i % MINE_W;
const cy = (i: number) => Math.floor(i / MINE_W);
const cellOf = (p: { x: number; y: number }) => idx(Math.floor(p.x), Math.floor(p.y));

/** How much a pack carries in the mine. */
export function packCap(d: Dino) {
  return Math.max(PACK.minCap, Math.round(capacity(d) * PACK.capShare));
}

/** Small or medium enough, trained to haul, owned and free. */
export function canSendPack(d: Dino) {
  return d.owner && !d.under && canWork(d) && sp(d.species).move === "walk" && sizeOf(d) <= PACK.maxSize;
}

/** A cell a pack can stand in: open, not flooded, with open space overhead (or the shaft, on the lift). */
export function roomy(mine: Mine, x: number, y: number) {
  if (!mine.passable(x, y)) return false;
  if (mine.cells[idx(x, y)] === M.Shaft) return true;
  if (!inMine(x, y - 1)) return false;
  const head = mine.cells[idx(x, y - 1)];
  return head === M.Open || head === M.Shaft;
}

/** Send a trained dinosaur down. Returns why not, or null. */
export function sendPack(w: World, d: Dino): string | null {
  const mine = w.mine;
  if (!canSendPack(d)) return sizeOf(d) > PACK.maxSize ? "Too big for the tunnels — big dinosaurs haul from the cave mouth instead." : "Only trained, harnessed haulers can carry in the mine.";
  if (mine.packs.length >= PACK.max) return `No room for more than ${PACK.max} pack dinosaurs down there.`;
  d.under = true;
  d.rider = 0;
  setState(d, "idle", w.camp.caveX, w.camp.caveY);
  d.x = w.camp.caveX;
  d.y = w.camp.caveY;
  d.vx = d.vy = 0;
  mine.packs.push({ id: d.id, x: LIFT_X + 0.5, y: 1.5, path: [], pi: 0, carry: {}, mode: "idle", home: false, thinkT: 0, face: 1, anim: 0, lonely: 0 });
  mine.version++;
  if (!w.flags.has("firstPack")) {
    w.flags.add("firstPack");
    w.toast("🦕", `${d.name} rode the lift down! Pack dinosaurs follow the busiest miner and take their full sacks up for them.`);
  }
  return null;
}

/** Everyone with a pack dinosaur: come up. */
export function recallPacks(w: World) {
  for (const p of w.mine.packs) {
    p.home = true;
    p.thinkT = 0;
    p.path = [];
  }
}

/** Back on the surface by the cave mouth, unloading on the way. */
function surfacePack(w: World, p: Pack, d: Dino | null) {
  const mine = w.mine;
  mine.packs.splice(mine.packs.indexOf(p), 1);
  sendUp(w, p.carry, Math.floor(p.y));
  p.carry = {};
  mine.version++;
  if (!d) return;
  d.under = false;
  d.x = w.camp.caveX + (mine.rand() - 0.5) * 30;
  d.y = w.camp.caveY + 20;
  setState(d, "idle", d.x, d.y);
}

/** A pack (with room) waiting right beside this cell: miners can hand their sack to it. */
export function packBeside(w: World, cell: number): Pack | null {
  for (const p of w.mine.packs) {
    if (p.home || p.mode === "walk") continue;
    const d = w.dinoById(p.id);
    if (!d || load(p) >= packCap(d)) continue;
    const pc = cellOf(p);
    if (Math.abs(cx(pc) - cx(cell)) <= 1 && Math.abs(cy(pc) - cy(cell)) <= 1) return p;
  }
  return null;
}

/** Take what fits off a miner's back. Returns how much moved. */
export function loadPack(w: World, p: Pack, from: Partial<Record<Resource, number>>) {
  const d = w.dinoById(p.id);
  if (!d) return 0;
  let room = packCap(d) - load(p);
  let n = 0;
  for (const [r, k] of Object.entries(from) as [Resource, number][]) {
    if (room <= 0) break;
    const take = Math.min(room, k ?? 0);
    if (take <= 0) continue;
    p.carry[r] = (p.carry[r] ?? 0) + take;
    from[r] = (k ?? 0) - take;
    room -= take;
    n += take;
  }
  return n;
}

export function updatePacks(w: World, dt: number) {
  const mine = w.mine;
  if (!mine.packs.length) return;
  for (const p of [...mine.packs]) {
    const d = w.dinoById(p.id);
    if (!d || d.health <= 0) {
      surfacePack(w, p, d);
      continue;
    }
    // parked + safe on the surface while it works down here
    d.x = w.camp.caveX;
    d.y = w.camp.caveY;
    p.anim += dt;
    p.lonely = mine.crew.length ? 0 : p.lonely + dt;
    if (mine.recall || p.lonely > PACK.lonely) p.home = true;
    if (p.path.length && p.pi < p.path.length) {
      p.mode = "walk";
      step(w, p, dt);
      continue;
    }
    // on the lift: unload (and go up, if it's heading home)
    if (mine.cells[cellOf(p)] === M.Shaft && (load(p) > 0 || p.home)) {
      sendUp(w, p.carry, Math.floor(p.y));
      p.carry = {};
      if (p.home) {
        surfacePack(w, p, d);
        continue;
      }
    }
    p.thinkT -= dt;
    if (p.thinkT > 0) continue;
    think(w, p, d);
  }
}

function think(w: World, p: Pack, d: Dino) {
  const mine = w.mine;
  p.thinkT = 1.2 + mine.rand() * 0.6;
  const here = cellOf(p);
  if (!roomy(mine, cx(here), cy(here))) {
    // the tunnel changed under it (cave-in, flood): back to the lift
    p.x = LIFT_X + 0.5;
    p.y = 1.5;
    return;
  }
  const full = load(p) >= packCap(d);
  if (full || p.home) {
    const r = search(mine, here, (s) => mine.cells[s] === M.Shaft);
    if (r) go(p, r);
    else p.mode = "wait";
    return;
  }
  // someone's working close by already: stay put (chasing about means nobody can find it)
  const cheb = (a: number, b: number) => Math.max(Math.abs(cx(a) - cx(b)), Math.abs(cy(a) - cy(b)));
  if (mine.crew.some((m) => cheb(here, cellOf(m)) <= PACK.reach + 2)) {
    p.mode = "wait";
    return;
  }
  // otherwise head for the miner carrying the most (they'll want to unload soonest)
  const target = [...mine.crew].sort((a, b) => load(b) - load(a))[0];
  if (!target) {
    p.mode = "wait";
    return;
  }
  const tc = cellOf(target);
  const near = (s: number) => Math.max(Math.abs(cx(s) - cx(tc)), Math.abs(cy(s) - cy(tc))) <= PACK.reach;
  if (near(here)) {
    p.mode = "wait";
    return;
  }
  const r = search(mine, here, near);
  if (r) go(p, r);
  else p.mode = "wait";
}

function go(p: Pack, path: number[]) {
  p.path = path;
  p.pi = 0;
  p.mode = path.length ? "walk" : "wait";
}

function step(w: World, p: Pack, dt: number) {
  const mine = w.mine;
  const to = p.path[p.pi];
  const tx = cx(to) + 0.5;
  const ty = cy(to) + 0.5;
  const shaft = mine.cells[to] === M.Shaft && tx === p.x;
  const sp = shaft ? PACK.shaftSpeed : PACK.speed;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dx) p.face = dx > 0 ? 1 : -1;
  if (dist <= sp * dt) {
    p.x = tx;
    p.y = ty;
    p.pi++;
    if (cx(to) === LIFT_X) mine.callLift(cy(to));
    if (p.pi < p.path.length && !roomy(mine, cx(p.path[p.pi]), cy(p.path[p.pi]))) p.path = [];
    if (p.pi >= p.path.length) {
      p.path = [];
      p.mode = "wait";
      p.thinkT = 0.3;
    }
  } else {
    p.x += (dx / dist) * sp * dt;
    p.y += (dy / dist) * sp * dt;
  }
}

/** Breadth-first through roomy cells to the nearest one that passes `goal`; the path, or null. */
function search(mine: Mine, from: number, goal: (cell: number) => boolean): number[] | null {
  const prev = new Int32Array(N).fill(-1);
  prev[from] = from;
  const q = [from];
  for (let h = 0; h < q.length && h < 4000; h++) {
    const i = q[h];
    if (goal(i)) {
      const path: number[] = [];
      for (let k = i; k !== from; k = prev[k]) path.push(k);
      return path.reverse();
    }
    const x = cx(i);
    const y = cy(i);
    for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (!inMine(a, b)) continue;
      const j = idx(a, b);
      if (prev[j] !== -1 || !roomy(mine, a, b)) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  return null;
}

