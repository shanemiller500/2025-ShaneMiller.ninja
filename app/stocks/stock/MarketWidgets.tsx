"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  t: number; // unix seconds (or ms in your formatter — you already use it)
}

interface TickerData {
  symbol: string;
  quote: QuoteData;
  logo?: string;
}

interface MarketWidgetsProps {
  onSelectTicker: (ticker: string) => void;
}

const CACHE_KEY = "marketWidgetsCache";
const CACHE_TTL = 15 * 60 * 1000;

const PROXY = "https://u-mail.co/api/finnhubProxy";

const topTenTickers = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "TSLA",
  "META",
  "NVDA",
  "BRK.B",
  "JPM",
  "V",
  "IBM",
  "ORCL",
];

const potentialTickers = [
  "AMD",
  "NFLX",
  "SQ",
  "ZM",
  "SHOP",
  "TWLO",
  "DOCU",
  "FVRR",
  "SPOT",
  "INTC",
  "IBM",
  "ORCL",
  "ADBE",
  "CSCO",
  "QCOM",
  "MU",
  "HPQ",
  "DELL",
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
  if (!s) return "";
  // avoid svg data URIs etc.
  if (s.startsWith("data:")) return "";
  return s;
}

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
    ? "from-emerald-500/25 via-emerald-500/10 to-transparent"
    : "from-rose-500/25 via-rose-500/10 to-transparent";

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(item.symbol)}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.12 }}
      className={cn(
        "group relative w-full overflow-hidden text-left",
        "rounded-2xl border border-black/10 dark:border-white/10",
        "bg-white/75 dark:bg-white/[0.06]",
        "shadow-sm hover:shadow-[0_22px_55px_-30px_rgba(0,0,0,0.55)]",
        "ring-1 ring-black/5 dark:ring-white/5",
        size === "sm" ? "px-3 py-3" : "px-3.5 py-3.5"
      )}
    >
      {/* big logo background */}
      <div
        className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.08]"
        style={{
          backgroundImage: logo ? `url(${logo})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: logo ? 0.55 : 0,
          filter: "saturate(1.15) contrast(1.06)",
        }}
      />

      {/* heatmap-y blobs fallback */}
      <div className="absolute inset-0 opacity-100">
        <div className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="absolute -bottom-14 -right-14 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-2xl" />
        <div className={cn("absolute inset-0 bg-gradient-to-r", accent)} />
      </div>

      {/* legibility overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/75 via-white/60 to-white/30 dark:from-black/60 dark:via-black/40 dark:to-black/15" />

      {/* scanlines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] dark:opacity-[0.10] mix-blend-overlay">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.9) 1px, transparent 1px)",
            backgroundSize: "100% 8px",
          }}
        />
      </div>

      {/* shine sweep */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="absolute -inset-y-10 -left-1/2 w-[140%] rotate-12 bg-gradient-to-r from-transparent via-white/35 to-transparent blur-[1px]" />
      </div>

      {/* content */}
      <div className="relative z-10 flex items-center gap-3">
  

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-black tracking-tight text-gray-900 dark:text-white">
              {item.symbol}
            </div>
            <div className="text-sm font-black tabular-nums text-gray-900 dark:text-white">
              ${Number.isFinite(c) ? c.toFixed(2) : "0.00"}
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <div
              className={cn(
                "text-xs font-black tabular-nums",
                up ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"
              )}
            >
              {up ? "▲" : "▼"} {pct(dp)}
            </div>

            {item.quote?.t ? (
              <div className="hidden xs:block text-[11px] font-semibold text-gray-600 dark:text-white/55 truncate">
                {formatDate(item.quote.t, "short")}
              </div>
            ) : null}
          </div>
        </div>
      </div>

    </motion.button>
  );
}

/* ------------------------------------------------------------ */
/*  Component                                                    */
/* ------------------------------------------------------------ */
export default function MarketWidgets({ onSelectTicker }: MarketWidgetsProps) {
  const [loading, setLoading] = useState(true);
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; t?: number } | null>(null);
  const [topTen, setTopTen] = useState<TickerData[]>([]);
  const [topGainers, setTopGainers] = useState<TickerData[]>([]);
  const [topLosers, setTopLosers] = useState<TickerData[]>([]);
  const [error, setError] = useState("");

  // light “focus” for gainers/losers on mobile
  const [moversTab, setMoversTab] = useState<"gainers" | "losers">("gainers");

  const fetchTickerData = async (ticker: string): Promise<TickerData | null> => {
    try {
      const [quoteRes, profileRes] = await Promise.all([
        fetch(`${PROXY}/quote/${encodeURIComponent(ticker)}`, { cache: "no-store" }),
        fetch(`${PROXY}/profile/${encodeURIComponent(ticker)}`, { cache: "no-store" }),
      ]);

      const quote = await quoteRes.json();
      const profile = await profileRes.json();

      if (quote?.c !== undefined && quote?.dp !== undefined) {
        return { symbol: ticker, quote, logo: profile?.logo };
      }
    } catch (err) {
      console.error("Error fetching", ticker, err);
    }
    return null;
  };

  const fetchMarketData = async (): Promise<{
    data: {
      marketStatus: { isOpen: boolean; t?: number };
      topTen: TickerData[];
      topGainers: TickerData[];
      topLosers: TickerData[];
    };
  } | null> => {
    try {
      const statusRes = await fetch(`${PROXY}/market-status?exchange=US`, { cache: "no-store" });
      const statusData = await statusRes.json();

      const topTenResults = (await Promise.all(topTenTickers.map(fetchTickerData))).filter(
        (x): x is TickerData => !!x
      );

      const potentialResults = (await Promise.all(potentialTickers.map(fetchTickerData))).filter(
        (x): x is TickerData => !!x
      );

      const gainers = potentialResults
        .filter((i) => (i.quote?.dp ?? 0) > 0)
        .sort((a, b) => (b.quote.dp ?? 0) - (a.quote.dp ?? 0))
        .slice(0, 6);

      const losers = potentialResults
        .filter((i) => (i.quote?.dp ?? 0) < 0)
        .sort((a, b) => (a.quote.dp ?? 0) - (b.quote.dp ?? 0))
        .slice(0, 6);

      setMarketStatus(statusData);
      setTopTen(topTenResults);
      setTopGainers(gainers);
      setTopLosers(losers);
      setError("");

      return {
        data: {
          marketStatus: statusData,
          topTen: topTenResults,
          topGainers: gainers,
          topLosers: losers,
        },
      };
    } catch (err) {
      console.error(err);
      setError("Error fetching market data.");
      return null;
    }
  };

  useEffect(() => {
    const loadCache = (): boolean => {
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
        console.error("Cache load error", e);
      }
      return false;
    };

    const saveCache = (data: {
      marketStatus: any;
      topTen: TickerData[];
      topGainers: TickerData[];
      topLosers: TickerData[];
    }) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), ...data }));
      } catch (e) {
        console.error("Cache save error", e);
      }
    };

    let id: any;

    const init = async () => {
      setLoading(true);
      const haveCache = loadCache();
      if (!haveCache) {
        const res = await fetchMarketData();
        if (res) saveCache(res.data);
      }
      setLoading(false);

      id = setInterval(async () => {
        const res = await fetchMarketData();
        if (res) saveCache(res.data);
      }, CACHE_TTL);
    };

    init();

    return () => {
      if (id) clearInterval(id);
    };
  }, []);

  const overallMarketChange = useMemo(() => {
    if (!topTen.length) return 0;
    return topTen.reduce((sum, item) => sum + (item.quote?.dp ?? 0), 0) / topTen.length;
  }, [topTen]);

  const fearGreedIndex = useMemo(() => {
    // map avg dp into 0..100 with sane clamping
    // avg dp around -3..+3 => 0..100
    return clamp(((overallMarketChange + 3) / 6) * 100, 0, 100);
  }, [overallMarketChange]);

  const perfText = useMemo(() => {
    if (!topTen.length) return "";
    if (overallMarketChange > 0) return `Markets are up ~${overallMarketChange.toFixed(2)}% across top tickers.`;
    if (overallMarketChange < 0)
      return `Markets are down ~${Math.abs(overallMarketChange).toFixed(2)}% across top tickers.`;
    return "Markets are roughly flat across top tickers.";
  }, [topTen.length, overallMarketChange]);

  /* ---------------- UI bits ---------------- */
  const StatBanner = () => {
    if (!marketStatus) return null;
    const open = !!marketStatus.isOpen;

    return (
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/18 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/18 blur-3xl" />
        </div>

        <div className="relative px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                Markets:{" "}
                <span className={cn(open ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200")}>
                  {open ? "OPEN" : "CLOSED"}
                </span>
              </div>
              {marketStatus.t ? (
                <div className="mt-0.5 text-xs font-semibold text-gray-600 dark:text-white/60">
                  {formatDate(marketStatus.t, "short")}
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ring-1",
                open
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25"
                  : "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/25"
              )}
            >
              {open ? "Live" : "After hours"}
            </div>
          </div>
        </div>

        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-fuchsia-500/30 to-sky-500/30" />
      </div>
    );
  };

  const MoversShell = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/18 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/18 blur-3xl" />
        </div>

        <div className="relative px-4 py-3 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">{title}</h3>
          </div>
        </div>

        <div className="relative p-3">{children}</div>

        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/35 via-fuchsia-500/25 to-sky-500/25" />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6">
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/18 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/18 blur-3xl" />
        </div>

        <div className="relative flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* top row: status + fear/greed */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <StatBanner />
        <FearGreedWidget index={fearGreedIndex} />
      </div>

      {/* overall perf */}
      {topTen.length > 0 ? (
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-4 py-3 shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
            <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/14 blur-3xl" />
            <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/14 blur-3xl" />
          </div>

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-gray-900 dark:text-white">Today’s Market</div>
              <div className="mt-0.5 text-xs sm:text-sm font-semibold text-gray-700 dark:text-white/70">
                {perfText}
              </div>
            </div>

            <div
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ring-1 tabular-nums",
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

          <div className="mt-2 h-[2px] w-full bg-gradient-to-r from-indigo-500/35 via-fuchsia-500/25 to-sky-500/25" />
        </div>
      ) : null}

      {/* Top tickers */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/18 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/18 blur-3xl" />
        </div>

        <div className="relative px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">Top Tickers</h3>
        </div>

        <div className="relative p-3">
          {/* Mobile: horizontal scroll with snap */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar sm:hidden snap-x snap-mandatory pb-1">
            {topTen.map((item) => (
              <div key={item.symbol} className="shrink-0 w-[190px] snap-start">
                <TickerTile item={item} onSelect={onSelectTicker} size="sm" />
              </div>
            ))}
          </div>

          {/* Desktop: grid */}
          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-2">
            {topTen.map((item) => (
              <TickerTile key={`top-${item.symbol}`} item={item} onSelect={onSelectTicker} />
            ))}
          </div>
        </div>

        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/35 via-fuchsia-500/25 to-sky-500/25" />
      </div>

      {/* Movers: mobile tab switch */}
      <div className="sm:hidden relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/16 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/16 blur-3xl" />
        </div>

        <div className="relative px-3 py-3 border-b border-black/10 dark:border-white/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMoversTab("gainers")}
            className={cn(
              "flex-1 rounded-2xl px-4 py-2 text-sm font-extrabold ring-1 ring-black/10 dark:ring-white/10 transition",
              moversTab === "gainers"
                ? "text-white bg-gradient-to-r from-indigo-600 to-purple-600"
                : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06]"
            )}
          >
            Gainers
          </button>
          <button
            type="button"
            onClick={() => setMoversTab("losers")}
            className={cn(
              "flex-1 rounded-2xl px-4 py-2 text-sm font-extrabold ring-1 ring-black/10 dark:ring-white/10 transition",
              moversTab === "losers"
                ? "text-white bg-gradient-to-r from-indigo-600 to-purple-600"
                : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06]"
            )}
          >
            Losers
          </button>
        </div>

        <div className="relative p-3">
          <AnimatePresence mode="wait" initial={false}>
            {moversTab === "gainers" ? (
              <motion.div
                key="gainers"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="space-y-2"
              >
                {topGainers.map((i) => (
                  <TickerTile key={`g-${i.symbol}`} item={i} onSelect={onSelectTicker} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="losers"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="space-y-2"
              >
                {topLosers.map((i) => (
                  <TickerTile key={`l-${i.symbol}`} item={i} onSelect={onSelectTicker} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/35 via-fuchsia-500/25 to-sky-500/25" />
      </div>

      {/* Movers: desktop two-column */}
      <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-3">
        <MoversShell title="Top Gainers">
          <div className="space-y-2">
            {topGainers.length ? (
              topGainers.map((item) => <TickerTile key={`dg-${item.symbol}`} item={item} onSelect={onSelectTicker} />)
            ) : (
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-4 text-center">
                <div className="text-sm font-extrabold text-gray-900 dark:text-white">No data</div>
                <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-white/60">Try again in a bit.</div>
              </div>
            )}
          </div>
        </MoversShell>

        <MoversShell title="Top Losers">
          <div className="space-y-2">
            {topLosers.length ? (
              topLosers.map((item) => <TickerTile key={`dl-${item.symbol}`} item={item} onSelect={onSelectTicker} />)
            ) : (
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-4 text-center">
                <div className="text-sm font-extrabold text-gray-900 dark:text-white">No data</div>
                <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-white/60">Try again in a bit.</div>
              </div>
            )}
          </div>
        </MoversShell>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
