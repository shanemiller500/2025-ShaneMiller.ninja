/* eslint-disable @next/next/no-img-element */
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
  Sparkles,
} from "lucide-react";

interface Artwork {
  id: number;
  title: string;
  artist_display: string;
  image_id: string | null;
  place_of_origin: string | null;
}

type ImageLoadState = "loading" | "ready" | "error";

const API_FIELDS = "id,title,artist_display,image_id,place_of_origin";
const DEFAULT_IMAGE_WIDTH = 1200;
const AUTOPLAY_INTERVAL_MS = 9000;

function buildIiifUrl(imageId: string | null, width = DEFAULT_IMAGE_WIDTH): string {
  if (!imageId) return "";
  return `https://www.artic.edu/iiif/2/${imageId}/full/${width},/0/default.jpg`;
}

export default function ArtworksCarousel() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(true);
  const [imageSrc, setImageSrc] = useState("");
  const [imageState, setImageState] = useState<ImageLoadState>("loading");

  const autoplayTimer = useRef<NodeJS.Timeout | null>(null);
  const thumbnailsRef = useRef<HTMLDivElement | null>(null);
  const lastLoadedIndex = useRef(0);

  const currentArtwork = useMemo(() => artworks[currentIndex], [artworks, currentIndex]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchArtworks() {
      try {
        const response = await fetch(
          `https://api.artic.edu/api/v1/artworks?page=1&limit=30&fields=${API_FIELDS}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const artworkList = (data.data || []) as Artwork[];
        setArtworks(artworkList);

        if (artworkList.length > 0) {
          setImageState("loading");
          setImageSrc(buildIiifUrl(artworkList[0].image_id));
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error(error);
      }
    }

    fetchArtworks();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    trackEvent("Carousel Viewed");
  }, []);

  useEffect(() => {
    if (artworks.length === 0) return;
    trackEvent("Artwork Viewed", { id: artworks[currentIndex].id, idx: currentIndex });
  }, [currentIndex, artworks]);

  useEffect(() => {
    if (artworks.length === 0) return;

    const targetSrc = buildIiifUrl(artworks[currentIndex].image_id);

    if (!targetSrc) {
      setImageState("error");
      setImageSrc("");
      return;
    }

    if (currentIndex === lastLoadedIndex.current && targetSrc === imageSrc) {
      return;
    }

    setImageState("loading");

    const preloadImage = new Image();
    preloadImage.decoding = "async";
    preloadImage.referrerPolicy = "no-referrer";
    preloadImage.src = targetSrc;

    preloadImage.onload = () => {
      lastLoadedIndex.current = currentIndex;
      setImageSrc(targetSrc);
      setImageState("ready");
    };

    preloadImage.onerror = () => {
      lastLoadedIndex.current = currentIndex;
      setImageState("error");
      setImageSrc(targetSrc);
    };
  }, [currentIndex, artworks]);

  const stopAutoplay = useCallback(() => {
    if (autoplayTimer.current) {
      clearInterval(autoplayTimer.current);
      autoplayTimer.current = null;
    }
  }, []);

  const startAutoplay = useCallback(() => {
    if (autoplayTimer.current || artworks.length === 0) return;

    autoplayTimer.current = setInterval(() => {
      setCurrentIndex((index) => (index + 1) % artworks.length);
    }, AUTOPLAY_INTERVAL_MS);
  }, [artworks.length]);

  useEffect(() => {
    if (isAutoplayEnabled) {
      startAutoplay();
    } else {
      stopAutoplay();
    }
    return stopAutoplay;
  }, [isAutoplayEnabled, startAutoplay, stopAutoplay]);

  const goToNext = useCallback(() => {
    if (artworks.length === 0) return;
    setCurrentIndex((index) => (index + 1) % artworks.length);
  }, [artworks.length]);

  const goToPrevious = useCallback(() => {
    if (artworks.length === 0) return;
    setCurrentIndex((index) => (index > 0 ? index - 1 : artworks.length - 1));
  }, [artworks.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goToNext();
      if (event.key === "ArrowLeft") goToPrevious();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious]);

  useEffect(() => {
    const container = thumbnailsRef.current;
    const thumbnail = container?.children[currentIndex] as HTMLElement | undefined;

    if (!container || !thumbnail) return;

    const scrollOffset = thumbnail.offsetLeft - (container.clientWidth / 2 - thumbnail.clientWidth / 2);
    container.scrollTo({ left: scrollOffset, behavior: "smooth" });
  }, [currentIndex]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: goToNext,
    onSwipedRight: goToPrevious,
    trackTouch: true,
  });

  if (artworks.length === 0) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-extrabold text-neutral-700 shadow-sm dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading featured works…
        </div>
      </div>
    );
  }

  return (
    <section
      className="w-full max-w-6xl mx-auto select-none"
      onMouseEnter={stopAutoplay}
      onMouseLeave={() => isAutoplayEnabled && startAutoplay()}
      {...swipeHandlers}
    >
      <div className="relative mx-auto h-[62vh] sm:h-[70vh] w-full rounded-3xl overflow-hidden bg-stone-100 dark:bg-neutral-800 border border-black/10 dark:border-white/10 shadow-sm">
        <BackgroundGlow />

        {imageSrc && (
          <img
            src={imageSrc}
            alt={currentArtwork?.title || "Artwork"}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
              imageState === "ready" ? "opacity-100" : "opacity-60"
            }`}
            referrerPolicy="no-referrer"
            decoding="async"
            loading="eager"
          />
        )}

        <ArtworkCaption
          artwork={currentArtwork}
          currentIndex={currentIndex}
          totalCount={artworks.length}
        />

        <NavigationButton
          direction="prev"
          onClick={() => {
            stopAutoplay();
            goToPrevious();
          }}
        />

        <NavigationButton
          direction="next"
          onClick={() => {
            stopAutoplay();
            goToNext();
          }}
        />

        <AutoplayToggle
          isPlaying={isAutoplayEnabled}
          onToggle={() => {
            setIsAutoplayEnabled((enabled) => !enabled);
            stopAutoplay();
          }}
        />
      </div>

      <ThumbnailStrip
        artworks={artworks}
        currentIndex={currentIndex}
        onSelect={(index) => {
          stopAutoplay();
          setCurrentIndex(index);
        }}
        containerRef={thumbnailsRef}
      />

      <div className="mt-3 text-xs font-bold text-neutral-500 dark:text-neutral-400">
        Tip: swipe on mobile • arrows on desktop • autoplay pauses on hover
      </div>
    </section>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
    </div>
  );
}

interface ArtworkCaptionProps {
  artwork: Artwork | undefined;
  currentIndex: number;
  totalCount: number;
}

function ArtworkCaption({ artwork, currentIndex, totalCount }: ArtworkCaptionProps) {
  if (!artwork) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] sm:w-3/4 lg:w-1/2">
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/60 backdrop-blur border border-black/10 dark:border-white/10 p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base sm:text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
              {artwork.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {artwork.artist_display || "Unknown artist"}
            </p>
            {artwork.place_of_origin && (
              <p className="mt-1 text-xs font-bold text-neutral-600 dark:text-neutral-400">
                {artwork.place_of_origin}
              </p>
            )}
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.08] border border-black/10 dark:border-white/10 px-3 py-1 text-xs font-extrabold text-neutral-800 dark:text-neutral-200">
            <Sparkles className="h-4 w-4" />
            {currentIndex + 1}/{totalCount}
          </span>
        </div>
      </div>
    </div>
  );
}

interface NavigationButtonProps {
  direction: "prev" | "next";
  onClick: () => void;
}

function NavigationButton({ direction, onClick }: NavigationButtonProps) {
  const isPrev = direction === "prev";
  const Icon = isPrev ? ChevronLeft : ChevronRight;
  const positionClass = isPrev ? "left-3" : "right-3";

  return (
    <button
      onClick={onClick}
      aria-label={isPrev ? "Previous" : "Next"}
      className={`absolute top-1/2 ${positionClass} -translate-y-1/2 bg-white/85 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 backdrop-blur p-2.5 rounded-full shadow border border-black/10 dark:border-white/10`}
    >
      <Icon className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
    </button>
  );
}

interface AutoplayToggleProps {
  isPlaying: boolean;
  onToggle: () => void;
}

function AutoplayToggle({ isPlaying, onToggle }: AutoplayToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle autoplay"
      className="absolute top-3 right-3 bg-white/85 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 backdrop-blur p-2.5 rounded-full shadow border border-black/10 dark:border-white/10"
    >
      {isPlaying ? (
        <Pause className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
      ) : (
        <Play className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
      )}
    </button>
  );
}

interface ThumbnailStripProps {
  artworks: Artwork[];
  currentIndex: number;
  onSelect: (index: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function ThumbnailStrip({ artworks, currentIndex, onSelect, containerRef }: ThumbnailStripProps) {
  return (
    <div
      ref={containerRef}
      className="mt-5 sm:mt-6 flex gap-3 overflow-x-auto pb-2"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {artworks.map((artwork, index) => {
        const isActive = index === currentIndex;
        const thumbnailSrc = buildIiifUrl(artwork.image_id, 260) || "/placeholder.svg";

        return (
          <button
            key={artwork.id}
            onClick={() => onSelect(index)}
            className={`flex-shrink-0 rounded-2xl overflow-hidden border ${
              isActive
                ? "border-neutral-900 dark:border-yellow-400 shadow"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
            aria-label={`Jump to ${artwork.title}`}
          >
            <img
              src={thumbnailSrc}
              alt={artwork.title}
              className="h-20 w-28 sm:w-32 object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
