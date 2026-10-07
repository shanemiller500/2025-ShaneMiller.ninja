"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { GUIDE_IMG, HELP } from "../data/guide";

/* ------------------------------------------------------------------ */
/*  How to play: a cave-painting storybook. Big picture on one page,  */
/*  the steps on the other, chunky tabs along the top.                 */
/* ------------------------------------------------------------------ */

export default function HelpPanel({ open, onClose, section, fontClass, tipsOn, onTips }: { open: boolean; onClose: () => void; section?: string; fontClass: string; tipsOn: boolean; onTips: () => void }) {
  const [cur, setCur] = useState(HELP[0].id);
  useEffect(() => {
    if (open) setCur(section && HELP.some((h) => h.id === section) ? section : HELP[0].id);
  }, [open, section]);
  const s = HELP.find((h) => h.id === cur) ?? HELP[0];
  const i = HELP.indexOf(s);
  return (
    <Modal className="dl-modal dl-modal-paper" open={open} onClose={onClose} size="xl" accent="#f59e0b" labelledBy="dl-help" hideClose>
      <div className={`flex max-h-[90dvh] flex-col text-[#3a2414] ${fontClass}`}>
        {/* title ribbon */}
        <div className="dl-leopard flex shrink-0 items-center gap-3 border-b-4 border-[#3a2414] px-4 py-2.5">
          <img src={GUIDE_IMG("ugg-face")} alt="" width={48} height={48} className="-my-3 h-14 w-14 shrink-0 rounded-full border-[3px] border-[#3a2414] bg-[#fff3d6] object-cover" />
          <h2 id="dl-help" className="dl-ink text-2xl font-bold tracking-wide text-[#fff6dd] sm:text-3xl">
            How to play
          </h2>
          <button type="button" aria-label="Close" title="Close (Esc)" onClick={onClose} className="dl-btn ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#fffaf0] text-[#3a2414] hover:bg-white">
            <X className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>

        {/* chapter tabs */}
        <nav className="dl-scroll flex shrink-0 gap-2 overflow-x-auto px-4 pb-2 pt-3 lg:flex-wrap">
          {HELP.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setCur(h.id)}
              className={`dl-btn flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-1.5 text-[13px] font-bold ${cur === h.id ? "bg-amber-400 text-[#3a2414]" : "bg-[#fffaf0] text-[#3a2414]/80 hover:bg-white"}`}
            >
              <span className="text-base leading-none">{h.icon}</span>
              {h.title}
            </button>
          ))}
        </nav>

        {/* the page */}
        <AnimatePresence mode="wait">
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.18 }}
            className="dl-scroll grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-6 md:p-5"
          >
            <figure className="relative mx-auto w-full max-w-[460px] self-start pb-3">
              <div className="overflow-hidden rounded-3xl border-4 border-[#3a2414] bg-[#3a2414] shadow-[0_6px_0_#3a2414]">
                <img src={GUIDE_IMG(s.scene)} alt="" width={520} height={520} className="aspect-square w-full object-cover" />
              </div>
              <figcaption className="dl-btn absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-2xl bg-amber-400 px-4 py-1.5 text-lg font-bold">
                <span>{s.icon}</span> {s.title}
              </figcaption>
            </figure>

            <div className="flex min-w-0 flex-col">
              <p className="text-[16px] font-semibold leading-snug">{s.intro}</p>
              <ol className="mt-4 space-y-2.5">
                {s.steps.map((step, k) => (
                  <li key={k} className="flex gap-3 rounded-2xl border-2 border-[#3a2414]/15 bg-[#fffaf0]/80 p-2.5 text-[14.5px] leading-snug">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2.5px] border-[#3a2414] bg-gradient-to-b from-[#d8cfc1] to-[#9b9184] text-[14px] font-bold shadow-[0_2px_0_#3a2414]">
                      {k + 1}
                    </span>
                    <span className="pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* page turner */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t-[3px] border-[#3a2414]/20 px-4 py-3">
          <button type="button" disabled={i === 0} onClick={() => setCur(HELP[i - 1].id)} className="dl-btn rounded-2xl bg-[#fffaf0] px-4 py-2 text-[14px] font-bold disabled:opacity-35">
            ← Back
          </button>
          <div className="hidden gap-1.5 sm:flex" aria-hidden>
            {HELP.map((h, k) => (
              <span key={h.id} className={`h-2.5 rounded-full border-2 border-[#3a2414] transition-all ${k === i ? "w-6 bg-amber-400" : "w-2.5 bg-[#fffaf0]"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => (i === HELP.length - 1 ? onClose() : setCur(HELP[i + 1].id))}
            className="dl-btn rounded-2xl bg-amber-400 px-4 py-2 text-[14px] font-bold hover:bg-amber-300"
          >
            {i === HELP.length - 1 ? "Let's play! 🦕" : "Next →"}
          </button>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={tipsOn} onChange={onTips} className="h-4 w-4 accent-amber-500" />
            Show little tips while I play
          </label>
        </div>
      </div>
    </Modal>
  );
}
