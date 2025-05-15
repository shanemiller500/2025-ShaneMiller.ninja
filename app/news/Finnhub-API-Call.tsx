'use client';

export interface Article {
  source: { id: string | null; name: string; image?: string | null };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
  category: string;
  categories: string[];
}

export async function fetchFinnhubArticles(): Promise<Article[]> {
  const token = process.env.NEXT_PUBLIC_FINNHUB_API_TOKEN;
  if (!token) return [];

  const url = `https://finnhub.io/api/v1/news?category=general&token=${token}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);

  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map((r: any) => ({
    source: {
      id: null,
      name: r.source || 'Finnhub',
      image: `https://logo.clearbit.com/${new URL(r.url).hostname}`,
    },
    author: null,
    title: r.headline,
    description: r.summary,
    url: r.url,
    urlToImage: r.image || null,
    publishedAt: new Date(r.datetime * 1000).toISOString(),
    content: null,
    category: 'Finance',
    categories: ['Finance'],
  })) as Article[];
}
