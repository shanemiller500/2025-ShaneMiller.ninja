"use client";

import React, { useState, useEffect } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatSupplyValue, formatDate, formatDateWeirdValue } from "@/utils/formatters";

const StockQuoteSection = () => {
  const [symbolInput, setSymbolInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [stockData, setStockData] = useState(null);
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Autocomplete suggestions with debounce
  useEffect(() => {
    if (symbolInput.trim().length > 0) {
      const timer = setTimeout(() => {
        fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(symbolInput)}&token=${API_TOKEN}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.result) {
              setSuggestions(data.result.map((item) => item.symbol));
            }
          })
          .catch((err) => console.error(err));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [symbolInput]);

  const handleSearch = () => {
    if (!symbolInput) return;
    setLoading(true);
    setError("");

    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbolInput}&token=${API_TOKEN}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbolInput}&token=${API_TOKEN}`;
    const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbolInput}&metric=all&token=${API_TOKEN}`;
    const marketStatusUrl = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`;

    Promise.all([
      fetch(quoteUrl).then((res) => res.json()),
      fetch(profileUrl).then((res) => res.json()),
      fetch(metricUrl).then((res) => res.json()),
      fetch(marketStatusUrl).then((res) => res.json()),
    ])
      .then(([quoteData, profileData, metricData, marketStatusData]) => {
        if (!profileData.name || !profileData.ticker) {
          setError("WHAT THE HELL EVEN IS THAT?? Just kidding – invalid symbol or data not available.");
          setLoading(false);
          return;
        }

        const priceColor = marketStatusData.isOpen
          ? quoteData.c > quoteData.o
            ? "green"
            : "red"
          : "#494949";
        const iconClass = quoteData.c > quoteData.o ? "fa fa-angle-double-up" : "fa fa-angle-double-down";

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

        // Fetch company news
        const fromDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const toDate = new Date().toISOString().slice(0, 10);
        fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbolInput}&from=${fromDate}&to=${toDate}&token=${API_TOKEN}`)
          .then((res) => res.json())
          .then((news) => {
            setNewsData(news);
            setLoading(false);
          })
          .catch((err) => {
            console.error(err);
            setLoading(false);
          });
      })
      .catch((err) => {
        console.error(err);
        setError("Error fetching data.");
        setLoading(false);
      });
  };

  return (
    <section className="p-4  rounded  mb-8">
      <h2 className="text-2xl font-bold mb-4">Stock Quote</h2>
      <div className="mb-4">
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          placeholder="Enter stock symbol"
          className="p-2 border border-gray-300 rounded w-full text-brand-900 md:w-1/3 dark:border-gray-600"
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
      <button
        onClick={handleSearch}
        className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 focus:outline-none"
      >
        Search
      </button>
      {loading && <p className="text-center mt-4">Loading...</p>}
      {error && <p className="text-center mt-4 text-red-500">{error}</p>}
      {stockData && (
        <div className="mt-6">
          <div className="stock-info mb-4">
            <h2 className="text-xl font-semibold">
              {stockData.description} ({stockData.stockSymbol})
              {stockData.logo && (
                <img
                  src={stockData.logo}
                  alt="Stock Logo"
                  className="float-right max-w-xs max-h-56 ml-4"
                />
              )}
            </h2>
            <h2 className="text-2xl font-bold" style={{ color: stockData.priceColor }}>
              ${formatSupplyValue(stockData.quoteData.c)} | {formatSupplyValue(stockData.quoteData.dp)}%{" "}
              <i className={stockData.iconClass}></i>
            </h2>
            <p>
              {stockData.marketStatusData.isOpen ? "Market Open" : "Market Closed"} | As of:{" "}
              {formatDate(stockData.marketStatusData.t)}
            </p>
            <p>Exchange: {stockData.marketStatusData.exchange}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 dark:border-gray-700">
              <tbody>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                  <td className="p-2 text-sm font-semibold" style={{ color: stockData.priceColor }}>
                    Current Price:
                  </td>
                  <td className="p-2 text-sm" style={{ color: stockData.priceColor }}>
                    ${formatSupplyValue(stockData.quoteData.c)} | {formatSupplyValue(stockData.quoteData.dp)}%{" "}
                    <i className={stockData.iconClass}></i>
                  </td>
                  <td className="p-2 text-sm font-semibold">Open Price</td>
                  <td className="p-2 text-sm">${formatSupplyValue(stockData.quoteData.o)}</td>
                </tr>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                  <td className="p-2 text-sm font-semibold">High Price:</td>
                  <td className="p-2 text-sm">${formatSupplyValue(stockData.quoteData.h)}</td>
                  <td className="p-2 text-sm font-semibold">Low Price:</td>
                  <td className="p-2 text-sm">${formatSupplyValue(stockData.quoteData.l)}</td>
                </tr>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                  <td className="p-2 text-sm font-semibold">52 Week High:</td>
                  <td className="p-2 text-sm">${formatSupplyValue(stockData.metricData.metric["52WeekHigh"])}</td>
                  <td className="p-2 text-sm font-semibold">52 Week High Date:</td>
                  <td className="p-2 text-sm">{formatDateWeirdValue(stockData.metricData.metric["52WeekHighDate"])}</td>
                </tr>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                  <td className="p-2 text-sm font-semibold">52 Week Low:</td>
                  <td className="p-2 text-sm">${formatSupplyValue(stockData.metricData.metric["52WeekLow"])}</td>
                  <td className="p-2 text-sm font-semibold">52 Week Low Date:</td>
                  <td className="p-2 text-sm">{formatDateWeirdValue(stockData.metricData.metric["52WeekLowDate"])}</td>
                </tr>
                <tr>
                  <td className="p-2 text-sm font-semibold">Market Cap:</td>
                  <td className="p-2 text-sm">${formatSupplyValue(stockData.metricData.metric["marketCapitalization"])}</td>
                  <td className="p-2 text-sm font-semibold">EPS TTM:</td>
                  <td className="p-2 text-sm">${formatSupplyValue(stockData.metricData.metric["epsTTM"])}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {newsData && newsData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4">Latest News</h3>
              {newsData.slice(0, 5).map((newsItem, index) => (
                <div key={index} className="mb-4 border border-gray-300 dark:border-gray-700 rounded overflow-hidden">
                  <div className="p-4 ">
                    <h5 className="text-lg font-semibold">{newsItem.headline}</h5>
                    <p className="text-sm">Release date: {formatDate(newsItem.datetime)}</p>
                    {newsItem.image && (
                      <img
                        src={newsItem.image}
                        alt="News"
                        className="w-40 h-40 object-cover float-right ml-4"
                      />
                    )}
                    <p className="text-sm">{newsItem.summary}</p>
                    <p className="text-sm">Source: {newsItem.source}</p>
                    <a
                      className="text-indigo-500 hover:underline"
                      href={newsItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read More
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default StockQuoteSection;
