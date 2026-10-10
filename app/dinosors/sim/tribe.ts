/* ------------------------------------------------------------------ */
/*  The tribe layer: jobs + direct orders, hunting with spears/bows/   */
/*  crossbows, hauling carcasses home, cooking, farming, walls,        */
/*  watchtowers, camp growth, and raids by (ever-evolving) dinosaurs.  */
/*  Kid-safe cartoon rules: downed dinos poof into drumsticks, and     */
/*  "gobbled" cave people vanish in a dust cloud.                      */
/* ------------------------------------------------------------------ */
import { hasVault } from "./deepBuild";
import { CAMP_LEVELS, FACTS } from "../data/facts";
import { HOUSING, SCORPION_TIERS, WEAPON_BY_ID, type WeaponDef } from "../data/colony";
import { sp } from "../data/species";
import { addDino, emote, findSpawnSpot, isBaby, setState, sizeOf } from "./dinos";
import { addHuman, go, moveHuman, say, sourceFor } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { isWalkTile, isWaterTile } from "./terrain";
import { TOWER_STAGES, WALL_HP, towerMaxHp, wallMaxHp, shelterDone } from "./build";
import { buildAct, buildThink } from "./tasks";
import type { Target } from "./colony";
import type { Brute } from "./types";
import { hurtHuman } from "./injury";
import { makeCarcass } from "./carcass";
import { autoButcher } from "./tasks";
import {
  MAP_H,
  MAX_PEOPLE,
  MAP_W,
  T,
  TILE,
  type BuildingKind,
  type Danger,
  type Dino,
  type Dragon,
  type Farm,
  type Human,
  type Item,
  type Projectile,
  type Resource,
  type Role,
  type SpeciesId,
  type Tower,
  type Wall,
  type WallKind,
  type WallPart,
} from "./types";
import type { World } from "./world";

export { TOWER_STAGES, WALL_HP };

/** What a person fights with right now. */
export type Weapon = WeaponDef;
const LEGACY: Record<string, string> = { crossbow: "bow3", bow: "bow1", spear: "spear1" };

export interface RaidState {
  phase: "warn" | "attack";
  t: number;
  ids: number[];
  fromX: number;
  fromY: number;
  breached: boolean;
  label: string;
  /** a Neanderthal raid (ids are brutes, not dinos) */
  by?: "brute";
  /** people they killed or carried off */
  took?: number;
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
  /** seconds of "we won!" after a raid (people come out cheering) */
  wonCheer = 0;
  /** flames near camp the bucket brigade should put out */
  fireAlarm: { x: number; y: number } | null = null;
  private alarmT = 0;
  private gateT = 0;

  /* ------------------------------ walls ------------------------------ */

  wallAt(tx: number, ty: number) {
    return this.wallMap.get(ty * MAP_W + tx);
  }

  /** Do finished walls stop a ground dinosaur here? (closed gates + stairs too) */
  blocks(tx: number, ty: number) {
    const wl = this.wallMap.get(ty * MAP_W + tx);
    return !!wl && wl.built >= 0.5 && wl.hp > 0 && !(wl.part === "gate" && wl.open);
  }

  addWall(w: World, tx: number, ty: number, kind: WallKind, part: WallPart = "wall") {
    if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return null;
    if (!w.colony.footing(w, tx, ty)) return null;
    const ex = this.wallAt(tx, ty);
    if (ex) {
      // drawing a stronger kind over a piece upgrades it (the old materials come back when it's swapped)
      const rank = { palisade: 0, stone: 1, polygon: 2 } as const;
      const goal = ex.upgrade ? ex.upTo ?? "stone" : ex.kind;
      if (rank[kind] > rank[goal] && (part === "wall" || part === ex.part)) {
        ex.upgrade = true;
        ex.upTo = kind;
        ex.have = 0;
        this.version++;
        return ex;
      }
      // turn a wall piece into a gate / stairs
      if (part !== ex.part && part !== "wall") {
        ex.part = part;
        ex.built = 0;
        ex.have = 0;
        ex.hp = 0;
        ex.open = part === "gate";
        this.version++;
        return ex;
      }
      return null;
    }
    // never wall over the cave mouth, the fire, the stockpile or another building
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    const c = w.camp;
    if (Math.hypot(cx - c.caveX, cy - c.caveY) < 50 || Math.hypot(cx - c.pileX, cy - c.pileY) < 70 || Math.hypot(cx - c.x, cy - c.y) < 60) return null;
    if (this.towers.some((o) => tx >= o.tx && tx <= o.tx + 1 && ty >= o.ty && ty <= o.ty + 1)) return null;
    if (w.colony.occupied(w).has(ty * MAP_W + tx)) return null;
    const wl: Wall = { id: w.nextId(), tx, ty, kind, part, open: part === "gate", auto: true, hp: 0, built: 0, have: 0 };
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

  /**
   * Plan a grand bone gate here: a fresh one in a gap, a blueprint turned into one,
   * or a finished gate / wall piece queued to be rebuilt (it keeps working meanwhile).
   */
  planBoneGate(w: World, tx: number, ty: number, kind: WallKind) {
    const ex = this.wallAt(tx, ty);
    if (ex) {
      if (ex.bone || ex.boneUp || ex.part === "stairs") return null;
      if (ex.built < 1) {
        ex.part = "gate";
        ex.bone = true;
        ex.open = true;
        ex.have = 0;
      } else ex.boneUp = true;
      this.version++;
      return ex;
    }
    const wl = this.addWall(w, tx, ty, kind, "gate");
    if (wl) wl.bone = true;
    return wl;
  }

  /** Every wall ring gets one grand entrance: its front gate (or a straight stretch) becomes a bone gate. */
  planEntrances(w: World) {
    const seen = new Set<Wall>();
    let n = 0;
    const flat = (g: Wall) => !!this.wallAt(g.tx - 1, g.ty) && !!this.wallAt(g.tx + 1, g.ty) && !this.wallAt(g.tx, g.ty - 1) && !this.wallAt(g.tx, g.ty + 1);
    for (const start of this.walls) {
      if (seen.has(start) || start.part === "stairs") continue;
      const group: Wall[] = [];
      const q = [start];
      seen.add(start);
      while (q.length) {
        const a = q.pop()!;
        group.push(a);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const b = this.wallAt(a.tx + dx, a.ty + dy);
            if (b && !seen.has(b) && b.part !== "stairs") {
              seen.add(b);
              q.push(b);
            }
          }
      }
      if (group.length < 10 || group.some((g) => g.bone || g.boneUp)) continue;
      // the front (south-most) gate, best in a straight east-west stretch; else a straight bit of wall
      let best: Wall | null = null;
      let bs = -Infinity;
      for (const g of group) {
        const f = flat(g);
        if (g.part !== "gate" && !f) continue;
        const s = (g.part === "gate" ? 10000 : 0) + (f ? 1000 : 0) + g.ty;
        if (s > bs) {
          bs = s;
          best = g;
        }
      }
      if (best && this.planBoneGate(w, best.tx, best.ty, best.kind)) n++;
    }
    if (n && !w.flags.has("boneGateTip")) {
      w.flags.add("boneGateTip");
      const g = this.walls.find((x) => x.bone || x.boneUp)!;
      w.toast("🦴", "The tribe is raising a grand bone gate as the way in! Builders need 🦴 bones.", g.tx * TILE, g.ty * TILE);
    }
    return n;
  }

  /** Open / close a gate (manual = the player decided; the tribe stops auto-managing it for a while). */
  setGate(wl: Wall, open: boolean, manual = false) {
    if (wl.part !== "gate" || wl.open === open) return;
    wl.open = open;
    if (manual) wl.auto = false;
    this.version++;
  }

  /** Plan a row of bone spikes just outside the finished walls (gates stay clear, flanked by spikes). */
  planSpikes(w: World) {
    const c = w.camp;
    let n = 0;
    const gates = this.walls.filter((x) => x.part === "gate");
    const placed: { x: number; y: number }[] = w.colony.buildings.filter((b) => b.kind === "spikes").map((b) => ({ x: b.x, y: b.y }));
    for (const wl of this.walls) {
      if (wl.part !== "wall" || (wl.tx + wl.ty) % 2) continue;
      const wx = wl.tx * TILE + TILE / 2;
      const wy = wl.ty * TILE + TILE / 2;
      if (wy < c.caveY + 20) continue;
      const a = Math.atan2(wy - (c.y + 30), wx - c.x);
      const x = wx + Math.cos(a) * TILE * 1.7;
      const y = wy + Math.sin(a) * TILE * 1.7 + TILE / 2;
      // keep the gate mouth itself open (people + carts use it)
      if (gates.some((g) => Math.hypot(g.tx * TILE + 16 - x, g.ty * TILE + 16 - y + 16) < 40)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 40)) continue;
      if (w.colony.addBuilding(w, "spikes", x, y)) {
        placed.push({ x, y });
        n++;
      }
    }
    return n;
  }

  /** How scary the settlement looks to big predators + dragons. */
  defense(w: World) {
    let s = 0;
    s += this.walls.filter((x) => x.built >= 1 && x.hp > 0).length * (0.05);
    s += this.towers.filter((t) => t.stage >= TOWER_STAGES.length).length * 1.5;
    s += w.colony.scorpions.filter((x) => x.built >= 1).length * 2 + w.colony.scorpions.filter((x) => x.crew).length * 2;
    // skull totems + a ring of bone spikes look scary
    s += Math.min(3, w.colony.buildings.filter((b) => b.kind === "totem" && b.built >= 1).length) * 1.5;
    s += Math.min(2, w.colony.buildings.filter((b) => b.kind === "spikes" && b.built >= 1).length * 0.15);
    for (const h of w.humans) if (!h.child && this.weaponFor(w, h)) s += 0.6;
    return s;
  }

  /** Lay out a ring of wall plans around the camp (skips water + cliffs). */
  planRing(w: World, kind: WallKind) {
    const c = w.camp;
    const R = CAMP_LEVELS[this.level].radius * 0.85;
    const seen = new Set<number>();
    let n = 0;
    const ring: { tx: number; ty: number; a: number }[] = [];
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
      ring.push({ tx, ty, a });
    }
    // a gate facing south (toward the lake) and one facing east, stairs just inside each
    const gateAt = (want: number) => ring.reduce((b, r) => (Math.abs(Math.atan2(Math.sin(r.a - want), Math.cos(r.a - want))) < Math.abs(Math.atan2(Math.sin(b.a - want), Math.cos(b.a - want))) ? r : b), ring[0]);
    const gates = ring.length > 8 ? [gateAt(Math.PI / 2), gateAt(0.15)] : [];
    for (const r of ring) {
      const part: WallPart = gates.includes(r) ? "gate" : "wall";
      if (this.addWall(w, r.tx, r.ty, kind, part)) n++;
    }
    for (const g of gates) {
      // stairs one tile inside, next to the gate
      const sx = g.tx + (Math.cos(g.a) > 0.5 ? -1 : Math.cos(g.a) < -0.5 ? 1 : 1);
      const sy = g.ty + (Math.sin(g.a) > 0.5 ? -1 : Math.sin(g.a) < -0.5 ? 1 : 0);
      if (!this.wallAt(sx, sy)) this.addWall(w, sx, sy, kind, "stairs");
    }
    return n;
  }

  /* ------------------------------ helpers ------------------------------ */

  adults(w: World) {
    return w.humans.filter((h) => !h.child);
  }

  capacity(w: World) {
    return w.population.capacity(w);
  }

  foodTotal(w: World) {
    const s = w.camp.stock;
    return s.cooked + s.fish + s.crop + s.berries;
  }

  weaponFor(w: World, h: Human): Weapon | null {
    if (h.child || h.stranger) return null;
    if (h.gear.weapon && WEAPON_BY_ID[h.gear.weapon]) return WEAPON_BY_ID[h.gear.weapon];
    // everyone can make the basic version of what the tribe has invented
    const l = w.camp.learned;
    if (l.has("crossbow")) return WEAPON_BY_ID[LEGACY.crossbow];
    if (l.has("bow")) return WEAPON_BY_ID[LEGACY.bow];
    if (l.has("spear")) return WEAPON_BY_ID[LEGACY.spear];
    return null;
  }

  /* ------------------------------ inside the walls ------------------------------ */

  private enclosedCache: { v: number; inside: Uint8Array } | null = null;

  /**
   * Is this spot sealed off by the walls? Flood from the edge of the map over
   * open ground (walls + gates count as closed); whatever it can't reach is inside.
   */
  enclosed(w: World, x: number, y: number) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    if (!this.enclosedCache || this.enclosedCache.v !== w.nav.version) {
      const N = MAP_W * MAP_H;
      const blocked = (i: number) => {
        const wl = this.wallMap.get(i);
        if (wl && wl.built >= 0.5 && wl.hp > 0) return true;
        return !w.nav.passable("dino", (i % MAP_W) * TILE + TILE / 2, Math.floor(i / MAP_W) * TILE + TILE / 2) && !(wl && wl.part === "gate");
      };
      const out = new Uint8Array(N);
      const q: number[] = [];
      for (let x2 = 0; x2 < MAP_W; x2++) for (const y2 of [0, MAP_H - 1]) q.push(y2 * MAP_W + x2);
      for (let y2 = 0; y2 < MAP_H; y2++) for (const x2 of [0, MAP_W - 1]) q.push(y2 * MAP_W + x2);
      for (const i of q) out[i] = 1;
      while (q.length) {
        const i = q.pop()!;
        if (blocked(i)) continue;
        const cx = i % MAP_W;
        for (const j of [i - 1, i + 1, i - MAP_W, i + MAP_W]) {
          if (j < 0 || j >= N || out[j]) continue;
          if (Math.abs((j % MAP_W) - cx) > 1) continue;
          out[j] = 1;
          q.push(j);
        }
      }
      // inside = not reachable from outside (and not a wall itself)
      const inside = new Uint8Array(N);
      for (let i = 0; i < N; i++) inside[i] = out[i] || this.wallMap.has(i) ? 0 : 1;
      this.enclosedCache = { v: w.nav.version, inside };
    }
    return this.enclosedCache.inside[ty * MAP_W + tx] === 1;
  }

  /** Automatic weapons that defend the walls with nobody manning them. */
  autoDefense(w: World) {
    return w.colony.drones(w) + w.colony.buildings.filter((b) => b.kind === "beamTower" && b.built >= 1).length;
  }

  /** Raids don't send people inside the walls running for cover when the auto-defenses are up. */
  safeInside(w: World, h: Human) {
    return this.autoDefense(w) > 0 && this.enclosed(w, h.x, h.y) && !w.dinos.some((d) => d.raider && this.enclosed(w, d.x, d.y));
  }

  /** A bridge under fire from an occupied or powered weapon on a finished tower. */
  coveredBridge(w: World, h: Human): { x: number; y: number } | null {
    if (!this.raid) return null;
    let best: { x: number; y: number } | null = null;
    let distance = Infinity;
    for (const b of w.colony.buildings) {
      if (b.kind !== "bridge" || b.built < 1 || b.hp <= 0) continue;
      const x = b.tx * TILE + TILE / 2;
      const y = b.ty * TILE + TILE / 2;
      if (!isWaterTile(w.terrain.tiles[b.ty * MAP_W + b.tx] as T) || !w.nav.passable("human", x, y)) continue;
      if (w.dinos.some((d) => d.raider && Math.hypot(d.x - x, d.y - y) < 85) || w.rivals.brutes.some((r) => w.rivals.hostile(w, r) && Math.hypot(r.x - x, r.y - y) < 85)) continue;
      const covered = this.towers.some((t) => {
        if (t.stage < TOWER_STAGES.length || t.hp <= 0) return false;
        return w.colony.scorpions.some((s) => {
          if (s.mount !== "tower" || s.built < 1 || s.hp <= 0 || s.tx !== t.tx || s.ty !== t.ty) return false;
          const crew = w.humans.find((o) => o.id === s.crew);
          const armed = w.colony.dronesPowered(w) || !!crew && crew.state === "operate" && crew.level === 1 && Math.hypot(crew.x - s.x, crew.y - s.y) < 26;
          return armed && Math.hypot(s.x - x, s.y - y) < SCORPION_TIERS[s.tier - 1].range + 90;
        }) || w.humans.some((o) => {
          if (o.level !== 1 || o.state === "down" || (this.roleOf(o) !== "guard" && o.order?.kind !== "guard") || Math.hypot(o.x - t.x, o.y - (t.y - 18)) >= 45) return false;
          const weapon = this.weaponFor(w, o);
          return !!weapon && !weapon.melee && Math.hypot(o.x - x, o.y - y) < weapon.range + 140;
        });
      });
      const d = Math.hypot(h.x - x, h.y - y);
      if (covered && d < distance) {
        best = { x, y };
        distance = d;
      }
    }
    return best;
  }

  roleOf(h: Human): Role {
    return h.role === "auto" ? h.autoRole : h.role;
  }

  /** Is there anything for builders to do? */
  nextJob(w: World) {
    return w.buildSites().find((s) => !s.locked) ?? null;
  }

  /* ------------------------------ jobs ------------------------------ */

  private assignJobs(w: World) {
    const c = w.camp;
    // people down the mine don't fill surface jobs
    const autos = w.humans.filter((h) => !h.child && !h.under && h.role === "auto").sort((a, b) => a.id - b.id);
    const adults = this.adults(w).filter((h) => !h.under).length;
    const armed = c.learned.has("spear");
    const quota: [Role, number][] = [];
    const threat = this.raid || w.dragons.list.some((d) => d.state !== "leave" && d.state !== "flee");
    // powered Scorpions defend by themselves: plenty of them = nobody has to stand guard
    const drones = w.colony.drones(w);
    if (threat) {
      quota.push(["guard", !armed || drones >= 4 ? 0 : Math.max(1, autos.length - drones * 2)]);
    } else {
      if (armed && drones < 4) quota.push(["guard", Math.max(drones ? 0 : 1, Math.round(adults * 0.18) - drones)]);
      // more blueprints → more builders (up to about half the grown-ups)
      const pending = w.buildSites().filter((s) => !s.locked).length + (c.activeShelter(w) ? 2 : 0);
      if (pending) quota.push(["builder", Math.min(Math.max(1, Math.floor(adults * 0.55)), Math.max(1, Math.round(adults * 0.28), Math.ceil(pending / 6)))]);
      if (armed && c.stock.meat + c.stock.cooked < adults * 1.5) quota.push(["hunter", adults >= 6 ? 2 : 1]);
      if (c.learned.has("fire") && (c.stock.meat > 0 || c.stock.fish > 3)) quota.push(["cook", 1]);
      if (this.farms.length) quota.push(["farmer", Math.min(2, this.farms.length)]);
      if (w.colony.current(w)) quota.push(["smith", 1]);
      quota.push(...w.civ.quotas(w, adults));
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
    // everyone pulls on hide clothes that suit the weather
    for (const h of w.humans) if (!h.stranger) {
      w.colony.dress(w, h);
      w.colony.helm(w, h);
    }
    // fighters grab the best gear in the armory (hunters like bows, guards like spears + shields)
    for (const h of w.humans) {
      if (h.child || h.stranger) continue;
      const r = this.roleOf(h);
      if (r === "guard" || r === "hunter" || h.order || threat) w.colony.equip(w, h, r === "hunter" ? "bow" : undefined);
    }
    // scorpions need crews when danger is near: the closest guards take them (powered ones don't)
    if (!w.colony.dronesPowered(w) && (threat || w.dinos.some((d) => this.hostile(w, d)) || w.rivals.threatNear(w, w.camp.x, w.camp.y, 900))) {
      for (const s of w.colony.scorpions) {
        if (s.built < 1 || s.crew) continue;
        let best: Human | null = null;
        let bd = 1600;
        for (const h of w.humans) {
          if (h.child || h.stranger || h.taskId || h.state === "operate" || h.state === "down") continue;
          if (this.roleOf(h) !== "guard" && !(this.raid && h.role === "auto")) continue;
          if (w.colony.scorpions.some((o) => o.crew === h.id)) continue;
          const d = Math.hypot(h.x - s.x, h.y - s.y);
          if (d < bd) {
            bd = d;
            best = h;
          }
        }
        if (best) {
          s.crew = best.id;
          say(best, "To the Scorpion!");
          best.think = 0;
        }
      }
    }
  }

  /** Gates close when danger comes near and open again when it's gone. */
  private updateGates(w: World) {
    for (const g of this.walls) {
      if (g.part !== "gate" || g.built < 1) continue;
      if (!g.auto) continue;
      const gx = g.tx * TILE + 16;
      const gy = g.ty * TILE + 16;
      const danger = !!this.raid || w.dinos.some((d) => this.hostile(w, d) && Math.hypot(d.x - gx, d.y - gy) < 520) || w.rivals.threatNear(w, gx, gy, 520);
      if (danger && g.open) {
        this.setGate(g, false);
        w.sfx("thud", gx, gy, 0.6);
        if (!w.flags.has("gateShut")) {
          w.flags.add("gateShut");
          w.toast("🚪", "Danger! The tribe slammed the gates shut.", gx, gy);
        }
      } else if (!danger && !g.open) this.setGate(g, true);
    }
    // the player's manual choice lasts until the next raid ends
    if (!this.raid) for (const g of this.walls) if (g.part === "gate" && !g.auto && w.elapsed % 120 < 0.1) g.auto = true;
  }

  private updateFireAlarm(w: World) {
    const c = w.camp;
    const R = CAMP_LEVELS[this.level].radius + 260;
    let best: { x: number; y: number } | null = null;
    let bd = R;
    w.fire.active.forEach((i) => {
      const fx = (i % MAP_W) * TILE + TILE / 2;
      const fy = Math.floor(i / MAP_W) * TILE + TILE / 2;
      const d = Math.hypot(fx - c.x, fy - c.y);
      if (d < bd) {
        bd = d;
        best = { x: fx, y: fy };
      }
    });
    if (best && !this.fireAlarm) {
      const b = best as { x: number; y: number };
      if (w.camp.learned.has("firefighting")) w.toast("🪣", "Fire near camp! Everyone grab water — bucket brigade!", b.x, b.y);
      else w.toast("🔥", "Fire near camp and nobody knows how to fight it! Invent 🪣 Fire fighting in the camp's 💡 Invent tab.", b.x, b.y);
      w.sfx("yelp", b.x, b.y, 0.6);
    }
    this.fireAlarm = best;
  }

  /* ------------------------------ combat ------------------------------ */

  /** Is this dino a threat the guards should shoot at? */
  hostile(w: World, d: Dino) {
    if (d.raider) return true;
    if (d.owner) return false;
    const def = sp(d.species);
    if (def.diet === "herbivore" || def.move !== "walk" || d.state === "sleep") return false;
    return sizeOf(d) > 30 && Math.hypot(d.x - w.camp.x, d.y - w.camp.y) < CAMP_LEVELS[this.level].radius + 200;
  }

  /** Throw / shoot at a dino or a dragon. */
  shoot(w: World, h: Human, d: Dino | Dragon | Brute, wp: Weapon, bonus = 0) {
    h.dir = d.x > h.x ? 1 : -1;
    h.cd = wp.cd * (0.85 + w.rng() * 0.3);
    if (wp.melee) {
      // a swing: hits whatever is in reach
      w.sfx("whoosh", h.x, h.y, 0.5, 1.3);
      const mul = w.civ.dmgMul(w, h, wp.tier, wp.proj);
      if (d.kind === "dino") hitDino(w, d, wp.dmg * mul, h.x, h.y);
      else if (d.kind === "brute") w.rivals.hit(w, d, wp.dmg * mul, h.x, h.y, false, "melee");
      else w.dragons.hit(w, d, wp.dmg * 0.5 * mul);
      return;
    }
    const dist = Math.hypot(d.x - h.x, d.y - h.y);
    const flight = Math.max(0.12, dist / wp.speed);
    // lead the target, with a bit of wobble (better shots in towers / with heavy bows)
    const acc = Math.min(0.95, 0.62 + bonus + wp.tier * 0.05);
    const miss = (1 - acc) * 70;
    const tx = d.x + d.vx * flight + (w.rng() - 0.5) * miss;
    const ty = d.y + d.vy * flight + (w.rng() - 0.5) * miss * 0.6;
    const sz = h.z + 14;
    const tz = d.z + (d.kind === "dino" ? sizeOf(d) * 0.2 : d.kind === "brute" ? 18 : 10);
    this.projectiles.push({
      x: h.x + h.dir * 6,
      y: h.y,
      z: sz,
      vx: (tx - h.x) / flight,
      vy: (ty - h.y) / flight,
      vz: (tz - sz) / flight + 0.5 * 260 * flight,
      t: 0,
      dur: flight,
      kind: wp.proj ?? "spear",
      target: d.id,
      dmg: wp.dmg * w.civ.dmgMul(w, h, wp.tier, wp.proj),
      hit: false,
    });
    w.sfx(wp.kind === "spear" ? "whoosh" : "twang", h.x, h.y, 0.5);
  }

  /** A Scorpion bolt: heavy, fast, extra nasty to dragons. */
  fireBolt(w: World, x: number, y: number, z: number, t: Target, dmg: number, speed: number, big: number, glow = false) {
    const dist = Math.hypot(t.x - x, t.y - y);
    const flight = Math.max(0.15, dist / speed);
    const tx = t.x + t.vx * flight;
    const ty = t.y + t.vy * flight;
    this.projectiles.push({ x, y, z, vx: (tx - x) / flight, vy: (ty - y) / flight, vz: (t.z - z) / flight + 0.5 * 260 * flight, t: 0, dur: flight, kind: "scorpion", target: t.id, dmg, hit: false, big, ...(glow ? { glow: true } : {}) });
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
        const dr = d ? null : w.dragons.byId(p.target);
        if (d && Math.hypot(d.x - p.x, d.y - p.y) < sizeOf(d) * 0.45 + (p.kind === "scorpion" ? 24 : 14)) {
          hitDino(w, d, p.dmg, p.x - p.vx * 0.1, p.y - p.vy * 0.1);
          if (p.kind === "scorpion") w.particles.spawn(P.Ring, d.x, d.y, { z: sizeOf(d) * 0.4, size: 12, max: 0.5, color: "rgba(255,230,180,0.9)" });
          if (p.kind === "beam") {
            // a burst of light where the bolt lands
            w.particles.spawn(P.Ring, d.x, d.y, { z: sizeOf(d) * 0.4, size: 16, max: 0.5, color: "rgba(150,240,255,0.95)" });
            w.particles.burst(P.Spark, d.x, d.y, 12, 110, { z: sizeOf(d) * 0.4, vz: 80, g: 120, size: 2, max: 0.6, color: "#c9f7ff" });
            w.sfx("zap", d.x, d.y, 0.6, 1.3);
          }
        } else if (!d && !dr && w.rivals.byId(p.target) && Math.hypot(w.rivals.byId(p.target)!.x - p.x, w.rivals.byId(p.target)!.y - p.y) < (p.kind === "scorpion" ? 30 : 20)) {
          const b = w.rivals.byId(p.target)!;
          w.rivals.hit(w, b, p.dmg, p.x - p.vx * 0.1, p.y - p.vy * 0.1, false, p.kind);
          if (p.kind === "scorpion") w.particles.spawn(P.Ring, b.x, b.y, { z: 18, size: 12, max: 0.5, color: p.glow ? "rgba(150,240,255,0.95)" : "rgba(255,230,180,0.9)" });
        } else if (dr && Math.hypot(dr.x - p.x, dr.y - p.y) < 70) {
          // arrows mostly bounce off dragon scales; Scorpion bolts punch through
          w.dragons.hit(w, dr, p.dmg * (p.big ?? 0.5));
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
    if (r.by === "brute") return this.updateBruteRaid(w, r);
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
        this.wonCheer = 10;
        this.raidsWon++;
        this.evolution = Math.floor(this.raidsWon / 2);
        w.discover("defended", w.camp.x, w.camp.y);
        w.celebrate("We did it!");
        w.toast("🛡️", `Raid defeated! (${this.raidsWon} won) The dinos are evolving…`, w.camp.x, w.camp.y);
      }
      return;
    }
  }

  /** Neanderthals: rally at their camp, march, smash, grab, go home. */
  private updateBruteRaid(w: World, r: RaidState) {
    const party = r.ids.map((id) => w.rivals.byId(id)).filter((b): b is Brute => !!b);
    if (r.phase === "warn") {
      if (r.t > 9) {
        r.phase = "attack";
        r.t = 0;
        for (const b of party) b.think = 0;
        w.alarm(w.camp.x, w.camp.y, 600, 0.6, "❗");
        for (const h of w.humans) if (h.child) h.think = 0;
      }
      return;
    }
    const marching = party.filter((b) => b.raid);
    if (marching.length && r.t <= 240) return;
    this.raid = null;
    for (const b of marching) b.raid = false;
    if (!r.took && r.t <= 240) {
      this.wonCheer = 10;
      this.raidsWon++;
      w.discover("defended", w.camp.x, w.camp.y);
      w.celebrate("We did it!");
      w.toast("🛡️", `We drove off the Neanderthals! (${this.raidsWon} raids won)`, w.camp.x, w.camp.y);
    } else if (r.took) w.toast("😞", `The Neanderthals are heading home… we lost ${r.took} of our people to them.`, w.camp.x, w.camp.y);
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
      if (adults >= 2 && people < this.capacity(w) && this.foodTotal(w) >= Math.max(4, people * 0.8) && people < MAX_PEOPLE) {
        // the feast feeds the new arrival
        let pay = 3;
        for (const r of ["cooked", "crop", "fish", "berries"] as Resource[]) {
          const n = Math.min(pay, w.camp.stock[r]);
          w.camp.stock[r] -= n;
          pay -= n;
        }
        const parent = this.adults(w).find((a) => a.family) ?? this.adults(w)[0];
        const baby = addHuman(w, w.camp.caveX + (w.rng() - 0.5) * 40, w.camp.caveY + 30, true, { family: parent?.family || parent?.id || 0 });
        if (parent && !parent.family) parent.family = parent.id;
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
      const huts = w.shelters.filter((s) => shelterDone(s)).length;
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
    const huts = w.shelters.filter((s) => shelterDone(s)).length;
    return { ...next, havePeople: w.humans.length, haveHuts: huts, haveTech: !next.need || w.camp.learned.has(next.need as never) };
  }

  /* ------------------------------ farms ------------------------------ */

  addFarm(w: World, x: number, y: number) {
    const t = w.terrain.tileAt(x, y);
    if (!isWalkTile(t) || isWaterTile(t) || t === T.Tar || t === T.Rock || t === T.Basalt) return null;
    if (w.colony.occupied(w).has(Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE))) return null;
    if (this.farms.some((f) => Math.hypot(f.x - x, f.y - y) < 70)) return null;
    const f: Farm = { id: w.nextId(), x, y, growth: 0, planted: false };
    this.farms.push(f);
    return f;
  }

  /** Can one footprint tile of a tower go here? (solid ground or a finished bridge deck, nothing in the way but walls) */
  towerTileOk(w: World, tx: number, ty: number, occupied = w.colony.occupied(w)) {
    if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return false;
    if (!w.colony.footing(w, tx, ty)) return false;
    // a wall piece where the tower goes gets replaced by the tower
    return !!this.wallAt(tx, ty) || !occupied.has(ty * MAP_W + tx);
  }

  /**
   * Where a tower tapped at (x, y) would stand: the 2x2 centred under the
   * pointer, or else any other 2x2 that still covers the tapped tile (so a
   * tower snaps onto a deck that's just big enough). Null if none fits.
   */
  towerSpot(w: World, x: number, y: number): { tx: number; ty: number } | null {
    const occupied = w.colony.occupied(w);
    const fits = (tx: number, ty: number) => this.towerTileOk(w, tx, ty, occupied) && this.towerTileOk(w, tx + 1, ty, occupied) && this.towerTileOk(w, tx, ty + 1, occupied) && this.towerTileOk(w, tx + 1, ty + 1, occupied);
    const cx = Math.floor(x / TILE - 0.5);
    const cy = Math.floor(y / TILE) - 1;
    const px = Math.floor(x / TILE);
    const py = Math.floor(y / TILE);
    for (const [tx, ty] of [[cx, cy], [px - 1, py - 1], [px, py - 1], [px - 1, py], [px, py]]) if (fits(tx, ty)) return { tx, ty };
    return null;
  }

  /** Towers stand on a 2x2 tile footprint so walls can butt right up against them. */
  addTower(w: World, x: number, y: number) {
    const spot = this.towerSpot(w, x, y);
    if (!spot) return null;
    const { tx, ty } = spot;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const wl = this.wallAt(tx + dx, ty + dy);
        if (wl) this.removeWall(wl);
      }
    // once the tribe knows stonework, new towers go straight up in stone
    const stone = w.camp.learned.has("stonewall");
    const tw: Tower = { id: w.nextId(), x: (tx + 1) * TILE, y: (ty + 2) * TILE - 4, tx, ty, stage: 0, have: 0, hp: stone ? 900 : 400, ...(stone ? { stone } : {}) };
    this.towers.push(tw);
    this.version++;
    return tw;
  }

  /** Queue a finished wooden tower to be rebuilt in stone. Returns false if it can't be. */
  upgradeTower(w: World, t: Tower) {
    if (t.stone || t.up || t.stage < TOWER_STAGES.length || !w.camp.learned.has("stonewall")) return false;
    t.up = true;
    t.have = 0;
    this.version++;
    return true;
  }

  /* ------------------------------ update ------------------------------ */

  private planT = 20;
  private improvementDay = 1;
  /** wall version the entrances were last checked at */
  private entranceV = -1;

  /** What an un-bossed tribe decides to build next (each plan happens once; kids can erase/redo). */
  private autoPlan(w: World) {
    const c = w.camp;
    const f = w.flags;
    // full camp → another hut
    if (c.learned.has("shelter") && w.humans.length >= this.capacity(w) && !c.activeShelter(w) && w.shelters.length < 30) {
      const n = w.shelters.length;
      const a = -0.4 + n * 0.9;
      const R = CAMP_LEVELS[this.level].radius * 0.5;
      c.addShelter(w, c.x + Math.cos(a) * R, c.y + 50 + Math.sin(a) * R * 0.6);
      w.toast("🛖", "The tribe planned a new hut so the camp can grow!");
    }
    if (c.learned.has("farming") && !f.has("planFarms")) {
      const a = this.addFarm(w, c.x - 120, c.y + 150);
      const b = this.addFarm(w, c.x - 30, c.y + 165);
      if (a || b) {
        f.add("planFarms");
        w.toast("🌾", "Farm fields planned! Farmers will plant crops.", c.x, c.y + 150);
      }
    }
    if (c.learned.has("palisade") && this.raidsWon + (this.raid ? 1 : 0) >= 1 && !f.has("planRing")) {
      f.add("planRing");
      const n = this.planRing(w, "palisade");
      if (n) w.toast("🪵", "After that raid, the tribe planned a palisade wall around the camp!", c.x, c.y);
    }
    if (c.learned.has("tower") && !f.has("planTower")) {
      if (this.addTower(w, c.x + 150, c.y + 130)) f.add("planTower");
    }
    if (c.learned.has("scorpion") && !f.has("planScorpion")) {
      const tower = this.towers.find((t) => t.stage >= TOWER_STAGES.length);
      if (tower) {
        const s = w.colony.addScorpion(w, tower.x, tower.y - 10);
        if (typeof s !== "string") {
          f.add("planScorpion");
          w.toast("🎯", "The tribe planned a Scorpion on top of the watchtower!", tower.x, tower.y);
        }
      }
    }
    if (c.learned.has("medicine") && !f.has("planHealer") && w.humans.length >= 8) {
      if (w.colony.addBuilding(w, "healer", c.x - 190, c.y + 120)) {
        f.add("planHealer");
        w.toast("🌿", "The tribe planned a healing hut.", c.x - 190, c.y + 120);
      }
    }
    if (c.learned.has("fire") && !f.has("planWater") && w.camp.stock.clay >= 2) {
      if (w.colony.addBuilding(w, "waterStore", c.x + 120, c.y + 70)) f.add("planWater");
    }
    // every wall ring gets a grand bone entrance
    if (c.learned.has("palisade") && this.entranceV !== this.version) {
      this.planEntrances(w);
      this.entranceV = this.version;
    }
    // polygon age: every wall is rebuilt in shaped polygon stone
    if (w.civ.polygonAge) {
      let n = 0;
      for (const wl of this.walls) {
        if (wl.kind === "polygon" || wl.upTo === "polygon") continue;
        if (wl.built < 1 && wl.hp <= 0) wl.kind = "polygon";
        else {
          wl.upgrade = true;
          wl.upTo = "polygon";
        }
        wl.have = 0;
        n++;
      }
      if (n) {
        this.version++;
        if (!f.has("planPolyWalls")) {
          f.add("planPolyWalls");
          w.toast("🔷", "Polygon age! Builders will rebuild every wall in shaped polygon stone (fire can't touch it).", c.x, c.y);
        }
      }
    }
    if (c.learned.has("stonewall") && this.raidsWon >= 3 && !f.has("planStone")) {
      f.add("planStone");
      for (const wl of this.walls) if (wl.kind === "palisade") wl.upgrade = true;
      w.toast("🧱", "Time for stone! Builders will upgrade the walls.", c.x, c.y);
    }
  }

  /** After the first day, Auto workers plan one useful project per day. */
  private autoImprove(w: World) {
    if (w.day < 2 || this.improvementDay >= w.day) return;
    if (!w.humans.some((h) => h.role === "auto" && !h.child && !h.under && !h.stranger)) return;
    if (w.buildSites().some((site) => !site.repair && !site.locked)) return;
    this.improvementDay = w.day;
    const c = w.camp;
    const adults = w.humans.filter((h) => !h.child && !h.stranger).length;
    if (c.learned.has("shelter") && adults >= this.capacity(w) * 0.8 && !c.activeShelter(w) && w.shelters.length < 30) {
      const n = w.shelters.length;
      const a = -0.4 + n * 0.9;
      const radius = CAMP_LEVELS[this.level].radius * 0.5;
      c.addShelter(w, c.x + Math.cos(a) * radius, c.y + 50 + Math.sin(a) * radius * 0.6);
      w.toast("🛖", "Auto planned another home for the growing camp.");
      return;
    }
    if (c.learned.has("farming") && this.foodTotal(w) < adults * 2 && this.farms.length < Math.min(8, Math.ceil(adults / 8))) {
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const x = c.x + Math.cos(a) * 190;
        const y = c.y + 90 + Math.sin(a) * 130;
        if (this.addFarm(w, x, y)) {
          w.toast("🌾", "Auto planned another farm to grow more food.", x, y);
          return;
        }
      }
    }
    const plan = (kind: BuildingKind) => {
      for (const radius of [140, 205, 270]) for (let i = 0; i < 16; i++) {
        const a = (i + w.day * 3) * Math.PI / 8;
        const x = c.x + Math.cos(a) * radius;
        const y = c.y + 35 + Math.sin(a) * radius * 0.7;
        if (Math.hypot(x - c.pileX, y - c.pileY) < 70 || Math.hypot(x - c.caveX, y - c.caveY) < 70) continue;
        const b = w.colony.addBuilding(w, kind, x, y);
        if (b) {
          w.toast("🏗️", `Auto planned a ${kind === "foodStore" ? "food store" : kind === "waterStore" ? "water store" : kind === "healer" ? "healing hut" : "storage hut"}.`, b.x, b.y);
          return true;
        }
      }
      return false;
    };
    if (c.learned.has("basket") && !w.colony.buildings.some((b) => b.kind === "foodStore") && plan("foodStore")) return;
    if (c.learned.has("fire") && !w.colony.buildings.some((b) => b.kind === "waterStore") && plan("waterStore")) return;
    if (c.learned.has("axe") && !w.colony.buildings.some((b) => b.kind === "storage") && plan("storage")) return;
    if (c.learned.has("medicine") && !w.colony.buildings.some((b) => b.kind === "healer") && plan("healer")) return;
    const home = w.shelters.filter((s) => shelterDone(s) && !s.up && HOUSING[s.tier + 1] && (!HOUSING[s.tier + 1].polygon || w.civ.polygonAge)).sort((a, b) => a.tier - b.tier)[0];
    if (home && c.startUpgrade(w, home)) return;
    const tower = this.towers.find((t) => t.stage >= TOWER_STAGES.length && t.hp > 0 && !t.stone && !t.up);
    if (tower && c.learned.has("stonewall")) this.upgradeTower(w, tower);
  }

  update(w: World, dt: number) {
    this.wonCheer = Math.max(0, this.wonCheer - dt);
    this.assignT -= dt;
    if (this.assignT <= 0) {
      this.assignT = 3;
      this.assignJobs(w);
    }
    this.gateT -= dt;
    if (this.gateT <= 0) {
      this.gateT = 0.5;
      this.updateGates(w);
    }
    this.alarmT -= dt;
    if (this.alarmT <= 0) {
      this.alarmT = 2;
      this.updateFireAlarm(w);
    }
    this.planT -= dt;
    if (this.planT <= 0) {
      this.planT = 6;
      this.autoPlan(w);
      this.autoImprove(w);
    }
    for (const f of this.farms) if (f.planted && f.growth < 1) f.growth = Math.min(1, f.growth + (dt / 80) * (1 + w.weather.rain * 1.5) * (w.weather.temp > 0.85 ? 0.5 : 1) * (w.civ.has("cropRotation") ? 2 : 1));
    // crops near lava/fire get scorched
    for (const f of this.farms) {
      const tx = Math.floor(f.x / TILE);
      const ty = Math.floor(f.y / TILE);
      if (f.planted && (w.fire.at(tx, ty) > 0.3 || w.lava.heatAt(tx, ty) > 0.2)) {
        f.planted = false;
        f.growth = 0;
      }
    }
    // lava eats walls; fire eats palisades
    for (const wl of this.walls) {
      if (wl.built < 1 || wl.hp <= 0) continue;
      // polygon stone shrugs off fire and lava
      const lava = wl.kind !== "polygon" && w.lava.heatAt(wl.tx, wl.ty) > 0.3;
      const fire = wl.kind === "palisade" && w.fire.at(wl.tx, wl.ty) > 0.3;
      if (lava || fire) {
        wl.hp = Math.max(0, wl.hp - dt * (lava ? 80 : 25));
        if (wl.hp <= 0) this.collapse(w, wl);
      } else if (wl.hp <= 0) this.collapse(w, wl);
    }
    for (const t of this.towers) if (t.stage >= 1 && t.hp <= 0) {
      t.stage = 0;
      t.up = false;
      t.hp = towerMaxHp(t);
      this.version++;
      w.particles.burst(P.Dust, t.x, t.y - 20, 14, 70, { size: 12, max: 1.2, color: "rgba(160,130,90,0.6)" });
      w.toast("💥", "A watchtower came crashing down!", t.x, t.y);
    }
    this.updateProjectiles(w, dt);
    this.updateRaid(w, dt);
    this.updateGrowth(w, dt);
  }

  /** A wall piece broke: it's rubble (a blueprint again) until rebuilt. */
  collapse(w: World, wl: Wall) {
    if (wl.built < 1) return;
    if (wl.boneUp) {
      wl.boneUp = false;
      wl.bone = true;
      wl.part = "gate";
    }
    wl.hp = 0;
    wl.built = 0;
    wl.have = 0;
    this.version++;
    w.particles.burst(P.Dust, wl.tx * TILE + 16, wl.ty * TILE + 16, 10, 60, { size: 10, max: 1, color: "rgba(160,130,90,0.6)" });
    // anyone up on it tumbles down
    for (const h of w.humans) if (h.level === 1 && Math.floor(h.x / TILE) === wl.tx && Math.floor(h.y / TILE) === wl.ty) {
      h.level = 0;
      h.path = null;
      h.pathKey = 0;
      hurtHuman(w, h, 0.15, h.x, h.y - 10, "rock");
    }
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
      walls: this.walls.map((wl) => [wl.tx, wl.ty, KIND_CODE[wl.kind], Math.round(wl.hp), Math.round(wl.built * 100) / 100, wl.upgrade ? (wl.upTo === "polygon" ? 2 : 1) : 0, wl.part === "gate" ? 1 : wl.part === "stairs" ? 2 : 0, wl.open ? 1 : 0, (wl.bone ? 1 : 0) | (wl.boneUp ? 2 : 0)] as const),
      farms: this.farms.map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.growth * 100) / 100, f.planted ? 1 : 0] as const),
      towers: this.towers.map((t) => [Math.round(t.x), Math.round(t.y), t.stage, Math.max(0, t.have), t.tx, t.ty, Math.round(t.hp), (t.stone ? 1 : 0) | (t.up ? 2 : 0)] as const),
      level: this.level,
      danger: this.danger,
      evolution: this.evolution,
      raidsWon: this.raidsWon,
      raidTimer: Math.round(this.raidTimer),
      improvementDay: this.improvementDay,
    };
  }

  load(w: World, d: ReturnType<Tribe["serialize"]> | undefined) {
    if (!d) return;
    for (const row of d.walls) {
      const [tx, ty, stone, hp, built, up] = row;
      const part: WallPart = row[6] === 1 ? "gate" : row[6] === 2 ? "stairs" : "wall";
      const kind: WallKind = stone === 2 ? "polygon" : stone ? "stone" : "palisade";
      const wl: Wall = { id: w.nextId(), tx, ty, kind, part, open: row[7] === undefined ? true : !!row[7], auto: true, hp, built, have: 0, upgrade: !!up, ...(up === 2 ? { upTo: "polygon" as WallKind } : {}) };
      const bone = row[8] ?? 0;
      if (bone & 1) wl.bone = true;
      if (bone & 2) wl.boneUp = true;
      this.walls.push(wl);
      this.wallMap.set(ty * MAP_W + tx, wl);
    }
    for (const [x, y, growth, planted] of d.farms) this.farms.push({ id: w.nextId(), x, y, growth, planted: !!planted });
    for (const row of d.towers) {
      const [x, y, stage, have] = row;
      // older saves stored towers by position only: snap them onto the tile grid
      const tx = row[4] ?? Math.floor(x / TILE - 0.5);
      const ty = row[5] ?? Math.floor(y / TILE) - 1;
      const flags = row[7] ?? 0;
      this.towers.push({ id: w.nextId(), x: (tx + 1) * TILE, y: (ty + 2) * TILE - 4, tx, ty, stage, have, hp: row[6] ?? (flags & 1 ? 900 : 400), ...(flags & 1 ? { stone: true } : {}), ...(flags & 2 ? { up: true } : {}) });
    }
    this.level = d.level;
    this.danger = d.danger;
    this.evolution = d.evolution;
    this.raidsWon = d.raidsWon;
    this.raidTimer = d.raidTimer;
    this.improvementDay = d.improvementDay ?? w.day;
  }
}

/* ======================================================================= */
/*  Combat outcomes                                                         */
/* ======================================================================= */

/** A spear/arrow/bolt struck a dinosaur. */
const KIND_CODE: Record<WallKind, number> = { palisade: 0, stone: 1, polygon: 2 };

export function hitDino(w: World, d: Dino, dmg: number, fx: number, fy: number) {
  const def = sp(d.species);
  // bigger bodies soak up far more hits: a T. rex takes ~2x, a Brachiosaurus ~2.7x, a raptor ~0.65x
  const bulk = Math.max(0.6, Math.pow(sizeOf(d) / 60, 1.1));
  const hp = def.hp * bulk * (1 + d.tier * 0.7) * (0.5 + d.growth * 0.5) * (d.raider ? 1.8 : 1) * d.genes.tough;
  d.health -= dmg / hp;
  // big animals barely flinch
  d.fear = Math.min(1, d.fear + 0.35 / Math.max(1, bulk));
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

/** Down: stars, a dust poof, and a body to harvest for meat, hide, bone + teeth. */
export function downDino(w: World, d: Dino) {
  const def = sp(d.species);
  const body = makeCarcass(w, d);
  body.claimed = 0;
  w.particles.burst(P.Poof, d.x, d.y, 10, 60, { size: 12, max: 0.9, color: "rgba(235,228,210,0.95)" });
  w.particles.burst(P.Star, d.x, d.y, 3, 30, { z: 10, size: 6, max: 1 });
  w.sfx("bonk", d.x, d.y, 0.9);
  if (d.tier >= 2) {
    w.discover("alpha", d.x, d.y);
    w.toast("👑", `The ALPHA ${def.nick} is down!`, d.x, d.y);
  } else if (!w.flags.has("firstHunt")) {
    w.flags.add("firstHunt");
    w.toast("🏹", `The hunters got a ${def.nick}! Harvest it for meat, hide and bones.`, d.x, d.y, FACTS.foodChain);
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

/** A predator caught somebody: they get hurt (and knocked out if it's bad). Raiders gobble the downed. */
export function bite(w: World, d: Dino, h: Human) {
  const def = sp(d.species);
  const eats = def.diet !== "herbivore" && w.tribe.danger !== "calm";
  // somebody already knocked out is dinner
  if (h.state === "down") {
    if (eats) gobble(w, d, h);
    return;
  }
  // armed grown-ups fight back
  const wp = w.tribe.weaponFor(w, h);
  if (wp && !h.child) {
    hitDino(w, d, wp.dmg * (wp.melee ? 1.4 : 0.7), h.x, h.y);
    if (!w.dinos.includes(d)) return;
  }
  // big jaws hurt a lot more: a raptor nips, a T. rex can knock someone out in two bites
  const dmg = (0.16 + Math.min(0.6, sizeOf(d) / 190) + d.tier * 0.08) * (d.raider ? 1.2 : 1) * (w.tribe.danger === "wild" ? 1.2 : 1);
  const out = hurtHuman(w, h, dmg, d.x, d.y, "bite");
  // a hungry or big predator that knocks someone out eats them on the spot
  if (out && eats && (sizeOf(d) > 70 || d.hunger > 0.4 || d.raider)) {
    gobble(w, d, h);
    return;
  }
  emote(d, h.hp <= 0 ? "😋" : "😤", 1.5);
  d.hunger = Math.max(0, d.hunger - 0.08);
}

/** A raider finished off somebody who was down: cartoon poof, they're gone. */
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
  w.alarm(h.x, h.y, 500, 0.9, "😱", false);
  // raiders run off with their prize; wild predators settle down to digest
  if (d.raider) retreat(w, d);
  else {
    setState(d, "idle", d.x, d.y);
    d.targetId = 0;
    d.think = 4;
  }
}

/* ======================================================================= */
/*  Job behaviours (called from the cave-person brain)                     */
/* ======================================================================= */



/** Returns true if the job took over this think tick. */
export function roleThink(w: World, h: Human): boolean {
  const tribe = w.tribe;
  const camp = w.camp;
  const role = tribe.roleOf(h);
  const wp = tribe.weaponFor(w, h);

  // direct orders from the player win (dragons first: they aren't dinos)
  // a Neanderthal: go get him
  const bruteOrder = h.order?.kind === "hunt" ? w.rivals.byId(h.order.id) : null;
  if (bruteOrder) {
    if (!wp) {
      say(h, "Need a weapon!");
      h.order = null;
    } else {
      h.targetId = bruteOrder.id;
      const reach = wp.melee ? wp.range + 14 : wp.range * 0.85;
      if (Math.hypot(bruteOrder.x - h.x, bruteOrder.y - h.y) < reach) go(h, "aim", h.x, h.y);
      else go(h, "hunt", bruteOrder.x, bruteOrder.y);
      return true;
    }
  }
  const dragonOrder = h.order?.kind === "hunt" ? w.dragons.byId(h.order.id) : null;
  if (dragonOrder) {
    if (!wp || wp.melee) {
      say(h, "Need a bow for that!");
      h.order = null;
    } else {
      h.targetId = dragonOrder.id;
      if (Math.hypot(dragonOrder.x - h.x, dragonOrder.y - h.y) < wp.range) go(h, "aim", h.x, h.y);
      else go(h, "hunt", dragonOrder.x, dragonOrder.y);
      return true;
    }
  }
  if (h.order?.kind === "hunt" && !bruteOrder) {
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
  if (h.order?.kind === "guard") return guardAt(w, h, h.order.x, h.order.y, wp, undefined, !!h.order.top);

  switch (role) {
    case "guard": {
      if (!wp && !camp.learned.has("tools")) return false;
      const post = guardPost(w, h);
      return guardAt(w, h, post.x, post.y, wp, post.tower, !!post.top);
    }
    case "hunter": {
      if (!wp) return false;
      // packs: walk out with anyone working far from camp (once an ambush taught us)
      if (escort(w, h, wp)) return true;
      if (autoButcher(w, h, 1500)) return true;
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
      return buildThink(w, h, () => true);
    case "researcher":
    case "shaper":
    case "technician":
    case "miner":
      return w.civ.roleThink(w, h, role);
    case "smith": {
      const item = w.colony.current(w);
      if (!item) return false;
      if (!w.colony.affordable(w, w.colony.craftCost(item)) && w.colony.craftT <= 0) return false;
      const st = w.colony.station(w);
      if (Math.hypot(h.x - st.x, h.y - st.y) < 12) go(h, "smith", h.x, h.y);
      else {
        h.task = null;
        go(h, "walk", st.x, st.y);
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Packs: once the clans have ambushed us, an armed hunter keeps close to
 * one of our people working out in the wild and fights off anything that
 * comes for them. One escort per worker.
 */
function escort(w: World, h: Human, wp: Weapon): boolean {
  h.escort = 0;
  if (!w.flags.has("packs") || w.tribe.raid || !w.rivals.clans.length) return false;
  const c = w.camp;
  const R = CAMP_LEVELS[w.tribe.level].radius + 60;
  let best: Human | null = null;
  let bd = 1400;
  for (const o of w.humans) {
    if (o === h || o.child || o.stranger || o.captive || o.under || o.level !== 0) continue;
    if (o.state !== "gather" && o.state !== "walk" && o.state !== "carry" && o.state !== "fish" && o.state !== "haul") continue;
    if (Math.hypot(o.x - c.x, o.y - c.y) < R || w.tribe.enclosed(w, o.x, o.y)) continue;
    if (w.humans.some((q) => q !== h && q.escort === o.id)) continue;
    const d = Math.hypot(o.x - h.x, o.y - h.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  if (!best) return false;
  h.escort = best.id;
  if (w.rng() < 0.05) say(h, pick(w.rng, ["I watch your back!", "Stay close!", "I'm with you."]));
  return guardAt(w, h, best.x + (h.id % 2 ? 24 : -24), best.y + 12, wp);
}

function guardPost(w: World, h: Human): { x: number; y: number; tower?: Tower; top?: boolean } {
  const tribe = w.tribe;
  const c = w.camp;
  // assigned to a Scorpion: go crew it
  const sc = w.colony.scorpions.find((s) => s.crew === h.id && s.built >= 1);
  if (sc) {
    const spot = w.colony.crewSpot(sc);
    return { x: spot.x, y: spot.y, top: spot.top };
  }
  const guards = w.humans.filter((o) => !o.child && tribe.roleOf(o) === "guard" && !o.order && !w.colony.scorpions.some((s) => s.crew === o.id)).sort((a, b) => a.id - b.id);
  const idx = Math.max(0, guards.indexOf(h));
  const towers = tribe.towers.filter((t) => t.stage >= TOWER_STAGES.length);
  if (idx < towers.length) return { x: towers[idx].x, y: towers[idx].y - 18, tower: towers[idx], top: true };
  // the rest line the walls, if there's a walkway (and stairs) to stand on
  const walk = tribe.walls.filter((x) => x.part === "wall" && x.built >= 1 && x.hp > 0);
  if (walk.length && tribe.walls.some((x) => x.part === "stairs" && x.built >= 1)) {
    const base = tribe.raid ? Math.atan2(tribe.raid.fromY - c.y, tribe.raid.fromX - c.x) : (idx * 2.4) % (Math.PI * 2);
    let best = walk[0];
    let bs = Infinity;
    for (const wl of walk) {
      const a = Math.atan2(wl.ty * TILE - c.y, wl.tx * TILE - c.x);
      const s = Math.abs(Math.atan2(Math.sin(a - base - (idx - towers.length) * 0.25), Math.cos(a - base - (idx - towers.length) * 0.25)));
      if (s < bs && !w.humans.some((o) => o !== h && o.level === 1 && Math.floor(o.x / TILE) === wl.tx && Math.floor(o.y / TILE) === wl.ty)) {
        bs = s;
        best = wl;
      }
    }
    return { x: best.tx * TILE + TILE / 2, y: best.ty * TILE + TILE / 2, top: true };
  }
  const R = CAMP_LEVELS[tribe.level].radius * 0.62;
  // face the raid if there is one
  const base = tribe.raid ? Math.atan2(tribe.raid.fromY - c.y, tribe.raid.fromX - c.x) : Math.PI / 2;
  const spread = tribe.raid ? 0.35 : 1.1;
  const a = base + (idx - (guards.length - 1) / 2) * spread;
  return { x: c.x + Math.cos(a) * R, y: c.y + 30 + Math.sin(a) * R * 0.75 };
}

function guardAt(w: World, h: Human, x: number, y: number, wp: Weapon | null, tower?: Tower, top = false) {
  const tribe = w.tribe;
  const high = h.level === 1;
  const range = (wp?.melee ? 120 : wp?.range ?? 90) + (high ? (tower ? 140 : 60) : 0);
  // a Scorpion crew works the Scorpion
  const sc = w.colony.scorpions.find((s) => s.crew === h.id && s.built >= 1);
  if (sc) {
    const spot = w.colony.crewSpot(sc);
    if (Math.hypot(h.x - spot.x, h.y - spot.y) < 10 && (h.level === 1) === spot.top) {
      go(h, "operate", h.x, h.y);
      return true;
    }
    h.wantTop = spot.top;
    h.task = null;
    go(h, "walk", spot.x, spot.y);
    return true;
  }
  // anything nasty in range? (melee fighters on the wall stay up there)
  let target: Dino | Dragon | Brute | null = null;
  let bd = range;
  for (const d of w.dinos) {
    if (!tribe.hostile(w, d)) continue;
    const dist = Math.hypot(d.x - h.x, d.y - h.y);
    if (dist < bd) {
      bd = dist;
      target = d;
    }
  }
  for (const b of w.rivals.brutes) {
    if (!w.rivals.hostile(w, b)) continue;
    // carriers first: that's one of ours on his shoulder
    const dist = Math.hypot(b.x - h.x, b.y - h.y) - (b.captive ? 60 : 0);
    if (dist < bd) {
      bd = dist;
      target = b;
    }
  }
  if (wp && !wp.melee) {
    for (const dr of w.dragons.list) {
      if (dr.z > 260) continue;
      const dist = Math.hypot(dr.x - h.x, dr.y - h.y);
      if (dist < bd + 60) {
        bd = dist;
        target = dr;
      }
    }
  }
  if (target && wp?.melee && high) target = null;
  // posted up top: climb first, fight from the walkway (unless it's right on us)
  if (target && top && !high && bd > 90) target = null;
  if (target) {
    h.targetId = target.id;
    go(h, "aim", h.x, h.y);
    h.dir = target.x > h.x ? 1 : -1;
    if (!wp) {
      say(h, pick(w.rng, ["Shoo!", "Go away!", "Hyaaa!"]));
      if (target.kind === "dino") target.fear = Math.min(1, target.fear + 0.4);
    } else if (w.rng() < 0.15) say(h, pick(w.rng, target.kind === "brute" ? ["Fire!", "Neanderthals!", "Stop that brute!", "Hold the line!"] : ["Fire!", "Hold the line!", "Get back!", "Dino!"]));
    return true;
  }
  if (Math.hypot(h.x - x, h.y - y) > 10 || (top && h.level !== 1)) {
    h.task = null;
    h.wantTop = top;
    go(h, "walk", x, y);
  } else {
    go(h, "guard", h.x, h.y);
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
    } else if (sizeOf(d) > wp.prey * (w.civ.has("huntingHorns") ? 1.4 : 1)) continue;
    // don't poke the big scary ones unless armed with bolts
    if (def.diet !== "herbivore" && def.move === "walk" && sizeOf(d) > 60 && wp.tier < 3) continue;
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
  const reach = wp.melee ? wp.range + sizeOf(d) * 0.35 : wp.range * 0.85;
  if (dist < reach) {
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
      const d = w.dinoById(h.targetId) ?? w.dragons.byId(h.targetId) ?? w.rivals.byId(h.targetId);
      const wp = tribe.weaponFor(w, h);
      if (!d || !wp || h.stateT > 40) {
        if (h.order?.kind === "hunt" && !d) h.order = null;
        go(h, "idle", h.x, h.y);
        return true;
      }
      // re-aim the path every so often while the prey moves
      if (Math.hypot(h.tx - d.x, h.ty - d.y) > 48) {
        h.tx = d.x;
        h.ty = d.y;
      }
      moveHuman(w, h, dt);
      const reach = wp.melee ? wp.range + (d.kind === "dino" ? sizeOf(d) * 0.35 : 30) : wp.range * 0.8;
      if (Math.hypot(d.x - h.x, d.y - h.y) < reach) go(h, "aim", h.x, h.y);
      return true;
    }
    case "aim": {
      const d = w.dinoById(h.targetId) ?? w.dragons.byId(h.targetId) ?? w.rivals.byId(h.targetId);
      const wp = tribe.weaponFor(w, h);
      h.vx = h.vy = 0;
      if (!d) {
        if (h.order?.kind === "hunt") h.order = null;
        go(h, "idle", h.x, h.y);
        h.think = 0;
        return true;
      }
      h.dir = d.x > h.x ? 1 : -1;
      const high = h.level === 1;
      const tower = high && w.nav.isTower(Math.floor(h.y / TILE) * MAP_W + Math.floor(h.x / TILE));
      const size = d.kind === "dino" ? sizeOf(d) : d.kind === "brute" ? 34 : 60;
      const range = wp?.melee ? wp.range + size * 0.4 : (wp?.range ?? 90) + (high ? (tower ? 140 : 60) : 0);
      const dist = Math.hypot(d.x - h.x, d.y - h.y);
      if (dist > range * 1.15 || h.stateT > 20 || (d.kind === "dragon" && (d.z > 280 || wp?.melee))) {
        go(h, "idle", h.x, h.y);
        h.think = 0;
        return true;
      }
      if (wp && h.cd <= 0) tribe.shoot(w, h, d, wp, high ? (tower ? 0.2 : 0.1) : 0);
      // ranged fighters keep their distance from things that bite (unless safe up on the wall)
      if (((d.kind === "dino" && sp(d.species).diet !== "herbivore") || d.kind === "brute") && !wp?.melee && dist < 45 && !high) {
        const a = Math.atan2(h.y - d.y, h.x - d.x);
        go(h, "flee", h.x + Math.cos(a) * 160, h.y + Math.sin(a) * 120);
      }
      // badly hurt fighters fall back
      if (h.hp < 0.3 && !high) {
        const a = Math.atan2(h.y - d.y, h.x - d.x);
        say(h, "Falling back!");
        go(h, "flee", h.x + Math.cos(a) * 220, h.y + Math.sin(a) * 160);
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
      if (buildAct(w, h, dt)) return true;
      const wl = tribe.walls.find((x) => x.id === h.targetId);
      if (!wl || wl.built < 1) {
        go(h, "idle", h.x, h.y);
        return true;
      }
      wl.hp = Math.min(wallMaxHp(wl), wl.hp + dt * 40);
      if (w.rng() < dt * 3) w.sfx("knock", h.x, h.y, 0.35);
      if (wl.hp >= wallMaxHp(wl)) go(h, "idle", h.x, h.y);
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
    if (h.state === "hide" || h.state === "sleep" || h.state === "tossed" || h.level === 1 || h.stranger) continue;
    if (h.state === "down" && w.tribe.danger === "calm") continue;
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
    const wrapped = w.colony.kits.has("storageWraps") || w.civ.has("granary") || hasVault(w.mine);
    for (const r of ["cooked", "meat", "fish", "crop", "berries"] as Resource[]) {
      if (c.stock[r] > 0) {
        if (!wrapped || w.rng() < 0.4) c.stock[r] = Math.max(0, c.stock[r] - (wrapped ? 1 : 2));
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
    // no way round (or the path leads into a wall): smash through
    let blocked = d.stuckT > 0.7 || (d.pathI === -1 && d.stateT > 1.5);
    for (const step of [18, 36, 54]) {
      if (blocked) break;
      blocked = !d.path && tribe.blocks(Math.floor((d.x + Math.cos(a) * step) / TILE), Math.floor((d.y + Math.sin(a) * step) / TILE));
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
    if (!wl || wl.hp <= 0 || wl.built < 1 || (wl.part === "gate" && wl.open)) {
      setState(d, "raid", w.camp.pileX, w.camp.pileY);
      d.pathKey = 0;
      return true;
    }
    const dps = (6 + sizeOf(d) * 0.15) * (1 + d.tier * 0.5);
    wl.hp -= dps * dt;
    if (wl.part === "gate" && !w.flags.has("gateBash")) {
      w.flags.add("gateBash");
      w.toast("🚪", `The ${sp(d.species).nick} is trying to break down the gate!`, wl.tx * TILE, wl.ty * TILE);
    }
    d.dir = wl.tx * TILE + 16 > d.x ? 1 : -1;
    if (w.rng() < dt * 4) {
      w.particles.spawn(P.Crumb, wl.tx * TILE + 16, wl.ty * TILE + 10, { z: 16, vz: 50, vx: (w.rng() - 0.5) * 60, g: 160, size: 3, max: 0.6, color: wl.kind === "palisade" ? "#8a6238" : "#8f8a82" });
      w.sfx("thud", d.x, d.y, 0.6);
    }
    if (wl.hp <= 0) {
      tribe.collapse(w, wl);
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
    if (wl.built < 1 || wl.hp <= 0 || (wl.part === "gate" && wl.open)) continue;
    const x = wl.tx * TILE + 16;
    // gates are the weak spot: raiders go for them
    const dist = Math.hypot(x - d.x, wl.ty * TILE + 16 - d.y) - (wl.part === "gate" ? 30 : 0);
    const y = wl.ty * TILE + 16;
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
