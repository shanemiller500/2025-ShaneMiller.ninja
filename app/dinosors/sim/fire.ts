/* ------------------------------------------------------------------ */
/*  Wildfire: a tile grid of heat + fuel. Only burning tiles are       */
/*  iterated (active set), with a hard cap so a huge blaze can't       */
/*  tank the frame rate. Rain douses, wind pushes, ash regrows.        */
/* ------------------------------------------------------------------ */
import { P } from "./particles";
import { MAP_H, MAP_W, T, TILE } from "./types";
import type { World } from "./world";

const MAX_ACTIVE = 650;

export function baseFuel(t: T) {
  switch (t) {
    case T.Forest:
      return 1;
    case T.Jungle:
      return 0.85;
    case T.Grass:
      return 0.55;
    case T.Nest:
      return 0.4;
    case T.Swamp:
      return 0.15;
    case T.Dirt:
      return 0.1;
    default:
      return 0;
  }
}

export class FireSystem {
  heat = new Float32Array(MAP_W * MAP_H);
  fuel = new Float32Array(MAP_W * MAP_H);
  burnt = new Float32Array(MAP_W * MAP_H);
  active = new Set<number>();
  scorched = new Set<number>();
  private recoverT = 0;
  /** bumps when scorch marks change, so the renderer can refresh them */
  version = 0;

  initFuel(w: World) {
    for (let i = 0; i < this.fuel.length; i++) this.fuel[i] = baseFuel(w.terrain.tiles[i]);
  }

  at(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 0;
    return this.heat[ty * MAP_W + tx];
  }

  /** Try to set a tile alight. Returns true if it caught. */
  ignite(w: World, tx: number, ty: number, power = 0.6) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    const i = ty * MAP_W + tx;
    if (this.active.size >= MAX_ACTIVE) return false;
    // plants on bare ground still burn
    const plantFuel = w.plantFuelNear(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
    const fuel = Math.max(this.fuel[i], plantFuel);
    if (fuel < 0.08) return false;
    if (this.fuel[i] < plantFuel) this.fuel[i] = plantFuel;
    this.heat[i] = Math.max(this.heat[i], power);
    if (!this.active.has(i)) {
      this.active.add(i);
      w.sfx("ignite", tx * TILE, ty * TILE, 0.5);
    }
    return true;
  }

  extinguish(w: World, px: number, py: number, radius: number) {
    let n = 0;
    const r = Math.ceil(radius / TILE);
    const cx = Math.floor(px / TILE);
    const cy = Math.floor(py / TILE);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        const i = y * MAP_W + x;
        if (this.heat[i] > 0) {
          this.heat[i] = 0;
          this.active.delete(i);
          n++;
          w.particles.spawn(P.Steam, x * TILE + TILE / 2, y * TILE + TILE / 2, { vz: 30, size: 10, max: 1.4, color: "rgba(230,230,230,0.6)" });
        }
      }
    }
    if (n) w.sfx("hiss", px, py, 0.7);
    return n;
  }

  update(w: World, dt: number) {
    const rain = w.weather.rain;
    const wx = w.weather.windX;
    const wy = w.weather.windY;
    const dry = w.weather.temp > 0.75 ? 1.5 : 1;
    const rng = w.rng;
    const dead: number[] = [];
    const spread: number[] = [];

    for (const i of Array.from(this.active)) {
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      let h = this.heat[i];
      const f = this.fuel[i];
      h += dt * (f > 0.05 ? 0.35 : -0.8);
      h -= dt * rain * 0.9;
      h = Math.min(1, h);
      this.fuel[i] = Math.max(0, f - dt * 0.085 * h);
      if (this.burnt[i] < h * 0.95) {
        this.burnt[i] = Math.max(this.burnt[i], h * 0.95);
        this.scorched.add(i);
      }
      if (h <= 0.02) {
        this.heat[i] = 0;
        dead.push(i);
        continue;
      }
      this.heat[i] = h;

      // spread to neighbours with fuel, pushed by wind
      if (rng() < dt * 2.2) {
        const dx = Math.floor(rng() * 3) - 1;
        const dy = Math.floor(rng() * 3) - 1;
        if (dx || dy) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H) {
            const j = ny * MAP_W + nx;
            const windBoost = 1 + (dx * wx + dy * wy) * 0.08;
            const chance = h * this.fuel[j] * 0.38 * windBoost * dry * (1 - rain);
            if (this.heat[j] === 0 && rng() < chance) spread.push(j);
          }
        }
      }

      // burn plants standing here
      if (rng() < dt * 2) w.burnPlantsAt(x * TILE + TILE / 2, y * TILE + TILE / 2, h * 0.5);

      // embers + smoke (only near the camera to save particles)
      const px = x * TILE + TILE / 2;
      const py = y * TILE + TILE / 2;
      if (w.inView(px, py, 120)) {
        if (rng() < dt * 3 * h) w.particles.spawn(P.Ember, px + (rng() - 0.5) * 24, py, { vz: 50 + rng() * 60, vx: wx * 6 + (rng() - 0.5) * 20, vy: wy * 2, size: 2, max: 1 + rng(), color: "#ffb347" });
        if (rng() < dt * 1.6 * h) w.particles.spawn(P.Smoke, px, py - 10, { vz: 30 + rng() * 20, vx: wx * 10, vy: wy * 4, size: 10 + rng() * 10, max: 2.5, color: "rgba(70,70,70,0.35)" });
      }
    }
    for (const i of dead) this.active.delete(i);
    for (const j of spread) {
      if (this.active.size >= MAX_ACTIVE) break;
      this.heat[j] = 0.3;
      this.active.add(j);
    }
    if (dead.length || spread.length) this.version++;

    // ash slowly turns green again (faster in rain)
    this.recoverT += dt;
    if (this.recoverT > 1) {
      const step = this.recoverT * (0.009 + rain * 0.011);
      this.recoverT = 0;
      const healed: number[] = [];
      for (const i of Array.from(this.scorched)) {
        if (this.heat[i] > 0) continue;
        this.burnt[i] = Math.max(0, this.burnt[i] - step);
        const base = baseFuel(w.terrain.tiles[i]);
        this.fuel[i] = Math.min(base, this.fuel[i] + step * 1.2);
        if (this.burnt[i] <= 0) healed.push(i);
      }
      for (const i of healed) this.scorched.delete(i);
      if (this.scorched.size) this.version++;
    }

    if (this.active.size > 0 && !w.flags.has("fireFact")) {
      w.flags.add("fireFact");
      w.toast("🔥", "Fire spreads through dry plants. Rain or water puts it out!");
    }
  }

  clear() {
    this.heat.fill(0);
    this.burnt.fill(0);
    this.active.clear();
    this.scorched.clear();
  }
}
