import type { Metadata } from "next";
import Link from "next/link";
import { Anchor, ArrowUpRight, BookOpen, CloudLightning, Compass, Globe2, History, MapPin, Mountain, Pickaxe, Radar, Waypoints, type LucideIcon } from "lucide-react";
import { ATLAS_PROJECTS } from "@/utils/geo/projects";
import "@/components/atlas/atlas-hub.css";

export const metadata: Metadata = {
  title: "Atlas | Interactive maps from public GIS data",
  description: "Interactive maps built on free USGS, NOAA, Smithsonian and other public geographic data — starting with Earth Alive.",
};

/* ------------------------------------------------------------------ */
/*  /atlas — hub for the map projects.                                 */
/* ------------------------------------------------------------------ */
const projectIcons: Record<string, { icon: LucideIcon; color: string }> = {
  "earth-alive": { icon: Globe2, color: "text-orange-600 dark:text-orange-300" },
  "disaster-atlas": { icon: CloudLightning, color: "text-rose-600 dark:text-rose-300" },
  "strange-earth": { icon: Radar, color: "text-violet-600 dark:text-violet-300" },
  "hidden-earth": { icon: Compass, color: "text-emerald-600 dark:text-emerald-300" },
  "underground-usa": { icon: Mountain, color: "text-indigo-600 dark:text-indigo-300" },
  shipwrecks: { icon: Anchor, color: "text-sky-600 dark:text-sky-300" },
  "fossil-atlas": { icon: Globe2, color: "text-lime-700 dark:text-lime-300" },
  "lost-mines": { icon: Pickaxe, color: "text-amber-700 dark:text-amber-300" },
  "ghost-towns": { icon: MapPin, color: "text-stone-600 dark:text-stone-300" },
  "forgotten-infrastructure": { icon: Waypoints, color: "text-blue-600 dark:text-blue-300" },
  "america-through-time": { icon: History, color: "text-red-600 dark:text-red-300" },
};

export default function AtlasPage() {
  const live = ATLAS_PROJECTS.filter((p) => p.status === "live");
  const planned = ATLAS_PROJECTS.filter((p) => p.status === "planned");

  return (
    <div className="atlas-page space-y-10 pb-16 pt-10 sm:pt-14">
      <header className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="text-indigo-500 dark:text-indigo-300">~/atlas</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" /> {live.length} live
          </span>
        </div>
        <h1 className="mt-4 font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">Atlas</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          Interactive maps built on free public geographic data — USGS, NOAA, the Smithsonian and more — stitched together into experiences that
          don&apos;t exist in one place anywhere else. Every layer says where it came from.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-white"><span className="font-mono text-[11px] text-indigo-500 dark:text-indigo-300">01</span> Live maps<span aria-hidden className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" /></h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {live.map((p, index) => {
            const Icon = projectIcons[p.slug]?.icon ?? Compass;
            return <Link
              key={p.slug}
              href={`/atlas/${p.slug}`}
              className="group flex min-h-[206px] flex-col rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-slate-300 hover:shadow-[0_12px_26px_-18px_rgba(15,23,42,0.28)] motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:border-white/20 dark:hover:shadow-[0_12px_28px_-18px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                  <span className="font-mono text-[11px] tracking-wider">{String(index + 1).padStart(2, "0")}</span>
                  <span aria-hidden className="h-px w-5 bg-slate-200 dark:bg-white/10" />
                  <Icon aria-hidden className="h-[17px] w-[17px] text-slate-500 transition-colors group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300" strokeWidth={1.7} />
                </span>
                <ArrowUpRight aria-hidden className="h-4 w-4 text-slate-400 transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-300" />
              </div>
              <h3 className="mt-6 font-aspekta text-[22px] font-[650] leading-tight tracking-tight text-slate-900 dark:text-white">{p.title}</h3>
              <p className="mt-2 line-clamp-2 text-[13.5px] leading-[1.55] text-slate-600 dark:text-slate-400">{p.tagline}</p>
              <p className="mt-auto truncate border-t border-slate-100 pt-4 font-mono text-[10px] uppercase tracking-wide text-slate-400 dark:border-white/[0.07] dark:text-slate-500">{p.sources.join(" · ")}</p>
            </Link>
          })}
        </div>
      </section>

      <Link
        href="/atlas/library"
        className="atlas-card group flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white/80 px-5 py-4 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
      >
        <span className="atlas-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white to-slate-100 text-indigo-600 ring-1 ring-slate-200/80 dark:from-white/[0.08] dark:to-white/[0.02] dark:text-indigo-300 dark:ring-white/10"><BookOpen aria-hidden className="h-5 w-5" strokeWidth={1.8} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-white">The library</span>
          <span className="block text-sm text-slate-500 dark:text-slate-400">Explore the research and reports behind the maps.</span>
        </span>
        <ArrowUpRight className="atlas-card-arrow h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      </Link>

      <section className="space-y-3">
        <h2 className="flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-white"><span className="font-mono text-[11px] text-indigo-500 dark:text-indigo-300">02</span> On the drawing board<span aria-hidden className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" /></h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {planned.map((p) => {
            const Icon = projectIcons[p.slug]?.icon ?? Compass;
            const iconColor = projectIcons[p.slug]?.color ?? "text-indigo-600 dark:text-indigo-300";
            return <div key={p.slug} className="atlas-draft rounded-2xl border border-dashed border-slate-200 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[0.02]">
              <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 ring-1 ring-slate-200/80 dark:bg-white/[0.05] dark:ring-white/10 ${iconColor}`}><Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
              <h3 className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{p.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{p.tagline}</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">{p.sources.join(" · ")}</p>
            </div>
          })}
        </div>
      </section>
    </div>
  );
}
