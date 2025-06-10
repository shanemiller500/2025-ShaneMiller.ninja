/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchMediaStackArticles } from './Mediastack-API-Call';
import { fetchFinnhubArticles }    from './Finnhub-API-Call';
import { fetchUmailArticles }      from './MoreNewsAPI';
import { trackEvent }             from '@/utils/mixpanel';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */
export interface Article {
  source      : { id: string | null; name: string; image?: string | null };
  author      : string | null;
  title       : string;
  description : string;
  url         : string;
  urlToImage  : string | null;
  images?     : string[];
  thumbnails? : string[];
  publishedAt : string;
  content     : string | null;
  categories  : (string | null | undefined | any)[];
}

const getDomain = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return ''; }
};
const firstImg   = (html?: string | null) =>
  html?.match(/<img[^>]+src=['"]([^'"]+)['"]/i)?.[1] ?? null;

const LOGO_FALLBACK  = '/images/wedding.jpg';
const CBS_THUMB      = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/CBS_News.svg';
const PER_PAGE       = 36;
const CACHE_TTL      = 30 * 60 * 1000;                // 30 min
const USA_ENDPOINT   = 'https://u-mail.co/api/NewsAPI/us-news';

const sortByDate = (arr: Article[]) =>
  [...arr].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

const isUSA = (a: Article) => {
  const cats = (Array.isArray(a.categories) ? a.categories : [])
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.toLowerCase());
  const host = getDomain(a.url).toLowerCase();
  return cats.includes('us') ||
         cats.includes('united states') ||
         /\.us$/.test(host);
};

const getDisplayImage = (a: Article & { image?: string }) => {
  const sources = [
    a.urlToImage,
    a.image,               
    a.images?.[0],
    a.thumbnails?.[0],
    firstImg(a.content),
  ].filter(Boolean) as string[];

  for (let src of sources) {
    if (src.startsWith('http://')) src = src.replace('http://', 'https://');
    if (src) return src;
  }

  if (getDomain(a.url).includes('cbsnews.com')) return CBS_THUMB;
  return null;
};

/* ------------------------------------------------------------------ */
/*  Simple caches                                                     */
/* ------------------------------------------------------------------ */
let CACHE_ALL: { ts: number; data: Article[] } | null = null;
let USA_CACHE : { ts: number; data: Article[] } | null = null;
let USA_FETCH : Promise<void> | null            = null;

try {
  const raw = localStorage.getItem('usaNewsCache');
  if (raw) {
    const parsed = JSON.parse(raw) as { ts: number; data: Article[] };
    if (Date.now() - parsed.ts < CACHE_TTL) USA_CACHE = parsed;
  }
} catch {/* ignore */}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function NewsTab() {
  /* interface state */
  const [region,    setRegion]   = useState<'All' | 'USA' | 'World'>('All');
  const [provider,  setProvider] = useState('All');
  const [page,      setPage]     = useState(1);
  const [fade,      setFade]     = useState(false);

  /* data state */
  const [articles, setArticles]  = useState<Article[]>([]);
  const [loading,  setLoading]   = useState(false);
  const [error,    setError]     = useState<string | null>(null);

  /* ─────────── mount ─────────── */
  useEffect(() => { trackEvent('NewsTab Loaded'); }, []);

  /* ─────────── initial feed ─────────── */
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (CACHE_ALL && Date.now() - CACHE_ALL.ts < CACHE_TTL) {
        setArticles(CACHE_ALL.data);
        return;
      }
      setLoading(true);
      try {
        const [ms, fh, um] = await Promise.allSettled([
          fetchMediaStackArticles(1),
          fetchFinnhubArticles(),
          fetchUmailArticles(),
        ]);

        const ok = (r: PromiseSettledResult<Article[]>) =>
          r.status === 'fulfilled' ? r.value : [];

        const merged = sortByDate([...ok(ms), ...ok(fh), ...ok(um)]);
        if (!cancel) {
          CACHE_ALL = { ts: Date.now(), data: merged };
          setArticles(merged);
        }
      } catch (e: any) {
        if (!cancel) setError(e.message ?? 'Unknown error');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  /* ─────────── USA-only feed ─────────── */
  useEffect(() => {
    let cancel = false;
    if (region !== 'USA') return;
    if (USA_CACHE && Date.now() - USA_CACHE.ts < CACHE_TTL) return;

    if (!USA_FETCH) {
      USA_FETCH = (async () => {
        try {
          const res = await fetch(USA_ENDPOINT, { cache: 'no-store' });
          if (!res.ok) throw new Error(`US feed ${res.status}`);
          const json = await res.json();
          const data: Article[] = json.results.map((r: any) => ({
            source: { id: null, name: getDomain(r.link), image: r.sourceImage },
            author      : r.author || null,
            title       : r.headline,
            description : r.description,
            url         : r.link,
            urlToImage  : r.image ?? null,
            images      : r.images,
            thumbnails  : r.thumbnails,
            publishedAt : r.publishedAt,
            content     : r.content,
            categories  : r.categories,
          }));
          USA_CACHE = { ts: Date.now(), data };
          localStorage.setItem('usaNewsCache', JSON.stringify(USA_CACHE));
        } catch (e) {
          console.warn('USA endpoint error:', (e as Error).message);
        }
      })().finally(() => { USA_FETCH = null; });
    }
    USA_FETCH.then(() => !cancel && setArticles((a) => a));
    return () => { cancel = true; };
  }, [region]);

  /* ─────────── combine & filter ─────────── */
  const dataset = useMemo(() => {
    if (region === 'USA') {
      const extra   = USA_CACHE?.data ?? [];
      const generic = articles.filter(isUSA);
      return sortByDate(
        Array.from(new Map([...extra, ...generic].map((a) => [a.title, a])).values())
      );
    }
    if (region === 'World') return articles.filter((a) => !isUSA(a));
    return articles;
  }, [region, articles]);

  /* provider list */
  const providers = useMemo(
    () => ['All', ...Array.from(new Set(articles.map(a => a.source.name))).sort()],
    [articles]
  );

  const byProvider =
    provider === 'All' ? dataset : dataset.filter((a) => a.source.name === provider);

  const topStrip = useMemo(() => {
    // first one article that actually have an image, keep order
    return byProvider.filter(a => getDisplayImage(a)).slice(0, 1);
  }, [byProvider]);

  const rest = useMemo(() => {
    return byProvider.filter(a => !topStrip.includes(a));
  }, [byProvider, topStrip]);

  useEffect(() => setPage(1), [region, provider]);

  const totalPages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const pageNews   = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const changePage = (n: number) => {
    if (fade) return;
    trackEvent('News Page Changed', { page: n });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFade(true);
    setTimeout(() => {
      setPage(n);
      setFade(false);
    }, 400);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="mx-auto max-w-7xl px-4">
      {error && (
        <p className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-red-700 dark:bg-red-900 dark:text-red-200">
          {error}
        </p>
      )}

      {/* region + provider */}
      <div className="mb-10 flex flex-wrap items-center gap-4">
        {(['All', 'USA', 'World'] as const).map((r) => (
          <button
            key={r}
            onClick={() => {
              setRegion(r);
              trackEvent('News Region Changed', { region: r });
            }}
            className={`rounded-full px-4 py-1 text-sm font-medium transition ${
              region === r
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {r}
          </button>
        ))}

        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            trackEvent('News Provider Changed', { provider: e.target.value });
          }}
          className="ml-auto rounded border border-gray-300 bg-white px-3 py-1 text-sm dark:border-gray-600 dark:bg-brand-900 dark:text-gray-100"
        >
          {providers.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* headline strip with images */}
      <div className="mb-10 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {topStrip.map((a, idx) => {
          const bg   = getDisplayImage(a);
          const logo = a.source.image ?? `https://logo.clearbit.com/${getDomain(a.url)}`;
          const onClick = () => trackEvent('Article Clicked', {
            title  : a.title,
            url    : a.url,
            source : a.source.name,
            strip  : true,
          });
          return (
            <a
              key={`${a.url}-${idx}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClick}
              className="relative block h-40 overflow-hidden rounded-lg shadow hover:shadow-lg"
            >
              {/* background image */}
              {bg ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${bg}')` }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-brand-950">
                  <span className="text-sm text-gray-500 dark:text-gray-400">No image</span>
                </div>
              )}

              {/* dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/0" />

              {/* headline + meta */}
              <div className="absolute inset-x-0 bottom-0 z-10 p-3 text-white">
                <h3 className="line-clamp-2 text-sm font-semibold">{a.title}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <img
                    src={logo}
                    onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
                    alt={a.source.name}
                    className="h-4 w-4 flex-shrink-0 object-contain"
                  />
                  <span className="truncate max-w-[90px]">{a.source.name}</span>
                  {/* <span className="opacity-70">•</span>
                  <time dateTime={a.publishedAt} className="opacity-70">
                    {new Date(a.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </time> */}
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* masonry-style dynamic grid */}
      <div
  className={`
    grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1
    grid-flow-row-dense    
    transition-opacity duration-300
    ${fade ? 'opacity-0' : 'opacity-100'}
  `}
>
  {pageNews.map((a, idx) => {
    const img = getDisplayImage(a);

    /* -------------------------------------------------
       Variable width (only columns, let row height auto)
       ------------------------------------------------- */
    let spanClass = 'col-span-1';
    if (img) {
      if (idx % 10 === 0)      spanClass = 'lg:col-span-3 sm:col-span-2';
      else if (idx % 5 === 0)  spanClass = 'sm:col-span-2';
    }

    return (
      <div key={`${a.url}-${idx}`} className={spanClass}>
        <ArticleCard article={a} />
      </div>
    );
  })}
</div>

      {/* pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        loading={loading}
        onPrev={() => changePage(page - 1)}
        onNext={() => changePage(page + 1)}
      />
    </div>
  );
}

/* =================================================================== */
/*  Sub-components                                                     */
/* =================================================================== */
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
    <div className="mt-12 flex flex-col items-center gap-6 pb-10">
      <div className="flex gap-6">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-white disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={(page === totalPages && !loading) || loading}
          onClick={onNext}
          className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Page {page} / {totalPages}
      </span>
      {loading && (
        <p className="animate-pulse text-gray-500 dark:text-gray-400">Loading…</p>
      )}
    </div>
  );
}

/* ---------------- ArticleCard ---------------- */
function ArticleCard({ article }: { article: Article }) {
  const img  = getDisplayImage(article);
  const logo = article.source.image ?? `https://logo.clearbit.com/${getDomain(article.url)}`;

  const handleClick = () =>
    trackEvent('Article Clicked', {
      title  : article.title,
      url    : article.url,
      source : article.source.name,
      strip  : false,
    });

  /* background-image card when we have one */
  if (img) {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-block w-full break-inside-avoid overflow-hidden rounded-lg shadow hover:shadow-lg"
      >
        <div
          className="relative h-48 w-full bg-cover bg-center"
          style={{ backgroundImage: `url('${img}')` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/0" />
          <div className="absolute bottom-0 z-10 flex flex-col gap-2 p-4 text-white">
            <h3 className="line-clamp-3 text-sm font-semibold leading-snug">
              {article.title}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <img
                src={logo}
                onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
                alt={article.source.name}
                className="h-4 w-4 object-contain"
              />
              <span className="truncate max-w-[100px]">{article.source.name}</span>
              <span className="opacity-70">•</span>
              <time
                dateTime={article.publishedAt}
                className="opacity-70 whitespace-nowrap"
              >
                {new Date(article.publishedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day  : 'numeric',
                })}
              </time>
            </div>
          </div>
        </div>
      </a>
    );
  }

  /* original no-image fallback card */
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-block w-full break-inside-avoid overflow-hidden rounded-lg bg-white shadow hover:shadow-lg dark:bg-brand-950"
    >
      <div className="flex flex-col gap-2 p-4">
        <h3 className="line-clamp-3 text-base font-semibold leading-snug text-gray-800 dark:text-gray-100">
          {article.title}
        </h3>
        <p className="line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
          {article.description}
        </p>
        <MetaLine article={article} small />
      </div>
    </a>
  );
}

function MetaLine({
  article,
  small = false,
}: {
  article: Article;
  small?: boolean;
}) {
  const logo = article.source.image ?? `https://logo.clearbit.com/${getDomain(article.url)}`;
  return (
    <div className={`flex items-center gap-3 ${small ? 'text-xs' : 'text-sm'}`}>
      <img
        src={logo}
        onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
        alt={article.source.name}
        className="h-8 w-8 flex-shrink-0 object-contain"
      />
      <span className="truncate max-w-[140px] font-medium text-gray-700 dark:text-gray-300">
        {article.source.name}
      </span>
      <span className="text-gray-400 dark:text-gray-500">•</span>
      <time
        dateTime={article.publishedAt}
        className="whitespace-nowrap text-gray-500 dark:text-gray-400"
      >
        {new Date(article.publishedAt).toLocaleDateString(undefined, {
          month: 'short',
          day  : 'numeric',
        })}
      </time>
    </div>
  );
}
