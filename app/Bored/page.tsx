'use client'

import React, { useState, useEffect } from "react";
import TrumpQuotes from "./TrumpQuotes"; 
import RandomActivity from "./RandomActivity";
import ChuckNorrisQuotes from "./ChuckNorrisQuotes";
import RandomAdvice from "./RandomAdvice";
import { trackEvent } from "@/utils/mixpanel";
import Zoltars from "@/components/widget-zoltar";

const QuotesDashboard = () => {
  // Define tabs for each component.
  const tabs = [

    { name: "Chuck Norris Quotes", component: <ChuckNorrisQuotes /> },
    { name: "Zoltar", component: <Zoltars /> },
    { name: "Random Advice", component: <RandomAdvice /> },
  ];

  // State to track the active tab index.
  const [activeTab, setActiveTab] = useState(0);

  // Track page view on mount.
  useEffect(() => {
    trackEvent("Quotes Dashboard Viewed", { page: "Quotes Dashboard" });
  }, []);

  // Handler for tab clicks that fires a tracking event and updates the active tab.
  const handleTabClick = (index: number, tabName: string) => {
    setActiveTab(index);
    trackEvent("Quotes Dashboard Tab Clicked", { tab: tabName });
  };

  return (
    <div className="min-h-screen dark:text-gray-100 p-4 space-y-8">
      <h1 className="text-4xl font-bold text-center">Quotes Dashboard</h1>

      {/* Tab Buttons */}
      <div className="flex justify-center border-b border-gray-700">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabClick(index, tab.name)}
            className={`px-6 py-2 text-lg font-medium focus:outline-none transition-all border-b-2 ${
              activeTab === index
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent hover:border-gray-500"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="mt-6">{tabs[activeTab].component}</div>
    </div>
  );
};

export default QuotesDashboard;
