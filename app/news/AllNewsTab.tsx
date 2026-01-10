/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchMediaStackArticles } from "./Mediastack-API-Call";
import { fetchFinnhubArticles } from "./Finnhub-API-Call";
import { fetchUmailArticles } from "./MoreNewsAPI";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */
export interface Article {
  source: { id: string | null; name: string; image?: string | null };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  images?: string[];
  thumbnails?: string[];
  publishedAt: string;
  content: string | null;
  categories: (string | null | undefined | any)[];
}

const LOGO_FALLBACK = "/images/wedding.jpg";
const CBS_THUMB = "https://upload.wikimedia.org/wikipedia/commons/3/3f/CBS_News.svg";
const PER_PAGE = 36;
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const USA_ENDPOINT = "https://u-mail.co/api/NewsAPI/us-news";

const getDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const firstImg = (html?: string | null) =>
  html?.match(/<img[^>]+src=['"]([^'"]+)['"]/i)?.[1] ?? null;

const bad = (s?: string | null) => !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());

const normalize = (s: string) => {
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("http://")) return s.replace("http://", "https://");
  return s;
};

const getDisplayImage = (a: Article & { image?: string }) => {
  const sources = [
    a.urlToImage,
    a.image,
    a.images?.[0],
    a.thumbnails?.[0],
    firstImg(a.content),
  ]
    .filter((s): s is string => !bad(s))
    .map(normalize);

  if (sources.length) return sources[0];
  return getDomain(a.url).includes("cbsnews.com") ? CBS_THUMB : null;
};

const sortByDate = (arr: Article[]) =>
  [...arr].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

const isUSA = (a: Article) => {
  const cats = (Array.isArray(a.categories) ? a.categories : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toLowerCase());
  const host = getDomain(a.url).toLowerCase();
  return cats.includes("us") || cats.includes("united states") || /\.us$/.test(host);
};

const stableKey = (a: Article) => {
  // url is best; fallback keeps duplicates under control.
  const u = a.url?.trim();
  if (u) return u;
  return `${a.title}-${a.publishedAt}`;
};

const uniqByKey = (arr: Article[]) => {
  const m = new Map<string, Article>();
  for (const a of arr) {
    const k = stableKey(a);
    if (!m.has(k)) m.set(k, a);
  }
  return Array.from(m.values());
};

/* ------------------------------------------------------------------ */
/*  Simple caches (memory)                                            */
/* ------------------------------------------------------------------ */
let CACHE_ALL: { ts: number; data: Article[] } | null = null;
let USA_CACHE: { ts: number; data: Article[] } | null = null;
let USA_FETCH: Promise<void> | null = null;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function NewsTab() {
  /* interface state */
  const [region, setRegion] = useState<"All" | "USA" | "World">("All");
  const [provider, setProvider] = useState("All");
  const [page, setPage] = useState(1);
  const [fade, setFade] = useState(false);

  /* data state */
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* localStorage: hydrate USA cache client-side safely */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("usaNewsCache");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts: number; data: Article[] };
      if (Date.now() - parsed.ts < CACHE_TTL) USA_CACHE = parsed;
    } catch {
      /* ignore */
    }
  }, []);

  /* mount */
  useEffect(() => {
    trackEvent("NewsTab Loaded");
  }, []);

  /* initial feed */
  useEffect(() => {
    let cancel = false;

    (async () => {
      if (CACHE_ALL && Date.now() - CACHE_ALL.ts < CACHE_TTL) {
        setArticles(CACHE_ALL.data);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [ms, fh, um] = await Promise.allSettled([
          fetchMediaStackArticles(1),
          fetchFinnhubArticles(),
          fetchUmailArticles(),
        ]);

        const ok = (r: PromiseSettledResult<Article[]>) => (r.status === "fulfilled" ? r.value : []);

        const merged = sortByDate(uniqByKey([...ok(ms), ...ok(fh), ...ok(um)]));

        if (!cancel) {
          CACHE_ALL = { ts: Date.now(), data: merged };
          setArticles(merged);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? "Unknown error");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  /* USA-only feed (adds extra USA endpoint data) */
  useEffect(() => {
    let cancel = false;
    if (region !== "USA") return;

    if (USA_CACHE && Date.now() - USA_CACHE.ts < CACHE_TTL) return;

    if (!USA_FETCH) {
      USA_FETCH = (async () => {
        try {
          const res = await fetch(USA_ENDPOINT, { cache: "no-store" });
          if (!res.ok) throw new Error(`US feed ${res.status}`);
          const json = await res.json();

          const data: Article[] = (json?.results || []).map((r: any) => ({
            source: { id: null, name: getDomain(r.link), image: r.sourceImage ?? null },
            author: r.author || null,
            title: r.headline,
            description: r.description,
            url: r.link,
            urlToImage: r.image ?? null,
            images: r.images,
            thumbnails: r.thumbnails,
            publishedAt: r.publishedAt,
            content: r.content,
            categories: r.categories || [],
          }));

          USA_CACHE = { ts: Date.now(), data };
          try {
            localStorage.setItem("usaNewsCache", JSON.stringify(USA_CACHE));
          } catch {
            /* ignore */
          }
        } catch (e) {
          // don’t hard-fail the whole UI if USA feed fails
          console.warn("USA endpoint error:", (e as Error).message);
        }
      })().finally(() => {
        USA_FETCH = null;
      });
    }

    USA_FETCH.then(() => {
      if (!cancel) setArticles((a) => a); // trigger re-render to include USA_CACHE
    });

    return () => {
      cancel = true;
    };
  }, [region]);

  /* combine & filter */
  const dataset = useMemo(() => {
    if (region === "USA") {
      const extra = USA_CACHE?.data ?? [];
      const generic = articles.filter(isUSA);
      return sortByDate(uniqByKey([...extra, ...generic]));
    }
    if (region === "World") return articles.filter((a) => !isUSA(a));
    return articles;
  }, [region, articles]);

  /* provider list (based on *all* articles, not filtered dataset) */
  const providers = useMemo(
    () => ["All", ...Array.from(new Set(articles.map((a) => a.source.name))).sort()],
    [articles],
  );

  const byProvider = useMemo(
    () => (provider === "All" ? dataset : dataset.filter((a) => a.source.name === provider)),
    [provider, dataset],
  );

  /* hero/top strip = first article that has an image */
  const hero = useMemo(() => {
    const firstWithImg = byProvider.find((a) => !!getDisplayImage(a));
    return firstWithImg ?? null;
  }, [byProvider]);

  /* rest excludes hero by stable key */
  const rest = useMemo(() => {
    if (!hero) return byProvider;
    const heroKey = stableKey(hero);
    return byProvider.filter((a) => stableKey(a) !== heroKey);
  }, [byProvider, hero]);

  useEffect(() => setPage(1), [region, provider]);

  const totalPages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageNews = rest.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const changePage = useCallback(
    (n: number) => {
      if (fade) return;
      const next = Math.max(1, Math.min(n, totalPages));
      if (next === safePage) return;

      trackEvent("News Page Changed", { page: next });
      window.scrollTo({ top: 0, behavior: "smooth" });

      setFade(true);
      window.setTimeout(() => {
        setPage(next);
        setFade(false);
      }, 220);
    },
    [fade, totalPages, safePage],
  );

  /* ---------------- Render ---------------- */
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      {error && (
        <p className="mb-6 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      )}

      {/* region + provider */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-950">
          {(["All", "USA", "World"] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRegion(r);
                trackEvent("News Region Changed", { region: r });
              }}
              className={`px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                region === r
                  ? "bg-indigo-600 text-white"
                  : "bg-transparent text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            trackEvent("News Provider Changed", { provider: e.target.value });
          }}
          className="ml-auto rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm
                     dark:border-white/10 dark:bg-brand-950 dark:text-gray-200 sm:text-sm"
        >
          {providers.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* HERO */}
      {hero ? (
        <HeroCard article={hero} />
      ) : (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-brand-950 dark:text-gray-300">
          {loading ? "Loading top stories…" : "No stories found."}
        </div>
      )}

      {/* grid */}
      <div
        className={`
          mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3
          transition-opacity duration-200
          ${fade ? "opacity-0" : "opacity-100"}
        `}
      >
        {loading && articles.length === 0
          ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
          : pageNews.map((a, idx) => {
              const img = getDisplayImage(a);
              let spanClass = "col-span-1";
              if (img) {
                if (idx % 12 === 0) spanClass = "lg:col-span-2";
                else if (idx % 7 === 0) spanClass = "sm:col-span-2";
              }

              return (
                <div key={stableKey(a)} className={spanClass}>
                  <ArticleCard article={a} />
                </div>
              );
            })}
      </div>

      {/* pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        loading={loading}
        onPrev={() => changePage(safePage - 1)}
        onNext={() => changePage(safePage + 1)}
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
    <div className="mt-10 flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-40
                     dark:bg-white/10 dark:hover:bg-white/15"
        >
          Previous
        </button>

        <button
          disabled={page === totalPages || loading}
          onClick={onNext}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-300">
        Page <span className="font-semibold">{page}</span> / {totalPages}
        {loading && <span className="ml-2 animate-pulse text-gray-500">Loading…</span>}
      </div>
    </div>
  );
}

function HeroCard({ article }: { article: Article }) {
  const bg = getDisplayImage(article);
  const domain = getDomain(article.url);
  const logo = article.source.image ?? `https://logo.clearbit.com/${domain}`;

  const onClick = () =>
    trackEvent("Article Clicked", {
      title: article.title,
      url: article.url,
      source: article.source.name,
      strip: true,
    });

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="group relative block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm
                 hover:shadow-md dark:border-white/10 dark:bg-brand-950"
    >
      <div className="relative h-52 sm:h-64">
        {bg ? (
          <img
            src={bg}
            alt={article.title}
            referrerPolicy="no-referrer"
            onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-white/5">
            <span className="text-sm text-gray-500">No image</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/0" />

        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug sm:text-lg">
            {article.title}
          </h3>

          <div className="mt-2 flex items-center gap-2 text-xs">
            <img
              src={logo}
              onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
              alt={article.source.name}
              className="h-4 w-4 flex-shrink-0 rounded bg-white/10 object-contain"
            />
            <span className="max-w-[160px] truncate">{article.source.name || domain}</span>
            <span className="opacity-70">•</span>
            <time dateTime={article.publishedAt} className="opacity-80">
              {new Date(article.publishedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </time>
          </div>
        </div>
      </div>
    </a>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const img = getDisplayImage(article);
  const domain = getDomain(article.url);
  const logo = article.source.image ?? `https://logo.clearbit.com/${domain}`;

  const handleClick = () =>
    trackEvent("Article Clicked", {
      title: article.title,
      url: article.url,
      source: article.source.name,
      strip: false,
    });

  if (img) {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md
                   dark:border-white/10 dark:bg-brand-950"
      >
        <div className="relative h-44">
          <img
            src={img}
            alt={article.title}
            referrerPolicy="no-referrer"
            onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/0" />
          <div className="absolute bottom-0 p-3 text-white">
            <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{article.title}</h3>
            <MetaLine article={article} logo={logo} light />
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md
                 dark:border-white/10 dark:bg-brand-950"
    >
      <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-gray-900 dark:text-white">
        {article.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
        {article.description}
      </p>
      <div className="mt-3">
        <MetaLine article={article} logo={logo} />
      </div>
    </a>
  );
}

function MetaLine({
  article,
  logo,
  light = false,
}: {
  article: Article;
  logo: string;
  light?: boolean;
}) {
  const textClass = light ? "text-white/90" : "text-gray-700 dark:text-gray-300";
  const subClass = light ? "text-white/70" : "text-gray-500 dark:text-gray-400";

  return (
    <div className={`mt-2 flex items-center gap-2 text-xs ${textClass}`}>
      <img
        src={logo}
        onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
        alt={article.source.name}
        className="h-4 w-4 flex-shrink-0 rounded bg-white/10 object-contain"
      />
      <span className="max-w-[140px] truncate font-medium">{article.source.name}</span>
      <span className={subClass}>•</span>
      <time dateTime={article.publishedAt} className={`whitespace-nowrap ${subClass}`}>
        {new Date(article.publishedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </time>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-950">
      <div className="h-40 bg-gray-100 dark:bg-white/5" />
      <div className="p-4">
        <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-white/5" />
        <div className="mt-2 h-3 w-2/3 rounded bg-gray-100 dark:bg-white/5" />
        <div className="mt-4 h-3 w-1/3 rounded bg-gray-100 dark:bg-white/5" />
      </div>
    </div>
  );
}
