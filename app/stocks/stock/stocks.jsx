'use client'

import React, { useEffect, useState } from "react";
import StockQuoteSection from "./StockQuoteSection";
import IPOCalendarSection from "./IPOCalendarSection";
import EarningsSection from "./EarningsSection";
import NewsSearchTabSection from "./NewsSearchTabSection";
import LiveStreamHeatmapSection from "./LiveStreamHeatmapSection";
import { trackEvent } from "@/utils/mixpanel";

const DashboardTabs = () => {
  const [activeTab, setActiveTab] = useState("quote");

  const baseTabClasses = "px-4 py-2 cursor-pointer";
  const activeTabClasses = "border-b-2 border-indigo-500 text-indigo-500 font-bold";

  // Track a page view event on mount.
  useEffect(() => {
    trackEvent("Dashboard Tabs Viewed", { activeTab });
  }, []);

  // Handler for tab clicks that tracks the event and updates the active tab.
  const handleTabClick = (tab) => {
    trackEvent("Dashboard Tab Clicked", { tab });
    setActiveTab(tab);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <nav className="mb-4">
        <ul className="flex border-b border-gray-300 dark:border-gray-700">
        <li
            className={`${baseTabClasses} ${activeTab === "quote" && activeTabClasses}`}
            onClick={() => handleTabClick("quote")}
          >
            Stock Quote
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "live" && activeTabClasses}`}
            onClick={() => handleTabClick("live")}
          >
            Live stream heatmap
          </li>
         
          <li
            className={`${baseTabClasses} ${activeTab === "ipo" && activeTabClasses}`}
            onClick={() => handleTabClick("ipo")}
          >
            IPO Calendar
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "earnings" && activeTabClasses}`}
            onClick={() => handleTabClick("earnings")}
          >
            Earnings Info
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "news" && activeTabClasses}`}
            onClick={() => handleTabClick("news")}
          >
            News Search
          </li>
        </ul>
      </nav>
      <div className="tab-content">
        {activeTab === "live" && <LiveStreamHeatmapSection />}
        {activeTab === "quote" && <StockQuoteSection />}
        {activeTab === "ipo" && <IPOCalendarSection />}
        {activeTab === "earnings" && <EarningsSection />}
        {activeTab === "news" && <NewsSearchTabSection />}
      </div>
    </div>
  );
};

export default DashboardTabs;
