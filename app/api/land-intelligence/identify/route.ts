import { NextRequest, NextResponse } from "next/server";

const SOURCES = {
  flood: { url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28", label: "FEMA flood zone", fields: ["FLD_ZONE", "ZONE_SUBTY", "SFHA_TF"] },
  wetlands: { url: "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0", label: "NWI wetland", fields: ["WETLAND_TYPE", "ATTRIBUTE", "ACRES"] },
  waterways: { url: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6", label: "Mapped waterway", fields: ["GNIS_NAME", "FTYPE", "FCODE"] },
  contours: { url: "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/25", label: "USGS index contour", fields: ["contourelevation", "contourunits", "contourinterval"] },
  faults: { url: "https://earthquake.usgs.gov/arcgis/rest/services/haz/Qfaults/MapServer/21", label: "Mapped fault", fields: ["fault_name", "age", "mapped_certainty"] },
  roads: { url: "https://dtdapps.codot.gov/server/rest/services/Webapps/HighwaySegments/MapServer/2", label: "Colorado highway", fields: ["OBJECTID", "ROUTE", "ALIAS", "AADT", "AADTYR", "SPEEDLIM"] },
  facilities: { url: "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0", label: "EPA facility", fields: ["FAC_NAME", "REGISTRY_ID", "FAC_CITY", "FAC_STATE"] },
} as const;
type SourceId = keyof typeof SOURCES;

export async function POST(request: NextRequest) {
  let body: { lng?: number; lat?: number; layers?: string[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid map point." }, { status: 400 }); }
  const { lng, lat } = body;
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -15 || lat > 72 || !Array.isArray(body.layers) || body.layers.length > 7) return NextResponse.json({ error: "Invalid map point or layers." }, { status: 400 });
  const ids = body.layers.filter((id): id is SourceId => Object.prototype.hasOwnProperty.call(SOURCES, id));
  const results = await Promise.all(ids.map(async (id) => {
    const source = SOURCES[id];
    try {
      const params = new URLSearchParams({
        geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPoint", inSR: "4326",
        spatialRel: "esriSpatialRelIntersects", distance: id === "wetlands" || id === "flood" ? "0" : "35", units: "esriSRUnit_Meter",
        where: "1=1", outFields: source.fields.join(","), returnGeometry: "false", resultRecordCount: "3", f: "json",
      });
      const response = await fetch(`${source.url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(10000), cache: "no-store" });
      if (!response.ok) throw new Error("Service unavailable");
      const json = await response.json();
      if (json.error || !Array.isArray(json.features)) throw new Error("Unexpected feature response");
      return { id, label: source.label, url: source.url, status: "ok", features: json.features.map((feature: { attributes?: Record<string, unknown> }) => Object.fromEntries(source.fields.map((key) => [key, feature.attributes?.[key]]).filter(([, value]) => value !== null && value !== undefined && value !== ""))) };
    } catch { return { id, label: source.label, url: source.url, status: "unavailable", features: [] }; }
  }));
  return NextResponse.json({ results });
}
