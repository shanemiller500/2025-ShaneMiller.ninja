'use client';

import { useState, useEffect } from 'react';

import { fetchMediaStackArticles } from './Mediastack-API-Call';
import { fetchFinnhubArticles } from './Finnhub-API-Call';
import { fetchUmailArticles } from './MoreNewsAPI'; // use the external definition
import WidgetNews from '@/components/widget-news';
import WidgetWeather from '@/components/widget-weather';
import CryptoWidget from '@/components/widget-crypto';
import WidgetSearch from '@/components/widget-search';

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
  images: string[];
  thumbnails: string[];
  publishedAt: string;
  content: string | null;
  categories: string[];
}

const desiredCategories = [ 'News', 'Sports', 'World', 'Finance', 'Business'];

// Featured News Slider Component – now displays thumbnails (if provided) exactly as received.
function FeaturedNewsSlider({ articles }: { articles: Article[] }) {
  const sliderArticles = articles.slice(0, 5);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (sliderArticles.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderArticles.length);
    }, 4000); // auto-slide every 4 seconds
    return () => clearInterval(interval);
  }, [sliderArticles.length]);

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex transition-transform duration-700"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {sliderArticles.map((article, index) => {
          const publishedDate = new Date(article.publishedAt);
          const formattedDate = publishedDate.toLocaleDateString();
          const formattedTime = publishedDate.toLocaleTimeString();

          return (
            <div
              key={`${article.url}-${index}`}
              className="min-w-full rounded-lg shadow-xl overflow-hidden hover:scale-105 transform transition duration-300"
            >
              {article.urlToImage && (
                <div className="relative">
                  <img
                    src={article.urlToImage}
                    alt={article.title}
                    className="w-full h-64 object-cover"
                  />
                  {/* Display thumbnails as provided by the API */}
                  {article.thumbnails && article.thumbnails.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-2 p-2 bg-black bg-opacity-50">
                      {article.thumbnails.map((thumb, i) => (
                        <img
                          key={i}
                          src={thumb}
                          alt={`Thumbnail ${i + 1}`}
                          className="w-10 h-10 object-cover border border-white"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {article.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                  {article.source.name} &bull; {formattedDate} {formattedTime}
                </p>
                {article.author && (
                  <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                    By {article.author}
                  </p>
                )}
                <div className="mt-4">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:underline"
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
    </div>
  );
}

export default function NewsPage() {
  const [apiPage, setApiPage] = useState<number>(1);
  const itemsPerPage = 12;
  const [allMediaArticles, setAllMediaArticles] = useState<Article[]>([]);
  const [umailArticles, setUmailArticles] = useState<Article[]>([]);
  const [finnhubArticles, setFinnhubArticles] = useState<Article[]>([]);
  const [clientPage, setClientPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(desiredCategories[0]);
  const [showPageSpinner, setShowPageSpinner] = useState<boolean>(true);



  // Initial Page Spinner (2 sec)
  useEffect(() => {
    const timer = setTimeout(() => setShowPageSpinner(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch MediaStack Articles with Caching
  useEffect(() => {
    async function loadMediaStack() {
      setLoading(true);
      try {
        const cacheKey = `mediastackArticles_page_${apiPage}`;
        const cachedData = localStorage.getItem(cacheKey);
        let articles = [];

        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          const now = new Date().getTime();
          if (now - parsedData.timestamp < 24 * 60 * 60 * 1000) {
            articles = parsedData.articles;
          }
        }

        if (articles.length === 0) {
          articles = await fetchMediaStackArticles(apiPage);
          const dataToCache = {
            timestamp: new Date().getTime(),
            articles: articles,
          };
          localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        }

        if (articles.length === 0) {
          setHasMore(false);
        }

        const articlesWithCategories = articles.map((article: { category?: string }) => ({
          ...article,
          categories: article.category ? [article.category] : ['News']
        }));
        setAllMediaArticles(prev => [...prev, ...articlesWithCategories]);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadMediaStack();
  }, [apiPage]);

  // Fetch Finnhub Articles (No Caching)
  useEffect(() => {
    async function loadFinnhub() {
      try {
        const articles = await fetchFinnhubArticles();
        const articlesWithCategories = articles.map(article => ({
          ...article,
          categories: article.category ? [article.category] : ['Finance'],
          images: [],
          thumbnails: []
        }));
        setFinnhubArticles(articlesWithCategories);
      } catch (err: any) {
        console.error(err);
      }
    }
    loadFinnhub();
  }, []);

  // Fetch U‑mail Articles (No Caching)
  useEffect(() => {
    async function loadUmail() {
      try {
        const articles = await fetchUmailArticles();
        const articlesWithCategories = articles.map(article => ({
          ...article,
          categories: article.categories && article.categories.length > 0 ? article.categories : ['News']
        }));
        setUmailArticles(articlesWithCategories);
      } catch (err: any) {
        console.error(err);
      }
    }
    loadUmail();
  }, []);

  // Reset client page when category changes
  useEffect(() => {
    setClientPage(1);
  }, [selectedCategory]);

  // Handle Tab Clicks
  const handleTabClick = (category: string) => {

    setSelectedCategory(category);
  };

  // Remove Duplicate Articles by Title
  function removeDuplicateArticles(articles: Article[]): Article[] {
    return articles.filter((article, index, arr) =>
      index === arr.findIndex(a => a.title.toLowerCase() === article.title.toLowerCase())
    );
  }

  // Combine All Articles from All Sources
  const combinedArticles = removeDuplicateArticles([
    ...allMediaArticles,
    ...finnhubArticles,
    ...umailArticles,
  ]);

  // Filter Articles Based on Selected Category
  const displayedArticles = selectedCategory === 'News'
    ? combinedArticles
    : combinedArticles.filter(article =>
        article.categories
          .filter(cat => typeof cat === 'string')
          .some(cat => cat.toLowerCase() === selectedCategory.toLowerCase())
      );

  // Sort articles by published date (newest first)
  displayedArticles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Client-Side Pagination
  const totalPages = Math.ceil(displayedArticles.length / itemsPerPage);
  const paginatedArticles = displayedArticles.slice(
    (clientPage - 1) * itemsPerPage,
    clientPage * itemsPerPage
  );

  // Separate Articles: With Image (big card) vs. Without Image (grid)
  const articlesWithImage = paginatedArticles.filter(article => article.urlToImage);
  const articlesWithoutImage = paginatedArticles.filter(article => !article.urlToImage);

  const handlePrevPage = () => {
    if (clientPage > 1) {
      setClientPage(clientPage - 1);
    }
  };

  const handleNextPage = () => {
    if (clientPage < totalPages) {
      setClientPage(clientPage + 1);
    } else if (hasMore) {
      setApiPage(apiPage + 1);
      setClientPage(clientPage + 1);
    }
  };

  if (showPageSpinner) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-indigo-600 mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            ></path>
          </svg>
          <p className="mt-4 text-lg text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-4">
      {/* Page Header */}
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        The Miller Gazette
      </h1>
      {error && <p className="text-red-600 mb-4">Error: {error}</p>}

      {/* Tab Bar & Search */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto">
          {desiredCategories.map((category) => (
            <button
              key={category}
              onClick={() => handleTabClick(category)}
              className={`px-4 py-2 rounded whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'hover:bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="flex-shrink-0">
          <WidgetSearch />
        </div>
      </div>

      {/* Main Layout: News and Aside */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* News Content */}
        <div className="flex-1 space-y-8">
          {/* Featured News Slider */}
          {articlesWithImage.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
                Featured News
              </h2>
              <FeaturedNewsSlider articles={articlesWithImage} />
            </div>
          )}

          {/* Grid for Articles Without Image */}
          {articlesWithoutImage.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
                Other News
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {articlesWithoutImage.map((article, index) => {
                  const publishedDate = new Date(article.publishedAt);
                  const formattedDate = publishedDate.toLocaleDateString();
                  const formattedTime = publishedDate.toLocaleTimeString();

                  return (
                    <div
                      key={`${article.url}-${index}`}
                      className="rounded-lg shadow-lg overflow-hidden hover:scale-105 transform transition duration-300 p-4 flex flex-col justify-between"
                    >
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                        {article.source.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                        {formattedDate} {formattedTime}
                      </p>
                      {/* Optionally display thumbnails if available */}
                      {article.thumbnails && article.thumbnails.length > 0 && (
                        <div className="mt-2 flex space-x-2">
                          {article.thumbnails.map((thumb, idx) => (
                            <img
                              key={idx}
                              src={thumb}
                              alt={`Thumbnail ${idx + 1}`}
                              className="w-8 h-8 object-cover border"
                            />
                          ))}
                        </div>
                      )}
                      <div className="mt-3">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                        >
                          Read More
                          <svg
                            className="w-3 h-3 ml-1 transition-transform duration-300 transform group-hover:translate-x-1"
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
                  );
                })}
              </div>
            </div>
          )}

          {paginatedArticles.length === 0 && (
            <p className="text-center text-gray-600">No articles found.</p>
          )}

          {/* Pagination Controls */}
          <div className="flex flex-col items-center gap-4 mt-8 pb-8">
            <div className="flex gap-4">
              <button
                onClick={handlePrevPage}
                disabled={clientPage === 1 || loading}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={(clientPage === totalPages && !hasMore) || loading}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <span className="text-sm text-gray-700">
              Page {clientPage} of {totalPages || 1}
            </span>
            {loading && (
              <p className="text-center text-gray-600 mt-2">Loading more articles...</p>
            )}
          </div>
        </div>

        {/* Aside Widgets */}
        <aside className="w-full lg:w-[300px] border-t pt-6 lg:border-t-0 lg:pt-0">
          <div className="space-y-6">
            <WidgetWeather />
            <WidgetNews />
            <CryptoWidget />
          </div>
        </aside>
      </div>
    </div>
  );
}
