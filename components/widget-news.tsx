"use client";

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface NewsItem {
  articleId?: string; // Optional because some items might lack an articleId.
  headline: string;
  source: string;
  publishedAt: string;
  thumbnail: string;
  link: string;
}

const WidgetNews: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [flashVisible, setFlashVisible] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Fetch news data.
   * @param showSpinner - If true, shows a spinner during refresh.
   */
  const fetchNews = async (showSpinner: boolean = false) => {
    if (showSpinner) {
      setLoading(true);
    }

    // Always call the API to fetch fresh news.
    try {
      const response = await axios.get<{ results: NewsItem[] }>(
        'https://u-mail.co/api/NewsAPI/breaking-news'
      );
      const newsData = response.data.results;

      // Ensure each news item has a unique articleId.
      const newsWithIds = newsData.map((item, index) => ({
        ...item,
        articleId: item.articleId || `${index}-${item.headline}`,
      }));

      // Update state with fresh data.
      setNews(newsWithIds);

      // Flash "Breaking News" for 5 seconds.
      setFlashVisible(true);
      setTimeout(() => {
        setFlashVisible(false);
      }, 5000);
    } catch (error: any) {
      console.error('Error fetching breaking news:', error);
      setErrorMsg('Failed to load breaking news.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Initial load without spinner.
  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="relative rounded-lg bg-white dark:bg-brand-950 p-5">
      {/* Spinner overlay during refresh */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-50">
          <svg
            className="animate-spin h-8 w-8 text-white"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-brand-900 text-center py-1 z-20">
        Breaking News
      </div>

      {/* Refresh button icon in the top-right corner */}
      <div className="absolute top-0 right-0 p-2 z-20">
        <button
          onClick={() => fetchNews(true)}
          className="p-1 hover:text-gray-200 text-brand-900 rounded"
          title="Refresh News"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m0 0A7.966 7.966 0 003 12a8 8 0 008 8 8 8 0 007.418-4.582M15 11V4m0 0l4 4m-4-4l-4 4"
            />
          </svg>
        </button>
      </div>

      {/* News Content */}
      <div className="mt-8">
        {errorMsg ? (
          <p>{errorMsg}</p>
        ) : news.length > 0 ? (
          <>
            <ul>
              {news.map((item, index) => (
                <li key={item.articleId || index} className="mb-3">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className=" hover:underline"
                  >
                    {item.headline}
                  </a>
                  <p className="text-sm text-gray-600">
                    {item.source} &mdash;{' '}
                    {new Date(item.publishedAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
            <div className="p-2">
                    <p className="text-xs text-gray-500 text-center">
                      Read more News{" "}
                      <a href="/news" className="text-indigo-500 underline">
                        here
                      </a>
                      
                    </p>
                  </div>
          </>
        ) : (
          <p>Loading breaking news...</p>
        )}
      </div>
    </div>
  );
};

export default WidgetNews;
