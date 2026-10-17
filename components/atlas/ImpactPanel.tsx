"use client";

import { useEffect, useState } from "react";
import { Building2, Home, Users } from "lucide-react";
import { impactIn, type AreaGeometry, type Impact } from "@/utils/geo/impact";

/* ------------------------------------------------------------------ */
/*  <ImpactPanel> — "what's in the way" for an area: buildings by      */
/*  type (FEMA USA Structures) and people + homes (2020 Census).       */
/*  Counts run server-side as statistics queries when it mounts.       */
/* ------------------------------------------------------------------ */

const CLASS_ORDER = ["Residential", "Commercial", "Industrial", "Education", "Government", "Assembly", "Agriculture", "Unclassified"];

export function ImpactPanel({ geometry, framing, caveat, accent = "#f97316" }: { geometry: AreaGeometry; framing: string; caveat?: string; accent?: string }) {
  const [impact, setImpact] = useState<Impact | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    setImpact(undefined);
    setError(null);
    impactIn(geometry, ctl.signal)
      .then(setImpact)
      .catch((e) => !ctl.signal.aborted && setError((e as Error).message));
    return () => ctl.abort();
  }, [geometry]);

  const classes = impact ? CLASS_ORDER.map((k) => [k, impact.byClass[k] ?? 0] as const).filter(([, n]) => n > 0) : [];
  const max = classes.reduce((a, [, n]) => Math.max(a, n), 1);
  const sqmi = impact ? impact.areaKm2 / 2.58999 : 0;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: accent }}>
        What&apos;s in the way
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">{framing}</p>
      {impact === undefined && !error && <p className="mt-2 animate-pulse font-mono text-[11px] text-slate-400">Counting buildings and people…</p>}
      {error && <p className="mt-2 text-[12px] text-rose-300">Couldn&apos;t count right now ({error}).</p>}
      {impact && (
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Big icon={Building2} label="Buildings" value={impact.buildings} />
            <Big icon={Users} label="People" value={impact.people} />
            <Big icon={Home} label="Homes" value={impact.homes} />
          </div>
          {classes.length > 0 && (
            <ul className="space-y-1">
              {classes.map(([k, n]) => (
                <li key={k} className="flex items-center gap-2 text-[11px]">
                  <span className="w-24 shrink-0 text-slate-400">{k}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: accent }} />
                  </span>
                  <span className="w-12 text-right font-mono text-slate-200">{n.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] leading-snug text-slate-500">
            Area {impact.areaKm2 < 10 ? impact.areaKm2.toFixed(1) : Math.round(impact.areaKm2).toLocaleString()} km² ({sqmi < 10 ? sqmi.toFixed(1) : Math.round(sqmi).toLocaleString()} sq mi). Buildings: FEMA USA Structures, as mapped today. People and homes: 2020 Census {impact.unit}s touching the area, so edges are over-counted. U.S. only.
            {caveat ? ` ${caveat}` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function Big({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
      <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="font-mono text-base font-semibold tabular-nums text-white">{value >= 100_000 ? `${(value / 1000).toFixed(0)}K` : value.toLocaleString()}</p>
    </div>
  );
}
