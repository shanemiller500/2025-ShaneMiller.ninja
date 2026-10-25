import { esriParcelGeometry, type ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";
import { spatialRelation } from "./spatial-match";

const PAGE_SIZE = 40;
const MAX_FEATURES = 120;
let active = 0;
const queue: { resolve: () => void; reject: (error: Error) => void; signal?: AbortSignal; abort: () => void }[] = [];

async function limited<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new Error("Request aborted");
  if (active >= 5) await new Promise<void>((resolve, reject) => {
    const item = { resolve, reject, signal, abort: () => {
      const index = queue.indexOf(item);
      if (index >= 0) queue.splice(index, 1);
      reject(new Error("Request aborted"));
    } };
    queue.push(item);
    signal?.addEventListener("abort", item.abort, { once: true });
  });
  else active++;
  try { return await run(); }
  finally {
    const next = queue.shift();
    if (next) { next.signal?.removeEventListener("abort", next.abort); next.resolve(); }
    else active--;
  }
}

export async function arcgisFeatures(url: string, geometry: ParcelGeometry, outFields: string, nearbyMeters = 0, signal?: AbortSignal) {
  const body = new URLSearchParams({
    where: "1=1", geometry: JSON.stringify(esriParcelGeometry(geometry)), geometryType: "esriGeometryPolygon",
    inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields,
    returnGeometry: "true", resultRecordCount: String(PAGE_SIZE), f: "geojson",
  });
  if (nearbyMeters) { body.set("distance", String(nearbyMeters)); body.set("units", "esriSRUnit_Meter"); }
  const features: GeoJSON.Feature[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  for (let offset = 0; offset < MAX_FEATURES; offset += PAGE_SIZE) {
    body.set("resultOffset", String(offset));
    const page = await limited(async () => {
      const response = await fetch(`${url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(11000)]) : AbortSignal.timeout(11000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.text();
      if (raw.length > 5_000_000) throw new Error("GIS response too large");
      const json = JSON.parse(raw);
      if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Unexpected GIS response");
      return json as { features: GeoJSON.Feature[]; exceededTransferLimit?: boolean; properties?: { exceededTransferLimit?: boolean } };
    }, signal);
    let added = 0;
    for (const feature of page.features) {
      const identity = String(feature.id ?? feature.properties?.OBJECTID ?? feature.properties?.objectid ?? JSON.stringify(feature.geometry));
      if (seen.has(identity)) continue;
      seen.add(identity);
      added++;
      if (!feature.geometry || !spatialRelation(feature.geometry, geometry, nearbyMeters)) { rejected++; continue; }
      features.push(feature);
    }
    if (page.features.length < PAGE_SIZE && !page.exceededTransferLimit && !page.properties?.exceededTransferLimit)
      return { features, capped: false, rejected };
    if (!added) return { features, capped: true, rejected };
  }
  return { features, capped: true, rejected };
}
