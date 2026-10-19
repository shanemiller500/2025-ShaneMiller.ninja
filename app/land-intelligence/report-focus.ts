import type { AnalysisShape, Coord } from "./geometry";

export type FocusScope = "inside" | "outside";
const ringArea = (ring: Coord[]) => ring.reduce((sum, point, index) => { const next = ring[(index + 1) % ring.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0);
const closed = (ring: Coord[]) => ring.length && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]];
const ccw = (ring: Coord[]) => { const points = closed(ring); return ringArea(points) < 0 ? [...points].reverse() : points; };
const cw = (ring: Coord[]) => { const points = closed(ring); return ringArea(points) > 0 ? [...points].reverse() : points; };
function rectangle(points: Coord[], paddingKm: number): Coord[] {
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const lat = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dy = paddingKm / 111.2, dx = paddingKm / (111.2 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  const west = Math.min(...xs) - dx, east = Math.max(...xs) + dx, south = Math.min(...ys) - dy, north = Math.max(...ys) + dy;
  return [[west, south], [east, south], [east, north], [west, north], [west, south]];
}
function footprint(shape: AnalysisShape, selectedParcel: GeoJSON.Feature | null): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  const geometry = selectedParcel?.geometry;
  if (geometry?.type === "Polygon" || geometry?.type === "MultiPolygon") return geometry;
  if (shape.kind === "area" && shape.points.length >= 3) return { type: "Polygon", coordinates: [closed(shape.points)] };
  return { type: "Polygon", coordinates: [rectangle(shape.points, shape.kind === "pin" ? 0.15 : 0.06)] };
}
export function focusGeoJSON(shape: AnalysisShape, selectedParcel: GeoJSON.Feature | null, scope: FocusScope): GeoJSON.FeatureCollection {
  const inner = footprint(shape, selectedParcel);
  const rings = inner.type === "Polygon" ? [inner.coordinates[0]] : inner.coordinates.map((polygon) => polygon[0]);
  const points = rings.flat() as Coord[];
  const outer = rectangle(points, 1);
  const geometry: GeoJSON.Geometry = scope === "inside" ? inner : { type: "Polygon", coordinates: [ccw(outer), ...rings.map((ring) => cw(ring as Coord[]))] };
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: { scope }, geometry }] };
}