/* ------------------------------------------------------------------ */
/*  Snow: a per-tile depth that builds up while it snows, melts when   */
/*  it's warm (instantly near lava + fire) and never leaves the high   */
/*  peaks. Updated a strip of rows at a time so it costs ~nothing.     */
/*  Deep snow slows walkers (via nav cost + ground speed) and chills.  */
/* ------------------------------------------------------------------ */
import { FROST_RIDGE, mountY } from "./terrain";
import { MAP_H, MAP_W, T, TILE } from "./types";
import type { World } from "./world";

const NT = MAP_W * MAP_H;
const ROWS_PER_STEP = 8;

function distToRidge(x: number, y: number) {
  let best = Infinity;
  for (let i = 0; i < FROST_RIDGE.length - 1; i++) {
    const [ax, ay] = FROST_RIDGE[i];
    const [bx, by] = FROST_RIDGE[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

export class Snow {
  depth = new Float32Array(NT);
  /** permanent snowcaps (high peaks) */
  cap = new Uint8Array(NT);
  /** bumps when the snow changes enough for paths to care */
  navVersion = 0;
  private row = 0;
  private acc = 0;
  private lastTotal = 0;
  total = 0;

  init(w: World) {
    const tiles = w.terrain.tiles;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const t = tiles[i] as T;
        const high = t === T.Mountain || t === T.Rock;
        const peak = (high && y < mountY(x, w.seed) - 1) || (high && distToRidge(x, y) < 4.5);
        this.cap[i] = peak ? 1 : 0;
        this.depth[i] = peak ? 0.85 : 0;
      }
    }
  }

  at(x: number, y: number) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 0;
    return this.depth[ty * MAP_W + tx];
  }

  /** How cold it feels at a spot (0 = fine, 1 = freezing). */
  chill(w: World, x: number, y: number) {
    const air = Math.max(0, 0.42 - w.weather.temp) * 2.2 + w.weather.snow * 0.35 + w.weather.wind * w.weather.snow * 0.3;
    return Math.min(1, air + this.at(x, y) * 0.4 + (w.daylight < 0.3 ? 0.08 : 0));
  }

  update(w: World, dt: number) {
    this.acc += dt;
    const steps = Math.ceil(MAP_H / ROWS_PER_STEP);
    const span = this.acc;
    const wt = w.weather;
    const fall = wt.snow * 0.05;
    const melt = Math.max(0, wt.temp - 0.3) * 0.045 + wt.rain * 0.03;
    const tiles = w.terrain.tiles;
    const y0 = this.row * ROWS_PER_STEP;
    const y1 = Math.min(MAP_H, y0 + ROWS_PER_STEP);
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const t = tiles[i] as T;
        let d = this.depth[i];
        if (t === T.Deep || t === T.Shallow || t === T.River || t === T.Tar) {
          d = 0;
        } else if (w.lava.heat[i] > 0.05 || w.fire.heat[i] > 0.1) {
          d = 0;
        } else {
          d += (fall * (t === T.Forest || t === T.Jungle ? 0.6 : 1) - melt) * span * steps;
          if (this.cap[i]) d = Math.max(d, 0.75);
        }
        this.depth[i] = Math.max(0, Math.min(1, d));
      }
    }
    this.row++;
    if (this.row >= steps) {
      this.row = 0;
      let s = 0;
      for (let i = 0; i < NT; i += 7) s += this.depth[i];
      this.total = s / (NT / 7);
      if (Math.abs(this.total - this.lastTotal) > 0.06) {
        this.lastTotal = this.total;
        this.navVersion++;
      }
    }
    this.acc = 0;
  }
}
