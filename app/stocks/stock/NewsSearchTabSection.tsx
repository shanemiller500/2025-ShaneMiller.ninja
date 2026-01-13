// Filename: NewsSearchTabSection.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "@/utils/formatters";
import { API_TOKEN } from "@/utils/config";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */
interface Article {
  source: string;
  headline: string;
  url: string;
  image: string | null;
  summary: string;
  datetime: number; // unix
  category: string;
  related: string;
}

const LOGO_FALLBACK = "/images/wedding.jpg";
const CARD_FALLBACK = "/images/wedding.jpg";
const CACHE_TTL = 30 * 60 * 1_000; // 30 min
const PER_PAGE = 24;

const cache: Record<string, { ts: number; data: Article[] }> = {};

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

function useDebouncedValue<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ------------------------------------------------------------------ */
/*  Finnhub fetchers                                                  */
/* ------------------------------------------------------------------ */
async function fetchGeneral(): Promise<Article[]> {
  const key = "general";
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) return cache[key].data;

  const res = await fetch(
    `https://finnhub.io/api/v1/news?category=general&token=${API_TOKEN}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch general news");
  const data = (await res.json()) as Article[];
  cache[key] = { ts: Date.now(), data };
  return data;
}

async function fetchCompany(symbol: string): Promise<Article[]> {
  const key = symbol.toUpperCase();
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) return cache[key].data;

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const res = await fetch(
    `https://finnhub.io/api/v1/company-news?symbol=${key}&from=${from}&to=${to}&token=${API_TOKEN}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch company news");
  const data = (await res.json()) as Article[];
  cache[key] = { ts: Date.now(), data };
  return data;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function NewsSearchTabSection() {
  const [symbol, setSymbol] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<"general" | "company">("general");
  const [error, setError] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  /* ---------------------- initial load ---------------------------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSourceLabel("general");
        setArticles(await fetchGeneral());
      } catch (e: any) {
        setError(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------------- handlers ------------------------------- */
  const runCompanySearch = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;

    setLoading(true);
    setError(null);
    setPage(1);

    try {
      setSourceLabel("company");
      setArticles(await fetchCompany(sym));
      if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth" });
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  const runGeneral = async () => {
    setLoading(true);
    setError(null);
    setPage(1);

    try {
      setSourceLabel("general");
      setArticles(await fetchGeneral());
      if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth" });
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setPage(1);
  };

  /* ---------------------- filter + paging ------------------------- */
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return articles;

    return articles.filter((a) => {
      const h = (a.headline || "").toLowerCase();
      const s = (a.summary || "").toLowerCase();
      const src = (a.source || "").toLowerCase();
      return h.includes(q) || s.includes(q) || src.includes(q);
    });
  }, [articles, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = clamp(page, 1, totalPages);

  const startIdx = (safePage - 1) * PER_PAGE;
  const slice = filtered.slice(startIdx, startIdx + PER_PAGE);

  useEffect(() => {
    // keep page valid if filtered shrinks
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const goPage = (n: number) => {
    const next = clamp(n, 1, totalPages);
    if (next === page) return;
    setPage(next);
    if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth" });
  };

  /* ----------------------------- UI -------------------------------- */
  return (
    <section
      ref={topRef}
      className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm"
    >
      {/* soft blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
        <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      {/* Header + controls (sticky) */}
      <div className="relative">
        <div className="sticky top-0 z-20 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/30 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Finance News
                </h2>
                
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runGeneral}
                  className="rounded-2xl px-4 py-2 text-sm font-extrabold text-gray-900 dark:text-white ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition"
                >
                  General
                </button>

                <button
                  type="button"
                  onClick={runCompanySearch}
                  className="rounded-2xl px-4 py-2 text-sm font-extrabold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/10 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 active:scale-[0.99] transition"
                >
                  Company
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
              {/* symbol */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-gray-600 dark:text-white/60 mb-1">
                  Symbol
                </label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runCompanySearch();
                  }}
                  placeholder="AAPL, TSLA, NVDA…"
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/40 outline-none focus:border-black/20 dark:focus:border-white/20"
                />
              </div>

              {/* keyword */}
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-gray-600 dark:text-white/60 mb-1">
                  Keyword filter
                </label>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter headlines, summary, source…"
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/40 outline-none focus:border-black/20 dark:focus:border-white/20"
                />
              </div>

              {/* actions */}
              <div className="sm:col-span-2 flex sm:flex-col gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-gray-900 dark:text-white ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* status row */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-gray-600 dark:text-white/60">
                Showing <span className="font-extrabold">{filtered.length}</span> results
                {debouncedQuery.trim() ? (
                  <>
                    {" "}
                    • Filter:{" "}
                    <span className="font-extrabold text-gray-800 dark:text-white/80">
                      “{debouncedQuery.trim()}”
                    </span>
                  </>
                ) : null}
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

        {/* Content */}
        <div className="relative mx-auto max-w-7xl px-4 py-5">
          {loading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6 text-center">
              <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                No matches
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/70">
                Try a different keyword or switch back to General.
              </div>
            </div>
          ) : (
            <>
              {/* grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {slice.map((a) => (
                  <ArticleCard key={a.url} a={a} />
                ))}
              </div>

              {/* pagination */}
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPrev={() => goPage(safePage - 1)}
                onNext={() => goPage(safePage + 1)}
                onGo={goPage}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                              */
/* ------------------------------------------------------------------ */
function ArticleCard({ a }: { a: Article }) {
  const domain = getDomain(a.url);
  const dt = a.datetime ? formatDate(a.datetime * 1000) : "";

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm hover:shadow-md transition"
    >
      {/* image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/[0.03] dark:bg-white/[0.04]">
        <img
          src={a.image || CARD_FALLBACK}
          alt={a.headline}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={(e) => {
            e.currentTarget.src = CARD_FALLBACK;
          }}
        />

        {/* gradient fade for text legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-70" />
      </div>

      <div className="p-4">
        {/* publisher */}
        <div className="flex items-center gap-2">
          <img
            src={domain ? `https://logo.clearbit.com/${domain}` : LOGO_FALLBACK}
            onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
            alt={a.source}
            className="h-8 w-8 rounded-full bg-white object-contain ring-1 ring-black/10"
            loading="lazy"
            decoding="async"
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

        {/* headline */}
        <h3 className="mt-3 text-sm font-extrabold leading-snug text-gray-900 dark:text-white line-clamp-3">
          {a.headline}
        </h3>

        {/* summary */}
        {a.summary ? (
          <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70 line-clamp-3">
            {a.summary}
          </p>
        ) : null}

        {/* footer chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {a.category ? (
            <span className="rounded-full px-3 py-1 text-[11px] font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-gray-800 dark:text-white/75">
              {a.category}
            </span>
          ) : null}

          {a.related ? (
            <span className="rounded-full px-3 py-1 text-[11px] font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-gray-800 dark:text-white/75">
              {a.related}
            </span>
          ) : null}
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                <div className="h-3 w-32 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
            </div>

            <div className="mt-3 h-4 w-full animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="mt-4 h-3 w-full animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
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
  onPrev,
  onNext,
  onGo,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onGo: (n: number) => void;
}) {
  const buttons = useMemo(() => {
    // show: 1 ... (page-1 page page+1) ... total
    const out: (number | "...")[] = [];
    const push = (v: number | "...") => out.push(v);

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
      return out;
    }

    push(1);
    if (page > 3) push("...");

    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      push(i);
    }

    if (page < totalPages - 2) push("...");
    push(totalPages);

    return out;
  }, [page, totalPages]);

  return (
    <div className="mt-8 flex flex-col items-center gap-3 pb-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="rounded-2xl px-4 py-2 text-sm font-extrabold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/10 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
        >
          Prev
        </button>

        {buttons.map((b, idx) =>
          b === "..." ? (
            <span key={`dots-${idx}`} className="px-2 text-sm font-extrabold text-gray-600 dark:text-white/60">
              …
            </span>
          ) : (
            <button
              key={b}
              type="button"
              onClick={() => onGo(b)}
              className={`rounded-2xl px-3 py-2 text-sm font-extrabold ring-1 ring-black/10 dark:ring-white/10 transition ${
                b === page
                  ? "bg-black/10 dark:bg-white/15 text-gray-900 dark:text-white"
                  : "bg-black/[0.03] dark:bg-white/[0.06] text-gray-900 dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
              }`}
              aria-current={b === page ? "page" : undefined}
            >
              {b}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="rounded-2xl px-4 py-2 text-sm font-extrabold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/10 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <div className="text-xs font-semibold text-gray-600 dark:text-white/60">
        Page <span className="font-extrabold">{page}</span> of{" "}
        <span className="font-extrabold">{totalPages}</span>
      </div>
    </div>
  );
}
