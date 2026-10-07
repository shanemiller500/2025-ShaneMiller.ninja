/* ------------------------------------------------------------------ */
/*  The Deep, Phase 3: the mining crew.                                */
/*                                                                    */
/*  People you send down walk to the cave mouth, ride the lift and    */
/*  become miners. They take the player's orders (dig, support, blast, */
/*  pump), dig out ore they've spotted on their own, haul loads to the */
/*  lift (it carries them up to the camp stockpile), eat from camp,   */
/*  and get hurt by heat, gas, floods and cave-ins. Anyone knocked out */
/*  rides the lift up to be patched up on the surface.                */
/*                                                                    */
/*  Their surface body waits at the cave mouth, hidden ("hide") and    */
/*  skipped by the surface brain while `h.under` is set.              */
/* ------------------------------------------------------------------ */
import { DEEP_DEFS, FIND_AMOUNT, FLOODED, LANDMARKS, LIFT_X, M, MATERIALS, MINE_W } from "../data/mine";
import { cellsOf, finished, lit, type DeepBuilding } from "./deepBuild";
import { HELMET_BY_ID } from "../data/colony";
import { landmarkEvent, wakeCavern } from "./deepLife";
import { go, say } from "./humans";
import { knockOut } from "./injury";
import { N, idx, inMine, toolsOf, type Mine } from "./mine";
import type { Human, Resource } from "./types";
import type { World } from "./world";

export type OrderKind = "dig" | "support" | "blast" | "pump";

export type MinerMode = "walk" | "dig" | "build" | "pump" | "plant" | "idle" | "flee" | "eat";

export interface MinerJob {
  kind: OrderKind | "haul" | "ore" | "exit" | "flee" | "rest" | "fetch" | "build" | "heal";
  /** the cell worked on */
  cell: number;
  /** where the miner stands */
  stand: number;
}

export interface Miner {
  /** the person (Human id) */
  id: number;
  /** position in cells (centre of a cell = .5) */
  x: number;
  y: number;
  path: number[];
  pi: number;
  job: MinerJob | null;
  mode: MinerMode;
  /** seconds into the current work */
  t: number;
  carry: Partial<Record<Resource, number>>;
  face: 1 | -1;
  /** seconds until they need a meal */
  eatT: number;
  anim: number;
  thinkT: number;
  bubble: { text: string; t: number } | null;
  /** fighting a cave critter */
  fightT?: number;
}

export interface Charge {
  cell: number;
  t: number;
  by: number;
}

/** How much one miner carries before heading for the lift. */
export const CARRY = 6;
const SPEED = 2.6;
const SHAFT_SPEED = 7;
const FOODS: Resource[] = ["cooked", "meat", "fish", "berries", "crop"];
/** where people step off the lift at the top */
export const LANDING = idx(LIFT_X + 1, 1);

export const load = (m: Miner) => Object.values(m.carry).reduce((a, n) => a + (n ?? 0), 0);
const cx = (i: number) => i % MINE_W;
const cy = (i: number) => Math.floor(i / MINE_W);
const cellOf = (m: Miner) => idx(Math.floor(m.x), Math.floor(m.y));
const NB = (i: number) => {
  const x = cx(i);
  const y = cy(i);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < MINE_W - 1) out.push(i + 1);
  if (y > 0) out.push(i - MINE_W);
  out.push(i + MINE_W);
  return out.filter((j) => j >= 0 && j < N);
};

/* ======================================================================= */
/*  Sending people down + bringing them back                               */
/* ======================================================================= */

/** Can this person go down the mine? */
export function canSend(h: Human) {
  return !h.child && !h.stranger && !h.under && h.state !== "down" && h.hp > 0.35;
}

/** Ask someone to walk to the cave and go down. */
export function sendDown(w: World, h: Human) {
  if (!canSend(h) || w.mine.pending.has(h.id)) return false;
  w.mine.pending.set(h.id, 0);
  h.order = null;
  h.taskId = 0;
  h.riding = 0;
  go(h, "walk", w.camp.caveX, w.camp.caveY + 4);
  say(h, "Down the mine!");
  return true;
}

/** Best people to send: idle grown-ups who aren't on guard duty. */
export function pickMiners(w: World, n: number): Human[] {
  const score = (h: Human) => {
    const r = w.tribe.roleOf(h);
    let s = Math.hypot(h.x - w.camp.caveX, h.y - w.camp.caveY) / 100;
    if (r === "guard" || r === "smith" || r === "researcher") s += 30;
    if (r === "miner" || r === "gatherer" || h.role === "auto") s -= 5;
    if (h.taskId || h.order) s += 15;
    return s;
  };
  return w.humans.filter((h) => canSend(h) && !w.mine.pending.has(h.id)).sort((a, b) => score(a) - score(b)).slice(0, n);
}

function enter(w: World, h: Human) {
  const mine = w.mine;
  mine.pending.delete(h.id);
  h.under = true;
  h.state = "hide";
  h.stateT = 0;
  h.x = w.camp.caveX;
  h.y = w.camp.caveY;
  h.path = null;
  h.carry = null;
  h.carryN = 0;
  h.task = null;
  h.bubble = null;
  mine.crew.push({ id: h.id, x: cx(LANDING) + 0.5, y: cy(LANDING) + 0.5, path: [], pi: 0, job: null, mode: "idle", t: 0, carry: {}, face: 1, eatT: 90 + mine.rand() * 60, anim: mine.rand() * 10, thinkT: 0, bubble: { text: "Lamps on!", t: 2 } });
  mine.version++;
  if (!w.flags.has("firstMiner")) {
    w.flags.add("firstMiner");
    w.toast("⛏️", `${h.name} rode the lift down into the Deep! Mark rock to dig (or let them dig out the ore they spot).`);
  }
}

/** Back on the surface (by the lift, at the cave mouth). */
function surface(w: World, m: Miner, h: Human | undefined) {
  const mine = w.mine;
  mine.crew.splice(mine.crew.indexOf(m), 1);
  deposit(w, m);
  if (!h) return;
  h.under = false;
  h.x = w.camp.caveX + (mine.rand() - 0.5) * 20;
  h.y = w.camp.caveY + 14;
  h.state = "idle";
  h.stateT = 0;
  h.think = 0;
  go(h, "walk", h.x + (mine.rand() - 0.5) * 60, h.y + 40);
}

export function recallAll(w: World) {
  const mine = w.mine;
  mine.pending.clear();
  for (const m of mine.crew) {
    m.job = null;
    m.path = [];
    m.thinkT = 0;
    m.bubble = { text: "Heading up!", t: 2 };
  }
  mine.recall = true;
}

/* ======================================================================= */
/*  Orders                                                                 */
/* ======================================================================= */

/** Mark a cell (returns why not, or null). */
export function setOrder(w: World, x: number, y: number, kind: OrderKind | null): string | null {
  const mine = w.mine;
  if (!inMine(x, y)) return "Out of the mine.";
  const i = idx(x, y);
  if (kind === null) {
    mine.orders.delete(i);
    mine.version++;
    return null;
  }
  const m = mine.cells[i] as M;
  const solid = MATERIALS[m].solid;
  if (mine.buildAt.has(i) && kind !== "pump") return "There's a building here.";
  switch (kind) {
    case "dig":
      if (!solid) return null; // painting over tunnels is fine, nothing to do
      if (m === M.Barrier) return "That's the groundwater barrier — leave it be.";
      if (m === M.Magma) return "Nothing digs through magma.";
      break;
    case "support":
      if (m !== M.Open) return "Supports go in open tunnels.";
      if (mine.supports.has(i)) return "Already supported.";
      break;
    case "blast":
      if (m === M.Barrier || m === M.Magma || m === M.Shaft) return "Not there.";
      break;
    case "pump":
      if (m !== M.Open || mine.water[i] < 0.05) return "No water to pump here.";
      break;
  }
  mine.orders.set(i, kind);
  mine.version++;
  return null;
}

/* ======================================================================= */
/*  Update                                                                 */
/* ======================================================================= */

export function updateCrew(w: World, dt: number) {
  const mine = w.mine;
  // people still walking to the cave mouth
  if (mine.pending.size) {
    for (const [id, t] of Array.from(mine.pending)) {
      const h = w.humans.find((x) => x.id === id);
      if (!h || h.under || h.state === "down" || h.child) {
        mine.pending.delete(id);
        continue;
      }
      const d = Math.hypot(h.x - w.camp.caveX, h.y - w.camp.caveY);
      if (d < 30 || t > 45) enter(w, h);
      else {
        mine.pending.set(id, t + dt);
        h.order = null;
        h.taskId = 0;
        if (h.state !== "walk" || Math.hypot(h.tx - w.camp.caveX, h.ty - w.camp.caveY - 4) > 4) go(h, "walk", w.camp.caveX, w.camp.caveY + 4);
      }
    }
  }
  if (!mine.crew.length && !mine.charges.length) {
    mine.recall = false;
    return;
  }
  const tools = toolsOf(w);
  for (const c of mine.charges) c.t -= dt;
  for (const c of mine.charges.filter((c) => c.t <= 0)) detonate(w, c);
  mine.charges = mine.charges.filter((c) => c.t > 0);
  for (const m of [...mine.crew]) {
    const h = w.humans.find((x) => x.id === m.id);
    if (!h) {
      mine.crew.splice(mine.crew.indexOf(m), 1);
      continue;
    }
    // keep the surface body parked + safe
    h.state = "hide";
    h.x = w.camp.caveX;
    h.y = w.camp.caveY;
    m.anim += dt;
    if (m.bubble) {
      m.bubble.t -= dt;
      if (m.bubble.t <= 0) m.bubble = null;
    }
    hazards(w, m, h, dt);
    if (!mine.crew.includes(m)) continue;
    eat(w, m, h, dt);
    if (!mine.crew.includes(m)) continue;
    // move along the path
    if (m.path.length && m.pi < m.path.length) {
      m.mode = m.job?.kind === "flee" ? "flee" : "walk";
      step(w, m, dt, tools.lantern);
      continue;
    }
    if (m.job && m.job.kind !== "flee" && m.job.kind !== "rest") {
      work(w, m, h, dt);
      continue;
    }
    m.thinkT -= dt;
    if (m.thinkT <= 0) think(w, m, h);
    else if (m.mode !== "idle") m.mode = "idle";
  }
}

function step(w: World, m: Miner, dt: number, lantern: boolean) {
  const mine = w.mine;
  const to = m.path[m.pi];
  const tx = cx(to) + 0.5;
  const ty = cy(to) + 0.5;
  const inShaft = Math.floor(m.x) === LIFT_X || cx(to) === LIFT_X;
  const wet = mine.water[cellOf(m)] > 0.2 ? 0.6 : 1;
  const sp = (inShaft && tx === m.x ? SHAFT_SPEED : SPEED) * wet * (m.job?.kind === "flee" ? 1.5 : 1);
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (dx) m.face = dx > 0 ? 1 : -1;
  if (d <= sp * dt) {
    m.x = tx;
    m.y = ty;
    m.pi++;
    // lamps light up the rock around them as they go
    mine.light(cx(to), cy(to), lantern ? 2 : 1);
    if (cx(to) === LIFT_X) mine.callLift(cy(to));
    // the way is blocked now (cave-in, flood)? think again
    if (m.pi < m.path.length && !mine.passable(cx(m.path[m.pi]), cy(m.path[m.pi]))) {
      m.path = [];
      if (m.job?.kind !== "flee") m.job = null;
      m.thinkT = 0;
    }
    if (m.pi >= m.path.length) {
      m.path = [];
      if (m.job?.kind === "flee") {
        m.job = null;
        m.thinkT = 1;
      }
    }
  } else {
    m.x += (dx / d) * sp * dt;
    m.y += (dy / d) * sp * dt;
  }
}

/** Breadth-first search from a miner; `pick` returns a job for a reachable standing cell. */
function search(mine: Mine, from: number, pick: (stand: number) => MinerJob | null, maxNodes = 4000): { job: MinerJob; path: number[] } | null {
  const prev = new Int32Array(N).fill(-1);
  prev[from] = from;
  const q = [from];
  for (let h = 0; h < q.length && h < maxNodes; h++) {
    const i = q[h];
    const job = pick(i);
    if (job) {
      const path: number[] = [];
      for (let k = i; k !== from; k = prev[k]) path.push(k);
      return { job, path: path.reverse() };
    }
    for (const j of NB(i)) {
      if (prev[j] !== -1 || !mine.passable(cx(j), cy(j))) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  return null;
}

function claimed(w: World, me: Miner, cell: number) {
  return w.mine.crew.some((o) => o !== me && o.job && o.job.cell === cell);
}

function think(w: World, m: Miner, h: Human) {
  const mine = w.mine;
  m.thinkT = 0.6 + mine.rand() * 0.4;
  const here = cellOf(m);
  if (!mine.passable(cx(here), cy(here))) {
    // standing in rubble or water: get out to the nearest open spot
    const out = nearestPassable(mine, here);
    if (out !== null) {
      m.x = cx(out) + 0.5;
      m.y = cy(out) + 0.5;
    }
    return;
  }
  const tools = toolsOf(w);
  const full = load(m) >= CARRY * (w.camp.learned.has("basket") ? 1.5 : 1);
  // going home: everyone up, the hurt, or a full sack on the way out
  const mess = mine.builds.find((b) => b.kind === "mess" && finished(b));
  if (mess && !mine.recall && h.hp < 0.6 && !claimedHeal(w, m, mess)) {
    const cells = new Set(cellsOf(mess));
    const r = search(mine, here, (s) => (cells.has(s) ? { kind: "heal", cell: s, stand: s } : null));
    if (r) return plan(w, m, r, "Need a sit-down.");
  }
  if (mine.recall || h.hp < 0.3) {
    const out = search(mine, here, (s) => (s === LANDING ? { kind: "exit", cell: s, stand: s } : null));
    // walled in by a cave-in: the lift crew hauls them out by rope
    if (!out) return surface(w, m, h);
    return plan(w, m, out, "Up we go!");
  }
  if (full) return plan(w, m, search(mine, here, (s) => (dock(mine, s) ? { kind: "haul", cell: s, stand: s } : null)), "Sack's full!");
  // the player's orders, nearest first
  const order = search(mine, here, (s) => {
    for (const t of [s, ...NB(s)]) {
      const kind = mine.orders.get(t);
      if (!kind || claimed(w, m, t)) continue;
      if (kind === "dig" && t !== s && !mine.cantDig(cx(t), cy(t), tools)) return { kind, cell: t, stand: s };
      if (kind === "support" && t === s && w.camp.stock.wood >= 1 && !mine.buildAt.has(t)) return { kind, cell: t, stand: s };
      if (kind === "blast" && t !== s && tools.dynamite) return { kind, cell: t, stand: s };
      if (kind === "pump" && t !== s && mine.water[t] > 0.05) return { kind, cell: t, stand: s };
    }
    return null;
  });
  if (order) return plan(w, m, order, order.job.kind === "dig" ? "On it!" : undefined);
  const site = buildJob(w, m, here);
  if (site) return plan(w, m, site, site.job.kind === "fetch" ? "Fetching supplies." : "Building!");
  // flooded tunnels get pumped out without being asked
  const flood = search(mine, here, (s) => {
    for (const t of NB(s)) if (mine.cells[t] === M.Open && mine.water[t] > FLOODED && !claimed(w, m, t)) return { kind: "pump", cell: t, stand: s };
    return null;
  }, 2500);
  if (flood) return plan(w, m, flood, "Bail it out!");
  // ore they can see in the walls
  if (mine.autoMine) {
    const ore = search(mine, here, (s) => {
      for (const t of NB(s)) {
        if (mine.seen[t] !== 2 || claimed(w, m, t)) continue;
        const c = mine.known.get(t);
        if (c && (c in FIND_AMOUNT || c === "fossil" || c in LANDMARKS) && !mine.cantDig(cx(t), cy(t), tools)) return { kind: "ore", cell: t, stand: s };
      }
      return null;
    }, 2500);
    if (ore) return plan(w, m, ore, "Ooh, shiny!");
  }
  if (load(m) > 0) return plan(w, m, search(mine, here, (s) => (dock(mine, s) ? { kind: "haul", cell: s, stand: s } : null)));
  // nothing to do: wait near the lift
  m.mode = "idle";
  if (Math.abs(cx(here) - LIFT_X) > 3 && mine.rand() < 0.3) plan(w, m, search(mine, here, (s) => (dock(mine, s) ? { kind: "rest", cell: s, stand: s } : null)));
  else if (mine.rand() < 0.05) m.bubble = { text: "Where to dig?", t: 2 };
}

function plan(w: World, m: Miner, r: { job: MinerJob; path: number[] } | null, line?: string) {
  if (!r) {
    m.mode = "idle";
    return;
  }
  m.job = r.job;
  m.path = r.path;
  m.pi = 0;
  m.t = 0;
  if (line && w.mine.rand() < 0.5) m.bubble = { text: line, t: 1.6 };
  if (!m.path.length && r.job.kind === "rest") m.job = null;
}

/** A cell right beside the lift shaft the lift can reach (or inside a finished vault). */
function dock(mine: Mine, i: number) {
  if (!mine.passable(cx(i), cy(i))) return false;
  const b = mine.buildAt.get(i);
  if (b && b.kind === "vault" && finished(b)) return true;
  return Math.abs(cx(i) - LIFT_X) === 1 && cy(i) <= mine.liftMax;
}

function claimedHeal(w: World, me: Miner, b: DeepBuilding) {
  const cells = new Set(cellsOf(b));
  return w.mine.crew.filter((o) => o !== me && o.job?.kind === "heal" && cells.has(o.job.cell)).length >= cells.size;
}

/** An unbuilt room: fetch its materials from the lift first, then build it. */
function buildJob(w: World, m: Miner, here: number): { job: MinerJob; path: number[] } | null {
  const mine = w.mine;
  const todo = mine.builds.filter((b) => !finished(b) && !mine.crew.some((o) => o !== m && o.job && (o.job.kind === "fetch" || o.job.kind === "build") && mine.buildAt.get(o.job.cell) === b));
  if (!todo.length) return null;
  // one we already have materials for, else one the stockpile can pay for
  const ready = todo.find((b) => b.have);
  if (ready) {
    const cells = new Set(cellsOf(ready));
    return search(mine, here, (s) => (cells.has(s) ? { kind: "build", cell: s, stand: s } : null));
  }
  for (const b of todo) {
    const cost = DEEP_DEFS[b.kind].cost;
    const short = (Object.entries(cost) as [Resource, number][]).find(([r, n]) => w.camp.stock[r] < n);
    if (short) {
      const key = `deepShort-${b.id}`;
      if ((mine.toastAt.get(key) ?? -999) < w.elapsed - 60) {
        mine.toastAt.set(key, w.elapsed);
        w.toast(DEEP_DEFS[b.kind].icon, `The ${DEEP_DEFS[b.kind].name.toLowerCase()} is waiting for ${short[1]} ${short[0]} on the stockpile.`);
      }
      continue;
    }
    const first = cellsOf(b)[0];
    const r = search(mine, here, (s) => (dock(mine, s) ? { kind: "fetch", cell: first, stand: s } : null));
    if (r) return r;
  }
  return null;
}

function nearestPassable(mine: Mine, from: number): number | null {
  const seen = new Set([from]);
  const q = [from];
  for (let h = 0; h < q.length && h < 300; h++) {
    const i = q[h];
    if (mine.passable(cx(i), cy(i))) return i;
    for (const j of NB(i)) if (!seen.has(j)) {
      seen.add(j);
      q.push(j);
    }
  }
  return null;
}

/* ------------------------------ working ------------------------------ */

function work(w: World, m: Miner, h: Human, dt: number) {
  const mine = w.mine;
  const job = m.job!;
  const tools = toolsOf(w);
  m.face = cx(job.cell) > Math.floor(m.x) ? 1 : cx(job.cell) < Math.floor(m.x) ? -1 : m.face;
  m.t += dt;
  switch (job.kind) {
    case "dig":
    case "ore": {
      if (mine.cantDig(cx(job.cell), cy(job.cell), tools)) {
        if (job.kind === "dig" && !MATERIALS[mine.cells[job.cell] as M].solid) mine.orders.delete(job.cell);
        m.job = null;
        return;
      }
      m.mode = "dig";
      if (mine.rand() < dt * 2.5) mine.sfx.push({ s: "knock", cell: job.cell });
      if (m.t < mine.digTime(cx(job.cell), cy(job.cell), tools) * (lit(mine, cx(job.cell), cy(job.cell)) ? 0.8 : 1)) return;
      const r = mine.dig(cx(job.cell), cy(job.cell), tools);
      mine.orders.delete(job.cell);
      m.job = null;
      m.mode = "idle";
      m.thinkT = 0.15;
      if (!r.ok) return;
      if (r.r && r.n) m.carry[r.r] = (m.carry[r.r] ?? 0) + r.n;
      if (r.loot) for (const [res, n] of Object.entries(r.loot) as [Resource, number][]) m.carry[res] = (m.carry[res] ?? 0) + n;
      if (r.landmark) {
        landmarkEvent(w, r.landmark.kind, r.landmark.first, r.landmark.done);
        if (r.landmark.first) m.bubble = { text: "What IS this?!", t: 2.5 };
      }
      if (r.r === "diamond" && !w.flags.has("deepDiamond")) {
        w.flags.add("deepDiamond");
        w.discover("diamond");
        w.toast("💎", `${h.name} found a DIAMOND! Two of them make a diamond drill at the Blacksmith.`);
      }
      if (r.event === "cavern") wakeCavern(w, job.cell);
      if (r.fossil) {
        m.bubble = { text: "A fossil!", t: 2.5 };
        w.toast("🦴", `${h.name} dug a fossil out of the Deep!`);
        w.discover("fossil");
        m.carry.bone = (m.carry.bone ?? 0) + 2;
      } else if (r.r && (r.r === "gold" || r.r === "crystal" || r.r === "meteorite") && !w.flags.has(`deepFind-${r.r}`)) {
        w.flags.add(`deepFind-${r.r}`);
        w.toast(r.r === "gold" ? "🪙" : r.r === "crystal" ? "🔮" : "☄️", `${h.name} struck ${r.r} down in the Deep!`);
      }
      eventToast(w, h, r.event);
      if (r.collapsed?.length) caveIn(w, r.collapsed, job.cell);
      return;
    }
    case "support": {
      m.mode = "build";
      if (m.t < 2.5) return;
      const why = mine.addSupport(w, cx(job.cell), cy(job.cell));
      mine.orders.delete(job.cell);
      m.job = null;
      if (why) m.bubble = { text: why, t: 2 };
      return;
    }
    case "pump": {
      m.mode = "pump";
      mine.pump(cx(job.cell), cy(job.cell), dt * 0.5, tools);
      if (mine.water[job.cell] < 0.03 || (!mine.orders.has(job.cell) && mine.water[job.cell] < FLOODED * 0.5)) {
        mine.orders.delete(job.cell);
        m.job = null;
      }
      return;
    }
    case "blast": {
      m.mode = "plant";
      if (m.t < 1.5) return;
      if (!tools.dynamite) {
        m.job = null;
        m.bubble = { text: "No dynamite!", t: 2 };
        return;
      }
      mine.orders.delete(job.cell);
      mine.charges.push({ cell: job.cell, t: 3.5, by: m.id });
      m.job = null;
      m.bubble = { text: "FIRE IN THE HOLE!", t: 2.5 };
      // everyone near runs for it
      for (const o of mine.crew) if (Math.abs(o.x - cx(job.cell)) < 5 && Math.abs(o.y - cy(job.cell)) < 5) runFrom(w, o, job.cell);
      return;
    }
    case "haul": {
      deposit(w, m);
      m.job = null;
      m.thinkT = 0.3;
      return;
    }
    case "fetch": {
      // take the materials off the lift (out of the camp stockpile)
      const b = mine.buildAt.get(job.cell);
      m.job = null;
      m.thinkT = 0.1;
      if (!b || b.have || finished(b)) return;
      const cost = DEEP_DEFS[b.kind].cost;
      if ((Object.entries(cost) as [Resource, number][]).some(([r, n]) => w.camp.stock[r] < n)) return;
      for (const [r, n] of Object.entries(cost) as [Resource, number][]) w.camp.stock[r] -= n;
      b.have = true;
      mine.callLift(Math.floor(m.y));
      const cells = new Set(cellsOf(b));
      const r = search(mine, cellOf(m), (s) => (cells.has(s) ? { kind: "build", cell: s, stand: s } : null));
      if (r) plan(w, m, r, "Got the supplies!");
      return;
    }
    case "build": {
      const b = mine.buildAt.get(job.cell);
      if (!b || finished(b) || !b.have) {
        m.job = null;
        return;
      }
      m.mode = "build";
      if (mine.rand() < dt * 2) mine.sfx.push({ s: "knock", cell: job.cell });
      b.built = Math.min(1, b.built + dt / DEEP_DEFS[b.kind].work);
      if (b.built >= 1) {
        mine.reindex();
        m.job = null;
        const d = DEEP_DEFS[b.kind];
        if (b.kind === "lamp") mine.light(b.x, b.y, 4);
        w.toast(d.icon, `${d.name} finished down in the Deep!${d.room ? ` Room for ${d.room} more people.` : ""}`);
      }
      return;
    }
    case "heal": {
      m.mode = "idle";
      h.hp = Math.min(1, h.hp + dt * 0.03);
      if (h.hp >= 0.95) {
        m.job = null;
        m.bubble = { text: "Good as new!", t: 1.6 };
      }
      return;
    }
    case "exit": {
      surface(w, m, h);
      return;
    }
  }
}

function runFrom(w: World, m: Miner, cell: number) {
  const mine = w.mine;
  const r = search(mine, cellOf(m), (s) => (Math.max(Math.abs(cx(s) - cx(cell)), Math.abs(cy(s) - cy(cell))) >= 5 ? { kind: "flee", cell: s, stand: s } : null));
  if (r) {
    m.job = r.job;
    m.path = r.path;
    m.pi = 0;
  }
}

function detonate(w: World, c: Charge) {
  const mine = w.mine;
  const x = cx(c.cell);
  const y = cy(c.cell);
  const t = toolsOf(w);
  const r = mine.blast(w, x, y, { ...t, dynamite: true });
  mine.sfx.push({ s: "boom", cell: c.cell });
  mine.blasts.push({ cell: c.cell, t: 0 });
  if (typeof r === "string") return;
  const by = mine.crew.find((m) => m.id === c.by) ?? mine.crew[0];
  if (by) for (const [res, n] of Object.entries(r.loot) as [Resource, number][]) by.carry[res] = (by.carry[res] ?? 0) + n;
  for (const l of r.landmarks) landmarkEvent(w, l.kind, false, l.done);
  if (r.explosion) w.toast("💥", "The gas went up with the dynamite — a huge explosion!");
  // anyone too close takes the blast
  for (const m of [...mine.crew]) {
    const d = Math.max(Math.abs(m.x - 0.5 - x), Math.abs(m.y - 0.5 - y));
    if (d < (r.explosion ? 3.5 : 2.2)) hurt(w, m, r.explosion ? 0.6 : 0.4, "blast");
  }
  if (r.collapsed.length) caveIn(w, r.collapsed, c.cell);
}

/** Rubble fell: anyone under it gets hurt + shoved out, and the rubble gets marked to clear. */
function caveIn(w: World, cells: number[], at: number) {
  const mine = w.mine;
  const set = new Set(cells);
  for (const m of [...mine.crew]) {
    if (!set.has(cellOf(m))) continue;
    hurt(w, m, 0.45, "rock");
    m.path = [];
    m.job = null;
  }
  // every cell that filled with rubble gets marked to clear (the one being dug too, or the tunnel is cut off)
  for (const c of cells) if (mine.cells[c] === M.Rubble) mine.orders.set(c, "dig");
  mine.sfx.push({ s: "rumble", cell: at });
}

function eventToast(w: World, h: Human, e: string | undefined) {
  if (!e) return;
  const key = `deepEv-${e}`;
  const last = w.mine.toastAt.get(key) ?? -999;
  if (w.elapsed - last < 25) return;
  w.mine.toastAt.set(key, w.elapsed);
  if (e === "spring") w.toast("💧", `${h.name} hit an underground spring! Water is pouring in — mark it for pumping.`);
  else if (e === "caveIn") w.toast("⚠️", "Cave-in! The roof came down. Support beams stop that from happening.");
  else if (e === "gas") w.toast("☁️", `${h.name} broke into a gas pocket. Keep dynamite well away until it clears!`);
  else if (e === "cavern") w.toast("🕳️", `${h.name} broke through into a natural cavern!`);
}

/* ------------------------------ health ------------------------------ */

export const hurtMiner = (w: World, m: Miner, dmg: number, why: "rock" | "blast" | "heat" | "gas" | "water" | "hunger" | "bite") => hurt(w, m, dmg, why);

function hurt(w: World, m: Miner, dmg: number, why: "rock" | "blast" | "heat" | "gas" | "water" | "hunger" | "bite") {
  const h = w.humans.find((x) => x.id === m.id);
  if (!h) return;
  const helm = h.gear.helmet ? HELMET_BY_ID[h.gear.helmet] : null;
  if (helm && (why === "rock" || why === "blast" || why === "bite")) dmg *= 1 - helm.armor;
  h.hp = Math.max(0, h.hp - dmg);
  if (dmg > 0.1) m.bubble = { text: why === "heat" ? "Too hot!" : why === "gas" ? "*cough*" : "Ow!", t: 1.6 };
  if (h.hp > 0) return;
  // knocked out: the lift brings them up to be helped
  w.mine.crew.splice(w.mine.crew.indexOf(m), 1);
  deposit(w, m);
  h.under = false;
  h.x = w.camp.caveX;
  h.y = w.camp.caveY + 16;
  knockOut(w, h);
  w.toast("🛗", `${h.name} was hurt in the Deep and rode the lift back up.`);
}

function hazards(w: World, m: Miner, h: Human, dt: number) {
  const mine = w.mine;
  const x = Math.floor(m.x);
  const y = Math.floor(m.y);
  const z = mine.hazardAt(x, y);
  if (z.heat > 0) hurt(w, m, z.heat * dt, "heat");
  if (z.gas) hurt(w, m, 0.02 * dt, "gas");
  if (z.water > 0.85) hurt(w, m, 0.05 * dt, "water");
  void h;
}

function eat(w: World, m: Miner, h: Human, dt: number) {
  m.eatT -= dt;
  if (m.eatT > 0) return;
  const food = FOODS.find((r) => w.camp.stock[r] >= 1);
  if (food) {
    w.camp.stock[food] -= 1;
    m.eatT = 120;
    h.hunger = 0;
    return;
  }
  m.eatT = 10;
  m.bubble = { text: "Hungry…", t: 2 };
  hurt(w, m, 0.02, "hunger");
}

/** Unload at the lift: up it goes to the camp stockpile. */
function deposit(w: World, m: Miner) {
  const mine = w.mine;
  let n = 0;
  for (const [r, k] of Object.entries(m.carry) as [Resource, number][]) {
    if (!k) continue;
    w.camp.stock[r] += k;
    mine.hauled[r] = (mine.hauled[r] ?? 0) + k;
    n += k;
  }
  m.carry = {};
  if (!n) return;
  mine.crates.push({ y: Math.floor(m.y), t: 0 });
  mine.callLift(0);
  if (!w.flags.has("firstOre")) {
    w.flags.add("firstOre");
    w.toast("🛗", "The first load came up the lift! Ore from the Deep goes straight onto the camp stockpile.");
  }
}

export { cellOf };
