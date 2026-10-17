import { NextResponse, type NextRequest } from "next/server";
import { overpass } from "@/utils/geo/overpass";

/* ------------------------------------------------------------------ */
/*  Abandoned settlements mapped in OpenStreetMap (ODbL), one small    */
/*  box at a time: abandoned:/was: places, ruined and deserted         */
/*  villages, ghost towns.                                             */
/*                                                                     */
/*  GET /api/atlas/osm-abandoned?bbox=w,s,e,n   (≤ 1° across)          */
/*                                                                     */
/*  Overpass wants an identifying User-Agent, so it's proxied and      */
/*  cached a day.                                                      */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const REVALIDATE = 86_400;
const MAX_SPAN = 1;
const SETTLEMENT = /^(city|town|village|hamlet)$/;

/** What kind of place it was, from whichever tag says so. */
function kindOf(t: Record<string, string>): string {
  return t["abandoned:place"] ?? t["was:place"] ?? t["historic:place"] ?? (t.ruins === "village" || t.abandoned === "village" || t.historic === "deserted_village" || t.historic === "village" ? "village" : t.historic === "ghost_town" ? "town" : "settlement");
}

export async function GET(req: NextRequest) {
  const box = (req.nextUrl.searchParams.get("bbox") ?? "").split(",").map(Number);
  const [w, s, e, n] = box;
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || e <= w || n <= s || e - w > MAX_SPAN || n - s > MAX_SPAN || Math.abs(s) > 90 || Math.abs(n) > 90) {
    return NextResponse.json({ error: `bbox must be w,s,e,n and at most ${MAX_SPAN}° across` }, { status: 400 });
  }
  const b = `(${s},${w},${n},${e})`;
  // key-only filters are cheap for Overpass; the exact values are checked below
  const q = `[out:json][timeout:25];(
    nwr["abandoned:place"]${b};
    nwr["was:place"]${b};
    nwr["historic:place"]${b};
    nwr["historic"="ghost_town"]${b};
    nwr["historic"="deserted_village"]${b};
    nwr["ruins"="village"]${b};
    nwr["abandoned"="village"]${b};
  );out center 1500;`;
  try {
    const elements = await overpass(q, REVALIDATE);
    const features: GeoJSON.Feature[] = [];
    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;
      const t = el.tags ?? {};
      const placeTag = t["abandoned:place"] ?? t["was:place"] ?? t["historic:place"];
      if (placeTag && !SETTLEMENT.test(placeTag)) continue; // an abandoned:place=isolated_dwelling is a house, not a town
      features.push({
        type: "Feature",
        id: `${el.type}/${el.id}`,
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {
          osm: `${el.type}/${el.id}`,
          name: t.name ?? t["name:en"] ?? t["old_name"] ?? null,
          kind: kindOf(t),
          wikidata: t.wikidata ?? null,
          wikipedia: t.wikipedia ?? null,
          note: t.description ?? t.note ?? null,
        },
      });
    }
    return NextResponse.json(
      { type: "FeatureCollection", source: "OpenStreetMap contributors (ODbL)", features },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE}` } }
    );
  } catch (err) {
    return NextResponse.json({ type: "FeatureCollection", features: [], error: (err as Error).message }, { status: 502 });
  }
}
