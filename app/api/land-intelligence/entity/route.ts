import { NextRequest, NextResponse } from "next/server";
import { coloradoEntities } from "@/app/land-intelligence/colorado-live";
import { ownerEntityType } from "@/app/land-intelligence/property-history";

export const runtime = "nodejs";

/** Colorado business filings with the same name as a parcel owner. Individuals are never looked up. */
export async function GET(request: NextRequest) {
  const name = (request.nextUrl.searchParams.get("name") ?? "").trim();
  if (name.length < 3 || name.length > 160) return NextResponse.json({ error: "An owner name is required." }, { status: 400 });
  if (ownerEntityType(name) === "individual") return NextResponse.json({ error: "Only business, trust and organization owners are looked up." }, { status: 422 });
  try {
    const matches = await coloradoEntities(name);
    return NextResponse.json({ name, matches, source: "Colorado Department of State, Business Entities (data.colorado.gov, public domain)", checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ error: "The Colorado business registry did not respond." }, { status: 503 });
  }
}
