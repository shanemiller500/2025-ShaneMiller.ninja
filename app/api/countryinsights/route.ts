import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_COUNTRY_LENGTH = 100;
const MAX_OPTION_LENGTH = 80;

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length <= MAX_OPTION_LENGTH ? value.trim() : undefined;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const country = typeof body.country === "string" ? body.country.trim() : "";
  if (!country || country.length > MAX_COUNTRY_LENGTH) {
    return NextResponse.json({ error: "Invalid or missing country." }, { status: 400 });
  }

  const apiUrl = process.env.COUNTRY_INSIGHTS_API_URL?.trim();
  let url: URL;
  try {
    url = new URL(apiUrl || "");
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported protocol");
  } catch {
    return NextResponse.json({ error: "Travel insights are not configured on this server." }, { status: 503 });
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        ...(optionalText(body.style) ? { style: optionalText(body.style) } : {}),
        ...(optionalText(body.focus) ? { focus: optionalText(body.focus) } : {}),
      }),
      // Keep margin below the 30-second hosting function limit.
      signal: AbortSignal.timeout(25_000),
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json({ error: "Travel insights service returned an invalid response." }, { status: 502 });
    }

    if (!upstream.ok) {
      const message = typeof (data as { error?: unknown })?.error === "string"
        ? (data as { error: string }).error.slice(0, 300)
        : "Travel insights are temporarily unavailable.";
      return NextResponse.json({ error: message }, {
        status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Travel insights service returned an invalid response." }, { status: 502 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
    console.error("[api/countryinsights proxy]", isTimeout ? "request timed out" : "upstream unavailable");
    return NextResponse.json(
      { error: isTimeout ? "Travel insights request timed out. Please try again." : "Travel insights service is temporarily unavailable." },
      { status: isTimeout ? 504 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
