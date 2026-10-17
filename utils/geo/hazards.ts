/* ------------------------------------------------------------------ */
/*  Live hazards for the Disaster Atlas — all keyless public feeds:    */
/*    · NWS watches/warnings (NOAA map service, with zone polygons)    */
/*    · wildfire perimeters (NIFC WFIGS) + satellite hotspots (FIRMS)  */
/*    · active tropical cyclones (NHC, via /api/atlas/storms)          */
/*    · today's + yesterday's storm reports (NOAA SPC)                 */
/*    · river gauges in flood (NWS)                                    */
/*    · who's at risk: FEMA National Risk Index by county (baked)      */
/* ------------------------------------------------------------------ */

export const NRI_URL = "/atlas/nri-counties.json";

/* ── NWS watches & warnings ──────────────────────────────────────── */

export type AlertGroup = "tornado" | "thunder" | "flood" | "tropical" | "fire" | "heat" | "winter" | "wind";

export const ALERT_GROUPS: { key: AlertGroup; label: string; color: string }[] = [
  { key: "tornado", label: "Tornado", color: "#ef4444" },
  { key: "thunder", label: "Severe thunderstorm", color: "#f59e0b" },
  { key: "flood", label: "Flood & flash flood", color: "#22c55e" },
  { key: "tropical", label: "Hurricane & tropical", color: "#d946ef" },
  { key: "fire", label: "Fire weather", color: "#fb7185" },
  { key: "heat", label: "Extreme heat", color: "#f97316" },
  { key: "winter", label: "Winter storm & blizzard", color: "#38bdf8" },
  { key: "wind", label: "High wind", color: "#a3a3a3" },
];

/** NWS product → our group. Only the products that threaten life and property; advisories are left out. */
export const ALERT_PRODUCTS: Record<string, AlertGroup> = {
  "Tornado Warning": "tornado",
  "Tornado Watch": "tornado",
  "Severe Thunderstorm Warning": "thunder",
  "Severe Thunderstorm Watch": "thunder",
  "Flash Flood Warning": "flood",
  "Flood Warning": "flood",
  "Flash Flood Watch": "flood",
  "Flood Watch": "flood",
  "Coastal Flood Warning": "flood",
  "Hurricane Warning": "tropical",
  "Hurricane Watch": "tropical",
  "Tropical Storm Warning": "tropical",
  "Tropical Storm Watch": "tropical",
  "Storm Surge Warning": "tropical",
  "Storm Surge Watch": "tropical",
  "Typhoon Warning": "tropical",
  "Typhoon Watch": "tropical",
  "Red Flag Warning": "fire",
  "Fire Weather Watch": "fire",
  "Fire Warning": "fire",
  "Extreme Heat Warning": "heat",
  "Excessive Heat Warning": "heat",
  "Extreme Heat Watch": "heat",
  "Winter Storm Warning": "winter",
  "Blizzard Warning": "winter",
  "Ice Storm Warning": "winter",
  "Winter Storm Watch": "winter",
  "High Wind Warning": "wind",
  "Extreme Wind Warning": "wind",
};

export const alertGroup = (k: string) => ALERT_GROUPS.find((g) => g.key === k) ?? ALERT_GROUPS[0];

const WWA = "https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/1/query";

/** Active watches + warnings as GeoJSON polygons (zone-based ones included). */
export async function fetchAlerts(signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  const types = Object.keys(ALERT_PRODUCTS).map((t) => `'${t}'`).join(",");
  const features: GeoJSON.Feature[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const q = new URLSearchParams({
      where: `prod_type IN (${types})`,
      outFields: "prod_type,url,issuance,expiration,wfo,sig,cap_id",
      outSR: "4326",
      maxAllowableOffset: "0.005",
      geometryPrecision: "3",
      resultOffset: String(offset),
      resultRecordCount: "1000",
      f: "geojson",
    });
    const res = await fetch(`${WWA}?${q}`, { signal });
    if (!res.ok) throw new Error(`NWS warnings: HTTP ${res.status}`);
    const j = (await res.json()) as GeoJSON.FeatureCollection & { error?: { message: string }; properties?: { exceededTransferLimit?: boolean } };
    if (j.error) throw new Error(j.error.message);
    for (const f of j.features) {
      const p = f.properties as Record<string, unknown>;
      const product = String(p.prod_type ?? "");
      f.id = features.length;
      f.properties = {
        id: features.length,
        product,
        group: ALERT_PRODUCTS[product] ?? "wind",
        watch: /Watch$/.test(product),
        url: p.url ?? null,
        issued: p.issuance ?? null,
        expires: p.expiration ?? null,
        wfo: p.wfo ?? null,
      };
      features.push(f);
    }
    if (j.features.length < 1000) break;
  }
  return { type: "FeatureCollection", features };
}

/* ── wildfires ───────────────────────────────────────────────────── */

const WFIGS = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query";

/** Current interagency fire perimeters (NIFC WFIGS). */
export async function fetchFirePerimeters(signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  const q = new URLSearchParams({
    where: "1=1",
    outFields: "attr_IncidentName,poly_GISAcres,attr_PercentContained,attr_FireDiscoveryDateTime,attr_FireCauseGeneral,attr_POOState,attr_TotalIncidentPersonnel,attr_IncidentTypeCategory,attr_ModifiedOnDateTime_dt,attr_UniqueFireIdentifier",
    outSR: "4326",
    maxAllowableOffset: "0.0005",
    geometryPrecision: "5",
    f: "geojson",
  });
  const res = await fetch(`${WFIGS}?${q}`, { signal });
  if (!res.ok) throw new Error(`NIFC perimeters: HTTP ${res.status}`);
  const j = (await res.json()) as GeoJSON.FeatureCollection;
  for (const f of j.features) {
    const p = f.properties as Record<string, unknown>;
    f.properties = {
      id: String(p.attr_UniqueFireIdentifier ?? p.attr_IncidentName ?? ""),
      name: String(p.attr_IncidentName ?? "Unnamed fire").trim(),
      acres: Math.round(Number(p.poly_GISAcres) || 0),
      contained: p.attr_PercentContained == null ? null : Number(p.attr_PercentContained),
      discovered: p.attr_FireDiscoveryDateTime ?? null,
      cause: p.attr_FireCauseGeneral ?? null,
      state: String(p.attr_POOState ?? "").replace(/^US-/, "") || null,
      personnel: p.attr_TotalIncidentPersonnel ?? null,
      type: p.attr_IncidentTypeCategory === "RX" ? "Prescribed burn" : "Wildfire",
      updated: p.attr_ModifiedOnDateTime_dt ?? null,
    };
  }
  return j;
}

/* ── tropical cyclones (proxied NHC) ─────────────────────────────── */

export interface Storm {
  id: string;
  name: string;
  kind: string;
  classification: string;
  windKt: number;
  windMph: number;
  category: number;
  pressureMb: number | null;
  center: [number, number];
  movement: { dir: number; mph: number };
  updated: string;
  advisory: { number: string; url: string } | null;
  cone: GeoJSON.Feature[];
  track: GeoJSON.Feature[];
  past: GeoJSON.Feature[];
  points: GeoJSON.Feature[];
}

export async function fetchStorms(signal?: AbortSignal): Promise<Storm[]> {
  const res = await fetch("/api/atlas/storms", { signal });
  const j = (await res.json()) as { storms?: Storm[] };
  return j.storms ?? [];
}

/** Compass point for a heading in degrees. */
export const compass = (deg: number) => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

/* ── NOAA SPC storm reports ──────────────────────────────────────── */

export type ReportKind = "tornado" | "wind" | "hail";

export const REPORT_KINDS: { key: ReportKind; label: string; color: string; file: string }[] = [
  { key: "tornado", label: "Tornado", color: "#ef4444", file: "torn" },
  { key: "wind", label: "Damaging wind", color: "#60a5fa", file: "wind" },
  { key: "hail", label: "Large hail", color: "#4ade80", file: "hail" },
];

/** Parse one SPC daily report CSV (header: Time,F_Scale|Speed|Size,Location,County,State,Lat,Lon,Comments). */
export function parseSpcCsv(csv: string, kind: ReportKind, day: "today" | "yesterday"): GeoJSON.Feature[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const out: GeoJSON.Feature[] = [];
  for (const line of lines.slice(1)) {
    // comments may contain commas: the first 7 columns are fixed
    const cells = line.split(",");
    if (cells.length < 7) continue;
    const [time, mag, location, county, state, lat, lon] = cells;
    // an empty cell is Number("") = 0 — that would put the report at 0°, 0°
    if (!lat?.trim() || !lon?.trim()) continue;
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    out.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lo, la] },
      properties: {
        kind,
        day,
        time: time.padStart(4, "0"),
        mag: mag && mag !== "UNK" ? mag : null,
        place: `${location.trim()}, ${county.trim()} Co., ${state.trim()}`,
        comments: cells.slice(7).join(",").trim() || null,
      },
    });
  }
  return out;
}

/** Today's + yesterday's reports (proxied through /api/atlas/spc). */
export async function fetchStormReports(signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch("/api/atlas/spc", { signal });
  if (!res.ok) throw new Error(`storm reports: HTTP ${res.status}`);
  return res.json();
}

/* ── rivers in flood ─────────────────────────────────────────────── */

const GAUGES = "https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/riv_gauges/MapServer/0/query";

export const FLOOD_LEVELS: { key: string; label: string; color: string }[] = [
  { key: "action", label: "Near flood stage", color: "#fde047" },
  { key: "minor", label: "Minor flooding", color: "#fb923c" },
  { key: "moderate", label: "Moderate flooding", color: "#ef4444" },
  { key: "major", label: "Major flooding", color: "#d946ef" },
];

export async function fetchFloodGauges(signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  const q = new URLSearchParams({
    where: "status IN ('action','minor','moderate','major')",
    outFields: "gaugelid,status,location,waterbody,state,obstime,url,observed,units,flood,moderate,major",
    outSR: "4326",
    f: "geojson",
  });
  const res = await fetch(`${GAUGES}?${q}`, { signal });
  if (!res.ok) throw new Error(`river gauges: HTTP ${res.status}`);
  const j = (await res.json()) as GeoJSON.FeatureCollection;
  for (const f of j.features) {
    const p = f.properties as Record<string, unknown>;
    f.properties = {
      id: p.gaugelid,
      status: String(p.status ?? "").toLowerCase(),
      name: p.location,
      river: p.waterbody,
      state: p.state,
      observed: p.observed,
      units: p.units,
      floodStage: p.flood,
      moderateStage: p.moderate,
      majorStage: p.major,
      time: p.obstime,
      url: p.url,
    };
  }
  return j;
}

/* ── FEMA National Risk Index ────────────────────────────────────── */

export interface CountyRisk {
  id: string;
  name: string;
  state: string;
  pop: number;
  bldg: number;
  score: number | null;
  risk: string | null;
  eal: number;
  ealR: string | null;
  sovi: string | null;
  resl: string | null;
  hrcn: string | null;
  trnd: string | null;
  wfir: string | null;
  ifld: string | null;
  cfld: string | null;
}

export const RISK_RATINGS: { key: string; color: string }[] = [
  { key: "Very Low", color: "#1e3a8a" },
  { key: "Relatively Low", color: "#0e7490" },
  { key: "Relatively Moderate", color: "#ca8a04" },
  { key: "Relatively High", color: "#ea580c" },
  { key: "Very High", color: "#dc2626" },
];

export const riskColor = (r: string | null) => RISK_RATINGS.find((x) => x.key === r)?.color ?? "#334155";

/** $1.2B / $340M / $12K */
export function money(v: number) {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

/** Which county a point falls in (ray casting over the baked outlines). */
export function countyAt(fc: GeoJSON.FeatureCollection, [x, y]: [number, number]): CountyRisk | null {
  const inRing = (ring: GeoJSON.Position[]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    if (polys.some((p) => inRing(p[0]) && !p.slice(1).some(inRing))) return f.properties as unknown as CountyRisk;
  }
  return null;
}
