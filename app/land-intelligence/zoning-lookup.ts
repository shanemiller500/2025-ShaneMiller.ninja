import { PARCEL_SOURCES } from "./parcel-sources";
import { catalogQueries, isMunicipalPlaceholder, isZoningName, jurisdictionFromCensus, rankCatalog, zoningFromAttributes, type CatalogItem, type Jurisdiction, type ZoningDistrict, type ZoningLookup } from "./zoning";

const CENSUS = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const CATALOG = "https://www.arcgis.com/sharing/rest/search";
const SERVICE_URL = /^https?:\/\/[^\s?#]+\/(Feature|Map)Server(\/\d+)?$/i;
type Layer = { url: string; name: string };
type Hit = { district: ZoningDistrict; source: NonNullable<ZoningLookup["source"]> };

const lookupCache = new Map<string, { expires: number; lookup: ZoningLookup }>();
// Layer that last answered for a jurisdiction, so repeat clicks skip catalog discovery.
const winners = new Map<string, Layer>();
function remember<T>(map: Map<string, T>, key: string, value: T) {
  if (map.size >= 200) map.delete(map.keys().next().value!);
  map.set(key, value);
}

export async function getJson(url: string, timeout: number) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  if (raw.length > 2_000_000) throw new Error("Response exceeded limit");
  const json = JSON.parse(raw);
  if (json?.error) throw new Error(json.error.message ?? "Service error");
  return json;
}

async function pointAttributes(layerUrl: string, lng: number, lat: number, outFields = "*", bufferMeters = 0): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields, returnGeometry: "false", f: "json" });
  if (bufferMeters) { params.set("distance", String(bufferMeters)); params.set("units", "esriSRUnit_Meter"); }
  const json = await getJson(`${layerUrl}/query?${params}`, 7000);
  return json.features?.[0]?.attributes ?? null;
}

async function zoningAt(layer: Layer, lng: number, lat: number, jurisdiction: Jurisdiction): Promise<Hit | null> {
  try {
    // Zoning polygons usually stop at the street, so a click on a road misses;
    // retry with a small buffer to reach the adjoining district.
    const attributes = await pointAttributes(layer.url, lng, lat) ?? await pointAttributes(layer.url, lng, lat, "*", 12);
    const district = zoningFromAttributes(attributes);
    return district && !isMunicipalPlaceholder(district, jurisdiction) ? { district, source: { name: layer.name, layerUrl: layer.url, method: "catalog" } } : null;
  } catch { return null; }
}

/** Statewide parcel feeds that carry a zoning attribute answer without any discovery. */
async function parcelZoning(lng: number, lat: number): Promise<Hit | null> {
  for (const source of PARCEL_SOURCES) {
    const [west, south, east, north] = source.bounds;
    if (!/zoning/i.test(source.fields) || lng < west || lng > east || lat < south || lat > north) continue;
    try {
      const district = zoningFromAttributes(await pointAttributes(source.url, lng, lat, source.fields));
      if (district) return { district, source: { name: `${source.source} · parcel zoning attribute`, layerUrl: source.url, method: "parcel" } };
    } catch { /* fall through to catalog discovery */ }
  }
  return null;
}

/** Candidate zoning layers from the public ArcGIS Online catalog. `reached` is false when no search answered. */
async function catalogLayers(jurisdiction: Jurisdiction): Promise<{ layers: Layer[]; reached: boolean }> {
  const searches = await Promise.all(catalogQueries(jurisdiction).map(async (q) => {
    try {
      const json = await getJson(`${CATALOG}?${new URLSearchParams({ f: "json", q, num: "15", sortField: "numViews", sortOrder: "desc" })}`, 8000);
      return (json.results ?? []).map((item: Record<string, unknown>): CatalogItem => ({ title: String(item.title ?? ""), url: String(item.url ?? "").trim().replace(/\/+$/, ""), owner: String(item.owner ?? ""), numViews: Number(item.numViews) || 0 }));
    } catch { return null; }
  }));
  const seen = new Set<string>();
  const items: CatalogItem[] = [];
  // Searches are ordered city before county; keep that priority and rank within each.
  for (const list of searches) for (const item of rankCatalog((list ?? []).filter((entry: CatalogItem) => SERVICE_URL.test(entry.url)), jurisdiction)) {
    if (!seen.has(item.url)) { seen.add(item.url); items.push(item); }
  }
  const expanded = await Promise.all(items.slice(0, 8).map(async (item): Promise<Layer[]> => {
    if (/\/\d+$/.test(item.url)) return [{ url: item.url, name: item.title }];
    try {
      const meta = await getJson(`${item.url}?f=json`, 6000);
      return (meta.layers ?? [])
        .filter((layer: { id?: unknown; name?: unknown; geometryType?: unknown }) => Number.isInteger(layer.id) && isZoningName(String(layer.name ?? "")) && (!layer.geometryType || /polygon/i.test(String(layer.geometryType))))
        .slice(0, 3).map((layer: { id: number; name: string }) => ({ url: `${item.url}/${layer.id}`, name: `${item.title} · ${layer.name}` }));
    } catch { return []; }
  }));
  return { layers: expanded.flat().slice(0, 12), reached: searches.some(Boolean) };
}

/** State, county and incorporated place at a point from the Census geocoder; null outside the U.S., undefined when it doesn't answer. */
export async function jurisdictionAt(lng: number, lat: number): Promise<Jurisdiction | null | undefined> {
  const url = `${CENSUS}?${new URLSearchParams({ x: lng.toFixed(6), y: lat.toFixed(6), benchmark: "Public_AR_Current", vintage: "Current_Current", format: "json" })}`;
  return getJson(url, 12000).then(jurisdictionFromCensus, () => undefined);
}

export const validPoint =(lng: unknown, lat: unknown): lng is number =>
  typeof lng === "number" && typeof lat === "number" && Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= -64 && lat >= 17 && lat <= 72;

/** Jurisdiction and zoning district at a U.S. point. Callers validate the coordinates. */
export async function lookupZoning(lng: number, lat: number): Promise<ZoningLookup> {
  const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  const cached = lookupCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.lookup;

  const [census, parcelZone] = await Promise.all([jurisdictionAt(lng, lat), parcelZoning(lng, lat)]);
  const jurisdiction = census ?? null;
  const parcelHit = parcelZone && !(jurisdiction && isMunicipalPlaceholder(parcelZone.district, jurisdiction)) ? parcelZone : null;
  const base = { checkedAt: new Date().toISOString(), jurisdiction };
  const authority = jurisdiction?.authority ?? "the local planning department";
  const found = (hit: Hit): ZoningLookup => ({ ...base, status: "found", ...hit, note: `Zoning district returned by ${hit.source.method === "parcel" ? "the parcel record" : "a published zoning layer"} at this point. Confirm with ${authority} before relying on it; published layers can lag recent rezonings.` });

  let lookup: ZoningLookup;
  if (parcelHit) lookup = found(parcelHit);
  else if (census === null) lookup = { ...base, status: "outside", district: null, source: null, note: "No U.S. state and county were found at this point." };
  else if (!jurisdiction) lookup = { ...base, status: "unavailable", district: null, source: null, note: "The Census jurisdiction lookup did not respond, so the zoning search could not start." };
  else {
    const jurisdictionKey = `${jurisdiction.state}|${jurisdiction.county}|${jurisdiction.city}`.toLowerCase();
    const winner = winners.get(jurisdictionKey);
    let hit = winner ? await zoningAt(winner, lng, lat, jurisdiction) : null;
    let reached = true;
    if (!hit) {
      const catalog = await catalogLayers(jurisdiction);
      reached = catalog.reached;
      const layers = catalog.layers.filter((layer) => layer.url !== winner?.url);
      const hits = await Promise.all(layers.map((layer) => zoningAt(layer, lng, lat, jurisdiction)));
      const index = hits.findIndex(Boolean);
      if (index >= 0) { hit = hits[index]; remember(winners, jurisdictionKey, layers[index]); }
    }
    lookup = hit ? found(hit)
      : reached ? { ...base, status: "none", district: null, source: null, note: `No published zoning layer answered at this point. Check ${authority}'s official zoning map or planning department.` }
      : { ...base, status: "unavailable", district: null, source: null, note: "The ArcGIS Online catalog did not respond, so no zoning layer could be checked." };
  }
  if (lookup.status !== "unavailable") remember(lookupCache, key, { expires: Date.now() + 30 * 60 * 1000, lookup });
  return lookup;
}
