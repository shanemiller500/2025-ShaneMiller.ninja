/* ------------------------------------------------------------------ */
/*  Sand People art: robed + face-wrapped desert folk, and their camp  */
/*  (striped tents, the big tent, the camel pen, the dragon roost, the */
/*  totem, the fire). Origin at the feet / the ground spot.           */
/*                                                                     */
/*  Camouflage: drawn faint + sand-tinted while nobody can make them   */
/*  out on the open sand, a little muted while seen on the sand, and   */
/*  plain off it.                                                      */
/* ------------------------------------------------------------------ */
import type { Brute } from "../sim/types";
import type { SandTent, SandTribe } from "../sim/sandFolk";

const ROBE = "#d8bd8a";
const ROBE_DARK = "#b39463";
const WRAP = "#e9d8b2";
const SKIN = ["#b07a4f", "#9a6a43", "#c08a5a", "#8a5a38"];
const INK = "#3a2a1a";

/**
 * One Sand Person. `camo`: 0 = plain to see, 1 = on the sand but spotted, 2 = blended into the dunes.
 * Riding (a camel or a Sand Dragon) they sit up in the saddle.
 */
export function drawSandFolk(c: CanvasRenderingContext2D, b: Brute, t: number, sash: string, camo: 0 | 1 | 2) {
  c.save();
  if (camo === 2) c.globalAlpha *= 0.3;
  else if (camo === 1) c.globalAlpha *= 0.82;
  const young = (b.age ?? 200) < 110;
  if (young) {
    const s = 0.55 + ((b.age ?? 0) / 110) * 0.4;
    c.scale(s, s);
  }
  c.scale(b.dir, 1);
  const seated = !!b.mount || !!b.onDragon;
  const moving = !seated && Math.hypot(b.vx, b.vy) > 4;
  const step = moving ? Math.sin(b.anim * 1.4) : 0;
  const skin = SKIN[b.id % SKIN.length];
  const fighting = b.state === "fight" || b.state === "hunt";
  // legs (sandals under the robe's hem) or legs either side of the saddle
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.lineCap = "round";
  if (seated) {
    c.strokeStyle = ROBE_DARK;
    c.beginPath();
    c.moveTo(-1, -6);
    c.lineTo(-4, 4);
    c.moveTo(1, -6);
    c.lineTo(5, 3);
    c.stroke();
  } else {
    c.strokeStyle = "#5b4128";
    c.beginPath();
    c.moveTo(-2, -8);
    c.lineTo(-3 - step * 3, 0);
    c.moveTo(2, -8);
    c.lineTo(3 + step * 3, 0);
    c.stroke();
  }
  // the long robe, flaring at the hem
  const hem = seated ? -4 : -3;
  c.fillStyle = ROBE;
  c.beginPath();
  c.moveTo(-5, -30);
  c.quadraticCurveTo(-9, -14, -9 - step * 1.5, hem);
  c.lineTo(9 + step * 1.5, hem);
  c.quadraticCurveTo(8, -14, 5, -30);
  c.closePath();
  c.fill();
  c.fillStyle = ROBE_DARK;
  c.beginPath();
  c.moveTo(-1, -26);
  c.lineTo(-3 - step, hem);
  c.lineTo(0, hem);
  c.closePath();
  c.fill();
  // the sash in the tribe's colour
  c.fillStyle = sash;
  c.fillRect(-6, -18, 12, 3);
  c.beginPath();
  c.moveTo(-6, -16);
  c.lineTo(-9, -9 + Math.sin(t * 4 + b.id) * 1.5);
  c.lineTo(-6.5, -10);
  c.closePath();
  c.fill();
  // arm + weapon
  const role = b.sandRole ?? "fighter";
  const swing = fighting ? Math.max(0, 1 - (b.cd ?? 0)) : 0;
  c.strokeStyle = ROBE;
  c.lineWidth = 3.4;
  c.beginPath();
  c.moveTo(3, -26);
  c.lineTo(8 + swing * 4, -19 - swing * 3);
  c.stroke();
  if (role === "archer") {
    c.strokeStyle = "#6e4a26";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(10, -21, 8, -1.3, 1.3);
    c.stroke();
    c.strokeStyle = "rgba(240,230,210,0.9)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(10 + Math.cos(-1.3) * 8, -21 + Math.sin(-1.3) * 8);
    c.lineTo(10 - (fighting ? 4 : 0), -21);
    c.lineTo(10 + Math.cos(1.3) * 8, -21 + Math.sin(1.3) * 8);
    c.stroke();
  } else if (role === "scout") {
    c.strokeStyle = "#5b4128";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(8, -19);
    c.quadraticCurveTo(12 + Math.sin(t * 9) * 2 * swing, -12, 9, -9);
    c.stroke();
  } else {
    // a long spear (a curved blade for the camel riders + dragon riders)
    const tilt = -0.5 - swing * 0.6;
    c.save();
    c.translate(9, -19);
    c.rotate(tilt);
    c.strokeStyle = "#7a5530";
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-10, 0);
    c.lineTo(20, 0);
    c.stroke();
    c.fillStyle = "#d9d4c8";
    c.beginPath();
    if (role === "camel" || role === "dragon") {
      c.moveTo(20, -1);
      c.quadraticCurveTo(27, -5, 29, 1);
      c.lineTo(20, 1.5);
    } else {
      c.moveTo(20, -2);
      c.lineTo(26, 0);
      c.lineTo(20, 2);
    }
    c.closePath();
    c.fill();
    c.restore();
  }
  // head: wrapped, only the eyes showing; a hood + a trailing tail of cloth
  c.fillStyle = WRAP;
  c.beginPath();
  c.ellipse(0.5, -34, 5.6, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-4, -37);
  c.quadraticCurveTo(-11, -34 + Math.sin(t * 3 + b.id) * 2, -12, -27);
  c.lineTo(-8, -30);
  c.closePath();
  c.fill();
  c.fillStyle = skin;
  c.fillRect(-0.5, -36.2, 6, 2.6);
  c.fillStyle = INK;
  c.fillRect(2.4, -35.6, 1.3, 1.3);
  c.fillStyle = sash;
  c.fillRect(-5, -40, 10, 1.6);
  c.restore();
}

/** One piece of a Sand camp (origin = its spot on the ground). */
export function drawSandTent(c: CanvasRenderingContext2D, s: SandTent, tr: SandTribe, t: number, night: boolean) {
  const col = tr.color;
  c.save();
  c.translate(s.x, s.y);
  if (s.hp <= 0) c.globalAlpha *= 0.4;
  switch (s.kind) {
    case "tent": {
      shadow(c, 26, 7);
      // an A-frame of striped cloth over two poles, the front flap tied back
      c.fillStyle = "#cdb382";
      c.beginPath();
      c.moveTo(-26, 0);
      c.lineTo(0, -30);
      c.lineTo(26, 0);
      c.closePath();
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = col;
      for (let i = -3; i <= 3; i += 2) c.fillRect(i * 7 - 3, -32, 5, 34);
      c.restore();
      c.fillStyle = "rgba(40,24,10,0.55)";
      c.beginPath();
      c.moveTo(-7, 0);
      c.lineTo(0, -16);
      c.lineTo(7, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "#6b4a28";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -30);
      c.lineTo(0, -36);
      c.stroke();
      break;
    }
    case "bigTent": {
      shadow(c, 54, 12);
      // the chief's tent: a broad dome with stripes and a banner on top
      c.fillStyle = "#d4bb8a";
      c.beginPath();
      c.moveTo(-52, 0);
      c.quadraticCurveTo(-48, -44, 0, -50);
      c.quadraticCurveTo(48, -44, 52, 0);
      c.closePath();
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = col;
      for (let i = -5; i <= 5; i += 2) c.fillRect(i * 10 - 4, -52, 7, 54);
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(-52, -50, 104, 12);
      c.restore();
      c.fillStyle = "rgba(40,24,10,0.6)";
      c.beginPath();
      c.moveTo(-10, 0);
      c.quadraticCurveTo(0, -26, 10, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "#6b4a28";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -50);
      c.lineTo(0, -72);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, -72);
      c.quadraticCurveTo(10, -70 + Math.sin(t * 3) * 2, 18, -68 + Math.sin(t * 3 + 1) * 3);
      c.lineTo(0, -62);
      c.closePath();
      c.fill();
      if (night) glow(c, 0, -10, 40, "rgba(255,170,80,0.25)");
      break;
    }
    case "pen": {
      // a rope ring between posts (the camels wander inside)
      c.strokeStyle = "#7b5a34";
      c.lineWidth = 2.4;
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * 70;
        const y = Math.sin(a) * 34;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y - 14);
        c.stroke();
      }
      c.strokeStyle = "rgba(210,190,150,0.9)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(0, -10, 70, 34, 0, 0, Math.PI * 2);
      c.stroke();
      // a trough
      c.fillStyle = "#6b4a28";
      c.fillRect(-14, 6, 28, 6);
      break;
    }
    case "roost": {
      shadow(c, 50, 12);
      // a wind-carved rock arch with a perch ledge, bones round its foot
      c.fillStyle = "#b08a5c";
      c.beginPath();
      c.moveTo(-48, 0);
      c.quadraticCurveTo(-52, -54, -18, -66);
      c.quadraticCurveTo(10, -74, 40, -50);
      c.quadraticCurveTo(54, -24, 48, 0);
      c.lineTo(26, 0);
      c.quadraticCurveTo(24, -34, 0, -38);
      c.quadraticCurveTo(-22, -36, -24, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(90,60,30,0.35)";
      c.beginPath();
      c.moveTo(-18, -60);
      c.quadraticCurveTo(10, -68, 34, -48);
      c.lineTo(30, -44);
      c.quadraticCurveTo(8, -60, -16, -54);
      c.closePath();
      c.fill();
      c.fillStyle = "#efe4cc";
      for (const [x, y, r] of [[-30, 2, 3], [-22, 4, 2], [32, 3, 2.6]] as const) {
        c.beginPath();
        c.ellipse(x, y, r * 2, r, 0.3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = col;
      c.fillRect(-4, -72, 3, -14);
      break;
    }
    case "totem": {
      // a tall pole with a giant scorpion's claw on top + ribbons in the wind
      c.strokeStyle = "#6b4a28";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -58);
      c.stroke();
      c.fillStyle = "#4b3426";
      c.beginPath();
      c.ellipse(0, -62, 9, 6, 0, 0, Math.PI * 2);
      c.fill();
      for (const s2 of [-1, 1]) {
        c.beginPath();
        c.moveTo(s2 * 4, -66);
        c.quadraticCurveTo(s2 * 12, -78, s2 * 4, -82);
        c.lineTo(s2 * 2, -70);
        c.closePath();
        c.fill();
      }
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = i % 2 ? col : "#e9d8b2";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -50 + i * 6);
        c.quadraticCurveTo(10, -48 + i * 6 + Math.sin(t * 3 + i) * 3, 18, -44 + i * 6 + Math.sin(t * 3 + i + 1) * 4);
        c.stroke();
      }
      break;
    }
    case "fire": {
      c.fillStyle = "#7a6a58";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.beginPath();
        c.ellipse(Math.cos(a) * 10, Math.sin(a) * 5, 3.2, 2.2, 0, 0, Math.PI * 2);
        c.fill();
      }
      const f = 0.8 + Math.sin(t * 9) * 0.15;
      c.fillStyle = "#ff8a2a";
      c.beginPath();
      c.moveTo(-6, 0);
      c.quadraticCurveTo(0, -18 * f, 6, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "#ffd25a";
      c.beginPath();
      c.moveTo(-3, 0);
      c.quadraticCurveTo(0, -10 * f, 3, 0);
      c.closePath();
      c.fill();
      if (night) glow(c, 0, -6, 70, "rgba(255,160,60,0.3)");
      break;
    }
  }
  c.restore();
}

function shadow(c: CanvasRenderingContext2D, rx: number, ry: number) {
  c.fillStyle = "rgba(60,40,20,0.2)";
  c.beginPath();
  c.ellipse(0, 1, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
