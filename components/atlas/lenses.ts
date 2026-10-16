/* ------------------------------------------------------------------ */
/*  Lenses for <CompareView>: the same ground seen four ways. Each is  */
/*  a stack of keyless raster sources turned into a MapLibre style.    */
/* ------------------------------------------------------------------ */
import type { StyleSpecification } from "maplibre-gl";
import type { Citation } from "./types";
import { MACROSTRAT_TILES } from "@/utils/geo/strange";
import { topoTiles } from "@/utils/geo/topo";
import { LIDAR_MIN_ZOOM, lidarTiles, type LidarView } from "@/utils/geo/lidar";

export interface LensSource {
  id: string;
  tiles: string;
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  /** style-layer zoom range (sources keep loading outside it otherwise) */
  layerMinzoom?: number;
  layerMaxzoom?: number;
  paint?: Record<string, number>;
  attribution?: string;
}

export interface Lens {
  id: string;
  label: string;
  /** one line on what this view reveals */
  blurb: string;
  accent: string;
  sources: LensSource[];
  citation: Citation;
}

const RELIEF_TILES = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}";
const LIDAR_TILES =
  "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=jpgpng&renderingRule=%7B%22rasterFunction%22%3A%22Hillshade%20Multidirectional%22%7D&f=image";

export const SATELLITE_LENS: Lens = {
  id: "satellite",
  label: "Satellite",
  blurb: "What it looks like from above today.",
  accent: "#38bdf8",
  sources: [
    {
      id: "imagery",
      tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  ],
  citation: { label: "Esri World Imagery", href: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" },
};

export const LIDAR_LENS: Lens = {
  id: "lidar",
  label: "Bare earth",
  blurb: "Lidar strips away trees and buildings: just the shape of the ground (1 m detail from zoom 11 where flown).",
  accent: "#a3e635",
  sources: [
    { id: "relief", tiles: RELIEF_TILES, maxzoom: 16, layerMaxzoom: 11.5, attribution: "Relief: USGS The National Map" },
    { id: "lidar", tiles: LIDAR_TILES, minzoom: 11, layerMinzoom: 11, attribution: "Lidar: USGS 3DEP" },
  ],
  citation: { label: "USGS 3D Elevation Program (3DEP)", href: "https://www.usgs.gov/3d-elevation-program", license: "public domain" },
};

export const GEOLOGY_LENS: Lens = {
  id: "geology",
  label: "Geology",
  blurb: "The rock at the surface, coloured by age.",
  accent: "#e879f9",
  sources: [
    { id: "relief", tiles: RELIEF_TILES, maxzoom: 16, attribution: "Relief: USGS The National Map" },
    { id: "geology", tiles: MACROSTRAT_TILES, tileSize: 512, maxzoom: 15, paint: { "raster-opacity": 0.72 }, attribution: "Geology: Macrostrat (CC-BY 4.0)" },
  ],
  citation: { label: "Macrostrat (University of Wisconsin–Madison)", href: "https://macrostrat.org/", license: "CC-BY 4.0" },
};

/** The historical topo lens; pass raster ids to show one edition, none for the newest. */
export function topoLens(ids?: number[]): Lens {
  return {
    id: "topo",
    label: "Old topo map",
    blurb: "USGS topographic maps back to the 1880s — what surveyors drew before roads, dams and towns moved in.",
    accent: "#fbbf24",
    sources: [
      { id: "paper", tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", maxzoom: 16, attribution: "Esri" },
      { id: "topo", tiles: topoTiles(ids), maxzoom: 17, attribution: "USGS Historical Topographic Map Collection" },
    ],
    citation: { label: "USGS Historical Topographic Map Collection (via Esri)", href: "https://www.usgs.gov/programs/national-geospatial-program/historical-topographic-maps-preserving-past", license: "public domain" },
  };
}

export function lensStyle(lens: Lens): StyleSpecification {
  return {
    version: 8,
    sources: Object.fromEntries(
      lens.sources.map((s) => [
        s.id,
        { type: "raster" as const, tiles: [s.tiles], tileSize: s.tileSize ?? 256, ...(s.minzoom != null ? { minzoom: s.minzoom } : {}), maxzoom: s.maxzoom ?? 18, ...(s.attribution ? { attribution: s.attribution } : {}) },
      ])
    ),
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#05060d" } },
      ...lens.sources.map((s) => ({
        id: s.id,
        type: "raster" as const,
        source: s.id,
        ...(s.layerMinzoom != null ? { minzoom: s.layerMinzoom } : {}),
        ...(s.layerMaxzoom != null ? { maxzoom: s.layerMaxzoom } : {}),
        paint: { "raster-fade-duration": 150, ...(s.paint ?? {}) },
      })),
    ],
  };
}

/** Any 3DEP view as a lens (USGS relief tiles below zoom 10, the live view above). */
export function lidarViewLens(view: LidarView): Lens {
  return {
    id: `lidar-${view.key}`,
    label: `Lidar · ${view.label}`,
    blurb: view.blurb,
    accent: "#a3e635",
    sources: [
      { id: "relief", tiles: RELIEF_TILES, maxzoom: 16, layerMaxzoom: LIDAR_MIN_ZOOM + 0.5, attribution: "Relief: USGS The National Map" },
      { id: "lidar", tiles: lidarTiles(view), minzoom: LIDAR_MIN_ZOOM, layerMinzoom: LIDAR_MIN_ZOOM, paint: view.paint, attribution: "Lidar: USGS 3DEP" },
    ],
    citation: LIDAR_LENS.citation,
  };
}
