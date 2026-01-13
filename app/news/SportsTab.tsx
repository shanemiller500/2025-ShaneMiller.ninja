/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchSportsNews } from "./sportsNews";
import LiveScores from "./LiveScores";

interface Article {
  source: { id: string | null; name: string; image?: string | null };
  title: string;
  url: string;
  urlToImage: string | null;
  images?: string[];
  publishedAt: string;
}

const CACHE_TTL = 30 * 60 * 1000;
const PER_PAGE = 36;

const CATEGORIES = [
  { key: "all", label: "Latest World Sports" },
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
  { key: "soccer", label: "Soccer" },
  { key: "mma", label: "MMA" }, // ✅ backend now supports /mma
] as const;

type TabKey = (typeof CATEGORIES)[number]["key"];
const cached: Record<string, { ts: number; data: Article[] }> = {};

const getDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const favicon = (domain: string) =>
  domain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}` : "";

const stableKey = (a: Article) => a.url?.trim() || `${a.title}-${a.publishedAt}`;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const bad = (s?: string | null) => !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());
const normalize = (s: string) => {
  const t = s.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};
const uniqStrings = (arr: string[]) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const k = s.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
};

function SmartImage({
  candidates,
  alt,
  className,
  wrapperClassName,
}: {
  candidates: string[];
  alt: string;
  className?: string;
  wrapperClassName?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [candidates.join("|")]);

  const src = candidates[idx];
  if (!src) return null;

  return (
    <div className={wrapperClassName}>
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  );
}

const getImageCandidates = (a: Article) => {
  const sources = [a.urlToImage, a.images?.[0]].filter((s): s is string => !bad(s)).map(normalize);
  return uniqStrings(sources);
};

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900">
      <div className="h-40 bg-gray-100 dark:bg-white/5" />
      <div className="p-4">
        <div className="h-3 w-11/12 rounded bg-gray-100 dark:bg-white/5" />
        <div className="mt-2 h-3 w-8/12 rounded bg-gray-100 dark:bg-white/5" />
        <div className="mt-4 h-3 w-4/12 rounded bg-gray-100 dark:bg-white/5" />
      </div>
    </div>
  );
}

export default function SportsTab() {
  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setError(null);

    if (cached[tab] && Date.now() - cached[tab].ts < CACHE_TTL) {
      setArticles(cached[tab].data);
      setPage(1);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        let news: Article[] = [];

        if (tab === "all") {
          news = await fetchSportsNews();
        } else {
          const r = await fetch(`https://u-mail.co/api/sportsByCategory/${tab}`, { cache: "no-store" });
          if (!r.ok) throw new Error(`Sports category API ${r.status}`);
          const j = await r.json();

          news = (j.results || []).map((it: any) => ({
            title: it.title,
            url: it.link,
            urlToImage: it.image ?? null,
            images: Array.isArray(it.images) ? it.images : [],
            publishedAt: it.publishedAt,
            source: { id: null, name: it.source, image: it.sourceLogo ?? favicon(getDomain(it.link)) },
          }));
        }

        const map = new Map<string, Article>();
        for (const a of news) {
          const k = stableKey(a);
          if (!map.has(k)) map.set(k, a);
        }

        const uniq = Array.from(map.values()).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

        if (!cancel) {
          cached[tab] = { ts: Date.now(), data: uniq };
          setArticles(uniq);
          setPage(1);
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
  }, [tab]);

  const uniq = useMemo(() => {
    const map = new Map<string, Article>();
    for (const a of articles) {
      const k = stableKey(a);
      if (!map.has(k)) map.set(k, a);
    }
    return Array.from(map.values());
  }, [articles]);

  const topStrip = useMemo(
    () => uniq.filter((a) => getImageCandidates(a).length > 0).slice(0, 4),
    [uniq]
  );

  const rest = useMemo(() => {
    const heroKeys = new Set(topStrip.map(stableKey));
    return uniq.filter((a) => !heroKeys.has(stableKey(a)));
  }, [uniq, topStrip]);

  const totalPages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const safePage = clamp(page, 1, totalPages);
  const pageNews = rest.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const changePage = useCallback(
    (next: number) => {
      if (loading) return;
      setPage(clamp(next, 1, totalPages));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [loading, totalPages]
  );

  return (
    <div className="pb-10">
      <select
        value={tab}
        onChange={(e) => setTab(e.target.value as TabKey)}
        className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm
                   focus:outline-none dark:border-white/10 dark:bg-brand-900 dark:text-gray-100 sm:hidden"
      >
        {CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setTab(c.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm ${
              tab === c.key
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <LiveScores sport={tab} />

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </p>
      )}

      {topStrip.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topStrip.map((a, i) => {
            const domain = getDomain(a.url);
            const logoCandidates = uniqStrings(
              [a.source.image ?? "", favicon(domain)].filter(Boolean).map(normalize)
            );
            const imgCandidates = getImageCandidates(a);

            return (
              <a
                key={`${stableKey(a)}-${i}`}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block h-44 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md
                           dark:border-white/10 dark:bg-brand-900"
              >
                {imgCandidates.length ? (
                  <SmartImage
                    candidates={imgCandidates}
                    alt={a.title}
                    wrapperClassName="absolute inset-0"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-white/5">
                    <span className="text-sm text-gray-500">No image</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-3 text-white">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{a.title}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {logoCandidates.length ? (
                      <SmartImage
                        candidates={logoCandidates}
                        alt={a.source.name}
                        className="h-4 w-4 rounded bg-white/10 object-contain"
                      />
                    ) : null}
                    <span className="truncate max-w-[140px]">{a.source.name}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <section className="mt-8">
        {loading && articles.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div
            className={`
              grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3
              transition-opacity duration-200
              ${loading ? "opacity-70" : "opacity-100"}
            `}
          >
            {pageNews.map((a) => (
              <ArticleCard key={stableKey(a)} article={a} />
            ))}
          </div>
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => changePage(safePage - 1)}
          onNext={() => changePage(safePage + 1)}
        />
      </section>
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const domain = getDomain(article.url);
  const logoCandidates = uniqStrings([article.source.image ?? "", favicon(domain)].filter(Boolean).map(normalize));
  const imgCandidates = getImageCandidates(article);

  if (imgCandidates.length) {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md
                   dark:border-white/10 dark:bg-brand-900"
      >
        <div className="relative h-48">
          <SmartImage
            candidates={imgCandidates}
            alt={article.title}
            wrapperClassName="absolute inset-0"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/0" />
          <div className="absolute bottom-0 z-10 flex w-full flex-col gap-2 p-4 text-white">
            <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{article.title}</h3>
            <div className="flex items-center gap-2 text-xs text-white/90">
              {logoCandidates.length ? (
                <SmartImage
                  candidates={logoCandidates}
                  alt={article.source.name}
                  className="h-4 w-4 rounded bg-white/10 object-contain"
                />
              ) : null}
              <span className="truncate max-w-[160px]">{article.source.name}</span>
              <span className="text-white/60">•</span>
              <time className="whitespace-nowrap text-white/70">
                {new Date(article.publishedAt).toLocaleDateString(undefined, {
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

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md
                 dark:border-white/10 dark:bg-brand-900"
    >
      <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-gray-900 dark:text-white">
        {article.title}
      </h3>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {logoCandidates.length ? (
          <SmartImage
            candidates={logoCandidates}
            alt={article.source.name}
            className="h-6 w-6 rounded bg-gray-100 object-contain dark:bg-white/5"
          />
        ) : null}
        <span className="truncate max-w-[200px]">{article.source.name}</span>
        <span>•</span>
        <time className="whitespace-nowrap">
          {new Date(article.publishedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
    </a>
  );
}

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
      <div className="flex gap-3">
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

      <span className="text-xs text-gray-600 dark:text-gray-300">
        Page <span className="font-semibold">{page}</span> / {totalPages}
        {loading && <span className="ml-2 animate-pulse text-gray-500">Loading…</span>}
      </span>
    </div>
  );
}
