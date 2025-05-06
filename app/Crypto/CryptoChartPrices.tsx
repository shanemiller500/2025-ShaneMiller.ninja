"use client";

import React, {
  useState,
  useEffect,
  useRef,
  FormEvent,
} from "react";
import { Chart, ChartTypeRegistry } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";
import { trackEvent } from "@/utils/mixpanel"; 
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

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";

const CryptoChartPrices: React.FC = () => {
  const [query, setQuery] = useState("bitcoin");
  const [assetId, setAssetId] = useState("bitcoin");
  const [chartData, setChartData] = useState<HistoryEntry[]>([]);
  const [cryptoDetails, setCryptoDetails] = useState<CryptoAsset | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState("line");
  const [timeFrame, setTimeFrame] = useState<TimeFrameOption>("24h");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | undefined>(undefined);

  // Resolve search into an asset ID
  async function resolveAssetId(q: string): Promise<string | null> {
    if (!API_KEY) return null;
    const res = await fetch(
      `https://rest.coincap.io/v3/assets?search=${encodeURIComponent(
        q
      )}&apiKey=${API_KEY}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const list: CryptoAsset[] = json.data;
    if (!list.length) return null;
    const lower = q.toLowerCase();
    const exact = list.find(
      (a) =>
        a.id.toLowerCase() === lower ||
        a.symbol.toLowerCase() === lower ||
        a.name.toLowerCase() === lower
    );
    return exact ? exact.id : list[0].id;
  }

  // Fetch history for the selected asset
  async function fetchCryptoData(
    id: string,
    tf: TimeFrameOption
  ): Promise<HistoryEntry[]> {
    if (!API_KEY) return [];
    let ms: number, interval: string;
    switch (tf) {
      case "1h":
        ms = 3600e3;
        interval = "m1";
        break;
      case "24h":
        ms = 24 * 3600e3;
        interval = "m1";
        break;
      case "7d":
        ms = 7 * 24 * 3600e3;
        interval = "h1";
        break;
      default:
        ms = 30 * 24 * 3600e3;
        interval = "d1";
    }
    const end = Date.now();
    const start = end - ms;
    const res = await fetch(
      `https://rest.coincap.io/v3/assets/${id}/history?interval=${interval}&start=${start}&end=${end}&apiKey=${API_KEY}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data as any[]).map((e) => ({
      t: e.time,
      y: parseFloat(e.priceUsd),
    }));
  }

  // Fetch single-asset details
  async function fetchCryptoDetails(id: string) {
    if (!API_KEY) return null;
    const res = await fetch(
      `https://rest.coincap.io/v3/assets/${id}?apiKey=${API_KEY}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as CryptoAsset;
  }

  // Load data & details
  async function updateChart() {
    setLoadingChart(true);
    const data = await fetchCryptoData(assetId, timeFrame);
    setChartData(data);
    const details = await fetchCryptoDetails(assetId);
    setCryptoDetails(details);
    setLoadingChart(false);
    trackEvent("CryptoChartLoaded", { id: assetId, timeFrame }); 
  }

  // When asset or timeframe changes
  useEffect(() => {
    updateChart();
  }, [assetId, timeFrame]);

  // Compute percent-change from first point
  const computePct = (d: HistoryEntry[]) => {
    if (!d.length) return [] as HistoryEntry[];
    const first = d[0].y;
    return d.map((pt) => ({ t: pt.t, y: ((pt.y - first) / first) * 100 }));
  };

  // Draw / redraw the Chart
  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    if (!chartData.length) return;

    const pctPts = computePct(chartData).map((pt) => ({
      x: new Date(pt.t),
      y: pt.y,
    }));
    const pricePts = chartData.map((pt) => ({
      x: new Date(pt.t),
      y: pt.y,
    }));

    if (chartType === "bubble") {
      pricePts.forEach((p: any) => (p.r = 5));
      pctPts.forEach((p: any) => (p.r = 5));
    }

    // Responsive tick limits
    let unit: "minute" | "hour" | "day" = "hour";
    let fmt = "MMM d, HH:mm";
    let maxTicks = 8;
    if (timeFrame === "1h") {
      unit = "minute";
      fmt = "HH:mm";
      maxTicks = 6;
    } else if (timeFrame === "7d") {
      unit = "day";
      fmt = "MMM d";
      maxTicks = 7;
    }

    const cfgData = {
      datasets: [
        {
          label: "Price (USD)",
          data: pricePts,
          borderColor: "rgb(75,192,192)",
          backgroundColor: "rgba(75,192,192,0.1)",
          yAxisID: "y1",
          showLine: chartType !== "scatter",
        },
        {
          label: "Price % Change",
          data: pctPts,
          borderColor: "rgb(255,99,132)",
          backgroundColor: "rgba(255,99,132,0.1)",
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
            unit,
            tooltipFormat: fmt,
            displayFormats: { minute: "HH:mm", hour: "HH:mm", day: "MMM d" },
          },
          ticks: { maxTicksLimit: maxTicks },
        },
        y1: { position: "left", title: { display: true, text: "USD" } },
        y2: { position: "right", title: { display: true, text: "%" } },
      },
      plugins: {
        zoom: {
          pan: { enabled: true, mode: "xy" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
        },
      },
      onClick: (_: MouseEvent, items: any[]) => {
        if (!items.length) return;
        const { datasetIndex, index } = items[0];
        const pt = cfgData.datasets[datasetIndex].data[index] as any;
        trackEvent("CryptoChartPointClick", { id: assetId, value: pt.y, time: pt.x }); 
        alert(`Value: ${pt.y}\nTime: ${pt.x}`);
      },
    };

    chartRef.current = new Chart(ctx, {
      type: chartType as keyof ChartTypeRegistry,
      data: {
        datasets: cfgData.datasets.map(dataset => ({
          ...dataset,
          data: dataset.data.map(pt => ({
            x: (pt as any).x.getTime(),
            y: pt.y,
            r: (pt as any).r
          }))
        }))
      },
      options: cfgOpts,
    });
  }, [chartData, chartType, timeFrame]);

  // Dismiss initial spinner
  useEffect(() => {
    const t = setTimeout(() => {}, 0);
    return () => clearTimeout(t);
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const id = await resolveAssetId(query.trim());
    if (id) {
      setError(null);
      setAssetId(id);
      trackEvent("CryptoChartSearch", { query: query.trim(), id });
    } else {
      setError("Asset not found. Try BTC, ETH, etc.");
      trackEvent("CryptoChartSearchFail", { query: query.trim() }); 
    }
  };

  const priceColor =
    cryptoDetails && parseFloat(cryptoDetails.changePercent24Hr) >= 0
      ? "text-green-500"
      : "text-red-500";

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-4">
        Crypto Chart & Prices
      </h2>

      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center gap-2 mb-6"
      >
        <input
          className="border p-2 flex-1 rounded dark:bg-brand-900 dark:text-white"
          placeholder="bitcoin or BTC"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="bg-indigo-600 text-white px-4 py-2 rounded"
          onClick={() => trackEvent("CryptoChartSearchBtnClick")}
        >
          Search
        </button>
      </form>

      <div className="flex flex-col sm:flex-row justify-end gap-4 mb-4">
        <div>
          <label className="mr-2 ">Chart:</label>
          <select
            className="border p-1 rounded dark:bg-brand-900"
            value={chartType}
            onChange={(e) => {
              setChartType(e.target.value);
              trackEvent("CryptoChartTypeChange", { chartType: e.target.value });
            }}
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="scatter">Scatter</option>
            <option value="bubble">Bubble</option>
            <option value="radar">Radar</option>
            <option value="pie">Pie</option>
            <option value="doughnut">Doughnut</option>
            <option value="polarArea">Polar Area</option>
          </select>
        </div>
        <div>
          <label className="mr-2 ">Time:</label>
          <select
            className="border p-1 rounded dark:bg-brand-900"
            value={timeFrame}
            onChange={(e) => {
              setTimeFrame(e.target.value as TimeFrameOption);
              trackEvent("CryptoTimeFrameChange", { timeFrame: e.target.value }); 
            }}
          >
            <option value="1h">1h</option>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center">
          {error}
        </div>
      )}

      {/* Responsive chart */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 mb-6">
        <canvas ref={canvasRef} className="w-full h-full" />
        {loadingChart && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            Loading…
          </div>
        )}
      </div>

      {["line", "bar", "scatter", "bubble"].includes(chartType) &&
        chartData.length > 0 && (
          <div className="text-center mb-6">
            <button
              onClick={() => {
                (chartRef.current as any)?.resetZoom();
                trackEvent("CryptoChartResetZoom", { id: assetId }); 
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded"
            >
              Reset Zoom
            </button>
          </div>
        )}

      {cryptoDetails && (
        <div className="overflow-x-auto">
          <h3 className="text-xl font-bold mb-3">
            {cryptoDetails.name} ({cryptoDetails.symbol}) Details
          </h3>
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2 font-medium">Rank</td>
                <td className="px-4 py-2">{cryptoDetails.rank}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Price (USD)</td>
                <td className={`px-4 py-2 ${priceColor}`}>
                  ${parseFloat(cryptoDetails.priceUsd).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">24Hr % Change</td>
                <td className="px-4 py-2">
                  {parseFloat(cryptoDetails.changePercent24Hr).toFixed(2)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Market Cap</td>
                <td className="px-4 py-2">
                  ${parseFloat(cryptoDetails.marketCapUsd).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Supply</td>
                <td className="px-4 py-2">
                  {parseInt(cryptoDetails.supply).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Max Supply</td>
                <td className="px-4 py-2">
                  {cryptoDetails.maxSupply
                    ? parseInt(cryptoDetails.maxSupply).toLocaleString()
                    : "N/A"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">24Hr Volume</td>
                <td className="px-4 py-2">
                  ${parseFloat(cryptoDetails.volumeUsd24Hr).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">VWAP (24Hr)</td>
                <td className="px-4 py-2">
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
                onClick={() => trackEvent("CryptoExplorerClick", { id: assetId })} 
              >
                View Explorer
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CryptoChartPrices;
