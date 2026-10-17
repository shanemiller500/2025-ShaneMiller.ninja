"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { trackEvent } from "@/utils/mixpanel";

// MapLibre needs the browser
const ShipwrecksApp = dynamic(() => import("./ShipwrecksApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#010610]">
      <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-sky-700 dark:text-sky-200/70">Sounding the depths…</p>
    </div>
  ),
});

export default function ShipwrecksClient() {
  useEffect(() => {
    trackEvent("Shipwrecks Viewed", { page: "Shipwrecks" });
  }, []);
  return <ShipwrecksApp />;
}
