import { NextRequest, NextResponse } from "next/server";
import { areaSquareMeters, lengthMeters, validShape, type AnalysisShape } from "@/app/land-intelligence/geometry";
import { terrainPoints, terrainStatistics } from "@/app/land-intelligence/terrain";
import type { TerrainResult, TerrainSample } from "@/app/land-intelligence/report-types";

export const runtime = "nodejs";
const SOURCE = "USGS 3DEP · Elevation Point Query Service";
const URL = "https://www.usgs.gov/3d-elevation-program";
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { until: number; result: TerrainResult }>();

async function sample(point: [number, number], distanceMeters: number | null): Promise<TerrainSample> {
  const params = new URLSearchParams({ x: point[0].toFixed(6), y: point[1].toFixed(6), units: "Meters", wkid: "4326" });
  const response = await fetch(`https://epqs.nationalmap.gov/v1/json?${params}`, { signal: AbortSignal.timeout(12000), cache: "no-store" });
  if (!response.ok) throw new Error(`EPQS HTTP ${response.status}`);
  const elevationMeters = Number((await response.json()).value);
  if (!Number.isFinite(elevationMeters) || elevationMeters <= -1000) throw new Error("No ground elevation");
  return { point, distanceMeters, elevationMeters };
}

export async function POST(request: NextRequest) {
  let shape: AnalysisShape;
  try { shape = await request.json() as AnalysisShape; } catch { return NextResponse.json({ error: "Invalid drawing." }, { status: 400 }); }
  if (!shape || !["pin", "line", "area"].includes(shape.kind) || !Array.isArray(shape.points) || !validShape(shape)) return NextResponse.json({ error: "Draw a valid pin, route or area." }, { status: 400 });
  if ((shape.kind === "line" && lengthMeters(shape.points) > 100000) || (shape.kind === "area" && (areaSquareMeters(shape.points) > 250000000 || lengthMeters(shape.points, true) > 100000))) {
    return NextResponse.json({ error: "Draw a smaller study area." }, { status: 400 });
  }
  const key = JSON.stringify(shape);
  const cached = cache.get(key);
  if (request.headers.get("x-land-refresh") !== "1" && cached && cached.until > Date.now()) return NextResponse.json(cached.result);
  if (shape.kind === "pin") return NextResponse.json({ status: "outside", shapeKind: shape.kind, samples: [], requested: 0, minMeters: null, maxMeters: null, ascentMeters: null, descentMeters: null, note: "Draw a route or area for sampled terrain. The pin elevation appears in the main report.", source: SOURCE, url: URL } satisfies TerrainResult);
  const points = terrainPoints(shape);
  const responses = await Promise.allSettled(points.map(({ point, distanceMeters }) => sample(point, distanceMeters)));
  const samples = responses.flatMap((response) => response.status === "fulfilled" ? [response.value] : []);
  const minimum = shape.kind === "line" ? 2 : 3;
  const usable = samples.length >= minimum;
  const stats = terrainStatistics(samples, shape.kind);
  const result: TerrainResult = {
    status: usable ? "found" : samples.length ? "none" : "unavailable", shapeKind: shape.kind, samples, requested: points.length, ...stats,
    note: usable
      ? `${shape.kind === "line" ? "Coarse route profile" : "Sampled elevation spread inside the drawing"} from ${samples.length} of ${points.length} requested 3DEP points. ${samples.length < points.length ? "Some samples failed; gaps may hide changes. " : ""}Elevations are interpolated, not surveyed. The samples do not establish site slope, grading volume or buildability.`
      : "Too few elevation samples returned for a terrain summary. Try a smaller drawing or check again.",
    source: SOURCE, url: URL,
  };
  if (usable && samples.length === points.length) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + CACHE_MS, result });
  }
  return NextResponse.json(result);
}
