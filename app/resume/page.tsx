"use client";

import { useEffect } from "react";
import Education from "@/components/education";
import Experience from "@/components/experience";
import { WidgetSkills, SKILLS_DATA } from "@/components/widget-skills";
import { trackEvent } from "@/utils/mixpanel";
import DownloadPDF from "./downlaodPDF";

/* ------------------------------------------------------------------ */
/*  ResumePage Component                                               */
/* ------------------------------------------------------------------ */
export default function ResumePage() {
  useEffect(() => {
    trackEvent("Resume Page Viewed", { page: "Resume" });
  }, []);

  return (
    <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">
      <div className="grow">
        <div className="max-w-[700px]">
          <section>
            <h1 className="h1 font-aspekta mb-12">My resume</h1>
            <div className="text-slate-500 dark:text-slate-400 space-y-12">
              <Experience />
              <Education />
              <DownloadPDF />
            </div>
          </section>
        </div>
      </div>

      <aside className="md:w-[240px] lg:w-[300px] shrink-0">
        <div className="space-y-10">
          {SKILLS_DATA.map((category) => (
            <WidgetSkills
              key={category.title}
              title={category.title}
              skills={category.skills}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}
