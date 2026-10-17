/* ------------------------------------------------------------------ */
/*  Prehistoric USA map layers. Draw order: the ancient Earth (time    */
/*  machine) → bedrock geology → today's U.S. outline moved back in    */
/*  time → fossil collections → featured parks.                        */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification as Expr, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { FLAG_DINO, PERIODS, fmtAge } from "@/utils/geo/fossils";
import { MACROSTRAT_TILES, geologyAt } from "@/utils/geo/strange";
import { FOSSIL_PARKS } from "./featured";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];
const PERIOD_COLOR = ["match", ["get", "per"], ...PERIODS.flatMap((p, i) => [i, p.color]), "#a3a3a3"] as unknown as Expr;
/** Bigger dots for collections with more finds. */
const SIZE = (lo: number, hi: number) => ["interpolate", ["linear"], ["sqrt", ["get", "n"]], 1, lo, 30, hi] as Expr;
const IS_DINO = ["==", ["%", ["get", "flag"], 2], FLAG_DINO] as Expr;
/** Bone white: the ring on dinosaur sites. */
export const BONE = "#fef3c7";

/* ── time machine: Earth as it was (PALEOMAP PaleoDEMs) ──────────── */

/** Deep-ocean colour of the ancient maps — also fills the poles the Mercator image can't reach. */
export const ANCIENT_OCEAN = "#0e2448";
const BLANK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
/** The ancient maps are Web Mercator images of the whole world. */
const WORLD: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, 85.0511287798066],
  [180, 85.0511287798066],
  [180, -85.0511287798066],
  [-180, -85.0511287798066],
];

export const ancientLayer: AtlasLayer = {
  id: "ancient",
  label: "Ancient Earth",
  group: "Time machine",
  description: "Land, shallow seas and deep ocean as they were at the chosen time — reconstructions by Christopher Scotese's PALEOMAP Project, best estimates that grow less certain the further back you go.",
  legend: [
    { color: "#68bac4", label: "Shallow sea" },
    { color: "#16406a", label: "Deep ocean" },
    { color: "#749a5c", label: "Lowland" },
    { color: "#a0825c", label: "Mountains" },
  ],
  citation: { label: "PaleoDEMs — C. R. Scotese & N. M. Wright (2018), PALEOMAP Project", href: "https://doi.org/10.5281/zenodo.5460860", license: "CC BY 4.0" },
  install(map) {
    // drawn over the modern basemap: an opaque ocean, then the ancient map
    map.addLayer({ id: "ancient-ocean", type: "background", paint: { "background-color": ANCIENT_OCEAN } });
    map.addSource("ancient", { type: "image", url: BLANK_PNG, coordinates: WORLD });
    map.addLayer({ id: "ancient-map", type: "raster", source: "ancient", paint: { "raster-fade-duration": 0, "raster-resampling": "linear" } });
    return ["ancient-ocean", "ancient-map"];
  },
};

export const usThenLayer: AtlasLayer = {
  id: "usthen",
  label: "Today's U.S.",
  group: "Time machine",
  description: "Where the land that is now the United States sat at the chosen time, moved back with the same plate model as the fossils. Pieces vanish where that crust didn't exist yet.",
  legend: [{ color: "#ffffff", label: "Today's U.S. outline", shape: "line" }],
  citation: { label: "GPlates Web Service (EarthByte) · PALEOMAP model · Natural Earth", href: "https://gws.gplates.org/" },
  install(map) {
    map.addSource("usthen", { type: "geojson", data: EMPTY });
    map.addLayer({ id: "usthen-halo", type: "line", source: "usthen", paint: { "line-color": "#020617", "line-width": 3.2, "line-opacity": 0.45 } });
    map.addLayer({ id: "usthen-line", type: "line", source: "usthen", paint: { "line-color": "#ffffff", "line-width": 1.4, "line-dasharray": [3, 2], "line-opacity": 0.9 } });
    return ["usthen-halo", "usthen-line"];
  },
};

/* ── bedrock geology (Macrostrat), click for the rock under a spot ── */

export const geologyLayer: AtlasLayer = {
  id: "geology",
  label: "Bedrock geology",
  group: "Ground",
  description: "The rock at the surface, coloured by age like a geologic map. Fossils come from rock of their own age — Jurassic dinosaurs from Jurassic rock. Click the map anywhere for the rock under that spot.",
  citation: { label: "Macrostrat (University of Wisconsin–Madison)", href: "https://macrostrat.org/", license: "CC-BY 4.0" },
  install(map, { labelLayerId }) {
    map.addSource("geology", { type: "raster", tiles: [MACROSTRAT_TILES], tileSize: 512, maxzoom: 15, attribution: "Geology: Macrostrat (CC-BY 4.0)" });
    map.addLayer({ id: "geology-raster", type: "raster", source: "geology", paint: { "raster-opacity": 0.6, "raster-saturation": -0.1, "raster-fade-duration": 200 } }, labelLayerId);
    return ["geology-raster"];
  },
  async identify(_map, [lng, lat], signal) {
    const unit = await geologyAt(lng, lat, signal);
    return unit ? { layer: "geology", props: unit as unknown as Record<string, unknown>, lngLat: [lng, lat] } : null;
  },
};

/* ── fossil collections (PBDB) ───────────────────────────────────── */

export const fossilsLayer: AtlasLayer = {
  id: "fossils",
  label: "Fossil sites",
  group: "Fossils",
  defaultOn: true,
  badge: "U.S.",
  description: "Every U.S. fossil collection in the Paleobiology Database — a quarry, outcrop or bed where scientists recorded what they found. Coloured by geologic period; bigger dots hold more finds. Dinosaur sites get a bone-white ring.",
  legend: [...PERIODS.map((p) => ({ color: p.color, label: p.label })), { color: BONE, label: "Has dinosaur fossils", shape: "ring" as const }],
  citation: { label: "The Paleobiology Database", href: "https://paleobiodb.org/", license: "CC BY 4.0" },
  clickable: ["fossils-dot"],
  install(map, { dark }) {
    map.addSource("fossils", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "fossils-dot",
      type: "circle",
      source: "fossils",
      layout: { "circle-sort-key": ["get", "n"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, SIZE(1.3, 3.6), 8, SIZE(2.6, 7), 13, SIZE(4.5, 11)],
        "circle-color": PERIOD_COLOR,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.72, 8, 0.92],
        "circle-stroke-color": ["case", IS_DINO, BONE, dark ? "#0b0f0a" : "#ffffff"],
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, ["case", IS_DINO, 0.9, 0], 9, ["case", IS_DINO, 2, 0.8]],
      },
    });
    return ["fossils-dot"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { per: number; n: number; max: number; min: number; flag: number };
    return `${PERIODS[p.per]?.label ?? ""} · ${fmtAge(p.max, p.min)} · ${p.n} find${p.n === 1 ? "" : "s"}${p.flag & FLAG_DINO ? " · dinosaurs" : ""}`;
  },
};

/* ── featured fossil parks ───────────────────────────────────────── */

export const PARKS_FC: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: FOSSIL_PARKS.map((p) => ({ type: "Feature", id: p.id, geometry: { type: "Point", coordinates: p.center }, properties: { id: p.id, name: p.name, accent: p.accent } })),
};

let lastBeacon = 0;

export const parksLayer: AtlasLayer = {
  id: "parks",
  label: "Fossil parks",
  group: "Fossils",
  defaultOn: true,
  description: "National parks and monuments protecting famous fossil beds, with their stories from the National Park Service.",
  citation: { label: "National Park Service", href: "https://www.nps.gov/subjects/fossils/", license: "public domain" },
  selectSource: "parks",
  clickable: ["parks-core"],
  install(map, { dark }) {
    map.addSource("parks", { type: "geojson", data: PARKS_FC, promoteId: "id" });
    map.addLayer({ id: "parks-beacon", type: "circle", source: "parks", paint: { "circle-radius": 14, "circle-color": ["get", "accent"], "circle-blur": 0.9, "circle-opacity": 0.5 } });
    map.addLayer({
      id: "parks-core",
      type: "circle",
      source: "parks",
      paint: { "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 8, 6], "circle-color": dark ? "#0b0f0a" : "#ffffff", "circle-stroke-color": ["get", "accent"], "circle-stroke-width": 2.5 },
    });
    map.addLayer({
      id: "parks-label",
      type: "symbol",
      source: "parks",
      minzoom: 2.5,
      layout: { "text-field": ["upcase", ["get", "name"]], "text-font": FONT, "text-size": 10.5, "text-letter-spacing": 0.12, "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 10 },
      paint: { "text-color": dark ? ["get", "accent"] : "#1c1917", "text-halo-color": dark ? "#0b0f0a" : "#ffffff", "text-halo-width": dark ? 1.4 : 1.8 },
    });
    return ["parks-beacon", "parks-core", "parks-label"];
  },
  hoverLabel: (f) => String(f.properties?.name ?? ""),
  animate(map: MlMap, now: number) {
    if (now - lastBeacon < 40 || !map.getLayer("parks-beacon")) return;
    lastBeacon = now;
    const t = (now % 2400) / 2400;
    map.setPaintProperty("parks-beacon", "circle-radius", 8 + 18 * t);
    map.setPaintProperty("parks-beacon", "circle-opacity", 0.55 * (1 - t));
  },
};

export const FOSSIL_LAYERS: AtlasLayer[] = [ancientLayer, geologyLayer, usThenLayer, fossilsLayer, parksLayer];
/** Layers that only make sense in the time machine, and ones that only make sense today. */
export const TIME_ONLY = ["ancient", "usthen"];
export const TODAY_ONLY = ["geology", "parks"];
