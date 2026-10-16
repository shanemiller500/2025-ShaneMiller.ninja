import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Procedural cave "scans" for CaveScope.                             */
/*                                                                     */
/*  These are ILLUSTRATIVE reconstructions, not surveys: a seeded      */
/*  generator builds a point cloud in the style of the real cave       */
/*  (trunk passages, great chambers, boxwork mazes, lava tubes) so     */
/*  people can feel what that kind of cave is like. The same seed      */
/*  always gives the same cave. Units are metres; y = 0 is the ground, */
/*  negative y is below it.                                            */
/* ------------------------------------------------------------------ */

export type CaveStyle = "trunk" | "chamber" | "maze" | "lavatube";
export type CavePalette = "limestone" | "basalt" | "marble";

export interface CaveSpec {
  /** Stable seed — use the cave's id */
  seed: string;
  style: CaveStyle;
  /** Depth of the main level below the surface, metres */
  depth: number;
  /** Underground river on the lowest level */
  river?: boolean;
  /** 0–1 stalactite / stalagmite density */
  formations?: number;
  /** sparkling calcite crystals on the walls (Jewel Cave) */
  crystals?: boolean;
  /** honeycomb boxwork fins on the walls (Wind Cave) */
  boxwork?: boolean;
  palette?: CavePalette;
  /** overall size multiplier */
  scale?: number;
  /** draw the synthetic contour-grid ground (off when the scene supplies real terrain) */
  surface?: boolean;
}

/** Point kinds, read by the shader. */
export const PK = { wall: 0, formation: 1, water: 2, crystal: 3, surface: 4, beam: 5 } as const;

export interface CaveModel {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  kinds: Float32Array;
  along: Float32Array;
  count: number;
  /** centre-line the camera flies along, entrance first */
  path: THREE.Vector3[];
  entrance: THREE.Vector3;
  bounds: THREE.Box3;
  /** deepest point of the model, metres below the surface */
  maxDepth: number;
}

/* ── seeded randomness + smooth noise ─────────────────────────────── */

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap smooth 3D noise in [0, 1] from a few seeded sine waves — plenty for rock texture. */
function makeNoise(rand: () => number) {
  const waves = Array.from({ length: 6 }, () => ({
    k: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.6 + rand() * 1.6),
    p: rand() * Math.PI * 2,
  }));
  return (x: number, y: number, z: number) => {
    let s = 0;
    for (const w of waves) s += Math.sin(w.k.x * x + w.k.y * y + w.k.z * z + w.p);
    return 0.5 + s / (waves.length * 2);
  };
}

/* ── palettes ─────────────────────────────────────────────────────── */

const PALETTES: Record<CavePalette, { wall: THREE.Color; deep: THREE.Color; formation: THREE.Color; floor: THREE.Color }> = {
  limestone: { wall: new THREE.Color("#5eead4"), deep: new THREE.Color("#6366f1"), formation: new THREE.Color("#f0abfc"), floor: new THREE.Color("#0ea5e9") },
  marble: { wall: new THREE.Color("#a5b4fc"), deep: new THREE.Color("#7c3aed"), formation: new THREE.Color("#fde68a"), floor: new THREE.Color("#38bdf8") },
  basalt: { wall: new THREE.Color("#fb923c"), deep: new THREE.Color("#be123c"), formation: new THREE.Color("#fde047"), floor: new THREE.Color("#f97316") },
};

/* ── builder ──────────────────────────────────────────────────────── */

class Cloud {
  pos: number[] = [];
  col: number[] = [];
  size: number[] = [];
  kind: number[] = [];
  along: number[] = [];
  add(p: THREE.Vector3, c: THREE.Color, size: number, kind: number, along = 0) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
    this.size.push(size);
    this.kind.push(kind);
    this.along.push(along);
  }
}

interface TubeOpts {
  w: number;
  h: number;
  /** wall roughness 0–1 */
  rough?: number;
  /** points per metre of wall, roughly */
  density?: number;
  /** how far up from the bottom the floor is flattened (0 = round, 0.6 = flat-bottomed) */
  flat?: number;
  river?: boolean;
  formations?: number;
  /** leave the ceiling open over these t ranges (lava-tube skylights) */
  skylights?: [number, number][];
  along?: [number, number];
}

export function generateCave(spec: CaveSpec): CaveModel {
  const rand = mulberry32(hashString(`${spec.seed}:${spec.style}`));
  const noise = makeNoise(rand);
  const pal = PALETTES[spec.palette ?? (spec.style === "lavatube" ? "basalt" : "limestone")];
  const S = spec.scale ?? 1;
  const cloud = new Cloud();
  const path: THREE.Vector3[] = [];
  const tmp = new THREE.Vector3();
  const color = new THREE.Color();
  const r = (a: number, b: number) => a + rand() * (b - a);
  let maxDepth = 0;

  /** wall colour: palette shifted toward "deep" with depth, with a little rock variation */
  const wallColor = (y: number, n: number, floor = false) => {
    const d = Math.min(1, -y / Math.max(60, spec.depth * 1.6));
    color.copy(floor ? pal.floor : pal.wall).lerp(pal.deep, d * 0.85);
    return color.multiplyScalar(0.45 + n * 0.75);
  };

  const formation = (base: THREE.Vector3, dir: 1 | -1, len: number, radius: number, along: number) => {
    const n = Math.max(6, Math.round(len * 14));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const rad = radius * (1 - t) ** 1.4;
      const a = rand() * Math.PI * 2;
      tmp.set(base.x + Math.cos(a) * rad, base.y + dir * t * len, base.z + Math.sin(a) * rad);
      color.copy(pal.formation).multiplyScalar(0.55 + rand() * 0.6);
      cloud.add(tmp, color, 0.9, PK.formation, along);
    }
  };

  /** Sample the walls of a passage that follows `pts`. */
  const tube = (pts: THREE.Vector3[], o: TubeOpts) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const L = curve.getLength();
    const density = (o.density ?? 1) * 1.4;
    const rings = Math.max(4, Math.ceil(L * density * 0.9));
    // floor height as a fraction of h below the centre; capped so the camera line stays above it
    const floorAt = -Math.max(0.25, 1 - Math.min(0.375, o.flat ?? 0.3) * 2);
    const [a0, a1] = o.along ?? [0, 0];
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3();
    const upv = new THREE.Vector3();
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const p = curve.getPointAt(t);
      const T = curve.getTangentAt(t);
      side.crossVectors(T, up);
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      upv.crossVectors(side, T).normalize();
      const w = o.w * (0.75 + 0.5 * noise(p.x * 0.05, 0, p.z * 0.05));
      const h = o.h * (0.75 + 0.5 * noise(0, p.y * 0.05, p.x * 0.05));
      const around = Math.max(10, Math.ceil(Math.PI * (w + h) * density));
      const open = o.skylights?.some(([s, e]) => t >= s && t <= e);
      const al = a0 + (a1 - a0) * t;
      for (let j = 0; j < around; j++) {
        const ang = (j / around) * Math.PI * 2 + rand() * 0.05;
        let x = Math.cos(ang);
        let y = Math.sin(ang);
        if (open && y > 0.35) continue;
        const isFloor = y < floorAt;
        if (isFloor) y = floorAt + (rand() - 0.5) * 0.04;
        const rough = 1 + (o.rough ?? 0.35) * (noise(p.x * 0.4 + x, p.y * 0.4 + y, p.z * 0.4) - 0.5) * 1.6;
        x *= w * rough;
        y *= h * (isFloor ? 1 : rough);
        // scatter along the passage too, so walls read as rock rather than rings
        tmp.copy(p).addScaledVector(side, x).addScaledVector(upv, y).addScaledVector(T, (rand() - 0.5) * (L / rings) * 1.6);
        tmp.x += (rand() - 0.5) * 0.12;
        tmp.z += (rand() - 0.5) * 0.12;
        const n = noise(tmp.x * 0.3, tmp.y * 0.3, tmp.z * 0.3);
        let kind: number = PK.wall;
        let c = wallColor(tmp.y, n, isFloor);
        if (spec.boxwork && !isFloor) {
          // honeycomb fins: brighten points on a 3D lattice
          const g = 0.7;
          const fx = Math.abs(((tmp.x * g) % 1) + 1) % 1;
          const fz = Math.abs(((tmp.z * g) % 1) + 1) % 1;
          const fy = Math.abs(((tmp.y * g) % 1) + 1) % 1;
          if (fx < 0.09 || fz < 0.09 || fy < 0.09) {
            kind = PK.formation;
            c = color.copy(pal.formation).multiplyScalar(0.5 + n * 0.5);
          }
        }
        if (spec.crystals && !isFloor && rand() < 0.035) {
          kind = PK.crystal;
          c = color.set("#e0f2fe");
        }
        cloud.add(tmp, c, isFloor ? 0.8 : 1, kind, al);
        maxDepth = Math.max(maxDepth, -tmp.y);
      }
      if (o.river) {
        const n = Math.ceil(w * 3);
        for (let k = 0; k < n; k++) {
          const x = (rand() - 0.5) * w * 1.1;
          tmp.copy(p).addScaledVector(side, x).addScaledVector(upv, floorAt * h + 0.15);
          cloud.add(tmp, color.set("#38bdf8"), 0.9, PK.water, t * L);
        }
      }
      if (o.formations && rand() < o.formations) {
        // formations sit toward the walls, leaving the middle of the passage clear
        const off = () => (rand() < 0.5 ? -1 : 1) * r(0.45, 0.85) * w;
        const ceil = p.clone().addScaledVector(upv, h * 0.92).addScaledVector(side, off());
        const len = r(0.4, 1.6) * h * 0.6;
        formation(ceil, -1, len, r(0.15, 0.5), al);
        if (rand() < 0.6) {
          const floor = p.clone().addScaledVector(upv, floorAt * h).addScaledVector(side, off());
          formation(floor, 1, r(0.3, 1.2) * h * 0.6, r(0.25, 0.7), al);
        }
      }
    }
    return L;
  };

  /** A big room: a noisy ellipsoid shell with a flat, rubbly floor and lots of formations. */
  const room = (c: THREE.Vector3, rx: number, ry: number, rz: number, form: number, along: number) => {
    const n = Math.round((rx * rz + rx * ry + ry * rz) * 2.6);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      let x = s * Math.cos(th);
      let y = u;
      let z = s * Math.sin(th);
      const floor = y < -0.55;
      if (floor) {
        // flatten to a floor and spread it across the room
        const k = Math.sqrt(rand());
        const a = rand() * Math.PI * 2;
        x = Math.cos(a) * k;
        z = Math.sin(a) * k;
        y = -0.55 + (rand() - 0.5) * 0.05;
      }
      const rough = 1 + 0.3 * (noise(x * 3 + c.x * 0.01, y * 3, z * 3) - 0.5);
      tmp.set(c.x + x * rx * rough, c.y + y * ry * (floor ? 1 : rough), c.z + z * rz * rough);
      cloud.add(tmp, wallColor(tmp.y, noise(tmp.x * 0.2, tmp.y * 0.2, tmp.z * 0.2), floor), floor ? 0.8 : 1.15, PK.wall, along);
      maxDepth = Math.max(maxDepth, -tmp.y);
    }
    const count = Math.round(rx * rz * 0.06 * form);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const k = Math.sqrt(rand()) * 0.85;
      const fx = c.x + Math.cos(a) * rx * k;
      const fz = c.z + Math.sin(a) * rz * k;
      if (Math.abs(fz - c.z - rz * 0.08) < rz * 0.3) continue; // the aisle the camera flies down
      const floorY = c.y - ry * 0.55;
      const ceilY = c.y + ry * Math.sqrt(Math.max(0.05, 1 - k * k)) * 0.95;
      const span = ceilY - floorY;
      if (rand() < 0.15) {
        // a column, floor to ceiling
        formation(new THREE.Vector3(fx, floorY, fz), 1, span, r(0.8, 2.2), along);
      } else {
        formation(new THREE.Vector3(fx, floorY, fz), 1, span * r(0.1, 0.45), r(0.4, 1.4), along);
        formation(new THREE.Vector3(fx + r(-1, 1), ceilY, fz + r(-1, 1)), -1, span * r(0.08, 0.3), r(0.2, 0.7), along);
      }
    }
  };

  /** A meandering random walk on a near-level plane. */
  const walk = (start: THREE.Vector3, steps: number, stepLen: number, wiggle: number, dy = 0) => {
    const pts = [start.clone()];
    let heading = rand() * Math.PI * 2;
    for (let i = 0; i < steps; i++) {
      heading += (rand() - 0.5) * wiggle;
      const last = pts[pts.length - 1];
      pts.push(new THREE.Vector3(last.x + Math.cos(heading) * stepLen, last.y + dy + (rand() - 0.5) * stepLen * 0.08, last.z + Math.sin(heading) * stepLen));
    }
    return pts;
  };

  const D = spec.depth;
  const entrance = new THREE.Vector3(0, 0, 0);
  // the camera starts above the entrance and drops in
  path.push(new THREE.Vector3(-30 * S, 22 * S, -30 * S), new THREE.Vector3(-8 * S, 6 * S, -8 * S), entrance.clone());

  if (spec.style === "trunk") {
    // entrance passage sloping down to the upper trunk
    const descent = [entrance.clone(), new THREE.Vector3(10 * S, -D * 0.35, 6 * S), new THREE.Vector3(24 * S, -D * 0.75, 18 * S), new THREE.Vector3(40 * S, -D, 30 * S)];
    tube(descent, { w: 4 * S, h: 4 * S, flat: 0.35, formations: 0.05 });
    path.push(...descent.slice(1));
    let start = descent[descent.length - 1];
    const levels = 3;
    for (let lv = 0; lv < levels; lv++) {
      const trunk = walk(start, 14, 22 * S, 0.9);
      const lowest = lv === levels - 1;
      tube(trunk, { w: r(7, 10) * S, h: r(5, 8) * S, flat: 0.4, rough: 0.4, river: lowest && spec.river, formations: (spec.formations ?? 0.2) * 0.6 });
      path.push(...trunk.slice(1));
      // side passages
      for (let b = 0; b < 4; b++) {
        const from = trunk[1 + Math.floor(rand() * (trunk.length - 2))];
        tube(walk(from, 6, 10 * S, 1.4), { w: r(1.6, 3) * S, h: r(2, 3.5) * S, flat: 0.3, formations: spec.formations });
      }
      if (!lowest) {
        // a pit down to the next level
        const end = trunk[trunk.length - 1];
        const next = new THREE.Vector3(end.x + 8 * S, end.y - r(22, 32) * S, end.z + 6 * S);
        tube([end, new THREE.Vector3(end.x + 2 * S, end.y - 10 * S, end.z + 1 * S), next], { w: 3 * S, h: 3 * S, flat: 0, rough: 0.5 });
        path.push(next);
        start = next;
      }
    }
  } else if (spec.style === "chamber") {
    // a switchback "main corridor" down to the great rooms
    const corridor = [entrance.clone()];
    let x = 0;
    let z = 0;
    const legs = Math.max(3, Math.round(D / 40));
    for (let i = 1; i <= legs; i++) {
      x += (i % 2 ? 1 : -1) * 34 * S;
      z += 14 * S;
      corridor.push(new THREE.Vector3(x, -(D * i) / legs, z));
    }
    tube(corridor, { w: 6 * S, h: 7 * S, flat: 0.35, formations: (spec.formations ?? 0.3) * 0.5 });
    path.push(...corridor.slice(1));
    let c = corridor[corridor.length - 1].clone();
    const rooms = 4;
    for (let i = 0; i < rooms; i++) {
      const big = i === rooms - 1 ? 1.5 : 1;
      const rx = r(22, 34) * S * big;
      const rz = r(16, 26) * S * big;
      const ry = r(10, 16) * S * big;
      const centre = new THREE.Vector3(c.x + rx * 0.9, c.y + ry * 0.35, c.z + rz * 0.5);
      room(centre, rx, ry, rz, spec.formations ?? 0.6, i);
      const exit = new THREE.Vector3(centre.x + rx * 0.9, c.y + r(-6, 2) * S, centre.z + r(-0.4, 0.4) * rz);
      path.push(new THREE.Vector3(centre.x - rx * 0.5, centre.y - ry * 0.25, centre.z), new THREE.Vector3(centre.x + rx * 0.4, centre.y - ry * 0.2, centre.z + rz * 0.15));
      if (i < rooms - 1) {
        const link = [new THREE.Vector3(centre.x + rx * 0.8, exit.y, centre.z), exit, new THREE.Vector3(exit.x + 14 * S, exit.y - r(0, 6) * S, exit.z + 6 * S)];
        tube(link, { w: 4 * S, h: 4.5 * S, flat: 0.35, formations: spec.formations });
        c = link[link.length - 1];
        path.push(...link.slice(1));
      }
    }
  } else if (spec.style === "maze") {
    // a 3D lattice of narrow fissure passages — Wind & Jewel cave are dense mazes
    const step = 16 * S;
    const nx = 7;
    const nz = 7;
    const levels = 3;
    const node = (i: number, k: number, l: number) =>
      new THREE.Vector3((i - nx / 2) * step + (noise(i, k, l) - 0.5) * step * 0.5, -D - l * 18 * S + (noise(k, l, i) - 0.5) * 6 * S, (k - nz / 2) * step + (noise(l, i, k) - 0.5) * step * 0.5);
    const edges: [THREE.Vector3, THREE.Vector3][] = [];
    for (let l = 0; l < levels; l++)
      for (let i = 0; i < nx; i++)
        for (let k = 0; k < nz; k++) {
          if (i < nx - 1 && rand() < 0.62) edges.push([node(i, k, l), node(i + 1, k, l)]);
          if (k < nz - 1 && rand() < 0.62) edges.push([node(i, k, l), node(i, k + 1, l)]);
          if (l < levels - 1 && rand() < 0.12) edges.push([node(i, k, l), node(i, k, l + 1)]);
        }
    for (const [a, b] of edges) {
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(r(-2, 2) * S, r(-1.5, 1.5) * S, r(-2, 2) * S));
      tube([a, mid, b], { w: r(1.2, 2.4) * S, h: r(1.8, 3.2) * S, flat: 0.25, rough: 0.55, density: 1.2, formations: spec.formations });
    }
    // entrance shaft down into the first level, then a wander through the maze
    const first = node(Math.floor(nx / 2), Math.floor(nz / 2), 0);
    const shaft = [entrance.clone(), new THREE.Vector3(2 * S, -D * 0.5, 2 * S), first];
    tube(shaft, { w: 2.2 * S, h: 2.6 * S, flat: 0.1 });
    path.push(...shaft.slice(1));
    let ci = Math.floor(nx / 2);
    let ck = Math.floor(nz / 2);
    let cl = 0;
    for (let s = 0; s < 18; s++) {
      const moves = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
      ].filter(([di, dk, dl]) => ci + di >= 0 && ci + di < nx && ck + dk >= 0 && ck + dk < nz && cl + dl < levels);
      const [di, dk, dl] = moves[Math.floor(rand() * moves.length)];
      const a = node(ci, ck, cl);
      ci += di;
      ck += dk;
      cl += dl;
      const b = node(ci, ck, cl);
      const mid = a.clone().lerp(b, 0.5);
      tube([a, mid, b], { w: 2.4 * S, h: 3.2 * S, flat: 0.25, rough: 0.45, density: 1.2 });
      // pass close to each node and through each midpoint so corners stay inside the passage
      path.push(a.clone().lerp(b, 0.15), mid, a.clone().lerp(b, 0.85), b);
    }
  } else {
    // lava tube: one long, round, flat-floored tunnel just under the surface, with skylights
    const tubePts = walk(new THREE.Vector3(6 * S, -D, 4 * S), 18, 24 * S, 0.45, -0.4 * S);
    const ramp = [entrance.clone(), new THREE.Vector3(3 * S, -D * 0.5, 2 * S), tubePts[0]];
    tube(ramp, { w: 3 * S, h: 3 * S, flat: 0.3 });
    tube(tubePts, { w: r(5, 7) * S, h: r(4, 6) * S, flat: 0.375, rough: 0.2, formations: (spec.formations ?? 0.1) * 0.4, skylights: [[0.33, 0.36], [0.71, 0.74]], along: [0, 1] });
    path.push(...ramp.slice(1), ...tubePts.slice(1));
    // light shafts through the skylights
    const curve = new THREE.CatmullRomCurve3(tubePts);
    for (const t of [0.345, 0.725]) {
      const p = curve.getPointAt(t);
      for (let i = 0; i < 260; i++) {
        tmp.set(p.x + (rand() - 0.5) * 3 * S, p.y + rand() * (D + 4 * S), p.z + (rand() - 0.5) * 3 * S);
        cloud.add(tmp, color.set("#fef3c7"), 0.7, PK.beam);
      }
    }
  }

  /* surface: a contoured ground grid over the whole cave (unless real terrain is supplied) */
  const box = new THREE.Box3();
  for (let i = 0; i < cloud.pos.length; i += 3) box.expandByPoint(tmp.set(cloud.pos[i], cloud.pos[i + 1], cloud.pos[i + 2]));
  const pad = 30 * S;
  const gs = 4 * S;
  if (spec.surface !== false) for (let x = box.min.x - pad; x <= box.max.x + pad; x += gs)
    for (let z = box.min.z - pad; z <= box.max.z + pad; z += gs) {
      const hgt = (noise(x * 0.02, 0, z * 0.02) - 0.5) * 8 * S;
      // contour lines every 2 m read as a topo map
      const contour = Math.abs(((hgt / (2 * S)) % 1) + 1) % 1 < 0.12;
      tmp.set(x + (rand() - 0.5) * gs * 0.5, hgt + 0.5, z + (rand() - 0.5) * gs * 0.5);
      cloud.add(tmp, color.set(contour ? "#67e8f9" : "#1e3a5f"), contour ? 0.9 : 0.6, PK.surface);
    }
  // a beacon marking the entrance
  for (let i = 0; i < 180; i++) {
    tmp.set((rand() - 0.5) * 0.8, rand() * 40 * S, (rand() - 0.5) * 0.8);
    cloud.add(tmp, color.set("#22d3ee"), 0.8, PK.beam);
  }

  /* carve the explorer's route: where other passages cross it, their walls would hang like
     curtains across the way — real intersecting passages open into each other instead */
  {
    const flight = new THREE.CatmullRomCurve3(path, false, "centripetal", 0.4);
    const FL = flight.getLength();
    const clear = (spec.style === "maze" ? 1.0 : 1.5) * S;
    const CELL = 2;
    const hash = new Map<string, number[]>();
    const k = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
    for (let d = 0; d <= FL; d += 0.6) {
      const p = flight.getPointAt(d / FL);
      if (p.y > -1) continue; // only underground
      const key = k(p.x, p.y, p.z);
      if (!hash.has(key)) hash.set(key, []);
      hash.get(key)!.push(p.x, p.y, p.z);
    }
    const near = (x: number, y: number, z: number) => {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const cz = Math.floor(z / CELL);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const a = hash.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (a) for (let i = 0; i < a.length; i += 3) if ((a[i] - x) ** 2 + (a[i + 1] - y) ** 2 + (a[i + 2] - z) ** 2 < clear * clear) return true;
          }
      return false;
    };
    const keep: number[] = [];
    for (let i = 0; i < cloud.size.length; i++) {
      const kind = cloud.kind[i];
      const solid = kind === PK.wall || kind === PK.formation || kind === PK.crystal;
      if (!solid || !near(cloud.pos[i * 3], cloud.pos[i * 3 + 1], cloud.pos[i * 3 + 2])) keep.push(i);
    }
    if (keep.length < cloud.size.length) {
      const pick = <T,>(arr: T[], w: number) => keep.flatMap((i) => arr.slice(i * w, i * w + w));
      cloud.pos = pick(cloud.pos, 3);
      cloud.col = pick(cloud.col, 3);
      cloud.size = pick(cloud.size, 1);
      cloud.kind = pick(cloud.kind, 1);
      cloud.along = pick(cloud.along, 1);
    }
  }

  const bounds = new THREE.Box3();
  for (let i = 0; i < cloud.pos.length; i += 3) bounds.expandByPoint(tmp.set(cloud.pos[i], cloud.pos[i + 1], cloud.pos[i + 2]));

  return {
    positions: new Float32Array(cloud.pos),
    colors: new Float32Array(cloud.col),
    sizes: new Float32Array(cloud.size),
    kinds: new Float32Array(cloud.kind),
    along: new Float32Array(cloud.along),
    count: cloud.size.length,
    path,
    entrance,
    bounds,
    maxDepth: Math.round(maxDepth),
  };
}
