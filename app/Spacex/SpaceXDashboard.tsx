"use client";

import { useMemo, useState } from "react";

import { trackEvent } from "@/utils/mixpanel";
import CapsulesTab from "./CapsulesTab";
import CoresTab from "./CoresTab";
import LatestLaunchTab from "./LatestLaunchTab";
import LaunchpadsTab from "./LaunchpadsTab";
import PastLaunchesTab from "./PastLaunchesTab";
import PayloadsTab from "./PayloadsTab";
import RocketsTab from "./RocketsTab";
import StarlinkTab from "./StarlinkTab";
import UpcomingLaunchesTab from "./UpcomingLaunchesTab";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PILL_BASE =
  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-extrabold transition " +
  "border border-black/10 bg-white text-gray-800 hover:bg-black/[0.03] " +
  "dark:border-white/10 dark:bg-brand-900 dark:text-white/80 dark:hover:bg-white/[0.06]";

const PILL_ACTIVE =
  "bg-gray-900 text-white border-black/20 hover:bg-gray-900 " +
  "dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/10";

/* ------------------------------------------------------------------ */
/*  SpaceXDashboard Component                                          */
/* ------------------------------------------------------------------ */
export default function SpaceXDashboard() {
  const tabs = useMemo(
    () => [
      { name: "Latest Launch", component: <LatestLaunchTab /> },
      { name: "Upcoming Launches", component: <UpcomingLaunchesTab /> },
      { name: "Past Launches", component: <PastLaunchesTab /> },
      { name: "Rockets", component: <RocketsTab /> },
      { name: "Starlink", component: <StarlinkTab /> },
      { name: "Launchpads", component: <LaunchpadsTab /> },
      { name: "Cores", component: <CoresTab /> },
      { name: "Capsules", component: <CapsulesTab /> },
      { name: "Payloads", component: <PayloadsTab /> },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState(0);

  const handleTabClick = (index: number): void => {
    const tabName = tabs[index]?.name ?? "Unknown";
    trackEvent("Tab Clicked", { tabName, page: "SpaceX" });
    setActiveTab(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
          SpaceX Dashboard
        </h1>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Launches, rockets, Starlink, pads, cores, capsules, payloads. Data is community maintained and outdated.
        </p>
      </div>

      {/* Mobile: select */}
      <div className="mb-4 sm:hidden">
        <label htmlFor="spx-tab" className="sr-only">
          Choose section
        </label>
        <select
          id="spx-tab"
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
              className={`${PILL_BASE} ${activeTab === index ? PILL_ACTIVE : ""}`}
              aria-selected={activeTab === index}
              role="tab"
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-6">
        {tabs[activeTab].component}
      </div>
    </div>
  );
}
