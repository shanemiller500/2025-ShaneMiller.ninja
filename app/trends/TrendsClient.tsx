"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRIES, defaultCountry } from "./lib/countries";
import type { TrendBundle, TrendItem, TrendResponse, TrendSourceKey } from "./lib/types";
import { formatTimeAgo } from "./lib/format";
import TrendCard from "./components/TrendCard";
import Skeleton from "./components/Skeleton";

const SOURCES: { key: TrendSourceKey; title: string; subtitle: string }[] = [
  { key: "google", title: "Google Trends", subtitle: "Daily trending searches (free RSS)" },
  { key: "world", title: "World Trends", subtitle: "Most-viewed Wikipedia topics (global pulse)" },
  { key: "social", title: "Social Buzz", subtitle: "Top social posts by country/community" },
  { key: "videos", title: "Popular Videos", subtitle: "Most active video discussions right now" },
];

export default function TrendsClient() {
  const [country, setCountry] = useState(defaultCountry);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [bundle, setBundle] = useState<TrendBundle | null>(null);
  const [searchResult, setSearchResult] = useState<TrendResponse | null>(null);
  const [activeGoogleItem, setActiveGoogleItem] = useState<TrendItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const countryName = useMemo(
    () => COUNTRIES.find((c) => c.code === country)?.name ?? country,
    [country]
  );

  async function fetchAll() {
    setLoading(true);
    setError(null);

    try {
      const qs = `?country=${encodeURIComponent(country)}`;

      const [google, world, social, videos] = await Promise.all([
        fetch(`/api/trends/google${qs}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/trends/world${qs}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/trends/social${qs}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/trends/videos${qs}`, { cache: "no-store" }).then((r) => r.json()),
      ]);

      const next: TrendBundle = { google, world, social, videos };
      setBundle(next);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || "Failed to load trends.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  useEffect(() => {
    if (!activeGoogleItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveGoogleItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeGoogleItem]);

  async function runSearchFor(term: string) {
    const trimmed = term.trim();
    if (!trimmed) {
      setSearchResult(null);
      return;
    }

    setSearching(true);
    try {
      const qs =
        `?country=${encodeURIComponent(country)}` + `&query=${encodeURIComponent(trimmed)}`;
      const result = await fetch(`/api/trends/search${qs}`, { cache: "no-store" }).then((r) =>
        r.json()
      );
      setSearchResult(result);
    } catch (e: any) {
      setSearchResult({
        ok: false,
        error: "Search failed",
        hint: e?.message || "Could not search right now.",
      });
    } finally {
      setSearching(false);
    }
  }

  async function runSearch() {
    await runSearchFor(query);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-brand-900/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium text-brand-900 dark:text-white">
            Country: <span className="font-semibold">{countryName}</span>
          </div>
          <div className="text-xs text-brand-600 dark:text-brand-400">
            {updatedAt ? `Updated ${formatTimeAgo(updatedAt)}.` : "Pick a country to load trends."}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex w-full gap-2 sm:w-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              placeholder="Search worldwide topics, videos, keywords..."
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-brand-900 shadow-sm outline-none transition focus:border-brand-300 dark:border-white/10 dark:bg-brand-900 dark:text-white dark:focus:border-brand-500 sm:w-[320px]"
            />
            <button
              onClick={runSearch}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-brand-900 shadow-sm transition hover:bg-indigo-50/70 active:opacity-90 dark:border-white/10 dark:bg-brand-900 dark:text-white dark:hover:bg-white/10"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-brand-900 shadow-sm outline-none transition focus:border-brand-300 dark:border-white/10 dark:bg-brand-900 dark:text-white dark:focus:border-brand-500 sm:w-[260px]"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchAll}
            className="rounded-xl border border-black/10 bg-brand-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:opacity-90 dark:border-white/10 dark:bg-brand-700 dark:text-white dark:hover:bg-brand-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {searchResult ? (
        <TrendCard
          title={`Search Results${query.trim() ? `: ${query.trim()}` : ""}`}
          subtitle="Cross-source results for topics, social posts, and videos"
        >
          {searching ? (
            <Skeleton />
          ) : searchResult.ok === false ? (
            <div className="rounded-xl border border-black/10 bg-indigo-50/60 p-3 text-sm text-brand-700 dark:border-white/10 dark:bg-brand-900/40 dark:text-brand-300">
              {searchResult.error || "Search unavailable."}
              {searchResult.hint ? (
                <div className="mt-1 text-xs text-brand-500 dark:text-brand-400">
                  {searchResult.hint}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {searchResult.items.length === 0 ? (
                <div className="rounded-xl border border-black/10 bg-indigo-50/60 p-3 text-sm text-brand-700 dark:border-white/10 dark:bg-brand-900/40 dark:text-brand-300">
                  No results found for that search.
                </div>
              ) : (
                searchResult.items.map((it: TrendItem, idx: number) => (
                  <div
                    key={`search-${idx}-${it.title}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 shadow-sm transition hover:bg-indigo-50/70 dark:border-white/10 dark:bg-brand-900 dark:hover:bg-white/10"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-brand-900 dark:text-white">
                        {it.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-600 dark:text-brand-400">
                        {it.meta ? <span>{it.meta}</span> : null}
                        {it.source ? <span className="opacity-80">{it.source}</span> : null}
                      </div>
                    </div>

                    {it.url ? (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg border border-black/10 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-indigo-50 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}
        </TrendCard>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {SOURCES.map((s) => {
          const data = bundle?.[s.key];

          return (
            <TrendCard key={s.key} title={s.title} subtitle={s.subtitle} country={country}>
              {loading && !data ? (
                <Skeleton />
              ) : (
                <div className="space-y-2">
                  {data?.ok === false ? (
                    <div className="rounded-xl border border-black/10 bg-indigo-50/60 p-3 text-sm text-brand-700 dark:border-white/10 dark:bg-brand-900/40 dark:text-brand-300">
                      {data.error || "Source unavailable."}
                      {data.hint ? (
                        <div className="mt-1 text-xs text-brand-500 dark:text-brand-400">
                          {data.hint}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    data?.items?.map((it: TrendItem, idx: number) => {
                      const hasGoogleDetails =
                        s.key === "google" &&
                        (Boolean(it.imageUrl) ||
                          Boolean(it.publishedAt) ||
                          (Array.isArray(it.related) && it.related.length > 0));

                      return (
                        <div
                          key={`${s.key}-${idx}-${it.title}`}
                          className="flex items-start justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 shadow-sm transition hover:bg-indigo-50/70 dark:border-white/10 dark:bg-brand-900 dark:hover:bg-white/10"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-brand-900 dark:text-white">
                              {it.title}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-600 dark:text-brand-400">
                              {it.meta ? <span>{it.meta}</span> : null}
                              {it.source ? <span className="opacity-80">{it.source}</span> : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {hasGoogleDetails ? (
                              <button
                                onClick={() => setActiveGoogleItem(it)}
                                className="rounded-lg border border-black/10 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-indigo-50 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10"
                              >
                                Details
                              </button>
                            ) : null}
                            {it.url ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-black/10 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-indigo-50 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10"
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </TrendCard>
          );
        })}
      </div>

      {activeGoogleItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setActiveGoogleItem(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl dark:border-white/10 dark:bg-brand-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-brand-900 dark:text-white">
                  {activeGoogleItem.title}
                </h3>
                <div className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                  {activeGoogleItem.meta}
                </div>
              </div>
              <button
                onClick={() => setActiveGoogleItem(null)}
                className="rounded-lg border border-black/10 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-indigo-50/70 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {activeGoogleItem.imageUrl ? (
              <img
                src={activeGoogleItem.imageUrl}
                alt={activeGoogleItem.title}
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />
            ) : null}

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  setQuery(activeGoogleItem.title);
                  await runSearchFor(activeGoogleItem.title);
                  setActiveGoogleItem(null);
                }}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-indigo-50 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10"
              >
                Find More On This Site
              </button>
              {activeGoogleItem.url ? (
                <a
                  href={activeGoogleItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-indigo-50 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10"
                >
                  Open Primary Source
                </a>
              ) : null}
            </div>

            <div className="space-y-2">
              {activeGoogleItem.related && activeGoogleItem.related.length > 0 ? (
                activeGoogleItem.related.map((news, idx) => (
                  <div
                    key={`${news.title}-${idx}`}
                    className="rounded-xl border border-black/10 bg-indigo-50/60 p-3 dark:border-white/10 dark:bg-brand-900/50"
                  >
                    <div className="text-sm font-medium text-brand-900 dark:text-white">
                      {news.title}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="text-xs text-brand-600 dark:text-brand-400">
                        {news.source || "Publisher"}
                      </div>
                      {news.url ? (
                        <a
                          href={news.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-black/10 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-indigo-50 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-black/10 bg-indigo-50/60 p-3 text-sm text-brand-700 dark:border-white/10 dark:bg-brand-900/40 dark:text-brand-300">
                  No related news articles were included for this trend item.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-white/85 p-4 text-xs text-brand-600 dark:border-white/10 dark:bg-brand-900/60 dark:text-brand-400">
        <div className="font-medium text-brand-700 dark:text-brand-300">Notes</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Google Trends uses the public RSS feed (fast and free).</li>
          <li>World Trends uses Wikimedia pageview data from recent days.</li>
          <li>"Trends" vary by platform; this page shows multiple lenses side-by-side.</li>
        </ul>
      </div>
    </section>
  );
}


