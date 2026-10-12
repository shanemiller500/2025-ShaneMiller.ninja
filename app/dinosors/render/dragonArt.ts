/* ------------------------------------------------------------------ */
/*  Dragons, nests + eggs (fantasy art).                               */
/*                                                                     */
/*  A dragon is drawn side-on in a 3/4 view: far wing, tail, legs,     */
/*  body, neck + head, near wing. Wings have an arm bone and three     */
/*  finger bones with a scalloped membrane between them; the beat is   */
/*  quick on the downstroke and slower coming up, faster still when    */
/*  climbing. Landing + taking off it drops its legs; on the ground    */
/*  the wings fold along its back. Scale comes from breed + growth.    */
/* ------------------------------------------------------------------ */
import { BREEDS, type DragonBreed } from "../data/dragons";
import { dragonStats } from "../sim/dragonKeep";
import type { Dragon, DragonEgg, DragonNest } from "../sim/types";

/** Old saves / visitors without a breed: the classic three colour schemes. */
const LEGACY: DragonBreed[] = ["fire", "swift", "heavy"];

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Where the mouth is, relative to the body origin (unscaled, facing right). */
const MOUTH = { x: 66, y: -38 };

/** A dragon; origin at its body, already raised by z. */
export function drawDragon(c: CanvasRenderingContext2D, dr: Dragon, t: number) {
  const breed = dr.breed ?? LEGACY[dr.hue % LEGACY.length];
  const L = BREEDS[breed].look;
  const st = dragonStats(dr);
  const s = st.scale;
  const flying = dr.z > 6;
  const legsDown = flying && dr.z < 90;
  const hop = dr.hop ? Math.sin(Math.min(1, dr.hop / 1.4) * Math.PI) : 0;
  // quick downstroke, slower recovery
  const ph = dr.anim * 1.6;
  const flap = flying ? Math.sin(ph) + 0.28 * Math.sin(ph * 2) : hop * 0.7 - 0.2;
  const young = (dr.growth ?? 1) < 0.25;

  c.save();
  c.translate(0, -hop * 14 * s);
  c.rotate((dr.bank ?? 0) * 0.6);
  c.scale(dr.dir * s, s);
  if (dr.hit > 0) c.filter = `brightness(${1 + dr.hit * 0.8})`;

  const wing = (near: boolean) => {
    const lift = flying ? flap * 36 : (near ? -4 : -8) + flap * 18;
    const span = flying ? 1 : 0.52 + hop * 0.35;
    const col = near ? L.wing : shade(L.wing, -0.25);
    // arm: shoulder → elbow → wrist
    const sx = -4;
    const sy = -24;
    const ex = -26 * span;
    const ey = -46 - lift * 0.55;
    const wx = -46 * span;
    const wy = -60 - lift;
    const tips = [
      { x: -96 * span, y: -50 - lift * 1.25 },
      { x: -84 * span, y: -30 - lift * 0.8 },
      { x: -60 * span, y: -14 - lift * 0.35 },
    ];
    // membrane (scalloped between the finger tips)
    const g = c.createLinearGradient(sx, sy, tips[0].x, tips[0].y);
    g.addColorStop(0, col);
    g.addColorStop(1, shade(col, near ? 0.15 : -0.05));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.lineTo(wx, wy);
    c.lineTo(tips[0].x, tips[0].y);
    c.quadraticCurveTo((tips[0].x + tips[1].x) / 2 + 8, (tips[0].y + tips[1].y) / 2 + 2, tips[1].x, tips[1].y);
    c.quadraticCurveTo((tips[1].x + tips[2].x) / 2 + 8, (tips[1].y + tips[2].y) / 2 + 4, tips[2].x, tips[2].y);
    c.quadraticCurveTo(-30, -12, -8, -14);
    c.closePath();
    c.fill();
    // bones
    c.strokeStyle = shade(L.body, -0.15);
    c.lineCap = "round";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.lineTo(wx, wy);
    c.stroke();
    c.lineWidth = 1.6;
    c.beginPath();
    for (const tp of tips) {
      c.moveTo(wx, wy);
      c.lineTo(tp.x, tp.y);
    }
    c.stroke();
    // a little claw on the wrist
    c.fillStyle = L.horn;
    c.beginPath();
    c.moveTo(wx, wy);
    c.lineTo(wx + 5, wy - 6);
    c.lineTo(wx + 3, wy + 1);
    c.fill();
  };

  // far wing (behind everything)
  c.save();
  c.translate(10, -6);
  c.scale(0.86, 0.9);
  wing(false);
  c.restore();

  // tail: a tapered body that sways, with a spade at the tip
  const sway = Math.sin(t * 2.6 + dr.id) * (flying ? 5 : 8);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    pts.push([-18 - k * 70, -18 + k * 4 + Math.sin(t * 2.6 + dr.id + k * 2.2) * k * 10 + (flying ? k * 6 : 0)]);
  }
  c.fillStyle = L.body;
  c.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const wdt = 8 * (1 - i / pts.length) + 1.5;
    const [x, y] = pts[i];
    if (i === 0) c.moveTo(x, y - wdt);
    else c.lineTo(x, y - wdt);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const wdt = 8 * (1 - i / pts.length) + 1.5;
    c.lineTo(pts[i][0], pts[i][1] + wdt);
  }
  c.closePath();
  c.fill();
  const [tx, ty] = pts[pts.length - 1];
  c.fillStyle = L.wing;
  c.beginPath();
  c.moveTo(tx + 2, ty);
  c.lineTo(tx - 12, ty - 9 + sway * 0.2);
  c.lineTo(tx - 16, ty + 1);
  c.lineTo(tx - 10, ty + 9 - sway * 0.2);
  c.closePath();
  c.fill();
  // tail spikes
  c.fillStyle = L.horn;
  for (let i = 1; i < 6; i++) {
    const [x, y] = pts[i];
    const h = 5 * (1 - i / 7);
    c.beginPath();
    c.moveTo(x + 3, y - 6 + i * 0.4);
    c.lineTo(x, y - 6 - h);
    c.lineTo(x - 3, y - 6 + i * 0.4);
    c.fill();
  }

  // legs: tucked in flight, dropped for landing, planted on the ground
  const leg = (x: number, near: boolean) => {
    c.strokeStyle = near ? shade(L.body, -0.12) : shade(L.body, -0.3);
    c.lineWidth = 6;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x, -12);
    if (flying && !legsDown) {
      c.quadraticCurveTo(x - 4, -4, x - 12, -6);
    } else {
      const step = !flying && (dr.state === "walk") ? Math.sin(dr.anim * 2 + (near ? 0 : Math.PI)) * 5 : 0;
      c.quadraticCurveTo(x + 6, -4, x + 2 + step, legsDown ? 6 : 2);
    }
    c.stroke();
    // claws
    c.fillStyle = L.horn;
    const fx = flying && !legsDown ? x - 12 : x + 2;
    const fy = flying && !legsDown ? -6 : legsDown ? 6 : 2;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.moveTo(fx + k * 3, fy);
      c.lineTo(fx + 3 + k * 3, fy + 3);
      c.lineTo(fx + 1 + k * 3, fy);
      c.fill();
    }
  };
  leg(-12, false);
  leg(10, false);

  // body
  const bg = c.createLinearGradient(0, -38, 0, -4);
  bg.addColorStop(0, shade(L.body, 0.14));
  bg.addColorStop(1, shade(L.body, -0.18));
  c.fillStyle = bg;
  c.beginPath();
  c.ellipse(0, -19, 30, 15 + (young ? 2 : 0), -0.08, 0, Math.PI * 2);
  c.fill();
  // belly plates
  c.fillStyle = L.belly;
  c.beginPath();
  c.ellipse(5, -11, 21, 6.5, -0.05, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = shade(L.belly, -0.2);
  c.lineWidth = 0.8;
  for (let i = -3; i <= 3; i++) {
    c.beginPath();
    c.moveTo(5 + i * 5.5, -16);
    c.lineTo(5 + i * 5.5 + 1, -6);
    c.stroke();
  }
  // back spikes
  c.fillStyle = L.horn;
  for (let i = 0; i < 6; i++) {
    const x = -20 + i * 8;
    const y = -32 + Math.abs(i - 2.5) * 1.4;
    c.beginPath();
    c.moveTo(x - 3, y + 1);
    c.lineTo(x, y - 8 + Math.abs(i - 2.5));
    c.lineTo(x + 3, y + 1);
    c.fill();
  }
  // golden flecks (a rare egg's dragon)
  if (dr.rare) {
    c.fillStyle = "rgba(255,214,90,0.85)";
    for (let i = 0; i < 9; i++) c.fillRect(-22 + ((i * 17) % 44), -28 + ((i * 7) % 16), 1.6, 1.6);
  }
  // a riding saddle on a trained one
  if (dr.owner && (dr.skills?.rider ?? 0) >= 0.5) {
    c.fillStyle = "#6b4527";
    c.beginPath();
    c.moveTo(-14, -31);
    c.quadraticCurveTo(-4, -40, 8, -32);
    c.lineTo(6, -26);
    c.quadraticCurveTo(-4, -31, -12, -26);
    c.closePath();
    c.fill();
    c.strokeStyle = "#3d2817";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-3, -30);
    c.lineTo(-1, -6);
    c.stroke();
    c.fillStyle = "#d9b45a";
    c.fillRect(-2.5, -18, 3, 3);
  }
  if (dr.carrying) {
    c.fillStyle = "#a07848";
    c.strokeStyle = "#5e3f24";
    c.lineWidth = 1.2;
    c.beginPath();
    c.roundRect(-24, -34, 14, 12, 3);
    c.fill();
    c.stroke();
  }

  // neck + head
  const nod = flying ? Math.sin(t * 2.2) * 3 : Math.sin(t * 1.8 + dr.id) * 2 + hop * 3;
  const ng = c.createLinearGradient(20, -22, 44, -44);
  ng.addColorStop(0, L.body);
  ng.addColorStop(1, shade(L.body, 0.08));
  c.strokeStyle = ng;
  c.lineWidth = 11;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(20, -22);
  c.quadraticCurveTo(34, -36 + nod, 42, -40 + nod);
  c.stroke();
  // head: skull, snout, lower jaw (open while breathing / calling)
  const open = Math.max(dr.breath, dr.state === "defend" || dr.state === "chase" ? 0.35 : 0);
  c.fillStyle = L.body;
  c.beginPath();
  c.ellipse(47, -42 + nod, young ? 13 : 12, young ? 9 : 7.5, 0.15, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(57, -40 + nod, young ? 7 : 10, 4.6, 0.18, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = shade(L.body, -0.15);
  c.beginPath();
  c.moveTo(44, -37 + nod);
  c.quadraticCurveTo(56, -33 + nod + open * 8, 64, -33 + nod + open * 9);
  c.lineTo(62, -36 + nod + open * 4);
  c.quadraticCurveTo(54, -36 + nod, 46, -39 + nod);
  c.closePath();
  c.fill();
  if (open > 0.05) {
    c.fillStyle = "#5a1410";
    c.beginPath();
    c.moveTo(50, -38 + nod);
    c.lineTo(65, -36 + nod + open * 4);
    c.lineTo(63, -34 + nod + open * 8);
    c.closePath();
    c.fill();
  }
  // horns, brow ridge, nostril, eye
  c.fillStyle = L.horn;
  c.beginPath();
  c.moveTo(41, -47 + nod);
  c.quadraticCurveTo(30, -56 + nod, 27, -63 + nod);
  c.quadraticCurveTo(36, -55 + nod, 45, -49 + nod);
  c.fill();
  if (!young) {
    c.beginPath();
    c.moveTo(45, -48 + nod);
    c.lineTo(39, -58 + nod);
    c.lineTo(48, -49 + nod);
    c.fill();
  }
  c.fillStyle = "#2a1a14";
  c.beginPath();
  c.arc(64, -42 + nod, 1.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = dr.owner ? "#9be36b" : "#ffe066";
  c.beginPath();
  c.arc(49, -45 + nod, young ? 3 : 2.3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#111";
  c.fillRect(48.5, -46.6 + nod, 1.1, 3.2);
  if (dr.state === "sleep") {
    c.strokeStyle = shade(L.body, -0.3);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(46.5, -45 + nod);
    c.lineTo(51.5, -45 + nod);
    c.stroke();
  }
  // near legs + near wing on top
  leg(-8, true);
  leg(14, true);
  wing(true);
  c.restore();
  c.filter = "none";

  // smoke curling from the nostrils at rest
  if (!flying && dr.state !== "sleep" && Math.sin(t * 1.3 + dr.id) > 0.85) {
    c.fillStyle = "rgba(90,90,90,0.25)";
    const k = (t * 0.8 + dr.id) % 1;
    c.beginPath();
    c.arc(dr.dir * (64 * s + k * 10), -42 * s - hop * 14 * s - k * 18, 3 + k * 5, 0, Math.PI * 2);
    c.fill();
  }

  if (dr.breath > 0.05) drawBreath(c, dr, t, s, hop);
}

/** The fire cone: from the mouth toward the aim point (or down + ahead for wild dragons). */
function drawBreath(c: CanvasRenderingContext2D, dr: Dragon, t: number, s: number, hop: number) {
  const st = dragonStats(dr);
  const mx = dr.dir * MOUTH.x * s;
  const my = MOUTH.y * s - hop * 14 * s;
  let ang: number;
  let len: number;
  if (dr.owner && dr.aimX !== undefined && dr.aimY !== undefined) {
    // aim is on the ground: from the mouth (which is up at z) to the target
    const dx = dr.aimX - dr.x - mx;
    const dy = dr.aimY - dr.y + dr.z - my;
    ang = Math.atan2(dy, dx);
    len = Math.min(Math.hypot(dx, dy), 90 + 160 * st.fire);
  } else {
    ang = Math.atan2(Math.max(20, dr.z * 0.6), dr.dir * 120);
    len = 150;
  }
  const b = dr.breath;
  c.save();
  c.translate(mx, my);
  c.rotate(ang);
  c.globalCompositeOperation = "lighter";
  // outer flame, inner core
  for (let i = 0; i < 9; i++) {
    const k = i / 9;
    const r = (5 + k * 26) * (0.7 + 0.3 * Math.min(1.4, st.fire));
    const fl = Math.sin(t * 34 + i * 1.7) * 4 * k;
    c.fillStyle = `rgba(255,${Math.round(150 - k * 100)},${Math.round(40 - k * 30)},${(1 - k) * 0.55 * b})`;
    c.beginPath();
    c.arc(k * len, fl, r, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 5; i++) {
    const k = i / 5;
    c.fillStyle = `rgba(255,250,${Math.round(200 - k * 100)},${(1 - k) * 0.6 * b})`;
    c.beginPath();
    c.arc(k * len * 0.6, Math.sin(t * 40 + i) * 2, 3 + k * 7, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = "source-over";
  // heat shimmer + smoke past the end
  c.strokeStyle = `rgba(255,230,200,${0.12 * b})`;
  c.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    for (let x = 0; x <= len; x += 8) {
      const y = -16 - i * 8 + Math.sin(x * 0.12 + t * 12 + i) * 3;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = `rgba(60,55,50,${0.25 * b})`;
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.5 + i / 3) % 1;
    c.beginPath();
    c.arc(len + k * 20, -k * 30, 10 + k * 14, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** A dragon egg: breed colours + spots; warm glow when incubating, cracks when nearly ready. */
export function drawDragonEgg(c: CanvasRenderingContext2D, egg: DragonEgg, t: number, scale = 1) {
  const L = BREEDS[egg.breed].look;
  const wob = egg.hatchT > 0 ? Math.sin(t * 30) * 0.18 : egg.progress > 0.85 ? Math.sin(t * 6 + egg.id) * 0.06 : 0;
  c.save();
  c.scale(scale, scale);
  if (egg.at === "camp" && egg.heat > 0.55) {
    const g = c.createRadialGradient(0, -8, 0, 0, -8, 18);
    g.addColorStop(0, `rgba(255,170,70,${0.35 * egg.heat})`);
    g.addColorStop(1, "rgba(255,170,70,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -8, 18, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
  c.fill();
  c.rotate(wob);
  const g = c.createRadialGradient(-2, -11, 1, 0, -8, 10);
  g.addColorStop(0, shade(L.egg, 0.35));
  g.addColorStop(1, shade(L.egg, -0.2));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, -8, 6.2, 8.5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = egg.rare ? "#ffd75a" : L.spots;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.arc(-3 + ((i * 7) % 7), -12 + ((i * 5) % 9), 1 + (i % 2) * 0.6, 0, Math.PI * 2);
    c.fill();
  }
  if (egg.health < 0.4) {
    c.fillStyle = `rgba(190,220,255,${(0.4 - egg.health) * 1.5})`;
    c.beginPath();
    c.ellipse(0, -8, 6.2, 8.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (egg.progress > 0.8 || egg.hatchT > 0) {
    c.strokeStyle = "rgba(30,15,10,0.8)";
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(-5, -9);
    c.lineTo(-2, -7);
    c.lineTo(0, -10);
    c.lineTo(2, -7);
    c.lineTo(5, -9);
    if (egg.hatchT > 0) {
      c.moveTo(0, -10);
      c.lineTo(1, -14);
    }
    c.stroke();
  }
  c.restore();
}

/** A nest: a rocky ledge, a ring of branches and bones, treasure glinting, eggs inside. */
export function drawNest(c: CanvasRenderingContext2D, nest: DragonNest, eggs: DragonEgg[], t: number) {
  const hot = nest.site === "volcanic";
  c.save();
  c.fillStyle = hot ? "#3b3233" : "#7d776c";
  c.beginPath();
  c.ellipse(0, 4, 52, 20, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = hot ? "#4a3d3c" : "#958e80";
  c.beginPath();
  c.ellipse(-4, 0, 44, 15, 0, 0, Math.PI * 2);
  c.fill();
  if (hot) {
    c.strokeStyle = `rgba(255,120,40,${0.4 + Math.sin(t * 2) * 0.15})`;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-36, 8);
    c.lineTo(-20, 4);
    c.lineTo(-10, 10);
    c.moveTo(18, 9);
    c.lineTo(32, 3);
    c.stroke();
  }
  // the bowl of branches
  c.fillStyle = "#4a3320";
  c.beginPath();
  c.ellipse(0, -2, 30, 11, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#7a5534";
  c.lineWidth = 2.4;
  c.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = Math.cos(a) * 28;
    const y = -2 + Math.sin(a) * 10;
    c.beginPath();
    c.moveTo(x - Math.sin(a) * 9, y + Math.cos(a) * 3);
    c.lineTo(x + Math.sin(a) * 9, y - Math.cos(a) * 3);
    c.stroke();
  }
  // bones + treasure
  c.strokeStyle = "#e8dfc9";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(30, 8);
  c.lineTo(42, 4);
  c.moveTo(-40, 6);
  c.lineTo(-30, 10);
  c.stroke();
  const gold = (nest.loot.gold ?? 0) > 0;
  const crystal = (nest.loot.crystal ?? 0) > 0;
  if (gold) {
    c.fillStyle = "#e8c45d";
    for (const [x, y] of [[22, 2], [26, 5], [19, 6]]) {
      c.beginPath();
      c.ellipse(x, y, 3, 1.6, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (Math.sin(t * 3 + nest.id) > 0.8) {
      c.fillStyle = "rgba(255,255,220,0.9)";
      c.fillRect(24, 0, 1.5, 1.5);
    }
  }
  if (crystal) {
    c.fillStyle = "#9fe6ff";
    c.beginPath();
    c.moveTo(-26, 4);
    c.lineTo(-23, -6);
    c.lineTo(-20, 4);
    c.fill();
  }
  c.restore();
  for (const e of eggs) {
    c.save();
    c.translate(e.x - nest.x, e.y - nest.y);
    drawDragonEgg(c, e, t);
    c.restore();
  }
}
