// Filename: NewsSearchTabSection.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { formatDate }       from '@/utils/formatters';
import { API_TOKEN }        from '@/utils/config';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */
interface Article {
  source     : string;      // Finnhub returns “source”
  headline   : string;      //  "
  url        : string;
  image      : string | null;
  summary    : string;
  datetime   : number;      // unix
  category   : string;
  related    : string;
}

const LOGO_FALLBACK = '/images/wedding.jpg';
const CACHE_TTL     = 30 * 60 * 1_000;           // 30 min

/** caches general news + company-news per symbol */
const cache: Record<string, { ts: number; data: Article[] }> = {};

const getDomain = (url: string) => {
  try { return new URL(url).hostname; } catch { return ''; }
};

/* ------------------------------------------------------------------ */
/*  Finnhub fetchers                                                  */
/* ------------------------------------------------------------------ */
async function fetchGeneral(): Promise<Article[]> {
  const key = 'general';
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) return cache[key].data;

  const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${API_TOKEN}`);
  if (!res.ok) throw new Error('Failed to fetch general news');
  const data = (await res.json()) as Article[];
  cache[key] = { ts: Date.now(), data };
  return data;
}

async function fetchCompany(symbol: string): Promise<Article[]> {
  const key = symbol.toUpperCase();
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) return cache[key].data;

  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10); // last 7 days
  const res  = await fetch(
    `https://finnhub.io/api/v1/company-news?symbol=${key}&from=${from}&to=${to}&token=${API_TOKEN}`
  );
  if (!res.ok) throw new Error('Failed to fetch company news');
  const data = (await res.json()) as Article[];
  cache[key] = { ts: Date.now(), data };
  return data;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const PER_PAGE = 36;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function NewsSearchTabSection() {
  const [symbol,  setSymbol ]  = useState('');
  const [query,   setQuery  ]  = useState('');     // keyword filter
  const [articles,setArticles] = useState<Article[]>([]);
  const [page,    setPage   ]  = useState(1);
  const [loading, setLoading]  = useState(false);
  const [error,   setError  ]  = useState<string | null>(null);
  const [fade,    setFade   ]  = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  /* ---------------------- initial load ---------------------------- */
  useEffect(() => {
    (async () => {
      try { setLoading(true); setArticles(await fetchGeneral()); }
      catch (e: any) { setError(e.message ?? 'Error'); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ---------------------- handlers ------------------------------- */
  const handleSymbolSearch = async () => {
    if (!symbol.trim()) return;
    setLoading(true); setError(null); setPage(1);
    try { setArticles(await fetchCompany(symbol.trim().toUpperCase())); }
    catch (e: any) { setError(e.message ?? 'Error'); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? articles.filter(a =>
          a.headline.toLowerCase().includes(q) ||
          a.summary .toLowerCase().includes(q)
        )
      : articles;
  }, [articles, query]);

  /* ----------------------- paging helpers ------------------------- */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const startIdx   = (page - 1) * PER_PAGE;
  const slice      = filtered.slice(startIdx, startIdx + PER_PAGE);

  const turnPage = (n: number) => {
    if (fade) return;
    if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth' });
    setFade(true);
    setTimeout(() => { setPage(n); setFade(false); }, 400);
  };

  /* ----------------------------- UI -------------------------------- */
  return (
    <section ref={topRef} className="p-4 rounded shadow bg-white dark:bg-brand-950">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        Finance News — Search &amp; Explore
      </h2>

      {/* controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          placeholder="Company symbol (e.g., AAPL)"
          className="grow p-2 border rounded dark:bg-brand-950 dark:border-gray-600"
        />
        <button
          onClick={handleSymbolSearch}
          className="px-4 py-2 shrink-0 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90"
        >
          Fetch Company News
        </button>

        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
          placeholder="Filter by keyword…"
          className="grow md:grow-0 md:w-64 p-2 border rounded dark:bg-brand-950 dark:border-gray-600"
        />
      </div>

      {loading && <p className="text-center">Loading news…</p>}
      {error   && <p className="text-center text-red-600">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-center">No news match your criteria.</p>
      )}

      <div className={`transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
        <div className="columns-2 sm:columns-2 md:columns-3 gap-2 space-y-2">
          {slice.map(a => {
            const hasImage = !!a.image;
            return (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-inside-avoid block rounded-lg shadow hover:shadow-xl transition transform hover:scale-[1.02] bg-white dark:bg-brand-950"
              >
                {/* larger thumbnails */}
                {hasImage && (
                  <img
                    src={a.image!}
                    alt={a.headline}
                    onError={e => (e.currentTarget.style.display = 'none')}
                    className="w-full h-52 object-cover"
                  />
                )}

                <div className={`p-4 flex flex-col gap-1 ${hasImage ? 'mt-1' : ''}`}>
                  {/* publisher logo + name */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <img
                      src={`https://logo.clearbit.com/${getDomain(a.url)}`}
                      onError={e => (e.currentTarget.src = LOGO_FALLBACK)}
                      alt={a.source}
                      className="w-8 h-8 object-contain"
                    />
                    <span className="truncate max-w-[140px]">{a.source}</span>
                  </div>

                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(a.datetime * 1000)}
                  </span>

                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug line-clamp-3">
                    {a.headline}
                  </h3>

                  {a.summary && (
                    <p className="text-sm line-clamp-2 text-gray-600 dark:text-gray-300">
                      {a.summary}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>

        {/* pagination */}
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
