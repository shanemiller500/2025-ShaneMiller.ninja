/* ------------------------------------------------------------------ */
/*  The river beasts (sim/riverBeasts.ts): a crocodile, a hippo, a     */
/*  giant snake. Feet at (0, 0), facing +x, L = its size (px).         */
/*  `p.sink` (0..1): sitting low in the water (a lurking croc shows    */
/*  only its eyes + back ridges; a wallowing hippo its eyes, ears and  */
/*  back). `p.mouth`: jaws open (a bite / a charge / a strike).        */
/* ------------------------------------------------------------------ */
import type { DinoPose } from "./drawDino";

type Ctx = CanvasRenderingContext2D;
export interface Hide {
  body: string;
  dark: string;
  belly: string;
  accent: string;
}

/** Draw `paint` sunk `depth` px into water: everything below the waterline cut off, ripples round it. */
function inWater(c: Ctx, L: number, sink: number, depth: number, t: number, paint: () => void) {
  if (sink <= 0) {
    paint();
    return;
  }
  c.save();
  c.beginPath();
  c.rect(-L * 2, -L * 2, L * 4, L * 2);
  c.clip();
  c.translate(0, sink * depth);
  paint();
  c.restore();
  // the water closing round it: a darker band, then slow rings
  c.fillStyle = "rgba(30,70,90,0.28)";
  c.beginPath();
  c.ellipse(0, 0, L * 0.5, L * 0.08, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(235,248,255,0.6)";
  c.lineWidth = Math.max(0.8, L * 0.012);
  for (let k = 0; k < 2; k++) {
    const ph = (t * 0.45 + k * 0.5) % 1;
    c.globalAlpha = 1 - ph;
    c.beginPath();
    c.ellipse(0, 0, L * (0.36 + ph * 0.3), L * (0.06 + ph * 0.05), 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;
}

/* ------------------------------ crocodile ------------------------------ */

export function paintCroc(c: Ctx, L: number, p: DinoPose, hide: Hide, fine: boolean) {
  const t = p.t;
  const sink = Math.max(0, Math.min(1, p.sink ?? 0));
  const mouth = Math.max(0, Math.min(1, p.mouth));
  const sway = Math.sin(p.walk * 0.5 + t * 0.8) * (0.4 + p.stride * 0.6);
  inWater(c, L, sink, L * 0.16, t, () => {
    const by = -L * 0.1;
    // legs: short + splayed, rowing as it walks
    c.fillStyle = hide.dark;
    for (const [lx, ph] of [[-0.16, 0], [0.12, Math.PI], [-0.12, Math.PI], [0.16, 0]] as const) {
      const sw = Math.sin(p.walk + ph) * L * 0.03 * p.stride;
      c.beginPath();
      c.ellipse(lx * L + sw, -L * 0.03, L * 0.045, L * 0.03, 0.3, 0, Math.PI * 2);
      c.fill();
    }
    // tail: long, flattened, swinging
    c.fillStyle = hide.body;
    c.beginPath();
    c.moveTo(-L * 0.18, by - L * 0.06);
    c.quadraticCurveTo(-L * 0.4, by - L * 0.04 + sway * L * 0.03, -L * 0.62, by + sway * L * 0.06);
    c.quadraticCurveTo(-L * 0.4, by + L * 0.04 + sway * L * 0.03, -L * 0.18, by + L * 0.07);
    c.closePath();
    c.fill();
    // body
    c.beginPath();
    c.ellipse(0, by, L * 0.27, L * 0.08, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hide.belly;
    c.beginPath();
    c.ellipse(L * 0.02, by + L * 0.045, L * 0.2, L * 0.03, 0, 0, Math.PI * 2);
    c.fill();
    // the head: a long flat snout; the lower jaw drops open to bite
    const hx = L * 0.22;
    const hy = by - L * 0.01;
    c.save();
    c.translate(hx, hy + L * 0.02);
    c.rotate(mouth * 0.55);
    c.fillStyle = hide.belly;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(L * 0.34, L * 0.005);
    c.lineTo(L * 0.33, L * 0.035);
    c.lineTo(0, L * 0.05);
    c.closePath();
    c.fill();
    if (mouth > 0.1) {
      c.fillStyle = "#fffbe8";
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const x = L * (0.05 + k * 0.05);
        c.moveTo(x, 0);
        c.lineTo(x + L * 0.012, -L * 0.022);
        c.lineTo(x + L * 0.024, 0);
      }
      c.fill();
    }
    c.restore();
    c.save();
    c.translate(hx, hy);
    c.rotate(-mouth * 0.2);
    c.fillStyle = hide.body;
    c.beginPath();
    c.moveTo(-L * 0.04, -L * 0.06);
    c.quadraticCurveTo(L * 0.1, -L * 0.075, L * 0.35, -L * 0.02);
    c.lineTo(L * 0.36, L * 0.015);
    c.lineTo(0, L * 0.025);
    c.closePath();
    c.fill();
    if (mouth > 0.1) {
      c.fillStyle = "#c84a4a";
      c.fillRect(L * 0.02, L * 0.015, L * 0.3, L * 0.012);
      c.fillStyle = "#fffbe8";
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const x = L * (0.06 + k * 0.05);
        c.moveTo(x, L * 0.015);
        c.lineTo(x + L * 0.012, L * 0.04);
        c.lineTo(x + L * 0.024, L * 0.015);
      }
      c.fill();
    } else if (fine) {
      // the toothy grin it never quite closes
      c.strokeStyle = "#fffbe8";
      c.lineWidth = Math.max(0.6, L * 0.008);
      c.beginPath();
      for (let k = 0; k < 5; k++) {
        const x = L * (0.08 + k * 0.05);
        c.moveTo(x, L * 0.02);
        c.lineTo(x + L * 0.008, L * 0.034);
      }
      c.stroke();
    }
    // nostrils on the tip, eye bumps on top (all that shows when it lurks)
    c.fillStyle = hide.dark;
    c.beginPath();
    c.ellipse(L * 0.33, -L * 0.03, L * 0.012, L * 0.008, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hide.body;
    c.beginPath();
    c.ellipse(L * 0.05, -L * 0.07, L * 0.035, L * 0.025, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e3c43a";
    c.beginPath();
    c.ellipse(L * 0.06, -L * 0.075, L * 0.016, L * 0.013, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1b1b12";
    c.fillRect(L * 0.057, -L * 0.087, L * 0.006, L * 0.024);
    c.restore();
    // the armoured ridges down its back and tail
    c.fillStyle = hide.accent;
    c.beginPath();
    for (let k = 0; k < 11; k++) {
      const x = L * (0.18 - k * 0.07);
      const yTop = by - L * (k < 6 ? 0.075 : 0.05 - (k - 6) * 0.006) + (k > 5 ? sway * L * 0.01 * (k - 5) : 0);
      const s = L * (k < 6 ? 0.022 : 0.016);
      c.moveTo(x - s, yTop + s * 0.4);
      c.lineTo(x, yTop - s);
      c.lineTo(x + s, yTop + s * 0.4);
    }
    c.fill();
  });
}

/* ------------------------------ hippo ------------------------------ */

export function paintHippo(c: Ctx, L: number, p: DinoPose, hide: Hide, fine: boolean) {
  const t = p.t;
  const sink = Math.max(0, Math.min(1, p.sink ?? 0));
  const mouth = Math.max(0, Math.min(1, p.mouth));
  const bob = Math.abs(Math.sin(p.walk)) * L * 0.012 * p.stride;
  inWater(c, L, sink, L * 0.3, t, () => {
    c.translate(0, -bob);
    // stumpy legs
    c.fillStyle = hide.dark;
    for (const [lx, ph] of [[-0.22, 0], [0.14, Math.PI], [-0.14, Math.PI], [0.22, 0]] as const) {
      const sw = Math.sin(p.walk + ph) * L * 0.025 * p.stride;
      c.beginPath();
      c.roundRect(lx * L - L * 0.045 + sw, -L * 0.16, L * 0.09, L * 0.16, L * 0.03);
      c.fill();
    }
    // the barrel of a body
    const g = c.createLinearGradient(0, -L * 0.52, 0, -L * 0.1);
    g.addColorStop(0, hide.body);
    g.addColorStop(1, hide.dark);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(-L * 0.04, -L * 0.3, L * 0.34, L * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hide.belly;
    c.globalAlpha = 0.5;
    c.beginPath();
    c.ellipse(0, -L * 0.17, L * 0.26, L * 0.05, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    // a stub of a tail
    c.strokeStyle = hide.dark;
    c.lineWidth = L * 0.02;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-L * 0.37, -L * 0.32);
    c.lineTo(-L * 0.42, -L * 0.27 + Math.sin(t * 3) * L * 0.01);
    c.stroke();
    // the head: the top swings up to open the mouth (almost straight up, tusks showing)
    const hx = L * 0.27;
    const hy = -L * 0.34;
    // lower jaw + mouth
    c.fillStyle = hide.belly;
    c.beginPath();
    c.ellipse(hx + L * 0.12, hy + L * 0.05, L * 0.15, L * 0.07, 0, 0, Math.PI * 2);
    c.fill();
    if (mouth > 0.1) {
      c.fillStyle = "#c45a6a";
      c.beginPath();
      c.ellipse(hx + L * 0.13, hy + L * 0.01, L * 0.13, L * 0.06 * mouth, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "#fffbe8";
      c.beginPath();
      for (const x of [0.05, 0.21]) {
        c.moveTo(hx + L * x, hy + L * 0.02);
        c.lineTo(hx + L * (x + 0.015), hy - L * 0.05 * mouth);
        c.lineTo(hx + L * (x + 0.03), hy + L * 0.02);
      }
      c.fill();
    }
    c.save();
    c.translate(hx - L * 0.02, hy);
    c.rotate(-mouth * 0.9);
    c.fillStyle = hide.body;
    c.beginPath();
    c.ellipse(L * 0.08, -L * 0.03, L * 0.15, L * 0.11, 0, 0, Math.PI * 2);
    c.fill();
    // the broad muzzle
    c.beginPath();
    c.ellipse(L * 0.2, -L * 0.01, L * 0.1, L * 0.085, 0, 0, Math.PI * 2);
    c.fill();
    if (mouth > 0.1) {
      c.fillStyle = "#fffbe8";
      c.beginPath();
      for (const x of [0.13, 0.25]) {
        c.moveTo(L * x, L * 0.05);
        c.lineTo(L * (x + 0.012), L * 0.1);
        c.lineTo(L * (x + 0.024), L * 0.05);
      }
      c.fill();
    }
    // nostrils, eyes + ears on top (what shows above the water)
    c.fillStyle = hide.dark;
    c.beginPath();
    c.ellipse(L * 0.25, -L * 0.08, L * 0.018, L * 0.012, 0.3, 0, Math.PI * 2);
    c.ellipse(L * 0.21, -L * 0.085, L * 0.014, L * 0.01, 0.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hide.body;
    c.beginPath();
    c.ellipse(L * 0.04, -L * 0.12, L * 0.035, L * 0.03, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff8ea";
    c.beginPath();
    c.ellipse(L * 0.05, -L * 0.125, L * 0.015, L * 0.013, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#24181c";
    c.beginPath();
    c.arc(L * 0.055, -L * 0.125, L * 0.008, 0, Math.PI * 2);
    c.fill();
    // little ears (they flick)
    const flick = Math.sin(t * 5) > 0.9 ? 0.4 : 0;
    c.fillStyle = hide.dark;
    c.beginPath();
    c.ellipse(-L * 0.04, -L * 0.13, L * 0.018, L * 0.03, -0.5 - flick, 0, Math.PI * 2);
    c.fill();
    c.restore();
    if (fine) {
      // a few wrinkles on its neck
      c.strokeStyle = hide.dark;
      c.lineWidth = Math.max(0.6, L * 0.007);
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const x = L * (0.16 + k * 0.025);
        c.moveTo(x, -L * 0.42);
        c.quadraticCurveTo(x + L * 0.01, -L * 0.36, x, -L * 0.3);
      }
      c.stroke();
    }
  });
}

/* ------------------------------ giant snake ------------------------------ */

export function paintSnake(c: Ctx, L: number, p: DinoPose, hide: Hide, fine: boolean) {
  const t = p.t;
  const mouth = Math.max(0, Math.min(1, p.mouth));
  const moving = p.stride > 0.05 || mouth > 0.2;
  const w = L * 0.09;
  c.lineCap = "round";
  c.lineJoin = "round";
  // shadow
  c.fillStyle = "rgba(20,20,10,0.22)";
  c.beginPath();
  c.ellipse(0, 0, L * 0.45, L * 0.07, 0, 0, Math.PI * 2);
  c.fill();
  let headX: number;
  let headY: number;
  if (moving) {
    // slithering: an S-curve along the ground, the head thrown forward when it strikes
    const pts: [number, number][] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const x = -L * 0.5 + f * L * (0.92 + mouth * 0.2);
      const y = -w * 0.6 + Math.sin(p.walk * 1.5 - f * 7) * L * 0.08 * (1 - f * 0.4) * (1 - mouth * 0.6);
      pts.push([x, y]);
    }
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      c.strokeStyle = hide.body;
      c.lineWidth = w * (0.35 + 0.65 * Math.min(1, f * 1.6));
      c.beginPath();
      c.moveTo(pts[i - 1][0], pts[i - 1][1]);
      c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
    }
    // bands down its back
    if (fine) {
      c.strokeStyle = hide.accent;
      for (let i = 2; i < n; i += 2) {
        c.lineWidth = w * 0.5 * Math.min(1, (i / n) * 1.6);
        c.beginPath();
        c.moveTo(pts[i][0], pts[i][1]);
        c.lineTo(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * 0.4, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * 0.4);
        c.stroke();
      }
    }
    headX = pts[n][0];
    headY = pts[n][1] - mouth * L * 0.08;
  } else {
    // coiled up in a heap, head raised and watching
    for (let k = 0; k < 3; k++) {
      c.strokeStyle = k % 2 ? hide.accent : hide.body;
      c.lineWidth = w;
      c.beginPath();
      c.ellipse(0, -w * (0.6 + k * 0.8), L * (0.24 - k * 0.06), L * (0.07 - k * 0.012), 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = hide.body;
    c.lineWidth = w * 0.9;
    c.beginPath();
    c.moveTo(L * 0.06, -w * 2.4);
    c.quadraticCurveTo(L * 0.1, -w * 4.2, L * 0.16, -w * 4.4 + Math.sin(t * 1.3) * L * 0.01);
    c.stroke();
    headX = L * 0.16;
    headY = -w * 4.4 + Math.sin(t * 1.3) * L * 0.01;
  }
  // the head: a broad flat wedge, the jaw dropping open to strike
  c.fillStyle = hide.body;
  c.beginPath();
  c.ellipse(headX + w * 0.4, headY, w * 0.9, w * 0.6, 0, 0, Math.PI * 2);
  c.fill();
  if (mouth > 0.2) {
    c.fillStyle = "#c84a5a";
    c.beginPath();
    c.moveTo(headX + w * 0.4, headY);
    c.lineTo(headX + w * 1.6, headY - w * 0.5 * mouth);
    c.lineTo(headX + w * 1.6, headY + w * 0.6 * mouth);
    c.closePath();
    c.fill();
    c.fillStyle = "#fffbe8";
    c.beginPath();
    c.moveTo(headX + w * 1.2, headY - w * 0.35 * mouth);
    c.lineTo(headX + w * 1.3, headY);
    c.lineTo(headX + w * 1.4, headY - w * 0.4 * mouth);
    c.fill();
  } else if (Math.sin(t * 7) > 0.4) {
    // the forked tongue, tasting the air
    c.strokeStyle = "#d8314a";
    c.lineWidth = Math.max(0.6, w * 0.15);
    c.beginPath();
    c.moveTo(headX + w * 1.2, headY + w * 0.1);
    c.lineTo(headX + w * 1.9, headY + w * 0.1);
    c.lineTo(headX + w * 2.2, headY - w * 0.15);
    c.moveTo(headX + w * 1.9, headY + w * 0.1);
    c.lineTo(headX + w * 2.2, headY + w * 0.35);
    c.stroke();
  }
  c.fillStyle = "#f2d43a";
  c.beginPath();
  c.ellipse(headX + w * 0.6, headY - w * 0.25, w * 0.2, w * 0.16, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#151510";
  c.fillRect(headX + w * 0.57, headY - w * 0.38, w * 0.07, w * 0.26);
}
