/* ------------------------------------------------------------------ */
/*  Ghost Towns data (baked by scripts/atlas/build-ghost.mjs):         */
/*    · GNIS historical populated places — USGS, public domain         */
/*    · Wikidata ghost towns, worldwide — CC0                          */
/*    · towns drowned by reservoirs — Wikipedia list, CC BY-SA         */
/* ------------------------------------------------------------------ */

export const GNIS_GHOST_URL = "/atlas/ghost-gnis.json";
export const GHOST_TOWNS_URL = "/atlas/ghost-towns.json";
export const DROWNED_URL = "/atlas/drowned.json";

export interface GnisCols {
  id: number[];
  name: string[];
  state: (string | null)[];
  county: (string | null)[];
  lng: number[];
  lat: number[];
}

export interface GhostCols {
  id: string[];
  name: string[];
  desc: string[];
  country: (string | null)[];
  lng: number[];
  lat: number[];
  /** Commons file name */
  image: (string | null)[];
  /** English Wikipedia title */
  wiki: (string | null)[];
  founded: (number | null)[];
  abandoned: (number | null)[];
  /** index into GHOST_KINDS (what Wikidata calls the place) */
  kind?: number[];
}

export interface DrownedTown {
  name: string;
  state: string | null;
  reservoir: string;
  /** English Wikipedia title */
  wiki: string | null;
  lng: number;
  lat: number;
  /** placed at its reservoir: the town's own article gives no position */
  approximate: boolean;
}

export const commonsThumb = (file: string, w = 800) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w}`;
export const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
/** USGS GNIS record page for a feature id. */
export const gnisUrl = (id: number) => `https://edits.nationalmap.gov/apps/gaz-domestic/public/summary/${id}`;

export function gnisFeatures(c: GnisCols): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: c.id.map((id, i) => ({
      type: "Feature",
      id,
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
      properties: { id, name: c.name[i], state: c.state[i], county: c.county[i] },
    })),
  };
}

/** What Wikidata calls each place, in the order the bake numbers them. */
export const GHOST_KINDS = ["Ghost town", "Deserted medieval village", "Abandoned village"] as const;
export const ghostKind = (c: GhostCols, i: number) => GHOST_KINDS[c.kind?.[i] ?? 0] ?? GHOST_KINDS[0];

export function ghostFeatures(c: GhostCols): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: c.id.map((id, i) => ({
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
      properties: { i, id, name: c.name[i], country: c.country[i], founded: c.founded[i], abandoned: c.abandoned[i], kind: c.kind?.[i] ?? 0 },
    })),
  };
}

export function drownedFeatures(towns: DrownedTown[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: towns.map((t, i) => ({
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [t.lng, t.lat] },
      properties: { i, name: t.name, state: t.state, reservoir: t.reservoir, wiki: t.wiki, approximate: t.approximate },
    })),
  };
}

/** Lifespan text: "1859–1932", "founded 1877", "abandoned 1911", or null. */
export function lifespan(founded: number | null, abandoned: number | null): string | null {
  if (founded && abandoned) return `${founded}–${abandoned}`;
  if (founded) return `founded ${founded}`;
  if (abandoned) return `abandoned ${abandoned}`;
  return null;
}

/** Great-circle distance in km. */
export function kmBetween([a, b]: [number, number], [c, d]: [number, number]) {
  const r = Math.PI / 180;
  const h = Math.sin(((d - b) * r) / 2) ** 2 + Math.cos(b * r) * Math.cos(d * r) * Math.sin(((c - a) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
