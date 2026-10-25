import { NextRequest, NextResponse } from "next/server";
import { LAND_OVERLAYS } from "@/app/land-intelligence/layers";
import { PARCEL_KEY } from "@/app/land-intelligence/parcel-detail";
import { parcelBounds, pointToParcelMeters, validParcelGeometry, type InspectionGroup, type ParcelFinding, type ParcelGeometry, type ParcelInspectionReport } from "@/app/land-intelligence/parcel-inspection";
import { KARST_CLASSES, KARST_SERVICE } from "@/utils/geo/karst";
import { queryUsminPoints } from "@/utils/geo/usmin-server";
import { groundwaterSitesGroup, surveyControlGroup } from "./phase2";
import { arcgisFeatures } from "./arcgis-query";
import { coloradoTankGroup, denverStormGroup, floridaSubsidenceGroup, unqueriedUtilityGroups } from "./phase3";

export const runtime = "nodejs";

type SourceId = "flood" | "wetlands" | "waterways" | "soils" | "faults" | "roads" | "facilities" | "superfund";
const SOURCE_FIELDS: Record<SourceId, string> = {
  flood: "OBJECTID,FLD_ZONE,ZONE_SUBTY,SFHA_TF",
  wetlands: "OBJECTID,WETLAND_TYPE,ATTRIBUTE,ACRES",
  waterways: "OBJECTID,GNIS_NAME,FTYPE,FCODE",
  soils: "objectid,mukey,musym,muname,farmlndcl",
  faults: "OBJECTID,fault_name,age,mapped_certainty,last_review",
  roads: "OBJECTID,ROUTE,ALIAS,AADT,AADTYR,SPEEDLIM",
  facilities: "OBJECTID,REGISTRY_ID,FAC_NAME,FAC_CITY,FAC_STATE,FAC_ACCURACY_METERS",
  superfund: "OBJECTID,EPA_ID,Site_Name,City,State,NPL_Status,FACILITY_URL",
};
const SOURCE_NOTES: Record<SourceId, string> = {
  flood: "FEMA mapping varies by community. No returned polygon does not confirm no flood risk or mapped coverage.",
  wetlands: "NWI is an inventory, not a jurisdictional wetland determination; mapped coverage and imagery dates vary.",
  waterways: "USGS legacy hydrography can omit small or altered drainage features.",
  soils: "This connected NRCS map service describes a FY2015 SSURGO snapshot, not conditions verified by a site boring. Check current Web Soil Survey data.",
  faults: "Mapped fault traces are regional reference features, not a site seismic design assessment.",
  roads: "Colorado state highways only; local streets and legal access are not assessed.",
  facilities: "EPA facility coordinates may be approximate. Proximity does not establish contamination or exposure.",
  superfund: "EPA site polygons reflect current understanding of a whole site; they are not legal boundaries or parcel-specific contamination findings. Some sites have no mapped polygon.",
};
const reportCache = new Map<string, { expires: number; report: ParcelInspectionReport }>();

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
  const point = feature.geometry.type === "Point" ? feature.geometry.coordinates as [number, number] : null;
  const distance = point ? pointToParcelMeters(point, geometry) : null;
  const source = id === "karst" ? KARST_SERVICE : service(id as SourceId).url;
  return {
    id: `${id}:${tag}:${recordId || feature.id || JSON.stringify(feature.geometry).slice(0, 80)}`,
    name: names[id] || "Mapped feature", detail: details[id] || "",
    relationship: distance == null ? "intersects" : distance <= 1 ? "inside" : "nearby",
    distanceMeters: distance == null ? null : Math.round(distance),
    sourceId: id, sourceRecordId: recordId,
    recordUrl: id === "roads" && /^\d+$/.test(recordId) ? `${source}/query?objectIds=${recordId}&outFields=*&f=pjson` : id === "facilities" && p.REGISTRY_ID ? `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(field(p.REGISTRY_ID))}` : id === "superfund" && /^https:\/\//.test(field(p.FACILITY_URL)) ? field(p.FACILITY_URL) : source,
    recordDate: field(p.last_review ?? p.AADTYR ?? p.topoDate), geometry: feature.geometry,
  };
}

async function landGroup(id: SourceId, geometry: ParcelGeometry, isColorado: boolean, signal?: AbortSignal): Promise<InspectionGroup> {
  const meta = service(id);
  if (id === "roads" && !isColorado) return { id, label: meta.label, source: meta.source, sourceUrl: meta.url, status: "outside_coverage", note: SOURCE_NOTES[id], findings: [] };
  try {
    const result = await arcgisFeatures(meta.url, geometry, SOURCE_FIELDS[id], id === "facilities" ? 500 : 0, signal);
    const findings = result.features.map((feature) => finding(id, feature, geometry));
    const emptyStatus = ["flood", "wetlands", "soils", "facilities", "superfund"].includes(id) ? "coverage_unknown" : "no_features";
    return { id, label: meta.label, source: meta.source, sourceUrl: meta.url, status: result.capped ? "partial" : findings.length ? "found" : emptyStatus, note: SOURCE_NOTES[id], findings };
  } catch {
    return { id, label: meta.label, source: meta.source, sourceUrl: meta.url, status: "unavailable", note: `${meta.source} did not respond. ${SOURCE_NOTES[id]}`, findings: [] };
  }
}

async function karstGroup(geometry: ParcelGeometry, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "karst", label = "Karst geology", source = "USGS karst map", sourceUrl = KARST_SERVICE;
  const settled = await Promise.allSettled(KARST_CLASSES.map((cls) => arcgisFeatures(`${KARST_SERVICE}/${cls.layer}`, geometry, "OBJECTID,KARST_TYPE,UNIT_NAME,UNIT_AGE", 0, signal)));
  const findings = settled.flatMap((entry, index) => entry.status === "fulfilled" ? entry.value.features.map((feature) => finding(id, feature, geometry, KARST_CLASSES[index].key)) : []);
  const failed = settled.filter((entry) => entry.status === "rejected").length;
  const capped = settled.some((entry) => entry.status === "fulfilled" && entry.value.capped);
  return { id, label, source, sourceUrl, status: failed === settled.length ? "unavailable" : failed || capped ? "partial" : findings.length ? "found" : "no_features", note: "Mapped rock type only. It does not locate caves, voids, or parcel-specific sinkhole risk.", findings };
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
    return { id, label, source, sourceUrl, status: "unavailable", note: "USMIN did not respond; mine records may still exist.", findings: [] };
  }
}

export async function POST(request: NextRequest) {
  let body: { parcelKey?: string; geometry?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid parcel inspection request." }, { status: 400 }); }
  if (!PARCEL_KEY.test(body.parcelKey ?? "") || !validParcelGeometry(body.geometry)) return NextResponse.json({ error: "A valid selected parcel polygon is required." }, { status: 400 });
  const geometry = body.geometry;
  const cacheKey = JSON.stringify([body.parcelKey, geometry]);
  const cached = reportCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.report, { headers: { "Cache-Control": "private, max-age=0" } });
  const isColorado = body.parcelKey?.startsWith("co:") ?? false;
  const groups = await Promise.all([
    ...(["flood", "wetlands", "waterways", "soils", "faults", "roads", "facilities", "superfund"] as SourceId[]).map((id) => landGroup(id, geometry, isColorado, request.signal)),
    karstGroup(geometry, request.signal), mineGroup(geometry, request.signal),
    surveyControlGroup(geometry, request.signal), groundwaterSitesGroup(geometry, request.signal),
    denverStormGroup(geometry, body.parcelKey!, request.signal), coloradoTankGroup(geometry, body.parcelKey!, request.signal), floridaSubsidenceGroup(geometry, body.parcelKey!, request.signal),
  ]);
  const report: ParcelInspectionReport = { parcelKey: body.parcelKey!, checkedAt: new Date().toISOString(), groups: [...groups, ...unqueriedUtilityGroups()] };
  if (!request.signal?.aborted && groups.every((group) => group.status !== "unavailable" && group.status !== "partial")) {
    if (reportCache.size >= 12) reportCache.delete(reportCache.keys().next().value!);
    reportCache.set(cacheKey, { expires: Date.now() + 3 * 60 * 1000, report });
  }
  return NextResponse.json(report, { headers: { "Cache-Control": "private, max-age=0" } });
}
