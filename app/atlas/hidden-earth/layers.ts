/* ------------------------------------------------------------------ */
/*  Hidden Earth's map layers. Each lidar view is its own layer; the   */
/*  page keeps exactly one visible. Below zoom 10 the national shaded  */
/*  relief stands in (live lidar renders are for close looks).         */
/* ------------------------------------------------------------------ */
import type { Map as MlMap } from "maplibre-gl";
import type { AtlasLayer } from "@/components/atlas/types";
import { COVERAGE_TILES, DEP_BOUNDS, LIDAR_MIN_ZOOM, LIDAR_VIEWS, lidarTiles, type LidarView } from "@/utils/geo/lidar";
import { addEuLidar } from "@/utils/geo/euLidar";
import { SITES, SITE_KINDS } from "./sites";

const FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];
const DEP_CITATION = { label: "USGS 3D Elevation Program (3DEP)", href: "https://www.usgs.gov/3d-elevation-program", license: "public domain" };

/* ── national relief (zoomed out) ────────────────────────────────── */

export const nationalReliefLayer: AtlasLayer = {
  id: "national-relief",
  label: "Shaded relief",
  group: "Lidar",
  defaultOn: true,
  citation: { label: "USGS The National Map — shaded relief", href: "https://www.usgs.gov/programs/national-geospatial-program/national-map", license: "public domain" },
  install(map, { labelLayerId }) {
    map.addSource("national-relief", {
      type: "raster",
      tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution: "Relief: USGS The National Map",
    });
    map.addLayer(
      {
        id: "national-relief-raster",
        type: "raster",
        source: "national-relief",
        maxzoom: LIDAR_MIN_ZOOM + 0.5,
        paint: { "raster-opacity": 0.5, "raster-saturation": -1, "raster-contrast": 0.3, "raster-brightness-max": 0.55 },
      },
      labelLayerId
    );
    return ["national-relief-raster"];
  },
};

/* ── the lidar views ─────────────────────────────────────────────── */

const viewLayer = (view: LidarView): AtlasLayer => ({
  id: `lidar-${view.key}`,
  label: view.label,
  group: "Lidar",
  description: view.blurb,
  citation: DEP_CITATION,
  install(map, { labelLayerId }) {
    const src = `lidar-${view.key}`;
    map.addSource(src, { type: "raster", tiles: [lidarTiles(view)], tileSize: 256, minzoom: LIDAR_MIN_ZOOM, maxzoom: 19, bounds: DEP_BOUNDS, attribution: "Lidar: USGS 3DEP" });
    map.addLayer(
      {
        id: `${src}-raster`,
        type: "raster",
        source: src,
        minzoom: LIDAR_MIN_ZOOM,
        paint: { "raster-fade-duration": 200, "raster-opacity": ["interpolate", ["linear"], ["zoom"], LIDAR_MIN_ZOOM, 0, LIDAR_MIN_ZOOM + 0.6, 1], ...(view.paint ?? {}) },
      },
      labelLayerId
    );
    // national lidar abroad — England, the Netherlands, France, Switzerland, Norway (a hillshade in every view)
    const eu = addEuLidar(map, src, labelLayerId, { "raster-opacity": ["interpolate", ["linear"], ["zoom"], LIDAR_MIN_ZOOM, 0, LIDAR_MIN_ZOOM + 0.6, 1] });
    return [`${src}-raster`, ...eu];
  },
  // a click on the lidar (zoomed in) opens the ground readout for that spot
  async identify(map, lngLat) {
    return map.getZoom() >= LIDAR_MIN_ZOOM ? { layer: "ground", props: {}, lngLat } : null;
  },
});

export const LIDAR_VIEW_LAYERS = LIDAR_VIEWS.map(viewLayer);

/* ── where 1 m lidar exists ──────────────────────────────────────── */

export const coverageLayer: AtlasLayer = {
  id: "coverage",
  label: "1 m lidar coverage",
  group: "Coverage",
  badge: "U.S.",
  description: "Where the 3D Elevation Program has published 1-meter lidar elevation. Gaps haven't been flown (or published) yet — there the views fall back to coarser data.",
  legend: [{ color: "#a3e635", label: "1 m lidar elevation available" }],
  citation: { label: "USGS 3DEP elevation product index", href: "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer", license: "public domain" },
  install(map, { labelLayerId }) {
    map.addSource("coverage", { type: "raster", tiles: [COVERAGE_TILES], tileSize: 256, maxzoom: 12 });
    // the index draws brown; re-tint toward lime and keep it light so the ground shows through
    map.addLayer(
      { id: "coverage-raster", type: "raster", source: "coverage", paint: { "raster-opacity": 0.35, "raster-hue-rotate": 70, "raster-saturation": 0.4, "raster-brightness-min": 0.25 } },
      labelLayerId
    );
    return ["coverage-raster"];
  },
};

/* ── featured hidden sites ───────────────────────────────────────── */

export const SITE_FC: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: SITES.map((s) => ({
    type: "Feature",
    id: s.id,
    geometry: { type: "Point", coordinates: s.center },
    properties: { id: s.id, name: s.name, kind: s.kind, color: SITE_KINDS[s.kind].color },
  })),
};

let lastBeacon = 0;

export const sitesLayer: AtlasLayer = {
  id: "sites",
  label: "Hidden sites",
  group: "Sites",
  defaultOn: true,
  description: "Places where lidar shows what the eye — or the forest — hides. Click one, then peel back the ground cover.",
  legend: Object.values(SITE_KINDS).map((k) => ({ color: k.color, label: k.label })),
  citation: { label: "", href: "" },
  selectSource: "sites",
  clickable: ["sites-core"],
  install(map) {
    map.addSource("sites", { type: "geojson", data: SITE_FC, promoteId: "id" });
    map.addLayer({ id: "sites-beacon", type: "circle", source: "sites", paint: { "circle-radius": 14, "circle-color": ["get", "color"], "circle-blur": 0.9, "circle-opacity": 0.5 } });
    map.addLayer({
      id: "sites-core",
      type: "circle",
      source: "sites",
      paint: {
        "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 8, 6],
        "circle-color": "#020617",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 2.5,
      },
    });
    map.addLayer({
      id: "sites-label",
      type: "symbol",
      source: "sites",
      minzoom: 3.5,
      layout: { "text-field": ["upcase", ["get", "name"]], "text-font": FONT, "text-size": 10.5, "text-letter-spacing": 0.12, "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 9 },
      paint: { "text-color": ["get", "color"], "text-halo-color": "#020617", "text-halo-width": 1.6 },
    });
    return ["sites-beacon", "sites-core", "sites-label"];
  },
  hoverLabel: (f) => String(f.properties?.name ?? ""),
  animate(map: MlMap, now: number) {
    if (now - lastBeacon < 40 || !map.getLayer("sites-beacon")) return;
    lastBeacon = now;
    const t = (now % 2200) / 2200;
    map.setPaintProperty("sites-beacon", "circle-radius", 8 + 18 * t);
    map.setPaintProperty("sites-beacon", "circle-opacity", 0.55 * (1 - t));
  },
};

export const HIDDEN_LAYERS: AtlasLayer[] = [nationalReliefLayer, ...LIDAR_VIEW_LAYERS, coverageLayer, sitesLayer];
