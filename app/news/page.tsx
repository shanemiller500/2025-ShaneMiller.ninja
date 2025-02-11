'use client';

import { useState, useEffect } from 'react';
import mixpanel from 'mixpanel-browser';

interface Article {
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

// The available tabs. Note that Finnhub articles will have category "Finance".
const desiredCategories = ["All", "Sports", "World", "News", "Finance", "Tech", "Business"];

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(desiredCategories[0]); // default to "All"
  const [page, setPage] = useState<number>(1);
  const [showPageSpinner, setShowPageSpinner] = useState<boolean>(true);

  // Key for caching MediaStack articles in localStorage.
  const CACHE_KEY = 'cachedNewsArticles';

  // Initialize Mixpanel.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, { debug: true });
      mixpanel.track('News Page Viewed');
    }
  }, []);

  // Page load spinner (2 seconds).
  useEffect(() => {
    const timer = setTimeout(() => setShowPageSpinner(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      setError(null);
      try {
        // ================================
        // 1. MEDIASTACK NEWS (with caching)
        // ================================
        // Get cached data (if any) for mediastack articles.
        let cachedData: { articles: Article[]; lastPage: number } = { articles: [], lastPage: 0 };
        const cachedString = localStorage.getItem(CACHE_KEY);
        if (cachedString) {
          cachedData = JSON.parse(cachedString);
        }

        let mediastackArticles: Article[] = [];
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

          // Map fetched MediaStack data into our Article interface.
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
          mediastackArticles = fetchedArticles.map((article) => {
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
  
          // Sort the mediastack articles by published date (newest first).
          mediastackArticles.sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
  
          // Combine with any previously cached mediastack articles.
          if (page === 1) {
            cachedData.articles = mediastackArticles;
          } else {
            cachedData.articles = [...cachedData.articles, ...mediastackArticles];
          }
          cachedData.lastPage = page;
          localStorage.setItem(CACHE_KEY, JSON.stringify(cachedData));
        } else {
          mediastackArticles = cachedData.articles;
        }

        // ===============================
        // 2. FINNHUB NEWS (fresh on every fetch)
        // ===============================
        let finnhubArticles: Article[] = [];
        const finnhubApiToken = process.env.NEXT_PUBLIC_FINNHUB_API_TOKEN;
        if (finnhubApiToken) {
          const finnhubUrl = `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiToken}`;
          const finnhubResponse = await fetch(finnhubUrl);
          if (finnhubResponse.ok) {
            const finnhubData = await finnhubResponse.json();
            finnhubArticles = finnhubData.map((article: any) => ({
              source: {
                id: null,
                name: article.source || 'Finnhub',
              },
              author: null,
              title: article.headline,
              description: article.summary,
              url: article.url,
              urlToImage: article.image || null,
              // Finnhub returns a Unix timestamp for datetime.
              publishedAt: new Date(article.datetime * 1000).toISOString(),
              content: null,
              category: "Finance", // Force these articles into the Finance category.
            }));
          } else {
            console.warn(`Error fetching Finnhub news: ${finnhubResponse.status}`);
          }
        }

        // ===============================
        // 3. COMBINE, REMOVE DUPLICATES, & SORT
        // ===============================
        const combinedArticles = [...mediastackArticles, ...finnhubArticles];
        const uniqueArticles = combinedArticles.filter((article, index, arr) =>
          index === arr.findIndex(a => a.title.toLowerCase() === article.title.toLowerCase())
        );
        uniqueArticles.sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
  
        setArticles(uniqueArticles);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [page]);

  const handleLoadMore = () => {
    setPage((prevPage) => {
      const newPage = prevPage + 1;
      mixpanel.track('Load More Clicked', { currentPage: prevPage, newPage });
      return newPage;
    });
  };

  // Handle tab clicks and fire a Mixpanel event.
  const handleTabClick = (category: string) => {
    mixpanel.track('Tab Clicked', { tab: category });
    setSelectedCategory(category);
  };

  // Filter articles based on the selected tab. (If "All", show everything.)
  const displayedArticles =
    selectedCategory === "All"
      ? articles
      : articles.filter((article) => article.category === selectedCategory);

  if (showPageSpinner) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <p className="mt-4 text-lg text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-5">
      {/* Page Header */}
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        The Miller Gazette
      </h1>

      {error && <p className="text-red-600 mb-4">Error: {error}</p>}

      {/* Tab Bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {desiredCategories.map((category) => (
          <button
            key={category}
            onClick={() => handleTabClick(category)}
            className={`px-4 py-2 rounded transition-colors ${
              selectedCategory === category
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-indigo-500'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayedArticles.map((article, index) => {
          const publishedDate = new Date(article.publishedAt);
          const formattedDate = publishedDate.toLocaleDateString();
          const formattedTime = publishedDate.toLocaleTimeString();
  
          return (
            <div
              key={`${article.url}-${index}`}
              className="rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105"
            >
              {article.urlToImage && (
                <img
                  src={article.urlToImage}
                  alt={article.title}
                  className="w-full object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {article.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                  {article.source.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                  Published on {formattedDate} at {formattedTime}
                </p>
                <div className="mt-4">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:underline text-sm group"
                  >
                    Read More
                    <svg
                      className="w-4 h-4 ml-1 transition-transform duration-300 transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      <div className="flex justify-center mt-6">
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      </div>
    </div>
  );
}
