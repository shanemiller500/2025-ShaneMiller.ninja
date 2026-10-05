/* ------------------------------------------------------------------ */
/*  Fight renderer: camera, stage, fighters, projectiles, particles     */
/*                                                                      */
/*  Reads Match state each animation frame (never the other way round). */
/*  Visual-only state (camera, shake, flashes, floating text) lives      */
/*  here so the simulation stays deterministic.                          */
/* ------------------------------------------------------------------ */

import { STAGE_HALF } from "../engine/fighter";
import type { Match, Projectile } from "../engine/match";
import type { FxKind, MatchEvent } from "../engine/types";
import { drawArenaBack, drawProp, type ArenaDef, type Cam } from "./arenas";
import { drawFighter, type FighterView } from "./drawFighter";
import { Particles, type BloodLevel } from "./particles";

interface FloatText {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  size: number;
  big: boolean;
  side: number;
}

const WORLD_H = 520;

export class FightRenderer {
  readonly particles = new Particles();
  private cam = { x: 0, zoom: 1 };
  private shake = 0;
  private texts: FloatText[] = [];
  private flash: [number, number] = [0, 0];
  private superT = 0;
  private superOwner = 0;
  private superName = "";
  private koT = 0;
  private time = 0;
  showBoxes = false;

  constructor(public arena: ArenaDef) {}

  set blood(b: BloodLevel) {
    this.particles.blood = b;
  }

  reset() {
    this.particles.clear();
    this.texts = [];
    this.shake = 0;
    this.koT = 0;
    this.superT = 0;
    this.cam = { x: 0, zoom: 1 };
  }

  /** Feed simulation events (visual reactions only). */
  consume(events: MatchEvent[], m: Match) {
    for (const e of events) {
      switch (e.type) {
        case "hit":
          this.particles.hit(e.x, e.y, e.fx, e.power, e.blocked, e.counter);
          if (!e.blocked && e.damage > 0) {
            this.flash[e.attacker === 0 ? 1 : 0] = 8;
            this.addText(String(e.damage), e.x, e.y + 40, "#ffffff", 22, false, e.attacker);
          }
          break;
        case "shake":
          this.shake = Math.min(26, Math.max(this.shake, e.amount));
          break;
        case "dust":
          this.particles.dust(e.x, e.y, 8);
          break;
        case "propBreak":
          this.particles.debris(e.x, e.y, e.w, e.h);
          break;
        case "heal": {
          const f = m.fighters[e.player];
          this.particles.heal(f.x, f.y);
          break;
        }
        case "combo":
          if (e.hits >= 2) {
            const f = m.fighters[e.player];
            const label = e.hits >= 8 ? "SUPER COMBO!" : e.hits >= 4 ? `${e.hits} HIT COMBO!` : `${e.hits} HIT`;
            this.addComboText(label, e.player, f.x);
          }
          break;
        case "text": {
          if (e.big) {
            this.texts = this.texts.filter((t) => !t.big);
            this.texts.push({ text: e.text, x: 0, y: 0, life: 0, max: e.text === "K.O." ? 150 : 80, color: e.text === "K.O." ? "#ef4444" : "#facc15", size: e.text === "K.O." ? 150 : 90, big: true, side: e.player ?? -1 });
          } else {
            const f = e.player !== undefined ? m.fighters[e.player] : null;
            const color = e.text === "BLOCKED" ? "#93c5fd" : e.text.includes("COUNTER") || e.text === "PARRY!" ? "#fde047" : "#f472b6";
            this.addText(e.text, f ? f.x : 0, f ? f.y + f.def.height + 40 : 300, color, 26, false, e.player ?? 0);
          }
          break;
        }
        case "super":
          this.superT = 40;
          this.superOwner = e.player;
          this.superName = e.move;
          break;
        case "ko":
          this.koT = 1;
          break;
        case "round":
          this.texts = this.texts.filter((t) => !t.big);
          this.texts.push({ text: `ROUND ${e.round}`, x: 0, y: 0, life: 0, max: 70, color: "#f8fafc", size: 80, big: true, side: -1 });
          break;
      }
    }
  }

  private addText(text: string, x: number, y: number, color: string, size: number, big: boolean, side: number) {
    this.texts.push({ text, x, y, life: 0, max: 50, color, size, big, side });
    if (this.texts.length > 24) this.texts.shift();
  }

  private addComboText(text: string, side: number, x: number) {
    // One combo counter per side, replaced as it grows
    this.texts = this.texts.filter((t) => !(t.side === side && t.text.includes("HIT")) && !(t.side === side && t.text.includes("COMBO")));
    this.texts.push({ text, x, y: 0, life: 0, max: 70, color: text.startsWith("SUPER") ? "#f472b6" : "#facc15", size: text.startsWith("SUPER") ? 54 : 44, big: false, side: side + 10 });
  }

  /** Advance visual timers by one simulation frame. */
  tick() {
    this.time += 1 / 60;
    this.particles.update();
    for (const t of this.texts) t.life++;
    this.texts = this.texts.filter((t) => t.life < t.max);
    this.shake *= 0.86;
    if (this.shake < 0.3) this.shake = 0;
    this.flash = [Math.max(0, this.flash[0] - 1), Math.max(0, this.flash[1] - 1)];
    if (this.superT > 0) this.superT--;
    if (this.koT > 0) this.koT++;
  }

  draw(g: CanvasRenderingContext2D, m: Match, W: number, H: number) {
    const [a, b] = m.fighters;
    const t = this.time;

    // Camera: frame both fighters; zoom in when close, a touch more for supers
    const mid = (a.x + b.x) / 2;
    const span = Math.abs(a.x - b.x) + 380;
    const baseS = H / WORLD_H;
    let zoom = Math.max(0.78, Math.min(1.22, (W / baseS) / span));
    if (this.superT > 0 || m.superFreeze > 0) zoom *= 1.12;
    if (m.phase === "ko" && this.koT < 80) zoom *= 1.08;
    this.cam.zoom += (zoom - this.cam.zoom) * 0.08;
    const s = baseS * this.cam.zoom;
    const halfView = W / s / 2;
    const targetX = Math.max(-STAGE_HALF + halfView - 140, Math.min(STAGE_HALF - halfView + 140, m.superFreeze > 0 ? m.fighters[m.superOwner ?? 0].x : mid));
    this.cam.x += (targetX - this.cam.x) * 0.12;
    const groundY = H * 0.86;
    const cam: Cam = { x: this.cam.x, s };

    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;

    g.save();
    g.translate(sx, sy);
    drawArenaBack(g, this.arena, cam, t, W, H, groundY);

    // World transform: origin at stage centre on the floor, y up negative
    g.save();
    g.translate(W / 2 - this.cam.x * s, groundY);
    g.scale(s, s);

    // stage walls hint
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(-STAGE_HALF - 400, -WORLD_H * 2, 400, WORLD_H * 3);
    g.fillRect(STAGE_HALF, -WORLD_H * 2, 400, WORLD_H * 3);

    for (const p of m.props) drawProp(g, p.kind, p.x, p.w, p.h, p.broken, t);

    // Super: darken the stage behind the fighters
    if (m.superFreeze > 0 || this.superT > 0) {
      g.fillStyle = `rgba(5,5,20,${Math.min(0.6, (this.superT || 20) / 40)})`;
      g.fillRect(-STAGE_HALF - 600, -WORLD_H * 2, (STAGE_HALF + 600) * 2, WORLD_H * 3);
    }

    // Beam / large ultimate hitboxes are drawn as effects
    for (const f of m.fighters) this.drawMoveFx(g, f, t);

    // Draw the defender first so the attacker overlaps
    const order = a.state === "attack" && b.state !== "attack" ? [b, a] : [a, b];
    for (const f of order) {
      const view: FighterView = {
        def: f.def,
        x: f.x,
        y: f.y,
        facing: f.facing,
        state: f.state,
        stateTime: f.stateTime,
        move: f.move,
        moveTime: f.moveTime,
        vy: f.vy,
        invuln: f.invuln,
        rage: f.rage,
        shield: f.shield,
        flash: this.flash[f.index],
        meter: f.meter,
      };
      drawFighter(g, view, t, this.arena.rim);
      if (f.rage > 0 && Math.random() < 0.5) this.particles.aura(f.x, f.y, "#ef4444", 1);
      else if (f.meter >= 100 && Math.random() < 0.25) this.particles.aura(f.x, f.y, "#facc15", 1);
    }

    for (const p of m.projectiles) if (!p.dead) this.drawProjectile(g, p, t);

    this.particles.draw(g);

    if (this.showBoxes) this.drawBoxes(g, m);

    // Floating world texts
    for (const tx of this.texts) {
      if (tx.big || tx.side >= 10) continue;
      const k = tx.life / tx.max;
      g.globalAlpha = 1 - k;
      comicText(g, tx.text, tx.x, -tx.y - k * 40, tx.size, tx.color);
    }
    g.globalAlpha = 1;
    g.restore();

    // Screen-space overlays
    this.drawOverlays(g, m, W, H);
    g.restore();
  }

  private drawMoveFx(g: CanvasRenderingContext2D, f: Match["fighters"][number], t: number) {
    const m = f.move;
    if (!m || f.movePhase !== "active" || !m.hitbox) return;
    const hb = f.hitbox();
    if (!hb) return;
    if (m.pose === "beam") {
      g.save();
      g.globalCompositeOperation = "lighter";
      const y = -(hb.y + hb.h / 2);
      const grd = g.createLinearGradient(0, y - hb.h, 0, y + hb.h);
      grd.addColorStop(0, "rgba(125,211,252,0)");
      grd.addColorStop(0.5, `rgba(224,242,254,${0.8 + 0.2 * Math.sin(t * 40)})`);
      grd.addColorStop(1, "rgba(125,211,252,0)");
      g.fillStyle = grd;
      g.fillRect(hb.x, y - hb.h, hb.w, hb.h * 2);
      g.restore();
    } else if (m.kind === "ultimate" || (m.kind === "special" && hb.w > 200)) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const cx = hb.x + hb.w / 2;
      const cy = -(hb.y + hb.h / 2);
      const col = fxColor(m.fx);
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(hb.w, hb.h) / 1.6);
      grd.addColorStop(0, col + "aa");
      grd.addColorStop(1, col + "00");
      g.fillStyle = grd;
      g.fillRect(hb.x - 40, -(hb.y + hb.h) - 40, hb.w + 80, hb.h + 80);
      g.restore();
      if (Math.random() < 0.6) this.particles.hit(hb.x + Math.random() * hb.w, hb.y + Math.random() * hb.h, m.fx, 0.3, true, false);
    } else if (m.pose === "claw" || m.fx === "sword" || m.fx === "claw") {
      // slash arc
      g.save();
      g.globalAlpha = 0.7;
      g.strokeStyle = "#f8fafc";
      g.lineWidth = 4;
      g.beginPath();
      const cx = f.x;
      const cy = -(f.y + f.def.height * 0.55);
      const r = Math.abs(hb.x + hb.w / 2 - f.x) + 10;
      const a0 = f.facing === 1 ? -1.1 : Math.PI - 1.1;
      g.arc(cx, cy, r, a0 + (f.moveTime % 6) * 0.1, a0 + 2.2);
      g.stroke();
      g.restore();
    }
  }

  private drawProjectile(g: CanvasRenderingContext2D, p: Projectile, t: number) {
    const fx = p.spec.fx;
    const x = p.x;
    const y = -p.y;
    if (Math.random() < 0.8) this.particles.trail(p.x - p.vx, p.y - p.vy, fx);
    g.save();
    g.translate(x, y);
    switch (fx) {
      case "web":
        g.strokeStyle = "#f8fafc";
        g.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.cos((i / 6) * Math.PI * 2) * p.w * 0.5, Math.sin((i / 6) * Math.PI * 2) * p.h * 0.5);
          g.stroke();
        }
        g.beginPath();
        g.ellipse(0, 0, p.w * 0.3, p.h * 0.3, 0, 0, Math.PI * 2);
        g.stroke();
        break;
      case "shield": {
        g.rotate(t * 20);
        const cols = ["#c8102e", "#f8fafc", "#c8102e", "#1f3f8f"];
        cols.forEach((c, i) => {
          g.fillStyle = c;
          g.beginPath();
          g.arc(0, 0, 22 * (1 - i * 0.24), 0, Math.PI * 2);
          g.fill();
        });
        break;
      }
      case "hammer":
        g.rotate(t * 18 * p.dir);
        g.fillStyle = "#6b4f2a";
        g.fillRect(-3, -2, 6, 28);
        g.fillStyle = "#9ca3af";
        g.fillRect(-16, -22, 32, 20);
        g.strokeStyle = "#7dd3fc";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, 30, 0, Math.PI * 2);
        g.stroke();
        break;
      case "missile":
        g.rotate(Math.atan2(-p.vy, p.vx));
        g.fillStyle = "#e5e7eb";
        g.fillRect(-14, -4, 26, 8);
        g.fillStyle = "#ef4444";
        g.beginPath();
        g.moveTo(12, -4);
        g.lineTo(20, 0);
        g.lineTo(12, 4);
        g.fill();
        g.fillStyle = "#fb923c";
        g.fillRect(-22, -3, 8, 6);
        break;
      case "bullet":
        g.fillStyle = "#fde68a";
        g.fillRect(-10, -2, 20, 4);
        break;
      case "lightning":
        g.restore();
        g.save();
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = "#e0f2fe";
        g.lineWidth = 5;
        g.shadowColor = "#7dd3fc";
        g.shadowBlur = 20;
        g.beginPath();
        g.moveTo(x + (Math.random() - 0.5) * 30, -900);
        for (let k = 1; k <= 10; k++) g.lineTo(x + (Math.random() - 0.5) * 40, y - p.h / 2 + ((-900 - (y - p.h / 2)) * (10 - k)) / 10);
        g.stroke();
        break;
      case "ground":
        g.fillStyle = "rgba(214,196,170,0.7)";
        g.beginPath();
        g.ellipse(0, 0, p.w * 0.5, p.h * 0.5, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#fff";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(-p.dir * p.w * 0.2, 0, p.h * 0.45, -1.2, 1.2);
        g.stroke();
        break;
      case "magnet": {
        g.rotate(t * 6);
        g.fillStyle = "#64748b";
        g.fillRect(-p.w * 0.35, -p.h * 0.25, p.w * 0.7, p.h * 0.5);
        g.strokeStyle = "#f0abfc";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, 0, p.w * 0.55, 0, Math.PI * 2);
        g.stroke();
        break;
      }
      default: {
        g.globalCompositeOperation = "lighter";
        const col = fxColor(fx);
        const r = Math.max(p.w, p.h) * 0.6;
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
        grd.addColorStop(0, "#ffffff");
        grd.addColorStop(0.35, col);
        grd.addColorStop(1, col + "00");
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(0, 0, p.w * 0.75, p.h * 0.75, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  private drawBoxes(g: CanvasRenderingContext2D, m: Match) {
    g.lineWidth = 2;
    for (const f of m.fighters) {
      const hb = f.hurtbox();
      g.strokeStyle = "rgba(34,197,94,0.9)";
      g.strokeRect(hb.x, -(hb.y + hb.h), hb.w, hb.h);
      const at = f.hitbox();
      if (at) {
        g.strokeStyle = "rgba(239,68,68,0.95)";
        g.strokeRect(at.x, -(at.y + at.h), at.w, at.h);
      }
    }
    for (const p of m.projectiles) {
      if (p.dead) continue;
      g.strokeStyle = "rgba(250,204,21,0.9)";
      g.strokeRect(p.x - p.w / 2, -(p.y + p.h / 2), p.w, p.h);
    }
  }

  private drawOverlays(g: CanvasRenderingContext2D, m: Match, W: number, H: number) {
    // Super flash banner
    if (this.superT > 0) {
      const k = this.superT / 40;
      const f = m.fighters[this.superOwner];
      g.save();
      g.globalAlpha = Math.min(1, k * 2);
      const y = H * 0.42;
      const bandH = H * 0.16;
      g.fillStyle = "rgba(0,0,0,0.75)";
      g.beginPath();
      g.moveTo(0, y - bandH * 0.4);
      g.lineTo(W, y - bandH * 0.6);
      g.lineTo(W, y + bandH * 0.4);
      g.lineTo(0, y + bandH * 0.6);
      g.fill();
      g.fillStyle = f.def.look.primary;
      g.fillRect(0, y - bandH * 0.45, W, 4);
      // speed lines
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const ly = y + (Math.random() - 0.5) * bandH;
        const lx = ((this.superOwner === 0 ? 1 : -1) * (1 - k) * W * 2 + Math.random() * W) % W;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx + 120, ly);
        g.stroke();
      }
      const fs = Math.min(W * 0.07, 64);
      comicText(g, this.superName.toUpperCase(), this.superOwner === 0 ? W * 0.3 + (1 - k) * 60 : W * 0.7 - (1 - k) * 60, y + fs * 0.35, fs, "#fde047");
      comicText(g, f.def.name.toUpperCase(), this.superOwner === 0 ? W * 0.3 : W * 0.7, y - fs * 0.6, fs * 0.45, "#f8fafc");
      g.restore();
    }

    // K.O. white flash
    if (this.koT > 0 && this.koT < 12) {
      g.fillStyle = `rgba(255,255,255,${0.7 * (1 - this.koT / 12)})`;
      g.fillRect(0, 0, W, H);
    }

    // Big announcements + combo counters
    const scale = Math.min(1.2, W / 1100);
    for (const tx of this.texts) {
      const k = tx.life / tx.max;
      if (tx.big) {
        const pop = tx.life < 8 ? 1.6 - (tx.life / 8) * 0.6 : 1;
        g.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
        comicText(g, tx.text, W / 2, H * 0.4, tx.size * scale * pop, tx.color, true);
      } else if (tx.side >= 10) {
        const left = tx.side === 10;
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        const pop = tx.life < 6 ? 1.3 - tx.life * 0.05 : 1;
        g.save();
        g.textAlign = left ? "left" : "right";
        comicText(g, tx.text, left ? W * 0.04 : W * 0.96, H * 0.3, tx.size * scale * pop, tx.color, false, left ? "left" : "right");
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }
}

function fxColor(fx: FxKind) {
  const c: Partial<Record<FxKind, string>> = {
    energy: "#22d3ee",
    repulsor: "#67e8f9",
    beam: "#7dd3fc",
    magic: "#fb923c",
    kinetic: "#a78bfa",
    cosmic: "#c084fc",
    fire: "#f97316",
    symbiote: "#94a3b8",
    magnet: "#e879f9",
    lightning: "#7dd3fc",
    ground: "#d6b98c",
    claw: "#e2e8f0",
    sword: "#e2e8f0",
    punch: "#fbbf24",
    shield: "#93c5fd",
  };
  return c[fx] ?? "#facc15";
}

/** Chunky outlined comic lettering. */
export function comicText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, tilt = false, align: CanvasTextAlign = "center") {
  g.save();
  g.translate(x, y);
  if (tilt) g.rotate(-0.06);
  g.font = `900 italic ${Math.round(size)}px "Impact", "Arial Black", system-ui, sans-serif`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = Math.max(4, size * 0.14);
  g.strokeStyle = "#0b0b12";
  g.strokeText(text, size * 0.05, size * 0.06);
  g.strokeText(text, 0, 0);
  g.fillStyle = color;
  g.fillText(text, 0, 0);
  g.lineWidth = Math.max(1, size * 0.02);
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.strokeText(text, 0, -size * 0.03);
  g.restore();
}
