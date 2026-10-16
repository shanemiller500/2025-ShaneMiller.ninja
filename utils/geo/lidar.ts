/* ------------------------------------------------------------------ */
/*  USGS 3D Elevation Program (3DEP): bare-earth elevation from lidar, */
/*  rendered server-side into several "views" that each make a        */
/*  different kind of hidden feature pop, plus the 1 m coverage index. */
/* ------------------------------------------------------------------ */

export const DEP_SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer";
export const DEP_INDEX = "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer";

export type LidarViewKey = "multi" | "slope" | "tinted" | "contour" | "aspect";

export interface LidarView {
  key: LidarViewKey;
  label: string;
  /** what it's good for */
  blurb: string;
  /** 3DEP server raster function */
  fn: string;
  format: "jpgpng" | "png";
  /** MapLibre raster paint (contours are black lines: invert them for a dark map) */
  paint?: Record<string, number>;
}

export const LIDAR_VIEWS: LidarView[] = [
  { key: "multi", label: "Multi-light", blurb: "Shaded from six directions at once, so no feature hides in shadow. The best all-rounder.", fn: "Hillshade Multidirectional", format: "jpgpng" },
  { key: "slope", label: "Slope", blurb: "Steepness as heat: banks, walls, ditches and scarps light up as sharp lines.", fn: "Slope Map", format: "jpgpng" },
  { key: "tinted", label: "Height", blurb: "Shaded relief coloured by elevation — mounds and terraces stand out as islands of colour.", fn: "Hillshade Elevation Tinted", format: "jpgpng" },
  {
    key: "contour",
    label: "2 ft contours",
    blurb: "A contour line every 2 feet: mounds become bullseyes, old roads become kinks.",
    fn: "Preset 2ft Contour Interval",
    format: "png",
    paint: { "raster-brightness-min": 1, "raster-brightness-max": 0 },
  },
  { key: "aspect", label: "Aspect", blurb: "Which way each slope faces, in colour: rings and ridges show as colour wheels.", fn: "Aspect Map", format: "png" },
];

export const lidarView = (k: string) => LIDAR_VIEWS.find((v) => v.key === k) ?? LIDAR_VIEWS[0];

/** Map tiles of one 3DEP view (the server picks the best data: 1 m lidar where flown). */
export function lidarTiles(view: LidarView, size = 256): string {
  const rule = encodeURIComponent(JSON.stringify({ rasterFunction: view.fn }));
  return `${DEP_SERVICE}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=${size},${size}&format=${view.format}&renderingRule=${rule}&f=image`;
}

/** Where 1 m lidar elevation exists (3DEP DEM product index, layer "1 meter"). */
export const COVERAGE_TILES = `${DEP_INDEX}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:1&f=image`;

/** Zoom from which the lidar views are worth drawing (below, the national relief tiles stand in). */
export const LIDAR_MIN_ZOOM = 10;
