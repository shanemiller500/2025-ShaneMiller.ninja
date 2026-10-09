/* Drawn faces for the moving rig. Source portraits remain UI/reference art. */
import type { FighterState, Look } from "../engine/types";

type Ctx = CanvasRenderingContext2D;
type Point = [number, number];
type Mask = "spider" | "deadpool" | "panther" | "venom" | "iron" | "cap" | "wolverine" | "none";

const ink = "#0b101a";
const white = "#f5f8ff";
const line = (ctx: Ctx, pts: Point[], color: string, width: number, close = false) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
};
const fill = (ctx: Ctx, pts: Point[], color: string, stroke = ink, width = 0.055) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (width) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.stroke(); }
};
const oval = (ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, angle = 0) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
};
const maskOf = (look: Look, name: string): Mask => {
  if (look.webLines || name === "Spider-Man") return "spider";
  if (name === "Deadpool") return "deadpool";
  if (look.headgear === "panther" || name === "Black Panther") return "panther";
  if (name === "Venom" || look.emblem === "#f1f5f9") return "venom";
  if (name === "Iron Man") return "iron";
  if (look.headgear === "cap") return "cap";
  if (look.headgear === "wolverine") return "wolverine";
  return "none";
};
const hairOf = (look: Look, name: string) => look.hair ?? ({
  Thor: "#d4b06b", Hulk: "#18221c", "Doctor Strange": "#222632",
  "Captain America": "#c8a063", Wolverine: "#20242b", Magneto: "#d0d4df",
  Thanos: "#7458a0",
} as Record<string, string>)[name] ?? "#2a2323";

function faceFeatures(ctx: Ctx, look: Look, name: string, facing: number, state: FighterState) {
  const hurt = ["hit", "launched", "thrown", "defeated"].includes(state);
  const attack = state === "attack";
  const happy = state === "victory";
  const big = name === "Hulk" || name === "Thanos" || look.faceShape === "square";
  const variant = look.faceVariant ?? 4;
  const eyeX = 0.31 + ((variant % 3) - 1) * 0.035;
  const noseDepth = 0.18 + (variant % 4) * 0.025;
  const mouthX = 0.18 + (variant % 3) * 0.025;
  const eyeY = big ? -0.06 : -0.12;
  const squint = attack || hurt ? 0.055 : 0;
  // Brows are separate from eyes so anger and recoil remain readable at game scale.
  for (const s of [-1, 1]) {
    line(ctx, [[s * (eyeX - 0.18), eyeY - 0.16], [s * (eyeX + 0.13), eyeY - (attack ? 0.23 : 0.2 + (variant % 2) * 0.025)], [s * (eyeX + 0.27), eyeY - 0.15]], ink, big ? 0.11 : 0.08);
    oval(ctx, s * (eyeX + 0.03), eyeY, 0.17, Math.max(0.07, 0.11 - squint), white);
    oval(ctx, s * eyeX + facing * 0.025, eyeY, 0.055, 0.075, look.eyeColor ?? "#694b37");
    oval(ctx, s * eyeX + facing * 0.025, eyeY, 0.024, 0.04, ink);
  }
  // A side-lit nose, cheek planes and asymmetric jaw are more legible than tiny photo texture.
  fill(ctx, [[0.01, -0.04], [facing * 0.1, noseDepth], [-facing * 0.03, noseDepth + 0.06], [-0.12, 0.19]], "rgba(10,13,24,0.22)", "transparent", 0);
  line(ctx, [[facing * 0.11, noseDepth], [facing * 0.02, noseDepth + 0.06], [-facing * 0.08, noseDepth + 0.04]], ink, 0.055);
  line(ctx, [[-0.48, 0.12], [-0.6, 0.28]], "rgba(10,13,24,0.35)", 0.055);
  line(ctx, [[0.48, 0.12], [0.6, 0.27]], "rgba(10,13,24,0.35)", 0.055);
  if (name === "Doctor Strange") {
    fill(ctx, [[-0.29, 0.34], [0, 0.39], [0.29, 0.34], [0.18, 0.47], [0, 0.43], [-0.18, 0.47]], "#20232e", ink, 0.025);
    fill(ctx, [[-0.16, 0.49], [0.16, 0.49], [0.1, 0.7], [0, 0.78], [-0.1, 0.7]], "#252833", ink, 0.025);
  } else if (name === "Thor" || name === "Wolverine") {
    fill(ctx, [[-0.5, 0.36], [-0.3, 0.56], [0, 0.64], [0.3, 0.56], [0.5, 0.36], [0.37, 0.74], [0, 0.9], [-0.37, 0.74]], name === "Thor" ? "#8b5b39" : "#3a2d26", ink, 0.025);
  } else if (name === "Thanos") {
    for (const x of [-0.25, -0.08, 0.1, 0.27]) line(ctx, [[x, 0.52], [x * 0.75, 0.84]], "rgba(35,25,70,0.55)", 0.045);
  }
  if (name === "Hulk" && !hurt) {
    fill(ctx, [[-0.28, 0.42], [0.28, 0.42], [0.2, 0.61], [-0.2, 0.61]], "#23322a", ink, 0.045);
    fill(ctx, [[-0.22, 0.45], [0.22, 0.45], [0.16, 0.5], [-0.16, 0.5]], white, "transparent", 0);
    line(ctx, [[-0.36, 0.39], [-0.24, 0.33]], ink, 0.065);
    line(ctx, [[0.36, 0.39], [0.24, 0.33]], ink, 0.065);
  } else if (name === "Thanos" && !hurt) {
    line(ctx, [[-0.24, 0.52], [0.04, 0.55], [0.28, 0.45]], "#2b2147", 0.09);
  } else if (attack) {
    oval(ctx, 0, 0.49, 0.22, 0.13, ink);
    fill(ctx, [[-0.18, 0.44], [0.18, 0.44], [0.13, 0.49], [-0.13, 0.49]], white, "transparent", 0);
  } else if (hurt) {
    line(ctx, [[-0.2, 0.48], [0.08, 0.53], [0.22, 0.49]], ink, 0.085);
  } else {
    ctx.beginPath();
    ctx.moveTo(-mouthX, 0.49);
    ctx.quadraticCurveTo(0, happy ? 0.64 : 0.53, mouthX + 0.02, happy ? 0.46 : 0.48);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.065;
    ctx.stroke();
  }
}

function hair(ctx: Ctx, look: Look, name: string, facing: number) {
  if (name === "Thanos" || look.headgear === "magneto") return;
  const style = name === "Thor" ? "long" : name === "Hulk" ? "spiked" : name === "Doctor Strange" ? "swept" : look.hairStyle ?? "short";
  if (style === "shaved") {
    line(ctx, [[-0.74, -0.64], [-0.4, -0.91], [0.31, -0.96], [0.75, -0.68]], "rgba(20,20,30,0.38)", 0.09);
    return;
  }
  const color = hairOf(look, name);
  const sweep = facing * (name.length % 3 === 0 ? 0.2 : -0.06);
  const top: Point[] = style === "spiked"
    ? [[-0.88, -0.2], [-0.98, -0.88], [-0.62, -0.78], [-0.54, -1.2], [-0.2, -0.95], [0.16, -1.3], [0.34, -1], [0.69, -1.1], [0.83, -0.72], [0.91, -0.48]]
    : style === "swept"
      ? [[-0.88, -0.2], [-0.96, -0.59], [-0.75, -0.93], [-0.3, -1.08], [0.22, -1.12], [0.78, -0.96], [0.96, -0.71], [0.9, -0.44]]
      : [[-0.88, -0.2], [-0.96, -0.59], [-0.75, -0.93], [-0.3, -1.08], [0.22, -1.12], [0.72, -0.9], [0.91, -0.48]];
  fill(ctx, [...top, [0.82, -0.08], [0.63, -0.5], [0.2 + sweep, style === "swept" ? -0.48 : -0.67], [-0.12, -0.55], [-0.45, -0.39], [-0.73, -0.13]], color, ink, 0.06);
  line(ctx, [[-0.48, -0.85], [-0.14, -0.92], [0.3 + sweep, -0.78]], "rgba(255,255,255,0.2)", 0.07);
  if (style === "long" || look.body === "female") {
    fill(ctx, [[0.66, -0.5], [0.87, -0.57], [1.04, -0.1], [0.97, 0.58], [0.73, 0.95], [0.64, 0.42]], color, ink, 0.055);
    fill(ctx, [[-0.68, -0.52], [-0.86, -0.58], [-1.04, -0.08], [-0.97, 0.58], [-0.76, 0.86], [-0.65, 0.27]], color, ink, 0.055);
  }
  if (name === "Doctor Strange") {
    fill(ctx, [[-0.88, -0.35], [-0.68, -0.73], [-0.55, -0.52], [-0.68, -0.1]], "#b8bdc7", "transparent", 0);
    fill(ctx, [[0.88, -0.35], [0.68, -0.73], [0.55, -0.52], [0.68, -0.1]], "#b8bdc7", "transparent", 0);
  }
}

function whiteEye(ctx: Ctx, s: number, inner: Point, outer: Point, tip: Point, width = 0.055) {
  fill(ctx, [inner, [s * 0.36, inner[1] - 0.08], outer, tip, [s * 0.34, inner[1] + 0.12]], white, ink, width);
}

function maskFeatures(ctx: Ctx, mask: Mask, look: Look, facing: number, state: FighterState) {
  const attack = state === "attack";
  if (mask === "spider") {
    for (const x of [-0.67, -0.36, 0, 0.36, 0.67]) line(ctx, [[x * 0.7, -1], [x, 0.8]], "rgba(15,20,35,0.58)", 0.037);
    for (const y of [-0.63, -0.34, 0.02, 0.4, 0.7]) {
      ctx.beginPath(); ctx.ellipse(0, y, 0.75 * (1 - Math.abs(y) * 0.2), 0.22, 0, 0, Math.PI);
      ctx.strokeStyle = "rgba(15,20,35,0.55)"; ctx.lineWidth = 0.035; ctx.stroke();
    }
    for (const s of [-1, 1]) whiteEye(ctx, s, [s * 0.08, -0.13], [s * 0.76, -0.52], [s * 0.56, attack ? 0.06 : 0.22], 0.09);
  } else if (mask === "deadpool") {
    for (const s of [-1, 1]) {
      fill(ctx, [[s * 0.07, -0.42], [s * 0.74, -0.59], [s * 0.72, 0.35], [s * 0.16, 0.28]], "#17181d", ink, 0.04);
      whiteEye(ctx, s, [s * 0.15, -0.14], [s * 0.57, -0.22], [s * 0.49, attack ? -0.06 : 0.02]);
    }
    line(ctx, [[-0.18, 0.53], [0.18, 0.53]], "#34151c", 0.06);
  } else if (mask === "panther") {
    for (const s of [-1, 1]) {
      whiteEye(ctx, s, [s * 0.12, -0.12], [s * 0.68, -0.29], [s * 0.56, 0.02], 0.055);
      line(ctx, [[s * 0.46, 0.18], [s * 0.68, 0.35], [s * 0.38, 0.44]], look.accent, 0.055);
    }
    fill(ctx, [[-0.13, 0.25], [0.13, 0.25], [0, 0.46]], "#30303a", ink, 0.035);
    line(ctx, [[-0.34, 0.65], [0, 0.8], [0.34, 0.65]], look.accent, 0.04);
  } else if (mask === "venom") {
    for (const s of [-1, 1]) whiteEye(ctx, s, [s * 0.03, -0.32], [s * 0.82, -0.57], [s * 0.54, 0.2], 0.07);
    fill(ctx, [[-0.65, 0.28], [0.65, 0.28], [0.52, 0.72], [0, 0.89], [-0.52, 0.72]], "#8d1e2a", ink, 0.06);
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.14;
      fill(ctx, [[x - 0.055, 0.31], [x + 0.055, 0.31], [x, 0.53]], white, "transparent", 0);
    }
  } else if (mask === "iron") {
    fill(ctx, [[-0.72, -0.82], [0.72, -0.82], [0.74, -0.15], [0.58, 0.75], [0, 0.93], [-0.58, 0.75], [-0.74, -0.15]], "#d7ae3f", "#5b1b19", 0.08);
    fill(ctx, [[-0.71, -0.84], [0.71, -0.84], [0.56, -0.39], [0, -0.55], [-0.56, -0.39]], look.primary, "#7c2820", 0.04);
    for (const s of [-1, 1]) whiteEye(ctx, s, [s * 0.12, -0.17], [s * 0.59, -0.23], [s * 0.5, -0.02], 0.045);
    line(ctx, [[-0.39, 0.49], [-0.22, 0.64], [0.22, 0.64], [0.39, 0.49]], "#712d25", 0.08);
    line(ctx, [[-0.2, 0.73], [0.2, 0.73]], "#8e5132", 0.055);
  } else if (mask === "cap") {
    fill(ctx, [[-0.65, 0.04], [0.65, 0.04], [0.63, 0.61], [0.29, 0.91], [-0.29, 0.91], [-0.63, 0.61]], look.skin, ink, 0.035);
    fill(ctx, [[-0.83, -0.64], [0.83, -0.64], [0.77, 0.25], [0.5, 0.29], [0.38, 0.06], [-0.38, 0.06], [-0.5, 0.29], [-0.77, 0.25]], look.primary, ink, 0.04);
    ctx.fillStyle = white; ctx.font = "bold 0.66px Arial"; ctx.textAlign = "center"; ctx.fillText("A", 0, -0.46);
    for (const s of [-1, 1]) whiteEye(ctx, s, [s * 0.11, -0.16], [s * 0.6, -0.16], [s * 0.47, 0.04], 0.04);
    line(ctx, [[-0.23, 0.55], [0.24, 0.55]], ink, 0.07);
  } else if (mask === "wolverine") {
    fill(ctx, [[-0.59, -0.07], [0.59, -0.07], [0.64, 0.54], [0.34, 0.92], [-0.34, 0.92], [-0.64, 0.54]], look.skin, ink, 0.035);
    fill(ctx, [[-0.83, -0.79], [0.83, -0.79], [0.75, 0.08], [0.44, 0.11], [0.28, -0.1], [-0.28, -0.1], [-0.44, 0.11], [-0.75, 0.08]], look.primary, ink, 0.055);
    for (const s of [-1, 1]) {
      fill(ctx, [[s * 0.17, -0.5], [s * 0.83, -0.82], [s * 0.71, 0.15], [s * 0.34, 0.08]], "#222633", ink, 0.045);
      whiteEye(ctx, s, [s * 0.17, -0.16], [s * 0.62, -0.25], [s * 0.52, 0.02]);
      fill(ctx, [[s * 0.48, 0.22], [s * 0.65, 0.12], [s * 0.62, 0.7], [s * 0.34, 0.83], [s * 0.42, 0.5]], "#342d29", "transparent", 0);
    }
    line(ctx, [[-0.23, 0.57], [0, 0.5], [0.23, 0.57]], ink, 0.07);
  }
  if (mask !== "none" && mask !== "venom" && mask !== "iron" && mask !== "spider") {
    line(ctx, [[facing * 0.1, 0.29], [0, 0.38], [-facing * 0.1, 0.3]], "rgba(7,11,22,0.55)", 0.04);
  }
}

/** Coordinates are local head units: the caller clips the head and scales to its radius. */
export function drawHeroFace(ctx: Ctx, look: Look, name: string, facing: number, state: FighterState) {
  const mask = maskOf(look, name);
  // Side planes give the head form and preserve the cel-shaded body language.
  fill(ctx, [[-0.9, -0.35], [-0.59, -0.28], [-0.5, 0.39], [-0.71, 0.78], [-0.9, 0.48]], "rgba(9,13,24,0.19)", "transparent", 0);
  fill(ctx, [[0.87, -0.35], [0.54, -0.22], [0.51, 0.39], [0.72, 0.79], [0.91, 0.44]], "rgba(9,13,24,0.28)", "transparent", 0);
  if (mask === "none") {
    faceFeatures(ctx, look, name, facing, state);
    hair(ctx, look, name, facing);
  } else {
    maskFeatures(ctx, mask, look, facing, state);
  }
}

export function heroFaceBase(look: Look, name: string) {
  return maskOf(look, name) === "none" ? look.skin : look.primary;
}
