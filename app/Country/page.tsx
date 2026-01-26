"use client";

import { useEffect } from "react";

import CountrySearch from "./CountrySearch";
import { trackEvent } from "@/utils/mixpanel";

const CountrySearchPage: React.FC = () => {
  useEffect(() => {
    trackEvent("Country Page Viewed", { page: "Country" });
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 dark:from-brand-900 dark:via-brand-900 dark:to-brand-900">
      <CountrySearch />
    </main>
  );
};

export default CountrySearchPage;
