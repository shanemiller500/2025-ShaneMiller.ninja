/* ------------------------------------------------------------------ */
/*  ArcGIS REST helpers — any public MapServer (USGS, Esri, NOAA…).    */
/*                                                                     */
/*  Big national layers (e.g. 100k+ fault lines) are drawn as server-  */
/*  rendered raster tiles via /export, so the browser never downloads  */
/*  the geometry; clicks go through /identify for the attributes.      */
/* ------------------------------------------------------------------ */

/** MapLibre raster tile URL for a MapServer's dynamic /export endpoint. */
export function arcgisExportTiles(service: string, layerIds: number[], tileSize = 256) {
  const q = new URLSearchParams({
    bboxSR: "3857",
    imageSR: "3857",
    size: `${tileSize},${tileSize}`,
    format: "png32",
    transparent: "true",
    f: "image",
    layers: `show:${layerIds.join(",")}`,
  });
  // MapLibre fills {bbox-epsg-3857}; keep it out of URLSearchParams so the braces survive
  return `${service}/export?bbox={bbox-epsg-3857}&${q.toString()}`;
}

export interface IdentifyResult {
  layerId: number;
  layerName: string;
  value: string;
  attributes: Record<string, string>;
}

/**
 * Identify features under a click. `bounds`/`size` describe the current map view so the
 * pixel tolerance matches what the user sees.
 */
export async function arcgisIdentify(
  service: string,
  layerIds: number[],
  at: { lng: number; lat: number },
  view: { west: number; south: number; east: number; north: number; width: number; height: number },
  tolerance = 6,
  signal?: AbortSignal
): Promise<IdentifyResult[]> {
  const q = new URLSearchParams({
    geometry: `${at.lng},${at.lat}`,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: `visible:${layerIds.join(",")}`,
    tolerance: String(tolerance),
    mapExtent: `${view.west},${view.south},${view.east},${view.north}`,
    imageDisplay: `${Math.round(view.width)},${Math.round(view.height)},96`,
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${service}/identify?${q}`, { signal });
  if (!res.ok) throw new Error(`ArcGIS identify: HTTP ${res.status}`);
  const json = (await res.json()) as { results?: IdentifyResult[]; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.results ?? [];
}

/** ArcGIS returns "Null" / "Unspecified" / "" for blanks — normalise to null. */
export const arcgisValue = (v: string | undefined | null) => {
  const s = (v ?? "").trim();
  return !s || /^(null|unspecified|none)$/i.test(s) ? null : s;
};
