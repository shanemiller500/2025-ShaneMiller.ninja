/* ------------------------------------------------------------------ */
/*  Engine: the rAF game loop + camera + input + tools. Owns the       */
/*  World, Renderer and AudioManager and talks to React only through   */
/*  a tiny event emitter and a polled snapshot (never per-frame state). */
/* ------------------------------------------------------------------ */
import { FACTS } from "../data/facts";
import { SPECIES, sp } from "../data/species";
import { AudioManager } from "../audio/audio";
import { pokeDino } from "../sim/behavior";
import { canStand, emote, findSpawnSpot, isBaby, setState, sizeOf } from "../sim/dinos";
import { P } from "../sim/particles";
import { TALL, shakeFruit } from "../sim/plants";
import { LM, isWaterTile } from "../sim/terrain";
import { TILE, WORLD_H, WORLD_W, type Danger, type Dino, type DinoState, type Human, type Role, type SpeciesId, type TechId, type WeatherKind } from "../sim/types";
import { CAMP_LEVELS } from "../data/facts";
import { evolveWorld, speciesStats, traitsOf, type Mutation } from "../sim/genetics";
import { World } from "../sim/world";
import { Renderer, type Camera } from "../render/renderer";
import { loadWorld, saveWorld } from "./save";
import { DEFAULT_TOOL, TOOL_BY_ID, applyTool, toolCursor, type ToolState } from "./tools";

export type UIEvent =
  | { type: "toast"; icon: string; text: string; x?: number; y?: number; fact?: string }
  | { type: "discover"; id: string }
  | { type: "unlock"; species: SpeciesId }
  | { type: "openCamp" }
  | { type: "select" }
  | { type: "saved" };

export interface DinoInfo {
  kind: "dino";
  id: number;
  name: string;
  species: SpeciesId;
  baby: boolean;
  growth: number;
  ageDays: number;
  hunger: number;
  thirst: number;
  health: number;
  energy: number;
  state: DinoState;
  mood: { icon: string; label: string };
  speedKmh: number;
  gen: number;
  traits: { icon: string; name: string }[];
  genes: { size: number; speed: number; tough: number };
}

export interface HumanInfo {
  kind: "human";
  id: number;
  name: string;
  child: boolean;
  activity: string;
  role: Role;
  autoRole: Role;
  ordered: boolean;
}

export interface PersonRow {
  id: number;
  name: string;
  child: boolean;
  role: Role;
  autoRole: Role;
  state: string;
}

export interface Snapshot {
  time: number;
  day: number;
  daylight: number;
  paused: boolean;
  speed: number;
  weather: WeatherKind;
  weatherAuto: boolean;
  selected: DinoInfo | HumanInfo | null;
  followId: number;
  dinos: number;
  humans: number;
  eggs: number;
  volcano: string;
  camp: {
    stock: Record<string, number>;
    learned: TechId[];
    goal: TechId | null;
    crafting: { tech: TechId; prog: number } | null;
    shelters: { stage: number; have: number }[];
  };
  discoveries: string[];
  unlocked: SpeciesId[];
  seen: SpeciesId[];
  fps: number;
  tribe: {
    level: number;
    levelName: string;
    levelIcon: string;
    next: { name: string; icon: string; people: number; huts: number; need?: string; havePeople: number; haveHuts: number; haveTech: boolean } | null;
    capacity: number;
    danger: Danger;
    evolution: number;
    raidsWon: number;
    raid: { phase: "warn" | "attack"; label: string; left: number; x: number; y: number; t: number } | null;
    people: PersonRow[];
    walls: { built: number; planned: number; damaged: number };
    farms: number;
    towers: number;
  };
  orderFor: number;
  rallied: boolean;
  evolution: {
    leaps: number;
    auto: boolean;
    species: { id: SpeciesId; n: number; size: number; speed: number; tough: number; gen: number; mut: Mutation | null }[];
  };
}

const HOME = { x: 66 * TILE, y: 46 * TILE, zoom: 0.75 };
const MIN_ZOOM = 0.22;
const MAX_ZOOM = 2.4;

interface Ptr {
  x: number;
  y: number;
  sx: number;
  sy: number;
  t: number;
  moved: boolean;
  /** dino under the finger at press time (hand tool) */
  grab: Dino | null;
}

export function moodOf(d: Dino): { icon: string; label: string } {
  const s = d.state;
  if (s === "sleep") return { icon: "💤", label: "Sleepy" };
  if (s === "annoyed") return { icon: "😤", label: "Grumpy" };
  if (s === "flee" || d.fear > 0.6) return { icon: "😱", label: "Scared" };
  if (s === "chase" || s === "stalk") return { icon: "🎯", label: "Hunting" };
  if (s === "eat") return { icon: "😋", label: "Munching" };
  if (s === "drink") return { icon: "💧", label: "Drinking" };
  if (s === "play" || s === "splash" || s === "wallow") return { icon: "🤸", label: "Playful" };
  if (s === "defend") return { icon: "🛡️", label: "Protective" };
  if (s === "tussle") return { icon: "💥", label: "Scuffling" };
  if (s === "knocked" || s === "stuck") return { icon: "😵", label: "Dizzy" };
  if (s === "lookUp") return { icon: "😮", label: "Amazed" };
  if (d.health < 0.4) return { icon: "🤒", label: "Unwell" };
  if (d.hunger > 0.7) return { icon: "🍽️", label: "Hungry" };
  if (d.thirst > 0.7) return { icon: "🥵", label: "Thirsty" };
  if (d.energy < 0.25) return { icon: "🥱", label: "Tired" };
  if (s === "investigate") return { icon: "🧐", label: "Curious" };
  if (s === "nest") return { icon: "🥚", label: "Nesting" };
  return { icon: "😊", label: "Happy" };
}

const ACTIVITY: Partial<Record<Human["state"], string>> = {
  idle: "Taking a break",
  walk: "Walking",
  gather: "Gathering",
  carry: "Carrying stuff home",
  fish: "Fishing",
  sitFire: "Warming up by the fire",
  sleep: "Sleeping",
  flee: "Running away!",
  hide: "Hiding in the cave",
  build: "Building a hut",
  craft: "Inventing something",
  celebrate: "Celebrating!",
  talk: "Chatting",
  tossed: "Flying through the air!",
  eat: "Eating",
  lookUp: "Looking at the sky",
  explore: "Exploring",
  hunt: "On the hunt",
  aim: "Taking aim!",
  haul: "Dragging dinner home",
  cook: "Roasting food",
  farm: "Farming",
  guard: "Standing guard",
  repair: "Fixing a wall",
};

export class Engine {
  world: World;
  renderer: Renderer;
  audio = new AudioManager();
  cam: Camera = { ...HOME };
  tool: ToolState = { ...DEFAULT_TOOL };
  selectedId = 0;
  followId = 0;
  /** waiting for the player to tap a target for this person's order */
  orderFor = 0;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private running = false;
  private listeners = new Set<(e: UIEvent) => void>();
  private ptrs = new Map<number, Ptr>();
  private pinch: { d: number; zoom: number; cx: number; cy: number } | null = null;
  private vel = { x: 0, y: 0 };
  private fly: { x: number; y: number; zoom: number; t: number } | null = null;
  private shake = { amt: 0, t: 0 };
  private flash = { a: 0, color: "#fff" };
  private hover: { x: number; y: number } | null = null;
  private carried: Dino | null = null;
  private lastTap = { t: 0, x: 0, y: 0 };
  private bedT = 0;
  private saveT = 0;
  private fpsAcc = { n: 0, t: 0, fps: 60 };
  private holdTimer = 0;
  private volcanoTaps = 0;
  private lastPaint = { x: -1e9, y: -1e9 };
  private keys = new Set<string>();
  private w = 1;
  private h = 1;

  constructor(canvas: HTMLCanvasElement, opts: { fresh?: boolean; seed?: number } = {}) {
    this.canvas = canvas;
    const saved = opts.fresh ? null : loadWorld();
    this.world = saved ?? new World(opts.seed ?? Math.floor(Math.random() * 1e9));
    this.renderer = new Renderer(canvas, this.world);
    this.bind();
  }

  /* ----------------------------- lifecycle ----------------------------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.unbind();
    this.audio.dispose();
    this.listeners.clear();
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.renderer.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
    this.clampCam();
  }

  on(fn: (e: UIEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(e: UIEvent) {
    this.listeners.forEach((fn) => fn(e));
  }

  /* ----------------------------- loop ----------------------------- */

  private frame(dt: number) {
    const w = this.world;
    this.keyboardPan(dt);
    this.updateCamera(dt);
    const v = this.renderer.viewRect(this.cam);
    w.view = v;
    w.camX = this.cam.x;
    w.camY = this.cam.y;

    if (this.carried) {
      // a held dino wiggles where the pointer is
      this.carried.state = "carried";
      this.carried.stateT += dt;
    }
    w.update(dt);
    this.drainEvents();

    this.shake.t = Math.max(0, this.shake.t - dt);
    const sk = this.shake.t > 0 ? this.shake.amt * Math.min(1, this.shake.t * 2) : 0;
    this.flash.a = Math.max(0, this.flash.a - dt * 2.5);
    const cursor = this.hover ? toolCursor(this.tool) : null;
    this.renderer.render(this.cam, {
      selectedId: this.selectedId,
      followId: this.followId,
      hover: cursor && this.hover ? { ...this.hover, ...cursor } : null,
      shakeX: (Math.random() - 0.5) * sk * 2,
      shakeY: (Math.random() - 0.5) * sk * 2,
      flash: this.flash.a,
      flashColor: this.flash.color,
    }, dt);

    // adaptive quality: fewer cosmetic particles if frames get heavy
    const cost = this.renderer.cost;
    w.particles.budget = cost > 22 ? 0.35 : cost > 14 ? 0.65 : 1;

    // ambience + listener
    this.audio.listener = { x: this.cam.x, y: this.cam.y, zoom: this.cam.zoom, span: this.w / 2 / this.cam.zoom };
    this.bedT -= dt;
    if (this.bedT <= 0) {
      this.bedT = 0.25;
      const vd = Math.hypot(w.volcano.x - this.cam.x, w.volcano.y - this.cam.y);
      this.audio.updateBeds({
        rain: w.weather.rain,
        wind: w.weather.wind,
        water: Math.min(1, this.renderer.waterInView * 2),
        fire: this.renderer.fireInView + w.campfires.filter((f) => f.lit && Math.hypot(f.x - this.cam.x, f.y - this.cam.y) < 600).length * 2,
        night: Math.max(0, 0.7 - w.daylight) * (1 - w.weather.rain),
        day: w.daylight,
        volcano: w.volcano.active ? Math.max(0, 1 - vd / 3000) : 0,
      }, 0.25);
    }

    this.saveT += dt;
    if (this.saveT > 60) {
      this.saveT = 0;
      this.save(true);
    }
    this.fpsAcc.n++;
    this.fpsAcc.t += dt;
    if (this.fpsAcc.t > 1) {
      this.fpsAcc.fps = Math.round(this.fpsAcc.n / this.fpsAcc.t);
      this.fpsAcc.n = 0;
      this.fpsAcc.t = 0;
    }
  }

  private drainEvents() {
    const w = this.world;
    for (const e of w.events) {
      switch (e.type) {
        case "sfx":
          this.audio.play(e.sound, e.x, e.y, e.vol, e.pitch);
          break;
        case "shake":
          this.shake.amt = Math.max(this.shake.t > 0 ? this.shake.amt : 0, e.amount);
          this.shake.t = Math.max(this.shake.t, e.time);
          break;
        case "flash":
          this.flash.a = Math.max(this.flash.a, e.amount);
          this.flash.color = e.color;
          break;
        case "toast":
          this.emit(e);
          break;
        case "discover":
          this.audio.play("sticker", 0, 0, 0.7);
          this.emit(e);
          break;
        case "unlock":
          this.emit(e);
          break;
        case "removed":
          if (this.selectedId === e.id) {
            this.selectedId = 0;
            this.emit({ type: "select" });
          }
          if (this.followId === e.id) this.followId = 0;
          if (this.carried?.id === e.id) this.carried = null;
          break;
      }
    }
    w.events.length = 0;
  }

  /* ----------------------------- camera ----------------------------- */

  private updateCamera(dt: number) {
    const cam = this.cam;
    if (this.followId) {
      const d = this.world.dinoById(this.followId);
      if (!d) this.followId = 0;
      else {
        const k = Math.min(1, dt * 3);
        cam.x += (d.x - cam.x) * k;
        cam.y += (d.y - d.z - sizeOf(d) * 0.3 - cam.y) * k;
      }
    } else if (this.fly) {
      const f = this.fly;
      f.t += dt;
      const k = Math.min(1, dt * 3.2);
      cam.x += (f.x - cam.x) * k;
      cam.y += (f.y - cam.y) * k;
      cam.zoom += (f.zoom - cam.zoom) * k;
      if (f.t > 2.5 || (Math.hypot(f.x - cam.x, f.y - cam.y) < 2 && Math.abs(f.zoom - cam.zoom) < 0.01)) this.fly = null;
    } else if (!this.ptrs.size && (Math.abs(this.vel.x) > 1 || Math.abs(this.vel.y) > 1)) {
      // pan inertia
      cam.x -= (this.vel.x * dt) / cam.zoom;
      cam.y -= (this.vel.y * dt) / cam.zoom;
      const f = Math.pow(0.04, dt);
      this.vel.x *= f;
      this.vel.y *= f;
    }
    this.clampCam();
  }

  private clampCam() {
    const cam = this.cam;
    const minZ = Math.max(MIN_ZOOM, Math.min(this.w / WORLD_W, this.h / WORLD_H) * 0.9);
    cam.zoom = Math.max(minZ, Math.min(MAX_ZOOM, cam.zoom));
    const hw = this.w / 2 / cam.zoom;
    const hh = this.h / 2 / cam.zoom;
    const m = 200;
    cam.x = hw * 2 > WORLD_W + m * 2 ? WORLD_W / 2 : Math.max(hw - m, Math.min(WORLD_W - hw + m, cam.x));
    cam.y = hh * 2 > WORLD_H + m * 2 ? WORLD_H / 2 : Math.max(hh - m - 200, Math.min(WORLD_H - hh + m, cam.y));
  }

  flyTo(x: number, y: number, zoom = this.cam.zoom) {
    this.followId = 0;
    this.fly = { x, y, zoom, t: 0 };
    this.vel.x = this.vel.y = 0;
  }

  goHome() {
    this.flyTo(HOME.x, HOME.y, HOME.zoom);
  }

  zoomBy(f: number, sx = this.w / 2, sy = this.h / 2) {
    const before = this.renderer.toWorld(this.cam, sx, sy);
    this.cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.cam.zoom * f));
    this.clampCam();
    const after = this.renderer.toWorld(this.cam, sx, sy);
    if (!this.followId) {
      this.cam.x += before.x - after.x;
      this.cam.y += before.y - after.y;
    }
    this.fly = null;
    this.clampCam();
  }

  follow(id: number) {
    this.followId = id;
    this.fly = null;
  }

  /* ----------------------------- picking ----------------------------- */

  private pickDino(x: number, y: number): Dino | null {
    let best: Dino | null = null;
    let bestY = -Infinity;
    for (const d of this.world.dinos) {
      const L = sizeOf(d);
      const def = sp(d.species);
      const cy = d.y - d.z - L * (def.plan === "sauropod" ? 0.35 : def.move === "fly" && d.z > 4 ? 0 : 0.22);
      const rx = Math.max(20, L * (def.move === "fly" && d.z > 4 ? 0.7 : 0.5));
      const ry = Math.max(20, L * (def.plan === "sauropod" ? 0.5 : 0.32));
      const k = ((x - d.x) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (k < 1 && d.y > bestY) {
        bestY = d.y;
        best = d;
      }
    }
    return best;
  }

  private pickHuman(x: number, y: number): Human | null {
    let best: Human | null = null;
    let bd = 20;
    for (const h of this.world.humans) {
      if (this.renderer.hidden(h)) continue;
      const d = Math.hypot(h.x - x, h.y - h.z - 12 - y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  /* ----------------------------- input ----------------------------- */

  private onDown = (e: PointerEvent) => {
    this.audio.unlock();
    this.canvas.setPointerCapture?.(e.pointerId);
    const { x: sx, y: sy } = this.local(e);
    const wp = this.renderer.toWorld(this.cam, sx, sy);
    const grab = this.tool.id === "hand" && this.ptrs.size === 0 ? this.pickDino(wp.x, wp.y) : null;
    this.ptrs.set(e.pointerId, { x: sx, y: sy, sx, sy, t: performance.now(), moved: false, grab });
    this.vel.x = this.vel.y = 0;
    this.fly = null;
    if (this.ptrs.size === 2) {
      const [a, b] = Array.from(this.ptrs.values());
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      this.cancelHold();
      return;
    }
    if (grab) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = window.setTimeout(() => {
        const p = this.ptrs.get(e.pointerId);
        if (p && !p.moved && p.grab) this.lift(p.grab);
      }, 380);
    }
    // brush tools paint straight away
    if (TOOL_BY_ID[this.tool.id].brush && this.tool.id !== "hand") {
      this.lastPaint = { x: wp.x, y: wp.y };
      if (applyTool(this.world, this.tool, wp.x, wp.y, false)) this.audio.play("click", 0, 0, 0.3);
    }
  };

  private onMove = (e: PointerEvent) => {
    const { x: sx, y: sy } = this.local(e);
    if (e.pointerType === "mouse") this.hover = this.renderer.toWorld(this.cam, sx, sy);
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const dx = sx - p.x;
    const dy = sy - p.y;
    p.x = sx;
    p.y = sy;
    if (Math.hypot(sx - p.sx, sy - p.sy) > 7) p.moved = true;

    if (this.pinch && this.ptrs.size >= 2) {
      const [a, b] = Array.from(this.ptrs.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const before = this.renderer.toWorld(this.cam, cx, cy);
      this.cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinch.zoom * (d / Math.max(1, this.pinch.d))));
      this.clampCam();
      const after = this.renderer.toWorld(this.cam, cx, cy);
      this.cam.x += before.x - after.x - (cx - this.pinch.cx) / this.cam.zoom;
      this.cam.y += before.y - after.y - (cy - this.pinch.cy) / this.cam.zoom;
      this.pinch.cx = cx;
      this.pinch.cy = cy;
      this.followId = 0;
      this.clampCam();
      return;
    }

    const wp = this.renderer.toWorld(this.cam, sx, sy);
    if (this.carried) {
      const d = this.carried;
      d.x = wp.x;
      d.y = wp.y + 30;
      d.z = 30;
      if (Math.abs(dx) > 1) d.dir = dx > 0 ? 1 : -1;
      return;
    }
    if (p.grab && p.moved && performance.now() - p.t < 450 && !this.carried) {
      this.lift(p.grab);
      return;
    }
    if (!p.moved) return;
    this.cancelHold();
    const brush = TOOL_BY_ID[this.tool.id].brush && this.tool.id !== "hand";
    if (brush) {
      // paint along the stroke with spacing
      const spacing = this.tool.id === "plant" ? 36 : 22;
      if (Math.hypot(wp.x - this.lastPaint.x, wp.y - this.lastPaint.y) > spacing / Math.max(0.6, this.cam.zoom)) {
        this.lastPaint = { x: wp.x, y: wp.y };
        applyTool(this.world, this.tool, wp.x, wp.y, true);
      }
      return;
    }
    this.followId = 0;
    this.cam.x -= dx / this.cam.zoom;
    this.cam.y -= dy / this.cam.zoom;
    this.vel.x = dx * 60 * 0.5 + this.vel.x * 0.5;
    this.vel.y = dy * 60 * 0.5 + this.vel.y * 0.5;
    this.clampCam();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    this.cancelHold();
    if (this.ptrs.size < 2) this.pinch = null;
    if (!p) return;
    if (this.carried) {
      this.drop();
      this.vel.x = this.vel.y = 0;
      return;
    }
    if (e.type === "pointercancel") return;
    const brushTool = TOOL_BY_ID[this.tool.id].brush && this.tool.id !== "hand";
    if (!p.moved && !brushTool && performance.now() - p.t < 600 && this.ptrs.size === 0) {
      const wp = this.renderer.toWorld(this.cam, p.sx, p.sy);
      this.tap(wp.x, wp.y, p.sx, p.sy);
    } else if (p.moved && TOOL_BY_ID[this.tool.id].brush && this.tool.id !== "hand") {
      this.vel.x = this.vel.y = 0;
    }
  };

  private onLeave = () => {
    this.hover = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { x, y } = this.local(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    this.zoomBy(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), x, y);
  };

  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.type === "keyup") {
      this.keys.delete(e.key.toLowerCase());
      return;
    }
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
      this.keys.add(k);
      this.followId = 0;
      e.preventDefault();
    } else if (k === "+" || k === "=") this.zoomBy(1.2);
    else if (k === "-" || k === "_") this.zoomBy(1 / 1.2);
    else if (k === "h") this.goHome();
    else if (k === "escape") {
      this.orderFor = 0;
      this.tool = { ...this.tool, id: "hand" };
      this.select(0);
      this.followId = 0;
      this.emit({ type: "select" });
    } else if (k === "f" && this.selectedId) this.follow(this.selectedId);
  };

  private keyboardPan(dt: number) {
    if (!this.keys.size) return;
    const s = (700 * dt) / this.cam.zoom;
    if (this.keys.has("arrowleft") || this.keys.has("a")) this.cam.x -= s;
    if (this.keys.has("arrowright") || this.keys.has("d")) this.cam.x += s;
    if (this.keys.has("arrowup") || this.keys.has("w")) this.cam.y -= s;
    if (this.keys.has("arrowdown") || this.keys.has("s")) this.cam.y += s;
  }

  private local(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onUp);
    c.addEventListener("pointerleave", this.onLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
  }

  private unbind() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onUp);
    c.removeEventListener("pointerleave", this.onLeave);
    c.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    window.clearTimeout(this.holdTimer);
  }

  private cancelHold() {
    window.clearTimeout(this.holdTimer);
  }

  /* ----------------------------- interactions ----------------------------- */

  private lift(d: Dino) {
    const def = sp(d.species);
    const p = Array.from(this.ptrs.values())[0];
    if (p) p.grab = null;
    if (!def.liftable) {
      emote(d, "💪", 1.5);
      this.toastOnce("heavy", "🏋️", `${def.nick} is WAY too heavy to lift!`);
      return;
    }
    this.carried = d;
    setState(d, "carried", d.x, d.y);
    d.z = 30;
    emote(d, isBaby(d) ? "😆" : "😲", 1.5);
    this.world.sfx(def.sound.kind, d.x, d.y, 0.6, def.sound.pitch * 1.3);
    this.selectedId = d.id;
    this.world.meet(d.species);
    this.emit({ type: "select" });
  }

  private drop() {
    const d = this.carried;
    this.carried = null;
    if (!d) return;
    const w = this.world;
    const def = sp(d.species);
    if (def.move === "fly") {
      d.z = 40;
      setState(d, "wander", d.x + (w.rng() - 0.5) * 300, d.y - 150);
      return;
    }
    if (!canStand(w, def, d.x, d.y)) {
      const tile = w.terrain.tileAt(d.x, d.y);
      if (isWaterTile(tile)) {
        w.particles.burst(P.Splash, d.x, d.y, 14, 80, { vz: 100, g: 220, size: 3, max: 0.8 });
        w.sfx("splash", d.x, d.y, 1);
      }
      const spot = findSpawnSpot(w, def, d.x, d.y, 80);
      if (spot) {
        d.x = spot.x;
        d.y = spot.y;
      }
    }
    d.z = 0;
    setState(d, "idle", d.x, d.y);
    d.think = 0.6;
    w.particles.burst(P.Dust, d.x, d.y, 8, 50, { size: 6 + sizeOf(d) / 15, max: 0.8, color: "rgba(190,170,130,0.6)" });
    w.sfx("thud", d.x, d.y, Math.min(1, 0.4 + sizeOf(d) / 150));
    emote(d, w.rng() < 0.5 ? "😵‍💫" : "😄", 1.4);
  }

  private tap(x: number, y: number, sx: number, sy: number) {
    const w = this.world;
    const now = performance.now();
    const dbl = now - this.lastTap.t < 320 && Math.hypot(sx - this.lastTap.x, sy - this.lastTap.y) < 24;
    this.lastTap = { t: now, x: sx, y: sy };

    if (this.orderFor) {
      const h = w.humans.find((o) => o.id === this.orderFor);
      this.orderFor = 0;
      if (h) {
        const d = this.pickDino(x, y);
        if (d) {
          h.order = { kind: "hunt", id: d.id };
          h.bubble = { text: `Get that ${sp(d.species).nick}!`, t: 2.5 };
          w.toast("🎯", `${h.name} is going after the ${sp(d.species).nick}!`);
        } else {
          h.order = { kind: "guard", x, y };
          h.bubble = { text: "I'll stand guard here!", t: 2.5 };
          w.particles.spawn(P.Ring, x, y, { size: 8, max: 0.8, color: "rgba(255,215,90,0.9)" });
        }
        h.think = 0;
        this.audio.play("pop", 0, 0, 0.5);
      }
      this.emit({ type: "select" });
      return;
    }
    if (this.tool.id !== "hand") {
      const ok = applyTool(w, this.tool, x, y, false);
      if (ok) this.audio.play("click", 0, 0, 0.3);
      return;
    }

    const d = this.pickDino(x, y);
    if (d) {
      if (dbl) {
        this.follow(d.id);
        this.emit({ type: "select" });
        return;
      }
      this.select(d.id);
      pokeDino(w, d);
      w.meet(d.species);
      this.emit({ type: "select" });
      return;
    }
    const h = this.pickHuman(x, y);
    if (h) {
      this.select(h.id);
      h.bubble = { text: ["Hi!", "Ooga!", "Hello!", "Me busy!", "Dino?!"][Math.floor(w.rng() * 5)], t: 1.8 };
      w.sfx("babble", h.x, h.y, 0.6);
      this.emit({ type: "select" });
      return;
    }
    if (this.tapProp(x, y)) return;
    // camp
    const camp = w.camp;
    if (Math.hypot(x - camp.pileX, y - camp.pileY) < 70 || Math.hypot(x - camp.craftX, y - camp.craftY) < 50 || Math.hypot(x - camp.caveX, y - camp.caveY) < 55) {
      this.emit({ type: "openCamp" });
      this.audio.play("pop", 0, 0, 0.4);
      return;
    }
    // volcano: grumble on tap, erupt on a second tap
    if (Math.hypot(x - w.volcano.x, (y - w.volcano.y) * 1.4) < 360) {
      if (w.volcano.phase === "idle") {
        this.volcanoTaps++;
        if (this.volcanoTaps >= 2) {
          this.volcanoTaps = 0;
          w.volcano.trigger(w);
        } else {
          w.shake(3, 0.6);
          w.sfx("rumble", w.volcano.x, w.volcano.y, 0.7);
          w.toast("🌋", "The volcano grumbles… (tap again if you dare!)");
        }
      }
      return;
    }
    this.select(0);
    this.emit({ type: "select" });
    // plants shake, fruit falls
    let tree = null as (typeof w.plants)[number] | null;
    w.plantHash.each(x, y + 20, 40, (p) => {
      if (!p.stump && Math.abs(p.x - x) < 24 && y < p.y + 6 && y > p.y - (TALL.has(p.kind) ? 110 : 30) * p.size) {
        tree = p;
        return true;
      }
    });
    if (tree) {
      if (tree.kind === "fruit" && tree.fruit > 0) shakeFruit(w, tree);
      else {
        tree.shake = 1;
        w.sfx("rustle", x, y, 0.6);
        w.particles.burst(P.Leaf, tree.x, tree.y, 4, 30, { z: 40, vz: 10, g: 40, size: 3, max: 1.5, color: "#6f9a3c" });
      }
      return;
    }
    // water ripples + scattering fish
    const t = w.terrain.tileAt(x, y);
    if (isWaterTile(t)) {
      w.particles.spawn(P.Ripple, x, y, { size: 6, max: 1.4 });
      w.particles.spawn(P.Ripple, x, y, { size: 3, max: 1 });
      w.sfx("plop", x, y, 0.5);
      for (const s of w.schools) {
        const dd = Math.hypot(s.x - x, s.y - y);
        if (dd < 150) {
          s.vx += ((s.x - x) / (dd + 1)) * 60;
          s.vy += ((s.y - y) / (dd + 1)) * 60;
        }
      }
      return;
    }
    w.pois.push({ x, y, t: w.elapsed });
  }

  private tapProp(x: number, y: number) {
    const w = this.world;
    for (const p of w.props) {
      const r = p.kind === "painting" ? 50 : p.kind === "fossilDig" ? 34 : 22;
      if (Math.hypot(p.x - x, p.y - 8 - y) > r) continue;
      if (p.kind === "goldEgg" && !p.found) {
        p.found = true;
        const locked = SPECIES.filter((s) => !w.unlocked.has(s.id) && s.move === "walk");
        const pick = (locked.length ? locked : SPECIES.filter((s) => s.move === "walk"))[Math.floor(w.rng() * (locked.length || 1))];
        const egg = w.placeEgg(pick.id, p.x, p.y);
        egg.hatchAt = 2.5;
        w.discover("goldEgg", p.x, p.y);
        w.toast("✨", "You found the golden egg! Something is hatching…", p.x, p.y);
        w.sfx("sticker", p.x, p.y, 0.8);
        // meeting it happens when it hatches next to you
        setTimeout(() => w.meet(pick.id), 3000);
        return true;
      }
      if (p.kind === "fossilDig") {
        if (!p.found) {
          p.found = true;
          const species = SPECIES[Math.floor(w.rng() * SPECIES.length)].id;
          w.addItem("fossil", p.x + 30, p.y + 10, { species });
          w.particles.burst(P.Dust, p.x, p.y, 14, 60, { size: 8, max: 1, color: "rgba(160,120,80,0.6)" });
          w.sfx("chop", p.x, p.y, 0.7);
          w.discover("fossil", p.x, p.y);
          w.toast("🦴", `You dug up a ${sp(species).nick} fossil!`, p.x, p.y, FACTS.fossil);
          // a new dig spot appears after a while
          setTimeout(() => {
            p.found = false;
          }, 90000);
        } else w.toast("⛏️", "Nothing left here… come back later!");
        return true;
      }
      if (p.kind === "painting") {
        p.found = true;
        w.discover("painting", p.x, p.y);
        w.toast("🖐️", "A secret cave with ancient handprints!", p.x, p.y, FACTS.painting);
        return true;
      }
    }
    // tar pit bubbles
    if (Math.hypot(x - LM.tar.x * TILE, y - LM.tar.y * TILE) < 80) {
      w.particles.burst(P.Mud, x, y, 6, 30, { vz: 40, g: 160, size: 3, max: 0.6, color: "#1d1a17" });
      w.sfx("plop", x, y, 0.6);
      this.toastOnce("tar", "🛢️", "Sticky tar! Animals that wander in get stuck.", FACTS.tar);
      return true;
    }
    return false;
  }

  private onceKeys = new Set<string>();
  private toastOnce(key: string, icon: string, text: string, fact?: string) {
    if (this.onceKeys.has(key)) return;
    this.onceKeys.add(key);
    this.emit({ type: "toast", icon, text, fact });
  }

  /* ----------------------------- UI API ----------------------------- */

  select(id: number) {
    this.selectedId = id;
  }

  setTool(t: Partial<ToolState>) {
    const prev = this.tool.id;
    this.tool = { ...this.tool, ...t };
    const w = this.world;
    // weather + volcano + quake act instantly, then hand back the previous tool
    const back = () => {
      this.tool = { ...this.tool, id: prev === "weather" || prev === "disaster" ? "hand" : prev };
    };
    if (this.tool.id === "weather") {
      if (t.weather && t.weather === w.weather.kind && !w.weather.auto) {
        w.weather.auto = true;
        w.toast("🎲", "Weather is back on surprise mode.");
      } else if (t.weather) {
        w.weather.auto = false;
        w.weather.set(w, t.weather);
        this.audio.play("pop", 0, 0, 0.4);
      }
      back();
    } else if (this.tool.id === "disaster" && t.disaster === "raid") {
      if (w.tribe.danger === "calm") w.toast("🕊️", "Raids are off in Calm mode (change it in the menu).");
      else if (!w.tribe.startRaid(w)) w.toast("🥁", "A raid is already on its way!");
      else this.flyTo(w.camp.x, w.camp.y, Math.min(this.cam.zoom, 0.7));
      back();
    } else if (this.tool.id === "disaster" && (t.disaster === "volcano" || t.disaster === "quake")) {
      if (t.disaster === "volcano") {
        if (w.volcano.phase === "idle") {
          this.flyTo(w.volcano.x, w.volcano.y + 200, 0.55);
          w.volcano.trigger(w);
        } else w.toast("🌋", "The volcano is already busy!");
      } else w.startQuake();
      back();
    }
  }

  /* ----------------------------- tribe API ----------------------------- */

  setRole(id: number, role: Role) {
    const h = this.world.humans.find((x) => x.id === id);
    if (!h || h.child) return;
    h.role = role;
    h.order = null;
    h.think = 0;
    h.task = null;
    h.bubble = { text: role === "auto" ? "I'll help wherever!" : `I'm a ${role}!`, t: 2 };
    this.audio.play("pop", 0, 0, 0.4);
  }

  /** Next world tap gives this person an order (dino = hunt, ground = guard there). */
  startOrder(id: number) {
    this.orderFor = id;
    this.tool = { ...this.tool, id: "hand" };
  }

  clearOrder(id: number) {
    const h = this.world.humans.find((x) => x.id === id);
    if (h) {
      h.order = null;
      h.think = 0;
    }
  }

  /** jobs from before a rally, so "Stand down" can put everyone back */
  private rallyRoles: Map<number, Role> | null = null;

  /** Every grown-up grabs a weapon and defends the camp — tap again to stand down. */
  rally() {
    const w = this.world;
    if (this.rallyRoles) {
      for (const h of w.humans) {
        const r = this.rallyRoles.get(h.id);
        if (r) {
          h.role = r;
          h.think = 0;
        }
      }
      this.rallyRoles = null;
      w.toast("🏳️", "Stand down! Everyone goes back to their jobs.");
      return;
    }
    this.rallyRoles = new Map(w.humans.filter((h) => !h.child).map((h) => [h.id, h.role]));
    let n = 0;
    for (const h of w.humans) {
      if (h.child) continue;
      h.role = "guard";
      h.order = null;
      h.think = 0;
      n++;
    }
    w.sfx("drums", w.camp.x, w.camp.y, 0.8);
    w.toast("📣", n ? `RALLY! ${n} cave people grab their weapons!` : "Nobody's old enough to fight yet!");
  }

  allAuto() {
    this.rallyRoles = null;
    for (const h of this.world.humans) {
      h.role = "auto";
      h.order = null;
    }
    this.world.toast("✨", "Everyone's back on Auto — the tribe decides.");
  }

  planWalls(kind: "palisade" | "stone") {
    const w = this.world;
    const tech = kind === "palisade" ? "palisade" : "stonewall";
    if (!w.camp.learned.has(tech)) {
      w.toast("🔒", `Invent ${kind === "palisade" ? "Palisade" : "Stone walls"} first!`);
      return 0;
    }
    let n = w.tribe.planRing(w, kind);
    if (kind === "stone") for (const wl of w.tribe.walls) if (wl.kind === "palisade" && !wl.upgrade) { wl.upgrade = true; n++; }
    w.toast(kind === "stone" ? "🧱" : "🪵", n ? `Planned ${n} wall pieces around the camp. Builders, go!` : "The wall is already planned!");
    this.flyTo(w.camp.x, w.camp.y + 30, Math.min(this.cam.zoom, 0.6));
    return n;
  }

  /** Jump a million years: every species shifts the way its world pushes it. */
  evolve() {
    this.audio.unlock();
    return evolveWorld(this.world);
  }

  setEvoAuto(on: boolean) {
    this.world.evoAuto = on;
    this.world.toast("🧬", on ? "Auto-evolve is ON — a million years pass every few minutes." : "Auto-evolve is off.");
  }

  setDanger(d: Danger) {
    this.world.tribe.danger = d;
    if (d === "calm" && this.world.tribe.raid) {
      for (const id of this.world.tribe.raid.ids) {
        const r = this.world.dinoById(id);
        if (r) r.raider = false;
      }
      this.world.tribe.raid = null;
    }
  }

  setTime(h: number) {
    this.world.time = ((h % 24) + 24) % 24;
  }
  setSpeed(s: number) {
    this.world.timeSpeed = s;
    this.world.timePaused = s === 0;
  }
  setWeatherAuto(on: boolean) {
    this.world.weather.auto = on;
  }

  setCampGoal(t: TechId) {
    return this.world.camp.setGoal(this.world, t);
  }

  /** Give the camp a little help (a few of each resource). */
  helpCamp() {
    const s = this.world.camp.stock;
    s.stick += 3;
    s.stone += 2;
    s.grass += 2;
    s.leaves += 2;
    if (this.world.camp.learned.has("axe")) s.wood += 1;
    this.world.sfx("pop", this.world.camp.pileX, this.world.camp.pileY, 0.6);
  }

  feedSelected() {
    const d = this.world.dinoById(this.selectedId);
    if (!d) return;
    const def = sp(d.species);
    const kind = def.diet === "herbivore" ? "fruit" : def.diet === "piscivore" ? "fish" : "meat";
    const it = this.world.addItem(kind, d.x + d.dir * sizeOf(d) * 0.5, d.y + 6, { z: 40 });
    if (def.move === "walk") {
      d.targetId = it.id;
      setState(d, "seekFood", it.x, it.y);
    }
    this.world.sfx("plop", it.x, it.y, 0.6);
  }

  removeSelected() {
    const d = this.world.dinoById(this.selectedId);
    if (d) {
      this.world.particles.burst(P.Poof, d.x, d.y, 8, 50, { size: 12, max: 0.7, color: "rgba(255,255,255,0.9)" });
      this.world.removeDino(d);
    }
  }

  renameSelected(name: string) {
    const d = this.world.dinoById(this.selectedId);
    if (d && name.trim()) d.name = name.trim().slice(0, 18);
  }

  save(auto = false) {
    const ok = saveWorld(this.world);
    if (ok && !auto) this.emit({ type: "saved" });
    return ok;
  }

  newWorld(seed = Math.floor(Math.random() * 1e9)) {
    const keep = { discoveries: this.world.discoveries, unlocked: this.world.unlocked, seen: this.world.seen };
    this.world = new World(seed);
    // stickers + unlocked species are the player's, not the world's
    this.world.discoveries = keep.discoveries;
    this.world.unlocked = keep.unlocked;
    this.world.seen = keep.seen;
    this.renderer.setWorld(this.world);
    this.selectedId = 0;
    this.followId = 0;
    this.carried = null;
    this.cam = { ...HOME };
    this.clampCam();
    this.save(true);
    this.emit({ type: "select" });
  }

  resetEverything() {
    this.newWorld();
    this.world.discoveries = new Set();
    this.world.seen = new Set();
    this.world.unlocked = new Set(SPECIES.filter((s) => s.starter).map((s) => s.id));
    this.save(true);
  }

  snapshot(): Snapshot {
    const w = this.world;
    let selected: Snapshot["selected"] = null;
    const c = w.creatureById(this.selectedId) ?? w.dinos.find((d) => d.id === this.selectedId) ?? w.humans.find((h) => h.id === this.selectedId) ?? null;
    if (c && c.kind === "dino") {
      const def = sp(c.species);
      selected = {
        kind: "dino",
        id: c.id,
        name: c.name,
        species: c.species,
        baby: isBaby(c),
        growth: c.growth,
        ageDays: Math.floor(c.age / 60) + (c.growth < 1 ? 0 : 3),
        hunger: c.hunger,
        thirst: c.thirst,
        health: Math.max(0, c.health),
        energy: c.energy,
        state: c.state,
        mood: moodOf(c),
        speedKmh: Math.round((def.run / TILE) * 3.6 * 2 * c.genes.speed),
        gen: c.gen,
        traits: traitsOf(c.genes),
        genes: { size: c.genes.size, speed: c.genes.speed, tough: c.genes.tough },
      };
    } else if (c && c.kind === "human") {
      let activity = ACTIVITY[c.state] ?? "Busy";
      if (c.state === "gather" && c.task) activity = `Gathering ${c.task}`;
      if (c.state === "walk" && c.task) activity = `Off to get ${c.task === "craft" ? "inventing" : c.task === "build" ? "building" : c.task}`;
      if (c.order?.kind === "hunt") {
        const d = w.dinoById(c.order.id);
        activity = d ? `Hunting the ${sp(d.species).nick}!` : activity;
      } else if (c.order?.kind === "guard") activity = "Guarding the spot you picked";
      selected = { kind: "human", id: c.id, name: c.name, child: c.child, activity, role: c.role, autoRole: c.autoRole, ordered: !!c.order };
    }
    const cr = w.camp.crafting;
    return {
      time: w.time,
      day: w.day,
      daylight: w.daylight,
      paused: w.timePaused,
      speed: w.timeSpeed,
      weather: w.weather.kind,
      weatherAuto: w.weather.auto,
      selected,
      followId: this.followId,
      dinos: w.dinos.length,
      humans: w.humans.length,
      eggs: w.eggs.length,
      volcano: w.volcano.phase,
      camp: {
        stock: { ...w.camp.stock },
        learned: Array.from(w.camp.learned),
        goal: w.camp.goal,
        crafting: cr ? { tech: cr.tech, prog: Math.min(1, cr.t / cr.dur) } : null,
        shelters: w.shelters.map((s) => ({ stage: s.stage, have: s.have })),
      },
      discoveries: Array.from(w.discoveries),
      unlocked: Array.from(w.unlocked),
      seen: Array.from(w.seen),
      fps: this.fpsAcc.fps,
      tribe: this.tribeSnapshot(),
      orderFor: this.orderFor,
      rallied: this.rallyRoles !== null,
      evolution: { leaps: w.evoLeaps, auto: w.evoAuto, species: speciesStats(w) },
    };
  }

  private tribeSnapshot(): Snapshot["tribe"] {
    const w = this.world;
    const t = w.tribe;
    const lv = CAMP_LEVELS[t.level];
    const raid = t.raid;
    let left = 0;
    let rx = w.camp.x;
    let ry = w.camp.y;
    if (raid) {
      for (const id of raid.ids) {
        const d = w.dinoById(id);
        if (d && d.raider) {
          left++;
          rx = d.x;
          ry = d.y;
        }
      }
    }
    return {
      level: t.level,
      levelName: lv.name,
      levelIcon: lv.icon,
      next: t.nextLevel(w),
      capacity: t.capacity(w),
      danger: t.danger,
      evolution: t.evolution,
      raidsWon: t.raidsWon,
      raid: raid ? { phase: raid.phase, label: raid.label, left, x: rx, y: ry, t: raid.t } : null,
      people: w.humans.map((h) => ({ id: h.id, name: h.name, child: h.child, role: h.role, autoRole: h.autoRole, state: h.state })),
      walls: {
        built: t.walls.filter((x) => x.built >= 1 && x.hp > 0).length,
        planned: t.walls.length,
        damaged: t.walls.filter((x) => x.built >= 1 && x.hp < (x.kind === "stone" ? 300 : 110)).length,
      },
      farms: t.farms.length,
      towers: t.towers.filter((x) => x.stage >= 3).length,
    };
  }

  /** Where landmarks are, for the places menu. */
  static places() {
    return [
      { id: "camp", icon: "🏕️", label: "Cave camp", x: LM.camp.x, y: LM.camp.y + 2, zoom: 1 },
      { id: "lake", icon: "🏞️", label: "Lake", x: LM.lake.x, y: LM.lake.y, zoom: 0.7 },
      { id: "waterfall", icon: "💦", label: "Waterfall", x: LM.waterfall.x, y: LM.waterfall.y + 2, zoom: 1.1 },
      { id: "volcano", icon: "🌋", label: "Volcano", x: LM.volcano.x, y: LM.volcano.y + 6, zoom: 0.55 },
      { id: "nest", icon: "🥚", label: "Nests", x: LM.nest.x, y: LM.nest.y, zoom: 1 },
      { id: "feeding", icon: "🌿", label: "Feeding grounds", x: LM.feeding.x, y: LM.feeding.y, zoom: 0.8 },
      { id: "swamp", icon: "🐊", label: "Swamp", x: LM.swamp.x, y: LM.swamp.y, zoom: 0.7 },
      { id: "beach", icon: "🏖️", label: "Beach", x: LM.beach.x, y: LM.beach.y + 8, zoom: 0.7 },
      { id: "jungle", icon: "🌴", label: "Jungle", x: LM.jungle.x, y: LM.jungle.y, zoom: 0.7 },
      { id: "forest", icon: "🌲", label: "Dark forest", x: LM.forest.x, y: LM.forest.y, zoom: 0.8 },
      { id: "grass", icon: "🌾", label: "Grasslands", x: LM.grass.x, y: LM.grass.y, zoom: 0.65 },
      { id: "lava", icon: "🪨", label: "Lava fields", x: LM.lavaField.x, y: LM.lavaField.y, zoom: 0.7 },
    ].map((p) => ({ ...p, x: p.x * TILE, y: p.y * TILE }));
  }
}
