/* ------------------------------------------------------------------ */
/*  Colony: the settlement's newer pieces — buildings, Scorpions,      */
/*  resource deposits, the armory and the forge queue. Walls, towers,  */
/*  farms and raids stay in tribe.ts; huts stay in camp.ts.            */
/* ------------------------------------------------------------------ */
import { ARTIFACTS, BUILDINGS, FORGE_ITEMS, HELMETS, HELMET_BY_ID, KIT_BY_ID, NODES, OUTFITS, OUTFIT_BY_ID, RES_INFO, SCORPION_TIERS, SHIELD_BY_ID, WEAPON_BY_ID, type Cost } from "../data/colony";
import { hitDino } from "./tribe";
import { sp } from "../data/species";
import { sizeOf } from "./dinos";
import { shelterTiles, tileOf, TOWER_Z, WALK_Z } from "./nav";
import { P } from "./particles";
import { hash2 } from "./rng";
import { LM, isWalkTile, isWaterTile } from "./terrain";
import { MAP_H, MAP_W, T, TILE, type Building, type BuildingKind, type Dino, type Dragon, type Human, type NodeKind, type ResNode, type Resource, type Scorpion } from "./types";
import type { World } from "./world";

export interface DropOff {
  x: number;
  y: number;
  kind: "pile" | BuildingKind;
}

const FOOD = new Set<Resource>(["cooked", "fish", "crop", "berries", "meat"]);

/** Mostly stone: fire barely scorches it. */
const STONEWORK = new Set<BuildingKind>(["pyramid", "obelisk", "stoneCircle", "shelterDeep", "chamber", "shapingYard", "beamTower", "energyTower", "pylon", "resShield"]);

/** Energy one powered Scorpion shot uses. */
export const DRONE_SHOT = 3;

export class Colony {
  buildings: Building[] = [];
  scorpions: Scorpion[] = [];
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

  canPlace(w: World, kind: BuildingKind, x: number, y: number): string | null {
    const def = BUILDINGS[kind];
    const fp = this.footprint(kind, x, y);
    const occupied = this.occupied(w);
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
        } else if (!isWalkTile(t) || isWaterTile(t) || t === T.Tar || t === T.Cave) return "That ground won't hold a building.";
        if (occupied.has(ty * MAP_W + tx)) return "Something is already there.";
      }
    // keep the door free for solid buildings
    if (def.solid) {
      const door = (fp.ty + fp.h) * MAP_W + fp.tx + Math.floor(fp.w / 2);
      if (occupied.has(door) || !isWalkTile(w.terrain.tiles[door] as T)) return "The doorway would be blocked.";
    }
    return null;
  }

  /** Tiles used by walls, towers, huts, buildings + ground Scorpions. */
  occupied(w: World) {
    const s = new Set<number>();
    for (const wl of w.tribe.walls) s.add(wl.ty * MAP_W + wl.tx);
    for (const t of w.tribe.towers) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.add((t.ty + dy) * MAP_W + t.tx + dx);
    for (const b of this.buildings) {
      const d = BUILDINGS[b.kind];
      for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) s.add((b.ty + dy) * MAP_W + b.tx + dx);
    }
    for (const sh of w.shelters) for (const i of shelterTiles(sh.x, sh.y)) s.add(i);
    for (const sc of this.scorpions) if (sc.mount === "ground") s.add(sc.ty * MAP_W + sc.tx);
    return s;
  }

  addBuilding(w: World, kind: BuildingKind, x: number, y: number): Building | null {
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
        let tx = Math.floor(r1 * MAP_W);
        let ty = Math.floor(r2 * MAP_H);
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
    place("iron", 3, (t) => walk(t), { x: LM.frost.x, y: LM.frost.y, r: 11 });
    place("gold", 2, (t, tx, ty) => walk(t) && nextTo(tx, ty, (o) => o === T.Mountain));
    place("gold", 1, (t) => walk(t), { x: LM.frost.x, y: LM.frost.y, r: 9 });
    place("obsidian", 4, (t) => t === T.Basalt || t === T.Volcano);
    place("salt", 3, (t, tx, ty) => t === T.Sand && w.terrain.salt[ty * MAP_W + tx + 1] + w.terrain.salt[(ty + 1) * MAP_W + tx] > 0);
    place("tar", 3, (t, tx, ty) => walk(t) && nextTo(tx, ty, (o) => o === T.Tar));
    place("artifact", 5, (t) => walk(t) && t !== T.Nest);
    place("fossil", 3, (t) => walk(t) && (t === T.Sand || t === T.Rock || t === T.Dirt || t === T.Grass));
    this.generateCivNodes(w, salt + 40);
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
        let tx = Math.floor(r1 * MAP_W);
        let ty = Math.floor(r2 * MAP_H);
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
    place("crystal", 1, () => true, { x: LM.frost.x, y: LM.frost.y, r: 10 });
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
    const b = this.buildings.find((x) => x.built >= 1 && (at === "blacksmith" ? x.kind === "blacksmith" : at === "tannery" ? x.kind === "tannery" : x.kind === "workshop" || x.kind === "blacksmith"));
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
    const wt = w.weather;
    const wantRain = 0.4 + wt.rain * 1.5 + wt.storm;
    const wantWarm = 0.4 + Math.max(0, 0.45 - wt.temp) * 2 + wt.snow * 1.5;
    const score = (id: string | null | undefined) => {
      const o = id ? OUTFIT_BY_ID[id] : null;
      return o ? o.rain * wantRain + o.warmth * wantWarm + o.armor * (h.child ? 0 : 2) : 0;
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

  /** Refineries smelt raw metal into bars: 2 ore + a log → 1 bar, every few seconds. */
  private refine(w: World, dt: number) {
    const refs = this.buildings.filter((b) => b.kind === "refinery" && b.built >= 1);
    if (!refs.length) return;
    this.refineT -= dt * refs.length;
    if (this.refineT > 0) return;
    this.refineT = 7;
    const s = w.camp.stock;
    if (s.coal < 1 && s.wood < 1) return;
    const pairs: [Resource, Resource][] = [["gold", "goldBar"], ["silver", "silverBar"], ["copper", "copperBar"]];
    // keep a little raw copper for other recipes; smelt whatever there's most of
    const pick = pairs.filter(([raw]) => s[raw] >= (raw === "copper" ? 6 : 2)).sort((a, b) => s[b[0]] - s[a[0]])[0];
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
      if (!wp || n <= 0) continue;
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
      if (wp && n > 0 && wp.kind === kind && wp.dmg > bd) {
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
    this.updateBoneDefenses(w, dt);
    this.refine(w, dt);
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
    // a Scorpion whose wall / tower was torn down falls with it
    for (const s of [...this.scorpions]) {
      const gone = (s.mount === "wall" && !w.tribe.wallAt(s.tx, s.ty)) || (s.mount === "tower" && !w.tribe.towers.some((t) => s.tx >= t.tx && s.tx <= t.tx + 1 && s.ty >= t.ty && s.ty <= t.ty + 1));
      if (gone || s.hp <= 0) {
        this.scorpions.splice(this.scorpions.indexOf(s), 1);
        this.version++;
        w.particles.burst(P.Dust, s.x, s.y, 8, 50, { size: 8, max: 0.9, color: "rgba(160,130,90,0.6)" });
      }
    }
    const powered = this.dronesPowered(w);
    for (const s of this.scorpions) {
      s.kick = Math.max(0, s.kick - dt * 3);
      s.drone = powered && s.built >= 1;
      if (s.built < 1) continue;
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
      const range = tier.range + (s.mount === "tower" ? 90 : s.mount === "wall" ? 40 : 0) + (siege ? 80 : 0);
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
      buildings: this.buildings.map((b) => ({ kind: b.kind, tx: b.tx, ty: b.ty, built: r(b.built), have: b.have, hp: Math.round(b.hp), ...(b.stage ? { stage: b.stage } : {}) })),
      scorpions: this.scorpions.map((s) => ({ tx: s.tx, ty: s.ty, x: r(s.x), y: r(s.y), tier: s.tier, built: r(s.built), have: s.have, up: s.up, hp: Math.round(s.hp), mount: s.mount })),
      nodes: this.nodes.map((n) => [n.kind, Math.round(n.x), Math.round(n.y), n.amount, n.max, n.found ? 1 : 0] as const),
      armory: this.armory,
      queue: this.queue,
      kits: Array.from(this.kits),
      known: Array.from(this.known),
      civNodes: 1,
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
      this.buildings.push({ id: w.nextId(), kind: b.kind, tx: b.tx, ty: b.ty, x: (b.tx + def.w / 2) * TILE, y: (b.ty + def.h) * TILE - (def.solid ? 0 : TILE / 2), built: b.built, have: b.have ?? {}, hp: b.hp ?? def.hp, ...((b as { stage?: number }).stage ? { stage: (b as { stage?: number }).stage } : {}) });
    }
    for (const s of d.scorpions ?? []) this.scorpions.push({ id: w.nextId(), ...s, aim: Math.PI / 2, reload: 0, crew: 0, kick: 0 });
    for (const [kind, x, y, amount, max, found] of d.nodes ?? []) {
      if (!NODES[kind]) continue;
      this.nodes.push({ id: w.nextId(), kind, x, y, amount, max, found: !!found, variant: Math.floor(hash2(x, y, 3) * 4) });
    }
    this.armory = { ...(d.armory ?? {}) };
    this.queue = [...(d.queue ?? [])];
    this.kits = new Set(d.kits ?? []);
    this.known = new Set(d.known ?? []);
    this.primed = this.known.size > 0;
    // saves from before the civilization update get the new deposits scattered in
    if (!(d as { civNodes?: number }).civNodes) this.generateCivNodes(w);
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

export function dragonTarget(dr: Dragon): Target {
  return { id: dr.id, x: dr.x, y: dr.y, z: dr.z, vx: dr.vx, vy: dr.vy, dragon: true };
}
