"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaRocket } from "react-icons/fa";

// Helper function to format numeric values
function formatSupplyValue(value) {
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  return "Invalid value";
}

const TopGainersLosers = () => {
  const [cryptoData, setCryptoData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCryptoData = async () => {
      try {
        const response = await fetch("https://api.coincap.io/v2/assets");
        const data = await response.json();
        setCryptoData(data.data);
      } catch (error) {
        console.error("Error fetching crypto data:", error);
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

  // Sort data by 24h percent change (descending)
  const sortedData = [...cryptoData].sort(
    (a, b) =>
      parseFloat(b.changePercent24Hr) - parseFloat(a.changePercent24Hr)
  );
  const topGainers = sortedData.slice(0, 15);
  const topLosers = sortedData.slice(-15).reverse();

  const renderCard = (crypto) => {
    const change = parseFloat(crypto.changePercent24Hr);
    const changeIcon = change >= 0 ? "↑" : "↓";
    const textColor = change >= 0 ? "text-green-400" : "text-red-400";

    return (
      <motion.div
        key={crypto.id}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg transform transition-all hover:shadow-2xl"
      >
        <h5 className={`font-bold text-lg mb-2 ${textColor}`}>
          {crypto.name} ({crypto.symbol})
        </h5>
        <p className="text-gray-700 dark:text-gray-300">
          Price: $ {parseFloat(crypto.priceUsd).toFixed(2)}
        </p>
        <p className={`${textColor} font-semibold`}>
          24h Change: {formatSupplyValue(crypto.changePercent24Hr)}% {changeIcon}
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
