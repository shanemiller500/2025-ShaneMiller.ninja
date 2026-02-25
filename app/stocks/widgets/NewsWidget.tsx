// Filename: NewsWidget.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { formatDate } from "@/utils/formatters";
import { API_TOKEN } from "@/utils/config";
import { Button } from "@/components/ui/button";

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

const PER_PAGE = 9; // 3×3 grid

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

  /* ----------------------- paging --------------------------------- */
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

    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFade(true);
    window.setTimeout(() => {
      setPage(next);
      setFade(false);
    }, 220);
  };

  /* ---------------------------------------------------------------- */
  return (
    <section
      ref={topRef}
      className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm"
    >
      {/* soft blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
        <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      {/* header */}
      <div className="relative border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/30 backdrop-blur-xl">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Latest Finance News
          </h2>
          {!loading && !error && articles.length > 0 && (
            <span className="text-[10px] font-semibold text-gray-600 dark:text-white/60">
              Page <span className="font-extrabold">{safePage}</span> of{" "}
              <span className="font-extrabold">{totalPages}</span>
            </span>
          )}
        </div>
        {error && (
          <div className="mx-4 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* body */}
      <div className="relative px-4 py-4">
        {loading ? (
          <SkeletonGrid />
        ) : !error && articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="text-base font-extrabold text-gray-900 dark:text-white">No news found</div>
            <div className="text-xs font-semibold text-gray-600 dark:text-white/60">Try again in a bit.</div>
          </div>
        ) : (
          <div className={`transition-opacity duration-220 ${fade ? "opacity-0" : "opacity-100"}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              onGo={turnPage}
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
      className="group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm hover:shadow-md transition"
    >
      {/* image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden">
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
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-fuchsia-500/10 to-sky-500/10 flex items-center justify-center">
            <span className="text-xs font-black text-gray-400 dark:text-white/30 tracking-widest uppercase">
              News
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        {/* publisher */}
        <div className="flex items-center gap-2">
          <img
            src={domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : ""}
            alt={a.source || domain || ""}
            className="h-7 w-7 rounded-full bg-white object-contain ring-1 ring-black/10 shrink-0"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="min-w-0">
            <div className="truncate text-xs font-extrabold text-gray-800 dark:text-white/85">
              {a.source || domain || "Source"}
            </div>
            <div className="text-[11px] font-semibold text-gray-600 dark:text-white/60">{dt}</div>
          </div>
        </div>

        {/* headline */}
        <h3 className="mt-2 text-sm font-extrabold leading-snug text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {a.headline}
        </h3>

        {/* summary */}
        {a.summary ? (
          <p className="mt-1.5 text-xs font-semibold text-gray-700 dark:text-white/65 line-clamp-2">
            {a.summary}
          </p>
        ) : null}
      </div>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                          */
/* ------------------------------------------------------------------ */
function SkeletonGrid() {
  const items = Array.from({ length: PER_PAGE });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]"
        >
          <div className="aspect-[16/9] w-full animate-pulse bg-black/[0.06] dark:bg-white/[0.08]" />
          <div className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full animate-pulse bg-black/[0.06] dark:bg-white/[0.08] shrink-0" />
              <div className="flex-1">
                <div className="h-3 w-28 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
                <div className="mt-1.5 h-2.5 w-16 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
            </div>
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="mt-1.5 h-4 w-4/5 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
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
  onGo,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGo: (n: number) => void;
}) {
  const buttons = useMemo(() => {
    const out: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) out.push(i);
      return out;
    }
    out.push(1);
    if (page > 3) out.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) out.push(i);
    if (page < totalPages - 2) out.push("...");
    out.push(totalPages);
    return out;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-3 pb-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="indigo"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={onPrev}
          className="disabled:opacity-40"
        >
          ← Prev
        </Button>

        {buttons.map((b, idx) =>
          b === "..." ? (
            <span key={`dots-${idx}`} className="px-1 text-sm font-extrabold text-gray-500 dark:text-white/50">
              …
            </span>
          ) : (
            <button
              key={b}
              type="button"
              onClick={() => onGo(b)}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold ring-1 ring-black/10 dark:ring-white/10 transition ${
                b === page
                  ? "bg-indigo-600/15 text-indigo-900 dark:text-indigo-100 ring-indigo-500/25"
                  : "bg-black/[0.03] dark:bg-white/[0.06] text-gray-800 dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
              }`}
              aria-current={b === page ? "page" : undefined}
            >
              {b}
            </button>
          )
        )}

        <Button
          variant="indigo"
          size="sm"
          disabled={page >= totalPages || loading}
          onClick={onNext}
          className="disabled:opacity-40"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
