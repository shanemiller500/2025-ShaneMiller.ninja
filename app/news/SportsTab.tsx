/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchSportsNews } from "./sportsNews";
import LiveScores from "./LiveScores";

interface Article {
  source: { id: string | null; name: string; image?: string | null };
  title: string;
  url: string;
  urlToImage: string | null;
  images?: string[];
  publishedAt: string;
}

interface LiveGame {
  id: string;
  league: string;
  leagueDisplay?: string;
  status?: string;
  isLive?: boolean;
}

const CACHE_TTL = 30 * 60 * 1000;
const PER_PAGE = 36;

const CATEGORIES = [
  { key: "all", label: "All Sports" },
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
  { key: "soccer", label: "Soccer" },
  { key: "mma", label: "MMA" },
] as const;

type TabKey = (typeof CATEGORIES)[number]["key"];
const cached: Record<string, { ts: number; data: Article[] }> = {};

const todayET = () => {
  const fmt = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [m, d, y] = fmt.split("/");
  return `${y}${m}${d}`;
};

const getDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const favicon = (domain: string) =>
  domain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}` : "";

const stableKey = (a: Article) => a.url?.trim() || `${a.title}-${a.publishedAt}`;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const bad = (s?: string | null) => !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());
const normalize = (s: string) => {
  const t = s.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};
const uniqStrings = (arr: string[]) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const k = s.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
};

function SmartImage({
  candidates,
  alt,
  className,
  wrapperClassName,
}: {
  candidates: string[];
  alt: string;
  className?: string;
  wrapperClassName?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [candidates.join("|")]);

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

const getImageCandidates = (a: Article) => {
  const sources = [a.urlToImage, ...(Array.isArray(a.images) ? a.images : [])]
    .filter((s): s is string => !bad(s))
    .map(normalize);
  return uniqStrings(sources);
};

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900">
      <div className="h-40 bg-gray-100 dark:bg-white/5" />
      <div className="p-4">
        <div className="h-3 w-11/12 rounded bg-gray-100 dark:bg-white/5" />
        <div className="mt-2 h-3 w-8/12 rounded bg-gray-100 dark:bg-white/5" />
        <div className="mt-4 h-3 w-4/12 rounded bg-gray-100 dark:bg-white/5" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reader Modal                                                       */
/* ------------------------------------------------------------------ */
function ReaderModal({
  open,
  article,
  onClose,
}: {
  open: boolean;
  article: Article | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !article) {
      setContent(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/parse-article?url=${encodeURIComponent(article.url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setContent(data.content);
        }
      })
      .catch((err) => {
        setError("Failed to load article");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, article]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !article) return null;

  const images = getImageCandidates(article);
  const domain = getDomain(article.url);
  const logos = uniqStrings([article.source.image ?? "", favicon(domain)].filter(Boolean).map(normalize));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80"
      />

      {/* panel - MAGAZINE STYLE */}
      <div className="relative z-10 w-full max-w-5xl max-h-[95vh] overflow-hidden border-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] shadow-2xl">
        {/* Header - NEWSPAPER MASTHEAD */}
        <div className="sticky top-0 z-20 border-b-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20]">
          <div className="flex items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
              {logos.length > 0 && (
                <SmartImage
                  candidates={logos}
                  alt={article.source.name}
                  className="h-8 w-8 object-contain flex-shrink-0 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-800 p-1"
                />
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.2em] font-black text-neutral-900 dark:text-neutral-100">
                  {article.source.name || domain}
                </p>
                <time className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400" dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
            </div>

            <button
              onClick={onClose}
              className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-900 px-4 py-2 text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100 hover:bg-red-600 hover:text-white hover:border-red-600 dark:hover:bg-red-400 dark:hover:text-neutral-900 dark:hover:border-red-400 transition-all"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-100px)] bg-white dark:bg-[#1D1D20]">
          {/* Article Body - MAGAZINE LAYOUT */}
          <div className="p-8 sm:p-12">

            {/* HEADLINE */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-neutral-900 dark:text-neutral-100 mb-6 leading-[1.1] uppercase border-b-4 border-red-600 dark:border-red-400 pb-6">
              {article.title}
            </h1>

            {/* HERO IMAGE */}
            {images.length > 0 && (
              <div className="mb-8 border-4 border-neutral-900 dark:border-neutral-100 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                <SmartImage
                  candidates={images}
                  alt={article.title}
                  wrapperClassName="aspect-[16/9]"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-900">
                <div className="w-3 h-3 bg-red-600 dark:bg-red-400 rounded-full animate-pulse mb-4"></div>
                <span className="text-xs uppercase tracking-[0.3em] font-black text-neutral-900 dark:text-neutral-100">Loading Story...</span>
              </div>
            )}

            {error && (
              <div className="border-4 border-red-600 dark:border-red-400 bg-white dark:bg-neutral-900 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
                  <h3 className="text-xs uppercase tracking-[0.3em] font-black text-neutral-900 dark:text-neutral-100">Error</h3>
                </div>
                <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 mb-2">{error}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Read the full article on the original site below.</p>
              </div>
            )}

            {/* ARTICLE CONTENT */}
            {content && (
              <article
                className="prose prose-lg max-w-none
                          prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:text-neutral-900 dark:prose-headings:text-neutral-100 prose-headings:border-b-2 prose-headings:border-neutral-900 dark:prose-headings:border-neutral-100 prose-headings:pb-2 prose-headings:mb-4
                          prose-p:text-neutral-900 dark:prose-p:text-neutral-100 prose-p:leading-relaxed prose-p:text-lg prose-p:mb-6
                          prose-a:text-red-600 dark:prose-a:text-red-400 prose-a:no-underline prose-a:font-bold hover:prose-a:underline
                          prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100 prose-strong:font-black
                          prose-img:border-4 prose-img:border-neutral-900 dark:prose-img:border-neutral-100 prose-img:my-8 prose-img:w-full
                          prose-blockquote:border-l-4 prose-blockquote:border-red-600 dark:prose-blockquote:border-red-400 prose-blockquote:bg-neutral-100 dark:prose-blockquote:bg-neutral-900 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:font-light
                          prose-code:bg-neutral-900 dark:prose-code:bg-neutral-100 prose-code:text-white dark:prose-code:text-neutral-900 prose-code:px-2 prose-code:py-1 prose-code:font-mono prose-code:text-sm
                          prose-ul:list-square prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6
                          prose-li:text-neutral-900 dark:prose-li:text-neutral-100 prose-li:mb-2"
                style={{ fontFamily: '"Merriweather", serif', textAlign: 'justify' }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}

            {/* READ MORE SECTION */}
            <div className="mt-12 pt-8 border-t-4 border-neutral-900 dark:border-neutral-100">
              <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-900 p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
                      <p className="text-xs uppercase tracking-[0.3em] font-black text-neutral-900 dark:text-neutral-100">Continue Reading</p>
                    </div>
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{article.source.name || domain}</p>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border-2 border-neutral-900 dark:border-neutral-100 bg-red-600 dark:bg-red-400 px-6 py-3 text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-900 hover:border-neutral-900 dark:hover:border-neutral-100 transition-all"
                  >
                    Read Full Article
                    <span>→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------- */
/* Live scores router for tabs                   */
/* - All tab => show ALL live sports             */
/* - League tab => show ONLY that league live    */
/* - If none live => show "No live games..."     */
/* --------------------------------------------- */
function LiveScoresForTab({ tab }: { tab: TabKey }) {
  const [live, setLive] = useState<LiveGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;

    const tick = async () => {
      try {
        const res = await fetch(`https://u-mail.co/api/sportsGames/live?date=${todayET()}`, {
          cache: "no-store",
        });
        const j = await res.json();
        const games: LiveGame[] = Array.isArray(j?.games) ? j.games : [];

        // safety: ensure "live" really means live
        const filtered = games.filter(
          (g) => g?.isLive === true || /live|in progress/i.test(g?.status || "")
        );

        if (!cancel) {
          setLive(filtered);
          setLoaded(true);
        }
      } catch {
        if (!cancel) {
          setLive([]);
          setLoaded(true);
        }
      }
    };

    tick();
    const iv = setInterval(tick, 60_000);
    return () => {
      cancel = true;
      clearInterval(iv);
    };
  }, []);

  const hasLiveForTab = useMemo(() => {
    if (tab === "all") return live.length > 0;
    return live.some((g) => String(g.league || "").toLowerCase() === tab);
  }, [live, tab]);

  // Don’t show anything until we’ve checked once (prevents flicker)
  if (!loaded) return null;

  // If no live games for the selected tab, show the message (not "No games today.")
  if (!hasLiveForTab) {
    return (
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700 shadow-sm dark:border-white/10 dark:bg-brand-900 dark:text-gray-200">
        No live games right now.
      </div>
    );
  }

  // All = all live games
  if (tab === "all") return <LiveScores sport="all" />;

  // League tab = only that league (LiveScores will show only live for that league)
  return <LiveScores sport={tab} />;
}

export default function SportsTab() {
  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readerArticle, setReaderArticle] = useState<Article | null>(null);

  useEffect(() => {
    let cancel = false;
    setError(null);

    if (cached[tab] && Date.now() - cached[tab].ts < CACHE_TTL) {
      setArticles(cached[tab].data);
      setPage(1);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        let news: Article[] = [];

        if (tab === "all") {
          news = await fetchSportsNews();
        } else {
          const r = await fetch(`https://u-mail.co/api/sportsByCategory/${tab}`, { cache: "no-store" });
          if (!r.ok) throw new Error(`Sports category API ${r.status}`);
          const j = await r.json();

          news = (j.results || []).map((it: any) => ({
            title: it.title,
            url: it.link,
            urlToImage: it.image ?? null,
            images: Array.isArray(it.images) ? it.images : [],
            publishedAt: it.publishedAt,
            source: { id: null, name: it.source, image: it.sourceLogo ?? favicon(getDomain(it.link)) },
          }));
        }

        const map = new Map<string, Article>();
        for (const a of news) {
          const k = stableKey(a);
          if (!map.has(k)) map.set(k, a);
        }

        const uniq = Array.from(map.values()).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

        if (!cancel) {
          cached[tab] = { ts: Date.now(), data: uniq };
          setArticles(uniq);
          setPage(1);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? "Unknown error");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [tab]);

  const uniq = useMemo(() => {
    const map = new Map<string, Article>();
    for (const a of articles) {
      const k = stableKey(a);
      if (!map.has(k)) map.set(k, a);
    }
    return Array.from(map.values());
  }, [articles]);

  const topStrip = useMemo(() => uniq.filter((a) => getImageCandidates(a).length > 0).slice(0, 4), [uniq]);

  const rest = useMemo(() => {
    const heroKeys = new Set(topStrip.map(stableKey));
    return uniq.filter((a) => !heroKeys.has(stableKey(a)));
  }, [uniq, topStrip]);

  const totalPages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const safePage = clamp(page, 1, totalPages);
  const pageNews = rest.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const changePage = useCallback(
    (next: number) => {
      if (loading) return;
      setPage(clamp(next, 1, totalPages));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [loading, totalPages]
  );

  return (
    <div className="pb-10">
      {/* News tabs */}
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900 overflow-hidden">
        <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-gray-200 dark:border-white/10 overflow-x-auto">
          {CATEGORIES.map((c) => {
            const isActive = tab === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setTab(c.key)}
                className={[
                     "relative shrink-0 whitespace-nowrap rounded-full px-3 sm:px-4 py-2 text-sm font-extrabold transition",
                  "ring-1 ring-black/10 dark:ring-white/10",
                  isActive
                    ? "bg-gray-900 text-white border-black/20 hover:bg-gray-900 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/10"
                    : "border border-black/10 bg-white text-gray-800 hover:bg-black/[0.03] dark:border-white/10 dark:bg-brand-900 dark:text-white/80 dark:hover:bg-white/[0.06]",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ✅ Live scores obey the selected tab */}
      <LiveScoresForTab tab={tab} />

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </p>
      )}

      {topStrip.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topStrip.map((a, i) => {
            const domain = getDomain(a.url);
            const logoCandidates = uniqStrings([a.source.image ?? "", favicon(domain)].filter(Boolean).map(normalize));
            const imgCandidates = getImageCandidates(a);

            return (
              <button
                key={`${stableKey(a)}-${i}`}
                onClick={(e) => {
                  e.preventDefault();
                  setReaderArticle(a);
                }}
                className="group relative block w-full text-left h-44 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md
                           dark:border-white/10 dark:bg-brand-900"
              >
                {imgCandidates.length ? (
                  <SmartImage
                    candidates={imgCandidates}
                    alt={a.title}
                    wrapperClassName="absolute inset-0"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-white/5">
                    <span className="text-sm text-gray-500">No image</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-3 text-white">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{a.title}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {logoCandidates.length ? (
                      <SmartImage candidates={logoCandidates} alt={a.source.name} className="h-4 w-4 rounded bg-white/10 object-contain" />
                    ) : null}
                    <span className="truncate max-w-[140px]">{a.source.name}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <section className="mt-8">
        {loading && articles.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div
            className={`
              grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3
              transition-opacity duration-200
              ${loading ? "opacity-70" : "opacity-100"}
            `}
          >
            {pageNews.map((a) => (
              <ArticleCard key={stableKey(a)} article={a} onClick={() => setReaderArticle(a)} />
            ))}
          </div>
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => changePage(safePage - 1)}
          onNext={() => changePage(safePage + 1)}
        />
      </section>

      <ReaderModal open={!!readerArticle} article={readerArticle} onClose={() => setReaderArticle(null)} />
    </div>
  );
}

function ArticleCard({ article, onClick }: { article: Article; onClick?: () => void }) {
  const domain = getDomain(article.url);
  const logoCandidates = uniqStrings([article.source.image ?? "", favicon(domain)].filter(Boolean).map(normalize));
  const imgCandidates = getImageCandidates(article);

  if (imgCandidates.length) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
        }}
        className="group block w-full text-left overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md
                   dark:border-white/10 dark:bg-brand-900"
      >
        <div className="relative h-48">
          <SmartImage
            candidates={imgCandidates}
            alt={article.title}
            wrapperClassName="absolute inset-0"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/0" />
          <div className="absolute bottom-0 z-10 flex w-full flex-col gap-2 p-4 text-white">
            <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{article.title}</h3>
            <div className="flex items-center gap-2 text-xs text-white/90">
              {logoCandidates.length ? (
                <SmartImage candidates={logoCandidates} alt={article.source.name} className="h-4 w-4 rounded bg-white/10 object-contain" />
              ) : null}
              <span className="truncate max-w-[160px]">{article.source.name}</span>
              <span className="text-white/60">•</span>
              <time className="whitespace-nowrap text-white/70">
                {new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </time>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className="group block w-full text-left overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md
                 dark:border-white/10 dark:bg-brand-900"
    >
      <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-gray-900 dark:text-white">{article.title}</h3>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {logoCandidates.length ? (
          <SmartImage candidates={logoCandidates} alt={article.source.name} className="h-6 w-6 rounded bg-gray-100 object-contain dark:bg-white/5" />
        ) : null}
        <span className="truncate max-w-[200px]">{article.source.name}</span>
        <span>•</span>
        <time className="whitespace-nowrap">
          {new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </time>
      </div>
    </button>
  );
}

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
    <div className="mt-10 flex flex-col items-center gap-4">
      <div className="flex gap-3">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-40
                     dark:bg-white/10 dark:hover:bg-white/15"
        >
          Previous
        </button>
        <button
          disabled={page === totalPages || loading}
          onClick={onNext}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <span className="text-xs text-gray-600 dark:text-gray-300">
        Page <span className="font-semibold">{page}</span> / {totalPages}
        {loading && <span className="ml-2 animate-pulse text-gray-500">Loading…</span>}
      </span>
    </div>
  );
}
