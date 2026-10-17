/* ------------------------------------------------------------------ */
/*  National lidar outside the U.S., shown wherever 3DEP isn't:        */
/*                                                                     */
/*  · England — Environment Agency LIDAR Composite DTM 1 m hillshade   */
/*    (WMS, Open Government Licence v3)                                */
/*  · Netherlands — AHN 0.5 m bare-earth DTM (PDOK WCS, CC0). There's  */
/*    no open AHN hillshade (the ArcGIS one is licensed for the AHN    */
/*    Viewer only), so tiles come through an `ahn-hs://` protocol that */
/*    fetches raw heights and shades them here, multidirectionally     */
/*    like the 3DEP view.                                              */
/*                                                                     */
/*  Spain's open DTM was checked and left out: it is published in      */
/*  whole metres, which shades into visible terraces on flat ground.   */
/* ------------------------------------------------------------------ */

import type { Map as MlMap } from "maplibre-gl";
import { readFloatTiff } from "@/components/atlas/nceiDem";

export interface EuLidarSource {
  id: string;
  label: string;
  tiles: string;
  /** [w, s, e, n] — tiles are only requested inside */
  bounds: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  attribution: string;
  citation: { label: string; href: string; license: string };
}

const EA_WMS = "https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wms";
const AHN_WCS = "https://service.pdok.nl/rws/ahn/wcs/v1_0";
export const AHN_PROTOCOL = "ahn-hs";

export const EU_LIDAR: EuLidarSource[] = [
  {
    id: "ea",
    label: "England — Environment Agency 1 m lidar",
    tiles: `${EA_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=Lidar_Composite_Hillshade_DTM_1m&styles=&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true`,
    bounds: [-6.5, 49.8, 2.0, 55.9],
    minzoom: 10,
    maxzoom: 18,
    attribution: "Lidar: Environment Agency (OGL v3)",
    citation: { label: "Environment Agency — LIDAR Composite DTM 1 m", href: "https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc", license: "Open Government Licence v3.0" },
  },
  {
    id: "ahn",
    label: "Netherlands — AHN 0.5 m lidar",
    tiles: `${AHN_PROTOCOL}://{z}/{x}/{y}`,
    bounds: [3.2, 50.7, 7.3, 53.6],
    minzoom: 10,
    maxzoom: 18,
    attribution: "Lidar: AHN / Rijkswaterstaat (CC0)",
    citation: { label: "AHN — Actueel Hoogtebestand Nederland (PDOK)", href: "https://www.ahn.nl/", license: "CC0" },
  },
];

/* ── shading ─────────────────────────────────────────────────────── */

/**
 * Multidirectional hillshade of a height grid with a one-cell border, into a (w−2)×(h−2)
 * RGBA image: light at 45° from four azimuths across the north-west (225°, 270°, 315°, 360°,
 * the cartographic convention), averaged — flat ground comes out ~71% grey. No-data cells
 * (NaN) come out transparent. `cell` is the ground spacing in metres; `zf` exaggerates relief.
 */
export function shadeHeights(heights: Float32Array, w: number, h: number, cell: number, zf = 3): Uint8ClampedArray {
  const ow = w - 2;
  const oh = h - 2;
  const out = new Uint8ClampedArray(ow * oh * 4);
  const alt = Math.PI / 4;
  // light vectors (east, north, up)
  const lights = [225, 270, 315, 360].map((d) => {
    const a = (d * Math.PI) / 180;
    return [Math.sin(a) * Math.cos(alt), Math.cos(a) * Math.cos(alt), Math.sin(alt)];
  });
  const at = (x: number, y: number) => heights[y * w + x];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const o = ((y - 1) * ow + (x - 1)) * 4;
      const c = at(x, y);
      if (Number.isNaN(c)) continue; // transparent
      // Horn's 3×3 gradient; missing neighbours borrow the centre height. Rows run south.
      const v = (dx: number, dy: number) => {
        const z = at(x + dx, y + dy);
        return Number.isNaN(z) ? c : z;
      };
      const dzEast = (v(1, -1) + 2 * v(1, 0) + v(1, 1) - (v(-1, -1) + 2 * v(-1, 0) + v(-1, 1))) / (8 * cell);
      const dzNorth = (v(-1, -1) + 2 * v(0, -1) + v(1, -1) - (v(-1, 1) + 2 * v(0, 1) + v(1, 1))) / (8 * cell);
      const nx = -zf * dzEast;
      const ny = -zf * dzNorth;
      const len = Math.hypot(nx, ny, 1);
      let shade = 0;
      for (const [lx, ly, lz] of lights) shade += Math.max(0, (nx * lx + ny * ly + lz) / len);
      const g = Math.round(255 * Math.min(1, shade / lights.length));
      out[o] = out[o + 1] = out[o + 2] = g;
      out[o + 3] = 255;
    }
  return out;
}

/**
 * Fill small no-data holes from their neighbours (AHN has no ground under dense crowns and
 * buildings): a few passes, each filling cells with at least 3 valid neighbours. Big gaps
 * (water, large buildings) stay empty and draw transparent.
 */
export function fillHoles(h: Float32Array, w: number, rows: number, passes = 4): void {
  for (let pass = 0; pass < passes; pass++) {
    const fills: [number, number][] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!Number.isNaN(h[i])) continue;
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < rows && !Number.isNaN(h[yy * w + xx])) {
              sum += h[yy * w + xx];
              n++;
            }
          }
        if (n >= 3) fills.push([i, sum / n]);
      }
    if (!fills.length) break;
    for (const [i, v] of fills) h[i] = v;
  }
}

/* ── the ahn-hs:// protocol ──────────────────────────────────────── */

const WORLD = 40075016.686;

/** Web-Mercator bounds of tile z/x/y, grown by `pad` pixels of a 256 tile. */
export function tileBounds3857(z: number, x: number, y: number, pad = 1) {
  const size = WORLD / 2 ** z;
  const px = size / 256;
  const minx = -WORLD / 2 + x * size - pad * px;
  const maxy = WORLD / 2 - y * size + pad * px;
  return { minx, maxx: minx + size + 2 * pad * px, miny: maxy - size - 2 * pad * px, maxy, px };
}

async function ahnTile(z: number, x: number, y: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  const b = tileBounds3857(z, x, y);
  const crs = "http://www.opengis.net/def/crs/EPSG/0/3857";
  const q = `service=WCS&version=2.0.1&request=GetCoverage&coverageId=dtm_05m&format=image/tiff&subset=x(${b.minx},${b.maxx})&subset=y(${b.miny},${b.maxy})&subsettingCrs=${crs}&outputCrs=${crs}&scaleSize=x(258),y(258)&geotiff:compression=None`;
  const res = await fetch(`${AHN_WCS}?${q}`, { signal });
  if (!res.ok) throw new Error(`AHN ${res.status}`);
  const grid = readFloatTiff(await res.arrayBuffer());
  fillHoles(grid.data, grid.width, grid.height);
  // Mercator metres → ground metres at this latitude
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / 2 ** z))) * 180) / Math.PI;
  const rgba = shadeHeights(grid.data, grid.width, grid.height, b.px * Math.cos((lat * Math.PI) / 180), 3);
  const canvas = new OffscreenCanvas(grid.width - 2, grid.height - 2);
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), grid.width - 2, grid.height - 2), 0, 0);
  return (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer();
}

let registered = false;
/**
 * Register `ahn-hs://` once per page (MapLibre protocols are global). The map components
 * call this at import time with their maplibre, so it exists before any tile is asked for.
 */
export function registerEuLidar(maplibregl: { addProtocol: typeof import("maplibre-gl").addProtocol }): void {
  if (registered || typeof window === "undefined") return;
  registered = true;
  maplibregl.addProtocol(AHN_PROTOCOL, async (params, abort) => {
    const m = params.url.match(/^ahn-hs:\/\/(\d+)\/(\d+)\/(\d+)/);
    if (!m) throw new Error(`bad AHN tile url ${params.url}`);
    return { data: await ahnTile(+m[1], +m[2], +m[3], abort.signal) };
  });
}

/** Add every European lidar source + raster layer to a map (below `before`). */
export function addEuLidar(map: MlMap, prefix: string, before?: string, paint: Record<string, unknown> = {}): string[] {
  return EU_LIDAR.map((s) => {
    const id = `${prefix}-${s.id}`;
    if (!map.getSource?.(id)) map.addSource(id, { type: "raster", tiles: [s.tiles], tileSize: 256, bounds: s.bounds, minzoom: s.minzoom, maxzoom: s.maxzoom, attribution: s.attribution });
    map.addLayer({ id: `${id}-raster`, type: "raster", source: id, minzoom: s.minzoom, paint: { "raster-fade-duration": 200, ...paint } }, before);
    return `${id}-raster`;
  });
}
