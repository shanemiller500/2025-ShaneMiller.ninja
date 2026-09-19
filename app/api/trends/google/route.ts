// app/api/trends/google/route.ts
import { NextResponse } from "next/server";
import type { TrendItem, TrendResponse } from "@/app/trends/lib/types";

function pickGeo(country: string) {
  // Google Trends RSS uses geo=US style country codes.
  return (country || "US").toUpperCase();
}

function extractItemsFromRss(xml: string): TrendItem[] {
  // Minimal RSS parsing (no dependencies).
  const items: TrendItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  for (const block of itemBlocks.slice(0, 15)) {
    const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ||
      "").trim();

    const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();

    const traffic =
      (block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] || "").trim();
    const publishedAt = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    const imageUrl = (block.match(/<ht:picture>([\s\S]*?)<\/ht:picture>/)?.[1] || "").trim();
    const imageSource = (block.match(/<ht:picture_source>([\s\S]*?)<\/ht:picture_source>/)?.[1] || "").trim();

    const newsBlocks = block.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/g) || [];
    const related = newsBlocks
      .map((newsBlock) => {
        const newsTitle =
          (newsBlock.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] || "").trim();
        const newsUrl =
          (newsBlock.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] || "").trim();
        const newsSource =
          (newsBlock.match(/<ht:news_item_source>([\s\S]*?)<\/ht:news_item_source>/)?.[1] || "").trim();
        const newsImage =
          (newsBlock.match(/<ht:news_item_picture>([\s\S]*?)<\/ht:news_item_picture>/)?.[1] || "").trim();

        if (!newsTitle) return null;
        return {
          title: newsTitle,
          url: newsUrl || undefined,
          source: newsSource || undefined,
          imageUrl: newsImage || undefined,
        };
      })
      .filter(Boolean) as NonNullable<TrendItem["related"]>;

    if (!title) continue;

    const metaParts: string[] = [];
    if (traffic) metaParts.push(`Approx traffic: ${traffic}`);
    if (publishedAt) {
      const ts = Date.parse(publishedAt);
      if (!Number.isNaN(ts)) {
        metaParts.push(new Date(ts).toLocaleString());
      }
    }

    const fallbackSource = imageSource || "Google Trends";
    const bestUrl = related[0]?.url || (link.startsWith("http") ? link : "");

    items.push({
      title,
      url: bestUrl || undefined,
      meta: metaParts.length ? metaParts.join(" • ") : undefined,
      source: fallbackSource,
      imageUrl: imageUrl || undefined,
      publishedAt: publishedAt || undefined,
      related,
    });
  }

  return items;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = pickGeo(searchParams.get("country") || "US");

  try {
    // Current Google Trends RSS endpoint (the legacy /trends/trendingsearches/daily/rss now 404s).
    const rssUrl = `https://trends.google.com/trending/rss?geo=${country}`;
    const res = await fetch(rssUrl, {
      // RSS is updated daily; avoid caching while developing
      cache: "no-store",
      headers: { "User-Agent": "shanemiller.ninja trends dashboard" },
    });

    if (!res.ok) {
      const out: TrendResponse = {
        ok: false,
        error: `Google Trends RSS failed (${res.status})`,
        hint: "Google may not expose trends for that region right now; try another country.",
      };
      return NextResponse.json(out, { status: 200 });
    }

    const xml = await res.text();
    const items = extractItemsFromRss(xml);

    const out: TrendResponse = { ok: true, items };
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    const out: TrendResponse = {
      ok: false,
      error: "Google Trends RSS error",
      hint: e?.message || "Unknown error",
    };
    return NextResponse.json(out, { status: 200 });
  }
}
