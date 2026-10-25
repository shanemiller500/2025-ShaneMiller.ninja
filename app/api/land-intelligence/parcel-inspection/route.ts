import { NextRequest, NextResponse } from "next/server";
import { LAND_OVERLAYS } from "@/app/land-intelligence/layers";
import { createHash } from "node:crypto";
import { PARCEL_KEY, queryParcelGeometry } from "@/app/land-intelligence/parcel-detail";
import { parcelBounds, pointToParcelMeters, validParcelGeometry, type InspectionGroup, type ParcelFinding, type ParcelGeometry, type ParcelInspectionReport } from "@/app/land-intelligence/parcel-inspection";
import { KARST_CLASSES, KARST_SERVICE } from "@/utils/geo/karst";
import { queryUsminPoints } from "@/utils/geo/usmin-server";
import { groundwaterSitesGroup, surveyControlGroup } from "./phase2";
import { arcgisFeatures } from "./arcgis-query";
import { spatialRelation } from "./spatial-match";
import { PROVIDER_POLICY, type SourceId } from "./provider-policy";
import { coloradoTankGroup, denverStormGroup, floridaSubsidenceGroup, unqueriedUtilityGroups } from "./phase3";
import { coloradoBridgeGroup, coloradoLocalRoadGroup } from "./colorado-transport";

export const runtime = "nodejs";

const reportCache = new Map<string, { expires: number; report: ParcelInspectionReport }>();
const geometryCache = new Map<string, { expires: number; geometry: ParcelGeometry }>();
const geometryInFlight = new Map<string, Promise<ParcelGeometry | null>>();
const reportsInFlight = new Map<string, { promise: Promise<ParcelInspectionReport>; controller: AbortController; users: number }>();
const INSPECTION_VERSION = "3";

function waitForReport(promise: Promise<ParcelInspectionReport>, signal?: AbortSignal) {
  if (!signal) return promise;
  return new Promise<ParcelInspectionReport>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Request aborted")); return; }
    const abort = () => reject(new Error("Request aborted"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function resolvedGeometry(key: string) {
  const cached = geometryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.geometry;
  let pending = geometryInFlight.get(key);
  if (!pending) {
    pending = queryParcelGeometry(key).then((geometry) => {
      if (geometry) {
        if (geometryCache.size >= 30) geometryCache.delete(geometryCache.keys().next().value!);
        geometryCache.set(key, { expires: Date.now() + 3 * 60_000, geometry });
      }
      return geometry;
    }).finally(() => geometryInFlight.delete(key));
    geometryInFlight.set(key, pending);
  }
  return pending;
}

const field = (value: unknown) => value == null ? "" : String(value).trim();
const service = (id: SourceId) => {
  if (id === "superfund") return { label: "EPA Superfund boundaries", source: "U.S. EPA", url: "https://geopub.epa.gov/ArcGIS/rest/services/NEPAssist/NEPAVELayersPublic_fgdb/MapServer/14" };
  const overlay = LAND_OVERLAYS.find((item) => item.id === id)!;
  return { label: overlay.label, source: overlay.source, url: id === "soils" ? overlay.url : `${overlay.url}/${overlay.layer}` };
};

function finding(id: string, feature: GeoJSON.Feature, geometry: ParcelGeometry, tag = ""): ParcelFinding {
  const p = feature.properties ?? {};
  const recordId = field(p.EPA_ID ?? p.OBJECTID ?? p.objectid ?? p.REGISTRY_ID ?? p.mukey ?? feature.id);
  const names: Record<string, string> = {
    flood: `Zone ${field(p.FLD_ZONE) || "unclassified"}`,
    wetlands: field(p.WETLAND_TYPE) || "Mapped wetland",
    waterways: field(p.GNIS_NAME) || "Mapped waterway",
    soils: field(p.muname) || "Soil map unit",
    faults: field(p.fault_name) || "Mapped fault",
    roads: [field(p.ROUTE), field(p.ALIAS)].filter(Boolean).join(" ") || "State highway",
    facilities: field(p.FAC_NAME) || "EPA regulated facility",
    karst: field(p.UNIT_NAME) || field(p.KARST_TYPE) || "Karst map unit",
    superfund: field(p.Site_Name) || "Mapped Superfund site",
  };
  const details: Record<string, string> = {
    flood: [field(p.ZONE_SUBTY), field(p.SFHA_TF).toUpperCase() === "T" ? "Special flood hazard area" : ""].filter(Boolean).join(" · "),
    wetlands: [field(p.ATTRIBUTE), p.ACRES == null ? "" : `${p.ACRES} reported acres`].filter(Boolean).join(" · "),
    waterways: [field(p.FTYPE), field(p.FCODE)].filter(Boolean).join(" · "),
    soils: [field(p.musym), field(p.farmlndcl)].filter(Boolean).join(" · "),
    faults: [field(p.age), field(p.mapped_certainty)].filter(Boolean).join(" · "),
    roads: p.AADT == null ? "" : `${Number(p.AADT).toLocaleString()} reported vehicles/day${p.AADTYR ? ` (${p.AADTYR})` : ""}`,
    facilities: [field(p.FAC_CITY), field(p.FAC_STATE), p.FAC_ACCURACY_METERS ? `Reported accuracy ${p.FAC_ACCURACY_METERS} m` : ""].filter(Boolean).join(" · "),
    karst: [field(p.KARST_TYPE), field(p.UNIT_AGE)].filter(Boolean).join(" · "),
    superfund: [field(p.NPL_Status), field(p.City), field(p.State)].filter(Boolean).join(" · "),
  };
  const relation = spatialRelation(feature.geometry, geometry, id === "facilities" ? 500 : 0);
  const source = id === "karst" ? KARST_SERVICE : service(id as SourceId).url;
  return {
    id: `${id}:${tag}:${recordId || feature.id || JSON.stringify(feature.geometry).slice(0, 80)}`,
    name: names[id] || "Mapped feature", detail: details[id] || "",
    relationship: relation?.relationship ?? "intersects",
    distanceMeters: relation?.distanceMeters ?? null,
    sourceId: id, sourceRecordId: recordId,
    recordUrl: id === "roads" && /^\d+$/.test(recordId) ? `${source}/query?objectIds=${recordId}&outFields=*&f=pjson` : id === "facilities" && p.REGISTRY_ID ? `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(field(p.REGISTRY_ID))}` : id === "superfund" && /^https:\/\//.test(field(p.FACILITY_URL)) ? field(p.FACILITY_URL) : source,
    recordDate: field(p.last_review ?? p.AADTYR ?? p.topoDate), geometry: feature.geometry,
    verification: "official_map",
    positionalAccuracyMeters: id === "facilities" && Number.isFinite(Number(p.FAC_ACCURACY_METERS)) ? Number(p.FAC_ACCURACY_METERS) : null,
  };
}

async function landGroup(id: SourceId, geometry: ParcelGeometry, isColorado: boolean, signal?: AbortSignal): Promise<InspectionGroup> {
  const meta = service(id);
  const policy = PROVIDER_POLICY[id];
  if ("state" in policy && policy.state === "co" && !isColorado) return { id, label: meta.label, source: meta.source, sourceUrl: meta.url, status: "outside_coverage", note: policy.note, findings: [] };
  try {
    const result = await arcgisFeatures(meta.url, geometry, policy.fields, policy.nearbyMeters, signal);
    const findings = result.features.map((feature) => finding(id, feature, geometry));
    return { id, label: meta.label, source: meta.source, sourceUrl: meta.url, status: result.capped ? "partial" : findings.length ? "found" : policy.emptyStatus, note: policy.note, findings, recordLimit: 120 };
  } catch {
    return { id, label: meta.label, source: meta.source, sourceUrl: meta.url, status: "source_error", note: `${meta.source} did not respond. ${policy.note}`, findings: [] };
  }
}

async function karstGroup(geometry: ParcelGeometry, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "karst", label = "Karst geology", source = "USGS karst map", sourceUrl = KARST_SERVICE;
  const settled = await Promise.allSettled(KARST_CLASSES.map((cls) => arcgisFeatures(`${KARST_SERVICE}/${cls.layer}`, geometry, "OBJECTID,KARST_TYPE,UNIT_NAME,UNIT_AGE", 0, signal)));
  const findings = settled.flatMap((entry, index) => entry.status === "fulfilled" ? entry.value.features.map((feature) => finding(id, feature, geometry, KARST_CLASSES[index].key)) : []);
  const failed = settled.filter((entry) => entry.status === "rejected").length;
  const capped = settled.some((entry) => entry.status === "fulfilled" && entry.value.capped);
  return { id, label, source, sourceUrl, status: failed === settled.length ? "source_error" : failed || capped ? "partial" : findings.length ? "found" : "no_features", note: "Mapped rock type only. It does not locate caves, voids, or parcel-specific sinkhole risk.", findings };
}

async function mineGroup(geometry: ParcelGeometry, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "mines", label = "Historical mine symbols", source = "USGS USMIN", sourceUrl = "https://mrdata.usgs.gov/usmin/";
  const [w, s, e, n] = parcelBounds(geometry);
  const lat = (s + n) / 2;
  const padY = 0.5 / 111.2, padX = 0.5 / (111.2 * Math.cos(lat * Math.PI / 180));
  const box: [number, number, number, number] = [w - padX, s - padY, e + padX, n + padY];
  if (box[2] - box[0] > 0.5 || box[3] - box[1] > 0.5) return { id, label, source, sourceUrl, status: "coverage_unknown", note: "Parcel is too large for the existing USMIN viewport query.", findings: [] };
  try {
    const result = await queryUsminPoints(box, 500, signal);
    const findings = result.points.flatMap((feature) => {
      if (feature.geometry?.type !== "Point") return [];
      const distance = pointToParcelMeters(feature.geometry.coordinates as [number, number], geometry);
      if (distance > 500) return [];
      const p = feature.properties ?? {};
      return [{ id: `mines:${feature.id}`, name: field(p.name) || field(p.type) || "Historical mine symbol", detail: [field(p.type), field(p.topo), p.scale ? `Map scale 1:${p.scale}` : ""].filter(Boolean).join(" · "), relationship: distance <= 1 ? "inside" as const : "nearby" as const, distanceMeters: Math.round(distance), sourceId: id, sourceRecordId: field(feature.id), recordUrl: /^https:\/\//.test(field(p.url)) ? field(p.url) : sourceUrl, recordDate: field(p.topoDate), geometry: feature.geometry }];
    });
    return { id, label, source, sourceUrl, status: result.truncated ? "partial" : findings.length ? "found" : "no_features", note: "Historical topographic-map symbols within 500 m. These do not delineate underground workings; mapped mine areas are not assessed here.", findings };
  } catch {
    return { id, label, source, sourceUrl, status: "source_error", note: "USMIN did not respond; mine records may still exist.", findings: [] };
  }
}

export async function POST(request: NextRequest) {
  let body: { parcelKey?: string; geometry?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid parcel inspection request." }, { status: 400 }); }
  if (!PARCEL_KEY.test(body.parcelKey ?? "") || (body.geometry !== undefined && !validParcelGeometry(body.geometry)))
    return NextResponse.json({ error: "A valid selected parcel key is required." }, { status: 400 });
  const parcelKey = body.parcelKey!;
  let geometry: ParcelGeometry | null;
  try { geometry = await resolvedGeometry(parcelKey); }
  catch { return NextResponse.json({ error: "The parcel source could not verify this boundary. Try again shortly." }, { status: 503 }); }
  if (!geometry) return NextResponse.json({ error: "The selected parcel was not found in its source." }, { status: 404 });
  if (request.signal?.aborted) return NextResponse.json({ error: "Inspection cancelled." }, { status: 408 });
  const fingerprint = createHash("sha256").update(JSON.stringify(geometry)).digest("hex");
  const cacheKey = `${INSPECTION_VERSION}:${parcelKey}:${fingerprint}`;
  const cached = reportCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.report, { headers: { "Cache-Control": "private, max-age=0" } });
  let flight = reportsInFlight.get(cacheKey);
  if (!flight) {
    const controller = new AbortController();
    const promise = buildReport(cacheKey, parcelKey, geometry, controller.signal).finally(() => reportsInFlight.delete(cacheKey));
    flight = { promise, controller, users: 0 };
    reportsInFlight.set(cacheKey, flight);
  }
  flight.users++;
  const current = flight;
  try {
    const report = await waitForReport(current.promise, request.signal);
    return NextResponse.json(report, { headers: { "Cache-Control": "private, max-age=0" } });
  } catch {
    return NextResponse.json({ error: request.signal?.aborted ? "Inspection cancelled." : "Parcel inspection failed." }, { status: request.signal?.aborted ? 408 : 503 });
  } finally {
    current.users--;
    if (current.users === 0 && reportsInFlight.get(cacheKey) === current) current.controller.abort();
  }
}

async function buildReport(cacheKey: string, parcelKey: string, geometry: ParcelGeometry, signal: AbortSignal): Promise<ParcelInspectionReport> {
  const isColorado = parcelKey.startsWith("co:");
  const groups = await Promise.all([
    ...(Object.keys(PROVIDER_POLICY) as SourceId[]).map((id) => landGroup(id, geometry, isColorado, signal)),
    karstGroup(geometry, signal), mineGroup(geometry, signal),
    surveyControlGroup(geometry, signal), groundwaterSitesGroup(geometry, signal),
    coloradoLocalRoadGroup(geometry, parcelKey, signal), coloradoBridgeGroup(geometry, parcelKey, signal),
    denverStormGroup(geometry, parcelKey, signal), coloradoTankGroup(geometry, parcelKey, signal), floridaSubsidenceGroup(geometry, parcelKey, signal),
  ]);
  const checkedAt = new Date().toISOString();
  const report: ParcelInspectionReport = { parcelKey, geometry, geometrySource: "Authoritative parcel layer; full-resolution feature", checkedAt, groups: [...groups, ...unqueriedUtilityGroups()].map((group) => ({ ...group, checkedAt, coverage: group.status === "outside_coverage" ? "outside" : "unknown" })) };
  if (!signal.aborted && groups.every((group) => group.status !== "unavailable" && group.status !== "source_error" && group.status !== "partial")) {
    if (reportCache.size >= 12) reportCache.delete(reportCache.keys().next().value!);
    reportCache.set(cacheKey, { expires: Date.now() + 3 * 60 * 1000, report });
  }
  return report;
}
