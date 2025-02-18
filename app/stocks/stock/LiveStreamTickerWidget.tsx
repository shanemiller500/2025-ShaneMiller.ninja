"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_TOKEN } from "@/utils/config";
import { motion } from "framer-motion";

interface TradeInfo {
  timestamp: number;
  price: number;
  info: string;
  bgColor: string;
}

const LiveStreamTickerWidget: React.FC = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState<{ [symbol: string]: TradeInfo }>({});
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Define the top ten symbols to subscribe to.
  const topTenSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "NFLX"];

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Delay WebSocket initialization by 1 second.
      const timerId = setTimeout(() => {
        socketRef.current = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);

        socketRef.current.onopen = () => {
          console.info("LiveStreamTickerWidget: Socket connection opened");
          checkMarketStatus();
        };

        socketRef.current.onmessage = (event) => {
          const response = JSON.parse(event.data);
          if (response.type === "ping") return;
          if (response.type === "trade" && response.data && response.data.length > 0) {
            response.data.forEach((tradeData: any) => {
              const symbol = tradeData.s;
              // Process only if the symbol is in our top ten list.
              if (topTenSymbols.includes(symbol)) {
                const tradePrice = parseFloat(tradeData.p);
                setTradeInfoMap((prev) => {
                  const prevData = prev[symbol];
                  // Determine background color based on price change:
                  // Green if price goes up, Red if price goes down, Neutral otherwise.
                  let bgColor = "bg-gray-100 dark:bg-gray-600";
                  let pctChange = 0;
                  let arrow = "";
                  let changeText = "";
                  if (prevData) {
                    if (tradePrice > prevData.price) {
                      bgColor = "bg-green-300 dark:bg-green-700";
                    } else if (tradePrice < prevData.price) {
                      bgColor = "bg-red-300 dark:bg-red-700";
                    }
                    // Calculate the percentage change from the previous price.
                    pctChange = ((tradePrice - prevData.price) / prevData.price) * 100;
                    arrow = pctChange > 0 ? "▲" : pctChange < 0 ? "▼" : "";
                    changeText = `(${arrow} ${Math.abs(pctChange).toFixed(2)}%)`;
                  }
                  const infoStr = `$${tradePrice.toFixed(2)} ${changeText}`;
                  return {
                    ...prev,
                    [symbol]: {
                      timestamp: tradeData.t,
                      price: tradePrice,
                      info: infoStr,
                      bgColor,
                    },
                  };
                });
              }
            });
          }
        };

        socketRef.current.onerror = (error) => {
          console.error("LiveStreamTickerWidget: WebSocket error:", error);
        };
      }, 1000);

      return () => {
        clearTimeout(timerId);
        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    }
  }, []);

  // Always subscribe to symbols regardless of market status.
  const checkMarketStatus = () => {
    fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`)
      .then((res) => res.json())
      .then((data) => {
        setMarketStatus(data);
        subscribeToSymbols();
      })
      .catch((error) =>
        console.error("LiveStreamTickerWidget: Error checking market status:", error)
      );
  };

  const subscribeToSymbols = () => {
    topTenSymbols.forEach((symbol) => {
      const subscribeMsg = JSON.stringify({ type: "subscribe", symbol });
      if (socketRef.current) {
        socketRef.current.send(subscribeMsg);
        console.info(`LiveStreamTickerWidget: Subscribed to ${symbol}`);
      }
    });
  };

  return (
    <section className="mt-6 p-4 rounded shadow relative">
      {/* Render red banner if markets are closed */}
      {marketStatus && !marketStatus.isOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-900 bg-opacity-80 animate-pulse">
          <span className="text-white text-2xl font-bold">Markets are Closed</span>
        </div>
      )}
      <h2 className="text-xl font-bold mb-4">Live Stock Ticker</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {topTenSymbols.map((symbol, index) => {
          const info = tradeInfoMap[symbol];
          return (
            <motion.div
              key={symbol}
              className="p-2 text-center rounded"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="font-bold text-sm">
                {index + 1}. {symbol}
              </div>
              <div className={`text-sm mt-1 p-1 rounded ${info ? info.bgColor : "bg-gray-100 dark:bg-gray-600"}`}>
                {info ? info.info : "--"}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default LiveStreamTickerWidget;
