"use client";

import { useEffect, useState, useCallback } from "react";
import { trackEvent } from "@/utils/mixpanel";

const FETCH_DELAY_MS = 900;

export default function RandomAdvice() {
  const [advice, setAdvice] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchAdvice = useCallback(async () => {
    setIsLoading(true);
    trackEvent("Random Advice Fetch Started");

    try {
      const response = await fetch("https://api.adviceslip.com/advice", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      setAdvice(data?.slip?.advice || "No advice returned.");
      trackEvent("Random Advice Fetch Success");
    } catch (error) {
      console.error(error);
      setAdvice("Couldn't fetch advice. Try again.");
      trackEvent("Random Advice Fetch Error", { error: String(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdvice();
  }, [fetchAdvice]);

  function handleRefresh() {
    setIsLoading(true);
    trackEvent("Random Advice Refresh Clicked");
    setTimeout(() => fetchAdvice(), FETCH_DELAY_MS);
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Random Advice
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Sometimes it lands. Sometimes it roasts you.
        </p>
      </header>

      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-white/50">
              Today's Wisdom
            </div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              "{advice}"
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <ActionButton onClick={handleRefresh}>Hit me again</ActionButton>
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-2 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
    >
      {children}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black/60 dark:border-white/20 dark:border-t-white/70" />
    </div>
  );
}
