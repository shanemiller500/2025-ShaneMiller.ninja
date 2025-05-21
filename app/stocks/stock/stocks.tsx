// Filename: DashboardTabs.tsx
'use client';

import React, { useEffect, useState } from 'react';
import StockQuoteSection from "./StockQuoteSection";
import IPOCalendarSection from "./IPOCalendarSection";
import EarningsSection from "./EarningsSection";
import NewsSearchTabSection from "./NewsSearchTabSection";
import LiveStreamHeatmapSection from "./LiveStreamHeatmapSection";
import { trackEvent } from "@/utils/mixpanel";

const DashboardTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("quote");

  const baseTabClasses = "px-4 py-2 cursor-pointer text-sm";
  const activeTabClasses = "border-b-2 border-indigo-500 text-indigo-500 font-bold";

  useEffect(() => {
    trackEvent("Dashboard Tabs Viewed", { activeTab });
  }, []);

  const handleTabClick = (tab: string) => {
    trackEvent("Dashboard Tab Clicked", { tab });
    setActiveTab(tab);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <nav className="mb-4">
        {/* Mobile: dropdown */}
        <div className="sm:hidden">
          <label htmlFor="dashboard-tab-select" className="sr-only">Select Dashboard Tab</label>
          <select
            id="dashboard-tab-select"
            value={activeTab}
            onChange={e => handleTabClick(e.target.value)}
            className="block w-full p-2 border rounded dark:bg-brand-900 dark:border-gray-600 focus:outline-none"
          >
            <option value="quote">Stock Quote</option>
            <option value="live">Live Stream Heatmap</option>
            <option value="ipo">IPO Calendar</option>
            <option value="earnings">Earnings Info</option>
            <option value="news">News Search</option>
          </select>
        </div>

        {/* Desktop: tabs */}
        <ul className="hidden sm:flex border-b border-gray-300 dark:border-gray-700">
          <li
            className={`${baseTabClasses} ${activeTab === "quote" ? activeTabClasses : ''}`}
            onClick={() => handleTabClick("quote")}
          >
            Stock Quote
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "live" ? activeTabClasses : ''}`}
            onClick={() => handleTabClick("live")}
          >
            Live Stream Heatmap
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "ipo" ? activeTabClasses : ''}`}
            onClick={() => handleTabClick("ipo")}
          >
            IPO Calendar
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "earnings" ? activeTabClasses : ''}`}
            onClick={() => handleTabClick("earnings")}
          >
            Earnings Info
          </li>
          <li
            className={`${baseTabClasses} ${activeTab === "news" ? activeTabClasses : ''}`}
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
