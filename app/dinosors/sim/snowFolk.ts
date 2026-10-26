/* ------------------------------------------------------------------ */
/*  Snow People: hunters of the snowy Great Peaks.                     */
/*                                                                     */
/*  • Camps high on the snowfields + rock shelves (well away from the  */
/*    Mountain Monks): ice-block igloos round a big hide longhouse,    */
/*    hide yurts, a Frosthorn pen, a fire pit, a drying rack with      */
/*    meat + hides on it, and an ice-crowned totem.                    */
/*  • Hunters (spears), archers, ice-axe warriors, Frosthorn riders    */
/*    (the shaggy horned snow dinosaurs) and a frost-caller whose      */
/*    stones chill + slow. All in furs, hoods and bone snow goggles.   */
/*  • Territorial, not hateful: they fight anyone who comes into their */
/*    land (our people, the clans, the Tree + Sea People), and they're */
/*    old enemies of the Sand People, but they leave travellers alone  */
/*    elsewhere. Hurt one of them (or raid them) and they hold a       */
/*    grudge against our town for a while; now and then (never in a    */
/*    calm world) a war band comes down raiding. The monks are holy to */
/*    everyone: never a target. Their archers shoot at dragons that    */
/*    come low over the camp.                                          */
/*  • They live by the hunt: hunting parties go out after the peaks'   */
/*    animals (Rimeclaws, Frosthorns, Glacierbacks, snow leopards),    */
/*    never the Yeti or the Snow Rex unless they're cornered.          */
/*  • Groups like the other peoples (folkGroups.ts): families, patrols */
/*    of riders, hunting parties and war bands, never one by one.      */
/*                                                                     */
/*  Every Snow Person is a Brute (clan 0, `snow` = their tribe) in     */
/*  w.rivals.brutes, so the shared fighting rules (our guards, the     */
/*  Scorpions, war dinos, dragons, the other peoples) apply to them.   */
/*  Own dice + ids (7e8 up) so the rest of the world plays out the     */
/*  same without them. Cheap: a band tick twice a second, a slow tick  */
/*  once a second, and folk nobody's near think every few seconds.     */
/* ------------------------------------------------------------------ */
import { addDino, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { LM, REGION, isWalkTile, isWaterTile } from "./terrain";
import { hitDino } from "./tribe";
import { MAP_W, T, TILE, type Brute, type BruteWeapon, type Dino, type Human } from "./types";
import type { World } from "./world";
import { moveBrute, say, setB } from "./rivals";
import { fairGame, takeFood } from "./treeFolk";
import { foundingGroups, type FolkGroup, type GroupKind } from "./folkGroups";

/** Our hits are divided by this (Neanderthals take 150, Sand People 105). */
export const SNOW_TOUGH = 120;
const SPEED = 42;
const MOUNT_SPEED = 72;
const REACH = 22;
/** Seconds for a youngster to grow into a hunter. */
export const SNOW_GROWN = 120;
export const MAX_SNOW_TRIBES = 2;
const MAX_FOLK = 34;
/** They show up a little after the Sand People. */
const START_AT = 330;
/** A Snow camp never pitches nearer our town than this (px)… */
export const SNOW_MIN = 1500;
/** …nor nearer the monks' valley + their altar (px). */
const HOLY_CLEAR = 700;
/** How long they stay at odds with our town after we've hurt one of them (s). */
const GRUDGE = 300;
const TRIBE_NAMES = ["White Bear", "Frost Fang", "Ice Wolf", "Long Winter", "High Wind", "Blue Glacier", "Silent Snow", "Star Peak"];
const FOLK_NAMES = ["Aput", "Siku", "Nanuq", "Tulu", "Kesi", "Ivalu", "Amka", "Pana", "Uki", "Taqi", "Oki", "Sila", "Anu", "Ilik", "Miki", "Nuka", "Tavi", "Yuka", "Kallu", "Ruun", "Asiq", "Pilu"];
/** trim + banner colours (their furs are always white + grey) */
const PAINTS = ["#2e86c1", "#c0392b", "#7d3c98", "#117a65", "#d35400", "#1b4f72"];
type Role = NonNullable<Brute["snowRole"]>;
const ARMS: Record<Role, { weapon: BruteWeapon; hit: number; throw: number; range: number; missile: "spear" | "rock" | "sling" | "arrow" }> = {
  hunter: { weapon: "spear", hit: 0.22, throw: 0.16, range: 200, missile: "spear" },
  archer: { weapon: "bow", hit: 0.1, throw: 0.17, range: 300, missile: "arrow" },
  warrior: { weapon: "axe", hit: 0.29, throw: 0, range: 0, missile: "rock" },
  rider: { weapon: "spear", hit: 0.26, throw: 0.15, range: 170, missile: "spear" },
  shaman: { weapon: "sling", hit: 0.1, throw: 0.13, range: 250, missile: "sling" },
};
export const SNOW_ROLE_NAMES: Record<Role, string> = { hunter: "Snow Hunter", archer: "Snow Archer", warrior: "Ice-axe Warrior", rider: "Frosthorn Rider", shaman: "Frost-caller" };

export interface SnowLodge {
  x: number;
  y: number;
  kind: "lodge" | "igloo" | "yurt" | "pen" | "fire" | "rack" | "totem";
  hp: number;
}

export interface SnowTribe {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  r: number;
  tier: number;
  food: number;
  growT: number;
  huntT: number;
  patrolT: number;
  raidT: number;
  /** seconds left at odds with our town (we hurt one of them, or raided them) */
  grudge: number;
  lodges: SnowLodge[];
  found?: boolean;
  seen?: boolean;
}

export interface SnowBand {
  id: number;
  tribe: number;
  mode: "hunt" | "patrol" | "raid";
  goal: { kind: "town" | "clan" | "sand" | "beast" | "point"; id: number };
  x: number;
  y: number;
  grp: number;
  t: number;
  phase: "go" | "fight" | "home";
  pts?: { x: number; y: number }[];
  quiet: number;
}

type Foe = { kind: "human"; h: Human } | { kind: "brute"; b: Brute } | { kind: "dino"; d: Dino };
const foeXY = (f: Foe) => (f.kind === "human" ? f.h : f.kind === "brute" ? f.b : f.d);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** game the hunters go after (never the legends) */
const QUARRY = new Set(["rimeclaw", "frosthorn", "glacierback", "snowLeopard", "camel", "trike", "para", "pachy", "iguano"]);

export class SnowFolk {
  tribes: SnowTribe[] = [];
  bands: SnowBand[] = [];
  started = false;
  /** off in bare test worlds; on in every real game, new or loaded */
  enabled = true;
  rng: Rng;
  private ids = 7e8;
  private nextTribe = 1;
  private settleT = 1100;
  private tickT = 0;
  private bandT = 0;
  private toastAt = -999;
  private index = new Map<number, Brute[]>();

  constructor(seed = 1) {
    this.rng = makeRng(seed * 67 + 29);
  }

  tribe(id: number | undefined) {
    return id ? this.tribes.find((t) => t.id === id) ?? null : null;
  }
  members(id: number) {
    return this.index.get(id) ?? [];
  }
  folk(w: World) {
    return w.rivals.brutes.filter((b) => !!b.snow);
  }
  label(b: Brute) {
    const t = this.tribe(b.snow);
    return `${b.name}, ${SNOW_ROLE_NAMES[b.snowRole ?? "hunter"]} of the ${t?.name ?? "Snow"} People`;
  }
  campAt(x: number, y: number, r = 200) {
    return this.tribes.find((t) => Math.hypot(t.x - x, t.y - y) < r) ?? null;
  }
  private nextId() {
    return this.ids++;
  }
  private reindex(w: World) {
    this.index.clear();
    for (const b of w.rivals.brutes) {
      if (!b.snow) continue;
      const l = this.index.get(b.snow);
      if (l) l.push(b);
      else this.index.set(b.snow, [b]);
    }
  }

  /** Are they at odds with our town right now (so our guards + Scorpions shoot)? Otherwise they're neighbours. */
  hostileToUs(w: World, b: Brute) {
    const t = this.tribe(b.snow);
    if (!t) return true;
    if (t.grudge > 0 || b.raid) return true;
    // fighting one of ours (they came into the Snow People's land)
    if ((b.state === "fight" || b.state === "hunt") && w.humans.some((h) => h.id === b.targetId)) return true;
    return false;
  }

  /* ------------------------------ per frame ------------------------------ */

  update(w: World, dt: number) {
    if (!this.enabled) return;
    if (!this.started) {
      if (w.rivals.started && w.elapsed > START_AT && w.humans.length) {
        this.started = true;
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

  /** One Snow Person, every frame (from Rivals.update). */
  step(w: World, b: Brute, dt: number) {
    if ((b.spotT ?? 0) > 0) b.spotT = Math.max(0, (b.spotT ?? 0) - dt);
    b.think -= dt;
    if (b.think <= 0) this.think(w, b);
    this.act(w, b, dt);
    if (b.mount) this.ride(w, b);
  }

  /* ------------------------------ camps ------------------------------ */

  private site(w: World, minFromUs = SNOW_MIN): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bs = -Infinity;
    for (let k = 0; k < 260; k++) {
      const x = (216 + this.rng() * 64) * TILE;
      const y = (8 + this.rng() * 40) * TILE;
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
    const i = ty * MAP_W + tx;
    if (w.terrain.region[i] !== REGION.peaks) return -Infinity;
    const t = w.terrain.tileAt(x, y);
    if (!isWalkTile(t) || isWaterTile(t) || t === T.Ice || !w.nav.passable("dino", x, y)) return -Infinity;
    if (Math.hypot(x - w.camp.x, y - w.camp.y) < minFromUs) return -Infinity;
    // the monks' valley + the dragon altar are holy ground: nobody camps there
    if (Math.hypot(x - (LM.monastery.x + 0.5) * TILE, y - (LM.monastery.y + 0.5) * TILE) < HOLY_CLEAR) return -Infinity;
    if (Math.hypot(x - (LM.altar.x + 0.5) * TILE, y - (LM.altar.y + 0.5) * TILE) < HOLY_CLEAR * 0.8) return -Infinity;
    if (this.tribes.some((o) => dist(o, { x, y }) < 1000)) return -Infinity;
    if (w.rivals.clans.some((c) => dist(c, { x, y }) < 900)) return -Infinity;
    if (w.dragons.nests.some((n) => dist(n, { x, y }) < 650)) return -Infinity;
    // room for the lodges: mostly open snow / rock round about
    let open = 0;
    let cold = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const px = x + Math.cos(a) * 110;
      const py = y + Math.sin(a) * 80;
      const pt = w.terrain.tileAt(px, py);
      if (isWalkTile(pt) && !isWaterTile(pt)) open++;
      if (pt === T.Snow || pt === T.Ice || pt === T.Rock) cold++;
    }
    if (open < 6 || cold < 3) return -Infinity;
    return open * 6 + cold * 12 + (w.terrain.elev[i] > 0.45 && w.terrain.elev[i] < 0.78 ? 40 : 0) + this.rng() * 50;
  }

  /** A new tribe pitches its lodges. */
  settle(w: World, tier = 1, at?: { x: number; y: number }): SnowTribe | null {
    const spot = at ?? this.site(w);
    if (!spot) return null;
    const used = new Set(this.tribes.map((t) => t.name));
    const names = TRIBE_NAMES.filter((n) => !used.has(n));
    const worn = new Set(this.tribes.map((t) => t.color));
    const paints = PAINTS.filter((c) => !worn.has(c));
    const t: SnowTribe = {
      id: this.nextTribe++,
      name: pick(this.rng, names.length ? names : TRIBE_NAMES),
      color: pick(this.rng, paints.length ? paints : PAINTS),
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      r: 540 + tier * 70,
      tier,
      food: 8,
      growT: 70 + this.rng() * 40,
      huntT: 60 + this.rng() * 60,
      patrolT: 50 + this.rng() * 60,
      raidT: 900 + this.rng() * 500,
      grudge: 0,
      lodges: [],
    };
    this.pitch(w, t);
    this.tribes.push(t);
    const roles: Role[] = ["hunter", "hunter", "archer", "archer", "warrior", "warrior", "rider", "rider", "shaman"];
    const folk: Brute[] = [];
    for (const role of roles) folk.push(this.add(w, t, t.x + (this.rng() - 0.5) * 140, t.y + 20 + (this.rng() - 0.5) * 70, role));
    for (let i = 0; i < 2; i++) folk.push(this.add(w, t, t.x + (this.rng() - 0.5) * 60, t.y + 18, "hunter", { age: this.rng() * 70 }));
    // their Frosthorns: one for each rider, and a pack beast at the pen
    const pen = t.lodges.find((x) => x.kind === "pen") ?? t;
    for (const b of folk.filter((f) => f.snowRole === "rider")) {
      const d = this.frosthorn(w, t, pen);
      if (d) this.mountUp(b, d);
    }
    this.frosthorn(w, t, pen);
    const riders = folk.filter((f) => f.snowRole === "rider");
    if (riders.length >= 2) w.groups.make("snow", t.id, "patrol", riders, t.x, t.y);
    foundingGroups(w, "snow", t.id, folk.filter((f) => !riders.includes(f)), t);
    this.index.set(t.id, folk);
    return t;
  }

  /** The longhouse, the igloos + yurts round it, the pen, the fire pit, the drying rack, the totem. */
  private pitch(w: World, t: SnowTribe) {
    t.lodges = [{ x: t.x, y: t.y - 6, kind: "lodge", hp: 1 }, { x: t.x + 8, y: t.y + 48, kind: "fire", hp: 1 }];
    const n = 4 + t.tier;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng() * 0.4;
      const r = 120 + this.rng() * 40;
      const x = t.x + Math.cos(a) * r;
      const y = t.y + Math.sin(a) * r * 0.62;
      if (w.nav.passable("dino", x, y)) t.lodges.push({ x: Math.round(x), y: Math.round(y), kind: i % 3 === 2 ? "yurt" : "igloo", hp: 1 });
    }
    const side = this.rng() < 0.5 ? -1 : 1;
    t.lodges.push({ x: Math.round(t.x + side * 220), y: Math.round(t.y + 30), kind: "pen", hp: 1 });
    t.lodges.push({ x: Math.round(t.x - side * 90), y: Math.round(t.y + 86), kind: "rack", hp: 1 });
    t.lodges.push({ x: Math.round(t.x - side * 40), y: Math.round(t.y - 70), kind: "totem", hp: 1 });
  }

  /** The People tool: a Snow camp where you tap (snapped to the nearest good spot up in the peaks). */
  placeCamp(w: World, x: number, y: number, minFromUs: number): SnowTribe | string {
    if (this.tribes.length >= MAX_SNOW_TRIBES) return `There are already ${MAX_SNOW_TRIBES} Snow People camps: the peaks can't feed more.`;
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
      const i = Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE);
      if (w.terrain.region[i] !== REGION.peaks) return "Snow People only live up in the snowy Great Peaks. Tap on the high snowfields.";
      return "No room for a camp here (too steep, too close to the monks, a dragon's nest or someone else). Try another snowfield.";
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

  /** The People tool, a group: a family, a patrol, a hunting party or a war band where you tap (they join the nearest camp). */
  placeGroup(w: World, x: number, y: number, kind: GroupKind): { t: SnowTribe; g: FolkGroup } | string {
    const i = Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE);
    if (w.terrain.region[i] !== REGION.peaks && w.terrain.tileAt(x, y) !== T.Snow) return "Snow People only come down from the Great Peaks. Tap up in the snow.";
    let t = this.tribes.slice().sort((a, b) => dist(a, { x, y }) - dist(b, { x, y }))[0] ?? null;
    if (!t || dist(t, { x, y }) > 3200) {
      const made = this.placeCamp(w, x, y, 1000);
      if (typeof made === "string") return made;
      t = made;
    }
    this.enabled = true;
    this.started = true;
    w.rivals.started = true;
    const n = kind === "raid" ? 6 : kind === "war" ? 8 : kind === "patrol" ? 4 : 4;
    const folk: Brute[] = [];
    for (let k = 0; k < n; k++) {
      const role: Role = kind === "patrol" ? (k < 2 ? "rider" : "archer") : kind === "family" ? (k < 2 ? "hunter" : "archer") : (["warrior", "archer", "rider", "hunter", "warrior", "archer", "shaman", "rider"] as Role[])[k % 8];
      const young = kind === "family" && k >= 2;
      folk.push(this.add(w, t, x + (this.rng() - 0.5) * 70, y + (this.rng() - 0.5) * 50, role, young ? { age: 20 + this.rng() * 40 } : {}));
    }
    for (const b of folk.filter((f) => f.snowRole === "rider")) {
      const d = this.frosthorn(w, t, { x: b.x + 14, y: b.y + 6 });
      if (d) this.mountUp(b, d);
    }
    const g = w.groups.make("snow", t.id, kind, folk, x, y)!;
    const l = this.index.get(t.id);
    if (l) l.push(...folk);
    else this.index.set(t.id, folk);
    t.seen = true;
    if (kind === "raid" || kind === "war") this.startRaid(w, t, folk);
    else if (kind === "patrol") this.startPatrol(w, t, folk);
    else w.groups.moveTo(w, g, t.x, t.y, "home");
    return { t, g };
  }

  private add(w: World, t: SnowTribe, x: number, y: number, role: Role, o: Partial<Brute> = {}): Brute {
    const used = new Set(this.members(t.id).map((b) => b.name));
    const names = FOLK_NAMES.filter((n) => !used.has(n));
    const b: Brute = {
      id: this.nextId(),
      kind: "brute",
      name: pick(this.rng, names.length ? names : FOLK_NAMES),
      clan: 0,
      snow: t.id,
      snowRole: role,
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
      age: SNOW_GROWN,
      flank: this.rng() < 0.5 ? -1 : 1,
      bubble: null,
      ...o,
    };
    w.rivals.brutes.push(b);
    return b;
  }

  /** A Frosthorn for the tribe (a real animal, kept at their pen). */
  private frosthorn(w: World, t: SnowTribe, at: { x: number; y: number }): Dino | null {
    const d = addDino(w, "frosthorn", at.x + (this.rng() - 0.5) * 40, at.y + (this.rng() - 0.5) * 24, { growth: 1 });
    d.snowTribe = t.id;
    d.homeX = at.x;
    d.homeY = at.y;
    return d;
  }

  mountUp(b: Brute, d: Dino) {
    if (d.snowRider || b.mount) return;
    b.mount = d.id;
    d.snowRider = b.id;
  }

  private dinoOf(w: World, id: number | undefined) {
    return id ? w.dinoById(id) ?? w.dinos.find((x) => x.id === id) ?? null : null;
  }

  dismount(w: World, b: Brute) {
    const d = this.dinoOf(w, b.mount);
    if (d && d.snowRider === b.id) {
      d.snowRider = undefined;
      d.state = "idle";
    }
    b.mount = undefined;
    b.z = 0;
  }

  /** Riding: the Frosthorn goes where its rider goes. */
  private ride(w: World, b: Brute) {
    const d = this.dinoOf(w, b.mount);
    if (!d || d.health <= 0 || d.snowRider !== b.id) {
      b.mount = undefined;
      b.z = 0;
      return;
    }
    d.x = b.x;
    d.y = b.y - 1;
    d.vx = b.vx;
    d.vy = b.vy;
    d.dir = b.dir;
    d.anim += Math.hypot(b.vx, b.vy) * 0.002;
    b.z = sizeOf(d) * 0.42;
  }

  /* ------------------------------ once a second ------------------------------ */

  private slowTick(w: World) {
    const calm = w.tribe.danger === "calm";
    for (const t of [...this.tribes]) {
      const fs = this.members(t.id);
      const adults = fs.filter((b) => (b.age ?? SNOW_GROWN) >= SNOW_GROWN);
      for (const b of fs) if ((b.age ?? SNOW_GROWN) < SNOW_GROWN) b.age = (b.age ?? 0) + 1;
      t.grudge = Math.max(0, t.grudge - 1);
      // the peaks feed them slowly (fish through the ice, birds' eggs, what the hunts bring home)
      t.food += 0.015 * Math.max(1, adults.length);
      t.growT -= 1;
      if (t.growT <= 0) {
        t.growT = 100 + this.rng() * 70;
        if (t.food > 3 && fs.length < Math.min(10 + t.tier * 5, MAX_FOLK) && this.folk(w).length < MAX_FOLK) {
          t.food -= 3;
          const role: Role = pick(this.rng, ["hunter", "archer", "warrior", "hunter", "rider"] as Role[]);
          const b = this.add(w, t, t.x + (this.rng() - 0.5) * 60, t.y + 24, role, { age: 0 });
          fs.push(b);
        }
        if (fs.length > 9 + t.tier * 4 && t.tier < 3) {
          t.tier++;
          t.r += 70;
          if (t.found) w.toast("🏔️", `The ${t.name} Snow People's camp is growing stronger.`, t.x, t.y);
        }
      }
      // a grown rider without a Frosthorn: they catch one from the pen
      for (const b of adults) {
        if (b.snowRole !== "rider" || b.mount || b.band) continue;
        const d = w.dinos.find((x) => x.snowTribe === t.id && !x.snowRider && x.health > 0.4 && dist(x, b) < 300);
        if (d) this.mountUp(b, d);
      }
      // gone: the camp's abandoned; their Frosthorns go wild
      if (!fs.length) {
        this.tribes.splice(this.tribes.indexOf(t), 1);
        for (const d of w.dinos) if (d.snowTribe === t.id) d.snowTribe = undefined;
        w.groups.retribe("snow", t.id, null);
        if (t.found) w.toast("🏔️", `The ${t.name} Snow People are gone from the peaks. Their igloos are slowly drifting over with snow.`, t.x, t.y);
        continue;
      }
      if (!t.found && w.humans.some((h) => !h.captive && !h.under && dist(h, t) < 700)) {
        t.found = true;
        t.seen = true;
        w.toast("🏔️", `A Snow People camp! The ${t.name} tribe: ${fs.length} of them, in furs and bone snow-goggles, with igloos, a longhouse and shaggy Frosthorn mounts. They guard their land fiercely, but leave travellers be elsewhere.`, t.x, t.y);
        w.discover("snowPeople", t.x, t.y);
      }
      // archers loose arrows at a dragon that comes low over the camp
      const dr = w.dragons.list.find((d) => !d.owner && !d.monkRite && d.z < 240 && dist(d, t) < t.r);
      if (dr && this.rng() < 0.35) {
        const shots = adults.filter((b) => b.snowRole === "archer" && b.state !== "flee").slice(0, 3);
        for (const b of shots) {
          b.dir = dr.x > b.x ? 1 : -1;
          b.cd = 2;
          w.dragons.hit(w, dr, 14);
          if (this.rng() < 0.3) say(b, pick(this.rng, ["Dragon!", "Shoot it down!", "Away from the lodges!"]), 1.2);
        }
      }
      const free = adults.filter((b) => !b.band && b.hp > 0.6 && b.state !== "flee" && b.state !== "fight");
      t.huntT -= 1;
      if (t.huntT <= 0) {
        t.huntT = 160 + this.rng() * 140;
        if (w.daylight > 0.3) this.startHunt(w, t, free);
      }
      t.patrolT -= 1;
      if (t.patrolT <= 0) {
        t.patrolT = 130 + this.rng() * 130;
        const riders = free.filter((b) => b.mount || b.snowRole === "archer").slice(0, 4);
        if (riders.length >= 2) this.startPatrol(w, t, riders);
      }
      t.raidT -= 1;
      if (t.raidT <= 0) {
        t.raidT = (t.grudge > 0 ? 500 : 1100) + this.rng() * 500;
        if (!calm && w.elapsed > 900) this.startRaid(w, t, free);
      }
    }
    if (this.tribes.length < MAX_SNOW_TRIBES) {
      this.settleT -= 1;
      if (this.settleT <= 0) {
        this.settleT = 1400 + this.rng() * 900;
        const t = this.settle(w, 1);
        if (t && w.humans.some((h) => dist(h, t) < 900)) w.toast("🏔️", `More Snow People have built igloos up in the peaks: the ${t.name} tribe.`, t.x, t.y);
      }
    }
  }

  /* ------------------------------ bands: hunts, patrols, raids ------------------------------ */

  private newBand(w: World, t: SnowTribe, mode: SnowBand["mode"], party: Brute[], goal: SnowBand["goal"], x: number, y: number, kind: GroupKind) {
    const g = w.groups.make("snow", t.id, kind, party, t.x, t.y);
    if (!g) return null;
    const bd: SnowBand = { id: this.nextId(), tribe: t.id, mode, goal, x, y, grp: g.id, t: 0, phase: "go", quiet: 0 };
    this.bands.push(bd);
    for (const b of party) {
      b.band = bd.id;
      b.raid = goal.kind === "town";
    }
    w.groups.moveTo(w, g, x, y, "walk");
    return bd;
  }

  /** Out after the peaks' game: the nearest huntable animal (never the Yeti or the Snow Rex). */
  startHunt(w: World, t: SnowTribe, free: Brute[]) {
    const party = free.filter((b) => b.snowRole !== "shaman").slice(0, 3 + Math.min(2, t.tier));
    if (party.length < 2) return false;
    let best: Dino | null = null;
    let bd = 2400;
    for (const d of w.dinos) {
      if (d.owner || d.snowTribe || d.sandTribe || d.clan || d.under || d.health <= 0 || !QUARRY.has(d.species)) continue;
      const dd = dist(d, t);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    if (!best) return false;
    return !!this.newBand(w, t, "hunt", party, { kind: "beast", id: best.id }, best.x, best.y, "hunt");
  }

  startPatrol(w: World, t: SnowTribe, riders: Brute[]) {
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k < 4; k++) {
      const a = this.rng() * Math.PI * 2;
      const r = t.r * (0.6 + this.rng() * 0.6);
      const x = t.x + Math.cos(a) * r;
      const y = t.y + Math.sin(a) * r * 0.7;
      if (w.nav.passable("dino", x, y)) pts.push({ x, y });
    }
    if (!pts.length) return false;
    const bd = this.newBand(w, t, "patrol", riders, { kind: "point", id: 0 }, pts[0].x, pts[0].y, "patrol");
    if (bd) bd.pts = pts;
    return !!bd;
  }

  /** A war band comes down: our town (more so with a grudge), a clan camp, or their old enemies the Sand People. */
  startRaid(w: World, t: SnowTribe, free: Brute[]): boolean {
    const goals: { goal: SnowBand["goal"]; x: number; y: number; d: number }[] = [];
    let town: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const b of w.colony.buildings) {
      const d = dist(b, t);
      if (d < bd) {
        bd = d;
        town = { x: b.x, y: b.y };
      }
    }
    const pile = { x: w.camp.pileX, y: w.camp.pileY };
    if (dist(pile, t) < bd) {
      bd = dist(pile, t);
      town = pile;
    }
    if (town && bd < 6000) goals.push({ goal: { kind: "town", id: 0 }, x: town.x, y: town.y, d: bd * (t.grudge > 0 ? 0.5 : 1.1) });
    for (const c of w.rivals.clans) goals.push({ goal: { kind: "clan", id: c.id }, x: c.x, y: c.y, d: dist(c, t) });
    for (const o of w.sandFolk.tribes) goals.push({ goal: { kind: "sand", id: o.id }, x: o.x, y: o.y, d: dist(o, t) * 0.8 });
    const near = goals.filter((g) => g.d < 6000).sort((a, b) => a.d - b.d).slice(0, 2);
    if (!near.length) return false;
    const g = near[Math.floor(this.rng() * near.length)];
    const n = Math.min(free.length, 3 + t.tier * 2, 9);
    if (n < 3) return false;
    const party = free.slice().sort((a, b) => (b.mount ? 1 : 0) - (a.mount ? 1 : 0) || dist(a, t) - dist(b, t)).slice(0, n);
    const band = this.newBand(w, t, "raid", party, g.goal, g.x, g.y, n >= 7 ? "war" : "raid");
    if (!band) return false;
    if (g.goal.kind === "town" && w.humans.some((h) => dist(h, g) < 1600)) {
      w.toast("🏔️", `The ${t.name} Snow People are coming down from the peaks on a raid${t.grudge > 0 ? " (they haven't forgiven us)" : ""}! Frosthorn riders in front.`, g.x, g.y);
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
      // a hunt follows its quarry; when it's down they carry the meat home
      if (bd.mode === "hunt" && bd.phase !== "home") {
        const prey = w.dinoById(bd.goal.id);
        if (!prey || prey.health <= 0 || prey.state === "faint") {
          if (prey || bd.phase === "fight") {
            t.food += 6;
            if (t.found && this.rng() < 0.4) w.toast("🏹", `The ${t.name} Snow People's hunters brought down a ${prey ? prey.name : "beast"}.`, lead.x, lead.y);
          }
          bd.phase = "home";
          w.groups.moveTo(w, g, t.x, t.y, "walk");
          continue;
        }
        bd.x = prey.x;
        bd.y = prey.y;
        if (dist(lead, prey) < 420) {
          bd.phase = "fight";
          for (const b of party) if (b.state !== "fight" && b.state !== "hunt" && b.hp > 0.35) this.engage(w, b, { kind: "dino", d: prey });
        } else if (bd.t % 3 < 0.5) w.groups.moveTo(w, g, prey.x, prey.y, "walk");
        if (bd.t > 300) {
          bd.phase = "home";
          w.groups.moveTo(w, g, t.x, t.y, "walk");
        }
        continue;
      }
      const foe = this.foeNearAt(w, lead.x, lead.y, bd.mode === "raid" ? 360 : 260, t, bd.mode === "raid");
      if (foe) {
        bd.quiet = 0;
        if (bd.phase === "go" && bd.mode !== "raid") bd.phase = "fight";
        for (const b of party) if (b.state !== "fight" && b.hp > 0.35) this.engage(w, b, foe);
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
            if (bd.goal.kind === "town" && dist(lead, { x: w.camp.pileX, y: w.camp.pileY }) < 300) {
              for (const b of party.slice(0, 3)) {
                const got = takeFood(w, 2);
                if (got) {
                  b.loot = got.n;
                  b.lootKind = got.r;
                }
              }
              if (party.some((b) => b.loot)) w.toast("🏔️", `The ${t.name} Snow People raided the stores!`, lead.x, lead.y);
            }
          } else {
            bd.phase = "home";
            w.groups.moveTo(w, g, t.x, t.y, "walk");
          }
        } else if (bd.t % 6 < 0.5) w.groups.moveTo(w, g, bd.x, bd.y, "walk");
      }
      if (bd.phase === "home") {
        if (dist(lead, t) < 200 || bd.t > 420) {
          for (const b of party) {
            if (b.loot) {
              t.food += b.loot;
              b.loot = 0;
            }
            b.band = undefined;
            b.raid = false;
          }
          this.bands.splice(i, 1);
        } else if (bd.t % 6 < 0.5) w.groups.moveTo(w, g, t.x, t.y, "walk");
      }
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

  private think(w: World, b: Brute) {
    const t = this.tribe(b.snow);
    const active = this.awake(w, b);
    b.think = active ? 0.35 + this.rng() * 0.3 : 2 + this.rng() * 1.5;
    if (!t) {
      if (b.state !== "walk") setB(b, "walk", b.x + (this.rng() - 0.5) * 900, b.y + (this.rng() - 0.5) * 600);
      return;
    }
    if (b.state === "dart") return;
    if ((b.age ?? SNOW_GROWN) < SNOW_GROWN) {
      if (dist(b, t) > 160 || b.state === "fight") setB(b, "home", t.x + (this.rng() - 0.5) * 60, t.y + 20);
      else if (w.daylight < 0.3 && b.state !== "sleep") setB(b, "sleep", b.x, b.y);
      return;
    }
    if (b.hp < 0.3 && b.state !== "flee") {
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      say(b, pick(this.rng, ["To the lodges!", "Fall back!", "Aiya!"]), 1.2);
      return;
    }
    if (b.state === "flee") return;
    if (b.state === "fight" || b.state === "hunt") {
      const f = this.foeById(w, b.targetId);
      if (f && b.stateT < 40 && (!!b.band || dist(foeXY(f), t) < t.r * 1.4)) return;
      setB(b, "idle", b.x, b.y);
    }
    if (b.band) {
      const f = this.foeNear(w, b, 200, t, !!b.raid);
      if (f) this.engage(w, b, f);
      return;
    }
    // anyone come into their land: they see them off
    const foe = this.foeNear(w, b, dist(b, t) < t.r ? 320 : 220, t, false);
    if (foe) return this.engage(w, b, foe);
    if (w.daylight < 0.3 || w.weather.snow > 0.8) {
      // night (or a blizzard): into the igloos
      if (b.state !== "sleep") {
        const homes = t.lodges.filter((x) => x.kind === "igloo" || x.kind === "lodge" || x.kind === "yurt");
        const home = homes[b.id % Math.max(1, homes.length)] ?? t;
        if (dist(b, home) < 30) setB(b, "sleep", b.x, b.y);
        else setB(b, "home", home.x + (this.rng() - 0.5) * 20, home.y + 14);
      }
      return;
    }
    if (b.state === "sleep") setB(b, "idle", b.x, b.y);
    const busy = (b.state === "idle" && b.stateT < 8) || ((b.state === "walk" || b.state === "wander" || b.state === "home") && b.stateT < 40);
    if (busy) return;
    b.stateT = 0;
    const r = this.rng();
    if (r < 0.4) {
      const spot = w.groups.spot(w, b, () => this.campSpot(w, t, t.r * 0.5));
      if (spot) setB(b, "wander", spot.x, spot.y);
    } else if (r < 0.7) {
      const fire = t.lodges.find((x) => x.kind === "fire") ?? t;
      setB(b, "idle", fire.x + (this.rng() - 0.5) * 70, fire.y + (this.rng() - 0.5) * 30);
    } else if (r < 0.85) {
      const rack = t.lodges.find((x) => x.kind === "rack" || x.kind === "pen") ?? t;
      setB(b, "wander", rack.x + (this.rng() - 0.5) * 50, rack.y + 22);
    } else setB(b, "idle", t.x + (this.rng() - 0.5) * 120, t.y + 30 + this.rng() * 30);
    if (this.rng() < 0.04) say(b, pick(this.rng, ["Snow's coming.", "*stamps feet*", "Good hunting weather.", "The ice sings tonight.", "Mind the Yeti's cave."]), 1.4);
  }

  private campSpot(w: World, t: SnowTribe, r: number) {
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
    b.targetId = p.id;
    setB(b, foe.kind === "dino" ? "hunt" : "fight", p.x, p.y);
  }

  private foeNear(w: World, b: Brute, r: number, t: SnowTribe, raiding: boolean): Foe | null {
    return this.foeNearAt(w, b.x, b.y, r, t, raiding);
  }

  /**
   * Who they'll fight here: inside their land, any of our people, Neanderthals, Tree + Sea People;
   * anywhere, the Sand People (an old feud) and (with a grudge, or on a raid) our people. Never another
   * Snow tribe, never the monks (they aren't in these lists at all).
   */
  private foeNearAt(w: World, x: number, y: number, r: number, t: SnowTribe, raiding: boolean): Foe | null {
    let best: Foe | null = null;
    let bd = r;
    const theirLand = Math.hypot(x - t.x, y - t.y) < t.r * 1.15;
    if (w.tribe.danger !== "calm" && (theirLand || raiding || t.grudge > 0)) {
      for (const h of w.humans) {
        if (!fairGame(h)) continue;
        // (out in the open, beyond their land, only a grudge or a raid makes one of ours a target)
        if (!raiding && t.grudge <= 0 && Math.hypot(h.x - t.x, h.y - t.y) > t.r * 1.15) continue;
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bd) {
          bd = d;
          best = { kind: "human", h };
        }
      }
    }
    for (const o of w.rivals.brutes) {
      if (o.hp <= 0 || o.captive || o.snatched || o.falling || o.onDragon || o.weapon === "catapult" || o.snow) continue;
      if (o.tree && o.hidden) continue;
      if (o.sea && o.boat) continue;
      if (!o.sand && !theirLand && !raiding) continue;
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
    if (d) return d.health > 0 && d.state !== "carried" && d.state !== "faint" ? { kind: "dino", d } : null;
    const o = w.rivals.byId(id);
    return o && o.hp > 0 && !o.captive && !o.snatched && !o.falling && !o.onDragon ? { kind: "brute", b: o } : null;
  }

  /* ------------------------------ bodies ------------------------------ */

  private act(w: World, b: Brute, dt: number) {
    const t = this.tribe(b.snow);
    const quick = b.state === "fight" || b.state === "hunt" || b.state === "dart" || !!b.band || w.inView(b.x, b.y, 300);
    const pace = b.mount ? MOUNT_SPEED : SPEED;
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
        if (this.move(w, b, dt, pace * (fast ? 1.3 : b.state === "wander" ? 0.7 : 1), quick)) {
          if ((b.state === "home" || b.state === "flee") && t && dist(b, t) < 140 && !b.band && b.loot) {
            t.food += b.loot;
            b.loot = 0;
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
        const arms = ARMS[b.snowRole ?? "hunter"];
        const reach = REACH + (b.mount ? 10 : 0) + (f.kind === "dino" ? sizeOf(f.d) * 0.3 : 0);
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
            b.cd = 0.95 + this.rng() * 0.5;
            b.anim = 0;
            this.strike(w, b, f, b.mount ? 1.25 : 1);
            if (b.hp <= 0) return;
            if (b.mount || this.rng() < 0.2) {
              const a = Math.atan2(b.y - p.y, b.x - p.x) + (this.rng() - 0.5) * 1.4;
              setB(b, "dart", b.x + Math.cos(a) * (b.mount ? 130 : 70), b.y + Math.sin(a) * (b.mount ? 90 : 50));
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
        this.move(w, b, dt, pace * (d < 160 ? 1.55 : 1.35), true);
        return;
      }
    }
    b.vx = b.vy = 0;
  }

  private move(w: World, b: Brute, dt: number, speed: number, quick: boolean) {
    // deep snow is no trouble in snowshoes: they lose almost nothing to it
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
    const arms = ARMS[b.snowRole ?? "hunter"];
    b.spotT = 4;
    w.sfx("whoosh", b.x, b.y, 0.4, 1.05);
    if (f.kind === "human") hurtHuman(w, f.h, arms.hit * mul, b.x, b.y, b.weapon === "axe" ? "club" : "bite");
    else if (f.kind === "brute") w.rivals.hit(w, f.b, arms.hit * mul * 0.9, b.x, b.y, true);
    else hitDino(w, f.d, 24 * mul, b.x, b.y);
  }

  private throwAt(w: World, b: Brute, f: Foe) {
    const arms = ARMS[b.snowRole ?? "hunter"];
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
    w.rivals.missiles.push({ x: b.x, y: b.y, z: sz, vx: (tx - b.x) / flight, vy: (ty - b.y) / flight, vz: (12 - sz) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target: f.kind === "human" ? f.h.id : 0, dmg: arms.throw, kind });
    if (f.kind === "brute") w.rivals.hit(w, f.b, arms.throw, b.x, b.y, true);
    else if (f.kind === "dino") hitDino(w, f.d, 14, b.x, b.y);
    // the frost-caller's stones are charmed with cold: whoever they hit is slowed
    if (b.snowRole === "shaman") {
      const target = f.kind === "human" ? f.h : f.kind === "brute" ? f.b : f.d;
      target.slowT = Math.max(target.slowT ?? 0, 3);
      w.particles.burst(P.Spark, p.x, p.y, 6, 40, { z: 16, size: 2.5, max: 0.6, color: "#d9f4ff" });
    }
    w.sfx("whoosh", b.x, b.y, 0.45, kind === "arrow" ? 1.6 : 1);
  }

  /* ------------------------------ getting hurt ------------------------------ */

  hit(w: World, b: Brute, dmg: number, fx: number, fy: number, byBrute = false, proj?: string) {
    b.spotT = 5;
    b.hp -= byBrute ? dmg * 0.85 : dmg / SNOW_TOUGH;
    w.particles.burst(P.Dust, b.x, b.y, 3, 30, { z: 20, size: 5, max: 0.5, color: "rgba(235,242,250,0.85)" });
    w.sfx("thunk", b.x, b.y, 0.6, 1);
    const t = this.tribe(b.snow);
    // hurt by one of ours: the whole tribe holds it against the town for a while
    if (!byBrute && t) t.grudge = Math.max(t.grudge, GRUDGE);
    if (b.hp <= 0) return w.rivals.kill(w, b);
    if (this.rng() < 0.35) say(b, pick(this.rng, ["Hyah!", "You'll freeze for that!", "Ngh!", "Stand together!"]), 1.2);
    if (!t) return;
    if (b.hp < 0.3) {
      setB(b, "flee", t.x + (this.rng() - 0.5) * 60, t.y);
      return;
    }
    if (b.state === "fight" || b.state === "dart" || (b.age ?? SNOW_GROWN) < SNOW_GROWN || proj === "dragon" || proj === "fire") return;
    let foe: Foe | null = null;
    if (byBrute) {
      const o = w.rivals.brutes.find((x) => x.snow !== b.snow && x.hp > 0 && Math.hypot(x.x - fx, x.y - fy) < 70);
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
    const f = foe;
    w.groups.rally(w, b, (m) => this.engage(w, m, f));
  }

  /** From Rivals.kill (already out of the list). */
  died(w: World, b: Brute) {
    if (b.mount) this.dismount(w, b);
    w.particles.burst(P.Dust, b.x, b.y, 8, 60, { size: 9, max: 1, color: "rgba(235,242,250,0.9)" });
    w.addItem(b.weapon === "bow" ? "stick" : "bones", b.x - 8, b.y + 2);
    if (this.rng() < 0.4) w.camp.stock.hide += 1;
    if (b.loot) w.camp.stock[b.lootKind ?? "berries"] += b.loot;
    const l = this.index.get(b.snow ?? 0);
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
    w.rivals.brutes = w.rivals.brutes.filter((b) => !b.snow);
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
      tribes: this.tribes.map((t) => ({ ...t, food: Math.round(t.food * 10) / 10, growT: r(t.growT), huntT: r(t.huntT), patrolT: r(t.patrolT), raidT: r(t.raidT), grudge: r(t.grudge), lodges: t.lodges.map((x) => ({ ...x })) })),
      folk: this.folk(w).filter((b) => this.tribe(b.snow)).map((b) => ({ snow: b.snow!, role: b.snowRole ?? "hunter", name: b.name, x: r(b.x), y: r(b.y), hp: Math.round(b.hp * 100) / 100, age: r(b.age ?? SNOW_GROWN), tint: b.tint, grp: b.grp, mount: b.mount })),
    };
  }

  /** After Rivals.load (which wipes every brute) and the dinos (their Frosthorns are dinos, saved with snowTribe). */
  load(w: World, d: ReturnType<SnowFolk["serialize"]> | undefined) {
    this.clear(w);
    this.enabled = true;
    if (!d) return;
    this.started = !!d.started;
    this.ids = Math.max(7e8, d.ids ?? 7e8);
    this.nextTribe = d.next ?? 1;
    this.settleT = d.settleT ?? 1100;
    for (const t of d.tribes ?? []) this.tribes.push({ ...t, grudge: t.grudge ?? 0, lodges: t.lodges.map((x) => ({ ...x })) });
    for (const f of d.folk ?? []) {
      const t = this.tribe(f.snow);
      if (!t) continue;
      const b = this.add(w, t, f.x, f.y, f.role as Role, { name: f.name, hp: f.hp, age: f.age, tint: f.tint ?? t.color, grp: f.grp });
      const mount = this.dinoOf(w, f.mount);
      if (mount && mount.species === "frosthorn" && mount.snowTribe === t.id) this.mountUp(b, mount);
    }
    this.reindex(w);
  }
}

