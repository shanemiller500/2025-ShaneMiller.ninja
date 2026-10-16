"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Pause, Play, RotateCcw, X } from "lucide-react";
import { BasinFill } from "@/components/atlas/BasinFill";
import { waterAt, type Basin, type LakeGeometry } from "@/components/atlas/basinGrid";
import { HudLabel, HudPanel, hudGlass } from "@/components/atlas/Hud";
import { LAKE_FACTS, LAKE_SOURCES, lakeLabel, type LakeProps } from "./lakes";

/* ------------------------------------------------------------------ */
/*  Refill an Ice Age lake in 3D. Level, depth, area and volume are    */
/*  ESTIMATES from today's terrain and the mapped outline — the UI     */
/*  says so; the sourced figures for the big lakes sit beside them.    */
/* ------------------------------------------------------------------ */

const FILL_MS = 9000;
const ft = (m: number) => Math.round(m * 3.28084).toLocaleString();

export function Refill({
  lake,
  lakes,
  onPick,
  onExit,
}: {
  lake: GeoJSON.Feature<LakeGeometry, LakeProps>;
  /** the biggest lakes, for the switcher */
  lakes: GeoJSON.Feature<LakeGeometry, LakeProps>[];
  onPick: (id: number) => void;
  onExit: () => void;
}) {
  const [level, setLevel] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [basin, setBasin] = useState<Basin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = lake.properties;
  const facts = p.name ? LAKE_FACTS[p.name] : undefined;

  // refill on open; the slider takes over whenever it's touched
  const start = useRef(0);
  useEffect(() => {
    if (!playing || !basin) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLevel(1);
      setPlaying(false);
      return;
    }
    start.current = performance.now() - level * FILL_MS;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start.current) / FILL_MS);
      setLevel(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // level is only read when (re)starting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, basin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const stats = useMemo(() => (basin ? waterAt(basin, basin.floor + level * (basin.shoreline - basin.floor)) : null), [basin, level]);
  const full = useMemo(() => (basin ? waterAt(basin, basin.shoreline) : null), [basin]);

  return (
    <div className="absolute inset-0 z-20 bg-[#03020a]">
      <BasinFill
        key={p.id}
        geometry={lake.geometry}
        level={level}
        className="absolute inset-0"
        onReady={(b, err) => {
          setBasin(b);
          setError(err ?? null);
          setLevel(0);
          setPlaying(!!b);
        }}
      />
      {!basin && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-sky-200/80">Draining the basin… loading terrain</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className={`${hudGlass} px-4 py-3 text-sm text-rose-300`}>Couldn&apos;t load the terrain for this basin ({error}).</p>
        </div>
      )}

      {/* ── left: the lake card ───────────────────────────────────── */}
      <HudPanel className="absolute left-3 top-[104px] z-30 max-h-[calc(100%-260px)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto px-4 py-3 sm:left-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <HudLabel className="!text-sky-200/70">Ice Age lake · refilled</HudLabel>
            <p className="mt-0.5 font-mono text-lg font-semibold uppercase tracking-[0.18em] text-white">{lakeLabel(p)}</p>
            {facts && <p className="text-[12px] text-slate-400">{facts.tagline}</p>}
          </div>
          <button type="button" onClick={onExit} aria-label="Back to the map" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {facts ? (
          <ul className="mt-3 hidden space-y-2 sm:block">
            {facts.facts.map((f) => (
              <li key={f.text} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-300" />
                <span>
                  {f.text}{" "}
                  <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-sky-300/70 hover:text-sky-200">
                    ↗ {f.source.label.split(" ")[0]}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 hidden text-[12.5px] leading-relaxed text-slate-300 sm:block">
            One of the Great Basin&apos;s Ice Age lakes, outlined from the shorelines it left behind. Mapped extent: {p.areaKm2.toLocaleString()} km² ({Math.round(p.areaKm2 / 2.58999).toLocaleString()} sq mi).
          </p>
        )}
        <p className="mt-3 text-[10.5px] leading-snug text-slate-500">
          Outline:{" "}
          <a href={LAKE_SOURCES.layer.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-slate-300">
            {LAKE_SOURCES.layer.label}
          </a>
          . Terrain: Mapzen/AWS · imagery: Esri. The cyan line is the old shoreline.
        </p>
      </HudPanel>

      {/* ── bottom: level control + estimates ─────────────────────── */}
      <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col items-center gap-2">
        <HudPanel className="w-full max-w-[760px] px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (level >= 1 ? (setLevel(0), setPlaying(true)) : setPlaying((v) => !v))}
              disabled={!basin}
              aria-label={playing ? "Pause" : level >= 1 ? "Refill again" : "Refill"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/40 bg-sky-400/15 text-sky-100 disabled:opacity-40"
            >
              {playing ? <Pause className="h-4 w-4" /> : level >= 1 ? <RotateCcw className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <span>Dry floor</span>
                <span className="text-sky-200">Water level</span>
                <span>Highstand</span>
              </span>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(level * 1000)}
                disabled={!basin}
                onChange={(e) => {
                  setPlaying(false);
                  setLevel(Number(e.target.value) / 1000);
                }}
                aria-label="Water level"
                className="w-full accent-sky-400"
              />
            </label>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            <Stat label="Surface" value={stats ? `${Math.round(stats.level).toLocaleString()} m · ${ft(stats.level)} ft` : "—"} />
            <Stat label="Deepest" value={stats ? `${Math.round(stats.maxDepth).toLocaleString()} m · ${ft(stats.maxDepth)} ft` : "—"} />
            <Stat label="Area" value={stats ? `${Math.round(stats.areaKm2).toLocaleString()} km²` : "—"} />
            <Stat label="Water" value={stats ? `${stats.volumeKm3 >= 10 ? Math.round(stats.volumeKm3).toLocaleString() : stats.volumeKm3.toFixed(1)} km³` : "—"} />
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-slate-500">
            <Droplets className="mt-px h-3 w-3 shrink-0 text-sky-300/70" />
            Estimated from today&apos;s terrain: the highstand is the median ground height along the mapped shoreline
            {full ? ` (${Math.round(full.level).toLocaleString()} m)` : ""}. Since then sediment has settled on the basin floors and the crust has rebounded, so the real lake's depths differed somewhat.
          </p>
        </HudPanel>
        <div className={`${hudGlass} no-scrollbar flex max-w-full gap-1 overflow-x-auto p-1`}>
          {lakes.map((l) => (
            <button
              key={l.properties.id}
              type="button"
              onClick={() => onPick(l.properties.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                l.properties.id === p.id ? "border border-sky-300/40 bg-sky-400/15 text-sky-100" : "border border-transparent text-slate-300 hover:text-white"
              }`}
            >
              {lakeLabel(l.properties)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <span className="block truncate font-mono text-[13px] font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}
