/* eslint-disable @next/next/no-img-element */
// ArtworksGallery.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X as Close, ImageOff, Loader2, Maximize2 } from "lucide-react";

interface Artwork {
  id: number;
  title: string;
  image_id: string | null;
  description: string;
}

const FIELDS = "id,title,image_id,description";
const PAGE = 2; // “older” than the first 20
const LIMIT = 30; // 30 thumbnails

const iiif = (id: string | null, w = 300) =>
  id ? `https://www.artic.edu/iiif/2/${id}/full/${w},/0/default.jpg` : "";

/** simple loadable image w/ skeleton + graceful fallback */
function SmartImg({
  src,
  alt,
  className,
  onClick,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  sizes?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative">
      {/* skeleton */}
      {!loaded && !failed ? (
        <div className="absolute inset-0 animate-pulse bg-black/5 dark:bg-white/10" />
      ) : null}

      {failed ? (
        <div className="flex h-full w-full items-center justify-center bg-black/5 dark:bg-white/10">
          <div className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-neutral-600 dark:text-neutral-300">
            <ImageOff className="h-4 w-4" />
            Image unavailable
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={[
            className || "",
            "transition-transform duration-300 will-change-transform",
            loaded ? "opacity-100" : "opacity-0",
          ].join(" ")}
          loading="lazy"
          decoding="async"
          sizes={sizes}
          onClick={onClick}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      )}
    </div>
  );
}

export default function ArtworksGallery() {
  const [arts, setArts] = useState<Artwork[]>([]);
  const [active, setActive] = useState<Artwork | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // lock body scroll when modal open (prevents background jump on mobile)
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  /* fetch once */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(
          `https://api.artic.edu/api/v1/artworks?page=${PAGE}&limit=${LIMIT}&fields=${FIELDS}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`AIC_${res.status}`);
        const json = await res.json();
        setArts((json.data || []) as Artwork[]);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error(e);
        setErr("Couldn’t load older works right now.");
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const hasArt = arts.length > 0;

  const activeFullSrc = useMemo(() => {
    if (!active?.image_id) return "";
    // 1600 can be heavy on mobile; 1200 is a good sweet spot
    return iiif(active.image_id, 1400);
  }, [active]);

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-14">
          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-extrabold text-neutral-700 shadow-sm dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading older works…
          </div>
        </div>
      ) : err ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-bold text-red-700 dark:text-red-200">
          {err}
        </div>
      ) : !hasArt ? (
        <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm font-bold text-neutral-700 shadow-sm dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200">
          No items returned.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {arts.map((a) => (
            <button
              key={a.id}
              onClick={() => setActive(a)}
              className={[
                "group overflow-hidden rounded-3xl",
                "border border-black/10 bg-white shadow-sm",
                "dark:border-white/10 dark:bg-neutral-800",
                "hover:shadow-md transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              ].join(" ")}
              aria-label={`Open ${a.title}`}
            >
              <div className="relative">
                <SmartImg
                  src={iiif(a.image_id, 600) || "/placeholder.svg"}
                  alt={a.title}
                  className="w-full h-[190px] sm:h-[220px] object-cover group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="rounded-2xl bg-black/55 backdrop-blur px-3 py-2">
                    <div className="line-clamp-1 text-left text-xs font-extrabold text-white">
                      {a.title}
                    </div>
                  </div>
                </div>

                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[11px] font-extrabold text-neutral-800">
                    <Maximize2 className="h-3 w-3" />
                    Open
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ----------- lightbox (scroll-safe on mobile) ---------- */}
      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
          onClick={() => setActive(null)}
        >
          <div className="min-h-[100svh] w-full flex items-center justify-center px-3 py-3 sm:p-6">
            <div
              className={[
                "relative w-full max-w-5xl",
                "rounded-3xl overflow-hidden",
                "bg-white dark:bg-neutral-900",
                "border border-black/10 dark:border-white/10",
                "shadow-2xl",
                "max-h-[calc(100svh-24px)] sm:max-h-[90svh]",
                "flex flex-col",
              ].join(" ")}
              onClick={(e) => e.stopPropagation()}
            >
              {/* top bar */}
              <div className="sticky top-0 z-20 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-black/10 dark:border-white/10">
                <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm sm:text-base font-extrabold text-neutral-900 dark:text-neutral-100">
                      {active.title}
                    </div>
                    {active.description ? (
                      <div className="mt-1 line-clamp-2 text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                        {active.description}
                      </div>
                    ) : null}
                  </div>

                  <button
                    aria-label="Close"
                    className="h-10 w-10 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/10 dark:border-white/10 flex items-center justify-center"
                    onClick={() => setActive(null)}
                  >
                    <Close className="h-5 w-5 text-neutral-900 dark:text-neutral-100" />
                  </button>
                </div>
              </div>

              {/* scroll body */}
              <div
                className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
              >
                <div className="overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10 bg-black">
                  {activeFullSrc ? (
                    <img
                      src={activeFullSrc}
                      alt={active.title}
                      className="w-full max-h-[70vh] object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-10 text-center text-sm font-bold text-white/70">
                      No image available.
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  {activeFullSrc ? (
                    <a
                      href={activeFullSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-extrabold text-white shadow hover:bg-indigo-700 transition"
                    >
                      Open full image
                    </a>
                  ) : null}

                  {activeFullSrc ? (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(activeFullSrc);
                        } catch {}
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] px-4 py-3 text-xs font-extrabold text-neutral-900 dark:text-neutral-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
                    >
                      Copy image URL
                    </button>
                  ) : null}
                </div>

                <div className="h-8" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
