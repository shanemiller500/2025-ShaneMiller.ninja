// Filename: page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import NewsTab from "./AllNewsTab";
import SportsTab from "./SportsTab";
import FinanceTab from "./FinanceTab";

/* widgets */
import WidgetNews from "@/components/widget-news";
import WidgetWeather from "@/components/widget-weather";
import CryptoWidget from "@/components/widget-crypto";
import WidgetSearch from "@/components/widget-search";
import StockWidget from "@/app/stocks/stock/LiveStreamTickerWidget";
import FlightSearch from "@/app/Country/FlightSearch";

/* icons */
import { Newspaper, Trophy, LineChart } from "lucide-react";

type TabKey = "All" | "Sports" | "Finance";

const TABS: { key: TabKey; label: string; Icon: any }[] = [
  { key: "All", label: "All News", Icon: Newspaper },
  { key: "Sports", label: "Sports", Icon: Trophy },
  { key: "Finance", label: "Finance", Icon: LineChart },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Optional: keep tab in the URL (?tab=finance) so refresh/back works.
 * Safe even if you don't care — it won't break anything.
 */
function normalizeTab(v: string | null): TabKey | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s === "all") return "All";
  if (s === "sports") return "Sports";
  if (s === "finance") return "Finance";
  return null;
}

export default function Page() {
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-5">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 shadow-sm">
        {/* soft blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Newspaper className="h-8 w-8 shrink-0 text-indigo-600 sm:h-9 sm:w-9" />
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                The&nbsp;Miller&nbsp;Gazette
              </h1>
              
            </div>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-gray-600 dark:text-white/70">
  A custom news feed built around a Node.js route that aggregates multiple RSS sources
  into a single, consistent seeam. It lets me normalize and filter headlines server-side,
  so the client stays fast and focused.
</p>

          </div>
        </div>
      </div>

      {/* Tabs card (no dropdown; CryptoDashboard-style tabs on all sizes) */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
        {/* tab bar */}
        <div
          className="flex items-center gap-2 p-2 sm:p-3 border-b border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar"
          role="tablist"
          aria-label="News sections"
        >
          {TABS.map((t) => {
            const isActive = t.key === tab;
            const Icon = t.Icon;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTab(t.key)}
                className={cn(
                      "relative shrink-0 whitespace-nowrap rounded-full px-3 sm:px-4 py-2 text-sm font-extrabold transition",
                  "ring-1 ring-black/10 dark:ring-white/10",
                  isActive
                    ? "bg-gray-900 text-white border-black/20 hover:bg-gray-900 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/10"
                    : "border border-black/10 bg-white text-gray-800 hover:bg-black/[0.03] dark:border-white/10 dark:bg-brand-900 dark:text-white/80 dark:hover:bg-white/[0.06]",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {t.label}
                </span>

                {isActive && (
                  <motion.span
                    layoutId="activeTabPill"
                    className="absolute inset-0 -z-10 rounded-2xl"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout: content + sidebar */}
      <div className="grid grid-cols-1 gap-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main */}
        <main className="min-w-0">
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4">
              {tab === "All" ? <NewsTab /> : tab === "Sports" ? <SportsTab /> : <FinanceTab />}
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-4">
          {/* On mobile, show "quick widgets" first in a 2-col grid so it's not a tall brick */}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4">
                <WidgetNews />
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4">
                <WidgetSearch />
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4">
                <WidgetWeather />
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4">
                <CryptoWidget />
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4">
                <FlightSearch full={null} />
              </div>
            </div>
          </div>

          {/* Heavy widgets: keep full width, and make them sticky only on desktop */}
          <div className="space-y-4 lg:sticky lg:top-4">
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4">
                <StockWidget />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="h-4" />
    </div>
  );
}
