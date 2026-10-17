"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { SeafloorDive, type DiveTelemetry } from "@/components/atlas/SeafloorDive";
import { NCEI_DEM_INFO } from "@/components/atlas/nceiDem";
import { HudLabel, HudPanel, hudGlass } from "@/components/atlas/Hud";
import { metresToFeet } from "@/utils/geo/wrecks";

/* ------------------------------------------------------------------ */
/*  The descent: sink from the surface to a wreck, with a depth gauge  */
/*  through the ocean's light zones (WHOI) and an honest card about    */
/*  where the depth figure comes from.                                 */
/* ------------------------------------------------------------------ */

export interface DiveTarget {
  name: string;
  center: [number, number];
  /** depth to dive to (m), if published or charted */
  depth: number | null;
  /** where that depth comes from */
  depthSource: "published" | "charted" | null;
}

const WHOI = "https://www.whoi.edu/know-your-ocean/ocean-topics/how-the-ocean-works/ocean-zones/";

/** Ocean light zones (WHOI). The abyss has no single agreed upper bound, so it gets none here. */
const ZONES = [
  { from: 0, to: 200, name: "Sunlight zone", color: "#22d3ee", note: "Sunlight reaches only about 200 m down." },
  { from: 200, to: 1000, name: "Twilight zone", color: "#3b82f6", note: "Light fades out between about 200 and 1,000 m." },
  { from: 1000, to: 4000, name: "Midnight zone", color: "#312e81", note: "Below about 1,000 m it is dark for good." },
  { from: 4000, to: 11000, name: "The abyss", color: "#0f0a2e", note: "The deep sea floor and trenches." },
];
const zoneAt = (d: number) => ZONES.find((z) => d < z.to) ?? ZONES[ZONES.length - 1];
const fmt = (m: number) => `${Math.round(m).toLocaleString()} m · ${metresToFeet(m).toLocaleString()} ft`;

export function Descent({ target, onExit }: { target: DiveTarget; onExit: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [restart, setRestart] = useState(0);
  const [tele, setTele] = useState<DiveTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const goal = target.depth ?? tele?.floor ?? 0;
  const depth = tele?.depth ?? 0;
  const zone = zoneAt(depth);
  // gauge on a square-root scale so 70 m and 3,800 m both read
  const maxScale = Math.max(250, goal * 1.15);
  const y = (d: number) => `${Math.min(100, (Math.sqrt(d) / Math.sqrt(maxScale)) * 100)}%`;

  return (
    // the dive is always "underwater dark", whatever the site theme
    <div className="dark absolute inset-0 z-40 bg-[#04121c] text-slate-100">
      <SeafloorDive center={target.center} depth={target.depth} playing={playing} restart={restart} onTelemetry={setTele} onError={setError} className="absolute inset-0" />
      {!tele && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-cyan-100/80">Sounding the seafloor…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className={`${hudGlass} max-w-md px-4 py-3 text-sm text-rose-300`}>Couldn&apos;t load the seafloor here ({error}).</p>
        </div>
      )}

      {/* ── the wreck card ────────────────────────────────────────── */}
      <HudPanel className="absolute left-3 top-3 z-30 w-[min(22rem,calc(100vw-1.5rem))] px-4 py-3 sm:left-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <HudLabel className="!text-cyan-200/70">Descent</HudLabel>
            <p className="mt-0.5 font-mono text-base font-semibold uppercase tracking-[0.12em] text-white">{target.name}</p>
          </div>
          <button type="button" onClick={onExit} aria-label="Back to the map" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="mt-2 space-y-1.5 text-[12px]">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">{target.depthSource === "published" ? "Wreck depth (published)" : target.depthSource === "charted" ? "Depth over wreck (charted)" : "Seafloor here (model)"}</dt>
            <dd className="font-mono tabular-nums text-white">{goal ? fmt(goal) : "…"}</dd>
          </div>
          {target.depthSource && tele && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Seafloor in the model</dt>
              <dd className="font-mono tabular-nums text-slate-300">{fmt(tele.floor)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-2 text-[10.5px] leading-snug text-slate-400">
          {tele?.source === "terrarium" ? (
            <>Seafloor: AWS Terrarium bathymetry (SRTM15+, ETOPO, NOAA coastal relief) — NOAA&apos;s mosaic didn&apos;t answer, so this is coarser.</>
          ) : (
            <>
              Seafloor:{" "}
              <a href={NCEI_DEM_INFO} target="_blank" rel="noopener noreferrer" className="text-cyan-300/80 hover:text-cyan-200">
                NOAA NCEI bathymetry
              </a>{" "}
              — the best survey NOAA has here, down to ~3 m along U.S. coasts, GEBCO far offshore.
            </>
          )}{" "}
          Heights ×{tele?.exaggeration ?? "…"}; light and sand are illustrative. The ring marks the wreck&apos;s position, not its shape.
        </p>
      </HudPanel>

      {/* ── depth gauge ───────────────────────────────────────────── */}
      <HudPanel className="absolute bottom-24 right-3 top-3 z-30 hidden w-[150px] flex-col px-3 py-3 sm:flex">
        <HudLabel className="!tracking-[0.15em]">Depth</HudLabel>
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">{depth.toLocaleString()} m</p>
        <p className="font-mono text-[10px] text-slate-400">{metresToFeet(depth).toLocaleString()} ft</p>
        <div className="relative mt-3 flex-1">
          {ZONES.filter((z) => z.from < maxScale).map((z) => (
            <div key={z.name} className="absolute left-0 w-3 rounded-sm" style={{ top: y(z.from), height: `calc(${y(Math.min(z.to, maxScale))} - ${y(z.from)})`, background: z.color }} title={z.name} />
          ))}
          {ZONES.filter((z) => z.from > 0 && z.from < maxScale).map((z) => (
            <span key={z.name} className="absolute left-5 -translate-y-1/2 font-mono text-[9px] text-slate-400" style={{ top: y(z.from) }}>
              {z.from.toLocaleString()} m
            </span>
          ))}
          {goal > 0 && (
            <span className="absolute left-0 right-0 border-t border-dashed border-amber-300/80" style={{ top: y(goal) }}>
              <span className="absolute -top-3.5 right-0 font-mono text-[9px] text-amber-200">wreck</span>
            </span>
          )}
          <span className="absolute -left-1 h-3 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-400 shadow-[0_0_12px_#22d3ee] transition-[top] duration-150" style={{ top: y(depth) }} />
        </div>
        <p className="mt-2 text-[11px] font-semibold" style={{ color: zone.color === "#0f0a2e" ? "#a5b4fc" : zone.color }}>
          {zone.name}
        </p>
        <p className="text-[10px] leading-snug text-slate-400">{zone.note}</p>
        <a href={WHOI} target="_blank" rel="noopener noreferrer" className="mt-1 font-mono text-[9px] uppercase tracking-wider text-cyan-300/70 hover:text-cyan-200">
          ↗ WHOI ocean zones
        </a>
      </HudPanel>

      {/* ── controls ──────────────────────────────────────────────── */}
      <div className="absolute inset-x-3 bottom-3 z-30 flex justify-center">
        <HudPanel className="flex items-center gap-2 px-3 py-2">
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/15 text-cyan-100">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setTele(null);
              setPlaying(true);
              setRestart((n) => n + 1);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Dive again
          </button>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10 sm:w-48">
            <div className="h-full bg-gradient-to-r from-cyan-300 to-indigo-600" style={{ width: `${Math.round((tele?.progress ?? 0) * 100)}%` }} />
          </div>
          <span className="font-mono text-[12px] font-semibold tabular-nums text-white sm:hidden">{depth} m</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-slate-500 md:inline">Space pause · drag to look once you arrive · Esc map</span>
        </HudPanel>
      </div>
    </div>
  );
}
