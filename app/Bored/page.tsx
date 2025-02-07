"use client";

import React, { useState } from "react";
import TrumpQuotes from "./TrumpQuotes"; // Adjust the path if needed
import RandomActivity from "./RandomActivity";
import ChuckNorrisQuotes from "./ChuckNorrisQuotes";
import RandomAdvice from "./RandomAdvice";

const QuotesDashboard = () => {
  // Define tabs for each component.
  const tabs = [
    { name: "Trump Quotes", component: <TrumpQuotes /> },
    { name: "Chuck Norris Quotes", component: <ChuckNorrisQuotes /> },
    { name: "Random Activity", component: <RandomActivity /> },
    { name: "Random Advice", component: <RandomAdvice /> },
  ];

  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen dark:text-gray-100 p-4 space-y-8">
      <h1 className="text-4xl font-bold text-center">Quotes Dashboard</h1>

      {/* Tab Buttons */}
      <div className="flex justify-center border-b border-gray-700">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
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
