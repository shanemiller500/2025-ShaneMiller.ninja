"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/utils/mixpanel";

/* dynamic imports */
const LiveStreamHeatmap = dynamic(() => import("./LiveStreamHeatmap"), { ssr: false });
const TopGainersLosers = dynamic(() => import("./TopGainersLosers"), { ssr: false });
const CryptoChartPrices = dynamic(() => import("./CryptoChartPrices"), { ssr: false });
const FearGreedIndexes = dynamic(() => import("./FearGreedIndexes"), { ssr: false });

const tabs = [
  { name: "Heatmap", component: <LiveStreamHeatmap /> },
  { name: "Gainers & Losers", component: <TopGainersLosers /> },
  { name: "Charts", component: <CryptoChartPrices /> },
];

const CryptoDashboard = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    trackEvent("CryptoDashboard Page Viewed");
  }, []);

  const ActiveComponent = useMemo(() => tabs[active]?.component, [active]);

  return (
    <div className="min-h-screen">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-white dark:from-black dark:via-black dark:to-black" />
        <div className="absolute -top-28 -left-28 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 dark:text-gray-100">
        {/* header */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 sm:p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
            <div className="absolute -top-14 -left-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Crypto Dashboard
              </h1>

            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-white/60">
              <span className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06]">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Fear & Greed indexes */}
        <FearGreedIndexes />

        {/* tabs */}
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
          {/* tab bar */}
          <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar">
            {tabs.map((t, i) => {
              const isActive = active === i;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setActive(i);
                    trackEvent("Dashboard Tab Click", { tab: t.name });
                  }}
                  className={[
                    "relative shrink-0 rounded-2xl px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-extrabold transition",
                    "ring-1 ring-black/10 dark:ring-white/10",
                    isActive
                      ? "text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-sm"
                      : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10]",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {t.name}
                  {isActive && (
                    <motion.span
                      layoutId="activeTabPill"
                      className="absolute inset-0 -z-10 rounded-2xl"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* content */}
          <div className="">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tabs[active]?.name}
                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {ActiveComponent}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* bottom spacing */}
        <div className="h-6" />
      </div>
    </div>
  );
};

export default CryptoDashboard;
