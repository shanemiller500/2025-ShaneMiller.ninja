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

export default function ChuckNorrisQuotes() {
  const [joke, setJoke] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchJoke = async () => {
    setLoading(true);
    trackEvent("Chuck Norris Quote Fetch Started");

    setTimeout(async () => {
      try {
        const res = await fetch("https://api.chucknorris.io/jokes/random");
        const data = await res.json();
        setJoke(data?.value || "No quote returned.");
        trackEvent("Chuck Norris Quote Fetch Success");
      } catch (err) {
        console.error(err);
        setJoke("Couldn’t reach the quote machine. Try again.");
        trackEvent("Chuck Norris Quote Fetch Error", { error: String(err) });
      } finally {
        setLoading(false);
      }
    }, 900);
  };

  useEffect(() => {
    fetchJoke();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Chuck Norris
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Press the button if you dare.
        </p>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <p className="text-sm font-semibold leading-relaxed text-gray-800 dark:text-white/80">
            <span className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-white/50">
              Quote
            </span>
            <span className="block mt-2 text-lg font-extrabold">
              “{joke}”
            </span>
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Btn onClick={fetchJoke}>New one</Btn>
        </div>
      </Card>
    </div>
  );
}
