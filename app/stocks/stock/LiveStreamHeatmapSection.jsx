"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatDate } from "@/utils/formatters";

const LiveStreamHeatmapSection = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const [marketStatus, setMarketStatus] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      socketRef.current = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);

      socketRef.current.onopen = () => {
        console.info("Socket connection opened");
        checkMarketStatus();
      };

      socketRef.current.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.type === "ping") {
          // Ignore pings.
        } else if (response.type === "trade" && response.data && response.data.length > 0) {
          const tradeData = response.data[0];
          const symbol = tradeData.s;
          const tradePrice = parseFloat(tradeData.p);
          setTradeInfoMap((prev) => {
            const prevData = prev[symbol];
            if (!prevData || tradeData.t > prevData.timestamp) {
              return {
                ...prev,
                [symbol]: {
                  timestamp: tradeData.t,
                  price: tradePrice,
                  info: "$" + tradePrice.toFixed(2),
                },
              };
            }
            return prev;
          });
        }
      };

      socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      return () => {
        if (socketRef.current) socketRef.current.close();
      };
    }
  }, []);

  const checkMarketStatus = () => {
    fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`)
      .then((res) => res.json())
      .then((data) => {
        setMarketStatus(data);
        if (data.isOpen) {
          subscribeToSymbols();
        }
      })
      .catch((error) => console.error("Error checking market status:", error));
  };

  const subscribeToSymbols = () => {
    const symbols = [
      "AAPL",
      "MSFT",
      "AMZN",
      "GOOGL",
      "TSLA",
      "FB",
      "NVDA",
      "PYPL",
      "ASML",
      "ADBE",
      "CMCSA",
      "CSCO",
      "PEP",
      "NFLX",
      "AVGO",
      "INTU",
      "AMD",
      "IBM",
      "TXN",
      "QCOM",
      "COST",
      "ABBV",
      "CRM",
      "ACN",
      "T",
      "NKE",
      "NEE",
      "DHR",
      "ORCL",
      "UNH",
      "FIS",
      "BMY",
      "LLY",
      "CVX",
      "LIN",
      "SBUX",
      "HD",
      "AMGN",
      "MDT",
      "HON",
      "MO",
      "NVO",
      "MMM",
      "VRTX",
      "REGN",
      "TMO",
      "LMT",
      "PYPL",
      "SBUX",
      "NOW",
      "ZM",
      "MA",
      "CME",
      "UPS",
      "TMUS",
      "CHTR",
      "SNOW",
    ];
    symbols.forEach((symbol) => {
      const subscribeMsg = JSON.stringify({ type: "subscribe", symbol });
      socketRef.current.send(subscribeMsg);
      console.info(`Subscribed to ${symbol}`);
    });
  };

  return (
    <section className="p-4  rounded ">
      <h2 className="text-2xl font-bold mb-4">Live Stream Heatmap</h2>
      {marketStatus && (
        <div
          id="marketStatus"
          className={`mb-4 p-2 rounded ${
            marketStatus.isOpen ? "bg-green-500" : "bg-red-500"
          } text-white`}
        >
          {marketStatus.isOpen
            ? `Market is open | Current time: ${formatDate(marketStatus.t, "short")}`
            : "The markets are now closed. Check back during market hours for the latest updates!"}
        </div>
      )}
      <div id="tradeInfoGrid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Object.keys(tradeInfoMap).map((symbol) => {
          const info = tradeInfoMap[symbol];
          return (
            <div key={symbol} id={`tradeInfo_${symbol}`} className="p-4">
              <div className=" rounded shadow p-4">
                <h5 className="font-bold">{symbol}</h5>
                <div className="mt-2 p-3 rounded bg-gray-100 dark:bg-gray-600">
                  {info.info}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LiveStreamHeatmapSection;
