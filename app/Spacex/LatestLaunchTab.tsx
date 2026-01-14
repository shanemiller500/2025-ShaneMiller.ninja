"use client";

import React, { useEffect, useState } from "react";
import { LaunchData } from "./types/spacexTypes";

function ChipLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-extrabold text-gray-800 hover:bg-black/[0.06]
                 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
    >
      {label}
    </a>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const LatestLaunchTab: React.FC = () => {
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.spacexdata.com/v4/launches/latest")
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then((data: LaunchData) => {
        setLaunch(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">Loading latest launch…</div>;
  if (error)
    return <div className="text-center text-sm font-bold text-red-500">Error: {error}</div>;
  if (!launch)
    return <div className="text-center text-sm font-bold text-gray-700 dark:text-white/70">No data available</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Latest Launch
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          {launch.name}
        </p>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              {launch.name}
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="font-semibold text-gray-700 dark:text-white/70">
                <span className="font-extrabold text-gray-900 dark:text-white">Flight #:</span>{" "}
                {launch.flight_number}
              </div>
              <div className="font-semibold text-gray-700 dark:text-white/70">
                <span className="font-extrabold text-gray-900 dark:text-white">Date:</span>{" "}
                {fmtDate(launch.date_utc)}
              </div>
            </div>
          </div>

          {launch.links?.patch?.small ? (
            <img
              src={launch.links.patch.small}
              alt="Mission Patch"
              className="h-24 w-24 shrink-0 rounded-2xl object-contain ring-1 ring-black/10 dark:ring-white/10"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </div>

        {launch.details ? (
          <p className="mt-4 text-sm font-semibold leading-relaxed text-gray-700 dark:text-white/70">
            {launch.details}
          </p>
        ) : null}

        {/* Links */}
        <div className="mt-4 flex flex-wrap gap-2">
          {launch.links?.article ? <ChipLink href={launch.links.article} label="Article" /> : null}
          {launch.links?.wikipedia ? <ChipLink href={launch.links.wikipedia} label="Wikipedia" /> : null}
          {launch.links?.presskit ? <ChipLink href={launch.links.presskit} label="Presskit" /> : null}
          {launch.links?.webcast ? <ChipLink href={launch.links.webcast} label="Webcast" /> : null}
        </div>

        {/* Flickr images */}
        {launch.links?.flickr?.original?.length ? (
          <div className="mt-5">
            <div className="text-xs font-extrabold text-gray-600 dark:text-white/60">
              Flickr
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {launch.links.flickr.original.slice(0, 12).map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Flickr ${idx}`}
                  className="h-20 w-20 rounded-2xl object-cover ring-1 ring-black/10 dark:ring-white/10"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Responsive embed */}
        {launch.links?.youtube_id ? (
          <div className="mt-5">
            <div className="text-xs font-extrabold text-gray-600 dark:text-white/60">
              YouTube
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
      </div>
    </div>
  );
};

export default LatestLaunchTab;
