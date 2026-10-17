"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre needs the browser
const DisasterApp = dynamic(() => import("./DisasterApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#0a0403]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-orange-700 dark:text-orange-200/70">Pulling live hazard feeds…</p>
    </div>
  ),
});

export default function DisasterClient() {
  useEffect(() => {
    trackEvent("Disaster Atlas Viewed", { page: "Disaster Atlas" });
  }, []);
  return <DisasterApp />;
}
