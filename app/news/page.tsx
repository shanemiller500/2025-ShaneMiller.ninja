"use client";

import { type ReactNode, useLayoutEffect } from "react";
import { LineChart, Newspaper, Trophy } from "lucide-react";

import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import CryptoWidget from "@/app/Crypto/widget-crypto";
import WidgetNews from "@/app/news/widget-news";
import WidgetSearch from "@/components/widget-search";
import WidgetWeather from "@/components/widget-weather";
import FlightSearch from "@/app/Country/FlightSearch";
import FinanceTab from "./finance/FinanceTab";
import NewsTab from "./general/AllNewsTab";
import SportsTab from "./sports/SportsTab";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
type TabKey = "all" | "sports" | "finance";

const TABS: DashboardTab<TabKey>[] = [
  { key: "all",     label: "All News", hint: "Top stories",    icon: <Newspaper className="h-4 w-4" /> },
  { key: "sports",  label: "Sports",   hint: "Scores & news",  icon: <Trophy    className="h-4 w-4" /> },
  { key: "finance", label: "Finance",  hint: "Markets",        icon: <LineChart className="h-4 w-4" /> },
];

const PANELS: Record<TabKey, () => ReactNode> = {
  all:     () => <NewsTab />,
  sports:  () => <SportsTab />,
  finance: () => <FinanceTab />,
};

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */
function SidebarWidget({ label, live, children }: { label: string; live?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-white/[0.08]">
        {live ? (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        )}
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

const sidebar = (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
    <SidebarWidget label="Weather"><WidgetWeather /></SidebarWidget>
    <SidebarWidget label="Search"><WidgetSearch /></SidebarWidget>
    <SidebarWidget label="Headlines" live><WidgetNews /></SidebarWidget>
    <SidebarWidget label="Flights"><FlightSearch full={null} /></SidebarWidget>
    <SidebarWidget label="Crypto" live><CryptoWidget /></SidebarWidget>
  </div>
);

/* ------------------------------------------------------------------ */
/*  NewsPage                                                           */
/* ------------------------------------------------------------------ */
export default function NewsPage() {
  // Old links use ?tab=sports; turn them into the shell's #sports before it reads the hash.
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    const tab = url.searchParams.get("tab")?.toLowerCase();
    if (!tab || !TABS.some((t) => t.key === tab)) return;
    url.searchParams.delete("tab");
    url.hash = tab === "all" ? "" : tab;
    window.history.replaceState(null, "", url.toString());
  }, []);

  return (
    <DashboardShell
      id="news"
      path="~/news"
      liveLabel="live feed"
      title="The Miller Gazette"
      description="Headlines from dozens of RSS sources, de-duplicated and grouped by story, with live scores and markets news. Open any story to read it right here."
      tabs={TABS}
      renderPanel={(key) => PANELS[key]()}
      aside={sidebar}
    />
  );
}
