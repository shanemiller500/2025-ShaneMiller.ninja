'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';         
/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */

interface NewsItem {
  articleId?: string;
  headline  : string;
  source    : string;
  publishedAt: string;
  link      : string;
  sourceImage?: string;
}

const LOGO_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */
const fadeIn = {
  hidden : { opacity: 0, translateY: 10 },
  visible: (i = 1) => ({
    opacity   : 1,
    translateY: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' },
  }),
};

const WidgetNews: React.FC = () => {
  const [news,    setNews   ] = useState<NewsItem[]>([]);
  const [errorMsg,setError  ] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchNews = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const { data } = await axios.get<{ results: NewsItem[] }>(
        'https://u-mail.co/api/NewsAPI/breaking-news'
      );
      const items = data.results.map((item, i) => ({
        ...item,
        articleId: item.articleId || `${i}-${item.headline}`,
      }));
      setNews(items);
    } catch (err: any) {
      console.error('Error fetching breaking news:', err);
      setError('Failed to load breaking news.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  /* ------------------------------------------------------------------ */
  return (
    <div className="relative rounded-lg bg-white dark:bg-brand-950 p-5 overflow-hidden rounded shadow ">
      {/* overlay spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/50">
          <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      )}

      {/* flashing banner */}
      <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-brand-900 text-center py-1 z-20 animate-pulse">
        Breaking&nbsp;News
      </div>

      {/* refresh button */}
      <div className="absolute top-0 right-0 p-2 z-20">
        <button
          onClick={() => fetchNews(true)}
          className="p-1 hover:text-gray-200 text-brand-900 rounded"
          title="Refresh News"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582A8 8 0 003 12a8 8 0 008 8 8 8 0 007.418-4.582M15 11V4l4 4m-4-4l-4 4"/>
          </svg>
        </button>
      </div>

      {/* news list */}
      <div className="mt-8 space-y-2">
        {errorMsg ? (
          <p>{errorMsg}</p>
        ) : news.length ? (
          <>
            <ul>
              {news.map((item, idx) => (
                <motion.li
                  key={item.articleId!}
                  custom={idx}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  whileHover={{
                    scale   : 1.02,
                    y       : -2,
                    boxShadow:
                      '0 6px 14px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.08)',
                  }}
                  className="bg-gray-50 dark:bg-brand-900/20 rounded-md px-3 py-2 transition-colors"
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start space-x-3 hover:underline"
                  >
                    <img
                      src={item.sourceImage || LOGO_FALLBACK}
                      alt={item.source}
                      className="w-6 h-6 object-contain mt-0.5 flex-shrink-0"
                      loading="lazy"
                    />
                    <div>
                      <h4 className="font-medium leading-snug">{item.headline}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {item.source} &mdash;{' '}
                        {new Date(item.publishedAt).toLocaleString()}
                      </p>
                    </div>
                  </a>
                </motion.li>
              ))}
            </ul>

            <div className="pt-3">
              <p className="text-xs text-gray-500 text-center">
                Read more News&nbsp;
                <a href="/news" className="text-indigo-500 underline">here</a>
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
