"use client";

import React, { useState, useEffect } from "react";
import { formatDate } from "@/utils/formatters";
import FearGreedWidget from "./FearGreedWidget"; // Adjust path if needed

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
  logo?: string;
}

interface MarketWidgetsProps {
  onSelectTicker: (ticker: string) => void;
}

const CACHE_KEY = "marketWidgetsCache";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes in ms

const topTenTickers = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
  "META", "NVDA", "BRK.B", "JPM", "V",
];
const potentialTickers = [
  "AMD","NFLX","SQ","ZM","SHOP","TWLO","DOCU","FVRR","SPOT","INTC",
  "IBM","ORCL","ADBE","CSCO","QCOM","MU","HPQ","DELL",
];

export default function MarketWidgets({ onSelectTicker }: MarketWidgetsProps) {
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; t?: number } | null>(null);
  const [topTen, setTopTen] = useState<TickerData[]>([]);
  const [topGainers, setTopGainers] = useState<TickerData[]>([]);
  const [topLosers, setTopLosers] = useState<TickerData[]>([]);
  const [error, setError] = useState("");

  // Fetch both quote & profile for a ticker
  const fetchTickerData = async (ticker: string): Promise<TickerData | null> => {
    try {
      const [quoteRes, profileRes] = await Promise.all([
        fetch(`https://u-mail.co/api/finnhubProxy/quote/${ticker}`),
        fetch(`https://u-mail.co/api/finnhubProxy/profile/${ticker}`),
      ]);
      const quote = await quoteRes.json();
      const profile = await profileRes.json();
      if (quote?.c !== undefined) {
        return { symbol: ticker, quote, logo: profile.logo };
      }
    } catch (err) {
      console.error("Error fetching", ticker, err);
    }
    return null;
  };

  // Fetch market status + top lists, return data for caching
  const fetchMarketData = async (): Promise<{
    isOpen: boolean;
    data: {
      marketStatus: { isOpen: boolean; t?: number };
      topTen: TickerData[];
      topGainers: TickerData[];
      topLosers: TickerData[];
    };
  } | null> => {
    try {
      // Market status
      const statusRes = await fetch(
        `https://u-mail.co/api/finnhubProxy/market-status?exchange=US`
      );
      const statusData = await statusRes.json();
      const isOpen = !!statusData.isOpen;

      // Top 10
      const topTenResults = (
        await Promise.all(topTenTickers.map(fetchTickerData))
      ).filter((x): x is TickerData => !!x);

      // Potential universe
      const potentialResults = (
        await Promise.all(potentialTickers.map(fetchTickerData))
      ).filter((x): x is TickerData => !!x);

      // Gainers / Losers
      const gainers = potentialResults
        .filter((i) => i.quote.dp > 0)
        .sort((a, b) => b.quote.dp - a.quote.dp)
        .slice(0, 5);

      const losers = potentialResults
        .filter((i) => i.quote.dp < 0)
        .sort((a, b) => a.quote.dp - b.quote.dp)
        .slice(0, 5);

      // Update UI state
      setMarketStatus(statusData);
      setTopTen(topTenResults);
      setTopGainers(gainers);
      setTopLosers(losers);
      setError("");

      return {
        isOpen,
        data: {
          marketStatus: statusData,
          topTen: topTenResults,
          topGainers: gainers,
          topLosers: losers,
        },
      };
    } catch (err) {
      console.error(err);
      setError("Error fetching market data.");
      return null;
    }
  };

  // On mount: load cache or fetch, then schedule 15m refresh
  useEffect(() => {
    const loadCache = (): boolean => {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return false;
        const { timestamp, marketStatus, topTen, topGainers, topLosers } =
          JSON.parse(raw);
        if (Date.now() - timestamp < CACHE_TTL) {
          setMarketStatus(marketStatus);
          setTopTen(topTen);
          setTopGainers(topGainers);
          setTopLosers(topLosers);
          return true;
        }
      } catch (e) {
        console.error("Cache load error", e);
      }
      return false;
    };

    const saveCache = (data: {
      marketStatus: any;
      topTen: TickerData[];
      topGainers: TickerData[];
      topLosers: TickerData[];
    }) => {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ timestamp: Date.now(), ...data })
        );
      } catch (e) {
        console.error("Cache save error", e);
      }
    };

    const init = async () => {
      const haveCache = loadCache();
      if (!haveCache) {
        const res = await fetchMarketData();
        if (res) saveCache(res.data);
      }
      // schedule refresh every 15 minutes
      const id = setInterval(async () => {
        const res = await fetchMarketData();
        if (res) saveCache(res.data);
      }, CACHE_TTL);
      return () => clearInterval(id);
    };

    init();
  }, []);

  // Compute overall market change for Fear & Greed
  const overallMarketChange =
    topTen.length > 0
      ? topTen.reduce((sum, item) => sum + item.quote.dp, 0) / topTen.length
      : 0;

  const renderSmallTicker = (item: TickerData) => {
    const { c, dp, t } = item.quote;
    const arrow = dp >= 0 ? "▲" : "▼";
    const dpClass = dp >= 0 ? "text-green-500" : "text-red-500";
    return (
      <div
        key={item.symbol}
        className="cursor-pointer p-2 rounded shadow hover:shadow-xl transition transform hover:-translate-y-1 text-center text-xs"
        onClick={() => onSelectTicker(item.symbol)}
      >
        {item.logo && (
          <img
            src={item.logo}
            alt={`${item.symbol} logo`}
            className="mx-auto mb-1 w-6 h-6 object-contain"
          />
        )}
        <div className="font-bold">{item.symbol}</div>
        <div>
          <span className={dpClass}>${c.toFixed(2)}</span>
        </div>
        <div>
          <span className={dpClass}>
            {arrow} {dp.toFixed(2)}%
          </span>
        </div>
        {t && (
          <div className="text-gray-500 mt-1">
            Last: {formatDate(t, "short")}
          </div>
        )}
      </div>
    );
  };

  const renderTickerCard = (item: TickerData, idx: number) => {
    const { c, d, dp, h, l, o, pc, t } = item.quote;
    const arrow = dp >= 0 ? "▲" : "▼";
    const dpClass = dp >= 0 ? "text-green-500" : "text-red-500";
    return (
      <div
        key={item.symbol}
        className="cursor-pointer p-3 rounded shadow hover:shadow-xl transition transform hover:-translate-y-1 text-xs"
        onClick={() => onSelectTicker(item.symbol)}
      >
        <div className="flex items-center mb-1">
          {item.logo && (
            <img
              src={item.logo}
              alt={`${item.symbol} logo`}
              className="w-5 h-5 mr-2 object-contain"
            />
          )}
          <span className="font-bold">
            {idx + 1}. {item.symbol}
          </span>
        </div>
        <div className="mb-1">
          <span className={dpClass}>
            Price: ${c.toFixed(2)} ({arrow} ${d.toFixed(2)} / {dp.toFixed(2)}%)
          </span>
        </div>
        <div className="flex justify-between mb-1">
          <span>High: ${h.toFixed(2)}</span>
          <span>Low: ${l.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-1">
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
          Markets are {marketStatus.isOpen ? "Open" : "Closed"}{" "}
          {marketStatus.t && `| ${formatDate(marketStatus.t, "short")}`}
        </div>
      )}

      {/* Fear & Greed */}
      <FearGreedWidget index={((overallMarketChange + 3) / 6) * 100} />

      {/* Overall Market Performance */}
      {topTen.length > 0 && (
        <div
          className={`text-center text-sm font-semibold ${
            overallMarketChange > 0
              ? "text-green-600"
              : overallMarketChange < 0
              ? "text-red-600"
              : "text-gray-600"
          }`}
        >
          {overallMarketChange > 0
            ? `Overall, the markets are up today by ${overallMarketChange.toFixed(
                2
              )}%.`
            : overallMarketChange < 0
            ? `Overall, the markets are down today by ${Math.abs(
                overallMarketChange
              ).toFixed(2)}%.`
            : "Overall, the markets are unchanged today."}
        </div>
      )}

      {/* Top 10 Tickers */}
      <div className="shadow rounded p-4">
        <h3 className="text-lg font-bold mb-4">Top 10 Tickers</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 dark:bg-brand-950 bg-white">
          {topTen.map(renderSmallTicker)}
        </div>
      </div>

      {/* Top Gainers and Top Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="shadow rounded p-4">
          <h3 className="text-lg font-bold mb-4">Top Gainers</h3>
          <div className="space-y-3 dark:bg-brand-950 bg-white">
            {topGainers.map(renderTickerCard)}
          </div>
        </div>
        <div className="shadow rounded p-4">
          <h3 className="text-lg font-bold mb-4">Top Losers</h3>
          <div className="space-y-3 dark:bg-brand-950 bg-white">
            {topLosers.map(renderTickerCard)}
          </div>
        </div>
      </div>

      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}

