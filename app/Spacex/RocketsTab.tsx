"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Rocket } from "./types/spacexTypes";
import LoadMoreButton from "./LoadMoreButton";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900">
      {children}
    </div>
  );
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const RocketsTab: React.FC = () => {
  const [rockets, setRockets] = useState<Rocket[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.spacexdata.com/v4/rockets")
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then((data: Rocket[]) => {
        setRockets(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const visibleRockets = useMemo(
    () => rockets.slice(0, visibleCount),
    [rockets, visibleCount]
  );

  if (loading)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">Loading rockets…</div>;
  if (error)
    return <div className="text-center text-sm font-bold text-red-500">Error: {error}</div>;
  if (!rockets.length)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">No rockets available</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Rockets
        </h2>
      </div>

      <div className="grid gap-4">
        {visibleRockets.map((rocket) => (
          <Card key={rocket.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white sm:text-lg">
                  {rocket.name}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700 dark:text-white/70">
                  {rocket.description}
                </p>
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-extrabold text-gray-800 dark:text-white/80">
                Details
              </summary>
              <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10">
                {safeJson(
                  Object.fromEntries(
                    Object.entries(rocket).filter(
                      ([k]) => !["id", "name", "description"].includes(k)
                    )
                  )
                )}
              </pre>
            </details>
          </Card>
        ))}
      </div>

      <LoadMoreButton
        visibleCount={visibleCount}
        totalCount={rockets.length}
        onLoadMore={() => setVisibleCount((c) => c + 7)}
      />
    </div>
  );
};

export default RocketsTab;
