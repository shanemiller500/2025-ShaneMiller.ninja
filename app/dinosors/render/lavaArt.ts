/* ------------------------------------------------------------------ */
/*  A Lava Monster (sim/lavaFolk.ts): a hunched, walking lump of lava.  */
/*  The body IS molten rock (yellow-white at the core, orange, deep    */
/*  red at the edges) with plates of dark cooled crust floating on it; */
/*  glowing seams between the plates, bubbles popping on its head,     */
/*  drips running off it and a glowing puddle where it stands.         */
/*                                                                     */
/*  Pose extras (set by the renderer): `heat` 0..1 (cooling: the crust */
/*  spreads + greys, the glow dies down), `sink` 0..1 (swimming in the */
/*  lava pool: it sits low in it), `wind` 0..1 (balling up lava to     */
/*  throw: the near arm goes up with a glowing ball in its fist).      */
/*  Feet at (0, 0), facing +x, L = its size (px). No canvas filters:   */
/*  the glow is one additive gradient.                                 */
/* ------------------------------------------------------------------ */
import type { DinoPose } from "./drawDino";

type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number];

const mix = (a: RGB, b: RGB, k: number) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;

// hot … cold
const CORE: [RGB, RGB] = [[255, 236, 140], [150, 46, 16]];
const MOLTEN: [RGB, RGB] = [[255, 128, 30], [112, 30, 12]];
const EDGE: [RGB, RGB] = [[196, 40, 14], [64, 22, 14]];
const CRUST: [RGB, RGB] = [[52, 28, 22], [92, 88, 84]];
const CRUST_HI: [RGB, RGB] = [[104, 58, 40], [138, 133, 126]];

/**
 * Crust plates floating on the body: centre (fractions of W across, H up) + size (fractions of L), in the
 * order the crust spreads as it cools. Each is an irregular rounded lump (see plateShape).
 */
const PLATES: [number, number, number, number][] = [
  [-0.7, 0.5, 0.13, 0.09],
  [0.35, 0.47, 0.14, 0.08],
  [-0.25, 0.8, 0.12, 0.075],
  [0.62, 0.76, 0.11, 0.07],
  [-0.15, 0.48, 0.1, 0.07],
  [-0.78, 0.76, 0.1, 0.075],
  [0.9, 0.55, 0.08, 0.08],
  [0.15, 0.68, 0.11, 0.06],
  [-0.05, 0.94, 0.12, 0.045],
  [-0.48, 0.64, 0.08, 0.06],
  [0.5, 0.34, 0.09, 0.05],
  [-0.55, 0.34, 0.1, 0.05],
];
/** Fixed lumpy outlines for the plates (unit circle, six wobbled points each). */
const PLATE_PTS = PLATES.map((_, k) => Array.from({ length: 6 }, (_, j) => {
  const a = (j / 6) * Math.PI * 2 + k * 0.7;
  const r = 0.72 + (((k * 7 + j * 13) % 10) / 10) * 0.45;
  return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
}));

/** Add every plate up to n to the current path (one path, smooth lumps). */
function platePath(c: Ctx, n: number, W: number, H: number, L: number, grow: number, t: number) {
  for (let k = 0; k < n; k++) {
    const [px, py, rx, ry] = PLATES[k];
    const cx = px * W + Math.sin(t * 0.7 + k) * L * 0.006;
    const cy = -py * H;
    const pts = PLATE_PTS[k].map(([x, y]) => [cx + x * rx * L * grow, cy + y * ry * L * grow] as [number, number]);
    const m = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
    const m0 = m(pts[pts.length - 1], pts[0]);
    c.moveTo(m0[0], m0[1]);
    for (let i = 0; i < pts.length; i++) {
      const q = m(pts[i], pts[(i + 1) % pts.length]);
      c.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]);
    }
    c.closePath();
  }
}

/** A wobbly blob through these points (closed). */
function blob(c: Ctx, pts: [number, number][]) {
  const n = pts.length;
  c.beginPath();
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const m0 = mid(pts[n - 1], pts[0]);
  c.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  c.closePath();
}

export function paintLava(c: Ctx, L: number, p: DinoPose, fine: boolean) {
  const t = p.t;
  const stone = !!p.stone;
  const heat = stone ? 0 : Math.max(0, Math.min(1, p.heat ?? 1));
  const cold = 1 - heat;
  const joy = stone ? 0 : Math.max(0, Math.min(1, p.joy ?? 0));
  const sink = Math.max(0, Math.min(1, p.sink ?? 0));
  const wind = Math.max(0, Math.min(1, p.wind ?? 0));
  const H = L * 1.05;
  const W = L * 0.38;
  // how hot it's burning right now (a slow throb, faster with its mouth open)
  const pulse = (0.8 + Math.sin(t * 2.3) * 0.15 + p.mouth * 0.15) * (0.25 + heat * 0.75);
  const step = Math.sin(p.walk) * (1 - sink);
  // cheering: it bounces on the spot
  const bob = Math.abs(Math.cos(p.walk)) * L * 0.025 * p.stride * (1 - sink) + Math.abs(Math.sin(t * 9)) * L * 0.07 * joy * (1 - sink * 0.6);
  // a statue is all stone (grey, with dark seams where the lava was)
  const core = stone ? "#9a958d" : mix(CORE[0], CORE[1], cold);
  const molten = stone ? "#86817a" : mix(MOLTEN[0], MOLTEN[1], cold);
  const edge = stone ? "#6a655f" : mix(EDGE[0], EDGE[1], cold);
  const crust = stone ? "#7d7871" : mix(CRUST[0], CRUST[1], cold);
  const crustHi = stone ? "#aaa59c" : mix(CRUST_HI[0], CRUST_HI[1], cold);

  // heat glow round it, on the ground and in the air (none for a statue)
  const prev = c.globalCompositeOperation;
  c.globalCompositeOperation = stone ? prev : "lighter";
  const g = c.createRadialGradient(0, -H * 0.4, L * 0.05, 0, -H * 0.35, L * (0.9 + sink * 0.3));
  g.addColorStop(0, `rgba(255,120,40,${(0.36 * pulse).toFixed(3)})`);
  g.addColorStop(0.55, `rgba(255,80,20,${(0.13 * pulse).toFixed(3)})`);
  g.addColorStop(1, "rgba(255,60,10,0)");
  if (!stone) {
    c.fillStyle = g;
    c.fillRect(-L, -H * 1.4, L * 2, H * 1.6);
  }
  c.globalCompositeOperation = prev;

  // the glowing puddle it leaves where it stands (not while it swims: the pool is all round it)
  if (!sink && heat > 0.2 && !stone) {
    c.fillStyle = `rgba(255,110,30,${(0.45 * heat).toFixed(3)})`;
    c.beginPath();
    c.ellipse(L * 0.02, 0, L * 0.3, L * 0.07, 0, 0, Math.PI * 2);
    c.fill();
  }

  c.save();
  if (p.lie > 0) {
    // slumped flat
    c.translate(0, -L * 0.02);
    c.scale(1 + p.lie * 0.35, 1 - p.lie * 0.55);
  }
  // swimming: it sits low in the lava (everything under the surface is cut off)
  if (sink > 0) {
    c.save();
    c.beginPath();
    c.rect(-L * 2, -H * 2, L * 4, H * 2);
    c.clip();
    c.translate(0, sink * H * 0.42 + Math.sin(t * 1.6) * L * 0.015);
  }
  c.translate(0, -bob);

  // legs: two stumpy columns of lava with crust on the shins
  const leg = (x: number, swing: number) => {
    const fx = x + swing * L * 0.09;
    blob(c, [[x - L * 0.08, -H * 0.3], [x + L * 0.08, -H * 0.3], [fx + L * 0.1, -L * 0.01], [fx + L * 0.02, L * 0.02], [fx - L * 0.1, -L * 0.005]]);
    c.fillStyle = edge;
    c.fill();
    blob(c, [[x - L * 0.07, -H * 0.24], [x + L * 0.05, -H * 0.27], [fx + L * 0.08, -L * 0.05], [fx - L * 0.08, -L * 0.04]]);
    c.fillStyle = crust;
    c.fill();
  };
  leg(-L * 0.12, -step * p.stride);
  leg(L * 0.12, step * p.stride);

  // an arm: a molten club with a crust plate on the shoulder; the near one goes up to throw
  const arm = (side: number, swing: number, near: boolean) => {
    const sx = side * W * 0.85;
    const sy = -H * 0.64;
    let hx = sx + side * L * 0.1 + swing * L * 0.12;
    let hy = -H * 0.26;
    if (joy > 0 && !(near && wind > 0)) {
      // cheering: both fists up in the air, waving
      const up = joy * (0.85 + Math.sin(t * 9 + side) * 0.15);
      hx += (sx + side * L * 0.16 - hx) * up;
      hy += (-H * 1.25 - hy) * up;
    }
    if (near && wind > 0) {
      // the wind-up: back and up over its head
      hx += (-L * 0.32 - hx + sx) * wind;
      hy += (-H * 1.22 - hy) * wind;
    }
    blob(c, [[sx - L * 0.07, sy - L * 0.04], [sx + L * 0.07, sy - L * 0.02], [hx + L * 0.1, hy], [hx + L * 0.03, hy + L * 0.11], [hx - L * 0.09, hy + L * 0.04]]);
    c.fillStyle = near ? molten : edge;
    c.fill();
    blob(c, [[sx - L * 0.07, sy - L * 0.05], [sx + L * 0.08, sy - L * 0.03], [sx + L * 0.05, sy + L * 0.08], [sx - L * 0.06, sy + L * 0.07]]);
    c.fillStyle = near ? crustHi : crust;
    c.fill();
    // molten fist (with the ball it's packing, when throwing)
    c.fillStyle = core;
    c.beginPath();
    c.ellipse(hx, hy + L * 0.06, L * 0.06, L * 0.045, 0, 0, Math.PI * 2);
    c.fill();
    if (near && wind > 0) {
      const r = L * 0.14 * wind;
      const bg = c.createRadialGradient(hx - r * 0.3, hy - r * 0.3, r * 0.1, hx, hy, r);
      bg.addColorStop(0, "#fff6c0");
      bg.addColorStop(0.5, "#ffb238");
      bg.addColorStop(1, "#d8380f");
      c.fillStyle = bg;
      c.beginPath();
      c.arc(hx, hy, r, 0, Math.PI * 2);
      c.fill();
    }
  };
  arm(-1, step * p.stride, false);

  // the body: a lumpy hunched torso of molten rock with broad shoulders (its head sits on top, below)
  // (its outline sags and bulges: lumps on the shoulders, molten tongues drooping off the bottom edge)
  const sag = stone ? 0 : Math.sin(t * 1.3) * H * 0.012;
  const body: [number, number][] = [
    [-W * 0.95, -H * 0.3], [-W * 1.14, -H * 0.46], [-W * 1.06, -H * 0.62], [-W * 0.86, -H * 0.74],
    [-W * 0.5, -H * 0.8], [-W * 0.1, -H * 0.79], [W * 0.3, -H * 0.81], [W * 0.72, -H * 0.76],
    [W * 1.04, -H * 0.66], [W * 1.16, -H * 0.5], [W * 1.02, -H * 0.38],
    [W * 0.9, -H * 0.22 + sag], [W * 0.62, -H * 0.3], [W * 0.3, -H * 0.18 - sag], [-W * 0.05, -H * 0.28],
    [-W * 0.4, -H * 0.2 + sag], [-W * 0.7, -H * 0.29],
  ];
  blob(c, body);
  const lava = c.createRadialGradient(W * 0.1, -H * 0.55, L * 0.04, 0, -H * 0.52, L * 0.55);
  lava.addColorStop(0, core);
  lava.addColorStop(0.45, molten);
  lava.addColorStop(1, edge);
  c.fillStyle = lava;
  c.fill();
  // a slow flow across the molten surface (lighter streaks drifting down it)
  if (fine && heat > 0.25 && !stone) {
    c.save();
    blob(c, body);
    c.clip();
    c.strokeStyle = core;
    c.globalAlpha = 0.35 * heat;
    c.lineWidth = Math.max(1, L * 0.02);
    c.lineCap = "round";
    c.beginPath();
    for (let k = 0; k < 4; k++) {
      const y0 = -H + ((t * 0.18 + k * 0.27) % 1) * H * 0.8;
      c.moveTo(-W * 1.1, y0);
      c.quadraticCurveTo(0, y0 + H * 0.06 * Math.sin(t + k), W * 1.1, y0 - H * 0.04);
    }
    c.stroke();
    c.restore();
  }

  // crust plates floating on it: a few when it's hot, almost all over (and bigger) when it's cold.
  // Each has a glowing seam of molten rock round it, like a lava flow cooling over.
  const plates = Math.round(PLATES.length * (0.75 + cold * 0.25));
  const grow = 1.55 + cold * 0.45;
  c.save();
  blob(c, body);
  c.clip();
  c.beginPath();
  platePath(c, plates, W, H, L, grow, t);
  if (heat > 0.15 || stone) {
    c.strokeStyle = stone ? "#4f4b46" : core;
    c.globalAlpha = 0.55 + heat * 0.45;
    c.lineWidth = Math.max(1.4, L * 0.05 * (0.35 + heat * 0.65));
    c.lineJoin = "round";
    c.stroke();
    c.globalAlpha = 1;
  }
  c.fillStyle = crust;
  c.fill();
  if (fine) {
    // a lighter sheen on each plate, and a few dark cracks across the crust as it cools
    c.beginPath();
    for (let k = 0; k < plates; k++) {
      const [px, py, rx, ry] = PLATES[k];
      c.moveTo(px * W - rx * L * 0.5 * grow, -py * H - ry * L * 0.35 * grow);
      c.quadraticCurveTo(px * W, -py * H - ry * L * 0.7 * grow, px * W + rx * L * 0.45 * grow, -py * H - ry * L * 0.3 * grow);
    }
    c.strokeStyle = crustHi;
    c.lineWidth = Math.max(0.8, L * 0.014);
    c.lineCap = "round";
    c.stroke();
    if (cold > 0.4) {
      c.beginPath();
      for (let k = 0; k < plates; k += 2) {
        const [px, py, rx] = PLATES[k];
        c.moveTo(px * W - rx * L * 0.3, -py * H);
        c.lineTo(px * W + rx * L * 0.1, -py * H + L * 0.02);
        c.lineTo(px * W + rx * L * 0.35, -py * H - L * 0.01);
      }
      c.strokeStyle = `rgba(150,40,14,${(0.4 + heat * 0.5).toFixed(3)})`;
      c.lineWidth = Math.max(0.6, L * 0.008);
      c.stroke();
    }
  }
  c.restore();

  // the head: a lump of lava on its shoulders, a little forward (bobbing as it walks)
  const hr = L * 0.25;
  const hcx = W * 0.38 + Math.sin(p.walk) * L * 0.01;
  // (it sits down into the shoulders: no neck, just a lump of lava on a lump of lava)
  const hcy = -H * 0.8 - hr * 0.5 + (stone ? 0 : Math.sin(t * 1.7) * L * 0.008);
  const head: [number, number][] = [
    [hcx - hr * 0.95, hcy + hr * 0.15], [hcx - hr * 0.8, hcy - hr * 0.55], [hcx - hr * 0.3, hcy - hr * 0.9],
    [hcx + hr * 0.3, hcy - hr * 0.95], [hcx + hr * 0.85, hcy - hr * 0.6], [hcx + hr * 1.05, hcy],
    [hcx + hr * 0.85, hcy + hr * 0.6], [hcx + hr * 0.2, hcy + hr * 0.82], [hcx - hr * 0.55, hcy + hr * 0.7],
  ];
  blob(c, head);
  const hg = c.createRadialGradient(hcx + hr * 0.2, hcy - hr * 0.2, hr * 0.1, hcx, hcy, hr * 1.1);
  hg.addColorStop(0, core);
  hg.addColorStop(0.55, molten);
  hg.addColorStop(1, edge);
  c.fillStyle = hg;
  c.fill();
  // crust on the head too: a cap on the crown + a heavy brow, more of it as it cools
  c.save();
  blob(c, head);
  c.clip();
  c.beginPath();
  c.ellipse(hcx - hr * 0.35, hcy - hr * 0.75, hr * (0.55 + cold * 0.35), hr * (0.32 + cold * 0.25), -0.3, 0, Math.PI * 2);
  c.ellipse(hcx - hr * 0.75, hcy + hr * 0.2, hr * (0.3 + cold * 0.3), hr * (0.35 + cold * 0.2), 0, 0, Math.PI * 2);
  if (cold > 0.35 || stone) c.ellipse(hcx + hr * 0.2, hcy + hr * 0.62, hr * 0.5 * cold, hr * 0.25 * cold, 0, 0, Math.PI * 2);
  if (heat > 0.15) {
    c.strokeStyle = core;
    c.lineWidth = Math.max(1.2, L * 0.03 * (0.35 + heat * 0.65));
    c.stroke();
  }
  c.fillStyle = crust;
  c.fill();
  c.restore();
  if (fine) {
    blob(c, head);
    c.strokeStyle = "rgba(20,8,4,0.7)";
    c.lineWidth = Math.max(0.8, L * 0.013);
    c.stroke();
  }

  // bubbles swelling + popping on its head (only while it's molten)
  if (heat > 0.3 && !stone) {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.8 + k * 0.33) % 1;
      const bx = hcx + (k - 1) * hr * 0.45;
      const by = hcy - hr * (0.78 + (k % 2) * 0.1);
      const r = L * 0.035 * Math.sin(ph * Math.PI) * heat;
      if (r < 0.4) continue;
      c.fillStyle = core;
      c.beginPath();
      c.arc(bx, by, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = edge;
      c.lineWidth = Math.max(0.6, L * 0.008);
      c.stroke();
    }
  }

  // drips running off it (it leaves a trail of them)
  if (heat > 0.2 && !stone) {
    c.fillStyle = molten;
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.6 + i * 0.29) % 1;
      const dx = [-W * 0.98, W * 1.02, -W * 0.5, W * 0.6][i];
      const y0 = [-H * 0.55, -H * 0.62, -H * 0.3, -H * 0.32][i];
      c.globalAlpha = (1 - k) * heat;
      c.beginPath();
      c.ellipse(dx, y0 + k * H * 0.3, L * 0.022, L * 0.03 + k * L * 0.02, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // the face, on the front of its head: two white-hot eyes under a heavy crust brow, a glowing mouth
  const fx = hcx + hr * 0.45;
  const fy = hcy - hr * 0.08;
  c.fillStyle = crust;
  c.beginPath();
  c.ellipse(fx - L * 0.02, fy - L * 0.05, L * 0.12, L * 0.035, -0.1, 0, Math.PI * 2);
  c.fill();
  const eye = p.eyesClosed ? 0.25 : 1;
  c.fillStyle = "#1a0d08";
  c.beginPath();
  for (const ex of [fx - L * 0.07, fx + L * 0.04]) {
    c.moveTo(ex + L * 0.045, fy);
    c.ellipse(ex, fy, L * 0.045, L * 0.038 * eye, 0, 0, Math.PI * 2);
  }
  c.fill();
  c.fillStyle = stone ? "#5c5852" : heat > 0.3 ? "#fff3b0" : mix([255, 200, 120], [160, 60, 30], cold);
  c.beginPath();
  for (const ex of [fx - L * 0.07, fx + L * 0.04]) {
    c.moveTo(ex + L * 0.028, fy);
    c.ellipse(ex + L * 0.004, fy, L * 0.028, L * 0.024 * eye, 0, 0, Math.PI * 2);
  }
  c.fill();
  // (a big grin when it's cheering)
  const open = 0.014 + Math.max(p.mouth, joy * 0.7) * 0.05;
  c.fillStyle = "#1a0d08";
  c.beginPath();
  c.ellipse(fx - L * 0.01, fy + L * 0.085, L * 0.08, L * (open + 0.012), 0.08, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = stone ? "#4f4b46" : core;
  c.beginPath();
  c.ellipse(fx - L * 0.01, fy + L * 0.085, L * 0.062, L * open, 0.08, 0, Math.PI * 2);
  c.fill();

  // the near arm, in front
  arm(1, -step * p.stride, true);

  // a dark inked edge so it reads against bright ground (one stroke)
  if (fine) {
    blob(c, body);
    c.strokeStyle = "rgba(20,8,4,0.7)";
    c.lineWidth = Math.max(0.8, L * 0.013);
    c.stroke();
  }
  c.restore();

  if (sink > 0) {
    c.restore();
    // the lava closing round it: a bright ring + slow ripples
    c.globalCompositeOperation = "lighter";
    c.fillStyle = "rgba(255,150,50,0.5)";
    c.beginPath();
    c.ellipse(0, 0, L * 0.42, L * 0.1, 0, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = prev;
    c.strokeStyle = "rgba(255,226,140,0.85)";
    c.lineWidth = Math.max(1, L * 0.02);
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.5 + k * 0.5) % 1;
      c.globalAlpha = 1 - ph;
      c.beginPath();
      c.ellipse(0, 0, L * (0.36 + ph * 0.3), L * (0.08 + ph * 0.06), 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

/**
 * The Lava Monsters' hot tub (sim/lavaFolk.ts lavaTub): a ring of dark lava rocks round an oval of molten
 * lava, swirling, bubbling and steaming. Drawn flat on the ground at its centre (0, 0); rx, ry = the oval.
 */
export function drawLavaTub(c: Ctx, rx: number, ry: number, t: number) {
  // the dark scorched ground round it
  c.fillStyle = "rgba(40,22,14,0.45)";
  c.beginPath();
  c.ellipse(0, 2, rx * 1.28, ry * 1.32, 0, 0, Math.PI * 2);
  c.fill();
  // the lava: white-hot in the middle, orange, deep red at the rim
  const g = c.createRadialGradient(-rx * 0.15, -ry * 0.1, ry * 0.1, 0, 0, rx);
  g.addColorStop(0, "#fff1a8");
  g.addColorStop(0.35, "#ffb238");
  g.addColorStop(0.75, "#f0601a");
  g.addColorStop(1, "#a8260c");
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  // a slow swirl across the surface + floating crust flakes
  c.save();
  c.beginPath();
  c.ellipse(0, 0, rx * 0.96, ry * 0.94, 0, 0, Math.PI * 2);
  c.clip();
  c.strokeStyle = "rgba(255,240,170,0.55)";
  c.lineWidth = 2;
  c.lineCap = "round";
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = t * 0.35 + k * 2.1;
    const r = rx * (0.35 + k * 0.18);
    c.ellipse(0, 0, r, r * (ry / rx), 0, a, a + 1.4);
  }
  c.stroke();
  c.fillStyle = "rgba(60,26,16,0.75)";
  c.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = t * 0.2 + k * 1.3;
    const r = 0.45 + (k % 3) * 0.17;
    const x = Math.cos(a) * rx * r;
    const y = Math.sin(a) * ry * r;
    c.moveTo(x + 5, y);
    c.ellipse(x, y, 5 + (k % 2) * 3, 2.5, a, 0, Math.PI * 2);
  }
  c.fill();
  // bubbles swelling up and popping
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.7 + k * 0.27) % 1;
    const bx = Math.cos(k * 2.4 + 1) * rx * 0.5;
    const by = Math.sin(k * 2.4 + 1) * ry * 0.45;
    const r = Math.sin(ph * Math.PI) * 4.5;
    if (r < 0.5) continue;
    c.fillStyle = "#fff6c0";
    c.beginPath();
    c.arc(bx, by - r * 0.4, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(200,60,16,0.8)";
    c.lineWidth = 1;
    c.stroke();
  }
  c.restore();
  // the rim: a ring of rounded lava rocks, the near ones bigger (the far ones half hidden)
  const n = 16;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.1;
      const front = Math.sin(a) > 0;
      if ((pass === 0) === front) continue;
      const x = Math.cos(a) * rx * 1.04;
      const y = Math.sin(a) * ry * 1.06;
      const s = (front ? 9 : 7) + ((k * 7) % 4);
      c.fillStyle = front ? "#3b2a26" : "#2e211e";
      c.beginPath();
      c.ellipse(x, y - s * 0.3, s * 1.15, s * 0.75, a * 0.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,150,70,0.35)";
      c.beginPath();
      c.ellipse(x - Math.cos(a) * s * 0.35, y - s * 0.55, s * 0.6, s * 0.25, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  // steam drifting off it
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.25 + k / 3) % 1;
    c.fillStyle = `rgba(235,230,225,${(0.28 * (1 - ph)).toFixed(3)})`;
    c.beginPath();
    c.ellipse((k - 1) * rx * 0.4 + Math.sin(t + k) * 6, -ph * ry * 3.2, 10 + ph * 16, 6 + ph * 9, 0, 0, Math.PI * 2);
    c.fill();
  }
}
