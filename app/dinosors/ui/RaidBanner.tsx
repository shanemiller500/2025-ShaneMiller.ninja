"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Engine, Snapshot } from "../game/engine";

/** Big, unmissable raid alert with the two things you want right now: look + rally. */
export default function RaidBanner({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const raid = snap.tribe.raid;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (!raid) setDismissed(false); }, [raid]);
  return (
    <AnimatePresence>
      {raid && !dismissed && (
        <div className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2 ${snap.selection.length ? "bottom-[calc(env(safe-area-inset-bottom)+218px)] sm:bottom-[200px]" : "bottom-[calc(env(safe-area-inset-bottom)+145px)] sm:bottom-[150px]"}`}>
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className={`pointer-events-auto flex w-full max-w-[360px] items-center gap-1.5 rounded-2xl border px-2 py-1.5 shadow-2xl sm:w-auto sm:max-w-none sm:gap-3 sm:rounded-3xl sm:border-2 sm:px-4 sm:py-2.5 ${
              raid.phase === "warn" ? "border-amber-300/80 bg-gradient-to-br from-amber-500 to-orange-600" : "border-rose-300/70 bg-gradient-to-br from-rose-600 to-red-700"
            }`}
          >
            <span className={`text-xl sm:text-3xl ${raid.phase === "attack" ? "animate-bounce" : ""}`}>{raid.brutes ? "🪓" : raid.phase === "warn" ? "🥁" : "⚔️"}</span>
            <span className="min-w-0 flex-1 leading-tight sm:flex-none">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-white/85 sm:text-[11px]">{raid.phase === "warn" ? "Raid incoming!" : "RAID!"}</span>
              <span className="block text-[11px] font-bold sm:text-[15px]">
                {raid.label} · {raid.left} left
              </span>
            </span>
            <button type="button" onClick={() => engine.flyTo(raid.x, raid.y, Math.max(0.6, Math.min(engine.cam.zoom, 0.9)))} className="shrink-0 rounded-xl bg-white/20 px-2 py-1.5 text-[11px] font-bold hover:bg-white/30 active:scale-95 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-sm">
              📍 Look
            </button>
            <button type="button" onClick={() => engine.rally()} className="shrink-0 rounded-xl bg-white px-2 py-1.5 text-[11px] font-extrabold text-rose-700 hover:bg-rose-50 active:scale-95 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-sm">
              {snap.rallied ? "🏳️ Stand down" : "📣 Rally!"}
            </button>
            <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss raid alert" className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white sm:p-1.5"><X className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
