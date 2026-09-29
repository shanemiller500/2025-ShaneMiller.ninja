/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Newspaper } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { PanelHeader, SectionLabel, Notice, StoryCard, Pagination, cardGrid } from "../components/NewsKit";
import { fetchFinnhubArticles } from "./Finnhub-API-Call";
import { fetchUmailArticles } from "./MoreNewsAPI";
import { trackEvent } from "@/utils/mixpanel";
import { SkeletonCard } from "../lib/SmartImage";
import { getDomain } from "../lib/utils";
import ReaderModal, { type ReadableArticle } from "../components/ReaderModal";
import {
  GroupModal,
  getImageCandidates,
  getLogoCandidates,
  stableKey,
  type ArticleGroup,
} from "./NewsModals";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface Article {
  source: {
    id: string | null;
    name: string;
    imageCandidates?: string[];
    image?: string | null;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  image?: string | null;
  images?: string[];
  thumbnails?: string[];
  publishedAt: string;
  content: string | null;
  categories: (string | null | undefined)[];
  category?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PER_PAGE = 45;
const CACHE_TTL = 30 * 60 * 1000;
const API_BASE = "https://u-mail.co/api/NewsAPI";
const USA_ENDPOINT = `${API_BASE}/us-news`;

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */
const sortByDateDesc = (arr: Article[]) =>
  [...arr].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

const uniqByKey = (arr: Article[]) => {
  const m = new Map<string, Article>();
  for (const a of arr) {
    const k = stableKey(a);
    if (!m.has(k)) m.set(k, a);
  }
  return Array.from(m.values());
};

const isUSA = (a: Article) => {
  const cats = (Array.isArray(a.categories) ? a.categories : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toLowerCase());
  const host = getDomain(a.url).toLowerCase();
  return (
    cats.includes("us") ||
    cats.includes("united states") ||
    /\.us$/.test(host)
  );
};

const normalizeTitleKey = (t: string) =>
  String(t || "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(
      /\s+[-|]\s+(cnn|reuters|ap news|associated press|fox news|bbc|cnbc|wsj|the wall street journal|nyt|the new york times)$/i,
      ""
    )
    .trim();

function groupByTitle(articles: Article[]): ArticleGroup[] {
  const map = new Map<string, Article[]>();
  for (const a of articles) {
    const key =
      normalizeTitleKey(a.title || "") || (a.url ? a.url : stableKey(a));
    const list = map.get(key);
    if (list) list.push(a);
    else map.set(key, [a]);
  }

  const groups: ArticleGroup[] = [];
  for (const [key, items] of Array.from(map.entries())) {
    const sorted = sortByDateDesc(items);
    const rep = sorted[0];
    groups.push({
      key,
      title: rep?.title || key,
      items: sorted,
      rep,
      newestAt: rep?.publishedAt || new Date(0).toISOString(),
    });
  }
  groups.sort((a, b) => +new Date(b.newestAt) - +new Date(a.newestAt));
  return groups;
}

function articleToReadable(a: Article): ReadableArticle {
  return {
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    sourceName: a.source.name || getDomain(a.url),
    description: a.description || undefined,
    imageCandidates: getImageCandidates(a),
    logoCandidates: getLogoCandidates(a),
  };
}

/* ------------------------------------------------------------------ */
/*  Module-level cache                                                 */
/* ------------------------------------------------------------------ */
let CACHE_ALL: { ts: number; data: Article[] } | null = null;
let USA_CACHE: { ts: number; data: Article[] } | null = null;
let USA_FETCH: Promise<void> | null = null;

/* ------------------------------------------------------------------ */
/*  NewsTab                                                            */
/* ------------------------------------------------------------------ */
export default function NewsTab() {
  const [region, setRegion] = useState<"All" | "USA" | "World">("All");
  const [provider, setProvider] = useState("All");
  const [page, setPage] = useState(1);
  const [fade, setFade] = useState(false);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openGroup, setOpenGroup] = useState<ArticleGroup | null>(null);
  const [readerArticle, setReaderArticle] = useState<ReadableArticle | null>(null);

  /* Hydrate USA cache from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("usaNewsCache");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts: number; data: Article[] };
      if (Date.now() - parsed.ts < CACHE_TTL) USA_CACHE = parsed;
    } catch {}
  }, []);

  useEffect(() => {
    trackEvent("NewsTab Loaded");
  }, []);

  /* Load main feeds */
  useEffect(() => {
    let cancel = false;

    (async () => {
      if (CACHE_ALL && Date.now() - CACHE_ALL.ts < CACHE_TTL) {
        setArticles(CACHE_ALL.data);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [fh, um] = await Promise.allSettled([
          fetchFinnhubArticles(),
          fetchUmailArticles(),
        ]);
        const ok = (r: PromiseSettledResult<Article[]>) =>
          r.status === "fulfilled" ? r.value : [];
        const merged = sortByDateDesc(uniqByKey([...ok(fh), ...ok(um)]));
        if (!cancel) {
          CACHE_ALL = { ts: Date.now(), data: merged };
          setArticles(merged);
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

  /* Load USA endpoint when needed */
  useEffect(() => {
    let cancel = false;
    if (region !== "USA") return;
    if (USA_CACHE && Date.now() - USA_CACHE.ts < CACHE_TTL) return;

    if (!USA_FETCH) {
      USA_FETCH = (async () => {
        try {
          const res = await fetch(USA_ENDPOINT, { cache: "no-store" });
          if (!res.ok) throw new Error(`US feed ${res.status}`);
          const json = await res.json();
          const data: Article[] = (json?.results || []).map((r: Record<string, unknown>) => {
            const mainImg = r.image as string | null ?? null;
            return {
              source: {
                id: null,
                name: r.source as string || getDomain(r.link as string),
                imageCandidates: Array.isArray(r.sourceImageCandidates)
                  ? r.sourceImageCandidates
                  : [],
              },
              author: r.author as string | null ?? null,
              title: r.headline as string ?? "",
              description: r.description as string ?? "",
              url: r.link as string,
              urlToImage: mainImg,
              image: mainImg,
              images: Array.isArray(r.images) ? r.images as string[] : [],
              thumbnails: Array.isArray(r.thumbnails) ? r.thumbnails as string[] : [],
              publishedAt: r.publishedAt as string,
              content: r.content as string ?? null,
              categories: Array.isArray(r.categories) ? r.categories as string[] : [],
            };
          });
          USA_CACHE = { ts: Date.now(), data };
          try {
            localStorage.setItem("usaNewsCache", JSON.stringify(USA_CACHE));
          } catch {}
        } catch (e) {
          console.warn("USA endpoint error:", (e as Error).message);
        }
      })().finally(() => {
        USA_FETCH = null;
      });
    }

    USA_FETCH.then(() => {
      if (!cancel) setArticles((a) => [...a]);
    });

    return () => {
      cancel = true;
    };
  }, [region]);

  /* Filters */
  const dataset = useMemo(() => {
    if (region === "USA") {
      const extra = USA_CACHE?.data ?? [];
      const generic = articles.filter(isUSA);
      return sortByDateDesc(uniqByKey([...extra, ...generic]));
    }
    if (region === "World") return articles.filter((a) => !isUSA(a));
    return articles;
  }, [region, articles]);

  const providers = useMemo(
    () => ["All", ...Array.from(new Set(articles.map((a) => a.source.name))).sort()],
    [articles]
  );

  const byProvider = useMemo(
    () =>
      provider === "All"
        ? dataset
        : dataset.filter((a) => a.source.name === provider),
    [provider, dataset]
  );

  const groups = useMemo(() => groupByTitle(byProvider), [byProvider]);

  /* Hero group: newest group with an image (skip CBS small thumbs) */
  const heroGroup = useMemo(
    () =>
      groups.find((g) => {
        const a = g.rep;
        const isCBS =
          a.url?.includes("cbsnews.com") ||
          a.source.name?.toLowerCase().includes("cbs");
        if (isCBS) return false;
        return getImageCandidates(a, 800).length > 0;
      }) ?? null,
    [groups]
  );

  const restGroups = useMemo(
    () =>
      heroGroup ? groups.filter((g) => g.key !== heroGroup.key) : groups,
    [groups, heroGroup]
  );

  useEffect(() => setPage(1), [region, provider]);

  const totalPages = Math.max(1, Math.ceil(restGroups.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageGroups = restGroups.slice(
    (safePage - 1) * PER_PAGE,
    safePage * PER_PAGE
  );

  const changePage = useCallback(
    (n: number) => {
      if (fade) return;
      const next = Math.max(1, Math.min(n, totalPages));
      if (next === safePage) return;
      trackEvent("News Page Changed", { page: next });
      window.scrollTo({ top: 0, behavior: "smooth" });
      setFade(true);
      window.setTimeout(() => {
        setPage(next);
        setFade(false);
      }, 200);
    },
    [fade, totalPages, safePage]
  );

  const openReader = (a: Article) => {
    trackEvent("Article Clicked", {
      title: a.title,
      url: a.url,
      source: a.source.name,
    });
    setReaderArticle(articleToReadable(a));
  };

  const isCBS = (a: Article) => a.url?.includes("cbsnews.com") || a.source.name?.toLowerCase().includes("cbs");
  const card = (g: ArticleGroup, size: "hero" | "card" = "card") => {
    const a = g.rep;
    // CBS only serves small thumbnails, so its stories render as text cards.
    const images = isCBS(a) ? [] : getImageCandidates(a, size === "hero" ? 800 : 600);
    return (
      <StoryCard
        key={g.key}
        size={size}
        title={a.title}
        description={a.description}
        source={a.source.name || getDomain(a.url)}
        publishedAt={a.publishedAt}
        images={images}
        logos={getLogoCandidates(a)}
        badge={size === "hero" ? "Top story" : undefined}
        extra={g.items.length - 1}
        onExtra={() => setOpenGroup(g)}
        onOpen={() => openReader(a)}
      />
    );
  };

  return (
    <div>
      <PanelHeader icon={Newspaper} tone="indigo" title="Top Stories" caption={loading ? "Loading feeds…" : `${groups.length} stories · ${providers.length - 1} outlets`}>
        <Segmented
          id="newsRegion"
          ariaLabel="Region"
          value={region}
          onChange={(r) => {
            setRegion(r);
            trackEvent("News Region Changed", { region: r });
          }}
          options={(["All", "USA", "World"] as const).map((r) => ({ key: r, label: r }))}
        />
        <select
          value={provider}
          aria-label="Filter by outlet"
          onChange={(e) => {
            setProvider(e.target.value);
            trackEvent("News Provider Changed", { provider: e.target.value });
          }}
          className="max-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-[11px] text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
        >
          {providers.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </PanelHeader>

      <div className="p-4 sm:p-6">
        {error && <Notice tone="error">{error}</Notice>}

        {heroGroup ? card(heroGroup, "hero") : <Notice>{loading ? "Loading top stories…" : "No stories found."}</Notice>}

        <div className="mt-6">
          <SectionLabel right={totalPages > 1 ? `Page ${safePage} / ${totalPages}` : undefined}>Latest headlines</SectionLabel>
          <div className={`${cardGrid} transition-opacity duration-200 ${fade ? "opacity-0" : "opacity-100"}`}>
            {loading && groups.length === 0
              ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
              : pageGroups.map((g) => card(g))}
          </div>
        </div>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => changePage(safePage - 1)}
          onNext={() => changePage(safePage + 1)}
        />
      </div>

      <GroupModal
        open={!!openGroup}
        group={openGroup}
        onClose={() => setOpenGroup(null)}
        onArticleClick={(a) => {
          setOpenGroup(null);
          openReader(a);
        }}
      />
      <ReaderModal open={!!readerArticle} article={readerArticle} onClose={() => setReaderArticle(null)} accent="indigo" />
    </div>
  );
}
