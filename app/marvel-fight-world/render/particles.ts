/* ------------------------------------------------------------------ */
/*  Pooled particle system (world-space, drawn by the renderer)         */
/* ------------------------------------------------------------------ */

import type { FxKind } from "../engine/types";

export type BloodLevel = "off" | "light" | "arcade";

type Shape = "spark" | "dot" | "ring" | "streak" | "smoke" | "shard" | "bolt" | "star" | "flash";

interface P {
  alive: boolean;
  shape: Shape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  rot: number;
  vr: number;
  /** glow (additive) */
  add: boolean;
}

const POOL = 900;

const FX_COLORS: Record<FxKind, string[]> = {
  punch: ["#fff7cc", "#ffd166", "#ff9f1c"],
  claw: ["#f1f5f9", "#cbd5e1", "#ffffff"],
  web: ["#ffffff", "#e2e8f0", "#cbd5e1"],
  energy: ["#a5f3fc", "#22d3ee", "#e0f2fe"],
  lightning: ["#e0f2fe", "#7dd3fc", "#ffffff"],
  fire: ["#fde047", "#fb923c", "#ef4444"],
  magic: ["#fcd34d", "#fb923c", "#fef3c7"],
  shield: ["#e2e8f0", "#93c5fd", "#ffffff"],
  hammer: ["#e0f2fe", "#93c5fd", "#ffffff"],
  repulsor: ["#cffafe", "#67e8f9", "#ffffff"],
  missile: ["#fde68a", "#fb923c", "#f87171"],
  kinetic: ["#ddd6fe", "#a78bfa", "#ffffff"],
  magnet: ["#f5d0fe", "#e879f9", "#ffffff"],
  cosmic: ["#fde68a", "#c084fc", "#ffffff"],
  symbiote: ["#f8fafc", "#334155", "#0f172a"],
  sword: ["#f8fafc", "#e2e8f0", "#fca5a5"],
  bullet: ["#fde68a", "#fbbf24", "#ffffff"],
  ground: ["#d6b98c", "#a8875a", "#f5e6c8"],
  beam: ["#e0f2fe", "#7dd3fc", "#ffffff"],
};

export class Particles {
  private pool: P[] = [];
  private cursor = 0;
  blood: BloodLevel = "light";

  constructor() {
    for (let i = 0; i < POOL; i++)
      this.pool.push({ alive: false, shape: "dot", x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 0, max: 1, size: 1, grow: 0, color: "#fff", rot: 0, vr: 0, add: false });
  }

  clear() {
    for (const p of this.pool) p.alive = false;
  }

  private spawn(o: Partial<P> & Pick<P, "shape" | "x" | "y" | "max" | "size" | "color">) {
    // Reuse the oldest slot when full: no allocation during a fight
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    p.alive = true;
    p.vx = 0;
    p.vy = 0;
    p.g = 0;
    p.drag = 0.96;
    p.grow = 0;
    p.rot = Math.random() * Math.PI * 2;
    p.vr = 0;
    p.add = false;
    p.life = 0;
    Object.assign(p, o);
  }

  hit(x: number, y: number, fx: FxKind, power: number, blocked: boolean, counter: boolean) {
    const cols = blocked ? FX_COLORS.shield : FX_COLORS[fx];
    const n = Math.round((blocked ? 6 : 10) + power * 14);
    this.spawn({ shape: "flash", x, y, max: 7, size: 40 + power * 50, grow: 6, color: counter ? "#fde047" : cols[2], add: true });
    this.spawn({ shape: "ring", x, y, max: 14, size: 10, grow: 5 + power * 4, color: cols[1], add: true });
    if (!blocked) this.spawn({ shape: "star", x, y, max: 9, size: 34 + power * 30, grow: 2, color: counter ? "#fde047" : "#ffffff", add: false });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * (6 + power * 8);
      this.spawn({
        shape: fx === "lightning" || fx === "beam" ? "bolt" : i % 3 ? "spark" : "streak",
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        drag: 0.88,
        max: 12 + Math.random() * 14,
        size: 2 + Math.random() * 3,
        color: cols[i % cols.length],
        add: true,
      });
    }
    if (fx === "ground" || fx === "hammer") this.dust(x, Math.max(0, y - 40), 6 + power * 6);
    if (!blocked && this.blood !== "off" && (fx === "punch" || fx === "claw" || fx === "sword" || fx === "kinetic" || fx === "symbiote")) {
      const drops = Math.round((this.blood === "arcade" ? 9 : 3) + power * (this.blood === "arcade" ? 10 : 3));
      for (let i = 0; i < drops; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const s = 2 + Math.random() * 6;
        this.spawn({
          shape: "dot",
          x,
          y,
          vx: Math.cos(a) * s * (Math.random() < 0.5 ? -1 : 1),
          vy: -Math.sin(a) * s,
          g: 0.45,
          drag: 0.99,
          max: 26 + Math.random() * 18,
          size: 2 + Math.random() * (this.blood === "arcade" ? 4 : 2.5),
          color: Math.random() < 0.5 ? "#c1121f" : "#e5383b",
        });
      }
    }
  }

  dust(x: number, y: number, n = 10) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        shape: "smoke",
        x: x + (Math.random() - 0.5) * 40,
        y: y + Math.random() * 10,
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 2.2,
        drag: 0.94,
        max: 30 + Math.random() * 25,
        size: 10 + Math.random() * 14,
        grow: 0.6,
        color: "rgba(214,196,170,0.5)",
      });
    }
  }

  debris(x: number, y: number, w: number, h: number) {
    for (let i = 0; i < 26; i++) {
      this.spawn({
        shape: "shard",
        x: x + (Math.random() - 0.5) * w,
        y: y + (Math.random() - 0.5) * h,
        vx: (Math.random() - 0.5) * 14,
        vy: 4 + Math.random() * 10,
        g: 0.55,
        drag: 0.99,
        max: 50 + Math.random() * 30,
        size: 4 + Math.random() * 9,
        vr: (Math.random() - 0.5) * 0.4,
        color: ["#64748b", "#94a3b8", "#475569", "#facc15"][i % 4],
      });
    }
    this.dust(x, 0, 14);
  }

  aura(x: number, y: number, color: string, n = 2) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        shape: "spark",
        x: x + (Math.random() - 0.5) * 60,
        y: y + Math.random() * 140,
        vy: 1.5 + Math.random() * 2,
        drag: 0.98,
        max: 24,
        size: 2 + Math.random() * 2,
        color,
        add: true,
      });
    }
  }

  heal(x: number, y: number) {
    for (let i = 0; i < 18; i++)
      this.spawn({ shape: "dot", x: x + (Math.random() - 0.5) * 60, y: y + Math.random() * 160, vy: 1 + Math.random() * 2, max: 40, size: 3, color: "#86efac", add: true });
  }

  /** Projectile trails */
  trail(x: number, y: number, fx: FxKind) {
    const cols = FX_COLORS[fx];
    this.spawn({ shape: "dot", x, y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, max: 14, size: 3 + Math.random() * 4, grow: -0.15, color: cols[Math.floor(Math.random() * cols.length)], add: true });
  }

  update() {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life++;
      if (p.life >= p.max) {
        p.alive = false;
        continue;
      }
      p.vx *= p.drag;
      p.vy = p.vy * p.drag - p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.size = Math.max(0.1, p.size + p.grow);
      p.rot += p.vr;
      if (p.y < 0 && p.g > 0) {
        p.y = 0;
        p.vy *= -0.25;
        p.vx *= 0.6;
      }
    }
  }

  /** Draw with a world→screen transform already applied (y up = negative canvas y). */
  draw(g: CanvasRenderingContext2D) {
    for (let pass = 0; pass < 2; pass++) {
      g.globalCompositeOperation = pass ? "lighter" : "source-over";
      for (const p of this.pool) {
        if (!p.alive || p.add !== !!pass) continue;
        const t = p.life / p.max;
        g.globalAlpha = Math.max(0, 1 - t);
        g.fillStyle = p.color;
        g.strokeStyle = p.color;
        const x = p.x;
        const y = -p.y;
        switch (p.shape) {
          case "dot":
          case "spark":
            g.beginPath();
            g.arc(x, y, p.size, 0, Math.PI * 2);
            g.fill();
            break;
          case "streak":
            g.lineWidth = p.size;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x - p.vx * 3, y + p.vy * 3);
            g.stroke();
            break;
          case "bolt": {
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x - p.vx * 1.5 + (Math.random() - 0.5) * 10, y + p.vy * 1.5);
            g.lineTo(x - p.vx * 3, y + p.vy * 3);
            g.stroke();
            break;
          }
          case "ring":
            g.lineWidth = 4 * (1 - t) + 1;
            g.beginPath();
            g.arc(x, y, p.size, 0, Math.PI * 2);
            g.stroke();
            break;
          case "flash": {
            const grd = g.createRadialGradient(x, y, 0, x, y, p.size);
            grd.addColorStop(0, p.color);
            grd.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = grd;
            g.beginPath();
            g.arc(x, y, p.size, 0, Math.PI * 2);
            g.fill();
            break;
          }
          case "smoke":
            g.globalAlpha = Math.max(0, 0.6 * (1 - t));
            g.beginPath();
            g.arc(x, y, p.size, 0, Math.PI * 2);
            g.fill();
            break;
          case "shard":
            g.save();
            g.translate(x, y);
            g.rotate(p.rot);
            g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
            g.restore();
            break;
          case "star": {
            // Comic impact burst
            g.save();
            g.translate(x, y);
            g.rotate(p.rot);
            g.beginPath();
            const spikes = 9;
            for (let i = 0; i < spikes * 2; i++) {
              const r = i % 2 ? p.size * 0.42 : p.size;
              const a = (i / (spikes * 2)) * Math.PI * 2;
              g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            g.closePath();
            g.globalAlpha = Math.max(0, 0.9 * (1 - t));
            g.fill();
            g.lineWidth = 3;
            g.strokeStyle = "#111";
            g.stroke();
            g.restore();
            break;
          }
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
}
