/* ------------------------------------------------------------------ */
/*  Underground USA's map layers, declared for <AtlasMap>.             */
/*  Draw order = array order: x-ray blackout → relief → karst → caves. */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { CAVE_KINDS } from "@/utils/geo/caves";
import { KARST_CLASSES } from "@/utils/geo/karst";
import { reliefLayer } from "@/components/atlas/reliefLayer";

export { reliefLayer };

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/* ── X-ray: black out the surface so what's underneath glows ─────── */

export const xrayLayer: AtlasLayer = {
  id: "xray",
  label: "X-ray",
  group: "View",
  description: "Black out the surface world so the rock that holds caves glows through.",
  citation: { label: "", href: "" },
  install(map, { labelLayerId }) {
    map.addSource("xray", {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } },
    });
    map.addLayer({ id: "xray-fill", type: "fill", source: "xray", paint: { "fill-color": "#01030a", "fill-opacity": 0.86 } }, labelLayerId);
    return ["xray-fill"];
  },
};

/* ── karst ───────────────────────────────────────────────────────── */

const karstColor = ["match", ["get", "cls"], ...KARST_CLASSES.flatMap((c) => [c.key, c.color]), "#22d3ee"] as unknown as ExpressionSpecification;

export const karstLayer: AtlasLayer = {
  id: "karst",
  label: "Karst rock",
  group: "Underground",
  defaultOn: true,
  description: "Rock that dissolves (karst) or hollows out (pseudokarst). Bright = at the surface, dim = buried under other sediment. Zoom past 8 for full-detail outlines; click for the rock unit. Lower 48 only — no public karst map exists for Alaska, Hawaii or Puerto Rico.",
  legend: KARST_CLASSES.filter((c) => c.key !== "sandstone").map((c) => ({ color: c.color, label: c.label })),
  citation: { label: "USGS OFR 2014-1156 — Karst in the United States (Weary & Doctor)", href: "https://doi.org/10.3133/ofr20141156", license: "public domain" },
  clickable: ["karst-detail-fill", "karst-fill"],
  install(map, { labelLayerId }) {
    // data comes from the page (it also reads the area stats from the same file)
    map.addSource("karst", { type: "geojson", data: EMPTY, tolerance: 0.6 });
    map.addLayer(
      {
        id: "karst-fill",
        type: "fill",
        source: "karst",
        paint: {
          "fill-color": karstColor,
          // fade the fill when zoomed in: the outlines are generalized to ~1 km
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, ["case", ["==", ["get", "exp"], "buried"], 0.1, 0.26], 9, ["case", ["==", ["get", "exp"], "buried"], 0.04, 0.1]],
        },
      },
      labelLayerId
    );
    // soft neon edge
    map.addLayer(
      {
        id: "karst-glow",
        type: "line",
        source: "karst",
        paint: {
          "line-color": karstColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2.5, 8, 6],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 3, 2.5, 8, 6],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.5, ["case", ["==", ["get", "exp"], "buried"], 0.18, 0.45], 9, 0],
        },
      },
      labelLayerId
    );
    map.addLayer(
      {
        id: "karst-line",
        type: "line",
        source: "karst",
        paint: {
          "line-color": karstColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 8, 1.2],
          // hand over to the full-detail outlines once zoomed in
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.5, ["case", ["==", ["get", "exp"], "buried"], 0.35, 0.85], 9, 0],
        },
      },
      labelLayerId
    );
    // full-detail polygons for the area on screen (zoom 8+), loaded live by the page
    map.addSource("karst-detail", { type: "geojson", data: EMPTY, tolerance: 0.3 });
    map.addLayer(
      {
        id: "karst-detail-fill",
        type: "fill",
        source: "karst-detail",
        minzoom: 7.5,
        paint: { "fill-color": karstColor, "fill-opacity": ["case", ["==", ["get", "exp"], "buried"], 0.06, 0.16] },
      },
      labelLayerId
    );
    map.addLayer(
      {
        id: "karst-detail-line",
        type: "line",
        source: "karst-detail",
        minzoom: 7.5,
        paint: {
          "line-color": karstColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 13, 1.6],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.5, 0, 9, ["case", ["==", ["get", "exp"], "buried"], 0.4, 0.9]],
        },
      },
      labelLayerId
    );
    return ["karst-fill", "karst-glow", "karst-line", "karst-detail-fill", "karst-detail-line"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { cls: string; exp: string };
    const c = KARST_CLASSES.find((k) => k.key === p.cls);
    return `${c?.label ?? "Karst"} · ${p.exp === "buried" ? "buried" : "at the surface"}`;
  },
};

/* ── caves ───────────────────────────────────────────────────────── */

const caveColor = ["match", ["get", "kind"], ...CAVE_KINDS.flatMap((k) => [k.key, k.color]), "#818cf8"] as unknown as ExpressionSpecification;
let lastPulse = 0;

export const cavesLayer: AtlasLayer = {
  id: "caves",
  label: "Caves",
  group: "Underground",
  defaultOn: true,
  badge: "Worldwide",
  description: "About 14,000 caves worldwide. Show caves and park caves you can visit are pinned exactly; wild, closed and archaeological caves are shown only to the nearest ~10 km, to protect them. Zoom in close for cave entrances mapped in OpenStreetMap (closed or private ones are left out).",
  legend: [
    ...CAVE_KINDS.slice(0, 4).map((k) => ({ color: k.color, label: k.label, shape: k.key === "wild" || k.key === "heritage" ? ("ring" as const) : ("dot" as const) })),
    { color: "#e2e8f0", label: "Cave entrance (OpenStreetMap, zoom in)" },
  ],
  citation: { label: "Wikidata · OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright", license: "CC0 · ODbL" },
  selectSource: "caves",
  clickable: ["caves-core", "caves-ring", "osm-caves-dot"],
  install(map, { dark }) {
    map.addSource("caves", { type: "geojson", data: EMPTY, promoteId: "id" });
    // OpenStreetMap entrances, loaded only for the view once zoomed in
    map.addSource("osm-caves", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "osm-caves-dot",
      type: "circle",
      source: "osm-caves",
      minzoom: 10.5,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 15, 6],
        "circle-color": ["case", ["boolean", ["get", "show"], false], "#22d3ee", "#e2e8f0"],
        "circle-stroke-color": dark ? "#020617" : "#334155",
        "circle-stroke-width": 1.2,
      },
    });
    map.addLayer({
      id: "osm-caves-label",
      type: "symbol",
      source: "osm-caves",
      minzoom: 12,
      filter: ["has", "name"],
      layout: { "text-field": ["get", "name"], "text-font": ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"], "text-size": 10.5, "text-offset": [0, 1], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": dark ? "#e2e8f0" : "#0f172a", "text-halo-color": dark ? "#020617" : "#ffffff", "text-halo-width": 1.3 },
    });
    // breathing halo under every toured cave
    map.addLayer({
      id: "caves-halo",
      type: "circle",
      source: "caves",
      filter: ["==", ["get", "tour"], true],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 9, 9, 22],
        "circle-color": caveColor,
        "circle-blur": 1,
        "circle-opacity": 0.45,
        "circle-pitch-alignment": "map",
      },
    });
    // generalized caves: a hollow ring, never a precise dot
    map.addLayer({
      id: "caves-ring",
      type: "circle",
      source: "caves",
      filter: ["==", ["get", "generalized"], true],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 9, 7],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": caveColor,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.2],
        "circle-stroke-opacity": 0.75,
      },
    });
    map.addLayer({
      id: "caves-core",
      type: "circle",
      source: "caves",
      filter: ["==", ["get", "generalized"], false],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3.5, 9, 7],
        "circle-color": caveColor,
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ffffff", dark ? "#020617" : "#ffffff"],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1],
      },
    });
    map.addLayer({
      id: "caves-label",
      type: "symbol",
      source: "caves",
      minzoom: 5.5,
      filter: ["==", ["get", "tour"], true],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"],
        "text-size": 11,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-max-width": 10,
      },
      paint: { "text-color": "#cffafe", "text-halo-color": "#020617", "text-halo-width": 1.4 },
    });
    return ["osm-caves-dot", "osm-caves-label", "caves-halo", "caves-ring", "caves-core", "caves-label"];
  },
  hoverLabel: (f) => {
    if (f.source === "osm-caves") return `${f.properties?.name ?? "Cave entrance"} · OpenStreetMap`;
    const p = f.properties as { name: string; generalized: boolean; state: string | null };
    return `${p.name}${p.state ? ` · ${p.state}` : ""}${p.generalized ? " · location generalized" : ""}`;
  },
  animate(map: MlMap, now: number) {
    if (now - lastPulse < 50 || !map.getLayer("caves-halo")) return;
    lastPulse = now;
    map.setPaintProperty("caves-halo", "circle-opacity", 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(now / 520)));
  },
};

/* ── karst aquifers ──────────────────────────────────────────────── */

export const AQUIFER_COLORS = { carbonate: "#38bdf8", mixed: "#2dd4bf" } as const;

export const aquifersLayer: AtlasLayer = {
  id: "aquifers",
  label: "Karst aquifers",
  group: "Underground",
  description: "USGS principal aquifers in carbonate rock — groundwater moving through dissolved cracks and conduits. Shown where each is the uppermost principal aquifer; includes Puerto Rico's North Coast Limestone and the Virgin Islands' Kingshill aquifer.",
  legend: [
    { color: AQUIFER_COLORS.carbonate, label: "Carbonate-rock aquifer", shape: "line" },
    { color: AQUIFER_COLORS.mixed, label: "Sandstone & carbonate aquifer", shape: "line" },
  ],
  citation: { label: "USGS Principal Aquifers of the United States (Esri Living Atlas)", href: "https://www.usgs.gov/mission-areas/water-resources/science/principal-aquifers-united-states", license: "public domain" },
  clickable: ["aquifers-fill"],
  install(map, { labelLayerId }) {
    map.addSource("aquifers", { type: "geojson", data: "/atlas/aquifers.json" });
    const color = ["match", ["get", "rock"], "carbonate", AQUIFER_COLORS.carbonate, AQUIFER_COLORS.mixed] as unknown as ExpressionSpecification;
    map.addLayer({ id: "aquifers-fill", type: "fill", source: "aquifers", paint: { "fill-color": color, "fill-opacity": 0.1 } }, labelLayerId);
    map.addLayer(
      { id: "aquifers-line", type: "line", source: "aquifers", paint: { "line-color": color, "line-width": 1.4, "line-dasharray": [2, 2], "line-opacity": 0.85 } },
      labelLayerId
    );
    return ["aquifers-fill", "aquifers-line"];
  },
  hoverLabel: (f) => `${(f.properties as { name: string }).name} · aquifer`,
};

/* ── sinkholes: Florida reports + Kentucky mapped sinkholes ──────── */

export const SINK_COLORS = { Y: "#f43f5e", U: "#fbbf24", N: "#64748b", ky: "#f472b6" } as const;

export const sinkholesLayer: AtlasLayer = {
  id: "sinkholes",
  label: "Sinkholes",
  group: "Ground",
  badge: "FL · KY",
  description: "Florida Geological Survey subsidence reports (most were never confirmed as sinkholes by a geologist) and, from zoom 12, Kentucky's mapped sinkhole outlines.",
  legend: [
    { color: SINK_COLORS.Y, label: "FL · confirmed sinkhole" },
    { color: SINK_COLORS.U, label: "FL · unverified report" },
    { color: SINK_COLORS.N, label: "FL · not a sinkhole" },
    { color: SINK_COLORS.ky, label: "KY · mapped sinkhole", shape: "line" },
  ],
  citation: { label: "FDEP Florida Geological Survey · Kentucky Geological Survey (via KY DGI)", href: "https://floridadep.gov/fgs/sinkholes", license: "state open data" },
  selectSource: "sinks-fl",
  clickable: ["sinks-fl-dot", "sinks-ky-fill"],
  install(map) {
    map.addSource("sinks-fl", { type: "geojson", data: EMPTY, promoteId: "id" });
    map.addSource("sinks-ky", { type: "geojson", data: EMPTY });
    map.addLayer({ id: "sinks-ky-fill", type: "fill", source: "sinks-ky", minzoom: 11.5, paint: { "fill-color": SINK_COLORS.ky, "fill-opacity": 0.18 } });
    map.addLayer({ id: "sinks-ky-line", type: "line", source: "sinks-ky", minzoom: 11.5, paint: { "line-color": SINK_COLORS.ky, "line-width": 1.2, "line-opacity": 0.9 } });
    map.addLayer({
      id: "sinks-fl-dot",
      type: "circle",
      source: "sinks-fl",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "verified"], "Y", 3, 1.6], 12, ["match", ["get", "verified"], "Y", 8, 5]],
        "circle-color": ["match", ["get", "verified"], "Y", SINK_COLORS.Y, "N", SINK_COLORS.N, SINK_COLORS.U],
        "circle-opacity": ["match", ["get", "verified"], "N", 0.5, 0.85],
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ffffff", "rgba(2,6,23,0.8)"],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 0.5],
      },
    });
    return ["sinks-ky-fill", "sinks-ky-line", "sinks-fl-dot"];
  },
  hoverLabel: (f) => {
    if (f.layer.id === "sinks-ky-fill") return "Mapped sinkhole · Kentucky";
    const p = f.properties as { verified: string; county: string | null };
    const v = p.verified === "Y" ? "confirmed sinkhole" : p.verified === "N" ? "not a sinkhole" : "unverified report";
    return `${v}${p.county ? ` · ${p.county.toLowerCase()} county` : ""}`;
  },
};

export const UNDERGROUND_LAYERS: AtlasLayer[] = [xrayLayer, reliefLayer, aquifersLayer, karstLayer, sinkholesLayer, cavesLayer];
