'use client';

export interface Article {
  source: { id: string | null; name: string; image?: string | null; imageCandidates?: string[] };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  image?: string | null;
  images?: string[];
  thumbnails?: string[];
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

  return raw.map((r: any) => {
    const imgUrl = r.image || null;
    const hostname = new URL(r.url).hostname;
    return {
      source: {
        id: null,
        name: r.source || 'Finnhub',
        image: `https://logo.clearbit.com/${hostname}`,
        imageCandidates: [`https://logo.clearbit.com/${hostname}`],
      },
      author: null,
      title: r.headline,
      description: r.summary,
      url: r.url,
      urlToImage: imgUrl,
      image: imgUrl,
      images: imgUrl ? [imgUrl] : [],
      thumbnails: [],
      publishedAt: new Date(r.datetime * 1000).toISOString(),
      content: null,
      category: 'Finance',
      categories: ['Finance'],
    };
  }) as Article[];
}
