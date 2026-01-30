// CryptoAssetPopup.tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* Types ------------------------------------------------------------ */
type Timeframe = "1" | "7" | "30";
type ChangeTab = "price" | "mcap";
type Accent = "indigo" | "emerald" | "rose";

interface TradeInfo { price: number; prev?: number; }

interface CoinGeckoMarket {
  id: string; symbol: string; name: string; image?: string;
  current_price?: number; market_cap?: number; market_cap_rank?: number;
  fully_diluted_valuation?: number | null; total_volume?: number;
  high_24h?: number; low_24h?: number; price_change_24h?: number;
  price_change_percentage_24h?: number; market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number; circulating_supply?: number;
  total_supply?: number | null; max_supply?: number | null;
  ath?: number; ath_date?: string; atl?: number; atl_date?: string; last_updated?: string;
}

interface Props {
  asset: any | null; logos: Record<string, string>;
  onClose: () => void; tradeInfo?: TradeInfo;
}

/* Utilities -------------------------------------------------------- */
const cn = (...classes: Array<string | false | null | undefined>) => 
  classes.filter(Boolean).join(" ");

const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

const fmt = {
  percent: (n: any) => n != null && Number.isFinite(parseFloat(String(n))) ? `${parseFloat(String(n)).toFixed(2)}%` : "—",
  currency: (n: any) => {
    const v = typeof n === "string" ? parseFloat(n) : n;
    return v != null && Number.isFinite(v) ? currencyFmt.format(v) : "—";
  },
  compact: (n: any) => {
    const v = typeof n === "string" ? parseFloat(n) : n;
    return v != null && Number.isFinite(v) ? compactFmt.format(v) : "—";
  },
  number: (n: any, digits = 2) => {
    const v = typeof n === "string" ? parseFloat(n) : n;
    return v != null && Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
  },
  date: (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  }
};

const extractHostname = (url: string) => {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch { return null; }
};

/* Components ------------------------------------------------------- */
const SegmentedButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    type="button" onClick={onClick} aria-pressed={active}
    className={cn(
      "relative flex-1 rounded-xl px-4 py-2 text-xs font-extrabold transition ring-1 ring-black/10 dark:ring-white/10",
      active
        ? "bg-indigo-600/15 text-indigo-800 dark:text-indigo-200"
        : "bg-white/60 dark:bg-white/[0.06] text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white"
    )}
  >
    {label}
  </button>
);

const StatCard = ({ label, value, sub, icon, accent = "indigo" }: {
  label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: Accent;
}) => {
  const accentMap = {
    indigo: "from-indigo-500/10 to-fuchsia-500/10",
    emerald: "from-emerald-500/10 to-sky-500/10",
    rose: "from-rose-500/10 to-fuchsia-500/10",
  };
  
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className={cn("absolute -top-10 -left-10 h-28 w-28 rounded-full blur-2xl bg-gradient-to-br", accentMap[accent])} />
        <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl" />
      </div>
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">{label}</div>
          {icon && <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10">{icon}</span>}
        </div>
        <div className="mt-1 text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">{value}</div>
        {sub && <div className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-white/50">{sub}</div>}
      </div>
    </div>
  );
};

/* Main Component --------------------------------------------------- */
export default function CryptoAssetPopup({ asset, logos, onClose, tradeInfo }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1");
  const [chartLoading, setChartLoading] = useState(false);
  const [timeframeChange, setTimeframeChange] = useState<number | null>(null);
  const [cgLoading, setCgLoading] = useState(false);
  const [cgError, setCgError] = useState<string | null>(null);
  const [cg, setCg] = useState<CoinGeckoMarket | null>(null);
  const [changeTab, setChangeTab] = useState<ChangeTab>("price");

  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";

  const destroyChart = () => {
    try { chartRef.current?.destroy(); } catch {}
    chartRef.current = null;
    if (canvasRef.current) {
      try { Chart.getChart(canvasRef.current)?.destroy(); } catch {}
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

    useEffect(() => {
    if (!asset) return;
    const ctrl = new AbortController();
    setCgLoading(true);
    setCgError(null);
    setCg(null);

    (async () => {
      try {
        const qs =
          "vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false";

        const res = await fetch(`/api/CoinGeckoAPI?${qs}`, {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`CoinGecko proxy error: ${res.status} ${txt?.slice(0, 120)}`);
        }

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
        if (e?.name !== "AbortError")
          setCgError(e?.message || "Failed to load CoinGecko data");
      } finally {
        if (!ctrl.signal.aborted) setCgLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [asset]);

  useEffect(() => {
    if (!asset) return;
    destroyChart(); setChartLoading(true); setTimeframeChange(null);
    const ctrl = new AbortController();
    const intervalMap: Record<Timeframe, string> = { "1": "m1", "7": "m30", "30": "h2" };

    (async () => {
      try {
        const end = Date.now();
        const start = end - parseInt(timeframe, 10) * 86_400_000;
        const res = await fetch(
          `https://rest.coincap.io/v3/assets/${asset.id}/history?interval=${intervalMap[timeframe]}&start=${start}&end=${end}&apiKey=${API_KEY}`,
          { signal: ctrl.signal }
        );
        if (ctrl.signal.aborted) return;
        
        const json = await res.json();
        const raw = json.data || [];
        const pts = raw.length > 0 ? raw.map((p: any) => ({ x: new Date(p.time), y: parseFloat(p.priceUsd) })) : 
          [{ x: new Date(start), y: parseFloat(asset.priceUsd) }, { x: new Date(end), y: parseFloat(asset.priceUsd) }];
        
        if (ctrl.signal.aborted || !canvasRef.current) return;
        
        const first = pts[0]?.y; const last = pts[pts.length - 1]?.y;
        setTimeframeChange(!Number.isNaN(first) && first !== 0 ? ((last - first) / first) * 100 : 0);
        
        const ys = pts.map((p: any) => p.y).filter((v: any) => typeof v === "number" && !Number.isNaN(v));
        const minY = ys.length ? Math.min(...ys) : 0; const maxY = ys.length ? Math.max(...ys) : 0;
        const pad = (maxY - minY) * 0.08 || (maxY || 1) * 0.02;
        
        const ctx = canvasRef.current.getContext("2d")!;
        chartRef.current = new Chart(ctx, {
          type: "line",
          data: { datasets: [{ data: pts, fill: true, pointRadius: 0, borderWidth: 2, tension: 0.32 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 220, easing: "easeOutQuart" },
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: { displayColors: false, padding: 10, callbacks: { label: (c) => ` ${fmt.currency(c.parsed.y)}` } }
            },
            scales: {
              x: { type: "time", ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: timeframe === "1" ? 5 : 6 }, grid: { display: false } },
              y: { beginAtZero: false, suggestedMin: minY - pad, suggestedMax: maxY + pad, 
                   ticks: { callback: (v) => fmt.compact(v as number), maxTicksLimit: 5 }, grid: { color: "rgba(0,0,0,0.06)" } }
            }
          }
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Chart load error:", e);
      } finally {
        if (!ctrl.signal.aborted) setChartLoading(false);
      }
    })();
    return () => { ctrl.abort(); destroyChart(); };
  }, [asset, timeframe, API_KEY]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [timeframe, asset?.id]);

  const logo = useMemo(() => asset ? logos[asset.symbol?.toLowerCase()] ?? null : null, [asset, logos]);
  const priceNum = tradeInfo?.price ?? parseFloat(String(asset?.priceUsd ?? "0"));
  const prevNum = tradeInfo?.prev ?? priceNum;
  const priceIsUp = priceNum >= prevNum;
  const asset24hChange = parseFloat(String(asset?.changePercent24Hr ?? "0"));
  const canonicalChange = timeframe === "1" ? timeframeChange ?? (Number.isFinite(asset24hChange) ? asset24hChange : null) : timeframeChange ?? null;
  const changeIsUp = (canonicalChange ?? 0) >= 0;
  const changeLabel = { "1": "24h Change", "7": "7D Change", "30": "30D Change" }[timeframe];
  const explorerHost = asset?.explorer ? extractHostname(asset.explorer) : null;
  const explorerHref = asset?.explorer && explorerHost ? (asset.explorer.includes("://") ? asset.explorer : `https://${asset.explorer}`) : null;
  const rank = Number(asset?.rank ?? 0);
  const rankLabel = Number.isFinite(rank) && rank > 0 ? `Rank #${rank}` : "Rank —";
  const lastUpdated = cg?.last_updated ? new Date(cg.last_updated) : null;
  const sourceLabel = cgLoading ? "Loading…" : cgError ? "Limited data" : cg ? "CoinGecko" : "CoinCap";
  const sourceTime = lastUpdated ? ` • ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "";

  const ChangePanel = () => {
    const isPrice = changeTab === "price";
    const mainChange = isPrice ? cg?.price_change_24h : cg?.market_cap_change_24h;
    const mainPct = isPrice ? cg?.price_change_percentage_24h : cg?.market_cap_change_percentage_24h;
    const isPos = (mainPct ?? 0) >= 0;
    const colorClass = isPos ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";

    return (
      <div className="mt-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">Change</div>
          <div className="text-[11px] font-extrabold text-gray-500 dark:text-white/60">{sourceLabel}{sourceTime}</div>
        </div>
        <div className="mt-3 inline-flex w-full rounded-2xl gap-2 p-1 bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10">
          <SegmentedButton active={changeTab === "price"} label="Price 24h" onClick={() => setChangeTab("price")} />
          <SegmentedButton active={changeTab === "mcap"} label="MCap 24h" onClick={() => setChangeTab("mcap")} />
        </div>
        <div className="mt-4">
          <div className="text-[11px] font-bold text-gray-500 dark:text-white/60">{isPrice ? "24h Price Change" : "24h Market Cap Change"}</div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <div className={cn("text-lg sm:text-xl font-extrabold", colorClass)}>
              {mainChange != null ? (isPrice ? fmt.currency(mainChange) : fmt.compact(mainChange)) : "—"}
            </div>
            <div className={cn("text-sm sm:text-base font-extrabold", colorClass)}>
              {mainPct != null ? `${isPos ? "▲" : "▼"} ${fmt.percent(mainPct)}` : "—"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!asset) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="crypto-overlay" ref={overlayRef} onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
        className="fixed inset-0 z-50 bg-black/90 dark:bg-black/95 backdrop-blur-sm overflow-hidden"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-modal="true" role="dialog"
      >
        <div className="h-[100dvh] w-full flex items-end sm:items-center justify-center overflow-hidden">
          <motion.div
            key="crypto-card" initial={{ y: 24, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.985 }} transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full sm:max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[88vh] flex flex-col",
              "bg-white dark:bg-brand-900 border border-gray-200/70 dark:border-white/10",
              "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.75)]",
              "rounded-t-2xl sm:rounded-2xl overflow-hidden isolate"
            )}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-[0.45]">
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
              <div className="absolute top-20 right-10 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
            </div>

            <div className="relative z-20 flex-shrink-0 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-brand-900/85">
              <div className="px-4 sm:px-6 py-2 sm:py-4">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {logo ? (
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-md" />
                          <img src={logo} alt={asset.symbol}
                            className="relative h-10 w-10 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-white/5 object-contain p-1.5 sm:p-2 ring-1 ring-gray-200/70 dark:ring-white/10 shadow-sm"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 ring-1 ring-gray-200/70 dark:ring-white/10 shadow-sm" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-lg font-extrabold tracking-tight truncate text-gray-900 dark:text-white">
                          {asset.name}<span className="ml-2 text-gray-500 dark:text-white/60 font-bold">({asset.symbol?.toUpperCase?.() ?? ""})</span>
                        </h3>
                        <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600 dark:text-white/60">
                          <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-gray-100/80 px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">{rankLabel}</span>
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 font-semibold ring-1",
                            changeIsUp ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/20"
                                       : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/20"
                          )} title={changeLabel}><span className="hidden sm:inline">{changeLabel}: </span>{fmt.percent(canonicalChange)}</span>
                          {cg?.market_cap_rank && <span className="hidden sm:inline rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">Market Rank #{cg.market_cap_rank}</span>}
                          {explorerHost && explorerHref && (
                            <a href={explorerHref} target="_blank" rel="noopener noreferrer"
                              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10 hover:opacity-90 transition"
                            ><FaLink className="opacity-75" /><span>Explorer</span><span className="opacity-70">({explorerHost})</span></a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-3 flex flex-wrap items-end justify-between gap-2 sm:gap-3">
                      <div className="flex items-end gap-2 sm:gap-3 min-w-0">
                        <div className="inline-flex items-center gap-1.5 sm:gap-2">
                          <span className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600/10 ring-1 ring-black/10 dark:bg-indigo-400/10 dark:ring-white/10">
                            <FaDollarSign className="text-indigo-600 dark:text-indigo-300" />
                          </span>
                          <div className="text-2xl sm:text-4xl font-black tracking-tight truncate text-gray-900 dark:text-white" title={fmt.currency(priceNum)}>{fmt.currency(priceNum)}</div>
                        </div>
                        <div className={cn("flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-extrabold", priceIsUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                          <span>{priceIsUp ? "▲" : "▼"}</span><span className="text-gray-500 dark:text-white/60 font-bold">{fmt.percent(canonicalChange)}</span>
                        </div>
                      </div>
                      <div className="inline-flex w-full sm:w-auto rounded-2xl gap-1 sm:gap-2 p-1 bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10">
                        <SegmentedButton active={timeframe === "1"} label="1D" onClick={() => setTimeframe("1")} />
                        <SegmentedButton active={timeframe === "7"} label="7D" onClick={() => setTimeframe("7")} />
                        <SegmentedButton active={timeframe === "30"} label="30D" onClick={() => setTimeframe("30")} />
                      </div>
                    </div>
                    <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] font-extrabold text-gray-500 dark:text-white/60">{sourceLabel}{sourceTime}</div>
                  </div>
                  <button onClick={onClose}
                    className="shrink-0 inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.12] text-gray-900 dark:text-white transition text-sm sm:text-base"
                    aria-label="Close" title="Close (Esc)"><FaTimes /></button>
                </div>
              </div>
              <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-fuchsia-500/30 to-sky-500/30" />
            </div>

            <div ref={bodyRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">Snapshot</div>
                  <div className="text-[11px] font-extrabold text-gray-500 dark:text-white/60">{sourceLabel}{sourceTime}</div>
                </div>
                <div className="mt-3 text-sm sm:text-[15px] leading-snug text-gray-800 dark:text-white/80">
                  <span className="font-extrabold text-gray-900 dark:text-white">{asset.symbol?.toUpperCase?.()}</span> at{" "}
                  <span className={cn("font-extrabold", changeIsUp ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200")}>{fmt.currency(priceNum)}</span>{" "}
                  <span className={cn("inline-flex items-center gap-1 font-extrabold", changeIsUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                    ({changeIsUp ? "▲" : "▼"} {fmt.percent(canonicalChange)})
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-gray-100/80 dark:bg-white/10 text-emerald-700 dark:text-emerald-200 ring-1 ring-black/10 dark:ring-white/10">
                    High: {cg?.high_24h != null ? fmt.currency(cg.high_24h) : "—"}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-gray-100/80 dark:bg-white/10 text-rose-700 dark:text-rose-200 ring-1 ring-black/10 dark:ring-white/10">
                    Low: {cg?.low_24h != null ? fmt.currency(cg.low_24h) : "—"}
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <FaChartLine className="text-indigo-600 dark:text-indigo-300" />Price chart
                  </h4>
                  <div className="text-xs font-bold text-gray-500 dark:text-white/60">
                    {timeframe === "1" ? "Last 24h" : timeframe === "7" ? "Last 7 days" : "Last 30 days"}
                  </div>
                </div>
                <div className="mt-3 relative h-56 sm:h-64">
                  {chartLoading && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/35 flex items-center justify-center z-10 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                    <canvas key={`${asset.id}-${timeframe}`} ref={canvasRef} className="w-full h-full" />
                  </div>
                </div>
              </div>

              <ChangePanel />

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
                        {fmt.date(cg?.ath_date)}
                      </span>
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-200">{cg?.ath != null ? fmt.currency(cg.ath) : "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-extrabold text-gray-600 dark:text-white/60">All-Time Low</div>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-black/5 dark:bg-white/10 text-gray-800 dark:text-white ring-1 ring-black/10 dark:ring-white/10">
                        {fmt.date(cg?.atl_date)}
                      </span>
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-rose-700 dark:text-rose-200">{cg?.atl != null ? fmt.currency(cg.atl) : "—"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Market Cap" value={cg?.market_cap != null ? fmt.compact(cg.market_cap) : fmt.compact(asset.marketCapUsd)}
                  icon={<FaChartPie className="text-indigo-600 dark:text-indigo-300" />} />
                <StatCard label="Volume (24h)" value={cg?.total_volume != null ? fmt.compact(cg.total_volume) : fmt.compact(asset.volumeUsd24Hr)}
                  icon={<FaCoins className="text-indigo-600 dark:text-indigo-300" />} />
                <StatCard label="Circulating Supply" value={cg?.circulating_supply != null ? fmt.compact(cg.circulating_supply) : fmt.compact(asset.supply)}
                  icon={<FaDatabase className="text-indigo-600 dark:text-indigo-300" />} />
                <StatCard label="Total / Max Supply" 
                  value={cg?.total_supply != null ? fmt.compact(cg.total_supply) : asset.maxSupply ? fmt.compact(asset.maxSupply) : "—"}
                  icon={<FaWarehouse className="text-indigo-600 dark:text-indigo-300" />} />
                <StatCard label="24h Change" 
                  value={fmt.percent(asset24hChange)}
                  icon={<FaChartLine className="text-indigo-600 dark:text-indigo-300" />}
                  accent={(asset24hChange ?? 0) >= 0 ? "emerald" : "rose"} />
                <StatCard label="24h High" value={cg?.high_24h != null ? fmt.currency(cg.high_24h) : "—"}
                  icon={<FaDollarSign className="text-indigo-600 dark:text-indigo-300" />} accent="emerald" />
                <StatCard label="24h Low" value={cg?.low_24h != null ? fmt.currency(cg.low_24h) : "—"}
                  icon={<FaDollarSign className="text-indigo-600 dark:text-indigo-300" />} accent="rose" />
                <StatCard label="Market Cap Rank" value={cg?.market_cap_rank != null ? `#${cg.market_cap_rank}` : "—"}
                  icon={<FaGlobeAmericas className="text-indigo-600 dark:text-indigo-300" />} />
              </div>

              <div className="mt-6 pb-3 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button onClick={onClose}
                  className="w-full sm:w-auto rounded-2xl px-5 py-3 text-sm font-extrabold bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white hover:opacity-95 active:scale-[0.99] transition"
                >Close</button>
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