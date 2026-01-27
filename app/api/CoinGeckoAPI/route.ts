// app/api/CoinGeckoAPI/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // safe default (CoinGecko is external)
export const revalidate = 60; // cache on server for 60s (reduces rate-limit pain)

const COINGECKO_BASE = "https://api.coingecko.com/api/v3/coins/markets";

function clampInt(v: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Allowlist + sane defaults (prevents someone from using your endpoint as a free proxy)
    const vs_currency = (searchParams.get("vs_currency") || "usd").toLowerCase();
    const order = searchParams.get("order") || "market_cap_desc";
    const per_page = clampInt(searchParams.get("per_page"), 200, 1, 250);
    const page = clampInt(searchParams.get("page"), 1, 1, 100);
    const sparkline = (searchParams.get("sparkline") || "false").toLowerCase() === "true";

    // Basic allowlist validation (optional but good)
    const allowedVs = new Set(["usd", "aud", "eur", "gbp", "cad", "jpy"]);
    const allowedOrder = new Set([
      "market_cap_desc",
      "market_cap_asc",
      "volume_desc",
      "volume_asc",
      "id_desc",
      "id_asc",
    ]);

    const safeVs = allowedVs.has(vs_currency) ? vs_currency : "usd";
    const safeOrder = allowedOrder.has(order) ? order : "market_cap_desc";

    const url =
      `${COINGECKO_BASE}` +
      `?vs_currency=${encodeURIComponent(safeVs)}` +
      `&order=${encodeURIComponent(safeOrder)}` +
      `&per_page=${per_page}` +
      `&page=${page}` +
      `&sparkline=${sparkline ? "true" : "false"}`;

    const upstream = await fetch(url, {
      // Next.js caching behavior (server-side)
      next: { revalidate },
      headers: {
        accept: "application/json",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: "CoinGecko request failed",
          status: upstream.status,
          details: text?.slice(0, 500) || null,
        },
        { status: 502 }
      );
    }

    const data = await upstream.json();

    // Same-origin response; no CORS needed
    return NextResponse.json(data, {
      headers: {
        // Let browsers cache briefly too (optional)
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Proxy route error", message: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
