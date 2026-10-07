"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { GUIDE_IMG, HELP } from "../data/guide";

/* ------------------------------------------------------------------ */
/*  How to play: short illustrated sections, one at a time.            */
/* ------------------------------------------------------------------ */

export default function HelpPanel({ open, onClose, section, fontClass, tipsOn, onTips }: { open: boolean; onClose: () => void; section?: string; fontClass: string; tipsOn: boolean; onTips: () => void }) {
  const [cur, setCur] = useState(HELP[0].id);
  useEffect(() => {
    if (open) setCur(section && HELP.some((h) => h.id === section) ? section : HELP[0].id);
  }, [open, section]);
  const s = HELP.find((h) => h.id === cur) ?? HELP[0];
  const i = HELP.indexOf(s);
  return (
    <Modal open={open} onClose={onClose} size="lg" accent="#f59e0b" labelledBy="dl-help">
      <div className={`flex max-h-[86dvh] flex-col bg-[#1d1a17] text-white sm:flex-row ${fontClass}`}>
        {/* sections */}
        <nav className="dl-scroll flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 p-2 sm:w-52 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r">
          <h2 id="dl-help" className="hidden px-2 pb-1 pt-1 text-lg font-bold sm:block">
            📖 How to play
          </h2>
          {HELP.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setCur(h.id)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${cur === h.id ? "bg-amber-400 text-slate-900" : "text-white/80 hover:bg-white/10"}`}
            >
              <span className="text-base">{h.icon}</span>
              {h.title}
            </button>
          ))}
        </nav>
        {/* the page */}
        <div className="dl-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-2xl">
            <img src={GUIDE_IMG(s.scene)} alt="" width={520} height={520} className="h-40 w-full object-cover object-center sm:h-48" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1d1a17] via-transparent to-transparent" />
            <h3 className="absolute bottom-2 left-3 text-2xl font-bold drop-shadow">
              {s.icon} {s.title}
            </h3>
          </div>
          <p className="mt-3 text-[14px] text-white/80">{s.intro}</p>
          <ol className="mt-3 space-y-2">
            {s.steps.map((step, k) => (
              <li key={k} className="flex gap-2.5 text-[13.5px] leading-snug">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/90 text-[12px] font-bold text-slate-900">{k + 1}</span>
                <span className="text-white/90">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" disabled={i === 0} onClick={() => setCur(HELP[i - 1].id)} className="rounded-xl bg-white/10 px-3 py-2 text-[13px] font-bold hover:bg-white/20 disabled:opacity-30">
              ← Back
            </button>
            <button type="button" disabled={i === HELP.length - 1} onClick={() => setCur(HELP[i + 1].id)} className="rounded-xl bg-amber-400 px-3 py-2 text-[13px] font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-30">
              Next →
            </button>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px] text-white/75">
              <input type="checkbox" checked={tipsOn} onChange={onTips} className="h-4 w-4 accent-amber-400" />
              Show little tips while I play
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
