"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NasaPhotoOfTheDay from "./nasaPhotoOfTheDay";
import MarsRoverPhotos from "./marsRover";
import NasaCMEPage from "./NasaCMEPage"; // keep your file name as-is
import { trackEvent } from "@/utils/mixpanel";

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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
          NASA Media
        </h1>
       <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Astronomy data powered by NASA’s public APIs, including APOD (Astronomy Picture of the Day),
          Mars rover photos, and recent solar activity.
       </p>

      </div>

      {/* Tabs card (mobile + desktop same style) */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
        {/* tab bar */}
        <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar">
          {tabs.map((t, idx) => {
            const isActive = idx === activeTab;

            // keep your existing NASA tab colors:
            // - inactive: white / brand-900 (like pillBase)
            // - active: gray-900 (like pillActive)
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => handleTabClick(idx)}
                className={[
                  "relative shrink-0 whitespace-nowrap rounded-full px-3 sm:px-4 py-2 text-sm font-extrabold transition",
                  "ring-1 ring-black/10 dark:ring-white/10",
                  isActive
                    ? "bg-gray-900 text-white border-black/20 hover:bg-gray-900 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/10"
                    : "border border-black/10 bg-white text-gray-800 hover:bg-black/[0.03] dark:border-white/10 dark:bg-brand-900 dark:text-white/80 dark:hover:bg-white/[0.06]",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
                aria-selected={isActive}
                role="tab"
              >
                {t.name}

                {isActive && (
                  <motion.span
                    layoutId="nasaTabsPill"
                    className="absolute inset-0 -z-10 rounded-full"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* content */}
        <div className="p-3 sm:p-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/10 sm:p-6">
                {tabs[activeTab].component}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="h-2" />
    </div>
  );
}
