import { NextRequest, NextResponse } from "next/server";
import { CRASH_FIELDS, CRASH_SOURCE, normalizeCrash } from "@/app/land-intelligence/crash";
import { ALERT_SOURCE, CDOT_CRASH_URL, CONDITIONS_URL, linesNearMeters, pointToRoadMeters, ROAD_SOURCE, roadBounds, validRoadLine, type RoadAlert, type RoadCrash, type RoadLine, type RoadSegmentInfo, type RoadSegmentReport, type RoadSourceResult } from "@/app/land-intelligence/road-segment";

const ROAD_FIELDS = "OBJECTID,ROUTE,ALIAS,REFPT,ENDREFPT,SEG_LENGTH,CITY,COUNTY,FUNCCLASS,AADT,AADTYR,SPEEDLIM,PRISURF,THRULNQTY,DESCRIPTION,TERRAIN,PRIOUTSHLD";
const ALERT_FIELDS = "objectid,alertid,type,title,headline,description,locationdescription,impact,lastupdateddate,direction,roadname,roadwayclosure";
type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
const text = (value: unknown) => String(value ?? "").trim().slice(0, 1000);
const number = (value: unknown) => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const stamp = (value: unknown) => {
  const date = typeof value === "number" ? new Date(value) : new Date(text(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

async function query(url: string, params: URLSearchParams, signal: AbortSignal): Promise<{ features: Feature[]; limited: boolean }> {
  const response = await fetch(`${url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal, cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw = await response.text();
  if (raw.length > 3_000_000) throw new Error("Source response too large");
  const json = JSON.parse(raw);
  if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected source response");
  return { features: json.features, limited: !!json.exceededTransferLimit || json.features.length >= 500 };
}

function envelope(bounds: [number, number, number, number]) {
  const [xmin, ymin, xmax, ymax] = bounds;
  return JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } });
}

function mappedResult<T>(items: T[], limited: boolean, note: string, sourceUrl: string): RoadSourceResult<T> {
  return { status: limited ? "partial" : items.length ? "found" : "none", items, note: limited ? `${note} Provider limit reached; more records may exist.` : note, sourceUrl };
}

async function crashRecords(line: RoadLine, signal: AbortSignal): Promise<RoadSourceResult<RoadCrash>> {
  const note = "2024 FARS fatal crashes mapped within 50 m of this CDOT line. Locations are approximate; this is not all crashes or a verified segment assignment.";
  try {
    const params = new URLSearchParams({ where: "YEAR=2024", geometry: envelope(roadBounds(line, 60)), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: CRASH_FIELDS, returnGeometry: "true", resultRecordCount: "500", f: "geojson" });
    const result = await query(CRASH_SOURCE, params, signal);
    const items = result.features.slice(0, 100).flatMap((feature) => {
      if (feature.geometry?.type !== "Point") return [];
      const distance = pointToRoadMeters(feature.geometry.coordinates as [number, number], line);
      if (distance > 50) return [];
      const id = number(feature.properties?.OBJECTID ?? feature.id);
      return [{ ...normalizeCrash(feature.properties ?? {}), distanceMeters: Math.round(distance), recordUrl: id == null ? CRASH_SOURCE : `${CRASH_SOURCE}/query?objectIds=${id}&outFields=*&f=pjson` }];
    });
    return mappedResult(items, result.limited, note, CRASH_SOURCE);
  } catch { return { status: "unavailable", items: [], note: "The FARS fatal-crash service did not respond.", sourceUrl: CRASH_SOURCE }; }
}

async function activeAlerts(line: RoadLine, signal: AbortSignal): Promise<RoadSourceResult<RoadAlert>> {
  const note = "Current COtrip line alerts mapped within 75 m of this segment. Alerts may span adjacent roads or intersections; check COtrip before travel.";
  try {
    const params = new URLSearchParams({ where: "1=1", geometry: envelope(roadBounds(line, 100)), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: ALERT_FIELDS, returnGeometry: "true", resultRecordCount: "500", f: "geojson" });
    const result = await query(ALERT_SOURCE, params, signal);
    const items = result.features.flatMap((feature) => {
      if (!validRoadLine(feature.geometry)) return [];
      if (linesNearMeters(feature.geometry, line) > 75) return [];
      const p = feature.properties ?? {};
      const id = text(p.alertid || p.objectid || feature.id);
      const objectId = number(p.objectid ?? feature.id);
      return [{ id, type: text(p.type), title: text(p.title || p.headline || "Road alert"), description: text(p.description || p.headline), location: text(p.locationdescription || p.roadname), impact: text(p.impact || p.roadwayclosure), direction: text(p.direction), updatedAt: stamp(p.lastupdateddate), recordUrl: objectId == null ? ALERT_SOURCE : `${ALERT_SOURCE}/query?objectIds=${objectId}&outFields=*&f=pjson` }];
    });
    return mappedResult(items, result.limited || result.features.length > 100, note, ALERT_SOURCE);
  } catch { return { status: "unavailable", items: [], note: "The live COtrip alert source did not respond. Check COtrip directly for current conditions.", sourceUrl: ALERT_SOURCE }; }
}

export async function GET(request: NextRequest) {
  const idText = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[1-9]\d{0,9}$/.test(idText)) return NextResponse.json({ error: "A valid CDOT segment ID is required." }, { status: 400 });
  const id = Number(idText);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
  let feature: Feature;
  try {
    const params = new URLSearchParams({ where: `OBJECTID=${id}`, outFields: ROAD_FIELDS, returnGeometry: "true", outSR: "4326", f: "geojson" });
    const result = await query(ROAD_SOURCE, params, signal);
    if (!result.features.length) return NextResponse.json({ error: "CDOT did not return that highway segment." }, { status: 404 });
    feature = result.features[0];
    if (!validRoadLine(feature.geometry)) throw new Error("Invalid road geometry");
    const [west, south, east, north] = roadBounds(feature.geometry);
    if (west < -110 || east > -101 || south < 36 || north > 42 || east - west > 0.3 || north - south > 0.3) throw new Error("Road segment exceeds a safe query area");
  } catch { return NextResponse.json({ error: "The CDOT highway segment could not be loaded." }, { status: 503 }); }

  const p = feature.properties ?? {};
  const line = feature.geometry as RoadLine;
  const road: RoadSegmentInfo = { id, route: text(p.ROUTE), alias: text(p.ALIAS), city: text(p.CITY), county: text(p.COUNTY), fromMile: number(p.REFPT), toMile: number(p.ENDREFPT), lengthMiles: number(p.SEG_LENGTH), aadt: number(p.AADT), aadtYear: text(p.AADTYR), speedLimit: number(p.SPEEDLIM), surface: text(p.PRISURF), lanes: number(p.THRULNQTY), terrain: text(p.TERRAIN), shoulder: text(p.PRIOUTSHLD), functionalClass: text(p.FUNCCLASS), sourceUrl: `${ROAD_SOURCE}/query?objectIds=${id}&outFields=*&f=pjson` };
  const [crashes, alerts] = await Promise.all([crashRecords(line, signal), activeAlerts(line, signal)]);
  const report: RoadSegmentReport = { checkedAt: new Date().toISOString(), road, crashes, alerts, conditionsUrl: CONDITIONS_URL, allCrashDataUrl: CDOT_CRASH_URL };
  return NextResponse.json(report, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
}
