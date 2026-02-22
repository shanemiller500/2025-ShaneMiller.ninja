/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarElement,
  CategoryScale,
  Chart,
  type ChartDataset,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  type TooltipItem,
} from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-adapter-date-fns";
import {
  FaArrowDown,
  FaArrowUp,
  FaChartArea,
  FaChartBar,
  FaChartLine,
  FaCompress,
  FaExternalLinkAlt,
  FaSearch,
} from "react-icons/fa";

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
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface HistoryEntry { t: number; y: number; }

interface CryptoAsset {
  id: string; name: string; symbol: string; rank: string;
  supply: string; maxSupply: string | null;
  marketCapUsd: string; volumeUsd24Hr: string;
  priceUsd: string; vwap24Hr: string | null;
  changePercent24Hr: string; explorer?: string;
}

interface CoinGeckoMarket {
  id: string; symbol: string; name: string; image?: string;
  current_price?: number; market_cap?: number; market_cap_rank?: number;
  fully_diluted_valuation?: number | null; total_volume?: number;
  high_24h?: number; low_24h?: number;
  price_change_percentage_24h?: number;
  circulating_supply?: number; total_supply?: number | null; max_supply?: number | null;
  ath?: number; ath_date?: string; atl?: number; atl_date?: string;
}

type TimeFrameOption = "1h" | "24h" | "7d" | "30d";
type ChartMode = "line" | "area" | "bar";

/* ------------------------------------------------------------------ */
/*  Constants / helpers                                                */
/* ------------------------------------------------------------------ */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "/api/CoinGeckoAPI?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false";

const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compactFmt  = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

const usd     = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? currencyFmt.format(n) : "—";
const compact = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? compactFmt.format(n) : "—";
const pctText = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
const posNeg  = (v: number | null | undefined) => !v ? "text-gray-500 dark:text-gray-400" : v >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)")?.matches;

const axisUsd = (v: number, mobile: boolean) => {
  if (!Number.isFinite(v)) return "—";
  if (!mobile) return usd(v);
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `$${(v / 1_000).toFixed(1)}k`;
  if (abs >= 1)             return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(2)}`;
};

function cn(...xs: Array<string | false | null | undefined>) { return xs.filter(Boolean).join(" "); }

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
function MetricCard({
  label, value, sub, accent = false, highlight,
}: {
  label: string; value: string; sub?: string; accent?: boolean; highlight?: "emerald" | "rose";
}) {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1">{label}</div>
      <div className={cn(
        "text-sm font-extrabold leading-tight",
        highlight === "emerald" ? "text-emerald-600 dark:text-emerald-300"
          : highlight === "rose" ? "text-rose-600 dark:text-rose-300"
          : accent ? "text-indigo-600 dark:text-indigo-300"
          : "text-gray-900 dark:text-white",
      )}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 dark:text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function PeriodStat({ label, value, highlight }: { label: string; value: string; highlight?: "emerald" | "rose" | "neutral" }) {
  return (
    <div className="flex flex-col items-center justify-center py-3 px-1 border-r last:border-r-0 border-black/5 dark:border-white/[0.06]">
      <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/40 mb-0.5 text-center">{label}</div>
      <div className={cn(
        "text-[11px] sm:text-sm font-extrabold text-center",
        highlight === "emerald" ? "text-emerald-600 dark:text-emerald-300"
          : highlight === "rose" ? "text-rose-600 dark:text-rose-300"
          : "text-gray-900 dark:text-white",
      )}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
const CryptoChartPrices: React.FC = () => {
  const [query,    setQuery]    = useState("bitcoin");
  const [assetId,  setAssetId]  = useState("bitcoin");

  const [chartData,      setChartData]      = useState<HistoryEntry[]>([]);
  const [cryptoDetails,  setCryptoDetails]  = useState<CryptoAsset | null>(null);
  const [cgData,         setCgData]         = useState<CoinGeckoMarket | null>(null);

  const [loadingChart, setLoadingChart] = useState(false);
  const [cgLoading,    setCgLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const [chartMode,  setChartMode]  = useState<ChartMode>("area");
  const [timeFrame,  setTimeFrame]  = useState<TimeFrameOption>("24h");

  const [logos,    setLogos]    = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  /* ── viewport watcher ── */
  useEffect(() => {
    const set = () => setIsMobile(isMobileViewport());
    set();
    window.addEventListener("resize", set, { passive: true } as any);
    return () => window.removeEventListener("resize", set as any);
  }, []);

  /* ── logo preload ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const map: Record<string, string> = {};
        (json || []).forEach((c: any) => { if (c?.symbol) map[String(c.symbol).toLowerCase()] = c.image; });
        setLogos(map);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── asset ID resolver ── */
  const resolveAssetId = useCallback(async (q: string): Promise<string | null> => {
    if (!API_KEY) return null;
    const res = await fetch(`https://rest.coincap.io/v3/assets?search=${encodeURIComponent(q)}&apiKey=${API_KEY}`);
    if (!res.ok) return null;
    const json = await res.json();
    const list: CryptoAsset[] = json?.data || [];
    if (!list.length) return null;
    const lower = q.toLowerCase();
    const exact = list.find((a) =>
      a.id?.toLowerCase?.() === lower || a.symbol?.toLowerCase?.() === lower || a.name?.toLowerCase?.() === lower,
    ) || list[0];
    return exact?.id || null;
  }, []);

  /* ── history fetcher ── */
  async function fetchSeries(id: string, tf: TimeFrameOption): Promise<HistoryEntry[]> {
    if (!API_KEY) return [];
    let ms: number, interval: string;
    switch (tf) {
      case "1h":  ms = 3600e3;             interval = "m1"; break;
      case "24h": ms = 24 * 3600e3;        interval = "m1"; break;
      case "7d":  ms = 7 * 24 * 3600e3;   interval = "h1"; break;
      default:    ms = 30 * 24 * 3600e3;   interval = "d1";
    }
    const end = Date.now(), start = end - ms;
    const res = await fetch(
      `https://rest.coincap.io/v3/assets/${id}/history?interval=${interval}&start=${start}&end=${end}&apiKey=${API_KEY}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data || [])
      .map((e: any) => ({ t: Number(e.time), y: parseFloat(e.priceUsd) }))
      .filter((p: HistoryEntry) => Number.isFinite(p.t) && Number.isFinite(p.y));
  }

  /* ── details fetcher ── */
  async function fetchDetails(id: string): Promise<CryptoAsset | null> {
    if (!API_KEY) return null;
    const res = await fetch(`https://rest.coincap.io/v3/assets/${id}?apiKey=${API_KEY}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data || null) as CryptoAsset | null;
  }

  /* ── CoinGecko enrichment ── */
  async function fetchCG(details: CryptoAsset): Promise<CoinGeckoMarket | null> {
    try {
      const res = await fetch(COINGECKO_TOP200);
      if (!res.ok) return null;
      const markets = (await res.json()) as CoinGeckoMarket[];
      const id  = details.id.toLowerCase();
      const sym = details.symbol.toLowerCase();
      const nm  = details.name.toLowerCase();
      return (
        markets.find((m) => m.id?.toLowerCase() === id)   ||
        markets.find((m) => m.symbol?.toLowerCase() === sym) ||
        markets.find((m) => m.name?.toLowerCase() === nm)    ||
        null
      );
    } catch { return null; }
  }

  /* ── chart + details + CG update ── */
  async function updateChart() {
    setLoadingChart(true);
    setError(null);
    try {
      const [data, details] = await Promise.all([fetchSeries(assetId, timeFrame), fetchDetails(assetId)]);
      setChartData(data);
      setCryptoDetails(details);
      if (!data.length) setError("No chart data returned for that timeframe.");
      trackEvent("CryptoChartLoaded", { id: assetId, timeFrame, points: data.length });

      if (details) {
        setCgLoading(true);
        fetchCG(details).then((cg) => { setCgData(cg); setCgLoading(false); });
      }
    } catch (e: any) {
      setError("Failed to load chart data.");
      console.error("Crypto chart load error:", e);
    } finally {
      setLoadingChart(false);
    }
  }

  useEffect(() => { updateChart(); }, [assetId, timeFrame]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── derived period metrics ── */
  const derived = useMemo(() => {
    if (!chartData.length) return { first: null, last: null, hi: null, lo: null, rangePct: null, changePct: null };
    const first = chartData[0].y;
    const last  = chartData[chartData.length - 1].y;
    let hi = -Infinity, lo = Infinity;
    for (const p of chartData) { if (p.y > hi) hi = p.y; if (p.y < lo) lo = p.y; }
    return {
      first, last,
      hi:        Number.isFinite(hi) ? hi : null,
      lo:        Number.isFinite(lo) ? lo : null,
      changePct: first ? ((last - first) / first) * 100 : null,
      rangePct:  lo    ? ((hi - lo) / lo) * 100 : null,
    };
  }, [chartData]);

  /* ── chart render ── */
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!chartData.length) { chartRef.current?.destroy(); chartRef.current = null; return; }

    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    let unit: "minute" | "hour" | "day" = "hour";
    if (timeFrame === "1h") unit = "minute";
    else if (timeFrame === "7d" || timeFrame === "30d") unit = "day";

    const pricePts = chartData.map((p) => ({ x: new Date(p.t), y: p.y }));

    const isArea = chartMode === "area";
    const isBar  = chartMode === "bar";

    const dataset: ChartDataset = {
      label: "Price",
      data: pricePts,
      borderColor: chartColorsRgba.price.solid,
      fill: isArea,
      backgroundColor: isBar
        ? pricePts.map((p, i) => i === 0 ? "transparent" : (p.y >= (pricePts[i - 1]?.y ?? p.y) ? "rgba(16,185,129,0.55)" : "rgba(244,63,94,0.55)"))
        : chartColorsRgba.price.fill,
      pointRadius: 0,
      tension: 0.3,
      borderWidth: isMobile ? 1.5 : 2,
      yAxisID: "y1",
    } as unknown as ChartDataset;

    chartRef.current = new Chart(ctx, {
      type: isBar ? "bar" : "line",
      data: { datasets: [dataset] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: isMobile ? 150 : 220 },
        interaction: { mode: "nearest", intersect: false },
        layout: {
          padding: { left: isMobile ? 2 : 6, right: isMobile ? 2 : 6, top: isMobile ? 4 : 8, bottom: 0 },
        },
        scales: {
          x: {
            type: "time",
            time: { unit },
            ticks: { display: false },
            grid: { color: gridColors.light },
            border: { display: false },
          },
          y1: {
            position: "left",
            grid: { color: gridColors.light },
            border: { display: false },
            ticks: {
              color: chartColors.price,
              padding: isMobile ? 4 : 6,
              font: { size: isMobile ? 10 : 11, weight: 700 },
              maxTicksLimit: isMobile ? 4 : 6,
              callback: (v: any) => axisUsd(Number(v), isMobile),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: isMobile ? 10 : 8,
            callbacks: {
              label: (c: TooltipItem<"line">) => {
                const y = c.parsed.y;
                return y != null ? ` ${usd(y)}` : "—";
              },
            },
          },
          zoom: {
            pan: { enabled: true, mode: "xy" },
            zoom: {
              wheel: { enabled: !isMobile },
              pinch: { enabled: true },
              mode: "xy",
            },
            limits: { y: { min: "original", max: "original" }, x: { min: "original", max: "original" } },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [chartData, chartMode, timeFrame, isMobile]);

  /* ── search ── */
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoadingChart(true);
    const id = await resolveAssetId(q);
    if (id) {
      setError(null);
      setCgData(null);
      setAssetId(id);
      trackEvent("CryptoChartSearch", { query: q, id });
    } else {
      setLoadingChart(false);
      setError("Not found — try 'BTC', 'ethereum', 'solana' etc.");
      trackEvent("CryptoChartSearchFail", { query: q });
    }
  };

  /* ── derived display values ── */
  const logoURL     = cryptoDetails?.symbol && logos[cryptoDetails.symbol.toLowerCase()]?.replace("large", "small");
  const change24h   = cryptoDetails ? parseFloat(cryptoDetails.changePercent24Hr) : null;
  const priceNow    = cryptoDetails ? parseFloat(cryptoDetails.priceUsd) : null;
  const vwap        = cryptoDetails?.vwap24Hr ? parseFloat(cryptoDetails.vwap24Hr) : null;
  const mktCap      = cryptoDetails ? parseFloat(cryptoDetails.marketCapUsd) : null;
  const vol24       = cryptoDetails ? parseFloat(cryptoDetails.volumeUsd24Hr) : null;
  const circSupply  = cryptoDetails ? parseFloat(cryptoDetails.supply) : null;
  const maxSupply   = cryptoDetails?.maxSupply ? parseFloat(cryptoDetails.maxSupply) : null;

  const supplyPct = circSupply && maxSupply && maxSupply > 0
    ? Math.min(100, (circSupply / maxSupply) * 100)
    : null;

  const timeLabels: Record<TimeFrameOption, string> = {
    "1h": "1H", "24h": "24H", "7d": "7D", "30d": "30D",
  };

  /* ── render ── */
  return (
    <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 max-w-5xl mx-auto">

      {/* ── Search ── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 text-xs" />
          <input
            className={cn(
              "w-full rounded-2xl border bg-white dark:bg-white/[0.06] pl-8 pr-3 py-2.5 text-sm",
              "placeholder:text-gray-400 dark:placeholder:text-white/30",
              "outline-none focus:ring-2 focus:ring-indigo-500",
              error
                ? "border-rose-300 dark:border-rose-700"
                : "border-black/10 dark:border-white/10",
              "text-gray-900 dark:text-white shadow-sm",
            )}
            placeholder="Search — bitcoin, ETH, solana…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null); }}
          />
          {error && (
            <div className="absolute -bottom-5 left-0 text-[11px] font-semibold text-rose-500">{error}</div>
          )}
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-2xl px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition"
        >
          Go
        </button>
      </form>

      {/* ── Chart card ── */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-brand-900/70 shadow-sm overflow-hidden">

        {/* Coin identity header */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-black/5 dark:border-white/[0.06] space-y-3">

          {/* Row 1: identity */}
          <div className="flex items-center gap-3 min-w-0">
            {logoURL ? (
              <img src={logoURL} alt={cryptoDetails?.symbol || ""}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white p-1 ring-1 ring-black/10 dark:ring-white/10 shadow-sm flex-shrink-0"
                loading="lazy" />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gray-100 dark:bg-white/10 ring-1 ring-black/5 flex-shrink-0 animate-pulse" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate leading-tight">
                  {cryptoDetails?.name ?? "—"}
                </h2>
                <span className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase">
                  {cryptoDetails?.symbol ?? ""}
                </span>
                {cryptoDetails?.rank && (
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                    #{cryptoDetails.rank}
                  </span>
                )}
              </div>
              {priceNow != null && (
                <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-none">
                    {usd(priceNow)}
                  </span>
                  {change24h != null && (
                    <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full", posNeg(change24h),
                      change24h >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-rose-50 dark:bg-rose-900/20")}>
                      {change24h >= 0 ? <FaArrowUp className="text-[9px]" /> : <FaArrowDown className="text-[9px]" />}
                      {pctText(change24h)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: controls — full width, no overlap */}
          <div className="flex items-center justify-between gap-2">
            {/* Timeframe — dropdown on mobile, pills on sm+ */}
            <select
              className="sm:hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.07] px-3 py-2 text-[11px] font-bold text-gray-700 dark:text-white outline-none"
              value={timeFrame}
              onChange={(e) => { const t = e.target.value as TimeFrameOption; setTimeFrame(t); trackEvent("CryptoTimeFrameChange", { timeFrame: t }); }}
            >
              {(["1h", "24h", "7d", "30d"] as TimeFrameOption[]).map((t) => (
                <option key={t} value={t}>{timeLabels[t]}</option>
              ))}
            </select>
            <div className="hidden sm:flex gap-0.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] p-0.5">
              {(["1h", "24h", "7d", "30d"] as TimeFrameOption[]).map((t) => (
                <button key={t} type="button"
                  onClick={() => { setTimeFrame(t); trackEvent("CryptoTimeFrameChange", { timeFrame: t }); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11px] font-bold transition whitespace-nowrap",
                    timeFrame === t
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70",
                  )}
                >{timeLabels[t]}</button>
              ))}
            </div>
            {/* Chart mode + reset */}
            <div className="flex gap-1 flex-shrink-0">
              {([
                { mode: "area" as ChartMode, Icon: FaChartArea, label: "Area" },
                { mode: "line" as ChartMode, Icon: FaChartLine, label: "Line" },
                { mode: "bar"  as ChartMode, Icon: FaChartBar,  label: "Bar"  },
              ]).map(({ mode, Icon, label }) => (
                <button key={mode} type="button" title={label}
                  onClick={() => { setChartMode(mode); trackEvent("CryptoChartTypeChange", { chartType: mode }); }}
                  className={cn(
                    "rounded-lg w-8 h-8 flex items-center justify-center text-xs transition",
                    chartMode === mode
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-black/5 dark:bg-white/[0.05] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60",
                  )}
                ><Icon /></button>
              ))}
              <button type="button" title="Reset zoom"
                onClick={() => { chartRef.current?.resetZoom(); trackEvent("CryptoChartResetZoom", { id: assetId }); }}
                disabled={!chartData.length}
                className="rounded-lg w-8 h-8 flex items-center justify-center text-xs transition bg-black/5 dark:bg-white/[0.05] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 disabled:opacity-30"
              ><FaCompress /></button>
            </div>
          </div>

        </div>

        {/* Canvas */}
        <div className="relative h-52 sm:h-72 md:h-80 w-full">
          <canvas ref={canvasRef} className="h-full w-full" />
          <AnimatePresence>
            {loadingChart && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-brand-900/70 backdrop-blur-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-2.5 rounded-2xl bg-white/90 dark:bg-white/10 px-4 py-2.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-400/40 border-t-indigo-600 animate-spin" />
                  <span className="text-sm font-bold text-gray-700 dark:text-white/80">Loading…</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Period stats strip */}
        <div className="grid grid-cols-4 border-t border-black/5 dark:border-white/[0.06]">
          <PeriodStat label="Period High"
            value={derived.hi != null ? (isMobile ? `$${compact(derived.hi)}` : usd(derived.hi)) : "—"}
            highlight="emerald" />
          <PeriodStat label="Period Low"
            value={derived.lo != null ? (isMobile ? `$${compact(derived.lo)}` : usd(derived.lo)) : "—"}
            highlight="rose" />
          <PeriodStat label="Change"
            value={derived.changePct != null ? pctText(derived.changePct) : "—"}
            highlight={derived.changePct == null ? undefined : derived.changePct >= 0 ? "emerald" : "rose"} />
          <PeriodStat label="Range"
            value={derived.rangePct != null ? `${derived.rangePct.toFixed(1)}%` : "—"} />
        </div>
      </div>

      {/* ── Metrics grid ── */}
      {cryptoDetails && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3"
        >
          <MetricCard label="Price" value={usd(priceNow)} accent />
          <MetricCard label="24h Change" value={pctText(change24h)}
            highlight={change24h == null ? undefined : change24h >= 0 ? "emerald" : "rose"} />
          <MetricCard label="24h High" value={cgData?.high_24h != null ? usd(cgData.high_24h) : "—"} highlight="emerald" />
          <MetricCard label="24h Low"  value={cgData?.low_24h  != null ? usd(cgData.low_24h)  : "—"} highlight="rose" />
          <MetricCard label="Volume 24h" value={compact(vol24)} />
          <MetricCard label="Market Cap"
            value={cgData?.market_cap != null ? compact(cgData.market_cap) : compact(mktCap)} />
          <MetricCard label="VWAP 24h" value={usd(vwap)} />
          <MetricCard label="FDV"
            value={cgData?.fully_diluted_valuation != null ? compact(cgData.fully_diluted_valuation) : "—"}
            sub="Fully diluted" />
        </motion.div>
      )}

      {/* ── Supply + ATH/ATL ── */}
      {cryptoDetails && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
        >
          {/* Supply card */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/40 mb-3">Supply</div>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-white/50 font-semibold">Circulating</span>
                <span className="font-extrabold text-gray-900 dark:text-white">
                  {compact(cgData?.circulating_supply ?? circSupply)}
                  {cgData?.circulating_supply && cryptoDetails.symbol ? ` ${cryptoDetails.symbol.toUpperCase()}` : ""}
                </span>
              </div>
              {supplyPct != null && (
                <div>
                  <div className="flex justify-end mb-1">
                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
                      {supplyPct.toFixed(1)}% of max
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
                      style={{ width: `${supplyPct}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-between text-xs border-t border-black/5 dark:border-white/[0.06] pt-2">
                <span className="text-gray-500 dark:text-white/50 font-semibold">Total Supply</span>
                <span className="font-extrabold text-gray-900 dark:text-white">
                  {compact(cgData?.total_supply ?? null)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-white/50 font-semibold">Max Supply</span>
                <span className="font-extrabold text-gray-900 dark:text-white">
                  {maxSupply ? compact(maxSupply) : cgData?.max_supply ? compact(cgData.max_supply) : "∞"}
                </span>
              </div>
            </div>
          </div>

          {/* ATH / ATL card */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/30 dark:bg-white/[0.05] dark:bg-none p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/40 mb-3">
              All-Time Extremes {cgLoading && <span className="animate-pulse">·</span>}
            </div>
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">ATH</div>
                  <div className="text-[10px] text-emerald-600/60 dark:text-white/40">{fmtDate(cgData?.ath_date)}</div>
                </div>
                <div className="text-base font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
                  {cgData?.ath != null ? usd(cgData.ath) : "—"}
                </div>
                {cgData?.ath && priceNow && (
                  <div className="text-[10px] text-emerald-700/70 dark:text-white/40 mt-0.5">
                    {(((priceNow - cgData.ath) / cgData.ath) * 100).toFixed(1)}% from ATH
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-rose-100 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">ATL</div>
                  <div className="text-[10px] text-rose-600/60 dark:text-white/40">{fmtDate(cgData?.atl_date)}</div>
                </div>
                <div className="text-base font-extrabold text-rose-800 dark:text-rose-200 mt-1">
                  {cgData?.atl != null ? usd(cgData.atl) : "—"}
                </div>
                {cgData?.atl && priceNow && (
                  <div className="text-[10px] text-rose-700/70 dark:text-white/40 mt-0.5">
                    +{(((priceNow - cgData.atl) / cgData.atl) * 100).toFixed(0)}% from ATL
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Explorer link ── */}
      {cryptoDetails?.explorer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          <a
            href={cryptoDetails.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition shadow-sm"
            onClick={() => trackEvent("CryptoExplorerClick", { id: assetId })}
          >
            <FaExternalLinkAlt className="text-[10px]" />
            View on explorer
          </a>
        </motion.div>
      )}

    </div>
  );
};

export default CryptoChartPrices;
