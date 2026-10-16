import { NextResponse } from "next/server";
import { faultingStyle, type QuakeDetail } from "@/utils/geo/quakes";

/* ------------------------------------------------------------------ */
/*  One earthquake's details, pulled from its USGS product list:       */
/*  ShakeMap image, "Did You Feel It?", PAGER alert, focal mechanism.  */
/*                                                                     */
/*  GET /api/atlas/quake/us6000u214                                    */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

type Product = { properties?: Record<string, string>; contents?: Record<string, { url: string }> };

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9_-]{4,40}$/i.test(id)) return NextResponse.json({ error: "Bad event id" }, { status: 400 });

  try {
    const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${id}&format=geojson`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404 || res.status === 204) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (!res.ok) throw new Error(`USGS event: HTTP ${res.status}`);
    const ev = await res.json();
    const p = ev.properties;
    const products = (p.products ?? {}) as Record<string, Product[]>;
    const [lng, lat, depth] = ev.geometry.coordinates as number[];

    const sm = products.shakemap?.[0];
    const shakeImage = sm?.contents?.["download/intensity.jpg"]?.url;
    const mt = products["moment-tensor"]?.[0]?.properties ?? products["focal-mechanism"]?.[0]?.properties;
    const strike = num(mt?.["nodal-plane-1-strike"]);
    const dip = num(mt?.["nodal-plane-1-dip"]);
    const rake = num(mt?.["nodal-plane-1-rake"] ?? mt?.["nodal-plane-1-slip"]);

    const detail: QuakeDetail = {
      id: ev.id,
      title: p.title,
      mag: num(p.mag) ?? 0,
      magType: p.magType ?? "",
      place: p.place ?? "",
      time: p.time,
      depth: Math.round((depth ?? 0) * 10) / 10,
      lng,
      lat,
      url: p.url,
      tsunami: !!p.tsunami,
      alert: p.alert ?? null,
      felt: p.felt ?? null,
      cdi: num(p.cdi),
      mmi: num(p.mmi),
      status: p.status ?? "",
      shakemap: shakeImage ? { image: shakeImage, legend: sm?.contents?.["download/mmi_legend.png"]?.url } : null,
      mechanism: strike != null && dip != null && rake != null ? { strike, dip, rake, style: faultingStyle(rake) } : null,
      products: Object.keys(products),
    };
    return NextResponse.json(detail, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "USGS unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
