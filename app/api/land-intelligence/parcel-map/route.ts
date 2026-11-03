import { NextRequest, NextResponse } from "next/server";
import { normalizeParcel, sourcesForBounds, type Bounds, type ParcelSource } from "@/app/land-intelligence/parcel-sources";
import { parcelMetrics } from "@/app/land-intelligence/parcel-analysis";
import type { ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";

async function querySource(source: ParcelSource, [west, south, east, north]: Bounds) {
  const params = new URLSearchParams({ where: "1=1", geometry: JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: source.fields, returnGeometry: "true", maxAllowableOffset: "0.000003", resultRecordCount: "500", f: "geojson" });
  const response = await fetch(`${source.url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(18000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw = await response.text();
  if (raw.length > 6_000_000) throw new Error("Parcel view too dense");
  const json = JSON.parse(raw);
  if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected parcel response");
  const polygons: GeoJSON.Feature[] = json.features.filter((feature: GeoJSON.Feature) => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon");
  const records = polygons.map((feature) => normalizeParcel(source, feature.properties ?? {}));
  // Condominium units are often published as separate records sharing one footprint; value density sums the stack.
  const stacks = new Map<string, number[]>();
  polygons.forEach((feature, index) => { const key = JSON.stringify((feature.geometry as ParcelGeometry).coordinates); stacks.set(key, [...(stacks.get(key) ?? []), index]); });
  const valuePerAcre = new Map<number, number | null>();
  for (const members of Array.from(stacks.values())) {
    const total = members.reduce((sum, index) => sum + (records[index].totalValue ?? 0), 0);
    // Value density: published total ÷ acres (source acreage for a single record, else the mapped polygon area).
    const acres = (members.length === 1 ? records[members[0]].acres : null) ?? parcelMetrics(polygons[members[0]].geometry as ParcelGeometry).areaMeters2 / 4046.8564224;
    for (const index of members) valuePerAcre.set(index, total > 0 && acres > 0 ? Math.round(total / acres) : null);
  }
  const features = polygons.map((feature, index) => {
    const objectid = feature.properties?.OBJECTID ?? feature.properties?.objectid ?? feature.id;
    const parcelKey = `${source.id}:${objectid}`;
    return { type: "Feature" as const, id: parcelKey, geometry: feature.geometry, properties: { ...records[index], parcelKey, valuePerAcre: valuePerAcre.get(index) ?? null } };
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
