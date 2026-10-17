import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Satellite fire detections, last 24 h, worldwide (NASA FIRMS,       */
/*  VIIRS on NOAA-20). ~100k a day, so they go out column-wise and     */
/*  the page rebuilds GeoJSON (utils/geo/hazards.ts → hotspotFeatures).*/
/*  Low-confidence pixels are left out.                                */
/*                                                                     */
/*  GET /api/atlas/firms                                               */
/*                                                                     */
/*  FIRMS' public CSVs carry no CORS header, so they're proxied. A     */
/*  detection is a ~375 m pixel that was hot: usually a fire, but it   */
/*  can be a gas flare or an industrial heat source.                   */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const CSV = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv";
const REVALIDATE = 900;

export async function GET() {
  try {
    // ~10 MB: too big for Next's data cache, so the CDN caches our slim answer instead
    const res = await fetch(CSV, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
    if (!res.ok) throw new Error(`FIRMS: HTTP ${res.status}`);
    const [header, ...rows] = (await res.text()).trim().split("\n");
    const col = Object.fromEntries(header.split(",").map((h, i) => [h.trim(), i]));
    const cols = { lng: [] as number[], lat: [] as number[], frp: [] as number[], conf: [] as string[], t: [] as number[], day: [] as number[] };
    for (const row of rows) {
      const c = row.split(",");
      const conf = (c[col.confidence] ?? "").trim();
      if (conf === "low" || conf === "l") continue;
      const lat = Number(c[col.latitude]);
      const lng = Number(c[col.longitude]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const hhmm = (c[col.acq_time] ?? "").padStart(4, "0");
      const t = Date.parse(`${c[col.acq_date]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`);
      cols.lng.push(Math.round(lng * 1e3) / 1e3);
      cols.lat.push(Math.round(lat * 1e3) / 1e3);
      cols.frp.push(Math.round(Number(c[col.frp]) * 10) / 10 || 0);
      cols.conf.push(conf === "high" || conf === "h" ? "h" : "n");
      cols.t.push(Number.isFinite(t) ? Math.round(t / 60_000) : 0);
      cols.day.push(c[col.daynight]?.trim() === "D" ? 1 : 0);
    }
    return NextResponse.json(
      { source: "NASA FIRMS · VIIRS NOAA-20 · last 24 h · worldwide (nominal + high confidence)", cols },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=3600` } }
    );
  } catch (e) {
    return NextResponse.json({ cols: null, error: (e as Error).message }, { status: 502 });
  }
}
