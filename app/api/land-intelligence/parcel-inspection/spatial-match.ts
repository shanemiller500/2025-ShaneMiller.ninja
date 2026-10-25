import polygonClipping, { type MultiPolygon as ClipMultiPolygon } from "polygon-clipping";
import { lineInsideParcelMeters } from "@/app/land-intelligence/parcel-analysis";
import { pointInParcel, pointToParcelMeters, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";

export type SpatialRelation = { relationship: "inside" | "intersects" | "nearby"; distanceMeters: number | null };

const polygons = (geometry: ParcelGeometry): ClipMultiPolygon =>
  (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as ClipMultiPolygon;

function lineOnBoundary(line: GeoJSON.LineString | GeoJSON.MultiLineString, parcel: ParcelGeometry) {
  const segments = (line.type === "LineString" ? [line.coordinates] : line.coordinates)
    .flatMap((points) => points.slice(1).map((end, index) => [points[index], end]));
  const rings = (parcel.type === "Polygon" ? [parcel.coordinates] : parcel.coordinates).flat();
  const on = (p: number[], a: number[], b: number[]) => {
    const cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
    const scale = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    return Math.abs(cross) <= 1e-12 * scale && p[0] >= Math.min(a[0], b[0]) - 1e-10 &&
      p[0] <= Math.max(a[0], b[0]) + 1e-10 && p[1] >= Math.min(a[1], b[1]) - 1e-10 &&
      p[1] <= Math.max(a[1], b[1]) + 1e-10;
  };
  const onBoundary = (point: number[]) => rings.some((ring) =>
    ring.slice(1).some((end, index) => on(point, ring[index], end)));
  return segments.length > 0 && segments.every(([a, b]) =>
    onBoundary(a) && onBoundary(b) && onBoundary([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
}

/** Reject service bbox-only hits and shared-boundary-only polygons/lines. This is screening geometry, not a legal survey. */
export function spatialRelation(feature: GeoJSON.Geometry, parcel: ParcelGeometry, nearbyMeters = 0): SpatialRelation | null {
  if (feature.type === "Point" || feature.type === "MultiPoint") {
    const points = feature.type === "Point" ? [feature.coordinates] : feature.coordinates;
    const distances = points.filter((point) => point.length >= 2 && point.every(Number.isFinite))
      .map((point) => pointToParcelMeters(point as [number, number], parcel));
    const distance = Math.min(...distances);
    if (!Number.isFinite(distance) || distance > nearbyMeters) return null;
    return { relationship: distance <= 0.05 && points.some((point) => pointInParcel(point as [number, number], parcel)) ? "inside" : "nearby", distanceMeters: Math.round(distance) };
  }
  if (feature.type === "LineString" || feature.type === "MultiLineString") {
    if (lineOnBoundary(feature, parcel) || lineInsideParcelMeters(feature, parcel) <= 0.05) return null;
    return { relationship: "intersects", distanceMeters: null };
  }
  if (feature.type === "Polygon" || feature.type === "MultiPolygon") {
    try {
      const overlap = polygonClipping.intersection(polygons(parcel), polygons(feature));
      return overlap.length ? { relationship: "intersects", distanceMeters: null } : null;
    } catch { return null; }
  }
  return null;
}
