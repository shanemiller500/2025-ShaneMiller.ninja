"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import maplibregl, { type Map as MlMap, type RasterTileSource } from "maplibre-gl";
import { registerEuLidar } from "@/utils/geo/euLidar";
import "maplibre-gl/dist/maplibre-gl.css";
import "./atlas.css";
import { lensStyle, type Lens } from "./lenses";

// national lidar outside the U.S. needs its tile protocol before any map asks for tiles
registerEuLidar(maplibregl);

/* ------------------------------------------------------------------ */
/*  <CompareView> — one place seen through several lenses at once.     */
/*  "swipe": two full-size maps, a draggable divider reveals one over  */
/*  the other. "grid": up to four panes. Every pane follows the others */
/*  (pan, zoom, rotate). A crosshair marks the point the readout uses. */
/*  Browser-only: load the page that uses it with next/dynamic.        */
/* ------------------------------------------------------------------ */

export type CompareLayout = "swipe" | "grid";

export interface CompareCamera {
  center: [number, number];
  zoom: number;
  bearing?: number;
}

export interface CompareViewProps {
  /** swipe: [left, right]; grid: up to four */
  lenses: Lens[];
  layout: CompareLayout;
  initial: CompareCamera;
  /** Bump `nonce` to move every pane */
  flyTo?: (CompareCamera & { nonce: number }) | null;
  /** After each move, with the visible bounds of the first pane */
  onView?: (v: { center: [number, number]; zoom: number; bounds: [number, number, number, number] }) => void;
  /** px to push the top-left lens label down (clears page chrome floating over the corner) */
  labelOffset?: number;
  className?: string;
}

export function CompareView({ lenses, layout, initial, flyTo, onView, labelOffset = 0, className = "" }: CompareViewProps) {
  const panes = layout === "swipe" ? lenses.slice(0, 2) : lenses.slice(0, 4);
  const divRefs = useRef<(HTMLDivElement | null)[]>([]);
  const maps = useRef<MlMap[]>([]);
  const camera = useRef<CompareCamera>(initial);
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const [split, setSplit] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);

  // panes are rebuilt when the layout or the set of lenses changes; tile URL changes are patched in place
  const paneKey = `${layout}:${panes.map((l) => l.id).join(",")}`;

  useEffect(() => {
    const created: MlMap[] = [];
    let syncing = false;
    const cam = camera.current;
    divRefs.current.slice(0, panes.length).forEach((el, i) => {
      if (!el) return;
      const map = new maplibregl.Map({
        container: el,
        style: lensStyle(panes[i]),
        center: cam.center,
        zoom: cam.zoom,
        bearing: cam.bearing ?? 0,
        attributionControl: i === panes.length - 1 ? { compact: true } : false,
        dragRotate: true,
        pitchWithRotate: false,
        maxPitch: 0,
      });
      map.touchZoomRotate.enableRotation();
      // flaky third-party tile servers shouldn't spam the console (same as AtlasMap)
      map.on("error", (e) => {
        if (process.env.NODE_ENV !== "production") console.debug("[atlas compare]", e.error?.message);
      });
      created.push(map);
    });
    // any pane leads; the rest follow
    for (const leader of created) {
      leader.on("move", () => {
        if (syncing) return;
        syncing = true;
        const c = leader.getCenter();
        camera.current = { center: [c.lng, c.lat], zoom: leader.getZoom(), bearing: leader.getBearing() };
        for (const m of created) if (m !== leader) m.jumpTo({ center: c, zoom: leader.getZoom(), bearing: leader.getBearing() });
        syncing = false;
      });
    }
    const report = () => {
      const m = created[0];
      if (!m) return;
      const b = m.getBounds();
      const c = m.getCenter();
      onViewRef.current?.({ center: [c.lng, c.lat], zoom: m.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    };
    created[0]?.on("moveend", report);
    created[0]?.once("load", report);
    maps.current = created;
    return () => {
      for (const m of created) m.remove();
      maps.current = [];
    };
    // rebuilt only when the panes change shape (see paneKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneKey]);

  // new tiles for a lens (e.g. another topo edition) → swap them without rebuilding the map
  const tilesKey = panes.map((l) => l.sources.map((s) => s.tiles).join("|")).join("||");
  useEffect(() => {
    maps.current.forEach((m, i) => {
      const lens = panes[i];
      if (!lens) return;
      const apply = () => {
        for (const s of lens.sources) {
          const src = m.getSource(s.id) as RasterTileSource | undefined;
          if (src && src.tiles?.[0] !== s.tiles) src.setTiles([s.tiles]);
        }
      };
      if (m.isStyleLoaded()) apply();
      else m.once("load", apply);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilesKey]);

  useEffect(() => {
    if (!flyTo) return;
    // the first pane leads; its move handler carries the others along
    maps.current[0]?.flyTo({ center: flyTo.center, zoom: flyTo.zoom, bearing: flyTo.bearing ?? 0, speed: 1.4, essential: true });
  }, [flyTo]);

  /* ── swipe divider ─────────────────────────────────────────────── */
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = frame.getBoundingClientRect();
      setSplit(Math.min(97, Math.max(3, ((ev.clientX - r.left) / r.width) * 100)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    move(e.nativeEvent);
  };

  const crosshair = (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <div className="h-9 w-9 rounded-full border-2 border-white/90 shadow-[0_0_0_2px_rgba(2,6,23,0.6),0_0_18px_rgba(255,255,255,0.35)]" />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
    </div>
  );

  const chip = (lens: Lens, side?: "left" | "right", first = false) => (
    <span
      style={{ top: 8 + (first ? labelOffset : 0), borderColor: `${lens.accent}66`, boxShadow: `0 0 14px -4px ${lens.accent}` }}
      className={`pointer-events-none absolute z-10 rounded-full border bg-slate-950/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white backdrop-blur ${side === "right" ? "right-2" : "left-2"}`}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: lens.accent }} />
      {lens.label}
    </span>
  );

  if (layout === "swipe") {
    return (
      <div ref={frameRef} className={`isolate overflow-hidden bg-[#05060d] ${className}`}>
        <div className="absolute inset-0">
          <div ref={(el) => void (divRefs.current[0] = el)} className="h-full w-full" />
        </div>
        {/* the right lens sits on top, clipped to the right of the divider (clip-path clips its clicks too) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
          <div ref={(el) => void (divRefs.current[1] = el)} className="h-full w-full" />
        </div>
        {panes[0] && chip(panes[0], "left", true)}
        {panes[1] && chip(panes[1], "right")}
        {crosshair}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Swipe between the two views"
          aria-valuenow={Math.round(split)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={drag}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setSplit((s) => Math.max(3, s - 4));
            if (e.key === "ArrowRight") setSplit((s) => Math.min(97, s + 4));
          }}
          className="absolute inset-y-0 z-20 w-8 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
          style={{ left: `${split}%` }}
        >
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
          <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-slate-950/80 font-mono text-[11px] text-white shadow-lg">⇆</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={frameRef} className={`grid grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-white/10 ${className}`}>
      {panes.map((lens, i) => (
        <div key={lens.id} className="relative min-h-0 overflow-hidden bg-[#05060d]">
          <div ref={(el) => void (divRefs.current[i] = el)} className="h-full w-full" />
          {chip(lens, undefined, i === 0)}
          {crosshair}
        </div>
      ))}
    </div>
  );
}
