'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchSportsNews }        from './sportsNews';
import LiveScores                 from './LiveScores';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */

interface Article {
  source: { id: string | null; name: string };
  title: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

const LOGO_FALLBACK = '/images/wedding.jpg';

/* ---------- utilities ---------- */
const getDomain = (u: string) => { try { return new URL(u).hostname; } catch { return ''; } };

/* ------------------------------------------------------------------ */
/*  Cache & constants                                                 */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 30 * 60 * 1000;

const cachedNews: Record<string, { ts: number; data: Article[] }> = {};

const PER_PAGE   = 36;
const CATEGORIES = [
  { key: 'all',    label: 'Latest World Sports' },
  { key: 'nba',    label: 'NBA'  },
  { key: 'nfl',    label: 'NFL'  },
  { key: 'mlb',    label: 'MLB'  },
  { key: 'nhl',    label: 'NHL'  },
  { key: 'soccer', label: 'Soccer' },
  { key: 'mma',    label: 'MMA'  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function SportsTab() {
  /* ----- state ----- */
  const [subTab, setSubTab]     = useState('all');
  const [page, setPage]         = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Fetch NEWS                                                        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancel = false;
    setError(null);

    if (cachedNews[subTab] && Date.now() - cachedNews[subTab].ts < CACHE_TTL) {
      setArticles(cachedNews[subTab].data); return;
    }

    setLoading(true);
    (async () => {
      try {
        let news: Article[] = [];
        if (subTab === 'all') {
          news = await fetchSportsNews();
        } else {
          const res  = await fetch(`https://u-mail.co/api/sportsByCategory/${subTab}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`API ${subTab} error: ${res.status}`);
          const json = await res.json();
          news = (json.results as any[]).map(it => ({
            title: it.title,
            url: it.link,
            urlToImage: it.image ?? null,
            publishedAt: it.publishedAt,
            source: { id: null, name: it.source },
          }));
        }
        if (!cancel) {
          cachedNews[subTab] = { ts: Date.now(), data: news };
          setArticles(news); setPage(1);
        }
      } catch (e: any) {
        if (!cancel) setError(e.message ?? 'Unknown error');
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [subTab]);

  /* ------------------------------------------------------------------ */
  /*  Paging helpers                                                    */
  /* ------------------------------------------------------------------ */

  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
  const visibleNews = useMemo(() => {
    const uniq: Article[] = []; const seen = new Set<string>();
    for (const a of articles) if (!seen.has(a.url)) { seen.add(a.url); uniq.push(a); }
    return uniq.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  }, [articles, page]);

  /* ------------------------------------------------------------------ */
  /*  JSX                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="pb-6">

      {/* ---- category selector ---- */}
      {/* dropdown (mobile) */}
      <select
        value={subTab}
        onChange={e => setSubTab(e.target.value)}
        className="block w-full rounded bg-gray-200 px-3 py-2 text-sm text-gray-800
                   focus:outline-none dark:bg-gray-700 dark:text-gray-100 sm:hidden"
      >
        {CATEGORIES.map(c => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </select>

      {/* pill buttons (≥sm) */}
      <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setSubTab(c.key)}
            className={`rounded px-3 py-1 text-sm
              ${subTab === c.key
                ? 'bg-brand-gradient text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ---- scoreboard (moved to its own component) ---- */}
      <LiveScores sport={subTab} />

      {/* ---- news masonry ---- */}
      {error && (
        <p className="mb-4 rounded bg-red-100 p-3 font-medium text-red-700">{error}</p>
      )}
      <section>
        <div className={`transition-opacity duration-300 ${loading && 'opacity-50'}`}>
          <div className="columns-2 gap-2 space-y-2 sm:columns-2 md:columns-3">
            {visibleNews.map((a, i) => {
              const hasImg = !!a.urlToImage;
              return (
                <a
                  key={`${a.url}-${i}`}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-inside-avoid block transform rounded-lg bg-white
                             shadow transition hover:scale-[1.02] hover:shadow-xl
                             dark:bg-brand-950"
                >
                  {hasImg && (
                    <img
                      src={a.urlToImage!}
                      alt={a.title}
                      className="h-40 w-full object-cover sm:h-36"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  
                  <div className={`p-4 ${hasImg ? 'mt-1' : ''}`}>
                  <h3 className="line-clamp-3 text-sm font-semibold leading-snug
                                   text-gray-800 dark:text-gray-100 mb-2">
                      {a.title}
                    </h3>
                    <div className="mb-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <img
                        src={`https://logo.clearbit.com/${getDomain(a.url)}`}
                        alt={a.source.name}
                        className="h-6 w-6 object-contain"
                        onError={e => (e.currentTarget.src = LOGO_FALLBACK)}
                      />
                      <span className="truncate max-w-[140px]">{a.source.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(a.publishedAt).toLocaleDateString()}{' '}
                      {new Date(a.publishedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                    </span>
                   
               
                  </div>
                </a>
              );
            })}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPrev={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */
function Pagination({
  page, totalPages, loading, onPrev, onNext,
}: {
  page: number; totalPages: number; loading: boolean;
  onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 pb-8">
      <div className="flex gap-4">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={(page === totalPages && !loading) || loading}
          onClick={onNext}
          className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Page {page} / {totalPages}
      </span>
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading …</p>}
    </div>
  );
}
