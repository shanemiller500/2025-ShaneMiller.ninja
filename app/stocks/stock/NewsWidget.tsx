// Filename: NewsWidget.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "@/utils/formatters";
import { API_TOKEN } from "@/utils/config";

/* ------------------------------------------------------------------ */
/*  Types & cache                                                     */
/* ------------------------------------------------------------------ */
interface Article {
  source: string;
  headline: string;
  url: string;
  image: string | null;
  summary: string;
  datetime: number; // unix seconds
  category: string;
  related: string;
}

const CACHE_TTL = 30 * 60 * 1_000; // 30 min
let cached: { ts: number; data: Article[] } | null = null;

const PER_PAGE = 8;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const getDomain = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchGeneralFinnhub(): Promise<Article[]> {
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const res = await fetch(
    `https://finnhub.io/api/v1/news?category=general&token=${API_TOKEN}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch Finnhub news");
  const data = (await res.json()) as Article[];

  cached = { ts: Date.now(), data: Array.isArray(data) ? data : [] };
  return cached.data;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function NewsWidget() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fade, setFade] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  /* ---------------------- fetch + cache --------------------------- */
  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchGeneralFinnhub();
        if (cancel) return;

        setArticles(data);
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? "Unable to load news");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  /* ----------------------- paging helpers ------------------------- */
  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
  const safePage = clamp(page, 1, totalPages);

  const startIdx = (safePage - 1) * PER_PAGE;
  const slice = articles.slice(startIdx, startIdx + PER_PAGE);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const turnPage = (n: number) => {
    if (fade) return;
    const next = clamp(n, 1, totalPages);
    if (next === page) return;

    topRef.current?.scrollIntoView({ behavior: "smooth" });
    setFade(true);

    window.setTimeout(() => {
      setPage(next);
      setFade(false);
    }, 250);
  };

  return (
    <section
      ref={topRef}
      className="relative h-full overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm flex flex-col"
    >
      {/* soft blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
        <div className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      {/* header */}
      <div className="relative border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/30 backdrop-blur-xl">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Latest Finance News
            </h2>
            <div className="text-[10px] font-semibold text-gray-600 dark:text-white/60">
              {safePage} / {totalPages}
            </div>
          </div>

          {error && (
            <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* body */}
      <div className="relative flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <SkeletonList />
        ) : !error && articles.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <div className="text-base font-extrabold text-gray-900 dark:text-white">
                No news found
              </div>
              <div className="mt-1 text-xs font-semibold text-gray-700 dark:text-white/70">
                Try again in a bit.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`flex-1 overflow-y-auto px-3 py-2 transition-opacity duration-300 ${
                fade ? "opacity-0" : "opacity-100"
              }`}
              style={{ scrollbarWidth: "thin" }}
            >
              <div className="space-y-2">
                {slice.map((a) => (
                  <NewsCard key={a.url} a={a} />
                ))}
              </div>
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              loading={loading}
              onPrev={() => turnPage(safePage - 1)}
              onNext={() => turnPage(safePage + 1)}
            />
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                              */
/* ------------------------------------------------------------------ */
function NewsCard({ a }: { a: Article }) {
  const domain = getDomain(a.url);
  const dt = a.datetime ? formatDate(a.datetime * 1000) : "";
  const [imgOk, setImgOk] = useState<boolean>(!!a.image);

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm hover:shadow-md hover:border-black/15 dark:hover:border-white/15 transition-all duration-200"
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
          {a.image && imgOk ? (
            <>
              <img
                src={a.image}
                alt={a.headline}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={() => setImgOk(false)}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-fuchsia-500/15 to-transparent" />
              <div className="relative h-4 w-4 rounded-full bg-white/40 dark:bg-white/20" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          {/* Header */}
          <div>
            <h3 className="text-sm font-extrabold leading-tight text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {a.headline}
            </h3>
            {a.summary && (
              <p className="mt-1 text-xs font-medium text-gray-700 dark:text-white/60 line-clamp-1">
                {a.summary}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2">
            <img
              src={domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : ""}
              alt={a.source || domain || ""}
              className="h-4 w-4 rounded bg-white object-contain ring-1 ring-black/10"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="min-w-0 flex-1 flex items-center gap-1.5 text-[10px] font-semibold text-gray-600 dark:text-white/50">
              <span className="truncate">{a.source || domain || "Source"}</span>
              <span className="shrink-0">•</span>
              <span className="shrink-0">{dt}</span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                         */
/* ------------------------------------------------------------------ */
function SkeletonList() {
  const items = Array.from({ length: PER_PAGE });
  return (
    <div className="px-3 py-2 space-y-2">
      {items.map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]"
        >
          <div className="flex gap-3 p-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl animate-pulse bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="h-4 w-full animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
                <div className="mt-1.5 h-4 w-5/6 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded animate-pulse bg-black/[0.06] dark:bg-white/[0.08]" />
                <div className="h-3 w-24 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
            </div>
          </div>
        </div>
      ))}
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
    <div className="relative border-t border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/30 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white hover:opacity-95 disabled:opacity-40 hover:shadow-md active:scale-95 transition-all"
          type="button"
        >
          ← Prev
        </button>

        <span className="text-[10px] font-semibold text-gray-600 dark:text-white/60">
          Page <span className="font-extrabold">{page}</span> of{" "}
          <span className="font-extrabold">{totalPages}</span>
        </span>

        <button
          disabled={page === totalPages || loading}
          onClick={onNext}
          className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white hover:opacity-95 disabled:opacity-40 hover:shadow-md active:scale-95 transition-all"
          type="button"
        >
          Next →
        </button>
      </div>
    </div>
  );
}