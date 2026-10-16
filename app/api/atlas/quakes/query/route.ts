import { NextResponse } from "next/server";
import { FDSN_LIMIT, FDSN_QUERY, parseQuakeCsv } from "@/utils/geo/quakes";

/* ------------------------------------------------------------------ */
/*  Historical earthquakes from the USGS ComCat catalog (FDSN).        */
/*                                                                     */
/*  GET /api/atlas/quakes/query?start=2025-10-16&minmag=4.5            */
/*      [&end=…]                       default: now                    */
/*      [&bbox=w,s,e,n]                a box (w > e crosses 180°)      */
/*      [&lat=…&lng=…&radius=km]       or a circle (aftershocks)       */
/*                                                                     */
/*  World-wide queries must be thin enough to stay well under USGS's   */
/*  20,000-event cap; regional ones can go small. Past-only queries    */
/*  are cached for a day, anything touching "now" for 5 minutes.       */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const DAY = 86_400_000;

const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400, headers: { "Cache-Control": "no-store" } });

const parseTime = (v: string | null) => {
  if (!v) return null;
  const t = /^-?\d+$/.test(v) ? Number(v) : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/** Is a world-wide query thin enough? (~ under 10k events) */
function worldOk(spanDays: number, minmag: number) {
  return (minmag >= 2.5 && spanDays <= 35) || (minmag >= 4.5 && spanDays <= 400) || (minmag >= 5.5 && spanDays <= 4000) || minmag >= 6.5;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const now = Date.now();
  const start = parseTime(sp.get("start"));
  const end = Math.min(parseTime(sp.get("end")) ?? now, now);
  const minmag = parseFloat(sp.get("minmag") ?? "");
  if (start == null || start >= end) return bad("start must be a date before end");
  if (start < Date.parse("1800-01-01")) return bad("start is too early");
  if (!Number.isFinite(minmag) || minmag < 0 || minmag > 10) return bad("minmag must be 0–10");

  const q = new URLSearchParams({
    format: "csv",
    starttime: new Date(start).toISOString(),
    endtime: new Date(end).toISOString(),
    minmagnitude: String(minmag),
    orderby: "time-asc",
    limit: String(FDSN_LIMIT),
    eventtype: "earthquake",
  });

  const bbox = sp.get("bbox")?.split(",").map(Number);
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  const radius = parseFloat(sp.get("radius") ?? "");
  let regional = false;

  if (bbox) {
    if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) return bad("bbox must be w,s,e,n");
    const [w, s, e, n] = bbox;
    if (s >= n || s < -90 || n > 90) return bad("bbox latitudes are out of range");
    q.set("minlatitude", String(s));
    q.set("maxlatitude", String(n));
    q.set("minlongitude", String(w));
    // FDSN accepts longitudes up to 360 — that's how a box crosses the antimeridian
    q.set("maxlongitude", String(e < w ? e + 360 : e));
    regional = (e < w ? e + 360 - w : e - w) <= 60 && n - s <= 60;
  } else if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius)) {
    if (radius <= 0 || radius > 2000) return bad("radius must be 1–2000 km");
    q.set("latitude", String(lat));
    q.set("longitude", String(lng));
    q.set("maxradiuskm", String(radius));
    regional = radius <= 1000;
  }

  if (!regional && !worldOk((end - start) / DAY, minmag)) {
    return bad("Too many earthquakes for one map — raise minmag, shorten the window or pick a region.");
  }

  const past = now - end > 2 * DAY;
  try {
    const res = await fetch(`${FDSN_QUERY}?${q}`, { next: { revalidate: past ? 86_400 : 300 }, signal: AbortSignal.timeout(45_000) });
    // 204 = no events
    const features = res.status === 204 ? [] : res.ok ? parseQuakeCsv(await res.text()) : null;
    if (!features) throw new Error(`USGS catalog: HTTP ${res.status}`);
    return NextResponse.json(
      { type: "FeatureCollection", features, count: features.length, truncated: features.length >= FDSN_LIMIT, start, end, minmag },
      { headers: { "Cache-Control": `public, s-maxage=${past ? 86_400 : 300}, stale-while-revalidate=86400` } }
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "USGS catalog unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
