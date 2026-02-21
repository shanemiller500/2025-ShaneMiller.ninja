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

export const runtime   = "nodejs";
export const revalidate = 86_400; // 24 hours

interface RatePoint {
  rate: number | null;   // latest observation (%)
  prev: number | null;   // previous observation for week-over-week delta
  date: string | null;   // ISO date string of latest observation
}

async function fetchFredSeries(seriesId: string): Promise<RatePoint> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;

  const res = await fetch(url, {
    next: { revalidate: 86_400 },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ShaneMiller.ninja/1.0)",
      "Accept": "text/csv,text/plain,*/*",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  }

  const text = await res.text();

  // CSV format: header row "DATE,<SERIES_ID>", then rows of "YYYY-MM-DD,value"
  // Missing values use "." — skip them.
  const rows = text
    .trim()
    .split("\n")
    .slice(1)                          // skip header
    .map((l) => l.trim().split(","))
    .filter((cols) => cols.length === 2 && cols[1] !== "." && cols[1] !== "");

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  return {
    rate: last  ? parseFloat(last[1])  : null,
    date: last  ? last[0]              : null,
    prev: prev  ? parseFloat(prev[1])  : null,
  };
}

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
