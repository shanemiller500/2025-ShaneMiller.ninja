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

const KEY = process.env.NEXT_PUBLIC_MEDIASTACK_ACCESS_KEY!;
const LIMIT = 100;

export async function fetchMediaStackArticles(page = 1): Promise<Article[]> {
  if (!KEY) throw new Error('Missing MediaStack API key');

  const offset = (page - 1) * LIMIT;
  const url = `https://api.mediastack.com/v1/news?access_key=${KEY}&languages=en&limit=${LIMIT}&offset=${offset}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`MediaStack error: ${res.status}`);

  const data = await res.json();

  return (data.data as any[]).map((raw) => {
    const title = raw.title as string;
    const desc  = (raw.description ?? '') as string;
    const cat   = classify(title, desc);

    return {
      source: {
        id: null,
        name: raw.source || 'MediaStack',
        image: `https://logo.clearbit.com/${new URL(raw.url).hostname}`,
      },
      author: raw.author ?? null,
      title,
      description: desc,
      url: raw.url,
      urlToImage: raw.image || null,
      publishedAt: raw.published_at,
      content: null,
      category: cat,
      categories: [cat],
    } satisfies Article;
  });
}

/* naive keyword classification */
function classify(title: string, desc: string) {
  const txt = `${title} ${desc}`.toLowerCase();
  if (/(sport|football|basketball|tennis)/.test(txt))               return 'Sports';
  if (/(finance|market|stock|economy|money)/.test(txt))             return 'Finance';
  if (/(business|company|corporate|startup)/.test(txt))             return 'Business';
  if (/(tech|technology|software|it\b)/.test(txt))                  return 'Tech';
  return 'World';
}
