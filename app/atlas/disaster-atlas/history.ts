/* ------------------------------------------------------------------ */
/*  Disaster Atlas history: the baked archives (HURDAT2 hurricanes,    */
/*  SPC tornadoes, OpenFEMA declarations) and live NIFC fire-perimeter */
/*  history, turned into map features for one year (or every year,    */
/*  with a strength filter so the map stays readable).                 */
/* ------------------------------------------------------------------ */

export type HistoryHazard = "hurricanes" | "tornadoes" | "fires" | "declarations";

export const HISTORY_RANGES: Record<Exclude<HistoryHazard, "declarations">, [number, number]> = {
  hurricanes: [1851, 2025],
  tornadoes: [1950, 2025],
  fires: [1984, 2025],
};

/* ── loaders (each file once) ────────────────────────────────────── */

const cache = new Map<string, Promise<unknown>>();
function once<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))));
  return cache.get(url) as Promise<T>;
}

export interface HurdatStorm {
  id: string;
  name: string | null;
  year: number;
  /** HURDAT2: AL / EP / CP · IBTrACS: WP / NI / SI / SP / SA */
  basin: "AL" | "EP" | "CP" | "WP" | "NI" | "SI" | "SP" | "SA";
  start: number;
  maxWind: number;
  minPres: number | null;
  cat: number;
  landfalls: number;
  hu: boolean;
  /** [hours since start, lat×10, lon×10, wind kt, landfall 0/1] */
  pts: [number, number, number, number, number][];
}
/** NHC's HURDAT2 (Atlantic + eastern Pacific) and IBTrACS for every other ocean, as one list. */
export const loadHurricanes = () =>
  Promise.all([once<{ storms: HurdatStorm[] }>("/atlas/hurricanes.json"), once<{ storms: HurdatStorm[] }>("/atlas/hurricanes-world.json").catch(() => ({ storms: [] }))]).then(([a, b]) =>
    [...a.storms, ...b.storms].sort((x, y) => x.start - y.start)
  );

/** Ocean groups for the basin picker. */
export type BasinFilter = "all" | "AL" | "EP" | "WP" | "IO" | "SP";
export const BASIN_OPTIONS: [BasinFilter, string][] = [
  ["all", "All oceans"],
  ["AL", "Atlantic"],
  ["EP", "E. Pacific"],
  ["WP", "W. Pacific (typhoons)"],
  ["IO", "Indian Ocean"],
  ["SP", "South Pacific"],
];
export function basinGroup(b: HurdatStorm["basin"]): Exclude<BasinFilter, "all"> {
  if (b === "AL" || b === "SA") return "AL";
  if (b === "EP" || b === "CP") return "EP";
  if (b === "NI" || b === "SI") return "IO";
  return b;
}
export const BASIN_NAMES: Record<HurdatStorm["basin"], string> = {
  AL: "Atlantic",
  EP: "Eastern Pacific",
  CP: "Central Pacific",
  WP: "Western Pacific",
  NI: "North Indian Ocean",
  SI: "South Indian Ocean",
  SP: "South Pacific",
  SA: "South Atlantic",
};
/** Where a storm's official record lives: NHC for its basins, IBTrACS otherwise. */
export function stormSourceLink(st: HurdatStorm): { href: string; label: string } {
  if (st.basin === "AL" || st.basin === "EP" || st.basin === "CP")
    return { href: `https://www.nhc.noaa.gov/data/tcr/index.php?season=${st.year}&basin=${st.basin === "AL" ? "atl" : "epac"}`, label: `NHC storm reports for ${st.year}` };
  return { href: `https://ncics.org/ibtracs/index.php?name=v04r01-${st.id}`, label: "IBTrACS track & agency data" };
}

export interface TornadoCols {
  yr: number[];
  md: number[];
  hm: number[];
  st: string[];
  mag: number[];
  inj: number[];
  fat: number[];
  slat: number[];
  slon: number[];
  elat: number[];
  elon: number[];
  len: number[];
  wid: number[];
}
export const loadTornadoes = () => once<{ cols: TornadoCols }>("/atlas/tornadoes.json").then((j) => j.cols);

export interface CountyDeclarations {
  n: number;
  t: Record<string, number>;
  /** [year, incident type, title, disaster number, declaration type] — newest first */
  last: [number, string, string, number, string][];
}
export const loadDeclarations = () => once<{ counties: Record<string, CountyDeclarations>; byYear: Record<string, Record<string, number>> }>("/atlas/fema-declarations.json");

/* ── hurricanes ──────────────────────────────────────────────────── */

/** Saffir–Simpson colours (TD/TS below hurricane strength). */
export const CAT_COLORS = ["#60a5fa", "#fde047", "#fbbf24", "#f97316", "#ef4444", "#d946ef"];
export const catOf = (kt: number) => (kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : 0);
export const ktToMph = (kt: number) => Math.round(kt * 1.15078);

export interface HurricaneFilter {
  year: number | "all";
  /** minimum peak category (0 = every storm) */
  minCat: number;
  basin: BasinFilter;
}

export function filterStorms(storms: HurdatStorm[], f: HurricaneFilter) {
  return storms.filter((s) => (f.year === "all" || s.year === f.year) && s.cat >= f.minCat && (f.basin === "all" || basinGroup(s.basin) === f.basin));
}

/** One line segment per 6-hourly step, coloured by the wind at its start. */
export function hurricaneFeatures(storms: HurdatStorm[]): { lines: GeoJSON.FeatureCollection; labels: GeoJSON.FeatureCollection } {
  const lines: GeoJSON.Feature[] = [];
  const labels: GeoJSON.Feature[] = [];
  for (const s of storms) {
    let peak = s.pts[0];
    for (let i = 0; i < s.pts.length; i++) {
      const p = s.pts[i];
      if (p[3] > peak[3]) peak = p;
      const q = s.pts[i + 1];
      if (!q) break;
      // don't draw across the antimeridian
      if (Math.abs(q[2] - p[2]) > 1800) continue;
      lines.push({
        type: "Feature",
        properties: { id: s.id, cat: catOf(p[3]), kt: p[3] },
        geometry: { type: "LineString", coordinates: [[p[2] / 10, p[1] / 10], [q[2] / 10, q[1] / 10]] },
      });
    }
    labels.push({
      type: "Feature",
      properties: { id: s.id, title: `${s.name ?? "Unnamed"} ${s.year}`, cat: s.cat },
      geometry: { type: "Point", coordinates: [peak[2] / 10, peak[1] / 10] },
    });
  }
  return { lines: { type: "FeatureCollection", features: lines }, labels: { type: "FeatureCollection", features: labels } };
}

/** Landfall points (HURDAT "L" records) — where storms crossed the coast. */
export function landfallFeatures(storms: HurdatStorm[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of storms) for (const p of s.pts) if (p[4]) features.push({ type: "Feature", properties: { id: s.id, cat: catOf(p[3]), kt: p[3] }, geometry: { type: "Point", coordinates: [p[2] / 10, p[1] / 10] } });
  return { type: "FeatureCollection", features };
}

/* ── tornadoes ───────────────────────────────────────────────────── */

/** F/EF colours, 0–5 (-9 = unknown). */
export const EF_COLORS = ["#a3e635", "#facc15", "#fb923c", "#f87171", "#e11d48", "#c026d3"];

export interface TornadoFilter {
  year: number | "all";
  minMag: number;
}

export function tornadoFeatures(c: TornadoCols, f: TornadoFilter): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < c.yr.length; i++) {
    if ((f.year !== "all" && c.yr[i] !== f.year) || c.mag[i] < f.minMag) continue;
    const start: [number, number] = [c.slon[i], c.slat[i]];
    const hasEnd = c.elat[i] !== 0 && c.elon[i] !== 0;
    features.push({
      type: "Feature",
      id: i,
      properties: { i, mag: c.mag[i], fat: c.fat[i] },
      geometry: hasEnd ? { type: "LineString", coordinates: [start, [c.elon[i], c.elat[i]]] } : { type: "Point", coordinates: start },
    });
  }
  return { type: "FeatureCollection", features };
}

export function tornadoAt(c: TornadoCols, i: number) {
  const md = c.md[i];
  const hm = String(c.hm[i]).padStart(4, "0");
  return {
    date: new Date(Date.UTC(c.yr[i], Math.floor(md / 100) - 1, md % 100)).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }),
    time: `${hm.slice(0, 2)}:${hm.slice(2)} CST`,
    year: c.yr[i],
    state: c.st[i],
    mag: c.mag[i],
    fat: c.fat[i],
    inj: c.inj[i],
    len: c.len[i],
    wid: c.wid[i],
  };
}

/** Totals for a set of tornadoes (for the year summary). */
export function tornadoStats(c: TornadoCols, f: TornadoFilter) {
  let n = 0;
  let fat = 0;
  let violent = 0;
  for (let i = 0; i < c.yr.length; i++) {
    if ((f.year !== "all" && c.yr[i] !== f.year) || c.mag[i] < f.minMag) continue;
    n++;
    fat += c.fat[i];
    if (c.mag[i] >= 4) violent++;
  }
  return { n, fat, violent };
}

/* ── wildfire perimeters by year (NIFC, live) ────────────────────── */

// NIFC publishes the perimeter history one decade per service; the "All Years" view is
// missing most recent fires (151 records for 2020 vs. 185 fires over 5,000 acres alone)
const NIFC = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services";
export function fireHistoryService(year: number) {
  const name =
    year >= 2020
      ? "InterAgencyFirePerimeterHistory_2020s_Read_Only"
      : year >= 2010
        ? "InteragencyFirePerimeterHistory_2010s_Read_Only"
        : year >= 2000
          ? "InteragencyFirePerimeterHistor_2000s_Read_Only" // (sic — NIFC's own spelling)
          : year >= 1990
            ? "InteragencyFirePerimeterHistory_1990s_Read_Only"
            : year >= 1980
              ? "InteragencyFirePerimeterHistory_1980s_Read_Only"
              : "InterAgencyFirePerimeterHistory_1979_And_Prior_Read_Only";
  return `${NIFC}/${name}/FeatureServer/0/query`;
}

export async function loadFireYear(year: number, minAcres: number, signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  const q = new URLSearchParams({
    where: `FIRE_YEAR_INT = ${Math.round(year)} AND GIS_ACRES >= ${Math.round(minAcres)}`,
    outFields: "OBJECTID,INCIDENT,GIS_ACRES,FIRE_YEAR_INT,AGENCY,DATE_CUR",
    outSR: "4326",
    maxAllowableOffset: "0.003",
    geometryPrecision: "4",
    orderByFields: "GIS_ACRES DESC",
    resultRecordCount: "1500",
    f: "geojson",
  });
  const res = await fetch(`${fireHistoryService(year)}?${q}`, { signal });
  if (!res.ok) throw new Error(`NIFC fire history: HTTP ${res.status}`);
  const j = (await res.json()) as GeoJSON.FeatureCollection & { error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  for (const f of j.features) {
    const p = f.properties as Record<string, unknown>;
    f.id = Number(p.OBJECTID);
    f.properties = {
      id: Number(p.OBJECTID),
      name: String(p.INCIDENT ?? "Unnamed").trim(),
      acres: Math.round(Number(p.GIS_ACRES) || 0),
      year: Number(p.FIRE_YEAR_INT),
      agency: p.AGENCY ?? null,
    };
  }
  return j;
}

/* ── FEMA declarations → counties ────────────────────────────────── */

/**
 * Counties renamed or split since FEMA recorded them: the new FIPS code → the code FEMA used.
 * (Connecticut's 2022 planning regions don't map onto its old counties, so they stay unmatched.)
 */
export const FIPS_ALIASES: Record<string, string> = {
  "46102": "46113", // Oglala Lakota County, SD — formerly Shannon County (2015)
  "02063": "02261", // Chugach Census Area, AK — split from Valdez-Cordova (2019)
  "02066": "02261", // Copper River Census Area, AK — split from Valdez-Cordova (2019)
};

/** NRI county outlines with a declaration count (all types, or one incident type); null = no county-level record. */
export function declarationFeatures(counties: GeoJSON.FeatureCollection, decl: Record<string, CountyDeclarations>, type: string | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: counties.features.map((f) => {
      const id = String(f.properties?.id ?? "");
      const d = decl[id] ?? decl[FIPS_ALIASES[id]];
      return {
        type: "Feature",
        id,
        geometry: f.geometry,
        properties: { id, name: f.properties?.name, state: f.properties?.state, n: d ? (type ? d.t[type] ?? 0 : d.n) : null },
      };
    }),
  };
}

/** Notable events to jump to. Values are checked against the baked data by the tests. */
export const NOTABLE = {
  hurricanes: [
    { label: "Katrina 2005", id: "AL122005" },
    { label: "Harvey 2017", id: "AL092017" },
    { label: "Andrew 1992", id: "AL041992" },
    { label: "Maria 2017", id: "AL152017" },
    { label: "Ian 2022", id: "AL092022" },
    { label: "Galveston 1900", id: "AL011900" },
  ],
  tornadoes: [
    { label: "Joplin 2011", year: 2011, md: 522, st: "MO", mag: 5 },
    { label: "Moore 2013", year: 2013, md: 520, st: "OK", mag: 5 },
    { label: "Tuscaloosa 2011", year: 2011, md: 427, st: "AL", mag: 4 },
    { label: "Greensburg 2007", year: 2007, md: 504, st: "KS", mag: 5 },
  ],
} as const;
