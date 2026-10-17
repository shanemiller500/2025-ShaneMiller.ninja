"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre needs the browser (WebGL + window)
const EarthAliveApp = dynamic(() => import("./EarthAliveApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#02040b]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-200/70">Listening to the planet…</p>
    </div>
  ),
});

export default function EarthAliveClient() {
  useEffect(() => {
    trackEvent("Earth Alive Viewed", { page: "Earth Alive" });
  }, []);
  return <EarthAliveApp />;
}
