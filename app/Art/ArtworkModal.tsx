/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Landmark, Maximize2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { type Artwork } from "./lib";

// The artwork, big, on a dark "gallery wall", with the museum label beside it.
export default function ArtworkModal({ artwork: a, onClose }: { artwork: Artwork | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const full = a?.imageLarge || "";
  const about = a?.description;

  function copy() {
    navigator.clipboard?.writeText(full).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <Modal open={!!a} onClose={onClose} labelledBy="art-title" size="xl" accent="#f59e0b">
      {a && (
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:overflow-hidden">
          {/* Gallery wall */}
          <div className="relative flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#2a2724,#0e0d0c_70%)] p-6 sm:p-10 lg:min-h-[70vh]">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(255,236,200,0.18),transparent_70%)]" />
            <img
              src={a.image}
              alt={a.title}
              className="relative max-h-[60vh] w-auto max-w-full bg-[#1c1a17] object-contain shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] ring-[10px] ring-[#1c1a17] outline outline-2 outline-[#b08d57]/60 lg:max-h-[75vh]"
            />
          </div>

          {/* Museum label */}
          <div className="flex flex-col gap-5 p-5 sm:p-8 lg:overflow-y-auto">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {[a.type, a.isPublicDomain ? "Public domain (CC0)" : null].filter(Boolean).join(" · ")}
              </p>
              <h2 id="art-title" className="mt-2 font-serif text-2xl font-semibold italic leading-tight text-slate-900 dark:text-white sm:text-3xl">{a.title}</h2>
              <p className="mt-2 text-[15px] text-slate-600 dark:text-slate-300">{a.artist}</p>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {[["Date", a.date], ["Origin", a.origin], ["Medium", a.medium], ["Dimensions", a.dimensions]].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className={`rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03] ${label === "Dimensions" || label === "Medium" ? "col-span-2" : ""}`}>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>

            {about && (
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">About this work</p>
                <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{about}</p>
              </div>
            )}
            {a.didYouKnow && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">Did you know?</p>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{a.didYouKnow}</p>
              </div>
            )}
            <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400"><Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{a.credit || "The Cleveland Museum of Art"}</p>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <a href={a.page} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600">
                View at the museum <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <a href={full} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]">
                <Maximize2 className="h-4 w-4" aria-hidden />Full size
              </a>
              <button type="button" onClick={copy}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]">
                {copied ? <Check className="h-4 w-4 text-emerald-500" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? "Copied" : "Copy image link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
