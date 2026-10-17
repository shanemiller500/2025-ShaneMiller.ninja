/* ------------------------------------------------------------------ */
/*  "What's in the way" — how many buildings and people sit inside an  */
/*  area (a fire perimeter, a warning polygon, a tornado path, a       */
/*  hurricane cone). The counting happens server-side, as statistics  */
/*  queries, so nothing heavy is downloaded:                           */
/*    · buildings — FEMA USA Structures (every footprint ≥ 450 sq ft)  */
/*    · people + homes — 2020 Census blocks (block groups for areas    */
/*      too big to sum block by block)                                 */
/* ------------------------------------------------------------------ */

const STRUCTURES = "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0/query";
const BLOCKS = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_2020_Redistricting_Blocks/FeatureServer/0/query";
const BLOCK_GROUPS = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_2020_Redistricting_Block_Groups/FeatureServer/0/query";

/** Above this, census blocks are too many to sum quickly — block groups take over. */
const BLOCK_LIMIT_KM2 = 1500;
/** Vertices sent per ring (big perimeters are simplified; counts barely change). */
const MAX_VERTICES = 600;

export type AreaGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface Impact {
  buildings: number;
  /** occupancy class → count (Residential, Commercial, Industrial, …) */
  byClass: Record<string, number>;
  people: number;
  homes: number;
  areaKm2: number;
  /** census unit used for people + homes */
  unit: "block" | "block group";
}

/* ── geometry helpers ────────────────────────────────────────────── */

const rings = (g: AreaGeometry): GeoJSON.Position[][] => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());

/** Spherical area of a lng/lat ring, km². */
function ringArea(ring: GeoJSON.Position[]) {
  const R = 6371.0088;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[i + 1];
    sum += (((l2 - l1) * Math.PI) / 180) * (2 + Math.sin((p1 * Math.PI) / 180) + Math.sin((p2 * Math.PI) / 180));
  }
  return Math.abs((sum * R * R) / 2);
}

export function areaKm2(g: AreaGeometry) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.reduce((a, p) => a + p.reduce((b, r, i) => b + (i === 0 ? ringArea(r) : -ringArea(r)), 0), 0);
}

/** Thin a ring to at most `max` vertices (keeps it closed). */
export function thinRing(ring: GeoJSON.Position[], max = MAX_VERTICES): GeoJSON.Position[] {
  if (ring.length <= max) return ring;
  const step = Math.ceil(ring.length / max);
  const out = ring.filter((_, i) => i % step === 0);
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push(first);
  return out;
}

/** GeoJSON → Esri JSON polygon (rings only; the server works out holes from ring order). */
export function toEsriPolygon(g: AreaGeometry) {
  return { rings: rings(g).map((r) => thinRing(r)), spatialReference: { wkid: 4326 } };
}

/**
 * A tornado path as a polygon: the straight line from touchdown to lift-off, widened to the
 * recorded path width (at least 50 m so a narrow track still covers something).
 */
export function pathPolygon(start: [number, number], end: [number, number] | null, widthYards: number): GeoJSON.Polygon {
  const half = Math.max(25, (widthYards * 0.9144) / 2);
  const lat0 = (start[1] + (end ?? start)[1]) / 2;
  const mx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const my = 110_574;
  if (!end) {
    // no end point: a small circle around the touchdown
    const pts: GeoJSON.Position[] = [];
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * 2 * Math.PI;
      pts.push([start[0] + (Math.cos(a) * half) / mx, start[1] + (Math.sin(a) * half) / my]);
    }
    return { type: "Polygon", coordinates: [pts] };
  }
  const dx = (end[0] - start[0]) * mx;
  const dy = (end[1] - start[1]) * my;
  const len = Math.hypot(dx, dy) || 1;
  // unit normal × half-width, back in degrees
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  const o = (p: [number, number], s: number): GeoJSON.Position => [p[0] + (s * nx) / mx, p[1] + (s * ny) / my];
  return { type: "Polygon", coordinates: [[o(start, 1), o(end, 1), o(end, -1), o(start, -1), o(start, 1)]] };
}

/* ── the counts ──────────────────────────────────────────────────── */

async function post(url: string, params: Record<string, string>, signal?: AbortSignal) {
  // POST: big perimeters don't fit in a URL
  const res = await fetch(url, { method: "POST", body: new URLSearchParams({ ...params, f: "json" }), signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { features?: { attributes: Record<string, unknown> }[]; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.features ?? [];
}

export async function impactIn(g: AreaGeometry, signal?: AbortSignal): Promise<Impact> {
  const geometry = JSON.stringify(toEsriPolygon(g));
  const area = areaKm2(g);
  const unit: Impact["unit"] = area > BLOCK_LIMIT_KM2 ? "block group" : "block";
  const common = { geometry, geometryType: "esriGeometryPolygon", inSR: "4326", spatialRel: "esriSpatialRelIntersects" };
  const [classes, census] = await Promise.all([
    post(
      STRUCTURES,
      {
        ...common,
        outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" }]),
        groupByFieldsForStatistics: "OCC_CLS",
      },
      signal
    ),
    post(
      unit === "block" ? BLOCKS : BLOCK_GROUPS,
      {
        ...common,
        outStatistics: JSON.stringify([
          { statisticType: "sum", onStatisticField: "P0010001", outStatisticFieldName: "people" },
          { statisticType: "sum", onStatisticField: "H0010001", outStatisticFieldName: "homes" },
        ]),
      },
      signal
    ),
  ]);
  const byClass: Record<string, number> = {};
  let buildings = 0;
  for (const { attributes: a } of classes) {
    const n = Number(a.n) || 0;
    const k = String(a.OCC_CLS ?? "Unclassified") || "Unclassified";
    byClass[k] = (byClass[k] ?? 0) + n;
    buildings += n;
  }
  const c = census[0]?.attributes ?? {};
  return { buildings, byClass, people: Math.round(Number(c.people) || 0), homes: Math.round(Number(c.homes) || 0), areaKm2: area, unit };
}
