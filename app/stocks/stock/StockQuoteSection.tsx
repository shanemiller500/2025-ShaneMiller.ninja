'use client';

import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { API_TOKEN } from '@/utils/config';
import MarketWidgets from './MarketWidgets';
import NewsWidget from './NewsWidget';
import StockQuoteModal from './StockQuoteModal';

const PROXY_BASE = 'https://u-mail.co/api/finnhubProxy';

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

export default function StockQuoteSection() {
  const [symbolInput, setSymbolInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [stockData, setStockData] = useState<{
    profile: any;
    quote: QuoteData;
    metric: any;
  } | null>(null);
  const [newsData, setNewsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  /* ─────────────────────────── Autocomplete ─────────────────────────── */
  useEffect(() => {
    if (!symbolInput.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await fetch(`https://finnhub.io/api/v1/search?q=${symbolInput}&token=${API_TOKEN}`)
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

  /* ─────────────────────────── Search handler ───────────────────────── */
  const handleSearch = async (sym?: string) => {
    const symbol = (sym ?? symbolInput).trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError('');

    try {
      const [quote, profile, metric, news] = await Promise.all([
        fetch(`${PROXY_BASE}/quote/${symbol}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/profile/${symbol}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/metric/${symbol}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/news/${symbol}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (!quote || typeof quote.c !== 'number' || quote.c <= 0) {
        toast.error(`No data found for “${symbol}.” Try another symbol.`);
        setStockData(null);
        setNewsData([]);
        setShowModal(false);
        return;
      }

      let profileData = profile || {};
      if (!profileData.name) {
        profileData = { ...profileData, name: symbol, ticker: symbol, exchange: profileData.exchange ?? '', logo: profileData.logo ?? '' };
      }

      setStockData({ profile: profileData, quote, metric });
      setNewsData(Array.isArray(news) ? news : []);
      setShowModal(true);
      setSymbolInput('');
      setSuggestions([]);
    } catch (err: any) {
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
    setNewsData([]);
    setError('');
    setShowModal(false);
  };

  /* ────────────────────────────── Render ────────────────────────────── */
  return (
    <section className="p-4 space-y-10">
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar newestOnTop closeOnClick pauseOnHover />

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
            {suggestions.map((s) => (
              <li
                key={s}
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
          <button onClick={() => handleSearch()} className="px-4 py-2 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 w-full sm:w-auto">
            Search
          </button>
          <button onClick={handleClear} className="px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 w-full sm:w-auto">
            Clear
          </button>
        </div>
      </div>

      {/* default widgets when no modal */}
      {!loading && (!showModal || !stockData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MarketWidgets onSelectTicker={handleSearch} />
          <NewsWidget />
        </div>
      )}

      {loading && <p className="text-center">Loading…</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {/* Modal */}
      {showModal && stockData && (
        <StockQuoteModal
          stockData={stockData}
          newsData={newsData}
          onClose={() => setShowModal(false)}
        />
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        DISCLAIMER: All displayed stock quote data is delayed by a minimum of 15 minutes.
      </p>
    </section>
  );
}
