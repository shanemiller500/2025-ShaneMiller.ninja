import { pointToParcelMeters, type InspectionGroup, type ParcelFinding, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";
import { arcgisFeatures } from "./arcgis-query";

const BASE = "https://dtdapps.codot.gov/server/rest/services/Webapps/open_data_sde/FeatureServer";
const ROADS = `${BASE}/14`;
const BRIDGES = `${BASE}/0`;
const field = (value: unknown) => value == null ? "" : String(value).trim();
const exactRecord = (url: string, id: string) => `${url}/query?${new URLSearchParams({ objectIds: id, outFields: "*", returnGeometry: "false", f: "pjson" })}`;
const resultStatus = (count: number, capped: boolean) => capped ? "partial" : count ? "found" : "coverage_unknown";

export async function coloradoLocalRoadGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "colorado-local-roads", label = "Colorado local road segments", source = "Colorado Department of Transportation", sourceUrl = ROADS;
  const note = "CDOT maps local road centerlines. A mapped crossing shows physical proximity only; it does not establish a driveway, public access, easement, maintenance responsibility, pavement condition, or legal right of way.";
  if (!parcelKey.startsWith("co:")) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Colorado only. ${note}`, findings: [] };
  try {
    const result = await arcgisFeatures(ROADS, geometry, "OBJECTID,ROUTENAME,SURFNAME,SURF_TYPE,AADT,AADTYR,GOVLEVEL,FIPSCOUNTY,FROM_DESCR,TO_DESCR", 0, signal);
    const findings: ParcelFinding[] = result.features.flatMap((feature) => {
      if (feature.geometry.type !== "LineString" && feature.geometry.type !== "MultiLineString") return [];
      const p = feature.properties ?? {};
      const recordId = field(p.OBJECTID ?? feature.id);
      if (!recordId) return [];
      const traffic = Number(p.AADT);
      return [{ id: `${id}:${recordId}`, name: field(p.ROUTENAME) || "Mapped local road", detail: [field(p.SURFNAME) ? `Surface: ${field(p.SURFNAME)}` : "", Number.isFinite(traffic) && traffic > 0 ? `Reported AADT: ${traffic.toLocaleString()}${field(p.AADTYR) ? ` (${field(p.AADTYR)})` : ""}` : "", field(p.FROM_DESCR) && field(p.TO_DESCR) ? `${field(p.FROM_DESCR)} to ${field(p.TO_DESCR)}` : ""].filter(Boolean).join(" · "), relationship: "intersects" as const, distanceMeters: null, sourceId: id, sourceRecordId: recordId, recordUrl: exactRecord(sourceUrl, recordId), recordDate: "", geometry: feature.geometry }];
    });
    return { id, label, source, sourceUrl, status: resultStatus(findings.length, result.capped), note, findings, recordLimit: 120 };
  } catch { return { id, label, source, sourceUrl, status: "source_error", note: `CDOT local road service did not respond. ${note}`, findings: [] }; }
}

export async function coloradoBridgeGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "colorado-bridges", label = "Colorado bridges and major culverts within 250 m", source = "Colorado Department of Transportation", sourceUrl = BRIDGES;
  const note = "CDOT structure points are nearby assets, not bridge footprints or parcel improvements. Distance is measured to the mapped point; confirm structure identity, condition and access with the owner.";
  if (!parcelKey.startsWith("co:")) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Colorado only. ${note}`, findings: [] };
  try {
    const result = await arcgisFeatures(BRIDGES, geometry, "OBJECTID,STRID,LOCATION,YEARBUILT,STRUCTURE_TYPE,CONDITION,URL,OFF_SYSTEM_ID", 250, signal);
    const findings: ParcelFinding[] = result.features.flatMap((feature) => {
      if (feature.geometry.type !== "Point") return [];
      const distance = pointToParcelMeters(feature.geometry.coordinates as [number, number], geometry);
      if (!Number.isFinite(distance) || distance > 250) return [];
      const p = feature.properties ?? {};
      const recordId = field(p.STRID || p.OBJECTID || feature.id);
      if (!recordId) return [];
      const rawUrl = field(p.URL);
      return [{ id: `${id}:${recordId}`, name: field(p.STRUCTURE_TYPE) || `Bridge or major culvert ${recordId}`, detail: [field(p.LOCATION), p.YEARBUILT ? `Built ${field(p.YEARBUILT)}` : "", field(p.CONDITION) ? `Source condition: ${field(p.CONDITION)}` : ""].filter(Boolean).join(" · "), relationship: distance <= 0.05 ? "inside" as const : "nearby" as const, distanceMeters: Math.round(distance), sourceId: id, sourceRecordId: recordId, recordUrl: /^https:\/\//i.test(rawUrl) ? rawUrl : exactRecord(sourceUrl, field(p.OBJECTID || feature.id)), recordDate: "", geometry: feature.geometry }];
    });
    return { id, label, source, sourceUrl, status: resultStatus(findings.length, result.capped), note, findings, recordLimit: 120 };
  } catch { return { id, label, source, sourceUrl, status: "source_error", note: `CDOT bridge service did not respond. ${note}`, findings: [] }; }
}
