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
                    I'm a full-stack developer with a decade of experience delivering production grade web applications. After refining large scale platforms at S&amp;P Global, my current responsibilities include keeping banking software dependable as a Level&nbsp;2 Engineer at Data Center Inc. (DCI), expanding UMail with privacy-first features, and managing ApplyPro, a platform that helps users strengthen resumes and cover letters.
                  </p>

                  <p>
                    After months of data research and user feedback, I'm rolling out ApplyPro V2, even if progress is slower while juggling a full-time day job. This release introduces interactive interview prep questions, sticky behavior for quick access, a cleaner, more intuitive user portal, and enhanced resume editing features, all crafted to streamline your job application process while keeping your data private.
                  </p>

                  <p>
                    Within UMail, I'm rolling out custom editions tailored to our clients needs, adding tools such as quick tone adjustments, one-click translations, and considerate auto-replies features designed to save time without compromising privacy.
                  </p>

                  <p>
                  I build lean, privacy tight software that just works. From polishing the user flow to crushing the hard bugs, I move fast and finish strong. Need results, not excuses? Let's talk.
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
                  {/* <Zoltars /> */}
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