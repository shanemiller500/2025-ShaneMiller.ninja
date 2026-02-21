/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchSportsNews } from "./sportsNews";
import LiveScores from "./LiveScores";
import { SmartImage, SkeletonCard } from "../lib/SmartImage";
import { getDomain } from "../lib/utils";
import ReaderModal, { type ReadableArticle } from "../components/ReaderModal";
import {
  stableKey,
  getImageCandidates,
  getLogoCandidates,
  type SportsArticle,
} from "./SportsModals";

type Article = SportsArticle;

interface LiveGame {
  id: string;
  league: string;
  leagueDisplay?: string;
  status?: string;
  isLive?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CACHE_TTL = 30 * 60 * 1000;
const PER_PAGE = 36;

const CATEGORIES = [
  { key: "all", label: "All Sports" },
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
  { key: "soccer", label: "Soccer" },
  { key: "mma", label: "MMA" },
] as const;

type TabKey = (typeof CATEGORIES)[number]["key"];
const cached: Record<string, { ts: number; data: Article[] }> = {};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const todayET = () => {
  const fmt = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [m, d, y] = fmt.split("/");
  return `${y}${m}${d}`;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

function toReadable(a: Article): ReadableArticle {
  return {
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    sourceName: a.source.name || getDomain(a.url),
    description: undefined,
    imageCandidates: getImageCandidates(a),
    logoCandidates: getLogoCandidates(a),
  };
}

/* ------------------------------------------------------------------ */
/*  LiveScoresForTab                                                   */
/* ------------------------------------------------------------------ */
function LiveScoresForTab({ tab }: { tab: TabKey }) {
  const [live, setLive] = useState<LiveGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;

    const tick = async () => {
      try {
        const res = await fetch(
          `https://u-mail.co/api/sportsGames/live?date=${todayET()}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        const games: LiveGame[] = Array.isArray(j?.games) ? j.games : [];
        const filtered = games.filter(
          (g) => g?.isLive === true || /live|in progress/i.test(g?.status || "")
        );
        if (!cancel) {
          setLive(filtered);
          setLoaded(true);
        }
      } catch {
        if (!cancel) {
          setLive([]);
          setLoaded(true);
        }
      }
    };

    tick();
    const iv = setInterval(tick, 60_000);
    return () => {
      cancel = true;
      clearInterval(iv);
    };
  }, []);

  const hasLiveForTab = useMemo(() => {
    if (tab === "all") return live.length > 0;
    return live.some((g) => String(g.league || "").toLowerCase() === tab);
  }, [live, tab]);

  if (!loaded) return null;

  if (!hasLiveForTab) {
    return (
      <div className="mb-4 sm:mb-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
            No live games right now
          </span>
        </div>
      </div>
    );
  }

  return tab === "all" ? <LiveScores sport="all" /> : <LiveScores sport={tab} />;
}

/* ------------------------------------------------------------------ */
/*  SportsTab                                                          */
/* ------------------------------------------------------------------ */
export default function SportsTab() {
  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readerArticle, setReaderArticle] = useState<ReadableArticle | null>(null);

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
          const r = await fetch(
            `https://u-mail.co/api/sportsByCategory/${tab}`,
            { cache: "no-store" }
          );
          if (!r.ok) throw new Error(`Sports category API ${r.status}`);
          const j = await r.json();
          news = (j.results || []).map((it: Record<string, unknown>) => ({
            title: it.title as string,
            url: it.link as string,
            urlToImage: (it.image as string) ?? null,
            images: Array.isArray(it.images) ? it.images as string[] : [],
            publishedAt: it.publishedAt as string,
            source: {
              id: null,
              name: it.source as string,
              image: (it.sourceLogo as string) ?? null,
            },
          }));
        }

        const map = new Map<string, Article>();
        for (const a of news) {
          const k = stableKey(a);
          if (!map.has(k)) map.set(k, a);
        }
        const uniq = Array.from(map.values()).sort(
          (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
        );

        if (!cancel) {
          cached[tab] = { ts: Date.now(), data: uniq };
          setArticles(uniq);
          setPage(1);
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
  }, [tab]);

  const uniq = useMemo(() => {
    const map = new Map<string, Article>();
    for (const a of articles) {
      const k = stableKey(a);
      if (!map.has(k)) map.set(k, a);
    }
    return Array.from(map.values());
  }, [articles]);

  /* Featured: up to 4 articles with images */
  const featured = useMemo(
    () => uniq.filter((a) => getImageCandidates(a).length > 0).slice(0, 4),
    [uniq]
  );

  const rest = useMemo(() => {
    const heroKeys = new Set(featured.map(stableKey));
    return uniq.filter((a) => !heroKeys.has(stableKey(a)));
  }, [uniq, featured]);

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

  const openReader = (a: Article) => setReaderArticle(toReadable(a));

  return (
    <div className="pb-10">
      {/* Sport category tabs */}
      <div className="mb-4 sm:mb-5 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-1">
          {CATEGORIES.map((c) => {
            const isActive = tab === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setTab(c.key)}
                className={[
                  "shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isActive
                    ? "bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
                ].join(" ")}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live scores */}
      <LiveScoresForTab tab={tab} />

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Featured stories */}
      {featured.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-orange-500" />
            <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Featured Stories
            </h2>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((a, i) => {
              const imgCandidates = getImageCandidates(a);
              const logoCandidates = getLogoCandidates(a);

              return (
                <button
                  key={`${stableKey(a)}-${i}`}
                  onClick={() => openReader(a)}
                  className="group relative block w-full text-left h-44 sm:h-48 overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 hover:shadow-md transition-all duration-200"
                >
                  {imgCandidates.length > 0 && (
                    <SmartImage
                      candidates={imgCandidates}
                      alt={a.title}
                      wrapperClassName="absolute inset-0"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Sport badge */}
                  {i === 0 && (
                    <div className="absolute top-2.5 left-2.5">
                      <span className="rounded-md bg-orange-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">
                        Featured
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1.5">
                      {a.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {logoCandidates.length > 0 && (
                        <div className="h-4 w-4 rounded-full overflow-hidden bg-white/10 border border-white/20">
                          <SmartImage
                            candidates={logoCandidates}
                            alt={a.source.name}
                            className="h-full w-full object-contain p-0.5"
                          />
                        </div>
                      )}
                      <span className="opacity-85 truncate max-w-[100px]">
                        {a.source.name}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Latest articles */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-orange-500" />
          <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Latest Sports News
          </h2>
        </div>

        {loading && articles.length === 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-200 ${
              loading ? "opacity-60" : "opacity-100"
            }`}
          >
            {pageNews.map((a) => (
              <ArticleCard key={stableKey(a)} article={a} onClick={() => openReader(a)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              disabled={safePage === 1 || loading}
              onClick={() => changePage(safePage - 1)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              disabled={safePage === totalPages || loading}
              onClick={() => changePage(safePage + 1)}
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 dark:bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 dark:hover:bg-orange-400 disabled:opacity-40 transition-all"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Page {safePage} of {totalPages}
            {loading && <span className="ml-2 animate-pulse">Loading…</span>}
          </p>
        </div>
      </section>

      <ReaderModal
        open={!!readerArticle}
        article={readerArticle}
        onClose={() => setReaderArticle(null)}
        accent="orange"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ArticleCard                                                        */
/* ------------------------------------------------------------------ */
function ArticleCard({
  article,
  onClick,
}: {
  article: Article;
  onClick?: () => void;
}) {
  const imgCandidates = getImageCandidates(article);
  const logoCandidates = getLogoCandidates(article);

  if (imgCandidates.length > 0) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
        }}
        className="group block w-full text-left overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
      >
        <div className="relative h-44 sm:h-48">
          <SmartImage
            candidates={imgCandidates}
            alt={article.title}
            wrapperClassName="absolute inset-0"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 w-full p-3 text-white">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1.5">
              {article.title}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px]">
              {logoCandidates.length > 0 && (
                <div className="h-4 w-4 rounded-full overflow-hidden bg-white/10 border border-white/20">
                  <SmartImage
                    candidates={logoCandidates}
                    alt={article.source.name}
                    className="h-full w-full object-contain p-0.5"
                  />
                </div>
              )}
              <span className="opacity-85 truncate max-w-[110px]">
                {article.source.name}
              </span>
              <span className="opacity-40">·</span>
              <time>
                {new Date(article.publishedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className="group block w-full text-left rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
    >
      <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-50 leading-snug line-clamp-3 group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors">
        {article.title}
      </h3>
      <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center gap-2">
        {logoCandidates.length > 0 && (
          <div className="h-4 w-4 rounded overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <SmartImage
              candidates={logoCandidates}
              alt={article.source.name}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[130px]">
          {article.source.name}
        </span>
        <span className="text-gray-300 dark:text-gray-700">·</span>
        <time className="text-[10px] text-gray-400 dark:text-gray-500">
          {new Date(article.publishedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
    </button>
  );
}
