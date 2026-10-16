import { NextResponse } from "next/server";
import { CODE_RANK, GVP_CONTINUING, GVP_WFS, HANS_ELEVATED, HANS_MONITORED, type ColorCode, type VolcanoDetail } from "@/utils/geo/volcanoes";

/* ------------------------------------------------------------------ */
/*  One volcano: GVP profile (summary, photo, setting) plus the latest */
/*  USGS notice when it's a U.S.-monitored volcano.                    */
/*                                                                     */
/*  GET /api/atlas/volcano/321050                                      */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

interface HansRow {
  vnum: string | null;
  color_code: string;
  alert_level: string;
  sent_utc: string;
  sent_unixtime: number;
  obs_fullname: string;
  notice_url: string;
}

const str = (v: unknown) => (v == null ? "" : String(v));

export async function GET(_req: Request, { params }: { params: Promise<{ vnum: string }> }) {
  const { vnum } = await params;
  if (!/^\d{6}$/.test(vnum)) return NextResponse.json({ error: "Bad volcano number" }, { status: 400 });

  try {
    const [gvpRes, hans, ongoing] = await Promise.all([
      fetch(`${GVP_WFS}&CQL_FILTER=Volcano_Number=${vnum}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(15_000) }),
      Promise.allSettled(
        [HANS_MONITORED, HANS_ELEVATED].map((u) => fetch(u, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? (r.json() as Promise<HansRow[]>) : [])))
      ),
      fetch(GVP_CONTINUING, { next: { revalidate: 3_600 }, signal: AbortSignal.timeout(15_000) })
        .then((r) => (r.ok ? r.json() : { features: [] }))
        .then((j: { features: { properties: { VolcanoNumber: number; StartDate: string } }[] }) =>
          j.features.filter((x) => String(x.properties.VolcanoNumber) === vnum).map((x) => x.properties.StartDate).sort().pop() ?? null
        )
        .catch(() => null),
    ]);
    if (!gvpRes.ok) throw new Error(`GVP: HTTP ${gvpRes.status}`);
    const f = (await gvpRes.json()).features?.[0];
    if (!f) return NextResponse.json({ error: "Volcano not found" }, { status: 404 });
    const p = f.properties as Record<string, unknown>;

    const notices = hans
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((r) => r.vnum === vnum && (r.color_code?.toUpperCase() as ColorCode) in CODE_RANK)
      .sort((a, b) => b.sent_unixtime - a.sent_unixtime);
    const latest = notices[0];
    const code = latest ? (latest.color_code.toUpperCase() as ColorCode) : null;

    const detail: VolcanoDetail = {
      vnum: Number(vnum),
      name: str(p.Volcano_Name),
      type: str(p.Primary_Volcano_Type),
      lastEruption: (p.Last_Eruption_Year as number) ?? null,
      country: str(p.Country),
      elevation: (p.Elevation as number) ?? null,
      code,
      level: latest?.alert_level ?? null,
      rank: code ? CODE_RANK[code] : 0,
      erupting: ongoing != null,
      eruptingSince: ongoing,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      landform: str(p.Volcanic_Landform),
      region: str(p.Region),
      subregion: str(p.Subregion),
      summary: str(p.Geological_Summary),
      tectonic: str(p.Tectonic_Setting),
      rock: str(p.Major_Rock_Type),
      photo: p.Primary_Photo_Link
        ? { url: str(p.Primary_Photo_Link), caption: str(p.Primary_Photo_Caption), credit: str(p.Primary_Photo_Credit) }
        : null,
      notice: latest ? { url: latest.notice_url, sent: latest.sent_utc, observatory: latest.obs_fullname } : null,
    };
    return NextResponse.json(detail, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Volcano data unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
