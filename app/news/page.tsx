// Filename: page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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

  const activeMeta = useMemo(
    () => TABS.find((t) => t.key === tab) ?? TABS[0],
    [tab]
  );

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
            
          </div>

          {/* Mobile: dropdown (NOT clipped / squished) */}
          <div className="sm:hidden">
            <label htmlFor="tab-select" className="sr-only">
              Choose section
            </label>

            <select
              id="tab-select"
              value={tab}
              onChange={(e) => handleTab(e.target.value as TabKey)}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-4 py-3 text-sm font-extrabold text-gray-900 dark:text-white outline-none focus:border-black/20 dark:focus:border-white/20"
            >
              {TABS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop: pill tabs */}
        <div className="relative mt-4 hidden sm:block">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="News sections">
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
                    "relative shrink-0 rounded-2xl px-4 py-2 text-sm font-extrabold transition",
                    "ring-1 ring-black/10 dark:ring-white/10",
                    isActive
                      ? "text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-sm"
                      : "text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Layout: content + sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            
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
