import { NextResponse, type NextRequest } from "next/server";
import { parseUsminGml } from "@/utils/geo/mines";

/* ------------------------------------------------------------------ */
/*  USGS USMIN: prospect- and mine-related symbols digitized from the  */
/*  historical USGS topographic maps (shafts, adits, prospect pits,    */
/*  dumps, tailings…), one small box at a time. The USGS service only  */
/*  speaks GML, so it's proxied, turned into GeoJSON and cached.       */
/*                                                                     */
/*  GET /api/atlas/usmin?bbox=w,s,e,n   (≤ 0.5° across)                */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const WFS = "https://mrdata.usgs.gov/services/wfs/usmin";
const REVALIDATE = 7 * 86_400;
const MAX_SPAN = 0.5;
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };

async function layer(type: "points" | "polygons", w: number, s: number, e: number, n: number, max: number) {
  // WFS 1.1 with EPSG:4326 takes (and returns) latitude first
  const url = `${WFS}?service=WFS&version=1.1.0&request=GetFeature&typeName=${type}&BBOX=${s},${w},${n},${e},EPSG:4326&maxFeatures=${max}`;
  const res = await fetch(url, { headers: UA, next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`USMIN ${type}: HTTP ${res.status}`);
  return parseUsminGml(await res.text(), type);
}

export async function GET(req: NextRequest) {
  const box = (req.nextUrl.searchParams.get("bbox") ?? "").split(",").map(Number);
  const [w, s, e, n] = box;
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || e <= w || n <= s || e - w > MAX_SPAN || n - s > MAX_SPAN || Math.abs(s) > 90 || Math.abs(n) > 90) {
    return NextResponse.json({ error: `bbox must be w,s,e,n and at most ${MAX_SPAN}° across` }, { status: 400 });
  }
  try {
    const [points, polygons] = await Promise.all([layer("points", w, s, e, n, 5000), layer("polygons", w, s, e, n, 2000)]);
    return NextResponse.json(
      { type: "FeatureCollection", features: [...polygons, ...points], truncated: points.length >= 5000 || polygons.length >= 2000 },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=86400` } }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
