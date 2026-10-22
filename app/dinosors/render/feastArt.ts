/* ------------------------------------------------------------------ */
/*  The feast: dragon-roasted meat on a cooked body, and the long      */
/*  plank table by the campfire piled with roast.                      */
/* ------------------------------------------------------------------ */

/** One browned joint of roast (drumstick, bone end sticking out). */
function joint(c: CanvasRenderingContext2D, x: number, y: number, s: number, a: number) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  // bone end
  c.fillStyle = "#f1e6cc";
  c.beginPath();
  c.ellipse(s * 0.95, 0, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(s * 1.32, -s * 0.12, s * 0.15, 0, Math.PI * 2);
  c.arc(s * 1.32, s * 0.12, s * 0.15, 0, Math.PI * 2);
  c.fill();
  // meat: glazed brown with a char line + highlight
  const g = c.createRadialGradient(-s * 0.15, -s * 0.2, s * 0.1, 0, 0, s * 0.8);
  g.addColorStop(0, "#c8713a");
  g.addColorStop(0.6, "#8f4320");
  g.addColorStop(1, "#5a2410");
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, s * 0.75, s * 0.52, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(40,15,5,0.55)";
  c.lineWidth = Math.max(0.8, s * 0.08);
  c.beginPath();
  c.moveTo(-s * 0.4, s * 0.1);
  c.lineTo(s * 0.3, -s * 0.15);
  c.stroke();
  c.fillStyle = "rgba(255,225,170,0.55)";
  c.beginPath();
  c.ellipse(-s * 0.2, -s * 0.25, s * 0.25, s * 0.09, -0.3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Curls of steam rising off hot food. */
function steam(c: CanvasRenderingContext2D, x: number, y: number, w: number, t: number, n = 3) {
  c.save();
  c.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const p = (t * 0.45 + i / n) % 1;
    const sx = x + (i - (n - 1) / 2) * (w / n);
    c.strokeStyle = `rgba(255,255,255,${0.42 * (1 - p)})`;
    c.lineWidth = 2.2;
    c.beginPath();
    for (let k = 0; k <= 6; k++) {
      const yy = y - p * 26 - k * 3.2;
      const xx = sx + Math.sin(k * 0.9 + t * 3 + i) * 3;
      if (k === 0) c.moveTo(xx, yy);
      else c.lineTo(xx, yy);
    }
    c.stroke();
  }
  c.restore();
}

/** Roast portions lying on a cooked body, waiting to be carried to the table. */
export function drawRoastPile(c: CanvasRenderingContext2D, n: number, size: number, t: number) {
  const k = Math.min(9, Math.ceil(n / 2));
  const span = Math.min(size * 0.7, 90);
  for (let i = 0; i < k; i++) {
    const x = -span / 2 + (span * (i + 0.5)) / k;
    const y = -6 - (i % 2) * 5;
    joint(c, x, y, 7, -0.5 + (i % 3) * 0.5);
  }
  steam(c, 0, -14, span, t, Math.min(4, k));
}

/** The feast table: plank top on log legs, wooden plates, a heap of roast (how much is left). */
export function drawFeastTable(c: CanvasRenderingContext2D, food: number, t: number) {
  // shadow
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(0, 4, 66, 12, 0, 0, Math.PI * 2);
  c.fill();
  // log legs
  c.fillStyle = "#5e3b1f";
  for (const lx of [-48, -16, 16, 48]) c.fillRect(lx - 3, -14, 6, 16);
  // plank top
  const g = c.createLinearGradient(0, -26, 0, -12);
  g.addColorStop(0, "#b07a45");
  g.addColorStop(1, "#7b4f28");
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(-60, -26, 120, 14, 4);
  c.fill();
  c.strokeStyle = "rgba(60,35,15,0.6)";
  c.lineWidth = 1;
  for (const px of [-30, 0, 30]) {
    c.beginPath();
    c.moveTo(px, -26);
    c.lineTo(px, -12);
    c.stroke();
  }
  // plates
  c.fillStyle = "#d9c09a";
  for (const px of [-46, -18, 18, 46]) {
    c.beginPath();
    c.ellipse(px, -24, 9, 3.4, 0, 0, Math.PI * 2);
    c.fill();
  }
  // the roast heap: more joints, taller, the more there is
  const k = Math.min(14, Math.ceil(food / 3));
  for (let i = 0; i < k; i++) {
    const row = i < 6 ? 0 : i < 11 ? 1 : 2;
    const inRow = row === 0 ? i : row === 1 ? i - 6 : i - 11;
    const per = row === 0 ? 6 : row === 1 ? 5 : 3;
    const x = (inRow - (per - 1) / 2) * 13;
    joint(c, x, -30 - row * 7, 6.5, -0.4 + ((i * 7) % 5) * 0.2);
  }
  if (food > 0) steam(c, 0, -34 - Math.min(2, Math.floor(k / 6)) * 7, 70, t, 3);
  // a sign so it reads as the feast table
  c.fillStyle = "#6b4423";
  c.fillRect(56, -48, 3, 34);
  c.fillStyle = "#c79a5a";
  c.beginPath();
  c.roundRect(46, -58, 24, 14, 3);
  c.fill();
  c.font = "10px serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("🍖", 58, -51);
}
