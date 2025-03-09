// Umail-API-Call.ts
// This file fetches news articles from the u‑mail API route and maps them to our Article interface.

export interface Article {
    source: {
      id: string | null;
      name: string;
    };
    author: string | null;
    title: string;
    description: string;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    content: string | null;
    category: string;
  }
  
  export async function fetchUmailArticles(): Promise<Article[]> {
    try {
      const response = await fetch('https://u-mail.co/api/NewsAPI/More-news');
      if (!response.ok) {
        throw new Error(`Error fetching news from u‑mail: ${response.status}`);
      }
      const data = await response.json();
      // Map each API result to our Article interface.
      const articles: Article[] = data.results.map((item: any) => ({
        source: { id: null, name: item.source },
        author: null,
        title: item.headline,
        description: '',
        url: item.link,
        urlToImage: item.image,
        publishedAt: item.publishedAt,
        content: null,
        category: 'News', // Default category for u‑mail articles.
      }));
      return articles;
    } catch (error: any) {
      console.error('fetchUmailArticles error:', error);
      return [];
    }
  }
  