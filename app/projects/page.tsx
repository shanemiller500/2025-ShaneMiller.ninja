"use client";

import { useEffect } from "react";

import { trackEvent } from "@/utils/mixpanel";
import ProjectCard, { type ProjectItem } from "./project-card";

import Icon01 from "@/public/images/hmbco.png";
import Icon02 from "@/public/images/project-icon-02.svg";
import Icon03 from "@/public/images/the-new-york-stock-exchange-seeklogo.png";
import Icon04 from "@/public/images/project-icon-04.svg";
import Icon05 from "@/public/images/project-icon-01.svg";
import Icon5 from "@/public/images/project-icon-05.svg";
import Icon07 from "@/public/images/bitcoin-seeklogo.png";
import Icon08 from "@/public/images/nasa-seeklogo.png";
import Icon09 from "@/public/images/aic.png";
import Icon12 from "@/public/images/project-icon-03.svg";
import WorldIcon from "@/public/images/world.png";
import CharlesIcon from "@/public/images/charles-icon.svg";

/* ------------------------------------------------------------------ */
/*  ProjectsPage Component                                             */
/* ------------------------------------------------------------------ */
export default function ProjectsPage() {
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
    badge: "CoinCap API",
  },
  {
    id: 0,
    icon: Icon03,
    slug: "/stocks",
    title: "Stock Market Data",
    excerpt: "Heatmaps, quotes, earnings, IPOs, and live-ish dashboards.",
    badge: "Finnhub API",
  },
  {
    id: 10,
    icon: Icon02,
    slug: "/news",
    title: "Latest News",
    excerpt: "Headlines pulled from multiple feeds and APIs.",
    badge: "RSS + News APIs",
  },
  {
    id: 1,
    icon: Icon04,
    slug: "/Country",
    title: "Country Search",
    excerpt: "Country info, live flight search, and real booking links with no hidden fees.",
    badge: "LLM + REST Countries API",
  },
  {
    id: 5,
    icon: Icon08,
    slug: "/ISS",
    title: "Track the ISS",
    excerpt: "Watch the ISS move around the planet in real time.",
    badge: "Open Notify API",
  },
  {
    id: 11,
    icon: Icon12,
    slug: "/search",
    title: "AI Search Engine",
    excerpt: "Search that gets to the point.",
    badge: "LLM + Web",
  },
  {
    id: 13,
    icon: Icon05,
    slug: "/PrettyPrint",
    title: "AI JSON/XML Prettifier",
    excerpt:
      "Paste messy JSON/XML and get formatted output with helpful corrections.",
    badge: "AI + Parser",
  },
  {
    id: 16,
    icon: CharlesIcon,
    slug: "/Charles",
    title: "Charles the AI Dog",
    excerpt:
      "A sassy, genius, talking robot version of my dog. Barks at the wind mid-sentence, steals the kids' food, refuses to fetch.",
    badge: "OpenAI + Voice",
  },
  {
    id: 7,
    icon: Icon09,
    slug: "/Art",
    title: "Art Institute of Chicago",
    excerpt: "A clean UI on top of the AIC open API.",
    badge: "AIC API",
  },

  // {
  //   id: 9,
  //   icon: Icon10,
  //   slug: "/Spacex",
  //   title: "SpaceX API stuff",
  //   excerpt:
  //     "Fun SpaceX project. Older data + an unmaintained API (still cool).",
  //   badge: "SpaceX-API",
  // },

  // {
  //   id: 12,
  //   icon: Icon11,
  //   slug: "/Weather",
  //   title: "Local Weather",
  //   excerpt: "Hourly charts, 7-day forecasts, and weather details.",
  //   badge: "Weather API",
  // },
  // {
  //   id: 3,
  //   icon: Icon06,
  //   slug: "/Bored",
  //   title: "Bored?",
  //   excerpt: "Quick ideas and activities using free APIs.",
  //   badge: "Free APIs",
  // },
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
    id: 15,
    icon: WorldIcon,
    slug: "https://historical-explorer.vercel.app/",
    title: "Historical Explorer",
    excerpt:
      "A work-in-progress map for exploring historical locations, events, archives, and cultural sources together in one place.",
    badge: "Work in Progress",
  },
  {
    id: 6,
    icon: Icon08,
    slug: "/NASA",
    title: "NASA API",
    excerpt: "NASA photo of the day, Mars rover photos, and other space data.",
    badge: "NASA APIs",
    openSource: false,
  },

  /*
  {
    id: 2,
    icon: Icon05,
    slug: "/Marvel",
    title: "Marvel API",
    excerpt:
      "Lookup comics, characters, creators, events, series, and stories using the Marvel public API.",
    badge: "Marvel API",
    openSource: false,
  },
  {
    id: 8,
    icon: Icon5,
    slug: "/Vibroacoustics",
    title: "Vibroacoustics & Geometry",
    excerpt:
      "Reveal geometry’s beauty through vibrating patterns and higher-dimensional forms. (Contains flashing lights.)",
    badge: "WebGL / Canvas",
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

  const liveCount = items02.filter((i) => !/^https?:\/\//i.test(i.slug)).length;

  return (
    <div className="relative isolate w-full pb-20 pt-10 sm:pt-14">
      {/* Dot-grid backdrop, faded out toward the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] text-slate-300 dark:text-white/10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/3 -z-10 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-300/30 via-sky-200/30 to-violet-300/30 blur-3xl dark:from-indigo-500/10 dark:via-cyan-400/10 dark:to-violet-500/10"
      />

      {/* Header */}
      <header className="mb-12 max-w-2xl">
        <p className="font-mono text-xs text-indigo-500 dark:text-indigo-300">
          ~/projects<span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-current" />
        </p>
        <h1 className="mt-4 font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">
          Things I&rsquo;ve built
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          Side projects, experiments, and tools I actually use. Most of them run on live APIs,
          and some have an LLM inside.
        </p>

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs">
          {[
            { k: "projects", v: items01.length + items02.length },
            { k: "live on this site", v: liveCount },
            { k: "company", v: items01.length },
          ].map((stat) => (
            <div key={stat.k} className="flex items-baseline gap-2">
              <dt className="order-2 uppercase tracking-wider text-slate-400 dark:text-slate-500">{stat.k}</dt>
              <dd className="order-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {String(stat.v).padStart(2, "0")}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="space-y-14">
        {/* Company */}
        <section>
          <SectionLabel index="01" title="Company founded" />
          {items01.map((item) => (
            <ProjectCard
              key={item.slug}
              item={item}
              featured
              onClick={() => handleProjectClick(item, "Company Founded")}
            />
          ))}
        </section>

        {/* Portfolio */}
        <section>
          <SectionLabel index="02" title="Lab" note="Experiments & live-data playgrounds" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items02.map((item, i) => (
              <ProjectCard
                key={item.slug}
                item={item}
                index={i}
                onClick={() => handleProjectClick(item, "Fun Dev Portfolio Stuff")}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="font-mono text-[11px] text-indigo-500 dark:text-indigo-300">{index}</span>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {note && <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">{note}</span>}
      <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-white/10" />
    </div>
  );
}
