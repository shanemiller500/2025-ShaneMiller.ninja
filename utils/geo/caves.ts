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
