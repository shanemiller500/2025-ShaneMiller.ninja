"use client";

import React, { useEffect, useState } from "react";

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
    return <p className="text-center">Loading crypto data...</p>;
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
    const textColor = change >= 0 ? "text-green-600" : "text-red-600";
    return (
      <div key={crypto.id} className="border rounded p-4 shadow bg-white dark:bg-gray-800">
        <h5 className={`font-bold ${textColor}`}>
          {crypto.name} ({crypto.symbol})
        </h5>
        <p>Price: $ {parseFloat(crypto.priceUsd).toFixed(2)}</p>
        <p className={textColor}>
          24h Change: {formatSupplyValue(crypto.changePercent24Hr)}% {changeIcon}
        </p>
      </div>
    );
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Top Gainers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {topGainers.map(renderCard)}
      </div>
      <h2 className="text-xl font-bold mb-4">Top Losers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {topLosers.map(renderCard)}
      </div>
    </div>
  );
};

export default TopGainersLosers;
