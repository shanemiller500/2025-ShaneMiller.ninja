"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Engine } from "../game/engine";

/* ------------------------------------------------------------------ */
/*  The edit-mode strip under the top bar: what the Hand is doing now  */
/*  when it isn't just looking (so a mode is never on by surprise).    */
/*    🪓 Clear area: waiting for a box (Cancel).                       */
/*    ✏️ Edit walls: how many pieces are picked, Select connected,     */
/*       Select none, Undo, Done.                                      */
/* ------------------------------------------------------------------ */

const btn = "min-h-10 rounded-full px-3 text-[12.5px] font-bold transition active:scale-95 disabled:opacity-40";

/** (Re-renders with its parent on every snapshot; it reads the live mode flags off the engine.) */
export default function EditModeBar({ engine }: { engine: Engine }) {
  const walls = engine.wallEditMode;
  const clear = engine.clearAreaMode;
  const n = engine.wallSel.size;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[64px] z-30 flex justify-center px-2 sm:top-[78px]">
      <AnimatePresence mode="popLayout">
        {walls ? (
          <motion.div key="walls" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="dl-glass pointer-events-auto flex max-w-[calc(100vw-16px)] flex-wrap items-center justify-center gap-1.5 rounded-3xl px-3 py-2 text-white shadow-2xl" role="toolbar" aria-label="Edit walls">
            <span className="px-1 text-[13px] font-bold">✏️ Edit walls · <span className="text-cyan-200">{n} picked</span></span>
            <span className="hidden text-[11px] text-white/55 md:inline">Tap pieces to pick · drag one to move the group · shift-drag a box to add</span>
            <button type="button" className={`${btn} bg-white/10 hover:bg-white/20`} disabled={!n} onClick={() => engine.selectConnectedWalls()} title="Pick every piece joined to the ones you've picked (a whole wall run)">🔗 Connected</button>
            <button type="button" className={`${btn} bg-white/10 hover:bg-white/20`} disabled={!n} onClick={() => engine.clearWallSelection()}>Select none</button>
            <button type="button" className={`${btn} bg-white/10 hover:bg-white/20`} disabled={!engine.wallUndoCount} onClick={() => engine.undoWallMove()} title="Put the last move back (Ctrl+Z)">↶ Undo</button>
            <button type="button" className={`${btn} bg-cyan-300 text-slate-900 hover:bg-cyan-200`} onClick={() => engine.toggleWallEditMode()}>Done</button>
          </motion.div>
        ) : clear ? (
          <motion.div key="clear" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="dl-glass pointer-events-auto flex max-w-[calc(100vw-16px)] items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-2xl">
            <span>🪓 <b>Clear area</b>: drag a box over the trees + bushes</span>
            <button type="button" className={`${btn} bg-white/10 hover:bg-white/20`} onClick={() => engine.toggleClearAreaMode()}>Cancel</button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
