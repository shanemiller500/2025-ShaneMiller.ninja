"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Load a set of baked JSON tiles by key, cached, so panning back or  */
/*  re-opening a formation costs nothing. The caller decides which     */
/*  keys it needs (the view, a formation, "near me"…).                 */
/* ------------------------------------------------------------------ */

export function useTileSet<T>(keys: string[], urlFor: (key: string) => string, debounceMs = 200) {
  const cache = useRef(new Map<string, Promise<T>>());
  const [tiles, setTiles] = useState<{ key: string; tile: T }[]>([]);
  const [loading, setLoading] = useState(false);
  const want = keys.join(",");

  useEffect(() => {
    if (!keys.length) {
      setTiles([]);
      setLoading(false);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.allSettled(
        keys.map(async (key) => {
          let p = cache.current.get(key);
          if (!p) {
            p = fetch(urlFor(key)).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`HTTP ${r.status}`))));
            cache.current.set(key, p);
            p.catch(() => cache.current.delete(key));
          }
          return { key, tile: await p };
        })
      ).then((rs) => {
        if (!live) return;
        setTiles(rs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
        setLoading(false);
      });
    }, debounceMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // the keys are compared by their joined value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);

  return { tiles, loading };
}
