'use client';

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

const CACHE_KEY = 'cachedFinnhubArticles';

export async function fetchFinnhubArticles(): Promise<Article[]> {
  const finnhubApiToken = process.env.NEXT_PUBLIC_FINNHUB_API_TOKEN;
  if (!finnhubApiToken) {
    console.warn('Missing Finnhub API token.');
    return [];
  }

  const finnhubUrl = `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiToken}`;
  
  try {
    const response = await fetch(finnhubUrl);
    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const finnhubData = await response.json();

    // Ensure the data is in the expected array format.
    if (!Array.isArray(finnhubData)) {
      throw new Error('Unexpected data format from Finnhub API');
    }

    const articles: Article[] = finnhubData.map((article: any) => ({
      source: {
        id: null,
        name: article.source || 'Finnhub',
      },
      author: null,
      title: article.headline,
      description: article.summary,
      url: article.url,
      urlToImage: article.image || null,
      publishedAt: new Date(article.datetime * 1000).toISOString(),
      content: null,
      category: 'Finance', // You can change this if you want a different category.
    }));

    // Update the cache after fetching
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        articles,
        timestamp: Date.now(),
      })
    );

    return articles;
  } catch (error) {
    console.error('Error fetching Finnhub articles:', error);
    return [];
  }
}
