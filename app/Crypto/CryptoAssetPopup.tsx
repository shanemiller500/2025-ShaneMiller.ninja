// CryptoAssetPopup.tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import { fetchCoinCap } from "@/utils/coincap-client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { ArrowDownRight, ArrowUpRight, ExternalLink, X } from "lucide-react";

/* Types ------------------------------------------------------------ */
type Timeframe = "1" | "7" | "30";

interface TradeInfo {
  price: number;
  prev?: number;
  direction?: "up" | "down" | "neutral";
  bump?: number;
}

interface CoinGeckoMarket {
  id: string; symbol: string; name: string; image?: string;
  current_price?: number; market_cap?: number; market_cap_rank?: number;
  fully_diluted_valuation?: number | null; total_volume?: number;
  high_24h?: number; low_24h?: number; price_change_24h?: number;
  price_change_percentage_24h?: number; market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number; circulating_supply?: number;
  total_supply?: number | null; max_supply?: number | null;
  ath?: number; ath_change_percentage?: number; ath_date?: string;
  atl?: number; atl_change_percentage?: number; atl_date?: string; last_updated?: string;
}

interface Props {
  asset: any | null;
  logos: Record<string, string>;
  onClose: () => void;
  tradeInfo?: TradeInfo;
}

/* Utilities -------------------------------------------------------- */
const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const smallFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 4 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

const num = (n: unknown): number | null => {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  return v != null && Number.isFinite(v) ? v : null;
};

const fmt = {
  percent: (n: unknown) => {
    const v = num(n);
    return v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
  },
  currency: (n: unknown) => {
    const v = num(n);
    if (v == null) return "—";
    return Math.abs(v) < 1 ? smallFmt.format(v) : currencyFmt.format(v);
  },
  compact: (n: unknown, prefix = "") => {
    const v = num(n);
    return v == null ? "—" : `${prefix}${compactFmt.format(v)}`;
  },
  date: (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  },
};

const extractHostname = (url: string) => {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const isDarkMode = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

const TIMEFRAMES: { key: Timeframe; label: string; span: string }[] = [
  { key: "1", label: "1D", span: "Last 24 hours" },
  { key: "7", label: "7D", span: "Last 7 days" },
  { key: "30", label: "30D", span: "Last 30 days" },
];

/* Wrapper: owns the enter/exit animation ---------------------------- */
/* Portaled to <body> so a transformed / blurred ancestor can't trap the fixed overlay. */
export default function CryptoAssetPopup(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {props.asset && <AssetDialog key={props.asset.id ?? props.asset.symbol} {...props} asset={props.asset} />}
    </AnimatePresence>,
    document.body
  );
}

/* Dialog ----------------------------------------------------------- */
function AssetDialog({ asset, logos, onClose, tradeInfo }: Props & { asset: any }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1");
  const [chartLoading, setChartLoading] = useState(true);
  const [timeframeChange, setTimeframeChange] = useState<number | null>(null);
  const [cgLoading, setCgLoading] = useState(true);
  const [cgError, setCgError] = useState<string | null>(null);
  const [cg, setCg] = useState<CoinGeckoMarket | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /* Esc to close, focus the close button, lock page scroll — only while open */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  /* CoinGecko market snapshot */
  useEffect(() => {
    const ctrl = new AbortController();
    setCgLoading(true);
    setCgError(null);

    (async () => {
      try {
        const qs = "vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false";
        const res = await fetch(`/api/CoinGeckoAPI?${qs}`, {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`CoinGecko proxy error: ${res.status}`);

        const markets = (await res.json()) as CoinGeckoMarket[];
        if (ctrl.signal.aborted) return;

        const aId = String(asset.id || "").toLowerCase();
        const aSym = String(asset.symbol || "").toLowerCase();
        const aName = String(asset.name || "").toLowerCase();

        setCg(
          markets.find((m) => m.id?.toLowerCase() === aId) ||
            markets.find((m) => m.symbol?.toLowerCase() === aSym) ||
            markets.find((m) => m.name?.toLowerCase() === aName) ||
            null
        );
      } catch (e: any) {
        if (e?.name !== "AbortError") setCgError(e?.message || "Failed to load CoinGecko data");
      } finally {
        if (!ctrl.signal.aborted) setCgLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [asset]);

  /* Price history chart */
  useEffect(() => {
    const ctrl = new AbortController();
    const destroy = () => {
      try { chartRef.current?.destroy(); } catch {}
      chartRef.current = null;
    };
    destroy();
    setChartLoading(true);
    setTimeframeChange(null);
    const intervalMap: Record<Timeframe, string> = { "1": "m5", "7": "h1", "30": "h2" };

    (async () => {
      try {
        const end = Date.now();
        const start = end - parseInt(timeframe, 10) * 86_400_000;
        const res = await fetchCoinCap(
          `assets/${asset.id}/history?interval=${intervalMap[timeframe]}&start=${start}&end=${end}`,
          { signal: ctrl.signal }
        );
        if (ctrl.signal.aborted) return;

        const json = await res.json();
        const raw = json.data || [];
        const pts: { x: Date; y: number }[] = raw.length
          ? raw.map((p: any) => ({ x: new Date(p.time), y: parseFloat(p.priceUsd) }))
          : [
              { x: new Date(start), y: parseFloat(asset.priceUsd) },
              { x: new Date(end), y: parseFloat(asset.priceUsd) },
            ];

        if (ctrl.signal.aborted || !canvasRef.current) return;

        const first = pts[0]?.y;
        const last = pts[pts.length - 1]?.y;
        const change = Number.isFinite(first) && first !== 0 ? ((last - first) / first) * 100 : 0;
        setTimeframeChange(change);

        const up = change >= 0;
        const dark = isDarkMode();
        const line = up ? "rgb(16,185,129)" : "rgb(244,63,94)";
        const fillTop = up ? "rgba(16,185,129,0.28)" : "rgba(244,63,94,0.28)";
        const tick = dark ? "rgba(148,163,184,0.7)" : "rgba(100,116,139,0.8)";

        chartRef.current = new Chart(canvasRef.current, {
          type: "line",
          data: {
            datasets: [
              {
                data: pts as any,
                borderColor: line,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: line,
                pointHoverBorderColor: dark ? "#1f1f23" : "#fff",
                pointHoverBorderWidth: 2,
                tension: 0.3,
                fill: true,
                backgroundColor: (ctx) => {
                  const { ctx: c, chartArea } = ctx.chart;
                  if (!chartArea) return fillTop;
                  const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                  g.addColorStop(0, fillTop);
                  g.addColorStop(1, "rgba(0,0,0,0)");
                  return g;
                },
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400, easing: "easeOutQuart" },
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                displayColors: false,
                backgroundColor: dark ? "rgba(15,23,42,0.95)" : "rgba(15,23,42,0.92)",
                titleColor: "rgba(226,232,240,0.7)",
                titleFont: { family: "ui-monospace, monospace", size: 10 },
                bodyFont: { family: "ui-monospace, monospace", size: 13, weight: "bold" },
                padding: 10,
                cornerRadius: 10,
                callbacks: { label: (c) => fmt.currency(c.parsed.y) },
              },
            },
            scales: {
              x: {
                type: "time",
                ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 5, font: { family: "ui-monospace, monospace", size: 10 } },
                grid: { display: false },
                border: { display: false },
              },
              y: {
                position: "right",
                beginAtZero: false,
                ticks: { color: tick, maxTicksLimit: 4, font: { family: "ui-monospace, monospace", size: 10 }, callback: (v) => fmt.compact(v as number, "$") },
                grid: { color: dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)" },
                border: { display: false },
              },
            },
          },
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Chart load error:", e);
      } finally {
        if (!ctrl.signal.aborted) setChartLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
      destroy();
    };
  }, [asset, timeframe]);

  /* Derived values */
  const logo = logos[String(asset.symbol ?? "").toLowerCase()] ?? cg?.image ?? null;
  const priceNum = tradeInfo?.price ?? num(asset.priceUsd) ?? cg?.current_price ?? 0;
  const liveDir =
    tradeInfo?.direction ??
    (tradeInfo?.prev != null ? (priceNum > tradeInfo.prev ? "up" : priceNum < tradeInfo.prev ? "down" : "neutral") : "neutral");
  const asset24h = num(asset.changePercent24Hr) ?? cg?.price_change_percentage_24h ?? null;
  const shownChange = timeframe === "1" ? timeframeChange ?? asset24h : timeframeChange;
  const changeUp = (shownChange ?? 0) >= 0;
  const tf = TIMEFRAMES.find((t) => t.key === timeframe)!;

  const explorerHost = asset.explorer ? extractHostname(asset.explorer) : null;
  const explorerHref = asset.explorer && explorerHost ? (asset.explorer.includes("://") ? asset.explorer : `https://${asset.explorer}`) : null;
  const rank = Number(asset.rank ?? cg?.market_cap_rank ?? 0);

  const low = cg?.low_24h ?? null;
  const high = cg?.high_24h ?? null;
  const rangePos = low != null && high != null && high > low ? Math.min(100, Math.max(0, ((priceNum - low) / (high - low)) * 100)) : null;

  const lastUpdated = cg?.last_updated ? new Date(cg.last_updated) : null;
  const sourceLabel = cgLoading ? "Syncing…" : cgError ? "CoinCap only" : cg ? "CoinCap · CoinGecko" : "CoinCap";

  const stats: { label: string; value: string; sub?: string; tone?: "up" | "down" }[] = [
    { label: "Market cap", value: fmt.compact(cg?.market_cap ?? asset.marketCapUsd, "$"), sub: cg?.market_cap_change_percentage_24h != null ? `${fmt.percent(cg.market_cap_change_percentage_24h)} 24h` : undefined, tone: (cg?.market_cap_change_percentage_24h ?? 0) >= 0 ? "up" : "down" },
    { label: "Volume 24h", value: fmt.compact(cg?.total_volume ?? asset.volumeUsd24Hr, "$") },
    { label: "Circulating", value: fmt.compact(cg?.circulating_supply ?? asset.supply), sub: asset.symbol?.toUpperCase?.() },
    { label: "Max supply", value: cg?.max_supply != null ? fmt.compact(cg.max_supply) : asset.maxSupply ? fmt.compact(asset.maxSupply) : "∞", sub: cg?.total_supply != null ? `Total ${fmt.compact(cg.total_supply)}` : undefined },
    { label: "Fully diluted", value: fmt.compact(cg?.fully_diluted_valuation, "$") },
    { label: "Change 24h", value: fmt.currency(cg?.price_change_24h), sub: fmt.percent(asset24h), tone: (asset24h ?? 0) >= 0 ? "up" : "down" },
    { label: "All-time high", value: fmt.currency(cg?.ath), sub: cg?.ath_change_percentage != null ? `${fmt.percent(cg.ath_change_percentage)} · ${fmt.date(cg?.ath_date)}` : undefined, tone: "down" },
    { label: "All-time low", value: fmt.currency(cg?.atl), sub: cg?.atl_change_percentage != null ? `${fmt.percent(cg.atl_change_percentage)} · ${fmt.date(cg?.atl_date)}` : undefined, tone: "up" },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crypto-popup-title"
        initial={{ y: 32, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="relative isolate flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200/70 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#1a1a1d] sm:max-w-3xl sm:rounded-3xl"
      >
        {/* Ambient */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 overflow-hidden">
          <div className={cn("absolute -top-24 left-1/4 h-56 w-[28rem] rounded-full blur-3xl", changeUp ? "bg-emerald-300/25 dark:bg-emerald-500/10" : "bg-rose-300/25 dark:bg-rose-500/10")} />
          <div className="absolute -top-20 right-0 h-48 w-72 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-500/10" />
        </div>
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />
        {/* Mobile grab handle */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 dark:bg-white/15 sm:hidden" />

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-4 sm:px-7 sm:pt-6">
          <div className="relative shrink-0">
            {logo ? (
              <img src={logo} alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-1.5 ring-1 ring-slate-200 dark:ring-white/10" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-slate-100 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id="crypto-popup-title" className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                {asset.name ?? cg?.name}
              </h3>
              <span className="font-mono text-xs uppercase text-slate-400">{asset.symbol}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
              {rank > 0 && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">Rank #{rank}</span>
              )}
              {explorerHref && (
                <a
                  href={explorerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 transition hover:text-indigo-600 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:text-indigo-300"
                >
                  {explorerHost}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-7" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Price + timeframe */}
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {tradeInfo?.bump ? (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                ) : null}
                {tradeInfo?.bump ? "Live price" : "Price"}
              </div>
              <motion.div
                key={priceNum}
                initial={{ color: liveDir === "up" ? "#10b981" : liveDir === "down" ? "#f43f5e" : undefined }}
                animate={{ color: "var(--popup-price)" }}
                transition={{ duration: 0.9 }}
                className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight [--popup-price:#0f172a] dark:[--popup-price:#ffffff] sm:text-4xl"
              >
                {fmt.currency(priceNum)}
              </motion.div>
              <div className={cn("mt-1 inline-flex items-center gap-1 font-mono text-sm tabular-nums", changeUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                {changeUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {fmt.percent(shownChange)}
                <span className="text-slate-400">· {tf.label}</span>
              </div>
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/[0.04]" role="group" aria-label="Chart timeframe">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTimeframe(t.key)}
                  aria-pressed={timeframe === t.key}
                  className={cn(
                    "relative rounded-lg px-3.5 py-1.5 font-mono text-xs transition-colors",
                    timeframe === t.key ? "text-white dark:text-slate-900" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  )}
                >
                  {timeframe === t.key && (
                    <motion.span layoutId="popupTf" className="absolute inset-0 rounded-lg bg-slate-900 dark:bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="relative mt-4 h-56 sm:h-64">
            <canvas ref={canvasRef} className="h-full w-full" />
            <AnimatePresence>
              {chartLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-end gap-1 overflow-hidden rounded-2xl bg-slate-50/80 p-4 dark:bg-white/[0.02]"
                >
                  {Array.from({ length: 40 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="flex-1 rounded-t bg-slate-200 dark:bg-white/[0.06]"
                      initial={{ height: "10%" }}
                      animate={{ height: ["15%", `${30 + ((i * 37) % 55)}%`, "15%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.03 }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
            <span>{tf.span}</span>
            <span>{sourceLabel}{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
          </div>

          {/* 24h range */}
          <div className="mt-5 rounded-2xl border border-slate-200/70 p-4 dark:border-white/[0.08]">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <span>24h range</span>
              {rangePos != null && <span className="tabular-nums">{Math.round(rangePos)}% of range</span>}
            </div>
            <div className="relative mt-3 h-1.5 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 opacity-80">
              {rangePos != null && (
                <motion.span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow-[0_0_0_3px_rgba(99,102,241,0.25)] dark:border-[#1a1a1d] dark:bg-white"
                  initial={{ left: "50%" }}
                  animate={{ left: `${rangePos}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 24 }}
                />
              )}
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs tabular-nums">
              <span className="text-rose-500 dark:text-rose-400">{cgLoading ? "…" : fmt.currency(low)}</span>
              <span className="text-emerald-600 dark:text-emerald-400">{cgLoading ? "…" : fmt.currency(high)}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-200/70 dark:border-white/[0.08] dark:bg-white/[0.06] sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white p-3.5 dark:bg-[#1a1a1d]">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{s.label}</div>
                <div className={cn("mt-1.5 truncate font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white", cgLoading && "animate-pulse text-slate-300 dark:text-slate-600")}>
                  {s.value}
                </div>
                {s.sub && (
                  <div
                    className={cn(
                      "mt-0.5 truncate font-mono text-[10px] tabular-nums",
                      s.tone === "up" ? "text-emerald-600 dark:text-emerald-400" : s.tone === "down" ? "text-rose-500 dark:text-rose-400" : "text-slate-400"
                    )}
                  >
                    {s.sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Prices can differ slightly between providers and exchanges. Not financial advice.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
