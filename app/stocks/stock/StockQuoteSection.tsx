"use client";

import React, { useState, useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns"; // <-- Import date adapter for time scales
import { API_TOKEN } from "@/utils/config";
import {
  formatSupplyValue,
  formatDate,
  formatDateWeirdValue,
} from "@/utils/formatters";
import MarketWidgets from "./MarketWidgets";
import NewsWidget from "./NewsWidget";
import LiveStreamTickerWidget from "./LiveStreamTickerWidget";
import FearGreedWidget from "./FearGreedWidget";

interface CandleData {
  c: number[]; // closing prices
  h: number[]; // high prices
  l: number[]; // low prices
  o: number[]; // open prices
  s: string;   // status ("ok" if successful)
  t: number[]; // timestamps (unix seconds)
  v: number[]; // volumes
}

const StockQuoteSection = () => {
  const [symbolInput, setSymbolInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [stockData, setStockData] = useState<any>(null);
  const [newsData, setNewsData] = useState<any[]>([]);
  const [candleData, setCandleData] = useState<CandleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [fearGreedIndex, setFearGreedIndex] = useState<number>(50);

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // --- Define Top 10 Tickers for Overall Market Sentiment ---
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

  // --- Fetch Overall Market Quotes for Fear & Greed Index ---
  const fetchOverallMarketChange = async () => {
    try {
      const promises = topTenTickers.map((ticker) =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_TOKEN}`).then(
          (res) => res.json()
        )
      );
      const results = await Promise.all(promises);
      // Filter valid results (ensure current price exists)
      const validResults = results.filter((data) => data && data.c !== undefined);
      if (validResults.length > 0) {
        // Calculate average percent change (dp)
        const averageChange =
          validResults.reduce((sum, data) => sum + data.dp, 0) / validResults.length;
        // Map from -3% (Extreme Fear) to +3% (Extreme Greed)
        let index = ((averageChange + 3) / 6) * 100;
        if (index < 0) index = 0;
        if (index > 100) index = 100;
        setFearGreedIndex(index);
      }
    } catch (err) {
      console.error("Error fetching overall market quotes:", err);
    }
  };

  // --- Fetch Overall Market Change on Mount ---
  useEffect(() => {
    fetchOverallMarketChange();
  }, []);

  // --- Autocomplete Suggestions (debounced) ---
  useEffect(() => {
    if (symbolInput.trim().length > 0) {
      const timer = setTimeout(() => {
        fetch(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(
            symbolInput
          )}&token=${API_TOKEN}`
        )
          .then((res) => res.json())
          .then((data) => {
            if (data && data.result) {
              setSuggestions(data.result.map((item: any) => item.symbol));
            }
          })
          .catch((err) => console.error(err));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [symbolInput]);

  // --- Fetch Candle Data Helper ---
  const fetchCandleData = (
    symbol: string,
    resolution: string,
    from: number,
    to: number
  ): Promise<CandleData | null> => {
    const candleUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${API_TOKEN}`;
    return fetch(candleUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.s === "ok") {
          return data;
        } else {
          return null;
        }
      })
      .catch((err) => {
        console.error(err);
        return null;
      });
  };

  // --- Main Search Handler with Local Storage Caching ---
  const handleSearch = async (symbolParam?: string) => {
    const symbolToSearch = symbolParam || symbolInput;
    if (!symbolToSearch) return;
    setLoading(true);
    setError("");

    const cacheKey = `stockSearchCache_${symbolToSearch.toUpperCase()}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsedCache = JSON.parse(cachedData);
      const oneDay = 24 * 60 * 60 * 1000;
      if (Date.now() - parsedCache.timestamp < oneDay) {
        setStockData(parsedCache.stockData);
        setCandleData(parsedCache.candleData);
        setNewsData(parsedCache.newsData);
        setCurrentSymbol(symbolToSearch.toUpperCase());
        setLoading(false);
        return;
      }
    }

    // Build API endpoints
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbolToSearch}&token=${API_TOKEN}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbolToSearch}&token=${API_TOKEN}`;
    const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbolToSearch}&metric=all&token=${API_TOKEN}`;
    const marketStatusUrl = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`;

    try {
      const [quoteData, profileData, metricData, marketStatusData] =
        await Promise.all([
          fetch(quoteUrl).then((res) => res.json()),
          fetch(profileUrl).then((res) => res.json()),
          fetch(metricUrl).then((res) => res.json()),
          fetch(marketStatusUrl).then((res) => res.json()),
        ]);

      if (!profileData.name || !profileData.ticker) {
        setError("Invalid symbol or data not available.");
        setLoading(false);
        return;
      }

      const priceColor =
        marketStatusData.isOpen && quoteData.c > quoteData.o
          ? "green"
          : marketStatusData.isOpen && quoteData.c <= quoteData.o
          ? "red"
          : "#494949";
      const iconClass =
        quoteData.c > quoteData.o
          ? "fa fa-angle-double-up"
          : "fa fa-angle-double-down";

      const stockInfo = {
        description: profileData.name,
        stockSymbol: profileData.ticker,
        logo: profileData.logo,
        quoteData,
        metricData,
        marketStatusData,
        priceColor,
        iconClass,
      };
      setStockData(stockInfo);
      setCurrentSymbol(symbolToSearch.toUpperCase());

      // --- Fetch Candle Data (Last 30 Days) ---
      const nowUnix = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = nowUnix - 30 * 24 * 60 * 60;
      const fetchedCandleData = await fetchCandleData(
        symbolToSearch,
        "D",
        thirtyDaysAgo,
        nowUnix
      );
      setCandleData(fetchedCandleData);

      // --- Fetch Company News (Last 24 Hours) ---
      const fromDate = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      const toDate = new Date().toISOString().slice(0, 10);
      const newsResponse = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${symbolToSearch}&from=${fromDate}&to=${toDate}&token=${API_TOKEN}`
      )
        .then((res) => res.json())
        .catch((err) => {
          console.error(err);
          return [];
        });
      setNewsData(newsResponse);

      // Save to local storage with a timestamp
      const cacheToSave = {
        timestamp: Date.now(),
        stockData: stockInfo,
        candleData: fetchedCandleData,
        newsData: newsResponse,
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheToSave));

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Error fetching data.");
      setLoading(false);
    }
  };

  // --- Clear Search Handler ---
  const handleClear = () => {
    setSymbolInput("");
    setSuggestions([]);
    setStockData(null);
    setNewsData([]);
    setCandleData(null);
    setError("");
    if (currentSymbol) {
      const cacheKey = `stockSearchCache_${currentSymbol}`;
      localStorage.removeItem(cacheKey);
    }
  };

  // --- Handle ticker click from widgets ---
  const handleTickerClick = (ticker: string) => {
    setSymbolInput(ticker);
    handleSearch(ticker);
  };

  // --- Render Chart When Candle Data Updates ---
  useEffect(() => {
    if (
      chartCanvasRef.current &&
      candleData &&
      candleData.t &&
      candleData.c &&
      candleData.t.length > 0
    ) {
      const ctx = chartCanvasRef.current.getContext("2d");
      if (!ctx) return;

      // Destroy previous chart if exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // Determine time unit based on the data range
      let timeUnit: "minute" | "day" = "day";
      const diff = candleData.t[candleData.t.length - 1] - candleData.t[0];
      if (diff < 6 * 60 * 60) {
        timeUnit = "minute";
      }

      // Prepare labels and data points
      const labels = candleData.t.map((timestamp) => new Date(timestamp * 1000));
      const dataPoints = candleData.c;

      chartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Closing Price (USD)",
              data: dataPoints,
              borderColor: "rgb(75, 192, 192)",
              backgroundColor: "rgba(75, 192, 192, 0.1)",
              fill: true,
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
          },
          scales: {
            x: {
              type: "time",
              time: {
                unit: timeUnit,
                tooltipFormat: timeUnit === "day" ? "MMM d, yyyy" : "HH:mm",
                displayFormats: {
                  day: "MMM d",
                  minute: "HH:mm",
                },
              },
              title: { display: true, text: "Date" },
            },
            y: {
              title: { display: true, text: "Price (USD)" },
            },
          },
        },
      });
    }
  }, [candleData]);

  // --- Determine Price Color for Text ---
  const priceColorClass =
    stockData &&
    parseFloat(stockData.quoteData.c) >= parseFloat(stockData.quoteData.o)
      ? "text-green-500"
      : "text-red-500";

  return (
    <section className="p-4 rounded mb-8">
      <h2 className="text-2xl font-bold mb-4">Stock Quote</h2>

      {/* --- Search Input & Suggestions --- */}
      <div className="mb-4">
        
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          placeholder="Enter stock symbol"
          className="p-2 border border-gray-300 rounded w-full md:w-1/3 dark:border-gray-600 dark:bg-brand-900"
        />
        {suggestions.length > 0 && (
          <ul className="list-none p-0 mt-2 border border-gray-200 rounded dark:border-gray-700">
            {suggestions.map((sugg, index) => (
              <li
                key={index}
                className="cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => {
                  setSymbolInput(sugg);
                  setSuggestions([]);
                }}
              >
                {sugg}
              </li>
            ))}
            
          </ul>
        )}

      </div>
      

      {/* --- Action Buttons --- */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => handleSearch()}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded hover:from-indigo-600 hover:to-purple-600 focus:outline-none"
        >
          Search
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
        >
          Clear
        </button>
      </div>

      {/* --- Display Widgets When No Stock Data (Nothing Searched) --- */}
      {!stockData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <MarketWidgets onSelectTicker={handleTickerClick} />
            <div>
              <NewsWidget />
            </div>
          </div>
          <LiveStreamTickerWidget />
        </>
      )}

      {loading && <p className="text-center mt-4">Loading...</p>}
      {error && <p className="text-center mt-4 text-red-500">{error}</p>}

      {stockData && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
    
    {/* — Stock Info Card (transparent background, professional table) — */}
<div className="rounded-lg shadow-md p-6 max-w-4xl mx-auto">
  {/* Header (unchanged) */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
    <div className="flex items-center space-x-4">
      <div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
          {stockData.description} <span className="font-normal">({stockData.stockSymbol})</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {stockData.marketStatusData.isOpen ? "Market Open" : "Market Closed"} • As of{" "}
          {formatDate(stockData.marketStatusData.t)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Exchange: {stockData.marketStatusData.exchange}
        </p>
      </div>
      {stockData.logo && (
        <img
          src={stockData.logo}
          alt="Stock Logo"
          className="hidden sm:block w-12 h-12 md:w-16 md:h-16 object-contain rounded-full"
        />
      )}
    </div>
    <div className="mt-4 md:mt-0 text-right">
      <p
        className={`text-2xl font-bold ${
          stockData.quoteData.dp >= 0 ? "text-green-600" : "text-red-600"
        }`}
      >
        ${formatSupplyValue(stockData.quoteData.c)}
      </p>
      <p
        className={`mt-1 text-sm font-semibold inline-flex items-center ${
          stockData.quoteData.dp >= 0 ? "text-green-500" : "text-red-500"
        }`}
      >
        {stockData.quoteData.dp >= 0 ? "+" : ""}
        {formatSupplyValue(stockData.quoteData.dp)}% <i className={stockData.iconClass} />
      </p>
    </div>
  </div>

  {/* Details Table */}
  <div className="overflow-x-auto">
    <table className="w-full table-auto border-collapse">
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {[
          ["Current Price", `$${formatSupplyValue(stockData.quoteData.c)} • ${formatSupplyValue(stockData.quoteData.dp)}%`],
          ["Open Price", `$${formatSupplyValue(stockData.quoteData.o)}`],
          ["High Price", `$${formatSupplyValue(stockData.quoteData.h)}`],
          ["Low Price", `$${formatSupplyValue(stockData.quoteData.l)}`],
          ["52-Week High", `$${formatSupplyValue(stockData.metricData.metric["52WeekHigh"])}`],
          ["52-Week High Date", formatDateWeirdValue(stockData.metricData.metric["52WeekHighDate"])],
          ["52-Week Low", `$${formatSupplyValue(stockData.metricData.metric["52WeekLow"])}`],
          ["52-Week Low Date", formatDateWeirdValue(stockData.metricData.metric["52WeekLowDate"])],
          ["Market Cap", `$${formatSupplyValue(stockData.metricData.metric["marketCapitalization"])}`],
          ["EPS (TTM)", `$${formatSupplyValue(stockData.metricData.metric["epsTTM"])}`],
        ].map(([label, value]) => (
          <tr key={label} className="grid grid-cols-2 md:table-row py-3">
            <th className="text-left text-sm font-medium text-gray-500 dark:text-gray-400">
              {label}
            </th>
            <td className="text-right text-sm text-gray-900 dark:text-gray-100">
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>


          {/* --- Right Column: Chart, Fear & Greed Index, & News --- */}
          <div>

            {/* --- News Widget --- */}
            <NewsWidget />
          </div>
        </div>
      )}
    </section>
  );
};

export default StockQuoteSection;
