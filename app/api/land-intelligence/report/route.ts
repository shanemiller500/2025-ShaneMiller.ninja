import { NextRequest, NextResponse } from "next/server";
import { areaSquareMeters, lengthMeters, shapeCenter, validShape, type AnalysisShape, type Coord } from "@/app/land-intelligence/geometry";
import type { CensusContext, Facility, FatalCrash, Finding, FeatureSet, NamedFeature, Parcel, Report, Road, SoilUnit } from "@/app/land-intelligence/report-types";
import { normalizeParcel, sourcesForBounds } from "@/app/land-intelligence/parcel-sources";
import { CRASH_FIELDS, CRASH_SOURCE, normalizeCrash } from "@/app/land-intelligence/crash";

export const runtime = "nodejs";

type FloodZone = { zone: string; subtype: string; special: boolean };

const FEMA = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
const NHD = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query";
const NWI = "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query";
const FAULTS = "https://earthquake.usgs.gov/arcgis/rest/services/haz/Qfaults/MapServer/21/query";
const ROADS = "https://dtdapps.codot.gov/server/rest/services/Webapps/HighwaySegments/MapServer/2/query";
const FACILITIES = "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0/query";
const SOILS = "https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest";
const reportCache = new Map<string, { expires: number; report: Report }>();
const sourceMeta = {
  elevation: { coverage: "U.S. land", freshness: "Survey dates vary" },
  flood: { coverage: "U.S. mapped areas", freshness: "Effective map dates vary by community" },
  waterways: { coverage: "U.S. legacy NHD", freshness: "Legacy dataset" },
  wetlands: { coverage: "U.S. mapped areas; gaps possible", freshness: "Source imagery dates vary" },
  faults: { coverage: "U.S. mapped Quaternary faults", freshness: "2020 national release" },
  parcels: { coverage: "Public statewide sources in CO, UT, WA, FL, NC and WI; county gaps possible", freshness: "Source revision dates vary by state and county" },
  roads: { coverage: "Colorado state highways; local streets excluded", freshness: "Traffic count year varies by segment" },
  soils: { coverage: "U.S. soil survey areas; unmapped gaps possible", freshness: "Survey and map unit revision dates vary" },
  census: { coverage: "U.S. census tracts with 2024 ACS 5-year estimates", freshness: "2024 ACS 5-year estimates; tract geography lookup is current" },
  facilities: { coverage: "U.S. EPA ECHO regulated facilities with mapped coordinates", freshness: "ECHO map service refreshed weekly; underlying program records vary" },
  crashes: { coverage: "U.S. fatal motor vehicle crashes with reported coordinates", freshness: "2024 FARS initial release; excludes nonfatal crashes and later years" },
} as const;
type BaseFinding<T> = Omit<Finding<T>, "coverage" | "freshness">;
const field = (value: unknown) => value == null || String(value).toLowerCase() === "null" ? "" : String(value).trim();
const number = (value: unknown): number | null => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const reviewDate = (value: unknown) => {
  const stamp = number(value);
  return stamp == null || !Number.isFinite(new Date(stamp).getTime()) ? "" : new Date(stamp).toISOString().slice(0, 10);
};

function queryGeometry(shape: AnalysisShape): { geometry: string; geometryType: string } {
  const points = shape.points;
  if (shape.kind === "pin") {
    const [x, y] = points[0];
    return { geometry: JSON.stringify({ x, y, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPoint" };
  }
  if (shape.kind === "line") return { geometry: JSON.stringify({ paths: [points], spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPolyline" };
  // ArcGIS expects exterior rings clockwise. Drawn vertices can arrive in either order.
  const signed = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  const ring = signed > 0 ? [...points].reverse() : points;
  return { geometry: JSON.stringify({ rings: [[...ring, ring[0]]], spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPolygon" };
}

async function arcgis(url: string, shape: AnalysisShape, extra: Record<string, string>) {
  const params = new URLSearchParams({ ...queryGeometry(shape), inSR: "4326", spatialRel: "esriSpatialRelIntersects", f: "json", ...extra });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(12000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "GIS service error");
  return json;
}

async function elevation(shape: AnalysisShape): Promise<BaseFinding<number>> {
  const [lng, lat] = shapeCenter(shape.points);
  const url = "https://epqs.nationalmap.gov/v1/json";
  try {
    const params = new URLSearchParams({ x: lng.toFixed(6), y: lat.toFixed(6), units: "Meters", wkid: "4326" });
    const res = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = Number((await res.json()).value);
    if (!Number.isFinite(value) || value <= -1000) return { status: "none", value: null, note: "No elevation returned for the approximate centre.", source: "USGS 3DEP · Elevation Point Query Service", url: "https://www.usgs.gov/3d-elevation-program" };
    return { status: "found", value, note: shape.kind === "pin" ? "Ground elevation at the pin." : "Ground elevation at the approximate centre; not a slope or elevation range.", source: "USGS 3DEP · Elevation Point Query Service", url: "https://www.usgs.gov/3d-elevation-program" };
  } catch {
    return { status: "unavailable", value: null, note: "The USGS elevation service did not respond.", source: "USGS 3DEP · Elevation Point Query Service", url: "https://www.usgs.gov/3d-elevation-program" };
  }
}

async function flood(shape: AnalysisShape): Promise<BaseFinding<FloodZone[]>> {
  try {
    const json = await arcgis(FEMA, shape, { where: "1=1", outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF", returnGeometry: "false", resultRecordCount: "100" });
    const zones = new Map<string, FloodZone>();
    for (const feature of json.features ?? []) {
      const a = feature.attributes ?? {};
      const zone = String(a.FLD_ZONE ?? "Unknown");
      const subtype = String(a.ZONE_SUBTY ?? "");
      zones.set(`${zone}:${subtype}`, { zone, subtype, special: String(a.SFHA_TF).toUpperCase() === "T" });
    }
    const value = Array.from(zones.values());
    return { status: value.length ? "found" : "none", value, note: value.length
      ? `${shape.kind === "pin" ? "Mapped flood zone at this point." : "Mapped flood zones intersecting the drawn shape."}${json.exceededTransferLimit ? " The service capped the result; additional zones may be present." : ""}`
      : "No FEMA flood-zone feature returned here; this does not establish that the location has no flood risk or that it is mapped.", source: "FEMA · National Flood Hazard Layer", url: "https://www.fema.gov/flood-maps/national-flood-hazard-layer" };
  } catch {
    return { status: "unavailable", value: null, note: "The FEMA flood service did not respond.", source: "FEMA · National Flood Hazard Layer", url: "https://www.fema.gov/flood-maps/national-flood-hazard-layer" };
  }
}

function nearPin([lng, lat]: Coord): AnalysisShape {
  const dy = 1 / 111.2;
  const dx = 1 / (111.2 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return { kind: "area", points: [[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy]] };
}

async function waterways(shape: AnalysisShape): Promise<BaseFinding<number>> {
  try {
    const search = shape.kind === "pin" ? nearPin(shape.points[0]) : shape;
    const json = await arcgis(NHD, search, { where: "ftype IN (460,336,468)", returnCountOnly: "true" });
    if (!Number.isFinite(json.count)) throw new Error("Missing count");
    return { status: json.count > 0 ? "found" : "none", value: json.count,
      note: shape.kind === "pin" ? "Mapped stream, canal or drainage features in a box extending about 1 km from the pin in each direction." : "Mapped stream, canal or drainage features intersecting the drawn shape. This is a feature count, not a count of distinct waterways.",
      source: "USGS · National Hydrography Dataset (legacy)", url: "https://www.usgs.gov/national-hydrography/national-hydrography-dataset" };
  } catch {
    return { status: "unavailable", value: null, note: "The USGS hydrography service did not respond.", source: "USGS · National Hydrography Dataset (legacy)", url: "https://www.usgs.gov/national-hydrography/national-hydrography-dataset" };
  }
}

function nearPinKm([lng, lat]: Coord, km: number): AnalysisShape {
  const dy = km / 111.2;
  const dx = km / (111.2 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return { kind: "area", points: [[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy]] };
}

function inColorado(shape: AnalysisShape) {
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  return Math.max(...xs) >= -109.1 && Math.min(...xs) <= -102 && Math.max(...ys) >= 36.9 && Math.min(...ys) <= 41.1;
}

async function featureSet<T>(url: string, shape: AnalysisShape, fields: string, convert: (attributes: Record<string, unknown>) => T, extra: Record<string, string> = {}): Promise<FeatureSet<T>> {
  const [counts, samples] = await Promise.all([
    arcgis(url, shape, { where: "1=1", returnCountOnly: "true", ...extra }),
    arcgis(url, shape, { where: "1=1", returnGeometry: "false", outFields: fields, resultRecordCount: "5", ...extra }),
  ]);
  if (!Number.isFinite(counts.count)) throw new Error("Missing feature count");
  return { count: counts.count, items: (samples.features ?? []).map((item: { attributes?: Record<string, unknown> }) => convert(item.attributes ?? {})) };
}

function soilWkt(shape: AnalysisShape) {
  const coordinates = shape.kind === "area" ? shape.points : nearPinKm(shapeCenter(shape.points), 0.05).points;
  const ring = [...coordinates, coordinates[0]].map(([lng, lat]) => `${lng.toFixed(6)} ${lat.toFixed(6)}`).join(",");
  return `POLYGON((${ring}))`;
}

async function soils(shape: AnalysisShape): Promise<BaseFinding<SoilUnit[]>> {
  const source = "USDA NRCS · Soil Data Access";
  const url = "https://sdmdataaccess.sc.egov.usda.gov/";
  try {
    const wkt = soilWkt(shape);
    const query = `SELECT TOP 8 M.mukey, M.musym, M.muname FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('${wkt}') AS S JOIN mapunit AS M ON M.mukey = S.mukey`;
    const res = await fetch(SOILS, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ QUERY: query, FORMAT: "JSON+COLUMNNAME" }), signal: AbortSignal.timeout(14000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error || json.Error) throw new Error("Soil query error");
    const table: unknown = json.Table;
    if (!Array.isArray(table)) throw new Error("Unexpected soil response");
    const rows = table.slice(1) as unknown[][];
    const value = rows.filter((row) => Array.isArray(row)).map((row) => ({ key: field(row[0]), symbol: field(row[1]), name: field(row[2]) }));
    return { status: value.length ? "found" : "none", value, note: shape.kind === "area" ? "Soil map units intersecting the drawn area; showing up to eight. Map units contain variable soils and are not a site investigation." : "Soil map units in a small box around the drawing centre; showing up to eight. Map units are not a site investigation.", source, url };
  } catch { return { status: "unavailable", value: null, note: "The USDA soil service did not return usable map units.", source, url }; }
}

async function census(shape: AnalysisShape): Promise<BaseFinding<CensusContext>> {
  const source = "U.S. Census Bureau · 2024 ACS 5-year data profiles";
  const url = "https://api.census.gov/data/2024/acs/acs5/profile.html";
  const [lng, lat] = shapeCenter(shape.points);
  try {
    const geographyUrl = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
    for (const [key, value] of Object.entries({ x: lng.toFixed(6), y: lat.toFixed(6), benchmark: "Public_AR_Current", vintage: "Current_Current", format: "json" })) geographyUrl.searchParams.set(key, value);
    const geographyResponse = await fetch(geographyUrl, { signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!geographyResponse.ok) throw new Error("Census geography unavailable");
    const geography = (await geographyResponse.json()).result?.geographies?.["Census Tracts"]?.[0];
    if (!geography) return { status: "outside", value: null, note: "No census tract was found at the drawing centre.", source, url };
    const state = String(geography.STATE ?? "");
    const county = String(geography.COUNTY ?? "");
    const tract = String(geography.TRACT ?? "");
    if (!/^\d{2}$/.test(state) || !/^\d{3}$/.test(county) || !/^\d{6}$/.test(tract)) throw new Error("Unexpected tract code");
    const dataUrl = new URL("https://api.census.gov/data/2024/acs/acs5/profile");
    dataUrl.searchParams.set("get", "NAME,DP05_0001E,DP03_0062E,DP03_0128PE");
    dataUrl.searchParams.set("for", `tract:${tract}`);
    dataUrl.searchParams.set("in", `state:${state} county:${county}`);
    const dataResponse = await fetch(dataUrl, { signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!dataResponse.ok) throw new Error("ACS data unavailable");
    const rows: unknown = await dataResponse.json();
    if (!Array.isArray(rows) || !Array.isArray(rows[0]) || !Array.isArray(rows[1])) throw new Error("Unexpected ACS response");
    const row = Object.fromEntries((rows[0] as string[]).map((key, index) => [key, (rows[1] as unknown[])[index]]));
    const estimate = (raw: unknown) => raw == null || raw === "" || !Number.isFinite(Number(raw)) || Number(raw) < 0 ? null : Number(raw);
    const value: CensusContext = { tract: String(row.NAME ?? `Tract ${tract}`), population: estimate(row.DP05_0001E), medianHouseholdIncome: estimate(row.DP03_0062E), povertyPercent: estimate(row.DP03_0128PE), year: 2024 };
    return { status: "found", value, note: "Estimates for the tract containing the drawing centre, not the people or households within the site itself. ACS estimates have sampling error and may not describe the whole route or area.", source, url };
  } catch { return { status: "unavailable", value: null, note: "Census geography or ACS estimates did not respond for this location.", source, url }; }
}

async function facilities(shape: AnalysisShape): Promise<BaseFinding<FeatureSet<Facility>>> {
  const source = "U.S. EPA · ECHO Facilities";
  const url = "https://echo.epa.gov/tools/map-service";
  const distance = shape.kind === "pin" ? 1000 : 500;
  try {
    const value = await featureSet(FACILITIES, shape,
      "REGISTRY_ID,FAC_NAME,FAC_CITY,FAC_STATE,FAC_CURR_COMPLIANCE_STATUS,FAC_ACCURACY_METERS,AIR_FLAG,NPDES_FLAG,RCRA_FLAG,TRI_FLAG",
      (a) => ({ id: field(a.REGISTRY_ID), name: field(a.FAC_NAME) || "Unnamed regulated facility", city: field(a.FAC_CITY), state: field(a.FAC_STATE),
        programs: [["Air", a.AIR_FLAG], ["Water", a.NPDES_FLAG], ["Waste", a.RCRA_FLAG], ["TRI", a.TRI_FLAG]].filter(([, flag]) => field(flag).toUpperCase() === "Y").map(([name]) => String(name)),
        compliance: field(a.FAC_CURR_COMPLIANCE_STATUS), accuracyMeters: number(a.FAC_ACCURACY_METERS) }),
      { distance: String(distance), units: "esriSRUnit_Meter" });
    return { status: value.count ? "found" : "none", value, note: `EPA regulated facility points within approximately ${distance.toLocaleString()} m of the drawing; showing up to five. Proximity alone does not establish a release, exposure or contamination.`, source, url };
  } catch { return { status: "unavailable", value: null, note: "The EPA facility service did not respond.", source, url }; }
}

async function wetlands(shape: AnalysisShape): Promise<BaseFinding<FeatureSet<NamedFeature>>> {
  const source = "USFWS · National Wetlands Inventory";
  const url = "https://www.fws.gov/rivers/carp/carp/program/national-wetlands-inventory/web-mapping-services";
  try {
    const value = await featureSet(NWI, shape, "WETLAND_TYPE,ATTRIBUTE,ACRES", (a) => ({ name: field(a.WETLAND_TYPE) || "Mapped wetland or water", detail: [field(a.ATTRIBUTE), number(a.ACRES) == null ? "" : `${number(a.ACRES)} acres`].filter(Boolean).join(" · ") }));
    return { status: value.count ? "found" : "none", value, note: "Mapped wetland and water features intersecting the drawing. This is not a jurisdictional determination.", source, url };
  } catch { return { status: "unavailable", value: null, note: "The wetlands service did not respond.", source, url }; }
}

async function faults(shape: AnalysisShape): Promise<BaseFinding<FeatureSet<NamedFeature>>> {
  const source = "USGS · Quaternary Fault and Fold Database";
  const url = "https://www.usgs.gov/programs/earthquake-hazards/faults";
  try {
    const search = shape.kind === "pin" ? nearPinKm(shape.points[0], 5) : shape;
    const value = await featureSet(FAULTS, search, "fault_name,age,mapped_certainty,last_review", (a) => ({ name: field(a.fault_name) || "Unnamed mapped fault", detail: [field(a.age), field(a.mapped_certainty), reviewDate(a.last_review) ? `Reviewed ${reviewDate(a.last_review)}` : ""].filter(Boolean).join(" · ") }));
    return { status: value.count ? "found" : "none", value, note: shape.kind === "pin" ? "Mapped fault traces within an approximate 5 km box. This is not a seismic risk estimate." : "Mapped fault traces intersecting the drawing. This is not a seismic risk estimate.", source, url };
  } catch { return { status: "unavailable", value: null, note: "The mapped faults service did not respond.", source, url }; }
}

async function parcels(shape: AnalysisShape): Promise<BaseFinding<FeatureSet<Parcel>>> {
  const xs = shape.points.map(([lng]) => lng);
  const ys = shape.points.map(([, lat]) => lat);
  const providers = sourcesForBounds([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  const source = "State and county public parcel services";
  const url = "https://gis.utah.gov/products/sgid/cadastre/parcels/";
  if (!providers.length) return { status: "outside", value: null, note: "No public parcel source is connected for this location. This is a coverage gap, not evidence of no parcels.", source, url };
  const results = await Promise.allSettled(providers.map(async (provider) => featureSet(provider.url + "/query", shape, provider.fields, (attributes) => normalizeParcel(provider, attributes))));
  const good = results.filter((result): result is PromiseFulfilledResult<FeatureSet<Parcel>> => result.status === "fulfilled");
  if (!good.length) return { status: "unavailable", value: null, note: "The parcel source did not respond for this location.", source, url: providers[0].url };
  const value = { count: good.reduce((sum, result) => sum + result.value.count, 0), items: good.flatMap((result) => result.value.items).slice(0, 5) };
  const partial = good.length < providers.length ? " Some state services were unavailable." : "";
  return { status: value.count ? "found" : "none", value, note: `County supplied parcel records intersecting the drawing; showing up to five across ${providers.map((provider) => provider.state).join(", ")}. Boundaries, land use and zoning require county verification.${partial}`, source: providers.map((provider) => provider.source).join("; "), url: providers[0].url };
}

async function roads(shape: AnalysisShape): Promise<BaseFinding<FeatureSet<Road>>> {
  const source = "CDOT · Highway Segments";
  const url = "https://dtdapps.codot.gov/server/rest/services/Webapps/HighwaySegments/MapServer/2";
  if (!inColorado(shape)) return { status: "outside", value: null, note: "This pilot source covers Colorado only.", source, url };
  try {
    const search = shape.kind === "pin" ? nearPinKm(shape.points[0], 0.1) : shape;
    const value = await featureSet(ROADS, search, "ROUTE,COUNTY,FUNCCLASS,AADT,AADTYR,SPEEDLIM,THRULNQTY,ALIAS", (a) => ({
      route: field(a.ALIAS) || field(a.ROUTE) || "Highway segment", county: field(a.COUNTY), className: field(a.FUNCCLASS),
      aadt: number(a.AADT), aadtYear: number(a.AADTYR), speed: number(a.SPEEDLIM), lanes: number(a.THRULNQTY),
    }));
    return { status: value.count ? "found" : "none", value, note: `${shape.kind === "pin" ? "Highway segments within an approximate 100 m box" : "Highway segments intersecting the drawing"}; showing up to five. Local streets are excluded. AADT is an annual average, not live traffic.`, source, url };
  } catch { return { status: "unavailable", value: null, note: "The CDOT highway service did not respond.", source, url }; }
}

async function crashes(shape: AnalysisShape): Promise<BaseFinding<FeatureSet<FatalCrash>>> {
  const source = "USDOT BTS / NHTSA FARS 2024 initial release";
  try {
    const search = shape.kind === "pin" ? nearPinKm(shape.points[0], 1) : shape;
    const value = await featureSet(CRASH_SOURCE + "/query", search, CRASH_FIELDS, normalizeCrash, { where: "YEAR=2024" });
    return { status: value.count ? "found" : "none", value, note: `${shape.kind === "pin" ? "Fatal crash points within about 1 km of the pin" : "Fatal crash points intersecting the drawing"}; showing up to five. This is the 2024 initial release, not a count of all crashes or a current safety rating.`, source, url: CRASH_SOURCE };
  } catch { return { status: "unavailable", value: null, note: "The national fatal crash service did not respond.", source, url: CRASH_SOURCE }; }
}

export async function POST(request: NextRequest) {
  let shape: AnalysisShape;
  try { shape = (await request.json()) as AnalysisShape; } catch { return NextResponse.json({ error: "Invalid shape." }, { status: 400 }); }
  if (!shape || !["pin", "line", "area"].includes(shape.kind) || !Array.isArray(shape.points) || !validShape(shape)) return NextResponse.json({ error: "Draw a valid pin, line or area with at most 40 points." }, { status: 400 });
  if ((shape.kind === "line" && lengthMeters(shape.points) > 100000) || (shape.kind === "area" && (areaSquareMeters(shape.points) > 250000000 || lengthMeters(shape.points, true) > 100000))) {
    return NextResponse.json({ error: "This first release supports lines up to 100 km and areas up to 250 km² with a perimeter under 100 km. Draw a smaller study area." }, { status: 400 });
  }
  const key = JSON.stringify(shape);
  const cached = reportCache.get(key);
  if (request.headers.get("x-land-refresh") !== "1" && cached && cached.expires > Date.now()) return NextResponse.json(cached.report);
  const [elevationResult, floodResult, waterwaysResult, wetlandsResult, faultsResult, parcelsResult, roadsResult, soilsResult, facilitiesResult, censusResult, crashesResult] = await Promise.all([
    elevation(shape), flood(shape), waterways(shape), wetlands(shape), faults(shape), parcels(shape), roads(shape), soils(shape), facilities(shape), census(shape), crashes(shape),
  ]);
  const report: Report = {
    checkedAt: new Date().toISOString(),
    elevation: { ...elevationResult, ...sourceMeta.elevation }, flood: { ...floodResult, ...sourceMeta.flood },
    waterways: { ...waterwaysResult, ...sourceMeta.waterways }, wetlands: { ...wetlandsResult, ...sourceMeta.wetlands },
    faults: { ...faultsResult, ...sourceMeta.faults }, parcels: { ...parcelsResult, ...sourceMeta.parcels }, roads: { ...roadsResult, ...sourceMeta.roads },
    crashes: { ...crashesResult, ...sourceMeta.crashes },
    soils: { ...soilsResult, ...sourceMeta.soils }, facilities: { ...facilitiesResult, ...sourceMeta.facilities }, census: { ...censusResult, ...sourceMeta.census },
  };
  if (![elevationResult, floodResult, waterwaysResult, wetlandsResult, faultsResult, parcelsResult, roadsResult, soilsResult, facilitiesResult, censusResult, crashesResult].some((result) => result.status === "unavailable")) {
    if (reportCache.size >= 100) reportCache.delete(reportCache.keys().next().value!);
    reportCache.set(key, { expires: Date.now() + 15 * 60 * 1000, report });
  }
  return NextResponse.json(report);
}
