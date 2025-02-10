'use client';

import { useState, useEffect } from 'react';

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
}

export default function WidgetNews() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNews() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY;
        if (!apiKey) {
          throw new Error('Missing API key in environment variables.');
        }
        // Fetch only 5 articles for the widget.
        const url = `https://newsapi.org/v2/everything?q=latest&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error fetching news: ${response.status}`);
        }
        const data = await response.json();
        setArticles(data.articles as Article[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      {/* Top header */}
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Latest News</h2>

      {loading && <p>Loading news...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      {!loading && !error && (
        <div className="space-y-6">
          {articles.map((article, index) => (
            <div
              key={index}
              className="rounded-lg shadow-md overflow-hidden p-4 flex flex-col md:flex-row items-center transition-transform duration-300 hover:scale-105"
            >
              {/* Title & source */}
              <div className="flex-grow md:ml-4 mt-4 md:mt-0">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {article.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                  {article.source.name}
                </p>
              </div>

              {/* "Read More" link for the article */}
              <div className="mt-4 md:mt-0">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline group text-sm"
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
          ))}
        </div>
      )}

      {/* Bottom link to the full news page */}
      <div className="mt-4 text-center">
        <a
          href="/news"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Read More News
        </a>
      </div>
    </div>
  );
}
