"use client";

import { useEffect, useState } from "react";
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
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */
type TabKey = "All" | "Sports" | "Finance";

interface TabConfig {
  key: TabKey;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabConfig[] = [
  { key: "All", label: "All News", Icon: Newspaper },
  { key: "Sports", label: "Sports", Icon: Trophy },
  { key: "Finance", label: "Finance", Icon: LineChart },
];

const TAB_ACTIVE: Record<TabKey, string> = {
  All: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  Sports: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  Finance: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function normalizeTab(v: string | null): TabKey | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s === "all") return "All";
  if (s === "sports") return "Sports";
  if (s === "finance") return "Finance";
  return null;
}

/* ------------------------------------------------------------------ */
/*  SidebarWidget                                                      */
/* ------------------------------------------------------------------ */
function SidebarWidget({
  label,
  dot,
  children,
}: {
  label: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 bg-white dark:border-white/10 dark:bg-white/[0.06] rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        {dot && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
        )}
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NewsPage                                                           */
/* ------------------------------------------------------------------ */
export default function NewsPage() {
  const [tab, setTab] = useState<TabKey>("All");

  /* Hydrate from URL once on mount */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = normalizeTab(
      new URL(window.location.href).searchParams.get("tab")
    );
    if (fromUrl) setTab(fromUrl);
  }, []);

  const handleTab = (value: TabKey) => {
    setTab(value);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value.toLowerCase());
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-brand-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm px-5 sm:px-8 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
              <span className="text-[10px] uppercase tracking-widest font-medium text-gray-400 dark:text-gray-500">
                Live Feed
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-brand-900 dark:text-gray-50 tracking-tight">
              The Miller Gazette
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-lg leading-relaxed">
              Aggregated headlines from multiple RSS sources, normalized server-side
              for a fast, focused reading experience.
            </p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-shrink-0">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div
        className="bg-white dark:bg-brand-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-1 flex gap-1"
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
              className={[
                "relative flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 rounded-lg text-[11px] sm:text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                isActive
                  ? TAB_ACTIVE[t.key]
                  : "text-gray-500 dark:text-gray-400 hover:text-brand-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>{t.label}</span>
              {isActive && (
                <motion.span
                  layoutId="activeTabBg"
                  className="absolute inset-0 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main content + sidebar ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">

        {/* Main */}
        <main className="min-w-0 bg-white dark:border-white/10 dark:bg-white/[0.06] rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-5">
            {tab === "All" ? (
              <NewsTab />
            ) : tab === "Sports" ? (
              <SportsTab />
            ) : (
              <FinanceTab />
            )}
          </div>
        </main>

        {/* Sidebar */}
        <aside className="min-w-0">
          <div className="grid grid-cols-1 gap-3 sm:gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <SidebarWidget label="Weather">
              <WidgetWeather />
            </SidebarWidget>
             <SidebarWidget label="Search">
              <WidgetSearch />
            </SidebarWidget>
            <SidebarWidget label="Headlines" dot>
              <WidgetNews />
            </SidebarWidget>
            <SidebarWidget label="Flights">
              <FlightSearch full={null} />
            </SidebarWidget>
            <SidebarWidget label="Crypto">
              <CryptoWidget />
            </SidebarWidget>
          </div>
        </aside>
      </div>

      <div className="h-4" />
    </div>
  );
}
