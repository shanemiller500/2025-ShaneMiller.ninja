"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";

import Hero from "@/components/hero";
import WidgetWeather from "@/components/widget-weather";
import WidgetNews from "@/components/widget-news";
import CryptoWidget from "@/components/widget-crypto";
import WidgetSearch from "@/components/widget-search";
import StockWidget from "@/app/stocks/stock/LiveStreamTickerWidget";

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
  }, []);

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

      <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pb-16 md:pb-20">
        <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">
          <div className="grow">
            <div className="max-w-[760px]">
              <section>
                <ImageCarousel
                  currentIndex={currentImageIndex}
                  flippedMap={flippedMap}
                  onToggleFlip={toggleFlip}
                />
                <BioSection />
                <StockWidget />
              </section>
            </div>
          </div>

          <aside className="md:w-[240px] lg:w-[300px] shrink-0">
            <div className="space-y-6">
              <WidgetSearch />
              <WidgetWeather />
              <CryptoWidget />
              <WidgetNews />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function ImageCarousel({
  currentIndex,
  flippedMap,
  onToggleFlip,
}: {
  currentIndex: number;
  flippedMap: boolean[];
  onToggleFlip: (index: number) => void;
}) {
  // Safety: if FLIP_IMAGES gets out of sync, fall back to the front image
  const backImages = useMemo(() => {
    if (FLIP_IMAGES.length !== CAROUSEL_IMAGES.length) {
      return CAROUSEL_IMAGES;
    }
    return FLIP_IMAGES;
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900">
      {/* Tap/click hint */}
      {/* <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        Tap / click to flip
      </div> */}

      <div className="relative w-full aspect-[1/1] bg-gray-50 dark:bg-brand-900">
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
                        transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
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
                          <div className="absolute inset-0 bg-black/10 dark:bg-black/20" />
                        </div>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
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
                          <div className="absolute inset-0 bg-black/10 dark:bg-black/20" />
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
  return (
    <div className="text-slate-500 dark:text-slate-400 space-y-8 pt-10">
      <div className="space-y-4">
        <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">
          Short Bio
        </h2>

        <p>
          I'm a full-stack developer with over a decade of experience building,
          maintaining, and supporting production web applications. I've worked
          on large-scale platforms at S&amp;P Global, and today I help keep
          mission-critical banking software stable and dependable at Data Center Inc.
        </p>

        <p>
          Outside of my day job, I spend time building and refining personal projects,
          including ApplyPro and UMail. This portfolio has been updated over many years
          as my work and interests have evolved.
        </p>

        <p>
          I care about clean UX, straightforward architecture, and seeing things through.
          I'm not interested in trends, I focus on building things that work and improving them over time.
        </p>

        <p>
          If you're looking for someone practical, steady, and easy to work with,
          I'm always happy to talk.
        </p>

        <p className="text-xs text-gray-500 text-center pb-10">
          See resume{" "}
          <a href="/resume" className="text-indigo-500 underline">
            here
          </a>
        </p>
      </div>
    </div>
  );
}
