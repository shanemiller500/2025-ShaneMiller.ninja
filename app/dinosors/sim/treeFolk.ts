/* ------------------------------------------------------------------ */
/*  Tree People: a feral forest tribe living high in the canopy.        */
/*                                                                     */
/*  • They only live in deep forest + jungle. Their camps are decks,    */
/*    huts, lookouts and hanging stores up in a ring of tall trees,     */
/*    tied together with rope bridges, with spike lines + a ritual      */
/*    ground below and warning totems round the edge of their woods.    */
/*  • They're lighter than Neanderthals (easier to drop one by one)     */
/*    but fast, many, and they fight dirty: hide in the leaves, pelt    */
/*    you with rocks + spears, leap down from the branches, circle,     */
/*    dart back out of reach and come again.                            */
/*  • Ambush bands sit in the trees where our people pass; raiding      */
/*    parties go after the edge of our town, lone workers and the       */
/*    Neanderthal camps, then melt back into the forest to regroup.     */
/*  • Camps grow quickly and send out new outposts deeper in the        */
/*    woods, but never past a few tribes, and never out on the plains.  */
/*  • Cheap to run: one band check four times a second, a slow tick     */
/*    once a second, and folk nobody is near think every few seconds.   */
/*                                                                     */
/*  Every Tree Person is a Brute (kind "brute", clan 0, `tree` = their  */
/*  tribe) living in w.rivals.brutes, so our guards, Scorpions, war     */
/*  dinos, dragons, chariots + sea hunters all fight them already.      */
/*  This module owns their brains, camps, bands, growth + saving.       */
/*  Own random numbers + ids (4e8 up) so the rest of the world plays    */
/*  out the same whether or not they're about.                         */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { isBaby, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { PLANT_H, TALL } from "./plants";
import { makeRng, pick, type Rng } from "./rng";
import { hitDino } from "./tribe";
import { T, TILE, WORLD_H, WORLD_W, type Brute, type BruteWeapon, type Dino, type Human, type Resource, type TreeBand, type TreePod, type TreeSign, type TreeTribe } from "./types";
import type { World } from "./world";
import { moveBrute, say, setB } from "./rivals";

/** Our hits are divided by this (Neanderthals take 150: one of these goes down in about half the hits). */
export const TREE_TOUGH = 70;
/** Walking pace (ours is ~34, a Neanderthal's 40): they run everywhere. */
const SPEED = 50;
const REACH = 22;
/** Seconds for a youngster to grow into a warrior (they grow up fast out there). */
export const TREE_GROWN = 100;
export const MAX_TRIBES = 4;
const MAX_FOLK = 38;
/** They show up a little after the Neanderthals. */
const START_AT = 240;
/** A tree camp never settles nearer our town than this (px); it takes the deepest forest spot it can find. */
export const TREE_CAMP_MIN = 1500;
/** Biggest canopy village: a tribe grows to tier 3 by itself, each union adds one more (up to this). */
export const MAX_TREE_TIER = 5;
/** No new camp settles in a forest we cleared for this long (s). */
const CLEARED_FOR = 1500;

const TRIBE_NAMES = ["Hollow Fang", "Moss Eye", "Thorn Howl", "Red Bark", "Night Leaf", "Vine Tooth", "Ash Root", "Owl Skull", "Green Shriek", "Briar Claw"];
const FOLK_NAMES = ["Kit", "Sesk", "Vrii", "Tak", "Nuu", "Ish", "Rook", "Fenn", "Skra", "Lio", "Zee", "Ark", "Quill", "Teek", "Yaw", "Mosk", "Hiss", "Brak", "Sly", "Kree", "Vex", "Ulu", "Pip", "Rask", "Chit", "Oro", "Wisp", "Jask"];
const PAINTS = ["#d94f2a", "#ece3c6", "#58c27a", "#e2b23a", "#a070e0", "#48c4d6"];

/** Melee hit on one of ours, thrown hit, throw range (0 = they only throw a rock as an opener). */
const ARMS: Partial<Record<BruteWeapon, { hit: number; throw: number; range: number; missile: "spear" | "rock" | "sling" | "arrow" }>> = {
  spear: { hit: 0.2, throw: 0.18, range: 170, missile: "spear" },
  club: { hit: 0.23, throw: 0.12, range: 0, missile: "rock" },
  bone: { hit: 0.21, throw: 0.12, range: 0, missile: "rock" },
  sling: { hit: 0.12, throw: 0.17, range: 240, missile: "sling" },
  bow: { hit: 0.11, throw: 0.16, range: 280, missile: "arrow" },
};
const armsOf = (b: Brute) => ARMS[b.weapon] ?? ARMS.club!;

const COVER = new Set<T>([T.Forest, T.Jungle]);
const isCover = (w: World, x: number, y: number) => COVER.has(w.terrain.tileAt(x, y));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Someone of ours out in the open they'd go for: grown, on foot or riding, not hiding, not on a wall. */
export function fairGame(h: Human) {
  return !h.captive && !h.under && !h.stranger && !h.child && !h.aloft && !h.snatched && h.level === 0 && h.state !== "hide" && h.state !== "tossed" && h.state !== "down" && h.state !== "captive";
}

type Foe = { kind: "human"; h: Human } | { kind: "brute"; b: Brute } | { kind: "dino"; d: Dino };
const foeXY = (f: Foe) => (f.kind === "human" ? f.h : f.kind === "brute" ? f.b : f.d);
const foeId = (f: Foe) => foeXY(f).id;

export class Forest {
  tribes: TreeTribe[] = [];
  bands: TreeBand[] = [];
  /** forests we cleared: (x, y, when) — nobody settles there again for a while */
  cleared: { x: number; y: number; t: number }[] = [];
  started = false;
  /** off in bare test worlds; on in every real game, new or loaded */
  enabled = true;
  rng: Rng;
  private ids = 4e8;
  private nextTribe = 1;
  private settleT = 600;
  /** seconds till the tribes next talk about uniting */
  private uniteT = 150;
  private tickT = 0;
  private bandT = 0;
  private toastAt = -999;
  /** members by tribe, refreshed every tick */
  private index = new Map<number, Brute[]>();
  /** folk with someone near enough to watch (full paths + quick thinking), refreshed as they think */
  private live = new WeakSet<Brute>();

  constructor(seed = 1) {
    this.rng = makeRng((seed ^ 0x7ee5f01) >>> 0);
  }

  /* ------------------------------ lookups ------------------------------ */

  tribe(id: number | undefined) {
    return id ? this.tribes.find((t) => t.id === id) ?? null : null;
  }
  members(id: number) {
    return this.index.get(id) ?? [];
  }
  /** Everyone of the Tree People. */
  folk(w: World) {
    return w.rivals.brutes.filter((b) => !!b.tree);
  }
  /** "Kit of the Hollow Fang tree tribe" */
  label(b: Brute) {
    const t = this.tribe(b.tree);
    return t ? `${b.name} of the ${t.name} Tree People` : `${b.name} of the Tree People`;
  }
  /** The tree camp at (x, y), if any (for taps + orders). */
  campAt(x: number, y: number, r = 150) {
    let best: TreeTribe | null = null;
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
  /** Is (x, y) inside a Tree People forest? (which tribe's) */
  territoryAt(x: number, y: number) {
    return this.tribes.find((t) => Math.hypot(t.x - x, t.y - y) < t.r) ?? null;
  }
  /** How big this camp can grow by itself (unions let it go further). */
  maxTier(t: TreeTribe) {
    return Math.min(MAX_TREE_TIER, 3 + (t.merges ?? 0));
  }
  cap(t: TreeTribe) {
    return 5 + t.tier * 3;
  }
  private nextId() {
    return this.ids++;
  }
  private reindex(w: World) {
    this.index.clear();
    for (const b of w.rivals.brutes) {
      if (!b.tree) continue;
      const l = this.index.get(b.tree);
      if (l) l.push(b);
      else this.index.set(b.tree, [b]);
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
      this.prepPlants(w);
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

  /** One Tree Person's frame (called from Rivals.update, after the shared fire / dragon-claw handling). */
  step(w: World, b: Brute, dt: number) {
    if (b.spotT) b.spotT = Math.max(0, b.spotT - dt);
    b.think -= dt;
    if (b.think <= 0) this.think(w, b);
    this.act(w, b, dt);
  }

  private prepPlants(w: World) {
    if (w.plantsDirty) {
      w.plantHash.rebuild(w.plants);
      w.plantsDirty = false;
    }
  }

  /* ------------------------------ camps ------------------------------ */

  /** A spot deep in a forest: thick cover all round, tall trees to build in, far from everyone. */
  private campSite(w: World, near?: { x: number; y: number; r: number; from: TreeTribe }): { x: number; y: number } | null {
    // look all over, keep the spot furthest from our town
    const rng = this.rng;
    let best: { x: number; y: number } | null = null;
    let bestD = 0;
    for (let tries = 0; tries < 500; tries++) {
      let x: number;
      let y: number;
      if (near) {
        const a = rng() * Math.PI * 2;
        const r = 700 + rng() * (near.r - 700);
        x = near.x + Math.cos(a) * r;
        y = near.y + Math.sin(a) * r;
      } else {
        x = 200 + rng() * (WORLD_W - 400);
        y = 200 + rng() * (WORLD_H - 400);
      }
      if (x < 160 || y < 160 || x > WORLD_W - 160 || y > WORLD_H - 160) continue;
      if (!isCover(w, x, y) || !w.nav.passable("dino", x, y)) continue;
      const fromUs = Math.hypot(x - w.camp.x, y - w.camp.y);
      if (fromUs < TREE_CAMP_MIN || fromUs <= bestD) continue;
      if (Math.hypot(x - w.volcano.x, y - w.volcano.y) < 1100) continue;
      if (w.rivals.clans.some((c) => Math.hypot(c.x - x, c.y - y) < 950)) continue;
      if (w.dragons.nests.some((n) => Math.hypot(n.x - x, n.y - y) < 600)) continue;
      if (this.tribes.some((t) => Math.hypot(t.x - x, t.y - y) < 750)) continue;
      if (this.cleared.some((c) => w.elapsed - c.t < CLEARED_FOR && Math.hypot(c.x - x, c.y - y) < 900)) continue;
      // deep cover: most of the ground round about is forest
      let cover = 0;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const r = k % 2 ? 120 : 230;
        if (isCover(w, x + Math.cos(a) * r, y + Math.sin(a) * r)) cover++;
      }
      if (cover < 12) continue;
      if (this.hosts(w, x, y, 140).length < 2) continue;
      // an outpost goes deeper into the woods, never toward our town
      if (near && fromUs < Math.hypot(near.from.x - w.camp.x, near.from.y - w.camp.y) - 150) continue;
      best = { x, y };
      bestD = fromUs;
    }
    return best;
  }

  /** Tall trees round (x, y) a deck can go up in, nearest first. */
  private hosts(w: World, x: number, y: number, r: number) {
    const out: { x: number; y: number; h: number; d: number }[] = [];
    w.plantHash.each(x, y, r, (p, d2) => {
      if (!TALL.has(p.kind) || p.stump || p.burnt > 0.4 || p.size < 0.5) return;
      out.push({ x: p.x, y: p.y, h: PLANT_H[p.kind] * (0.35 + p.size * 0.65), d: Math.sqrt(d2) });
    });
    return out.sort((a, b) => a.d - b.d);
  }

  /** Put platforms up in the trees round the camp (as many as the camp's size calls for). */
  private buildPods(w: World, t: TreeTribe) {
    const want = 3 + t.tier * 2;
    const free = this.hosts(w, t.x, t.y, 150 + t.tier * 30).filter((h) => !t.pods.some((p) => Math.hypot(p.x - h.x, p.y - h.y) < 8));
    const order: TreePod["kind"][] = ["hut", "deck", "lookout", "store", "hut", "ritual", "hut", "deck", "hut", "store", "hut"];
    for (const h of free) {
      if (t.pods.length >= want) break;
      const kind = order[t.pods.length % order.length];
      t.pods.push({ x: Math.round(h.x), y: Math.round(h.y), h: Math.round(h.h * (kind === "lookout" ? 0.72 : 0.55)), kind, hp: 1 });
    }
  }

  /** Warning displays round the edge of their woods: totems, bone charms, spike lines, painted marks. */
  private plantSigns(t: TreeTribe) {
    const n = 6 + t.tier * 2;
    const kinds: TreeSign["kind"][] = ["totem", "bones", "spikes", "marks", "trophy", "spikes", "totem", "remains"];
    t.signs = [];
    const a0 = this.rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + (this.rng() - 0.5) * 0.4;
      const r = t.r * (0.78 + this.rng() * 0.18);
      t.signs.push({ x: Math.round(t.x + Math.cos(a) * r), y: Math.round(t.y + Math.sin(a) * r), kind: kinds[(i + t.id) % kinds.length], v: Math.floor(this.rng() * 4) });
    }
  }

  /** A new tribe moves into a forest. */
  settle(w: World, tier = 1, at?: { x: number; y: number }, parent?: TreeTribe): TreeTribe | null {
    this.prepPlants(w);
    const spot = at ?? this.campSite(w);
    if (!spot) return null;
    const used = new Set(this.tribes.map((t) => t.name));
    const free = TRIBE_NAMES.filter((n) => !used.has(n));
    // a paint nobody else wears (so a union shows every tribe in it)
    const worn = new Set(this.tribes.flatMap((o) => colorsOf(o)));
    const paints = PAINTS.filter((c) => !worn.has(c));
    const t: TreeTribe = {
      id: this.nextTribe++,
      name: pick(this.rng, free.length ? free : TRIBE_NAMES),
      color: parent?.color ?? pick(this.rng, paints.length ? paints : PAINTS),
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      pods: [],
      signs: [],
      r: 420 + tier * 70,
      tier,
      food: 4,
      growT: 40 + this.rng() * 30,
      raidT: 260 + this.rng() * 200,
      ambushT: 40 + this.rng() * 40,
      work: 0,
      parent: parent?.id,
    };
    this.buildPods(w, t);
    this.plantSigns(t);
    this.tribes.push(t);
    if (!parent) {
      const n = 4 + tier * 2;
      for (let i = 0; i < n; i++) this.add(w, t, t.x + (this.rng() - 0.5) * 120, t.y + (this.rng() - 0.5) * 80);
      for (let i = 0; i < 2; i++) this.add(w, t, t.x + (this.rng() - 0.5) * 60, t.y + 10, { age: this.rng() * 60 });
    }
    return t;
  }

  /**
   * The People tool: a tribe moves into the forest where you tap (snapped to the nearest spot with tall trees
   * to build in). Returns the tribe, or why it can't settle there.
   */
  placeCamp(w: World, x: number, y: number, minFromUs: number): TreeTribe | string {
    this.prepPlants(w);
    if (this.tribes.length >= MAX_TRIBES) return `There are already ${MAX_TRIBES} Tree People tribes: the forests can't hold more.`;
    let spot: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (let r = 0; r <= 200; r += 25) {
      const n = r ? Math.round((r / 25) * 6) : 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (!isCover(w, px, py) || !w.nav.passable("dino", px, py) || this.hosts(w, px, py, 150).length < 2) continue;
        if (r < bd) {
          bd = r;
          spot = { x: px, y: py };
        }
      }
      if (spot) break;
    }
    if (!spot) return isCover(w, x, y) ? "Not enough tall trees here for their huts. Try deeper in the woods." : "Tree People only live in forest or jungle. Tap in the trees.";
    if (Math.hypot(spot.x - w.camp.x, spot.y - w.camp.y) < minFromUs) return "Too close to our camp: they need their own woods further out.";
    if (this.tribes.some((t) => Math.hypot(t.x - spot!.x, t.y - spot!.y) < 600)) return "Another tree camp is right there. Try another part of the forest.";
    // they're about from now on (and the brutes' loop, which moves them, is running)
    this.enabled = true;
    this.started = true;
    w.rivals.started = true;
    const t = this.settle(w, 1, spot);
    if (!t) return "They couldn't settle there.";
    t.seen = true;
    t.found = true;
    return t;
  }

  /** One more of them. */
  private add(w: World, t: TreeTribe, x: number, y: number, o: Partial<Brute> = {}): Brute {
    const r = this.rng();
    const ranged = t.tier >= 1 ? 0.38 : 0.22;
    const weapon: BruteWeapon = r < 0.3 ? "spear" : r < 0.5 ? "club" : r < 1 - ranged ? "bone" : this.rng() < 0.5 ? "sling" : "bow";
    const used = new Set(this.members(t.id).map((b) => b.name));
    const names = FOLK_NAMES.filter((n) => !used.has(n));
    const b: Brute = {
      id: this.nextId(),
      kind: "brute",
      name: pick(this.rng, names.length ? names : FOLK_NAMES),
      clan: 0,
      tree: t.id,
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
      age: TREE_GROWN,
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
    for (const t of [...this.tribes]) {
      const fs = this.members(t.id);
      const adults = fs.filter((b) => (b.age ?? TREE_GROWN) >= TREE_GROWN);
      const home = adults.filter((b) => !b.band && dist(b, t) < t.r);
      // the forest feeds them (fruit, grubs, small game; lurkers forage too) — a stocked camp breeds fast
      const inWoods = adults.filter((b) => dist(b, t) < t.r + 100).length;
      t.food = Math.min(30, Math.max(0, t.food + (0.03 + inWoods * 0.014) * dt - fs.length * 0.006 * dt));
      for (const b of fs) if ((b.age ?? TREE_GROWN) < TREE_GROWN) b.age = Math.min(TREE_GROWN, (b.age ?? 0) + dt * (t.food > 0 ? 1 : 0.4));
      // new mouths + new warriors: much quicker than the Neanderthals
      t.growT -= dt * (t.food > 4 ? 1.35 : 1);
      if (t.growT <= 0) {
        t.growT = 42 + this.rng() * 34;
        if (t.food >= 1.5 && fs.length < this.cap(t) && total < MAX_FOLK) {
          t.food -= 1.5;
          if (this.rng() < 0.6) this.add(w, t, t.x + (this.rng() - 0.5) * 50, t.y + 8, { age: 0 });
          else {
            // someone wanders in from the deep woods to join them
            const a = this.rng() * Math.PI * 2;
            const b = this.add(w, t, t.x + Math.cos(a) * t.r * 0.8, t.y + Math.sin(a) * t.r * 0.8);
            if (!isCover(w, b.x, b.y) || !w.nav.passable("dino", b.x, b.y)) {
              b.x = t.x;
              b.y = t.y;
            }
            setB(b, "home", t.x, t.y);
          }
        }
      }
      // the camp grows: more decks + huts, a wider territory
      t.work += (0.06 + home.length * 0.02) * dt;
      if (t.work >= 70 + t.tier * 45 && t.food >= 4) {
        if (t.tier < this.maxTier(t)) {
          t.work = 0;
          t.tier++;
          t.food -= 3;
          t.r += 60;
          this.buildPods(w, t);
          this.plantSigns(t);
          if (t.found) w.toast("🌳", `The ${t.name} tree camp is growing: new huts + rope bridges up in the canopy.`, t.x, t.y);
        } else if (fs.length >= 9 && this.tribes.length < MAX_TRIBES && total < MAX_FOLK - 3) this.outpost(w, t);
        else t.work = 0;
      }
      // fire + axes: decks come down with their trees
      this.podsTick(w, t, dt);
      if (!this.tribes.includes(t)) continue;
      // nobody left: the camp stands empty (our people can pull it down; else the forest takes it back)
      if (!fs.length) {
        t.growT = Math.max(t.growT, 30);
        if (this.rng() < dt / 400 && !w.humans.some((h) => !h.captive && dist(h, t) < 900)) this.raze(w, t, "empty");
        continue;
      }
      this.discoverTick(w, t);
      // ambush bands + raids
      const calm = w.tribe.danger === "calm";
      t.ambushT -= dt;
      if (t.ambushT <= 0 && !calm) {
        t.ambushT = 30 + this.rng() * 30;
        if (!this.bands.some((bd) => bd.tribe === t.id && bd.mode === "lurk")) this.setAmbush(w, t);
      }
      t.raidT -= dt * (t.food < 3 ? 1.4 : 1) * (1 + t.tier * 0.12);
      if (t.raidT <= 0) {
        t.raidT = 300 + this.rng() * 260;
        if (!this.bands.some((bd) => bd.tribe === t.id && bd.mode === "raid")) this.startRaid(w, t);
      }
      // their best work is done in the dark: sneak into our town, empty the stores, carry people off
      if (!calm && w.elapsed > 600 && w.daylight < 0.25) {
        t.nightT = (t.nightT ?? 60 + this.rng() * 120) - dt;
        if (t.nightT <= 0) {
          t.nightT = 420 + this.rng() * 300;
          if (!this.bands.some((bd) => bd.tribe === t.id && bd.mode === "raid")) this.startNightRaid(w, t);
        }
      }
      this.captivesTick(w, t);
    }
    // a band with nobody left in it is over
    this.bands = this.bands.filter((bd) => {
      bd.ids = bd.ids.filter((id) => w.rivals.brutes.some((b) => b.id === id && b.band === bd.id));
      return bd.ids.length > 0;
    });
    // tribes unite now and then, like the Neanderthal clans: the smaller moves in with the bigger
    this.uniteT -= dt;
    if (this.uniteT <= 0) {
      this.uniteT = 110 + this.rng() * 90;
      this.politics(w);
    }
    // the forest's never empty for long: a new tribe wanders in (not into woods we just cleared)
    if (this.tribes.length < 2) {
      this.settleT -= dt;
      if (this.settleT <= 0) {
        this.settleT = 500 + this.rng() * 300;
        const t = this.settle(w, 0);
        if (t && this.tribes.length > 0) t.raidT += 200;
      }
    }
    // folk whose camp is gone: off to the map's edge, never seen again
    for (const b of this.folk(w)) {
      if (this.tribe(b.tree)) continue;
      if (b.state !== "flee") {
        const ex = b.x < WORLD_W / 2 ? 20 : WORLD_W - 20;
        setB(b, "flee", ex, b.y);
        b.hidden = false;
      }
      if (b.stateT > 70 || b.x < 40 || b.x > WORLD_W - 40) this.vanish(w, b);
    }
  }

  /** Burnt or felled trees bring their decks down; a fire in the camp guts it. */
  private podsTick(w: World, t: TreeTribe, dt: number) {
    let standing = 0;
    for (const p of t.pods) {
      if (p.hp <= 0) continue;
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      if (w.fire.at(tx, ty) > 0.3 || w.lava.heatAt(tx, ty) > 0.2) {
        p.hp = Math.max(0, p.hp - 0.3 * dt);
        if (this.rng() < 0.3) w.particles.burst(P.Smoke, p.x, p.y - p.h, 2, 20, { size: 10, max: 1.4 });
      }
      const tree = w.plantHash.nearest(p.x, p.y, 14, (q) => TALL.has(q.kind));
      if (!tree || tree.stump || tree.burnt > 0.7) p.hp = 0;
      if (p.hp <= 0) {
        w.particles.burst(P.Crumb, p.x, p.y - p.h * 0.5, 10, 70, { z: p.h * 0.6, vz: 40, g: 200, size: 3, max: 1, color: "#7a5530" });
        for (const b of this.members(t.id)) if (b.z > 4 && Math.hypot(b.x - p.x, b.y - p.y) < 20) setB(b, "idle", b.x, b.y + 6);
      } else standing++;
    }
    if (!standing && t.pods.length) this.raze(w, t, w.fire.at(Math.floor(t.x / TILE), Math.floor(t.y / TILE)) > 0.1 ? "fire" : "us");
  }

  /** Our people spot the warning signs, then find the camp itself. */
  private discoverTick(w: World, t: TreeTribe) {
    for (const h of w.humans) {
      if (h.captive || h.under) continue;
      const dc = dist(h, t);
      if (!t.seen && (t.signs.some((s) => dist(h, s) < 230) || dc < t.r * 0.8)) {
        t.seen = true;
        if (!w.flags.has("treeSigns")) {
          w.flags.add("treeSigns");
          w.toast("🪶", `${h.name} found strange markings in the forest: painted bark, bone charms, spiked totems… Something lives in there, and it's watching us.`, h.x, h.y);
        } else w.toast("🪶", `${h.name} spotted Tree People warning signs. Another tribe lives in these woods.`, h.x, h.y);
        say(h, "Someone's watching…", 2.5);
      }
      if (!t.found && (dc < 470 || (h.aloft && dc < 700))) {
        t.found = true;
        t.seen = true;
        const n = this.members(t.id).length;
        w.toast("🌳", `${h.name} found the ${t.name} tree camp: huts + rope bridges up in the canopy, about ${n} Tree People. Select armed people and tap the camp to attack it.`, t.x, t.y);
        if (!w.flags.has("treeCampTip")) {
          w.flags.add("treeCampTip");
          w.toast("🌿", "Tree People are fast and many, but each one falls quicker than a Neanderthal. Go in a big group, bring bows, or burn them out of their trees.", t.x, t.y);
        }
      }
      if (t.seen && t.found) break;
    }
  }

  /** Two tribes near enough to each other may unite: always when one is down to a handful, else now and then. */
  private politics(w: World) {
    if (this.tribes.length < 2) return;
    const a = this.tribes[Math.floor(this.rng() * this.tribes.length)];
    const near = this.tribes.filter((o) => o !== a && dist(o, a) < 3000);
    if (!near.length) return;
    const b = near[Math.floor(this.rng() * near.length)];
    // not while either has a raid out
    if (this.bands.some((bd) => (bd.tribe === a.id || bd.tribe === b.id) && bd.mode === "raid")) return;
    const na = this.members(a.id).length;
    const nb = this.members(b.id).length;
    if (this.rng() < 0.35 || Math.min(na, nb) <= 3) {
      const [big, small] = na >= nb ? [a, b] : [b, a];
      this.unite(w, small, big);
    }
  }

  /** `from` leaves its trees and moves in with `into`: one bigger tribe, more paint, a bigger canopy village. */
  unite(w: World, from: TreeTribe, into: TreeTribe) {
    if (from === into || !this.tribes.includes(from) || !this.tribes.includes(into)) return;
    const was = into.name;
    for (const b of this.members(from.id)) {
      b.tree = into.id;
      b.band = undefined;
      b.hidden = false;
      b.raid = false;
      setB(b, "home", into.x + (this.rng() - 0.5) * 80, into.y + (this.rng() - 0.5) * 40);
    }
    for (const bd of this.bands) if (bd.tribe === from.id) bd.ids = [];
    // their captives are walked over to the new camp
    for (const h of this.captivesOf(w, from)) {
      h.captive = -into.id;
      if (!w.rivals.brutes.some((b) => b.captive === h.id)) {
        h.x = into.x + 14 + (this.rng() - 0.5) * 60;
        h.y = into.y + 12;
      }
    }
    const cols = colorsOf(into);
    into.colors = cols.concat(colorsOf(from).filter((c) => !cols.includes(c)));
    // "Moss Eye & Red Bark", then the "Great Moss Eye" once more join in
    const first = into.name.replace(/^Great /, "").split(" & ")[0];
    into.name = (into.merges ?? 0) + (from.merges ?? 0) === 0 ? `${first} & ${from.name.replace(/^Great /, "").split(" & ")[0]}` : `Great ${first}`;
    into.merges = (into.merges ?? 0) + (from.merges ?? 0) + 1;
    into.tier = Math.min(this.maxTier(into), Math.max(into.tier, from.tier) + 1);
    into.r = Math.max(into.r, 420 + into.tier * 70);
    into.food += from.food;
    into.found = into.found || from.found;
    into.seen = into.seen || from.seen;
    this.buildPods(w, into);
    this.plantSigns(into);
    // the old camp is left to the forest
    this.tribes.splice(this.tribes.indexOf(from), 1);
    for (const o of this.tribes) if (o.parent === from.id) o.parent = into.id;
    this.bands = this.bands.filter((bd) => bd.ids.length);
    this.reindex(w);
    if (into.seen || from.seen) {
      w.toast("🌿", `The ${from.name} and ${was} Tree People have joined into one tribe, the ${into.name}: ${this.members(into.id).length} strong, wearing ${into.colors.length} colours of paint. Their canopy village is spreading through the trees!`, into.x, into.y);
      w.sfx("drums", into.x, into.y, 0.8, 1.2);
    }
  }

  /** A tribe this big plants a small outpost deeper in the woods. */
  private outpost(w: World, from: TreeTribe) {
    from.work = 0;
    const spot = this.campSite(w, { x: from.x, y: from.y, r: 1600, from });
    if (!spot) return;
    const t = this.settle(w, 0, spot, from);
    if (!t) return;
    const go = this.members(from.id).filter((b) => (b.age ?? TREE_GROWN) >= TREE_GROWN && !b.band && b.hp > 0.6).slice(0, 3);
    for (const b of go) {
      b.tree = t.id;
      b.hidden = false;
      setB(b, "home", t.x + (this.rng() - 0.5) * 40, t.y);
    }
    from.food = Math.max(0, from.food - 4);
    t.food = 5;
    if (from.found || from.seen) w.toast("🌲", `The ${from.name} Tree People sent a band deeper into the forest: a new outpost, the ${t.name}.`, t.x, t.y);
  }

  /** The camp's gone: decks down, signs fallen. Loot + what we learn go to whoever did it. */
  raze(w: World, t: TreeTribe, by: "us" | "fire" | "empty") {
    const i = this.tribes.indexOf(t);
    if (i < 0) return;
    this.tribes.splice(i, 1);
    this.bands = this.bands.filter((b) => b.tribe !== t.id);
    this.cleared.push({ x: t.x, y: t.y, t: w.elapsed });
    w.particles.burst(P.Dust, t.x, t.y, 18, 120, { size: 18, max: 1.6, color: "rgba(120,100,70,0.6)" });
    // survivors run to their kin (else they scatter: see slowTick)
    const kin = [...this.tribes].sort((a, b) => dist(a, t) - dist(b, t))[0];
    for (const b of this.members(t.id)) {
      b.band = undefined;
      b.hidden = false;
      b.raid = false;
      if (kin && dist(kin, t) < 2600) {
        b.tree = kin.id;
        setB(b, "flee", kin.x + (this.rng() - 0.5) * 60, kin.y);
      }
    }
    this.index.delete(t.id);
    // the people they held walk free (or go with the survivors to their kin's trees)
    for (const h of this.captivesOf(w, t)) {
      if (w.rivals.brutes.some((b) => b.captive === h.id)) continue;
      w.rivals.free(w, h, `${h.name} is free: the ${t.name} tree camp is gone!`);
    }
    if (by === "empty") return;
    const ours = by === "us" || w.humans.some((h) => !h.captive && dist(h, t) < 600);
    if (!ours) {
      if (t.found) w.toast("🔥", `The ${t.name} tree camp burnt down.`, t.x, t.y);
      return;
    }
    // what they'd hoarded up there + what we take off the decks
    const s = w.camp.stock;
    const loot: Partial<Record<Resource, number>> = {
      wood: 6 + t.tier * 4,
      hide: 2 + t.tier,
      bone: 3 + t.tier * 2,
      tooth: 1 + t.tier,
      flint: 2 + t.tier,
      leaves: 6,
      berries: Math.floor(t.food),
    };
    if (t.tier >= 2) loot.obsidian = 1 + (t.tier - 2);
    if (t.tier >= 3) loot.crystal = 1;
    for (const [r, n] of Object.entries(loot) as [Resource, number][]) if (n > 0) s[r] = (s[r] ?? 0) + n;
    // their weapons: bone spears + short bows for our armory
    const arm = w.colony.armory;
    arm.spearB = (arm.spearB ?? 0) + 1 + t.tier;
    if (t.tier >= 1) arm.bow1 = (arm.bow1 ?? 0) + 1;
    const list = Object.entries(loot).filter(([, n]) => (n ?? 0) > 0).map(([r, n]) => `${n} ${r}`).join(", ");
    w.toast("🔥", `We tore down the ${t.name} tree camp! Took ${list}, plus ${1 + t.tier} bone spear${t.tier ? "s" : ""}${t.tier >= 1 ? " and a short bow" : ""}.`, t.x, t.y);
    // their trail marks tell us where the rest of them are
    const others = this.tribes.filter((o) => !o.found);
    for (const o of others) {
      o.seen = true;
      o.found = true;
    }
    if (others.length) w.toast("🗺️", `Their trail marks point the way to ${others.length === 1 ? `the ${others[0].name} camp` : `${others.length} more tree camps`}. Now marked for you.`, others[0].x, others[0].y);
    else if (this.tribes.length) w.toast("🗺️", "Their trail marks match the other tree camps we already know about.", t.x, t.y);
    w.celebrate("Forest cleared!");
    w.sfx("cheer", t.x, t.y, 0.9);
  }

  /** Our people pull one deck down (the raid task calls this while they work on it). */
  wreck(w: World, t: TreeTribe, p: TreePod, amount: number) {
    if (p.hp <= 0) return;
    p.hp = Math.max(0, p.hp - amount);
    w.particles.burst(P.Crumb, p.x, p.y - p.h * 0.6, 4, 50, { z: p.h * 0.5, vz: 30, g: 200, size: 2.5, max: 0.8, color: "#8a6238" });
    w.sfx("thud", p.x, p.y, 0.5, 0.9);
    if (p.hp <= 0) {
      w.particles.burst(P.Dust, p.x, p.y, 10, 70, { size: 14, max: 1.2, color: "rgba(120,100,70,0.6)" });
      w.shake(2, 0.3);
      if (!t.pods.some((o) => o.hp > 0)) this.raze(w, t, "us");
    }
  }

  /* ------------------------------ ambushes ------------------------------ */

  /** Where a band hides: thick cover toward where our people come from, with a tree to climb if there is one. */
  private ambushSpot(w: World, t: TreeTribe) {
    const toward = Math.atan2(w.camp.y - t.y, w.camp.x - t.x);
    for (let k = 0; k < 40; k++) {
      const a = (k < 24 ? toward : this.rng() * Math.PI * 2) + (this.rng() - 0.5) * 1.8;
      const r = t.r * (0.45 + this.rng() * 0.5);
      const x = t.x + Math.cos(a) * r;
      const y = t.y + Math.sin(a) * r;
      if (!isCover(w, x, y) || !w.nav.passable("dino", x, y)) continue;
      // best of all: tall trees to hide up in (else they crouch in the brush)
      if (k < 30 && this.hosts(w, x, y, 90).length < 2) continue;
      return { x, y };
    }
    return null;
  }

  private setAmbush(w: World, t: TreeTribe) {
    const free = this.members(t.id).filter((b) => (b.age ?? TREE_GROWN) >= TREE_GROWN && !b.band && b.hp > 0.6 && b.state !== "flee");
    if (free.length < 3) return;
    const spot = this.ambushSpot(w, t);
    if (!spot) return;
    const n = Math.min(free.length - 1, 3 + t.tier + (this.rng() < 0.4 ? 1 : 0));
    if (n < 3) return;
    // mostly rushers: at most one archer / slinger in three
    const near = free.sort((a, b) => dist(a, spot) - dist(b, spot));
    const shooters = near.filter((b) => armsOf(b).range > 0).slice(0, Math.floor(n / 3));
    const party = [...near.filter((b) => !armsOf(b).range).slice(0, n - shooters.length), ...shooters];
    // short of rushers: make the numbers up with more shooters
    for (const b of near) if (party.length < n && !party.includes(b)) party.push(b);
    const bd: TreeBand = { id: this.nextId(), tribe: t.id, mode: "lurk", x: spot.x, y: spot.y, ids: party.map((b) => b.id), t: 0, size: party.length };
    this.bands.push(bd);
    const trees = this.hosts(w, spot.x, spot.y, 110);
    party.forEach((b, i) => {
      b.band = bd.id;
      const tree = trees[i];
      if (tree && this.rng() < 0.8) {
        b.up = Math.round(tree.h * 0.5);
        setB(b, "climb", tree.x + (this.rng() - 0.5) * 6, tree.y + 1);
      } else {
        const a = (i / party.length) * Math.PI * 2;
        b.up = 0;
        setB(b, "walk", spot.x + Math.cos(a) * 50, spot.y + Math.sin(a) * 34);
      }
    });
  }

  /** Four times a second: lurking bands watch the paths; fighting bands decide whether to break. */
  private bandsTick(w: World) {
    const calm = w.tribe.danger === "calm";
    for (const bd of this.bands) {
      bd.t += 0.25;
      const t = this.tribe(bd.tribe);
      const party = bd.ids.map((id) => w.rivals.byId(id)).filter((b): b is Brute => !!b && b.band === bd.id);
      if (!t || !party.length) {
        bd.ids = [];
        continue;
      }
      if (bd.mode === "lurk") {
        // somebody walks into it: anyone of ours out in the open, or a Neanderthal passing through
        const foe = calm ? this.bruteNear(w, bd.x, bd.y, 210) : this.humanNear(w, bd.x, bd.y, 210, true) ?? this.bruteNear(w, bd.x, bd.y, 210);
        if (foe) {
          this.spring(w, t, bd, party, foe);
          continue;
        }
        if (bd.t > 240) this.sendHome(bd, party, t);
        continue;
      }
      if (bd.mode === "strike") {
        const alive = party.filter((b) => b.hp > 0.25 && b.state !== "flee");
        const c = centroid(alive.length ? alive : party);
        const ours = this.armedNear(w, c.x, c.y, 260);
        // broken: too many down, or badly outnumbered once the surprise wears off
        if (alive.length <= bd.size * 0.4 || (bd.t > 6 && ours > alive.length * 1.6 + 1)) {
          this.sendHome(bd, party, t, true);
          continue;
        }
        if (!this.anyFoe(w, c.x, c.y, 320) || bd.t > 60) this.sendHome(bd, party, t);
        continue;
      }
      if (bd.mode === "raid") this.raidTick(w, t, bd, party);
      if (bd.mode === "home" && (party.every((b) => dist(b, t) < 120) || bd.t > 90)) {
        for (const b of party) {
          b.band = undefined;
          b.raid = false;
          if (b.loot) {
            t.food += b.loot * 0.8;
            b.loot = 0;
          }
          if (b.forage) {
            t.food += b.forage;
            b.forage = 0;
          }
        }
        bd.ids = [];
      }
    }
    this.bands = this.bands.filter((b) => b.ids.length > 0);
  }

  /** Spring it: rocks + spears from the leaves first, then they drop down and rush in from both sides. */
  private spring(w: World, t: TreeTribe, bd: TreeBand, party: Brute[], foe: Foe) {
    bd.mode = "strike";
    bd.t = 0;
    const f = foeXY(foe);
    for (const b of party) {
      b.hidden = false;
      b.targetId = foeId(foe);
      b.cd = 0.5 + this.rng() * 0.6;
      // opening volley from wherever they're hiding
      if (dist(b, f) < 260 && this.rng() < 0.85) this.throwAt(w, b, foe);
      b.think = 0.5 + this.rng() * 0.4;
      if (b.z > 4 && dist(b, f) < 90) setB(b, "drop", f.x, f.y);
      else setB(b, "fight", f.x, f.y);
      if (this.rng() < 0.5) say(b, pick(this.rng, ["Yiii-yi-yi!", "HAAAH!", "Now! NOW!", "Krrrk!", "Ooo-ooo!"]), 1.6);
    }
    w.sfx("whoosh", f.x, f.y, 0.9, 1.3);
    w.alarm(f.x, f.y, 320, 0.7, "😱", false);
    if (foe.kind === "human" && w.elapsed - this.toastAt > 35) {
      this.toastAt = w.elapsed;
      w.toast("🌿", `Ambush! ${party.length} Tree People leapt out of the trees at ${foe.h.name}!`, f.x, f.y);
      if (!w.flags.has("treeAmbushTip")) {
        w.flags.add("treeAmbushTip");
        w.toast("🛡️", "Tree People hide up in the leaves where we walk. Send armed groups through their forests, never one worker alone.", f.x, f.y);
      }
    } else if (foe.kind === "brute" && t.found && w.elapsed - this.toastAt > 60) {
      this.toastAt = w.elapsed;
      w.toast("🌿", `The ${t.name} Tree People ambushed a Neanderthal in their forest!`, f.x, f.y);
    }
  }

  private sendHome(bd: TreeBand, party: Brute[], t: TreeTribe, broken = false) {
    bd.mode = "home";
    bd.t = 0;
    for (const b of party) {
      b.hidden = false;
      b.raid = false;
      if (b.state === "climb" || b.state === "perch" || b.state === "lurk" || b.state === "fight" || b.state === "dart" || b.state === "walk" || b.state === "rally" || b.state === "idle" || b.state === "hunt") {
        setB(b, broken ? "flee" : "home", t.x + (this.rng() - 0.5) * 80, t.y + (this.rng() - 0.5) * 40);
      }
      if (broken && this.rng() < 0.4) say(b, pick(this.rng, ["Back! Back!", "To the trees!", "Hssst!"]), 1.4);
    }
    // they'll try again soon
    t.ambushT = Math.min(t.ambushT, broken ? 70 + this.rng() * 50 : 25 + this.rng() * 30);
  }

  /* ------------------------------ raids ------------------------------ */

  /** A raiding party: the edge of our town, a lone worker, or a Neanderthal camp. */
  startRaid(w: World, t: TreeTribe): boolean {
    const free = this.members(t.id).filter((b) => (b.age ?? TREE_GROWN) >= TREE_GROWN && !b.band && b.hp > 0.6 && b.state !== "flee");
    if (free.length < 4) return false;
    const goals: NonNullable<TreeBand["goal"]>[] = [];
    const spots: { x: number; y: number }[] = [];
    const calm = w.tribe.danger === "calm";
    if (!calm && w.elapsed > 700) {
      // the part of our town nearest their forest
      let best: { x: number; y: number } | null = null;
      let bd = 2600;
      const consider = (x: number, y: number) => {
        const d = Math.hypot(x - t.x, y - t.y);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      };
      for (const s of w.shelters) consider(s.x, s.y);
      for (const b of w.colony.buildings) consider(b.x, b.y);
      for (const f of w.campfires) consider(f.x, f.y);
      consider(w.camp.pileX, w.camp.pileY);
      if (best) {
        goals.push({ kind: "town", id: 0 });
        spots.push(best);
      }
      // someone out working on their own near the woods
      const lone = w.humans.filter((h) => fairGame(h) && dist(h, t) < 1500 && Math.hypot(h.x - w.camp.x, h.y - w.camp.y) > 700 && !w.humans.some((o) => o !== h && !o.child && dist(o, h) < 150));
      if (lone.length) {
        const h = lone.sort((a, b) => dist(a, t) - dist(b, t))[0];
        goals.push({ kind: "human", id: h.id });
        spots.push({ x: h.x, y: h.y });
      }
    }
    const clan = w.rivals.clans.filter((c) => dist(c, t) < 2600).sort((a, b) => dist(a, t) - dist(b, t))[0];
    if (clan) {
      goals.push({ kind: "clan", id: clan.id });
      spots.push({ x: clan.x, y: clan.y });
    }
    if (!goals.length) return false;
    const k = Math.floor(this.rng() * goals.length);
    const n = Math.min(free.length - 1, 3 + t.tier * 2, 9 + (t.merges ?? 0) * 2);
    if (n < 3) return false;
    const party = free.sort((a, b) => dist(a, t) - dist(b, t)).slice(0, n);
    const bd: TreeBand = { id: this.nextId(), tribe: t.id, mode: "raid", x: spots[k].x, y: spots[k].y, ids: party.map((b) => b.id), t: 0, size: party.length, goal: goals[k] };
    this.bands.push(bd);
    for (const b of party) {
      b.band = bd.id;
      b.hidden = false;
      b.raid = goals[k].kind === "town";
      setB(b, "rally", t.x + (this.rng() - 0.5) * 70, t.y + 20 + (this.rng() - 0.5) * 30);
    }
    if (t.found) w.sfx("drums", t.x, t.y, 0.8, 1.4);
    return true;
  }

  private raidTick(w: World, t: TreeTribe, bd: TreeBand, party: Brute[]) {
    const g = bd.goal!;
    if (g.kind === "night") {
      // home before first light, or once they've got what they came for (carriers are already on their way)
      const busy = party.filter((b) => !b.loot && !b.captive && b.state !== "carry");
      const spotted = party.filter((b) => (b.spotT ?? 0) > 0 && b.state !== "carry");
      const ours = spotted.length ? this.armedNear(w, centroid(spotted).x, centroid(spotted).y, 220) : 0;
      if (w.daylight > 0.35 || bd.t > 220 || !busy.length || (ours > 0 && ours > party.length * 1.3)) return this.sendHome(bd, party, t, ours > party.length);
      return;
    }
    // a raid on one person follows them
    if (g.kind === "human") {
      const h = w.humans.find((o) => o.id === g.id);
      if (!h || !fairGame(h) || Math.hypot(h.x - w.camp.x, h.y - w.camp.y) < 600) return this.sendHome(bd, party, t);
      bd.x = h.x;
      bd.y = h.y;
    }
    if (g.kind === "clan" && !w.rivals.clan(g.id)) return this.sendHome(bd, party, t);
    if (bd.t < 6) return; // whooping + stamping at the camp
    if (bd.t < 6.3) {
      for (const b of party) {
        b.think = 0;
        if (this.rng() < 0.4) say(b, pick(this.rng, ["Ai-ai-ai!", "Run! Run!", "Hoo-hoo-HAA!"]), 1.4);
      }
    }
    const alive = party.filter((b) => b.hp > 0.25 && b.state !== "flee");
    const c = centroid(alive.length ? alive : party);
    // they come in fast + leave fast: too many down, outnumbered, or loaded with loot
    const ours = this.armedNear(w, c.x, c.y, 300);
    const looted = party.filter((b) => b.loot || b.forage).length;
    if (alive.length <= bd.size * 0.45 || (dist(c, bd) < 400 && ours > alive.length * 1.4 + 1) || looted >= Math.ceil(party.length * 0.5) || bd.t > 150) {
      const broken = alive.length <= bd.size * 0.45 || ours > alive.length;
      if (g.kind === "town" && !broken && looted) w.toast("🌿", `The Tree People are running back to the forest with our food!`, c.x, c.y);
      return this.sendHome(bd, party, t, broken);
    }
    if (g.kind === "town" && !bd.volley && dist(c, bd) < 950) {
      bd.volley = true;
      w.alarm(bd.x, bd.y, 600, 0.6, "❗", false);
      if (w.elapsed - this.toastAt > 20) {
        this.toastAt = w.elapsed;
        w.toast("🌿", `War whoops from the trees: ${party.length} Tree People${t.found ? ` of the ${t.name}` : ""} are raiding the edge of our town!`, c.x, c.y);
      }
    }
  }

  /* ------------------------------ by night ------------------------------ */

  /** A few slip out of the trees after dark: half to empty our stores, half to carry people off. */
  startNightRaid(w: World, t: TreeTribe): boolean {
    const free = this.members(t.id).filter((b) => (b.age ?? TREE_GROWN) >= TREE_GROWN && !b.band && b.hp > 0.6 && b.state !== "flee");
    if (free.length < 3 || Math.hypot(w.camp.pileX - t.x, w.camp.pileY - t.y) > 3600) return false;
    const n = Math.min(free.length - 1, 3 + t.tier, 7);
    if (n < 2) return false;
    const party = free.sort((a, b) => dist(a, t) - dist(b, t)).slice(0, n);
    // no war whoops tonight: straight out (bd.t starts past the rally)
    const bd: TreeBand = { id: this.nextId(), tribe: t.id, mode: "raid", x: w.camp.pileX, y: w.camp.pileY, ids: party.map((b) => b.id), t: 6.5, size: party.length, goal: { kind: "night", id: 0 } };
    this.bands.push(bd);
    party.forEach((b, i) => {
      b.band = bd.id;
      b.hidden = false;
      b.raid = false;
      b.job = i % 2 ? "thief" : "snatch";
      b.think = this.rng();
      setB(b, "walk", bd.x + (this.rng() - 0.5) * 200, bd.y + (this.rng() - 0.5) * 140);
    });
    return true;
  }

  /** One night raider's mind: creep in, do the job, slip away; fight only if they're seen. */
  private nightThink(w: World, b: Brute, t: TreeTribe, bd: TreeBand) {
    if (b.state === "carry") return;
    if (b.loot) {
      if (b.state !== "home" && b.state !== "flee") setB(b, "home", t.x, t.y);
      return;
    }
    // seen: deal with whoever saw them (or run if it's hopeless)
    if ((b.spotT ?? 0) > 0) {
      if ((b.state === "fight" || b.state === "hunt") && this.keepFighting(w, b, t, bd)) return;
      const foe = this.foeNear(w, b, 90, true);
      if (foe) return this.engage(w, b, t, foe);
    }
    if (b.job === "snatch") {
      const h = this.sleeperNear(w, b, bd);
      if (h) {
        if (Math.hypot(h.x - b.x, h.y - b.y) < 22) {
          if (h.state === "sleep" || h.state === "down" || h.hp < 0.35) this.snatch(w, b, h, t);
          else {
            // awake: knock them down first
            b.targetId = h.id;
            setB(b, "fight", h.x, h.y);
          }
        } else if (b.state !== "walk" || Math.hypot(b.tx - h.x, b.ty - h.y) > 20) setB(b, "walk", h.x, h.y);
        return;
      }
      b.job = "thief"; // nobody to take: help empty the stores
    }
    // the thieves: the stockpile, then away
    if (Math.hypot(b.x - bd.x, b.y - bd.y) < 40) {
      const got = takeAnything(w, 3, this.rng);
      if (got) {
        b.loot = got.n;
        b.lootKind = got.r;
        setB(b, "home", t.x, t.y);
        if (w.elapsed - this.toastAt > 25) {
          this.toastAt = w.elapsed;
          w.toast("🌙", `Something is creeping round the stores in the dark… Tree People are stealing our ${got.r}!`, b.x, b.y);
        }
        return;
      }
      b.job = "snatch";
      return;
    }
    if (b.state !== "walk" || Math.hypot(b.tx - bd.x, b.ty - bd.y) > 30) setB(b, "walk", bd.x + (this.rng() - 0.5) * 30, bd.y + (this.rng() - 0.5) * 20);
  }

  /** Someone to carry off: asleep, hurt or out on their own in the dark — never anyone behind our walls. */
  private sleeperNear(w: World, b: Brute, bd: TreeBand): Human | null {
    let best: Human | null = null;
    let bdist = Infinity;
    for (const h of w.humans) {
      if (h.captive || h.under || h.aloft || h.stranger || h.riding || h.chariot || h.child || h.level !== 0 || h.state === "hide" || h.state === "tossed") continue;
      if (Math.hypot(h.x - bd.x, h.y - bd.y) > 900) continue;
      if (w.tribe.walls.length && w.tribe.walledIn(w, h.x, h.y)) continue;
      if (w.rivals.brutes.some((o) => o.captive === h.id || (o !== b && o.tree && o.job === "snatch" && o.band && o.targetId === h.id))) continue;
      // sleepers first, then the hurt, then anyone alone
      const d = Math.hypot(h.x - b.x, h.y - b.y) - (h.state === "sleep" ? 300 : h.state === "down" ? 200 : 0);
      if (d < bdist) {
        bdist = d;
        best = h;
      }
    }
    if (best) b.targetId = best.id;
    return best;
  }

  /** Take one of ours: over the shoulder and off to the trees. */
  snatch(w: World, b: Brute, h: Human, t: TreeTribe) {
    if (h.riding) return;
    for (const task of w.tasks.list) task.people = task.people.filter((id) => id !== h.id);
    h.captive = -t.id;
    h.state = "captive";
    h.stateT = 0;
    h.path = null;
    h.pathKey = 0;
    h.task = null;
    h.carry = null;
    h.carryN = 0;
    h.order = null;
    h.taskId = 0;
    h.level = 0;
    h.vx = h.vy = 0;
    b.captive = h.id;
    b.spotT = 3;
    setB(b, "carry", t.x + (this.rng() - 0.5) * 40, t.y + 20);
    say(h, "HELP!!", 2.5);
    w.sfx("yelp", h.x, h.y, 1);
    w.alarm(h.x, h.y, 260, 0.7, "😱", false);
    w.toast("😱", `${h.name} was snatched ${w.daylight < 0.3 ? "in the night " : ""}by the Tree People! They're carrying ${h.name} off to their camp in the trees. Stop them!`, h.x, h.y);
  }

  /** Once a second: the people they hold sit tied at the foot of the camp trees; reach one unguarded to free them. */
  private captivesTick(w: World, t: TreeTribe) {
    for (const h of w.humans) {
      if (h.captive !== -t.id || w.rivals.brutes.some((b) => b.captive === h.id)) continue;
      h.z = 0;
      h.state = "captive";
      const guarded = this.members(t.id).some((b) => (b.age ?? TREE_GROWN) >= TREE_GROWN && b.hp > 0.2 && dist(b, h) < 170);
      const friend = w.humans.some((o) => o !== h && !o.captive && !o.child && !o.stranger && o.state !== "down" && dist(o, h) < 60);
      if (friend && !guarded) w.rivals.free(w, h, `${h.name} was rescued from the ${t.name} tree camp!`);
    }
  }

  /** Everyone they hold. */
  captivesOf(w: World, t: TreeTribe) {
    return w.humans.filter((h) => h.captive === -t.id);
  }

  /** After dark: seen only up close, near firelight, or once they've struck. */
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

  /* ------------------------------ brains ------------------------------ */

  /** Anyone of ours or anything near enough to bother thinking hard about? */
  private awake(w: World, b: Brute) {
    const v = w.view;
    if (b.x > v.x0 - 250 && b.x < v.x1 + 250 && b.y > v.y0 - 250 && b.y < v.y1 + 250) return true;
    if (b.band || b.state === "fight" || b.state === "hunt" || b.state === "flee") return true;
    for (const h of w.humans) if (Math.abs(h.x - b.x) < 900 && Math.abs(h.y - b.y) < 900) return true;
    return false;
  }

  private think(w: World, b: Brute) {
    const t = this.tribe(b.tree);
    const active = this.awake(w, b);
    if (active) this.live.add(b);
    else this.live.delete(b);
    if (active) this.spot(w, b);
    b.think = active ? 0.35 + this.rng() * 0.3 : 2 + this.rng() * 1.5;
    if (!t) return; // camp gone: slowTick walks them off
    // mid-leap, mid-climb, or carrying one of ours home: nothing else matters
    if (b.state === "drop" || b.state === "climb" || b.state === "dart" || b.state === "carry") return;
    // youngsters stay up on the decks
    if ((b.age ?? TREE_GROWN) < TREE_GROWN) {
      if (b.state !== "perch" && b.state !== "sleep") this.goUp(w, b, t);
      return;
    }
    if (b.hp < 0.3 && b.state !== "flee") {
      b.hidden = false;
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      say(b, pick(this.rng, ["Yeee!", "Hss!", "Away!"]), 1.2);
      return;
    }
    if (b.state === "flee") return;
    const bd = b.band ? this.bands.find((x) => x.id === b.band) : null;
    if (b.band && !bd) b.band = undefined;
    if (bd) return this.bandThink(w, b, t, bd);
    // already in a scrap: keep at it (fightThink re-checks the target)
    if (b.state === "fight" || b.state === "hunt") {
      if (this.keepFighting(w, b, t)) return;
    }
    // intruders in the heart of their forest: everyone near piles in
    const inner = dist(b, t) < t.r;
    if (inner) {
      const foe = this.intruder(w, t, b);
      if (foe) return this.engage(w, b, t, foe);
    }
    // night: up in the huts to sleep
    if (w.daylight < 0.3) {
      if (b.state !== "sleep") {
        if (b.state === "perch" && dist(b, t) < 200) setB(b, "sleep", b.x, b.y);
        else this.goUp(w, b, t);
      }
      return;
    }
    if (b.state === "sleep") setB(b, "perch", b.x, b.y);
    // a lean camp goes hunting in a pack
    if (t.food < 3 + this.members(t.id).length * 0.3 && this.rng() < 0.25 && this.huntPack(w, b, t)) return;
    // everyday: sit up on the decks, keep watch from a tree out in the woods, prowl about
    const busy = ((b.state === "perch" || b.state === "lurk") && b.stateT < 25) || (b.state === "idle" && b.stateT < 8);
    if (busy || ((b.state === "walk" || b.state === "wander" || b.state === "home") && b.stateT < 40)) return;
    b.stateT = 0;
    const r = this.rng();
    if (r < 0.4) this.goUp(w, b, t);
    else if (r < 0.75) {
      const spot = this.coverSpot(w, t, t.r * 0.9);
      if (spot) setB(b, "wander", spot.x, spot.y);
    } else if (r < 0.9) {
      // keep watch from a tree out in the woods (hidden)
      const spot = this.coverSpot(w, t, t.r * 0.8);
      const tree = spot ? this.hosts(w, spot.x, spot.y, 80)[0] : null;
      if (tree) {
        b.up = Math.round(tree.h * 0.5);
        setB(b, "climb", tree.x, tree.y + 1);
      }
    } else setB(b, "idle", t.x + (this.rng() - 0.5) * 70, t.y + 30 + this.rng() * 20);
    if (this.rng() < 0.04) say(b, pick(this.rng, ["Kek-kek.", "Hoo?", "*whistle*", "Tsst.", "Mrrr."]), 1.4);
  }

  private bandThink(w: World, b: Brute, t: TreeTribe, bd: TreeBand) {
    if (bd.mode === "lurk") {
      // get into hiding, then stay still
      if (b.state === "perch" || b.state === "lurk" || b.state === "climb" || b.state === "walk") {
        if (b.state === "perch" || b.state === "lurk") b.hidden = true;
        return;
      }
      setB(b, "walk", bd.x + (this.rng() - 0.5) * 80, bd.y + (this.rng() - 0.5) * 50);
      return;
    }
    if (bd.mode === "home") {
      if (b.state !== "home" && b.state !== "flee" && b.state !== "carry") setB(b, "home", t.x + (this.rng() - 0.5) * 80, t.y);
      return;
    }
    if (bd.mode === "strike") {
      if ((b.state === "fight" || b.state === "hunt") && this.keepFighting(w, b, t, bd)) return;
      const foe = this.foeNear(w, b, 340, true) ?? this.foeNearAt(w, bd.x, bd.y, 340);
      if (foe) return this.engage(w, b, t, foe);
      return;
    }
    if (bd.goal?.kind === "night") return this.nightThink(w, b, t, bd);
    // a raid: rally, run there, fight whoever's about, grab what they can, run home
    if (bd.t < 6) {
      if (b.state !== "rally") setB(b, "rally", b.x, b.y);
      return;
    }
    if (b.loot || b.forage) {
      if (b.state !== "home" && b.state !== "flee") setB(b, "home", t.x, t.y);
      return;
    }
    const g = bd.goal!;
    const near = dist(b, bd) < 380;
    if ((b.state === "fight" || b.state === "hunt") && this.keepFighting(w, b, t, bd)) return;
    const foe = near || dist(b, bd) < 700 ? this.foeNear(w, b, near ? 300 : 200, g.kind !== "clan") : null;
    if (foe) return this.engage(w, b, t, foe);
    if (near && dist(b, bd) < 110) {
      if (g.kind === "town") {
        // snatch food off our stores and run
        const got = takeFood(w, 2);
        if (got) {
          b.loot = got.n;
          b.lootKind = got.r;
          say(b, pick(this.rng, ["Mine!", "Hee-hee!", "Food!"]), 1.4);
          setB(b, "home", t.x, t.y);
          return;
        }
      } else if (g.kind === "clan") {
        const c = w.rivals.clan(g.id);
        if (c && c.food >= 1) {
          const n = Math.min(2, Math.floor(c.food));
          c.food -= n;
          b.forage = n;
          b.forageKind = "meat";
          say(b, "Hee-hee!", 1.3);
          setB(b, "home", t.x, t.y);
          return;
        }
      }
    }
    // make for it, spread out a little
    if (b.state !== "walk" || Math.hypot(b.tx - bd.x, b.ty - bd.y) > 90) {
      const a = (b.id % 7) / 7 * Math.PI * 2;
      setB(b, "walk", bd.x + Math.cos(a) * 50, bd.y + Math.sin(a) * 34);
    }
  }

  /** Still worth fighting? (target there, not too far out of their woods, not hopeless) */
  private keepFighting(w: World, b: Brute, t: TreeTribe, bd?: TreeBand) {
    const f = this.foeById(w, b.targetId);
    if (!f) return false;
    const p = foeXY(f);
    const leash = bd?.mode === "raid" ? 900 : t.r + 260;
    if (dist(p, bd ?? t) > leash || b.stateT > 30) return false;
    // badly outnumbered on our own: slip away back into the trees
    if (f.kind === "human" && this.rng() < 0.25) {
      const mine = this.members(t.id).filter((o) => o.hp > 0.3 && o.state !== "flee" && dist(o, b) < 240).length;
      if (this.armedNear(w, b.x, b.y, 220) > mine * 1.6 + 1) {
        b.hidden = false;
        setB(b, "flee", t.x + (this.rng() - 0.5) * 80, t.y);
        if (this.rng() < 0.5) say(b, "Hsss!", 1);
        return true;
      }
    }
    return true;
  }

  /** Go for it: rocks/arrows from range, a leap from the branches, or straight in. */
  private engage(w: World, b: Brute, t: TreeTribe, foe: Foe) {
    const p = foeXY(foe);
    b.targetId = foeId(foe);
    b.hidden = false;
    if (b.z > 4 && dist(b, p) < 90) setB(b, "drop", p.x, p.y);
    else setB(b, foe.kind === "dino" ? "hunt" : "fight", p.x, p.y);
    // call the others close by
    for (const o of this.members(t.id)) {
      if (o === b || o.band || (o.age ?? TREE_GROWN) < TREE_GROWN || o.hp < 0.35 || o.state === "fight" || o.state === "hunt" || o.state === "flee" || o.state === "drop") continue;
      if (dist(o, b) > 260) continue;
      o.targetId = b.targetId;
      o.hidden = false;
      o.think = 0.4 + this.rng() * 0.5;
      if (o.z > 4 && dist(o, p) < 90) setB(o, "drop", p.x, p.y);
      else setB(o, foe.kind === "dino" ? "hunt" : "fight", p.x, p.y);
    }
  }

  /** Something in their woods that shouldn't be: our people (not when the world's calm), Neanderthals, predators. */
  private intruder(w: World, t: TreeTribe, b: Brute): Foe | null {
    const core = dist(b, t) < t.r * 0.6;
    const r = core ? 300 : 170;
    const calm = w.tribe.danger === "calm";
    let best: Foe | null = null;
    let bd = r;
    if (!calm) {
      for (const h of w.humans) {
        if (!fairGame(h)) continue;
        const d = dist(h, b);
        if (d < bd && dist(h, t) < t.r) {
          bd = d;
          best = { kind: "human", h };
        }
      }
    }
    for (const o of w.rivals.brutes) {
      if (o.tree || o.hp <= 0 || o.captive || o.snatched || o.falling || o.weapon === "catapult") continue;
      const d = dist(o, b);
      // Neanderthals only once they're well into the woods (no open brawls at the forest's edge)
      if (d < bd && dist(o, t) < t.r * 0.75) {
        bd = d;
        best = { kind: "brute", b: o };
      }
    }
    // a predator prowling round the camp: they mob it
    w.creatureHash.each(b.x, b.y, Math.min(bd, core ? 220 : 120), (e) => {
      if (e.kind !== "dino" || e.owner || e.health <= 0) return;
      const def = sp(e.species);
      if (def.diet === "herbivore" || def.move === "swim" || (def.move === "fly" && e.z > 10) || sizeOf(e) < 30 || sizeOf(e) > 150) return;
      const d = dist(e, b);
      if (d < bd) {
        bd = d;
        best = { kind: "dino", d: e };
      }
    });
    return best;
  }

  /** Nearest foe to b (our people, Neanderthals, a predator chewing on them). */
  private foeNear(w: World, b: Brute, r: number, humans: boolean): Foe | null {
    return this.foeNearAt(w, b.x, b.y, r, humans);
  }
  private foeNearAt(w: World, x: number, y: number, r: number, humans = true): Foe | null {
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
      if (o.tree || o.hp <= 0 || o.captive || o.snatched || o.falling || o.weapon === "catapult") continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) {
        bd = d;
        best = { kind: "brute", b: o };
      }
    }
    return best;
  }
  private humanNear(w: World, x: number, y: number, r: number, outside: boolean): Foe | null {
    let best: Human | null = null;
    let bd = r;
    for (const h of w.humans) {
      if (!fairGame(h)) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d >= bd) continue;
      if (outside && Math.hypot(h.x - w.camp.x, h.y - w.camp.y) < 650) continue;
      bd = d;
      best = h;
    }
    return best ? { kind: "human", h: best } : null;
  }
  private bruteNear(w: World, x: number, y: number, r: number): Foe | null {
    for (const o of w.rivals.brutes) {
      if (o.tree || o.hp <= 0 || o.captive || o.snatched || o.falling || o.weapon === "catapult") continue;
      if (Math.hypot(o.x - x, o.y - y) < r) return { kind: "brute", b: o };
    }
    return null;
  }
  private anyFoe(w: World, x: number, y: number, r: number) {
    return !!this.foeNearAt(w, x, y, r);
  }
  /** Our grown-ups who can fight, round (x, y) (a Neanderthal counts double). */
  private armedNear(w: World, x: number, y: number, r: number) {
    let n = 0;
    for (const h of w.humans) {
      if (h.child || h.captive || h.under || h.stranger || h.state === "down") continue;
      if (Math.abs(h.x - x) < r && Math.abs(h.y - y) < r && Math.hypot(h.x - x, h.y - y) < r && w.tribe.weaponFor(w, h)) n++;
    }
    for (const o of w.rivals.brutes) if (!o.tree && o.hp > 0.2 && !o.captive && Math.hypot(o.x - x, o.y - y) < r) n += 2;
    return n;
  }

  private foeById(w: World, id: number): Foe | null {
    if (!id) return null;
    const h = w.humans.find((o) => o.id === id);
    if (h) return fairGame(h) ? { kind: "human", h } : null;
    const d = w.dinoById(id);
    if (d) return d.health > 0 && d.state !== "carried" ? { kind: "dino", d } : null;
    const o = w.rivals.byId(id);
    return o && !o.tree && o.hp > 0 && !o.captive && !o.snatched && !o.falling ? { kind: "brute", b: o } : null;
  }

  /** Two or three go after something small to eat. */
  private huntPack(w: World, b: Brute, t: TreeTribe) {
    let prey: Dino | null = null;
    let bd = t.r + 120;
    for (const d of w.dinos) {
      const def = sp(d.species);
      if (d.owner || def.diet !== "herbivore" || def.move !== "walk" || isBaby(d) || sizeOf(d) > 75 || d.health <= 0) continue;
      const dd = dist(d, t);
      if (dd < bd) {
        bd = dd;
        prey = d;
      }
    }
    if (!prey) return false;
    const pack = [b, ...this.members(t.id).filter((o) => o !== b && !o.band && (o.age ?? TREE_GROWN) >= TREE_GROWN && o.hp > 0.5 && (o.state === "idle" || o.state === "perch" || o.state === "wander") && dist(o, b) < 300).slice(0, 2)];
    for (const o of pack) {
      o.targetId = prey.id;
      o.hidden = false;
      setB(o, "hunt", prey.x, prey.y);
    }
    if (pack.length > 1) say(b, "Hunt! Hunt!", 1.4);
    return true;
  }

  /** A cover tile inside their woods. */
  private coverSpot(w: World, t: TreeTribe, r: number) {
    for (let k = 0; k < 10; k++) {
      const a = this.rng() * Math.PI * 2;
      const d = 60 + this.rng() * (r - 60);
      const x = t.x + Math.cos(a) * d;
      const y = t.y + Math.sin(a) * d;
      if (isCover(w, x, y) && w.nav.passable("dino", x, y)) return { x, y };
    }
    return null;
  }

  /** Up onto a deck at the camp. */
  private goUp(w: World, b: Brute, t: TreeTribe) {
    const pods = t.pods.filter((p) => p.hp > 0);
    b.hidden = false;
    if (!pods.length) {
      setB(b, "idle", t.x + (this.rng() - 0.5) * 60, t.y + 20);
      return;
    }
    const p = pods[b.id % pods.length];
    b.up = p.h;
    setB(b, "climb", p.x + (this.rng() - 0.5) * 14, p.y + 1);
  }

  /* ------------------------------ bodies ------------------------------ */

  private act(w: World, b: Brute, dt: number) {
    // anything but sitting in a tree: they leap down first
    const aloft = b.state === "perch" || b.state === "climb" || b.state === "sleep" || b.state === "drop";
    if (!aloft && b.z > 0) b.z = Math.max(0, b.z - 150 * dt);
    const t = this.tribe(b.tree);
    const quick = this.live.has(b) || b.state === "fight" || b.state === "dart";
    switch (b.state) {
      case "idle":
      case "rally":
      case "lurk": {
        b.vx = b.vy = 0;
        if (b.state === "rally") b.anim += dt * 5;
        if (b.state === "idle" && Math.hypot(b.tx - b.x, b.ty - b.y) > 6) this.move(w, b, dt, SPEED * 0.7, quick);
        if (t && dist(b, t) < 140) b.hp = Math.min(1, b.hp + dt * 0.008);
        return;
      }
      case "perch":
      case "sleep": {
        b.vx = b.vy = 0;
        b.z = b.up ?? b.z;
        if (t && dist(b, t) < 200) b.hp = Math.min(1, b.hp + dt * (b.state === "sleep" ? 0.02 : 0.012));
        return;
      }
      case "climb": {
        if (Math.hypot(b.tx - b.x, b.ty - b.y) > 6 && b.z < 2) {
          this.move(w, b, dt, SPEED, quick);
          return;
        }
        b.vx = b.vy = 0;
        b.anim += dt * 6;
        b.z = Math.min(b.up ?? 40, b.z + 75 * dt);
        if (b.z >= (b.up ?? 40) - 0.5) {
          setB(b, "perch", b.x, b.y);
          const bd = b.band ? this.bands.find((x) => x.id === b.band) : null;
          // an ambusher, or a lone watcher up a tree out in the woods: just leaves + a pair of eyes
          b.hidden = bd ? bd.mode === "lurk" : !!t && dist(b, t) > 220;
        }
        return;
      }
      case "walk":
      case "wander":
      case "home":
      case "flee": {
        const fast = b.state === "flee" || (b.state === "walk" && !!b.band);
        if (this.move(w, b, dt, SPEED * (fast ? 1.45 : b.state === "wander" ? 0.75 : 1), quick)) {
          const bd = b.band ? this.bands.find((x) => x.id === b.band) : null;
          if (bd?.mode === "lurk") {
            // no tree here: crouch down in the brush
            setB(b, "lurk", b.x, b.y);
            b.hidden = true;
          } else if ((b.state === "home" || b.state === "flee") && t && dist(b, t) < 120) {
            if (b.loot && !bd) {
              t.food += b.loot * 0.8;
              b.loot = 0;
            }
            if (b.forage && !bd) {
              t.food += b.forage;
              b.forage = 0;
            }
            if (!bd) this.goUp(w, b, t);
            else setB(b, "idle", b.x, b.y);
          } else setB(b, "idle", b.x, b.y);
          b.think = Math.min(b.think, 0.2);
        }
        return;
      }
      case "drop": {
        // a leap out of the branches onto whoever's below
        const f = this.foeById(w, b.targetId);
        if (f) {
          const p = foeXY(f);
          b.tx = p.x;
          b.ty = p.y;
        }
        b.anim += dt * 4;
        b.z = Math.max(0, b.z - (60 + b.stateT * 420) * dt);
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 4) {
          const s = Math.min(d, 110 * dt);
          b.x += (dx / d) * s;
          b.y += (dy / d) * s;
          b.dir = dx > 0 ? 1 : -1;
        }
        if (b.z <= 0) {
          w.particles.burst(P.Dust, b.x, b.y, 6, 50, { size: 9, max: 0.7, color: "rgba(140,120,90,0.55)" });
          w.sfx("thud", b.x, b.y, 0.5, 1.3);
          if (f && dist(b, foeXY(f)) < 34) this.strike(w, b, f, 1.6);
          setB(b, f?.kind === "dino" ? "hunt" : "fight", b.tx, b.ty);
        }
        return;
      }
      case "carry": {
        // one of ours over the shoulder, off home to the trees
        const h = w.humans.find((o) => o.id === b.captive);
        if (!h || !t || h.captive !== -t.id) {
          b.captive = 0;
          setB(b, "home", t?.x ?? b.x, t?.y ?? b.y);
          return;
        }
        const home = this.move(w, b, dt, SPEED * 0.95, quick);
        h.x = b.x - b.dir * 3;
        h.y = b.y + 1;
        h.z = 20;
        h.dir = b.dir;
        if (this.rng() < dt * 0.4) say(h, pick(this.rng, ["Help!!", "Let me go!", "HELP ME!"]), 2);
        if (home || dist(b, t) < 50) {
          b.captive = 0;
          h.z = 0;
          // tied at the foot of one of the camp trees
          const pods = t.pods.filter((p) => p.hp > 0);
          const p = pods.length ? pods[h.id % pods.length] : t;
          h.x = p.x + 12;
          h.y = p.y + 8;
          say(h, "Help…", 3);
          w.toast("😢", `${h.name} is held at the ${t.name} tree camp, tied to a tree. Send armed people to bring them home!`, h.x, h.y);
          this.goUp(w, b, t);
        }
        return;
      }
      case "dart": {
        if (this.move(w, b, dt, SPEED * 1.6, true) || b.stateT > 1.2) {
          setB(b, "fight", b.x, b.y);
          b.think = 0;
        }
        return;
      }
      case "fight":
      case "hunt": {
        const f = this.foeById(w, b.targetId);
        if (!f || b.stateT > 35) {
          setB(b, "idle", b.x, b.y);
          b.think = 0;
          return;
        }
        const p = foeXY(f);
        const d = dist(b, p);
        const arms = armsOf(b);
        const reach = REACH + (f.kind === "dino" ? sizeOf(f.d) * 0.3 : 0);
        // archers + slingers hang back and shoot; anyone may throw a rock as they close in
        if (f.kind === "human" && b.cd <= 0 && ((arms.range && d < arms.range && d > 70) || (d > 90 && d < 170 && this.rng() < 0.012))) {
          this.throwAt(w, b, f);
          return;
        }
        if (arms.range && f.kind === "human" && d < arms.range * 0.7 && d > 70) {
          b.vx = b.vy = 0;
          b.dir = p.x > b.x ? 1 : -1;
          return;
        }
        if (d <= reach) {
          b.vx = b.vy = 0;
          b.dir = p.x > b.x ? 1 : -1;
          if (b.cd <= 0) {
            b.cd = 0.9 + this.rng() * 0.5;
            b.anim = 0;
            this.strike(w, b, f, 1);
            if (b.hp <= 0) return;
            // hit + run: dart back out of reach, then come again
            if (this.rng() < 0.32) {
              const a = Math.atan2(b.y - p.y, b.x - p.x) + (this.rng() - 0.5) * 1.6;
              setB(b, "dart", b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 60);
            }
          }
          return;
        }
        // circle round to come in from the side
        let gx = p.x;
        let gy = p.y;
        if (d > 50) {
          const a = Math.atan2(b.y - p.y, b.x - p.x) + (b.flank ?? 1) * 0.9;
          gx = p.x + Math.cos(a) * 24;
          gy = p.y + Math.sin(a) * 18;
        }
        if (Math.hypot(b.tx - gx, b.ty - gy) > 24) {
          b.tx = gx;
          b.ty = gy;
        }
        // a sprint: quicker than one of ours running for it
        this.move(w, b, dt, SPEED * (d < 160 ? 1.8 : 1.6), true);
        return;
      }
    }
    b.vx = b.vy = 0;
  }

  /** Walk / run: proper paths when someone could see, a straight dash through the trees when not. */
  private move(w: World, b: Brute, dt: number, speed: number, quick: boolean) {
    if (quick) return moveBrute(w, b, dt, speed);
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      b.vx = b.vy = 0;
      return true;
    }
    const s = Math.min(d, speed * dt);
    const nx = b.x + (dx / d) * s;
    const ny = b.y + (dy / d) * s;
    if (!w.nav.passable("dino", nx, ny)) return moveBrute(w, b, dt, speed);
    b.vx = (nx - b.x) / Math.max(dt, 1e-4);
    b.vy = (ny - b.y) / Math.max(dt, 1e-4);
    b.x = nx;
    b.y = ny;
    b.dir = dx > 0 ? 1 : -1;
    b.anim += dt * (speed / 12);
    return false;
  }

  /** A blow (×mul for a leap from the trees). */
  private strike(w: World, b: Brute, f: Foe, mul: number) {
    const arms = armsOf(b);
    // out of the dark, unseen: the first blow lands hard
    if (w.daylight < 0.3 && !((b.spotT ?? 0) > 0)) mul *= 1.3;
    b.spotT = 3;
    w.sfx("whoosh", b.x, b.y, 0.4, 1.3);
    if (f.kind === "human") {
      const h = f.h;
      hurtHuman(w, h, arms.hit * mul, b.x, b.y, b.weapon === "spear" || b.weapon === "bone" ? "bite" : "club");
      // they're thieves: a load dropped in the scrap is theirs
      if (h.state === "down" && h.carry && h.carryN > 0 && !b.loot && ["meat", "fish", "berries", "cooked", "crop"].includes(h.carry)) {
        b.loot = Math.min(3, h.carryN);
        b.lootKind = h.carry;
        h.carryN -= b.loot;
        if (h.carryN <= 0) {
          h.carry = null;
          h.carryN = 0;
        }
        say(b, "Hee!", 1);
      }
    } else if (f.kind === "brute") {
      w.rivals.hit(w, f.b, arms.hit * mul * 0.9, b.x, b.y, true);
    } else {
      hitDino(w, f.d, 24 * mul, b.x, b.y);
      // a predator bites back
      const def = sp(f.d.species);
      if (def.diet !== "herbivore" && this.rng() < 0.35 + def.attack * 0.2) {
        f.d.targetId = b.id;
        this.hit(w, b, 0.12 + def.attack * 0.18, f.d.x, f.d.y, true);
      }
      if (f.d.health <= 0) {
        const t = this.tribe(b.tree);
        if (t) {
          t.food += Math.min(6, 2 + sizeOf(f.d) / 25);
          for (const o of this.members(t.id)) if (o.targetId === f.d.id && (o.state === "hunt" || o.state === "fight")) setB(o, "home", t.x + (this.rng() - 0.5) * 60, t.y);
        }
        say(b, "Meat! Meat!", 1.5);
      }
    }
  }

  private throwAt(w: World, b: Brute, f: Foe) {
    const arms = armsOf(b);
    b.spotT = 2;
    const p = foeXY(f);
    b.cd = (arms.range ? 2.2 : 3.2) + this.rng() * 0.8;
    b.dir = p.x > b.x ? 1 : -1;
    b.anim = 0;
    const d = dist(b, p);
    const kind = arms.range ? arms.missile : this.rng() < 0.5 && b.weapon === "spear" ? "spear" : "rock";
    const flight = Math.max(0.25, d / (kind === "arrow" ? 420 : 260));
    const miss = kind === "arrow" ? 22 : 30;
    const tx = p.x + (this.rng() - 0.5) * miss;
    const ty = p.y + (this.rng() - 0.5) * miss * 0.6;
    const sz = b.z + 24;
    const tz = 12;
    const dmg = arms.range ? arms.throw : kind === "spear" ? ARMS.spear!.throw : 0.12;
    // people are hit where it lands (Rivals' missiles); anything else takes it now
    w.rivals.missiles.push({ x: b.x, y: b.y, z: sz, vx: (tx - b.x) / flight, vy: (ty - b.y) / flight, vz: (tz - sz) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target: f.kind === "human" ? f.h.id : 0, dmg, kind });
    if (f.kind === "brute") w.rivals.hit(w, f.b, dmg, b.x, b.y, true);
    else if (f.kind === "dino") hitDino(w, f.d, 14, b.x, b.y);
    w.sfx("whoosh", b.x, b.y, 0.45, kind === "arrow" ? 1.6 : 1);
  }

  /* ------------------------------ getting hurt ------------------------------ */

  /** From Rivals.hit: lighter than a Neanderthal, and they fight back (or scatter). */
  hit(w: World, b: Brute, dmg: number, fx: number, fy: number, byBrute = false, proj?: string) {
    b.spotT = 4;
    // quick + slippery: a lot of a Neanderthal's big swings only catch air
    b.hp -= byBrute ? dmg * (proj ? 1 : 0.6) : dmg / TREE_TOUGH;
    b.hidden = false;
    w.particles.burst(P.Star, b.x, b.y - b.z, 2, 30, { z: 24, size: 4, max: 0.5 });
    w.sfx("thunk", b.x, b.y, 0.6, 1.2);
    if (b.hp <= 0) return w.rivals.kill(w, b);
    if (this.rng() < 0.4) say(b, pick(this.rng, ["Yeek!", "Hss!", "Kraa!", "Ow-ow!"]), 1.2);
    // shot out of a tree: down they come
    if (b.state === "perch" || b.state === "sleep" || b.state === "lurk") setB(b, "idle", b.x, b.y + 4);
    const t = this.tribe(b.tree);
    if (!t) return;
    if (b.hp < 0.3) {
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      return;
    }
    if (b.state === "fight" || b.state === "drop" || b.state === "dart" || b.state === "flee" || (b.age ?? TREE_GROWN) < TREE_GROWN) return;
    // turn on whoever did it
    const foe: Foe | null = byBrute
      ? this.bruteNear(w, fx, fy, 60)
      : proj === "dragon" || proj === "fire" ? null : this.humanNear(w, fx, fy, 320, false);
    if (foe) this.engage(w, b, t, foe);
  }

  /** From Rivals.kill (already out of the list): what they drop. */
  died(w: World, b: Brute) {
    w.particles.burst(P.Leaf, b.x, b.y, 8, 60, { size: 6, max: 1, color: "#5f8f3a" });
    w.particles.burst(P.Poof, b.x, b.y, 6, 50, { size: 10, max: 0.8, color: "rgba(200,190,170,0.9)" });
    w.addItem(b.weapon === "sling" || b.weapon === "club" ? "stone" : "stick", b.x - 8, b.y + 2);
    if (b.forage) w.addItem("berries", b.x + 8, b.y + 2, { amount: b.forage });
    if (this.rng() < 0.25) w.addItem("bones", b.x + 4, b.y + 6);
    const l = this.index.get(b.tree ?? 0);
    if (l) {
      const i = l.indexOf(b);
      if (i >= 0) l.splice(i, 1);
    }
    const near = w.humans.some((h) => !h.captive && dist(h, b) < 600);
    if (near && w.elapsed - this.toastAt > 8) {
      this.toastAt = w.elapsed;
      w.toast("💀", `${this.label(b)} is down!`, b.x, b.y);
    }
    w.sfx("thud", b.x, b.y, 0.6, 1.1);
  }

  /** Gone for good (off the map). */
  private vanish(w: World, b: Brute) {
    const i = w.rivals.brutes.indexOf(b);
    if (i >= 0) w.rivals.brutes.splice(i, 1);
  }

  /* ------------------------------ save ------------------------------ */

  clear(w: World) {
    w.rivals.brutes = w.rivals.brutes.filter((b) => !b.tree);
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
      tribes: this.tribes.map((t) => ({ ...t, food: Math.round(t.food * 10) / 10, growT: r(t.growT), raidT: r(t.raidT), ambushT: r(t.ambushT), work: Math.round(t.work * 10) / 10, pods: t.pods.map((p) => ({ ...p, hp: Math.round(p.hp * 100) / 100 })), signs: t.signs.map((s) => ({ ...s })) })),
      folk: this.folk(w).filter((b) => this.tribe(b.tree)).map((b) => ({ tree: b.tree!, name: b.name, x: r(b.x), y: r(b.y), hp: Math.round(b.hp * 100) / 100, weapon: b.weapon, age: r(b.age ?? TREE_GROWN), tint: b.tint })),
      cleared: this.cleared.filter((c) => w.elapsed - c.t < CLEARED_FOR).map((c) => ({ x: r(c.x), y: r(c.y), t: r(c.t) })),
    };
  }

  /** After Rivals.load (which wipes every brute). */
  load(w: World, d: ReturnType<Forest["serialize"]> | undefined) {
    this.tribes = [];
    this.bands = [];
    this.index.clear();
    this.enabled = true;
    w.rivals.brutes = w.rivals.brutes.filter((b) => !b.tree);
    if (!d) return;
    this.started = !!d.started;
    this.ids = Math.max(4e8, d.ids ?? 4e8);
    this.nextTribe = d.next ?? 1;
    this.settleT = d.settleT ?? 600;
    this.uniteT = (d as { uniteT?: number }).uniteT ?? 150;
    this.cleared = (d.cleared ?? []).map((c) => ({ ...c }));
    for (const t of d.tribes ?? []) this.tribes.push({ ...t, pods: t.pods.map((p) => ({ ...p })), signs: t.signs.map((s) => ({ ...s })) });
    for (const f of d.folk ?? []) {
      const t = this.tribe(f.tree);
      if (!t) continue;
      const b = this.add(w, t, f.x, f.y, { name: f.name, hp: f.hp, weapon: f.weapon, age: f.age, tint: f.tint ?? t.color });
      // everyone wakes up back at camp business (bands don't survive a reload)
      if (dist(b, t) < 200) this.goUp(w, b, t);
    }
    // anyone held by a tribe that's no longer about found their way home
    for (const h of w.humans) if ((h.captive ?? 0) < 0 && !this.tribe(-h.captive!)) w.rivals.free(w, h, `${h.name} found the way home!`);
  }
}

/* ------------------------------ helpers ------------------------------ */

/** Every paint a tribe wears (its own first). */
export function colorsOf(t: TreeTribe) {
  return t.colors?.length ? t.colors : [t.color];
}

function centroid(list: { x: number; y: number }[]) {
  let x = 0;
  let y = 0;
  for (const p of list) {
    x += p.x;
    y += p.y;
  }
  return { x: x / Math.max(1, list.length), y: y / Math.max(1, list.length) };
}

/** A night thief takes whatever's worth carrying: food most of the time, else good materials. */
function takeAnything(w: World, n: number, rng: Rng): { r: Resource; n: number } | null {
  const s = w.camp.stock;
  const kinds = (["iron", "copper", "flint", "hide", "wood", "stone", "bone"] as Resource[]).filter((r) => Math.floor(s[r] ?? 0) > 0);
  if (!kinds.length || rng() < 0.6) {
    const food = takeFood(w, n);
    if (food || !kinds.length) return food;
  }
  const r = kinds[Math.floor(rng() * Math.min(3, kinds.length))];
  const k = Math.min(n, Math.floor(s[r]));
  s[r] -= k;
  return { r, n: k };
}

/** Grab some food off our stores. */
function takeFood(w: World, n: number): { r: Resource; n: number } | null {
  const s = w.camp.stock;
  for (const r of ["cooked", "meat", "fish", "crop", "berries"] as Resource[]) {
    const k = Math.min(n, Math.floor(s[r]));
    if (k <= 0) continue;
    s[r] -= k;
    return { r, n: k };
  }
  return null;
}

