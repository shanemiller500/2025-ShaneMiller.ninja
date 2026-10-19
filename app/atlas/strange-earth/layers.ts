/* ------------------------------------------------------------------ */
/*  Strange Earth's map layers, declared for <AtlasMap>.               */
/*  Draw order = array order: geology → relief → GNIS landforms →      */
/*  oddities → impact rings → featured anomalies on top.               */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { reliefLayer } from "@/components/atlas/reliefLayer";
import { GA_ATTRIBUTION, GA_BOUNDS, GA_GEOLOGY_TILES, IMPACT_AGE_STOPS, LANDFORM_CLASSES, MACROSTRAT_TILES, STRANGE_CATS, formatAge, geologyAt } from "@/utils/geo/strange";
import { ANOMALIES, VERDICTS } from "./featured";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];

/* ── Macrostrat bedrock geology + "what's under here?" ───────────── */

export const geologyLayer: AtlasLayer = {
  id: "geology",
  label: "Bedrock geology",
  group: "Ground",
  description: "The rock at (or just under) the surface, coloured by age the way geologic maps are. Click anywhere to ask what's under that spot. Worldwide, most detailed in North America; in Australia, Geoscience Australia's 1:1 million map draws on top.",
  citation: { label: "Macrostrat (University of Wisconsin–Madison) · Geoscience Australia 1:1M", href: "https://macrostrat.org/", license: "CC-BY 4.0" },
  install(map, { labelLayerId }) {
    map.addSource("geology", { type: "raster", tiles: [MACROSTRAT_TILES], tileSize: 512, maxzoom: 15, attribution: "Geology: Macrostrat (CC-BY 4.0)" });
    map.addLayer({ id: "geology-raster", type: "raster", source: "geology", paint: { "raster-opacity": 0.62, "raster-saturation": -0.1, "raster-fade-duration": 200 } }, labelLayerId);
    map.addSource("geology-au", { type: "raster", tiles: [GA_GEOLOGY_TILES], tileSize: 256, bounds: GA_BOUNDS, maxzoom: 13, attribution: GA_ATTRIBUTION });
    map.addLayer({ id: "geology-au-raster", type: "raster", source: "geology-au", paint: { "raster-opacity": 0.62, "raster-saturation": -0.1, "raster-fade-duration": 200 } }, labelLayerId);
    return ["geology-raster", "geology-au-raster"];
  },
  async identify(_map, [lng, lat], signal) {
    const unit = await geologyAt(lng, lat, signal);
    return unit ? { layer: "geology", props: unit as unknown as Record<string, unknown>, lngLat: [lng, lat] } : null;
  },
};

/* ── Ice Age (pluvial) lakes of the Great Basin ──────────────────── */

export const lakesLayer: AtlasLayer = {
  id: "lakes",
  label: "Ice Age lakes",
  group: "Ice Age",
  defaultOn: true,
  badge: "Great Basin",
  description: "139 lakes that filled the Great Basin's valleys late in the last Ice Age, mapped from their old shorelines. Click one to refill it in 3D.",
  legend: [{ color: "#38bdf8", label: "Highstand extent" }],
  citation: { label: "Great Basin pluvial lakes, after Mifflin & Wheat (1979)", href: "https://services3.arcgis.com/hDXM0jVzBTOKdR4i/arcgis/rest/services/Great_Basin_Pluvial_Lakes_MW1979/FeatureServer/0" },
  selectSource: "lakes",
  clickable: ["lakes-fill"],
  install(map, { labelLayerId }) {
    map.addSource("lakes", { type: "geojson", data: "/atlas/pluvial.json", promoteId: "id" });
    map.addLayer(
      {
        id: "lakes-fill",
        type: "fill",
        source: "lakes",
        paint: {
          "fill-color": "#0ea5e9",
          // zoom must be the outermost expression; the selection case goes inside each stop
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, ["case", ["boolean", ["feature-state", "selected"], false], 0.5, 0.3], 9, ["case", ["boolean", ["feature-state", "selected"], false], 0.32, 0.14]],
        },
      },
      labelLayerId
    );
    map.addLayer(
      {
        id: "lakes-line",
        type: "line",
        source: "lakes",
        paint: {
          "line-color": "#7dd3fc",
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.4, 1],
          "line-opacity": 0.8,
          "line-dasharray": [3, 1.5],
        },
      },
      labelLayerId
    );
    map.addLayer({
      id: "lakes-label",
      type: "symbol",
      source: "lakes",
      minzoom: 5,
      filter: ["has", "name"],
      layout: {
        "text-field": ["concat", "Lake ", ["get", "name"]],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["get", "areaKm2"], 50, 10, 20000, 15],
        "text-letter-spacing": 0.08,
        "text-max-width": 8,
      },
      paint: { "text-color": "#bae6fd", "text-halo-color": "#020617", "text-halo-width": 1.4 },
    });
    return ["lakes-fill", "lakes-line", "lakes-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name?: string; areaKm2: number };
    return `${p.name ? `Lake ${p.name}` : "Ice Age lake"} · ${Number(p.areaKm2).toLocaleString()} km² · click to refill`;
  },
};

/* ── USGS GNIS official landform names ───────────────────────────── */

const landformColor = ["match", ["get", "cls"], ...LANDFORM_CLASSES.flatMap((c) => [c.key, c.color]), "#e2e8f0"] as unknown as ExpressionSpecification;

export const landformsLayer: AtlasLayer = {
  id: "landforms",
  label: "Named landforms",
  group: "Oddities",
  badge: "U.S.",
  description: "Every arch, pillar, crater and lava feature with an official U.S. name — over 3,000 of them. \"Crater\" here means any origin: most are volcanic, not impacts. Zoom in to see them.",
  legend: LANDFORM_CLASSES.map((c) => ({ color: c.color, label: c.label })),
  citation: { label: "USGS Geographic Names Information System (GNIS)", href: "https://www.usgs.gov/tools/geographic-names-information-system-gnis", license: "public domain" },
  clickable: ["landforms-dot"],
  install(map) {
    map.addSource("landforms", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "landforms-dot",
      type: "circle",
      source: "landforms",
      minzoom: 4.5,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4.5, 1.6, 10, 4.5],
        "circle-color": landformColor,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4.5, 0, 5.5, 0.75],
        "circle-stroke-color": "#020617",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 10, 1],
      },
    });
    map.addLayer({
      id: "landforms-label",
      type: "symbol",
      source: "landforms",
      minzoom: 10,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 10, "text-offset": [0, 0.9], "text-anchor": "top", "text-max-width": 9 },
      paint: { "text-color": "#e2e8f0", "text-halo-color": "#020617", "text-halo-width": 1.2 },
    });
    return ["landforms-dot", "landforms-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; cls: string; state: string | null };
    const cls = LANDFORM_CLASSES.find((c) => c.key === p.cls)?.label ?? p.cls;
    return `${p.name} · ${cls}${p.state ? ` · ${p.state}` : ""}`;
  },
};

/* ── notable oddities (Wikidata) ─────────────────────────────────── */

const catColor = ["match", ["get", "cat"], ...STRANGE_CATS.flatMap((c) => [c.key, c.color]), "#c084fc"] as unknown as ExpressionSpecification;

export const placesLayer: AtlasLayer = {
  id: "places",
  label: "Strange places",
  group: "Oddities",
  defaultOn: true,
  badge: "World",
  description: "Notable landforms worldwide with their own encyclopedia entries — arches, hoodoos, lava fields, dry lakes, geysers, dunes, slot canyons and glacial erratics. Every U.S. one on Wikidata; abroad, the ones with a photo or a Wikipedia article. Filter by kind in this panel.",
  citation: { label: "Wikidata", href: "https://www.wikidata.org/", license: "CC0" },
  selectSource: "places",
  clickable: ["places-dot"],
  install(map) {
    map.addSource("places", { type: "geojson", data: EMPTY, promoteId: "id" });
    map.addLayer({
      id: "places-glow",
      type: "circle",
      source: "places",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 5, 9, 16], "circle-color": catColor, "circle-blur": 1, "circle-opacity": 0.35 },
    });
    map.addLayer({
      id: "places-dot",
      type: "circle",
      source: "places",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.2, 9, 6],
        "circle-color": catColor,
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ffffff", "#020617"],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 0.8],
      },
    });
    map.addLayer({
      id: "places-label",
      type: "symbol",
      source: "places",
      minzoom: 7,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 10 },
      paint: { "text-color": "#f5f3ff", "text-halo-color": "#020617", "text-halo-width": 1.4 },
    });
    return ["places-glow", "places-dot", "places-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; state: string | null };
    return `${p.name}${p.state ? ` · ${p.state}` : ""}`;
  },
};

/* ── confirmed impact structures: true-size rings ────────────────── */

const ageColor = ["interpolate", ["linear"], ["get", "ageMa"], ...IMPACT_AGE_STOPS.flatMap(([a, c]) => [a, c])] as unknown as ExpressionSpecification;
// ring radius doubles with every zoom level, starting from the crater's true size at zoom 0
const trueRadius = ["interpolate", ["exponential", 2], ["zoom"], 0, ["get", "r0"], 20, ["*", ["get", "r0"], 1048576]] as unknown as ExpressionSpecification;
let lastPulse = 0;

export const impactsLayer: AtlasLayer = {
  id: "impacts",
  label: "Impact craters",
  group: "Impacts",
  defaultOn: true,
  description: "Every confirmed impact structure on Earth (Earth Impact Database). Rings are drawn at the crater's true size; colour shows age. Many are eroded or buried — invisible at the surface, but proven by shocked rock.",
  legend: IMPACT_AGE_STOPS.map(([, color, label]) => ({ color, label, shape: "ring" as const })),
  citation: { label: "Earth Impact Database (PASSC, Univ. of New Brunswick) via Wikipedia", href: "https://en.wikipedia.org/wiki/List_of_impact_structures_on_Earth", license: "CC BY-SA" },
  selectSource: "impacts",
  clickable: ["impacts-core", "impacts-ring"],
  install(map) {
    map.addSource("impacts", { type: "geojson", data: EMPTY, promoteId: "id" });
    map.addLayer({
      id: "impacts-shock",
      type: "circle",
      source: "impacts",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 7, 8, 18], "circle-color": ageColor, "circle-blur": 1, "circle-opacity": 0.4 },
    });
    // the true footprint — only worth drawing once it's bigger than the marker
    map.addLayer({
      id: "impacts-ring",
      type: "circle",
      source: "impacts",
      paint: {
        "circle-radius": trueRadius,
        "circle-color": ageColor,
        "circle-opacity": 0.08,
        "circle-stroke-color": ageColor,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.6],
        "circle-stroke-opacity": 0.9,
        "circle-pitch-alignment": "map",
        "circle-pitch-scale": "map",
      },
    });
    map.addLayer({
      id: "impacts-core",
      type: "circle",
      source: "impacts",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.6, 8, 5],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ffffff", ageColor],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.8],
      },
    });
    map.addLayer({
      id: "impacts-label",
      type: "symbol",
      source: "impacts",
      minzoom: 4,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1], "text-anchor": "top", "text-max-width": 9 },
      paint: { "text-color": "#fce7f3", "text-halo-color": "#020617", "text-halo-width": 1.4 },
    });
    return ["impacts-shock", "impacts-ring", "impacts-core", "impacts-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; diameterKm: number; ageMa: number };
    return `${p.name} · ${p.diameterKm} km · ${formatAge(Number(p.ageMa))} old`;
  },
  animate(map: MlMap, now: number) {
    if (now - lastPulse < 60 || !map.getLayer("impacts-shock")) return;
    lastPulse = now;
    map.setPaintProperty("impacts-shock", "circle-opacity", 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(now / 700)));
  },
};

/* ── the featured anomalies ──────────────────────────────────────── */

export const ANOMALY_FC: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: ANOMALIES.map((a) => ({
    type: "Feature",
    id: a.id,
    geometry: { type: "Point", coordinates: a.center },
    properties: { id: a.id, name: a.name, accent: a.accent, verdict: a.verdict, verdictColor: VERDICTS[a.verdict].color },
  })),
};

let lastBeacon = 0;

export const anomaliesLayer: AtlasLayer = {
  id: "anomalies",
  label: "Featured anomalies",
  group: "Impacts",
  defaultOn: true,
  description: "Places worth a closer look — in the U.S. and beyond — each with sourced facts and a 3D flyover.",
  citation: { label: "", href: "" },
  selectSource: "anomalies",
  clickable: ["anomalies-core"],
  install(map) {
    map.addSource("anomalies", { type: "geojson", data: ANOMALY_FC, promoteId: "id" });
    map.addLayer({
      id: "anomalies-beacon",
      type: "circle",
      source: "anomalies",
      paint: { "circle-radius": 14, "circle-color": ["get", "accent"], "circle-blur": 0.9, "circle-opacity": 0.5 },
    });
    map.addLayer({
      id: "anomalies-core",
      type: "circle",
      source: "anomalies",
      paint: {
        "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 8, 6],
        "circle-color": "#020617",
        "circle-stroke-color": ["get", "accent"],
        "circle-stroke-width": 2.5,
      },
    });
    map.addLayer({
      id: "anomalies-label",
      type: "symbol",
      source: "anomalies",
      minzoom: 3,
      layout: {
        "text-field": ["upcase", ["get", "name"]],
        "text-font": FONT,
        "text-size": 10.5,
        "text-letter-spacing": 0.12,
        "text-offset": [0, 1.3],
        "text-anchor": "top",
        "text-allow-overlap": false,
      },
      paint: { "text-color": ["get", "accent"], "text-halo-color": "#020617", "text-halo-width": 1.6 },
    });
    return ["anomalies-beacon", "anomalies-core", "anomalies-label"];
  },
  hoverLabel: (f) => String(f.properties?.name ?? ""),
  animate(map: MlMap, now: number) {
    if (now - lastBeacon < 40 || !map.getLayer("anomalies-beacon")) return;
    lastBeacon = now;
    const t = (now % 2200) / 2200;
    map.setPaintProperty("anomalies-beacon", "circle-radius", 8 + 18 * t);
    map.setPaintProperty("anomalies-beacon", "circle-opacity", 0.55 * (1 - t));
  },
};

export const STRANGE_LAYERS: AtlasLayer[] = [geologyLayer, reliefLayer, lakesLayer, landformsLayer, placesLayer, impactsLayer, anomaliesLayer];
