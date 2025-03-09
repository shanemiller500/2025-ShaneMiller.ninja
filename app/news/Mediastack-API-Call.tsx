// This file handles the MediaStack API call (with caching) and recategorization logic.

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
  
  const CACHE_KEY = 'cachedNewsArticles';
  
  export async function fetchMediaStackArticles(page: number): Promise<Article[]> {
    // Retrieve any cached data from localStorage.
    let cachedData: { articles: Article[]; lastPage: number } = { articles: [], lastPage: 0 };
    const cachedString = localStorage.getItem(CACHE_KEY);
    if (cachedString) {
      cachedData = JSON.parse(cachedString);
    }
  
    const mediastackApiKey = process.env.NEXT_PUBLIC_MEDIASTACK_ACCESS_KEY;
    if (!mediastackApiKey) {
      throw new Error('Missing MediaStack API key in environment variables.');
    }
  
    // If this page has not been fetched before, call the MediaStack API.
    if (page > cachedData.lastPage) {
      const limit = 100;
      const offset = (page - 1) * limit;
      const mediastackUrl = `https://api.mediastack.com/v1/news?access_key=${mediastackApiKey}&languages=en&limit=${limit}&offset=${offset}`;
      const response = await fetch(mediastackUrl);
      if (!response.ok) {
        throw new Error(`Error fetching news from MediaStack: ${response.status}`);
      }
      const mediastackData = await response.json();
  
      // Map the fetched data to our Article interface.
      const fetchedArticles: Article[] = (mediastackData.data as any[]).map((article) => ({
        source: {
          id: null,
          name: article.source || 'Unknown',
        },
        author: article.author || null,
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.image || null,
        publishedAt: article.published_at,
        content: null,
        category: article.category || 'News',
      }));
  
      // Re-categorize articles based on keywords.
      const mediaArticles = fetchedArticles.map((article) => {
        const lowerTitle = article.title.toLowerCase();
        const lowerDesc = article.description ? article.description.toLowerCase() : "";
        if (
          lowerTitle.includes("sport") ||
          lowerDesc.includes("sport") ||
          lowerTitle.includes("football") ||
          lowerDesc.includes("football") ||
          lowerTitle.includes("basketball") ||
          lowerDesc.includes("basketball") ||
          lowerTitle.includes("tennis") ||
          lowerDesc.includes("tennis")
        ) {
          return { ...article, category: "Sports" };
        } else if (
          lowerTitle.includes("world") ||
          lowerDesc.includes("world") ||
          lowerTitle.includes("global") ||
          lowerDesc.includes("global") ||
          lowerTitle.includes("international") ||
          lowerDesc.includes("international")
        ) {
          return { ...article, category: "World" };
        } else if (
          lowerTitle.includes("finance") ||
          lowerDesc.includes("finance") ||
          lowerTitle.includes("market") ||
          lowerDesc.includes("market") ||
          lowerTitle.includes("stock") ||
          lowerDesc.includes("stock") ||
          lowerTitle.includes("money") ||
          lowerDesc.includes("money") ||
          lowerTitle.includes("economy") ||
          lowerDesc.includes("economy")
        ) {
          return { ...article, category: "Finance" };
        } else if (
          lowerTitle.includes("tech") ||
          lowerDesc.includes("tech") ||
          lowerTitle.includes("technology") ||
          lowerDesc.includes("technology") ||
          lowerTitle.includes("software") ||
          lowerDesc.includes("software") ||
          lowerTitle.includes("it ")
        ) {
          return { ...article, category: "Tech" };
        } else if (
          lowerTitle.includes("business") ||
          lowerDesc.includes("business") ||
          lowerTitle.includes("company") ||
          lowerDesc.includes("company") ||
          lowerTitle.includes("corporate") ||
          lowerDesc.includes("corporate") ||
          lowerTitle.includes("startup") ||
          lowerDesc.includes("startup")
        ) {
          return { ...article, category: "Business" };
        } else {
          return { ...article, category: "News" };
        }
      });
  
      // Sort the articles by published date (newest first).
      mediaArticles.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
  
      // Combine with any previously cached articles.
      if (page === 1) {
        cachedData.articles = mediaArticles;
      } else {
        cachedData.articles = [...cachedData.articles, ...mediaArticles];
      }
      cachedData.lastPage = page;
      localStorage.setItem(CACHE_KEY, JSON.stringify(cachedData));
    }
  
    return cachedData.articles;
  }
  