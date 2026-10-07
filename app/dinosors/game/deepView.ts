/* ------------------------------------------------------------------ */
/*  The Deep view: camera, input and HUD data for the underground.     */
/*  Owns nothing in the simulation — it reads world.mine and calls its */
/*  actions (scanner ping, lift). The surface keeps running meanwhile. */
/* ------------------------------------------------------------------ */
import { BANDS, FLOODED, LIFT_X, M, MATERIALS, MINE_H, MINE_W, bandAt, liftUpgradeCost, type Content } from "../data/mine";
import { RES_INFO, type Cost } from "../data/colony";
import { idx, toolsOf, type Mine } from "../sim/mine";
import type { Resource } from "../sim/types";
import type { World } from "../sim/world";
import { CELL, MineRenderer, SKY_ROWS, contentLook, type CrewLook, type DeepCam } from "../render/mineRenderer";
import { CARRY, canSend, load, setOrder, type OrderKind } from "../sim/miners";
import { DEEP_DEFS, DEEP_ORDER, LANDMARKS, LANDMARK_ORDER, MILESTONES, type DeepKind } from "../data/mine";
import { canPlaceDeep, deepRoom, finished, placeDeep } from "../sim/deepBuild";

export interface DeepCell {
  x: number;
  y: number;
  depthFt: number;
  band: string;
  material: string;
  state: "uncharted" | "open" | "rock" | "shaft";
  /** contents, once known */
  content: { icon: string; name: string; hazard: boolean } | null;
  /** seconds for one miner with today's tools (null = can't) */
  digTime: number | null;
  why: string | null;
  order: string | null;
  building: { id: number; kind: string; name: string; icon: string; tip: string; built: number; have: boolean; grow: number } | null;
  water: number;
  gas: boolean;
  heat: number;
  support: boolean;
}

export interface DeepInfo {
  liftMax: number;
  liftFt: number;
  liftMaxFt: number;
  canUpgrade: boolean;
  upgradeCost: Cost;
  deepestFt: number;
  camFt: number;
  band: string;
  bands: { name: string; from: number }[];
  dug: number;
  mined: { r: string; icon: string; name: string; n: number }[];
  stock: { r: string; icon: string; name: string; n: number }[];
  hazards: { flooded: number; springs: number; gas: number; caveIns: number; knownTraps: number };
  tools: { id: string; icon: string; name: string; on: boolean }[];
  charted: number;
  pingReady: number;
  sel: DeepCell | null;
  crew: { id: number; name: string; hp: number; activity: string; icon: string; load: number; cap: number; carry: string }[];
  pending: number;
  canSend: number;
  orders: Record<string, number>;
  mode: string;
  autoMine: boolean;
  recall: boolean;
  food: number;
  hauled: { r: string; icon: string; n: number }[];
  milestones: { id: string; name: string; icon: string; ft: number; got: boolean }[];
  landmarks: { kind: string; name: string; icon: string; found: boolean; progress: number; done: boolean }[];
  critters: number;
  buildKind: string;
  palette: { kind: string; name: string; icon: string; tip: string; cost: Cost; w: number; h: number; afford: boolean }[];
  settlement: { kind: string; icon: string; name: string; built: number; planned: number }[];
  room: number;
}

const NAMES: Record<string, string> = { spring: "Underground spring", caveIn: "Weak roof (cave-in!)", gas: "Gas pocket", fossil: "Fossil" };
const MINERALS: Resource[] = ["stone", "clay", "flint", "copper", "iron", "silver", "gold", "salt", "quartz", "magnetite", "crystal", "obsidian", "meteorite", "diamond", "goldBar", "silverBar", "copperBar"];

interface Ptr {
  x: number;
  y: number;
  sx: number;
  sy: number;
  t: number;
  moved: boolean;
}

export class DeepView {
  cam: DeepCam = { x: (MINE_W * CELL) / 2, y: 4 * CELL, zoom: 1 };
  sel: number | null = null;
  hover: number | null = null;
  pings: { x: number; y: number; t: number }[] = [];
  renderer: MineRenderer;
  private ptrs = new Map<number, Ptr>();
  private pinch: { d: number; zoom: number } | null = null;
  private vel = { x: 0, y: 0 };
  private glide: { y: number; zoom: number } | null = null;
  private keys = new Set<string>();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new MineRenderer(canvas);
  }

  resize(w: number, h: number, dpr: number) {
    this.renderer.resize(w, h, dpr);
    this.clamp();
  }

  /** Arriving from the surface: start above the barrier and glide down to the landing. */
  enter(mine: Mine) {
    const { w } = this.renderer.size;
    this.cam = { x: Math.max(LIFT_X * CELL + 4 * CELL, Math.min(MINE_W * CELL - 4 * CELL, w / 2 - 40)), y: -SKY_ROWS * CELL, zoom: 1.1 };
    this.glide = { y: Math.min(mine.liftY, 6) * CELL + 4 * CELL, zoom: 1 };
    this.sel = null;
    this.vel.x = this.vel.y = 0;
  }

  /* ------------------------------ camera ------------------------------ */

  private clamp() {
    const { w, h } = this.renderer.size;
    const minZ = Math.max(0.3, Math.min(1, w / (MINE_W * CELL + 260)));
    this.cam.zoom = Math.max(minZ, Math.min(2.6, this.cam.zoom));
    const hw = w / 2 / this.cam.zoom;
    const hh = h / 2 / this.cam.zoom;
    const W = MINE_W * CELL;
    const left = -140;
    const right = W + 220;
    this.cam.x = right - left < hw * 2 ? (left + right) / 2 : Math.max(left + hw, Math.min(right - hw, this.cam.x));
    this.cam.y = Math.max(-SKY_ROWS * CELL + hh * 0.4, Math.min(MINE_H * CELL + 40 - hh, this.cam.y));
  }

  /** Jump the view to a depth (rows), e.g. from the depth gauge or the minimap. */
  focus(x: number | null, row: number) {
    this.glide = null;
    if (x !== null) this.cam.x = x * CELL + CELL / 2;
    this.cam.y = row * CELL + CELL / 2;
    this.vel.x = this.vel.y = 0;
    this.clamp();
  }

  zoomBy(f: number, sx?: number, sy?: number) {
    const { w, h } = this.renderer.size;
    const px = sx ?? w / 2;
    const py = sy ?? h / 2;
    const before = this.renderer.toWorld(this.cam, px, py);
    this.cam.zoom *= f;
    this.clamp();
    const after = this.renderer.toWorld(this.cam, px, py);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.glide = null;
    this.clamp();
  }

  update(dt: number) {
    if (this.glide) {
      const k = Math.min(1, dt * 2.4);
      this.cam.y += (this.glide.y - this.cam.y) * k;
      this.cam.zoom += (this.glide.zoom - this.cam.zoom) * k;
      if (Math.abs(this.glide.y - this.cam.y) < 1) this.glide = null;
    } else if (!this.ptrs.size && (Math.abs(this.vel.x) > 1 || Math.abs(this.vel.y) > 1)) {
      this.cam.x -= (this.vel.x * dt) / this.cam.zoom;
      this.cam.y -= (this.vel.y * dt) / this.cam.zoom;
      const f = Math.pow(0.04, dt);
      this.vel.x *= f;
      this.vel.y *= f;
    }
    if (this.keys.size) {
      const s = (700 * dt) / this.cam.zoom;
      if (this.keys.has("arrowleft") || this.keys.has("a")) this.cam.x -= s;
      if (this.keys.has("arrowright") || this.keys.has("d")) this.cam.x += s;
      if (this.keys.has("arrowup") || this.keys.has("w")) this.cam.y -= s;
      if (this.keys.has("arrowdown") || this.keys.has("s")) this.cam.y += s;
    }
    for (const p of this.pings) p.t += dt;
    this.pings = this.pings.filter((p) => p.t < 1.6);
    this.clamp();
  }

  render(world: World, dt: number, fade: number) {
    this.renderer.render(world.mine, this.cam, { stock: world.camp.stock as unknown as Record<string, number>, ghost: this.ghost(world), crew: this.crewLooks(world), mode: this.mode, sel: this.sel, hover: this.hover, pings: this.pings, daylight: world.daylight, fade }, dt);
  }

  private crewLooks(world: World): CrewLook[] {
    const mine = world.mine;
    const tools = toolsOf(world);
    const out: CrewLook[] = [];
    for (const m of mine.crew) {
      const h = world.humans.find((x) => x.id === m.id);
      if (!h) continue;
      const job = m.job;
      let progress = 0;
      if (job && (m.mode === "dig") && (job.kind === "dig" || job.kind === "ore")) progress = Math.min(1, m.t / Math.max(0.1, mine.digTime(job.cell % MINE_W, Math.floor(job.cell / MINE_W), tools)));
      else if (job && m.mode === "build") progress = Math.min(1, m.t / 2.5);
      else if (job && m.mode === "plant") progress = Math.min(1, m.t / 1.5);
      out.push({ id: m.id, x: m.x, y: m.y, face: m.face, mode: m.mode, anim: m.anim, load: load(m), skin: h.skin, hair: h.hair, fur: h.fur, hp: h.hp, bubble: m.bubble?.text ?? null, progress, jobCell: job && progress > 0 ? job.cell : null });
    }
    return out;
  }

  /* ------------------------------ orders (painting) ------------------------------ */

  /** look = tap to inspect; build = place a room; the others paint orders onto cells */
  mode: "look" | OrderKind | "clear" | "build" = "look";
  buildKind: DeepKind = "home";

  /** Top-left cell for a building under the pointer (centred on it). */
  private anchor(cell: { x: number; y: number }) {
    const d = DEEP_DEFS[this.buildKind];
    return { x: cell.x - Math.floor((d.w - 1) / 2), y: cell.y - (d.h - 1) };
  }

  private ghost(world: World) {
    if (this.mode !== "build" || this.hover === null) return null;
    const a = this.anchor({ x: this.hover % MINE_W, y: Math.floor(this.hover / MINE_W) });
    return { kind: this.buildKind, ...a, ok: !canPlaceDeep(world.mine, this.buildKind, a.x, a.y) };
  }
  private painted = new Set<number>();
  /** set by the engine: the live world (it can be swapped by loading) */
  world: () => World | null = () => null;

  private paint(sx: number, sy: number, tap: boolean) {
    const w = this.world();
    if (!w || this.mode === "look") return;
    const c = this.renderer.cellAt(this.cam, sx, sy);
    if (!c) return;
    if (this.mode === "build") {
      if (!tap) return;
      const a = this.anchor(c);
      const r = placeDeep(w, this.buildKind, a.x, a.y);
      if (typeof r === "string") this.lastWhy = r;
      else {
        this.lastWhy = `${DEEP_DEFS[this.buildKind].icon} ${DEEP_DEFS[this.buildKind].name} planned — a miner will fetch the supplies and build it.`;
        this.mode = "look";
        this.sel = idx(a.x, a.y);
      }
      return;
    }
    const i = idx(c.x, c.y);
    if (this.painted.has(i)) return;
    this.painted.add(i);
    const have = w.mine.orders.get(i);
    if (this.mode === "clear" || (tap && have === this.mode)) setOrder(w, c.x, c.y, null);
    else {
      const why = setOrder(w, c.x, c.y, this.mode);
      if (why && tap) this.lastWhy = why;
    }
  }
  lastWhy: string | null = null;

  /* ------------------------------ input ------------------------------ */

  down(id: number, sx: number, sy: number) {
    this.ptrs.set(id, { x: sx, y: sy, sx, sy, t: performance.now(), moved: false });
    this.painted.clear();
    this.vel.x = this.vel.y = 0;
    this.glide = null;
    if (this.ptrs.size === 2) {
      const [a, b] = Array.from(this.ptrs.values());
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.zoom };
    }
  }

  move(id: number, sx: number, sy: number, mouse: boolean) {
    if (mouse) {
      const c = this.renderer.cellAt(this.cam, sx, sy);
      this.hover = c ? idx(c.x, c.y) : null;
    }
    const p = this.ptrs.get(id);
    if (!p) return;
    const dx = sx - p.x;
    const dy = sy - p.y;
    p.x = sx;
    p.y = sy;
    if (Math.hypot(sx - p.sx, sy - p.sy) > 7) p.moved = true;
    if (this.pinch && this.ptrs.size >= 2) {
      const [a, b] = Array.from(this.ptrs.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const want = this.pinch.zoom * (d / Math.max(1, this.pinch.d));
      this.zoomBy(want / this.cam.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (!p.moved) return;
    // order modes: one finger paints, two fingers (or the arrow keys) still move the view
    if (this.mode !== "look" && this.mode !== "build" && this.ptrs.size === 1) {
      // the cell the drag started on counts too
      this.paint(p.sx, p.sy, false);
      this.paint(sx, sy, false);
      return;
    }
    this.cam.x -= dx / this.cam.zoom;
    this.cam.y -= dy / this.cam.zoom;
    this.vel.x = dx * 30 + this.vel.x * 0.5;
    this.vel.y = dy * 30 + this.vel.y * 0.5;
    this.clamp();
  }

  /** Returns true when it was a tap (the caller then re-reads the snapshot). */
  up(id: number, cancel: boolean): boolean {
    const p = this.ptrs.get(id);
    this.ptrs.delete(id);
    if (this.ptrs.size < 2) this.pinch = null;
    if (!p || cancel) return false;
    if (!p.moved && performance.now() - p.t < 600 && this.ptrs.size === 0) {
      if (this.mode !== "look") {
        this.paint(p.sx, p.sy, true);
        return true;
      }
      const c = this.renderer.cellAt(this.cam, p.sx, p.sy);
      this.sel = c ? (this.sel === idx(c.x, c.y) ? null : idx(c.x, c.y)) : null;
      return true;
    }
    return false;
  }

  leave() {
    this.hover = null;
  }

  wheel(deltaY: number, sx: number, sy: number, fine: boolean) {
    this.zoomBy(Math.exp(-deltaY * (fine ? 0.01 : 0.0015)), sx, sy);
  }

  key(k: string, down: boolean) {
    if (!down) {
      this.keys.delete(k);
      return false;
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
      this.keys.add(k);
      this.glide = null;
      return true;
    }
    if (k === "+" || k === "=") this.zoomBy(1.2);
    else if (k === "-" || k === "_") this.zoomBy(1 / 1.2);
    else if (k === "escape") {
      this.sel = null;
      this.mode = "look";
    }
    else return false;
    return true;
  }

  /* ------------------------------ actions ------------------------------ */

  /** Scanner ping at the selected cell (or the middle of the view). */
  ping(mine: Mine): string | null {
    let x: number;
    let y: number;
    if (this.sel !== null) {
      x = this.sel % MINE_W;
      y = Math.floor(this.sel / MINE_W);
    } else {
      const { w, h } = this.renderer.size;
      const c = this.renderer.cellAt(this.cam, w / 2, h / 2);
      if (!c) return "Point the scanner at the rock.";
      x = c.x;
      y = c.y;
    }
    const r = mine.ping(x, y);
    if (typeof r === "string") return r;
    this.pings.push({ x, y, t: 0 });
    const w = this.world();
    if (w) for (const k of mine.lastSignals) w.toast("📡", `Scanner signal: ${LANDMARKS[k].signal}`);
    return null;
  }

  /* ------------------------------ HUD data ------------------------------ */

  info(world: World): DeepInfo {
    const mine = world.mine;
    const tools = toolsOf(world);
    const { h } = this.renderer.size;
    const camRow = Math.max(0, Math.floor(this.cam.y / CELL));
    let flooded = 0;
    let charted = 0;
    let knownTraps = 0;
    for (let i = 0; i < mine.water.length; i++) {
      if (mine.water[i] > FLOODED) flooded++;
      if (mine.seen[i]) charted++;
    }
    mine.known.forEach((c) => {
      if (c === "spring" || c === "caveIn" || c === "gas") knownTraps++;
    });
    const cost = liftUpgradeCost(mine.liftMax);
    const canUpgrade = (Object.entries(cost) as [Resource, number][]).every(([r, n]) => world.camp.stock[r] >= n) && mine.liftMax < MINE_H - 12;
    void h;
    return {
      liftMax: mine.liftMax,
      liftFt: Math.round(mine.liftY * 6),
      liftMaxFt: mine.liftMax * 6,
      canUpgrade,
      upgradeCost: cost,
      deepestFt: mine.stats.deepest * 6,
      camFt: camRow * 6,
      band: bandAt(Math.min(MINE_H - 1, camRow)).name,
      bands: BANDS.map((b) => ({ name: b.name, from: b.from })),
      dug: mine.stats.dug,
      mined: (Object.entries(mine.stats.mined) as [Resource, number][]).filter(([, n]) => n > 0).map(([r, n]) => ({ r, icon: RES_INFO[r]?.icon ?? "❔", name: RES_INFO[r]?.name ?? r, n })),
      stock: MINERALS.map((r) => ({ r, icon: RES_INFO[r].icon, name: RES_INFO[r].name, n: Math.floor(world.camp.stock[r] ?? 0) })),
      hazards: { flooded, springs: mine.springs.size, gas: mine.gas.size, caveIns: mine.stats.caveIns, knownTraps },
      tools: [
        { id: "pick", icon: "⛏️", name: "Stone pick", on: tools.pick },
        { id: "ironPick", icon: "⚒️", name: "Iron pick", on: tools.ironPick },
        { id: "drill", icon: "🔩", name: "Drill", on: tools.drill },
        { id: "lantern", icon: "🏮", name: "Lantern", on: tools.lantern },
        { id: "pump", icon: "🪣", name: "Pump", on: tools.pump },
        { id: "dynamite", icon: "🧨", name: "Dynamite", on: tools.dynamite },
      ],
      charted: Math.round((charted / mine.seen.length) * 100),
      pingReady: Math.ceil(mine.pingT),
      sel: this.sel === null ? null : this.cellInfo(world, this.sel),
      crew: mine.crew.map((m) => {
        const hu = world.humans.find((x) => x.id === m.id);
        const kind = m.job?.kind;
        const [icon, activity] = kind === "dig" ? ["⛏️", "Digging"] : kind === "ore" ? ["💎", "Digging out ore"] : kind === "haul" ? ["🛗", "Hauling to the lift"] : kind === "support" ? ["🪵", "Propping the roof"] : kind === "pump" ? ["💧", "Pumping water"] : kind === "blast" ? ["🧨", "Setting a charge"] : kind === "exit" ? ["⬆️", "Heading up"] : kind === "flee" ? ["🏃", "Running from the blast!"] : ["🧍", mine.orders.size ? "Looking for a way in" : "Waiting for orders"];
        return { id: m.id, name: hu?.name ?? "?", hp: hu?.hp ?? 0, activity, icon, load: load(m), cap: CARRY, carry: (Object.entries(m.carry) as [Resource, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${RES_INFO[r]?.icon ?? r}${n}`).join(" ") };
      }),
      pending: mine.pending.size,
      canSend: world.humans.filter((h) => canSend(h) && !mine.pending.has(h.id)).length,
      orders: Array.from(mine.orders.values()).reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {}),
      mode: this.mode,
      autoMine: mine.autoMine,
      recall: mine.recall,
      food: ["cooked", "meat", "fish", "berries", "crop"].reduce((a, r) => a + Math.floor(world.camp.stock[r as Resource] ?? 0), 0),
      hauled: (Object.entries(mine.hauled) as [Resource, number][]).filter(([, n]) => n > 0).map(([r, n]) => ({ r, icon: RES_INFO[r]?.icon ?? "❔", n })),
      milestones: MILESTONES.map((m) => ({ id: m.id, name: m.name, icon: m.icon, ft: m.row * 6, got: mine.milestones.has(m.id) })),
      landmarks: LANDMARK_ORDER.map((k) => {
        const l = mine.landmarks.find((x) => x.kind === k);
        const found = !!l && l.cells.some((i) => mine.seen[i] === 2 || !MATERIALS[mine.cells[i] as M].solid);
        const progress = mine.landmarkProgress(k);
        return { kind: k, name: LANDMARKS[k].name, icon: LANDMARKS[k].icon, found, progress, done: mine.landmarksDone.has(k) };
      }),
      critters: mine.critters.length,
      buildKind: this.buildKind,
      palette: DEEP_ORDER.map((k) => {
        const d = DEEP_DEFS[k];
        return { kind: k, name: d.name, icon: d.icon, tip: d.tip, cost: d.cost, w: d.w, h: d.h, afford: (Object.entries(d.cost) as [Resource, number][]).every(([r, n]) => world.camp.stock[r] >= n) };
      }),
      settlement: DEEP_ORDER.map((k) => ({ kind: k, icon: DEEP_DEFS[k].icon, name: DEEP_DEFS[k].name, built: mine.builds.filter((b) => b.kind === k && finished(b)).length, planned: mine.builds.filter((b) => b.kind === k && !finished(b)).length })).filter((s) => s.built || s.planned),
      room: deepRoom(mine),
    };
  }

  private cellInfo(world: World, i: number): DeepCell {
    const mine = world.mine;
    const x = i % MINE_W;
    const y = Math.floor(i / MINE_W);
    const m = mine.cells[i] as M;
    const seen = mine.seen[i];
    const tools = toolsOf(world);
    const known: Content = seen === 2 ? mine.known.get(i) ?? null : null;
    const look = contentLook(known);
    const hz = mine.hazardAt(x, y);
    const solid = MATERIALS[m].solid;
    const why = seen && solid ? mine.cantDig(x, y, tools) : null;
    return {
      x,
      y,
      depthFt: y * 6,
      band: bandAt(y).name,
      material: seen ? MATERIALS[m].name : "Uncharted",
      state: m === M.Shaft ? "shaft" : !seen ? "uncharted" : solid ? "rock" : "open",
      content: known && look ? { icon: look.icon, name: NAMES[known] ?? RES_INFO[known as Resource]?.name ?? known, hazard: known === "spring" || known === "caveIn" || known === "gas" } : null,
      digTime: seen && solid && !why ? Math.round(mine.digTime(x, y, tools) * 10) / 10 : null,
      why,
      order: mine.orders.get(i) ?? null,
      building: (() => {
        const b = mine.buildAt.get(i);
        if (!b) return null;
        const d = DEEP_DEFS[b.kind];
        return { id: b.id, kind: b.kind, name: d.name, icon: d.icon, tip: d.tip, built: b.built, have: b.have, grow: b.grow };
      })(),
      water: mine.water[i],
      gas: hz.gas,
      heat: hz.heat,
      support: mine.supports.has(i),
    };
  }

  /* ------------------------------ minimap ------------------------------ */

  /** Paint the whole mine into a small canvas (1 px per cell, scaled by CSS). */
  drawMinimap(world: World, canvas: HTMLCanvasElement) {
    const mine = world.mine;
    if (canvas.width !== MINE_W || canvas.height !== MINE_H) {
      canvas.width = MINE_W;
      canvas.height = MINE_H;
    }
    const g = canvas.getContext("2d");
    if (!g) return;
    const img = g.createImageData(MINE_W, MINE_H);
    const px = img.data;
    for (let i = 0; i < MINE_W * MINE_H; i++) {
      const m = mine.cells[i] as M;
      const seen = mine.seen[i];
      let r = 6;
      let gg = 9;
      let b = 12;
      if (m === M.Magma) [r, gg, b] = [200, 70, 20];
      else if (m === M.Shaft) [r, gg, b] = [90, 220, 255];
      else if (seen) {
        if (m === M.Open) [r, gg, b] = mine.water[i] > 0.3 ? [50, 130, 220] : [34, 30, 26];
        else {
          const c = MATERIALS[m].color;
          const n = parseInt(c.slice(1), 16);
          [r, gg, b] = [(n >> 16) * 0.7, ((n >> 8) & 255) * 0.7, (n & 255) * 0.7];
          if (seen === 2 && mine.known.get(i)) [r, gg, b] = [255, 210, 90];
        }
      }
      px[i * 4] = r;
      px[i * 4 + 1] = gg;
      px[i * 4 + 2] = b;
      px[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // the view box
    const { w, h } = this.renderer.size;
    const a = this.renderer.toWorld(this.cam, 0, 0);
    const c = this.renderer.toWorld(this.cam, w, h);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 1;
    g.strokeRect(a.x / CELL, a.y / CELL, (c.x - a.x) / CELL, (c.y - a.y) / CELL);
    void idx;
  }
}
