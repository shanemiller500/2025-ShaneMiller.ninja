/* ------------------------------------------------------------------ */
/*  Sea People art: a people of the sea. Blue all over: blue-dyed      */
/*  skin swirls + scale patterns, blue fish-scale skirts, cloaks of     */
/*  seaweed streaming off their shoulders, long hair braided with kelp  */
/*  and shells, crowns of coral or a starfish, pearl necklaces, shell   */
/*  shoulder guards. Narwhal-white harpoons, conch-shell clubs, shell   */
/*  knives, slings. On the water: a driftwood outrigger canoe with a    */
/*  blue crab-claw sail. On a sea dragon: astride its back, kelp reins. */
/*                                                                     */
/*  Their villages are shell + driftwood: bleached, crooked driftwood   */
/*  stilts + decks, houses roofed with giant scallop shells or built    */
/*  inside huge conch + nautilus shells, a clam-shell crow's nest, a    */
/*  giant clam shrine with a glowing pearl, and sea farms: oyster beds  */
/*  ringed with shell floats, a woven fish pen, a stake pen of sharks.  */
/* ------------------------------------------------------------------ */
import type { Brute, SeaHut, SeaSign, SeaTribe } from "../sim/types";
import { shade } from "./drawDino";
import { drawFlame } from "./sprites";

const INK = "#132230";
const SKINS = ["#a9714a", "#8d5a37", "#b98157", "#7a4c2e", "#c08e64"];
const HAIRS = ["#0f1a22", "#1a2430", "#14202a", "#2a2018"];
const WEED = ["#2e5b3f", "#3d6b3a", "#25524f", "#4a6230"];
const CLOTH = ["#2c5d8f", "#1f7a8c", "#2a4fb8", "#2b8a9a"];
const DRIFT = "#c9bfae";
const DRIFT_DK = "#9e9381";
const SHELL = "#f6e9d6";
const SHELL_PINK = "#f3c9b8";
const PEARL = "#fbf7f0";
const CORAL = "#f07a5c";
const pickOf = <T,>(a: T[], n: number) => a[Math.abs(Math.floor(n)) % a.length];

export function drawSeaFolk(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string, shadow = false) {
  if (shadow) {
    c.save();
    c.globalAlpha = 0.35;
    drawSeaFolk(c, b, t, "#3a3a3a", false);
    c.restore();
    if ((t * 0.8 + b.id * 0.29) % 3.2 > 0.12) {
      c.fillStyle = "rgba(160,230,255,0.9)";
      c.beginPath();
      c.ellipse(b.dir * 3 - 1.6, b.boat ? -21 : -31, 1.1, 0.75, 0, 0, Math.PI * 2);
      c.ellipse(b.dir * 3 + 1.8, b.boat ? -21.2 : -31.2, 1.1, 0.75, 0, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  const young = (b.age ?? 120) < 120;
  c.save();
  if (young) {
    const s = 0.5 + ((b.age ?? 0) / 120) * 0.42;
    c.scale(s, s);
  }
  if (b.mount) rider(c, b, t, paint);
  else if (b.boat) canoe(c, b, t, paint);
  else standing(c, b, t, paint);
  c.restore();
}

/** Head + hair + crown (origin: centre of the face). */
function head(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string, skin: string, moving: boolean) {
  const hair = pickOf(HAIRS, b.id * 7);
  // long hair braided with kelp, streaming back
  c.fillStyle = hair;
  c.beginPath();
  c.ellipse(-0.5, -2, 6.4, 5.4, 0, Math.PI, 0);
  c.fill();
  for (let k = 0; k < 3; k++) {
    const sw = Math.sin(t * 3 + k + b.id) * (moving ? 1.6 : 0.6);
    c.strokeStyle = k === 1 ? "#3d7a4a" : hair;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-4 + k, -1);
    c.quadraticCurveTo(-8 - k + sw, 6, -7 - k + sw * 1.4, 13);
    c.stroke();
  }
  c.fillStyle = SHELL;
  c.beginPath();
  c.arc(-7.5, 8, 1.1, 0, Math.PI * 2);
  c.arc(-5, 11, 0.9, 0, Math.PI * 2);
  c.fill();
  // face, painted with blue swirls
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(1.5, 0.5, 5.6, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(1.5, 0.5, 4.6, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = paint;
  c.lineWidth = 1;
  c.beginPath();
  c.arc(2.6, 2.6, 2.1, Math.PI * 0.1, Math.PI * 1.3);
  c.moveTo(-0.5, -3.5);
  c.quadraticCurveTo(2.5, -5.2, 5.8, -3.2);
  c.stroke();
  c.fillStyle = "#fff8ea";
  c.beginPath();
  c.ellipse(4.3, -1.5, 1.3, 0.85, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1c4a6e";
  c.beginPath();
  c.arc(4.7, -1.5, 0.6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(3, 3);
  c.lineTo(5.4, 2.7);
  c.stroke();
  // a crown: coral sprigs, a starfish, or a ring of shells
  const crown = b.id % 3;
  if (crown === 0) {
    c.strokeStyle = CORAL;
    c.lineWidth = 1.4;
    for (const [x, a] of [[-3, -0.5], [0, 0], [3, 0.4]] as const) {
      c.save();
      c.translate(x, -5.5);
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -6);
      c.moveTo(0, -3);
      c.lineTo(-2, -5);
      c.moveTo(0, -4);
      c.lineTo(2, -6);
      c.stroke();
      c.restore();
    }
  } else if (crown === 1) {
    c.save();
    c.translate(-1, -7);
    c.rotate(t * 0.2);
    c.fillStyle = "#f2a03a";
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 1.6 : 4;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#c66a1f";
    c.beginPath();
    c.arc(0, 0, 0.9, 0, Math.PI * 2);
    c.fill();
    c.restore();
  } else {
    for (let k = 0; k < 4; k++) {
      c.fillStyle = k % 2 ? SHELL_PINK : SHELL;
      c.beginPath();
      c.arc(-4 + k * 2.6, -5.8 - (k === 1 || k === 2 ? 1 : 0), 1.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function standing(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string) {
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(0, 0, 10, 3.4, 0, 0, Math.PI * 2);
  c.fill();
  c.scale(b.dir, 1);
  const H = 34;
  const skin = pickOf(SKINS, b.id);
  const cloth = pickOf(CLOTH, b.id * 3);
  const weed = pickOf(WEED, b.id * 5);
  const moving = Math.hypot(b.vx, b.vy) > 4 || b.state === "dart";
  const sleeping = b.state === "sleep";
  if (sleeping) {
    c.rotate((-Math.PI / 2) * b.dir);
    c.translate(-H * 0.15, -2);
  }
  const run = moving ? Math.sin(b.anim * 2.6) : 0;
  const bob = moving ? Math.abs(Math.sin(b.anim * 2.6)) * 1.3 : 0;
  const hipY = -H * 0.42 - bob;
  const lean = b.state === "fight" || b.state === "dart" ? 0.3 : moving ? 0.18 : 0.04;
  c.lineCap = "round";
  // seaweed cloak streaming behind (drawn first, behind everything)
  c.save();
  c.translate(0, hipY - H * 0.32);
  for (let k = 0; k < 4; k++) {
    const sw = Math.sin(t * 2.5 + k * 0.9 + b.id) * (moving ? 3 : 1.2);
    c.strokeStyle = k % 2 ? weed : shade(weed, -0.15);
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(-3 + k * 1.2, 0);
    c.quadraticCurveTo(-8 - k * 2 + sw, H * 0.3, -6 - k * 2.5 + sw * 1.5, H * 0.62);
    c.stroke();
  }
  c.restore();
  for (const [k, ph] of [[-1, run], [1, -run]] as const) {
    const fx = k * 2.5 + ph * 7;
    c.strokeStyle = INK;
    c.lineWidth = 5.6;
    c.beginPath();
    c.moveTo(k * 2.5, hipY);
    c.lineTo(fx, -1.5);
    c.stroke();
    c.strokeStyle = k < 0 ? shade(skin, -0.16) : skin;
    c.lineWidth = 3.9;
    c.stroke();
    // blue scale paint down the shins
    c.fillStyle = paint;
    for (let s = 0; s < 3; s++) {
      c.beginPath();
      c.arc(k * 2.5 + (fx - k * 2.5) * (0.45 + s * 0.15), hipY * (0.55 - s * 0.15), 1, 0, Math.PI);
      c.fill();
    }
  }
  c.save();
  c.translate(0, hipY);
  c.rotate(lean);
  const torso = H * 0.36;
  const arm = (ang: number, back: boolean) => {
    c.save();
    c.translate(back ? -3.5 : 4, -torso + 2);
    c.rotate(ang);
    c.strokeStyle = INK;
    c.lineWidth = 5.4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, H * 0.34);
    c.stroke();
    c.strokeStyle = back ? shade(skin, -0.2) : skin;
    c.lineWidth = 3.7;
    c.stroke();
    c.strokeStyle = paint;
    c.lineWidth = 1.1;
    c.beginPath();
    for (let k = 0; k <= 6; k++) c.lineTo(Math.sin(k * 1.4) * 1.3, H * 0.05 + k * H * 0.04);
    c.stroke();
    c.restore();
  };
  arm(b.state === "rally" ? -2.6 + Math.sin(b.anim * 3) * 0.3 : run * 0.6 + 0.2, true);
  // chest: blue-painted swirls + scales
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, -torso * 0.5, 8.2, torso * 0.62, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(0, -torso * 0.5, 7, torso * 0.56, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = paint;
  c.lineWidth = 1.3;
  c.beginPath();
  c.arc(-1.5, -torso * 0.55, 3.2, Math.PI * 0.2, Math.PI * 1.8);
  c.stroke();
  c.fillStyle = paint;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.arc(1.8 + (k % 2) * 2, -torso * (0.32 + Math.floor(k / 2) * 0.16), 1.1, 0, Math.PI);
    c.fill();
  }
  // a shell shoulder guard
  c.fillStyle = SHELL_PINK;
  c.strokeStyle = INK;
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-7, -torso * 0.92);
  c.quadraticCurveTo(-3, -torso * 1.25, 2, -torso * 0.95);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = "rgba(160,110,90,0.7)";
  c.lineWidth = 0.6;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(-2.5, -torso * 0.95);
    c.lineTo(-5.5 + k * 3, -torso * 1.12);
    c.stroke();
  }
  // pearl necklace
  for (let k = 0; k < 6; k++) {
    c.fillStyle = PEARL;
    c.beginPath();
    c.arc(-3.6 + k * 1.8, -torso * 0.86 + Math.abs(k - 2.5) * -0.7, 0.95, 0, Math.PI * 2);
    c.fill();
  }
  // skirt of blue fish scales over strands of seaweed
  c.strokeStyle = weed;
  c.lineWidth = 1.4;
  for (let k = 0; k < 6; k++) {
    c.beginPath();
    c.moveTo(-6 + k * 2.4, 2);
    c.lineTo(-6.5 + k * 2.4 + Math.sin(t * 4 + k) * (moving ? 1.2 : 0.4), 9);
    c.stroke();
  }
  c.fillStyle = cloth;
  c.beginPath();
  c.moveTo(-8, -torso * 0.12);
  c.lineTo(8, -torso * 0.12);
  c.lineTo(8.5, 4);
  c.lineTo(-8.5, 4);
  c.closePath();
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.stroke();
  c.fillStyle = shade(cloth, 0.3);
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 6; k++) {
      c.beginPath();
      c.arc(-6.5 + k * 2.6 + (row % 2) * 1.3, -torso * 0.05 + row * 2.4, 1.2, 0, Math.PI);
      c.fill();
    }
  }
  c.save();
  c.translate(1.5, -torso - 6.5);
  head(c, b, t, paint, skin, moving);
  if (sleeping) {
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.font = "bold 7px sans-serif";
    c.fillText("z", 8, -8 - ((t * 6) % 6));
  }
  c.restore();
  const wu = b.state === "fight" ? Math.max(0, Math.min(1, 1 - b.cd / 1.2)) : b.state === "rally" ? 0.7 : 0.2;
  c.save();
  c.translate(4, -torso + 2);
  c.rotate(b.state === "fight" || b.state === "rally" ? -2.5 + (1 - wu) * 2 : -run * 0.6 + 0.3);
  c.strokeStyle = INK;
  c.lineWidth = 5.4;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, H * 0.34);
  c.stroke();
  c.strokeStyle = skin;
  c.lineWidth = 3.7;
  c.stroke();
  c.translate(0, H * 0.34);
  weapon(c, b, t);
  c.restore();
  c.restore();
  if (b.loot || b.forage) {
    c.fillStyle = "#3d6b5a";
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(-7, hipY - 14, 5, 4.4, 0.3, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function weapon(c: CanvasRenderingContext2D, b: Brute, t: number) {
  c.lineCap = "round";
  if (b.weapon === "spear") {
    // a twisted narwhal-white harpoon with a barbed shell head
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.beginPath();
    c.moveTo(0, 12);
    c.lineTo(0, -26);
    c.stroke();
    c.strokeStyle = "#ece6d6";
    c.lineWidth = 1.7;
    c.stroke();
    c.strokeStyle = "rgba(150,140,120,0.8)";
    c.lineWidth = 0.6;
    for (let y = 10; y > -24; y -= 4) {
      c.beginPath();
      c.moveTo(-0.8, y);
      c.lineTo(0.8, y - 2);
      c.stroke();
    }
    c.fillStyle = SHELL;
    c.strokeStyle = INK;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(0, -34);
    c.lineTo(2.6, -26);
    c.lineTo(0.6, -27.5);
    c.lineTo(0.6, -24);
    c.lineTo(-0.6, -24);
    c.lineTo(-0.6, -27.5);
    c.lineTo(-2.6, -26);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = "#3d7a4a";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -22);
    c.quadraticCurveTo(4, -18 + Math.sin(t * 5 + b.id) * 1.5, 3, -12);
    c.stroke();
  } else if (b.weapon === "club") {
    // a conch shell on a driftwood handle
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.beginPath();
    c.moveTo(0, 2);
    c.lineTo(0, -10);
    c.stroke();
    c.strokeStyle = DRIFT;
    c.lineWidth = 2.2;
    c.stroke();
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0, -15, 5.4, 6.6, 0.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = SHELL_PINK;
    c.beginPath();
    c.ellipse(0, -15, 4.4, 5.6, 0.3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(170,110,90,0.8)";
    c.lineWidth = 0.7;
    c.beginPath();
    for (let k = 0; k < 14; k++) {
      const a = k * 0.6;
      const r = 0.4 + k * 0.28;
      c.lineTo(Math.cos(a) * r, -15 + Math.sin(a) * r);
    }
    c.stroke();
  } else if (b.weapon === "bone") {
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(-2, 2);
    c.quadraticCurveTo(-3, -10, 1, -13);
    c.quadraticCurveTo(3, -6, 2, 2);
    c.fill();
    c.fillStyle = "#cfe3ea";
    c.beginPath();
    c.moveTo(-1, 1);
    c.quadraticCurveTo(-2, -9, 0.8, -11.5);
    c.quadraticCurveTo(2, -6, 1, 1);
    c.fill();
  } else {
    const sw = b.state === "fight" ? t * 14 : t * 3;
    c.strokeStyle = "#3d7a4a";
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(sw) * 9, Math.sin(sw) * 9 - 3);
    c.stroke();
    c.fillStyle = PEARL;
    c.beginPath();
    c.arc(Math.cos(sw) * 9, Math.sin(sw) * 9 - 3, 1.8, 0, Math.PI * 2);
    c.fill();
  }
}

/** Waist up, for a canoe or a sea dragon's back (origin: hips). */
function upperBody(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string, arms: "paddle" | "fight" | "reins") {
  const skin = pickOf(SKINS, b.id);
  const weed = pickOf(WEED, b.id * 5);
  const moving = Math.hypot(b.vx, b.vy) > 4;
  // seaweed cloak flying back
  for (let k = 0; k < 3; k++) {
    const sw = Math.sin(t * 3 + k + b.id) * (moving ? 2.6 : 1);
    c.strokeStyle = k % 2 ? weed : shade(weed, -0.15);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-2 + k, -12);
    c.quadraticCurveTo(-9 - k * 2 + sw, -6, -13 - k * 2 + sw * 1.4, 0);
    c.stroke();
  }
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, -7, 6.4, 8, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(0, -7, 5.3, 7, 0, Math.PI, 0);
  c.fill();
  c.strokeStyle = paint;
  c.lineWidth = 1.1;
  c.beginPath();
  c.arc(-1, -8, 2.6, Math.PI * 0.2, Math.PI * 1.8);
  c.stroke();
  for (let k = 0; k < 5; k++) {
    c.fillStyle = PEARL;
    c.beginPath();
    c.arc(-2.8 + k * 1.6, -12.3 + Math.abs(k - 2) * 0.5, 0.8, 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.translate(1, -18);
  c.scale(0.85, 0.85);
  head(c, b, t, paint, skin, moving);
  c.restore();
  c.save();
  c.translate(2, -10);
  if (arms === "fight") {
    c.rotate(-0.4 - Math.max(0, Math.min(1, 1 - b.cd / 1.2)) * 0.8);
    c.strokeStyle = INK;
    c.lineWidth = 4.4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, 9);
    c.stroke();
    c.strokeStyle = skin;
    c.lineWidth = 3;
    c.stroke();
    c.translate(0, 9);
    weapon(c, b, t);
  } else if (arms === "reins") {
    c.rotate(0.9);
    c.strokeStyle = INK;
    c.lineWidth = 4.4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, 9);
    c.stroke();
    c.strokeStyle = skin;
    c.lineWidth = 3;
    c.stroke();
    // kelp reins forward to the dragon's neck
    c.strokeStyle = "#3d7a4a";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, 9);
    c.quadraticCurveTo(4, 16, 2 + Math.sin(t * 3) * 1.5, 22);
    c.stroke();
  } else {
    const stroke = moving ? Math.sin(b.anim * 1.6) : Math.sin(t * 0.8 + b.id) * 0.2;
    c.rotate(0.5 + stroke * 0.5);
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(0, 16);
    c.stroke();
    c.strokeStyle = DRIFT;
    c.lineWidth = 1.4;
    c.stroke();
    c.fillStyle = SHELL;
    c.beginPath();
    c.ellipse(0, 18, 2.8, 5, 0, 0, Math.PI * 2);
    c.fill();
    if (moving && stroke > 0.6) {
      c.fillStyle = "rgba(230,248,255,0.7)";
      c.beginPath();
      c.arc(1, 22, 2, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

/** In the canoe: a driftwood outrigger with a shell prow and a blue crab-claw sail. */
function canoe(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string) {
  const moving = Math.hypot(b.vx, b.vy) > 4;
  const rock = Math.sin(t * 2 + b.id) * 0.04;
  c.strokeStyle = "rgba(220,245,255,0.45)";
  c.lineWidth = 1.2;
  if (moving) {
    c.beginPath();
    c.moveTo(-b.dir * 16, 2);
    c.lineTo(-b.dir * 34, -2);
    c.moveTo(-b.dir * 16, 4);
    c.lineTo(-b.dir * 34, 8);
    c.stroke();
  }
  c.beginPath();
  c.ellipse(0, 2, 22 + Math.sin(t * 3 + b.id) * 2, 5, 0, 0, Math.PI * 2);
  c.stroke();
  c.save();
  c.scale(b.dir, 1);
  c.rotate(rock);
  // outrigger: driftwood booms + float
  c.strokeStyle = DRIFT_DK;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-6, -2);
  c.lineTo(-6, 7);
  c.moveTo(6, -2);
  c.lineTo(6, 7);
  c.stroke();
  c.fillStyle = DRIFT;
  c.beginPath();
  c.ellipse(0, 8, 12, 1.8, 0, 0, Math.PI * 2);
  c.fill();
  // the crab-claw sail (blue, with a painted wave), when they're under way
  if (moving || b.state === "rally") {
    c.strokeStyle = DRIFT_DK;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(6, -4);
    c.lineTo(10, -40);
    c.stroke();
    const fl = Math.sin(t * 2.5 + b.id) * 1.5;
    c.fillStyle = paint;
    c.beginPath();
    c.moveTo(10, -40);
    c.quadraticCurveTo(-6 + fl, -30, -8, -10);
    c.quadraticCurveTo(0, -14, 6, -6);
    c.quadraticCurveTo(3 + fl, -22, 10, -40);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.6)";
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(-3, -16);
    c.quadraticCurveTo(0, -19, 2, -16);
    c.quadraticCurveTo(4, -13, 6, -16);
    c.stroke();
  }
  // hull: pale driftwood, a shell-crusted prow
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(-19, -4);
  c.quadraticCurveTo(0, 6, 19, -4);
  c.lineTo(22, -9);
  c.lineTo(16, -5);
  c.quadraticCurveTo(0, -1, -17, -5);
  c.lineTo(-20, -8);
  c.closePath();
  c.fill();
  c.fillStyle = "#b7a98f";
  c.beginPath();
  c.moveTo(-17.5, -4.5);
  c.quadraticCurveTo(0, 4.2, 17.5, -4.5);
  c.quadraticCurveTo(0, -0.5, -17.5, -4.5);
  c.fill();
  c.strokeStyle = paint;
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-14, -2.4);
  c.quadraticCurveTo(0, 2.6, 14, -2.4);
  c.stroke();
  for (const [x, y] of [[18, -6], [20, -8.5], [16.5, -3.5]]) {
    c.fillStyle = SHELL_PINK;
    c.beginPath();
    c.arc(x, y, 1.3, 0, Math.PI * 2);
    c.fill();
  }
  c.translate(-2, -4);
  upperBody(c, b, t, paint, b.state === "fight" ? "fight" : "paddle");
  if (b.state === "forage" && !moving) {
    c.strokeStyle = "rgba(240,240,230,0.7)";
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(6, -10);
    c.quadraticCurveTo(18, -14, 26, 8 + Math.sin(t * 2) * 1.5);
    c.stroke();
  }
  c.restore();
}

/** Astride a sea dragon (the dragon itself is drawn by the dino renderer; origin: the saddle). */
function rider(c: CanvasRenderingContext2D, b: Brute, t: number, paint: string) {
  c.save();
  c.scale(b.dir, 1);
  const skin = pickOf(SKINS, b.id);
  const cloth = pickOf(CLOTH, b.id * 3);
  // legs either side of the back
  for (const k of [-1, 1]) {
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, -2);
    c.quadraticCurveTo(k * 5 + 3, 4, 4, 9);
    c.stroke();
    c.strokeStyle = k < 0 ? shade(skin, -0.18) : skin;
    c.lineWidth = 3.4;
    c.stroke();
  }
  // a saddle-cloth of woven blue + seaweed fringe
  c.fillStyle = cloth;
  c.beginPath();
  c.ellipse(-1, 0, 9, 3.4, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#3d7a4a";
  c.lineWidth = 1.1;
  for (let k = 0; k < 5; k++) {
    c.beginPath();
    c.moveTo(-8 + k * 3.5, 2);
    c.lineTo(-8.5 + k * 3.5 + Math.sin(t * 4 + k) * 0.8, 7);
    c.stroke();
  }
  c.translate(0, -1);
  upperBody(c, b, t, paint, b.state === "fight" ? "fight" : "reins");
  c.restore();
}

/* ------------------------------ villages ------------------------------ */

/** Driftwood boardwalks between the houses (world coords; under everything else in the village). */
export function drawSeaWalks(c: CanvasRenderingContext2D, tr: SeaTribe, t: number) {
  const huts = tr.huts.filter((h) => !isFarm(h));
  const heart = huts[0] ?? { x: tr.x, y: tr.y, kind: "longhouse", hp: 1 };
  const ring = huts.slice(1).map((h) => ({ h, a: Math.atan2(h.y - tr.y, h.x - tr.x) })).sort((a, b) => a.a - b.a);
  for (const { h } of ring) if (Math.hypot(h.x - heart.x, h.y - heart.y) < 150) boardwalk(c, heart, h, t);
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k].h;
    const b = ring[(k + 1) % ring.length].h;
    if (ring.length > 2 && Math.hypot(a.x - b.x, a.y - b.y) < 120) boardwalk(c, a, b, t);
  }
}

const isFarm = (h: SeaHut) => h.kind === "pearlBed" || h.kind === "fishPen" || h.kind === "sharkPen";

/** One house / farm (world coords). */
export function drawSeaHut(c: CanvasRenderingContext2D, h: SeaHut, tr: SeaTribe, t: number, night: boolean) {
  c.save();
  c.translate(h.x, h.y);
  drawHut(c, h, tr, t, night);
  c.restore();
}

function boardwalk(c: CanvasRenderingContext2D, a: SeaHut, b: SeaHut, t: number) {
  const whole = a.hp > 0 && b.hp > 0;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.floor(len / 7);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  c.strokeStyle = DRIFT_DK;
  c.lineWidth = 1.8;
  for (let i = 1; i < n; i += 3) {
    const x = a.x + ((b.x - a.x) * i) / n;
    const y = a.y + ((b.y - a.y) * i) / n - 6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.sin(i) * 1.2, y + 9);
    c.stroke();
  }
  for (let i = 1; i < n; i++) {
    if (!whole && i > n * 0.35 && i < n * 0.65) continue;
    const x = a.x + ((b.x - a.x) * i) / n;
    const y = a.y + ((b.y - a.y) * i) / n - 7 + Math.sin(t * 1.5 + i) * 0.3;
    c.strokeStyle = i % 3 === 0 ? DRIFT_DK : i % 2 ? DRIFT : "#d6cdbd";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(x - nx * 4 + Math.sin(i * 2.3) * 0.6, y - ny * 2.5);
    c.lineTo(x + nx * 4, y + ny * 2.5);
    c.stroke();
  }
}

/** Crooked, bleached driftwood stilts into the water. */
function stilts(c: CanvasRenderingContext2D, w: number, t: number) {
  c.lineCap = "round";
  const xs = [-w * 0.75, -w * 0.25, w * 0.25, w * 0.75];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.beginPath();
    c.moveTo(x, -10);
    c.quadraticCurveTo(x + (i % 2 ? 2 : -2), -3, x + 0.5, 4);
    c.stroke();
    c.strokeStyle = DRIFT;
    c.lineWidth = 2;
    c.stroke();
  }
  c.strokeStyle = "rgba(225,245,255,0.35)";
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(0, 4, w + 4 + Math.sin(t * 2) * 1.5, 3.4, 0, 0, Math.PI * 2);
  c.stroke();
}

function deck(c: CanvasRenderingContext2D, w: number, hp: number) {
  const gone = hp < 1 ? Math.floor((1 - hp) * 5) : 0;
  c.fillStyle = INK;
  c.fillRect(-w - 1.5, -14, w * 2 + 3, 6);
  for (let k = 0; k < 6; k++) {
    if (k < gone && k % 2 === 0) continue;
    c.fillStyle = k % 3 === 0 ? DRIFT_DK : k % 2 ? DRIFT : "#d6cdbd";
    c.fillRect(-w + (k * (w * 2)) / 6, -13.5 + (k % 2) * 0.5, (w * 2) / 6 - 0.8, 5);
  }
}

/** A giant scallop shell as a roof: a fan of ribs, cream + pink. */
function scallopRoof(c: CanvasRenderingContext2D, w: number, y: number, color: string) {
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(-w - 3, y);
  c.arc(0, y, w + 3, Math.PI, 0);
  c.closePath();
  c.fill();
  const ribs = 9;
  for (let k = 0; k < ribs; k++) {
    const a0 = Math.PI + (k / ribs) * Math.PI;
    const a1 = Math.PI + ((k + 1) / ribs) * Math.PI;
    c.fillStyle = k % 2 ? SHELL : SHELL_PINK;
    c.beginPath();
    c.moveTo(0, y);
    c.arc(0, y, w + 1.5, a0, a1);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = "rgba(170,110,90,0.55)";
  c.lineWidth = 0.6;
  for (let r = 4; r < w; r += 4) {
    c.beginPath();
    c.arc(0, y, r, Math.PI, 0);
    c.stroke();
  }
  // the hinge, painted in the village colour
  c.fillStyle = color;
  c.fillRect(-4, y - 2, 8, 3);
}

/** A house inside a huge conch shell lying on its side; the door is the shell's mouth. */
function conchHouse(c: CanvasRenderingContext2D, w: number, night: boolean, color: string) {
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, -24, w + 2, 13, -0.15, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#f1dcc0";
  c.beginPath();
  c.ellipse(0, -24, w, 11.5, -0.15, 0, Math.PI * 2);
  c.fill();
  // the spire, stepping off to one side
  for (let k = 0; k < 4; k++) {
    c.fillStyle = k % 2 ? "#e9cba6" : "#f4e2c8";
    c.beginPath();
    c.ellipse(w * 0.7 + k * 3.5, -26 - k * 2, 6 - k * 1.2, 5 - k, -0.4, 0, Math.PI * 2);
    c.fill();
  }
  // knobs + stripes
  c.fillStyle = "#e0b48c";
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.arc(-w * 0.5 + k * (w * 0.4), -34 + Math.abs(k - 1.5), 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "rgba(190,130,90,0.6)";
  c.lineWidth = 0.8;
  for (let k = -2; k <= 2; k++) {
    c.beginPath();
    c.ellipse(0, -24, w * 0.85 - Math.abs(k) * 2, 9, -0.15, Math.PI * 1.1 + k * 0.1, Math.PI * 1.6 + k * 0.1);
    c.stroke();
  }
  // the pink mouth = the doorway (lit at night)
  c.fillStyle = SHELL_PINK;
  c.beginPath();
  c.ellipse(-w * 0.55, -20, 6, 8, 0.3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = night ? "#f6b060" : "#5a2f2a";
  c.beginPath();
  c.ellipse(-w * 0.55, -19, 3.4, 5.4, 0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-w * 0.2, -31);
  c.quadraticCurveTo(0, -34, w * 0.3, -31);
  c.stroke();
}

/** Pearl strings swagged under the eaves. */
function pearls(c: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  c.strokeStyle = "rgba(220,220,210,0.6)";
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(x0, y);
  c.quadraticCurveTo((x0 + x1) / 2, y + 5, x1, y);
  c.stroke();
  for (let k = 0; k <= 6; k++) {
    const u = k / 6;
    const x = x0 + (x1 - x0) * u;
    const yy = y + Math.sin(u * Math.PI) * 4;
    c.fillStyle = PEARL;
    c.beginPath();
    c.arc(x, yy, 1, 0, Math.PI * 2);
    c.fill();
  }
}

function drawHut(c: CanvasRenderingContext2D, h: SeaHut, tr: SeaTribe, t: number, night: boolean) {
  if (h.hp <= 0) {
    // broken driftwood poking out of the water, a cracked shell adrift
    c.strokeStyle = DRIFT_DK;
    c.lineWidth = 2;
    for (const x of [-10, -2, 8]) {
      c.beginPath();
      c.moveTo(x, 4);
      c.lineTo(x + 1, -5 - (x % 3) * 2);
      c.stroke();
    }
    c.fillStyle = SHELL_PINK;
    c.beginPath();
    c.arc(10, 3 + Math.sin(t * 1.2 + h.x) * 1, 5, Math.PI, 0);
    c.fill();
    return;
  }
  const colors = tr.colors?.length ? tr.colors : [tr.color];
  switch (h.kind) {
    case "longhouse": {
      // a giant nautilus shell house on a driftwood deck, coral door-posts, pearls under the eaves
      const w = 28;
      stilts(c, w, t);
      deck(c, w, h.hp);
      c.fillStyle = INK;
      c.beginPath();
      c.arc(2, -36, 24, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#f5e6cf";
      c.beginPath();
      c.arc(2, -36, 22.5, 0, Math.PI * 2);
      c.fill();
      // the chambered spiral with tiger stripes
      c.strokeStyle = "#c97a46";
      c.lineWidth = 2.6;
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI * 0.9 + k * 0.42;
        c.beginPath();
        c.moveTo(2 + Math.cos(a) * 21, -36 + Math.sin(a) * 21);
        c.quadraticCurveTo(2 + Math.cos(a + 0.3) * 14, -36 + Math.sin(a + 0.3) * 14, 2 + Math.cos(a + 0.2) * 9, -36 + Math.sin(a + 0.2) * 9);
        c.stroke();
      }
      c.strokeStyle = "rgba(150,100,70,0.6)";
      c.lineWidth = 1;
      c.beginPath();
      for (let k = 0; k < 40; k++) {
        const a = k * 0.32;
        const r = 2 + k * 0.48;
        c.lineTo(8 + Math.cos(a) * r * 0.9, -40 + Math.sin(a) * r * 0.9);
      }
      c.stroke();
      // mouth/door
      c.fillStyle = SHELL_PINK;
      c.beginPath();
      c.ellipse(-12, -24, 9, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = night ? "#f6b060" : "#4a2a28";
      c.beginPath();
      c.ellipse(-12, -22, 5.4, 7.4, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = CORAL;
      c.lineWidth = 2;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(-12 + s * 9, -14);
        c.lineTo(-12 + s * 10, -28);
        c.moveTo(-12 + s * 10, -22);
        c.lineTo(-12 + s * 13, -27);
        c.stroke();
      }
      pearls(c, -24, 26, -14);
      // a banner streamer for every village in the union
      colors.forEach((col, i) => {
        const fl = Math.sin(t * 3 + i) * 2;
        c.strokeStyle = DRIFT_DK;
        c.lineWidth = 1.3;
        c.beginPath();
        c.moveTo(20 + i * 5, -50);
        c.lineTo(20 + i * 5, -66);
        c.stroke();
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(20 + i * 5, -66);
        c.quadraticCurveTo(26 + i * 5, -64 + fl, 30 + i * 5, -61 + fl);
        c.lineTo(20 + i * 5, -58);
        c.closePath();
        c.fill();
      });
      break;
    }
    case "hut": {
      const w = 16;
      stilts(c, w, t);
      deck(c, w, h.hp);
      if ((h.x + h.y) % 2 === 0) conchHouse(c, w, night, tr.color);
      else {
        // woven driftwood walls under a scallop-shell roof
        c.fillStyle = INK;
        c.fillRect(-w * 0.8 - 1, -30, w * 1.6 + 2, 17);
        for (let k = 0; k < 6; k++) {
          c.fillStyle = k % 2 ? DRIFT : "#d6cdbd";
          c.fillRect(-w * 0.8 + k * ((w * 1.6) / 6), -29, (w * 1.6) / 6 - 0.6, 15);
        }
        c.fillStyle = night ? "#f6b060" : "#2a2a2e";
        c.fillRect(-3, -25, 6, 11);
        scallopRoof(c, w, -29, tr.color);
        pearls(c, -w * 0.8, w * 0.8, -29);
      }
      break;
    }
    case "dock": {
      // a driftwood jetty, canoes tied up with their shell prows
      c.strokeStyle = DRIFT_DK;
      c.lineWidth = 2;
      for (const x of [-18, -6, 6, 18]) {
        c.beginPath();
        c.moveTo(x, -6);
        c.lineTo(x + 0.5, 5);
        c.stroke();
      }
      for (let k = 0; k < 6; k++) {
        c.fillStyle = k % 2 ? DRIFT : "#d6cdbd";
        c.fillRect(-22 + k * 7.3, -8, 6.8, 4);
      }
      for (const [x, y] of [[-8, 9], [10, 13]] as const) {
        const bob = Math.sin(t * 1.6 + x) * 0.8;
        c.fillStyle = INK;
        c.beginPath();
        c.moveTo(x - 15, y - 3 + bob);
        c.quadraticCurveTo(x, y + 4 + bob, x + 15, y - 3 + bob);
        c.lineTo(x + 17, y - 6 + bob);
        c.quadraticCurveTo(x, y - 1 + bob, x - 17, y - 6 + bob);
        c.fill();
        c.fillStyle = "#b7a98f";
        c.beginPath();
        c.moveTo(x - 13, y - 4 + bob);
        c.quadraticCurveTo(x, y + 2.5 + bob, x + 13, y - 4 + bob);
        c.quadraticCurveTo(x, y - 1.5 + bob, x - 13, y - 4 + bob);
        c.fill();
        c.strokeStyle = tr.color;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x - 10, y - 3 + bob);
        c.quadraticCurveTo(x, y + 1 + bob, x + 10, y - 3 + bob);
        c.stroke();
        c.fillStyle = SHELL_PINK;
        c.beginPath();
        c.arc(x + 15, y - 5 + bob, 1.5, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "rack": {
      // kelp + fish hung to dry on a driftwood frame
      const w = 16;
      stilts(c, w, t);
      deck(c, w, h.hp);
      c.strokeStyle = DRIFT_DK;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(-12, -14);
      c.lineTo(-12, -32);
      c.moveTo(12, -14);
      c.lineTo(12, -32);
      c.moveTo(-14, -31);
      c.lineTo(14, -31);
      c.stroke();
      for (let k = 0; k < 6; k++) {
        const x = -10 + k * 4;
        const sw = Math.sin(t * 1.5 + k) * 0.8;
        if (k % 2) {
          c.fillStyle = k % 4 === 1 ? "#9fb7c2" : "#c9b38a";
          c.beginPath();
          c.ellipse(x + sw, -24, 1.6, 4.5, 0, 0, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.moveTo(x + sw, -19);
          c.lineTo(x + sw - 1.8, -16.5);
          c.lineTo(x + sw + 1.8, -16.5);
          c.fill();
        } else {
          c.strokeStyle = "#3d6b3a";
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x, -31);
          c.quadraticCurveTo(x + 2 + sw, -24, x + sw, -16);
          c.stroke();
        }
      }
      break;
    }
    case "lookout": {
      // a driftwood mast with a clam-shell crow's nest, a starfish on top, a blue pennant
      c.strokeStyle = INK;
      c.lineWidth = 3.4;
      c.beginPath();
      c.moveTo(0, 4);
      c.quadraticCurveTo(-3, -24, 0, -52);
      c.stroke();
      c.strokeStyle = DRIFT;
      c.lineWidth = 2;
      c.stroke();
      c.strokeStyle = DRIFT_DK;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-8, 4);
      c.lineTo(-1, -30);
      c.moveTo(8, 4);
      c.lineTo(1, -30);
      c.stroke();
      // the crow's nest: half a giant clam
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(-12, -46);
      c.quadraticCurveTo(0, -34, 12, -46);
      c.closePath();
      c.fill();
      c.fillStyle = SHELL;
      c.beginPath();
      c.moveTo(-11, -46);
      c.quadraticCurveTo(0, -36, 11, -46);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(170,110,90,0.6)";
      c.lineWidth = 0.6;
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.moveTo(k * 4, -46);
        c.lineTo(k * 1.5, -39);
        c.stroke();
      }
      c.save();
      c.translate(0, -56);
      c.rotate(t * 0.3);
      c.fillStyle = "#f2a03a";
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 2 : 5;
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.restore();
      const fl = Math.sin(t * 3 + h.x) * 2;
      c.fillStyle = colors[0];
      c.beginPath();
      c.moveTo(0, -50);
      c.quadraticCurveTo(-8, -48 + fl, -14, -45 + fl);
      c.lineTo(0, -44);
      c.closePath();
      c.fill();
      break;
    }
    case "shrine": {
      // a giant open clam on a coral heap, a glowing pearl inside
      const w = 16;
      stilts(c, w, t);
      deck(c, w, h.hp);
      c.fillStyle = CORAL;
      for (const [x, y, s] of [[-12, -16, 4], [11, -16, 3.5], [-7, -18, 3]] as const) {
        c.beginPath();
        c.arc(x, y, s, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, -20, 14, 6, 0, 0, Math.PI);
      c.fill();
      c.fillStyle = "#cfc6e8";
      c.beginPath();
      c.ellipse(0, -20, 12.5, 4.8, 0, 0, Math.PI);
      c.fill();
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(-14, -20);
      c.quadraticCurveTo(-12, -40, 0, -42);
      c.quadraticCurveTo(12, -40, 14, -20);
      c.closePath();
      c.fill();
      c.fillStyle = "#b8a9d8";
      c.beginPath();
      c.moveTo(-12.5, -21);
      c.quadraticCurveTo(-11, -38.5, 0, -40.5);
      c.quadraticCurveTo(11, -38.5, 12.5, -21);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.4)";
      c.lineWidth = 0.7;
      for (let k = -3; k <= 3; k++) {
        c.beginPath();
        c.moveTo(k * 3.4, -22);
        c.lineTo(k * 1.2, -39);
        c.stroke();
      }
      const glow = 0.7 + Math.sin(t * 2) * 0.3;
      c.fillStyle = `rgba(200,245,255,${0.25 * glow})`;
      c.beginPath();
      c.arc(0, -23, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = PEARL;
      c.beginPath();
      c.arc(0, -23, 3.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(-1, -24.2, 1, 0, Math.PI * 2);
      c.fill();
      if (night) drawFlame(c, 10, -15, 0.3, t);
      break;
    }
    case "pearlBed": {
      // oyster beds under the water, ringed with shell floats on kelp ropes; a pearl glints now and then
      c.strokeStyle = "rgba(60,110,70,0.8)";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, 0, 30, 16, 0, 0, Math.PI * 2);
      c.stroke();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const bob = Math.sin(t * 1.8 + k) * 0.8;
        c.fillStyle = k % 2 ? SHELL : SHELL_PINK;
        c.beginPath();
        c.ellipse(Math.cos(a) * 30, Math.sin(a) * 16 + bob, 2.6, 1.8, 0, 0, Math.PI * 2);
        c.fill();
      }
      for (let k = 0; k < 8; k++) {
        const x = Math.cos(k * 2.4) * 18 * ((k % 3) / 3 + 0.4);
        const y = Math.sin(k * 2.4) * 9 * ((k % 3) / 3 + 0.4);
        c.fillStyle = "rgba(70,80,90,0.55)";
        c.beginPath();
        c.ellipse(x, y, 4, 2.4, k, 0, Math.PI * 2);
        c.fill();
      }
      const g = (t * 0.7 + h.x * 0.01) % 2.5;
      if (g < 0.5) {
        c.fillStyle = `rgba(255,255,255,${1 - g * 2})`;
        c.beginPath();
        c.arc(Math.cos(h.x) * 10, Math.sin(h.y) * 5, 1.6 + g * 3, 0, Math.PI * 2);
        c.fill();
      }
      // a little driftwood marker with a pearl on top
      c.strokeStyle = DRIFT_DK;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(24, 0);
      c.lineTo(24, -18);
      c.stroke();
      c.fillStyle = PEARL;
      c.beginPath();
      c.arc(24, -19.5, 2, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "fishPen": {
      // a ring of driftwood stakes woven with kelp; a shoal circling inside
      const back = (front: boolean) => {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          if ((Math.sin(a) > 0) !== front) continue;
          const x = Math.cos(a) * 30;
          const y = Math.sin(a) * 15;
          c.strokeStyle = DRIFT_DK;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x, y + 3);
          c.lineTo(x, y - 9);
          c.stroke();
        }
        c.strokeStyle = "rgba(61,107,58,0.85)";
        c.lineWidth = 1.6;
        c.beginPath();
        c.ellipse(0, -4, 30, 15, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        c.stroke();
      };
      back(false);
      for (let k = 0; k < 6; k++) {
        const a = t * 0.9 + (k / 6) * Math.PI * 2;
        const x = Math.cos(a) * 18;
        const y = Math.sin(a) * 8;
        c.save();
        c.translate(x, y);
        c.rotate(a + Math.PI / 2);
        c.fillStyle = "rgba(160,190,205,0.75)";
        c.beginPath();
        c.ellipse(0, 0, 4, 1.6, 0, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(-4, 0);
        c.lineTo(-6.5, -1.6);
        c.lineTo(-6.5, 1.6);
        c.fill();
        c.restore();
      }
      back(true);
      break;
    }
    case "sharkPen": {
      // tall driftwood stakes in a big ring; shark fins circling (fed + farmed for meat + teeth)
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        const x = Math.cos(a) * 38;
        const y = Math.sin(a) * 18;
        c.strokeStyle = INK;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x, y + 3);
        c.lineTo(x, y - 14);
        c.stroke();
        c.strokeStyle = DRIFT;
        c.lineWidth = 1.8;
        c.stroke();
        c.fillStyle = "#e9e1d0";
        c.beginPath();
        c.arc(x, y - 14, 1, 0, Math.PI * 2);
        c.fill();
      }
      for (let k = 0; k < 2; k++) {
        const a = -t * 0.7 + k * Math.PI;
        const x = Math.cos(a) * 22;
        const y = Math.sin(a) * 9;
        const dir = Math.sin(a) > 0 ? -1 : 1;
        c.strokeStyle = "rgba(225,245,255,0.6)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x - dir * 4, y + 1);
        c.lineTo(x - dir * 14, y + 3);
        c.stroke();
        c.fillStyle = "#5d6f7d";
        c.beginPath();
        c.moveTo(x - dir * 4, y);
        c.quadraticCurveTo(x - dir * 1, y - 11, x + dir * 4, y - 12);
        c.quadraticCurveTo(x + dir * 2, y - 5, x + dir * 4, y);
        c.closePath();
        c.fill();
      }
      // a warning skull of a shark jaw on a stake, painted blue
      c.strokeStyle = colors[0];
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(0, -22, 5, 0, Math.PI);
      c.stroke();
      c.fillStyle = "#fff";
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.moveTo(k * 2, -21);
        c.lineTo(k * 2 + 0.8, -18.5);
        c.lineTo(k * 2 + 1.6, -21);
        c.fill();
      }
      break;
    }
  }
}

/* ------------------------------ shore markers ------------------------------ */

export function drawSeaSign(c: CanvasRenderingContext2D, s: SeaSign, color: string, t: number) {
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  c.lineCap = "round";
  switch (s.kind) {
    case "shellTotem": {
      // a crooked driftwood post crusted with shells + pearls, a painted wave, kelp streamers
      c.fillStyle = INK;
      c.fillRect(-5, -40, 10, 40);
      c.fillStyle = DRIFT;
      c.fillRect(-4, -39, 8, 38);
      c.strokeStyle = color;
      c.lineWidth = 1.6;
      c.beginPath();
      for (let k = 0; k <= 8; k++) c.lineTo(-4 + k, -22 + Math.sin(k * 1.4) * 1.6);
      c.stroke();
      for (const [x, y, p] of [[-2, -34, 0], [2, -30, 1], [-1, -12, 0], [2, -8, 2], [0, -38, 1]] as const) {
        c.fillStyle = p === 2 ? PEARL : p ? SHELL_PINK : SHELL;
        c.beginPath();
        c.arc(x, y, 1.7, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = "#3d6b3a";
      c.lineWidth = 1.4;
      for (let k = -1; k <= 1; k++) {
        c.beginPath();
        c.moveTo(k * 3, -40);
        c.quadraticCurveTo(k * 6 + Math.sin(t * 2 + k) * 1.5, -46, k * 4, -52);
        c.stroke();
      }
      break;
    }
    case "fishSkull": {
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -36);
      c.stroke();
      c.strokeStyle = DRIFT;
      c.lineWidth = 1.8;
      c.stroke();
      c.fillStyle = SHELL;
      c.strokeStyle = INK;
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(-14, -42);
      c.quadraticCurveTo(-4, -54, 12, -46);
      c.lineTo(16, -40);
      c.lineTo(12, -37);
      c.quadraticCurveTo(-2, -34, -14, -42);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = INK;
      c.beginPath();
      c.arc(4, -45, 2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.moveTo(6 + k * 2.2, -40);
        c.lineTo(7 + k * 2.2, -37.5);
        c.lineTo(8 + k * 2.2, -40);
        c.fill();
      }
      c.strokeStyle = color;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-8, -44);
      c.lineTo(-2, -47);
      c.stroke();
      break;
    }
    case "netPole": {
      c.strokeStyle = DRIFT_DK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-12, 0);
      c.lineTo(-12, -30);
      c.moveTo(12, 0);
      c.lineTo(12, -30);
      c.stroke();
      c.strokeStyle = "rgba(225,215,185,0.8)";
      c.lineWidth = 0.6;
      for (let k = 0; k <= 6; k++) {
        c.beginPath();
        c.moveTo(-12 + k * 4, -29);
        c.quadraticCurveTo(-12 + k * 4 + Math.sin(t * 1.5) * 1, -18, -12 + k * 4, -8);
        c.stroke();
      }
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.moveTo(-12, -27 + k * 6);
        c.quadraticCurveTo(0, -24 + k * 6, 12, -27 + k * 6);
        c.stroke();
      }
      c.fillStyle = color;
      for (const x of [-6, 2, 8]) {
        c.beginPath();
        c.arc(x, -28, 1.8, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#f2a03a";
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 1.2 : 3;
        const a = (k / 10) * Math.PI * 2;
        c.lineTo(-2 + Math.cos(a) * r, -16 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      break;
    }
    default: {
      // a war canoe drawn up on the sand, crab-claw sail furled, paddles crossed
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(-22, -6);
      c.quadraticCurveTo(0, 6, 22, -6);
      c.lineTo(25, -12);
      c.lineTo(18, -8);
      c.quadraticCurveTo(0, -3, -19, -8);
      c.lineTo(-24, -11);
      c.closePath();
      c.fill();
      c.fillStyle = "#b7a98f";
      c.beginPath();
      c.moveTo(-20, -6.5);
      c.quadraticCurveTo(0, 4, 20, -6.5);
      c.quadraticCurveTo(0, -2, -20, -6.5);
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-16, -4.5);
      c.quadraticCurveTo(0, 1.5, 16, -4.5);
      c.stroke();
      c.strokeStyle = DRIFT_DK;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-6, 0);
      c.lineTo(6, -22);
      c.moveTo(6, 0);
      c.lineTo(-6, -22);
      c.stroke();
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(0, -8, 10, 2.2, -0.2, 0, Math.PI * 2);
      c.fill();
    }
  }
}
