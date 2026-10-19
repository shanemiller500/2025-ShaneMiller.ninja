/* ------------------------------------------------------------------ */
/*  Lost Mines data:                                                   */
/*  • MRDS (USGS Mineral Resources Data System, no longer updated     */
/*    since 2011) and MSHA's mine register, baked into 2° tiles by     */
/*    scripts/atlas/build-mines.mjs, plus a 0.5° summary for the       */
/*    zoomed-out view;                                                 */
/*  • USMIN symbols from the old topo maps, live by area (GML parsed   */
/*    here so the API route and tests share it).                       */
/* ------------------------------------------------------------------ */

export const MINES_DIR = "/atlas/mines";
export const MINES_INDEX_URL = `${MINES_DIR}/index.json`;
export const MINES_SUMMARY_URL = `${MINES_DIR}/summary.json`;
export const mineTileUrl = (key: string) => `${MINES_DIR}/t/${key}.json`;
export const TILE_DEG = 2;

/** Commodity groups, in the order the bake numbers them. */
export const GROUPS = [
  { key: "gold", label: "Gold", color: "#facc15" },
  { key: "silver", label: "Silver", color: "#e2e8f0" },
  { key: "copper", label: "Copper", color: "#f97316" },
  { key: "leadzinc", label: "Lead & zinc", color: "#60a5fa" },
  { key: "iron", label: "Iron & ferroalloys", color: "#ef4444" },
  { key: "uranium", label: "Uranium & vanadium", color: "#a3e635" },
  { key: "mercury", label: "Mercury", color: "#f472b6" },
  { key: "othermetal", label: "Other metals", color: "#a78bfa" },
  { key: "coal", label: "Coal", color: "#94a3b8" },
  { key: "industrial", label: "Industrial minerals", color: "#2dd4bf" },
  { key: "other", label: "Other", color: "#78716c" },
] as const;
export type GroupKey = (typeof GROUPS)[number]["key"];
/** Shown unless the person turns them on: sand, gravel, stone and other unlabeled pits. */
export const DEFAULT_OFF = new Set(["industrial", "other"]);

export interface MinesIndex {
  groups: string[];
  mrdsStatus: string[];
  mshaStatus: string[];
  counts: { mrds: number; msha: number; abroad?: number; countries?: number };
  /** tile key → [MRDS count, MSHA count] */
  tiles: Record<string, [number, number]>;
}

export interface MinesSummary {
  cell: number;
  lng: number[];
  lat: number[];
  n: number[];
  g: number[];
  gold: number[];
}

/** One 2° tile as baked (text columns as indexes into `dict`). */
export interface MineTile {
  dict: string[];
  mrds: { id: number[]; lng: number[]; lat: number[]; name: string[]; g: number[]; st: number[]; com: number[]; op: number[]; sz: string[]; disc: number[]; first: number[]; last: number[]; county: number[]; state: number[]; country: number[] };
  msha: { id: string[]; lng: number[]; lat: number[]; name: string[]; g: number[]; st: number[]; date: string[]; type: number[]; sic: number[]; county: number[]; state: number[] };
}

/** Keys of the tiles touching a view (west, south, east, north), only those that exist. */
export function tilesFor(bounds: [number, number, number, number], index: MinesIndex, max = 16): string[] {
  const [w, s, e, n] = bounds;
  const x0 = Math.floor(w / TILE_DEG);
  const x1 = Math.floor(e / TILE_DEG);
  const y0 = Math.floor(s / TILE_DEG);
  const y1 = Math.floor(n / TILE_DEG);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max * 4) return [];
  const out: string[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (index.tiles[`${x}_${y}`]) out.push(`${x}_${y}`);
  // nearest the middle first, capped
  const cx = (w + e) / 2 / TILE_DEG;
  const cy = (s + n) / 2 / TILE_DEG;
  return out
    .sort((a, b) => {
      const [ax, ay] = a.split("_").map(Number);
      const [bx, by] = b.split("_").map(Number);
      return Math.hypot(ax + 0.5 - cx, ay + 0.5 - cy) - Math.hypot(bx + 0.5 - cx, by + 0.5 - cy);
    })
    .slice(0, max);
}

/** Map features for a set of loaded tiles, with the commodity filter. MSHA sites carry a src of "msha". */
export function mineFeatures(tiles: { key: string; tile: MineTile }[], groupsOn: Set<number>, opts: { msha?: boolean; prospects?: boolean } = {}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const { key, tile } of tiles) {
    const m = tile.mrds;
    for (let i = 0; i < m.id.length; i++) {
      if (!groupsOn.has(m.g[i])) continue;
      // prospects and occurrences: never mined (status 2, 3)
      if (!opts.prospects && (m.st[i] === 2 || m.st[i] === 3)) continue;
      features.push({ type: "Feature", id: m.id[i], geometry: { type: "Point", coordinates: [m.lng[i], m.lat[i]] }, properties: { src: "mrds", tile: key, i, g: m.g[i], st: m.st[i], name: m.name[i] } });
    }
    if (opts.msha === false) continue;
    const h = tile.msha;
    for (let i = 0; i < h.id.length; i++) {
      if (!groupsOn.has(h.g[i])) continue;
      // MSHA ids are strings with leading zeros; keep the map's feature ids numeric and apart from MRDS
      features.push({ type: "Feature", id: 9e9 + Number(h.id[i]), geometry: { type: "Point", coordinates: [h.lng[i], h.lat[i]] }, properties: { src: "msha", tile: key, i, g: h.g[i], st: h.st[i], name: h.name[i] } });
    }
  }
  return { type: "FeatureCollection", features };
}

export function summaryFeatures(s: MinesSummary, groupsOn: Set<number>): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let i = 0; i < s.n.length; i++) {
    if (!groupsOn.has(s.g[i])) continue;
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng[i], s.lat[i]] }, properties: { n: s.n[i], g: s.g[i], gold: s.gold[i] } });
  }
  return { type: "FeatureCollection", features };
}

export const mrdsUrl = (id: number) => `https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=${id}`;
/** MSHA's Mine Data Retrieval System — look a mine up there by its ID. */
export const MSHA_MDRS_URL = "https://www.msha.gov/data-and-reports/mine-data-retrieval-system";

/** MRDS production size codes. Their exact meanings were lost (USGS), so only plain labels. */
export const SIZE_LABEL: Record<string, string> = { S: "Small", M: "Medium", L: "Large", Y: "Yes (size not recorded)", N: "None recorded", U: "Unknown" };

/* ── USMIN (old topo map symbols) ──────────────────────────────────── */

export interface UsminProps {
  type: string;
  name: string | null;
  topo: string | null;
  topoDate: number | null;
  scale: number | null;
  url: string | null;
  area: boolean;
}

/** Feature kinds, for colour and legend. */
export const USMIN_KINDS = [
  { key: "shaft", label: "Shaft", color: "#f87171", test: /shaft/i },
  { key: "adit", label: "Adit (tunnel)", color: "#fb923c", test: /adit|tunnel|portal|incline/i },
  { key: "prospect", label: "Prospect pit", color: "#fcd34d", test: /prospect|diggings|trench/i },
  // before "mine": a "Mine Dump" is waste rock
  { key: "waste", label: "Dump / tailings", color: "#a8a29e", test: /dump|tailing|waste|slag/i },
  { key: "mine", label: "Mine / open pit", color: "#c084fc", test: /mine|glory hole|placer|strip/i },
  { key: "pit", label: "Quarry / gravel pit", color: "#5eead4", test: /pit|quarry/i },
] as const;
export function usminKind(type: string): number {
  const i = USMIN_KINDS.findIndex((k) => k.test.test(type));
  return i < 0 ? USMIN_KINDS.length - 1 : i;
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<ms:${name}>([^<]*)</ms:${name}>`).exec(xml);
  return m ? m[1].replace(/&amp;/g, "&").trim() : "";
};

/** USMIN GML (WFS 1.1, latitude first) → GeoJSON features. */
export function parseUsminGml(xml: string, layer: "points" | "polygons"): GeoJSON.Feature[] {
  const out: GeoJSON.Feature[] = [];
  for (const m of xml.split("<gml:featureMember>").slice(1)) {
    const id = /gml:id="([^"]+)"/.exec(m)?.[1];
    let geometry: GeoJSON.Geometry | null = null;
    if (layer === "points") {
      const pos = /<gml:pos>([^<]+)<\/gml:pos>/.exec(m)?.[1].trim().split(/\s+/).map(Number);
      if (pos && pos.length >= 2 && pos.every(Number.isFinite)) geometry = { type: "Point", coordinates: [pos[1], pos[0]] };
    } else {
      const rings: [number, number][][] = [];
      for (const r of Array.from(m.matchAll(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/g))) {
        const v = r[1].trim().split(/\s+/).map(Number);
        const ring: [number, number][] = [];
        for (let k = 0; k + 1 < v.length; k += 2) ring.push([v[k + 1], v[k]]);
        if (ring.length >= 3) {
          const [a, b] = [ring[0], ring[ring.length - 1]];
          if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
          rings.push(ring);
        }
      }
      if (rings.length) geometry = { type: "Polygon", coordinates: rings };
    }
    if (!geometry || !id) continue;
    const type = tag(m, "ftr_type") || "Mine feature";
    const date = Number(tag(m, "topo_date"));
    const scale = Number(tag(m, "topo_scale"));
    out.push({
      type: "Feature",
      id,
      geometry,
      properties: {
        type,
        kind: usminKind(type),
        name: tag(m, "ftr_name") || null,
        topo: tag(m, "topo_name") || null,
        topoDate: Number.isFinite(date) && date > 1800 ? date : null,
        scale: Number.isFinite(scale) && scale > 0 ? scale : null,
        url: tag(m, "url") || null,
        area: layer === "polygons",
      },
    });
  }
  return out;
}

export { kmBetween } from "./near";

/* ── search (server-side, over the baked names index) ─────────────── */

export const MINES_NAMES_PATH = `${MINES_DIR}/names.json`;
export const MINES_DATED_URL = `${MINES_DIR}/dated.json`;

export interface NamesIndex {
  tiles: string[];
  states: string[];
  counties: string[];
  name: string[];
  t: number[];
  i: number[];
  /** 0 = MRDS, 1 = MSHA */
  src: number[];
  g: number[];
  st: number[];
  state: number[];
  county: number[];
  lng: number[];
  lat: number[];
}

export interface MineHit {
  name: string;
  src: "mrds" | "msha";
  tile: string;
  i: number;
  g: number;
  st: number;
  state: string;
  county: string;
  lng: number;
  lat: number;
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const STATE_ABBR: Record<string, string> = { al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California", co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia", hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa", ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland", ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi", mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire", nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina", nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania", ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee", tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington", wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming" };

/** "homestake sd" / "homestake, south dakota" → { name: "homestake", state: "South Dakota" }. A state alone is not a search. */
export function splitState(query: string): { name: string; state: string | null } {
  const q = fold(query);
  const words = q.split(" ");
  for (const n of [2, 1]) {
    if (words.length <= n) continue;
    const tail = words.slice(-n).join(" ");
    const full = Object.values(STATE_ABBR).find((v) => fold(v) === tail) ?? (n === 1 ? STATE_ABBR[tail] : undefined);
    if (full) return { name: words.slice(0, -n).join(" "), state: full };
  }
  return { name: q, state: null };
}

const US_STATES = new Set(Object.values(STATE_ABBR));
const COUNTRY_ALIAS: Record<string, string> = { usa: "united states", us: "united states", america: "united states", uk: "united kingdom", britain: "united kingdom" };
/** The country an index place belongs to: "Perak, Malaysia" → "Malaysia", "Nevada" → "United States". */
export const countryOf = (place: string) => {
  const at = place.lastIndexOf(", ");
  return at >= 0 ? place.slice(at + 2) : US_STATES.has(place) ? "United States" : place;
};

/** "san luis bolivia" → { name: "san luis", places: [every index place in Bolivia] }; null when the query doesn't end in a country. */
export function splitCountry(query: string, places: string[]): { name: string; places: number[] } | null {
  const words = fold(query).split(" ");
  for (const n of [3, 2, 1]) {
    if (words.length <= n) continue;
    const tail = words.slice(-n).join(" ");
    const want = COUNTRY_ALIAS[tail] ?? tail;
    const hits = places.flatMap((p, k) => (fold(countryOf(p)) === want ? [k] : []));
    if (hits.length) return { name: words.slice(0, -n).join(" "), places: hits };
  }
  return null;
}

/** Best matches for a name: exact, then starts-with, then a word starting with it, then anywhere. Producing mines first within each. A trailing state or country narrows it. */
export function searchNames(ix: NamesIndex, query: string, limit = 40, folded?: string[]): MineHit[] {
  const byState = splitState(query);
  let q = byState.name;
  let allowed: Set<number> | null = null;
  if (byState.state) {
    const stateNo = ix.states.indexOf(byState.state);
    if (stateNo < 0) return [];
    allowed = new Set([stateNo]);
  } else {
    const byCountry = splitCountry(query, ix.states);
    if (byCountry) {
      q = byCountry.name;
      allowed = new Set(byCountry.places);
    }
  }
  if (q.length < 2) return [];
  const names = folded ?? ix.name.map(fold);
  const buckets: number[][] = [[], [], [], []];
  for (let k = 0; k < names.length; k++) {
    if (allowed && !allowed.has(ix.state[k])) continue;
    const n = names[k];
    const at = n.indexOf(q);
    if (at < 0) continue;
    const rank = n === q ? 0 : at === 0 ? 1 : n[at - 1] === " " ? 2 : 3;
    buckets[rank].push(k);
  }
  // MSHA (1) and MRDS producers / past producers (st ≤ 1) before prospects
  const weight = (k: number) => (ix.src[k] === 1 || ix.st[k] <= 1 ? 0 : 1);
  const out: MineHit[] = [];
  for (const b of buckets) {
    b.sort((a, c) => weight(a) - weight(c) || names[a].length - names[c].length);
    for (const k of b) {
      out.push({ name: ix.name[k], src: ix.src[k] ? "msha" : "mrds", tile: ix.tiles[ix.t[k]], i: ix.i[k], g: ix.g[k], st: ix.st[k], state: ix.states[ix.state[k]] ?? "", county: ix.counties[ix.county[k]] ?? "", lng: ix.lng[k], lat: ix.lat[k] });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Folded names, built once per server instance and reused across searches. */
export const foldNames = (ix: NamesIndex) => ix.name.map(fold);

/* ── timeline (dated sites) ────────────────────────────────────────── */

export interface DatedMines {
  tiles: string[];
  t: number[];
  i: number[];
  g: number[];
  /** earliest known year: discovered (kind 0) or first produced (kind 1) */
  y: number[];
  kind: number[];
  lng: number[];
  lat: number[];
}

/** Dated sites up to `year`, the ones from its decade flagged "now". */
export function datedFeatures(d: DatedMines, year: number, groupsOn: Set<number>): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const decade = Math.floor(year / 10) * 10;
  for (let k = 0; k < d.y.length; k++) {
    if (d.y[k] > decade + 9 || !groupsOn.has(d.g[k])) continue;
    features.push({
      type: "Feature",
      id: k,
      geometry: { type: "Point", coordinates: [d.lng[k], d.lat[k]] },
      properties: { src: "mrds", tile: d.tiles[d.t[k]], i: d.i[k], g: d.g[k], y: d.y[k], kind: d.kind[k], now: d.y[k] >= decade ? 1 : 0 },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Dated sites per decade, for the histogram under the slider. */
export function perDecade(d: DatedMines, from: number, to: number, groupsOn?: Set<number>): number[] {
  const out = new Array(Math.floor((to - from) / 10) + 1).fill(0);
  for (let k = 0; k < d.y.length; k++) {
    if (groupsOn && !groupsOn.has(d.g[k])) continue;
    const b = Math.floor((Math.max(from, Math.min(to, d.y[k])) - from) / 10);
    out[b]++;
  }
  return out;
}
