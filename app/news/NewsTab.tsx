'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchMediaStackArticles } from './Mediastack-API-Call';
import { fetchFinnhubArticles   } from './Finnhub-API-Call';
import { fetchUmailArticles     } from './MoreNewsAPI';
import { FaChevronDown          } from 'react-icons/fa';

/* ------------------------------------------------------------------ */
/*  Types / helpers                                                    */
/* ------------------------------------------------------------------ */

export interface Article {
  source: { id: string | null; name: string; image?: string | null };
  author : string | null;
  title  : string;
  description: string;
  url    : string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
  categories: string[];
}

function getDomain(url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function smoothScrollToTop(d = 700) {
  const start = window.scrollY, t0 = performance.now();
  const step  = (now: number) => {
    const p = Math.min(1, (now - t0) / d);
    const ease = p * (2 - p);
    window.scrollTo(0, Math.ceil((1 - ease) * start));
    if (window.scrollY) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/*  Cache (module-level, survives re-renders)                          */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 30 * 60 * 1000;          // 30 minutes
let   cachedNews: { ts: number; data: Article[] } | null = null;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PER_PAGE      = 36;
const FEATURED_MAX  = 100;
const LOGO_FALLBACK = '/images/wedding.jpg';
const ARTICLE_PLACEHOLDER =
  'https://via.placeholder.com/600x350?text=No+Image';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewsTab() {
  const [page,           setPage]           = useState(1);
  const [articles,       setArticles]       = useState<Article[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [fade,           setFade]           = useState(false);
  const [providerFilter, setProviderFilter] = useState('All');
  const contentRef = useRef<HTMLDivElement>(null);

  /* ---------------------- fetch + cache --------------------------- */
  useEffect(() => {
    let cancel = false;

    (async () => {
      /* if cache is fresh, use it and bail out early */
      if (cachedNews && Date.now() - cachedNews.ts < CACHE_TTL) {
        setArticles(sortByDate(cachedNews.data));
        return;
      }

      setLoading(true);
      try {
        const [ms, fh, um] = await Promise.all([
          fetchMediaStackArticles(1), // ALWAYS first page; we'll paginate client-side
          fetchFinnhubArticles(),
          fetchUmailArticles(),
        ]);

        let fetched = [...ms, ...fh, ...um];

        /* dedupe by title */
        const map = new Map<string, Article>();
        fetched.forEach(a => { if (!map.has(a.title)) map.set(a.title, a); });

        const sorted = sortByDate(Array.from(map.values()));

        if (!cancel) {
          /* store result in cache */
          cachedNews = { ts: Date.now(), data: sorted };
          setArticles(sorted);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancel) setError(e.message ?? 'Unknown error');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, []); // ← runs only once (on mount)

  /* helper to sort by published date */
  const sortByDate = (arr: Article[]) =>
    arr.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  /* ---------------------- provider list ---------------------------- */
  const providers = useMemo(() => {
    const names = new Set(articles.map(a => a.source.name));
    return ['All', ...Array.from(names).sort()];
  }, [articles]);

  /* reset to first page on provider change -------------------------- */
  useEffect(() => setPage(1), [providerFilter]);

  /* --------------------- filtering / paging ------------------------ */
  const filtered = providerFilter === 'All'
    ? articles
    : articles.filter(a => a.source.name === providerFilter);

  const featured      = filtered.filter(a => a.urlToImage).slice(0, FEATURED_MAX);
  const remainingNews = filtered.filter(a => !featured.includes(a));

  const totalPages = Math.max(1, Math.ceil(remainingNews.length / PER_PAGE));
  const startIdx   = (page - 1) * PER_PAGE;
  const slice      = remainingNews.slice(startIdx, startIdx + PER_PAGE);

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

      {/* search (left) + provider dropdown (right) */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <ProviderDropdown
          options={providers}
          value={providerFilter}
          onChange={setProviderFilter}
        />
      </div>

      {/* --------------------------- MAIN --------------------------- */}
      <section className="w-full">
        {featured.length > 0 && <FeaturedSlider articles={featured} />}

        <div className={`transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {slice.map(a => <ArticleCard key={a.url} article={a} />)}
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


/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

/* Provider dropdown ------------------------------------------------ */
function ProviderDropdown({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => setOpen(o => !o);
  const close  = () => setOpen(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!btnRef.current?.parentElement?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => (e.key === 'Escape' ? close() : void 0);
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-950 text-sm text-gray-800 dark:text-gray-100 shadow-sm hover:bg-gray-50 dark:hover:bg-brand-900 transition"
      >
        {value}
        <FaChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          tabIndex={0}
          className="absolute mt-2 max-h-64 w-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-950 shadow-lg ring-1 ring-black/5 focus:outline-none z-20"
        >
          {options.map(opt => (
            <li
              key={opt}
              onClick={() => { onChange(opt); close(); }}
              className={`px-4 py-2 cursor-pointer text-sm ${
                opt === value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-brand-900'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Pagination controls --------------------------------------------- */
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

/* Featured slider -------------------------------------------------- */
function FeaturedSlider({ articles }: { articles: Article[] }) {
  const [idx, setIdx] = useState(0);
  const total = articles.length;

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % total), 6_000);
    return () => clearInterval(id);
  }, [total]);

  const go = (n: number) => setIdx((idx + n + total) % total);

  return (
    <div className="mb-10 relative overflow-hidden rounded-lg shadow-lg">
      {/* arrows */}
      <button
        onClick={() => go(-1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white p-2 rounded-full hover:bg-black/60"
      >
        ‹
      </button>
      <button
        onClick={() => go(1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white p-2 rounded-full hover:bg-black/60"
      >
        ›
      </button>

      {/* indicator */}
      <span className="absolute top-2 right-3 z-20 bg-black/60 text-white text-xs py-1 px-2 rounded">
        {idx + 1} / {total}
      </span>

      {/* slides */}
      <div
        className="whitespace-nowrap transition-transform duration-700"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {articles.map(a => (
          <a
            key={a.url}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full"
          >
            <img
              src={a.urlToImage ?? ARTICLE_PLACEHOLDER}
              onError={e => (e.currentTarget.src = ARTICLE_PLACEHOLDER)}
              alt={a.title}
              className="w-full h-44 sm:h-64 object-cover"
            />
            <div className="p-5 bg-white dark:bg-brand-950">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-normal line-clamp-2">
                {a.title}
              </h2>
              <MetaLine article={a} />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/* Article card ----------------------------------------------------- */
function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg shadow hover:shadow-xl transition transform hover:scale-[1.02] bg-white dark:bg-brand-950"
    >
      <div className="p-4 flex flex-col gap-2">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug line-clamp-3">
          {article.title}
        </h3>
        <MetaLine article={article} small />
      </div>
    </a>
  );
}

/* Meta line -------------------------------------------------------- */
function MetaLine({ article, small = false }: { article: Article; small?: boolean }) {
  const logo =
    article.source.image ??
    `https://logo.clearbit.com/${getDomain(article.url)}`;

  return (
    <div className={`flex flex-col ${small ? 'text-xs' : ''}`}>
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <img
          src={logo}
          onError={e => (e.currentTarget.src = LOGO_FALLBACK)}
          alt={article.source.name}
          className="w-8 h-8 object-contain"
        />
        <span>{article.source.name}</span>
      </div>
      <span className="text-gray-400 dark:text-gray-500 text-xs mt-1">
        {new Date(article.publishedAt).toLocaleDateString()}{' '}
        {new Date(article.publishedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}
