"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

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
import Icon09 from "@/public/images/art-icon.jpg";
import Icon12 from "@/public/images/project-icon-03.svg";
import WorldIcon from "@/public/images/world.png";
import CharlesIcon from "@/public/images/charles-icon.svg";
import FightWorldIcon from "@/public/images/fight-world-icon.svg";

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
    id: 18,
    icon: FightWorldIcon,
    slug: "/marvel-fight-world",
    title: "Fight World",
    excerpt:
      "An arcade fighting game with 270+ Marvel characters: combos, specials, ultimates, CPU opponents, local 2-player, tournaments and an explorable world.",
    badge: "Canvas Game Engine",
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
    title: "Cleveland Museum of Art",
    excerpt: "Wander a gallery of public-domain masterpieces and search 41,000+ works.",
    badge: "CMA Open Access",
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
  {
    id: 17,
    icon: WorldIcon,
    slug: "/day-out",
    title: "Day Out",
    excerpt: "Find something fun to do today around South East Queensland using live events, weather, surf, road conditions and local information.",
    badge: "LIVE DATA + AI + MAPS",
  },
];


  const handleProjectClick = (item: ProjectItem, category: string) => {
    trackEvent("Project Clicked", {
      title: item.title,
      slug: item.slug,
      category,
    });
  };

  const liveCount = items02.filter((i) => !/^https?:\/\//i.test(i.slug)).length;
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? items02.filter((i) => `${i.title} ${i.excerpt} ${i.badge ?? ""} ${i.slug}`.toLowerCase().includes(q)) : items02;
  }, [filter, items02]);

  return (
    <div className="relative isolate w-full pb-20 pt-10 sm:pt-14">
      {/* Backdrop: fine grid squares + aurora, same as the dashboards */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] text-slate-300/70 dark:text-white/[0.07] [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_72%)]"
        style={{
          backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-72 w-[46rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-300/25 via-indigo-300/25 to-rose-300/25 blur-3xl dark:from-emerald-500/10 dark:via-indigo-500/15 dark:to-rose-500/10"
      />

      {/* Header */}
      <header className="mb-12 max-w-2xl">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="text-indigo-500 dark:text-indigo-300">
            ~/projects<span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-current" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {liveCount} live
          </span>
        </div>
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
          <SectionLabel index="02" title="Lab" note="Experiments & live-data playgrounds">
            <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 backdrop-blur transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] dark:border-white/10 dark:bg-white/[0.04] sm:w-56">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" aria-label="Filter projects"
                className="w-full bg-transparent font-mono text-[12px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200" />
              {filter && <button type="button" onClick={() => setFilter("")} aria-label="Clear filter" className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="h-3.5 w-3.5" /></button>}
            </label>
          </SectionLabel>
          {shown.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center font-mono text-xs text-slate-400 dark:border-white/10">Nothing matches “{filter}”.</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item, i) => (
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

function SectionLabel({ index, title, note, children }: { index: string; title: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <span className="font-mono text-[11px] text-indigo-500 dark:text-indigo-300">{index}</span>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {note && <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">{note}</span>}
      <span className="hidden h-px min-w-8 flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-white/10 sm:block" />
      {children}
    </div>
  );
}
