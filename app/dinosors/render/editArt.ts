/* ------------------------------------------------------------------ */
/*  Edit overlays: what the player is about to change, drawn over the  */
/*  world so it's obvious at a glance on a phone as well as a desktop.  */
/*                                                                     */
/*  • ✏️ Wall edit: picked pieces glow cyan (pulsing outline + a lifted */
/*    marker), the hovered piece gets a thin outline, and while a group */
/*    is dragged its ghost shows on the tile grid: green where a piece  */
/*    fits, red where it's blocked.                                     */
/*  • 🪓 Clear area: the box being dragged (with every plant inside it  */
/*    ringed + a count), and each clearing job under way (dashed box,   */
/*    the plants still to go, a progress label).                        */
/* ------------------------------------------------------------------ */
import { plantsLeft, type ClearRect } from "../sim/clearArea";
import { TILE } from "../sim/types";
import type { World } from "../sim/world";

export interface WallEditView {
  sel: Set<number>;
  ghost: { tx: number; ty: number; ok: boolean }[] | null;
  hover: number;
}

function tag(c: CanvasRenderingContext2D, x: number, y: number, text: string, inv: number, bg: string) {
  c.save();
  c.font = `bold ${12 * inv}px system-ui, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  const w = c.measureText(text).width + 12 * inv;
  const h = 18 * inv;
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(x - w / 2, y - h / 2, w, h, 6 * inv);
  c.fill();
  c.fillStyle = "#fff";
  c.fillText(text, x, y + inv * 0.5);
  c.restore();
}

/** Picked wall pieces, the hovered one, and the drag ghost. */
export function drawWallEdit(c: CanvasRenderingContext2D, w: World, v: WallEditView, t: number, inv: number) {
  const pulse = 0.55 + Math.sin(t * 5) * 0.25;
  c.save();
  c.lineJoin = "round";
  for (const wl of w.tribe.walls) {
    const picked = v.sel.has(wl.id);
    if (!picked && wl.id !== v.hover) continue;
    const x = wl.tx * TILE;
    const y = wl.ty * TILE;
    if (picked) {
      // a cyan glow over the tile + up the face of the wall, so it reads on any wall art
      c.fillStyle = `rgba(80,220,255,${0.18 + pulse * 0.16})`;
      c.fillRect(x + 1, y - TILE * 0.9, TILE - 2, TILE * 1.9);
      c.strokeStyle = `rgba(120,235,255,${0.75 + pulse * 0.25})`;
      c.lineWidth = 2.4 * inv;
      c.setLineDash([]);
      c.strokeRect(x + 1.5, y - TILE * 0.9, TILE - 3, TILE * 1.9);
      // a little lifted marker over each picked piece
      c.fillStyle = "#5ee6ff";
      c.beginPath();
      const my = y - TILE * 1.1 - Math.sin(t * 4 + wl.id) * 2;
      c.moveTo(x + TILE / 2, my + 6 * inv);
      c.lineTo(x + TILE / 2 - 5 * inv, my - 2 * inv);
      c.lineTo(x + TILE / 2 + 5 * inv, my - 2 * inv);
      c.closePath();
      c.fill();
    } else {
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 1.5 * inv;
      c.setLineDash([4 * inv, 3 * inv]);
      c.strokeRect(x + 2, y - TILE * 0.85, TILE - 4, TILE * 1.8);
    }
  }
  c.setLineDash([]);
  if (v.ghost) {
    const ok = v.ghost.every((g) => g.ok);
    for (const g of v.ghost) {
      const x = g.tx * TILE;
      const y = g.ty * TILE;
      c.fillStyle = g.ok ? "rgba(90,230,140,0.38)" : "rgba(255,80,80,0.45)";
      c.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      c.strokeStyle = g.ok ? "rgba(140,255,180,0.95)" : "rgba(255,120,120,0.95)";
      c.lineWidth = 2 * inv;
      c.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
    }
    const top = v.ghost.reduce((m, g) => (g.ty < m.ty ? g : m), v.ghost[0]);
    if (top) tag(c, (top.tx + 0.5) * TILE, top.ty * TILE - 16 * inv, ok ? `✓ ${v.ghost.length} piece${v.ghost.length === 1 ? "" : "s"} fit` : `✕ ${v.ghost.filter((g) => !g.ok).length} blocked`, inv, ok ? "rgba(30,140,80,0.92)" : "rgba(170,40,40,0.92)");
  }
  c.restore();
}

function dashedBox(c: CanvasRenderingContext2D, r: ClearRect, t: number, inv: number, fill: string, stroke: string) {
  c.fillStyle = fill;
  c.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  c.strokeStyle = stroke;
  c.lineWidth = 2.4 * inv;
  c.setLineDash([10 * inv, 6 * inv]);
  c.lineDashOffset = -t * 30 * inv;
  c.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  c.setLineDash([]);
}

/** The box being dragged in 🪓 Clear area mode (world coords), with what it would clear. */
export function drawClearBox(c: CanvasRenderingContext2D, w: World, r: ClearRect, t: number, inv: number) {
  c.save();
  dashedBox(c, r, t, inv, "rgba(110,230,120,0.14)", "rgba(150,255,140,0.95)");
  let n = 0;
  c.strokeStyle = "rgba(190,255,150,0.95)";
  c.lineWidth = 1.6 * inv;
  for (const p of w.plants) {
    if (p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
    n++;
    if (n > 400) continue;
    c.beginPath();
    c.ellipse(p.x, p.y, 9 + p.size * 8, 4 + p.size * 3, 0, 0, Math.PI * 2);
    c.stroke();
  }
  tag(c, (r.x0 + r.x1) / 2, r.y0 - 14 * inv, n ? `🪓 ${n} plant${n === 1 ? "" : "s"} to clear` : "🪓 nothing growing here", inv, "rgba(40,120,50,0.92)");
  c.restore();
}

/** Clear area jobs under way: the box, the plants still standing, and how far along it is. */
export function drawClearJobs(c: CanvasRenderingContext2D, w: World, t: number, inv: number, x0: number, y0: number, x1: number, y1: number) {
  if (!w.clearJobs.length) return;
  c.save();
  for (const job of w.clearJobs) {
    if (job.x1 < x0 || job.x0 > x1 || job.y1 < y0 || job.y0 > y1) continue;
    dashedBox(c, job, t, inv, "rgba(110,230,120,0.06)", "rgba(150,240,140,0.7)");
    const left = plantsLeft(w, job);
    c.fillStyle = "rgba(255,240,140,0.9)";
    for (const p of left.slice(0, 300)) {
      c.beginPath();
      c.arc(p.x, p.y - 2, 2.6 * inv, 0, Math.PI * 2);
      c.fill();
    }
    const done = job.total ? Math.max(0, Math.min(1, 1 - left.length / job.total)) : 0;
    const crew = job.people.length + job.dinos.length;
    tag(c, (job.x0 + job.x1) / 2, job.y0 - 14 * inv, `🪓 Clearing ${Math.round(done * 100)}% · ${left.length} left${crew ? ` · ${crew} working` : " · waiting for free hands"}`, inv, "rgba(40,110,50,0.85)");
  }
  c.restore();
}
