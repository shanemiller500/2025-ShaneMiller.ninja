/* ------------------------------------------------------------------ */
/*  Where the great beasts live (sim/beasts.ts):                       */
/*    • a Yeti's ice cave, cut into a rock face high on the peaks;     */
/*    • a Dinosaur Scorpion's burrow under a leaning slab of rock;     */
/*    • the capture net over a bound beast.                            */
/*  Drawn at the den's floor (0, 0 = where the beast stands at home).  */
/* ------------------------------------------------------------------ */
type Ctx = CanvasRenderingContext2D;

export interface DenLook {
  /** something lives here now */
  lived: boolean;
  /** it's inside, asleep: only its eyes show */
  asleep: boolean;
  /** 0 day … 1 night */
  night: number;
}

function poly(c: Ctx, pts: number[]) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
}

/** Skulls + rib bones scattered at a den's mouth. */
function bonePile(c: Ctx, x: number, y: number, s: number) {
  c.strokeStyle = "#efe6d2";
  c.lineCap = "round";
  c.lineWidth = 2.2 * s;
  c.beginPath();
  c.moveTo(x - 9 * s, y + 1);
  c.lineTo(x + 3 * s, y - 2 * s);
  c.moveTo(x - 2 * s, y + 3 * s);
  c.lineTo(x + 10 * s, y + 2 * s);
  c.moveTo(x + 4 * s, y - 5 * s);
  c.quadraticCurveTo(x + 9 * s, y - 9 * s, x + 13 * s, y - 3 * s);
  c.stroke();
  // a skull
  c.fillStyle = "#f3ecdb";
  c.beginPath();
  c.ellipse(x - 12 * s, y - 2 * s, 4.6 * s, 3.8 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#2a2622";
  c.beginPath();
  c.arc(x - 13.4 * s, y - 2.6 * s, 1 * s, 0, Math.PI * 2);
  c.arc(x - 10.6 * s, y - 2.6 * s, 1 * s, 0, Math.PI * 2);
  c.fill();
}

/** Two eyes in the dark: slow blink, a faint glow. */
function eyes(c: Ctx, x: number, y: number, gap: number, r: number, color: string, t: number) {
  const blink = Math.sin(t * 0.9) > 0.94 ? 0.15 : 1;
  c.fillStyle = color;
  c.globalAlpha = 0.25;
  c.beginPath();
  c.arc(x - gap, y, r * 2.6, 0, Math.PI * 2);
  c.arc(x + gap, y, r * 2.6, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.beginPath();
  c.ellipse(x - gap, y, r, r * blink, 0, 0, Math.PI * 2);
  c.ellipse(x + gap, y, r, r * blink, 0, 0, Math.PI * 2);
  c.fill();
}

/** A Yeti's ice cave: a rock + ice mound with a tall dark mouth, icicles, bones at the door. */
export function drawYetiCave(c: Ctx, t: number, o: DenLook) {
  c.save();
  // shadow on the snow
  c.fillStyle = "rgba(50,70,100,0.22)";
  c.beginPath();
  c.ellipse(4, 2, 84, 16, 0, 0, Math.PI * 2);
  c.fill();
  // the rock face
  const rock = c.createLinearGradient(0, -118, 0, 0);
  rock.addColorStop(0, "#8e9cab");
  rock.addColorStop(0.55, "#6f7b8a");
  rock.addColorStop(1, "#55606e");
  c.fillStyle = rock;
  poly(c, [-82, 0, -74, -44, -56, -78, -30, -104, -4, -118, 26, -108, 52, -84, 70, -50, 80, 0]);
  c.fill();
  // cracks + ledges
  c.strokeStyle = "rgba(38,46,58,0.45)";
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-58, -70);
  c.lineTo(-44, -52);
  c.lineTo(-52, -30);
  c.moveTo(48, -78);
  c.lineTo(40, -56);
  c.lineTo(56, -34);
  c.moveTo(-6, -112);
  c.lineTo(4, -92);
  c.stroke();
  // blue ice sheathing one side
  c.fillStyle = "rgba(170,214,236,0.55)";
  poly(c, [40, -90, 58, -70, 70, -44, 76, -8, 60, -6, 52, -40, 44, -62]);
  c.fill();
  // snow cap + drifts
  c.fillStyle = "#f4f8fc";
  poly(c, [-58, -76, -30, -104, -4, -118, 26, -108, 54, -82, 38, -86, 22, -96, 6, -100, -8, -92, -24, -90, -40, -76]);
  c.fill();
  c.beginPath();
  c.ellipse(-70, -2, 26, 9, 0, 0, Math.PI * 2);
  c.ellipse(70, -1, 24, 8, 0, 0, Math.PI * 2);
  c.fill();
  // the mouth
  const dark = c.createLinearGradient(0, -64, 0, -4);
  dark.addColorStop(0, "#05080d");
  dark.addColorStop(1, "#16222f");
  c.fillStyle = dark;
  c.beginPath();
  c.moveTo(-30, -4);
  c.quadraticCurveTo(-36, -52, -8, -66);
  c.quadraticCurveTo(22, -72, 30, -40);
  c.quadraticCurveTo(34, -18, 30, -4);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(196,226,244,0.7)";
  c.lineWidth = 2;
  c.stroke();
  // icicles from the lip
  c.fillStyle = "#dff1fb";
  c.beginPath();
  for (const [x, y, n] of [[-24, -50, 15], [-12, -62, 20], [2, -66, 13], [14, -62, 22], [24, -48, 12]] as const) {
    c.moveTo(x - 3.5, y);
    c.lineTo(x + 3.5, y);
    c.lineTo(x + 0.6, y + n);
    c.closePath();
  }
  c.fill();
  if (o.lived) {
    // what's left of its dinners, and its great footprints in the snow
    bonePile(c, -44, -1, 1);
    bonePile(c, 46, 3, 0.8);
    c.fillStyle = "rgba(120,150,180,0.4)";
    c.beginPath();
    c.ellipse(-8, 12, 5, 8, 0.25, 0, Math.PI * 2);
    c.ellipse(10, 20, 5, 8, -0.2, 0, Math.PI * 2);
    c.ellipse(-4, 30, 5, 8, 0.2, 0, Math.PI * 2);
    c.fill();
  } else {
    // nobody home: snow has drifted half across the door
    c.fillStyle = "#eef4f9";
    c.beginPath();
    c.moveTo(-32, -2);
    c.quadraticCurveTo(-10, -30, 14, -16);
    c.quadraticCurveTo(26, -8, 32, -2);
    c.closePath();
    c.fill();
  }
  if (o.asleep) {
    eyes(c, 0, -30, 7, 2.2, "#bfe9ff", t);
    // its breath steaming out of the cave
    const k = (t * 0.35) % 1;
    c.fillStyle = `rgba(230,244,255,${(0.35 * (1 - k)).toFixed(3)})`;
    c.beginPath();
    c.ellipse(4 + k * 14, -22 - k * 20, 6 + k * 10, 4 + k * 6, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** A Dinosaur Scorpion's den: a burrow under a great leaning slab, dug-out sand, old bones. */
export function drawScorpionDen(c: Ctx, t: number, o: DenLook) {
  c.save();
  c.fillStyle = "rgba(60,40,20,0.22)";
  c.beginPath();
  c.ellipse(4, 3, 64, 12, 0, 0, Math.PI * 2);
  c.fill();
  // the dug-out spoil heap
  c.fillStyle = "#c9a56e";
  c.beginPath();
  c.ellipse(-46, 0, 26, 9, 0, 0, Math.PI * 2);
  c.ellipse(44, 2, 22, 8, 0, 0, Math.PI * 2);
  c.fill();
  // the burrow
  const dark = c.createLinearGradient(0, -34, 0, 0);
  dark.addColorStop(0, "#0b0705");
  dark.addColorStop(1, "#2a1a10");
  c.fillStyle = dark;
  c.beginPath();
  c.moveTo(-34, 0);
  c.quadraticCurveTo(-30, -36, 2, -38);
  c.quadraticCurveTo(34, -36, 36, 0);
  c.closePath();
  c.fill();
  // the slab leaning over it, and the boulders that prop it
  const slab = c.createLinearGradient(0, -66, 0, -20);
  slab.addColorStop(0, "#b99468");
  slab.addColorStop(1, "#86623f");
  c.fillStyle = slab;
  poly(c, [-62, -28, -40, -58, 10, -68, 58, -50, 66, -30, 30, -24, -20, -22]);
  c.fill();
  c.fillStyle = "#7a5838";
  poly(c, [-64, 0, -66, -24, -44, -30, -34, -8, -36, 0]);
  c.fill();
  poly(c, [38, 0, 36, -20, 54, -30, 68, -14, 66, 0]);
  c.fill();
  c.strokeStyle = "rgba(60,38,20,0.5)";
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-30, -52);
  c.lineTo(-10, -40);
  c.lineTo(8, -46);
  c.moveTo(30, -56);
  c.lineTo(40, -38);
  c.stroke();
  // sun-bleached highlights on the slab's top edge
  c.strokeStyle = "rgba(255,236,200,0.5)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-40, -58);
  c.lineTo(10, -68);
  c.lineTo(58, -50);
  c.stroke();
  if (o.lived) {
    bonePile(c, -40, 6, 0.9);
    bonePile(c, 30, 10, 0.75);
    // a shed claw
    c.fillStyle = "#6b3f2a";
    c.beginPath();
    c.moveTo(52, 10);
    c.quadraticCurveTo(66, 0, 70, 12);
    c.quadraticCurveTo(62, 8, 54, 15);
    c.closePath();
    c.fill();
  }
  if (o.asleep) eyes(c, 0, -14, 9, 1.8, "#ffb23a", t + 1.7);
  c.restore();
}

/** The capture net over a bound beast (L = its length; drawn at its feet). */
export function drawNet(c: Ctx, L: number) {
  const rx = L * 0.56;
  const ry = L * 0.36;
  const cy = -L * 0.3;
  c.save();
  c.beginPath();
  c.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  c.clip();
  c.strokeStyle = "rgba(232,214,166,0.85)";
  c.lineWidth = Math.max(1, L * 0.012);
  c.beginPath();
  const step = Math.max(7, L * 0.09);
  for (let x = -rx - ry * 2; x < rx + ry * 2; x += step) {
    c.moveTo(x, cy - ry);
    c.lineTo(x + ry * 2, cy + ry);
    c.moveTo(x + ry * 2, cy - ry);
    c.lineTo(x, cy + ry);
  }
  c.stroke();
  c.restore();
  // the rim rope, its stone weights and the chains pegged to the ground
  c.strokeStyle = "#cdb47c";
  c.lineWidth = Math.max(1.4, L * 0.018);
  c.beginPath();
  c.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "#6d6f76";
  c.beginPath();
  for (const a of [0.5, 1.4, 2.4, 3.3, 4.3, 5.5]) {
    const x = Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    c.moveTo(x + 3, y);
    c.arc(x, y, Math.max(2.4, L * 0.025), 0, Math.PI * 2);
  }
  c.fill();
}
