/* ------------------------------------------------------------------ */
/*  The water wagon (waterWagons.ts): a timber cart on four spoked     */
/*  wheels, a big hooped water tank on the back with a gauge showing   */
/*  how full it is, a seesaw pump in the middle, and a bronze nozzle   */
/*  on a swivel up front. Water sloshes while it rolls, the pump       */
/*  rocks and drips while it sprays, and in sunshine a faint rainbow   */
/*  hangs in the spray. Origin: the ground under its middle.           */
/* ------------------------------------------------------------------ */
import type { WaterWagon } from "../sim/types";

const INK = "#24170e";
const WOOD = "#80592f";
const WOOD_D = "#5a3d22";
const WOOD_L = "#a57a48";
const HOOP = "#5c6168";
const BRONZE = "#c58a3c";
const BRONZE_L = "#e9b866";
const WATER = "#5aa6e6";
const WATER_L = "#bfe3ff";

function wheel(c: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  c.fillStyle = WOOD_D;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = WOOD_L;
  c.lineWidth = 1.4;
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = spin + (k * Math.PI) / 3;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2));
  }
  c.stroke();
  c.strokeStyle = HOOP;
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(x, y, r - 0.6, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = HOOP;
  c.beginPath();
  c.arc(x, y, 2.2, 0, Math.PI * 2);
  c.fill();
}

export function drawWaterWagon(c: CanvasRenderingContext2D, g: WaterWagon, t: number, sunny: number) {
  const full = Math.max(0, Math.min(1, g.tank / g.tankMax));
  const moving = !!g.to;
  const spraying = g.spray > 0;
  const bob = moving ? Math.abs(Math.sin(g.anim * 1.4)) * 1 : 0;
  c.save();
  // shadow
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(0, 3, 50, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.scale(g.dir, 1);
  const spin = g.anim * 1.7;
  // far wheels
  wheel(c, -24, -9, 10, spin);
  wheel(c, 22, -9, 10, spin);
  c.translate(0, -bob);
  // push bar out the back (the crew lean on it)
  c.strokeStyle = WOOD_D;
  c.lineWidth = 3;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-34, -16);
  c.lineTo(-46, -24);
  c.moveTo(-46, -28);
  c.lineTo(-46, -18);
  c.stroke();
  // the bed
  c.fillStyle = WOOD;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-38, -22);
  c.lineTo(34, -22);
  c.lineTo(30, -10);
  c.lineTo(-34, -10);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = "rgba(36,23,14,0.4)";
  c.lineWidth = 0.8;
  c.beginPath();
  for (let x = -26; x < 30; x += 12) {
    c.moveTo(x, -21);
    c.lineTo(x - 1, -11);
  }
  c.stroke();
  // ---- the tank: a big hooped barrel on its side over the back half ----
  const tx = -14;
  const ty = -36;
  const tw = 24;
  const th = 15;
  const g1 = c.createLinearGradient(0, ty - th, 0, ty + th);
  g1.addColorStop(0, WOOD_L);
  g1.addColorStop(0.55, WOOD);
  g1.addColorStop(1, WOOD_D);
  c.fillStyle = g1;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.ellipse(tx, ty, tw, th, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // staves
  c.strokeStyle = "rgba(36,23,14,0.35)";
  c.lineWidth = 0.8;
  c.beginPath();
  for (let k = -2; k <= 2; k++) {
    c.moveTo(tx - tw + 3, ty + k * 5);
    c.quadraticCurveTo(tx, ty + k * 5.6, tx + tw - 3, ty + k * 5);
  }
  c.stroke();
  // iron hoops
  c.strokeStyle = HOOP;
  c.lineWidth = 2.2;
  for (const hx of [-15, 0, 15]) {
    c.beginPath();
    c.ellipse(tx + hx, ty, 2.5, th - 0.5 - Math.abs(hx) * 0.18, 0, 0, Math.PI * 2);
    c.stroke();
  }
  // the gauge: a glass strip on the side showing the water level (sloshing as it rolls)
  const gx = tx + 7;
  const gTop = ty - 10;
  const gH = 20;
  c.fillStyle = "rgba(20,30,40,0.75)";
  c.fillRect(gx - 2.5, gTop, 5, gH);
  const slosh = moving ? Math.sin(t * 6 + g.anim) * 1.2 : spraying ? Math.sin(t * 14) * 0.6 : 0;
  const lvl = gH * full;
  if (lvl > 0.5) {
    c.fillStyle = full < 0.2 ? "#e0864a" : WATER;
    c.fillRect(gx - 2, gTop + gH - lvl + slosh * 0.5, 4, lvl - slosh * 0.5);
    c.fillStyle = WATER_L;
    c.fillRect(gx - 2, gTop + gH - lvl + slosh * 0.5, 4, 1);
  }
  c.strokeStyle = BRONZE;
  c.lineWidth = 1;
  c.strokeRect(gx - 2.5, gTop, 5, gH);
  // filler cap + a drip down the front of the tank when it's nearly brim-full
  c.fillStyle = BRONZE;
  c.beginPath();
  c.ellipse(tx - 6, ty - th + 1, 4, 2, 0, 0, Math.PI * 2);
  c.fill();
  if (full > 0.95 || spraying) {
    const d = (t * 1.4) % 1;
    c.fillStyle = `rgba(140,200,250,${(0.85 - d * 0.7).toFixed(3)})`;
    c.beginPath();
    c.arc(tx + tw - 4, ty + 4 + d * 14, 1.3, 0, Math.PI * 2);
    c.fill();
  }
  // ---- the pump: a seesaw handle on a post, rocking while it sprays ----
  const rock = spraying ? Math.sin(t * 9) * 0.45 : 0;
  c.fillStyle = WOOD_D;
  c.fillRect(13, -40, 4, 18);
  c.save();
  c.translate(15, -41);
  c.rotate(rock);
  c.strokeStyle = WOOD_L;
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(-13, 0);
  c.lineTo(13, 0);
  c.stroke();
  c.fillStyle = INK;
  for (const ex of [-13, 13]) {
    c.beginPath();
    c.arc(ex, 0, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  // leather hose from the tank to the nozzle
  c.strokeStyle = "#6e4a2a";
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(tx + tw - 2, ty + 6);
  c.quadraticCurveTo(10, -24, 26, -30);
  c.stroke();
  // ---- the nozzle on its swivel (it turns to aim; drawn in the wagon's own facing) ----
  const ca = Math.cos(g.aim) * g.dir;
  const sa = Math.sin(g.aim) * 0.55;
  const nx = 26;
  const ny = -32;
  c.fillStyle = HOOP;
  c.beginPath();
  c.ellipse(nx, ny + 2, 4, 2, 0, 0, Math.PI * 2);
  c.fill();
  const len = 15;
  c.strokeStyle = BRONZE;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(nx, ny);
  c.lineTo(nx + ca * len, ny + sa * len - 3);
  c.stroke();
  c.fillStyle = BRONZE_L;
  c.beginPath();
  c.arc(nx + ca * len, ny + sa * len - 3, 2.6, 0, Math.PI * 2);
  c.fill();
  // near wheels
  c.translate(0, bob);
  wheel(c, -28, -6, 11, spin + 0.4);
  wheel(c, 26, -6, 11, spin + 0.4);
  // hit flash
  if (g.hit > 0) {
    c.globalAlpha = g.hit * 0.45;
    c.fillStyle = "#ff8a3a";
    c.beginPath();
    c.ellipse(0, -24, 44, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }
  c.restore();
  // ---- spray at the nozzle mouth: a mist, and on a sunny day a faint rainbow in it ----
  if (spraying) {
    const mx = g.dir * (nx + ca * len);
    const my = ny + sa * len - 3 - bob;
    const a = Math.atan2(Math.sin(g.aim) * 0.55, Math.cos(g.aim));
    c.save();
    c.translate(mx, my);
    c.rotate(a);
    const mist = c.createRadialGradient(18, 0, 0, 18, 0, 26);
    mist.addColorStop(0, "rgba(220,240,255,0.45)");
    mist.addColorStop(1, "rgba(220,240,255,0)");
    c.fillStyle = mist;
    c.beginPath();
    c.ellipse(18, 0, 26, 10, 0, 0, Math.PI * 2);
    c.fill();
    if (sunny > 0.55) {
      const alpha = Math.min(0.16, (sunny - 0.55) * 0.5) * Math.min(1, g.spray * 3);
      const bands = ["255,80,80", "255,170,60", "255,240,90", "100,220,120", "90,160,255", "170,110,240"];
      c.lineWidth = 1.6;
      for (let k = 0; k < bands.length; k++) {
        c.strokeStyle = `rgba(${bands[k]},${alpha.toFixed(3)})`;
        c.beginPath();
        c.arc(30, 8, 22 - k * 1.6, Math.PI * 1.08, Math.PI * 1.92);
        c.stroke();
      }
    }
    c.restore();
  }
}
