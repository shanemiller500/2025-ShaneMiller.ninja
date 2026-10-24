import { NextRequest, NextResponse } from "next/server";

const SDA = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest";

async function sda(query: string): Promise<unknown[][]> {
  const response = await fetch(SDA, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ QUERY: query, FORMAT: "JSON+COLUMNNAME" }), signal: AbortSignal.timeout(14000), cache: "no-store" });
  if (!response.ok) throw new Error(`NRCS HTTP ${response.status}`);
  const json = await response.json();
  if (json.error || json.Error) throw new Error("The soil properties were unavailable.");
  // An empty result comes back without a Table.
  return Array.isArray(json.Table) ? json.Table.slice(1).filter(Array.isArray) : [];
}

const components = async (key: string) => (await sda(`SELECT TOP 8 compname, comppct_r, hydricrating, drainagecl, taxclname, slope_r FROM component WHERE mukey = '${key}' ORDER BY comppct_r DESC`)).map((row) => ({
  name: String(row[0] ?? ""), percentage: row[1] == null || row[1] === "" ? null : Number(row[1]), hydric: String(row[2] ?? ""), drainage: String(row[3] ?? ""), classification: String(row[4] ?? ""), slopePercent: row[5] == null || row[5] === "" ? null : Number(row[5]),
}));
const note = "Component percentages and ratings describe the mapped unit, not a sampled point. Field conditions can vary.";

// ?mukey= for a clicked soil polygon, or ?lng=&lat= for the map unit under a point (no soil layer needed).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.has("lng") || params.has("lat")) {
    const lng = Number(params.get("lng")), lat = Number(params.get("lat"));
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > -64 || lat < 17 || lat > 72) return NextResponse.json({ error: "A U.S. map point is required." }, { status: 400 });
    try {
      // Coordinates are validated numbers, so the WKT literal cannot carry SQL.
      const [unit] = await sda(`SELECT TOP 1 M.mukey, M.musym, M.muname, M.farmlndcl FROM mapunit M WHERE M.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lng.toFixed(6)} ${lat.toFixed(6)})'))`);
      if (!unit) return NextResponse.json({ unit: null, components: [], note: "No soil survey map unit at this point." });
      const key = String(unit[0] ?? "");
      return NextResponse.json({ unit: { mukey: key, symbol: String(unit[1] ?? ""), name: String(unit[2] ?? ""), farmland: String(unit[3] ?? "") }, components: /^\d{1,12}$/.test(key) ? await components(key) : [], note }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
    } catch { return NextResponse.json({ error: "NRCS soil data is temporarily unavailable." }, { status: 502 }); }
  }
  const key = params.get("mukey") ?? "";
  if (!/^\d{1,12}$/.test(key)) return NextResponse.json({ error: "A valid soil map-unit key is required." }, { status: 400 });
  try { return NextResponse.json({ components: await components(key), note }, { headers: { "Cache-Control": "public, s-maxage=3600" } }); }
  catch { return NextResponse.json({ error: "NRCS component properties are temporarily unavailable." }, { status: 502 }); }
}
