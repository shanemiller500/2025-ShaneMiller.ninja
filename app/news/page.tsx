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

const desiredCategories = ["Sports", "World", "News", "Finance", "Tech", "Business"];

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(desiredCategories[0]);
  const [page, setPage] = useState<number>(1);

  // Initialize Mixpanel once.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, { debug: true });
      mixpanel.track('News Page Viewed');
    }
  }, []);

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      setError(null);

      try {
        // Retrieve the MediaStack API key from environment variables.
        const mediastackApiKey = process.env.NEXT_PUBLIC_MEDIASTACK_ACCESS_KEY;
        if (!mediastackApiKey) {
          throw new Error('Missing MediaStack API key in environment variables.');
        }

        // Define pagination values.
        const limit = 100;
        const offset = (page - 1) * limit;

        // Construct MediaStack API URL with language filtering.
        const mediastackUrl = `https://api.mediastack.com/v1/news?access_key=${mediastackApiKey}&languages=en&limit=${limit}&offset=${offset}`;

        // Fetch the MediaStack API.
        const response = await fetch(mediastackUrl);
        if (!response.ok) {
          throw new Error(`Error fetching news from MediaStack: ${response.status}`);
        }

        const mediastackData = await response.json();

        // Map MediaStack results into the Article interface.
        const mediastackArticles: Article[] = (mediastackData.data as any[]).map((article) => ({
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
          // Use provided category or default.
          category: article.category || 'News',
        }));

        // Re-categorize articles based on keywords.
        const recategorizedArticles = mediastackArticles.map((article) => {
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
        recategorizedArticles.sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        setArticles((prevArticles) =>
          page === 1 ? recategorizedArticles : [...prevArticles, ...recategorizedArticles]
        );
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

  // Filter articles based on the selected category.
  const displayedArticles = articles.filter(
    (article) => article.category === selectedCategory
  );

  return (
    <div className="max-w-6xl mx-auto p-5">
      {/* Page Header */}
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        The Miller Gazette
      </h1>

      {error && <p className="text-red-600 mb-4">Error: {error}</p>}

      {/* Tab Bar for Fixed Categories */}
      <div className="mb-6 flex flex-wrap gap-2">
        {desiredCategories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
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

      {/* News Grid for the selected category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayedArticles.map((article, index) => {
          const publishedDate = new Date(article.publishedAt);
          const formattedDate = publishedDate.toLocaleDateString();
          const formattedTime = publishedDate.toLocaleTimeString();

          return (
            <div
              key={`${selectedCategory}-${index}`}
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
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  {article.description}
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
