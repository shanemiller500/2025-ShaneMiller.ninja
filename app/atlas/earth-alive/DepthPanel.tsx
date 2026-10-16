"use client";

import { useEffect, useMemo, useState } from "react";
import { Crosshair } from "lucide-react";
import { hudGlass } from "@/components/atlas/Hud";
import { DepthView, type DepthLine, type DepthPoint } from "@/components/atlas/DepthView";
import { boundaryColor, PLATES_URL, type BoundaryClass } from "@/utils/geo/plates";
import { depthColor, type QuakeFeature } from "@/utils/geo/quakes";
import type { DepthRegion } from "./regions";
import type { HistoryResult } from "./useEarthData";

/* ------------------------------------------------------------------ */
/*  Earth Alive's 3D mode: the scene (inside the map frame) and the    */
/*  region picker (in the side panel). State lives in EarthAliveApp.   */
/* ------------------------------------------------------------------ */

let platesCache: Promise<DepthLine[]> | null = null;
const loadPlateLines = () =>
  (platesCache ??= fetch(PLATES_URL)
    .then((r) => r.json())
    .then((fc: { features: { properties: { cls: BoundaryClass }; geometry: { coordinates: [number, number][] } }[] }) =>
      fc.features.map((f) => ({ coords: f.geometry.coordinates, color: boundaryColor(f.properties.cls) }))
    )
    .catch(() => {
      platesCache = null;
      return [];
    }));

export function DepthScene({
  region,
  data,
  loading,
  error,
  dark,
  selectedId,
  onPick,
}: {
  region: DepthRegion | null;
  data: HistoryResult | null;
  loading: boolean;
  error: string | null;
  dark: boolean;
  selectedId: string | null;
  onPick: (q: QuakeFeature | null) => void;
}) {
  const [lines, setLines] = useState<DepthLine[]>([]);
  useEffect(() => {
    let live = true;
    loadPlateLines().then((l) => live && setLines(l));
    return () => {
      live = false;
    };
  }, []);

  const points: DepthPoint[] = useMemo(
    () =>
      (data?.features ?? []).map((f) => ({
        id: f.properties.id,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depth: Math.max(0, f.properties.depth),
        mag: f.properties.mag,
        color: depthColor(f.properties.depth),
        label: `M${f.properties.mag.toFixed(1)} · ${f.properties.depth} km deep · ${f.properties.place}`,
      })),
    [data]
  );
  const byId = useMemo(() => new Map((data?.features ?? []).map((f) => [f.properties.id, f])), [data]);

  return (
    <div className="atlas-space absolute inset-0 z-[5]">
      {region && data && (
        <DepthView
          bbox={region.bbox}
          points={points}
          lines={lines}
          imagery
          selectedId={selectedId}
          onPick={(id) => onPick(id ? byId.get(id) ?? null : null)}
          dark={dark}
        />
      )}
      <div className="pointer-events-none absolute left-4 top-[6.5rem] max-w-[min(26rem,60%)] space-y-1 sm:top-24">
        {region && <p className="font-mono text-sm uppercase tracking-[0.25em] text-cyan-100">{region.name}</p>}
        {region?.blurb && <p className="text-[12px] leading-snug text-slate-300/80">{region.blurb}</p>}
        {data && region && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            {data.count.toLocaleString()} quakes · M{region.minmag}+ · last {region.years} yr
          </p>
        )}
        {loading && <p className="font-mono text-[11px] uppercase tracking-wider text-cyan-200/70">Loading the USGS catalog…</p>}
        {error && <p className="text-xs text-rose-400">USGS: {error}</p>}
      </div>
    </div>
  );
}

/** Bottom chip bar in 3D mode: preset regions + "my view". */
export function DepthRegionBar({
  regions,
  activeKey,
  onSelect,
  onThisView,
}: {
  regions: DepthRegion[];
  activeKey: string;
  onSelect: (key: string) => void;
  onThisView: () => void;
}) {
  const chip = (on: boolean) =>
    `shrink-0 rounded-xl px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
      on ? "border border-cyan-300/40 bg-cyan-400/15 text-cyan-100 shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]" : "border border-transparent text-slate-300 hover:text-white"
    }`;
  return (
    <div className={`${hudGlass} no-scrollbar flex gap-1 overflow-x-auto p-1`}>
      {regions.map((r) => (
        <button key={r.key} type="button" onClick={() => onSelect(r.key)} className={chip(r.key === activeKey)} title={r.blurb}>
          {r.name}
        </button>
      ))}
      <button type="button" onClick={onThisView} className={`${chip(activeKey === "view")} inline-flex items-center gap-1.5`} title="Use the area you were looking at on the map">
        <Crosshair className="h-3.5 w-3.5" /> My view
      </button>
    </div>
  );
}
