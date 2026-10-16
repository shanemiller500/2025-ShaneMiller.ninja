"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns2, Grid2x2, History, X } from "lucide-react";
import { CompareView, type CompareCamera, type CompareLayout } from "@/components/atlas/CompareView";
import { SATELLITE_LENS, lidarViewLens, topoLens } from "@/components/atlas/lenses";
import { editionLabel, topoEditionsIn, type TopoEdition } from "@/utils/geo/topo";
import { HudLabel, HudPanel, HudSwitch, hudGlass } from "@/components/atlas/Hud";
import { LIDAR_VIEWS, lidarView, type LidarViewKey } from "@/utils/geo/lidar";
import { SITES, SITE_KINDS, type HiddenSite } from "./sites";

/* ------------------------------------------------------------------ */
/*  Peel: satellite on one side, bare-earth lidar on the other — drag  */
/*  the divider to strip the trees off. "All views" shows satellite    */
/*  beside three lidar renderings at once.                             */
/* ------------------------------------------------------------------ */

/** "then": an old USGS topo edition on the left, today's lidar on the right */
export type PeelLayout = CompareLayout | "then";

export interface PeelState {
  camera: CompareCamera;
  layout: PeelLayout;
  view: LidarViewKey;
  edition?: string | null;
}

export function Peel({
  initial,
  site,
  onExit,
  onState,
}: {
  initial: Partial<PeelState> & { camera: CompareCamera };
  site?: HiddenSite;
  onExit: (camera: CompareCamera) => void;
  onState?: (s: PeelState) => void;
}) {
  const [layout, setLayout] = useState<PeelLayout>(initial.layout ?? "swipe");
  const [view, setView] = useState<LidarViewKey>(initial.view ?? site?.view ?? "multi");
  const [focus, setFocus] = useState<HiddenSite | undefined>(site);
  const [flyTo, setFlyTo] = useState<(CompareCamera & { nonce: number }) | null>(null);
  const [initialCam] = useState(initial.camera);
  const cam = useRef<CompareCamera>(initial.camera);

  /* ── then & now: the old maps of the area on screen ─────────────── */
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [editions, setEditions] = useState<TopoEdition[] | null>(null);
  const [edState, setEdState] = useState<"idle" | "loading" | "error">("idle");
  const [edition, setEdition] = useState<string | null>(initial.edition ?? null);
  const boundsKey = bounds ? bounds.map((v) => v.toFixed(3)).join(",") : "";
  useEffect(() => {
    if (layout !== "then" || !bounds) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setEdState("loading");
      topoEditionsIn(bounds, ctl.signal)
        .then((eds) => {
          setEditions(eds);
          setEdState("idle");
          // start on the oldest map that covers this spot
          setEdition((cur) => (cur && eds.some((e) => e.key === cur) ? cur : eds[0]?.key ?? null));
        })
        .catch(() => !ctl.signal.aborted && setEdState("error"));
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, boundsKey]);
  const chosen = editions?.find((e) => e.key === edition) ?? null;

  const lenses = useMemo(() => {
    if (layout === "then") return [{ ...topoLens(chosen?.ids), label: chosen ? `Topo ${chosen.year}` : "Old topo map" }, lidarViewLens(lidarView(view))];
    if (layout === "swipe") return [SATELLITE_LENS, lidarViewLens(lidarView(view))];
    // satellite + the three most telling renderings
    const others = (["multi", "slope", "tinted", "contour"] as LidarViewKey[]).filter((k) => k !== view).slice(0, 2);
    return [SATELLITE_LENS, lidarViewLens(lidarView(view)), ...others.map((k) => lidarViewLens(lidarView(k)))];
  }, [layout, view, chosen]);

  useEffect(() => {
    onState?.({ camera: cam.current, layout, view, edition });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, view, edition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") onExit(cam.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const goTo = (s: HiddenSite) => {
    setFocus(s);
    setView(s.view);
    setFlyTo({ center: s.center, zoom: s.zoom, nonce: Date.now() });
  };

  return (
    <div className="absolute inset-0 z-20 bg-[#03020a]">
      <CompareView
        lenses={lenses}
        layout={layout === "then" ? "swipe" : layout}
        initial={initialCam}
        flyTo={flyTo}
        labelOffset={140}
        onView={(v) => {
          cam.current = { center: v.center, zoom: v.zoom };
          setBounds(v.bounds);
          onState?.({ camera: cam.current, layout, view, edition });
        }}
        className="absolute inset-0"
      />

      <div className="pointer-events-none absolute left-3 right-3 top-[104px] z-30 flex flex-wrap items-start gap-2 sm:left-4">
        <HudSwitch
          id="peel-layout"
          ariaLabel="Layout"
          value={layout}
          onChange={setLayout}
          className="pointer-events-auto"
          options={[
            { key: "swipe", label: <><Columns2 className="h-3.5 w-3.5" />Peel</> },
            { key: "grid", label: <><Grid2x2 className="h-3.5 w-3.5" />All views</> },
            { key: "then", label: <><History className="h-3.5 w-3.5" />Then &amp; now</>, title: "An old USGS topo map against today's lidar" },
          ]}
        />
        <HudSwitch id="peel-view" ariaLabel="Lidar view" value={view} onChange={setView} className="pointer-events-auto" options={LIDAR_VIEWS.map((v) => ({ key: v.key, label: v.label, title: v.blurb }))} />
      </div>

      {/* what to look for */}
      <HudPanel className="absolute bottom-[64px] right-3 z-30 hidden w-[300px] p-3 md:block">
        <div className="flex items-center justify-between">
          <HudLabel className="!text-lime-200/80">{focus ? focus.name : "Peel back the ground"}</HudLabel>
          <button type="button" onClick={() => onExit(cam.current)} aria-label="Back to the map" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-slate-300">
          {layout === "then"
            ? "The surveyor's map on the left, the ground today on the right. Look for roads, rail beds and towns that are gone — and earthworks the old maps never drew."
            : focus
              ? focus.look
              : "Drag the divider: satellite on the left, the bare ground the lidar measured on the right. Trees, crops and buildings vanish."}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">{lidarView(view).blurb}</p>
      </HudPanel>

      {layout === "then" && (
        <HudPanel className="absolute inset-x-3 bottom-[60px] z-30 px-3 py-2 sm:left-4 md:right-[324px]">
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <HudLabel className="shrink-0 !text-amber-200/80">Topo edition</HudLabel>
            {edState === "loading" && <span className="animate-pulse font-mono text-[10px] uppercase tracking-wider text-amber-200/70">Searching the map archive…</span>}
            {edState === "error" && <span className="text-[11px] text-rose-300">The map archive didn&apos;t answer — try moving the map.</span>}
            {edState === "idle" && editions?.length === 0 && <span className="text-[11px] text-slate-500">No USGS topo maps here.</span>}
          </div>
          <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
            {editions?.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setEdition(e.key)}
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
      )}

      <div className={`${hudGlass} no-scrollbar absolute inset-x-3 bottom-3 z-30 flex gap-1 overflow-x-auto p-1 sm:left-4`}>
        {SITES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(s)}
            className={`shrink-0 rounded-xl border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              focus?.id === s.id ? "border-lime-300/40 bg-lime-400/10 text-lime-100" : "border-transparent text-slate-300 hover:text-white"
            }`}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: SITE_KINDS[s.kind].color }} />
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
