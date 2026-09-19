import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const INTERVALS = new Set(["m1", "m5", "m15", "m30", "h1", "h2", "h6", "h12", "d1"]);

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const query = new URL(request.url).searchParams;
  const isList = path.length === 1;
  const isHistory = path.length === 3 && path[2] === "history";
  if (path[0] !== "assets" || path.length > 3 ||
      (path.length > 1 && !SLUG.test(path[1])) ||
      (path.length === 3 && !isHistory)) {
    return NextResponse.json({ error: "Unsupported CoinCap endpoint." }, { status: 400 });
  }

  const allowed = isList ? ["limit", "search"] : isHistory ? ["interval", "start", "end"] : [];
  if (Array.from(query.keys()).some((key) => !allowed.includes(key) || query.getAll(key).length !== 1)) {
    return NextResponse.json({ error: "Unsupported query parameters." }, { status: 400 });
  }
  const upstreamUrl = new URL(`https://rest.coincap.io/v3/${path.join("/")}`);
  if (isList) {
    const limit = query.get("limit") ?? "200";
    const search = query.get("search")?.trim();
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 200 ||
        (search !== undefined && (search.length < 1 || search.length > 100))) {
      return NextResponse.json({ error: "Invalid asset search or limit." }, { status: 400 });
    }
    upstreamUrl.searchParams.set("limit", String(Number(limit)));
    if (search) upstreamUrl.searchParams.set("search", search);
  } else if (isHistory) {
    const interval = query.get("interval") ?? "";
    const start = Number(query.get("start"));
    const end = Number(query.get("end"));
    if (!INTERVALS.has(interval) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start <= 0 || end <= start || end - start > 31 * 86_400_000 || end > Date.now() + 60_000) {
      return NextResponse.json({ error: "Invalid history interval or date range." }, { status: 400 });
    }
    upstreamUrl.searchParams.set("interval", interval);
    // Normalize rolling chart windows to improve cache reuse between visitors.
    upstreamUrl.searchParams.set("start", String(Math.floor(start / 60_000) * 60_000));
    upstreamUrl.searchParams.set("end", String(Math.floor(end / 60_000) * 60_000));
  }

  const apiKey = process.env.COINCAP_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Crypto data is not configured." }, { status: 503 });
  }
  try {
    const response = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) {
      // Never forward provider error bodies, which may echo credentials or request URLs.
      const error = response.status === 401 || response.status === 403
        ? "CoinCap refused access. Check the configured key, plan, and available credits."
        : response.status === 429 ? "CoinCap rate limit reached. Please try again later."
        : "CoinCap data is temporarily unavailable.";
      return NextResponse.json({ error, upstreamStatus: response.status }, {
        status: response.status === 429 ? 429 : 502,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const data = await response.json();
    if (!data || !("data" in data)) throw new Error("Invalid response");
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "CoinCap data is temporarily unavailable." }, { status: 502 });
  }
}
