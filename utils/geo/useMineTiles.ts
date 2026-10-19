"use client";

import { useEffect, useRef, useState } from "react";
import type { AtlasView } from "@/components/atlas/types";
import { mineTileUrl, tilesFor, type MineTile, type MinesIndex } from "./mines";

/* ------------------------------------------------------------------ */
/*  The baked 2° mine tiles for the area on screen, once zoomed in.    */
/*  Tiles are cached, so panning back costs nothing; `need` loads      */
/*  extra tiles on demand (a share link, "near me").                   */
/* ------------------------------------------------------------------ */

export interface LoadedTile {
  key: string;
  tile: MineTile;
}

export function useMineTiles(index: MinesIndex | null, view: AtlasView | null, minZoom: number, need: string[] = []) {
  const cache = useRef(new Map<string, Promise<MineTile>>());
  const [tiles, setTiles] = useState<LoadedTile[]>([]);
  const [loading, setLoading] = useState(false);

  const get = (key: string) => {
    let p = cache.current.get(key);
    if (!p) {
      p = fetch(mineTileUrl(key)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
      cache.current.set(key, p);
      p.catch(() => cache.current.delete(key));
    }
    return p;
  };

  const needKey = need.join(",");
  useEffect(() => {
    if (!index) return;
    const inView = view && view.zoom >= minZoom ? tilesFor(view.bounds, index) : [];
    const keys = Array.from(new Set([...inView, ...need.filter((k) => index.tiles[k])]));
    if (!keys.length) {
      setTiles([]);
      setLoading(false);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.allSettled(keys.map(async (key) => ({ key, tile: await get(key) }))).then((rs) => {
        if (!live) return;
        setTiles(rs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
        setLoading(false);
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // need is compared by its keys
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, view, minZoom, needKey]);

  return { tiles, loading, get };
}
