"use client";

import React, { useEffect, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

const Card = ({ children }) => (
  <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
    {children}
  </div>
);

const Btn = ({ children, ...props }) => (
  <button
    {...props}
    className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-2 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06]
               focus:outline-none focus:ring-2 focus:ring-indigo-500
               dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
  >
    {children}
  </button>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-10">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black/60 dark:border-white/20 dark:border-t-white/70" />
  </div>
);

export default function RandomAdvice() {
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAdvice = async () => {
    setLoading(true);
    trackEvent("Random Advice Fetch Started");

    try {
      const res = await fetch("https://api.adviceslip.com/advice", {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Network response was not ok");

      const data = await res.json();
      setAdvice(data?.slip?.advice || "No advice returned.");
      trackEvent("Random Advice Fetch Success");
    } catch (err) {
      console.error(err);
      setAdvice("Couldn’t fetch advice. Try again.");
      trackEvent("Random Advice Fetch Error", { error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAdvice = () => {
    setLoading(true);
    trackEvent("Random Advice Refresh Clicked");
    setTimeout(() => fetchAdvice(), 900);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Random Advice
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Sometimes it lands. Sometimes it roasts you.
        </p>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-white/50">
              Today’s Wisdom
            </div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              “{advice}”
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Btn onClick={refreshAdvice}>Hit me again</Btn>
        </div>
      </Card>
    </div>
  );
}
