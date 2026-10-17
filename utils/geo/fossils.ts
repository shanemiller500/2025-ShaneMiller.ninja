/* ------------------------------------------------------------------ */
/*  Prehistoric USA data: every U.S. fossil collection in the          */
/*  Paleobiology Database (CC BY 4.0), baked by                        */
/*  scripts/atlas/build-fossils.mjs, plus live lookups of one          */
/*  collection's details and the taxa found there.                     */
/* ------------------------------------------------------------------ */

export const FOSSILS_URL = "/atlas/fossils.json";
const PBDB = "https://paleobiodb.org/data1.2";

export interface Period {
  key: string;
  label: string;
  /** start of the period, millions of years ago */
  start: number;
  color: string;
}

export interface FossilCols {
  id: number[];
  lng: number[];
  lat: number[];
  /** number of finds (occurrences) */
  n: number[];
  /** age range, millions of years ago */
  max: number[];
  min: number[];
  /** index into periods */
  per: number[];
  /** index into formations (−1 = none) */
  fm: number[];
  /** index into states (−1 = none) */
  st: number[];
  /** 1 = dinosaurs, 2 = mammals */
  flag: number[];
}

export interface FossilsFile {
  generated: string;
  periods: Period[];
  formations: string[];
  states: string[];
  cols: FossilCols;
}

export const FLAG_DINO = 1;
export const FLAG_MAMMAL = 2;

/** Geologic periods, youngest first — the same table build-fossils.mjs writes into fossils.json (ICS chart colours). */
export const PERIODS: Period[] = [
  { key: "quaternary", label: "Quaternary", start: 2.58, color: "#F9F97F" },
  { key: "neogene", label: "Neogene", start: 23.03, color: "#FFE619" },
  { key: "paleogene", label: "Paleogene", start: 66, color: "#FD9A52" },
  { key: "cretaceous", label: "Cretaceous", start: 145, color: "#7FC64E" },
  { key: "jurassic", label: "Jurassic", start: 201.4, color: "#34B2C9" },
  { key: "triassic", label: "Triassic", start: 251.9, color: "#812B92" },
  { key: "permian", label: "Permian", start: 298.9, color: "#F04028" },
  { key: "carboniferous", label: "Carboniferous", start: 358.9, color: "#67A599" },
  { key: "devonian", label: "Devonian", start: 419.2, color: "#CB8C37" },
  { key: "silurian", label: "Silurian", start: 443.8, color: "#B3E1B6" },
  { key: "ordovician", label: "Ordovician", start: 485.4, color: "#009270" },
  { key: "cambrian", label: "Cambrian", start: 538.8, color: "#7FA056" },
  { key: "precambrian", label: "Precambrian", start: 4600, color: "#F74370" },
];
/** When a period ended (= when the next-younger one began). */
export const periodEnd = (i: number) => (i === 0 ? 0 : PERIODS[i - 1].start);

/** "152–145 million years ago", "2.6 million – 11,700 years ago", "126,000–11,700 years ago". Ages are in millions of years. */
export function fmtAge(max: number, min: number): string {
  const ma = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 1 : 0 });
  const yrs = (v: number) => Math.round(v * 1e6).toLocaleString("en-US");
  if (min >= 1) return max - min < 0.05 ? `${ma(max)} million years ago` : `${ma(max)}–${ma(min)} million years ago`;
  const end = min <= 0 ? "the present" : `${yrs(min)} years ago`;
  if (max >= 1) return `${ma(max)} million years ago – ${end}`;
  if (max - min < 1e-6) return `about ${yrs(max)} years ago`;
  return min <= 0 ? `${yrs(max)} years ago – the present` : `${yrs(max)}–${yrs(min)} years ago`;
}

/** Collections whose state field names this state (some list two or three). */
export function inState(f: FossilsFile, i: number, state: string): boolean {
  const s = f.cols.st[i];
  return s >= 0 && f.states[s].split(", ").includes(state);
}

/** GeoJSON for the map, optionally only some periods / one formation / a flag. */
export function fossilFeatures(f: FossilsFile, opts: { periods?: Set<number>; formation?: number | null; flag?: number } = {}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const c = f.cols;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let i = 0; i < c.id.length; i++) {
    if (opts.periods && !opts.periods.has(c.per[i])) continue;
    if (opts.formation != null && c.fm[i] !== opts.formation) continue;
    if (opts.flag && !(c.flag[i] & opts.flag)) continue;
    features.push({
      type: "Feature",
      id: c.id[i],
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
      properties: { i, id: c.id[i], n: c.n[i], per: c.per[i], max: c.max[i], min: c.min[i], flag: c.flag[i] },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Where a set of collections lies: centre and a zoom that roughly fits them. */
export function extentOf(c: FossilCols, rows: number[]): { center: [number, number]; zoom: number } | null {
  if (!rows.length) return null;
  let w = 180;
  let e = -180;
  let s = 90;
  let n = -90;
  for (const i of rows) {
    w = Math.min(w, c.lng[i]);
    e = Math.max(e, c.lng[i]);
    s = Math.min(s, c.lat[i]);
    n = Math.max(n, c.lat[i]);
  }
  const span = Math.max(e - w, (n - s) * 1.4, 0.05);
  return { center: [(w + e) / 2, (s + n) / 2], zoom: Math.max(3, Math.min(12, Math.log2(360 / span) + 0.2)) };
}

export const pbdbCollectionUrl = (id: number) => `https://paleobiodb.org/classic/basicCollectionSearch?collection_no=${id}`;

export interface CollectionDetails {
  name: string;
  formation: string | null;
  interval: string | null;
  state: string | null;
  county: string | null;
  lithology: string | null;
  environment: string | null;
  reference: string | null;
}

export async function collectionDetails(id: number, signal?: AbortSignal): Promise<CollectionDetails | null> {
  const res = await fetch(`${PBDB}/colls/single.json?id=${id}&show=loc,strat,lith,geo,ref&vocab=pbdb`, { signal });
  if (!res.ok) return null;
  const r = ((await res.json()) as { records?: Record<string, string>[] }).records?.[0];
  if (!r) return null;
  const clean = (v?: string) => (v ? v.replace(/^"|"$/g, "").trim() || null : null);
  return {
    name: r.collection_name,
    formation: clean(r.formation),
    interval: [r.early_interval, r.late_interval].filter(Boolean).join(" – ") || null,
    state: clean(r.state),
    county: clean(r.county),
    lithology: clean(r.lithology1),
    environment: clean(r.environment),
    reference: clean(r.primary_reference)?.replace(/<[^>]+>/g, "") ?? null,
  };
}

export interface TaxonGroup {
  /** class (or phylum when there's no class) */
  group: string;
  names: string[];
}

/** What was found there, grouped by class. */
export async function collectionTaxa(id: number, signal?: AbortSignal): Promise<TaxonGroup[]> {
  const res = await fetch(`${PBDB}/occs/list.json?coll_id=${id}&show=class&vocab=pbdb&limit=500`, { signal });
  if (!res.ok) return [];
  const recs = ((await res.json()) as { records?: Record<string, string>[] }).records ?? [];
  const by = new Map<string, Set<string>>();
  for (const r of recs) {
    const g = r.class || r.phylum || "Other";
    if (!by.has(g)) by.set(g, new Set());
    by.get(g)!.add(r.accepted_name || r.identified_name);
  }
  return Array.from(by.entries())
    .map(([group, set]) => ({ group, names: Array.from(set).sort() }))
    .sort((a, b) => b.names.length - a.names.length);
}
