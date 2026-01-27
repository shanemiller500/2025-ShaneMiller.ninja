/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMediaStackArticles } from "./Mediastack-API-Call";
import { fetchFinnhubArticles } from "./Finnhub-API-Call";
import { fetchUmailArticles } from "./MoreNewsAPI";
import { trackEvent } from "@/utils/mixpanel";
import {
  GroupModal,
  ReaderModal,
  SmartImage,
  getImageCandidates,
  getLogoCandidates,
  stableKey,
  type ArticleGroup,
} from "./NewsModals";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export interface Article {
  source: {
    id: string | null;
    name: string;
    imageCandidates?: string[];
  };
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
  image?: string;
}


/* ------------------------------------------------------------------ */
/*  Constants / helpers                                               */
/* ------------------------------------------------------------------ */
const PER_PAGE = 36;
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const API_BASE = "https://u-mail.co/api/NewsAPI";
const USA_ENDPOINT = `${API_BASE}/us-news`;

const getDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

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
  return cats.includes("us") || cats.includes("united states") || /\.us$/.test(host);
};

// Title grouping key: “normalize hard” to reduce near-duplicates
const normalizeTitleKey = (t: string) => {
  const s = String(t || "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // strip common suffix patterns: " - CNN", " | Reuters", etc.
  return s
    .replace(/\s+[-|]\s+(cnn|reuters|ap news|associated press|fox news|bbc|cnbc|wsj|the wall street journal|nyt|the new york times)$/i, "")
    .trim();
};

function groupByTitle(articles: Article[]): ArticleGroup[] {
  const map = new Map<string, Article[]>();

  for (const a of articles) {
    const key = normalizeTitleKey(a.title || "") || (a.url ? a.url : stableKey(a));
    const list = map.get(key);
    if (list) list.push(a);
    else map.set(key, [a]);
  }

  const groups: ArticleGroup[] = [];

  // IMPORTANT: avoids TS downlevelIteration issues
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

  // newest group first
  groups.sort((a, b) => +new Date(b.newestAt) - +new Date(a.newestAt));
  return groups;
}

/* ------------------------------------------------------------------ */
/*  caches                                                            */
/* ------------------------------------------------------------------ */
let CACHE_ALL: { ts: number; data: Article[] } | null = null;
let USA_CACHE: { ts: number; data: Article[] } | null = null;
let USA_FETCH: Promise<void> | null = null;


/* ------------------------------------------------------------------ */
/*  Component                                                          */
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
  const [readerArticle, setReaderArticle] = useState<Article | null>(null);

  // hydrate USA cache
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

  // load main feeds
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

        const ok = (r: PromiseSettledResult<Article[]>) =>
          r.status === "fulfilled" ? r.value : [];

        const merged = sortByDateDesc(uniqByKey([...ok(ms), ...ok(fh), ...ok(um)]));

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

  // load USA-only endpoint when needed
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
            source: {
              id: null,
              name: getDomain(r.link),
              imageCandidates: r.sourceImageCandidates || [],
            },
            author: r.author || null,
            title: r.headline ?? "",
            description: r.description ?? "",
            url: r.link,
            urlToImage: r.image ?? null,
            images: r.images,
            thumbnails: r.thumbnails,
            publishedAt: r.publishedAt,
            content: r.content ?? null,
            categories: r.categories || [],
          }));

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
      if (!cancel) setArticles((a) => a);
    });

    return () => {
      cancel = true;
    };
  }, [region]);

  // region filter
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

  // provider filter
  const byProvider = useMemo(
    () => (provider === "All" ? dataset : dataset.filter((a) => a.source.name === provider)),
    [provider, dataset]
  );

  // GROUPS (mixed feed)
  const groups = useMemo(() => groupByTitle(byProvider), [byProvider]);

  // hero group = newest group that has an image
  const heroGroup = useMemo(() => {
    return groups.find((g) => getImageCandidates(g.rep, 800).length > 0) ?? null;
  }, [groups]);

  const restGroups = useMemo(() => {
    if (!heroGroup) return groups;
    return groups.filter((g) => g.key !== heroGroup.key);
  }, [groups, heroGroup]);

  useEffect(() => setPage(1), [region, provider]);

  const totalPages = Math.max(1, Math.ceil(restGroups.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const pageGroups = restGroups.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

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
    [fade, totalPages, safePage]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      {error && (
        <p className="mb-6 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900">
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
                     dark:border-white/10 dark:bg-brand-900 dark:text-gray-200 sm:text-sm"
        >
          {providers.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* HERO */}
      {heroGroup ? (
        <HeroCard group={heroGroup} onOpenGroup={() => setOpenGroup(heroGroup)} />
      ) : (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-brand-900 dark:text-gray-300">
          {loading ? "Loading top stories…" : "No stories found."}
        </div>
      )}

      {/* GRID (mixed groups inline, newest first) */}
      <div
        className={`mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 transition-opacity duration-200 ${
          fade ? "opacity-0" : "opacity-100"
        }`}
      >
        {loading && groups.length === 0
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="col-span-1">
                <SkeletonCard />
              </div>
            ))
          : pageGroups.map((g) => (
              <div key={g.key} className="col-span-1">
                <GroupCard group={g} onOpen={() => setOpenGroup(g)} />
              </div>
            ))}
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        loading={loading}
        onPrev={() => changePage(safePage - 1)}
        onNext={() => changePage(safePage + 1)}
      />

      <GroupModal
        open={!!openGroup}
        group={openGroup}
        onClose={() => setOpenGroup(null)}
        onArticleClick={(article) => {
          setOpenGroup(null);
          setReaderArticle(article);
        }}
      />
      <ReaderModal open={!!readerArticle} article={readerArticle} onClose={() => setReaderArticle(null)} />
    </div>
  );

  /* ------------------------------------------------------------------ */
  /*  Cards                                                             */
  /* ------------------------------------------------------------------ */
  function HeroCard({
    group,
    onOpenGroup,
  }: {
    group: ArticleGroup;
    onOpenGroup: () => void;
  }) {
    const a = group.rep;
    const candidates = getImageCandidates(a, 800);
    const hasImg = candidates.length > 0;
    const logoCandidates = getLogoCandidates(a);
    const multi = group.items.length > 1;

    const onClick = (e: React.MouseEvent) => {
      e.preventDefault();
      trackEvent("Article Clicked", {
        title: a.title,
        url: a.url,
        source: a.source.name,
        strip: true,
        grouped: multi,
      });
      setReaderArticle(a);
    };

    return (
      <div
        onClick={onClick}
        className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 dark:border-white/10 dark:bg-brand-900 cursor-pointer"
      >
        <div className="relative h-52 sm:h-64">
          {hasImg ? (
            <SmartImage
              candidates={candidates}
              alt={a.title}
              wrapperClassName="absolute inset-0"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 bg-gray-100 dark:bg-white/5" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/0" />

          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="flex items-center gap-2">
              {logoCandidates.length ? (
                <SmartImage
                  candidates={logoCandidates}
                  alt={a.source.name}
                  className="h-4 w-4 flex-shrink-0 rounded bg-white/10 object-contain"
                />
              ) : null}
              <span className="max-w-[220px] truncate text-xs font-semibold opacity-95">
                {a.source.name || getDomain(a.url)}
              </span>
              <span className="opacity-70">•</span>
              <time dateTime={a.publishedAt} className="text-xs opacity-80">
                {new Date(a.publishedAt).toLocaleString(undefined, { month: "short", day: "numeric" })}
              </time>

              {multi ? (
                <span className="ml-auto rounded-full bg-white/50 px-2 py-1 text-[10px] font-semibold backdrop-blur">
                  +{group.items.length - 1} sources
                </span>
              ) : null}
            </div>

            <h3 className="mt-2 line-clamp-2 text-base font-extrabold leading-snug sm:text-lg">
              {a.title}
            </h3>

            {multi ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGroup();
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20 transition"
              >
                View all sources
                <span className="opacity-80">→</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function GroupCard({ group, onOpen }: { group: ArticleGroup; onOpen: () => void }) {
    const a = group.rep;
    const candidates = getImageCandidates(a, 600);
    const hasImg = candidates.length > 0;
    const logoCandidates = getLogoCandidates(a);
    const multi = group.items.length > 1;

    const handlePrimaryClick = (e: React.MouseEvent) => {
      e.preventDefault();
      trackEvent("Article Clicked", {
        title: a.title,
        url: a.url,
        source: a.source.name,
        strip: false,
        grouped: multi,
      });
      setReaderArticle(a);
    };

    // One image only. If no image: show text card (no fake "no image" filler)
    if (hasImg) {
      return (
        <div
          onClick={handlePrimaryClick}
          className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md dark:border-white/10 dark:bg-brand-900 cursor-pointer"
        >
          <div className="relative h-44">
            <SmartImage
              candidates={candidates}
              alt={a.title}
              wrapperClassName="absolute inset-0"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/0" />
            <div className="absolute bottom-0 w-full p-3 text-white">
              <div className="flex items-center gap-2 text-xs">
                {logoCandidates.length ? (
                  <SmartImage
                    candidates={logoCandidates}
                    alt={a.source.name}
                    className="h-4 w-4 rounded bg-white/10 object-contain"
                  />
                ) : null}

                <span className="max-w-[160px] truncate font-semibold opacity-95">
                  {a.source.name}
                </span>
                <span className="opacity-70">•</span>
                <time className="opacity-80" dateTime={a.publishedAt}>
                  {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </time>

                {multi ? (
                  <span className="ml-auto rounded-full bg-white/50 px-2 py-1 text-[10px] font-semibold backdrop-blur transition-opacity duration-200 group-hover:bg-white/20">
                    +{group.items.length - 1} sources
                  </span>
                ) : null}
              </div>

              <h3 className="mt-2 line-clamp-3 text-sm font-semibold leading-snug">
                {a.title}
              </h3>

              {multi ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur transition hover:bg-white/20"
                >
                  View sources
                  <span className="opacity-80">→</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    // Text-only card (no image shown)
    return (
      <div
        onClick={handlePrimaryClick}
        className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md dark:border-white/10 dark:bg-brand-900 cursor-pointer"
      >
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-gray-900 dark:text-white">
          {a.title}
        </h3>

        {a.description ? (
          <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
            {a.description}
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          {logoCandidates.length ? (
            <SmartImage
              candidates={logoCandidates}
              alt={a.source.name}
              className="h-4 w-4 rounded bg-white/10 object-contain"
            />
          ) : null}

          <span className="max-w-[160px] truncate font-medium">{a.source.name}</span>
          <span className="text-gray-400">•</span>
          <time className="text-gray-500 dark:text-gray-400" dateTime={a.publishedAt}>
            {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </time>

          {group.items.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="ml-auto rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 transition
                         dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
            >
              +{group.items.length - 1} sources
            </button>
          ) : null}
        </div>
      </div>
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
        <div className="flex items-center gap-2">
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

  function SkeletonCard() {
    return (
      <div className="animate-pulse overflow-hidden gap-5 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900">
        <div className="h-40 bg-gray-100 dark:bg-white/5" />
        <div className="p-4">
          <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-white/5" />
          <div className="mt-2 h-3 w-2/3 rounded bg-gray-100 dark:bg-white/5" />
          <div className="mt-4 h-3 w-1/3 rounded bg-gray-100 dark:bg-white/5" />
        </div>
      </div>
    );
  }
}
