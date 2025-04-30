"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Helper to format percentages and prices
function formatValue(value) {
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  return "N/A";
}

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY;
if (!API_KEY) {
  console.error(
    "🚨 Missing CoinCap API key! Set NEXT_PUBLIC_COINCAP_API_KEY in .env.local and restart."
  );
}

const TopGainersLosers = () => {
  const [cryptoData, setCryptoData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch full asset list from V3
  useEffect(() => {
    if (!API_KEY) return;

    const fetchCryptoData = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=2000&apiKey=${API_KEY}`
        );
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setCryptoData(json.data);
        } else {
          console.error("Unexpected data format from CoinCap:", json);
        }
      } catch (err) {
        console.error("Error fetching crypto data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCryptoData();
    const interval = setInterval(fetchCryptoData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <p className="text-center text-xl text-white pt-20">
        Loading crypto data...
      </p>
    );
  }

  // Sort by 24h change
  const sorted = [...cryptoData].sort(
    (a, b) =>
      parseFloat(b.changePercent24Hr) - parseFloat(a.changePercent24Hr)
  );

  const topGainers = sorted.slice(0, 15);
  const topLosers = sorted.slice(-15).reverse();

  const renderCard = (c) => {
    const change = parseFloat(c.changePercent24Hr);
    const positive = change >= 0;
    return (
      <motion.div
        key={c.id}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`rounded-lg p-4 shadow-lg transform transition-all hover:shadow-2xl ${
          positive ? "bg-green-800" : "bg-red-800"
        }`}
      >
        <h5 className={`font-bold text-lg mb-2 ${positive ? "text-green-400" : "text-red-400"}`}>
          {c.name} ({c.symbol})
        </h5>
        <p className="text-gray-200">
          Price: $ {formatValue(c.priceUsd)}
        </p>
        <p className={`font-semibold ${positive ? "text-green-300" : "text-red-300"}`}>
          24h Change: {formatValue(c.changePercent24Hr)}% {positive ? "↑" : "↓"}
        </p>
      </motion.div>
    );
  };

  return (
    <div className="relative min-h-screen p-8 text-white overflow-hidden">
      <div className="relative z-20">
        <h2 className="text-3xl font-extrabold text-center mb-8">
          Crypto Market Movers
        </h2>

        <section className="mb-12">
          <h3 className="text-2xl font-bold mb-4 border-b pb-2 border-indigo-300">
            Top Gainers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {topGainers.map(renderCard)}
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-bold mb-4 border-b pb-2 border-indigo-300">
            Top Losers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {topLosers.map(renderCard)}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TopGainersLosers;
