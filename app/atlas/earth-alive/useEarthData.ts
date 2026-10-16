"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuakeFeature, QuakeFeed, QuakeMin, QuakeWindow } from "@/utils/geo/quakes";
import type { VolcanoCollection } from "@/utils/geo/volcanoes";

/* ------------------------------------------------------------------ */
/*  Data hooks for Earth Alive.                                        */
/* ------------------------------------------------------------------ */

const REFRESH_MS = 60_000;
const RECENT_MS = 60 * 60 * 1000;

export interface QuakeState {
  feed: QuakeFeed | null;
  /** feed + `recent` flag for the pulse layer */
  mapData: GeoJSON.FeatureCollection | undefined;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  /** the magnitude filter the server actually applied (month+all is coerced to 2.5) */
  appliedMin: QuakeMin | null;
  refresh: () => void;
}

/** Live USGS quakes for a window/magnitude, refreshed every minute while the tab is visible. */
export function useQuakes(window: QuakeWindow, min: QuakeMin): QuakeState {
  const [feed, setFeed] = useState<QuakeFeed | null>(null);
  const [appliedMin, setAppliedMin] = useState<QuakeMin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const ctlRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    ctlRef.current?.abort();
    const ctl = new AbortController();
    ctlRef.current = ctl;
    setLoading(true);
    try {
      const res = await fetch(`/api/atlas/quakes?window=${window}&min=${min}`, { signal: ctl.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setFeed(json);
      setAppliedMin(json.min);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      if (!ctl.signal.aborted) setError((e as Error).message || "Couldn't reach USGS");
    } finally {
      if (!ctl.signal.aborted) setLoading(false);
    }
  }, [window, min]);

  useEffect(() => {
    void load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => {
      clearInterval(id);
      ctlRef.current?.abort();
    };
  }, [load]);

  const mapData = useMemo(() => {
    if (!feed) return undefined;
    const cutoff = Date.now() - RECENT_MS;
    return {
      type: "FeatureCollection" as const,
      features: feed.features.map((f) => ({ ...f, properties: { ...f.properties, recent: f.properties.time >= cutoff ? 1 : 0 } })),
    };
  }, [feed]);

  return { feed, mapData, loading, error, updatedAt, appliedMin, refresh: load };
}

export interface QuakeQuery {
  start: number;
  end?: number;
  minmag: number;
  bbox?: [number, number, number, number];
  circle?: { lat: number; lng: number; radiusKm: number };
}

export interface HistoryResult {
  features: QuakeFeature[];
  count: number;
  truncated: boolean;
  start: number;
  end: number;
}

const queryUrl = (q: QuakeQuery) => {
  const p = new URLSearchParams({ start: String(Math.round(q.start)), minmag: String(q.minmag) });
  if (q.end) p.set("end", String(Math.round(q.end)));
  if (q.bbox) p.set("bbox", q.bbox.join(","));
  if (q.circle) {
    p.set("lat", String(q.circle.lat));
    p.set("lng", String(q.circle.lng));
    p.set("radius", String(q.circle.radiusKm));
  }
  return `/api/atlas/quakes/query?${p}`;
};

/** Historical quakes from the USGS catalog (replays, aftershock sequences, depth regions). */
export function useQuakeQuery(q: QuakeQuery | null) {
  const url = q ? queryUrl(q) : null;
  const [state, setState] = useState<{ url: string | null; data: HistoryResult | null; error: string | null }>({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const ctl = new AbortController();
    setState((s) => ({ url, data: s.url === url ? s.data : null, error: null }));
    fetch(url, { signal: ctl.signal })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        setState({ url, data: json, error: null });
      })
      .catch((e) => !ctl.signal.aborted && setState({ url, data: null, error: (e as Error).message }));
    return () => ctl.abort();
  }, [url]);
  const current = state.url === url;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !!url && (!current || (!state.data && !state.error)),
  };
}

/** Holocene volcanoes + USGS alert codes (changes slowly — fetched once per visit). */
export function useVolcanoes() {
  const [data, setData] = useState<VolcanoCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/atlas/volcanoes", { signal: ctl.signal })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        setData(json);
      })
      .catch((e) => !ctl.signal.aborted && setError((e as Error).message));
    return () => ctl.abort();
  }, []);
  return { data, error };
}

/** Fetch JSON for the open drawer; re-fetches when the url changes. */
export function useDetail<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const ctl = new AbortController();
    setState({ url, data: null, error: null });
    fetch(url, { signal: ctl.signal })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        setState({ url, data: json, error: null });
      })
      .catch((e) => !ctl.signal.aborted && setState({ url, data: null, error: (e as Error).message }));
    return () => ctl.abort();
  }, [url]);
  const current = state.url === url;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!url && (!current || (!state.data && !state.error)) };
}
