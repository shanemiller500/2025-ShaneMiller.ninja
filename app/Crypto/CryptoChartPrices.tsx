"use client";

import React, { useState, useEffect, useRef, FormEvent } from "react";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { format } from "date-fns";
// Import and register the zoom plugin.
import zoomPlugin from "chartjs-plugin-zoom";
Chart.register(zoomPlugin);

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

// Pull your API key from .env.local
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY;

const CryptoChartPrices: React.FC = () => {
  const [query, setQuery] = useState<string>("bitcoin");
  const [assetId, setAssetId] = useState<string>("bitcoin");
  const [chartData, setChartData] = useState<HistoryEntry[]>([]);
  const [cryptoDetails, setCryptoDetails] = useState<CryptoAsset | null>(null);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSpinner, setLoadingSpinner] = useState<boolean>(true);
  const [chartType, setChartType] = useState<string>("line");
  const [timeFrame, setTimeFrame] = useState<TimeFrameOption>("24h");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // 1) Resolve user query via V3 assets endpoint
  async function resolveAssetId(searchQuery: string): Promise<string | null> {
    if (!API_KEY) return null;
    const url = `https://rest.coincap.io/v3/assets?search=${encodeURIComponent(
      searchQuery
    )}&apiKey=${API_KEY}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];
      if (!list.length) return null;
      const lower = searchQuery.toLowerCase();
      const exact = list.find(
        (a: any) =>
          a.id.toLowerCase() === lower ||
          a.symbol.toLowerCase() === lower ||
          a.name.toLowerCase() === lower
      );
      return exact ? exact.id : list[0].id;
    } catch (err) {
      console.error("Error resolving asset id:", err);
      return null;
    }
  }

  // 2) Fetch historical data via V3 history endpoint
  async function fetchCryptoData(
    id: string,
    tf: TimeFrameOption
  ): Promise<HistoryEntry[]> {
    if (!API_KEY) return [];
    let ms: number, interval: string;
    switch (tf) {
      case "1h":
        ms = 1 * 60 * 60 * 1000;
        interval = "m1";
        break;
      case "24h":
        ms = 24 * 60 * 60 * 1000;
        interval = "m1";
        break;
      case "7d":
        ms = 7 * 24 * 60 * 60 * 1000;
        interval = "h1";
        break;
      case "30d":
        ms = 30 * 24 * 60 * 60 * 1000;
        interval = "d1";
        break;
      default:
        ms = 24 * 60 * 60 * 1000;
        interval = "m1";
    }
    const end = Date.now();
    const start = end - ms;
    const url = `https://rest.coincap.io/v3/assets/${id}/history?interval=${interval}&start=${start}&end=${end}&apiKey=${API_KEY}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const arr = Array.isArray(json.data) ? json.data : [];
      return arr.map((e: any) => ({
        t: e.time,
        y: parseFloat(e.priceUsd),
      }));
    } catch (err) {
      console.error("Error fetching crypto data:", err);
      return [];
    }
  }

  // 3) Fetch asset details via V3 single-asset endpoint
  async function fetchCryptoDetails(id: string): Promise<CryptoAsset | null> {
    if (!API_KEY) return null;
    const url = `https://rest.coincap.io/v3/assets/${id}?apiKey=${API_KEY}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.error("Error fetching crypto details:", err);
      return null;
    }
  }

  // 4) Pull data & details, then update state
  async function updateChart() {
    setLoadingChart(true);
    const data = await fetchCryptoData(assetId, timeFrame);
    setChartData(data);
    const details = await fetchCryptoDetails(assetId);
    setCryptoDetails(details);
    setLoadingChart(false);
  }

  useEffect(() => {
    updateChart();
  }, [assetId, timeFrame]);

  // Compute percent-change series
  const computePercentChangeData = (data: HistoryEntry[]): HistoryEntry[] => {
    if (!data.length) return [];
    const first = data[0].y;
    return data.map((e) => ({ t: e.t, y: ((e.y - first) / first) * 100 }));
  };

  // 5) Render/update Chart.js instance
  useEffect(() => {
    if (!canvasRef.current || !chartData.length) return;
    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const pctData = computePercentChangeData(chartData);

    // Time scale settings
    let timeUnit: any, tooltipFmt: string, maxTicks: number;
    switch (timeFrame) {
      case "1h":
        timeUnit = "minute"; tooltipFmt = "MMM d, HH:mm"; maxTicks = 12;
        break;
      case "24h":
        timeUnit = "hour"; tooltipFmt = "MMM d, HH:mm"; maxTicks = 12;
        break;
      case "7d":
        timeUnit = "day"; tooltipFmt = "MMM d"; maxTicks = 7;
        break;
      case "30d":
        timeUnit = "day"; tooltipFmt = "MMM d"; maxTicks = 10;
        break;
      default:
        timeUnit = "hour"; tooltipFmt = "MMM d, HH:mm"; maxTicks = 12;
    }

    const priceSeries = chartData.map((e) => ({ x: new Date(e.t), y: e.y }));
    const percentSeries = pctData.map((e) => ({ x: new Date(e.t), y: e.y }));

    if (chartType === "bubble") {
      priceSeries.forEach((p: any) => (p.r = 5));
      percentSeries.forEach((p: any) => (p.r = 5));
    }

    const cfgData: any = {
      datasets: [
        {
          label: "Price (USD)",
          data: priceSeries,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.1)",
          fill: true,
          yAxisID: "y1",
          showLine: chartType !== "scatter",
        },
        {
          label: "Price % Change",
          data: percentSeries,
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.1)",
          fill: true,
          yAxisID: "y2",
          showLine: chartType !== "scatter",
        },
      ],
    };

    const cfgOpts: any = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          type: "time",
          time: {
            unit: timeUnit,
            tooltipFormat: tooltipFmt,
            displayFormats: { minute: "HH:mm", hour: "HH:mm", day: "MMM d" },
          },
          ticks: { maxTicksLimit: maxTicks },
        },
        y1: { position: "left", title: { display: true, text: "USD" } },
        y2: { position: "right", title: { display: true, text: "%" } },
      },
      plugins: {
        zoom: {
          pan: { enabled: true, mode: "xy", threshold: 5 },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
        },
      },
      onClick: (_: MouseEvent, activeEls: any[]) => {
        if (activeEls.length) {
          const { index, datasetIndex } = activeEls[0];
          const pt = cfgData.datasets[datasetIndex].data[index];
          alert(`Value: ${pt.y}\nTime: ${pt.x}`);
        }
      },
    };

    chartRef.current = new Chart(ctx, {
      type: chartType as any,
      data: cfgData,
      options: cfgOpts,
    });
  }, [chartData, chartType, timeFrame]);

  // Show spinner on load
  useEffect(() => {
    const t = setTimeout(() => setLoadingSpinner(false), 1000);
    return () => clearTimeout(t);
  }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const id = await resolveAssetId(query.trim());
    if (id) {
      setError(null);
      setAssetId(id);
    } else {
      setError("Asset not found. Please try another symbol or name.");
    }
  };

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
        <h2 className="text-3xl font-bold text-center mb-4">
          Crypto Chart & Prices
        </h2>
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4"
        >
          <input
            type="text"
            placeholder="e.g. bitcoin or BTC"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="p-2 border rounded w-full sm:w-auto dark:bg-indigo-900 dark:border-indigo-700"
          />
          <button className="px-4 py-2 bg-indigo-600 text-white rounded">
            Search
          </button>
        </form>

        <div className="flex flex-col sm:flex-row justify-end items-center mb-4 gap-4">
          <div>
            <label className="mr-2 font-medium">Chart Type:</label>
            <select
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
          <div>
            <label className="mr-2 font-medium">Time Frame:</label>
            <select
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
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 max-w-md mx-auto">
            {error}
          </div>
        )}

        {loadingChart ? (
          <p className="text-center">Loading chart...</p>
        ) : (
          <div className="w-full h-72 md:h-96 mb-4">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
        )}

        {(chartType === "line" ||
          chartType === "bar" ||
          chartType === "scatter" ||
          chartType === "bubble") &&
          chartData.length > 0 && (
            <div className="text-center mb-4">
              <button
                type="button"
                onClick={() => (chartRef.current as any)?.resetZoom()}
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >
                Reset Zoom
              </button>
            </div>
        )}

        {cryptoDetails && (
          <div className="mt-8 overflow-x-auto">
            <h3 className="text-xl font-bold mb-4">
              {cryptoDetails.name} ({cryptoDetails.symbol}) Details
            </h3>
            <table className="min-w-full divide-y divide-gray-200">
              <tbody className=" divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 font-medium">Rank</td>
                  <td className="px-6 py-4">{cryptoDetails.rank}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Price (USD)</td>
                  <td className="px-6 py-4">
                    <span className={priceColorClass}>
                      ${format(parseFloat(cryptoDetails.priceUsd), "0,0.00")}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">24Hr % Change</td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 font-medium">Market Cap (USD)</td>
                  <td className="px-6 py-4">
                    ${parseFloat(cryptoDetails.marketCapUsd).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Supply</td>
                  <td className="px-6 py-4">
                    {parseInt(cryptoDetails.supply).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Max Supply</td>
                  <td className="px-6 py-4">
                    {cryptoDetails.maxSupply
                      ? parseInt(cryptoDetails.maxSupply).toLocaleString()
                      : "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">24Hr Volume (USD)</td>
                  <td className="px-6 py-4">
                    ${parseFloat(cryptoDetails.volumeUsd24Hr).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">VWAP (24Hr)</td>
                  <td className="px-6 py-4">
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
            {cryptoDetails.explorer && (
              <div className="mt-4 text-center">
                <a
                  href={cryptoDetails.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  View {cryptoDetails.name} Explorer
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
