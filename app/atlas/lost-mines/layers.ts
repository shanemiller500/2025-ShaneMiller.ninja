/* ------------------------------------------------------------------ */
/*  Lost Mines map layers. Draw order: bedrock geology → mining        */
/*  country (zoomed out) → mines (MRDS + MSHA) → old topo-map symbols  */
/*  (USMIN, zoomed far in) → featured sites.                           */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification as Expr, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { GROUPS, USMIN_KINDS } from "@/utils/geo/mines";
import { MACROSTRAT_TILES, geologyAt } from "@/utils/geo/strange";
import { MINE_SITES } from "./featured";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];
const GROUP_COLOR = ["match", ["get", "g"], ...GROUPS.flatMap((g, i) => [i, g.color]), "#78716c"] as unknown as Expr;
const KIND_COLOR = ["match", ["get", "kind"], ...USMIN_KINDS.flatMap((k, i) => [i, k.color]), "#a8a29e"] as unknown as Expr;
/** Zoom where single mines replace the summary. */
export const MINES_MIN_ZOOM = 6;
/** Zoom where the old topo-map symbols load (they come a box at a time). */
export const USMIN_MIN_ZOOM = 11;

/* ── bedrock geology ─────────────────────────────────────────────── */

export const geologyLayer: AtlasLayer = {
  id: "geology",
  label: "Bedrock geology",
  group: "Ground",
  description: "The rock at the surface, coloured by age. Ore follows geology — veins in old granite and volcanic rock, coal in layered sedimentary basins. Click the map for the rock under any spot.",
  citation: { label: "Macrostrat (University of Wisconsin–Madison)", href: "https://macrostrat.org/", license: "CC-BY 4.0" },
  install(map, { labelLayerId }) {
    map.addSource("geology", { type: "raster", tiles: [MACROSTRAT_TILES], tileSize: 512, maxzoom: 15, attribution: "Geology: Macrostrat (CC-BY 4.0)" });
    map.addLayer({ id: "geology-raster", type: "raster", source: "geology", paint: { "raster-opacity": 0.55, "raster-saturation": -0.15, "raster-fade-duration": 200 } }, labelLayerId);
    return ["geology-raster"];
  },
  async identify(_map, [lng, lat], signal) {
    const unit = await geologyAt(lng, lat, signal);
    return unit ? { layer: "geology", props: unit as unknown as Record<string, unknown>, lngLat: [lng, lat] } : null;
  },
};

/* ── mining country: producing mines per half-degree, zoomed out ── */

export const countryLayer: AtlasLayer = {
  id: "country",
  label: "Mining country",
  group: "Mines",
  defaultOn: true,
  description: "Zoomed out, every half-degree of the country that holds producing or past-producing mines, sized by how many and coloured by the leading commodity. Zoom in to see each mine.",
  legend: GROUPS.filter((g) => g.key !== "other").map((g) => ({ color: g.color, label: g.label })),
  citation: { label: "USGS Mineral Resources Data System · MSHA Mines data set", href: "https://mrdata.usgs.gov/mrds/", license: "public domain" },
  clickable: ["country-dot"],
  install(map, { dark }) {
    map.addSource("country", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "country-dot",
      type: "circle",
      source: "country",
      maxzoom: MINES_MIN_ZOOM,
      layout: { "circle-sort-key": ["get", "n"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, ["interpolate", ["linear"], ["sqrt", ["get", "n"]], 1, 1.4, 40, 9], 5.5, ["interpolate", ["linear"], ["sqrt", ["get", "n"]], 1, 2.5, 40, 18]],
        "circle-color": GROUP_COLOR,
        "circle-opacity": 0.72,
        "circle-stroke-color": dark ? "#0c0a09" : "#ffffff",
        "circle-stroke-width": 0.6,
      },
    });
    return ["country-dot"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { n: number; g: number; gold: number };
    return `${p.n.toLocaleString()} producing mine${p.n === 1 ? "" : "s"} · mostly ${GROUPS[p.g]?.label.toLowerCase()}${p.gold && p.g !== 0 ? ` · ${p.gold} gold` : ""}`;
  },
};

/* ── every mine (MRDS + MSHA), zoomed in ─────────────────────────── */

export const minesLayer: AtlasLayer = {
  id: "mines",
  label: "Mines",
  group: "Mines",
  defaultOn: true,
  badge: "World",
  description: "Every mine in the USGS Mineral Resources Data System — 266,000 in the U.S. and 38,000 in 167 other countries, where its coverage is thinner — producers and past producers as bigger dots, prospects if you switch them on. The coal and metal mines on MSHA's U.S. register get a white ring. Coloured by main commodity.",
  legend: [
    ...GROUPS.filter((g) => g.key !== "other").map((g) => ({ color: g.color, label: g.label })),
    { color: "#ffffff", label: "MSHA register (status kept current)", shape: "ring" as const },
  ],
  citation: { label: "USGS MRDS (not updated since 2011) · MSHA Mines data set", href: "https://mrdata.usgs.gov/mrds/", license: "public domain" },
  clickable: ["mines-dot"],
  install(map, { dark }) {
    map.addSource("mines", { type: "geojson", data: EMPTY });
    const big = ["any", ["==", ["get", "src"], "msha"], ["<=", ["get", "st"], 1]] as unknown as Expr;
    map.addLayer({
      id: "mines-dot",
      type: "circle",
      source: "mines",
      minzoom: MINES_MIN_ZOOM - 0.5,
      layout: { "circle-sort-key": ["case", big, 1, 0] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, ["case", big, 2.2, 1.3], 10, ["case", big, 4.2, 2.6], 14, ["case", big, 7, 4.5]],
        "circle-color": GROUP_COLOR,
        "circle-opacity": ["case", big, 0.95, 0.7],
        "circle-stroke-color": ["case", ["==", ["get", "src"], "msha"], "#ffffff", dark ? "#0c0a09" : "#ffffff"],
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, ["case", ["==", ["get", "src"], "msha"], 1, 0.2], 11, ["case", ["==", ["get", "src"], "msha"], 1.8, 0.8]],
      },
    });
    map.addLayer({
      id: "mines-label",
      type: "symbol",
      source: "mines",
      minzoom: 11.5,
      filter: ["all", ["!=", ["get", "name"], ""], big] as unknown as Expr,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 10.5, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
      paint: { "text-color": dark ? "#fde68a" : "#713f12", "text-halo-color": dark ? "#0c0a09" : "#ffffff", "text-halo-width": dark ? 1.4 : 1.8 },
    });
    return ["mines-dot", "mines-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; g: number; src: string };
    return `${p.name || "Unnamed mine"} · ${GROUPS[p.g]?.label ?? ""}${p.src === "msha" ? " · MSHA" : ""}`;
  },
};

/* ── shafts, adits and pits from the old topo maps (USMIN) ───────── */

export const usminLayer: AtlasLayer = {
  id: "usmin",
  label: "Shafts & adits (old topo maps)",
  group: "Mines",
  defaultOn: true,
  badge: "U.S. · zoom in",
  description: "Every mine symbol the USGS drew on its historical topographic maps — shafts, adits, prospect pits, dumps and tailings — digitized by USGS. U.S. only. Loads for the area on screen once you zoom in close.",
  legend: USMIN_KINDS.map((k) => ({ color: k.color, label: k.label, shape: "ring" as const })),
  citation: { label: "USGS — Prospect- and mine-related features on USGS topographic maps (USMIN)", href: "https://mrdata.usgs.gov/usmin/", license: "public domain" },
  clickable: ["usmin-dot", "usmin-fill"],
  install(map, { dark }) {
    map.addSource("usmin", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "usmin-fill",
      type: "fill",
      source: "usmin",
      minzoom: USMIN_MIN_ZOOM - 0.5,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": KIND_COLOR, "fill-opacity": 0.35, "fill-outline-color": KIND_COLOR },
    });
    map.addLayer({
      id: "usmin-dot",
      type: "circle",
      source: "usmin",
      minzoom: USMIN_MIN_ZOOM - 0.5,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        // rings, so the old-map symbols never read as the filled mine dots
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.4, 15, 5],
        "circle-color": dark ? "#0c0a09" : "#ffffff",
        "circle-stroke-color": KIND_COLOR,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 1.2, 15, 2],
      },
    });
    return ["usmin-fill", "usmin-dot"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { type: string; name?: string | null; topo?: string | null; topoDate?: number | null };
    return `${p.name ? `${p.name} · ` : ""}${p.type}${p.topo ? ` · ${p.topo} map${p.topoDate ? ` (${p.topoDate})` : ""}` : ""}`;
  },
};

/* ── timeline: mines with a known year, up to the chosen decade ──── */

export const datedLayer: AtlasLayer = {
  id: "dated",
  label: "Mines by year",
  group: "Timeline",
  description: "The mines whose records give a year they were found or first produced — about one in twelve. Everything up to the chosen decade stays on the map; that decade's finds glow.",
  legend: [
    { color: "#ffffff", label: "Found or first mined this decade", shape: "ring" },
    ...GROUPS.filter((g) => g.key !== "other").map((g) => ({ color: g.color, label: g.label })),
  ],
  citation: { label: "USGS Mineral Resources Data System", href: "https://mrdata.usgs.gov/mrds/", license: "public domain" },
  clickable: ["dated-dot"],
  install(map, { dark }) {
    map.addSource("dated", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "dated-glow",
      type: "circle",
      source: "dated",
      filter: ["==", ["get", "now"], 1],
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 9, 14], "circle-color": GROUP_COLOR, "circle-blur": 0.9, "circle-opacity": 0.55 },
    });
    map.addLayer({
      id: "dated-dot",
      type: "circle",
      source: "dated",
      layout: { "circle-sort-key": ["get", "now"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["case", ["==", ["get", "now"], 1], 2.8, 1.4], 9, ["case", ["==", ["get", "now"], 1], 6, 3.5]],
        "circle-color": GROUP_COLOR,
        "circle-opacity": ["case", ["==", ["get", "now"], 1], 1, 0.45],
        "circle-stroke-color": ["case", ["==", ["get", "now"], 1], "#ffffff", dark ? "#0c0a09" : "#ffffff"],
        "circle-stroke-width": ["case", ["==", ["get", "now"], 1], 1.2, 0.3],
      },
    });
    return ["dated-glow", "dated-dot"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { y: number; kind: number; g: number };
    return `${GROUPS[p.g]?.label ?? ""} · ${p.kind ? "first produced" : "found"} ${p.y}`;
  },
};

/* ── featured sites ──────────────────────────────────────────────── */

export const SITES_FC: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: MINE_SITES.map((s) => ({ type: "Feature", id: s.id, geometry: { type: "Point", coordinates: s.center }, properties: { id: s.id, name: s.name, accent: s.accent } })),
};

let lastBeacon = 0;

export const sitesLayer: AtlasLayer = {
  id: "sites",
  label: "Featured sites",
  group: "Mines",
  defaultOn: true,
  description: "Gold rushes and famous mines, with their stories from the parks and agencies that look after them.",
  citation: { label: "", href: "" },
  selectSource: "sites",
  clickable: ["sites-core"],
  install(map, { dark }) {
    map.addSource("sites", { type: "geojson", data: SITES_FC, promoteId: "id" });
    map.addLayer({ id: "sites-beacon", type: "circle", source: "sites", paint: { "circle-radius": 14, "circle-color": ["get", "accent"], "circle-blur": 0.9, "circle-opacity": 0.5 } });
    map.addLayer({
      id: "sites-core",
      type: "circle",
      source: "sites",
      paint: { "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 8, 6], "circle-color": dark ? "#0c0a09" : "#ffffff", "circle-stroke-color": ["get", "accent"], "circle-stroke-width": 2.5 },
    });
    map.addLayer({
      id: "sites-label",
      type: "symbol",
      source: "sites",
      minzoom: 2.5,
      layout: { "text-field": ["upcase", ["get", "name"]], "text-font": FONT, "text-size": 10.5, "text-letter-spacing": 0.12, "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 10 },
      paint: { "text-color": dark ? ["get", "accent"] : "#1c1917", "text-halo-color": dark ? "#0c0a09" : "#ffffff", "text-halo-width": dark ? 1.4 : 1.8 },
    });
    return ["sites-beacon", "sites-core", "sites-label"];
  },
  hoverLabel: (f) => String(f.properties?.name ?? ""),
  animate(map: MlMap, now: number) {
    if (now - lastBeacon < 40 || !map.getLayer("sites-beacon")) return;
    lastBeacon = now;
    const t = (now % 2400) / 2400;
    map.setPaintProperty("sites-beacon", "circle-radius", 8 + 18 * t);
    map.setPaintProperty("sites-beacon", "circle-opacity", 0.55 * (1 - t));
  },
};

export const MINE_LAYERS: AtlasLayer[] = [geologyLayer, countryLayer, minesLayer, usminLayer, datedLayer, sitesLayer];
/** Layers only for the map view, and only for the timeline. */
export const MAP_ONLY = ["country", "mines", "usmin"];
export const TIMELINE_ONLY = ["dated"];
