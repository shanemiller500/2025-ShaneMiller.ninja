/* ------------------------------------------------------------------ */
/*  Civilization paths. The humming chamber turns up once the tribe is */
/*  settled; walking up to it offers the big choice. After that the    */
/*  tribe researches its own tree (researchers + materials), and on    */
/*  the Resonance path it also runs an energy grid: generators,        */
/*  stores, condensers, beam towers, pylons, lift pads — with the odd  */
/*  overload. All of the Resonance is fantasy tech for the game.       */
/* ------------------------------------------------------------------ */
import { BUILDINGS, CIV_NODES, buildingCost, type Cost } from "../data/colony";
import { BEAM, CIV_ORDER, CIV_TECH, CROSS_AFTER, CROSS_MULT, ENERGY_GEN, ENERGY_STORE, ENERGY_USE, EXPERIMENT_MATS, FREQ_MAX, FREQ_MIN, LIFT, PATH_INFO, PYRAMID_STAGES, type CivPath, type CivTechId } from "../data/civ";
import { sp } from "../data/species";
import { STONE_MUL } from "./build";
import { scorpionTarget } from "./colony";
import { emote, setState, sizeOf } from "./dinos";
import { go, say } from "./humans";
import { P } from "./particles";
import { hash2 } from "./rng";
import { isWalkTile, isWaterTile } from "./terrain";
import { hitDino } from "./tribe";
import { MAP_W, T, TILE, type Building, type BuildingKind, type Human, type Resource, type Role } from "./types";
import type { World } from "./world";

export interface Beam {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  t: number;
}

/** A shaped block / megalith floating through the air. */
export interface Lift {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  spin: number;
  /** megaliths become a standing stone when they land */
  mega: boolean;
}

export type ExperimentResult = {
  result: "resonant" | "warm" | "cold" | "fracture" | "spark" | "locked";
  /** 0..1 how close the note was */
  close: number;
  /** "higher" / "lower" nudges once you're warm */
  hint: string;
  text: string;
  note?: number;
};

const ENERGY_KINDS = new Set<BuildingKind>(["chamber", "energyTower", "obelisk", "stoneCircle", "pyramid", "condenser", "beamTower", "pylon", "levPad", "resShield"]);
const MONUMENT_KINDS = new Set<BuildingKind>(["pyramid", "obelisk", "stoneCircle"]);

export class Civ {
  path: CivPath = "none";
  /** where the humming chamber sits (0 = not surfaced yet) */
  chamberX = 0;
  chamberY = 0;
  /** someone has seen inside */
  found = false;
  /** waiting for the player to choose a path */
  choicePending = false;
  done = new Set<CivTechId>();
  current: CivTechId | null = null;
  rp = 0;
  /** materials for the current research are paid */
  paid = false;
  energy = 0;
  cap = 0;
  gen = 0;
  use = 0;
  /** water pulled out of the air (lifetime) */
  condensed = 0;
  /** materials whose true note has been found */
  tuned = new Set<Resource>();
  beams: Beam[] = [];
  lifts: Lift[] = [];
  /** bumps when something the UI shows changes */
  version = 0;
  /** 0..1 how strained the grid is (overloads come from here) */
  strain = 0;
  private failT = 60;
  private statT = 0;
  private reactT = 0;
  private liftT = 0;
  private discoverT = 0;
  private expT = 0;

  has(id: CivTechId) {
    // the Old Ways reach the polygon age through Dressed masonry
    if (id === "precisionStone" && this.done.has("masonry")) return true;
    return this.done.has(id);
  }

  /** Shaped, many-sided stonework: polygon walls, polygon houses, fire-proof buildings, energy lances. */
  get polygonAge() {
    return this.has("precisionStone");
  }
  get resonance() {
    return this.path === "resonance";
  }

  /* ----------------------------- research ----------------------------- */

  /** Late game: a few of the other path's ideas open up (at a price). */
  crossOpen() {
    if (this.path === "none") return false;
    return CIV_ORDER[this.path].filter((id) => this.done.has(id)).length >= CROSS_AFTER;
  }

  isCross(id: CivTechId) {
    return this.path !== "none" && CIV_TECH[id].path !== this.path;
  }

  available(id: CivTechId) {
    if (this.path === "none" || this.done.has(id)) return false;
    const def = CIV_TECH[id];
    if (def.path !== this.path) {
      if (!def.cross || !this.crossOpen()) return false;
      // the other path's first ideas don't need their whole tree
      return def.after.every((a) => this.done.has(a) || CIV_TECH[a].path !== this.path);
    }
    return def.after.every((a) => this.done.has(a));
  }

  costOf(id: CivTechId): Cost {
    const c = CIV_TECH[id].cost;
    if (!this.isCross(id)) return c;
    return Object.fromEntries(Object.entries(c).map(([r, n]) => [r, (n ?? 0) * CROSS_MULT]));
  }
  rpOf(id: CivTechId) {
    return CIV_TECH[id].rp * (this.isCross(id) ? CROSS_MULT : 1);
  }

  /** All research the tribe can pick right now, own path first. */
  options(): CivTechId[] {
    if (this.path === "none") return [];
    const other: Exclude<CivPath, "none"> = this.path === "traditional" ? "resonance" : "traditional";
    return [...CIV_ORDER[this.path], ...CIV_ORDER[other]].filter((id) => this.available(id));
  }

  setResearch(w: World, id: CivTechId) {
    if (!this.available(id) || this.current === id) return false;
    // switching refunds what was paid for the old one
    if (this.current && this.paid) for (const [r, n] of Object.entries(this.costOf(this.current)) as [Resource, number][]) w.camp.stock[r] += n;
    this.current = id;
    this.rp = 0;
    this.paid = false;
    this.version++;
    w.toast(CIV_TECH[id].icon, `Researching: ${CIV_TECH[id].name}${this.isCross(id) ? " (borrowed from the other path: double cost)" : ""}`);
    return true;
  }

  /** The material research is waiting on (gatherers fetch it). */
  missing(w: World): Resource | null {
    if (!this.current || this.paid) return null;
    for (const [r, n] of Object.entries(this.costOf(this.current)) as [Resource, number][]) if (w.camp.stock[r] < n) return r;
    return null;
  }

  /** Can research move forward right now? (Pays for it the first time it can.) */
  ready(w: World) {
    if (!this.current) return false;
    if (this.paid) return true;
    if (this.missing(w)) return false;
    for (const [r, n] of Object.entries(this.costOf(this.current)) as [Resource, number][]) w.camp.stock[r] -= n;
    this.paid = true;
    this.version++;
    return true;
  }

  /** Researchers add points here. */
  addRp(w: World, n: number) {
    if (!this.current || !this.ready(w)) return;
    this.rp += n;
    if (this.rp >= this.rpOf(this.current)) this.finish(w, this.current);
  }

  finish(w: World, id: CivTechId) {
    const def = CIV_TECH[id];
    this.done.add(id);
    this.current = null;
    this.rp = 0;
    this.paid = false;
    this.version++;
    w.colony.version++;
    w.shelterVersion++;
    w.celebrate("Eureka!");
    w.sfx(this.resonance ? "chime" : "sticker", w.camp.x, w.camp.y, 0.9);
    w.toast(def.icon, `${def.name} learned! ${def.what}`, w.camp.x, w.camp.y);
    if (this.done.size === 1) w.discover(this.resonance ? "civResonance" : "civTraditional");
    if (id === "levitation") w.discover("levitation");
    if (id === "monumental") w.toast("🔺", "Monumental construction: the Pyramid can be built (Build menu → Wonders). It goes up in 6 stages.");
    this.autoPick(w);
  }

  /** Keep studying something: the next idea in the path's order. */
  autoPick(w: World) {
    if (this.current || this.path === "none") return;
    const next = CIV_ORDER[this.path].find((t) => this.available(t));
    if (next) {
      this.current = next;
      this.rp = 0;
      this.paid = false;
      this.version++;
    } else if (!w.flags.has(`civDone-${this.path}`) && CIV_ORDER[this.path].every((t) => this.done.has(t))) {
      w.flags.add(`civDone-${this.path}`);
      w.toast("🏆", `Every idea of ${PATH_INFO[this.path].name} is learned!${this.crossOpen() ? " Some of the other path's ideas are open to borrow too." : ""}`);
    }
  }

  /* ----------------------------- the chamber + the choice ----------------------------- */

  /** Find a rocky spot a good walk from camp for the chamber to surface. */
  private placeChamber(w: World) {
    const cx = w.camp.x;
    const cy = w.camp.y;
    for (let k = 0; k < 600; k++) {
      const a = hash2(k, 5, w.seed + 404) * Math.PI * 2;
      const r = 520 + hash2(k, 9, w.seed + 405) * 560;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.75;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 3 || ty < 3 || tx > MAP_W - 4) continue;
      const t = w.terrain.tiles[ty * MAP_W + tx] as T;
      if (!isWalkTile(t) || isWaterTile(t) || t === T.Tar || t === T.Cave || t === T.Volcano) continue;
      // rocky ground, or right next to it
      const near = [1, -1, MAP_W, -MAP_W, 2, -2].some((o) => {
        const n = w.terrain.tiles[ty * MAP_W + tx + o] as T;
        return n === T.Rock || n === T.Cliff || n === T.Mountain || n === T.Basalt;
      });
      if (!near && t !== T.Rock && k < 450) continue;
      if (!w.nav.passable("human", x, y)) continue;
      this.chamberX = tx * TILE + TILE / 2;
      this.chamberY = ty * TILE + TILE / 2;
      w.addProp("chamber", this.chamberX, this.chamberY, 1);
      w.pois.push({ x: this.chamberX, y: this.chamberY, t: w.elapsed });
      w.toast("🎵", "A strange humming is coming from the rocks… Someone should go and look.", this.chamberX, this.chamberY);
      w.sfx("hum", this.chamberX, this.chamberY, 0.8);
      return true;
    }
    return false;
  }

  /** Is the tribe settled enough for the chamber to surface? */
  ripe(w: World) {
    return w.camp.learned.size >= 6 && w.humans.filter((h) => !h.child).length >= 3;
  }

  /** Someone reached the chamber (or the player tapped "investigate"). */
  investigate(w: World, by?: Human) {
    if (this.found || !this.chamberX) return;
    this.found = true;
    this.choicePending = true;
    this.version++;
    w.flash(0.35, "#bfefff");
    w.sfx("chime", this.chamberX, this.chamberY, 1);
    w.particles.burst(P.Star, this.chamberX, this.chamberY, 14, 80, { z: 20, size: 6, max: 1.4, color: "#bfefff" });
    w.toast("💠", `${by ? by.name + " found" : "The tribe found"} a buried chamber full of humming crystals and a meteor shard. Choose how your people will grow!`, this.chamberX, this.chamberY);
    w.discover("chamber", this.chamberX, this.chamberY);
  }

  choose(w: World, path: Exclude<CivPath, "none">) {
    if (this.path !== "none") return false;
    this.path = path;
    this.choicePending = false;
    this.found = true;
    this.version++;
    w.colony.version++;
    const info = PATH_INFO[path];
    w.celebrate(path === "resonance" ? "The Resonance!" : "The Old Ways!");
    w.toast(info.icon, `${info.name}. ${info.feel}`, this.chamberX || w.camp.x, this.chamberY || w.camp.y);
    if (path === "resonance") {
      // the chamber itself is the first, tiny generator
      this.energy = 10;
      w.sfx("hum", this.chamberX, this.chamberY, 1);
    } else {
      w.sfx("drums", w.camp.x, w.camp.y, 0.8);
    }
    // the meteor shard inside the chamber
    w.camp.stock.meteorite += 1;
    this.autoPick(w);
    // the chamber's crystals point at deposits nearby
    for (const n of w.colony.nodes) if (CIV_NODES.includes(n.kind) && Math.hypot(n.x - this.chamberX, n.y - this.chamberY) < 1100) n.found = true;
    return true;
  }

  /* ----------------------------- energy ----------------------------- */

  private finishedOf(w: World, k: BuildingKind) {
    return w.colony.buildings.filter((b) => b.kind === k && b.built >= 1);
  }

  /** Tally the grid (once a second): generation, storage, steady drain. */
  private tally(w: World) {
    let gen = 0;
    let cap = this.resonance ? 30 : 0;
    let use = 0;
    const store = this.has("energyStorage") ? 2 : 1;
    for (const b of w.colony.buildings) {
      if (b.built < 1) continue;
      gen += ENERGY_GEN[b.kind] ?? 0;
      cap += (ENERGY_STORE[b.kind] ?? 0) * (b.kind === "energyTower" ? store : 1);
      use += ENERGY_USE[b.kind] ?? 0;
    }
    if (this.resonance && this.chamberX) gen += 0.25;
    if (this.tuned.has("quartz")) gen *= 1.15;
    if (this.tuned.has("crystal")) cap *= 1.25;
    // technicians keep the hum clean
    const techs = w.humans.filter((h) => h.state === "resonate" && w.tribe.roleOf(h) === "technician").length;
    gen *= 1 + Math.min(2, techs) * 0.1;
    this.gen = gen;
    this.cap = cap;
    this.use = use;
  }

  /** Pay energy for something. */
  spend(n: number) {
    if (this.energy < n) return false;
    this.energy -= n;
    return true;
  }

  /* ----------------------------- update ----------------------------- */

  update(w: World, dt: number) {
    STONE_MUL.v = this.has("masonry") ? 1.5 : 1;
    this.discoverT -= dt;
    if (this.discoverT <= 0) {
      this.discoverT = 2;
      if (!this.chamberX && this.ripe(w)) this.placeChamber(w);
      else if (this.chamberX && !this.found) {
        const by = w.humans.find((h) => !h.child && !h.stranger && Math.hypot(h.x - this.chamberX, h.y - this.chamberY) < 90);
        if (by) this.investigate(w, by);
        else if (w.rng() < 0.15) {
          // a curious soul wanders over to see
          const idle = w.humans.find((h) => !h.child && !h.stranger && !h.taskId && !h.order && (h.state === "idle" || h.state === "walk") && w.tribe.roleOf(h) === "gatherer");
          if (idle) {
            go(idle, "explore", this.chamberX + 30, this.chamberY + 20);
            say(idle, "Humming?");
          }
        }
      }
    }
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter((b) => b.t < 0.35);
    this.updateLifts(w, dt);
    if (this.path === "none") return;

    this.statT -= dt;
    if (this.statT <= 0) {
      this.statT = 1;
      this.tally(w);
      this.autoPick(w);
    }
    // a slow trickle of ideas even without researchers (elders by the fire)
    if (this.current) this.addRp(w, dt * 0.06);

    if (!this.resonance && !this.crossEnergy(w)) return;
    // storms charge the crystals
    const storm = w.weather.storm > 0.3 ? 1.6 : 1;
    this.energy = Math.min(this.cap, this.energy + (this.gen * storm - this.use) * dt);
    if (this.energy < 0) this.energy = 0;
    this.strain = Math.max(0, Math.min(1, this.strain + dt * ((this.cap > 0 && this.energy >= this.cap * 0.97 ? 0.012 : -0.006) + (w.quake > 0 ? 0.05 : 0) + w.weather.storm * 0.002)));
    this.updateCondensers(w, dt);
    this.updateBeamTowers(w, dt);
    this.updatePylons(w, dt);
    this.levAssist(w, dt);
    this.react(w, dt);
    this.failures(w, dt);
  }

  /** Did a traditional tribe borrow a Resonance idea that needs power? */
  private crossEnergy(w: World) {
    return this.has("waterAir") && w.colony.buildings.some((b) => b.kind === "condenser" && b.built >= 1);
  }

  /** Condensers: water out of the air, faster when it's damp. */
  private updateCondensers(w: World, dt: number) {
    const list = this.finishedOf(w, "condenser");
    if (!list.length) return;
    const wt = w.weather;
    const humid = Math.min(1.4, 0.18 + wt.rain * 0.9 + wt.fog * 1.1 + wt.snow * 0.3 - Math.max(0, wt.temp - 0.7) * 0.5);
    for (const b of list) {
      if (this.energy <= 0) break;
      const got = dt * 0.05 * Math.max(0.05, humid);
      if (w.camp.stock.water < 60) {
        w.camp.stock.water += got;
        this.condensed += got;
      }
      if (w.rng() < dt * humid * 1.5) w.particles.spawn(P.Steam, b.x + (w.rng() - 0.5) * 10, b.y - 24, { vz: -10, size: 4, max: 0.8, color: "rgba(200,235,255,0.7)" });
    }
    if (this.condensed > 1 && !w.flags.has("condensed")) {
      w.flags.add("condensed");
      w.toast("💧", "Water out of thin air! The condensers fill the jars faster in rain and fog.", list[0].x, list[0].y);
      w.discover("condenser", list[0].x, list[0].y);
    }
  }

  /** Beam towers shoot raiders, angry predators and dragons. */
  private updateBeamTowers(w: World, dt: number) {
    for (const b of w.colony.buildings) {
      if (b.kind !== "beamTower" || b.built < 1) continue;
      b.cd = Math.max(0, (b.cd ?? 0) - dt);
      if (b.cd > 0) continue;
      const cost = BEAM.cost * (this.tuned.has("copper") ? 0.8 : 1);
      if (this.energy < cost) continue;
      const t = scorpionTarget(w, b.x, b.y, BEAM.range);
      if (!t) continue;
      this.energy -= cost;
      b.cd = BEAM.reload;
      this.fireBeam(w, b.x, b.y - 46, 46, t.id, t.x, t.y, t.z, BEAM.dmg * (this.tuned.has("meteorite") ? 1.3 : 1));
      if (!w.flags.has("beamShot")) {
        w.flags.add("beamShot");
        w.toast("🔆", "The beam tower fired! Each shot costs energy and it needs a few seconds to recharge.", b.x, b.y);
        w.discover("beam", b.x, b.y);
      }
    }
  }

  /** A crystal beam: instant hit, a flash, and maybe a grass fire where it lands. */
  fireBeam(w: World, x: number, y: number, z: number, targetId: number, tx: number, ty: number, tz: number, dmg: number) {
    this.beams.push({ x0: x, y0: y + z, z0: z, x1: tx, y1: ty, z1: tz, t: 0 });
    w.sfx("zap", x, y, 0.9);
    const d = w.dinoById(targetId);
    if (d) hitDino(w, d, dmg, x, y);
    else {
      const dr = w.dragons.byId(targetId);
      if (dr) w.dragons.hit(w, dr, dmg * 1.4);
    }
    w.particles.burst(P.Spark, tx, ty, 8, 90, { z: tz, vz: 60, g: 200, size: 2, max: 0.5, color: "#bff6ff" });
    w.particles.spawn(P.Ring, tx, ty, { z: tz, size: 10, max: 0.4, color: "rgba(160,240,255,0.9)" });
    // dry ground catches
    const dry = w.weather.rain < 0.2 && w.weather.snow < 0.2;
    if (dry && w.rng() < 0.3) {
      const i = Math.floor(ty / TILE) * MAP_W + Math.floor(tx / TILE);
      const tile = w.terrain.tiles[i] as T;
      if (tile === T.Grass || tile === T.Dirt || tile === T.Forest) {
        w.fire.ignite(w, Math.floor(tx / TILE), Math.floor(ty / TILE), 0.5);
        if (!w.flags.has("beamFire")) {
          w.flags.add("beamFire");
          w.toast("🔥", "The beam set the dry grass alight! Careful near your own fields.", tx, ty);
        }
      }
    }
  }

  /** Pylons within reach of each other hum a barrier between them. */
  pylonLinks(w: World) {
    const ps = this.finishedOf(w, "pylon");
    const out: [Building, Building][] = [];
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) < 240) out.push([ps[i], ps[j]]);
    return out;
  }

  private updatePylons(w: World, dt: number) {
    if (this.energy <= 0) return;
    const ps = this.finishedOf(w, "pylon");
    if (!ps.length) return;
    const links = this.pylonLinks(w);
    for (const d of w.dinos) {
      if (d.owner || d.state === "carried" || sp(d.species).move !== "walk") continue;
      const hostile = d.raider || (sp(d.species).diet !== "herbivore" && (d.state === "chase" || d.state === "stalk"));
      if (!hostile) continue;
      const r = sizeOf(d) * 0.3 + 10;
      let push: { x: number; y: number } | null = null;
      for (const p of ps) {
        const dd = Math.hypot(d.x - p.x, d.y - p.y);
        if (dd < 46 + r) push = { x: (d.x - p.x) / (dd || 1), y: (d.y - p.y) / (dd || 1) };
      }
      for (const [a, b] of links) {
        if (push) break;
        const q = segPoint(a.x, a.y - 14, b.x, b.y - 14, d.x, d.y);
        if (q.d < 16 + r) {
          // push back to the side it came from (away from camp)
          const nx = -(b.y - a.y);
          const ny = b.x - a.x;
          const len = Math.hypot(nx, ny) || 1;
          let sx = nx / len;
          let sy = ny / len;
          if ((w.camp.x - q.x) * sx + (w.camp.y - q.y) * sy > 0) {
            sx = -sx;
            sy = -sy;
          }
          push = { x: sx, y: sy };
        }
      }
      if (!push) continue;
      d.x += push.x * 90 * dt;
      d.y += push.y * 90 * dt;
      d.vx = push.x * 60;
      d.vy = push.y * 60;
      d.health -= dt * 0.04;
      this.energy = Math.max(0, this.energy - dt * 1.5);
      if (w.rng() < dt * 8) w.particles.spawn(P.Spark, d.x - push.x * 10, d.y, { z: 14, vz: 40, size: 2, max: 0.35, color: "#9feaff" });
      if (w.rng() < dt * 2) {
        w.sfx("zap", d.x, d.y, 0.4, 1.4);
        emote(d, "⚡", 1);
      }
      if (!w.flags.has("barrier")) {
        w.flags.add("barrier");
        w.toast("🛡️", "The pylon barrier is holding them back! It drains energy while it works.", d.x, d.y);
      }
    }
  }

  /** Lift pads float shaped stone from the stockpile onto nearby monuments. */
  private levAssist(w: World, dt: number) {
    if (!this.has("levitation")) return;
    this.liftT -= dt;
    if (this.liftT > 0) return;
    this.liftT = 1.4;
    const pads = this.finishedOf(w, "levPad");
    if (!pads.length || w.camp.stock.shaped <= 0) return;
    const cost = 4 * (this.tuned.has("magnetite") ? 0.7 : 1);
    if (this.energy < cost) return;
    for (const b of w.colony.buildings) {
      if (b.built >= 1) continue;
      const need = (buildingCost(b).shaped ?? 0) - (b.have.shaped ?? 0);
      if (need <= 0) continue;
      const pad = pads.find((p) => Math.hypot(p.x - b.x, p.y - b.y) < LIFT.range);
      if (!pad) continue;
      const n = Math.min(2, need, Math.floor(w.camp.stock.shaped));
      if (n <= 0) return;
      w.camp.stock.shaped -= n;
      b.have.shaped = (b.have.shaped ?? 0) + n;
      this.energy -= cost;
      this.lifts.push({ x0: pad.x, y0: pad.y, x1: b.x + (w.rng() - 0.5) * 30, y1: b.y - 6, t: 0, dur: 2.2, spin: (w.rng() - 0.5) * 6, mega: false });
      w.sfx("hum", pad.x, pad.y, 0.5, 1.3);
      return;
    }
    // polygon walls near a pad
    for (const wl of w.tribe.walls) {
      if (!(wl.built < 1 || wl.upgrade) || !(wl.kind === "polygon" || wl.upTo === "polygon")) continue;
      if (wl.have >= 2) continue;
      const x = wl.tx * TILE + TILE / 2;
      const y = wl.ty * TILE + TILE / 2;
      const pad = pads.find((p) => Math.hypot(p.x - x, p.y - y) < LIFT.range);
      if (!pad) continue;
      w.camp.stock.shaped -= 1;
      wl.have += 1;
      this.energy -= cost * 0.5;
      this.lifts.push({ x0: pad.x, y0: pad.y, x1: x, y1: y, t: 0, dur: 1.8, spin: (w.rng() - 0.5) * 6, mega: false });
      return;
    }
  }

  /** Can a megalith be floated to (x, y)? Returns the pad that reaches, or why not. */
  liftCheck(w: World, x: number, y: number): { pad: Building } | { why: string } {
    if (!this.has("levitation")) return { why: "Research Levitation first." };
    const pads = this.finishedOf(w, "levPad");
    if (!pads.length) return { why: "Build a Lift pad first." };
    const pad = pads.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b));
    if (Math.hypot(pad.x - x, pad.y - y) > LIFT.range) return { why: "Too far from a Lift pad." };
    const t = w.terrain.tileAt(x, y);
    if (!isWalkTile(t) || isWaterTile(t)) return { why: "A megalith can't stand there." };
    if (w.props.some((p) => p.kind === "megalith" && Math.hypot(p.x - x, p.y - y) < 30)) return { why: "Another stone is there." };
    if (w.camp.stock.shaped < LIFT.shaped) return { why: `Needs ${LIFT.shaped} shaped stone.` };
    if (this.energy < this.liftCost()) return { why: `Needs ${Math.ceil(this.liftCost())} energy.` };
    return { pad };
  }

  liftCost() {
    return LIFT.cost * (this.tuned.has("magnetite") ? 0.7 : 1);
  }

  /** Player's Levitate tool: float a standing stone into place. */
  levitate(w: World, x: number, y: number): string | null {
    const ok = this.liftCheck(w, x, y);
    if ("why" in ok) return ok.why;
    this.energy -= this.liftCost();
    w.camp.stock.shaped -= LIFT.shaped;
    this.lifts.push({ x0: ok.pad.x, y0: ok.pad.y, x1: x, y1: y, t: 0, dur: 3.2, spin: (w.rng() - 0.5) * 3, mega: true });
    w.sfx("hum", ok.pad.x, ok.pad.y, 0.9, 0.8);
    this.version++;
    return null;
  }

  private updateLifts(w: World, dt: number) {
    if (!this.lifts.length) return;
    for (const l of this.lifts) {
      l.t += dt;
      if (l.t >= l.dur) {
        w.particles.burst(P.Dust, l.x1, l.y1, 6, 30, { size: 7, max: 0.7, color: "rgba(190,200,210,0.6)" });
        w.sfx("knock", l.x1, l.y1, 0.6, 0.7);
        if (l.mega) {
          w.addProp("megalith", l.x1, l.y1, 0.9 + w.rng() * 0.3);
          if (!w.flags.has("megalith")) {
            w.flags.add("megalith");
            w.toast("🪨", "The megalith floated across and locked into place!", l.x1, l.y1);
          }
        }
      }
    }
    this.lifts = this.lifts.filter((l) => l.t < l.dur);
  }

  /* ----------------------------- the world notices ----------------------------- */

  private react(w: World, dt: number) {
    this.reactT -= dt;
    if (this.reactT > 0) return;
    this.reactT = 1.5;
    const hums = w.colony.buildings.filter((b) => b.built >= 1 && (b.kind === "stoneCircle" || b.kind === "obelisk" || b.kind === "energyTower" || b.kind === "pyramid"));
    const pylons = this.finishedOf(w, "pylon");
    const pyramid = w.colony.buildings.find((b) => b.kind === "pyramid" && (b.stage ?? 0) >= 2);
    for (const d of w.dinos) {
      if (d.owner || d.raider || d.state === "carried" || d.state === "sleep") continue;
      const def = sp(d.species);
      if (def.move === "fly") {
        // flyers circle the great pyramid
        if (pyramid && Math.hypot(d.x - pyramid.x, d.y - pyramid.y) < 900 && w.rng() < 0.3) {
          const a = Math.atan2(d.y - pyramid.y, d.x - pyramid.x) + 0.9;
          setState(d, "wander", pyramid.x + Math.cos(a) * 180, pyramid.y - 60 + Math.sin(a) * 110);
        }
        continue;
      }
      if (def.move !== "walk") continue;
      if (def.diet !== "herbivore") {
        // predators steer clear of humming pylons
        const p = pylons.find((p) => Math.hypot(p.x - d.x, p.y - d.y) < 260);
        if (p && this.energy > 0 && d.state !== "chase") {
          const a = Math.atan2(d.y - p.y, d.x - p.x);
          setState(d, "flee", d.x + Math.cos(a) * 300, d.y + Math.sin(a) * 300);
          if (w.rng() < 0.3) emote(d, "😖", 1.2);
        }
        continue;
      }
      // plant-eaters come to investigate the hum
      if ((d.state === "idle" || d.state === "wander") && w.rng() < 0.08) {
        const h = hums.find((b) => Math.hypot(b.x - d.x, b.y - d.y) < 700);
        if (h) {
          setState(d, "wander", h.x + (w.rng() - 0.5) * 160, h.y + 50 + w.rng() * 60);
          emote(d, "❔", 1.4);
        }
      }
    }
  }

  /* ----------------------------- things go wrong ----------------------------- */

  private failures(w: World, dt: number) {
    this.failT -= dt;
    if (this.failT > 0) return;
    this.failT = 20;
    const grid = w.colony.buildings.filter((b) => b.built >= 1 && ENERGY_KINDS.has(b.kind));
    if (!grid.length) return;
    const techs = w.humans.filter((h) => w.tribe.roleOf(h) === "technician" && !h.child).length;
    const risk = (0.02 + grid.length * 0.006 + this.strain * 0.25 + (w.quake > 0 ? 0.2 : 0) + w.weather.storm * 0.04) * (techs ? 0.4 : 1) * (w.colony.kits.has("torch") ? 0.8 : 1);
    if (w.rng() > risk) return;
    this.failT = 90;
    const roll = w.rng();
    const b = grid[Math.floor(w.rng() * grid.length)];
    if (roll < 0.35) {
      // overload: sparks, damage, maybe fire
      b.hp -= BUILDINGS[b.kind].hp * 0.35;
      this.energy *= 0.5;
      w.particles.burst(P.Spark, b.x, b.y - 30, 18, 120, { z: 20, vz: 80, g: 200, size: 2, max: 0.7, color: "#c9f7ff" });
      w.sfx("zap", b.x, b.y, 1.2, 0.6);
      w.shake(4, 0.4);
      if (w.rng() < 0.4) w.fire.ignite(w, Math.floor(b.x / TILE) + 1, Math.floor(b.y / TILE), 0.6);
      w.toast("⚡", `Overload! The ${BUILDINGS[b.kind].name.toLowerCase()} threw sparks${techs ? "" : " — a technician would have caught it"}.`, b.x, b.y);
    } else if (roll < 0.55 && w.camp.stock.crystal > 0) {
      w.camp.stock.crystal -= 1;
      w.particles.burst(P.Spark, b.x, b.y - 20, 10, 60, { z: 10, size: 2.5, max: 0.6, color: "#8fe3ff" });
      w.sfx("crack", b.x, b.y, 0.9);
      w.toast("💔", "A crystal fractured from the strain! (−1 crystal)", b.x, b.y);
    } else if (roll < 0.75) {
      this.energy = 0;
      w.sfx("powerdown", b.x, b.y, 1);
      w.toast("🔌", "Power loss! The hum stopped and the stores drained. It'll build back up.", b.x, b.y);
    } else {
      // instability: monuments + unfinished stages shake loose
      const m = w.colony.buildings.find((x) => MONUMENT_KINDS.has(x.kind)) ?? b;
      if (m.built < 1 && m.built > 0.2) {
        m.built = Math.max(0.05, m.built - 0.25);
        w.toast("🪨", `Instability! Blocks slid off the ${BUILDINGS[m.kind].name.toLowerCase()} — some work has to be redone.`, m.x, m.y);
      } else {
        m.hp -= BUILDINGS[m.kind].hp * 0.15;
        w.toast("🫨", `The ${BUILDINGS[m.kind].name.toLowerCase()} shuddered — resonance instability.`, m.x, m.y);
      }
      w.shake(6, 0.8);
      w.sfx("rumble", m.x, m.y, 0.8);
    }
    this.strain *= 0.4;
    this.version++;
  }

  /* ----------------------------- experiments ----------------------------- */

  /** Each material's hidden true note (fixed per world). */
  noteOf(w: World, r: Resource) {
    const i = EXPERIMENT_MATS.findIndex((m) => m.r === r);
    return Math.round(FREQ_MIN + 40 + hash2(i + 3, 17, w.seed + 1234) * (FREQ_MAX - FREQ_MIN - 80));
  }

  canExperiment(w: World) {
    return this.resonance && w.colony.finished("resTable");
  }

  /** Tune a material on the Resonance table. */
  experiment(w: World, r: Resource, freq: number): ExperimentResult {
    if (!this.canExperiment(w)) return { result: "locked", close: 0, hint: "", text: "Build a Resonance table first." };
    if (this.expT > w.elapsed) return { result: "locked", close: 0, hint: "", text: "The table is still ringing…" };
    if (w.camp.stock[r] < 1) return { result: "locked", close: 0, hint: "", text: `You need some ${r} to test.` };
    this.expT = w.elapsed + 0.8;
    const note = this.noteOf(w, r);
    const off = (freq - note) / note;
    const close = Math.max(0, 1 - Math.abs(off) * 4);
    const hint = off < 0 ? "higher" : "lower";
    const table = w.colony.buildings.find((b) => b.kind === "resTable" && b.built >= 1);
    const x = table?.x ?? w.camp.x;
    const y = table?.y ?? w.camp.y;
    if (Math.abs(off) < 0.035) {
      const first = !this.tuned.has(r);
      this.tuned.add(r);
      this.version++;
      w.particles.burst(P.Ring, x, y, 3, 40, { z: 20, size: 18, max: 1, color: "rgba(140,240,255,0.8)" });
      w.particles.burst(P.Star, x, y, 10, 80, { z: 20, size: 5, max: 1 });
      if (first) {
        this.energy = Math.min(Math.max(this.cap, 40), this.energy + 25);
        if (this.current) this.addRp(w, 20);
        w.discover("tuned", x, y);
        w.celebrate("It sings!");
      }
      return { result: "resonant", close: 1, hint: "", note, text: first ? `RESONANCE! ${r} sings at ${note} Hz. ${TUNE_BONUS[r] ?? ""}` : `${r} rings true at ${note} Hz.` };
    }
    // shrill notes crack brittle crystals
    const brittle = r === "crystal" || r === "quartz";
    if (brittle && off > 0.45 && w.rng() < 0.45) {
      w.camp.stock[r] -= 1;
      w.particles.burst(P.Spark, x, y, 10, 60, { z: 16, size: 2.5, max: 0.6, color: "#bff3ff" });
      w.sfx("crack", x, y, 0.9);
      return { result: "fracture", close, hint, text: `CRACK! Too shrill — the ${r} shattered (−1).` };
    }
    if (r === "magnetite" || r === "meteorite" || r === "copper") {
      if (Math.abs(off) > 0.6 && w.rng() < 0.3) {
        w.particles.burst(P.Spark, x, y, 8, 70, { z: 16, size: 2, max: 0.5, color: "#ffe28a" });
        if (w.rng() < 0.4) w.fire.ignite(w, Math.floor(x / TILE) + 1, Math.floor(y / TILE), 0.35);
        return { result: "spark", close, hint, text: "ZAP! A wild spark jumped off the table. Careful!" };
      }
    }
    if (close > 0.5) {
      if (this.current && this.paid) this.addRp(w, 1.5);
      return { result: "warm", close, hint, text: `It's humming back… try a little ${hint}.` };
    }
    return { result: "cold", close, hint, text: close > 0.15 ? `A faint buzz. Go ${hint}.` : "Nothing. Dead silence." };
  }

  /* ----------------------------- people's work ----------------------------- */

  /** Where researchers sit. */
  researchSpot(w: World) {
    const t = w.colony.buildings.find((b) => b.kind === "resTable" && b.built >= 1);
    if (t) return { ...w.colony.door(t), table: true };
    return { x: w.camp.craftX - 24, y: w.camp.craftY + 10, table: false };
  }

  /** Civ jobs. Returns true if the job took this think tick. */
  roleThink(w: World, h: Human, role: Role): boolean {
    const goWork = (x: number, y: number, state: "research" | "resonate", targetId = 0) => {
      h.targetId = targetId;
      if (Math.hypot(h.x - x, h.y - y) < 14) go(h, state, h.x, h.y);
      else {
        h.task = null;
        go(h, "walk", x, y);
      }
      return true;
    };
    switch (role) {
      case "researcher": {
        if (!this.current || !this.ready(w)) return false;
        const s = this.researchSpot(w);
        return goWork(s.x, s.y, "research");
      }
      case "shaper": {
        const yard = w.colony.buildings.find((b) => b.kind === "shapingYard" && b.built >= 1);
        if (!yard || w.camp.stock.stone < 2 || w.camp.stock.shaped >= 40) return false;
        const d = w.colony.door(yard);
        return goWork(d.x, d.y, "resonate", yard.id);
      }
      case "technician": {
        const grid = w.colony.buildings.filter((b) => b.built >= 1 && ENERGY_KINDS.has(b.kind));
        if (!grid.length) return false;
        const worst = grid.reduce((a, b) => (a.hp / BUILDINGS[a.kind].hp < b.hp / BUILDINGS[b.kind].hp ? a : b));
        const d = w.colony.door(worst);
        return goWork(d.x, d.y, "resonate", worst.id);
      }
      case "miner": {
        let best = null as (typeof w.colony.nodes)[number] | null;
        let bd = 3000;
        const wanted = this.missing(w);
        for (const n of w.colony.nodes) {
          if (!n.found || n.amount <= 0 || !(CIV_NODES.includes(n.kind) || n.kind === "iron" || n.kind === "stone")) continue;
          if (n.kind === "stone" && w.camp.stock.stone > 30) continue;
          const d = Math.hypot(n.x - w.camp.x, n.y - w.camp.y) * (wanted && n.kind === wanted ? 0.3 : CIV_NODES.includes(n.kind) ? 0.7 : 1);
          if (d < bd) {
            bd = d;
            best = n;
          }
        }
        if (!best) return false;
        const gives = best.kind === "meteorite" ? "meteorite" : (best.kind as Resource);
        h.task = gives;
        h.targetId = best.id;
        go(h, "walk", best.x + 18, best.y + 10);
        return true;
      }
    }
    return false;
  }

  /** Working at a civ station (states "research" + "resonate"). */
  work(w: World, h: Human, dt: number) {
    h.anim += dt * 3;
    const role = w.tribe.roleOf(h);
    if (h.state === "research") {
      if (!this.current || !this.ready(w)) {
        go(h, "idle", h.x, h.y);
        return;
      }
      const spot = this.researchSpot(w);
      const atTable = spot.table && Math.hypot(h.x - spot.x, h.y - spot.y) < 30;
      // past the first idea, Resonance study really needs the table
      const slow = this.resonance && this.current !== "resonance" && !atTable;
      this.addRp(w, dt * (atTable ? 1.2 : slow ? 0.3 : 0.7));
      if (w.rng() < dt * 0.6) w.particles.spawn(P.Star, h.x + (w.rng() - 0.5) * 16, h.y - 30, { z: 4, vz: 20, size: 3, max: 0.7, color: this.resonance ? "#9feaff" : "#ffe08a" });
      if (w.rng() < dt * 0.15) say(h, pickLine(w, this.resonance ? ["Hmm, it hums…", "Higher note!", "Write it down!", "Crystals…"] : ["Iron is strong.", "More seeds!", "Hmm…", "Better walls!"]));
      if (h.stateT > 25) go(h, "idle", h.x, h.y);
      return;
    }
    // resonate: shapers cut blocks, technicians tune + fix the grid
    if (role === "shaper") {
      const yard = w.colony.buildings.find((b) => b.id === h.targetId && b.built >= 1);
      if (!yard || w.camp.stock.stone < 2) {
        go(h, "idle", h.x, h.y);
        return;
      }
      const speed = (w.colony.kits.has("cutter") ? 2 : 1) * (this.tuned.has("stone") ? 1.3 : 1);
      if (w.rng() < dt * 5) w.particles.spawn(P.Crumb, h.x + h.dir * 10, h.y - 8, { z: 8, vz: 40, vx: (w.rng() - 0.5) * 50, g: 200, size: 2, max: 0.4, color: "#a9a398" });
      if (w.rng() < dt * 2) w.sfx("knock", h.x, h.y, 0.35, 1.3);
      if (h.stateT * speed >= 5) {
        w.camp.stock.stone -= 2;
        w.camp.stock.shaped += 1;
        h.stateT = 0;
        if (!w.flags.has("shapedStone")) {
          w.flags.add("shapedStone");
          w.toast("🔷", `${h.name} cut the first shaped block: many sides that lock together without mortar.`, h.x, h.y);
        }
        if (w.camp.stock.shaped >= 40) go(h, "idle", h.x, h.y);
      }
      return;
    }
    if (role === "technician") {
      const b = w.colony.buildings.find((x) => x.id === h.targetId);
      if (!b) {
        go(h, "idle", h.x, h.y);
        return;
      }
      const max = BUILDINGS[b.kind].hp;
      b.hp = Math.min(max, b.hp + dt * (w.colony.kits.has("torch") ? 40 : 25));
      this.strain = Math.max(0, this.strain - dt * 0.01);
      if (w.rng() < dt * 2) w.particles.spawn(P.Spark, h.x + h.dir * 8, h.y - 16, { z: 6, vz: 30, size: 1.6, max: 0.4, color: "#bff3ff" });
      if (h.stateT > 14 && b.hp >= max) go(h, "idle", h.x, h.y);
      return;
    }
    go(h, "idle", h.x, h.y);
  }

  /** Auto-job quotas the tribe's job board should fill. */
  quotas(w: World, adults: number): [Role, number][] {
    if (this.path === "none") return [];
    const q: [Role, number][] = [];
    if (this.current && (this.paid || !this.missing(w))) q.push(["researcher", adults >= 9 ? 2 : 1]);
    if (w.colony.finished("shapingYard") && w.camp.stock.stone >= 2 && w.camp.stock.shaped < 30) q.push(["shaper", 1]);
    if (w.colony.buildings.filter((b) => b.built >= 1 && ENERGY_KINDS.has(b.kind)).length >= 3) q.push(["technician", 1]);
    const want = this.missing(w);
    if (want && CIV_NODES.includes(want as never) && w.colony.nodes.some((n) => n.found && n.kind === want)) q.push(["miner", 1]);
    return q;
  }

  /* ----------------------------- traditional bonuses ----------------------------- */

  /** Damage multiplier for a person's weapon hit. */
  dmgMul(w: World, h: Human, tier: number, proj?: string) {
    let m = 1;
    if (this.has("ironForge") && tier >= 2 && proj !== "beam") m *= 1.35;
    if (this.has("huntingHorns") && w.tribe.roleOf(h) === "hunter") m *= 1.2;
    if (this.has("cavalry") && h.riding) m *= 2;
    if (proj === "beam" && this.tuned.has("meteorite")) m *= 1.3;
    return m;
  }

  /* ----------------------------- save / load ----------------------------- */

  clear() {
    this.path = "none";
    this.chamberX = 0;
    this.chamberY = 0;
    this.found = false;
    this.choicePending = false;
    this.done.clear();
    this.current = null;
    this.rp = 0;
    this.paid = false;
    this.energy = 0;
    this.tuned.clear();
    this.beams = [];
    this.lifts = [];
    this.version++;
  }

  serialize() {
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      path: this.path,
      chamber: [Math.round(this.chamberX), Math.round(this.chamberY)] as [number, number],
      found: this.found,
      pending: this.choicePending,
      done: Array.from(this.done),
      current: this.current,
      rp: r(this.rp),
      paid: this.paid,
      energy: r(this.energy),
      condensed: r(this.condensed),
      tuned: Array.from(this.tuned),
      strain: r(this.strain),
    };
  }

  load(d: ReturnType<Civ["serialize"]> | undefined) {
    if (!d) return;
    this.path = d.path ?? "none";
    [this.chamberX, this.chamberY] = d.chamber ?? [0, 0];
    this.found = !!d.found;
    this.choicePending = !!d.pending && this.path === "none";
    this.done = new Set((d.done ?? []).filter((t) => t in CIV_TECH));
    this.current = d.current && d.current in CIV_TECH ? d.current : null;
    this.rp = d.rp ?? 0;
    this.paid = !!d.paid;
    this.energy = d.energy ?? 0;
    this.condensed = d.condensed ?? 0;
    this.tuned = new Set(d.tuned ?? []);
    this.strain = d.strain ?? 0;
    this.version++;
  }
}

const TUNE_BONUS: Partial<Record<Resource, string>> = {
  stone: "Shapers now cut blocks faster.",
  copper: "Beam shots cost less energy.",
  quartz: "Every generator makes 15% more energy.",
  magnetite: "Levitation costs 30% less.",
  crystal: "Energy stores hold 25% more.",
  meteorite: "Beams hit 30% harder.",
};

function pickLine(w: World, list: string[]) {
  return list[Math.floor(w.rng() * list.length)];
}

/** Closest point on a segment (and how far it is). */
export function segPoint(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  const x = ax + dx * k;
  const y = ay + dy * k;
  return { x, y, d: Math.hypot(px - x, py - y) };
}

export { PYRAMID_STAGES };
