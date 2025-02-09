'use client';

import React, { useState, useEffect } from "react";
import NasaPhotoOfTheDay from "./nasaPhotoOfTheDay"; // Adjust path if needed
import MarsRoverPhotos from "./marsRover"; // Adjust path if needed
import NasaCMEPage from "./NasaCMEPage"; // Adjust path if needed
import { trackEvent } from "@/utils/mixpanel";

const NasaMediaPage = () => {
  // Fire a page view event on mount.
  useEffect(() => {
    trackEvent("NASA API Page Viewed", { page: "NASA API Page" });
  }, []);

  // Define tabs with a name and component for each view.
  const tabs = [
    { name: "Photo of the Day", component: <NasaPhotoOfTheDay /> },
    { name: "Mars Rover Photos", component: <MarsRoverPhotos /> },
    { name: "CME & Analysis", component: <NasaCMEPage /> },
  ];

  // State to track the active tab.
  const [activeTab, setActiveTab] = useState(0);
  // State for the search term.
  const [searchTerm, setSearchTerm] = useState("");

  // Handler for tab clicks.
  const handleTabClick = (index: number, tabName: string) => {
    setActiveTab(index);
    trackEvent("NASA Tab Clicked", { tab: tabName });
  };

  // Handler for search form submission.
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    trackEvent("NASA Search Performed", { query: searchTerm });
    // Add search logic here if desired.
  };

  return (
    <div className="min-h-screen dark:text-gray-100 p-4">
      <h1 className="text-4xl font-bold text-center mb-8">NASA Media</h1>

      {/* Tab Buttons */}
      <div className="flex justify-center border-b border-gray-700 mb-4">
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

export default NasaMediaPage;
