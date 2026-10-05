"use client";

import { memo, useEffect, useRef } from "react";
import { paintPortrait } from "../render/renderer";
import type { SpeciesId } from "../sim/types";

/** A species drawn with the same painter the world uses (silhouette when locked). */
function Portrait({ species, locked = false, baby = false, w = 88, h = 66, className = "" }: { species: SpeciesId; locked?: boolean; baby?: boolean; w?: number; h?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    paintPortrait(cv, species, { baby, t: 1.3 });
    if (locked) {
      const c = cv.getContext("2d")!;
      c.globalCompositeOperation = "source-in";
      c.fillStyle = "rgba(15,23,42,0.85)";
      c.fillRect(0, 0, cv.width, cv.height);
      c.globalCompositeOperation = "source-over";
    }
  }, [species, locked, baby, w, h]);
  return <canvas ref={ref} style={{ width: w, height: h }} className={className} aria-hidden />;
}

export default memo(Portrait);
