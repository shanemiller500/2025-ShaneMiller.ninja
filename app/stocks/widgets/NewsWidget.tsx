// Filename: NewsWidget.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

const PER_PAGE = 7;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Finnhub `datetime` is unix seconds. */
const timeAgo = (unixSeconds: number) => {
  if (!unixSeconds) return "";
  const d = Date.now() - unixSeconds * 1000;
  if (d < 3_600_000) return `${Math.max(1, Math.floor(d / 60_000))}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
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
      className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]"
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">Market headlines</h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Finnhub · general</p>
        </div>
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-slate-400">
            <button type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => turnPage(safePage - 1)} className="rounded-lg p-1.5 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {safePage}/{totalPages}
            <button type="button" aria-label="Next page" disabled={safePage >= totalPages} onClick={() => turnPage(safePage + 1)} className="rounded-lg p-1.5 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <div className="px-2 pb-2">
        {error ? (
          <div role="alert" className="m-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">{error}</div>
        ) : loading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <div key={i} className="flex gap-3 py-2">
                <div className="h-14 w-20 shrink-0 animate-pulse rounded-lg bg-slate-100 dark:bg-white/[0.06]" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No headlines right now. Try again in a bit.</div>
        ) : (
          <ul className={`divide-y divide-slate-100 transition-opacity duration-200 dark:divide-white/[0.05] ${fade ? "opacity-0" : "opacity-100"}`}>
            {slice.map((a) => (
              <NewsRow key={a.url} a={a} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Row                                                               */
/* ------------------------------------------------------------------ */
function NewsRow({ a }: { a: Article }) {
  const domain = getDomain(a.url);
  const [imgOk, setImgOk] = useState<boolean>(!!a.image);

  return (
    <li>
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="group flex gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 dark:hover:bg-white/[0.03]">
        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/[0.04]">
          {a.image && imgOk && (
            <img
              src={a.image}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgOk(false)}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" className="h-3 w-3 rounded-sm" referrerPolicy="no-referrer" />}
            <span className="truncate">{a.source || domain}</span>
            <span className="shrink-0">· {timeAgo(a.datetime)}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
            {a.headline}
          </h3>
        </div>
      </a>
    </li>
  );
}
