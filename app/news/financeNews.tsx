// Filename: financeNews.ts
'use client';

export interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: {
    id: string | null;
    name: string;
    image?: string | null;
  };
  image: string | null;
  sourceLogo: string | null;
}

export async function fetchFinanceNews(): Promise<Article[]> {
  const res = await fetch('https://u-mail.co/api/financeNews', {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Finance News API error: ${res.status}`);
  }

  const data = await res.json();

  return (data.results as any[]).map(item => ({
    title:       item.title,
    description: item.description,
    url:         item.link,
    urlToImage:  item.image ?? null,
    publishedAt: item.publishedAt,
    source: {
      id:    null,
      name:  item.source,
      image: item.sourceLogo ?? `https://logo.clearbit.com/${new URL(item.link).hostname}`
    },
    image:      item.image ?? null,
    sourceLogo: item.sourceLogo ?? null,
  }));
}
