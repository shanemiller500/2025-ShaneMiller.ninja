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

const PER_PAGE = 6;

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
      className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm"
    >
      {/* soft blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
        <div className="absolute -top-16 -left-20 h-52 w-52 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      {/* header */}
      <div className="relative border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/30 backdrop-blur-xl">
        <div className="px-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Latest Finance News
              </h2>

            </div>

            <div className="text-xs font-semibold text-gray-600 dark:text-white/60">
              Page <span className="font-extrabold">{safePage}</span> /{" "}
              <span className="font-extrabold">{totalPages}</span>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* body */}
      <div className="relative px-4 py-5">
        {loading ? (
          <SkeletonGrid />
        ) : !error && articles.length === 0 ? (
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6 text-center">
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              No news found
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/70">
              Try again in a bit.
            </div>
          </div>
        ) : (
          <div className={`transition-opacity duration-300 ${fade ? "opacity-0" : "opacity-100"}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {slice.map((a) => (
                <NewsCard key={a.url} a={a} />
              ))}
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              loading={loading}
              onPrev={() => turnPage(safePage - 1)}
              onNext={() => turnPage(safePage + 1)}
            />
          </div>
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
      className="group overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm hover:shadow-md transition"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/[0.03] dark:bg-white/[0.04]">
        {a.image && imgOk ? (
          <>
            <img
              src={a.image}
              alt={a.headline}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              onError={() => setImgOk(false)}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent opacity-80" />
          </>
        ) : (
          // No local stored photo fallback — just a clean placeholder
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/25 via-fuchsia-500/15 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-black/35 px-3 py-2 text-xs font-extrabold text-white">
                <span className="h-2 w-2 rounded-full bg-white/80" />
                No image provided
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <img
            src={domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : ""}
            alt={a.source || domain || "Source"}
            className="h-8 w-8 rounded-full bg-white object-contain ring-1 ring-black/10"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // no local fallback logo either; just hide it
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />

          <div className="min-w-0">
            <div className="truncate text-xs font-extrabold text-gray-800 dark:text-white/85">
              {a.source || domain || "Source"}
            </div>
            <div className="text-[11px] font-semibold text-gray-600 dark:text-white/60">
              {dt}
            </div>
          </div>
        </div>

        <h3 className="mt-3 text-sm font-extrabold leading-snug text-gray-900 dark:text-white line-clamp-3">
          {a.headline}
        </h3>

        {a.summary ? (
          <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70 line-clamp-2">
            {a.summary}
          </p>
        ) : null}

        <div className="mt-3 text-[11px] font-semibold text-gray-600 dark:text-white/60">
          Tap to open →
        </div>
      </div>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                         */
/* ------------------------------------------------------------------ */
function SkeletonGrid() {
  const items = Array.from({ length: PER_PAGE });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]"
        >
          <div className="aspect-[16/9] w-full animate-pulse bg-black/[0.06] dark:bg-white/[0.08]" />
          <div className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full animate-pulse bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="flex-1">
                <div className="h-3 w-28 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
            </div>
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
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
    <div className="flex flex-col items-center gap-3 mt-8 pb-4">
      <div className="flex gap-3">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="px-4 py-2 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
          type="button"
        >
          Previous
        </button>
        <button
          disabled={page === totalPages || loading}
          onClick={onNext}
          className="px-4 py-2 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
          type="button"
        >
          Next
        </button>
      </div>

      <span className="text-xs font-semibold text-gray-600 dark:text-white/60">
        Page <span className="font-extrabold">{page}</span> /{" "}
        <span className="font-extrabold">{totalPages}</span>
      </span>
    </div>
  );
}
