/* ------------------------------------------------------------------ */
/*  Tree People art: lean, wiry forest raiders (wild hair full of      */
/*  leaves, tribe-coloured body paint, leaf + hide wraps, bone          */
/*  charms, the odd bark mask) with spears, clubs, bone knives,         */
/*  slings + short bows. Hidden ones are only a clump of leaves and a   */
/*  pair of glinting eyes.                                             */
/*                                                                     */
/*  Their camps: decks, leaf huts, a lookout and hanging stores up in   */
/*  the trees, tied with rope bridges, ladders down to a ritual ground  */
/*  ringed with sharpened stakes; and warning displays round the edge   */
/*  of their woods (totems, bone charms, spike lines, painted marks,    */
/*  scraps of raided gear). Stylised + eerie, never gory.               */
/*  Origins: feet (folk) / world coords (camp parts) / sign base.        */
/* ------------------------------------------------------------------ */
import type { Brute, TreePod, TreeSign, TreeTribe } from "../sim/types";
import { shade } from "./drawDino";
import { drawFlame } from "./sprites";

const INK = "#1d150e";
const SKINS = ["#9c7048", "#b58457", "#7d5636", "#a6774c", "#8a6a3e"];
const HAIRS = ["#1d140d", "#3b2414", "#2a1d10", "#4a2f18"];
const WRAPS = ["#4f7a33", "#5d6b2c", "#3f6a3a", "#6b5a32"];
const BONE = "#efe4c8";
const WOOD = "#7a5530";
const pickOf = <T,>(a: T[], n: number) => a[Math.abs(Math.floor(n)) % a.length];

/** How far the weapon arm is wound up, 0..1. */
function windup(b: Brute) {
  if (b.state === "fight" || b.state === "hunt") return Math.max(0, Math.min(1, 1 - b.cd / 1.2));
  if (b.state === "drop") return 1;
  if (b.state === "rally") return 0.6 + Math.sin(b.anim * 3.4) * 0.4;
  return 0.2;
}

export function drawTreeFolk(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string, shadow = false) {
  if (shadow && !b.hidden) {
    // creeping about in the dark: a faint shape, and two eyes that catch the light
    c.save();
    c.globalAlpha = 0.4;
    drawTreeFolk(c, b, t, "#3a3a3a", false);
    c.restore();
    const blink = (t * 0.9 + b.id * 0.31) % 3.5;
    if (blink > 0.12) {
      c.fillStyle = "rgba(255,230,120,0.95)";
      c.beginPath();
      c.ellipse(b.dir * 3.5 - 1.6, -31 + (b.z > 4 ? 6 : 0), 1.2, 0.8, 0, 0, Math.PI * 2);
      c.ellipse(b.dir * 3.5 + 1.8, -31.2 + (b.z > 4 ? 6 : 0), 1.2, 0.8, 0, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  const young = (b.age ?? 100) < 100;
  // its shadow stays on the ground under the tree
  const zs = Math.max(0.35, 1 - b.z / 140);
  c.fillStyle = `rgba(0,0,0,${0.2 * zs})`;
  c.beginPath();
  c.ellipse(0, b.z, 10 * zs, 3.4 * zs, 0, 0, Math.PI * 2);
  c.fill();
  if (b.hidden) {
    drawHidden(c, b, t, paint);
    return;
  }
  c.save();
  if (young) {
    const s = 0.5 + ((b.age ?? 0) / 100) * 0.42;
    c.scale(s, s);
  }
  const H = 32;
  const skin = pickOf(SKINS, b.id);
  const hair = pickOf(HAIRS, b.id * 7);
  const wrap = pickOf(WRAPS, b.id * 3);
  const st = b.state;
  const moving = Math.hypot(b.vx, b.vy) > 4 || st === "dart";
  const sleeping = st === "sleep";
  const perched = (st === "perch" || st === "sleep") && b.z > 4;
  const climbing = st === "climb" && b.z > 1;
  const leaping = st === "drop";
  if (sleeping) {
    c.rotate((-Math.PI / 2) * b.dir);
    c.translate(-H * 0.15 * b.dir, -2);
  }
  c.scale(b.dir, 1);
  const run = moving ? Math.sin(b.anim * 3) : 0;
  const bob = moving ? Math.abs(Math.sin(b.anim * 3)) * 1.6 : 0;
  const crouch = perched && !sleeping ? 0.62 : st === "rally" ? 0.9 + Math.abs(Math.sin(b.anim * 3.4)) * 0.1 : 1;
  const hipY = -H * 0.42 * crouch - bob + (leaping ? -2 : 0);
  // a hard forward lean when running / fighting: built for speed
  const lean = leaping ? -0.35 : st === "fight" || st === "dart" || st === "flee" || st === "hunt" ? 0.38 : moving ? 0.26 : perched ? 0.3 : 0.08;

  // legs: long + wiry; bent double when squatting on a branch; splayed in a leap; hugging the trunk climbing
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const [k, ph] of [[-1, run], [1, -run]] as const) {
    let kx: number;
    let ky: number;
    let fx: number;
    let fy: number;
    if (leaping) {
      kx = k * 7;
      ky = hipY + 7;
      fx = k * 10;
      fy = hipY + 13;
    } else if (perched) {
      kx = 6 + k * 2;
      ky = hipY - 3;
      fx = 2 + k * 3;
      fy = -1;
    } else if (climbing) {
      const s = Math.sin(b.anim * 2 + (k > 0 ? Math.PI : 0)) * 4;
      kx = 5;
      ky = hipY + 4 + s;
      fx = 3;
      fy = -2 + s;
    } else {
      kx = k * 2 + ph * 6 + 2;
      ky = hipY * 0.5;
      fx = k * 2 + ph * 8;
      fy = -1.5 - Math.max(0, -ph) * 2.5;
    }
    c.strokeStyle = INK;
    c.lineWidth = 5.6;
    c.beginPath();
    c.moveTo(k * 2.4, hipY);
    c.lineTo(kx, ky);
    c.lineTo(fx, fy);
    c.stroke();
    c.strokeStyle = k < 0 ? shade(skin, -0.16) : skin;
    c.lineWidth = 3.8;
    c.stroke();
    // shin paint
    c.strokeStyle = paint;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(kx + (fx - kx) * 0.3 - 1.6, ky + (fy - ky) * 0.3);
    c.lineTo(kx + (fx - kx) * 0.3 + 1.6, ky + (fy - ky) * 0.3);
    c.moveTo(kx + (fx - kx) * 0.55 - 1.6, ky + (fy - ky) * 0.55);
    c.lineTo(kx + (fx - kx) * 0.55 + 1.6, ky + (fy - ky) * 0.55);
    c.stroke();
  }

  c.save();
  c.translate(0, hipY);
  c.rotate(lean);
  const torso = H * 0.36;
  const wu = windup(b);
  const arm = (ang: number, back: boolean) => {
    c.save();
    c.translate(back ? -3 : 4, -torso + 2);
    c.rotate(ang);
    c.strokeStyle = INK;
    c.lineWidth = 5.2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, H * 0.34);
    c.stroke();
    c.strokeStyle = back ? shade(skin, -0.2) : skin;
    c.lineWidth = 3.5;
    c.stroke();
    // armband of twisted vine + a paint stripe
    c.strokeStyle = back ? shade(wrap, -0.2) : wrap;
    c.lineWidth = 4.4;
    c.beginPath();
    c.moveTo(0, H * 0.1);
    c.lineTo(0, H * 0.13);
    c.stroke();
    c.strokeStyle = paint;
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(-1.8, H * 0.22);
    c.lineTo(1.8, H * 0.25);
    c.stroke();
    c.restore();
  };
  // the far arm: reaching up the trunk, out in a leap, or swinging
  arm(climbing ? -2.9 + Math.sin(b.anim * 2) * 0.3 : leaping ? -2.2 : perched ? 0.9 : run * 0.7 + 0.2, true);

  // wiry torso
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, -torso * 0.5, 7.6, torso * 0.62, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(0, -torso * 0.5, 6.4, torso * 0.56, 0, 0, Math.PI * 2);
  c.fill();
  // body paint: tribe stripes down the chest + white dots
  c.strokeStyle = paint;
  c.lineWidth = 1.6;
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    c.moveTo(-3.5 + k * 3, -torso * 0.95);
    c.quadraticCurveTo(-2.5 + k * 3, -torso * 0.55, -3.8 + k * 3, -torso * 0.2);
  }
  c.stroke();
  c.fillStyle = "rgba(245,240,225,0.85)";
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.arc(4.2 - (k % 2) * 1.6, -torso * (0.82 - k * 0.15), 0.7, 0, Math.PI * 2);
    c.fill();
  }
  // bone + tooth necklace
  c.strokeStyle = "#6b4a2a";
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-4, -torso * 1.02);
  c.quadraticCurveTo(1, -torso * 0.72, 5.5, -torso * 1.0);
  c.stroke();
  c.fillStyle = BONE;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.moveTo(-2.4 + k * 2.2, -torso * 0.86 + Math.abs(k - 1.5) * -0.8);
    c.lineTo(-1.7 + k * 2.2, -torso * 0.72 + Math.abs(k - 1.5) * -0.8);
    c.lineTo(-1 + k * 2.2, -torso * 0.86 + Math.abs(k - 1.5) * -0.8);
    c.fill();
  }
  // leaf + hide skirt with ragged points
  c.fillStyle = wrap;
  c.beginPath();
  c.moveTo(-7.5, -torso * 0.12);
  c.lineTo(7.5, -torso * 0.12);
  for (let k = 0; k <= 6; k++) c.lineTo(7.5 - k * 2.5, 4.5 + (k % 2 ? 3.6 : 0) + Math.sin(t * 6 + k + b.id) * (moving ? 1 : 0.3));
  c.closePath();
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.stroke();
  c.strokeStyle = shade(wrap, 0.25);
  c.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(-4 + k * 4, -torso * 0.05);
    c.lineTo(-4.5 + k * 4, 5);
    c.stroke();
  }

  // head: wild hair, maybe a bark mask, painted face
  c.save();
  c.translate(1.5, -torso - 6.5);
  const masked = b.id % 3 === 0;
  // spiky hair with leaves + a feather
  c.fillStyle = hair;
  c.beginPath();
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI * 1.05 + (k / 8) * Math.PI * 1.15;
    const r = k % 2 ? 7.2 : 10.8 + Math.sin(t * 4 + k + b.id) * (moving ? 0.8 : 0.3);
    c.lineTo(Math.cos(a) * r - 1.5, Math.sin(a) * r + 0.5);
  }
  c.lineTo(-4, 5);
  c.closePath();
  c.fill();
  c.fillStyle = "#6fa83f";
  for (const [x, y, a] of [[-6, -6, 0.6], [2, -8, -0.4], [-8, 0, 1.2]] as const) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.ellipse(0, 0, 2.8, 1.2, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  c.strokeStyle = pickOf(["#d9452b", "#e7c64a", "#f4f1e6"], b.id * 5);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-3, -6);
  c.quadraticCurveTo(-8, -15, -13, -16);
  c.stroke();
  // face
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(1.5, 0.5, 5.6, 6.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(1.5, 0.5, 4.6, 5.2, 0, 0, Math.PI * 2);
  c.fill();
  if (masked) {
    // a carved bark mask: tribe-coloured slashes round dark eye holes
    c.fillStyle = "#6a4626";
    c.beginPath();
    c.moveTo(-2, -4.5);
    c.lineTo(6.6, -4);
    c.lineTo(6, 3.5);
    c.lineTo(2.5, 5.8);
    c.lineTo(-1.5, 3);
    c.closePath();
    c.fill();
    c.strokeStyle = paint;
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(0, 2);
    c.lineTo(5, -0.5);
    c.moveTo(0.5, 4);
    c.lineTo(5, 1.8);
    c.stroke();
    c.fillStyle = "#120c07";
    c.beginPath();
    c.ellipse(4.2, -1.8, 1.4, 1, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffe36a";
    c.beginPath();
    c.arc(4.4, -1.8, 0.55, 0, Math.PI * 2);
    c.fill();
  } else {
    // face paint: a band across the eyes, sharp eyes, a fierce grin when fighting
    c.fillStyle = paint;
    c.globalAlpha = 0.85;
    c.fillRect(-1.6, -2.8, 7.4, 2.4);
    c.globalAlpha = 1;
    c.fillStyle = "#fff8e0";
    c.beginPath();
    c.ellipse(4.3, -1.6, 1.3, 0.85, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(4.7, -1.6, 0.6, 0, Math.PI * 2);
    c.fill();
    const fierce = st === "fight" || st === "drop" || st === "rally" || st === "hunt";
    c.strokeStyle = INK;
    c.lineWidth = 0.9;
    c.beginPath();
    if (fierce) {
      c.moveTo(2.8, 2.6);
      c.lineTo(5.6, 2.2);
      c.stroke();
      c.fillStyle = "#fff";
      c.fillRect(3.2, 2.2, 2, 0.8);
    } else {
      c.moveTo(3.3, 2.8);
      c.lineTo(5.2, 2.6);
      c.stroke();
    }
  }
  if (sleeping) {
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.font = "bold 7px sans-serif";
    c.fillText("z", 8, -8 - ((t * 6) % 6));
  }
  c.restore();

  // the weapon arm + weapon
  const swing = st === "fight" || st === "hunt" || leaping || st === "rally";
  const a = climbing ? -2.6 - Math.sin(b.anim * 2) * 0.3 : swing ? -2.5 + (1 - wu) * 2 : perched ? 0.6 : -run * 0.7 + 0.3;
  c.save();
  c.translate(4, -torso + 2);
  c.rotate(a);
  c.strokeStyle = INK;
  c.lineWidth = 5.2;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, H * 0.34);
  c.stroke();
  c.strokeStyle = skin;
  c.lineWidth = 3.5;
  c.stroke();
  c.translate(0, H * 0.34);
  if (!climbing) drawWeapon(c, b, t);
  c.restore();
  c.restore();

  // what they've grabbed: a bundle over the shoulder
  if (b.loot || b.forage) {
    c.fillStyle = "#b07a3c";
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(-7, hipY - 14, 5.5, 4.5, 0.3, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.restore();
}

function drawWeapon(c: CanvasRenderingContext2D, b: Brute, t: number) {
  c.lineCap = "round";
  switch (b.weapon) {
    case "spear": {
      c.strokeStyle = INK;
      c.lineWidth = 2.8;
      c.beginPath();
      c.moveTo(0, 12);
      c.lineTo(0, -24);
      c.stroke();
      c.strokeStyle = "#a07a46";
      c.lineWidth = 1.6;
      c.stroke();
      c.fillStyle = BONE;
      c.strokeStyle = INK;
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-2.4, -23);
      c.lineTo(0, -31);
      c.lineTo(2.4, -23);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = "#d9452b";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(0, -21);
      c.quadraticCurveTo(4, -18 + Math.sin(t * 7 + b.id) * 1.5, 5, -14);
      c.stroke();
      break;
    }
    case "club": {
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(0, 2);
      c.lineTo(0, -12);
      c.stroke();
      c.strokeStyle = WOOD;
      c.lineWidth = 2.6;
      c.stroke();
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, -14, 4.4, 5.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#8a6238";
      c.beginPath();
      c.ellipse(0, -14, 3.4, 4.4, 0, 0, Math.PI * 2);
      c.fill();
      // thorns
      c.fillStyle = BONE;
      for (const [x, y] of [[-4, -15], [4, -13], [0, -19.5]]) {
        c.beginPath();
        c.arc(x, y, 0.9, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "bone": {
      // a jawbone blade
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(-1.8, 2);
      c.lineTo(-2.4, -10);
      c.quadraticCurveTo(0, -15, 3, -11);
      c.lineTo(1.8, 2);
      c.closePath();
      c.fill();
      c.fillStyle = BONE;
      c.beginPath();
      c.moveTo(-1, 1);
      c.lineTo(-1.6, -9.5);
      c.quadraticCurveTo(0, -13.5, 2, -10.5);
      c.lineTo(1, 1);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff";
      for (let k = 0; k < 3; k++) c.fillRect(1.4, -8 + k * 3, 1.2, 1);
      break;
    }
    case "sling": {
      const sw = b.state === "fight" ? t * 14 : t * 3;
      c.strokeStyle = "#c9a56a";
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(sw) * 9, Math.sin(sw) * 9 - 3);
      c.stroke();
      c.fillStyle = "#8f8a82";
      c.beginPath();
      c.arc(Math.cos(sw) * 9, Math.sin(sw) * 9 - 3, 1.8, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "bow": {
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.beginPath();
      c.arc(4, -4, 10, -Math.PI * 0.55, Math.PI * 0.55);
      c.stroke();
      c.strokeStyle = WOOD;
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = "rgba(240,235,220,0.8)";
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(4 + Math.cos(-Math.PI * 0.55) * 10, -4 + Math.sin(-Math.PI * 0.55) * 10);
      c.lineTo(b.state === "fight" && b.cd < 0.6 ? -2 : 2, -4);
      c.lineTo(4 + Math.cos(Math.PI * 0.55) * 10, -4 + Math.sin(Math.PI * 0.55) * 10);
      c.stroke();
      break;
    }
    default: {
      c.fillStyle = "#8f8a82";
      c.beginPath();
      c.arc(0, -2, 3, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** Hidden in the leaves / brush: a clump of foliage and two eyes that catch the light now and then. */
function drawHidden(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string) {
  const up = b.z > 4;
  const y0 = up ? -10 : -6;
  const sway = Math.sin(t * 1.3 + b.id) * 1.2;
  const leaves = up ? ["#3e6e2c", "#4b7f34", "#2f5a24"] : ["#5a7d36", "#4a6d2e", "#6b8f3e"];
  for (let k = 0; k < 6; k++) {
    c.fillStyle = leaves[k % 3];
    c.beginPath();
    c.ellipse(Math.cos(k * 1.7) * 7 + sway, y0 + Math.sin(k * 2.3) * 4, 6.5, 4.6, k * 0.6, 0, Math.PI * 2);
    c.fill();
  }
  // a glimpse of paint through the leaves
  c.globalAlpha = 0.35;
  c.fillStyle = paint;
  c.fillRect(-3 + sway, y0 + 2, 6, 1.2);
  c.globalAlpha = 1;
  // the eyes: a slow blink, now and then a glint
  const blink = (t * 0.7 + b.id * 0.37) % 4;
  if (blink > 0.15) {
    const glint = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.1 + b.id));
    c.fillStyle = `rgba(255,226,110,${glint})`;
    c.beginPath();
    c.ellipse(-2 + sway, y0 - 1, 1.3, 0.8, 0, 0, Math.PI * 2);
    c.ellipse(2.5 + sway, y0 - 1.2, 1.3, 0.8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(-1.8 + sway, y0 - 1, 0.45, 0, Math.PI * 2);
    c.arc(2.7 + sway, y0 - 1.2, 0.45, 0, Math.PI * 2);
    c.fill();
  }
}

/* ------------------------------ camp ------------------------------ */

/** The canopy village (world coords): ladders, decks, huts, hanging stores, the lookout, rope bridges. */
export function drawTreeCanopy(c: CanvasRenderingContext2D, tr: TreeTribe, t: number, night: boolean) {
  const pods = tr.pods;
  // rope bridges between neighbouring decks (sorted round the camp so they make a loop)
  const ring = pods.map((p, i) => ({ p, i, a: Math.atan2(p.y - tr.y, p.x - tr.x) })).sort((a, b) => a.a - b.a);
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k].p;
    const b = ring[(k + 1) % ring.length].p;
    if (ring.length < 2 || (ring.length === 2 && k === 1)) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 230) continue;
    bridge(c, a, b, t, a.hp > 0 && b.hp > 0);
  }
  for (const p of pods) {
    // a ladder of lashed rungs (or a knotted rope) down to the ground
    if (p.hp > 0) ladder(c, p, (p.x * 7 + p.y) % 2 === 0);
    else brokenRope(c, p, t);
  }
  for (const p of [...pods].sort((a, b) => a.y - a.h - (b.y - b.h))) {
    c.save();
    c.translate(p.x, p.y - p.h);
    drawPod(c, p, tr, t, night);
    c.restore();
  }
}

function bridge(c: CanvasRenderingContext2D, a: TreePod, b: TreePod, t: number, whole: boolean) {
  const ax = a.x;
  const ay = a.y - a.h - 2;
  const bx = b.x;
  const by = b.y - b.h - 2;
  const sag = 14 + Math.sin(t * 1.2 + a.x * 0.01) * 2;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 + sag;
  if (!whole) {
    // snapped: two ends hanging
    c.strokeStyle = "#8a6a40";
    c.lineWidth = 1.2;
    for (const [x, y, s] of [[ax, ay, 1], [bx, by, -1]] as const) {
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + s * 8, y + 16, x + s * 4, y + 30 + Math.sin(t * 2 + x) * 2);
      c.stroke();
    }
    return;
  }
  const q = (k: number) => ({ x: (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * mx + k * k * bx, y: (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * my + k * k * by });
  // slats
  c.strokeStyle = "#6e4c2a";
  c.lineWidth = 2.4;
  for (let k = 1; k < 12; k++) {
    const p = q(k / 12);
    c.beginPath();
    c.moveTo(p.x, p.y - 2);
    c.lineTo(p.x, p.y + 2);
    c.stroke();
  }
  // two hand ropes
  c.strokeStyle = "#b8945c";
  c.lineWidth = 1;
  for (const off of [-3, -10]) {
    c.beginPath();
    c.moveTo(ax, ay + off);
    c.quadraticCurveTo(mx, my + off - 2, bx, by + off);
    c.stroke();
  }
}

function ladder(c: CanvasRenderingContext2D, p: TreePod, rope: boolean) {
  const x = p.x + 7;
  c.strokeStyle = "#8a6a40";
  c.lineWidth = 1.2;
  if (rope) {
    c.beginPath();
    c.moveTo(x, p.y - p.h);
    c.lineTo(x, p.y - 4);
    c.stroke();
    c.fillStyle = "#8a6a40";
    for (let y = p.y - p.h + 8; y < p.y - 6; y += 9) {
      c.beginPath();
      c.arc(x, y, 1.5, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  c.beginPath();
  c.moveTo(x - 3, p.y - p.h);
  c.lineTo(x - 3, p.y - 2);
  c.moveTo(x + 3, p.y - p.h);
  c.lineTo(x + 3, p.y - 2);
  c.stroke();
  c.lineWidth = 1;
  for (let y = p.y - p.h + 6; y < p.y - 4; y += 6) {
    c.beginPath();
    c.moveTo(x - 3, y);
    c.lineTo(x + 3, y);
    c.stroke();
  }
}

function brokenRope(c: CanvasRenderingContext2D, p: TreePod, t: number) {
  c.strokeStyle = "rgba(110,80,45,0.8)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(p.x + 6, p.y - p.h + 6);
  c.quadraticCurveTo(p.x + 10 + Math.sin(t * 1.5 + p.x) * 3, p.y - p.h * 0.6, p.x + 7, p.y - p.h * 0.45);
  c.stroke();
  // planks fallen at the foot of the tree
  c.fillStyle = "#5e4024";
  for (let k = 0; k < 3; k++) {
    c.save();
    c.translate(p.x - 8 + k * 7, p.y + 2 + (k % 2) * 3);
    c.rotate(0.4 - k * 0.5);
    c.fillRect(-6, -1, 12, 2.4);
    c.restore();
  }
}

/** One deck + whatever's built on it (origin: deck centre). */
function drawPod(c: CanvasRenderingContext2D, p: TreePod, tr: TreeTribe, t: number, night: boolean) {
  if (p.hp <= 0) {
    // what's left: a couple of broken planks wedged in the branches, a scorch
    c.strokeStyle = "#3d2a18";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(-14, 2);
    c.lineTo(-2, -2);
    c.moveTo(4, 4);
    c.lineTo(14, -3);
    c.stroke();
    return;
  }
  const wide = p.kind === "lookout" ? 15 : p.kind === "store" ? 17 : 22;
  // struts down to the trunk
  c.strokeStyle = "#4e3520";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-wide * 0.7, 2);
  c.lineTo(0, 16);
  c.lineTo(wide * 0.7, 2);
  c.stroke();
  // the deck: lashed planks, some missing if it's been knocked about
  const gone = p.hp < 1 ? Math.floor((1 - p.hp) * 5) : 0;
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, 1, wide + 1.5, 6.5, 0, 0, Math.PI * 2);
  c.fill();
  for (let k = 0; k < 7; k++) {
    if (k < gone && k % 2 === 0) continue;
    const x = -wide + 1 + k * ((wide * 2 - 2) / 7);
    c.fillStyle = k % 2 ? "#8a6238" : "#9b7142";
    c.fillRect(x, -3.5, (wide * 2 - 2) / 7 - 0.6, 8);
  }
  c.strokeStyle = "#c9a76a";
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-wide + 4, 0.5);
  c.lineTo(wide - 4, 0.5);
  c.stroke();
  switch (p.kind) {
    case "hut": {
      // a leaf-thatched dome hut with a dark doorway and a bone charm
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, -10, 16, 15, 0, Math.PI, 0);
      c.lineTo(16, -1);
      c.lineTo(-16, -1);
      c.fill();
      for (let row = 0; row < 4; row++) {
        c.fillStyle = row % 2 ? "#5b7f34" : "#4c6e2b";
        c.beginPath();
        c.ellipse(0, -2 - row * 5, 15 - row * 3, 6, 0, Math.PI, 0);
        c.fill();
        c.strokeStyle = "rgba(30,45,15,0.6)";
        c.lineWidth = 0.7;
        for (let k = -3; k <= 3; k++) {
          c.beginPath();
          c.moveTo(k * (4 - row * 0.7), -2 - row * 5);
          c.lineTo(k * (4 - row * 0.7) + 1, -6 - row * 5);
          c.stroke();
        }
      }
      c.fillStyle = night ? "#e08a3a" : "#1a120b";
      c.beginPath();
      c.ellipse(2, -4, 4, 5.5, 0, Math.PI, 0);
      c.lineTo(6, -1);
      c.lineTo(-2, -1);
      c.fill();
      if (night) {
        c.fillStyle = "rgba(255,170,80,0.18)";
        c.beginPath();
        c.arc(2, -4, 14, 0, Math.PI * 2);
        c.fill();
      }
      charm(c, -11, -6, t, tr.color);
      break;
    }
    case "lookout": {
      // railing posts, a hide flag in their colour, a spiky crown of stakes
      c.strokeStyle = "#4e3520";
      c.lineWidth = 1.6;
      for (const x of [-12, -4, 4, 12]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, -9);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(-12, -7);
      c.lineTo(12, -7);
      c.stroke();
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(10, -9);
      c.lineTo(10, -30);
      c.stroke();
      // a united tribe flies a streamer for every tribe in it
      const fl = Math.sin(t * 3 + p.x) * 2;
      const cols = tr.colors?.length ? tr.colors : [tr.color];
      if (cols.length > 1) {
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(10, -30);
        c.lineTo(10, -30 - cols.length * 4);
        c.stroke();
      }
      cols.forEach((col, i) => {
        const y0 = -30 - i * 4;
        const f = fl + i * 0.8;
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(10, y0);
        c.quadraticCurveTo(17, y0 + 1 + f, 22 + i * 2, y0 + 3 + f);
        c.lineTo(17, y0 + 6 + f * 0.5);
        c.lineTo(22 + i * 2, y0 + 9 + f);
        c.quadraticCurveTo(16, y0 + 8, 10, y0 + 9);
        c.closePath();
        c.fill();
      });
      c.fillStyle = BONE;
      for (const x of [-10, -6, -2]) {
        c.beginPath();
        c.moveTo(x - 1.2, -9);
        c.lineTo(x, -15);
        c.lineTo(x + 1.2, -9);
        c.fill();
      }
      break;
    }
    case "store": {
      // bundles + baskets hung under the deck on ropes, swaying
      for (const [x, len, s] of [[-10, 14, 5], [0, 20, 6.5], [10, 12, 4.5]] as const) {
        const sw = Math.sin(t * 1.4 + x + p.x) * 2;
        c.strokeStyle = "#b8945c";
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(x, 3);
        c.lineTo(x + sw, 3 + len);
        c.stroke();
        c.fillStyle = INK;
        c.beginPath();
        c.ellipse(x + sw, 3 + len + s, s + 1, s * 1.15 + 1, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#b07a3c";
        c.beginPath();
        c.ellipse(x + sw, 3 + len + s, s, s * 1.15, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#7a4f24";
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x + sw - s, 3 + len + s);
        c.lineTo(x + sw + s, 3 + len + s);
        c.stroke();
      }
      // a heap of fruit + a rolled hide on top
      c.fillStyle = "#c9572d";
      for (const [x, y] of [[-6, -4], [-2, -5], [2, -4]]) {
        c.beginPath();
        c.arc(x, y, 2.4, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#a0805a";
      c.fillRect(5, -6, 10, 4);
      break;
    }
    case "ritual": {
      // a painted pole hung with feathers + bone rings, a fire bowl
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-6, 0);
      c.lineTo(-6, -30);
      c.stroke();
      c.strokeStyle = tr.color;
      c.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.moveTo(-7.5, -6 - k * 6);
        c.lineTo(-4.5, -8 - k * 6);
        c.stroke();
      }
      c.strokeStyle = BONE;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(-6, -30, 6, 0, Math.PI * 2);
      c.stroke();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + t * 0.4;
        c.strokeStyle = k % 2 ? "#d9452b" : "#f2efe4";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(-6 + Math.cos(a) * 6, -30 + Math.sin(a) * 6);
        c.lineTo(-6 + Math.cos(a) * 6, -30 + Math.sin(a) * 6 + 8 + Math.sin(t * 3 + k) * 1.2);
        c.stroke();
      }
      c.fillStyle = "#3a2a1e";
      c.beginPath();
      c.ellipse(9, -2, 6, 3, 0, 0, Math.PI * 2);
      c.fill();
      drawFlame(c, 9, -3, 0.45, t);
      break;
    }
    default: {
      // a bare deck: a rolled sleeping mat and a stack of throwing rocks
      c.fillStyle = "#a0805a";
      c.fillRect(-14, -5, 12, 4);
      c.fillStyle = "#8f8a82";
      for (const [x, y] of [[6, -4], [9, -4], [7.5, -6.5]]) {
        c.beginPath();
        c.arc(x, y, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
}

/** A dangling charm: a little bone + feathers on a string. */
function charm(c: CanvasRenderingContext2D, x: number, y: number, t: number, color: string) {
  const sw = Math.sin(t * 2 + x) * 1.5;
  c.strokeStyle = "#b8945c";
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + sw, y + 8);
  c.stroke();
  c.fillStyle = BONE;
  c.fillRect(x + sw - 2, y + 8, 4, 1.6);
  c.strokeStyle = color;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x + sw, y + 9.5);
  c.lineTo(x + sw + 1, y + 14);
  c.stroke();
}

/** The ground under the camp: a beaten ritual ring with a fire + drum, stake lines round it, hidden paths out (world coords). */
export function drawTreeGround(c: CanvasRenderingContext2D, tr: TreeTribe, t: number, night: boolean, found: boolean) {
  c.save();
  c.translate(tr.x, tr.y);
  // trampled earth
  c.fillStyle = "rgba(96,74,46,0.35)";
  c.beginPath();
  c.ellipse(0, 18, 70, 32, 0, 0, Math.PI * 2);
  c.fill();
  // ring of painted stones
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const x = Math.cos(a) * 48;
    const y = 18 + Math.sin(a) * 21;
    c.fillStyle = "#6f6a60";
    c.beginPath();
    c.ellipse(x, y, 4.5, 3, 0, 0, Math.PI * 2);
    c.fill();
    if (k % 2 === 0) {
      const cols = tr.colors?.length ? tr.colors : [tr.color];
      c.fillStyle = cols[(k / 2) % cols.length];
      c.beginPath();
      c.arc(x, y - 1, 1.3, 0, Math.PI * 2);
      c.fill();
    }
  }
  // the fire pit
  c.fillStyle = "#2c241c";
  c.beginPath();
  c.ellipse(0, 18, 11, 5, 0, 0, Math.PI * 2);
  c.fill();
  drawFlame(c, 0, 16, night ? 0.8 : 0.5, t);
  if (night) {
    c.fillStyle = "rgba(255,150,60,0.12)";
    c.beginPath();
    c.ellipse(0, 18, 90, 45, 0, 0, Math.PI * 2);
    c.fill();
  }
  // a hide drum on a stump
  c.fillStyle = "#5e4024";
  c.fillRect(28, 4, 9, 9);
  c.fillStyle = "#d8c49a";
  c.beginPath();
  c.ellipse(32.5, 4, 5.5, 2.2, 0, 0, Math.PI * 2);
  c.fill();
  // lines of sharpened stakes guarding the way in (gaps where their own paths run)
  const R = 120 + tr.tier * 12;
  for (let k = 0; k < 16; k++) {
    if (k % 4 === 1) continue;
    const a = (k / 16) * Math.PI * 2 + 0.2;
    stakes(c, Math.cos(a) * R, 14 + Math.sin(a) * R * 0.46, a);
  }
  // hidden paths: faint trodden trails out into the woods (once we've found them)
  if (found) {
    c.strokeStyle = "rgba(90,66,40,0.28)";
    c.lineWidth = 5;
    c.setLineDash([10, 8]);
    for (const s of tr.signs.filter((_, i) => i % 2 === 0)) {
      c.beginPath();
      c.moveTo(0, 18);
      c.quadraticCurveTo((s.x - tr.x) * 0.4 + 30, (s.y - tr.y) * 0.6, s.x - tr.x, s.y - tr.y);
      c.stroke();
    }
    c.setLineDash([]);
  }
  c.restore();
}

function stakes(c: CanvasRenderingContext2D, x: number, y: number, a: number) {
  const out = Math.cos(a) >= 0 ? 1 : -1;
  for (let k = -1; k <= 1; k++) {
    const sx = x + k * 6 * -Math.sin(a);
    const sy = y + k * 3 * Math.cos(a);
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(sx + out * 6, sy - 15);
    c.stroke();
    c.strokeStyle = "#a07a46";
    c.lineWidth = 1.8;
    c.stroke();
    c.fillStyle = "#e7dcc0";
    c.beginPath();
    c.arc(sx + out * 6, sy - 15, 1, 0, Math.PI * 2);
    c.fill();
  }
}

/* ------------------------------ warning signs ------------------------------ */

/** A warning display at the edge of their woods (origin: its base). Stylised + eerie, not gory. */
export function drawTreeSign(c: CanvasRenderingContext2D, s: TreeSign, color: string, t: number) {
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  c.lineCap = "round";
  switch (s.kind) {
    case "totem": {
      // a carved post of stacked staring faces, painted, feathers on top
      c.fillStyle = INK;
      c.fillRect(-7, -46, 14, 46);
      for (let k = 0; k < 3; k++) {
        const y = -14 - k * 14;
        c.fillStyle = k % 2 ? "#6e4c2a" : "#7f5a33";
        c.fillRect(-6, y - 6, 12, 13);
        c.fillStyle = k === 1 ? color : "#efe4c8";
        c.fillRect(-4.5, y - 3, 3.2, 2.2);
        c.fillRect(1.3, y - 3, 3.2, 2.2);
        c.fillStyle = INK;
        c.fillRect(-3, y + 2, 6, 2);
        c.fillStyle = color;
        c.fillRect(-6, y + 5.5, 12, 1.4);
      }
      for (let k = -1; k <= 1; k++) {
        c.strokeStyle = k ? "#d9452b" : "#f2efe4";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(k * 3, -46);
        c.quadraticCurveTo(k * 7, -54, k * 9 + Math.sin(t * 2 + k) * 1.5, -60);
        c.stroke();
      }
      break;
    }
    case "bones": {
      // a pole + crossbar hung with clacking bone charms and a little horned skull
      pole(c, -34);
      c.strokeStyle = "#5e4024";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-13, -30);
      c.lineTo(13, -30);
      c.stroke();
      for (let k = 0; k < 5; k++) {
        const x = -11 + k * 5.5;
        const sw = Math.sin(t * 1.8 + k + s.x) * 1.6;
        c.strokeStyle = "#b8945c";
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x, -30);
        c.lineTo(x + sw, -22 + (k % 2) * 4);
        c.stroke();
        c.fillStyle = BONE;
        c.beginPath();
        c.ellipse(x + sw, -19 + (k % 2) * 4, 1.4, 3.4, 0, 0, Math.PI * 2);
        c.fill();
      }
      skull(c, 0, -40, color);
      break;
    }
    case "spikes": {
      // a line of sharpened stakes leaning outward, a scrap of painted hide tied on one
      for (let k = -2; k <= 2; k++) {
        c.strokeStyle = INK;
        c.lineWidth = 3.6;
        c.beginPath();
        c.moveTo(k * 7, 2);
        c.lineTo(k * 7 + 5, -22 + Math.abs(k) * 2);
        c.stroke();
        c.strokeStyle = "#a07a46";
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = BONE;
        c.beginPath();
        c.arc(k * 7 + 5, -22 + Math.abs(k) * 2, 1.2, 0, Math.PI * 2);
        c.fill();
      }
      const fl = Math.sin(t * 2.4 + s.x) * 2;
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(3, -14);
      c.lineTo(12, -13 + fl);
      c.lineTo(9, -9 + fl);
      c.lineTo(3, -10);
      c.fill();
      break;
    }
    case "marks": {
      // a mossy boulder daubed with handprints + spirals: "this is ours"
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, -9, 15, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#7d786d";
      c.beginPath();
      c.ellipse(0, -9, 13.5, 9.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#5f8a3a";
      c.beginPath();
      c.ellipse(-5, -16, 7, 3, -0.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = color;
      hand(c, -5, -8);
      c.strokeStyle = color;
      c.lineWidth = 1.3;
      c.beginPath();
      for (let k = 0; k < 20; k++) {
        const a = k * 0.6;
        const r = 0.4 + k * 0.22;
        c.lineTo(6 + Math.cos(a) * r, -9 + Math.sin(a) * r);
      }
      c.stroke();
      break;
    }
    case "trophy": {
      // crossed spears with a dented helmet + torn cloak hung on them: taken in a raid
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-12, 2);
      c.lineTo(10, -40);
      c.moveTo(12, 2);
      c.lineTo(-10, -40);
      c.stroke();
      c.strokeStyle = "#a07a46";
      c.lineWidth = 1.6;
      c.stroke();
      c.fillStyle = "#c9c2b5";
      for (const x of [10, -10]) {
        c.beginPath();
        c.moveTo(x - 2, -38);
        c.lineTo(x + (x > 0 ? 3 : -3), -46);
        c.lineTo(x + 2, -37);
        c.fill();
      }
      // the cloak (one of ours, from the colour) and an empty helmet
      const fl = Math.sin(t * 2 + s.x) * 1.5;
      c.fillStyle = "#3f6fa8";
      c.beginPath();
      c.moveTo(-7, -26);
      c.lineTo(7, -26);
      c.lineTo(6 + fl, -12);
      c.lineTo(2, -15);
      c.lineTo(-1 + fl, -10);
      c.lineTo(-6, -14);
      c.closePath();
      c.fill();
      c.fillStyle = "#8a8378";
      c.beginPath();
      c.ellipse(0, -31, 6, 5, 0, Math.PI, 0);
      c.fill();
      c.fillRect(-6.5, -31, 13, 1.6);
      break;
    }
    default: {
      // remains of a raid: a snapped spear, a split shield, a scatter of old bones
      c.strokeStyle = "#7a5530";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-16, -2);
      c.lineTo(-3, -6);
      c.moveTo(1, -3);
      c.lineTo(9, 1);
      c.stroke();
      c.fillStyle = "#6e5232";
      c.beginPath();
      c.arc(6, -7, 7, Math.PI * 0.1, Math.PI * 1.2);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 0.8;
      c.stroke();
      c.fillStyle = BONE;
      for (const [x, y, a] of [[-8, 2, 0.4], [-2, 4, -0.6], [12, 3, 1.1]] as const) {
        c.save();
        c.translate(x, y);
        c.rotate(a);
        c.fillRect(-4, -0.8, 8, 1.6);
        c.beginPath();
        c.arc(-4, 0, 1.3, 0, Math.PI * 2);
        c.arc(4, 0, 1.3, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
  }
}

function pole(c: CanvasRenderingContext2D, top: number) {
  c.strokeStyle = INK;
  c.lineWidth = 3.4;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, top);
  c.stroke();
  c.strokeStyle = "#6e4c2a";
  c.lineWidth = 2;
  c.stroke();
}

/** A rounded, cartoon animal skull with little horns and painted brows. */
function skull(c: CanvasRenderingContext2D, x: number, y: number, color: string) {
  c.fillStyle = BONE;
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(x - 4, y - 3);
  c.quadraticCurveTo(x - 10, y - 9, x - 9, y - 12);
  c.quadraticCurveTo(x - 6, y - 7, x - 2, y - 5);
  c.moveTo(x + 4, y - 3);
  c.quadraticCurveTo(x + 10, y - 9, x + 9, y - 12);
  c.quadraticCurveTo(x + 6, y - 7, x + 2, y - 5);
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(x, y, 6, 5.4, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(x, y + 5, 3.4, 2.6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(x - 2.3, y - 0.5, 1.5, 1.8, 0, 0, Math.PI * 2);
  c.ellipse(x + 2.3, y - 0.5, 1.5, 1.8, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x - 4, y - 3.4);
  c.lineTo(x - 1, y - 2.8);
  c.moveTo(x + 4, y - 3.4);
  c.lineTo(x + 1, y - 2.8);
  c.stroke();
}

function hand(c: CanvasRenderingContext2D, x: number, y: number) {
  c.beginPath();
  c.ellipse(x, y + 1.5, 2.6, 3, 0, 0, Math.PI * 2);
  c.fill();
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.ellipse(x - 2.4 + k * 1.6, y - 2.6 - (k === 1 || k === 2 ? 1 : 0), 0.7, 1.9, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.ellipse(x + 3.3, y + 0.5, 0.8, 1.6, 0.8, 0, Math.PI * 2);
  c.fill();
}
