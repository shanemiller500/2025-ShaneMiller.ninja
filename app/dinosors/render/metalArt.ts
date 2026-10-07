/* ------------------------------------------------------------------ */
/*  Metal + the polygon age: the refinery with its heaps of raw ore    */
/*  and stacks of bars, and the polygon house (the top of the home     */
/*  ladder). Origin = the building's base centre.                     */
/* ------------------------------------------------------------------ */
import { polyBlocks } from "./civArt";

type Stock = Record<string, number>;

/** A heap of raw nuggets: bigger with more in the stockpile. */
function oreHeap(c: CanvasRenderingContext2D, x: number, y: number, n: number, light: string, dark: string, sparkle: boolean, t: number) {
  if (n <= 0) return;
  const r = Math.min(16, 4 + Math.sqrt(n) * 2.2);
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(x, y + 1, r + 3, (r + 3) * 0.35, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = dark;
  c.beginPath();
  c.ellipse(x, y, r, r * 0.65, 0, Math.PI, 0);
  c.fill();
  const lumps = Math.min(14, 3 + Math.floor(n / 2));
  for (let k = 0; k < lumps; k++) {
    const a = Math.PI + (k / lumps) * Math.PI;
    const rr = r * (0.3 + ((k * 37) % 10) / 14);
    const lx = x + Math.cos(a) * rr;
    const ly = y + Math.sin(a) * rr * 0.62;
    c.fillStyle = k % 3 ? light : dark;
    c.beginPath();
    c.ellipse(lx, ly, 2.6, 2, k, 0, Math.PI * 2);
    c.fill();
  }
  if (sparkle) {
    const s = (Math.sin(t * 3 + x) + 1) / 2;
    c.fillStyle = `rgba(255,255,230,${0.4 + s * 0.6})`;
    c.fillRect(x - 2 + s * 4, y - r * 0.6, 1.6, 1.6);
  }
}

/** Bars stacked in a little pyramid (up to ~15 shown). */
function barStack(c: CanvasRenderingContext2D, x: number, y: number, n: number, top: string, side: string, t: number) {
  if (n <= 0) return;
  const shown = Math.min(15, n);
  let k = 0;
  for (let row = 0; k < shown; row++) {
    const inRow = Math.max(1, 5 - row);
    for (let i = 0; i < inRow && k < shown; i++, k++) {
      const bx = x - (inRow - 1) * 5 + i * 10;
      const by = y - row * 5;
      c.fillStyle = side;
      c.beginPath();
      c.moveTo(bx - 5, by);
      c.lineTo(bx + 5, by);
      c.lineTo(bx + 4, by - 4);
      c.lineTo(bx - 4, by - 4);
      c.closePath();
      c.fill();
      c.fillStyle = top;
      c.fillRect(bx - 3.5, by - 4.6, 7, 1.6);
    }
  }
  // a glint running across the pile
  const g = (t * 0.7 + x * 0.01) % 1;
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fillRect(x - 20 + g * 40, y - 4, 2, 2);
}

/** Refinery: a stone furnace with a glowing mouth and a chimney, ore heaps + bar stacks outside. */
export function drawRefinery(c: CanvasRenderingContext2D, W: number, stock: Stock, t: number, night: boolean) {
  // furnace body
  polyBlocks(c, -W / 2 + 6, -34, W / 2 - 34, 0, 77, "#8f877a");
  c.fillStyle = "#6f675c";
  c.fillRect(-W / 2 + 4, -38, W - 38, 6);
  // chimney with smoke
  c.fillStyle = "#6b625a";
  c.fillRect(-W / 2 + 14, -70, 12, 34);
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.4 + k / 3) % 1;
    c.fillStyle = `rgba(90,85,80,${(1 - ph) * 0.4})`;
    c.beginPath();
    c.arc(-W / 2 + 20 + Math.sin(ph * 5 + k) * 6, -74 - ph * 40, 5 + ph * 10, 0, Math.PI * 2);
    c.fill();
  }
  // the glowing mouth + a crucible pouring
  const flick = 0.75 + Math.sin(t * 9) * 0.15;
  const mouth = c.createRadialGradient(-W / 2 + 30, -14, 0, -W / 2 + 30, -14, 22);
  mouth.addColorStop(0, `rgba(255,240,170,${flick})`);
  mouth.addColorStop(0.5, "rgba(255,140,40,0.85)");
  mouth.addColorStop(1, "rgba(120,40,10,0.9)");
  c.fillStyle = mouth;
  c.beginPath();
  c.ellipse(-W / 2 + 30, -12, 11, 10, 0, Math.PI, 0);
  c.fillRect(-W / 2 + 19, -12, 22, 12);
  c.fill();
  if (night) {
    c.fillStyle = "rgba(255,170,80,0.18)";
    c.beginPath();
    c.arc(-W / 2 + 30, -10, 40, 0, Math.PI * 2);
    c.fill();
  }
  // a mould tray of cooling bars
  c.fillStyle = "#3b3530";
  c.fillRect(-W / 2 + 46, -8, 20, 6);
  c.fillStyle = `rgba(255,${150 + Math.sin(t * 2) * 30},60,0.9)`;
  c.fillRect(-W / 2 + 48, -7, 7, 3);
  c.fillRect(-W / 2 + 57, -7, 7, 3);
  // outside: raw heaps at the back, bar stacks in front
  const rx = W / 2 - 22;
  oreHeap(c, rx - 16, -20, stock.gold ?? 0, "#f6cf4a", "#9a7a22", true, t);
  oreHeap(c, rx + 4, -18, stock.silver ?? 0, "#e6eaf0", "#7d838d", true, t);
  oreHeap(c, rx + 20, -22, stock.copper ?? 0, "#e8874a", "#8a4620", false, t);
  barStack(c, rx - 14, 4, stock.goldBar ?? 0, "#ffe27a", "#d19e22", t);
  barStack(c, rx + 8, 6, stock.silverBar ?? 0, "#ffffff", "#aeb5c2", t + 1);
  barStack(c, rx + 26, 4, stock.copperBar ?? 0, "#ffb27a", "#c0632e", t + 2);
}

/**
 * The polygon house: interlocking many-sided stone, a crystal lantern over the
 * door and a roof of fitted slabs. Fire-proof.
 */
export function drawPolygonHouse(c: CanvasRenderingContext2D, night: boolean, t: number) {
  const W = 64;
  const H = 32;
  // base plinth
  c.fillStyle = "#7d766a";
  c.fillRect(-W / 2 - 4, -4, W + 8, 4);
  polyBlocks(c, -W / 2, -H, W / 2, -4, 913, "#c9c0b0");
  // a stepped polygon roof
  c.fillStyle = "#9c9486";
  c.beginPath();
  c.moveTo(-W / 2 - 6, -H);
  c.lineTo(-W / 2 + 6, -H - 14);
  c.lineTo(-W / 4, -H - 24);
  c.lineTo(W / 4, -H - 24);
  c.lineTo(W / 2 - 6, -H - 14);
  c.lineTo(W / 2 + 6, -H);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(60,54,46,0.5)";
  c.lineWidth = 1;
  for (const [x0, y0, x1, y1] of [[-W / 2 + 6, -H - 14, W / 2 - 6, -H - 14], [-W / 4, -H - 24, -W / 2 + 12, -H], [W / 4, -H - 24, W / 2 - 12, -H], [0, -H - 24, 0, -H]]) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  // door + windows (warm glow) + a crystal lantern
  c.fillStyle = "#2c241c";
  c.beginPath();
  c.moveTo(-7, -4);
  c.lineTo(-7, -18);
  c.lineTo(0, -24);
  c.lineTo(7, -18);
  c.lineTo(7, -4);
  c.closePath();
  c.fill();
  const lit = night ? "rgba(255,210,130,0.95)" : "rgba(120,190,230,0.7)";
  for (const wx of [-W / 2 + 10, W / 2 - 18]) {
    c.fillStyle = lit;
    c.beginPath();
    c.moveTo(wx, -14);
    c.lineTo(wx + 4, -20);
    c.lineTo(wx + 8, -14);
    c.lineTo(wx + 4, -9);
    c.closePath();
    c.fill();
  }
  const pulse = (Math.sin(t * 2.5) + 1) / 2;
  c.globalCompositeOperation = "lighter";
  const g = c.createRadialGradient(0, -30, 0, 0, -30, 26 + pulse * 6);
  g.addColorStop(0, `rgba(150,235,255,${0.55 + pulse * 0.2})`);
  g.addColorStop(1, "rgba(150,235,255,0)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, -30, 32, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";
  c.fillStyle = "#bff6ff";
  c.beginPath();
  c.moveTo(0, -36);
  c.lineTo(4, -30);
  c.lineTo(0, -25);
  c.lineTo(-4, -30);
  c.closePath();
  c.fill();
}
