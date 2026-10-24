import { NextRequest, NextResponse } from "next/server";
import { lookupZoning, validPoint } from "@/app/land-intelligence/zoning-lookup";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  if (!validPoint(lng, lat)) return NextResponse.json({ error: "A U.S. map point is required." }, { status: 400 });
  return NextResponse.json(await lookupZoning(lng, lat));
}
