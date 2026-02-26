"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Globe, Satellite, Zap } from "lucide-react";

import MarsRoverPhotos   from "./marsRover";
import NasaCMEPage       from "./NasaCMEPage";
import NasaPhotoOfTheDay from "./nasaPhotoOfTheDay";
import { trackEvent }    from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */
type TabKey = "apod" | "mars" | "cme";

interface TabConfig {
  key:   TabKey;
  label: string;
  icon:  ReactNode;
}

const TABS: TabConfig[] = [
  { key: "apod", label: "Photo of the Day",  icon: <Camera    className="h-3.5 w-3.5" /> },
  { key: "mars", label: "Mars Rover Photos", icon: <Globe     className="h-3.5 w-3.5" /> },
  { key: "cme",  label: "CME & Analysis",    icon: <Zap       className="h-3.5 w-3.5" /> },
];

/* ------------------------------------------------------------------ */
/*  NasaMediaPage                                                      */
/* ------------------------------------------------------------------ */
export default function NasaMediaPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("apod");

  useEffect(() => {
    trackEvent("NASA API Page Viewed", { page: "NASA API Page" });
  }, []);

  const handleTabClick = (key: TabKey) => {
    setActiveTab(key);
    trackEvent("NASA Tab Clicked", { tab: key });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-3 dark:text-gray-100">

        {/* ── Hero header ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
          {/* Ambient blobs — space theme */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-14 -left-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl dark:opacity-60" />
            <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl dark:opacity-60" />
          </div>

          <div className="relative px-4 sm:px-6 py-4 sm:py-5">
            {/* Badge */}
            <div className="mb-1.5 flex items-center gap-2">
              <Satellite className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                NASA Public APIs
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              NASA Media
            </h1>
            <p className="mt-1 max-w-md text-xs sm:text-sm text-gray-600 dark:text-white/60">
              Astronomy data powered by NASA's public APIs — APOD, Mars rover imagery &amp; solar activity.
            </p>
          </div>
        </div>

        {/* ── Tabs shell ───────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-brand-900 shadow-sm">

          {/* Tab bar */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-black/10 dark:border-white/10 p-1.5 sm:p-2">
            {TABS.map((t) => {
              const isActive = t.key === activeTab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTabClick(t.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "relative shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs sm:text-sm font-extrabold transition-colors duration-150",
                    isActive
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/80",
                  ].join(" ")}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nasaTabsIndicator"
                      className="absolute inset-0 -z-10 rounded-xl bg-gray-100 dark:bg-white/10"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span
                    className={[
                      "transition-colors",
                      isActive
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-400 dark:text-white/30",
                    ].join(" ")}
                  >
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-1.5 sm:p-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {activeTab === "apod" && <NasaPhotoOfTheDay />}
                {activeTab === "mars" && <MarsRoverPhotos />}
                {activeTab === "cme"  && <NasaCMEPage />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
