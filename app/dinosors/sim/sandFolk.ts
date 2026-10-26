/* ------------------------------------------------------------------ */
/*  Sand People: a hostile desert people of the central desert.        */
/*                                                                     */
/*  • Camps of striped tents round a big tent, a camel pen, a fire, a  */
/*    totem and (the strong ones) a roost for their Sand Dragon. Only   */
/*    out in the desert: on the sand, by the rock outcrops + oases.     */
/*  • Camel riders, archers, fighters, scouts and the Sand Dragon       */
/*    Riders: elites flying sand-coloured dragons that blast hot sand.  */
/*  • Camouflage: robed in sand colours, out on the open sand they're   */
/*    hard to make out (drawn faint; our guards + the other peoples     */
/*    only notice them up close or once they strike). Off the sand      */
/*    they're as plain to see as anyone.                                */
/*  • They hate everyone: our town, the Neanderthal clans, the Tree +  */
/*    Sea People, and now and then a rival Sand tribe. They move in     */
/*    groups (folkGroups.ts): patrols, caravans, raiding parties, war   */
/*    bands, never one by one.                                          */
/*  • Cheap to run: one band tick twice a second, a slow tick once a    */
/*    second, and folk nobody's near think every few seconds.           */
/*                                                                     */
/*  Every Sand Person is a Brute (clan 0, `sand` = their tribe) in      */
/*  w.rivals.brutes, so our guards, Scorpions, war dinos, dragons +     */
/*  the other peoples fight them already. Own random numbers + ids      */
/*  (6e8 up) so the rest of the world plays out the same without them. */
/* ------------------------------------------------------------------ */
import { BREEDS, DRAGON_NAMES } from "../data/dragons";
import { addDino, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { REGION, isSandTile, isWalkTile, isWaterTile } from "./terrain";
import { hitDino } from "./tribe";
import { MAP_W, T, TILE, WORLD_W, type Brute, type BruteWeapon, type Dino, type Dragon, type Human } from "./types";
import type { World } from "./world";
import { moveBrute, say, setB } from "./rivals";
import { fairGame, takeFood } from "./treeFolk";
import { breathBlast } from "./breath";
import { flyToward, landAt } from "./dragonKeep";
import { repelStep } from "./dragonShield";
import { foundingGroups, type FolkGroup, type GroupKind } from "./folkGroups";

/** Our hits are divided by this (Neanderthals take 150, Tree People 70). */
export const SAND_TOUGH = 105;
const SPEED = 46;
const CAMEL_SPEED = 82;
const REACH = 22;
/** Seconds for a youngster to grow into a warrior. */
export const SAND_GROWN = 110;
export const MAX_SAND_TRIBES = 3;
const MAX_FOLK = 42;
/** They show up a little after the Neanderthals (and well after the start). */
const START_AT = 300;
/** A Sand camp never pitches nearer our town than this (px). */
export const SAND_MIN = 1500;
/** within this of one of our awake people, a Sand Person on the sand is spotted */
const SPOT_R = 135;
const TRIBE_NAMES = ["Red Dune", "Sun Scorpion", "Dust Wind", "Bone Sand", "Mirage", "Burning Sky", "Viper Track", "Salt Moon", "Glass Storm"];
const FOLK_NAMES = ["Azir", "Kesh", "Rami", "Tufa", "Saro", "Imri", "Dagan", "Nesa", "Orun", "Zahl", "Bek", "Iska", "Moro", "Tash", "Jalo", "Qeb", "Hanu", "Sefa", "Varn", "Ebo", "Kalu", "Ravi", "Udo", "Yesh"];
/** sash + banner colours (their robes are always sand) */
const PAINTS = ["#c0392b", "#e67e22", "#8e44ad", "#1f6f8b", "#16a085", "#7a1f3d"];
type Role = NonNullable<Brute["sandRole"]>;
const ARMS: Record<Role, { weapon: BruteWeapon; hit: number; throw: number; range: number; missile: "spear" | "rock" | "sling" | "arrow" }> = {
  archer: { weapon: "bow", hit: 0.1, throw: 0.17, range: 300, missile: "arrow" },
  fighter: { weapon: "spear", hit: 0.24, throw: 0.16, range: 0, missile: "spear" },
  camel: { weapon: "spear", hit: 0.26, throw: 0.15, range: 170, missile: "spear" },
  scout: { weapon: "sling", hit: 0.12, throw: 0.15, range: 240, missile: "sling" },
  dragon: { weapon: "spear", hit: 0.2, throw: 0.15, range: 0, missile: "spear" },
};
export const SAND_ROLE_NAMES: Record<Role, string> = { camel: "Camel Rider", archer: "Sand Archer", fighter: "Sand Warrior", scout: "Dune Scout", dragon: "Sand Dragon Rider" };

export interface SandTent {
  x: number;
  y: number;
  kind: "tent" | "bigTent" | "pen" | "roost" | "totem" | "fire";
  hp: number;
}

export interface SandTribe {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  r: number;
  tier: number;
  food: number;
  growT: number;
  raidT: number;
  patrolT: number;
  caravanT: number;
  tents: SandTent[];
  /** an oasis their caravans walk to */
  water?: { x: number; y: number };
  found?: boolean;
  seen?: boolean;
}

export interface SandBand {
  id: number;
  tribe: number;
  mode: "raid" | "patrol" | "caravan";
  goal: { kind: "town" | "clan" | "tree" | "sea" | "sand" | "point"; id: number };
  x: number;
  y: number;
  grp: number;
  t: number;
  phase: "go" | "fight" | "home";
  /** a patrol's waypoints round their land */
  pts?: { x: number; y: number }[];
  quiet: number;
}

type Foe = { kind: "human"; h: Human } | { kind: "brute"; b: Brute } | { kind: "dino"; d: Dino };
const foeXY = (f: Foe) => (f.kind === "human" ? f.h : f.kind === "brute" ? f.b : f.d);
const foeId = (f: Foe) => foeXY(f).id;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class SandFolk {
  tribes: SandTribe[] = [];
  bands: SandBand[] = [];
  started = false;
  /** off in bare test worlds; on in every real game, new or loaded */
  enabled = true;
  rng: Rng;
  private ids = 6e8;
  private nextTribe = 1;
  private settleT = 900;
  private tickT = 0;
  private bandT = 0;
  private toastAt = -999;
  private index = new Map<number, Brute[]>();

  constructor(seed = 1) {
    this.rng = makeRng(seed * 59 + 23);
  }

  tribe(id: number | undefined) {
    return id ? this.tribes.find((t) => t.id === id) ?? null : null;
  }
  members(id: number) {
    return this.index.get(id) ?? [];
  }
  folk(w: World) {
    return w.rivals.brutes.filter((b) => !!b.sand);
  }
  label(b: Brute) {
    const t = this.tribe(b.sand);
    return `${b.name}, ${SAND_ROLE_NAMES[b.sandRole ?? "fighter"]} of the ${t?.name ?? "Sand"} People`;
  }
  campAt(x: number, y: number, r = 180) {
    return this.tribes.find((t) => Math.hypot(t.x - x, t.y - y) < r) ?? null;
  }
  private nextId() {
    return this.ids++;
  }
  private reindex(w: World) {
    this.index.clear();
    for (const b of w.rivals.brutes) {
      if (!b.sand) continue;
      const l = this.index.get(b.sand);
      if (l) l.push(b);
      else this.index.set(b.sand, [b]);
    }
  }

  /** Can our side (or the other peoples) make this Sand Person out right now? */
  seen(w: World, b: Brute) {
    if (b.onDragon) return true;
    if ((b.spotT ?? 0) > 0) return true;
    return !isSandTile(w.terrain.tileAt(b.x, b.y));
  }

  /* ------------------------------ per frame ------------------------------ */

  update(w: World, dt: number) {
    if (!this.enabled) return;
    if (!this.started) {
      if (w.rivals.started && w.elapsed > START_AT && w.humans.length) {
        this.started = true;
        this.settle(w, 1);
        this.settle(w, 1);
      }
      return;
    }
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = 1;
      this.reindex(w);
      this.slowTick(w);
    }
    this.bandT -= dt;
    if (this.bandT <= 0) {
      this.bandT = 0.5;
      this.bandsTick(w);
    }
  }

  /** One Sand Person, every frame (from Rivals.update). */
  step(w: World, b: Brute, dt: number) {
    if ((b.spotT ?? 0) > 0) b.spotT = Math.max(0, (b.spotT ?? 0) - dt);
    // up on a Sand Dragon: it carries them (dragonStep)
    if (b.onDragon) {
      if (!w.dragons.list.some((d) => d.id === b.onDragon)) this.fallOff(w, b);
      return;
    }
    b.think -= dt;
    if (b.think <= 0) this.think(w, b);
    this.act(w, b, dt);
    if (b.mount) this.ride(w, b);
  }

  /* ------------------------------ camps ------------------------------ */

  /** A good camp spot out on the sand (near an oasis or a rock outcrop), or null. */
  private site(w: World, near?: { x: number; y: number }, minFromUs = SAND_MIN): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bs = -Infinity;
    for (let k = 0; k < 260; k++) {
      const x = near ? near.x + (this.rng() - 0.5) * 900 : (150 + this.rng() * 70) * TILE;
      const y = near ? near.y + (this.rng() - 0.5) * 700 : (32 + this.rng() * 62) * TILE;
      const s = this.siteScore(w, x, y, minFromUs);
      if (s > bs) {
        bs = s;
        best = { x, y };
      }
    }
    return bs > -Infinity ? best : null;
  }

  private siteScore(w: World, x: number, y: number, minFromUs: number) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 2 || ty < 2 || tx >= MAP_W - 2) return -Infinity;
    const t = w.terrain.tileAt(x, y);
    if (!isSandTile(t) && w.terrain.region[ty * MAP_W + tx] !== REGION.desert) return -Infinity;
    if (!isWalkTile(t) || isWaterTile(t) || !w.nav.passable("dino", x, y)) return -Infinity;
    if (Math.hypot(x - w.camp.x, y - w.camp.y) < minFromUs) return -Infinity;
    if (this.tribes.some((o) => Math.hypot(o.x - x, o.y - y) < 950)) return -Infinity;
    if (w.rivals.clans.some((c) => Math.hypot(c.x - x, c.y - y) < 900)) return -Infinity;
    // room for the tents: mostly open sand round about
    let open = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (isSandTile(w.terrain.tileAt(x + Math.cos(a) * 110, y + Math.sin(a) * 80))) open++;
    }
    if (open < 5) return -Infinity;
    const water = w.terrain.nearestDrink(x, y, 1400);
    return open * 10 + (water ? 400 - Math.min(400, Math.hypot(water.x - x, water.y - y) * 0.3) : 0) + this.rng() * 60;
  }

  /** A new tribe pitches its tents. */
  settle(w: World, tier = 1, at?: { x: number; y: number }): SandTribe | null {
    const spot = at ?? this.site(w);
    if (!spot) return null;
    const used = new Set(this.tribes.map((t) => t.name));
    const names = TRIBE_NAMES.filter((n) => !used.has(n));
    const worn = new Set(this.tribes.map((t) => t.color));
    const paints = PAINTS.filter((c) => !worn.has(c));
    const t: SandTribe = {
      id: this.nextTribe++,
      name: pick(this.rng, names.length ? names : TRIBE_NAMES),
      color: pick(this.rng, paints.length ? paints : PAINTS),
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      r: 560 + tier * 80,
      tier,
      food: 6,
      growT: 60 + this.rng() * 40,
      raidT: 420 + this.rng() * 300,
      patrolT: 40 + this.rng() * 60,
      caravanT: 120 + this.rng() * 120,
      tents: [],
    };
    const water = w.terrain.nearestDrink(t.x, t.y, 2200);
    if (water) t.water = { x: Math.round(water.x), y: Math.round(water.y) };
    this.pitch(w, t);
    this.tribes.push(t);
    // the founding band: archers, warriors, camel riders, a scout, and (if there's a roost) a dragon rider
    const roles: Role[] = ["archer", "archer", "fighter", "fighter", "camel", "camel", "scout"];
    const roost = t.tents.find((x) => x.kind === "roost");
    if (roost) roles.push("dragon");
    const folk: Brute[] = [];
    for (const role of roles) folk.push(this.add(w, t, t.x + (this.rng() - 0.5) * 140, t.y + 20 + (this.rng() - 0.5) * 70, role));
    for (let i = 0; i < 2; i++) folk.push(this.add(w, t, t.x + (this.rng() - 0.5) * 60, t.y + 18, "fighter", { age: this.rng() * 60 }));
    // their camels (one for each rider, and a pack camel for the caravans)
    const pen = t.tents.find((x) => x.kind === "pen");
    for (const b of folk.filter((f) => f.sandRole === "camel")) {
      const c = this.camel(w, t, pen ?? t);
      if (c) this.mountUp(w, b, c);
    }
    this.camel(w, t, pen ?? t);
    if (roost) {
      const rider = folk.find((f) => f.sandRole === "dragon");
      const dr = this.dragon(w, t, roost);
      if (rider && dr) this.boardDragon(rider, dr);
    }
    // they live in groups: the camel riders ride together as a patrol, the rest as families round the camp
    const riders = folk.filter((f) => f.sandRole === "camel" || f.sandRole === "scout");
    if (riders.length >= 2) w.groups.make("sand", t.id, "patrol", riders, t.x, t.y);
    foundingGroups(w, "sand", t.id, folk.filter((f) => !riders.includes(f)), t);
    this.index.set(t.id, folk);
    return t;
  }

  /** The tents round the big tent, the pen, the fire, the totem (and a roost from the start or once they're strong). */
  private pitch(w: World, t: SandTribe) {
    t.tents = [{ x: t.x, y: t.y - 6, kind: "bigTent", hp: 1 }, { x: t.x + 6, y: t.y + 46, kind: "fire", hp: 1 }];
    const n = 4 + t.tier;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng() * 0.4;
      const r = 120 + this.rng() * 40;
      const x = t.x + Math.cos(a) * r;
      const y = t.y + Math.sin(a) * r * 0.62;
      if (w.nav.passable("dino", x, y)) t.tents.push({ x: Math.round(x), y: Math.round(y), kind: "tent", hp: 1 });
    }
    const side = this.rng() < 0.5 ? -1 : 1;
    t.tents.push({ x: Math.round(t.x + side * 220), y: Math.round(t.y + 30), kind: "pen", hp: 1 });
    t.tents.push({ x: Math.round(t.x - side * 70), y: Math.round(t.y + 90), kind: "totem", hp: 1 });
    // the first tribe always keeps a Sand Dragon; later ones once they're grown
    if (t.tier >= 2 || this.tribes.length === 0 || this.rng() < 0.5) t.tents.push({ x: Math.round(t.x - side * 230), y: Math.round(t.y - 40), kind: "roost", hp: 1 });
  }

  /** The People tool: a Sand camp pitches where you tap (snapped to the nearest good sand). */
  placeCamp(w: World, x: number, y: number, minFromUs: number): SandTribe | string {
    if (this.tribes.length >= MAX_SAND_TRIBES) return `There are already ${MAX_SAND_TRIBES} Sand People camps: the desert can't feed more.`;
    let spot: { x: number; y: number } | null = null;
    for (let r = 0; r <= 360 && !spot; r += 40) {
      const n = r ? Math.round((r / 40) * 6) : 1;
      for (let i = 0; i < n && !spot; i++) {
        const px = x + Math.cos((i / n) * Math.PI * 2) * r;
        const py = y + Math.sin((i / n) * Math.PI * 2) * r;
        if (this.siteScore(w, px, py, minFromUs) > -Infinity) spot = { x: px, y: py };
      }
    }
    if (!spot) {
      if (!isSandTile(w.terrain.tileAt(x, y))) return "Sand People only live out in the desert. Tap on the open sand.";
      if (Math.hypot(x - w.camp.x, y - w.camp.y) < minFromUs + 200) return "Too close to our camp: they want their own stretch of desert further out.";
      return "No room for a camp here (too cramped, or someone else is close). Try another part of the desert.";
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
   * The People tool, a group: a family, a patrol, a raiding party or a caravan of Sand People where you tap.
   * They belong to the nearest camp (a new camp goes up if there isn't one in the desert).
   */
  placeGroup(w: World, x: number, y: number, kind: GroupKind): { t: SandTribe; g: FolkGroup } | string {
    if (!isSandTile(w.terrain.tileAt(x, y)) && w.terrain.region[Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE)] !== REGION.desert) return "Sand People only walk out of the desert. Tap on the sand.";
    let t = this.tribes.slice().sort((a, b) => dist(a, { x, y }) - dist(b, { x, y }))[0] ?? null;
    if (!t || dist(t, { x, y }) > 3200) {
      const made = this.placeCamp(w, x, y, 1000);
      if (typeof made === "string") return made;
      t = made;
    }
    this.enabled = true;
    this.started = true;
    w.rivals.started = true;
    const n = kind === "raid" ? 6 : kind === "war" ? 8 : kind === "patrol" ? 4 : kind === "caravan" ? 3 : 4;
    const folk: Brute[] = [];
    for (let i = 0; i < n; i++) {
      const role: Role = kind === "caravan" ? (i === 0 ? "camel" : "fighter") : kind === "patrol" ? (i < 2 ? "camel" : "scout") : kind === "family" ? (i < 2 ? "fighter" : "archer") : (["fighter", "archer", "camel", "fighter", "archer", "camel", "fighter", "scout"] as Role[])[i % 8];
      const young = kind === "family" && i >= 2;
      folk.push(this.add(w, t, x + (this.rng() - 0.5) * 70, y + (this.rng() - 0.5) * 50, role, young ? { age: 20 + this.rng() * 40 } : {}));
    }
    for (const b of folk.filter((f) => f.sandRole === "camel")) {
      const c = this.camel(w, t, { x: b.x + 14, y: b.y + 6 });
      if (c) this.mountUp(w, b, c);
    }
    if (kind === "caravan") for (let i = 0; i < 2; i++) this.camel(w, t, { x: x - 30 - i * 30, y: y + 10 });
    const g = w.groups.make("sand", t.id, kind, folk, x, y)!;
    const l = this.index.get(t.id);
    if (l) l.push(...folk);
    else this.index.set(t.id, folk);
    t.seen = true;
    // what the group does next: raids go straight for the nearest target, the rest set off on their business
    if (kind === "raid" || kind === "war") this.startRaid(w, t, folk);
    else if (kind === "patrol") this.startPatrol(w, t, folk, { x, y });
    else if (kind === "caravan") this.startCaravan(w, t, folk);
    else w.groups.moveTo(w, g, t.x, t.y, "home");
    return { t, g };
  }

  /** One more Sand Person. */
  private add(w: World, t: SandTribe, x: number, y: number, role: Role, o: Partial<Brute> = {}): Brute {
    const used = new Set(this.members(t.id).map((b) => b.name));
    const names = FOLK_NAMES.filter((n) => !used.has(n));
    const b: Brute = {
      id: this.nextId(),
      kind: "brute",
      name: pick(this.rng, names.length ? names : FOLK_NAMES),
      clan: 0,
      sand: t.id,
      sandRole: role,
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      dir: this.rng() < 0.5 ? 1 : -1,
      hp: 1,
      weapon: ARMS[role].weapon,
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
      age: SAND_GROWN,
      flank: this.rng() < 0.5 ? -1 : 1,
      bubble: null,
      ...o,
    };
    w.rivals.brutes.push(b);
    return b;
  }

  /** A camel for the tribe (a real animal: camels.ts rules, the Sand People's brand). */
  private camel(w: World, t: SandTribe, at: { x: number; y: number }): Dino | null {
    const d = addDino(w, "camel", at.x + (this.rng() - 0.5) * 40, at.y + (this.rng() - 0.5) * 24, { growth: 1 });
    d.sandTribe = t.id;
    d.homeX = at.x;
    d.homeY = at.y;
    return d;
  }

  /** A Sand Dragon for the tribe's roost (dragon ids + dice, so the rest of the world is untouched). */
  private dragon(w: World, t: SandTribe, roost: { x: number; y: number }): Dragon | null {
    if (w.dragons.list.filter((d) => d.sandTribe === t.id).length >= 1 + Math.floor(t.tier / 2)) return null;
    const def = BREEDS.sand;
    const dr: Dragon = {
      id: w.dragons.nextId(),
      kind: "dragon",
      name: pick(w.dragons.rng, DRAGON_NAMES),
      x: roost.x,
      y: roost.y,
      z: 0,
      vx: 0,
      vy: 0,
      dir: 1,
      hp: def.hp,
      maxHp: def.hp,
      state: "idle",
      t: 0,
      target: 0,
      tx: roost.x,
      ty: roost.y,
      breath: 0,
      anim: 0,
      hue: 0,
      passes: 0,
      hit: 0,
      breed: "sand",
      growth: 1,
      // a trained war dragon: it flies with the shared flight (dragonKeep's flyToward / landAt)
      skills: { flight: 1, combat: 1, fire: 1 },
      sandTribe: t.id,
    };
    w.dragons.list.push(dr);
    return dr;
  }

  private boardDragon(b: Brute, dr: Dragon) {
    b.onDragon = dr.id;
    dr.sandRider = b.id;
    b.sandRole = "dragon";
  }

  /** The dragon's gone out from under them: down they come. */
  private fallOff(w: World, b: Brute) {
    b.onDragon = undefined;
    if (b.z > 30) w.rivals.hit(w, b, Math.min(0.6, b.z / 400), b.x, b.y, true);
    b.z = 0;
    b.sandRole = "fighter";
    setB(b, "idle", b.x, b.y);
  }

  mountUp(w: World, b: Brute, d: Dino) {
    if (d.sandRider || b.mount) return;
    b.mount = d.id;
    d.sandRider = b.id;
  }

  /** a dino by id (the world's index is rebuilt once a frame, so a camel made this frame needs the slow way) */
  private dinoOf(w: World, id: number | undefined) {
    return id ? w.dinoById(id) ?? w.dinos.find((x) => x.id === id) ?? null : null;
  }

  dismount(w: World, b: Brute) {
    const d = this.dinoOf(w, b.mount);
    if (d && d.sandRider === b.id) {
      d.sandRider = undefined;
      d.state = "idle";
    }
    b.mount = undefined;
    b.z = 0;
  }

  /** Riding: the camel goes where its rider goes. */
  private ride(w: World, b: Brute) {
    const d = this.dinoOf(w, b.mount);
    if (!d || d.health <= 0 || d.sandRider !== b.id) {
      b.mount = undefined;
      b.z = 0;
      return;
    }
    d.x = b.x;
    d.y = b.y - 1;
    d.vx = b.vx;
    d.vy = b.vy;
    d.dir = b.dir;
    b.z = sizeOf(d) * 0.58;
  }

  /* ------------------------------ once a second ------------------------------ */

  private slowTick(w: World) {
    const calm = w.tribe.danger === "calm";
    for (const t of [...this.tribes]) {
      const fs = this.members(t.id);
      const adults = fs.filter((b) => (b.age ?? SAND_GROWN) >= SAND_GROWN);
      for (const b of fs) if ((b.age ?? SAND_GROWN) < SAND_GROWN) b.age = (b.age ?? 0) + 1;
      // the desert feeds them slowly (dates at the oasis, lizards, the caravans' trade)
      t.food += 0.02 * Math.max(1, adults.length) + (t.water ? 0.03 : 0);
      t.growT -= 1;
      if (t.growT <= 0) {
        t.growT = 90 + this.rng() * 70;
        if (t.food > 3 && fs.length < Math.min(10 + t.tier * 5, MAX_FOLK) && this.folk(w).length < MAX_FOLK) {
          t.food -= 3;
          const role: Role = pick(this.rng, ["archer", "fighter", "fighter", "camel", "scout"] as Role[]);
          const b = this.add(w, t, t.x + (this.rng() - 0.5) * 60, t.y + 24, role, { age: 0 });
          fs.push(b);
          if (role === "camel" && fs.length > 6) {
            const pen = t.tents.find((x) => x.kind === "pen");
            this.camel(w, t, pen ?? t);
          }
        }
        // a strong camp grows: more tents, a roost + a dragon
        if (fs.length > 8 + t.tier * 4 && t.tier < 3) {
          t.tier++;
          t.r += 80;
          if (!t.tents.some((x) => x.kind === "roost")) t.tents.push({ x: t.x - 230, y: t.y - 40, kind: "roost", hp: 1 });
          if (t.found) w.toast("🏜️", `The ${t.name} Sand People's camp is growing stronger.`, t.x, t.y);
        }
      }
      // a dragon rider without a dragon (theirs fell): a new one is raised at the roost now and then
      const roost = t.tents.find((x) => x.kind === "roost");
      if (roost && this.rng() < 0.004 && !w.dragons.list.some((d) => d.sandTribe === t.id)) {
        const rider = adults.find((b) => !b.mount && !b.band && b.sandRole !== "camel");
        const dr = this.dragon(w, t, roost);
        if (rider && dr) this.boardDragon(rider, dr);
      }
      // gone: the camp blows away; their camels go wild, their dragon flies off
      if (!fs.length) {
        this.tribes.splice(this.tribes.indexOf(t), 1);
        for (const d of w.dinos) if (d.sandTribe === t.id) d.sandTribe = undefined;
        for (const dr of w.dragons.list) if (dr.sandTribe === t.id) dr.sandTribe = undefined;
        w.groups.retribe("sand", t.id, null);
        if (t.found) w.toast("🏜️", `The ${t.name} Sand People are gone from the desert. Only their tent poles are left.`, t.x, t.y);
        continue;
      }
      if (!t.found && w.humans.some((h) => !h.captive && !h.under && dist(h, t) < 650)) {
        t.found = true;
        t.seen = true;
        w.toast("🏜️", `A Sand People camp! The ${t.name} tribe: ${fs.length} of them, robed the colour of the dunes. Out on the sand they're hard to spot. They raid on camels and fly Sand Dragons!`, t.x, t.y);
        w.discover("sandPeople", t.x, t.y);
      }
      // groups go out: patrols, caravans, and (not when the world's calm) raids
      const free = adults.filter((b) => !b.band && !b.onDragon && b.hp > 0.6 && b.state !== "flee" && b.state !== "fight");
      t.patrolT -= 1;
      if (t.patrolT <= 0) {
        t.patrolT = 120 + this.rng() * 120;
        const riders = free.filter((b) => b.mount || b.sandRole === "scout").slice(0, 4);
        if (riders.length >= 2) this.startPatrol(w, t, riders);
      }
      t.caravanT -= 1;
      if (t.caravanT <= 0) {
        t.caravanT = 300 + this.rng() * 260;
        const crew = free.filter((b) => !this.bandOf(b)).slice(0, 3);
        if (crew.length >= 2) this.startCaravan(w, t, crew);
      }
      t.raidT -= 1;
      if (t.raidT <= 0) {
        t.raidT = (calm ? 900 : 480) + this.rng() * 360;
        if (!calm && w.elapsed > 700) this.startRaid(w, t, free);
      }
    }
    if (this.tribes.length < MAX_SAND_TRIBES) {
      this.settleT -= 1;
      if (this.settleT <= 0) {
        this.settleT = 1200 + this.rng() * 900;
        const t = this.settle(w, 1);
        if (t && w.humans.some((h) => dist(h, t) < 900)) w.toast("🏜️", `More Sand People have pitched their tents in the desert: the ${t.name} tribe.`, t.x, t.y);
      }
    }
  }

  private bandOf(b: Brute) {
    return b.band ? this.bands.find((x) => x.id === b.band) ?? null : null;
  }

  /* ------------------------------ bands: raids, patrols, caravans ------------------------------ */

  private newBand(w: World, t: SandTribe, mode: SandBand["mode"], party: Brute[], goal: SandBand["goal"], x: number, y: number, kind: GroupKind) {
    const g = w.groups.make("sand", t.id, kind, party, t.x, t.y);
    if (!g) return null;
    const bd: SandBand = { id: this.nextId(), tribe: t.id, mode, goal, x, y, grp: g.id, t: 0, phase: "go", quiet: 0 };
    this.bands.push(bd);
    for (const b of party) {
      b.band = bd.id;
      b.raid = goal.kind === "town";
    }
    w.groups.moveTo(w, g, x, y, "walk");
    return bd;
  }

  /** A raid on the nearest enemy: our town, a clan, a Tree or Sea camp, or (rarely) a rival Sand tribe. */
  startRaid(w: World, t: SandTribe, free: Brute[]): boolean {
    const goals: { goal: SandBand["goal"]; x: number; y: number; d: number }[] = [];
    let town: { x: number; y: number } | null = null;
    let bd = Infinity;
    const consider = (x: number, y: number) => {
      const d = Math.hypot(x - t.x, y - t.y);
      if (d < bd) {
        bd = d;
        town = { x, y };
      }
    };
    for (const s of w.shelters) consider(s.x, s.y);
    for (const b of w.colony.buildings) consider(b.x, b.y);
    consider(w.camp.pileX, w.camp.pileY);
    if (town && bd < 5200) goals.push({ goal: { kind: "town", id: 0 }, x: (town as { x: number; y: number }).x, y: (town as { x: number; y: number }).y, d: bd * 0.8 });
    for (const c of w.rivals.clans) goals.push({ goal: { kind: "clan", id: c.id }, x: c.x, y: c.y, d: dist(c, t) });
    for (const o of w.forest.tribes) goals.push({ goal: { kind: "tree", id: o.id }, x: o.x, y: o.y, d: dist(o, t) * 1.2 });
    for (const o of w.seaFolk.tribes) goals.push({ goal: { kind: "sea", id: o.id }, x: o.x, y: o.y - 90, d: dist(o, t) * 1.3 });
    for (const o of this.tribes) if (o !== t && this.rng() < 0.25) goals.push({ goal: { kind: "sand", id: o.id }, x: o.x, y: o.y, d: dist(o, t) * 1.5 });
    const near = goals.filter((g) => g.d < 5200).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!near.length) return false;
    const g = near[Math.floor(this.rng() * near.length)];
    const n = Math.min(free.length, 3 + t.tier * 2, 10);
    if (n < 3) return false;
    const party = free.slice().sort((a, b) => (b.mount ? 1 : 0) - (a.mount ? 1 : 0) || dist(a, t) - dist(b, t)).slice(0, n);
    const band = this.newBand(w, t, "raid", party, g.goal, g.x, g.y, n >= 7 ? "war" : "raid");
    if (!band) return false;
    // the tribe's dragon flies with them
    const dr = w.dragons.list.find((d) => d.sandTribe === t.id && d.hp > d.maxHp * 0.4);
    if (dr) {
      const rider = dr.sandRider ? w.rivals.byId(dr.sandRider) : null;
      if (rider) rider.band = band.id;
    }
    if (g.goal.kind === "town" && w.humans.some((h) => dist(h, t) < 2600 || dist(h, g) < 1400)) {
      w.toast("🏜️", `The ${t.name} Sand People are riding out on a raid${dr ? `, with ${dr.name} the Sand Dragon` : ""}! Watch the desert edge: on the sand they're hard to see.`, g.x, g.y);
    }
    return true;
  }

  startPatrol(w: World, t: SandTribe, riders: Brute[], at?: { x: number; y: number }) {
    const pts: { x: number; y: number }[] = [];
    const c = at ?? t;
    for (let k = 0; k < 4; k++) {
      const a = this.rng() * Math.PI * 2;
      const r = t.r * (0.6 + this.rng() * 0.9);
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r * 0.7;
      if (w.nav.passable("dino", x, y)) pts.push({ x, y });
    }
    if (!pts.length) return false;
    const bd = this.newBand(w, t, "patrol", riders, { kind: "point", id: 0 }, pts[0].x, pts[0].y, "patrol");
    if (bd) bd.pts = pts;
    // the tribe's dragon often flies cover over a patrol (by day)
    const dr = bd && w.daylight > 0.35 ? w.dragons.list.find((d) => d.sandTribe === t.id && d.sandRider && d.hp > d.maxHp * 0.5) : null;
    const rider = dr?.sandRider ? w.rivals.byId(dr.sandRider) : null;
    if (bd && rider && !rider.band && this.rng() < 0.6) rider.band = bd.id;
    return !!bd;
  }

  /** Camels + a couple of guards off to the oasis and back (food for the camp). */
  startCaravan(w: World, t: SandTribe, crew: Brute[]) {
    const to = t.water ?? (() => {
      const a = this.rng() * Math.PI * 2;
      return { x: t.x + Math.cos(a) * 1300, y: t.y + Math.sin(a) * 900 };
    })();
    if (!w.nav.passable("dino", to.x, to.y)) return false;
    const bd = this.newBand(w, t, "caravan", crew, { kind: "point", id: 0 }, to.x, to.y, "caravan");
    if (!bd) return false;
    // the pack camels walk with them
    for (const d of w.dinos) if (d.sandTribe === t.id && !d.sandRider && !d.owner && dist(d, t) < 500) {
      d.homeX = to.x + (this.rng() - 0.5) * 80;
      d.homeY = to.y + (this.rng() - 0.5) * 60;
    }
    return true;
  }

  private bandsTick(w: World) {
    for (let i = this.bands.length - 1; i >= 0; i--) {
      const bd = this.bands[i];
      const t = this.tribe(bd.tribe);
      const g = w.groups.get(bd.grp);
      const party = g ? w.groups.members(w, g).filter((b) => b.band === bd.id) : [];
      if (!t || !g || !party.length) {
        for (const b of party) {
          b.band = undefined;
          b.raid = false;
        }
        this.bands.splice(i, 1);
        continue;
      }
      bd.t += 0.5;
      const lead = w.groups.leader(w, g) ?? party[0];
      // the goal moves (a clan camp is fixed, but keep it fresh)
      if (bd.goal.kind === "clan") {
        const c = w.rivals.clan(bd.goal.id);
        if (!c) bd.phase = "home";
      }
      // anything hostile near the group (they're aggressive: no need for a raid to start a fight)
      const foe = this.foeNearAt(w, lead.x, lead.y, bd.mode === "raid" ? 360 : 280, t);
      if (foe) {
        bd.quiet = 0;
        if (bd.phase === "go" && bd.mode !== "raid") bd.phase = "fight";
        for (const b of party) if (b.state !== "fight" && b.hp > 0.35 && !b.onDragon) this.engage(w, b, foe);
        continue;
      }
      bd.quiet += 0.5;
      if (bd.phase === "fight" && bd.quiet > 6) {
        bd.phase = bd.mode === "raid" && dist(lead, bd) > 260 ? "go" : bd.mode === "patrol" ? "go" : "home";
        w.groups.moveTo(w, g, bd.phase === "home" ? t.x : bd.x, bd.phase === "home" ? t.y : bd.y, "walk");
      }
      if (bd.phase === "go") {
        if (dist(lead, bd) < 160) {
          if (bd.mode === "patrol" && bd.pts?.length && bd.t < 220) {
            const nx = bd.pts[(bd.pts.findIndex((p) => p.x === bd.x && p.y === bd.y) + 1) % bd.pts.length];
            bd.x = nx.x;
            bd.y = nx.y;
            w.groups.moveTo(w, g, bd.x, bd.y, "walk");
          } else if (bd.mode === "raid") {
            bd.phase = "fight";
            // reached our stores: grab what they can carry
            if (bd.goal.kind === "town" && dist(lead, { x: w.camp.pileX, y: w.camp.pileY }) < 300) {
              for (const b of party.slice(0, 3)) {
                const got = takeFood(w, 2);
                if (got) {
                  b.loot = got.n;
                  b.lootKind = got.r;
                }
              }
              if (party.some((b) => b.loot)) w.toast("🏜️", `The ${t.name} Sand People raided the stores!`, lead.x, lead.y);
            }
          } else {
            // a caravan at the oasis: water + dates, then home
            if (bd.mode === "caravan") t.food += 3;
            bd.phase = "home";
            w.groups.moveTo(w, g, t.x, t.y, "walk");
          }
        } else if (bd.t % 6 < 0.5) w.groups.moveTo(w, g, bd.x, bd.y, "walk");
      }
      if (bd.phase === "home") {
        if (dist(lead, t) < 200 || bd.t > 400) {
          for (const b of party) {
            if (b.loot) {
              t.food += b.loot;
              b.loot = 0;
            }
            b.band = undefined;
            b.raid = false;
          }
          // the pack camels come home too
          for (const d of w.dinos) if (d.sandTribe === t.id && !d.sandRider && !d.owner) {
            const pen = t.tents.find((x) => x.kind === "pen") ?? t;
            d.homeX = pen.x;
            d.homeY = pen.y;
          }
          this.bands.splice(i, 1);
        } else if (bd.t % 6 < 0.5) w.groups.moveTo(w, g, t.x, t.y, "walk");
      }
      // a raid that's taken a beating goes home
      if (bd.mode === "raid" && bd.phase !== "home" && party.filter((b) => b.hp > 0.35).length < 2) {
        bd.phase = "home";
        w.groups.moveTo(w, g, t.x, t.y, "walk");
      }
      if (bd.t > 600 && bd.phase !== "home") {
        bd.phase = "home";
        w.groups.moveTo(w, g, t.x, t.y, "walk");
      }
    }
  }

  /* ------------------------------ minds ------------------------------ */

  private awake(w: World, b: Brute) {
    if (b.state === "fight" || b.state === "hunt" || b.band) return true;
    return w.inView(b.x, b.y, 500) || w.humans.some((h) => Math.abs(h.x - b.x) < 600 && Math.abs(h.y - b.y) < 600);
  }

  /** Close to one of our awake people (or hit, or striking): they've been seen. */
  private spot(w: World, b: Brute) {
    if (!isSandTile(w.terrain.tileAt(b.x, b.y))) return;
    for (const h of w.humans) {
      if (h.state === "sleep" || h.under || h.captive) continue;
      if (Math.abs(h.x - b.x) < SPOT_R && Math.abs(h.y - b.y) < SPOT_R && dist(h, b) < SPOT_R) {
        b.spotT = 3;
        return;
      }
    }
  }

  private think(w: World, b: Brute) {
    const t = this.tribe(b.sand);
    const active = this.awake(w, b);
    b.think = active ? 0.35 + this.rng() * 0.3 : 2 + this.rng() * 1.5;
    if (active) this.spot(w, b);
    if (!t) {
      // camp gone: they drift off into the deep desert
      if (b.state !== "walk") setB(b, "walk", b.x + (this.rng() - 0.5) * 900, b.y + (this.rng() - 0.5) * 600);
      return;
    }
    if (b.state === "dart") return;
    if ((b.age ?? SAND_GROWN) < SAND_GROWN) {
      if (dist(b, t) > 160 || b.state === "fight") setB(b, "home", t.x + (this.rng() - 0.5) * 60, t.y + 20);
      else if (w.daylight < 0.3 && b.state !== "sleep") setB(b, "sleep", b.x, b.y);
      return;
    }
    if (b.hp < 0.3 && b.state !== "flee") {
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      say(b, pick(this.rng, ["Back to the tents!", "The sand hides me!", "Aiee!"]), 1.2);
      return;
    }
    if (b.state === "flee") return;
    if (b.state === "fight" || b.state === "hunt") {
      const f = this.foeById(w, b.targetId);
      if (f && b.stateT < 40 && (!b.band || dist(b, foeXY(f)) < 700)) return;
      setB(b, "idle", b.x, b.y);
    }
    // a band's member: the band tick moves the group; meanwhile they lash out at anything close
    if (b.band) {
      const f = this.foeNear(w, b, 220, t);
      if (f) this.engage(w, b, f);
      return;
    }
    // anyone at the camp, or one of ours out alone in their desert: they attack
    const foe = this.foeNear(w, b, dist(b, t) < t.r ? 320 : 240, t);
    if (foe) return this.engage(w, b, foe);
    if (w.daylight < 0.3) {
      if (b.state !== "sleep") {
        const tent = t.tents.filter((x) => x.kind === "tent" || x.kind === "bigTent")[b.id % Math.max(1, t.tents.length)] ?? t;
        if (dist(b, tent) < 30) setB(b, "sleep", b.x, b.y);
        else setB(b, "home", tent.x + (this.rng() - 0.5) * 20, tent.y + 14);
      }
      return;
    }
    if (b.state === "sleep") setB(b, "idle", b.x, b.y);
    const busy = (b.state === "idle" && b.stateT < 8) || ((b.state === "walk" || b.state === "wander" || b.state === "home") && b.stateT < 40);
    if (busy) return;
    b.stateT = 0;
    // everyday camp life, done together: their group's leader picks the spot, the rest gather round it
    const r = this.rng();
    if (r < 0.45) {
      const spot = w.groups.spot(w, b, () => this.campSpot(w, t, t.r * 0.55));
      if (spot) setB(b, "wander", spot.x, spot.y);
    } else if (r < 0.7) {
      const fire = t.tents.find((x) => x.kind === "fire") ?? t;
      setB(b, "idle", fire.x + (this.rng() - 0.5) * 70, fire.y + (this.rng() - 0.5) * 30);
    } else if (r < 0.85) {
      const pen = t.tents.find((x) => x.kind === "pen") ?? t;
      setB(b, "wander", pen.x + (this.rng() - 0.5) * 60, pen.y + 26);
    } else setB(b, "idle", t.x + (this.rng() - 0.5) * 120, t.y + 30 + this.rng() * 30);
    if (this.rng() < 0.04) say(b, pick(this.rng, ["The wind turns.", "Hot today.", "*hums a dune song*", "Water, then raid.", "Quiet as sand."]), 1.4);
  }

  private campSpot(w: World, t: SandTribe, r: number) {
    for (let k = 0; k < 10; k++) {
      const a = this.rng() * Math.PI * 2;
      const d = 60 + this.rng() * (r - 60);
      const x = t.x + Math.cos(a) * d;
      const y = t.y + Math.sin(a) * d * 0.7;
      if (w.nav.passable("dino", x, y)) return { x, y };
    }
    return null;
  }

  engage(w: World, b: Brute, foe: Foe) {
    const p = foeXY(foe);
    b.targetId = foeId(foe);
    setB(b, foe.kind === "dino" ? "hunt" : "fight", p.x, p.y);
  }

  /** Nearest foe: our people (not when the world's calm), Neanderthals, Tree + Sea People, a rival Sand tribe at war. */
  private foeNear(w: World, b: Brute, r: number, t: SandTribe): Foe | null {
    return this.foeNearAt(w, b.x, b.y, r, t);
  }

  private foeNearAt(w: World, x: number, y: number, r: number, t: SandTribe): Foe | null {
    let best: Foe | null = null;
    let bd = r;
    if (w.tribe.danger !== "calm") {
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
      if (o.hp <= 0 || o.captive || o.snatched || o.falling || o.onDragon || o.weapon === "catapult") continue;
      if (o.sand === t.id) continue;
      if (o.tree && o.hidden) continue;
      if (o.sea && o.boat) continue;
      // another Sand tribe: only a raid on them makes them enemies (they don't brawl at every meeting)
      if (o.sand && !this.bands.some((bd2) => bd2.tribe === t.id && bd2.goal.kind === "sand" && bd2.goal.id === o.sand)) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) {
        bd = d;
        best = { kind: "brute", b: o };
      }
    }
    return best;
  }

  private foeById(w: World, id: number): Foe | null {
    if (!id) return null;
    const h = w.humans.find((o) => o.id === id);
    if (h) return fairGame(h) ? { kind: "human", h } : null;
    const d = w.dinoById(id);
    if (d) return d.health > 0 && d.state !== "carried" ? { kind: "dino", d } : null;
    const o = w.rivals.byId(id);
    return o && o.hp > 0 && !o.captive && !o.snatched && !o.falling && !o.onDragon ? { kind: "brute", b: o } : null;
  }

  /* ------------------------------ bodies ------------------------------ */

  private act(w: World, b: Brute, dt: number) {
    const t = this.tribe(b.sand);
    const quick = b.state === "fight" || b.state === "hunt" || b.state === "dart" || !!b.band || w.inView(b.x, b.y, 300);
    const pace = b.mount ? CAMEL_SPEED : SPEED;
    switch (b.state) {
      case "idle":
      case "rally": {
        b.vx = b.vy = 0;
        if (Math.hypot(b.tx - b.x, b.ty - b.y) > 6) this.move(w, b, dt, pace * 0.6, quick);
        if (t && dist(b, t) < 160) b.hp = Math.min(1, b.hp + dt * 0.008);
        return;
      }
      case "sleep": {
        b.vx = b.vy = 0;
        if (t && dist(b, t) < 260) b.hp = Math.min(1, b.hp + dt * 0.02);
        return;
      }
      case "walk":
      case "wander":
      case "home":
      case "flee": {
        const fast = b.state === "flee" || (b.state === "walk" && !!b.band);
        if (this.move(w, b, dt, pace * (fast ? 1.35 : b.state === "wander" ? 0.7 : 1), quick)) {
          if ((b.state === "home" || b.state === "flee") && t && dist(b, t) < 140 && !b.band) {
            if (b.loot) {
              t.food += b.loot;
              b.loot = 0;
            }
          }
          setB(b, "idle", b.x, b.y);
          b.think = Math.min(b.think, 0.2);
        }
        return;
      }
      case "dart": {
        if (this.move(w, b, dt, pace * 1.5, true) || b.stateT > 1.2) {
          setB(b, "fight", b.x, b.y);
          b.think = 0;
        }
        return;
      }
      case "fight":
      case "hunt": {
        const f = this.foeById(w, b.targetId);
        if (!f || b.stateT > 40) {
          setB(b, "idle", b.x, b.y);
          b.think = 0;
          return;
        }
        const p = foeXY(f);
        const d = dist(b, p);
        const arms = ARMS[b.sandRole ?? "fighter"];
        const reach = REACH + (b.mount ? 10 : 0) + (f.kind === "dino" ? sizeOf(f.d) * 0.3 : 0);
        // archers + slingers + mounted spearmen keep their distance and shoot
        if (b.cd <= 0 && arms.range && d < arms.range && d > 60) {
          this.throwAt(w, b, f);
          return;
        }
        if (arms.range && d < arms.range * 0.75 && d > 60 && !b.mount) {
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
            this.strike(w, b, f, b.mount ? 1.3 : 1);
            if (b.hp <= 0) return;
            // camel riders charge through and wheel round for another pass
            if (b.mount || this.rng() < 0.25) {
              const a = Math.atan2(b.y - p.y, b.x - p.x) + (this.rng() - 0.5) * 1.4;
              setB(b, "dart", b.x + Math.cos(a) * (b.mount ? 140 : 80), b.y + Math.sin(a) * (b.mount ? 100 : 60));
            }
          }
          return;
        }
        let gx = p.x;
        let gy = p.y;
        if (d > 50) {
          const a = Math.atan2(b.y - p.y, b.x - p.x) + (b.flank ?? 1) * 0.8;
          gx = p.x + Math.cos(a) * 24;
          gy = p.y + Math.sin(a) * 18;
        }
        if (Math.hypot(b.tx - gx, b.ty - gy) > 24) {
          b.tx = gx;
          b.ty = gy;
        }
        this.move(w, b, dt, pace * (d < 160 ? 1.6 : 1.4), true);
        return;
      }
    }
    b.vx = b.vy = 0;
  }

  /** Walk / ride: proper paths when someone could see, a straight line across the open sand when not. */
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

  private strike(w: World, b: Brute, f: Foe, mul: number) {
    const arms = ARMS[b.sandRole ?? "fighter"];
    // out of the dunes, unseen: the first blow lands hard
    if (!this.seen(w, b)) mul *= 1.35;
    b.spotT = 4;
    w.sfx("whoosh", b.x, b.y, 0.4, 1.1);
    if (f.kind === "human") hurtHuman(w, f.h, arms.hit * mul, b.x, b.y, "bite");
    else if (f.kind === "brute") w.rivals.hit(w, f.b, arms.hit * mul * 0.9, b.x, b.y, true);
    else hitDino(w, f.d, 24 * mul, b.x, b.y);
  }

  private throwAt(w: World, b: Brute, f: Foe) {
    const arms = ARMS[b.sandRole ?? "fighter"];
    b.spotT = 3;
    const p = foeXY(f);
    b.cd = 2 + this.rng() * 0.9;
    b.dir = p.x > b.x ? 1 : -1;
    b.anim = 0;
    const d = dist(b, p);
    const kind = arms.missile;
    const flight = Math.max(0.25, d / (kind === "arrow" ? 430 : 270));
    const miss = kind === "arrow" ? 20 : 28;
    const tx = p.x + (this.rng() - 0.5) * miss;
    const ty = p.y + (this.rng() - 0.5) * miss * 0.6;
    const sz = b.z + 24;
    const tz = 12;
    w.rivals.missiles.push({ x: b.x, y: b.y, z: sz, vx: (tx - b.x) / flight, vy: (ty - b.y) / flight, vz: (tz - sz) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target: f.kind === "human" ? f.h.id : 0, dmg: arms.throw, kind });
    if (f.kind === "brute") w.rivals.hit(w, f.b, arms.throw, b.x, b.y, true);
    else if (f.kind === "dino") hitDino(w, f.d, 14, b.x, b.y);
    w.sfx("whoosh", b.x, b.y, 0.45, kind === "arrow" ? 1.6 : 1);
  }

  /* ------------------------------ Sand Dragons ------------------------------ */

  /**
   * A Sand Dragon's brain (from Dragons.update instead of the wild dragon's). It flies with the same
   * flight as every other dragon (dragonKeep's flyToward + landAt: climbing out, cruising, clearing the
   * mountains, flaring to land), through clear states:
   *   perch (folded wings at the roost; "sleep" at night) → fly (taking off: a climb on the spot) →
   *   circle (over its band, or a sky patrol round the tribe's land) / strafe (attack runs) →
   *   home (back to the roost, or to its rider when they've been knocked off) → land → perch.
   */
  dragonStep(w: World, dr: Dragon, dt: number) {
    dr.t += dt;
    dr.hit = Math.max(0, dr.hit - dt * 3);
    dr.breath = Math.max(0, dr.breath - dt * 2);
    dr.fireCd = Math.max(0, (dr.fireCd ?? 0) - dt);
    if (dr.hp < dr.maxHp) dr.hp = Math.min(dr.maxHp, dr.hp + dt * dr.maxHp * 0.002);
    // (the shared flight helpers need it to know how to fly)
    if (!dr.skills?.flight) dr.skills = { ...(dr.skills ?? {}), flight: 1 };
    const t = this.tribe(dr.sandTribe);
    let rider = dr.sandRider ? w.rivals.byId(dr.sandRider) : null;
    if (rider && rider.onDragon !== dr.id) {
      dr.sandRider = undefined;
      rider = null;
    }
    if (!t) {
      // its people are gone: off it flies, over the dunes and away
      dr.state = "leave";
      flyToward(w, dr, dr.x + 3000, dr.y - 2000, 300, dt);
      if (dr.x >= WORLD_W - 90 || dr.y <= 90) w.dragons.list.splice(w.dragons.list.indexOf(dr), 1);
      return;
    }
    // a Dragon Shield's hum drives it off (dragonShield.ts): it flies away rattled, it isn't hurt
    if (repelStep(w, dr, dt)) return this.saddle(dr, rider, dt);
    const roost = t.tents.find((x) => x.kind === "roost") ?? t;
    // a band whose job is over leaves its rider with a stale tag: let it go
    if (rider?.band && !this.bands.some((x) => x.id === rider!.band)) rider.band = undefined;
    const band = rider?.band ? this.bands.find((x) => x.id === rider!.band) : null;
    const grp = band ? w.groups.get(band.grp) : null;
    const lead = grp ? w.groups.leader(w, grp) : null;
    const hurt = dr.hp < dr.maxHp * 0.3;
    const night = w.daylight < 0.28;
    // something to fight: near the dragon, its band, or its camp
    const watch = lead ?? (dist(dr, t) < t.r * 1.2 || (dr.passes ?? 0) > 0 ? dr : null);
    const foe = !hurt && watch ? this.foeNearAt(w, watch.x, watch.y, 460, t) : null;
    // its rider was knocked off: it goes back for them (a dragon-rider on foot, not too far off)
    const lost = !rider && !hurt ? this.members(t.id).find((b) => b.sandRole === "dragon" && !b.onDragon && b.hp > 0.35 && !b.captive && !b.snatched && dist(b, dr) < 1800) ?? null : null;
    // a sky patrol over the tribe's land now and then (by day): `skyT` counts down to the next, `passes` is the time left on one
    dr.skyT = (dr.skyT ?? 40 + this.rng() * 60) - (dr.z < 6 ? dt : 0);
    if (dr.skyT <= 0 && !night && !hurt && dr.hp > dr.maxHp * 0.6 && !lead && !foe) {
      dr.skyT = 90 + this.rng() * 80;
      dr.passes = 40 + this.rng() * 25;
    }
    if (dr.passes) dr.passes = Math.max(0, dr.passes - dt);
    const airborne = !!foe || (!!lead && !hurt) || (!!dr.passes && !night);
    // taking off: a short climb on the spot, wings beating hard, before it sets off anywhere
    if (airborne && dr.z < 30 && (dr.state === "perch" || dr.state === "sleep" || dr.state === "land" || dr.state === "idle")) {
      dr.state = "fly";
      dr.t = 0;
      w.particles.burst(P.Dust, dr.x, dr.y, 10, 70, { size: 12, max: 0.9, color: "rgba(214,184,128,0.7)" });
      w.sfx("whoosh", dr.x, dr.y, 0.7, 0.6);
    }
    if (dr.state === "fly" && dr.t < 1.3 && airborne) {
      flyToward(w, dr, dr.x + dr.dir * 40, dr.y - 10, 160, dt, 0.35);
      return this.saddle(dr, rider, dt);
    }
    if (foe) {
      const p = foeXY(foe);
      const d = dist(dr, p);
      dr.state = "strafe";
      // strafing runs: dive past low, breathing hot sand, climb, come round again
      const pass = dr.t % 7;
      const out = pass > 4.5;
      const a = Math.atan2(dr.y - p.y, dr.x - p.x);
      const gx = out ? p.x + Math.cos(a) * 280 : p.x - Math.cos(a) * 60;
      const gy = out ? p.y + Math.sin(a) * 200 : p.y - Math.sin(a) * 40;
      flyToward(w, dr, gx, gy, out ? 170 : 70, dt, 1.1);
      if (!out && d < 220 && !(dr.fireCd ?? 0)) {
        dr.fireCd = 0.35;
        dr.breath = 1;
        dr.fireAt = undefined;
        breathBlast(w, dr, p.x + (this.rng() - 0.5) * 30, p.y + (this.rng() - 0.5) * 20, "sand", 1);
        if (rider) rider.spotT = 4;
      }
      if (foe.kind === "human" && !w.flags.has("sandDragonSeen")) {
        w.flags.add("sandDragonSeen");
        w.toast("🏜️", `A Sand Dragon Rider! ${dr.name} blasts super-heated sand: the ground glows hot where it lands, then cools back to plain sand. Keep out of the glowing patches!`, p.x, p.y);
        w.discover("sandDragon", p.x, p.y);
      }
    } else if (lead && !hurt) {
      // flying cover over its band
      dr.state = "circle";
      const a = dr.t * 0.6 + dr.id;
      flyToward(w, dr, lead.x + Math.cos(a) * 120, lead.y + Math.sin(a) * 80, 160, dt, 0.9);
    } else if (dr.passes && !night && !hurt) {
      // a sky patrol: wide circles high over the tribe's land
      dr.state = "circle";
      const a = dr.t * 0.32 + dr.id;
      flyToward(w, dr, t.x + Math.cos(a) * t.r * 0.95, t.y + Math.sin(a) * t.r * 0.7, 190, dt, 0.8);
    } else if (lost) {
      // back for its rider: down beside them, and they climb on
      dr.state = dr.z > 6 ? "home" : "land";
      if (landAt(w, dr, lost.x + 34, lost.y + 4, dt)) {
        dr.state = "perch";
        if (dist(dr, lost) < 70) {
          this.boardDragon(lost, dr);
          setB(lost, "idle", lost.x, lost.y);
          say(lost, pick(this.rng, ["Up we go!", "Good dragon!", "Back in the saddle!"]), 1.4);
        } else if (lost.state !== "walk") setB(lost, "walk", dr.x - 20, dr.y);
      }
    } else {
      // home to the roost to rest (night, hurt, or nothing on): land, fold the wings, sleep at night
      const d = dist(dr, roost);
      if (d > 30 || dr.z > 2) {
        dr.state = dr.z > 40 || d > 160 ? "home" : "land";
        landAt(w, dr, roost.x, roost.y, dt);
      } else {
        dr.state = night ? "sleep" : "perch";
        dr.z = 0;
        dr.vx = dr.vy = 0;
        dr.bank = 0;
        dr.anim += dt * 0.6;
        if (!night && w.rng() < dt * 0.1) dr.dir = dr.dir === 1 ? -1 : 1;
      }
    }
    this.saddle(dr, rider, dt);
  }

  /** The rider sits in the saddle, wherever the dragon goes. */
  private saddle(dr: Dragon, rider: Brute | null, dt: number) {
    if (!rider || rider.onDragon !== dr.id) return;
    const s = BREEDS.sand.size * (1 + (dr.vet ?? 0));
    rider.x = dr.x - dr.dir * 3 * s;
    rider.y = dr.y + 0.5;
    rider.z = dr.z + 32 * s;
    rider.dir = dr.dir;
    rider.anim += dt;
    rider.vx = dr.vx;
    rider.vy = dr.vy;
  }

  /* ------------------------------ getting hurt ------------------------------ */

  hit(w: World, b: Brute, dmg: number, fx: number, fy: number, byBrute = false, proj?: string) {
    b.spotT = 5;
    b.hp -= byBrute ? dmg * 0.85 : dmg / SAND_TOUGH;
    w.particles.burst(P.Dust, b.x, b.y, 3, 30, { z: 20, size: 5, max: 0.5, color: "rgba(214,184,128,0.8)" });
    w.sfx("thunk", b.x, b.y, 0.6, 1);
    if (b.hp <= 0) return w.rivals.kill(w, b);
    if (this.rng() < 0.35) say(b, pick(this.rng, ["Ha!", "Dust and bones!", "You'll pay!", "Ngh!"]), 1.2);
    const t = this.tribe(b.sand);
    if (!t) return;
    if (b.hp < 0.3 && !b.onDragon) {
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      return;
    }
    if (b.onDragon || b.state === "fight" || b.state === "dart" || (b.age ?? SAND_GROWN) < SAND_GROWN || proj === "dragon" || proj === "fire") return;
    let foe: Foe | null = null;
    if (byBrute) {
      const o = w.rivals.brutes.find((x) => x.sand !== b.sand && x.hp > 0 && Math.hypot(x.x - fx, x.y - fy) < 70);
      if (o) foe = { kind: "brute", b: o };
    } else {
      let bd = 340;
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
    this.engage(w, b, foe);
    // the whole group turns on whoever hurt one of them
    const f = foe;
    w.groups.rally(w, b, (m) => this.engage(w, m, f));
  }

  /** From Rivals.kill (already out of the list). */
  died(w: World, b: Brute) {
    if (b.mount) this.dismount(w, b);
    w.particles.burst(P.Dust, b.x, b.y, 8, 60, { size: 9, max: 1, color: "rgba(214,184,128,0.85)" });
    w.addItem(b.weapon === "bow" ? "stick" : b.weapon === "sling" ? "stone" : "stick", b.x - 8, b.y + 2);
    if (this.rng() < 0.3) w.addItem("bones", b.x + 4, b.y + 6);
    if (b.loot) w.camp.stock[b.lootKind ?? "berries"] += b.loot;
    const l = this.index.get(b.sand ?? 0);
    if (l) {
      const i = l.indexOf(b);
      if (i >= 0) l.splice(i, 1);
    }
    const near = w.humans.some((h) => !h.captive && dist(h, b) < 600);
    if (near && w.elapsed - this.toastAt > 8) {
      this.toastAt = w.elapsed;
      w.toast("💀", `${this.label(b)} is down!`, b.x, b.y);
    }
    w.sfx("thud", b.x, b.y, 0.6, 1);
  }

  /* ------------------------------ save ------------------------------ */

  clear(w: World) {
    w.rivals.brutes = w.rivals.brutes.filter((b) => !b.sand);
    w.dragons.list = w.dragons.list.filter((d) => !d.sandTribe);
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
      tribes: this.tribes.map((t) => ({ ...t, food: Math.round(t.food * 10) / 10, growT: r(t.growT), raidT: r(t.raidT), patrolT: r(t.patrolT), caravanT: r(t.caravanT), tents: t.tents.map((x) => ({ ...x })) })),
      folk: this.folk(w).filter((b) => this.tribe(b.sand)).map((b) => ({ sand: b.sand!, role: b.sandRole ?? "fighter", name: b.name, x: r(b.x), y: r(b.y), hp: Math.round(b.hp * 100) / 100, age: r(b.age ?? SAND_GROWN), tint: b.tint, grp: b.grp, mount: b.mount, dragon: b.onDragon })),
      dragons: w.dragons.list.filter((d) => d.sandTribe && this.tribe(d.sandTribe)).map((d) => ({ id: d.id, name: d.name, x: r(d.x), y: r(d.y), hp: r(d.hp), tribe: d.sandTribe! })),
    };
  }

  /** After Rivals.load (which wipes every brute) and Dragons.load (which only keeps nesting dragons). */
  load(w: World, d: ReturnType<SandFolk["serialize"]> | undefined) {
    this.clear(w);
    this.enabled = true;
    if (!d) return;
    this.started = !!d.started;
    this.ids = Math.max(6e8, d.ids ?? 6e8);
    this.nextTribe = d.next ?? 1;
    this.settleT = d.settleT ?? 900;
    for (const t of d.tribes ?? []) this.tribes.push({ ...t, tents: t.tents.map((x) => ({ ...x })) });
    for (const s of d.dragons ?? []) {
      const t = this.tribe(s.tribe);
      if (!t) continue;
      const roost = t.tents.find((x) => x.kind === "roost") ?? t;
      const dr = this.dragon(w, t, roost);
      if (!dr) continue;
      Object.assign(dr, { id: s.id, name: s.name, x: s.x, y: s.y, hp: s.hp });
    }
    for (const f of d.folk ?? []) {
      const t = this.tribe(f.sand);
      if (!t) continue;
      const b = this.add(w, t, f.x, f.y, f.role as Role, { name: f.name, hp: f.hp, age: f.age, tint: f.tint ?? t.color, grp: f.grp });
      const camel = this.dinoOf(w, f.mount);
      if (camel && camel.species === "camel") this.mountUp(w, b, camel);
      const dr = f.dragon ? w.dragons.list.find((x) => x.id === f.dragon) : null;
      if (dr) this.boardDragon(b, dr);
    }
    this.reindex(w);
  }
}
