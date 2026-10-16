import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Satellite fire detections, last 24 h (NASA FIRMS, VIIRS on         */
/*  NOAA-20), lower 48 + Hawaii, slimmed to GeoJSON points.            */
/*                                                                     */
/*  GET /api/atlas/firms                                               */
/*                                                                     */
/*  FIRMS' public CSVs carry no CORS header, so they're proxied. A     */
/*  detection is a ~375 m pixel that was hot: usually a fire, but it   */
/*  can be a gas flare or an industrial heat source.                   */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const CSV = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv";
const REVALIDATE = 900;

export async function GET() {
  try {
    const res = await fetch(CSV, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`FIRMS: HTTP ${res.status}`);
    const [header, ...rows] = (await res.text()).trim().split("\n");
    const col = Object.fromEntries(header.split(",").map((h, i) => [h.trim(), i]));
    const features: GeoJSON.Feature[] = [];
    for (const row of rows) {
      const c = row.split(",");
      const lat = Number(c[col.latitude]);
      const lng = Number(c[col.longitude]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const t = (c[col.acq_time] ?? "").padStart(4, "0");
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [Math.round(lng * 1e3) / 1e3, Math.round(lat * 1e3) / 1e3] },
        properties: {
          frp: Math.round(Number(c[col.frp]) * 10) / 10 || 0,
          conf: c[col.confidence] ?? "",
          when: `${c[col.acq_date]}T${t.slice(0, 2)}:${t.slice(2)}Z`,
          day: c[col.daynight]?.trim() === "D",
        },
      });
    }
    return NextResponse.json(
      { type: "FeatureCollection", source: "NASA FIRMS · VIIRS NOAA-20 · last 24 h", features },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=3600` } }
    );
  } catch (e) {
    return NextResponse.json({ type: "FeatureCollection", features: [], error: (e as Error).message }, { status: 502 });
  }
}
