/* ------------------------------------------------------------------ */
/*  Joined-up structures: pens that touch are drawn as one big         */
/*  paddock, neighbouring farm plots as one big field. Each piece      */
/*  still works on its own in the sim; only the drawing merges them.   */
/* ------------------------------------------------------------------ */
import type { Farm } from "../sim/types";

/** Union-find over a list: items joined when `near(a, b)`. Returns groups of indices. */
export function clusters<T>(items: T[], near: (a: T, b: T) => boolean): number[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (near(items[i], items[j])) parent[find(i)] = find(j);
  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  });
  return Array.from(groups.values());
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

/* ------------------------------ the paddock ------------------------------ */

/**
 * A big animal paddock covering W×H (origin: top-left). Hay + trampled earth inside, a water
 * trough and hay bales (more for bigger paddocks), a lean-to shelter, and a two-rail fence with a
 * swinging gate on the south side.
 */
export function drawPaddock(c: CanvasRenderingContext2D, W: number, H: number, n: number, t: number, seed: number) {
  const pad = 4;
  // ground
  c.fillStyle = "rgba(196,170,90,0.42)";
  c.beginPath();
  c.roundRect(pad, pad + 6, W - pad * 2, H - pad * 2 - 4, 10);
  c.fill();
  // trampled earth + straw
  for (let i = 0; i < 6 + n * 3; i++) {
    const x = pad + 14 + hash(seed + i) * (W - pad * 2 - 28);
    const y = pad + 16 + hash(seed + i * 3.1) * (H - pad * 2 - 30);
    c.fillStyle = i % 3 ? "rgba(122,90,58,0.28)" : "rgba(150,120,70,0.3)";
    c.beginPath();
    c.ellipse(x, y, 10 + hash(seed + i * 7) * 16, 5 + hash(seed + i * 5) * 6, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "rgba(230,205,130,0.75)";
  c.lineWidth = 1;
  for (let i = 0; i < 14 + n * 6; i++) {
    const x = pad + 10 + hash(seed + i * 1.7) * (W - pad * 2 - 20);
    const y = pad + 14 + hash(seed + i * 2.3) * (H - pad * 2 - 24);
    const a = hash(seed + i) * Math.PI;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 2);
    c.stroke();
  }
  // a path in from the gate
  const gx = W / 2;
  c.fillStyle = "rgba(122,90,58,0.35)";
  c.beginPath();
  c.moveTo(gx - 12, H - pad);
  c.quadraticCurveTo(gx - 6, H * 0.55, gx + 18, H * 0.4);
  c.lineTo(gx + 26, H * 0.46);
  c.quadraticCurveTo(gx + 8, H * 0.62, gx + 12, H - pad);
  c.closePath();
  c.fill();

  // lean-to shelter in the back corner (bigger paddocks)
  if (n >= 2) {
    const sx = W - pad - 58;
    const sy = pad + 8;
    c.fillStyle = "#5e3f24";
    c.fillRect(sx + 4, sy + 6, 3, 26);
    c.fillRect(sx + 48, sy + 6, 3, 26);
    c.fillStyle = "#3b2a1a";
    c.fillRect(sx + 6, sy + 12, 44, 20);
    c.fillStyle = "#a27845";
    c.beginPath();
    c.moveTo(sx, sy + 12);
    c.lineTo(sx + 8, sy);
    c.lineTo(sx + 52, sy);
    c.lineTo(sx + 56, sy + 12);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(60,40,20,0.5)";
    c.lineWidth = 1;
    for (let x = sx + 12; x < sx + 52; x += 7) {
      c.beginPath();
      c.moveTo(x, sy + 1);
      c.lineTo(x - 2, sy + 11);
      c.stroke();
    }
  }
  // water trough (stone) + hay bales
  const tx = pad + 18;
  const ty = H * 0.38;
  c.fillStyle = "#857d72";
  c.beginPath();
  c.roundRect(tx, ty, 34, 10, 3);
  c.fill();
  c.fillStyle = `rgba(110,170,220,${0.75 + Math.sin(t * 2) * 0.05})`;
  c.fillRect(tx + 3, ty + 2, 28, 4);
  const bales = Math.min(6, 1 + n);
  for (let i = 0; i < bales; i++) {
    const bx = pad + 22 + ((i * 41 + seed * 13) % Math.max(40, W - 70));
    const by = H * 0.62 + (i % 2) * 14;
    c.fillStyle = "#d8bd62";
    c.beginPath();
    c.roundRect(bx, by, 16, 10, 3);
    c.fill();
    c.strokeStyle = "#a88a3c";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(bx + 5, by);
    c.lineTo(bx + 5, by + 10);
    c.moveTo(bx + 11, by);
    c.lineTo(bx + 11, by + 10);
    c.stroke();
  }

  // the fence: back + sides first, then the front with its gate
  const post = (x: number, y: number) => {
    c.fillStyle = "#5e3f24";
    c.fillRect(x - 2, y - 13, 4, 15);
    c.fillStyle = "#7a5230";
    c.fillRect(x - 2, y - 13, 4, 2);
  };
  const rail = (x0: number, y0: number, x1: number, y1: number) => {
    c.strokeStyle = "#7a5230";
    c.lineWidth = 2.4;
    c.lineCap = "round";
    for (const dy of [-10, -4]) {
      c.beginPath();
      c.moveTo(x0, y0 + dy);
      c.lineTo(x1, y1 + dy);
      c.stroke();
    }
    c.lineCap = "butt";
  };
  const L = pad;
  const R = W - pad;
  const T = pad + 8;
  const B = H - pad;
  const step = 20;
  rail(L, T, R, T);
  for (let x = L; x <= R + 0.5; x += (R - L) / Math.max(1, Math.round((R - L) / step))) post(x, T);
  rail(L, T, L, B);
  rail(R, T, R, B);
  for (let y = T; y <= B + 0.5; y += (B - T) / Math.max(1, Math.round((B - T) / step))) {
    post(L, y);
    post(R, y);
  }
  // front fence with a gate gap in the middle
  const g0 = gx - 16;
  const g1 = gx + 16;
  rail(L, B, g0, B);
  rail(g1, B, R, B);
  for (let x = L; x <= g0; x += (g0 - L) / Math.max(1, Math.round((g0 - L) / step))) post(x, B);
  for (let x = g1; x <= R + 0.5; x += (R - g1) / Math.max(1, Math.round((R - g1) / step))) post(x, B);
  // the gate, swung half open
  c.strokeStyle = "#8a6238";
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(g0, B - 10);
  c.lineTo(g0 + 14, B - 4);
  c.moveTo(g0, B - 4);
  c.lineTo(g0 + 14, B + 2);
  c.moveTo(g0, B - 10);
  c.lineTo(g0 + 14, B + 2);
  c.stroke();
}

/* ------------------------------ seating ring ------------------------------ */

/**
 * Big log seats in a ring round a campfire (origin: the fire). Each log lies along the ring
 * (so everyone faces the fire), on a trodden clearing; the view squashes the circle.
 */
export function drawSeatRing(c: CanvasRenderingContext2D, R: number, n: number, seed: number) {
  const sq = 0.55;
  // trodden clearing
  c.fillStyle = "rgba(122,94,58,0.3)";
  c.beginPath();
  c.ellipse(0, 2, R + 24, (R + 24) * sq, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(150,118,74,0.22)";
  c.beginPath();
  c.ellipse(0, 2, R - 16, (R - 16) * sq, 0, 0, Math.PI * 2);
  c.fill();
  // back logs first, front logs last
  const logs = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + 0.4).sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of logs) {
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R * sq + 2;
    const rot = Math.atan2(Math.cos(a) * sq, -Math.sin(a));
    const len = 34 + hash(seed + a) * 6;
    const th = 11;
    c.save();
    c.translate(x, y);
    // shadow
    c.fillStyle = "rgba(30,20,10,0.25)";
    c.beginPath();
    c.ellipse(1, th * 0.45, len * 0.55, th * 0.45, rot, 0, Math.PI * 2);
    c.fill();
    c.rotate(rot);
    // the log: a rounded body, bark lines, a cut end with growth rings
    const g = c.createLinearGradient(0, -th / 2, 0, th / 2);
    g.addColorStop(0, "#9a6b3f");
    g.addColorStop(0.5, "#7a5230");
    g.addColorStop(1, "#5a3a20");
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(-len / 2, -th / 2 - 2, len, th, th / 2);
    c.fill();
    c.strokeStyle = "rgba(50,30,15,0.45)";
    c.lineWidth = 1;
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(k * 6 - 3, -th / 2 + 1);
      c.lineTo(k * 6 + 2, th / 2 - 4);
      c.stroke();
    }
    for (const end of [-1, 1]) {
      c.fillStyle = "#d9b07a";
      c.beginPath();
      c.ellipse((end * len) / 2, -2, 3.2, th / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#a07848";
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse((end * len) / 2, -2, 1.6, th / 4, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // a worn, lighter seat on top
    c.fillStyle = "rgba(255,230,190,0.18)";
    c.beginPath();
    c.roundRect(-len / 2 + 5, -th / 2 - 1, len - 10, 3, 1.5);
    c.fill();
    c.restore();
  }
}

/* ------------------------------ the big field ------------------------------ */

/**
 * One big field covering the farms in a cluster (origin: world). A soil bed with furrows right
 * across, a low wattle fence round it, and the crops: each spot grows whatever the nearest plot
 * is growing (at that plot's stage), so the separate plots read as one field.
 */
export function drawField(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, farms: Farm[], t: number) {
  const W = x1 - x0;
  const H = y1 - y0;
  // bed
  c.fillStyle = "#6b4d31";
  c.beginPath();
  c.roundRect(x0 - 3, y0 - 3, W + 6, H + 6, 12);
  c.fill();
  c.fillStyle = "#7a5a3a";
  c.beginPath();
  c.roundRect(x0, y0, W, H, 10);
  c.fill();
  // furrows right across the whole field
  c.strokeStyle = "#5f4329";
  c.lineWidth = 2;
  for (let y = y0 + 7; y < y1 - 3; y += 9) {
    c.beginPath();
    c.moveTo(x0 + 6, y);
    c.lineTo(x1 - 6, y);
    c.stroke();
  }
  // crops
  for (let y = y0 + 7; y < y1 - 3; y += 9) {
    for (let x = x0 + 8; x < x1 - 6; x += 9) {
      let f: Farm | null = null;
      let bd = 70;
      for (const o of farms) {
        const d = Math.hypot(o.x - x, (o.y - y) * 1.4);
        if (d < bd) {
          bd = d;
          f = o;
        }
      }
      if (!f || !f.planted) continue;
      const g = f.growth;
      const crop = f.crop ?? "wheat";
      const i = Math.round(x / 9);
      const r = Math.round(y / 9);
      const hgt = 3 + g * 14;
      const sway = Math.sin(t * 2 + i + r) * g * 1.5;
      c.strokeStyle = crop === "barley" ? (g < 0.8 ? "#789747" : "#c1b66b") : g < 0.8 ? "#6aa83a" : "#a7a33a";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + sway, y - hgt);
      c.stroke();
      if (g >= 0.7) {
        c.fillStyle = crop === "flower" ? ["#f48fb1", "#fff176", "#ce93d8", "#ffab91"][(i + r) & 3] : crop === "barley" ? (g >= 1 ? "#d6c987" : "#bdb06f") : g >= 1 ? "#f2c94c" : "#c9b14a";
        c.beginPath();
        c.ellipse(x + sway, y - hgt - 2, crop === "flower" ? 2.8 : 1.8, crop === "flower" ? 2.8 : 3.6, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  // low wattle fence round the edge
  c.strokeStyle = "#8a6238";
  c.lineWidth = 1.6;
  for (let x = x0; x <= x1; x += 14) {
    c.beginPath();
    c.moveTo(x, y0 - 2);
    c.lineTo(x, y0 - 9);
    c.moveTo(x, y1 + 2);
    c.lineTo(x, y1 - 5);
    c.stroke();
  }
  c.strokeStyle = "#a07848";
  c.lineWidth = 1.4;
  for (const yy of [y0 - 6, y1 - 2]) {
    c.beginPath();
    for (let x = x0; x <= x1; x += 7) {
      const y = yy + ((x / 7) % 2 ? 1 : -1);
      if (x === x0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  // a scarecrow keeps watch over a big field
  if (farms.length >= 3) {
    const sx = (x0 + x1) / 2;
    const sy = (y0 + y1) / 2;
    c.strokeStyle = "#5e3f24";
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(sx, sy + 6);
    c.lineTo(sx, sy - 26);
    c.moveTo(sx - 12, sy - 18);
    c.lineTo(sx + 12, sy - 18);
    c.stroke();
    c.fillStyle = "#b5523a";
    c.fillRect(sx - 6, sy - 20, 12, 12);
    c.fillStyle = "#e6c98a";
    c.beginPath();
    c.arc(sx, sy - 29, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#7a5230";
    c.fillRect(sx - 7, sy - 34, 14, 3);
    c.fillRect(sx - 4, sy - 39, 8, 5);
  }
  // ripe: a sparkle over the field
  if (farms.some((f) => f.planted && f.growth >= 1)) {
    const a = (Math.sin(t * 3) + 1) / 2;
    c.fillStyle = `rgba(255,250,200,${0.35 + a * 0.4})`;
    c.font = "10px serif";
    c.textAlign = "center";
    c.fillText("✦", x1 - 10, y0 - 4);
  }
}

/**
 * Neighbouring vineyard plots as one vineyard: long trellis rows right across the block (posts + wires),
 * vines leafing out along them at each plot's stage, purple bunches where a plot is ripe, a fence round it.
 */
export function drawVineyardField(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, farms: Farm[], t: number) {
  const W = x1 - x0;
  const H = y1 - y0;
  c.fillStyle = "#5f4529";
  c.beginPath();
  c.roundRect(x0 - 3, y0 - 3, W + 6, H + 6, 12);
  c.fill();
  c.fillStyle = "#6e5233";
  c.beginPath();
  c.roundRect(x0, y0, W, H, 10);
  c.fill();
  const near = (x: number, y: number) => {
    let f: Farm | null = null;
    let bd = 80;
    for (const o of farms) {
      const d = Math.hypot(o.x - x, (o.y - y) * 1.4);
      if (d < bd) {
        bd = d;
        f = o;
      }
    }
    return f;
  };
  for (let y = y0 + 14; y < y1 - 2; y += 13) {
    // furrow
    c.strokeStyle = "#5a4128";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0 + 5, y + 2);
    c.lineTo(x1 - 5, y + 2);
    c.stroke();
    if (!farms.some((f) => f.planted)) continue;
    // posts every so often + one long wire
    c.strokeStyle = "#8a6a44";
    c.lineWidth = 1.6;
    for (let x = x0 + 8; x <= x1 - 8; x += 28) {
      c.beginPath();
      c.moveTo(x, y + 2);
      c.lineTo(x, y - 11);
      c.stroke();
    }
    c.strokeStyle = "rgba(70,60,50,0.7)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x0 + 8, y - 10);
    c.lineTo(x1 - 8, y - 10);
    c.stroke();
    for (let x = x0 + 10; x < x1 - 8; x += 7) {
      const f = near(x, y);
      if (!f || !f.planted) continue;
      const g = Math.max(0.15, f.growth);
      if (((x / 7) | 0) % Math.max(1, Math.round(3 - g * 2)) !== 0) continue;
      const i = Math.round(x / 7);
      const sway = Math.sin(t * 1.6 + i + y) * 0.8;
      c.fillStyle = i % 3 === 0 ? "#4f8a32" : "#5f9e3a";
      c.beginPath();
      c.ellipse(x + sway, y - 9 + (i % 2) * 2, 2.4 + g * 1.6, 2 + g * 1.2, 0.4, 0, Math.PI * 2);
      c.fill();
      if (f.growth >= 0.6 && i % 2 === 0) {
        c.fillStyle = f.growth >= 1 ? "#6a2c8e" : "#8faa4a";
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.arc(x + sway + (k % 2) * 1.6 - 0.8, y - 5 + Math.floor(k / 2) * 1.6, 1.1, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }
  // a low wattle fence round the vineyard
  c.strokeStyle = "#8a6238";
  c.lineWidth = 1.6;
  for (let x = x0; x <= x1; x += 14) {
    c.beginPath();
    c.moveTo(x, y0 - 2);
    c.lineTo(x, y0 - 9);
    c.moveTo(x, y1 + 2);
    c.lineTo(x, y1 - 5);
    c.stroke();
  }
  if (farms.some((f) => f.planted && f.growth >= 1)) {
    const a = (Math.sin(t * 3) + 1) / 2;
    c.fillStyle = `rgba(220,170,255,${0.35 + a * 0.4})`;
    c.font = "10px serif";
    c.textAlign = "center";
    c.fillText("✦", x1 - 10, y0 - 4);
  }
}
