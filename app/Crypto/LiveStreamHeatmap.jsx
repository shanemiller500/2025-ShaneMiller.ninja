"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
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
import { trackEvent } from "@/utils/mixpanel";

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY;
if (!API_KEY) {
  console.error(
    "🚨 Missing CoinCap API key! Please set NEXT_PUBLIC_COINCAP_API_KEY in .env.local and restart."
  );
}

export default function LiveStreamHeatmap() {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const [metaData, setMetaData] = useState({});
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsAvailable, setWsAvailable] = useState(true);
  const [wsClosed, setWsClosed] = useState(false); // auto-close state
  const socketRef = useRef(null);

  // Chart.js refs
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  /* ------------------------- helpers & formatters ------------------------- */
  const currencyFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const compactFmt = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
  const formatUSD = (v) => (v != null ? currencyFmt.format(v) : "—");
  const formatCompact = (v) => (v != null ? compactFmt.format(v) : "N/A");
  const formatPct = (s) => (s != null ? `${parseFloat(s).toFixed(2)}%` : "N/A");
  const shortenUrl = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };

  /* ------------------------------ fetch metadata -------------------------- */
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!API_KEY) return;
      const res = await fetch(
        `https://rest.coincap.io/v3/assets?limit=300&apiKey=${API_KEY}`
      );
      if (res.status === 403) {
        setWsAvailable(false);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (canceled) return;
      const m = {};
      (json.data || []).forEach((a) => (m[a.id] = a));
      setMetaData(m);
    })();
    return () => {
      canceled = true;
    };
  }, []);

  /* ----------------------------- websocket live --------------------------- */
  useEffect(() => {
    if (!API_KEY || !Object.keys(metaData).length || !wsAvailable) return;

    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=ALL&apiKey=${API_KEY}`
    );
    socketRef.current = ws;

    // Auto-close after 5 minutes (300 000 ms)
    const wsTimeout = setTimeout(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    }, 300_000);

    ws.onmessage = (e) => {
      if (typeof e.data === "string" && e.data.startsWith("Unauthorized")) {
        setWsAvailable(false);
        ws.close();
        setLoading(false);
        return;
      }
      let up;
      try {
        up = JSON.parse(e.data);
      } catch {
        return;
      }
      setTradeInfoMap((prev) => {
        const nxt = { ...prev };
        Object.entries(up).forEach(([id, ps]) => {
          const p = parseFloat(ps);
          nxt[id] = { price: p, prev: prev[id]?.price };
        });
        return nxt;
      });
      setLoading(false);
    };

    ws.onclose = () => {
      clearTimeout(wsTimeout);
      setWsClosed(true);
    };

    return () => {
      clearTimeout(wsTimeout);
      socketRef.current?.close();
    };
  }, [metaData, wsAvailable]);

  /* --------------------------- http polling fallback ---------------------- */
  useEffect(() => {
    if (wsAvailable) return;
    const fetchPrices = async () => {
      const res = await fetch(
        `https://rest.coincap.io/v3/assets?limit=150&apiKey=${API_KEY}`
      );
      const json = await res.json();
      const upd = {};
      (json.data || []).forEach((a) => (upd[a.id] = a.priceUsd));
      setTradeInfoMap((prev) => {
        const nxt = { ...prev };
        Object.entries(upd).forEach(([id, ps]) => {
          const p = parseFloat(ps);
          nxt[id] = { price: p, prev: prev[id]?.price };
        });
        return nxt;
      });
      setLoading(false);
    };
    fetchPrices();
    const iv = setInterval(fetchPrices, 10_000);
    return () => clearInterval(iv);
  }, [wsAvailable, metaData]);

  /* ----------------------------- sorted asset ids ------------------------- */
  const sortedIds = useMemo(() => {
    return Object.keys(tradeInfoMap).sort((a, b) => {
      const rA = +metaData[a]?.rank || Infinity;
      const rB = +metaData[b]?.rank || Infinity;
      return rA - rB;
    });
  }, [tradeInfoMap, metaData]);

  /* --------------------------- 24 h price chart --------------------------- */
  useEffect(() => {
    if (!selectedAsset) return;
    const drawChart = async () => {
      chartInstanceRef.current?.destroy();
      const end = Date.now();
      const start = end - 24 * 60 * 60 * 1000;
      const res = await fetch(
        `https://rest.coincap.io/v3/assets/${selectedAsset.id}/history?interval=m1&start=${start}&end=${end}&apiKey=${API_KEY}`
      );
      const json = await res.json();
      const data = (json.data || []).map((e) => ({
        x: new Date(e.time),
        y: parseFloat(e.priceUsd),
      }));
      const ctx = canvasRef.current.getContext("2d");
      chartInstanceRef.current = new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Price (USD)",
              data,
              borderColor: "rgb(132, 226, 255)",
              backgroundColor: "rgba(84, 75, 255, 0.62)",
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
            y: {
              title: { display: true, text: "Price (USD)" },
            },
          },
          plugins: { legend: { display: false } },
          elements: { line: { tension: 0.3 } },
          maintainAspectRatio: false,
        },
      });
    };
    drawChart();
  }, [selectedAsset]);

  /* ------------------------------ mixpanel tracking ----------------------- */
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

  const handleClosePopup = useCallback(() => {
    if (selectedAsset) {
      trackEvent("CryptoAssetPopupClose", { id: selectedAsset.id });
    }
    setSelectedAsset(null);
  }, [selectedAsset]);

  /* ------------------------------- rendering ------------------------------ */
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="animate-spin h-16 w-16 border-t-4 border-indigo-500 rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* main content */}
      <div className="p-4 max-w-5xl mx-auto">
        {!wsAvailable && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-center">
            WebSocket unavailable—polling every 10 s.
          </div>
        )}

        <h2 className="text-2xl font-bold mb-4">Live Stream Heatmap</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sortedIds.map((id) => {
            const { price, prev } = tradeInfoMap[id] || {};
            const md = metaData[id] || {};
            let bg = "bg-gray-300",
              arrow = "";
            if (prev != null) {
              if (price > prev) (bg = "bg-green-500"), (arrow = "↑");
              else if (price < prev) (bg = "bg-red-500"), (arrow = "↓");
            }
            return (
              <motion.div
                key={id}
                className={`${bg} text-white p-3 rounded-lg shadow relative cursor-pointer`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedAsset(md);
                  trackEvent("CryptoAssetClick", { id, ...md });
                }}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs bg-black bg-opacity-50 px-1 rounded">
                    #{md.rank || "—"}
                  </span>
                  <span className="font-bold text-lg" title={md.name}>
                    {md.symbol || id}
                  </span>
                </div>
                <div className="mt-1 text-sm">
                  {formatUSD(price)} <span className="font-bold">{arrow}</span>
                </div>
                <div className="text-xs">{formatPct(md.changePercent24Hr)}</div>
              </motion.div>
            );
          })}
        </div>

        {/* asset popup */}
        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePopup}
            >
              <motion.div
                className="relative bg-white dark:bg-brand-900 rounded-xl shadow-xl w-full max-w-md p-6 pb-8 overflow-auto"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute top-4 right-4 text-indigo-500 hover:text-indigo-700 text-xl"
                  onClick={handleClosePopup}
                >
                  ✕
                </button>

                <h3 className="text-2xl font-bold mb-1">{selectedAsset.name}</h3>
                <p className="text-indigo-500 mb-4">
                  {selectedAsset.symbol.toUpperCase()} • Rank {selectedAsset.rank}
                </p>

                <div className="w-full h-48 mb-4">
                  <canvas ref={canvasRef} className="w-full h-full" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Metric
                    icon={<FaDollarSign className="text-indigo-500 text-base" />}
                    label="Price"
                    value={formatUSD(tradeInfoMap[selectedAsset.id]?.price)}
                    valueColor={
                      tradeInfoMap[selectedAsset.id]?.price >=
                      tradeInfoMap[selectedAsset.id]?.prev
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  />
                  <Metric
                    icon={<FaChartLine className="text-indigo-500 text-base" />}
                    label="24 h Change"
                    value={formatPct(selectedAsset.changePercent24Hr)}
                    valueColor={
                      parseFloat(selectedAsset.changePercent24Hr) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  />
                  <Metric
                    icon={<FaChartPie className="text-indigo-500 text-base" />}
                    label="Market Cap"
                    value={formatCompact(parseFloat(selectedAsset.marketCapUsd))}
                  />
                  <Metric
                    icon={<FaCoins className="text-indigo-500 text-base" />}
                    label="Volume (24 h)"
                    value={formatCompact(parseFloat(selectedAsset.volumeUsd24Hr))}
                  />
                  <Metric
                    icon={<FaDatabase className="text-indigo-500 text-base" />}
                    label="Supply"
                    value={formatCompact(parseFloat(selectedAsset.supply))}
                  />
                  <Metric
                    icon={<FaWarehouse className="text-indigo-500 text-base" />}
                    label="Max Supply"
                    value={formatCompact(parseFloat(selectedAsset.maxSupply || 0))}
                  />
                  <Metric
                    icon={<FaGlobeAmericas className="text-indigo-500 text-base" />}
                    label="VWAP (24 h)"
                    value={
                      selectedAsset.vwap24Hr
                        ? formatUSD(parseFloat(selectedAsset.vwap24Hr))
                        : "N/A"
                    }
                  />
                </div>

                {selectedAsset.explorer && (
                  <div className="mt-4 text-center text-sm">
                    <a
                      href={selectedAsset.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                    >
                      <FaLink className="text-indigo-500" /> {shortenUrl(selectedAsset.explorer)}
                    </a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* websocket-closed popup */}
      {wsClosed && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white dark:bg-brand-900 rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            {/* dismiss popup */}
            <button
              className="absolute top-4 right-4 text-indigo-500 hover:text-indigo-700 text-xl"
              onClick={() => setWsClosed(false)}
            >
              ✕
            </button>

            <h3 className="text-xl font-bold mb-4">WebSocket closed</h3>
            <p className="mb-6">The live price stream ended automatically after 5 minutes.</p>
            <button
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded"
              onClick={() => window.location.reload()}
            >
              Start Stream Again
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------ Metric component ------------------------- */
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
