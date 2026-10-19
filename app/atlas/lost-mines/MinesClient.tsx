"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre needs the browser
const MinesApp = dynamic(() => import("./MinesApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-stone-50 dark:bg-[#0c0a09]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-amber-700 dark:text-amber-200/70">Opening the old claims…</p>
    </div>
  ),
});

export default function MinesClient() {
  useEffect(() => {
    trackEvent("Lost Mines Viewed", { page: "Lost Mines" });
  }, []);
  return <MinesApp />;
}
