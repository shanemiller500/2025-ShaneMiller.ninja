/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";

export interface LightboxImage {
  src: string;
  /** Smaller version for the thumbnail strip (falls back to src) */
  thumb?: string;
  alt: string;
  caption?: string;
  /** "Open original" link */
  href?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  /** Pass "no-referrer" for CDNs with hotlink protection */
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

const ZOOM = 2.4;

/**
 * Full-screen image viewer: shows the whole image (object-contain, never cropped),
 * ←/→ and swipe to browse, click or Z to zoom and move the mouse to pan, Esc to close.
 * Portaled above everything, including an open <Modal>; its Esc doesn't close the modal underneath.
 */
export function Lightbox({ images, index, open, onClose, onIndexChange, referrerPolicy }: LightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [loaded, setLoaded] = useState(false);
  const [dir, setDir] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const count = images.length;
  const img = images[index];

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setDir(delta);
      setZoomed(false);
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange]
  );

  useEffect(() => setLoaded(false), [index, img?.src]);

  // Keyboard — capture phase so Esc doesn't also close a modal underneath
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (zoomed) setZoomed(false);
        else onClose();
      } else if (e.key === "ArrowRight") {
        e.stopImmediatePropagation();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.stopImmediatePropagation();
        go(-1);
      } else if (e.key.toLowerCase() === "z") {
        setZoomed((z) => !z);
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, zoomed, go, onClose]);

  // Keep the active thumbnail in view
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index, open]);

  useEffect(() => {
    if (!open) setZoomed(false);
  }, [open]);

  const pan = (e: React.MouseEvent<HTMLElement>) => {
    if (!zoomed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && img && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Image viewer: ${img.alt}`}
          className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 text-white backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Top bar */}
          <div className="flex shrink-0 items-center gap-3 px-4 py-3">
            <span className="font-mono text-[11px] tabular-nums text-white/60">
              {index + 1} / {count}
            </span>
            <p className="min-w-0 flex-1 truncate text-center text-[13px] text-white/80">{img.caption ?? img.alt}</p>
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              title={zoomed ? "Zoom out (Z)" : "Zoom in (Z)"}
              className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            </button>
            {img.href && (
              <a href={img.href} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original" className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button type="button" onClick={onClose} autoFocus aria-label="Close viewer" title="Close (Esc)" className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stage */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 sm:px-16"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            {!loaded && (
              <span aria-hidden className="absolute h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            )}
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.img
                key={img.src}
                src={img.src}
                alt={img.alt}
                referrerPolicy={referrerPolicy}
                draggable={false}
                onLoad={() => setLoaded(true)}
                onClick={() => setZoomed((z) => !z)}
                onMouseMove={pan}
                custom={dir}
                initial={{ opacity: 0, x: dir * 60 }}
                animate={{ opacity: loaded ? 1 : 0, x: 0, scale: zoomed ? ZOOM : 1 }}
                exit={{ opacity: 0, x: dir * -60 }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                drag={!zoomed && count > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1);
                  else if (info.offset.x > 60) go(-1);
                }}
                style={{ transformOrigin: origin }}
                className={`max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
              />
            </AnimatePresence>

            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20 sm:left-4">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20 sm:right-4">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {count > 1 && (
            <div ref={stripRef} className="flex shrink-0 gap-2 overflow-x-auto no-scrollbar px-4 py-3">
              {images.map((im, i) => (
                <button
                  key={`${im.src}-${i}`}
                  type="button"
                  data-i={i}
                  onClick={() => {
                    setDir(i > index ? 1 : -1);
                    setZoomed(false);
                    onIndexChange(i);
                  }}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={i === index}
                  className={`h-16 w-12 shrink-0 overflow-hidden rounded-md ring-2 transition ${i === index ? "opacity-100 ring-indigo-400" : "opacity-50 ring-transparent hover:opacity-90"}`}
                >
                  <img src={im.thumb ?? im.src} alt="" loading="lazy" referrerPolicy={referrerPolicy} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="pb-3 text-center font-mono text-[10px] uppercase tracking-wider text-white/30">
            ← → browse · click to zoom · esc to close
          </p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
