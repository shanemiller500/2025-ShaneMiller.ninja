// app/api/trends/reddit/route.ts
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

  return map[c] || "worldnews";
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
        error: `Reddit failed (${res.status})`,
        hint: "Try again later (Reddit sometimes rate-limits).",
      };
      return NextResponse.json(out, { status: 200 });
    }

    const json = await res.json();
    const children = json?.data?.children || [];
    const items: TrendItem[] = children.map((c: any) => {
      const d = c?.data;
      const title = d?.title || "Untitled";
      const score = typeof d?.score === "number" ? d.score : null;
      const permalink = d?.permalink ? `https://www.reddit.com${d.permalink}` : undefined;

      return {
        title,
        url: permalink,
        meta: score !== null ? `${score.toLocaleString()} score` : undefined,
        source: `r/${sub}`,
      };
    });

    const out: TrendResponse = { ok: true, items };
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    const out: TrendResponse = { ok: false, error: "Reddit error", hint: e?.message };
    return NextResponse.json(out, { status: 200 });
  }
}