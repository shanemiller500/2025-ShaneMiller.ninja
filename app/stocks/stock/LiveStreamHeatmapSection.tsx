'use client';

import React, { useState, useEffect, useRef } from 'react';
import { API_TOKEN } from '@/utils/config';
import { formatDate } from '@/utils/formatters';
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import StockQuoteModal from './StockQuoteModal';          
/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const PROXY_BASE = 'https://u-mail.co/api/finnhubProxy';
const SYMBOLS = [
  'AAPL','MSFT','AMZN','GOOGL','TSLA','FB','NVDA','PYPL','ASML','ADBE','CMCSA',
  'CSCO','PEP','NFLX','AVGO','INTU','AMD','IBM','TXN','QCOM','COST','ABBV',
  'CRM','ACN','T','NKE','NEE','DHR','ORCL','UNH','FIS','BMY','LLY','CVX','LIN',
  'SBUX','HD','AMGN','MDT','HON','MO','NVO','MMM','VRTX','REGN','TMO','LMT',
  'PYPL','SBUX','NOW','ZM','MA','CME','UPS','TMUS','CHTR','SNOW',
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

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
const LiveStreamHeatmapSection: React.FC = () => {
  /* ───────────── live trade data ───────────── */
  const [tradeInfoMap,     setTradeInfoMap]     = useState<Record<string, TradeInfo>>({});
  const [symbolLogos,      setSymbolLogos]      = useState<Record<string, string>>({});
  const [symbolProfiles,   setSymbolProfiles]   = useState<Record<string, any>>({});
  const [marketStatus,     setMarketStatus]     = useState<any | null>(null);
  const [loadingSpinner,   setLoadingSpinner]   = useState(true);

  /* ───────────── modal state ───────────── */
  const [selectedSymbol,   setSelectedSymbol]   = useState<string | null>(null);
  const [selectedStockData,setSelectedStockData]= useState<any | null>(null);
  const [selectedNewsData, setSelectedNewsData] = useState<any[]>([]);
  const [modalLoading,     setModalLoading]     = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  /* ------------------------------------------------------------------ */
  /*  WebSocket & streaming trades                                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timerId = setTimeout(() => {
      socketRef.current = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);

      socketRef.current.onopen = () => {
        console.info('Heat-map socket opened');
        checkMarketStatus();
      };

      socketRef.current.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type !== 'trade' || !msg.data?.length) return;

        const { s: sym, p: priceRaw, t } = msg.data[0];
        const price = parseFloat(priceRaw);

        setTradeInfoMap((prev) => {
          const prevEntry = prev[sym];
          const pct       = prevEntry ? ((price - prevEntry.price) / prevEntry.price) * 100 : 0;
          const bgColor   =
            !prevEntry        ? 'bg-gray-100 dark:bg-gray-600'
            : price > prevEntry.price ? 'bg-green-300 dark:bg-green-700'
            : price < prevEntry.price ? 'bg-red-300 dark:bg-red-700'
            : prevEntry.bgColor;

          return {
            ...prev,
            [sym]: { timestamp: t, price, info: `$${price.toFixed(2)}`, bgColor, percentChange: pct },
          };
        });
      };

      socketRef.current.onerror = (err) => console.error('Heat-map WS error:', err);
    }, 1_000);

    return () => {
      clearTimeout(timerId);
      socketRef.current?.close();
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Market status + logo/profile preload                              */
  /* ------------------------------------------------------------------ */
  const checkMarketStatus = () => {
    fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`)
      .then((r) => r.json())
      .then((data) => {
        setMarketStatus(data);
        if (data.isOpen) {
          subscribeToSymbols();
          fetchLogos();
        }
      })
      .catch((e) => console.error('Market status error:', e));
  };

  const subscribeToSymbols = () => {
    SYMBOLS.forEach((sym) =>
      socketRef.current?.send(JSON.stringify({ type: 'subscribe', symbol: sym })),
    );
  };

  const fetchLogos = () => {
    SYMBOLS.forEach((sym, idx) => {
      setTimeout(() => {
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${API_TOKEN}`)
          .then((r) => r.json())
          .then((p) => {
            setSymbolLogos((prev)    => ({ ...prev, [sym]: p.logo }));
            setSymbolProfiles((prev) => ({ ...prev, [sym]: p }));
          })
          .catch((e) => console.error(`Profile fetch error for ${sym}:`, e));
      }, idx * 300);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Spinner fade-out                                                  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const t = setTimeout(() => setLoadingSpinner(false), 2_000);
    return () => clearTimeout(t);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Modal fetch                                                       */
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
        profileData = { ...profileData, name: sym, ticker: sym, exchange: profileData.exchange ?? '', logo: profileData.logo ?? '' };
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
return (
  <>
    <ToastContainer
      position="top-right"
      autoClose={3500}
      hideProgressBar
      pauseOnHover
      theme="dark"
    />

    {/* Page */}
    <section className="mx-auto max-w-6xl px-4 py-4 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 shadow-sm">
        {/* ambient blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-40">
          <div className="absolute -top-16 -left-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Live Stream Heatmap
            </h2>
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">
              Real-time price movement. Tap a tile for details.
            </p>
          </div>

          {marketStatus && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold ring-1 ${
                marketStatus.isOpen
                  ? "bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200"
                  : "bg-rose-500/15 text-rose-800 ring-rose-500/30 dark:text-rose-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  marketStatus.isOpen ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              {marketStatus.isOpen ? "Markets Open" : "Markets Closed"}
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
          {Object.entries(tradeInfoMap).map(([sym, info]) => {
            const logo = symbolLogos[sym];
            const up = info.percentChange >= 0;

            return (
              <motion.button
                key={sym}
                type="button"
                onClick={() => openSymbolModal(sym)}
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.03 }}
                className="relative overflow-hidden rounded-2xl p-3 sm:p-4 text-left shadow-sm ring-1 ring-black/10 dark:ring-white/10"
              >
                {/* logo background */}
                {logo && (
                  <div
                    className="absolute inset-0 bg-center bg-no-repeat bg-contain opacity-[0.22] dark:opacity-[0.22]"
                    style={{ backgroundImage: `url(${logo})` }}
                  />
                )}

                {/* color wash */}
                <div
                  className={`absolute inset-0 ${
                    up
                      ? "bg-emerald-500/15 dark:bg-emerald-600/20"
                      : "bg-rose-500/15 dark:bg-rose-600/20"
                  }`}
                />

                {/* content */}
                <div className="relative">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
                        {sym}
                      </div>
                      <div className="text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-white/70 line-clamp-1">
                        {symbolProfiles[sym]?.name || ""}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-1 py-1 text-[9px] font-extrabold ring-1 ${
                        up
                          ? "bg-emerald-500/20 text-emerald-900 ring-emerald-500/30 dark:text-emerald-200"
                          : "bg-rose-500/20 text-rose-900 ring-rose-500/30 dark:text-rose-200"
                      }`}
                    >
                      {info.percentChange.toFixed(2)}%
                    </span>
                  </div>

                  <div className="mt-3 text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                    {info.info}
                  </div>

                  
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>

    {/* Modal loading */}
    {modalLoading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="rounded-2xl bg-white/10 p-4 shadow-xl ring-1 ring-white/10">
          <div className="animate-spin h-10 w-10 border-t-4 border-indigo-400 rounded-full" />
        </div>
      </div>
    )}

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

export default LiveStreamHeatmapSection;
