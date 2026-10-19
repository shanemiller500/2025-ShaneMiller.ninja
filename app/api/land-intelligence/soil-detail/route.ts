import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("mukey") ?? "";
  if (!/^\d{1,12}$/.test(key)) return NextResponse.json({ error: "A valid soil map-unit key is required." }, { status: 400 });
  try {
    const query = `SELECT TOP 8 compname, comppct_r, hydricrating, drainagecl, taxclname, slope_r FROM component WHERE mukey = '${key}' ORDER BY comppct_r DESC`;
    const response = await fetch("https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ QUERY: query, FORMAT: "JSON+COLUMNNAME" }), signal: AbortSignal.timeout(14000), cache: "no-store" });
    if (!response.ok) throw new Error(`NRCS HTTP ${response.status}`);
    const json = await response.json();
    if (json.error || json.Error || !Array.isArray(json.Table)) throw new Error("The soil properties were unavailable.");
    const components = json.Table.slice(1).filter(Array.isArray).map((row: unknown[]) => ({
      name: String(row[0] ?? ""), percentage: row[1] == null || row[1] === "" ? null : Number(row[1]), hydric: String(row[2] ?? ""), drainage: String(row[3] ?? ""), classification: String(row[4] ?? ""), slopePercent: row[5] == null || row[5] === "" ? null : Number(row[5]),
    }));
    return NextResponse.json({ components, note: "Component percentages and ratings describe the mapped unit, not a sampled point. Field conditions can vary." }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch { return NextResponse.json({ error: "NRCS component properties are temporarily unavailable." }, { status: 502 }); }
}
