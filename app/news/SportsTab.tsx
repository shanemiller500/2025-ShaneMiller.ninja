/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchSportsNews } from "./sportsNews";
import LiveScores from "./LiveScores";
import {
  ReaderModal,
  SmartImage,
  getDomain,
  favicon,
  stableKey,
  uniqStrings,
  getImageCandidates,
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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const normalize = (s: string) => {
  const t = s.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1D1D20]">
      <div className="h-48 bg-neutral-100 dark:bg-neutral-800" />
      <div className="p-3 sm:p-4">
        <div className="h-3 w-11/12 bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-2 h-3 w-8/12 bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-4 h-3 w-4/12 bg-neutral-200 dark:bg-neutral-700" />
      </div>
    </div>
  );
}

/* --------------------------------------------- */
/* Live scores router for tabs                   */
/* - All tab => show ALL live sports             */
/* - League tab => show ONLY that league live    */
/* - If none live => show "No live games..."     */
/* --------------------------------------------- */
function LiveScoresForTab({ tab }: { tab: TabKey }) {
  const [live, setLive] = useState<LiveGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;

    const tick = async () => {
      try {
        const res = await fetch(`https://u-mail.co/api/sportsGames/live?date=${todayET()}`, {
          cache: "no-store",
        });
        const j = await res.json();
        const games: LiveGame[] = Array.isArray(j?.games) ? j.games : [];

        // safety: ensure "live" really means live
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

  // Don’t show anything until we’ve checked once (prevents flicker)
  if (!loaded) return null;

  // If no live games for the selected tab, show the message (not "No games today.")
  if (!hasLiveForTab) {
    return (
      <div className="mt-4 sm:mt-6 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-500 dark:text-neutral-400">
            No live games right now
          </span>
        </div>
      </div>
    );
  }

  // All = all live games
  if (tab === "all") return <LiveScores sport="all" />;

  // League tab = only that league (LiveScores will show only live for that league)
  return <LiveScores sport={tab} />;
}

export default function SportsTab() {
  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readerArticle, setReaderArticle] = useState<Article | null>(null);

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

  const topStrip = useMemo(() => uniq.filter((a) => getImageCandidates(a).length > 0).slice(0, 4), [uniq]);

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
      {/* Sports Category Tabs - NEWSPAPER STYLE */}
      <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] mb-4 sm:mb-6">
        <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600">
          {CATEGORIES.map((c, idx) => {
            const isActive = tab === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setTab(c.key)}
                className={[
                  "relative shrink-0 whitespace-nowrap px-3 sm:px-5 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all",
                  idx !== 0 ? "border-l-2 border-neutral-900 dark:border-neutral-100" : "",
                  isActive
                    ? "bg-red-600 dark:bg-red-400 text-white dark:text-neutral-900"
                    : "bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live scores obey the selected tab */}
      <LiveScoresForTab tab={tab} />

      {error && (
        <div className="mt-4 border-2 border-red-600 dark:border-red-400 bg-white dark:bg-neutral-900 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Error</span>
          </div>
          <p className="text-xs sm:text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Top Stories Strip - FEATURED SPORTS HEADLINES */}
      {topStrip.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <div className="flex items-center gap-2 mb-3 sm:mb-4 border-b-2 border-neutral-900 dark:border-neutral-100 pb-2">
            <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Featured Stories</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {topStrip.map((a, i) => {
              const domain = getDomain(a.url);
              const logoCandidates = uniqStrings([a.source.image ?? "", favicon(domain)].filter(Boolean).map(normalize));
              const imgCandidates = getImageCandidates(a);

              return (
                <button
                  key={`${stableKey(a)}-${i}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setReaderArticle(a);
                  }}
                  className="group relative block w-full text-left h-48 sm:h-52 overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] transition-all duration-200 hover:shadow-lg"
                >
                  {imgCandidates.length ? (
                    <SmartImage
                      candidates={imgCandidates}
                      alt={a.title}
                      wrapperClassName="absolute inset-0"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                      <span className="text-[10px] uppercase tracking-widest font-black text-neutral-400">No image</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/0" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4 text-white">
                    <h3 className="line-clamp-2 text-sm sm:text-base font-black leading-snug uppercase tracking-tight">{a.title}</h3>
                    <div className="mt-2 flex items-center gap-2 text-[10px] sm:text-xs">
                      {logoCandidates.length ? (
                        <SmartImage candidates={logoCandidates} alt={a.source.name} className="h-4 w-4 sm:h-5 sm:w-5 object-contain border border-white/30 bg-white/10 p-0.5" />
                      ) : null}
                      <span className="truncate max-w-[120px] uppercase tracking-wider font-black opacity-90">{a.source.name}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Article Grid - SPORTS NEWS SECTION */}
      <section className="mt-6 sm:mt-8">
        <div className="flex items-center gap-2 mb-3 sm:mb-4 border-b-2 border-neutral-900 dark:border-neutral-100 pb-2">
          <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Latest Sports News</span>
        </div>

        {loading && articles.length === 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div
            className={`
              grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3
              transition-opacity duration-200
              ${loading ? "opacity-70" : "opacity-100"}
            `}
          >
            {pageNews.map((a) => (
              <ArticleCard key={stableKey(a)} article={a} onClick={() => setReaderArticle(a)} />
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

      <ReaderModal open={!!readerArticle} article={readerArticle} onClose={() => setReaderArticle(null)} />
    </div>
  );
}

function ArticleCard({ article, onClick }: { article: Article; onClick?: () => void }) {
  const domain = getDomain(article.url);
  const logoCandidates = uniqStrings([article.source.image ?? "", favicon(domain)].filter(Boolean).map(normalize));
  const imgCandidates = getImageCandidates(article);

  // Card with image - SPORTS MAGAZINE STYLE
  if (imgCandidates.length) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
        }}
        className="group block w-full text-left overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] transition-all duration-200 hover:shadow-lg"
      >
        <div className="relative h-48 sm:h-52">
          <SmartImage
            candidates={imgCandidates}
            alt={article.title}
            wrapperClassName="absolute inset-0"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/0" />
          <div className="absolute bottom-0 z-10 flex w-full flex-col gap-2 p-3 sm:p-4 text-white">
            <h3 className="line-clamp-2 text-sm sm:text-base font-black leading-snug uppercase tracking-tight">{article.title}</h3>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs">
              {logoCandidates.length ? (
                <SmartImage candidates={logoCandidates} alt={article.source.name} className="h-4 w-4 sm:h-5 sm:w-5 object-contain border border-white/30 bg-white/10 p-0.5" />
              ) : null}
              <span className="truncate max-w-[120px] uppercase tracking-wider font-black opacity-90">{article.source.name}</span>
              <div className="w-1 h-1 bg-white/50 rounded-full"></div>
              <time className="whitespace-nowrap uppercase tracking-wider font-bold opacity-80">
                {new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </time>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // Text-only card - SPORTS MAGAZINE STYLE
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className="group block w-full text-left overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-3 sm:p-4 transition-all duration-200 hover:shadow-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
    >
      <h3 className="line-clamp-3 text-sm sm:text-base font-black leading-snug text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">{article.title}</h3>
      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-2 text-[10px] sm:text-xs">
        {logoCandidates.length ? (
          <SmartImage candidates={logoCandidates} alt={article.source.name} className="h-5 w-5 sm:h-6 sm:w-6 object-contain border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-0.5" />
        ) : null}
        <span className="truncate max-w-[140px] uppercase tracking-wider font-black text-neutral-700 dark:text-neutral-300">{article.source.name}</span>
        <div className="w-1 h-1 bg-neutral-400 rounded-full"></div>
        <time className="whitespace-nowrap uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400">
          {new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </time>
      </div>
    </button>
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
