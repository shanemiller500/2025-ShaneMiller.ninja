"use client";

import React, { useState, useEffect } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatDate } from "@/utils/formatters";

const NewsSearchTabSection = () => {
  const [symbol, setSymbol] = useState("");
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNews = (sym) => {
    setLoading(true);
    const fromDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const toDate = new Date().toISOString().slice(0, 10);
    fetch(`https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${fromDate}&to=${toDate}&token=${API_TOKEN}`)
      .then((res) => res.json())
      .then((data) => {
        setNewsList(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  // On initial load, fetch general news
  useEffect(() => {
    fetch(`https://finnhub.io/api/v1/news?category=general&token=${API_TOKEN}`)
      .then((res) => res.json())
      .then((data) => setNewsList(data))
      .catch((err) => console.error(err));
  }, []);

  const handleSearch = () => {
    if (symbol) {
      fetchNews(symbol);
    }
  };

  return (
    <section className="p-4 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">News Search</h2>
      <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
        <input
          type="text"
          value={symbol}
          placeholder="Enter stock symbol"
          onChange={(e) => setSymbol(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full sm:w-auto dark:border-gray-600 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded hover:bg-gradient-to-r from-indigo-600 to-purple-600 focus:outline-none"
        >
          Search News
        </button>
      </div>
      {loading && <p className="text-center">Loading news...</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {newsList && newsList.length > 0 ? (
          newsList.map((news, index) => (
            <div key={index} className="border border-gray-300 dark:border-gray-700 rounded overflow-hidden">
              {news.image && news.image !== "" && (
                <img src={news.image} alt="News" className="w-full h-48 object-cover" />
              )}
              <div className="p-4">
                <h5 className="text-lg font-bold">{news.category}</h5>
                <p className="text-sm">Released: {formatDate(news.datetime)}</p>
                <p className="text-sm">Related: {news.related}</p>
                <p className="text-sm">Source: {news.source}</p>
                <p className="text-sm">Summary: {news.summary}</p>
                <a
                  className="text-indigo-500 hover:underline"
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read More
                </a>
              </div>
            </div>
          ))
        ) : (
          <p className="col-span-2 text-center">No news found for the selected symbol.</p>
        )}
      </div>
    </section>
  );
};

export default NewsSearchTabSection;
