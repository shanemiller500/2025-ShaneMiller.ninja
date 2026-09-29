"use client";

import { type ReactNode, useEffect } from "react";
import { BarChart2, Calendar, LayoutGrid, Newspaper, TrendingUp } from "lucide-react";

import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { trackEvent } from "@/utils/mixpanel";
import EarningsSection from "./sections/EarningsSection";
import IPOCalendarSection from "./sections/IPOCalendarSection";
import LiveStreamHeatmapSection from "./sections/LiveStreamHeatmapSection";
import NewsSearchTabSection from "./sections/NewsSearchTabSection";
import StockQuoteSection from "./sections/StockQuoteSection";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
type TabKey = "quote" | "live" | "ipo" | "earnings" | "news";

const TABS: DashboardTab<TabKey>[] = [
  { key: "quote",    label: "Markets",  hint: "Quote + pulse", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "live",     label: "Heatmap",  hint: "Live stream",   icon: <LayoutGrid className="h-4 w-4" /> },
  { key: "ipo",      label: "IPOs",     hint: "Calendar",      icon: <Calendar   className="h-4 w-4" /> },
  { key: "earnings", label: "Earnings", hint: "This week",     icon: <BarChart2  className="h-4 w-4" /> },
  { key: "news",     label: "News",     hint: "Search",        icon: <Newspaper  className="h-4 w-4" /> },
];

const PANELS: Record<TabKey, () => ReactNode> = {
  quote:    () => <StockQuoteSection />,
  live:     () => <LiveStreamHeatmapSection />,
  ipo:      () => <IPOCalendarSection />,
  earnings: () => <EarningsSection />,
  news:     () => <NewsSearchTabSection />,
};

/* ------------------------------------------------------------------ */
/*  DashboardTabs Component                                            */
/* ------------------------------------------------------------------ */
export default function DashboardTabs() {
  useEffect(() => {
    trackEvent("Dashboard Tabs Viewed", { activeTab: "quote" });
  }, []);

  return (
    <DashboardShell
      id="stocks"
      path="~/stocks"
      liveLabel="~15 min delay"
      title="Market Dashboard"
      description="Quotes, a live exchange heatmap, earnings, IPOs and market news for US equities. Data comes from Finnhub."
      tabs={TABS}
      renderPanel={(key) => PANELS[key]()}
      onTabChange={(key) => trackEvent("Dashboard Tab Clicked", { tab: key })}
    />
  );
}
