/* ------------------------------------------------------------------ */
/*  Renderer: camera + scene + HUD on one HiDPI canvas.                 */
/*                                                                      */
/*  Draws at the device pixel ratio (up to 3×) so it's crisp on 4K and  */
/*  Retina screens. Layout is a 1920×1080 virtual canvas whose width    */
/*  stretches to the real aspect ratio.                                 */
/* ------------------------------------------------------------------ */

import type { Fighter } from "../engine/fighter";
import { STAGE_HALF } from "../engine/fighter";
import type { Match } from "../engine/match";
import type { MatchEvent } from "../engine/types";
import type { BloodLevel } from "../data/storage";
import { drawBack, drawFloor, drawFront, drawProp, type ArenaDef, type View } from "./arenas";
import { drawMoveFx, drawProjectile } from "./effects";
import { buildRig, drawFighter, drawShadow, poseFor, type Joints, type Rig } from "./fighterDraw";
import { drawHud, newHudState, noteDamage, updateHud, PLAYER_COLORS, type HudState } from "./hud";
import { Particles } from "./particles";
import { FLOOR_Y, VH, clamp, glow } from "./util";

export interface RenderSettings {
  screenShake: boolean;
  blood: BloodLevel;
  showHitboxes: boolean;
  hideHud?: boolean;
}

interface Ghost {
  x: number;
  y: number;
  facing: 1 | -1;
  j: Joints;
  rig: Rig;
  life: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s = 1;
  VW = 1920;
  private dpr = 1;
  particles = new Particles();
  hud: HudState;
  private cam = { x: 0, zoom: 1.7, shake: 0, sx: 0, sy: 0 };
  private flash: [number, number] = [0, 0];
  private ghosts: [Ghost[], Ghost[]] = [[], []];
  private time = 0;
  private frameNo = 0;

  constructor(
    canvas: HTMLCanvasElement,
    public arena: ArenaDef,
    private portraits: [HTMLImageElement | null, HTMLImageElement | null],
    labels: [string, string],
    hints: [string[], string[]],
    public settings: RenderSettings
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.hud = newHudState(labels, hints);
    this.particles.blood = settings.blood;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
    const w = Math.max(320, Math.round(rect.width * this.dpr));
    const h = Math.max(180, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.s = h / VH;
    this.VW = w / this.s;
    this.ctx.imageSmoothingQuality = "high";
  }

  reset() {
    this.particles.clear();
    this.hud.announcements = [];
    this.hud.superBanner = null;
    this.hud.combo = [{ hits: 0, at: -99 }, { hits: 0, at: -99 }];
    this.ghosts = [[], []];
    this.cam.x = 0;
  }

  /* ── Events → visuals ────────────────────────────────────────────── */
  consume(events: MatchEvent[], m: Match) {
    for (const e of events) {
      switch (e.type) {
        case "hit": {
          const def = m.fighters[e.attacker === 0 ? 1 : 0];
          const dir = def.x > m.fighters[e.attacker].x ? 1 : -1;
          this.particles.hit(e.x, e.y, e.fx, e.power, dir, e.blocked, e.damage);
          if (!e.blocked && e.damage > 0) {
            this.flash[def.index] = 1;
            noteDamage(this.hud, def.index);
          }
          break;
        }
        case "combo":
          this.hud.combo[e.player] = { hits: e.hits, label: e.label, at: this.time };
          break;
        case "text":
          this.hud.announcements.push({ text: e.text, big: !!e.big, player: e.player, born: this.time });
          break;
        case "round":
          this.hud.announcements.push({ text: e.round === 1 ? "ROUND 1" : `ROUND ${e.round}`, big: true, born: this.time });
          break;
        case "shake":
          this.cam.shake = Math.min(30, this.cam.shake + e.amount * (this.settings.screenShake ? 1 : 0.2));
          break;
        case "super": {
          const f = m.fighters[e.player];
          this.hud.superBanner = { player: e.player, name: e.move, at: this.time };
          this.particles.burst(f.x, f.y + f.def.height * 0.6, f.def.look.glow ?? PLAYER_COLORS[e.player], 50, 22);
          break;
        }
        case "ko": {
          const f = m.fighters[e.loser];
          this.particles.burst(f.x, f.y + f.def.height * 0.6, "#fde047", 70, 26);
          this.particles.smoke(f.x, f.y + 40, 10);
          this.flash[e.loser] = 1;
          break;
        }
        case "dust":
          this.particles.dust(e.x, e.y);
          break;
        case "heal": {
          const f = m.fighters[e.player];
          this.particles.heal(f.x, f.y);
          break;
        }
        case "propBreak":
          this.particles.debris(e.x, e.y, e.w, e.h);
          break;
      }
    }
  }

  /* ── Frame ───────────────────────────────────────────────────────── */
  frame(m: Match, dt: number) {
    // dt in seconds (real time); simulation-paced effects use frames
    const df = dt * 60 * m.timeScale;
    this.time += dt;
    this.frameNo++;
    this.particles.blood = this.settings.blood;
    this.particles.update(m.superFreeze > 0 ? 0 : df);
    updateHud(this.hud, m, dt * 60);
    for (const i of [0, 1] as const) this.flash[i] = Math.max(0, this.flash[i] - dt * 7);
    this.updateCamera(m, dt);
    this.updateGhosts(m);

    const ctx = this.ctx;
    const VW = this.VW;
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const view: View = { VW, camX: this.cam.x, zoom: this.cam.zoom, t: this.time };
    drawBack(ctx, this.arena, view);

    // ── World ─────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(VW / 2 + this.cam.sx, FLOOR_Y + this.cam.sy);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, 0);

    drawFloor(ctx, this.arena, this.time);
    for (const p of m.props) drawProp(ctx, p, this.arena, this.time);
    for (const f of m.fighters) drawShadow(ctx, f);

    // Afterimages
    for (const i of [0, 1] as const) {
      const f = m.fighters[i];
      for (const g of this.ghosts[i]) {
        const proxy = this.proxy(f, g);
        ctx.globalAlpha = g.life;
        drawFighter(ctx, proxy, g.j, g.rig, { portrait: null, t: this.time, flash: 0, ghost: f.def.look.glow ?? PLAYER_COLORS[i], ring: PLAYER_COLORS[i], weaponOut: false });
        ctx.globalAlpha = 1;
      }
    }

    // Draw the attacker on top
    const order = [...m.fighters].sort((a, b) => (a.state === "attack" ? 1 : 0) - (b.state === "attack" ? 1 : 0));
    for (const f of order) {
      const j = poseFor(f, this.time);
      const rig = buildRig(f, j);
      const weaponOut = m.projectiles.some((p) => !p.dead && p.owner === f.index && (p.spec.fx === "shield" || p.spec.fx === "hammer"));
      drawFighter(ctx, f, j, rig, { portrait: this.portraits[f.index], t: this.time, flash: this.flash[f.index], ring: PLAYER_COLORS[f.index], weaponOut, rim: this.arena.colors[1] });
      drawMoveFx(ctx, f, this.time);
      this.drawMarker(ctx, f, rig);
    }

    for (const p of m.projectiles) {
      if (p.dead) continue;
      drawProjectile(ctx, p, m.fighters[p.owner], this.time);
      if (p.spec.fx === "missile" && this.frameNo % 2 === 0) this.particles.trail(p.x - p.vx * 2, p.y, "#94a3b8", 10);
    }
    this.particles.draw(ctx);
    if (this.settings.showHitboxes) this.drawBoxes(ctx, m);
    ctx.restore();

    // ── Screen space ──────────────────────────────────────────────
    drawFront(ctx, this.arena, view);
    this.vignette(ctx, m);
    if (!this.settings.hideHud) drawHud(ctx, VW, m, this.hud, this.portraits, this.time);
  }

  private proxy(f: Fighter, g: Ghost): Fighter {
    return {
      def: f.def,
      index: f.index,
      x: g.x,
      y: g.y,
      facing: g.facing,
      vx: 0,
      rage: 0,
      health: f.def.maxHealth,
      alive: true,
      move: null,
      movePhase: null,
      state: "idle",
    } as unknown as Fighter;
  }

  private updateGhosts(m: Match) {
    for (const i of [0, 1] as const) {
      const list = this.ghosts[i];
      for (const g of list) g.life -= 0.06;
      while (list.length && list[0].life <= 0) list.shift();
      const f = m.fighters[i];
      const fast =
        f.state === "dodge" ||
        f.state === "run" ||
        (f.move && (f.move.lunge || f.move.kind === "ultimate") && f.movePhase !== "recovery") ||
        (f.state === "launched" && Math.abs(f.vx) > 8);
      if (fast && this.frameNo % 3 === 0 && m.superFreeze === 0) {
        const j = poseFor(f, this.time);
        list.push({ x: f.x, y: f.y, facing: f.facing, j, rig: buildRig(f, j), life: 0.6 });
        if (list.length > 6) list.shift();
      }
    }
  }

  private updateCamera(m: Match, dt: number) {
    const [a, b] = m.fighters;
    const VW = this.VW;
    let cx = (a.x + b.x) / 2;
    const dist = Math.abs(a.x - b.x);
    let zoom = clamp(VW / (dist + 760), 1.18, 2.0);
    const maxY = Math.max(a.y + a.def.height, b.y + b.def.height);
    zoom = Math.min(zoom, (FLOOR_Y - 210) / (maxY + 60));
    if (m.superFreeze > 0 && m.superOwner !== null) {
      const f = m.fighters[m.superOwner];
      cx = f.x;
      zoom = Math.min(2.4, zoom * 1.3);
    } else if (m.phase === "ko" && m.phaseTime < 80) {
      const loser = a.alive ? b : a;
      cx = cx * 0.5 + loser.x * 0.5;
      zoom *= 1.12;
    }
    const k = Math.min(1, dt * 6);
    this.cam.x += (cx - this.cam.x) * k;
    this.cam.zoom += (zoom - this.cam.zoom) * Math.min(1, dt * 4);
    const half = VW / this.cam.zoom / 2;
    const lim = STAGE_HALF + 70 - half;
    this.cam.x = lim > 0 ? clamp(this.cam.x, -lim, lim) : 0;

    this.cam.shake *= Math.pow(0.86, dt * 60);
    const sh = this.cam.shake;
    this.cam.sx = (Math.random() - 0.5) * sh * 2;
    this.cam.sy = (Math.random() - 0.5) * sh * 1.4;
  }

  private drawMarker(ctx: CanvasRenderingContext2D, f: Fighter, rig: Rig) {
    if (f.state === "knockdown" || f.state === "defeated") return;
    const x = f.x + rig.head[0];
    const y = -(f.y + rig.head[1] + rig.headR + 26);
    const c = PLAYER_COLORS[f.index];
    ctx.fillStyle = c;
    ctx.strokeStyle = "#05060a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 10);
    ctx.lineTo(x + 9, y - 10);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  private drawBoxes(ctx: CanvasRenderingContext2D, m: Match) {
    ctx.lineWidth = 2;
    for (const f of m.fighters) {
      const h = f.hurtbox();
      ctx.strokeStyle = "rgba(74,222,128,0.9)";
      ctx.strokeRect(h.x, -(h.y + h.h), h.w, h.h);
      const hb = f.hitbox();
      if (hb) {
        ctx.fillStyle = "rgba(239,68,68,0.35)";
        ctx.fillRect(hb.x, -(hb.y + hb.h), hb.w, hb.h);
      }
    }
    for (const p of m.projectiles) {
      if (p.dead) continue;
      ctx.strokeStyle = "rgba(250,204,21,0.9)";
      ctx.strokeRect(p.x - p.w / 2, -(p.y + p.h / 2), p.w, p.h);
    }
  }

  private vignette(ctx: CanvasRenderingContext2D, m: Match) {
    const VW = this.VW;
    const g = ctx.createRadialGradient(VW / 2, VH * 0.55, VH * 0.35, VW / 2, VH * 0.55, VW * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    if (m.phase === "ko" && m.phaseTime < 70) {
      ctx.fillStyle = "rgba(127,29,29,0.12)";
      ctx.fillRect(0, 0, VW, VH);
    }
    // Low-health heartbeat for player 1 / 2
    for (const i of [0, 1] as const) {
      const f = m.fighters[i];
      if (f.alive && f.health < f.def.maxHealth * 0.2 && m.phase === "fight") {
        glow(ctx, "#dc2626", i === 0 ? 0 : VW, VH / 2, VH * 0.6, 0.15 + Math.sin(this.time * 7) * 0.08);
      }
    }
  }
}
