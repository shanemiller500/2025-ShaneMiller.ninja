"use client";

import React, { useState, useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
// Import a time adapter for Chart.js to work with time scales
import "chartjs-adapter-date-fns";

const CryptoChartPrices = () => {
  const [query, setQuery] = useState("bitcoin");
  const [assetId, setAssetId] = useState("bitcoin");
  const [chartData, setChartData] = useState([]);
  const [cryptoDetails, setCryptoDetails] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Resolves a user query (symbol or name) into a proper CoinCap asset id.
  async function resolveAssetId(searchQuery) {
    const url = `https://api.coincap.io/v2/assets?search=${searchQuery}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        const lowerQuery = searchQuery.toLowerCase();
        const exactMatch = data.data.find(
          (asset) =>
            asset.id.toLowerCase() === lowerQuery ||
            asset.symbol.toLowerCase() === lowerQuery ||
            asset.name.toLowerCase() === lowerQuery
        );
        return exactMatch ? exactMatch.id : data.data[0].id;
      }
      return null;
    } catch (error) {
      console.error("Error resolving asset id:", error);
      return null;
    }
  }

  // Fetch historical price data (last 24 hours) for the given asset id.
  async function fetchCryptoData(assetId) {
    const end = Date.now();
    const start = end - 24 * 60 * 60 * 1000;
    const url = `https://api.coincap.io/v2/assets/${assetId}/history?interval=m1&start=${start}&end=${end}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data.data || data.data.length === 0) return [];
      return data.data.map((entry) => ({
        t: entry.time,
        y: parseFloat(entry.priceUsd),
      }));
    } catch (error) {
      console.error("Error fetching crypto data:", error);
      return [];
    }
  }

  // Fetch the meta details for the given asset id.
  async function fetchCryptoDetails(assetId) {
    const url = `https://api.coincap.io/v2/assets/${assetId}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.data || null;
    } catch (error) {
      console.error("Error fetching crypto details:", error);
      return null;
    }
  }

  // Update the chart (data and details) for the current asset id.
  async function updateChart() {
    setLoadingChart(true);
    const data = await fetchCryptoData(assetId);
    setChartData(data);
    const details = await fetchCryptoDetails(assetId);
    setCryptoDetails(details);
    setLoadingChart(false);
  }

  // Whenever the asset id changes, update the chart.
  useEffect(() => {
    updateChart();
  }, [assetId]);

  // Create or update the Chart.js chart whenever chartData (or details) change.
  useEffect(() => {
    if (canvasRef.current && chartData.length > 0) {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          datasets: [
            {
              label: `${cryptoDetails ? cryptoDetails.name : assetId} Price (USD)`,
              data: chartData,
              borderColor: "rgb(75, 192, 192)",
              backgroundColor: "rgba(75, 192, 192, 0.1)",
              fill: true,
            },
          ],
        },
        options: {
          scales: {
            x: {
              type: "time",
              time: {
                unit: "hour",
                tooltipFormat: "MMM d, HH:mm",
              },
              title: {
                display: true,
                text: "Time",
              },
            },
            y: {
              title: {
                display: true,
                text: "Price in USD",
              },
            },
          },
          parsing: {
            xAxisKey: "t",
            yAxisKey: "y",
          },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }
  }, [chartData, cryptoDetails, assetId]);

  // Handle form submission by resolving the input query to an asset id.
  const handleSearch = async (e) => {
    e.preventDefault();
    const resolvedId = await resolveAssetId(query.trim());
    if (resolvedId) {
      setError(null);
      setAssetId(resolvedId);
    } else {
      setError("Asset not found. Please type a valid symbol or try another name.");
    }
  };

  return (
    <div className=" mx-auto ">
      <h2 className="text-3xl font-bold text-center mb-4">Crypto Chart & Prices</h2>
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4"
      >
        <input
          type="text"
          placeholder="Enter crypto symbol or name (e.g. bitcoin or BTC)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          className="p-2 border border-gray-300 rounded w-full sm:w-auto dark:bg-indigo-900 dark:border-indigo-700 focus:outline-none"
        />
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 focus:outline-none"
        >
          Search
        </button>
      </form>

      {/* Tailwind-styled popup error message */}
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-md mx-auto mt-4"
          role="alert"
        >
          <strong className="font-bold">Asset not found!</strong>
          <span className="block sm:inline ml-2">{error}</span>
          <span
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <svg
              className="fill-current h-6 w-6 text-red-500 cursor-pointer"
              role="button"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <title>Close</title>
              <path d="M14.348 5.652a1 1 0 10-1.414-1.414L10 7.172 7.066 4.238a1 1 0 10-1.414 1.414L8.586 8.586 5.652 11.52a1 1 0 101.414 1.414L10 9.999l2.934 2.935a1 1 0 101.414-1.414L11.414 8.586l2.934-2.934z" />
            </svg>
          </span>
        </div>
      )}

      {loadingChart ? (
        <p className="text-center">Loading chart...</p>
      ) : (
        <div className="w-full h-60 md:h-80 mb-4">
          <canvas ref={canvasRef} className="w-full h-full"></canvas>
        </div>
      )}

      {/* Updated Crypto Details Section with Indigo Shades for Dark Mode */}
      {cryptoDetails && (
        <div className="shadow overflow-hidden sm:rounded-lg bg-white dark:bg-indigo-900 dark:text-white">
          <div className="px-4 py-5 sm:px-6 bg-white dark:bg-indigo-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              {cryptoDetails.name} ({cryptoDetails.symbol}) Details
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-indigo-200">
              Overview of cryptocurrency metrics.
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-indigo-600">
            <dl>
              <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-indigo-50 dark:bg-indigo-800">
                <dt className="text-sm font-medium text-gray-500 dark:text-indigo-200">
                  Rank
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                  {cryptoDetails.rank}
                </dd>
              </div>
              <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-white dark:bg-indigo-600">
                <dt className="text-sm font-medium text-gray-500 dark:text-indigo-200">
                  Supply
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                  {parseInt(cryptoDetails.supply).toLocaleString()}
                </dd>
              </div>
              <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-indigo-50 dark:bg-indigo-800">
                <dt className="text-sm font-medium text-gray-500 dark:text-indigo-200">
                  Max Supply
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                  {cryptoDetails.maxSupply
                    ? parseInt(cryptoDetails.maxSupply).toLocaleString()
                    : "N/A"}
                </dd>
              </div>
              <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-white dark:bg-indigo-600">
                <dt className="text-sm font-medium text-gray-500 dark:text-indigo-200">
                  Market Cap (USD)
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                  {parseFloat(cryptoDetails.marketCapUsd).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
              <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-indigo-50 dark:bg-indigo-800">
                <dt className="text-sm font-medium text-gray-500 dark:text-indigo-200">
                  24Hr Volume (USD)
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                  {parseFloat(cryptoDetails.volumeUsd24Hr).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
              <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-white dark:bg-indigo-600">
                <dt className="text-sm font-medium text-gray-500 dark:text-indigo-200">
                  VWAP (24Hr)
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                  {cryptoDetails.vwap24Hr
                    ? parseFloat(cryptoDetails.vwap24Hr).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "N/A"}
                </dd>
              </div>
            </dl>
          </div>
          {cryptoDetails.explorer && (
            <div className="px-4 py-4 sm:px-6">
              <a
                href={cryptoDetails.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-500"
              >
                {cryptoDetails.name} Blockchain Explorer
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CryptoChartPrices;
