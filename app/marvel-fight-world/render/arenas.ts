/* ------------------------------------------------------------------ */
/*  Arenas — original, comic-inspired stages drawn procedurally          */
/*                                                                      */
/*  Each arena has parallax layers (static ones are cached to offscreen */
/*  canvases), animated details and optional destructible props.        */
/* ------------------------------------------------------------------ */

import type { PropSpec } from "../engine/match";

export type ArenaId = "rooftop" | "street" | "lab" | "space" | "volcano" | "temple";

export interface ArenaDef {
  id: ArenaId;
  name: string;
  tagline: string;
  /** Accent used by menus */
  color: string;
  tempo: number;
  props: PropSpec[];
  floor: [string, string];
  /** Dark arenas get a light rim on fighters */
  rim: string;
}

export const ARENAS: ArenaDef[] = [
  {
    id: "rooftop",
    name: "City Rooftop",
    tagline: "Midnight above the skyline. Mind the edge.",
    color: "#60a5fa",
    tempo: 128,
    props: [
      { kind: "vent", x: -640, w: 90, h: 70, hp: 2 },
      { kind: "tank", x: 650, w: 80, h: 110, hp: 3 },
    ],
    floor: ["#374151", "#111827"],
    rim: "#93c5fd",
  },
  {
    id: "street",
    name: "Wrecked Avenue",
    tagline: "Something big came through here.",
    color: "#fb923c",
    tempo: 136,
    props: [
      { kind: "car", x: -600, w: 170, h: 70, hp: 3 },
      { kind: "car", x: 610, w: 170, h: 70, hp: 3 },
    ],
    floor: ["#4b4038", "#1c1917"],
    rim: "#fdba74",
  },
  {
    id: "lab",
    name: "Secret Lab",
    tagline: "Don't touch the glowing stuff.",
    color: "#34d399",
    tempo: 140,
    props: [
      { kind: "console", x: -650, w: 100, h: 90, hp: 2 },
      { kind: "tube", x: 640, w: 70, h: 150, hp: 2 },
    ],
    floor: ["#1f2937", "#030712"],
    rim: "#6ee7b7",
  },
  {
    id: "space",
    name: "Orbital Station",
    tagline: "A long way up, and nowhere to run.",
    color: "#a78bfa",
    tempo: 124,
    props: [{ kind: "crate", x: -620, w: 80, h: 80, hp: 2 }],
    floor: ["#334155", "#0f172a"],
    rim: "#c4b5fd",
  },
  {
    id: "volcano",
    name: "Magma Forge",
    tagline: "Hot enough to melt adamantium. Almost.",
    color: "#f87171",
    tempo: 146,
    props: [{ kind: "rock", x: 620, w: 110, h: 80, hp: 3 }],
    floor: ["#3f1d1d", "#140707"],
    rim: "#fca5a5",
  },
  {
    id: "temple",
    name: "Mystic Temple",
    tagline: "Gravity is more of a suggestion here.",
    color: "#f0abfc",
    tempo: 118,
    props: [
      { kind: "urn", x: -620, w: 60, h: 80, hp: 1 },
      { kind: "urn", x: 620, w: 60, h: 80, hp: 1 },
    ],
    floor: ["#3b2a4a", "#140d1d"],
    rim: "#f5d0fe",
  },
];

export const arenaById = (id: string) => ARENAS.find((a) => a.id === id) ?? ARENAS[0];

/* ── Helpers ──────────────────────────────────────────────────────── */
function hash(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

const layerCache = new Map<string, HTMLCanvasElement>();

/** Draw a tile once into an offscreen canvas and reuse it. */
function cached(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const k = `${key}:${w}x${h}`;
  let c = layerCache.get(k);
  if (!c) {
    c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext("2d")!;
    draw(g);
    layerCache.set(k, c);
    if (layerCache.size > 40) layerCache.delete(layerCache.keys().next().value!);
  }
  return c;
}

/** Repeat a cached tile horizontally with parallax. */
function tileLayer(g: CanvasRenderingContext2D, tile: HTMLCanvasElement, offset: number, y: number, W: number) {
  const tw = tile.width;
  let x = -(((offset % tw) + tw) % tw);
  for (; x < W; x += tw) g.drawImage(tile, Math.round(x), Math.round(y));
}

function skyline(g: CanvasRenderingContext2D, w: number, h: number, seed: number, color: string, windows: string | null, minH: number, maxH: number) {
  let x = 0;
  let i = 0;
  while (x < w) {
    const bw = 40 + hash(seed + i) * 90;
    const bh = minH + hash(seed + i * 7.3) * (maxH - minH);
    g.fillStyle = color;
    g.fillRect(x, h - bh, bw + 1, bh);
    if (hash(seed + i * 3.1) > 0.7) g.fillRect(x + bw * 0.4, h - bh - 24, 4, 24); // antenna
    if (windows) {
      g.fillStyle = windows;
      for (let wy = h - bh + 10; wy < h - 8; wy += 14) {
        for (let wx = x + 6; wx < x + bw - 8; wx += 12) {
          if (hash(wx * 0.37 + wy * 1.91 + seed) > 0.62) g.fillRect(wx, wy, 5, 7);
        }
      }
    }
    x += bw + 2;
    i++;
  }
}

export interface Cam {
  x: number;
  /** world→screen scale */
  s: number;
}

/* ── Background drawing (screen space, behind fighters) ───────────── */
export function drawArenaBack(g: CanvasRenderingContext2D, a: ArenaDef, cam: Cam, t: number, W: number, H: number, groundY: number) {
  const s = cam.s;
  switch (a.id) {
    case "rooftop": {
      const sky = g.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, "#0b1026");
      sky.addColorStop(0.6, "#1e2a5a");
      sky.addColorStop(1, "#3b3f7a");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, groundY);
      // stars + moon
      g.fillStyle = "#fff";
      for (let i = 0; i < 70; i++) {
        const sx = (hash(i) * W * 1.3 - cam.x * s * 0.03) % W;
        g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + i));
        g.fillRect((sx + W) % W, hash(i + 50) * groundY * 0.55, 2, 2);
      }
      g.globalAlpha = 1;
      g.fillStyle = "#fef3c7";
      g.beginPath();
      g.arc(W * 0.78 - cam.x * s * 0.05, groundY * 0.22, 46 * s, 0, Math.PI * 2);
      g.fill();
      // searchlights
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) {
        const bx = W * (0.25 + i * 0.5) - cam.x * s * 0.15;
        const ang = Math.sin(t * 0.4 + i * 2) * 0.5 - Math.PI / 2;
        const grd = g.createLinearGradient(bx, groundY, bx + Math.cos(ang) * groundY, groundY + Math.sin(ang) * groundY);
        grd.addColorStop(0, "rgba(186,230,253,0.18)");
        grd.addColorStop(1, "rgba(186,230,253,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(bx, groundY);
        g.lineTo(bx + Math.cos(ang - 0.08) * groundY * 1.4, groundY + Math.sin(ang - 0.08) * groundY * 1.4);
        g.lineTo(bx + Math.cos(ang + 0.08) * groundY * 1.4, groundY + Math.sin(ang + 0.08) * groundY * 1.4);
        g.fill();
      }
      g.restore();
      const far = cached("roof-far", 1400 * s, 260 * s, (c) => skyline(c, 1400 * s, 260 * s, 3, "#1b2147", "#4c5aa0", 80 * s, 240 * s));
      tileLayer(g, far, cam.x * s * 0.15, groundY - far.height * 1.05, W);
      const mid = cached("roof-mid", 1600 * s, 320 * s, (c) => skyline(c, 1600 * s, 320 * s, 9, "#111530", "#f6d77a", 120 * s, 300 * s));
      tileLayer(g, mid, cam.x * s * 0.35, groundY - mid.height * 0.92, W);
      // helicopter
      const hx = ((t * 60) % (W + 400)) - 200;
      const hy = groundY * 0.3 + Math.sin(t) * 10;
      g.fillStyle = "#0b0f22";
      g.fillRect(hx, hy, 46 * s, 16 * s);
      g.fillRect(hx - 30 * s, hy + 4 * s, 30 * s, 4 * s);
      g.fillRect(hx - 10 * s, hy - 6 * s, 66 * s * Math.abs(Math.sin(t * 30)), 2);
      g.fillStyle = Math.sin(t * 6) > 0 ? "#ef4444" : "#0b0f22";
      g.fillRect(hx + 44 * s, hy + 6 * s, 4, 4);
      break;
    }
    case "street": {
      const sky = g.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, "#3b1d2e");
      sky.addColorStop(0.55, "#b45309");
      sky.addColorStop(1, "#f59e0b");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, groundY);
      // smoke columns
      for (let i = 0; i < 3; i++) {
        const sx = W * (0.2 + i * 0.32) - cam.x * s * 0.2;
        for (let k = 0; k < 7; k++) {
          const yy = groundY * (0.7 - k * 0.11) - ((t * 20) % 40);
          g.fillStyle = `rgba(30,20,20,${0.25 - k * 0.025})`;
          g.beginPath();
          g.arc(sx + Math.sin(t * 0.5 + k) * 20, yy, (30 + k * 12) * s, 0, Math.PI * 2);
          g.fill();
        }
      }
      const far = cached("street-far", 1500 * s, 330 * s, (c) => {
        skyline(c, 1500 * s, 330 * s, 21, "#3f2a2a", null, 140 * s, 320 * s);
        // broken tops
        c.globalCompositeOperation = "destination-out";
        for (let i = 0; i < 18; i++) {
          c.beginPath();
          const x = hash(i + 4) * 1500 * s;
          c.moveTo(x, 0);
          c.lineTo(x + 60 * s, 0);
          c.lineTo(x + 20 * s, (80 + hash(i) * 120) * s);
          c.fill();
        }
      });
      tileLayer(g, far, cam.x * s * 0.25, groundY - far.height, W);
      const mid = cached("street-mid", 1700 * s, 240 * s, (c) => skyline(c, 1700 * s, 240 * s, 31, "#261818", "#fbbf24", 100 * s, 230 * s));
      tileLayer(g, mid, cam.x * s * 0.5, groundY - mid.height, W);
      // flickering fires
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const fx = W * (0.1 + i * 0.27) - cam.x * s * 0.5;
        const fl = 0.6 + 0.4 * Math.sin(t * 13 + i * 3);
        const grd = g.createRadialGradient(fx, groundY - 20, 0, fx, groundY - 20, 70 * s * fl);
        grd.addColorStop(0, "rgba(253,186,116,0.8)");
        grd.addColorStop(1, "rgba(239,68,68,0)");
        g.fillStyle = grd;
        g.fillRect(fx - 80 * s, groundY - 100 * s, 160 * s, 100 * s);
      }
      g.restore();
      break;
    }
    case "lab": {
      g.fillStyle = "#0b1220";
      g.fillRect(0, 0, W, groundY);
      const wall = cached("lab-wall", 900 * s, groundY, (c) => {
        const w = 900 * s;
        for (let i = 0; i < 6; i++) {
          c.fillStyle = i % 2 ? "#111a2c" : "#0f1726";
          c.fillRect(i * 150 * s, 0, 150 * s, groundY);
          c.strokeStyle = "#1e2b44";
          c.lineWidth = 2;
          c.strokeRect(i * 150 * s + 8, 30 * s, 134 * s, groundY - 60 * s);
        }
        c.fillStyle = "#16233a";
        c.fillRect(0, groundY * 0.12, w, 10 * s);
      });
      tileLayer(g, wall, cam.x * s * 0.4, 0, W);
      // monitors
      for (let i = 0; i < 5; i++) {
        const mx = ((i * 330 * s - cam.x * s * 0.4) % (W + 300) + W + 300) % (W + 300) - 150;
        const my = groundY * 0.3;
        g.fillStyle = "#020617";
        g.fillRect(mx, my, 120 * s, 70 * s);
        g.fillStyle = i % 2 ? "#065f46" : "#0e7490";
        g.fillRect(mx + 4, my + 4, 120 * s - 8, 70 * s - 8);
        g.strokeStyle = "#6ee7b7";
        g.lineWidth = 2;
        g.beginPath();
        for (let k = 0; k < 20; k++) g.lineTo(mx + 8 + k * 5.5 * s, my + 35 * s + Math.sin(t * 4 + k * 0.7 + i) * 20 * s * (i % 2 ? 0.4 : 1));
        g.stroke();
      }
      // energy tubes
      for (let i = 0; i < 3; i++) {
        const tx = W * (0.15 + i * 0.35) - cam.x * s * 0.6;
        const top = groundY * 0.18;
        g.fillStyle = "rgba(16,185,129,0.18)";
        g.fillRect(tx, top, 50 * s, groundY - top);
        g.strokeStyle = "#34d399";
        g.lineWidth = 2;
        g.strokeRect(tx, top, 50 * s, groundY - top);
        g.fillStyle = "#a7f3d0";
        for (let b = 0; b < 6; b++) {
          const by = groundY - (((t * 60 + b * 47 + i * 30) % (groundY - top)) as number);
          g.beginPath();
          g.arc(tx + 25 * s + Math.sin(t * 3 + b) * 10 * s, by, 3 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
      // arcing electricity
      if (Math.sin(t * 2.3) > 0.6) {
        g.strokeStyle = "#bbf7d0";
        g.lineWidth = 2;
        g.beginPath();
        const x0 = W * 0.15 - cam.x * s * 0.6 + 25 * s;
        const x1 = W * 0.5 - cam.x * s * 0.6 + 25 * s;
        for (let k = 0; k <= 12; k++) g.lineTo(x0 + ((x1 - x0) * k) / 12, groundY * 0.25 + (Math.random() - 0.5) * 30);
        g.stroke();
      }
      break;
    }
    case "space": {
      g.fillStyle = "#03030c";
      g.fillRect(0, 0, W, groundY);
      const stars = cached("space-stars", 1200, 700, (c) => {
        for (let i = 0; i < 400; i++) {
          c.fillStyle = `rgba(255,255,255,${0.2 + hash(i * 3) * 0.8})`;
          const r = hash(i * 9) > 0.95 ? 2 : 1;
          c.fillRect(hash(i) * 1200, hash(i + 1000) * 700, r, r);
        }
        const neb = c.createRadialGradient(800, 250, 0, 800, 250, 360);
        neb.addColorStop(0, "rgba(168,85,247,0.35)");
        neb.addColorStop(1, "rgba(168,85,247,0)");
        c.fillStyle = neb;
        c.fillRect(0, 0, 1200, 700);
      });
      tileLayer(g, stars, cam.x * s * 0.05 + t * 4, 0, W);
      // planet with ring
      const px = W * 0.3 - cam.x * s * 0.1;
      const py = groundY * 0.42;
      const pr = 120 * s;
      const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg.addColorStop(0, "#fcd34d");
      pg.addColorStop(0.6, "#f97316");
      pg.addColorStop(1, "#7c2d12");
      g.fillStyle = pg;
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(253,230,138,0.6)";
      g.lineWidth = 6 * s;
      g.beginPath();
      g.ellipse(px, py, pr * 1.7, pr * 0.35, -0.3, 0, Math.PI * 2);
      g.stroke();
      // station window frame
      g.fillStyle = "#1e293b";
      const fw = 260 * s;
      for (let x = -(((cam.x * s * 0.8) % fw) + fw) % fw; x < W; x += fw) {
        g.fillRect(x, 0, 18 * s, groundY);
      }
      g.fillRect(0, 0, W, 22 * s);
      g.fillRect(0, groundY - 40 * s, W, 40 * s);
      g.fillStyle = "#38bdf8";
      for (let x = -(((cam.x * s) % 120) + 120) % 120; x < W; x += 120) g.fillRect(x, groundY - 30 * s, 40 * s, 4 * s);
      break;
    }
    case "volcano": {
      const sky = g.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, "#1c0606");
      sky.addColorStop(0.6, "#7f1d1d");
      sky.addColorStop(1, "#ea580c");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, groundY);
      const far = cached("volc-far", 1400 * s, 380 * s, (c) => {
        const w = 1400 * s;
        const h = 380 * s;
        c.fillStyle = "#2a0b0b";
        c.beginPath();
        c.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) c.lineTo(x, h - (0.35 + 0.35 * Math.abs(Math.sin(x / (240 * s))) + hash(x) * 0.08) * h);
        c.lineTo(w, h);
        c.fill();
      });
      tileLayer(g, far, cam.x * s * 0.2, groundY - far.height, W);
      // lava falls
      for (let i = 0; i < 3; i++) {
        const lx = W * (0.18 + i * 0.33) - cam.x * s * 0.35;
        const grd = g.createLinearGradient(0, groundY * 0.35, 0, groundY);
        grd.addColorStop(0, "#fde047");
        grd.addColorStop(1, "#dc2626");
        g.fillStyle = grd;
        const wob = Math.sin(t * 3 + i) * 4 * s;
        g.fillRect(lx + wob, groundY * 0.35, 26 * s, groundY * 0.65);
      }
      // embers
      g.fillStyle = "#fdba74";
      for (let i = 0; i < 40; i++) {
        const ex = (hash(i) * W + Math.sin(t + i) * 30 - cam.x * s * 0.6) % W;
        const ey = groundY - ((t * (30 + hash(i + 3) * 50) + hash(i + 7) * groundY) % groundY);
        g.globalAlpha = 0.4 + 0.6 * hash(i + 11);
        g.fillRect((ex + W) % W, ey, 3, 3);
      }
      g.globalAlpha = 1;
      break;
    }
    case "temple": {
      const sky = g.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, "#120a24");
      sky.addColorStop(0.5, "#3b1f5e");
      sky.addColorStop(1, "#0f766e");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, groundY);
      // rotating rune circle
      g.save();
      g.translate(W / 2 - cam.x * s * 0.1, groundY * 0.42);
      g.rotate(t * 0.15);
      g.strokeStyle = "rgba(240,171,252,0.45)";
      g.lineWidth = 3;
      for (const r of [150, 120, 90]) {
        g.beginPath();
        g.arc(0, 0, r * s, 0, Math.PI * 2);
        g.stroke();
      }
      for (let i = 0; i < 12; i++) {
        g.rotate(Math.PI / 6);
        g.strokeRect(130 * s, -6 * s, 12 * s, 12 * s);
      }
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.lineTo(Math.cos(a) * 120 * s, Math.sin(a) * 120 * s);
      }
      g.stroke();
      g.restore();
      // pillars
      const pil = cached("temple-pillars", 1300 * s, groundY, (c) => {
        for (let i = 0; i < 5; i++) {
          const x = i * 260 * s + 40 * s;
          c.fillStyle = "#24163a";
          c.fillRect(x, groundY * 0.12, 60 * s, groundY);
          c.fillStyle = "#33204f";
          c.fillRect(x - 10 * s, groundY * 0.12, 80 * s, 20 * s);
        }
      });
      tileLayer(g, pil, cam.x * s * 0.45, 0, W);
      // floating rocks
      for (let i = 0; i < 6; i++) {
        const rx = ((hash(i) * 1600 * s - cam.x * s * 0.6) % (W + 200) + W + 200) % (W + 200) - 100;
        const ry = groundY * (0.2 + hash(i + 5) * 0.4) + Math.sin(t * 0.9 + i) * 14 * s;
        const rs = (24 + hash(i + 9) * 30) * s;
        g.fillStyle = "#4c3a63";
        g.beginPath();
        g.moveTo(rx - rs, ry);
        g.lineTo(rx + rs, ry);
        g.lineTo(rx + rs * 0.3, ry + rs * 1.1);
        g.lineTo(rx - rs * 0.4, ry + rs * 0.8);
        g.fill();
        g.fillStyle = "#6d5a86";
        g.fillRect(rx - rs, ry - 6 * s, rs * 2, 6 * s);
      }
      break;
    }
  }

  // Floor (shared): perspective lines give depth
  const fg = g.createLinearGradient(0, groundY, 0, H);
  fg.addColorStop(0, a.floor[0]);
  fg.addColorStop(1, a.floor[1]);
  g.fillStyle = fg;
  g.fillRect(0, groundY, W, H - groundY);
  g.strokeStyle = "rgba(255,255,255,0.07)";
  g.lineWidth = 1;
  const vx = W / 2 - cam.x * s;
  for (let i = -14; i <= 14; i++) {
    g.beginPath();
    g.moveTo(vx + i * 110 * s, groundY);
    g.lineTo(vx + i * 260 * s, H);
    g.stroke();
  }
  for (let k = 1; k < 4; k++) {
    const y = groundY + (H - groundY) * (k / 4) ** 1.6;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  if (a.id === "volcano") {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = `rgba(249,115,22,${0.5 + 0.3 * Math.sin(t * 2)})`;
    g.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const x0 = vx + (i - 4) * 220 * s;
      g.beginPath();
      g.moveTo(x0, groundY + 6);
      g.lineTo(x0 + 40 * s, groundY + 30 * s);
      g.lineTo(x0 + 10 * s, groundY + 60 * s);
      g.stroke();
    }
    g.restore();
  }
  if (a.id === "temple") {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "rgba(94,234,212,0.3)";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(vx, groundY + 30 * s, 420 * s, 40 * s, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  // Stage-edge walls
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(0, groundY - 2, W, 4);
}

/* ── Props (world space; ctx already transformed: y up is negative) ── */
export function drawProp(g: CanvasRenderingContext2D, kind: string, x: number, w: number, h: number, broken: boolean, t: number) {
  const left = x - w / 2;
  if (broken) {
    g.fillStyle = "#3f3f46";
    g.beginPath();
    g.moveTo(left, 0);
    g.lineTo(left + w * 0.2, -h * 0.25);
    g.lineTo(left + w * 0.45, -h * 0.12);
    g.lineTo(left + w * 0.7, -h * 0.3);
    g.lineTo(left + w, 0);
    g.fill();
    return;
  }
  switch (kind) {
    case "car":
      g.fillStyle = "#7f1d1d";
      g.fillRect(left, -h * 0.65, w, h * 0.45);
      g.fillStyle = "#991b1b";
      g.fillRect(left + w * 0.2, -h, w * 0.55, h * 0.4);
      g.fillStyle = "#93c5fd";
      g.fillRect(left + w * 0.26, -h * 0.94, w * 0.2, h * 0.28);
      g.fillRect(left + w * 0.5, -h * 0.94, w * 0.2, h * 0.28);
      g.fillStyle = "#111";
      for (const k of [0.2, 0.8]) {
        g.beginPath();
        g.arc(left + w * k, -h * 0.18, h * 0.18, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "tank":
      g.fillStyle = "#78350f";
      g.fillRect(left + 8, -h, w - 16, h * 0.75);
      g.fillStyle = "#451a03";
      g.fillRect(left, -h * 0.25, 8, h * 0.25);
      g.fillRect(left + w - 8, -h * 0.25, 8, h * 0.25);
      g.beginPath();
      g.moveTo(left + 4, -h);
      g.lineTo(x, -h - 24);
      g.lineTo(left + w - 4, -h);
      g.fill();
      break;
    case "vent":
      g.fillStyle = "#6b7280";
      g.fillRect(left, -h, w, h);
      g.fillStyle = "#374151";
      for (let i = 0; i < 4; i++) g.fillRect(left + 8, -h + 10 + i * 14, w - 16, 6);
      break;
    case "console":
      g.fillStyle = "#1f2937";
      g.fillRect(left, -h, w, h);
      g.fillStyle = Math.sin(t * 5) > 0 ? "#34d399" : "#059669";
      g.fillRect(left + 10, -h + 10, w - 20, 28);
      g.fillStyle = "#f87171";
      g.fillRect(left + 12, -h + 48, 10, 10);
      g.fillStyle = "#facc15";
      g.fillRect(left + 30, -h + 48, 10, 10);
      break;
    case "tube":
      g.fillStyle = "rgba(52,211,153,0.35)";
      g.fillRect(left, -h, w, h);
      g.strokeStyle = "#6ee7b7";
      g.lineWidth = 3;
      g.strokeRect(left, -h, w, h);
      g.fillStyle = "#334155";
      g.fillRect(left - 4, -h - 10, w + 8, 12);
      break;
    case "crate":
      g.fillStyle = "#475569";
      g.fillRect(left, -h, w, h);
      g.strokeStyle = "#facc15";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(left, -h);
      g.lineTo(left + w, 0);
      g.moveTo(left + w, -h);
      g.lineTo(left, 0);
      g.stroke();
      break;
    case "rock":
      g.fillStyle = "#292524";
      g.beginPath();
      g.moveTo(left, 0);
      g.lineTo(left + w * 0.15, -h * 0.8);
      g.lineTo(left + w * 0.55, -h);
      g.lineTo(left + w * 0.9, -h * 0.6);
      g.lineTo(left + w, 0);
      g.fill();
      g.strokeStyle = "#f97316";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(left + w * 0.3, -h * 0.2);
      g.lineTo(left + w * 0.5, -h * 0.6);
      g.stroke();
      break;
    case "urn":
      g.fillStyle = "#a16207";
      g.beginPath();
      g.ellipse(x, -h * 0.45, w / 2, h * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - w * 0.3, -h, w * 0.6, h * 0.2);
      g.fillStyle = "#f0abfc";
      g.fillRect(x - w * 0.4, -h * 0.5, w * 0.8, 4);
      break;
    default:
      g.fillStyle = "#555";
      g.fillRect(left, -h, w, h);
  }
}
