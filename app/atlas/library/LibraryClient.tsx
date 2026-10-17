"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Search, X } from "lucide-react";
import { ATLAS_PROJECTS } from "@/utils/geo/projects";
import { searchTerm } from "@/utils/geo/library";
import { useLibrary } from "@/utils/geo/useLibrary";
import "@/components/atlas/atlas-hub.css";

/* ------------------------------------------------------------------ */
/*  /atlas/library — the documents behind the maps. Search hits the    */
/*  Firestore index (`terms` array-contains the first word); extra     */
/*  words narrow the results here.                                     */
/* ------------------------------------------------------------------ */

export default function LibraryClient() {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const words = useDeferredValue(query).split(/\s+/).map(searchTerm).filter((w) => w.length >= 3);
  const { docs, error, loading } = useLibrary({ term: words[0], project: project ?? undefined });

  const shown = useMemo(
    () => (docs ?? []).filter((d) => words.slice(1).every((w) => d.terms?.includes(w))).sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs, words.join(" ")]
  );
  const projectTitle = (slug: string) => ATLAS_PROJECTS.find((p) => p.slug === slug)?.title ?? slug;
  const usedProjects = ATLAS_PROJECTS.filter((p) => p.status === "live" || (docs ?? []).some((d) => d.projects.includes(p.slug)));

  return (
    <div className="atlas-page space-y-8 pb-16 pt-10 sm:pt-14">
      <header className="max-w-2xl">
        <Link href="/atlas" className="atlas-eyebrow inline-flex items-center gap-1.5 font-mono text-xs text-indigo-500 transition-colors hover:text-indigo-600 dark:text-indigo-300">
          <ArrowLeft className="h-3.5 w-3.5" /> ~/atlas
        </Link>
        <h1 className="mt-4 font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">Library</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          The papers behind the maps — public-domain USGS fact sheets and professional papers, hosted here and searchable down to the text inside them.
        </p>
      </header>

      <div className="space-y-3">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the text — tsunami, subduction, 1906, caldera…"
            className="w-full rounded-2xl border border-slate-200 bg-white/80 py-3 pl-10 pr-10 text-sm text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[null, ...usedProjects.map((p) => p.slug)].map((slug) => (
            <button
              key={slug ?? "all"}
              type="button"
              onClick={() => setProject(slug)}
              className={`rounded-full px-3 py-1 text-xs ring-1 transition-colors ${
                project === slug
                  ? "bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white"
                  : "text-slate-500 ring-slate-200 hover:text-slate-900 dark:text-slate-400 dark:ring-white/10 dark:hover:text-white"
              }`}
            >
              {slug ? projectTitle(slug) : "All projects"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          The library index couldn&apos;t be read — {error} If you just set the atlas up, the Firestore rules for <code>geoDocs</code> still need deploying.
        </p>
      )}
      {loading && !docs && <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Opening the stacks…</p>}

      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((d) => (
          <li key={d.id} className="flex flex-col rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-300">
                <FileText className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{d.title}</h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  {[d.source, d.year, d.pages ? `${d.pages} pages` : null, d.bytes ? `${(d.bytes / 1048576).toFixed(1)} MB` : null, d.license].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            {d.authors.length > 0 && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{d.authors.join(", ")}</p>}
            {d.summary && <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{d.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-1">
              {d.projects.map((p) => (
                <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                  {projectTitle(p)}
                </span>
              ))}
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              {d.fileUrl && (
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600">
                  <FileText className="h-3.5 w-3.5" /> Open PDF
                </a>
              )}
              {d.sourceUrl && (
                <a
                  href={d.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Original
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {docs && !shown.length && <p className="text-sm text-slate-400">Nothing matches {query ? `“${query}”` : "yet"}.</p>}
    </div>
  );
}
