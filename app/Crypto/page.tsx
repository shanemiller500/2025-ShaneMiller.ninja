"use client";

import { type ReactNode, useEffect } from "react";
import dynamic from "next/dynamic";
import { Activity, ArrowUpDown, LayoutGrid, LineChart } from "lucide-react";

import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Dynamic Imports                                                    */
/* ------------------------------------------------------------------ */
const LiveStreamHeatmap = dynamic(() => import("./LiveStreamHeatmap"), { ssr: false });
const TopGainersLosers  = dynamic(() => import("./TopGainersLosers"),  { ssr: false });
const CryptoChartPrices = dynamic(() => import("./CryptoChartPrices"), { ssr: false });
const FearGreedIndexes  = dynamic(() => import("./FearGreedIndexes"),  { ssr: false });

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
type TabKey = "heatmap" | "movers" | "charts" | "feargreed";

const TABS: DashboardTab<TabKey>[] = [
  { key: "heatmap",   label: "Heatmap",          hint: "Live stream", icon: <LayoutGrid  className="h-4 w-4" /> },
  { key: "movers",    label: "Gainers & Losers", hint: "Top 15",      icon: <ArrowUpDown className="h-4 w-4" /> },
  { key: "charts",    label: "Charts",           hint: "History",     icon: <LineChart   className="h-4 w-4" /> },
  { key: "feargreed", label: "Fear & Greed",     hint: "Sentiment",   icon: <Activity    className="h-4 w-4" /> },
];

const PANELS: Record<TabKey, () => ReactNode> = {
  heatmap:   () => <LiveStreamHeatmap />,
  movers:    () => <TopGainersLosers />,
  charts:    () => <CryptoChartPrices />,
  feargreed: () => <FearGreedIndexes />,
};

/* ------------------------------------------------------------------ */
/*  CryptoDashboard                                                    */
/* ------------------------------------------------------------------ */
export default function CryptoDashboard() {
  useEffect(() => {
    trackEvent("CryptoDashboard Page Viewed");
  }, []);

  return (
    <DashboardShell
      id="crypto"
      path="~/crypto"
      liveLabel="live feed"
      title="Crypto Dashboard"
      description="Streaming prices for the top 200 coins, plus movers, price history and market sentiment. Data comes from CoinCap and CoinGecko."
      tabs={TABS}
      renderPanel={(key) => PANELS[key]()}
      onTabChange={(key) => trackEvent("Dashboard Tab Click", { tab: key })}
    />
  );
}
