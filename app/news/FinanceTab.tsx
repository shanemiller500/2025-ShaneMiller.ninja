"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";

import { fetchFinanceNews } from "./financeNews";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Article {
  source: { id: string | null; name: string; image?: string | null; imageCandidates?: string[] };
  title: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

interface SmartImageProps {
  candidates: string[];
  alt: string;
  className?: string;
  wrapperClassName?: string;
}

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

const uniqStrings = (arr: string[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const v = String(s || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const safeDomain = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const normalizeUrl = (s: string): string => {
  const t = s.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};

const bad = (s?: string | null): boolean =>
  !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());

function logoCandidatesForArticle(a: Article): string[] {
  const domain = safeDomain(a.url);
  const fromApi = (a.source.imageCandidates?.length ? a.source.imageCandidates : [a.source.image])
    .filter((s): s is string => !bad(s))
    .map(normalizeUrl);

  const generated = domain
    ? [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
         `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      ]
    : [];

  return uniqStrings([...fromApi, ...generated]);
}

/* ------------------------------------------------------------------ */
/*  SmartImage Component                                               */
/* ------------------------------------------------------------------ */
function SmartImage({
  candidates,
  alt,
  className,
  wrapperClassName,
}: SmartImageProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [candidates.join("|")]);

  const src = candidates[idx];
  if (!src) return null;

  return (
    <div className={wrapperClassName}>
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  );
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

  return (
    <div ref={contentRef}>
      {error && <p className="bg-red-100 text-red-700 p-3 mb-4 rounded font-medium">{error}</p>}

      <section className="w-full">
        {/* <StockWidget /> */}
        <div className={`transition-opacity duration-300 ${fade ? "opacity-0" : "opacity-100"} mt-2`}>
          {/* Masonry columns */}
          <div className="columns-2 sm:columns-2 md:columns-3 gap-2 space-y-2">
            {slice.map((a) => {
              const hasImage = !!a.urlToImage;
              const logoCandidates = logoCandidatesForArticle(a);

              return (
                <a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-inside-avoid block rounded-lg shadow hover:shadow-xl transition transform hover:scale-[1.02] bg-white dark:bg-brand-900"
                >
                  {hasImage && (
                    <img
                      src={a.urlToImage!}
                      alt={a.title}
                      className="w-full h-36 object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        // no fallback: just hide
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}

                  <div className={`p-4 flex flex-col gap-1 ${hasImage ? "mt-1" : ""}`}>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {/* logo: remote-only, try a few sources */}
                      {logoCandidates.length ? (
                        <SmartImage
                          candidates={logoCandidates}
                          alt={a.source.name}
                          className="w-10 h-10 object-contain"
                        />
                      ) : null}

                      <span className="truncate max-w-[140px]">{a.source.name}</span>
                    </div>

                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(a.publishedAt).toLocaleDateString()}
                    </span>

                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug line-clamp-3">
                      {a.title}
                    </h3>
                  </div>
                </a>
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
    <div className="flex flex-col items-center gap-4 mt-8 pb-8">
      <div className="flex gap-4">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="px-4 py-2 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={(page === totalPages && !loading) || loading}
          onClick={onNext}
          className="px-4 py-2 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Page {page} / {totalPages}
      </span>
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading…</p>}
    </div>
  );
}
