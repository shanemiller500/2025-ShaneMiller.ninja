/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import { cn } from "../lib/utils";
import { SWIPE_THRESHOLD_PX } from "../lib/constants";

interface CountryLightboxProps {
  open: boolean;
  photos: string[];
  viewerIdx: number;
  setViewerIdx: (i: number) => void;
  onClose: () => void;
  countryName?: string;
  flagPng?: string;
}

export default function CountryLightbox({
  open,
  photos,
  viewerIdx,
  setViewerIdx,
  onClose,
  countryName,
  flagPng,
}: CountryLightboxProps) {
  const touchStartX = useRef<number | null>(null);

  const prevImg = useCallback(() => {
    if (!photos.length) return;
    setViewerIdx((viewerIdx - 1 + photos.length) % photos.length);
  }, [photos.length, viewerIdx, setViewerIdx]);

  const nextImg = useCallback(() => {
    if (!photos.length) return;
    setViewerIdx((viewerIdx + 1) % photos.length);
  }, [photos.length, viewerIdx, setViewerIdx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevImg();
      else if (e.key === "ArrowRight") nextImg();
      else if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, prevImg, nextImg, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const ex = e.changedTouches?.[0]?.clientX ?? null;
    touchStartX.current = null;
    if (sx == null || ex == null || !open) return;
    const dx = ex - sx;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx > 0) prevImg(); else nextImg();
  };

  return (
    <AnimatePresence>
      {open && photos.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={onClose}
        >
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute right-4 top-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            type="button"
            aria-label="Close"
          >
            <FaTimes />
          </button>

          {/* Country name overlay */}
          <div className="absolute top-4 left-4 right-20">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
              {flagPng && (
                <img src={flagPng} alt="" className="w-5 h-3.5 object-cover rounded-sm" referrerPolicy="no-referrer" />
              )}
              <span className="text-white text-xs font-semibold">{countryName}</span>
            </div>
          </div>

          {/* Fixed nav arrows — viewport edges, don't eat image width */}
          <button
            onClick={(e) => { e.stopPropagation(); prevImg(); }}
            className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-[51] h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 text-white flex items-center justify-center transition"
            type="button"
            aria-label="Previous"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); nextImg(); }}
            className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-[51] h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 text-white flex items-center justify-center transition"
            type="button"
            aria-label="Next"
          >
            <FaChevronRight />
          </button>

          {/* Image stage */}
          <div className="min-h-[100svh] w-full flex items-center justify-center px-2 sm:px-4">
            <div className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
              <motion.img
                key={viewerIdx}
                initial={{ opacity: 0.5, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                src={photos[viewerIdx]}
                alt={`${countryName ?? "Gallery"} — photo ${viewerIdx + 1}`}
                className="mx-auto max-h-[90svh] w-full object-contain rounded-2xl shadow-2xl cursor-pointer"
                referrerPolicy="no-referrer"
                onClick={nextImg}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />

              {/* Dot indicators */}
              <div className="mt-4 flex justify-center items-center gap-1.5">
                {photos.slice(0, 14).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewerIdx(i)}
                    className={cn(
                      "rounded-full transition-all duration-200",
                      i === viewerIdx
                        ? "w-6 h-2 bg-white"
                        : "w-2 h-2 bg-white/30 hover:bg-white/60",
                    )}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
                {photos.length > 14 && (
                  <span className="text-white/40 text-xs ml-1">+{photos.length - 14}</span>
                )}
              </div>

              <div className="mt-2 text-center text-white/40 text-xs">
                {viewerIdx + 1} / {photos.length} · Swipe or use arrow keys
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
