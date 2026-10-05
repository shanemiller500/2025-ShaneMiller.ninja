/* ------------------------------------------------------------------ */
/*  Projectile + move effect visuals (world space, y negated on draw)   */
/* ------------------------------------------------------------------ */

import type { Fighter } from "../engine/fighter";
import type { Projectile } from "../engine/match";
import type { FxKind } from "../engine/types";
import { star } from "./fighterDraw";
import { FX_COLORS, glow, hash, withAlpha } from "./util";

/** Jagged lightning polyline between two points (y-up world coords). */
export function bolt(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number, width: number, color: string) {
  const n = 9;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = i === 0 || i === n ? 0 : (hash(seed + i * 13.1) - 0.5) * 46;
    pts.push([x1 + (x2 - x1) * t + j, y1 + (y2 - y1) * t]);
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [w, c] of [
    [width * 3.2, withAlpha(color, 0.25)],
    [width * 1.6, color],
    [width * 0.6, "#ffffff"],
  ] as [number, string][]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y)));
    ctx.stroke();
  }
}

function orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fx: FxKind, t: number) {
  const c = FX_COLORS[fx];
  glow(ctx, c.glow, x, -y, r * 3.2, 0.9);
  const g = ctx.createRadialGradient(x, -y, 0, x, -y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, c.core);
  g.addColorStop(1, withAlpha(c.glow, 0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, -y, r * (0.92 + Math.sin(t * 30) * 0.08), 0, Math.PI * 2);
  ctx.fill();
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, owner: Fighter, t: number) {
  if (p.dead) return;
  const fx = p.spec.fx;
  const c = FX_COLORS[fx];
  const x = p.x;
  const y = p.y;
  const dir = p.vx >= 0 ? 1 : -1;

  switch (fx) {
    case "web": {
      // Strand back to the thrower's hand for pulls
      if (p.spec.pull && !p.returning) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(owner.x + owner.facing * 40, -(owner.y + owner.def.height * 0.62));
        ctx.lineTo(x, -y);
        ctx.stroke();
      }
      glow(ctx, "#e2e8f0", x, -y, p.w * 1.3, 0.5);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      const r = Math.min(p.w, p.h) * 0.62;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 4;
        ctx.beginPath();
        ctx.moveTo(x, -y);
        ctx.lineTo(x + Math.cos(a) * r, -y + Math.sin(a) * r);
        ctx.stroke();
      }
      for (const rr of [r * 0.45, r * 0.85]) {
        ctx.beginPath();
        ctx.arc(x, -y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "symbiote": {
      ctx.strokeStyle = "#0b0b12";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      const sx = owner.x + owner.facing * 40;
      const sy = owner.y + owner.def.height * 0.6;
      ctx.moveTo(sx, -sy);
      const mx = (sx + x) / 2;
      ctx.quadraticCurveTo(mx, -(sy + 40 * Math.sin(t * 10)), x, -y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#0b0b12";
      ctx.beginPath();
      ctx.arc(x, -y, 16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "shield": {
      ctx.save();
      ctx.translate(x, -y);
      ctx.rotate(t * 18);
      ctx.scale(1, 0.55);
      const r = 28;
      ["#c8102e", "#f8fafc", "#c8102e", "#1f3f8f"].forEach((cc, i) => {
        ctx.fillStyle = cc;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1 - i * 0.22), 0, Math.PI * 2);
        ctx.fill();
      });
      star(ctx, 0, 0, r * 0.3, "#f8fafc");
      ctx.restore();
      glow(ctx, "#60a5fa", x, -y, 50, 0.5);
      break;
    }
    case "hammer": {
      ctx.save();
      ctx.translate(x, -y);
      ctx.rotate(t * -20 * dir);
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(-4, 0, 8, 36);
      const g = ctx.createLinearGradient(-22, -14, 22, 14);
      g.addColorStop(0, "#f1f5f9");
      g.addColorStop(1, "#64748b");
      ctx.fillStyle = "#0a0c14";
      ctx.fillRect(-24, -18, 48, 30);
      ctx.fillStyle = g;
      ctx.fillRect(-22, -16, 44, 26);
      ctx.restore();
      glow(ctx, "#93c5fd", x, -y, 70, 0.55);
      if (Math.floor(t * 30) % 3 === 0) bolt(ctx, x, y, x - dir * 60, y + (hash(t) - 0.5) * 60, t * 7, 2, "#93c5fd");
      break;
    }
    case "lightning": {
      if (p.fromSky) {
        bolt(ctx, x + (hash(p.id) - 0.5) * 80, 900, x, y - p.h / 2, Math.floor(t * 40) + p.id, 5, "#7dd3fc");
        glow(ctx, "#7dd3fc", x, -(y - p.h / 2), 120, 0.8);
      } else orb(ctx, x, y, 20, fx, t);
      break;
    }
    case "magnet": {
      if (p.fromSky) {
        // Falling scrap metal
        ctx.save();
        ctx.translate(x, -y);
        ctx.rotate(t * 6 + p.id);
        ctx.fillStyle = "#0a0c14";
        ctx.fillRect(-24, -12, 48, 24);
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(-22, -10, 44, 20);
        ctx.restore();
        glow(ctx, "#ec4899", x, -y, 60, 0.45);
      } else {
        glow(ctx, "#ec4899", x, -y, p.w * 1.4, 0.7);
        ctx.strokeStyle = "#f9a8d4";
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x, -y, ((t * 120 + i * 14) % 40) + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      break;
    }
    case "missile": {
      const ang = Math.atan2(-p.vy, p.vx);
      ctx.save();
      ctx.translate(x, -y);
      ctx.rotate(ang);
      ctx.fillStyle = "#0a0c14";
      ctx.fillRect(-16, -6, 32, 12);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(-14, -4, 26, 8);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(10, -4, 6, 8);
      ctx.restore();
      glow(ctx, "#fb923c", x - Math.cos(ang) * 18, -y + Math.sin(ang) * 18, 26, 0.9);
      break;
    }
    case "bullet": {
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - p.vx * 1.5, -y);
      ctx.lineTo(x, -y);
      ctx.stroke();
      glow(ctx, "#fbbf24", x, -y, 18, 0.9);
      break;
    }
    case "ground": {
      // Shockwave: a rolling wall of energy and rubble
      const h = p.h;
      const g = ctx.createLinearGradient(x, 0, x, -h);
      g.addColorStop(0, withAlpha("#fde68a", 0.85));
      g.addColorStop(1, withAlpha("#b45309", 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - dir * p.w * 0.9, 0);
      ctx.quadraticCurveTo(x, -h * 1.1, x + dir * p.w * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      glow(ctx, "#f59e0b", x, -h * 0.3, h * 0.9, 0.6);
      break;
    }
    default:
      orb(ctx, x, y, Math.min(p.w, p.h) * 0.48, fx, t);
      // tail
      for (let i = 1; i < 5; i++) glow(ctx, c.glow, x - p.vx * i * 1.4, -(y - p.vy * i * 1.4), (Math.min(p.w, p.h) * 0.9) / i, 0.5);
  }
}

/** Visuals tied to the fighter's current move (beams, areas, slashes, auras). */
export function drawMoveFx(ctx: CanvasRenderingContext2D, f: Fighter, t: number) {
  const m = f.move;
  const H = f.def.look.height;
  const chestY = f.y + f.def.height * 0.66;

  // Persistent statuses
  if (f.shield > 0) {
    const a = Math.min(1, f.shield / 30);
    const r = f.def.height * 0.62;
    glow(ctx, f.def.look.glow ?? "#60a5fa", f.x, -(f.y + f.def.height * 0.5), r * 1.2, 0.35 * a);
    ctx.strokeStyle = withAlpha(f.def.look.glow ?? "#93c5fd", 0.65 * a);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x, -(f.y + f.def.height * 0.5), r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const ang = t * 0.8 + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(ang) * r * 0.6, -(f.y + f.def.height * 0.5) + Math.sin(ang) * r * 0.6, r * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (f.state === "dizzy") {
    for (let i = 0; i < 4; i++) {
      const ang = t * 4 + (i / 4) * Math.PI * 2;
      const sx = f.x + Math.cos(ang) * 34;
      const sy = -(f.y + f.def.height + 18) + Math.sin(ang) * 9;
      star(ctx, sx, sy, 9, "#fde047");
    }
  }
  if (f.state === "trapped") {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const yy = f.y + 20 + i * (f.def.height / 7);
      ctx.beginPath();
      ctx.moveTo(f.x - f.def.width * 0.7, -yy);
      ctx.quadraticCurveTo(f.x, -(yy + 14), f.x + f.def.width * 0.7, -yy + 6);
      ctx.stroke();
    }
  }

  if (!m || f.movePhase === "recovery") return;
  const active = f.movePhase === "active";
  const c = FX_COLORS[m.fx];

  // Charge glow while winding up a special/ultimate
  if (!active && (m.kind === "special" || m.kind === "ultimate")) {
    const k = f.moveTime / Math.max(1, m.startup);
    glow(ctx, c.glow, f.x + f.facing * 30, -chestY, 60 + k * 90, 0.35 + k * 0.4);
  }
  if (!active) return;

  // Beams (long thin hitboxes)
  const hb = m.hitbox;
  if (hb && hb.w >= 500 && hb.h <= 120) {
    const x0 = f.x + f.facing * 40;
    const x1 = f.x + f.facing * (hb.x + hb.w / 2);
    const y0 = f.y + (hb.y + hb.h / 2) * H;
    const w = hb.h * (0.9 + Math.sin(t * 50) * 0.12);
    for (const [ww, col] of [
      [w * 1.8, withAlpha(c.glow, 0.25)],
      [w, withAlpha(c.glow, 0.8)],
      [w * 0.45, "#ffffff"],
    ] as [number, string][]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = ww;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, -y0);
      ctx.lineTo(x1, -y0);
      ctx.stroke();
    }
    glow(ctx, c.glow, x0, -y0, 140, 1);
    return;
  }

  // Area spells (huge boxes): rotating sigils
  if (hb && hb.w >= 500) {
    const cx = f.x + f.facing * hb.x;
    const cy = f.y + (hb.y + hb.h / 2) * H;
    const r = hb.h * 0.7;
    ctx.save();
    ctx.translate(cx, -cy);
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      ctx.rotate(t * (k % 2 ? -1.2 : 0.9));
      ctx.strokeStyle = withAlpha(c.glow, 0.7 - k * 0.15);
      ctx.lineWidth = 4 - k;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1 - k * 0.25), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r * (1 - k * 0.25), Math.sin(a) * r * (1 - k * 0.25));
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, c.glow, cx, -cy, r * 1.6, 0.55);
    return;
  }

  // Wide ground smashes
  if (hb && hb.w >= 240 && hb.y <= 0.1) {
    const k = (f.moveTime - m.startup) / Math.max(1, m.active);
    const r = hb.w * 0.6 * (0.4 + k);
    ctx.strokeStyle = withAlpha(c.glow, 1 - k);
    ctx.lineWidth = 10 * (1 - k) + 2;
    ctx.beginPath();
    ctx.ellipse(f.x + f.facing * hb.x * 0.5, 0, r, r * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    glow(ctx, c.glow, f.x, -10, r * 0.8, 0.5 * (1 - k));
    return;
  }

  // Slashes / strikes: an arc swoosh at the hitbox
  if (hb && (m.fx === "claw" || m.fx === "sword" || m.kind === "special" || m.kind === "ultimate" || m.kind === "heavy")) {
    const cx = f.x + f.facing * hb.x;
    const cy = f.y + (hb.y + hb.h / 2) * H;
    const r = Math.max(hb.w, hb.h) * 0.55;
    const a0 = f.facing === 1 ? -1.2 : Math.PI + 1.2;
    const sweep = f.facing === 1 ? 2.4 : -2.4;
    const phase = ((f.moveTime - m.startup) % 6) / 6;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < (m.fx === "claw" ? 3 : 1); i++) {
      ctx.strokeStyle = withAlpha(i === 0 ? c.core : c.glow, 0.75);
      ctx.lineWidth = 5 - i;
      ctx.beginPath();
      ctx.arc(cx, -cy + i * 9 - 9, r * (0.8 + phase * 0.3), a0, a0 + sweep, f.facing !== 1);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // Counter stance shimmer
  if (m.counter) glow(ctx, c.glow, f.x + f.facing * 40, -chestY, 90 + Math.sin(t * 20) * 10, 0.6);
}
