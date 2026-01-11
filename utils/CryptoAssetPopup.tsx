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
  const [timeframeChange, setTimeframeChange] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const canvasKey = asset ? `${asset.id}-${timeframe}` : "placeholder";

  const destroyChart = () => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (canvasRef.current) Chart.getChart(canvasRef.current)?.destroy();
  };

  // lock body scroll behind modal
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  /* load chart ------------------------------------------------------ */
  useEffect(() => {
    if (!asset) return;

    destroyChart();
    setChartLoading(true);
    setTimeframeChange(null);

    const ctrl = new AbortController();
    const { signal } = ctrl;

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

        // compute timeframe % change
        const first = pts[0].y as number;
        const last = pts[pts.length - 1].y as number;
        if (!Number.isNaN(first) && first !== 0) {
          setTimeframeChange(((last - first) / first) * 100);
        } else {
          setTimeframeChange(0);
        }

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
    <div className="flex items-center gap-2 border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-2 rounded hover:scale-105 transition-transform">
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${color} text-xs sm:text-sm`}>
          {value}
        </span>
      </div>
    </div>
  );

  /* render ---------------------------------------------------------- */
  const logo = logos[asset.symbol?.toLowerCase()] ?? null;
  const priceNum =
    tradeInfo?.price != null ? tradeInfo.price : parseFloat(asset.priceUsd);
  const prevNum = tradeInfo?.prev ?? priceNum;
  const priceColor = priceNum >= prevNum ? "text-green-600" : "text-red-600";

  const changeLabel =
    timeframe === "1"
      ? "24h Change"
      : timeframe === "7"
        ? "7D Change"
        : "30D Change";

  const changeValue =
    timeframeChange != null
      ? pct(timeframeChange)
      : timeframe === "1"
        ? pct(asset.changePercent24Hr)
        : "—";

  const changeColor =
    timeframeChange != null
      ? timeframeChange >= 0
        ? "text-green-600"
        : "text-red-600"
      : parseFloat(asset.changePercent24Hr) >= 0
        ? "text-green-600"
        : "text-red-600";

  // explorer helper
  const explorerHost = asset.explorer ? host(asset.explorer) : null;
  const explorerHref =
    asset.explorer && explorerHost
      ? asset.explorer.includes("://")
        ? asset.explorer
        : `https://${asset.explorer}`
      : null;

  return (
    <AnimatePresence>
      <motion.div
        key="popup-bg"
        className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        // close only when clicking the backdrop itself
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* ✅ Centered container */}
        <div className="min-h-[100svh] w-full flex items-center justify-center px-3 py-3 sm:p-6">
          <motion.div
            key="popup-card"
            className="
              relative w-full max-w-md
              sm:rounded-2xl rounded-2xl
              bg-white dark:bg-brand-900
              border border-black/10 dark:border-white/10
              shadow-2xl overflow-hidden
              flex flex-col min-h-0
              max-h-[calc(100svh-24px)] sm:max-h-[85svh]
            "
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky top bar */}
            <div className="sticky top-0 z-20 border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur">
              <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3">
                {logo ? (
                  <span className="inline-flex items-center justify-center rounded-full p-[3px] bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 shadow-sm">
                    <img
                      src={logo}
                      alt={asset.symbol}
                      className="w-8 h-8 sm:w-9 sm:h-9"
                    />
                  </span>
                ) : (
                  <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/5 dark:bg-white/10" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h3 className="text-base sm:text-xl font-extrabold text-gray-900 dark:text-white truncate">
                      {asset.name}
                    </h3>
                    <span className="shrink-0 text-xs sm:text-sm font-bold text-gray-500 dark:text-white/60">
                      {asset.symbol.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-white/70">
                    Rank #{asset.rank}
                  </p>
                </div>

                <button
                  type="button"
                  className="h-10 w-10 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur flex items-center justify-center text-gray-700 dark:text-white hover:bg-white dark:hover:bg-white/15 shadow border border-black/5 dark:border-white/10"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>

              {/* Timeframe pills */}
              <div className="px-4 pb-3 sm:px-6 sm:pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["1", "1D"],
                      ["7", "7D"],
                      ["30", "30D"],
                    ] as const
                  ).map(([tf, label]) => {
                    const active = timeframe === tf;
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setTimeframe(tf)}
                        aria-pressed={active}
                        className={`
                          relative rounded-2xl px-3 py-2 text-xs font-extrabold
                          border transition
                          ${
                            active
                              ? "bg-indigo-600 text-white border-indigo-600 shadow"
                              : "bg-black/[0.03] dark:bg-white/[0.06] text-gray-900 dark:text-white border-black/10 dark:border-white/10 hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
                          }
                        `}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ✅ THIS is the scroll container (works on iOS) */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
              style={{
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                touchAction: "pan-y",
              }}
            >
              {/* chart */}
              <div className="relative w-full h-48 sm:h-56 rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 overflow-hidden shadow-sm">
                {chartLoading && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-black/40 flex items-center justify-center z-10">
                    <svg
                      className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-300"
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
                <div className="h-full w-full p-3">
                  <canvas
                    key={canvasKey}
                    ref={canvasRef}
                    className="w-full h-full"
                  />
                </div>
              </div>

              {/* key numbers */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <Metric
                  icon={<FaDollarSign className="text-indigo-600 dark:text-indigo-300" />}
                  label="Price"
                  value={usd(priceNum)}
                  color={priceColor}
                />
                <Metric
                  icon={<FaChartLine className="text-indigo-600 dark:text-indigo-300" />}
                  label={changeLabel}
                  value={changeValue}
                  color={changeColor}
                />
                <Metric
                  icon={<FaChartPie className="text-indigo-600 dark:text-indigo-300" />}
                  label="Market Cap"
                  value={compact(asset.marketCapUsd)}
                  color="text-gray-900 dark:text-white"
                />
                <Metric
                  icon={<FaCoins className="text-indigo-600 dark:text-indigo-300" />}
                  label="Volume (24h)"
                  value={compact(asset.volumeUsd24Hr)}
                  color="text-gray-900 dark:text-white"
                />
                <Metric
                  icon={<FaDatabase className="text-indigo-600 dark:text-indigo-300" />}
                  label="Supply"
                  value={compact(asset.supply)}
                  color="text-gray-900 dark:text-white"
                />
                <Metric
                  icon={<FaWarehouse className="text-indigo-600 dark:text-indigo-300" />}
                  label="Max Supply"
                  value={asset.maxSupply ? compact(asset.maxSupply) : "—"}
                  color="text-gray-900 dark:text-white"
                />
                <Metric
                  icon={<FaGlobeAmericas className="text-indigo-600 dark:text-indigo-300" />}
                  label="VWAP (24h)"
                  value={asset.vwap24Hr ? compact(asset.vwap24Hr) : "—"}
                  color="text-gray-900 dark:text-white"
                />
              </div>

              {/* explorer */}
              {explorerHost && explorerHref && (
                <div className="mt-5 flex justify-center">
                  <a
                    href={explorerHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-200 hover:bg-white dark:hover:bg-white/10 shadow-sm transition"
                  >
                    <FaLink className="text-indigo-600 dark:text-indigo-300" />
                    {explorerHost}
                  </a>
                </div>
              )}

              {/* breathing room so content doesn't tuck under sticky footer */}
              <div className="h-24 sm:h-20" />
            </div>

            {/* Sticky bottom bar */}
            <div className="sticky bottom-0 z-20 bg-white/92 dark:bg-brand-900/92 backdrop-blur border-t border-black/10 dark:border-white/10 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-indigo-600 text-white py-3 text-sm font-extrabold shadow hover:bg-indigo-700 transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
