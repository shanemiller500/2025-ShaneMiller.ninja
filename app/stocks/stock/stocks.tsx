// Filename: DashboardTabs.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StockQuoteSection from "./StockQuoteSection";
import IPOCalendarSection from "./IPOCalendarSection";
import EarningsSection from "./EarningsSection";
import NewsSearchTabSection from "./NewsSearchTabSection";
import LiveStreamHeatmapSection from "./LiveStreamHeatmapSection";
import { trackEvent } from "@/utils/mixpanel";

type TabKey = "quote" | "live" | "ipo" | "earnings" | "news";

const TABS: { key: TabKey; label: string }[] = [
  { key: "quote", label: "Stock Quote" },
  { key: "live", label: "Live Stream Heatmap" },
  { key: "ipo", label: "IPO Calendar" },
  { key: "earnings", label: "Earnings Info" },
  { key: "news", label: "News Search" },
];

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>("quote");

  useEffect(() => {
    trackEvent("Dashboard Tabs Viewed", { activeTab: "quote" });
  }, []);

  const activeMeta = useMemo(
    () => TABS.find((t) => t.key === activeTab) ?? TABS[0],
    [activeTab]
  );

  const handleTabClick = (tab: TabKey) => {
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
          </div>
        </div>
      </div>

      {/* Tabs card (use CryptoDashboard-style tabs; no dropdown) */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
        {/* tab bar */}
        <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabClick(t.key)}
                className={[
                  "relative shrink-0 rounded-2xl px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-extrabold transition",
                  "ring-1 ring-black/10 dark:ring-white/10",
                  isActive
                    ? "text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-sm"
                    : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10]",
                ].join(" ")}
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
              </button>
            );
          })}
        </div>

        {/* content */}
        <div className="p-3 sm:p-4">
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
