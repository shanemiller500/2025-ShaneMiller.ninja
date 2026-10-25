import { NextRequest, NextResponse } from "next/server";
import { PARCEL_KEY, queryParcelDetail } from "@/app/land-intelligence/parcel-detail";
import { loadBoulderProperty } from "@/app/land-intelligence/boulder-property";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!PARCEL_KEY.test(key)) return NextResponse.json({ error: "A valid parcel selection is required." }, { status: 400 });

  try {
    const detail = await queryParcelDetail(key);
    if (!detail) return NextResponse.json({ error: "This parcel record was not found in the public source." }, { status: 404 });
    if (key.startsWith("co:") && detail.parcel.county.toLowerCase() === "boulder") detail.boulder = await loadBoulderProperty(detail.parcel.id);
    return NextResponse.json({ detail }, { headers: { "Cache-Control": "private, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "The public property record could not be loaded. Try the source link below." }, { status: 503 });
  }
}
