"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate } from "@/utils/formatters";
import FearGreedWidget from "./FearGreedWidget";

interface QuoteData {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

interface TickerData {
  symbol: string;
  quote: QuoteData;
  logo?: string;
}

interface MarketWidgetsProps {
  onSelectTicker: (ticker: string) => void;
}

const CACHE_KEY = "marketWidgetsCache_v2";
const CACHE_TTL = 10 * 60 * 1000; // 10 min for fresher data
const PROXY = "https://u-mail.co/api/finnhubProxy";
const MAX_CONCURRENT_REQUESTS = 5;

// Expanded top tickers - major US stocks
const topTickers = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
  "BRK.B", "JPM", "V", "UNH", "LLY", "XOM", "WMT", "MA",
  "JNJ", "PG", "AVGO", "HD", "CVX", "MRK", "ABBV", "COST", "PEP"
];

// Expanded movers pool
const potentialMovers = [
  "AMD", "NFLX", "INTC", "CSCO", "QCOM", "ADBE", "CRM", "ORCL",
  "PYPL", "UBER", "LYFT", "SHOP", "SPOT", "SNAP", "x",
  "ZM", "DOCU", "CRWD", "NET", "DDOG", "SNOW", "PLTR", "RBLX",
  "COIN", "HOOD", "SOFI", "AFRM", "RIVN", "LCID", "NIO", "XPEV"
];

/* ---------------- helpers ---------------- */
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const pct = (n: number) => `${n >= 0 ? "+" : ""}${Number.isFinite(n) ? n.toFixed(2) : "0.00"}%`;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function cleanLogo(url?: string) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s || s.startsWith("data:")) return "";
  return s;
}

// Sleep helper for rate limiting
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Ticker Tile Component ---------------- */
function TickerTile({
  item,
  onSelect,
  size = "md",
}: {
  item: TickerData;
  onSelect: (sym: string) => void;
  size?: "sm" | "md";
}) {
  const c = item.quote?.c ?? 0;
  const dp = item.quote?.dp ?? 0;
  const up = dp >= 0;
  const logo = cleanLogo(item.logo);

  const accent = up
    ? "from-emerald-500/20 via-emerald-500/10 to-transparent"
    : "from-rose-500/20 via-rose-500/10 to-transparent";

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(item.symbol)}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "group relative w-full overflow-hidden text-left",
        "rounded-xl border border-black/10 dark:border-white/10",
        "bg-white/75 dark:bg-white/[0.06]",
        "shadow-sm hover:shadow-md hover:border-black/15 dark:hover:border-white/15",
        "ring-1 ring-black/5 dark:ring-white/5",
        "transition-all duration-200",
        size === "sm" ? "p-2" : "p-2"
      )}
    >
      {/* Logo background */}
      <div
        className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
        style={{
          backgroundImage: logo ? `url(${logo})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: logo ? 0.45 : 0,
          filter: "saturate(1.1) contrast(1.05)",
        }}
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 opacity-90">
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-indigo-500/8 blur-2xl" />
        <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-fuchsia-500/8 blur-2xl" />
        <div className={cn("absolute inset-0 bg-gradient-to-br", accent)} />
      </div>

      {/* Legibility layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/45 to-white/25 dark:from-black/55 dark:via-black/35 dark:to-black/20" />

      {/* Shine effect */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-90">
        <div className="absolute -inset-8 -left-1/2 w-[130%] rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-sm" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-1">
          <div className=" text-xs sm:text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
            {item.symbol}
          </div>
          <div className={cn(
            "text-xs sm:text-sm font-semibold tabular-nums",
            "text-gray-900 dark:text-white"
          )}>
            ${Number.isFinite(c) ? c.toFixed(2) : "0.00"}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div
            className={cn(
              "text-[10px] sm:text-xs font-semibold tabular-nums",
              up ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
            )}
          >
            {up ? "▲" : "▼"} {pct(dp)}
          </div>

          {item.quote?.t && size === "md" && (
            <div className="hidden sm:block text-[9px] font-semibold text-gray-600 dark:text-white/50 truncate">
              {formatDate(item.quote.t, "short")}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ---------------- Skeleton Components ---------------- */
function SkeletonTile({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className={cn(
      "rounded-xl border border-black/10 dark:border-white/10",
      "bg-white/70 dark:bg-white/[0.06]",
      size === "sm" ? "p-2.5" : "p-3"
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-16 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-4 w-14 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="h-3 w-12 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-3 w-16 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
      </div>
    </div>
  );
}

/* ---------------- Main Component ---------------- */
export default function MarketWidgets({ onSelectTicker }: MarketWidgetsProps) {
  const [loading, setLoading] = useState(true);
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; t?: number } | null>(null);
  const [topTen, setTopTen] = useState<TickerData[]>([]);
  const [topGainers, setTopGainers] = useState<TickerData[]>([]);
  const [topLosers, setTopLosers] = useState<TickerData[]>([]);
  const [error, setError] = useState("");
  const [moversTab, setMoversTab] = useState<"gainers" | "losers">("gainers");

  const fetchQueueRef = useRef<string[]>([]);
  const activeFetchesRef = useRef(0);
  const fetchCacheRef = useRef<Map<string, TickerData | null>>(new Map());

  // Optimized fetch with concurrency control and caching
  const fetchTickerData = useCallback(async (ticker: string): Promise<TickerData | null> => {
    // Check in-memory cache first
    if (fetchCacheRef.current.has(ticker)) {
      return fetchCacheRef.current.get(ticker) ?? null;
    }

    // Concurrency control
    if (activeFetchesRef.current >= MAX_CONCURRENT_REQUESTS) {
      fetchQueueRef.current.push(ticker);
      return null;
    }

    activeFetchesRef.current++;

    try {
      const [quoteRes, profileRes] = await Promise.all([
        fetch(`${PROXY}/quote/${encodeURIComponent(ticker)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000)
        }).catch(() => null),
        fetch(`${PROXY}/profile/${encodeURIComponent(ticker)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000)
        }).catch(() => null),
      ]);

      const quote = quoteRes?.ok ? await quoteRes.json() : null;
      const profile = profileRes?.ok ? await profileRes.json() : null;

      if (quote?.c !== undefined && quote?.dp !== undefined) {
        const data = { symbol: ticker, quote, logo: profile?.logo };
        fetchCacheRef.current.set(ticker, data);
        return data;
      }
    } catch (err) {
      console.warn(`Error fetching ${ticker}:`, err);
    } finally {
      activeFetchesRef.current--;

      // Process queue
      if (fetchQueueRef.current.length > 0) {
        const next = fetchQueueRef.current.shift();
        if (next) {
          setTimeout(() => fetchTickerData(next), 50);
        }
      }
    }

    fetchCacheRef.current.set(ticker, null);
    return null;
  }, []);

  // Batch fetch with progress tracking
  const batchFetch = useCallback(async (tickers: string[]): Promise<TickerData[]> => {
    const results: (TickerData | null)[] = [];

    // Process in batches
    for (let i = 0; i < tickers.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = tickers.slice(i, i + MAX_CONCURRENT_REQUESTS);
      const batchResults = await Promise.all(batch.map(fetchTickerData));
      results.push(...batchResults);

      // Small delay between batches
      if (i + MAX_CONCURRENT_REQUESTS < tickers.length) {
        await sleep(100);
      }
    }

    return results.filter((x): x is TickerData => !!x && x.quote?.c > 0);
  }, [fetchTickerData]);

  const fetchMarketData = useCallback(async () => {
    try {
      // Fetch market status
      const statusRes = await fetch(`${PROXY}/market-status?exchange=US`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      const statusData = await statusRes.json();
      setMarketStatus(statusData);

      // Fetch top tickers (show first 18)
      const topResults = await batchFetch(topTickers.slice(0, 18));
      setTopTen(topResults);

      // Fetch movers
      const moverResults = await batchFetch(potentialMovers);

      const gainers = moverResults
        .filter((i) => (i.quote?.dp ?? 0) > 0)
        .sort((a, b) => (b.quote.dp ?? 0) - (a.quote.dp ?? 0))
        .slice(0, 8);

      const losers = moverResults
        .filter((i) => (i.quote?.dp ?? 0) < 0)
        .sort((a, b) => (a.quote.dp ?? 0) - (b.quote.dp ?? 0))
        .slice(0, 8);

      setTopGainers(gainers);
      setTopLosers(losers);
      setError("");

      return {
        marketStatus: statusData,
        topTen: topResults,
        topGainers: gainers,
        topLosers: losers,
      };
    } catch (err) {
      console.error("Market data fetch error:", err);
      setError("Error fetching market data.");
      return null;
    }
  }, [batchFetch]);

  // Cache management
  const loadCache = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;

      const { timestamp, marketStatus, topTen, topGainers, topLosers } = JSON.parse(raw);
      if (Date.now() - timestamp < CACHE_TTL) {
        setMarketStatus(marketStatus);
        setTopTen(topTen);
        setTopGainers(topGainers);
        setTopLosers(topLosers);
        return true;
      }
    } catch (e) {
      console.error("Cache load error:", e);
    }
    return false;
  }, []);

  const saveCache = useCallback((data: any) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), ...data }));
    } catch (e) {
      console.error("Cache save error:", e);
    }
  }, []);

  useEffect(() => {
    let intervalId: any;
    let mounted = true;

    const init = async () => {
      setLoading(true);

      const hasCache = loadCache();

      if (!hasCache && mounted) {
        const data = await fetchMarketData();
        if (data && mounted) saveCache(data);
      }

      if (mounted) setLoading(false);

      // Auto-refresh
      intervalId = setInterval(async () => {
        if (!mounted) return;
        const data = await fetchMarketData();
        if (data && mounted) saveCache(data);
      }, CACHE_TTL);
    };

    init();

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchMarketData, loadCache, saveCache]);

  const overallMarketChange = useMemo(() => {
    if (!topTen.length) return 0;
    return topTen.reduce((sum, item) => sum + (item.quote?.dp ?? 0), 0) / topTen.length;
  }, [topTen]);

  const fearGreedIndex = useMemo(() => {
    return clamp(((overallMarketChange + 3) / 6) * 100, 0, 100);
  }, [overallMarketChange]);

  const perfText = useMemo(() => {
    if (!topTen.length) return "";
    if (overallMarketChange > 0) return `Markets are up ~${overallMarketChange.toFixed(2)}% across top tickers.`;
    if (overallMarketChange < 0) return `Markets are down ~${Math.abs(overallMarketChange).toFixed(2)}% across top tickers.`;
    return "Markets are roughly flat across top tickers.";
  }, [topTen.length, overallMarketChange]);

  /* ---------------- UI Components ---------------- */
  const StatBanner = () => {
    if (!marketStatus) return null;
    const open = !!marketStatus.isOpen;

    return (
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
          <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl" />
        </div>

        <div className="relative px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
                Markets:{" "}
                <span className={cn(open ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                  {open ? "OPEN" : "CLOSED"}
                </span>
              </div>
              {marketStatus.t && (
                <div className="mt-0.5 text-[10px] font-semibold text-gray-600 dark:text-white/60">
                  {formatDate(marketStatus.t, "short")}
                </div>
              )}
            </div>

            <div
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1",
                open
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                  : "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
              )}
            >
              {open ? "Live" : "After hours"}
            </div>
          </div>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Status + Fear/Greed */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <StatBanner />
        <FearGreedWidget index={fearGreedIndex} />
      </div>

      {/* Overall performance */}
      {topTen.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-3 py-2.5 shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/12 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/12 blur-3xl" />
          </div>

          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">Today's Market</div>
              <div className="mt-0.5 text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-white/70">
                {perfText}
              </div>
            </div>

            <div
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 tabular-nums",
                overallMarketChange > 0
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                  : overallMarketChange < 0
                  ? "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
                  : "bg-slate-500/15 text-slate-800 dark:text-slate-200 ring-slate-500/25"
              )}
            >
              {pct(overallMarketChange)}
            </div>
          </div>

          <div className="mt-2 h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
        </div>
      )}

      {/* Top tickers */}
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm flex-1 flex flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
          <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl" />
        </div>

        <div className="relative px-3 py-2.5 border-b border-black/10 dark:border-white/10">
          <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
            Top Tickers ({topTen.length})
          </h3>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {/* Mobile: horizontal scroll */}
          <div className="sm:hidden h-full overflow-x-auto overflow-y-hidden no-scrollbar">
            <div className="flex gap-2 p-3 h-full">
              {topTen.map((item) => (
                <div key={item.symbol} className="shrink-0 w-[160px]">
                  <TickerTile item={item} onSelect={onSelectTicker} size="sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: scrollable grid */}
          <div className="hidden sm:block h-full overflow-y-auto p-3" style={{ scrollbarWidth: "thin" }}>
            <div className="grid grid-cols-2 lg:grid-cols-3  gap-2">
              {topTen.map((item) => (
                <TickerTile key={item.symbol} item={item} onSelect={onSelectTicker} size="md" />
              ))}
            </div>
          </div>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>

      {/* Movers: mobile tabs */}
      <div className="sm:hidden relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
          <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/14 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-400/14 blur-3xl" />
        </div>

        <div className="relative px-2 py-2 border-b border-black/10 dark:border-white/10 flex gap-2">
          <button
            type="button"
            onClick={() => setMoversTab("gainers")}
            className={cn(
              "flex-1 rounded-xl px-3 py-1.5 text-xs font-extrabold ring-1 ring-black/10 dark:ring-white/10 transition",
              moversTab === "gainers"
                ? "bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white"
                : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06]"
            )}
          >
            Gainers ({topGainers.length})
          </button>
          <button
            type="button"
            onClick={() => setMoversTab("losers")}
            className={cn(
              "flex-1 rounded-xl px-3 py-1.5 text-xs font-extrabold ring-1 ring-black/10 dark:ring-white/10 transition",
              moversTab === "losers"
                ? "bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white"
                : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06]"
            )}
          >
            Losers ({topLosers.length})
          </button>
        </div>

        <div className="relative p-2">
          <AnimatePresence mode="wait" initial={false}>
            {moversTab === "gainers" ? (
              <motion.div
                key="gainers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {topGainers.map((i) => (
                  <TickerTile key={i.symbol} item={i} onSelect={onSelectTicker} size="sm" />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="losers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {topLosers.map((i) => (
                  <TickerTile key={i.symbol} item={i} onSelect={onSelectTicker} size="sm" />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/20 to-sky-500/20" />
      </div>

      {/* Movers: desktop grid */}
      <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Gainers */}
        <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
          </div>

          <div className="relative px-3 py-2.5 border-b border-black/10 dark:border-white/10">
            <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
              Top Gainers ({topGainers.length})
            </h3>
          </div>

          <div className="relative p-2 space-y-2">
            {topGainers.length ? (
              topGainers.map((item) => <TickerTile key={item.symbol} item={item} onSelect={onSelectTicker} size="sm" />)
            ) : (
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-4 text-center">
                <div className="text-xs font-extrabold text-gray-900 dark:text-white">No data</div>
              </div>
            )}
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-emerald-500/30 via-emerald-500/20 to-emerald-500/10" />
        </div>

        {/* Losers */}
        <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35">
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-rose-400/15 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-rose-400/15 blur-3xl" />
          </div>

          <div className="relative px-3 py-2.5 border-b border-black/10 dark:border-white/10">
            <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
              Top Losers ({topLosers.length})
            </h3>
          </div>

          <div className="relative p-2 space-y-2">
            {topLosers.length ? (
              topLosers.map((item) => <TickerTile key={item.symbol} item={item} onSelect={onSelectTicker} size="sm" />)
            ) : (
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-4 text-center">
                <div className="text-xs font-extrabold text-gray-900 dark:text-white">No data</div>
              </div>
            )}
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-rose-500/30 via-rose-500/20 to-rose-500/10" />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}