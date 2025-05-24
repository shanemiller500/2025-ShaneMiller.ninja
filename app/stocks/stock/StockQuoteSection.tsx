'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { API_TOKEN } from '@/utils/config';
import {
  formatSupplyValue,
  formatDate,
  formatDateWeirdValue,
} from '@/utils/formatters';

import MarketWidgets from './MarketWidgets';
import NewsWidget from './NewsWidget';

// 👉 Use a relative path so you hit your Next.js API (and avoid CORS / prod‐vs‐dev mismatch)
const PROXY_BASE = 'https://u-mail.co/api/finnhubProxy';

interface CandleData {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}
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

const fmt = (v: number | undefined | null, d = 2) =>
  v == null || isNaN(v as any) ? '—' : parseFloat(v.toString()).toFixed(d);

const gridRow = (k: string, v: string | React.ReactNode) => (
  <div
    key={k}
    className="flex justify-between gap-4 border-b pb-1 text-sm dark:border-gray-700"
  >
    <span className="text-gray-500 dark:text-gray-400">{k}</span>
    <span className="font-medium text-gray-800 dark:text-gray-100 text-right">{v}</span>
  </div>
);

const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(ms);

const timeAgo = (ms: number) => {
  const d = Date.now() - ms;
  if (d < 60_000) return `${Math.floor(d / 1_000)} s ago`;
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

export default function StockQuoteSection() {
  const [symbolInput, setSymbolInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [stockData, setStockData] = useState<{
    profile: any;
    quote: QuoteData;
    metric: any;
  } | null>(null);
  const [candleData, setCandleData] = useState<CandleData | null>(null);
  const [newsData, setNewsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newsPage, setNewsPage] = useState(1);

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  /* Autocomplete */
  useEffect(() => {
    if (!symbolInput.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await fetch(
          `https://finnhub.io/api/v1/search?q=${symbolInput}&token=${API_TOKEN}`
        )
          .then((r) => (r.ok ? r.json() : { result: [] }))
          .catch(() => ({ result: [] }));
        const syms = (data.result ?? []).map((i: any) => i.symbol as string);
        setSuggestions(Array.from(new Set(syms)));
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [symbolInput]);

  const getMetric = (k: string) => stockData?.metric?.metric?.[k] ?? null;

  const handleSearch = async (sym?: string) => {
    const symbol = (sym ?? symbolInput).trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError('');
    setNewsPage(1);

    try {
      const [quote, profile, metricData, news] = await Promise.all([
        fetch(`${PROXY_BASE}/quote/${symbol}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/profile/${symbol}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/metric/${symbol}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/news/${symbol}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      // ─── HANDLE MISSING OR ZEROED QUOTE ────────────────────────────────
      if (!quote || typeof quote.c !== 'number' || quote.c <= 0) {
        toast.error(`No data found for “${symbol}.” Try another symbol.`);
        setStockData(null);
        setNewsData([]);
        setShowModal(false);
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      // existing profile‐fallback logic
      let profileData = profile || {};
      if (!profileData.name) {
        console.warn(`No profile name for "${symbol}", falling back to symbol`);
        profileData = {
          ...profileData,
          name: symbol,
          ticker: symbol,
          exchange: profileData.exchange ?? '',
          logo: profileData.logo ?? '',
        };
      }

      setStockData({ profile: profileData, quote, metric: metricData });
      setNewsData(Array.isArray(news) ? news : []);
      setShowModal(true);
      setSymbolInput('');
      setSuggestions([]);
    } catch (err: any) {
      console.error('Search failed:', err);
      toast.error(err.message || 'Something went wrong. Please try again.');
      setError(err.message || 'Error fetching data');
      setStockData(null);
      setNewsData([]);
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSymbolInput('');
    setSuggestions([]);
    setStockData(null);
    setCandleData(null);
    setNewsData([]);
    setError('');
    setShowModal(false);
    setNewsPage(1);
  };

  /* Chart render */
  useEffect(() => {
    if (!chartCanvasRef.current || !candleData?.t?.length) return;
    chartRef.current?.destroy();
    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: candleData.t.map((t) => new Date(t * 1000)),
        datasets: [
          {
            label: 'Close',
            data: candleData.c,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(99,102,241,.12)',
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }, [candleData]);

  // pagination setup
  const newsPerPage = 9;
  const totalPages = Math.ceil(newsData.length / newsPerPage);
  const paginatedNews = newsData.slice((newsPage - 1) * newsPerPage, newsPage * newsPerPage);

  return (
    <section className="p-4 space-y-10">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
      />

      <h2 className="text-2xl font-bold">Stock Quote</h2>

      {/* search */}
      <div className="space-y-2">
        <input
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          placeholder="Enter symbol (e.g., AAPL)"
          className="p-2 w-full border rounded dark:bg-brand-900 dark:border-gray-600"
        />
        {!!suggestions.length && (
          <ul className="border rounded divide-y dark:border-gray-700 max-h-48 overflow-auto bg-white dark:bg-brand-900">
            {suggestions.map((s, i) => (
              <li
                key={`${s}-${i}`}
                className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => {
                  setSuggestions([]);
                  handleSearch(s);
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => handleSearch()}
            className="px-4 py-2 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 focus:outline-none w-full sm:w-auto"
          >
            Search
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 focus:outline-none w-full sm:w-auto"
          >
            Clear
          </button>
        </div>
      </div>

      {/* default widgets when no modal or no stockData */}
      {!loading && (!showModal || !stockData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MarketWidgets onSelectTicker={handleSearch} />
          <NewsWidget />
        </div>
      )}

      {loading && <p className="text-center">Loading…</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {/* Modal popup */}
      {showModal && stockData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-brand-900 rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowModal(false)}
            >
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
                <img
                  src={stockData.profile.logo}
                  alt="logo"
                  className="w-16 h-16 object-contain rounded-full self-start sm:self-center"
                />
              )}
            </div>

            {/* price */}
            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-extrabold">
                ${formatSupplyValue(stockData.quote.c)}
              </span>
              <span
                className={`${
                  stockData.quote.dp >= 0 ? 'text-green-600' : 'text-red-600'
                } font-semibold`}
              >
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
                [
                  'Market Cap',
                  `$${formatSupplyValue(getMetric('marketCapitalization'))}`,
                ],
                ['P/E (TTM)', fmt(getMetric('peTTM'))],
                ['P/S (TTM)', fmt(getMetric('psTTM'))],
                [
                  'Dividend Yield',
                  `${fmt(getMetric('currentDividendYieldTTM'))}%`,
                ],
                ['Beta', fmt(getMetric('beta'))],
                ['52-Wk High', `$${formatSupplyValue(getMetric('52WeekHigh'))}`],
                ['High Date', formatDateWeirdValue(getMetric('52WeekHighDate'))],
                ['52-Wk Low', `$${formatSupplyValue(getMetric('52WeekLow'))}`],
                ['Low Date', formatDateWeirdValue(getMetric('52WeekLowDate'))],
              ].map(([k, v]) => gridRow(k as string, v))}
            </div>

            {/* chart */}
            {candleData && (
              <div className="relative h-60 sm:h-72 md:h-80 w-full mt-6">
                <canvas ref={chartCanvasRef} className="w-full h-full" />
              </div>
            )}

            {/* paginated news */}
            <div className="mt-6 space-y-4">
              <h4 className="text-xl font-semibold">Latest News</h4>
              {paginatedNews.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No recent news for this ticker.
                </p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {paginatedNews.map((n, i) => {
                      const imgAvail =
                        typeof n.image === 'string' && n.image.trim();
                      const headline = n.headline ?? n.title ?? 'Untitled article';
                      const publishedMs =
                        (n.datetime ?? 0) * 1000 || Date.parse(n.datetime);
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
                              onError={(e) =>
                                (e.currentTarget.style.display = 'none')
                              }
                            />
                          )}
                          <div className="flex flex-col justify-between flex-1 min-w-0">
                            <p className="font-medium text-sm leading-snug line-clamp-2">
                              {headline}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {srcLogo && (
                                <img
                                  src={srcLogo}
                                  alt=""
                                  className="w-4 h-4 rounded-sm"
                                  onError={(e) =>
                                    (e.currentTarget.style.display = 'none')
                                  }
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
                    <button
                      disabled={newsPage === 1}
                      onClick={() => setNewsPage((p) => p - 1)}
                      className="px-3 py-1 bg-brand-gradient rounded disabled:opacity-50 text-white"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1">
                      {newsPage} / {totalPages}
                    </span>
                    <button
                      disabled={newsPage === totalPages}
                      onClick={() => setNewsPage((p) => p + 1)}
                      className="px-3 py-1 bg-brand-gradient rounded disabled:opacity-50 text-white"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DISCLAIMER */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        DISCLAIMER: All displayed stock quote data is delayed by a minimum of 15 minutes.
      </p>
    </section>
  );
}
