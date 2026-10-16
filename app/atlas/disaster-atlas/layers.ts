/* ------------------------------------------------------------------ */
/*  Disaster Atlas map layers (live). Draw order = array order:        */
/*  county risk → warnings → fire perimeters → hotspots → storms →     */
/*  storm reports → rivers. A clear-sky "place" layer answers clicks   */
/*  that hit nothing with "what's at risk here".                       */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { ALERT_GROUPS, FLOOD_LEVELS, REPORT_KINDS, RISK_RATINGS } from "@/utils/geo/hazards";

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
  description: "Hot pixels seen by the VIIRS sensor on NOAA-20 in the last 24 hours (~375 m each). Usually fire — but a gas flare or a hot factory roof can trigger one too. Size = fire radiative power.",
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

export const DISASTER_LAYERS: AtlasLayer[] = [riskLayer, alertsLayer, firesLayer, hotspotsLayer, stormsLayer, reportsLayer, gaugesLayer, placeLayer];
