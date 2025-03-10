'use client';

import { useState, useEffect, useRef } from 'react';

import { fetchMediaStackArticles } from './Mediastack-API-Call';
import { fetchFinnhubArticles } from './Finnhub-API-Call';
import { fetchUmailArticles } from './MoreNewsAPI';
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

const desiredCategories = ['News', 'Sports', 'World', 'Finance', 'Business'];

/**
 * smoothScrollToTop animates scrolling to the top over a specified duration.
 */
function smoothScrollToTop(duration = 1000) {
  const start = window.scrollY;
  const startTime = performance.now();

  function scroll() {
    const now = performance.now();
    const time = Math.min(1, (now - startTime) / duration);
    // easeOutQuad easing
    const easeOutQuad = time * (2 - time);
    window.scrollTo(0, Math.ceil((1 - easeOutQuad) * start));
    if (window.scrollY > 0) {
      requestAnimationFrame(scroll);
    }
  }
  requestAnimationFrame(scroll);
}

// Featured News Slider – displays all articles with images.
function FeaturedNewsSlider({ articles }: { articles: Article[] }) {
  const sliderArticles = articles.slice(0, 5);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (sliderArticles.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderArticles.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [sliderArticles.length]);

  return (
    <div className="relative overflow-hidden">
      <div
        className="whitespace-nowrap transition-transform duration-700"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {sliderArticles.map((article, index) => {
          const publishedDate = new Date(article.publishedAt);
          const formattedDate = publishedDate.toLocaleDateString();
          const formattedTime = publishedDate.toLocaleTimeString();
          return (
            <div
              key={`${article.url}-${index}`}
              className="inline-block w-full rounded-lg shadow-xl overflow-hidden hover:scale-105 transform transition duration-300"
            >
              {article.urlToImage && (
                <div className="relative">
                  {/* Use a smaller height on mobile (h-38) and larger on small+ screens (sm:h-64) */}
                  <img
                    src={article.urlToImage}
                    alt={article.title}
                    className="w-full h-38 sm:h-64 object-cover"
                  />
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
                <h3 className="font-bold text-gray-800 dark:text-gray-100">
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
  const itemsPerPage = 30;
  const [allMediaArticles, setAllMediaArticles] = useState<Article[]>([]);
  const [umailArticles, setUmailArticles] = useState<Article[]>([]);
  const [finnhubArticles, setFinnhubArticles] = useState<Article[]>([]);
  const [clientPage, setClientPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(desiredCategories[0]);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch MediaStack Articles (with caching)
  useEffect(() => {
    async function loadMediaStack() {
      setLoading(true);
      try {
        const cacheKey = `mediastackArticles_page_${apiPage}`;
        const cachedData = localStorage.getItem(cacheKey);
        let articles: Article[] = [];
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          const now = new Date().getTime();
          if (now - parsedData.timestamp < 24 * 60 * 60 * 1000) {
            articles = parsedData.articles;
          }
        }
        if (articles.length === 0) {
          const fetchedArticles = await fetchMediaStackArticles(apiPage);
          articles = fetchedArticles.map((article) => ({
            ...article,
            images: [],
            thumbnails: [],
            categories: article.category ? [article.category] : ['News'],
          }));
          const dataToCache = {
            timestamp: new Date().getTime(),
            articles,
          };
          localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        }
        if (articles.length === 0) {
          setHasMore(false);
        }
        const articlesWithCategories = (articles as any[]).map((article) => ({
          ...article,
          images: [],
          thumbnails: [],
          categories: article.category ? [article.category] : ['News'],
        }));
        setAllMediaArticles((prev) => [...prev, ...articlesWithCategories]);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadMediaStack();
  }, [apiPage]);

  // Fetch Finnhub Articles (no caching)
  useEffect(() => {
    async function loadFinnhub() {
      try {
        const articles = await fetchFinnhubArticles();
        const articlesWithCategories = articles.map((article) => ({
          ...article,
          images: [],
          thumbnails: [],
          categories: article.category ? [article.category] : ['News'],
        }));
        setFinnhubArticles(articlesWithCategories);
      } catch (err: any) {
        console.error(err);
      }
    }
    loadFinnhub();
  }, []);

  // Fetch U‑mail Articles (no caching)
  useEffect(() => {
    async function loadUmail() {
      try {
        const articles = await fetchUmailArticles();
        const articlesWithCategories = articles.map((article: Article) => ({
          ...article,
          categories:
            article.categories && article.categories.length > 0 ? article.categories : ['News'],
        }));
        setUmailArticles(articlesWithCategories);
      } catch (err: any) {
        console.error(err);
      }
    }
    loadUmail();
  }, []);

  // Reset page when category changes.
  useEffect(() => {
    setClientPage(1);
  }, [selectedCategory]);

  // Handle Tab Clicks.
  const handleTabClick = (category: string) => {
    setSelectedCategory(category);
  };

  // Remove duplicate articles by title.
  function removeDuplicateArticles(articles: Article[]): Article[] {
    return articles.filter(
      (article, index, arr) =>
        index === arr.findIndex((a) => a.title.toLowerCase() === article.title.toLowerCase())
    );
  }

  // Combine articles from all sources and filter by category.
  const combinedArticles = removeDuplicateArticles([
    ...allMediaArticles,
    ...finnhubArticles,
    ...umailArticles,
  ]);

  const filteredArticles =
    selectedCategory === 'News'
      ? combinedArticles
      : combinedArticles.filter((article) =>
          article.categories.some(
            (cat) =>
              typeof cat === 'string' && cat.toLowerCase() === selectedCategory.toLowerCase()
          )
        );

  // Sort by newest first.
  filteredArticles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Separate into featured (with images) and new news (without images).
  const featuredArticles = filteredArticles.filter((article) => article.urlToImage);
  const nonFeaturedArticles = filteredArticles.filter((article) => !article.urlToImage);

  // Paginate new news (non-featured articles).
  const totalPages = Math.ceil(nonFeaturedArticles.length / itemsPerPage);
  const paginatedNews = nonFeaturedArticles.slice(
    (clientPage - 1) * itemsPerPage,
    clientPage * itemsPerPage
  );

  // Headlines: first 15 of the paginated non‑featured articles.
  const headlineArticles = paginatedNews.slice(0, 15);
  const remainingOtherNews = paginatedNews.slice(15);

  // Divide headlines into three columns.
  const columnSize = Math.ceil(headlineArticles.length / 3);
  const headlineColumns = [
    headlineArticles.slice(0, columnSize),
    headlineArticles.slice(columnSize, 2 * columnSize),
    headlineArticles.slice(2 * columnSize),
  ];

  // Helper to change page.
  const scrollAndChangePage = (newClientPage: number, updateApi: boolean = false) => {
    // Use our custom smooth scroll helper.
    smoothScrollToTop(1000);
    setIsTransitioning(true);
    setTimeout(() => {
      if (updateApi) {
        setApiPage((prev) => prev + 1);
      }
      setClientPage(newClientPage);
      setIsTransitioning(false);
    }, 1200);
  };

  const handlePrevPage = () => {
    if (clientPage > 1 && !isTransitioning) {
      scrollAndChangePage(clientPage - 1);
    }
  };

  const handleNextPage = () => {
    if (!isTransitioning) {
      if (clientPage < totalPages) {
        scrollAndChangePage(clientPage + 1);
      } else if (hasMore) {
        scrollAndChangePage(clientPage + 1, true);
      }
    }
  };

  return (
    <div ref={contentRef} className="max-w-6xl mx-auto w-full px-4 py-4">
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
        {/* News Content with fixed max width */}
        <div className="flex-1 w-full lg:max-w-[700px]">
          {/* Featured News always displayed at the top */}
          {featuredArticles.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
                Featured News
              </h2>
              <FeaturedNewsSlider articles={featuredArticles} />
            </div>
          )}

          {/* New News (Headlines & Other News) with fade transition */}
          <div
            className={`transition-opacity duration-500 ${
              isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {headlineArticles.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
                  Headlines
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {headlineColumns.map((column, colIndex) => (
                    <div key={colIndex} className="flex flex-col space-y-2">
                      {column.map((article, index) => (
                        <a
                          key={`${article.url}-${index}`}
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                        >
                          {article.title}
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {remainingOtherNews.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
                  Other News
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
                  {remainingOtherNews.map((article, index) => {
                    const publishedDate = new Date(article.publishedAt);
                    const formattedDate = publishedDate.toLocaleDateString();
                    const formattedTime = publishedDate.toLocaleTimeString();
                    return (
                      <div
                        key={`${article.url}-${index}`}
                        className="rounded-lg shadow-lg overflow-hidden hover:scale-105 transform transition duration-300 p-4 flex flex-col min-h-[10px]"
                      >
                        <h3 className=" font-semibold text-gray-800 dark:text-gray-100">
                          {article.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                          {article.source.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                          {formattedDate} {formattedTime}
                        </p>
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

            {paginatedNews.length === 0 && (
              <p className="text-center text-gray-600">No articles found.</p>
            )}

            {/* Pagination Controls */}
            <div className="flex flex-col items-center gap-4 mt-8 pb-8">
              <div className="flex gap-4">
                <button
                  onClick={handlePrevPage}
                  disabled={clientPage === 1 || loading || isTransitioning}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={(clientPage === totalPages && !hasMore) || loading || isTransitioning}
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
        </div>

        {/* Aside Widgets with fixed width on large screens; full width on mobile */}
        <aside className="w-full lg:w-[300px] border-t pt-6 lg:border-t-0 lg:pt-0">
          <div className="space-y-6">
            <WidgetWeather />
            <CryptoWidget />
            <WidgetNews />
          </div>
        </aside>
      </div>
    </div>
  );
}
