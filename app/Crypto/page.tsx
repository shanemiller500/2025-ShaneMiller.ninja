"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

/* dynamic imports */
const LiveStreamHeatmap  = dynamic(() => import("./LiveStreamHeatmap"),   { ssr: false });
const TopGainersLosers   = dynamic(() => import("./TopGainersLosers"),    { ssr: false });
const CryptoChartPrices  = dynamic(() => import("./CryptoChartPrices"),   { ssr: false });
const FearGreedIndexes   = dynamic(() => import("./FearGreedIndexes"),    { ssr: false });

const tabs = [
  { name: "Heatmap",          component: <LiveStreamHeatmap  /> },
  { name: "Gainers & Losers", component: <TopGainersLosers   /> },
  { name: "Charts",           component: <CryptoChartPrices  /> },
];

const CryptoDashboard = () => {
  const [active, setActive] = useState(0);
  useEffect(() => trackEvent("CryptoDashboard Page Viewed"), []);

  return (
    <div className="min-h-screen p-4 space-y-8 dark:text-gray-100">
      <h1 className="text-4xl font-bold text-center">Crypto Dashboard</h1>

      {/* Fear & Greed indexes (4 gauges) */}
      <FearGreedIndexes />

      {/* tabs */}
      <div className="flex justify-center border-b border-gray-700 mt-8 overflow-x-auto">
        {tabs.map((t, i) => (
          <button
            key={t.name}
            className={`px-6 py-2 text-lg font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === i
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent hover:border-gray-500"
            }`}
            onClick={() => {
              setActive(i);
              trackEvent("Dashboard Tab Click", { tab: t.name });
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mt-6">{tabs[active].component}</div>
    </div>
  );
};

export default CryptoDashboard;
