"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Trees, X } from "lucide-react";
import { PointCloudView, type CloudColor } from "@/components/atlas/PointCloudView";
import { HudLabel, HudPanel, HudSwitch, hudGlass } from "@/components/atlas/Hud";
import { loadPointCloud, type EptCandidate, type PointCloud } from "@/utils/geo/ept";
import { SITES, SITE_KINDS, type HiddenSite } from "./sites";

/* ------------------------------------------------------------------ */
/*  The laser points themselves: a few hundred metres of a USGS lidar  */
/*  survey around a site, streamed straight from the public bucket.    */
/*  "Strip the trees" keeps only the returns classed as ground.        */
/* ------------------------------------------------------------------ */

export type EptIndex = Record<string, EptCandidate[]>;

const EXAGS = [1, 2, 4];

export function Cloud({ site, ept, onPick, onExit }: { site: HiddenSite; ept: EptIndex; onPick: (id: string) => void; onExit: () => void }) {
  const [cloud, setCloud] = useState<PointCloud | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ stage: string; done: number; total: number; dataset: string } | null>(null);
  const [strip, setStrip] = useState(false);
  const [color, setColor] = useState<CloudColor>("class");
  const [exag, setExag] = useState(site.kind === "earthwork" || site.kind === "landform" ? 2 : 1);
  const [spin, setSpin] = useState(true);
  const candidates = ept[site.id] ?? [];

  useEffect(() => {
    setCloud(null);
    setError(null);
    setStrip(false);
    if (!candidates.length) return;
    const ctl = new AbortController();
    loadPointCloud(candidates, site.center, { halfSize: site.cloudHalf, budget: 2_200_000, signal: ctl.signal, onProgress: setProgress })
      .then((c) => {
        setCloud(c);
        // let people see the canopy first, then peel it away
        setTimeout(() => !ctl.signal.aborted && setStrip(true), 2600);
      })
      .catch((e) => !ctl.signal.aborted && setError((e as Error).message));
    return () => ctl.abort();
    // a new site (or the dataset index arriving) → a new download
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id, candidates.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key.toLowerCase() === "t") setStrip((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const kind = SITE_KINDS[site.kind];
  const year = cloud ? candidates.find((c) => c.name === cloud.dataset)?.year : undefined;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const withCloud = SITES.filter((s) => (ept[s.id] ?? []).length);

  return (
    <div className="absolute inset-0 z-20 bg-[#020604]">
      {cloud && <PointCloudView cloud={cloud} color={color} strip={strip} exaggeration={exag} autoRotate={spin} className="absolute inset-0" />}

      {!cloud && !error && candidates.length > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-lime-200/80">{progress?.stage ?? "Finding the survey"}…</p>
          <div className="h-1 w-64 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-lime-400 to-emerald-500 transition-[width] duration-300" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          <p className="font-mono text-[10px] text-slate-500">{progress?.dataset ?? ""}</p>
        </div>
      )}
      {(error || !candidates.length) && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className={`${hudGlass} max-w-md px-4 py-3 text-center text-sm text-slate-300`}>
            {candidates.length ? `Couldn't load the point cloud (${error}).` : "There's no public USGS point cloud here — Washington flies and publishes its own lidar. The lidar views on the map still work."}
          </p>
        </div>
      )}

      {/* ── left card ─────────────────────────────────────────────── */}
      <HudPanel className="absolute left-3 top-[104px] z-30 w-[min(22rem,calc(100vw-1.5rem))] px-4 py-3 sm:left-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <HudLabel className="!text-lime-200/70">Laser returns · USGS 3DEP</HudLabel>
            <p className="mt-0.5 font-mono text-base font-semibold uppercase tracking-[0.15em] text-white">{site.name}</p>
            <p className="text-[12px] text-slate-400">{site.where}</p>
          </div>
          <button type="button" onClick={onExit} aria-label="Back to the map" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {cloud && (
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
            <Row k="Points" v={cloud.count.toLocaleString()} />
            <Row k="Ground hits" v={`${Math.round((cloud.groundCount / cloud.count) * 100)}%`} />
            <Row k="Area" v={`${cloud.halfSize * 2} × ${cloud.halfSize * 2} m`} />
            <Row k="Relief" v={`${Math.round(cloud.zRange[1])} m`} />
            <div className="col-span-2 truncate font-mono text-[10px] text-slate-500" title={cloud.dataset}>
              {cloud.dataset}
              {year ? ` · flown ${year}` : ""}
            </div>
          </dl>
        )}
        <p className="mt-3 hidden text-[12px] leading-snug text-slate-300 sm:block">
          Every dot is one laser pulse bouncing back to the plane. Some reach the ground through gaps in the leaves — strip the rest away and the shape of the land is left.
        </p>
        <p className="mt-2 hidden text-[11px] leading-snug text-slate-400 sm:block">
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: kind.color }}>
            Look for ·{" "}
          </span>
          {site.look}
        </p>
      </HudPanel>

      {/* ── bottom controls ──────────────────────────────────────── */}
      {cloud && (
        <div className="absolute inset-x-3 bottom-[60px] z-30 flex justify-center">
          <HudPanel className="flex max-w-full flex-wrap items-center justify-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setStrip((v) => !v)}
              aria-pressed={strip}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-mono text-[11px] uppercase tracking-wider transition-all ${
                strip ? "border-lime-300/60 bg-lime-400/15 text-lime-100 shadow-[0_0_20px_-4px_rgba(163,230,53,0.8)]" : "border-white/15 text-slate-200 hover:text-white"
              }`}
            >
              <Trees className="h-3.5 w-3.5" /> {strip ? "Trees stripped" : "Strip the trees"}
            </button>
            <HudSwitch
              id="pc-color"
              ariaLabel="Colour by"
              value={color}
              onChange={setColor}
              options={[
                { key: "class", label: "Class", title: "Ground, vegetation, water, buildings" },
                { key: "height", label: "Height" },
                { key: "intensity", label: "Intensity", title: "How strongly each pulse bounced back" },
              ]}
            />
            <button type="button" onClick={() => setExag((e) => EXAGS[(EXAGS.indexOf(e) + 1) % EXAGS.length])} title="Vertical exaggeration" className="h-9 rounded-xl border border-white/10 px-2.5 font-mono text-[11px] text-slate-300 hover:text-white">
              {exag}× height
            </button>
            <button type="button" onClick={() => setSpin((v) => !v)} aria-label={spin ? "Stop rotating" : "Rotate"} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:text-white">
              {spin ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-slate-500 md:inline">Drag to orbit · T strip · Esc map</span>
          </HudPanel>
        </div>
      )}

      <div className={`${hudGlass} no-scrollbar absolute inset-x-3 bottom-3 z-30 flex gap-1 overflow-x-auto p-1 sm:left-4`}>
        {withCloud.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className={`shrink-0 rounded-xl border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              s.id === site.id ? "border-lime-300/40 bg-lime-400/10 text-lime-100" : "border-transparent text-slate-300 hover:text-white"
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">{k}</dt>
      <dd className="truncate font-mono text-[13px] font-semibold tabular-nums text-white">{v}</dd>
    </div>
  );
}
