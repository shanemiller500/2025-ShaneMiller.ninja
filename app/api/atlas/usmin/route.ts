import { NextResponse, type NextRequest } from "next/server";
import { queryUsmin } from "@/utils/geo/usmin-server";

/* ------------------------------------------------------------------ */
/*  USGS USMIN: prospect- and mine-related symbols digitized from the  */
/*  historical USGS topographic maps (shafts, adits, prospect pits,    */
/*  dumps, tailings…), one small box at a time. The USGS service only  */
/*  speaks GML, so it's proxied, turned into GeoJSON and cached.       */
/*                                                                     */
/*  GET /api/atlas/usmin?bbox=w,s,e,n   (≤ 0.5° across)                */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const REVALIDATE = 7 * 86_400;
const MAX_SPAN = 0.5;

export async function GET(req: NextRequest) {
  const box = (req.nextUrl.searchParams.get("bbox") ?? "").split(",").map(Number);
  const [w, s, e, n] = box;
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || e <= w || n <= s || e - w > MAX_SPAN || n - s > MAX_SPAN || Math.abs(s) > 90 || Math.abs(n) > 90) {
    return NextResponse.json({ error: `bbox must be w,s,e,n and at most ${MAX_SPAN}° across` }, { status: 400 });
  }
  try {
    const { points, polygons, truncated } = await queryUsmin([w, s, e, n]);
    return NextResponse.json(
      { type: "FeatureCollection", features: [...polygons, ...points], truncated },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=86400` } }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
