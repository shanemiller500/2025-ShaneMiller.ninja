"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Map as MapIcon } from "lucide-react";
import type { Engine } from "../game/engine";
import { MAP_H, MAP_W } from "../sim/types";

/* ------------------------------------------------------------------ */
/*  The minimap: the whole world small, in the corner above the zoom    */
/*  buttons. Land nobody has seen yet is dark; known places, camps the  */
/*  tribe has found, our people + dragons and the view box are drawn on */
/*  top. Tap it to fly the camera there. Folds down to a button.        */
/*  Redrawn a few times a second (the fog is cached in the engine).    */
/* ------------------------------------------------------------------ */

const KEY = "dinosors:minimap";
const ASPECT = MAP_H / MAP_W;

export function Minimap({ engine, cardOpen, mobileOpen, onMobileToggle }: { engine: Engine; cardOpen: boolean; mobileOpen: boolean; onMobileToggle: () => void }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);
  const mobileRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "closed") setOpen(false);
    } catch {
      /* private mode: just stay open */
    }
  }, []);
  useEffect(() => {
    if (!open && !mobileOpen) return;
    const draw = () => {
      const desktop = window.matchMedia("(min-width: 640px)").matches;
      if (desktop && open && ref.current) engine.drawMinimap(ref.current);
      if (!desktop && mobileOpen && mobileRef.current) engine.drawMinimap(mobileRef.current);
    };
    draw();
    const id = window.setInterval(draw, 300);
    return () => window.clearInterval(id);
  }, [engine, open, mobileOpen]);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? "closed" : "open");
      } catch {
        /* ignore */
      }
      return !o;
    });
  };
  const place = `pointer-events-auto absolute bottom-[292px] z-20 hidden transition-[right] duration-300 ${cardOpen ? "sm:right-[362px]" : "sm:right-4"}`;
  return (
    <>
    {open ? <div className={`${place} dl-glass rounded-2xl p-1.5 sm:block`}>
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-100/85">
          <MapIcon className="h-3.5 w-3.5" /> Map
        </span>
        <button type="button" onClick={toggle} aria-label="Hide the map" title="Hide the map" className="rounded-full p-0.5 text-white/60 hover:bg-white/10 hover:text-white">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <canvas
        ref={ref}
        width={288}
        height={Math.round(288 * ASPECT)}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          engine.minimapJump((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
        className="block h-auto w-[156px] cursor-crosshair rounded-lg ring-1 ring-black/40 sm:w-[216px]"
        aria-label="World map: tap to fly there"
      />
    </div> : <button type="button" onClick={toggle} aria-label="Show the map" title="Show the map" className={`${place} dl-glass h-11 w-11 items-center justify-center rounded-2xl text-white sm:flex`}>
      <MapIcon className="h-5 w-5" />
    </button>}
    <AnimatePresence>
      {mobileOpen && (
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 32 }}
          className="dl-glass pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+92px)] right-2 z-40 rounded-2xl p-2 shadow-2xl sm:hidden">
          <div className="mb-1 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-amber-100/85">
            <span className="flex items-center gap-1"><MapIcon className="h-3.5 w-3.5" /> Map</span>
            <button type="button" onClick={onMobileToggle} aria-label="Close map" className="rounded-full p-1 text-white/70"><ChevronDown className="h-4 w-4" /></button>
          </div>
          <canvas ref={mobileRef} width={288} height={Math.round(288 * ASPECT)}
            onPointerDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              engine.minimapJump((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
            }}
            className="block h-auto w-[min(58vw,216px)] cursor-crosshair rounded-lg ring-1 ring-black/40"
            aria-label="World map: tap to fly there" />
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
