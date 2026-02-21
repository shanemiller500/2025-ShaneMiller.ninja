"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import ReaderModal, { type ReadableArticle } from "./components/ReaderModal";
import { SmartImage } from "./lib/SmartImage";
import { getDomain, timeAgo, uniqStrings, badUrl } from "./lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface NewsItem {
  articleId?: string;
  headline: string;
  source: string;
  publishedAt: string;
  link: string;
  sourceImageCandidates?: string[];
  sourceImage?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const LOGO_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

const clamp160 = (s: string) => (s?.length > 160 ? s.slice(0, 157) + "…" : s);

function getLogoCandidates(link: string, apiCandidates?: string[] | null): string[] {
  const d = getDomain(link);
  const api = (apiCandidates || []).filter(Boolean) as string[];
  const fallback = d
    ? [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`,
        `https://logo.clearbit.com/${encodeURIComponent(d)}?size=128`,
      ]
    : [];
  return uniqStrings([...api, ...fallback]);
}

function toReadable(item: NewsItem): ReadableArticle {
  return {
    title: item.headline,
    url: item.link,
    publishedAt: item.publishedAt,
    sourceName: item.source || getDomain(item.link),
    description: undefined,
    imageCandidates: [],
    logoCandidates: getLogoCandidates(
      item.link,
      item.sourceImageCandidates ?? (item.sourceImage ? [item.sourceImage] : null)
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  Skeleton row                                                       */
/* ------------------------------------------------------------------ */
function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-11/12 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-9/12 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2.5 w-5/12 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WidgetNews                                                         */
/* ------------------------------------------------------------------ */
const WidgetNews: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [errorMsg, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readerArticle, setReaderArticle] = useState<ReadableArticle | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchNews = async (showSpinner = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    if (showSpinner) setRefreshing(true);
    setError("");

    try {
      const { data } = await axios.get<{ results: NewsItem[] }>(
        "https://u-mail.co/api/NewsAPI/breaking-news",
        { signal: abortRef.current.signal as AbortSignal }
      );

      const items = (data?.results || [])
        .filter((x) => x?.headline && x?.link)
        .map((item, i) => ({
          ...item,
          articleId: item.articleId || `${i}-${item.headline}`,
        }));

      setNews(items);
    } catch (err: unknown) {
      if (axios.isCancel?.(err) || (err as { name?: string })?.name === "CanceledError") return;
      setError("Failed to load breaking news.");
    } finally {
      setLoading(false);
      if (showSpinner) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews(false);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Tick so time-ago labels stay fresh */
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const topStory = news[0] ?? null;
  const rest = useMemo(() => news.slice(1, 11), [news]);

  return (
    <div className="space-y-3">
      {/* Breaking badge */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 border border-rose-100 dark:border-rose-900/40">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
            Breaking
          </span>
        </div>

        {!loading && (
          <button
            onClick={() => fetchNews(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Content */}
      {errorMsg ? (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 p-3 text-sm text-red-700 dark:text-red-400">
          {errorMsg}
          <button
            onClick={() => fetchNews(true)}
            className="mt-2 block text-xs font-semibold text-red-600 dark:text-red-400 underline"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : news.length ? (
        <>
          {/* Top story */}
          {topStory && (
            <motion.button
              onClick={() => setReaderArticle(toReadable(topStory))}
              className="group block w-full text-left rounded-xl border border-gray-100 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-900 p-3.5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.005 }}
            >
              <div className="flex items-start gap-3">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white dark:bg-gray-700 ring-1 ring-gray-100 dark:ring-gray-700 border border-gray-100 dark:border-gray-700">
                  <SmartImage
                    candidates={getLogoCandidates(
                      topStory.link,
                      topStory.sourceImageCandidates ??
                        (topStory.sourceImage ? [topStory.sourceImage] : null)
                    )}
                    alt={topStory.source}
                    className="h-full w-full object-contain p-1.5"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {topStory.source}
                    </span>
                    <span className="mx-1.5 opacity-40">·</span>
                    {timeAgo(topStory.publishedAt)}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    {topStory.headline}
                  </p>
                </div>
              </div>
            </motion.button>
          )}

          {/* Rest of items */}
          <ul className="space-y-1.5">
            {rest.map((item, idx) => (
              <motion.li
                key={item.articleId!}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <button
                  onClick={() => setReaderArticle(toReadable(item))}
                  className="group flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
                >
                  <div className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white dark:bg-gray-700 ring-1 ring-gray-100 dark:ring-gray-700 border border-gray-100 dark:border-gray-700">
                    <SmartImage
                      candidates={getLogoCandidates(
                        item.link,
                        item.sourceImageCandidates ??
                          (item.sourceImage ? [item.sourceImage] : null)
                      )}
                      alt={item.source}
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {clamp160(item.headline)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                      {item.source} · {timeAgo(item.publishedAt)}
                    </p>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>

          {/* Footer link */}
          <div className="pt-1 text-center">
            <a
              href="/news"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Open full news feed →
            </a>
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No headlines right now.
          </p>
          <button
            onClick={() => fetchNews(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      <ReaderModal
        open={!!readerArticle}
        article={readerArticle}
        onClose={() => setReaderArticle(null)}
        accent="rose"
      />
    </div>
  );
};

export default WidgetNews;
