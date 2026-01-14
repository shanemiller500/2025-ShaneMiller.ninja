"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Payload } from "./types/spacexTypes";
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

const PayloadsTab: React.FC = () => {
  const [payloads, setPayloads] = useState<Payload[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.spacexdata.com/v4/payloads")
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then((data: Payload[]) => {
        setPayloads(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const visiblePayloads = useMemo(
    () => payloads.slice(0, visibleCount),
    [payloads, visibleCount]
  );

  if (loading)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">Loading payloads…</div>;
  if (error)
    return <div className="text-center text-sm font-bold text-red-500">Error: {error}</div>;
  if (!payloads.length)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">No payloads available</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
        Payloads
      </h2>

      <div className="grid gap-4">
        {visiblePayloads.map((p) => (
          <Card key={p.id}>
            <div className="space-y-1 text-sm font-semibold text-gray-700 dark:text-white/70">
              <div>
                <span className="font-extrabold text-gray-900 dark:text-white">Name:</span>{" "}
                {p.name ?? "—"}
              </div>
              <div>
                <span className="font-extrabold text-gray-900 dark:text-white">Type:</span>{" "}
                {p.type ?? "—"}
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-extrabold text-gray-800 dark:text-white/80">
                Details
              </summary>
              <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10">
                {safeJson(
                  Object.fromEntries(
                    Object.entries(p).filter(
                      ([k]) => !["id", "name", "type"].includes(k)
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
        totalCount={payloads.length}
        onLoadMore={() => setVisibleCount((c) => c + 7)}
      />
    </div>
  );
};

export default PayloadsTab;
