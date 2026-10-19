import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 4 || q.length > 160) return NextResponse.json({ results: [] });
  const coordinates = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordinates) {
    const lat = Number(coordinates[1]);
    const lng = Number(coordinates[2]);
    return NextResponse.json({ results: lat >= -85 && lat <= 85 && lng >= -180 && lng <= 180 ? [{ label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, center: [lng, lat] }] : [] });
  }
  try {
    const params = new URLSearchParams({ address: q, benchmark: "Public_AR_Current", format: "json" });
    const res = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const results = (json.result?.addressMatches ?? []).slice(0, 5).map((match: { matchedAddress: string; coordinates: { x: number; y: number } }) => ({ label: match.matchedAddress, center: [match.coordinates.x, match.coordinates.y] }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "Address search is temporarily unavailable. You can still enter latitude, longitude." }, { status: 503 });
  }
}
