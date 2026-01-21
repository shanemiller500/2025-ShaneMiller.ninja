// Filename: financeNews.ts
"use client";

export interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: {
    id: string | null;
    name: string;
    image?: string | null; // we will store FIRST candidate here (remote only)
    imageCandidates?: string[]; // optional, if you want to try multiple
  };
  image: string | null;
  sourceLogo: string | null; // we’ll keep this, but prefer candidates
}

/* ---------------------------------------------
   Helpers (remote-only, no local wedding.jpg)
---------------------------------------------- */

const safeDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const uniqStrings = (arr: string[]) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const v = String(s || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

/**
 * Remote-only logo candidates (no local files)
 * Order matters: usually Google favicon is the most reliable.
 */
const logoCandidatesFor = (domain: string) => {
  if (!domain) return [];
  return uniqStrings([
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
  ]);
};

/**
 * If the backend returns *http* image URLs, upgrade to https when possible.
 * Also normalizes protocol-relative URLs ("//...").
 */
const normalizeUrl = (s: string) => {
  const t = s.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};

const bad = (s?: string | null) =>
  !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());

export async function fetchFinanceNews(): Promise<Article[]> {
  const res = await fetch("https://u-mail.co/api/financeNews", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Finance News API error: ${res.status}`);

  const data = await res.json();
  const results: any[] = Array.isArray(data?.results) ? data.results : [];

  return results.map((item) => {
    const url = String(item.link || "");
    const domain = safeDomain(url);

    // News image: use the image that comes with the RSS/article only.
    const img = !bad(item.image) ? normalizeUrl(String(item.image)) : null;

    // Source logo: prefer backend if present, otherwise build remote-only candidates
    const backendLogo = !bad(item.sourceLogo) ? normalizeUrl(String(item.sourceLogo)) : null;

    const candidates = backendLogo
      ? uniqStrings([backendLogo, ...logoCandidatesFor(domain)])
      : logoCandidatesFor(domain);

    return {
      title: item.title || "",
      description: item.description ?? "",
      url,
      urlToImage: img,
      publishedAt: item.publishedAt,
      source: {
        id: null,
        name: item.source || domain || "Unknown",
        image: candidates[0] ?? null,
        imageCandidates: candidates,
      },
      image: img,
      sourceLogo: backendLogo, // kept for compatibility, but UI will use candidates
    };
  });
}
