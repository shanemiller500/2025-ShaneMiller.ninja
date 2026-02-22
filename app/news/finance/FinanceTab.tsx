"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchFinanceNews } from "./financeNews";
import { SmartImage, SkeletonCard } from "../lib/SmartImage";
import { getDomain } from "../lib/utils";
import ReaderModal, { type ReadableArticle } from "../components/ReaderModal";
import {
  getLogoCandidates,
  getImageCandidates,
  stableKey,
  type FinanceArticle,
} from "./FinanceModals";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Article = FinanceArticle;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CACHE_TTL_MS = 30 * 60 * 1000;
const PER_PAGE = 36;
const SCROLL_DURATION_MS = 700;
const FADE_DURATION_MS = 350;

/* ------------------------------------------------------------------ */
/*  Module-level cache                                                 */
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
/*  FinanceTab                                                         */
/* ------------------------------------------------------------------ */
export default function FinanceTab() {
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fade, setFade] = useState(false);
  const [readerArticle, setReaderArticle] = useState<ReadableArticle | null>(null);
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

  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
  const startIdx = (page - 1) * PER_PAGE;
  const slice = articles.slice(startIdx, startIdx + PER_PAGE);

  const turnPage = useCallback(
    (n: number): void => {
      if (fade) return;
      smoothScrollToTop();
      setFade(true);
      setTimeout(() => {
        setPage(n);
        setFade(false);
      }, FADE_DURATION_MS);
    },
    [fade]
  );

  /* Hero articles (with images) shown on page 1 */
  const heroArticles = useMemo(
    () => articles.filter((a) => getImageCandidates(a).length > 0).slice(0, 4),
    [articles]
  );

  const heroKeys = useMemo(
    () => new Set(heroArticles.map(stableKey)),
    [heroArticles]
  );

  const regularSlice = useMemo(
    () => slice.filter((a) => !heroKeys.has(stableKey(a))),
    [slice, heroKeys]
  );

  const openReader = (a: Article) => setReaderArticle(toReadable(a));

  return (
    <div ref={contentRef} className="pb-10">
      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <section className="w-full">
        <div
          className={`transition-opacity duration-300 ${fade ? "opacity-0" : "opacity-100"}`}
        >
          {/* Featured section — page 1 only */}
          {heroArticles.length > 0 && page === 1 && (
            <div className="mb-6 sm:mb-7">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-emerald-500" />
                <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Featured Finance
                </h2>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {heroArticles.map((a, i) => {
                  const imgCandidates = getImageCandidates(a);
                  const logoCandidates = getLogoCandidates(a);

                  return (
                    <button
                      key={stableKey(a)}
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

                      {i === 0 && (
                        <div className="absolute top-2.5 left-2.5">
                          <span className="rounded-md bg-emerald-600/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">
                            Top Pick
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
            </div>
          )}

          {/* Section header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Latest Finance News
            </h2>
          </div>

          {/* Article grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {loading && articles.length === 0
              ? Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              : regularSlice.map((a) => {
                  const imgCandidates = getImageCandidates(a);
                  const logoCandidates = getLogoCandidates(a);
                  const hasImage = imgCandidates.length > 0;

                  return (
                    <button
                      key={stableKey(a)}
                      onClick={() => openReader(a)}
                      className="group block w-full text-left overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-900 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
                    >
                      {hasImage && (
                        <div className="relative h-40 sm:h-44">
                          <SmartImage
                            candidates={imgCandidates}
                            alt={a.title}
                            wrapperClassName="absolute inset-0"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                          <div className="absolute bottom-0 w-full p-3 text-white">
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
                              <span className="opacity-85 truncate max-w-[90px]">
                                {a.source.name}
                              </span>
                              <span className="opacity-40">·</span>
                              <time>
                                {new Date(a.publishedAt).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" }
                                )}
                              </time>
                            </div>
                          </div>
                        </div>
                      )}

                      {!hasImage && (
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {logoCandidates.length > 0 && (
                              <div className="h-5 w-5 rounded overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex-shrink-0">
                                <SmartImage
                                  candidates={logoCandidates}
                                  alt={a.source.name}
                                  className="h-full w-full object-contain"
                                />
                              </div>
                            )}
                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">
                              {a.source.name}
                            </span>
                          </div>

                          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-50 leading-snug line-clamp-3 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {a.title}
                          </h3>

                          <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
                            <time className="text-[10px] text-gray-400 dark:text-gray-500">
                              {new Date(a.publishedAt).toLocaleDateString(
                                undefined,
                                { weekday: "short", month: "short", day: "numeric" }
                              )}
                            </time>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
          </div>

          {/* Pagination */}
          <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1 || loading}
                onClick={() => turnPage(page - 1)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                disabled={(page === totalPages && !loading) || loading}
                onClick={() => turnPage(page + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:hover:bg-emerald-400 disabled:opacity-40 transition-all"
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
        </div>
      </section>

      <ReaderModal
        open={!!readerArticle}
        article={readerArticle}
        onClose={() => setReaderArticle(null)}
        accent="emerald"
      />
    </div>
  );
}
