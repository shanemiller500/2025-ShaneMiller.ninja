/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  categories: (string | null | undefined | any)[];
  category?: string;
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

          const data: Article[] = (json?.results || []).map((r: any) => {
            const mainImg = r.image || null;
            const imagesArr = Array.isArray(r.images) ? r.images.filter(Boolean) : [];
            const thumbsArr = Array.isArray(r.thumbnails) ? r.thumbnails.filter(Boolean) : [];
            return {
              source: {
                id: null,
                name: r.source || getDomain(r.link),
                imageCandidates: Array.isArray(r.sourceImageCandidates) ? r.sourceImageCandidates : [],
              },
              author: r.author || null,
              title: r.headline ?? "",
              description: r.description ?? "",
              url: r.link,
              urlToImage: mainImg,
              image: mainImg,
              images: imagesArr,
              thumbnails: thumbsArr,
              publishedAt: r.publishedAt,
              content: r.content ?? null,
              categories: Array.isArray(r.categories) ? r.categories : [],
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
      if (!cancel) setArticles((a) => [...a]); // Force re-render with new array reference
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

  // hero group = newest group that has an image (skip CBS - their thumbnails are too small for hero)
  const heroGroup = useMemo(() => {
    return groups.find((g) => {
      const a = g.rep;
      const isCBS = a.url?.includes("cbsnews.com") || a.source.name?.toLowerCase().includes("cbs");
      if (isCBS) return false; // Skip CBS for hero - images too small
      return getImageCandidates(a, 800).length > 0;
    }) ?? null;
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
    <div className="mx-auto max-w-7xl pb-10">
      {error && (
        <div className="mb-4 sm:mb-6 border-2 border-red-600 dark:border-red-400 bg-white dark:bg-neutral-900 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Error</span>
          </div>
          <p className="text-xs sm:text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Filters - NEWSPAPER SECTION HEADER */}
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-3 border-b-2 border-neutral-900 dark:border-neutral-100 pb-3 sm:pb-4">
        <div className="flex items-center gap-2 mr-2 sm:mr-4">
          <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Region</span>
        </div>
        <div className="inline-flex overflow-hidden border-2 border-neutral-900 dark:border-neutral-100">
          {(["All", "USA", "World"] as const).map((r, idx) => (
            <button
              key={r}
              onClick={() => {
                setRegion(r);
                trackEvent("News Region Changed", { region: r });
              }}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition ${
                idx !== 0 ? "border-l-2 border-neutral-900 dark:border-neutral-100" : ""
              } ${
                region === r
                  ? "bg-red-600 dark:bg-red-400 text-white dark:text-neutral-900"
                  : "bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
          className="ml-auto border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100"
        >
          {providers.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* HERO - NEWSPAPER FRONT PAGE HEADLINE */}
      {heroGroup ? (
        <HeroCard group={heroGroup} onOpenGroup={() => setOpenGroup(heroGroup)} />
      ) : (
        <div className="mb-4 sm:mb-6 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-4 sm:p-6 text-center">
          <span className="text-xs sm:text-sm uppercase tracking-widest font-black text-neutral-500 dark:text-neutral-400">
            {loading ? "Loading top stories..." : "No stories found."}
          </span>
        </div>
      )}

      {/* GRID - NEWSPAPER ARTICLE GRID */}
      <div
        className={`mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 transition-opacity duration-200 ${
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
  /*  Cards - NEWSPAPER MAGAZINE STYLE                                  */
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
        className="group relative overflow-hidden border-2 sm:border-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] cursor-pointer transition-all duration-200 hover:shadow-xl"
      >
        <div className="relative h-56 sm:h-72 md:h-80">
          {hasImg ? (
            <SmartImage
              candidates={candidates}
              alt={a.title}
              wrapperClassName="absolute inset-0"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/0" />

          {/* Breaking news banner */}
          <div className="absolute top-0 left-0 bg-red-600 dark:bg-red-400 px-3 sm:px-4 py-1.5 sm:py-2">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-white dark:text-neutral-900">
              Top Story
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 text-white">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              {logoCandidates.length ? (
                <SmartImage
                  candidates={logoCandidates}
                  alt={a.source.name}
                  className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 object-contain border border-white/30 bg-white/10 p-0.5"
                />
              ) : null}
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-black opacity-95 truncate max-w-[200px]">
                {a.source.name || getDomain(a.url)}
              </span>
              <div className="w-1 h-1 bg-white/50 rounded-full"></div>
              <time dateTime={a.publishedAt} className="text-[10px] sm:text-xs uppercase tracking-wider font-bold opacity-80">
                {new Date(a.publishedAt).toLocaleString(undefined, { month: "short", day: "numeric" })}
              </time>

              {multi ? (
                <span className="ml-auto border border-white/50 bg-white/20 px-2 py-1 text-[9px] sm:text-[10px] uppercase tracking-wider font-black backdrop-blur">
                  +{group.items.length - 1} sources
                </span>
              ) : null}
            </div>

            <h3 className="line-clamp-2 text-lg sm:text-2xl md:text-3xl font-black leading-tight uppercase tracking-tight">
              {a.title}
            </h3>

            {multi ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGroup();
                }}
                className="mt-3 sm:mt-4 inline-flex items-center gap-2 border-2 border-white bg-transparent px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-widest font-black hover:bg-white hover:text-neutral-900 transition-all"
              >
                View all sources
                <span>→</span>
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

    // Check if this is a CBS News article (small thumbnails)
    const isCBS = a.url?.includes("cbsnews.com") || a.source.name?.toLowerCase().includes("cbs");

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

    // CBS News card - consistent style matching other cards
    if (isCBS) {
      return (
        <div
          onClick={handlePrimaryClick}
          className="group relative overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] cursor-pointer transition-all duration-200 hover:shadow-lg"
        >
          {/* Red accent bar */}
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600 dark:bg-red-400 z-10" />

          {/* Image */}
          {hasImg && (
            <div className="relative h-40 sm:h-48 bg-neutral-100 dark:bg-neutral-900">
              <SmartImage
                candidates={candidates}
                alt={a.title}
                wrapperClassName="absolute inset-0"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
          )}

          <div className="p-3 sm:p-4">
            {/* Title */}
            <h3 className="text-sm sm:text-base font-extrabold leading-tight text-neutral-900 dark:text-neutral-100 line-clamp-3 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
              {a.title}
            </h3>

            {/* Grey divider line */}
            <div className="h-px bg-neutral-300 dark:bg-neutral-700 my-3" />

            {/* Footer: Logo + Source name + Dot + Date */}
            <div className="flex items-center gap-2">
              {logoCandidates.length ? (
                <SmartImage
                  candidates={logoCandidates}
                  alt={a.source.name}
                  className="h-5 w-5 object-contain rounded bg-white dark:bg-neutral-800 p-0.5 border border-neutral-200 dark:border-neutral-700"
                />
              ) : null}
              <span className="text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                CBS News
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <time className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400" dateTime={a.publishedAt}>
                {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </time>
              {multi ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                  }}
                  className="ml-auto bg-red-600 dark:bg-red-400 text-white dark:text-neutral-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide hover:bg-red-700 dark:hover:bg-red-300 transition-colors"
                >
                  +{group.items.length - 1}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    // Card with image - NEWSPAPER STYLE (for non-CBS sources)
    if (hasImg) {
      return (
        <div
          onClick={handlePrimaryClick}
          className="group relative overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] cursor-pointer transition-all duration-200 hover:shadow-lg"
        >
          {/* Red accent bar - z-10 to appear above image */}
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600 dark:bg-red-400 z-10" />
          
          <div className="relative h-48 sm:h-52">
            <SmartImage
  candidates={candidates}
  alt={a.title}
  wrapperClassName="absolute inset-0"
  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
/>

            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/0" />
            <div className="absolute bottom-0 w-full p-3 sm:p-4 text-white">
              <div className="flex items-center gap-2 text-[10px] sm:text-xs mb-2">
                {logoCandidates.length ? (
                  <SmartImage
                    candidates={logoCandidates}
                    alt={a.source.name}
                    className="h-4 w-4 sm:h-5 sm:w-5 object-contain border border-white/30 bg-white/10 p-0.5"
                  />
                ) : null}

                <span className="truncate max-w-[120px] uppercase tracking-wider font-black opacity-95">
                  {a.source.name}
                </span>
                <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                <time className="uppercase tracking-wider font-bold opacity-80" dateTime={a.publishedAt}>
                  {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </time>

                {multi ? (
                  <span className="ml-auto border border-white/50 bg-white/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-black backdrop-blur">
                    +{group.items.length - 1}
                  </span>
                ) : null}
              </div>

              <h3 className="line-clamp-2 text-sm sm:text-base font-black leading-snug uppercase tracking-tight">
                {a.title}
              </h3>

              {multi ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                  }}
                  className="mt-2 sm:mt-3 inline-flex items-center gap-1.5 border border-white bg-transparent px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] uppercase tracking-widest font-black hover:bg-white hover:text-neutral-900 transition-all"
                >
                  View sources
                  <span>→</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    // Text-only card - NEWSPAPER STYLE
    return (
      <div
        onClick={handlePrimaryClick}
        className="group relative border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-3 sm:p-4 pl-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        {/* Red accent bar */}
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600 dark:bg-red-400" />

        <h3 className="line-clamp-3 text-sm sm:text-base font-black leading-snug text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
          {a.title}
        </h3>

        {a.description ? (
          <p className="mt-2 line-clamp-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {a.description}
          </p>
        ) : null}

        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-2 text-[10px] sm:text-xs">
          {logoCandidates.length ? (
            <SmartImage
              candidates={logoCandidates}
              alt={a.source.name}
              className="h-5 w-5 sm:h-6 sm:w-6 object-contain border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-0.5"
            />
          ) : null}

          <span className="truncate max-w-[120px] uppercase tracking-wider font-black text-neutral-700 dark:text-neutral-300">{a.source.name}</span>
          <div className="w-1 h-1 bg-neutral-400 rounded-full"></div>
          <time className="uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400" dateTime={a.publishedAt}>
            {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </time>

          {group.items.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="ml-auto border border-neutral-900 dark:border-neutral-100 bg-red-600 dark:bg-red-400 px-2 py-1 text-[9px] uppercase tracking-wider font-black text-white dark:text-neutral-900 hover:bg-neutral-900 dark:hover:bg-neutral-100 transition-all"
            >
              +{group.items.length - 1}
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
      <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            disabled={page === 1 || loading}
            onClick={onPrev}
            className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] px-4 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-900 disabled:opacity-40 transition-all"
          >
            ← Previous
          </button>

          <button
            disabled={page === totalPages || loading}
            onClick={onNext}
            className="border-2 border-neutral-900 dark:border-neutral-100 bg-red-600 dark:bg-red-400 px-4 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 dark:hover:bg-neutral-100 dark:hover:text-neutral-900 dark:hover:border-neutral-100 disabled:opacity-40 transition-all"
          >
            Next →
          </button>
        </div>

        <div className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400">
          Page <span className="font-black text-neutral-900 dark:text-neutral-100">{page}</span> / {totalPages}
          {loading && <span className="ml-2 animate-pulse">Loading...</span>}
        </div>
      </div>
    );
  }

  function SkeletonCard() {
    return (
      <div className="animate-pulse overflow-hidden border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1D1D20]">
        <div className="h-48 bg-neutral-100 dark:bg-neutral-800" />
        <div className="p-3 sm:p-4">
          <div className="h-3 w-3/4 bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-2 h-3 w-2/3 bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-4 h-3 w-1/3 bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>
    );
  }
}
