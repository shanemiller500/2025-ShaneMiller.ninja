/* ------------------------------------------------------------------ */
/*  The tribe layer: jobs + direct orders, hunting with spears/bows/   */
/*  crossbows, hauling carcasses home, cooking, farming, walls,        */
/*  watchtowers, camp growth, and raids by (ever-evolving) dinosaurs.  */
/*  Kid-safe cartoon rules: downed dinos poof into drumsticks, and     */
/*  "gobbled" cave people vanish in a dust cloud.                      */
/* ------------------------------------------------------------------ */
import { CAMP_LEVELS, FACTS, SHELTER_STAGES } from "../data/facts";
import { sp } from "../data/species";
import { addDino, emote, findSpawnSpot, isBaby, setState, sizeOf } from "./dinos";
import { addHuman, go, moveHuman, say, sourceFor } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { isWalkTile, isWaterTile } from "./terrain";
import {
  MAP_H,
  MAP_W,
  T,
  TILE,
  type Danger,
  type Dino,
  type Farm,
  type Human,
  type Item,
  type Projectile,
  type ProjectileKind,
  type Resource,
  type Role,
  type SpeciesId,
  type Tower,
  type Wall,
  type WallKind,
} from "./types";
import type { World } from "./world";

export const WALL_HP: Record<WallKind, number> = { palisade: 220, stone: 600 };
export const WALL_COST: Record<WallKind, Resource> = { palisade: "stick", stone: "stone" };
/** units of material per wall tile */
export const WALL_UNITS = 2;
export const TOWER_STAGES: { need: Resource; n: number }[] = [
  { need: "wood", n: 2 },
  { need: "wood", n: 2 },
  { need: "stone", n: 2 },
];

interface Weapon {
  kind: ProjectileKind;
  range: number;
  dmg: number;
  cd: number;
  speed: number;
  prey: number;
}
const WEAPONS: Record<ProjectileKind, Weapon> = {
  spear: { kind: "spear", range: 120, dmg: 26, cd: 2, speed: 360, prey: 60 },
  arrow: { kind: "arrow", range: 250, dmg: 22, cd: 1.3, speed: 620, prey: 95 },
  bolt: { kind: "bolt", range: 340, dmg: 46, cd: 2.1, speed: 820, prey: 150 },
};

export interface RaidState {
  phase: "warn" | "attack";
  t: number;
  ids: number[];
  fromX: number;
  fromY: number;
  breached: boolean;
  label: string;
}

const isFood = (r: Resource) => r === "cooked" || r === "fish" || r === "crop" || r === "berries";

export class Tribe {
  walls: Wall[] = [];
  private wallMap = new Map<number, Wall>();
  farms: Farm[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  level = 0;
  danger: Danger = "normal";
  /** how evolved raiders have become */
  evolution = 0;
  raidsWon = 0;
  raid: RaidState | null = null;
  raidTimer = 360;
  private birthT = 80;
  private assignT = 0;
  private levelT = 0;
  /** bumps when walls change (renderer) */
  version = 0;

  /* ------------------------------ walls ------------------------------ */

  wallAt(tx: number, ty: number) {
    return this.wallMap.get(ty * MAP_W + tx);
  }

  /** Do finished walls stop a dinosaur here? */
  blocks(tx: number, ty: number) {
    const wl = this.wallMap.get(ty * MAP_W + tx);
    return !!wl && wl.built >= 1 && wl.hp > 0;
  }

  addWall(w: World, tx: number, ty: number, kind: WallKind) {
    if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return null;
    const t = w.terrain.tiles[ty * MAP_W + tx];
    if (!isWalkTile(t) || isWaterTile(t) || t === T.Cave || t === T.Tar) return null;
    const ex = this.wallAt(tx, ty);
    if (ex) {
      if (kind === "stone" && ex.kind === "palisade" && !ex.upgrade) {
        ex.upgrade = true;
        ex.have = 0;
        this.version++;
        return ex;
      }
      return null;
    }
    // never wall over the cave mouth, the fire or the stockpile
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    const c = w.camp;
    if (Math.hypot(cx - c.caveX, cy - c.caveY) < 50 || Math.hypot(cx - c.pileX, cy - c.pileY) < 70 || Math.hypot(cx - c.x, cy - c.y) < 60) return null;
    const wl: Wall = { id: w.nextId(), tx, ty, kind, hp: 0, built: 0, have: 0 };
    this.walls.push(wl);
    this.wallMap.set(ty * MAP_W + tx, wl);
    this.version++;
    return wl;
  }

  removeWall(wl: Wall) {
    this.walls.splice(this.walls.indexOf(wl), 1);
    this.wallMap.delete(wl.ty * MAP_W + wl.tx);
    this.version++;
  }

  /** Lay out a ring of wall plans around the camp (skips water + cliffs). */
  planRing(w: World, kind: WallKind) {
    const c = w.camp;
    const R = CAMP_LEVELS[this.level].radius * 0.85;
    const seen = new Set<number>();
    let n = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.012) {
      const x = c.x + Math.cos(a) * R;
      const y = c.y + 30 + Math.sin(a) * R * 0.78;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      const k = ty * MAP_W + tx;
      if (seen.has(k)) continue;
      seen.add(k);
      // the cliff behind the cave is a wall already
      if (y < c.caveY + 10) continue;
      if (this.addWall(w, tx, ty, kind)) n++;
    }
    return n;
  }

  /* ------------------------------ helpers ------------------------------ */

  adults(w: World) {
    return w.humans.filter((h) => !h.child);
  }

  capacity(w: World) {
    return 6 + w.shelters.filter((s) => s.stage >= SHELTER_STAGES.length).length * 3;
  }

  foodTotal(w: World) {
    const s = w.camp.stock;
    return s.cooked + s.fish + s.crop + s.berries;
  }

  weaponFor(w: World, h: Human): Weapon | null {
    if (h.child) return null;
    const l = w.camp.learned;
    if (l.has("crossbow")) return WEAPONS.bolt;
    if (l.has("bow")) return WEAPONS.arrow;
    if (l.has("spear")) return WEAPONS.spear;
    return null;
  }

  roleOf(h: Human): Role {
    return h.role === "auto" ? h.autoRole : h.role;
  }

  /** A blueprint or damaged structure that needs a builder (+ what it needs). */
  nextJob(w: World): { x: number; y: number; need: Resource; wall?: Wall; tower?: Tower } | null {
    const c = w.camp;
    let best: { x: number; y: number; need: Resource; wall?: Wall; tower?: Tower } | null = null;
    let bestD = Infinity;
    for (const wl of this.walls) {
      const pending = wl.built < 1 || wl.upgrade || wl.hp < WALL_HP[wl.kind] * 0.5;
      if (!pending) continue;
      if (wl.kind === "stone" && wl.built < 1 && !c.learned.has("stonewall")) continue;
      if (wl.upgrade && !c.learned.has("stonewall")) continue;
      if (wl.kind === "palisade" && wl.built < 1 && !c.learned.has("palisade")) continue;
      const x = wl.tx * TILE + TILE / 2;
      const y = wl.ty * TILE + TILE / 2;
      const d = Math.hypot(x - c.x, y - c.y);
      // repairs first, then the closest plans
      const score = d - (wl.built >= 1 && !wl.upgrade ? 500 : 0);
      if (score < bestD) {
        bestD = score;
        best = { x, y, need: wl.upgrade ? "stone" : WALL_COST[wl.kind], wall: wl };
      }
    }
    for (const t of this.towers) {
      if (t.stage >= TOWER_STAGES.length || !c.learned.has("tower")) continue;
      const d = Math.hypot(t.x - c.x, t.y - c.y) - 200;
      if (d < bestD) {
        bestD = d;
        best = { x: t.x, y: t.y, need: TOWER_STAGES[t.stage].need, tower: t };
      }
    }
    return best;
  }

  /* ------------------------------ jobs ------------------------------ */

  private assignJobs(w: World) {
    const c = w.camp;
    const autos = w.humans.filter((h) => !h.child && h.role === "auto").sort((a, b) => a.id - b.id);
    const adults = this.adults(w).length;
    const armed = c.learned.has("spear");
    const quota: [Role, number][] = [];
    if (this.raid) {
      quota.push(["guard", armed ? autos.length : 0]);
    } else {
      if (armed) quota.push(["guard", Math.max(1, Math.round(adults * 0.18))]);
      if (this.nextJob(w) || c.activeShelter(w)) quota.push(["builder", Math.min(3, Math.max(1, Math.round(adults * 0.25)))]);
      if (armed && c.stock.meat + c.stock.cooked < adults * 1.5) quota.push(["hunter", adults >= 6 ? 2 : 1]);
      if (c.learned.has("fire") && (c.stock.meat > 0 || c.stock.fish > 3)) quota.push(["cook", 1]);
      if (this.farms.length) quota.push(["farmer", Math.min(2, this.farms.length)]);
    }
    const free: Human[] = [];
    const counts = new Map<Role, number>();
    for (const h of autos) {
      const q = quota.find(([r]) => r === h.autoRole);
      const n = counts.get(h.autoRole) ?? 0;
      if (q && n < q[1]) counts.set(h.autoRole, n + 1);
      else free.push(h);
    }
    for (const [r, n] of quota) {
      let have = counts.get(r) ?? 0;
      while (have < n && free.length) {
        const h = free.shift()!;
        h.autoRole = r;
        have++;
      }
    }
    for (const h of free) h.autoRole = "gatherer";
  }

  /* ------------------------------ combat ------------------------------ */

  /** Is this dino a threat the guards should shoot at? */
  hostile(w: World, d: Dino) {
    if (d.raider) return true;
    const def = sp(d.species);
    if (def.diet === "herbivore" || def.move !== "walk" || d.state === "sleep") return false;
    return sizeOf(d) > 30 && Math.hypot(d.x - w.camp.x, d.y - w.camp.y) < CAMP_LEVELS[this.level].radius + 200;
  }

  shoot(w: World, h: Human, d: Dino, wp: Weapon, bonus = 0) {
    const dist = Math.hypot(d.x - h.x, d.y - h.y);
    const flight = Math.max(0.12, dist / wp.speed);
    // lead the target, with a bit of wobble (better shots in towers / with bolts)
    const acc = Math.min(0.95, 0.62 + bonus + (wp.kind === "bolt" ? 0.12 : 0));
    const miss = (1 - acc) * 70;
    const tx = d.x + d.vx * flight + (w.rng() - 0.5) * miss;
    const ty = d.y + d.vy * flight + (w.rng() - 0.5) * miss * 0.6;
    const sz = h.z + 14;
    const tz = d.z + sizeOf(d) * 0.2;
    this.projectiles.push({
      x: h.x + h.dir * 6,
      y: h.y,
      z: sz,
      vx: (tx - h.x) / flight,
      vy: (ty - h.y) / flight,
      vz: (tz - sz) / flight + 0.5 * 260 * flight,
      t: 0,
      dur: flight,
      kind: wp.kind,
      target: d.id,
      dmg: wp.dmg,
      hit: false,
    });
    h.dir = d.x > h.x ? 1 : -1;
    h.cd = wp.cd * (0.85 + w.rng() * 0.3);
    w.sfx(wp.kind === "spear" ? "whoosh" : "twang", h.x, h.y, 0.5);
  }

  private updateProjectiles(w: World, dt: number) {
    for (const p of this.projectiles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 260 * dt;
      if (p.t >= p.dur && !p.hit) {
        p.hit = true;
        const d = w.dinoById(p.target);
        if (d && Math.hypot(d.x - p.x, d.y - p.y) < sizeOf(d) * 0.45 + 14) {
          hitDino(w, d, p.dmg, p.x - p.vx * 0.1, p.y - p.vy * 0.1);
        } else {
          w.particles.burst(P.Dust, p.x, p.y, 3, 20, { size: 3, max: 0.4, color: "rgba(160,140,110,0.6)" });
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.t < p.dur + 0.05);
  }

  /* ------------------------------ raids ------------------------------ */

  startRaid(w: World) {
    if (this.raid || this.danger === "calm") return false;
    const c = w.camp;
    const power = this.raidsWon + this.level * 1.5 + (w.camp.learned.has("crossbow") ? 2 : 0);
    let pack: SpeciesId[];
    let label: string;
    if (power < 1.5) {
      pack = ["raptor", "raptor", "raptor"];
      label = "A raptor pack";
    } else if (power < 3.5) {
      pack = ["raptor", "raptor", "raptor", "dilo"];
      label = "Raptors and a Dilophosaurus";
    } else if (power < 5.5) {
      pack = ["allo", "raptor", "raptor", "raptor"];
      label = "An Allosaurus and raptors";
    } else if (power < 7.5) {
      pack = ["carno", "carno", "raptor", "raptor"];
      label = "Two Carnotaurus";
    } else {
      pack = ["trex", "raptor", "raptor", "raptor", "allo"];
      label = "A T. rex war party";
    }
    if (this.danger === "wild") pack.push("raptor", "raptor");
    // come from a random side that has room to walk
    let from: { x: number; y: number } | null = null;
    for (let k = 0; k < 30 && !from; k++) {
      const a = w.rng() * Math.PI * 2;
      if (Math.sin(a) < -0.3) continue; // not through the cliffs
      const x = c.x + Math.cos(a) * 1300;
      const y = c.y + Math.sin(a) * 1000;
      from = findSpawnSpot(w, sp("raptor"), x, y, 200);
    }
    if (!from) return false;
    const ids: number[] = [];
    for (let i = 0; i < pack.length; i++) {
      const spot = findSpawnSpot(w, sp(pack[i]), from.x, from.y, 160);
      if (!spot) continue;
      const tier = this.rollTier(w, i === 0);
      const d = addDino(w, pack[i], spot.x, spot.y, { raider: true, tier, hunger: 0.8, thirst: 0, homeX: spot.x, homeY: spot.y });
      setState(d, "idle", d.x, d.y);
      d.think = 10;
      ids.push(d.id);
    }
    const alpha = ids.some((id) => (w.dinoById(id)?.tier ?? 0) >= 2);
    this.raid = { phase: "warn", t: 0, ids, fromX: from.x, fromY: from.y, breached: false, label };
    w.sfx("drums", c.x, c.y, 1.2);
    w.toast("🥁", `${label} is coming to raid the camp!${alpha ? " 👑 An ALPHA leads them!" : ""}`, from.x, from.y);
    this.assignT = 0;
    return true;
  }

  private rollTier(w: World, leader: boolean) {
    const e = this.evolution;
    const r = w.rng();
    if (leader && e >= 3) return 2;
    if (e >= 2 && r < 0.15 + (e - 2) * 0.1) return 2;
    if (e >= 1 && r < 0.3 + e * 0.12) return 1;
    return 0;
  }

  private updateRaid(w: World, dt: number) {
    const r = this.raid;
    if (!r) {
      if (this.danger === "calm") return;
      // raids only start once the tribe can fight back (or has grown)
      const ready = w.camp.learned.has("spear") || this.level >= 1 || w.elapsed > 900;
      if (!ready) return;
      this.raidTimer -= dt * (this.danger === "wild" ? 1.7 : 1);
      if (this.raidTimer <= 0) {
        this.raidTimer = 220 + w.rng() * 140;
        this.startRaid(w);
      }
      return;
    }
    r.t += dt;
    const alive = r.ids.map((id) => w.dinoById(id)).filter((d): d is Dino => !!d && d.raider);
    if (r.phase === "warn") {
      if (r.t > 9) {
        r.phase = "attack";
        r.t = 0;
        for (const d of alive) {
          d.think = 0;
          setState(d, "raid", w.camp.x, w.camp.y);
        }
        w.alarm(w.camp.x, w.camp.y, 600, 0.6, "❗");
        for (const h of w.humans) if (h.child) h.think = 0;
      }
      return;
    }
    if (!alive.length || r.t > 150) {
      this.raid = null;
      const won = r.t <= 150;
      for (const d of alive) d.raider = false;
      if (won) {
        this.raidsWon++;
        this.evolution = Math.floor(this.raidsWon / 2);
        w.discover("defended", w.camp.x, w.camp.y);
        w.celebrate("We did it!");
        w.toast("🛡️", `Raid defeated! (${this.raidsWon} won) The dinos are evolving…`, w.camp.x, w.camp.y);
      }
      return;
    }
  }

  /* ------------------------------ growth ------------------------------ */

  private updateGrowth(w: World, dt: number) {
    for (const h of w.humans) {
      h.age += dt;
      if (h.child && h.age > 320) {
        h.child = false;
        say(h, "I'm grown up!");
        w.toast("🧑", `${h.name} grew up and can help the tribe!`, h.x, h.y);
      }
    }
    this.birthT -= dt;
    if (this.birthT <= 0) {
      this.birthT = 75 + w.rng() * 40;
      const people = w.humans.length;
      const adults = this.adults(w).length;
      if (adults >= 2 && people < this.capacity(w) && this.foodTotal(w) >= Math.max(4, people * 0.8) && people < 30) {
        // the feast feeds the new arrival
        let pay = 3;
        for (const r of ["cooked", "crop", "fish", "berries"] as Resource[]) {
          const n = Math.min(pay, w.camp.stock[r]);
          w.camp.stock[r] -= n;
          pay -= n;
        }
        const baby = addHuman(w, w.camp.caveX + (w.rng() - 0.5) * 40, w.camp.caveY + 30, true);
        say(baby, "Waaah!", 3);
        w.celebrate("A baby!");
        w.discover("baby", baby.x, baby.y);
        w.toast("👶", `${baby.name} was born! Well-fed tribes grow.`, baby.x, baby.y);
      } else if (people >= this.capacity(w) && !w.flags.has("needHuts")) {
        w.flags.add("needHuts");
        w.toast("🛖", "The camp is full! Build more huts so the tribe can grow.");
      }
    }
    this.levelT -= dt;
    if (this.levelT <= 0) {
      this.levelT = 2;
      const next = CAMP_LEVELS[this.level + 1];
      if (!next) return;
      const huts = w.shelters.filter((s) => s.stage >= SHELTER_STAGES.length).length;
      const tech = !next.need || w.camp.learned.has(next.need as never);
      if (w.humans.length >= next.people && huts >= next.huts && tech) {
        this.level++;
        w.celebrate(`${next.name}!`);
        w.discover("village", w.camp.x, w.camp.y);
        w.toast(next.icon, `Your camp grew into a ${next.name}!`, w.camp.x, w.camp.y);
        w.sfx("cheer", w.camp.x, w.camp.y, 1);
      }
    }
  }

  /** Requirements for the next camp level (for the UI). */
  nextLevel(w: World) {
    const next = CAMP_LEVELS[this.level + 1];
    if (!next) return null;
    const huts = w.shelters.filter((s) => s.stage >= SHELTER_STAGES.length).length;
    return { ...next, havePeople: w.humans.length, haveHuts: huts, haveTech: !next.need || w.camp.learned.has(next.need as never) };
  }

  /* ------------------------------ farms ------------------------------ */

  addFarm(w: World, x: number, y: number) {
    const t = w.terrain.tileAt(x, y);
    if (!isWalkTile(t) || isWaterTile(t) || t === T.Tar || t === T.Rock || t === T.Basalt) return null;
    if (this.farms.some((f) => Math.hypot(f.x - x, f.y - y) < 70)) return null;
    const f: Farm = { id: w.nextId(), x, y, growth: 0, planted: false };
    this.farms.push(f);
    return f;
  }

  addTower(w: World, x: number, y: number) {
    const t = w.terrain.tileAt(x, y);
    if (!isWalkTile(t) || isWaterTile(t)) return null;
    if (this.towers.some((o) => Math.hypot(o.x - x, o.y - y) < 80)) return null;
    const tw: Tower = { id: w.nextId(), x, y, stage: 0, have: 0 };
    this.towers.push(tw);
    return tw;
  }

  /* ------------------------------ update ------------------------------ */

  private planT = 20;

  /** What an un-bossed tribe decides to build next (each plan happens once; kids can erase/redo). */
  private autoPlan(w: World) {
    const c = w.camp;
    const f = w.flags;
    // full camp → another hut
    if (c.learned.has("shelter") && w.humans.length >= this.capacity(w) && !c.activeShelter(w) && w.shelters.length < 8) {
      const n = w.shelters.length;
      const a = -0.4 + n * 0.9;
      const R = CAMP_LEVELS[this.level].radius * 0.5;
      c.addShelter(w, c.x + Math.cos(a) * R, c.y + 50 + Math.sin(a) * R * 0.6);
      w.toast("🛖", "The tribe planned a new hut so the camp can grow!");
    }
    if (c.learned.has("farming") && !f.has("planFarms")) {
      f.add("planFarms");
      this.addFarm(w, c.x - 120, c.y + 150);
      this.addFarm(w, c.x - 30, c.y + 165);
      w.toast("🌾", "Farm fields planned! Farmers will plant crops.", c.x, c.y + 150);
    }
    if (c.learned.has("palisade") && this.raidsWon + (this.raid ? 1 : 0) >= 1 && !f.has("planRing")) {
      f.add("planRing");
      const n = this.planRing(w, "palisade");
      if (n) w.toast("🪵", "After that raid, the tribe planned a palisade wall around the camp!", c.x, c.y);
    }
    if (c.learned.has("tower") && !f.has("planTower")) {
      f.add("planTower");
      this.addTower(w, c.x + 150, c.y + 130);
    }
    if (c.learned.has("stonewall") && this.raidsWon >= 3 && !f.has("planStone")) {
      f.add("planStone");
      for (const wl of this.walls) if (wl.kind === "palisade") wl.upgrade = true;
      w.toast("🧱", "Time for stone! Builders will upgrade the walls.", c.x, c.y);
    }
  }

  update(w: World, dt: number) {
    this.assignT -= dt;
    if (this.assignT <= 0) {
      this.assignT = 3;
      this.assignJobs(w);
    }
    this.planT -= dt;
    if (this.planT <= 0) {
      this.planT = 6;
      this.autoPlan(w);
    }
    for (const f of this.farms) if (f.planted && f.growth < 1) f.growth = Math.min(1, f.growth + (dt / 80) * (1 + w.weather.rain * 1.5) * (w.weather.temp > 0.85 ? 0.5 : 1));
    // crops near lava/fire get scorched
    for (const f of this.farms) {
      const tx = Math.floor(f.x / TILE);
      const ty = Math.floor(f.y / TILE);
      if (f.planted && (w.fire.at(tx, ty) > 0.3 || w.lava.heatAt(tx, ty) > 0.2)) {
        f.planted = false;
        f.growth = 0;
      }
    }
    // lava eats walls too
    for (const wl of this.walls) if (wl.built >= 1 && w.lava.heatAt(wl.tx, wl.ty) > 0.3) wl.hp = Math.max(0, wl.hp - dt * 80);
    this.updateProjectiles(w, dt);
    this.updateRaid(w, dt);
    this.updateGrowth(w, dt);
  }

  clear() {
    this.walls = [];
    this.wallMap.clear();
    this.farms = [];
    this.towers = [];
    this.projectiles = [];
    this.raid = null;
  }

  serialize() {
    return {
      walls: this.walls.map((wl) => [wl.tx, wl.ty, wl.kind === "stone" ? 1 : 0, Math.round(wl.hp), Math.round(wl.built * 100) / 100, wl.upgrade ? 1 : 0] as const),
      farms: this.farms.map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.growth * 100) / 100, f.planted ? 1 : 0] as const),
      towers: this.towers.map((t) => [Math.round(t.x), Math.round(t.y), t.stage, t.have] as const),
      level: this.level,
      danger: this.danger,
      evolution: this.evolution,
      raidsWon: this.raidsWon,
      raidTimer: Math.round(this.raidTimer),
    };
  }

  load(w: World, d: ReturnType<Tribe["serialize"]> | undefined) {
    if (!d) return;
    for (const [tx, ty, stone, hp, built, up] of d.walls) {
      const wl: Wall = { id: w.nextId(), tx, ty, kind: stone ? "stone" : "palisade", hp, built, have: 0, upgrade: !!up };
      this.walls.push(wl);
      this.wallMap.set(ty * MAP_W + tx, wl);
    }
    for (const [x, y, growth, planted] of d.farms) this.farms.push({ id: w.nextId(), x, y, growth, planted: !!planted });
    for (const [x, y, stage, have] of d.towers) this.towers.push({ id: w.nextId(), x, y, stage, have });
    this.level = d.level;
    this.danger = d.danger;
    this.evolution = d.evolution;
    this.raidsWon = d.raidsWon;
    this.raidTimer = d.raidTimer;
  }
}

/* ======================================================================= */
/*  Combat outcomes                                                         */
/* ======================================================================= */

/** A spear/arrow/bolt struck a dinosaur. */
export function hitDino(w: World, d: Dino, dmg: number, fx: number, fy: number) {
  const def = sp(d.species);
  const hp = def.hp * (1 + d.tier * 0.7) * (0.5 + d.growth * 0.5) * (d.raider ? 1.8 : 1) * d.genes.tough;
  d.health -= dmg / hp;
  d.fear = Math.min(1, d.fear + 0.35);
  w.particles.burst(P.Star, d.x, d.y, 2, 30, { z: sizeOf(d) * 0.5, size: 5, max: 0.6 });
  w.particles.spawn(P.Ring, d.x, d.y, { z: sizeOf(d) * 0.4, size: 5, max: 0.35, color: "rgba(255,255,255,0.9)" });
  w.sfx("thunk", d.x, d.y, 0.7);
  if (d.health <= 0) {
    downDino(w, d);
    return;
  }
  emote(d, "💢", 1);
  if (d.raider) {
    if (d.health < 0.3) retreat(w, d);
    return;
  }
  if (d.state === "sleep" || d.state === "carried") setState(d, "idle");
  // big hungry predators turn on whoever is shooting; plant-eaters run (or charge, if they're tough)
  const shooter = nearestHuman(w, fx, fy, 400);
  const fights = (def.diet !== "herbivore" && (sizeOf(d) > 60 || d.hunger > 0.5)) || (def.defender && d.health > 0.5);
  if (fights && shooter && def.move === "walk") {
    d.targetId = shooter.id;
    setState(d, "chase", shooter.x, shooter.y);
    w.sfx(def.sound.kind, d.x, d.y, 0.9, def.sound.pitch);
    emote(d, "😡", 1.5);
  } else if (def.move === "walk") {
    const a = Math.atan2(d.y - fy, d.x - fx);
    setState(d, "flee", d.x + Math.cos(a) * 420, d.y + Math.sin(a) * 420);
  } else {
    setState(d, "flee", d.x + (w.rng() - 0.5) * 400, d.y - 200);
  }
}

function nearestHuman(w: World, x: number, y: number, r: number): Human | null {
  let best: Human | null = null;
  let bd = r;
  for (const h of w.humans) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bd && h.state !== "hide") {
      bd = d;
      best = h;
    }
  }
  return best;
}

/** Cartoon "down": stars, a dust poof, and a drumstick-shaped carcass to drag home. */
export function downDino(w: World, d: Dino) {
  const def = sp(d.species);
  const amount = Math.max(0.6, Math.min(4, sizeOf(d) / 35));
  const z = def.move === "fly" ? Math.max(0, d.z) : 0;
  const meat = w.addItem("meat", d.x, d.y, { amount, species: d.species, z, vz: 0 });
  meat.claimed = 0;
  w.particles.burst(P.Poof, d.x, d.y, 10, 60, { size: 12, max: 0.9, color: "rgba(235,228,210,0.95)" });
  w.particles.burst(P.Star, d.x, d.y, 3, 30, { z: 10, size: 6, max: 1 });
  w.sfx("bonk", d.x, d.y, 0.9);
  if (d.tier >= 2) {
    w.discover("alpha", d.x, d.y);
    w.toast("👑", `The ALPHA ${def.nick} is down!`, d.x, d.y);
  } else if (!w.flags.has("firstHunt")) {
    w.flags.add("firstHunt");
    w.toast("🏹", `The hunters got a ${def.nick}! Now drag it home to cook.`, d.x, d.y, FACTS.foodChain);
  }
  w.discover("hunted", d.x, d.y);
  w.removeDino(d);
}

export function retreat(w: World, d: Dino) {
  const c = w.camp;
  const a = Math.atan2(d.y - c.y, d.x - c.x);
  d.raider = false;
  // run off the edge of the world (migrants despawn there)
  d.migrant = true;
  d.homeX = c.x + Math.cos(a) * 6000;
  d.homeY = c.y + Math.sin(a) * 6000;
  emote(d, "💨", 1.5);
  setState(d, "flee", d.x + Math.cos(a) * 600, d.y + Math.sin(a) * 450);
  d.fear = 1;
}

/** A raider caught somebody. */
export function gobble(w: World, d: Dino, h: Human) {
  const def = sp(d.species);
  w.particles.burst(P.Poof, h.x, h.y, 12, 70, { size: 14, max: 1, color: "rgba(235,228,210,0.95)" });
  w.sfx("chomp", h.x, h.y, 1);
  const i = w.humans.indexOf(h);
  if (i >= 0) w.humans.splice(i, 1);
  w.events.push({ type: "removed", id: h.id });
  w.toast("😱", `Oh no! ${h.name} got gobbled by a ${def.nick}!`, h.x, h.y);
  d.hunger = 0;
  emote(d, "😋", 2);
  retreat(w, d);
}

/* ======================================================================= */
/*  Job behaviours (called from the cave-person brain)                     */
/* ======================================================================= */

const carryCap = (w: World) => (w.camp.learned.has("basket") ? 4 : 2);

/** Returns true if the job took over this think tick. */
export function roleThink(w: World, h: Human): boolean {
  const tribe = w.tribe;
  const camp = w.camp;
  const role = tribe.roleOf(h);
  const wp = tribe.weaponFor(w, h);

  // direct orders from the player win
  if (h.order?.kind === "hunt") {
    const d = w.dinoById(h.order.id);
    if (!d) {
      h.order = null;
      say(h, "Got away…");
    } else if (wp) return startHunt(w, h, d, wp);
    else {
      h.order = null;
      say(h, "Need spear!");
    }
  }
  if (h.order?.kind === "guard") return guardAt(w, h, h.order.x, h.order.y, wp);

  switch (role) {
    case "guard": {
      if (!wp && !camp.learned.has("tools")) return false;
      const post = guardPost(w, h);
      return guardAt(w, h, post.x, post.y, wp, post.tower);
    }
    case "hunter": {
      if (!wp) return false;
      if (haulSomething(w, h)) return true;
      const prey = findPrey(w, h, wp);
      if (prey) return startHunt(w, h, prey, wp);
      return false;
    }
    case "cook": {
      const fire = w.campfires.find((f) => f.lit);
      if (!fire || (camp.stock.meat <= 0 && camp.stock.fish <= 0)) return false;
      if (Math.hypot(h.x - fire.x - 24, h.y - fire.y) < 10) {
        go(h, "cook", h.x, h.y);
        h.dir = -1;
      } else {
        h.task = null;
        go(h, "walk", fire.x + 24, fire.y);
      }
      return true;
    }
    case "farmer": {
      const f = tribe.farms.find((f) => !f.planted && camp.stock.grass > 0) ?? tribe.farms.find((f) => f.planted && f.growth >= 1);
      if (!f) {
        if (tribe.farms.some((f) => !f.planted)) {
          // need seed grass
          const src = sourceFor(w, h, "grass");
          if (src) {
            h.task = "grass";
            h.targetId = 0;
            go(h, "walk", src.x, src.y);
            return true;
          }
        }
        return false;
      }
      h.targetId = f.id;
      if (Math.hypot(h.x - f.x, h.y - f.y) < 14) go(h, "farm", h.x, h.y);
      else {
        h.task = null;
        go(h, "walk", f.x, f.y);
      }
      return true;
    }
    case "builder":
      return builderThink(w, h);
    default:
      return false;
  }
}

function builderThink(w: World, h: Human) {
  const tribe = w.tribe;
  const camp = w.camp;
  const job = tribe.nextJob(w);
  if (!job) return false;
  if (h.carry === job.need && h.carryN > 0) {
    h.task = null;
    go(h, "carry", job.x, job.y + 10);
    h.targetId = job.wall?.id ?? job.tower?.id ?? 0;
    return true;
  }
  if (h.carry) return false;
  // repairs only need a builder, not materials
  if (job.wall && job.wall.built >= 1 && !job.wall.upgrade) {
    h.targetId = job.wall.id;
    if (Math.hypot(h.x - job.x, h.y - job.y - 14) < 12) go(h, "repair", h.x, h.y);
    else go(h, "walk", job.x, job.y + 14);
    h.task = null;
    return true;
  }
  if (camp.stock[job.need] > 0) {
    if (Math.hypot(h.x - camp.pileX, h.y - camp.pileY) < 30) {
      const n = Math.min(camp.stock[job.need], carryCap(w));
      camp.stock[job.need] -= n;
      h.carry = job.need;
      h.carryN = n;
      go(h, "carry", job.x, job.y + 10);
      h.targetId = job.wall?.id ?? job.tower?.id ?? 0;
    } else {
      h.task = null;
      go(h, "walk", camp.pileX - 10, camp.pileY + 10);
    }
    return true;
  }
  // nothing in the pile: go get it
  const src = sourceFor(w, h, job.need);
  if (!src) return false;
  h.task = job.need;
  h.targetId = src.id;
  go(h, "walk", src.x, src.y);
  return true;
}

/** Builder arrived at a site with materials. */
export function deliverBuild(w: World, h: Human): boolean {
  const tribe = w.tribe;
  if (!h.carry) return false;
  // spend the load on plans around here (one wall tile per 2 units)
  let used = false;
  const r = h.carry;
  for (const wl of tribe.walls) {
    if (h.carryN < 1) break;
    const need = wl.upgrade ? "stone" : WALL_COST[wl.kind];
    if (need !== r || !(wl.built < 1 || wl.upgrade)) continue;
    const x = wl.tx * TILE + TILE / 2;
    const y = wl.ty * TILE + TILE / 2;
    if (Math.hypot(x - h.x, y - h.y) > 90) continue;
    const take = Math.min(h.carryN, WALL_UNITS - wl.have);
    wl.have += take;
    h.carryN -= take;
    used = true;
  }
  for (const t of tribe.towers) {
    if (h.carryN < 1 || t.stage >= TOWER_STAGES.length) continue;
    const st = TOWER_STAGES[t.stage];
    if (st.need !== r || Math.hypot(t.x - h.x, t.y - h.y) > 90) continue;
    const take = Math.min(h.carryN, st.n - t.have);
    t.have += take;
    h.carryN -= take;
    used = true;
  }
  if (h.carryN <= 0) {
    h.carry = null;
    h.carryN = 0;
  }
  if (used) {
    go(h, "build", h.x, h.y);
    h.task = "build";
    h.targetId = -7;
  }
  return used;
}

/** Hammering: finish any plans near this builder that have their materials. */
export function buildTick(w: World, h: Human, dt: number): boolean {
  if (h.targetId !== -7) return false;
  const tribe = w.tribe;
  let work = false;
  for (const wl of tribe.walls) {
    if (!(wl.built < 1 || wl.upgrade) || wl.have < WALL_UNITS) continue;
    const x = wl.tx * TILE + TILE / 2;
    const y = wl.ty * TILE + TILE / 2;
    if (Math.hypot(x - h.x, y - h.y) > 100) continue;
    work = true;
    wl.built = Math.min(1, (wl.upgrade ? 0 : wl.built) + dt * 0.9);
    if (wl.upgrade) {
      // swap the palisade for stone in one go
      wl.kind = "stone";
      wl.upgrade = false;
      wl.built = 0.01;
    }
    if (w.rng() < dt * 5) w.particles.spawn(P.Crumb, x + (w.rng() - 0.5) * 20, y - 10, { z: 14, vz: 40, vx: (w.rng() - 0.5) * 40, g: 160, size: 2, max: 0.5, color: wl.kind === "stone" ? "#9a958c" : "#a07a4a" });
    if (w.rng() < dt * 3) w.sfx("knock", x, y, 0.4);
    if (wl.built >= 1) {
      wl.hp = WALL_HP[wl.kind];
      wl.have = 0;
      tribe.version++;
      if (!w.flags.has("firstWall")) {
        w.flags.add("firstWall");
        w.toast("🪵", "A wall! Dinos can't walk through it (but they can bash it…).", x, y);
      }
    }
    break;
  }
  if (!work) {
    for (const t of tribe.towers) {
      if (t.stage >= TOWER_STAGES.length || t.have < TOWER_STAGES[t.stage].n || Math.hypot(t.x - h.x, t.y - h.y) > 100) continue;
      work = true;
      if (h.stateT > 3) {
        t.stage++;
        t.have = 0;
        h.stateT = 0;
        w.sfx("build", t.x, t.y, 0.8);
        if (t.stage >= TOWER_STAGES.length) {
          w.toast("🗼", "Watchtower finished! A guard up there can see for miles.", t.x, t.y);
          w.celebrate("Tower!");
        }
      }
      break;
    }
  }
  if (!work) {
    h.task = null;
    h.targetId = 0;
    go(h, "idle", h.x, h.y);
  }
  return true;
}

function guardPost(w: World, h: Human): { x: number; y: number; tower?: Tower } {
  const tribe = w.tribe;
  const c = w.camp;
  const guards = w.humans.filter((o) => !o.child && tribe.roleOf(o) === "guard" && !o.order).sort((a, b) => a.id - b.id);
  const idx = Math.max(0, guards.indexOf(h));
  const towers = tribe.towers.filter((t) => t.stage >= TOWER_STAGES.length);
  if (idx < towers.length) return { x: towers[idx].x, y: towers[idx].y + 2, tower: towers[idx] };
  const R = CAMP_LEVELS[tribe.level].radius * 0.62;
  // face the raid if there is one
  const base = tribe.raid ? Math.atan2(tribe.raid.fromY - c.y, tribe.raid.fromX - c.x) : Math.PI / 2;
  const spread = tribe.raid ? 0.35 : 1.1;
  const a = base + (idx - (guards.length - 1) / 2) * spread;
  return { x: c.x + Math.cos(a) * R, y: c.y + 30 + Math.sin(a) * R * 0.75 };
}

function guardAt(w: World, h: Human, x: number, y: number, wp: Weapon | null, tower?: Tower) {
  const tribe = w.tribe;
  const range = (wp?.range ?? 90) + (tower ? 140 : 0);
  // anything nasty in range?
  let target: Dino | null = null;
  let bd = range;
  for (const d of w.dinos) {
    if (!tribe.hostile(w, d)) continue;
    const dist = Math.hypot(d.x - h.x, d.y - h.y);
    if (dist < bd) {
      bd = dist;
      target = d;
    }
  }
  if (target) {
    h.targetId = target.id;
    go(h, "aim", h.x, h.y);
    h.dir = target.x > h.x ? 1 : -1;
    if (!wp) {
      say(h, pick(w.rng, ["Shoo!", "Go away!", "Hyaaa!"]));
      target.fear = Math.min(1, target.fear + 0.4);
    } else if (w.rng() < 0.15) say(h, pick(w.rng, ["Fire!", "Hold the line!", "Get back!", "Dino!"]));
    return true;
  }
  if (Math.hypot(h.x - x, h.y - y) > 10) {
    h.task = null;
    go(h, "walk", x, y);
  } else {
    go(h, "guard", h.x, h.y);
    if (tower) h.z = 34;
    if (w.rng() < 0.03) say(h, pick(w.rng, ["All clear!", "Watching…", "Nothing yet.", "*yawn*"]));
  }
  return true;
}

function findPrey(w: World, h: Human, wp: Weapon): Dino | null {
  const c = w.camp;
  let best: Dino | null = null;
  let bs = Infinity;
  for (const d of w.dinos) {
    const def = sp(d.species);
    if (def.move === "swim" || d.state === "carried") continue;
    const dc = Math.hypot(d.x - c.x, d.y - c.y);
    if (dc > 1500) continue;
    if (def.move === "fly") {
      if (wp.kind === "spear" && d.z > 8) continue;
    } else if (sizeOf(d) > wp.prey) continue;
    // don't poke the big scary ones unless armed with bolts
    if (def.diet !== "herbivore" && def.move === "walk" && sizeOf(d) > 60 && wp.kind !== "bolt") continue;
    let score = Math.hypot(d.x - h.x, d.y - h.y);
    if (isBaby(d)) score += 400; // leave the babies alone
    if (def.move === "fly") score -= 150;
    if (score < bs) {
      bs = score;
      best = d;
    }
  }
  return best;
}

function startHunt(w: World, h: Human, d: Dino, wp: Weapon) {
  h.targetId = d.id;
  const dist = Math.hypot(d.x - h.x, d.y - h.y);
  if (dist < wp.range * 0.85) {
    go(h, "aim", h.x, h.y);
    h.dir = d.x > h.x ? 1 : -1;
  } else {
    go(h, "hunt", d.x, d.y);
    if (w.rng() < 0.3) say(h, pick(w.rng, ["Shh…", "Dinner!", "Sneak sneak", "I see one!"]));
  }
  return true;
}

function haulSomething(w: World, h: Human) {
  const c = w.camp;
  let best: Item | null = null;
  let bd = 1600;
  for (const it of w.items) {
    if (it.kind !== "meat" || it.z > 2 || (it.draggedBy && it.draggedBy !== h.id)) continue;
    const d = Math.hypot(it.x - c.x, it.y - c.y);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  if (!best) return false;
  if (best.draggedBy === h.id) {
    go(h, "haul", c.pileX - 30, c.pileY + 16);
    return true;
  }
  h.targetId = best.id;
  h.task = null;
  go(h, "hunt", best.x, best.y);
  return true;
}

/** Per-frame job states. Returns true if handled. */
export function roleAct(w: World, h: Human, dt: number): boolean {
  const tribe = w.tribe;
  h.cd = Math.max(0, h.cd - dt);
  switch (h.state) {
    case "hunt": {
      // stalking prey… or walking over to a carcass
      const it = w.itemById(h.targetId);
      if (it && it.kind === "meat") {
        h.tx = it.x;
        h.ty = it.y;
        if (moveHuman(w, h, dt)) {
          it.draggedBy = h.id;
          it.claimed = h.id;
          say(h, "Heave!");
          go(h, "haul", w.camp.pileX - 30, w.camp.pileY + 16);
        }
        return true;
      }
      const d = w.dinoById(h.targetId);
      const wp = tribe.weaponFor(w, h);
      if (!d || !wp || h.stateT > 40) {
        if (h.order?.kind === "hunt" && !d) h.order = null;
        go(h, "idle", h.x, h.y);
        return true;
      }
      h.tx = d.x;
      h.ty = d.y;
      moveHuman(w, h, dt);
      if (Math.hypot(d.x - h.x, d.y - h.y) < wp.range * 0.8) go(h, "aim", h.x, h.y);
      return true;
    }
    case "aim": {
      const d = w.dinoById(h.targetId);
      const wp = tribe.weaponFor(w, h);
      h.vx = h.vy = 0;
      if (!d) {
        if (h.order?.kind === "hunt") h.order = null;
        h.z = 0;
        go(h, "idle", h.x, h.y);
        h.think = 0;
        return true;
      }
      h.dir = d.x > h.x ? 1 : -1;
      const tower = tribe.towers.find((t) => t.stage >= TOWER_STAGES.length && Math.hypot(t.x - h.x, t.y - 2 - h.y) < 12);
      const range = (wp?.range ?? 90) + (tower ? 140 : 0);
      const dist = Math.hypot(d.x - h.x, d.y - h.y);
      if (dist > range * 1.1 || h.stateT > 20) {
        go(h, "idle", h.x, h.y);
        h.think = 0;
        return true;
      }
      if (wp && h.cd <= 0) tribe.shoot(w, h, d, wp, tower ? 0.2 : 0);
      // too close: back off
      if (dist < 45 && !tower && sp(d.species).diet !== "herbivore") {
        const a = Math.atan2(h.y - d.y, h.x - d.x);
        go(h, "flee", h.x + Math.cos(a) * 160, h.y + Math.sin(a) * 120);
      }
      return true;
    }
    case "haul": {
      const it = w.items.find((i) => i.draggedBy === h.id);
      if (!it) {
        go(h, "idle", h.x, h.y);
        return true;
      }
      // dragging is slow work
      const arrived = moveHuman(w, h, dt * 0.55);
      const a = Math.atan2(it.y - h.y, it.x - h.x);
      const gap = 18 + Math.min(20, it.amount * 5);
      it.x = h.x + Math.cos(a) * gap;
      it.y = h.y + Math.sin(a) * gap;
      it.t = 0;
      if (w.rng() < dt * 3) w.particles.spawn(P.Dust, it.x, it.y, { vz: 6, size: 5, max: 0.6, color: "rgba(170,150,110,0.45)" });
      if (arrived) {
        const n = Math.max(1, Math.round(it.amount * 2));
        w.camp.stock.meat += n;
        w.removeItem(it);
        say(h, `Meat! (+${n})`);
        w.sfx("thud", h.x, h.y, 0.6);
        go(h, "idle", h.x, h.y);
      }
      return true;
    }
    case "cook": {
      const s = w.camp.stock;
      const fire = w.campfires.find((f) => f.lit);
      if (!fire || (s.meat <= 0 && s.fish <= 0)) {
        go(h, "idle", h.x, h.y);
        return true;
      }
      if (w.rng() < dt * 4) w.particles.spawn(P.Smoke, fire.x + (w.rng() - 0.5) * 10, fire.y - 6, { z: 10, vz: 24, size: 6, max: 1.4, color: "rgba(200,190,180,0.45)" });
      if (w.rng() < dt * 1.2) w.sfx("sizzle", fire.x, fire.y, 0.5);
      if (h.stateT > 5) {
        if (s.meat > 0) {
          s.meat--;
          s.cooked += 3;
          say(h, "Roasted! 🍖");
          if (!w.flags.has("feast")) {
            w.flags.add("feast");
            w.discover("feast", fire.x, fire.y);
            w.toast("🍗", "A roast dino feast! Cooked food feeds more people.", fire.x, fire.y, FACTS.cooked);
          }
        } else {
          s.fish--;
          s.cooked += 1;
          say(h, "Grilled fish!");
        }
        h.stateT = 0;
      }
      return true;
    }
    case "farm": {
      const f = tribe.farms.find((f) => f.id === h.targetId);
      if (!f) {
        go(h, "idle", h.x, h.y);
        return true;
      }
      if (w.rng() < dt * 3) w.particles.spawn(P.Crumb, f.x + (w.rng() - 0.5) * 30, f.y, { z: 4, vz: 30, vx: (w.rng() - 0.5) * 30, g: 140, size: 2, max: 0.5, color: "#7a5a3a" });
      if (h.stateT > 2.5) {
        if (!f.planted && w.camp.stock.grass > 0) {
          w.camp.stock.grass--;
          f.planted = true;
          f.growth = 0;
          say(h, "Grow, grow!");
        } else if (f.planted && f.growth >= 1) {
          f.planted = false;
          f.growth = 0;
          w.camp.stock.crop += 4;
          say(h, "Harvest! +4");
          w.discover("harvest", f.x, f.y);
        }
        go(h, "idle", h.x, h.y);
      }
      return true;
    }
    case "guard":
      if (h.stateT > 3) h.think = 0;
      return true;
    case "repair": {
      const wl = tribe.walls.find((x) => x.id === h.targetId);
      if (!wl || wl.built < 1) {
        go(h, "idle", h.x, h.y);
        return true;
      }
      wl.hp = Math.min(WALL_HP[wl.kind], wl.hp + dt * 40);
      if (w.rng() < dt * 3) w.sfx("knock", h.x, h.y, 0.35);
      if (wl.hp >= WALL_HP[wl.kind]) go(h, "idle", h.x, h.y);
      return true;
    }
  }
  return false;
}

/* ======================================================================= */
/*  Raider brain (called from the dino AI)                                 */
/* ======================================================================= */

export function thinkRaider(w: World, d: Dino) {
  const tribe = w.tribe;
  if (!tribe.raid || tribe.raid.phase !== "attack") return;
  if (d.health < 0.3) {
    retreat(w, d);
    return;
  }
  if (d.state === "attackWall" || d.state === "tussle" || d.state === "knocked") return;
  // somebody tasty nearby?
  let prey: Human | null = null;
  let bd = 300;
  for (const h of w.humans) {
    if (h.state === "hide" || h.state === "sleep" || h.state === "tossed") continue;
    const dist = Math.hypot(h.x - d.x, h.y - d.y);
    if (dist < bd) {
      bd = dist;
      prey = h;
    }
  }
  if (prey) {
    d.targetId = prey.id;
    setState(d, "chase", prey.x, prey.y);
    if (w.rng() < 0.3) w.sfx(sp(d.species).sound.kind, d.x, d.y, 0.8, sp(d.species).sound.pitch);
    return;
  }
  // nobody outside: raid the stockpile
  const c = w.camp;
  if (Math.hypot(d.x - c.pileX, d.y - c.pileY) < 60) {
    let ate = false;
    for (const r of ["cooked", "meat", "fish", "crop", "berries"] as Resource[]) {
      if (c.stock[r] > 0) {
        c.stock[r] = Math.max(0, c.stock[r] - 2);
        ate = true;
        break;
      }
    }
    if (ate) {
      emote(d, "😋", 1.5);
      w.sfx("chomp", d.x, d.y, 0.7);
      if (!w.flags.has("pileRaid")) {
        w.flags.add("pileRaid");
        w.toast("😠", "The raiders are eating our food! Guards, defend the camp!", d.x, d.y);
      }
      d.hunger = Math.max(0, d.hunger - 0.2);
      if (d.hunger < 0.1) retreat(w, d);
    } else retreat(w, d);
    return;
  }
  setState(d, "raid", c.pileX + (w.rng() - 0.5) * 40, c.pileY);
}

/** Per-frame raider states. Returns true if handled. */
export function actRaider(w: World, d: Dino, dt: number): boolean {
  const tribe = w.tribe;
  if (d.state === "raid") {
    // a wall between us and the camp? bash it (raiders don't politely walk around)
    const a = Math.atan2(d.ty - d.y, d.tx - d.x);
    let blocked = d.stuckT > 0.7;
    for (const step of [18, 36, 54]) {
      if (blocked) break;
      blocked = tribe.blocks(Math.floor((d.x + Math.cos(a) * step) / TILE), Math.floor((d.y + Math.sin(a) * step) / TILE));
    }
    if (blocked) {
      const wl = wallAhead(w, d);
      if (wl) {
        d.targetId = wl.id;
        setState(d, "attackWall", d.x, d.y);
        d.stuckT = 0;
      }
    }
    return true;
  }
  if (d.state === "attackWall") {
    const wl = tribe.walls.find((x) => x.id === d.targetId);
    if (!wl || wl.hp <= 0 || wl.built < 1) {
      setState(d, "raid", w.camp.pileX, w.camp.pileY);
      return true;
    }
    const dps = (6 + sizeOf(d) * 0.15) * (1 + d.tier * 0.5);
    wl.hp -= dps * dt;
    d.dir = wl.tx * TILE + 16 > d.x ? 1 : -1;
    if (w.rng() < dt * 4) {
      w.particles.spawn(P.Crumb, wl.tx * TILE + 16, wl.ty * TILE + 10, { z: 16, vz: 50, vx: (w.rng() - 0.5) * 60, g: 160, size: 3, max: 0.6, color: wl.kind === "stone" ? "#8f8a82" : "#8a6238" });
      w.sfx("thud", d.x, d.y, 0.6);
    }
    if (wl.hp <= 0) {
      wl.hp = 0;
      wl.built = 0;
      wl.have = 0;
      tribe.version++;
      w.particles.burst(P.Dust, wl.tx * TILE + 16, wl.ty * TILE + 16, 10, 60, { size: 10, max: 1, color: "rgba(160,130,90,0.6)" });
      w.shake(4, 0.4);
      if (tribe.raid && !tribe.raid.breached) {
        tribe.raid.breached = true;
        w.toast("💥", "They smashed through the wall! Builders will need to fix it.", wl.tx * TILE, wl.ty * TILE);
      }
      setState(d, "raid", w.camp.pileX, w.camp.pileY);
    }
    return true;
  }
  return false;
}

function wallAhead(w: World, d: Dino) {
  const tribe = w.tribe;
  const a = Math.atan2(d.ty - d.y, d.tx - d.x);
  let best: Wall | null = null;
  let bd = 90;
  for (const wl of tribe.walls) {
    if (wl.built < 1 || wl.hp <= 0) continue;
    const x = wl.tx * TILE + 16;
    const y = wl.ty * TILE + 16;
    const dist = Math.hypot(x - d.x, y - d.y);
    if (dist > bd) continue;
    // roughly in the direction we want to go
    const da = Math.abs(((Math.atan2(y - d.y, x - d.x) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < 1.4) {
      bd = dist;
      best = wl;
    }
  }
  return best;
}

export { isFood };
