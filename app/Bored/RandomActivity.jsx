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

export default function RandomActivity() {
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const getActivity = async () => {
    try {
      const res = await fetch("https://www.boredapi.com/api/activity");
      const data = await res.json();
      setActivityData(data);
      trackEvent("Random Activity Fetch Success", { type: data?.type });
    } catch (err) {
      console.error(err);
      setActivityData(null);
      trackEvent("Random Activity Fetch Error", { error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const refreshActivity = () => {
    setClickCount((prev) => {
      const n = prev + 1;

      // keep your fun messages but less “alert spam”
      if (n === 3) trackEvent("Random Activity Click Milestone", { count: n });
      if (n === 6) trackEvent("Random Activity Click Milestone", { count: n });

      return n;
    });

    setLoading(true);
    trackEvent("Random Activity Refresh Clicked", { clickCount: clickCount + 1 });

    setTimeout(() => {
      getActivity();
    }, 900);
  };

  useEffect(() => {
    getActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasLink = activityData?.link && String(activityData.link).trim() !== "";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Random Activity
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          When your brain says “nah”, this says “bet”.
        </p>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : activityData ? (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-white/50">
                Activity
              </div>
              <div className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white">
                {activityData.activity}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.06]">
                <div className="text-xs font-extrabold text-gray-500 dark:text-white/50">
                  Type
                </div>
                <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                  {activityData.type}
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.06]">
                <div className="text-xs font-extrabold text-gray-500 dark:text-white/50">
                  Participants
                </div>
                <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                  {activityData.participants}
                </div>
              </div>
            </div>

            {hasLink ? (
              <a
                href={activityData.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-indigo-600 hover:underline dark:text-indigo-300"
              >
                Open link →
              </a>
            ) : null}
          </div>
        ) : (
          <div className="text-sm font-bold text-gray-700 dark:text-white/70">
            No activity available.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Btn onClick={refreshActivity}>Another one</Btn>
        </div>
      </Card>
    </div>
  );
}
