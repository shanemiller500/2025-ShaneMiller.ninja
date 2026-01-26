"use client";

import { useEffect, useState, useCallback } from "react";
import { trackEvent } from "@/utils/mixpanel";

const FETCH_DELAY_MS = 900;

export default function ChuckNorrisQuotes() {
  const [joke, setJoke] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchJoke = useCallback(async () => {
    setIsLoading(true);
    trackEvent("Chuck Norris Quote Fetch Started");

    setTimeout(async () => {
      try {
        const response = await fetch("https://api.chucknorris.io/jokes/random");
        const data = await response.json();
        setJoke(data?.value || "No quote returned.");
        trackEvent("Chuck Norris Quote Fetch Success");
      } catch (error) {
        console.error(error);
        setJoke("Couldn't reach the quote machine. Try again.");
        trackEvent("Chuck Norris Quote Fetch Error", { error: String(error) });
      } finally {
        setIsLoading(false);
      }
    }, FETCH_DELAY_MS);
  }, []);

  useEffect(() => {
    fetchJoke();
  }, [fetchJoke]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Chuck Norris
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Press the button if you dare.
        </p>
      </header>

      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <p className="text-sm font-semibold leading-relaxed text-gray-800 dark:text-white/80">
            <span className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-white/50">
              Quote
            </span>
            <span className="block mt-2 text-lg font-extrabold">"{joke}"</span>
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <ActionButton onClick={fetchJoke}>New one</ActionButton>
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
