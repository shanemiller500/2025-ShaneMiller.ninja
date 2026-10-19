"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";

const LandApp = dynamic(() => import("./LandApp"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 grid place-items-center bg-slate-950 font-mono text-xs uppercase tracking-[0.25em] text-cyan-200">Opening the map…</div>,
});

export default function LandClient() {
  useEffect(() => { trackEvent("Land Intelligence Viewed", { page: "Land Intelligence" }); }, []);
  return <LandApp />;
}
