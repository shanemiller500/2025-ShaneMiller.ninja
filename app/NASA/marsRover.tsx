"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

type RoverPhoto = {
  id: number;
  img_src: string;
  earth_date: string;
  camera: { full_name: string; name: string };
  rover?: { name?: string };
};

type MarsRssImage = {
  imageid?: string;
  id?: string | number;
  sol?: number;
  title?: string;
  instrument?: string;
  camera?: { instrument?: string };
  image_files?: {
    large?: string;
    medium?: string;
    small?: string;
    full_res?: string;
  };
  date_taken_utc?: string;
  date_received?: string;
};

/* ---------- UI helpers ---------- */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-black/10 bg-white p-4 shadow-sm",
        "dark:border-white/10 dark:bg-brand-900 sm:p-5",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1",
        "border border-black/10 bg-black/[0.03] text-xs font-extrabold text-gray-800",
        "dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  return { res, json: res.ok ? await res.json() : null };
}

/** Backup-only source: Curiosity raw-images feed (mars.nasa.gov) */
async function fetchFromMarsRss(sol: string, signal?: AbortSignal): Promise<RoverPhoto[]> {
  const url =
    `https://mars.nasa.gov/rss/api/?` +
    `feed=raw_images` +
    `&category=msl` + // Curiosity (MSL)
    `&feedtype=json` +
    `&ver=1.2` +
    `&sol=${encodeURIComponent(sol)}` +
    `&num=120` +
    `&page=0` +
    `&order=sol+desc`;

  const { res, json } = await fetchJson(url, signal);

  if (!res.ok) {
    const err = new Error(`MARS_RSS_${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  const images: MarsRssImage[] = json?.images ?? [];

  return images
    .map((img, idx): RoverPhoto | null => {
      const src =
        img.image_files?.large ||
        img.image_files?.medium ||
        img.image_files?.full_res ||
        img.image_files?.small;

      if (!src) return null;

      const earthDate = img.date_taken_utc || img.date_received || "";
      const cam = img.camera?.instrument || img.instrument || "Unknown";

      return {
        id: Number(img.id ?? idx) || idx,
        img_src: src,
        earth_date: earthDate ? earthDate.slice(0, 10) : "Unknown",
        camera: { full_name: cam, name: cam },
        rover: { name: "Curiosity" },
      };
    })
    .filter(Boolean) as RoverPhoto[];
}

/* ---------- Modal (scroll-safe, mobile-safe) ---------- */
function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [locked]);
}

function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 overflow-y-auto"
      style={{
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-[100svh] w-full flex items-center justify-center px-3 py-3 sm:p-6">
        <div
          className={[
            "relative w-full max-w-6xl",
            "bg-white dark:bg-brand-900",
            "border border-black/10 dark:border-white/10",
            "shadow-2xl overflow-hidden",
            "rounded-3xl",
            "flex flex-col",
            "max-h-[calc(100svh-24px)] sm:max-h-[90svh]",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="sticky top-0 z-20 border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-brand-900/85 backdrop-blur">
            <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                  {title}
                </div>
                {subtitle ? (
                  <div className="mt-1 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white/60">
                    {subtitle}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="h-10 w-10 rounded-full bg-black/[0.03] dark:bg-white/[0.08] hover:bg-black/[0.06] dark:hover:bg-white/[0.12] border border-black/10 dark:border-white/10 flex items-center justify-center"
                onClick={onClose}
                aria-label="Close"
              >
                <span className="text-2xl leading-none text-gray-800 dark:text-white">
                  ×
                </span>
              </button>
            </div>
          </div>

          {/* scroll body */}
          <div
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
            }}
          >
            {children}
            <div className="h-10 sm:h-6" />
          </div>

          {/* footer */}
          {footer ? (
            <div className="sticky bottom-0 z-20 border-t border-black/10 dark:border-white/10 bg-white/90 dark:bg-brand-900/90 backdrop-blur px-4 py-3 sm:px-6">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Carousel per camera group ---------- */
function PhotoCarousel({
  cameraName,
  photos,
  defaultGrid = false,
}: {
  cameraName: string;
  photos: RoverPhoto[];
  defaultGrid?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<"carousel" | "grid">(
    defaultGrid ? "grid" : "carousel"
  );

  useEffect(() => {
    setCurrentIndex(0);
    setModalOpen(false);
  }, [cameraName]);

  const current = photos[currentIndex];

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

  const openModal = (idx?: number) => {
    if (typeof idx === "number") setCurrentIndex(idx);
    setModalOpen(true);
    trackEvent("Camera Modal Opened", {
      cameraName,
      currentIndex: typeof idx === "number" ? idx : currentIndex,
      photoId: photos[typeof idx === "number" ? idx : currentIndex]?.id,
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

  const modalSubtitle = `${fmtDate(current.earth_date)} • ${
    currentIndex + 1
  }/${photos.length} • Photo ID ${current.id}`;

  return (
    <>
      <Card className="p-0 overflow-hidden">
        {/* header */}
        <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.04]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate">
                {cameraName}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill>{photos.length} photos</Pill>
                <Pill>{fmtDate(current.earth_date)}</Pill>
                <Pill className="hidden sm:inline-flex">
                  {current.rover?.name ?? "Curiosity"} • {current.camera?.name ?? "—"}
                </Pill>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setView((v) => (v === "carousel" ? "grid" : "carousel"))
                }
                className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06]
                           dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
              >
                {view === "carousel" ? "Grid" : "Carousel"}
              </button>

              <button
                type="button"
                onClick={() => openModal()}
                className="rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-extrabold text-white shadow hover:bg-indigo-700 transition"
              >
                Open
              </button>
            </div>
          </div>
        </div>

        {/* body */}
        {view === "carousel" ? (
          <div className="p-4 sm:p-5">
            <div className="relative overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
              <img
                src={current.img_src}
                alt={`Mars Rover - ${cameraName}`}
                onClick={() => openModal()}
                className="h-56 w-full cursor-pointer object-cover sm:h-80"
                referrerPolicy="no-referrer"
                loading="lazy"
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

            {/* thumb strip */}
            {photos.length > 1 ? (
              <div className="mt-3 -mx-1 px-1">
                <div
                  className="flex gap-2 overflow-x-auto pb-2"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {photos.slice(0, 18).map((p, idx) => {
                    const active = idx === currentIndex;
                    return (
                      <button
                        key={`${p.id}-${idx}`}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={[
                          "shrink-0 rounded-2xl overflow-hidden ring-1 transition",
                          active
                            ? "ring-indigo-500"
                            : "ring-black/10 dark:ring-white/10 hover:ring-black/20 dark:hover:ring-white/20",
                        ].join(" ")}
                        aria-label={`Photo ${idx + 1}`}
                      >
                        <img
                          src={p.img_src}
                          alt={`Thumb ${idx + 1}`}
                          className="h-14 w-14 object-cover"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                  {photos.length > 18 ? (
                    <div className="shrink-0 flex items-center">
                      <Pill className="whitespace-nowrap">
                        + {photos.length - 18} more
                      </Pill>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">
              <span className="font-extrabold text-gray-900 dark:text-white">
                Photo ID:
              </span>{" "}
              {current.id}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p, idx) => (
                <button
                  key={`${p.id}-${idx}`}
                  type="button"
                  onClick={() => openModal(idx)}
                  className="group overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10 hover:ring-black/20 dark:hover:ring-white/20 bg-black/[0.02] dark:bg-white/[0.03]"
                  aria-label={`Open photo ${idx + 1}`}
                >
                  <div className="relative">
                    <img
                      src={p.img_src}
                      alt={`Mars Rover - ${cameraName} ${idx + 1}`}
                      className="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 left-2">
                      <span className="rounded-full bg-black/60 px-2 py-1 text-[11px] font-extrabold text-white">
                        {idx + 1}/{photos.length}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={cameraName}
        subtitle={modalSubtitle}
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] px-4 py-2 text-xs font-extrabold text-gray-800 dark:text-white/80 hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
            >
              Close
            </button>

            {photos.length > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={modalPrev}
                  className="rounded-2xl bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 px-4 py-2 text-xs font-extrabold text-gray-800 dark:text-white/80 hover:bg-white dark:hover:bg-white/[0.10]"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={modalNext}
                  className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow hover:bg-indigo-700 transition"
                >
                  Next
                </button>
              </div>
            ) : (
              <div />
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10 bg-black">
            <img
              src={current.img_src}
              alt={`Mars Rover - ${cameraName}`}
              className="w-full max-h-[60vh] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 sm:p-4 bg-white/70 dark:bg-white/[0.05]">
              <div className="text-[10px] font-extrabold text-gray-500 dark:text-white/50">
                Rover
              </div>
              <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                {current.rover?.name ?? "Curiosity"}
              </div>
            </Card>

            <Card className="p-3 sm:p-4 bg-white/70 dark:bg-white/[0.05]">
              <div className="text-[10px] font-extrabold text-gray-500 dark:text-white/50">
                Camera
              </div>
              <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                {current.camera?.name ?? "—"}
              </div>
            </Card>

            <Card className="p-3 sm:p-4 bg-white/70 dark:bg-white/[0.05]">
              <div className="text-[10px] font-extrabold text-gray-500 dark:text-white/50">
                Earth date
              </div>
              <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                {fmtDate(current.earth_date)}
              </div>
            </Card>

            <Card className="p-3 sm:p-4 bg-white/70 dark:bg-white/[0.05]">
              <div className="text-[10px] font-extrabold text-gray-500 dark:text-white/50">
                Photo ID
              </div>
              <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                {current.id}
              </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={current.img_src}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-extrabold text-white shadow hover:bg-indigo-700 transition"
            >
              Open full image
            </a>
            <button
              type="button"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(current.img_src);
                  trackEvent("Mars Rover Image URL Copied", {
                    cameraName,
                    photoId: current.id,
                  });
                } catch {
                  /* ignore */
                }
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] px-4 py-3 text-xs font-extrabold text-gray-800 dark:text-white/80 hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
            >
              Copy image URL
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ---------- Main page ---------- */
export default function MarsRoverPhotos() {
  const [solDay, setSolDay] = useState("");
  const [photos, setPhotos] = useState<RoverPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // this is always backup-only now
  const source: "MARS_RSS" = "MARS_RSS";

  // camera filter + view preferences
  const [cameraFilter, setCameraFilter] = useState<string>("All");
  const [layout, setLayout] = useState<"list" | "compact">("list");

  const landingDate = useMemo(() => new Date("2012-08-06T00:00:00Z"), []);
  const now = new Date();
  const msDifference = now.getTime() - landingDate.getTime();
  const solDurationMs = (24 * 3600 + 39 * 60 + 35) * 1000;
  const currentSol = Math.floor(msDifference / solDurationMs) + 1;
  const currentEarthDay = now.toLocaleDateString();

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    trackEvent("Mars Rover Photos Page Viewed", { page: "Mars Rover Photos", source: "mars.nasa.gov" });
  }, []);

  const groupedPhotos = useMemo(() => {
    const groups: Record<string, RoverPhoto[]> = {};
    for (const p of photos) {
      const cameraName = p?.camera?.full_name || "Unknown Camera";
      if (!groups[cameraName]) groups[cameraName] = [];
      groups[cameraName].push(p);
    }
    return groups;
  }, [photos]);

  const cameraNames = useMemo(() => Object.keys(groupedPhotos).sort(), [groupedPhotos]);

  const filteredCameraNames = useMemo(() => {
    if (cameraFilter === "All") return cameraNames;
    return cameraNames.filter((c) => c === cameraFilter);
  }, [cameraNames, cameraFilter]);

  const validateSol = (s: string) => s && !Number.isNaN(Number(s));

  const searchPhotos = async (opts?: { useCurrentSolIfEmpty?: boolean }) => {
    setError(null);

    const useCurrentSolIfEmpty = opts?.useCurrentSolIfEmpty ?? false;
    const sol = solDay?.trim() || (useCurrentSolIfEmpty ? String(currentSol) : "");

    if (!validateSol(sol)) {
      setError("Enter a valid sol day (numbers only).");
      trackEvent("Mars Rover Photos Search Failed", { reason: "Invalid input", solDay });
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    trackEvent("Mars Rover Photos Search Initiated", { solDay: sol, source: "mars.nasa.gov" });

    setLoading(true);
    setPhotos([]);

    try {
      const fetched = await fetchFromMarsRss(sol, signal);
      if (signal.aborted) return;

      if (!fetched.length) {
        setError("No photos found for that sol.");
        trackEvent("Mars Rover Photos Search No Results", { solDay: sol, source: "mars.nasa.gov" });
      } else {
        setPhotos(fetched);
        setCameraFilter("All");
        trackEvent("Mars Rover Photos Search Success", {
          solDay: sol,
          photoCount: fetched.length,
          source: "mars.nasa.gov",
        });
      }
    } catch (err: any) {
      if (String(err?.name) === "AbortError") return;
      console.error("Error fetching Mars photos:", err);
      setError("Failed to fetch photos from mars.nasa.gov.");
      trackEvent("Mars Rover Photos Search Error", { solDay: sol, error: String(err), source: "mars.nasa.gov" });
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
                Mars Rover Photos
              </h2>
              <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
                Earth day: <span className="font-extrabold">{currentEarthDay}</span> • Current sol (approx):{" "}
                <span className="font-extrabold">{currentSol}</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-white/40">
                Curiosity Sol 1: Aug 6, 2012
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Pill className="gap-1">
                Source:{" "}
                <span className="text-gray-900 dark:text-white">mars.nasa.gov</span>
              </Pill>
              {photos.length ? (
                <Pill className="gap-1">
                  Photos: <span className="text-gray-900 dark:text-white">{photos.length}</span>
                </Pill>
              ) : null}
              {cameraNames.length ? (
                <Pill className="gap-1">
                  Cameras: <span className="text-gray-900 dark:text-white">{cameraNames.length}</span>
                </Pill>
              ) : null}
            </div>
          </div>

          {/* controls */}
          <div className="mt-5 grid gap-3 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-4">
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

            <div className="sm:col-span-8 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => searchPhotos({ useCurrentSolIfEmpty: true })}
                className="w-full sm:w-auto rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white shadow hover:bg-indigo-700 transition"
              >
                Search sol
              </button>

              <button
                onClick={() => {
                  setSolDay("");
                  setPhotos([]);
                  setError(null);
                  setCameraFilter("All");
                }}
                className="w-full sm:w-auto rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.03]
                           dark:border-white/10 dark:bg-brand-900 dark:text-white/80 dark:hover:bg-white/[0.06]"
              >
                Reset
              </button>
            </div>
          </div>

          {error ? <div className="mt-3 text-sm font-bold text-red-500">{error}</div> : null}
          {loading ? (
            <div className="mt-3 flex items-center gap-3 text-sm font-bold text-gray-700 dark:text-white/70">
              <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-indigo-600 dark:border-white/10 dark:border-t-indigo-400" />
              Loading…
            </div>
          ) : null}
        </div>
      </Card>

      {/* results toolbar */}
      {!loading && photos.length > 0 ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-600 dark:text-white/60">
              Found <span className="font-extrabold text-gray-900 dark:text-white">{photos.length}</span>{" "}
              photos across{" "}
              <span className="font-extrabold text-gray-900 dark:text-white">{cameraNames.length}</span>{" "}
              cameras
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs font-extrabold text-gray-700 dark:text-white/70">
                  Camera
                </label>
                <select
                  value={cameraFilter}
                  onChange={(e) => setCameraFilter(e.target.value)}
                  className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-gray-800 shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500
                             dark:border-white/10 dark:bg-brand-900 dark:text-white/90"
                >
                  <option value="All">All</option>
                  {cameraNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-extrabold text-gray-700 dark:text-white/70">
                  Layout
                </label>
                <button
                  type="button"
                  onClick={() => setLayout((v) => (v === "list" ? "compact" : "list"))}
                  className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06]
                             dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
                >
                  {layout === "list" ? "Compact" : "Comfort"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* results */}
      {!loading && photos.length > 0 ? (
        <div className={layout === "compact" ? "space-y-3" : "space-y-4"}>
          {filteredCameraNames.map((cameraName) => (
            <PhotoCarousel
              key={cameraName}
              cameraName={cameraName}
              photos={groupedPhotos[cameraName]}
              defaultGrid={layout === "compact"}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
