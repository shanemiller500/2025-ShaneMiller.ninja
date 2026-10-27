/* ------------------------------------------------------------------ */
/*  Snow People art: fur-clad hunters of the peaks, and their camp     */
/*  (ice-block igloos, the hide longhouse with snow on its roof, hide  */
/*  yurts, the Frosthorn pen, the fire pit, the drying rack, the ice-  */
/*  crowned totem). Origin at the feet / the ground spot.              */
/*                                                                     */
/*  White + grey furs with the tribe's colour as trim; deep hoods with */
/*  a fur ruff, bone slit-goggles, mitts, snowshoes on their boots.    */
/* ------------------------------------------------------------------ */
import type { Brute } from "../sim/types";
import type { SnowLodge, SnowTribe } from "../sim/snowFolk";

const FUR = "#eceff1";
const FUR_D = "#c3cbd2";
const HIDE = "#8a6a4f";
const SKIN = ["#c48d63", "#b07a52", "#d29b70", "#9c6a46"];
const INK = "#2a2420";

function shadow(c: CanvasRenderingContext2D, rx: number, ry: number) {
  c.fillStyle = "rgba(60,80,110,0.22)";
  c.beginPath();
  c.ellipse(0, 1, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

/** One Snow Person (riding, they sit up on their Frosthorn). */
export function drawSnowFolk(c: CanvasRenderingContext2D, b: Brute, t: number, trim: string) {
  c.save();
  const young = (b.age ?? 200) < 120;
  if (young) {
    const s = 0.55 + ((b.age ?? 0) / 120) * 0.4;
    c.scale(s, s);
  }
  c.scale(b.dir, 1);
  const seated = !!b.mount;
  const moving = !seated && Math.hypot(b.vx, b.vy) > 4;
  const step = moving ? Math.sin(b.anim * 1.3) : 0;
  const fighting = b.state === "fight" || b.state === "hunt";
  const role = b.snowRole ?? "hunter";
  // legs: fur boots on wide snowshoes (or astride the saddle)
  c.lineCap = "round";
  if (seated) {
    c.strokeStyle = FUR_D;
    c.lineWidth = 3.4;
    c.beginPath();
    c.moveTo(-1, -6);
    c.lineTo(-5, 4);
    c.moveTo(1, -6);
    c.lineTo(5, 3);
    c.stroke();
  } else {
    c.strokeStyle = HIDE;
    c.lineWidth = 3.6;
    c.beginPath();
    c.moveTo(-2, -9);
    c.lineTo(-3 - step * 3, -1);
    c.moveTo(2, -9);
    c.lineTo(3 + step * 3, -1);
    c.stroke();
    c.strokeStyle = "#6b5440";
    c.lineWidth = 1;
    for (const fx of [-3 - step * 3, 3 + step * 3]) {
      c.beginPath();
      c.ellipse(fx, 0, 4.2, 1.3, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }
  // the parka: a long fur coat, a fringe of darker fur at the hem
  const hem = seated ? -4 : -6;
  c.fillStyle = FUR;
  c.beginPath();
  c.moveTo(-6, -30);
  c.quadraticCurveTo(-10, -18, -9 - step, hem);
  c.lineTo(9 + step, hem);
  c.quadraticCurveTo(9, -18, 6, -30);
  c.closePath();
  c.fill();
  c.fillStyle = FUR_D;
  for (let i = -8; i <= 8; i += 3) {
    c.beginPath();
    c.moveTo(i, hem - 2);
    c.lineTo(i + 1.5, hem + 1.5);
    c.lineTo(i + 3, hem - 2);
    c.closePath();
    c.fill();
  }
  // the tribe's colour: a trim band + a cord
  c.fillStyle = trim;
  c.fillRect(-7.5, -16, 15, 2.5);
  c.fillRect(-1, -29, 2, 13);
  // arm + weapon
  const swing = fighting ? Math.max(0, 1 - (b.cd ?? 0)) : 0;
  c.strokeStyle = FUR_D;
  c.lineWidth = 3.6;
  c.beginPath();
  c.moveTo(3, -26);
  c.lineTo(8 + swing * 4, -19 - swing * 3);
  c.stroke();
  c.fillStyle = HIDE;
  c.beginPath();
  c.arc(8 + swing * 4, -19 - swing * 3, 1.9, 0, Math.PI * 2);
  c.fill();
  if (role === "archer") {
    c.strokeStyle = "#5a4330";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(10, -21, 8, -1.3, 1.3);
    c.stroke();
    c.strokeStyle = "rgba(240,240,240,0.9)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(10 + Math.cos(-1.3) * 8, -21 + Math.sin(-1.3) * 8);
    c.lineTo(10 - (fighting ? 4 : 0), -21);
    c.lineTo(10 + Math.cos(1.3) * 8, -21 + Math.sin(1.3) * 8);
    c.stroke();
  } else if (role === "warrior") {
    // an ice axe: a bone haft, a blade of blue-white stone
    c.save();
    c.translate(9, -19);
    c.rotate(-1.1 + swing * 1.6);
    c.strokeStyle = "#d9cdb7";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 2);
    c.lineTo(0, -14);
    c.stroke();
    c.fillStyle = "#bfe6f7";
    c.strokeStyle = "#5c8fae";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(7, -16);
    c.lineTo(6, -10);
    c.lineTo(0, -11);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  } else if (role === "shaman") {
    // a tall staff topped with a frost crystal that glows
    c.strokeStyle = "#7a5f45";
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(10, -2);
    c.lineTo(10, -40);
    c.stroke();
    const g = 0.55 + Math.sin(t * 3 + b.id) * 0.25 + swing * 0.3;
    c.fillStyle = `rgba(190,240,255,${g})`;
    c.beginPath();
    c.moveTo(10, -48);
    c.lineTo(13, -42);
    c.lineTo(10, -37);
    c.lineTo(7, -42);
    c.closePath();
    c.fill();
  } else {
    // a long spear with a bone point (a barbed one for the riders)
    c.save();
    c.translate(9, -19);
    c.rotate(-0.5 - swing * 0.6);
    c.strokeStyle = "#7a5f45";
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-10, 0);
    c.lineTo(20, 0);
    c.stroke();
    c.fillStyle = "#efe6d4";
    c.beginPath();
    c.moveTo(20, -2);
    c.lineTo(27, 0);
    c.lineTo(20, 2);
    c.closePath();
    c.fill();
    if (role === "rider") {
      c.fillStyle = trim;
      c.fillRect(14, -3.5, 2, 3);
    }
    c.restore();
  }
  // the hood with its fur ruff, a face in the opening, bone slit-goggles
  c.fillStyle = FUR_D;
  c.beginPath();
  c.ellipse(0.5, -35, 7.4, 7.6, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = FUR;
  c.beginPath();
  c.ellipse(0.5, -35, 6.2, 6.4, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = SKIN[b.id % SKIN.length];
  c.beginPath();
  c.ellipse(2, -34.5, 3.6, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#e9dfc9";
  c.fillRect(-0.6, -36.4, 6.4, 1.9);
  c.fillStyle = INK;
  c.fillRect(1.2, -35.9, 1.6, 0.8);
  c.fillRect(3.8, -35.9, 1.6, 0.8);
  // breath steaming in the cold
  const puff = (t * 0.7 + b.id * 0.13) % 1;
  if (puff < 0.5) {
    c.fillStyle = `rgba(255,255,255,${0.35 * (1 - puff * 2)})`;
    c.beginPath();
    c.arc(7 + puff * 8, -33 - puff * 4, 1.5 + puff * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** One piece of a Snow camp (origin = its spot on the ground). */
export function drawSnowLodge(c: CanvasRenderingContext2D, s: SnowLodge, tr: SnowTribe, t: number, night: boolean) {
  const col = tr.color;
  c.save();
  c.translate(s.x, s.y);
  if (s.hp <= 0) c.globalAlpha *= 0.4;
  switch (s.kind) {
    case "igloo": {
      shadow(c, 30, 8);
      // a dome of ice blocks, the entrance tunnel at the front
      const g = c.createLinearGradient(-26, -30, 26, 0);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#c9dcea");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, 28, 30, 0, Math.PI, 0);
      c.fill();
      c.strokeStyle = "rgba(120,155,185,0.55)";
      c.lineWidth = 1;
      for (let row = 1; row <= 3; row++) {
        const y = -row * 8;
        const half = Math.sqrt(Math.max(0, 1 - (y / 30) ** 2)) * 28;
        c.beginPath();
        c.moveTo(-half, y);
        c.lineTo(half, y);
        c.stroke();
        for (let i = -3; i <= 3; i++) {
          const x = (i + (row % 2) * 0.5) * 9;
          if (Math.abs(x) > half - 2) continue;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x, y + 8);
          c.stroke();
        }
      }
      c.fillStyle = "#e8f1f7";
      c.beginPath();
      c.ellipse(16, 0, 11, 12, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = night ? "rgba(255,190,110,0.85)" : "rgba(40,55,70,0.75)";
      c.beginPath();
      c.ellipse(20, 0, 6, 7, 0, Math.PI, 0);
      c.fill();
      break;
    }
    case "lodge": {
      shadow(c, 58, 13);
      // the longhouse: hide over a frame of tusks + driftwood, snow piled on the roof, smoke out of the top
      c.fillStyle = "#7d6047";
      c.beginPath();
      c.moveTo(-56, 0);
      c.quadraticCurveTo(-52, -38, 0, -46);
      c.quadraticCurveTo(52, -38, 56, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "#5c4532";
      c.lineWidth = 1.2;
      for (let i = -4; i <= 4; i++) {
        c.beginPath();
        c.moveTo(i * 12, 0);
        c.quadraticCurveTo(i * 11, -30, i * 4, -44);
        c.stroke();
      }
      c.fillStyle = "#f6f9fb";
      c.beginPath();
      c.moveTo(-50, -18);
      c.quadraticCurveTo(-40, -42, 0, -48);
      c.quadraticCurveTo(40, -42, 50, -18);
      c.quadraticCurveTo(30, -30, 0, -34);
      c.quadraticCurveTo(-30, -30, -50, -18);
      c.closePath();
      c.fill();
      // tusks crossed over the door, a banner in the tribe's colour
      c.strokeStyle = "#efe6d2";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-14, 0);
      c.quadraticCurveTo(-20, -18, -4, -26);
      c.moveTo(14, 0);
      c.quadraticCurveTo(20, -18, 4, -26);
      c.stroke();
      c.fillStyle = night ? "rgba(255,180,90,0.85)" : "rgba(35,25,18,0.7)";
      c.beginPath();
      c.ellipse(0, 0, 9, 14, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, -48);
      c.lineTo(0, -64);
      c.lineTo(12, -60 + Math.sin(t * 3) * 1.5);
      c.lineTo(0, -56);
      c.closePath();
      c.fill();
      for (let i = 0; i < 3; i++) {
        const f = (t * 0.25 + i / 3) % 1;
        c.fillStyle = `rgba(210,215,220,${0.4 * (1 - f)})`;
        c.beginPath();
        c.arc(-18 + f * 6, -44 - f * 30, 4 + f * 7, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "yurt": {
      shadow(c, 26, 7);
      c.fillStyle = "#a88a6c";
      c.beginPath();
      c.moveTo(-24, 0);
      c.lineTo(-24, -16);
      c.lineTo(0, -30);
      c.lineTo(24, -16);
      c.lineTo(24, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "#f2f5f8";
      c.beginPath();
      c.moveTo(-25, -16);
      c.lineTo(0, -31);
      c.lineTo(25, -16);
      c.lineTo(0, -22);
      c.closePath();
      c.fill();
      c.fillStyle = col;
      c.fillRect(-24, -10, 48, 2.5);
      c.fillStyle = night ? "rgba(255,180,90,0.8)" : "rgba(40,28,18,0.6)";
      c.fillRect(-5, -12, 10, 12);
      break;
    }
    case "pen": {
      // a fence of driftwood + bone, snow along the rails
      c.strokeStyle = "#6e5640";
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(0, -10, 60, 26, 0, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = Math.cos(a) * 60;
        const y = -10 + Math.sin(a) * 26;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y - 14);
        c.stroke();
      }
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(0, -24, 60, 26, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
      break;
    }
    case "fire": {
      c.fillStyle = "#6f6f74";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.ellipse(Math.cos(a) * 12, Math.sin(a) * 5, 4, 2.6, 0, 0, Math.PI * 2);
        c.fill();
      }
      const f = 0.8 + Math.sin(t * 9) * 0.2;
      c.fillStyle = "#ff9a2e";
      c.beginPath();
      c.moveTo(-6, 0);
      c.quadraticCurveTo(0, -18 * f, 6, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "#ffe08a";
      c.beginPath();
      c.moveTo(-3, 0);
      c.quadraticCurveTo(0, -10 * f, 3, 0);
      c.closePath();
      c.fill();
      break;
    }
    case "rack": {
      // a drying rack: meat strips + a stretched hide
      c.strokeStyle = "#6e5640";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-16, 0);
      c.lineTo(-16, -26);
      c.moveTo(16, 0);
      c.lineTo(16, -26);
      c.moveTo(-18, -24);
      c.lineTo(18, -24);
      c.stroke();
      c.fillStyle = "#a14d3a";
      for (let i = -2; i <= 2; i++) c.fillRect(i * 6 - 1.5, -23, 3, 10 + (i % 2) * 3);
      c.fillStyle = "#c9a57d";
      c.fillRect(-14, -12, 10, 9);
      break;
    }
    case "tower": {
      // a watchtower of stacked stone with an ice-block lookout, an archer up top
      shadow(c, 18, 6);
      c.fillStyle = "#8d949c";
      c.beginPath();
      c.moveTo(-14, 0);
      c.lineTo(-10, -52);
      c.lineTo(10, -52);
      c.lineTo(14, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(60,66,74,0.45)";
      c.lineWidth = 1;
      for (let y = -46; y < 0; y += 8) {
        c.beginPath();
        c.moveTo(-12, y);
        c.lineTo(12, y);
        c.stroke();
      }
      c.fillStyle = "#dcebf5";
      c.fillRect(-13, -62, 26, 10);
      c.fillStyle = "#f8fbfd";
      for (let i = -12; i <= 8; i += 7) c.fillRect(i, -67, 4, 5);
      c.fillStyle = FUR;
      c.fillRect(-3, -76, 6, 9);
      c.fillStyle = FUR_D;
      c.beginPath();
      c.arc(0, -79, 3.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(4, -66);
      c.lineTo(4, -90);
      c.lineTo(15, -86 + Math.sin(t * 3 + s.x) * 1.5);
      c.lineTo(4, -82);
      c.closePath();
      c.fill();
      break;
    }
    case "hall": {
      // the great hall: a long stone house with an ice-block roof ridge, glowing windows, tusks over the door
      shadow(c, 70, 15);
      c.fillStyle = "#7f868f";
      c.fillRect(-66, -40, 132, 40);
      c.strokeStyle = "rgba(55,60,68,0.45)";
      c.lineWidth = 1;
      for (let y = -34; y < 0; y += 8) {
        c.beginPath();
        c.moveTo(-66, y);
        c.lineTo(66, y);
        c.stroke();
      }
      const g = c.createLinearGradient(0, -78, 0, -40);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#bcd4e6");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-72, -40);
      c.lineTo(-40, -76);
      c.lineTo(40, -76);
      c.lineTo(72, -40);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(120,160,190,0.6)";
      for (let x = -36; x <= 36; x += 12) {
        c.beginPath();
        c.moveTo(x, -76);
        c.lineTo(x * 1.6, -40);
        c.stroke();
      }
      c.fillStyle = night ? "rgba(255,190,110,0.9)" : "rgba(40,55,70,0.7)";
      c.beginPath();
      c.ellipse(0, 0, 13, 20, 0, Math.PI, 0);
      c.fill();
      for (const wx of [-46, -26, 26, 46]) c.fillRect(wx - 4, -28, 8, 9);
      c.strokeStyle = "#efe6d2";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-18, 0);
      c.quadraticCurveTo(-26, -22, -6, -32);
      c.moveTo(18, 0);
      c.quadraticCurveTo(26, -22, 6, -32);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, -76);
      c.lineTo(0, -96);
      c.lineTo(13, -92 + Math.sin(t * 3) * 1.5);
      c.lineTo(0, -88);
      c.closePath();
      c.fill();
      for (let i = 0; i < 2; i++) {
        const f = (t * 0.25 + i / 2) % 1;
        c.fillStyle = `rgba(210,215,220,${0.4 * (1 - f)})`;
        c.beginPath();
        c.arc(-30 + f * 6, -78 - f * 30, 4 + f * 7, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "totem": {
      // a carved pole: a bear's head, a ring of the tribe's colour, an ice crystal crown
      c.fillStyle = "#7a5f45";
      c.fillRect(-4, -46, 8, 46);
      c.fillStyle = "#eef1f3";
      c.beginPath();
      c.ellipse(0, -34, 8, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = INK;
      c.fillRect(-3, -35, 1.6, 1.6);
      c.fillRect(1.6, -35, 1.6, 1.6);
      c.fillStyle = col;
      c.fillRect(-5, -22, 10, 3);
      const g = 0.6 + Math.sin(t * 2 + tr.id) * 0.25;
      c.fillStyle = `rgba(200,240,255,${g})`;
      c.beginPath();
      c.moveTo(0, -60);
      c.lineTo(5, -50);
      c.lineTo(0, -44);
      c.lineTo(-5, -50);
      c.closePath();
      c.fill();
      break;
    }
  }
  c.restore();
}
