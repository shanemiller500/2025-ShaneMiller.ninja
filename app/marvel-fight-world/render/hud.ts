/* ------------------------------------------------------------------ */
/*  Canvas HUD (screen space, 1920×1080 virtual)                        */
/* ------------------------------------------------------------------ */

import type { Fighter } from "../engine/fighter";
import type { Match } from "../engine/match";
import type { MoveSlot } from "../engine/types";
import { ARCHETYPE_INFO } from "../engine/fighters";
import { VH, clamp, easeOut, easeOutBack, gameFonts, glow, withAlpha } from "./util";

export const PLAYER_COLORS: [string, string] = ["#22d3ee", "#fb7185"];

export interface Announcement {
  text: string;
  big: boolean;
  player?: number;
  born: number;
}

export interface HudState {
  shown: [number, number];
  trail: [number, number];
  trailHold: [number, number];
  combo: [{ hits: number; label?: string; at: number }, { hits: number; label?: string; at: number }];
  announcements: Announcement[];
  superBanner: { player: number; name: string; at: number } | null;
  labels: [string, string];
  /** Key hints for specials/ultimate per player, e.g. ["U", "↓U", "→U", "O"] */
  hints: [string[], string[]];
}

export function newHudState(labels: [string, string], hints: [string[], string[]]): HudState {
  return {
    shown: [1, 1],
    trail: [1, 1],
    trailHold: [0, 0],
    combo: [{ hits: 0, at: -99 }, { hits: 0, at: -99 }],
    announcements: [],
    superBanner: null,
    labels,
    hints,
  };
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function skewBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, skew: number) {
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function strokeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string | CanvasGradient, stroke = "#05060a", sw = 8) {
  ctx.lineJoin = "round";
  ctx.lineWidth = sw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function updateHud(h: HudState, m: Match, dt: number) {
  for (const i of [0, 1] as const) {
    const f = m.fighters[i];
    const target = f.health / f.def.maxHealth;
    h.shown[i] += (target - h.shown[i]) * Math.min(1, dt * 0.35);
    if (target < h.trail[i]) {
      if (h.trailHold[i] > 0) h.trailHold[i] -= dt;
      else h.trail[i] += (target - h.trail[i]) * Math.min(1, dt * 0.06);
    } else h.trail[i] = target;
  }
}

export function noteDamage(h: HudState, player: number) {
  h.trailHold[player] = 34;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  VW: number,
  m: Match,
  h: HudState,
  portraits: [HTMLImageElement | null, HTMLImageElement | null],
  now: number
) {
  const fonts = gameFonts();
  const [a, b] = m.fighters;
  drawTopBars(ctx, VW, m, h, portraits, fonts, now);
  drawMeter(ctx, VW, a, 0, h, fonts, now);
  drawMeter(ctx, VW, b, 1, h, fonts, now);
  drawCombos(ctx, VW, h, fonts, now);
  drawSuperBanner(ctx, VW, m, h, portraits, fonts, now);
  drawAnnouncements(ctx, VW, h, fonts, now);
}

/* ── Top: health, names, portraits, timer ──────────────────────────── */
function drawTopBars(ctx: CanvasRenderingContext2D, VW: number, m: Match, h: HudState, portraits: [HTMLImageElement | null, HTMLImageElement | null], fonts: { display: string; body: string }, now: number) {
  const top = 46;
  const barH = 40;
  const gap = 96;
  const outer = 190;
  const barW = VW / 2 - gap - outer;

  // Header plate
  const plate = ctx.createLinearGradient(0, 0, 0, 200);
  plate.addColorStop(0, "rgba(2,6,23,0.75)");
  plate.addColorStop(1, "rgba(2,6,23,0)");
  ctx.fillStyle = plate;
  ctx.fillRect(0, 0, VW, 200);

  for (const i of [0, 1] as const) {
    const f = m.fighters[i];
    const dir = i === 0 ? -1 : 1;
    const innerX = VW / 2 + dir * gap;
    const x = i === 0 ? innerX - barW : innerX;
    const skew = i === 0 ? -14 : 14;
    const pc = PLAYER_COLORS[i];

    // Back
    ctx.fillStyle = "#05060a";
    skewBar(ctx, x - 6, top - 6, barW + 12, barH + 12, skew);
    ctx.fill();
    ctx.fillStyle = "#1e1b2e";
    skewBar(ctx, x, top, barW, barH, skew);
    ctx.fill();

    // Damage trail and fill (anchored at the outer edge)
    const draw = (frac: number, fill: string | CanvasGradient) => {
      const w = barW * clamp(frac, 0, 1);
      ctx.fillStyle = fill;
      skewBar(ctx, i === 0 ? x : x + barW - w, top, w, barH, skew);
      ctx.fill();
    };
    draw(h.trail[i], "#ef4444");
    const low = h.shown[i] < 0.3;
    const g = ctx.createLinearGradient(0, top, 0, top + barH);
    if (low) {
      const p = 0.5 + Math.sin(now * 12) * 0.5;
      g.addColorStop(0, `rgb(255,${120 + p * 80},${80 + p * 60})`);
      g.addColorStop(1, "#b91c1c");
    } else {
      g.addColorStop(0, "#fef08a");
      g.addColorStop(0.5, "#facc15");
      g.addColorStop(1, "#ea580c");
    }
    draw(h.shown[i], g);
    // Gloss + ticks
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    skewBar(ctx, x, top + 3, barW, barH * 0.32, skew);
    ctx.fill();
    ctx.strokeStyle = "rgba(5,6,10,0.35)";
    ctx.lineWidth = 2;
    for (let k = 1; k < 10; k++) {
      const tx = x + (barW * k) / 10;
      ctx.beginPath();
      ctx.moveTo(tx + skew, top);
      ctx.lineTo(tx, top + barH);
      ctx.stroke();
    }
    ctx.strokeStyle = pc;
    ctx.lineWidth = 2.5;
    skewBar(ctx, x, top, barW, barH, skew);
    ctx.stroke();

    // Guard (thin, under health)
    const gw = barW * 0.55 * clamp(f.guard / 100, 0, 1);
    ctx.fillStyle = "rgba(5,6,10,0.8)";
    ctx.fillRect(i === 0 ? x + barW - barW * 0.55 : x, top + barH + 10, barW * 0.55, 8);
    ctx.fillStyle = f.guard < 30 ? "#f87171" : "#60a5fa";
    ctx.fillRect(i === 0 ? x + barW - gw : x, top + barH + 10, gw, 8);

    // Name + archetype
    ctx.font = `italic 650 40px ${fonts.display}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = i === 0 ? "left" : "right";
    const nameX = i === 0 ? x + 4 : x + barW - 4;
    strokeText(ctx, f.def.name.toUpperCase(), nameX, top + barH + 62, "#ffffff", "#05060a", 9);
    const arch = ARCHETYPE_INFO[f.def.archetype];
    ctx.font = `700 18px ${fonts.body}`;
    const nameW = ctx.measureText(f.def.name.toUpperCase()).width * (40 / 18) * 0.92;
    void nameW;
    ctx.fillStyle = arch.color;
    ctx.fillText(`${arch.label.toUpperCase()} · ${h.labels[i]}`, nameX, top + barH + 88);

    // Round pips
    for (let r = 0; r < m.roundsToWin; r++) {
      const px = innerX + dir * (22 + r * 34);
      const won = m.wins[i] > r;
      ctx.save();
      ctx.translate(px, top + barH + 50);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#05060a";
      ctx.fillRect(-12, -12, 24, 24);
      ctx.fillStyle = won ? "#facc15" : "#334155";
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      if (won) glow(ctx, "#facc15", px, top + barH + 50, 26, 0.6);
    }

    // Portrait hex
    const pcx = i === 0 ? 95 : VW - 95;
    const pcy = 92;
    const pr = 74;
    hexPath(ctx, pcx, pcy, pr + 7);
    ctx.fillStyle = "#05060a";
    ctx.fill();
    hexPath(ctx, pcx, pcy, pr + 3);
    ctx.fillStyle = pc;
    ctx.fill();
    ctx.save();
    hexPath(ctx, pcx, pcy, pr);
    ctx.clip();
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(pcx - pr, pcy - pr, pr * 2, pr * 2);
    const img = portraits[i];
    if (img && img.naturalWidth) {
      const s = img.naturalWidth * 0.85;
      ctx.save();
      if (i === 1) {
        ctx.translate(pcx * 2, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, (img.naturalWidth - s) / 2, 0, s, s, pcx - pr, pcy - pr, pr * 2, pr * 2);
      ctx.restore();
    }
    if (f.health <= 0) {
      ctx.fillStyle = "rgba(127,29,29,0.55)";
      ctx.fillRect(pcx - pr, pcy - pr, pr * 2, pr * 2);
    }
    ctx.restore();
    ctx.font = `900 22px ${fonts.display}`;
    ctx.textAlign = "center";
    strokeText(ctx, h.labels[i], pcx, pcy + pr + 30, pc, "#05060a", 7);
  }

  // Timer
  const tx = VW / 2;
  ctx.save();
  ctx.translate(tx, 36);
  ctx.fillStyle = "#05060a";
  ctx.beginPath();
  ctx.moveTo(-74, 0);
  ctx.lineTo(74, 0);
  ctx.lineTo(66, 92);
  ctx.lineTo(0, 120);
  ctx.lineTo(-66, 92);
  ctx.closePath();
  ctx.fill();
  const tg = ctx.createLinearGradient(0, 0, 0, 120);
  tg.addColorStop(0, "#facc15");
  tg.addColorStop(1, "#b45309");
  ctx.strokeStyle = tg;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = `900 72px ${fonts.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const low = m.timer <= 10 && m.phase === "fight";
  const dg = ctx.createLinearGradient(0, 14, 0, 90);
  dg.addColorStop(0, low ? "#fecaca" : "#ffffff");
  dg.addColorStop(1, low ? "#ef4444" : "#fde68a");
  ctx.fillStyle = dg;
  ctx.fillText(String(Math.ceil(m.timer)).padStart(2, "0"), 0, 56);
  ctx.font = `800 15px ${fonts.body}`;
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`ROUND ${m.round}`, 0, 104);
  ctx.restore();
}

/* ── Bottom: ultimate meter, stamina, special cooldowns ────────────── */
const COOLDOWN_SLOTS: MoveSlot[] = ["s1", "s2", "s3"];

function drawMeter(ctx: CanvasRenderingContext2D, VW: number, f: Fighter, i: 0 | 1, h: HudState, fonts: { display: string; body: string }, now: number) {
  const w = 520;
  const barH = 26;
  const y = VH - 74;
  const x = i === 0 ? 48 : VW - 48 - w;
  const full = f.meter >= 100;
  const skew = i === 0 ? 12 : -12;

  ctx.fillStyle = "#05060a";
  skewBar(ctx, x - 5, y - 5, w + 10, barH + 10, skew);
  ctx.fill();
  ctx.fillStyle = "#111827";
  skewBar(ctx, x, y, w, barH, skew);
  ctx.fill();
  const fw = w * clamp(f.meter / 100, 0, 1);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  if (full) {
    const s = (((now * 0.8) % 1) + 1) % 1;
    g.addColorStop(0, "#22d3ee");
    g.addColorStop(s * 0.5, "#a78bfa");
    g.addColorStop(Math.min(1, s * 0.5 + 0.4), "#f472b6");
    g.addColorStop(1, "#facc15");
  } else {
    g.addColorStop(0, "#1d4ed8");
    g.addColorStop(1, "#38bdf8");
  }
  ctx.fillStyle = g;
  skewBar(ctx, i === 0 ? x : x + w - fw, y, fw, barH, skew);
  ctx.fill();
  ctx.strokeStyle = "#05060a";
  ctx.lineWidth = 3;
  for (let k = 1; k < 4; k++) {
    const sx = x + (w * k) / 4;
    ctx.beginPath();
    ctx.moveTo(sx + skew, y);
    ctx.lineTo(sx, y + barH);
    ctx.stroke();
  }
  if (full) glow(ctx, "#a78bfa", x + w / 2, y + barH / 2, 260, 0.35 + Math.sin(now * 8) * 0.15);

  ctx.font = `italic 900 ${full ? 28 : 22}px ${fonts.display}`;
  ctx.textAlign = i === 0 ? "left" : "right";
  ctx.textBaseline = "alphabetic";
  const label = full ? `ULTIMATE READY  [${h.hints[i][3] ?? ""}]` : "ULTIMATE";
  const lg = ctx.createLinearGradient(0, y - 34, 0, y - 6);
  lg.addColorStop(0, "#ffffff");
  lg.addColorStop(1, full ? "#facc15" : "#94a3b8");
  strokeText(ctx, label, i === 0 ? x : x + w, y - 12, lg, "#05060a", 7);

  // Stamina sliver
  ctx.fillStyle = "rgba(5,6,10,0.85)";
  ctx.fillRect(x, y + barH + 10, w * 0.5, 6);
  ctx.fillStyle = "#4ade80";
  const sw = w * 0.5 * clamp(f.stamina / 100, 0, 1);
  ctx.fillRect(i === 0 ? x : x + w * 0.5 - sw, y + barH + 10, sw, 6);

  // Special cooldown dials
  COOLDOWN_SLOTS.forEach((slot, k) => {
    const cx = i === 0 ? x + w + 74 + k * 96 : x - 74 - k * 96;
    const cy = y + 6;
    const move = f.def.moves[slot];
    const total = Math.max(1, Math.round((move.cooldown ?? 0) * f.def.cooldownMul));
    const left = f.cooldowns[slot] ?? 0;
    const ready = left <= 0;
    ctx.fillStyle = "#05060a";
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ready ? "#1e293b" : "#0f172a";
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    if (!ready) {
      ctx.fillStyle = "rgba(148,163,184,0.35)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / total));
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = PLAYER_COLORS[i];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = `900 17px ${fonts.display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ready ? "#ffffff" : "#64748b";
    ctx.fillText(h.hints[i][k] ?? "", cx, cy + 1);
    ctx.font = `700 12px ${fonts.body}`;
    ctx.fillStyle = ready ? "#cbd5e1" : "#475569";
    // Fit the label inside its column (≈ 88 units) so neighbours never collide
    let nm = move.name;
    while (nm.length > 4 && ctx.measureText(nm).width > 88) nm = nm.slice(0, -2) + "…";
    ctx.fillText(nm, cx, cy + 44);
  });
}

/* ── Combo counters ────────────────────────────────────────────────── */
function drawCombos(ctx: CanvasRenderingContext2D, VW: number, h: HudState, fonts: { display: string; body: string }, now: number) {
  for (const i of [0, 1] as const) {
    const c = h.combo[i];
    const age = now - c.at;
    if (c.hits < 2 || age > 1.6) continue;
    const a = clamp(1.6 - age, 0, 1) * clamp(age * 8, 0, 1);
    const pop = easeOutBack(clamp(age * 5, 0, 1));
    const x = i === 0 ? 70 : VW - 70;
    const y = 380;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.textAlign = i === 0 ? "left" : "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = `italic 900 120px ${fonts.display}`;
    const g = ctx.createLinearGradient(0, -100, 0, 0);
    g.addColorStop(0, "#fffbeb");
    g.addColorStop(1, c.hits >= 8 ? "#f472b6" : c.hits >= 5 ? "#fb923c" : "#facc15");
    strokeText(ctx, String(c.hits), 0, 0, g, "#05060a", 12);
    ctx.font = `italic 900 40px ${fonts.display}`;
    const word = c.hits >= 8 ? "ULTRA COMBO!" : c.hits >= 5 ? "SUPER COMBO!" : "HIT COMBO";
    strokeText(ctx, word, i === 0 ? 6 : -6, 48, "#ffffff", "#05060a", 8);
    if (c.label) {
      ctx.font = `italic 800 30px ${fonts.display}`;
      strokeText(ctx, c.label.toUpperCase(), i === 0 ? 6 : -6, 90, PLAYER_COLORS[i], "#05060a", 7);
    }
    ctx.restore();
  }
}

/* ── Ultimate cinematic banner ─────────────────────────────────────── */
function drawSuperBanner(ctx: CanvasRenderingContext2D, VW: number, m: Match, h: HudState, portraits: [HTMLImageElement | null, HTMLImageElement | null], fonts: { display: string; body: string }, now: number) {
  const s = h.superBanner;
  if (!s) return;
  const age = now - s.at;
  if (age > 1.3) {
    h.superBanner = null;
    return;
  }
  const inT = easeOut(age * 4);
  const outA = clamp((1.3 - age) * 4, 0, 1);
  const dir = s.player === 0 ? 1 : -1;
  ctx.save();
  ctx.globalAlpha = outA;
  // Dim the scene during the flash
  ctx.fillStyle = `rgba(2,6,23,${0.45 * (m.superFreeze > 0 ? 1 : outA)})`;
  ctx.fillRect(0, 0, VW, VH);
  // Diagonal band
  const y = VH * 0.42;
  ctx.translate(VW / 2 + (1 - inT) * -dir * VW, y);
  ctx.rotate(-0.06 * dir);
  const band = ctx.createLinearGradient(-VW, 0, VW, 0);
  const pc = PLAYER_COLORS[s.player];
  band.addColorStop(0, withAlpha(pc, 0));
  band.addColorStop(0.3, withAlpha(pc, 0.95));
  band.addColorStop(0.7, withAlpha("#a855f7", 0.95));
  band.addColorStop(1, withAlpha("#a855f7", 0));
  ctx.fillStyle = band;
  ctx.fillRect(-VW, -70, VW * 2, 140);
  ctx.fillStyle = "#05060a";
  ctx.fillRect(-VW, -78, VW * 2, 8);
  ctx.fillRect(-VW, 70, VW * 2, 8);
  // Speed lines
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const lx = ((i * 157 + now * 2400 * dir) % (VW * 2)) - VW;
    ctx.beginPath();
    ctx.moveTo(lx, -60 + (i % 5) * 28);
    ctx.lineTo(lx + 240 * dir, -60 + (i % 5) * 28);
    ctx.stroke();
  }
  const img = portraits[s.player];
  if (img && img.naturalWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-VW * 0.42, -70, 240, 140);
    ctx.clip();
    const sw = img.naturalWidth * 0.85;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, img.naturalHeight * 0.08, sw, sw * 0.58, -VW * 0.42, -70, 240, 140);
    ctx.restore();
  }
  ctx.font = `italic 900 84px ${fonts.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tg = ctx.createLinearGradient(0, -40, 0, 40);
  tg.addColorStop(0, "#ffffff");
  tg.addColorStop(1, "#fde68a");
  strokeText(ctx, s.name.toUpperCase(), 60, 4, tg, "#05060a", 12);
  ctx.font = `900 22px ${fonts.body}`;
  ctx.fillStyle = "#05060a";
  ctx.fillText("ULTIMATE", 60, -54);
  ctx.restore();
}

/* ── Announcer text ────────────────────────────────────────────────── */
function drawAnnouncements(ctx: CanvasRenderingContext2D, VW: number, h: HudState, fonts: { display: string; body: string }, now: number) {
  h.announcements = h.announcements.filter((a) => now - a.born < (a.big ? 1.6 : 1.1));
  let smallRow: [number, number] = [0, 0];
  for (const a of h.announcements) {
    const age = now - a.born;
    if (a.big) {
      const life = 1.6;
      const s = easeOutBack(clamp(age * 4, 0, 1)) * (1 + Math.max(0, age - life + 0.3) * 1.2);
      const alpha = clamp((life - age) * 3, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(VW / 2, VH * 0.42);
      ctx.scale(s, s);
      ctx.font = `italic 900 ${a.text.length > 9 ? 120 : 170}px ${fonts.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Chromatic offset
      ctx.fillStyle = "rgba(34,211,238,0.65)";
      ctx.fillText(a.text, -6, 4);
      ctx.fillStyle = "rgba(244,63,94,0.65)";
      ctx.fillText(a.text, 6, -4);
      const g = ctx.createLinearGradient(0, -80, 0, 80);
      const ko = a.text === "K.O.";
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.5, ko ? "#fca5a5" : "#fde68a");
      g.addColorStop(1, ko ? "#dc2626" : "#f59e0b");
      strokeText(ctx, a.text, 0, 0, g, "#05060a", 16);
      ctx.restore();
    } else {
      const side = a.player === 1 ? 1 : 0;
      const row = smallRow[side]++;
      const alpha = clamp((1.1 - age) * 4, 0, 1);
      const x = a.player === undefined ? VW / 2 : side === 0 ? 70 : VW - 70;
      const y = 560 + row * 50 - easeOut(age * 3) * 20;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `italic 900 40px ${fonts.display}`;
      ctx.textAlign = a.player === undefined ? "center" : side === 0 ? "left" : "right";
      ctx.textBaseline = "middle";
      const col = a.text.includes("BLOCK") ? "#93c5fd" : a.text.includes("COUNTER") || a.text.includes("PARRY") ? "#fde047" : a.text.includes("BREAK") || a.text.includes("DIZZY") ? "#f87171" : "#ffffff";
      strokeText(ctx, a.text, x, y, col, "#05060a", 8);
      ctx.restore();
    }
  }
}
