/**
 * /api/mortgage-rates
 *
 * Fetches the latest 30-year and 15-year US fixed mortgage rates from the
 * St. Louis Fed (FRED) public CSV endpoint — no API key required.
 *
 * Cached for 24 hours server-side (Next.js ISR + Cache-Control header).
 * FRED updates these series weekly on Thursdays.
 */
import { NextResponse } from "next/server";
import { fetchFredSeries } from "@/utils/fred";

export const runtime   = "nodejs";
export const revalidate = 86_400; // 24 hours

export async function GET() {
  try {
    const [rate30, rate15] = await Promise.all([
      fetchFredSeries("MORTGAGE30US"),
      fetchFredSeries("MORTGAGE15US"),
    ]);

    return NextResponse.json(
      { rate30, rate15, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch mortgage rates", message: err?.message ?? "Unknown error" },
      { status: 502 }
    );
  }
}
