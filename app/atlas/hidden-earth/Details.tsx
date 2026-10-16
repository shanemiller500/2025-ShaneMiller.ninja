"use client";

import { useEffect, useState } from "react";
import { Box, Layers2, MountainSnow } from "lucide-react";
import { DrawerLink, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { useWikiPhoto } from "@/components/atlas/useWikiPhoto";
import { lidarView } from "@/utils/geo/lidar";
import { formatAge, geologyAt, type GeoUnit } from "@/utils/geo/strange";
import { elevationAt } from "@/utils/geo/topo";
import { SITE_KINDS, siteById } from "./sites";

/* ------------------------------------------------------------------ */
/*  Drawers for Hidden Earth: a featured site, or the ground under a   */
/*  click (elevation from 3DEP + the bedrock from Macrostrat).         */
/* ------------------------------------------------------------------ */

export interface PeelTarget {
  center: [number, number];
  zoom: number;
  siteId?: string;
}

function PeelButton({ onClick, color }: { onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
      style={{ borderColor: `${color}80`, background: `${color}22`, boxShadow: `0 0 22px -6px ${color}` }}
    >
      <Layers2 className="h-4 w-4" /> Peel back the ground cover
    </button>
  );
}

function GroundReadout({ at }: { at: [number, number] }) {
  const [elev, setElev] = useState<number | null | undefined>(undefined);
  const [rock, setRock] = useState<GeoUnit | null | undefined>(undefined);
  useEffect(() => {
    const ctl = new AbortController();
    setElev(undefined);
    setRock(undefined);
    elevationAt(at[0], at[1], ctl.signal).then(setElev).catch(() => !ctl.signal.aborted && setElev(null));
    geologyAt(at[0], at[1], ctl.signal).then(setRock).catch(() => !ctl.signal.aborted && setRock(null));
    return () => ctl.abort();
  }, [at]);
  return (
    <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px]">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lime-200/80">
        <MountainSnow className="h-3.5 w-3.5" /> The ground here
      </p>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Bare-earth elevation</span>
        <span className="font-mono tabular-nums text-slate-100">
          {elev === undefined ? <span className="animate-pulse text-slate-500">…</span> : elev == null ? "—" : `${Math.round(elev).toLocaleString()} m · ${Math.round(elev * 3.28084).toLocaleString()} ft`}
        </span>
      </div>
      <div>
        <span className="text-slate-400">Bedrock</span>
        <p className="mt-0.5 text-slate-100">
          {rock === undefined ? (
            <span className="animate-pulse text-slate-500">reading the geologic map…</span>
          ) : rock == null ? (
            "—"
          ) : (
            <>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: rock.color }} />
              {rock.name}
              <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {rock.period}
                {rock.bAge ? ` · up to ${formatAge(rock.bAge)} old` : ""}
              </span>
            </>
          )}
        </p>
      </div>
      <p className="text-[10px] text-slate-500">USGS 3DEP (elevation) · Macrostrat CC-BY 4.0 (bedrock)</p>
    </section>
  );
}

export function HiddenDetails({
  picked,
  onClose,
  onPeel,
  onCloud,
  hasCloud,
}: {
  picked: Picked | null;
  onClose: () => void;
  onPeel: (t: PeelTarget) => void;
  onCloud?: (siteId: string) => void;
  hasCloud?: (siteId: string) => boolean;
}) {
  const site = picked?.layer === "sites" ? siteById(String(picked.props.id)) : undefined;
  const photo = useWikiPhoto(site?.wiki ?? null);

  if (site) {
    const kind = SITE_KINDS[site.kind];
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={kind.label} accent={kind.color} title={site.name} subtitle={site.where}>
        <div className="space-y-4">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={site.name} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />
          )}
          <p className="text-[14px] font-semibold leading-snug text-white">{site.tagline}</p>
          <ul className="space-y-2">
            {site.facts.map((f) => (
              <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: kind.color }} />
                <span>
                  {f.text}{" "}
                  <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-lime-300/70 hover:text-lime-200">
                    ↗ {f.source.label}
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-snug text-slate-300">
            <span className="font-mono text-[10px] uppercase tracking-wider text-lime-200/80">Look for · {lidarView(site.view).label} view — </span>
            {site.look}
          </p>
          <PeelButton color={kind.color} onClick={() => onPeel({ center: site.center, zoom: site.zoom, siteId: site.id })} />
          {onCloud && hasCloud?.(site.id) && (
            <button
              type="button"
              onClick={() => onCloud(site.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/40 px-3 py-2.5 text-[13px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/10"
            >
              <Box className="h-4 w-4" /> See the laser points in 3D
            </button>
          )}
          <GroundReadout at={site.center} />
          <DrawerLink href={`https://en.wikipedia.org/wiki/${site.wiki}`}>Wikipedia</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "ground") {
    const [lng, lat] = picked.lngLat;
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Lidar ground" accent="#a3e635" title="This spot" subtitle={`${lat.toFixed(4)}°, ${lng.toFixed(4)}°`}>
        <div className="space-y-4">
          <GroundReadout key={`${lng},${lat}`} at={picked.lngLat} />
          <PeelButton color="#a3e635" onClick={() => onPeel({ center: picked.lngLat, zoom: 15 })} />
        </div>
      </FeatureDrawer>
    );
  }

  return <FeatureDrawer open={false} onClose={onClose} />;
}
