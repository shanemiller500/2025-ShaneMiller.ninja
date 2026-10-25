import { parcelBounds, pointToParcelMeters, type InspectionGroup, type ParcelFinding, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";
import { arcgisFeatures } from "./arcgis-query";

const DENVER_STORM = "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_UTIL_STMMAIN_L/FeatureServer/288";
const COLORADO_TANKS = "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/Regulated_Storage_Tank_Facilities_in_Colorado/FeatureServer/0";
const FLORIDA_SUBSIDENCE = "https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/FGS_SUBSIDENCE/MapServer/0";
const DENVER_SCREEN: [number, number, number, number] = [-105.14, 39.59, -104.6, 39.94];

const value = (input: unknown) => input == null ? "" : String(input).trim();
const date = (input: unknown) => {
  if (input == null || input === "") return "";
  if (typeof input === "number" && Number.isFinite(input)) {
    const parsed = new Date(input);
    return Number.isFinite(parsed.valueOf()) ? parsed.toISOString().slice(0, 10) : "";
  }
  return value(input);
};
const status = (length: number, capped: boolean) => capped ? "partial" : length ? "found" : "coverage_unknown";
const outside = (geometry: ParcelGeometry, bounds: [number, number, number, number]) => {
  const [w, s, e, n] = parcelBounds(geometry);
  return e < bounds[0] || w > bounds[2] || n < bounds[1] || s > bounds[3];
};

export async function denverStormGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "denver-storm", label = "Denver storm sewer mains", source = "City and County of Denver", sourceUrl = DENVER_STORM;
  const note = "Public storm main centerlines are screening references. They do not establish pipe depth, exact alignment, condition, service laterals, or ownership; confirm with Denver Wastewater and a utility locate.";
  if (!parcelKey.startsWith("co:") || outside(geometry, DENVER_SCREEN)) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Denver area only. ${note}`, findings: [] };
  try {
    const result = await arcgisFeatures(DENVER_STORM, geometry, "OBJECTID,assetid,ownedby,material,pipeshape,installdate,lifecyclestatus", 0, signal);
    const findings: ParcelFinding[] = result.features.flatMap((feature) => {
      if (feature.geometry.type !== "LineString" && feature.geometry.type !== "MultiLineString") return [];
      const p = feature.properties ?? {};
      const recordId = value(p.assetid || p.OBJECTID || feature.id);
      return [{ id: `${id}:${recordId}`, name: recordId ? `Storm main ${recordId}` : "Mapped storm main", detail: [value(p.material), value(p.pipeshape), p.ownedby ? `Owner code ${value(p.ownedby)}` : ""].filter(Boolean).join(" · "), relationship: "intersects" as const, distanceMeters: null, sourceId: id, sourceRecordId: recordId, recordUrl: sourceUrl, recordDate: date(p.installdate), geometry: feature.geometry }];
    });
    return { id, label, source, sourceUrl, status: status(findings.length, result.capped), note, findings };
  } catch {
    return { id, label, source, sourceUrl, status: "unavailable", note: `Denver storm main service did not respond. ${note}`, findings: [] };
  }
}

export async function coloradoTankGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "colorado-tanks", label = "Registered tank facilities within 500 m", source = "Colorado Division of Oil and Public Safety", sourceUrl = COLORADO_TANKS;
  const note = "Facility points include aboveground and underground tanks; a point does not locate an individual tank. Source data can omit facilities and reported releases. Check state records and site history.";
  if (!parcelKey.startsWith("co:")) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Colorado only. ${note}`, findings: [] };
  try {
    const result = await arcgisFeatures(COLORADO_TANKS, geometry, "OBJECTID,Facility_ID,Facility_Name,Facility_Type,Facility_Category,Number_of_Active_Tanks,Release_Number,Release_Record_Type,Status,Release_Date,Release_Record_Link", 500, signal);
    const findings: ParcelFinding[] = result.features.flatMap((feature) => {
      if (feature.geometry.type !== "Point") return [];
      const point = feature.geometry.coordinates as [number, number];
      const distance = pointToParcelMeters(point, geometry);
      if (!Number.isFinite(distance) || distance > 500) return [];
      const p = feature.properties ?? {};
      const recordId = value(p.Facility_ID || p.OBJECTID || feature.id);
      const release = value(p.Release_Number);
      const link = value(p.Release_Record_Link);
      return [{ id: `${id}:${recordId}:${release}`, name: value(p.Facility_Name) || "Registered tank facility", detail: [value(p.Facility_Category || p.Facility_Type), p.Number_of_Active_Tanks != null ? `${p.Number_of_Active_Tanks} reported active tanks` : "", release ? `Release record ${release}` : "", value(p.Status)].filter(Boolean).join(" · "), relationship: distance <= 1 ? "inside" as const : "nearby" as const, distanceMeters: Math.round(distance), sourceId: id, sourceRecordId: recordId, recordUrl: /^https:\/\//.test(link) ? link : sourceUrl, recordDate: date(p.Release_Date), geometry: feature.geometry }];
    });
    return { id, label, source, sourceUrl, status: status(findings.length, result.capped), note, findings };
  } catch {
    return { id, label, source, sourceUrl, status: "unavailable", note: `Colorado tank service did not respond. ${note}`, findings: [] };
  }
}

export async function floridaSubsidenceGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "florida-subsidence", label = "Florida subsidence reports within 500 m", source = "Florida Geological Survey", sourceUrl = FLORIDA_SUBSIDENCE;
  const note = "Most reports are not field verified as true sinkholes. Report coordinates and dates vary; no nearby report does not mean no subsidence risk.";
  if (!parcelKey.startsWith("fl:")) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Florida only. ${note}`, findings: [] };
  try {
    const result = await arcgisFeatures(FLORIDA_SUBSIDENCE, geometry, "OBJECTID,REF_NUM,EVENT_DATE,TRUE_SINK,ACCURACY,SINLNGTH,SINWIDTH,SINDEPTH", 500, signal);
    const findings: ParcelFinding[] = result.features.flatMap((feature) => {
      if (feature.geometry.type !== "Point") return [];
      const point = feature.geometry.coordinates as [number, number];
      const distance = pointToParcelMeters(point, geometry);
      if (!Number.isFinite(distance) || distance > 500) return [];
      const p = feature.properties ?? {};
      const recordId = value(p.REF_NUM || p.OBJECTID || feature.id);
      const verified = value(p.TRUE_SINK).toUpperCase();
      const verification = verified === "Y" ? "FGS verified sinkhole" : verified === "N" ? "FGS marked not a true sinkhole" : "Cause unverified";
      return [{ id: `${id}:${recordId}`, name: `Subsidence report ${recordId}`, detail: [verification, p.ACCURACY ? `Location accuracy ${value(p.ACCURACY)}` : ""].filter(Boolean).join(" · "), relationship: distance <= 1 ? "inside" as const : "nearby" as const, distanceMeters: Math.round(distance), sourceId: id, sourceRecordId: recordId, recordUrl: sourceUrl, recordDate: date(p.EVENT_DATE), geometry: feature.geometry }];
    });
    return { id, label, source, sourceUrl, status: status(findings.length, result.capped), note, findings };
  } catch {
    return { id, label, source, sourceUrl, status: "unavailable", note: `Florida subsidence service did not respond. ${note}`, findings: [] };
  }
}

export function unqueriedUtilityGroups(): InspectionGroup[] {
  return [
    { id: "wet-utilities", label: "Water and sanitary sewer lines", source: "Utility owners and 811", sourceUrl: "https://call811.com/", status: "not_queried", note: "No suitable parcel-query owner map is connected. Service lines, laterals, private systems, easements, depths, and abandoned assets require owner records and field locates.", findings: [] },
    { id: "dry-utilities", label: "Gas, power, and telecom lines", source: "Utility owners and PHMSA", sourceUrl: "https://www.npms.phmsa.dot.gov/AboutPublicViewer.aspx", status: "not_queried", note: "No parcel-precise public network is connected. PHMSA's public viewer covers only major transmission pipelines and is not an excavation locate; distribution, service, electric, and telecom lines require owner records and 811.", findings: [] },
  ];
}
