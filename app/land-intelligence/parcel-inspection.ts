import { distanceMeters, type Coord } from "./geometry";

export type ParcelGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type InspectionStatus = "found" | "no_features" | "coverage_unknown" | "outside_coverage" | "not_queried" | "partial" | "unavailable" | "source_error";
export type ParcelFinding = {
  id: string;
  name: string;
  detail: string;
  relationship: "intersects" | "inside" | "nearby";
  distanceMeters: number | null;
  sourceId: string;
  sourceRecordId: string;
  recordUrl: string;
  recordDate: string;
  geometry: GeoJSON.Geometry;
  verification?: "official_map" | "derived" | "unverified";
  positionalAccuracyMeters?: number | null;
};
export type InspectionGroup = {
  id: string;
  label: string;
  source: string;
  sourceUrl: string;
  status: InspectionStatus;
  note: string;
  findings: ParcelFinding[];
  checkedAt?: string;
  coverage?: "confirmed" | "unknown" | "outside";
  recordLimit?: number;
};
export type ParcelInspectionReport = { parcelKey: string; checkedAt: string; groups: InspectionGroup[]; geometry?: ParcelGeometry; geometrySource?: string };

export const PARCEL_INSPECTION_GROUPS = [
  { id: "flood", label: "Flood mapping", color: "#38bdf8" },
  { id: "wetlands", label: "Mapped wetlands", color: "#2dd4bf" },
  { id: "waterways", label: "Mapped waterways", color: "#60a5fa" },
  { id: "soils", label: "Soil map units", color: "#a3e635" },
  { id: "faults", label: "Mapped faults", color: "#fb7185" },
  { id: "karst", label: "Karst geology", color: "#c084fc" },
  { id: "mines", label: "Historical mine symbols", color: "#fbbf24" },
  { id: "roads", label: "Colorado highways", color: "#f97316" },
  { id: "colorado-local-roads", label: "Colorado local roads", color: "#fb923c" },
  { id: "colorado-bridges", label: "Colorado bridges and culverts", color: "#facc15" },
  { id: "facilities", label: "EPA facilities within 500 m", color: "#f472b6" },
  { id: "superfund", label: "EPA Superfund boundaries", color: "#e879f9" },
  { id: "survey-control", label: "Survey control within 1 km", color: "#facc15" },
  { id: "groundwater-sites", label: "Groundwater wells within 1 km", color: "#22d3ee" },
  { id: "denver-storm", label: "Denver storm sewer mains", color: "#38bdf8" },
  { id: "colorado-tanks", label: "Registered tank facilities within 500 m", color: "#fb923c" },
  { id: "florida-subsidence", label: "Florida subsidence reports within 500 m", color: "#c084fc" },
  { id: "wet-utilities", label: "Water and sanitary sewer lines", color: "#06b6d4" },
  { id: "dry-utilities", label: "Gas, power, and telecom lines", color: "#f59e0b" },
] as const;

export function parcelBounds(geometry: ParcelGeometry): [number, number, number, number] {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  const points = rings.flat() as Coord[];
  return [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
}

export function validParcelGeometry(value: unknown): value is ParcelGeometry {
  if (!value || typeof value !== "object") return false;
  const geometry = value as ParcelGeometry;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons) || !polygons.length || polygons.length > 30) return false;
  let vertices = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length || polygon.length > 30) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) return false;
      vertices += ring.length;
      if (vertices > 5000 || !ring.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n)) && p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90)) return false;
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) return false;
      if (Math.abs(signedArea(ring)) < 1e-15 || ringSelfIntersects(ring)) return false;
    }
    for (const hole of polygon.slice(1)) {
      if (!insideRing(hole[0] as Coord, polygon[0]) || ringsIntersect(hole, polygon[0])) return false;
    }
  }
  const [w, s, e, n] = parcelBounds(geometry);
  return w >= -180 && e <= 180 && s >= -15 && n <= 72 && e > w && n > s && e - w <= 0.5 && n - s <= 0.5;
}

const signedArea = (ring: number[][]) => ring.slice(0, -1).reduce((sum, point, index) => {
  const next = ring[index + 1];
  const origin = ring[0];
  return sum + (point[0] - origin[0]) * (next[1] - origin[1]) - (next[0] - origin[0]) * (point[1] - origin[1]);
}, 0);

function orientation(a: number[], b: number[], c: number[]) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsIntersect(a: number[], b: number[], c: number[], d: number[]) {
  const abC = orientation(a, b, c), abD = orientation(a, b, d);
  const cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  const on = (p: number[], u: number[], v: number[]) => Math.abs(orientation(u, v, p)) < 1e-13 &&
    p[0] >= Math.min(u[0], v[0]) && p[0] <= Math.max(u[0], v[0]) &&
    p[1] >= Math.min(u[1], v[1]) && p[1] <= Math.max(u[1], v[1]);
  return on(c, a, b) || on(d, a, b) || on(a, c, d) || on(b, c, d);
}

function ringSelfIntersects(ring: number[][]) {
  const edges = ring.length - 1;
  for (let i = 0; i < edges; i++) {
    if (ring[i][0] === ring[i + 1][0] && ring[i][1] === ring[i + 1][1]) return true;
    for (let j = i + 2; j < edges; j++) {
      if (i === 0 && j === edges - 1) continue;
      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
    }
  }
  return false;
}

function ringsIntersect(a: number[][], b: number[][]) {
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++)
    if (segmentsIntersect(a[i - 1], a[i], b[j - 1], b[j])) return true;
  return false;
}

/** ArcGIS polygon rings use clockwise exteriors and counterclockwise holes. */
export function esriParcelGeometry(geometry: ParcelGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const rings = polygons.flatMap((polygon) => polygon.map((ring, index) => {
    const clockwise = signedArea(ring) < 0;
    return clockwise === (index === 0) ? ring : [...ring].reverse();
  }));
  return { rings, spatialReference: { wkid: 4326 } };
}

function insideRing(point: Coord, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function pointInParcel(point: Coord, geometry: ParcelGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => insideRing(point, polygon[0]) && !polygon.slice(1).some((ring) => insideRing(point, ring)));
}

/** Local tangent-plane segment distance, used only to label nearby point records. */
export function pointToParcelMeters(point: Coord, geometry: ParcelGeometry) {
  if (pointInParcel(point, geometry)) return 0;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let nearest = Infinity;
  for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1] as Coord, b = ring[i] as Coord;
    const east = Math.cos(point[1] * Math.PI / 180);
    const ax = (a[0] - point[0]) * east, ay = a[1] - point[1];
    const bx = (b[0] - point[0]) * east, by = b[1] - point[1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    const closest: Coord = [point[0] + (ax + t * dx) / east, point[1] + ay + t * dy];
    nearest = Math.min(nearest, distanceMeters(point, closest));
  }
  return nearest;
}
