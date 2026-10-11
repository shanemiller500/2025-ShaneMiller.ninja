import { isWalkTile } from "./terrain";
import { MAP_H, MAP_W, T, TILE } from "./types";
import type { World } from "./world";

/** Routes deliberately drawn by connecting placed bone torches. */
export class Trails {
  static readonly visible = 5;
  static readonly detailStep = TILE / 4;
  static readonly detailW = MAP_W * 4;
  static readonly detailH = MAP_H * 4;
  readonly wear = new Uint8Array(MAP_W * MAP_H);
  /** Fine detail for the visible lines between placed torches. */
  readonly detail = new Uint8Array(Trails.detailW * Trails.detailH);
  /** Deliberate torch-to-torch strings, stored by tile-centred world positions. */
  readonly lightLinks: [number, number, number, number][] = [];
  lastTorch = 0;
  version = 0;

  at(x: number, y: number) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? 0 : this.wear[ty * MAP_W + tx];
  }

  mark(w: World, x: number, y: number, amount = 1) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
    const i = ty * MAP_W + tx;
    const terrain = w.terrain.tiles[i] as T;
    if (!isWalkTile(terrain) || terrain === T.Tar || terrain === T.Cave || w.colony.bridgeAt(tx, ty)) return;
    const before = this.wear[i];
    this.wear[i] = Math.min(20, before + amount);
    if (before < Trails.visible && this.wear[i] >= Trails.visible) this.version++;
  }

  /** Record the line actually walked, at quarter-tile resolution. */
  trace(w: World, ax: number, ay: number, bx: number, by: number, amount = 1) {
    const step = Trails.detailStep;
    if (Math.floor(ax / step) === Math.floor(bx / step) && Math.floor(ay / step) === Math.floor(by / step)) return;
    const distance = Math.hypot(bx - ax, by - ay);
    const samples = Math.max(1, Math.ceil(distance / (step * 0.5)));
    let last = -1;
    for (let n = 0; n <= samples; n++) {
      const x = ax + (bx - ax) * n / samples;
      const y = ay + (by - ay) * n / samples;
      const fx = Math.floor(x / step);
      const fy = Math.floor(y / step);
      if (fx < 0 || fy < 0 || fx >= Trails.detailW || fy >= Trails.detailH) continue;
      const i = fy * Trails.detailW + fx;
      if (i === last) continue;
      last = i;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      const terrain = w.terrain.tiles[ty * MAP_W + tx] as T;
      if (!isWalkTile(terrain) || terrain === T.Tar || terrain === T.Cave || w.colony.bridgeAt(tx, ty)) continue;
      this.detail[i] = Math.min(20, this.detail[i] + amount);
    }
  }

  /** A dragged run of torches establishes the route people will prefer. */
  connect(w: World, ax: number, ay: number, bx: number, by: number) {
    const dist = Math.hypot(bx - ax, by - ay);
    if (dist > 220 || !w.nav.lineClear("human", ax, ay, bx, by)) return;
    const torches = w.colony.buildings.filter((b) => b.kind === "boneTorch" && b.hp > 0);
    if (torches.some((b) => b.x === ax && b.y === ay) && torches.some((b) => b.x === bx && b.y === by)
      && !this.lightLinks.some(([x1, y1, x2, y2]) => x1 === ax && y1 === ay && x2 === bx && y2 === by || x1 === bx && y1 === by && x2 === ax && y2 === ay))
      this.lightLinks.push([ax, ay, bx, by]);
    this.trace(w, ax, ay, bx, by, Trails.visible);
    for (let d = 0; d <= dist; d += TILE / 2) {
      const t = dist ? d / dist : 0;
      this.mark(w, ax + (bx - ax) * t, ay + (by - ay) * t, Trails.visible);
    }
    this.mark(w, bx, by, Trails.visible);
  }

  builtLinks(w: World) {
    const torches = new Map(w.colony.buildings.filter((b) => b.kind === "boneTorch" && b.built >= 1 && b.hp > 0).map((b) => [`${b.x}:${b.y}`, b]));
    return this.lightLinks.flatMap(([ax, ay, bx, by]) => {
      const a = torches.get(`${ax}:${ay}`);
      const b = torches.get(`${bx}:${by}`);
      return a && b ? [[a, b] as const] : [];
    });
  }

  disconnectTorch(w: World, x: number, y: number) {
    const remaining = this.lightLinks.filter(([ax, ay, bx, by]) => !(ax === x && ay === y || bx === x && by === y));
    this.lightLinks.length = 0;
    this.wear.fill(0);
    this.detail.fill(0);
    for (const [ax, ay, bx, by] of remaining) this.connect(w, ax, ay, bx, by);
    this.version++;
  }

  loadLinks(w: World, links: [number, number, number, number][]) {
    this.lightLinks.length = 0;
    for (const [ax, ay, bx, by] of links) this.connect(w, ax, ay, bx, by);
  }

  serialize(): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < this.wear.length; i++) if (this.wear[i]) out.push([i, this.wear[i]]);
    return out;
  }

  serializeDetail(): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < this.detail.length; i++) if (this.detail[i] >= Trails.visible) out.push([i, this.detail[i]]);
    return out;
  }

  load(entries: [number, number][] = [], detailEntries: [number, number][] = []) {
    for (const [i, n] of entries) if (i >= 0 && i < this.wear.length && Number.isFinite(n)) this.wear[i] = Math.max(0, Math.min(20, n));
    for (const [i, n] of detailEntries) if (i >= 0 && i < this.detail.length && Number.isFinite(n)) this.detail[i] = Math.max(0, Math.min(20, n));
    if (!detailEntries.length && entries.length) this.restoreOldTrails();
    this.version++;
  }

  /** Old saves stored square tile wear. Thin it to a branching centreline. */
  private restoreOldTrails() {
    const mask = new Uint8Array(this.wear.length);
    for (let i = 0; i < mask.length; i++) if (this.wear[i] >= Trails.visible) mask[i] = 1;
    for (let round = 0; round < 32; round++) {
      let changed = false;
      for (let pass = 0; pass < 2; pass++) {
        const remove: number[] = [];
        for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
          const i = y * MAP_W + x;
          if (!mask[i]) continue;
          const n = [mask[i - MAP_W], mask[i - MAP_W + 1], mask[i + 1], mask[i + MAP_W + 1],
            mask[i + MAP_W], mask[i + MAP_W - 1], mask[i - 1], mask[i - MAP_W - 1]];
          const count = n.reduce((sum, v) => sum + v, 0);
          if (count < 2 || count > 6) continue;
          let turns = 0;
          for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) turns++;
          if (turns !== 1) continue;
          if (pass === 0 ? n[0] && n[2] && n[4] || n[2] && n[4] && n[6]
            : n[0] && n[2] && n[6] || n[0] && n[4] && n[6]) continue;
          remove.push(i);
        }
        for (const i of remove) mask[i] = 0;
        changed ||= remove.length > 0;
      }
      if (!changed) break;
    }
    const point = (x: number, y: number) => ({
      x: (x + 0.5) * TILE + Math.sin(x * 31.7 + y * 11.3) * 3,
      y: (y + 0.5) * TILE + Math.sin(x * 17.9 + y * 29.1) * 3,
    });
    const line = (ax: number, ay: number, bx: number, by: number) => {
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (Trails.detailStep * 0.5));
      for (let n = 0; n <= steps; n++) {
        const x = ax + (bx - ax) * n / steps;
        const y = ay + (by - ay) * n / steps;
        const fx = Math.floor(x / Trails.detailStep);
        const fy = Math.floor(y / Trails.detailStep);
        if (fx >= 0 && fy >= 0 && fx < Trails.detailW && fy < Trails.detailH)
          this.detail[fy * Trails.detailW + fx] = Trails.visible;
      }
    };
    for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
      const i = y * MAP_W + x;
      if (!mask[i]) continue;
      const from = point(x, y);
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        if (!mask[(y + dy) * MAP_W + x + dx]) continue;
        if (dx && dy && (mask[y * MAP_W + x + dx] || mask[(y + dy) * MAP_W + x])) continue;
        const to = point(x + dx, y + dy);
        line(from.x, from.y, to.x, to.y);
      }
    }
  }
}
