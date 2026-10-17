/* ------------------------------------------------------------------ */
/*  Earth Alive's map layers, declared for <AtlasMap>.                 */
/*  Draw order = array order: plates → faults → volcanoes → quakes.    */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { arcgisExportTiles, arcgisIdentify } from "@/utils/geo/arcgis";
import { FAULT_AGES, QFAULTS_LAYER, QFAULTS_SERVICE, faultFromIdentify } from "@/utils/geo/faults";
import { BOUNDARY_CLASS_LABEL, BOUNDARY_KINDS, PLATES_URL, plateName, type BoundaryClass } from "@/utils/geo/plates";
import { DEPTH_STOPS } from "@/utils/geo/quakes";
import { CODE_STYLE } from "@/utils/geo/volcanoes";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/* ── Earthquakes ─────────────────────────────────────────────────── */

/** Radius grows roughly with energy, and a little with zoom. */
const quakeRadius = (scale = 1): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  1,
  ["*", scale, ["interpolate", ["exponential", 1.6], ["get", "mag"], 0, 1.5, 3, 3, 5, 7, 7, 16, 9, 30]],
  8,
  ["*", scale, ["interpolate", ["exponential", 1.6], ["get", "mag"], 0, 3, 3, 6, 5, 13, 7, 28, 9, 50]],
];

const depthColor: ExpressionSpecification = [
  "step",
  ["get", "depth"],
  DEPTH_STOPS[0].color,
  ...DEPTH_STOPS.slice(1).flatMap((s) => [s.km, s.color]),
] as unknown as ExpressionSpecification;

let lastPulse = 0;

export const quakesLayer: AtlasLayer = {
  id: "quakes",
  label: "Earthquakes",
  group: "Live",
  defaultOn: true,
  description: "Sized by magnitude, coloured by depth. Rings pulse on quakes from the last hour.",
  legend: DEPTH_STOPS.map((s) => ({ color: s.color, label: s.label })),
  citation: { label: "USGS Earthquake Hazards Program", href: "https://earthquake.usgs.gov/earthquakes/feed/", license: "public domain" },
  selectSource: "quakes",
  clickable: ["quakes-circle"],
  install(map, { dark }) {
    map.addSource("quakes", { type: "geojson", data: EMPTY, promoteId: "id" });
    map.addLayer({
      id: "quakes-pulse",
      type: "circle",
      source: "quakes",
      filter: ["==", ["get", "recent"], 1],
      paint: {
        "circle-radius": quakeRadius(1),
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": depthColor,
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.8,
        "circle-pitch-alignment": "map",
      },
    });
    map.addLayer({
      id: "quakes-circle",
      type: "circle",
      source: "quakes",
      paint: {
        "circle-radius": quakeRadius(1),
        "circle-color": depthColor,
        "circle-opacity": 0.82,
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#6366f1", dark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)"],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3.5, 0.8],
        "circle-pitch-alignment": "map",
      },
    });
    return ["quakes-pulse", "quakes-circle"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { mag: number; place: string; depth: number };
    return `M${Number(p.mag).toFixed(1)} · ${p.place} · ${p.depth} km deep`;
  },
  animate(map: MlMap, now: number) {
    if (now - lastPulse < 33 || !map.getLayer("quakes-pulse")) return; // ~30 fps is plenty
    lastPulse = now;
    const t = (now % 1800) / 1800;
    map.setPaintProperty("quakes-pulse", "circle-radius", quakeRadius(1 + t * 2.2));
    map.setPaintProperty("quakes-pulse", "circle-stroke-opacity", 0.85 * (1 - t));
  },
  applyTime(map, time) {
    if (!map.getLayer("quakes-circle")) return;
    if (!time) {
      map.setFilter("quakes-circle", null);
      map.setFilter("quakes-pulse", ["==", ["get", "recent"], 1]);
      map.setPaintProperty("quakes-circle", "circle-opacity", 0.82);
      return;
    }
    const { cursor, trail, flash } = time;
    // nothing from the future; fresh quakes bright, older ones settle to a faint record
    map.setFilter("quakes-circle", ["<=", ["get", "time"], cursor]);
    map.setFilter("quakes-pulse", ["all", ["<=", ["get", "time"], cursor], [">", ["get", "time"], cursor - flash]]);
    map.setPaintProperty("quakes-circle", "circle-opacity", [
      "interpolate",
      ["linear"],
      ["-", cursor, ["get", "time"]],
      0, 0.95,
      trail, 0.32,
    ]);
  },
};

/* ── Plate boundaries ────────────────────────────────────────────── */

const boundaryColor: ExpressionSpecification = [
  "match",
  ["get", "cls"],
  ...BOUNDARY_KINDS.flatMap((k) => [[...k.classes], k.color]),
  "#64748b",
] as unknown as ExpressionSpecification;

export const platesLayer: AtlasLayer = {
  id: "plates",
  label: "Plate boundaries",
  group: "Tectonics",
  defaultOn: true,
  description: "Where Earth's plates meet — and how they move against each other.",
  legend: BOUNDARY_KINDS.map((k) => ({ color: k.color, label: k.label, shape: "line" as const })),
  citation: { label: "Bird (2003) PB2002 plate model", href: "https://github.com/fraxen/tectonicplates", license: "ODC-BY" },
  clickable: ["plates-hit"],
  install(map, { labelLayerId }) {
    map.addSource("plates", { type: "geojson", data: PLATES_URL });
    map.addLayer(
      {
        id: "plates-line",
        type: "line",
        source: "plates",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": boundaryColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.4, 6, 3.2],
          "line-opacity": 0.85,
        },
      },
      labelLayerId
    );
    // fat invisible twin so the thin line is easy to click
    map.addLayer({ id: "plates-hit", type: "line", source: "plates", paint: { "line-width": 12, "line-opacity": 0 } }, labelLayerId);
    return ["plates-line", "plates-hit"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { a: string; b: string; cls: BoundaryClass };
    return `${plateName(p.a)} ↔ ${plateName(p.b)} · ${BOUNDARY_CLASS_LABEL[p.cls] ?? p.cls}`;
  },
};

/* ── Active faults: GEM worldwide + USGS Quaternary faults (U.S.) ── */

const FAULTS_MIN_ZOOM = 3.5;
/** GEM fault kinds (see scripts/atlas/build-gem-faults.mjs). */
export const WORLD_FAULT_KINDS = [
  { key: "reverse", label: "Thrust / reverse", color: "#f43f5e" },
  { key: "normal", label: "Normal", color: "#38bdf8" },
  { key: "strike-slip", label: "Strike-slip", color: "#fbbf24" },
  { key: "unknown", label: "Not specified", color: "#cbd5e1" },
];

export const faultsLayer: AtlasLayer = {
  id: "faults",
  label: "Active faults",
  group: "Tectonics",
  badge: "Worldwide",
  description: "Active faults worldwide from the GEM Global Active Faults Database, coloured by how they move. Inside the U.S., USGS's more detailed Quaternary faults take over as you zoom in, coloured by when they last moved; click one for its report.",
  legend: [
    ...WORLD_FAULT_KINDS.slice(0, 3).map((k) => ({ color: k.color, label: k.label, shape: "line" as const })),
    ...FAULT_AGES.map((a) => ({ color: a.color, label: `U.S.: ${a.label}`, shape: "line" as const })),
  ],
  citation: { label: "GEM Global Active Faults (Styron & Pagani 2020) · USGS Quaternary Fault and Fold Database", href: "https://github.com/GEMScienceTools/gem-global-active-faults", license: "CC BY-SA 4.0 · public domain" },
  clickable: ["faults-world-line"],
  install(map, { labelLayerId }) {
    map.addSource("faults-world", { type: "geojson", data: "/atlas/faults-world.json", attribution: "Faults: GEM (CC BY-SA 4.0), USGS" });
    map.addLayer(
      {
        id: "faults-world-line",
        type: "line",
        source: "faults-world",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "kind"], ...WORLD_FAULT_KINDS.flatMap((k) => [k.key, k.color]), "#cbd5e1"] as unknown as ExpressionSpecification,
          // faster-slipping faults draw a little heavier
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, ["case", [">=", ["coalesce", ["get", "rate"], 0], 5], 1.3, 0.7], 8, ["case", [">=", ["coalesce", ["get", "rate"], 0], 5], 3, 1.8]],
          "line-opacity": 0.8,
        },
      },
      labelLayerId
    );
    map.addSource("faults", {
      type: "raster",
      tiles: [arcgisExportTiles(QFAULTS_SERVICE, [QFAULTS_LAYER])],
      tileSize: 256,
      minzoom: 3,
      attribution: "Faults: USGS",
    });
    map.addLayer({ id: "faults-raster", type: "raster", source: "faults", minzoom: FAULTS_MIN_ZOOM, paint: { "raster-opacity": 0.9 } }, labelLayerId);
    return ["faults-world-line", "faults-raster"];
  },
  hoverLabel: (f) => (f.source === "faults-world" ? `${f.properties?.name ?? "Active fault"} · ${WORLD_FAULT_KINDS.find((k) => k.key === f.properties?.kind)?.label ?? ""}` : null),
  async identify(map, [lng, lat], signal) {
    if (map.getZoom() < FAULTS_MIN_ZOOM) return null;
    const b = map.getBounds();
    const c = map.getCanvas();
    const results = await arcgisIdentify(
      QFAULTS_SERVICE,
      [QFAULTS_LAYER],
      { lng, lat },
      { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), width: c.clientWidth, height: c.clientHeight },
      6,
      signal
    );
    if (!results.length) return null;
    const info = faultFromIdentify(results[0]);
    return { layer: "faults", props: info as unknown as Record<string, unknown>, lngLat: [lng, lat] };
  },
};

/* ── Volcanoes ───────────────────────────────────────────────────── */

/** SDF triangle so the icon colour can follow the data. */
function addTriangle(map: MlMap) {
  if (map.hasImage("atlas-triangle")) return;
  const s = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(s / 2, 3);
  ctx.lineTo(s - 3, s - 4);
  ctx.lineTo(3, s - 4);
  ctx.closePath();
  ctx.fill();
  map.addImage("atlas-triangle", ctx.getImageData(0, 0, s, s), { sdf: true });
}

const ERUPTING = "#ff3d1f";
let lastGlow = 0;

export const volcanoesLayer: AtlasLayer = {
  id: "volcanoes",
  label: "Volcanoes",
  group: "Volcanoes",
  defaultOn: true,
  description: "Glowing = erupting right now. U.S. volcanoes carry the live USGS aviation colour code.",
  legend: [
    { color: ERUPTING, label: "Erupting now" },
    ...(["GREEN", "YELLOW", "ORANGE", "RED"] as const).map((c) => ({ color: CODE_STYLE[c].dot, label: `USGS ${c.toLowerCase()}` })),
    { color: "#b45309", label: "Other" },
  ],
  citation: { label: "Smithsonian Global Volcanism Program", href: "https://volcano.si.edu/", license: "cite GVP" },
  selectSource: "volcanoes",
  clickable: ["volcanoes-icon"],
  install(map, { dark }) {
    addTriangle(map);
    map.addSource("volcanoes", { type: "geojson", data: EMPTY, promoteId: "vnum" });
    // heat haze under erupting volcanoes (breathes in `animate`)
    map.addLayer({
      id: "volcanoes-glow",
      type: "circle",
      source: "volcanoes",
      filter: ["==", ["get", "erupting"], true],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 9, 7, 26],
        "circle-color": ERUPTING,
        "circle-blur": 1,
        "circle-opacity": 0.55,
        "circle-pitch-alignment": "map",
      },
    });
    map.addLayer({
      id: "volcanoes-icon",
      type: "symbol",
      source: "volcanoes",
      layout: {
        "icon-image": "atlas-triangle",
        "icon-size": [
          "interpolate", ["linear"], ["zoom"],
          1, ["case", ["any", ["get", "erupting"], [">=", ["get", "rank"], 2]], 0.55, 0.32],
          7, ["case", ["any", ["get", "erupting"], [">=", ["get", "rank"], 2]], 0.95, 0.6],
        ],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "symbol-sort-key": ["+", ["get", "rank"], ["case", ["get", "erupting"], 10, 0]],
      },
      paint: {
        "icon-color": [
          "case",
          ["all", ["get", "erupting"], ["<", ["get", "rank"], 3]],
          ERUPTING,
          ["match", ["get", "rank"], 1, CODE_STYLE.GREEN.dot, 2, CODE_STYLE.YELLOW.dot, 3, CODE_STYLE.ORANGE.dot, 4, CODE_STYLE.RED.dot, dark ? "#d97706" : "#b45309"],
        ],
        "icon-halo-color": ["case", ["boolean", ["feature-state", "selected"], false], "#22d3ee", dark ? "#020617" : "#ffffff"],
        "icon-halo-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.2],
      },
    });
    return ["volcanoes-glow", "volcanoes-icon"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; code: string | null; level: string | null; erupting: boolean };
    const status = p.erupting ? " · erupting now" : "";
    return p.code ? `${p.name}${status} · USGS ${p.code.toLowerCase()}` : `${p.name}${status}`;
  },
  animate(map: MlMap, now: number) {
    if (now - lastGlow < 50 || !map.getLayer("volcanoes-glow")) return;
    lastGlow = now;
    map.setPaintProperty("volcanoes-glow", "circle-opacity", 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(now / 420)));
  },
};

export const EARTH_ALIVE_LAYERS: AtlasLayer[] = [platesLayer, faultsLayer, volcanoesLayer, quakesLayer];
