import { NextRequest, NextResponse } from "next/server";
import { milesBetween } from "@/app/land-intelligence/comps";
import { RECENT_MONTHS, coloradoParcelsIn, denverRecentSales, priceClass, recentSalesFor, windowStart, type RecentMonths } from "@/app/land-intelligence/recent-sales";

export const runtime = "nodejs";

const COLORADO: [number, number, number, number] = [-109.1, 36.9, -102, 41.1];
const MAX_SPAN = 0.1;
const NEAR_MILES = 0.5;

/** Recent recorded home sales: `bbox=w,s,e,n` for the map layer, or `near=lng,lat` for the nearest sales to a parcel. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const months = Number(params.get("months") ?? 12) as RecentMonths;
  if (!RECENT_MONTHS.includes(months)) return NextResponse.json({ error: "months must be 3, 6 or 12." }, { status: 400 });
  const near = params.get("near")?.split(",").map(Number);
  let bbox = params.get("bbox")?.split(",").map(Number) as [number, number, number, number] | undefined;
  if (near) {
    if (near.length !== 2 || !near.every(Number.isFinite)) return NextResponse.json({ error: "near must be lng,lat." }, { status: 400 });
    const dLat = NEAR_MILES / 69, dLng = NEAR_MILES / (69 * Math.cos(near[1] * Math.PI / 180));
    bbox = [near[0] - dLng, near[1] - dLat, near[0] + dLng, near[1] + dLat];
  }
  if (!bbox || bbox.length !== 4 || !bbox.every(Number.isFinite) || bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) return NextResponse.json({ error: "A bbox or near point is required." }, { status: 400 });
  if (bbox[2] - bbox[0] > MAX_SPAN || bbox[3] - bbox[1] > MAX_SPAN) return NextResponse.json({ error: "Zoom in to see recent sales." }, { status: 422 });
  const inColorado = bbox[2] > COLORADO[0] && bbox[0] < COLORADO[2] && bbox[3] > COLORADO[1] && bbox[1] < COLORADO[3];
  const meta = { months, since: windowStart(months), coverage: inColorado ? "colorado" : "outside" };
  if (!inColorado) return NextResponse.json({ type: "FeatureCollection", features: [], ...meta, limited: false, denver: "not_needed" });
  try {
    const parcels = await coloradoParcelsIn(bbox);
    const needsDenver = parcels.features.some((feature) => String(feature.properties?.countyName ?? "").toLowerCase() === "denver");
    let denver = null, denverStatus = needsDenver ? "ready" : "not_needed";
    if (needsDenver) { try { denver = await denverRecentSales(); } catch { denverStatus = "unavailable"; } }
    let sales = recentSalesFor(parcels.features, denver, months);
    if (near) sales = sales.map((sale) => ({ ...sale, distanceMiles: Math.round(milesBetween(near as [number, number], sale.point) * 100) / 100 })).filter((sale) => sale.distanceMiles! <= NEAR_MILES).sort((a, b) => a.distanceMiles! - b.distanceMiles!).slice(0, 25);
    const features = sales.map((sale) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: sale.point }, properties: { ...sale, point: undefined, priceClass: priceClass(sale.price) } }));
    return NextResponse.json({ type: "FeatureCollection", features, ...meta, limited: parcels.limited, denver: denverStatus }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600" } });
  } catch {
    return NextResponse.json({ error: "The Colorado parcel service did not respond. Try again shortly." }, { status: 503 });
  }
}
