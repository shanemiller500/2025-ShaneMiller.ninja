"use client";

import React, { useEffect, useMemo, useState } from "react";
import NasaPhotoOfTheDay from "./nasaPhotoOfTheDay";
import MarsRoverPhotos from "./marsRover";
import NasaCMEPage from "./NasaCMEPage"; // keep your file name as-is
import { trackEvent } from "@/utils/mixpanel";

const pillBase =
  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-extrabold transition " +
  "border border-black/10 bg-white text-gray-800 hover:bg-black/[0.03] " +
  "dark:border-white/10 dark:bg-brand-900 dark:text-white/80 dark:hover:bg-white/[0.06]";

const pillActive =
  "bg-gray-900 text-white border-black/20 hover:bg-gray-900 " +
  "dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/10";

export default function NasaMediaPage() {
  useEffect(() => {
    trackEvent("NASA API Page Viewed", { page: "NASA API Page" });
  }, []);

  const tabs = useMemo(
    () => [
      { name: "Photo of the Day", component: <NasaPhotoOfTheDay /> },
      { name: "Mars Rover Photos", component: <MarsRoverPhotos /> },
      { name: "CME & Analysis", component: <NasaCMEPage /> },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState(0);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    trackEvent("NASA Tab Clicked", { tab: tabs[index]?.name ?? "Unknown" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
          NASA Media
        </h1>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          APOD, Mars rover photos, and solar event data.
        </p>
      </div>

      {/* Mobile: select */}
      <div className="mb-4 sm:hidden">
        <label htmlFor="nasa-tab" className="sr-only">
          Choose section
        </label>
        <select
          id="nasa-tab"
          value={activeTab}
          onChange={(e) => handleTabClick(parseInt(e.target.value, 10))}
          className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-gray-800 shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500
                     dark:border-white/10 dark:bg-brand-900 dark:text-white/90"
        >
          {tabs.map((t, idx) => (
            <option key={t.name} value={idx}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: scroll pills */}
      <div className="no-scrollbar mb-6 hidden overflow-x-auto sm:flex">
        <div className="flex gap-2">
          {tabs.map((tab, index) => (
            <button
              key={tab.name}
              onClick={() => handleTabClick(index)}
              className={`${pillBase} ${activeTab === index ? pillActive : ""}`}
              aria-selected={activeTab === index}
              role="tab"
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-6">
        {tabs[activeTab].component}
      </div>
    </div>
  );
}
