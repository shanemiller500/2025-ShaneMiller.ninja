"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, RotateCw } from "lucide-react";

import resumeContent from "@/app/resume/content.json";

import Hero from "@/components/hero";
import WidgetWeather from "@/components/widget-weather";
import WidgetNews from "@/app/news/widget-news";
import CryptoWidget from "@/app/Crypto/widget-crypto";
import WidgetSearch from "@/components/widget-search";
import StockWidget from "@/app/stocks/widgets/LiveStreamTickerWidget";
import { WidgetCard } from "@/components/ui/widget-card";

import HeroImage from "@/public/images/pumpkin.jpg";
import SecondImage from "@/public/images/cabin.jpg";
import ThirdImage from "@/public/images/winter.jpg";
import FourthImage from "@/public/images/fiji.jpg";
import FifthImage from "@/public/images/couch.jpg";

import flipImage from "@/public/images/kids.jpg";
import flip2Image from "@/public/images/bananas.jpg";
import flip3Image from "@/public/images/snake.jpg";
import flip4Image from "@/public/images/walk.jpg";
import flip5Image from "@/public/images/family.jpg";

/* ------------------------------------------------------------------ */
/*  HomePage Component                                                */
/* ------------------------------------------------------------------ */

const CAROUSEL_IMAGES = [HeroImage, SecondImage, ThirdImage, FourthImage, FifthImage];

// “Back” images for flip (must match order/length of CAROUSEL_IMAGES)
const FLIP_IMAGES = [flipImage, flip2Image, flip3Image, flip4Image, flip5Image];

const SLIDE_INTERVAL_MS = 10000;

export default function HomePage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // store flip state per slide so flipping one doesn’t affect others
  const [flippedMap, setFlippedMap] = useState<boolean[]>(
    () => new Array(CAROUSEL_IMAGES.length).fill(false)
  );

  // keep flip map in sync if you add/remove images later
  useEffect(() => {
    setFlippedMap((prev) => {
      const next = new Array(CAROUSEL_IMAGES.length).fill(false);
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [currentImageIndex]);

  const toggleFlip = useCallback((index: number) => {
    setFlippedMap((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  return (
    <>
      <Hero />

      <div className="grid gap-10 pt-10 pb-20 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_300px] md:gap-8 lg:gap-10">
        <div className="min-w-0 space-y-12">
          <ImageCarousel
            currentIndex={currentImageIndex}
            flippedMap={flippedMap}
            onToggleFlip={toggleFlip}
            onSelect={setCurrentImageIndex}
          />
          <BioSection />
          <StockWidget />
        </div>

        <aside className="min-w-0 space-y-5">
          <WidgetSearch />
          <WidgetWeather />
          <CryptoWidget />
          <WidgetCard title="Headlines" subtitle="Latest from around the web">
            <WidgetNews />
          </WidgetCard>
        </aside>
      </div>
    </>
  );
}

function ImageCarousel({
  currentIndex,
  flippedMap,
  onToggleFlip,
  onSelect,
}: {
  currentIndex: number;
  flippedMap: boolean[];
  onToggleFlip: (index: number) => void;
  onSelect: (index: number) => void;
}) {
  // Safety: if FLIP_IMAGES gets out of sync, fall back to the front image
  const backImages = useMemo(() => {
    if (FLIP_IMAGES.length !== CAROUSEL_IMAGES.length) {
      return CAROUSEL_IMAGES;
    }
    return FLIP_IMAGES;
  }, []);

  return (
    <div className="group/carousel relative overflow-hidden rounded-3xl bg-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 dark:bg-white/[0.03] dark:ring-white/10">
      {/* Flip hint — quiet until hover */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 opacity-0 shadow-sm backdrop-blur transition-opacity duration-300 group-hover/carousel:opacity-100 dark:bg-black/50 dark:text-white">
        <RotateCw className="h-3 w-3" />
        Click to flip
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/20 px-2 py-1.5 backdrop-blur">
        {CAROUSEL_IMAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === currentIndex}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>

      <div className="relative w-full aspect-[4/3] sm:aspect-[3/2]">
        <div
          className="absolute inset-0 flex transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {CAROUSEL_IMAGES.map((frontSrc, index) => {
            const isFlipped = !!flippedMap[index];
            const backSrc = backImages[index] ?? frontSrc;

            return (
              <div key={index} className="relative w-full h-full flex-shrink-0">
                {/* Click/tap target */}
                <button
                  type="button"
                  aria-label={isFlipped ? "Flip image to front" : "Flip image to back"}
                  aria-pressed={isFlipped}
                  onClick={() => onToggleFlip(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleFlip(index);
                    }
                  }}
                  className="group relative w-full h-full text-left focus:outline-none"
                >
                  {/* 3D flip scene */}
                  <div
                    className="relative h-full w-full"
                    style={{ perspective: "1200px" }}
                  >
                    <div
                      className="relative h-full w-full transition-transform duration-700 ease-out will-change-transform"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: isFlipped ? "rotateY(-180deg)" : "rotateY(0deg)",
                      }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <Image
                          src={frontSrc}
                          alt={`Portfolio image ${index + 1}`}
                          fill
                          priority={index === 0}
                          sizes="(max-width: 768px) 100vw, 760px"
                          className="object-cover object-center"
                        />
                        {/* subtle hover/tap affordance */}
                        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <div className="absolute inset-0 bg-black/5 dark:bg-black/15" />
                        </div>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(-180deg)",
                        }}
                      >
                        <Image
                          src={backSrc}
                          alt={`Portfolio image ${index + 1} (back)`}
                          fill
                          sizes="(max-width: 768px) 100vw, 760px"
                          className="object-cover object-center"
                        />
                        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <div className="absolute inset-0 bg-black/5 dark:bg-black/15" />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BioSection() {
  const [lead, ...rest] = resumeContent.bio;

  return (
    <section>
      <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        About
      </p>
      <h2 className="font-aspekta text-2xl font-[650] text-slate-900 dark:text-white">
        A bit about me
      </h2>

      <div className="mt-6 max-w-[640px] space-y-5 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
        <p className="text-[17px] leading-8 text-slate-800 dark:text-slate-200">{lead}</p>
        {rest.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <Link
        href="/resume"
        className="group mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
      >
        Read the full resume
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}
