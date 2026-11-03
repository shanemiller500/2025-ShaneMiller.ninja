import { NextRequest, NextResponse } from "next/server";
import { loadStateBundle } from "@/app/land-intelligence/market-data";
import { acsProfile, permitSummary, tractChange } from "@/app/land-intelligence/market";

export const runtime = "nodejs";

// Census TIGERweb current boundaries (public domain): layer 0 = census tracts (2020 vintage, the ACS 2024 geography), 1 = counties.
const TIGERWEB = { tract: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0", county: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1" } as const;
const MAX_SPAN = { tract: 0.6, county: 20 } as const;
const LIMIT = 2000;

/** Tract or county polygons in the view, joined to imported ACS, FHFA and permit values by GEOID. */
export async function GET(request: NextRequest) {
  const level = request.nextUrl.searchParams.get("level") === "county" ? "county" : "tract";
  const bbox = request.nextUrl.searchParams.get("bbox")?.split(",").map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) return NextResponse.json({ error: "Valid map bounds are required." }, { status: 400 });
  const [west, south, east, north] = bbox;
  if (west < -180 || east > -64 || south < 17 || north > 72 || west >= east || south >= north) return NextResponse.json({ error: "Market overlays cover the United States." }, { status: 400 });
  if (east - west > MAX_SPAN[level] || north - south > MAX_SPAN[level]) return NextResponse.json({ error: level === "tract" ? "Zoom in to see census tracts." : "Zoom in to see counties." }, { status: 422 });
  const body = new URLSearchParams({
    geometry: JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "GEOID,NAME", returnGeometry: "true",
    // About one screen pixel at a 1,000-pixel-wide view: lighter payloads without visible distortion.
    maxAllowableOffset: String(Math.max(east - west, north - south) / 1000), resultRecordCount: String(LIMIT), f: "geojson",
  });
  let json: { features?: GeoJSON.Feature[]; exceededTransferLimit?: boolean; properties?: { exceededTransferLimit?: boolean }; error?: unknown };
  try {
    const response = await fetch(`${TIGERWEB[level]}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    json = await response.json();
    if (json.error || !Array.isArray(json.features)) throw new Error("Unexpected boundary response");
  } catch { return NextResponse.json({ error: "Census boundary service did not respond." }, { status: 503 }); }
  const states = Array.from(new Set(json.features!.map((feature) => String(feature.properties?.GEOID ?? "").slice(0, 2))));
  const bundles = new Map(await Promise.all(states.map(async (fips) => [fips, await loadStateBundle(fips)] as const)));
  const features = json.features!.filter((feature) => feature.geometry && /Polygon/.test(feature.geometry.type)).map((feature) => {
    const id = String(feature.properties?.GEOID ?? ""), name = String(feature.properties?.NAME ?? "");
    const bundle = bundles.get(id.slice(0, 2));
    if (level === "tract") {
      const tract = bundle?.tracts[id];
      const profile = acsProfile(tract?.acs), trend = tractChange(tract?.hpi);
      return { type: "Feature" as const, id, geometry: feature.geometry, properties: {
        id, name, medianValue: profile?.medianValue.value ?? null, valueReliability: profile?.medianValue.reliability ?? "unknown", valueBound: profile?.medianValue.bound ?? "",
        medianRent: profile?.medianRent.value ?? null, rentReliability: profile?.medianRent.reliability ?? "unknown", rentBound: profile?.medianRent.bound ?? "",
        fiveYear: trend?.fiveYear ?? null, oneYear: trend?.oneYear ?? null, trendYear: trend?.latest ?? "",
      } };
    }
    const county = bundle?.counties[id];
    const profile = acsProfile(county?.acs), permits = permitSummary(county?.permits, profile?.housingUnits.value ?? null);
    return { type: "Feature" as const, id, geometry: feature.geometry, properties: { id, name, permitsPerThousand: permits?.perThousandHomes ?? null, permitUnits: permits?.latestUnits ?? null, permitYear: permits?.latestYear ?? null, medianValue: profile?.medianValue.value ?? null } };
  });
  const limited = !!(json.exceededTransferLimit || json.properties?.exceededTransferLimit) || json.features!.length >= LIMIT;
  return NextResponse.json({ type: "FeatureCollection", features, level, limited }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
