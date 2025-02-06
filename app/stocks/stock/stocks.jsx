"use client";

import React, { useState } from "react";
import StockQuoteSection from "./StockQuoteSection";
import IPOCalendarSection from "./IPOCalendarSection";
import EarningsSection from "./EarningsSection";
import NewsSearchTabSection from "./NewsSearchTabSection";
import LiveStreamHeatmapSection from "./LiveStreamHeatmapSection";

const DashboardTabs = () => {
  const [activeTab, setActiveTab] = useState("live");

  const baseTabClasses = "px-4 py-2 cursor-pointer";
  const activeTabClasses = "border-b-2 border-blue-500 font-bold";

  return (
    <div className="max-w-6xl mx-auto p-4">
      <nav className="mb-4">
        <ul className="flex border-b border-gray-300 dark:border-gray-700">
          <li
            className={`${baseTabClasses} ${activeTab === "live" && activeTabClasses}`}
            onClick={() => setActiveTab("live")}
          >
            Live stream heatmap
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "quote" && activeTabClasses}`}
            onClick={() => setActiveTab("quote")}
          >
            Stock Quote
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "ipo" && activeTabClasses}`}
            onClick={() => setActiveTab("ipo")}
          >
            IPO Calendar
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "earnings" && activeTabClasses}`}
            onClick={() => setActiveTab("earnings")}
          >
            Earnings Info
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "news" && activeTabClasses}`}
            onClick={() => setActiveTab("news")}
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
