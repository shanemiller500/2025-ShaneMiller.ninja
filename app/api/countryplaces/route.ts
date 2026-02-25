import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { country } = body as Record<string, unknown>;

  if (!country || typeof country !== "string" || !country.trim()) {
    return NextResponse.json({ error: "Invalid or missing country" }, { status: 400 });
  }

  const apiUrl = process.env.COUNTRY_PLACES_API_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { error: "COUNTRY_PLACES_API_URL is not configured on this server" },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: country.trim() }),
      signal: AbortSignal.timeout(62_000),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/countryplaces proxy]", msg);
    if (msg.includes("TimeoutError") || msg.includes("ECONNABORTED")) {
      return NextResponse.json({ error: "Request timed out — please try again" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to reach places service" }, { status: 502 });
  }
}
