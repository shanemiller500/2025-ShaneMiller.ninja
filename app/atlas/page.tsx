import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ATLAS_PROJECTS } from "@/utils/geo/projects";

export const metadata: Metadata = {
  title: "Atlas | Interactive maps from public GIS data",
  description: "Interactive maps built on free USGS, NOAA, Smithsonian and other public geographic data — starting with Earth Alive.",
};

/* ------------------------------------------------------------------ */
/*  /atlas — hub for the map projects.                                 */
/* ------------------------------------------------------------------ */
export default function AtlasPage() {
  const live = ATLAS_PROJECTS.filter((p) => p.status === "live");
  const planned = ATLAS_PROJECTS.filter((p) => p.status === "planned");

  return (
    <div className="space-y-10 pb-16 pt-8 sm:pt-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs text-indigo-500 dark:text-indigo-300">~/atlas</p>
        <h1 className="mt-4 font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">Atlas</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          Interactive maps built on free public geographic data — USGS, NOAA, the Smithsonian and more — stitched together into experiences that
          don&apos;t exist in one place anywhere else. Every layer says where it came from.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Live</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {live.map((p) => (
            <Link
              key={p.slug}
              href={`/atlas/${p.slug}`}
              className="group relative isolate overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 transition-colors hover:border-indigo-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-indigo-400/40"
            >
              <div aria-hidden className={`absolute -right-10 -top-16 -z-10 h-44 w-44 rounded-full bg-gradient-to-br blur-2xl ${p.glow}`} />
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-indigo-500" />
              </div>
              <h3 className="mt-4 font-aspekta text-2xl font-[650] text-slate-900 dark:text-white">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{p.tagline}</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-slate-400">{p.sources.join(" · ")}</p>
            </Link>
          ))}
        </div>
      </section>

      <Link
        href="/atlas/library"
        className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 transition-colors hover:border-indigo-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-indigo-400/40"
      >
        <span>
          <span className="block font-semibold text-slate-900 dark:text-white">The library</span>
          <span className="block text-sm text-slate-500 dark:text-slate-400">The USGS papers behind the maps — hosted here, searchable down to the text inside them.</span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-indigo-500" />
      </Link>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-slate-400">On the drawing board</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {planned.map((p) => (
            <div key={p.slug} className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-white/10">
              <h3 className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{p.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{p.tagline}</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">{p.sources.join(" · ")}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
