"use client";

import React, { useState, useEffect } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatDate } from "@/utils/formatters";

interface QuoteData {
  c: number; // current price
  d: number; // price change
  dp: number; // percent change
  h: number; // high price of the day
  l: number; // low price of the day
  o: number; // open price of the day
  pc: number; // previous close price
  t: number; // last trade timestamp (unix seconds)
}

interface TickerData {
  symbol: string;
  quote: QuoteData;
}

interface MarketWidgetsProps {
  onSelectTicker: (ticker: string) => void;
}

const MarketWidgets: React.FC<MarketWidgetsProps> = ({ onSelectTicker }) => {
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; t?: number } | null>(null);
  const [topTen, setTopTen] = useState<TickerData[]>([]);
  const [topGainers, setTopGainers] = useState<TickerData[]>([]);
  const [topLosers, setTopLosers] = useState<TickerData[]>([]);
  const [error, setError] = useState("");

  // --- Define Ticker Lists ---
  const topTenTickers = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "META",
    "NVDA",
    "BRK.B",
    "JPM",
    "V",
  ];
  const potentialTickers = [
    "AMD",
    "NFLX",
    "SQ",
    "ZM",
    "SHOP",
    "TWLO",
    "DOCU",
    "FVRR",
    "SPOT",
    "INTC",
    "IBM",
    "ORCL",
    "ADBE",
    "CSCO",
    "QCOM",
    "MU",
    "HPQ",
    "DELL",
  ];

  // --- Fetch Market Data ---
  const fetchMarketData = async (): Promise<boolean> => {
    try {
      const marketStatusUrl = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`;
      const marketStatusRes = await fetch(marketStatusUrl);
      const marketStatusData = await marketStatusRes.json();
      setMarketStatus(marketStatusData);
      const isOpen = marketStatusData.isOpen;

      const fetchQuote = async (ticker: string): Promise<TickerData | null> => {
        try {
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_TOKEN}`
          );
          const data = await res.json();
          if (data && data.c !== undefined) {
            return { symbol: ticker, quote: data };
          }
          return null;
        } catch (err) {
          console.error("Error fetching quote for", ticker, err);
          return null;
        }
      };

      // Top 10 Tickers
      const topTenPromises = topTenTickers.map((ticker) => fetchQuote(ticker));
      const topTenResults = await Promise.all(topTenPromises);
      setTopTen(topTenResults.filter(Boolean) as TickerData[]);

      // Potential gainers/losers
      const potentialPromises = potentialTickers.map((ticker) => fetchQuote(ticker));
      const potentialResults = await Promise.all(potentialPromises);
      const validResults = potentialResults.filter(Boolean) as TickerData[];

      // Top Gainers: positive dp, descending order, top 5
      const gainers = validResults
        .filter((item) => item.quote.dp > 0)
        .sort((a, b) => b.quote.dp - a.quote.dp)
        .slice(0, 5);
      setTopGainers(gainers);

      // Top Losers: negative dp, ascending order, top 5
      const losers = validResults
        .filter((item) => item.quote.dp < 0)
        .sort((a, b) => a.quote.dp - b.quote.dp)
        .slice(0, 5);
      setTopLosers(losers);

      setError("");
      return isOpen;
    } catch (err) {
      console.error(err);
      setError("Error fetching market data.");
      return false;
    }
  };

  // --- Auto-refresh every 20 seconds when market is open ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    fetchMarketData().then((isOpen) => {
      if (isOpen) {
        intervalId = setInterval(fetchMarketData, 20000);
      }
    });
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // --- Render small ticker box for Top 10 ---
  const renderSmallTicker = (item: TickerData, index: number) => {
    const { c, dp, t } = item.quote;
    const arrow = dp >= 0 ? "▲" : "▼";
    const dpClass = dp >= 0 ? "text-green-500" : "text-red-500";
    return (
      <div
        key={item.symbol}
        className="cursor-pointer p-2 rounded shadow hover:shadow-xl transition transform hover:-translate-y-1 text-center text-xs"
        onClick={() => onSelectTicker(item.symbol)}
      >
        <div className="font-bold">{item.symbol}</div>
        <div>
          Price: <span className={dpClass}>${c.toFixed(2)}</span>
        </div>
        <div>
          <span className={dpClass}>{arrow} {dp.toFixed(2)}%</span>
        </div>
        {t && (
          <div className="text-gray-500 mt-1">
            Last: {formatDate(t, "short")}
          </div>
        )}
      </div>
    );
  };

  // --- Render ticker card for Gainers/Losers ---
  const renderTickerCard = (item: TickerData, index: number) => {
    const { c, d, dp, h, l, o, pc, t } = item.quote;
    const arrow = dp >= 0 ? "▲" : "▼";
    const dpClass = dp >= 0 ? "text-green-500" : "text-red-500";
    return (
      <div
        key={item.symbol}
        className="cursor-pointer p-3 rounded shadow hover:shadow-xl transition transform hover:-translate-y-1 text-xs"
        onClick={() => onSelectTicker(item.symbol)}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold">
            {index + 1}. {item.symbol}
          </span>
          <span className={`font-semibold ${dpClass}`}>Price: ${c.toFixed(2)}</span>
        </div>
        <div className="mb-1">
          <span className={dpClass}>
            Change: {arrow} ${d.toFixed(2)} ({dp.toFixed(2)}%)
          </span>
        </div>
        <div className="flex justify-between mb-1">
          <span>High: ${h.toFixed(2)}</span>
          <span>Low: ${l.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Open: ${o.toFixed(2)}</span>
          <span>Prev: ${pc.toFixed(2)}</span>
        </div>
        {t && (
          <div className="mt-1 text-gray-500">
            Last: {formatDate(t, "short")}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Market Status Banner */}
      {marketStatus && (
        <div
          className={`p-2 rounded text-sm ${
            marketStatus.isOpen
              ? "bg-green-100 dark:bg-green-800 text-green-900 dark:text-green-100"
              : "bg-red-100 dark:bg-red-800 text-red-900 dark:text-red-100"
          }`}
        >
          Market is {marketStatus.isOpen ? "Open" : "Closed"}{" "}
          {marketStatus.t && `| ${formatDate(marketStatus.t, "short")}`}
        </div>
      )}

      {/* Top 10 Tickers along the top */}
      <div className="shadow rounded p-4">
        <h3 className="text-lg font-bold mb-4">Top 10 Tickers</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {topTen.map((item, index) => renderSmallTicker(item, index))}
        </div>
      </div>

      {/* Top Gainers and Top Losers side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="shadow rounded p-4">
          <h3 className="text-lg font-bold mb-4">Top Gainers</h3>
          <div className="space-y-3">
            {topGainers.map((item, index) => renderTickerCard(item, index))}
          </div>
        </div>
        <div className="shadow rounded p-4">
          <h3 className="text-lg font-bold mb-4">Top Losers</h3>
          <div className="space-y-3">
            {topLosers.map((item, index) => renderTickerCard(item, index))}
          </div>
        </div>
      </div>

      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default MarketWidgets;
