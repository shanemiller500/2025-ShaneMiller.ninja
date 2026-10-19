import { NextRequest, NextResponse } from "next/server";
import { PARCEL_DETAIL_FIELDS, normalizeParcelDetail } from "@/app/land-intelligence/parcel-detail";
import { PARCEL_SOURCES } from "@/app/land-intelligence/parcel-sources";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const match = key.match(/^(co|ut|wa|fl|nc|wi):([1-9]\d{0,11})$/);
  if (!match) return NextResponse.json({ error: "A valid parcel selection is required." }, { status: 400 });
  const source = PARCEL_SOURCES.find((item) => item.id === match[1]);
  if (!source) return NextResponse.json({ error: "Parcel source not found." }, { status: 404 });

  try {
    const params = new URLSearchParams({ objectIds: match[2], outFields: PARCEL_DETAIL_FIELDS[source.id], returnGeometry: "false", f: "json" });
    const response = await fetch(`${source.url}/query`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params, signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 200_000) throw new Error("Parcel detail response exceeded limit");
    const json = JSON.parse(raw);
    if (json.error) throw new Error(json.error.message || "Source rejected parcel detail request");
    const attributes = json.features?.[0]?.attributes;
    if (!attributes || typeof attributes !== "object") return NextResponse.json({ error: "This parcel record was not found in the public source." }, { status: 404 });
    return NextResponse.json({ detail: normalizeParcelDetail(source, attributes) }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  } catch {
    return NextResponse.json({ error: "The public property record could not be loaded. Try the source link below." }, { status: 503 });
  }
}
