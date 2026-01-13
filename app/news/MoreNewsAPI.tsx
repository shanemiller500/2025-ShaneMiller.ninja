"use client";

export interface Article {
  source: {
    id: string | null;
    name: string;
    image?: string | null;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  images: string[];
  thumbnails: string[];
  publishedAt: string;
  content: string | null;
  categories: string[];
}

const safeDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const favicon = (domain: string) =>
  domain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}` : null;

export async function fetchUmailArticles(): Promise<Article[]> {
  const res = await fetch("https://u-mail.co/api/NewsAPI/more-news", { cache: "no-store" });
  if (!res.ok) throw new Error(`U-Mail API error ${res.status}`);

  const data = await res.json();
  const results: any[] = Array.isArray(data?.results) ? data.results : [];

  return results.map((item: any) => {
    const url = String(item.link || "");
    const domain = safeDomain(url);

    return {
      source: {
        id: null,
        name: item.source || domain || "U-Mail",
        // ✅ prefer backend favicon, else Google favicon, else null
        image: item.sourceImage ?? favicon(domain),
      },
      author: item.author ?? null,
      title: item.headline ?? "",
      description: item.description ?? "",
      url,
      urlToImage: item.image ?? null,
      images: Array.isArray(item.images) ? item.images : [],
      thumbnails: Array.isArray(item.thumbnails) ? item.thumbnails : [],
      publishedAt: item.publishedAt,
      content: item.content ?? null,
      categories: Array.isArray(item.categories) && item.categories.length ? item.categories : ["World"],
    } as Article;
  });
}
