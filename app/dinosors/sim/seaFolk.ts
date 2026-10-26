/* ------------------------------------------------------------------ */
/*  Sea People: fisher-raiders who live out on the water.               */
/*                                                                     */
/*  • Villages of stilt-houses stand in the shallows off the sea        */
/*    coast, tied together with boardwalks: docks with dugout canoes,   */
/*    fish-drying racks, a lookout, a shrine to the great sea beasts.   */
/*  • On the water every one of them is in a canoe (outrigger, paddle). */
/*    They fish, patrol their waters, and raid by boat: a war party     */
/*    paddles up the rivers as far as the water goes (their route       */
/*    prefers water three to one), lands right by the target, strikes   */
/*    and paddles home the same way. At night a canoe on the river is   */
/*    a shadow: our Scorpions can't see it, our people only up close.   */
/*  • The sea reptiles are their friends: Mosasaurus, Plesiosaurus and */
/*    Liopleurodon never hunt them, swim round their villages, and go   */
/*    for anyone who comes into the village's waters.                   */
/*  • They raid our town, the Neanderthal camps and the Tree People.    */
/*    (Everyone fights back: they're just more brutes to the others.)   */
/*                                                                     */
/*  Every Sea Person is a Brute (clan 0, `sea` = their village) in      */
/*  w.rivals.brutes, like the Tree People: this module owns their       */
/*  brains, villages, canoe raids, growth + saving. Own random numbers  */
/*  + ids (5e8 up), so nothing else plays out differently.             */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { emote, isBaby, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { isWaterTile } from "./terrain";
import { MAP_H, MAP_W, OLD_MAP_H, OLD_MAP_W, T, TILE, WORLD_H, WORLD_W, type Brute, type BruteWeapon, type Dino, type Human, type Resource, type SeaBand, type SeaHut, type SeaSign, type SeaTribe } from "./types";
import type { World } from "./world";
import { say, setB } from "./rivals";
import { foundingGroups, type FolkGroup, type GroupKind } from "./folkGroups";
import { centroid, fairGame, takeFood } from "./treeFolk";

/** Our hits are divided by this (Tree People 70, Neanderthals 150). */
export const SEA_TOUGH = 95;
const LAND_SPEED = 46;
const BOAT_SPEED = 64;
const REACH = 22;
export const SEA_GROWN = 120;
export const MAX_VILLAGES = 3;
const MAX_SEA = 30;
const START_AT = 300;
/** A village never settles nearer our town than this (px). */
export const SEA_MIN = 1400;
const CLEARED_FOR = 1500;

const TRIBE_NAMES = ["Salt Fin", "Blue Shell", "Deep Gull", "Reef Fang", "Tide Drum", "Grey Wave", "Coral Eye", "Storm Oar"];
const FOLK_NAMES = ["Nalu", "Kai", "Moa", "Tide", "Reef", "Sula", "Ika", "Pele", "Wai", "Oru", "Mako", "Lani", "Kelp", "Tau", "Hina", "Riku", "Ama", "Fin", "Noe", "Kahi", "Vai", "Lono"];
/** Sea blues + greens only. */
const PAINTS = ["#2fb7c9", "#3a6ff0", "#1fa384", "#5fd3e8", "#2a4fb8", "#36c2a4"];
/** The sea dragons they train + ride. */
const SEA_BEASTS = new Set(["mosa", "plesio", "plio"]);
/** How fast a sea dragon carries its rider through the water. */
const RIDE_SPEED = 92;
/** Biggest village: 3 by itself, one more for every union (up to this). */
export const MAX_SEA_TIER = 5;
/** Height of the rider's seat on a sea dragon's back. */
export const saddleOf = (d: Dino) => 2 + sizeOf(d) * 0.09;

/** Harpoons (thrown), whalebone clubs, shell knives, slings. */
const ARMS: Partial<Record<BruteWeapon, { hit: number; throw: number; range: number; missile: "spear" | "rock" | "sling" }>> = {
  spear: { hit: 0.22, throw: 0.2, range: 190, missile: "spear" },
  club: { hit: 0.26, throw: 0.12, range: 0, missile: "rock" },
  bone: { hit: 0.22, throw: 0.12, range: 0, missile: "rock" },
  sling: { hit: 0.12, throw: 0.17, range: 240, missile: "sling" },
};
const armsOf = (b: Brute) => ARMS[b.weapon] ?? ARMS.club!;

const BLOCK = new Set<T>([T.Mountain, T.Cliff, T.Volcano]);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const waterAt = (w: World, x: number, y: number) => isWaterTile(w.terrain.tileAt(x, y));
const tileOf = (x: number, y: number) => Math.max(0, Math.min(MAP_H - 1, Math.floor(y / TILE))) * MAP_W + Math.max(0, Math.min(MAP_W - 1, Math.floor(x / TILE)));
const tileXY = (i: number) => ({ x: (i % MAP_W) * TILE + TILE / 2, y: Math.floor(i / MAP_W) * TILE + TILE / 2 });

type Foe = { kind: "human"; h: Human } | { kind: "brute"; b: Brute };
const foeXY = (f: Foe) => (f.kind === "human" ? f.h : f.b);

/**
 * A canoe route (tile indexes) from one point to another: anywhere but mountains, cliffs and our walls,
 * with water three times cheaper than land, so they paddle up rivers as far as they go before landing.
 */
export function seaRoute(w: World, x0: number, y0: number, x1: number, y1: number, budget = 30000): number[] | null {
  const N = MAP_W * MAP_H;
  const s = tileOf(x0, y0);
  const g = tileOf(x1, y1);
  if (s === g) return [g];
  const cost = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap: number[] = [];
  const f: number[] = [];
  const push = (i: number, pr: number) => {
    heap.push(i);
    f.push(pr);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[p] <= f[k]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      [f[p], f[k]] = [f[k], f[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const li = heap.pop()!;
    const lf = f.pop()!;
    if (heap.length) {
      heap[0] = li;
      f[0] = lf;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && f[l] < f[m]) m = l;
        if (r < heap.length && f[r] < f[m]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        [f[m], f[k]] = [f[k], f[m]];
        k = m;
      }
    }
    return top;
  };
  const gx = g % MAP_W;
  const gy = Math.floor(g / MAP_W);
  const h = (i: number) => {
    const dx = Math.abs((i % MAP_W) - gx);
    const dy = Math.abs(Math.floor(i / MAP_W) - gy);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  cost[s] = 0;
  push(s, h(s));
  let n = 0;
  const tiles = w.terrain.tiles;
  while (heap.length && n++ < budget) {
    const i = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === g) break;
    const tx = i % MAP_W;
    const ty = Math.floor(i / MAP_W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const j = ny * MAP_W + nx;
        if (closed[j]) continue;
        const t = tiles[j] as T;
        if (j !== g && (BLOCK.has(t) || w.tribe.blocks(nx, ny))) continue;
        const step = (isWaterTile(t) ? 1 : 3) * (dx && dy ? 1.414 : 1);
        const c = cost[i] + step;
        if (c < cost[j]) {
          cost[j] = c;
          from[j] = i;
          push(j, c + h(j));
        }
      }
    }
  }
  if (from[g] < 0) return null;
  const out: number[] = [];
  for (let i = g; i !== s && i >= 0; i = from[i]) out.push(i);
  return out.reverse();
}

export class SeaFolk {
  tribes: SeaTribe[] = [];
  bands: SeaBand[] = [];
  cleared: { x: number; y: number; t: number }[] = [];
  started = false;
  /** off in bare test worlds; on in every real game */
  enabled = true;
  rng: Rng;
  private ids = 5e8;
  private nextTribe = 1;
  private settleT = 700;
  private uniteT = 200;
  private tickT = 0;
  private bandT = 0;
  private toastAt = -999;
  private index = new Map<number, Brute[]>();

  constructor(seed = 1) {
    this.rng = makeRng((seed ^ 0x5eaf01c) >>> 0);
  }

  /* ------------------------------ lookups ------------------------------ */

  tribe(id: number | undefined) {
    return id ? this.tribes.find((t) => t.id === id) ?? null : null;
  }
  members(id: number) {
    return this.index.get(id) ?? [];
  }
  folk(w: World) {
    return w.rivals.brutes.filter((b) => !!b.sea);
  }
  label(b: Brute) {
    const t = this.tribe(b.sea);
    return t ? `${b.name} of the ${t.name} Sea People` : `${b.name} of the Sea People`;
  }
  villageAt(x: number, y: number, r = 170) {
    let best: SeaTribe | null = null;
    let bd = r;
    for (const t of this.tribes) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }
  /** Inside a sea village's waters? (the sea reptiles guard them) */
  guarded(x: number, y: number) {
    return this.tribes.some((t) => Math.hypot(t.x - x, t.y - y) < t.r);
  }
  cap(t: SeaTribe) {
    return 5 + t.tier * 3;
  }
  private nextId() {
    return this.ids++;
  }
  private reindex(w: World) {
    this.index.clear();
    for (const b of w.rivals.brutes) {
      if (!b.sea) continue;
      const l = this.index.get(b.sea);
      if (l) l.push(b);
      else this.index.set(b.sea, [b]);
    }
  }

  /* ------------------------------ the loop ------------------------------ */

  update(w: World, dt: number) {
    const ext = w.extinction.phase;
    if (ext === "aftermath" || ext === "ended" || ext === "ruins") {
      if (this.tribes.length) this.clear(w);
      return;
    }
    if (!this.started) {
      if (!this.enabled || !w.rivals.started || w.elapsed < START_AT || !w.humans.length) return;
      this.started = true;
      this.settle(w, 1);
      this.settle(w, 1);
    }
    this.reindex(w);
    this.bandT -= dt;
    if (this.bandT <= 0) {
      this.bandT = 0.25;
      this.bandsTick(w);
    }
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = 1;
      this.slowTick(w, 1);
    }
  }

  /** One Sea Person's frame (from Rivals.update). */
  step(w: World, b: Brute, dt: number) {
    if (b.spotT) b.spotT = Math.max(0, b.spotT - dt);
    b.think -= dt;
    if (b.think <= 0) this.think(w, b);
    this.act(w, b, dt);
    this.ride(w, b);
  }

  /* ------------------------------ villages ------------------------------ */

  /** Shallow sea water just off the coast, far from everyone, near the sea reptiles if possible. */
  private site(w: World, minFromUs = SEA_MIN): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bs = -Infinity;
    for (let k = 0; k < 900; k++) {
      // the old valley's coast (the eastern shore is for later villages + the People tool)
      const x = 160 + this.rng() * (OLD_MAP_W * TILE - 320);
      const y = 160 + this.rng() * (OLD_MAP_H * TILE - 320);
      const s = this.siteScore(w, x, y, minFromUs);
      if (s > bs) {
        bs = s;
        best = { x, y };
      }
    }
    return best;
  }

  /** How good a village spot (x, y) is (-Infinity = no good). */
  private siteScore(w: World, x: number, y: number, minFromUs: number) {
    const t = w.terrain.tileAt(x, y);
    if (t !== T.Shallow && t !== T.Deep) return -Infinity;
    if (!w.terrain.isSalt(x, y)) return -Infinity;
    const fromUs = Math.hypot(x - w.camp.x, y - w.camp.y);
    if (fromUs < minFromUs) return -Infinity;
    if (Math.hypot(x - w.volcano.x, y - w.volcano.y) < 1000) return -Infinity;
    if (w.rivals.clans.some((c) => Math.hypot(c.x - x, c.y - y) < 800)) return -Infinity;
    if (w.forest.tribes.some((c) => Math.hypot(c.x - x, c.y - y) < 800)) return -Infinity;
    if (this.tribes.some((c) => Math.hypot(c.x - x, c.y - y) < 900)) return -Infinity;
    if (this.cleared.some((c) => w.elapsed - c.t < CLEARED_FOR && Math.hypot(c.x - x, c.y - y) < 900)) return -Infinity;
    // water all round the heart (room for the stilt-houses), but the shore close by
    let water = 0;
    let land = 0;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      if (waterAt(w, x + Math.cos(a) * 110, y + Math.sin(a) * 110)) water++;
      const lx = x + Math.cos(a) * 280;
      const ly = y + Math.sin(a) * 280;
      if (!waterAt(w, lx, ly) && !BLOCK.has(w.terrain.tileAt(lx, ly))) land++;
    }
    if (water < 10 || land < 2) return -Infinity;
    // friends nearby
    const friends = w.dinos.some((d) => (d.species === "mosa" || d.species === "plesio" || d.species === "plio") && Math.hypot(d.x - x, d.y - y) < 1200);
    return fromUs * 0.5 + (friends ? 500 : 0) + (t === T.Shallow ? 150 : 0) + this.rng() * 120;
  }

  /** Stilt-houses round the heart, out on the water. */
  private buildHuts(w: World, t: SeaTribe) {
    const want = 4 + t.tier * 2;
    const order: SeaHut["kind"][] = ["longhouse", "dock", "fishPen", "pearlBed", "hut", "sharkPen", "lookout", "hut", "shrine", "rack", "hut", "pearlBed", "dock", "hut", "fishPen", "hut"];
    if (!t.huts.length) t.huts.push({ x: Math.round(t.x), y: Math.round(t.y), kind: "longhouse", hp: 1 });
    for (let r = 60; r <= 200 && t.huts.length < want; r += 35) {
      const n = Math.round((Math.PI * 2 * r) / 70);
      const a0 = this.rng() * Math.PI;
      for (let i = 0; i < n && t.huts.length < want; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        const x = t.x + Math.cos(a) * r;
        const y = t.y + Math.sin(a) * r * 0.75;
        const kind = order[t.huts.length % order.length];
        // the sea farms need more room round them
        const room = (k: SeaHut["kind"]) => (k === "fishPen" || k === "pearlBed" || k === "sharkPen" ? 40 : 27);
        if (!waterAt(w, x, y) || t.huts.some((h) => Math.hypot(h.x - x, h.y - y) < room(h.kind) + room(kind))) continue;
        t.huts.push({ x: Math.round(x), y: Math.round(y), kind, hp: 1 });
      }
    }
  }

  /** Markers on the shore round their waters: shell totems, a great fish skull on a pole, net poles, a beached war canoe. */
  private plantSigns(w: World, t: SeaTribe) {
    const kinds: SeaSign["kind"][] = ["shellTotem", "fishSkull", "netPole", "beached"];
    const n = 4 + t.tier;
    t.signs = [];
    for (let k = 0; k < 120 && t.signs.length < n; k++) {
      const a = this.rng() * Math.PI * 2;
      const r = t.r * (0.45 + this.rng() * 0.5);
      const x = t.x + Math.cos(a) * r;
      const y = t.y + Math.sin(a) * r;
      const tile = w.terrain.tileAt(x, y);
      if (isWaterTile(tile) || BLOCK.has(tile)) continue;
      if (t.signs.some((s) => Math.hypot(s.x - x, s.y - y) < 120)) continue;
      t.signs.push({ x: Math.round(x), y: Math.round(y), kind: kinds[t.signs.length % kinds.length], v: Math.floor(this.rng() * 4) });
    }
  }

  /** A new village goes up (at a given spot, or the best one going). */
  settle(w: World, tier = 1, at?: { x: number; y: number }): SeaTribe | null {
    const spot = at ?? this.site(w);
    if (!spot) return null;
    const used = new Set(this.tribes.map((t) => t.name));
    const names = TRIBE_NAMES.filter((n) => !used.has(n));
    const worn = new Set(this.tribes.map((t) => t.color));
    const paints = PAINTS.filter((c) => !worn.has(c));
    const t: SeaTribe = {
      id: this.nextTribe++,
      name: pick(this.rng, names.length ? names : TRIBE_NAMES),
      color: pick(this.rng, paints.length ? paints : PAINTS),
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      huts: [],
      signs: [],
      r: 520 + tier * 70,
      tier,
      food: 5,
      growT: 50 + this.rng() * 30,
      raidT: 300 + this.rng() * 240,
      work: 0,
    };
    this.buildHuts(w, t);
    this.plantSigns(w, t);
    this.tribes.push(t);
    const n = 4 + tier * 2;
    const folk: Brute[] = [];
    for (let i = 0; i < n; i++) {
      const h = t.huts[i % t.huts.length];
      folk.push(this.add(w, t, h.x + (this.rng() - 0.5) * 20, h.y + 3));
    }
    for (let i = 0; i < 2; i++) folk.push(this.add(w, t, t.x + (this.rng() - 0.5) * 20, t.y + 3, { age: this.rng() * 80 }));
    // they live in groups, like the clans: a crew that fishes + paddles together, families at home (folkGroups.ts)
    foundingGroups(w, "sea", t.id, folk, t);
    return t;
  }

  /** The People tool: a village goes up where you tap on the sea (snapped to the nearest good water). */
  placeVillage(w: World, x: number, y: number, minFromUs: number): SeaTribe | string {
    if (this.tribes.length >= MAX_VILLAGES) return `There are already ${MAX_VILLAGES} Sea People villages: the coast can't hold more.`;
    let spot: { x: number; y: number } | null = null;
    for (let r = 0; r <= 320 && !spot; r += 32) {
      const n = r ? Math.round((r / 32) * 6) : 1;
      for (let i = 0; i < n && !spot; i++) {
        const px = x + Math.cos((i / n) * Math.PI * 2) * r;
        const py = y + Math.sin((i / n) * Math.PI * 2) * r;
        if (this.siteScore(w, px, py, minFromUs) > -Infinity) spot = { x: px, y: py };
      }
    }
    if (!spot) {
      if (!waterAt(w, x, y) || !w.terrain.isSalt(x, y)) return "Sea People build out on the sea, just off the coast. Tap on the sea near the shore.";
      if (Math.hypot(x - w.camp.x, y - w.camp.y) < minFromUs + 300) return "Too close to our camp: they want their own stretch of coast further out.";
      return "No good water for stilt-houses here (too far out, too cramped, or someone else is close). Try another bit of coast.";
    }
    this.enabled = true;
    this.started = true;
    w.rivals.started = true;
    const t = this.settle(w, 1, spot);
    if (!t) return "They couldn't settle there.";
    t.seen = true;
    t.found = true;
    return t;
  }

  /**
   * The People tool, a group: a fishing family, a patrol or a raiding party of Sea People in their canoes where
   * you tap on the water. They belong to the nearest village (a new one goes up if there's none along this coast).
   */
  placeGroup(w: World, x: number, y: number, kind: GroupKind): { t: SeaTribe; n: number; g: FolkGroup } | string {
    if (!waterAt(w, x, y)) return "Sea People paddle in from the water. Tap on the sea (or a river near the coast).";
    let t = this.tribes.slice().sort((a, b) => dist(a, { x, y }) - dist(b, { x, y }))[0] ?? null;
    if (!t || dist(t, { x, y }) > 3200) {
      const made = this.placeVillage(w, x, y, 1000);
      if (typeof made === "string") return made;
      t = made;
    }
    this.enabled = true;
    this.started = true;
    w.rivals.started = true;
    const n = kind === "raid" || kind === "war" ? 6 : 4;
    const folk: Brute[] = [];
    for (let i = 0; i < n; i++) folk.push(this.add(w, t, x + (this.rng() - 0.5) * 70, y + (this.rng() - 0.5) * 40, kind === "family" && i >= 2 ? { age: 40 + this.rng() * 60 } : {}));
    const g = w.groups.make("sea", t.id, kind === "caravan" ? "patrol" : kind, folk, x, y)!;
    t.seen = true;
    if ((kind === "raid" || kind === "war") && this.launch(w, t, folk, { kind: "town", id: 0 }, w.camp.pileX, w.camp.pileY, true)) return { t, n, g };
    const spot = kind === "patrol" ? this.waterSpot(w, t, t.r * 0.9, false) : null;
    w.groups.moveTo(w, g, spot?.x ?? t.x, spot?.y ?? t.y, kind === "patrol" ? "wander" : "home");
    return { t, n, g };
  }

  private add(w: World, t: SeaTribe, x: number, y: number, o: Partial<Brute> = {}): Brute {
    const r = this.rng();
    const weapon: BruteWeapon = r < 0.42 ? "spear" : r < 0.62 ? "club" : r < 0.82 ? "bone" : "sling";
    const used = new Set(this.members(t.id).map((b) => b.name));
    const names = FOLK_NAMES.filter((n) => !used.has(n));
    const b: Brute = {
      id: this.nextId(),
      kind: "brute",
      name: pick(this.rng, names.length ? names : FOLK_NAMES),
      clan: 0,
      sea: t.id,
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      dir: this.rng() < 0.5 ? 1 : -1,
      hp: 1,
      weapon,
      tint: t.color,
      state: "idle",
      stateT: 0,
      think: this.rng() * 2,
      tx: x,
      ty: y,
      targetId: 0,
      cd: 0,
      anim: this.rng() * 10,
      path: null,
      pathI: 0,
      pathKey: 0,
      stuckT: 0,
      raid: false,
      war: 0,
      captive: 0,
      loot: 0,
      age: SEA_GROWN,
      flank: this.rng() < 0.5 ? -1 : 1,
      bubble: null,
      ...o,
    };
    w.rivals.brutes.push(b);
    const l = this.index.get(t.id);
    if (l) l.push(b);
    else this.index.set(t.id, [b]);
    return b;
  }

  /* ------------------------------ once a second ------------------------------ */

  private slowTick(w: World, dt: number) {
    const total = this.folk(w).length;
    const calm = w.tribe.danger === "calm";
    for (const t of [...this.tribes]) {
      const fs = this.members(t.id);
      const adults = fs.filter((b) => (b.age ?? SEA_GROWN) >= SEA_GROWN);
      const home = adults.filter((b) => dist(b, t) < t.r + 100).length;
      // the sea feeds them well
      t.food = Math.min(30, Math.max(0, t.food + (0.03 + home * 0.013) * dt - fs.length * 0.006 * dt));
      for (const b of fs) if ((b.age ?? SEA_GROWN) < SEA_GROWN) b.age = Math.min(SEA_GROWN, (b.age ?? 0) + dt * (t.food > 0 ? 1 : 0.4));
      t.growT -= dt * (t.food > 4 ? 1.25 : 1);
      if (t.growT <= 0) {
        t.growT = 55 + this.rng() * 35;
        if (t.food >= 1.5 && fs.length < this.cap(t) && total < MAX_SEA) {
          t.food -= 1.5;
          const h = t.huts[Math.floor(this.rng() * t.huts.length)];
          this.add(w, t, (h?.x ?? t.x) + (this.rng() - 0.5) * 16, (h?.y ?? t.y) + 3, this.rng() < 0.65 ? { age: 0 } : {});
        }
      }
      t.work += (0.06 + home * 0.02) * dt;
      if (t.work >= 80 + t.tier * 50 && t.food >= 4 && t.tier < this.maxTier(t)) {
        t.work = 0;
        t.tier++;
        t.food -= 3;
        t.r += 60;
        this.buildHuts(w, t);
        this.plantSigns(w, t);
        if (t.found) w.toast("🛖", `The ${t.name} sea village is growing: more stilt-houses out on the water.`, t.x, t.y);
      }
      this.hutsTick(w, t);
      if (!this.tribes.includes(t)) continue;
      if (!fs.length) {
        if (this.rng() < dt / 400 && !w.humans.some((h) => !h.captive && dist(h, t) < 900)) this.raze(w, t, "empty");
        continue;
      }
      this.discoverTick(w, t);
      this.farmsTick(t, dt);
      this.tameTick(w, t, dt, adults.length);
      // the sea reptiles that swim round the village are their friends
      for (const d of w.dinos) {
        if ((d.species === "mosa" || d.species === "plesio" || d.species === "plio") && dist(d, t) < t.r && this.rng() < dt * 0.03) emote(d, "💙", 1.6);
      }
      // war canoes: quicker to set out once it's getting dark
      t.raidT -= dt * (w.daylight < 0.4 ? 1.8 : 1) * (t.food < 3 ? 1.3 : 1) * (1 + t.tier * 0.12);
      if (t.raidT <= 0) {
        t.raidT = 320 + this.rng() * 260;
        if (!this.bands.some((bd) => bd.tribe === t.id)) this.startRaid(w, t, calm);
      }
    }
    this.bands = this.bands.filter((bd) => {
      bd.ids = bd.ids.filter((id) => w.rivals.brutes.some((b) => b.id === id && b.band === bd.id));
      return bd.ids.length > 0;
    });
    // all Sea People are friends: now and then two villages join into one
    this.uniteT -= dt;
    if (this.uniteT <= 0) {
      this.uniteT = 150 + this.rng() * 120;
      this.politics(w);
    }
    if (this.tribes.length < 2 && this.started) {
      this.settleT -= dt;
      if (this.settleT <= 0) {
        this.settleT = 600 + this.rng() * 300;
        this.settle(w, 0);
      }
    }
    for (const b of this.folk(w)) {
      if (this.tribe(b.sea)) continue;
      if (b.state !== "flee") setB(b, "flee", b.x < WORLD_W / 2 ? 20 : WORLD_W - 20, b.y);
      if (b.stateT > 70 || b.x < 40 || b.x > WORLD_W - 40) {
        this.dismount(w, b);
        const i = w.rivals.brutes.indexOf(b);
        if (i >= 0) w.rivals.brutes.splice(i, 1);
      }
    }
  }

  private hutsTick(w: World, t: SeaTribe) {
    let standing = 0;
    for (const h of t.huts) {
      if (h.hp <= 0) continue;
      // fire can still take the thatch (a dragon's breath, a burning boat)
      if (w.fire.at(Math.floor(h.x / TILE), Math.floor(h.y / TILE)) > 0.3) h.hp = Math.max(0, h.hp - 0.3);
      if (h.hp > 0) standing++;
    }
    if (!standing && t.huts.length) this.raze(w, t, "us");
  }

  private discoverTick(w: World, t: SeaTribe) {
    for (const h of w.humans) {
      if (h.captive || h.under) continue;
      const d = dist(h, t);
      // out on open water: you can see a village from a long way off
      if (!t.found && (d < 700 || (h.aloft && d < 1000) || t.signs.some((s) => dist(h, s) < 200))) {
        t.found = true;
        t.seen = true;
        w.toast("🛶", `${h.name} spotted a Sea People village out on the water: the ${t.name}, stilt-houses and canoes, about ${this.members(t.id).length} of them. The sea beasts swim round it like guard dogs.`, t.x, t.y);
        if (!w.flags.has("seaFolkTip")) {
          w.flags.add("seaFolkTip");
          w.toast("🌊", "Sea People raid by canoe, up the rivers. Watch the riverbanks (torches and fires help at night), and don't wade into their waters: their sea-beast friends guard them. Tap the village with armed people picked to attack it.", t.x, t.y);
        }
        return;
      }
    }
  }

  /** The village is gone. Loot + what we learn go to whoever did it. */
  raze(w: World, t: SeaTribe, by: "us" | "empty") {
    const i = this.tribes.indexOf(t);
    if (i < 0) return;
    this.tribes.splice(i, 1);
    this.bands = this.bands.filter((b) => b.tribe !== t.id);
    this.cleared.push({ x: t.x, y: t.y, t: w.elapsed });
    w.particles.burst(P.Splash, t.x, t.y, 20, 110, { vz: 120, g: 220, size: 4, max: 1 });
    const kin = [...this.tribes].sort((a, b) => dist(a, t) - dist(b, t))[0];
    // their sea dragons go to their kin, or back to the wild
    for (const d of w.dinos) {
      if (d.seaTribe !== t.id) continue;
      d.seaTribe = kin?.id;
      d.seaRider = undefined;
    }
    for (const b of this.members(t.id)) {
      this.dismount(w, b);
      b.band = undefined;
      b.raid = false;
      if (kin) {
        b.sea = kin.id;
        setB(b, "flee", kin.x, kin.y);
      }
    }
    this.index.delete(t.id);
    if (by === "empty") return;
    const s = w.camp.stock;
    const loot: Partial<Record<Resource, number>> = { fish: 8 + t.tier * 4 + Math.floor(t.food), pearl: 1 + t.tier + Math.floor(t.pearls ?? 0), salt: 2 + t.tier, hide: 2 + t.tier, bone: 3 + t.tier * 2, tooth: 1 + t.tier + Math.floor(t.teeth ?? 0), wood: 6 + t.tier * 3 };
    for (const [r, n] of Object.entries(loot) as [Resource, number][]) s[r] = (s[r] ?? 0) + n;
    const arm = w.colony.armory;
    arm.spearB = (arm.spearB ?? 0) + 1 + t.tier;
    const list = Object.entries(loot).map(([r, n]) => `${n} ${r === "pearl" ? "pearls" : r === "tooth" ? "shark + other teeth" : r}`).join(", ");
    w.toast("🔥", `We pulled down the ${t.name} sea village! Took ${list}, plus ${1 + t.tier} harpoon${t.tier ? "s" : ""} for the armory.`, t.x, t.y);
    const others = [...this.tribes.filter((o) => !o.found), ...w.forest.tribes.filter((o) => !o.found)];
    for (const o of others) {
      o.found = true;
      o.seen = true;
    }
    if (others.length) w.toast("🗺️", `Their sea charts (knotted cords + shells) show where ${others.length === 1 ? "another enemy camp is" : `${others.length} more enemy camps are`}. Now marked for you.`, others[0].x, others[0].y);
    w.celebrate("Coast cleared!");
  }

  /** Our people pull one stilt-house down. */
  wreck(w: World, t: SeaTribe, h: SeaHut, amount: number) {
    if (h.hp <= 0) return;
    h.hp = Math.max(0, h.hp - amount);
    w.particles.burst(P.Splash, h.x, h.y, 4, 50, { vz: 60, g: 200, size: 3, max: 0.7 });
    w.sfx("thud", h.x, h.y, 0.5, 0.9);
    if (h.hp <= 0) {
      w.particles.burst(P.Splash, h.x, h.y, 14, 90, { vz: 100, g: 220, size: 4, max: 1 });
      w.shake(2, 0.3);
      if (!t.huts.some((o) => o.hp > 0)) this.raze(w, t, "us");
    }
  }

  /* ------------------------------ war canoes ------------------------------ */

  /** A war party sets out: our town (not in a calm world), a Neanderthal camp, or the Tree People. */
  startRaid(w: World, t: SeaTribe, calm = w.tribe.danger === "calm"): boolean {
    const free = this.members(t.id).filter((b) => (b.age ?? SEA_GROWN) >= SEA_GROWN && !b.band && b.hp > 0.6 && b.state !== "flee");
    if (free.length < 4) return false;
    const goals: { goal: SeaBand["goal"]; x: number; y: number }[] = [];
    if (!calm && w.elapsed > 700) goals.push({ goal: { kind: "town", id: 0 }, x: w.camp.pileX, y: w.camp.pileY });
    const clan = w.rivals.clans.filter((c) => dist(c, t) < 3400).sort((a, b) => dist(a, t) - dist(b, t))[0];
    if (clan) goals.push({ goal: { kind: "clan", id: clan.id }, x: clan.x, y: clan.y });
    const tree = w.forest.tribes.filter((c) => dist(c, t) < 3400).sort((a, b) => dist(a, t) - dist(b, t))[0];
    if (tree) goals.push({ goal: { kind: "tree", id: tree.id }, x: tree.x, y: tree.y + 40 });
    if (!goals.length) return false;
    const g = goals[Math.floor(this.rng() * goals.length)];
    return this.launch(w, t, free, g.goal, g.x, g.y);
  }

  /** Off they go (exported for tests + the odd scripted raid). */
  /** Send a raid out (`all`: every one of `free` goes, e.g. a raiding party placed with the People tool). */
  launch(w: World, t: SeaTribe, free: Brute[], goal: SeaBand["goal"], gx: number, gy: number, all = false): boolean {
    const route = seaRoute(w, t.x, t.y, gx, gy);
    if (!route || !route.length) return false;
    const n = all ? free.length : Math.min(free.length - 1, 3 + t.tier * 2, 8);
    if (n < 3) return false;
    const party = free.sort((a, b) => dist(a, t) - dist(b, t)).slice(0, n);
    const bd: SeaBand = { id: this.nextId(), tribe: t.id, mode: "raid", x: gx, y: gy, ids: party.map((b) => b.id), t: 0, size: party.length, goal, route };
    this.bands.push(bd);
    // the village's sea dragons carry the first warriors
    const beasts = w.dinos.filter((d) => d.seaTribe === t.id && !d.seaRider && d.health > 0.4 && dist(d, t) < 1200);
    party.forEach((b, i) => {
      b.band = bd.id;
      b.raid = goal.kind === "town";
      b.pathI = 0;
      if (beasts[i]) this.mountUp(w, b, beasts[i]);
      setB(b, "rally", b.mount ? b.x : t.x + (this.rng() - 0.5) * 80, b.mount ? b.y : t.y + (this.rng() - 0.5) * 50);
    });
    if (beasts.length && t.found) w.toast("🐉", `The ${t.name} Sea People are riding their sea dragons out to war!`, t.x, t.y);
    if (t.found) w.sfx("drums", t.x, t.y, 0.7, 0.9);
    return true;
  }

  private bandsTick(w: World) {
    for (const bd of this.bands) {
      bd.t += 0.25;
      const t = this.tribe(bd.tribe);
      const party = bd.ids.map((id) => w.rivals.byId(id)).filter((b): b is Brute => !!b && b.band === bd.id);
      if (!t || !party.length) {
        bd.ids = [];
        continue;
      }
      if (bd.mode === "home") {
        if (party.every((b) => dist(b, t) < 140) || bd.t > 150) {
          for (const b of party) {
            b.band = undefined;
            b.raid = false;
            if (b.loot) {
              t.food += b.loot;
              b.loot = 0;
            }
            if (b.forage) {
              t.food += b.forage;
              b.forage = 0;
            }
          }
          bd.ids = [];
        }
        continue;
      }
      const g = bd.goal;
      if ((g.kind === "clan" && !w.rivals.clan(g.id)) || (g.kind === "tree" && !w.forest.tribe(g.id))) {
        this.sendHome(bd, party);
        continue;
      }
      if (bd.t < 5) continue;
      const alive = party.filter((b) => b.hp > 0.25 && b.state !== "flee");
      const c = centroid(alive.length ? alive : party);
      const ours = this.armedNear(w, c.x, c.y, 300);
      const looted = party.filter((b) => b.loot || b.forage).length;
      if (alive.length <= bd.size * 0.45 || (dist(c, bd) < 450 && ours > alive.length * 1.4 + 1) || looted >= Math.ceil(party.length * 0.5) || bd.t > 260) {
        if (g.kind === "town" && looted) w.toast("🛶", "The Sea People are paddling off down the river with our food!", c.x, c.y);
        this.sendHome(bd, party);
        continue;
      }
      if (g.kind === "town" && !bd.warned && dist(c, bd) < 1000) {
        bd.warned = true;
        const sneaky = w.daylight < 0.3;
        w.alarm(bd.x, bd.y, sneaky ? 300 : 600, 0.6, "❗", false);
        if (w.elapsed - this.toastAt > 20) {
          this.toastAt = w.elapsed;
          w.toast("🛶", sneaky
            ? `Paddles in the dark… ${party.length} Sea People canoes are creeping up the river toward the town! (Our Scorpions can't see them at night: light fires by the water.)`
            : `War canoes on the river! ${party.length} Sea People${t.found ? ` of the ${t.name}` : ""} are paddling up toward our town!`, c.x, c.y);
        }
      }
    }
    this.bands = this.bands.filter((b) => b.ids.length > 0);
  }

  private sendHome(bd: SeaBand, party: Brute[]) {
    bd.mode = "home";
    bd.t = 0;
    for (const b of party) {
      b.raid = false;
      if (b.state !== "flee") setB(b, "home", b.x, b.y);
      b.pathI = this.nearestNode(bd, b);
      b.think = 0.2;
    }
  }

  /** Where along the route this one is (the closest node). */
  private nearestNode(bd: SeaBand, b: Brute) {
    let best = 0;
    let bdist = Infinity;
    for (let i = 0; i < bd.route.length; i += 1) {
      const p = tileXY(bd.route[i]);
      const d = Math.abs(p.x - b.x) + Math.abs(p.y - b.y);
      if (d < bdist) {
        bdist = d;
        best = i;
      }
    }
    return best;
  }

  /* ------------------------------ brains ------------------------------ */

  private awake(w: World, b: Brute) {
    const v = w.view;
    if (b.x > v.x0 - 250 && b.x < v.x1 + 250 && b.y > v.y0 - 250 && b.y < v.y1 + 250) return true;
    if (b.band || b.state === "fight" || b.state === "flee") return true;
    for (const h of w.humans) if (Math.abs(h.x - b.x) < 900 && Math.abs(h.y - b.y) < 900) return true;
    return false;
  }

  private think(w: World, b: Brute) {
    const t = this.tribe(b.sea);
    const active = this.awake(w, b);
    b.think = active ? 0.4 + this.rng() * 0.3 : 2 + this.rng() * 1.5;
    if (!t) return;
    if (active) this.spot(w, b);
    if (b.state === "dart") return;
    // little ones stay home on the boardwalks
    if ((b.age ?? SEA_GROWN) < SEA_GROWN) {
      if (dist(b, t) > 160 || (b.state !== "idle" && b.state !== "sleep")) this.toHut(w, b, t, "idle");
      return;
    }
    if (b.hp < 0.3 && b.state !== "flee") {
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      return;
    }
    if (b.state === "flee") return;
    const bd = b.band ? this.bands.find((x) => x.id === b.band) : null;
    if (b.band && !bd) b.band = undefined;
    if (bd) return this.bandThink(w, b, t, bd);
    if (b.state === "fight" && this.keepFighting(w, b, t)) return;
    // someone in their waters: everyone near grabs a harpoon
    if (dist(b, t) < t.r) {
      const foe = this.foeNearAt(w, b.x, b.y, dist(b, t) < t.r * 0.6 ? 320 : 180, w.tribe.danger !== "calm", t);
      if (foe) return this.engage(w, b, t, foe);
    }
    if (w.daylight < 0.3) {
      if (b.state !== "sleep") this.toHut(w, b, t, "sleep");
      return;
    }
    if (b.state === "sleep") setB(b, "idle", b.x, b.y);
    const busy = (b.state === "idle" && b.stateT < 10) || ((b.state === "walk" || b.state === "wander" || b.state === "home") && b.stateT < 40) || (b.state === "forage" && b.stateT < 60);
    if (busy) return;
    b.stateT = 0;
    // in a group, they go where their leader goes: out fishing together, or home to the stilt-houses together
    const g = w.groups.of(b);
    const lead = g ? w.groups.leader(w, g) : null;
    if (lead && lead !== b && !b.mount) {
      if (lead.state === "forage" || lead.state === "wander") {
        const spot = w.groups.spot(w, b, () => this.waterSpot(w, t, t.r * 0.85, true));
        if (spot) setB(b, lead.state, spot.x, spot.y);
      } else this.toHut(w, b, t, "idle");
      return;
    }
    // out on a sea dragon: another lap of the village waters, or home to the stilt-houses
    if (b.mount) {
      if (this.rng() < 0.3) this.toHut(w, b, t, "idle");
      else {
        const spot = this.waterSpot(w, t, t.r * 0.95, false);
        if (spot) setB(b, "wander", spot.x, spot.y);
      }
      return;
    }
    const beast = this.rng() < 0.15 ? w.dinos.find((d) => d.seaTribe === t.id && !d.seaRider && d.health > 0.5 && dist(d, b) < 450) : null;
    if (beast) {
      // a ride round their waters
      this.mountUp(w, b, beast);
      const spot = this.waterSpot(w, t, t.r * 0.95, false);
      if (spot) setB(b, "wander", spot.x, spot.y);
      return;
    }
    const r = this.rng();
    const farms = t.huts.filter((h) => h.hp > 0 && (h.kind === "fishPen" || h.kind === "pearlBed" || h.kind === "sharkPen"));
    if (r < 0.25 && farms.length) {
      // tending the farms: feeding the sharks, turning the oysters, mending the fish pen
      const f = farms[Math.floor(this.rng() * farms.length)];
      setB(b, "forage", f.x + (this.rng() - 0.5) * 20, f.y + 16);
      return;
    }
    if (r < 0.55) {
      // out fishing in the deep water (their group comes along)
      const spot = w.groups.spot(w, b, () => this.waterSpot(w, t, t.r * 0.85, true));
      if (spot) setB(b, "forage", spot.x, spot.y);
    } else if (r < 0.62) {
      const spot = this.waterSpot(w, t, t.r * 0.9, false);
      if (spot) setB(b, "wander", spot.x, spot.y);
    } else this.toHut(w, b, t, "idle");
    if (this.rng() < 0.04) say(b, pick(this.rng, ["Good wind.", "Fish!", "Hoo-ya.", "*whistles*", "The deep is calm."]), 1.4);
  }

  private bandThink(w: World, b: Brute, t: SeaTribe, bd: SeaBand) {
    if (bd.mode === "home") {
      if (b.state !== "home" && b.state !== "flee") setB(b, "home", b.x, b.y);
      return;
    }
    if (bd.t < 5) {
      if (b.state !== "rally") setB(b, "rally", b.x, b.y);
      return;
    }
    if (b.loot || b.forage) {
      if (b.state !== "home") {
        setB(b, "home", b.x, b.y);
        b.pathI = this.nearestNode(bd, b);
      }
      return;
    }
    if (b.state === "fight" && this.keepFighting(w, b, t, bd)) return;
    const near = dist(b, bd) < 420;
    const g = bd.goal;
    // on the way: only fight what's right there; at the goal: anyone about
    const foe = this.foeNearAt(w, b.x, b.y, near ? 300 : 150, g.kind !== "clan" && g.kind !== "tree", t, g.kind === "tree" ? g.id : undefined);
    if (foe) return this.engage(w, b, t, foe);
    if (near && dist(b, bd) < 120) {
      if (g.kind === "town") {
        const got = takeFood(w, 2);
        if (got) {
          b.loot = got.n;
          b.lootKind = got.r;
          say(b, pick(this.rng, ["To the boats!", "Ha!", "Fish for us!"]), 1.4);
          setB(b, "home", b.x, b.y);
          b.pathI = this.nearestNode(bd, b);
          return;
        }
      } else if (g.kind === "clan") {
        const c = w.rivals.clan(g.id);
        if (c && c.food >= 1) {
          const n = Math.min(2, Math.floor(c.food));
          c.food -= n;
          b.forage = n;
          say(b, "Ha!", 1.2);
          setB(b, "home", b.x, b.y);
          b.pathI = this.nearestNode(bd, b);
          return;
        }
      } else if (g.kind === "tree") {
        // nobody left to fight on the ground: hack at the nearest tree deck
        const tr = w.forest.tribe(g.id);
        const pod = tr?.pods.filter((p) => p.hp > 0).sort((p, q) => dist(p, b) - dist(q, b))[0];
        if (tr && pod) {
          if (dist(pod, b) < 30) {
            w.forest.wreck(w, tr, pod, 0.08);
            b.think = 1;
          } else setB(b, "walk", pod.x + 8, pod.y + 8);
          return;
        }
      }
    }
    if (b.state !== "walk") {
      setB(b, "walk", bd.x, bd.y);
      b.pathI = this.nearestNode(bd, b);
    }
  }

  private keepFighting(w: World, b: Brute, t: SeaTribe, bd?: SeaBand) {
    const f = this.foeById(w, b.targetId);
    if (!f) return false;
    const p = foeXY(f);
    if (dist(p, bd ?? t) > (bd ? 700 : t.r + 250) || b.stateT > 30) return false;
    return true;
  }

  private engage(w: World, b: Brute, t: SeaTribe, foe: Foe) {
    const p = foeXY(foe);
    b.targetId = p.id;
    setB(b, "fight", p.x, p.y);
    for (const o of this.members(t.id)) {
      if (o === b || o.band !== b.band || (o.age ?? SEA_GROWN) < SEA_GROWN || o.hp < 0.35 || o.state === "fight" || o.state === "flee" || dist(o, b) > 280) continue;
      o.targetId = p.id;
      o.think = 0.4 + this.rng() * 0.4;
      setB(o, "fight", p.x, p.y);
    }
  }

  /** Our people (if they're fair game), Neanderthals and visible Tree People round (x, y). */
  private foeNearAt(w: World, x: number, y: number, r: number, humans: boolean, t: SeaTribe, tree?: number): Foe | null {
    let best: Foe | null = null;
    let bd = r;
    if (humans && w.tribe.danger !== "calm") {
      for (const h of w.humans) {
        if (!fairGame(h)) continue;
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bd) {
          bd = d;
          best = { kind: "human", h };
        }
      }
    }
    for (const o of w.rivals.brutes) {
      if (o.sea || o.hp <= 0 || o.captive || o.snatched || o.falling || o.weapon === "catapult") continue;
      if (o.tree && (o.hidden || (o.age ?? 100) < 100 || (tree && o.tree !== tree && Math.hypot(o.x - t.x, o.y - t.y) > 1200))) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) {
        bd = d;
        best = { kind: "brute", b: o };
      }
    }
    return best;
  }

  private armedNear(w: World, x: number, y: number, r: number) {
    let n = 0;
    for (const h of w.humans) {
      if (h.child || h.captive || h.under || h.stranger || h.state === "down") continue;
      if (Math.abs(h.x - x) < r && Math.abs(h.y - y) < r && Math.hypot(h.x - x, h.y - y) < r && w.tribe.weaponFor(w, h)) n++;
    }
    return n;
  }

  private foeById(w: World, id: number): Foe | null {
    if (!id) return null;
    const h = w.humans.find((o) => o.id === id);
    if (h) return fairGame(h) ? { kind: "human", h } : null;
    const o = w.rivals.byId(id);
    return o && !o.sea && o.hp > 0 && !o.captive && !o.snatched && !o.falling ? { kind: "brute", b: o } : null;
  }

  /** A spot on the water inside their waters (deep: out fishing). */
  private waterSpot(w: World, t: SeaTribe, r: number, deep: boolean) {
    for (let k = 0; k < 14; k++) {
      const a = this.rng() * Math.PI * 2;
      const d = 80 + this.rng() * (r - 80);
      const x = t.x + Math.cos(a) * d;
      const y = t.y + Math.sin(a) * d;
      const tile = w.terrain.tileAt(x, y);
      if (deep ? tile === T.Deep : isWaterTile(tile)) return { x, y };
    }
    return null;
  }

  /** Back to one of the stilt-houses (off the sea dragon first, once there). */
  private toHut(w: World, b: Brute, t: SeaTribe, then: "idle" | "sleep") {
    if (b.mount && dist(b, t) < 260) this.dismount(w, b);
    const huts = t.huts.filter((h) => h.hp > 0);
    const h = huts.length ? huts[b.id % huts.length] : t;
    if (dist(b, h) < 20) setB(b, then, b.x, b.y);
    else setB(b, "home", h.x + ((b.id % 5) - 2) * 5, h.y + 3);
  }

  /** After dark, a canoe on the water is a shadow: seen only up close or by firelight. */
  private spot(w: World, b: Brute) {
    if (w.daylight >= 0.3 || (b.spotT ?? 0) > 1.5) return;
    for (const h of w.humans) {
      if (h.captive || h.under || h.state === "sleep" || h.state === "hide") continue;
      if (Math.abs(h.x - b.x) < 110 && Math.abs(h.y - b.y) < 110 && Math.hypot(h.x - b.x, h.y - b.y) < 110) {
        b.spotT = 2.5;
        return;
      }
    }
    for (const f of w.campfires) if (f.lit && Math.hypot(f.x - b.x, f.y - b.y) < 160) {
      b.spotT = 2.5;
      return;
    }
    for (const o of w.colony.buildings) if (o.kind === "boneTorch" && o.built >= 1 && Math.hypot(o.x - b.x, o.y - b.y) < 130) {
      b.spotT = 2.5;
      return;
    }
  }

  /* ------------------------------ bodies ------------------------------ */

  /** Standing on a stilt-house deck? */
  private onDeck(b: Brute) {
    const t = this.tribe(b.sea);
    return !!t && t.huts.some((h) => h.hp > 0 && Math.abs(b.x - h.x) < 22 && Math.abs(b.y - h.y - 3) < 14);
  }

  private act(w: World, b: Brute, dt: number) {
    const t = this.tribe(b.sea);
    const steed = this.steed(w, b);
    const deck = !steed && this.onDeck(b) && (b.state === "idle" || b.state === "sleep" || b.state === "rally");
    b.boat = !steed && !deck && waterAt(w, b.x, b.y);
    b.z = steed ? saddleOf(steed) : deck ? 10 : 0;
    const bd = b.band ? this.bands.find((x) => x.id === b.band) : null;
    switch (b.state) {
      case "idle":
      case "rally":
      case "sleep": {
        if (Math.hypot(b.tx - b.x, b.ty - b.y) > 6) this.move(w, b, dt, 0.7);
        else b.vx = b.vy = 0;
        if (b.state === "rally") b.anim += dt * 4;
        if (t && dist(b, t) < 220) b.hp = Math.min(1, b.hp + dt * (b.state === "sleep" ? 0.02 : 0.01));
        return;
      }
      case "forage": {
        // paddle out, sit with a line + net a while, bring the catch home
        if (this.move(w, b, dt, 0.8)) {
          b.vx = b.vy = 0;
          b.anim += dt * 1.5;
          b.work = (b.work ?? 0) + dt;
          if (b.work > 14 + (b.id % 9)) {
            b.work = 0;
            if (t) t.food += 0.8;
            say(b, "Fish!", 1.2);
            if (t) this.toHut(w, b, t, "idle");
          }
        }
        return;
      }
      case "walk":
      case "wander":
      case "home":
      case "flee": {
        let arrived: boolean;
        if (bd && (b.state === "walk" || b.state === "home") && bd.route.length) arrived = this.followRoute(w, b, dt, bd, b.state === "walk" ? 1 : -1, bd.mode === "raid" ? 1.15 : 1.05);
        else arrived = this.move(w, b, dt, b.state === "flee" ? 1.3 : b.state === "wander" ? 0.75 : 1);
        if (arrived) {
          if ((b.state === "home" || b.state === "flee") && t && dist(b, t) < 150) {
            if (b.loot && !bd) {
              t.food += b.loot;
              b.loot = 0;
            }
            this.toHut(w, b, t, w.daylight < 0.3 ? "sleep" : "idle");
          } else if (b.state === "home" && bd && t) setB(b, "home", t.x + (this.rng() - 0.5) * 60, t.y);
          else setB(b, "idle", b.x, b.y);
          b.think = Math.min(b.think, 0.2);
        }
        return;
      }
      case "dart": {
        if (this.move(w, b, dt, 1.5) || b.stateT > 1.2) {
          setB(b, "fight", b.x, b.y);
          b.think = 0;
        }
        return;
      }
      case "fight": {
        const f = this.foeById(w, b.targetId);
        if (!f || b.stateT > 35) {
          setB(b, "idle", b.x, b.y);
          b.think = 0;
          return;
        }
        const p = foeXY(f);
        const d = dist(b, p);
        const arms = armsOf(b);
        // on a sea dragon: it lunges from the water and bites
        if (steed && d <= 56 + sizeOf(steed) * 0.14 && b.cd <= 0) {
          b.cd = 1.7 + this.rng() * 0.4;
          b.spotT = 3;
          b.dir = p.x > b.x ? 1 : -1;
          w.particles.burst(P.Splash, (b.x + p.x) / 2, (b.y + p.y) / 2, 12, 90, { vz: 110, g: 220, size: 4, max: 0.9 });
          w.sfx(sp(steed.species).sound.kind, b.x, b.y, 0.9, sp(steed.species).sound.pitch);
          if (f.kind === "human") hurtHuman(w, f.h, 0.38, steed.x, steed.y, "bite");
          else w.rivals.hit(w, f.b, 0.45, steed.x, steed.y, true);
          if (this.rng() < 0.3) say(b, pick(this.rng, ["Bite, deep one!", "Hyah!", "From the sea!"]), 1.3);
          return;
        }
        // harpoons + sling stones from the canoe; anyone may hurl a stone as they close
        if (b.cd <= 0 && ((arms.range && d < arms.range && d > 60) || (b.boat && d > 60 && d < 170))) {
          this.throwAt(w, b, f);
          return;
        }
        if (arms.range && d < arms.range * 0.7 && d > 60) {
          b.vx = b.vy = 0;
          b.dir = p.x > b.x ? 1 : -1;
          return;
        }
        if (d <= REACH) {
          b.vx = b.vy = 0;
          b.dir = p.x > b.x ? 1 : -1;
          if (b.cd <= 0) {
            b.cd = 1 + this.rng() * 0.5;
            b.anim = 0;
            this.strike(w, b, f);
            if (b.hp > 0 && this.rng() < 0.25) {
              const a = Math.atan2(b.y - p.y, b.x - p.x) + (this.rng() - 0.5) * 1.4;
              setB(b, "dart", b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 50);
            }
          }
          return;
        }
        let gx = p.x;
        let gy = p.y;
        if (d > 50) {
          const a = Math.atan2(b.y - p.y, b.x - p.x) + (b.flank ?? 1) * 0.8;
          gx = p.x + Math.cos(a) * 22;
          gy = p.y + Math.sin(a) * 16;
        }
        b.tx = gx;
        b.ty = gy;
        this.move(w, b, dt, d < 160 ? 1.6 : 1.35);
        return;
      }
    }
    b.vx = b.vy = 0;
  }

  /** Paddle / walk along the band's route (forward to the target, backward to home). */
  private followRoute(w: World, b: Brute, dt: number, bd: SeaBand, dir: 1 | -1, mul: number) {
    const route = bd.route;
    if (b.pathI < 0 || b.pathI >= route.length) {
      // off the end: the goal itself / home
      if (dir < 0) {
        const t = this.tribe(bd.tribe);
        if (t) {
          b.tx = t.x + ((b.id % 5) - 2) * 14;
          b.ty = t.y + ((b.id % 3) - 1) * 10;
        }
      } else {
        b.tx = bd.x + ((b.id % 5) - 2) * 18;
        b.ty = bd.y + ((b.id % 3) - 1) * 14;
      }
      return this.move(w, b, dt, mul);
    }
    const p = tileXY(route[b.pathI]);
    // a line of canoes: they push off one after another, each a little to its own side
    const slot = Math.max(0, bd.ids.indexOf(b.id));
    if (dir > 0 && bd.mode === "raid" && bd.t < 5 + slot * 0.9) {
      b.vx = b.vy = 0;
      return false;
    }
    b.tx = p.x + ((slot % 3) - 1) * 10;
    b.ty = p.y + ((slot % 2) * 2 - 1) * 5;
    if (Math.hypot(b.tx - b.x, b.ty - b.y) < 14) b.pathI += dir;
    else this.move(w, b, dt, mul);
    return false;
  }

  /** Straight there, at canoe speed on water and running speed on land (round mountains + walls). */
  private move(w: World, b: Brute, dt: number, mul: number) {
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      b.vx = b.vy = 0;
      return true;
    }
    const steed = this.steed(w, b);
    const speed = (steed ? RIDE_SPEED : b.boat ? BOAT_SPEED : LAND_SPEED) * mul;
    // a sea dragon only swims: its rider hops off where a raid goes ashore, else it stays in the water
    if (steed && !waterAt(w, b.x + (dx / d) * 16, b.y + (dy / d) * 16) && b.band) {
      this.dismount(w, b);
      return false;
    }
    const ok = (x: number, y: number) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      return w.terrain.inBounds(tx, ty) && !BLOCK.has(w.terrain.tileAt(x, y)) && !w.tribe.blocks(tx, ty) && (!steed || waterAt(w, x, y));
    };
    let a = Math.atan2(dy, dx);
    if (!ok(b.x + Math.cos(a) * 14, b.y + Math.sin(a) * 14)) {
      for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
        if (ok(b.x + Math.cos(a + off) * 14, b.y + Math.sin(a + off) * 14)) {
          a += off;
          break;
        }
      }
    }
    const s = Math.min(d, speed * dt);
    const nx = b.x + Math.cos(a) * s;
    const ny = b.y + Math.sin(a) * s;
    if (ok(nx, ny) || !ok(b.x, b.y)) {
      b.vx = (nx - b.x) / Math.max(dt, 1e-4);
      b.vy = (ny - b.y) / Math.max(dt, 1e-4);
      b.x = nx;
      b.y = ny;
      b.stuckT = Math.max(0, b.stuckT - dt);
    } else {
      b.vx = b.vy = 0;
      b.stuckT += dt;
      if (b.stuckT > 3) {
        b.stuckT = 0;
        return true;
      }
    }
    if (Math.abs(Math.cos(a)) > 0.2) b.dir = Math.cos(a) > 0 ? 1 : -1;
    b.anim += dt * (speed / 12);
    return false;
  }

  private strike(w: World, b: Brute, f: Foe) {
    const arms = armsOf(b);
    let mul = w.daylight < 0.3 && !((b.spotT ?? 0) > 0) ? 1.25 : 1;
    b.spotT = 3;
    w.sfx("whoosh", b.x, b.y, 0.4, 1.1);
    if (f.kind === "human") hurtHuman(w, f.h, arms.hit * mul, b.x, b.y, b.weapon === "spear" || b.weapon === "bone" ? "bite" : "club");
    else {
      mul *= 0.9;
      w.rivals.hit(w, f.b, arms.hit * mul, b.x, b.y, true);
    }
  }

  private throwAt(w: World, b: Brute, f: Foe) {
    const arms = armsOf(b);
    const p = foeXY(f);
    b.spotT = 2;
    b.cd = (arms.range ? 2.4 : 3.4) + this.rng() * 0.8;
    b.dir = p.x > b.x ? 1 : -1;
    b.anim = 0;
    const kind = arms.range ? arms.missile : "rock";
    const d = dist(b, p);
    const flight = Math.max(0.25, d / 280);
    const tx = p.x + (this.rng() - 0.5) * 26;
    const ty = p.y + (this.rng() - 0.5) * 16;
    const sz = b.z + 22;
    const dmg = arms.range ? arms.throw : 0.12;
    w.rivals.missiles.push({ x: b.x, y: b.y, z: sz, vx: (tx - b.x) / flight, vy: (ty - b.y) / flight, vz: (12 - sz) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target: f.kind === "human" ? f.h.id : 0, dmg, kind });
    if (f.kind === "brute") w.rivals.hit(w, f.b, dmg, b.x, b.y, true);
    w.sfx("whoosh", b.x, b.y, 0.45, 0.9);
  }

  /* ------------------------------ getting hurt ------------------------------ */

  /** From Rivals.hit. */
  hit(w: World, b: Brute, dmg: number, fx: number, fy: number, byBrute = false, proj?: string) {
    b.spotT = 4;
    b.hp -= byBrute ? dmg * 0.8 : dmg / SEA_TOUGH;
    w.particles.burst(b.boat ? P.Splash : P.Star, b.x, b.y, 3, 30, { z: 20, size: 4, max: 0.5 });
    w.sfx("thunk", b.x, b.y, 0.6, 1);
    if (b.hp <= 0) return w.rivals.kill(w, b);
    if (this.rng() < 0.4) say(b, pick(this.rng, ["Agh!", "Hai!", "Ooh!", "Sharks take you!"]), 1.2);
    const t = this.tribe(b.sea);
    if (!t) return;
    if (b.hp < 0.3) {
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      return;
    }
    if (b.state === "fight" || b.state === "dart" || (b.age ?? SEA_GROWN) < SEA_GROWN || proj === "dragon" || proj === "fire") return;
    let foe: Foe | null = null;
    if (byBrute) {
      const o = w.rivals.brutes.find((x) => !x.sea && x.hp > 0 && Math.hypot(x.x - fx, x.y - fy) < 60);
      if (o) foe = { kind: "brute", b: o };
    } else {
      let bd = 320;
      for (const h of w.humans) {
        if (!fairGame(h)) continue;
        const d = Math.hypot(h.x - fx, h.y - fy);
        if (d < bd) {
          bd = d;
          foe = { kind: "human", h };
        }
      }
    }
    if (!foe) return;
    this.engage(w, b, t, foe);
    const f = foe;
    w.groups.rally(w, b, (m) => this.engage(w, m, t, f));
  }

  /** From Rivals.kill (already out of the list). */
  died(w: World, b: Brute) {
    // their sea dragon is free again (it goes home to the village waters)
    if (b.mount) {
      const d = w.dinoById(b.mount);
      if (d && d.seaRider === b.id) d.seaRider = undefined;
      b.mount = 0;
    }
    w.particles.burst(b.boat ? P.Splash : P.Poof, b.x, b.y, 10, 60, { size: 8, max: 0.9 });
    if (!b.boat) {
      w.addItem(b.weapon === "sling" ? "stone" : "stick", b.x - 8, b.y + 2);
      if (this.rng() < 0.5) w.addItem("fish", b.x + 8, b.y + 2, { amount: 1 + (b.forage ? 1 : 0) });
    }
    const l = this.index.get(b.sea ?? 0);
    if (l) {
      const i = l.indexOf(b);
      if (i >= 0) l.splice(i, 1);
    }
    if (w.humans.some((h) => !h.captive && dist(h, b) < 600) && w.elapsed - this.toastAt > 8) {
      this.toastAt = w.elapsed;
      w.toast("💀", `${this.label(b)} is down!`, b.x, b.y);
    }
  }

  /* ------------------------------ sea farms + sea dragons ------------------------------ */

  /** Fish pens + shark pens feed the village; the oyster beds grow pearls. */
  private farmsTick(t: SeaTribe, dt: number) {
    for (const h of t.huts) {
      if (h.hp <= 0) continue;
      if (h.kind === "fishPen") t.food = Math.min(30, t.food + 0.02 * dt);
      else if (h.kind === "sharkPen") {
        t.food = Math.min(30, t.food + 0.012 * dt);
        t.teeth = Math.min(20, (t.teeth ?? 0) + 0.006 * dt);
      } else if (h.kind === "pearlBed") t.pearls = Math.min(30, (t.pearls ?? 0) + 0.008 * dt);
    }
  }

  /** Slowly win over a wild sea dragon in their waters (one more for every size the village grows, up to 3). */
  private tameTick(w: World, t: SeaTribe, dt: number, adults: number) {
    const mine = w.dinos.filter((d) => d.seaTribe === t.id && d.health > 0);
    for (const d of mine) {
      d.homeX = t.x;
      d.homeY = t.y;
    }
    if (mine.length >= Math.min(3, 1 + t.tier) || !adults) return;
    const wild = w.dinos.find((d) => SEA_BEASTS.has(d.species) && !d.seaTribe && !d.owner && d.health > 0.5 && !isBaby(d) && dist(d, t) < t.r * 1.4);
    if (!wild) {
      t.taming = Math.max(0, (t.taming ?? 0) - dt * 0.2);
      return;
    }
    t.taming = (t.taming ?? 0) + dt * (0.6 + Math.min(6, adults) * 0.1);
    if (this.rng() < dt * 0.05) emote(wild, "💙", 1.6);
    if (t.taming < 200) return;
    t.taming = 0;
    this.tame(w, t, wild);
  }

  /** This sea dragon is theirs now: it stays round the village and carries their warriors. */
  tame(w: World, t: SeaTribe, d: Dino) {
    d.seaTribe = t.id;
    d.homeX = t.x;
    d.homeY = t.y;
    emote(d, "💙", 3);
    if (t.found || t.seen) w.toast("🐉", `The ${t.name} Sea People have trained a wild ${sp(d.species).name}! Their warriors ride it round their waters and into battle.`, d.x, d.y);
  }

  /** The sea dragon this one's riding (if it's still there to ride). */
  steed(w: World, b: Brute): Dino | null {
    if (!b.mount) return null;
    const d = w.dinoById(b.mount);
    if (!d || d.health <= 0 || d.seaRider !== b.id || b.snatched || b.falling) {
      if (d && d.seaRider === b.id) d.seaRider = undefined;
      b.mount = 0;
      return null;
    }
    return d;
  }

  mountUp(w: World, b: Brute, d: Dino) {
    if (d.seaRider && d.seaRider !== b.id) return false;
    b.mount = d.id;
    d.seaRider = b.id;
    b.x = d.x;
    b.y = d.y;
    b.boat = false;
    w.particles.burst(P.Splash, d.x, d.y, 10, 70, { vz: 90, g: 220, size: 3.5, max: 0.8 });
    say(b, pick(this.rng, ["Up, deep one!", "Ride!", "Hyah!"]), 1.2);
    return true;
  }

  dismount(w: World, b: Brute) {
    if (!b.mount) return;
    const d = w.dinoById(b.mount);
    if (d && d.seaRider === b.id) {
      d.seaRider = undefined;
      d.vx = d.vy = 0;
      d.think = 0;
    }
    b.mount = 0;
    b.z = 0;
  }

  /** After the rider's moved: the sea dragon moves with them. */
  private ride(w: World, b: Brute) {
    const d = this.steed(w, b);
    if (!d) return;
    d.x = b.x;
    d.y = b.y;
    d.vx = b.vx;
    d.vy = b.vy;
    if (Math.abs(b.vx) > 2) d.dir = b.dir;
  }

  /* ------------------------------ unions ------------------------------ */

  maxTier(t: SeaTribe) {
    return Math.min(MAX_SEA_TIER, 3 + (t.merges ?? 0));
  }

  /** All Sea People are friends: two villages within reach may join (always when one's down to a handful). */
  private politics(w: World) {
    if (this.tribes.length < 2) return;
    const a = this.tribes[Math.floor(this.rng() * this.tribes.length)];
    const near = this.tribes.filter((o) => o !== a && dist(o, a) < 3200);
    if (!near.length) return;
    const b = near[Math.floor(this.rng() * near.length)];
    if (this.bands.some((bd) => bd.tribe === a.id || bd.tribe === b.id)) return;
    const na = this.members(a.id).length;
    const nb = this.members(b.id).length;
    if (this.rng() < 0.4 || Math.min(na, nb) <= 3) {
      const [big, small] = na >= nb ? [a, b] : [b, a];
      this.unite(w, small, big);
    }
  }

  /** `from` paddles over to `into` with everything it has: one bigger village, its sea dragons + farms' riches. */
  unite(w: World, from: SeaTribe, into: SeaTribe) {
    if (from === into || !this.tribes.includes(from) || !this.tribes.includes(into)) return;
    const was = into.name;
    w.groups.retribe("sea", from.id, into.id);
    for (const b of this.members(from.id)) {
      this.dismount(w, b);
      b.sea = into.id;
      b.band = undefined;
      b.raid = false;
      setB(b, "home", into.x + (this.rng() - 0.5) * 80, into.y + (this.rng() - 0.5) * 50);
    }
    for (const d of w.dinos) if (d.seaTribe === from.id) {
      d.seaTribe = into.id;
      d.homeX = into.x;
      d.homeY = into.y;
    }
    const cols = into.colors?.length ? into.colors : [into.color];
    const theirs = from.colors?.length ? from.colors : [from.color];
    into.colors = cols.concat(theirs.filter((c) => !cols.includes(c)));
    const first = into.name.replace(/^Great /, "").split(" & ")[0];
    into.name = (into.merges ?? 0) + (from.merges ?? 0) === 0 ? `${first} & ${from.name.replace(/^Great /, "").split(" & ")[0]}` : `Great ${first}`;
    into.merges = (into.merges ?? 0) + (from.merges ?? 0) + 1;
    into.tier = Math.min(this.maxTier(into), Math.max(into.tier, from.tier) + 1);
    into.r = Math.max(into.r, 520 + into.tier * 70);
    into.food += from.food;
    into.pearls = (into.pearls ?? 0) + (from.pearls ?? 0);
    into.teeth = (into.teeth ?? 0) + (from.teeth ?? 0);
    into.found = into.found || from.found;
    into.seen = into.seen || from.seen;
    this.buildHuts(w, into);
    this.plantSigns(w, into);
    this.tribes.splice(this.tribes.indexOf(from), 1);
    this.bands = this.bands.filter((bd) => bd.tribe !== from.id);
    this.reindex(w);
    if (into.seen || from.seen) {
      w.toast("🐚", `The ${from.name} and ${was} Sea People have joined into one village, the ${into.name}: ${this.members(into.id).length} strong, with ${w.dinos.filter((d) => d.seaTribe === into.id).length} sea dragon${w.dinos.filter((d) => d.seaTribe === into.id).length === 1 ? "" : "s"}. Their shell village is spreading over the water!`, into.x, into.y);
      w.sfx("drums", into.x, into.y, 0.8, 1);
    }
  }

  /* ------------------------------ save ------------------------------ */

  clear(w: World) {
    for (const d of w.dinos) if (d.seaTribe) {
      d.seaTribe = undefined;
      d.seaRider = undefined;
    }
    w.rivals.brutes = w.rivals.brutes.filter((b) => !b.sea);
    this.tribes = [];
    this.bands = [];
    this.index.clear();
  }

  serialize(w: World) {
    const r = Math.round;
    return {
      started: this.started,
      ids: this.ids,
      next: this.nextTribe,
      settleT: r(this.settleT),
      uniteT: r(this.uniteT),
      tribes: this.tribes.map((t) => ({ ...t, food: Math.round(t.food * 10) / 10, growT: r(t.growT), raidT: r(t.raidT), work: Math.round(t.work * 10) / 10, huts: t.huts.map((h) => ({ ...h, hp: Math.round(h.hp * 100) / 100 })), signs: t.signs.map((s) => ({ ...s })) })),
      folk: this.folk(w).filter((b) => this.tribe(b.sea)).map((b) => ({ sea: b.sea!, name: b.name, x: r(b.x), y: r(b.y), hp: Math.round(b.hp * 100) / 100, weapon: b.weapon, age: r(b.age ?? SEA_GROWN), tint: b.tint, grp: b.grp })),
      cleared: this.cleared.filter((c) => w.elapsed - c.t < CLEARED_FOR).map((c) => ({ x: r(c.x), y: r(c.y), t: r(c.t) })),
    };
  }

  /** After Rivals.load (which wipes every brute). */
  load(w: World, d: ReturnType<SeaFolk["serialize"]> | undefined) {
    this.tribes = [];
    this.bands = [];
    this.index.clear();
    this.enabled = true;
    w.rivals.brutes = w.rivals.brutes.filter((b) => !b.sea);
    if (!d) return;
    this.started = !!d.started;
    this.ids = Math.max(5e8, d.ids ?? 5e8);
    this.nextTribe = d.next ?? 1;
    this.settleT = d.settleT ?? 700;
    this.uniteT = (d as { uniteT?: number }).uniteT ?? 200;
    this.cleared = (d.cleared ?? []).map((c) => ({ ...c }));
    for (const t of d.tribes ?? []) this.tribes.push({ ...t, huts: t.huts.map((h) => ({ ...h })), signs: t.signs.map((s) => ({ ...s })) });
    for (const f of d.folk ?? []) {
      const t = this.tribe(f.sea);
      if (!t) continue;
      const b = this.add(w, t, f.x, f.y, { name: f.name, hp: f.hp, weapon: f.weapon, age: f.age, tint: f.tint ?? t.color, grp: (f as { grp?: number }).grp });
      if (dist(b, t) < 300) this.toHut(w, b, t, "idle");
    }
    // trained sea dragons whose village is gone are wild again; nobody's riding anything after a load
    for (const dn of w.dinos) {
      dn.seaRider = undefined;
      if (dn.seaTribe && !this.tribe(dn.seaTribe)) dn.seaTribe = undefined;
    }
  }
}

