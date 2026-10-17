"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre + three.js need the browser
const UndergroundApp = dynamic(() => import("./UndergroundApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#02040b]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-200/70">Scanning beneath the surface…</p>
    </div>
  ),
});

export default function UndergroundClient() {
  useEffect(() => {
    trackEvent("Underground USA Viewed", { page: "Underground USA" });
  }, []);
  return <UndergroundApp />;
}
