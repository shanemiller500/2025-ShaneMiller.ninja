/* ------------------------------------------------------------------ */
/*  Prehistoric Earth time machine: the ancient-Earth maps (PALEOMAP   */
/*  PaleoDEMs, Scotese & Wright 2018, CC BY 4.0), the world's fossil   */
/*  sites grouped by spot and today's coastlines at their ancient      */
/*  positions (GPlates, PALEOMAP model), baked by                      */
/*  scripts/atlas/build-paleo.mjs.                                     */
/* ------------------------------------------------------------------ */

export const PALEO_DIR = "/atlas/paleo";
export const PALEO_INDEX_URL = `${PALEO_DIR}/index.json`;
export const paleoImageUrl = (file: string) => `${PALEO_DIR}/${file}.webp`;
export const paleoDataUrl = (file: string) => `${PALEO_DIR}/${file}.json`;

export interface PaleoSlice {
  /** plate-model age of the map, millions of years ago */
  age: number;
  /** "Mid-Cretaceous" */
  label: string;
  /** stratigraphic stage the map shows, e.g. "Turonian" */
  stage: string | null;
  /** age of that stage (Ma) */
  strat: number;
  file: string;
  /** the span of time this map stands for (Ma) */
  lo: number;
  hi: number;
}

export interface PaleoIndex {
  source: string;
  model: string;
  slices: PaleoSlice[];
  /** fossil tile keys, indexed by the slices' `t` column */
  tiles: string[];
  /** today's coastlines: line lengths, then all their points flat [lng, lat, lng, lat…] */
  coast: { lens: number[]; base: number[] };
}

/** One slice: the fossil spots alive then at their ancient positions, and today's coastline points moved back (aligned with the index; null where that crust didn't exist yet). */
export interface PaleoSliceData {
  age: number;
  sites: {
    lng: number[];
    lat: number[];
    /** collections at the spot */
    n: number[];
    finds: number[];
    /** main period */
    per: number[];
    /** any dinosaurs (1) / mammals (2) */
    flag: number[];
    /** the spot's richest collection: fossil tile (index into PaleoIndex.tiles) and row */
    t: number[];
    i: number[];
  };
  coast: ([number, number] | null)[];
}

/** The slice nearest an age. */
export function nearestSlice(slices: PaleoSlice[], age: number): PaleoSlice {
  let best = slices[0];
  for (const s of slices) if (Math.abs(s.age - age) < Math.abs(best.age - age)) best = s;
  return best;
}

/** "90 million years ago" · "Today" */
export function fmtMa(age: number): string {
  if (age === 0) return "Today";
  return `${age.toLocaleString("en-US", { maximumFractionDigits: 1 })} million years ago`;
}

/** Fossil spots at their ancient positions; the dinosaur/mammal filter keeps spots with any. */
export function paleoFeatures(s: PaleoSliceData, tiles: string[], opts: { flag?: number } = {}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const c = s.sites;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let k = 0; k < c.n.length; k++) {
    if (opts.flag && !(c.flag[k] & opts.flag)) continue;
    features.push({
      type: "Feature",
      id: k,
      geometry: { type: "Point", coordinates: [c.lng[k], c.lat[k]] },
      properties: { spot: k, n: c.n[k], finds: c.finds[k], per: c.per[k], flag: c.flag[k], tile: tiles[c.t[k]], i: c.i[k] },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Sites (not spots) in a set of spot features. */
export const sitesIn = (fc: GeoJSON.FeatureCollection) => fc.features.reduce((a, f) => a + Number(f.properties?.n ?? 0), 0);

const gap = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360), a[1] - b[1]);

/**
 * Today's coastlines at their ancient positions, as line pieces: broken where a point has no position,
 * where neighbours drifted far apart (different plates), and across the antimeridian.
 */
export function coastFeatures(coast: PaleoIndex["coast"], then: PaleoSliceData["coast"]): GeoJSON.FeatureCollection<GeoJSON.MultiLineString> {
  const pieces: [number, number][][] = [];
  let k = 0;
  for (const len of coast.lens) {
    let cur: [number, number][] = [];
    const flush = () => {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
    };
    for (let j = 0; j < len; j++, k++) {
      const p = then[k];
      if (!p) {
        flush();
        continue;
      }
      if (cur.length && j > 0) {
        const was = gap([coast.base[(k - 1) * 2], coast.base[(k - 1) * 2 + 1]], [coast.base[k * 2], coast.base[k * 2 + 1]]);
        const last = cur[cur.length - 1];
        if (gap(last, p) > was * 1.3 + 0.5 || Math.abs(last[0] - p[0]) > 180) flush();
      }
      cur.push(p);
    }
    flush();
  }
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "MultiLineString", coordinates: pieces }, properties: {} }] };
}

/** The coastline point nearest a spot in one slice (to follow that land into the next). */
export function nearestCoastPoint(then: PaleoSliceData["coast"], at: [number, number]): number {
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < then.length; k++) {
    const p = then[k];
    if (!p) continue;
    const d = gap(p, at);
    if (d < bestD) [best, bestD] = [k, d];
  }
  return best;
}

/** Where coastline point k is in another slice — or its nearest neighbour along the line that has a position. */
export function coastPointIn(then: PaleoSliceData["coast"], k: number): [number, number] | null {
  for (let step = 0; step < 200; step++) for (const j of [k - step, k + step]) if (then[j]) return then[j]!;
  return null;
}

/** "32.4°N" / "1.2°S" / "on the equator" — latitude back then. */
export function fmtPaleoLat(lat: number): string {
  if (Math.abs(lat) < 0.5) return "on the equator";
  return `${Math.abs(lat).toFixed(1)}°${lat > 0 ? "N" : "S"}`;
}
