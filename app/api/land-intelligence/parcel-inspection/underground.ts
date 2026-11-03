import { esriParcelGeometry, parcelBounds, pointToParcelMeters, type InspectionGroup, type ParcelFinding, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";
import { CGS_AML_OPENINGS, DRMS_UNDERMINED, amlHazard, mineNames } from "@/app/land-intelligence/underground";
import { queryUsmin } from "@/utils/geo/usmin-server";
import { arcgisFeatures } from "./arcgis-query";
import { spatialRelation } from "./spatial-match";

const MINE_RADIUS = 500;
const value = (input: unknown) => input == null ? "" : String(input).trim();
const byDistance = (a: ParcelFinding, b: ParcelFinding) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
/** Inside/intersects/nearby. A polygon that does not overlap counts as nearby when a vertex lies within `meters` (approximate). */
const relation = (geometry: GeoJSON.Geometry, parcel: ParcelGeometry, meters: number) => {
  const match = spatialRelation(geometry, parcel, meters);
  if (match) return { relationship: match.relationship, distanceMeters: match.relationship === "nearby" ? Math.round(match.distanceMeters ?? 0) : 0 };
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  const vertices = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).flat(2) as [number, number][];
  const nearest = Math.min(...vertices.map((vertex) => pointToParcelMeters(vertex, parcel)));
  return Number.isFinite(nearest) && nearest <= meters ? { relationship: "nearby" as const, distanceMeters: Math.round(nearest) } : null;
};

/** USGS USMIN topographic-map mine symbols and mapped mine areas (pits, dumps, tailings) within 500 m, nearest first. */
export async function mineGroup(geometry: ParcelGeometry, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "mines", label = "Historical mines within 500 m", source = "USGS USMIN", sourceUrl = "https://mrdata.usgs.gov/usmin/";
  const note = "Mine symbols and mapped mine areas digitized from historical USGS topographic maps. They mark surface features (shafts, adits, prospects, dumps), not the extent of underground workings; see the undermined-areas source for those. Many old workings were never mapped.";
  const [w, s, e, n] = parcelBounds(geometry);
  const lat = (s + n) / 2;
  const padY = 0.6 / 111.2, padX = 0.6 / (111.2 * Math.cos(lat * Math.PI / 180));
  const box: [number, number, number, number] = [w - padX, s - padY, e + padX, n + padY];
  if (box[2] - box[0] > 0.5 || box[3] - box[1] > 0.5) return { id, label, source, sourceUrl, status: "coverage_unknown", note: `Parcel is too large for the USMIN query. ${note}`, findings: [] };
  try {
    const result = await queryUsmin(box, { points: 1000, polygons: 400 }, signal);
    const findings: ParcelFinding[] = [...result.points, ...result.polygons].flatMap((feature) => {
      if (!feature.geometry) return [];
      const match = relation(feature.geometry, geometry, MINE_RADIUS);
      if (!match) return [];
      const p = feature.properties ?? {};
      const type = value(p.type) || "Mine feature";
      return [{
        id: `mines:${feature.id}`, name: value(p.name) ? `${value(p.name)} (${type.toLowerCase()})` : type,
        detail: [p.area ? "Mapped area" : "Map symbol", value(p.topo) && `${value(p.topo)} quadrangle`, p.topoDate ? `map dated ${p.topoDate}` : "", p.scale ? `1:${Number(p.scale).toLocaleString()}` : ""].filter(Boolean).join(" · "),
        ...match, sourceId: id, sourceRecordId: value(feature.id), recordUrl: /^https:\/\//.test(value(p.url)) ? value(p.url) : sourceUrl,
        recordDate: p.topoDate ? String(p.topoDate) : "", geometry: feature.geometry, verification: "official_map" as const,
      }];
    }).sort(byDistance);
    return { id, label, source, sourceUrl, status: result.truncated ? "partial" : findings.length ? "found" : "no_features", note, findings, recordLimit: 1400 };
  } catch {
    return { id, label, source, sourceUrl, status: "source_error", note: `USMIN did not respond; mine records may still exist. ${note}`, findings: [] };
  }
}

/** Colorado DRMS mapped undermined areas (known underground workings plus a 100 ft buffer) touching or within 150 m of the parcel. */
export async function underminedGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "undermined-areas", label = "Undermined areas (mapped mine workings)", source = "Colorado DRMS Mine Subsidence Protection Program", sourceUrl = DRMS_UNDERMINED;
  const note = "Mapped extents of historic underground mines with a 100 ft buffer (DRMS, 2023). Mapping is incomplete: some workings were never recorded, and depth and subsidence risk vary. This is screening only; the DRMS Mine Subsidence Protection Program and a geotechnical engineer can advise on a specific site.";
  if (!parcelKey.startsWith("co:")) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Colorado only. ${note}`, findings: [] };
  try {
    const result = await arcgisFeatures(DRMS_UNDERMINED, geometry, "FID,MINE_NAME,Depth_Int,Depth_Code,BUFF_DIST,SOURCE,SCALE", 150, signal);
    const findings: ParcelFinding[] = result.features.flatMap((feature) => {
      const match = relation(feature.geometry, geometry, 150);
      if (!match) return [];
      const p = feature.properties ?? {};
      const mines = mineNames(p.MINE_NAME);
      const depth = value(p.Depth_Int);
      return [{
        id: `${id}:${value(p.FID) || feature.id}`, name: mines.length ? `Undermined: ${mines.slice(0, 3).join(", ")}${mines.length > 3 ? ` +${mines.length - 3} more` : ""}` : "Undermined area",
        detail: [mines.length > 3 ? `Mines: ${mines.join(", ")}` : "", depth && `depth ${depth}`, "mapped workings + 100 ft buffer", value(p.SOURCE)].filter(Boolean).join(" · "),
        ...match, sourceId: id, sourceRecordId: value(p.FID), recordUrl: `${DRMS_UNDERMINED}/query?objectIds=${encodeURIComponent(value(p.FID))}&outFields=*&f=pjson`,
        recordDate: "2023", geometry: feature.geometry, verification: "official_map" as const,
      }];
    }).sort(byDistance);
    return { id, label, source, sourceUrl, status: result.capped ? "partial" : findings.length ? "found" : "no_features", note, findings };
  } catch {
    return { id, label, source, sourceUrl, status: "source_error", note: `DRMS did not respond. ${note}`, findings: [] };
  }
}

/** CGS field inventory of abandoned mine openings on national forest land (1991–1999), with hazard ratings. */
export async function coloradoAmlGroup(geometry: ParcelGeometry, parcelKey: string, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "colorado-aml", label = "Abandoned mine openings within 500 m", source = "Colorado Geological Survey / USFS abandoned mine inventory", sourceUrl = CGS_AML_OPENINGS;
  const note = "Field-inventoried shafts, adits and other openings on U.S. Forest Service land only (1991–1999), with CGS hazard ratings. Private land is not covered, and some openings have since been closed. Never enter old mine workings.";
  if (!parcelKey.startsWith("co:")) return { id, label, source, sourceUrl, status: "outside_coverage", note: `Colorado only. ${note}`, findings: [] };
  try {
    // The CGS server rejects paged queries, so this is one request capped by the service's record limit.
    const body = new URLSearchParams({ where: "1=1", geometry: JSON.stringify(esriParcelGeometry(geometry)), geometryType: "esriGeometryPolygon", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: String(MINE_RADIUS), units: "esriSRUnit_Meter", outFields: "FID,SITENAME_1,HTYPE,CONDITION,HAZ_RATING,COMMOD_T,MINE_DIST,DepthCalc", returnGeometry: "true", f: "geojson" });
    const response = await fetch(`${CGS_AML_OPENINGS}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = JSON.parse(await response.text());
    if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected CGS response");
    const findings: ParcelFinding[] = (json.features as GeoJSON.Feature[]).flatMap((feature) => {
      if (!feature.geometry) return [];
      const match = relation(feature.geometry, geometry, MINE_RADIUS);
      if (!match) return [];
      const p = feature.properties ?? {};
      const depth = value(p.DepthCalc);
      return [{
        id: `${id}:${value(p.FID) || feature.id}`, name: [value(p.SITENAME_1) || "Abandoned mine opening", value(p.HTYPE).toLowerCase()].filter(Boolean).join(" · "),
        detail: [amlHazard(p.HAZ_RATING), value(p.CONDITION) && value(p.CONDITION) !== "not available" ? value(p.CONDITION) : "", value(p.COMMOD_T), value(p.MINE_DIST) && `${value(p.MINE_DIST)} district`, depth && depth !== "0" ? `depth ${depth} ft` : ""].filter(Boolean).join(" · "),
        ...match, sourceId: id, sourceRecordId: value(p.FID), recordUrl: sourceUrl, recordDate: "1991–1999", geometry: feature.geometry, verification: "official_map" as const,
      }];
    }).sort(byDistance);
    return { id, label, source, sourceUrl, status: json.exceededTransferLimit || json.properties?.exceededTransferLimit ? "partial" : findings.length ? "found" : "no_features", note, findings };
  } catch {
    return { id, label, source, sourceUrl, status: "source_error", note: `The CGS service did not respond. ${note}`, findings: [] };
  }
}
