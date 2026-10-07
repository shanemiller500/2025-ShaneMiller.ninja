/* ------------------------------------------------------------------ */
/*  The extinction asteroid. Only the player can call it down. It runs  */
/*  as a short cinematic: the sky turns, animals panic, the rock grows  */
/*  in the sky, a countdown, the flash, then a shockwave rolls across  */
/*  the map killing most life, lighting fires and waking the volcano.  */
/*  Ash hangs in the air afterwards. A Deep shelter or a charged       */
/*  Resonance shield gives people a chance — never a promise.          */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { SHIELD_HOLD } from "../data/civ";
import { sp } from "../data/species";
import { emote, setState, sizeOf } from "./dinos";
import { go, say } from "./humans";
import { P } from "./particles";
import { downDino } from "./tribe";
import { hash2 } from "./rng";

const hash = (x: number, y: number) => hash2(x, y, 4242);
import { MAP_W, T, TILE, WORLD_H, WORLD_W, type Human } from "./types";
import type { World } from "./world";

export type ExtPhase = "idle" | "omen" | "shower" | "incoming" | "impact" | "aftermath" | "ended" | "ruins";

export const EXT_TIMES = { omen: 7, shower: 14, incoming: 10, impact: 7, aftermath: 14 };

/** What ends the age: an asteroid out in the wilds, or a meteor that sets off the supervolcano. */
export type ExtCause = "asteroid" | "supervolcano";

/** A creature caught by the blast: a white flash, a charred skeleton, then dust. */
export interface Ghost {
  x: number;
  y: number;
  /** body length in px */
  size: number;
  t: number;
  kind: "dino" | "human" | "dragon";
  face: number;
}

export interface ExtStats {
  dinosBefore: number;
  dinosLost: number;
  peopleBefore: number;
  peopleLost: number;
  sheltered: number;
  shieldHeld: boolean;
  buildingsLost: number;
}

export class Extinction {
  phase: ExtPhase = "idle";
  t = 0;
  /** where it lands */
  x = 0;
  y = 0;
  /** shockwave radius */
  wave = 0;
  stats: ExtStats | null = null;
  /** 0..1 how dark the ash sky is (fades over many minutes after) */
  ash = 0;
  version = 0;
  cause: ExtCause = "asteroid";
  /** creatures being incinerated right now (cosmetic, not saved) */
  ghosts: Ghost[] = [];
  /** 0..1 how far the supervolcano's tile wave has rolled */
  private tileR = 0;
  private hit = new Set<number>();
  private safe = new Set<number>();

  /** The supervolcano's dead world: nothing new arrives or grows until the ash thins. */
  get wasteland() {
    return this.cause === "supervolcano" && this.phase !== "idle" && this.phase !== "omen" && this.phase !== "shower" && this.phase !== "incoming" && this.ash > 0.3;
  }

  get active() {
    return this.phase === "omen" || this.phase === "shower" || this.phase === "incoming" || this.phase === "impact" || this.phase === "aftermath";
  }

  /** Seconds left before impact (for the countdown). */
  countdown() {
    if (this.phase === "omen") return EXT_TIMES.omen - this.t + (this.cause === "supervolcano" ? EXT_TIMES.shower : 0) + EXT_TIMES.incoming;
    if (this.phase === "shower") return EXT_TIMES.shower - this.t + EXT_TIMES.incoming;
    if (this.phase === "incoming") return EXT_TIMES.incoming - this.t;
    return 0;
  }

  trigger(w: World, cause: ExtCause = "asteroid") {
    if (this.active) return false;
    this.cause = cause;
    this.ghosts = [];
    this.tileR = 0;
    if (cause === "supervolcano") {
      // straight into the crater
      this.x = w.volcano.x;
      this.y = w.volcano.y;
    } else {
      // it comes down out in the wilds, a good way from camp: far enough to watch, close enough to matter
      const a = w.rng() * Math.PI * 2;
      this.x = Math.max(400, Math.min(WORLD_W - 400, w.camp.x + Math.cos(a) * 1500));
      this.y = Math.max(400, Math.min(WORLD_H - 400, w.camp.y + Math.sin(a) * 900));
    }
    this.phase = "omen";
    this.t = 0;
    this.wave = 0;
    this.hit.clear();
    this.safe.clear();
    this.stats = {
      dinosBefore: w.dinos.length,
      dinosLost: 0,
      peopleBefore: w.humans.length,
      peopleLost: 0,
      sheltered: 0,
      shieldHeld: false,
      buildingsLost: 0,
    };
    this.version++;
    w.sfx("rumble", w.camX, w.camY, 1.2);
    if (cause === "supervolcano") {
      w.toast("🌋", "The volcano is swelling. The ground is splitting open. Something is coming out of the sky, straight for it…", this.x, this.y);
      w.quake = Math.max(w.quake, EXT_TIMES.omen + EXT_TIMES.incoming);
      w.discover("supervolcano");
    } else w.toast("🌘", "The sky is changing colour… something is wrong.", undefined, undefined);
    w.discover("omen");
    return true;
  }

  update(w: World, dt: number) {
    if (this.phase === "idle") return;
    if (this.phase === "ruins" || this.phase === "ended") {
      // the ash slowly clears over a few in-game days
      this.ash = Math.max(this.phase === "ended" ? 0.6 : 0, this.ash - dt * 0.002);
      return;
    }
    this.t += dt;
    switch (this.phase) {
      case "omen":
        this.ash = Math.min(0.25, this.ash + dt * 0.04);
        if (w.rng() < dt * 1.5) this.unrest(w);
        if (this.cause === "supervolcano") {
          this.swell(w, dt);
          // the first little shooting stars
          if (w.rng() < dt * 0.9) this.showerRock(w, 0.18 + w.rng() * 0.14);
        }
        if (this.t >= EXT_TIMES.omen) this.next(w, this.cause === "supervolcano" ? "shower" : "incoming");
        break;
      case "shower": {
        // the meteor shower: faster and bigger and bigger…
        const k = Math.min(1, this.t / EXT_TIMES.shower);
        this.swell(w, dt);
        this.ash = Math.min(0.4, this.ash + dt * 0.015);
        if (w.rng() < dt * (1 + k * 4.5)) this.showerRock(w, 0.3 + k * 1.15 + (w.rng() - 0.5) * 0.25);
        w.shake(1 + k * 4, 0.2);
        if (this.t >= EXT_TIMES.shower) this.next(w, "incoming");
        break;
      }
      case "incoming":
        if (w.rng() < dt * 2) this.unrest(w);
        if (Math.floor(this.t) !== Math.floor(this.t - dt)) {
          const left = Math.ceil(EXT_TIMES.incoming - this.t);
          if (left <= 5 && left > 0) w.sfx("tick", w.camX, w.camY, 0.7, 1 + (5 - left) * 0.1);
        }
        w.shake(Math.min(this.cause === "supervolcano" ? 12 : 6, this.t * 0.6 * (this.cause === "supervolcano" ? 2 : 1)), 0.2);
        if (this.cause === "supervolcano") this.swell(w, dt);
        if (this.t >= EXT_TIMES.incoming) {
          if (this.cause === "supervolcano") this.superImpact(w);
          else this.impact(w);
        }
        break;
      case "impact":
        if (this.cause === "supervolcano") {
          this.wave += dt * 1250;
          this.ash = Math.min(0.95, this.ash + dt * 0.2);
          this.annihilate(w);
          this.scorchEarth(w);
          if (w.rng() < dt * 12) this.debris(w);
          if (w.rng() < dt * 3) w.sfx("boom", w.camX + (w.rng() - 0.5) * 900, w.camY, 0.9, 0.3 + w.rng() * 0.3);
          w.shake(20, 0.3);
        } else {
          this.wave += dt * 900;
          this.ash = Math.min(0.85, this.ash + dt * 0.12);
          this.sweep(w);
        }
        if (w.rng() < dt * 6) this.debris(w);
        if (this.t >= EXT_TIMES.impact) this.next(w, "aftermath");
        break;
      case "aftermath":
        this.ash = Math.min(this.cause === "supervolcano" ? 0.9 : 0.75, this.ash + dt * 0.02);
        if (w.rng() < dt * (this.cause === "supervolcano" ? 4 : 1.5)) this.debris(w);
        if (this.cause === "supervolcano") this.annihilate(w);
        if (this.t >= EXT_TIMES.aftermath) {
          this.next(w, "ended");
          w.toast(this.cause === "supervolcano" ? "🔥" : "🌑", this.cause === "supervolcano" ? "THE WORLD BURNS." : "THE AGE ENDS.");
        }
        break;
    }
    for (const g of this.ghosts) g.t += dt;
    if (this.ghosts.length) this.ghosts = this.ghosts.filter((g) => g.t < 3);
  }

  private next(w: World, p: ExtPhase) {
    this.phase = p;
    this.t = 0;
    this.version++;
    if (p === "shower") {
      w.toast("🌠", "A meteor shower! Small ones at first… they're getting bigger.", this.x, this.y);
      return;
    }
    if (p === "incoming" && this.cause === "supervolcano") {
      w.toast("☄️", "THE BIG ONE — a giant meteor, heading straight for the VOLCANO!", this.x, this.y);
      w.sfx("whoosh", this.x, this.y, 1.6, 0.3);
      return;
    }
    if (p === "incoming") {
      w.toast("☄️", "AN ASTEROID! It's coming down — everyone take cover!", this.x, this.y);
      w.sfx("whoosh", this.x, this.y, 1.4, 0.4);
      this.takeCover(w);
    }
  }

  /** Animals panic, flyers flee, people look up. */
  private unrest(w: World) {
    for (const d of w.dinos) {
      if (d.owner || d.state === "carried" || w.rng() > 0.25) continue;
      const def = sp(d.species);
      if (def.move === "fly") setState(d, "flee", d.x + (w.rng() - 0.5) * 600, -400);
      else if (def.move === "walk") {
        const a = Math.atan2(d.y - this.y, d.x - this.x);
        setState(d, "flee", d.x + Math.cos(a) * 500, d.y + Math.sin(a) * 400);
      }
      if (w.rng() < 0.3) emote(d, "😱", 1.5);
    }
    if (w.rng() < 0.5) w.sfx("roar", w.camX + (w.rng() - 0.5) * 600, w.camY, 0.5, 0.7 + w.rng() * 0.5);
  }

  /** Where each person runs: the deep shelter, the shield dome, else home. */
  private takeCover(w: World) {
    const bunker = w.colony.buildings.find((b) => b.kind === "shelterDeep" && b.built >= 1);
    const shield = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
    for (const h of w.humans) {
      if (h.state === "down" || h.under) continue;
      h.order = null;
      if (bunker) {
        const d = w.colony.door(bunker);
        go(h, "walk", d.x + (w.rng() - 0.5) * 30, d.y - 4);
      } else if (shield) go(h, "walk", shield.x + (w.rng() - 0.5) * 120, shield.y + 20 + (w.rng() - 0.5) * 80);
      say(h, "RUN!", 2);
    }
  }

  /* ------------------------------ the supervolcano ------------------------------ */

  /** One rock of the meteor shower, somewhere you can see it (never on the volcano itself). */
  private showerRock(w: World, size: number) {
    if (w.meteors.length > 9) return;
    for (let k = 0; k < 6; k++) {
      const x = w.camX + (w.rng() - 0.5) * 3200;
      const y = w.camY + (w.rng() - 0.5) * 2200;
      if (x < 120 || y < 120 || x > WORLD_W - 120 || y > WORLD_H - 120) continue;
      if (Math.hypot(x - this.x, y - this.y) < 600) continue;
      w.meteor(x, y, size, true);
      return;
    }
  }

  /** Before the hit: the mountain swells, spits lava and splits the ground around it. */
  private swell(w: World, dt: number) {
    if (w.rng() < dt * 4) {
      const a = w.rng() * Math.PI * 2;
      const r = 120 + w.rng() * 260;
      w.particles.burst(P.Spark, this.x + Math.cos(a) * r * 0.3, this.y - 160, 4, 140, { z: 60, vz: 260, g: 260, size: 3, max: 1.4, color: "#ffb347" });
    }
    if (w.rng() < dt * 0.8) {
      const tx = Math.floor(this.x / TILE + (w.rng() - 0.5) * 16);
      const ty = Math.floor(this.y / TILE + 3 + w.rng() * 5);
      w.lava.spawn(tx, ty, 2 + w.rng() * 3);
    }
  }

  /** The meteor hits the crater: the whole mountain goes up. */
  private superImpact(w: World) {
    this.next(w, "impact");
    w.flash(1, "#ffffff");
    w.shake(48, 6);
    for (const v of [2, 1.8, 1.6]) w.sfx("boom", this.x, this.y, v, 0.25);
    w.sfx("rumble", w.camX, w.camY, 2, 0.4);
    w.particles.spawn(P.Ring, this.x, this.y, { size: 120, max: 3, color: "rgba(255,250,230,0.95)" });
    w.particles.spawn(P.Ring, this.x, this.y, { size: 80, max: 2.2, color: "rgba(255,140,60,0.9)" });
    w.particles.burst(P.Rock, this.x, this.y - 120, 70, 700, { z: 200, vz: 520, g: 260, size: 7, max: 4, color: "#4a3a34" });
    w.particles.burst(P.Spark, this.x, this.y - 120, 90, 650, { z: 240, vz: 600, g: 260, size: 4, max: 3, color: "#ffcf6b" });
    w.particles.burst(P.Smoke, this.x, this.y - 100, 40, 300, { z: 300, vz: 120, size: 80, max: 8, color: "rgba(40,30,30,0.75)" });
    w.toast("🌋", "THE SUPERVOLCANO ERUPTS. The mountain is gone.", this.x, this.y);
    // the mountain blows apart: the peak becomes a molten crater
    const vx = Math.floor(this.x / TILE);
    const vy = Math.floor(this.y / TILE);
    for (let dy = -14; dy <= 14; dy++)
      for (let dx = -16; dx <= 16; dx++) {
        const d = Math.hypot(dx, dy * 1.15);
        if (d > 16) continue;
        const tx = vx + dx;
        const ty = vy + dy;
        if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= Math.floor(WORLD_H / TILE) - 1) continue;
        const i = ty * MAP_W + tx;
        if (w.terrain.tiles[i] === T.Deep) continue;
        w.terrain.setTile(tx, ty, T.Basalt);
        if (d < 12) this.melt(w, i, 1.2);
      }
    // lava pours out in every direction
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      w.lava.spawn(Math.floor(vx + Math.cos(a) * 14), Math.floor(vy + Math.sin(a) * 12), 10 + w.rng() * 10);
    }
    if (w.volcano.phase === "idle") w.volcano.mega(w, true);
    // no shelter, no shield, no mine is deep enough
    const shield = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
    if (shield) w.toast("🌀", "The Resonance shield flared once… and was swallowed by the fire.", shield.x, shield.y);
    if (w.mine.crew.length) w.toast("⛏️", "Magma floods up through the mine shaft. Nobody down there escapes.");
  }

  /** Molten rock: lava heat on a tile (it cools into basalt later). */
  private melt(w: World, i: number, heat: number) {
    w.lava.heat[i] = Math.max(w.lava.heat[i], heat);
    w.lava.active.add(i);
    w.lava.version++;
  }

  /** Everything the pyroclastic wave reaches is incinerated. Nothing is spared. */
  private annihilate(w: World) {
    const R = this.wave;
    const inR = (x: number, y: number) => Math.hypot(x - this.x, (y - this.y) * 1.1) <= R;
    for (const d of [...w.dinos]) {
      if (!inR(d.x, d.y)) continue;
      this.ghosts.push({ x: d.x, y: d.y - d.z, size: Math.max(14, sizeOf(d)), t: 0, kind: "dino", face: d.dir ?? 1 });
      if (this.stats) this.stats.dinosLost++;
      w.removeDino(d);
    }
    for (const h of [...w.humans]) {
      // miners too: the magma comes up the shaft
      const under = !!h.under;
      if (!under && !inR(h.x, h.y)) continue;
      if (under && R < Math.hypot(w.camp.caveX - this.x, w.camp.caveY - this.y)) continue;
      this.ghosts.push({ x: h.x, y: h.y, size: 14, t: 0, kind: "human", face: h.dir });
      if (under) {
        const m = w.mine.crew.findIndex((c) => c.id === h.id);
        if (m >= 0) w.mine.crew.splice(m, 1);
      }
      this.kill(w, h);
    }
    for (const dr of [...w.dragons.list]) {
      if (!inR(dr.x, dr.y)) continue;
      this.ghosts.push({ x: dr.x, y: dr.y - dr.z, size: 120, t: 0, kind: "dragon", face: dr.dir });
      w.dragons.list.splice(w.dragons.list.indexOf(dr), 1);
    }
    if (this.ghosts.length > 220) this.ghosts.splice(0, this.ghosts.length - 220);
    // everything people built: flattened, burned, gone
    let lost = 0;
    for (const b of [...w.colony.buildings]) if (inR(b.x, b.y)) {
      if (b.built >= 1) lost++;
      w.colony.removeBuilding(b);
    }
    for (const s of [...w.colony.scorpions]) if (inR(s.x, s.y)) w.colony.scorpions.splice(w.colony.scorpions.indexOf(s), 1);
    for (const wl of [...w.tribe.walls]) if (inR(wl.tx * TILE + 16, wl.ty * TILE + 16)) w.tribe.removeWall(wl);
    for (const t of [...w.tribe.towers]) if (inR(t.x, t.y)) w.tribe.towers.splice(w.tribe.towers.indexOf(t), 1);
    for (const f of [...w.tribe.farms]) if (inR(f.x, f.y)) w.tribe.farms.splice(w.tribe.farms.indexOf(f), 1);
    for (const s of [...w.shelters]) if (inR(s.x, s.y)) {
      w.shelters.splice(w.shelters.indexOf(s), 1);
      lost++;
    }
    for (const f of [...w.campfires]) if (inR(f.x, f.y)) w.campfires.splice(w.campfires.indexOf(f), 1);
    if (inR(w.camp.x, w.camp.y) && !w.flags.has("campBurned")) {
      w.flags.add("campBurned");
      for (const k of Object.keys(w.camp.stock) as (keyof typeof w.camp.stock)[]) w.camp.stock[k] = 0;
    }
    for (const it of [...w.items]) if (inR(it.x, it.y)) w.removeItem(it);
    for (const p of w.plants) if (p.burnt < 1 && inR(p.x, p.y)) {
      p.burnt = 1;
      p.stump = true;
      p.food = 0;
      p.shake = 1;
    }
    for (const e of [...w.eggs]) if (inR(e.x, e.y)) w.eggs.splice(w.eggs.indexOf(e), 1);
    if (this.stats && lost) this.stats.buildingsLost += lost;
    w.plantsDirty = true;
    w.tribe.version++;
    w.colony.version++;
    w.shelterVersion++;
  }

  /** The ground itself: scorched, cracked, molten. Rolls out with the wave. */
  private scorchEarth(w: World) {
    const R = this.wave / TILE;
    const r0 = this.tileR;
    if (R <= r0) return;
    this.tileR = R;
    const vx = this.x / TILE;
    const vy = this.y / TILE;
    const H = Math.floor(WORLD_H / TILE);
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < MAP_W; tx++) {
        const d = Math.hypot(tx - vx, (ty - vy) * 1.1);
        if (d < r0 || d >= R) continue;
        const i = ty * MAP_W + tx;
        const t = w.terrain.tiles[i] as T;
        const k = hash(tx, ty);
        if (t === T.Deep) continue;
        if (t === T.Shallow || t === T.River || t === T.Swamp) {
          // the water boils off
          w.terrain.setTile(tx, ty, T.Mud);
          if (k < 0.08) w.particles.spawn(P.Steam, tx * TILE + 16, ty * TILE + 16, { vz: 60, size: 20, max: 2.5, color: "rgba(230,230,230,0.6)" });
          continue;
        }
        if (t === T.Rock || t === T.Mountain || t === T.Cliff || t === T.Basalt) {
          // stone melts
          if (t !== T.Cliff && t !== T.Mountain) w.terrain.setTile(tx, ty, T.Basalt);
          if (k < (d < 40 ? 0.5 : 0.12)) this.melt(w, i, 0.9);
          continue;
        }
        if (t === T.Cave || t === T.Volcano) continue;
        w.terrain.setTile(tx, ty, k < 0.18 ? T.Basalt : T.Dirt);
        // cracks of lava + fire everywhere
        if (k < 0.04) this.melt(w, i, 1);
        else if (k < 0.3 && (t === T.Grass || t === T.Forest || t === T.Jungle)) w.fire.ignite(w, tx, ty, 1);
      }
  }

  private impact(w: World) {
    this.next(w, "impact");
    w.flash(1, "#fffbe8");
    w.shake(30, 3);
    w.sfx("boom", this.x, this.y, 2, 0.5);
    w.sfx("boom", w.camX, w.camY, 1.6, 0.4);
    w.particles.spawn(P.Ring, this.x, this.y, { size: 60, max: 2.5, color: "rgba(255,240,200,0.95)" });
    w.particles.burst(P.Dust, this.x, this.y, 50, 400, { size: 26, max: 3, color: "rgba(120,95,80,0.7)" });
    // a crater
    const tx = Math.floor(this.x / TILE);
    const ty = Math.floor(this.y / TILE);
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 6.2) continue;
        const i = (ty + dy) * MAP_W + tx + dx;
        const t = w.terrain.tiles[i] as T | undefined;
        if (t === undefined || t === T.Deep) continue;
        w.terrain.setTile(tx + dx, ty + dy, d < 3.5 ? T.Basalt : T.Dirt);
        if (d >= 3.5) w.fire.ignite(w, tx + dx, ty + dy, 1);
      }
    // fragments of the rock itself lie around the crater
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + w.rng();
      const x = this.x + Math.cos(a) * 260;
      const y = this.y + Math.sin(a) * 200;
      w.colony.nodes.push({ id: w.nextId(), kind: "meteorite", x, y, amount: 4, max: 4, found: true, variant: k % 4 });
    }
    // the volcano wakes
    if (w.volcano.phase === "idle") w.volcano.mega(w);
    // who is safe?
    const bunker = w.colony.buildings.find((b) => b.kind === "shelterDeep" && b.built >= 1);
    const shield = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
    const held = !!shield && w.civ.energy >= SHIELD_HOLD;
    if (held) w.civ.energy -= SHIELD_HOLD;
    if (this.stats) this.stats.shieldHeld = held;
    for (const h of w.humans) {
      let safe = false;
      if (bunker) {
        const d = w.colony.door(bunker);
        // inside (or right at the door): a good chance, never a certainty
        if (Math.hypot(h.x - d.x, h.y - d.y) < 70) safe = w.rng() < 0.85;
      }
      if (!safe && held && shield && Math.hypot(h.x - shield.x, h.y - shield.y) < 420) safe = w.rng() < 0.9;
      if (safe) {
        this.safe.add(h.id);
        h.state = "hide";
      }
    }
    if (this.stats) this.stats.sheltered = this.safe.size;
    if (held && shield) {
      w.particles.spawn(P.Ring, shield.x, shield.y, { size: 120, max: 2.5, color: "rgba(140,230,255,0.9)" });
      w.toast("🌀", "The Resonance shield is holding!", shield.x, shield.y);
    } else if (shield) {
      w.toast("🌀", `The Resonance shield flickered out — it needed ${SHIELD_HOLD} stored energy.`, shield.x, shield.y);
    }
  }

  /** The shockwave rolls outward: whatever it reaches takes the blow. */
  private sweep(w: World) {
    const R = this.wave;
    const shield = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
    const dome = (x: number, y: number) => !!this.stats?.shieldHeld && !!shield && Math.hypot(x - shield.x, y - shield.y) < 420;
    for (const d of [...w.dinos]) {
      if (this.hit.has(d.id)) continue;
      if (Math.hypot(d.x - this.x, d.y - this.y) > R) continue;
      this.hit.add(d.id);
      if (dome(d.x, d.y)) continue;
      const def = sp(d.species);
      // a few small, burrowing or deep-water animals make it through
      const small = sizeOf(d) < 26;
      const deep = def.move === "swim";
      const survive = deep ? 0.55 : small ? 0.3 : 0.06;
      if (w.rng() < survive) {
        d.health = Math.max(0.1, d.health - 0.5);
        continue;
      }
      if (this.stats) this.stats.dinosLost++;
      if (def.move === "fly" || def.move === "swim") w.removeDino(d);
      else downDino(w, d);
    }
    for (const h of [...w.humans]) {
      if (this.hit.has(h.id)) continue;
      if (Math.hypot(h.x - this.x, h.y - this.y) > R) continue;
      this.hit.add(h.id);
      if (this.safe.has(h.id) || dome(h.x, h.y)) continue;
      // deep in the mine is the safest place on the planet (the topsoil, less so)
      if (h.under) {
        const m = w.mine.crew.find((c) => c.id === h.id);
        if (m && (m.y >= 30 || w.mine.rand() < 0.5)) {
          if (this.stats) this.stats.sheltered++;
          continue;
        }
      }
      // a strong stone home helps a little
      const home = h.home ? w.shelters.find((s) => s.id === h.home) : null;
      const inHome = home && Math.hypot(home.x - h.x, home.y - h.y) < 60 && home.tier >= 3;
      if (w.rng() < (inHome ? 0.35 : 0.1)) {
        h.hp = Math.min(h.hp, 0.25);
        continue;
      }
      this.kill(w, h);
    }
    // buildings, walls, homes and plants in the wave's path
    for (const b of w.colony.buildings) {
      if (this.hit.has(-b.id) || Math.hypot(b.x - this.x, b.y - this.y) > R) continue;
      this.hit.add(-b.id);
      if (dome(b.x, b.y) || b.kind === "shelterDeep" || b.kind === "pyramid") {
        b.hp -= BUILDINGS[b.kind].hp * 0.2;
        continue;
      }
      if (b.built >= 1 && this.stats) this.stats.buildingsLost++;
      b.built = Math.min(b.built, 0.05);
      b.have = {};
      b.hp = BUILDINGS[b.kind].hp;
    }
    w.colony.version++;
    for (const wl of w.tribe.walls) {
      const x = wl.tx * TILE + 16;
      const y = wl.ty * TILE + 16;
      if (this.hit.has(-wl.id - 1e6) || Math.hypot(x - this.x, y - this.y) > R) continue;
      this.hit.add(-wl.id - 1e6);
      if (dome(x, y)) continue;
      wl.hp -= wl.kind === "palisade" ? 9999 : wl.kind === "stone" ? 500 : 350;
    }
    for (const s of w.shelters) {
      if (this.hit.has(-s.id - 2e6) || Math.hypot(s.x - this.x, s.y - this.y) > R) continue;
      this.hit.add(-s.id - 2e6);
      if (!dome(s.x, s.y)) s.hp -= s.tier >= 3 ? 0.5 : 1.2;
    }
    for (const p of w.plants) {
      if (p.burnt >= 1 || Math.hypot(p.x - this.x, p.y - this.y) > R) continue;
      if (dome(p.x, p.y)) continue;
      p.burnt = Math.max(p.burnt, 0.6 + w.rng() * 0.4);
      p.shake = 1;
    }
    // fire along the front
    for (let k = 0; k < 8; k++) {
      const a = w.rng() * Math.PI * 2;
      const x = this.x + Math.cos(a) * R;
      const y = this.y + Math.sin(a) * R;
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H || dome(x, y)) continue;
      if (w.rng() < 0.35) w.fire.ignite(w, Math.floor(x / TILE), Math.floor(y / TILE), 0.8);
    }
    w.plantsDirty = true;
  }

  private kill(w: World, h: Human) {
    w.particles.burst(P.Dust, h.x, h.y, 6, 40, { size: 8, max: 0.8, color: "rgba(90,80,70,0.6)" });
    const i = w.humans.indexOf(h);
    if (i >= 0) w.humans.splice(i, 1);
    w.events.push({ type: "removed", id: h.id });
    if (this.stats) this.stats.peopleLost++;
  }

  /** Burning rocks rain down. */
  private debris(w: World) {
    const x = Math.max(100, Math.min(WORLD_W - 100, this.x + (w.rng() - 0.5) * 3600));
    const y = Math.max(100, Math.min(WORLD_H - 100, this.y + (w.rng() - 0.5) * 2400));
    if (w.meteors.length < 6) w.meteor(x, y);
  }

  /** "Observe the ruins": close the summary, keep watching the ashen world. */
  observe() {
    if (this.phase === "ended") {
      this.phase = "ruins";
      this.version++;
    }
  }

  clear() {
    this.phase = "idle";
    this.cause = "asteroid";
    this.ghosts = [];
    this.t = 0;
    this.wave = 0;
    this.ash = 0;
    this.stats = null;
    this.hit.clear();
    this.safe.clear();
    this.version++;
  }

  serialize() {
    if (this.phase === "idle") return undefined;
    return { phase: this.phase, t: Math.round(this.t * 10) / 10, x: Math.round(this.x), y: Math.round(this.y), ash: Math.round(this.ash * 100) / 100, stats: this.stats, cause: this.cause };
  }

  load(d: ReturnType<Extinction["serialize"]>) {
    if (!d) return;
    // a save made mid-impact picks up as the aftermath (the wave doesn't run twice)
    this.phase = d.phase === "impact" ? "aftermath" : d.phase;
    this.t = d.phase === "impact" ? 0 : d.t;
    this.x = d.x;
    this.y = d.y;
    this.ash = d.ash;
    this.stats = d.stats;
    this.cause = d.cause ?? "asteroid";
    this.version++;
  }
}

