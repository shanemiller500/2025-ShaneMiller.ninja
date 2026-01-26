"use client";

import { useEffect, useState, useCallback } from "react";
import { trackEvent } from "@/utils/mixpanel";

interface ActivityData {
  activity: string;
  type: string;
  participants: number;
  link?: string;
}

const FETCH_DELAY_MS = 900;

export default function RandomActivity() {
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const fetchActivity = useCallback(async () => {
    try {
      const response = await fetch("https://www.boredapi.com/api/activity");
      const data = await response.json();
      setActivityData(data);
      trackEvent("Random Activity Fetch Success", { type: data?.type });
    } catch (error) {
      console.error(error);
      setActivityData(null);
      trackEvent("Random Activity Fetch Error", { error: String(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleRefresh() {
    setClickCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 3 || newCount === 6) {
        trackEvent("Random Activity Click Milestone", { count: newCount });
      }
      return newCount;
    });

    setIsLoading(true);
    trackEvent("Random Activity Refresh Clicked", { clickCount: clickCount + 1 });
    setTimeout(() => fetchActivity(), FETCH_DELAY_MS);
  }

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const hasLink = activityData?.link && activityData.link.trim() !== "";

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Random Activity
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          When your brain says "nah", this says "bet".
        </p>
      </header>

      <Card>
        {isLoading ? (
          <LoadingSpinner />
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
              <InfoCard label="Type" value={activityData.type} />
              <InfoCard label="Participants" value={String(activityData.participants)} />
            </div>

            {hasLink && (
              <a
                href={activityData.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-indigo-600 hover:underline dark:text-indigo-300"
              >
                Open link →
              </a>
            )}
          </div>
        ) : (
          <div className="text-sm font-bold text-gray-700 dark:text-white/70">
            No activity available.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <ActionButton onClick={handleRefresh}>Another one</ActionButton>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.06]">
      <div className="text-xs font-extrabold text-gray-500 dark:text-white/50">
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
        {value}
      </div>
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
