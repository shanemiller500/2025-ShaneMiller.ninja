// Recent recorded home sales for the map layer and the "Recent sales nearby" list, from free public records only:
// Denver's live sales and transfers (citywide, refreshed within weeks) and, elsewhere in Colorado, the statewide parcel
// layer's last sale (updated yearly). These are recorded sales, not qualified or verified market sales, and never MLS data.
import { DENVER_SALES, denverInstrument, denverSaleDate } from "./colorado-live";
import { normalizeSaleDate } from "./parcel-detail";
import { normalizeParcel, PARCEL_SOURCES } from "./parcel-sources";

export const RECENT_MONTHS = [3, 6, 12] as const;
export type RecentMonths = (typeof RECENT_MONTHS)[number];
export const MIN_PRICE = 10000;
/** Fixed price classes for the map (sequential blue, shared with the market layers). */
export const PRICE_CLASSES = [
  { max: 400000, label: "Under $400k", color: "#86b6ef" }, { max: 700000, label: "$400k–700k", color: "#5598e7" },
  { max: 1000000, label: "$700k–1M", color: "#2a78d6" }, { max: null, label: "$1M or more", color: "#184f95" },
] as const;

export type RecentSale = {
  parcelId: string; county: string; address: string; point: [number, number]; date: string; price: number;
  source: "denver" | "statewide"; deed: string; propertyClass: string; reception: string; distanceMiles?: number;
};

/** The date the window starts (inclusive), as YYYY-MM-DD. */
export function windowStart(months: RecentMonths, today = new Date()) {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, today.getUTCDate()));
  return start.toISOString().slice(0, 10);
}
const todayIso = (today = new Date()) => today.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------------------------------
// Denver: priced warranty and special-warranty deeds on residential classes. Denver publishes no qualification, so a
// reception number shared by several parcels (a portfolio or multi-parcel deal) is dropped, and future dates (data
// entry errors, e.g. 2026-12-30 seen on 2026-11-02) are ignored.

export const DENVER_RESIDENTIAL = "(D_CLASS_N LIKE 'SFR%' OR D_CLASS_N LIKE 'RESIDENTIAL%')";
export type DenverRecent = { parcelId: number; date: string; price: number; deed: string; propertyClass: string; reception: string };

export function denverRecentRows(rows: Record<string, unknown>[], since: string, today = todayIso()): DenverRecent[] {
  const receptions = new Map<string, number>();
  for (const row of rows) { const key = String(row.RECEPTION_NUM ?? ""); if (key) receptions.set(key, (receptions.get(key) ?? 0) + 1); }
  return rows.flatMap((row) => {
    const date = denverSaleDate(row), price = Number(row.SALE_PRICE), reception = String(row.RECEPTION_NUM ?? "");
    if (!date || date < since || date > today || !(price >= MIN_PRICE) || (reception && (receptions.get(reception) ?? 0) > 1)) return [];
    return [{ parcelId: Number(row.PARID), date, price, deed: denverInstrument(row.INSTRUMENT), propertyClass: String(row.D_CLASS_N ?? "").trim(), reception }];
  });
}

const denverCache = { expires: 0, sales: null as Map<number, DenverRecent[]> | null, pending: null as Promise<Map<number, DenverRecent[]>> | null };

/** Every qualifying Denver sale in the last 12 months, keyed by PARID. Fetched page by page and kept for 6 hours. */
export async function denverRecentSales(): Promise<Map<number, DenverRecent[]>> {
  if (denverCache.sales && denverCache.expires > Date.now()) return denverCache.sales;
  denverCache.pending ??= (async () => {
    const since = windowStart(12);
    const where = `RECEPTION_DATE>=${since.replace(/-/g, "")} AND SALE_PRICE>=${MIN_PRICE} AND INSTRUMENT IN ('WD','SW') AND ${DENVER_RESIDENTIAL}`;
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < 40000; offset += 2000) {
      const params = new URLSearchParams({ where, outFields: "PARID,RECEPTION_NUM,INSTRUMENT,SALE_YEAR,SALE_MONTHDAY,RECEPTION_DATE,SALE_PRICE,D_CLASS_N", orderByFields: "OBJECTID", resultOffset: String(offset), resultRecordCount: "2000", returnGeometry: "false", f: "json" });
      const response = await fetch(`${DENVER_SALES}/query?${params}`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
      if (!response.ok) throw new Error(`Denver sales HTTP ${response.status}`);
      const json = await response.json();
      if (json.error || !Array.isArray(json.features)) throw new Error("Unexpected Denver sales response");
      rows.push(...json.features.map((feature: { attributes: Record<string, unknown> }) => feature.attributes));
      if (json.features.length < 2000 && !json.exceededTransferLimit) break;
    }
    const byParcel = new Map<number, DenverRecent[]>();
    for (const sale of denverRecentRows(rows, since)) byParcel.set(sale.parcelId, [...(byParcel.get(sale.parcelId) ?? []), sale]);
    denverCache.sales = byParcel;
    denverCache.expires = Date.now() + 6 * 60 * 60 * 1000;
    return byParcel;
  })().finally(() => { denverCache.pending = null; });
  return denverCache.pending;
}

// ---------------------------------------------------------------------------------------------------------------------
// Parcels in view from the Colorado statewide layer, reduced to a label point.

const CO_SOURCE = PARCEL_SOURCES.find((source) => source.id === "co")!;
const CO_FIELDS = "OBJECTID,parcel_id,countyName,situsAdd,sitAddCty,landUseDsc,saleDate,salePrice,dateReceived";

/** Area-weighted centroid of the largest outer ring; the ring's first vertex if the ring is degenerate. */
export function polygonPoint(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  const rings = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
  let best: [number, number] = rings[0][0] as [number, number], bestArea = -1;
  for (const ring of rings) {
    // Relative to the first vertex: raw lon/lat products cancel badly for parcel-sized rings.
    const [ox, oy] = ring[0];
    let area = 0, x = 0, y = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x0 = ring[i][0] - ox, y0 = ring[i][1] - oy, x1 = ring[i + 1][0] - ox, y1 = ring[i + 1][1] - oy;
      const cross = x0 * y1 - x1 * y0;
      area += cross; x += (x0 + x1) * cross; y += (y0 + y1) * cross;
    }
    if (Math.abs(area) > bestArea && area !== 0) { bestArea = Math.abs(area); best = [ox + x / (3 * area), oy + y / (3 * area)]; }
  }
  return best;
}

/** The statewide layer's last sale when it falls in the window, is priced and the parcel is residential or of unreported use. */
export function statewideRecent(attributes: Record<string, unknown>, point: [number, number], since: string, today = todayIso()): RecentSale | null {
  const record = normalizeParcel(CO_SOURCE, attributes);
  const date = normalizeSaleDate(attributes.saleDate), price = Number(String(attributes.salePrice ?? "").replace(/[$,\s]/g, ""));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < since || date > today || !(price >= MIN_PRICE)) return null;
  if (record.landUse && record.category !== "residential") return null;
  return { parcelId: record.id, county: record.county, address: record.address, point, date, price, source: "statewide", deed: "Last sale on the statewide layer", propertyClass: record.landUse || "Use not reported", reception: "" };
}

export async function coloradoParcelsIn([west, south, east, north]: [number, number, number, number], signal?: AbortSignal) {
  const features: GeoJSON.Feature[] = [];
  for (let offset = 0; offset < 6000; offset += 2000) {
    const params = new URLSearchParams({ where: "1=1", geometry: JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: CO_FIELDS, returnGeometry: "true", maxAllowableOffset: "0.00005", resultOffset: String(offset), resultRecordCount: "2000", f: "geojson" });
    const response = await fetch(`${CO_SOURCE.url}/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: signal ?? AbortSignal.timeout(18000), cache: "no-store" });
    if (!response.ok) throw new Error(`Parcel HTTP ${response.status}`);
    const json = await response.json();
    if (json.error || !Array.isArray(json.features)) throw new Error("Unexpected parcel response");
    features.push(...json.features.filter((feature: GeoJSON.Feature) => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon"));
    if (json.features.length < 2000 && !json.exceededTransferLimit && !json.properties?.exceededTransferLimit) return { features, limited: false };
  }
  return { features, limited: true };
}

/** Joins parcels in view to Denver's recent sales (Denver parcels) or the statewide last sale (all other counties). */
export function recentSalesFor(parcels: GeoJSON.Feature[], denver: Map<number, DenverRecent[]> | null, months: RecentMonths, today = new Date()): RecentSale[] {
  const since = windowStart(months, today), now = todayIso(today);
  const sales: RecentSale[] = [];
  const seen = new Set<string>();
  for (const feature of parcels) {
    const a = feature.properties ?? {};
    const id = String(a.parcel_id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const point = polygonPoint(feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon);
    if (String(a.countyName ?? "").toLowerCase() === "denver") {
      const record = normalizeParcel(CO_SOURCE, a);
      for (const sale of denver?.get(Number(id)) ?? []) if (sale.date >= since && sale.date <= now)
        sales.push({ parcelId: id, county: "Denver", address: record.address, point, date: sale.date, price: sale.price, source: "denver", deed: sale.deed, propertyClass: sale.propertyClass, reception: sale.reception });
      continue;
    }
    const statewide = statewideRecent(a, point, since, now);
    if (statewide) sales.push(statewide);
  }
  return sales.sort((x, y) => y.date.localeCompare(x.date));
}

export const priceClass = (price: number) => PRICE_CLASSES.findIndex((item) => item.max == null || price < item.max);
