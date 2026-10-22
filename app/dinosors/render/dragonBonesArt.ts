/* ------------------------------------------------------------------ */
/*  The dragon bones monument: a stone plinth with the dragon's name   */
/*  carved in a plate, and its great skeleton laid out on top: skull  */
/*  + horns, a long curving spine, the ribcage, folded wing bones and  */
/*  the tail. Bigger dragons leave bigger bones.                       */
/* ------------------------------------------------------------------ */
import type { Building } from "../sim/types";

const BONE = "#efe6cf";
const BONE_DARK = "#c9bc9a";
const LINE = "rgba(70,55,35,0.55)";

/** W: footprint width (px). Origin: the base line, centred. */
export function drawDragonBones(c: CanvasRenderingContext2D, W: number, b: Building, t: number) {
  const k = Math.max(0.6, Math.min(1.6, b.size ?? 1));
  const half = W / 2;
  // shadow + plinth
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(0, 2, half + 6, 12, 0, 0, Math.PI * 2);
  c.fill();
  const pg = c.createLinearGradient(0, -16, 0, 0);
  pg.addColorStop(0, "#a49a8c");
  pg.addColorStop(1, "#6f665b");
  c.fillStyle = pg;
  c.beginPath();
  c.roundRect(-half + 2, -16, W - 4, 16, 3);
  c.fill();
  c.fillStyle = "#b8ae9f";
  c.beginPath();
  c.roundRect(-half - 2, -22, W + 4, 8, 3);
  c.fill();
  // the name plate
  c.fillStyle = b.ours ? "#d8b45a" : "#8f8476";
  c.beginPath();
  c.roundRect(-34, -13, 68, 11, 2);
  c.fill();
  c.fillStyle = "#3b2a14";
  c.font = "bold 8px serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText((b.label ?? "A dragon").slice(0, 14), 0, -7.5);

  // the skeleton, lying on top of the plinth (head to the right)
  c.save();
  c.translate(0, -24);
  c.scale(k, k);
  c.lineCap = "round";
  c.lineJoin = "round";
  // folded wing bones behind the body: long finger bones fanning back with a few tatters
  for (const side of [-1, 1]) {
    const bx = 4;
    const by = -14 + side * 2;
    c.strokeStyle = side < 0 ? BONE_DARK : BONE;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(bx - 10, by - 18 - side * 2);
    c.stroke();
    c.lineWidth = 1.8;
    for (let f = 0; f < 4; f++) {
      c.beginPath();
      c.moveTo(bx - 10, by - 18 - side * 2);
      c.lineTo(bx - 22 - f * 9, by - 22 + f * 7);
      c.stroke();
    }
  }
  // tail: shrinking vertebrae curling off to the left
  for (let i = 0; i < 12; i++) {
    const x = -22 - i * 5;
    const y = -6 + Math.sin(i * 0.5) * 3 + i * 0.4;
    const r = 3.6 - i * 0.22;
    c.fillStyle = i % 2 ? BONE_DARK : BONE;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
  }
  // spine: big vertebrae with spikes along the back
  for (let i = 0; i < 9; i++) {
    const x = -20 + i * 6;
    const y = -9 - Math.sin((i / 8) * Math.PI) * 4;
    c.fillStyle = BONE;
    c.beginPath();
    c.ellipse(x, y, 3.8, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = LINE;
    c.lineWidth = 0.6;
    c.stroke();
    c.fillStyle = BONE_DARK;
    c.beginPath();
    c.moveTo(x - 1.5, y - 2);
    c.lineTo(x, y - 7);
    c.lineTo(x + 1.5, y - 2);
    c.fill();
  }
  // ribcage: arcs hanging off the spine
  c.strokeStyle = BONE;
  c.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = -14 + i * 5.5;
    c.beginPath();
    c.moveTo(x, -10);
    c.quadraticCurveTo(x + 4, 2 - (i === 0 || i === 5 ? 2 : 0), x + 1, 3);
    c.stroke();
  }
  // legs folded underneath
  c.lineWidth = 2.4;
  for (const [x, d] of [[-14, -1], [18, 1]] as const) {
    c.beginPath();
    c.moveTo(x, -6);
    c.lineTo(x + d * 4, 1);
    c.lineTo(x + d * 10, 2);
    c.stroke();
  }
  // neck up to the skull
  c.strokeStyle = BONE;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(32, -12);
  c.quadraticCurveTo(40, -18, 44, -14);
  c.stroke();
  // the skull: long snout, eye hollow, jaw with teeth, swept-back horns
  c.fillStyle = BONE;
  c.beginPath();
  c.moveTo(42, -20);
  c.quadraticCurveTo(50, -24, 64, -16);
  c.lineTo(64, -12);
  c.quadraticCurveTo(52, -10, 42, -11);
  c.closePath();
  c.fill();
  c.strokeStyle = LINE;
  c.lineWidth = 0.7;
  c.stroke();
  c.fillStyle = "#2a2018";
  c.beginPath();
  c.ellipse(48, -17, 2.4, 1.8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = BONE_DARK;
  c.beginPath();
  c.moveTo(44, -10);
  c.lineTo(62, -11);
  c.lineTo(58, -7);
  c.lineTo(46, -7);
  c.closePath();
  c.fill();
  c.fillStyle = "#fffaf0";
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(48 + i * 3, -11);
    c.lineTo(49 + i * 3, -8.5);
    c.lineTo(50 + i * 3, -11);
    c.fill();
  }
  c.fillStyle = BONE_DARK;
  for (const [hx, hy] of [[44, -20], [47, -21]] as const) {
    c.beginPath();
    c.moveTo(hx, hy);
    c.quadraticCurveTo(hx - 8, hy - 8, hx - 14, hy - 6);
    c.quadraticCurveTo(hx - 7, hy - 4, hx + 3, hy + 1);
    c.fill();
  }
  c.restore();
  // a glint of light on the bones now and then
  if (Math.sin(t * 1.3 + (b.id % 7)) > 0.97) {
    c.fillStyle = "rgba(255,255,240,0.85)";
    c.fillRect(20 * k, -40 * k, 2, 2);
  }
}
