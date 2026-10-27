/* ------------------------------------------------------------------ */
/*  Colony: the settlement's newer pieces — buildings, Scorpions,      */
/*  resource deposits, the armory and the forge queue. Walls, towers,  */
/*  farms and raids stay in tribe.ts; huts stay in camp.ts.            */
/* ------------------------------------------------------------------ */
import { hallTick } from "./riderHall";
import { armourHit, scorpionMaxHp, scorpionWorks } from "./scorpionArmor";
import { feastTick } from "./feast";
import { CHARIOT_HP, chariotsUpdate } from "./chariots";
import { CHARIOT_TIERS } from "./chariotTiers";
import { armorWanted, isRider } from "./gear";
import { sidearmWanted } from "./territory";
import { ARMORS, ARTIFACTS, BUILDINGS, FORGE_ITEMS, HELMETS, HELMET_BY_ID, KITS, KIT_BY_ID, NODES, OUTFITS, OUTFIT_BY_ID, RES_INFO, SCORPION_TIERS, SHIELDS, SHIELD_BY_ID, WEAPONS, WEAPON_BY_ID, type Cost } from "../data/colony";
import { TECH } from "../data/facts";
import { hitDino } from "./tribe";
import { sp } from "../data/species";
import { sizeOf } from "./dinos";
import { shelterTiles, tileOf, TOWER_Z, WALK_Z } from "./nav";
import { P } from "./particles";
import { hash2 } from "./rng";
import { LM, REGION, isWalkTile, isWaterTile } from "./terrain";
import { type Chariot, type DragonHunt, MAP_H, MAP_W, OLD_MAP_H, OLD_MAP_W, T, TILE, type Building, type BuildingKind, type Dino, type Human, type NodeKind, type ResNode, type Resource, type Scorpion } from "./types";
import type { World } from "./world";
import type { ShieldLevels } from "./dragonShield";
import { ANIMAL_KINDS, insideWalls } from "./dinoBounds";

export interface DropOff {
  x: number;
  y: number;
  kind: "pile" | BuildingKind;
}

const FOOD = new Set<Resource>(["cooked", "fish", "crop", "flour", "berries", "meat"]);
/** Raw iron kept back for iron recipes before any is smelted into steel, and the steel stockpile it stops at. */
const STEEL_KEEP = 4;
const STEEL_CAP = 12;

/** Mostly stone: fire barely scorches it. */
const STONEWORK = new Set<BuildingKind>(["pyramid", "obelisk", "stoneCircle", "shelterDeep", "chamber", "shapingYard", "beamTower", "energyTower", "pylon", "resShield"]);

/** Energy one powered Scorpion shot uses. */
export const DRONE_SHOT = 3;

export class Colony {
  buildings: Building[] = [];
  scorpions: Scorpion[] = [];
  /** war chariots (chariots.ts) and the chariot dragon hunt under way */
  chariots: Chariot[] = [];
  hunt: DragonHunt | null = null;
  /** the feast table by the fire (feast.ts): roast on it, who's carrying it over, who's in line */
  feast = { food: 0, server: 0, queue: [] as number[], frontId: 0, frontAt: 0, eaten: 0 };
  nodes: ResNode[] = [];
  /** crafted gear waiting to be picked up: item id → count */
  armory: Record<string, number> = {};
  /** forge orders, first = next */
  queue: string[] = [];
  /** bumps whenever something that blocks movement changes */
  version = 0;
  /** smith currently crafting queue[0] */
  craftT = 0;
  /** how long a Scorpion has been waiting for its crew to arrive */
  private reserveT = new WeakMap<Scorpion, number>();
  /** one-time tribe crafts already made (bone knives, water skins …) */
  kits = new Set<string>();
  /** recipes the tribe has unlocked so far */
  known = new Set<string>();
  /** unlocked but not looked at yet (the forge shows a NEW badge) */
  fresh = new Set<string>();
  private primed = false;
  private recipeT = 0;
  private autoCraftT = 0;
  private wellT = 0;
  private settledWells = new WeakSet<Building>();
  /** last time spikes bit each dino */
  private spiked = new WeakMap<Dino, number>();

  /* ----------------------------- buildings ----------------------------- */

  /** Footprint tiles of a building kind placed with its base centred near (x, y). */
  footprint(kind: BuildingKind, x: number, y: number) {
    const def = BUILDINGS[kind];
    const tx = Math.floor(x / TILE - def.w / 2 + 0.5);
    const ty = Math.floor(y / TILE) - def.h + (def.solid ? 0 : 1);
    return { tx, ty, w: def.w, h: def.h };
  }

  /** A finished bridge deck on this tile: anything can be built on top of it. */
  bridgeAt(tx: number, ty: number) {
    return this.buildings.some((b) => b.kind === "bridge" && b.built >= 1 && b.tx === tx && b.ty === ty);
  }

  /** Solid footing for a structure: dry, firm land or a finished bridge deck. */
  footing(w: World, tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    const t = w.terrain.tiles[ty * MAP_W + tx] as T;
    if (isWaterTile(t) || !isWalkTile(t)) return this.bridgeAt(tx, ty);
    return t !== T.Tar && t !== T.Cave;
  }

  canPlace(w: World, kind: BuildingKind, x: number, y: number): string | null {
    if (ANIMAL_KINDS.has(kind) && insideWalls(w, x, y)) return "Animals live outside the walls: put it outside the gates.";
    const def = BUILDINGS[kind];
    const fp = this.footprint(kind, x, y);
    const occupied = this.occupied(w, kind === "boneTorch");
    for (let dy = 0; dy < fp.h; dy++)
      for (let dx = 0; dx < fp.w; dx++) {
        const tx = fp.tx + dx;
        const ty = fp.ty + dy;
        if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return "Too close to the edge of the world.";
        const t = w.terrain.tiles[ty * MAP_W + tx] as T;
        if (kind === "well") {
          if (t !== T.Shallow || w.terrain.salt[ty * MAP_W + tx]) return "Wells need shallow fresh water.";
        } else if (kind === "bridge") {
          if (!isWaterTile(t)) return "Bridges go over water.";
          if (this.buildings.some((b) => b.kind === "bridge" && b.tx === tx && b.ty === ty)) return "There's a bridge there already.";
        } else if (!this.footing(w, tx, ty)) return "That ground won't hold a building.";
        if (occupied.has(ty * MAP_W + tx)) return "Something is already there.";
      }
    // keep the door free for solid buildings
    if (def.solid) {
      const door = (fp.ty + fp.h) * MAP_W + fp.tx + Math.floor(fp.w / 2);
      if (occupied.has(door) || !(isWalkTile(w.terrain.tiles[door] as T) || this.bridgeAt(door % MAP_W, Math.floor(door / MAP_W)))) return "The doorway would be blocked.";
    }
    return null;
  }

  /** Tiles used by walls, towers, huts, buildings + ground Scorpions (bridge decks are free to build on). */
  occupied(w: World, allowPath = false) {
    const s = new Set<number>();
    for (const wl of w.tribe.walls) s.add(wl.ty * MAP_W + wl.tx);
    for (const t of w.tribe.towers) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.add((t.ty + dy) * MAP_W + t.tx + dx);
    for (const b of this.buildings) {
      if (b.kind === "bridge" || allowPath && b.kind === "path" || b.lift) continue;
      const d = BUILDINGS[b.kind];
      for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) s.add((b.ty + dy) * MAP_W + b.tx + dx);
    }
    for (const sh of w.shelters) if (!sh.lift) for (const i of shelterTiles(sh.x, sh.y)) s.add(i);
    for (const sc of this.scorpions) if (sc.mount === "ground") s.add(sc.ty * MAP_W + sc.tx);
    return s;
  }

  addBuilding(w: World, kind: BuildingKind, x: number, y: number): Building | null {
    if (w.tribe.vetoed(kind, x, y)) return null;
    if (this.canPlace(w, kind, x, y)) return null;
    const def = BUILDINGS[kind];
    const fp = this.footprint(kind, x, y);
    const b: Building = {
      id: w.nextId(),
      kind,
      tx: fp.tx,
      ty: fp.ty,
      x: (fp.tx + fp.w / 2) * TILE,
      y: (fp.ty + fp.h) * TILE - (def.solid ? 0 : TILE / 2),
      built: 0,
      have: {},
      hp: def.hp,
    };
    this.buildings.push(b);
    this.version++;
    return b;
  }

  removeBuilding(b: Building) {
    const i = this.buildings.indexOf(b);
    if (i >= 0) this.buildings.splice(i, 1);
    this.version++;
  }

  finished(kind: BuildingKind) {
    return this.buildings.some((b) => b.kind === kind && b.built >= 1);
  }

  /** The water around a completed well settles into grass; rivers stay open. */
  private settleWell(w: World, well: Building) {
    const start = well.ty * MAP_W + well.tx;
    if (w.terrain.tiles[start] !== T.Shallow) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.hypot(dx, dy) > 2.5) continue;
      const tx = well.tx + dx;
      const ty = well.ty + dy;
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const i = ty * MAP_W + tx;
      const tile = w.terrain.tiles[i] as T;
      if ((tile === T.Shallow || tile === T.Deep) && !w.terrain.salt[i]) w.terrain.setTile(tx, ty, T.Grass);
    }
  }

  /** People can still draw fresh water after the pool around a well turns to grass. */
  nearestWater(w: World, x: number, y: number, maxDist = 2400): { x: number; y: number } | null {
    let best = w.terrain.nearestDrink(x, y, maxDist);
    let distance = best ? Math.hypot(best.x - x, best.y - y) : maxDist;
    for (const b of this.buildings) {
      if (b.kind !== "well" || b.built < 1) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < distance) {
        best = { x: b.x, y: b.y };
        distance = d;
      }
    }
    return best;
  }

  /** Door spot in front of a solid building (where people stand to use it). */
  door(b: Building) {
    const def = BUILDINGS[b.kind];
    if (!def.solid) return { x: b.x, y: b.y };
    return { x: (b.tx + Math.floor(def.w / 2)) * TILE + TILE / 2, y: (b.ty + def.h) * TILE + TILE / 2 };
  }

  /** Nearest place to unload a resource. */
  dropOff(w: World, x: number, y: number, r: Resource): DropOff {
    const c = w.camp;
    let best: DropOff = { x: c.pileX - 10, y: c.pileY + 10, kind: "pile" };
    let bd = Math.hypot(best.x - x, best.y - y);
    for (const b of this.buildings) {
      if (b.built < 1) continue;
      const ok =
        b.kind === "storage" ||
        (b.kind === "post" && !FOOD.has(r) && r !== "water") ||
        (b.kind === "foodStore" && FOOD.has(r)) ||
        (b.kind === "waterStore" && r === "water") ||
        (b.kind === "tannery" && r === "hide");
      if (!ok) continue;
      const d = this.door(b);
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < bd) {
        bd = dist;
        best = { x: d.x, y: d.y, kind: b.kind };
      }
    }
    return best;
  }

  /* ----------------------------- scorpions ----------------------------- */

  scorpionAt(tx: number, ty: number) {
    return this.scorpions.find((s) => s.tx === tx && s.ty === ty) ?? null;
  }

  /** The visible tower, including its raised platform, snaps to one mount. */
  scorpionSpot(w: World, x: number, y: number) {
    const tower = w.tribe.towers.find((t) => x >= t.x - 34 && x <= t.x + 34 && y >= t.y - 90 && y <= t.y + 4);
    const tx = tower ? tower.tx : Math.floor(x / TILE);
    const ty = tower ? tower.ty : Math.floor(y / TILE);
    const wl = tower ? null : w.tribe.wallAt(tx, ty);
    let mount: Scorpion["mount"] = "ground";
    if (tower) mount = "tower";
    else if (wl && wl.part !== "stairs") mount = "wall";
    let why: string | null = null;
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) why = "Outside the world.";
    else if (this.scorpions.some((s) => Math.abs(s.tx - tx) <= 1 && Math.abs(s.ty - ty) <= 1)) why = "There's a Scorpion right there.";
    else if (!tower && (!wl || wl.part === "stairs")) {
      if (wl) why = "Not on the stairs!";
      const t = w.terrain.tiles[ty * MAP_W + tx] as T;
      if (!why && (!isWalkTile(t) || isWaterTile(t) || t === T.Tar)) why = "It needs solid ground.";
      if (!why && this.occupied(w).has(ty * MAP_W + tx)) why = "Something is already there.";
    }
    return { x: tower ? tower.x : x, y: tower ? tower.y : y, tx, ty, mount, why };
  }

  addScorpion(w: World, x: number, y: number): Scorpion | string {
    if (w.tribe.vetoed("scorpion", x, y)) return "Removed here earlier.";
    const spot = this.scorpionSpot(w, x, y);
    if (spot.why) return spot.why;
    const { tx, ty, mount } = spot;
    const tower = mount === "tower" ? w.tribe.towers.find((t) => t.tx === tx && t.ty === ty) : null;
    const s: Scorpion = {
      id: w.nextId(),
      x: tower ? tower.x : tx * TILE + TILE / 2,
      y: tower ? tower.y : ty * TILE + TILE / 2 + (mount === "wall" ? 6 : 0),
      tx,
      ty,
      tier: 1,
      built: 0,
      have: {},
      up: false,
      hp: SCORPION_TIERS[0].hp,
      aim: Math.PI / 2,
      reload: 0,
      crew: 0,
      mount,
      kick: 0,
    };
    this.scorpions.push(s);
    this.version++;
    return s;
  }

  /** Height the bolt leaves from. */
  scorpionZ(s: Scorpion) {
    return s.mount === "tower" ? TOWER_Z + 10 : s.mount === "wall" ? WALK_Z + 8 : 12;
  }

  /** Where the operator stands (and on which level). */
  crewSpot(s: Scorpion) {
    if (s.mount === "ground") return { x: s.x - 2, y: s.y + 18, top: false };
    return { x: s.x, y: s.y - (s.mount === "wall" ? 6 : 0), top: true };
  }

  /* ----------------------------- deposits ----------------------------- */

  /** Scatter deposits once per world (deterministic from the seed). */
  generateNodes(w: World) {
    const seed = w.seed;
    const tiles = w.terrain.tiles;
    let salt = 1;
    const place = (kind: NodeKind, n: number, ok: (t: T, tx: number, ty: number) => boolean, near?: { x: number; y: number; r: number }) => {
      let placed = 0;
      for (let k = 0; k < 4000 && placed < n; k++) {
        const r1 = hash2(k, salt * 31 + n, seed + 77);
        const r2 = hash2(k * 7 + 3, salt * 17, seed + 91);
        // the old valley's deposits stay where they always were (the eastern lands get their own: generateEastNodes)
        let tx = Math.floor(r1 * OLD_MAP_W);
        let ty = Math.floor(r2 * OLD_MAP_H);
        if (near) {
          const a = r1 * Math.PI * 2;
          const rr = Math.sqrt(r2) * near.r;
          tx = Math.round(near.x + Math.cos(a) * rr);
          ty = Math.round(near.y + Math.sin(a) * rr);
        }
        if (tx < 2 || ty < 2 || tx >= MAP_W - 2 || ty >= MAP_H - 2) continue;
        const t = tiles[ty * MAP_W + tx] as T;
        if (!ok(t, tx, ty)) continue;
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE / 2;
        if (this.nodes.some((o) => Math.hypot(o.x - x, o.y - y) < 120)) continue;
        if (Math.hypot(x - w.camp.x, y - w.camp.y) < 240) continue;
        const def = NODES[kind];
        const amt = Math.round(def.amount[0] + hash2(tx, ty, seed + 5) * (def.amount[1] - def.amount[0]));
        this.nodes.push({ id: w.nextId(), kind, x, y, amount: amt, max: amt, found: !def.hidden, variant: Math.floor(hash2(ty, tx, seed) * 4) });
        placed++;
      }
      salt++;
    };
    const nextTo = (tx: number, ty: number, pred: (t: T) => boolean) => [tiles[ty * MAP_W + tx + 1], tiles[ty * MAP_W + tx - 1], tiles[(ty + 1) * MAP_W + tx], tiles[(ty - 1) * MAP_W + tx]].some((t) => pred(t as T));
    const walk = (t: T) => isWalkTile(t) && !isWaterTile(t) && t !== T.Tar && t !== T.Cave;
    place("stone", 6, (t) => t === T.Rock);
    place("flint", 5, (t, tx, ty) => walk(t) && (t === T.Rock || nextTo(tx, ty, (o) => o === T.Cliff || o === T.Rock)));
    place("clay", 5, (t, tx, ty) => (t === T.Sand || t === T.Mud) && nextTo(tx, ty, (o) => o === T.River || o === T.Shallow));
    place("iron", 6, (t, tx, ty) => walk(t) && nextTo(tx, ty, (o) => o === T.Mountain || o === T.Rock));
    const frost = w.terrain.gen >= 3 ? LM.peaks : LM.frost;
    place("iron", 3, (t) => walk(t), { x: frost.x, y: frost.y, r: 11 });
    place("gold", 2, (t, tx, ty) => walk(t) && nextTo(tx, ty, (o) => o === T.Mountain));
    place("gold", 1, (t) => walk(t), { x: frost.x, y: frost.y, r: 9 });
    place("obsidian", 4, (t) => t === T.Basalt || t === T.Volcano);
    place("salt", 3, (t, tx, ty) => t === T.Sand && w.terrain.salt[ty * MAP_W + tx + 1] + w.terrain.salt[(ty + 1) * MAP_W + tx] > 0);
    place("tar", 3, (t, tx, ty) => walk(t) && nextTo(tx, ty, (o) => o === T.Tar));
    place("artifact", 5, (t) => walk(t) && t !== T.Nest);
    place("fossil", 3, (t) => walk(t) && (t === T.Sand || t === T.Rock || t === T.Dirt || t === T.Grass));
    this.generateCivNodes(w, salt + 40);
    place("limestone", 5, (t, tx, ty) => walk(t) && (t === T.Rock || nextTo(tx, ty, (o) => o === T.Cliff || o === T.Rock)));
    this.generateEastNodes(w);
  }

  /**
   * Deposits out in the eastern lands (new worlds at birth; older worlds the first time they load
   * with the bigger map): rare minerals high in the Great Peaks, salt, copper + fossil beds in the
   * desert, ordinary stone, flint + clay in the lake country.
   */
  generateEastNodes(w: World) {
    const seed = w.seed + 4242;
    const tiles = w.terrain.tiles;
    const walk = (t: T) => isWalkTile(t) && !isWaterTile(t) && t !== T.Tar && t !== T.Cave;
    const nextTo = (tx: number, ty: number, pred: (t: T) => boolean) => [tiles[ty * MAP_W + tx + 1], tiles[ty * MAP_W + tx - 1], tiles[(ty + 1) * MAP_W + tx], tiles[(ty - 1) * MAP_W + tx]].some((t) => pred(t as T));
    const reg = (tx: number, ty: number) => w.terrain.region[ty * MAP_W + tx];
    let salt = 300;
    const place = (kind: NodeKind, n: number, ok: (t: T, tx: number, ty: number) => boolean) => {
      let placed = 0;
      for (let k = 0; k < 6000 && placed < n; k++) {
        const tx = Math.floor(150 + hash2(k, salt * 23 + n, seed) * (MAP_W - 152));
        const ty = Math.floor(2 + hash2(k * 3 + 5, salt * 11, seed + 7) * (MAP_H - 4));
        if (tx < OLD_MAP_W - 10 || tx >= MAP_W - 2 || ty >= MAP_H - 2) continue;
        const t = tiles[ty * MAP_W + tx] as T;
        if (!walk(t) || !ok(t, tx, ty)) continue;
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE / 2;
        if (this.nodes.some((o) => Math.abs(o.x - x) < 130 && Math.abs(o.y - y) < 130 && Math.hypot(o.x - x, o.y - y) < 130)) continue;
        const def = NODES[kind];
        const amt = Math.round(def.amount[0] + hash2(tx, ty, seed + 5) * (def.amount[1] - def.amount[0]));
        this.nodes.push({ id: w.nextId(), kind, x, y, amount: amt, max: amt, found: !def.hidden, variant: Math.floor(hash2(ty, tx, seed) * 4) });
        placed++;
      }
      salt++;
    };
    const peaks = (tx: number, ty: number) => reg(tx, ty) === REGION.peaks;
    const high = (tx: number, ty: number) => w.terrain.elev[ty * MAP_W + tx] > 0.55;
    const desert = (tx: number, ty: number) => reg(tx, ty) === REGION.desert;
    // the Great Peaks: the richest rock in the land (the best of it up by the snow)
    place("stone", 4, (t, tx, ty) => peaks(tx, ty) && t === T.Rock);
    place("iron", 4, (t, tx, ty) => peaks(tx, ty) && nextTo(tx, ty, (o) => o === T.Mountain || o === T.Cliff));
    place("silver", 3, (t, tx, ty) => peaks(tx, ty) && high(tx, ty));
    place("gold", 3, (t, tx, ty) => peaks(tx, ty) && high(tx, ty) && nextTo(tx, ty, (o) => o === T.Mountain || o === T.Cliff));
    place("crystal", 3, (t, tx, ty) => peaks(tx, ty) && (t === T.Snow || t === T.Ice || nextTo(tx, ty, (o) => o === T.Cave || o === T.Ice)));
    place("quartz", 3, (t, tx, ty) => peaks(tx, ty) && nextTo(tx, ty, (o) => o === T.Cliff || o === T.Mountain));
    place("diamond", 1, (t, tx, ty) => peaks(tx, ty) && w.terrain.elev[ty * MAP_W + tx] > 0.66);
    place("coal", 2, (t, tx, ty) => peaks(tx, ty) && !high(tx, ty) && t === T.Rock);
    // the desert: salt pans, copper in the outcrops, fossil beds in the sand, old relics, a fallen star
    place("salt", 3, (t, tx, ty) => desert(tx, ty) && (t === T.Dirt || t === T.Sand));
    place("copper", 3, (t, tx, ty) => desert(tx, ty) && (t === T.Rock || nextTo(tx, ty, (o) => o === T.Rock)));
    place("fossil", 3, (t, tx, ty) => desert(tx, ty) && (t === T.Dune || t === T.Sand));
    place("artifact", 2, (t, tx, ty) => desert(tx, ty));
    place("obsidian", 1, (t, tx, ty) => desert(tx, ty) && t === T.Rock);
    place("meteorite", 1, (t, tx, ty) => desert(tx, ty) && t === T.Dune);
    // the lake country south of the peaks
    place("stone", 3, (t, tx, ty) => !peaks(tx, ty) && !desert(tx, ty) && t === T.Rock);
    place("flint", 2, (t, tx, ty) => !peaks(tx, ty) && !desert(tx, ty) && nextTo(tx, ty, (o) => o === T.Rock || o === T.Cliff));
    place("clay", 3, (t, tx, ty) => !desert(tx, ty) && (t === T.Sand || t === T.Mud || t === T.Grass) && nextTo(tx, ty, (o) => o === T.River || o === T.Shallow));
  }

  /** Copper, quartz, magnetite, crystal + an old meteor strike. */
  generateCivNodes(w: World, salt = 60) {
    const seed = w.seed;
    const tiles = w.terrain.tiles;
    const walk = (t: T) => isWalkTile(t) && !isWaterTile(t) && t !== T.Tar && t !== T.Cave;
    const nextTo = (tx: number, ty: number, pred: (t: T) => boolean) => [tiles[ty * MAP_W + tx + 1], tiles[ty * MAP_W + tx - 1], tiles[(ty + 1) * MAP_W + tx], tiles[(ty - 1) * MAP_W + tx]].some((t) => pred(t as T));
    const place = (kind: NodeKind, n: number, ok: (t: T, tx: number, ty: number) => boolean, near?: { x: number; y: number; r: number }) => {
      let placed = 0;
      for (let k = 0; k < 5000 && placed < n; k++) {
        const r1 = hash2(k, salt * 29 + n, seed + 131);
        const r2 = hash2(k * 5 + 1, salt * 13, seed + 171);
        let tx = Math.floor(r1 * OLD_MAP_W);
        let ty = Math.floor(r2 * OLD_MAP_H);
        if (near) {
          const a = r1 * Math.PI * 2;
          const rr = Math.sqrt(r2) * near.r;
          tx = Math.round(near.x + Math.cos(a) * rr);
          ty = Math.round(near.y + Math.sin(a) * rr);
        }
        if (tx < 2 || ty < 2 || tx >= MAP_W - 2 || ty >= MAP_H - 2) continue;
        const t = tiles[ty * MAP_W + tx] as T;
        if (!walk(t) || !ok(t, tx, ty)) continue;
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE / 2;
        if (this.nodes.some((o) => Math.hypot(o.x - x, o.y - y) < 110)) continue;
        if (Math.hypot(x - w.camp.x, y - w.camp.y) < 300) continue;
        const def = NODES[kind];
        const amt = Math.round(def.amount[0] + hash2(tx, ty, seed + 9) * (def.amount[1] - def.amount[0]));
        this.nodes.push({ id: w.nextId(), kind, x, y, amount: amt, max: amt, found: !def.hidden, variant: Math.floor(hash2(ty, tx, seed + 2) * 4) });
        placed++;
      }
      salt++;
    };
    const rocky = (o: T) => o === T.Rock || o === T.Cliff || o === T.Mountain;
    place("copper", 4, (t, tx, ty) => t === T.Rock || nextTo(tx, ty, rocky));
    place("quartz", 4, (_t, tx, ty) => nextTo(tx, ty, (o) => o === T.Mountain || o === T.Cliff));
    place("magnetite", 3, (t, tx, ty) => t === T.Basalt || nextTo(tx, ty, (o) => o === T.Basalt || o === T.Mountain));
    place("crystal", 2, (_t, tx, ty) => nextTo(tx, ty, (o) => o === T.Mountain || o === T.Cave));
    const frost = w.terrain.gen >= 3 ? LM.peaks : LM.frost;
    place("crystal", 1, () => true, { x: frost.x, y: frost.y, r: 10 });
    place("meteorite", 1, (t) => t === T.Grass || t === T.Dirt || t === T.Sand);
  }

  nodeById(id: number) {
    return this.nodes.find((n) => n.id === id) ?? null;
  }

  /** Someone walked near a hidden deposit: it's found! */
  discoverAround(w: World, x: number, y: number, r = 150) {
    for (const n of this.nodes) {
      if (n.found || Math.abs(n.x - x) > r || Math.abs(n.y - y) > r || Math.hypot(n.x - x, n.y - y) > r) continue;
      n.found = true;
      const def = NODES[n.kind];
      w.particles.burst(P.Star, n.x, n.y, 4, 30, { z: 10, size: 5, max: 1 });
      w.sfx("sticker", n.x, n.y, 0.5);
      w.toast(def.icon, `${def.name} discovered!${n.kind === "gold" ? " Shiny!" : n.kind === "artifact" ? " Something's buried here…" : ""}`, n.x, n.y);
      if (n.kind === "gold") w.discover("gold", n.x, n.y);
      w.pois.push({ x: n.x, y: n.y, t: w.elapsed });
    }
  }

  /** One dig at a deposit. Returns what was dug up (and how much). */
  mine(w: World, n: ResNode): { r: Resource | null; amount: number } {
    const def = NODES[n.kind];
    const boost = (n.kind === "copper" || n.kind === "quartz" || n.kind === "magnetite" || n.kind === "crystal") && this.kits.has("drill") ? 2 : n.kind === "stone" && this.kits.has("cutter") ? 1.5 : 1;
    const take = Math.min(Math.round(def.per * boost), n.amount);
    n.amount -= take;
    w.particles.burst(P.Rock, n.x, n.y, 4, 40, { vz: 60, g: 200, size: 2.5, max: 0.7, color: def.color });
    if (n.kind === "artifact") {
      const a = ARTIFACTS[Math.floor(w.rng() * ARTIFACTS.length)];
      w.toast(a.icon, `The diggers found ${a.name}!`, n.x, n.y);
      w.discover("artifact", n.x, n.y);
      w.camp.stock.gold += 1;
    } else if (n.kind === "fossil") {
      const s = ["trex", "trike", "brachio", "stego", "raptor", "ptera"][Math.floor(w.rng() * 6)] as Dino["species"];
      w.addItem("fossil", n.x + 20, n.y + 8, { species: s });
      w.toast("🦴", `A ${sp(s).nick} fossil came out of the bone bed!`, n.x, n.y);
      w.discover("fossil", n.x, n.y);
    }
    if (n.amount <= 0) {
      this.nodes.splice(this.nodes.indexOf(n), 1);
      w.particles.burst(P.Dust, n.x, n.y, 8, 40, { size: 8, max: 0.9, color: "rgba(160,140,110,0.6)" });
    }
    return { r: def.gives, amount: take };
  }

  /* ----------------------------- forge ----------------------------- */

  /** Is there a station that can make this item? */
  canCraft(w: World, id: string) {
    const it = FORGE_ITEMS.find((f) => f.id === id);
    if (!it) return false;
    if (it.tech && !w.camp.learned.has(it.tech)) return false;
    if (it.civ && !w.civ.has(it.civ)) return false;
    if (it.cat === "kits" && this.kits.has(id)) return false;
    if (it.at === "workshop") return this.finished("workshop") || this.finished("blacksmith");
    if (it.at === "blacksmith") return this.finished("blacksmith");
    if (it.at === "tannery") return this.finished("tannery");
    if (it.at === "fireStation") return this.finished("fireStation");
    return true;
  }

  craftCost(id: string): Cost {
    return FORGE_ITEMS.find((f) => f.id === id)?.cost ?? {};
  }

  /** Next queued item a station can make right now (others wait for their building / invention). */
  private nextCraftable(w: World) {
    return this.queue.findIndex((id) => this.canCraft(w, id));
  }

  /** Bring the first makeable item to the front of the queue. Returns its id (or null). */
  current(w: World): string | null {
    const i = this.nextCraftable(w);
    if (i < 0) return null;
    if (i > 0 && this.craftT <= 0) {
      const [id] = this.queue.splice(i, 1);
      this.queue.unshift(id);
    }
    return this.queue[0];
  }

  /** Where the smith works on the current item. */
  station(w: World): { x: number; y: number } {
    const id = this.current(w);
    const at = FORGE_ITEMS.find((f) => f.id === id)?.at;
    const b = this.buildings.find((x) => x.built >= 1 && (at === "blacksmith" ? x.kind === "blacksmith" : at === "tannery" ? x.kind === "tannery" : at === "fireStation" ? x.kind === "fireStation" : x.kind === "workshop" || x.kind === "blacksmith"));
    if (b && at !== "camp") return this.door(b);
    return { x: w.camp.craftX + 12, y: w.camp.craftY };
  }

  /** The resource the forge queue is short of (so gatherers can fetch it). */
  missing(w: World): Resource | null {
    const id = this.current(w);
    if (!id) return null;
    const cost = this.craftCost(id);
    for (const [r, n] of Object.entries(cost) as [Resource, number][]) if (w.camp.stock[r] < n) return r;
    return null;
  }

  affordable(w: World, cost: Cost) {
    return (Object.entries(cost) as [Resource, number][]).every(([r, n]) => w.camp.stock[r] >= n);
  }

  /** Auto workers keep the camp supplied with useful gear without overtaking player orders or research. */
  private planAutoCraft(w: World) {
    if (this.queue.length || this.craftT > 0) return;
    const people = w.humans.filter((h) => !h.child && !h.stranger && !h.under);
    if (!people.length || !people.some((h) => h.role === "auto")) return;
    const goal = w.camp.goal && !w.camp.learned.has(w.camp.goal) ? TECH[w.camp.goal].needs : {};
    const civGoal = w.civ.current && !w.civ.paid ? w.civ.costOf(w.civ.current) : {};
    const canMake = (id: string, cost: Cost) => this.canCraft(w, id) && (Object.entries(cost) as [Resource, number][]).every(([r, n]) => w.camp.stock[r] - n >= Math.min(w.camp.stock[r], (goal[r] ?? 0) + (civGoal[r] ?? 0)));
    const queue = (id: string) => { this.queue.push(id); this.version++; };
    const owned = (id: string, equipped: (h: Human) => boolean) => (this.armory[id] ?? 0) + people.filter(equipped).length;

    for (const id of ["boneKnives", "waterSkins", "hideCovers", "storageWraps", "cutter", "drill", "harness", "torch", "precision", "copperPick", "shovel", "chisel", "minerPack", "reinforcedPick", "diamondDrill", "steelSaddles"]) {
      const kit = KITS.find((item) => item.id === id);
      if (kit && !this.kits.has(id) && canMake(id, kit.cost) && (!["copperPick", "shovel", "chisel", "minerPack", "reinforcedPick", "diamondDrill"].includes(id) || w.mine.crew.length > 0) && (id !== "steelSaddles" || people.some(isRider))) return queue(id);
    }

    const fighters = people.filter((h) => ["guard", "hunter", "dragonSlayer", "eggRunner"].includes(w.tribe.roleOf(h)));
    const fighterTarget = Math.min(people.length, Math.max(fighters.length, Math.ceil(people.length * 0.35)));
    // a sidearm for everyone (a mix of shock sticks + ray guns), before the fighters' main weapons
    const armed = sidearmWanted(w, people);
    if (armed && canMake(armed, WEAPON_BY_ID[armed].cost)) return queue(armed);
    // (the wooden club is everyone's fallback, never crafted)
    const weapons = WEAPONS.filter((item) => !item.sidearm && item.id !== "club" && (item.id !== "nightSidearm" || w.shifts.mode === "split")).filter((item) => canMake(item.id, item.cost)).sort((a, b) => b.dmg - a.dmg);
    for (const item of weapons) {
      const enough = WEAPONS.filter((candidate) => candidate.dmg >= item.dmg).reduce((n, candidate) => n + owned(candidate.id, (h) => h.gear.weapon === candidate.id), 0);
      if (enough < fighterTarget) return queue(item.id);
    }

    for (const id of ["dragonMail", "runnerKit"]) {
      const item = OUTFITS.find((outfit) => outfit.id === id);
      const role = id === "dragonMail" ? "dragonSlayer" : "eggRunner";
      const target = people.filter((h) => w.tribe.roleOf(h) === role).length;
      if (item && target > owned(id, (h) => h.gear.outfit === id) && canMake(id, item.cost)) return queue(id);
    }

    // body armour: rider armour for the riders, the heaviest plate for the fighters, hide for everyone (gear.ts)
    const want = armorWanted(w, people, fighterTarget);
    const rider = ARMORS.find((a) => a.mounted);
    if (rider && want.rider > owned(rider.id, (h) => h.gear.armor === rider.id) && canMake(rider.id, rider.cost)) return queue(rider.id);
    for (const item of ARMORS.filter((a) => !a.mounted).sort((a, b) => b.armor - a.armor)) {
      if (!canMake(item.id, item.cost)) continue;
      const enough = ARMORS.filter((candidate) => candidate.armor >= item.armor).reduce((n, candidate) => n + owned(candidate.id, (h) => h.gear.armor === candidate.id), 0);
      if (enough < (item.look === "hide" ? want.any : want.heavy)) return queue(item.id);
    }

    const outfitScore = (id: string) => {
      const item = OUTFIT_BY_ID[id];
      if (!item) return 0;
      return item.rain * (0.4 + w.weather.rain * 1.5 + w.weather.storm) + item.warmth * (0.4 + Math.max(0, 0.45 - w.weather.temp) * 2 + w.weather.snow * 1.5) + item.armor * 2;
    };
    const outfits = OUTFITS.filter((item) => !["dragonMail", "runnerKit"].includes(item.id) && canMake(item.id, item.cost)).sort((a, b) => outfitScore(b.id) - outfitScore(a.id));
    for (const item of outfits) {
      const score = outfitScore(item.id);
      const enough = OUTFITS.filter((candidate) => outfitScore(candidate.id) >= score - 0.01).reduce((n, candidate) => n + owned(candidate.id, (h) => h.gear.outfit === candidate.id), 0);
      if (enough < people.length) return queue(item.id);
    }

    for (const item of [...SHIELDS].reverse()) {
      if (!canMake(item.id, item.cost)) continue;
      const enough = SHIELDS.filter((candidate) => candidate.tier >= item.tier).reduce((n, candidate) => n + owned(candidate.id, (h) => h.gear.shield === candidate.tier), 0);
      if (enough < fighterTarget) return queue(item.id);
    }
    for (const item of [...HELMETS].reverse()) {
      if (!canMake(item.id, item.cost)) continue;
      const enough = HELMETS.filter((candidate) => candidate.armor >= item.armor).reduce((n, candidate) => n + owned(candidate.id, (h) => h.gear.helmet === candidate.id), 0);
      if (enough < people.length) return queue(item.id);
    }
  }

  /** Smith hammering. Returns true when an item is finished. */
  forgeTick(w: World, h: Human, dt: number) {
    const id = this.current(w);
    if (!id) return false;
    const cost = this.craftCost(id);
    if (this.craftT <= 0 && !this.affordable(w, cost)) return false;
    if (this.craftT <= 0) for (const [r, n] of Object.entries(cost) as [Resource, number][]) w.camp.stock[r] -= n;
    this.craftT += dt;
    if (w.rng() < dt * 5) w.particles.spawn(P.Spark, h.x + h.dir * 10, h.y, { z: 10, vz: 40, vx: (w.rng() - 0.5) * 60, g: 200, size: 1.6, max: 0.4, color: "#ffd27a" });
    if (w.rng() < dt * 3) w.sfx("clack", h.x, h.y, 0.4);
    if (this.craftT < 6) return false;
    this.craftT = 0;
    this.queue.shift();
    const it = FORGE_ITEMS.find((f) => f.id === id);
    if (it?.cat === "kits") {
      // tribe-wide: everyone benefits at once
      this.kits.add(id);
      this.queue = this.queue.filter((q) => q !== id);
      w.celebrate("Ooh!");
      w.toast(it.icon, `${KIT_BY_ID[id].name} done! ${KIT_BY_ID[id].tip}`, h.x, h.y);
      w.shelterVersion++;
      return true;
    }
    this.armory[id] = (this.armory[id] ?? 0) + 1;
    w.toast(it?.icon ?? "⚒️", `${h.name} made a ${it?.name ?? id}!`, h.x, h.y);
    if (id === "raincloak") w.discover("rainproof", h.x, h.y);
    return true;
  }

  /**
   * Hand out hide clothing: whatever suits the weather best (rain → the
   * rainproof cloak, snow → furs, otherwise the warmest/toughest).
   */
  dress(w: World, h: Human) {
    // dragon slayers + egg runners wear their raid gear whenever the armory has it
    const role = w.tribe.roleOf(h);
    const special = role === "dragonSlayer" ? "dragonMail" : role === "eggRunner" ? "runnerKit" : null;
    if (special && !h.child) {
      if (h.gear.outfit === special) return;
      if ((this.armory[special] ?? 0) > 0) {
        this.armory[special]--;
        if (h.gear.outfit) this.armory[h.gear.outfit] = (this.armory[h.gear.outfit] ?? 0) + 1;
        h.gear.outfit = special;
        h.bubble = { text: special === "dragonMail" ? "Dragon-proof!" : "Ready to run!", t: 1.8 };
        return;
      }
    }
    if (!special && (h.gear.outfit === "dragonMail" || h.gear.outfit === "runnerKit")) {
      // off duty: the raid gear goes back on the rack
      this.armory[h.gear.outfit] = (this.armory[h.gear.outfit] ?? 0) + 1;
      h.gear.outfit = null;
    }
    const wt = w.weather;
    const wantRain = 0.4 + wt.rain * 1.5 + wt.storm;
    const wantWarm = 0.4 + Math.max(0, 0.45 - wt.temp) * 2 + wt.snow * 1.5;
    const score = (id: string | null | undefined) => {
      const o = id ? OUTFIT_BY_ID[id] : null;
      return o ? o.rain * wantRain + o.warmth * wantWarm + o.armor * (h.child ? 0 : 2)
        + (id?.startsWith("night") ? (w.shifts.mode === "split" && h.shift === "night" ? 5 : -8) : 0) : 0;
    };
    const cur = h.gear.outfit ?? null;
    let best = cur;
    let bs = score(cur);
    for (const o of OUTFITS) {
      if ((this.armory[o.id] ?? 0) <= 0) continue;
      const s = score(o.id);
      if (s > bs + 0.15) {
        bs = s;
        best = o.id;
      }
    }
    if (best && best !== cur) {
      this.armory[best]--;
      if (cur) this.armory[cur] = (this.armory[cur] ?? 0) + 1;
      h.gear.outfit = best;
      h.bubble = { text: OUTFIT_BY_ID[best].rain > 0.8 ? "Nice and dry!" : "Cosy!", t: 1.8 };
    }
  }

  /** Pull on the best metal helmet in the armory (grown-ups only). */
  helm(w: World, h: Human) {
    if (h.child) return;
    const cur = h.gear.helmet ?? null;
    const armor = (id: string | null) => (id && HELMET_BY_ID[id] ? HELMET_BY_ID[id].armor : 0);
    let best = cur;
    for (const def of HELMETS) if ((this.armory[def.id] ?? 0) > 0 && def.armor > armor(best)) best = def.id;
    if (best && best !== cur) {
      this.armory[best]--;
      if (cur) this.armory[cur] = (this.armory[cur] ?? 0) + 1;
      h.gear.helmet = best;
      h.bubble = { text: HELMET_BY_ID[best].glow ? "It's glowing!" : "Shiny!", t: 1.8 };
    }
  }

  /* ----------------------------- refinery ----------------------------- */

  private refineT = 0;
  private foodProcessT = 0;

  /** Refineries smelt raw metal into bars: 2 ore + a log → 1 bar, every few seconds (2 iron + coal → 1 steel). */
  private refine(w: World, dt: number) {
    const refs = this.buildings.filter((b) => b.kind === "refinery" && b.built >= 1);
    if (!refs.length) return;
    this.refineT -= dt * refs.length;
    if (this.refineT > 0) return;
    this.refineT = 7;
    const s = w.camp.stock;
    if (s.coal < 1 && s.wood < 1) return;
    const pairs: [Resource, Resource][] = [["gold", "goldBar"], ["silver", "silverBar"], ["copper", "copperBar"], ["iron", "steel"]];
    // keep a little raw copper + iron for other recipes; steel needs coal (a log fire isn't hot enough) and
    // stops at a stockpile; smelt whatever there's most of
    const pick = pairs.filter(([raw, bar]) => bar === "steel" ? s.coal >= 1 && s.iron >= STEEL_KEEP + 2 && s.steel < STEEL_CAP : s[raw] >= (raw === "copper" ? 6 : 2)).sort((a, b) => s[b[0]] - s[a[0]])[0];
    if (!pick) return;
    const [raw, bar] = pick;
    s[raw] -= 2;
    if (s.coal > 0) s.coal -= 1;
    else s.wood -= 1;
    s[bar] += 1;
    const r = refs[0];
    w.particles.burst(P.Spark, r.x + 20, r.y - 30, 8, 60, { z: 20, vz: 60, g: 200, size: 2, max: 0.6, color: "#ffcf6b" });
    w.sfx("clack", r.x, r.y, 0.5);
    if (!w.flags.has(`firstBar-${bar}`)) {
      w.flags.add(`firstBar-${bar}`);
      w.toast(RES_INFO[bar].icon, `The refinery poured its first ${RES_INFO[bar].name.toLowerCase().replace(/s$/, "")}!`, r.x, r.y);
    }
  }

  /** Mills and bakeries turn harvested grain into food without consuming a worker each tick. */
  private processFood(w: World, dt: number) {
    const mills = this.buildings.filter((b) => b.kind === "mill" && b.built >= 1);
    const bakeries = this.buildings.filter((b) => b.kind === "bakery" && b.built >= 1);
    if (!mills.length && !bakeries.length) return;
    this.foodProcessT -= dt * Math.max(1, mills.length + bakeries.length);
    if (this.foodProcessT > 0) return;
    this.foodProcessT = 8;
    const stock = w.camp.stock;
    if (mills.length && stock.crop >= 2) {
      stock.crop -= 2;
      stock.flour += 2;
      w.particles.burst(P.Crumb, mills[0].x, mills[0].y - 22, 5, 32, { z: 12, size: 3, max: 0.7, color: "#ead8a1" });
      w.sfx("clack", mills[0].x, mills[0].y, 0.3);
    }
    if (bakeries.length && stock.flour >= 2) {
      stock.flour -= 2;
      stock.cooked += 5;
      w.particles.burst(P.Spark, bakeries[0].x, bakeries[0].y - 20, 5, 28, { z: 12, size: 3, max: 0.7, color: "#f3b45f" });
      if (!w.flags.has("firstBread")) {
        w.flags.add("firstBread");
        w.toast("🍞", "The bakery made its first bread! +5 cooked food.", bakeries[0].x, bakeries[0].y);
      }
    }
  }

  /** Mark freshly unlocked recipes (toast once each). */
  private checkRecipes(w: World) {
    for (const f of FORGE_ITEMS) {
      if (this.known.has(f.id) || !this.canCraft(w, f.id)) continue;
      this.known.add(f.id);
      if (!this.primed) continue;
      this.fresh.add(f.id);
      w.toast(f.icon, `🆕 New recipe: ${f.name}! Queue it in the camp's ⚒️ Forge tab.`);
      w.sfx("sticker", w.camp.x, w.camp.y, 0.6);
    }
    this.primed = true;
  }

  /** Spikes, barricades: bite whatever shoves into them. */
  private updateBoneDefenses(w: World, dt: number) {
    for (const b of this.buildings) {
      if (b.built < 1 || (b.kind !== "spikes" && b.kind !== "barricade")) continue;
      const r = b.kind === "spikes" ? 20 : 26;
      w.creatureHash.each(b.x, b.y - 8, r + 60, (e) => {
        if (e.kind !== "dino" || e.owner || e.state === "carried" || e.z > 4 || sp(e.species).move !== "walk") return;
        const L = sizeOf(e);
        if (Math.hypot(e.x - b.x, e.y - (b.y - 8)) > r + L * 0.22) return;
        // slogging through spikes is slow work
        if (b.kind === "spikes") {
          e.vx *= 1 - Math.min(0.9, dt * 9);
          e.vy *= 1 - Math.min(0.9, dt * 9);
        }
        const last = this.spiked.get(e) ?? -9;
        if (w.elapsed - last < 1.2) return;
        this.spiked.set(e, w.elapsed);
        // small + medium attackers get hurt; big ones mostly just slowed
        const dmg = b.kind === "barricade" ? 8 : L < 60 ? 30 : L < 100 ? 18 : 6;
        w.particles.burst(P.Star, e.x, e.y, 2, 30, { z: L * 0.3, size: 4, max: 0.5 });
        b.hp -= b.kind === "spikes" ? (L > 100 ? 2 : 1) : 4;
        if (!w.flags.has("spikeFact") && w.inView(b.x, b.y)) {
          w.flags.add("spikeFact");
          w.toast("🦴", `The ${sp(e.species).nick} ran into the bone spikes!`, b.x, b.y);
        }
        hitDino(w, e, dmg, b.x, b.y);
        if (b.hp <= 0) {
          // snapped: builders will need to set it again
          w.particles.burst(P.Crumb, b.x, b.y, 8, 50, { vz: 60, g: 200, size: 2.5, max: 0.7, color: "#efe6cf" });
          b.built = 0.01;
          b.have = {};
          b.hp = BUILDINGS[b.kind].hp;
          this.version++;
        }
      });
    }
  }

  /** Hand the best gear in the armory to a fighter. */
  equip(w: World, h: Human, prefer?: string) {
    if (h.child) return;
    const cur = h.gear.weapon ? WEAPON_BY_ID[h.gear.weapon] : null;
    let best = cur;
    for (const [id, n] of Object.entries(this.armory)) {
      const wp = WEAPON_BY_ID[id];
      if (!wp || n <= 0 || wp.sidearm) continue;
      if (id === "nightSidearm" && (w.shifts.mode !== "split" || h.shift !== "night")) continue;
      const score = wp.dmg * (prefer && wp.kind === prefer ? 1.6 : 1);
      const bestScore = best ? best.dmg * (prefer && best.kind === prefer ? 1.6 : 1) : -1;
      if (score > bestScore) best = wp;
    }
    if (best && best !== cur) {
      this.armory[best.id]--;
      if (cur) this.armory[cur.id] = (this.armory[cur.id] ?? 0) + 1;
      h.gear.weapon = best.id;
    }
    let shield = h.gear.shield;
    for (const [id, n] of Object.entries(this.armory)) {
      const s = SHIELD_BY_ID[id];
      if (!s || n <= 0 || s.tier <= shield) continue;
      shield = s.tier;
    }
    if (shield > h.gear.shield) {
      this.armory[`shield${shield}`]--;
      if (h.gear.shield) this.armory[`shield${h.gear.shield}`] = (this.armory[`shield${h.gear.shield}`] ?? 0) + 1;
      h.gear.shield = shield;
    }
  }

  /** Swap a person's weapon for a specific kind from the armory (player choice). */
  equipKind(h: Human, kind: string) {
    let best: string | null = null;
    let bd = -1;
    for (const [id, n] of Object.entries(this.armory)) {
      const wp = WEAPON_BY_ID[id];
      if (wp && n > 0 && !wp.sidearm && wp.kind === kind && wp.dmg > bd) {
        bd = wp.dmg;
        best = id;
      }
    }
    const cur = h.gear.weapon ? WEAPON_BY_ID[h.gear.weapon] : null;
    if (cur?.kind === kind && (!best || WEAPON_BY_ID[best].dmg <= cur.dmg)) return true;
    if (!best) return false;
    this.armory[best]--;
    if (cur) this.armory[cur.id] = (this.armory[cur.id] ?? 0) + 1;
    h.gear.weapon = best;
    return true;
  }

  /* ----------------------------- update ----------------------------- */

  update(w: World, dt: number) {
    chariotsUpdate(w, dt);
    if (Math.floor(w.elapsed) !== Math.floor(w.elapsed - dt)) {
      hallTick(w);
      feastTick(w);
    }
    for (const b of this.buildings) {
      if (b.kind !== "well") continue;
      if (b.built < 1) {
        this.settledWells.delete(b);
        continue;
      }
      if (this.settledWells.has(b)) continue;
      this.settleWell(w, b);
      this.settledWells.add(b);
    }
    const wells = this.buildings.filter((b) => b.kind === "well" && b.built >= 1).length;
    if (wells && w.camp.stock.water < 60) {
      this.wellT += wells * dt * 0.6;
      const drawn = Math.floor(this.wellT);
      if (drawn) {
        w.camp.stock.water = Math.min(60, w.camp.stock.water + drawn);
        this.wellT -= drawn;
      }
    } else this.wellT = 0;
    this.recipeT -= dt;
    if (this.recipeT <= 0) {
      this.recipeT = 2;
      this.checkRecipes(w);
    }
    this.autoCraftT -= dt;
    if (this.autoCraftT <= 0) {
      this.autoCraftT = 8;
      this.planAutoCraft(w);
    }
    this.updateBoneDefenses(w, dt);
    this.refine(w, dt);
    this.processFood(w, dt);
    // traps bite whatever steps on them
    for (const b of this.buildings) {
      if (b.kind !== "trap" || b.built < 1) continue;
      const hit = w.dinos.find((d) => sp(d.species).move === "walk" && !d.owner && d.state !== "carried" && Math.hypot(d.x - b.x, d.y - b.y) < 18 + sizeOf(d) * 0.2);
      if (hit) {
        hit.health -= 0.22 / Math.max(0.6, hit.genes.tough);
        hit.fear = 1;
        hit.vx *= 0.2;
        hit.vy *= 0.2;
        w.particles.burst(P.Star, b.x, b.y, 3, 30, { z: 10, size: 5, max: 0.7 });
        w.sfx("thunk", b.x, b.y, 0.8);
        b.hp -= 1;
        if (!w.flags.has("trapFact")) {
          w.flags.add("trapFact");
          w.toast("🪤", `SNAP! A ${sp(hit.species).nick} stepped on a spike trap.`, b.x, b.y);
        }
        if (b.hp <= 0) {
          b.built = 0;
          b.have = {};
          b.hp = BUILDINGS.trap.hp;
        }
      }
    }
    // fire + lava damage buildings
    for (const b of [...this.buildings]) {
      if (b.built < 1 || b.kind === "path" || b.kind === "trap" || b.kind === "spikes") continue;
      const i = tileOf(b.x, b.y - 8);
      const heat = w.fire.heat[i] + w.lava.heat[i] * 2;
      // in the polygon age everything is faced in fire-proof shaped stone
      if (heat > 0.3 && !w.civ.polygonAge) {
        b.hp -= dt * 30 * heat * (STONEWORK.has(b.kind) ? 0.15 : b.kind === "blacksmith" ? 0.3 : 1);
        if (b.hp <= 0) {
          w.toast("🔥", `The ${BUILDINGS[b.kind].name.toLowerCase()} burned down!`, b.x, b.y);
          w.particles.burst(P.Smoke, b.x, b.y, 10, 40, { vz: 30, size: 14, max: 2, color: "rgba(60,55,50,0.6)" });
          b.built = 0.01;
          b.have = {};
          b.hp = BUILDINGS[b.kind].hp;
          this.version++;
        }
      }
    }
    this.updateScorpions(w, dt);
  }

  private updateScorpions(w: World, dt: number) {
    // a Scorpion whose wall / tower was torn down drops to the ground with it (it isn't lost:
    // builders repair it there); only one with no ground under it is gone (scorpionArmor.ts)
    for (const s of [...this.scorpions]) {
      const gone = (s.mount === "wall" && !w.tribe.wallAt(s.tx, s.ty)) || (s.mount === "tower" && !w.tribe.towers.some((t) => s.tx >= t.tx && s.tx <= t.tx + 1 && s.ty >= t.ty && s.ty <= t.ty + 1));
      if (!gone) continue;
      const t = w.terrain.tiles[s.ty * MAP_W + s.tx] as T;
      if (isWalkTile(t) && !isWaterTile(t)) {
        s.mount = "ground";
        s.x = s.tx * TILE + TILE / 2;
        s.y = s.ty * TILE + TILE / 2;
        if (s.built >= 1) s.hp = Math.max(1, s.hp - scorpionMaxHp(s) * 0.25);
        if (s.crew) s.crew = 0;
      } else this.scorpions.splice(this.scorpions.indexOf(s), 1);
      this.version++;
      w.particles.burst(P.Dust, s.x, s.y, 8, 50, { size: 8, max: 0.9, color: "rgba(160,130,90,0.6)" });
    }
    const powered = this.dronesPowered(w);
    for (const s of this.scorpions) {
      s.kick = Math.max(0, s.kick - dt * 3);
      if (s.glint) s.glint = Math.max(0, s.glint - dt * 2.5);
      s.drone = powered && s.built >= 1;
      if (s.built < 1) continue;
      // standing in a fire or by lava: scorched (it can't burn to nothing; obsidian plates barely notice)
      const heat = Math.max(w.fire.at(s.tx, s.ty), w.lava.heatAt(s.tx, s.ty));
      if (heat > 0.2) armourHit(w, s, heat * 18 * dt, "fire");
      // knocked out, or its wall / tower is down: it can't shoot till it's fixed
      if (!scorpionWorks(w, s)) continue;
      if (s.drone) {
        // an energy tower runs it: nobody needs to crew it
        if (s.crew) {
          const was = w.humans.find((h) => h.id === s.crew);
          if (was && was.state === "operate") was.state = "idle";
          s.crew = 0;
        }
        this.aimAndFire(w, s, dt, null);
        continue;
      }
      const crew = s.crew ? w.humans.find((h) => h.id === s.crew) : undefined;
      // a crew member on the way keeps the seat; one who's gone / hurt / busy elsewhere loses it
      const task = crew ? w.tasks.get(crew.taskId) : null;
      if (!crew || crew.state === "down" || crew.child || (task && !(task.kind === "operate" && task.target === s.id))) {
        s.crew = 0;
        continue;
      }
      const spot = this.crewSpot(s);
      const manning = crew.state === "operate" && Math.hypot(crew.x - spot.x, crew.y - spot.y) < 26;
      if (!manning) {
        const t = (this.reserveT.get(s) ?? 0) + dt;
        this.reserveT.set(s, t);
        if (t > 40) {
          s.crew = 0;
          this.reserveT.delete(s);
        }
        continue;
      }
      this.reserveT.delete(s);
      this.aimAndFire(w, s, dt, crew);
    }
  }

  /** Energy towers power the Scorpions (as long as the grid has a charge). */
  dronesPowered(w: World) {
    return w.civ.energy >= DRONE_SHOT && this.buildings.some((b) => b.kind === "energyTower" && b.built >= 1);
  }

  /** Powered Scorpions on the map (they count as defenders). */
  drones(w: World) {
    return this.dronesPowered(w) ? this.scorpions.filter((s) => s.built >= 1).length : 0;
  }

  private aimAndFire(w: World, s: Scorpion, dt: number, crew: Human | null) {
    {
      s.reload = Math.max(0, s.reload - dt);
      const tier = SCORPION_TIERS[s.tier - 1];
      const siege = w.civ.has("siegecraft");
      const range = tier.range + (s.mount === "tower" ? 60 : s.mount === "wall" ? 25 : 0) + (siege ? 50 : 0);
      const target = scorpionTarget(w, s.x, s.y, range);
      if (!target) {
        // drones sweep slowly while they watch
        s.aim += s.drone ? dt * 0.6 : angleTo(s.aim, Math.PI / 2) * Math.min(1, dt);
        return;
      }
      const lead = Math.hypot(target.x - s.x, target.y - s.y) / tier.speed;
      const ax = target.x + target.vx * lead;
      const ay = target.y + target.vy * lead;
      const want = Math.atan2(ay - s.y, ax - s.x);
      s.aim += angleTo(s.aim, want) * Math.min(1, dt * (s.drone ? 4 : 2.6));
      if (crew) crew.dir = ax > crew.x ? 1 : -1;
      if (s.reload <= 0 && Math.abs(angleTo(s.aim, want)) < 0.12) {
        w.tribe.fireBolt(w, s.x + Math.cos(s.aim) * 16, s.y + Math.sin(s.aim) * 8, this.scorpionZ(s), target, tier.dmg * (siege ? 1.4 : 1) * (s.drone ? 1.15 : 1), tier.speed * (s.drone ? 1.4 : 1), tier.big, !!s.drone);
        s.reload = tier.reload * (siege ? 0.75 : 1) * (s.drone ? 0.8 : 1);
        s.kick = 1;
        if (s.drone) {
          w.civ.energy = Math.max(0, w.civ.energy - DRONE_SHOT);
          w.sfx("zap", s.x, s.y, 0.7, 0.8);
          w.particles.burst(P.Spark, s.x, s.y, 5, 50, { z: this.scorpionZ(s) + 8, vz: 40, g: 120, size: 2, max: 0.4, color: "#9feaff" });
          if (!w.flags.has("droneShot")) {
            w.flags.add("droneShot");
            w.toast("🎯", "Powered Scorpions! The energy towers aim and fire them on their own — nobody has to crew them now.", s.x, s.y);
          }
        } else w.sfx("twang", s.x, s.y, 0.9, 0.55);
        w.particles.burst(P.Dust, s.x, s.y, 3, 30, { z: this.scorpionZ(s), size: 5, max: 0.4, color: "rgba(220,210,190,0.6)" });
        if (!w.flags.has("scorpionShot")) {
          w.flags.add("scorpionShot");
          w.discover("scorpion", s.x, s.y);
        }
      }
    }
  }

  clear() {
    this.buildings = [];
    this.scorpions = [];
    this.nodes = [];
    this.armory = {};
    this.queue = [];
    this.kits.clear();
    this.known.clear();
    this.fresh.clear();
    this.version++;
  }

  serialize() {
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      buildings: this.buildings.map((b) => ({ id: b.id, kind: b.kind, tx: b.tx, ty: b.ty, built: r(b.built), have: b.have, hp: Math.round(b.hp), ...(b.stage ? { stage: b.stage } : {}), ...(b.grow ? { grow: Math.round(b.grow * 100) / 100 } : {}), ...(b.merged ? { merged: b.merged } : {}), ...(b.label ? { label: b.label, breed: b.breed, size: b.size, ours: b.ours } : {}), ...(b.shield ? { shield: { ...b.shield } } : {}) })),
      scorpions: this.scorpions.map((s) => ({ id: s.id, tx: s.tx, ty: s.ty, x: r(s.x), y: r(s.y), tier: s.tier, built: r(s.built), have: s.have, up: s.up, hp: Math.round(s.hp), mount: s.mount, ...(s.obsidian ? { obsidian: true } : {}), ...(s.obsidianUp ? { obsidianUp: true } : {}) })),
      nodes: this.nodes.map((n) => [n.kind, Math.round(n.x), Math.round(n.y), n.amount, n.max, n.found ? 1 : 0] as const),
      armory: this.armory,
      queue: this.queue,
      craftT: r(this.craftT),
      kits: Array.from(this.kits),
      known: Array.from(this.known),
      civNodes: 1,
      limestoneNodes: 1,
      feast: this.feast.food,
      chariots: this.chariots.map((c) => ({ x: r(c.x), y: r(c.y), homeX: r(c.homeX), homeY: r(c.homeY), hp: Math.round(c.hp), trike: c.trike, dir: c.dir, tier: c.tier ?? 0, up: c.up ? 1 : 0, have: c.have ?? {} })),
    };
  }

  load(w: World, d: ReturnType<Colony["serialize"]> | undefined) {
    if (!d) {
      this.generateNodes(w);
      return;
    }
    for (const b of d.buildings ?? []) {
      const def = BUILDINGS[b.kind];
      if (!def) continue;
      const oldFinishedPyramid = b.kind === "pyramid" && (b as { stage?: number }).stage === 5 && b.built >= 1 && !(d as { limestoneNodes?: number }).limestoneNodes;
      const id = (b as { id?: number }).id ?? w.nextId();
      w.reserveIds(id);
      this.buildings.push({ id, kind: b.kind, tx: b.tx, ty: b.ty, x: (b.tx + def.w / 2) * TILE, y: (b.ty + def.h) * TILE - (def.solid ? 0 : TILE / 2), built: oldFinishedPyramid ? 0.4 : b.built, have: oldFinishedPyramid ? {} : b.have ?? {}, hp: b.hp ?? def.hp, ...((b as { stage?: number }).stage ? { stage: oldFinishedPyramid ? 6 : (b as { stage?: number }).stage } : {}), ...((b as { grow?: number }).grow ? { grow: (b as { grow?: number }).grow } : {}), ...((b as { merged?: number }).merged ? { merged: (b as { merged?: number }).merged } : {}), ...((b as { label?: string }).label ? { label: (b as { label?: string }).label, breed: (b as { breed?: string }).breed, size: (b as { size?: number }).size, ours: (b as { ours?: boolean }).ours } : {}), ...((b as { shield?: ShieldLevels }).shield ? { shield: { ...(b as { shield: ShieldLevels }).shield } } : {}) });
    }
    this.feast.food = (d as { feast?: number }).feast ?? 0;
    // chariots park at home after a load (a hunt in progress is called off)
    for (const c of (d as { chariots?: { x: number; y: number; homeX: number; homeY: number; hp: number; trike: number; dir: 1 | -1; tier?: number; up?: number; have?: Partial<Record<Resource, number>> }[] }).chariots ?? []) {
      const tier = c.tier ?? 0;
      this.chariots.push({ id: w.nextId(), x: c.homeX, y: c.homeY, dir: c.dir ?? 1, hp: c.hp, maxHp: CHARIOT_TIERS[tier]?.hp ?? CHARIOT_HP, trike: c.trike, homeX: c.homeX, homeY: c.homeY, to: null, path: null, pathI: 0, pathKey: 0, cd: [0, 1.3], aim: [0, Math.PI], anim: 0, hit: 0, tier, up: !!c.up, have: c.have ?? {} });
    }
    for (const s of d.scorpions ?? []) {
      const id = (s as { id?: number }).id ?? w.nextId();
      w.reserveIds(id);
      this.scorpions.push({ ...s, id, aim: Math.PI / 2, reload: 0, crew: 0, kick: 0 });
    }
    for (const [kind, x, y, amount, max, found] of d.nodes ?? []) {
      if (!NODES[kind]) continue;
      this.nodes.push({ id: w.nextId(), kind, x, y, amount, max, found: !!found, variant: Math.floor(hash2(x, y, 3) * 4) });
    }
    this.armory = { ...(d.armory ?? {}) };
    this.queue = [...(d.queue ?? [])];
    this.craftT = this.queue.length ? Math.max(0, (d as { craftT?: number }).craftT ?? 0) : 0;
    this.kits = new Set(d.kits ?? []);
    this.known = new Set(d.known ?? []);
    this.primed = this.known.size > 0;
    // saves from before the civilization update get the new deposits scattered in
    if (!(d as { civNodes?: number }).civNodes) this.generateCivNodes(w);
    if (!(d as { limestoneNodes?: number }).limestoneNodes) {
      let placed = 0;
      for (let i = 0; i < 3000 && placed < 5; i++) {
        const tx = 2 + Math.floor(hash2(i, 183, w.seed) * (MAP_W - 4));
        const ty = 2 + Math.floor(hash2(i, 397, w.seed) * (MAP_H - 4));
        const t = w.terrain.tiles[ty * MAP_W + tx] as T;
        if (t !== T.Rock && t !== T.Grass && t !== T.Dirt) continue;
        const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
        if (this.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 110) || Math.hypot(w.camp.x - x, w.camp.y - y) < 240) continue;
        const amount = 17 + Math.floor(hash2(tx, ty, w.seed) * 7);
        this.nodes.push({ id: w.nextId(), kind: "limestone", x, y, amount, max: amount, found: true, variant: i % 4 });
        placed++;
      }
    }
    this.version++;
  }
}

export const angleTo = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export type Target = { id: number; x: number; y: number; z: number; vx: number; vy: number; dragon: boolean };

/** What a Scorpion / tower archer should shoot first: dragons, then raiders, then big predators near camp. */
export function scorpionTarget(w: World, x: number, y: number, range: number): Target | null {
  let best: Target | null = null;
  let bs = Infinity;
  for (const dr of w.dragons.list) {
    if (dr.state === "leave" && dr.z > 150) continue;
    const dist = Math.hypot(dr.x - x, dr.y - y);
    if (dist > range) continue;
    const s = dist - 400;
    if (s < bs) {
      bs = s;
      best = { id: dr.id, x: dr.x, y: dr.y, z: dr.z, vx: dr.vx, vy: dr.vy, dragon: true };
    }
  }
  for (const d of w.dinos) {
    if (!w.tribe.hostile(w, d)) continue;
    const dist = Math.hypot(d.x - x, d.y - y);
    if (dist > range) continue;
    const s = dist - (d.raider ? 150 : 0) - sizeOf(d);
    if (s < bs) {
      bs = s;
      best = { id: d.id, x: d.x, y: d.y, z: d.z + sizeOf(d) * 0.2, vx: d.vx, vy: d.vy, dragon: false };
    }
  }
  for (const b of w.rivals.brutes) {
    if (!w.rivals.hostile(w, b)) continue;
    // a Scorpion's crew can't pick a Tree Person (or a canoe on the water) out of the dark at all
    if ((b.tree || (b.sea && b.boat)) && w.daylight < 0.3) continue;
    const dist = Math.hypot(b.x - x, b.y - y);
    if (dist > range) continue;
    const s = dist - (b.raid || b.captive ? 170 : 0);
    if (s < bs) {
      bs = s;
      best = { id: b.id, x: b.x, y: b.y, z: 18, vx: b.vx, vy: b.vy, dragon: false };
    }
  }
  return best;
}
