'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatSupplyValue, formatDate, formatDateWeirdValue } from '@/utils/formatters';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface QuoteData {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  v: number;
  t: number;
}
interface StockData {
  profile: any;
  quote: QuoteData;
  metric: any;
}

interface Props {
  stockData: StockData;
  newsData: any[];
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers (local to modal)                                          */
/* ------------------------------------------------------------------ */
const fmt = (v: number | undefined | null, d = 2) =>
  v == null || Number.isNaN(v as any) ? '—' : parseFloat(String(v)).toFixed(d);

const gridRow = (k: string, v: string | React.ReactNode) => (
  <div
    key={k}
    className="flex items-center justify-between gap-4 border-b border-gray-200/70 pb-2 text-sm dark:border-white/10"
  >
    <span className="text-gray-600 dark:text-white/60">{k}</span>
    <span className="text-right font-semibold text-gray-900 dark:text-white">{v}</span>
  </div>
);

const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(ms);

const timeAgo = (ms: number) => {
  if (!ms || Number.isNaN(ms)) return '—';
  const d = Date.now() - ms;
  if (d < 60_000) return `${Math.floor(d / 1_000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return formatDate(ms);
};

const logoFromUrl = (url?: string) => {
  try {
    const h = new URL(url ?? '').hostname.replace(/^www\./, '');
    return h ? `https://logo.clearbit.com/${h}?size=64` : '';
  } catch {
    return '';
  }
};

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

function safePublishedMs(n: any): number {
  // finnhub-style datetime = seconds (number)
  if (typeof n?.datetime === 'number' && n.datetime > 0) return n.datetime * 1000;

  // sometimes datetime is ISO string
  if (typeof n?.datetime === 'string') {
    const d = Date.parse(n.datetime);
    return Number.isNaN(d) ? 0 : d;
  }

  // sometimes publishedAt / date
  for (const k of ['publishedAt', 'published_at', 'date', 'time']) {
    const v = n?.[k];
    if (typeof v === 'number' && v > 0) return v > 10_000_000_000 ? v : v * 1000;
    if (typeof v === 'string') {
      const d = Date.parse(v);
      if (!Number.isNaN(d)) return d;
    }
  }

  return 0;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function StockQuoteModal({ stockData, newsData, onClose }: Props) {
  const [newsPage, setNewsPage] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);

  const newsPerPage = 9;
  const totalPages = Math.max(1, Math.ceil((newsData?.length ?? 0) / newsPerPage));
  const paginatedNews = (newsData ?? []).slice((newsPage - 1) * newsPerPage, newsPage * newsPerPage);

  const getMetric = (k: string) => stockData?.metric?.metric?.[k] ?? null;

  const profile = stockData?.profile ?? {};
  const quote = stockData?.quote ?? ({} as QuoteData);

  const lastMs = useMemo(() => {
    const t = quote?.t;
    if (typeof t === 'number' && t > 0) return t * 1000; // seconds -> ms
    return Date.now();
  }, [quote?.t]);

  const isUp = (quote?.dp ?? 0) >= 0;

  /* ------------------------- modal behavior -------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  /* ---------------------------- render ------------------------------ */
return (
  <div
    ref={overlayRef}
    onMouseDown={onOverlayClick}
    className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
    aria-modal="true"
    role="dialog"
  >
    <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center">
      <div className="
  relative w-full sm:max-w-5xl overflow-hidden max-h-[92vh] sm:max-h-[88vh] sm:rounded-2xl
  bg-white dark:bg-brand-900
  border border-gray-200/70 dark:border-white/10
  shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)]
  dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.75)]
"
>
        {/* ambient gradient */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-[0.45]">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute top-20 right-10 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-brand-900/80">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  {profile?.logo ? (
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-md" />
                      <img
                        src={profile.logo}
                        alt=""
                        className="relative h-11 w-11 rounded-2xl bg-white/70 object-contain p-1.5 ring-1 ring-gray-200/70 dark:bg-white/5 dark:ring-white/10"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    </div>
                  ) : (
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 ring-1 ring-gray-200/70 dark:ring-white/10" />
                  )}

                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-extrabold tracking-tight truncate text-gray-900 dark:text-white">
                      {profile?.name ?? "Company"}
                      <span className="ml-2 text-gray-500 dark:text-white/60 font-bold">
                        ({profile?.ticker ?? "—"})
                      </span>
                    </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-white/60">
                      <span className="rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">
                        {profile?.exchange ? `Exchange: ${profile.exchange}` : "Exchange: —"}
                      </span>
                      <span className="rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">
                        As of {fmtDateTime(lastMs)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                    ${formatSupplyValue(quote?.c ?? 0)}
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold ring-1 ring-gray-200/70 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 dark:ring-white/10 dark:from-indigo-500/15 dark:to-fuchsia-500/15">
                    <span
                      className={`h-2 w-2 rounded-full ${isUp ? "bg-emerald-500" : "bg-rose-500"}`}
                      aria-hidden="true"
                    />
                    <span className="text-gray-900 dark:text-white">
                      {isUp ? "+" : ""}
                      {formatSupplyValue(quote?.dp ?? 0)}%
                    </span>
                    <span className="text-gray-500 dark:text-white/60 font-bold">
                      ({isUp ? "+" : ""}
                      {formatSupplyValue(quote?.d ?? 0)})
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="shrink-0 rounded-xl px-3 py-2 text-sm font-black text-gray-900 ring-1 ring-gray-200/70 bg-white/70 hover:bg-white active:scale-[0.98] transition dark:text-white dark:ring-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                aria-label="Close"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-fuchsia-500/30 to-sky-500/30" />
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(92vh-92px)] sm:max-h-[calc(88vh-102px)] px-4 sm:px-6 py-5">
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Open", value: `$${formatSupplyValue(quote?.o ?? 0)}` },
              { label: "High", value: `$${formatSupplyValue(quote?.h ?? 0)}` },
              { label: "Low", value: `$${formatSupplyValue(quote?.l ?? 0)}` },
              { label: "Prev Close", value: `$${formatSupplyValue(quote?.pc ?? 0)}` },
            ].map((x) => (
              <div
                key={x.label}
                className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white/70 p-3 ring-1 ring-transparent transition hover:-translate-y-[1px] hover:shadow-lg dark:border-white/10 dark:bg-white/5"
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute -top-10 -left-10 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl" />
                  <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-2xl" />
                </div>
                <div className="relative">
                  <div className="text-xs text-gray-600 font-semibold dark:text-white/60">
                    {x.label}
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                    {x.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ✅ Metrics card — fixed separators */}
            <div className="lg:col-span-1 rounded-2xl border border-gray-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Key metrics</h4>
                <span className="text-xs text-gray-500 font-semibold dark:text-white/50">
                  TTM where available
                </span>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200/70 bg-white/60 dark:border-white/10 dark:bg-black/20">
                <div className="divide-y divide-gray-200/70 dark:divide-white/10">
                  {[
                    ["Market Cap", `$${formatSupplyValue(getMetric("marketCapitalization"))}`],
                    ["P/E (TTM)", fmt(getMetric("peTTM"))],
                    ["P/S (TTM)", fmt(getMetric("psTTM"))],
                    ["Dividend Yield", `${fmt(getMetric("currentDividendYieldTTM"))}%`],
                    ["Beta", fmt(getMetric("beta"))],
                    ["52-Week High", `$${formatSupplyValue(getMetric("52WeekHigh"))}`],
                    ["High Date", formatDateWeirdValue(getMetric("52WeekHighDate"))],
                    ["52-Week Low", `$${formatSupplyValue(getMetric("52WeekLow"))}`],
                    ["Low Date", formatDateWeirdValue(getMetric("52WeekLowDate"))],
                  ].map(([k, v]) => (
                    <div
                      key={k as string}
                      className="flex items-center justify-between gap-4 px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-gray-600 dark:text-white/65">
                        {k}
                      </span>
                      <span className="text-xs font-extrabold text-gray-900 dark:text-white text-right">
                        {v as any}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-[11px] text-gray-500 dark:text-white/50">
                Tip: metrics can be missing depending on the ticker/provider.
              </div>
            </div>

            {/* News card */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Latest news</h4>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/60">
                    Headlines for <span className="font-bold">{profile?.ticker ?? "this ticker"}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={newsPage === 1}
                    onClick={() => setNewsPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl px-3 py-2 text-xs font-extrabold ring-1 ring-gray-200/70 bg-white/70 hover:bg-white disabled:opacity-40 dark:ring-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    Prev
                  </button>
                  <div className="text-xs font-bold text-gray-600 dark:text-white/70">
                    {newsPage} / {totalPages}
                  </div>
                  <button
                    disabled={newsPage === totalPages}
                    onClick={() => setNewsPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-xl px-3 py-2 text-xs font-extrabold ring-1 ring-gray-200/70 bg-white/70 hover:bg-white disabled:opacity-40 dark:ring-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    Next
                  </button>
                </div>
              </div>

              {paginatedNews.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-gray-200/70 bg-gray-50/80 p-4 text-sm text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
                  No recent news for this ticker.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {paginatedNews.map((n, i) => {
                    const imgAvail = typeof n.image === "string" && n.image.trim();
                    const headline = n.headline ?? n.title ?? "Untitled article";
                    const url = String(n.url || "");
                    const publishedMs = safePublishedMs(n);
                    const srcLogo = logoFromUrl(url);
                    const host = safeHost(url);

                    return (
                      <a
                        key={`${n.id ?? url}-${i}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex gap-3 overflow-hidden rounded-2xl border border-gray-200/70 bg-white/70 p-3 transition hover:-translate-y-[1px] hover:shadow-lg dark:border-white/10 dark:bg-black/20"
                      >
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                          <div className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
                          <div className="absolute -bottom-14 -right-14 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-2xl" />
                        </div>

                        {imgAvail ? (
                          <img
                            src={n.image}
                            alt=""
                            className="relative h-20 w-28 shrink-0 rounded-xl object-cover bg-gray-100 ring-1 ring-gray-200/70 dark:bg-white/5 dark:ring-white/10"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        ) : (
                          <div className="relative h-20 w-28 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 ring-1 ring-gray-200/70 flex items-center justify-center text-gray-700 text-xs font-black dark:ring-white/10 dark:text-white/70">
                            NEWS
                          </div>
                        )}

                        <div className="relative min-w-0 flex-1">
                          <div className="text-sm font-extrabold leading-snug line-clamp-2 text-gray-900 group-hover:underline dark:text-white">
                            {headline}
                          </div>

                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-white/60">
                            {srcLogo ? (
                              <img
                                src={srcLogo}
                                alt=""
                                className="h-4 w-4 rounded bg-white/70 ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10"
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            ) : null}
                            <span className="truncate max-w-[10rem] font-semibold">{host}</span>
                            <span className="text-gray-400 dark:text-white/30">•</span>
                            <span className="font-semibold">{timeAgo(publishedMs)}</span>
                            <span className="ml-auto hidden sm:inline-flex items-center rounded-full bg-gray-100/80 px-2 py-0.5 text-[11px] font-bold text-gray-700 ring-1 ring-gray-200/70 dark:bg-white/10 dark:text-white/70 dark:ring-white/10">
                              Read →
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    disabled={newsPage === 1}
                    onClick={() => setNewsPage((p) => Math.max(1, p - 1))}
                    className="w-1/2 rounded-2xl px-4 py-3 text-xs font-extrabold ring-1 ring-gray-200/70 bg-white/70 hover:bg-white disabled:opacity-50 dark:ring-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    Prev
                  </button>
                  <button
                    disabled={newsPage === totalPages}
                    onClick={() => setNewsPage((p) => Math.min(totalPages, p + 1))}
                    className="w-1/2 rounded-2xl px-4 py-3 text-xs font-extrabold ring-1 ring-gray-200/70 bg-white/70 hover:bg-white disabled:opacity-50 dark:ring-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 mb-10 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/10 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:opacity-95 active:scale-[0.99] transition"
            >
              Close
            </button>
          </div>

          <div className="h-2" />
        </div>
      </div>
    </div>
  </div>
);


}
