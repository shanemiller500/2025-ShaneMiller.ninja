'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FaChevronDown } from 'react-icons/fa';

import { fetchMediaStackArticles } from './Mediastack-API-Call';
import { fetchFinnhubArticles   } from './Finnhub-API-Call';
import { fetchUmailArticles     } from './MoreNewsAPI';

import WidgetNews    from '@/components/widget-news';
import WidgetWeather from '@/components/widget-weather';
import CryptoWidget  from '@/components/widget-crypto';
import WidgetSearch  from '@/components/widget-search';

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers & constants                                              */
/* ────────────────────────────────────────────────────────────────── */

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

function getDomain (url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function smoothScrollToTop (d = 600) {
  const start = window.scrollY;
  const t0    = performance.now();
  const step  = (now: number) => {
    const p = Math.min(1, (now - t0) / d);
    const ease = p * (2 - p);
    window.scrollTo(0, Math.ceil((1 - ease) * start));
    if (window.scrollY) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const PER_PAGE     = 36;
const FEATURED_MAX = 100;

/* 1×1 grey SVG data URI */
const PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="100%" height="100%" fill="%23e5e7eb"/></svg>';

/* session-level cache for Microlink OG images so we never re-fetch */
const ogCache = new Map<string, string>();

/* Microlink helpers */
const ogImage = (url: string) =>
  `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=false&embed=image.url`;

const logoURL = (domain: string) => `https://logo.microlink.io/${domain}`;

/* ────────────────────────────────────────────────────────────────── */
/*  Page component                                                   */
/* ────────────────────────────────────────────────────────────────── */

export default function NewsPage () {
  const [page,     setPage]     = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [fade,     setFade]     = useState(false);
  const [providerFilter, setProviderFilter] = useState('All');

  /* fetch news – no backend cache (client-side state is enough) */
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [ms, fh, um] = await Promise.all([
          fetchMediaStackArticles(page),
          fetchFinnhubArticles(),
          fetchUmailArticles()
        ]);

        if (cancel) return;

        /* dedupe by title */
        const map = new Map<string, Article>();
        [...ms, ...fh, ...um].forEach(a => {
          if (!map.has(a.title)) map.set(a.title, a);
        });

        setArticles(prev =>
          [...prev, ...Array.from(map.values())]
            .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
        );
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? 'Unknown error');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [page]);

  /* provider dropdown list */
  const providers = useMemo(() => {
    const names = new Set(articles.map(a => a.source.name));
    return ['All', ...Array.from(names).sort()];
  }, [articles]);

  /* reset page when filter changes */
  useEffect(() => setPage(1), [providerFilter]);

  const filtered = providerFilter === 'All'
    ? articles
    : articles.filter(a => a.source.name === providerFilter);

  const featured      = filtered.filter(a => a.urlToImage).slice(0, FEATURED_MAX);
  const remainingNews = filtered.filter(a => !featured.includes(a));

  const totalPages = Math.max(1, Math.ceil(remainingNews.length / PER_PAGE));
  const startIdx   = (page - 1) * PER_PAGE;
  const slice      = remainingNews.slice(startIdx, startIdx + PER_PAGE);

  const turnPage = (n: number, getMore = false) => {
    if (fade) return;
    smoothScrollToTop();
    setFade(true);
    setTimeout(() => {
      setPage(n);
      setFade(false);
    }, 350);
    if (getMore) setPage(p => p + 1);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        The&nbsp;Miller&nbsp;Gazette
      </h1>

      {error && (
        <p className="bg-red-100 text-red-700 p-3 mb-4 rounded font-medium">
          {error}
        </p>
      )}

      {/* search + provider dropdown */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <ProviderDropdown
          options={providers}
          value={providerFilter}
          onChange={setProviderFilter}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ───── MAIN ───── */}
        <section className="flex-1 w-full lg:max-w-[720px]">
          {featured.length > 0 && <FeaturedSlider articles={featured} />}

          <div
            className={`transition-opacity duration-300 ${
              fade ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {slice.map(a => <ArticleCard key={a.url} article={a} />)}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              loading={loading}
              onPrev={() => turnPage(page - 1)}
              onNext={() => turnPage(page + 1, page === totalPages)}
            />
          </div>
        </section>

        {/* ───── SIDEBAR ───── */}
        <aside className="w-full lg:w-[300px] space-y-6">
          <WidgetSearch />
          <WidgetWeather />
          <CryptoWidget />
          <WidgetNews />
        </aside>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                    */
/* ────────────────────────────────────────────────────────────────── */

function ProviderDropdown ({
  options,
  value,
  onChange
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
    const click = (e: MouseEvent) =>
      !btnRef.current?.parentElement?.contains(e.target as Node) && close();
    const esc   = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', click);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', click);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      e.preventDefault();
      const idx = options.indexOf(value);
      if (e.key === 'ArrowDown') onChange(options[(idx + 1) % options.length]);
      if (e.key === 'ArrowUp')   onChange(options[(idx - 1 + options.length) % options.length]);
      if (e.key === 'Enter' || e.key === ' ') close();
    },
    [options, value, onChange]
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-950 text-sm text-gray-800 dark:text-gray-100 shadow-sm hover:bg-gray-50 dark:hover:bg-brand-900 transition"
      >
        {value}
        <FaChevronDown
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          tabIndex={0}
          onKeyDown={handleKey}
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

/* Pagination */
function Pagination ({
  page,
  totalPages,
  loading,
  onPrev,
  onNext
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

/* ────────────────────────────────────────────────────────────────── */
/*  Image wrappers                                                    */
/* ────────────────────────────────────────────────────────────────── */

function ThumbImage ({ article, className }: { article: Article; className: string }) {
  const domain = getDomain(article.url);
  const [src, setSrc] = useState<string>(
    article.urlToImage || ogCache.get(article.url) || ogImage(article.url)
  );
  const [stage, setStage] = useState(0); // 0=urlToImage/OG • 1=logo • 2=placeholder

  const handleError = () => {
    if (stage === 0) {
      // cache miss? then fall back to logo
      setSrc(logoURL(domain));
      setStage(1);
    } else {
      setSrc(PLACEHOLDER);
      setStage(2);
    }
  };

  /* once Microlink succeeds, cache the resolved src */
  useEffect(() => {
    if (stage === 0 && src.startsWith('https://api.microlink.io')) {
      const img = new Image();
      img.src = src;
      img.onload = () => ogCache.set(article.url, src);
    }
  }, [src, stage, article.url]);

  return (
    <img
      src={src}
      onError={handleError}
      alt={article.title}
      className={className}
    />
  );
}

function LogoImage ({ article, className }: { article: Article; className?: string }) {
  const domain = getDomain(article.url);
  const [src, setSrc] = useState<string>(article.source.image || logoURL(domain));
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (!failed) {
      setSrc(logoURL(domain));
      setFailed(true);
    } else {
      setSrc(PLACEHOLDER);
    }
  };

  return (
    <img
      src={src}
      onError={handleError}
      alt={article.source.name}
      className={className ?? 'w-8 h-8 object-contain'}
    />
  );
}

/* Featured slider */
function FeaturedSlider ({ articles }: { articles: Article[] }) {
  const [idx, setIdx] = useState(0);
  const total = articles.length;

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % total), 6000);
    return () => clearInterval(id);
  }, [total]);

  const go = (n: number) => setIdx((idx + n + total) % total);

  return (
    <div className="mb-10 relative overflow-hidden rounded-lg shadow-lg">
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

      <span className="absolute top-2 right-3 z-20 bg-black/60 text-white text-xs py-1 px-2 rounded">
        {idx + 1} / {total}
      </span>

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
            <ThumbImage
              article={a}
              className="w-full h-44 sm:h-64 object-cover"
            />
            <div className="p-5 bg-white dark:bg-brand-950">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 line-clamp-2">
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

/* Article card */
function ArticleCard ({ article }: { article: Article }) {
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

/* Meta line */
function MetaLine ({
  article,
  small = false
}: {
  article: Article;
  small?: boolean;
}) {
  return (
    <div className={`flex flex-col ${small ? 'text-xs' : ''}`}>
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <LogoImage article={article} />
        <span>{article.source.name}</span>
      </div>
      <span className="text-gray-400 dark:text-gray-500 text-xs mt-1">
        {new Date(article.publishedAt).toLocaleDateString()}{' '}
        {new Date(article.publishedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </span>
    </div>
  );
}
