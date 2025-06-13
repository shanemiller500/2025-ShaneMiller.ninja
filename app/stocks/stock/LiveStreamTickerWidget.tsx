'use client';

import React, { useState, useEffect, useRef } from 'react';
import { API_TOKEN } from '@/utils/config';
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import StockQuoteModal from './StockQuoteModal';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const PROXY_BASE = 'https://u-mail.co/api/finnhubProxy';

const TOP_TEN_SYMBOLS = [
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOGL',
  'TSLA',
  'META',
  'NVDA',
  'JPM',
  'V',
  'NFLX',
  'AMD',
  'IBM',
];

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface TradeInfo {
  timestamp: number;
  price: number;
  info: string;
  bgColor: string;
  percentChange: number;
}

type MarketState = 'open' | 'premarket' | 'afterhours' | 'closed';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
const LiveStreamTickerWidget: React.FC = () => {
  /* ─────────────────────────── Live ticker state ────────────────────────── */
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeInfo>>({});
  const [symbolLogos, setSymbolLogos] = useState<Record<string, string>>({});
  const [symbolProfiles, setSymbolProfiles] = useState<Record<string, any>>({});
  const [marketState, setMarketState] = useState<MarketState>('closed');

  /* ─────────────────────────── Modal state ─────────────────────────────── */
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedStockData, setSelectedStockData] = useState<any | null>(null);
  const [selectedNewsData, setSelectedNewsData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */
  const updateMarketState = () => {
    const now = new Date();
    const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = est.getDay(); // 0-Sun … 6-Sat
    const mins = est.getHours() * 60 + est.getMinutes();
    const pre = 4 * 60; // 4 AM
    const open = 9 * 60 + 30; // 9:30 AM
    const close = 16 * 60; // 4 PM
    const aft = 20 * 60; // 8 PM

    let state: MarketState = 'closed';
    if (day !== 0 && day !== 6) {
      if (mins >= open && mins < close) state = 'open';
      else if (mins >= pre && mins < open) state = 'premarket';
      else if (mins >= close && mins < aft) state = 'afterhours';
    }
    setMarketState(state);
  };

  /* ------------------------------------------------------------------ */
  /*  Effects                                                           */
  /* ------------------------------------------------------------------ */

  // 0️⃣ Initial last-price fetch
  useEffect(() => {
    TOP_TEN_SYMBOLS.forEach((sym, i) => {
      setTimeout(() => {
        fetch(`${PROXY_BASE}/quote/${sym}`)
          .then((r) => r.json())
          .then((q) => {
            if (!q || typeof q.c !== 'number' || q.c <= 0 || typeof q.pc !== 'number') return;
            const pct = ((q.c - q.pc) / q.pc) * 100;
            const bgColor =
              q.c > q.pc
                ? 'bg-green-300 dark:bg-green-700'
                : q.c < q.pc
                ? 'bg-red-300 dark:bg-red-700'
                : 'bg-gray-100 dark:bg-gray-600';
            setTradeInfoMap((prev) => ({
              ...prev,
              [sym]: {
                timestamp: Date.now(),
                price: q.c,
                info: `$${q.c.toFixed(2)}`,
                bgColor,
                percentChange: pct,
              },
            }));
          })
          .catch((err) => console.error(`Initial quote fetch error for ${sym}:`, err));
      }, i * 200);
    });
  }, []);

  // 1️⃣ Market clock
  useEffect(() => {
    updateMarketState();
    const int = setInterval(updateMarketState, 60_000);
    return () => clearInterval(int);
  }, []);

  // 2️⃣ Static logos / profiles
  useEffect(() => {
    TOP_TEN_SYMBOLS.forEach((sym, i) => {
      setTimeout(() => {
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${API_TOKEN}`)
          .then((r) => r.json())
          .then((p) => {
            setSymbolLogos((prev) => ({ ...prev, [sym]: p.logo }));
            setSymbolProfiles((prev) => ({ ...prev, [sym]: p }));
          })
          .catch((err) => console.error(`Profile fetch error for ${sym}:`, err));
      }, i * 200);
    });
  }, []);

  // 3️⃣ Real-time WebSocket
  useEffect(() => {
    const timer = setTimeout(() => {
      socketRef.current = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);

      socketRef.current.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type !== 'trade' || !msg.data?.length) return;

        const { s: sym, p: priceRaw, t } = msg.data[0];
        if (!TOP_TEN_SYMBOLS.includes(sym)) return;

        const price = parseFloat(priceRaw);
        setTradeInfoMap((prev) => {
          const prevEntry = prev[sym];
          const pct = prevEntry ? ((price - prevEntry.price) / prevEntry.price) * 100 : 0;
          const bgColor =
            !prevEntry
              ? 'bg-gray-100 dark:bg-gray-600'
              : price > prevEntry.price
              ? 'bg-green-300 dark:bg-green-700'
              : price < prevEntry.price
              ? 'bg-red-300 dark:bg-red-700'
              : prevEntry.bgColor;

          return {
            ...prev,
            [sym]: {
              timestamp: t,
              price,
              info: `$${price.toFixed(2)}`,
              bgColor,
              percentChange: pct,
            },
          };
        });
      };

      socketRef.current.onerror = (e) => console.error('WebSocket error:', e);
      socketRef.current.onopen = () =>
        TOP_TEN_SYMBOLS.forEach((s) =>
          socketRef.current?.send(JSON.stringify({ type: 'subscribe', symbol: s })),
        );
    }, 1_000);

    return () => {
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Modal helpers                                                     */
  /* ------------------------------------------------------------------ */
  const openSymbolModal = async (sym: string) => {
    setModalLoading(true);
    try {
      const [quote, profile, metric, news] = await Promise.all([
        fetch(`${PROXY_BASE}/quote/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/profile/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/metric/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/news/${sym}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (!quote || typeof quote.c !== 'number' || quote.c <= 0) {
        toast.error(`No data found for “${sym}.”`);
        return;
      }

      let profileData = profile || {};
      if (!profileData.name) {
        profileData = {
          ...profileData,
          name: sym,
          ticker: sym,
          exchange: profileData.exchange ?? '',
          logo: profileData.logo ?? '',
        };
      }

      setSelectedStockData({ profile: profileData, quote, metric });
      setSelectedNewsData(Array.isArray(news) ? news : []);
      setSelectedSymbol(sym);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch symbol data.');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedSymbol(null);
    setSelectedStockData(null);
    setSelectedNewsData([]);
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  const banner =
    marketState === 'closed'
      ? 'Markets Closed'
      : marketState === 'premarket'
      ? 'Pre-Market Trading'
      : marketState === 'afterhours'
      ? 'After-Hours Trading'
      : null;

  const isMarketClosed = marketState === 'closed';

  return (
    <>
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar pauseOnHover />

      <section className="mt-6 p-4 rounded shadow relative dark:bg-brand-950 bg-white">
        <h2 className="text-xl font-bold mb-4 text-center">Live Stock Ticker</h2>

        {banner && (
          <div
            className={`mb-4 text-center font-semibold animate-pulse ${
              marketState === 'closed' ? 'text-red-600' : 'text-yellow-500'
            }`}
          >
            {banner}
          </div>
        )}

        {/* ➊ tighter grid, more columns, smaller gap */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-1">
          {TOP_TEN_SYMBOLS.map((sym) => {
            const info = tradeInfoMap[sym];

            return (
              <motion.div
                key={sym}
                onClick={() => openSymbolModal(sym)}
                className={`relative aspect-square rounded overflow-hidden transition ${
                  isMarketClosed ? 'opacity-80' : 'cursor-pointer'
                } bg-white dark:bg-brand-900`}
                style={{
                  /* ➋ smaller logo inside each square */
                  backgroundImage: `url(${symbolLogos[sym] || ''})`,
                  backgroundSize: '70%',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Bottom strip */}
                <div
                  className={`absolute bottom-0 left-0 right-0 flex justify-between items-center px-1 py-0.5 text-xs font-semibold bg-opacity-80 ${
                    info?.bgColor ?? 'bg-gray-100 dark:bg-gray-600'
                  }`}
                >
                  <span className="text-gray-900 dark:text-white">
                    {info?.info ?? '--'}
                  </span>
                  <span
                    className={`${
                      info?.percentChange >= 0
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}
                  >
                    {info ? info.percentChange.toFixed(2) + '%' : ''}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-gray-500 text-center">
          See more stock market data{' '}
          <a href="/stocks" className="text-indigo-500 underline">
            here
          </a>
          .
        </p>
      </section>

      {/* Loading overlay */}
      {modalLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <p className="text-white text-lg">Loading…</p>
        </div>
      )}

      {/* Reusable popup */}
      {selectedSymbol && selectedStockData && (
        <StockQuoteModal
          stockData={selectedStockData}
          newsData={selectedNewsData}
          onClose={closeModal}
        />
      )}
    </>
  );
};

export default LiveStreamTickerWidget;
