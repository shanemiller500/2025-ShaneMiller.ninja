import { NextRequest, NextResponse } from "next/server";
import { CGS_AML_OPENINGS, DRMS_UNDERMINED, amlHazardLevel, mineNames } from "@/app/land-intelligence/underground";
import { usminKind } from "@/utils/geo/mines";
import { queryUsmin } from "@/utils/geo/usmin-server";

export const runtime = "nodejs";

const MAX_SPAN = 0.25;
const COLORADO: [number, number, number, number] = [-109.1, 36.9, -102, 41.1];

async function envelopeGeoJSON(url: string, [w, s, e, n]: [number, number, number, number], outFields: string, paged: boolean) {
  const features: GeoJSON.Feature[] = [];
  for (let offset = 0; offset < (paged ? 6000 : 1); offset += 2000) {
    const params = new URLSearchParams({ where: "1=1", geometry: JSON.stringify({ xmin: w, ymin: s, xmax: e, ymax: n, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields, returnGeometry: "true", maxAllowableOffset: "0.00003", f: "geojson" });
    if (paged) { params.set("resultOffset", String(offset)); params.set("resultRecordCount", "2000"); }
    const response = await fetch(`${url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(15000), next: { revalidate: 7 * 86400 } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = JSON.parse(await response.text());
    if (json.error || !Array.isArray(json.features)) throw new Error("Unexpected response");
    features.push(...json.features);
    if (!paged || (json.features.length < 2000 && !json.exceededTransferLimit && !json.properties?.exceededTransferLimit)) break;
  }
  return features;
}

/**
 * The Underground map layer for the view: Colorado undermined areas (DRMS), USGS USMIN mine symbols and mapped mine
 * areas (nationwide), and CGS-inventoried mine openings (Colorado national forest land). Each part fails independently.
 */
export async function GET(request: NextRequest) {
  const box = (request.nextUrl.searchParams.get("bbox") ?? "").split(",").map(Number) as [number, number, number, number];
  const [w, s, e, n] = box;
  if (box.length !== 4 || !box.every(Number.isFinite) || e <= w || n <= s) return NextResponse.json({ error: "bbox must be w,s,e,n." }, { status: 400 });
  if (e - w > MAX_SPAN || n - s > MAX_SPAN) return NextResponse.json({ error: "Zoom in to see underground features." }, { status: 422 });
  const colorado = e > COLORADO[0] && w < COLORADO[2] && n > COLORADO[1] && s < COLORADO[3];
  const [undermined, usmin, openings] = await Promise.allSettled([
    colorado ? envelopeGeoJSON(DRMS_UNDERMINED, box, "FID,MINE_NAME,Depth_Int", true) : Promise.resolve([]),
    queryUsmin(box, { points: 3000, polygons: 800 }),
    colorado ? envelopeGeoJSON(CGS_AML_OPENINGS, box, "FID,SITENAME_1,HTYPE,HAZ_RATING,CONDITION", false) : Promise.resolve([]),
  ]);
  const features: GeoJSON.Feature[] = [];
  if (undermined.status === "fulfilled") for (const feature of undermined.value) {
    const mines = mineNames(feature.properties?.MINE_NAME);
    features.push({ type: "Feature", geometry: feature.geometry, properties: { layer: "undermined", label: mines.length ? `Undermined: ${mines.slice(0, 4).join(", ")}${mines.length > 4 ? ` +${mines.length - 4} more` : ""}` : "Undermined area", depth: String(feature.properties?.Depth_Int ?? "").trim() } });
  }
  if (usmin.status === "fulfilled") for (const feature of [...usmin.value.polygons, ...usmin.value.points]) {
    const p = feature.properties ?? {};
    features.push({ type: "Feature", geometry: feature.geometry, properties: { layer: p.area ? "usmin-area" : "usmin", kind: usminKind(String(p.type ?? "")), label: [p.name, p.type].filter(Boolean).join(" · ") || "Mine feature", topo: p.topo ? `${p.topo} quad${p.topoDate ? ` (${p.topoDate})` : ""}` : "" } });
  }
  if (openings.status === "fulfilled") for (const feature of openings.value) {
    const p = feature.properties ?? {};
    features.push({ type: "Feature", geometry: feature.geometry, properties: { layer: "opening", hazard: amlHazardLevel(p.HAZ_RATING), label: [p.SITENAME_1 || "Mine opening", String(p.HTYPE ?? "").toLowerCase(), p.HAZ_RATING && `hazard: ${String(p.HAZ_RATING).toLowerCase()}`, p.CONDITION].filter(Boolean).join(" · ") } });
  }
  const parts = { undermined: colorado ? undermined.status : "outside", usmin: usmin.status, openings: colorado ? openings.status : "outside" };
  return NextResponse.json({ type: "FeatureCollection", features, parts, truncated: usmin.status === "fulfilled" && usmin.value.truncated }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
