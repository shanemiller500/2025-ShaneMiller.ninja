/* ------------------------------------------------------------------ */
/*  Everything that isn't a dinosaur: plants, cave people, food,       */
/*  eggs, props, huts, campfires, the stockpile and the volcano.       */
/*  All drawn with their base at (0,0) of the current transform.       */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { SHELTER_STAGES } from "../data/facts";
import type { Stock } from "../sim/camp";
import { PLANT_H } from "../sim/plants";
import type { Egg, Human, Item, Plant, Prop, Shelter } from "../sim/types";
import { shade } from "./drawDino";

const OUT = "rgba(35,28,22,0.5)";
const CHAR = "#3b3430";

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const LEAF = ["#3f7a34", "#4b8a3a", "#5a9a42", "#356b2e"];
const LEAF_LIGHT = ["#5a9a4a", "#68aa52", "#78ba5a", "#4c8a42"];

/* ------------------------------- plants ------------------------------- */

export function drawPlant(c: CanvasRenderingContext2D, p: Plant, t: number, wind: number, lod: boolean) {
  const H = PLANT_H[p.kind] * (0.35 + p.size * 0.65);
  const burnt = p.burnt;
  const leaf = mix(LEAF[p.variant % 4], "#2f2a27", burnt);
  const leafLight = mix(LEAF_LIGHT[p.variant % 4], "#3a3330", burnt);
  const trunk = mix("#7a5534", "#2a2421", burnt);
  const sway = Math.sin(t * 1.6 + p.x * 0.013 + p.variant) * (0.02 + wind * 0.06) + Math.sin(t * 28) * p.shake * 0.1;
  const full = 0.65 + 0.35 * p.food;

  if (p.stump) {
    c.fillStyle = trunk;
    c.beginPath();
    c.ellipse(0, -3, 5, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(-4, -8, 8, 6);
    c.fillStyle = burnt > 0.5 ? CHAR : "#c9a06a";
    c.beginPath();
    c.ellipse(0, -8, 4, 2, 0, 0, Math.PI * 2);
    c.fill();
    return;
  }

  if (lod) {
    c.fillStyle = leaf;
    if (p.kind === "conifer") {
      c.beginPath();
      c.moveTo(-H * 0.25, -H * 0.15);
      c.lineTo(0, -H);
      c.lineTo(H * 0.25, -H * 0.15);
      c.fill();
    } else {
      c.beginPath();
      c.arc(0, -H * 0.6, H * 0.3 * full, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }

  c.save();
  c.rotate(sway);
  switch (p.kind) {
    case "conifer": {
      c.fillStyle = trunk;
      c.fillRect(-H * 0.035, -H * 0.3, H * 0.07, H * 0.3);
      for (let i = 0; i < 3; i++) {
        const y0 = -H * (0.2 + i * 0.25);
        const w = H * (0.3 - i * 0.07) * full;
        c.beginPath();
        c.moveTo(-w, y0);
        c.lineTo(0, y0 - H * 0.38);
        c.lineTo(w, y0);
        c.closePath();
        c.fillStyle = i % 2 ? leaf : leafLight;
        c.fill();
        c.strokeStyle = OUT;
        c.lineWidth = 1;
        c.stroke();
      }
      break;
    }
    case "palm": {
      c.strokeStyle = trunk;
      c.lineWidth = H * 0.07;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(H * 0.18, -H * 0.5, H * 0.08, -H);
      c.stroke();
      c.strokeStyle = shade("#7a5534", -0.3);
      c.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const y = -H * (i / 6);
        c.beginPath();
        c.moveTo(H * 0.06 - 3, y);
        c.lineTo(H * 0.1 + 3, y + 2);
        c.stroke();
      }
      c.strokeStyle = leaf;
      c.lineWidth = H * 0.05 * full;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.55;
        c.beginPath();
        c.moveTo(H * 0.08, -H);
        c.quadraticCurveTo(H * 0.08 + Math.cos(a) * H * 0.3, -H + Math.sin(a) * H * 0.25 - H * 0.08, H * 0.08 + Math.cos(a) * H * 0.42, -H + Math.sin(a) * H * 0.12 + H * 0.12);
        c.stroke();
      }
      if (burnt < 0.5) {
        c.fillStyle = "#6b4a2a";
        c.beginPath();
        c.arc(H * 0.04, -H * 0.95, H * 0.035, 0, Math.PI * 2);
        c.arc(H * 0.12, -H * 0.94, H * 0.035, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "broadleaf":
    case "fruit": {
      c.fillStyle = trunk;
      c.beginPath();
      c.moveTo(-H * 0.05, 0);
      c.lineTo(-H * 0.03, -H * 0.6);
      c.lineTo(H * 0.03, -H * 0.6);
      c.lineTo(H * 0.05, 0);
      c.fill();
      const r = H * 0.26 * full;
      const blobs: [number, number, number][] = [
        [0, -H * 0.72, 1],
        [-r * 0.8, -H * 0.62, 0.8],
        [r * 0.8, -H * 0.62, 0.8],
        [-r * 0.45, -H * 0.85, 0.75],
        [r * 0.45, -H * 0.86, 0.75],
      ];
      c.fillStyle = OUT;
      for (const [x, y, s] of blobs) {
        c.beginPath();
        c.arc(x, y + 1, r * s + 1, 0, Math.PI * 2);
        c.fill();
      }
      for (const [x, y, s] of blobs) {
        c.fillStyle = y < -H * 0.8 ? leafLight : leaf;
        c.beginPath();
        c.arc(x, y, r * s, 0, Math.PI * 2);
        c.fill();
      }
      if (p.kind === "fruit" && burnt < 0.4) {
        c.fillStyle = p.variant % 2 ? "#e2462d" : "#f2a03a";
        for (let i = 0; i < p.fruit; i++) {
          c.beginPath();
          c.arc(-r * 0.7 + i * r * 0.5, -H * 0.6 + ((i * 7) % 3) * r * 0.2, r * 0.13, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case "cycad": {
      c.fillStyle = trunk;
      c.fillRect(-H * 0.09, -H * 0.4, H * 0.18, H * 0.4);
      c.strokeStyle = leaf;
      c.lineWidth = Math.max(1.5, H * 0.06);
      c.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        c.beginPath();
        c.moveTo(0, -H * 0.42);
        c.quadraticCurveTo(Math.cos(a) * H * 0.4, -H * 0.42 + Math.sin(a) * H * 0.5, Math.cos(a) * H * 0.6 * full, -H * 0.42 + Math.sin(a) * H * 0.45 + H * 0.15);
        c.stroke();
      }
      break;
    }
    case "fern": {
      c.strokeStyle = leaf;
      c.lineWidth = Math.max(1.4, H * 0.12);
      c.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.45;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(Math.cos(a) * H * 0.6, Math.sin(a) * H * 1.1, Math.cos(a) * H * 1.1 * full, Math.sin(a) * H * 0.5);
        c.stroke();
      }
      break;
    }
    case "bush": {
      const r = H * 0.38 * full;
      c.fillStyle = OUT;
      c.beginPath();
      c.arc(-r * 0.6, -r * 0.7, r + 1, 0, Math.PI * 2);
      c.arc(r * 0.6, -r * 0.7, r + 1, 0, Math.PI * 2);
      c.arc(0, -r * 1.2, r + 1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = leaf;
      c.beginPath();
      c.arc(-r * 0.6, -r * 0.7, r, 0, Math.PI * 2);
      c.arc(r * 0.6, -r * 0.7, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = leafLight;
      c.beginPath();
      c.arc(0, -r * 1.2, r, 0, Math.PI * 2);
      c.fill();
      if (p.food > 0.5 && burnt < 0.3) {
        c.fillStyle = "#7b3fa0";
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.arc(-r + ((i * 37) % 10) / 10 * r * 2, -r * 0.5 - ((i * 53) % 10) / 10 * r * 1.1, Math.max(1.2, r * 0.13), 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case "reeds": {
      c.strokeStyle = leaf;
      c.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 3;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + Math.sin(t * 2 + i) * 2, -H * (0.7 + (i % 2) * 0.3));
        c.stroke();
      }
      c.fillStyle = "#6b4528";
      for (let i = 0; i < 5; i += 2) {
        const x = (i - 2) * 3 + Math.sin(t * 2 + i) * 2;
        c.fillRect(x - 1.5, -H * (0.7 + (i % 2) * 0.3) - 1, 3, 6);
      }
      break;
    }
    case "horsetail": {
      c.strokeStyle = leaf;
      c.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 5;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, -H * (0.75 + i * 0.12));
        c.stroke();
      }
      c.strokeStyle = shade("#3f7a34", -0.4);
      c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        for (let j = 1; j < 5; j++) {
          const x = (i - 1) * 5;
          const y = -H * (0.75 + i * 0.12) * (j / 5);
          c.beginPath();
          c.moveTo(x - 2.5, y);
          c.lineTo(x + 2.5, y);
          c.stroke();
        }
      }
      break;
    }
  }
  c.restore();
}

/* ------------------------------- people ------------------------------- */

export function drawHuman(c: CanvasRenderingContext2D, h: Human, t: number, hasSpear: boolean) {
  const H = h.child ? 18 : 26;
  const st = h.state;
  c.save();
  if (st === "tossed") {
    c.translate(0, -H * 0.5);
    c.rotate(t * 12);
    c.translate(0, H * 0.5);
  }
  if (st === "sleep") {
    c.rotate(-Math.PI / 2 * h.dir);
    c.translate(-H * 0.1 * h.dir, -2);
  }
  c.scale(h.dir, 1);
  const moving = st === "walk" || st === "carry" || st === "flee" || st === "explore";
  const sw = moving ? Math.sin(h.anim * 2.2) : 0;
  const sit = st === "sitFire" || st === "craft";
  const bend = st === "gather" ? 0.5 : st === "build" ? 0.2 : 0;
  const hipY = sit ? -H * 0.22 : -H * 0.42;

  // legs
  c.strokeStyle = shade(h.skin, -0.15);
  c.lineWidth = H * 0.11;
  c.lineCap = "round";
  c.beginPath();
  if (sit) {
    c.moveTo(-H * 0.05, hipY);
    c.lineTo(H * 0.2, hipY + H * 0.05);
    c.lineTo(H * 0.22, 0);
    c.moveTo(H * 0.02, hipY);
    c.lineTo(H * 0.26, hipY + H * 0.02);
    c.lineTo(H * 0.3, 0);
  } else {
    c.moveTo(-H * 0.04, hipY);
    c.lineTo(-H * 0.04 + sw * H * 0.18, 0);
    c.moveTo(H * 0.04, hipY);
    c.lineTo(H * 0.04 - sw * H * 0.18, 0);
  }
  c.stroke();

  c.save();
  c.translate(0, hipY);
  c.rotate(bend + (st === "celebrate" ? Math.sin(t * 10) * 0.1 : 0));
  // tunic
  c.beginPath();
  c.moveTo(-H * 0.16, -H * 0.4);
  c.lineTo(H * 0.16, -H * 0.4);
  c.lineTo(H * 0.2, H * 0.06);
  for (let i = 0; i < 5; i++) c.lineTo(H * (0.2 - i * 0.1) - H * 0.05, H * (i % 2 ? 0.02 : 0.1));
  c.lineTo(-H * 0.2, H * 0.06);
  c.closePath();
  c.fillStyle = h.fur;
  c.fill();
  c.strokeStyle = OUT;
  c.lineWidth = 0.8;
  c.stroke();
  c.fillStyle = shade(h.fur, -0.25);
  c.beginPath();
  c.arc(-H * 0.05, -H * 0.15, H * 0.04, 0, Math.PI * 2);
  c.arc(H * 0.08, -H * 0.05, H * 0.035, 0, Math.PI * 2);
  c.fill();

  // arms
  c.strokeStyle = h.skin;
  c.lineWidth = H * 0.09;
  c.beginPath();
  const shY = -H * 0.36;
  if (st === "celebrate" || st === "lookUp" || st === "tossed") {
    c.moveTo(-H * 0.12, shY);
    c.lineTo(-H * 0.22, shY - H * 0.32);
    c.moveTo(H * 0.12, shY);
    c.lineTo(H * 0.24, shY - H * 0.3);
  } else if (st === "build" || st === "craft" || st === "gather") {
    const a = Math.sin(t * 12) * 0.6;
    c.moveTo(H * 0.1, shY);
    c.lineTo(H * 0.1 + Math.cos(a) * H * 0.3, shY + Math.sin(a) * H * 0.3 + H * 0.1);
    c.moveTo(-H * 0.1, shY);
    c.lineTo(H * 0.05, shY + H * 0.3);
  } else if (h.carry) {
    c.moveTo(-H * 0.12, shY);
    c.lineTo(-H * 0.14, shY - H * 0.3);
    c.moveTo(H * 0.12, shY);
    c.lineTo(H * 0.14, shY - H * 0.3);
  } else {
    c.moveTo(-H * 0.12, shY);
    c.lineTo(-H * 0.12 - sw * H * 0.15, shY + H * 0.32);
    c.moveTo(H * 0.12, shY);
    c.lineTo(H * 0.12 + sw * H * 0.15, shY + H * 0.32);
  }
  c.stroke();

  // spear / fishing pole
  if ((hasSpear && !h.child && !h.carry && (st === "idle" || st === "walk" || st === "flee" || st === "talk")) || st === "fish") {
    c.strokeStyle = "#8a6238";
    c.lineWidth = 1.4;
    c.beginPath();
    if (st === "fish") {
      c.moveTo(H * 0.1, shY + H * 0.2);
      c.lineTo(H * 0.85, shY - H * 0.15);
      c.stroke();
      c.strokeStyle = "rgba(240,240,240,0.7)";
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(H * 0.85, shY - H * 0.15);
      c.lineTo(H * 0.95, H * 0.42 + Math.sin(t * 3) * 1.5);
    } else {
      c.moveTo(H * 0.15, H * 0.2);
      c.lineTo(H * 0.3, -H * 0.95);
    }
    c.stroke();
    if (st !== "fish") {
      c.fillStyle = "#8f8a82";
      c.beginPath();
      c.moveTo(H * 0.27, -H * 0.95);
      c.lineTo(H * 0.32, -H * 1.12);
      c.lineTo(H * 0.35, -H * 0.93);
      c.fill();
    }
  }

  // head
  const headY = -H * 0.52 + (st === "lookUp" ? -H * 0.02 : 0);
  c.fillStyle = h.skin;
  c.beginPath();
  c.arc(0, headY, H * 0.15, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = OUT;
  c.lineWidth = 0.7;
  c.stroke();
  c.fillStyle = h.hair;
  c.beginPath();
  c.arc(-H * 0.02, headY - H * 0.04, H * 0.16, Math.PI * 0.9, Math.PI * 2.05);
  c.fill();
  c.beginPath();
  c.ellipse(-H * 0.12, headY + H * 0.04, H * 0.06, H * 0.13, 0.3, 0, Math.PI * 2);
  c.fill();
  if (st !== "sleep") {
    c.fillStyle = "#1d1813";
    c.beginPath();
    c.arc(H * 0.07, headY + (st === "lookUp" ? -H * 0.05 : -H * 0.01), H * 0.028, 0, Math.PI * 2);
    c.fill();
  }
  if (st === "flee" || st === "tossed") {
    c.fillStyle = "#4a1d1d";
    c.beginPath();
    c.ellipse(H * 0.1, headY + H * 0.07, H * 0.03, H * 0.04, 0, 0, Math.PI * 2);
    c.fill();
  }
  // carried stuff
  if (h.carry) drawResource(c, h.carry, 0, headY - H * 0.32, H * 0.5);
  c.restore();
  c.restore();
}

export function drawResource(c: CanvasRenderingContext2D, r: string, x: number, y: number, s: number) {
  c.save();
  c.translate(x, y);
  switch (r) {
    case "stick":
      c.strokeStyle = "#7a5534";
      c.lineWidth = s * 0.18;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-s * 0.7, s * 0.1);
      c.lineTo(s * 0.7, -s * 0.15);
      c.moveTo(-s * 0.6, -s * 0.15);
      c.lineTo(s * 0.6, s * 0.15);
      c.stroke();
      break;
    case "wood":
      c.fillStyle = "#8a5f38";
      c.fillRect(-s * 0.8, -s * 0.25, s * 1.6, s * 0.5);
      c.fillStyle = "#d2a56e";
      c.beginPath();
      c.ellipse(s * 0.8, 0, s * 0.12, s * 0.25, 0, 0, Math.PI * 2);
      c.fill();
      break;
    case "stone":
      c.fillStyle = "#8f8a82";
      c.beginPath();
      c.ellipse(0, 0, s * 0.4, s * 0.3, 0.3, 0, Math.PI * 2);
      c.fill();
      break;
    case "grass":
    case "leaves":
      c.strokeStyle = r === "grass" ? "#b8c46a" : "#4f8a3a";
      c.lineWidth = s * 0.12;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo((i - 2) * s * 0.12, s * 0.2);
        c.lineTo((i - 2) * s * 0.22, -s * 0.4);
        c.stroke();
      }
      break;
    case "fish":
      drawFish(c, 0, 0, s * 0.9, "#7aa3c4");
      break;
    case "berries":
      c.fillStyle = "#7b3fa0";
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc((i - 1.5) * s * 0.18, (i % 2) * s * 0.15, s * 0.14, 0, Math.PI * 2);
        c.fill();
      }
      break;
  }
  c.restore();
}

export function drawFish(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, s * 0.5, s * 0.22, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(x - s * 0.45, y);
  c.lineTo(x - s * 0.75, y - s * 0.2);
  c.lineTo(x - s * 0.75, y + s * 0.2);
  c.closePath();
  c.fill();
  c.fillStyle = "#1d1813";
  c.beginPath();
  c.arc(x + s * 0.3, y - s * 0.04, s * 0.05, 0, Math.PI * 2);
  c.fill();
}

/* ------------------------------- items ------------------------------- */

export function drawItem(c: CanvasRenderingContext2D, it: Item, t: number) {
  const s = it.kind === "meat" ? 10 + Math.min(3, it.amount) * 3 : 9;
  const bob = it.z;
  c.save();
  c.translate(0, -bob);
  switch (it.kind) {
    case "meat":
      c.strokeStyle = "#f3ead2";
      c.lineWidth = s * 0.28;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(s * 0.2, -s * 0.3);
      c.lineTo(s * 0.8, -s * 0.6);
      c.stroke();
      c.fillStyle = "#f3ead2";
      c.beginPath();
      c.arc(s * 0.85, -s * 0.72, s * 0.14, 0, Math.PI * 2);
      c.arc(s * 0.95, -s * 0.55, s * 0.14, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#b5523a";
      c.beginPath();
      c.ellipse(0, -s * 0.25, s * 0.55 * Math.max(0.4, Math.min(1, it.amount)), s * 0.35, -0.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#d9785a";
      c.beginPath();
      c.ellipse(-s * 0.1, -s * 0.35, s * 0.25, s * 0.12, -0.4, 0, Math.PI * 2);
      c.fill();
      break;
    case "fish":
      drawFish(c, 0, -4, 14, "#7aa3c4");
      break;
    case "fruit":
      c.fillStyle = "#e2462d";
      c.beginPath();
      c.arc(0, -4, 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#4f8a3a";
      c.beginPath();
      c.ellipse(2, -8.5, 2.5, 1.2, -0.5, 0, Math.PI * 2);
      c.fill();
      break;
    case "berries":
      drawResource(c, "berries", 0, -4, 12);
      break;
    case "poop": {
      const k = Math.min(1.5, it.amount);
      c.fillStyle = "#6b4a2a";
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(0, -i * 3 * k, (5 - i * 1.4) * k, 2.4 * k, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = "rgba(140,170,80,0.6)";
      c.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        const x = (i - 0.5) * 6;
        c.moveTo(x, -10 * k);
        c.quadraticCurveTo(x + Math.sin(t * 3 + i) * 3, -14 * k, x, -18 * k);
        c.stroke();
      }
      break;
    }
    case "fossil":
      c.strokeStyle = "#efe6cf";
      c.lineWidth = 2.5;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-14, -3);
      c.lineTo(14, -3);
      for (let i = -10; i <= 8; i += 4) {
        c.moveTo(i, -3);
        c.quadraticCurveTo(i + 1, -10, i + 3, -11);
      }
      c.stroke();
      c.fillStyle = "#efe6cf";
      c.beginPath();
      c.ellipse(17, -5, 5, 3.5, 0.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#3a3330";
      c.beginPath();
      c.arc(18, -6, 1.2, 0, Math.PI * 2);
      c.fill();
      break;
    case "stick":
      drawResource(c, "stick", 0, -3, 12);
      break;
    case "stone":
      drawResource(c, "stone", 0, -3, 12);
      break;
  }
  c.restore();
}

export function drawEgg(c: CanvasRenderingContext2D, e: Egg, t: number) {
  const def = sp(e.species);
  const s = 6 + Math.min(10, def.size / 12);
  const left = e.hatchAt - e.t;
  const wob = left < 8 ? Math.sin(t * (left < 3 ? 30 : 14)) * (left < 3 ? 0.3 : 0.15) : 0;
  c.save();
  c.rotate(wob);
  c.fillStyle = "#f3ead2";
  c.strokeStyle = OUT;
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(0, -s * 0.65, s * 0.5, s * 0.68, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = def.look.accent;
  c.globalAlpha *= 0.55;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.arc(Math.cos(i * 2.1) * s * 0.25, -s * 0.65 + Math.sin(i * 1.7) * s * 0.35, s * 0.08, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha /= 0.55;
  if (left < 4) {
    c.strokeStyle = "#3a3330";
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(-s * 0.3, -s * 0.8);
    c.lineTo(-s * 0.1, -s * 0.65);
    c.lineTo(s * 0.05, -s * 0.85);
    c.lineTo(s * 0.25, -s * 0.7);
    c.stroke();
  }
  c.restore();
}

/* ------------------------------- props ------------------------------- */

export function drawProp(c: CanvasRenderingContext2D, p: Prop, t: number) {
  switch (p.kind) {
    case "boulder": {
      const s = 16 * p.size;
      c.fillStyle = "#8a8378";
      c.strokeStyle = OUT;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-s, 0);
      c.lineTo(-s * 0.9, -s * 0.7);
      c.lineTo(-s * 0.3, -s * 1.1);
      c.lineTo(s * 0.5, -s * 0.95);
      c.lineTo(s, -s * 0.4);
      c.lineTo(s * 0.9, 0);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.22)";
      c.beginPath();
      c.moveTo(-s * 0.7, -s * 0.7);
      c.lineTo(-s * 0.25, -s * 1.0);
      c.lineTo(s * 0.2, -s * 0.85);
      c.lineTo(-s * 0.3, -s * 0.55);
      c.fill();
      break;
    }
    case "fossilDig": {
      c.fillStyle = "#8a6a44";
      c.beginPath();
      c.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
      c.fill();
      if (!p.found) {
        c.strokeStyle = "#efe6cf";
        c.lineWidth = 3;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(-8, -2);
        c.lineTo(6, -12);
        c.stroke();
        c.fillStyle = "#efe6cf";
        c.beginPath();
        c.arc(7, -13, 3, 0, Math.PI * 2);
        c.fill();
        // little survey flag
        c.strokeStyle = "#5a4a3a";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(18, 2);
        c.lineTo(18, -22);
        c.stroke();
        c.fillStyle = "#e2462d";
        c.beginPath();
        c.moveTo(18, -22);
        c.lineTo(28, -18 + Math.sin(t * 4) * 1.5);
        c.lineTo(18, -14);
        c.fill();
      } else {
        c.fillStyle = "#5a4430";
        c.beginPath();
        c.ellipse(0, -1, 16, 6, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "painting": {
      if (p.found) {
        c.fillStyle = "rgba(190,80,50,0.85)";
        for (const [x, y] of [[-10, -26], [6, -30], [-2, -36]]) {
          c.beginPath();
          c.ellipse(x, y, 3, 4, 0, 0, Math.PI * 2);
          c.fill();
          for (let f = 0; f < 4; f++) c.fillRect(x - 3 + f * 1.8, y - 8, 1.2, 4);
        }
      }
      // a faint glint hints at the secret
      const a = 0.4 + Math.sin(t * 2) * 0.3;
      c.fillStyle = `rgba(255,240,180,${a})`;
      c.font = "12px serif";
      c.textAlign = "center";
      c.fillText("✦", 12, -16);
      break;
    }
    case "goldEgg": {
      if (p.found) break;
      const g = c.createLinearGradient(-8, -22, 8, 0);
      g.addColorStop(0, "#fff3a8");
      g.addColorStop(0.5, "#f2c230");
      g.addColorStop(1, "#b8860b");
      c.fillStyle = g;
      c.strokeStyle = "rgba(90,60,10,0.6)";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, -11, 8, 11, Math.sin(t * 2) * 0.05, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      const s = (Math.sin(t * 3) + 1) / 2;
      c.fillStyle = `rgba(255,255,255,${0.5 + s * 0.5})`;
      c.font = `${8 + s * 4}px serif`;
      c.textAlign = "center";
      c.fillText("✦", 7, -18);
      break;
    }
    case "nest": {
      c.strokeStyle = "rgba(110,80,45,0.8)";
      c.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * 112, Math.sin(a) * 70);
        c.lineTo(Math.cos(a + 0.3) * 124, Math.sin(a + 0.3) * 78);
        c.stroke();
      }
      break;
    }
    case "spire":
      break;
  }
}

/* ------------------------------- camp ------------------------------- */

export function drawShelter(c: CanvasRenderingContext2D, s: Shelter, night: boolean) {
  const W = 46;
  const H = 40;
  const stage = s.stage;
  if (stage === 0) {
    c.strokeStyle = "rgba(255,255,255,0.75)";
    c.setLineDash([4, 4]);
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(0, 0, W * 0.6, W * 0.25, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#7a5534";
    for (const x of [-W * 0.45, 0, W * 0.45]) c.fillRect(x - 1.5, -8, 3, 8);
  }
  if (stage >= 4) {
    c.fillStyle = "#8f8a82";
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (i / 8);
      c.beginPath();
      c.ellipse(Math.cos(a) * W * 0.62, Math.sin(a) * W * 0.12 + 2, 4, 3, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (stage >= 1) {
    c.strokeStyle = "#6b4a2a";
    c.lineWidth = 3;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-W * 0.5, 0);
    c.lineTo(W * 0.08, -H - 4);
    c.moveTo(W * 0.5, 0);
    c.lineTo(-W * 0.08, -H - 4);
    c.moveTo(0, 2);
    c.lineTo(0, -H);
    c.stroke();
  }
  if (stage >= 2) {
    c.fillStyle = "#8a6238";
    c.beginPath();
    c.moveTo(-W * 0.48, 0);
    c.lineTo(0, -H * 0.92);
    c.lineTo(W * 0.48, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(60,40,20,0.6)";
    c.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = -H * 0.92 * (i / 6);
      const w = W * 0.48 * (1 - i / 6);
      c.beginPath();
      c.moveTo(-w, y);
      c.lineTo(w, y);
      c.stroke();
    }
  }
  if (stage >= 3) {
    c.fillStyle = "#5f8f3a";
    c.beginPath();
    c.moveTo(-W * 0.58, 2);
    c.lineTo(0, -H * 1.02);
    c.lineTo(W * 0.58, 2);
    c.quadraticCurveTo(0, -H * 0.25, -W * 0.58, 2);
    c.fill();
    c.fillStyle = "#4b7a30";
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.ellipse(-W * 0.36 + i * W * 0.12, -H * 0.3 - Math.abs(3 - i) * -H * 0.08 - H * 0.1, 6, 3, 0.4, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (stage >= 2) {
    c.fillStyle = night ? "rgba(255,190,90,0.9)" : "#2b1e14";
    c.beginPath();
    c.moveTo(-8, 0);
    c.quadraticCurveTo(0, -24, 8, 0);
    c.fill();
  }
  if (stage < SHELTER_STAGES.length && stage > 0) {
    c.strokeStyle = "rgba(255,255,255,0.6)";
    c.setLineDash([3, 3]);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-W * 0.58, 2);
    c.lineTo(0, -H * 1.02);
    c.lineTo(W * 0.58, 2);
    c.stroke();
    c.setLineDash([]);
  }
}

export function drawCampfire(c: CanvasRenderingContext2D, lit: boolean, t: number, scale = 1) {
  c.save();
  c.scale(scale, scale);
  c.fillStyle = "#8f8a82";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.beginPath();
    c.ellipse(Math.cos(a) * 13, Math.sin(a) * 6, 4, 3, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "#5a3d24";
  c.lineWidth = 3.5;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-9, 2);
  c.lineTo(8, -4);
  c.moveTo(-8, -4);
  c.lineTo(9, 2);
  c.stroke();
  if (lit) drawFlame(c, 0, -2, 1, t);
  else {
    c.fillStyle = "#4a4440";
    c.beginPath();
    c.ellipse(0, -1, 7, 3, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

export function drawFlame(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const f1 = Math.sin(t * 13 + x) * 0.15 + 1;
  const f2 = Math.sin(t * 17 + x * 1.3) * 0.15 + 1;
  c.fillStyle = "#ff7a1f";
  c.beginPath();
  c.moveTo(x - 7 * s, y);
  c.quadraticCurveTo(x - 7 * s, y - 12 * s * f1, x + Math.sin(t * 9) * 2 * s, y - 22 * s * f1);
  c.quadraticCurveTo(x + 7 * s, y - 12 * s * f2, x + 7 * s, y);
  c.closePath();
  c.fill();
  c.fillStyle = "#ffd447";
  c.beginPath();
  c.moveTo(x - 4 * s, y);
  c.quadraticCurveTo(x - 4 * s, y - 7 * s * f2, x + Math.sin(t * 11) * s, y - 13 * s * f2);
  c.quadraticCurveTo(x + 4 * s, y - 7 * s * f1, x + 4 * s, y);
  c.closePath();
  c.fill();
}

export function drawStockpile(c: CanvasRenderingContext2D, stock: Stock) {
  const piles: [keyof Stock, number][] = [
    ["stick", -34],
    ["stone", -14],
    ["grass", 6],
    ["leaves", 24],
    ["wood", 44],
    ["fish", 62],
    ["berries", 78],
  ];
  for (const [r, x] of piles) {
    const n = Math.min(8, stock[r]);
    for (let i = 0; i < n; i++) {
      drawResource(c, r, x + (i % 3) * 3 - 3, -3 - Math.floor(i / 3) * 4, 12);
    }
  }
  // drying rack
  c.strokeStyle = "#6b4a2a";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-46, 0);
  c.lineTo(-46, -20);
  c.moveTo(90, 0);
  c.lineTo(90, -20);
  c.moveTo(-48, -18);
  c.lineTo(92, -18);
  c.stroke();
}

/* ------------------------------- volcano ------------------------------- */

export function drawVolcano(c: CanvasRenderingContext2D, glow: number, lavaOn: boolean, t: number) {
  // base sits at y = +150 (the cone's foot), crater at y = -150 (z 150 above center)
  const baseY = 150;
  const R = 420;
  const top = -150;
  const g = c.createLinearGradient(0, top, 0, baseY);
  g.addColorStop(0, "#4a3428");
  g.addColorStop(0.55, "#6b4b38");
  g.addColorStop(1, "rgba(110,78,60,0)");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-R, baseY);
  c.quadraticCurveTo(-R * 0.35, baseY - 60, -70, top + 8);
  c.lineTo(70, top + 8);
  c.quadraticCurveTo(R * 0.35, baseY - 60, R, baseY);
  c.closePath();
  c.fill();
  // ridges
  c.strokeStyle = "rgba(40,26,20,0.35)";
  c.lineWidth = 3;
  for (let i = -4; i <= 4; i++) {
    c.beginPath();
    c.moveTo(i * 14, top + 14);
    c.quadraticCurveTo(i * 50, baseY - 120, i * 85, baseY - 30);
    c.stroke();
  }
  // lava streaks during an eruption
  if (lavaOn) {
    c.strokeStyle = `rgba(255,${120 + Math.sin(t * 6) * 30},40,0.9)`;
    c.lineWidth = 6;
    c.lineCap = "round";
    for (const i of [-2, 1, 3]) {
      c.beginPath();
      c.moveTo(i * 12, top + 12);
      c.quadraticCurveTo(i * 40, top + 120, i * 60 + Math.sin(t + i) * 6, top + 210);
      c.stroke();
    }
  }
  // crater
  c.fillStyle = "#2e211b";
  c.beginPath();
  c.ellipse(0, top + 8, 72, 20, 0, 0, Math.PI * 2);
  c.fill();
  const rg = c.createRadialGradient(0, top + 8, 4, 0, top + 8, 70);
  rg.addColorStop(0, `rgba(255,220,120,${0.9 * glow})`);
  rg.addColorStop(0.5, `rgba(255,110,30,${0.75 * glow})`);
  rg.addColorStop(1, "rgba(255,80,20,0)");
  c.fillStyle = rg;
  c.beginPath();
  c.ellipse(0, top + 8, 66, 17, 0, 0, Math.PI * 2);
  c.fill();
}
