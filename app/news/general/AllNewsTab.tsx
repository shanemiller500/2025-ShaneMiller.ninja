/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchFinnhubArticles } from "./Finnhub-API-Call";
import { fetchUmailArticles } from "./MoreNewsAPI";
import { trackEvent } from "@/utils/mixpanel";
import { SmartImage, SkeletonCard } from "../lib/SmartImage";
import { getDomain } from "../lib/utils";
import ReaderModal, { type ReadableArticle } from "../components/ReaderModal";
import {
  GroupModal,
  getImageCandidates,
  getLogoCandidates,
  stableKey,
  type ArticleGroup,
} from "./NewsModals";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface Article {
  source: {
    id: string | null;
    name: string;
    imageCandidates?: string[];
    image?: string | null;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  image?: string | null;
  images?: string[];
  thumbnails?: string[];
  publishedAt: string;
  content: string | null;
  categories: (string | null | undefined)[];
  category?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PER_PAGE = 45;
const CACHE_TTL = 30 * 60 * 1000;
const API_BASE = "https://u-mail.co/api/NewsAPI";
const USA_ENDPOINT = `${API_BASE}/us-news`;

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */
const sortByDateDesc = (arr: Article[]) =>
  [...arr].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

const uniqByKey = (arr: Article[]) => {
  const m = new Map<string, Article>();
  for (const a of arr) {
    const k = stableKey(a);
    if (!m.has(k)) m.set(k, a);
  }
  return Array.from(m.values());
};

const isUSA = (a: Article) => {
  const cats = (Array.isArray(a.categories) ? a.categories : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toLowerCase());
  const host = getDomain(a.url).toLowerCase();
  return (
    cats.includes("us") ||
    cats.includes("united states") ||
    /\.us$/.test(host)
  );
};

const normalizeTitleKey = (t: string) =>
  String(t || "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(
      /\s+[-|]\s+(cnn|reuters|ap news|associated press|fox news|bbc|cnbc|wsj|the wall street journal|nyt|the new york times)$/i,
      ""
    )
    .trim();

function groupByTitle(articles: Article[]): ArticleGroup[] {
  const map = new Map<string, Article[]>();
  for (const a of articles) {
    const key =
      normalizeTitleKey(a.title || "") || (a.url ? a.url : stableKey(a));
    const list = map.get(key);
    if (list) list.push(a);
    else map.set(key, [a]);
  }

  const groups: ArticleGroup[] = [];
  for (const [key, items] of Array.from(map.entries())) {
    const sorted = sortByDateDesc(items);
    const rep = sorted[0];
    groups.push({
      key,
      title: rep?.title || key,
      items: sorted,
      rep,
      newestAt: rep?.publishedAt || new Date(0).toISOString(),
    });
  }
  groups.sort((a, b) => +new Date(b.newestAt) - +new Date(a.newestAt));
  return groups;
}

function articleToReadable(a: Article): ReadableArticle {
  return {
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    sourceName: a.source.name || getDomain(a.url),
    description: a.description || undefined,
    imageCandidates: getImageCandidates(a),
    logoCandidates: getLogoCandidates(a),
  };
}

/* ------------------------------------------------------------------ */
/*  Module-level cache                                                 */
/* ------------------------------------------------------------------ */
let CACHE_ALL: { ts: number; data: Article[] } | null = null;
let USA_CACHE: { ts: number; data: Article[] } | null = null;
let USA_FETCH: Promise<void> | null = null;

/* ------------------------------------------------------------------ */
/*  NewsTab                                                            */
/* ------------------------------------------------------------------ */
export default function NewsTab() {
  const [region, setRegion] = useState<"All" | "USA" | "World">("All");
  const [provider, setProvider] = useState("All");
  const [page, setPage] = useState(1);
  const [fade, setFade] = useState(false);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openGroup, setOpenGroup] = useState<ArticleGroup | null>(null);
  const [readerArticle, setReaderArticle] = useState<ReadableArticle | null>(null);

  /* Hydrate USA cache from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("usaNewsCache");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts: number; data: Article[] };
      if (Date.now() - parsed.ts < CACHE_TTL) USA_CACHE = parsed;
    } catch {}
  }, []);

  useEffect(() => {
    trackEvent("NewsTab Loaded");
  }, []);

  /* Load main feeds */
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
        const [fh, um] = await Promise.allSettled([
          fetchFinnhubArticles(),
          fetchUmailArticles(),
        ]);
        const ok = (r: PromiseSettledResult<Article[]>) =>
          r.status === "fulfilled" ? r.value : [];
        const merged = sortByDateDesc(uniqByKey([...ok(fh), ...ok(um)]));
        if (!cancel) {
          CACHE_ALL = { ts: Date.now(), data: merged };
          setArticles(merged);
        }
      } catch (e: unknown) {
        if (!cancel) setError((e as Error)?.message ?? "Unknown error");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  /* Load USA endpoint when needed */
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
          const data: Article[] = (json?.results || []).map((r: Record<string, unknown>) => {
            const mainImg = r.image as string | null ?? null;
            return {
              source: {
                id: null,
                name: r.source as string || getDomain(r.link as string),
                imageCandidates: Array.isArray(r.sourceImageCandidates)
                  ? r.sourceImageCandidates
                  : [],
              },
              author: r.author as string | null ?? null,
              title: r.headline as string ?? "",
              description: r.description as string ?? "",
              url: r.link as string,
              urlToImage: mainImg,
              image: mainImg,
              images: Array.isArray(r.images) ? r.images as string[] : [],
              thumbnails: Array.isArray(r.thumbnails) ? r.thumbnails as string[] : [],
              publishedAt: r.publishedAt as string,
              content: r.content as string ?? null,
              categories: Array.isArray(r.categories) ? r.categories as string[] : [],
            };
          });
          USA_CACHE = { ts: Date.now(), data };
          try {
            localStorage.setItem("usaNewsCache", JSON.stringify(USA_CACHE));
          } catch {}
        } catch (e) {
          console.warn("USA endpoint error:", (e as Error).message);
        }
      })().finally(() => {
        USA_FETCH = null;
      });
    }

    USA_FETCH.then(() => {
      if (!cancel) setArticles((a) => [...a]);
    });

    return () => {
      cancel = true;
    };
  }, [region]);

  /* Filters */
  const dataset = useMemo(() => {
    if (region === "USA") {
      const extra = USA_CACHE?.data ?? [];
      const generic = articles.filter(isUSA);
      return sortByDateDesc(uniqByKey([...extra, ...generic]));
    }
    if (region === "World") return articles.filter((a) => !isUSA(a));
    return articles;
  }, [region, articles]);

  const providers = useMemo(
    () => ["All", ...Array.from(new Set(articles.map((a) => a.source.name))).sort()],
    [articles]
  );

  const byProvider = useMemo(
    () =>
      provider === "All"
        ? dataset
        : dataset.filter((a) => a.source.name === provider),
    [provider, dataset]
  );

  const groups = useMemo(() => groupByTitle(byProvider), [byProvider]);

  /* Hero group: newest group with an image (skip CBS small thumbs) */
  const heroGroup = useMemo(
    () =>
      groups.find((g) => {
        const a = g.rep;
        const isCBS =
          a.url?.includes("cbsnews.com") ||
          a.source.name?.toLowerCase().includes("cbs");
        if (isCBS) return false;
        return getImageCandidates(a, 800).length > 0;
      }) ?? null,
    [groups]
  );

  const restGroups = useMemo(
    () =>
      heroGroup ? groups.filter((g) => g.key !== heroGroup.key) : groups,
    [groups, heroGroup]
  );

  useEffect(() => setPage(1), [region, provider]);

  const totalPages = Math.max(1, Math.ceil(restGroups.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageGroups = restGroups.slice(
    (safePage - 1) * PER_PAGE,
    safePage * PER_PAGE
  );

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
      }, 200);
    },
    [fade, totalPages, safePage]
  );

  const openReader = (a: Article) => {
    trackEvent("Article Clicked", {
      title: a.title,
      url: a.url,
      source: a.source.name,
    });
    setReaderArticle(articleToReadable(a));
  };

  return (
    <div className="pb-10">
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 sm:mb-5 flex flex-wrap items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
        {/* Region pills */}
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-1">
          {(["All", "USA", "World"] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRegion(r);
                trackEvent("News Region Changed", { region: r });
              }}
              className={[
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                region === r
                  ? "bg-white dark:bg-gray-700 text-brand-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
              ].join(" ")}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Provider dropdown */}
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            trackEvent("News Provider Changed", { provider: e.target.value });
          }}
          className="ml-auto rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {providers.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Hero */}
      {heroGroup ? (
        <HeroCard group={heroGroup} onRead={() => openReader(heroGroup.rep)} onOpenGroup={() => setOpenGroup(heroGroup)} />
      ) : (
        <div className="mb-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-brand-900 p-4 sm:p-6 text-center">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {loading ? "Loading top stories…" : "No stories found."}
          </span>
        </div>
      )}

      {/* Grid */}
      <div
        className={`mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 transition-opacity duration-200 ${
          fade ? "opacity-0" : "opacity-100"
        }`}
      >
        {loading && groups.length === 0
          ? Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))
          : pageGroups.map((g) => (
              <GroupCard
                key={g.key}
                group={g}
                onRead={() => openReader(g.rep)}
                onOpen={() => setOpenGroup(g)}
              />
            ))}
      </div>

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        loading={loading}
        onPrev={() => changePage(safePage - 1)}
        onNext={() => changePage(safePage + 1)}
      />

      {/* Group modal */}
      <GroupModal
        open={!!openGroup}
        group={openGroup}
        onClose={() => setOpenGroup(null)}
        onArticleClick={(a) => {
          setOpenGroup(null);
          openReader(a);
        }}
      />

      {/* Reader modal */}
      <ReaderModal
        open={!!readerArticle}
        article={readerArticle}
        onClose={() => setReaderArticle(null)}
        accent="indigo"
      />
    </div>
  );

  /* ------------------------------------------------------------------ */
  /*  HeroCard                                                          */
  /* ------------------------------------------------------------------ */
  function HeroCard({
    group,
    onRead,
    onOpenGroup,
  }: {
    group: ArticleGroup;
    onRead: () => void;
    onOpenGroup: () => void;
  }) {
    const a = group.rep;
    const candidates = getImageCandidates(a, 800);
    const hasImg = candidates.length > 0;
    const logoCandidates = getLogoCandidates(a);
    const multi = group.items.length > 1;

    return (
      <div
        onClick={onRead}
        className="group relative overflow-hidden rounded-xl cursor-pointer border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all duration-300"
      >
        <div className="relative h-52 sm:h-64 md:h-72">
          {hasImg ? (
            <SmartImage
              candidates={candidates}
              alt={a.title}
              wrapperClassName="absolute inset-0"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/20" />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/0" />

          {/* Top badge */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white uppercase tracking-wide">
              Top Story
            </span>
          </div>

          {/* Bottom content */}
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              {logoCandidates.length > 0 && (
                <div className="h-5 w-5 rounded-full overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
                  <SmartImage
                    candidates={logoCandidates}
                    alt={a.source.name}
                    className="h-full w-full object-contain p-0.5"
                  />
                </div>
              )}
              <span className="text-xs font-medium opacity-90 truncate max-w-[180px]">
                {a.source.name || getDomain(a.url)}
              </span>
              <span className="opacity-40">·</span>
              <time className="text-xs opacity-75" dateTime={a.publishedAt}>
                {new Date(a.publishedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </time>
              {multi && (
                <span className="ml-auto rounded-md border border-white/30 bg-white/15 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium">
                  +{group.items.length - 1} sources
                </span>
              )}
            </div>

            <h3 className="font-serif text-lg sm:text-xl md:text-2xl font-bold leading-snug line-clamp-2">
              {a.title}
            </h3>

            {multi && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGroup();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition-colors"
              >
                View all sources →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  GroupCard                                                         */
  /* ------------------------------------------------------------------ */
  function GroupCard({
    group,
    onRead,
    onOpen,
  }: {
    group: ArticleGroup;
    onRead: () => void;
    onOpen: () => void;
  }) {
    const a = group.rep;
    const candidates = getImageCandidates(a, 600);
    const hasImg = candidates.length > 0;
    const logoCandidates = getLogoCandidates(a);
    const multi = group.items.length > 1;

    const isCBS =
      a.url?.includes("cbsnews.com") ||
      a.source.name?.toLowerCase().includes("cbs");

    /* Image card */
    if (hasImg && !isCBS) {
      return (
        <div
          onClick={onRead}
          className="group relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
        >
          <div className="relative h-44 sm:h-48">
            <SmartImage
              candidates={candidates}
              alt={a.title}
              wrapperClassName="absolute inset-0"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            {/* Badge for multi-source */}
            {multi && (
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                  }}
                  className="rounded-md bg-indigo-600/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  +{group.items.length - 1}
                </button>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-3 text-white">
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px]">
                {logoCandidates.length > 0 && (
                  <div className="h-4 w-4 rounded-full overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
                    <SmartImage
                      candidates={logoCandidates}
                      alt={a.source.name}
                      className="h-full w-full object-contain p-0.5"
                    />
                  </div>
                )}
                <span className="font-medium opacity-85 truncate max-w-[110px]">
                  {a.source.name}
                </span>
                <span className="opacity-40">·</span>
                <time opacity-75 dateTime={a.publishedAt}>
                  {new Date(a.publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                {a.title}
              </h3>
            </div>
          </div>
        </div>
      );
    }

    /* Text-only card (CBS or no image) */
    return (
      <div
        onClick={onRead}
        className="group rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-900 p-4 cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
      >
        {/* CBS thumbnail floated right */}
        {isCBS && hasImg && (
          <div className="float-right ml-3 mb-2 h-14 w-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 flex-shrink-0">
            <SmartImage
              candidates={candidates}
              alt={a.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <h3 className="text-sm font-semibold text-brand-900 dark:text-gray-50 leading-snug line-clamp-3 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
          {a.title}
        </h3>

        {a.description && (
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
            {a.description}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center gap-2 clear-both">
          {logoCandidates.length > 0 && (
            <div className="h-4 w-4 rounded overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <SmartImage
                candidates={logoCandidates}
                alt={a.source.name}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
            {a.source.name}
          </span>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <time
            className="text-[10px] text-gray-400 dark:text-gray-500"
            dateTime={a.publishedAt}
          >
            {new Date(a.publishedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
          {multi && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="ml-auto rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors"
            >
              +{group.items.length - 1}
            </button>
          )}
        </div>
      </div>
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
      <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            disabled={page === 1 || loading}
            onClick={onPrev}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <button
            disabled={page === totalPages || loading}
            onClick={onNext}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:opacity-40 transition-all"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Page {page} of {totalPages}
          {loading && <span className="ml-2 animate-pulse">Loading…</span>}
        </p>
      </div>
    );
  }
}
