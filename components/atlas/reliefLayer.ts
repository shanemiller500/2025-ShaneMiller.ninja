/* ------------------------------------------------------------------ */
/*  Shared ground layer: USGS shaded relief, switching to live 1-m     */
/*  3DEP lidar hillshade from zoom 11 wherever the U.S. has been flown.*/
/* ------------------------------------------------------------------ */
import type { AtlasLayer } from "./types";

export const reliefLayer: AtlasLayer = {
  id: "relief",
  label: "Terrain relief",
  group: "Ground",
  badge: "U.S.",
  description: "USGS 3D Elevation Program shaded relief. From zoom 11 it switches to live 1-meter lidar hillshade wherever the U.S. has been flown — sinkholes, ridges and old stream beds pop out.",
  citation: { label: "USGS 3D Elevation Program (3DEP)", href: "https://www.usgs.gov/3d-elevation-program", license: "public domain" },
  install(map, { labelLayerId }) {
    map.addSource("relief", {
      type: "raster",
      tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution: "Relief: USGS The National Map",
    });
    // best available 3DEP elevation (1 m lidar where flown), hillshaded by the server for each tile
    map.addSource("lidar", {
      type: "raster",
      tiles: [
        "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=jpgpng&renderingRule=%7B%22rasterFunction%22%3A%22Hillshade%20Multidirectional%22%7D&f=image",
      ],
      tileSize: 256,
      minzoom: 11,
      attribution: "Lidar: USGS 3DEP",
    });
    // dark, high-contrast relief so it reads under X-ray as well as on the dark basemap
    const paint = { "raster-contrast": 0.35, "raster-brightness-min": 0, "raster-brightness-max": 0.5, "raster-saturation": -1 } as const;
    map.addLayer({ id: "relief-raster", type: "raster", source: "relief", maxzoom: 11.5, paint: { ...paint, "raster-opacity": 0.38 } }, labelLayerId);
    map.addLayer({ id: "lidar-raster", type: "raster", source: "lidar", minzoom: 11, paint: { ...paint, "raster-opacity": 0.55, "raster-fade-duration": 200 } }, labelLayerId);
    return ["relief-raster", "lidar-raster"];
  },
};

