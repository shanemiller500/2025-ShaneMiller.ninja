/* ------------------------------------------------------------------ */
/*  Distances for "near me" and nearest-first lists, shared by every   */
/*  atlas map. Plain great-circle maths — works the same anywhere on   */
/*  Earth.                                                             */
/* ------------------------------------------------------------------ */

/** Great-circle distance in km between two [lng, lat] points. */
export function kmBetween(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "3.4 km", "212 km", "1,840 km". */
export const fmtKm = (km: number) => (km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString("en-US")} km`);

/**
 * The `n` items nearest to `at` (optionally within `maxKm`), nearest first.
 * A cheap lat/lng box check skips most far items before the real distance.
 */
export function nearest<T>(items: readonly T[], at: [number, number], pos: (item: T) => [number, number] | null, n: number, maxKm = Infinity): { item: T; km: number }[] {
  const out: { item: T; km: number }[] = [];
  const latBox = maxKm === Infinity ? Infinity : maxKm / 111 + 0.1;
  let worst = maxKm;
  for (let k = 0; k < items.length; k++) {
    const item = items[k];
    const p = pos(item);
    if (!p || Math.abs(p[1] - at[1]) > latBox) continue;
    const km = kmBetween(at, p);
    if (km > worst) continue;
    out.push({ item, km });
    if (out.length > n * 4) {
      out.sort((a, b) => a.km - b.km);
      out.length = n;
      worst = out[n - 1].km;
    }
  }
  return out.sort((a, b) => a.km - b.km).slice(0, n);
}

/** Is `at` inside this (Multi)Polygon? Ray casting; holes count as outside. */
export function pointInFeature(at: [number, number], g: GeoJSON.Geometry | null | undefined): boolean {
  if (!g) return false;
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > at[1] !== yj > at[1] && at[0] < ((xj - xi) * (at[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const inPoly = (rings: number[][][]) => rings.length > 0 && inRing(rings[0]) && !rings.slice(1).some(inRing);
  if (g.type === "Polygon") return inPoly(g.coordinates);
  if (g.type === "MultiPolygon") return g.coordinates.some(inPoly);
  if (g.type === "GeometryCollection") return g.geometries.some((x) => pointInFeature(at, x));
  return false;
}
