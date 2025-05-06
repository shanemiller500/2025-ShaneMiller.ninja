"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
  FaTable,
  FaThLarge,
} from "react-icons/fa";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { trackEvent } from "@/utils/mixpanel";

/* ---------- small helpers ---------- */
const formatValue = (v) => {
  const n = parseFloat(v);
  return isNaN(n)
    ? "N/A"
    : n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};
const formatPrice = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "N/A";
  if (n > 0 && n < 0.01) return n.toString();
  return formatValue(v);
};

/* -------- component starts --------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";

export default function TopGainersLosers() {
  const [cryptoData, setCryptoData] = useState([]);        // always an array
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [viewMode, setViewMode] = useState("table");       // "table" | "grid"

  /* chart refs */
  const canvasRef   = useRef(null);
  const chartRef    = useRef(null);

  /* -------- fetch every 15 s -------- */
  useEffect(() => {
    if (!API_KEY) return;

    const load = async () => {
      try {
        const res  = await fetch(`https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`);
        const json = await res.json();
        setCryptoData(Array.isArray(json.data) ? json.data : []);  // guard
      } catch (e) {
        console.error("CoinCap fetch error:", e);
        setCryptoData([]);
      } finally {
        setLoading(false);
      }
    };

    load();                                   // first fetch
    const iv = setInterval(load, 15000);      // refresh
    return () => clearInterval(iv);
  }, []);

  /* ------------ derived lists ------------- */
  const sorted = useMemo(() => {
    const arr = Array.isArray(cryptoData) ? cryptoData : [];
    return [...arr].sort(
      (a, b) =>
        parseFloat(b?.changePercent24Hr ?? 0) - parseFloat(a?.changePercent24Hr ?? 0)
    );
  }, [cryptoData]);

  const topGainers = sorted.slice(0, 15);
  const topLosers  = sorted.slice(-15).reverse();

  /* ------------ popup chart -------------- */
  useEffect(() => {
    if (!selectedAsset) return;
  
    const drawChart = async () => {
      // clear any previous instance
      if (chartRef.current) {
        chartRef.current.destroy();
      }
  
      // fetch 24-hour history
      const end   = Date.now();
      const start = end - 24 * 60 * 60 * 1000;
      const res   = await fetch(
        `https://rest.coincap.io/v3/assets/${selectedAsset.id}/history?interval=m1&start=${start}&end=${end}&apiKey=${API_KEY}`
      );
      const json  = await res.json();
  
      // build points array
      const points = Array.isArray(json.data)
        ? json.data.map((p) => ({
            x: new Date(p.time),        // Date object for time scale
            y: parseFloat(p.priceUsd),  // numeric price
          }))
        : [];
  
      // draw chart
      const ctx = canvasRef.current.getContext("2d");
      chartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Price (USD)",
              data: points,
              borderColor: "rgb(132, 226, 255)",
              backgroundColor: "rgba(84, 75, 255, 0.62)",
              pointRadius: 0,
              fill: true,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              type: "time",
              time: { tooltipFormat: "MMM d, HH:mm" },
              title: { display: true, text: "Time" },
            },
            y: {
              title: { display: true, text: "Price (USD)" },
            },
          },
        },
      });
    };
  
    drawChart();
  }, [selectedAsset]);
  /* ------------- mixpanel + close handler ------------- */
  useEffect(() => {
    if (selectedAsset) {
      trackEvent("CryptoAssetPopupOpen", { id: selectedAsset.id });
    }
  }, [selectedAsset]);

  const closePopup = useCallback(() => {
    if (selectedAsset) trackEvent("CryptoAssetPopupClose", { id: selectedAsset.id });
    setSelectedAsset(null);
  }, [selectedAsset]);

  /* ------------- toggle view --------------- */
  const toggleView = () => {
    const next = viewMode === "table" ? "grid" : "table";
    setViewMode(next);
    trackEvent("CryptoViewToggle", { view: next });
  };

  /* --------------- UI pieces --------------- */
  const Metric = ({ icon, label, value, color = "text-gray-900" }) => (
    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
      {icon}
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${color}`}>{value}</span>
      </div>
    </div>
  );

  const TableRows = ({ rows }) =>
    rows.map((c) => {
      const pos = parseFloat(c.changePercent24Hr) >= 0;
      return (
        <tr
          key={c.id}
          className="hover:bg-gray-50 dark:hover:bg-indigo-500 cursor-pointer"
          onClick={() => {
            setSelectedAsset(c);
            trackEvent("CryptoAssetClick", { id: c.id });
          }}
        >
          <td className="px-4 py-2 text-sm">{c.rank}</td>
          <td className="px-4 py-2 text-sm font-semibold">{c.symbol}</td>
          <td className="px-4 py-2 text-sm italic">{c.name}</td>
          <td className="px-4 py-2 text-sm">${formatPrice(c.priceUsd)}</td>
          <td className={`px-4 py-2 text-sm ${pos ? "text-green-600" : "text-red-600"}`}>
            {formatValue(c.changePercent24Hr)}% {pos ? "↑" : "↓"}
          </td>
        </tr>
      );
    });

  const GridCards = ({ rows }) =>
    rows.map((c) => {
      const change = parseFloat(c.changePercent24Hr);
      const bg =
        change > 0 ? "bg-green-500" : change < 0 ? "bg-red-500" : "bg-gray-400";
      return (
        <motion.div
          key={c.id}
          className={`${bg} text-white p-3 rounded-lg shadow cursor-pointer`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setSelectedAsset(c);
            trackEvent("CryptoAssetClick", { id: c.id });
          }}
        >
          <div className="flex items-center gap-1">
            <span className="text-xs bg-black bg-opacity-40 px-1 rounded">#{c.rank}</span>
            <span className="font-bold text-lg">{c.symbol}</span>
          </div>
          <div className="mt-1 text-sm">${formatPrice(c.priceUsd)}</div>
          <div className="text-xs opacity-80">{formatValue(change)}%</div>
        </motion.div>
      );
    });

  /* --------------- render --------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading crypto data…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Crypto Market Movers</h1>
          <button
            onClick={toggleView}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded"
          >
            {viewMode === "table" ? <FaThLarge /> : <FaTable />}
            <span className="hidden sm:inline">
              {viewMode === "table" ? "Grid" : "Table"}
            </span>
          </button>
        </div>

        {viewMode === "table" ? (
          <>
            <section className="mb-8">
              <h2 className="font-semibold text-xl mb-1">Top 15 Gainers</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-100">
                    <tr>
                      {["Rank", "Symbol", "Name", "Price (USD)", "24h %"].map((h) => (
                        <th key={h} className="px-4 py-2 text-xs uppercase text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <TableRows rows={topGainers} />
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-semibold text-xl mb-1">Top 15 Losers</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-100">
                    <tr>
                      {["Rank", "Symbol", "Name", "Price (USD)", "24h %"].map((h) => (
                        <th key={h} className="px-4 py-2 text-xs uppercase text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <TableRows rows={topLosers} />
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="font-semibold text-xl mb-3">Top 15 Gainers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <GridCards rows={topGainers} />
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-semibold text-xl mb-3">Top 15 Losers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <GridCards rows={topLosers} />
              </div>
            </section>
          </>
        )}

        {/* popup */}

<AnimatePresence>
  {selectedAsset && (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={closePopup}
    >
      <motion.div
        className="relative bg-white dark:bg-brand-900 rounded-lg shadow-lg w-full max-w-md p-6 overflow-auto"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* close btn */}
        <button
          className="absolute top-4 right-4 text-indigo-600 hover:text-indigo-800 text-2xl"
          onClick={closePopup}
        >
          ×
        </button>

        {/* header */}
        <h3 className="text-2xl font-bold mb-1">{selectedAsset.name}</h3>
        <p className="text-indigo-600 mb-4">
          #{selectedAsset.rank} • {selectedAsset.symbol.toUpperCase()}
        </p>

        {/* chart */}
        <div className="w-full h-48 mb-4">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Metric
            icon={<FaDollarSign className="text-indigo-600" />}
            label="Price"
            value={`$${formatPrice(selectedAsset.priceUsd)}`}
            color={
              parseFloat(selectedAsset.changePercent24Hr) >= 0
                ? "text-green-600"
                : "text-red-600"
            }
          />
          <Metric
            icon={<FaChartLine className="text-indigo-600" />}
            label="24h Change"
            value={`${formatValue(selectedAsset.changePercent24Hr)}%`}
            color={
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
            value={`$${formatValue(selectedAsset.volumeUsd24Hr)}`}
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
              selectedAsset.vwap24Hr ? formatValue(selectedAsset.vwap24Hr) : "N/A"
            }
          />
        </div>

        {/* explorer */}
        {selectedAsset.explorer && (
          <div className="mt-4 text-center text-sm">
            <a
              href={selectedAsset.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
            >
              <FaLink />
              {new URL(selectedAsset.explorer).hostname.replace(/^www\./, "")}
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
