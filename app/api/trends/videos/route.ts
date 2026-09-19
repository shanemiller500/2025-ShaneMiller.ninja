import { NextResponse } from "next/server";
import type { TrendItem, TrendResponse } from "@/app/trends/lib/types";

export async function GET() {
  try {
    const url = "https://www.reddit.com/r/videos/hot.json?limit=12";
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "shanemiller.ninja trends dashboard" },
    });

    if (!res.ok) {
      const out: TrendResponse = {
        ok: false,
        error: `Popular videos feed failed (${res.status})`,
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
      const views = typeof d.view_count === "number" ? d.view_count : null;
      const parts: string[] = [];
      if (score !== null) parts.push(`${score.toLocaleString()} upvotes`);
      if (comments !== null) parts.push(`${comments.toLocaleString()} comments`);
      if (views !== null) parts.push(`${views.toLocaleString()} views`);

      return {
        title: d.title || "Untitled",
        url: d.url_overridden_by_dest || d.url || undefined,
        meta: parts.length ? parts.join(" • ") : undefined,
        source: d.domain || "r/videos",
      };
    });

    const out: TrendResponse = { ok: true, items };
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    const out: TrendResponse = { ok: false, error: "Popular videos error", hint: e?.message };
    return NextResponse.json(out, { status: 200 });
  }
}
