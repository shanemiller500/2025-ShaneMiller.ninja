import { areaSquareMeters, distanceMeters, lengthMeters, type Coord } from "./geometry";
import { pointInParcel, type ParcelGeometry, type ParcelInspectionReport } from "./parcel-inspection";

export const PARCEL_DISCIPLINES = [
  { id: "survey", label: "Survey control", groups: ["survey-control"] },
  { id: "ecology", label: "Ecology and water", groups: ["wetlands", "waterways"] },
  { id: "flood", label: "Flood and drainage", groups: ["flood"] },
  { id: "ground", label: "Soils and geology", groups: ["soils", "faults", "karst", "mines", "groundwater-sites", "florida-subsidence"] },
  { id: "environment", label: "Environmental records", groups: ["facilities", "superfund", "colorado-tanks"] },
  { id: "transport", label: "Transportation", groups: ["roads"] },
  { id: "utilities", label: "Utility infrastructure", groups: ["denver-storm", "wet-utilities", "dry-utilities"] },
] as const;

export function parcelMetrics(geometry: ParcelGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let areaMeters2 = 0, perimeterMeters = 0;
  for (const polygon of polygons) {
    areaMeters2 += areaSquareMeters(polygon[0] as Coord[]) - polygon.slice(1).reduce((sum, ring) => sum + areaSquareMeters(ring as Coord[]), 0);
    for (const ring of polygon) perimeterMeters += lengthMeters(ring as Coord[]);
  }
  return { areaMeters2: Math.max(0, areaMeters2), perimeterMeters };
}

const interpolate = (a: Coord, b: Coord, t: number): Coord => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function splitAtRing(a: Coord, b: Coord, ring: number[][], splits: number[]) {
  for (let i = 1; i < ring.length; i++) {
    const c = ring[i - 1] as Coord, d = ring[i] as Coord;
    const rX = b[0] - a[0], rY = b[1] - a[1], sX = d[0] - c[0], sY = d[1] - c[1];
    const denominator = rX * sY - rY * sX;
    if (Math.abs(denominator) < 1e-15) continue;
    const qX = c[0] - a[0], qY = c[1] - a[1];
    const t = (qX * sY - qY * sX) / denominator;
    const u = (qX * rY - qY * rX) / denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) splits.push(t);
  }
}

/** Approximate length of a mapped line within a parcel, including holes and separate islands. */
export function lineInsideParcelMeters(line: GeoJSON.LineString | GeoJSON.MultiLineString, parcel: ParcelGeometry) {
  const lines = line.type === "LineString" ? [line.coordinates] : line.coordinates;
  const polygons = parcel.type === "Polygon" ? [parcel.coordinates] : parcel.coordinates;
  let total = 0;
  for (const coordinates of lines) for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1] as Coord, b = coordinates[i] as Coord;
    const splits = [0, 1];
    for (const polygon of polygons) for (const ring of polygon) splitAtRing(a, b, ring, splits);
    splits.sort((x, y) => x - y);
    for (let j = 1; j < splits.length; j++) {
      const from = splits[j - 1], to = splits[j];
      if (to - from < 1e-10 || !pointInParcel(interpolate(a, b, (from + to) / 2), parcel)) continue;
      total += distanceMeters(interpolate(a, b, from), interpolate(a, b, to));
    }
  }
  return total;
}

export function parcelDisciplineSummary(report: ParcelInspectionReport) {
  return PARCEL_DISCIPLINES.map((discipline) => {
    const groups = report.groups.filter((group) => (discipline.groups as readonly string[]).includes(group.id));
    return {
      id: discipline.id, label: discipline.label,
      findings: groups.reduce((sum, group) => sum + group.findings.length, 0),
      unavailable: groups.filter((group) => group.status === "unavailable" || group.status === "partial").length,
      unqueried: groups.filter((group) => group.status === "not_queried").length,
      unknown: groups.filter((group) => group.status === "coverage_unknown").length,
      empty: groups.filter((group) => group.status === "no_features").length,
      outside: groups.filter((group) => group.status === "outside_coverage").length,
      groups,
    };
  });
}
