"use client";

import { useState, useEffect } from "react";
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

const CAROUSEL_IMAGES = [
  HeroImage,
  SecondImage,
  ThirdImage,
  FourthImage,
  FifthImage,
];

const SLIDE_INTERVAL_MS = 10000;

export default function HomePage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Hero />

      <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pb-16 md:pb-20">
        <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">
          <div className="grow">
            <div className="max-w-[760px]">
              <section>
                <ImageCarousel currentIndex={currentImageIndex} />
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

function ImageCarousel({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900">
      <div className="relative w-full aspect-[1/1] bg-gray-50 dark:bg-brand-900">
        <div
          className="absolute inset-0 flex transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {CAROUSEL_IMAGES.map((src, index) => (
            <div key={index} className="relative w-full h-full flex-shrink-0">
              <Image
                src={src}
                alt={`Portfolio image ${index + 1}`}
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, 760px"
                className="object-cover object-center"
              />
            </div>
          ))}
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
