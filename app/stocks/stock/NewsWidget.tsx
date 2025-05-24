// Filename: NewsWidget.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchFinanceNews } from '../../news/financeNews';
import { formatDate }       from '@/utils/formatters';

/* ------------------------------------------------------------------ */
/*  Types & cache                                                     */
/* ------------------------------------------------------------------ */
interface Article {
  source: { id: string | null; name: string };
  title : string;
  url   : string;
  urlToImage : string | null;
  publishedAt: string;
  description?: string | null;
}

const LOGO_FALLBACK = '/images/wedding.jpg';
const CACHE_TTL     = 30 * 60 * 1_000;         // 30 min
let cached: { ts: number; data: Article[] } | null = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const getDomain = (url: string) => {
  try { return new URL(url).hostname; } catch { return ''; }
};

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const PER_PAGE = 22;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function NewsWidget() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [fade,     setFade]     = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  /* ---------------------- fetch + cache --------------------------- */
  useEffect(() => {
    let cancel = false;

    (async () => {
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setArticles(cached.data);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchFinanceNews();
        if (!cancel) {
          cached = { ts: Date.now(), data };
          setArticles(data);
        }
      } catch (e: any) {
        if (!cancel) setError(e.message ?? 'Unable to load news');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, []);

  /* ----------------------- paging helpers ------------------------- */
  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
  const startIdx   = (page - 1) * PER_PAGE;
  const slice      = articles.slice(startIdx, startIdx + PER_PAGE);

  const turnPage = (n: number) => {
    if (fade) return;
    if (contentRef.current) contentRef.current.scrollIntoView({ behavior: 'smooth' });
    setFade(true);
    setTimeout(() => {
      setPage(n);
      setFade(false);
    }, 400);
  };

  /* ----------------------------- UI -------------------------------- */
  return (
    <section ref={contentRef} className="p-4 rounded shadow bg-white dark:bg-brand-950">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        Latest Finance News
      </h2>

      {loading && <p className="text-center">Loading news…</p>}
      {error   && <p className="text-center text-red-600">{error}</p>}
      {!loading && !error && articles.length === 0 && (
        <p className="text-center">No news found.</p>
      )}

      <div className={`transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-2 dark:bg-brand-950 bg-white">
          {slice.map((n) => {
            const hasImage = !!n.urlToImage;
            return (
              <a
                key={n.url}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-inside-avoid block rounded-lg shadow hover:shadow-xl transition transform hover:scale-[1.02] bg-white dark:bg-brand-950"
              >
                {hasImage && (
                  <img
                    src={n.urlToImage!}
                    alt={n.title}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                    className="w-full h-36 object-cover"
                  />
                )}

                <div className={`p-4 flex flex-col sm gap-1 ${hasImage ? 'mt-1' : ''}`}>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <img
                      src={`https://logo.clearbit.com/${getDomain(n.url)}`}
                      onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
                      alt={n.source.name}
                      className="w-8 h-8 object-contain"
                    />
                    <span className="truncate max-w-[140px]">{n.source.name}</span>
                  </div>

                  <span className="text-xs text-gray-400 dark:text-gray-500">
                   {formatDate(Date.parse(n.publishedAt))}
                  </span>

                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug line-clamp-3">
                    {n.title}
                  </h3>

                  {n.description && (
                    <p className="text-sm line-clamp-2 text-gray-600 dark:text-gray-300">
                      {n.description}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => turnPage(page - 1)}
          onNext={() => turnPage(page + 1)}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                        */
/* ------------------------------------------------------------------ */
function Pagination({
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 mt-8 pb-8">
      <div className="flex gap-4">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="px-4 py-2 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={(page === totalPages && !loading) || loading}
          onClick={onNext}
          className="px-4 py-2 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Page {page} / {totalPages}
      </span>
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading…</p>}
    </div>
  );
}
