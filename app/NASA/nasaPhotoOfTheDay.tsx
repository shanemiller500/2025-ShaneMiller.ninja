"use client";

import React, { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

const API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY || "";

type APOD = {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type?: "image" | "video";
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
      {children}
    </div>
  );
}

function mediaSrc(item: APOD) {
  return item.hdurl || item.url;
}

export default function NasaPhotoOfTheDay() {
  const [todayData, setTodayData] = useState<APOD | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [todayModalOpen, setTodayModalOpen] = useState(false);

  const [galleryData, setGalleryData] = useState<APOD[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [galleryOldestDate, setGalleryOldestDate] = useState<Date | null>(null);

  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // Today
  useEffect(() => {
    const fetchToday = async () => {
      try {
        if (!API_KEY) throw new Error("Missing NASA API key");
        const res = await fetch(
          `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}`
        );
        const data: APOD = await res.json();
        setTodayData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingToday(false);
      }
    };
    fetchToday();
  }, []);

  // Gallery initial
  useEffect(() => {
    const fetchGallery = async () => {
      try {
        if (!API_KEY) throw new Error("Missing NASA API key");
        const today = new Date();

        const endDate = new Date(today);
        endDate.setDate(today.getDate() - 1);

        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        const res = await fetch(
          `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&start_date=${startDateStr}&end_date=${endDateStr}`
        );
        const data: APOD[] = await res.json();

        const normalized = Array.isArray(data) ? data : [];
        setGalleryData(normalized.reverse());
        setGalleryOldestDate(new Date(startDate));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingGallery(false);
      }
    };
    fetchGallery();
  }, []);

  const handleLoadMore = async () => {
    if (!galleryOldestDate) return;
    if (!API_KEY) return;

    setLoadingMore(true);
    trackEvent("Load More Images Button Clicked", {
      galleryOldestDate: galleryOldestDate.toISOString(),
    });

    try {
      const newEndDate = new Date(galleryOldestDate);
      newEndDate.setDate(newEndDate.getDate() - 1);

      const newStartDate = new Date(galleryOldestDate);
      newStartDate.setDate(newStartDate.getDate() - 7);

      const startDateStr = formatDate(newStartDate);
      const endDateStr = formatDate(newEndDate);

      const res = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&start_date=${startDateStr}&end_date=${endDateStr}`
      );
      const data: APOD[] = await res.json();
      const normalized = Array.isArray(data) ? data : [];
      const newPhotos = normalized.reverse();

      setGalleryData((prev) => [...prev, ...newPhotos]);
      setGalleryOldestDate(new Date(newStartDate));

      trackEvent("Load More Images Success", { newImagesCount: newPhotos.length });
    } catch (e: any) {
      console.error(e);
      trackEvent("Load More Images Failed", { error: String(e) });
    } finally {
      setLoadingMore(false);
    }
  };

  const openTodayModal = () => {
    if (!todayData) return;
    setTodayModalOpen(true);
    trackEvent("Today Modal Opened", { imageTitle: todayData.title });
  };

  const closeTodayModal = () => {
    setTodayModalOpen(false);
    trackEvent("Today Modal Closed", { imageTitle: todayData?.title });
  };

  const openGalleryModal = (index: number) => {
    setGalleryModalOpen(true);
    setModalIndex(index);
    trackEvent("Gallery Modal Opened", {
      modalIndex: index,
      imageTitle: galleryData[index]?.title,
    });
  };

  const closeGalleryModal = () => {
    setGalleryModalOpen(false);
    trackEvent("Gallery Modal Closed", { modalIndex });
  };

  const nextModalSlide = () => {
    const total = galleryData.length;
    const nextIndex = (modalIndex + 1) % total;
    trackEvent("Gallery Modal Next Clicked", {
      fromIndex: modalIndex,
      toIndex: nextIndex,
      imageTitle: galleryData[nextIndex]?.title,
    });
    setModalIndex(nextIndex);
  };

  const prevModalSlide = () => {
    const total = galleryData.length;
    const prevIndex = (modalIndex - 1 + total) % total;
    trackEvent("Gallery Modal Prev Clicked", {
      fromIndex: modalIndex,
      toIndex: prevIndex,
      imageTitle: galleryData[prevIndex]?.title,
    });
    setModalIndex(prevIndex);
  };

  const galleryCurrent = useMemo(() => galleryData[modalIndex], [galleryData, modalIndex]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Photo of the Day
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Tap the image to open it full screen.
        </p>
      </div>

      {/* Today */}
      <Card>
        {loadingToday ? (
          <div className="text-sm font-bold text-gray-700 dark:text-white/70">
            Loading…
          </div>
        ) : todayData ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                  {todayData.title}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
                  {todayData.date}
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-extrabold text-gray-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80">
                {todayData.media_type === "video" ? "Video" : "Image"}
              </div>
            </div>

            {todayData.media_type === "video" ? (
              <div className="overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10">
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  <iframe
                    src={todayData.url}
                    title={todayData.title}
                    className="absolute inset-0 h-full w-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10">
                <img
                  src={mediaSrc(todayData)}
                  alt={todayData.title}
                  onClick={openTodayModal}
                  className="h-[280px] w-full cursor-pointer object-cover sm:h-[420px]"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <p className="text-sm font-semibold leading-relaxed text-gray-700 dark:text-white/70">
              {todayData.explanation}
            </p>
          </div>
        ) : (
          <div className="text-sm font-bold text-gray-700 dark:text-white/70">
            Unable to load today.
          </div>
        )}
      </Card>

      {/* Gallery */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
            Gallery
          </h3>
          <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
            Recent days, tap any card.
          </p>
        </div>
      </div>

      {loadingGallery ? (
        <div className="text-sm font-bold text-gray-700 dark:text-white/70">
          Loading…
        </div>
      ) : galleryData.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {galleryData.map((item, index) => (
            <button
              key={item.date}
              onClick={() => openGalleryModal(index)}
              className="text-left"
            >
              <div className="group overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-brand-900">
                <div className="relative">
                  <img
                    src={mediaSrc(item)}
                    alt={item.title}
                    className="h-44 w-full object-cover transition group-hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[11px] font-extrabold text-white">
                    {item.date}
                  </div>
                </div>
                <div className="p-4">
                  <div className="line-clamp-2 text-sm font-extrabold text-gray-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-gray-600 dark:text-white/60">
                    Tap to open
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm font-bold text-gray-700 dark:text-white/70">
          No gallery photos available.
        </div>
      )}

      {/* Load more */}
      {galleryData.length ? (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-2xl border border-black/10 bg-black/[0.03] px-5 py-2 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06] disabled:opacity-50
                       dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {/* Today Modal (image only) */}
      {todayModalOpen && todayData && todayData.media_type !== "video" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={closeTodayModal} />
          <div
            className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl bg-black ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-white">
                  {todayData.title}
                </div>
                <div className="text-xs font-semibold text-white/70">
                  {todayData.date}
                </div>
              </div>
              <button
                onClick={closeTodayModal}
                className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-extrabold text-white hover:bg-white/15"
              >
                Close
              </button>
            </div>

            <img
              src={mediaSrc(todayData)}
              alt={todayData.title}
              className="max-h-[75vh] w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      ) : null}

      {/* Gallery Modal Carousel */}
      {galleryModalOpen && galleryCurrent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={closeGalleryModal} />
          <div
            className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl bg-black ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-white">
                  {galleryCurrent.title}
                </div>
                <div className="text-xs font-semibold text-white/70">
                  {galleryCurrent.date} • {modalIndex + 1}/{galleryData.length}
                </div>
              </div>

              <button
                onClick={closeGalleryModal}
                className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-extrabold text-white hover:bg-white/15"
              >
                Close
              </button>
            </div>

            <div className="relative">
              <img
                src={mediaSrc(galleryCurrent)}
                alt={galleryCurrent.title}
                className="max-h-[75vh] w-full object-contain"
                referrerPolicy="no-referrer"
              />

              <button
                onClick={prevModalSlide}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-lg font-extrabold text-white hover:bg-white/15"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                onClick={nextModalSlide}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-lg font-extrabold text-white hover:bg-white/15"
                aria-label="Next"
              >
                ›
              </button>
            </div>

            <div className="px-4 py-4 text-xs font-semibold text-white/70">
              {galleryCurrent.explanation?.slice(0, 220)}
              {galleryCurrent.explanation?.length > 220 ? "…" : ""}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
