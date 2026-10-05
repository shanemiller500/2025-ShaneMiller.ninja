"use client";

import { Home, Minus, Plus, Video } from "lucide-react";
import type { Engine } from "../game/engine";

/** Zoom, return-home and the "following" chip. Big targets for small fingers. */
export default function ViewControls({ engine, followId, cardOpen }: { engine: Engine; followId: number; cardOpen: boolean }) {
  const b = "dl-glass flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition hover:bg-slate-800/80 active:scale-90";
  const followed = followId ? engine.world.dinoById(followId) : null;
  return (
    <>
      <div className={`pointer-events-auto absolute bottom-24 z-20 flex-col gap-2 transition-[right] duration-300 sm:bottom-28 ${cardOpen ? "hidden right-2 sm:flex sm:right-[362px]" : "flex right-2 sm:right-4"}`}>
        <button type="button" className={b} onClick={() => engine.zoomBy(1.3)} aria-label="Zoom in" title="Zoom in">
          <Plus className="h-6 w-6" />
        </button>
        <button type="button" className={b} onClick={() => engine.zoomBy(1 / 1.3)} aria-label="Zoom out" title="Zoom out">
          <Minus className="h-6 w-6" />
        </button>
        <button type="button" className={b} onClick={() => engine.goHome()} aria-label="Go home" title="Back home (H)">
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
