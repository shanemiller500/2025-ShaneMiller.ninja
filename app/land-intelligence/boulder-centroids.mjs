import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// One representative point per Boulder County folio, from the State of Colorado public parcel polygons. The county
// assessor files carry no coordinates, so comparable-sale distance needs this. State terms (service description):
// commercial application use allowed with attribution; resale of the service data is forbidden.
export const COLORADO_PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/MapServer/0';
export const ATTRIBUTION = 'State of Colorado Public parcels were accessed on {date} from https://gis.colorado.gov/public/rest/services/Address_and_Parcel';
const PAGE = 2000;

/** Area centroid of the largest ring (lng/lat; small parcels, so planar is adequate). Null for degenerate rings. */
export function ringCentroid(rings) {
  let best = null;
  for (const ring of rings ?? []) {
    let area = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      area += cross; cx += (ring[j][0] + ring[i][0]) * cross; cy += (ring[j][1] + ring[i][1]) * cross;
    }
    if (area !== 0 && (!best || Math.abs(area) > Math.abs(best.area))) best = { area, point: [cx / (3 * area), cy / (3 * area)] };
  }
  return best && best.point.every(Number.isFinite) ? best.point.map((value) => Math.round(value * 1e5) / 1e5) : null;
}

export async function buildCentroids({ outputDir, fetchImpl = fetch, county = 'Boulder' }) {
  const points = {};
  let lastId = 0, rows = 0, pages = 0;
  for (;;) {
    const body = new URLSearchParams({ where: `countyName='${county}' AND OBJECTID>${lastId}`, outFields: 'OBJECTID,parcel_id', orderByFields: 'OBJECTID', returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.00005', geometryPrecision: '6', resultRecordCount: String(PAGE), f: 'json' });
    const response = await fetchImpl(`${COLORADO_PARCELS}/query`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Colorado parcels HTTP ${response.status}`);
    const json = await response.json();
    if (json.error || !Array.isArray(json.features)) throw new Error(`Colorado parcels: ${json.error?.message || 'unexpected response'}`);
    pages++;
    for (const feature of json.features) {
      const folio = String(feature.attributes?.parcel_id ?? '').trim();
      lastId = Math.max(lastId, Number(feature.attributes?.OBJECTID) || 0);
      rows++;
      // Stacked duplicate rows share one polygon; the first is enough.
      if (folio && !points[folio]) { const point = ringCentroid(feature.geometry?.rings); if (point) points[folio] = point; }
    }
    if (json.features.length < PAGE && !json.exceededTransferLimit) break;
    if (!json.features.length) break;
  }
  if (!rows) throw new Error('No Colorado parcel rows returned; centroids not written');
  const fetchedAt = new Date().toISOString();
  const file = { fetchedAt, county, source: COLORADO_PARCELS, attribution: ATTRIBUTION.replace('{date}', fetchedAt.slice(0, 10)), rows, pages, folios: Object.keys(points).length, points };
  await mkdir(outputDir, { recursive: true });
  const temporary = join(outputDir, 'centroids.next.json.gz');
  await writeFile(temporary, gzipSync(JSON.stringify(file), { level: 6 }));
  await rename(temporary, join(outputDir, 'centroids.json.gz'));
  return { fetchedAt, rows, pages, folios: file.folios };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCentroids({ outputDir: resolve('data/land-intelligence/boulder') })
    .then((result) => process.stdout.write(`Boulder centroids: ${result.folios.toLocaleString()} folios from ${result.rows.toLocaleString()} rows in ${result.pages} pages\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
