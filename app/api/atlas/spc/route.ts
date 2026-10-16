import { NextResponse } from "next/server";
import { REPORT_KINDS, parseSpcCsv } from "@/utils/geo/hazards";

/* ------------------------------------------------------------------ */
/*  NOAA Storm Prediction Center reports (tornado / wind / hail),      */
/*  today + yesterday, as GeoJSON for the Disaster Atlas.              */
/*                                                                     */
/*  GET /api/atlas/spc                                                 */
/*                                                                     */
/*  The CSVs usually allow cross-origin reads, but not reliably from   */
/*  every browser cache — so they're proxied (and cached 5 minutes).   */
/*  A missing file just means no reports of that kind.                 */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const REVALIDATE = 300;

export async function GET() {
  const jobs = (["today", "yesterday"] as const).flatMap((day) =>
    REPORT_KINDS.map(async (k) => {
      try {
        const res = await fetch(`https://www.spc.noaa.gov/climo/reports/${day}_${k.file}.csv`, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(20_000) });
        return res.ok ? parseSpcCsv(await res.text(), k.key, day) : [];
      } catch {
        return null;
      }
    })
  );
  const parts = await Promise.all(jobs);
  if (parts.every((p) => p === null)) return NextResponse.json({ type: "FeatureCollection", features: [], error: "SPC unreachable" }, { status: 502 });
  return NextResponse.json(
    { type: "FeatureCollection", source: "NOAA Storm Prediction Center (preliminary reports)", features: parts.flatMap((p) => p ?? []) },
    { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=900` } }
  );
}
