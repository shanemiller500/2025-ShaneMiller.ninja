import { NextResponse } from "next/server";
import type { TrendItem, TrendResponse } from "@/app/trends/lib/types";

function subredditForCountry(code: string) {
  const c = code.toUpperCase();
  const map: Record<string, string> = {
    US: "popular",
    CA: "canada",
    GB: "unitedkingdom",
    IE: "ireland",
    AU: "australia",
    NZ: "newzealand",
    DE: "de",
    FR: "france",
    ES: "spain",
    IT: "italy",
    NL: "thenetherlands",
    SE: "sweden",
    NO: "norway",
    DK: "denmark",
    PL: "poland",
    BR: "brasil",
    MX: "mexico",
    AR: "argentina",
    IN: "india",
    JP: "japan",
    KR: "korea",
    SG: "singapore",
    ZA: "southafrica",
    NG: "nigeria",
    KE: "kenya",
  };

  return map[c] || "popular";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "US").toUpperCase();
  const sub = subredditForCountry(country);

  try {
    const url = `https://www.reddit.com/r/${sub}/hot.json?limit=12`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "shanemiller.ninja trends dashboard" },
    });

    if (!res.ok) {
      const out: TrendResponse = {
        ok: false,
        error: `Social feed failed (${res.status})`,
        hint: "Try again later (Reddit can rate-limit unauthenticated traffic).",
      };
      return NextResponse.json(out, { status: 200 });
    }

    const json = await res.json();
    const children = json?.data?.children || [];
    const items: TrendItem[] = children.map((c: any) => {
      const d = c?.data || {};
      const score = typeof d.score === "number" ? d.score : null;
      const comments = typeof d.num_comments === "number" ? d.num_comments : null;
      const parts: string[] = [];
      if (score !== null) parts.push(`${score.toLocaleString()} upvotes`);
      if (comments !== null) parts.push(`${comments.toLocaleString()} comments`);

      return {
        title: d.title || "Untitled",
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : undefined,
        meta: parts.length ? parts.join(" • ") : undefined,
        source: `r/${sub}`,
      };
    });

    const out: TrendResponse = { ok: true, items };
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    const out: TrendResponse = { ok: false, error: "Social feed error", hint: e?.message };
    return NextResponse.json(out, { status: 200 });
  }
}
