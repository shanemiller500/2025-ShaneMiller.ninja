/* ------------------------------------------------------------------ */
/*  Basemaps + terrain shared by every atlas project. All keyless.     */
/* ------------------------------------------------------------------ */
import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import type { Basemap, TerrainMode } from "./types";

const CARTO_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const SATELLITE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf",
  sources: {
    imagery: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "imagery", type: "raster", source: "imagery" }],
};

export function basemapStyle(basemap: Basemap, dark: boolean): string | StyleSpecification {
  if (basemap === "satellite") return SATELLITE;
  return dark ? CARTO_DARK : CARTO_LIGHT;
}

/** Mapzen/AWS Terrarium elevation tiles (public dataset, no key). */
export const DEM_SOURCE = "atlas-dem";
/** Hillshade gets its own copy of the DEM — sharing one with 3D terrain degrades both. */
const SHADE_SOURCE = "atlas-dem-shade";
const DEM = {
  type: "raster-dem" as const,
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium" as const,
  tileSize: 256,
  maxzoom: 14,
  attribution: "Terrain: Mapzen / AWS Open Data",
};

export const firstLabelLayer = (map: MlMap) => map.getStyle().layers?.find((l) => l.type === "symbol")?.id;

/** Apply relief shading and/or 3D terrain. Safe to call after every style load. */
export function applyTerrain(map: MlMap, mode: TerrainMode, dark: boolean) {
  const wantShade = mode !== "flat";
  if (wantShade && !map.getSource(SHADE_SOURCE)) map.addSource(SHADE_SOURCE, DEM);
  if (mode === "3d" && !map.getSource(DEM_SOURCE)) map.addSource(DEM_SOURCE, DEM);

  if (wantShade && !map.getLayer("atlas-hillshade")) {
    map.addLayer(
      {
        id: "atlas-hillshade",
        type: "hillshade",
        source: SHADE_SOURCE,
        paint: {
          "hillshade-exaggeration": 0.45,
          "hillshade-shadow-color": dark ? "#000000" : "#475569",
          "hillshade-highlight-color": dark ? "#64748b" : "#ffffff",
          "hillshade-accent-color": dark ? "#0f172a" : "#334155",
        },
      },
      firstLabelLayer(map)
    );
  }
  if (!wantShade && map.getLayer("atlas-hillshade")) map.removeLayer("atlas-hillshade");

  if (mode === "3d") {
    map.setTerrain({ source: DEM_SOURCE, exaggeration: 1.3 });
    if (map.getPitch() < 30) map.easeTo({ pitch: 55, duration: 900 });
  } else if (map.getTerrain()) {
    // only flatten the camera when leaving 3D — a story may have tilted it on purpose
    map.setTerrain(null);
    if (map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 600 });
  }
}
