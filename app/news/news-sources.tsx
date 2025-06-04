// Consolidated helper file for news fetches.
// Split them out if you prefer separate modules.

import { Article } from './AllNewsTab';

// ⚠️ Replace with your real API keys or proxy endpoints.
const MEDIASTACK_KEY = process.env.NEXT_PUBLIC_MEDIASTACK_KEY;
const FINNHUB_KEY   = process.env.NEXT_PUBLIC_FINNHUB_KEY;
const UMAIL_ENDPOINT= 'https://u-mail.co/api/MoreNewsAPI';

export async function fetchMediaStackArticles(page = 1): Promise<Article[]> {
  const res = await fetch(
    `http://api.mediastack.com/v1/news?access_key=${MEDIASTACK_KEY}&countries=us,gb,ca&limit=100&offset=${
      (page - 1) * 100
    }`
  );
  if (!res.ok) throw new Error('Mediastack error');
  const json = await res.json();
  return json.data.map((d: any) => ({
    source: { id: null, name: d.source, image: null },
    author: d.author,
    title: d.title,
    description: d.description,
    url: d.url,
    urlToImage: d.image,
    publishedAt: d.published_at,
    content: d.description,
    categories: [],
  }));
}

export async function fetchFinnhubArticles(): Promise<Article[]> {
  const res = await fetch(
    `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`
  );
  if (!res.ok) throw new Error('Finnhub news error');
  const json = await res.json();
  return json.map((d: any) => ({
    source: { id: null, name: 'Finnhub', image: null },
    author: d.related,
    title: d.headline,
    description: d.summary,
    url: d.url,
    urlToImage: d.image,
    publishedAt: new Date(d.datetime * 1000).toISOString(),
    content: d.summary,
    categories: [],
  }));
}

export async function fetchUmailArticles(): Promise<Article[]> {
  const res = await fetch(UMAIL_ENDPOINT, { cache: 'no-store' });
  if (!res.ok) throw new Error('U-Mail news proxy error');
  const json = await res.json();
  return json.results.map((d: any) => ({
    source: { id: null, name: d.source, image: null },
    author: d.author,
    title: d.title,
    description: d.description,
    url: d.link,
    urlToImage: d.image,
    images: d.images,
    thumbnails: d.thumbnails,
    publishedAt: d.publishedAt,
    content: d.content,
    categories: d.categories,
  }));
}
