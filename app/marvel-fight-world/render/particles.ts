/* ------------------------------------------------------------------ */
/*  Pooled particles (world space: y up, drawn with y negated)          */
/* ------------------------------------------------------------------ */

import type { FxKind } from "../engine/types";
import type { BloodLevel } from "../data/storage";
import { FX_COLORS, gameFonts, glow, glowSprite, withAlpha } from "./util";

type Kind = "spark" | "glow" | "smoke" | "dust" | "blood" | "splat" | "debris" | "ring" | "word" | "number" | "ember" | "star";

interface P {
  on: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  grav: number;
  drag: number;
  text: string;
}

const POOL = 1200;
const WORDS: Partial<Record<FxKind, string[]>> = {
  punch: ["POW!", "WHAM!", "BAM!", "SMASH!"],
  claw: ["SNIKT!", "SLASH!"],
  web: ["THWIP!"],
  lightning: ["KRAKOOM!", "ZZZAK!"],
  hammer: ["KRAK!", "DOOM!"],
  ground: ["BOOM!", "KRUNCH!"],
  repulsor: ["ZAP!", "FWOOSH!"],
  shield: ["KLANG!", "THUNK!"],
  sword: ["SHING!"],
  bullet: ["BLAM!"],
  magic: ["FZZT!", "SHAZ!"],
  symbiote: ["SPLURT!", "SKREE!"],
  cosmic: ["VWOOM!"],
  kinetic: ["THOOM!"],
  magnet: ["KLANK!"],
  missile: ["KA-BOOM!"],
  energy: ["ZAP!"],
  beam: ["VWOOOM!"],
};

export class Particles {
  private pool: P[] = Array.from({ length: POOL }, () => ({
    on: false, kind: "spark", x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: "#fff", rot: 0, vr: 0, grav: 0, drag: 1, text: "",
  }));
  private cursor = 0;
  blood: BloodLevel = "light";

  clear() {
    for (const p of this.pool) p.on = false;
  }

  private add(kind: Kind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, extra: Partial<P> = {}) {
    // Find a free slot (round-robin; overwrite oldest when full)
    let p = this.pool[this.cursor];
    for (let i = 0; i < 24 && p.on; i++) {
      this.cursor = (this.cursor + 1) % POOL;
      p = this.pool[this.cursor];
    }
    this.cursor = (this.cursor + 1) % POOL;
    p.on = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.rot = Math.random() * Math.PI * 2;
    p.vr = 0;
    p.grav = 0;
    p.drag = 0.96;
    p.text = "";
    Object.assign(p, extra);
  }

  /* ── Bursts ──────────────────────────────────────────────────────── */
  hit(x: number, y: number, fx: FxKind, power: number, dir: number, blocked: boolean, damage: number) {
    const c = FX_COLORS[fx];
    const n = blocked ? 8 : Math.round(10 + power * 16);
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * Math.PI * (blocked ? 0.9 : 1.5);
      const sp = (blocked ? 6 : 8) + Math.random() * (10 + power * 10);
      this.add("spark", x, y, Math.cos(a) * sp * dir, Math.sin(a) * sp + 2, 12 + Math.random() * 12, 2 + Math.random() * 2.5, i % 3 === 0 ? c.core : c.glow, { drag: 0.88, grav: 0.4 });
    }
    this.add("glow", x, y, 0, 0, 10, 60 + power * 70, c.glow);
    this.add("glow", x, y, 0, 0, 6, 30 + power * 30, c.core);
    this.add("ring", x, y, 0, 0, blocked ? 10 : 14, 10, blocked ? "#93c5fd" : c.glow, { vx: 4 + power * 7 });
    if (!blocked && power > 0.75) {
      const words = WORDS[fx] ?? WORDS.punch!;
      this.add("word", x + dir * 30, y + 40, dir * 1.5, 2.2, 42, 46 + power * 22, c.glow, { text: words[Math.floor(Math.random() * words.length)], rot: (Math.random() - 0.5) * 0.4 });
    }
    if (!blocked && damage > 0) this.add("number", x, y + 30, (Math.random() - 0.5) * 2, 3.2, 40, 26 + Math.min(20, damage / 6), "#ffffff", { text: String(damage), drag: 0.9 });
    if (!blocked && this.blood !== "off" && ["punch", "claw", "sword", "bullet", "symbiote", "hammer"].includes(fx)) {
      const drops = this.blood === "arcade" ? Math.round(8 + power * 10) : Math.round(2 + power * 3);
      for (let i = 0; i < drops; i++) {
        const a = (Math.random() - 0.3) * Math.PI * 0.8;
        const sp = 4 + Math.random() * 8;
        this.add("blood", x, y, Math.cos(a) * sp * dir, Math.sin(a) * sp + 3, 30 + Math.random() * 20, 2.5 + Math.random() * 3, Math.random() > 0.5 ? "#b91c1c" : "#7f1d1d", { grav: 0.55, drag: 0.98 });
      }
    }
  }

  dust(x: number, y: number, amount = 1) {
    for (let i = 0; i < 8 * amount; i++) {
      this.add("dust", x + (Math.random() - 0.5) * 50, y + 4, (Math.random() - 0.5) * 6, Math.random() * 2.5, 30 + Math.random() * 20, 16 + Math.random() * 18, "#cbd5e1", { drag: 0.94 });
    }
  }

  smoke(x: number, y: number, n = 6, color = "#475569") {
    for (let i = 0; i < n; i++) this.add("smoke", x + (Math.random() - 0.5) * 60, y + Math.random() * 40, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, 60 + Math.random() * 40, 30 + Math.random() * 30, color, { drag: 0.97 });
  }

  debris(x: number, y: number, w: number, h: number, color = "#64748b") {
    for (let i = 0; i < 26; i++) {
      this.add("debris", x + (Math.random() - 0.5) * w, y + (Math.random() - 0.5) * h, (Math.random() - 0.5) * 16, 6 + Math.random() * 12, 60 + Math.random() * 40, 6 + Math.random() * 12, i % 3 ? color : "#94a3b8", { grav: 0.6, vr: (Math.random() - 0.5) * 0.4, drag: 0.99 });
    }
    this.smoke(x, y, 10);
  }

  heal(x: number, y: number) {
    for (let i = 0; i < 18; i++) this.add("star", x + (Math.random() - 0.5) * 70, y + Math.random() * 160, 0, 1.5 + Math.random() * 2, 40 + Math.random() * 20, 4 + Math.random() * 4, "#4ade80", { drag: 0.98 });
  }

  burst(x: number, y: number, color: string, n = 40, speed = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.add("spark", x, y, Math.cos(a) * sp, Math.sin(a) * sp, 20 + Math.random() * 20, 2 + Math.random() * 3, color, { drag: 0.9 });
    }
    this.add("ring", x, y, 0, 0, 24, 10, color, { vx: 16 });
    this.add("glow", x, y, 0, 0, 18, 220, color);
  }

  ember(x: number, y: number, color = "#fb923c") {
    this.add("ember", x, y, (Math.random() - 0.5) * 1.2, 1 + Math.random() * 2, 80 + Math.random() * 60, 2 + Math.random() * 2.5, color, { drag: 0.995 });
  }

  /** Thin trail particle (missiles, dashes) */
  trail(x: number, y: number, color: string, size = 14) {
    this.add("smoke", x, y, (Math.random() - 0.5) * 0.6, 0.6, 24, size, color, { drag: 0.95 });
  }

  /* ── Update / draw ───────────────────────────────────────────────── */
  update(dt: number) {
    for (const p of this.pool) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) {
        // Blood leaves a short-lived floor splat in arcade mode
        if (p.kind === "blood" && this.blood === "arcade" && p.y <= 2) this.add("splat", p.x, 0, 0, 0, 120, p.size * 3, p.color);
        p.on = false;
        continue;
      }
      const d = Math.pow(p.drag, dt);
      p.vx *= d;
      p.vy = p.vy * d - p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if ((p.kind === "blood" || p.kind === "debris") && p.y < 0) {
        p.y = 0;
        p.vy *= -0.25;
        p.vx *= 0.6;
        if (p.kind === "blood") p.life = Math.min(p.life, 2);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const fonts = gameFonts();
    for (const p of this.pool) {
      if (!p.on) continue;
      const t = p.life / p.max; // 1 → 0
      const sx = p.x;
      const sy = -p.y;
      switch (p.kind) {
        case "spark": {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = withAlpha(p.color, Math.min(1, t * 1.5));
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - p.vx * 1.6, sy + p.vy * 1.6);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
          break;
        }
        case "glow":
          glow(ctx, p.color, sx, sy, p.size * (0.6 + (1 - t) * 0.6), t);
          break;
        case "star":
        case "ember":
          glow(ctx, p.color, sx, sy, p.size * 3, t);
          break;
        case "ring": {
          const r = p.size + (1 - t) * p.vx * 10;
          ctx.strokeStyle = withAlpha(p.color, t * 0.9);
          ctx.lineWidth = 6 * t + 1;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "smoke":
        case "dust": {
          ctx.fillStyle = withAlpha(p.color, (p.kind === "dust" ? 0.35 : 0.45) * t);
          ctx.beginPath();
          ctx.arc(sx, sy, p.size * (1.4 - t * 0.6), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "blood": {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(sx, sy, p.size * 1.4, p.size, Math.atan2(-p.vy, p.vx), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "splat": {
          ctx.fillStyle = withAlpha(p.color, 0.55 * Math.min(1, t * 3));
          ctx.beginPath();
          ctx.ellipse(sx, 0, p.size, p.size * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "debris": {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, t * 3);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
          break;
        }
        case "word": {
          const pop = t > 0.85 ? 1 + (t - 0.85) * 4 : 1;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.scale(pop, pop);
          ctx.globalAlpha = Math.min(1, t * 2.5);
          ctx.font = `italic 900 ${p.size}px ${fonts.display}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.lineWidth = p.size * 0.22;
          ctx.strokeStyle = "#0b0d14";
          ctx.strokeText(p.text, 0, 0);
          const g = ctx.createLinearGradient(0, -p.size / 2, 0, p.size / 2);
          g.addColorStop(0, "#fff7ae");
          g.addColorStop(1, p.color);
          ctx.fillStyle = g;
          ctx.fillText(p.text, 0, 0);
          ctx.restore();
          break;
        }
        case "number": {
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.font = `900 ${p.size}px ${fonts.display}`;
          ctx.textAlign = "center";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#0b0d14";
          ctx.strokeText(p.text, sx, sy);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, sx, sy);
          ctx.globalAlpha = 1;
          break;
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  /** Expose the glow sprite cache warm-up */
  warm(colors: string[]) {
    for (const c of colors) glowSprite(c);
  }
}
