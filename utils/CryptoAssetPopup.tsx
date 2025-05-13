"use client";

import React, { useEffect, useState, useRef, JSX } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import {
  FaDollarSign,
  FaChartLine,
  FaChartPie,
  FaCoins,
  FaDatabase,
  FaWarehouse,
  FaGlobeAmericas,
  FaLink,
} from "react-icons/fa";

/* helpers ----------------------------------------------------------- */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const pct = (n: number | string | null | undefined) =>
  n != null ? `${parseFloat(String(n)).toFixed(2)}%` : "N/A";
const usd = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return v != null && !Number.isNaN(v) ? currencyFmt.format(v) : "—";
};
const compact = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return v != null && !Number.isNaN(v) ? compactFmt.format(v) : "—";
};
const host = (u: string) => {
  try {
    return new URL(u.includes("://") ? u : `https://${u}`)
      .hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/* props ------------------------------------------------------------- */
type TradeInfo = { price: number; prev?: number };
interface Props {
  asset: any | null;
  logos: Record<string, string>;
  onClose: () => void;
  tradeInfo?: TradeInfo;
}

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";

export default function CryptoAssetPopup({
  asset,
  logos,
  onClose,
  tradeInfo,
}: Props) {
  const [timeframe, setTimeframe] = useState<"1" | "7" | "30">("1");
  const [chartLoading, setChartLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const canvasKey = asset ? `${asset.id}-${timeframe}` : "placeholder";

  const destroyChart = () => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (canvasRef.current) Chart.getChart(canvasRef.current)?.destroy();
  };

  /* load chart ------------------------------------------------------ */
  useEffect(() => {
    if (!asset) return;

    destroyChart();
    setChartLoading(true);

    const ctrl = new AbortController();
    const { signal } = ctrl;

    /* CoinCap interval map that always returns data */
    const interval =
      timeframe === "1" ? "m1" : timeframe === "7" ? "m30" : "h2";

    (async () => {
      try {
        const end = Date.now();
        const start = end - parseInt(timeframe, 10) * 86_400_000;

        const res = await fetch(
          `https://rest.coincap.io/v3/assets/${asset.id}/history?interval=${interval}&start=${start}&end=${end}&apiKey=${API_KEY}`,
          { signal },
        );
        if (signal.aborted) return;

        const json = await res.json();
        const raw = json.data || [];

        const pts =
          raw.length > 0
            ? raw.map((p: any) => ({
                x: new Date(p.time),
                y: parseFloat(p.priceUsd),
              }))
            : [
                { x: new Date(start), y: parseFloat(asset.priceUsd) },
                { x: new Date(end), y: parseFloat(asset.priceUsd) },
              ]; // fallback → flat line

        if (signal.aborted || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext("2d")!;
        chartRef.current = new Chart(ctx, {
          type: "line",
          data: { datasets: [{ data: pts, fill: true, pointRadius: 0 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { type: "time" }, y: {} },
          },
        });
      } catch (e: any) {
        if (e.name !== "AbortError") console.error("Chart load error:", e);
      } finally {
        if (!signal.aborted) setChartLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
      destroyChart();
    };
  }, [asset, timeframe]);

  /* early exit */
  if (!asset) return null;

  /* mini metric card */
  const Metric = ({
    icon,
    label,
    value,
    color = "text-gray-900",
  }: {
    icon: JSX.Element;
    label: string;
    value: string;
    color?: string;
  }) => (
    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded hover:scale-105 transition-transform">
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${color} text-xs sm:text-sm`}>{value}</span>
      </div>
    </div>
  );

  /* render ---------------------------------------------------------- */
  const logo = logos[asset.symbol?.toLowerCase()] ?? null;
  const priceNum =
    tradeInfo?.price != null ? tradeInfo.price : parseFloat(asset.priceUsd);
  const prevNum = tradeInfo?.prev ?? priceNum;
  const priceColor = priceNum >= prevNum ? "text-green-600" : "text-red-600";

  return (
    <AnimatePresence>
      <motion.div
        key="popup-bg"
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="popup-card"
          className="relative bg-white dark:bg-brand-900 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto px-4 py-5 sm:p-6 hover:scale-[1.02] transition-transform"
          initial={{ y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* close */}
          <button
            className="absolute top-3 right-4 text-indigo-600 hover:text-indigo-800 text-2xl hover:scale-110 transition-transform"
            onClick={onClose}
          >
            ×
          </button>

          {/* header */}
          <div className="flex items-center gap-2 mb-1">
            {logo && (
              <span className="inline-flex items-center justify-center bg-white/90 rounded-full p-[3px]">
                <img
                  src={logo}
                  alt={asset.symbol}
                  className="w-6 h-6 sm:w-8 sm:h-8"
                />
              </span>
            )}
            <h3 className="text-lg sm:text-2xl font-bold">{asset.name}</h3>
          </div>
          <p className="text-indigo-600 mb-4 text-sm sm:text-base">
            #{asset.rank} • {asset.symbol.toUpperCase()}
          </p>

          {/* timeframe buttons */}
          <div className="flex gap-2 mb-3">
            {([
              ["1", "1D"],
              ["7", "7D"],
              ["30", "30D"],
            ] as const).map(([tf, label]) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* chart */}
          <div className="relative w-full h-40 sm:h-48 mb-4">
            {chartLoading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10">
                <svg
                  className="w-8 h-8 animate-spin text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              </div>
            )}
            <canvas key={canvasKey} ref={canvasRef} className="w-full h-full" />
          </div>

          {/* metrics grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] sm:text-sm">
            <Metric
              icon={<FaDollarSign className="text-indigo-600" />}
              label="Price"
              value={usd(priceNum)}
              color={priceColor}
            />
            <Metric
              icon={<FaChartLine className="text-indigo-600" />}
              label="24h Change"
              value={pct(asset.changePercent24Hr)}
              color={
                parseFloat(asset.changePercent24Hr) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }
            />
            <Metric
              icon={<FaChartPie className="text-indigo-600" />}
              label="Market Cap"
              value={compact(asset.marketCapUsd)}
            />
            <Metric
              icon={<FaCoins className="text-indigo-600" />}
              label="Volume (24h)"
              value={compact(asset.volumeUsd24Hr)}
            />
            <Metric
              icon={<FaDatabase className="text-indigo-600" />}
              label="Supply"
              value={compact(asset.supply)}
            />
            <Metric
              icon={<FaWarehouse className="text-indigo-600" />}
              label="Max Supply"
              value={asset.maxSupply ? compact(asset.maxSupply) : "—"}
            />
            <Metric
              icon={<FaGlobeAmericas className="text-indigo-600" />}
              label="VWAP (24h)"
              value={asset.vwap24Hr ? compact(asset.vwap24Hr) : "—"}
            />
          </div>

          {/* explorer */}
          {asset.explorer &&
            (() => {
              const h = host(asset.explorer);
              if (!h) return null;
              const href = asset.explorer.includes("://")
                ? asset.explorer
                : `https://${asset.explorer}`;
              return (
                <div className="mt-4 text-center text-[11px] sm:text-sm">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:underline hover:scale-105 transition-transform"
                  >
                    <FaLink />
                    {h}
                  </a>
                </div>
              );
            })()}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
