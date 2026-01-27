"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarElement,
  CategoryScale,
  Chart,
  type ChartDataset,
  type ChartTypeRegistry,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  type TooltipItem,
} from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-adapter-date-fns";

import { trackEvent } from "@/utils/mixpanel";
import { chartColors, chartColorsRgba, gridColors } from "@/utils/colors";

Chart.register(
  TimeScale,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  zoomPlugin,
);

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
  "/api/CoinGeckoAPI?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const usd = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? currencyFmt.format(n) : "—";

const compact = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? compactFmt.format(n) : "—";

const pctText = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";

const percentClass = (v: number) =>
  v >= 0 ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300";

/** mobile-ish heuristic (Chart.js is canvas, so we need our own breakpoint) */
const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)")?.matches;

/** short $ formatter for axis ticks (less words on mobile) */
const axisUsd = (v: number, mobile: boolean) => {
  if (!Number.isFinite(v)) return "—";
  if (!mobile) return usd(v);

  const abs = Math.abs(v);
  // show compact like $12.3k, $4.5M
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  // small numbers: keep it tight
  if (abs >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(2)}`;
};

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

  /* ✅ viewport state so we can re-render chart options on resize */
  const [isMobile, setIsMobile] = useState(false);

  /* ---------------- refs ---------------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  /* ---------------- viewport watcher ---------------- */
  useEffect(() => {
    const set = () => setIsMobile(isMobileViewport());
    set();
    window.addEventListener("resize", set, { passive: true } as any);
    return () => window.removeEventListener("resize", set as any);
  }, []);

  /* ---------------- logo preload (once) ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const map: Record<string, string> = {};
        (json || []).forEach((c: any) => {
          if (c?.symbol) map[String(c.symbol).toLowerCase()] = c.image;
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
      `https://rest.coincap.io/v3/assets?search=${encodeURIComponent(q)}&apiKey=${API_KEY}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const list: CryptoAsset[] = json?.data || [];
    if (!list.length) return null;

    const lower = q.toLowerCase();
    const exact =
      list.find(
        (a) =>
          a.id?.toLowerCase?.() === lower ||
          a.symbol?.toLowerCase?.() === lower ||
          a.name?.toLowerCase?.() === lower,
      ) || list[0];

    return exact?.id || null;
  }, []);

  /* ---------------- history fetcher ---------------- */
  async function fetchSeries(id: string, tf: TimeFrameOption): Promise<HistoryEntry[]> {
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
      `https://rest.coincap.io/v3/assets/${id}/history?interval=${interval}&start=${start}&end=${end}&apiKey=${API_KEY}`,
    );
    if (!res.ok) return [];

    const json = await res.json();
    const raw = json?.data || [];

    const pts: HistoryEntry[] = raw
      .map((e: any) => ({
        t: Number(e.time),
        y: parseFloat(e.priceUsd),
      }))
      .filter((p: HistoryEntry) => Number.isFinite(p.t) && Number.isFinite(p.y));

    return pts;
  }

  /* ---------------- details fetcher ---------------- */
  async function fetchDetails(id: string) {
    if (!API_KEY) return null;
    const res = await fetch(`https://rest.coincap.io/v3/assets/${id}?apiKey=${API_KEY}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data || null) as CryptoAsset | null;
  }

  /* ---------------- chart+details update ---------------- */
  async function updateChart() {
    setLoadingChart(true);
    setError(null);

    try {
      const [data, details] = await Promise.all([
        fetchSeries(assetId, timeFrame),
        fetchDetails(assetId),
      ]);
      setChartData(data);
      setCryptoDetails(details);

      trackEvent("CryptoChartLoaded", { id: assetId, timeFrame, points: data.length });
      if (!data.length) setError("No chart data returned for that timeframe.");
    } catch (e: any) {
      setError("Failed to load chart data.");
      console.error("Crypto chart load error:", e);
    } finally {
      setLoadingChart(false);
    }
  }

  useEffect(() => {
    updateChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, timeFrame]);

  /* ---------------- derived metrics ---------------- */
  const derived = useMemo(() => {
    if (!chartData.length) {
      return {
        first: null as number | null,
        last: null as number | null,
        hi: null as number | null,
        lo: null as number | null,
        rangePct: null as number | null,
        changePct: null as number | null,
      };
    }

    const first = chartData[0].y;
    const last = chartData[chartData.length - 1].y;
    let hi = -Infinity;
    let lo = Infinity;

    for (const p of chartData) {
      if (p.y > hi) hi = p.y;
      if (p.y < lo) lo = p.y;
    }

    const changePct = first ? ((last - first) / first) * 100 : null;
    const rangePct = lo ? ((hi - lo) / lo) * 100 : null;

    return {
      first,
      last,
      hi: Number.isFinite(hi) ? hi : null,
      lo: Number.isFinite(lo) ? lo : null,
      rangePct,
      changePct,
    };
  }, [chartData]);

  /* ---------------- percent series ---------------- */
  const pctSeries = (d: HistoryEntry[]) => {
    if (!d.length) return [];
    const first = d[0].y;
    if (!first) return [];
    return d.map((pt) => ({ t: pt.t, y: ((pt.y - first) / first) * 100 }));
  };

  /* ---------------- chart render ---------------- */
  useEffect(() => {
    if (!canvasRef.current) return;

    // If no data, destroy existing chart and stop
    if (!chartData.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // axis formatting based on timeframe
    let unit: "minute" | "hour" | "day" = "hour";

    if (timeFrame === "1h") {
      unit = "minute";
    } else if (timeFrame === "7d" || timeFrame === "30d") {
      unit = "day";
    }

    const pricePts = chartData.map((p) => ({ x: new Date(p.t), y: p.y }));
    const pctPts = pctSeries(chartData).map((p) => ({ x: new Date(p.t), y: p.y }));

    const isLineLike = ["line", "bar", "scatter", "bubble"].includes(chartType);

    const lineDataset = (label: string, pts: any, color: string): ChartDataset =>
      ({
        label,
        data: pts,
        borderColor: color,
        fill: label.includes("Price") && chartType === "line",
        backgroundColor: color.replace("rgb(", "rgba(").replace(")", ",0.14)"),
        pointRadius: chartType === "scatter" ? (isMobile ? 2 : 3) : 0,
        showLine: chartType !== "scatter",
        tension: 0.25,
        yAxisID: label.includes("%") ? "y2" : "y1",
        borderWidth: isMobile ? 2 : 2,
      } as ChartDataset);

    const dataCfg = {
      datasets: [
        lineDataset("Price", pricePts, chartColorsRgba.price.solid),
        lineDataset("%", pctPts, chartColorsRgba.percent.solid),
      ],
    };

    const cfgOpts: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: isMobile ? 180 : 250 },
      interaction: { mode: "nearest", intersect: false },

      // ✅ better mobile padding so labels don't collide / clip
      layout: {
        padding: {
          left: isMobile ? 4 : 8,
          right: isMobile ? 4 : 8,
          top: isMobile ? 6 : 10,
          bottom: isMobile ? 2 : 6,
        },
      },

      scales: isLineLike
        ? {
          x: {
  type: "time",
  time: { unit },

  // ✅ no bottom labels (numbers)
  ticks: { display: false },

  // ✅ keep vertical gridlines if you want them (optional)
  grid: { color: gridColors.light },

  // ✅ no bottom axis line
  border: { display: false },
},

            y1: {
              position: "left",
              grid: { color: gridColors.light },
              ticks: {
                color: chartColors.price,
                padding: isMobile ? 4 : 6,
                font: { size: isMobile ? 10 : 12, weight: "700" },
                maxTicksLimit: isMobile ? 4 : 6,
                callback: (v: any) => axisUsd(Number(v), isMobile),
              },
            },
            y2: {
              position: "right",
              grid: { drawOnChartArea: false },
              ticks: {
                color: chartColors.percent,
                padding: isMobile ? 4 : 6,
                font: { size: isMobile ? 10 : 12, weight: "700" },
                maxTicksLimit: isMobile ? 4 : 6,
                callback: (v: any) => `${Number(v).toFixed(isMobile ? 0 : 1)}%`,
              },
            },
          }
        : undefined,

      plugins: {
        legend: { display: false },
        tooltip: {
          // ✅ bigger touch target on mobile
          padding: isMobile ? 10 : 8,
          titleFont: { size: isMobile ? 12 : 12, weight: "700" },
          bodyFont: { size: isMobile ? 12 : 12, weight: "700" },
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              const y = ctx.parsed.y;
              if (y === null || y === undefined) return `${ctx.dataset.label}: —`;
              return `${ctx.dataset.label}: ${
                String(ctx.dataset.label).includes("%")
                  ? `${y.toFixed(2)}%`
                  : usd(y)
              }`;
            },
          },
        },

        // ✅ make mobile zoom less annoying: allow pinch, but disable wheel
        zoom: {
          pan: { enabled: isLineLike, mode: "xy" },
          zoom: {
            wheel: { enabled: isLineLike && !isMobile },
            pinch: { enabled: isLineLike },
            mode: "xy",
          },
          limits: {
            y: { min: "original", max: "original" },
            x: { min: "original", max: "original" },
          },
        },
      },
    };

    chartRef.current = new Chart(ctx, {
      type: chartType,
      data: dataCfg,
      options: cfgOpts,
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chartData, chartType, timeFrame, isMobile]);

  /* ---------------- search handler ---------------- */
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoadingChart(true);

    const id = await resolveAssetId(q);
    if (id) {
      setError(null);
      setAssetId(id);
      trackEvent("CryptoChartSearch", { query: q, id });
    } else {
      setLoadingChart(false);
      setError("Asset not found. Try BTC, ETH, SOL, etc.");
      trackEvent("CryptoChartSearchFail", { query: q });
    }
  };

  /* ---------------- render ---------------- */
  const logoURL =
    cryptoDetails?.symbol &&
    logos[cryptoDetails.symbol.toLowerCase()]?.replace("large", "thumb");

  const change24h = cryptoDetails ? parseFloat(cryptoDetails.changePercent24Hr) : null;

  return (
    <div className="mx-auto max-w-4xl p-1">
      {/* header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {logoURL ? (
            <img
              src={logoURL}
              alt={cryptoDetails?.symbol || "crypto"}
              className="h-9 w-9 rounded-full bg-white p-1 ring-1 ring-black/5"
              loading="lazy"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-brand-900 ring-1 ring-black/5" />
          )}

          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {cryptoDetails
                ? `${cryptoDetails.name} (${cryptoDetails.symbol.toUpperCase()})`
                : "Charts & Metrics"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Search any CoinCap asset
            </p>
          </div>
        </div>

        {/* status */}
        <div className="text-right">
          <div className="text-xs text-gray-500 dark:text-gray-400">24h</div>
          <div
            className={`text-sm font-bold ${
              change24h == null ? "text-gray-400" : percentClass(change24h)
            }`}
          >
            {change24h == null ? "—" : pctText(change24h)}
          </div>
        </div>
      </div>

      {/* search */}
      <form onSubmit={handleSearch} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       dark:border-white/10 dark:bg-brand-900 dark:text-white dark:placeholder:text-gray-500"
            placeholder="Search (e.g. bitcoin, BTC, ethereum)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {error && <div className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</div>}
        </div>

        <button
          type="submit"
          className="rounded-xl bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white px-4 py-2 text-sm font-semiboldshadow-sm hover:bg-indigo-500
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onClick={() => trackEvent("CryptoChartSearchBtnClick")}
        >
          Search
        </button>
      </form>

      {/* controls */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
          {(["1h", "24h", "7d", "30d"] as TimeFrameOption[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTimeFrame(t);
                trackEvent("CryptoTimeFrameChange", { timeFrame: t });
              }}
              className={`px-3 py-2 text-xs font-semibold transition ${
                timeFrame === t
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-brand-900 dark:text-gray-200 dark:hover:bg-brand-900/40"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm
                       dark:border-white/10 dark:bg-brand-900 dark:text-gray-200"
            value={chartType}
            onChange={(e) => {
              const v = e.target.value as keyof ChartTypeRegistry;
              setChartType(v);
              trackEvent("CryptoChartTypeChange", { chartType: v });
            }}
          >
            {["line", "bar", "scatter", "bubble"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              chartRef.current?.resetZoom();
              trackEvent("CryptoChartResetZoom", { id: assetId });
            }}
            disabled={!chartData.length}
            className={`rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition ${
              chartData.length
                ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white/10 dark:hover:bg-white/15"
                : "bg-gray-200 text-gray-500 dark:bg-white/5 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            Reset zoom
          </button>
        </div>
      </div>

      {/* quick stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-white/10 dark:bg-brand-900">
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Last</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {derived.last == null ? "—" : usd(derived.last)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-white/10 dark:bg-brand-900">
          <div className="text-[11px] text-gray-500 dark:text-gray-400">High</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {derived.hi == null ? "—" : usd(derived.hi)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-white/10 dark:bg-brand-900">
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Low</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {derived.lo == null ? "—" : usd(derived.lo)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-white/10 dark:bg-brand-900">
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Range</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {derived.rangePct == null ? "—" : pctText(derived.rangePct)}
          </div>
        </div>
      </div>

      {/* chart */}
      <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900 sm:h-80 md:h-96">
        <canvas ref={canvasRef} className="h-full w-full" />

        <AnimatePresence>
          {loadingChart && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-brand-900/70 backdrop-blur"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-black/30 dark:text-white dark:ring-white/10">
                Loading…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* details */}
      {cryptoDetails && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Rank</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">#{cryptoDetails.rank}</div>
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Market cap</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {compact(parseFloat(cryptoDetails.marketCapUsd))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Price</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {usd(parseFloat(cryptoDetails.priceUsd))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">24h</div>
              <div className={`text-sm font-bold ${percentClass(parseFloat(cryptoDetails.changePercent24Hr))}`}>
                {pctText(parseFloat(cryptoDetails.changePercent24Hr))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Volume</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {compact(parseFloat(cryptoDetails.volumeUsd24Hr))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Supply</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {compact(parseFloat(cryptoDetails.supply))}
              </div>
            </div>
          </div>

          {cryptoDetails.explorer && (
            <div className="mt-4 text-center">
              <a
                href={cryptoDetails.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                onClick={() => trackEvent("CryptoExplorerClick", { id: assetId })}
              >
                View explorer
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CryptoChartPrices;
