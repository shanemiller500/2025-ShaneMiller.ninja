"use client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  images?: string[];
  publishedAt: string;
  source: {
    id: string | null;
    name: string;
    image?: string | null;
  };
  image: string | null;
  sourceLogo: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const LOGO_FALLBACK = "/images/wedding.jpg";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const safeDomain = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const bad = (s?: string | null): boolean =>
  !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());

const normalize = (s: string): string => {
  const t = s.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};
const uniqStrings = (arr: string[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const k = s.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  API Function                                                       */
/* ------------------------------------------------------------------ */
export async function fetchSportsNews(): Promise<Article[]> {
  const res = await fetch("https://u-mail.co/api/sportsNews", { cache: "no-store" });
  if (!res.ok) throw new Error(`Sports News API error: ${res.status}`);

  const data = await res.json();
  const results: any[] = Array.isArray(data?.results) ? data.results : [];

  return results.map((item) => {
    const url = String(item.link || "");
    const domain = safeDomain(url);
    const clearbit = domain ? `https://logo.clearbit.com/${domain}` : null;

    const sourceLogo = item.sourceLogo ?? null;

    // API provides image + images[]
    const urlToImage = !bad(item.image) ? normalize(String(item.image)) : null;

    const images = uniqStrings(
      [
        ...(Array.isArray(item.images) ? item.images : []),
        ...(urlToImage ? [urlToImage] : []),
      ]
        .filter((v): v is string => !bad(v))
        .map((v) => normalize(String(v)))
    );

    return {
      title: item.title,
      description: item.description ?? "",
      url,
      urlToImage,
      images, // ✅ pass through
      publishedAt: item.publishedAt,
      source: {
        id: null,
        name: item.source ?? domain ?? "Unknown",
        image: sourceLogo ?? clearbit ?? LOGO_FALLBACK,
      },
      image: urlToImage,
      sourceLogo: sourceLogo ?? clearbit,
    };
  });
}
