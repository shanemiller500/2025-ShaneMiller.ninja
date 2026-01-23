"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion, type Variants } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */

interface NewsItem {
  articleId?: string;
  headline: string;
  source: string;
  publishedAt: string;
  link: string;

  // backend can send:
  sourceImageCandidates?: string[]; // preferred
  sourceImage?: string; // legacy
}

const LOGO_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

const clamp2 = (s: string) => (s?.length > 160 ? s.slice(0, 157) + "…" : s);

const timeAgo = (iso: string) => {
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

function safeHost(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// these are *remote* favicon/logo candidates (fast + reliable)
// (matches what we did on the backend)
function getSourceImageCandidatesFromLink(link: string) {
  const d = safeHost(link);
  if (!d) return [];
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`,
    `https://logo.clearbit.com/${encodeURIComponent(d)}?size=128`,
  ];
}

/* ------------------------------------------------------------------ */
/*  Animations                                                        */
/* ------------------------------------------------------------------ */

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" },
  }),
};

const shimmer: Variants = {
  hidden: { opacity: 0.6 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, repeat: Infinity, repeatType: "mirror" },
  },
};

function SkeletonRow() {
  return (
    <motion.div
      variants={shimmer}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-white/10 bg-white/5 p-3"
    >
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div className="flex-1">
          <div className="h-3 w-11/12 rounded bg-white/10" />
          <div className="mt-2 h-3 w-9/12 rounded bg-white/10" />
          <div className="mt-3 h-2 w-5/12 rounded bg-white/10" />
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Logo image component (tries multiple candidates, no broken icons)  */
/* ------------------------------------------------------------------ */

function LogoImg({
  link,
  alt,
  className,
  candidatesFromApi,
}: {
  link: string;
  alt: string;
  className: string;
  candidatesFromApi?: string[] | null;
}) {
  const fallbackCandidates = useMemo(() => getSourceImageCandidatesFromLink(link), [link]);
  const candidates = useMemo(() => {
    const api = (candidatesFromApi || []).filter(Boolean);
    const all = [...api, ...fallbackCandidates];
    // uniq
    const out: string[] = [];
    const seen = new Set<string>();
    for (const s of all) {
      const v = String(s || "").trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }, [candidatesFromApi, fallbackCandidates]);

  const [idx, setIdx] = useState(0);
  const src = candidates[idx] || LOGO_FALLBACK;

  useEffect(() => {
    // if the story changed, restart attempts
    setIdx(0);
  }, [link, candidatesFromApi]);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx < candidates.length - 1) setIdx((n) => n + 1);
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const WidgetNews: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [errorMsg, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchNews = async (showSpinner = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (showSpinner) setRefreshing(true);
    setError("");

    try {
      const { data } = await axios.get<{ results: NewsItem[] }>(
        "https://u-mail.co/api/NewsAPI/breaking-news",
        { signal: abortRef.current.signal as any },
      );

      const items = (data?.results || [])
        .filter((x) => x?.headline && x?.link)
        .map((item, i) => ({
          ...item,
          articleId: item.articleId || `${i}-${item.headline}`,
        }));

      setNews(items);
    } catch (err: any) {
      if (axios.isCancel?.(err) || err?.name === "CanceledError") return;
      console.error("Error fetching breaking news:", err);
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

  // keep "time ago" labels fresh without re-fetching
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const topStory = news[0] ?? null;
  const rest = useMemo(() => news.slice(1, 5), [news]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-brand-900 shadow-sm">
      {/* top glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />

      {/* header */}
      <div className="relative px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="w-full">
            <span
              className="
                flex w-full items-center justify-center gap-2
                rounded-2xl bg-yellow-300/90
                px-4 py-2
                text-xs font-extrabold text-brand-900
                shadow-sm ring-1 ring-black/10
              "
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              Breaking News
            </span>
          </div>
        </div>
      </div>

      {/* content */}
      <div className="px-5 pb-4">
        {errorMsg ? (
          <div className="rounded-2xl border border-red-200/60 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
            {errorMsg}
            <div className="mt-3">
              <button
                onClick={() => fetchNews(true)}
                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
              >
                Try again
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : news.length ? (
          <>
            {/* top story */}
            {topStory && (
              <motion.a
                href={topStory.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-gray-200/70 dark:border-white/10 bg-gradient-to-br from-gray-50 to-white dark:from-white/5 dark:to-white/0 p-4 hover:shadow-md transition"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/70 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10">
                    <LogoImg
                      link={topStory.link}
                      alt={topStory.source}
                      candidatesFromApi={
                        topStory.sourceImageCandidates ??
                        (topStory.sourceImage ? [topStory.sourceImage] : null)
                      }
                      className="h-full w-full object-contain p-1.5"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {topStory.source}
                        <span className="mx-2 opacity-50">•</span>
                        <span className="font-medium opacity-80">
                          {timeAgo(topStory.publishedAt)}
                        </span>
                      </div>
                    
                    </div>

                    <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white leading-snug">
                      {topStory.headline}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(topStory.publishedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </motion.a>
            )}

            {/* list */}
            <ul className="mt-3 space-y-2">
              {rest.map((item, idx) => (
                <motion.li
                  key={item.articleId!}
                  custom={idx}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition"
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 px-3 py-3"
                  >
                    <div className="relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/70 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10">
                      <LogoImg
                        link={item.link}
                        alt={item.source}
                        candidatesFromApi={
                          item.sourceImageCandidates ??
                          (item.sourceImage ? [item.sourceImage] : null)
                        }
                        className="h-full w-full object-contain p-1.5"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                        {clamp2(item.headline)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {item.source}
                        <span className="mx-2 opacity-50">•</span>
                        {timeAgo(item.publishedAt)}
                      </div>
                    </div>
                  </a>
                </motion.li>
              ))}
            </ul>

            {/* footer */}
            <div className="pt-4">
              <div className="flex items-center justify-center gap-2">

                <a
                  href="/news"
                  className="text-xs text-indigo-600 dark:text-indigo-300 underline"
                >
                  Open news
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 text-center text-sm text-gray-600 dark:text-gray-300">
            No headlines right now.
            <div className="mt-3">
              <button
                onClick={() => fetchNews(true)}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetNews;
