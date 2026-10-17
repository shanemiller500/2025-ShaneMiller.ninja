"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { History, Pause, Play, X } from "lucide-react";
import { CompareView, type CompareCamera } from "@/components/atlas/CompareView";
import { SATELLITE_LENS, topoLens } from "@/components/atlas/lenses";
import { HudLabel, HudPanel, hudGlass } from "@/components/atlas/Hud";
import { editionLabel, topoEditionsIn, type TopoEdition } from "@/utils/geo/topo";

/* ------------------------------------------------------------------ */
/*  Then & now: the town on the USGS topographic maps of its day       */
/*  (1880s →) on the left, the ground today on the right — drag the    */
/*  divider, step through the editions, or play them as a flip-book    */
/*  to watch a place appear on the map and fade off it.                */
/* ------------------------------------------------------------------ */

export interface ThenNowPlace {
  name: string;
  center: [number, number];
  zoom: number;
}

const STEP_MS = 2400;

/** The lng/lat box a web-mercator view of this size shows (CompareView only reports bounds after a move). */
export function viewBounds([lng, lat]: [number, number], zoom: number, width: number, height: number): [number, number, number, number] {
  const degPerPx = 360 / (512 * 2 ** zoom);
  const dLng = (width / 2) * degPerPx;
  const dLat = (height / 2) * degPerPx * Math.cos((lat * Math.PI) / 180);
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

export function ThenNow({ place, onExit }: { place: ThenNowPlace; onExit: () => void }) {
  const [initialCam] = useState<CompareCamera>({ center: place.center, zoom: place.zoom });
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(() => viewBounds(place.center, place.zoom, window.innerWidth, window.innerHeight));
  const [atPlace, setAtPlace] = useState(true);
  const [editions, setEditions] = useState<TopoEdition[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [edition, setEdition] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // the maps that cover the area on screen, oldest first
  const boundsKey = bounds ? bounds.map((v) => v.toFixed(3)).join(",") : "";
  useEffect(() => {
    if (!bounds) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setState("loading");
      topoEditionsIn(bounds, ctl.signal)
        .then((eds) => {
          setEditions(eds);
          setState("idle");
          setEdition((cur) => (cur && eds.some((e) => e.key === cur) ? cur : eds[0]?.key ?? null));
        })
        .catch(() => !ctl.signal.aborted && setState("error"));
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  // flip-book: step through the editions
  const editionsRef = useRef(editions);
  editionsRef.current = editions;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const eds = editionsRef.current ?? [];
      if (eds.length < 2) return setPlaying(false);
      setEdition((cur) => {
        const i = eds.findIndex((e) => e.key === cur);
        return eds[(i + 1) % eds.length].key;
      });
    }, STEP_MS);
    return () => clearInterval(t);
  }, [playing]);

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

  const chosen = editions?.find((e) => e.key === edition) ?? null;
  const lenses = useMemo(() => [{ ...topoLens(chosen?.ids), label: chosen ? `USGS topo · ${chosen.year}` : "Old topo map" }, { ...SATELLITE_LENS, label: "Today" }], [chosen]);
  const none = state === "idle" && editions?.length === 0;

  return (
    <div className="absolute inset-0 z-40 bg-[#0c0a09]">
      <CompareView
        lenses={lenses}
        layout="swipe"
        initial={initialCam}
        labelOffset={64}
        onView={(v) => {
          setBounds(v.bounds);
          setAtPlace(Math.abs(v.center[0] - place.center[0]) < 0.003 && Math.abs(v.center[1] - place.center[1]) < 0.003);
        }}
        className="absolute inset-0"
      />

      {/* the town, while the view is still on it */}
      {atPlace && (
        // a ring big enough to read around the swipe handle, which sits at the same spot
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <span className="block h-[92px] w-[92px] rounded-full border-2 border-dashed border-amber-300/80 shadow-[0_0_24px_-4px_#fbbf24]" />
          <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">{place.name} was here</span>
        </div>
      )}

      <HudPanel className="absolute left-3 top-3 z-30 w-[min(24rem,calc(100vw-1.5rem))] px-4 py-3 sm:left-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <HudLabel className="!text-amber-200/80">Then &amp; now</HudLabel>
            <p className="mt-0.5 truncate font-mono text-base font-semibold uppercase tracking-[0.12em] text-white">{place.name}</p>
          </div>
          <button type="button" onClick={onExit} aria-label="Back to the map" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-slate-300">
          {none
            ? "The USGS historical topo maps cover the United States only — there's no old survey sheet here."
            : "The U.S. Geological Survey's map of the day on the left, the ground today on the right. Drag the divider, or press play to flip through the surveys and watch the town appear on the map — and fade off it."}
        </p>
      </HudPanel>

      <HudPanel className="absolute inset-x-3 bottom-3 z-30 px-3 py-2 sm:left-4 sm:right-auto sm:max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={!editions || editions.length < 2}
            aria-label={playing ? "Pause" : "Play through the editions"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-400/15 text-amber-100 disabled:opacity-30"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <History className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <HudLabel className="shrink-0 !text-amber-200/80">Survey</HudLabel>
          {state === "loading" && <span className="animate-pulse font-mono text-[10px] uppercase tracking-wider text-amber-200/70">Searching the map archive…</span>}
          {state === "error" && <span className="text-[11px] text-rose-300">The map archive didn&apos;t answer — try moving the map.</span>}
          {none && <span className="text-[11px] text-slate-500">No USGS topo maps here.</span>}
          {chosen && <span className="font-mono text-[12px] font-semibold tabular-nums text-white">{chosen.year}</span>}
        </div>
        <div className={`${hudGlass} no-scrollbar mt-1.5 flex gap-1 overflow-x-auto !border-0 !bg-transparent pb-0.5 !shadow-none`}>
          {editions?.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => {
                setPlaying(false);
                setEdition(e.key);
              }}
              aria-pressed={e.key === chosen?.key}
              title={e.names.join(", ")}
              className={`shrink-0 rounded-lg border px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors ${
                e.key === chosen?.key ? "border-amber-300/60 bg-amber-400/15 text-amber-100" : "border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              {editionLabel(e)}
            </button>
          ))}
        </div>
      </HudPanel>
    </div>
  );
}
