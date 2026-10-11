/* ------------------------------------------------------------------ */
/*  The Deep: the mine under the cave (Phase 1: the rules).            */
/*                                                                    */
/*  A side-on grid (MINE_W x MINE_H). Generated once from the world   */
/*  seed: rock by depth band, natural caverns, a groundwater barrier  */
/*  on top, magma at the bottom and the lift shaft down one side.     */
/*  What a cell holds (ore, a spring, a weak roof, gas, a fossil…) is */
/*  only revealed when it's dug or scanned, like MinerVGA.            */
/*                                                                    */
/*  It keeps its OWN random numbers, so nothing that happens down     */
/*  here changes the surface simulation.                              */
/* ------------------------------------------------------------------ */
import {
  BLAST_COST,
  CAVE_IN,
  CRACK_CHANCE,
  FEATURES,
  FEATURE_ORDER,
  FIND_AMOUNT,
  LANTERN,
  SOFT_ROCK,
  ORE_HITS,
  POOLS,
  PICK_TIERS,
  FLOODED,
  LIFT_MAX,
  LIFT_START,
  LIFT_STEP,
  LIFT_X,
  M,
  MAGMA_FROM,
  MATERIALS,
  MINE_H,
  MINE_W,
  SUPPORT_COST,
  SUPPORT_REACH,
  bandAt,
  liftUpgradeCost,
  DEEP_DEFS,
  LANDMARKS,
  LANDMARK_ORDER,
  ORE_BODIES,
  BANDS,
  type Content,
  type FeatureKind,
  type DeepKind,
  type LandmarkKind,
} from "../data/mine";
import { fbm, hash2, makeRng, type Rng } from "./rng";
import type { Resource } from "./types";
import type { World } from "./world";
import type { Charge, Miner, OrderKind } from "./miners";
import type { DeepBuilding } from "./deepBuild";
import type { Critter } from "./deepLife";
import type { Pack } from "./packs";

export const N = MINE_W * MINE_H;
export const idx = (x: number, y: number) => y * MINE_W + x;
export const inMine = (x: number, y: number) => x >= 0 && y >= 0 && x < MINE_W && y < MINE_H;

/** What the tribe has to dig with (read from the surface, never written). */
export interface MineTools {
  /** stone tools: digging 30% faster */
  pick: boolean;
  /** copper picks (a camp kit): 15% faster, until iron picks replace them */
  copperPick?: boolean;
  /** a blacksmith's iron pick: another 20% */
  ironPick: boolean;
  /** iron + magnetite picks: another 15%, and they can cut granite (slowly) */
  reinforced?: boolean;
  /** soft ground + rubble go much faster */
  shovel?: boolean;
  /** fossils + artifacts come out whole */
  chisel?: boolean;
  /** crystal lanterns: light further, spot contents two cells off */
  crystalLantern?: boolean;
  /** cuts granite at all (and faster) */
  drill: boolean;
  /** see further + spot what's in nearby rock */
  lantern: boolean;
  /** pump water out twice as fast */
  pump: boolean;
  /** dynamite: tar + a stick + fire */
  dynamite: boolean;
  /** a diamond drill: granite + volcanic rock twice as fast */
  diamond?: boolean;
  /** 0..1 better finds */
  luck: number;
}

export function toolsOf(w: World): MineTools {
  const L = w.camp.learned;
  const k = w.colony.kits;
  return {
    pick: L.has("tools"),
    copperPick: k.has("copperPick"),
    ironPick: w.colony.finished("blacksmith"),
    reinforced: k.has("reinforcedPick"),
    shovel: k.has("shovel"),
    chisel: k.has("chisel"),
    crystalLantern: k.has("crystalLantern") && L.has("fire"),
    drill: k.has("drill") || k.has("diamondDrill") || (w.colony.finished("blacksmith") && L.has("smelting")),
    diamond: k.has("diamondDrill"),
    lantern: L.has("fire"),
    pump: w.colony.finished("waterStore") || k.has("waterSkins"),
    dynamite: L.has("fire") && w.camp.stock.tar >= (BLAST_COST.tar ?? 0) && w.camp.stock.stick >= (BLAST_COST.stick ?? 0),
    luck: w.civ.tuned.has("crystal") ? 0.25 : 0,
  };
}

/** One cave feature: its kind and the cells that make it up (from the seed). */
export interface Feature {
  kind: FeatureKind;
  cells: number[];
}

export const NO_TOOLS: MineTools = { pick: false, ironPick: false, drill: false, lantern: false, pump: false, dynamite: false, luck: 0 };

/** The tribe's best digging tool, as an index into PICK_TIERS. */
export function pickTier(t: MineTools) {
  return t.diamond ? 6 : t.drill ? 5 : t.reinforced ? 4 : t.ironPick ? 3 : t.copperPick ? 2 : t.pick ? 1 : 0;
}

/** How far the crew's lamps light the rock and spot what's in it. */
export function lanternOf(t: MineTools) {
  return t.crystalLantern ? LANTERN.crystal : t.lantern ? LANTERN.lantern : LANTERN.none;
}

export interface DigResult {
  ok: boolean;
  why?: string;
  /** what came out */
  r?: Resource;
  n?: number;
  /** a rich deposit was chipped, not dug out: the cell is still rock with this many hits left */
  left?: number;
  /** a fossil / artifact cracked coming out (no chisel) */
  damaged?: boolean;
  /** several things at once (landmarks) */
  loot?: Partial<Record<Resource, number>>;
  /** broke into / finished a landmark */
  landmark?: { kind: LandmarkKind; first: boolean; done: boolean };
  fossil?: boolean;
  artifact?: string;
  nugget?: { metal: "gold" | "silver"; size: "tiny" | "small" | "large" | "giant"; amount: number };
  /** what happened */
  event?: "spring" | "caveIn" | "gas" | "cavern" | "explosion";
  /** cells that filled with rubble */
  collapsed?: number[];
}

export interface LooseFind {
  metal: "gold" | "silver";
  size: "tiny" | "small" | "large" | "giant";
  amount: number;
}

export class Mine {
  /** what the rock + ore are generated from (changes when the mine is reset) */
  seed: number;
  /** rock per cell (M) */
  cells = new Uint8Array(N);
  /** the rock as generated (saves only store the differences) */
  private base = new Uint8Array(N);
  /** ore bodies (from the seed): 0 = none, else 1 + index into oreKinds */
  ore = new Uint8Array(N);
  oreKinds: Resource[] = [];
  /** hits left in each ore cell (rich deposits take several; see ORE_HITS) */
  oreLeft = new Uint8Array(N);
  /** Visible nuggets on natural cave floors; workers carry them out. */
  loose = new Map<number, LooseFind>();
  looseTaken = new Set<number>();
  /** 0 unknown, 1 seen, 2 scanned (contents known) */
  seen = new Uint8Array(N);
  /** 0..1 water in open cells */
  water = new Float32Array(N);
  /** cave features from the seed (chambers, rivers, shafts; see FEATURES) */
  features: Feature[] = [];
  /** which features have been found (indexes into `features`; saved) */
  featuresFound = new Set<number>();
  /** underground river cells: 0 none, 1 flows right, 2 flows left (from the seed) */
  river = new Uint8Array(N);
  /** what features put in their walls (artifacts, fossils), ahead of the band's random finds */
  private featureContent = new Map<number, Content>();
  /** crystal-cave walls + where hidden nuggets lie (applied after the ore + loose finds) */
  private featureOre: number[] = [];
  private featureLoot: { cell: number; find: LooseFind }[] = [];
  /** mine.version when features were last checked for being found */
  featureCheckV = -1;
  /** the water as generated (natural pools); saves only store the differences */
  private baseWater = new Float32Array(N);
  /** the water sim sleeps once everything has settled, until the mine changes again */
  private waterAwake = true;
  private waterV = -1;
  /** springs still flowing: cell → units left */
  springs = new Map<number, number>();
  /** gas pockets: cell → seconds left */
  gas = new Map<number, number>();
  /** roof supports */
  supports = new Set<number>();
  /** contents revealed so far (fixed once seen) */
  known = new Map<number, Content>();
  /** deepest row the lift reaches */
  liftMax = LIFT_START;
  /** the lift car (row, smooth) and where it's going */
  liftY = 0;
  liftTo = 0;
  stats = { dug: 0, deepest: 0, mined: {} as Partial<Record<Resource, number>>, caveIns: 0, springs: 0, fossils: 0, artifacts: 0, trogs: 0 };

  /* ---- Phase 5: landmarks, milestones, cave life ---- */
  /** this world's one-of-a-kind finds (from the seed) */
  landmarks: { kind: LandmarkKind; cells: number[] }[] = [];
  /** cell → which landmark it belongs to */
  special = new Map<number, LandmarkKind>();
  landmarksDone = new Set<LandmarkKind>();
  milestones = new Set<string>();
  discoveries: { kind: "fossil" | "nugget" | "landmark" | "artifact" | "feature"; name: string; detail: string; cell: number }[] = [];
  critters: Critter[] = [];
  nextCritterId = 1;
  /** landmarks the last scanner ping picked up (for the HUD message) */
  lastSignals: LandmarkKind[] = [];

  /* ---- the crew (Phase 3; the logic lives in miners.ts) ---- */
  /** people working down here */
  crew: Miner[] = [];
  /** trained dinosaurs carrying for them (the logic lives in packs.ts) */
  packs: Pack[] = [];
  /** people walking to the cave mouth to come down: id → seconds walking */
  pending = new Map<number, number>();
  /** miners who went up hurt: they come back down by themselves once they've healed */
  healing = new Set<number>();
  /** the player's marks on cells */
  orders = new Map<number, OrderKind>();
  /** lit dynamite */
  charges: Charge[] = [];
  /** miners dig out ore they spot without being told */
  autoMine = true;
  /** everyone heading up */
  recall = false;
  /** what the lift has carried up so far */
  hauled: Partial<Record<Resource, number>> = {};
  /** water the pump stations have sent up */
  pumped = 0;
  /** cosmetic: loads riding up the shaft, blast flashes, sounds for the view (not saved) */
  crates: { y: number; t: number }[] = [];
  blasts: { cell: number; t: number }[] = [];
  finds: { cell: number; t: number; metal: "gold" | "silver" }[] = [];
  sfx: { s: string; cell: number }[] = [];
  /** last time each kind of message was shown (spam guard) */
  toastAt = new Map<string, number>();

  /* ---- buildings (Phase 4; the logic lives in deepBuild.ts) ---- */
  builds: DeepBuilding[] = [];
  nextBuildId = 1;
  /** cell → the building standing on it */
  buildAt = new Map<number, DeepBuilding>();
  /** cells inside finished buildings: they never cave in */
  reinforced = new Set<number>();

  /** Rebuild the cell index after buildings change. */
  reindex() {
    this.buildAt.clear();
    this.reinforced.clear();
    for (const b of this.builds) {
      const d = DEEP_DEFS[b.kind];
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++) {
          const i = idx(b.x + dx, b.y + dy);
          this.buildAt.set(i, b);
          if (b.built >= 1) this.reinforced.add(i);
        }
    }
    this.version++;
  }
  /** bumps when the grid changes (for caches + the renderer later) */
  version = 0;
  private rng: Rng;
  private flowT = 0;
  private reachCache: { v: number; set: Uint8Array } = { v: -1, set: new Uint8Array(N) };

  /** the mine's own random numbers (never the surface's) */
  rand() {
    return this.rng();
  }

  /** Light around a point (lamps): cells come into view. */
  light(x: number, y: number, r: number) {
    const before = this.version;
    let changed = false;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (!inMine(x + dx, y + dy)) continue;
        const i = idx(x + dx, y + dy);
        if (this.seen[i] === 0) {
          this.seen[i] = 1;
          changed = true;
        }
      }
    if (changed && this.version === before) this.version++;
  }

  constructor(seed: number) {
    this.seed = seed;
    this.rng = makeRng((seed ^ 0x5eed_dee9) >>> 0);
    this.generate();
  }

  /** Throw away the rock + ore and grow a fresh mine from a new seed (no keeping). */
  private regenerate(seed: number) {
    this.seed = seed;
    this.rng = makeRng((seed ^ 0x5eed_dee9) >>> 0);
    this.cells.fill(0);
    this.base.fill(0);
    this.ore.fill(0);
    this.oreLeft.fill(0);
    this.oreKinds = [];
    this.loose.clear();
    this.looseTaken.clear();
    this.seen.fill(0);
    this.water.fill(0);
    this.baseWater.fill(0);
    this.anyWater = false;
    this.waterAwake = true;
    this.springs.clear();
    this.gas.clear();
    this.supports.clear();
    this.known.clear();
    this.landmarks = [];
    this.special.clear();
    this.features = [];
    this.featuresFound.clear();
    this.river.fill(0);
    this.featureContent.clear();
    this.featureCheckV = -1;
    this.critters = [];
    this.orders.clear();
    this.charges = [];
    this.crates = [];
    this.blasts = [];
    this.finds = [];
    this.sfx = [];
    this.lastSignals = [];
    this.discoveries = [];
    this.generate();
    this.version++;
  }

  /**
   * Start the mine over with new random rock, caves + mineral veins. Kept:
   * the lift depth, rooms already built down here (their space is dug out
   * again), stats, milestones and everything already hauled up. The crew
   * must be on the surface first (see resetMine in miners.ts).
   */
  reset(seed: number) {
    const keep = { liftMax: this.liftMax, builds: this.builds, stats: this.stats, milestones: this.milestones, landmarksDone: this.landmarksDone, discoveries: this.discoveries, hauled: this.hauled, autoMine: this.autoMine, pumped: this.pumped };
    this.regenerate(seed);
    this.liftMax = keep.liftMax;
    this.liftY = this.liftTo = 0;
    this.stats = keep.stats;
    this.milestones = keep.milestones;
    this.landmarksDone = keep.landmarksDone;
    this.discoveries = keep.discoveries;
    this.hauled = keep.hauled;
    this.autoMine = keep.autoMine;
    this.pumped = keep.pumped;
    this.recall = false;
    this.pending.clear();
    // rooms stay where they were: clear the new rock out of them (and light them up)
    this.builds = keep.builds;
    for (const b of this.builds) {
      const d = DEEP_DEFS[b.kind];
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++) {
          if (!inMine(b.x + dx, b.y + dy)) continue;
          const i = idx(b.x + dx, b.y + dy);
          if (this.cells[i] !== M.Shaft) this.cells[i] = M.Open;
          this.ore[i] = 0;
          this.water[i] = 0;
          this.loose.delete(i);
          this.seen[i] = 1;
        }
    }
    this.reindex();
  }

  /* ------------------------------ generation ------------------------------ */

  private generate() {
    const s = this.seed;
    for (let y = 0; y < MINE_H; y++) {
      const band = bandAt(y);
      for (let x = 0; x < MINE_W; x++) {
        const i = idx(x, y);
        let m: M;
        if (y === 0) m = M.Barrier;
        else if (y >= MAGMA_FROM - Math.floor(hash2(x, 7, s + 31) * 2)) m = M.Magma;
        else {
          // rock in soft wavy layers rather than salt-and-pepper
          const r = fbm(x / 11, y / 5, s + 911, 3) * 0.9 + hash2(x, y, s + 17) * 0.1;
          let acc = 0;
          m = band.rock[0][0];
          for (const [rock, share] of band.rock) {
            acc += share;
            if (r < acc) {
              m = rock;
              break;
            }
          }
          // natural caverns: big soft blobs, never touching the shaft
          if (band.caverns > 0 && Math.abs(x - LIFT_X) > 3 && y < MAGMA_FROM - 2 && y > band.from + 1) {
            const c = fbm(x / 7, y / 5, s + 4242, 3);
            if (c > 0.74 - band.caverns * 0.35) m = M.Open;
          }
        }
        this.cells[i] = m;
      }
    }
    this.carveCaveSystems();
    this.placeBedrock();
    for (let y = 0; y <= LIFT_MAX; y++) this.cells[idx(LIFT_X, y)] = M.Shaft;
    this.placeFeatures();
    this.placeLandmarks();
    this.placeOres();
    // crystal-cave walls are crystal through and through
    if (this.featureOre.length) {
      let k = this.oreKinds.indexOf("crystal");
      if (k < 0) k = this.oreKinds.push("crystal") - 1;
      for (const i of this.featureOre) if (MATERIALS[this.cells[i] as M].solid && !this.special.has(i)) {
        this.ore[i] = k + 1;
        this.pocket[i] = 1;
      }
    }
    this.refillOre();
    this.placeLooseFinds();
    for (const { cell, find } of this.featureLoot) if (this.cells[cell] === M.Open) this.loose.set(cell, find);
    // the landing at the top: a little room beside the shaft
    for (const x of [LIFT_X - 1, LIFT_X + 1]) this.cells[idx(x, 1)] = M.Open;
    this.fillPools();
    this.baseWater.set(this.water);
    this.anyWater = this.water.some((v) => v > 0.01);
    this.waterAwake = true;
    this.base.set(this.cells);
    this.seen.fill(0);
    this.revealRect(LIFT_X - 2, 0, LIFT_X + 2, 2, 1);
  }

  private placeLooseFinds() {
    this.loose.clear();
    for (let y = 35; y < MAGMA_FROM - 2; y++) for (let x = LIFT_X + 4; x < MINE_W - 2; x++) {
      const i = idx(x, y);
      if (this.cells[i] !== M.Open || this.special.has(i)) continue;
      const chance = hash2(x, y, this.seed + 0x301d);
      if (chance > 0.0022) continue;
      const metal: LooseFind["metal"] = hash2(y, x, this.seed + 0x51ee) < 0.62 ? "gold" : "silver";
      const roll = hash2(x, y, this.seed + 0x517e);
      const size: LooseFind["size"] = roll > 0.998 ? "giant" : roll > 0.93 ? "large" : roll > 0.42 ? "small" : "tiny";
      this.loose.set(i, { metal, size, amount: size === "giant" ? 16 : size === "large" ? 7 : size === "small" ? 3 : 1 });
    }
  }

  /**
   * Underground pools: water already settled in the bottom of some natural caverns. Each
   * row is filled from the lowest up, and only where it would stay put: a run of open cells
   * walled in by rock at both ends with rock (or water) all along underneath.
   */
  private fillPools() {
    const rng = makeRng((this.seed ^ 0x9001) >>> 0);
    const done = new Uint8Array(N);
    const solid = (i: number) => MATERIALS[this.cells[i] as M].solid;
    const top = BANDS[POOLS.bands[0]].from;
    const bottom = (BANDS[POOLS.bands[1] + 1]?.from ?? MAGMA_FROM) - 1;
    for (let start = 0; start < N; start++) {
      if (done[start] || this.cells[start] !== M.Open) continue;
      // the whole cavern this cell belongs to
      const cave: number[] = [];
      const stack = [start];
      done[start] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        cave.push(i);
        const x = i % MINE_W;
        const y = (i - x) / MINE_W;
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!inMine(a, b)) continue;
          const j = idx(a, b);
          if (done[j] || this.cells[j] !== M.Open) continue;
          done[j] = 1;
          stack.push(j);
        }
      }
      let lo = MINE_H;
      let hi = 0;
      for (const i of cave) {
        const y = Math.floor(i / MINE_W);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      // roll for every cavern (so the dice don't depend on which caverns qualify)
      const roll = rng();
      const depth = POOLS.depth[0] + Math.floor(rng() * (POOLS.depth[1] - POOLS.depth[0] + 1));
      const level = 0.75 + rng() * 0.25;
      if (cave.length < POOLS.minCells || hi < top || hi > bottom || roll > POOLS.chance || cave.some((i) => this.river[i])) continue;
      const inCave = new Set(cave);
      let rows = 0;
      for (let y = hi; y >= lo && rows < depth; y--) {
        let filled = false;
        for (let x = 0; x < MINE_W; x++) {
          if (!inCave.has(idx(x, y))) continue;
          let e = x;
          while (e + 1 < MINE_W && inCave.has(idx(e + 1, y))) e++;
          const walled = x > 0 && e < MINE_W - 1 && solid(idx(x - 1, y)) && solid(idx(e + 1, y));
          let floored = y + 1 < MINE_H;
          for (let k = x; k <= e && floored; k++) {
            const below = idx(k, y + 1);
            floored = solid(below) || this.water[below] >= 0.999;
          }
          if (walled && floored) {
            // the top row of the pool sits a little below the brim
            const v = rows === depth - 1 ? level : 1;
            for (let k = x; k <= e; k++) this.water[idx(k, y)] = v;
            filled = true;
          }
          x = e;
        }
        if (!filled) break;
        rows++;
      }
    }
  }

  /**
   * Cave features (see FEATURES): carved out of the rock after the caverns + bedrock, so they
   * never cut through a bedrock sheet or the shaft. Everything comes from the seed (their own
   * random numbers), so nothing about them needs saving except which ones have been found.
   */
  private placeFeatures() {
    const rng = makeRng((this.seed ^ 0x0fea7) >>> 0);
    this.features = [];
    this.river.fill(0);
    this.featureContent.clear();
    this.featureOre = [];
    this.featureLoot = [];
    const taken = new Uint8Array(N);
    const X0 = LIFT_X + 5;
    const hard = (i: number) => {
      const m = this.cells[i] as M;
      return m === M.Bedrock || m === M.Magma || m === M.Barrier || m === M.Shaft;
    };
    const free = (x0: number, y0: number, x1: number, y1: number) => {
      if (x0 < X0 || x1 > MINE_W - 2 || y0 < 2 || y1 > MAGMA_FROM - 3) return false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (taken[idx(x, y)] || hard(idx(x, y))) return false;
      return true;
    };
    const open = (x: number, y: number, cells: number[]) => {
      if (!inMine(x, y)) return;
      const i = idx(x, y);
      if (hard(i)) return;
      this.cells[i] = M.Open;
      taken[i] = 1;
      cells.push(i);
    };
    const claim = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inMine(x, y)) taken[idx(x, y)] = 1;
    };
    /** somewhere in the feature's rows with a clear w x h box (plus padding) that also passes `ok` */
    const spot = (kind: FeatureKind, w: number, h: number, pad: number, ok?: (x: number, y: number) => boolean) => {
      const [r0, r1] = FEATURES[kind].rows;
      const span = MINE_W - 2 - X0 - w - pad * 2;
      if (span < 1) return null;
      for (let k = 0; k < 120; k++) {
        const x = X0 + pad + Math.floor(rng() * span);
        const y = r0 + Math.floor(rng() * Math.max(1, r1 - r0 - h));
        if (free(x - pad, y - pad, x + w - 1 + pad, y + h - 1 + pad) && (!ok || ok(x, y))) return { x, y };
      }
      return null;
    };
    for (const kind of FEATURE_ORDER) {
      const def = FEATURES[kind];
      for (let n = 0; n < def.count; n++) {
        const cells: number[] = [];
        if (kind === "river") {
          // a stream along the floor of a three-high tunnel: the bank above it is walkable.
          // Bedrock walls split every band, so try shorter rivers if a long one won't fit.
          let len = 14 + Math.floor(rng() * 13);
          let p = spot(kind, len, 3, 1);
          while (!p && len > 8) {
            len -= 3;
            p = spot(kind, len, 3, 1);
          }
          if (!p) continue;
          const dir = rng() < 0.5 ? 1 : 2;
          for (let x = p.x; x < p.x + len; x++) {
            for (let y = p.y; y < p.y + 3; y++) open(x, y, cells);
            const bed = idx(x, p.y + 3);
            if (!hard(bed)) this.cells[bed] = M.Stone;
            if (this.cells[idx(x, p.y + 2)] === M.Open) this.river[idx(x, p.y + 2)] = dir;
          }
          claim(p.x - 1, p.y - 1, p.x + len, p.y + 4);
        } else if (kind === "crystalCave") {
          const rx = 3 + rng() * 1.5;
          const ry = 2 + rng() * 1;
          const p = spot(kind, Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, 2);
          if (!p) continue;
          const cx = p.x + rx;
          const cy = p.y + ry;
          const rim: number[] = [];
          for (let y = p.y - 1; y <= p.y + Math.ceil(ry * 2) + 1; y++)
            for (let x = p.x - 1; x <= p.x + Math.ceil(rx * 2) + 1; x++) {
              if (!inMine(x, y)) continue;
              const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
              if (d <= 1) open(x, y, cells);
              else if (d <= 1.9 && !hard(idx(x, y))) {
                rim.push(idx(x, y));
                taken[idx(x, y)] = 1;
              }
            }
          claim(p.x - 2, p.y - 2, p.x + Math.ceil(rx * 2) + 2, p.y + Math.ceil(ry * 2) + 2);
          // the glittering walls are crystal ore, and count as part of the cave (they're what you see first)
          this.featureOre.push(...rim);
          cells.push(...rim);
        } else if (kind === "artifactRoom") {
          const w = 5 + Math.floor(rng() * 2);
          const p = spot(kind, w, 3, 1);
          if (!p) continue;
          for (let y = p.y; y < p.y + 3; y++) for (let x = p.x; x < p.x + w; x++) open(x, y, cells);
          // a dressed floor + things set into the walls
          for (let x = p.x - 1; x <= p.x + w; x++) {
            const f = idx(x, p.y + 3);
            if (!hard(f)) this.cells[f] = M.Stone;
          }
          const walls = [idx(p.x - 1, p.y + 1), idx(p.x + w, p.y + 1), idx(p.x + Math.floor(w / 2), p.y - 1)];
          walls.forEach((i, k) => {
            if (hard(i)) return;
            if (!MATERIALS[this.cells[i] as M].solid) this.cells[i] = M.Stone;
            this.featureContent.set(i, k === 1 ? "fossil" : "artifact");
            cells.push(i);
          });
          this.featureLoot.push({ cell: idx(p.x + 1 + Math.floor(rng() * (w - 2)), p.y + 2), find: { metal: rng() < 0.6 ? "gold" : "silver", size: "large", amount: 7 } });
          claim(p.x - 1, p.y - 1, p.x + w, p.y + 3);
        } else if (kind === "hiddenChamber") {
          // sealed all round by at least one cell of rock
          const w = 3 + Math.floor(rng() * 2);
          const sealed = (sx: number, sy: number) => {
            for (let y = sy - 1; y <= sy + 2; y++) for (let x = sx - 1; x <= sx + w; x++) if (!MATERIALS[this.cells[idx(x, y)] as M].solid) return false;
            return true;
          };
          const p = spot(kind, w, 2, 1, sealed);
          if (!p) continue;
          for (let y = p.y; y < p.y + 2; y++) for (let x = p.x; x < p.x + w; x++) open(x, y, cells);
          for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) {
            const giant = rng() < 0.15;
            this.featureLoot.push({ cell: idx(p.x + Math.floor(rng() * w), p.y + 1), find: { metal: rng() < 0.6 ? "gold" : "silver", size: giant ? "giant" : "large", amount: giant ? 16 : 7 } });
          }
          claim(p.x - 1, p.y - 1, p.x + w, p.y + 2);
        } else if (kind === "shaft") {
          const len = 6 + Math.floor(rng() * 9);
          const p = spot(kind, 1, len, 0);
          if (!p) continue;
          for (let y = p.y; y < p.y + len; y++) open(p.x, y, cells);
        } else if (kind === "ramp") {
          // a two-wide staircase going down sideways
          const len = 6 + Math.floor(rng() * 5);
          const dir = rng() < 0.5 ? 1 : -1;
          const p = spot(kind, len + 1, len, 0);
          if (!p) continue;
          const sx = dir > 0 ? p.x : p.x + len;
          for (let k = 0; k < len; k++) {
            open(sx + k * dir, p.y + k, cells);
            open(sx + (k + 1) * dir, p.y + k, cells);
          }
        }
        if (cells.length) this.features.push({ kind, cells });
      }
    }
  }

  /** Winding tunnels that link the caverns into cave systems (never near the shaft). */
  private carveCaveSystems() {
    const rng = makeRng((this.seed ^ 0x0ca7e5) >>> 0);
    for (let b = 1; b < BANDS.length; b++) {
      const from = BANDS[b].from + 2;
      const to = (BANDS[b + 1]?.from ?? MAGMA_FROM) - 3;
      const worms = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < worms; k++) {
        let x = LIFT_X + 6 + rng() * (MINE_W - LIFT_X - 10);
        let y = from + rng() * (to - from);
        let a = rng() < 0.5 ? 0 : Math.PI;
        const len = 25 + Math.floor(rng() * 50);
        for (let s = 0; s < len; s++) {
          a += (rng() - 0.5) * 0.9;
          // mostly sideways, drifting up and down a little
          x += Math.cos(a);
          y += Math.sin(a) * 0.45;
          if (x < LIFT_X + 4 || x > MINE_W - 2) {
            a = Math.PI - a;
            x = Math.max(LIFT_X + 4, Math.min(MINE_W - 2, x));
          }
          y = Math.max(from, Math.min(to, y));
          const cx = Math.round(x);
          const cy = Math.round(y);
          this.cells[idx(cx, cy)] = M.Open;
          if (rng() < 0.35 && cy + 1 <= to) this.cells[idx(cx, cy + 1)] = M.Open;
        }
      }
    }
  }

  /**
   * Bedrock sections the mine: a sheet between each depth band (only the lift
   * shaft goes through) and a wall or two inside each band. Blast through them.
   */
  private placeBedrock() {
    const rng = makeRng((this.seed ^ 0xbed70c) >>> 0);
    for (let b = 1; b < BANDS.length; b++) {
      const top = BANDS[b].from;
      const bottom = (BANDS[b + 1]?.from ?? MAGMA_FROM) - 1;
      // the sheet on top of the band, slightly wavy, two cells thick in places
      for (let x = 0; x < MINE_W; x++) {
        if (x === LIFT_X) continue;
        const y = top + (Math.sin(x * 0.4 + b) > 0.6 ? 1 : 0);
        this.cells[idx(x, y)] = M.Bedrock;
        if (rng() < 0.3) this.cells[idx(x, y + 1)] = M.Bedrock;
      }
      // a dividing wall (two in the deeper bands)
      const walls = b >= 3 ? 2 : 1;
      for (let k = 0; k < walls; k++) {
        let x = LIFT_X + 10 + Math.floor(rng() * (MINE_W - LIFT_X - 16));
        for (let y = top; y <= bottom; y++) {
          if (rng() < 0.25) x += rng() < 0.5 ? -1 : 1;
          x = Math.max(LIFT_X + 6, Math.min(MINE_W - 3, x));
          this.cells[idx(x, y)] = M.Bedrock;
          this.cells[idx(x + 1, y)] = M.Bedrock;
        }
      }
    }
  }

  /** Seams, veins, pockets + pipes of ore (see ORE_BODIES). */
  private placeOres() {
    const rng = makeRng((this.seed ^ 0x0e5ea7) >>> 0);
    this.ore.fill(0);
    this.oreKinds = [];
    this.pocket.fill(0);
    const kindOf = (r: Resource) => {
      let k = this.oreKinds.indexOf(r);
      if (k < 0) k = this.oreKinds.push(r) - 1;
      return k + 1;
    };
    const put = (x: number, y: number, k: number) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (!inMine(xi, yi) || xi === LIFT_X) return;
      const i = idx(xi, yi);
      const m = this.cells[i] as M;
      if (!MATERIALS[m].solid || m === M.Magma || m === M.Barrier || m === M.Bedrock || this.special.has(i)) return;
      this.ore[i] = k;
    };
    for (const spec of ORE_BODIES) {
      const band = BANDS[spec.band];
      const from = Math.max(2, band.from + 1);
      const to = (BANDS[spec.band + 1]?.from ?? MAGMA_FROM) - 1;
      const total = spec.bodies.reduce((a, b) => a + b.weight, 0);
      for (let n = 0; n < spec.count; n++) {
        let pick = rng() * total;
        const body = spec.bodies.find((b) => (pick -= b.weight) <= 0) ?? spec.bodies[0];
        const k = kindOf(body.r);
        // most bodies are small, a few are huge
        const size = body.size[0] + (body.size[1] - body.size[0]) * Math.pow(rng(), 2.6);
        let x = 2 + rng() * (MINE_W - 4);
        let y = from + rng() * (to - from);
        switch (body.shape) {
          case "seam": {
            // follows the strata: long, flat, gently waving, 1–2 thick
            const dir = rng() < 0.5 ? -1 : 1;
            const thick = size > 22 ? 2 : 1;
            const ph = rng() * 6;
            for (let s = 0; s < size; s++) {
              const yy = y + Math.sin(s * 0.18 + ph) * 1.5;
              for (let t = 0; t < thick; t++) put(x + s * dir, yy + t, k);
            }
            break;
          }
          case "vein": {
            // wanders through cracks, steeply, sometimes branching
            let a = Math.PI / 2 + (rng() - 0.5) * 2.2;
            const branches: [number, number, number][] = [];
            for (let s = 0; s < size; s++) {
              a += (rng() - 0.5) * 0.7;
              x += Math.cos(a);
              y += Math.sin(a) * 0.8;
              if (y < from || y > to) a = -a;
              put(x, y, k);
              if (size > 18 && s % 7 === 3) put(x + 1, y, k);
              if (rng() < 0.06) branches.push([x, y, a + (rng() < 0.5 ? 1 : -1)]);
            }
            for (const [bx, by, ba] of branches) {
              let px = bx;
              let py = by;
              let pa = ba;
              for (let s = 0; s < size * 0.4; s++) {
                pa += (rng() - 0.5) * 0.6;
                px += Math.cos(pa);
                py += Math.sin(pa) * 0.8;
                put(px, py, k);
              }
            }
            break;
          }
          case "pocket": {
            const r = size / 10;
            for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++)
              for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
                if (dx * dx + dy * dy * 1.3 <= r * r + rng() * 0.8) {
                  put(x + dx, y + dy, k);
                  const xi = Math.round(x + dx);
                  const yi = Math.round(y + dy);
                  if (inMine(xi, yi) && this.ore[idx(xi, yi)] === k) this.pocket[idx(xi, yi)] = 1;
                }
            break;
          }
          case "pipe": {
            // a narrow pipe straight down (diamonds)
            for (let s = 0; s < size; s++) put(x + (rng() < 0.2 ? (rng() < 0.5 ? -1 : 1) : 0), y + s, k);
            break;
          }
        }
      }
    }
  }

  /** cells that belong to a pocket (rich clusters: one extra hit) */
  private pocket = new Uint8Array(N);

  /** How many hits an ore cell takes when nobody has touched it (fixed by the seed). */
  oreHits(i: number) {
    const r = this.oreAt(i);
    const span = r ? ORE_HITS[r] : undefined;
    if (!span) return r ? 1 : 0;
    const x = i % MINE_W;
    const y = (i - x) / MINE_W;
    return Math.min(255, span[0] + Math.floor(hash2(x, y, this.seed + 0x0a1e) * (span[1] - span[0] + 1)) + (this.pocket[i] ? 1 : 0));
  }

  /** Every ore cell back to full (generation + loading). */
  private refillOre() {
    for (let i = 0; i < N; i++) this.oreLeft[i] = this.ore[i] ? this.oreHits(i) : 0;
  }

  /** How much of a known deposit is left (for the HUD + the renderer), or null if it isn't one. */
  oreRemaining(i: number): { left: number; max: number } | null {
    if (!this.ore[i] || !MATERIALS[this.cells[i] as M].solid || this.cells[i] === M.Rubble) return null;
    return { left: Math.max(1, this.oreLeft[i]), max: Math.max(1, this.oreHits(i)) };
  }

  /** The ore body (if any) a cell is part of. */
  oreAt(i: number): Resource | null {
    const k = this.ore[i];
    return k ? this.oreKinds[k - 1] : null;
  }

  /** Each landmark goes somewhere solid in its depth range, away from the shaft. */
  private placeLandmarks() {
    const s = this.seed;
    this.landmarks = [];
    this.special.clear();
    LANDMARK_ORDER.forEach((kind, n) => {
      const L = LANDMARKS[kind];
      for (let k = 0; k < 600; k++) {
        const x = LIFT_X + 6 + Math.floor(hash2(k, n * 13 + 1, s + 5151) * (MINE_W - L.w - LIFT_X - 8));
        const y = L.rows[0] + Math.floor(hash2(n * 7 + 2, k, s + 5252) * (L.rows[1] - L.rows[0]));
        const cells: number[] = [];
        let ok = true;
        for (let dy = 0; dy < L.h && ok; dy++)
          for (let dx = 0; dx < L.w && ok; dx++) {
            const i = idx(x + dx, y + dy);
            const m = this.cells[i] as M;
            if (!MATERIALS[m].solid || m === M.Magma || m === M.Bedrock || this.special.has(i)) ok = false;
            else if (!(kind === "skeleton" && (dy + dx) % 3 === 2)) cells.push(i);
          }
        if (!ok) continue;
        for (const i of cells) this.special.set(i, kind);
        this.landmarks.push({ kind, cells });
        return;
      }
    });
  }

  /** How far a landmark has been dug out (0..1). */
  landmarkProgress(kind: LandmarkKind) {
    const l = this.landmarks.find((x) => x.kind === kind);
    if (!l) return 0;
    // rubble on a landmark cell means it was dug out before the roof fell back in
    return l.cells.filter((i) => !MATERIALS[this.cells[i] as M].solid || this.cells[i] === M.Rubble).length / l.cells.length;
  }

  /** What the generator put here (before anyone dug). */
  baseAt(i: number) {
    return this.base[i] as M;
  }

  /* ------------------------------ queries ------------------------------ */

  at(x: number, y: number): M {
    return inMine(x, y) ? (this.cells[idx(x, y)] as M) : M.Barrier;
  }

  isOpen(i: number) {
    const m = this.cells[i];
    return m === M.Open || m === M.Shaft;
  }

  /** Can a person stand here? (open, not flooded; the shaft only where the lift reaches) */
  passable(x: number, y: number) {
    if (!inMine(x, y)) return false;
    const i = idx(x, y);
    const m = this.cells[i];
    if (m === M.Shaft) return y <= this.liftMax;
    return m === M.Open && this.water[i] < FLOODED && !this.river[i];
  }

  supported(x: number, y: number) {
    for (let dy = -SUPPORT_REACH; dy <= SUPPORT_REACH; dy++)
      for (let dx = -SUPPORT_REACH; dx <= SUPPORT_REACH; dx++) {
        if (!inMine(x + dx, y + dy)) continue;
        const i = idx(x + dx, y + dy);
        // beams, and finished rooms (they're built to hold the roof up)
        if (this.supports.has(i) || this.reinforced.has(i)) return true;
      }
    return false;
  }

  /** Open cells connected to the lift shaft (where miners can actually get to). */
  reach(): Uint8Array {
    const key = this.version * 1000 + this.liftMax;
    if (this.reachCache.v === key) return this.reachCache.set;
    const set = this.reachCache.set;
    set.fill(0);
    const q: number[] = [];
    for (let y = 0; y <= this.liftMax; y++) {
      const i = idx(LIFT_X, y);
      set[i] = 1;
      q.push(i);
    }
    while (q.length) {
      const i = q.pop()!;
      const x = i % MINE_W;
      const y = (i - x) / MINE_W;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!inMine(nx, ny)) continue;
        const j = idx(nx, ny);
        if (set[j] || this.cells[j] !== M.Open) continue;
        set[j] = 1;
        q.push(j);
      }
    }
    this.reachCache.v = key;
    return set;
  }

  /** A solid cell next to reachable open space (the digging face). */
  onFace(x: number, y: number) {
    if (!inMine(x, y) || !MATERIALS[this.at(x, y)].solid) return false;
    const r = this.reach();
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => inMine(a, b) && r[idx(a, b)] === 1);
  }

  /** Why this cell can't be dug (or null if it can). */
  cantDig(x: number, y: number, t: MineTools): string | null {
    if (!inMine(x, y)) return "Out of the mine.";
    const m = this.at(x, y);
    if (m === M.Open || m === M.Shaft) return "Already open.";
    if (m === M.Barrier) return "The groundwater barrier holds up the whole town — leave it be.";
    if (m === M.Magma) return "Molten rock. Nothing digs through that.";
    if (MATERIALS[m].needs === "drill" && !t.drill && !t.reinforced) return "Granite! You need a drill (a Blacksmith with Smelting, or Crystal drills) or reinforced picks.";
    if (MATERIALS[m].needs === "blast") return "Solid bedrock — picks and drills bounce off. Mark it for 🧨 Blast.";
    if (!this.onFace(x, y)) return "Dig from an open tunnel next to it.";
    return null;
  }

  /** Seconds it takes one miner to dig a cell. */
  digTime(x: number, y: number, t: MineTools) {
    const m = this.at(x, y);
    let s = MATERIALS[m].dig;
    if (t.pick) s *= 0.7;
    if (t.ironPick) s *= 0.8;
    else if (t.copperPick) s *= 0.85;
    if (t.reinforced) s *= 0.85;
    if (t.shovel && SOFT_ROCK.has(m)) s *= 0.55;
    if (m === M.Granite && t.drill) s *= 0.6;
    // no drill: reinforced picks get through granite, but it's hard going
    else if (m === M.Granite) s *= 1.3;
    if ((m === M.Granite || m === M.Volcanic) && t.diamond) s *= 0.5;
    const c = this.known.get(idx(x, y));
    if (c && c !== "spring" && c !== "caveIn" && c !== "gas") s *= 1.25;
    return Math.max(0.6, s);
  }

  /** What's in a cell. Rolled from the seed the first time anyone looks, then fixed. */
  contentOf(i: number, luck = 0): Content {
    // rubble is rock that was already dug out once (then the roof came down): whatever was in it is gone
    if (this.cells[i] === M.Rubble) return null;
    if (this.known.has(i)) return this.known.get(i)!;
    const lm = this.special.get(i);
    if (lm) return lm;
    const fc = this.featureContent.get(i);
    if (fc && this.cells[i] !== M.Open) return fc;
    // real ore bodies first (fixed by the seed), then the band's random surprises
    const ore = this.oreAt(i);
    if (ore && this.cells[i] !== M.Open) return ore;
    const x = i % MINE_W;
    const y = (i - x) / MINE_W;
    const band = bandAt(y);
    const s = this.seed + 777;
    let c: Content = null;
    if (MATERIALS[this.base[i] as M].solid && this.base[i] !== M.Magma && this.base[i] !== M.Barrier && hash2(x, y, s) < band.rich) {
      // luck makes bad stuff rarer and good stuff commoner
      const finds = band.finds.map(([f, wgt]) => [f, f === "caveIn" || f === "gas" || f === "spring" ? wgt * (1 - luck * 0.5) : wgt * (1 + luck)] as const);
      const total = finds.reduce((a, [, wgt]) => a + wgt, 0);
      let r = hash2(y, x, s + 1) * total;
      for (const [f, wgt] of finds) {
        r -= wgt;
        if (r <= 0) {
          c = f;
          break;
        }
      }
    }
    return c;
  }

  /** Look at a cell's contents (a lantern glint): fixes them and marks the cell scanned. */
  scan(i: number, luck = 0) {
    const c = this.contentOf(i, luck);
    this.known.set(i, c);
    this.seen[i] = 2;
    return c;
  }

  /* ------------------------------ digging ------------------------------ */

  /** Dig out one cell. Call when a miner finishes (the time comes from digTime). */
  dig(x: number, y: number, t: MineTools): DigResult {
    const why = this.cantDig(x, y, t);
    if (why) return { ok: false, why };
    const i = idx(x, y);
    const content = this.contentOf(i, t.luck);
    const m = this.at(x, y);
    const lm = m === M.Rubble ? undefined : this.special.get(i);
    const before = lm ? this.landmarkProgress(lm) : 0;
    // a rich deposit gives ore a hit at a time and stays rock (shrinking) until the last hit
    const oreHere = !lm && m !== M.Rubble && content !== null && content in FIND_AMOUNT && this.oreAt(i) === content;
    if (oreHere && this.oreLeft[i] > 1) {
      this.oreLeft[i]--;
      const r = content as Resource;
      const n = this.oreYield(r, t);
      this.stats.mined[r] = (this.stats.mined[r] ?? 0) + n;
      this.stats.deepest = Math.max(this.stats.deepest, y);
      this.followVein(x, y, t);
      this.version++;
      return { ok: true, r, n, left: this.oreLeft[i] };
    }
    if (oreHere) this.oreLeft[i] = 0;
    this.known.delete(i);
    this.cells[i] = M.Open;
    this.version++;
    this.stats.dug++;
    this.stats.deepest = Math.max(this.stats.deepest, y);
    const out: DigResult = { ok: true };
    // loot: the cell's find, else sometimes a bit of the rock itself
    if (lm) {
      out.loot = { ...LANDMARKS[lm].gives };
      for (const [r, n] of Object.entries(out.loot) as [Resource, number][]) this.stats.mined[r] = (this.stats.mined[r] ?? 0) + n;
      out.landmark = { kind: lm, first: before === 0, done: this.landmarkProgress(lm) >= 1 };
    } else if (content && content in FIND_AMOUNT) {
      out.r = content as Resource;
      out.n = this.oreYield(content as Resource, t);
      // Deterministic geology chooses pockets; only the yield roll is random.
      if ((content === "gold" || content === "silver") && hash2(x, y, this.seed + 0x6a11) < (content === "gold" ? 0.16 : 0.12)) {
        const roll = hash2(y, x, this.seed + 0x51ae);
        const size = roll > 0.995 ? "giant" : roll > 0.9 ? "large" : roll > 0.45 ? "small" : "tiny";
        const amount = size === "giant" ? 16 : size === "large" ? 7 : size === "small" ? 3 : 1;
        out.n += amount;
        out.nugget = { metal: content, size, amount };
      }
    } else if (content === "fossil") {
      out.fossil = true;
      out.damaged = !t.chisel && this.rng() < CRACK_CHANCE;
      this.stats.fossils++;
    } else if (content === "artifact") {
      out.damaged = !t.chisel && this.rng() < CRACK_CHANCE;
      const artifacts = ["carved stone tablet", "ancient mining hammer", "spiral crystal pendant", "buried stone figurine", "prehistoric map shard"];
      out.artifact = artifacts[Math.floor(hash2(x, y, this.seed + 0xa711) * artifacts.length)];
      this.stats.artifacts++;
    } else if (MATERIALS[m].spoil && m !== M.Rubble && this.rng() < 0.4) {
      out.r = MATERIALS[m].spoil;
      out.n = 1;
    }
    if (out.r && out.n) this.stats.mined[out.r] = (this.stats.mined[out.r] ?? 0) + out.n;
    // light: see around the new hole (further with a better lamp), glint what's in the rock nearby
    const lamp = lanternOf(t);
    this.revealRect(x - lamp.light, y - lamp.light, x + lamp.light, y + lamp.light, 1);
    for (let dy = -lamp.spot; dy <= lamp.spot; dy++)
      for (let dx = -lamp.spot; dx <= lamp.spot; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > lamp.spot + (lamp.spot > 1 ? 1 : 0) || (!dx && !dy)) continue;
        const a = x + dx;
        const b = y + dy;
        if (inMine(a, b) && MATERIALS[this.at(a, b)].solid) this.scan(idx(a, b), t.luck);
      }
    this.followVein(x, y, t);
    // broke into a natural cavern? the whole thing comes into view
    if ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => inMine(a, b) && this.at(a, b) === M.Open && this.seen[idx(a, b)] === 0)) {
      this.revealCavern(x, y);
      out.event = "cavern";
    }
    // hazards
    if (content === "spring") {
      this.springs.set(i, 14 + this.rng() * 10);
      this.water[i] = Math.max(this.water[i], 0.6);
      this.stats.springs++;
      out.event = "spring";
    } else if (content === "gas") {
      this.release(x, y);
      out.event = "gas";
    }
    // clearing rubble is digging out a roof that already came down: it doesn't bring down another
    const fell = m === M.Rubble ? [] : this.maybeCollapse(x, y, content === "caveIn");
    if (fell.length) {
      out.collapsed = fell;
      out.event = "caveIn";
    }
    return out;
  }

  /** Following a vein: with a lantern, miners working ore can see where it runs next. */
  private followVein(x: number, y: number, t: MineTools) {
    const ore = this.ore[idx(x, y)];
    if (!ore || !t.lantern) return;
    const R = t.crystalLantern ? 3 : 2;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        if (!inMine(x + dx, y + dy)) continue;
        const j = idx(x + dx, y + dy);
        if (this.ore[j] === ore && MATERIALS[this.cells[j] as M].solid && this.seen[j] !== 2) this.scan(j, t.luck);
      }
  }

  /** Units one hit on a find gives: the find's range, plus sometimes one more with a better pick. */
  private oreYield(r: Resource, t: MineTools) {
    const [lo, hi] = FIND_AMOUNT[r]!;
    let n = lo + Math.floor(this.rng() * (hi - lo + 1));
    const bonus = PICK_TIERS[pickTier(t)].bonus;
    if (bonus > 0 && this.rng() < bonus) n++;
    return n;
  }

  /** A weak roof gives way: nearby unsupported open cells fill with rubble. */
  private maybeCollapse(x: number, y: number, forced: boolean): number[] {
    const supported = this.supported(x, y);
    if (supported && !forced) return [];
    let span = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMine(x + dx, y + dy) && this.cells[idx(x + dx, y + dy)] === M.Open) span++;
    const risk = bandAt(y).collapse + Math.max(0, span - CAVE_IN.spanFree) * CAVE_IN.spanRisk;
    if (!forced && this.rng() > risk) return [];
    const out: number[] = [];
    for (let dy = -2; dy <= 1; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const a = x + dx;
        const b = y + dy;
        if (!inMine(a, b) || b < 1) continue;
        const j = idx(a, b);
        if (this.cells[j] !== M.Open || this.reinforced.has(j) || this.supported(a, b)) continue;
        // the cell just dug always comes down; the rest sometimes
        if ((dx === 0 && dy === 0) || this.rng() < (supported ? CAVE_IN.spreadSupported : CAVE_IN.spread)) {
          this.cells[j] = M.Rubble;
          this.water[j] = 0;
          out.push(j);
        }
      }
    if (out.length) {
      this.stats.caveIns++;
      this.version++;
    }
    return out;
  }

  private release(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMine(x + dx, y + dy)) this.gas.set(idx(x + dx, y + dy), 25);
  }

  /** Dynamite: clears a 3x3 block at once (not magma, not the barrier). Gas makes it much worse. */
  blast(w: World, x: number, y: number, t: MineTools): { cells: number[]; loot: Partial<Record<Resource, number>>; collapsed: number[]; explosion: boolean; landmarks: { kind: LandmarkKind; done: boolean }[] } | string {
    if (!t.dynamite) return "Dynamite needs Fire, plus tar and a stick for each charge.";
    if (!this.onFace(x, y) && !(inMine(x, y) && this.reach()[idx(x, y)])) return "Set the charge from a tunnel.";
    for (const [r, n] of Object.entries(BLAST_COST) as [Resource, number][]) w.camp.stock[r] -= n;
    const loot: Partial<Record<Resource, number>> = {};
    const cells: number[] = [];
    const hit: LandmarkKind[] = [];
    let explosion = false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const a = x + dx;
        const b = y + dy;
        if (!inMine(a, b)) continue;
        const j = idx(a, b);
        if (this.gas.has(j)) explosion = true;
        const m = this.cells[j] as M;
        if (m === M.Open || m === M.Shaft || m === M.Magma || m === M.Barrier) continue;
        if (m === M.Bedrock && !w.flags.has("bedrockBlast")) {
          w.flags.add("bedrockBlast");
          w.toast("🧨", "The dynamite cracked the bedrock! A new section of the mine is open.");
        }
        const c = this.contentOf(j, t.luck);
        this.known.delete(j);
        this.cells[j] = M.Open;
        cells.push(j);
        const lm = m === M.Rubble ? undefined : this.special.get(j);
        if (lm) {
          for (const [r, n] of Object.entries(LANDMARKS[lm].gives) as [Resource, number][]) loot[r] = (loot[r] ?? 0) + n;
          if (!hit.includes(lm)) hit.push(lm);
        }
        this.stats.dug++;
        this.stats.deepest = Math.max(this.stats.deepest, b);
        if (c && c in FIND_AMOUNT) {
          const [lo, hi] = FIND_AMOUNT[c as Resource]!;
          const n = lo + Math.floor(this.rng() * (hi - lo + 1));
          loot[c as Resource] = (loot[c as Resource] ?? 0) + n;
          this.stats.mined[c as Resource] = (this.stats.mined[c as Resource] ?? 0) + n;
        }
        if (c === "spring") {
          this.springs.set(j, 14 + this.rng() * 10);
          this.stats.springs++;
        }
      }
    this.version++;
    this.revealRect(x - 3, y - 3, x + 3, y + 3, 1);
    // blasts shake the roof; gas turns it into a real explosion
    let collapsed = this.maybeCollapse(x, y, explosion || this.rng() < 0.35);
    if (explosion) {
      for (const j of Array.from(this.gas.keys())) if (Math.abs((j % MINE_W) - x) <= 3 && Math.abs(Math.floor(j / MINE_W) - y) <= 3) this.gas.delete(j);
      collapsed = collapsed.concat(this.maybeCollapse(x, y - 2, true));
    }
    return { cells, loot, collapsed, explosion, landmarks: hit.map((kind) => ({ kind, done: this.landmarkProgress(kind) >= 1 })) };
  }

  /* ------------------------------ the scanner ------------------------------ */

  /** seconds until the scanner can ping again */
  pingT = 0;
  static readonly PING_RADIUS = 5;
  static readonly PING_COOLDOWN = 12;

  /**
   * Sonar ping: maps the rock (not what's hidden in it) in a circle around a spot
   * near the tunnels. Returns how many cells came into view, or why it can't.
   */
  ping(x: number, y: number): number | string {
    if (this.pingT > 0) return `Scanner recharging… ${Math.ceil(this.pingT)}s`;
    if (!inMine(x, y)) return "Out of the mine.";
    const r = this.reach();
    let near = false;
    for (let dy = -6; dy <= 6 && !near; dy++) for (let dx = -6; dx <= 6 && !near; dx++) if (inMine(x + dx, y + dy) && r[idx(x + dx, y + dy)]) near = true;
    if (!near) return "Too far from your tunnels for the scanner to reach.";
    const R = Mine.PING_RADIUS;
    let n = 0;
    this.lastSignals = [];
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R || !inMine(x + dx, y + dy)) continue;
        const i = idx(x + dx, y + dy);
        if (this.seen[i] === 0) {
          this.seen[i] = 1;
          n++;
        }
        // the scanner picks up landmarks (big dense things) through the rock
        const lm = this.special.get(i);
        if (lm && this.seen[i] < 2 && MATERIALS[this.cells[i] as M].solid) {
          this.scan(i);
          if (!this.lastSignals.includes(lm)) this.lastSignals.push(lm);
        }
      }
    this.pingT = Mine.PING_COOLDOWN;
    this.version++;
    return n;
  }

  /* ------------------------------ building down here ------------------------------ */

  /** Prop the roof up (stops cave-ins nearby). */
  addSupport(w: World, x: number, y: number): string | null {
    if (!inMine(x, y)) return "Out of the mine.";
    const i = idx(x, y);
    if (this.cells[i] !== M.Open) return "Supports go in open tunnels.";
    if (this.supports.has(i)) return "There's already a support here.";
    for (const [r, n] of Object.entries(SUPPORT_COST) as [Resource, number][]) if (w.camp.stock[r] < n) return `Needs ${n} ${r}.`;
    for (const [r, n] of Object.entries(SUPPORT_COST) as [Resource, number][]) w.camp.stock[r] -= n;
    this.supports.add(i);
    this.version++;
    return null;
  }

  /** Make the lift go ~60 ft deeper (pays from the surface stockpile). */
  upgradeLift(w: World): string | null {
    if (this.liftMax >= LIFT_MAX) return "The lift already reaches the bottom.";
    const cost = liftUpgradeCost(this.liftMax);
    for (const [r, n] of Object.entries(cost) as [Resource, number][]) if (w.camp.stock[r] < n) return `Needs ${n} ${r}.`;
    for (const [r, n] of Object.entries(cost) as [Resource, number][]) w.camp.stock[r] -= n;
    this.liftMax = Math.min(LIFT_MAX, this.liftMax + LIFT_STEP);
    this.version++;
    return null;
  }

  callLift(row: number) {
    this.liftTo = Math.max(0, Math.min(this.liftMax, Math.round(row)));
  }

  /** Pump water out of the flooded tunnels around (x, y). Returns how much was removed. */
  pump(x: number, y: number, amount: number, t: MineTools) {
    this.waterAwake = true;
    let left = amount * (t.pump ? 2 : 1);
    const seenSet = new Set<number>();
    const q = [idx(x, y)];
    let removed = 0;
    while (q.length && left > 0) {
      const i = q.shift()!;
      if (seenSet.has(i)) continue;
      seenSet.add(i);
      const take = Math.min(left, this.water[i]);
      this.water[i] -= take;
      left -= take;
      removed += take;
      const cx = i % MINE_W;
      const cy = (i - cx) / MINE_W;
      if (Math.abs(cx - x) > 8 || Math.abs(cy - y) > 8) continue;
      for (const [a, b] of [[cx, cy + 1], [cx + 1, cy], [cx - 1, cy], [cx, cy - 1]]) if (inMine(a, b) && this.cells[idx(a, b)] === M.Open && this.water[idx(a, b)] > 0.001) q.push(idx(a, b));
    }
    return removed;
  }

  /* ------------------------------ hazards ------------------------------ */

  /** What hurts a person standing here (per second). */
  hazardAt(x: number, y: number) {
    const i = idx(x, y);
    return { gas: this.gas.has(i), heat: bandAt(y).heat > 0 && this.nearMagma(x, y) ? bandAt(y).heat * 4 : bandAt(y).heat, water: this.water[i] };
  }

  private nearMagma(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (this.at(x + dx, y + dy) === M.Magma) return true;
    return false;
  }

  /* ------------------------------ ticking ------------------------------ */

  update(_w: World, dt: number) {
    if (this.pingT > 0) this.pingT = Math.max(0, this.pingT - dt);
    for (const c of this.crates) c.t += dt;
    if (this.crates.length) this.crates = this.crates.filter((c) => c.t < 2.5);
    for (const b of this.blasts) b.t += dt;
    if (this.blasts.length) this.blasts = this.blasts.filter((b) => b.t < 1);
    for (const f of this.finds) f.t += dt;
    if (this.finds.length) this.finds = this.finds.filter((f) => f.t < 1.5);
    // the lift car glides toward its target
    if (this.liftY !== this.liftTo) {
      const d = this.liftTo - this.liftY;
      this.liftY += Math.sign(d) * Math.min(Math.abs(d), dt * 10);
    }
    for (const [i, t] of Array.from(this.gas)) {
      if (t - dt <= 0) this.gas.delete(i);
      else this.gas.set(i, t - dt);
    }
    if (!this.springs.size && !this.anyWater) return;
    // settled water sleeps until something changes (a dig, a cave-in, a pump, a new spring)
    if (!this.springs.size && !this.waterAwake && this.waterV === this.version) return;
    this.flowT += dt;
    while (this.flowT >= 0.1) {
      this.flowT -= 0.1;
      const moved = this.flow(0.1);
      this.waterAwake = moved > 1e-4 || this.springs.size > 0;
      this.waterV = this.version;
    }
  }

  private anyWater = false;

  /** Water: springs pour in, it falls first, then spreads sideways and levels out. Returns how much moved. */
  private flow(dt: number) {
    const W = this.water;
    let moved = 0;
    for (const [i, left] of Array.from(this.springs)) {
      if (this.cells[i] !== M.Open) {
        this.springs.delete(i);
        continue;
      }
      const add = Math.min(left, dt * 0.6, 1 - W[i]);
      W[i] += Math.max(0, add);
      moved += Math.max(0, add);
      // a full spring cell pushes into its neighbours
      if (add <= 0) {
        const x = i % MINE_W;
        const y = (i - x) / MINE_W;
        for (const [a, b] of [[x, y + 1], [x - 1, y], [x + 1, y]]) {
          if (!inMine(a, b)) continue;
          const j = idx(a, b);
          if (this.cells[j] === M.Open && W[j] < 1) {
            W[j] = Math.min(1, W[j] + dt * 0.6);
            break;
          }
        }
      }
      const rest = left - dt * 0.6;
      if (rest <= 0) this.springs.delete(i);
      else this.springs.set(i, rest);
    }
    let any = false;
    const flip = this.rng() < 0.5;
    for (let y = MINE_H - 2; y >= 1; y--) {
      for (let k = 0; k < MINE_W; k++) {
        const x = flip ? k : MINE_W - 1 - k;
        const i = idx(x, y);
        if (W[i] <= 0.001) {
          W[i] = 0;
          continue;
        }
        // rock holds no water, and an underground river carries off whatever runs into it
        if (this.cells[i] !== M.Open || this.river[i]) {
          moved += W[i];
          W[i] = 0;
          continue;
        }
        any = true;
        // fall
        const b = i + MINE_W;
        if (this.cells[b] === M.Open && W[b] < 1) {
          const mv = Math.min(W[i], 1 - W[b]);
          W[b] += mv;
          W[i] -= mv;
          moved += mv;
        }
        // spread
        for (const n of [x - 1, x + 1]) {
          if (n < 0 || n >= MINE_W || W[i] <= 0.01) continue;
          const j = idx(n, y);
          if (this.cells[j] !== M.Open) continue;
          const diff = (W[i] - W[j]) / 3;
          if (diff > 0.002) {
            W[j] += diff;
            W[i] -= diff;
            moved += diff;
          }
        }
      }
    }
    this.anyWater = any || this.springs.size > 0;
    return moved;
  }

  /* ------------------------------ fog ------------------------------ */

  private revealRect(x0: number, y0: number, x1: number, y1: number, v: number) {
    for (let y = Math.max(0, y0); y <= Math.min(MINE_H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(MINE_W - 1, x1); x++) {
        const i = idx(x, y);
        if (this.seen[i] < v) this.seen[i] = v;
      }
  }

  private revealCavern(x: number, y: number) {
    const q = [idx(x, y)];
    const done = new Set<number>();
    while (q.length && done.size < 4000) {
      const i = q.pop()!;
      if (done.has(i)) continue;
      done.add(i);
      const cx = i % MINE_W;
      const cy = (i - cx) / MINE_W;
      this.revealRect(cx - 1, cy - 1, cx + 1, cy + 1, 1);
      for (const [a, b] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) if (inMine(a, b) && this.cells[idx(a, b)] === M.Open && !done.has(idx(a, b))) q.push(idx(a, b));
    }
  }

  /* ------------------------------ paths ------------------------------ */

  /** Shortest walk between two cells through passable tunnels (null if there's no way). */
  path(ax: number, ay: number, bx: number, by: number): number[] | null {
    if (!this.passable(ax, ay) || !this.passable(bx, by)) return null;
    const start = idx(ax, ay);
    const goal = idx(bx, by);
    const prev = new Int32Array(N).fill(-1);
    prev[start] = start;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (i === goal) break;
      const x = i % MINE_W;
      const y = (i - x) / MINE_W;
      for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!this.passable(a, b)) continue;
        const j = idx(a, b);
        if (prev[j] !== -1) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    if (prev[goal] === -1) return null;
    const out: number[] = [];
    for (let i = goal; i !== start; i = prev[i]) out.push(i);
    out.push(start);
    return out.reverse();
  }

  /* ------------------------------ save / load ------------------------------ */

  serialize() {
    const diff: string[] = [];
    for (let i = 0; i < N; i++) if (this.cells[i] !== this.base[i]) diff.push(`${i.toString(36)}.${this.cells[i].toString(36)}`);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    // water that differs from the generated pools (a drained pool cell saves as 0)
    const water: [number, number][] = [];
    for (let i = 0; i < N; i++) if (Math.abs(this.water[i] - this.baseWater[i]) > 0.01) water.push([i, r2(this.water[i])]);
    // rich deposits partly chipped away (everything else is back to full from the seed)
    const oreLeft: [number, number][] = [];
    for (let i = 0; i < N; i++) if (this.ore[i] && MATERIALS[this.cells[i] as M].solid && this.oreLeft[i] !== this.oreHits(i)) oreLeft.push([i, this.oreLeft[i]]);
    const known: [number, Content][] = [];
    this.known.forEach((c, i) => {
      if (MATERIALS[this.cells[i] as M].solid) known.push([i, c]);
    });
    return {
      v: 1,
      seed: this.seed,
      cells: diff.join(","),
      seen: rle(this.seen),
      water,
      springs: Array.from(this.springs, ([i, n]) => [i, r2(n)] as [number, number]),
      gas: Array.from(this.gas, ([i, n]) => [i, Math.round(n)] as [number, number]),
      supports: Array.from(this.supports),
      known,
      oreLeft,
      looseTaken: Array.from(this.looseTaken),
      liftMax: this.liftMax,
      liftY: r2(this.liftY),
      stats: this.stats,
      orders: Array.from(this.orders),
      crew: this.crew.map((m) => ({ id: m.id, x: r2(m.x), y: r2(m.y), carry: m.carry, eatT: Math.round(m.eatT), target: m.target, experience: m.experience ?? 0 })),
      pending: Array.from(this.pending.keys()),
      healing: Array.from(this.healing),
      packs: this.packs.map((p) => ({ id: p.id, x: r2(p.x), y: r2(p.y), carry: p.carry, home: p.home })),
      charges: this.charges.map((c) => [c.cell, r2(c.t), c.by] as [number, number, number]),
      autoMine: this.autoMine,
      recall: this.recall,
      hauled: this.hauled,
      builds: this.builds.map((b) => [b.kind, b.x, b.y, r2(b.built), b.have ? 1 : 0, r2(b.grow)] as [string, number, number, number, number, number]),
      critters: this.critters.map((c) => [r2(c.x), r2(c.y), r2(c.hp)] as [number, number, number]),
      milestones: Array.from(this.milestones),
      landmarksDone: Array.from(this.landmarksDone),
      featuresFound: Array.from(this.featuresFound),
      discoveries: this.discoveries,
    };
  }

  load(d: ReturnType<Mine["serialize"]> | undefined) {
    if (!d || d.v !== 1) return;
    // a mine that was reset grows from its own seed
    if (typeof d.seed === "number" && d.seed !== this.seed) this.regenerate(d.seed);
    this.cells.set(this.base);
    if (d.cells)
      for (const part of d.cells.split(",")) {
        const [a, b] = part.split(".");
        const i = parseInt(a, 36);
        const m = parseInt(b, 36);
        if (i >= 0 && i < N && m in MATERIALS) this.cells[i] = m;
      }
    const seen = unrle(d.seen ?? "", N);
    if (seen) this.seen.set(seen);
    this.water.set(this.baseWater);
    for (const [i, v] of d.water ?? []) if (i >= 0 && i < N) this.water[i] = v;
    // pools only hold in open rock (a saved world may have dug or filled where one would be)
    for (let i = 0; i < N; i++) if (this.water[i] && this.cells[i] !== M.Open) this.water[i] = 0;
    this.anyWater = this.water.some((v) => v > 0.01);
    this.waterAwake = true;
    this.springs = new Map(d.springs ?? []);
    this.gas = new Map(d.gas ?? []);
    this.supports = new Set(d.supports ?? []);
    this.known = new Map(d.known ?? []);
    this.refillOre();
    for (const [i, n] of d.oreLeft ?? []) if (i >= 0 && i < N && this.ore[i]) this.oreLeft[i] = Math.max(1, Math.min(255, n));
    this.looseTaken = new Set((d.looseTaken ?? []).filter((i) => i >= 0 && i < N));
    for (const i of Array.from(this.looseTaken)) this.loose.delete(i);
    this.liftMax = Math.max(LIFT_START, Math.min(LIFT_MAX, d.liftMax ?? LIFT_START));
    this.liftY = this.liftTo = Math.min(this.liftMax, d.liftY ?? 0);
    this.stats = { ...this.stats, ...(d.stats ?? {}), mined: { ...(d.stats?.mined ?? {}) } };
    this.orders = new Map((d.orders ?? []).filter(([i]) => i >= 0 && i < N));
    this.crew = (d.crew ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, path: [], pi: 0, job: null, mode: "idle" as const, t: 0, carry: { ...(c.carry ?? {}) }, face: 1 as const, eatT: c.eatT ?? 90, target: Number.isInteger(c.target) && c.target! >= 0 && c.target! < N ? c.target : undefined, experience: c.experience ?? 0, anim: 0, thinkT: 0, bubble: null }));
    this.pending = new Map((d.pending ?? []).map((id) => [id, 0]));
    this.healing = new Set(d.healing ?? []);
    this.packs = (d.packs ?? []).map((p) => ({ id: p.id, x: p.x, y: p.y, path: [], pi: 0, carry: { ...(p.carry ?? {}) }, mode: "idle" as const, home: !!p.home, thinkT: 0, face: 1 as const, anim: 0, lonely: 0 }));
    this.charges = (d.charges ?? []).map(([cell, t, by]) => ({ cell, t, by }));
    this.autoMine = d.autoMine ?? true;
    this.recall = !!d.recall;
    this.hauled = { ...(d.hauled ?? {}) };
    this.critters = (d.critters ?? []).map(([x, y, hp]) => ({ id: this.nextCritterId++, x, y, hp, face: 1 as const, path: [], pi: 0, thinkT: 1, biteT: 0, hit: 0, anim: 0 }));
    this.milestones = new Set(d.milestones ?? []);
    this.landmarksDone = new Set((d.landmarksDone ?? []).filter((k) => k in LANDMARKS));
    this.featuresFound = new Set((d.featuresFound ?? []).filter((k) => k >= 0 && k < this.features.length));
    this.featureCheckV = -1;
    this.discoveries = (d.discoveries ?? []).filter((x) => x && typeof x.name === "string" && x.cell >= 0 && x.cell < N).slice(-30);
    this.builds = (d.builds ?? []).filter(([k]) => k in DEEP_DEFS).map(([kind, x, y, built, have, grow]) => ({ id: this.nextBuildId++, kind: kind as DeepKind, x, y, built, have: !!have, grow }));
    this.reindex();
  }
}

/** Run-length encode small values: "value*count" runs (count omitted when 1). */
export function rle(a: Uint8Array) {
  const out: string[] = [];
  let i = 0;
  while (i < a.length) {
    let j = i + 1;
    while (j < a.length && a[j] === a[i]) j++;
    out.push(j - i > 1 ? `${a[i]}*${(j - i).toString(36)}` : `${a[i]}`);
    i = j;
  }
  return out.join(",");
}

export function unrle(s: string, n: number): Uint8Array | null {
  if (!s) return null;
  const out = new Uint8Array(n);
  let p = 0;
  for (const run of s.split(",")) {
    const [v, c] = run.split("*");
    const count = c ? parseInt(c, 36) : 1;
    out.fill(Number(v), p, Math.min(n, p + count));
    p += count;
  }
  return p === n ? out : null;
}

