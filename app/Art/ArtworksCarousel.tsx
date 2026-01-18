/* eslint-disable @next/next/no-img-element */
// ArtworksCarousel.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSwipeable } from "react-swipeable";
import { trackEvent } from "@/utils/mixpanel";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Loader2,
  ImageOff,
  Sparkles,
} from "lucide-react";

interface Artwork {
  id: number;
  title: string;
  artist_display: string;
  image_id: string | null;
  place_of_origin: string | null;
}

const FIELDS = "id,title,artist_display,image_id,place_of_origin";
const BASE_W = 1200;

// ✅ Slowed down so images have time to load + the effect “lands”
const AUTO_MS = 9_000;

// IIIF helper
const iiif = (id: string | null, w = BASE_W) =>
  id ? `https://www.artic.edu/iiif/2/${id}/full/${w},/0/default.jpg` : "";

/** pick a best-effort, less-huge URL for mobile */
function bestSrc(id: string | null) {
  if (!id) return "";
  // 1200 is crisp but not insane
  return iiif(id, 1200);
}

/** tiny image loader state */
type ImgState = "loading" | "ready" | "error";

export default function ArtworksCarousel() {
  const [arts, setArts] = useState<Artwork[]>([]);
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);

  const [imgSrc, setImgSrc] = useState<string>("");
  const [imgState, setImgState] = useState<ImgState>("loading");

  const timer = useRef<NodeJS.Timeout | null>(null);
  const thumbs = useRef<HTMLDivElement | null>(null);
  const lastIdxRef = useRef<number>(0);

  /* -------- fetch once -------- */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `https://api.artic.edu/api/v1/artworks?page=1&limit=30&fields=${FIELDS}`,
          { signal: ctrl.signal }
        );
        if (!r.ok) throw new Error(`AIC_${r.status}`);
        const j = await r.json();
        const list = (j.data || []) as Artwork[];
        setArts(list);
        if (list.length) {
          setImgState("loading");
          setImgSrc(bestSrc(list[0].image_id));
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error(e);
      }
    })();
    return () => ctrl.abort();
  }, []);

  /* -------- analytics -------- */
  useEffect(() => trackEvent("Carousel Viewed"), []);
  useEffect(() => {
    if (!arts.length) return;
    trackEvent("Artwork Viewed", { id: arts[idx].id, idx });
  }, [idx, arts]);

  /* -------- preload next (and only swap when loaded) -------- */
  useEffect(() => {
    if (!arts.length) return;

    const wanted = bestSrc(arts[idx].image_id);
    if (!wanted) {
      setImgState("error");
      setImgSrc("");
      return;
    }

    // only do work if we're actually changing
    if (idx === lastIdxRef.current && wanted === imgSrc) return;

    setImgState("loading");

    const img = new Image();
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.src = wanted;

    img.onload = () => {
      lastIdxRef.current = idx;
      setImgSrc(wanted);
      setImgState("ready");
    };
    img.onerror = () => {
      lastIdxRef.current = idx;
      setImgState("error");
      setImgSrc(wanted); // keep src so user can try open in new tab if desired
    };
  }, [idx, arts]); // intentionally NOT depending on imgSrc to prevent loops

  /* -------- autoplay -------- */
  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (timer.current || !arts.length) return;
    timer.current = setInterval(() => {
      // don’t advance while the next slide is still loading (makes it feel “smooth”)
      setIdx((i) => (i + 1) % arts.length);
    }, AUTO_MS);
  }, [arts.length]);

  useEffect(() => {
    auto ? start() : stop();
    return stop;
  }, [auto, start, stop]);

  /* -------- nav helpers -------- */
  const next = useCallback(() => {
    if (!arts.length) return;
    setIdx((i) => (i + 1) % arts.length);
  }, [arts.length]);

  const prev = useCallback(() => {
    if (!arts.length) return;
    setIdx((i) => (i ? i - 1 : arts.length - 1));
  }, [arts.length]);

  /* keyboard */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev]);

  /* thumb autoscroll */
  useEffect(() => {
    const row = thumbs.current;
    const thumb = row?.children[idx] as HTMLElement | undefined;
    if (!row || !thumb) return;

    const offset = thumb.offsetLeft - (row.clientWidth / 2 - thumb.clientWidth / 2);
    row.scrollTo({ left: offset, behavior: "smooth" });
  }, [idx]);

  /* swipe */
  const swipe = useSwipeable({
    onSwipedLeft: next,
    onSwipedRight: prev,
    trackTouch: true,
  });

  const art = useMemo(() => arts[idx], [arts, idx]);

  /* -------- loader / empty -------- */
  if (!arts.length)
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-extrabold text-neutral-700 shadow-sm dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading featured works…
        </div>
      </div>
    );

  /* -------- UI -------- */
  return (
    <section
      className="w-full max-w-6xl mx-auto select-none"
      onMouseEnter={stop}
      onMouseLeave={() => auto && start()}
      {...swipe}
    >
      {/* main frame */}
      <div className="relative mx-auto h-[62vh] sm:h-[70vh] w-full rounded-3xl overflow-hidden bg-stone-100 dark:bg-neutral-800 border border-black/10 dark:border-white/10 shadow-sm">
        {/* subtle glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        {/* image */}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={art?.title || "Artwork"}
            className={[
              "absolute inset-0 h-full w-full object-contain",
              "transition-opacity duration-500",
              imgState === "ready" ? "opacity-100" : "opacity-60",
            ].join(" ")}
            referrerPolicy="no-referrer"
            decoding="async"
            loading="eager"
          />
        ) : null}

        {/* loading / error overlay */}
        {imgState !== "ready" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-3xl bg-white/75 dark:bg-neutral-900/60 backdrop-blur px-4 py-3 border border-black/10 dark:border-white/10 shadow">

            </div>
          </div>
        ) : null}

        {/* caption */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] sm:w-3/4 lg:w-1/2">
          <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/60 backdrop-blur border border-black/10 dark:border-white/10 p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base sm:text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                  {art?.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  {art?.artist_display || "Unknown artist"}
                </p>
                {art?.place_of_origin ? (
                  <p className="mt-1 text-xs font-bold text-neutral-600 dark:text-neutral-400">
                    {art.place_of_origin}
                  </p>
                ) : null}
              </div>

              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.08] border border-black/10 dark:border-white/10 px-3 py-1 text-xs font-extrabold text-neutral-800 dark:text-neutral-200">
                <Sparkles className="h-4 w-4" />
                {idx + 1}/{arts.length}
              </span>
            </div>
          </div>
        </div>

        {/* arrows */}
        <button
          onClick={() => {
            stop();
            prev();
          }}
          aria-label="Prev"
          className="absolute top-1/2 left-3 -translate-y-1/2 bg-white/85 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 backdrop-blur p-2.5 rounded-full shadow border border-black/10 dark:border-white/10"
        >
          <ChevronLeft className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
        </button>
        <button
          onClick={() => {
            stop();
            next();
          }}
          aria-label="Next"
          className="absolute top-1/2 right-3 -translate-y-1/2 bg-white/85 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 backdrop-blur p-2.5 rounded-full shadow border border-black/10 dark:border-white/10"
        >
          <ChevronRight className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
        </button>

        {/* play / pause */}
        <button
          onClick={() => {
            setAuto((a) => !a);
            stop();
          }}
          aria-label="Toggle autoplay"
          className="absolute top-3 right-3 bg-white/85 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 backdrop-blur p-2.5 rounded-full shadow border border-black/10 dark:border-white/10"
        >
          {auto ? (
            <Pause className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
          ) : (
            <Play className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
          )}
        </button>
      </div>

      {/* thumbnails */}
      <div
        ref={thumbs}
        className="mt-5 sm:mt-6 flex gap-3 overflow-x-auto pb-2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {arts.map((a, i) => {
          const active = i === idx;
          const thumbSrc = iiif(a.image_id, 260) || "/placeholder.svg";
          return (
            <button
              key={a.id}
              onClick={() => {
                stop();
                setIdx(i);
              }}
              className={[
                "flex-shrink-0 rounded-2xl overflow-hidden border",
                active
                  ? "border-neutral-900 dark:border-yellow-400 shadow"
                  : "border-transparent opacity-60 hover:opacity-100",
              ].join(" ")}
              aria-label={`Jump to ${a.title}`}
            >
              <img
                src={thumbSrc}
                alt={a.title}
                className="h-20 w-28 sm:w-32 object-cover"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // hide broken thumbs without breaking layout
                  e.currentTarget.style.display = "none";
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-xs font-bold text-neutral-500 dark:text-neutral-400">
        Tip: swipe on mobile • arrows on desktop • autoplay pauses on hover
      </div>
    </section>
  );
}
