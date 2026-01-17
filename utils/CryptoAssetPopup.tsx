"use client";

import React, { useEffect, useMemo, useRef, useState, JSX } from "react";
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
  n != null ? `${parseFloat(String(n)).toFixed(2)}%` : "—";

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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/* props ------------------------------------------------------------- */
type TradeInfo = { price: number; prev?: number };
interface Props {
  asset: any | null;
  logos: Record<string, string>;
  onClose: () => void;
  tradeInfo?: TradeInfo;
}

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";

export default function CryptoAssetPopup({ asset, logos, onClose, tradeInfo }: Props) {
  const [timeframe, setTimeframe] = useState<"1" | "7" | "30">("1");
  const [chartLoading, setChartLoading] = useState(false);
  const [timeframeChange, setTimeframeChange] = useState<number | null>(null);
  const [change24hStatic, setChange24hStatic] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const canvasKey = asset ? `${asset.id}-${timeframe}` : "placeholder";

  const destroyChart = () => {
    try {
      chartRef.current?.destroy();
    } catch { }
    chartRef.current = null;

    if (canvasRef.current) {
      try {
        Chart.getChart(canvasRef.current)?.destroy();
      } catch { }
    }
  };

  // lock body scroll behind modal + escape key close
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

      useEffect(() => {
    if (!asset) return;
    const v = parseFloat(asset.changePercent24Hr);
    setChange24hStatic(Number.isFinite(v) ? v : null);
  }, [asset]);

  /* load chart ------------------------------------------------------ */
  useEffect(() => {
    if (!asset) return;

    destroyChart();
    setChartLoading(true);
    setTimeframeChange(null);

    const ctrl = new AbortController();
    const { signal } = ctrl;

    const interval = timeframe === "1" ? "m1" : timeframe === "7" ? "m30" : "h2";

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
            ];

        if (signal.aborted || !canvasRef.current) return;

                // compute timeframe % change
        const first = pts[0]?.y as number;
        const last = pts[pts.length - 1]?.y as number;

        const computed =
          !Number.isNaN(first) && first !== 0 ? ((last - first) / first) * 100 : 0;

        setTimeframeChange(computed);

        // ✅ only update the STATIC 24h value when we're on 1D
        if (timeframe === "1") setChange24hStatic(computed);


        // dynamic bounds to reduce chart "flatline" feeling
        const ys = pts.map((p: any) => p.y).filter((v: any) => typeof v === "number" && !Number.isNaN(v));
        const minY = ys.length ? Math.min(...ys) : 0;
        const maxY = ys.length ? Math.max(...ys) : 0;
        const pad = (maxY - minY) * 0.08 || (maxY || 1) * 0.02;

        // ✅ smoother looking line
        const ctx = canvasRef.current.getContext("2d")!;
        chartRef.current = new Chart(ctx, {
          type: "line",
          data: {
            datasets: [
              {
                data: pts,
                fill: true,
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.32,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 220, easing: "easeOutQuart" },
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                displayColors: false,
                padding: 10,
                callbacks: {
                  label: (ctx) => ` ${usd(ctx.parsed.y)}`,
                },
              },
            },
            scales: {
              x: {
                type: "time",
                ticks: {
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: timeframe === "1" ? 5 : timeframe === "7" ? 6 : 6,
                },
                grid: { display: false },
              },
              y: {
                beginAtZero: false,
                suggestedMin: minY - pad,
                suggestedMax: maxY + pad,
                ticks: {
                  callback: (value) => compact(value as number),
                  maxTicksLimit: 5,
                },
                grid: { color: "rgba(0,0,0,0.06)" },
              },
            },
          },
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Chart load error:", e);
      } finally {
        if (!signal.aborted) setChartLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
      destroyChart();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, timeframe]);

  /* early exit */
  if (!asset) return null;

  /* mini metric card */
  const Metric = ({
    icon,
    label,
    value,
    color = "text-gray-900 dark:text-white",
  }: {
    icon: JSX.Element;
    label: string;
    value: string;
    color?: string;
  }) => (
    <div
      className={[
        "rounded-2xl p-3",
        "border border-black/10 dark:border-white/10",
        "bg-white/70 dark:bg-white/[0.06]",
        "shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-white/60">
          {label}
        </span>
      </div>
      <div className={`mt-1 text-sm sm:text-base font-extrabold ${color}`}>{value}</div>
    </div>
  );

  /* render ---------------------------------------------------------- */
  const logo = logos[asset.symbol?.toLowerCase()] ?? null;

  const priceNum =
    tradeInfo?.price != null ? tradeInfo.price : parseFloat(asset.priceUsd);

  const prevNum = tradeInfo?.prev ?? priceNum;
  const priceColor = priceNum >= prevNum ? "text-emerald-600" : "text-rose-600";

  const changeLabel = timeframe === "1" ? "24h Change" : timeframe === "7" ? "7D Change" : "30D Change";


  // explorer helper
  const explorerHost = asset.explorer ? host(asset.explorer) : null;
  const explorerHref =
    asset.explorer && explorerHost
      ? asset.explorer.includes("://")
        ? asset.explorer
        : `https://${asset.explorer}`
      : null;

  const rank = Number(asset.rank ?? 0);
  const rankLabel = Number.isFinite(rank) && rank > 0 ? `Rank #${rank}` : "Rank —";

  // --------- unify change values everywhere ----------
  const asset24h = parseFloat(asset.changePercent24Hr);

  // Canonical change number for the currently selected timeframe
  // - 1D: prefer computed timeframeChange (from history), fallback to asset.changePercent24Hr
  // - 7D/30D: use computed timeframeChange (from history) when available
  const canonicalChange: number | null =
    timeframe === "1"
      ? (timeframeChange ?? (Number.isFinite(asset24h) ? asset24h : null))
      : (timeframeChange ?? null);

  const changeValue = canonicalChange != null ? pct(canonicalChange) : "—";
  const baseChange = canonicalChange ?? 0;

  const changeColor = baseChange >= 0 ? "text-emerald-600" : "text-rose-600";

  const changePillBg =
    baseChange >= 0
      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200"
      : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-200";


  const tfButtons =
    [
      { tf: "1" as const, label: "1D" },
      { tf: "7" as const, label: "7D" },
      { tf: "30" as const, label: "30D" },
    ] as const;



  return (
    <AnimatePresence>
      <motion.div
        key="popup-bg"
        className="fixed inset-0 z-50 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        // close only when clicking the backdrop itself
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* ✅ Centered container; overlay scroll is allowed, card scroll handles content */}
        <div
          className="relative min-h-[100svh] w-full px-3 py-3 sm:px-6 sm:py-8 flex items-center justify-center"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <motion.div
            key="popup-card"
            className={[
              "relative w-full max-w-xl",
              "rounded-3xl",
              "bg-white dark:bg-brand-900",
              "border border-black/10 dark:border-white/10",
              "shadow-2xl overflow-hidden",
              "flex flex-col min-h-0",
              "max-h-[calc(100svh-24px)] sm:max-h-[85svh]",
            ].join(" ")}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header w/ subtle glow (NO purple hover junk) */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
                <div className="absolute -top-16 -left-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
              </div>

              <div className="relative sticky top-0 z-20 bg-white/85 dark:bg-brand-900/85 backdrop-blur border-b border-black/10 dark:border-white/10">
                <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-start gap-3">
                  {/* logo */}
                  <div className="shrink-0">
                    {logo ? (
                      <span className="inline-flex items-center justify-center rounded-2xl p-2 bg-white/70 dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10 shadow-sm">
                        <img
                          src={logo}
                          alt={asset.symbol}
                          className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
                        />
                      </span>
                    ) : (
                      <span className="h-11 w-11 rounded-2xl bg-black/5 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10" />
                    )}
                  </div>

                  {/* title */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="truncate text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white">
                        {asset.name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-gray-700 dark:text-white/80 ring-1 ring-black/10 dark:ring-white/10">
                        {asset.symbol?.toUpperCase?.() ?? ""}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-gray-600 dark:text-white/60">
                        {rankLabel}
                      </span>

                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                          "ring-1",
                          changePillBg,
                        ].join(" ")}
                        title={changeLabel}
                      >
                        {changeLabel}: {changeValue}
                      </span>
                    </div>
                  </div>

                  {/* close */}
                  <button
                    type="button"
                    className="h-10 w-10 rounded-2xl bg-white/70 dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-gray-800 dark:text-white shadow-sm hover:bg-white dark:hover:bg-white/[0.10] transition"
                    onClick={onClose}
                    aria-label="Close"
                  >
                    <span className="text-2xl leading-none">×</span>
                  </button>
                </div>

                {/* timeframe pills */}
                <div className="px-4 pb-3 sm:px-6 sm:pb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {tfButtons.map(({ tf, label }) => {
                      const active = timeframe === tf;
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setTimeframe(tf)}
                          aria-pressed={active}
                          className={[
                            "rounded-2xl px-3 py-2 text-xs font-extrabold",
                            "border transition shadow-sm",
                            active
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-black/[0.03] dark:bg-white/[0.06] text-gray-900 dark:text-white border-black/10 dark:border-white/10 hover:bg-black/[0.06] dark:hover:bg-white/[0.10]",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Scroll content */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
              style={{
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                touchAction: "pan-y",
              }}
            >
              {/* Price row (big + readable on mobile) */}
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-white/60">
                    Current Price
                  </div>
                  <div className={`truncate text-2xl sm:text-3xl font-extrabold ${priceColor}`}>
                    {usd(priceNum)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-white/60">
                    {changeLabel}
                  </div>
                  <div className={`text-lg sm:text-xl font-extrabold ${changeColor}`}>
                    {changeValue}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="mt-4">
                <div className="relative rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                      Price Chart
                    </div>
                    <div className="text-xs font-bold text-gray-500 dark:text-white/60">
                      {timeframe === "1" ? "Last 24h" : timeframe === "7" ? "Last 7 days" : "Last 30 days"}
                    </div>
                  </div>

                  <div className="relative h-52 sm:h-64 px-3 pb-3">
                    {chartLoading && (
                      <div className="absolute inset-0 bg-white/60 dark:bg-black/35 flex items-center justify-center z-10">
                        <div className="flex items-center gap-3">
                          <svg
                            className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-300"
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
                          <span className="text-sm font-extrabold text-gray-700 dark:text-white/80">
                            Loading chart…
                          </span>
                        </div>
                      </div>
                    )}

                    {/* subtle corner fade so the chart feels “finished” */}
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.02] via-transparent to-black/[0.02] dark:from-white/[0.02] dark:to-white/[0.02]" />
                    </div>

                    <canvas key={canvasKey} ref={canvasRef} className="w-full h-full" />
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric
                  icon={<FaChartPie className="text-indigo-600 dark:text-indigo-300" />}
                  label="Market Cap"
                  value={compact(asset.marketCapUsd)}
                />
                <Metric
                  icon={<FaCoins className="text-indigo-600 dark:text-indigo-300" />}
                  label="Volume (24h)"
                  value={compact(asset.volumeUsd24Hr)}
                />
                <Metric
                  icon={<FaDatabase className="text-indigo-600 dark:text-indigo-300" />}
                  label="Supply"
                  value={compact(asset.supply)}
                />
                <Metric
                  icon={<FaWarehouse className="text-indigo-600 dark:text-indigo-300" />}
                  label="Max Supply"
                  value={asset.maxSupply ? compact(asset.maxSupply) : "—"}
                />
                <Metric
                  icon={<FaGlobeAmericas className="text-indigo-600 dark:text-indigo-300" />}
                  label="VWAP (24h)"
                  value={asset.vwap24Hr ? compact(asset.vwap24Hr) : "—"}
                />
                <Metric
  icon={<FaChartLine className="text-indigo-600 dark:text-indigo-300" />}
  label="24h Change"
  value={change24hStatic != null ? pct(change24hStatic) : pct(asset.changePercent24Hr)}
  color={
    (change24hStatic != null ? change24hStatic : parseFloat(asset.changePercent24Hr)) >= 0
      ? "text-emerald-600"
      : "text-rose-600"
  }
/>


              </div>

              {/* Explorer */}
              {explorerHost && explorerHref && (
                <div className="mt-5">
                  <a
                    href={explorerHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={[
                      "w-full inline-flex items-center justify-center gap-2",
                      "rounded-2xl",
                      "border border-black/10 dark:border-white/10",
                      "bg-white/70 dark:bg-white/[0.06]",
                      "px-4 py-3",
                      "text-sm font-extrabold",
                      "text-gray-900 dark:text-white",
                      "shadow-sm hover:bg-white dark:hover:bg-white/[0.10] transition",
                    ].join(" ")}
                  >
                    <FaLink className="text-indigo-600 dark:text-indigo-300" />
                    Open Explorer ({explorerHost})
                  </a>
                </div>
              )}

              {/* breathing room */}
              <div className="h-20" />
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
