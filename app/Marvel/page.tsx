'use client'

import React, { useState, useEffect } from "react";
import MarvelCharactersPage from "./MarvelCharactersPage";
import MarvelComicsPage from "./MarvelComicsPage";
import { trackEvent } from "@/utils/mixpanel";

const App = () => {
  // Fire a page view event for Mixpanel on mount.
  useEffect(() => {
    trackEvent("Marvel API Page Viewed", { page: "Marvel API Page" });
  }, []);

  // Define your tabs with a name and component for each tab.
  const tabs = [
    { name: "Marvel Characters", component: <MarvelCharactersPage /> },
    { name: "Marvel Comics", component: <MarvelComicsPage /> },
  ];

  // State to track the active tab index.
  const [activeTab, setActiveTab] = useState(0);

  // Handler for tab clicks that fires a Mixpanel event and sets the active tab.
  const handleTabClick = (index: number, tabName: string) => {
    setActiveTab(index);
    trackEvent("Marvel Tab Clicked", { tab: tabName });
  };

  return (
    <div className="min-h-screen dark:text-gray-100 p-4 space-y-8">
      <h1 className="text-4xl font-bold text-center">Crypto & Marvel Dashboard</h1>

      {/* Tab Buttons */}
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

      {/* Active Tab Content */}
      <div className="mt-6">{tabs[activeTab].component}</div>
    </div>
  );
};

export default App;
