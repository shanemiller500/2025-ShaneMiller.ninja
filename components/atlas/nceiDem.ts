/* ------------------------------------------------------------------ */
/*  NOAA NCEI DEM global mosaic — the best bathymetry NOAA has for a   */
/*  spot: coastal DEMs (CUDEM, down to ~3 m) along U.S. shores, coarser */
/*  regional DEMs and GEBCO elsewhere. One exportImage request returns */
/*  an uncompressed float32 GeoTIFF; this reads just that flavour.     */
/* ------------------------------------------------------------------ */

import type { BBox } from "./basinGrid";

export const NCEI_DEM = "https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer";
export const NCEI_DEM_INFO = "https://www.ncei.noaa.gov/products/coastal-elevation-models";
const NO_DATA = -99999;

export interface DemGrid {
  width: number;
  height: number;
  /** row-major, north row first; NaN where there's no data */
  data: Float32Array;
}

/** Minimal TIFF reader: uncompressed, 32-bit float, one band, strips or tiles. */
export function readFloatTiff(buf: ArrayBuffer): DemGrid {
  const v = new DataView(buf);
  const le = v.getUint16(0) === 0x4949;
  if (!le && v.getUint16(0) !== 0x4d4d) throw new Error("not a TIFF");
  const u16 = (o: number) => v.getUint16(o, le);
  const u32 = (o: number) => v.getUint32(o, le);
  if (u16(2) !== 42) throw new Error("BigTIFF isn't supported");
  const ifd = u32(4);
  const tags = new Map<number, number[]>();
  for (let i = 0, n = u16(ifd); i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const count = u32(e + 4);
    const size = type === 3 ? 2 : type === 4 ? 4 : 0;
    if (!size) continue; // only SHORT / LONG tags matter here
    const at = count * size <= 4 ? e + 8 : u32(e + 8);
    tags.set(tag, Array.from({ length: count }, (_, k) => (size === 2 ? u16(at + k * 2) : u32(at + k * 4))));
  }
  const one = (t: number, d?: number) => tags.get(t)?.[0] ?? d;
  const width = one(256)!;
  const height = one(257)!;
  if ((one(259, 1) ?? 1) !== 1) throw new Error("compressed TIFF");
  if (one(258) !== 32 || one(339) !== 3) throw new Error("expected float32 samples");
  const data = new Float32Array(width * height);
  const put = (offset: number, x0: number, y0: number, w: number, h: number, rowStride: number) => {
    for (let y = 0; y < h && y0 + y < height; y++)
      for (let x = 0; x < w && x0 + x < width; x++) data[(y0 + y) * width + x0 + x] = v.getFloat32(offset + (y * rowStride + x) * 4, le);
  };
  if (tags.has(324)) {
    const tw = one(322)!;
    const th = one(323)!;
    const across = Math.ceil(width / tw);
    tags.get(324)!.forEach((off, i) => put(off, (i % across) * tw, Math.floor(i / across) * th, tw, th, tw));
  } else {
    const rows = one(278, height)!;
    tags.get(273)!.forEach((off, i) => put(off, 0, i * rows, width, rows, width));
  }
  for (let i = 0; i < data.length; i++) if (data[i] <= NO_DATA + 1 || !Number.isFinite(data[i])) data[i] = NaN;
  return { width, height, data };
}

/** Elevation grid (m, negative below sea level) over a lng/lat box. */
export async function loadNceiDem([w, s, e, n]: BBox, size: number, signal?: AbortSignal): Promise<DemGrid> {
  const q = new URLSearchParams({
    bbox: `${w},${s},${e},${n}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${size},${size}`,
    format: "tiff",
    pixelType: "F32",
    compression: "None",
    noData: String(NO_DATA),
    interpolation: "RSP_BilinearInterpolation",
    f: "image",
  });
  const res = await fetch(`${NCEI_DEM}/exportImage?${q}`, { signal });
  if (!res.ok) throw new Error(`NCEI DEM ${res.status}`);
  const grid = readFloatTiff(await res.arrayBuffer());
  let valid = 0;
  for (let i = 0; i < grid.data.length; i++) if (!Number.isNaN(grid.data[i])) valid++;
  if (valid < grid.data.length * 0.5) throw new Error("NCEI DEM has no data here");
  return grid;
}

/** Bilinear sample at fractional column/row; NaN neighbours are skipped. */
export function sampleGrid(g: DemGrid, col: number, row: number) {
  const x = Math.min(g.width - 1, Math.max(0, col));
  const y = Math.min(g.height - 1, Math.max(0, row));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(g.width - 1, x0 + 1);
  const y1 = Math.min(g.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  let sum = 0;
  let wsum = 0;
  const add = (xx: number, yy: number, wt: number) => {
    const h = g.data[yy * g.width + xx];
    if (!Number.isNaN(h) && wt > 0) {
      sum += h * wt;
      wsum += wt;
    }
  };
  add(x0, y0, (1 - fx) * (1 - fy));
  add(x1, y0, fx * (1 - fy));
  add(x0, y1, (1 - fx) * fy);
  add(x1, y1, fx * fy);
  return wsum ? sum / wsum : NaN;
}

/* ── EMODnet Bathymetry (European seas, ~115 m, free with attribution) ── */

export const EMODNET_WCS = "https://ows.emodnet-bathymetry.eu/wcs";
export const EMODNET_INFO = "https://emodnet.ec.europa.eu/en/bathymetry";
/** The DTM's extent: European seas from the Atlantic margin to the Black Sea and the Arctic. */
const EMODNET_EXTENT: BBox = [-36, 15, 43, 90];

export const inEmodnet = ([lng, lat]: [number, number]) => lng >= EMODNET_EXTENT[0] && lng <= EMODNET_EXTENT[2] && lat >= EMODNET_EXTENT[1] && lat <= EMODNET_EXTENT[3];

/** EMODnet's mean-depth DTM over a box, at its native ~1/16′ grid (WCS 2.0.1, float GeoTIFF). */
export async function loadEmodnetDem([w, s, e, n]: BBox, signal?: AbortSignal): Promise<DemGrid> {
  const q = `service=WCS&version=2.0.1&request=GetCoverage&coverageId=emodnet__mean&subset=Lat(${s},${n})&subset=Long(${w},${e})&format=image/tiff`;
  const res = await fetch(`${EMODNET_WCS}?${q}`, { signal });
  if (!res.ok) throw new Error(`EMODnet ${res.status}`);
  const grid = readFloatTiff(await res.arrayBuffer());
  let valid = 0;
  for (let i = 0; i < grid.data.length; i++) if (!Number.isNaN(grid.data[i])) valid++;
  // land is no-data in a sea-only DTM; mostly-land boxes go to the global mosaic instead
  if (grid.width < 4 || valid < grid.data.length * 0.5) throw new Error("EMODnet has little data here");
  return grid;
}
