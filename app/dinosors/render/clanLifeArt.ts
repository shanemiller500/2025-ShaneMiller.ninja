/* ------------------------------------------------------------------ */
/*  Clan life art: what the Neanderthals build at home (a hide         */
/*  longhouse, a smokehouse rack, a bone weapon rack, a sparring ring, */
/*  the dragon altar with its skull pillar + fire bowls) and the pit   */
/*  traps they hide under leaves. Origin: the spot on the ground.      */
/* ------------------------------------------------------------------ */
import type { Clan, ClanBuild, ClanHold, ClanTrap } from "../sim/types";
import { fenceSize } from "../sim/clanLife";
import { clanFlag } from "./bruteArt";
import { shade } from "./drawDino";
import { drawFlame } from "./sprites";

const INK = "#24170e";
const HIDE = "#9b7a52";
const BONE = "#e9e0c8";
const WOOD = "#7a5530";

const colorsOf = (c: Clan) => (c.colors?.length ? c.colors : [c.color]);

function bone(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 3) {
  c.strokeStyle = INK;
  c.lineCap = "round";
  c.lineWidth = w + 2;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.strokeStyle = BONE;
  c.lineWidth = w;
  c.stroke();
  c.fillStyle = BONE;
  for (const [x, y] of [[x0, y0], [x1, y1]]) {
    c.beginPath();
    c.arc(x - 1.5, y, w * 0.7, 0, Math.PI * 2);
    c.arc(x + 1.5, y, w * 0.7, 0, Math.PI * 2);
    c.fill();
  }
}

function post(c: CanvasRenderingContext2D, x: number, y0: number, y1: number, w = 4, col = WOOD) {
  c.strokeStyle = INK;
  c.lineCap = "round";
  c.lineWidth = w + 2;
  c.beginPath();
  c.moveTo(x, y0);
  c.lineTo(x, y1);
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
}

function skull(c: CanvasRenderingContext2D, x: number, y: number, s: number, horns = false) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (horns) {
    c.strokeStyle = "#d8cfb5";
    c.lineWidth = 3;
    c.lineCap = "round";
    for (const k of [-1, 1]) {
      c.beginPath();
      c.moveTo(k * 6, -6);
      c.quadraticCurveTo(k * 16, -14, k * 14, -24);
      c.stroke();
    }
  }
  c.fillStyle = BONE;
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(0, -2, 9, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillRect(-5, 3, 10, 5);
  c.strokeRect(-5, 3, 10, 5);
  c.fillStyle = INK;
  c.beginPath();
  c.arc(-3.4, -2, 2.4, 0, Math.PI * 2);
  c.arc(3.4, -2, 2.4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** One of a clan's buildings at its level (1+). */
export function drawClanBuilding(c: CanvasRenderingContext2D, clan: Clan, kind: ClanBuild, lv: number, t: number, night: boolean, part?: "back" | "front") {
  const cols = colorsOf(clan);
  if (kind === "boneFence") return boneFence(c, clan, cols, lv, part ?? "front");
  if (kind === "boneTotem") return boneTotems(c, cols, lv, t);
  // trampled ground under everything
  c.fillStyle = "rgba(110,84,56,0.32)";
  c.beginPath();
  c.ellipse(0, 4, kind === "dragonAltar" ? 104 : 62 + lv * 8, kind === "dragonAltar" ? 52 : 26 + lv * 3, 0, 0, Math.PI * 2);
  c.fill();
  switch (kind) {
    case "longhouse":
      return longhouse(c, cols, lv, t);
    case "smokehouse":
      return smokehouse(c, lv, t);
    case "boneRack":
      return boneRack(c, cols, lv);
    case "trainingRing":
      return trainingRing(c, cols, lv, t);
    case "dragonAltar":
      return dragonAltar(c, clan, cols, t, night);
    case "dinoPen":
      return dinoPen(c, cols, lv);
  }
}

function longhouse(c: CanvasRenderingContext2D, cols: string[], lv: number, t: number) {
  const L = 76 + lv * 22;
  const h = 34 + lv * 5;
  // hide-covered hall on bent poles
  const g = c.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, shade(HIDE, 0.12));
  g.addColorStop(1, shade(HIDE, -0.18));
  c.fillStyle = g;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-L / 2, 0);
  c.lineTo(-L / 2, -h * 0.55);
  c.quadraticCurveTo(-L / 2, -h, -L / 2 + 16, -h);
  c.lineTo(L / 2 - 16, -h);
  c.quadraticCurveTo(L / 2, -h, L / 2, -h * 0.55);
  c.lineTo(L / 2, 0);
  c.closePath();
  c.fill();
  c.stroke();
  // pole ribs + stitched hide panels
  c.strokeStyle = shade(HIDE, -0.35);
  c.lineWidth = 1.4;
  for (let x = -L / 2 + 14; x < L / 2 - 6; x += 16) {
    c.beginPath();
    c.moveTo(x, -h + 1);
    c.lineTo(x, -1);
    c.stroke();
  }
  // a band in the clan's colours along the ridge
  cols.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(-L / 2 + 18, -h + 4 + i * 3, L - 36, 3);
  });
  // doorway
  c.fillStyle = "#2a1c12";
  c.beginPath();
  c.moveTo(-9, 0);
  c.lineTo(-9, -15);
  c.quadraticCurveTo(0, -24, 9, -15);
  c.lineTo(9, 0);
  c.fill();
  // crossed tusks at both ends
  c.strokeStyle = "#efe6cf";
  c.lineWidth = 4;
  c.lineCap = "round";
  for (const k of [-1, 1]) {
    c.beginPath();
    c.moveTo(k * (L / 2 - 4), -h + 2);
    c.quadraticCurveTo(k * (L / 2 + 10), -h - 12, k * (L / 2 + 2), -h - 22);
    c.stroke();
  }
  // smoke from the roof hole
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.4 + i / 3) % 1;
    c.fillStyle = `rgba(110,105,100,${0.28 * (1 - k)})`;
    c.beginPath();
    c.arc(8 + k * 10, -h - 6 - k * 40, 4 + k * 8, 0, Math.PI * 2);
    c.fill();
  }
}

function smokehouse(c: CanvasRenderingContext2D, lv: number, t: number) {
  const racks = lv >= 2 ? [-26, 26] : [0];
  for (const x0 of racks) {
    post(c, x0 - 22, 0, -42);
    post(c, x0 + 22, 0, -42);
    post(c, x0 - 22, -38, -38, 3);
    c.strokeStyle = WOOD;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0 - 24, -38);
    c.lineTo(x0 + 24, -38);
    c.stroke();
    // strips of meat drying
    for (let i = 0; i < 5; i++) {
      const x = x0 - 16 + i * 8;
      const sw = Math.sin(t * 1.5 + i) * 1;
      c.fillStyle = i % 2 ? "#8a2f22" : "#a5432e";
      c.beginPath();
      c.moveTo(x - 2, -38);
      c.lineTo(x + 2, -38);
      c.lineTo(x + 2.5 + sw, -22);
      c.lineTo(x - 1.5 + sw, -20);
      c.closePath();
      c.fill();
    }
  }
  if (lv >= 2) {
    // a hide roof over both racks
    c.fillStyle = shade(HIDE, -0.05);
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-56, -40);
    c.lineTo(0, -60);
    c.lineTo(56, -40);
    c.closePath();
    c.fill();
    c.stroke();
  }
  // a smouldering fire underneath
  c.fillStyle = "#3a2a1c";
  c.beginPath();
  c.ellipse(0, -2, 12, 4, 0, 0, Math.PI * 2);
  c.fill();
  drawFlame(c, 0, -3, 0.45, t);
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.35 + i / 4) % 1;
    c.fillStyle = `rgba(120,115,110,${0.35 * (1 - k)})`;
    c.beginPath();
    c.arc(Math.sin(k * 6 + i) * 8, -10 - k * 60, 5 + k * 9, 0, Math.PI * 2);
    c.fill();
  }
}

function boneRack(c: CanvasRenderingContext2D, cols: string[], lv: number) {
  const w = 34 + lv * 12;
  // an A-frame of poles
  post(c, -w, 0, -40);
  post(c, w, 0, -40);
  c.strokeStyle = WOOD;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-w - 2, -36);
  c.lineTo(w + 2, -36);
  c.stroke();
  // spears + bone clubs leaning on the bar
  for (let i = 0; i < 4 + lv * 2; i++) {
    const x = -w + 8 + i * ((w * 2 - 16) / (3 + lv * 2));
    if (i % 2) bone(c, x - 4, -2, x + 2, -40, 3.4);
    else {
      c.strokeStyle = WOOD;
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(x - 5, 0);
      c.lineTo(x + 3, -50);
      c.stroke();
      c.fillStyle = BONE;
      c.beginPath();
      c.moveTo(x + 3, -50);
      c.lineTo(x + 6, -58);
      c.lineTo(x + 1, -53);
      c.fill();
    }
  }
  skull(c, -w, -46, 0.7);
  skull(c, w, -46, 0.7, lv >= 2);
  if (lv >= 2) {
    // a pair of mammoth tusks crossed over the top
    c.strokeStyle = "#efe6cf";
    c.lineWidth = 5;
    c.lineCap = "round";
    for (const k of [-1, 1]) {
      c.beginPath();
      c.moveTo(k * 18, -38);
      c.quadraticCurveTo(k * -4, -66, k * -22, -60);
      c.stroke();
    }
  }
  clanFlag(c, cols, w, -64, 14, 9, 1);
  post(c, w, -40, -64, 2);
}

function trainingRing(c: CanvasRenderingContext2D, cols: string[], lv: number, t: number) {
  const rx = 50 + lv * 6;
  const ry = 22 + lv * 3;
  c.fillStyle = "rgba(206,180,128,0.6)";
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  // short stakes round the edge (back half, then the dummy, then the front half)
  const stake = (a: number) => {
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    post(c, x, y, y - 12, 3);
  };
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.sin(a) < 0) stake(a);
  }
  // a hide sparring dummy on a post (it wobbles from the blows)
  const wob = Math.sin(t * 5) * 0.08;
  c.save();
  c.translate(-rx * 0.45, 2);
  c.rotate(wob);
  post(c, 0, 0, -34, 4);
  c.fillStyle = HIDE;
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(0, -26, 9, 12, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#d8b56a";
  c.beginPath();
  c.arc(0, -42, 6, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = cols[0];
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-8, -28);
  c.lineTo(8, -24);
  c.stroke();
  c.restore();
  if (lv >= 2) {
    // a log to lift + a bone dummy
    c.fillStyle = WOOD;
    c.strokeStyle = INK;
    c.beginPath();
    c.ellipse(rx * 0.4, 4, 16, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    bone(c, rx * 0.15, 0, rx * 0.15, -26, 4);
    skull(c, rx * 0.15, -30, 0.6);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.sin(a) >= 0) stake(a);
  }
}

/** A fence of the dino bones they've collected, right round the camp: ribs, tusks, skulls on posts. */
function boneFence(c: CanvasRenderingContext2D, clan: Clan, cols: string[], lv: number, part: "back" | "front") {
  const { rx, ry } = fenceSize(clan);
  const n = 46 + lv * 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const front = Math.sin(a) >= 0;
    if ((part === "front") !== front) continue;
    // the gate: a gap at the front
    if (Math.abs(a - Math.PI / 2) < 0.12) continue;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    const h = 26 + (i % 3) * 5 + lv * 6;
    if (i % 7 === 0) {
      post(c, x, y, y - h - 6, 4, BONE);
      skull(c, x, y - h - 10, 0.55, lv >= 2 && i % 14 === 0);
    } else if (i % 2) {
      // a curved rib
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + (x > 0 ? 8 : -8), y - h * 0.6, x + (x > 0 ? 2 : -2), y - h);
      c.stroke();
      c.strokeStyle = BONE;
      c.lineWidth = 3.4;
      c.stroke();
    } else bone(c, x, y, x, y - h * 0.85, 3.4);
  }
  // lashed rails between them (two at level 2)
  c.strokeStyle = "rgba(122,85,48,0.9)";
  c.lineWidth = 2;
  for (const hy of lv >= 2 ? [-10, -22] : [-12]) {
    c.beginPath();
    let first = true;
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const front = Math.sin(a) >= 0;
      if ((part === "front") !== front || Math.abs(a - Math.PI / 2) < 0.14) {
        first = true;
        continue;
      }
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry + hy;
      if (first) c.moveTo(x, y);
      else c.lineTo(x, y);
      first = false;
    }
    c.stroke();
  }
  // gate posts with the clan's banner
  if (part === "front") {
    for (const k of [-1, 1]) {
      const a = Math.PI / 2 + k * 0.14;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      post(c, x, y, y - 54, 5, BONE);
      skull(c, x, y - 58, 0.7, true);
      clanFlag(c, cols, x, y - 50, 16 * k, 11, 1);
    }
  }
}

/** Carved bone totems: stacked skulls + vertebrae, painted in the clan's colours. */
function boneTotems(c: CanvasRenderingContext2D, cols: string[], lv: number, t: number) {
  const spots: [number, number, number][] = [[0, 0, 1], [-40, 14, 0.8], [38, 18, 0.85]];
  for (let i = 0; i < Math.min(lv, 3); i++) {
    const [x, y, s] = spots[i];
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    post(c, 0, 0, -64, 9, "#d9cfb3");
    for (let k = 0; k < 4; k++) {
      c.fillStyle = cols[k % cols.length];
      c.fillRect(-6, -12 - k * 12, 12, 3);
    }
    skull(c, 0, -30, 0.8);
    skull(c, 0, -52, 0.9, true);
    skull(c, 0, -74, 1.1, true);
    // feathers + a flickering offering bowl at the foot
    c.strokeStyle = cols[0];
    c.lineWidth = 2;
    for (const k of [-1, 1]) {
      c.beginPath();
      c.moveTo(k * 8, -82);
      c.lineTo(k * 14, -96 + Math.sin(t * 3 + k) * 2);
      c.stroke();
    }
    c.restore();
  }
}

function dinoPen(c: CanvasRenderingContext2D, cols: string[], lv: number) {
  const rx = 78 + lv * 16;
  const ry = 34 + lv * 7;
  c.fillStyle = "rgba(120,96,60,0.35)";
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  // a ring of log posts lashed with rails, mammoth ribs at every other post, a gap for a gate
  const n = 18 + lv * 4;
  const pt = (i: number) => {
    const a = (i / n) * Math.PI * 2;
    return { x: Math.cos(a) * rx, y: Math.sin(a) * ry, gate: Math.abs(a - Math.PI / 2) < 0.22 };
  };
  c.strokeStyle = "#6a4a2a";
  c.lineWidth = 3;
  for (const h of [-8, -16]) {
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = pt(i % n);
      const q = pt((i + 1) % n);
      if (p.gate || q.gate) continue;
      c.moveTo(p.x, p.y + h);
      c.lineTo(q.x, q.y + h);
    }
    c.stroke();
  }
  for (let i = 0; i < n; i++) {
    const p = pt(i);
    if (p.gate) continue;
    if (i % 2 && lv >= 1) bone(c, p.x, p.y, p.x + (p.x > 0 ? 3 : -3), p.y - 24, 3);
    else post(c, p.x, p.y, p.y - 22, 4);
  }
  // a water trough + a heap of fodder
  c.fillStyle = "#6a4a2a";
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.fillRect(-rx * 0.5, -6, 34, 9);
  c.strokeRect(-rx * 0.5, -6, 34, 9);
  c.fillStyle = "#5aa0c8";
  c.fillRect(-rx * 0.5 + 3, -4, 28, 4);
  c.fillStyle = "#9a8a3e";
  c.beginPath();
  c.ellipse(rx * 0.45, -2, 16, 7, 0, 0, Math.PI * 2);
  c.fill();
  // the clan banner over the gate
  post(c, -14, ry, ry - 40, 4);
  post(c, 14, ry, ry - 40, 4);
  c.strokeStyle = WOOD;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-16, ry - 38);
  c.lineTo(16, ry - 38);
  c.stroke();
  skull(c, 0, ry - 44, 0.6, true);
  clanFlag(c, cols, 14, ry - 40, 14, 10, 1);
}

function dragonAltar(c: CanvasRenderingContext2D, clan: Clan, cols: string[], t: number, night: boolean) {
  // the dancing ring, stamped bare
  c.strokeStyle = "rgba(80,58,36,0.45)";
  c.lineWidth = 6;
  c.beginPath();
  c.ellipse(0, 6, 76, 38, 0, 0, Math.PI * 2);
  c.stroke();
  // a tall bone pillar behind, crowned with a horned dragon skull
  post(c, 0, -14, -86, 7, BONE);
  for (let y = -26; y > -84; y -= 12) {
    c.strokeStyle = cols[(Math.abs(y) / 12) % cols.length | 0];
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-4, y);
    c.lineTo(4, y - 3);
    c.stroke();
  }
  // a dragon skull: long snout, big eye sockets, swept horns
  c.save();
  c.translate(0, -96);
  c.fillStyle = BONE;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-16, -6);
  c.quadraticCurveTo(-4, -18, 14, -10);
  c.lineTo(34, -4);
  c.lineTo(34, 2);
  c.lineTo(10, 6);
  c.quadraticCurveTo(-10, 10, -16, -6);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(4, -6, 4, 3, 0, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 5; i++) {
    c.fillStyle = BONE;
    c.beginPath();
    c.moveTo(14 + i * 4, 2);
    c.lineTo(16 + i * 4, 7);
    c.lineTo(18 + i * 4, 2);
    c.fill();
  }
  c.strokeStyle = "#d8cfb5";
  c.lineWidth = 3.4;
  c.lineCap = "round";
  for (const k of [0, 6]) {
    c.beginPath();
    c.moveTo(-10 + k, -10);
    c.quadraticCurveTo(-26 + k, -26, -18 + k, -40);
    c.stroke();
  }
  // its eyes glow at night
  if (night) {
    c.fillStyle = `rgba(255,120,40,${0.6 + Math.sin(t * 3) * 0.3})`;
    c.beginPath();
    c.arc(4, -6, 2.4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  // bone posts with banners either side
  for (const k of [-1, 1]) {
    post(c, k * 58, -2, -54, 4, BONE);
    clanFlag(c, cols, k * 58, -54, 18 * k, 12, Math.sin(t * 3 + k) * 2);
    skull(c, k * 58, -58, 0.55, true);
  }
  // fire bowls
  for (const k of [-1, 1]) {
    c.fillStyle = "#5c5a58";
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(k * 36 - 9, -10);
    c.lineTo(k * 36 + 9, -10);
    c.lineTo(k * 36 + 5, -2);
    c.lineTo(k * 36 - 5, -2);
    c.closePath();
    c.fill();
    c.stroke();
    post(c, k * 36, -2, 4, 3, "#5c5a58");
    drawFlame(c, k * 36, -11, 0.7, t + k);
  }
  // the stone slab on two stones (the offering is tied here)
  c.fillStyle = "#7d7a74";
  c.strokeStyle = INK;
  c.lineWidth = 2;
  for (const k of [-1, 1]) {
    c.beginPath();
    c.ellipse(k * 16, 0, 9, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  const g = c.createLinearGradient(0, -14, 0, -2);
  g.addColorStop(0, "#a8a49c");
  g.addColorStop(1, "#7f7b74");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-30, -6);
  c.lineTo(-26, -14);
  c.lineTo(28, -14);
  c.lineTo(32, -6);
  c.lineTo(28, -2);
  c.lineTo(-28, -2);
  c.closePath();
  c.fill();
  c.stroke();
  // rope tie-posts
  c.strokeStyle = "#b89a62";
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-22, -10);
  c.lineTo(-18, -2);
  c.moveTo(22, -10);
  c.lineTo(18, -2);
  c.stroke();
  // old stains on the stone; fresh blood after an offering
  const fresh = clan.altarBlood ?? 0;
  const old = clan.favor !== undefined || fresh > 0 ? 0.35 : 0;
  const a = Math.max(old, fresh);
  if (a > 0) {
    c.fillStyle = `rgba(${fresh > 0.3 ? 150 : 90},${fresh > 0.3 ? 14 : 20},${fresh > 0.3 ? 22 : 20},${a})`;
    for (const [x, y, rx, ry] of [[-6, -9, 12, 3.4], [10, -8, 7, 2.5], [-2, 2, 18, 4], [20, 4, 7, 2.6], [-24, 6, 6, 2]]) {
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0.1, 0, Math.PI * 2);
      c.fill();
    }
    if (fresh > 0.3) {
      // drips down the slab's edge
      c.fillStyle = `rgba(170,16,26,${fresh})`;
      for (const x of [-12, 4, 16]) {
        c.beginPath();
        c.ellipse(x, -3 + Math.sin(t + x) * 0.5, 1.4, 3, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
}

/** A pit trap: a patch of loose leaves + twigs (hard to spot), or an open pit once someone's fallen in. */
export function drawClanTrap(c: CanvasRenderingContext2D, trap: ClanTrap) {
  if (trap.caught) {
    c.fillStyle = "#2a1d12";
    c.beginPath();
    c.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#6a4a2a";
    c.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[-20, -2, -8, 3], [6, -6, 18, 2], [-4, 6, 10, 9]]) {
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
    }
    return;
  }
  // only a slightly-too-neat patch of leaves gives it away
  c.fillStyle = "rgba(96,120,58,0.55)";
  c.beginPath();
  c.ellipse(0, 0, 17, 7, 0, 0, Math.PI * 2);
  c.fill();
  const leaves: [number, number, number, string][] = [[-10, -1, 0.4, "#6f8f3e"], [-2, 2, -0.3, "#87a24c"], [7, -2, 0.8, "#5f7f36"], [12, 2, -0.6, "#8a9a46"], [-5, -4, 1.2, "#7a9a48"], [2, -1, 2.2, "#a08a3e"]];
  for (const [x, y, a, col] of leaves) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(0, 0, 4.4, 2, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  c.strokeStyle = "#6a4a2a";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-14, 2);
  c.lineTo(-4, -3);
  c.moveTo(4, 3);
  c.lineTo(14, -1);
  c.stroke();
}

/** Part of our town a clan is holding: their banner planted in it, the ground trampled, wreckage about. */
export function drawClanHold(c: CanvasRenderingContext2D, hold: ClanHold, clan: Clan | null, t: number) {
  const cols = clan ? colorsOf(clan) : ["#c0392b"];
  c.strokeStyle = "rgba(200,40,40,0.35)";
  c.lineWidth = 3;
  c.setLineDash([10, 8]);
  c.beginPath();
  c.ellipse(0, 0, hold.r, hold.r * 0.55, 0, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  // wreckage
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + hold.id;
    const x = Math.cos(a) * hold.r * (0.3 + (i % 3) * 0.2);
    const y = Math.sin(a) * hold.r * 0.4 * (0.4 + (i % 2) * 0.4);
    c.strokeStyle = i % 2 ? "#6a4a2a" : "#8a6238";
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x - 6, y);
    c.lineTo(x + 6, y - 3 + (i % 3));
    c.stroke();
  }
  // their banner on a bone pole, a skull on top
  post(c, 0, 0, -70, 5, BONE);
  skull(c, 0, -74, 0.75, true);
  clanFlag(c, cols, 0, -66, 30, 20, Math.sin(t * 3 + hold.id) * 3);
  // how hungry they are (a little food bar)
  const k = Math.max(0, Math.min(1, hold.food / 25));
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.fillRect(-20, 8, 40, 5);
  c.fillStyle = k > 0.3 ? "#e0a040" : "#e05040";
  c.fillRect(-20, 8, 40 * k, 5);
  if (hold.cut) {
    c.font = "12px sans-serif";
    c.textAlign = "center";
    c.fillText("⛺", 0, 26);
  }
}
