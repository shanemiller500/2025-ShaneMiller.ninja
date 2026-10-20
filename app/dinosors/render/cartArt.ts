/* ------------------------------------------------------------------ */
/*  A hand cart: a plank box on two solid wooden wheels, pulled by its */
/*  shafts. Empty on the way out, heaped with the load on the way back */
/*  (rock grey, clay red, wood brown, ore with a metal glint).         */
/*  Origin: the feet of whoever is pulling it; it trails behind them.  */
/* ------------------------------------------------------------------ */
import type { Resource } from "../sim/types";

const INK = "#24170e";

const LOAD: Partial<Record<Resource, [string, string]>> = {
  stone: ["#a4a6a0", "#7d7f7a"],
  limestone: ["#e3dccb", "#b9b09a"],
  clay: ["#b8643c", "#8e4a2a"],
  wood: ["#ad7646", "#7a5530"],
  obsidian: ["#2b2633", "#5a4f6e"],
  flint: ["#6f6a62", "#4d4943"],
  salt: ["#f2efe8", "#cfcac0"],
  tar: ["#26201c", "#463a32"],
  coal: ["#2e2b29", "#4a4542"],
  iron: ["#9d6950", "#c4c9cc"],
  copper: ["#c27a3a", "#e3a066"],
  gold: ["#e8c45d", "#fff1a8"],
  silver: ["#cdd8de", "#ffffff"],
  quartz: ["#e9e3f2", "#ffffff"],
  magnetite: ["#3b3f45", "#8a9096"],
  crystal: ["#9fe6ff", "#e8fbff"],
  meteorite: ["#5a5148", "#c9b38a"],
};

export function drawCart(c: CanvasRenderingContext2D, dir: 1 | -1, anim: number, load: Resource | null, n: number) {
  c.save();
  c.scale(dir, 1);
  // it trails behind: box centre ~26px back
  const bx = -30;
  const by = -12;
  // shadow
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.beginPath();
  c.ellipse(bx, 1, 17, 4, 0, 0, Math.PI * 2);
  c.fill();
  // shafts up to the puller's hands
  c.strokeStyle = "#7a5530";
  c.lineWidth = 2.2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(bx + 12, by + 2);
  c.lineTo(-2, -13);
  c.stroke();
  // the load, heaped up
  const pal = load ? LOAD[load] : null;
  if (pal && n > 0) {
    const heap = Math.min(4, 1 + Math.floor(n / 2));
    for (let i = 0; i < heap + 2; i++) {
      c.fillStyle = i % 2 ? pal[1] : pal[0];
      c.strokeStyle = INK;
      c.lineWidth = 0.8;
      c.beginPath();
      if (load === "wood") c.roundRect(bx - 12 + (i % 3) * 6, by - 9 - Math.floor(i / 3) * 3, 14, 3.4, 1.5);
      else c.ellipse(bx - 8 + (i % 3) * 8, by - 7 - Math.floor(i / 3) * 3.5, 4.4, 3.4, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }
  // plank box
  c.fillStyle = "#9a6b3e";
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(bx - 15, by - 7);
  c.lineTo(bx + 15, by - 7);
  c.lineTo(bx + 13, by + 4);
  c.lineTo(bx - 13, by + 4);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = "#6e4a28";
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(bx - 14, by - 2);
  c.lineTo(bx + 14, by - 2);
  c.moveTo(bx - 5, by - 7);
  c.lineTo(bx - 5, by + 4);
  c.moveTo(bx + 5, by - 7);
  c.lineTo(bx + 5, by + 4);
  c.stroke();
  // a solid wooden wheel that turns as they walk
  const wy = by + 6;
  c.fillStyle = "#7a5530";
  c.strokeStyle = INK;
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(bx, wy, 6.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = "#4e3520";
  c.lineWidth = 1.2;
  const a = anim * 2.4;
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    const t = a + (k * Math.PI) / 3;
    c.moveTo(bx + Math.cos(t) * 5.5, wy + Math.sin(t) * 5.5);
    c.lineTo(bx - Math.cos(t) * 5.5, wy - Math.sin(t) * 5.5);
  }
  c.stroke();
  c.fillStyle = "#c9a46a";
  c.beginPath();
  c.arc(bx, wy, 1.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
