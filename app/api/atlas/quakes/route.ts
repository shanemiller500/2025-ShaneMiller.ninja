import { NextResponse } from "next/server";
import { clampQuakeMin, QUAKE_MINS, QUAKE_WINDOWS, quakeFeedUrl, slimQuakeFeed, type QuakeMin, type QuakeWindow } from "@/utils/geo/quakes";

/* ------------------------------------------------------------------ */
/*  Live USGS earthquakes, slimmed for the atlas map.                  */
/*                                                                     */
/*  GET /api/atlas/quakes?window=day&min=2.5                           */
/*    window: hour | day | week | month   (default day)                */
/*    min:    all | 2.5 | 4.5 | significant (default all;              */
/*            a month of "all" is coerced to 2.5 — the feed is ~7 MB)  */
/*                                                                     */
/*  USGS regenerates the feeds every minute, so we cache for 60 s.     */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const window = (QUAKE_WINDOWS as string[]).includes(sp.get("window") ?? "") ? (sp.get("window") as QuakeWindow) : "day";
  const asked = (QUAKE_MINS as string[]).includes(sp.get("min") ?? "") ? (sp.get("min") as QuakeMin) : "all";
  const min = clampQuakeMin(window, asked);

  try {
    const res = await fetch(quakeFeedUrl(window, min), { next: { revalidate: 60 }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`USGS feed: HTTP ${res.status}`);
    const feed = slimQuakeFeed(await res.json());
    return NextResponse.json(
      { ...feed, window, min },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "USGS feed unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
