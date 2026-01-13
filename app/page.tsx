"use client";

import { useState, useEffect } from "react";
import Hero from "@/components/hero";
import WidgetWeather from "@/components/widget-weather";
import WidgetNews from "@/components/widget-news";
import CryptoWidget from "@/components/widget-crypto";
import WidgetSearch from "@/components/widget-search";
import Image from "next/image";
import StockWidget from "@/app/stocks/stock/LiveStreamTickerWidget";
import FlightSearch from "./Country/FlightSearch";

import HeroImage from "@/public/images/pumpkin.jpg";
import SecondImage from "@/public/images/cabin.jpg";
import ThirdImage from "@/public/images/winter.jpg";
import FourthImage from "@/public/images/fiji.jpg";
import FifthImage from "@/public/images/couch.jpg";

const images = [HeroImage, SecondImage, ThirdImage, FourthImage, FifthImage];

export default function AboutPage() {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Hero />

      {/* Content */}
      <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pb-16 md:pb-20">
        <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">
          {/* Middle area */}
          <div className="grow">
            <div className="max-w-[760px]">
              <section>
                {/* Image slider — bigger, no crop */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900">
                  {/* Taller frame so images feel substantial */}
                  <div className="relative w-full aspect-[3/2] bg-gray-50 dark:bg-brand-900">
                    <div
                      className="absolute inset-0 flex transition-transform duration-500 ease-in-out"
                      style={{ transform: `translateX(-${currentImage * 100}%)` }}
                    >
                      {images.map((src, index) => (
                        <div
                          key={index}
                          className="relative w-full h-full flex-shrink-0"
                        >
                          <Image
                            src={src}
                            alt={`About image ${index + 1}`}
                            fill
                            priority={index === 0}
                            sizes=""
                             className="object-cover object-center"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Dots */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImage(i)}
                          aria-label={`Go to slide ${i + 1}`}
                          className={`h-2.5 w-2.5 rounded-full transition ring-1 ring-black/30 dark:ring-white/30 ${
                            i === currentImage
                              ? "bg-gray-900 dark:bg-brand-900"
                              : "bg-gray-900/30 hover:bg-gray-900/50 dark:bg-brand-900 dark:hover:bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Page content */}
                <div className="text-slate-500 dark:text-slate-400 space-y-8 pt-10">
                  <div className="space-y-4">
                    <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">
                      Short Bio
                    </h2>

                    <p>
                      I’m a full-stack developer with over a decade of experience building,
                      maintaining, and supporting production web applications. I’ve worked
                      on large-scale platforms at S&amp;P Global, and today I help keep
                      mission-critical banking software stable and dependable at Data Center Inc.
                    </p>

                    <p>
                      Outside of my day job, I build privacy-first products like ApplyPro
                      and UMail. I enjoy working on tools that solve real problems, respect
                      users, and don’t do anything sketchy with their data.
                    </p>

                    <p>
                      I care a lot about clean UX, straightforward architecture, and
                      finishing what I start. I’m not chasing hype, I just like building
                      things that work and improving them over time.
                    </p>

                    <p>
                      If you’re looking for someone practical, steady, and easy to work
                      with, I’m always happy to talk.
                    </p>

                    <p className="text-xs text-gray-500 text-center pb-10">
                      See resume{" "}
                      <a href="/resume" className="text-indigo-500 underline">
                        here
                      </a>
                    </p>

                    <StockWidget />
                      <FlightSearch full={null} />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Right sidebar */}
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
