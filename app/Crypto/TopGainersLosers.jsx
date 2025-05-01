"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaDollarSign,
  FaChartLine,
  FaCoins,
  FaDatabase,
  FaWarehouse,
  FaChartPie,
  FaGlobeAmericas,
  FaLink,
  FaHashtag,
} from "react-icons/fa";

// Helper to format numbers
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

// If a price is under one cent, show full precision instead of "0.00"
function formatPrice(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "N/A";
  if (num > 0 && num < 0.01) {
    return num.toString();
  }
  return formatValue(value);
}

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY;
if (!API_KEY) {
  console.error(
    "🚨 Missing CoinCap API key! Set NEXT_PUBLIC_COINCAP_API_KEY in .env.local and restart."
  );
}

export default function TopGainersLosers() {
  const [cryptoData, setCryptoData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Fetch assets once and every 15s
  useEffect(() => {
    if (!API_KEY) return;
    const fetchCryptoData = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=2000&apiKey=${API_KEY}`
        );
        const { data } = await res.json();
        setCryptoData(Array.isArray(data) ? data : []);
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
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-brand-900">
        <p className="text-gray-600 dark:text-brand-200">Loading crypto data…</p>
      </div>
    );
  }

  // Sort by 24h change
  const sorted = [...cryptoData].sort(
    (a, b) =>
      parseFloat(b.changePercent24Hr) - parseFloat(a.changePercent24Hr)
  );
  const topGainers = sorted.slice(0, 15);
  const topLosers = sorted.slice(-15).reverse();

  // Table section
  const Table = ({ title, rows }) => (
    <section className="mb-8">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-brand-100 mb-2 border-b border-gray-200 dark:border-brand-700 pb-1">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-brand-900 divide-y divide-gray-100 dark:divide-brand-700">
          <thead>
            <tr className="bg-gray-50 dark:bg-brand-800">
              {["#", "Symbol", "Price", "24h %"].map((h) => (
                <th
                  key={h}
                  className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-brand-200 uppercase text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const change = parseFloat(c.changePercent24Hr);
              const positive = change >= 0;
              return (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 dark:hover:bg-brand-800 transition-colors cursor-pointer"
                  onClick={() => setSelectedAsset(c)}
                >
                  <td className="px-2 py-1 text-sm text-gray-700 dark:text-brand-100">
                    {c.rank}
                  </td>
                  <td className="px-2 py-1 text-sm text-gray-700 dark:text-brand-100">
                    {c.symbol}
                  </td>
                  <td className="px-2 py-1 text-sm text-gray-700 dark:text-brand-100">
                    ${formatPrice(c.priceUsd)}
                  </td>
                  <td
                    className={`px-2 py-1 text-sm font-medium ${
                      positive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatValue(c.changePercent24Hr)}%
                    {" "}{positive ? "↑" : "↓"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="bg-white dark:bg-brand-900 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-brand-100 text-center mb-6">
          Crypto Market Movers
        </h2>

        <Table title="Top 15 Gainers" rows={topGainers} />
        <Table title="Top 15 Losers" rows={topLosers} />

        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAsset(null)}
            >
              <motion.div
                className="relative bg-white dark:bg-brand-900 rounded-xl shadow-xl w-full max-w-md p-6 overflow-auto"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close */}
                <button
                  className="absolute top-4 right-4 text-indigo-500 hover:text-indigo-700 text-xl"
                  onClick={() => setSelectedAsset(null)}
                >
                  ✕
                </button>

                {/* Header */}
                <h3 className="text-2xl font-bold mb-1 text-gray-900 dark:text-brand-100">
                  {selectedAsset.name}
                </h3>
                <p className="text-indigo-500 mb-4">
                  #{selectedAsset.rank} • {selectedAsset.symbol.toUpperCase()}
                </p>

                {/* Metric grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Metric
                    icon={<FaDollarSign className="text-indigo-500" />}
                    label="Price"
                    value={`$${formatPrice(selectedAsset.priceUsd)}`}
                    valueColor={
                      parseFloat(selectedAsset.changePercent24Hr) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  />
                  <Metric
                    icon={<FaChartLine className="text-indigo-500" />}
                    label="24h Change"
                    value={`${formatValue(
                      selectedAsset.changePercent24Hr
                    )}%`}
                    valueColor={
                      parseFloat(selectedAsset.changePercent24Hr) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  />
                  <Metric
                    icon={<FaChartPie className="text-indigo-500" />}
                    label="Market Cap"
                    value={`$${formatValue(selectedAsset.marketCapUsd)}`}
                  />
                  <Metric
                    icon={<FaCoins className="text-indigo-500" />}
                    label="Volume (24h)"
                    value={`$${formatValue(selectedAsset.volumeUsd24Hr)}`}
                  />
                  <Metric
                    icon={<FaDatabase className="text-indigo-500" />}
                    label="Supply"
                    value={formatValue(selectedAsset.supply)}
                  />
                  <Metric
                    icon={<FaWarehouse className="text-indigo-500" />}
                    label="Max Supply"
                    value={
                      selectedAsset.maxSupply
                        ? formatValue(selectedAsset.maxSupply)
                        : "N/A"
                    }
                  />
                  <Metric
                    icon={<FaGlobeAmericas className="text-indigo-500" />}
                    label="VWAP (24h)"
                    value={
                      selectedAsset.vwap24Hr
                        ? formatValue(selectedAsset.vwap24Hr)
                        : "N/A"
                    }
                  />
                </div>

                {/* Explorer link */}
                {selectedAsset.explorer && (
                  <div className="mt-4 text-center text-sm">
                    <a
                      href={selectedAsset.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                    >
                      <FaLink /> {new URL(selectedAsset.explorer).hostname.replace(/^www\./, "")}
                    </a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Popup metric component
function Metric({ icon, label, value, valueColor = "text-gray-900" }) {
  return (
    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
      {icon}
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${valueColor}`}>{value}</span>
      </div>
    </div>
  );
}
