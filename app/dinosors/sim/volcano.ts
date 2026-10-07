/* ------------------------------------------------------------------ */
/*  Volcano + lava. Lava "heads" crawl downhill over the height map,   */
/*  leaving hot tiles that ignite plants, boil water into new rock,    */
/*  and slowly cool into basalt. The eruption is a staged sequence.    */
/* ------------------------------------------------------------------ */
import { FACTS } from "../data/facts";
import { P } from "./particles";
import { LM, VEG_TILES, isWaterTile } from "./terrain";
import { MAP_H, MAP_W, T, TILE } from "./types";
import type { World } from "./world";
import { hurtHuman } from "./injury";
import { sizeOf } from "./dinos";

interface LavaHead {
  x: number;
  y: number;
  vol: number;
  step: number;
}

export class LavaSystem {
  heat = new Float32Array(MAP_W * MAP_H);
  active = new Set<number>();
  heads: LavaHead[] = [];
  version = 0;

  heatAt(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 0;
    return this.heat[ty * MAP_W + tx];
  }

  spawn(tx: number, ty: number, vol: number) {
    this.heads.push({ x: tx, y: ty, vol, step: 0 });
  }

  private deposit(w: World, tx: number, ty: number, amt: number) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
    const i = ty * MAP_W + tx;
    const t = w.terrain.tiles[i];
    if (t === T.Mountain) return;
    if (isWaterTile(t)) {
      // lava meets water: hiss, steam, and brand new land
      w.terrain.setTile(tx, ty, T.Basalt);
      for (let k = 0; k < 4; k++) w.particles.spawn(P.Steam, tx * TILE + TILE / 2, ty * TILE + TILE / 2, { vz: 40 + Math.random() * 30, size: 14, max: 2, color: "rgba(240,240,240,0.7)" });
      w.sfx("hiss", tx * TILE, ty * TILE, 0.8);
      return;
    }
    this.heat[i] = Math.min(1.2, this.heat[i] + amt);
    this.active.add(i);
    this.version++;
  }

  update(w: World, dt: number) {
    const rng = w.rng;
    for (const h of this.heads) {
      h.step += dt;
      if (h.step < 0.45) continue;
      h.step = 0;
      let best = -1;
      let bestH = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = h.x + dx;
          const ny = h.y + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          const j = ny * MAP_W + nx;
          if (w.terrain.tiles[j] === T.Mountain) continue;
          const score = w.terrain.height[j] + this.heat[j] * 0.08 + rng() * 0.05;
          if (score < bestH) {
            bestH = score;
            best = j;
          }
        }
      }
      if (best < 0) {
        h.vol = 0;
        continue;
      }
      h.x = best % MAP_W;
      h.y = (best - h.x) / MAP_W;
      this.deposit(w, h.x, h.y, 1);
      if (h.vol > 0.7) {
        this.deposit(w, h.x + (rng() < 0.5 ? 1 : -1), h.y, 0.7);
        this.deposit(w, h.x, h.y + (rng() < 0.5 ? 1 : -1), 0.7);
      }
      h.vol -= 0.035;
      if (isWaterTile(w.terrain.tiles[best])) h.vol -= 0.3;
    }
    this.heads = this.heads.filter((h) => h.vol > 0);

    // cool down, ignite neighbours, glow
    const cooled: number[] = [];
    for (const i of Array.from(this.active)) {
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      const ht = this.heat[i] - dt * (0.009 + w.weather.rain * 0.02);
      if (ht <= 0.04) {
        this.heat[i] = 0;
        cooled.push(i);
        continue;
      }
      this.heat[i] = ht;
      if (ht > 0.5 && rng() < dt * 0.15) w.fire.ignite(w, x + Math.floor(rng() * 3) - 1, y + Math.floor(rng() * 3) - 1, 0.6);
      if (ht > 0.3 && rng() < dt * 0.6) w.burnPlantsAt(x * TILE + TILE / 2, y * TILE + TILE / 2, 1);
      const px = x * TILE + TILE / 2;
      const py = y * TILE + TILE / 2;
      if (w.inView(px, py, 80) && rng() < dt * 0.8 * ht) {
        w.particles.spawn(P.Ember, px + (rng() - 0.5) * 20, py + (rng() - 0.5) * 20, { vz: 30 + rng() * 40, size: 2, max: 0.8, color: "#ff8a3d" });
      }
    }
    for (const i of cooled) {
      this.active.delete(i);
      const x = i % MAP_W;
      w.terrain.setTile(x, (i - x) / MAP_W, T.Basalt);
    }
    if (cooled.length) {
      this.version++;
      if (this.active.size === 0 && w.flags.has("lavaFlowed") && !w.flags.has("lavaCool")) {
        w.flags.add("lavaCool");
        w.toast("🪨", "The lava cooled into new rock!", undefined, undefined, FACTS.lavaCool);
      }
    }
  }

  clear() {
    this.heat.fill(0);
    this.active.clear();
    this.heads = [];
  }
}

export type VolcanoPhase = "idle" | "rumble" | "build" | "erupt" | "ash";

interface Ejecta {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

export class Volcano {
  phase: VolcanoPhase = "idle";
  t = 0;
  /** 0..1 crater glow */
  glow = 0.2;
  /** 0..1 how dark the ash sky is */
  ash = 0;
  cooldown = 0;
  rocks: Ejecta[] = [];
  /** the asteroid-triggered MEGA eruption is running */
  megaOn = false;
  /** 0..1 glowing cracks down the cone (mega only) */
  crack = 0;
  private puffT = 0;
  readonly x = LM.volcano.x * TILE + TILE / 2;
  readonly y = LM.volcano.y * TILE + TILE / 2;
  /** crater sits up the cone, visually */
  readonly craterZ = 150;

  /** Start the full eruption sequence. */
  trigger(w: World, rumbleOnly = false) {
    if (this.phase !== "idle") return false;
    this.phase = "rumble";
    this.t = 0;
    this.rumbleOnly = rumbleOnly;
    w.sfx("rumble", this.x, this.y, 1);
    w.alarm(this.x, this.y, 2200, rumbleOnly ? 0.25 : 0.4, "❗");
    return true;
  }

  rumbleOnly = false;

  /** An asteroid hit the volcano: the biggest show in Dinosaur Land. */
  mega(w: World, quiet = false) {
    if (this.megaOn) return false;
    this.phase = "rumble";
    this.t = 0;
    this.megaOn = true;
    this.rumbleOnly = false;
    this.crack = 0;
    w.quake = 7;
    w.shake(16, 6);
    w.sfx("rumble", this.x, this.y, 1.6);
    w.alarm(this.x, this.y, 6000, 1, "😱", true);
    if (!quiet) w.toast("☄️", "The asteroid cracked the volcano! The ground is shaking — MEGA ERUPTION incoming!", this.x, this.y);
    return true;
  }

  update(w: World, dt: number) {
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const rng = w.rng;
    const cx = this.x;
    const cy = this.y;

    // ambient smoke puffs
    this.puffT -= dt;
    const smokeRate = this.phase === "idle" ? 0.6 : this.phase === "rumble" ? 0.2 : this.phase === "build" ? 0.06 : 0.04;
    if (this.puffT <= 0) {
      this.puffT = smokeRate;
      const big = this.phase === "build" || this.phase === "erupt";
      w.particles.spawn(P.Smoke, cx + (rng() - 0.5) * 30, cy, {
        z: this.craterZ,
        vz: 25 + rng() * (big ? 60 : 15),
        vx: w.weather.windX * 12 + (rng() - 0.5) * 10,
        vy: w.weather.windY * 4 - 4,
        size: big ? 30 + rng() * 30 : 16 + rng() * 14,
        max: big ? 6 : 5,
        color: big ? "rgba(60,55,55,0.55)" : "rgba(120,115,110,0.35)",
      });
    }

    switch (this.phase) {
      case "idle":
        this.glow += (0.22 + Math.sin(w.elapsed * 0.7) * 0.05 - this.glow) * dt;
        this.ash = Math.max(0, this.ash - dt * 0.02);
        break;
      case "rumble":
        this.glow += ((this.megaOn ? 0.8 : 0.45) - this.glow) * dt;
        if (this.megaOn) {
          // the cone splits: glowing cracks spread, rocks tumble, everything panics
          this.crack = Math.min(1, this.crack + dt * 0.16);
          if (rng() < dt * 10) w.shake(9, 0.35);
          if (rng() < dt * 3) w.alarm(this.x, this.y, 5000, 0.8, "😱", true);
          if (rng() < dt * 4) this.launchRock(w, 0.6);
          if (rng() < dt * 10) w.particles.spawn(P.Smoke, cx + (rng() - 0.5) * 300, cy + 100 * rng(), { z: 40 + rng() * 80, vz: 40, size: 24, max: 3, color: "rgba(70,60,55,0.5)" });
        }
        if (rng() < dt * 4) w.shake(3, 0.3);
        if (rng() < dt * 6) w.particles.spawn(P.Dust, cx + (rng() - 0.5) * 300, cy + 120 + rng() * 140, { vz: 10, size: 10, max: 1.2, color: "rgba(150,130,110,0.5)" });
        if (this.t > (this.megaOn ? 6.5 : 3.5)) {
          if (this.rumbleOnly) {
            this.phase = "idle";
            w.toast("🌋", "The volcano grumbled… then settled down.");
          } else {
            this.phase = "build";
            this.t = 0;
            w.sfx("rumble", cx, cy, 1.2);
          }
        }
        break;
      case "build":
        this.glow += (1 - this.glow) * dt * 0.8;
        if (this.megaOn) this.crack = Math.min(1, this.crack + dt * 0.3);
        if (rng() < dt * 8) w.shake(this.megaOn ? 10 : 5, 0.25);
        if (this.t > (this.megaOn ? 4 : 3)) this.erupt(w);
        break;
      case "erupt": {
        this.glow = 1;
        this.ash = Math.min(1, this.ash + dt * 0.12);
        // lava fountain
        for (let k = 0; k < 3; k++) {
          if (rng() < dt * 30) {
            w.particles.spawn(P.Ember, cx + (rng() - 0.5) * 30, cy, { z: this.craterZ, vz: 150 + rng() * 200, vx: (rng() - 0.5) * 120, vy: (rng() - 0.5) * 60, g: 220, size: 3 + rng() * 3, max: 2, color: rng() < 0.5 ? "#ffdd55" : "#ff6a1f" });
          }
        }
        if (rng() < dt * (this.megaOn ? 14 : 3)) this.launchRock(w, this.megaOn ? 2.6 : 1);
        if (rng() < dt * 3) w.shake(this.megaOn ? 12 : 6, 0.3);
        if (this.megaOn) {
          // a column of ash + a second wave of lava halfway through
          if (rng() < dt * 30) w.particles.spawn(P.Smoke, cx + (rng() - 0.5) * 80, cy, { z: this.craterZ + rng() * 120, vz: 120 + rng() * 120, vx: (rng() - 0.5) * 80 + w.weather.windX * 10, size: 40 + rng() * 40, max: 7, color: "rgba(55,48,46,0.6)" });
          if (this.t > 6 && this.t - dt <= 6) this.pourLava(w, 5, 1.6);
          if (rng() < dt * 0.8) this.ashFall(w);
        }
        if (this.t > (this.megaOn ? 16 : 7)) {
          this.phase = "ash";
          this.t = 0;
        }
        break;
      }
      case "ash":
        this.glow += (0.5 - this.glow) * dt * 0.1;
        if (this.t < (this.megaOn ? 70 : 30)) this.ash = Math.min(1, this.ash + dt * (this.megaOn ? 0.03 : 0.01));
        else this.ash = Math.max(0, this.ash - dt * 0.03);
        this.crack = Math.max(0, this.crack - dt * 0.006);
        if (this.megaOn && rng() < dt * 0.4) this.ashFall(w);
        if (this.t > (this.megaOn ? 110 : 60)) {
          this.phase = "idle";
          this.cooldown = 90;
          if (this.megaOn) {
            this.megaOn = false;
            w.toast("🌄", "The sky is clearing. The land around the volcano will never be quite the same!");
          }
        }
        break;
    }

    // ballistic rocks
    for (const r of this.rocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      r.vz -= 260 * dt;
      if (w.rng() < dt * 20) w.particles.spawn(P.Smoke, r.x, r.y, { z: r.z, vz: 5, size: 5, max: 0.8, color: "rgba(80,70,70,0.4)" });
    }
    const landed = this.rocks.filter((r) => r.z <= 0);
    this.rocks = this.rocks.filter((r) => r.z > 0);
    for (const r of landed) {
      const tx = Math.floor(r.x / TILE);
      const ty = Math.floor(r.y / TILE);
      w.particles.burst(P.Dust, r.x, r.y, 6, 60, { size: 8, max: 1, color: "rgba(110,90,80,0.6)" });
      w.particles.burst(P.Ember, r.x, r.y, 5, 50, { vz: 60, g: 200, size: 2, max: 0.8, color: "#ff8a3d" });
      w.fire.ignite(w, tx, ty, 0.8);
      w.sfx("thud", r.x, r.y, 0.6);
      w.knock(r.x, r.y, 50 + r.size * 2);
      // big lava bombs smash structures + hurt anyone underneath
      if (r.size > 7) {
        w.crush(r.x, r.y, 40 + r.size * 3, r.size / 14);
        w.particles.spawn(P.Ring, r.x, r.y, { size: r.size * 2, max: 0.6, color: "rgba(255,180,90,0.8)" });
      }
      for (const h of w.humans) if (Math.hypot(h.x - r.x, h.y - r.y) < 34 + r.size && h.level === 0 && h.state !== "hide") hurtHuman(w, h, 0.18 + r.size * 0.02, r.x, r.y, "rock");
      for (const d of w.dinos) if (Math.hypot(d.x - r.x, d.y - r.y) < 30 + r.size * 2 + sizeOf(d) * 0.3) {
        d.health -= 0.15;
        d.burn = 0;
      }
    }
  }

  /** Ash settles: grass + forest near the cone turn grey (temporarily ruined ground). */
  private ashFall(w: World) {
    const rng = w.rng;
    for (let k = 0; k < 6; k++) {
      const a = rng() * Math.PI * 2;
      const rr = 10 + rng() * 26;
      const tx = Math.round(LM.volcano.x + Math.cos(a) * rr);
      const ty = Math.round(LM.volcano.y + 4 + Math.sin(a) * rr * 0.8);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const t = w.terrain.tiles[ty * MAP_W + tx] as T;
      if (VEG_TILES.has(t)) {
        w.terrain.setTile(tx, ty, T.Dirt);
        w.burnPlantsAt(tx * TILE + 16, ty * TILE + 16, 0.4);
      }
    }
  }

  private pourLava(w: World, n: number, vol: number) {
    const rng = w.rng;
    for (let k = 0; k < n; k++) {
      const a = Math.PI * 0.5 + (rng() - 0.5) * Math.PI * 1.7;
      w.lava.spawn(Math.round(LM.volcano.x + Math.cos(a) * 3), Math.round(LM.volcano.y + Math.sin(a) * 3), vol + rng() * 0.8);
    }
  }

  private erupt(w: World) {
    this.phase = "erupt";
    this.t = 0;
    const mega = this.megaOn;
    w.sfx("boom", this.x, this.y, mega ? 2 : 1.5);
    w.shake(mega ? 26 : 14, mega ? 3 : 1.2);
    w.flash(mega ? 0.9 : 0.5, "#ffb070");
    w.particles.spawn(P.Ring, this.x, this.y, { z: this.craterZ, size: mega ? 60 : 20, max: mega ? 2 : 1.2, color: "rgba(255,200,140,0.8)" });
    if (mega) w.particles.spawn(P.Ring, this.x, this.y, { size: 120, max: 2.6, color: "rgba(255,240,210,0.7)" });
    for (let k = 0; k < (mega ? 24 : 6); k++) this.launchRock(w, mega ? 2.4 : 1);
    // lava pours over the rim, mostly downhill
    const rng = w.rng;
    this.pourLava(w, mega ? 9 : 3 + Math.floor(rng() * 2), mega ? 1.8 : 1);
    w.flags.add("lavaFlowed");
    w.flags.delete("lavaCool");
    w.alarm(this.x, this.y, mega ? 8000 : 2600, 1, "😱", true);
    w.discover("eruption", this.x, this.y);
    if (mega) {
      w.discover("megaEruption", this.x, this.y);
      w.toast("🌋", "MEGA ERUPTION!!! Lava rivers, flying rocks and an ash cloud — everybody take cover!", this.x, this.y, FACTS.volcano);
      w.celebrate("RUN!!");
    } else w.toast("🌋", "ERUPTION! Everybody run!", this.x, this.y, FACTS.volcano);
  }

  private launchRock(w: World, power = 1) {
    const rng = w.rng;
    const a = rng() * Math.PI * 2;
    const s = (120 + rng() * 260) * (power > 1 ? 0.7 + rng() * power * 0.6 : power);
    this.rocks.push({ x: this.x, y: this.y, z: this.craterZ, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: 200 + rng() * 160 * Math.min(2, power), size: 5 + rng() * (power > 1 ? 9 : 6) });
    if (this.rocks.length > (this.megaOn ? 90 : 40)) this.rocks.shift();
  }

  get active() {
    return this.phase !== "idle";
  }
}
