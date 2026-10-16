"use client";

import { useEffect, useRef, type ReactNode } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./atlas.css";
import { DEM_SOURCE, applyTerrain, basemapStyle, firstLabelLayer } from "./basemaps";
import type { AtlasLayer, AtlasTime, AtlasView, Basemap, Picked, TerrainMode } from "./types";

/* ------------------------------------------------------------------ */
/*  <AtlasMap> — the one MapLibre wrapper every atlas project uses.    */
/*                                                                     */
/*  Projects pass layer definitions + data; the map owns the imperative */
/*  bits. A basemap or theme swap reloads the style, which wipes custom */
/*  layers, so everything is re-installed on each `style.load`.        */
/*  Browser-only: load the page that uses it with next/dynamic.        */
/* ------------------------------------------------------------------ */

export interface AtlasMapProps {
  layers: AtlasLayer[];
  visible: Record<string, boolean>;
  /** GeoJSON keyed by source id — pushed into the matching source whenever it changes */
  data?: Record<string, GeoJSON.GeoJSON | undefined>;
  basemap: Basemap;
  terrain: TerrainMode;
  dark: boolean;
  selected?: Picked | null;
  onPick?: (p: Picked | null) => void;
  initialView?: { center: [number, number]; zoom: number };
  /** Bump `nonce` to fly somewhere (e.g. from a list click) */
  flyTo?: { center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number } | null;
  /** Replay cursor for time-aware layers (null = live) */
  time?: AtlasTime | null;
  /** Called after every pan/zoom with the visible area */
  onView?: (v: AtlasView) => void;
  /** Glowing atmosphere around the globe (best on a dark, space-like frame) */
  atmosphere?: boolean;
  /** Slowly circle the camera (degrees per second) once any flight has landed; 0/undefined = still */
  orbit?: number;
  /** The person grabbed the map while orbiting — the page should drop `orbit` */
  onOrbitStop?: () => void;
  /** Show MapLibre's zoom/compass/fullscreen buttons (default true) */
  controls?: boolean;
  className?: string;
  /** Overlays positioned inside the map frame (they come along into fullscreen) */
  children?: ReactNode;
}

export function AtlasMap({
  layers,
  visible,
  data,
  basemap,
  terrain,
  dark,
  selected,
  onPick,
  initialView = { center: [-110, 30], zoom: 1.6 },
  flyTo,
  time = null,
  onView,
  atmosphere = false,
  orbit = 0,
  onOrbitStop,
  controls = true,
  className = "",
  children,
}: AtlasMapProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  /** style-layer ids each AtlasLayer installed */
  const ownedRef = useRef<Record<string, string[]>>({});
  const lastSelRef = useRef<{ source: string; id: string | number } | null>(null);
  /** true while the orbit camera is turning — its per-frame moves aren't reported as views */
  const orbitingRef = useRef(false);

  // latest props for the imperative handlers
  const live = useRef({ layers, visible, data, terrain, dark, selected, onPick, time, onView, onOrbitStop });
  live.current = { layers, visible, data, terrain, dark, selected, onPick, time, onView, onOrbitStop };

  /* ── create the map once ─────────────────────────────────────────── */
  useEffect(() => {
    if (!mapDivRef.current) return;
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: basemapStyle(basemap, dark),
      center: initialView.center,
      zoom: initialView.zoom,
      attributionControl: { compact: true },
      maxPitch: 75,
    });
    mapRef.current = map;
    // dev-only handle for headless checks
    if (process.env.NODE_ENV !== "production") (window as unknown as { __atlasMap?: MlMap }).__atlasMap = map;
    if (controls) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      if (frameRef.current) map.addControl(new maplibregl.FullscreenControl({ container: frameRef.current }), "top-right");
    }
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("style.load", () => {
      readyRef.current = true;
      try {
        map.setProjection({ type: "globe" });
      } catch {
        /* older style spec */
      }
      if (atmosphere) {
        try {
          map.setSky({
            "sky-color": "#0b1a3a",
            "horizon-color": "#1d4ed8",
            "fog-color": "#0b1a3a",
            "sky-horizon-blend": 0.6,
            "horizon-fog-blend": 0.8,
            "fog-ground-blend": 0.95,
            // halo while the whole globe is in view, fading out as you zoom in
            "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 1, 7, 0],
          });
        } catch {
          /* sky not supported */
        }
      }
      installAll(map);
    });
    // tile hiccups from third-party servers shouldn't spam the console
    map.on("error", (e) => {
      if (process.env.NODE_ENV !== "production") console.debug("[atlas]", e.error?.message);
    });

    /* clicks: vector hits first, then raster identify */
    let identifyCtl: AbortController | null = null;
    const onClick = async (e: MapMouseEvent) => {
      const { layers: defs, visible: vis, onPick: pick } = live.current;
      const ids = defs.filter((d) => vis[d.id]).flatMap((d) => (d.clickable ?? []).filter((id) => map.getLayer(id)));
      const pad = 5;
      const hits = ids.length
        ? map.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ids })
        : [];
      identifyCtl?.abort();
      if (hits.length) {
        const f = hits[0];
        const owner = defs.find((d) => d.clickable?.includes(f.layer.id));
        const coords = f.geometry.type === "Point" ? (f.geometry.coordinates as [number, number]) : ([e.lngLat.lng, e.lngLat.lat] as [number, number]);
        pick?.({ layer: owner?.id ?? f.layer.id, id: f.id ?? (f.properties?.id as string | undefined), props: f.properties ?? {}, lngLat: coords });
        return;
      }
      const ctl = new AbortController();
      identifyCtl = ctl;
      for (const d of [...defs].reverse()) {
        if (!vis[d.id] || !d.identify) continue;
        try {
          const p = await d.identify(map, [e.lngLat.lng, e.lngLat.lat], ctl.signal);
          if (ctl.signal.aborted) return;
          if (p) return pick?.(p);
        } catch {
          if (ctl.signal.aborted) return;
        }
      }
      pick?.(null);
    };
    map.on("click", onClick);

    const reportView = () => {
      if (orbitingRef.current) return;
      const b = map.getBounds();
      const c = map.getCenter();
      live.current.onView?.({ bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom(), center: [c.lng, c.lat] });
    };
    map.on("moveend", reportView);

    /* 3D terrain: keep the camera's centre on the real ground. Flights computed before the
       elevation tiles arrive aim at sea level, which lands the view kilometres off target. */
    let groundTimer: ReturnType<typeof setTimeout> | undefined;
    // throttled, not debounced: an orbiting camera fires moveend every frame
    const groundCenter = () => {
      if (groundTimer) return;
      groundTimer = setTimeout(() => {
        groundTimer = undefined;
        if (!map.getTerrain() || map.isMoving()) return;
        const e = map.queryTerrainElevation(map.getCenter());
        if (e != null && Math.abs(e - map.getCenterElevation()) > 25) map.setCenterElevation(e);
      }, 250);
    };
    map.on("moveend", groundCenter);
    map.on("sourcedata", (e) => {
      if (e.sourceId === DEM_SOURCE && e.tile) groundCenter();
    });
    map.once("load", reportView);

    /* hover: pointer cursor + a one-line label */
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "atlas-tip", maxWidth: "260px" });
    let raf = 0;
    const onMove = (e: MapMouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { layers: defs, visible: vis } = live.current;
        const ids = defs.filter((d) => vis[d.id]).flatMap((d) => (d.clickable ?? []).filter((id) => map.getLayer(id)));
        const hit = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids })[0] : undefined;
        const owner = hit && defs.find((d) => d.clickable?.includes(hit.layer.id));
        const label = hit && owner?.hoverLabel?.(hit);
        map.getCanvas().style.cursor = hit ? "pointer" : "";
        if (label) tip.setLngLat(e.lngLat).setText(label).addTo(map);
        else tip.remove();
      });
    };
    const hoverable = window.matchMedia("(hover: hover)").matches;
    if (hoverable) {
      map.on("mousemove", onMove);
      map.on("mouseout", () => tip.remove());
    }

    /* per-frame animation for layers that ask for it */
    let anim = 0;
    const tick = (now: number) => {
      const { layers: defs, visible: vis } = live.current;
      if (readyRef.current) for (const d of defs) if (vis[d.id] && d.animate) d.animate(map, now);
      anim = requestAnimationFrame(tick);
    };
    // pulses and glows are decoration: skip them for people who asked for less motion
    if (layers.some((l) => l.animate) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) anim = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(anim);
      clearTimeout(groundTimer);
      identifyCtl?.abort();
      tip.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // the map is created once; later prop changes go through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** (Re)install every layer, then restore data, visibility, terrain and selection. */
  function installAll(map: MlMap) {
    const { layers: defs, data: d, terrain: t, dark: dk } = live.current;
    const labelLayerId = firstLabelLayer(map);
    for (const def of defs) {
      try {
        ownedRef.current[def.id] = def.install(map, { dark: dk, labelLayerId });
      } catch (e) {
        console.warn(`[atlas] couldn't install ${def.id}`, e);
        ownedRef.current[def.id] = [];
      }
    }
    pushData(map, d);
    syncVisibility(map);
    syncTime(map);
    applyTerrain(map, t, dk);
    lastSelRef.current = null;
    syncSelection(map);
  }

  function pushData(map: MlMap, d?: Record<string, GeoJSON.GeoJSON | undefined>) {
    for (const [sourceId, geo] of Object.entries(d ?? {})) {
      const src = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (geo && src && "setData" in src) src.setData(geo);
    }
  }

  function syncVisibility(map: MlMap) {
    const { layers: defs, visible: vis } = live.current;
    for (const def of defs) {
      for (const id of ownedRef.current[def.id] ?? []) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis[def.id] ? "visible" : "none");
      }
    }
  }

  function syncTime(map: MlMap) {
    const { layers: defs, time: t } = live.current;
    for (const def of defs) def.applyTime?.(map, t);
  }

  function syncSelection(map: MlMap) {
    const { layers: defs, selected: sel } = live.current;
    const prev = lastSelRef.current;
    if (prev && map.getSource(prev.source)) map.removeFeatureState({ source: prev.source, id: prev.id }, "selected");
    lastSelRef.current = null;
    const source = sel && defs.find((d) => d.id === sel.layer)?.selectSource;
    if (sel && source && sel.id != null && map.getSource(source)) {
      map.setFeatureState({ source, id: sel.id }, { selected: true });
      lastSelRef.current = { source, id: sel.id };
    }
  }

  /* ── prop → map sync ─────────────────────────────────────────────── */
  const styleKey = `${basemap}:${dark}`;
  const firstStyle = useRef(styleKey);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleKey === firstStyle.current) return;
    firstStyle.current = styleKey;
    readyRef.current = false;
    // drop 3D terrain first: rendering a frame with terrain pointing at the outgoing style's DEM crashes MapLibre
    if (map.getTerrain()) map.setTerrain(null);
    // diff:false guarantees a full reload + style.load, which re-installs our layers
    map.setStyle(basemapStyle(basemap, dark), { diff: false });
  }, [styleKey, basemap, dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) pushData(map, data);
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) syncVisibility(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyTerrain(map, terrain, dark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) syncTime(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) syncSelection(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    // an explicit zoom is honoured (aftershock zones zoom out too); otherwise only zoom in
    map.flyTo({
      center: flyTo.center,
      zoom: flyTo.zoom ?? Math.max(map.getZoom(), 5),
      ...(flyTo.pitch != null ? { pitch: flyTo.pitch } : {}),
      ...(flyTo.bearing != null ? { bearing: flyTo.bearing } : {}),
      speed: 1.2,
      essential: true,
    });
  }, [flyTo]);

  /* ── orbit camera (flyovers) ─────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !orbit || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    let stopped = false;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // a new flight (next anomaly) takes over the camera; resume once it lands
      if (!map.isEasing()) map.setBearing(map.getBearing() + orbit * dt);
      raf = requestAnimationFrame(step);
    };
    const start = () => {
      if (stopped) return;
      orbitingRef.current = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    // let a flight that's under way land first
    if (map.isMoving()) map.once("moveend", start);
    else start();
    // grabbing the map hands the camera back
    const canvas = map.getCanvasContainer();
    const grab = () => live.current.onOrbitStop?.();
    canvas.addEventListener("pointerdown", grab);
    canvas.addEventListener("wheel", grab, { passive: true });
    return () => {
      stopped = true;
      map.off("moveend", start);
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", grab);
      canvas.removeEventListener("wheel", grab);
      orbitingRef.current = false;
      map.fire("moveend");
    };
  }, [orbit]);

  return (
    // `relative` unless the page positions the frame itself (Tailwind emits .relative after .absolute, so both would collapse it)
    <div ref={frameRef} className={`atlas-frame isolate overflow-hidden ${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`}>
      {/* maplibre's own CSS makes the container position:relative, so size it in-flow */}
      <div ref={mapDivRef} className="h-full w-full" />
      {children}
    </div>
  );
}
