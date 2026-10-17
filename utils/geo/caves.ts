import type { FeatureCollection, Point } from "geojson";

/* ------------------------------------------------------------------ */
/*  Caves — Wikidata (CC0), baked by scripts/atlas/build-caves.mjs     */
/*  into public/atlas/caves.json. Only publicly toured caves carry an  */
/*  exact location; the rest are snapped to a ~10 km grid.             */
/* ------------------------------------------------------------------ */

export const CAVES_URL = "/atlas/caves.json";

export type CaveKind = "show" | "lava" | "wild" | "heritage" | "ice" | "sea";

export interface CaveProps {
  id: string;
  name: string;
  desc: string;
  kind: CaveKind;
  /** the public can visit (show cave / park cave) */
  tour: boolean;
  /** location snapped to a ~10 km grid to protect the cave */
  generalized: boolean;
  state: string | null;
  areas: string[];
  lengthKm: number | null;
  depthM: number | null;
  image: string | null;
  wiki: string | null;
}

export type CaveCollection = FeatureCollection<Point, CaveProps>;

export const CAVE_KINDS: { key: CaveKind; label: string; color: string }[] = [
  { key: "show", label: "Public tours", color: "#22d3ee" },
  { key: "lava", label: "Lava tube", color: "#fb923c" },
  { key: "wild", label: "Wild cave (location generalized)", color: "#818cf8" },
  { key: "heritage", label: "Archaeological (generalized)", color: "#f472b6" },
  { key: "ice", label: "Ice cave", color: "#bae6fd" },
  { key: "sea", label: "Sea cave", color: "#2dd4bf" },
];

export const caveKind = (k: string) => CAVE_KINDS.find((c) => c.key === k) ?? CAVE_KINDS[2];

export type CaveFilter = "tours" | "all";

/** caves.json is column-wise (14k caves worldwide); this turns it back into GeoJSON. */
export interface CaveColumns {
  id: string[];
  name: string[];
  desc: string[];
  kind: CaveKind[];
  tour: number[];
  gen: number[];
  state: (string | null)[];
  areas: string[];
  len: (number | null)[];
  depth: (number | null)[];
  image: (string | null)[];
  wiki: (string | null)[];
  lng: number[];
  lat: number[];
}

const commonsThumb = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800`;
const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

export function caveCollection(json: { cols: CaveColumns } | CaveCollection): CaveCollection {
  if ("features" in json) return json;
  const c = json.cols;
  return {
    type: "FeatureCollection",
    features: c.id.map((id, i) => ({
      type: "Feature",
      id,
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
      properties: {
        id,
        name: c.name[i],
        desc: c.desc[i],
        kind: c.kind[i],
        tour: !!c.tour[i],
        generalized: !!c.gen[i],
        state: c.state[i],
        areas: c.areas[i] ? c.areas[i].split("|") : [],
        lengthKm: c.len[i],
        depthM: c.depth[i],
        image: c.image[i] ? commonsThumb(c.image[i]!) : null,
        wiki: c.wiki[i] ? wikiUrl(c.wiki[i]!) : null,
      },
    })),
  };
}
