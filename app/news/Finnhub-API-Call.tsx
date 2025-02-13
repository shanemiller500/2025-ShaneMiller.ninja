// This file handles fetching and caching Finnhub news.
// Finnhub articles are forced into the "Finance" category.

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
  const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  
  export async function fetchFinnhubArticles(): Promise<Article[]> {
    // Check if we have valid cached data
    const cachedString = localStorage.getItem(CACHE_KEY);
    if (cachedString) {
      try {
        const cachedData = JSON.parse(cachedString);
        if (cachedData.timestamp && Date.now() - cachedData.timestamp < CACHE_DURATION) {
          return cachedData.articles;
        }
      } catch (err) {
        console.error("Error parsing cached Finnhub data:", err);
      }
    }
  
    // Fetch new data from Finnhub if no valid cache exists.
    const finnhubApiToken = process.env.NEXT_PUBLIC_FINNHUB_API_TOKEN;
    if (!finnhubApiToken) {
      console.warn("Missing Finnhub API token in environment variables.");
      return [];
    }
  
    const finnhubUrl = `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiToken}`;
    const response = await fetch(finnhubUrl);
    if (!response.ok) {
      console.warn(`Error fetching Finnhub news: ${response.status}`);
      return [];
    }
  
    const finnhubData = await response.json();
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
      // Finnhub returns a Unix timestamp.
      publishedAt: new Date(article.datetime * 1000).toISOString(),
      content: null,
      category: "Finance", // Force Finnhub articles into the Finance category.
    }));
  
    // Cache the articles with the current timestamp.
    const cacheData = {
      articles,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  
    return articles;
  }
  