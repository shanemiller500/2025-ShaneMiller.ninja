/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Trophy } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { PanelHeader, SectionLabel, Notice, StoryCard, Pagination, cardGrid } from "../components/NewsKit";
import { fetchSportsNews } from "./sportsNews";
import LiveScores from "./LiveScores";
import { SkeletonCard } from "../lib/SmartImage";
import { getDomain } from "../lib/utils";
import ReaderModal, { type ReadableArticle } from "../components/ReaderModal";
import {
  stableKey,
  getImageCandidates,
  getLogoCandidates,
  type SportsArticle,
} from "./SportsModals";

type Article = SportsArticle;

interface LiveGame {
  id: string;
  league: string;
  leagueDisplay?: string;
  status?: string;
  isLive?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
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

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

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
/*  LiveScoresForTab                                                   */
/* ------------------------------------------------------------------ */
function LiveScoresForTab({ tab }: { tab: TabKey }) {
  const [live, setLive] = useState<LiveGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;

    const tick = async () => {
      try {
        const res = await fetch(
          `https://u-mail.co/api/sportsGames/live?date=${todayET()}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        const games: LiveGame[] = Array.isArray(j?.games) ? j.games : [];
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

  if (!loaded) return null;

  if (!hasLiveForTab) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">No live games right now</span>
      </div>
    );
  }

  return tab === "all" ? <LiveScores sport="all" /> : <LiveScores sport={tab} />;
}

/* ------------------------------------------------------------------ */
/*  SportsTab                                                          */
/* ------------------------------------------------------------------ */
export default function SportsTab() {
  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readerArticle, setReaderArticle] = useState<ReadableArticle | null>(null);

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
          const r = await fetch(
            `https://u-mail.co/api/sportsByCategory/${tab}`,
            { cache: "no-store" }
          );
          if (!r.ok) throw new Error(`Sports category API ${r.status}`);
          const j = await r.json();
          news = (j.results || []).map((it: Record<string, unknown>) => ({
            title: it.title as string,
            url: it.link as string,
            urlToImage: (it.image as string) ?? null,
            images: Array.isArray(it.images) ? it.images as string[] : [],
            publishedAt: it.publishedAt as string,
            source: {
              id: null,
              name: it.source as string,
              image: (it.sourceLogo as string) ?? null,
            },
          }));
        }

        const map = new Map<string, Article>();
        for (const a of news) {
          const k = stableKey(a);
          if (!map.has(k)) map.set(k, a);
        }
        const uniq = Array.from(map.values()).sort(
          (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
        );

        if (!cancel) {
          cached[tab] = { ts: Date.now(), data: uniq };
          setArticles(uniq);
          setPage(1);
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
  }, [tab]);

  const uniq = useMemo(() => {
    const map = new Map<string, Article>();
    for (const a of articles) {
      const k = stableKey(a);
      if (!map.has(k)) map.set(k, a);
    }
    return Array.from(map.values());
  }, [articles]);

  /* Featured: up to 4 articles with images */
  const featured = useMemo(
    () => uniq.filter((a) => getImageCandidates(a).length > 0).slice(0, 4),
    [uniq]
  );

  const rest = useMemo(() => {
    const heroKeys = new Set(featured.map(stableKey));
    return uniq.filter((a) => !heroKeys.has(stableKey(a)));
  }, [uniq, featured]);

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
    <div>
      <PanelHeader icon={Trophy} tone="amber" title="Sports" caption="Scores & headlines">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <Segmented
            id="sportsLeague"
            ariaLabel="League"
            value={tab}
            onChange={(key) => setTab(key)}
            options={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
            className="w-max"
          />
        </div>
      </PanelHeader>

      <div className="p-4 sm:p-6">
        <LiveScoresForTab tab={tab} />
        {error && <Notice tone="error">{error}</Notice>}

        {featured.length > 0 && (
          <section className="mb-6">
            <SectionLabel>Featured stories</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((a, i) => card(a, "feature", i === 0 ? "Featured" : undefined))}
            </div>
          </section>
        )}

        <section>
          <SectionLabel right={totalPages > 1 ? `Page ${safePage} / ${totalPages}` : undefined}>Latest sports news</SectionLabel>
          {loading && articles.length === 0 ? (
            <div className={cardGrid}>{Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : (
            <div className={`${cardGrid} transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
              {pageNews.map((a) => card(a))}
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
      </div>

      <ReaderModal open={!!readerArticle} article={readerArticle} onClose={() => setReaderArticle(null)} accent="orange" />
    </div>
  );
}
