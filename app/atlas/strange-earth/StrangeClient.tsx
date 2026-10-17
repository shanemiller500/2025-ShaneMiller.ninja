"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre needs the browser
const StrangeApp = dynamic(() => import("./StrangeApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#03020a]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-fuchsia-700 dark:text-fuchsia-200/70">Searching for anomalies…</p>
    </div>
  ),
});

export default function StrangeClient() {
  useEffect(() => {
    trackEvent("Strange Earth Viewed", { page: "Strange Earth" });
  }, []);
  return <StrangeApp />;
}
