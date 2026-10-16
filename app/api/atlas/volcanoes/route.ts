import { NextResponse } from "next/server";
import { CODE_RANK, GVP_CONTINUING, GVP_WFS, HANS_ELEVATED, HANS_MONITORED, type ColorCode, type VolcanoCollection } from "@/utils/geo/volcanoes";

/* ------------------------------------------------------------------ */
/*  World Holocene volcanoes (Smithsonian GVP) with live USGS colour   */
/*  codes merged in for U.S. volcanoes.                                */
/*                                                                     */
/*  GET /api/atlas/volcanoes                                           */
/*                                                                     */
/*  The GVP list changes a few times a year (cached a day); USGS       */
/*  alerts can change any time (cached 10 minutes).                    */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const FIELDS = "Volcano_Number,Volcano_Name,Primary_Volcano_Type,Last_Eruption_Year,Country,Elevation,GeoLocation";

interface HansRow {
  vnum: string | null;
  color_code: string;
  alert_level: string;
  sent_unixtime: number;
}

async function hansCodes() {
  const codes = new Map<number, { code: ColorCode; level: string; at: number }>();
  const take = (rows: HansRow[]) => {
    for (const r of rows) {
      const vnum = Number(r.vnum);
      const code = r.color_code?.toUpperCase() as ColorCode;
      if (!vnum || !(code in CODE_RANK)) continue;
      const prev = codes.get(vnum);
      if (!prev || r.sent_unixtime >= prev.at) codes.set(vnum, { code, level: r.alert_level, at: r.sent_unixtime });
    }
  };
  const [monitored, elevated] = await Promise.allSettled(
    [HANS_MONITORED, HANS_ELEVATED].map((u) => fetch(u, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? r.json() : [])))
  );
  if (monitored.status === "fulfilled") take(monitored.value);
  // the elevated list is the authoritative "right now" — apply it last
  if (elevated.status === "fulfilled") take(elevated.value);
  return codes;
}

/** vnum → start date of each eruption Smithsonian lists as ongoing. */
async function continuingEruptions() {
  const res = await fetch(GVP_CONTINUING, { next: { revalidate: 3_600 }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return new Map<number, string>();
  const json = (await res.json()) as { features: { properties: { VolcanoNumber: number; StartDate: string } }[] };
  const out = new Map<number, string>();
  for (const f of json.features) {
    const prev = out.get(f.properties.VolcanoNumber);
    if (!prev || f.properties.StartDate > prev) out.set(f.properties.VolcanoNumber, f.properties.StartDate);
  }
  return out;
}

export async function GET() {
  try {
    const [gvpRes, codes, erupting] = await Promise.all([
      fetch(`${GVP_WFS}&propertyName=${FIELDS}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(20_000) }),
      hansCodes().catch(() => new Map()),
      continuingEruptions().catch(() => new Map<number, string>()),
    ]);
    if (!gvpRes.ok) throw new Error(`GVP: HTTP ${gvpRes.status}`);
    const gvp = await gvpRes.json();

    const out: VolcanoCollection = {
      type: "FeatureCollection",
      features: (gvp.features as { geometry: { coordinates: number[] }; properties: Record<string, unknown> }[])
        .filter((f) => f.geometry?.coordinates)
        .map((f) => {
          const p = f.properties;
          const vnum = Number(p.Volcano_Number);
          const hans = codes.get(vnum);
          return {
            type: "Feature" as const,
            id: vnum,
            geometry: { type: "Point" as const, coordinates: f.geometry.coordinates.slice(0, 2) },
            properties: {
              vnum,
              name: String(p.Volcano_Name),
              type: String(p.Primary_Volcano_Type ?? ""),
              lastEruption: (p.Last_Eruption_Year as number) ?? null,
              country: String(p.Country ?? ""),
              elevation: (p.Elevation as number) ?? null,
              code: hans?.code ?? null,
              level: hans?.level ?? null,
              rank: hans ? CODE_RANK[hans.code as ColorCode] : 0,
              erupting: erupting.has(vnum),
              eruptingSince: erupting.get(vnum) ?? null,
            },
          };
        })
        // elevated volcanoes last so they draw on top
        .sort((a, b) => a.properties.rank - b.properties.rank),
    };
    return NextResponse.json(out, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Volcano data unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
