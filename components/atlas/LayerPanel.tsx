"use client";
import type { ReactNode } from "react";

import { Globe2, Mountain, MountainSnow, Satellite, Map as MapIcon, Square } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Legend } from "./Legend";
import type { AtlasLayer, Basemap, TerrainMode } from "./types";

interface LayerPanelProps {
  id: string;
  layers: AtlasLayer[];
  visible: Record<string, boolean>;
  onToggle: (id: string) => void;
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  terrain: TerrainMode;
  onTerrain: (t: TerrainMode) => void;
  /** Extra controls shown under a layer while it's on (e.g. a filter), keyed by layer id */
  extras?: Record<string, ReactNode>;
  className?: string;
}

/** Basemap + terrain switches and grouped layer toggles (each with its legend). */
export function LayerPanel({ id, layers, visible, onToggle, basemap, onBasemap, terrain, onTerrain, extras, className = "" }: LayerPanelProps) {
  // layers arrive in draw order (bottom first); list them top-down like any GIS layer panel
  const ordered = [...layers].reverse();
  const groups = Array.from(new Set(ordered.map((l) => l.group)));

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <PanelLabel>Base</PanelLabel>
        <Segmented
          id={`${id}-basemap`}
          ariaLabel="Basemap"
          value={basemap}
          onChange={onBasemap}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          options={[
            { key: "map", label: <><MapIcon className="h-3.5 w-3.5" /><span>Map</span></>, title: "Street map" },
            { key: "satellite", label: <><Satellite className="h-3.5 w-3.5" /><span>Satellite</span></>, title: "Satellite imagery" },
          ]}
        />
        <Segmented
          id={`${id}-terrain`}
          ariaLabel="Terrain"
          value={terrain}
          onChange={onTerrain}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          options={[
            { key: "flat", label: <><Square className="h-3.5 w-3.5" /><span>Flat</span></>, title: "No terrain" },
            { key: "relief", label: <><Mountain className="h-3.5 w-3.5" /><span>Relief</span></>, title: "Shaded relief" },
            { key: "3d", label: <><MountainSnow className="h-3.5 w-3.5" /><span>3D</span></>, title: "3D terrain (tilt with right-drag or two fingers)" },
          ]}
        />
      </div>

      {groups.map((g) => (
        <div key={g} className="space-y-1.5">
          <PanelLabel>{g}</PanelLabel>
          {ordered
            .filter((l) => l.group === g)
            .map((l) => {
              const on = !!visible[l.id];
              return (
                <div key={l.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggle(l.id)}
                    className="flex w-full items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded-lg"
                  >
                    <span
                      className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-indigo-500" : "bg-slate-300 dark:bg-white/15"}`}
                    >
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-[left] ${on ? "left-3.5" : "left-0.5"}`} />
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{l.label}</span>
                    {l.badge && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                        {l.badge}
                      </span>
                    )}
                  </button>
                  {on && (l.description || l.legend || extras?.[l.id]) && (
                    <div className="mt-2 space-y-1.5 pl-[38px]">
                      {extras?.[l.id]}
                      {l.description && <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{l.description}</p>}
                      {l.legend && <Legend items={l.legend} />}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
      <Globe2 className="h-3 w-3 opacity-60" />
      {children}
    </p>
  );
}
