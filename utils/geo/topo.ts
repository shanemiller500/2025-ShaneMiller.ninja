/* ------------------------------------------------------------------ */
/*  USGS Historical Topographic Map Collection (1880s → today), as     */
/*  served by Esri's USA_Historical_Topo_Maps image service. Every     */
/*  scanned sheet is a raster we can list for an area and lock the     */
/*  mosaic to — so a map can step back through the editions.           */
/* ------------------------------------------------------------------ */

export const TOPO_SERVICE = "https://historical1.arcgis.com/arcgis/rest/services/USA_Historical_Topo_Maps/ImageServer";

export interface TopoEdition {
  /** `${scale}:${year}` */
  key: string;
  year: number;
  scale: number;
  /** quadrangle names in view */
  names: string[];
  /** raster ids to lock the mosaic to */
  ids: number[];
}

/** Map tiles for the collection: locked to some sheets, or the service's default (newest on top). */
export function topoTiles(ids?: number[]): string {
  const rule = ids?.length ? `&mosaicRule=${encodeURIComponent(JSON.stringify({ mosaicMethod: "esriMosaicLockRaster", lockRasterIds: ids }))}` : "";
  return `${TOPO_SERVICE}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=jpgpng&transparent=true${rule}&f=image`;
}

const scaleLabel = (s: number) => `1:${s.toLocaleString("en-US")}`;
export const editionLabel = (e: TopoEdition) => `${e.year} · ${scaleLabel(e.scale)}`;

/**
 * Every edition that covers the area, oldest first. An edition = one survey year at one
 * scale; its ids include the neighbouring quadrangles of the same year so the view is filled.
 */
export async function topoEditionsIn(bounds: [number, number, number, number], signal?: AbortSignal): Promise<TopoEdition[]> {
  const [w, s, e, n] = bounds;
  const q = new URLSearchParams({
    geometry: JSON.stringify({ xmin: w, ymin: s, xmax: e, ymax: n, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "OBJECTID,Map_Name,Date_On_Map,Map_Scale",
    returnGeometry: "false",
    resultRecordCount: "1000",
    f: "json",
  });
  const res = await fetch(`${TOPO_SERVICE}/query?${q}`, { signal });
  if (!res.ok) throw new Error(`topo index: HTTP ${res.status}`);
  const j = (await res.json()) as { features?: { attributes: { OBJECTID: number; Map_Name: string; Date_On_Map: number; Map_Scale: number } }[]; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  const byKey = new Map<string, TopoEdition>();
  for (const { attributes: a } of j.features ?? []) {
    if (!a.Date_On_Map || !a.Map_Scale) continue;
    const key = `${a.Map_Scale}:${a.Date_On_Map}`;
    const ed = byKey.get(key) ?? { key, year: a.Date_On_Map, scale: a.Map_Scale, names: [], ids: [] };
    ed.ids.push(a.OBJECTID);
    if (!ed.names.includes(a.Map_Name)) ed.names.push(a.Map_Name);
    byKey.set(key, ed);
  }
  return Array.from(byKey.values()).sort((a, b) => a.year - b.year || a.scale - b.scale);
}

/* ── spot elevation (USGS Elevation Point Query Service) ─────────── */

/** Ground elevation in metres from the best available 3DEP data, or null outside the U.S. */
export async function elevationAt(lng: number, lat: number, signal?: AbortSignal): Promise<number | null> {
  const res = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${lng.toFixed(6)}&y=${lat.toFixed(6)}&units=Meters&wkid=4326`, { signal });
  if (!res.ok) return null;
  const v = Number(((await res.json()) as { value?: string | number }).value);
  // the service answers -1000000 where it has no data
  return Number.isFinite(v) && v > -1000 ? v : null;
}
