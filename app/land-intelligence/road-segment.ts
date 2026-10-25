import { distanceMeters, type Coord } from "./geometry";
import type { FatalCrash } from "./crash";

export const ROAD_SOURCE = "https://dtdapps.codot.gov/server/rest/services/Webapps/HighwaySegments/MapServer/2";
export const ALERT_SOURCE = "https://maps.codot.gov/server/rest/services/Hosted/CoTrip_Alerts_Polyline_(Live)_Public_View/FeatureServer/0";
export const CONDITIONS_URL = "https://www.cotrip.org/";
export const CDOT_CRASH_URL = "https://www.codot.gov/safety/traffic-safety/data-analysis/crash-data";

export type RoadLine = GeoJSON.LineString | GeoJSON.MultiLineString;
export type RoadSegmentInfo = {
  id: number; route: string; alias: string; city: string; county: string;
  fromMile: number | null; toMile: number | null; lengthMiles: number | null;
  aadt: number | null; aadtYear: string; speedLimit: number | null;
  surface: string; lanes: number | null; terrain: string; shoulder: string; functionalClass: string;
  sourceUrl: string;
};
export type RoadCrash = FatalCrash & { distanceMeters: number; recordUrl: string };
export type RoadAlert = { id: string; type: string; title: string; description: string; location: string; impact: string; direction: string; updatedAt: string; recordUrl: string };
export type RoadSourceResult<T> = { status: "found" | "none" | "partial" | "unavailable"; items: T[]; note: string; sourceUrl: string };
export type RoadSegmentReport = { checkedAt: string; road: RoadSegmentInfo; crashes: RoadSourceResult<RoadCrash>; alerts: RoadSourceResult<RoadAlert>; conditionsUrl: string; allCrashDataUrl: string };

export function validRoadLine(value: unknown): value is RoadLine {
  if (!value || typeof value !== "object") return false;
  const line = value as RoadLine;
  if (line.type !== "LineString" && line.type !== "MultiLineString") return false;
  const lines = line.type === "LineString" ? [line.coordinates] : line.coordinates;
  return Array.isArray(lines) && lines.length > 0 && lines.length <= 100 && lines.reduce((count, part) => count + (Array.isArray(part) ? part.length : 0), 0) <= 5000 && lines.every((part) => Array.isArray(part) && part.length >= 2 && part.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90));
}

export function roadBounds(line: RoadLine, padMeters = 0): [number, number, number, number] {
  const points = (line.type === "LineString" ? [line.coordinates] : line.coordinates).flat();
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const p of points) { west = Math.min(west, p[0]); south = Math.min(south, p[1]); east = Math.max(east, p[0]); north = Math.max(north, p[1]); }
  const lat = (south + north) / 2;
  const padLat = padMeters / 111200, padLng = padMeters / (111200 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
  return [west - padLng, south - padLat, east + padLng, north + padLat];
}

function segments(line: RoadLine): [Coord, Coord][] {
  const parts = line.type === "LineString" ? [line.coordinates] : line.coordinates;
  return parts.flatMap((part) => part.slice(1).map((point, index) => [part[index] as Coord, point as Coord] as [Coord, Coord]));
}

function pointToSegmentMeters(point: Coord, a: Coord, b: Coord): number {
  const scale = Math.cos(point[1] * Math.PI / 180);
  const x = (p: Coord) => (p[0] - point[0]) * scale;
  const y = (p: Coord) => p[1] - point[1];
  const ax = x(a), ay = y(a), bx = x(b), by = y(b);
  const dx = bx - ax, dy = by - ay;
  const t = dx * dx + dy * dy === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
  return distanceMeters(point, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
}

export function pointToRoadMeters(point: Coord, line: RoadLine): number {
  return Math.min(...segments(line).map(([a, b]) => pointToSegmentMeters(point, a, b)));
}

function intersects(a: Coord, b: Coord, c: Coord, d: Coord): boolean {
  const cross = (p: Coord, q: Coord, r: Coord) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const x = cross(a, b, c), y = cross(a, b, d), z = cross(c, d, a), w = cross(c, d, b);
  return ((x <= 0 && y >= 0) || (x >= 0 && y <= 0)) && ((z <= 0 && w >= 0) || (z >= 0 && w <= 0));
}

/** Approximate separation for screening reported alert lines against a CDOT segment. */
export function linesNearMeters(a: RoadLine, b: RoadLine): number {
  const aSegments = segments(a), bSegments = segments(b);
  let nearest = Infinity;
  for (const [a0, a1] of aSegments) for (const [b0, b1] of bSegments) {
    if (intersects(a0, a1, b0, b1)) return 0;
    nearest = Math.min(nearest, pointToSegmentMeters(a0, b0, b1), pointToSegmentMeters(a1, b0, b1), pointToSegmentMeters(b0, a0, a1), pointToSegmentMeters(b1, a0, a1));
  }
  return nearest;
}
