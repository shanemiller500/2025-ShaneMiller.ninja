/* ------------------------------------------------------------------ */
/*  Dragon Shield effects (world space): the field coverage (shown     */
/*  while placing or inspecting shields), the knitted links between    */
/*  pylons, frequency rings rising off a charging pylon, and the hum   */
/*  reaching out to a rattled dragon (a rippling beam + a shimmer of   */
/*  distortion round it).                                              */
/* ------------------------------------------------------------------ */
import { SHIELD, shieldLinks, shieldRadius, shieldsOf, shieldView } from "../sim/dragonShield";
import type { World } from "../sim/world";

const RING = "150,240,255";
const VIOLET = "200,170,255";

/**
 * `edit`: show every shield's full field (placing a shield, or one is picked).
 * `ghost`: a shield about to be placed here (its field, joined to the rest).
 */
export function drawShieldFields(c: CanvasRenderingContext2D, w: World, t: number, edit: boolean, ghost: { x: number; y: number; ok: boolean } | null, x0: number, y0: number, x1: number, y1: number) {
  const list = shieldsOf(w);
  if (!list.length && !ghost) return;
  const v = shieldView(w);
  c.save();
  if (edit) {
    // coverage: every field filled faintly (overlaps show brighter, which is where the hum is strongest)
    c.globalCompositeOperation = "lighter";
    for (const b of list) {
      const r = shieldRadius(b);
      if (b.x + r < x0 || b.x - r > x1 || b.y + r < y0 || b.y - r > y1) continue;
      const g = c.createRadialGradient(b.x, b.y, r * 0.2, b.x, b.y, r);
      g.addColorStop(0, `rgba(${RING},0.02)`);
      g.addColorStop(1, `rgba(${RING},${v.powered ? 0.13 : 0.05})`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(b.x, b.y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalCompositeOperation = "source-over";
    c.setLineDash([12, 8]);
    c.lineDashOffset = -t * 20;
    c.lineWidth = 2;
    for (const b of list) {
      c.strokeStyle = v.powered ? `rgba(${RING},0.75)` : "rgba(170,170,180,0.55)";
      c.beginPath();
      c.arc(b.x, b.y, shieldRadius(b), 0, Math.PI * 2);
      c.stroke();
    }
    c.setLineDash([]);
    if (ghost) {
      const r = SHIELD.r;
      c.fillStyle = ghost.ok ? "rgba(120,255,190,0.10)" : "rgba(255,110,110,0.10)";
      c.strokeStyle = ghost.ok ? "rgba(120,255,190,0.9)" : "rgba(255,110,110,0.9)";
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(ghost.x, ghost.y, r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // the shields it would knit to
      for (const b of list) {
        if (Math.hypot(b.x - ghost.x, b.y - ghost.y) > (shieldRadius(b) + r) * SHIELD.linkReach * 0.8) continue;
        c.strokeStyle = `rgba(${RING},0.6)`;
        c.setLineDash([4, 5]);
        c.beginPath();
        c.moveTo(ghost.x, ghost.y - 40);
        c.lineTo(b.x, b.y - 60);
        c.stroke();
        c.setLineDash([]);
      }
    }
  }
  if (!v.powered) {
    c.restore();
    return;
  }
  // knitted pylons: a soft humming arc between their crystals
  for (const [a, b] of shieldLinks(w, list)) {
    const k = Math.max(v.charge.get(a.id) ?? 0, v.charge.get(b.id) ?? 0);
    if (!edit && k < 0.05) continue;
    if (Math.max(a.x, b.x) < x0 - 200 || Math.min(a.x, b.x) > x1 + 200) continue;
    c.strokeStyle = `rgba(${RING},${0.12 + k * 0.4})`;
    c.lineWidth = 1.5 + k * 1.5;
    c.beginPath();
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 90 - Math.sin(t * 3) * 6;
    c.moveTo(a.x, a.y - 62);
    c.quadraticCurveTo(mx, my, b.x, b.y - 62);
    c.stroke();
  }
  // charging + live pylons: frequency rings rising off the crystal and spreading over the ground
  for (const b of list) {
    const k = v.charge.get(b.id) ?? 0;
    if (k < 0.02 || b.x < x0 - 500 || b.x > x1 + 500 || b.y < y0 - 500 || b.y > y1 + 500) continue;
    const r = shieldRadius(b);
    const rings = 1 + Math.round(k * 3);
    for (let i = 0; i < rings; i++) {
      const f = ((t * (0.35 + k * 0.5) + i / rings) % 1);
      c.strokeStyle = `rgba(${i % 2 ? VIOLET : RING},${(1 - f) * 0.5 * k})`;
      c.lineWidth = 2 + (1 - f) * 2;
      c.beginPath();
      c.arc(b.x, b.y, 20 + f * r, 0, Math.PI * 2);
      c.stroke();
      // and a tight one climbing off the crystal
      c.strokeStyle = `rgba(${RING},${(1 - f) * 0.7 * k})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(b.x, b.y - 62 - f * 40, 10 + f * 26, 4 + f * 8, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // a live field's edge shimmers
    if (k >= 1) {
      c.strokeStyle = `rgba(${RING},${0.18 + Math.sin(t * 6 + b.id) * 0.08})`;
      c.lineWidth = 3;
      c.setLineDash([3, 9]);
      c.lineDashOffset = t * 40;
      c.beginPath();
      c.arc(b.x, b.y, r, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
  }
  // the hum reaching a rattled dragon: a rippling beam from the crystal, distortion round the dragon
  for (const [did, sid] of Array.from(v.pushing.entries())) {
    const dr = w.dragons.list.find((d) => d.id === did);
    const b = list.find((x) => x.id === sid);
    if (!dr || !b) continue;
    const sx = b.x;
    const sy = b.y - 62;
    const ex = dr.x;
    const ey = dr.y - dr.z - 30;
    const n = 24;
    const len = Math.hypot(ex - sx, ey - sy) || 1;
    const nx = -(ey - sy) / len;
    const ny = (ex - sx) / len;
    for (const [col, wid, amp] of [[RING, 3, 7], [VIOLET, 1.5, 11]] as const) {
      c.strokeStyle = `rgba(${col},0.55)`;
      c.lineWidth = wid;
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const wave = Math.sin(f * 18 - t * 14) * amp * Math.sin(f * Math.PI);
        const px = sx + (ex - sx) * f + nx * wave;
        const py = sy + (ey - sy) * f + ny * wave;
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.stroke();
    }
    const k = Math.min(1, dr.repel?.k ?? 0);
    for (let i = 0; i < 3; i++) {
      const f = (t * 1.6 + i / 3) % 1;
      c.strokeStyle = `rgba(${i % 2 ? VIOLET : RING},${(1 - f) * (0.35 + k * 0.4)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(ex + Math.sin(t * 9 + i) * 3, ey, 40 + f * 70, 16 + f * 26, Math.sin(t * 2) * 0.2, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.restore();
}
