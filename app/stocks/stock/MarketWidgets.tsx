"use client";

import React, { useEffect, useMemo, useState } from "react";
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
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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
    if (overallMarketChange < 0) return `Markets are down ~${Math.abs(overallMarketChange).toFixed(2)}% across top tickers.`;
    return "Markets are roughly flat across top tickers.";
  }, [topTen.length, overallMarketChange]);

  /* ---------------- UI bits ---------------- */
  const StatBanner = () => {
    if (!marketStatus) return null;
    const open = !!marketStatus.isOpen;

    return (
      <div
        className={cn(
          "rounded-3xl border px-4 py-3",
          "bg-white/70 dark:bg-white/[0.06]",
          open
            ? "border-emerald-500/20"
            : "border-red-500/20"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-gray-900 dark:text-white">
              Markets:{" "}
              <span className={cn(open ? "text-emerald-700 dark:text-emerald-200" : "text-red-700 dark:text-red-200")}>
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
                : "bg-red-500/15 text-red-800 dark:text-red-200 ring-red-500/25"
            )}
          >
            {open ? "Live" : "After hours"}
          </div>
        </div>
      </div>
    );
  };

  const MiniTicker = ({ item }: { item: TickerData }) => {
    const c = item.quote?.c ?? 0;
    const dp = item.quote?.dp ?? 0;
    const up = dp >= 0;

    return (
      <button
        type="button"
        onClick={() => onSelectTicker(item.symbol)}
        className={cn(
          "group w-full rounded-2xl border border-black/10 dark:border-white/10",
          "bg-white/70 dark:bg-white/[0.06]",
          "px-3 py-3 text-left shadow-sm hover:shadow-md transition active:scale-[0.99]"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center overflow-hidden">
            {item.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.logo} alt={`${item.symbol} logo`} className="h-7 w-7 object-contain" loading="lazy" />
            ) : (
              <span className="text-xs font-extrabold text-gray-700 dark:text-white/70">
                {item.symbol.slice(0, 2)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                {item.symbol}
              </div>
              <div className="text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">
                ${c.toFixed(2)}
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between gap-2">
              <div
                className={cn(
                  "text-xs font-extrabold tabular-nums",
                  up ? "text-emerald-700 dark:text-emerald-200" : "text-red-700 dark:text-red-200"
                )}
              >
                {up ? "▲" : "▼"} {pct(dp)}
              </div>

              {/* hide timestamp on tiny widths */}
              {item.quote?.t ? (
                <div className="hidden xs:block text-[11px] font-semibold text-gray-500 dark:text-white/50 truncate">
                  {formatDate(item.quote.t, "short")}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const MoversList = ({ items, kind }: { items: TickerData[]; kind: "gainers" | "losers" }) => {
    const title = kind === "gainers" ? "Top Gainers" : "Top Losers";
    const empty = items.length === 0;

    return (
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">{title}</h3>
            <span className="text-[11px] font-semibold text-gray-600 dark:text-white/60">
              Tap a ticker
            </span>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {empty ? (
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-4 text-center">
              <div className="text-sm font-extrabold text-gray-900 dark:text-white">No data</div>
              <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-white/60">
                Try again in a bit.
              </div>
            </div>
          ) : (
            items.map((item) => <MiniTicker key={`${kind}-${item.symbol}`} item={item} />)
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6">
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* top row: status + fear/greed */}
      <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
        <StatBanner />
        <FearGreedWidget index={fearGreedIndex} />
      </div>

      {/* overall perf */}
      {topTen.length > 0 ? (
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
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
                  ? "bg-red-500/15 text-red-800 dark:text-red-200 ring-red-500/25"
                  : "bg-slate-500/15 text-slate-800 dark:text-slate-200 ring-slate-500/25"
              )}
            >
              {pct(overallMarketChange)}
            </div>
          </div>
        </div>
      ) : null}

      {/* Top tickers: compact, mobile-first */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">Top Tickers</h3>
          <span className="text-[11px] font-semibold text-gray-600 dark:text-white/60">Swipe / scroll</span>
        </div>

        {/* On mobile: horizontal scroll pills. On larger: grid. */}
        <div className="p-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar sm:hidden">
            {topTen.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectTicker(item.symbol)}
                className={cn(
                  "shrink-0 w-[160px] rounded-2xl border border-black/10 dark:border-white/10",
                  "bg-white/70 dark:bg-white/[0.06] p-3 shadow-sm active:scale-[0.99]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center overflow-hidden">
                    {item.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.logo} alt="" className="h-7 w-7 object-contain" loading="lazy" />
                    ) : (
                      <span className="text-xs font-extrabold text-gray-700 dark:text-white/70">
                        {item.symbol.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white">{item.symbol}</div>
                    <div className="text-xs font-semibold text-gray-700 dark:text-white/70 tabular-nums">
                      ${(item.quote?.c ?? 0).toFixed(2)}
                    </div>
                    <div
                      className={cn(
                        "text-xs font-extrabold tabular-nums",
                        (item.quote?.dp ?? 0) >= 0
                          ? "text-emerald-700 dark:text-emerald-200"
                          : "text-red-700 dark:text-red-200"
                      )}
                    >
                      {(item.quote?.dp ?? 0) >= 0 ? "▲" : "▼"} {pct(item.quote?.dp ?? 0)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-2">
            {topTen.map((item) => (
              <MiniTicker key={`top-${item.symbol}`} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Movers: mobile tab switch, desktop two-column */}
      <div className="sm:hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-3 py-3 border-b border-black/10 dark:border-white/10 flex items-center gap-2">
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

        <div className="p-3">
          {moversTab === "gainers" ? (
            <div className="space-y-2">{topGainers.map((i) => <MiniTicker key={`g-${i.symbol}`} item={i} />)}</div>
          ) : (
            <div className="space-y-2">{topLosers.map((i) => <MiniTicker key={`l-${i.symbol}`} item={i} />)}</div>
          )}
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-3">
        <MoversList items={topGainers} kind="gainers" />
        <MoversList items={topLosers} kind="losers" />
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
