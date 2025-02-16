"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from '@/utils/mixpanel';

// Dynamically import the components with SSR disabled
const LiveStreamHeatmap = dynamic(() => import("./LiveStreamHeatmap"), { ssr: false });
const TopGainersLosers = dynamic(() => import("./TopGainersLosers"), { ssr: false });
const CryptoChartPrices = dynamic(() => import("./CryptoChartPrices"), { ssr: false });

const tabs = [
  { name: "Heatmap", component: <LiveStreamHeatmap /> },
  { name: "Gainers & Losers", component: <TopGainersLosers /> },
  { name: "Charts", component: <CryptoChartPrices /> },
];

const CryptoDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    trackEvent("CryptoDashboard Page Viewed", { page: "CryptoDashboard" });
  }, []);

  const handleTabClick = (index: number, tabName: string) => {
    setActiveTab(index);
    trackEvent("Tab Clicked", { tab: tabName, index });
  };

  return (
    <div className="min-h-screen dark:text-gray-100 p-4 space-y-8">
      <h1 className="text-4xl font-bold text-center">Crypto Dashboard</h1>
      
      <div className="flex justify-center border-b border-gray-700">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`px-6 py-2 text-lg font-medium focus:outline-none transition-all border-b-2 ${
              activeTab === index
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent hover:border-gray-500"
            }`}
            onClick={() => handleTabClick(index, tab.name)}
          >
            {tab.name}
          </button>
        ))}
      </div>
      
      <div className="mt-6">{tabs[activeTab].component}</div>
    </div>
  );
};

export default CryptoDashboard;
