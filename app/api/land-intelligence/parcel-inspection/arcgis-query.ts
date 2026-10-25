import { esriParcelGeometry, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";

const MAX_FEATURES = 40;
let active = 0;
const queue: (() => void)[] = [];

async function limited<T>(run: () => Promise<T>): Promise<T> {
  if (active >= 5) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  try { return await run(); }
  finally { active--; queue.shift()?.(); }
}

export async function arcgisFeatures(url: string, geometry: ParcelGeometry, outFields: string, nearbyMeters = 0, signal?: AbortSignal) {
  const body = new URLSearchParams({
    where: "1=1", geometry: JSON.stringify(esriParcelGeometry(geometry)), geometryType: "esriGeometryPolygon",
    inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields,
    returnGeometry: "true", resultRecordCount: String(MAX_FEATURES), f: "geojson",
  });
  if (nearbyMeters) { body.set("distance", String(nearbyMeters)); body.set("units", "esriSRUnit_Meter"); }
  return limited(async () => {
    const response = await fetch(`${url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(11000)]) : AbortSignal.timeout(11000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 5_000_000) throw new Error("GIS response too large");
    const json = JSON.parse(raw);
    if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected GIS response");
    return { features: (json.features as GeoJSON.Feature[]).filter((f) => !!f.geometry), capped: !!json.exceededTransferLimit || !!json.properties?.exceededTransferLimit || json.features.length >= MAX_FEATURES };
  });
}
