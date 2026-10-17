/* ------------------------------------------------------------------ */
/*  Prehistoric USA time machine: the ancient-Earth maps (PALEOMAP     */
/*  PaleoDEMs, Scotese & Wright 2018, CC BY 4.0) and the fossil sites  */
/*  and U.S. outline at their ancient positions (GPlates, PALEOMAP     */
/*  model), baked by scripts/atlas/build-paleo.mjs.                    */
/* ------------------------------------------------------------------ */
import type { FossilsFile } from "./fossils";

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
}

/** One slice's fossil sites (rows into fossils.json) at their ancient positions, and today's U.S. outline moved back. */
export interface PaleoSliceData {
  age: number;
  i: number[];
  lng: number[];
  lat: number[];
  us: [number, number][][];
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

/** Fossil sites at their ancient positions, with the same filters as the modern map. */
export function paleoFeatures(f: FossilsFile, s: PaleoSliceData, opts: { formation?: number | null; flag?: number } = {}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const c = f.cols;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let k = 0; k < s.i.length; k++) {
    const i = s.i[k];
    if (opts.formation != null && c.fm[i] !== opts.formation) continue;
    if (opts.flag && !(c.flag[i] & opts.flag)) continue;
    features.push({
      type: "Feature",
      id: c.id[i],
      geometry: { type: "Point", coordinates: [s.lng[k], s.lat[k]] },
      properties: { i, id: c.id[i], n: c.n[i], per: c.per[i], max: c.max[i], min: c.min[i], flag: c.flag[i] },
    });
  }
  return { type: "FeatureCollection", features };
}

export function outlineFeatures(s: PaleoSliceData): GeoJSON.FeatureCollection<GeoJSON.MultiLineString> {
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "MultiLineString", coordinates: s.us }, properties: {} }] };
}

/** Where today's U.S. was: the middle of its outline's longest piece (the lower 48). */
export function outlineCenter(s: PaleoSliceData): [number, number] | null {
  const main = [...s.us].sort((a, b) => b.length - a.length)[0];
  if (!main?.length) return null;
  let x = 0;
  let y = 0;
  for (const [lng, lat] of main) {
    x += lng;
    y += lat;
  }
  return [x / main.length, y / main.length];
}

/** "32.4°N" / "1.2°S" / "on the equator" — latitude back then. */
export function fmtPaleoLat(lat: number): string {
  if (Math.abs(lat) < 0.5) return "on the equator";
  return `${Math.abs(lat).toFixed(1)}°${lat > 0 ? "N" : "S"}`;
}
