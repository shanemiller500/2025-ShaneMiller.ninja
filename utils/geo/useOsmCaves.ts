"use client";

import { useEffect, useRef, useState } from "react";
import type { AtlasView } from "@/components/atlas/types";

/* ------------------------------------------------------------------ */
/*  Cave entrances from OpenStreetMap for the area on screen, once     */
/*  zoomed in. The view is snapped to a 0.25° grid (≤ 1° per request)  */
/*  so panning reuses the cache; requests are debounced.               */
/* ------------------------------------------------------------------ */

export const OSM_CAVES_MIN_ZOOM = 11;
const CELL = 0.25;

export function useOsmCaves(view: AtlasView | null, enabled: boolean) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const cache = useRef(new Map<string, GeoJSON.Feature[]>());

  useEffect(() => {
    if (!enabled || !view || view.zoom < OSM_CAVES_MIN_ZOOM) {
      setData(null);
      return;
    }
    const [w, s, e, n] = view.bounds;
    const x0 = Math.floor(w / CELL);
    const x1 = Math.floor(e / CELL);
    const y0 = Math.floor(s / CELL);
    const y1 = Math.floor(n / CELL);
    // a zoom-11 view spans well under a degree; refuse anything silly
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 16) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      const cells: string[] = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.push(`${x},${y}`);
      await Promise.all(
        cells
          .filter((k) => !cache.current.has(k))
          .map(async (k) => {
            const [x, y] = k.split(",").map(Number);
            const bbox = [x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL].map((v) => v.toFixed(3)).join(",");
            try {
              const res = await fetch(`/api/atlas/osm-caves?bbox=${bbox}`, { signal: ctl.signal });
              const fc = (await res.json()) as GeoJSON.FeatureCollection;
              if (res.ok) cache.current.set(k, fc.features);
            } catch {
              /* aborted or offline — try again next pan */
            }
          })
      );
      if (ctl.signal.aborted) return;
      const seen = new Set<unknown>();
      const features = cells.flatMap((k) => cache.current.get(k) ?? []).filter((f) => !seen.has(f.id) && seen.add(f.id));
      setData({ type: "FeatureCollection", features });
    }, 450);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [enabled, view]);

  return data;
}
