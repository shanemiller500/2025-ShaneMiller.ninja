"use client";

import React, { useEffect, useState, useRef } from "react";

const LiveStreamHeatmap = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket("wss://ws.coincap.io/prices?assets=ALL");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      for (const [symbol, price] of Object.entries(data)) {
        updateTradeInfo(symbol, parseFloat(price));
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      socket.close();
    };
  }, []);

  const updateTradeInfo = (symbol, price) => {
    setTradeInfoMap((prev) => {
      const prevPrice = prev[symbol]?.price;
      return {
        ...prev,
        [symbol]: {
          price,
          prevPrice,
        },
      };
    });
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Live Stream Heatmap</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Object.keys(tradeInfoMap).map((symbol) => {
          const { price, prevPrice } = tradeInfoMap[symbol];
          let bgColor = "bg-gray-200";
          if (prevPrice !== undefined) {
            if (price > prevPrice) bgColor = "bg-green-500";
            else if (price < prevPrice) bgColor = "bg-red-500";
          }
          return (
            <div
              key={symbol}
              className={`p-4 rounded shadow text-center text-white ${bgColor}`}
            >
              <h5 className="font-bold">{symbol}</h5>
              <p>${price.toFixed(2)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveStreamHeatmap;
