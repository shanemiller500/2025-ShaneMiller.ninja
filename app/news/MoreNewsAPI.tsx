'use client';

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

export async function fetchUmailArticles(): Promise<Article[]> {
  const res = await fetch('https://u-mail.co/api/NewsAPI/More-news', {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`U-Mail API error ${res.status}`);

  const data = await res.json();

  return data.results.map((item: any) => ({
    source: {
      id: null,
      name: item.source || 'U-Mail',
      image: item.sourceImage || `https://logo.clearbit.com/${new URL(item.link).hostname}`,
    },
    author: item.author,
    title: item.headline,
    description: item.description,
    url: item.link,
    urlToImage:
      item.image ||
      (item.thumbnails && item.thumbnails.length ? item.thumbnails[0] : null),
    images: item.images || [],
    thumbnails: item.thumbnails || [],
    publishedAt: item.publishedAt,
    content: item.content,
    categories: item.categories?.length ? item.categories : ['World'],
  })) as Article[];
}
