import { NextRequest, NextResponse } from "next/server";
import { CRASH_FIELDS, CRASH_SOURCE, normalizeCrash } from "@/app/land-intelligence/crash";

export async function GET(request: NextRequest) {
  const bbox = request.nextUrl.searchParams.get("bbox")?.split(",").map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) return NextResponse.json({ error: "Valid map bounds are required." }, { status: 400 });
  const [west, south, east, north] = bbox;
  if (west < -180 || east > 180 || south < -15 || north > 72 || west >= east || south >= north) return NextResponse.json({ error: "Invalid map bounds." }, { status: 400 });
  if (east - west > 2 || north - south > 2) return NextResponse.json({ error: "Zoom in to see individual crash locations." }, { status: 422 });
  try {
    const params = new URLSearchParams({ where: "YEAR=2024", geometry: JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: CRASH_FIELDS, returnGeometry: "true", resultRecordCount: "500", f: "geojson" });
    const response = await fetch(`${CRASH_SOURCE}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 3_000_000) throw new Error("Crash view too dense");
    const json = JSON.parse(raw);
    if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected crash response");
    const features = json.features.filter((feature: GeoJSON.Feature) => feature.geometry?.type === "Point").map((feature: GeoJSON.Feature) => ({ type: "Feature" as const, id: feature.properties?.OBJECTID ?? feature.id, geometry: feature.geometry, properties: normalizeCrash(feature.properties ?? {}) }));
    return NextResponse.json({ type: "FeatureCollection", features, limited: !!json.exceededTransferLimit || features.length >= 500, year: 2024 }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
  } catch { return NextResponse.json({ error: "The national fatal crash source did not respond." }, { status: 503 }); }
}