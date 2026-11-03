import { NextRequest, NextResponse } from "next/server";
import { marketContext } from "@/app/land-intelligence/market-data";
import { validPoint } from "@/app/land-intelligence/zoning-lookup";

export const runtime = "nodejs";

/** Housing market context at any U.S. point: ACS housing, FHFA price index, building permits, mortgage rates, HUD rents. */
export async function GET(request: NextRequest) {
  const lng = Number(request.nextUrl.searchParams.get("lng")), lat = Number(request.nextUrl.searchParams.get("lat"));
  if (!validPoint(lng, lat)) return NextResponse.json({ error: "A U.S. map point is required." }, { status: 400 });
  try {
    const context = await marketContext(lng, lat);
    if (!context) return NextResponse.json({ error: "No U.S. state or county was found at this point." }, { status: 404 });
    // Federal files change at most monthly; geography and rates are cached server-side.
    return NextResponse.json(context, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Market data could not be loaded. The Census geography service may be unavailable." }, { status: 503 });
  }
}
