import { NextResponse } from "next/server";
import type { TrendItem, TrendResponse } from "@/app/trends/lib/types";

function formatRedditMeta(post: any) {
  const score = typeof post?.score === "number" ? post.score : null;
  const comments = typeof post?.num_comments === "number" ? post.num_comments : null;
  const parts: string[] = [];
  if (score !== null) parts.push(`${score.toLocaleString()} upvotes`);
  if (comments !== null) parts.push(`${comments.toLocaleString()} comments`);
  return parts.join(" • ") || undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").trim();

  if (!query) {
    const out: TrendResponse = { ok: true, items: [] };
    return NextResponse.json(out, { status: 200 });
  }

  try {
    const redditGeneralUrl =
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}` +
      `&sort=top&t=week&limit=8`;
    const redditVideosUrl =
      `https://www.reddit.com/r/videos/search.json?q=${encodeURIComponent(query)}` +
      `&restrict_sr=1&sort=top&t=month&limit=6`;
    const wikiUrl =
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}` +
      `&limit=8&namespace=0&format=json`;

    const [redditGeneralRes, redditVideosRes, wikiRes] = await Promise.allSettled([
      fetch(redditGeneralUrl, {
        cache: "no-store",
        headers: { "User-Agent": "shanemiller.ninja trends dashboard" },
      }),
      fetch(redditVideosUrl, {
        cache: "no-store",
        headers: { "User-Agent": "shanemiller.ninja trends dashboard" },
      }),
      fetch(wikiUrl, { cache: "no-store" }),
    ]);

    const items: TrendItem[] = [];

    if (redditGeneralRes.status === "fulfilled" && redditGeneralRes.value.ok) {
      const json = await redditGeneralRes.value.json();
      const posts = json?.data?.children || [];
      items.push(
        ...posts.map((p: any) => {
          const d = p?.data || {};
          return {
            title: d.title || "Untitled",
            url: d.permalink ? `https://www.reddit.com${d.permalink}` : undefined,
            meta: formatRedditMeta(d),
            source: d.subreddit_name_prefixed || "Reddit",
          };
        })
      );
    }

    if (redditVideosRes.status === "fulfilled" && redditVideosRes.value.ok) {
      const json = await redditVideosRes.value.json();
      const posts = json?.data?.children || [];
      items.push(
        ...posts.map((p: any) => {
          const d = p?.data || {};
          return {
            title: d.title || "Untitled",
            url: d.url_overridden_by_dest || d.url || undefined,
            meta: formatRedditMeta(d),
            source: "Video posts",
          };
        })
      );
    }

    if (wikiRes.status === "fulfilled" && wikiRes.value.ok) {
      const data = await wikiRes.value.json();
      const titles: string[] = data?.[1] || [];
      const links: string[] = data?.[3] || [];
      for (let i = 0; i < titles.length; i += 1) {
        items.push({
          title: titles[i],
          url: links[i],
          source: "Wikipedia",
        });
      }
    }

    const deduped = new Map<string, TrendItem>();
    for (const item of items) {
      const key = `${item.title}`.toLowerCase().trim();
      if (!key || deduped.has(key)) continue;
      deduped.set(key, item);
    }

    const out: TrendResponse = {
      ok: true,
      items: Array.from(deduped.values()).slice(0, 18),
    };
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    const out: TrendResponse = {
      ok: false,
      error: "Topic search failed",
      hint: e?.message || "Try a shorter keyword or try again.",
    };
    return NextResponse.json(out, { status: 200 });
  }
}
