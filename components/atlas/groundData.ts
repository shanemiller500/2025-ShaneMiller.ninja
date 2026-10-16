/* ------------------------------------------------------------------ */
/*  Real ground for 3D scenes: elevation from the public AWS Terrarium */
/*  tiles (Mapzen/USGS-derived) and colour from Esri World Imagery,    */
/*  both sampled in the browser. Shared by DepthView and CaveScope.    */
/* ------------------------------------------------------------------ */

export type BBox = [number, number, number, number];

/** Esri World Imagery export of one lng/lat box (equirectangular, CORS-enabled, keyless). */
export const esriExport = (w: number, s: number, e: number, n: number, width: number, height: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${w},${s},${e},${n}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpg&f=image`;

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${src.slice(0, 80)}`));
    img.src = src;
  });

/* ── metres ↔ degrees around a site ─────────────────────────────── */

const M_PER_DEG_LAT = 110_574;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Local scene metres (x east, z south) → lng/lat around `site`. */
export const toLngLat = (site: { lng: number; lat: number }, x: number, z: number): [number, number] => [site.lng + x / mPerDegLng(site.lat), site.lat - z / M_PER_DEG_LAT];

/* ── elevation (Terrarium) ───────────────────────────────────────── */

const TERRARIUM = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const lng2tile = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z;
const lat2tile = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

/**
 * Elevation sampler (metres above sea level) for a bbox. Fetches the Terrarium tiles that cover
 * it at `zoom` (15 ≈ 4–5 m per pixel in the U.S.) and bilinearly interpolates.
 */
export async function loadElevation([w, s, e, n]: BBox, zoom = 15): Promise<(lng: number, lat: number) => number> {
  const x0 = Math.floor(lng2tile(w, zoom));
  const x1 = Math.floor(lng2tile(e, zoom));
  const y0 = Math.floor(lat2tile(n, zoom));
  const y1 = Math.floor(lat2tile(s, zoom));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 36) throw new Error("area too large for elevation tiles");
  const tiles = new Map<string, Uint8ClampedArray>();
  await Promise.all(
    Array.from({ length: (x1 - x0 + 1) * (y1 - y0 + 1) }, async (_, i) => {
      const tx = x0 + (i % (x1 - x0 + 1));
      const ty = y0 + Math.floor(i / (x1 - x0 + 1));
      const img = await loadImage(TERRARIUM(zoom, tx, ty));
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      tiles.set(`${tx}/${ty}`, ctx.getImageData(0, 0, 256, 256).data);
    })
  );
  const px = (gx: number, gy: number) => {
    const tx = Math.floor(gx / 256);
    const ty = Math.floor(gy / 256);
    const d = tiles.get(`${tx}/${ty}`);
    if (!d) return NaN;
    const o = ((gy - ty * 256) * 256 + (gx - tx * 256)) * 4;
    return d[o] * 256 + d[o + 1] + d[o + 2] / 256 - 32768;
  };
  return (lng, lat) => {
    const gx = lng2tile(lng, zoom) * 256 - 0.5;
    const gy = lat2tile(lat, zoom) * 256 - 0.5;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const a = px(ix, iy);
    const b = px(ix + 1, iy);
    const c = px(ix, iy + 1);
    const d = px(ix + 1, iy + 1);
    const vals = [a, b, c, d];
    if (vals.some((v) => !Number.isFinite(v))) return vals.find((v) => Number.isFinite(v)) ?? 0;
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
}

/* ── imagery ─────────────────────────────────────────────────────── */

/** RGB sampler (0–1) for a bbox from Esri World Imagery. Doesn't handle the antimeridian. */
export async function loadImageryColors([w, s, e, n]: BBox, px = 1024): Promise<(lng: number, lat: number) => [number, number, number]> {
  const aspect = (e - w) / (n - s);
  const width = aspect >= 1 ? px : Math.round(px * aspect);
  const height = aspect >= 1 ? Math.round(px / aspect) : px;
  const img = await loadImage(esriExport(w, s, e, n, width, height));
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  return (lng, lat) => {
    const x = Math.min(width - 1, Math.max(0, Math.round(((lng - w) / (e - w)) * (width - 1))));
    const y = Math.min(height - 1, Math.max(0, Math.round(((n - lat) / (n - s)) * (height - 1))));
    const o = (y * width + x) * 4;
    return [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255];
  };
}
