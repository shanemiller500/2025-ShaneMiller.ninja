'use client';

import React, { useState } from 'react';
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
  v == null || isNaN(v as any) ? '—' : parseFloat(v.toString()).toFixed(d);

const gridRow = (k: string, v: string | React.ReactNode) => (
  <div key={k} className="flex justify-between gap-4 border-b pb-1 text-sm dark:border-gray-700">
    <span className="text-gray-500 dark:text-gray-400">{k}</span>
    <span className="font-medium text-gray-800 dark:text-gray-100 text-right">{v}</span>
  </div>
);

const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(ms);

const timeAgo = (ms: number) => {
  const d = Date.now() - ms;
  if (d < 60_000)   return `${Math.floor(d / 1_000)} s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`;
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

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function StockQuoteModal({ stockData, newsData, onClose }: Props) {
  const [newsPage, setNewsPage] = useState(1);

  /* --------------------------- pagination --------------------------- */
  const newsPerPage   = 9;
  const totalPages    = Math.ceil(newsData.length / newsPerPage);
  const paginatedNews = newsData.slice((newsPage - 1) * newsPerPage, newsPage * newsPerPage);

  const getMetric = (k: string) => stockData?.metric?.metric?.[k] ?? null;

  /* ---------------------------- render ------------------------------ */
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-brand-900 rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto relative">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={onClose}>
          ✕
        </button>

        {/* info card */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">
              {stockData.profile.name}
              <span className="font-normal text-gray-500"> ({stockData.profile.ticker})</span>
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              As of {fmtDateTime((stockData.quote.t ?? Date.now() / 1000) * 1000)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Exchange: {stockData.profile.exchange}
            </p>
          </div>
          {stockData.profile.logo && (
            <img src={stockData.profile.logo} alt="logo" className="w-16 h-16 object-contain rounded-full self-start sm:self-center" />
          )}
        </div>

        {/* price */}
        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-extrabold">${formatSupplyValue(stockData.quote.c)}</span>
          <span className={`${stockData.quote.dp >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
            {stockData.quote.dp >= 0 ? '+' : ''}
            {formatSupplyValue(stockData.quote.dp)}%
          </span>
        </div>

        {/* metrics */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {[
            ['Open', `$${formatSupplyValue(stockData.quote.o)}`],
            ['High', `$${formatSupplyValue(stockData.quote.h)}`],
            ['Low', `$${formatSupplyValue(stockData.quote.l)}`],
            ['Market Cap', `$${formatSupplyValue(getMetric('marketCapitalization'))}`],
            ['P/E (TTM)', fmt(getMetric('peTTM'))],
            ['P/S (TTM)', fmt(getMetric('psTTM'))],
            ['Dividend Yield', `${fmt(getMetric('currentDividendYieldTTM'))}%`],
            ['Beta', fmt(getMetric('beta'))],
            ['52-Wk High', `$${formatSupplyValue(getMetric('52WeekHigh'))}`],
            ['High Date', formatDateWeirdValue(getMetric('52WeekHighDate'))],
            ['52-Wk Low', `$${formatSupplyValue(getMetric('52WeekLow'))}`],
            ['Low Date', formatDateWeirdValue(getMetric('52WeekLowDate'))],
          ].map(([k, v]) => gridRow(k as string, v))}
        </div>

        {/* paginated news */}
        <div className="mt-6 space-y-4">
          <h4 className="text-xl font-semibold">Latest News</h4>
          {paginatedNews.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No recent news for this ticker.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedNews.map((n, i) => {
                  const imgAvail = typeof n.image === 'string' && n.image.trim();
                  const headline = n.headline ?? n.title ?? 'Untitled article';
                  const publishedMs = (n.datetime ?? 0) * 1000 || Date.parse(n.datetime);
                  const srcLogo = logoFromUrl(n.url);
                  return (
                    <a
                      key={`${n.id ?? n.url}-${i}`}
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border dark:border-gray-700 hover:shadow-md bg-white dark:bg-brand-900 transition"
                    >
                      {imgAvail && (
                        <img
                          src={n.image}
                          alt=""
                          className="w-full sm:w-24 h-40 sm:h-24 object-cover rounded-md shrink-0"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <p className="font-medium text-sm leading-snug line-clamp-2">{headline}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {srcLogo && (
                            <img
                              src={srcLogo}
                              alt=""
                              className="w-4 h-4 rounded-sm"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          )}
                          <span className="truncate max-w-[6rem] md:max-w-none">
                            {new URL(n.url).hostname.replace(/^www\./, '')}
                          </span>
                          <span className="mx-1">·</span>
                          <span>{timeAgo(publishedMs)}</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
              <div className="flex justify-center space-x-2 mt-4">
                <button disabled={newsPage === 1} onClick={() => setNewsPage((p) => p - 1)} className="px-3 py-1 bg-brand-gradient rounded disabled:opacity-50 text-white">
                  Prev
                </button>
                <span className="px-3 py-1">
                  {newsPage} / {totalPages}
                </span>
                <button disabled={newsPage === totalPages} onClick={() => setNewsPage((p) => p + 1)} className="px-3 py-1 bg-brand-gradient rounded disabled:opacity-50 text-white">
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
