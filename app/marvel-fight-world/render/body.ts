/* ------------------------------------------------------------------ */
/*  Body painter: turns a posed rig into a comic-book superhero.        */
/*                                                                      */
/*  - Muscle-profiled limbs (tapered capsules with bicep / calf bulges) */
/*  - V-shaped torso built from a smooth spline (delts, lats, waist)    */
/*  - Cel shading from a fixed key light + arena-tinted rim light       */
/*  - Costume zones: shirt, trunks, belt, gloves, boots, chest marks    */
/*  - One ink outline per shape; every shape is kept as a Path2D so the */
/*    hit flash can re-light the whole silhouette in one pass.          */
/*                                                                      */
/*  Rig points are world-space (y up). Everything here is drawn in      */
/*  screen space (y down) after the caller has translated to the        */
/*  fighter's position.                                                 */
/* ------------------------------------------------------------------ */

import type { Look } from "../engine/types";
import { patternApplies, type CostumeSpec } from "./costume";
import { clamp, glow, lerp, rgb, shade } from "./util";

export type V = [number, number];

export const INK = "#0a0c14";
/** Key light direction in screen space (from upper-left, y down). */
const LIGHT: V = [-0.62, -0.78];

const sp = (p: V): V => [p[0], -p[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const len = (a: V) => Math.hypot(a[0], a[1]) || 1;
const norm = (a: V): V => mul(a, 1 / len(a));
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const perp = (a: V): V => [-a[1], a[0]];
const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Blend two colours (any CSS colour) → rgb() string. */
export function mixColor(a: string, b: string, t: number) {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

/* ── Paint context ─────────────────────────────────────────────────── */
export interface Paint {
  ctx: CanvasRenderingContext2D;
  /** Afterimage: flat single colour, no ink */
  ghost?: string;
  rim: string;
  /** Darken back limbs for depth (0..1) */
  depth: number;
  /** Ink width multiplier */
  ink: number;
  /** Shapes drawn so far (for the hit flash pass) */
  paths: Path2D[];
}

/** Cel-shaded fill: lit band, base, hard shadow terminator, rim-lit edge. */
function celFill(p: Paint, path: Path2D, base: string, from: V, to: V, opts: { gloss?: number } = {}) {
  const { ctx } = p;
  // Afterimages are filled once as a merged silhouette (see silhouetteFill)
  if (p.ghost) return;
  const c = p.depth ? shade(base, -0.34 * p.depth) : base;
  const g = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
  const gloss = opts.gloss ?? 0.3;
  g.addColorStop(0, shade(c, gloss));
  g.addColorStop(0.16, shade(c, gloss * 0.35));
  g.addColorStop(0.5, c);
  g.addColorStop(0.6, shade(c, -0.08));
  g.addColorStop(0.64, shade(c, -0.36));
  g.addColorStop(0.86, shade(c, -0.46));
  g.addColorStop(1, mixColor(shade(c, -0.3), p.rim, 0.55 * (1 - p.depth * 0.6)));
  ctx.fillStyle = g;
  ctx.fill(path);
}

function inkStroke(p: Paint, path: Path2D, w = 3.2) {
  if (p.ghost) return;
  const { ctx } = p;
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = w * p.ink;
  ctx.stroke(path);
}

/** Lit side → dark side across a shape whose axis is `axis` at point `c`, half-width `r`. */
function lightSpan(c: V, axis: V, r: number): [V, V] {
  let n = perp(norm(axis));
  if (dot(n, LIGHT) < 0) n = mul(n, -1);
  // Bias toward the light so the terminator sits on the far side
  return [add(c, mul(n, r * 1.05)), sub(c, mul(n, r * 1.05))];
}

/* ── Limb geometry ─────────────────────────────────────────────────── */
export interface LimbProfile {
  /** Radius at the start joint, the muscle belly, and the end joint */
  r0: number;
  r1: number;
  /** Belly radius on the opposite side (e.g. tricep vs bicep) */
  r1b?: number;
  r2: number;
  /** Where the belly sits along the limb (0..1) */
  at: number;
}

/** Tapered muscle capsule from a → b (screen space). */
export function limbPath(a: V, b: V, pr: LimbProfile): Path2D {
  const d = sub(b, a);
  const L = len(d);
  const u = mul(d, 1 / L);
  const n = perp(u);
  const aN = Math.atan2(n[1], n[0]);
  const belly = add(a, mul(u, L * pr.at));
  // Quadratic control offset that makes the curve peak at the belly radius
  const c1 = 2 * pr.r1 - (pr.r0 + pr.r2) / 2;
  const c2 = 2 * (pr.r1b ?? pr.r1) - (pr.r0 + pr.r2) / 2;
  const path = new Path2D();
  const s0 = add(a, mul(n, pr.r0));
  path.moveTo(s0[0], s0[1]);
  const m1 = add(belly, mul(n, c1));
  const e1 = add(b, mul(n, pr.r2));
  path.quadraticCurveTo(m1[0], m1[1], e1[0], e1[1]);
  path.arc(b[0], b[1], pr.r2, aN, aN - Math.PI, true);
  const m2 = sub(belly, mul(n, c2));
  const e2 = sub(a, mul(n, pr.r0));
  path.quadraticCurveTo(m2[0], m2[1], e2[0], e2[1]);
  path.arc(a[0], a[1], pr.r0, aN + Math.PI, aN, true);
  path.closePath();
  return path;
}

/* ── Shapes & groups ───────────────────────────────────────────────── */
/**
 * A body part: its silhouette plus deferred fill / detail painters.
 * Parts are painted in groups (a whole arm, a whole leg): one ink pass
 * under every part first, then the fills, so joints inside a limb never
 * show seams — the limb reads as one continuous, muscled silhouette.
 */
export interface Shape {
  path: Path2D;
  fill: () => void;
  detail?: () => void;
}

export function paintGroup(p: Paint, shapes: Shape[], inkW = 3.3) {
  const { ctx } = p;
  if (!p.ghost) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = inkW * 2 * p.ink;
    for (const s of shapes) ctx.stroke(s.path);
    ctx.restore();
  }
  for (const s of shapes) s.fill();
  if (!p.ghost) for (const s of shapes) s.detail?.();
  for (const s of shapes) p.paths.push(s.path);
}

/** Costume seam: a thin ink edge around a cuff / boot shaft. */
function seam(p: Paint, path: Path2D) {
  p.ctx.save();
  p.ctx.strokeStyle = "rgba(10,12,20,0.75)";
  p.ctx.lineWidth = 1.7 * p.ink;
  p.ctx.stroke(path);
  p.ctx.restore();
}

export function limb(
  p: Paint,
  aW: V,
  bW: V,
  pr: LimbProfile,
  color: string,
  opts: { gloss?: number; seam?: boolean; stripe?: string; costume?: CostumeSpec; ragged?: boolean } = {}
): Shape {
  const a = sp(aW);
  const b = sp(bW);
  const path = limbPath(a, b, pr);
  const [l0, l1] = lightSpan(lerpV(a, b, pr.at), sub(b, a), Math.max(pr.r1, pr.r1b ?? 0));
  const litN = norm(sub(l0, l1));
  const rr = Math.max(pr.r1, pr.r1b ?? 0);
  const s0 = add(lerpV(a, b, 0.14), mul(litN, rr * 0.5));
  const s1 = add(lerpV(a, b, Math.min(0.72, pr.at + 0.32)), mul(litN, rr * 0.48));
  return {
    path,
    fill: () => celFill(p, path, color, l0, l1, { gloss: opts.gloss }),
    detail: () => {
      const { ctx } = p;
      const axis = sub(b, a);
      const L = len(axis);
      const u = norm(axis);
      // Side-seam stripe on the shadow side (Spidey's blue, Deadpool's black)
      if (opts.stripe) {
        ctx.save();
        ctx.clip(path);
        ctx.strokeStyle = shade(opts.stripe, p.depth ? -0.3 : 0);
        ctx.lineCap = "butt";
        ctx.lineWidth = rr * 0.8;
        const o = mul(litN, -rr * 0.72);
        ctx.beginPath();
        ctx.moveTo(a[0] - u[0] * rr + o[0], a[1] - u[1] * rr + o[1]);
        ctx.lineTo(b[0] + u[0] * rr + o[0], b[1] + u[1] * rr + o[1]);
        ctx.stroke();
        ctx.restore();
      }
      if (opts.costume && patternApplies(opts.costume, color)) drawPattern(ctx, opts.costume, path, lerpV(a, b, 0.5), axis, L / 2 + rr, "limb", rr);
      if (opts.ragged) {
        // Torn hem: jagged teeth below the band
        const n2 = perp(u);
        ctx.fillStyle = shade(color, p.depth ? -0.34 : -0.05);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8 * p.ink;
        ctx.beginPath();
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          const k = -1 + (2 * i) / steps;
          const base = add(b, mul(n2, k * pr.r2 * 1.05));
          const tip = add(base, mul(u, (i % 2 ? 9 : 4) + rr * 0.15));
          if (i === 0) ctx.moveTo(base[0], base[1]);
          ctx.lineTo(tip[0], tip[1]);
          ctx.lineTo(base[0] + n2[0] * pr.r2 * 0.2, base[1] + n2[1] * pr.r2 * 0.2);
        }
        ctx.lineTo(b[0] - n2[0] * pr.r2, b[1] - n2[1] * pr.r2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.save();
      ctx.clip(path);
      ctx.strokeStyle = "rgba(255,255,255,0.17)";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, rr * 0.26);
      ctx.beginPath();
      ctx.moveTo(s0[0], s0[1]);
      ctx.lineTo(s1[0], s1[1]);
      ctx.stroke();
      ctx.restore();
      if (opts.seam) seam(p, path);
    },
  };
}

/** Back-compat single limb (own ink). */
export function drawLimb(p: Paint, aW: V, bW: V, pr: LimbProfile, color: string, gloss?: number): Path2D {
  const s = limb(p, aW, bW, pr, color, { gloss });
  paintGroup(p, [s]);
  return s.path;
}

export function fist(p: Paint, elbowW: V, handW: V, size: number, color: string, open = false, gems = false): Shape {
  const e = sp(elbowW);
  const h = sp(handW);
  const u = norm(sub(h, e));
  const n = perp(u);
  const L = size * (open ? 1.25 : 1.05);
  const W = size * 0.86;
  const c = add(h, mul(u, L * 0.35));
  const corners = [
    add(add(c, mul(u, -L * 0.5)), mul(n, W * 0.5)),
    add(add(c, mul(u, L * 0.5)), mul(n, W * 0.56)),
    add(add(c, mul(u, L * 0.5)), mul(n, -W * 0.56)),
    add(add(c, mul(u, -L * 0.5)), mul(n, -W * 0.5)),
  ];
  const path = new Path2D();
  roundPoly(path, corners, size * 0.34);
  const [l0, l1] = lightSpan(c, u, W * 0.6);
  return {
    path,
    fill: () => celFill(p, path, color, l0, l1, { gloss: 0.4 }),
    detail: () => {
      const { ctx } = p;
      // Knuckle line + thumb
      const k0 = add(c, mul(u, L * 0.2));
      const k1 = add(k0, mul(n, W * 0.44));
      const k2 = add(k0, mul(n, -W * 0.44));
      ctx.strokeStyle = "rgba(10,12,20,0.5)";
      ctx.lineWidth = 1.6 * p.ink;
      ctx.beginPath();
      ctx.moveTo(k1[0], k1[1]);
      ctx.lineTo(k2[0], k2[1]);
      ctx.stroke();
      const th = add(add(c, mul(u, -L * 0.08)), mul(n, -W * 0.46));
      ctx.beginPath();
      ctx.ellipse(th[0], th[1], size * 0.27, size * 0.17, Math.atan2(u[1], u[0]), 0, Math.PI * 2);
      ctx.fillStyle = shade(color, -0.14);
      ctx.fill();
      ctx.strokeStyle = "rgba(10,12,20,0.7)";
      ctx.stroke();
      if (gems) {
        const colors = ["#a855f7", "#ef4444", "#3b82f6", "#facc15", "#22c55e"];
        colors.forEach((gc, i) => {
          const q = add(add(c, mul(u, L * 0.32)), mul(n, (i - 2) * W * 0.2));
          ctx.fillStyle = gc;
          ctx.beginPath();
          ctx.arc(q[0], q[1], size * 0.1, 0, Math.PI * 2);
          ctx.fill();
        });
        const back = add(c, mul(u, -L * 0.15));
        glow(ctx, "#fb923c", back[0], back[1], size * 0.6, 0.8);
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(back[0], back[1], size * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

export function boot(p: Paint, kneeW: V, footW: V, size: number, color: string, facing: number, barefoot = false): Shape {
  const k = sp(kneeW);
  const f = sp(footW);
  const u = norm(sub(f, k)); // down the shin
  const fwd: V = [u[1] * facing, -u[0] * facing]; // foot points forward (perpendicular to shin)
  const heel = add(add(f, mul(fwd, -size * 0.6)), mul(u, size * 0.4));
  const toe = add(add(f, mul(fwd, size * 1.6)), mul(u, size * 0.46));
  const top = add(f, mul(u, -size * 0.55));
  const instep = add(add(f, mul(fwd, size * 0.95)), mul(u, -size * 0.1));
  const path = new Path2D();
  path.moveTo(top[0] - fwd[0] * size * 0.55, top[1] - fwd[1] * size * 0.55);
  path.lineTo(top[0] + fwd[0] * size * 0.5, top[1] + fwd[1] * size * 0.5);
  path.quadraticCurveTo(instep[0], instep[1], toe[0] - u[0] * size * 0.28, toe[1] - u[1] * size * 0.28);
  path.quadraticCurveTo(toe[0] + fwd[0] * size * 0.28, toe[1] + fwd[1] * size * 0.28, toe[0], toe[1]);
  path.lineTo(heel[0], heel[1]);
  path.quadraticCurveTo(heel[0] - fwd[0] * size * 0.32, heel[1] - fwd[1] * size * 0.32, top[0] - fwd[0] * size * 0.55, top[1] - fwd[1] * size * 0.55);
  path.closePath();
  const [l0, l1] = lightSpan(f, u, size);
  return {
    path,
    fill: () => celFill(p, path, color, l0, l1, { gloss: barefoot ? 0.2 : 0.45 }),
    detail: () => {
      const { ctx } = p;
      if (barefoot) {
        // Toes instead of a sole
        ctx.strokeStyle = "rgba(10,12,20,0.45)";
        ctx.lineWidth = 1.4 * p.ink;
        for (const k of [0.25, 0.5, 0.75]) {
          const q = lerpV(add(toe, mul(u, -size * 0.1)), add(instep, mul(u, size * 0.25)), k);
          ctx.beginPath();
          ctx.moveTo(q[0], q[1]);
          ctx.lineTo(q[0] + fwd[0] * size * 0.25, q[1] + fwd[1] * size * 0.25 + 2);
          ctx.stroke();
        }
        return;
      }
      ctx.strokeStyle = shade(color, -0.6);
      ctx.lineWidth = 3.6 * p.ink;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(heel[0], heel[1]);
      ctx.lineTo(toe[0], toe[1]);
      ctx.stroke();
    },
  };
}

function roundPoly(path: Path2D, pts: V[], r: number) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const a = add(p1, mul(norm(sub(p0, p1)), Math.min(r, len(sub(p0, p1)) / 2)));
    const b = add(p1, mul(norm(sub(p2, p1)), Math.min(r, len(sub(p2, p1)) / 2)));
    if (i === 0) path.moveTo(a[0], a[1]);
    else path.lineTo(a[0], a[1]);
    path.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  path.closePath();
}

/** Closed Catmull-Rom spline → Path2D (smooth organic silhouettes). */
function spline(pts: V[], tension = 0.5): Path2D {
  const path = new Path2D();
  const n = pts.length;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const k = tension / 3;
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  path.closePath();
  return path;
}

/* ── Torso ─────────────────────────────────────────────────────────── */
export interface TorsoFrame {
  /** Screen-space hip and neck */
  hip: V;
  neck: V;
  up: V;
  front: V;
  T: number;
  /** Local (s = toward front, h = up from hip) → screen */
  at: (s: number, h: number) => V;
}

export function torsoFrame(hipW: V, neckW: V, facing: number): TorsoFrame {
  const hip = sp(hipW);
  const neck = sp(neckW);
  const up = norm(sub(neck, hip));
  const front: V = [-up[1] * facing, up[0] * facing];
  const T = len(sub(neck, hip));
  return { hip, neck, up, front, T, at: (s, h) => add(add(hip, mul(front, s)), mul(up, h)) };
}

export function drawTorso(p: Paint, fr: TorsoFrame, look: Look, B: number, c: CostumeSpec): Path2D {
  const { at, T } = fr;
  const female = look.body === "female";
  const bare = c.torso === look.skin;
  const b = B * (female ? 1.02 : 1.12);
  // Silhouette (3/4 side view). Male: broad delts, deep chest, lats, narrow
  // waist. Female: narrower shoulders, defined bust, tight waist, fuller hips.
  const pts: V[] = female
    ? [
        at(-17 * b, -4),
        at(17 * b, -4),
        at(18 * b, T * 0.16),
        at(12 * b, T * 0.42),
        at(15 * b, T * 0.58),
        at(21 * b, T * 0.68),
        at(19 * b, T * 0.8),
        at(16 * b, T * 0.95),
        at(7 * b, T * 1.03),
        at(-6 * b, T * 1.03),
        at(-16 * b, T * 0.94),
        at(-16 * b, T * 0.76),
        at(-12 * b, T * 0.5),
        at(-13 * b, T * 0.34),
        at(-17.5 * b, T * 0.14),
      ]
    : [
        at(-16 * b, -4),
        at(16 * b, -4),
        at(17 * b, T * 0.18),
        at(14.5 * b, T * 0.4),
        at(21 * b, T * 0.66),
        at(24 * b, T * 0.82),
        at(21 * b, T * 0.97),
        at(9 * b, T * 1.04),
        at(-6 * b, T * 1.04),
        at(-20 * b, T * 0.95),
        at(-22 * b, T * 0.78),
        at(-17 * b, T * 0.55),
        at(-14 * b, T * 0.36),
        at(-16.5 * b, T * 0.16),
      ];
  const path = spline(pts, 0.55);
  const { ctx } = p;
  const [l0, l1] = lightSpan(at(2 * b, T * 0.6), fr.up, 24 * b);
  celFill(p, path, c.torso, l0, l1, { gloss: c.gloss });

  if (!p.ghost) {
    ctx.save();
    ctx.clip(path);
    const poly = (q: V[], color: string, gloss = 0.2) => {
      const shape = new Path2D();
      q.forEach((v, i) => (i ? shape.lineTo(v[0], v[1]) : shape.moveTo(v[0], v[1])));
      shape.closePath();
      celFill({ ...p, paths: [] }, shape, color, l0, l1, { gloss });
      return shape;
    };
    const band = (h0: number, h1: number, color: string) => poly([at(-40 * b, h0), at(40 * b, h0), at(40 * b, h1), at(-40 * b, h1)], color);

    // Pattern on the base suit (webbing, armour plates, vibranium weave …)
    if (patternApplies(c, c.torso)) drawPattern(ctx, c, path, at(6 * b, T * 0.7), fr.up, 70 * b, "torso");

    // Abdomen stripes (Cap's red/white, Iron Man's gold plates)
    if (c.abStripes) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const s0 = -6 * b + i * 5.6 * b;
        poly([at(s0, T * 0.27), at(s0 + 5.6 * b, T * 0.27), at(s0 + 5.6 * b, T * 0.58), at(s0, T * 0.58)], c.abStripes[i % 2], 0.25);
      }
    }
    // Side panels (lats) and shoulder yoke
    if (c.sides) {
      poly([at(-40 * b, T * 0.22), at(-9 * b, T * 0.24), at(-6 * b, T * 0.55), at(-11 * b, T * 0.86), at(-40 * b, T * 0.9)], c.sides);
      if (c.tiger) {
        // Spiky stripes reaching forward from the back edge
        ctx.fillStyle = c.tiger;
        for (const h of [0.38, 0.52, 0.66, 0.8]) {
          const r0 = at(-24 * b, T * h + 4);
          const r1 = at(-24 * b, T * h - 6);
          const tip = at(-2 * b, T * (h - 0.04));
          ctx.beginPath();
          ctx.moveTo(r0[0], r0[1]);
          ctx.quadraticCurveTo(at(-10 * b, T * h)[0], at(-10 * b, T * h)[1], tip[0], tip[1]);
          ctx.lineTo(r1[0], r1[1]);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    if (c.yoke) poly([at(-40 * b, T * 1.15), at(40 * b, T * 1.15), at(40 * b, T * 0.92), at(9 * b, T * 0.76), at(-40 * b, T * 0.92)], c.yoke, 0.3);

    // Trunks + belt
    band(-10, T * 0.2, c.trunks);
    if (c.sash) {
      poly([at(-40 * b, T * 0.17), at(40 * b, T * 0.17), at(40 * b, T * 0.33), at(-40 * b, T * 0.31)], c.sash, 0.25);
      // Hanging sash tail
      poly([at(10 * b, T * 0.24), at(18 * b, T * 0.24), at(16 * b, -T * 0.25), at(8 * b, -T * 0.2)], shade(c.sash, -0.12));
    } else if (c.belt !== c.trunks || c.buckle !== "none") {
      band(T * 0.2, T * 0.27, c.belt);
    }
    if (c.pouches) {
      for (const s of [-10, 2]) {
        const q = at(s * b, T * 0.235);
        ctx.fillStyle = shade(c.belt, -0.15);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5 * p.ink;
        ctx.beginPath();
        ctx.roundRect(q[0] - 4.5 * b, q[1] - 5 * b, 9 * b, 10 * b, 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (c.buckle !== "none" && !c.sash) {
      const bk = at(12 * b, T * 0.235);
      ctx.fillStyle = c.buckle === "x" ? "#f2c21a" : shade(c.belt, 0.45);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6 * p.ink;
      ctx.beginPath();
      if (c.buckle === "round") ctx.arc(bk[0], bk[1], 5.6 * b, 0, Math.PI * 2);
      else ctx.roundRect(bk[0] - 5.5 * b, bk[1] - 5 * b, 11 * b, 10 * b, 2);
      ctx.fill();
      ctx.stroke();
      if (c.buckle === "x") {
        ctx.strokeStyle = "#0a0c14";
        ctx.lineWidth = 2 * p.ink;
        ctx.beginPath();
        ctx.moveTo(bk[0] - 3.4 * b, bk[1] - 3.4 * b);
        ctx.lineTo(bk[0] + 3.4 * b, bk[1] + 3.4 * b);
        ctx.moveTo(bk[0] + 3.4 * b, bk[1] - 3.4 * b);
        ctx.lineTo(bk[0] - 3.4 * b, bk[1] + 3.4 * b);
        ctx.stroke();
      }
    }

    // Anatomy lines (subtle, comic style)
    ctx.strokeStyle = "rgba(10,12,20,0.32)";
    ctx.lineWidth = 1.8 * p.ink;
    ctx.lineCap = "round";
    const line = (pts2: V[]) => {
      ctx.beginPath();
      ctx.moveTo(pts2[0][0], pts2[0][1]);
      if (pts2.length === 3) ctx.quadraticCurveTo(pts2[1][0], pts2[1][1], pts2[2][0], pts2[2][1]);
      else ctx.lineTo(pts2[1][0], pts2[1][1]);
      ctx.stroke();
    };
    if (female) {
      line([at(1 * b, T * 0.66), at(11 * b, T * 0.6), at(20 * b, T * 0.66)]);
      line([at(4 * b, T * 0.58), at(3 * b, T * 0.3)]);
      line([at(-14 * b, T * 0.78), at(-10 * b, T * 0.6), at(-11 * b, T * 0.44)]);
    } else {
      line([at(-2 * b, T * 0.72), at(10 * b, T * 0.62), at(22 * b, T * 0.7)]); // pec
      line([at(6 * b, T * 0.9), at(5 * b, T * 0.36)]); // sternum / linea alba
      if (B >= 1.05 || bare) {
        for (const h of [0.52, 0.43]) line([at(-1 * b, T * h), at(6 * b, T * (h - 0.02)), at(14 * b, T * h)]);
      }
      line([at(-19 * b, T * 0.82), at(-12 * b, T * 0.62), at(-13 * b, T * 0.42)]); // lat
    }

    // Chest emblem / gear
    drawChest(ctx, fr, c, b, p.ink);

    // Form shading: soft occlusion under the chest, key-light sheen on top
    const occ = at(-4 * b, T * 0.42);
    const og = ctx.createRadialGradient(occ[0], occ[1], 2, occ[0], occ[1], 30 * b);
    og.addColorStop(0, "rgba(0,0,0,0.22)");
    og.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = og;
    ctx.fill(path);
    const sh = at(10 * b, T * 0.8);
    const sg = ctx.createRadialGradient(sh[0] + LIGHT[0] * 8, sh[1] + LIGHT[1] * 8, 1, sh[0], sh[1], 22 * b);
    sg.addColorStop(0, `rgba(255,255,255,${0.16 + c.gloss * 0.3})`);
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fill(path);
    ctx.restore();
  }
  inkStroke(p, path, 3.4);
  p.paths.push(path);
  return path;
}

/* ── Chest emblems ─────────────────────────────────────────────────── */
function drawChest(ctx: CanvasRenderingContext2D, fr: TorsoFrame, c: CostumeSpec, b: number, ink: number) {
  const { at, T } = fr;
  const center = at(8 * b, T * 0.72);
  const ang = Math.atan2(fr.up[1], fr.up[0]) + Math.PI / 2;
  const col = c.chestColor ?? "#f8fafc";
  ctx.save();
  ctx.translate(center[0], center[1]);
  ctx.rotate(ang);
  // Local space: +x toward the front, +y down the body
  const front = Math.sign(fr.front[0] || 1) * Math.sign(Math.cos(ang) || 1);
  ctx.scale(front, 1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const r = 10 * b;
  switch (c.chest) {
    case "spider": {
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6 * ink;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.2, r * 0.22, r * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(0, r * 0.35, r * 0.28, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const s of [-1, 1]) {
        for (const [y0, y1, y2] of [[-0.2, -0.9, -1.1], [0, -0.3, -0.45], [0.2, 0.5, 0.75], [0.35, 1.0, 1.3]]) {
          ctx.beginPath();
          ctx.moveTo(0, r * y0);
          ctx.quadraticCurveTo(s * r * 0.75, r * y1, s * r * 1.1, r * y2);
          ctx.stroke();
        }
      }
      break;
    }
    case "venom": {
      // Big white spider wrapping the chest
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4.2 * b;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.42, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const s of [-1, 1]) {
        for (const [y0, cx, cy, ex, ey] of [[-0.4, 1.2, -1.6, 2.3, -1.4], [-0.1, 1.4, -0.4, 2.5, 0.2], [0.2, 1.3, 0.7, 2.2, 1.6], [0.5, 0.9, 1.4, 1.4, 2.4]]) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.3, r * y0);
          ctx.quadraticCurveTo(s * r * cx, r * cy, s * r * ex, r * ey);
          ctx.stroke();
        }
      }
      break;
    }
    case "star": {
      const R = r * 1.25;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? R : R * 0.42;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.lineWidth = 4 * ink;
      ctx.strokeStyle = "#0a0c14";
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case "reactor": {
      ctx.fillStyle = "#0a0c14";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.62);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.5, "#bff4ff");
      g.addColorStop(1, "#38bdf8");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "discs": {
      for (const x of [-0.75, 0.75]) {
        for (const y of [-0.85, 0, 0.85]) {
          const g = ctx.createRadialGradient(x * r - 2, y * r - 2, 1, x * r, y * r, r * 0.42);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.5, col);
          g.addColorStop(1, "#5b6474");
          ctx.fillStyle = g;
          ctx.strokeStyle = "#0a0c14";
          ctx.lineWidth = 1.6 * ink;
          ctx.beginPath();
          ctx.arc(x * r, y * r, r * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    }
    case "amulet": {
      ctx.translate(0, -r * 0.6);
      ctx.fillStyle = col;
      ctx.strokeStyle = "#0a0c14";
      ctx.lineWidth = 1.8 * ink;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.38, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#052e16";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "diamond":
    case "bolt":
    case "circle": {
      ctx.beginPath();
      if (c.chest === "diamond") {
        ctx.moveTo(0, -r * 1.2);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r * 1.2);
        ctx.lineTo(-r, 0);
      } else if (c.chest === "bolt") {
        ctx.moveTo(r * 0.3, -r * 1.3);
        ctx.lineTo(-r * 0.7, r * 0.15);
        ctx.lineTo(0, r * 0.15);
        ctx.lineTo(-r * 0.35, r * 1.3);
        ctx.lineTo(r * 0.75, -r * 0.2);
        ctx.lineTo(0, -r * 0.2);
      } else ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.lineWidth = 4 * ink;
      ctx.strokeStyle = "#0a0c14";
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
  }
  ctx.restore();

  // Necklace (Black Panther): fangs along the collar
  if (c.necklace) {
    ctx.fillStyle = c.necklace;
    ctx.strokeStyle = "#0a0c14";
    ctx.lineWidth = 1.2 * ink;
    for (let i = -3; i <= 3; i++) {
      const base = at(i * 3.2 * b + 3 * b, T * (0.96 - Math.abs(i) * 0.012));
      const tip = add(base, mul(fr.up, -7 * b));
      const side = mul(perp(fr.up), 1.6 * b);
      ctx.beginPath();
      ctx.moveTo(base[0] + side[0], base[1] + side[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(base[0] - side[0], base[1] - side[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

/* ── Surface patterns (clipped to a part) ──────────────────────────── */
export function drawPattern(ctx: CanvasRenderingContext2D, c: CostumeSpec, clip: Path2D, center: V, axis: V, reach: number, part: "torso" | "limb", r = 10) {
  ctx.save();
  ctx.clip(clip);
  ctx.strokeStyle = c.patternColor ?? "rgba(10,12,20,0.5)";
  ctx.lineWidth = 1.15;
  const u = norm(axis);
  const n = perp(u);
  switch (c.pattern) {
    case "web": {
      if (part === "torso") {
        const spokes = 10;
        for (let i = 0; i < spokes; i++) {
          const a = (i / spokes) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(center[0], center[1]);
          ctx.lineTo(center[0] + Math.cos(a) * reach, center[1] + Math.sin(a) * reach);
          ctx.stroke();
        }
        for (const rr of [0.13, 0.26, 0.42, 0.6, 0.8].map((k) => k * reach)) {
          ctx.beginPath();
          for (let i = 0; i <= spokes; i++) {
            const a0 = (i / spokes) * Math.PI * 2;
            const a1 = ((i + 1) / spokes) * Math.PI * 2;
            const p0: V = [center[0] + Math.cos(a0) * rr, center[1] + Math.sin(a0) * rr];
            const p1: V = [center[0] + Math.cos(a1) * rr, center[1] + Math.sin(a1) * rr];
            const m: V = [center[0] + Math.cos((a0 + a1) / 2) * rr * 0.86, center[1] + Math.sin((a0 + a1) / 2) * rr * 0.86];
            if (i === 0) ctx.moveTo(p0[0], p0[1]);
            ctx.quadraticCurveTo(m[0], m[1], p1[0], p1[1]);
          }
          ctx.stroke();
        }
      } else {
        // Limb webbing: lines along the limb + sagging cross strands
        for (const k of [-0.66, -0.2, 0.2, 0.66]) {
          const o = mul(n, k * r * 1.3);
          ctx.beginPath();
          ctx.moveTo(center[0] - u[0] * reach + o[0], center[1] - u[1] * reach + o[1]);
          ctx.lineTo(center[0] + u[0] * reach + o[0], center[1] + u[1] * reach + o[1]);
          ctx.stroke();
        }
        for (let t = -reach; t <= reach; t += 9) {
          const a = add(add(center, mul(u, t)), mul(n, -r * 1.4));
          const bb = add(add(center, mul(u, t)), mul(n, r * 1.4));
          const m = add(add(center, mul(u, t + 3.5)), mul(n, 0));
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.quadraticCurveTo(m[0], m[1], bb[0], bb[1]);
          ctx.stroke();
        }
      }
      break;
    }
    case "armor": {
      // Plate seams across the part + a bevel line along it
      ctx.lineWidth = 1.8;
      for (const t of part === "torso" ? [-0.25, 0.05, 0.35] : [-0.35, 0.35]) {
        const m = add(center, mul(u, t * reach));
        ctx.beginPath();
        ctx.moveTo(m[0] - n[0] * reach, m[1] - n[1] * reach);
        ctx.quadraticCurveTo(m[0] + u[0] * 4, m[1] + u[1] * 4, m[0] + n[0] * reach, m[1] + n[1] * reach);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      const o = mul(n, -r * 0.45);
      ctx.moveTo(center[0] - u[0] * reach * 0.8 + o[0], center[1] - u[1] * reach * 0.8 + o[1]);
      ctx.lineTo(center[0] + u[0] * reach * 0.8 + o[0], center[1] + u[1] * reach * 0.8 + o[1]);
      ctx.stroke();
      break;
    }
    case "panther": {
      // Vibranium weave: thin interlocking triangles
      const step = 7;
      ctx.lineWidth = 0.8;
      for (let i = -10; i <= 10; i++) {
        for (let j = -10; j <= 10; j++) {
          const q = add(add(center, mul(u, i * step)), mul(n, j * step + (i % 2) * step * 0.5));
          ctx.beginPath();
          ctx.moveTo(q[0] + u[0] * 2.4, q[1] + u[1] * 2.4);
          ctx.lineTo(q[0] + n[0] * 2.4 - u[0] * 1.8, q[1] + n[1] * 2.4 - u[1] * 1.8);
          ctx.lineTo(q[0] - n[0] * 2.4 - u[0] * 1.8, q[1] - n[1] * 2.4 - u[1] * 1.8);
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }
    case "scales": {
      // Chain-mail rings
      const step = 6;
      for (let i = -12; i <= 12; i++) {
        for (let j = -12; j <= 12; j++) {
          const q = add(add(center, mul(u, i * step)), mul(n, j * step + (i % 2) * step * 0.5));
          ctx.beginPath();
          ctx.arc(q[0], q[1], 2.4, 0, Math.PI);
          ctx.stroke();
        }
      }
      break;
    }
  }
  ctx.restore();
}

/* ── Neck & head ───────────────────────────────────────────────────── */
export function drawNeck(p: Paint, neckW: V, headW: V, r: number, color: string) {
  const a = sp(neckW);
  const h = sp(headW);
  const top = lerpV(a, h, 0.55);
  const path = limbPath(a, top, { r0: r * 1.25, r1: r * 1.05, r2: r * 0.95, at: 0.5 });
  const [l0, l1] = lightSpan(lerpV(a, top, 0.5), sub(top, a), r);
  celFill(p, path, color, l0, l1);
  inkStroke(p, path, 2.6);
  p.paths.push(path);
}

export function drawHeadShape(
  p: Paint,
  headW: V,
  r: number,
  tilt: number,
  facing: number,
  portrait: HTMLImageElement | null,
  cowl: string
): Path2D {
  const [hx, hy] = sp(headW);
  const { ctx } = p;
  const rx = r * 0.92;
  const ry = r * 1.08;
  // Head with a slight jaw: ellipse top + tapered chin
  const path = new Path2D();
  const rot = (-tilt * Math.PI) / 180 * facing;
  const pt = (x: number, y: number): V => [hx + x * Math.cos(rot) - y * Math.sin(rot), hy + x * Math.sin(rot) + y * Math.cos(rot)];
  const pts: V[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    let x = Math.cos(a) * rx;
    let y = Math.sin(a) * ry;
    if (y > 0) {
      // Narrow the lower half toward the chin, chin slightly forward
      const k = y / ry;
      x *= 1 - k * 0.22;
      x += facing * k * k * r * 0.12;
    }
    pts.push(pt(x, y));
  }
  const sh = spline(pts, 0.5);
  path.addPath(sh);

  if (p.ghost) {
    p.paths.push(path);
    return path;
  }
  ctx.save();
  ctx.clip(path);
  if (portrait && portrait.complete && portrait.naturalWidth) {
    // Dataset portraits are 320×480 head-and-shoulders art: crop the face
    const img = portrait;
    const sw = img.naturalWidth * 0.6;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = img.naturalHeight * 0.07;
    ctx.translate(hx, hy);
    ctx.rotate(rot);
    ctx.drawImage(img, sx, sy, sw, sw * (ry / rx), -rx * 1.08, -ry * 1.04, rx * 2.16, ry * 2.16);
  } else {
    ctx.fillStyle = shade(cowl, -0.1);
    ctx.fill(path);
  }
  ctx.restore();
  ctx.save();
  ctx.clip(path);
  // Hood: fade the portrait's own background into the costume colour so
  // the head reads as a masked character, not a photo in a bubble
  const [cr, cg, cb] = rgb(cowl);
  const hood = ctx.createRadialGradient(hx, hy + r * 0.08, r * 0.52, hx, hy, r * 1.08);
  hood.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
  hood.addColorStop(0.55, `rgba(${cr},${cg},${cb},0.55)`);
  hood.addColorStop(1, `rgba(${cr},${cg},${cb},0.96)`);
  ctx.fillStyle = hood;
  ctx.fill(path);
  // Volume: soft key light + core shadow + rim light on the dark side
  const g = ctx.createRadialGradient(hx + LIGHT[0] * r * 0.5, hy + LIGHT[1] * r * 0.55, r * 0.15, hx, hy, r * 1.15);
  g.addColorStop(0, "rgba(255,255,255,0.22)");
  g.addColorStop(0.55, "rgba(255,255,255,0)");
  g.addColorStop(0.82, "rgba(0,0,0,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = p.rim;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = r * 0.22;
  ctx.beginPath();
  ctx.arc(hx, hy, r * 1.02, -0.35, 1.25); // rim on the side away from the key light
  ctx.stroke();
  ctx.restore();
  // Ink + thin cowl-coloured inner trim (reads as a mask edge)
  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4 * p.ink;
  ctx.stroke(path);
  ctx.restore();
  p.paths.push(path);
  return path;
}

/* ── Hair ──────────────────────────────────────────────────────────── */
export function drawHair(p: Paint, headW: V, neckW: V, r: number, color: string, facing: number, t: number, sway: number) {
  if (p.ghost) return;
  const { ctx } = p;
  const h = sp(headW);
  const n = sp(neckW);
  const back = -facing;
  const down = norm(sub(n, h));
  const side: V = [back, 0];
  const L = r * 2.7;
  const wave = Math.sin(t * 3.2) * 3 + sway;
  // Full, wavy mass behind the head: crown volume, shoulder-length layers
  const P = (sx: number, dy: number): V => add(add(h, mul(side, sx)), mul(down, dy));
  const pts: V[] = [
    P(-0.75 * r, -0.8 * r),
    P(0.05 * r, -1.18 * r),
    P(1.0 * r, -0.85 * r),
    P(1.42 * r, 0.1 * r),
    P(1.5 * r + wave * 0.4, L * 0.55),
    P(1.38 * r + wave, L),
    P(1.05 * r + wave * 0.9, L * 0.9),
    P(0.8 * r + wave * 0.8, L * 1.02),
    P(0.5 * r + wave * 0.7, L * 0.86),
    P(0.22 * r + wave * 0.5, L * 0.94),
    P(0.1 * r, L * 0.55),
    P(-0.1 * r, 0.6 * r),
    P(-0.7 * r, 0.1 * r),
  ];
  const path = spline(pts, 0.5);
  const crownF = pts[0];
  const crownB = pts[3];
  const tipF = pts[9];
  const tipB = pts[5];
  const g = ctx.createLinearGradient(h[0] - back * r, h[1] - r, h[0] + back * r * 1.6, h[1] + L);
  g.addColorStop(0, shade(color, 0.25));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = withAlphaRgb(shade(color, -0.5), 0.55);
  ctx.lineWidth = 1.6 * p.ink;
  for (const k of [0.25, 0.5, 0.75]) {
    const a0 = lerpV(crownF, crownB, k);
    const a1 = lerpV(tipF, tipB, k);
    ctx.beginPath();
    ctx.moveTo(a0[0], a0[1]);
    ctx.quadraticCurveTo(a0[0] + back * r * 0.5, (a0[1] + a1[1]) / 2, a1[0], a1[1]);
    ctx.stroke();
  }
  ctx.restore();
  inkStroke(p, path, 3);
}

function withAlphaRgb(c: string, a: number) {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── Cape ──────────────────────────────────────────────────────────── */
export function drawCape(p: Paint, bShoulderW: V, fShoulderW: V, color: string, facing: number, H: number, sway: number) {
  const { ctx } = p;
  const a = sp(bShoulderW);
  const b = sp(fShoulderW);
  const L = 128 * H;
  const back = -facing;
  const tipA: V = [a[0] + back * (38 + sway * 1.8), a[1] + L];
  const tipB: V = [b[0] + back * (8 + sway), b[1] + L * 0.97];
  const midA: V = [a[0] + back * (30 + sway), a[1] + L * 0.5];
  const path = new Path2D();
  path.moveTo(a[0] - back * 2, a[1]);
  path.quadraticCurveTo(midA[0], midA[1], tipA[0], tipA[1]);
  // Ragged hem
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(tipA[0], tipB[0], t);
    const y = lerp(tipA[1], tipB[1], t) + (i % 2 ? 8 : -2) * H;
    path.lineTo(x, y);
  }
  path.quadraticCurveTo(b[0] + back * 6, b[1] + L * 0.5, b[0], b[1]);
  path.closePath();
  if (p.ghost) return;
  const g = ctx.createLinearGradient(a[0] + back * 40, 0, b[0], 0);
  g.addColorStop(0, shade(color, -0.45));
  g.addColorStop(0.45, shade(color, -0.1));
  g.addColorStop(0.8, color);
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.fill(path);
  // Folds
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 3;
  for (const t of [0.3, 0.55, 0.8]) {
    const top = lerpV(a, b, t);
    ctx.beginPath();
    ctx.moveTo(top[0], top[1] + 20 * H);
    ctx.quadraticCurveTo(top[0] + back * (14 + sway), top[1] + L * 0.55, lerp(tipA[0], tipB[0], t), lerp(tipA[1], tipB[1], t));
    ctx.stroke();
  }
  ctx.restore();
  inkStroke(p, path, 3);
}

/* ── Hit flash ─────────────────────────────────────────────────────── */
export function flashPaths(p: Paint, amount: number) {
  if (amount <= 0 || p.ghost) return;
  silhouetteFill(p, "#ffffff", clamp(amount, 0, 1) * 0.7, "lighter");
}

/** Fill every body part as ONE merged shape (no overlap seams at joints). */
export function silhouetteFill(p: Paint, color: string, alpha: number, op: GlobalCompositeOperation = "source-over") {
  const all = new Path2D();
  for (const path of p.paths) all.addPath(path);
  const { ctx } = p;
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fill(all, "nonzero");
  ctx.restore();
}

/** Energy aura around fists while casting (kept here so the body owns it). */
export function handGlow(ctx: CanvasRenderingContext2D, handW: V, color: string, r: number, a: number) {
  const h = sp(handW);
  glow(ctx, color, h[0], h[1], r, a);
}


/* ── Headgear silhouettes (signature fighters) ─────────────────────── */
/**
 * Iconic shapes around the portrait head so the silhouette reads as the
 * character even at a glance: Wolverine's cowl fins, Thor's helmet
 * wings, Cap's temple wings, Panther's ears, Strange's cloak collar.
 * "back" pieces sit behind the head, "front" pieces overlap its edge.
 */
export function drawHeadgear(p: Paint, headW: V, r: number, tilt: number, facing: number, kind: string, layer: "back" | "front") {
  const { ctx } = p;
  const [hx, hy] = sp(headW);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(((-tilt * Math.PI) / 180) * facing);
  ctx.lineJoin = "round";
  const shape = (pts: [number, number][], fill: string | CanvasGradient, inkW = 3) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = inkW * p.ink;
    ctx.stroke();
  };
  const metal = (x0: number, y0: number, x1: number, y1: number, a: string, b: string) => {
    const g = ctx.createLinearGradient(x0 * r, y0 * r, x1 * r, y1 * r);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  for (const s of [-1, 1]) {
    if (layer === "back") {
      if (kind === "wolverine") {
        shape(
          [
            [s * 0.4, -0.72],
            [s * 0.62, -1.15],
            [s * 1.08, -1.78],
            [s * 0.95, -1.15],
            [s * 0.9, -0.3],
          ],
          metal(s * 0.4, -0.7, s * 1.0, -1.7, "#2a2b36", "#08080c")
        );
      } else if (kind === "thor") {
        shape(
          [
            [s * 0.7, -0.74],
            [s * 1.1, -1.02],
            [s * 1.62, -1.36],
            [s * 1.44, -1.0],
            [s * 1.66, -0.86],
            [s * 1.32, -0.64],
            [s * 1.5, -0.44],
            [s * 1.08, -0.26],
            [s * 0.84, -0.04],
          ],
          metal(s * 0.8, -0.2, s * 1.8, -1.6, "#94a3b8", "#f8fafc")
        );
      } else if (kind === "panther") {
        shape(
          [
            [s * 0.32, -0.86],
            [s * 0.62, -1.4],
            [s * 0.84, -0.66],
          ],
          "#1c1c26"
        );
      }
    } else if (kind === "cap") {
      shape(
        [
          [s * 0.8, -0.24],
          [s * 1.4, -0.82],
          [s * 1.14, -0.5],
          [s * 1.34, -0.42],
          [s * 1.06, -0.2],
          [s * 1.2, -0.08],
          [s * 0.88, 0.06],
        ],
        "#f8fafc",
        2.4
      );
    }
  }
  if (layer === "back" && kind === "strange") {
    // High red cloak collar fanning up behind the head
    ctx.beginPath();
    ctx.moveTo(-1.15 * r, 1.25 * r);
    ctx.quadraticCurveTo(-1.65 * r, -0.4 * r, -0.95 * r, -1.05 * r);
    ctx.quadraticCurveTo(-0.3 * r, -0.35 * r, 0, -0.55 * r);
    ctx.quadraticCurveTo(0.3 * r, -0.35 * r, 0.95 * r, -1.05 * r);
    ctx.quadraticCurveTo(1.65 * r, -0.4 * r, 1.15 * r, 1.25 * r);
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.7);
    g.addColorStop(0, "#7f1d1d");
    g.addColorStop(0.6, "#c8102e");
    g.addColorStop(1, "#e3364e");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3 * p.ink;
    ctx.stroke();
    // Gold trim on the collar edge
    ctx.strokeStyle = "#c79a2a";
    ctx.lineWidth = 2 * p.ink;
    ctx.beginPath();
    ctx.moveTo(-1.08 * r, 1.0 * r);
    ctx.quadraticCurveTo(-1.5 * r, -0.4 * r, -0.92 * r, -0.95 * r);
    ctx.moveTo(1.08 * r, 1.0 * r);
    ctx.quadraticCurveTo(1.5 * r, -0.4 * r, 0.92 * r, -0.95 * r);
    ctx.stroke();
  }
  ctx.restore();
}
