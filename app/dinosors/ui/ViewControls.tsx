"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Home, Minus, MousePointer2, Plus, Users, Video, X } from "lucide-react";
import type { Engine } from "../game/engine";

/** Zoom, return-home and the "following" chip. Big targets for small fingers. */
export default function ViewControls({ engine, followId, cardOpen, showQuickActions, wallsAvailable }: { engine: Engine; followId: number; cardOpen: boolean; showQuickActions: boolean; wallsAvailable: boolean }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const b = "dl-glass h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition hover:bg-slate-800/80 active:scale-90";
  const followed = followId ? engine.world.dinoById(followId) : null;
  const act = (callback: () => void) => { callback(); setQuickOpen(false); };
  return (
    <>
      <div className={`pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+96px)] z-20 flex-col gap-2 transition-[right] duration-300 sm:bottom-28 ${cardOpen ? "hidden right-2 sm:flex sm:right-[362px]" : "flex right-2 sm:right-4"}`}>
        <button type="button" className={`${b} hidden sm:flex`} onClick={() => engine.zoomBy(1.3)} aria-label="Zoom in" title="Zoom in">
          <Plus className="h-6 w-6" />
        </button>
        <button type="button" className={`${b} hidden sm:flex`} onClick={() => engine.zoomBy(1 / 1.3)} aria-label="Zoom out" title="Zoom out">
          <Minus className="h-6 w-6" />
        </button>
        {showQuickActions && (
          <div className="relative sm:hidden">
            <AnimatePresence>
              {quickOpen && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.16 }} className="dl-glass absolute bottom-full right-0 mb-2 w-48 rounded-2xl p-2 shadow-2xl">
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-white/65"><span>Quick actions</span><button type="button" onClick={() => setQuickOpen(false)} aria-label="Close quick actions"><X className="h-4 w-4" /></button></div>
                  <button type="button" onClick={() => act(() => engine.selectAll(true))} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold hover:bg-white/15"><Users className="h-4 w-4" />Pick idle people</button>
                  <button type="button" onClick={() => act(() => engine.toggleGroupSelectMode())} aria-pressed={engine.groupSelectMode} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold ${engine.groupSelectMode ? "bg-amber-400 text-slate-900" : "hover:bg-white/15"}`}><MousePointer2 className="h-4 w-4" />Group select</button>
                  <button type="button" onClick={() => act(() => engine.toggleClearAreaMode())} aria-pressed={engine.clearAreaMode} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold ${engine.clearAreaMode ? "bg-emerald-400 text-slate-900" : "hover:bg-white/15"}`}><span aria-hidden="true">🪓</span>Clear area</button>
                  {wallsAvailable && <button type="button" onClick={() => act(() => engine.toggleWallEditMode())} aria-pressed={engine.wallEditMode} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold ${engine.wallEditMode ? "bg-cyan-300 text-slate-900" : "hover:bg-white/15"}`}><span aria-hidden="true">✏️</span>Walls</button>}
                </motion.div>
              )}
            </AnimatePresence>
            <button type="button" className={`${b} flex ${quickOpen ? "bg-amber-400 text-slate-900" : ""}`} onClick={() => setQuickOpen((open) => !open)} aria-label="Quick actions" aria-expanded={quickOpen} title="Quick actions"><Users className="h-6 w-6" /></button>
          </div>
        )}
        <button type="button" className={`${b} flex`} onClick={() => engine.goHome()} aria-label="Go home" title="Back home (H)">
          <Home className="h-6 w-6" />
        </button>
      </div>
      {followed && (
        <button
          type="button"
          onClick={() => engine.follow(0)}
          className="dl-glass pointer-events-auto absolute bottom-[88px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg active:scale-95 sm:bottom-28"
        >
          <Video className="h-4 w-4 text-amber-300" /> Following {followed.name} · tap to stop
        </button>
      )}
    </>
  );
}
