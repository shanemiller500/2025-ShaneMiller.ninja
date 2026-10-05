"use client";

import { Modal } from "@/components/ui/modal";
import { DISCOVERIES } from "../data/facts";
import { SPECIES } from "../data/species";
import type { SpeciesId } from "../sim/types";
import Portrait from "./Portrait";

/** Secret discoveries + every species you've met. Vague hints, no spoilers. */
export default function StickerBook({ open, onClose, found, seen }: { open: boolean; onClose: () => void; found: string[]; seen: SpeciesId[] }) {
  return (
    <Modal open={open} onClose={onClose} size="lg" accent="#f59e0b" labelledBy="dl-stickers">
      <div className="dl-scroll overflow-y-auto p-5 text-slate-800 dark:text-slate-100 sm:p-6" style={{ fontFamily: "inherit" }}>
        <h2 id="dl-stickers" className="text-2xl font-bold">
          🏆 Sticker Book <span className="text-base font-semibold text-slate-400">{found.length}/{DISCOVERIES.length}</span>
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Find secret things in Dinosaur Land to collect stickers.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DISCOVERIES.map((d) => {
            const got = found.includes(d.id);
            return (
              <div key={d.id} className={`flex flex-col items-center rounded-2xl border p-2.5 text-center ${got ? "border-amber-300 bg-amber-50 dark:border-amber-400/50 dark:bg-amber-400/10" : "border-dashed border-slate-300 dark:border-white/15"}`}>
                <span className={`text-3xl ${got ? "" : "opacity-30 grayscale"}`}>{got ? d.icon : "❔"}</span>
                <span className="mt-1 text-[12px] font-bold leading-tight">{got ? d.name : "???"}</span>
                <span className="mt-0.5 text-[10.5px] leading-tight text-slate-500 dark:text-slate-400">{d.hint}</span>
              </div>
            );
          })}
        </div>
        <h3 className="mt-6 text-lg font-bold">
          🦕 Dinos met <span className="text-sm font-semibold text-slate-400">{seen.length}/{SPECIES.length}</span>
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tap a dinosaur in the world to meet it — new ones unlock in the toy box.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SPECIES.map((s) => {
            const met = seen.includes(s.id);
            return (
              <div key={s.id} className="flex flex-col items-center rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
                <Portrait species={s.id} locked={!met} w={84} h={58} />
                <span className="text-[12px] font-bold">{met ? s.nick : "???"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
