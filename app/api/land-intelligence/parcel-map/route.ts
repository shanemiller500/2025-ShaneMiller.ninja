import { NextRequest, NextResponse } from "next/server";
import { normalizeParcel, sourcesForBounds, type Bounds, type ParcelSource } from "@/app/land-intelligence/parcel-sources";

async function querySource(source: ParcelSource, [west, south, east, north]: Bounds) {
  const params = new URLSearchParams({ where: "1=1", geometry: JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: source.fields, returnGeometry: "true", maxAllowableOffset: "0.000003", resultRecordCount: "500", f: "geojson" });
  const response = await fetch(`${source.url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(18000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw = await response.text();
  if (raw.length > 6_000_000) throw new Error("Parcel view too dense");
  const json = JSON.parse(raw);
  if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected parcel response");
  const features = json.features.filter((feature: GeoJSON.Feature) => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon").map((feature: GeoJSON.Feature) => {
    const objectid = feature.properties?.OBJECTID ?? feature.properties?.objectid ?? feature.id;
    const parcelKey = `${source.id}:${objectid}`;
    return { type: "Feature" as const, id: parcelKey, geometry: feature.geometry, properties: { ...normalizeParcel(source, feature.properties ?? {}), parcelKey } };
  });
  return { features, limited: !!json.exceededTransferLimit || features.length >= 500 };
}

export async function GET(request: NextRequest) {
  const bbox = request.nextUrl.searchParams.get("bbox")?.split(",").map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((number) => !Number.isFinite(number))) return NextResponse.json({ error: "Valid map bounds are required." }, { status: 400 });
  const bounds = bbox as Bounds;
  const [west, south, east, north] = bounds;
  if (west < -180 || east > 180 || south < -15 || north > 72 || west >= east || south >= north) return NextResponse.json({ error: "Invalid map bounds." }, { status: 400 });
  if (east - west > 0.2 || north - south > 0.2) return NextResponse.json({ error: "Zoom in to display individual parcels." }, { status: 422 });
  const sources = sourcesForBounds(bounds);
  if (!sources.length) return NextResponse.json({ type: "FeatureCollection", features: [], coverage: "outside", sources: [], limited: false, unavailable: [] });
  const results = await Promise.allSettled(sources.map((source) => querySource(source, bounds)));
  const features = results.flatMap((result) => result.status === "fulfilled" ? result.value.features : []);
  const unavailable = sources.filter((_, index) => results[index].status === "rejected").map((source) => source.state);
  const limited = results.some((result) => result.status === "fulfilled" && result.value.limited);
  return NextResponse.json({ type: "FeatureCollection", features, coverage: unavailable.length === sources.length ? "unavailable" : "covered", sources: sources.map((source) => ({ state: source.state, url: source.url })), limited, unavailable }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
}
