"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

import { AnimatePresence, motion } from "framer-motion";

import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Dynamic Imports                                                    */
/* ------------------------------------------------------------------ */
const LiveStreamHeatmap = dynamic(() => import("./LiveStreamHeatmap"), { ssr: false });
const TopGainersLosers = dynamic(() => import("./TopGainersLosers"), { ssr: false });
const CryptoChartPrices = dynamic(() => import("./CryptoChartPrices"), { ssr: false });
const FearGreedIndexes = dynamic(() => import("./FearGreedIndexes"), { ssr: false });

const tabs = [
  { name: "Heatmap",       component: <LiveStreamHeatmap /> },
  { name: "Gainers & Losers", component: <TopGainersLosers /> },
  { name: "Charts",        component: <CryptoChartPrices /> },
  { name: "Fear & Greed",  component: <FearGreedIndexes /> },
];

const CryptoDashboard = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    trackEvent("CryptoDashboard Page Viewed");
  }, []);

  const ActiveComponent = useMemo(() => tabs[active]?.component, [active]);

  return (
    <div className="min-h-screen">


      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 dark:text-gray-100">
        {/* header */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-brand-900 p-5 sm:p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
            <div className="absolute -top-14 -left-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Crypto Dashboard
              </h1>
                <p className="mt-2 max-w-2xl text-sm sm:text-base text-gray-600 dark:text-white/70">
                  A personal crypto dashboard built to keep market data clear and up to date.
                  Data comes from CoinGecko, with live price updates streamed via CoinCap WebSockets.
                </p>

            </div>
          </div>
        </div>

        {/* tabs */}
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-brand-900 shadow-sm overflow-hidden">
          {/* tab bar */}
          <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar">
            {tabs.map((t, i) => {
              const isActive = active === i;
              return (
                <Button
                  key={t.name}
                  type="button"
                  variant="pill"
                  active={isActive}
                  size="md"
                  className="relative text-sm whitespace-nowrap"
                  onClick={() => {
                    setActive(i);
                    trackEvent("Dashboard Tab Click", { tab: t.name });
                  }}
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
                </Button>
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
