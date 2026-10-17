"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre needs the browser
const HiddenApp = dynamic(() => import("./HiddenApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#020604]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-lime-700 dark:text-lime-200/70">Stripping away the trees…</p>
    </div>
  ),
});

export default function HiddenClient() {
  useEffect(() => {
    trackEvent("Hidden Earth Viewed", { page: "Hidden Earth" });
  }, []);
  return <HiddenApp />;
}
