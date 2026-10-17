"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre needs the browser
const FossilApp = dynamic(() => import("./FossilApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-stone-50 dark:bg-[#0b0f0a]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-lime-700 dark:text-lime-200/70">Digging through the rock record…</p>
    </div>
  ),
});

export default function FossilClient() {
  useEffect(() => {
    trackEvent("Prehistoric USA Viewed", { page: "Prehistoric USA" });
  }, []);
  return <FossilApp />;
}
