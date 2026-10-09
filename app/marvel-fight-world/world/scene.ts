/* ------------------------------------------------------------------ */
/*  WorldScene: the explorable side-scrolling street for one zone.      */
/*  Plain canvas loop (no React per frame). React only hears about the  */
/*  nearest resident and zone-edge exits through callbacks.             */
/* ------------------------------------------------------------------ */

import { Fighter, GRAVITY } from "../engine/fighter";
import type { FighterDef } from "../engine/types";
import type { Prop } from "../engine/match";
import { loadImage } from "../data/roster";
import { applyPortraitPalette } from "../render/palette";
import type { Settings } from "../data/storage";
import { InputManager } from "../input/input";
import { BTN } from "../input/gamepad";
import { drawBack, drawFloor, drawFront, drawProp } from "../render/arenas";
import { buildRig, drawFighter, drawShadow, poseFor } from "../render/fighterDraw";
import { Particles } from "../render/particles";
import { PLAYER_COLORS } from "../render/hud";
import { FLOOR_Y, VH, clamp, gameFonts, glow, withAlpha } from "../render/util";
import { ZONE_HALF, neighbours, type Resident, type Zone } from "./zones";

const STEP = 1 / 60;
const ZOOM = 1.32;
const TALK_RANGE = 240;

interface Npc {
  f: Fighter;
  home: number;
  target: number;
  wait: number;
}

export interface SceneCallbacks {
  onNear: (r: Resident | null) => void;
  onEdge: (dir: -1 | 1) => void;
}

export class WorldScene {
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  private player: Fighter;
  private npcs: Npc[] = [];
  private props: Prop[];
  private particles = new Particles();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private t = 0;
  private camX = 0;
  private s = 1;
  private VW = 1920;
  private near: Resident | null = null;
  private active = true;
  private edgeFired = false;
  private alive = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private zone: Zone,
    playerDef: FighterDef,
    private residents: Resident[],
    startX: number,
    settings: Settings,
    private cb: SceneCallbacks
  ) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.input = new InputManager(settings.bindings);
    this.input.shareKeys = true;
    this.player = new Fighter(playerDef, 0, startX);
    this.player.facing = startX > 0 ? -1 : 1;
    this.camX = startX;
    this.props = zone.arena.props.map((p, i) => ({ id: i + 1, kind: p.kind, x: p.x * 1.6, w: p.w, h: p.h, hp: 2, broken: false }));
    this.npcs = residents.map((r, i) => {
      const f = new Fighter(r.def, 1, r.x);
      f.facing = r.x > startX ? -1 : 1;
      return { f, home: r.x, target: r.x, wait: 60 + i * 47 };
    });
    loadImage(playerDef.portrait.md).then((img) => {
      applyPortraitPalette(playerDef, img);
    });
    this.npcs.forEach((n) =>
      loadImage(n.f.def.portrait.md).then((img) => {
        applyPortraitPalette(n.f.def, img);
      })
    );
  }

  get x() {
    return this.player.x;
  }

  start() {
    this.input.attach();
    this.resize();
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.alive) return;
      const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
      this.last = now;
      this.acc += dt;
      while (this.acc >= STEP) {
        this.step();
        this.acc -= STEP;
      }
      this.particles.update(dt);
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.input.detach();
  }

  /** Freeze player control while a menu/modal is open. */
  setActive(on: boolean) {
    this.active = on;
    if (on) this.input.attach();
    else this.input.detach();
  }

  setTouch(action: "left" | "right" | "up", down: boolean) {
    this.input.setTouch(0, action, down);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(10, Math.round(rect.width * dpr));
    const h = Math.max(10, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.s = h / VH;
    this.VW = w / this.s;
  }

  /* ── Simulation ────────────────────────────────────────────────── */
  private step() {
    this.t += STEP;
    const p = this.player;
    const inp = this.active ? this.input.read(0) : null;
    const running = !!inp && (this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight") || this.input.padButton(BTN.LB) || inp.block);
    const dir = inp ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0;
    const grounded = p.y <= 0 && p.vy <= 0;

    if (grounded) {
      const speed = p.def.walk * (running ? 2.1 : 1.25);
      p.vx = dir * speed;
      if (dir) p.facing = dir as 1 | -1;
      if (inp?.up) {
        p.vy = p.def.jump * 0.95;
        p.y = 0.01;
        p.setState("air");
        this.particles.dust(p.x, 0, 1);
      } else p.setState(dir ? (running ? "run" : "walk") : "idle");

    } else {
      p.vx += dir * 0.35;
      p.vx = clamp(p.vx, -p.def.walk * 2.1, p.def.walk * 2.1);
      p.vy -= GRAVITY;
      if (p.y + p.vy <= 0) {
        p.y = 0;
        p.vy = 0;
        p.setState("idle");
        this.particles.dust(p.x, 0, 1);
      }
    }
    p.x += p.vx;
    p.y = Math.max(0, p.y + (grounded ? 0 : p.vy));
    p.stateTime++;

    // Zone exits
    if (Math.abs(p.x) > ZONE_HALF - 30) {
      p.x = clamp(p.x, -ZONE_HALF + 30, ZONE_HALF - 30);
      if (!this.edgeFired && this.active) {
        this.edgeFired = true;
        this.cb.onEdge(p.x < 0 ? -1 : 1);
      }
    } else if (Math.abs(p.x) < ZONE_HALF - 200) this.edgeFired = false;

    // Residents wander near home and turn to face the player
    let best: Npc | null = null;
    let bestD = TALK_RANGE;
    for (const n of this.npcs) {
      const f = n.f;
      const d = Math.abs(f.x - p.x);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
      if (d < TALK_RANGE * 1.3) {
        f.facing = p.x < f.x ? -1 : 1;
        f.setState("idle");
      } else if (n.wait > 0) {
        n.wait--;
        f.setState("idle");
      } else if (Math.abs(n.target - f.x) > 6) {
        const dd = Math.sign(n.target - f.x) as 1 | -1;
        f.facing = dd;
        f.x += dd * f.def.walk * 0.6;
        f.setState("walk");
      } else {
        n.target = n.home + (Math.random() - 0.5) * 320;
        n.wait = 90 + Math.random() * 200;
      }
      f.stateTime++;
    }
    const nearRes = best ? this.residents[this.npcs.indexOf(best)] : null;
    if (nearRes !== this.near) {
      this.near = nearRes;
      this.cb.onNear(nearRes);
    }

    // Camera
    const viewHalf = this.VW / 2 / ZOOM;
    const lead = p.facing * 80;
    const target = clamp(p.x + lead, -ZONE_HALF - 120 + viewHalf, ZONE_HALF + 120 - viewHalf);
    this.camX += (target - this.camX) * 0.08;

    // Ambient sparks
    if (Math.random() < 0.08) this.particles.ember(this.camX + (Math.random() - 0.5) * this.VW / ZOOM, -Math.random() * 300, this.zone.arena.colors[1]);
  }

  /* ── Rendering ─────────────────────────────────────────────────── */
  private draw(dt: number) {
    const { ctx, VW } = this;
    void dt;
    const a = this.zone.arena;
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    drawBack(ctx, a, { VW, camX: this.camX, zoom: ZOOM, t: this.t });

    ctx.save();
    ctx.translate(VW / 2, FLOOR_Y);
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-this.camX, 0);
    drawFloor(ctx, a, this.t);
    for (const pr of this.props) drawProp(ctx, pr, a, this.t);
    this.drawGates();

    const all = [...this.npcs.map((n) => ({ f: n.f, npc: n })), { f: this.player, npc: null as Npc | null }];
    for (const { f } of all) drawShadow(ctx, f);
    for (const { f, npc } of all) {
      const j = poseFor(f, this.t);
      const rig = buildRig(f, j);
      const isNear = npc && this.near && this.residents[this.npcs.indexOf(npc)] === this.near;
      if (isNear) glow(ctx, "#fde047", f.x, -f.def.height * 0.5, f.def.height * 0.9, 0.18 + Math.sin(this.t * 4) * 0.05);
      drawFighter(ctx, f, j, rig, { t: this.t, flash: 0, ring: npc ? (isNear ? "#fde047" : "rgba(148,163,184,0.5)") : PLAYER_COLORS[0], weaponOut: false, rim: this.zone.arena.colors[1] });
      this.drawTag(f, npc ? (isNear ? "#fde047" : "#e2e8f0") : PLAYER_COLORS[0], !npc, !!isNear);
    }
    this.particles.draw(ctx);
    ctx.restore();

    drawFront(ctx, a, { VW, camX: this.camX, zoom: ZOOM, t: this.t });

    // Soft vignette for depth
    const g = ctx.createRadialGradient(VW / 2, VH * 0.55, VH * 0.35, VW / 2, VH * 0.55, VW * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  private drawTag(f: Fighter, color: string, you: boolean, near: boolean) {
    const { ctx } = this;
    const fonts = gameFonts();
    const y = -f.def.height - 46 - f.y + Math.sin(this.t * 2 + f.x) * 3;
    const label = you ? "YOU" : f.def.name.toUpperCase();
    ctx.font = `700 ${you ? 20 : 19}px ${fonts.display}`;
    const w = ctx.measureText(label).width + 26;
    ctx.fillStyle = withAlpha("#05060a", near ? 0.85 : 0.6);
    ctx.beginPath();
    ctx.roundRect(f.x - w / 2, y - 18, w, 32, 8);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, near ? 0.95 : 0.4);
    ctx.lineWidth = near ? 2.5 : 1.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, f.x, y - 1);
    // Pointer
    ctx.beginPath();
    ctx.moveTo(f.x - 7, y + 14);
    ctx.lineTo(f.x + 7, y + 14);
    ctx.lineTo(f.x, y + 22);
    ctx.fillStyle = withAlpha("#05060a", near ? 0.85 : 0.6);
    ctx.fill();
  }

  /** Glowing exit gates at both zone edges, labelled with the next zone. */
  private drawGates() {
    const { ctx } = this;
    const fonts = gameFonts();
    const [left, right] = neighbours(this.zone.id);
    for (const [side, z] of [[-1, left], [1, right]] as const) {
      const x = side * (ZONE_HALF - 10);
      const pulse = 0.6 + Math.sin(this.t * 3) * 0.2;
      const grd = ctx.createLinearGradient(x, -420, x, 0);
      grd.addColorStop(0, withAlpha(z.arena.colors[1], 0));
      grd.addColorStop(1, withAlpha(z.arena.colors[1], 0.55 * pulse));
      ctx.fillStyle = grd;
      ctx.fillRect(x - 70, -420, 140, 420);
      glow(ctx, z.arena.colors[1], x, -30, 160, 0.35 * pulse);
      ctx.font = `700 22px ${fonts.display}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(side < 0 ? `◀ ${z.name.toUpperCase()}` : `${z.name.toUpperCase()} ▶`, x - side * 150, -470);
    }
  }
}
