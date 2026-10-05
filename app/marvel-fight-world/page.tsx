"use client";

import { useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";
import FightWorld from "./ui/FightWorld";

/* ------------------------------------------------------------------ */
/*  Fight World: a full-screen arcade fighter built on the free         */
/*  Superhero API character dataset (fan-made, unofficial).             */
/* ------------------------------------------------------------------ */
export default function MarvelFightWorldPage() {
  useEffect(() => {
    trackEvent("Fight World Page Viewed", { page: "marvel-fight-world" });
  }, []);

  return <FightWorld />;
}
