"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { LineChart } from "lucide-react";
import { PanelHeader, SectionLabel, Notice, StoryCard, Pagination, cardGrid } from "../components/NewsKit";
import { fetchFinanceNews } from "./financeNews";
import { SkeletonCard } from "../lib/SmartImage";
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

  const card = (a: Article, size: "feature" | "card" = "card", badge?: string) => (
    <StoryCard
      key={stableKey(a)}
      size={size}
      title={a.title}
      source={a.source.name || getDomain(a.url)}
      publishedAt={a.publishedAt}
      images={getImageCandidates(a)}
      logos={getLogoCandidates(a)}
      badge={badge}
      onOpen={() => openReader(a)}
    />
  );

  return (
    <div ref={contentRef}>
      <PanelHeader icon={LineChart} tone="emerald" title="Finance" caption={loading ? "Loading feeds…" : `${articles.length} stories · markets & business`} />

      <div className={`p-4 transition-opacity duration-300 sm:p-6 ${fade ? "opacity-0" : "opacity-100"}`}>
        {error && <Notice tone="error">{error}</Notice>}

        {heroArticles.length > 0 && page === 1 && (
          <section className="mb-6">
            <SectionLabel>Featured finance</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {heroArticles.map((a, i) => card(a, "feature", i === 0 ? "Top pick" : undefined))}
            </div>
          </section>
        )}

        <section>
          <SectionLabel right={totalPages > 1 ? `Page ${page} / ${totalPages}` : undefined}>Latest finance news</SectionLabel>
          <div className={cardGrid}>
            {loading && articles.length === 0
              ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
              : regularSlice.map((a) => card(a))}
          </div>
          <Pagination page={page} totalPages={totalPages} loading={loading} onPrev={() => turnPage(page - 1)} onNext={() => turnPage(page + 1)} />
        </section>
      </div>

      <ReaderModal open={!!readerArticle} article={readerArticle} onClose={() => setReaderArticle(null)} accent="emerald" />
    </div>
  );
}
