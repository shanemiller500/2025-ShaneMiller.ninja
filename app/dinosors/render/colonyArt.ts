/* ------------------------------------------------------------------ */
/*  Colony art: connected walls (+ gates, stairs), towers, homes from  */
/*  tent to stone house, workshops, Scorpions, deposits and dragons.   */
/*  Everything is painted in code (no image assets) so it stays crisp  */
/*  at every zoom. Each function draws with (0,0) at the object's base */
/*  centre unless noted.                                               */
/* ------------------------------------------------------------------ */
import type { Building, Dragon, ResNode, Scorpion, Shelter, Wall } from "../sim/types";
import { HOUSING, NODES } from "../data/colony";
import { shade } from "./drawDino";
import { drawCivNode, polyBlocks } from "./civArt";
import { drawPolygonHouse } from "./metalArt";
import { CIV_NODES } from "../data/colony";

const OUT = "rgba(30,22,16,0.55)";
const T = 32;

/* ------------------------------ walls ------------------------------ */

/** neighbours: N=1, E=2, S=4, W=8 (any wall part except stairs connects) */
export interface WallLook {
  mask: number;
  hpFrac: number;
  /** gate swing 0 (shut) … 1 (open) */
  swing: number;
  t: number;
}

const WALL_H = { palisade: 30, stone: 26, polygon: 30 } as const;

function seeded(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * One wall tile. Walls are narrow: a centre post plus "arms" reaching
 * toward connected neighbours (N/E/S/W), so runs in any direction join
 * into one continuous wall. Each piece has a walkway on top (people
 * stand on it) and a front face wherever its south side is open.
 * Origin: bottom-centre of the tile.
 */
export function drawWall(c: CanvasRenderingContext2D, wl: Wall, look: WallLook) {
  const stone = wl.kind !== "palisade";
  const poly = wl.kind === "polygon";
  const built = Math.max(0, Math.min(1, wl.built));
  if (built < 1) {
    // blueprint: a faint ghost of the wall, marked out with stakes + string
    c.fillStyle = stone || wl.upgrade ? "rgba(220,215,205,0.22)" : "rgba(210,170,110,0.22)";
    c.fillRect(-T / 2 + 5, -T / 2 - 6, T - 10, 12);
    c.strokeStyle = "rgba(255,245,220,0.55)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(-T / 2 + 5, -T / 2 - 6);
    c.lineTo(T / 2 - 5, -T / 2 - 6);
    c.moveTo(-T / 2 + 5, -T / 2 + 6);
    c.lineTo(T / 2 - 5, -T / 2 + 6);
    c.stroke();
    c.fillStyle = "#8a6238";
    for (const x of [-T / 2 + 5, T / 2 - 5]) c.fillRect(x - 1, -T / 2 - 10, 2, 8);
    if (wl.have > 0) {
      c.fillStyle = stone || wl.upgrade ? "#9d978d" : "#8a6238";
      for (let i = 0; i < wl.have; i++) c.fillRect(-10 + i * 7, -8, 6, 4);
    }
    if (built <= 0.02) return;
  }
  if (wl.part === "stairs") return drawStairs(c, wl, look, built);
  const h = WALL_H[wl.kind] * built;
  const { mask } = look;
  const N = (mask & 1) !== 0;
  const E = (mask & 2) !== 0;
  const S = (mask & 4) !== 0;
  const W = (mask & 8) !== 0;
  const seed = wl.tx * 31 + wl.ty * 17;
  const broken = look.hpFrac < 0.45;
  const tw = stone ? 16 : 12; // wall thickness
  const cy = -T / 2; // ground centre line of the tile
  // footprint pieces: [x0, x1, y0, y1] on the ground
  const pieces: [number, number, number, number, boolean][] = [[-tw / 2, tw / 2, cy - tw / 2, cy + tw / 2, !S]];
  if (E) pieces.push([tw / 2, T / 2, cy - tw / 2, cy + tw / 2, true]);
  if (W) pieces.push([-T / 2, -tw / 2, cy - tw / 2, cy + tw / 2, true]);
  if (N) pieces.push([-tw / 2, tw / 2, -T, cy - tw / 2, false]);
  if (S) pieces.push([-tw / 2, tw / 2, cy + tw / 2, 0, false]);

  // ---- front faces (south side open) ----
  for (const [x0, x1, , y1, front] of pieces) {
    if (!front) continue;
    const fy = y1;
    if (poly) {
      polyBlocks(c, x0, fy - h, x1, fy, seed + Math.round(x0) * 3);
      if (broken) {
        c.fillStyle = "rgba(40,35,30,0.5)";
        c.fillRect(x0 + (x1 - x0) * 0.3, fy - h, (x1 - x0) * 0.25, h * 0.4);
      }
    } else if (stone) {
      const g = c.createLinearGradient(0, fy - h, 0, fy);
      g.addColorStop(0, "#aaa398");
      g.addColorStop(1, "#7c766d");
      c.fillStyle = g;
      c.fillRect(x0, fy - h, x1 - x0, h);
      c.strokeStyle = "rgba(55,50,45,0.45)";
      c.lineWidth = 0.9;
      const rows = 3;
      for (let r = 1; r <= rows; r++) {
        const yy = fy - h + (r * h) / rows;
        c.beginPath();
        c.moveTo(x0, yy);
        c.lineTo(x1, yy);
        const off = (r + wl.tx) % 2 ? 0 : 6;
        for (let xx = x0 + off + 6; xx < x1; xx += 12) {
          c.moveTo(xx, yy);
          c.lineTo(xx, yy - h / rows);
        }
        c.stroke();
      }
      if (seeded(seed + x0) > 0.7) {
        c.fillStyle = "rgba(96,130,60,0.5)";
        c.beginPath();
        c.ellipse((x0 + x1) / 2, fy - 1.5, (x1 - x0) * 0.3, 2, 0, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      // upright logs
      const n = Math.max(1, Math.round((x1 - x0) / 6));
      const lw = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        if (broken && (seed + i + Math.round(x0)) % 4 === 0) continue;
        const x = x0 + i * lw;
        const lh = h * (0.9 + seeded(seed + i + x0) * 0.1);
        const g = c.createLinearGradient(x, 0, x + lw, 0);
        g.addColorStop(0, "#a3774a");
        g.addColorStop(0.6, "#7f5632");
        g.addColorStop(1, "#5e3f24");
        c.fillStyle = g;
        c.fillRect(x + 0.3, fy - lh, lw - 0.6, lh);
        c.beginPath();
        c.moveTo(x + 0.3, fy - lh);
        c.lineTo(x + lw / 2, fy - lh - 5);
        c.lineTo(x + lw - 0.3, fy - lh);
        c.closePath();
        c.fill();
      }
      c.strokeStyle = "#c9a56a";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x0, fy - h * 0.55);
      c.lineTo(x1, fy - h * 0.55);
      c.moveTo(x0, fy - h * 0.22);
      c.lineTo(x1, fy - h * 0.22);
      c.stroke();
    }
  }
  // ---- walkway on top ----
  for (const [x0, x1, y0, y1] of pieces) {
    c.fillStyle = poly ? "#d3cbbd" : stone ? "#c4bdb1" : "#9b7448";
    c.fillRect(x0, y0 - h, x1 - x0, y1 - y0);
  }
  // planks / flagstones + edge lines
  c.strokeStyle = stone ? "rgba(90,82,72,0.35)" : "rgba(60,40,22,0.5)";
  c.lineWidth = 0.8;
  for (const [x0, x1, y0, y1] of pieces) {
    const vertical = y1 - y0 > x1 - x0;
    c.beginPath();
    if (vertical) for (let yy = y0 + 4; yy < y1; yy += 4) {
      c.moveTo(x0 + 1, yy - h);
      c.lineTo(x1 - 1, yy - h);
    }
    else for (let xx = x0 + 4; xx < x1; xx += 4) {
      c.moveTo(xx, y0 - h + 1);
      c.lineTo(xx, y1 - h - 1);
    }
    c.stroke();
  }
  // parapet: battlements (stone) or sharpened log tips (palisade) along the outer edges
  const edge = stone ? "#d8d2c6" : "#7a5230";
  c.fillStyle = edge;
  const bump = (x: number, y: number) => {
    if (poly) {
      // smooth, slightly rounded capstones
      c.beginPath();
      c.ellipse(x, y - 1.5, 2.6, 2, 0, Math.PI, 0);
      c.fill();
    } else if (stone) c.fillRect(x - 2, y - 4, 4, 4);
    else {
      c.beginPath();
      c.moveTo(x - 2.4, y);
      c.lineTo(x, y - 5);
      c.lineTo(x + 2.4, y);
      c.closePath();
      c.fill();
    }
  };
  const step = stone ? 6 : 5;
  // north edges of E/W runs + centre (when nothing above)
  for (const [x0, x1, y0, , front] of pieces) {
    if (y0 === -T) continue;
    if (!front && !(x0 === -tw / 2 && !N)) continue;
    for (let xx = x0 + step / 2; xx < x1; xx += step) bump(xx, y0 - h);
  }
  // side edges of N/S runs
  if (N || S) {
    const ya = N ? -T : cy - tw / 2;
    const yb = S ? 0 : cy + tw / 2;
    if (!W) for (let yy = ya + step / 2; yy < yb; yy += step) bump(-tw / 2 + 1.5, yy - h);
    if (!E) for (let yy = ya + step / 2; yy < yb; yy += step) bump(tw / 2 - 1.5, yy - h);
  }
  // shade the east side of vertical runs a touch
  if (N || S) {
    c.fillStyle = "rgba(0,0,0,0.14)";
    c.fillRect(tw / 2 - 2, (N ? -T : cy - tw / 2) - h, 2, (S ? 0 : cy + tw / 2) - (N ? -T : cy - tw / 2));
  }
  if (wl.part === "gate" && wl.bone) {
    c.save();
    if (S) {
      // in a north-south run: a smaller monument astride the walkway
      c.translate(0, cy + 6);
      c.scale(0.72, 0.72);
    } else c.translate(0, cy + tw / 2);
    drawBoneGate(c, wl, look.swing, look.t, look.hpFrac);
    c.restore();
  } else if (wl.part === "gate") {
    if (!S) {
      c.save();
      c.translate(0, cy + tw / 2);
      drawGateDoors(c, stone, h, look.swing, look.t);
      c.restore();
    } else {
      // gate in a north-south run: a hatch across the walkway
      c.fillStyle = look.swing > 0.5 ? "rgba(30,20,12,0.7)" : "#6b4a2a";
      c.fillRect(-tw / 2 + 1, cy - 10 - h, tw - 2, 20);
      c.strokeStyle = "#c9a56a";
      c.lineWidth = 1.2;
      c.strokeRect(-tw / 2 + 1, cy - 10 - h, tw - 2, 20);
    }
  }
  if (look.hpFrac < 0.6 && stone) {
    c.strokeStyle = "rgba(30,25,20,0.75)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-3, cy + tw / 2 - h + 2);
    c.lineTo(0, cy + tw / 2 - h * 0.55);
    c.lineTo(-4, cy + tw / 2 - h * 0.2);
    c.stroke();
  }
  if (wl.upgrade || wl.boneUp) {
    c.globalAlpha = 0.6 + Math.sin(look.t * 4) * 0.3;
    c.font = "11px sans-serif";
    c.textAlign = "center";
    c.fillText(wl.boneUp ? "🦴" : wl.upTo === "polygon" ? "🔷" : "🧱", 0, cy - h - 10);
    c.globalAlpha = 1;
  }
}

/* ------------------------------ the grand bone gate ------------------------------ */

const INK = "#3a2616";
const IVORY = "#f6ecd6";
const IVORY_D = "#d9c7a2";

/** One bone: a shaft with knobbed ends, ink outline then ivory fill so the knobs merge. */
function bone(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, fill = IVORY) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const nx = -Math.sin(a) * w * 0.55;
  const ny = Math.cos(a) * w * 0.55;
  const knobs = (pad: number, col: string) => {
    c.fillStyle = col;
    for (const [x, y] of [[x0, y0], [x1, y1]] as const)
      for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(x + nx * s, y + ny * s, w * 0.62 + pad, 0, Math.PI * 2);
        c.fill();
      }
  };
  c.lineCap = "round";
  c.strokeStyle = INK;
  c.lineWidth = w + 2.4;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  knobs(1.2, INK);
  c.strokeStyle = fill;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  knobs(0, fill);
  // a little shine down the shaft
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.lineWidth = Math.max(0.8, w * 0.22);
  c.beginPath();
  c.moveTo(x0 + (x1 - x0) * 0.2 - nx * 0.4, y0 + (y1 - y0) * 0.2 - ny * 0.4);
  c.lineTo(x0 + (x1 - x0) * 0.75 - nx * 0.4, y0 + (y1 - y0) * 0.75 - ny * 0.4);
  c.stroke();
}

/** A hide lashing wrapped round a bone / tusk at (x, y). */
function lashing(c: CanvasRenderingContext2D, x: number, y: number, a: number, w: number) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = "#8a4b22";
  c.strokeStyle = INK;
  c.lineWidth = 1;
  for (const o of [-2.2, 1.2]) {
    c.beginPath();
    c.rect(o, -w / 2 - 1, 2.2, w + 2);
    c.fill();
    c.stroke();
  }
  c.restore();
}

/** A giant curved tusk rising beside the gate, arcing over the top to cross its twin. */
function tusk(c: CanvasRenderingContext2D, side: number, t: number) {
  // rises outward from its post, sweeps in and crosses its twin high above the arch, tip flaring out past it
  const p0 = { x: side * 28, y: -8 };
  const p1 = { x: side * 52, y: -46 };
  const p2 = { x: side * 24, y: -86 };
  const p3 = { x: -side * 30, y: -94 };
  const at = (u: number) => {
    const v = 1 - u;
    return {
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    };
  };
  const L: { x: number; y: number }[] = [];
  const R: { x: number; y: number }[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = at(u);
    const q = at(Math.min(1, u + 0.01));
    const r = at(Math.max(0, u - 0.01));
    const a = Math.atan2(q.y - r.y, q.x - r.x);
    const wdt = 6.5 * (1 - u) ** 0.8 + 0.4;
    L.push({ x: p.x - Math.sin(a) * wdt, y: p.y + Math.cos(a) * wdt });
    R.push({ x: p.x + Math.sin(a) * wdt, y: p.y - Math.cos(a) * wdt });
  }
  c.beginPath();
  c.moveTo(L[0].x, L[0].y);
  for (const p of L) c.lineTo(p.x, p.y);
  for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i].x, R[i].y);
  c.closePath();
  const g = c.createLinearGradient(side * 44, -60, side * 10, -60);
  g.addColorStop(0, "#fffaf0");
  g.addColorStop(0.55, IVORY);
  g.addColorStop(1, IVORY_D);
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.8;
  c.lineJoin = "round";
  c.stroke();
  // growth rings + a glint that slides along it
  c.strokeStyle = "rgba(150,120,80,0.45)";
  c.lineWidth = 0.8;
  for (const u of [0.32, 0.4, 0.48]) {
    const i = Math.round(u * n);
    c.beginPath();
    c.moveTo(L[i].x, L[i].y);
    c.lineTo(R[i].x, R[i].y);
    c.stroke();
  }
  const gu = 0.25 + ((t * 0.15 + (side > 0 ? 0.5 : 0)) % 1) * 0.6;
  const gp = at(gu);
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.beginPath();
  c.ellipse(gp.x, gp.y, 1.4, 2.6, 0.6 * side, 0, Math.PI * 2);
  c.fill();
  // lashed to its post
  for (const u of [0.08, 0.16]) {
    const p = at(u);
    const q = at(u + 0.02);
    lashing(c, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), 15 * (1 - u));
  }
}

/** The post a tusk is planted in: logs, a stone block or polygon blocks (matches the wall). */
function gatePost(c: CanvasRenderingContext2D, x: number, kind: Wall["kind"], seed: number) {
  if (kind === "polygon") {
    polyBlocks(c, x - 9, -22, x + 9, 2, seed);
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.strokeRect(x - 9, -22, 18, 24);
  } else if (kind === "stone") {
    const g = c.createLinearGradient(0, -22, 0, 2);
    g.addColorStop(0, "#b4ada2");
    g.addColorStop(1, "#7c766d");
    c.fillStyle = g;
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x - 10, 2);
    c.lineTo(x - 8, -22);
    c.lineTo(x + 8, -22);
    c.lineTo(x + 10, 2);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(55,50,45,0.5)";
    c.beginPath();
    c.moveTo(x - 9, -10);
    c.lineTo(x + 9, -10);
    c.stroke();
  } else {
    for (const o of [-6, 0, 6]) {
      const g = c.createLinearGradient(x + o - 3, 0, x + o + 3, 0);
      g.addColorStop(0, "#a3774a");
      g.addColorStop(1, "#5e3f24");
      c.fillStyle = g;
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.beginPath();
      c.rect(x + o - 3, -20 + Math.abs(o) * 0.4, 6, 22 - Math.abs(o) * 0.4);
      c.fill();
      c.stroke();
    }
    c.fillStyle = "#8a4b22";
    c.fillRect(x - 9, -12, 18, 3);
  }
}

/** One rib of the arch (side = -1 left, 1 right), scaled + lifted for depth. */
function rib(c: CanvasRenderingContext2D, side: number, s: number, oy: number, fill: string, w: number) {
  const path = () => {
    c.beginPath();
    c.moveTo(side * 19 * s, oy + 1);
    c.bezierCurveTo(side * 23 * s, oy - 16 * s, side * 21 * s, oy - 40 * s, side * 3, oy - 52 * s);
  };
  c.lineCap = "round";
  c.strokeStyle = INK;
  c.lineWidth = w + 2.4;
  path();
  c.stroke();
  c.strokeStyle = fill;
  c.lineWidth = w;
  path();
  c.stroke();
  // the rib's foot curls into a knob at the ground
  c.fillStyle = INK;
  c.beginPath();
  c.arc(side * 19 * s, oy + 1, w * 0.8 + 1.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = fill;
  c.beginPath();
  c.arc(side * 19 * s, oy + 1, w * 0.8, 0, Math.PI * 2);
  c.fill();
}

/**
 * The grand entrance, seen from the front: a dinosaur rib cage arching
 * over the way in, bone-bar doors that swing shut, two giant tusks crossing
 * overhead and a crossed-bones crest on top. Origin: front base centre.
 */
export function drawBoneGate(c: CanvasRenderingContext2D, wl: Wall, swing: number, t: number, hpFrac: number) {
  const seed = wl.tx * 31 + wl.ty * 17;
  const grow = Math.max(0, Math.min(1, wl.built));
  c.save();
  c.scale(1, 0.35 + grow * 0.65);
  // ground shadow
  c.fillStyle = "rgba(20,14,8,0.3)";
  c.beginPath();
  c.ellipse(0, 1, 40, 7, 0, 0, Math.PI * 2);
  c.fill();

  // dark way through under the ribs
  c.fillStyle = "#1d140d";
  c.beginPath();
  c.moveTo(-15, 0);
  c.bezierCurveTo(-17, -30, -9, -50, 0, -52);
  c.bezierCurveTo(9, -50, 17, -30, 15, 0);
  c.closePath();
  c.fill();
  // the rib cage, back to front (back ribs sit higher up the screen)
  const ribs = 4;
  for (let i = 0; i < ribs - 1; i++) {
    const d = (ribs - 1 - i) / (ribs - 1); // 1 = far back
    if (hpFrac < 0.45 && i === 1) continue; // a rib knocked out
    const fill = d > 0.6 ? "#bfae8c" : d > 0.2 ? "#ddd0b2" : IVORY;
    for (const side of [-1, 1]) rib(c, side, 1 - d * 0.16, -d * 20, fill, 3.2);
  }
  // the spine running back along the top
  for (let k = 6; k >= 0; k--) {
    const d = k / 6;
    const y = -52 - d * 18;
    const r = 4.2 - d * 1.4;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0, y, r + 1.2, r * 0.75 + 1.2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = d > 0.5 ? "#d6c8a8" : IVORY;
    c.beginPath();
    c.ellipse(0, y, r, r * 0.75, 0, 0, Math.PI * 2);
    c.fill();
  }

  // bone-bar doors (swing in, seen edge-on when open)
  const open = Math.max(0, Math.min(1, swing));
  const DW = 13;
  const DH = 36;
  for (const side of [-1, 1]) {
    const w = DW * (1 - open * 0.85);
    if (w < 1.5) continue;
    const x0 = side * DW;
    const bars = 3;
    for (let b = 0; b < bars; b++) {
      const x = x0 - (side * (w * (b + 0.5))) / bars;
      bone(c, x, -3, x, -DH + 4 + open * 3, 2.6, b % 2 ? IVORY_D : IVORY);
    }
    // hide straps lash the bars together
    c.lineCap = "butt";
    for (const [col, lw] of [[INK, 3.4], ["#8a4b22", 2]] as const) {
      c.strokeStyle = col;
      c.lineWidth = lw;
      for (const yy of [-10, -26]) {
        c.beginPath();
        c.moveTo(x0, yy);
        c.lineTo(x0 - side * w, yy + open * 2);
        c.stroke();
      }
    }
  }
  // shut: a great thigh bone barred across both doors
  if (open < 0.15) bone(c, -16, -19, 16, -19, 3.4);

  // the front rib frames the doors
  for (const side of [-1, 1]) {
    rib(c, side, 1, 0, IVORY, 4.4);
    c.strokeStyle = "rgba(255,255,255,0.6)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(side * 18, -8);
    c.bezierCurveTo(side * 21, -20, side * 19, -36, side * 6, -47);
    c.stroke();
  }

  // posts + giant crossing tusks
  gatePost(c, -27, wl.kind, seed);
  gatePost(c, 27, wl.kind, seed + 5);
  tusk(c, -1, t);
  tusk(c, 1, t);

  // crossed bones crest on top
  c.save();
  c.translate(0, -104);
  bone(c, -14, -10, 14, 10, 4.4);
  bone(c, -14, 10, 14, -10, 4.4);
  lashing(c, 0, 0, Math.PI / 2, 9);
  c.restore();
  c.restore();
}

function drawGateDoors(c: CanvasRenderingContext2D, stone: boolean, h: number, swing: number, t: number) {
  const W = 22;
  // dark archway behind the doors
  c.fillStyle = "#1f1712";
  c.beginPath();
  c.moveTo(-W / 2, 0);
  c.lineTo(-W / 2, -h * 0.72);
  c.quadraticCurveTo(0, -h * 0.98, W / 2, -h * 0.72);
  c.lineTo(W / 2, 0);
  c.closePath();
  c.fill();
  // two doors swing inward (seen edge-on when open)
  const open = Math.max(0, Math.min(1, swing));
  const dw = (W / 2) * (1 - open * 0.82);
  for (const side of [-1, 1]) {
    c.save();
    c.translate((side * W) / 2, 0);
    c.fillStyle = stone ? "#6b4a2a" : "#7a5230";
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -h * 0.74);
    c.lineTo(-side * dw, -h * 0.74 - open * 3);
    c.lineTo(-side * dw, 0 - open * 2);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(30,20,12,0.6)";
    c.lineWidth = 0.8;
    for (let k = 1; k < 4; k++) {
      c.beginPath();
      c.moveTo((-side * dw * k) / 4, 0);
      c.lineTo((-side * dw * k) / 4, -h * 0.74);
      c.stroke();
    }
    // iron bands
    c.strokeStyle = "#3c3a38";
    c.lineWidth = 1.4;
    for (const yy of [0.2, 0.55]) {
      c.beginPath();
      c.moveTo(0, -h * yy);
      c.lineTo(-side * dw, -h * yy);
      c.stroke();
    }
    c.restore();
  }
  // crossbar when shut
  if (open < 0.1) {
    c.fillStyle = "#4a3220";
    c.fillRect(-W / 2 - 2, -h * 0.42, W + 4, 3);
  }
  // little side door for people
  c.fillStyle = "#2a1e15";
  c.fillRect(W / 2 + 1, -10, 4, 10);
  void t;
}

function drawStairs(c: CanvasRenderingContext2D, wl: Wall, look: WallLook, built: number) {
  const stone = wl.kind !== "palisade";
  const H = WALL_H[wl.kind] * built;
  // ramp rises toward the wall it leans on (N, E, W or S)
  const m = look.mask;
  const dir = m & 1 ? "n" : m & 2 ? "e" : m & 8 ? "w" : "s";
  c.fillStyle = stone ? "#a8a196" : "#8f6a42";
  c.strokeStyle = stone ? "rgba(60,55,50,0.6)" : "rgba(50,32,18,0.6)";
  c.lineWidth = 1;
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const k = (i + 1) / steps;
    const hh = H * k;
    if (dir === "n") {
      const y = -4 - i * 5;
      c.fillRect(-12, y - hh * 0.35, 24, 5 + hh * 0.35);
      c.strokeRect(-12, y - hh * 0.35, 24, 5);
    } else if (dir === "s") {
      const y = -26 + i * 5;
      c.fillRect(-12, y - (H - hh) * 0.35, 24, 5);
      c.strokeRect(-12, y - (H - hh) * 0.35, 24, 5);
    } else {
      const s = dir === "e" ? 1 : -1;
      const x = s * (-14 + i * 6);
      c.fillRect(x - 3, -8 - hh, 6, hh);
      c.strokeRect(x - 3, -8 - hh, 6, 3);
    }
  }
  // rail
  c.strokeStyle = stone ? "#7d776f" : "#5e3f24";
  c.lineWidth = 1.6;
  c.beginPath();
  if (dir === "n" || dir === "s") {
    c.moveTo(-13, dir === "n" ? -2 : -28);
    c.lineTo(-13, dir === "n" ? -28 - H * 0.4 : -2 - H * 0.4);
  } else {
    const s = dir === "e" ? 1 : -1;
    c.moveTo(-14 * s, -10);
    c.lineTo(14 * s, -10 - H);
  }
  c.stroke();
}

/* ------------------------------ towers ------------------------------ */

/** A 2x2-tile watchtower. Origin: bottom-centre of the footprint. */
export function drawTower2(c: CanvasRenderingContext2D, stage: number, hpFrac: number, t: number, stoneBase: boolean, stone = false) {
  const W = 58;
  const PZ = 46; // platform height (matches TOWER_Z)
  if (stage <= 0) {
    c.strokeStyle = "rgba(255,255,255,0.75)";
    c.setLineDash([4, 3]);
    c.lineWidth = 1.2;
    c.strokeRect(-W / 2, -60, W, 56);
    c.setLineDash([]);
    return;
  }
  if (stone) {
    drawStoneTower(c, stage, hpFrac, t);
    return;
  }
  // stone footing
  c.fillStyle = stoneBase ? "#8f897f" : "#7a6a55";
  c.beginPath();
  c.ellipse(0, -4, W / 2 + 2, 9, 0, 0, Math.PI * 2);
  c.fill();
  // legs
  c.strokeStyle = "#5e3f24";
  c.lineWidth = 5;
  c.lineCap = "round";
  const leg = (x0: number, x1: number, y0: number) => {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, -PZ - 22);
    c.stroke();
  };
  leg(-W / 2 + 4, -W / 2 + 10, -2);
  leg(W / 2 - 4, W / 2 - 10, -2);
  c.lineWidth = 4;
  leg(-W / 2 + 12, -W / 2 + 14, -18);
  leg(W / 2 - 12, W / 2 - 14, -18);
  // cross bracing
  c.strokeStyle = "#8a6238";
  c.lineWidth = 2;
  for (let y = -12; y > -PZ - 14; y -= 16) {
    c.beginPath();
    c.moveTo(-W / 2 + 6, y);
    c.lineTo(W / 2 - 6, y - 12);
    c.moveTo(W / 2 - 6, y);
    c.lineTo(-W / 2 + 6, y - 12);
    c.stroke();
  }
  // ladder
  c.strokeStyle = "#c9a56a";
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-6, 0);
  c.lineTo(-6, -PZ - 18);
  c.moveTo(4, 0);
  c.lineTo(4, -PZ - 18);
  for (let y = -6; y > -PZ - 16; y -= 7) {
    c.moveTo(-6, y);
    c.lineTo(4, y);
  }
  c.stroke();
  if (stage >= 2) {
    // platform (people stand on it at z = PZ)
    c.fillStyle = "#9b7448";
    c.fillRect(-W / 2 - 2, -PZ - 30, W + 4, 26);
    c.strokeStyle = "rgba(60,40,22,0.5)";
    c.lineWidth = 1;
    for (let y = -PZ - 26; y < -PZ - 4; y += 5) {
      c.beginPath();
      c.moveTo(-W / 2, y);
      c.lineTo(W / 2, y);
      c.stroke();
    }
    c.fillStyle = "#6b4a2a";
    c.fillRect(-W / 2 - 3, -PZ - 6, W + 6, 6);
    // railing logs
    c.fillStyle = "#7a5230";
    for (let i = 0; i < 8; i++) c.fillRect(-W / 2 - 2 + i * 8.2, -PZ - 16, 4.5, 11);
  }
  if (stage >= 3) {
    // roof on four corner posts
    c.strokeStyle = "#5e3f24";
    c.lineWidth = 2.5;
    for (const x of [-W / 2, W / 2]) {
      c.beginPath();
      c.moveTo(x, -PZ - 28);
      c.lineTo(x, -PZ - 56);
      c.stroke();
    }
    c.fillStyle = "#5f8f3a";
    c.beginPath();
    c.moveTo(-W / 2 - 8, -PZ - 52);
    c.lineTo(0, -PZ - 80);
    c.lineTo(W / 2 + 8, -PZ - 52);
    c.closePath();
    c.fill();
    c.fillStyle = "#4b7a30";
    c.fillRect(-W / 2 - 8, -PZ - 54, W + 16, 4);
    c.strokeStyle = "#5a3d24";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, -PZ - 80);
    c.lineTo(0, -PZ - 98);
    c.stroke();
    c.fillStyle = "#e2462d";
    c.beginPath();
    c.moveTo(0, -PZ - 98);
    c.lineTo(14, -PZ - 94 + Math.sin(t * 5) * 1.5);
    c.lineTo(0, -PZ - 90);
    c.fill();
  }
  if (hpFrac < 0.5) {
    c.strokeStyle = "rgba(20,14,10,0.7)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-W / 2 + 8, -20);
    c.lineTo(-W / 2 + 18, -36);
    c.stroke();
  }
}

/** The stone version: a tapering masonry keep with a battlemented top. Same footprint + platform height. */
function drawStoneTower(c: CanvasRenderingContext2D, stage: number, hpFrac: number, t: number) {
  const W = 58;
  const PZ = 46;
  const top = stage >= 2 ? -PZ - 6 : -PZ * 0.55;
  const tw = W - 10; // narrower at the top
  // shadow + footing
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(0, -2, W / 2 + 6, 9, 0, 0, Math.PI * 2);
  c.fill();
  // body
  const body = () => {
    c.beginPath();
    c.moveTo(-W / 2, -2);
    c.lineTo(-tw / 2, top);
    c.lineTo(tw / 2, top);
    c.lineTo(W / 2, -2);
    c.closePath();
  };
  c.fillStyle = "#a39d92";
  body();
  c.fill();
  // shade the right side
  c.fillStyle = "rgba(40,36,32,0.18)";
  c.beginPath();
  c.moveTo(W / 6, -2);
  c.lineTo(tw / 6, top);
  c.lineTo(tw / 2, top);
  c.lineTo(W / 2, -2);
  c.closePath();
  c.fill();
  // block courses
  c.save();
  body();
  c.clip();
  c.strokeStyle = "rgba(60,55,48,0.45)";
  c.lineWidth = 1;
  let row = 0;
  for (let y = -2; y > top; y -= 8, row++) {
    c.beginPath();
    c.moveTo(-W / 2 - 4, y);
    c.lineTo(W / 2 + 4, y);
    for (let x = -W / 2 + (row % 2 ? 6 : 0); x < W / 2; x += 12) {
      c.moveTo(x, y);
      c.lineTo(x, y - 8);
    }
    c.stroke();
  }
  c.restore();
  // ink outline, like the storybook art
  c.strokeStyle = "rgba(43,30,20,0.85)";
  c.lineWidth = 1.4;
  body();
  c.stroke();
  // arched door
  c.fillStyle = "#2b231c";
  c.beginPath();
  c.moveTo(-7, -2);
  c.lineTo(-7, -14);
  c.arc(0, -14, 7, Math.PI, 0);
  c.lineTo(7, -2);
  c.closePath();
  c.fill();
  if (stage >= 2) {
    // walkway (people stand on it at z = PZ) behind a battlemented parapet
    c.fillStyle = "#b7b1a6";
    c.fillRect(-W / 2 - 2, -PZ - 30, W + 4, 24);
    c.fillStyle = "#8d877c";
    c.fillRect(-W / 2 - 3, -PZ - 8, W + 6, 6);
    c.fillStyle = "#a39d92";
    for (let i = 0; i < 5; i++) c.fillRect(-W / 2 - 3 + i * 13.2, -PZ - 18, 8, 11);
    c.strokeStyle = "rgba(60,55,48,0.4)";
    c.lineWidth = 1;
    for (let i = 0; i < 5; i++) c.strokeRect(-W / 2 - 3 + i * 13.2, -PZ - 18, 8, 11);
    // arrow slit
    c.fillStyle = "#2b231c";
    c.fillRect(-1.5, top + 14, 3, 10);
  }
  if (stage >= 3) {
    // banner pole
    c.strokeStyle = "#5a3d24";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(W / 2 - 6, -PZ - 18);
    c.lineTo(W / 2 - 6, -PZ - 52);
    c.stroke();
    c.fillStyle = "#e2462d";
    c.beginPath();
    c.moveTo(W / 2 - 6, -PZ - 52);
    c.lineTo(W / 2 + 10, -PZ - 47 + Math.sin(t * 5) * 1.5);
    c.lineTo(W / 2 - 6, -PZ - 42);
    c.fill();
  }
  if (hpFrac < 0.5) {
    c.strokeStyle = "rgba(20,14,10,0.7)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-W / 2 + 10, -14);
    c.lineTo(-W / 2 + 16, -26);
    c.lineTo(-W / 2 + 12, -34);
    c.stroke();
  }
}

/* ------------------------------ homes ------------------------------ */

/** Homes from a leather tent all the way to a stone house. Origin: base centre (door). */
export function drawHome(c: CanvasRenderingContext2D, s: Shelter, done: boolean, night: boolean, t: number, inside: number) {
  if (!done) return false; // caller falls back to the staged hut / tent drawing
  const tier = s.tier;
  const glow = night ? `rgba(255,${180 + Math.sin(t * 7) * 20},90,0.95)` : "#2b1e14";
  if (tier >= 5) {
    drawPolygonHouse(c, night, t);
    return true;
  }
  switch (tier) {
    case 0:
    case 1: {
      const W = tier === 0 ? 40 : 52;
      const H = tier === 0 ? 38 : 46;
      // poles
      c.strokeStyle = "#5e3f24";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-6, -H - 8);
      c.lineTo(4, -H + 6);
      c.moveTo(6, -H - 8);
      c.lineTo(-4, -H + 6);
      c.stroke();
      // hide cover
      const g = c.createLinearGradient(-W / 2, 0, W / 2, 0);
      g.addColorStop(0, tier === 0 ? "#c9a574" : "#b98a5a");
      g.addColorStop(0.55, tier === 0 ? "#b18c5e" : "#a3774a");
      g.addColorStop(1, tier === 0 ? "#8e6c45" : "#7f5a36");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-W / 2, 0);
      c.lineTo(0, -H);
      c.lineTo(W / 2, 0);
      c.quadraticCurveTo(0, 6, -W / 2, 0);
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 1;
      c.stroke();
      // stitching / painted band
      c.strokeStyle = tier === 1 ? "#d9473a" : "rgba(80,55,30,0.6)";
      c.lineWidth = tier === 1 ? 2 : 1;
      c.beginPath();
      c.moveTo(-W * 0.32, -H * 0.36);
      c.lineTo(W * 0.32, -H * 0.36);
      c.stroke();
      if (tier === 1) {
        c.fillStyle = "#f2c94c";
        for (let i = -2; i <= 2; i++) {
          c.beginPath();
          c.arc(i * W * 0.12, -H * 0.36, 1.6, 0, Math.PI * 2);
          c.fill();
        }
      }
      // door flap
      c.fillStyle = glow;
      c.beginPath();
      c.moveTo(-7, 0);
      c.lineTo(0, -H * 0.5);
      c.lineTo(7, 0);
      c.closePath();
      c.fill();
      break;
    }
    case 2:
      return false; // the wooden hut uses the classic drawing
    case 3:
    case 4: {
      const stone = tier === 4;
      const W = 58;
      const Hw = 26;
      // walls
      if (stone) {
        const g = c.createLinearGradient(0, -Hw, 0, 0);
        g.addColorStop(0, "#b8b1a6");
        g.addColorStop(1, "#8b857b");
        c.fillStyle = g;
      } else c.fillStyle = "#8a5f38";
      c.fillRect(-W / 2, -Hw, W, Hw);
      c.strokeStyle = stone ? "rgba(60,55,50,0.45)" : "rgba(45,28,15,0.55)";
      c.lineWidth = 1;
      for (let r = 1; r < 4; r++) {
        const y = -Hw + (r * Hw) / 4;
        c.beginPath();
        c.moveTo(-W / 2, y);
        c.lineTo(W / 2, y);
        if (stone) for (let x = -W / 2 + ((r % 2) * 7); x < W / 2; x += 14) {
          c.moveTo(x, y);
          c.lineTo(x, y - Hw / 4);
        }
        c.stroke();
      }
      if (!stone) {
        // stone footing on the log house
        c.fillStyle = "#8f897f";
        c.fillRect(-W / 2 - 2, -5, W + 4, 5);
      }
      // roof
      c.fillStyle = stone ? "#5e6873" : "#6f8f3a";
      c.beginPath();
      c.moveTo(-W / 2 - 7, -Hw + 2);
      c.lineTo(-W / 2 + 10, -Hw - 26);
      c.lineTo(W / 2 - 10, -Hw - 26);
      c.lineTo(W / 2 + 7, -Hw + 2);
      c.closePath();
      c.fill();
      c.strokeStyle = stone ? "rgba(30,35,40,0.5)" : "rgba(40,60,20,0.5)";
      for (let k = 1; k < 4; k++) {
        const y = -Hw + 2 - k * 7;
        c.beginPath();
        c.moveTo(-W / 2 - 7 + k * 4, y);
        c.lineTo(W / 2 + 7 - k * 4, y);
        c.stroke();
      }
      // chimney + hearth smoke
      c.fillStyle = stone ? "#7d776f" : "#8f897f";
      c.fillRect(W / 2 - 18, -Hw - 34, 8, 14);
      const smoke = 0.25 + 0.15 * Math.sin(t * 2);
      c.fillStyle = `rgba(200,200,205,${smoke})`;
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.4 + k / 3) % 1;
        c.beginPath();
        c.arc(W / 2 - 14 + Math.sin(t + k) * 3 + p * 6, -Hw - 38 - p * 26, 3 + p * 6, 0, Math.PI * 2);
        c.fill();
      }
      // door + windows (lit at night: the hearth inside)
      c.fillStyle = "#4a3220";
      c.fillRect(-6, -16, 12, 16);
      c.fillStyle = glow;
      c.fillRect(-W / 2 + 8, -Hw + 7, 9, 8);
      c.fillRect(W / 2 - 17, -Hw + 7, 9, 8);
      c.strokeStyle = "#3a2a1c";
      c.lineWidth = 1;
      c.strokeRect(-W / 2 + 8, -Hw + 7, 9, 8);
      c.strokeRect(W / 2 - 17, -Hw + 7, 9, 8);
      break;
    }
  }
  if (inside > 0) {
    c.font = "9px sans-serif";
    c.textAlign = "center";
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillText("•".repeat(Math.min(6, inside)), 0, -HOUSE_TOP[tier] - 4);
  }
  return true;
}

const HOUSE_TOP = [42, 52, 46, 62, 62];

/** Upgrade scaffolding over a home. */
export function drawScaffold(c: CanvasRenderingContext2D, k: number) {
  c.strokeStyle = "rgba(200,160,100,0.9)";
  c.lineWidth = 1.5;
  for (const x of [-30, 30]) {
    c.beginPath();
    c.moveTo(x, 2);
    c.lineTo(x, -58);
    c.stroke();
  }
  for (let y = -10; y > -58; y -= 12) {
    c.beginPath();
    c.moveTo(-32, y);
    c.lineTo(32, y);
    c.stroke();
  }
  c.fillStyle = "rgba(255,215,90,0.9)";
  c.fillRect(-24, -64, 48 * Math.max(0, Math.min(1, k)), 3);
}

/* ------------------------------ buildings ------------------------------ */

export function drawBuilding(c: CanvasRenderingContext2D, b: Building, w: number, h: number, night: boolean, t: number, bridgeMask = 0) {
  const built = Math.max(0, Math.min(1, b.built));
  const W = w * T;
  if (built < 1) {
    // ghost footprint, then a frame that rises as it's built
    c.strokeStyle = "rgba(255,255,255,0.8)";
    c.setLineDash([5, 4]);
    c.lineWidth = 1.3;
    c.strokeRect(-W / 2 + 2, -h * T + 2, W - 4, h * T - 4);
    c.setLineDash([]);
    if (built > 0.02) {
      c.strokeStyle = "#8a6238";
      c.lineWidth = 2;
      const hh = 34 * built;
      for (const x of [-W / 2 + 4, W / 2 - 4, 0]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, -hh);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(-W / 2 + 4, -hh);
      c.lineTo(W / 2 - 4, -hh);
      c.stroke();
    }
    return;
  }
  const glow = night ? "rgba(255,190,90,0.95)" : "#2b1e14";
  switch (b.kind) {
    case "storage": {
      // log crib with crates + sacks
      c.fillStyle = "#7a5230";
      c.fillRect(-W / 2 + 4, -26, W - 8, 26);
      c.strokeStyle = "rgba(40,25,15,0.5)";
      c.lineWidth = 1;
      for (let y = -22; y < 0; y += 6) {
        c.beginPath();
        c.moveTo(-W / 2 + 4, y);
        c.lineTo(W / 2 - 4, y);
        c.stroke();
      }
      c.fillStyle = "#a07a4a";
      c.beginPath();
      c.moveTo(-W / 2, -24);
      c.lineTo(0, -40);
      c.lineTo(W / 2, -24);
      c.closePath();
      c.fill();
      c.fillStyle = "#c89b5e";
      c.fillRect(-W / 2 + 8, -12, 12, 12);
      c.fillRect(W / 2 - 22, -10, 10, 10);
      c.strokeStyle = "rgba(60,40,20,0.6)";
      c.strokeRect(-W / 2 + 8, -12, 12, 12);
      break;
    }
    case "workshop": {
      // open lean-to with a workbench and tools on the wall
      c.fillStyle = "#6b4a2a";
      for (const x of [-W / 2 + 4, W / 2 - 8]) c.fillRect(x, -40, 4, 40);
      c.fillStyle = "#8a5f38";
      c.fillRect(-W / 2 + 6, -40, W - 12, 18);
      c.fillStyle = "#6f8f3a";
      c.beginPath();
      c.moveTo(-W / 2 - 4, -38);
      c.lineTo(-W / 2 + 6, -56);
      c.lineTo(W / 2 - 6, -56);
      c.lineTo(W / 2 + 4, -38);
      c.closePath();
      c.fill();
      c.fillStyle = "#a07a4a";
      c.fillRect(-W / 4, -14, W / 2, 6);
      c.fillStyle = "#6b4a2a";
      c.fillRect(-W / 4 + 2, -8, 3, 8);
      c.fillRect(W / 4 - 5, -8, 3, 8);
      // hanging tools
      c.strokeStyle = "#9aa3ad";
      c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-10 + i * 10, -36);
        c.lineTo(-10 + i * 10, -26);
        c.stroke();
      }
      break;
    }
    case "blacksmith": {
      // stone forge with a glowing mouth + chimney
      const g = c.createLinearGradient(0, -36, 0, 0);
      g.addColorStop(0, "#9b958b");
      g.addColorStop(1, "#6f6a62");
      c.fillStyle = g;
      c.fillRect(-W / 2 + 4, -36, W - 8, 36);
      c.fillStyle = "#4a4440";
      c.beginPath();
      c.moveTo(-W / 2, -34);
      c.lineTo(0, -52);
      c.lineTo(W / 2, -34);
      c.closePath();
      c.fill();
      c.fillStyle = "#7d776f";
      c.fillRect(W / 4, -66, 10, 24);
      const f = 0.7 + Math.sin(t * 9) * 0.15;
      c.fillStyle = `rgba(255,${120 + Math.sin(t * 13) * 30},40,${f})`;
      c.beginPath();
      c.arc(-W / 6, -12, 8, Math.PI, 0);
      c.fill();
      // anvil
      c.fillStyle = "#3c3a38";
      c.fillRect(W / 6 - 6, -10, 14, 5);
      c.fillRect(W / 6 - 2, -5, 6, 5);
      c.fillStyle = "rgba(160,160,165,0.35)";
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.5 + k / 3) % 1;
        c.beginPath();
        c.arc(W / 4 + 5 + p * 8, -70 - p * 30, 3 + p * 7, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "foodStore": {
      // granary on stilts
      c.strokeStyle = "#5e3f24";
      c.lineWidth = 3;
      for (const x of [-W / 2 + 8, -4, W / 2 - 8]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, -14);
        c.stroke();
      }
      c.fillStyle = "#b18c5e";
      c.fillRect(-W / 2 + 4, -36, W - 8, 22);
      c.fillStyle = "#c9a56a";
      c.beginPath();
      c.moveTo(-W / 2, -34);
      c.lineTo(0, -54);
      c.lineTo(W / 2, -34);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(90,60,30,0.6)";
      c.lineWidth = 1;
      for (let k = 1; k < 6; k++) {
        c.beginPath();
        c.moveTo(-W / 2 + k * (W / 6), -34);
        c.lineTo(0, -54);
        c.stroke();
      }
      c.fillStyle = "#e0b04c";
      c.font = "10px sans-serif";
      c.textAlign = "center";
      c.fillText("🌽", 0, -20);
      break;
    }
    case "waterStore": {
      for (const [x, s] of [[-7, 1], [6, 0.85], [0, 0.7]] as [number, number][]) {
        c.fillStyle = "#b6764f";
        c.beginPath();
        c.ellipse(x, -10 * s, 8 * s, 11 * s, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#8f5a3a";
        c.fillRect(x - 4 * s, -22 * s, 8 * s, 4);
        c.fillStyle = "rgba(120,190,230,0.8)";
        c.beginPath();
        c.ellipse(x, -22 * s, 3.5 * s, 1.5, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "well": {
      // stone rim over the shallow water, with a small bucket and winch
      c.fillStyle = "#665f57";
      c.beginPath();
      c.ellipse(0, -3, 15, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#b8b5aa";
      c.beginPath();
      c.ellipse(0, -8, 15, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#397fac";
      c.beginPath();
      c.ellipse(0, -9, 10, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#6b4728";
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-11, -12);
      c.lineTo(-11, -29);
      c.lineTo(11, -29);
      c.lineTo(11, -12);
      c.stroke();
      c.strokeStyle = "#d5b57b";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -29);
      c.lineTo(0, -20);
      c.stroke();
      c.fillStyle = "#b77b49";
      c.fillRect(-4, -20, 8, 6);
      break;
    }
    case "healer": {
      // leafy round hut with a herb garden
      c.fillStyle = "#6f9a3c";
      c.beginPath();
      c.ellipse(0, -18, W / 2 - 2, 26, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "#5a8a32";
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.ellipse(-W / 2 + 8 + i * ((W - 16) / 8), -22 - Math.sin((i / 8) * Math.PI) * 18, 6, 3.5, 0.3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#8a5f38";
      c.fillRect(-W / 2 + 2, -18, W - 4, 18);
      c.fillStyle = glow;
      c.beginPath();
      c.arc(0, 0, 8, Math.PI, 0);
      c.fill();
      c.fillStyle = "#e9f5e0";
      c.fillRect(-3, -40, 6, 14);
      c.fillRect(-7, -36, 14, 6);
      break;
    }
    case "pen": {
      // fence around a patch of hay
      c.fillStyle = "rgba(196,170,90,0.35)";
      c.fillRect(-W / 2 + 4, -h * T + 8, W - 8, h * T - 10);
      c.strokeStyle = "#7a5230";
      c.lineWidth = 2;
      c.strokeRect(-W / 2 + 4, -h * T + 8, W - 8, h * T - 10);
      c.lineWidth = 3;
      for (let x = -W / 2 + 4; x <= W / 2 - 4; x += 16) {
        c.beginPath();
        c.moveTo(x, 2);
        c.lineTo(x, -10);
        c.stroke();
      }
      break;
    }
    case "post": {
      c.strokeStyle = "#5e3f24";
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -40);
      c.stroke();
      c.fillStyle = "#3a7bd5";
      c.beginPath();
      c.moveTo(0, -40);
      c.lineTo(14, -36 + Math.sin(t * 4) * 1.5);
      c.lineTo(0, -31);
      c.fill();
      c.fillStyle = "#b18c5e";
      c.beginPath();
      c.ellipse(-8, -4, 8, 5, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "trap": {
      c.fillStyle = "rgba(60,40,20,0.35)";
      c.beginPath();
      c.ellipse(0, -2, 14, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#c9a56a";
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * 5 - 2, 0);
        c.lineTo(i * 5, -9 - (i % 2) * 2);
        c.lineTo(i * 5 + 2, 0);
        c.fill();
      }
      break;
    }
    case "bridge": {
      // A bridge occupies the whole water tile. Its boards run across the
      // direction of travel; connected sides stay open at bends and junctions.
      const north = (bridgeMask & 1) !== 0;
      const east = (bridgeMask & 2) !== 0;
      const south = (bridgeMask & 4) !== 0;
      const west = (bridgeMask & 8) !== 0;
      const horizontal = east || west;
      const vertical = north || south;
      c.fillStyle = "#9b7448";
      c.fillRect(-T / 2, -T, T, T);
      c.strokeStyle = "rgba(60,40,22,0.6)";
      c.lineWidth = 1;
      if (!vertical) {
        for (let x = -T / 2 + 4; x < T / 2; x += 5) {
          c.beginPath();
          c.moveTo(x, -T);
          c.lineTo(x, 0);
          c.stroke();
        }
      } else {
        for (let y = -T + 4; y < 0; y += 5) {
          c.beginPath();
          c.moveTo(-T / 2, y);
          c.lineTo(T / 2, y);
          c.stroke();
        }
      }
      c.strokeStyle = "#5e3f24";
      c.lineWidth = 2;
      c.beginPath();
      if (horizontal && vertical) {
        if (!north) { c.moveTo(-T / 2, -T + 1); c.lineTo(T / 2, -T + 1); }
        if (!east) { c.moveTo(T / 2 - 1, -T); c.lineTo(T / 2 - 1, 0); }
        if (!south) { c.moveTo(-T / 2, -1); c.lineTo(T / 2, -1); }
        if (!west) { c.moveTo(-T / 2 + 1, -T); c.lineTo(-T / 2 + 1, 0); }
      } else if (vertical) {
        c.moveTo(-T / 2 + 1, -T);
        c.lineTo(-T / 2 + 1, 0);
        c.moveTo(T / 2 - 1, -T);
        c.lineTo(T / 2 - 1, 0);
      } else {
        c.moveTo(-T / 2, -T + 1);
        c.lineTo(T / 2, -T + 1);
        c.moveTo(-T / 2, -1);
        c.lineTo(T / 2, -1);
      }
      c.stroke();
      break;
    }
    case "path": {
      c.fillStyle = "rgba(200,190,170,0.75)";
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.ellipse(-8 + (i % 2) * 16 + seeded(b.tx * 7 + i) * 4, -10 + Math.floor(i / 2) * 12, 7, 5, 0.2, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
  }
}

/* ------------------------------ scorpions ------------------------------ */

/** A ballista on its swivel mount, aimed along s.aim. Origin: base centre (raised by the mount). */
export function drawScorpion(c: CanvasRenderingContext2D, s: Scorpion) {
  const built = s.built;
  if (s.drone && built >= 1) {
    // powered: a glowing crystal core, a spinning targeting ring
    const t = performance.now() / 1000;
    c.save();
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(0, -10, 0, 0, -10, 30);
    g.addColorStop(0, `rgba(140,235,255,${0.45 + Math.sin(t * 5) * 0.15})`);
    g.addColorStop(1, "rgba(140,235,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -10, 30, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.save();
    c.strokeStyle = "rgba(150,240,255,0.7)";
    c.lineWidth = 1.2;
    c.setLineDash([5, 4]);
    c.lineDashOffset = -t * 20;
    c.beginPath();
    c.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  if (built < 1) {
    c.strokeStyle = "rgba(255,255,255,0.8)";
    c.setLineDash([4, 3]);
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 0.35 + built * 0.65;
  }
  const tier = s.tier;
  const metal = tier >= 2;
  // swivel post
  c.fillStyle = "#5e3f24";
  c.fillRect(-3, -14, 6, 14);
  c.fillStyle = metal ? "#5f646b" : "#7a5230";
  c.beginPath();
  c.ellipse(0, -14, 9, 4, 0, 0, Math.PI * 2);
  c.fill();
  // the crossbow body, foreshortened in the ground plane
  const ca = Math.cos(s.aim);
  const sa = Math.sin(s.aim) * 0.55;
  const len = 26 + tier * 3;
  const back = -s.kick * 5;
  const hx = (k: number) => ca * k;
  const hy = (k: number) => -16 + sa * k;
  c.strokeStyle = metal ? "#4a4f56" : "#6b4a2a";
  c.lineWidth = 4 + tier * 0.6;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(hx(-len * 0.45 + back), hy(-len * 0.45 + back));
  c.lineTo(hx(len * 0.55 + back), hy(len * 0.55 + back));
  c.stroke();
  // bow arms (perpendicular) + string
  const px = -sa / 0.55;
  const py = ca * 0.55;
  const ax = hx(len * 0.42 + back);
  const ay = hy(len * 0.42 + back);
  const arm = 16 + tier * 3;
  const flex = s.reload > 0.2 ? 0 : 4;
  c.strokeStyle = tier === 3 ? "#2b2238" : metal ? "#6f747c" : "#7a4f2a";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(ax + px * arm - ca * flex, ay + py * arm - sa * flex);
  c.quadraticCurveTo(ax + ca * 4, ay + sa * 4, ax - px * arm - ca * flex, ay - py * arm - sa * flex);
  c.stroke();
  c.strokeStyle = "rgba(240,235,220,0.9)";
  c.lineWidth = 1;
  const pull = s.reload > 0.2 ? len * 0.1 : len * 0.32;
  c.beginPath();
  c.moveTo(ax + px * arm - ca * flex, ay + py * arm - sa * flex);
  c.lineTo(hx(len * 0.42 - pull + back), hy(len * 0.42 - pull + back));
  c.lineTo(ax - px * arm - ca * flex, ay - py * arm - sa * flex);
  c.stroke();
  // loaded bolt
  if (s.reload <= 0.6) {
    c.strokeStyle = "#3d2b1c";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(hx(len * 0.42 - pull + back), hy(len * 0.42 - pull + back));
    c.lineTo(hx(len * 0.75 + back), hy(len * 0.75 + back));
    c.stroke();
    c.fillStyle = "#9aa3ad";
    c.beginPath();
    c.arc(hx(len * 0.78 + back), hy(len * 0.78 + back), 2.2, 0, Math.PI * 2);
    c.fill();
  }
  // tier pips
  for (let i = 0; i < tier; i++) {
    c.fillStyle = "#f2c94c";
    c.beginPath();
    c.arc(-6 + i * 6, 4, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

/* ------------------------------ deposits ------------------------------ */

export function drawNode(c: CanvasRenderingContext2D, n: ResNode, t: number) {
  if (CIV_NODES.includes(n.kind)) return drawCivNode(c, n, t);
  const def = NODES[n.kind];
  const k = 0.55 + 0.45 * (n.amount / Math.max(1, n.max));
  const v = n.variant;
  switch (n.kind) {
    case "stone":
    case "iron":
    case "gold":
    case "flint":
    case "obsidian": {
      const base = n.kind === "obsidian" ? "#2e2738" : n.kind === "flint" ? "#7c8a99" : "#8a837a";
      const rocks: [number, number, number][] = [
        [-10, -2, 11],
        [8, -1, 9],
        [-1, -10, 10],
        [12, -9, 6],
      ];
      for (const [x, y, r] of rocks) {
        const rr = r * k;
        c.fillStyle = shade(base, -0.15);
        c.beginPath();
        c.ellipse(x, y, rr, rr * 0.75, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = base;
        c.beginPath();
        c.ellipse(x - rr * 0.2, y - rr * 0.25, rr * 0.8, rr * 0.55, 0, 0, Math.PI * 2);
        c.fill();
        if (n.kind !== "stone") {
          // veins / glints
          c.strokeStyle = def.color;
          c.lineWidth = n.kind === "gold" ? 2 : 1.6;
          c.beginPath();
          c.moveTo(x - rr * 0.5, y - rr * 0.1);
          c.lineTo(x, y - rr * 0.4 + (v % 2) * 2);
          c.lineTo(x + rr * 0.4, y - rr * 0.2);
          c.stroke();
        }
      }
      if (n.kind === "gold" || n.kind === "obsidian") {
        const a = (Math.sin(t * 3 + v) + 1) / 2;
        c.fillStyle = n.kind === "gold" ? `rgba(255,240,170,${0.5 + a * 0.5})` : `rgba(200,170,255,${0.4 + a * 0.4})`;
        c.font = "10px serif";
        c.textAlign = "center";
        c.fillText("✦", 6, -18);
      }
      break;
    }
    case "clay": {
      c.fillStyle = "#9a5f3d";
      c.beginPath();
      c.ellipse(0, -2, 18 * k, 8 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = def.color;
      c.beginPath();
      c.ellipse(-3, -5, 13 * k, 6 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(80,45,25,0.5)";
      c.beginPath();
      c.moveTo(-8, -5);
      c.lineTo(4, -7);
      c.stroke();
      break;
    }
    case "salt": {
      c.fillStyle = "rgba(245,240,230,0.9)";
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.ellipse(-12 + i * 5, -2 - (i % 2) * 3, 5 * k, 3 * k, 0.3, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "tar": {
      c.fillStyle = "#16120f";
      c.beginPath();
      c.ellipse(0, -2, 16 * k, 7 * k, 0, 0, Math.PI * 2);
      c.fill();
      const b = (t * 0.7 + v * 0.3) % 1;
      c.strokeStyle = `rgba(90,80,70,${1 - b})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(-3 + v * 2, -3, 2 + b * 4, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case "artifact": {
      c.fillStyle = "#a7865a";
      c.beginPath();
      c.ellipse(0, -3, 16, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#c2a26d";
      c.beginPath();
      c.ellipse(-2, -6, 10, 5, 0, 0, Math.PI * 2);
      c.fill();
      const a = (Math.sin(t * 2.4 + v) + 1) / 2;
      c.fillStyle = `rgba(255,236,160,${0.4 + a * 0.6})`;
      c.font = "11px serif";
      c.textAlign = "center";
      c.fillText("✧", 4, -12 - a * 2);
      break;
    }
    case "fossil": {
      c.fillStyle = "#b9a684";
      c.beginPath();
      c.ellipse(0, -2, 18, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#efe6cf";
      c.lineWidth = 2.4;
      c.lineCap = "round";
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * 5, -2);
        c.quadraticCurveTo(i * 5 + 3, -8, i * 5 + 1, -12);
        c.stroke();
      }
      break;
    }
  }
}

/* ------------------------------ dragons ------------------------------ */

const DRAGON_LOOKS = [
  { body: "#b7342b", belly: "#f2b45a", wing: "#7e1f1a", horn: "#efe1c3" },
  { body: "#2f6d4f", belly: "#c9d77a", wing: "#1e4636", horn: "#efe1c3" },
  { body: "#3b3f73", belly: "#a7b4ff", wing: "#262a52", horn: "#f3e7c9" },
];

/** A dragon seen from a 3/4 view; origin at the body (already raised by z). */
export function drawDragon(c: CanvasRenderingContext2D, dr: Dragon, t: number) {
  const L = DRAGON_LOOKS[dr.hue % DRAGON_LOOKS.length];
  const flying = dr.z > 6;
  const flap = flying ? Math.sin(dr.anim * 1.6) : 0.15;
  c.save();
  c.scale(dr.dir, 1);
  if (dr.hit > 0) c.filter = `brightness(${1 + dr.hit * 0.8})`;
  // far wing
  const wing = (side: number) => {
    const lift = (flying ? flap * 34 : -10) * side;
    c.fillStyle = side < 0 ? shade(L.wing, -0.2) : L.wing;
    c.beginPath();
    c.moveTo(-6, -22);
    c.quadraticCurveTo(-30, -60 - lift, -66, -48 - lift * 1.2);
    c.lineTo(-58, -36 - lift * 0.6);
    c.lineTo(-44, -38 - lift * 0.5);
    c.lineTo(-40, -26 - lift * 0.3);
    c.lineTo(-26, -28 - lift * 0.2);
    c.quadraticCurveTo(-14, -18, -6, -16);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(20,10,10,0.35)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-6, -22);
    c.lineTo(-58, -36 - lift * 0.6);
    c.moveTo(-6, -22);
    c.lineTo(-40, -26 - lift * 0.3);
    c.stroke();
  };
  c.save();
  c.translate(8, -6);
  c.scale(0.85, 0.9);
  wing(-1);
  c.restore();
  // tail
  c.strokeStyle = L.body;
  c.lineWidth = 9;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-18, -16);
  c.quadraticCurveTo(-48, -10 + Math.sin(t * 3) * 6, -72, -20 + Math.sin(t * 3 + 1) * 10);
  c.stroke();
  c.fillStyle = L.wing;
  c.beginPath();
  c.moveTo(-72, -20 + Math.sin(t * 3 + 1) * 10);
  c.lineTo(-84, -28 + Math.sin(t * 3 + 1) * 10);
  c.lineTo(-80, -12 + Math.sin(t * 3 + 1) * 10);
  c.closePath();
  c.fill();
  // legs (tucked when flying)
  c.strokeStyle = shade(L.body, -0.2);
  c.lineWidth = 5;
  for (const x of [-10, 10]) {
    c.beginPath();
    c.moveTo(x, -12);
    c.lineTo(x + (flying ? -6 : 2), flying ? -4 : 2);
    c.stroke();
  }
  // body
  const g = c.createLinearGradient(0, -36, 0, -4);
  g.addColorStop(0, shade(L.body, 0.1));
  g.addColorStop(1, shade(L.body, -0.15));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, -18, 28, 14, -0.08, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = L.belly;
  c.beginPath();
  c.ellipse(4, -11, 20, 6, -0.05, 0, Math.PI * 2);
  c.fill();
  // back spikes
  c.fillStyle = L.horn;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(-16 + i * 8, -30 + Math.abs(i - 2) * 1.5);
    c.lineTo(-13 + i * 8, -38 + Math.abs(i - 2) * 1.5);
    c.lineTo(-10 + i * 8, -30 + Math.abs(i - 2) * 1.5);
    c.fill();
  }
  // neck + head
  const nod = flying ? Math.sin(t * 2) * 3 : Math.sin(t * 4) * 2;
  c.strokeStyle = L.body;
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(20, -22);
  c.quadraticCurveTo(34, -36 + nod, 40, -40 + nod);
  c.stroke();
  c.fillStyle = L.body;
  c.beginPath();
  c.ellipse(46, -42 + nod, 12, 7, 0.15, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(56, -39 + nod, 9, 4.5, 0.2, 0, Math.PI * 2);
  c.fill();
  // jaw open while breathing fire
  if (dr.breath > 0.05) {
    c.fillStyle = "#5a1410";
    c.beginPath();
    c.moveTo(48, -38 + nod);
    c.lineTo(64, -32 + nod + dr.breath * 6);
    c.lineTo(50, -34 + nod);
    c.closePath();
    c.fill();
  }
  // horns + eye
  c.fillStyle = L.horn;
  c.beginPath();
  c.moveTo(40, -46 + nod);
  c.lineTo(30, -58 + nod);
  c.lineTo(44, -48 + nod);
  c.fill();
  c.fillStyle = "#ffe066";
  c.beginPath();
  c.arc(49, -44 + nod, 2.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#111";
  c.fillRect(48.6, -45.5 + nod, 1, 3);
  // near wing on top
  wing(1);
  c.restore();
  c.filter = "none";
  // fire breath cone
  if (dr.breath > 0.05) {
    const dx = dr.dir;
    c.save();
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const k = i / 6;
      const r = 6 + k * 22;
      const fl = Math.sin(t * 30 + i) * 3;
      c.fillStyle = `rgba(255,${200 - k * 120},${60 - k * 40},${(1 - k) * 0.7 * dr.breath})`;
      c.beginPath();
      c.arc(dx * (64 + k * 80), -34 + k * (dr.z * 0.6) + fl, r, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

/** HP bar for dragons + hurt fighters (screen-ish units passed in). */
export function drawBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string) {
  c.fillStyle = "rgba(15,23,42,0.7)";
  c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  c.fillStyle = color;
  c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 3);
}

/** A charred cartoon skeleton (fire/lava victims). */
export function drawBones(c: CanvasRenderingContext2D, size: number) {
  const s = Math.max(0.6, Math.min(2, size));
  c.save();
  c.scale(s, s);
  c.fillStyle = "rgba(20,15,10,0.35)";
  c.beginPath();
  c.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#d8cfbd";
  c.lineWidth = 2.2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-14, -3);
  c.quadraticCurveTo(0, -8, 14, -4);
  c.stroke();
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(i * 4, -6);
    c.quadraticCurveTo(i * 4 + 2, -12, i * 4 + 1, -14 + Math.abs(i));
    c.stroke();
  }
  c.fillStyle = "#cfc5b0";
  c.beginPath();
  c.ellipse(17, -6, 5, 3.5, 0.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#2a221c";
  c.beginPath();
  c.arc(18.5, -6.5, 1, 0, Math.PI * 2);
  c.fill();
  // soot smudges
  c.fillStyle = "rgba(40,30,25,0.45)";
  c.beginPath();
  c.ellipse(-5, -5, 4, 2, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export { HOUSING };
