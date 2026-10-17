import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Disasters happening now, worldwide — GDACS (Global Disaster Alert  */
/*  and Coordination System, UN + European Commission): earthquakes,   */
/*  tropical cyclones, floods, volcanoes, droughts and wildfires, with */
/*  a green / orange / red alert for likely humanitarian impact.       */
/*                                                                     */
/*  GET /api/atlas/gdacs                                               */
/*                                                                     */
/*  The search API pages 100 events at a time; we walk the last three  */
/*  weeks, keep only events GDACS still marks current, and slim them.  */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const API = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";
const REVALIDATE = 600;
const MAX_PAGES = 8;

interface GdacsProps {
  eventtype: string;
  eventid: number;
  episodeid: number;
  name: string;
  eventname?: string;
  alertlevel: string;
  country?: string;
  iso3?: string;
  fromdate: string;
  todate: string;
  iscurrent: string;
  source?: string;
  severitydata?: { severitytext?: string };
  url?: { report?: string };
}

export async function GET() {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date();
  const from = new Date(to.getTime() - 21 * 86_400_000);
  const seen = new Map<string, GeoJSON.Feature>();
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const q = `eventlist=EQ;TC;FL;VO;DR;WF&fromDate=${day(from)}&toDate=${day(to)}&alertlevel=green;orange;red&pageNumber=${page}`;
      const res = await fetch(`${API}?${q}`, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(25_000) });
      // GDACS answers an empty page with a 404
      if (res.status === 404) break;
      if (!res.ok) throw new Error(`GDACS: HTTP ${res.status}`);
      const j = (await res.json()) as { features?: GeoJSON.Feature<GeoJSON.Point, GdacsProps>[] };
      const feats = j.features ?? [];
      for (const f of feats) {
        const p = f.properties;
        if (p.iscurrent !== "true" || f.geometry?.type !== "Point") continue;
        const key = `${p.eventtype}-${p.eventid}`;
        const prev = seen.get(key);
        // keep the newest episode of each event
        if (prev && Number(prev.properties?.episode) >= p.episodeid) continue;
        seen.set(key, {
          type: "Feature",
          id: key,
          geometry: f.geometry,
          properties: {
            id: key,
            type: p.eventtype,
            level: p.alertlevel,
            name: p.name,
            short: p.eventname ?? null,
            country: p.country || null,
            iso3: p.iso3 || null,
            from: p.fromdate,
            to: p.todate,
            severity: p.severitydata?.severitytext ?? null,
            source: p.source ?? null,
            report: p.url?.report ?? null,
            episode: p.episodeid,
          },
        });
      }
      if (feats.length < 100) break;
    }
    return NextResponse.json(
      { type: "FeatureCollection", source: "GDACS — Global Disaster Alert and Coordination System", features: Array.from(seen.values()) },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=1800` } }
    );
  } catch (e) {
    return NextResponse.json({ type: "FeatureCollection", features: [], error: (e as Error).message }, { status: 502 });
  }
}
