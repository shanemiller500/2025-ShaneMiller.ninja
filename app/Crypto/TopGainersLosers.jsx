"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
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
} from "react-icons/fa";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { trackEvent } from "@/utils/mixpanel";  

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
  if (num > 0 && num < 0.01) return num.toString();
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

  // Chart.js refs
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Fetch top 200 assets by rank, refresh every 15s
  useEffect(() => {
    if (!API_KEY) return;
    const fetchCryptoData = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`
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

  // Draw 24h chart when selectedAsset changes
  useEffect(() => {
    if (!selectedAsset) return;
    const drawChart = async () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      const end = Date.now();
      const start = end - 24 * 60 * 60 * 1000;
      const res = await fetch(
        `https://rest.coincap.io/v3/assets/${selectedAsset.id}/history?interval=m1&start=${start}&end=${end}&apiKey=${API_KEY}`
      );
      const json = await res.json();
      const points = Array.isArray(json.data)
        ? json.data.map((e) => ({
            x: new Date(e.time),
            y: parseFloat(e.priceUsd),
          }))
        : [];
      const ctx = canvasRef.current.getContext("2d");
      chartInstanceRef.current = new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              data: points,
              borderColor: "#4cafd1",
              backgroundColor: "rgba(76,175,209,0.2)",
              pointRadius: 0,
              fill: true,
            },
          ],
        },
        options: {
          scales: {
            x: {
              type: "time",
              time: { tooltipFormat: "MMM d, HH:mm" },
              title: { display: true, text: "Time" },
            },
            y: { title: { display: true, text: "Price (USD)" } },
          },
          plugins: { legend: { display: false } },
          maintainAspectRatio: false,
        },
      });
    };
    drawChart();
  }, [selectedAsset]);

  /* ------------------------------------------------------------------ */
  /*                    Mixpanel popup open/close tracking               */
  /* ------------------------------------------------------------------ */

  // Track popup open
  useEffect(() => {
    if (selectedAsset) {
      trackEvent("CryptoAssetPopupOpen", {
        id: selectedAsset.id,
        name: selectedAsset.name,
        symbol: selectedAsset.symbol,
        rank: selectedAsset.rank,
      });
    }
  }, [selectedAsset]);

  // Unified close handler so all closes track
  const handleClosePopup = useCallback(() => {
    if (selectedAsset) {
      trackEvent("CryptoAssetPopupClose", { id: selectedAsset.id });
    }
    setSelectedAsset(null);
  }, [selectedAsset]);
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-brand-900">
        <p className="text-gray-500 dark:text-gray-400">Loading crypto data…</p>
      </div>
    );
  }

  // Sort top-200 slice by 24h change
  const sorted = [...cryptoData].sort(
    (a, b) =>
      parseFloat(b.changePercent24Hr) - parseFloat(a.changePercent24Hr)
  );
  const topGainers = sorted.slice(0, 15);
  const topLosers = sorted.slice(-15).reverse();

  // Table section
  const Table = ({ title, rows }) => (
    <section className="mb-8">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full dark:bg-brand-900 divide-y divide-gray-100 dark:divide-gray-700">
          <thead>
            <tr className="bg-gray-100 dark:bg-indigo-700">
              {["Rank", "Symbol", "Name", "Price (USD)", "24h Change"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 uppercase text-left"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const change = parseFloat(c.changePercent24Hr);
              const positive = change >= 0;
              return (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 dark:hover:bg-indigo-500 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedAsset(c);
                    trackEvent("CryptoAssetClick", { id: c.id, ...c });
                  }}
                >
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                    {c.rank}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {c.symbol}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 italic">
                    {c.name}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                    ${formatPrice(c.priceUsd)}
                  </td>
                  <td
                    className={`px-4 py-2 text-sm font-medium ${
                      positive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatValue(c.changePercent24Hr)}%
                    {positive ? " ↑" : " ↓"}
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
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mb-6">
          Crypto Market Movers
        </h2>

        <Table title="Top 15 Gainers (of Top 200)" rows={topGainers} />
        <Table title="Top 15 Losers (of Top 200)" rows={topLosers} />

        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePopup}
            >
              <motion.div
                className="relative bg-white dark:bg-brand-900 rounded-lg shadow-lg w-full max-w-md p-6 overflow-auto"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close */}
                <button
                  className="absolute top-4 right-4 text-indigo-600 hover:text-indigo-800 text-2xl"
                  onClick={handleClosePopup}
                >
                  ×
                </button>

                {/* Header */}
                <h3 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">
                  {selectedAsset.name}
                </h3>
                <p className="text-indigo-600 mb-4">
                  #{selectedAsset.rank} &bull; {selectedAsset.symbol}
                </p>

                {/* 24h Chart */}
                <div className="w-full h-48 mb-4">
                  <canvas ref={canvasRef} className="w-full h-full" />
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <Metric
                    icon={<FaDollarSign className="text-indigo-600" />}
                    label="Price"
                    value={`$${formatPrice(selectedAsset.priceUsd)}`}
                    valueColor={
                      parseFloat(selectedAsset.changePercent24Hr) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  />
                  <Metric
                    icon={<FaChartLine className="text-indigo-600" />}
                    label="24h Change"
                    value={`${formatValue(
                      selectedAsset.changePercent24Hr
                    )}%`}
                    valueColor={
                      parseFloat(selectedAsset.changePercent24Hr) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  />
                  <Metric
                    icon={<FaChartPie className="text-indigo-600" />}
                    label="Market Cap"
                    value={`$${formatValue(selectedAsset.marketCapUsd)}`}
                  />
                  <Metric
                    icon={<FaCoins className="text-indigo-600" />}
                    label="Volume (24h)"
                    value={`$${formatValue(
                      selectedAsset.volumeUsd24Hr
                    )}`}
                  />
                  <Metric
                    icon={<FaDatabase className="text-indigo-600" />}
                    label="Supply"
                    value={formatValue(selectedAsset.supply)}
                  />
                  <Metric
                    icon={<FaWarehouse className="text-indigo-600" />}
                    label="Max Supply"
                    value={
                      selectedAsset.maxSupply
                        ? formatValue(selectedAsset.maxSupply)
                        : "N/A"
                    }
                  />
                  <Metric
                    icon={<FaGlobeAmericas className="text-indigo-600" />}
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
                  <div className="mt-6 text-center text-sm">
                    <a
                      href={selectedAsset.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                    >
                      <FaLink />{" "}
                      {new URL(selectedAsset.explorer)
                        .hostname.replace(/^www\./, "")}
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
