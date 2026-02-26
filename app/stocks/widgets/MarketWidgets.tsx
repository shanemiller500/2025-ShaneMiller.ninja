"use client";
/**
 * MarketWidgets.tsx — Thin orchestrator for the Stock Quote sidebar.
 *
 * All data fetching is handled by marketStore (shared singleton) via the
 * useMarketData hook. This component only owns derived computations and
 * wires individual widget components together.
 */

import { useEffect, useMemo, useState } from "react";
import { useMarketData } from "../hooks/useMarketData";
import { marketStore } from "../lib/marketStore";
import { TOP_TICKERS, MOVER_POOL } from "../lib/tickers";
import type { TickerData, MarketStatus } from "../lib/types";
import { SkeletonTile } from "./TickerTile";
import FearGreedWidget from "./FearGreedWidget";
import MarketStatusWidget from "./MarketStatusWidget";
import MortgageRateWidget from "./MortgageRateWidget";
import TodayMarketWidget from "./TodayMarketWidget";
import TopTickersWidget from "./TopTickersWidget";
import MoversWidget from "./MoversWidget";

/* ─── Props ─────────────────────────────────────────────────────────── */
interface MarketWidgetsProps {
  onSelectTicker: (ticker: string) => void;
}

/* ─── Component ─────────────────────────────────────────────────────── */
export default function MarketWidgets({ onSelectTicker }: MarketWidgetsProps) {
  const { tickerMap: topMap,   loadingSet: topLoading }   = useMarketData(TOP_TICKERS, "high");
  const { tickerMap: moverMap, loadingSet: moverLoading } = useMarketData(MOVER_POOL,  "low");

  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);

  // Single shared market-status call (cached 5 min inside the store)
  useEffect(() => {
    marketStore.getMarketStatus().then((s) => { if (s) setMarketStatus(s); });
  }, []);

  /* ── Derived data ───────────────────────────────────────────────── */
  const topList = useMemo<TickerData[]>(
    () => TOP_TICKERS.map((s) => topMap[s]).filter((x): x is TickerData => !!x),
    [topMap]
  );

  const moverList = useMemo<TickerData[]>(
    () => MOVER_POOL.map((s) => moverMap[s]).filter((x): x is TickerData => !!x),
    [moverMap]
  );

  const topGainers = useMemo(
    () =>
      moverList
        .filter((i) => (i.quote?.dp ?? 0) > 0)
        .sort((a, b) => (b.quote.dp ?? 0) - (a.quote.dp ?? 0))
        .slice(0, 8),
    [moverList]
  );

  const topLosers = useMemo(
    () =>
      moverList
        .filter((i) => (i.quote?.dp ?? 0) < 0)
        .sort((a, b) => (a.quote.dp ?? 0) - (b.quote.dp ?? 0))
        .slice(0, 8),
    [moverList]
  );

  const overallChange = useMemo(() => {
    if (!topList.length) return 0;
    return topList.reduce((s, i) => s + (i.quote?.dp ?? 0), 0) / topList.length;
  }, [topList]);

  const fearGreedIndex = useMemo(
    () => Math.max(0, Math.min(100, ((overallChange + 3) / 6) * 100)),
    [overallChange]
  );

  const perfText = useMemo(() => {
    if (!topList.length) return "";
    if (overallChange > 0)
      return `Markets are up ~${overallChange.toFixed(2)}% across top tickers.`;
    if (overallChange < 0)
      return `Markets are down ~${Math.abs(overallChange).toFixed(2)}% across top tickers.`;
    return "Markets are roughly flat across top tickers.";
  }, [topList.length, overallChange]);

  /* ── Loading skeleton (shown until at least 1 ticker arrives) ─────── */
  if (topList.length === 0) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6"
            >
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
              </div>
            </div>
          ))}
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

  /* ── Full render ──────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col space-y-2">
      {/* Market status + Fear/Greed */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <MarketStatusWidget marketStatus={marketStatus} />
        <FearGreedWidget
          index={fearGreedIndex}
          overallChange={overallChange}
          tickerCount={topList.length}
        />
      </div>

      {/* Today's Market + Mortgage Rates */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TodayMarketWidget
          overallChange={overallChange}
          topList={topList}
          perfText={perfText}
        />
        <MortgageRateWidget />
      </div>

      {/* Top tickers */}
      <TopTickersWidget
        topList={topList}
        loadingSet={topLoading}
        onSelect={onSelectTicker}
      />

      {/* Movers */}
      <MoversWidget
        gainers={topGainers}
        losers={topLosers}
        moverLoading={moverLoading}
        moverList={moverList}
        onSelect={onSelectTicker}
      />
    </div>
  );
}
