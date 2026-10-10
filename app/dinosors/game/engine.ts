/* ------------------------------------------------------------------ */
/*  Engine: the rAF game loop + camera + input + tools. Owns the       */
/*  World, Renderer and AudioManager and talks to React only through   */
/*  a tiny event emitter and a polled snapshot (never per-frame state). */
/* ------------------------------------------------------------------ */
import { FACTS } from "../data/facts";
import { SPECIES, sp } from "../data/species";
import { AudioManager } from "../audio/audio";
import { DeepView, type DeepInfo } from "./deepView";
import { canSend, pickMiners, recallAll, resetMine, sendDown, setOrder, type OrderKind } from "../sim/miners";
import { demolishDeep } from "../sim/deepBuild";
import type { DeepKind } from "../data/mine";
import { CIV_TECH, ENERGY_GEN, PYRAMID_STAGES, SHIELD_HOLD, type CivPath, type CivTechId } from "../data/civ";
import { buildingCost } from "../data/colony";
import { go, say } from "../sim/humans";
import type { ExperimentResult } from "../sim/civ";
import type { ExtPhase, ExtStats } from "../sim/extinction";
import { pokeDino } from "../sim/behavior";
import { canStand, emote, findSpawnSpot, isBaby, setState, sizeOf } from "../sim/dinos";
import { P } from "../sim/particles";
import { TALL, shakeFruit } from "../sim/plants";
import { LM, isWaterTile } from "../sim/terrain";
import { TILE, WORLD_H, WORLD_W, type Brute, type Danger, type Dino, type DinoState, type Dragon, type Human, type Resource, type Role, type SpeciesId, type TechId, type WeaponKind, type WeatherKind } from "../sim/types";
import { CAMP_LEVELS } from "../data/facts";
import { BUILDINGS, FORGE_ITEMS, HOUSING, SCORPION_TIERS, WEAPON_BY_ID, type Cost } from "../data/colony";
import { carcassAt, carcassSummary, inferCommand, issue, dismount, leaveScorpion, type Command } from "../sim/tasks";
import { carcassStage, makeCarcass, STAGE_LABEL } from "../sim/carcass";
import { OUTFIT_BY_ID, type ForgeCat } from "../data/colony";
import { condition, type Condition } from "../sim/injury";
import { shelterDone, stagesOf, wallMaxHp } from "../sim/build";
import { SAVE_VERSION } from "../sim/world";
import { evolveWorld, speciesStats, traitsOf, type Mutation } from "../sim/genetics";
import { World, type SaveData } from "../sim/world";
import { Renderer, type Camera } from "../render/renderer";
import { loadWorld, saveWorld } from "./save";
import { newId, type Slot, type SlotKind } from "./slots";
import { DEFAULT_TOOL, TOOL_BY_ID, applyTool, toolCursor, type ToolState } from "./tools";

export type UIEvent =
  | { type: "toast"; icon: string; text: string; x?: number; y?: number; fact?: string }
  | { type: "discover"; id: string }
  | { type: "unlock"; species: SpeciesId }
  | { type: "openCamp" }
  | { type: "openCiv" }
  | { type: "view" }
  | { type: "confirmEnd"; cause: "asteroid" | "supervolcano" }
  | { type: "select" }
  | { type: "saved" }
  | { type: "inspect" };

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
  hp: number;
  warmth: number;
  condition: Condition;
  weapon: { id: string; name: string; icon: string } | null;
  shield: number;
  home: string;
  task: { icon: string; label: string } | null;
  riding: string | null;
  /** weapon kinds this person could swap to from the armory */
  canEquip: WeaponKind[];
  outfit: { id: string; name: string; icon: string; rain: number; warmth: number } | null;
}

export interface PersonRow {
  id: number;
  name: string;
  child: boolean;
  role: Role;
  autoRole: Role;
  state: string;
  hp: number;
  condition: Condition;
  task: string | null;
  stranger: boolean;
}

/** One picked person in the selection bar. */
export interface SelRow {
  id: number;
  name: string;
  child: boolean;
  hp: number;
  condition: Condition;
  icon: string;
  activity: string;
}

/** What the last world click turned into (+ other things it could have meant). */
export interface CommandInfo {
  icon: string;
  label: string;
  alts: { icon: string; label: string; i: number }[];
  weapons: WeaponKind[];
  weapon: WeaponKind | null;
  at: number;
}

/** Tapped a building: what's inside, what it needs, what you can do. */
export type InspectInfo =
  | { kind: "shelter"; id: number; icon: string; name: string; tier: number; cap: number; built: boolean; progress: string; hp: number; hearth: boolean; warmth: number; residents: { id: number; name: string; child: boolean; inside: boolean; state: string }[]; upgrade: { icon: string; name: string; cost: Cost; have: Cost; started: boolean } | null }
  | { kind: "building"; id: number; icon: string; name: string; tip: string; built: number; hp: number; maxHp: number; cost: Cost; have: Cost; stage?: { n: number; of: number; name: string; next: string | null }; note?: string }
  | { kind: "scorpion"; id: number; name: string; tier: number; built: number; hp: number; maxHp: number; drone: boolean; crew: string | null; mount: string; cost: Cost; have: Cost; next: { name: string; cost: Cost; locked: boolean } | null; upgrading: boolean }
  | { kind: "gate"; id: number; open: boolean; auto: boolean; hp: number; maxHp: number; material: string }
  | { kind: "tower"; id: number; stage: number; hp: number; guards: number }
  | { kind: "carcass"; id: number; name: string; stage: string; left: { r: string; n: number; max: number }[]; working: number; burnt: boolean; fresh: number };

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
  /** Neanderthal clans around the map */
  rivals: {
    clans: { id: number; name: string; color: string; size: number; x: number; y: number; captives: string[]; wars: string[]; pacts: string[] }[];
  };
  tribe: {
    level: number;
    levelName: string;
    levelIcon: string;
    next: { name: string; icon: string; people: number; huts: number; need?: string; havePeople: number; haveHuts: number; haveTech: boolean } | null;
    capacity: number;
    danger: Danger;
    evolution: number;
    raidsWon: number;
    raid: { phase: "warn" | "attack"; label: string; left: number; x: number; y: number; t: number; brutes: boolean } | null;
    people: PersonRow[];
    walls: { built: number; planned: number; damaged: number };
    farms: number;
    towers: number;
  };
  orderFor: number;
  rallied: boolean;
  selection: SelRow[];
  command: CommandInfo | null;
  inspect: InspectInfo | null;
  forge: {
    queue: { id: string; name: string; icon: string; ok: boolean }[];
    armory: { id: string; name: string; icon: string; n: number }[];
    items: { id: string; name: string; icon: string; tier: number; cost: Cost; at: string; can: boolean; why: string | null; cat: ForgeCat; tip?: string; fresh: boolean; done: boolean }[];
    hasTannery: boolean;
    hasWorkshop: boolean;
    hasSmith: boolean;
  };
  colony: { buildings: number; scorpions: number; deposits: number; found: number; homes: number; dragons: number; strangers: number; snow: number; mega: boolean };
  civ: CivInfo;
  /** which world you're looking at: the surface or the Deep */
  view: "surface" | "deep";
  deep: DeepInfo | null;
  /** people down the mine (+ on their way) */
  crew: number;
  extinction: { phase: ExtPhase; cause: "asteroid" | "supervolcano"; countdown: number; stats: ExtStats | null; shelter: boolean; shield: boolean; shieldReady: boolean };
  evolution: {
    leaps: number;
    auto: boolean;
    species: { id: SpeciesId; n: number; size: number; speed: number; tough: number; gen: number; mut: Mutation | null }[];
  };
}

export interface CivInfo {
  path: CivPath;
  /** the chamber has surfaced somewhere */
  chamber: boolean;
  found: boolean;
  pending: boolean;
  ripe: boolean;
  current: { id: CivTechId; rp: number; need: number; paid: boolean; missing: string | null; cost: Cost } | null;
  done: CivTechId[];
  options: { id: CivTechId; cost: Cost; rp: number; cross: boolean }[];
  crossOpen: boolean;
  energy: number;
  cap: number;
  gen: number;
  use: number;
  strain: number;
  condensed: number;
  tuned: string[];
  notes: Record<string, number>;
  canExperiment: boolean;
  jobs: Record<string, number>;
  grid: { kind: string; icon: string; name: string; n: number; gen: number }[];
  monuments: { id: number; icon: string; name: string; built: number; stage: number; stages: number; stageName: string; done: boolean }[];
  megaliths: number;
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

export const ROLE_ICON: Record<string, string> = { gatherer: "🧺", builder: "🔨", hunter: "🏹", guard: "🛡️", cook: "🍖", farmer: "🌾", smith: "⚒️", researcher: "📜", shaper: "🔷", technician: "⚡", miner: "⛏️" };
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
  repair: "Repairing",
  heal: "Patching someone up",
  operate: "Crewing a Scorpion",
  tame: "Making friends with a dino",
  ride: "Riding",
  down: "Knocked out!",
  douse: "Throwing water on the fire",
  rest: "Resting",
  smith: "Forging",
  research: "Researching",
  captive: "Held captive by Neanderthals!",
  resonate: "Working the stone + crystals",
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
  /** selected people (the next world tap tells them what to do) */
  selection: number[] = [];
  /** "add to selection" mode for touch screens */
  addMode = false;
  /** last command + its alternatives (for the "instead…" chip) */
  private lastCmd: { cmd: Command; people: number[]; at: number; weapon: WeaponKind | null } | null = null;
  /** tapped building being looked at */
  inspectRef: { kind: "shelter" | "building" | "scorpion" | "gate" | "tower" | "carcass"; id: number } | null = null;
  /** shift-drag selection box (screen px) */
  private box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private hoverHint: { x: number; y: number; icon: string; label: string } | null = null;
  private hoverItem: { x: number; y: number; radius: number } | null = null;
  private hintT = 0;
  /** where the last order points (a pulsing marker) */
  private marker: { x: number; y: number; t: number; icon: string } | null = null;
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

  /** no local save was found / readable: the newest saved-games slot should be offered */
  startedFresh = false;
  /** looking at the surface or down the mine */
  view: "surface" | "deep" = "surface";
  deep: DeepView;
  private svCam = false;
  /** the fade between the two views */
  private dive: { t: number; to: "surface" | "deep"; switched: boolean } | null = null;

  constructor(canvas: HTMLCanvasElement, opts: { fresh?: boolean; seed?: number } = {}) {
    this.canvas = canvas;
    const saved = opts.fresh ? null : loadWorld();
    this.startedFresh = !saved;
    this.world = saved ?? new World(opts.seed ?? Math.floor(Math.random() * 1e9));
    this.renderer = new Renderer(canvas, this.world);
    this.deep = new DeepView(canvas);
    this.deep.world = () => this.world;
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
    this.deep.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
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
    this.updateHoverHint(dt);
    if (this.marker) {
      this.marker.t += dt;
      if (this.marker.t > 1.6) this.marker = null;
    }
    this.selection = this.selection.filter((id) => w.humans.some((h) => h.id === id));
    // the dive: fade to black, swap views, fade back in
    const DIVE = 0.55;
    let fade = 0;
    if (this.dive) {
      const dv = this.dive;
      dv.t += dt;
      if (dv.t >= DIVE && !dv.switched) {
        dv.switched = true;
        this.view = dv.to;
        if (dv.to === "deep") this.deep.enter(w.mine);
        this.emit({ type: "view" });
      }
      fade = dv.t < DIVE ? dv.t / DIVE : Math.max(0, 1 - (dv.t - DIVE) / DIVE);
      if (dv.t >= DIVE * 2) this.dive = null;
    }
    this.mineSounds();
    // the supervolcano: swing round to watch the mountain go up
    const ex = w.extinction;
    if (ex.cause === "supervolcano" && ex.phase === "impact" && ex.t < 0.1 && !this.svCam) {
      this.svCam = true;
      this.flyTo(ex.x, ex.y - 260, 0.3);
    } else if (ex.phase !== "impact") this.svCam = false;
    if (this.view === "deep") {
      this.deep.update(dt);
      this.deep.render(w, dt, fade);
      this.deepAudio(dt);
      this.tickSave(dt);
      return;
    }
    this.renderer.render(this.cam, {
      selectedId: this.selectedId,
      followId: this.followId,
      selection: this.selection,
      box: this.box,
      hint: this.hoverHint,
      hoverItem: this.hoverItem,
      marker: this.marker,
      inspect: this.inspectRef,
      buildPreview: this.tool.id === "build" && this.hover ? { x: this.hover.x, y: this.hover.y, build: this.tool.build } : null,
      hover: cursor && this.hover ? { ...this.hover, ...cursor } : null,
      shakeX: (Math.random() - 0.5) * sk * 2,
      shakeY: (Math.random() - 0.5) * sk * 2,
      flash: this.flash.a,
      flashColor: this.flash.color,
    }, dt);
    if (fade > 0) this.deep.renderer.fade(fade);

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

    this.tickSave(dt);
  }

  private tickSave(dt: number) {
    this.saveT += dt;
    if (this.saveT > 20) {
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
      const d = this.world.dinoById(this.followId) ?? this.world.humans.find((h) => h.id === this.followId) ?? null;
      if (!d) this.followId = 0;
      else {
        const k = Math.min(1, dt * 3);
        cam.x += (d.x - cam.x) * k;
        cam.y += (d.y - d.z - (d.kind === "dino" ? sizeOf(d) * 0.3 : 14) - cam.y) * k;
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

  private pickBrute(x: number, y: number): Brute | null {
    let best: Brute | null = null;
    let bd = 24;
    for (const b of this.world.rivals.brutes) {
      const d = Math.hypot(b.x - x, b.y - 18 - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private pickDragon(x: number, y: number): Dragon | null {
    for (const dr of this.world.dragons.list) if (Math.hypot(dr.x - x, dr.y - dr.z - 20 - y) < 90) return dr;
    return null;
  }

  private pickHuman(x: number, y: number): Human | null {
    let best: Human | null = null;
    let bd = 20;
    for (const h of this.world.humans) {
      if (this.renderer.hidden(h)) continue;
      const d = Math.hypot(h.x - x, h.y - h.z - (h.state === "down" ? 4 : 12) - y);
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
    if (this.view === "deep") {
      this.deep.down(e.pointerId, sx, sy);
      return;
    }
    const wp = this.renderer.toWorld(this.cam, sx, sy);
    // shift-drag draws a box to select people
    if (e.shiftKey && this.tool.id === "hand" && e.pointerType === "mouse") {
      this.box = { x0: sx, y0: sy, x1: sx, y1: sy };
      this.canvas.setPointerCapture?.(e.pointerId);
      this.ptrs.set(e.pointerId, { x: sx, y: sy, sx, sy, t: performance.now(), moved: false, grab: null });
      return;
    }
    const grab = this.tool.id === "hand" && this.ptrs.size === 0 && !this.selection.length ? this.pickDino(wp.x, wp.y) : null;
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
    if (this.view === "deep") {
      this.deep.move(e.pointerId, sx, sy, e.pointerType === "mouse");
      return;
    }
    if (e.pointerType === "mouse") this.hover = this.renderer.toWorld(this.cam, sx, sy);
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    if (this.box) {
      this.box.x1 = sx;
      this.box.y1 = sy;
      return;
    }
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
    if (this.view === "deep") {
      if (this.deep.up(e.pointerId, e.type === "pointercancel")) {
        this.audio.play("click", 0, 0, 0.3);
        if (this.deep.lastWhy) {
          this.world.toast("⛏️", this.deep.lastWhy);
          this.deep.lastWhy = null;
        }
        this.emit({ type: "select" });
      }
      return;
    }
    const p = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    this.cancelHold();
    if (this.box) {
      const b = this.box;
      this.box = null;
      if (Math.abs(b.x1 - b.x0) > 8 || Math.abs(b.y1 - b.y0) > 8) {
        const a = this.renderer.toWorld(this.cam, Math.min(b.x0, b.x1), Math.min(b.y0, b.y1));
        const c = this.renderer.toWorld(this.cam, Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
        const ids = this.world.humans.filter((h) => !h.stranger && !h.under && h.x > a.x && h.x < c.x && h.y - 12 > a.y && h.y - 12 < c.y).map((h) => h.id);
        this.selectPeople(e.ctrlKey || e.metaKey ? Array.from(new Set([...this.selection, ...ids])) : ids);
        return;
      }
      if (p) {
        // a shift-click: add / remove one person
        const wp = this.renderer.toWorld(this.cam, p.sx, p.sy);
        const h = this.pickHuman(wp.x, wp.y);
        if (h) this.toggleSelect(h.id);
        return;
      }
    }
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
    this.deep.leave();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { x, y } = this.local(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (this.view === "deep") {
      this.deep.wheel(delta, x, y, e.ctrlKey);
      return;
    }
    this.zoomBy(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), x, y);
  };

  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (this.view === "deep") {
      if (this.deep.key(e.key.toLowerCase(), e.type === "keydown")) {
        e.preventDefault();
        this.emit({ type: "select" });
      }
      return;
    }
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
      this.selection = [];
      this.inspectRef = null;
      this.lastCmd = null;
      this.followId = 0;
      this.emit({ type: "select" });
    } else if (k === "f" && (this.selectedId || this.selection.length === 1)) this.follow(this.selectedId || this.selection[0]);
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

    // people selected: the tap is an order (unless you tapped another person to pick them)
    if (this.selection.length) {
      const people = this.selectionHumans();
      const picked = { dino: this.pickDino(x, y), human: this.pickHuman(x, y), dragon: this.pickDragon(x, y), brute: this.pickBrute(x, y) };
      if (picked.human && !people.includes(picked.human) && !picked.human.captive && (this.addMode || condition(picked.human) === "healthy")) {
        if (this.addMode) this.toggleSelect(picked.human.id);
        else this.selectPeople([picked.human.id]);
        return;
      }
      if (picked.human && people.includes(picked.human) && !picked.dino) {
        // tapped someone already picked: just them
        if (people.length > 1) this.selectPeople([picked.human.id]);
        return;
      }
      const cmd = inferCommand(w, people, x, y, picked);
      if (cmd) this.runCommand(cmd, people, null);
      return;
    }

    const br = this.pickBrute(x, y);
    if (br) {
      const cl = w.rivals.clan(br.clan);
      w.toast("🪓", `${br.name} of the ${cl?.name ?? "?"} clan: a Neanderthal. Bigger + stronger than us, but no smarter. Select armed people and tap him to fight.`, br.x, br.y);
      return;
    }
    const dr = this.pickDragon(x, y);
    if (dr) {
      this.toastOnce("dragonTap", "🐉", `${dr.name} the dragon! Select people with bows (or crew a Scorpion) and tap it to fight back.`);
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
      if (h.stranger) {
        h.bubble = { text: "Is there room for us?", t: 2 };
        return;
      }
      this.selectPeople([h.id]);
      if (h.state !== "down") h.bubble = { text: ["Hi!", "Ooga!", "Yes?", "Ready!", "What job?"][Math.floor(w.rng() * 5)], t: 1.8 };
      w.sfx("babble", h.x, h.y, 0.6);
      return;
    }
    if (this.tapStructure(x, y)) return;
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
    // the humming chamber: go look, or open the civilization panel
    const civ = w.civ;
    if (civ.chamberX && Math.hypot(x - civ.chamberX, y - (civ.chamberY - 14)) < 42) {
      if (!civ.found) {
        this.goToChamber();
        w.toast("🎵", "Someone's going to take a look at that humming…", civ.chamberX, civ.chamberY);
      } else this.emit({ type: "openCiv" });
      this.audio.play("pop", 0, 0, 0.4);
      return true;
    }
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

  /** Tapped a building / gate / Scorpion / tower with nobody selected: inspect it (gates toggle). */
  private tapStructure(x: number, y: number) {
    const w = this.world;
    const body = carcassAt(w, x, y);
    if (body) return this.inspect({ kind: "carcass", id: body.id });
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const sc = w.colony.scorpions.find((s) => Math.hypot(s.x - x, s.y - (s.mount === "tower" ? 46 : s.mount === "wall" ? 26 : 10) - y) < 30);
    if (sc) return this.inspect({ kind: "scorpion", id: sc.id });
    const tower = w.tribe.towers.find((t) => x > t.tx * TILE - 6 && x < (t.tx + 2) * TILE + 6 && y > t.ty * TILE - 90 && y < (t.ty + 2) * TILE + 4);
    if (tower) return this.inspect({ kind: "tower", id: tower.id });
    const wl = w.tribe.wallAt(tx, ty) ?? w.tribe.wallAt(tx, Math.floor((y + 14) / TILE));
    if (wl && wl.part === "gate" && wl.built >= 1) {
      w.tribe.setGate(wl, !wl.open, true);
      w.sfx(wl.open ? "whoosh" : "thud", x, y, 0.6);
      w.toast("🚪", wl.open ? "Gate opened — dinos can wander through now." : "Gate shut! Only people can get through (by the side door).");
      return this.inspect({ kind: "gate", id: wl.id });
    }
    const s = w.shelters.find((sh) => Math.abs(sh.x - x) < 32 && y < sh.y + 8 && y > sh.y - 58);
    if (s) return this.inspect({ kind: "shelter", id: s.id });
    const b = w.colony.buildings.find((bd) => x > bd.tx * TILE && x < (bd.tx + BUILDINGS[bd.kind].w) * TILE && y > bd.ty * TILE - 30 && y < bd.y + 6);
    if (b) return this.inspect({ kind: "building", id: b.id });
    return false;
  }

  private inspect(ref: NonNullable<Engine["inspectRef"]>) {
    this.inspectRef = ref;
    this.select(0);
    this.audio.play("pop", 0, 0, 0.4);
    this.emit({ type: "inspect" });
    return true;
  }

  closeInspect() {
    this.inspectRef = null;
    this.emit({ type: "inspect" });
  }

  /* ----------------------------- selection + orders ----------------------------- */

  selectionHumans() {
    return this.selection.map((id) => this.world.humans.find((h) => h.id === id)).filter((h): h is Human => !!h);
  }

  selectPeople(ids: number[]) {
    this.selection = ids.filter((id) => this.world.humans.some((h) => h.id === id && !h.stranger));
    this.selectedId = this.selection.length === 1 ? this.selection[0] : 0;
    this.lastCmd = null;
    this.inspectRef = null;
    if (this.selection.length) this.audio.play("pop", 0, 0, 0.4);
    this.emit({ type: "select" });
  }

  toggleSelect(id: number) {
    const has = this.selection.includes(id);
    this.selectPeople(has ? this.selection.filter((x) => x !== id) : [...this.selection, id]);
  }

  clearSelection() {
    this.selectPeople([]);
  }

  /** Everyone grown-up (or everyone idle) in one go. */
  selectAll(idleOnly = false) {
    const w = this.world;
    const ids = w.humans.filter((h) => !h.child && !h.stranger && !h.under && h.state !== "down" && (!idleOnly || (!h.taskId && (h.state === "idle" || h.state === "walk" || h.state === "talk" || h.state === "sitFire")))).map((h) => h.id);
    this.selectPeople(ids);
  }

  private runCommand(cmd: Command, people: Human[], weapon: WeaponKind | null) {
    const w = this.world;
    const wpn = weapon ?? (cmd.weapons && cmd.weapons.length > 1 ? null : cmd.weapons?.[0] ?? null);
    const t = issue(w, people, cmd, wpn ?? undefined);
    this.lastCmd = { cmd, people: people.map((h) => h.id), at: performance.now(), weapon: wpn };
    this.marker = { x: cmd.x, y: cmd.y, t: 0, icon: cmd.icon };
    w.particles.spawn(P.Ring, cmd.x, cmd.y, { size: 10, max: 0.8, color: "rgba(255,215,90,0.95)" });
    this.audio.play("pop", 0, 0, 0.5);
    if (!t) this.toastOnce(`no-${cmd.kind}`, "🤷", "Nobody picked can do that.");
    this.emit({ type: "select" });
  }

  /** Swap the last order for one of its alternatives (the "instead…" chip). */
  commandAlt(i: number) {
    const lc = this.lastCmd;
    const alt = lc?.cmd.alts?.[i];
    if (!lc || !alt) return;
    const people = lc.people.map((id) => this.world.humans.find((h) => h.id === id)).filter((h): h is Human => !!h);
    const swapped: Command = { ...alt, alts: [{ ...lc.cmd, alts: undefined }, ...(lc.cmd.alts ?? []).filter((_, k) => k !== i)] };
    this.runCommand(swapped, people, null);
  }

  /** Re-issue the last fight order with a particular weapon. */
  commandWeapon(kind: WeaponKind) {
    const lc = this.lastCmd;
    if (!lc) return;
    const people = lc.people.map((id) => this.world.humans.find((h) => h.id === id)).filter((h): h is Human => !!h);
    this.runCommand(lc.cmd, people, kind);
  }

  dismissCommand() {
    this.lastCmd = null;
  }

  /** Stop what the selected people were told to do: back to auto. */
  cancelOrders() {
    const w = this.world;
    for (const h of this.selectionHumans()) {
      if (h.taskId) {
        const t = w.tasks.get(h.taskId);
        if (t) t.people = t.people.filter((id) => id !== h.id);
        h.taskId = 0;
      }
      h.order = null;
      h.site = "";
      h.wantTop = false;
      leaveScorpion(w, h);
      h.think = 0;
      h.bubble = { text: "Back to my job!", t: 1.6 };
    }
    this.lastCmd = null;
    this.emit({ type: "select" });
  }

  dismountSelected() {
    for (const h of this.selectionHumans()) if (h.riding) dismount(this.world, h);
  }

  equipSelected(kind: WeaponKind) {
    for (const h of this.selectionHumans()) {
      if (!this.world.colony.equipKind(h, kind)) h.bubble = { text: "None left in the armory!", t: 1.8 };
      else h.bubble = { text: "Got it!", t: 1.4 };
    }
  }

  private updateHoverHint(dt: number) {
    this.hintT -= dt;
    if (this.hintT > 0) return;
    this.hintT = 0.12;
    if (this.hover && !this.selection.length && this.tool.id === "hand" && !this.box) {
      const target = this.hoverStructure(this.hover.x, this.hover.y);
      this.hoverItem = target ? { x: target.x, y: target.y, radius: target.radius } : null;
      // nobody picked: still say what a dinosaur body is worth
      const body = carcassAt(this.world, this.hover.x, this.hover.y);
      this.hoverHint = body && body.species ? { x: this.hover.x, y: this.hover.y, icon: "🔪", label: `${sp(body.species).nick} · ${STAGE_LABEL[carcassStage(body.carcass!)]} · ${carcassSummary(body)} — tap to harvest` } : target ? { x: this.hover.x, y: this.hover.y, icon: target.icon, label: target.label } : null;
      return;
    }
    this.hoverItem = null;
    if (!this.hover || !this.selection.length || this.tool.id !== "hand" || this.box) {
      this.hoverHint = null;
      return;
    }
    const { x, y } = this.hover;
    const people = this.selectionHumans();
    const picked = { dino: this.pickDino(x, y), human: this.pickHuman(x, y), dragon: this.pickDragon(x, y), brute: this.pickBrute(x, y) };
    if (picked.human && !people.includes(picked.human) && !picked.human.captive && condition(picked.human) === "healthy") {
      this.hoverHint = { x, y, icon: "👆", label: `Pick ${picked.human.name}` };
      return;
    }
    const cmd = inferCommand(this.world, people, x, y, picked);
    this.hoverHint = cmd ? { x, y, icon: cmd.icon, label: cmd.label } : null;
  }

  private hoverStructure(x: number, y: number) {
    const w = this.world;
    const sc = w.colony.scorpions.find((s) => Math.hypot(s.x - x, s.y - (s.mount === "tower" ? 46 : s.mount === "wall" ? 26 : 10) - y) < 30);
    if (sc) return { x: sc.x, y: sc.y - (sc.mount === "tower" ? 46 : sc.mount === "wall" ? 26 : 10), radius: 27, icon: "🎯", label: "Scorpion · tap to inspect" };
    const tower = w.tribe.towers.find((t) => x >= t.x - 34 && x <= t.x + 34 && y >= t.y - 90 && y <= t.y + 4);
    if (tower) return { x: tower.x, y: tower.y - 46, radius: 36, icon: "🗼", label: "Watchtower · tap to inspect" };
    const shelter = w.shelters.find((s) => Math.abs(s.x - x) < 32 && y < s.y + 8 && y > s.y - 58);
    if (shelter) return { x: shelter.x, y: shelter.y - 18, radius: 34, icon: "🏠", label: "Home · tap to inspect" };
    const building = w.colony.buildings.find((b) => x > b.tx * TILE && x < (b.tx + BUILDINGS[b.kind].w) * TILE && y > b.ty * TILE - 30 && y < b.y + 6);
    if (building) return { x: building.x, y: building.y - 8, radius: BUILDINGS[building.kind].w * 18, icon: BUILDINGS[building.kind].icon, label: `${BUILDINGS[building.kind].name} · tap to inspect` };
    return null;
  }

  /* ----------------------------- building actions ----------------------------- */

  upgradeHome(id: number) {
    const s = this.world.shelters.find((x) => x.id === id);
    if (s && this.world.camp.startUpgrade(this.world, s)) this.emit({ type: "inspect" });
  }

  upgradeScorpion(id: number) {
    const w = this.world;
    const s = w.colony.scorpions.find((x) => x.id === id);
    if (!s || s.up || s.built < 1 || !SCORPION_TIERS[s.tier]) return;
    const next = SCORPION_TIERS[s.tier];
    if (next.at === "blacksmith" && !w.colony.finished("blacksmith")) {
      w.toast("⚒️", "That upgrade needs a finished Blacksmith.");
      return;
    }
    s.up = true;
    s.have = {};
    w.toast("🎯", `Builders will upgrade it to a ${next.name}.`, s.x, s.y);
    this.emit({ type: "inspect" });
  }

  setGateAuto(id: number) {
    const g = this.world.tribe.walls.find((x) => x.id === id);
    if (g) {
      g.auto = true;
      this.emit({ type: "inspect" });
    }
  }

  toggleGate(id: number) {
    const g = this.world.tribe.walls.find((x) => x.id === id);
    if (g) {
      this.world.tribe.setGate(g, !g.open, true);
      this.emit({ type: "inspect" });
    }
  }

  /** Send the nearest idle grown-ups to harvest a body. */
  harvestWithIdle(itemId: number) {
    const w = this.world;
    const it = w.items.find((i) => i.id === itemId);
    if (!it?.carcass) return;
    const idle = w.humans
      .filter((h) => !h.child && !h.stranger && !h.taskId && h.state !== "down" && h.state !== "operate")
      .sort((a, b) => Math.hypot(a.x - it.x, a.y - it.y) - Math.hypot(b.x - it.x, b.y - it.y))
      .slice(0, Math.min(4, 1 + Math.floor(it.carcass.size / 45)));
    if (!idle.length) {
      w.toast("🤷", "Nobody's free right now — pick someone and tap the body.");
      return;
    }
    const cmd = inferCommand(w, idle, it.x, it.y - 8, { dino: null, human: null, dragon: null });
    if (cmd) this.runCommand(cmd, idle, null);
    this.selectPeople(idle.map((h) => h.id));
  }

  /** Dev/test helper: drop a dinosaur body (optionally part-harvested, 0..1). */
  debugCarcass(species: SpeciesId, x: number, y: number, k = 0) {
    const w = this.world;
    const d = w.spawnDino(species, x, y);
    if (!d) return null;
    const it = makeCarcass(w, d);
    w.removeDino(d);
    const c = it.carcass!;
    c.meat = c.max.meat * (1 - k);
    c.hide = c.max.hide * (1 - k);
    it.amount = c.meat;
    return it.id;
  }

  /** The forge tab was opened: those recipes aren't "new" any more. */
  seenRecipes() {
    this.world.colony.fresh.clear();
  }

  /** Select whoever lives in a home (and wake them up: there's work to do). */
  selectResidents(id: number) {
    const ids = this.world.humans.filter((h) => h.home === id && !h.child && h.state !== "down").map((h) => h.id);
    for (const h of this.world.humans) if (ids.includes(h.id) && (h.state === "hide" || h.state === "sleep" || h.state === "rest")) {
      h.state = "idle";
      h.think = 0;
    }
    this.selectPeople(ids);
  }

  queueForge(id: string) {
    const w = this.world;
    if (w.colony.queue.length >= 8) return;
    w.colony.queue.push(id);
    const it = FORGE_ITEMS.find((f) => f.id === id);
    if (it && !w.colony.canCraft(w, id)) w.toast("⚒️", `${it.name} needs a ${it.at === "blacksmith" ? "Blacksmith" : "Workshop"} first — it'll wait in the queue.`);
  }

  unqueueForge(i: number) {
    const w = this.world;
    if (i === 0) w.colony.craftT = 0;
    w.colony.queue.splice(i, 1);
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
    } else if (this.tool.id === "disaster" && t.disaster === "supervolcano") {
      // game-ending: ask first
      if (w.extinction.active) w.toast("🌋", "The world is already ending!");
      else this.emit({ type: "confirmEnd", cause: "supervolcano" });
      back();
    } else if (this.tool.id === "disaster" && t.disaster === "dragon") {
      const dr = w.dragons.summon(w);
      if (!dr) w.toast("🐉", "The sky is crowded enough with dragons!");
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

  /** A row of bone spikes outside the walls. */
  planSpikes() {
    const w = this.world;
    if (!w.camp.learned.has("spear")) {
      w.toast("🔒", "Invent the Spear first: then the tribe knows how to sharpen bones.");
      return 0;
    }
    const n = w.tribe.planSpikes(w);
    w.toast("🦴", n ? `Planned ${n} bone spikes outside the walls. Builders need ${n * 2} bones: harvest some dinosaurs!` : "Build some walls first (or the spikes are already planned).");
    if (n) this.flyTo(w.camp.x, w.camp.y + 30, Math.min(this.cam.zoom, 0.65));
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

  /** A small JPEG of what's on screen (for the saved-games list). */
  thumbnail(): string | undefined {
    try {
      const src = this.canvas;
      const t = document.createElement("canvas");
      t.width = 240;
      t.height = 150;
      const g = t.getContext("2d");
      if (!g || !src.width) return undefined;
      const sw = src.width;
      const sh = src.height;
      const k = Math.max(240 / sw, 150 / sh);
      g.drawImage(src, (240 - sw * k) / 2, (150 - sh * k) / 2, sw * k, sh * k);
      return t.toDataURL("image/jpeg", 0.62);
    } catch {
      return undefined;
    }
  }

  /** Package the world as a saved-games slot. */
  makeSlot(kind: SlotKind, name?: string, group = ""): Slot {
    const w = this.world;
    const h = Math.floor(w.time);
    const m = Math.floor((w.time - h) * 60);
    const clock = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
    return {
      id: kind === "latest" ? "latest" : newId(),
      kind,
      name: name || (kind === "latest" ? "Latest" : `Day ${w.day} · ${clock}`),
      group: group || (kind === "auto" ? "Autosaves" : kind === "latest" ? "" : "My saves"),
      savedAt: Date.now(),
      day: w.day,
      time: w.time,
      people: w.humans.filter((x) => !x.stranger).length,
      level: CAMP_LEVELS[w.tribe.level].name,
      thumb: this.thumbnail(),
      data: JSON.stringify(w.serialize()),
    };
  }

  /** The world as a save string + a few headline numbers (for cloud saves). */
  exportSave() {
    const w = this.world;
    return {
      data: JSON.stringify(w.serialize()),
      meta: {
        day: w.day,
        dinos: w.dinos.length,
        people: w.humans.length,
        level: CAMP_LEVELS[w.tribe.level].name,
        stickers: w.discoveries.size,
      },
    };
  }

  /** Swap in a world from a save string. Returns false if it couldn't be read. */
  importSave(json: string) {
    try {
      const data = JSON.parse(json) as SaveData;
      if (!data || typeof data.v !== "number" || data.v < 1 || data.v > SAVE_VERSION) return false;
      const w = World.deserialize(data);
      this.world = w;
      this.renderer.setWorld(w);
      this.selectedId = 0;
      this.followId = 0;
      this.orderFor = 0;
      this.selection = [];
      this.inspectRef = null;
      this.lastCmd = null;
      this.carried = null;
      this.rallyRoles = null;
      this.cam = { ...HOME };
      this.clampCam();
      this.save(true);
      this.emit({ type: "select" });
      return true;
    } catch {
      return false;
    }
  }

  /* ----------------------------- guide bubbles ----------------------------- */

  /** Things on screen right now that a "?" bubble could explain (world coords of the current view). */
  hintTargets(): { key: string; x: number; y: number }[] {
    const w = this.world;
    const out: { key: string; x: number; y: number }[] = [];
    if (this.view === "deep") {
      const m = w.mine;
      const r = this.deep.renderer;
      const { w: sw, h: sh } = r.size;
      const inView = (x: number, y: number) => {
        const p = r.toScreen(this.deep.cam, x, y);
        return p.x > 60 && p.y > 120 && p.x < sw - 60 && p.y < sh - 160;
      };
      const lift = { x: 4 * 32 + 16, y: m.liftY * 32 };
      if (inView(lift.x, lift.y)) out.push({ key: "lift", ...lift });
      const a = r.toWorld(this.deep.cam, 0, 0);
      const b = r.toWorld(this.deep.cam, sw, sh);
      const x0 = Math.max(0, Math.floor(a.x / 32));
      const x1 = Math.min(47, Math.floor(b.x / 32));
      const y0 = Math.max(0, Math.floor(a.y / 32));
      const y1 = Math.min(199, Math.floor(b.y / 32));
      let vein = false;
      let bed = false;
      for (let y = y0; y <= y1 && !(vein && bed); y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * 48 + x;
          const cx = x * 32 + 16;
          const cy = y * 32 + 16;
          if (!vein && m.seen[i] === 2 && m.ore[i] && inView(cx, cy)) {
            out.push({ key: `vein:${i}`, x: cx, y: cy - 10 });
            vein = true;
          }
          if (!bed && m.seen[i] && m.cells[i] === 11 && inView(cx, cy)) {
            out.push({ key: `bedrock:${i}`, x: cx, y: cy - 10 });
            bed = true;
          }
        }
      return out;
    }
    const v = this.renderer.viewRect(this.cam);
    const pad = 80;
    const inView = (x: number, y: number) => x > v.x0 + pad && x < v.x1 - pad && y > v.y0 + pad * 1.6 && y < v.y1 - pad * 2;
    const add = (key: string, x: number, y: number) => {
      if (inView(x, y)) out.push({ key, x, y });
    };
    const c = w.camp;
    const fire = w.campfires.find((f) => f.lit);
    if (fire) add("campfire", fire.x, fire.y - 24);
    add("cave", c.caveX, c.caveY - 30);
    add("pile", c.pileX, c.pileY - 24);
    const site = w.buildSites().find((s) => !s.repair);
    if (site) add(`site:${site.kind}${site.id}`, site.x, site.y - 40);
    const node = w.colony.nodes.find((n) => n.found && inView(n.x, n.y));
    if (node) add(`node:${node.id}`, node.x, node.y - 24);
    if (w.civ.chamberX) add("chamber", w.civ.chamberX, w.civ.chamberY - 50);
    const body = w.items.find((it) => it.kind === "carcass" && inView(it.x, it.y));
    if (body) add(`carcass:${body.id}`, body.x, body.y - 30);
    add("volcano", w.volcano.x, w.volcano.y - 160);
    const egg = w.eggs.find((e) => inView(e.x, e.y));
    if (egg) add(`egg:${egg.id}`, egg.x, egg.y - 20);
    const dino = w.dinos.find((d) => inView(d.x, d.y) && d.state !== "carried");
    if (dino) add(`dino:${dino.id}`, dino.x, dino.y - sizeOf(dino) * 0.7);
    return out;
  }

  /** Screen position of a point in whichever view is showing. */
  screenOf(x: number, y: number) {
    return this.view === "deep" ? this.deep.renderer.toScreen(this.deep.cam, x, y) : this.renderer.toScreen(this.cam, x, y);
  }

  /* ----------------------------- the Deep ----------------------------- */

  /** Go down the mine (zooms into the cave mouth, fades, comes out underground). */
  enterDeep() {
    if (this.view === "deep" || this.dive) return;
    this.flyTo(this.world.camp.caveX, this.world.camp.caveY, Math.min(MAX_ZOOM, 2.2));
    this.select(0);
    this.selection = [];
    this.inspectRef = null;
    this.tool = { ...this.tool, id: "hand" };
    this.dive = { t: 0, to: "deep", switched: false };
    this.audio.play("whoosh", 0, 0, 0.6, 0.6);
  }

  /** Back up to the surface. */
  /** Start the mine over with new rock + minerals (keeps everything already made). */
  deepReset() {
    resetMine(this.world);
    this.deepClearSelection();
    this.world.toast("♻️", "Fresh mine! New rock, caves and mineral veins. Your rooms, lift and everything hauled up are kept.");
  }

  leaveDeep() {
    if (this.view === "surface" || this.dive) return;
    this.dive = { t: 0, to: "surface", switched: false };
    this.cam = { x: this.world.camp.caveX, y: this.world.camp.caveY, zoom: Math.min(MAX_ZOOM, 2) };
    this.flyTo(this.world.camp.caveX, this.world.camp.caveY + 60, 1);
    this.audio.play("whoosh", 0, 0, 0.6, 1.2);
  }

  /** Send up to n people down the mine. */
  deepSend(n: number) {
    const list = pickMiners(this.world, n);
    for (const h of list) sendDown(this.world, h);
    if (!list.length) this.world.toast("⛏️", "Nobody free to send: grown-ups who aren't hurt or busy guarding.");
    else this.world.mine.recall = false;
    this.emit({ type: "select" });
    return list.length;
  }

  /** From a person's card on the surface. */
  sendToDeep(id: number) {
    const h = this.world.humans.find((x) => x.id === id);
    if (!h || !canSend(h)) return false;
    this.world.mine.recall = false;
    const ok = sendDown(this.world, h);
    if (ok) {
      this.world.toast("⛏️", `${h.name} is heading for the cave to go down the mine.`);
      this.select(0);
      this.emit({ type: "select" });
    }
    return ok;
  }

  deepRecall() {
    recallAll(this.world);
    this.world.toast("⬆️", "Everyone's heading back up the lift.");
    this.emit({ type: "select" });
  }

  /** Pick a room to place (switches to build mode). */
  deepBuild(kind: DeepKind) {
    this.deep.buildKind = kind;
    this.deep.mode = "build";
    this.deep.sel = null;
    this.emit({ type: "select" });
  }

  deepDemolish(id: number) {
    if (demolishDeep(this.world, id)) {
      this.world.toast("🧱", "Taken down — half the materials went back on the stockpile.");
      this.deep.sel = null;
    }
    this.emit({ type: "select" });
  }

  deepMode(mode: "look" | OrderKind | "clear" | "build") {
    this.deep.mode = mode;
    if (mode !== "look") this.deep.sel = null;
    this.emit({ type: "select" });
  }

  /** Put an order on the selected cell (null = remove it). */
  deepOrder(kind: OrderKind | null) {
    const s = this.deep.sel;
    if (s === null) return;
    const why = setOrder(this.world, s % 48, Math.floor(s / 48), kind);
    if (why) this.world.toast("⛏️", why);
    else this.audio.play("click", 0, 0, 0.3);
    this.emit({ type: "select" });
  }

  deepToggleAuto() {
    this.world.mine.autoMine = !this.world.mine.autoMine;
    this.emit({ type: "select" });
  }

  /** Mine sounds (only heard while you're looking down there). */
  private mineSounds() {
    const mine = this.world.mine;
    if (!mine.sfx.length) return;
    if (this.view === "deep") {
      const camRow = this.deep.cam.y / 32;
      for (const e of mine.sfx.slice(0, 4)) {
        const d = Math.abs(Math.floor(e.cell / 48) - camRow);
        const vol = Math.max(0, 1 - d / 25) * (e.s === "boom" ? 1.4 : e.s === "rumble" ? 1 : 0.35);
        if (vol > 0.05) this.audio.play(e.s, this.cam.x, this.cam.y, vol, e.s === "knock" ? 0.8 + Math.random() * 0.4 : 0.8);
      }
    }
    mine.sfx.length = 0;
  }

  deepPing() {
    const why = this.deep.ping(this.world.mine);
    if (why) this.world.toast("📡", why);
    else this.audio.play("chime", 0, 0, 0.5, 0.7);
    this.emit({ type: "select" });
    return why;
  }

  deepUpgradeLift() {
    const why = this.world.mine.upgradeLift(this.world);
    if (why) this.world.toast("🛗", why);
    else {
      this.world.toast("🛗", `The lift now reaches ${this.world.mine.liftMax * 6} ft down!`);
      this.audio.play("build", 0, 0, 0.7);
      this.save(true);
    }
    this.emit({ type: "select" });
    return why;
  }

  deepCallLift(row: number) {
    this.world.mine.callLift(row);
    this.audio.play("hum", 0, 0, 0.4, 1.4);
  }

  deepFocus(x: number | null, row: number) {
    this.deep.focus(x, row);
  }

  deepClearSelection() {
    this.deep.sel = null;
    this.deep.selectMiner(0);
    this.emit({ type: "select" });
  }

  drawDeepMinimap(canvas: HTMLCanvasElement) {
    this.deep.drawMinimap(this.world, canvas);
  }

  /** Muffled surface sounds, dripping water, the deep rumble. */
  private deepAudio(dt: number) {
    const w = this.world;
    this.bedT -= dt;
    if (this.bedT > 0) return;
    this.bedT = 0.25;
    const depth = Math.max(0, this.deep.cam.y / (200 * 32));
    // drips + far-off creaks in the dark
    if (Math.random() < 0.12) this.audio.play("plop", this.cam.x, this.cam.y, 0.12 + Math.random() * 0.12, 0.7 + Math.random() * 0.6);
    if (depth > 0.5 && Math.random() < 0.05) this.audio.play("rumble", this.cam.x, this.cam.y, 0.25, 0.6);
    this.audio.updateBeds({
      rain: w.weather.rain * 0.15,
      wind: 0,
      water: Math.min(1, w.mine.springs.size * 0.3),
      fire: 0,
      night: 0.6,
      day: 0,
      volcano: Math.min(1, depth * depth * 1.2),
    }, 0.25);
  }

  /* ----------------------------- civilization ----------------------------- */

  civInfo(): CivInfo {
    const w = this.world;
    const civ = w.civ;
    const jobs: Record<string, number> = { researcher: 0, shaper: 0, technician: 0, miner: 0 };
    for (const h of w.humans) {
      const r = w.tribe.roleOf(h);
      if (r in jobs) jobs[r]++;
    }
    const grid = new Map<string, { kind: string; icon: string; name: string; n: number; gen: number }>();
    for (const b of w.colony.buildings) {
      if (b.built < 1 || !(b.kind in ENERGY_GEN || b.kind === "condenser" || b.kind === "beamTower" || b.kind === "pylon" || b.kind === "levPad" || b.kind === "resShield")) continue;
      const d = BUILDINGS[b.kind];
      const g = grid.get(b.kind) ?? { kind: b.kind, icon: d.icon, name: d.name, n: 0, gen: 0 };
      g.n++;
      g.gen += ENERGY_GEN[b.kind] ?? 0;
      grid.set(b.kind, g);
    }
    const notes: Record<string, number> = {};
    civ.tuned.forEach((r) => (notes[r] = civ.noteOf(w, r)));
    return {
      path: civ.path,
      chamber: civ.chamberX > 0,
      found: civ.found,
      pending: civ.choicePending,
      ripe: civ.ripe(w),
      current: civ.current ? { id: civ.current, rp: civ.rp, need: civ.rpOf(civ.current), paid: civ.paid, missing: civ.missing(w), cost: civ.costOf(civ.current) } : null,
      done: civ.polygonAge && !civ.done.has("precisionStone") ? [...Array.from(civ.done), "precisionStone" as CivTechId] : Array.from(civ.done),
      options: civ.options().map((id) => ({ id, cost: civ.costOf(id), rp: civ.rpOf(id), cross: civ.isCross(id) })),
      crossOpen: civ.crossOpen(),
      energy: civ.energy,
      cap: civ.cap,
      gen: civ.gen * (w.weather.storm > 0.3 ? 1.6 : 1),
      use: civ.use,
      strain: civ.strain,
      condensed: civ.condensed,
      tuned: Array.from(civ.tuned),
      notes,
      canExperiment: civ.canExperiment(w),
      jobs,
      grid: Array.from(grid.values()),
      monuments: w.colony.buildings
        .filter((b) => b.kind === "pyramid" || b.kind === "obelisk" || b.kind === "stoneCircle" || b.kind === "resShield" || b.kind === "shelterDeep")
        .map((b) => {
          const st = b.kind === "pyramid" ? PYRAMID_STAGES : null;
          return { id: b.id, icon: BUILDINGS[b.kind].icon, name: BUILDINGS[b.kind].name, built: b.built, stage: st ? (b.stage ?? 0) : 0, stages: st ? st.length : 1, stageName: st ? st[Math.min(b.stage ?? 0, st.length - 1)].name : "", done: b.built >= 1 };
        }),
      megaliths: w.props.filter((p) => p.kind === "megalith").length,
    };
  }

  chooseCivPath(path: Exclude<CivPath, "none">) {
    const ok = this.world.civ.choose(this.world, path);
    if (ok) this.save(true);
    this.emit({ type: "select" });
    return ok;
  }

  setCivResearch(id: CivTechId) {
    const ok = this.world.civ.setResearch(this.world, id);
    if (ok) this.audio.play("pop", 0, 0, 0.4);
    return ok;
  }

  /** Ring a material on the Resonance table at a frequency (plays the tone). */
  civExperiment(r: Resource, freq: number): ExperimentResult {
    const w = this.world;
    const res = w.civ.experiment(w, r, freq);
    if (res.result !== "locked") {
      this.audio.unlock();
      this.audio.tone(freq, r, res.close, res.result === "resonant" ? 1.8 : 0.9);
      if (res.result === "fracture") this.audio.play("crack", 0, 0, 0.8);
      if (res.result === "spark") this.audio.play("zap", 0, 0, 0.7);
      if (res.result === "resonant") window.setTimeout(() => this.audio.play("chime", 0, 0, 0.8), 400);
    }
    return res;
  }

  /** Preview a tone without using the table (the slider's "listen" button). */
  civTone(freq: number, r: string) {
    this.audio.unlock();
    this.audio.tone(freq, r, 0, 0.6);
  }

  /** Fly to the humming chamber; if nobody has looked yet, send the nearest grown-up. */
  goToChamber() {
    const w = this.world;
    const civ = w.civ;
    if (!civ.chamberX) {
      if (!civ.ripe(w)) return "The tribe needs to settle in first (6 inventions + 3 grown-ups).";
      w.civ.update(w, 2.1);
    }
    if (!civ.chamberX) return "Couldn't find the chamber yet — try again soon.";
    this.flyTo(civ.chamberX, civ.chamberY, Math.max(this.cam.zoom, 0.9));
    if (!civ.found) {
      const h = w.humans.filter((x) => !x.child && !x.stranger && x.state !== "down").sort((a, b) => Math.hypot(a.x - civ.chamberX, a.y - civ.chamberY) - Math.hypot(b.x - civ.chamberX, b.y - civ.chamberY))[0];
      if (h) {
        h.order = null;
        h.taskId = 0;
        go(h, "explore", civ.chamberX + 24, civ.chamberY + 16);
        say(h, "I'll look!");
      }
    }
    return null;
  }

  /** The player confirmed: call down the extinction asteroid. */
  triggerExtinction(cause: "asteroid" | "supervolcano" = "asteroid") {
    if (this.view === "deep") this.leaveDeep();
    const ok = this.world.extinction.trigger(this.world, cause);
    if (ok) {
      // the supervolcano is best watched from between the volcano and the camp
      if (cause === "supervolcano") this.flyTo((this.world.camp.x + this.world.volcano.x) / 2, (this.world.camp.y + this.world.volcano.y) / 2, 0.3);
      else this.flyTo(this.world.camp.x, this.world.camp.y, Math.min(this.cam.zoom, 0.45));
      this.closeInspect();
    }
    return ok;
  }

  /** Close "THE AGE ENDS" and keep watching the ruined world. */
  observeRuins() {
    this.world.extinction.observe();
    this.flyTo(this.world.extinction.x, this.world.extinction.y, 0.4);
  }

  /** Start this same world again from its seed. */
  restartWorld() {
    this.newWorld(this.world.seed);
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
    this.selection = [];
    this.inspectRef = null;
    this.lastCmd = null;
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
      } else if (c.order?.kind === "guard") activity = c.order.top ? "Defending from the wall" : "Guarding the spot you picked";
      const task = w.tasks.get(c.taskId);
      const wp = w.tribe.weaponFor(w, c);
      const home = c.home ? w.shelters.find((s) => s.id === c.home) : null;
      const mount = c.riding ? w.dinoById(c.riding) : null;
      const kinds = new Set<WeaponKind>();
      for (const [id, n] of Object.entries(w.colony.armory)) if (n > 0 && WEAPON_BY_ID[id]) kinds.add(WEAPON_BY_ID[id].kind);
      selected = {
        kind: "human",
        id: c.id,
        name: c.name,
        child: c.child,
        activity: c.state === "down" ? "Knocked out — needs help!" : activity,
        role: c.role,
        autoRole: c.autoRole,
        ordered: !!c.order || !!c.taskId,
        hp: c.hp,
        warmth: c.warmth,
        condition: condition(c),
        weapon: wp ? { id: wp.id, name: wp.name, icon: wp.icon } : null,
        shield: c.gear.shield,
        home: home ? `${HOUSING[home.tier].icon} ${HOUSING[home.tier].name}` : "🪨 The cave",
        task: task ? { icon: task.icon, label: task.label } : null,
        riding: mount ? `${mount.name} the ${sp(mount.species).nick}` : null,
        canEquip: Array.from(kinds),
        outfit: c.gear.outfit && OUTFIT_BY_ID[c.gear.outfit] ? { id: c.gear.outfit, name: OUTFIT_BY_ID[c.gear.outfit].name, icon: OUTFIT_BY_ID[c.gear.outfit].icon, rain: OUTFIT_BY_ID[c.gear.outfit].rain, warmth: OUTFIT_BY_ID[c.gear.outfit].warmth } : null,
      };
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
      rivals: {
        clans: w.rivals.clans.map((cl) => {
          const others = w.rivals.clans.filter((o) => o !== cl);
          return {
            id: cl.id,
            name: cl.name,
            color: cl.color,
            size: w.rivals.members(cl.id).length,
            x: cl.x,
            y: cl.y,
            captives: w.rivals.captives(w, cl.id).map((h) => h.name),
            wars: others.filter((o) => w.rivals.relation(o.id, cl.id) === -1).map((o) => o.name),
            pacts: others.filter((o) => w.rivals.relation(o.id, cl.id) === 1).map((o) => o.name),
          };
        }),
      },
      orderFor: this.orderFor,
      rallied: this.rallyRoles !== null,
      evolution: { leaps: w.evoLeaps, auto: w.evoAuto, species: speciesStats(w) },
      selection: this.selectionHumans().map((h) => {
        const task = w.tasks.get(h.taskId);
        return { id: h.id, name: h.name, child: h.child, hp: h.hp, condition: condition(h), icon: h.child ? "🧒" : task ? task.icon : h.riding ? "🏇" : (ROLE_ICON[w.tribe.roleOf(h)] ?? "🧔"), activity: task ? task.label : ACTIVITY[h.state] ?? "Busy" };
      }),
      command: this.commandInfo(),
      inspect: this.inspectInfo(),
      forge: this.forgeInfo(),
      colony: {
        buildings: w.colony.buildings.filter((b) => b.built >= 1).length,
        scorpions: w.colony.scorpions.filter((s) => s.built >= 1).length,
        deposits: w.colony.nodes.length,
        found: w.colony.nodes.filter((n) => n.found).length,
        homes: w.shelters.filter((s) => shelterDone(s)).length,
        dragons: w.dragons.list.length,
        strangers: w.humans.filter((h) => h.stranger).length,
        snow: w.snow.total,
        mega: w.volcano.megaOn,
      },
      civ: this.civInfo(),
      view: this.view,
      deep: this.view === "deep" ? this.deep.info(w) : null,
      crew: w.mine.crew.length + w.mine.pending.size,
      extinction: {
        phase: w.extinction.phase,
        cause: w.extinction.cause,
        countdown: Math.max(0, w.extinction.countdown()),
        stats: w.extinction.stats,
        shelter: w.colony.finished("shelterDeep"),
        shield: w.colony.finished("resShield"),
        shieldReady: w.colony.finished("resShield") && w.civ.energy >= SHIELD_HOLD,
      },
    };
  }

  private commandInfo(): CommandInfo | null {
    const lc = this.lastCmd;
    if (!lc || performance.now() - lc.at > 7000) return null;
    return {
      icon: lc.cmd.icon,
      label: lc.cmd.label,
      alts: (lc.cmd.alts ?? []).map((a, i) => ({ icon: a.icon, label: a.label, i })),
      weapons: lc.cmd.weapons && lc.cmd.weapons.length > 1 ? lc.cmd.weapons : [],
      weapon: lc.weapon,
      at: lc.at,
    };
  }

  private inspectInfo(): InspectInfo | null {
    const w = this.world;
    const r = this.inspectRef;
    if (!r) return null;
    switch (r.kind) {
      case "shelter": {
        const s = w.shelters.find((x) => x.id === r.id);
        if (!s) return null;
        const done = shelterDone(s);
        const t = HOUSING[s.tier];
        const next = HOUSING[s.tier + 1];
        const stages = stagesOf(s);
        const st = stages[s.stage];
        return {
          kind: "shelter",
          id: s.id,
          icon: t.icon,
          name: done ? t.name : `${s.plan === "tent" ? "Tent" : "Hut"} (building)`,
          tier: s.tier,
          cap: t.cap,
          built: done,
          progress: done ? "" : `${st.label}: ${s.have}/${st.n} ${st.need}`,
          hp: s.hp,
          hearth: t.hearth,
          warmth: t.warmth,
          residents: w.humans.filter((h) => h.home === s.id).map((h) => ({ id: h.id, name: h.name, child: h.child, inside: (h.state === "hide" || h.state === "sleep" || h.state === "rest") && Math.hypot(h.x - s.x, h.y - s.y - 6) < 30, state: ACTIVITY[h.state] ?? h.state })),
          upgrade: done && next ? { icon: next.icon, name: next.name, cost: next.cost, have: s.upHave, started: s.up } : null,
        };
      }
      case "building": {
        const b = w.colony.buildings.find((x) => x.id === r.id);
        if (!b) return null;
        const d = BUILDINGS[b.kind];
          const stage = b.kind === "pyramid" ? { n: (b.stage ?? 0) + (b.built >= 1 ? 1 : 0), of: PYRAMID_STAGES.length, name: PYRAMID_STAGES[Math.min(b.stage ?? 0, PYRAMID_STAGES.length - 1)].name, next: PYRAMID_STAGES[(b.stage ?? 0) + 1]?.name ?? null } : undefined;
        const gen = ENERGY_GEN[b.kind];
        const note = b.built < 1 && d.civ && !w.civ.has(d.civ) ? `🔒 Needs research: ${CIV_TECH[d.civ].icon} ${CIV_TECH[d.civ].name}` : gen && b.built >= 1 ? `⚡ Makes ${gen.toFixed(1)} energy/s${w.weather.storm > 0.3 ? " (storm boost!)" : ""}` : b.kind === "beamTower" && b.built >= 1 ? ((b.cd ?? 0) > 0 ? `Recharging… ${(b.cd ?? 0).toFixed(1)}s` : "Charged and watching") : undefined;
        return { kind: "building", id: b.id, icon: d.icon, name: d.name, tip: d.tip, built: b.built, hp: b.hp, maxHp: d.hp, cost: buildingCost(b), have: b.have, stage, note };
      }
      case "scorpion": {
        const s = w.colony.scorpions.find((x) => x.id === r.id);
        if (!s) return null;
        const t = SCORPION_TIERS[s.tier - 1];
        const next = SCORPION_TIERS[s.tier];
        const crew = s.crew ? w.humans.find((h) => h.id === s.crew) : null;
        return {
          kind: "scorpion",
          id: s.id,
          drone: !!s.drone,
          name: t.name,
          tier: s.tier,
          built: s.built,
          hp: s.hp,
          maxHp: t.hp,
          crew: crew ? crew.name : null,
          mount: s.mount,
          cost: s.built < 1 ? SCORPION_TIERS[0].cost : next?.cost ?? {},
          have: s.have,
          next: next ? { name: next.name, cost: next.cost, locked: next.at === "blacksmith" && !w.colony.finished("blacksmith") } : null,
          upgrading: s.up,
        };
      }
      case "gate": {
        const g = w.tribe.walls.find((x) => x.id === r.id);
        if (!g) return null;
        return { kind: "gate", id: g.id, open: g.open, auto: g.auto, hp: g.hp, maxHp: wallMaxHp(g), material: g.bone ? "Bone" : g.kind === "polygon" ? "Polygon" : g.kind === "stone" ? "Stone" : "Wooden" };
      }
      case "carcass": {
        const it = w.items.find((x) => x.id === r.id);
        if (!it?.carcass || !it.species) return null;
        const cc = it.carcass;
        const left = (["meat", "hide", "bone", "tooth"] as const).filter((k) => cc.max[k] > 0).map((k) => ({ r: k, n: Math.round(cc[k]), max: cc.max[k] }));
        return { kind: "carcass", id: it.id, name: sp(it.species).nick, stage: STAGE_LABEL[carcassStage(cc)], left, working: w.humans.filter((h) => h.targetId === -it.id).length, burnt: cc.burnt, fresh: Math.max(0, Math.round(120 - it.t)) };
      }
      case "tower": {
        const t = w.tribe.towers.find((x) => x.id === r.id);
        if (!t) return null;
        const guards = w.humans.filter((h) => h.level === 1 && w.nav.isTower(Math.floor(h.y / TILE) * 160 + Math.floor(h.x / TILE)) && Math.abs(h.x - t.x) < 40).length;
        return { kind: "tower", id: t.id, stage: t.stage, hp: t.hp, guards };
      }
    }
  }

  private forgeInfo(): Snapshot["forge"] {
    const w = this.world;
    const c = w.colony;
    const nameOf = (id: string) => FORGE_ITEMS.find((f) => f.id === id);
    return {
      queue: c.queue.map((id) => ({ id, name: nameOf(id)?.name ?? id, icon: nameOf(id)?.icon ?? "⚒️", ok: c.canCraft(w, id) })),
      armory: Object.entries(c.armory)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => ({ id, name: nameOf(id)?.name ?? id, icon: nameOf(id)?.icon ?? "⚒️", n })),
      items: FORGE_ITEMS.map((f) => {
        const done = f.cat === "kits" && c.kits.has(f.id);
        const can = c.canCraft(w, f.id);
        const why = done ? "Done ✓" : can ? null : f.tech && !w.camp.learned.has(f.tech) ? `Invent ${f.tech}` : f.at === "blacksmith" ? "Needs a Blacksmith" : f.at === "workshop" ? "Needs a Workshop" : f.at === "tannery" ? "Needs a Hide rack" : null;
        return { id: f.id, name: f.name, icon: f.icon, tier: f.tier, cost: f.cost, at: f.at, can, why, cat: f.cat, tip: f.tip, fresh: c.fresh.has(f.id), done };
      }),
      hasTannery: c.finished("tannery"),
      hasWorkshop: c.finished("workshop"),
      hasSmith: c.finished("blacksmith"),
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
        const d = raid.by === "brute" ? w.rivals.byId(id) : w.dinoById(id);
        if (d && (d.kind === "brute" ? d.raid || d.captive > 0 : d.raider)) {
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
      raid: raid ? { phase: raid.phase, label: raid.label, left, x: rx, y: ry, t: raid.t, brutes: raid.by === "brute" } : null,
      people: w.humans.map((h) => ({ id: h.id, name: h.name, child: h.child, role: h.role, autoRole: h.autoRole, state: h.state, hp: h.hp, condition: condition(h), task: w.tasks.get(h.taskId)?.label ?? null, stranger: h.stranger })),
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
