// CryptoAssetPopup.tsx
/* eslint-disable @next/next/no-img-element */
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
  FaTimes,
} from "react-icons/fa";

/* helpers ----------------------------------------------------------- */
const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

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
  n != null && Number.isFinite(parseFloat(String(n))) ? `${parseFloat(String(n)).toFixed(2)}%` : "—";

const usd = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return v != null && Number.isFinite(v) ? currencyFmt.format(v) : "—";
};

const compact = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return v != null && Number.isFinite(v) ? compactFmt.format(v) : "—";
};

const host = (u: string) => {
  try {
    return new URL(u.includes("://") ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const fmtNum = (n: number | string | null | undefined, digits = 2) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

/* props ------------------------------------------------------------- */
type TradeInfo = { price: number; prev?: number };
interface Props {
  asset: any | null;
  logos: Record<string, string>;
  onClose: () => void;
  tradeInfo?: TradeInfo;
}

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image?: string;

  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  fully_diluted_valuation?: number | null;

  total_volume?: number;

  high_24h?: number;
  low_24h?: number;

  price_change_24h?: number;
  price_change_percentage_24h?: number;

  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;

  circulating_supply?: number;
  total_supply?: number | null;
  max_supply?: number | null;

  ath?: number;
  ath_date?: string;
  atl?: number;
  atl_date?: string;

  last_updated?: string;
};

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";

/* small UI bits (match StockQuoteModal feel) ------------------------ */
function SegButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex-1 rounded-xl px-4 py-2 text-xs font-extrabold transition",
        "ring-1 ring-black/10 dark:ring-white/10",
        active
          ? "bg-indigo-600/15 text-indigo-800 dark:text-indigo-200"
          : "bg-white/60 dark:bg-white/[0.06] text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "indigo",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "indigo" | "emerald" | "rose";
}) {
  const accentCls =
    accent === "emerald"
      ? "from-emerald-500/10 to-sky-500/10"
      : accent === "rose"
      ? "from-rose-500/10 to-fuchsia-500/10"
      : "from-indigo-500/10 to-fuchsia-500/10";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className={cn("absolute -top-10 -left-10 h-28 w-28 rounded-full blur-2xl bg-gradient-to-br", accentCls)} />
        <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
            {label}
          </div>
          {icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10">
              {icon}
            </span>
          ) : null}
        </div>

        <div className="mt-1 text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">{value}</div>
        {sub ? <div className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-white/50">{sub}</div> : null}
      </div>
    </div>
  );
}

export default function CryptoAssetPopup({ asset, logos, onClose, tradeInfo }: Props) {
  const [timeframe, setTimeframe] = useState<"1" | "7" | "30">("1");
  const [chartLoading, setChartLoading] = useState(false);
  const [timeframeChange, setTimeframeChange] = useState<number | null>(null);
  const [change24hStatic, setChange24hStatic] = useState<number | null>(null);

  const [cgLoading, setCgLoading] = useState(false);
  const [cgError, setCgError] = useState<string | null>(null);
  const [cg, setCg] = useState<CoinGeckoMarket | null>(null);

  const [changeTab, setChangeTab] = useState<"price" | "mcap">("price");

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const canvasKey = asset ? `${asset.id}-${timeframe}` : "placeholder";

  const destroyChart = () => {
    try {
      chartRef.current?.destroy();
    } catch {}
    chartRef.current = null;

    if (canvasRef.current) {
      try {
        Chart.getChart(canvasRef.current)?.destroy();
      } catch {}
    }
  };

  /* modal behavior -------------------------------------------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    // lock background scroll (mobile friendly)
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  /* stable 24h (from asset) ---------------------------------------- */
  useEffect(() => {
    if (!asset) return;
    const v = parseFloat(asset.changePercent24Hr);
    setChange24hStatic(Number.isFinite(v) ? v : null);
  }, [asset]);

  /* extra market data (CoinGecko) ---------------------------------- */
  useEffect(() => {
    if (!asset) return;

    const ctrl = new AbortController();
    const { signal } = ctrl;

    setCgLoading(true);
    setCgError(null);
    setCg(null);

    (async () => {
      try {
        const url =
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false";
        const res = await fetch(url, { signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
        const arr = (await res.json()) as CoinGeckoMarket[];
        if (signal.aborted) return;

        const aId = String(asset.id || "").toLowerCase();
        const aSym = String(asset.symbol || "").toLowerCase();
        const aName = String(asset.name || "").toLowerCase();

        const found =
          arr.find((x) => x.id?.toLowerCase() === aId) ||
          arr.find((x) => x.symbol?.toLowerCase() === aSym) ||
          arr.find((x) => x.name?.toLowerCase() === aName) ||
          null;

        setCg(found);
      } catch (e: any) {
        if (e?.name !== "AbortError") setCgError(e?.message || "Failed to load CoinGecko data");
      } finally {
        if (!signal.aborted) setCgLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [asset]);

  /* chart data (CoinCap) ------------------------------------------- */
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
          { signal }
        );
        if (signal.aborted) return;

        const json = await res.json();
        const raw = json.data || [];

        const pts =
          raw.length > 0
            ? raw.map((p: any) => ({ x: new Date(p.time), y: parseFloat(p.priceUsd) }))
            : [
                { x: new Date(start), y: parseFloat(asset.priceUsd) },
                { x: new Date(end), y: parseFloat(asset.priceUsd) },
              ];

        if (signal.aborted || !canvasRef.current) return;

        const first = pts[0]?.y as number;
        const last = pts[pts.length - 1]?.y as number;
        const computed = !Number.isNaN(first) && first !== 0 ? ((last - first) / first) * 100 : 0;

        setTimeframeChange(computed);
        if (timeframe === "1") setChange24hStatic(computed);

        const ys = pts
          .map((p: any) => p.y)
          .filter((v: any) => typeof v === "number" && !Number.isNaN(v));
        const minY = ys.length ? Math.min(...ys) : 0;
        const maxY = ys.length ? Math.max(...ys) : 0;
        const pad = (maxY - minY) * 0.08 || (maxY || 1) * 0.02;

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
                callbacks: { label: (c) => ` ${usd(c.parsed.y)}` },
              },
            },
            scales: {
              x: {
                type: "time",
                ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: timeframe === "1" ? 5 : 6 },
                grid: { display: false },
              },
              y: {
                beginAtZero: false,
                suggestedMin: minY - pad,
                suggestedMax: maxY + pad,
                ticks: { callback: (value) => compact(value as number), maxTicksLimit: 5 },
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

  // scroll modal body to top on timeframe / asset changes (mobile feel)
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [timeframe, asset?.id]);

  /* derived values --------------------------------------------------- */
  const logo = asset ? logos[asset.symbol?.toLowerCase()] ?? null : null;

  const priceNum =
    tradeInfo?.price != null ? tradeInfo.price : parseFloat(String(asset?.priceUsd ?? "0"));
  const prevNum = tradeInfo?.prev ?? priceNum;

  const priceIsUp = priceNum >= prevNum;

  const changeLabel = timeframe === "1" ? "24h Change" : timeframe === "7" ? "7D Change" : "30D Change";

  const asset24h = parseFloat(String(asset?.changePercent24Hr ?? "0"));
  const canonicalChange: number | null =
    timeframe === "1"
      ? timeframeChange ?? (Number.isFinite(asset24h) ? asset24h : null)
      : timeframeChange ?? null;

  const changeValue = canonicalChange != null ? pct(canonicalChange) : "—";
  const baseChange = canonicalChange ?? 0;
  const changeIsUp = baseChange >= 0;

  const explorerHost = asset?.explorer ? host(asset.explorer) : null;
  const explorerHref =
    asset?.explorer && explorerHost
      ? asset.explorer.includes("://")
        ? asset.explorer
        : `https://${asset.explorer}`
      : null;

  const rank = Number(asset?.rank ?? 0);
  const rankLabel = Number.isFinite(rank) && rank > 0 ? `Rank #${rank}` : "Rank —";

  const cgHigh = cg?.high_24h ?? null;
  const cgLow = cg?.low_24h ?? null;
  const cgVol = cg?.total_volume ?? null;
  const cgMktCap = cg?.market_cap ?? null;
  const cgMktCapRank = cg?.market_cap_rank ?? null;
  const cgFDV = cg?.fully_diluted_valuation ?? null;

  const cgPriceChange24 = cg?.price_change_24h ?? null;
  const cgPriceChangePct24 = cg?.price_change_percentage_24h ?? null;

  const cgMktCapChange24 = cg?.market_cap_change_24h ?? null;
  const cgMktCapChangePct24 = cg?.market_cap_change_percentage_24h ?? null;

  const cgCirc = cg?.circulating_supply ?? null;
  const cgTotal = cg?.total_supply ?? null;
  const cgMax = cg?.max_supply ?? null;

  const cgAth = cg?.ath ?? null;
  const cgAthDate = cg?.ath_date ?? null;
  const cgAtl = cg?.atl ?? null;
  const cgAtlDate = cg?.atl_date ?? null;

  const lastUpdated = cg?.last_updated ? new Date(cg.last_updated) : null;

  const snapArrow = changeIsUp ? "▲" : "▼";
  const snapPrice = usd(priceNum);
  const snapChange = canonicalChange != null ? `${snapArrow} ${pct(canonicalChange)}` : "—";
  const snapHigh = cgHigh != null ? usd(cgHigh) : "—";
  const snapLow = cgLow != null ? usd(cgLow) : "—";

  const sourceLabel = cgLoading ? "Loading…" : cgError ? "Limited data" : cg ? "CoinGecko" : "CoinCap";
  const sourceTime = lastUpdated ? ` • ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "";

  const ChangePanel = () => {
    const isPrice = changeTab === "price";
    const title = isPrice ? "24h Price Change" : "24h Market Cap Change";

    const mainValue = isPrice
      ? cgPriceChange24 != null
        ? (
            <span
              className={
                cgPriceChange24 >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
              }
            >
              {usd(cgPriceChange24)}
            </span>
          )
        : "—"
      : cgMktCapChange24 != null
      ? (
          <span
            className={
              cgMktCapChange24 >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
            }
          >
            {compact(cgMktCapChange24)}
          </span>
        )
      : "—";

    const mainPct = isPrice ? cgPriceChangePct24 : cgMktCapChangePct24;
    const pctUp = (mainPct ?? 0) >= 0;
    const color = pctUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
    const arrow = pctUp ? "▲" : "▼";

    return (
      <div className="mt-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
            Change
          </div>
          <div className="text-[11px] font-extrabold text-gray-500 dark:text-white/60">
            {sourceLabel}
            {sourceTime}
          </div>
        </div>

        <div className="mt-3 inline-flex w-full rounded-2xl gap-2 p-1 bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10">
          <SegButton active={changeTab === "price"} label="Price 24h" onClick={() => setChangeTab("price")} />
          <SegButton active={changeTab === "mcap"} label="MCap 24h" onClick={() => setChangeTab("mcap")} />
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-bold text-gray-500 dark:text-white/60">{title}</div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <div className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">{mainValue}</div>
            <div className={cn("text-sm sm:text-base font-extrabold", color)}>
              {mainPct != null ? `${arrow} ${pct(mainPct)}` : "—"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!asset) return null;

  /* render ----------------------------------------------------------- */
  return (
    <AnimatePresence>
      <motion.div
        key="crypto-overlay"
        ref={overlayRef as any}
        onMouseDown={onOverlayClick}
        className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-modal="true"
        role="dialog"
      >
        {/* full-height shell like stock modal */}
        <div className="h-[100dvh] w-full flex items-end sm:items-center justify-center">
          <motion.div
            key="crypto-card"
            initial={{ y: 24, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full sm:max-w-5xl",
              "h-[100dvh] sm:h-auto sm:max-h-[88vh]",
              "flex flex-col",
              "bg-white dark:bg-brand-900",
              "border border-gray-200/70 dark:border-white/10",
              "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.75)]",
              "rounded-t-2xl sm:rounded-2xl overflow-hidden"
            )}
          >
            {/* ambient blobs */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-[0.45]">
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
              <div className="absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
              <div className="absolute top-20 right-10 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
            </div>

            {/* sticky header */}
            <div className="relative z-20 sticky top-0 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-brand-900/85">
              <div className="px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      {logo ? (
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-md" />
                          <img
                            src={logo}
                            alt={asset.symbol}
                            className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/80 dark:bg-white/5 object-contain p-2 ring-1 ring-gray-200/70 dark:ring-white/10 shadow-sm"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        </div>
                      ) : (
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 ring-1 ring-gray-200/70 dark:ring-white/10 shadow-sm" />
                      )}

                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-extrabold tracking-tight truncate text-gray-900 dark:text-white">
                          {asset.name}
                          <span className="ml-2 text-gray-500 dark:text-white/60 font-bold">
                            ({asset.symbol?.toUpperCase?.() ?? ""})
                          </span>
                        </h3>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-white/60">
                          <span className="inline-flex items-center gap-2 rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">
                            {rankLabel}
                          </span>

                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 font-semibold ring-1",
                              changeIsUp
                                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/20"
                                : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/20"
                            )}
                            title={changeLabel}
                          >
                            {changeLabel}: {changeValue}
                          </span>

                          {cgMktCapRank ? (
                            <span className="rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">
                              Market Rank #{cgMktCapRank}
                            </span>
                          ) : null}

                          {explorerHost && explorerHref ? (
                            <a
                              href={explorerHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10 hover:opacity-90 transition"
                            >
                              <FaLink className="opacity-75" />
                              <span className="hidden sm:inline">Explorer</span>
                              <span className="hidden sm:inline opacity-70">({explorerHost})</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* price row + timeframe seg */}
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <div className="flex items-end gap-3 min-w-0">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600/10 ring-1 ring-black/10 dark:bg-indigo-400/10 dark:ring-white/10">
                            <FaDollarSign className="text-indigo-600 dark:text-indigo-300" />
                          </span>
                          <div
                            className={cn(
                              "text-3xl sm:text-4xl font-black tracking-tight truncate",
                              "text-gray-900 dark:text-white"
                            )}
                            title={usd(priceNum)}
                          >
                            {usd(priceNum)}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "flex items-center gap-2 text-sm font-extrabold",
                            priceIsUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
                          )}
                        >
                          <span>{priceIsUp ? "▲" : "▼"}</span>
                          <span className="text-gray-500 dark:text-white/60 font-bold">{changeValue}</span>
                        </div>
                      </div>

                      <div className="inline-flex w-full sm:w-auto rounded-2xl gap-2 p-1 bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10">
                        <SegButton active={timeframe === "1"} label="1D" onClick={() => setTimeframe("1")} />
                        <SegButton active={timeframe === "7"} label="7D" onClick={() => setTimeframe("7")} />
                        <SegButton active={timeframe === "30"} label="30D" onClick={() => setTimeframe("30")} />
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] font-extrabold text-gray-500 dark:text-white/60">
                      {sourceLabel}
                      {sourceTime}
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.12] text-gray-900 dark:text-white transition"
                    aria-label="Close"
                    title="Close (Esc)"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              {/* gradient divider like stock */}
              <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-fuchsia-500/30 to-sky-500/30" />
            </div>

            {/* scrollable body */}
            <div
              ref={bodyRef as any}
              className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5"
              style={{ WebkitOverflowScrolling: "touch" as any }}
            >
              {/* Snapshot (stock-feel card) */}
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                    Snapshot
                  </div>
                  <div className="text-[11px] font-extrabold text-gray-500 dark:text-white/60">
                    {sourceLabel}
                    {sourceTime}
                  </div>
                </div>

                <div className="mt-3 text-sm sm:text-[15px] leading-snug text-gray-800 dark:text-white/80">
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    {asset.symbol?.toUpperCase?.()}
                  </span>{" "}
                  at{" "}
                  <span
                    className={cn(
                      "font-extrabold",
                      changeIsUp ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"
                    )}
                  >
                    {snapPrice}
                  </span>{" "}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-extrabold",
                      changeIsUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
                    )}
                  >
                    ({snapChange})
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-gray-100/80 dark:bg-white/10 text-emerald-700 dark:text-emerald-200 ring-1 ring-black/10 dark:ring-white/10">
                    High: {snapHigh}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-gray-100/80 dark:bg-white/10 text-rose-700 dark:text-rose-200 ring-1 ring-black/10 dark:ring-white/10">
                    Low: {snapLow}
                  </span>
                </div>
              </div>

              {/* Chart */}
              <div className="mt-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <FaChartLine className="text-indigo-600 dark:text-indigo-300" />
                    Price chart
                  </h4>
                  <div className="text-xs font-bold text-gray-500 dark:text-white/60">
                    {timeframe === "1" ? "Last 24h" : timeframe === "7" ? "Last 7 days" : "Last 30 days"}
                  </div>
                </div>

                <div className="mt-3 relative h-56 sm:h-64">
                  {chartLoading && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/35 flex items-center justify-center z-10 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-300"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="text-sm font-extrabold text-gray-700 dark:text-white/80">Loading chart…</span>
                      </div>
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/[0.02] via-transparent to-black/[0.02] dark:from-white/[0.02] dark:to-white/[0.02]" />
                  </div>

                  <div className="h-full w-full rounded-2xl overflow-hidden">
                    <canvas key={canvasKey} ref={canvasRef} className="w-full h-full" />
                  </div>
                </div>
              </div>

              {/* Change panel */}
              <ChangePanel />

              {/* Extremes */}
              <div className="mt-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Extremes</h4>
                  <div className="text-xs font-bold text-gray-500 dark:text-white/60">CoinGecko when available</div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-extrabold text-gray-600 dark:text-white/60">All-Time High</div>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-black/5 dark:bg-white/10 text-gray-800 dark:text-white ring-1 ring-black/10 dark:ring-white/10">
                        {fmtDate(cgAthDate)}
                      </span>
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-200">
                      {cgAth != null ? usd(cgAth) : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-extrabold text-gray-600 dark:text-white/60">All-Time Low</div>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-black/5 dark:bg-white/10 text-gray-800 dark:text-white ring-1 ring-black/10 dark:ring-white/10">
                        {fmtDate(cgAtlDate)}
                      </span>
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-rose-700 dark:text-rose-200">
                      {cgAtl != null ? usd(cgAtl) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics grid (stock-feel cards) */}
              <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Market Cap"
                  value={cgMktCap != null ? compact(cgMktCap) : compact(asset.marketCapUsd)}
                  icon={<FaChartPie className="text-indigo-600 dark:text-indigo-300" />}
                />
                <StatCard
                  label="Volume (24h)"
                  value={cgVol != null ? compact(cgVol) : compact(asset.volumeUsd24Hr)}
                  icon={<FaCoins className="text-indigo-600 dark:text-indigo-300" />}
                />
                <StatCard
                  label="Circulating Supply"
                  value={cgCirc != null ? compact(cgCirc) : compact(asset.supply)}
                  sub={asset.symbol ? asset.symbol.toUpperCase() : undefined}
                  icon={<FaDatabase className="text-indigo-600 dark:text-indigo-300" />}
                />
                <StatCard
                  label="Total / Max Supply"
                  value={cgTotal != null ? compact(cgTotal) : asset.maxSupply ? compact(asset.maxSupply) : "—"}
                  sub={
                    cgMax != null
                      ? `Max: ${compact(cgMax)}`
                      : asset.maxSupply
                      ? `Max: ${compact(asset.maxSupply)}`
                      : undefined
                  }
                  icon={<FaWarehouse className="text-indigo-600 dark:text-indigo-300" />}
                />
                <StatCard
                  label="VWAP (24h)"
                  value={asset.vwap24Hr ? compact(asset.vwap24Hr) : "—"}
                  icon={<FaGlobeAmericas className="text-indigo-600 dark:text-indigo-300" />}
                />
                <StatCard
                  label="24h Change"
                  value={change24hStatic != null ? pct(change24hStatic) : pct(asset.changePercent24Hr)}
                  icon={<FaChartLine className="text-indigo-600 dark:text-indigo-300" />}
                  accent={(() => {
                    const v = change24hStatic != null ? change24hStatic : parseFloat(asset.changePercent24Hr);
                    return v >= 0 ? "emerald" : "rose";
                  })()}
                />
                <StatCard
                  label="24h High"
                  value={cgHigh != null ? usd(cgHigh) : "—"}
                  icon={<FaDollarSign className="text-indigo-600 dark:text-indigo-300" />}
                  accent="emerald"
                />
                <StatCard
                  label="24h Low"
                  value={cgLow != null ? usd(cgLow) : "—"}
                  icon={<FaDollarSign className="text-indigo-600 dark:text-indigo-300" />}
                  accent="rose"
                />
                <StatCard
                  label="FDV"
                  value={cgFDV != null ? compact(cgFDV) : "—"}
                  sub={cgFDV != null && cgMktCap != null ? `FDV/MCap: ${fmtNum(cgFDV / Math.max(cgMktCap, 1), 2)}x` : undefined}
                  icon={<FaChartPie className="text-indigo-600 dark:text-indigo-300" />}
                />
                <StatCard
                  label="Market Cap Rank"
                  value={cgMktCapRank != null ? `#${cgMktCapRank}` : "—"}
                  icon={<FaDatabase className="text-indigo-600 dark:text-indigo-300" />}
                />
              </div>

              <div className="mt-6 pb-3 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/10 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:opacity-95 active:scale-[0.99] transition"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-gray-600 dark:text-white/60 text-center">
                DISCLAIMER: Crypto prices may differ slightly between providers and exchanges.
              </p>

              <div className="h-2" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
