"use client";
import { useState, useEffect } from 'react';
import Hero from '@/components/hero';
import WidgetWeather from '@/components/widget-weather';
import WidgetNews from '@/components/widget-news';
import CryptoWidget from '@/components/widget-crypto';
import WidgetSearch from '@/components/widget-search';
import Image from 'next/image';
import StockWidget from '@/app/stocks/stock/LiveStreamTickerWidget';
import FlightSearch from './Country/FlightSearch';
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
          <div className="max-w-[700px]">
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
              <div className="text-slate-500 dark:text-slate-400 space-y-8 pt-10">
                <div className="space-y-4">
                  <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">
                    Short Bio
                  </h2>
               <p>
  I’m a full-stack developer with 10+ years of experience shipping production grade web applications. I’ve worked on large scale platforms at S&amp;P Global and currently keep mission-critical banking software reliable as an Engineer at Data Center Inc. (DCI). Alongside that, I build and run privacy-first products like UMail and ApplyPro.
</p>

<p>
  ApplyPro V2 is my latest release built from real user feedback. It adds interactive interview prep, a cleaner portal, smarter resume editing, and fast access tools designed to help people apply better, faster, and with their data kept private.
</p>

<p>
  With UMail, I focus on practical automation: tone adjustments, one click translations, and thoughtful auto replies that save time without sacrificing trust.
</p>

<p>
  I build lean, privacy-tight software that works. I care about clean UX, solid architecture, and finishing what I start. If you’re looking for someone who delivers not hand-waving, let’s talk.
</p>


                  <p className="text-xs text-gray-500 text-center pb-10">
                      See resume {" "}
                      <a href="/resume" className="text-indigo-500 underline">
                        here
                      </a>
                      
                    </p>

                  <StockWidget />
                  
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
               <FlightSearch full={null} />
              <WidgetNews />
            
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}