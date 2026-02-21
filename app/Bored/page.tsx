"use client";

import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";
import { Button } from "@/components/ui/button";
import ChuckNorrisQuotes from "./ChuckNorrisQuotes";
import RandomAdvice from "./RandomAdvice";
import Zoltars from "@/components/widget-zoltar";

interface Tab {
  name: string;
  component: React.ReactNode;
}

export default function BoredDashboard() {
  const tabs: Tab[] = useMemo(
    () => [
      { name: "Chuck Norris", component: <ChuckNorrisQuotes /> },
      { name: "Zoltar", component: <Zoltars /> },
      { name: "Random Advice", component: <RandomAdvice /> },
    ],
    []
  );

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  useEffect(() => {
    trackEvent("Bored Dashboard Viewed", { page: "Bored Dashboard" });
  }, []);

  function handleTabClick(index: number, tabName: string) {
    setActiveTabIndex(index);
    trackEvent("Bored Dashboard Tab Clicked", { tab: tabName });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
          Bored Dashboard
        </h1>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Quick laughs, random ideas, and the occasional fortune.
        </p>
      </header>

      <MobileTabSelect
        tabs={tabs}
        activeIndex={activeTabIndex}
        onSelect={handleTabClick}
      />

      <DesktopTabPills
        tabs={tabs}
        activeIndex={activeTabIndex}
        onSelect={handleTabClick}
      />

      <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-6">
        {tabs[activeTabIndex].component}
      </div>
    </div>
  );
}

interface TabNavigationProps {
  tabs: Tab[];
  activeIndex: number;
  onSelect: (index: number, name: string) => void;
}

function MobileTabSelect({ tabs, activeIndex, onSelect }: TabNavigationProps) {
  return (
    <div className="mb-4 sm:hidden">
      <label htmlFor="bored-tab" className="sr-only">
        Choose section
      </label>
      <select
        id="bored-tab"
        value={activeIndex}
        onChange={(e) => {
          const index = parseInt(e.target.value, 10);
          onSelect(index, tabs[index]?.name || "Unknown");
        }}
        className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-brand-900 dark:text-white/90"
      >
        {tabs.map((tab, index) => (
          <option key={tab.name} value={index}>
            {tab.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function DesktopTabPills({ tabs, activeIndex, onSelect }: TabNavigationProps) {
  return (
    <div className="no-scrollbar mb-6 hidden overflow-x-auto sm:flex">
      <div className="flex gap-2">
        {tabs.map((tab, index) => (
          <Button
            key={tab.name}
            variant="pill"
            active={index === activeIndex}
            size="md"
            className="text-sm"
            onClick={() => onSelect(index, tab.name)}
            aria-selected={index === activeIndex}
            role="tab"
          >
            {tab.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
