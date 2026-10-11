/* ------------------------------------------------------------------ */
/*  Neanderthal art: a hulking, hunched brute (heavy brow, wide nose,  */
/*  shaggy hair + beard, grey pelt daubed in clan colours) with a      */
/*  club, stone axe, spear or rock; and their rough camps (hide        */
/*  lean-tos, a fire pit, bone piles, a skull pole with a clan rag).   */
/*  Origin: feet (brute) / camp centre.                                */
/* ------------------------------------------------------------------ */
import type { Brute, Clan } from "../sim/types";
import { shade } from "./drawDino";
import { drawFlame } from "./sprites";

const INK = "#24170e";
const SKINS = ["#b98560", "#a87552", "#c79470", "#956547"];
const HAIRS = ["#2b1d14", "#3a2618", "#1c1410", "#4a3020"];
const PELTS = ["#6e5f50", "#5d5045", "#7b6a58", "#54473d"];

const pickOf = <T,>(a: T[], n: number) => a[Math.abs(n) % a.length];

/** How high the weapon arm is raised, 0 (down) … 1 (wound up). */
function windup(b: Brute) {
  if (b.state === "bash") return 0.5 + Math.sin(b.anim * 2.2) * 0.5;
  if (b.state === "fight" || b.state === "hunt") return Math.max(0, Math.min(1, 1 - b.cd / 1.5));
  if (b.state === "rally") return 0.6 + Math.sin(b.anim * 3) * 0.4;
  return 0.15;
}

export function drawBrute(c: CanvasRenderingContext2D, b: Brute, t: number, color: string, shield = false) {
  const H = 36;
  const skin = pickOf(SKINS, b.id);
  const hair = pickOf(HAIRS, b.id * 7);
  const pelt = pickOf(PELTS, b.id * 3);
  const st = b.state;
  // spies + ambushers crouch low in the grass, hard to spot
  const hiding = st === "lurk" || (st === "spy" && Math.hypot(b.vx, b.vy) < 2);
  c.save();
  if ((b.age ?? 180) < 180) {
    const scale = 0.45 + (b.age ?? 0) / 180 * 0.5;
    c.scale(scale, scale);
    shield = false;
  }
  if (hiding) {
    c.globalAlpha = 0.6;
    c.scale(1, 0.8);
  }
  // shadow
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(0, 0, 13, 4.5, 0, 0, Math.PI * 2);
  c.fill();
  if (st === "sleep") {
    c.rotate((-Math.PI / 2) * b.dir);
    c.translate(-H * 0.12 * b.dir, -3);
  }
  c.scale(b.dir, 1);
  const moving = st === "walk" || st === "home" || st === "wander" || st === "flee" || st === "carry" || ((st === "fight" || st === "hunt") && Math.hypot(b.vx, b.vy) > 4);
  const sw = moving ? Math.sin(b.anim * 2.4) : 0;
  const bob = moving ? Math.abs(Math.sin(b.anim * 2.4)) * 1.2 : 0;
  const hipY = -H * 0.36 - bob;
  const lean = st === "fight" || st === "bash" || st === "carry" ? 0.22 : 0.12;

  // legs: short, thick, hairy
  c.lineCap = "round";
  for (const [k, ph] of [[-1, sw], [1, -sw]] as const) {
    c.strokeStyle = INK;
    c.lineWidth = 7.6;
    c.beginPath();
    c.moveTo(k * 3, hipY);
    c.lineTo(k * 3 + ph * 5, -1.5);
    c.stroke();
    c.strokeStyle = shade(skin, -0.12);
    c.lineWidth = 5.6;
    c.beginPath();
    c.moveTo(k * 3, hipY);
    c.lineTo(k * 3 + ph * 5, -1.5);
    c.stroke();
    // fur foot wraps
    c.fillStyle = shade(pelt, -0.2);
    c.beginPath();
    c.ellipse(k * 3 + ph * 5 + 1.5, -1.5, 4.2, 2.4, 0, 0, Math.PI * 2);
    c.fill();
  }

  c.save();
  c.translate(0, hipY);
  c.rotate(lean);
  // the far arm (behind the body)
  const arm = (ang: number, back: boolean) => {
    c.save();
    c.translate(back ? -5 : 6, -H * 0.36);
    c.rotate(ang);
    c.strokeStyle = INK;
    c.lineWidth = 7.4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, H * 0.36);
    c.stroke();
    c.strokeStyle = back ? shade(skin, -0.18) : skin;
    c.lineWidth = 5.4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, H * 0.36);
    c.stroke();
    c.fillStyle = back ? shade(skin, -0.18) : skin;
    c.beginPath();
    c.arc(0, H * 0.37, 3.4, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };
  const carrying = st === "carry";
  arm(carrying ? -2.6 : sw * 0.5 + 0.15, true);

  // barrel chest in a ragged grey pelt
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, -H * 0.2, 12.4, H * 0.26, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(0, -H * 0.2, 11, H * 0.24, 0, 0, Math.PI * 2);
  c.fill();
  // body hair on the chest
  c.strokeStyle = shade(hair, 0.1);
  c.lineWidth = 0.8;
  for (let k = 0; k < 5; k++) {
    c.beginPath();
    c.moveTo(1 + k * 1.6, -H * 0.3 + (k % 2));
    c.lineTo(2.2 + k * 1.6, -H * 0.27 + (k % 2));
    c.stroke();
  }
  // pelt over one shoulder + round the hips
  c.fillStyle = pelt;
  c.beginPath();
  c.moveTo(-11, -H * 0.3);
  c.lineTo(4, -H * 0.42);
  c.lineTo(11, -H * 0.12);
  c.lineTo(11.5, 2);
  for (let k = 0; k <= 6; k++) c.lineTo(11.5 - k * 3.8, 2 + (k % 2 ? 3.4 : 0));
  c.lineTo(-11.5, -H * 0.08);
  c.closePath();
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1;
  c.stroke();
  // pelt tufts + clan war paint
  c.fillStyle = shade(pelt, -0.25);
  for (const [x, y] of [[-5, -6], [3, -2], [-1, -10], [6, -8]]) {
    c.beginPath();
    c.ellipse(x, y, 1.6, 1.1, 0.4, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = color;
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(-6, -H * 0.36);
  c.lineTo(-2, -H * 0.26);
  c.moveTo(-3, -H * 0.38);
  c.lineTo(1, -H * 0.28);
  c.stroke();

  // head: low + forward, heavy brow, big nose, shaggy hair + beard
  const hy = -H * 0.5;
  const hx = 5;
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(hx, hy, 8.6, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(hx, hy, 7.4, 6.9, 0, 0, Math.PI * 2);
  c.fill();
  // hair mane
  c.fillStyle = hair;
  c.beginPath();
  c.ellipse(hx - 3.5, hy - 2.5, 7.5, 6.5, -0.3, Math.PI * 0.8, Math.PI * 2.1);
  c.fill();
  for (let k = 0; k < 5; k++) {
    c.beginPath();
    c.ellipse(hx - 8 + k * 0.6, hy - 2 + k * 2.2, 2.6, 3, 0.4, 0, Math.PI * 2);
    c.fill();
  }
  // beard
  c.beginPath();
  c.moveTo(hx - 1, hy + 1.5);
  c.quadraticCurveTo(hx + 1, hy + 11, hx + 6, hy + 8.5);
  c.quadraticCurveTo(hx + 8.5, hy + 4, hx + 7.4, hy + 1.5);
  c.closePath();
  c.fill();
  // brow ridge
  c.fillStyle = shade(skin, -0.28);
  c.beginPath();
  c.ellipse(hx + 3.2, hy - 2.6, 4.6, 1.8, -0.08, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = hair;
  c.fillRect(hx + 0.6, hy - 4.2, 6, 1.4);
  // wide nose
  c.fillStyle = shade(skin, -0.12);
  c.beginPath();
  c.ellipse(hx + 7, hy + 0.6, 2.4, 2.2, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.7;
  c.stroke();
  // eye (squinty, angry when fighting)
  if (st !== "sleep") {
    c.fillStyle = "#120c08";
    c.beginPath();
    c.arc(hx + 4.4, hy - 0.8, 1, 0, Math.PI * 2);
    c.fill();
    if (st === "fight" || st === "bash" || st === "rally") {
      c.fillStyle = "#3d0f0a";
      c.fillRect(hx + 4.5, hy + 3.4, 3, 1.4);
    }
  }

  // weapon arm (front)
  const up = windup(b);
  const ang = carrying ? -2.7 : -0.2 - up * 2.4;
  c.save();
  c.translate(6, -H * 0.36);
  c.rotate(ang);
  c.strokeStyle = INK;
  c.lineWidth = 7.6;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, H * 0.36);
  c.stroke();
  c.strokeStyle = skin;
  c.lineWidth = 5.6;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, H * 0.36);
  c.stroke();
  if (!carrying) {
    c.translate(0, H * 0.37);
    drawBruteWeapon(c, b.weapon);
  }
  c.fillStyle = skin;
  c.beginPath();
  c.arc(0, carrying ? H * 0.37 : 0, 3.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
  if (shield && !carrying && st !== "sleep") {
    // a round hide shield on a wicker frame, daubed in the clan's colour
    c.fillStyle = "#a07a4a";
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(-1, -H * 0.2, 8.5, 11.5, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-1, -H * 0.2 - 10);
    c.lineTo(-1, -H * 0.2 + 10);
    c.stroke();
    c.fillStyle = "#e9dcc0";
    c.beginPath();
    c.arc(-1, -H * 0.2, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  if (hiding) {
    // grass in front of them
    c.globalAlpha = 1;
    c.strokeStyle = "#5f8f3a";
    c.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(i * 4, 0);
      c.lineTo(i * 4 + Math.sin(t * 2 + i) * 2, -14 - (i % 2 ? 6 : 0));
      c.stroke();
    }
  }

  // health bar when hurt
  c.restore();
  if (b.hp < 0.98) {
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillRect(-12, -H - 10, 24, 4);
    c.fillStyle = b.hp > 0.5 ? "#facc15" : "#ef4444";
    c.fillRect(-11, -H - 9, 22 * Math.max(0, b.hp), 2);
  }
  void t;
}

/** In the hand, pointing "down" the arm (+y). */
function drawBruteWeapon(c: CanvasRenderingContext2D, kind: Brute["weapon"]) {
  c.lineCap = "round";
  if (kind === "rock") {
    c.fillStyle = INK;
    c.beginPath();
    c.arc(0, 2, 5.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8f8a82";
    c.beginPath();
    c.arc(0, 2, 4.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.beginPath();
    c.arc(-1.4, 0.6, 1.4, 0, Math.PI * 2);
    c.fill();
    return;
  }
  const len = kind === "spear" ? 34 : 20;
  c.strokeStyle = INK;
  c.lineWidth = kind === "club" ? 5 : 3.6;
  c.beginPath();
  c.moveTo(0, kind === "spear" ? -10 : -2);
  c.lineTo(0, len);
  c.stroke();
  c.strokeStyle = "#7a5230";
  c.lineWidth = kind === "club" ? 3.4 : 2.2;
  c.beginPath();
  c.moveTo(0, kind === "spear" ? -10 : -2);
  c.lineTo(0, len);
  c.stroke();
  if (kind === "club") {
    // a big knobbly end
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0, len + 2, 5.6, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8a5d33";
    c.beginPath();
    c.ellipse(0, len + 2, 4.4, 5.8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#5e3f24";
    for (const [x, y] of [[-2, len], [2, len + 3], [-1, len + 5]]) {
      c.beginPath();
      c.arc(x, y, 1, 0, Math.PI * 2);
      c.fill();
    }
  } else if (kind === "axe") {
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(-1, len - 9);
    c.lineTo(8.5, len - 12);
    c.lineTo(9.5, len - 1);
    c.lineTo(-1, len - 2);
    c.closePath();
    c.fill();
    c.fillStyle = "#9b958b";
    c.beginPath();
    c.moveTo(0, len - 8);
    c.lineTo(7.5, len - 10.5);
    c.lineTo(8.3, len - 2.4);
    c.lineTo(0, len - 3);
    c.closePath();
    c.fill();
    c.strokeStyle = "#8a4b22";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-2, len - 6);
    c.lineTo(2, len - 4);
    c.stroke();
  } else {
    // flint tip
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(-3.4, len - 1);
    c.lineTo(0, len + 9);
    c.lineTo(3.4, len - 1);
    c.closePath();
    c.fill();
    c.fillStyle = "#c9c2b5";
    c.beginPath();
    c.moveTo(-2.4, len);
    c.lineTo(0, len + 7);
    c.lineTo(2.4, len);
    c.closePath();
    c.fill();
  }
}

/** A thrown spear / rock in flight (origin = its ground spot; z lifts it). */
export function drawBruteMissile(c: CanvasRenderingContext2D, kind: "spear" | "rock", z: number, ang: number) {
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(0, 0, 4, 1.6, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(0, -z);
  if (kind === "rock") {
    c.fillStyle = INK;
    c.beginPath();
    c.arc(0, 0, 4.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8f8a82";
    c.beginPath();
    c.arc(0, 0, 3.4, 0, Math.PI * 2);
    c.fill();
  } else {
    c.rotate(ang);
    c.strokeStyle = "#7a5230";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-14, 0);
    c.lineTo(10, 0);
    c.stroke();
    c.fillStyle = "#c9c2b5";
    c.beginPath();
    c.moveTo(10, -2.4);
    c.lineTo(16, 0);
    c.lineTo(10, 2.4);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** A Neanderthal camp: trampled dirt, hide lean-tos, a fire pit, bones and a skull pole. */
export function drawClanCamp(c: CanvasRenderingContext2D, clan: Clan, t: number, night: boolean, size: number) {
  const tier = clan.campTier ?? 0;
  // trampled ground
  c.fillStyle = "rgba(120,92,60,0.38)";
  c.beginPath();
  c.ellipse(0, 6, 130 + tier * 20, 62 + tier * 8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(95,72,48,0.25)";
  c.beginPath();
  c.ellipse(-20, 14, 80, 36, 0.1, 0, Math.PI * 2);
  c.fill();
  // lean-tos (one per couple of members, at least two)
  const huts = Math.max(2, Math.min(8, 2 + tier * 2, Math.ceil(size / 2) + tier));
  const spots: [number, number, number][] = [[-78, -18, 1], [70, -26, -1], [-20, -46, 1], [96, 24, -1], [-112, 25, 1], [24, -61, -1], [143, -12, -1], [-145, -12, 1]];
  for (let i = 0; i < huts; i++) {
    const [x, y, f] = spots[i];
    c.save();
    c.translate(x, y);
    c.scale(f, 1);
    if (clan.style === "timber") timberHut(c, clan.color, i);
    else if (clan.style === "bone") boneLodge(c, clan.color, i);
    else leanTo(c, clan.color, i);
    c.restore();
  }
  // bone pile
  c.save();
  c.translate(-46, 30);
  for (const [x, y, a] of [[0, 0, 0.3], [6, -2, -0.5], [-5, -3, 1.2], [3, -5, 2]] as const) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-6, 0);
    c.lineTo(6, 0);
    c.stroke();
    c.strokeStyle = "#ede3cb";
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-6, 0);
    c.lineTo(6, 0);
    c.stroke();
    c.restore();
  }
  c.restore();
  // A raised rack makes the gathered food and the camp's growth visible.
  if (tier > 0 || clan.food > 8) {
    c.strokeStyle = "#38291b";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-112, 35); c.lineTo(-112, 13); c.lineTo(-72, 13); c.lineTo(-72, 35);
    c.stroke();
    for (let i = 0; i < Math.min(5, Math.ceil(clan.food / 4)); i++) {
      c.fillStyle = i % 2 ? "#9e5c38" : "#a97745";
      c.beginPath(); c.ellipse(-107 + i * 8, 15, 3.5, 5, 0, 0, Math.PI * 2); c.fill();
    }
  }
  // skull pole with the clan rag
  c.save();
  c.translate(44, -6);
  c.strokeStyle = INK;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -46);
  c.stroke();
  c.strokeStyle = "#6b4a2a";
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -46);
  c.stroke();
  const flap = Math.sin(t * 3 + clan.id) * 3;
  c.fillStyle = clan.color;
  c.strokeStyle = INK;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(1, -40);
  c.quadraticCurveTo(10, -38 + flap, 17, -36 + flap);
  c.lineTo(14, -30 + flap * 0.6);
  c.quadraticCurveTo(8, -31, 1, -29);
  c.closePath();
  c.fill();
  c.stroke();
  // the skull on top
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, -51, 7, 6.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#efe6d0";
  c.beginPath();
  c.ellipse(0, -51, 6, 5.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#2a1e15";
  for (const ex of [-2.2, 2.2]) {
    c.beginPath();
    c.arc(ex, -52, 1.4, 0, Math.PI * 2);
    c.fill();
  }
  c.fillRect(-2, -48.4, 4, 1.2);
  c.restore();
  // fire pit
  c.save();
  c.translate(0, 8);
  if (night) {
    const g = c.createRadialGradient(0, -6, 4, 0, -6, 90);
    g.addColorStop(0, "rgba(255,170,80,0.32)");
    g.addColorStop(1, "rgba(255,170,80,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -6, 90, 0, Math.PI * 2);
    c.fill();
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    c.fillStyle = k % 2 ? "#8f8a82" : "#7a756d";
    c.beginPath();
    c.ellipse(Math.cos(a) * 11, Math.sin(a) * 5, 3.6, 2.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "#3d2a1a";
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(-7, 1);
  c.lineTo(7, -3);
  c.moveTo(-6, -3);
  c.lineTo(7, 1);
  c.stroke();
  drawFlame(c, -2, 0, 0.75, t + clan.id);
  drawFlame(c, 3, -1, 0.6, t * 1.3 + clan.id);
  c.restore();
}

function timberHut(c: CanvasRenderingContext2D, color: string, seed: number) {
  c.fillStyle = "#5e422b";
  c.fillRect(-23, -20, 44, 22);
  c.strokeStyle = "#382719";
  c.lineWidth = 2;
  for (let y = -16; y < 3; y += 6) { c.beginPath(); c.moveTo(-23, y); c.lineTo(21, y); c.stroke(); }
  c.fillStyle = seed % 2 ? "#775638" : "#886340";
  c.beginPath(); c.moveTo(-30, -19); c.lineTo(0, -43); c.lineTo(27, -19); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#26190e"; c.fillRect(-6, -13, 13, 15);
  c.fillStyle = color; c.fillRect(10, -30, 8, 5);
}

function boneLodge(c: CanvasRenderingContext2D, color: string, seed: number) {
  c.fillStyle = seed % 2 ? "#78604b" : "#92745a";
  c.beginPath(); c.moveTo(-26, 2); c.quadraticCurveTo(-20, -26, 0, -35); c.quadraticCurveTo(23, -25, 27, 2); c.closePath(); c.fill();
  c.strokeStyle = "#e0d5b9"; c.lineWidth = 4;
  c.beginPath(); c.moveTo(-24, 1); c.quadraticCurveTo(-19, -28, 0, -38); c.quadraticCurveTo(21, -27, 25, 1); c.stroke();
  c.fillStyle = "#2b1c13"; c.beginPath(); c.ellipse(0, -5, 8, 10, 0, Math.PI, 0); c.fill();
  c.fillStyle = color; c.beginPath(); c.arc(0, -32, 4, 0, Math.PI * 2); c.fill();
}

function leanTo(c: CanvasRenderingContext2D, color: string, seed: number) {
  // a frame of long sticks leaning on a cross pole, draped with patchy hides
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(4, 2, 30, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1d140d";
  c.beginPath();
  c.moveTo(-20, 0);
  c.lineTo(-6, -30);
  c.lineTo(8, 0);
  c.closePath();
  c.fill();
  const hides = ["#7a5a3e", "#6b4e36", "#8a6a4a"];
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    c.fillStyle = hides[(k + seed) % 3];
    c.beginPath();
    c.moveTo(-6 + k * 4, -30 + k * 9);
    c.lineTo(26 - k * 2, -4 + k * 2);
    c.lineTo(26 - k * 2, 2);
    c.lineTo(4 + k * 3, 2);
    c.closePath();
    c.fill();
    c.stroke();
  }
  // a painted hand print in the clan colour
  c.fillStyle = color;
  c.globalAlpha = 0.85;
  c.beginPath();
  c.arc(12, -10, 3, 0, Math.PI * 2);
  c.fill();
  for (let f = 0; f < 4; f++) c.fillRect(9.4 + f * 1.6, -16, 1.1, 4);
  c.globalAlpha = 1;
  // poles sticking out the top
  c.strokeStyle = "#5e3f24";
  c.lineWidth = 2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-6, -30);
  c.lineTo(-9, -37);
  c.moveTo(-6, -30);
  c.lineTo(-1, -36);
  c.stroke();
}
