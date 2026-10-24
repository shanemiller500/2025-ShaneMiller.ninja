import { NextRequest, NextResponse } from "next/server";
import { FACILITY_FIELDS, FACILITY_SOURCE, normalizeFacility } from "@/app/land-intelligence/facility";

export async function GET(request: NextRequest) {
  const bbox = request.nextUrl.searchParams.get("bbox")?.split(",").map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) return NextResponse.json({ error: "Valid map bounds are required." }, { status: 400 });
  const [west, south, east, north] = bbox;
  if (west < -180 || east > 180 || south < -15 || north > 72 || west >= east || south >= north) return NextResponse.json({ error: "Invalid map bounds." }, { status: 400 });
  if (east - west > 1 || north - south > 1) return NextResponse.json({ error: "Zoom in to see individual EPA facilities." }, { status: 422 });
  try {
    const params = new URLSearchParams({ where: "1=1", geometry: JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: FACILITY_FIELDS, returnGeometry: "true", resultRecordCount: "1000", f: "geojson" });
    const response = await fetch(`${FACILITY_SOURCE}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 4_000_000) throw new Error("Facility view too dense");
    const json = JSON.parse(raw);
    if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected facility response");
    const features = json.features.filter((feature: GeoJSON.Feature) => feature.geometry?.type === "Point").map((feature: GeoJSON.Feature, index: number) => ({ type: "Feature" as const, id: index, geometry: feature.geometry, properties: normalizeFacility(feature.properties ?? {}) }));
    return NextResponse.json({ type: "FeatureCollection", features, limited: !!json.exceededTransferLimit || features.length >= 1000 }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch { return NextResponse.json({ error: "The EPA facility source did not respond." }, { status: 503 }); }
}
