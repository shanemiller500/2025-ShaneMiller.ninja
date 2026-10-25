import { parcelBounds, pointToParcelMeters, type InspectionGroup, type ParcelFinding, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";

const SURVEY_URL = "https://geodesy.noaa.gov/api/nde/bounds";
const WATER_URL = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations/items";
const RADIUS_METERS = 1000;

function paddedBounds(geometry: ParcelGeometry): [number, number, number, number] {
  const [w, s, e, n] = parcelBounds(geometry);
  const latitude = (s + n) / 2;
  const dy = RADIUS_METERS / 111_200;
  const dx = RADIUS_METERS / (111_200 * Math.max(0.2, Math.cos(latitude * Math.PI / 180)));
  return [Math.max(-180, w - dx), Math.max(-90, s - dy), Math.min(180, e + dx), Math.min(90, n + dy)];
}

async function readJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(11000)]) : AbortSignal.timeout(11000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw = await response.text();
  if (raw.length > 3_000_000) throw new Error("Provider response too large");
  return JSON.parse(raw);
}

function nearby(point: [number, number], geometry: ParcelGeometry) {
  const distance = pointToParcelMeters(point, geometry);
  return distance <= RADIUS_METERS ? Math.round(distance) : null;
}

export async function surveyControlGroup(geometry: ParcelGeometry, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "survey-control", label = "Survey control within 1 km", source = "NOAA National Geodetic Survey";
  const note = "Published geodetic marks are reference points, not parcel corners or a boundary survey. Coordinates and mark condition must be checked against the current datasheet and in the field.";
  try {
    const [w, s, e, n] = paddedBounds(geometry);
    const params = new URLSearchParams({ minlat: String(s), maxlat: String(n), minlon: String(w), maxlon: String(e) });
    const payload = await readJson(`${SURVEY_URL}?${params}`, signal);
    const wrapper = payload as { results?: unknown; data?: unknown; error?: unknown } | null;
    const rows = Array.isArray(payload) ? payload : Array.isArray(wrapper?.results) ? wrapper.results : Array.isArray(wrapper?.data) ? wrapper.data : null;
    if (!rows || wrapper?.error) throw new Error("Unexpected NGS response");
    const findings: ParcelFinding[] = rows.flatMap((row: unknown) => {
      const mark = row as Record<string, unknown>;
      const lat = Number(mark.lat), lon = Number(mark.lon);
      const pid = String(mark.pid ?? "").trim();
      if (!pid || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return [];
      const point: [number, number] = [lon, lat];
      const distance = nearby(point, geometry);
      if (distance == null) return [];
      const height = String(mark.orthoHt ?? "").trim();
      const datum = String(mark.vertDatum ?? "").trim();
      return [{ id: `survey-control:${pid}`, name: String(mark.name || `NGS mark ${pid}`), detail: [height && datum ? `Orthometric height ${height} m (${datum})` : "", String(mark.posDatum ?? "").trim()].filter(Boolean).join(" · "), relationship: distance === 0 ? "inside" as const : "nearby" as const, distanceMeters: distance, sourceId: id, sourceRecordId: pid, recordUrl: `https://www.ngs.noaa.gov/cgi-bin/ds_mark.prl?PidBox=${encodeURIComponent(pid)}`, recordDate: "", geometry: { type: "Point" as const, coordinates: point } }];
    });
    return { id, label, source, sourceUrl: "https://www.ngs.noaa.gov/web_services/data-explorer.shtml", status: rows.length >= 500 ? "partial" : findings.length ? "found" : "no_features", note: rows.length >= 500 ? `${note} NGS returned its 500-record maximum; results may be incomplete.` : note, findings };
  } catch {
    return { id, label, source, sourceUrl: "https://www.ngs.noaa.gov/web_services/data-explorer.shtml", status: "source_error", note: `NGS did not return survey marks. ${note}`, findings: [] };
  }
}

export async function groundwaterSitesGroup(geometry: ParcelGeometry, signal?: AbortSignal): Promise<InspectionGroup> {
  const id = "groundwater-sites", label = "Groundwater wells within 1 km", source = "USGS Water Data for the Nation";
  const note = "Shows groundwater-classified wells in the USGS inventory, including wells operated by other agencies. It does not establish current water depth or conditions beneath this parcel. Review measurements separately.";
  try {
    const box = paddedBounds(geometry);
    const params = new URLSearchParams({ bbox: box.join(","), site_type_code: "GW", limit: "100", f: "json" });
    const payload = await readJson(`${WATER_URL}?${params}`, signal) as { type?: string; features?: GeoJSON.Feature[]; numberMatched?: number; links?: { rel?: string }[] };
    if (payload?.type !== "FeatureCollection" || !Array.isArray(payload.features)) throw new Error("Unexpected USGS response");
    const findings: ParcelFinding[] = payload.features.flatMap((feature) => {
      if (feature.geometry?.type !== "Point") return [];
      const point = feature.geometry.coordinates as [number, number];
      if (!point.every(Number.isFinite)) return [];
      const distance = nearby(point, geometry);
      if (distance == null) return [];
      const properties = feature.properties ?? {};
      const number = String(properties.monitoring_location_number ?? "").trim();
      if (!number) return [];
      const agency = String(properties.agency_code ?? "USGS").trim();
      const locationId = String(feature.id ?? `${agency}-${number}`).trim();
      if (!/^[A-Za-z0-9_-]{3,60}$/.test(locationId)) return [];
      const depth = Number(properties.well_constructed_depth);
      const details = [properties.site_type, Number.isFinite(depth) && depth > 0 ? `Reported constructed depth ${depth} ft` : "", properties.construction_date ? `Constructed ${properties.construction_date}` : "", properties.horizontal_positional_accuracy ? `Position accuracy: ${properties.horizontal_positional_accuracy}` : ""].filter(Boolean).map(String);
      return [{ id: `groundwater-sites:${locationId}`, name: String(properties.monitoring_location_name || `Groundwater site ${number}`), detail: details.join(" · "), relationship: distance === 0 ? "inside" as const : "nearby" as const, distanceMeters: distance, sourceId: id, sourceRecordId: locationId, recordUrl: `https://waterdata.usgs.gov/monitoring-location/${encodeURIComponent(locationId)}/`, recordDate: "", geometry: feature.geometry }];
    });
    const truncated = payload.features.length >= 100 || (typeof payload.numberMatched === "number" && payload.numberMatched > payload.features.length) || !!payload.links?.some((link) => link.rel === "next");
    return { id, label, source, sourceUrl: "https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations", status: truncated ? "partial" : findings.length ? "found" : "no_features", note: truncated ? `${note} The provider has more records than this response includes.` : note, findings };
  } catch {
    return { id, label, source, sourceUrl: "https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations", status: "source_error", note: `USGS monitoring locations did not respond. ${note}`, findings: [] };
  }
}
