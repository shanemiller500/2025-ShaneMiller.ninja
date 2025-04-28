"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/utils/mixpanel";

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY;

// 🔑 Make sure NEXT_PUBLIC_COINCAP_API_KEY is defined in .env.local
if (!API_KEY) {
  console.error(
    "🚨 Missing CoinCap API key! Please set NEXT_PUBLIC_COINCAP_API_KEY in .env.local and restart."
  );
}

const LiveStreamHeatmap = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const [metaData, setMetaData] = useState({});
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  // 1) Fetch metadata up to 2000 entries so we have every rank
  useEffect(() => {
    const fetchMeta = async () => {
      if (!API_KEY) return;
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=2000&apiKey=${API_KEY}`
        );
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : [];
        const map = {};
        list.forEach((asset) => {
          map[asset.id] = asset;
        });
        setMetaData(map);
      } catch (err) {
        console.error("Metadata fetch error:", err);
      }
    };
    fetchMeta();
  }, []);

  // 2) Once metadata is loaded, open the WebSocket
  useEffect(() => {
    if (!API_KEY || !Object.keys(metaData).length) return;

    const socket = new WebSocket(
      `wss://wss.coincap.io/prices?assets=ALL&apiKey=${API_KEY}`
    );
    socketRef.current = socket;

    socket.onopen = () => console.log("WebSocket connected");
    socket.onerror = (err) => console.error("WebSocket error:", err);

    socket.onmessage = (evt) => {
      let updates;
      try {
        updates = JSON.parse(evt.data);
      } catch (e) {
        console.error("Non-JSON WS message:", evt.data);
        return;
      }

      setTradeInfoMap((prev) => {
        const next = { ...prev };
        Object.entries(updates).forEach(([id, priceStr]) => {
          const price = parseFloat(priceStr);
          const prevPrice = prev[id]?.price;
          next[id] = { price, prevPrice };
        });
        return next;
      });

      setLoading(false);
    };

    return () => socket.close();
  }, [metaData]);

  // 3) Sort by rank whenever prices or metadata change
  const sortedAssetIds = useMemo(() => {
    return Object.keys(tradeInfoMap).sort((a, b) => {
      const rA = metaData[a] ? +metaData[a].rank : Infinity;
      const rB = metaData[b] ? +metaData[b].rank : Infinity;
      return rA - rB;
    });
  }, [tradeInfoMap, metaData]);

  const formatLargeNumber = (numStr) =>
    numStr
      ? parseFloat(numStr).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })
      : "N/A";

  const shortenUrl = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const handleClose = () => setSelectedAsset(null);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 rounded shadow relative">
        <h2 className="text-xl font-bold mb-4">Live Stream Heatmap</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {sortedAssetIds.map((id) => {
            const { price, prevPrice } = tradeInfoMap[id] || {};
            const md = metaData[id];
            let bg = "bg-gray-300",
              arrow = "";
            if (prevPrice !== undefined) {
              if (price > prevPrice) bg = "bg-green-500", (arrow = "↑");
              else if (price < prevPrice) bg = "bg-red-500", (arrow = "↓");
            }
            const symbol = md?.symbol || id.toUpperCase();
            const pct = md
              ? parseFloat(md.changePercent24Hr).toFixed(2)
              : "0.00";

            return (
              <motion.div
                key={id}
                onClick={() => {
                  if (md) {
                    setSelectedAsset(md);
                    trackEvent("Crypto Asset Popup Displayed", {
                      assetId: md.id,
                      symbol: md.symbol,
                      name: md.name,
                      rank: md.rank,
                    });
                  }
                }}
                className={`p-4 rounded shadow text-center text-white cursor-pointer ${bg}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <h5 className="font-bold text-lg mb-2">
                  {symbol}{" "}
                  {md && (
                    <span className="text-xs font-normal">
                      Rank: {md.rank}
                      <br />
                      <span className="text-sm">{md.name}</span>
                    </span>
                  )}
                </h5>
                <p className="text-sm">
                  ${price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="font-bold">{arrow}</span>
                </p>
                <p className="text-xs">{pct}%</p>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            >
              <motion.div
                className="bg-white dark:bg-brand-900 p-6 rounded shadow-lg relative max-w-md w-full mx-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleClose}
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
                >
                  ✕
                </button>
                <h3 className="text-xl font-bold mb-4">
                  {selectedAsset.name} ({selectedAsset.symbol})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <tbody>
                      {[
                        ["Rank", selectedAsset.rank],
                        ["Symbol", selectedAsset.symbol],
                        ["Name", selectedAsset.name],
                        ["Supply", formatLargeNumber(selectedAsset.supply)],
                        ["Max Supply", formatLargeNumber(selectedAsset.maxSupply)],
                        [
                          "Market Cap USD",
                          selectedAsset.marketCapUsd
                            ? `$${Number(
                                selectedAsset.marketCapUsd
                              ).toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}`
                            : "N/A",
                        ],
                        [
                          "Volume (24Hr)",
                          selectedAsset.volumeUsd24Hr
                            ? `$${Number(
                                selectedAsset.volumeUsd24Hr
                              ).toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}`
                            : "N/A",
                        ],
                        [
                          "Price USD",
                          selectedAsset.priceUsd
                            ? `$${Number(
                                selectedAsset.priceUsd
                              ).toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}`
                            : "N/A",
                        ],
                        [
                          "Change % (24Hr)",
                          `${Number(
                            selectedAsset.changePercent24Hr
                          ).toFixed(2)}%`,
                        ],
                        [
                          "VWAP (24Hr)",
                          selectedAsset.vwap24Hr
                            ? Number(
                                selectedAsset.vwap24Hr
                              ).toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })
                            : "N/A",
                        ],
                      ].map(([label, val]) => (
                        <tr key={label} className="border-b">
                          <td className="px-4 py-2 font-bold">{label}:</td>
                          <td className="px-4 py-2">{val}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="px-4 py-2 font-bold">Explorer:</td>
                        <td className="px-4 py-2">
                          {selectedAsset.explorer ? (
                            <a
                              href={selectedAsset.explorer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-500 underline"
                            >
                              {shortenUrl(selectedAsset.explorer)}
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default LiveStreamHeatmap;
