import type { World } from "../sim/world";
import { TILE } from "../sim/types";

export interface AwningSpan { aId: number; bId: number; ax: number; ay: number; bx: number; by: number }

/** Join the closest neighbours first, independent of their construction order. */
export function awningLayout(w: World): AwningSpan[] {
  const nodes = w.colony.buildings.filter((b) => b.kind === "canopy" && b.built >= 1 && b.hp > 0 && !b.lift);
  const edges: { a: number; b: number; distance: number }[] = [];
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    const distance = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
    if (distance > 0 && distance <= 128) edges.push({ a, b, distance });
  }
  edges.sort((a, b) => a.distance - b.distance);
  const parent = nodes.map((_, i) => i);
  const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]));
  const spans: AwningSpan[] = [];
  for (const edge of edges) {
    if (root(edge.a) === root(edge.b)) continue;
    const a = nodes[edge.a], b = nodes[edge.b];
    let blocked = false;
    for (let k = 1; k < 8 && !blocked; k++) {
      const x = a.x + (b.x - a.x) * k / 8, y = a.y + (b.y - a.y) * k / 8;
      blocked = !w.colony.footing(w, Math.floor(x / TILE), Math.floor(y / TILE))
        || w.colony.buildings.some((o) => o.kind !== "canopy" && Math.hypot(o.x - x, o.y - y) < 28)
        || w.shelters.some((s) => Math.hypot(s.x - x, s.y - y) < 32)
        || w.tribe.walls.some((s) => Math.hypot((s.tx + 0.5) * TILE - x, (s.ty + 0.5) * TILE - y) < 18);
    }
    if (blocked) continue;
    parent[root(edge.a)] = root(edge.b);
    // Buildings are painted at b.y; adding half a tile here leaves roofs disconnected.
    spans.push({ aId: a.id, bId: b.id, ax: a.x, ay: a.y, bx: b.x, by: b.y });
  }
  return spans;
}
