import { pointToParcelMeters, type InspectionGroup, type ParcelFinding, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";
import { ECMC_WELLS, wellStatus } from "@/app/land-intelligence/colorado-live";
import { arcgisFeatures } from "./arcgis-query";

// 2,000 ft: the distance ECMC's 2020 rules generally require between new oil and gas locations and homes (Rule 604).
export const WELL_RADIUS_METERS = 610;
const WELLS_LAYER = `${ECMC_WELLS}/0`;
const value = (input: unknown) => input == null ? "" : String(input).trim();
const year = (input: unknown) => { const t = Number(input); return Number.isFinite(t) && t > 0 ? new Date(t).toISOString().slice(0, 4) : ""; };

/** ECMC well surface locations within 2,000 ft of the parcel, with status, operator and the ECMC record. */
export async function coloradoWellsGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "oil-gas-wells", label = "Oil and gas wells within 2,000 ft", source = "Colorado Energy and Carbon Management Commission (ECMC)", sourceUrl = WELLS_LAYER;
  const note = "Well surface locations from ECMC, including plugged and permitted-but-undrilled locations. ECMC's 2020 rules generally require new oil and gas locations to be 2,000 ft from homes (Rule 604), but existing and plugged wells can be closer. Plugged and abandoned wells can still limit where buildings go; check the local setback and the ECMC record. Flowlines and pipelines are not public here.";
  if (!parcelKey.startsWith("co:")) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Colorado only. ${note}`, findings: [] };
  try {
    const result = await arcgisFeatures(WELLS_LAYER, geometry, "OBJECTID,API_Label,WellName,wellstat,well_class,Operator,field_name,spud_date,status_date,max_m_depth,scout_card_public,facility_type", WELL_RADIUS_METERS, signal);
    const findings: ParcelFinding[] = result.features.flatMap((feature) => {
      if (feature.geometry?.type !== "Point") return [];
      const distance = pointToParcelMeters(feature.geometry.coordinates as [number, number], geometry);
      if (!Number.isFinite(distance) || distance > WELL_RADIUS_METERS) return [];
      const p = feature.properties ?? {};
      const api = value(p.API_Label);
      const link = value(p.scout_card_public);
      const depth = Number(p.max_m_depth);
      return [{
        id: `${id}:${api || value(p.OBJECTID)}`, name: [value(p.WellName) || "Oil and gas well", api && `API ${api}`].filter(Boolean).join(" · "),
        detail: [wellStatus(p.wellstat), value(p.Operator), value(p.field_name) && `${value(p.field_name)} field`, year(p.spud_date) && `spudded ${year(p.spud_date)}`, Number.isFinite(depth) && depth > 0 ? `${depth.toLocaleString()} ft measured depth` : "", `${Math.round(distance * 3.28084).toLocaleString()} ft from the parcel`].filter(Boolean).join(" · "),
        relationship: distance <= 1 ? "inside" as const : "nearby" as const, distanceMeters: Math.round(distance), sourceId: id, sourceRecordId: api || value(p.OBJECTID),
        recordUrl: /^https:\/\//.test(link) ? link : sourceUrl, recordDate: value(p.status_date) ? new Date(Number(p.status_date)).toISOString().slice(0, 10) : "",
        geometry: feature.geometry, verification: "official_map" as const,
      }];
    }).sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    return { id, label, source, sourceUrl, status: result.capped ? "partial" : findings.length ? "found" : "no_features", note, findings, recordLimit: 120 };
  } catch {
    return { id, label, source, sourceUrl, status: "source_error", note: `ECMC did not respond. ${note}`, findings: [] };
  }
}
