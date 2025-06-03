'use client';

import React, { useState, useEffect, useRef } from 'react';
import { API_TOKEN } from '@/utils/config';
import { formatDate } from '@/utils/formatters';
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import StockQuoteModal from './StockQuoteModal';          // ⬅️  REUSABLE POPUP

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
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar pauseOnHover />

      {loadingSpinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-500"></div>
        </div>
      )}

      <section className="rounded p-4 relative">
        <h2 className="text-2xl font-bold mb-4">Live Stream Heatmap</h2>
        <p className="mb-4">
          Live trades color the grid: <span className="text-green-600 font-semibold">green</span> for up,
          <span className="text-red-600 font-semibold"> red</span> for down.
        </p>

        {marketStatus && (
          <div
            id="marketStatus"
            className={`mb-4 p-2 rounded ${
              marketStatus.isOpen ? 'bg-green-500' : 'bg-red-500'
            } text-white`}
          >
            {marketStatus.isOpen
              ? `Markets are open | Current time: ${formatDate(marketStatus.t, 'short')}`
              : 'The markets are now closed. Check back during market hours!'}
          </div>
        )}

        <div
          id="tradeInfoGrid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        >
          {Object.entries(tradeInfoMap).map(([sym, info]) => (
            <motion.div
              key={sym}
              className="p-1 cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openSymbolModal(sym)}
            >
              <div className={`${info.bgColor} text-center p-3 rounded`}>
                {symbolLogos[sym] && (
                  <img
                    src={symbolLogos[sym]}
                    alt={`${sym} logo`}
                    className="h-8 w-auto mx-auto mb-1"
                  />
                )}
                <h5 className="font-bold">{sym}</h5>
                <div>{info.info}</div>
                <div
                  className={`mt-1 font-semibold ${
                    info.percentChange >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {info.percentChange.toFixed(2)}%
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Loading overlay for modal fetch */}
      {modalLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <p className="text-white text-lg">Loading…</p>
        </div>
      )}

      {/* Shared popup component */}
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
