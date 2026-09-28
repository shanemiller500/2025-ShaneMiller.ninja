"use client";

import { useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";
import CharlesPlayground from "./CharlesPlayground";

/* ------------------------------------------------------------------ */
/*  CharlesPage: a full-screen, no-scroll playground                   */
/* ------------------------------------------------------------------ */
export default function CharlesPage() {
  useEffect(() => {
    trackEvent("Charles Page Viewed", { page: "Charles" });
  }, []);

  return <CharlesPlayground />;
}
