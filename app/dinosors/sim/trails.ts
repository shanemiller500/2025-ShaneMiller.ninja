import { isWalkTile } from "./terrain";
import { MAP_H, MAP_W, T, TILE } from "./types";
import type { World } from "./world";

/** Foot traffic wears persistent desire paths into walkable ground. */
export class Trails {
  static readonly visible = 5;
  readonly wear = new Uint8Array(MAP_W * MAP_H);
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

  /** A dragged run of torches establishes the route people will prefer. */
  connect(w: World, ax: number, ay: number, bx: number, by: number) {
    const dist = Math.hypot(bx - ax, by - ay);
    if (dist > 220 || !w.nav.lineClear("human", ax, ay, bx, by)) return;
    for (let d = 0; d <= dist; d += TILE / 2) {
      const t = dist ? d / dist : 0;
      this.mark(w, ax + (bx - ax) * t, ay + (by - ay) * t, Trails.visible);
    }
    this.mark(w, bx, by, Trails.visible);
  }

  serialize(): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < this.wear.length; i++) if (this.wear[i]) out.push([i, this.wear[i]]);
    return out;
  }

  load(entries: [number, number][] = []) {
    for (const [i, n] of entries) if (i >= 0 && i < this.wear.length && Number.isFinite(n)) this.wear[i] = Math.max(0, Math.min(20, n));
    this.version++;
  }
}
