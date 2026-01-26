"use client";

import { useEffect } from "react";

import { trackEvent } from "@/utils/mixpanel";
import SpaceXDashboard from "./SpaceXDashboard";

/* ------------------------------------------------------------------ */
/*  SpacexPage Component                                               */
/* ------------------------------------------------------------------ */
export default function SpacexPage() {
  useEffect(() => {
    trackEvent("SpaceX API Page Viewed", { page: "SpaceX API Page" });
  }, []);

  return <SpaceXDashboard />;
}
