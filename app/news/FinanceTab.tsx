// Filename: FinanceTab.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchFinanceNews } from './financeNews';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */

interface Article {
  source: { id: string | null; name: string };
  title : string;
  url   : string;
  urlToImage : string | null;
  publishedAt: string;
}

const LOGO_FALLBACK = '/images/wedding.jpg';

function getDomain(url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function smoothScrollToTop(d = 700) {
  const start = window.scrollY, t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / d);
    const ease = p * (2 - p);
    window.scrollTo(0, Math.ceil((1 - ease) * start));
    if (window.scrollY) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/*  Cache (module-level)                                              */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let cachedFinance: { ts: number; data: Article[] } | null = null;

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const PER_PAGE = 36;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function FinanceTab() {
  const [page,     setPage]     = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [fade,     setFade]     = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  /* ---------------------- fetch + cache --------------------------- */
  useEffect(() => {
    let cancel = false;

    (async () => {
      if (cachedFinance && Date.now() - cachedFinance.ts < CACHE_TTL) {
        setArticles(cachedFinance.data);
        return;
      }

      setLoading(true);
      try {
        const financeNews = await fetchFinanceNews();
        if (!cancel) {
          cachedFinance = { ts: Date.now(), data: financeNews };
          setArticles(financeNews);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancel) setError(e.message ?? 'Unknown error');
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
    smoothScrollToTop();
    setFade(true);
    setTimeout(() => {
      setPage(n);
      setFade(false);
    }, 400);
  };

  /* ----------------------------- UI -------------------------------- */
  return (
    <div ref={contentRef}>
      {error && (
        <p className="bg-red-100 text-red-700 p-3 mb-4 rounded font-medium">{error}</p>
      )}

      <section className="w-full">
        <div className={`transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
          {/* Masonry columns */}
          <div className="columns-1 sm:columns-2 md:columns-3 gap-2 space-y-2">
            {slice.map(a => {
              const hasImage = !!a.urlToImage;
              return (
                <a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-inside-avoid block rounded-lg shadow hover:shadow-xl transition transform hover:scale-[1.02] bg-white dark:bg-brand-950"
                >
                  {hasImage && (
                    <img
                      src={a.urlToImage!}
                      onError={e => (e.currentTarget.style.display = 'none')}
                      alt={a.title}
                      className="w-full h-36 object-cover"
                    />
                  )}

                  <div className={`p-4 flex flex-col gap-1 ${hasImage ? 'mt-1' : ''}`}>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <img
                        src={`https://logo.clearbit.com/${getDomain(a.url)}`}
                        onError={e => (e.currentTarget.src = LOGO_FALLBACK)}
                        alt={a.source.name}
                        className="w-10 h-10 object-contain"
                      />
                      <span>{a.source.name}</span>
                    </div>

                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(a.publishedAt).toLocaleDateString()}
                    </span>

                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug line-clamp-3">
                      {a.title}
                    </h3>
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
    </div>
  );
}

/* Pagination controls */
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
