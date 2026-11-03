import { NextRequest, NextResponse } from "next/server";
import { PARCEL_KEY, queryParcelDetail, queryParcelGeometry } from "@/app/land-intelligence/parcel-detail";
import { boulderComparables } from "@/app/land-intelligence/boulder-comps";
import type { ParcelGeometry } from "@/app/land-intelligence/parcel-inspection";

export const runtime = "nodejs";

/** Representative point of the parcel's largest outer ring, used only when the centroid index lacks the folio. */
function geometryPoint(geometry: ParcelGeometry | null): [number, number] | null {
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  let best: { area: number; point: [number, number] } | null = null;
  for (const [ring] of polygons) {
    let area = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      area += cross; cx += (ring[j][0] + ring[i][0]) * cross; cy += (ring[j][1] + ring[i][1]) * cross;
    }
    if (area && (!best || Math.abs(area) > Math.abs(best.area))) best = { area, point: [cx / (3 * area), cy / (3 * area)] };
  }
  return best?.point ?? null;
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!PARCEL_KEY.test(key)) return NextResponse.json({ error: "A valid parcel selection is required." }, { status: 400 });
  let detail;
  try { detail = await queryParcelDetail(key); } catch { return NextResponse.json({ error: "The public parcel record did not respond. Try again shortly." }, { status: 503 }); }
  if (!detail) return NextResponse.json({ error: "This parcel record was not found in the public source." }, { status: 404 });
  // Comparable sales need qualified sales with building or land area. Of the connected sources only the Boulder County
  // assessor files supply both; Florida's live service was too slow for on-demand comparables when tested (2026-11-01).
  if (!(key.startsWith("co:") && detail.parcel.county.toLowerCase() === "boulder"))
    return NextResponse.json({ status: "not_supported", reason: "Comparable sales are calculated where the county publishes qualified sales with building area. Connected so far: Boulder County, Colorado." }, { headers: { "Cache-Control": "private, max-age=0" } });
  const result = await boulderComparables(detail.parcel.id, () => queryParcelGeometry(key).then(geometryPoint).catch(() => null));
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=0" } });
}
