"use client";

import React, { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

const API_KEY =
  process.env.NEXT_PUBLIC_NASA_API_KEY ||
  process.env.NEXT_PUBLIC_ISS_KEY || // fallback if you used the wrong env var previously
  "";

type RoverPhoto = {
  id: number;
  img_src: string;
  earth_date: string;
  camera: { full_name: string; name: string };
  rover?: { name?: string };
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
      {children}
    </div>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

/** Custom carousel per camera group with modal/lightbox */
function PhotoCarousel({
  cameraName,
  photos,
}: {
  cameraName: string;
  photos: RoverPhoto[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // keep index valid if photos change
  useEffect(() => {
    setCurrentIndex(0);
    setModalOpen(false);
  }, [cameraName]);

  const next = () => {
    const nextIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(nextIndex);
    trackEvent("Camera Slide Next Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: nextIndex,
      photoId: photos[nextIndex]?.id,
    });
  };

  const prev = () => {
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setCurrentIndex(prevIndex);
    trackEvent("Camera Slide Prev Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: prevIndex,
      photoId: photos[prevIndex]?.id,
    });
  };

  const openModal = () => {
    setModalOpen(true);
    trackEvent("Camera Modal Opened", {
      cameraName,
      currentIndex,
      photoId: photos[currentIndex]?.id,
    });
  };

  const closeModal = () => {
    setModalOpen(false);
    trackEvent("Camera Modal Closed", {
      cameraName,
      currentIndex,
      photoId: photos[currentIndex]?.id,
    });
  };

  const modalNext = () => {
    const nextIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(nextIndex);
    trackEvent("Camera Modal Next Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: nextIndex,
      photoId: photos[nextIndex]?.id,
    });
  };

  const modalPrev = () => {
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setCurrentIndex(prevIndex);
    trackEvent("Camera Modal Prev Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: prevIndex,
      photoId: photos[prevIndex]?.id,
    });
  };

  const current = photos[currentIndex];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white sm:text-xl">
            {cameraName}
          </h3>
          <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
            {currentIndex + 1} / {photos.length}
          </p>
        </div>

        <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-extrabold text-gray-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80">
          {fmtDate(current.earth_date)}
        </div>
      </div>

      <div className="mt-4">
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10">
          <img
            src={current.img_src}
            alt={`Mars Rover - ${cameraName}`}
            onClick={openModal}
            className="h-64 w-full cursor-pointer object-cover sm:h-80"
            referrerPolicy="no-referrer"
          />

          {photos.length > 1 ? (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-sm font-extrabold text-white hover:bg-black/80"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-sm font-extrabold text-white hover:bg-black/80"
                aria-label="Next"
              >
                ›
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-3 text-sm font-semibold text-gray-700 dark:text-white/70">
          <span className="font-extrabold text-gray-900 dark:text-white">
            Photo ID:
          </span>{" "}
          {current.id}
        </div>
      </div>

      {/* Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-5xl">
            <div className="overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-white">
                    {cameraName}
                  </div>
                  <div className="text-xs font-semibold text-white/70">
                    {fmtDate(current.earth_date)} • {currentIndex + 1}/{photos.length}
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-extrabold text-white hover:bg-white/15"
                >
                  Close
                </button>
              </div>

              <div className="relative">
                <img
                  src={current.img_src}
                  alt={`Mars Rover - ${cameraName}`}
                  className="max-h-[75vh] w-full object-contain"
                  referrerPolicy="no-referrer"
                />

                {photos.length > 1 ? (
                  <>
                    <button
                      onClick={modalPrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-lg font-extrabold text-white hover:bg-white/15"
                      aria-label="Previous"
                    >
                      ‹
                    </button>
                    <button
                      onClick={modalNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-lg font-extrabold text-white hover:bg-white/15"
                      aria-label="Next"
                    >
                      ›
                    </button>
                  </>
                ) : null}
              </div>

              <div className="px-4 py-4 text-center">
                <div className="text-sm font-extrabold text-white">
                  {current.rover?.name ?? "Curiosity"} • {current.camera?.name}
                </div>
                <div className="mt-1 text-xs font-semibold text-white/70">
                  Earth date: {current.earth_date} • Photo ID: {current.id}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default function MarsRoverPhotos() {
  const [solDay, setSolDay] = useState("");
  const [photos, setPhotos] = useState<RoverPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Curiosity landing reference
  const landingDate = new Date("2012-08-06T00:00:00Z");
  const now = new Date();
  const msDifference = now.getTime() - landingDate.getTime();
  const solDurationMs = (24 * 3600 + 39 * 60 + 35) * 1000;
  const currentSol = Math.floor(msDifference / solDurationMs) + 1;
  const currentEarthDay = now.toLocaleDateString();

  useEffect(() => {
    trackEvent("Mars Rover Photos Page Viewed", { page: "Mars Rover Photos" });
  }, []);

  const searchPhotos = async () => {
    setError(null);

    if (!API_KEY) {
      setError("Missing NASA API key (NEXT_PUBLIC_NASA_API_KEY).");
      trackEvent("Mars Rover Photos Search Failed", { reason: "Missing API key" });
      return;
    }

    if (!solDay || Number.isNaN(Number(solDay))) {
      setError("Enter a valid sol day (numbers only).");
      trackEvent("Mars Rover Photos Search Failed", { reason: "Invalid input", solDay });
      return;
    }

    trackEvent("Mars Rover Photos Search Initiated", { solDay });

    setLoading(true);
    setPhotos([]);

    const apiUrl = `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?sol=${solDay}&api_key=${API_KEY}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      const fetchedPhotos: RoverPhoto[] = data?.photos ?? [];

      if (!fetchedPhotos.length) {
        setError("No photos found for that sol.");
        trackEvent("Mars Rover Photos Search No Results", { solDay });
      } else {
        setPhotos(fetchedPhotos);
        trackEvent("Mars Rover Photos Search Success", {
          solDay,
          photoCount: fetchedPhotos.length,
        });
      }
    } catch (err: any) {
      console.error("Error fetching Mars photos:", err);
      setError("Failed to fetch photos from NASA.");
      trackEvent("Mars Rover Photos Search Error", { solDay, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const groupedPhotos = useMemo(() => {
    const groups: Record<string, RoverPhoto[]> = {};
    for (const p of photos) {
      const cameraName = p?.camera?.full_name || "Unknown Camera";
      if (!groups[cameraName]) groups[cameraName] = [];
      groups[cameraName].push(p);
    }
    return groups;
  }, [photos]);

  const cameraNames = useMemo(
    () => Object.keys(groupedPhotos).sort(),
    [groupedPhotos]
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Mars Rover Photos
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Earth day: <span className="font-extrabold">{currentEarthDay}</span> •
          Sol (approx): <span className="font-extrabold">{currentSol}</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-white/40">
          Curiosity Sol 1: Aug 6, 2012
        </p>
      </div>

      {/* Search */}
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full">
            <label className="text-xs font-extrabold text-gray-700 dark:text-white/70">
              Sol day
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder={`Try ${currentSol}`}
              value={solDay}
              onChange={(e) => setSolDay(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-gray-800 shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         dark:border-white/10 dark:bg-brand-900 dark:text-white/90"
            />
          </div>

          <button
            onClick={searchPhotos}
            className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-2 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06]
                       dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
          >
            Search
          </button>
        </div>

        {error ? (
          <div className="mt-3 text-sm font-bold text-red-500">{error}</div>
        ) : null}
        {loading ? (
          <div className="mt-3 text-sm font-bold text-gray-700 dark:text-white/70">
            Loading…
          </div>
        ) : null}
      </Card>

      {/* Results */}
      {!loading && photos.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-gray-600 dark:text-white/60">
            Found <span className="font-extrabold">{photos.length}</span> photos across{" "}
            <span className="font-extrabold">{cameraNames.length}</span> cameras
          </div>

          <div className="grid gap-4">
            {cameraNames.map((cameraName) => (
              <PhotoCarousel
                key={cameraName}
                cameraName={cameraName}
                photos={groupedPhotos[cameraName]}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
