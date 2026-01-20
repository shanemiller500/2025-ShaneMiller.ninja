"use client";

import React, { useEffect, useRef, useState, JSX } from "react";
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

export default function CryptoAssetPopup({ asset, logos, onClose, tradeInfo }: Props) {
  const [timeframe, setTimeframe] = useState<"1" | "7" | "30">("1");
  const [chartLoading, setChartLoading] = useState(false);
  const [timeframeChange, setTimeframeChange] = useState<number | null>(null);
  const [change24hStatic, setChange24hStatic] = useState<number | null>(null);

  const [cgLoading, setCgLoading] = useState(false);
  const [cgError, setCgError] = useState<string | null>(null);
  const [cg, setCg] = useState<CoinGeckoMarket | null>(null);

  const [changeTab, setChangeTab] = useState<"price" | "mcap">("price");

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

  /* modal behavior */
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

  /* stable 24h */
  useEffect(() => {
    if (!asset) return;
    const v = parseFloat(asset.changePercent24Hr);
    setChange24hStatic(Number.isFinite(v) ? v : null);
  }, [asset]);

  /* extra market data */
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

  /* chart data */
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
                callbacks: { label: (ctx) => ` ${usd(ctx.parsed.y)}` },
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

  const logo = asset ? logos[asset.symbol?.toLowerCase()] ?? null : null;

const priceNum =
  tradeInfo?.price != null
    ? tradeInfo.price
    : parseFloat(String(asset?.priceUsd ?? "0"));
  const prevNum = tradeInfo?.prev ?? priceNum;
  const priceColor = priceNum >= prevNum ? "text-emerald-600" : "text-rose-600";

  const changeLabel = timeframe === "1" ? "24h Change" : timeframe === "7" ? "7D Change" : "30D Change";

const asset24h = parseFloat(String(asset?.changePercent24Hr ?? "0"));
  const canonicalChange: number | null =
    timeframe === "1"
      ? timeframeChange ?? (Number.isFinite(asset24h) ? asset24h : null)
      : timeframeChange ?? null;

  const changeValue = canonicalChange != null ? pct(canonicalChange) : "—";
  const baseChange = canonicalChange ?? 0;
  const changeColor = baseChange >= 0 ? "text-emerald-600" : "text-rose-600";

  const changePillBg =
    baseChange >= 0
      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200"
      : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-200";

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

  const snapIsUp = (canonicalChange ?? 0) >= 0;
  const snapArrow = snapIsUp ? "▲" : "▼";
  const snapPrice = usd(priceNum);
  const snapChange = canonicalChange != null ? `${snapArrow} ${pct(canonicalChange)}` : "—";
  const snapHigh = cgHigh != null ? usd(cgHigh) : "—";
  const snapLow = cgLow != null ? usd(cgLow) : "—";

  const Metric = ({
    icon,
    label,
    value,
    color = "text-gray-900 dark:text-white",
    sub,
  }: {
    icon: JSX.Element;
    label: string;
    value: string;
    color?: string;
    sub?: string;
  }) => (
    <div className="rounded-2xl p-3 border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-white/60">{label}</span>
      </div>
      <div className={cn("mt-1 text-sm sm:text-base font-extrabold", color)}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] font-bold text-gray-500 dark:text-white/60">{sub}</div> : null}
    </div>
  );

  const changeTabs = [
    { key: "price" as const, label: "Price 24h" },
    { key: "mcap" as const, label: "MCap 24h" },
  ] as const;

  const changeTabActiveStyle = "bg-indigo-600 text-white border-indigo-600";
  const changeTabInactiveStyle =
    "bg-black/[0.03] dark:bg-white/[0.06] text-gray-900 dark:text-white border-black/10 dark:border-white/10 hover:bg-black/[0.06] dark:hover:bg-white/[0.10]";

  const ChangePanel = () => {
    const isPrice = changeTab === "price";

    const title = isPrice ? "24h Price Change" : "24h Market Cap Change";
const mainValue = isPrice
  ? cgPriceChange24 != null
    ? (
        <span
          className={
            cgPriceChange24 >= 0
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-rose-600 dark:text-rose-300"
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
          cgMktCapChange24 >= 0
            ? "text-emerald-600 dark:text-emerald-300"
            : "text-rose-600 dark:text-rose-300"
        }
      >
        {compact(cgMktCapChange24)}
      </span>
    )
  : "—";


    const mainPct = isPrice ? cgPriceChangePct24 : cgMktCapChangePct24;
    const color = (mainPct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
    const arrow = (mainPct ?? 0) >= 0 ? "▲" : "▼";

    return (
      <div className="mt-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Change
            </div>
            <div className="text-[11px] font-extrabold text-gray-500 dark:text-white/60">
              {cgLoading ? "Loading…" : cgError ? "Limited data" : cg ? "CoinGecko" : "CoinCap"}
              {lastUpdated ? ` • ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {changeTabs.map((t) => {
              const active = changeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setChangeTab(t.key)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-2xl px-3 py-2 text-xs font-extrabold border transition shadow-sm",
                    active ? changeTabActiveStyle : changeTabInactiveStyle
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-bold text-gray-500 dark:text-white/60">{title}</div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <div className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">{mainValue}</div>
              <div className={cn("text-sm sm:text-base font-extrabold", color)}>
                {mainPct != null ? `${arrow} ${pct(mainPct)}` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ExtremesHeader = () => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="shrink-0">
          {logo ? (
            <span className="inline-flex items-center justify-center rounded-2xl p-2 bg-white/70 dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10 shadow-sm">
              <img src={logo} alt={asset.symbol} className="h-7 w-7 object-contain" />
            </span>
          ) : (
            <span className="h-10 w-10 rounded-2xl bg-black/5 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10" />
          )}
        </div>

        <div className="min-w-0">

          <div className="truncate text-xs font-extrabold text-gray-900 dark:text-white/80">
            {asset.name} • {asset.symbol?.toUpperCase?.()}
          </div>
        </div>
      </div>

      {explorerHost && explorerHref ? (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "shrink-0 inline-flex items-center gap-2",
            "rounded-2xl px-3 py-2",
            "border border-black/10 dark:border-white/10",
            "bg-white/70 dark:bg-white/[0.06]",
            "text-[11px] font-extrabold",
            "text-gray-900 dark:text-white",
            "shadow-sm hover:bg-white dark:hover:bg-white/[0.10] transition"
          )}
        >
          <FaLink className="text-indigo-600 dark:text-indigo-300" />
          Explorer
          <span className="hidden sm:inline text-gray-500 dark:text-white/60">({explorerHost})</span>
        </a>
      ) : null}
    </div>
  );

  if (!asset) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="popup-bg"
        className="fixed inset-0 z-50 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

        <div
          className="relative min-h-[100svh] w-full px-3 py-3 sm:px-6 sm:py-8 flex items-center justify-center"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <motion.div
            key="popup-card"
            className={cn(
              "relative w-full max-w-xl",
              "rounded-3xl",
              "bg-white dark:bg-brand-900",
              "border border-black/10 dark:border-white/10",
              "shadow-2xl overflow-hidden",
              "flex flex-col min-h-0",
              "max-h-[calc(100svh-24px)] sm:max-h-[85svh]"
            )}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
                <div className="absolute -top-16 -left-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
              </div>

              <div className="relative sticky top-0 z-20 bg-white/85 dark:bg-brand-900/85 backdrop-blur border-b border-black/10 dark:border-white/10">
                <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-start gap-3">
                  <div className="shrink-0">
                    {logo ? (
                      <span className="inline-flex items-center justify-center rounded-2xl p-2 bg-white/70 dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10 shadow-sm">
                        <img src={logo} alt={asset.symbol} className="h-9 w-9 sm:h-10 sm:w-10 object-contain" />
                      </span>
                    ) : (
                      <span className="h-11 w-11 rounded-2xl bg-black/5 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10" />
                    )}
                  </div>

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
                      <span className="text-xs font-bold text-gray-600 dark:text-white/60">{rankLabel}</span>

                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1",
                          changePillBg
                        )}
                        title={changeLabel}
                      >
                        {changeLabel}: {changeValue}
                      </span>

                      {cgMktCapRank ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-black/5 dark:bg-white/10 text-gray-700 dark:text-white/80 ring-1 ring-black/10 dark:ring-white/10">
                          Market Rank #{cgMktCapRank}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="h-10 w-10 rounded-2xl bg-white/70 dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-gray-800 dark:text-white shadow-sm hover:bg-white dark:hover:bg-white/[0.10] transition"
                    onClick={onClose}
                    aria-label="Close"
                  >
                    <span className="text-2xl leading-none">×</span>
                  </button>
                </div>

                <div className="px-4 pb-3 sm:px-6 sm:pb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { tf: "1" as const, label: "1D" },
                      { tf: "7" as const, label: "7D" },
                      { tf: "30" as const, label: "30D" },
                    ].map(({ tf, label }) => {
                      const active = timeframe === tf;
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setTimeframe(tf)}
                          aria-pressed={active}
                          className={cn(
                            "rounded-2xl px-3 py-2 text-xs font-extrabold border transition shadow-sm",
                            active
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-black/[0.03] dark:bg-white/[0.06] text-gray-900 dark:text-white border-black/10 dark:border-white/10 hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
              style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}
            >
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-white/60">Current Price</div>
                  <div className={cn("truncate text-2xl sm:text-3xl font-extrabold", priceColor)}>{usd(priceNum)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-white/60">{changeLabel}</div>
                  <div className={cn("text-lg sm:text-xl font-extrabold", changeColor)}>{changeValue}</div>
                </div>
              </div>

              {/* Snapshot */}
              <div className="mt-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                      Snapshot
                    </div>
                    <div className="text-[11px] font-extrabold text-gray-500 dark:text-white/60">
                      {cgLoading ? "Loading…" : cgError ? "Limited data" : cg ? "CoinGecko" : "CoinCap"}
                      {lastUpdated ? ` • ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                    </div>
                  </div>

                  <div className="mt-2 text-sm sm:text-[15px] leading-snug text-gray-800 dark:text-white/80">
                    <span className="font-extrabold text-gray-900 dark:text-white">{asset.symbol?.toUpperCase?.()}</span>{" "}
                    at{" "}
                    <span
                      className={cn(
                        "font-extrabold",
                        snapIsUp ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"
                      )}
                    >
                      {snapPrice}
                    </span>{" "}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-extrabold",
                        snapIsUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
                      )}
                    >
                      ({snapChange})
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-black/5 dark:bg-white/10 text-emerald-700 dark:text-emerald-200 ring-1 ring-black/10 dark:ring-white/10">
                      High: {snapHigh}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-black/5 dark:bg-white/10 text-rose-700 dark:text-rose-200 ring-1 ring-black/10 dark:ring-white/10">
                      Low: {snapLow}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart (moved directly under snapshot) */}
              <div className="mt-4">
                <div className="relative rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white">Price Chart</div>
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
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span className="text-sm font-extrabold text-gray-700 dark:text-white/80">Loading chart…</span>
                        </div>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.02] via-transparent to-black/[0.02] dark:from-white/[0.02] dark:to-white/[0.02]" />
                    </div>

                    <canvas key={canvasKey} ref={canvasRef} className="w-full h-full" />
                  </div>
                </div>
              </div>

              <ChangePanel />

              {/* Extremes */}
              <div className="mt-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-3">
                  <ExtremesHeader />

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-3">
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

                    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-3">
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
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric
                  icon={<FaChartPie className="text-indigo-600 dark:text-indigo-300" />}
                  label="Market Cap"
                  value={cgMktCap != null ? compact(cgMktCap) : compact(asset.marketCapUsd)}
                />
                <Metric
                  icon={<FaCoins className="text-indigo-600 dark:text-indigo-300" />}
                  label="Volume (24h)"
                  value={cgVol != null ? compact(cgVol) : compact(asset.volumeUsd24Hr)}
                />
                <Metric
                  icon={<FaDatabase className="text-indigo-600 dark:text-indigo-300" />}
                  label="Circulating Supply"
                  value={cgCirc != null ? compact(cgCirc) : compact(asset.supply)}
                  sub={asset.symbol ? asset.symbol.toUpperCase() : undefined}
                />
                <Metric
                  icon={<FaWarehouse className="text-indigo-600 dark:text-indigo-300" />}
                  label="Total / Max Supply"
                  value={cgTotal != null ? compact(cgTotal) : asset.maxSupply ? compact(asset.maxSupply) : "—"}
                  sub={cgMax != null ? `Max: ${compact(cgMax)}` : asset.maxSupply ? `Max: ${compact(asset.maxSupply)}` : undefined}
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
                <Metric
                  icon={<FaDollarSign className="text-indigo-600 dark:text-indigo-300" />}
                  label="24h High"
                  value={cgHigh != null ? usd(cgHigh) : "—"}
                  color="text-emerald-600"
                />
                <Metric
                  icon={<FaDollarSign className="text-indigo-600 dark:text-indigo-300" />}
                  label="24h Low"
                  value={cgLow != null ? usd(cgLow) : "—"}
                  color="text-rose-600"
                />
                <Metric
                  icon={<FaChartPie className="text-indigo-600 dark:text-indigo-300" />}
                  label="FDV"
                  value={cgFDV != null ? compact(cgFDV) : "—"}
                  sub={cgFDV != null && cgMktCap != null ? `FDV/MCap: ${fmtNum(cgFDV / Math.max(cgMktCap, 1), 2)}x` : undefined}
                />
                <Metric
                  icon={<FaDatabase className="text-indigo-600 dark:text-indigo-300" />}
                  label="Market Cap Rank"
                  value={cgMktCapRank != null ? `#${cgMktCapRank}` : "—"}
                />
              </div>

              <div className="h-20" />
            </div>

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
