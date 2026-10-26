/* ------------------------------------------------------------------ */
/*  Mountain Monk art: robed figures (saffron, ochre, maroon), the     */
/*  leader's lantern + staff, sitting / kneeling / walking poses, the  */
/*  soft column of light at the offering; and their places: stone huts */
/*  with prayer flags, the shrine + bell, a cairn, the high altar.     */
/*  Gentle and ceremonial: nothing is ever shown being harmed.         */
/* ------------------------------------------------------------------ */
import type { Monk, MonkPlace } from "../sim/monks";

const ROBES = ["#e0902a", "#c8642c", "#8e2b2b"];
const SKIN = "#c99a6c";
const FLAGS = ["#2f6fd6", "#f4f1e8", "#d63b2f", "#2e9b4f", "#f2c230"];

/** A monk; origin at their feet (already raised by z for the offering). */
export function drawMonk(c: CanvasRenderingContext2D, m: Monk, t: number, leader: boolean, night: boolean) {
  const robe = ROBES[m.robe % ROBES.length];
  c.save();
  // walking into the light: a warm glow round them as they rise, fading as they go
  if (m.glow > 0) {
    const g = c.createRadialGradient(0, -16, 2, 0, -16, 40);
    g.addColorStop(0, `rgba(255,236,170,${0.65 * m.glow})`);
    g.addColorStop(1, "rgba(255,236,170,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -16, 40, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha *= 1 - m.glow * 0.85;
  }
  c.scale(m.dir, 1);
  const sitting = m.state === "meditate" || m.state === "sit" || m.state === "gaze" || m.state === "sleep" || m.state === "chant";
  const kneel = m.state === "kneel" || m.state === "ascend";
  const step = m.state === "walk" ? Math.sin(m.anim * 2.2) : 0;
  if (sitting || kneel) {
    // cross-legged (or kneeling): a wide robe at the bottom, upright body
    c.fillStyle = robe;
    c.beginPath();
    c.ellipse(0, -3, kneel ? 8 : 10, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-6, -4);
    c.quadraticCurveTo(-6, -18, 0, -20);
    c.quadraticCurveTo(6, -18, 6, -4);
    c.closePath();
    c.fill();
    // hands together (meditating / praying) or resting on the knees
    c.fillStyle = SKIN;
    c.beginPath();
    c.ellipse(m.state === "gaze" ? 3 : 1.5, m.state === "meditate" || kneel ? -12 : -6, 1.8, 2.4, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    // standing / walking: a long robe that swings with each step, sandalled feet
    c.fillStyle = "#4a3324";
    c.beginPath();
    c.ellipse(-2 - step * 2, 0, 2.6, 1.3, 0, 0, Math.PI * 2);
    c.ellipse(2 + step * 2, 0, 2.6, 1.3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = robe;
    c.beginPath();
    c.moveTo(-4.5, -24);
    c.quadraticCurveTo(-7, -10, -6 - step * 1.4, -1);
    c.lineTo(6 + step * 1.4, -1);
    c.quadraticCurveTo(7, -10, 4.5, -24);
    c.closePath();
    c.fill();
    // the draped shoulder cloth (the other colour)
    c.fillStyle = ROBES[(m.robe + 1) % ROBES.length];
    c.beginPath();
    c.moveTo(-4.5, -24);
    c.lineTo(5, -14);
    c.lineTo(5, -19);
    c.lineTo(-1, -25);
    c.closePath();
    c.fill();
    // the leader carries a staff with a lantern (it glows at dusk + night)
    if (leader) {
      c.strokeStyle = "#6b4a28";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(7, -2);
      c.lineTo(9, -34);
      c.stroke();
      c.fillStyle = "#3a2a1a";
      c.fillRect(7.5, -34, 4, 5);
      c.fillStyle = night ? "#ffd27a" : "#f1d9a0";
      c.fillRect(8.3, -33.2, 2.4, 3.4);
      if (night) {
        const g = c.createRadialGradient(9.5, -31, 0, 9.5, -31, 26);
        g.addColorStop(0, "rgba(255,210,120,0.45)");
        g.addColorStop(1, "rgba(255,210,120,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(9.5, -31, 26, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      // prayer beads in hand
      c.fillStyle = "#5b3a22";
      for (let i = 0; i < 4; i++) c.fillRect(4 + (i % 2), -15 + i * 1.6, 1.2, 1.2);
    }
  }
  // the shaved head
  const hy = sitting || kneel ? -24 : -28;
  const bow = m.state === "kneel" || m.state === "meditate" ? 1.5 : m.state === "gaze" ? -1.5 : 0;
  c.fillStyle = SKIN;
  c.beginPath();
  c.arc(0.8, hy + bow, 4.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.25)";
  c.beginPath();
  c.arc(-0.6, hy - 1.6 + bow, 1.6, 0, Math.PI * 2);
  c.fill();
  // eyes: closed (meditating, asleep, kneeling) or open, looking up at dusk
  c.strokeStyle = "#3a2414";
  c.lineWidth = 0.8;
  c.beginPath();
  if (m.state === "meditate" || m.state === "sleep" || m.state === "kneel" || m.state === "ascend" || m.state === "chant") {
    c.moveTo(2.2, hy + 0.4 + bow);
    c.lineTo(4, hy + 0.4 + bow);
  } else c.arc(3.2, hy - (m.state === "gaze" ? 0.8 : 0) + bow, 0.6, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

/** One of the monks' places (origin = its spot on the ground). */
export function drawMonkPlace(c: CanvasRenderingContext2D, p: MonkPlace, t: number, night: boolean, rite: boolean) {
  c.save();
  c.translate(p.x, p.y);
  switch (p.kind) {
    case "hut": {
      ground(c, 34);
      // dry-stone walls, a flat timber roof weighted with stones, a little door
      c.fillStyle = "#8d8478";
      c.fillRect(-30, -34, 60, 34);
      c.fillStyle = "rgba(60,54,48,0.4)";
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) c.fillRect(-29 + k * 12 + (r % 2) * 6, -32 + r * 8, 10, 1.2);
      c.fillStyle = "#5c3d26";
      c.fillRect(-34, -40, 68, 7);
      c.fillStyle = "#9a9187";
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.ellipse(-26 + k * 13, -41, 4, 2.4, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = night ? "#ffcf74" : "#3a2a1c";
      c.fillRect(-6, -18, 12, 18);
      if (night) glowAt(c, 0, -10, 30);
      flagLine(c, -34, -40, 34, -40, t, 0);
      break;
    }
    case "shrine": {
      ground(c, 26);
      // a small white stupa: a stepped base, a dome, a spire, a bell hanging beside it
      c.fillStyle = "#e8e2d4";
      c.fillRect(-20, -10, 40, 10);
      c.fillRect(-15, -16, 30, 6);
      c.beginPath();
      c.arc(0, -16, 12, Math.PI, 0);
      c.fill();
      c.fillStyle = "#d4a838";
      c.beginPath();
      c.moveTo(-3, -28);
      c.lineTo(0, -44);
      c.lineTo(3, -28);
      c.closePath();
      c.fill();
      c.fillStyle = "#8e2b2b";
      c.fillRect(-12, -20, 24, 2);
      // the bell (it swings when they gather for the offering)
      const sw = rite ? Math.sin(t * 6) * 0.4 : Math.sin(t * 0.8) * 0.05;
      c.strokeStyle = "#6b4a28";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(22, 0);
      c.lineTo(22, -30);
      c.lineTo(34, -30);
      c.stroke();
      c.save();
      c.translate(30, -30);
      c.rotate(sw);
      c.fillStyle = "#b8862e";
      c.beginPath();
      c.moveTo(-4, 0);
      c.quadraticCurveTo(-5, 9, -6, 11);
      c.lineTo(6, 11);
      c.quadraticCurveTo(5, 9, 4, 0);
      c.closePath();
      c.fill();
      c.restore();
      if (night) glowAt(c, 0, -14, 34);
      break;
    }
    case "flags": {
      c.strokeStyle = "#6b4a28";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-40, 0);
      c.lineTo(-40, -46);
      c.moveTo(40, 0);
      c.lineTo(40, -38);
      c.stroke();
      flagLine(c, -40, -46, 40, -38, t, 1);
      flagLine(c, -40, -36, 40, -28, t, 2);
      break;
    }
    case "cairn": {
      ground(c, 16);
      c.fillStyle = "#9a948a";
      for (const [x, y, rx, ry] of [[0, -4, 12, 5], [1, -11, 9, 4], [-1, -17, 7, 3.4], [0, -22, 5, 2.8], [1, -26, 3, 2]] as const) {
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "altar": {
      ground(c, 64);
      // the high ledge: a long flat stone on two uprights, banners either side, a carved dragon sign
      c.fillStyle = "#8a8378";
      c.fillRect(-56, -14, 10, 14);
      c.fillRect(46, -14, 10, 14);
      c.fillStyle = "#a69e92";
      c.fillRect(-64, -20, 128, 8);
      c.strokeStyle = "rgba(255,226,140,0.8)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(0, -16, 3, 0, Math.PI * 2);
      c.moveTo(-8, -16);
      c.quadraticCurveTo(0, -24, 8, -16);
      c.stroke();
      for (const s of [-1, 1]) {
        c.strokeStyle = "#6b4a28";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(s * 74, 0);
        c.lineTo(s * 74, -60);
        c.stroke();
        c.fillStyle = s < 0 ? "#e0902a" : "#8e2b2b";
        c.beginPath();
        c.moveTo(s * 74, -58);
        c.lineTo(s * 74 + s * 10 + Math.sin(t * 2 + s) * 2, -40);
        c.lineTo(s * 74, -30);
        c.closePath();
        c.fill();
      }
      // at the offering: a soft column of light from the sky onto the ledge
      if (rite) {
        const a = 0.25 + Math.sin(t * 1.4) * 0.08;
        const g = c.createLinearGradient(0, -400, 0, 0);
        g.addColorStop(0, "rgba(255,240,190,0)");
        g.addColorStop(0.6, `rgba(255,240,190,${a})`);
        g.addColorStop(1, `rgba(255,236,170,${a * 1.4})`);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-40, 0);
        c.lineTo(-80, -400);
        c.lineTo(160, -400);
        c.lineTo(120, 0);
        c.closePath();
        c.fill();
      }
      break;
    }
  }
  c.restore();
}

function ground(c: CanvasRenderingContext2D, r: number) {
  c.fillStyle = "rgba(40,34,40,0.18)";
  c.beginPath();
  c.ellipse(0, 1, r, r * 0.28, 0, 0, Math.PI * 2);
  c.fill();
}

function glowAt(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(255,200,110,0.35)");
  g.addColorStop(1, "rgba(255,200,110,0)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

/** A line of prayer flags (five colours) sagging between two points, fluttering. */
function flagLine(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number, seed: number) {
  c.strokeStyle = "rgba(240,230,210,0.8)";
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 8, x1, y1);
  c.stroke();
  const n = 9;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const x = x0 + (x1 - x0) * k;
    const y = y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 8;
    c.fillStyle = FLAGS[(i + seed) % FLAGS.length];
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(t * 3 + i + seed) * 0.15);
    c.fillRect(-2.5, 0, 5, 6);
    c.restore();
  }
}
