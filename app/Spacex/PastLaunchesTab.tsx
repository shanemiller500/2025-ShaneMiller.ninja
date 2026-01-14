"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LaunchData } from "./types/spacexTypes";
import LoadMoreButton from "./LoadMoreButton";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900">
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <span className="font-extrabold text-gray-900 dark:text-white">{label}:</span>
      <span className="font-semibold text-gray-700 dark:text-white/70">{value}</span>
    </div>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const PastLaunchesTab: React.FC = () => {
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.spacexdata.com/v5/launches/past")
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then((data: LaunchData[]) => {
        // newest first
        const sorted = [...data].sort(
          (a, b) => +new Date(b.date_utc) - +new Date(a.date_utc)
        );
        setLaunches(sorted);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const visibleLaunches = useMemo(
    () => launches.slice(0, visibleCount),
    [launches, visibleCount]
  );

  if (loading)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">Loading past launches…</div>;
  if (error)
    return <div className="text-center text-sm font-bold text-red-500">Error: {error}</div>;
  if (!launches.length)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">No past launches available</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Past Launches
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Showing {Math.min(visibleCount, launches.length)} of {launches.length}
        </p>
      </div>

      <div className="grid gap-4">
        {visibleLaunches.map((launch) => (
          <Card key={launch.id ?? launch.flight_number}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white sm:text-lg">
                  {launch.name}
                </h3>
                <div className="mt-2 space-y-1">
                  <Field label="Flight #" value={launch.flight_number} />
                  <Field label="Date" value={fmtDate(launch.date_utc)} />
                </div>
              </div>

              {launch.links?.patch?.small ? (
                <img
                  src={launch.links.patch.small}
                  alt="Mission Patch"
                  className="h-20 w-20 shrink-0 rounded-2xl object-contain ring-1 ring-black/10 dark:ring-white/10"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>

            {launch.details ? (
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-700 dark:text-white/70">
                {launch.details}
              </p>
            ) : null}

            {/* Flickr thumbnails */}
            {launch.links?.flickr?.small?.length ? (
              <div className="mt-4">
                <div className="text-xs font-extrabold text-gray-600 dark:text-white/60">
                  Images
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {launch.links.flickr.small.slice(0, 12).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Flickr ${idx}`}
                      className="h-16 w-16 rounded-2xl object-cover ring-1 ring-black/10 dark:ring-white/10"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Responsive YouTube embed */}
            {launch.links?.youtube_id ? (
              <div className="mt-4">
                <div className="text-xs font-extrabold text-gray-600 dark:text-white/60">
                  Webcast
                </div>
                <div className="mt-2 overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/10">
                  <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${launch.links.youtube_id}`}
                      title="Webcast"
                      className="absolute inset-0 h-full w-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <LoadMoreButton
        visibleCount={visibleCount}
        totalCount={launches.length}
        onLoadMore={() => setVisibleCount((c) => c + 7)}
      />
    </div>
  );
};

export default PastLaunchesTab;
