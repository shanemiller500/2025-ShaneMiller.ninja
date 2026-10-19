/* ------------------------------------------------------------------ */
/*  Ghost Towns map layers. Draw order: vanished places (GNIS) →       */
/*  drowned towns → ghost towns (Wikidata) → featured towns.           */
/* ------------------------------------------------------------------ */
import type { Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { GHOST_KINDS, lifespan } from "@/utils/geo/ghost";
import { FEATURED_TOWNS } from "./featured";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];
const halo = (dark: boolean) => ({ "text-halo-color": dark ? "#0c0a09" : "#ffffff", "text-halo-width": dark ? 1.4 : 1.8 });

export const GHOST_COLORS = { gnis: "#a8a29e", ghost: "#fbbf24", drowned: "#38bdf8", osm: "#c084fc" } as const;
/** Zoom from which OpenStreetMap's abandoned places load (they come a box at a time). */
export const OSM_MIN_ZOOM = 9;

/* ── vanished places: every "historical" populated place in GNIS ─── */

export const gnisLayer: AtlasLayer = {
  id: "gnis",
  label: "Vanished places",
  group: "Places",
  defaultOn: true,
  badge: "U.S.",
  description: "Every town, settlement and community the U.S. Geological Survey's place-name register lists as “historical” — places that are gone. Over 10,000 of them, many with nothing left on the ground but the name.",
  legend: [{ color: GHOST_COLORS.gnis, label: "Historical populated place (GNIS)" }],
  citation: { label: "USGS Geographic Names Information System (GNIS)", href: "https://www.usgs.gov/tools/geographic-names-information-system-gnis", license: "public domain" },
  clickable: ["gnis-dot"],
  install(map, { dark }) {
    map.addSource("gnis", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "gnis-dot",
      type: "circle",
      source: "gnis",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 8, 3, 13, 5],
        "circle-color": GHOST_COLORS.gnis,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 8, 0.85],
        "circle-stroke-color": dark ? "#0c0a09" : "#ffffff",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 9, 1],
      },
    });
    map.addLayer({
      id: "gnis-label",
      type: "symbol",
      source: "gnis",
      minzoom: 9,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 10.5, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": dark ? "#d6d3d1" : "#44403c", ...halo(dark) },
    });
    return ["gnis-dot", "gnis-label"];
  },
  hoverLabel: (f) => `${f.properties?.name} · vanished${f.properties?.state ? ` · ${f.properties.state}` : ""}`,
};

/* ── towns under reservoirs ──────────────────────────────────────── */

export const drownedLayer: AtlasLayer = {
  id: "drowned",
  label: "Drowned towns",
  group: "Places",
  defaultOn: true,
  badge: "U.S.",
  description: "Towns flooded when dams filled reservoirs over them. A dashed ring means the town's own position isn't published, so it's marked at its reservoir.",
  legend: [
    { color: GHOST_COLORS.drowned, label: "Town under a reservoir" },
    { color: GHOST_COLORS.drowned, label: "Marked at its reservoir", shape: "ring" },
  ],
  citation: { label: "Wikipedia — List of flooded towns in the United States", href: "https://en.wikipedia.org/wiki/List_of_flooded_towns_in_the_United_States", license: "CC BY-SA 4.0" },
  clickable: ["drowned-dot"],
  install(map, { dark }) {
    map.addSource("drowned", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "drowned-ring",
      type: "circle",
      source: "drowned",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 10, 11],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": GHOST_COLORS.drowned,
        "circle-stroke-width": 1.4,
        "circle-stroke-opacity": ["case", ["boolean", ["get", "approximate"], false], 0.9, 0.35],
      },
    });
    map.addLayer({
      id: "drowned-dot",
      type: "circle",
      source: "drowned",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["case", ["boolean", ["get", "approximate"], false], 2, 3], 10, ["case", ["boolean", ["get", "approximate"], false], 3, 6]],
        "circle-color": GHOST_COLORS.drowned,
        "circle-stroke-color": dark ? "#0c0a09" : "#ffffff",
        "circle-stroke-width": 1,
      },
    });
    map.addLayer({
      id: "drowned-label",
      type: "symbol",
      source: "drowned",
      minzoom: 7,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": dark ? "#bae6fd" : "#075985", ...halo(dark) },
    });
    return ["drowned-ring", "drowned-dot", "drowned-label"];
  },
  hoverLabel: (f) => `${f.properties?.name} · under ${f.properties?.reservoir}`,
};

/* ── ghost towns (Wikidata, worldwide) ───────────────────────────── */

export const ghostLayer: AtlasLayer = {
  id: "ghost",
  label: "Ghost towns & abandoned villages",
  group: "Places",
  defaultOn: true,
  badge: "Worldwide",
  description: "8,500 places Wikidata records as ghost towns, abandoned villages or deserted medieval villages — from Bodie to Kolmanskop in Namibia, Craco in Italy, Spain's empty hill villages and England's lost medieval villages. Click one for its photo and story.",
  legend: [
    { color: GHOST_COLORS.ghost, label: "Ghost town" },
    { color: GHOST_COLORS.ghost, label: "Abandoned or deserted village (smaller)", shape: "ring" },
  ],
  citation: { label: "Wikidata", href: "https://www.wikidata.org/wiki/Q74047", license: "CC0" },
  clickable: ["ghost-dot"],
  install(map, { dark }) {
    map.addSource("ghost", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "ghost-glow",
      type: "circle",
      source: "ghost",
      maxzoom: 7,
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4, 7, 9], "circle-color": GHOST_COLORS.ghost, "circle-blur": 1, "circle-opacity": 0.3 },
    });
    map.addLayer({
      id: "ghost-dot",
      type: "circle",
      source: "ghost",
      paint: {
        // ghost towns are filled dots; abandoned and deserted villages smaller amber rings
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, ["case", ["==", ["get", "kind"], 0], 2, 1.4], 8, ["case", ["==", ["get", "kind"], 0], 4.5, 3.2], 13, ["case", ["==", ["get", "kind"], 0], 7, 5.5]],
        "circle-color": ["case", ["==", ["get", "kind"], 0], GHOST_COLORS.ghost, dark ? "#0c0a09" : "#ffffff"],
        "circle-stroke-color": ["case", ["==", ["get", "kind"], 0], dark ? "#0c0a09" : "#ffffff", GHOST_COLORS.ghost],
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["==", ["get", "kind"], 0], 0.5, 1.4], 9, 1.4],
      },
    });
    map.addLayer({
      id: "ghost-label",
      type: "symbol",
      source: "ghost",
      minzoom: 6.5,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
      paint: { "text-color": dark ? "#fde68a" : "#78350f", ...halo(dark) },
    });
    return ["ghost-glow", "ghost-dot", "ghost-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; founded?: number | null; abandoned?: number | null; kind?: number };
    const life = lifespan(p.founded ?? null, p.abandoned ?? null);
    return `${p.name} · ${(GHOST_KINDS[p.kind ?? 0] ?? GHOST_KINDS[0]).toLowerCase()}${life ? ` · ${life}` : ""}`;
  },
};

/* ── abandoned places mapped in OpenStreetMap (worldwide, zoomed in) ── */

export const osmLayer: AtlasLayer = {
  id: "osm",
  label: "Abandoned places (OpenStreetMap)",
  group: "Places",
  defaultOn: true,
  badge: "Worldwide · zoom in",
  description: "Abandoned towns, villages and hamlets that OpenStreetMap volunteers have mapped anywhere on Earth — loaded for the area on screen once you zoom in close.",
  legend: [{ color: GHOST_COLORS.osm, label: "Abandoned settlement (OSM)" }],
  citation: { label: "OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright", license: "ODbL" },
  clickable: ["osm-dot"],
  install(map, { dark }) {
    map.addSource("osm", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "osm-dot",
      type: "circle",
      source: "osm",
      minzoom: OSM_MIN_ZOOM - 0.5,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3.5, 14, 6],
        "circle-color": GHOST_COLORS.osm,
        "circle-stroke-color": dark ? "#0c0a09" : "#ffffff",
        "circle-stroke-width": 1.2,
      },
    });
    map.addLayer({
      id: "osm-label",
      type: "symbol",
      source: "osm",
      minzoom: 10,
      filter: ["has", "name"],
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 10.5, "text-offset": [0, 1], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": dark ? "#e9d5ff" : "#581c87", ...halo(dark) },
    });
    return ["osm-dot", "osm-label"];
  },
  hoverLabel: (f) => `${f.properties?.name ?? "Unnamed"} · abandoned ${f.properties?.kind ?? "place"} · OpenStreetMap`,
};

/* ── featured towns ──────────────────────────────────────────────── */

export const FEATURED_FC: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: FEATURED_TOWNS.map((t) => ({ type: "Feature", id: t.id, geometry: { type: "Point", coordinates: t.center }, properties: { id: t.id, name: t.name, accent: t.accent } })),
};

let lastBeacon = 0;

export const featuredLayer: AtlasLayer = {
  id: "featured",
  label: "Featured towns",
  group: "Places",
  defaultOn: true,
  description: "Ghost towns with their stories, from Bodie to the drowned towns of the Quabbin.",
  citation: { label: "", href: "" },
  selectSource: "featured",
  clickable: ["featured-core"],
  install(map, { dark }) {
    map.addSource("featured", { type: "geojson", data: FEATURED_FC, promoteId: "id" });
    map.addLayer({ id: "featured-beacon", type: "circle", source: "featured", paint: { "circle-radius": 14, "circle-color": ["get", "accent"], "circle-blur": 0.9, "circle-opacity": 0.5 } });
    map.addLayer({
      id: "featured-core",
      type: "circle",
      source: "featured",
      paint: { "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 8, 6], "circle-color": dark ? "#0c0a09" : "#ffffff", "circle-stroke-color": ["get", "accent"], "circle-stroke-width": 2.5 },
    });
    map.addLayer({
      id: "featured-label",
      type: "symbol",
      source: "featured",
      minzoom: 2.5,
      layout: { "text-field": ["upcase", ["get", "name"]], "text-font": FONT, "text-size": 10.5, "text-letter-spacing": 0.12, "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 10 },
      paint: { "text-color": dark ? ["get", "accent"] : "#1c1917", ...halo(dark) },
    });
    return ["featured-beacon", "featured-core", "featured-label"];
  },
  hoverLabel: (f) => String(f.properties?.name ?? ""),
  animate(map: MlMap, now: number) {
    if (now - lastBeacon < 40 || !map.getLayer("featured-beacon")) return;
    lastBeacon = now;
    const t = (now % 2400) / 2400;
    map.setPaintProperty("featured-beacon", "circle-radius", 8 + 18 * t);
    map.setPaintProperty("featured-beacon", "circle-opacity", 0.55 * (1 - t));
  },
};

export const GHOST_LAYERS: AtlasLayer[] = [gnisLayer, osmLayer, drownedLayer, ghostLayer, featuredLayer];
