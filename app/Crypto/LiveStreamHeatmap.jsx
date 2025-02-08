"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LiveStreamHeatmap = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const [metaData, setMetaData] = useState({});
  const [selectedAsset, setSelectedAsset] = useState(null);
  const socketRef = useRef(null);

  // Helper function to format large numbers (e.g. supply, maxSupply)
  const formatLargeNumber = (numStr) => {
    if (!numStr) return "N/A";
    return parseFloat(numStr).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  };

  // Helper function to shorten the explorer URL to its hostname
  const shortenUrl = (url) => {
    try {
      const { hostname } = new URL(url);
      return hostname;
    } catch (error) {
      return url;
    }
  };

  // Fetch metadata from CoinCap's REST API
  useEffect(() => {
    const fetchMetaData = async () => {
      try {
        const response = await fetch("https://api.coincap.io/v2/assets");
        const json = await response.json();
        const metaMap = {};
        json.data.forEach((asset) => {
          metaMap[asset.id] = asset;
        });
        setMetaData(metaMap);
      } catch (error) {
        console.error("Error fetching metadata:", error);
      }
    };

    fetchMetaData();
  }, []);

  // Set up the WebSocket connection for live price updates
  useEffect(() => {
    const socket = new WebSocket("wss://ws.coincap.io/prices?assets=ALL");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      for (const [id, price] of Object.entries(data)) {
        updateTradeInfo(id, parseFloat(price));
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      socket.close();
    };
  }, []);

  // Update live price data and keep track of previous price
  const updateTradeInfo = (id, price) => {
    setTradeInfoMap((prev) => {
      const prevPrice = prev[id]?.price;
      return {
        ...prev,
        [id]: {
          price,
          prevPrice,
        },
      };
    });
  };

  // Handle closing the modal popup
  const handleClose = () => {
    setSelectedAsset(null);
  };

  // Sort the asset IDs by rank. Assets missing metadata will be placed at the end.
  const sortedAssetIds = Object.keys(tradeInfoMap).sort((a, b) => {
    const rankA = metaData[a] ? parseInt(metaData[a].rank, 10) : Infinity;
    const rankB = metaData[b] ? parseInt(metaData[b].rank, 10) : Infinity;
    return rankA - rankB;
  });

  const renderCard = (id) => {
    const { price, prevPrice } = tradeInfoMap[id];
    let bgColor = "bg-gray-300";
    let arrowSymbol = "";
    if (prevPrice !== undefined) {
      if (price > prevPrice) {
        bgColor = "bg-green-500";
        arrowSymbol = "↑";
      } else if (price < prevPrice) {
        bgColor = "bg-red-500";
        arrowSymbol = "↓";
      }
    }

    // Use metadata to display a prettier symbol (falling back to the id if not available)
    const assetMeta = metaData[id];
    const displaySymbol = assetMeta ? assetMeta.symbol : id.toUpperCase();
    const percentChange = assetMeta
      ? parseFloat(assetMeta.changePercent24Hr).toFixed(2)
      : "0.00";

    return (
      <motion.div
        key={id}
        onClick={() => {
          if (assetMeta) {
            setSelectedAsset(assetMeta);
          }
        }}
        className={`p-4 rounded shadow text-center text-white cursor-pointer ${bgColor}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <h5 className="font-bold text-lg mb-2">{displaySymbol}</h5>
        <p className="text-sm">
          ${price.toFixed(2)} <span className="font-bold">{arrowSymbol}</span>
        </p>
        <p className="text-xs">
          {percentChange}% {/* Display the 24h percent change */}
        </p>
      </motion.div>
    );
  };

  return (
    <div className="p-4 rounded shadow relative">
      <h2 className="text-xl font-bold mb-4">Live Stream Heatmap</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {sortedAssetIds.map(renderCard)}
      </div>

      {/* Modal Popup */}
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
                className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                &#x2715;
              </button>
              <h3 className="text-xl font-bold mb-4">
                {selectedAsset.name} ({selectedAsset.symbol})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Rank:</td>
                      <td className="px-4 py-2">{selectedAsset.rank}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Symbol:</td>
                      <td className="px-4 py-2">{selectedAsset.symbol}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Name:</td>
                      <td className="px-4 py-2">{selectedAsset.name}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Supply:</td>
                      <td className="px-4 py-2">
                        {selectedAsset.supply
                          ? formatLargeNumber(selectedAsset.supply)
                          : "N/A"}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Max Supply:</td>
                      <td className="px-4 py-2">
                        {selectedAsset.maxSupply
                          ? formatLargeNumber(selectedAsset.maxSupply)
                          : "N/A"}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Market Cap USD:</td>
                      <td className="px-4 py-2">
                        {selectedAsset.marketCapUsd
                          ? `$${Number(selectedAsset.marketCapUsd).toLocaleString(
                              "en-US",
                              { maximumFractionDigits: 2 }
                            )}`
                          : "N/A"}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Volume (24Hr):</td>
                      <td className="px-4 py-2">
                        {selectedAsset.volumeUsd24Hr
                          ? `$${Number(
                              selectedAsset.volumeUsd24Hr
                            ).toLocaleString("en-US", {
                              maximumFractionDigits: 2,
                            })}`
                          : "N/A"}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">Price USD:</td>
                      <td className="px-4 py-2">
                        {selectedAsset.priceUsd
                          ? `$${Number(selectedAsset.priceUsd).toLocaleString(
                              "en-US",
                              { maximumFractionDigits: 2 }
                            )}`
                          : "N/A"}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">
                        Change Percent (24Hr):
                      </td>
                      <td className="px-4 py-2">
                        {selectedAsset.changePercent24Hr
                          ? `${Number(selectedAsset.changePercent24Hr).toFixed(
                              2
                            )}%`
                          : "N/A"}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-bold">VWAP (24Hr):</td>
                      <td className="px-4 py-2">
                        {selectedAsset.vwap24Hr
                          ? Number(selectedAsset.vwap24Hr).toLocaleString("en-US", {
                              maximumFractionDigits: 2,
                            })
                          : "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-bold">Explorer:</td>
                      <td className="px-4 py-2">
                        {selectedAsset.explorer ? (
                          <a
                            href={selectedAsset.explorer}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 underline"
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
  );
};

export default LiveStreamHeatmap;
