"use client";
import { useState, useEffect } from 'react';
import Hero from '@/components/hero';
import WidgetWeather from '@/components/widget-weather';
import WidgetNews from '@/components/widget-news';
import CryptoWidget from '@/components/widget-crypto';
import WidgetSearch from '@/components/widget-search';
import Zoltars from '@/components/widget-zoltar';
import Image from 'next/image';
import StockWidget from '@/app/stocks/stock/LiveStreamTickerWidget';

// Import your images
import HeroImage from '@/public/images/pumpkin.jpg';
import SecondImage from '@/public/images/cabin.jpg';
import ThirdImage from '@/public/images/wedding.jpg';

const images = [HeroImage, SecondImage, ThirdImage];

export default function AboutPage() {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prevImage) => (prevImage + 1) % images.length);
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
            <section>
              <div className="overflow-hidden relative rounded-lg">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentImage * 100}%)` }}
                >
                  {images.map((src, index) => (
                    <Image
                      key={index}
                      className="flex-shrink-0"
                      src={src}
                      alt={`Slider Image ${index + 1}`}
                      priority={index === 0}
                    />
                  ))}
                </div>
              </div>

              {/* Page content */}
              <div className="text-slate-500 dark:text-slate-400 space-y-8">
                <div className="space-y-4">
                  <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">
                    Short Bio
                  </h2>
                  <p>
                    A developer who’s been building web apps for the past 10 years. I spent years at S&P Global as a Senior Software Engineer, and now I’m focused on U-Mail and ApplyPro, tools that help people write better and apply smarter.
                  </p>
                  <p>
                    I like simple solutions, privacy-first design, and software that just works. Whether it’s refining user experiences or solving tricky problems, I build with efficiency and usability in mind. Need a developer who gets things done? Let’s talk.
                  </p>
                  <StockWidget />
                  <div className="p-2">
                    <p className="text-xs text-gray-500 text-center">
                      See more stock market data{" "}
                      <a href="/stocks" className="text-indigo-500 underline">
                        here
                      </a>
                      .
                    </p>
                  </div>
                  <Zoltars />
                </div>
              </div>
            </section>
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