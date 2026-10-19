import { distanceMeters, lengthMeters, type AnalysisShape, type Coord } from "./geometry";
import type { TerrainSample } from "./report-types";

function pointInside(point: Coord, polygon: Coord[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function terrainPoints(shape: AnalysisShape): { point: Coord; distanceMeters: number | null }[] {
  if (shape.kind === "pin") return [];
  if (shape.kind === "line") {
    const total = lengthMeters(shape.points);
    if (total <= 0) return [];
    const count = 9;
    return Array.from({ length: count }, (_, index) => {
      const target = total * index / (count - 1);
      let traveled = 0;
      for (let i = 1; i < shape.points.length; i++) {
        const a = shape.points[i - 1], b = shape.points[i];
        const segment = distanceMeters(a, b);
        if (traveled + segment >= target || i === shape.points.length - 1) {
          const t = segment ? Math.min(1, Math.max(0, (target - traveled) / segment)) : 0;
          return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Coord, distanceMeters: target };
        }
        traveled += segment;
      }
      return { point: shape.points[shape.points.length - 1], distanceMeters: total };
    });
  }
  const xs = shape.points.map((p) => p[0]), ys = shape.points.map((p) => p[1]);
  const west = Math.min(...xs), east = Math.max(...xs), south = Math.min(...ys), north = Math.max(...ys);
  const candidates: Coord[] = [];
  for (let row = 1; row <= 5; row++) for (let col = 1; col <= 5; col++) {
    const point: Coord = [west + (east - west) * col / 6, south + (north - south) * row / 6];
    if (pointInside(point, shape.points)) candidates.push(point);
  }
  const interior = candidates.length > 9 ? Array.from({ length: 9 }, (_, i) => candidates[Math.round(i * (candidates.length - 1) / 8)]) : candidates;
  const samples = interior.length >= 3 ? interior : shape.points.slice(0, 9);
  return samples.map((point) => ({ point, distanceMeters: null }));
}

export function terrainStatistics(samples: TerrainSample[], kind: "line" | "area") {
  if (!samples.length) return { minMeters: null, maxMeters: null, ascentMeters: null, descentMeters: null };
  const heights = samples.map((sample) => sample.elevationMeters);
  let ascent = 0, descent = 0;
  if (kind === "line") for (let i = 1; i < heights.length; i++) {
    const difference = heights[i] - heights[i - 1];
    if (difference > 0) ascent += difference;
    else descent -= difference;
  }
  return { minMeters: Math.min(...heights), maxMeters: Math.max(...heights), ascentMeters: kind === "line" ? ascent : null, descentMeters: kind === "line" ? descent : null };
}
