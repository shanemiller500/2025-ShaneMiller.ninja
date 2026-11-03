/**
 * FRED (St. Louis Fed) public CSV series — no API key required.
 * Shared by /api/mortgage-rates (stocks widget) and Land Intelligence market context.
 * FRED updates the mortgage series weekly on Thursdays; callers cache for 24 hours.
 */

export interface RatePoint {
  rate: number | null;   // latest observation (%)
  prev: number | null;   // previous observation for week-over-week delta
  date: string | null;   // ISO date string of latest observation
  /** Observation closest to (on or before) 52 weeks before `date`, for a year-over-year change. */
  yearAgo?: { rate: number; date: string } | null;
}

export async function fetchFredSeries(seriesId: string): Promise<RatePoint> {
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
  const target = last ? new Date(Date.parse(last[0]) - 364 * 86_400_000).toISOString().slice(0, 10) : "";
  const before = target ? rows.filter((cols) => cols[0] <= target).pop() : undefined;

  return {
    rate: last  ? parseFloat(last[1])  : null,
    date: last  ? last[0]              : null,
    prev: prev  ? parseFloat(prev[1])  : null,
    yearAgo: before ? { rate: parseFloat(before[1]), date: before[0] } : null,
  };
}
