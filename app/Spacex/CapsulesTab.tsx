"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Capsule } from "./types/spacexTypes";
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

const CapsulesTab: React.FC = () => {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.spacexdata.com/v4/capsules")
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then((data: Capsule[]) => {
        setCapsules(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const visibleCapsules = useMemo(
    () => capsules.slice(0, visibleCount),
    [capsules, visibleCount]
  );

  if (loading)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">Loading capsules…</div>;
  if (error)
    return <div className="text-center text-sm font-bold text-red-500">Error: {error}</div>;
  if (!capsules.length)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">No capsules available</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
        Capsules
      </h2>

      <div className="grid gap-4">
        {visibleCapsules.map((capsule) => (
          <Card key={capsule.id}>
            <div className="space-y-1 text-sm font-semibold text-gray-700 dark:text-white/70">
              <div>
                <span className="font-extrabold text-gray-900 dark:text-white">Serial:</span>{" "}
                {capsule.serial ?? "—"}
              </div>
              <div>
                <span className="font-extrabold text-gray-900 dark:text-white">Status:</span>{" "}
                {capsule.status ?? "—"}
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-extrabold text-gray-800 dark:text-white/80">
                Details
              </summary>
              <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10">
                {safeJson(
                  Object.fromEntries(
                    Object.entries(capsule).filter(
                      ([k]) => !["id", "serial", "status"].includes(k)
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
        totalCount={capsules.length}
        onLoadMore={() => setVisibleCount((c) => c + 7)}
      />
    </div>
  );
};

export default CapsulesTab;
