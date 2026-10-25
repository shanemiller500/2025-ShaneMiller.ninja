import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type PhotonFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    name?: string; housenumber?: string; street?: string; city?: string; district?: string;
    county?: string; state?: string; postcode?: string; country?: string; type?: string;
  };
};

async function photonMatches(q: string, bias?: { lat: number; lon: number }) {
  const params = new URLSearchParams({ q, limit: "6", lang: "en", countrycode: "US" });
  if (bias) { params.set("lat", String(bias.lat)); params.set("lon", String(bias.lon)); params.set("zoom", "9"); }
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: AbortSignal.timeout(6000), cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const json = await response.json() as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  return (json.features ?? []).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    if (feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length < 2) return [];
    const [lng, lat] = coordinates;
    if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return [];
    const p = feature.properties ?? {};
    if (p.country && !/^(united states|united states of america)$/i.test(p.country)) return [];
    const typedHouseNumber = q.match(/^\s*(\d+)\s+/)?.[1];
    const nameHouseNumber = p.name?.match(/^(\d+)\s+/)?.[1];
    const isHouse = typedHouseNumber ? p.housenumber === typedHouseNumber || p.type === "house" && nameHouseNumber === typedHouseNumber : !!p.housenumber || p.type === "house";
    if (typedHouseNumber && !isHouse && p.type !== "street") return [];
    const address = [p.housenumber, p.street].filter(Boolean).join(" ");
    const label = address || p.name || p.street;
    if (!label) return [];
    const key = `${label.toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const county = p.county || p.district;
    const countyLabel = county && /county$/i.test(county) ? county : county ? `${county} County` : "";
    const precision = isHouse ? "Address candidate" : p.type === "street" ? "Street location · verify house number" : "Place center";
    const detail = [p.city, countyLabel, p.state, p.postcode, precision].filter(Boolean).join(" · ");
    const precisionType = isHouse ? "address" : p.type === "street" ? "street" : "place";
    return [{ label, detail, provider: "OpenStreetMap · Photon", precisionType, center: [lng, lat] as [number, number] }];
  });
}

async function censusMatches(q: string) {
  const params = new URLSearchParams({ address: q, benchmark: "Public_AR_Current", vintage: "Current_Current", format: "json" });
  const res = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.result?.addressMatches ?? []).slice(0, 6).map((match: {
    matchedAddress: string;
    coordinates: { x: number; y: number };
    addressComponents?: { city?: string; state?: string; zip?: string };
    geographies?: { Counties?: { BASENAME?: string; NAME?: string }[] };
  }) => {
    const countyFeature = match.geographies?.Counties?.[0];
    const county = countyFeature?.BASENAME || countyFeature?.NAME?.replace(/ County(?:,.*)?$/i, "");
    const detail = [match.addressComponents?.city, county ? `${county} County` : "", match.addressComponents?.state, match.addressComponents?.zip, "Census address match"].filter(Boolean).join(" · ");
    return { label: match.matchedAddress, detail, provider: "U.S. Census Geocoder", precisionType: "address", center: [match.coordinates.x, match.coordinates.y] };
  });
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 4 || q.length > 160) return NextResponse.json({ results: [] });
  const coordinates = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordinates) {
    const lat = Number(coordinates[1]);
    const lng = Number(coordinates[2]);
    return NextResponse.json({ results: lat >= -85 && lat <= 85 && lng >= -180 && lng <= 180 ? [{ label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, detail: "Latitude / longitude", precisionType: "coordinate", center: [lng, lat] }] : [] });
  }
  try {
    try {
      const lat = Number(request.nextUrl.searchParams.get("lat"));
      const lon = Number(request.nextUrl.searchParams.get("lon"));
      const bias = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180 ? { lat, lon } : undefined;
      const results = await photonMatches(q, bias);
      if (results.length) return NextResponse.json({ results });
      const streetQuery = q.replace(/^\s*\d+\s+/, "").trim();
      if (streetQuery !== q && streetQuery.length >= 4) {
        const streets = (await photonMatches(streetQuery, bias)).filter((result) => result.precisionType === "street");
        if (streets.length) return NextResponse.json({ results: streets });
      }
    } catch { /* fall back to Census for complete U.S. addresses */ }
    return NextResponse.json({ results: await censusMatches(q) });
  } catch {
    return NextResponse.json({ results: [], error: "Address search is temporarily unavailable. You can still enter latitude, longitude." }, { status: 503 });
  }
}
