'use client';

import { useState, useEffect } from 'react';
import mixpanel from 'mixpanel-browser';
import { fetchMediaStackArticles } from './Mediastack-API-Call';
import { fetchFinnhubArticles } from './Finnhub-API-Call';
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
  publishedAt: string;
  content: string | null;
  category: string;
}

const desiredCategories = [
  'All',
  'Sports',
  'World',
  'News',
  'Finance',
  'Tech',
  'Business',
];

export default function NewsPage() {
  // --- API & Pagination State ---
  const [apiPage, setApiPage] = useState<number>(1);
  const [allMediaArticles, setAllMediaArticles] = useState<Article[]>([]);
  const [clientPage, setClientPage] = useState<number>(1);
  const itemsPerPage = 10;
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [finnhubArticles, setFinnhubArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    desiredCategories[0]
  );
  const [showPageSpinner, setShowPageSpinner] = useState<boolean>(true);

  // --- Mixpanel Initialization ---
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, { debug: true });
      mixpanel.track('News Page Viewed');
    }
  }, []);

  // --- Initial Page Spinner (2 sec) ---
  useEffect(() => {
    const timer = setTimeout(() => setShowPageSpinner(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // --- Fetch MediaStack Articles ---
  useEffect(() => {
    async function loadMediaStack() {
      setLoading(true);
      try {
        const articles = await fetchMediaStackArticles(apiPage);
        if (articles.length === 0) {
          setHasMore(false);
        }
        // Append new articles to the list.
        setAllMediaArticles((prev) => [...prev, ...articles]);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadMediaStack();
  }, [apiPage]);

  // --- Fetch Finnhub Articles ---
  useEffect(() => {
    async function loadFinnhub() {
      try {
        const articles = await fetchFinnhubArticles();
        setFinnhubArticles(articles);
      } catch (err: any) {
        console.error(err);
      }
    }
    loadFinnhub();
  }, []);

  // --- Reset client page when category changes ---
  useEffect(() => {
    setClientPage(1);
  }, [selectedCategory]);

  // --- Handle Tab Clicks ---
  const handleTabClick = (category: string) => {
    mixpanel.track('Tab Clicked', { tab: category });
    setSelectedCategory(category);
  };

  // --- Combine & Filter Articles ---
  let displayedArticles: Article[] = [];
  if (selectedCategory === 'Finance') {
    const mediaFinance = allMediaArticles.filter(
      (article) => article.category === 'Finance'
    );
    const combined = [...mediaFinance, ...finnhubArticles];
    displayedArticles = combined.filter(
      (article, index, arr) =>
        index ===
        arr.findIndex(
          (a) => a.title.toLowerCase() === article.title.toLowerCase()
        )
    );
  } else if (selectedCategory === 'All') {
    displayedArticles = allMediaArticles;
  } else {
    displayedArticles = allMediaArticles.filter(
      (article) => article.category === selectedCategory
    );
  }
  displayedArticles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // --- Client-Side Pagination ---
  const totalPages = Math.ceil(displayedArticles.length / itemsPerPage);
  const paginatedArticles = displayedArticles.slice(
    (clientPage - 1) * itemsPerPage,
    clientPage * itemsPerPage
  );

  const handlePrevPage = () => {
    if (clientPage > 1) {
      setClientPage(clientPage - 1);
      mixpanel.track('Pagination', { direction: 'prev', page: clientPage - 1 });
    }
  };

  const handleNextPage = () => {
    if (clientPage < totalPages) {
      setClientPage(clientPage + 1);
      mixpanel.track('Pagination', { direction: 'next', page: clientPage + 1 });
    } else if (hasMore) {
      setApiPage(apiPage + 1);
      setClientPage(clientPage + 1);
      mixpanel.track('Pagination', { direction: 'next', page: clientPage + 1 });
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
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
        The Miller Gazette
      </h1>
      {error && <p className="text-red-600 mb-4">Error: {error}</p>}

      {/* Tab Bar & Search */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto">
          {desiredCategories.map((category) => (
            <button
              key={category}
              onClick={() => handleTabClick(category)}
              className={`px-3 py-2 rounded whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-indigo-500 text-white'
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

      {/* Main Layout: News Grid and Aside */}
      <div className="flex flex-col lg:flex-row gap-7">
        {/* News Grid */}
        <div className="">
          {paginatedArticles.map((article, index) => {
            const publishedDate = new Date(article.publishedAt);
            const formattedDate = publishedDate.toLocaleDateString();
            const formattedTime = publishedDate.toLocaleTimeString();

            return (
              <div
                key={`${article.url}-${index}`}
                className="rounded-lg shadow overflow-hidden transition-transform duration-300 hover:scale-105 "
              >
                {article.urlToImage && (
                  <div className=" w-full overflow-hidden">
                    <img
                      src={article.urlToImage}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-3">
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                    {article.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                    {article.source.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                    {formattedDate} {formattedTime}
                  </p>
                  <div className="mt-2">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 text-xs inline-flex items-center hover:underline"
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
              </div>
            );
          })}
          {paginatedArticles.length === 0 && (
            <p className="col-span-full text-center text-gray-600">
              No articles found.
            </p>
          )}
          <div className="flex flex-col items-center gap-3 mt-6 pb-6">
        <div className="flex gap-4">
          <button
            onClick={handlePrevPage}
            disabled={clientPage === 1 || loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={handleNextPage}
            disabled={(clientPage === totalPages && !hasMore) || loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <span className="text-sm text-gray-700">
          Page {clientPage} of {totalPages || 1}
        </span>
        {loading && (
          <p className="text-center text-gray-600 mt-2">
            Loading more articles...
          </p>
        )}
      </div>
 
        </div>

        {/* Aside Widgets (visible on all devices) */}
        <aside className="w-full lg:w-[300px] border-t pt-6 lg:border-t-0 lg:pt-0">
          <div className="space-y-6">
            <WidgetNews />
            <CryptoWidget />
            <WidgetWeather />
          </div>
        </aside>
      </div>   
    </div>
  );
}
