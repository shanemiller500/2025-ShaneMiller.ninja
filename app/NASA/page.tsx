"use client";

import React, { useState } from "react";
import NasaPhotoOfTheDay from "./nasaPhotoOfTheDay"; // Adjust path if needed
import MarsRoverPhotos from "./marsRover"; // Adjust path if needed

const NasaMediaPage = () => {
  // Define tabs with a name and component for each view.
  const tabs = [
    { name: "Photo of the Day", component: <NasaPhotoOfTheDay /> },
    { name: "Mars Rover Photos", component: <MarsRoverPhotos /> },
  ];

  // State to track the active tab.
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen dark:text-gray-100 p-4">
      <h1 className="text-4xl font-bold text-center mb-8">NASA Media</h1>

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
      <div className="mt-6">
        {tabs[activeTab].component}
      </div>
    </div>
  );
};

export default NasaMediaPage;
