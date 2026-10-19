export type Coord = [number, number];
export type ShapeKind = "pin" | "line" | "area";
export type AnalysisShape = { kind: ShapeKind; points: Coord[] };

const R = 6371008.8;
const rad = (degrees: number) => degrees * Math.PI / 180;

export function validShape(shape: AnalysisShape): boolean {
  const needed = shape.kind === "pin" ? 1 : shape.kind === "line" ? 2 : 3;
  const basic = shape.points.length >= needed && shape.points.length <= (shape.kind === "pin" ? 1 : 40) && shape.points.every((point) =>
    Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    point[0] >= -180 && point[0] <= 180 && point[1] >= -85 && point[1] <= 85);
  if (!basic) return false;
  if (shape.kind === "pin") return true;
  if (shape.kind === "line") return lengthMeters(shape.points) > 0.5;
  if (areaSquareMeters(shape.points) <= 1 || lengthMeters(shape.points, true) <= 1) return false;
  const points = shape.points;
  for (let i = 0; i < points.length; i++) {
    if (distanceMeters(points[i], points[(i + 1) % points.length]) <= 0.5) return false;
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (segmentsIntersect(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) return false;
    }
  }
  return true;
}

function segmentsIntersect(a: Coord, b: Coord, c: Coord, d: Coord) {
  const cross = (p: Coord, q: Coord, r: Coord) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const between = (p: Coord, q: Coord, r: Coord) => Math.min(p[0], r[0]) <= q[0] && q[0] <= Math.max(p[0], r[0]) && Math.min(p[1], r[1]) <= q[1] && q[1] <= Math.max(p[1], r[1]);
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (abC === 0 && between(a, c, b)) return true;
  if (abD === 0 && between(a, d, b)) return true;
  if (cdA === 0 && between(c, a, d)) return true;
  if (cdB === 0 && between(c, b, d)) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

export function distanceMeters(a: Coord, b: Coord): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lengthMeters(points: Coord[], close = false): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  if (close && points.length > 2) total += distanceMeters(points[points.length - 1], points[0]);
  return total;
}

/** Spherical polygon area; suitable for a preliminary map measurement. */
export function areaSquareMeters(points: Coord[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    let dLng = rad(b[0] - a[0]);
    if (dLng > Math.PI) dLng -= 2 * Math.PI;
    if (dLng < -Math.PI) dLng += 2 * Math.PI;
    sum += dLng * (2 + Math.sin(rad(a[1])) + Math.sin(rad(b[1])));
  }
  return Math.abs(sum * R * R / 2);
}

export function shapeCenter(points: Coord[]): Coord {
  return [points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length];
}

export function shapeGeoJSON(shape: AnalysisShape): GeoJSON.FeatureCollection {
  const { kind, points } = shape;
  if (!points.length) return { type: "FeatureCollection", features: [] };
  const geometry: GeoJSON.Geometry = kind === "pin" || points.length === 1
    ? { type: "Point", coordinates: points[0] }
    : kind === "area" && points.length >= 3
      ? { type: "Polygon", coordinates: [[...points, points[0]]] }
      : { type: "LineString", coordinates: points };
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry }] };
}
