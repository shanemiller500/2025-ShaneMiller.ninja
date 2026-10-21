/* ------------------------------------------------------------------ */
/*  A war chariot: a long timber fighting wagon on four big log        */
/*  wheels, hide-and-bone shield walls down each side (five spear      */
/*  slits a side, the tribe's blue + gold), a huge Triceratops skull   */
/*  on the prow, a Scorpion on a post at the front and another at the  */
/*  back (each aiming at its own target), a banner at the stern, and   */
/*  harness poles out to the Triceratops pulling it. Battered, it      */
/*  shows cracks; nearly smashed, it smokes. Origin: ground centre.    */
/* ------------------------------------------------------------------ */
import type { Chariot } from "../sim/types";

const INK = "#24170e";
const WOOD = "#7a5530";
const WOOD_D = "#5a3d22";
const HIDE = "#a8835a";
const BONE = "#e9e0c8";
const BLUE = "#3a6fb0";
const GOLD = "#e0b43a";

function wheel(c: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  c.fillStyle = WOOD_D;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = BONE;
  c.lineWidth = 2;
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * Math.PI) / 3;
    c.moveTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
    c.lineTo(x - Math.cos(a) * r * 0.85, y - Math.sin(a) * r * 0.85);
  }
  c.stroke();
  c.fillStyle = BONE;
  c.beginPath();
  c.arc(x, y, r * 0.22, 0, Math.PI * 2);
  c.fill();
}

/** A small Scorpion on a post: base, bow arms and a bolt along its aim (local angle). */
function scorpion(c: CanvasRenderingContext2D, x: number, y: number, a: number, loaded: boolean) {
  c.strokeStyle = WOOD_D;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(x, y + 14);
  c.lineTo(x, y);
  c.stroke();
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.strokeStyle = "#6b4a2a";
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-10, 0);
  c.lineTo(14, 0);
  c.stroke();
  c.strokeStyle = "#7a4f2a";
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(8, -12);
  c.quadraticCurveTo(12, 0, 8, 12);
  c.stroke();
  c.strokeStyle = "rgba(240,235,220,0.9)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(8, -12);
  c.lineTo(loaded ? -4 : 4, 0);
  c.lineTo(8, 12);
  c.stroke();
  if (loaded) {
    c.strokeStyle = "#3d2b1c";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-4, 0);
    c.lineTo(20, 0);
    c.stroke();
    c.fillStyle = "#9aa3ad";
    c.beginPath();
    c.moveTo(20, -3);
    c.lineTo(25, 0);
    c.lineTo(20, 3);
    c.fill();
  }
  c.restore();
}

/** The great trike skull on the prow: frill, three horns, a dark eye socket, the beak. */
function skull(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = BONE;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  // frill
  c.beginPath();
  c.ellipse(x - 2, y - 6, 15, 20, -0.3, -Math.PI * 0.95, Math.PI * 0.45);
  c.closePath();
  c.fill();
  c.stroke();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.95 + i * 0.42;
    c.beginPath();
    c.arc(x - 2 + Math.cos(a) * 15, y - 6 + Math.sin(a) * 20, 2.6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  // face
  c.beginPath();
  c.moveTo(x + 2, y - 10);
  c.quadraticCurveTo(x + 18, y - 12, x + 24, y);
  c.lineTo(x + 14, y + 6);
  c.lineTo(x + 2, y + 4);
  c.closePath();
  c.fill();
  c.stroke();
  // horns: two long brow horns, one on the nose
  c.fillStyle = "#f4ead2";
  for (const [hx, hy, len] of [[x + 8, y - 12, 26], [x + 12, y - 9, 22], [x + 20, y - 3, 10]] as const) {
    c.beginPath();
    c.moveTo(hx - 2.5, hy);
    c.quadraticCurveTo(hx + len * 0.6, hy - len * 0.35, hx + len, hy - len * 0.2);
    c.lineTo(hx + 2.5, hy + 2);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(x + 9, y - 3, 3, 2.4, 0, 0, Math.PI * 2);
  c.fill();
}

export function drawChariot(c: CanvasRenderingContext2D, ch: Chariot, t: number) {
  const k = ch.hp / ch.maxHp;
  const bob = Math.abs(Math.sin(ch.anim * 1.2)) * 1.2;
  c.save();
  // shadow
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(0, 3, 74, 13, 0, 0, Math.PI * 2);
  c.fill();
  c.scale(ch.dir, 1);
  if (ch.hit > 0) c.filter = `brightness(${1 + ch.hit * 0.6})`;
  const spin = ch.anim * 1.6;
  // far wheels
  wheel(c, -40, -12, 15, spin);
  wheel(c, 38, -12, 15, spin);
  c.translate(0, -bob);
  // harness poles out to the Triceratops
  c.strokeStyle = WOOD_D;
  c.lineWidth = 3.5;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(56, -20);
  c.lineTo(100, -22);
  c.moveTo(56, -26);
  c.lineTo(100, -30);
  c.stroke();
  // the hull
  c.fillStyle = WOOD;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-64, -34);
  c.lineTo(60, -34);
  c.lineTo(66, -22);
  c.lineTo(58, -12);
  c.lineTo(-60, -12);
  c.lineTo(-66, -24);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = WOOD_D;
  c.lineWidth = 1.2;
  for (const y of [-27, -19]) {
    c.beginPath();
    c.moveTo(-62, y);
    c.lineTo(60, y);
    c.stroke();
  }
  // Scorpions on posts, front + back (aim is in world terms: flip it when facing left)
  const local = (a: number) => (ch.dir === 1 ? a : Math.PI - a);
  scorpion(c, -32, -60, local(ch.aim[1]), ch.cd[1] < 0.8);
  scorpion(c, 30, -60, local(ch.aim[0]), ch.cd[0] < 0.8);
  // the near shield wall: hide on a bone frame, five spear slits, blue + gold
  c.fillStyle = HIDE;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-58, -34);
  c.lineTo(-58, -50);
  for (let i = 0; i <= 10; i++) c.lineTo(-58 + i * 11.4, -50 - (i % 2 ? 3 : 0));
  c.lineTo(56, -34);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = BLUE;
  c.fillRect(-56, -44, 110, 3.4);
  c.fillStyle = GOLD;
  c.fillRect(-56, -40.6, 110, 2.2);
  // spear slits (spears poking out of the ones in use)
  for (let i = 0; i < 5; i++) {
    const x = -42 + i * 21;
    c.fillStyle = "#2a1c12";
    c.fillRect(x - 2.5, -49, 5, 7);
    c.strokeStyle = "#5e3f24";
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(x, -46);
    c.lineTo(x + 7, -54 - (i % 2) * 2);
    c.stroke();
    c.fillStyle = "#b9b4aa";
    c.beginPath();
    c.moveTo(x + 7, -54 - (i % 2) * 2);
    c.lineTo(x + 11, -58 - (i % 2) * 2);
    c.lineTo(x + 6, -56 - (i % 2) * 2);
    c.fill();
  }
  // bone ribs over the hide
  c.strokeStyle = BONE;
  c.lineWidth = 2.2;
  for (const x of [-58, -30, 0, 28, 56]) {
    c.beginPath();
    c.moveTo(x, -34);
    c.lineTo(x, -51);
    c.stroke();
  }
  // a banner at the stern
  c.strokeStyle = WOOD_D;
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(-62, -34);
  c.lineTo(-62, -82);
  c.stroke();
  const flap = Math.sin(t * 5 + ch.id) * 3;
  c.fillStyle = BLUE;
  c.beginPath();
  c.moveTo(-62, -82);
  c.lineTo(-84, -78 + flap);
  c.lineTo(-62, -70);
  c.closePath();
  c.fill();
  c.fillStyle = GOLD;
  c.beginPath();
  c.arc(-70, -77 + flap * 0.5, 2.6, 0, Math.PI * 2);
  c.fill();
  // the great trike skull on the prow
  skull(c, 64, -30);
  // battle damage
  if (k < 0.6) {
    c.strokeStyle = "rgba(30,15,8,0.8)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-20, -48);
    c.lineTo(-14, -40);
    c.lineTo(-18, -34);
    c.moveTo(22, -50);
    c.lineTo(28, -42);
    c.stroke();
  }
  if (k < 0.3) {
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.6 + i / 3) % 1;
      c.fillStyle = `rgba(70,60,55,${0.4 * (1 - f)})`;
      c.beginPath();
      c.arc(-10 + i * 14 + Math.sin(f * 6) * 4, -56 - f * 40, 5 + f * 9, 0, Math.PI * 2);
      c.fill();
    }
  }
  // near wheels
  c.filter = "none";
  wheel(c, -46, -8, 16, spin + 0.3);
  wheel(c, 44, -8, 16, spin + 0.3);
  c.restore();
  // health bar
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.fillRect(-26, -96, 52, 5);
  c.fillStyle = k > 0.5 ? "#7ed37e" : k > 0.25 ? "#e0b040" : "#e05040";
  c.fillRect(-26, -96, 52 * Math.max(0, k), 5);
}
