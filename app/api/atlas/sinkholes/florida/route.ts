import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Florida Geological Survey subsidence incident reports (FDEP),      */
/*  slimmed to GeoJSON for the Underground USA map.                    */
/*                                                                     */
/*  GET /api/atlas/sinkholes/florida                                   */
/*                                                                     */
/*  Note from FGS: most reports are NOT verified by a geologist —      */
/*  `verified` keeps that distinction (Y yes / N no / U unknown).      */
/*  The list changes slowly, so it's cached for a day.                 */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const SERVICE = "https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/FGS_SUBSIDENCE/MapServer/0/query";
const PAGE = 1000;
const FIELDS = "OBJECTID,REF_NUM,EVENT_DATE,TRUE_SINK,COUNTY,ACCURACY,SINLNGTH,SINWIDTH,SINDEPTH,PROPDAM,COMMENTS,COMMENTS_2";

interface Attrs {
  OBJECTID: number;
  REF_NUM: string | null;
  EVENT_DATE: number | null;
  TRUE_SINK: string | null;
  COUNTY: string | null;
  ACCURACY: string | null;
  SINLNGTH: number | null;
  SINWIDTH: number | null;
  SINDEPTH: number | null;
  PROPDAM: string | null;
  COMMENTS: string | null;
  COMMENTS_2: string | null;
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export async function GET() {
  try {
    const features: GeoJSON.Feature[] = [];
    for (let offset = 0; offset < 50_000; offset += PAGE) {
      const q = new URLSearchParams({
        where: "1=1",
        outFields: FIELDS,
        orderByFields: "OBJECTID",
        resultOffset: String(offset),
        resultRecordCount: String(PAGE),
        outSR: "4326",
        f: "json",
      });
      const res = await fetch(`${SERVICE}?${q}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`FGS: HTTP ${res.status}`);
      const page = (await res.json()) as { features?: { attributes: Attrs; geometry?: { x: number; y: number } }[]; exceededTransferLimit?: boolean; error?: { message: string } };
      if (page.error) throw new Error(page.error.message);
      for (const f of page.features ?? []) {
        const a = f.attributes;
        if (!f.geometry || !Number.isFinite(f.geometry.x)) continue;
        const verified = a.TRUE_SINK === "Y" ? "Y" : a.TRUE_SINK === "N" ? "N" : "U";
        const notes = [clean(a.COMMENTS), clean(a.COMMENTS_2)].filter(Boolean).join(" ");
        features.push({
          type: "Feature",
          id: a.OBJECTID,
          geometry: { type: "Point", coordinates: [Math.round(f.geometry.x * 1e5) / 1e5, Math.round(f.geometry.y * 1e5) / 1e5] },
          properties: {
            id: a.OBJECTID,
            ref: clean(a.REF_NUM),
            date: a.EVENT_DATE,
            verified,
            county: clean(a.COUNTY),
            accuracy: clean(a.ACCURACY),
            lengthFt: a.SINLNGTH,
            widthFt: a.SINWIDTH,
            depthFt: a.SINDEPTH,
            damage: clean(a.PROPDAM),
            notes: notes ? notes.slice(0, 240) : null,
          },
        });
      }
      if (!page.exceededTransferLimit && (page.features?.length ?? 0) < PAGE) break;
    }
    return NextResponse.json(
      { type: "FeatureCollection", features, source: "FDEP · Florida Geological Survey — Subsidence Incident Reports" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Florida sinkhole data unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
