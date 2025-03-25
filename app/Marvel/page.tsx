"use client";

import React, { useState, Suspense, lazy, useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";

const MarvelCharactersPage = lazy(() => import("./MarvelCharactersPage"));
const MarvelComicsPage = lazy(() => import("./MarvelComicsPage"));
const MarvelEventsPage = lazy(() => import("./MarvelEventsPage"));
const MarvelSeriesPage = lazy(() => import("./MarvelSeriesPage"));
const MarvelCreatorsPage = lazy(() => import("./MarvelCreatorsPage"));
const MarvelStoriesPage = lazy(() => import("./MarvelStoriesPage"));

const Spinner = () => (
  <div className="flex justify-center items-center my-8">
    <svg
      className="animate-spin h-10 w-10 text-indigo-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  </div>
);

const App: React.FC = () => {
  useEffect(() => {
    // Fire a page view event for Mixpanel on mount.
    trackEvent("Marvel API Page Viewed", { page: "Marvel API Page" });
  }, []);

  const tabs = [
    { name: "Characters", component: <MarvelCharactersPage /> },
    { name: "Comics", component: <MarvelComicsPage /> },
    { name: "Events", component: <MarvelEventsPage /> },
    { name: "Series", component: <MarvelSeriesPage /> },
    { name: "Creators", component: <MarvelCreatorsPage /> },
    { name: "Stories", component: <MarvelStoriesPage /> },
  ];

  const [activeTab, setActiveTab] = useState(0);

  const handleTabClick = (index: number, tabName: string) => {
    setActiveTab(index);
    trackEvent("Marvel Tab Clicked", { tab: tabName });
  };

  return (
    <div className="min-h-screen dark:bg-gray-900 dark:text-gray-100 p-4">
      <h1 className="text-4xl font-bold text-center mb-8">
        Marvel Dashboard
      </h1>
      <div className="flex justify-center border-b border-gray-700 mb-6">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`px-6 py-3 text-lg font-medium focus:outline-none transition-all border-b-2 ${
              activeTab === index
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent hover:border-gray-500"
            }`}
            onClick={() => handleTabClick(index, tab.name)}>
            {tab.name}
          </button>
        ))}
      </div>
      <Suspense fallback={<Spinner />}>{tabs[activeTab].component}</Suspense>
    </div>
  );
};

export default App;
