/* ------------------------------------------------------------------ */
/*  The Dragon Riders' Colosseum: an arena of dark stone tiers round   */
/*  the dragon pit. The back half rises in tiers of arched rooms (each */
/*  rider's lit doorway flies a pennant in their dragon's eye colour), */
/*  dragon-head gargoyles on the pillars, braziers, and a great dragon */
/*  head sculpture crowning the back wall, its eyes glowing at night.  */
/*  Two sweeping stone dragon wings buttress the ends. The front half  */
/*  is a low arcade (so you can see into the pit) with the great gate: */
/*  two pillars topped with roaring dragon heads under a horned arch.  */
/*  Origin: the pit's centre.                                          */
/* ------------------------------------------------------------------ */
import { drawFlame } from "./sprites";

const INK = "#1d1612";
const STONE = "#6e6660";
const STONE_L = "#8c837b";
const STONE_D = "#4d4741";
const BONE = "#e9e0c8";
const BLUE = "#3a6fb0";
const GOLD = "#e0b43a";

export interface HallRoom {
  a: number;
  eye: string;
  lit: boolean;
}

const shadeBy = (a: number) => {
  // walls facing the camera are lit, the ones round the sides darker
  const k = Math.abs(Math.sin(a));
  return k > 0.75 ? STONE_L : k > 0.4 ? STONE : STONE_D;
};

/** A dragon head in stone (side-on), facing `dir`. */
function stoneHead(c: CanvasRenderingContext2D, x: number, y: number, s: number, dir: 1 | -1, night: boolean, t: number, roar = false) {
  c.save();
  c.translate(x, y);
  c.scale(dir * s, s);
  c.fillStyle = STONE_L;
  c.strokeStyle = INK;
  c.lineWidth = 1.4 / s;
  // neck + skull
  c.beginPath();
  c.moveTo(-6, 10);
  c.quadraticCurveTo(-8, -4, 2, -8);
  c.quadraticCurveTo(14, -12, 22, -6);
  c.lineTo(26, -2);
  c.lineTo(20, roar ? 6 : 2);
  c.lineTo(10, roar ? 3 : 2);
  c.lineTo(18, roar ? 10 : 6);
  c.lineTo(4, 8);
  c.lineTo(4, 14);
  c.closePath();
  c.fill();
  c.stroke();
  // horns
  c.fillStyle = BONE;
  c.beginPath();
  c.moveTo(0, -8);
  c.quadraticCurveTo(-10, -18, -14, -26);
  c.quadraticCurveTo(-4, -18, 5, -10);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(6, -10);
  c.lineTo(2, -18);
  c.lineTo(9, -10);
  c.fill();
  // teeth
  c.fillStyle = BONE;
  for (const tx of [12, 16, 20]) {
    c.beginPath();
    c.moveTo(tx, 2);
    c.lineTo(tx + 1.5, roar ? 5 : 4);
    c.lineTo(tx + 3, 2);
    c.fill();
  }
  // the eye: glows at night
  c.fillStyle = night ? `rgba(255,${150 + Math.sin(t * 3) * 40},60,1)` : INK;
  c.beginPath();
  c.ellipse(11, -5, 2.4, 1.6, 0.2, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** A sweeping stone dragon wing (a buttress at one end of the colosseum). */
function wing(c: CanvasRenderingContext2D, x: number, y: number, h: number, dir: 1 | -1) {
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  c.fillStyle = STONE;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -h * 0.5);
  c.quadraticCurveTo(h * 0.2, -h * 1.05, h * 0.65, -h * 1.25);
  c.lineTo(h * 0.55, -h * 0.95);
  c.quadraticCurveTo(h * 0.5, -h * 0.8, h * 0.62, -h * 0.68);
  c.quadraticCurveTo(h * 0.45, -h * 0.55, h * 0.52, -h * 0.38);
  c.quadraticCurveTo(h * 0.3, -h * 0.25, h * 0.32, -h * 0.05);
  c.lineTo(h * 0.2, 0);
  c.closePath();
  c.fill();
  c.stroke();
  // finger bones
  c.strokeStyle = STONE_L;
  c.lineWidth = 2.4;
  for (const [ex, ey] of [[0.62, -0.68], [0.52, -0.38], [0.32, -0.05]]) {
    c.beginPath();
    c.moveTo(h * 0.08, -h * 0.55);
    c.lineTo(h * ex, h * ey);
    c.stroke();
  }
  c.restore();
}

/** The back half: tall tiers of rooms facing into the pit. */
export function drawHallBack(c: CanvasRenderingContext2D, rx: number, ry: number, tiers: number, rooms: HallRoom[], t: number, night: boolean) {
  const TH = 24;
  const H = 18 + TH * tiers;
  const depth = 30;
  const n = Math.max(10, Math.round(rx * 0.11));
  const P = (a: number, k = 0) => ({ x: Math.cos(a) * (rx + k), y: Math.sin(a) * (ry + k * 0.7) });
  // the roof walk (stone top between the inner + outer edges)
  c.fillStyle = STONE_D;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const p = P(a, depth);
    if (i === 0) c.moveTo(p.x, p.y - H);
    else c.lineTo(p.x, p.y - H);
  }
  for (let i = n; i >= 0; i--) {
    const a = Math.PI + (i / n) * Math.PI;
    const p = P(a);
    c.lineTo(p.x, p.y - H);
  }
  c.closePath();
  c.fill();
  // the inner wall, segment by segment, with arches on each tier
  for (let i = 0; i < n; i++) {
    const a1 = Math.PI + (i / n) * Math.PI;
    const a2 = Math.PI + ((i + 1) / n) * Math.PI;
    const p1 = P(a1);
    const p2 = P(a2);
    c.fillStyle = shadeBy((a1 + a2) / 2);
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.lineTo(p2.x, p2.y);
    c.lineTo(p2.x, p2.y - H);
    c.lineTo(p1.x, p1.y - H);
    c.closePath();
    c.fill();
    c.stroke();
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const wseg = Math.abs(p2.x - p1.x);
    if (wseg < 6) continue;
    for (let k = 0; k < tiers; k++) {
      const aw = Math.min(10, wseg * 0.32);
      const base = my - 4 - k * TH;
      c.fillStyle = "#231b16";
      c.beginPath();
      c.moveTo(mx - aw, base);
      c.lineTo(mx - aw, base - TH * 0.5);
      c.arc(mx, base - TH * 0.5, aw, Math.PI, 0);
      c.lineTo(mx + aw, base);
      c.closePath();
      c.fill();
    }
  }
  // the riders' rooms: a lit doorway + a pennant in their dragon's eye colour
  for (const r of rooms) {
    if (Math.sin(r.a) > 0.05) continue;
    const p = P(r.a);
    const glow = night || r.lit ? 0.9 : 0.35;
    c.fillStyle = `rgba(255,190,90,${glow})`;
    c.beginPath();
    c.moveTo(p.x - 6, p.y - 4);
    c.lineTo(p.x - 6, p.y - 14);
    c.arc(p.x, p.y - 14, 6, Math.PI, 0);
    c.lineTo(p.x + 6, p.y - 4);
    c.closePath();
    c.fill();
    c.strokeStyle = "#5e3f24";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(p.x + 8, p.y - 4);
    c.lineTo(p.x + 8, p.y - 30);
    c.stroke();
    c.fillStyle = r.eye;
    c.beginPath();
    c.moveTo(p.x + 8, p.y - 30);
    c.lineTo(p.x + 18, p.y - 27 + Math.sin(t * 4 + r.a * 5) * 1.5);
    c.lineTo(p.x + 8, p.y - 23);
    c.closePath();
    c.fill();
  }
  // crenellated parapet along the top
  c.fillStyle = STONE_L;
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI + (i / (n * 2)) * Math.PI;
    const p = P(a);
    if (i % 2 === 0) c.fillRect(p.x - 4, p.y - H - 7, 8, 7);
  }
  // pillars with dragon-head gargoyles + braziers
  for (let i = 0; i <= n; i += 3) {
    const a = Math.PI + (i / n) * Math.PI;
    const p = P(a);
    c.fillStyle = STONE_L;
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.fillRect(p.x - 3.5, p.y - H - 12, 7, H + 12);
    c.strokeRect(p.x - 3.5, p.y - H - 12, 7, H + 12);
    stoneHead(c, p.x, p.y - H - 16, 0.65, p.x < 0 ? 1 : -1, night, t + i);
    if (night) drawFlame(c, p.x, p.y - H - 6, 0.45, t + i);
  }
  // the great dragon head crowning the back wall
  const top = P(Math.PI * 1.5);
  stoneHead(c, top.x - 4, top.y - H - 30, 1.7, 1, night, t, true);
  // banners in the tribe's blue + gold
  for (const a of [Math.PI * 1.25, Math.PI * 1.75]) {
    const p = P(a);
    c.strokeStyle = "#5e3f24";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(p.x, p.y - H - 6);
    c.lineTo(p.x, p.y - H - 44);
    c.stroke();
    c.fillStyle = BLUE;
    c.fillRect(p.x, p.y - H - 44, 16, 22);
    c.fillStyle = GOLD;
    c.beginPath();
    c.arc(p.x + 8, p.y - H - 33, 4, 0, Math.PI * 2);
    c.fill();
  }
  // stone dragon wings sweeping up at both ends
  wing(c, -rx - depth * 0.5, 4, H + 40, -1);
  wing(c, rx + depth * 0.5, 4, H + 40, 1);
}

/** The front half: a low arcade (to see the dragons in the pit) and the great gate. */
export function drawHallFront(c: CanvasRenderingContext2D, rx: number, ry: number, rooms: HallRoom[], t: number, night: boolean) {
  const FH = 20;
  const depth = 30;
  const n = Math.max(10, Math.round(rx * 0.11));
  const O = (a: number) => ({ x: Math.cos(a) * (rx + depth), y: Math.sin(a) * (ry + depth * 0.7) });
  const gate = (a: number) => Math.abs(a - Math.PI / 2) < 0.2;
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI;
    const a2 = ((i + 1) / n) * Math.PI;
    if (gate((a1 + a2) / 2)) continue;
    const p1 = O(a1);
    const p2 = O(a2);
    c.fillStyle = shadeBy((a1 + a2) / 2);
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.lineTo(p2.x, p2.y);
    c.lineTo(p2.x, p2.y - FH);
    c.lineTo(p1.x, p1.y - FH);
    c.closePath();
    c.fill();
    c.stroke();
    // open arches in the arcade
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const aw = Math.min(8, Math.abs(p2.x - p1.x) * 0.3);
    if (aw > 3) {
      c.fillStyle = "rgba(35,27,22,0.85)";
      c.beginPath();
      c.moveTo(mx - aw, my);
      c.lineTo(mx - aw, my - FH * 0.45);
      c.arc(mx, my - FH * 0.45, aw, Math.PI, 0);
      c.lineTo(mx + aw, my);
      c.closePath();
      c.fill();
    }
    c.fillStyle = STONE_L;
    c.fillRect(p1.x - 3, p1.y - FH - 5, 6, 5);
  }
  // rooms on the near side: lit windows
  for (const r of rooms) {
    if (Math.sin(r.a) <= 0.05) continue;
    const p = O(r.a);
    c.fillStyle = `rgba(255,190,90,${night ? 0.9 : 0.4})`;
    c.fillRect(p.x - 3, p.y - FH + 4, 6, 7);
    c.fillStyle = r.eye;
    c.fillRect(p.x - 3, p.y - FH - 3, 6, 3);
  }
  // the great gate: two pillars topped with roaring dragon heads, a horned arch between them
  const g = O(Math.PI / 2);
  for (const k of [-1, 1] as const) {
    const x = g.x + k * 30;
    c.fillStyle = STONE_L;
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.fillRect(x - 7, g.y - 64, 14, 64);
    c.strokeRect(x - 7, g.y - 64, 14, 64);
    stoneHead(c, x, g.y - 70, 1, k === -1 ? -1 : 1, night, t + k, true);
    drawFlame(c, x + k * 14, g.y - 40, 0.5, t + k * 2);
  }
  // a horned arch over the gate
  c.strokeStyle = BONE;
  c.lineWidth = 6;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(g.x - 26, g.y - 62);
  c.quadraticCurveTo(g.x, g.y - 104, g.x + 26, g.y - 62);
  c.stroke();
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.stroke();
  c.fillStyle = BLUE;
  c.beginPath();
  c.moveTo(g.x - 10, g.y - 80);
  c.lineTo(g.x + 10, g.y - 80);
  c.lineTo(g.x + 10, g.y - 58);
  c.lineTo(g.x, g.y - 64);
  c.lineTo(g.x - 10, g.y - 58);
  c.closePath();
  c.fill();
  c.fillStyle = GOLD;
  c.beginPath();
  c.arc(g.x, g.y - 72, 4, 0, Math.PI * 2);
  c.fill();
}
