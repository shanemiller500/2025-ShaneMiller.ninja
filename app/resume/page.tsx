"use client";

import { useEffect } from "react";
import Education from "@/app/resume/education";
import Experience from "@/app/resume/experience";
import { WidgetSkills, SKILLS_DATA } from "./widget-skills";
import { trackEvent } from "@/utils/mixpanel";
import DownloadPDF from "./downlaodPDF";
import resumeContent from "./content.json";

/* ------------------------------------------------------------------ */
/*  ResumePage Component                                               */
/* ------------------------------------------------------------------ */
export default function ResumePage() {
  useEffect(() => {
    trackEvent("Resume Page Viewed", { page: "Resume" });
  }, []);

  const { trilon } = resumeContent;

  return (
    <div className="relative isolate pb-16 pt-8 sm:pt-12 md:pb-20">
      {/* Backdrop: fine grid + aurora, same as the dashboards */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] text-slate-300/70 dark:text-white/[0.07] [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_72%)]"
        style={{
          backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-72 w-[46rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-300/25 via-indigo-300/25 to-rose-300/25 blur-3xl dark:from-emerald-500/10 dark:via-indigo-500/15 dark:to-rose-500/10" />

      <div className="space-y-8 md:flex md:space-x-8 md:space-y-0">
        <div className="grow">
          <div className="max-w-[700px]">
            {/* Header */}
            <header className="mb-12">
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                <span className="text-indigo-500 dark:text-indigo-300">~/resume</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Now · {trilon.title}
                </span>
              </div>
              <h1 className="mt-4 font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">My resume</h1>
              <p className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">{resumeContent.headline}</p>
              <p className="mt-3 leading-relaxed text-slate-500 dark:text-slate-400">{resumeContent.summary}</p>
              <div className="mt-6">
                <DownloadPDF compact />
              </div>
            </header>

            <div className="space-y-14">
              <Experience />
              <Education />
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200/70 bg-white/70 px-6 py-8 text-center dark:border-white/[0.08] dark:bg-white/[0.02]">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">The full story, one page</p>
                <DownloadPDF />
              </div>
            </div>
          </div>
        </div>

        <aside className="shrink-0 md:w-[240px] lg:w-[300px]">
          <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Skills · {SKILLS_DATA.reduce((n, c) => n + c.skills.length, 0)}
          </p>
          <div className="space-y-8">
            {SKILLS_DATA.map((category) => (
              <WidgetSkills key={category.title} title={category.title} skills={category.skills} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
