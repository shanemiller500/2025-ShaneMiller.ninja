"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";

import { fetchFinanceNews } from "./financeNews";
import {
  ReaderModal,
  SmartImage,
  getLogoCandidates,
  getImageCandidates,
  stableKey,
  type FinanceArticle,
} from "./FinanceModals";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Article = FinanceArticle;

interface PaginationProps {
  page: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CACHE_TTL_MS = 30 * 60 * 1000;
const PER_PAGE = 36;
const SCROLL_DURATION_MS = 700;
const FADE_DURATION_MS = 400;

/* ------------------------------------------------------------------ */
/*  Module Cache                                                       */
/* ------------------------------------------------------------------ */
let cachedFinance: { ts: number; data: Article[] } | null = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function smoothScrollToTop(d = SCROLL_DURATION_MS): void {
  const start = window.scrollY,
    t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / d);
    const ease = p * (2 - p);
    window.scrollTo(0, Math.ceil((1 - ease) * start));
    if (window.scrollY) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/*  FinanceTab Component                                               */
/* ------------------------------------------------------------------ */
export default function FinanceTab() {
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fade, setFade] = useState(false);
  const [readerArticle, setReaderArticle] = useState<Article | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;

    (async () => {
      if (cachedFinance && Date.now() - cachedFinance.ts < CACHE_TTL_MS) {
        setArticles(cachedFinance.data);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const financeNews = await fetchFinanceNews();
        if (!cancel) {
          cachedFinance = { ts: Date.now(), data: financeNews };
          setArticles(financeNews);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancel) setError(e?.message ?? "Unknown error");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
  const startIdx = (page - 1) * PER_PAGE;
  const slice = articles.slice(startIdx, startIdx + PER_PAGE);

  const turnPage = (n: number): void => {
    if (fade) return;
    smoothScrollToTop();
    setFade(true);
    setTimeout(() => {
      setPage(n);
      setFade(false);
    }, FADE_DURATION_MS);
  };

  // Get hero articles (with images) for featured section
  const heroArticles = useMemo(() => {
    return articles.filter((a) => getImageCandidates(a).length > 0).slice(0, 4);
  }, [articles]);

  const heroKeys = useMemo(() => new Set(heroArticles.map(stableKey)), [heroArticles]);

  // Filter out hero articles from regular slice
  const regularSlice = useMemo(() => {
    return slice.filter((a) => !heroKeys.has(stableKey(a)));
  }, [slice, heroKeys]);

  return (
    <div ref={contentRef} className="pb-10">
      {error && (
        <div className="mb-4 sm:mb-6 border-2 border-red-600 dark:border-red-400 bg-white dark:bg-neutral-900 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Error</span>
          </div>
          <p className="text-xs sm:text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      <section className="w-full">
        <div className={`transition-opacity duration-300 ${fade ? "opacity-0" : "opacity-100"}`}>
          {/* Hero Section - Featured Finance Stories */}
          {heroArticles.length > 0 && page === 1 && (
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 mb-3 sm:mb-4 border-b-2 border-neutral-900 dark:border-neutral-100 pb-2">
                <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Featured Finance</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {heroArticles.map((a) => {
                  const logoCandidates = getLogoCandidates(a);
                  const imgCandidates = getImageCandidates(a);

                  return (
                    <button
                      key={stableKey(a)}
                      onClick={(e) => {
                        e.preventDefault();
                        setReaderArticle(a);
                      }}
                      className="group relative block w-full text-left h-48 sm:h-56 overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] transition-all duration-200 hover:shadow-lg"
                    >
                      {imgCandidates.length > 0 && (
                        <SmartImage
                          candidates={imgCandidates}
                          alt={a.title}
                          wrapperClassName="absolute inset-0"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/0" />

                      {/* Finance badge */}
                      <div className="absolute top-0 left-0 bg-green-600 dark:bg-green-400 px-2 sm:px-3 py-1 sm:py-1.5">
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-black text-white dark:text-neutral-900">
                          Finance
                        </span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4 text-white">
                        <h3 className="line-clamp-2 text-sm sm:text-base font-black leading-snug uppercase tracking-tight">{a.title}</h3>
                        <div className="mt-2 flex items-center gap-2 text-[10px] sm:text-xs">
                          {logoCandidates.length > 0 && (
                            <SmartImage
                              candidates={logoCandidates}
                              alt={a.source.name}
                              className="h-4 w-4 sm:h-5 sm:w-5 object-contain border border-white/30 bg-white/10 p-0.5"
                            />
                          )}
                          <span className="truncate max-w-[100px] uppercase tracking-wider font-black opacity-90">{a.source.name}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center gap-2 mb-3 sm:mb-4 border-b-2 border-neutral-900 dark:border-neutral-100 pb-2">
            <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100">Latest Finance News</span>
          </div>

          {/* Article Grid - NEWSPAPER STYLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {regularSlice.map((a) => {
              const hasImage = getImageCandidates(a).length > 0;
              const logoCandidates = getLogoCandidates(a);
              const imgCandidates = getImageCandidates(a);

              return (
                <button
                  key={stableKey(a)}
                  onClick={(e) => {
                    e.preventDefault();
                    setReaderArticle(a);
                  }}
                  className="group block w-full text-left overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] transition-all duration-200 hover:shadow-lg"
                >
                  {hasImage && (
                    <div className="relative h-40 sm:h-44">
                      <SmartImage
                        candidates={imgCandidates}
                        alt={a.title}
                        wrapperClassName="absolute inset-0"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0" />
                      <div className="absolute bottom-0 w-full p-3 sm:p-4 text-white">
                        <h3 className="line-clamp-2 text-sm sm:text-base font-black leading-snug uppercase tracking-tight">{a.title}</h3>
                        <div className="mt-2 flex items-center gap-2 text-[10px] sm:text-xs">
                          {logoCandidates.length > 0 && (
                            <SmartImage
                              candidates={logoCandidates}
                              alt={a.source.name}
                              className="h-4 w-4 sm:h-5 sm:w-5 object-contain border border-white/30 bg-white/10 p-0.5"
                            />
                          )}
                          <span className="truncate max-w-[100px] uppercase tracking-wider font-black opacity-90">{a.source.name}</span>
                          <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                          <time className="uppercase tracking-wider font-bold opacity-80">
                            {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </time>
                        </div>
                      </div>
                    </div>
                  )}

                  {!hasImage && (
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs mb-2">
                        {logoCandidates.length > 0 && (
                          <SmartImage
                            candidates={logoCandidates}
                            alt={a.source.name}
                            className="h-6 w-6 sm:h-8 sm:w-8 object-contain border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-0.5"
                          />
                        )}
                        <span className="truncate max-w-[120px] uppercase tracking-wider font-black text-neutral-700 dark:text-neutral-300">{a.source.name}</span>
                      </div>

                      <h3 className="font-black text-neutral-900 dark:text-neutral-100 text-sm sm:text-base leading-snug line-clamp-3 uppercase tracking-tight">
                        {a.title}
                      </h3>

                      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                        <time className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400">
                          {new Date(a.publishedAt).toLocaleDateString(undefined, { weekday: 'short', month: "short", day: "numeric" })}
                        </time>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
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

      <ReaderModal open={!!readerArticle} article={readerArticle} onClose={() => setReaderArticle(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination Component                                               */
/* ------------------------------------------------------------------ */
function Pagination({
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
}: PaginationProps) {
  return (
    <div className="mt-8 sm:mt-10 flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] px-4 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-900 disabled:opacity-40 transition-all"
        >
          ← Previous
        </button>
        <button
          disabled={(page === totalPages && !loading) || loading}
          onClick={onNext}
          className="border-2 border-neutral-900 dark:border-neutral-100 bg-green-600 dark:bg-green-400 px-4 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 dark:hover:bg-neutral-100 dark:hover:text-neutral-900 dark:hover:border-neutral-100 disabled:opacity-40 transition-all"
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
