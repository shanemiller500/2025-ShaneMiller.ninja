"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart2, Calendar, Newspaper, Radio, TrendingUp } from "lucide-react";

import { trackEvent } from "@/utils/mixpanel";
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
  icon: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TABS: TabConfig[] = [
  { key: "quote",    label: "Quote",    icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "live",     label: "Live",     icon: <Radio className="h-3.5 w-3.5" /> },
  { key: "ipo",      label: "IPO",      icon: <Calendar className="h-3.5 w-3.5" /> },
  { key: "earnings", label: "Earnings", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "news",     label: "News",     icon: <Newspaper className="h-3.5 w-3.5" /> },
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
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-3">

      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-24 h-72 w-72 rounded-full bg-indigo-400/25 blur-3xl dark:opacity-60" />
          <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl dark:opacity-60" />
        </div>

        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            {/* Live pulse badge */}
            <div className="mb-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                Live · ~15 min delay
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Market Dashboard
            </h1>
            <p className="mt-1 max-w-md text-xs sm:text-sm text-gray-600 dark:text-white/60">
              Real-time stocks, earnings, IPOs &amp; market news — powered by Finnhub.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs shell ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-brand-900 shadow-sm">

        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-black/10 dark:border-white/10 p-1.5 sm:p-2">
          {TABS.map((t) => {
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabClick(t.key)}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "relative shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs sm:text-sm font-extrabold transition-colors duration-150",
                  isActive
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/80",
                ].join(" ")}
              >
                {isActive && (
                  <motion.span
                    layoutId="dashTabsIndicator"
                    className="absolute inset-0 -z-10 rounded-xl bg-gray-100 dark:bg-white/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className={[
                    "transition-colors",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-gray-400 dark:text-white/30",
                  ].join(" ")}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-1.5 sm:p-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {activeTab === "quote"    && <StockQuoteSection />}
              {activeTab === "live"     && <LiveStreamHeatmapSection />}
              {activeTab === "ipo"      && <IPOCalendarSection />}
              {activeTab === "earnings" && <EarningsSection />}
              {activeTab === "news"     && <NewsSearchTabSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
