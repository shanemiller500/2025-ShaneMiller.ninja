"use client";

import React, { useState, useEffect, useRef, FormEvent } from "react";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { format } from "date-fns";

interface HistoryEntry {
  t: number;
  y: number;
}

interface CryptoAsset {
  id: string;
  name: string;
  symbol: string;
  rank: string;
  supply: string;
  maxSupply: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  vwap24Hr: string | null;
  changePercent24Hr: string;
  explorer?: string;
}

type TimeFrameOption = "1h" | "24h" | "7d" | "30d";

const CryptoChartPrices: React.FC = () => {
  const [query, setQuery] = useState<string>("bitcoin");
  const [assetId, setAssetId] = useState<string>("bitcoin");
  const [chartData, setChartData] = useState<HistoryEntry[]>([]);
  const [cryptoDetails, setCryptoDetails] = useState<CryptoAsset | null>(null);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSpinner, setLoadingSpinner] = useState<boolean>(true);
  // Chart types: "line", "bar", "scatter", "bubble", "radar", "pie", "doughnut", "polarArea"
  const [chartType, setChartType] = useState<string>("line");
  // Time frame selection.
  const [timeFrame, setTimeFrame] = useState<TimeFrameOption>("24h");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // Resolve a user query into an asset id via CoinCap API.
  async function resolveAssetId(searchQuery: string): Promise<string | null> {
    const url = `https://api.coincap.io/v2/assets?search=${searchQuery}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        const lowerQuery = searchQuery.toLowerCase();
        const exactMatch = data.data.find((asset: any) =>
          asset.id.toLowerCase() === lowerQuery ||
          asset.symbol.toLowerCase() === lowerQuery ||
          asset.name.toLowerCase() === lowerQuery
        );
        return exactMatch ? exactMatch.id : data.data[0].id;
      }
      return null;
    } catch (err) {
      console.error("Error resolving asset id:", err);
      return null;
    }
  }

  // Fetch historical price data for the asset based on the selected time frame.
  async function fetchCryptoData(
    assetId: string,
    timeFrame: TimeFrameOption
  ): Promise<HistoryEntry[]> {
    let ms: number;
    let interval: string;
    switch (timeFrame) {
      case "1h":
        ms = 1 * 60 * 60 * 1000;
        interval = "m1"; // 1-minute intervals for 1 hour
        break;
      case "24h":
        ms = 24 * 60 * 60 * 1000;
        interval = "m1"; // 1-minute intervals for 24 hours (full resolution)
        break;
      case "7d":
        ms = 7 * 24 * 60 * 60 * 1000;
        interval = "h1"; // 1-hour intervals for 7 days
        break;
      case "30d":
        ms = 30 * 24 * 60 * 60 * 1000;
        interval = "d1"; // Daily intervals for 30 days
        break;
      default:
        ms = 24 * 60 * 60 * 1000;
        interval = "m1";
        break;
    }
    const end = Date.now();
    const start = end - ms;
    const url = `https://api.coincap.io/v2/assets/${assetId}/history?interval=${interval}&start=${start}&end=${end}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data.data || data.data.length === 0) return [];
      return data.data.map((entry: any) => ({
        t: entry.time,
        y: parseFloat(entry.priceUsd)
      }));
    } catch (err) {
      console.error("Error fetching crypto data:", err);
      return [];
    }
  }

  // Fetch meta details for the asset.
  async function fetchCryptoDetails(assetId: string): Promise<CryptoAsset | null> {
    const url = `https://api.coincap.io/v2/assets/${assetId}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.data || null;
    } catch (err) {
      console.error("Error fetching crypto details:", err);
      return null;
    }
  }

  // Update chart data and details.
  async function updateChart() {
    setLoadingChart(true);
    const data = await fetchCryptoData(assetId, timeFrame);
    setChartData(data);
    const details = await fetchCryptoDetails(assetId);
    setCryptoDetails(details);
    setLoadingChart(false);
  }

  // Update chart when assetId or timeFrame changes.
  useEffect(() => {
    updateChart();
  }, [assetId, timeFrame]);

  // Compute the price % change series relative to the first data point.
  const computePercentChangeData = (data: HistoryEntry[]): HistoryEntry[] => {
    if (data.length === 0) return [];
    const firstPrice = data[0].y;
    return data.map(entry => ({
      t: entry.t,
      y: ((entry.y - firstPrice) / firstPrice) * 100
    }));
  };

  // For Radar charts, sample one point per hour.
  const sampleDataHourly = (data: HistoryEntry[]): HistoryEntry[] => {
    return data.filter(entry => {
      const d = new Date(entry.t);
      return d.getMinutes() === 0;
    });
  };

  // Create or update the chart when data, details, assetId, chartType, or timeFrame changes.
  useEffect(() => {
    if (canvasRef.current && chartData.length > 0) {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const percentChangeData = computePercentChangeData(chartData);
      let data: any = {};
      let options: any = {};

      // Set time unit and tooltip format based on selected timeFrame.
      let timeUnit: string;
      let tooltipFormat: string;
      let maxTicksLimit: number;

      switch (timeFrame) {
        case "1h":
          timeUnit = "minute";
          tooltipFormat = "MMM d, HH:mm";
          maxTicksLimit = 12;
          break;
        case "24h":
          timeUnit = "hour";
          tooltipFormat = "MMM d, HH:mm";
          maxTicksLimit = 12;
          break;
        case "7d":
          timeUnit = "day";
          tooltipFormat = "MMM d";
          maxTicksLimit = 7;
          break;
        case "30d":
          timeUnit = "day";
          tooltipFormat = "MMM d";
          maxTicksLimit = 10;
          break;
        default:
          timeUnit = "hour";
          tooltipFormat = "MMM d, HH:mm";
          maxTicksLimit = 12;
      }

      if (
        chartType === "line" ||
        chartType === "bar" ||
        chartType === "scatter" ||
        chartType === "bubble"
      ) {
        // Transform data to { x: Date, y: value } format.
        const priceSeries = chartData.map(entry => ({
          x: new Date(entry.t),
          y: entry.y
        }));
        const percentSeries = percentChangeData.map(entry => ({
          x: new Date(entry.t),
          y: entry.y
        }));
        // For bubble charts, add a fixed radius.
        if (chartType === "bubble") {
          priceSeries.forEach(point => ((point as any).r = 5));
          percentSeries.forEach(point => ((point as any).r = 5));
        }
        data = {
          datasets: [
            {
              label: "Price (USD)",
              data: priceSeries,
              borderColor: "rgb(75, 192, 192)",
              backgroundColor: "rgba(75, 192, 192, 0.1)",
              fill: true,
              yAxisID: "y1",
              ...(chartType === "scatter" || chartType === "bubble"
                ? { showLine: chartType === "bubble" ? true : false }
                : {})
            },
            {
              label: "Price % Change",
              data: percentSeries,
              borderColor: "rgb(255, 99, 132)",
              backgroundColor: "rgba(255, 99, 132, 0.1)",
              fill: true,
              yAxisID: "y2",
              ...(chartType === "scatter" || chartType === "bubble"
                ? { showLine: chartType === "bubble" ? true : false }
                : {})
            }
          ]
        };

        options = {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          parsing: false,
          scales: {
            x: {
              type: "time",
              time: {
                unit: timeUnit,
                tooltipFormat: tooltipFormat,
                displayFormats: {
                  minute: "HH:mm",
                  hour: "HH:mm",
                  day: "MMM d"
                }
              },
              title: { display: true, text: "Time" },
              min: new Date(chartData[0].t),
              max: new Date(chartData[chartData.length - 1].t),
              ticks: {
                autoSkip: true,
                maxTicksLimit: maxTicksLimit
              }
            },
            y1: {
              position: "left",
              title: { display: true, text: "Price (USD)" },
              grid: { drawOnChartArea: false }
            },
            y2: {
              position: "right",
              title: { display: true, text: "Price % Change (%)" },
              grid: { drawOnChartArea: false }
            }
          },
          plugins: { legend: { position: "top" } }
        };
      } else if (chartType === "radar") {
        // For radar charts, sample one point per hour.
        const sampled = sampleDataHourly(chartData);
        const sampledPercent = computePercentChangeData(sampled);
        const labels = sampled.map(entry => format(new Date(entry.t), "ha"));
        data = {
          labels,
          datasets: [
            {
              label: "Price (USD)",
              data: sampled.map(entry => entry.y),
              borderColor: "rgb(75, 192, 192)",
              backgroundColor: "rgba(75, 192, 192, 0.2)"
            },
            {
              label: "Price % Change",
              data: sampledPercent.map(entry => entry.y),
              borderColor: "rgb(255, 99, 132)",
              backgroundColor: "rgba(255, 99, 132, 0.2)"
            }
          ]
        };
        options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: { r: { beginAtZero: false } },
          plugins: { legend: { position: "top" } }
        };
      } else if (
        chartType === "pie" ||
        chartType === "doughnut" ||
        chartType === "polarArea"
      ) {
        // Aggregated charts: compute average price and overall % change.
        const avgPrice =
          chartData.reduce((sum, entry) => sum + entry.y, 0) / chartData.length;
        const overallPercentChange =
          ((chartData[chartData.length - 1].y - chartData[0].y) / chartData[0].y) * 100;
        data = {
          labels: ["Price (USD)", "Price % Change"],
          datasets: [
            {
              data: [avgPrice, overallPercentChange],
              backgroundColor: [
                "rgba(75, 192, 192, 0.6)",
                "rgba(255, 99, 132, 0.6)"
              ],
              borderColor: ["rgb(75, 192, 192)", "rgb(255, 99, 132)"],
              borderWidth: 1
            }
          ]
        };
        options = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } }
        };
      }

      chartRef.current = new Chart(ctx, {
        type: chartType as any,
        data,
        options
      });
    }
  }, [chartData, cryptoDetails, assetId, chartType, timeFrame]);

  // Show spinner on initial load.
  useEffect(() => {
    const spinnerTimeout = setTimeout(() => {
      setLoadingSpinner(false);
    }, 1000);
    return () => clearTimeout(spinnerTimeout);
  }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const resolvedId = await resolveAssetId(query.trim());
    if (resolvedId) {
      setError(null);
      setAssetId(resolvedId);
    } else {
      setError("Asset not found. Please type a valid symbol or try another name.");
    }
  };

  // Determine color classes based on the 24Hr % change.
  const priceColorClass =
    cryptoDetails && parseFloat(cryptoDetails.changePercent24Hr) >= 0
      ? "text-green-500"
      : "text-red-500";

  return (
    <>
      {loadingSpinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-500"></div>
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-center mb-4">Crypto Chart & Prices</h2>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
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
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded hover:bg-gradient-to-r from-indigo-600 to-purple-600 focus:outline-none"
          >
            Search
          </button>
        </form>
        {/* Chart Type and Time Frame Dropdowns */}
        <div className="flex flex-col sm:flex-row justify-end items-center mb-4 gap-4">
          <div className="flex items-center">
            <label htmlFor="chartType" className="mr-2 font-medium">
              Chart Type:
            </label>
            <select
              id="chartType"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="border rounded p-1 dark:bg-indigo-900 dark:border-indigo-700"
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="scatter">Scatter</option>
              <option value="bubble">Bubble</option>
              <option value="radar">Radar</option>
              <option value="pie">Pie (Aggregated)</option>
              <option value="doughnut">Doughnut (Aggregated)</option>
              <option value="polarArea">Polar Area (Aggregated)</option>
            </select>
          </div>
          <div className="flex items-center">
            <label htmlFor="timeFrame" className="mr-2 font-medium">
              Time Frame:
            </label>
            <select
              id="timeFrame"
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value as TimeFrameOption)}
              className="border rounded p-1 dark:bg-indigo-900 dark:border-indigo-700"
            >
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
            </select>
          </div>
        </div>
        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-md mx-auto mt-4"
            role="alert"
          >
            <strong className="font-bold">Asset not found!</strong>
            <span className="block sm:inline ml-2">{error}</span>
            <span
              className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer"
              onClick={() => setError(null)}
            >
              <svg
                className="fill-current h-6 w-6 text-red-500"
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
          <div className="w-full h-72 md:h-96 mb-4">
            <canvas ref={canvasRef} className="w-full h-full"></canvas>
          </div>
        )}
        {cryptoDetails && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {cryptoDetails.name} ({cryptoDetails.symbol}) Details
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-indigo-600">
                <thead className="bg-gray-50 dark:bg-indigo-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-indigo-200 uppercase tracking-wider">
                      Metric
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-indigo-200 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-indigo-900 divide-y divide-gray-200 dark:divide-indigo-600">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      Rank
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-indigo-200">
                      {cryptoDetails.rank}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      Price (USD)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={priceColorClass}>
                        $
                        {parseFloat(cryptoDetails.priceUsd).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      24Hr % Change
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={
                          parseFloat(cryptoDetails.changePercent24Hr) >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }
                      >
                        {parseFloat(cryptoDetails.changePercent24Hr).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      Market Cap (USD)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-indigo-200">
                      $
                      {parseFloat(cryptoDetails.marketCapUsd).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      Supply
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-indigo-200">
                      {parseInt(cryptoDetails.supply).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      Max Supply
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-indigo-200">
                      {cryptoDetails.maxSupply
                        ? parseInt(cryptoDetails.maxSupply).toLocaleString()
                        : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      24Hr Volume (USD)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-indigo-200">
                      $
                      {parseFloat(cryptoDetails.volumeUsd24Hr).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      VWAP (24Hr)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-indigo-200">
                      {cryptoDetails.vwap24Hr
                        ? `$${parseFloat(cryptoDetails.vwap24Hr).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "N/A"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {cryptoDetails.explorer && (
              <div className="mt-4 text-center">
                <a
                  href={cryptoDetails.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-500"
                >
                  Visit {cryptoDetails.name} Blockchain Explorer
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CryptoChartPrices;
