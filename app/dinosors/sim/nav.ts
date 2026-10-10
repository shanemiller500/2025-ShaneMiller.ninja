/* ------------------------------------------------------------------ */
/*  Navigation: a per-tile grid of what blocks whom, plus a budgeted   */
/*  A* that works on two layers — the ground, and the walkway on top   */
/*  of walls + towers (reached by stairs or a tower ladder).           */
/*                                                                     */
/*   • people: walk through gates (there's a side door), climb stairs, */
/*     never wade into tar, avoid fire.                                */
/*   • ground dinos: stopped by walls, closed gates, stairs, towers +  */
/*     buildings; tar and fire are very expensive.                     */
/*   • flyers: don't use this at all.                                  */
/*                                                                     */
/*  The grid is rebuilt only when terrain / structures change; fire +  */
/*  lava are read live during the search. Searches share a per-frame   */
/*  node budget, so a crowd asking for paths at once can't stall a     */
/*  frame — whoever runs out simply asks again next frame.             */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { isWalkTile } from "./terrain";
import { MAP_H, MAP_W, T, TILE } from "./types";
import type { World } from "./world";

export const NT = MAP_W * MAP_H;
/** "bigDino": a ground dino too big for bridges (anything bigger than a chicken) */
export type NavClass = "human" | "dino" | "bigDino" | "rider";

const F_TERRAIN = 1; // deep water, mountain, cliff
const F_SOLID = 2; // walls, buildings, huts: nobody walks through
const F_GATE = 4;
const F_OPEN = 8; // gate is open
const F_TAR = 16;
const F_STAIRS = 32; // people only
const F_TOWER = 64; // people climb the ladder; dinos can't pass
const F_BRIDGE = 128;

/** how high people stand on walls / towers (px) */
export const WALK_Z = 28;
export const TOWER_Z = 46;

const SQ2 = Math.SQRT2;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export const tileOf = (x: number, y: number) => {
  const tx = Math.max(0, Math.min(MAP_W - 1, Math.floor(x / TILE)));
  const ty = Math.max(0, Math.min(MAP_H - 1, Math.floor(y / TILE)));
  return ty * MAP_W + tx;
};

export const goalKey = (x: number, y: number, level = 0) => tileOf(x, y) + level * NT + 1;

/** Shelter footprint: the tile row just above the door, about as wide as the hut. */
export function shelterTiles(x: number, y: number): number[] {
  const row = Math.floor((y + 6) / TILE) - 1;
  const out: number[] = [];
  for (let tx = Math.floor((x - 18) / TILE); tx <= Math.floor((x + 18) / TILE); tx++) out.push(row * MAP_W + tx);
  return out;
}

class Heap {
  ids = new Int32Array(1024);
  fs = new Float32Array(1024);
  n = 0;
  push(id: number, f: number) {
    if (this.n >= this.ids.length) {
      const ids = new Int32Array(this.ids.length * 2);
      ids.set(this.ids);
      const fs = new Float32Array(this.fs.length * 2);
      fs.set(this.fs);
      this.ids = ids;
      this.fs = fs;
    }
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.fs[p] <= f) break;
      this.ids[i] = this.ids[p];
      this.fs[i] = this.fs[p];
      i = p;
    }
    this.ids[i] = id;
    this.fs[i] = f;
  }
  pop() {
    const top = this.ids[0];
    const id = this.ids[--this.n];
    const f = this.fs[this.n];
    let i = 0;
    for (;;) {
      let c = i * 2 + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && this.fs[c + 1] < this.fs[c]) c++;
      if (this.fs[c] >= f) break;
      this.ids[i] = this.ids[c];
      this.fs[i] = this.fs[c];
      i = c;
    }
    this.ids[i] = id;
    this.fs[i] = f;
    return top;
  }
}

export class Nav {
  flags = new Uint8Array(NT);
  /** base movement cost (terrain, paths, snow) */
  cost = new Float32Array(NT).fill(1);
  /** walkway on top (built wall / gate / tower) */
  top = new Uint8Array(NT);
  version = 0;
  /** node expansions left this frame (shared by every search) */
  budget = 0;
  private stamp = 0;
  private seen = new Uint32Array(NT * 2);
  private closedAt = new Uint32Array(NT * 2);
  private g = new Float32Array(NT * 2);
  private from = new Int32Array(NT * 2);
  private heap = new Heap();
  private key = "";

  /** Rebuild the grid if terrain or any structure changed. Cheap otherwise. */
  sync(w: World) {
    const tr = w.tribe;
    const key = `${w.terrain.version}|${tr.version}|${w.colony.version}|${w.shelters.length}:${w.shelterVersion}|${w.snow.navVersion}|${w.trails.version}`;
    if (key === this.key) return;
    this.key = key;
    this.rebuild(w);
  }

  private rebuild(w: World) {
    const f = this.flags;
    const cost = this.cost;
    const tiles = w.terrain.tiles;
    const snow = w.snow.depth;
    f.fill(0);
    this.top.fill(0);
    for (let i = 0; i < NT; i++) {
      const t = tiles[i] as T;
      if (!isWalkTile(t)) f[i] |= F_TERRAIN;
      if (t === T.Tar) f[i] |= F_TAR;
      let c = 1;
      if (t === T.Shallow || t === T.River) c = 2.6;
      else if (t === T.Swamp) c = 1.5;
      else if (t === T.Mud) c = 1.8;
      else if (t === T.Volcano) c = 1.4;
      else if (t === T.Sand) c = 1.1;
      cost[i] = (w.trails.wear[i] >= 5 ? Math.min(c, 0.78) : c) + snow[i] * 0.5;
    }
    const tribe = w.tribe;
    for (const wl of tribe.walls) {
      if (wl.built < 0.5 || wl.hp <= 0) continue;
      const i = wl.ty * MAP_W + wl.tx;
      if (wl.part === "gate") {
        f[i] |= F_GATE | (wl.open ? F_OPEN : 0);
        if (wl.built >= 1) this.top[i] = 1;
      } else if (wl.part === "stairs") f[i] |= F_STAIRS;
      else {
        f[i] |= F_SOLID;
        if (wl.built >= 1) this.top[i] = 1;
      }
    }
    for (const tw of tribe.towers) {
      if (tw.stage < 1 || tw.hp <= 0) continue;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const i = (tw.ty + dy) * MAP_W + tw.tx + dx;
          if (i < 0 || i >= NT) continue;
          f[i] |= F_TOWER;
          if (tw.stage >= 3) this.top[i] = 1;
        }
    }
    for (const b of w.colony.buildings) {
      const def = BUILDINGS[b.kind];
      for (let dy = 0; dy < def.h; dy++)
        for (let dx = 0; dx < def.w; dx++) {
          const i = (b.ty + dy) * MAP_W + b.tx + dx;
          if (i < 0 || i >= NT) continue;
          if (b.kind === "bridge" && b.built >= 1) {
            f[i] = (f[i] & ~F_TERRAIN) | F_BRIDGE;
            cost[i] = 1;
          } else if (b.kind === "path" && b.built >= 1) cost[i] = Math.min(cost[i], 0.75);
          else if (def.solid && b.built >= 0.4) f[i] |= F_SOLID;
        }
    }
    for (const s of w.colony.scorpions) {
      if (s.mount !== "ground" || s.built < 0.4) continue;
      f[s.ty * MAP_W + s.tx] |= F_SOLID;
    }
    for (const s of w.shelters) {
      if (s.stage < 1) continue;
      for (const i of shelterTiles(s.x, s.y)) if (i >= 0 && i < NT) f[i] |= F_SOLID;
    }
    this.version++;
  }

  /** Can this class stand on tile i (ground level)? */
  ok(cls: NavClass, i: number) {
    const f = this.flags[i];
    if (f & (F_TERRAIN | F_SOLID)) return false;
    if (cls === "human") return !(f & F_TAR);
    if (f & (F_STAIRS | F_TOWER)) return false;
    if (cls === "bigDino" && f & F_BRIDGE) return false;
    if ((f & F_GATE) && !(f & F_OPEN)) return false;
    if (cls === "rider" && f & F_TAR) return false;
    return true;
  }

  /** Ground passability at a world point (for collision). */
  passable(cls: NavClass, x: number, y: number) {
    if (x < 0 || y < 0 || x >= MAP_W * TILE || y >= MAP_H * TILE) return false;
    return this.ok(cls, tileOf(x, y));
  }

  isTower(i: number) {
    return (this.flags[i] & F_TOWER) !== 0;
  }
  isGate(i: number) {
    return (this.flags[i] & F_GATE) !== 0;
  }

  /** Extra cost of stepping into tile i right now (live fire / lava). -1 = impassable. */
  private live(w: World, cls: NavClass, i: number) {
    if (w.lava.heat[i] > 0.15) return -1;
    const fire = w.fire.heat[i];
    if (fire > 0.2) return cls === "human" ? 30 : 18;
    let c = this.cost[i];
    if (cls !== "human" && this.flags[i] & F_TAR) c += 25;
    if (cls === "human" && this.flags[i] & F_GATE) c += 0.4;
    return c;
  }

  /** Straight walk from a to b stays on cheap, open ground (no path needed). */
  lineClear(cls: NavClass, ax: number, ay: number, bx: number, by: number) {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(dist / (TILE * 0.5));
    let last = -1;
    for (let k = 0; k <= steps; k++) {
      const t = k / Math.max(1, steps);
      const i = tileOf(ax + (bx - ax) * t, ay + (by - ay) * t);
      if (i === last) continue;
      last = i;
      if (!this.ok(cls, i) || this.cost[i] > 1.6) return false;
    }
    return true;
  }

  /** Is there a wall / closed gate / building between two points (for a ground dino)? */
  wallBetween(ax: number, ay: number, bx: number, by: number) {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(dist / (TILE * 0.5));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const i = tileOf(ax + (bx - ax) * t, ay + (by - ay) * t);
      const f = this.flags[i];
      if (f & (F_SOLID | F_STAIRS | F_TOWER)) return true;
      if (f & F_GATE && !(f & F_OPEN)) return true;
    }
    return false;
  }

  /** Nearest ground tile this class can stand on, around tile i. */
  nearestOk(cls: NavClass, i: number, fromX: number, fromY: number, r = 3) {
    if (this.ok(cls, i)) return i;
    const tx0 = i % MAP_W;
    const ty0 = (i - tx0) / MAP_W;
    let best = -1;
    let bs = Infinity;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const tx = tx0 + dx;
        const ty = ty0 + dy;
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
        const j = ty * MAP_W + tx;
        if (!this.ok(cls, j)) continue;
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        const s = Math.hypot(dx, dy) * TILE + Math.hypot(cx - fromX, cy - fromY) * 0.35;
        if (s < bs) {
          bs = s;
          best = j;
        }
      }
    return best;
  }

  /**
   * A* from (sx, sy, startLevel) to (gx, gy, goalLevel).
   * Returns node ids (tile + level * NT) excluding the start, null if
   * there's no way, or undefined if this frame's budget ran out.
   */
  find(w: World, cls: NavClass, sx: number, sy: number, sl: number, gx: number, gy: number, gl: number, maxNodes = 9000): number[] | null | undefined {
    if (this.budget <= 200) return undefined;
    const layered = cls === "human";
    if (!layered) {
      sl = 0;
      gl = 0;
    }
    let s = tileOf(sx, sy);
    let gt = tileOf(gx, gy);
    if (gl === 1 && !this.top[gt]) gl = 0;
    if (gl === 0) {
      gt = this.nearestOk(cls, gt, sx, sy);
      if (gt < 0) return null;
    }
    if (sl === 1 && !this.top[s]) sl = 0;
    if (sl === 0 && !this.ok(cls, s)) {
      // standing somewhere odd (on a fresh blueprint, in a doorway): start from the nearest open tile
      const ns = this.nearestOk(cls, s, sx, sy, 2);
      if (ns >= 0) s = ns;
    }
    const start = s + sl * NT;
    const goal = gt + gl * NT;
    if (start === goal) return [];
    const gX = gt % MAP_W;
    const gY = (gt - gX) / MAP_W;
    const stamp = ++this.stamp;
    const heap = this.heap;
    heap.n = 0;
    const g = this.g;
    const seen = this.seen;
    const closed = this.closedAt;
    const from = this.from;
    seen[start] = stamp;
    g[start] = 0;
    from[start] = -1;
    const h = (i: number) => {
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      const ax = Math.abs(x - gX);
      const ay = Math.abs(y - gY);
      return (ax + ay + (SQ2 - 2) * Math.min(ax, ay)) * 0.95;
    };
    heap.push(start, h(s));
    const limit = Math.min(maxNodes, this.budget);
    let n = 0;
    let found = false;
    const relax = (node: number, cost: number, cur: number) => {
      const ng = g[cur] + cost;
      if (seen[node] === stamp && ng >= g[node]) return;
      seen[node] = stamp;
      g[node] = ng;
      from[node] = cur;
      heap.push(node, ng + h(node % NT));
    };
    while (heap.n) {
      const cur = heap.pop();
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      if (cur === goal) {
        found = true;
        break;
      }
      if (++n > limit) break;
      const level = cur >= NT ? 1 : 0;
      const i = cur - level * NT;
      const x = i % MAP_W;
      const y = (i - x) / MAP_W;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const j = ny * MAP_W + nx;
        const diag = k >= 4;
        if (level === 0) {
          if (!this.ok(cls, j)) continue;
          // no squeezing between two blocked corners
          if (diag && (!this.ok(cls, y * MAP_W + nx) || !this.ok(cls, ny * MAP_W + x))) continue;
          const c = this.live(w, cls, j);
          if (c < 0) continue;
          relax(j, c * (diag ? SQ2 : 1), cur);
        } else {
          if (!this.top[j]) continue;
          if (diag && (!this.top[y * MAP_W + nx] || !this.top[ny * MAP_W + x])) continue;
          relax(j + NT, diag ? SQ2 : 1, cur);
        }
      }
      if (layered) {
        // climbing: towers have a ladder; stairs lead onto the walkway next door
        if (level === 0) {
          if (this.flags[i] & F_TOWER && this.top[i]) relax(i + NT, 2, cur);
          if (this.flags[i] & F_STAIRS) {
            for (let k = 0; k < 4; k++) {
              const nx = x + DX[k];
              const ny = y + DY[k];
              if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
              const j = ny * MAP_W + nx;
              if (this.top[j]) relax(j + NT, 2.2, cur);
            }
          }
        } else {
          if (this.flags[i] & F_TOWER) relax(i, 2, cur);
          for (let k = 0; k < 4; k++) {
            const nx = x + DX[k];
            const ny = y + DY[k];
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            const j = ny * MAP_W + nx;
            if (this.flags[j] & F_STAIRS) relax(j, 2.2, cur);
          }
        }
      }
    }
    this.budget -= n;
    // out of nodes: "try again next frame" if the shared budget was the limit, else it's just too far
    if (!found) return n > limit && limit < maxNodes ? undefined : null;
    const out: number[] = [];
    for (let c = goal; c !== start && c >= 0; c = from[c]) out.push(c);
    out.reverse();
    return this.smooth(cls, sx, sy, out);
  }

  /** String-pull ground runs so walkers cut corners instead of zig-zagging tile to tile. */
  private smooth(cls: NavClass, sx: number, sy: number, path: number[]) {
    if (path.length < 3) return path;
    const out: number[] = [];
    let ax = sx;
    let ay = sy;
    let i = 0;
    while (i < path.length) {
      const node = path[i];
      if (node >= NT) {
        out.push(node);
        const t = node - NT;
        ax = (t % MAP_W) * TILE + TILE / 2;
        ay = Math.floor(t / MAP_W) * TILE + TILE / 2;
        i++;
        continue;
      }
      // furthest ground node we can walk to in a straight line
      let j = i;
      while (j + 1 < path.length && path[j + 1] < NT) {
        const nt = path[j + 1];
        if (!this.lineClear(cls, ax, ay, (nt % MAP_W) * TILE + TILE / 2, Math.floor(nt / MAP_W) * TILE + TILE / 2)) break;
        j++;
      }
      out.push(path[j]);
      ax = (path[j] % MAP_W) * TILE + TILE / 2;
      ay = Math.floor(path[j] / MAP_W) * TILE + TILE / 2;
      i = j + 1;
    }
    return out;
  }
}

/** World-space centre of a path node. */
export function nodePos(node: number) {
  const level = node >= NT ? 1 : 0;
  const t = node - level * NT;
  return { x: (t % MAP_W) * TILE + TILE / 2, y: Math.floor(t / MAP_W) * TILE + TILE / 2, level };
}
