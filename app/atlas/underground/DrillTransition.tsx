"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  The hand-off from map to 3D dive: while the map swoops down onto   */
/*  the entrance, an iris closes, scan lines race and a depth counter  */
/*  runs down through the surface. ~1.9 s, purely decorative (skipped  */
/*  when the OS asks for reduced motion).                              */
/* ------------------------------------------------------------------ */

export function DrillTransition({ name }: { name: string }) {
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1800);
      setDepth(Math.round(t * t * 60));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-live="polite">
      {/* iris closing in on the entrance */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[300vmax] w-[300vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, transparent 0%, transparent 18%, #02040b 34%)" }}
        initial={{ scale: 3.2, opacity: 0 }}
        animate={{ scale: 0.55, opacity: 1 }}
        transition={{ duration: 1.7, ease: [0.6, 0, 0.8, 0.4] }}
      />
      {/* racing scan lines */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(34,211,238,0.12) 0px, rgba(34,211,238,0.12) 1px, transparent 1px, transparent 6px)" }}
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: [0, -240], opacity: [0, 0.9, 0.9, 0] }}
        transition={{ duration: 1.8, ease: "linear" }}
      />
      {/* ring pulse at the entrance */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300"
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 6, opacity: 0 }}
        transition={{ duration: 1.2, repeat: 1, ease: "easeOut" }}
      />
      <div className="absolute inset-x-0 top-1/2 mt-20 flex flex-col items-center gap-1 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-cyan-200/80">Descending into</p>
        <p className="font-mono text-lg font-semibold uppercase tracking-[0.3em] text-white">{name}</p>
        <p className="font-mono text-sm tabular-nums text-cyan-300">−{depth} m</p>
      </div>
    </div>
  );
}
