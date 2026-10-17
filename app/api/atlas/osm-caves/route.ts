import { NextResponse, type NextRequest } from "next/server";

/* ------------------------------------------------------------------ */
/*  Cave entrances mapped in OpenStreetMap (ODbL) for one small box.   */
/*                                                                     */
/*  GET /api/atlas/osm-caves?bbox=w,s,e,n   (≤ 1° across)              */
/*                                                                     */
/*  Overpass wants an identifying User-Agent, so it's proxied and      */
/*  cached a day. Entrances tagged access=no / private are left out.   */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "shanemiller.ninja atlas (+https://shanemiller.ninja)";
const REVALIDATE = 86_400;
const MAX_SPAN = 1;

export async function GET(req: NextRequest) {
  const box = (req.nextUrl.searchParams.get("bbox") ?? "").split(",").map(Number);
  const [w, s, e, n] = box;
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || e <= w || n <= s || e - w > MAX_SPAN || n - s > MAX_SPAN || Math.abs(s) > 90 || Math.abs(n) > 90) {
    return NextResponse.json({ error: `bbox must be w,s,e,n and at most ${MAX_SPAN}° across` }, { status: 400 });
  }
  const q = `[out:json][timeout:25];node["natural"="cave_entrance"]["access"!~"^(no|private)$"](${s},${w},${n},${e});out 2000;`;
  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(q)}`,
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Overpass: HTTP ${res.status}`);
    const j = (await res.json()) as { elements: { id: number; lat: number; lon: number; tags?: Record<string, string> }[] };
    const features: GeoJSON.Feature[] = j.elements.map((el) => {
      const t = el.tags ?? {};
      return {
        type: "Feature",
        id: el.id,
        geometry: { type: "Point", coordinates: [el.lon, el.lat] },
        properties: {
          osm: el.id,
          name: t.name ?? t["name:en"] ?? null,
          ele: t.ele ? Number.parseFloat(t.ele) || null : null,
          access: t.access ?? null,
          fee: t.fee ?? null,
          show: t.tourism === "attraction" || t.fee === "yes" || /show ?cave|tour/i.test(`${t.description ?? ""} ${t.cave ?? ""}`),
          wikidata: t.wikidata ?? null,
        },
      };
    });
    return NextResponse.json(
      { type: "FeatureCollection", source: "OpenStreetMap contributors (ODbL)", features },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE}` } }
    );
  } catch (err) {
    return NextResponse.json({ type: "FeatureCollection", features: [], error: (err as Error).message }, { status: 502 });
  }
}
