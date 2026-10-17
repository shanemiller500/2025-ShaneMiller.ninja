/* ------------------------------------------------------------------ */
/*  Shipwrecks map layers. Draw order: ocean floor → sanctuaries →     */
/*  NOAA charted wrecks → named wrecks → featured wrecks.              */
/* ------------------------------------------------------------------ */
import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { WRECK_CATS } from "@/utils/geo/wrecks";
import { FEATURED_WRECKS } from "./featured";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];

/* ── the ocean floor ─────────────────────────────────────────────── */

export const seafloorLayer: AtlasLayer = {
  id: "seafloor",
  label: "Ocean floor",
  group: "Sea",
  defaultOn: true,
  description: "Shaded seafloor from GEBCO, NOAA and partners (Esri World Ocean Base), dimmed so the wrecks stand out.",
  citation: { label: "Esri World Ocean Base (GEBCO, NOAA, and others)", href: "https://www.arcgis.com/home/item.html?id=1e126e7520f9466c9ca28b8f28b5e500" },
  install(map, { dark, labelLayerId }) {
    map.addSource("seafloor", {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 13,
      attribution: "Seafloor: Esri, GEBCO, NOAA, Garmin, HERE, and others",
    });
    map.addLayer(
      {
        id: "seafloor-raster",
        type: "raster",
        source: "seafloor",
        paint: {
          "raster-brightness-max": dark ? 0.5 : 0.9,
          "raster-brightness-min": dark ? 0.02 : 0.15,
          "raster-saturation": -0.15,
          "raster-contrast": dark ? 0.15 : -0.1,
          "raster-opacity": dark ? 0.95 : 0.35,
        },
      },
      labelLayerId
    );
    return ["seafloor-raster"];
  },
};

/* ── National Marine Sanctuaries ─────────────────────────────────── */

export const sanctuariesLayer: AtlasLayer = {
  id: "sanctuaries",
  label: "National Marine Sanctuaries",
  group: "Sea",
  defaultOn: true,
  description: "The 18 sanctuaries NOAA manages, several of them created to protect shipwrecks.",
  legend: [{ color: "#2dd4bf", label: "Sanctuary boundary" }],
  citation: { label: "NOAA Office of National Marine Sanctuaries", href: "https://sanctuaries.noaa.gov/", license: "public domain" },
  clickable: ["sanctuaries-fill"],
  install(map, { dark, labelLayerId }) {
    map.addSource("sanctuaries", { type: "geojson", data: "/atlas/sanctuaries.json" });
    map.addLayer({ id: "sanctuaries-fill", type: "fill", source: "sanctuaries", paint: { "fill-color": "#2dd4bf", "fill-opacity": 0.08 } }, labelLayerId);
    map.addLayer({ id: "sanctuaries-line", type: "line", source: "sanctuaries", paint: { "line-color": "#2dd4bf", "line-width": 1.3, "line-opacity": 0.75, "line-dasharray": [3, 2] } }, labelLayerId);
    map.addLayer({
      id: "sanctuaries-label",
      type: "symbol",
      source: "sanctuaries",
      minzoom: 5,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 10.5, "text-max-width": 9, "text-letter-spacing": 0.04 },
      paint: { "text-color": dark ? "#99f6e4" : "#065f46", "text-halo-color": dark ? "#020617" : "#ffffff", "text-halo-width": dark ? 1.4 : 1.8 },
    });
    return ["sanctuaries-fill", "sanctuaries-line", "sanctuaries-label"];
  },
  hoverLabel: (f) => String(f.properties?.name ?? ""),
};

/* ── NOAA charted wrecks ─────────────────────────────────────────── */

const catColor = ["match", ["coalesce", ["get", "cat"], "none"], ...WRECK_CATS.flatMap((c) => [c.key, c.color]), "#94a3b8"] as unknown as ExpressionSpecification;

export const noaaWrecksLayer: AtlasLayer = {
  id: "noaa",
  label: "Charted wrecks (NOAA)",
  group: "Wrecks",
  defaultOn: true,
  badge: "U.S. waters",
  description: "Every wreck on NOAA's nautical charts — over 12,000, from rotting barges to sunken warships. Most are unnamed: charts record hazards, not history. Zoom in for the depth over each wreck.",
  legend: WRECK_CATS.map((c) => ({ color: c.color, label: c.label })),
  citation: { label: "NOAA Office of Coast Survey — Electronic Navigational Charts", href: "https://nauticalcharts.noaa.gov/", license: "public domain" },
  clickable: ["noaa-dot"],
  install(map, { dark }) {
    map.addSource("noaa", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "noaa-glow",
      type: "circle",
      source: "noaa",
      maxzoom: 7,
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 7, 6], "circle-color": catColor, "circle-blur": 1, "circle-opacity": 0.35 },
    });
    map.addLayer({
      id: "noaa-dot",
      type: "circle",
      source: "noaa",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.3, 9, 3.5, 14, 6],
        "circle-color": catColor,
        "circle-stroke-color": "#020617",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 10, 1],
      },
    });
    map.addLayer({
      id: "noaa-depth",
      type: "symbol",
      source: "noaa",
      minzoom: 11.5,
      filter: ["!=", ["get", "depth"], null],
      layout: { "text-field": ["concat", ["to-string", ["get", "depth"]], " m"], "text-font": FONT, "text-size": 9.5, "text-offset": [0, 1], "text-anchor": "top" },
      paint: { "text-color": dark ? "#bae6fd" : "#0c4a6e", "text-halo-color": dark ? "#020617" : "#ffffff", "text-halo-width": dark ? 1.2 : 1.6 },
    });
    return ["noaa-glow", "noaa-dot", "noaa-depth"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name?: string; cat?: string; depth?: number | null };
    const cat = WRECK_CATS.find((c) => c.key === p.cat)?.label ?? "Wreck";
    return `${p.name ? `${p.name} · ` : ""}${cat}${p.depth != null ? ` · ${p.depth} m down` : ""}`;
  },
};

/* ── named wrecks worldwide (Wikidata) ───────────────────────────── */

export const namedWrecksLayer: AtlasLayer = {
  id: "named",
  label: "Named shipwrecks",
  group: "Wrecks",
  defaultOn: true,
  badge: "Worldwide",
  description: "Over 30,000 shipwrecks with names and positions in Wikidata. Nearly all of them (about 29,500) lie around the British Isles — elsewhere the record is thin, so NOAA's charts carry U.S. waters. Click one for its story.",
  legend: [{ color: "#f8fafc", label: "Named wreck" }],
  citation: { label: "Wikidata", href: "https://www.wikidata.org/", license: "CC0" },
  clickable: ["named-dot"],
  install(map, { dark }) {
    map.addSource("named", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "named-dot",
      type: "circle",
      source: "named",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.2, 8, 3.5, 13, 6],
        "circle-color": "#f8fafc",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#0ea5e9",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 0, 9, 1.2],
      },
    });
    map.addLayer({
      id: "named-label",
      type: "symbol",
      source: "named",
      minzoom: 8,
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 10.5, "text-offset": [0, 1], "text-anchor": "top", "text-max-width": 9, "text-optional": true },
      paint: { "text-color": dark ? "#e0f2fe" : "#0f172a", "text-halo-color": dark ? "#020617" : "#ffffff", "text-halo-width": dark ? 1.3 : 1.8 },
    });
    return ["named-dot", "named-label"];
  },
  hoverLabel: (f) => {
    const p = f.properties as { name: string; year?: number | null };
    return `${p.name}${p.year ? ` · lost ${p.year}` : ""}`;
  },
};

/* ── featured wrecks ─────────────────────────────────────────────── */

export const FEATURED_FC: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: FEATURED_WRECKS.map((w) => ({
    type: "Feature",
    id: w.id,
    geometry: { type: "Point", coordinates: w.center },
    properties: { id: w.id, name: w.name, accent: w.accent },
  })),
};

let lastBeacon = 0;

export const featuredLayer: AtlasLayer = {
  id: "featured",
  label: "Featured wrecks",
  group: "Wrecks",
  defaultOn: true,
  description: "Nine wrecks with their stories, from the Monitor to the Titanic.",
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
      paint: {
        "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 8, 6],
        "circle-color": "#020617",
        "circle-stroke-color": ["get", "accent"],
        "circle-stroke-width": 2.5,
      },
    });
    map.addLayer({
      id: "featured-label",
      type: "symbol",
      source: "featured",
      minzoom: 2.5,
      layout: { "text-field": ["upcase", ["get", "name"]], "text-font": FONT, "text-size": 10.5, "text-letter-spacing": 0.12, "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 9 },
      paint: { "text-color": dark ? ["get", "accent"] : "#0f172a", "text-halo-color": dark ? "#020617" : "#ffffff", "text-halo-width": dark ? 1.6 : 2 },
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

export const WRECK_LAYERS: AtlasLayer[] = [seafloorLayer, sanctuariesLayer, noaaWrecksLayer, namedWrecksLayer, featuredLayer];
