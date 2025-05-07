"use client";

import React, {
  useState,
  useEffect,
  useRef,
  FormEvent,
  useCallback,
} from "react";
import {
  Chart,
  ChartTypeRegistry,
  TooltipItem,
  ChartDataset,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
} from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-adapter-date-fns";
import { trackEvent } from "@/utils/mixpanel";

Chart.register(TimeScale, LinearScale, PointElement, LineElement, zoomPlugin);

/* ------------------------------------------------------------------ */
/*                               Types                                */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*                        Constants / helpers                         */
/* ------------------------------------------------------------------ */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

const formatUSD = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const percentColor = (v: number) => (v >= 0 ? "text-green-500" : "text-red-500");

/* ------------------------------------------------------------------ */
/*                           Main component                           */
/* ------------------------------------------------------------------ */
const CryptoChartPrices: React.FC = () => {
  /* ---------------- state ---------------- */
  const [query, setQuery] = useState("bitcoin");
  const [assetId, setAssetId] = useState("bitcoin");
  const [chartData, setChartData] = useState<HistoryEntry[]>([]);
  const [cryptoDetails, setCryptoDetails] = useState<CryptoAsset | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<keyof ChartTypeRegistry>("line");
  const [timeFrame, setTimeFrame] = useState<TimeFrameOption>("24h");
  const [logos, setLogos] = useState<Record<string, string>>({}); // symbol → imageURL

  /* ---------------- refs ---------------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  /* ---------------- logo preload (once) ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const map: Record<string, string> = {};
        json.forEach((c: any) => {
          map[c.symbol.toLowerCase()] = c.image;
        });
        setLogos(map);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* ---------------- asset ID resolver ---------------- */
  const resolveAssetId = useCallback(async (q: string): Promise<string | null> => {
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
    const exact =
      list.find(
        (a) =>
          a.id.toLowerCase() === lower ||
          a.symbol.toLowerCase() === lower ||
          a.name.toLowerCase() === lower
      ) || list[0];
    return exact.id;
  }, []);

  /* ---------------- history fetcher ---------------- */
  async function fetchSeries(
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
    return (json.data || []).map((e: any) => ({
      t: e.time,
      y: parseFloat(e.priceUsd),
    }));
  }

  /* ---------------- details fetcher ---------------- */
  async function fetchDetails(id: string) {
    if (!API_KEY) return null;
    const res = await fetch(
      `https://rest.coincap.io/v3/assets/${id}?apiKey=${API_KEY}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as CryptoAsset;
  }

  /* ---------------- chart+details update ---------------- */
  async function updateChart() {
    setLoadingChart(true);
    const [data, details] = await Promise.all([
      fetchSeries(assetId, timeFrame),
      fetchDetails(assetId),
    ]);
    setChartData(data);
    setCryptoDetails(details);
    setLoadingChart(false);
    trackEvent("CryptoChartLoaded", { id: assetId, timeFrame });
  }

  useEffect(() => {
    updateChart();
  }, [assetId, timeFrame]);

  /* ---------------- percent helper ---------------- */
  const pctSeries = (d: HistoryEntry[]) => {
    if (!d.length) return [];
    const first = d[0].y;
    return d.map((pt) => ({ t: pt.t, y: ((pt.y - first) / first) * 100 }));
  };

  /* ---------------- chart render ---------------- */
  useEffect(() => {
    if (!canvasRef.current || !chartData.length) return;

    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    /* dynamic axis formatting */
    let unit: "minute" | "hour" | "day" = "hour";
    let maxTicks = 8;
    if (timeFrame === "1h") {
      unit = "minute";
      maxTicks = 6;
    } else if (timeFrame === "7d") {
      unit = "day";
      maxTicks = 7;
    }

    const lineDataset = (label: string, pts: any, color: string): ChartDataset =>
      ({
        label,
        data: pts,
        borderColor: color,
        backgroundColor: color.replace("rgb(", "rgba(").replace(")", ",0.12)"),
        pointRadius: chartType === "scatter" ? 3 : 0,
        showLine: chartType !== "scatter",
        tension: 0.25,
        yAxisID: label.includes("%") ? "y2" : "y1",
      } as ChartDataset);

    const pricePts  = chartData.map((p) => ({ x: new Date(p.t), y: p.y }));
    const pctPts    = pctSeries(chartData).map((p) => ({ x: new Date(p.t), y: p.y }));

    const dataCfg = {
      datasets: [
        lineDataset("Price (USD)", pricePts, "rgb(56,161,219)"),
        lineDataset("Change (%)", pctPts, "rgb(229,62,62)"),
      ],
    };

    const cfgOpts: any = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: {
          type: "time",
          time: { unit },
          ticks: { maxTicksLimit: maxTicks, color: "#888" },
          grid: { color: "" },
        },
        y1: { position: "left", grid: { color: "" }, ticks: { color: "#38a1db" } },
        y2: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#e53e3e", callback: (v: any) => `${v}%` },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"line">) =>
              ctx.dataset.label +
              ": " +
              (ctx.dataset.label?.includes("%")
                ? `${ctx.parsed.y.toFixed(2)}%`
                : `$${formatUSD(ctx.parsed.y)}`),
          },
        },
        zoom: {
          pan: { enabled: true, mode: "xy" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
        },
      },
    };

    chartRef.current = new Chart(ctx, {
      type: chartType,
      data: dataCfg,
      options: cfgOpts,
    });
  }, [chartData, chartType, timeFrame]);

  /* ---------------- search handler ---------------- */
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

  /* ---------------- render ---------------- */
  const logoURL =
    cryptoDetails?.symbol &&
    logos[cryptoDetails.symbol.toLowerCase()]?.replace("large", "thumb");

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-4">Charts & Metrics</h2>

      {/* search */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center gap-2 mb-6"
      >
        <input
          className="border p-2 flex-1 rounded dark:bg-brand-900 dark:text-white"
          placeholder="e.g. bitcoin or BTC"
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

      {/* selectors */}
      <div className="flex flex-col sm:flex-row justify-end gap-4 mb-4">
        <select
          className="border p-1 rounded dark:bg-brand-900"
          value={chartType}
          onChange={(e) => {
            setChartType(e.target.value as keyof ChartTypeRegistry);
            trackEvent("CryptoChartTypeChange", { chartType: e.target.value });
          }}
        >
          {[
            "line",
            "bar",
            "scatter",
            "bubble",
            "radar",
            "pie",
            "doughnut",
            "polarArea",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <select
          className="border p-1 rounded dark:bg-brand-900"
          value={timeFrame}
          onChange={(e) => {
            setTimeFrame(e.target.value as TimeFrameOption);
            trackEvent("CryptoTimeFrameChange", { timeFrame: e.target.value });
          }}
        >
          {["1h", "24h", "7d", "30d"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* chart */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 mb-6 border rounded">
        <canvas ref={canvasRef} className="w-full h-full" />
        {loadingChart && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-brand-900/70">
            Loading…
          </div>
        )}
      </div>

      {/* reset zoom */}
      {["line", "bar", "scatter", "bubble"].includes(chartType) &&
        chartData.length > 0 && (
          <div className="text-center mb-6">
            <button
              onClick={() => {
                chartRef.current?.resetZoom();
                trackEvent("CryptoChartResetZoom", { id: assetId });
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded"
            >
              Reset Zoom
            </button>
          </div>
        )}

      {/* details */}
      {cryptoDetails && (
        <div className="overflow-x-auto">
          <div className="flex items-center gap-3 mb-3">
            {logoURL && (
              <img
                src={logoURL}
                alt={cryptoDetails.symbol}
                className="w-8 h-8"
              />
            )}
            <h3 className="text-xl font-bold">
              {cryptoDetails.name} ({cryptoDetails.symbol})
            </h3>
          </div>

          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2 font-medium">Rank</td>
                <td className="px-4 py-2">{cryptoDetails.rank}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Price (USD)</td>
                <td className={`px-4 py-2 ${percentColor(
                  parseFloat(cryptoDetails.changePercent24Hr)
                )}`}>
                  ${formatUSD(parseFloat(cryptoDetails.priceUsd))}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">% Change (24h)</td>
                <td className={percentColor(
                  parseFloat(cryptoDetails.changePercent24Hr)
                ) + " px-4 py-2"}>
                  {parseFloat(cryptoDetails.changePercent24Hr).toFixed(2)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Market Cap</td>
                <td className="px-4 py-2">
                  ${formatUSD(parseFloat(cryptoDetails.marketCapUsd))}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Supply</td>
                <td className="px-4 py-2">
                  {parseFloat(cryptoDetails.supply).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Max Supply</td>
                <td className="px-4 py-2">
                  {cryptoDetails.maxSupply
                    ? parseFloat(cryptoDetails.maxSupply).toLocaleString()
                    : "N/A"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Volume (24h)</td>
                <td className="px-4 py-2">
                  ${formatUSD(parseFloat(cryptoDetails.volumeUsd24Hr))}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">VWAP (24h)</td>
                <td className="px-4 py-2">
                  {cryptoDetails.vwap24Hr
                    ? `$${formatUSD(parseFloat(cryptoDetails.vwap24Hr))}`
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
                className="text-indigo-600 hover:underline"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("CryptoExplorerClick", { id: assetId })
                }
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
