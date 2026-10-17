/* ------------------------------------------------------------------ */
/*  Disaster Atlas map layers (live). Draw order = array order:        */
/*  county risk → warnings → fire perimeters → hotspots → storms →     */
/*  storm reports → rivers. A clear-sky "place" layer answers clicks   */
/*  that hit nothing with "what's at risk here".                       */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { ALERT_GROUPS, FLOOD_LEVELS, REPORT_KINDS, RISK_RATINGS, WORLD_ALERT_LEVELS, WORLD_EVENT_TYPES } from "@/utils/geo/hazards";
import { CAT_COLORS, EF_COLORS } from "./history";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];
const groupColor = ["match", ["get", "group"], ...ALERT_GROUPS.flatMap((g) => [g.key, g.color]), "#a3a3a3"] as unknown as ExpressionSpecification;

/* ── who's at risk: FEMA NRI by county ───────────────────────────── */

export const riskLayer: AtlasLayer = {
  id: "risk",
  label: "People at risk",
  group: "People",
  badge: "U.S.",
  description: "FEMA's National Risk Index: each county's overall risk from natural hazards — what it stands to lose each year, how vulnerable its people are and how well it can bounce back. Click a county for the breakdown.",
  legend: RISK_RATINGS.map((r) => ({ color: r.color, label: r.key })),
  citation: { label: "FEMA National Risk Index", href: "https://hazards.fema.gov/nri/", license: "public domain" },
  selectSource: "risk",
  clickable: ["risk-fill"],
  install(map, { labelLayerId }) {
    map.addSource("risk", { type: "geojson", data: EMPTY, promoteId: "id", tolerance: 0.6 });
    const color = ["match", ["get", "risk"], ...RISK_RATINGS.flatMap((r) => [r.key, r.color]), "#1e293b"] as unknown as ExpressionSpecification;
    map.addLayer({ id: "risk-fill", type: "fill", source: "risk", paint: { "fill-color": color, "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.75, 0.42] } }, labelLayerId);
    map.addLayer({ id: "risk-line", type: "line", source: "risk", minzoom: 4.5, paint: { "line-color": "#020617", "line-width": 0.4, "line-opacity": 0.6 } }, labelLayerId);
    return ["risk-fill", "risk-line"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; state: string; risk: string | null };
    return `${p.name}, ${p.state} · ${p.risk ?? "no rating"} risk`;
  },
};

/* ── NWS watches & warnings ──────────────────────────────────────── */

export const alertsLayer: AtlasLayer = {
  id: "alerts",
  label: "Warnings & watches",
  group: "Weather",
  defaultOn: true,
  description: "Active National Weather Service warnings (solid) and watches (dashed) for tornadoes, severe storms, floods, hurricanes, fire weather, extreme heat, winter storms and high wind.",
  legend: ALERT_GROUPS.map((g) => ({ color: g.color, label: g.label })),
  citation: { label: "NOAA / National Weather Service", href: "https://www.weather.gov/", license: "public domain" },
  clickable: ["alerts-fill"],
  install(map, { labelLayerId }) {
    map.addSource("alerts", { type: "geojson", data: EMPTY });
    map.addLayer(
      {
        id: "alerts-fill",
        type: "fill",
        source: "alerts",
        paint: { "fill-color": groupColor, "fill-opacity": ["case", ["==", ["get", "watch"], true], 0.08, 0.28] },
      },
      labelLayerId
    );
    map.addLayer({ id: "alerts-line", type: "line", source: "alerts", filter: ["==", ["get", "watch"], false], paint: { "line-color": groupColor, "line-width": 1.6, "line-opacity": 0.95 } }, labelLayerId);
    map.addLayer({ id: "alerts-watch-line", type: "line", source: "alerts", filter: ["==", ["get", "watch"], true], paint: { "line-color": groupColor, "line-width": 1.1, "line-opacity": 0.7, "line-dasharray": [3, 2] } }, labelLayerId);
    return ["alerts-fill", "alerts-line", "alerts-watch-line"];
  },
  hoverLabel: (f) => String(f.properties?.product ?? ""),
};

/* ── wildfires ───────────────────────────────────────────────────── */

export const firesLayer: AtlasLayer = {
  id: "fires",
  label: "Wildfire perimeters",
  group: "Fire",
  defaultOn: true,
  description: "Mapped edges of active wildfires and prescribed burns (NIFC). Brighter = less contained.",
  legend: [
    { color: "#f97316", label: "Wildfire perimeter" },
    { color: "#a8a29e", label: "Fully contained" },
  ],
  citation: { label: "NIFC WFIGS interagency fire perimeters", href: "https://data-nifc.opendata.arcgis.com/", license: "public domain" },
  selectSource: "fires",
  clickable: ["fires-fill"],
  install(map, { labelLayerId }) {
    map.addSource("fires", { type: "geojson", data: EMPTY, promoteId: "id" });
    const color = ["case", [">=", ["coalesce", ["get", "contained"], 0], 100], "#a8a29e", "#f97316"] as unknown as ExpressionSpecification;
    map.addLayer({ id: "fires-fill", type: "fill", source: "fires", paint: { "fill-color": color, "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.6, 0.35] } }, labelLayerId);
    map.addLayer({ id: "fires-glow", type: "line", source: "fires", paint: { "line-color": color, "line-width": 5, "line-blur": 4, "line-opacity": 0.6 } }, labelLayerId);
    map.addLayer({ id: "fires-line", type: "line", source: "fires", paint: { "line-color": "#fed7aa", "line-width": 1 } }, labelLayerId);
    map.addLayer({
      id: "fires-label",
      type: "symbol",
      source: "fires",
      minzoom: 7,
      filter: [">", ["get", "acres"], 100],
      layout: { "text-field": ["concat", ["get", "name"], " Fire"], "text-font": FONT, "text-size": 11, "text-max-width": 8 },
      paint: { "text-color": "#fed7aa", "text-halo-color": "#020617", "text-halo-width": 1.4 },
    });
    return ["fires-fill", "fires-glow", "fires-line", "fires-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; acres: number; contained: number | null };
    return `${p.name} Fire · ${Number(p.acres).toLocaleString()} acres${p.contained != null ? ` · ${p.contained}% contained` : ""}`;
  },
};

export const hotspotsLayer: AtlasLayer = {
  id: "hotspots",
  label: "Satellite fire detections",
  group: "Fire",
  defaultOn: true,
  badge: "Worldwide",
  description: "Hot pixels seen anywhere on Earth by the VIIRS sensor on NOAA-20 in the last 24 hours (~375 m each; low-confidence pixels left out). Usually fire — but a gas flare or a hot factory roof can trigger one too. Size = fire radiative power.",
  legend: [{ color: "#fde047", label: "Hot pixel (last 24 h)" }],
  citation: { label: "NASA FIRMS (VIIRS NOAA-20)", href: "https://firms.modaps.eosdis.nasa.gov/", license: "public domain" },
  clickable: ["hotspots-dot"],
  install(map) {
    map.addSource("hotspots", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "hotspots-dot",
      type: "circle",
      source: "hotspots",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["interpolate", ["linear"], ["get", "frp"], 0, 1.4, 100, 4], 10, ["interpolate", ["linear"], ["get", "frp"], 0, 4, 100, 10]],
        "circle-color": ["interpolate", ["linear"], ["get", "frp"], 0, "#fde047", 20, "#fb923c", 100, "#ef4444"],
        "circle-blur": 0.4,
        "circle-opacity": 0.9,
      },
    });
    return ["hotspots-dot"];
  },
  hoverLabel: (f) => `Fire detection · ${f.properties?.frp ?? "?"} MW · ${String(f.properties?.when ?? "").replace("T", " ")}`,
};

/* ── tropical cyclones ───────────────────────────────────────────── */

let lastPulse = 0;

export const stormsLayer: AtlasLayer = {
  id: "storms",
  label: "Hurricanes & tropical storms",
  group: "Weather",
  defaultOn: true,
  description: "Active storms from the National Hurricane Center: the cone of uncertainty (where the centre will probably go — not how big the storm is), the forecast track and the path so far.",
  legend: [
    { color: "#ffffff", label: "Forecast cone" },
    { color: "#d946ef", label: "Forecast track", shape: "line" },
    { color: "#94a3b8", label: "Past track", shape: "line" },
  ],
  citation: { label: "NOAA National Hurricane Center", href: "https://www.nhc.noaa.gov/", license: "public domain" },
  clickable: ["storms-center", "storms-points"],
  install(map, { labelLayerId }) {
    for (const id of ["storm-cone", "storm-track", "storm-past", "storm-points", "storm-centers"]) map.addSource(id, { type: "geojson", data: EMPTY });
    map.addLayer({ id: "storms-cone-fill", type: "fill", source: "storm-cone", paint: { "fill-color": "#ffffff", "fill-opacity": 0.12 } }, labelLayerId);
    map.addLayer({ id: "storms-cone-line", type: "line", source: "storm-cone", paint: { "line-color": "#ffffff", "line-width": 1.2, "line-opacity": 0.7 } }, labelLayerId);
    map.addLayer({ id: "storms-past", type: "line", source: "storm-past", paint: { "line-color": "#94a3b8", "line-width": 2 } });
    map.addLayer({ id: "storms-track", type: "line", source: "storm-track", paint: { "line-color": "#d946ef", "line-width": 2, "line-dasharray": [2, 1.5] } });
    map.addLayer({
      id: "storms-points",
      type: "circle",
      source: "storm-points",
      paint: { "circle-radius": 5, "circle-color": "#020617", "circle-stroke-color": "#f0abfc", "circle-stroke-width": 1.6 },
    });
    map.addLayer({
      id: "storms-points-label",
      type: "symbol",
      source: "storm-points",
      minzoom: 4,
      layout: { "text-field": ["get", "label"], "text-font": FONT, "text-size": 9.5, "text-offset": [0.9, 0], "text-anchor": "left" },
      paint: { "text-color": "#f5d0fe", "text-halo-color": "#020617", "text-halo-width": 1.2 },
    });
    map.addLayer({ id: "storms-halo", type: "circle", source: "storm-centers", paint: { "circle-radius": 22, "circle-color": "#d946ef", "circle-blur": 1, "circle-opacity": 0.5 } });
    map.addLayer({
      id: "storms-center",
      type: "circle",
      source: "storm-centers",
      paint: { "circle-radius": 8, "circle-color": "#d946ef", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
    });
    map.addLayer({
      id: "storms-label",
      type: "symbol",
      source: "storm-centers",
      layout: { "text-field": ["get", "title"], "text-font": FONT, "text-size": 12, "text-offset": [0, 1.5], "text-anchor": "top", "text-letter-spacing": 0.06 },
      paint: { "text-color": "#fae8ff", "text-halo-color": "#020617", "text-halo-width": 1.6 },
    });
    return ["storms-cone-fill", "storms-cone-line", "storms-past", "storms-track", "storms-points", "storms-points-label", "storms-halo", "storms-center", "storms-label"];
  },
  hoverLabel: (f) => String(f.properties?.title ?? f.properties?.label ?? ""),
  animate(map: MlMap, now: number) {
    if (now - lastPulse < 50 || !map.getLayer("storms-halo")) return;
    lastPulse = now;
    const t = (now % 1800) / 1800;
    map.setPaintProperty("storms-halo", "circle-radius", 10 + 26 * t);
    map.setPaintProperty("storms-halo", "circle-opacity", 0.6 * (1 - t));
  },
};

/* ── storm reports ───────────────────────────────────────────────── */

export const reportsLayer: AtlasLayer = {
  id: "reports",
  label: "Storm reports",
  group: "Weather",
  defaultOn: true,
  description: "Tornado, damaging-wind and large-hail reports logged by NOAA's Storm Prediction Center today and yesterday (preliminary, not yet verified). Yesterday's are dimmer.",
  legend: REPORT_KINDS.map((k) => ({ color: k.color, label: k.label })),
  citation: { label: "NOAA Storm Prediction Center — storm reports", href: "https://www.spc.noaa.gov/climo/reports/", license: "public domain" },
  clickable: ["reports-dot"],
  install(map) {
    map.addSource("reports", { type: "geojson", data: EMPTY });
    const color = ["match", ["get", "kind"], ...REPORT_KINDS.flatMap((k) => [k.key, k.color]), "#ffffff"] as unknown as ExpressionSpecification;
    map.addLayer({
      id: "reports-dot",
      type: "circle",
      source: "reports",
      paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "tornado"], 6, 4],
        "circle-color": color,
        "circle-opacity": ["case", ["==", ["get", "day"], "today"], 0.95, 0.45],
        "circle-stroke-color": "#020617",
        "circle-stroke-width": 1,
      },
    });
    return ["reports-dot"];
  },
  hoverLabel: (f) => `${String(f.properties?.kind ?? "")} report · ${String(f.properties?.place ?? "")}`,
};

/* ── rivers in flood ─────────────────────────────────────────────── */

export const gaugesLayer: AtlasLayer = {
  id: "gauges",
  label: "Rivers in flood",
  group: "Water",
  defaultOn: true,
  description: "River gauges at or above action stage right now (NWS). Colour = how severe the flooding is.",
  legend: FLOOD_LEVELS.map((l) => ({ color: l.color, label: l.label })),
  citation: { label: "NOAA / NWS river observations", href: "https://water.noaa.gov/", license: "public domain" },
  clickable: ["gauges-dot"],
  install(map) {
    map.addSource("gauges", { type: "geojson", data: EMPTY });
    const color = ["match", ["get", "status"], ...FLOOD_LEVELS.flatMap((l) => [l.key, l.color]), "#94a3b8"] as unknown as ExpressionSpecification;
    map.addLayer({
      id: "gauges-dot",
      type: "circle",
      source: "gauges",
      paint: {
        "circle-radius": ["match", ["get", "status"], "major", 8, "moderate", 7, "minor", 6, 4.5],
        "circle-color": "#020617",
        "circle-stroke-color": color,
        "circle-stroke-width": 2.5,
      },
    });
    return ["gauges-dot"];
  },
  hoverLabel: (f) => `${String(f.properties?.river ?? "River")} at ${String(f.properties?.name ?? "")} · ${String(f.properties?.status ?? "")}`,
};

/* ── "what's at risk here?" for clicks on empty map ─────────────── */

export const placeLayer: AtlasLayer = {
  id: "place",
  label: "Place",
  group: "People",
  defaultOn: true,
  citation: { label: "", href: "" },
  install: () => [],
  async identify(_map, lngLat) {
    return { layer: "place", props: {}, lngLat };
  },
};

/* ── history ─────────────────────────────────────────────────────── */

const catColor = ["match", ["get", "cat"], ...CAT_COLORS.flatMap((c, i) => [i, c]), "#60a5fa"] as unknown as ExpressionSpecification;

export const histHurricanesLayer: AtlasLayer = {
  id: "hist-hurricanes",
  label: "Hurricane & typhoon tracks",
  group: "History",
  badge: "Worldwide",
  description: "Best tracks for every ocean, coloured by strength at each 6-hourly fix; dots mark landfalls. Atlantic (since 1851) and eastern Pacific (since 1949) from NOAA's HURDAT2; typhoons and the Indian Ocean and South Pacific from IBTrACS, using the Joint Typhoon Warning Center's 1-minute winds so categories compare — storms with no 1-minute wind on record (mostly before the 1950s) are left out.",
  legend: ["Tropical storm / depression", "Category 1", "Category 2", "Category 3", "Category 4", "Category 5"].map((label, i) => ({ color: CAT_COLORS[i], label, shape: "line" as const })),
  citation: { label: "NOAA NHC HURDAT2 · NOAA NCEI IBTrACS v04r01", href: "https://www.ncei.noaa.gov/products/international-best-track-archive", license: "public domain" },
  clickable: ["hist-hu-line", "hist-hu-label-dot"],
  install(map) {
    for (const id of ["hist-hu", "hist-hu-labels", "hist-hu-landfalls"]) map.addSource(id, { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "hist-hu-glow",
      type: "line",
      source: "hist-hu",
      filter: [">=", ["get", "cat"], 3],
      layout: { "line-cap": "round" },
      paint: { "line-color": catColor, "line-width": 8, "line-blur": 6, "line-opacity": 0.35 },
    });
    map.addLayer({
      id: "hist-hu-line",
      type: "line",
      source: "hist-hu",
      layout: { "line-cap": "round" },
      paint: {
        "line-color": catColor,
        "line-width": ["interpolate", ["linear"], ["get", "cat"], 0, 1.2, 5, 3.6],
        "line-opacity": ["case", ["boolean", ["feature-state", "dim"], false], 0.15, 0.9],
      },
    });
    map.addLayer({ id: "hist-hu-landfall", type: "circle", source: "hist-hu-landfalls", paint: { "circle-radius": 3.5, "circle-color": "#020617", "circle-stroke-color": catColor, "circle-stroke-width": 1.8 } });
    map.addLayer({ id: "hist-hu-label-dot", type: "circle", source: "hist-hu-labels", paint: { "circle-radius": 4, "circle-color": catColor, "circle-stroke-color": "#020617", "circle-stroke-width": 1 } });
    map.addLayer({
      id: "hist-hu-label",
      type: "symbol",
      source: "hist-hu-labels",
      minzoom: 3,
      layout: { "text-field": ["get", "title"], "text-font": FONT, "text-size": 10.5, "text-offset": [0, 1], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": "#f8fafc", "text-halo-color": "#020617", "text-halo-width": 1.4 },
    });
    return ["hist-hu-glow", "hist-hu-line", "hist-hu-landfall", "hist-hu-label-dot", "hist-hu-label"];
  },
  hoverLabel: (f) => (f.properties?.title ? String(f.properties.title) : f.properties?.kt != null ? `${Math.round(Number(f.properties.kt) * 1.15078)} mph` : null),
};

const efColor = ["match", ["get", "mag"], ...EF_COLORS.flatMap((c, i) => [i, c]), "#94a3b8"] as unknown as ExpressionSpecification;

export const histTornadoesLayer: AtlasLayer = {
  id: "hist-tornadoes",
  label: "Tornado paths",
  group: "History",
  description: "Every U.S. tornado since 1950 from NOAA's Storm Prediction Center, drawn from where it touched down to where it lifted. Colour = (E)F rating. Tornadoes rated before 2007 use the original Fujita scale.",
  legend: ["(E)F0", "(E)F1", "(E)F2", "(E)F3", "(E)F4", "(E)F5"].map((label, i) => ({ color: EF_COLORS[i], label, shape: "line" as const })),
  citation: { label: "NOAA SPC Severe Weather Database", href: "https://www.spc.noaa.gov/wcm/", license: "public domain" },
  selectSource: "hist-tor",
  clickable: ["hist-tor-line", "hist-tor-dot"],
  install(map) {
    map.addSource("hist-tor", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "hist-tor-glow",
      type: "line",
      source: "hist-tor",
      filter: ["all", ["==", ["geometry-type"], "LineString"], [">=", ["get", "mag"], 4]],
      layout: { "line-cap": "round" },
      paint: { "line-color": efColor, "line-width": 9, "line-blur": 6, "line-opacity": 0.4 },
    });
    map.addLayer({
      id: "hist-tor-line",
      type: "line",
      source: "hist-tor",
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round" },
      paint: {
        "line-color": efColor,
        // zoom must be outermost; selection + rating go inside each stop
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          ["case", ["boolean", ["feature-state", "selected"], false], 4, ["interpolate", ["linear"], ["get", "mag"], 0, 0.8, 5, 2.6]],
          9,
          ["case", ["boolean", ["feature-state", "selected"], false], 9, ["interpolate", ["linear"], ["get", "mag"], 0, 2, 5, 7]],
        ],
        "line-opacity": 0.9,
      },
    });
    map.addLayer({
      id: "hist-tor-dot",
      type: "circle",
      source: "hist-tor",
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.6, 9, 4], "circle-color": efColor, "circle-opacity": 0.85 },
    });
    return ["hist-tor-glow", "hist-tor-line", "hist-tor-dot"];
  },
};

export const histFiresLayer: AtlasLayer = {
  id: "hist-fires",
  label: "Past fire perimeters",
  group: "History",
  description: "Final mapped perimeters of past wildfires and prescribed burns from the interagency fire-perimeter history (NIFC), for the year chosen.",
  legend: [{ color: "#f97316", label: "Burned area" }],
  citation: { label: "NIFC Interagency Fire Perimeter History", href: "https://data-nifc.opendata.arcgis.com/", license: "public domain" },
  selectSource: "hist-fires",
  clickable: ["hist-fires-fill"],
  install(map, { labelLayerId }) {
    map.addSource("hist-fires", { type: "geojson", data: EMPTY, promoteId: "id" });
    map.addLayer({ id: "hist-fires-fill", type: "fill", source: "hist-fires", paint: { "fill-color": "#ea580c", "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.7, 0.45] } }, labelLayerId);
    map.addLayer({ id: "hist-fires-line", type: "line", source: "hist-fires", paint: { "line-color": "#fdba74", "line-width": 0.8 } }, labelLayerId);
    map.addLayer({
      id: "hist-fires-label",
      type: "symbol",
      source: "hist-fires",
      minzoom: 6,
      filter: [">", ["get", "acres"], 20000],
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 11 },
      paint: { "text-color": "#fed7aa", "text-halo-color": "#020617", "text-halo-width": 1.4 },
    });
    return ["hist-fires-fill", "hist-fires-line", "hist-fires-label"];
  },
  hoverLabel: (f) => `${f.properties?.name} · ${Number(f.properties?.acres).toLocaleString()} acres`,
};

export const DECL_STOPS: [number, string][] = [
  [0, "#0f172a"],
  [5, "#1e3a8a"],
  [10, "#0e7490"],
  [20, "#ca8a04"],
  [30, "#ea580c"],
  [45, "#dc2626"],
];

export const declarationsLayer: AtlasLayer = {
  id: "declarations",
  label: "FEMA disaster declarations",
  group: "History",
  description: "How many federal disaster and emergency declarations have included each county since 1953 (OpenFEMA). Filter by type of incident.",
  legend: DECL_STOPS.slice(1).map(([n, c]) => ({ color: c, label: `${n}+` })),
  citation: { label: "OpenFEMA Disaster Declarations Summaries", href: "https://www.fema.gov/openfema-data-page/disaster-declarations-summaries-v2", license: "public domain" },
  selectSource: "declarations",
  clickable: ["decl-fill"],
  install(map, { labelLayerId }) {
    map.addSource("declarations", { type: "geojson", data: EMPTY, promoteId: "id", tolerance: 0.6 });
    map.addLayer(
      {
        id: "decl-fill",
        type: "fill",
        source: "declarations",
        paint: {
          // no county-level record (Connecticut's new planning regions) → neutral grey
          "fill-color": ["case", ["==", ["get", "n"], null], "#475569", ["interpolate", ["linear"], ["get", "n"], ...DECL_STOPS.flat()]] as unknown as ExpressionSpecification,
          "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.9, 0.65],
        },
      },
      labelLayerId
    );
    map.addLayer({ id: "decl-line", type: "line", source: "declarations", minzoom: 4.5, paint: { "line-color": "#020617", "line-width": 0.4, "line-opacity": 0.6 } }, labelLayerId);
    return ["decl-fill", "decl-line"];
  },
  hoverLabel: (f) => `${f.properties?.name}, ${f.properties?.state} · ${f.properties?.n == null ? "no county-level records" : `${f.properties.n} declarations`}`,
};

/** Live layers, then history layers — the page shows one set at a time. */
export const LIVE_LAYER_IDS = ["risk", "alerts", "fires", "hotspots", "storms", "reports", "gauges", "world", "place"];
export const HISTORY_LAYER_IDS = ["hist-hurricanes", "hist-tornadoes", "hist-fires", "declarations"];

/* ── disasters worldwide (GDACS) ─────────────────────────────────── */

const worldTypeColor = ["match", ["get", "type"], ...WORLD_EVENT_TYPES.flatMap((t) => [t.key, t.color]), "#94a3b8"] as unknown as ExpressionSpecification;
const worldLevelColor = ["match", ["get", "level"], ...WORLD_ALERT_LEVELS.flatMap((l) => [l.key, l.color]), "#4ade80"] as unknown as ExpressionSpecification;
const worldLevelRank = ["match", ["get", "level"], "Red", 3, "Orange", 2, 1] as unknown as ExpressionSpecification;

export const worldLayer: AtlasLayer = {
  id: "world",
  label: "Disasters worldwide",
  group: "World",
  defaultOn: true,
  badge: "Worldwide",
  description: "Earthquakes, tropical cyclones, floods, volcanoes, droughts and wildfires happening now anywhere on Earth, from GDACS (UN + European Commission). The ring shows GDACS's alert — how much harm to people it expects, not just how big the event is. In the U.S. the detailed NWS, NHC and wildfire layers take over.",
  legend: [...WORLD_EVENT_TYPES.map((t) => ({ color: t.color, label: t.label })), ...WORLD_ALERT_LEVELS.map((l) => ({ color: l.color, label: `Ring: ${l.label}`, shape: "ring" as const }))],
  citation: { label: "GDACS — Global Disaster Alert and Coordination System", href: "https://www.gdacs.org/", license: "free to reuse with attribution" },
  clickable: ["world-dot"],
  install(map, { dark }) {
    map.addSource("world", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "world-halo",
      type: "circle",
      source: "world",
      filter: ["!=", ["get", "level"], "Green"],
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["*", 7, worldLevelRank], 6, ["*", 12, worldLevelRank]], "circle-color": worldLevelColor, "circle-blur": 1, "circle-opacity": 0.45 },
    });
    map.addLayer({
      id: "world-dot",
      type: "circle",
      source: "world",
      layout: { "circle-sort-key": worldLevelRank },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["+", 3, worldLevelRank], 6, ["+", 5, ["*", 2, worldLevelRank]]],
        "circle-color": worldTypeColor,
        "circle-stroke-color": worldLevelColor,
        "circle-stroke-width": ["case", ["==", ["get", "level"], "Green"], 1.2, 2.6],
      },
    });
    map.addLayer({
      id: "world-label",
      type: "symbol",
      source: "world",
      filter: ["any", ["!=", ["get", "level"], "Green"], ["==", ["get", "type"], "TC"]],
      layout: { "text-field": ["coalesce", ["get", "short"], ["get", "name"]], "text-font": ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"], "text-size": 10.5, "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": dark ? "#f1f5f9" : "#0f172a", "text-halo-color": dark ? "#020617" : "#ffffff", "text-halo-width": 1.4 },
    });
    return ["world-halo", "world-dot", "world-label"];
  },
  hoverLabel: (f) => `${String(f.properties?.name ?? "")}${f.properties?.country ? ` · ${f.properties.country}` : ""} · ${String(f.properties?.level ?? "")} alert`,
};

export const DISASTER_LAYERS: AtlasLayer[] = [
  riskLayer,
  declarationsLayer,
  alertsLayer,
  firesLayer,
  histFiresLayer,
  hotspotsLayer,
  stormsLayer,
  histHurricanesLayer,
  histTornadoesLayer,
  reportsLayer,
  gaugesLayer,
  worldLayer,
  placeLayer,
];
