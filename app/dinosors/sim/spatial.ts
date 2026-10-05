/* ------------------------------------------------------------------ */
/*  Uniform-grid spatial hash. Creatures are re-bucketed once per      */
/*  frame (cheap), plants only when they change.                       */
/* ------------------------------------------------------------------ */
import { WORLD_H, WORLD_W } from "./types";

export class SpatialHash<E extends { x: number; y: number }> {
  readonly cell: number;
  private cols: number;
  private rows: number;
  private buckets: E[][];

  constructor(cell = 128) {
    this.cell = cell;
    this.cols = Math.ceil(WORLD_W / cell);
    this.rows = Math.ceil(WORLD_H / cell);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear() {
    for (const b of this.buckets) b.length = 0;
  }

  private key(x: number, y: number) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    return cy * this.cols + cx;
  }

  insert(e: E) {
    this.buckets[this.key(e.x, e.y)].push(e);
  }

  rebuild(list: readonly E[]) {
    this.clear();
    for (const e of list) this.insert(e);
  }

  /** Calls fn for every entity within radius r of (x, y). Return true from fn to stop early. */
  each(x: number, y: number, r: number, fn: (e: E, d2: number) => boolean | void) {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor((x - r) / this.cell));
    const x1 = Math.min(this.cols - 1, Math.floor((x + r) / this.cell));
    const y0 = Math.max(0, Math.floor((y - r) / this.cell));
    const y1 = Math.min(this.rows - 1, Math.floor((y + r) / this.cell));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.buckets[cy * this.cols + cx];
        for (let i = 0; i < b.length; i++) {
          const e = b[i];
          const dx = e.x - x;
          const dy = e.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && fn(e, d2) === true) return;
        }
      }
    }
  }

  /** Nearest entity within r that passes the filter. */
  nearest(x: number, y: number, r: number, ok: (e: E) => boolean): E | null {
    let best: E | null = null;
    let bestD = Infinity;
    this.each(x, y, r, (e, d2) => {
      if (d2 < bestD && ok(e)) {
        bestD = d2;
        best = e;
      }
    });
    return best;
  }

  /** Entities overlapping a rectangle (used for render culling). */
  rect(x0: number, y0: number, x1: number, y1: number, out: E[]) {
    const c0 = Math.max(0, Math.floor(x0 / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor(x1 / this.cell));
    const r0 = Math.max(0, Math.floor(y0 / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor(y1 / this.cell));
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) for (const e of this.buckets[cy * this.cols + cx]) out.push(e);
    return out;
  }
}
