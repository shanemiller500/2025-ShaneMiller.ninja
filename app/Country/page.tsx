"use client";

import { useEffect } from "react";

import CountrySearch from "./CountrySearch";
import { trackEvent } from "@/utils/mixpanel";

const CountrySearchPage: React.FC = () => {
  useEffect(() => {
    trackEvent("Country Page Viewed", { page: "Country" });
  }, []);

  return (
    <main className="min-h-screen">
      <CountrySearch />
    </main>
  );
};

export default CountrySearchPage;
