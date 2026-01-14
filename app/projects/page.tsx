"use client";

import { useEffect } from "react";
import ProjectCard from "./project-card";

import Icon01 from "@/public/images/hmbco.png";
import Icon02 from "@/public/images/project-icon-02.svg";
import Icon12 from "@/public/images/project-icon-03.svg";
import Icon03 from "@/public/images/the-new-york-stock-exchange-seeklogo.png";
import Icon04 from "@/public/images/project-icon-04.svg";
import Icon5 from "@/public/images/project-icon-05.svg";
import Icon05 from "@/public/images/s-h-i-e-l-d-seeklogo.png";
import Icon06 from "@/public/images/project-icon-06.svg";
import Icon07 from "@/public/images/bitcoin-seeklogo.png";
import Icon08 from "@/public/images/nasa-seeklogo.png";
import Icon09 from "@/public/images/aic.png";
import Icon10 from "@/public/images/spacex-logo.svg";

import { trackEvent } from "@/utils/mixpanel";

interface ProjectItem {
  id: number;
  icon: any;
  slug: string;
  title: string;
  excerpt: string;
  openSource?: boolean;
  badge?: string;
}

export default function Projects() {
  useEffect(() => {
    trackEvent("Projects Page Viewed", { page: "Projects" });
  }, []);

  const items01: ProjectItem[] = [
    {
      id: 0,
      icon: Icon01,
      slug: "https://holdmybeer.info",
      title: "HoldMyBeer.info",
      excerpt:
        "Hold My Beer CO focuses on privacy and security. Apps like ApplyPro and UMail live here, along with custom tools used daily.",
      badge: "Company",
    },
  ];

  const items02: ProjectItem[] = [
    {
      id: 4,
      icon: Icon07,
      slug: "/Crypto",
      title: "Crypto Market Data",
      excerpt: "Live prices, charts, movers, and market snapshots.",
    },
    {
      id: 0,
      icon: Icon03,
      slug: "/stocks",
      title: "Stock Market Data",
      excerpt: "Heatmaps, quotes, earnings, IPOs, and live-ish dashboards.",
    },
    {
      id: 10,
      icon: Icon02,
      slug: "/news",
      title: "Latest News",
      excerpt: "Headlines pulled from multiple feeds and APIs.",
    },
    {
      id: 1,
      icon: Icon04,
      slug: "/Country",
      title: "Country Search",
      excerpt: "Search any country and get clean, useful info fast.",
    },
    {
      id: 5,
      icon: Icon08,
      slug: "/ISS",
      title: "Track the ISS",
      excerpt: "Watch the ISS move around the planet in real time.",
    },
    {
      id: 11,
      icon: Icon12,
      slug: "/search",
      title: "AI Search Engine",
      excerpt: "Search that gets to the point.",
    },
    {
      id: 13,
      icon: Icon04,
      slug: "/PrettyPrint",
      title: "AI JSON/XML Prettifier",
      excerpt:
        "Paste messy JSON/XML and get formatted output with helpful corrections.",
    },
    {
      id: 7,
      icon: Icon09,
      slug: "/Art",
      title: "Art Institute of Chicago",
      excerpt: "A clean UI on top of the AIC open API.",
    },
    // {
    //   id: 9,
    //   icon: Icon10,
    //   slug: "/Spacex",
    //   title: "SpaceX API stuff",
    //   excerpt:
    //     "Fun SpaceX project. Older data + an unmaintained API (still cool).",
    // },
    {
      id: 12,
      icon: Icon06,
      slug: "/Weather",
      title: "Local Weather",
      excerpt: "Hourly charts, 7-day forecasts, and weather details.",
    },
    {
      id: 3,
      icon: Icon06,
      slug: "/Bored",
      title: "Bored?",
      excerpt: "Quick ideas and activities using free APIs.",
    },
    {
      id: 14,
      icon: Icon5,
      slug: "https://epstein-library-search.vercel.app/",
      title: "Epstein Files Library",
      excerpt:
        "Search DOJ, FBI, and House Oversight docs related to Epstein investigations.",
      badge: "Big Data",
    },
     {
      id: 6,
      icon: Icon08,
      slug: '/NASA',
      title: 'NASA API',
      excerpt:
        'NASA photo of the day, Mars rover photos, and other space data.',
      openSource: false,
    },

        /*
    {
      id: 2,
      icon: Icon05,
      slug: '/Marvel',
      title: 'Marvel API',
      excerpt:
        'Lookup comics, characters, creators, events, series, and stories using the Marvel public API.',
      openSource: false,
    },
    {
      id: 6,
      icon: Icon08,
      slug: '/NASA',
      title: 'NASA API',
      excerpt:
        'NASA photo of the day, Mars rover photos, and other space data.',
      openSource: false,
    },
    {
      id: 8,
      icon: Icon5,
      slug: '/Vibroacoustics',
      title: 'Vibroacoustics & Geometry',
      excerpt:
        "Reveal geometry’s beauty through vibrating patterns and higher-dimensional forms. (Contains flashing lights.)",
      openSource: false,
    },
    */

  ];

  const handleProjectClick = (item: ProjectItem, category: string) => {
    trackEvent("Project Clicked", {
      title: item.title,
      slug: item.slug,
      category,
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:pt-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          Things I’ve built
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-gray-600 dark:text-white/60">
          Side projects, experiments, and tools I actually use.
        </p>
      </div>

      <div className="space-y-10">
        {/* Company */}
        <section className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Company Founded
              </h2>

            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {items01.map((item) => (
              <ProjectCard
                key={item.slug}
                item={item}
                onClick={() => handleProjectClick(item, "Company Founded")}
              />
            ))}
          </div>
        </section>

        {/* Portfolio */}
        <section className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Fun Dev Portfolio Stuff
              </h2>

            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items02.map((item) => (
              <ProjectCard
                key={item.slug}
                item={item}
                onClick={() => handleProjectClick(item, "Fun Dev Portfolio Stuff")}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
