"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import { motion } from "framer-motion";
import { Newspaper, Trophy, LineChart, type LucideIcon } from "lucide-react";

import CryptoWidget from "@/app/Crypto/widget-crypto";
import WidgetNews from "@/app/news/widget-news";
import WidgetSearch from "@/components/widget-search";
import WidgetWeather from "@/components/widget-weather";
import FlightSearch from "@/app/Country/FlightSearch";
import FinanceTab from "./finance/FinanceTab";
import NewsTab from "./general/AllNewsTab";
import SportsTab from "./sports/SportsTab";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type TabKey = "All" | "Sports" | "Finance";

interface TabConfig {
  key: TabKey;
  label: string;
  Icon: LucideIcon;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TABS: TabConfig[] = [
  { key: "All", label: "All News", Icon: Newspaper },
  { key: "Sports", label: "Sports", Icon: Trophy },
  { key: "Finance", label: "Finance", Icon: LineChart },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function normalizeTab(v: string | null): TabKey | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s === "all") return "All";
  if (s === "sports") return "Sports";
  if (s === "finance") return "Finance";
  return null;
}

/* ------------------------------------------------------------------ */
/*  NewsPage Component                                                 */
/* ------------------------------------------------------------------ */
export default function NewsPage() {
  const [tab, setTab] = useState<TabKey>("All");

  // hydrate from URL once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = normalizeTab(new URL(window.location.href).searchParams.get("tab"));
    if (fromUrl) setTab(fromUrl);
  }, []);

  const activeMeta = useMemo(() => TABS.find((t) => t.key === tab) ?? TABS[0], [tab]);

  const handleTab = (value: TabKey) => {
    setTab(value);
    // update query param (no full navigation)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value.toLowerCase());
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-5">
      {/* Header card - NEWSPAPER MASTHEAD STYLE */}
      <div className="relative overflow-hidden border-2 sm:border-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-4 sm:p-6 md:p-8">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-red-600 dark:bg-red-400" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-600 dark:bg-red-400 rounded-full shrink-0" />
              <h1 className="text-xl sm:text-3xl md:text-5xl font-black tracking-tight text-neutral-900 dark:text-neutral-100 uppercase">
                The&nbsp;Miller&nbsp;Gazette
              </h1>
            </div>
            <div className="mt-3 sm:mt-4 border-l-4 border-red-600 dark:border-red-400 pl-3 sm:pl-4">
              <p className="text-xs sm:text-sm md:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed max-w-2xl">
                A custom news feed built around a Node.js route that aggregates multiple RSS sources
                into a single, consistent stream. It lets me normalize and filter headlines server-side,
                so the client stays fast and focused.
              </p>
            </div>
            <div className="mt-3 sm:mt-4 flex items-center gap-2 sm:gap-3">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] font-black text-neutral-500 dark:text-neutral-400">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs card - NEWSPAPER SECTION NAVIGATION */}
      <div className="border-2 sm:border-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20]">
        {/* tab bar */}
        <div
          className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600"
          role="tablist"
          aria-label="News sections"
        >
          {TABS.map((t, index) => {
            const isActive = t.key === tab;
            const Icon = t.Icon;
            return (
              <Button
                key={t.key}
                type="button"
                role="tab"
                variant="news-tab"
                active={isActive}
                size={null}
                aria-selected={isActive}
                onClick={() => handleTab(t.key)}
                className={cn(
                  "px-4 sm:px-6 md:px-8 py-3 sm:py-4 text-[10px] sm:text-xs md:text-sm",
                  index !== 0 && "border-l-2 border-neutral-900 dark:border-neutral-100",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {t.label}
                </span>

                {isActive && (
                  <motion.span
                    layoutId="activeTabPill"
                    className="absolute inset-0 -z-10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Layout: content + sidebar */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main */}
        <main className="min-w-0">
          <div className="border-2 sm:border-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] overflow-hidden">
            <div className="p-2 sm:p-4">
              {tab === "All" ? <NewsTab /> : tab === "Sports" ? <SportsTab /> : <FinanceTab />}
            </div>
          </div>
        </main>

        {/* Sidebar - NEWSPAPER SIDEBAR MODULES */}
        <aside className="min-w-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] overflow-hidden">
              <div className="border-b-2 border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 px-3 py-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900">Search</span>
              </div>
              <div className="p-3 sm:p-4">
                <WidgetSearch />
              </div>
            </div>

            <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] overflow-hidden">
              <div className="border-b-2 border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 px-3 py-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900">Weather</span>
              </div>
              <div className="p-3 sm:p-4">
                <WidgetWeather />
              </div>
            </div>

            <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] overflow-hidden">
              <div className="border-b-2 border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 px-3 py-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900">Flights</span>
              </div>
              <div className="p-3 sm:p-4">
                <FlightSearch full={null} />
              </div>
            </div>

            <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] overflow-hidden">
              <div className="border-b-2 border-neutral-900 dark:border-neutral-100 bg-red-600 dark:bg-red-400 px-3 py-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900">Crypto</span>
              </div>
              <div className="p-3 sm:p-4">
                <CryptoWidget />
              </div>
            </div>

            <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] overflow-hidden">
              <div className="border-b-2 border-neutral-900 dark:border-neutral-100 bg-red-600 dark:bg-red-400 px-3 py-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900">Headlines</span>
              </div>
              <div className="p-3 sm:p-4">
                <WidgetNews />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="h-4" />
    </div>
  );
}
