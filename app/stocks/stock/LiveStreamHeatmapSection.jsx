"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatDate } from "@/utils/formatters";
import { motion } from "framer-motion";

// List of symbols to subscribe to
const SYMBOLS = [
  "AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "FB", "NVDA", "PYPL",
  "ASML", "ADBE", "CMCSA", "CSCO", "PEP", "NFLX", "AVGO", "INTU",
  "AMD", "IBM", "TXN", "QCOM", "COST", "ABBV", "CRM", "ACN", "T",
  "NKE", "NEE", "DHR", "ORCL", "UNH", "FIS", "BMY", "LLY", "CVX",
  "LIN", "SBUX", "HD", "AMGN", "MDT", "HON", "MO", "NVO", "MMM",
  "VRTX", "REGN", "TMO", "LMT", "PYPL", "SBUX", "NOW", "ZM", "MA",
  "CME", "UPS", "TMUS", "CHTR", "SNOW",
];

const LiveStreamHeatmapSection = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const [symbolLogos, setSymbolLogos] = useState({});
  const [symbolProfiles, setSymbolProfiles] = useState({});
  const [marketStatus, setMarketStatus] = useState(null);
  const [loadingSpinner, setLoadingSpinner] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const socketRef = useRef(null);

  // Initialize WebSocket and handle incoming trade data
  useEffect(() => {
    if (typeof window !== "undefined") {
      const timerId = setTimeout(() => {
        socketRef.current = new WebSocket(
          `wss://ws.finnhub.io?token=${API_TOKEN}`
        );

        socketRef.current.onopen = () => {
          console.info("Socket connection opened");
          checkMarketStatus();
        };

        socketRef.current.onmessage = (event) => {
          const response = JSON.parse(event.data);
          if (response.type === "trade" && response.data?.length) {
            const tradeData = response.data[0];
            const symbol = tradeData.s;
            const tradePrice = parseFloat(tradeData.p);

            setTradeInfoMap((prev) => {
              const prevData = prev[symbol];
              let bgColor = "bg-gray-100 dark:bg-gray-600";
              if (prevData) {
                if (tradePrice > prevData.price) {
                  bgColor = "bg-green-300 dark:bg-green-700";
                } else if (tradePrice < prevData.price) {
                  bgColor = "bg-red-300 dark:bg-red-700";
                }
              }
              const percentChange = prevData
                ? ((tradePrice - prevData.price) / prevData.price) * 100
                : 0;

              return {
                ...prev,
                [symbol]: {
                  timestamp: tradeData.t,
                  price: tradePrice,
                  info: "$" + tradePrice.toFixed(2),
                  bgColor,
                  percentChange,
                },
              };
            });
          }
        };

        socketRef.current.onerror = (error) => {
          console.error("WebSocket error:", error);
        };
      }, 1000);

      return () => {
        clearTimeout(timerId);
        socketRef.current?.close();
      };
    }
  }, []);

  // Check market status and trigger subscriptions and logo fetch
  const checkMarketStatus = () => {
    fetch(
      `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`
    )
      .then((res) => res.json())
      .then((data) => {
        setMarketStatus(data);
        if (data.isOpen) {
          subscribeToSymbols();
          fetchLogos();
        }
      })
      .catch((error) =>
        console.error("Error checking market status:", error)
      );
  };

  // Subscribe to trade updates for each symbol
  const subscribeToSymbols = () => {
    SYMBOLS.forEach((symbol) => {
      const msg = JSON.stringify({ type: "subscribe", symbol });
      socketRef.current.send(msg);
      console.info(`Subscribed to ${symbol}`);
    });
  };

  // Fetch and store company profiles (with a delay to avoid 429)
  const fetchLogos = () => {
    SYMBOLS.forEach((symbol, idx) => {
      setTimeout(() => {
        fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_TOKEN}`
        )
          .then((res) => res.json())
          .then((profile) => {
            setSymbolLogos((prev) => ({
              ...prev,
              [symbol]: profile.logo,
            }));
            setSymbolProfiles((prev) => ({
              ...prev,
              [symbol]: profile,
            }));
          })
          .catch((error) =>
            console.error(`Error fetching profile for ${symbol}:`, error)
          );
      }, idx * 300); // stagger requests by 300ms
    });
  };

  // Spinner for initial load
  useEffect(() => {
    const spinnerTimeout = setTimeout(() => {
      setLoadingSpinner(false);
    }, 2000);
    return () => clearTimeout(spinnerTimeout);
  }, []);

  return (
    <section className="rounded p-4 relative">
      {loadingSpinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-500"></div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">Live Stream Heatmap</h2>
      <p className="mb-4">
        A live streaming heat map. Live trades manipulate the color:
        green for up, red for down, neutral otherwise.
      </p>

      {marketStatus && (
        <div
          id="marketStatus"
          className={`mb-4 p-2 rounded ${
            marketStatus.isOpen ? "bg-green-500" : "bg-red-500"
          } text-white`}
        >
          {marketStatus.isOpen
            ? `Markets are open | Current time: ${formatDate(
                marketStatus.t,
                "short"
              )}`
            : "The markets are now closed. Check back during market hours!"}
        </div>
      )}

      <div id="tradeInfoGrid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ">
        {Object.entries(tradeInfoMap).map(([symbol, info]) => (
          <motion.div
            key={symbol}
            className="p-1 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedSymbol(symbol)}
          >
            <div className={`${info.bgColor} text-center p-3 rounded`}
            >
              {symbolLogos[symbol] && (
                <img
                  src={symbolLogos[symbol]}
                  alt={`${symbol} logo`}
                  className="h-8 w-auto mx-auto mb-1"
                />
              )}
              <h5 className="font-bold">{symbol}</h5>
              <div>{info.info}</div>
              <div
                className={`mt-1 font-semibold ${
                  info.percentChange >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {info.percentChange.toFixed(2)}%
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Popup detail modal */}
      {selectedSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900 bg-opacity-90">
          <div className="bg-white dark:bg-brand-900 p-6 rounded-lg max-w-sm w-full relative">
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
              {selectedSymbol} - {symbolProfiles[selectedSymbol]?.name || selectedSymbol}
            </h3>
            <p className="text-center text-lg mb-2">
              ${tradeInfoMap[selectedSymbol]?.price.toFixed(2)}
            </p>
            <p
              className={`text-center font-semibold mb-2 ${
                tradeInfoMap[selectedSymbol]?.percentChange >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {tradeInfoMap[selectedSymbol]?.percentChange.toFixed(2)}%
            </p>
            {symbolProfiles[selectedSymbol]?.finnhubIndustry && (
              <p className="text-center text-sm">
                Industry: {symbolProfiles[selectedSymbol].finnhubIndustry}
              </p>
            )}
            {symbolProfiles[selectedSymbol]?.weburl && (
              <a
                href={symbolProfiles[selectedSymbol].weburl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-sm block text-center mt-2"
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

export default LiveStreamHeatmapSection;
