"use client";

import { useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";
import FightWorldApp from "./ui/FightWorldApp";

/* ------------------------------------------------------------------ */
/*  Fight World: full-screen fan-made arcade brawler                    */
/* ------------------------------------------------------------------ */
export default function MarvelFightWorldPage() {
  useEffect(() => {
    trackEvent("Fight World Page Viewed", { page: "marvel-fight-world" });
  }, []);

  return <FightWorldApp />;
}
