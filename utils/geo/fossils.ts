/* ------------------------------------------------------------------ */
/*  Prehistoric Earth data: every fossil collection in the world in    */
/*  the Paleobiology Database (CC BY 4.0, ~278,000), baked by          */
/*  scripts/atlas/build-fossils.mjs into 2° tiles, a 1° summary for    */
/*  the zoomed-out map and a formation index — plus live lookups of    */
/*  one collection's details and the taxa found there.                 */
/* ------------------------------------------------------------------ */

export const FOSSILS_DIR = "/atlas/fossils";
export const FOSSILS_INDEX_URL = `${FOSSILS_DIR}/index.json`;
export const FOSSILS_SUMMARY_URL = `${FOSSILS_DIR}/summary.json`;
export const FOSSILS_FORMATIONS_URL = `${FOSSILS_DIR}/formations.json`;
export const fossilTileUrl = (key: string) => `${FOSSILS_DIR}/t/${key}.json`;
export const TILE_DEG = 2;
/** Zoom where single sites replace the summary. */
export const SITES_MIN_ZOOM = 6;
const PBDB = "https://paleobiodb.org/data1.2";

export interface Period {
  key: string;
  label: string;
  /** start of the period, millions of years ago */
  start: number;
  color: string;
}

export const FLAG_DINO = 1;
export const FLAG_MAMMAL = 2;

/** Geologic periods, youngest first — the same table build-fossils.mjs writes into the index (ICS chart colours). */
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

/* ── baked files ───────────────────────────────────────────────────── */

export interface FossilIndex {
  periods: Period[];
  tile: number;
  /** tile key → number of sites */
  tiles: Record<string, number>;
  counts: { sites: number; finds: number; dino: number; mammal: number; countries: number; formations: number };
}

export interface FossilSummary {
  cell: number;
  x: number[];
  y: number[];
  /** per cell: [period, sites, with dinosaurs, with mammals] for each period present */
  rows: [number, number, number, number][][];
}

/** One 2° tile: text columns are indexes into `dict` (−1 = none). */
export interface FossilTile {
  dict: string[];
  cols: { id: number[]; lng: number[]; lat: number[]; n: number[]; max: number[]; min: number[]; per: number[]; fm: number[]; cc: number[]; st: number[]; flag: number[] };
}

export interface FormationIndex {
  tiles: string[];
  name: string[];
  n: number[];
  /** main period */
  per: number[];
  /** [w, s, e, n] */
  bbox: [number, number, number, number][];
  /** tiles it appears in, as indexes into `tiles` */
  t: number[][];
}

export interface LoadedTile {
  key: string;
  tile: FossilTile;
}

export interface Filters {
  period?: number | null;
  /** FLAG_DINO / FLAG_MAMMAL */
  flag?: number;
  /** a formation's name */
  formation?: string | null;
}

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

/** Zoomed out: one dot per 1° cell, sized by the sites that pass the filters, coloured by their main period. */
export function summaryFeatures(s: FossilSummary, f: Filters = {}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const col = f.flag === FLAG_DINO ? 2 : f.flag === FLAG_MAMMAL ? 3 : 1;
  for (let c = 0; c < s.x.length; c++) {
    let n = 0;
    let best = -1;
    let bestN = 0;
    for (const r of s.rows[c]) {
      if (f.period != null && r[0] !== f.period) continue;
      const v = r[col];
      n += v;
      if (v > bestN) [best, bestN] = [r[0], v];
    }
    if (!n) continue;
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [(s.x[c] + 0.5) * s.cell, (s.y[c] + 0.5) * s.cell] }, properties: { n, per: best } });
  }
  return { type: "FeatureCollection", features };
}

/** Sites per period under the show filter, from the summary (the whole world). */
export function periodCounts(s: FossilSummary, flag?: number): number[] {
  const col = flag === FLAG_DINO ? 2 : flag === FLAG_MAMMAL ? 3 : 1;
  const out = PERIODS.map(() => 0);
  for (const rows of s.rows) for (const r of rows) out[r[0]] += r[col];
  return out;
}

/** Zoomed in (or one formation): every site in the loaded tiles that passes the filters. */
export function tileFeatures(tiles: LoadedTile[], f: Filters = {}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const { key, tile } of tiles) {
    const c = tile.cols;
    const fm = f.formation != null ? tile.dict.indexOf(f.formation) : null;
    if (fm === -1) continue;
    for (let i = 0; i < c.id.length; i++) {
      if (f.period != null && c.per[i] !== f.period) continue;
      if (f.flag && !(c.flag[i] & f.flag)) continue;
      if (fm != null && c.fm[i] !== fm) continue;
      features.push({
        type: "Feature",
        id: c.id[i],
        geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
        properties: { tile: key, i, id: c.id[i], n: c.n[i], per: c.per[i], max: c.max[i], min: c.min[i], flag: c.flag[i] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/** Keys of the tiles touching a view (west, south, east, north) that exist, nearest the middle first, capped. */
export function tilesFor(bounds: [number, number, number, number], index: FossilIndex, max = 16): string[] {
  const [w, s, e, n] = bounds;
  const x0 = Math.floor(w / TILE_DEG);
  const x1 = Math.floor(e / TILE_DEG);
  const y0 = Math.floor(s / TILE_DEG);
  const y1 = Math.floor(n / TILE_DEG);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max * 6) return [];
  const out: string[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (index.tiles[`${x}_${y}`]) out.push(`${x}_${y}`);
  const cx = (w + e) / 2 / TILE_DEG;
  const cy = (s + n) / 2 / TILE_DEG;
  const dist = (k: string) => {
    const [x, y] = k.split("_").map(Number);
    return Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  };
  return out.sort((a, b) => dist(a) - dist(b)).slice(0, max);
}

/** The tile around a point and its eight neighbours that exist. */
export function tilesAround([lng, lat]: [number, number], index: FossilIndex): string[] {
  const x = Math.floor(lng / TILE_DEG);
  const y = Math.floor(lat / TILE_DEG);
  const out: string[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (index.tiles[`${x + dx}_${y + dy}`]) out.push(`${x + dx}_${y + dy}`);
  return out;
}

export const tileKeyOf = (lng: number, lat: number) => `${Math.floor(lng / TILE_DEG)}_${Math.floor(lat / TILE_DEG)}`;

/** A centre and zoom that roughly fit a [w, s, e, n] box. */
export function fitBbox([w, s, e, n]: [number, number, number, number]): { center: [number, number]; zoom: number } {
  const span = Math.max(e - w, (n - s) * 1.4, 0.05);
  return { center: [(w + e) / 2, (s + n) / 2], zoom: Math.max(2.5, Math.min(12, Math.log2(360 / span) + 0.2)) };
}

/** Formations whose name contains the search, biggest first. */
export function searchFormations(fi: FormationIndex, query: string, limit = 12): number[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: number[] = [];
  // the index is sorted by size, so the first hits are the biggest
  for (let k = 0; k < fi.name.length && out.length < limit; k++) if (fi.name[k].toLowerCase().includes(q)) out.push(k);
  return out;
}

/** Text of a dictionary column for one row ("" when none). */
export const word = (t: FossilTile, col: "fm" | "cc" | "st", i: number) => {
  const k = t.cols[col][i];
  return k >= 0 ? t.dict[k] : "";
};

/* ── live lookups ──────────────────────────────────────────────────── */

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
    // PBDB marks a missing class as NO_CLASS_SPECIFIED
    const known = (v?: string) => (v && !/^NO_[A-Z_]+_SPECIFIED$/.test(v) ? v : null);
    const g = known(r.class) || known(r.phylum) || "Unclassified";
    if (!by.has(g)) by.set(g, new Set());
    by.get(g)!.add(r.accepted_name || r.identified_name);
  }
  return Array.from(by.entries())
    .map(([group, set]) => ({ group, names: Array.from(set).sort() }))
    .sort((a, b) => b.names.length - a.names.length);
}
