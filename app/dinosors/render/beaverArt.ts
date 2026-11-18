/* ------------------------------------------------------------------ */
/*  A giant beaver (sim/beavers.ts). Feet at (0, 0), facing +x,        */
/*  L = its size (px). `p.sink` (0..1): swimming low (just its head    */
/*  and back show; 1 = under, diving: only rings + bubbles). `p.mouth` */
/*  gnawing / nibbling. `p.hold`: a stick in its teeth, a fish in its  */
/*  paws (it sits up to eat it).                                       */
/* ------------------------------------------------------------------ */
import type { DinoPose } from "./drawDino";

type Ctx = CanvasRenderingContext2D;
interface Hide {
  body: string;
  dark: string;
  belly: string;
  accent: string;
}

/** A tiny hash, so each stick of a dam lies the same way every frame. */
const h = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * A beaver dam across a stream: (0, 0) is the middle of its crest, `w` its width (px), `done` 0..1
 * how far built (a few sticks, then a long heap of them packed with mud). Finished, water spills over
 * it in a little white curtain.
 */
export function drawDam(c: Ctx, width: number, done: number, t: number, fine: boolean) {
  const n = Math.max(2, Math.round(done * 26));
  const hh = 6 + done * 10;
  // the mud packed in between: a low brown mound under the sticks
  if (done > 0.25) {
    c.fillStyle = "#5a4330";
    c.beginPath();
    c.ellipse(0, 2, width * 0.55 * Math.min(1, done + 0.2), hh * 0.6, 0, Math.PI, 0);
    c.lineTo(width * 0.55, 6);
    c.lineTo(-width * 0.55, 6);
    c.closePath();
    c.fill();
  }
  // sticks: laid across the stream, the heap getting longer + higher as they're added
  for (let k = 0; k < n; k++) {
    const r1 = h(k + 1);
    const r2 = h(k + 7.3);
    const x = (r1 - 0.5) * width * Math.min(1, 0.35 + done * 0.75);
    const y = 4 - r2 * hh;
    const len = 12 + h(k + 3.1) * 14;
    const a = (h(k + 5.9) - 0.5) * 1.1;
    c.strokeStyle = k % 3 === 0 ? "#8a6a43" : k % 3 === 1 ? "#6f5133" : "#a17d52";
    c.lineWidth = 2.6 + h(k + 2.2) * 1.6;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5);
    c.lineTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5);
    c.stroke();
    // the gnawed white ends
    if (fine) {
      c.fillStyle = "#e8d2a6";
      c.beginPath();
      c.arc(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, c.lineWidth * 0.45, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.lineCap = "butt";
  if (done < 1) return;
  // the water spilling over the crest: a white curtain + foam at the foot
  c.fillStyle = "rgba(220,240,250,0.55)";
  c.beginPath();
  c.ellipse(0, 9, width * 0.4, 3.2, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(240,250,255,0.75)";
  c.lineWidth = 1.4;
  for (let k = 0; k < 6; k++) {
    const x = (k / 5 - 0.5) * width * 0.7;
    const ph = (t * 1.6 + k * 0.29) % 1;
    c.globalAlpha = 1 - ph * 0.7;
    c.beginPath();
    c.moveTo(x, 2);
    c.lineTo(x + 0.5, 6 + ph * 6);
    c.stroke();
  }
  c.globalAlpha = 1;
}

/** A beaver lodge: a dome of sticks and mud standing out of its pond. (0, 0) = its foot at the waterline. */
export function drawLodge(c: Ctx, t: number, fine: boolean) {
  // its reflection-ish shadow on the water
  c.fillStyle = "rgba(20,40,50,0.3)";
  c.beginPath();
  c.ellipse(0, 2, 40, 9, 0, 0, Math.PI * 2);
  c.fill();
  // the mud dome
  c.fillStyle = "#5e4632";
  c.beginPath();
  c.ellipse(0, 0, 34, 26, 0, Math.PI, 0);
  c.closePath();
  c.fill();
  c.fillStyle = "#6e543b";
  c.beginPath();
  c.ellipse(-6, -4, 24, 18, 0, Math.PI, 0);
  c.closePath();
  c.fill();
  // sticks poking out every which way
  c.lineCap = "round";
  for (let k = 0; k < 22; k++) {
    const a = Math.PI + h(k + 0.5) * Math.PI;
    const r = 8 + h(k + 4.4) * 18;
    const x = Math.cos(a) * r * 1.3;
    const y = Math.sin(a) * r;
    const len = 9 + h(k + 8.8) * 12;
    const b = a + (h(k + 1.7) - 0.5) * 2.2;
    c.strokeStyle = k % 2 ? "#8a6a43" : "#a17d52";
    c.lineWidth = 2 + h(k + 3.3) * 1.4;
    c.beginPath();
    c.moveTo(x - Math.cos(b) * len * 0.5, y - Math.sin(b) * len * 0.5);
    c.lineTo(x + Math.cos(b) * len * 0.5, y + Math.sin(b) * len * 0.5);
    c.stroke();
  }
  c.lineCap = "butt";
  // the water lapping round its foot
  if (fine) {
    c.strokeStyle = "rgba(235,248,255,0.55)";
    c.lineWidth = 1;
    const ph = (t * 0.4) % 1;
    c.globalAlpha = 1 - ph;
    c.beginPath();
    c.ellipse(0, 1, 36 + ph * 10, 6 + ph * 3, 0, 0, Math.PI);
    c.stroke();
    c.globalAlpha = 1;
  }
}

function rings(c: Ctx, L: number, t: number, n: number) {
  c.strokeStyle = "rgba(235,248,255,0.6)";
  c.lineWidth = Math.max(0.8, L * 0.02);
  for (let k = 0; k < n; k++) {
    const ph = (t * 0.6 + k / n) % 1;
    c.globalAlpha = 1 - ph;
    c.beginPath();
    c.ellipse(0, 0, L * (0.25 + ph * 0.4), L * (0.06 + ph * 0.07), 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;
}

export function paintBeaver(c: Ctx, L: number, p: DinoPose, hide: Hide, fine: boolean) {
  const t = p.t;
  const sink = Math.max(0, Math.min(1, p.sink ?? 0));
  if (sink >= 1) {
    // under water, diving for a fish: rings, and bubbles coming up
    c.fillStyle = "rgba(30,70,90,0.25)";
    c.beginPath();
    c.ellipse(0, 0, L * 0.3, L * 0.07, 0, 0, Math.PI * 2);
    c.fill();
    rings(c, L, t, 3);
    c.fillStyle = "rgba(240,250,255,0.85)";
    for (let k = 0; k < 3; k++) {
      const ph = (t * 1.3 + k * 0.37) % 1;
      c.beginPath();
      c.arc(Math.sin(k * 2.1 + t) * L * 0.12, -ph * L * 0.06, L * 0.025 * (1 - ph * 0.5), 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  const mouth = Math.max(0, Math.min(1, p.mouth));
  // sat up on its haunches, nibbling a fish held in its paws
  const sitUp = p.hold === "fish" && sink < 0.3;
  const paint = () => body(c, L, p, hide, fine, mouth, sitUp);
  if (sink <= 0) {
    paint();
    return;
  }
  c.save();
  c.beginPath();
  c.rect(-L * 2, -L * 2, L * 4, L * 2);
  c.clip();
  c.translate(0, sink * L * 0.32);
  paint();
  c.restore();
  // swimming: a V of wake behind it as it goes, the water closing round it
  c.fillStyle = "rgba(30,70,90,0.28)";
  c.beginPath();
  c.ellipse(0, 0, L * 0.45, L * 0.08, 0, 0, Math.PI * 2);
  c.fill();
  if (p.stride > 0.2) {
    c.strokeStyle = "rgba(235,248,255,0.55)";
    c.lineWidth = Math.max(0.8, L * 0.02);
    c.beginPath();
    c.moveTo(L * 0.3, 0);
    c.lineTo(-L * 0.6, -L * 0.1);
    c.moveTo(L * 0.3, 0);
    c.lineTo(-L * 0.6, L * 0.1);
    c.stroke();
  } else rings(c, L, t, 2);
}

function body(c: Ctx, L: number, p: DinoPose, hide: Hide, fine: boolean, mouth: number, sitUp: boolean) {
  const t = p.t;
  const step = Math.sin(p.walk) * p.stride;
  const bob = Math.abs(step) * L * 0.02;
  // the tail: a flat, scaly paddle, slapping now and then
  const tailUp = sitUp ? 0.15 : Math.max(0, Math.sin(t * 0.7)) ** 8 * 0.4;
  c.save();
  c.translate(-L * 0.3, -L * 0.07);
  c.rotate(-tailUp);
  c.fillStyle = "#3b2a1f";
  c.beginPath();
  c.ellipse(-L * 0.17, 0, L * 0.2, L * 0.06, 0, 0, Math.PI * 2);
  c.fill();
  if (fine) {
    c.strokeStyle = "rgba(0,0,0,0.3)";
    c.lineWidth = Math.max(0.5, L * 0.008);
    c.beginPath();
    for (let k = 1; k < 5; k++) {
      const x = -L * 0.34 + k * L * 0.07;
      c.moveTo(x, -L * 0.045);
      c.lineTo(x, L * 0.045);
    }
    c.moveTo(-L * 0.35, 0);
    c.lineTo(L * 0.01, 0);
    c.stroke();
  }
  c.restore();
  c.save();
  if (sitUp) {
    // up on its haunches: the whole beaver tips back
    c.translate(-L * 0.12, 0);
    c.rotate(-0.85);
    c.translate(L * 0.12, 0);
  }
  // back legs (big webbed feet), front legs (little hands)
  c.fillStyle = hide.dark;
  for (const [lx, ph, r] of [[-0.16, 0, 0.07], [0.14, Math.PI, 0.045]] as const) {
    const sw = Math.sin(p.walk + ph) * L * 0.05 * p.stride;
    c.beginPath();
    c.ellipse(lx * L + sw, -L * 0.03, L * r, L * 0.035, 0, 0, Math.PI * 2);
    c.fill();
  }
  // the body: a big round lump of thick fur
  const by = -L * 0.17 - bob;
  c.fillStyle = hide.body;
  c.beginPath();
  c.ellipse(-L * 0.02, by, L * 0.3, L * 0.16, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = hide.belly;
  c.beginPath();
  c.ellipse(L * 0.02, by + L * 0.07, L * 0.22, L * 0.07, 0, 0, Math.PI * 2);
  c.fill();
  if (fine) {
    // fur: a few darker tufts along the back
    c.strokeStyle = hide.dark;
    c.globalAlpha = 0.5;
    c.lineWidth = Math.max(0.6, L * 0.012);
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const x = -L * 0.24 + k * L * 0.09;
      const y = by - L * 0.13 + Math.abs(x) * 0.25;
      c.moveTo(x, y);
      c.lineTo(x - L * 0.03, y + L * 0.04);
    }
    c.stroke();
    c.globalAlpha = 1;
  }
  // the head
  const gnaw = Math.sin(t * 24) * mouth;
  const hx = L * 0.27;
  const hy = by - L * 0.04 + gnaw * L * 0.01;
  c.fillStyle = hide.body;
  c.beginPath();
  c.ellipse(hx, hy, L * 0.13, L * 0.11, 0.15, 0, Math.PI * 2);
  c.fill();
  // ears
  c.fillStyle = hide.dark;
  c.beginPath();
  c.arc(hx - L * 0.05, hy - L * 0.09, L * 0.03, 0, Math.PI * 2);
  c.fill();
  // muzzle + nose
  c.fillStyle = hide.belly;
  c.beginPath();
  c.ellipse(hx + L * 0.1, hy + L * 0.025, L * 0.06, L * 0.05, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1d130d";
  c.beginPath();
  c.ellipse(hx + L * 0.15, hy, L * 0.025, L * 0.018, 0, 0, Math.PI * 2);
  c.fill();
  // the big orange front teeth (they chatter as it gnaws)
  c.fillStyle = "#f0a23a";
  c.fillRect(hx + L * 0.1, hy + L * 0.06 + Math.max(0, gnaw) * L * 0.02, L * 0.035, L * 0.06);
  if (fine) {
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = Math.max(0.4, L * 0.006);
    c.beginPath();
    c.moveTo(hx + L * 0.1175, hy + L * 0.06);
    c.lineTo(hx + L * 0.1175, hy + L * 0.12);
    c.stroke();
  }
  // eye
  c.fillStyle = "#120c08";
  c.beginPath();
  if (p.eyesClosed) c.fillRect(hx + L * 0.01, hy - L * 0.03, L * 0.04, L * 0.008);
  else c.arc(hx + L * 0.03, hy - L * 0.03, L * 0.02, 0, Math.PI * 2);
  c.fill();
  if (fine && !p.eyesClosed) {
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.beginPath();
    c.arc(hx + L * 0.036, hy - L * 0.036, L * 0.007, 0, Math.PI * 2);
    c.fill();
  }
  // whiskers
  if (fine) {
    c.strokeStyle = "rgba(240,230,210,0.7)";
    c.lineWidth = Math.max(0.4, L * 0.005);
    c.beginPath();
    for (const dy of [-0.01, 0.015]) {
      c.moveTo(hx + L * 0.13, hy + L * 0.03);
      c.lineTo(hx + L * 0.22, hy + L * (0.03 + dy * 2));
    }
    c.stroke();
  }
  // what it's holding
  if (p.hold === "stick") {
    // a leafy stick, crossways in its teeth
    c.save();
    c.translate(hx + L * 0.12, hy + L * 0.08);
    c.rotate(-0.25);
    c.fillStyle = "#8a6a43";
    c.fillRect(-L * 0.32, -L * 0.018, L * 0.62, L * 0.036);
    c.fillStyle = "#6f8f3a";
    for (const x of [-0.28, -0.1, 0.18]) {
      c.beginPath();
      c.ellipse(x * L, -L * 0.04, L * 0.05, L * 0.022, -0.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  } else if (p.hold === "fish") {
    // a silver fish in its little hands, held up to the teeth
    c.save();
    c.translate(hx + L * 0.08, hy + L * 0.13);
    c.rotate(0.3 + gnaw * 0.05);
    c.fillStyle = "#b8c9d6";
    c.beginPath();
    c.ellipse(0, 0, L * 0.11, L * 0.04, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-L * 0.1, 0);
    c.lineTo(-L * 0.17, -L * 0.045);
    c.lineTo(-L * 0.17, L * 0.045);
    c.closePath();
    c.fill();
    c.fillStyle = "#6f8aa0";
    c.fillRect(-L * 0.08, -L * 0.012, L * 0.16, L * 0.012);
    c.fillStyle = "#14202a";
    c.beginPath();
    c.arc(L * 0.07, -L * 0.008, L * 0.01, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = hide.dark;
    c.beginPath();
    c.ellipse(hx + L * 0.06, hy + L * 0.15, L * 0.03, L * 0.025, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
