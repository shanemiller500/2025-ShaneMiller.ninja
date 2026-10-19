import { NextRequest, NextResponse } from "next/server";
import { soilCategory } from "@/app/land-intelligence/soil";

const SOURCE = "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/soils/cg_soils/MapServer/0/query";

export async function GET(request: NextRequest) {
  const bbox = request.nextUrl.searchParams.get("bbox")?.split(",").map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) return NextResponse.json({ error: "Valid map bounds are required." }, { status: 400 });
  const [west, south, east, north] = bbox;
  if (west < -180 || east > 180 || south < -15 || north > 72 || west >= east || south >= north) return NextResponse.json({ error: "The map view is outside supported U.S. soil survey bounds." }, { status: 400 });
  if (east - west > 0.25 || north - south > 0.25) return NextResponse.json({ error: "Zoom in to display soil polygons." }, { status: 422 });
  try {
    const body = new URLSearchParams({
      where: "1=1", geometry: JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects",
      outFields: "objectid,mukey,musym,muname,mukind,areasymbol,farmlndcl,nirrcapcl",
      returnGeometry: "true", maxAllowableOffset: "0.000015", resultRecordCount: "1000", f: "geojson",
    });
    const response = await fetch(SOURCE, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(18000), cache: "no-store" });
    if (!response.ok) throw new Error(`NRCS HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 6_000_000) throw new Error("The soil view is too dense; zoom in further.");
    const json = JSON.parse(raw);
    if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error(json.error?.message ?? "Unexpected NRCS soil response");
    const features = json.features.filter((feature: GeoJSON.Feature) => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon").map((feature: GeoJSON.Feature) => ({
      type: "Feature" as const, id: feature.properties?.objectid, geometry: feature.geometry,
      properties: { ...feature.properties, objectid: feature.properties?.objectid ?? feature.id, category: soilCategory(String(feature.properties?.muname ?? "")) },
    }));
    return NextResponse.json({ type: "FeatureCollection", features, limited: !!json.exceededTransferLimit || features.length >= 1000 }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The soil service is unavailable." }, { status: 502 }); }
}
