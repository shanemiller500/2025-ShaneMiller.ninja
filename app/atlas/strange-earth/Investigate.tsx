"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns2, Crosshair, Grid2x2, History, Mountain, MountainSnow, X } from "lucide-react";
import { CompareView, type CompareCamera, type CompareLayout } from "@/components/atlas/CompareView";
import { GEOLOGY_LENS, LIDAR_LENS, SATELLITE_LENS, topoLens, type Lens } from "@/components/atlas/lenses";
import { HudLabel, HudPanel, HudSwitch, hudGlass } from "@/components/atlas/Hud";
import { formatAge, geologyAt, type GeoUnit } from "@/utils/geo/strange";
import { editionLabel, elevationAt, topoEditionsIn, type TopoEdition } from "@/utils/geo/topo";
import { ANOMALIES, type Anomaly } from "./featured";

/* ------------------------------------------------------------------ */
/*  Investigate: one spot through four lenses — satellite, bare-earth  */
/*  lidar, geology and the old USGS topo maps (step back through the   */
/*  editions) — with a live readout of what's under the crosshair.     */
/* ------------------------------------------------------------------ */

type LensId = "satellite" | "lidar" | "geology" | "topo";
const LENS_IDS: LensId[] = ["satellite", "lidar", "geology", "topo"];
/** Below this zoom the topo index would list thousands of sheets. */
const TOPO_LIST_ZOOM = 9;

export interface InvestigateState {
  camera: CompareCamera;
  layout: CompareLayout;
  left: LensId;
  right: LensId;
  edition: string | null;
}

export function Investigate({
  initial,
  focus,
  onExit,
  onState,
}: {
  initial: Partial<InvestigateState> & { camera: CompareCamera };
  focus?: Anomaly;
  onExit: (camera: CompareCamera) => void;
  onState?: (s: InvestigateState) => void;
}) {
  const [layout, setLayout] = useState<CompareLayout>(initial.layout ?? "swipe");
  const [left, setLeft] = useState<LensId>(initial.left ?? "satellite");
  const [right, setRight] = useState<LensId>(initial.right ?? "lidar");
  const [view, setView] = useState<{ center: [number, number]; zoom: number; bounds: [number, number, number, number] } | null>(null);
  const [flyTo, setFlyTo] = useState<(CompareCamera & { nonce: number }) | null>(null);
  const [initialCam] = useState(initial.camera);

  /* ── old topo editions in view ─────────────────────────────────── */
  const [editions, setEditions] = useState<TopoEdition[] | null>(null);
  const [editionsState, setEditionsState] = useState<"idle" | "loading" | "error" | "zoom">("idle");
  const [edition, setEdition] = useState<string | null>(initial.edition ?? null);
  const boundsKey = view ? view.bounds.map((v) => v.toFixed(3)).join(",") : "";
  useEffect(() => {
    if (!view) return;
    if (view.zoom < TOPO_LIST_ZOOM) {
      setEditionsState("zoom");
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setEditionsState("loading");
      topoEditionsIn(view.bounds, ctl.signal)
        .then((eds) => {
          setEditions(eds);
          setEditionsState("idle");
        })
        .catch(() => !ctl.signal.aborted && setEditionsState("error"));
    }, 450);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);
  const chosen = editions?.find((e) => e.key === edition) ?? null;
  /** Pick an edition; a small-scale sheet is a blur up close, so back off to the zoom it was drawn for. */
  const pickEdition = (e: TopoEdition) => {
    setEdition(e.key);
    if (layout === "swipe" && left !== "topo" && right !== "topo") setRight("topo");
    const natural = e.scale >= 250000 ? 11 : e.scale >= 100000 ? 12.3 : e.scale >= 62500 ? 13.2 : 14.5;
    if (view && view.zoom > natural + 0.5) setFlyTo({ center: view.center, zoom: natural, nonce: Date.now() });
  };

  const lenses = useMemo<Record<LensId, Lens>>(() => ({ satellite: SATELLITE_LENS, lidar: LIDAR_LENS, geology: GEOLOGY_LENS, topo: topoLens(chosen?.ids) }), [chosen]);
  const shown = layout === "swipe" ? [lenses[left], lenses[right]] : LENS_IDS.map((id) => lenses[id]);
  const topoShown = layout === "grid" || left === "topo" || right === "topo";

  /* ── readout under the crosshair ───────────────────────────────── */
  const [elev, setElev] = useState<number | null | undefined>(undefined);
  const [rock, setRock] = useState<GeoUnit | null | undefined>(undefined);
  const centerKey = view ? `${view.center[0].toFixed(4)},${view.center[1].toFixed(4)}` : "";
  useEffect(() => {
    if (!view) return;
    const ctl = new AbortController();
    setElev(undefined);
    setRock(undefined);
    const t = setTimeout(() => {
      const [lng, lat] = view.center;
      elevationAt(lng, lat, ctl.signal).then(setElev).catch(() => !ctl.signal.aborted && setElev(null));
      geologyAt(lng, lat, ctl.signal).then(setRock).catch(() => !ctl.signal.aborted && setRock(null));
    }, 500);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey]);

  /* ── report state for share links ──────────────────────────────── */
  const camRef = useRef<CompareCamera>(initial.camera);
  useEffect(() => {
    if (view) camRef.current = { center: view.center, zoom: view.zoom };
    onState?.({ camera: camRef.current, layout, left, right, edition });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, layout, left, right, edition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") onExit(camRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const lensOptions = LENS_IDS.map((id) => ({ key: id, label: lenses[id].label }));
  const goTo = (a: Anomaly) => setFlyTo({ center: a.center, zoom: Math.min(a.fly.zoom, 14), nonce: Date.now() });

  return (
    <div className="absolute inset-0 z-20 bg-[#03020a]">
      <CompareView lenses={shown} layout={layout} initial={initialCam} flyTo={flyTo} onView={setView} labelOffset={140} className="absolute inset-0" />

      {/* ── controls under the title bar ──────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-3 top-[104px] z-30 flex flex-wrap items-start gap-2 sm:left-4">
        <HudSwitch
          id="inv-layout"
          ariaLabel="Layout"
          value={layout}
          onChange={setLayout}
          className="pointer-events-auto"
          options={[
            { key: "swipe", label: <><Columns2 className="h-3.5 w-3.5" />Swipe</> },
            { key: "grid", label: <><Grid2x2 className="h-3.5 w-3.5" />All four</> },
          ]}
        />
        {layout === "swipe" && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <HudSwitch id="inv-left" ariaLabel="Left view" value={left} onChange={(k) => (k === right ? (setRight(left), setLeft(k)) : setLeft(k))} options={lensOptions} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">vs</span>
            <HudSwitch id="inv-right" ariaLabel="Right view" value={right} onChange={(k) => (k === left ? (setLeft(right), setRight(k)) : setRight(k))} options={lensOptions} />
          </div>
        )}
      </div>

      {/* ── readout ───────────────────────────────────────────────── */}
      <HudPanel className="absolute bottom-[112px] right-3 z-30 hidden w-[300px] p-3 md:block">
        <div className="flex items-center justify-between">
          <HudLabel className="flex items-center gap-1.5 !text-fuchsia-200/80">
            <Crosshair className="h-3.5 w-3.5" /> Under the crosshair
          </HudLabel>
          <button type="button" onClick={() => onExit(camRef.current)} aria-label="Back to the map" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Readout view={view} elev={elev} rock={rock} editions={editions} editionsState={editionsState} />
        {focus && (
          <p className="mt-3 border-t border-white/10 pt-2 text-[12px] leading-snug text-slate-300">
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: focus.accent }}>
              {focus.name} ·{" "}
            </span>
            {focus.look}
          </p>
        )}
      </HudPanel>

      {/* ── bottom: edition timeline + jump list ──────────────────── */}
      <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col gap-2 sm:left-4">
        <HudPanel className="px-3 py-2">
          {/* phones: the readout panel doesn't fit — one line instead */}
          <p className="mb-1.5 truncate font-mono text-[10px] uppercase tracking-wider text-slate-300 md:hidden">
            <Crosshair className="mr-1 inline h-3 w-3 text-fuchsia-300" />
            {elev != null ? `${Math.round(elev).toLocaleString()} m · ` : ""}
            {rock ? rock.name : rock === undefined ? "reading…" : "—"}
          </p>
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <HudLabel className="shrink-0 !text-amber-200/80">Old topo edition</HudLabel>
            {!topoShown && <span className="truncate text-[11px] text-slate-500">— pick a year to swap it in</span>}
          </div>
          <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
            <EditionChip active={!chosen} onClick={() => setEdition(null)} label="Newest" />
            {editionsState === "zoom" && <span className="self-center px-2 text-[11px] text-slate-500">Zoom in to list the old maps of this area</span>}
            {editionsState === "loading" && <span className="animate-pulse self-center px-2 font-mono text-[10px] uppercase tracking-wider text-amber-200/70">Searching the map archive…</span>}
            {editionsState === "error" && <span className="self-center px-2 text-[11px] text-rose-300">The map archive didn&apos;t answer — try moving the map.</span>}
            {editionsState === "idle" && editions?.length === 0 && <span className="self-center px-2 text-[11px] text-slate-500">No USGS topo maps here (U.S. only).</span>}
            {editionsState !== "zoom" &&
              editions?.map((e) => <EditionChip key={e.key} active={e.key === chosen?.key} onClick={() => pickEdition(e)} label={editionLabel(e)} title={e.names.join(", ")} />)}
          </div>
        </HudPanel>
        <div className={`${hudGlass} no-scrollbar flex max-w-full gap-1 overflow-x-auto p-1`}>
          {ANOMALIES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => goTo(a)}
              className="shrink-0 rounded-xl border border-transparent px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:border-white/10 hover:text-white"
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: a.accent }} />
              {a.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditionChip({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`shrink-0 rounded-lg border px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors ${
        active ? "border-amber-300/60 bg-amber-400/15 text-amber-100 shadow-[0_0_14px_-4px_rgba(251,191,36,0.8)]" : "border-white/10 text-slate-300 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Readout({
  view,
  elev,
  rock,
  editions,
  editionsState,
}: {
  view: { center: [number, number]; zoom: number } | null;
  elev: number | null | undefined;
  rock: GeoUnit | null | undefined;
  editions: TopoEdition[] | null;
  editionsState: string;
}) {
  if (!view) return <p className="mt-2 animate-pulse font-mono text-[11px] text-slate-400">Locking on…</p>;
  const [lng, lat] = view.center;
  const oldest = editions?.[0];
  return (
    <dl className="mt-2 space-y-2 text-[12px]">
      <div className="flex justify-between gap-3">
        <dt className="text-slate-400">Position</dt>
        <dd className="font-mono tabular-nums text-slate-100">
          {Math.abs(lat).toFixed(4)}°{lat >= 0 ? "N" : "S"} {Math.abs(lng).toFixed(4)}°{lng >= 0 ? "E" : "W"}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="flex items-center gap-1 text-slate-400">
          <MountainSnow className="h-3 w-3" /> Elevation
        </dt>
        <dd className="font-mono tabular-nums text-slate-100">
          {elev === undefined ? <span className="animate-pulse text-slate-500">…</span> : elev == null ? "—" : `${Math.round(elev).toLocaleString()} m · ${Math.round(elev * 3.28084).toLocaleString()} ft`}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-1 text-slate-400">
          <Mountain className="h-3 w-3" /> Rock
        </dt>
        <dd className="mt-0.5 text-slate-100">
          {rock === undefined ? (
            <span className="animate-pulse text-slate-500">reading the geologic map…</span>
          ) : rock == null ? (
            "—"
          ) : (
            <span className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: rock.color }} />
              <span>
                {rock.name}
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  {rock.period}
                  {rock.bAge ? ` · up to ${formatAge(rock.bAge)} old` : ""}
                </span>
              </span>
            </span>
          )}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="flex items-center gap-1 text-slate-400">
          <History className="h-3 w-3" /> Old maps here
        </dt>
        <dd className="text-right font-mono tabular-nums text-slate-100">
          {editionsState === "zoom" ? "zoom in" : editionsState === "loading" ? "…" : editions ? (oldest ? `${editions.length} editions · since ${oldest.year}` : "none") : "—"}
        </dd>
      </div>
    </dl>
  );
}
