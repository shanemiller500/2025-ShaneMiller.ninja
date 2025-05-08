"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatDate } from "@/utils/formatters";
import { motion } from "framer-motion";

interface TradeInfo {
  timestamp: number;
  price: number;
  info: string;
  bgColor: string;
  percentChange: number;
}

const LiveStreamTickerWidget: React.FC = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeInfo>>({});
  const [symbolLogos, setSymbolLogos] = useState<Record<string, string>>({});
  const [symbolProfiles, setSymbolProfiles] = useState<Record<string, any>>({});
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const topTenSymbols = [
    "AAPL", "MSFT", "AMZN", "GOOGL", "TSLA",
    "META", "NVDA", "JPM", "V", "NFLX"
  ];

  // Fetch logos and profiles on mount
  useEffect(() => {
    topTenSymbols.forEach((symbol, idx) => {
      setTimeout(() => {
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_TOKEN}`)
          .then(res => res.json())
          .then(profile => {
            setSymbolLogos(prev => ({ ...prev, [symbol]: profile.logo }));
            setSymbolProfiles(prev => ({ ...prev, [symbol]: profile }));
          })
          .catch(err => console.error(`Profile fetch error for ${symbol}:`, err));
      }, idx * 200);
    });
  }, []);

  // Initialize WebSocket
  useEffect(() => {
    const timer = setTimeout(() => {
      socketRef.current = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);

      socketRef.current.onopen = () => {
        console.info("Socket opened");
        checkMarketStatus();
      };

      socketRef.current.onmessage = evt => {
        const msg = JSON.parse(evt.data);
        if (msg.type === "trade" && msg.data?.length) {
          const trade = msg.data[0];
          const symbol = trade.s;
          if (!topTenSymbols.includes(symbol)) return;

          const price = parseFloat(trade.p);
          setTradeInfoMap(prev => {
            const prevEntry = prev[symbol];
            let bgColor = "bg-gray-100 dark:bg-gray-600";
            if (prevEntry) {
              if (price > prevEntry.price) bgColor = "bg-green-300 dark:bg-green-700";
              else if (price < prevEntry.price) bgColor = "bg-red-300 dark:bg-red-700";
            }
            const pct = prevEntry
              ? ((price - prevEntry.price) / prevEntry.price) * 100
              : 0;

            return {
              ...prev,
              [symbol]: {
                timestamp: trade.t,
                price,
                info: `$${price.toFixed(2)}`,
                bgColor,
                percentChange: pct,
              },
            };
          });
        }
      };

      socketRef.current.onerror = err => {
        console.error("WebSocket error:", err);
      };
    }, 1000);

    return () => {
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, []);

  // Market status & subscribe
  const checkMarketStatus = () => {
    fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`)
      .then(res => res.json())
      .then(data => {
        setMarketStatus(data);
        if (data.isOpen) {
          topTenSymbols.forEach(symbol => {
            socketRef.current?.send(JSON.stringify({ type: "subscribe", symbol }));
          });
        }
      })
      .catch(err => console.error("Market status error:", err));
  };

  return (
    <section className="mt-6 p-4 rounded shadow relative">
      <h2 className="text-xl font-bold mb-4">Live Stock Ticker</h2>


      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {topTenSymbols.map((symbol, idx) => {
          const info = tradeInfoMap[symbol];
          return (
            <motion.div
              key={symbol}
              className="p-2 text-center rounded cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedSymbol(symbol)}
            >
              {symbolLogos[symbol] && (
                <img
                  src={symbolLogos[symbol]}
                  alt={`${symbol} logo`}
                  className="mx-auto mb-1 w-6 h-6 object-contain"
                />
              )}
              <div className="font-bold text-sm">{idx + 1}. {symbol}</div>
              <div className={`${info?.bgColor ?? "bg-gray-100 dark:bg-gray-600"} mt-1 p-1 rounded text-sm`}>
                {info?.info ?? "--"}
              </div>
              <div className={`mt-1 text-sm font-semibold ${
                info?.percentChange >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {info ? info.percentChange.toFixed(2) + "%" : ""}
              </div>
            </motion.div>
          );
        })}
      </div>

      {selectedSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white dark:bg-brand-900 p-6 rounded-lg max-w-xs w-full relative">
            <button
              onClick={() => setSelectedSymbol(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
            >×</button>

            {symbolProfiles[selectedSymbol]?.logo && (
              <img
                src={symbolProfiles[selectedSymbol].logo}
                alt={`${selectedSymbol} logo`}
                className="h-12 w-auto mx-auto mb-4"
              />
            )}

            <h3 className="text-xl font-bold text-center mb-2">
              {selectedSymbol} — {symbolProfiles[selectedSymbol]?.name || selectedSymbol}
            </h3>

            <p className="text-center text-lg mb-1">
              ${tradeInfoMap[selectedSymbol]?.price.toFixed(2)}
            </p>

            <p className={`text-center font-semibold mb-2 ${
              tradeInfoMap[selectedSymbol]?.percentChange >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}>
              {tradeInfoMap[selectedSymbol]?.percentChange.toFixed(2)}%
            </p>

            {symbolProfiles[selectedSymbol]?.finnhubIndustry && (
              <p className="text-center text-sm mb-1">
                Industry: {symbolProfiles[selectedSymbol].finnhubIndustry}
              </p>
            )}

            {symbolProfiles[selectedSymbol]?.weburl && (
              <a
                href={symbolProfiles[selectedSymbol].weburl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-blue-600 underline text-sm"
              >
                Visit Website
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default LiveStreamTickerWidget;
