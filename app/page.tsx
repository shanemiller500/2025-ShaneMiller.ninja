"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";

import Hero from "@/components/hero";
import WidgetWeather from "@/components/widget-weather";
import WidgetNews from "@/app/news/widget-news";
import CryptoWidget from "@/app/Crypto/widget-crypto";
import WidgetSearch from "@/components/widget-search";
import StockWidget from "@/app/stocks/widgets/LiveStreamTickerWidget";

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
            <div className="space-y-6 ">
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
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        Tap / click to flip
      </div>

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
                          <div className="absolute inset-0 bg-black/10 dark:bg-black/20" />
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
          I’m a full-stack engineer with over a decade of experience in complex
          production environments. I’ve worked on global financial data platforms,
          core banking systems, and I build my own products from scratch.
        </p>

        <p>
          I usually end up in the hard parts of a company. Old code.
          Fragile flows. Systems no one wants to touch.
          I can step into code I’ve never seen before, trace it carefully,
          ask the right questions, and come back with a fix that doesn’t
          destabilize everything else. It’s rarely glamorous, but it’s effective.
        </p>

        <p>
          I know C# deeply and have spent years inside .NET systems.
          I love to hate it, but I understand it well.
          I prefer frontend engineering.
          Complex UI state, performance issues, and browser architecture
          problems don’t intimidate me, they’re usually just puzzles.
        </p>

        <p>
          I move between frontend, APIs, and data layers comfortably.
          Once I understand the whole system, I improve it with long-term
          stability and clarity in mind.
        </p>

        <p>
          There’s a method to how I work.
          It may look intense, even backwards to some, but it’s structured.
          I don’t chase trends. I build things that hold up.
        </p>

        <p>
          Outside of work, I build products with active world wide users like ApplyPro and U-Mail end to end.
          It keeps me sharp and reminds me that ownership matters.
          Also, no one else is going to fix my bugs.
        </p>

        <p>
          I’m not a designer, as you can probably tell from this site,
          but I care about usability and clarity.
          If you need someone steady who can improve complex systems
          without unnecessary noise, I’m happy to talk.
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


