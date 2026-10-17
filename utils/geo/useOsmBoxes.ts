"use client";

import { useEffect, useRef, useState } from "react";
import type { AtlasView } from "@/components/atlas/types";

/* ------------------------------------------------------------------ */
/*  Features for the area on screen from one of our box-limited OSM    */
/*  routes (/api/atlas/osm-*?bbox=…), once zoomed in. The view snaps   */
/*  to a grid of cells (≤ 1° each) that are cached, so panning reuses  */
/*  them; requests are debounced.                                      */
/* ------------------------------------------------------------------ */

export function useOsmBoxes(route: string, view: AtlasView | null, enabled: boolean, minZoom: number, cell = 0.5) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, GeoJSON.Feature[]>());

  useEffect(() => {
    if (!enabled || !view || view.zoom < minZoom) {
      setData(null);
      setLoading(false);
      return;
    }
    const [w, s, e, n] = view.bounds;
    const x0 = Math.floor(w / cell);
    const x1 = Math.floor(e / cell);
    const y0 = Math.floor(s / cell);
    const y1 = Math.floor(n / cell);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 16) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      const cells: string[] = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.push(`${x},${y}`);
      const missing = cells.filter((k) => !cache.current.has(k));
      if (missing.length) setLoading(true);
      await Promise.all(
        missing.map(async (k) => {
          const [x, y] = k.split(",").map(Number);
          const bbox = [x * cell, y * cell, (x + 1) * cell, (y + 1) * cell].map((v) => v.toFixed(3)).join(",");
          try {
            const res = await fetch(`${route}?bbox=${bbox}`, { signal: ctl.signal });
            const fc = (await res.json()) as GeoJSON.FeatureCollection;
            if (res.ok) cache.current.set(k, fc.features);
          } catch {
            /* aborted or offline — try again next pan */
          }
        })
      );
      if (ctl.signal.aborted) return;
      setLoading(false);
      const seen = new Set<unknown>();
      const features = cells.flatMap((k) => cache.current.get(k) ?? []).filter((f) => !seen.has(f.id) && seen.add(f.id));
      setData({ type: "FeatureCollection", features });
    }, 450);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [route, view, enabled, minZoom, cell]);

  return { data, loading };
}
