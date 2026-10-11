/* ------------------------------------------------------------------ */
/*  World: owns every entity + environment system and steps them in   */
/*  a fixed order. No DOM, no React: render/audio/UI read from it and  */
/*  drain `events`. That keeps it testable headless in Node.           */
/* ------------------------------------------------------------------ */
import { DISCOVERY_BY_ID, FACTS } from "../data/facts";
import { SPECIES, sp } from "../data/species";
import { actDino, knock, lookUp, thinkDino } from "./behavior";
import { Camp } from "./camp";
import { addDino, findSpawnSpot, isBaby, moveDino, setState, sizeOf, spawnGroup } from "./dinos";
import { RandomEvents } from "./events";
import { FireSystem } from "./fire";
import { addHuman, say, setHumanState, updateHuman } from "./humans";
import { P, Particles } from "./particles";
import { burnPlantsAt, generatePlants, makePlant, plantFuelNear, tallestNear, updatePlants, PLANT_H } from "./plants";
import { makeRng, type Rng } from "./rng";
import { SpatialHash } from "./spatial";
import { LM, Terrain, VEG_TILES, cliffY, isWaterTile } from "./terrain";
import {
  MAP_W,
  T,
  TILE,
  WORLD_H,
  WORLD_W,
  type Campfire,
  type Creature,
  type Dino,
  type Egg,
  type FishSchool,
  type GameEvent,
  type Human,
  type Item,
  type ItemKind,
  type Plant,
  type Prop,
  type Shelter,
  type SpeciesId,
} from "./types";
import { LavaSystem, Volcano } from "./volcano";
import { Weather } from "./weather";
import { Tribe } from "./tribe";
import { announceBirth, baseGenes, evolveWorld, inherit, type SpeciesEvo } from "./genetics";
import { Nav } from "./nav";
import { Colony } from "./colony";
import { Civ } from "./civ";
import { Extinction } from "./extinction";
import { Mine } from "./mine";
import { updateCrew } from "./miners";
import { updateDeepBuilds } from "./deepBuild";
import { updateDeepLife } from "./deepLife";
import { Snow } from "./snow";
import { Dragons } from "./dragons";
import { Rivals } from "./rivals";
import { TaskBoard } from "./tasks";
import { Population } from "./population";
import { Trails } from "./trails";
import { sites, type Site } from "./build";
import { HOUSING } from "../data/colony";
import { hurtHuman } from "./injury";
import { updateCarcass } from "./carcass";
import type { Carcass } from "./types";
import type { Gear, ShelterPlan } from "./types";

/** Save format version. v1 = before the colony upgrade (still loads). */
export const SAVE_VERSION = 2;

/** 24 in-game hours take this many real seconds at 1× speed. */
export const DAY_SECONDS = 420;

export interface Meteor {
  x: number;
  y: number;
  t: number;
  dur: number;
  /** 1 = a normal meteor; shower rocks start tiny and grow */
  size?: number;
  /** part of a shower: no toast, nobody stops to stare */
  quiet?: boolean;
}

export interface Bolt {
  x: number;
  y: number;
  t: number;
  seed: number;
}

export interface Poi {
  x: number;
  y: number;
  t: number;
}

const MAX_DINOS = 110;

export class World {
  seed: number;
  rng: Rng;
  terrain: Terrain;
  private idCounter = 1;

  /** hours, 0..24 */
  time = 9;
  day = 1;
  timeSpeed = 1;
  timePaused = false;
  elapsed = 0;
  daylight = 1;

  dinos: Dino[] = [];
  humans: Human[] = [];
  items: Item[] = [];
  eggs: Egg[] = [];
  plants: Plant[] = [];
  props: Prop[] = [];
  shelters: Shelter[] = [];
  campfires: Campfire[] = [];
  schools: FishSchool[] = [];
  meteors: Meteor[] = [];
  bolts: Bolt[] = [];
  pois: Poi[] = [];
  quake = 0;

  particles = new Particles();
  fire = new FireSystem();
  lava = new LavaSystem();
  volcano = new Volcano();
  weather = new Weather();
  camp: Camp;
  tribe = new Tribe();
  randomEvents = new RandomEvents();
  nav = new Nav();
  trails = new Trails();
  colony = new Colony();
  snow = new Snow();
  dragons = new Dragons();
  /** Neanderthal clans (CPU rivals) */
  rivals = new Rivals();
  tasks = new TaskBoard();
  population = new Population();
  civ = new Civ();
  extinction = new Extinction();
  /** The Deep: the mine under the cave (its own grid + random numbers) */
  mine: Mine;
  /** bumps when huts appear / change footprint (nav) */
  shelterVersion = 0;
  /** frames simulated (for staggering occasional checks) */
  frame = 0;
  /** when the save this world came from was written (0 = brand new world) */
  savedAt = 0;
  /** shared hammering timers per construction site */
  workT = new Map<string, number>();
  private sitesCache: { t: number; list: Site[] } = { t: -1, list: [] };
  /** per-species evolution progress */
  evo: Partial<Record<SpeciesId, SpeciesEvo>> = {};
  evoLeaps = 0;
  /** evolve a million years every couple of minutes by itself */
  evoAuto = false;
  private evoT = 0;

  creatureHash = new SpatialHash<Creature>(128);
  plantHash = new SpatialHash<Plant>(96);
  plantsDirty = true;
  visiblePlants: Plant[] = [];
  herdCenters = new Map<number, { x: number; y: number; n: number }>();

  /** camera center + visible rect (set by the engine; used for LOD) */
  camX = LM.camp.x * TILE;
  camY = LM.camp.y * TILE;
  view = { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H };

  events: GameEvent[] = [];
  discoveries = new Set<string>();
  unlocked = new Set<SpeciesId>();
  seen = new Set<SpeciesId>();
  flags = new Set<string>();

  private byId = new Map<number, Creature>();

  constructor(seed: number, populate = true) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.terrain = new Terrain(seed);
    this.camp = new Camp(seed);
    this.mine = new Mine(seed);
    this.fire.initFuel(this);
    this.snow.init(this);
    for (const s of SPECIES) if (s.starter) this.unlocked.add(s.id);
    if (populate) this.populate();
  }

  /** Construction sites (cached per frame: several builders ask every tick). */
  buildSites(): Site[] {
    if (this.sitesCache.t !== this.elapsed) this.sitesCache = { t: this.elapsed, list: sites(this) };
    return this.sitesCache.list;
  }

  nextId() {
    return this.idCounter++;
  }

  /* ---------------------------- setup ---------------------------- */

  private populate() {
    generatePlants(this);
    const at = (p: { x: number; y: number }) => ({ x: p.x * TILE, y: p.y * TILE });
    const g = (s: SpeciesId, p: { x: number; y: number }, n: number) => {
      const c = at(p);
      const list = spawnGroup(this, s, c.x, c.y, n);
      for (const d of list) {
        d.homeX = c.x;
        d.homeY = c.y;
      }
      return list;
    };
    const trikes = g("trike", { x: 112, y: 56 }, 4);
    const paras = g("para", { x: 92, y: 72 }, 5);
    g("stego", { x: 122, y: 66 }, 3);
    g("brachio", { x: 44, y: 48 }, 3);
    g("apato", { x: 100, y: 76 }, 2);
    g("ankylo", { x: 146, y: 58 }, 2);
    g("iguano", { x: 62, y: 72 }, 4);
    g("pachy", { x: 132, y: 50 }, 3);
    g("trex", { x: 116, y: 40 }, 1);
    g("raptor", { x: 34, y: 30 }, 3);
    g("allo", { x: 22, y: 62 }, 1);
    g("carno", { x: 146, y: 38 }, 1);
    g("dilo", { x: 18, y: 74 }, 2);
    g("spino", { x: 108, y: 86 }, 1);
    g("compy", { x: 46, y: 62 }, 5);
    g("mosa", { x: 30, y: 100 }, 1);
    g("mosa", { x: 120, y: 106 }, 1);
    g("ptera", { x: 90, y: 24 }, 4);
    g("dimorpho", { x: 24, y: 18 }, 3);
    // a few babies tagging along
    for (const herd of [trikes, paras]) {
      const mum = herd[0];
      if (!mum) continue;
      for (let i = 0; i < 2; i++) {
        addDino(this, mum.species, mum.x + 30 + i * 14, mum.y + 16, { growth: 0.1 + this.rng() * 0.2, parent: mum.id, herd: mum.herd, homeX: mum.homeX, homeY: mum.homeY });
      }
    }
    // eggs in the nest
    for (const s of ["trike", "para", "stego"] as SpeciesId[]) {
      const a = this.rng() * Math.PI * 2;
      this.addEgg(s, LM.nest.x * TILE + Math.cos(a) * 50, LM.nest.y * TILE + Math.sin(a) * 30, 0, 0, 40 + this.rng() * 60);
    }

    // cave people: start small, one family (two grown-ups + a kid); the tribe grows from there
    const fam = this.nextId();
    for (let i = 0; i < 3; i++) {
      addHuman(this, this.camp.x + (this.rng() - 0.5) * 160, this.camp.y + (this.rng() - 0.5) * 80, i >= 2, { family: fam });
    }
    this.camp.stock.stick = 3;
    this.camp.stock.stone = 2;
    this.colony.generateNodes(this);

    // props + secrets
    for (let i = 0; i < 3; i++) this.addProp("boulder", this.camp.x - 160 + i * 50 + this.rng() * 30, this.camp.y - 40 + this.rng() * 40);
    this.addProp("fossilDig", LM.fossil.x * TILE, LM.fossil.y * TILE);
    this.addProp("painting", LM.secretCave.x * TILE + TILE / 2, (Math.round(cliffY(LM.secretCave.x, this.seed)) + 1) * TILE + 6);
    this.addProp("goldEgg", LM.glade.x * TILE, LM.glade.y * TILE);
    this.addProp("nest", LM.nest.x * TILE, LM.nest.y * TILE, 1);

    // fish
    const fishSpots: [number, number][] = [
      [LM.lake.x, LM.lake.y],
      [LM.lake.x - 6, LM.lake.y + 2],
      [30, 98],
      [60, 104],
      [110, 106],
      [140, 104],
      [86, 92],
    ];
    for (const [x, y] of fishSpots) this.addSchool(x * TILE, y * TILE);
  }

  addProp(kind: Prop["kind"], x: number, y: number, size = 1) {
    const p: Prop = { id: this.nextId(), kind, x, y, size, variant: Math.floor(this.rng() * 4) };
    this.props.push(p);
    return p;
  }

  addSchool(x: number, y: number) {
    if (!isWaterTile(this.terrain.tileAt(x, y))) {
      const t = this.terrain.findTile(x, y, 200, (t) => t === T.Deep || t === T.Shallow, this.rng);
      if (!t) return null;
      x = t.x;
      y = t.y;
    }
    const s: FishSchool = { id: this.nextId(), x, y, vx: 0, vy: 0, n: 6 + Math.floor(this.rng() * 5), t: this.rng() * 10 };
    this.schools.push(s);
    return s;
  }

  addItem(kind: ItemKind, x: number, y: number, o: Partial<Item> = {}): Item {
    const it: Item = { id: this.nextId(), kind, x, y, z: 0, vz: 0, t: 0, amount: 1, claimed: 0, ...o };
    this.items.push(it);
    if (this.items.length > 220) {
      const old = this.items.findIndex((i) => i.kind === "poop" || i.kind === "fruit");
      this.items.splice(old >= 0 ? old : 0, 1);
    }
    if (kind !== "poop") this.pois.push({ x, y, t: this.elapsed });
    return it;
  }

  removeItem(it: Item) {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  addEgg(species: SpeciesId, x: number, y: number, herd: number, parent: number, hatchIn = 60 + this.rng() * 40) {
    // genes come from mum + the nearest grown-up of the same species
    const mum = parent ? this.dinoById(parent) : null;
    let mate: Dino | null = null;
    let md = 900;
    let any: Dino | null = null;
    for (const d of this.dinos) {
      if (d.species !== species || d === mum || d.growth < 1) continue;
      any = any ?? d;
      const dist = mum ? Math.hypot(d.x - mum.x, d.y - mum.y) : 0;
      if (dist < md) {
        md = dist;
        mate = d;
      }
    }
    const a = mum ?? mate ?? any;
    const genes = a ? inherit(this.rng, a.genes, mum ? mate?.genes ?? null : any?.genes ?? null) : baseGenes(this.rng);
    const gen = (a?.gen ?? 0) + 1;
    const e: Egg = { id: this.nextId(), species, x, y, t: 0, hatchAt: hatchIn, herd, parent, genes, gen };
    this.eggs.push(e);
    return e;
  }

  removeDino(d: Dino) {
    const i = this.dinos.indexOf(d);
    if (i >= 0) this.dinos.splice(i, 1);
    this.byId.delete(d.id);
    this.events.push({ type: "removed", id: d.id });
  }

  /* ---------------------------- lookups ---------------------------- */

  dinoById(id: number): Dino | null {
    const c = this.byId.get(id);
    return c && c.kind === "dino" ? c : null;
  }
  creatureById(id: number): Creature | null {
    return this.byId.get(id) ?? null;
  }
  itemById(id: number) {
    if (!id) return null;
    for (const it of this.items) if (it.id === id) return it;
    return null;
  }
  plantById(id: number) {
    if (!id) return null;
    for (const p of this.plants) if (p.id === id) return p;
    return null;
  }

  inView(x: number, y: number, margin = 0) {
    const v = this.view;
    return x > v.x0 - margin && x < v.x1 + margin && y > v.y0 - margin && y < v.y1 + margin;
  }

  canLayEgg(s: SpeciesId) {
    if (this.dinos.length + this.eggs.length >= MAX_DINOS) return false;
    let n = 0;
    for (const d of this.dinos) if (d.species === s) n++;
    for (const e of this.eggs) if (e.species === s) n++;
    return n < (sp(s).diet === "herbivore" ? 7 : 3);
  }

  plantFuelNear(x: number, y: number) {
    return plantFuelNear(this, x, y);
  }
  burnPlantsAt(x: number, y: number, amt: number) {
    burnPlantsAt(this, x, y, amt);
  }

  /* ---------------------------- events ---------------------------- */

  sfx(sound: string, x: number, y: number, vol = 1, pitch = 1) {
    this.events.push({ type: "sfx", sound, x, y, vol, pitch });
  }
  toast(icon: string, text: string, x?: number, y?: number, fact?: string) {
    this.events.push({ type: "toast", icon, text, x, y, fact });
  }
  shake(amount: number, time: number) {
    this.events.push({ type: "shake", amount, time });
  }
  flash(amount: number, color: string) {
    this.events.push({ type: "flash", amount, color });
  }
  discover(id: string, x?: number, y?: number) {
    if (this.discoveries.has(id) || !DISCOVERY_BY_ID[id]) return;
    this.discoveries.add(id);
    this.events.push({ type: "discover", id });
    void x;
    void y;
  }
  /** Mark a species as met (unlocks it in the toy box). */
  meet(s: SpeciesId) {
    this.seen.add(s);
    if (!this.unlocked.has(s)) {
      this.unlocked.add(s);
      this.events.push({ type: "unlock", species: s });
    }
    if (this.seen.size === SPECIES.length) this.discover("allSpecies");
  }
  say(humanId: number, text: string) {
    const h = this.byId.get(humanId);
    if (h && h.kind === "human") say(h, text);
  }
  celebrate(text: string) {
    for (const h of this.humans) {
      if (Math.hypot(h.x - this.camp.x, h.y - this.camp.y) > 700 || h.state === "hide" || h.state === "sleep") continue;
      setHumanState(h, "celebrate");
      say(h, text, 3);
    }
    this.sfx("cheer", this.camp.x, this.camp.y, 0.9);
  }

  /** Frighten everyone within r; optionally make them run. */
  alarm(x: number, y: number, r: number, fear: number, icon: string, flee = false) {
    for (const d of this.dinos) {
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist > r || d.state === "carried") continue;
      d.fear = Math.min(1, d.fear + fear * (1 - dist / r) + 0.1);
      if (fear > 0.3 && d.state !== "flee") d.emote = { icon, t: 1.6 };
      if (d.state === "sleep") setState(d, "idle");
      if (flee && sp(d.species).move === "walk" && d.state !== "knocked") {
        const a = Math.atan2(d.y - y, d.x - x);
        setState(d, "flee", d.x + Math.cos(a) * 600, d.y + Math.sin(a) * 600);
      }
      d.think = Math.min(d.think, 0.1);
    }
    for (const h of this.humans) {
      if (Math.hypot(h.x - x, h.y - y) > r) continue;
      if (h.state !== "hide") h.think = 0;
      if (fear > 0.5) say(h, "Aaah!");
    }
  }

  /** A spear-waving cave person scares a predator off. */
  scare(d: Dino, fx: number, fy: number) {
    const a = Math.atan2(d.y - fy, d.x - fx);
    setState(d, "flee", d.x + Math.cos(a) * 400, d.y + Math.sin(a) * 400);
    d.emote = { icon: "😨", t: 1.5 };
  }

  knock(x: number, y: number, r: number) {
    for (const d of this.dinos) if (Math.hypot(d.x - x, d.y - y) < r + sizeOf(d) * 0.3 && sp(d.species).move === "walk") knock(this, d, 1.6);
  }

  /* ------------------------- disasters ------------------------- */

  lightning(x: number, y: number, manual: boolean) {
    const tree = tallestNear(this, x, y, manual ? 70 : 220);
    if (tree) {
      x = tree.x;
      y = tree.y;
    }
    this.bolts.push({ x, y, t: 0, seed: Math.floor(this.rng() * 1e6) });
    this.flash(0.55, "#e8f0ff");
    this.sfx("thunder", x, y, 1.2);
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tree) {
      tree.shake = 1;
      tree.burnt = Math.min(1, tree.burnt + 0.5);
    }
    // in heavy rain strikes rarely start fires
    if (this.rng() > this.weather.rain * 0.7) this.fire.ignite(this, tx, ty, 0.9);
    this.particles.burst(P.Spark, x, y, 14, 120, { vz: 100, g: 200, size: 2, max: 0.6, color: "#fffbe0" });
    this.alarm(x, y, 650, 0.8, "⚡", false);
    for (const d of this.dinos) {
      if (Math.hypot(d.x - x, d.y - y) < 260 && sp(d.species).move === "walk" && d.state !== "carried") {
        const a = Math.atan2(d.y - y, d.x - x);
        setState(d, "flee", d.x + Math.cos(a) * 400, d.y + Math.sin(a) * 400);
      }
    }
    if (manual || this.inView(x, y)) {
      this.discover("lightning", x, y);
      if (!this.flags.has("boltFact")) {
        this.flags.add("boltFact");
        this.toast("⚡", "ZAP! Lightning can set trees on fire.", x, y, FACTS.lightning);
      }
    }
  }

  meteor(x: number, y: number, size = 1, quiet = false) {
    const dur = 2 + Math.min(1.2, size * 1.2);
    this.meteors.push({ x, y, t: 0, dur, size, quiet });
    this.sfx("whoosh", x, y, Math.min(1, 0.3 + size * 0.7), 1.3 - Math.min(0.6, size * 0.4));
    if (quiet) return;
    // everyone looks up!
    for (const d of this.dinos) if (Math.hypot(d.x - x, d.y - y) < 1800) lookUp(d);
    for (const h of this.humans) {
      if (Math.hypot(h.x - x, h.y - y) < 1800 && h.state !== "hide" && h.state !== "sleep") {
        setHumanState(h, "lookUp");
        say(h, "?!", dur);
      }
    }
  }

  private impact(m: Meteor) {
    const { x, y } = m;
    const S = m.size ?? 1;
    // a direct hit on the volcano wakes something enormous
    if (!m.quiet && S >= 1 && Math.hypot(x - this.volcano.x, (y - this.volcano.y) * 1.3) < 430 && this.volcano.phase === "idle") {
      this.volcano.mega(this);
    }
    this.crush(x, y, 120 * S, 0.5 * Math.min(1.6, S));
    this.shake(Math.min(26, 18 * S), 0.6 + S * 0.8);
    // shower rocks only flash the screen when they get big (and softly), so the view stays readable
    if (m.quiet ? S > 1 : S > 0.35) this.flash(m.quiet ? 0.22 : Math.min(0.8, 0.25 + S * 0.5), "#fff1d0");
    this.sfx("boom", x, y, Math.min(1.8, 0.5 + S * 1.1), 1.4 - Math.min(0.8, S * 0.5));
    this.particles.spawn(P.Ring, x, y, { size: 30 * S, max: 1.4, color: "rgba(255,240,200,0.9)" });
    this.particles.burst(P.Dust, x, y, Math.round(8 + 22 * S), 220 * S, { size: 18 * Math.max(0.4, S), max: 2, color: "rgba(150,120,90,0.6)" });
    this.particles.burst(P.Rock, x, y, Math.round(5 + 11 * S), 200 * S, { vz: 160, g: 260, size: 4 * Math.max(0.5, S), max: 1.6, color: "#5a4a40" });
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const CR = Math.max(1, 3.2 * S);
    for (let dy = -Math.ceil(CR); dy <= Math.ceil(CR); dy++) {
      for (let dx = -Math.ceil(CR); dx <= Math.ceil(CR); dx++) {
        const d = Math.hypot(dx, dy);
        if (d > CR) continue;
        const t = this.terrain.tiles[(ty + dy) * MAP_W + tx + dx];
        if (t === undefined || t === T.Mountain || isWaterTile(t)) continue;
        if (d < CR * 0.56) this.terrain.setTile(tx + dx, ty + dy, T.Basalt);
        else if (VEG_TILES.has(t)) this.terrain.setTile(tx + dx, ty + dy, T.Dirt);
        if (d >= CR * 0.56) this.fire.ignite(this, tx + dx, ty + dy, 0.8);
      }
    }
    burnPlantsAt(this, x, y, Math.min(1, S));
    for (const p of this.plants) if (Math.hypot(p.x - x, p.y - y) < 140 * S) p.shake = 1;
    for (const d of this.dinos) {
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < 90 * S) d.health -= 0.6 * Math.min(1.5, S);
      if (dist < 380 * S && sp(d.species).move === "walk") {
        knock(this, d, 2.2);
        const a = Math.atan2(d.y - y, d.x - x);
        d.x += Math.cos(a) * 40;
        d.y += Math.sin(a) * 30;
      }
    }
    for (const h of this.humans) if (!h.under && Math.hypot(h.x - x, h.y - y) < 300 * S && h.state !== "down") {
      if (Math.hypot(h.x - x, h.y - y) < 140 * S) hurtHuman(this, h, 0.4 * Math.min(1.5, S), x, y, "rock");
      if (h.hp <= 0) continue;
      h.level = 0;
      h.state = "tossed";
      h.vx = Math.sign(h.x - x || 1) * 100;
      h.vy = 0;
      h.vz = 160;
      h.z = 2;
    }
    this.alarm(x, y, 1600 * Math.min(1, S + 0.2), 1, "😱", true);
    if (m.quiet) return;
    this.discover("meteor", x, y);
    this.toast("☄️", "METEOR IMPACT!", x, y, FACTS.meteor);
  }

  private healT = 0;

  /**
   * Ground that was ashed over (eruptions, meteors) slowly turns green again.
   * Rock, lava rock, water and anything people built on stay as they are.
   */
  private healLand(dt: number) {
    this.healT -= dt;
    if (this.healT > 0) return;
    // a supervolcano wasteland stays dead until the ash thins
    if (this.extinction.wasteland) return;
    this.healT = 1;
    const tiles = this.terrain.tiles;
    const base = this.terrain.base;
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(this.rng() * tiles.length);
      if (tiles[i] !== T.Dirt || !VEG_TILES.has(base[i] as T)) continue;
      if (this.fire.heat[i] > 0 || this.lava.heat[i] > 0 || this.fire.scorched.has(i)) continue;
      const x = (i % MAP_W) * TILE + TILE / 2;
      const y = Math.floor(i / MAP_W) * TILE + TILE / 2;
      if (Math.hypot(x - this.camp.x, y - this.camp.y) < 420) continue;
      if (this.rng() > 0.35) continue;
      this.terrain.setTile(i % MAP_W, Math.floor(i / MAP_W), base[i] as T);
      // and something sprouts there
      if (this.rng() < 0.4) {
        this.plants.push(makePlant(this, this.rng() < 0.5 ? "fern" : "bush", x + (this.rng() - 0.5) * 20, y + (this.rng() - 0.5) * 20, 0.15));
        this.plantsDirty = true;
      }
    }
  }

  /** Something heavy landed: walls, towers, homes + buildings nearby take damage. */
  crush(x: number, y: number, r: number, power: number) {
    for (const wl of this.tribe.walls) {
      if (wl.built < 1) continue;
      const d = Math.hypot(wl.tx * TILE + 16 - x, wl.ty * TILE + 16 - y);
      if (d < r) wl.hp -= (1 - d / r) * power * 500 * (wl.kind === "polygon" ? 0.35 : wl.kind === "stone" ? 0.5 : 1);
    }
    for (const t of this.tribe.towers) if (Math.hypot(t.x - x, t.y - y) < r) t.hp -= power * 260;
    for (const s of this.shelters) if (s.stage > 0 && Math.hypot(s.x - x, s.y - y) < r) s.hp -= power * (1 - HOUSING[s.tier].protect * 0.6);
    for (const b of this.colony.buildings) if (Math.hypot(b.x - x, b.y - y) < r) b.hp -= power * 220 * (b.kind === "pyramid" || b.kind === "shelterDeep" ? 0.2 : 1);
    for (const sc of this.colony.scorpions) if (Math.hypot(sc.x - x, sc.y - y) < r) sc.hp -= power * 200;
  }

  startQuake() {
    this.quake = 4.5;
    this.shake(10, 4.5);
    this.sfx("rumble", this.camX, this.camY, 1.4);
    this.alarm(this.camX, this.camY, 4000, 0.6, "😵", false);
    if (!this.flags.has("quakeFact")) {
      this.flags.add("quakeFact");
      this.toast("🫨", "Earthquake! Everything's wobbling!", undefined, undefined, FACTS.quake);
    }
  }

  /* ---------------------------- update ---------------------------- */

  update(dt: number) {
    this.elapsed += dt;
    this.frame++;
    if (!this.timePaused) {
      this.time += (dt * 24 * this.timeSpeed) / DAY_SECONDS;
      if (this.time >= 24) {
        this.time -= 24;
        this.day++;
      }
    }
    this.daylight = daylightAt(this.time);

    this.weather.update(this, dt);
    this.nav.budget = 24000;
    this.nav.sync(this);

    // spatial structures
    this.byId.clear();
    for (const d of this.dinos) this.byId.set(d.id, d);
    for (const h of this.humans) this.byId.set(h.id, h);
    this.creatureHash.clear();
    for (const d of this.dinos) if (d.state !== "carried") this.creatureHash.insert(d);
    for (const h of this.humans) if (h.state !== "hide") this.creatureHash.insert(h);
    if (this.plantsDirty) {
      this.plantHash.rebuild(this.plants);
      this.plantsDirty = false;
    }
    this.herdCenters.clear();
    for (const d of this.dinos) {
      if (!d.herd || isBaby(d)) continue;
      const c = this.herdCenters.get(d.herd);
      if (c) {
        c.x += d.x;
        c.y += d.y;
        c.n++;
      } else this.herdCenters.set(d.herd, { x: d.x, y: d.y, n: 1 });
    }
    this.herdCenters.forEach((c) => {
      c.x /= c.n;
      c.y /= c.n;
    });

    // creatures: brains are throttled, bodies move every frame
    for (let i = this.dinos.length - 1; i >= 0; i--) {
      const d = this.dinos[i];
      if (!d) continue;
      d.think -= dt;
      if (d.think <= 0) thinkDino(this, d);
      moveDino(this, d, dt);
      if (this.dinos[i] === d) actDino(this, d, dt);
    }
    for (const h of this.humans) if (!h.under) updateHuman(this, h, dt);
    this.camp.update(this, dt);
    this.tribe.update(this, dt);
    this.colony.update(this, dt);
    this.dragons.update(this, dt);
    this.rivals.update(this, dt);
    this.population.update(this, dt);
    this.civ.update(this, dt);
    this.extinction.update(this, dt);
    this.tasks.update(this, dt);
    this.snow.update(this, dt);
    this.healLand(dt);
    this.mine.update(this, dt);
    updateCrew(this, dt);
    updateDeepBuilds(this, dt);
    updateDeepLife(this, dt);
    if (this.camp.crafting) {
      const by = this.byId.get(this.camp.crafting.by);
      if (!by || by.kind !== "human" || by.state !== "craft") {
        // crafter wandered off: refund + try again later
        this.camp.crafting = null;
      } else this.camp.updateCraft(this, dt);
    }

    this.updateItems(dt);
    this.updateEggs(dt);
    updatePlants(this, dt);
    this.fire.update(this, dt);
    this.lava.update(this, dt);
    this.volcano.update(this, dt);
    this.updateFish(dt);
    this.updateDisasters(dt);
    this.randomEvents.update(this, dt);
    if (this.evoAuto) {
      this.evoT += dt;
      if (this.evoT > 150) {
        this.evoT = 0;
        evolveWorld(this);
      }
    }
    this.particles.update(dt);

    if (this.pois.length > 20) this.pois.splice(0, this.pois.length - 20);
  }

  private updateItems(dt: number) {
    const gone: Item[] = [];
    for (const it of this.items) {
      it.t += dt;
      if (it.z > 0 || it.vz) {
        it.vz -= 300 * dt;
        it.z += it.vz * dt;
        if (it.z <= 0) {
          it.z = 0;
          it.vz = 0;
          if (it.kind === "fruit") this.sfx("plop", it.x, it.y, 0.3);
        }
      }
      if (it.claimed) {
        const c = this.byId.get(it.claimed);
        if (!c || (c.kind === "dino" && c.state !== "eat" && c.state !== "seekFood" && c.state !== "steal")) it.claimed = 0;
      }
      if (it.kind === "carcass") {
        updateCarcass(this, it, dt);
        continue;
      }
      const life = it.kind === "fossil" ? 900 : it.kind === "poop" ? 45 : it.kind === "meat" ? 160 : 130;
      if (it.t > life) {
        gone.push(it);
        // poop feeds the soil: a little plant sprouts
        if (it.kind === "poop") {
          const t = this.terrain.tileAt(it.x, it.y);
          if (VEG_TILES.has(t) || t === T.Dirt || t === T.Sand) {
            this.plants.push(makePlant(this, this.rng() < 0.6 ? "fern" : "bush", it.x, it.y, 0.15));
            this.plantsDirty = true;
            if (!this.flags.has("poopFact") && this.inView(it.x, it.y)) {
              this.flags.add("poopFact");
              this.toast("🌱", "Dino poop helped a new plant grow!", it.x, it.y, FACTS.poop);
            }
          }
        }
      }
      if (this.lava.heatAt(Math.floor(it.x / TILE), Math.floor(it.y / TILE)) > 0.3 && it.kind !== "fossil") gone.push(it);
    }
    if (gone.length) this.items = this.items.filter((i) => !gone.includes(i));
  }

  private updateEggs(dt: number) {
    const hatched: Egg[] = [];
    for (const e of this.eggs) {
      e.t += dt;
      if (e.t >= e.hatchAt) hatched.push(e);
    }
    for (const e of hatched) this.hatch(e);
  }

  hatch(e: Egg) {
    const i = this.eggs.indexOf(e);
    if (i >= 0) this.eggs.splice(i, 1);
    const def = sp(e.species);
    const spot = def.move === "swim" ? findSpawnSpot(this, def, e.x, e.y, 400) : { x: e.x, y: e.y };
    if (!spot) return null;
    const parent = e.parent ? this.dinoById(e.parent) : null;
    const baby = addDino(this, e.species, spot.x, spot.y, { growth: 0, herd: e.herd || parent?.herd || 0, parent: e.parent, hunger: 0.3, homeX: e.x, homeY: e.y, ...(e.genes ? { genes: e.genes, gen: e.gen ?? 1 } : {}) });
    announceBirth(this, baby);
    baby.emote = { icon: "🐣", t: 2.5 };
    this.particles.burst(P.Crumb, e.x, e.y, 10, 50, { vz: 60, g: 200, size: 3, max: 0.8, color: "#f3ead2" });
    this.sfx("crack", e.x, e.y, 0.8);
    this.sfx(def.sound.kind, e.x, e.y, 0.5, def.sound.pitch * 1.8);
    if (this.inView(e.x, e.y, 200)) {
      this.discover("hatch", e.x, e.y);
      if (!this.flags.has("eggFact")) {
        this.flags.add("eggFact");
        this.toast("🐣", `A baby ${def.nick} hatched!`, e.x, e.y, FACTS.egg);
      }
    }
    return baby;
  }

  private updateFish(dt: number) {
    for (const s of this.schools) {
      s.t += dt;
      const a = Math.sin(s.t * 0.3 + s.id) * Math.PI;
      s.vx += (Math.cos(a) * 18 - s.vx) * dt * 0.5;
      s.vy += (Math.sin(a * 1.3) * 10 - s.vy) * dt * 0.5;
      const nx = s.x + s.vx * dt;
      const ny = s.y + s.vy * dt;
      if (isWaterTile(this.terrain.tileAt(nx, ny)) && this.terrain.tileAt(nx, ny) !== T.River) {
        s.x = nx;
        s.y = ny;
      } else {
        s.vx *= -1;
        s.vy *= -1;
        s.t += 3;
      }
      if (s.n < 10 && this.rng() < dt * 0.02) s.n++;
    }
  }

  private updateDisasters(dt: number) {
    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter((b) => b.t < 0.6);
    const hits: Meteor[] = [];
    for (const m of this.meteors) {
      m.t += dt;
      if (m.t >= m.dur) hits.push(m);
    }
    if (hits.length) {
      this.meteors = this.meteors.filter((m) => !hits.includes(m));
      for (const m of hits) this.impact(m);
    }
    if (this.quake > 0) {
      this.quake -= dt;
      for (const d of this.dinos) {
        if (sp(d.species).move !== "walk" || d.state === "knocked" || d.state === "carried") continue;
        if (this.rng() < dt * (isBaby(d) ? 0.5 : 0.15)) knock(this, d, 1.2);
      }
      if (this.rng() < dt * 6) {
        const x = this.camX + (this.rng() - 0.5) * 1600;
        const y = this.camY + (this.rng() - 0.5) * 1000;
        this.particles.spawn(P.Dust, x, y, { vz: 15, size: 16, max: 1.4, color: "rgba(160,140,110,0.45)" });
        const t = this.terrain.tileAt(x, y);
        if ((t === T.Cliff || t === T.Rock || t === T.Mountain) && this.rng() < 0.2) {
          const b = this.addProp("boulder", x, y + TILE, 0.6 + this.rng() * 0.5);
          this.particles.burst(P.Rock, b.x, b.y, 6, 60, { vz: 80, g: 200, size: 3, max: 1, color: "#7a7166" });
        }
      }
    }
  }

  /* ------------------------- player actions ------------------------- */

  placeEgg(species: SpeciesId, x: number, y: number) {
    return this.addEgg(species, x, y, 0, 0, 14 + this.rng() * 6);
  }

  spawnDino(species: SpeciesId, x: number, y: number) {
    if (this.dinos.length >= MAX_DINOS + 20) return null;
    const def = sp(species);
    const spot = findSpawnSpot(this, def, x, y, def.move === "swim" ? 400 : 60);
    if (!spot) return null;
    const near = this.dinos.find((d) => d.species === species && d.herd && Math.hypot(d.x - x, d.y - y) < 500);
    const d = addDino(this, species, spot.x, spot.y, { herd: near?.herd ?? (def.herd > 0.3 ? this.nextId() : 0), homeX: spot.x, homeY: spot.y });
    d.z = def.move === "fly" ? 40 : 30;
    d.emote = { icon: "✨", t: 1.5 };
    this.particles.burst(P.Poof, spot.x, spot.y, 10, 60, { size: 12, max: 0.8, color: "rgba(255,255,255,0.9)" });
    this.sfx("pop", spot.x, spot.y, 0.8);
    this.sfx(def.sound.kind, spot.x, spot.y, 0.7, def.sound.pitch);
    this.pois.push({ x: spot.x, y: spot.y, t: this.elapsed });
    if (def.move === "walk") d.z = 0;
    return d;
  }

  /** Tallest point a plant reaches (for picking + lightning). */
  plantHeight(p: Plant) {
    return PLANT_H[p.kind] * p.size;
  }

  /* --------------------------- save / load --------------------------- */

  serialize() {
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      v: SAVE_VERSION,
      /** wall-clock time of this save (newest save wins on load) */
      savedAt: Date.now(),
      elapsed: r(this.elapsed),
      seed: this.seed,
      time: r(this.time),
      day: this.day,
      timeSpeed: this.timeSpeed,
      timePaused: this.timePaused,
      weather: this.weather.kind,
      weatherAuto: this.weather.auto,
      idCounter: this.idCounter,
      dinos: this.dinos.map((d) => ({
        id: d.id,
        species: d.species,
        name: d.name,
        x: r(d.x),
        y: r(d.y),
        z: r(d.z),
        growth: r(d.growth),
        age: r(d.age),
        hunger: r(d.hunger),
        thirst: r(d.thirst),
        energy: r(d.energy),
        health: r(d.health),
        herd: d.herd,
        parent: d.parent,
        homeX: r(d.homeX),
        homeY: r(d.homeY),
        layT: r(d.layT),
        migrant: d.migrant,
        tier: d.tier,
        genes: { ...d.genes, size: r(d.genes.size), speed: r(d.genes.speed), tough: r(d.genes.tough), hue: r(d.genes.hue) },
        gen: d.gen,
        tame: r(d.tame),
        owner: d.owner,
        warTraining: r(d.warTraining ?? 0),
        warArmor: d.warArmor ?? 0,
      })),
      humans: this.humans.map((h) => ({
        id: h.id,
        name: h.name,
        child: h.child,
        x: r(h.x),
        y: r(h.y),
        hair: h.hair,
        skin: h.skin,
        fur: h.fur,
        role: h.role,
        age: Math.round(h.age),
        hp: r(Math.max(0.05, h.hp)),
        warmth: r(h.warmth),
        gear: h.gear,
        home: h.home,
        family: h.family,
        stranger: h.stranger,
        ...(h.under ? { under: true } : {}),
        ...(h.captive ? { captive: h.captive } : {}),
      })),
      tribe: this.tribe.serialize(),
      rivals: this.rivals.serialize(),
      items: this.items.map((i) => ({ kind: i.kind, x: r(i.x), y: r(i.y), amount: r(i.amount), t: r(i.t), species: i.species, carcass: i.carcass })),
      eggs: this.eggs.map((e) => ({ species: e.species, x: r(e.x), y: r(e.y), t: r(e.t), hatchAt: r(e.hatchAt), herd: e.herd, parent: e.parent, genes: e.genes, gen: e.gen })),
      evo: this.evo,
      evoLeaps: this.evoLeaps,
      evoAuto: this.evoAuto,
      plants: this.plants.map((p) => [p.kind, r(p.x), r(p.y), r(p.size), r(p.food), r(p.burnt), p.fruit, p.stump ? 1 : 0] as const),
      props: this.props.map((p) => ({ kind: p.kind, x: r(p.x), y: r(p.y), size: r(p.size), found: p.found })),
      shelters: this.shelters.map((s) => ({ id: s.id, x: r(s.x), y: r(s.y), stage: s.stage, have: s.have, plan: s.plan, tier: s.tier, hp: r(s.hp), up: s.up, upHave: s.upHave })),
      colony: this.colony.serialize(),
      population: this.population.serialize(),
      civ: this.civ.serialize(),
      extinction: this.extinction.serialize(),
      mine: this.mine.serialize(),
      campfires: this.campfires.map((f) => ({ x: r(f.x), y: r(f.y), lit: f.lit, fuel: r(f.fuel) })),
      trails: this.trails.serialize(),
      trailDetail: this.trails.serializeDetail(),
      lightLinks: this.trails.lightLinks,
      camp: { stock: this.camp.stock, learned: Array.from(this.camp.learned), goal: this.camp.goal },
      edits: this.terrain.edits(),
      discoveries: Array.from(this.discoveries),
      unlocked: Array.from(this.unlocked),
      seen: Array.from(this.seen),
      flags: Array.from(this.flags).filter((flag) => flag !== "rallyDinos"),
    };
  }

  static deserialize(data: SaveData): World {
    const w = new World(data.seed, false);
    w.savedAt = data.savedAt ?? 0;
    w.elapsed = data.elapsed ?? 0;
    w.time = data.time;
    w.day = data.day;
    w.timeSpeed = data.timeSpeed ?? 1;
    w.timePaused = !!data.timePaused;
    w.weather.kind = data.weather;
    w.weather.auto = data.weatherAuto ?? true;
    w.terrain.applyEdits(data.edits ?? []);
    w.fire.initFuel(w);
    w.snow.init(w);
    w.idCounter = Math.max(data.idCounter ?? 1, 1);
    for (const s of data.dinos) {
      if (!SPECIES.some((x) => x.id === s.species)) continue;
      const d = addDino(w, s.species, s.x, s.y, { ...s });
      d.id = s.id;
    }
    for (const h of data.humans) {
      const hu = addHuman(w, h.x, h.y, h.child, {
        name: h.name,
        hair: h.hair,
        skin: h.skin,
        fur: h.fur,
        role: h.role ?? "auto",
        age: h.age ?? (h.child ? 0 : 400),
        hp: h.hp ?? 1,
        warmth: h.warmth ?? 1,
        gear: (h.gear as Gear | undefined) ?? { weapon: null, shield: 0 },
        home: h.home ?? 0,
        family: h.family ?? 0,
        stranger: !!h.stranger,
        ...((h as { captive?: number }).captive ? { captive: (h as { captive?: number }).captive, state: "captive" as const } : {}),
      });
      hu.id = h.id;
    }
    for (const i of data.items) {
      const carcass = (i as { carcass?: Carcass }).carcass;
      if (i.kind === "carcass" && !carcass) continue;
      w.addItem(i.kind, i.x, i.y, { amount: i.amount, t: i.t, species: i.species, ...(carcass ? { carcass: { ...carcass, max: { ...carcass.max } } } : {}) });
    }
    for (const e of data.eggs) w.eggs.push({ id: w.nextId(), ...e });
    for (const [kind, x, y, size, food, burnt, fruit, stump] of data.plants) {
      const p = makePlant(w, kind, x, y, size);
      p.food = food;
      p.burnt = burnt;
      p.fruit = fruit;
      p.stump = !!stump;
      w.plants.push(p);
    }
    w.plantsDirty = true;
    for (const p of data.props) {
      const pr = w.addProp(p.kind, p.x, p.y, p.size);
      pr.found = p.found;
    }
    for (const s of data.shelters) {
      // v1 huts were all the 4-stage wooden hut
      const plan: ShelterPlan = (s.plan as ShelterPlan | undefined) ?? "hut";
      w.shelters.push({ id: s.id ?? w.nextId(), x: s.x, y: s.y, stage: s.stage, have: s.have, plan, tier: s.tier ?? (plan === "tent" ? 0 : 2), hp: s.hp ?? 1, up: !!s.up, upHave: s.upHave ?? {} });
    }
    w.colony.load(w, data.colony);
    w.population.load(data.population);
    w.civ.load(data.civ);
    w.extinction.load(data.extinction);
    w.mine.load(data.mine);
    // people down the mine stay down (anyone the mine lost track of comes back up)
    const crew = new Set(w.mine.crew.map((m) => m.id));
    for (const h of w.humans) {
      h.under = crew.has(h.id) && !!(data.humans.find((x) => x.id === h.id) as { under?: boolean } | undefined)?.under;
      if (h.under) h.state = "hide";
    }
    w.mine.crew = w.mine.crew.filter((m) => w.humans.some((h) => h.id === m.id && h.under));
    for (const f of data.campfires) w.campfires.push({ id: w.nextId(), ...f, cook: 0 });
    w.camp.stock = { ...w.camp.stock, ...data.camp.stock };
    w.tribe.load(w, data.tribe);
    w.rivals.load(w, (data as { rivals?: ReturnType<Rivals["serialize"]> }).rivals);
    w.evo = data.evo ?? {};
    w.evoLeaps = data.evoLeaps ?? 0;
    w.evoAuto = !!data.evoAuto;
    w.camp.learned = new Set(data.camp.learned);
    w.camp.goal = data.camp.goal;
    w.camp.pickGoal();
    w.discoveries = new Set(data.discoveries);
    w.unlocked = new Set(Array.from(w.unlocked).concat(data.unlocked));
    w.seen = new Set(data.seen);
    w.flags = new Set(data.flags);
    // fresh fish each session
    const fishSpots: [number, number][] = [
      [LM.lake.x, LM.lake.y],
      [30, 98],
      [60, 104],
      [110, 106],
      [140, 104],
    ];
    for (const [x, y] of fishSpots) w.addSchool(x * TILE, y * TILE);
    w.pois = [];
    w.events = [];
    // make sure ids never collide after load
    let maxId = w.idCounter;
    for (const c of [...w.dinos, ...w.humans, ...w.shelters]) maxId = Math.max(maxId, c.id);
    w.idCounter = maxId + 1;
    // homes saved by id: drop any that no longer exist
    for (const h of w.humans) if (h.home && !w.shelters.some((s) => s.id === h.home)) h.home = 0;
    w.nav.sync(w);
    // New saves keep the exact strings the player drew. Older saves infer
    // their deliberate torch routes from placement order.
    if (data.lightLinks) w.trails.loadLinks(w, data.lightLinks);
    else {
      const placedTorches: typeof w.colony.buildings = [];
      for (const torch of w.colony.buildings) {
        if (torch.kind !== "boneTorch" || torch.hp <= 0) continue;
        let nearest: typeof torch | null = null;
        let best = 220;
        for (const previous of placedTorches) {
          const distance = Math.hypot(previous.x - torch.x, previous.y - torch.y);
          if (distance < best) { best = distance; nearest = previous; }
        }
        if (nearest) w.trails.connect(w, nearest.x, nearest.y, torch.x, torch.y);
        placedTorches.push(torch);
      }
    }
    w.nav.sync(w);
    return w;
  }
}

export type SaveData = ReturnType<World["serialize"]>;

/** 0 at night, 1 at noon-ish, with soft dawn/dusk ramps. */
export function daylightAt(h: number) {
  if (h < 5 || h >= 20.5) return 0;
  if (h < 7) return (h - 5) / 2;
  if (h < 18.5) return 1;
  return 1 - (h - 18.5) / 2;
}

export { WORLD_H, WORLD_W };
