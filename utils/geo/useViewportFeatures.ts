"use client";

import { useEffect, useRef, useState } from "react";
import type { AtlasView } from "@/components/atlas/types";

/* ------------------------------------------------------------------ */
/*  Full-detail features for the area on screen, straight from public  */
/*  ArcGIS feature services. For layers too big to ship whole (91k     */
/*  karst polygons, 101k Kentucky sinkholes): bake a light overview,   */
/*  then load the real geometry here once the user zooms in.           */
/*                                                                     */
/*  Requests are debounced, generalized to about a pixel at the        */
/*  current zoom, cached by a snapped tile of the view, and capped.    */
/* ------------------------------------------------------------------ */

export interface ViewportSource {
  /** FeatureServer/MapServer layer URL (…/FeatureServer/0) */
  url: string;
  /** properties stamped on every feature from this source (e.g. a class) */
  props?: Record<string, unknown>;
  where?: string;
  outFields?: string;
}

interface Options {
  sources: ViewportSource[];
  view: AtlasView | null;
  /** don't load below this zoom */
  minZoom: number;
  /** only load where the view touches this box [w, s, e, n] */
  extent?: [number, number, number, number];
  /** stop after this many features per source */
  maxFeatures?: number;
  enabled?: boolean;
}

const PAGE = 2000;

/** Snap the view outward to a grid so small pans reuse the cache. */
function snap([w, s, e, n]: [number, number, number, number], zoom: number): [number, number, number, number] {
  const g = Math.max(0.05, 360 / 2 ** Math.floor(zoom)) / 2;
  return [Math.floor(w / g) * g, Math.floor(s / g) * g, Math.ceil(e / g) * g, Math.ceil(n / g) * g];
}

const overlaps = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

export function useViewportFeatures({ sources, view, minZoom, extent, maxFeatures = 8000, enabled = true }: Options) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [capped, setCapped] = useState(false);
  const cache = useRef(new Map<string, { fc: GeoJSON.FeatureCollection; capped: boolean }>());
  const sourcesKey = JSON.stringify(sources);

  useEffect(() => {
    if (!enabled || !view || view.zoom < minZoom || (extent && !overlaps(view.bounds, extent))) {
      setData(null);
      setLoading(false);
      return;
    }
    const zoom = Math.floor(view.zoom);
    const box = snap(view.bounds, view.zoom);
    const key = `${sourcesKey}|${zoom}|${box.join(",")}`;
    const hit = cache.current.get(key);
    if (hit) {
      setData(hit.fc);
      setCapped(hit.capped);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      // about one screen pixel at this zoom, in degrees
      const tolerance = (360 / (256 * 2 ** zoom)) * 0.8;
      try {
        let hitCap = false;
        const all = await Promise.all(
          sources.map(async (src) => {
            const out: GeoJSON.Feature[] = [];
            for (let offset = 0; offset < maxFeatures; offset += PAGE) {
              const q = new URLSearchParams({
                where: src.where ?? "1=1",
                geometry: box.join(","),
                geometryType: "esriGeometryEnvelope",
                inSR: "4326",
                spatialRel: "esriSpatialRelIntersects",
                outFields: src.outFields ?? "*",
                outSR: "4326",
                maxAllowableOffset: String(tolerance),
                geometryPrecision: "5",
                resultOffset: String(offset),
                resultRecordCount: String(PAGE),
                f: "geojson",
              });
              const res = await fetch(`${src.url}/query?${q}`, { signal: ctl.signal });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const page = (await res.json()) as GeoJSON.FeatureCollection & { properties?: { exceededTransferLimit?: boolean } };
              for (const f of page.features ?? []) if (f.geometry) out.push({ ...f, properties: { ...f.properties, ...src.props } });
              if ((page.features?.length ?? 0) < PAGE && !page.properties?.exceededTransferLimit) return out;
            }
            hitCap = true;
            return out;
          })
        );
        const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: all.flat() };
        cache.current.set(key, { fc, capped: hitCap });
        if (cache.current.size > 40) cache.current.delete(cache.current.keys().next().value!);
        setData(fc);
        setCapped(hitCap);
      } catch {
        /* aborted, or the service hiccupped — keep the previous detail */
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
    // sources compared by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, view, minZoom, sourcesKey, extent?.join(","), maxFeatures]);

  return { data, loading, capped };
}
