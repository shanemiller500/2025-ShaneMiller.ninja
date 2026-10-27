/* ------------------------------------------------------------------ */
/*  The Megalodon water gate: the bleached jaw bones of a colossal     */
/*  shark, raised out of the river between two stretches of wall and   */
/*  lashed to spine-bone pillars. Its teeth are the gate — the upper   */
/*  jaw hauls up for our people (or when the player opens it) and      */
/*  drops shut on everyone else. Drawn in the bone gates' ivory + ink. */
/* ------------------------------------------------------------------ */
import { TILE } from "../sim/types";

const INK = "#3a2616";
const IVORY = "#f6ecd6";
const IVORY_D = "#d9c7a2";
const FOSSIL = "#bfae8c";
const LASH = "#8a4b22";

/** one broad, serrated fossil tooth; tip points along +dir (1 = down, -1 = up) */
function tooth(c: CanvasRenderingContext2D, x: number, y: number, w: number, len: number, dir: number, lean: number) {
  const g = c.createLinearGradient(x, y, x, y + len * dir);
  g.addColorStop(0, "#8f7a5a");
  g.addColorStop(0.25, FOSSIL);
  g.addColorStop(1, "#efe6cf");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.quadraticCurveTo(x - w * 0.28 + lean * 0.4, y + len * 0.6 * dir, x + lean, y + len * dir);
  c.quadraticCurveTo(x + w * 0.28 + lean * 0.4, y + len * 0.6 * dir, x + w / 2, y);
  c.closePath();
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1;
  c.stroke();
  // serrated edges
  c.strokeStyle = "rgba(58,38,22,0.55)";
  c.lineWidth = 0.6;
  c.beginPath();
  for (let k = 1; k < 5; k++) {
    const f = k / 5;
    const yy = y + len * f * dir;
    const half = (w / 2) * (1 - f) + 0.3;
    c.moveTo(x + lean * f - half, yy);
    c.lineTo(x + lean * f - half + 1.3, yy - 0.9 * dir);
    c.moveTo(x + lean * f + half, yy);
    c.lineTo(x + lean * f + half - 1.3, yy - 0.9 * dir);
  }
  c.stroke();
  // the dark root band where it sits in the jaw
  c.fillStyle = "rgba(58,38,22,0.35)";
  c.fillRect(x - w / 2 + 1, dir > 0 ? y : y - 2, w - 2, 2);
}

/** A thick curved jaw bone along a quadratic arc, ink outline then ivory, with a shine. */
function jawBone(c: CanvasRenderingContext2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number) {
  c.lineCap = "round";
  for (const [col, lw] of [[INK, w + 2.6], [IVORY_D, w], [IVORY, w * 0.62]] as const) {
    c.strokeStyle = col;
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo(cx, cy, x1, y1);
    c.stroke();
  }
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.lineWidth = Math.max(0.8, w * 0.16);
  // the middle stretch of the same arc, nudged up onto the bone's top edge
  const at = (u: number) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1 - w * 0.2];
  c.beginPath();
  for (let k = 0; k <= 12; k++) {
    const [x, y] = at(0.25 + (k / 12) * 0.5);
    if (k) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.stroke();
}

/** A column of stacked shark vertebrae (the gate posts), bottom at (x, y). */
function spinePost(c: CanvasRenderingContext2D, x: number, y: number, h: number, w: number) {
  const n = Math.max(3, Math.round(h / (w * 0.62)));
  const step = h / n;
  for (let k = 0; k < n; k++) {
    const yy = y - step * (k + 0.5);
    const ww = w * (1 - k * 0.03);
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(x, yy, ww / 2 + 1.2, step / 2 + 0.6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = k % 2 ? IVORY_D : IVORY;
    c.beginPath();
    c.ellipse(x, yy, ww / 2, step / 2 - 0.6, 0, 0, Math.PI * 2);
    c.fill();
    // the growth rings on each disc
    c.strokeStyle = "rgba(58,38,22,0.4)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.ellipse(x, yy, ww * 0.28, step * 0.22, 0, 0, Math.PI * 2);
    c.stroke();
  }
  // a top knob
  c.fillStyle = INK;
  c.beginPath();
  c.arc(x, y - h - 2, w * 0.32 + 1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = IVORY;
  c.beginPath();
  c.arc(x, y - h - 2, w * 0.32, 0, Math.PI * 2);
  c.fill();
}

function lash(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
  c.fillStyle = LASH;
  c.strokeStyle = INK;
  c.lineWidth = 1;
  for (const o of [-3, 1]) {
    c.beginPath();
    c.rect(x - w / 2 - 1, y + o, w + 2, 2.4);
    c.fill();
    c.stroke();
  }
}

function ripples(c: CanvasRenderingContext2D, wd: number, t: number) {
  c.strokeStyle = "rgba(235,250,255,0.5)";
  c.lineWidth = 1.3;
  for (let k = 0; k < 3; k++) {
    const p = (t * 0.5 + k / 3) % 1;
    c.globalAlpha = 0.65 * (1 - p);
    c.beginPath();
    c.ellipse(0, 2, wd / 2 + p * 12, 4 + p * 5, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;
  c.fillStyle = "rgba(255,255,255,0.7)";
  for (let x = -wd / 2 + 6; x < wd / 2 - 4; x += 8) {
    c.beginPath();
    c.arc(x, Math.sin(t * 3 + x * 0.4) * 1.4, 1.8 + Math.sin(x) * 0.6, 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * Front view, drawn from the west end tile of an east-west run of `n` tiles.
 * Origin: centre-bottom of that first tile. `swing` 0 = jaws shut … 1 = upper jaw hauled up.
 */
function drawFront(c: CanvasRenderingContext2D, n: number, swing: number, t: number, hpFrac: number) {
  const wd = n * TILE + 22;
  const H = Math.min(124, 62 + n * 8);
  c.translate(((n - 1) * TILE) / 2, -4);
  c.fillStyle = "rgba(10,30,45,0.28)";
  c.beginPath();
  c.ellipse(5, 4, wd / 2 + 6, 8, 0, 0, Math.PI * 2);
  c.fill();
  ripples(c, wd, t);
  const half = wd / 2 - 10;
  const rise = H * 0.55;
  const jawU = -H * 0.32 - swing * H * 0.4;
  const jawL = -H * 0.14;
  const sag = H * 0.08;
  const bw = Math.min(10, 6 + n * 0.6);
  const toothN = Math.max(5, Math.round((half * 2) / 11));
  const tw = (half * 2) / toothN;
  const upY = (x: number) => jawU - (1 - (x / half) ** 2) * rise;
  const loY = (x: number) => jawL + (1 - (x / half) ** 2) * sag;
  // the dark mouth inside the jaw ring
  c.fillStyle = "rgba(8,14,22,0.55)";
  c.beginPath();
  c.moveTo(-half, jawL);
  c.quadraticCurveTo(0, jawU - rise * 2, half, jawL);
  c.quadraticCurveTo(0, jawL + sag * 2, -half, jawL);
  c.fill();
  // ---- lower jaw: a bone bow sagging into the water, teeth up
  for (let k = 0; k < toothN; k++) {
    const x = -half + tw * (k + 0.5);
    const mid = 1 - Math.abs(x / half);
    tooth(c, x, loY(x) - bw / 2, tw * 0.8, H * 0.13 + mid * H * 0.06, -1, (x / half) * -2.5);
  }
  jawBone(c, -half, jawL, 0, jawL + sag * 2, half, jawL, bw);
  // ---- upper jaw: a tall bone arch, big teeth hanging down; hauled up when it opens
  // (a second, inner row peeks out behind: megalodons grow their teeth in rows)
  c.globalAlpha = 0.5;
  for (let k = 1; k < toothN; k += 2) {
    const x = -half + tw * k;
    tooth(c, x, upY(x) + bw / 2 + 3, tw * 0.6, H * 0.1, 1, 0);
  }
  c.globalAlpha = 1;
  for (let k = 0; k <= toothN; k++) {
    const x = -half + tw * k;
    const mid = 1 - Math.abs(x / half);
    tooth(c, x, upY(x) + bw / 2, tw * 0.88, H * 0.15 + mid * H * 0.1, 1, (x / half) * 2.5);
  }
  jawBone(c, -half, jawU, 0, jawU - rise * 2, half, jawU, bw + 1.5);
  // ---- spine-bone posts at each bank, the jaw hinges lashed on with hide
  const postH = -jawU + rise * 0.55 + 6;
  for (const s of [-1, 1]) {
    const px = s * (half + 3);
    spinePost(c, px, 2, postH, 12);
    lash(c, px, jawL, 12);
    lash(c, px, jawU, 12);
    // the hoist rope from the post top to the jaw
    const rx = s * half * 0.55;
    c.strokeStyle = LASH;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(px, 2 - postH);
    c.quadraticCurveTo((px + rx) / 2, 2 - postH - 6, rx, upY(rx) - bw / 2);
    c.stroke();
    // a fin-bone spike on each post
    c.fillStyle = IVORY;
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px - 4, 2 - postH - 3);
    c.quadraticCurveTo(px + s * 2, 2 - postH - 16, px + s * 9, 2 - postH - 20);
    c.quadraticCurveTo(px + s * 4, 2 - postH - 9, px + 4, 2 - postH - 3);
    c.closePath();
    c.fill();
    c.stroke();
  }
  // the great tooth trophy on top of the arch
  lash(c, 0, upY(0) - bw / 2 - 2, 8);
  tooth(c, 0, upY(0) - bw / 2 - 2, 13, 18, -1, 0);
  if (hpFrac < 0.6) {
    c.strokeStyle = "rgba(58,38,22,0.85)";
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(-half * 0.4, upY(-half * 0.4) - 3);
    c.lineTo(-half * 0.34, upY(-half * 0.4) + 2);
    c.lineTo(-half * 0.4, upY(-half * 0.4) + 5);
    c.moveTo(half * 0.5, loY(half * 0.5) - 3);
    c.lineTo(half * 0.45, loY(half * 0.5) + 3);
    c.stroke();
  }
}

/**
 * Side-on run, drawn from the south end tile of a north-south run of `n` tiles: two long jaw bones
 * lie along the run and their teeth lock down the middle; opening hauls them apart.
 */
function drawRun(c: CanvasRenderingContext2D, n: number, swing: number, t: number, hpFrac: number) {
  const L = n * TILE + 10;
  const gap = 2 + swing * 9;
  c.translate(0, 4);
  c.fillStyle = "rgba(10,30,45,0.28)";
  c.fillRect(-18, -L, 38, L);
  c.strokeStyle = "rgba(235,250,255,0.45)";
  c.lineWidth = 1.2;
  for (let y = -L + 6; y < 0; y += 10) {
    const b = Math.sin(t * 2 + y * 0.2) * 2;
    c.beginPath();
    c.moveTo(-21 + b, y);
    c.lineTo(-16 + b, y + 3);
    c.moveTo(21 - b, y);
    c.lineTo(16 - b, y + 3);
    c.stroke();
  }
  for (const s of [-1, 1]) {
    const x = s * (gap + 5);
    // teeth along the seam, alternating so they lock
    const count = Math.round(L / 9);
    for (let k = 0; k < count; k++) {
      const y = -L + 8 + (k + (s > 0 ? 0.5 : 0)) * ((L - 14) / count);
      c.save();
      c.translate(x - s * 3, y);
      c.rotate(s > 0 ? Math.PI / 2 : -Math.PI / 2);
      tooth(c, 0, 0, 7, 9 * (1 - swing * 0.3), 1, 0);
      c.restore();
    }
    jawBone(c, x, -6, x + s * 4, -L / 2, x, -L + 4, 7);
  }
  // spine-bone posts on both banks
  spinePost(c, 0, 8, 26, 11);
  spinePost(c, 0, -L + 6, 26, 11);
  lash(c, 0, -10, 11);
  lash(c, 0, -L - 6, 11);
  if (hpFrac < 0.6) {
    c.strokeStyle = "rgba(58,38,22,0.85)";
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(-8, -L * 0.5);
    c.lineTo(-5, -L * 0.42);
    c.lineTo(-9, -L * 0.34);
    c.stroke();
  }
}

/** The whole Megalodon gate (n tiles); a blueprint shows as a ghost with a bobbing 🦈. */
export function drawMegaGate(c: CanvasRenderingContext2D, n: number, vertical: boolean, swing: number, t: number, hpFrac: number, ghost: boolean) {
  c.save();
  if (ghost) c.globalAlpha = 0.42;
  if (vertical) drawRun(c, n, swing, t, hpFrac);
  else drawFront(c, n, swing, t, hpFrac);
  c.restore();
  if (ghost) {
    c.save();
    c.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
    c.font = "14px sans-serif";
    c.textAlign = "center";
    c.fillText("🦈", vertical ? 0 : ((n - 1) * TILE) / 2, (vertical ? -n * TILE : -40) - 8 + Math.sin(t * 2) * 2);
    c.restore();
  }
}
