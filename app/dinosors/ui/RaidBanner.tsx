"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Engine, Snapshot } from "../game/engine";

/** Big, unmissable raid alert with the two things you want right now: look + rally. */
export default function RaidBanner({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const raid = snap.tribe.raid;
  return (
    <AnimatePresence>
      {raid && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[150px] z-30 flex justify-center px-2 sm:bottom-[112px]">
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-3xl border-2 px-4 py-2.5 shadow-2xl ${
              raid.phase === "warn" ? "border-amber-300/80 bg-gradient-to-br from-amber-500 to-orange-600" : "border-rose-300/70 bg-gradient-to-br from-rose-600 to-red-700"
            }`}
          >
            <span className={`text-3xl ${raid.phase === "attack" ? "animate-bounce" : ""}`}>{raid.phase === "warn" ? "🥁" : "⚔️"}</span>
            <span className="leading-tight">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-white/85">{raid.phase === "warn" ? "Raid incoming!" : "RAID!"}</span>
              <span className="block text-[15px] font-bold">
                {raid.label} · {raid.left} left
              </span>
            </span>
            <button type="button" onClick={() => engine.flyTo(raid.x, raid.y, Math.max(0.6, Math.min(engine.cam.zoom, 0.9)))} className="rounded-2xl bg-white/20 px-3 py-2 text-sm font-bold hover:bg-white/30 active:scale-95">
              📍 Look
            </button>
            <button type="button" onClick={() => engine.rally()} className="rounded-2xl bg-white px-3 py-2 text-sm font-extrabold text-rose-700 hover:bg-rose-50 active:scale-95">
              {snap.rallied ? "🏳️ Stand down" : "📣 Rally!"}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
