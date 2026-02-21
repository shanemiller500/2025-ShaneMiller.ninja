"use client";

import { useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";

import { trackEvent } from "@/utils/mixpanel";
import { Button } from "@/components/ui/button";
import EarningsSection from "./sections/EarningsSection";
import IPOCalendarSection from "./sections/IPOCalendarSection";
import LiveStreamHeatmapSection from "./sections/LiveStreamHeatmapSection";
import NewsSearchTabSection from "./sections/NewsSearchTabSection";
import StockQuoteSection from "./sections/StockQuoteSection";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type TabKey = "quote" | "live" | "ipo" | "earnings" | "news";

interface TabConfig {
  key: TabKey;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TABS: TabConfig[] = [
  { key: "quote", label: "Stock Quote" },
  { key: "live", label: "Live Stream Heatmap" },
  { key: "ipo", label: "IPO Calendar" },
  { key: "earnings", label: "Earnings Info" },
  { key: "news", label: "News Search" },
];

/* ------------------------------------------------------------------ */
/*  DashboardTabs Component                                            */
/* ------------------------------------------------------------------ */
export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>("quote");

  useEffect(() => {
    trackEvent("Dashboard Tabs Viewed", { activeTab: "quote" });
  }, []);

  const handleTabClick = (tab: TabKey): void => {
    setActiveTab(tab);
    trackEvent("Dashboard Tab Clicked", { tab });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* Header / selector card */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 shadow-sm">
        {/* soft blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Market Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-gray-600 dark:text-white/70">
              Real-time market dashboard — stocks, earnings, IPOs, and news powered by the Finnhub
              API. Data is cached and shared across components to keep updates fast and avoid
              rate limits.
            </p>
          </div>
        </div>
        
      </div>

      {/* Tabs card */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-brand-900 shadow-sm overflow-hidden">
        {/* tab bar */}
        <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const isActive = t.key === activeTab;
            return (
              <Button
                key={t.key}
                variant="pill"
                active={isActive}
                size={null}
                onClick={() => handleTabClick(t.key)}
                className="relative shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-sm"
                aria-current={isActive ? "page" : undefined}
              >
                {t.label}
                {isActive && (
                  <motion.span
                    layoutId="dashTabsPill"
                    className="absolute inset-0 -z-10 rounded-2xl"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </Button>
            );
          })}
        </div>

        {/* content */}
        <div className="p-1 sm:p-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {activeTab === "live" && <LiveStreamHeatmapSection />}
              {activeTab === "quote" && <StockQuoteSection />}
              {activeTab === "ipo" && <IPOCalendarSection />}
              {activeTab === "earnings" && <EarningsSection />}
              {activeTab === "news" && <NewsSearchTabSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
