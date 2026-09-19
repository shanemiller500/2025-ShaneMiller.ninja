import { NextResponse } from "next/server";
import type { TrendItem, TrendResponse } from "@/app/trends/lib/types";

function wikiLangForCountry(country: string) {
  const c = (country || "US").toUpperCase();
  const map: Record<string, string> = {
    US: "en",
    CA: "en",
    GB: "en",
    IE: "en",
    AU: "en",
    NZ: "en",
    IN: "en",
    PK: "en",
    BD: "en",
    SG: "en",
    PH: "en",
    ZA: "en",
    NG: "en",
    KE: "en",
    DE: "de",
    FR: "fr",
    ES: "es",
    IT: "it",
    NL: "nl",
    SE: "sv",
    NO: "no",
    DK: "da",
    PL: "pl",
    BR: "pt",
    MX: "es",
    AR: "es",
    CL: "es",
    CO: "es",
    JP: "ja",
    KR: "ko",
    TH: "th",
    VN: "vi",
    ID: "id",
  };

  return map[c] || "en";
}

function getDateParts(daysBack: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);

  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0"),
  };
}

function toWikiUrl(lang: string, article: string) {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, "_"))}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "US").toUpperCase();
  const lang = wikiLangForCountry(country);

  try {
    let res: Response | null = null;

    for (const daysBack of [1, 2, 3]) {
      const { year, month, day } = getDateParts(daysBack);
      const url =
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lang}.wikipedia` +
        `/all-access/${year}/${month}/${day}`;

      const candidate = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": "shanemiller.ninja trends dashboard" },
      });

      if (candidate.ok) {
        res = candidate;
        break;
      }
    }

    if (!res) {
      const out: TrendResponse = {
        ok: false,
        error: "World trends feed unavailable",
        hint: "Wikimedia data can lag for some regions; try again soon.",
      };
      return NextResponse.json(out, { status: 200 });
    }

    const json = await res.json();
    const raw = json?.items?.[0]?.articles || [];
    const blocked = new Set(["Main_Page", "Special:Search"]);

    const items: TrendItem[] = raw
      .filter((a: any) => a?.article && !blocked.has(a.article) && !String(a.article).startsWith("Special:"))
      .slice(0, 15)
      .map((a: any) => ({
        title: String(a.article).replace(/_/g, " "),
        url: toWikiUrl(lang, String(a.article)),
        meta: typeof a.views === "number" ? `${a.views.toLocaleString()} views` : undefined,
        source: `${lang}.wikipedia.org`,
      }));

    const out: TrendResponse = { ok: true, items };
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    const out: TrendResponse = { ok: false, error: "World trends error", hint: e?.message };
    return NextResponse.json(out, { status: 200 });
  }
}
