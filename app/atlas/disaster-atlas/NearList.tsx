"use client";

import { useMemo } from "react";
import type { Picked } from "@/components/atlas/types";
import { fmtKm, nearest, pointInFeature } from "@/utils/geo/near";
import { ALERT_GROUPS, WORLD_EVENT_TYPES, type Storm } from "@/utils/geo/hazards";

/* ------------------------------------------------------------------ */
/*  "Near me" for the Disaster Atlas: any warning you're standing in,  */
/*  then the nearest live hazards from every feed — U.S. ones and the  */
/*  world's (GDACS alerts, cyclones, icebergs) alike.                  */
/* ------------------------------------------------------------------ */

export const NEAR_HAZARD_KM = 1500;

type Item = { key: string; layer: string; f: GeoJSON.Feature; at: [number, number]; color: string; title: string; sub: string };

export function NearList({
  me,
  storms,
  world,
  icebergs,
  fires,
  flooding,
  reports,
  warnings,
  centreOf,
  onPick,
  onGo,
}: {
  me: [number, number];
  storms: Storm[];
  world: GeoJSON.Feature[];
  icebergs: GeoJSON.Feature[];
  fires: GeoJSON.Feature[];
  flooding: GeoJSON.Feature[];
  reports: GeoJSON.Feature[];
  warnings: GeoJSON.Feature[];
  centreOf: (f: GeoJSON.Feature) => [number, number];
  onPick: (p: Picked) => void;
  onGo: (c: [number, number], z: number) => void;
}) {
  const inside = useMemo(() => warnings.filter((f) => pointInFeature(me, f.geometry)), [warnings, me]);
  const near = useMemo(() => {
    const items: Item[] = [];
    const add = (layer: string, f: GeoJSON.Feature, color: string, title: string, sub: string) =>
      items.push({ key: `${layer}-${f.properties?.id ?? items.length}`, layer, f, at: centreOf(f), color, title, sub });
    for (const s of storms)
      items.push({
        key: `storm-${s.id}`,
        layer: "storms",
        f: { type: "Feature", geometry: { type: "Point", coordinates: s.center }, properties: { storm: s.id } },
        at: s.center,
        color: "#d946ef",
        title: `${s.kind} ${s.name}`,
        sub: `${s.windMph} mph${s.category ? ` · Cat ${s.category}` : ""}`,
      });
    for (const f of world) {
      const t = WORLD_EVENT_TYPES.find((x) => x.key === f.properties?.type);
      add("world", f, t?.color ?? "#f97316", String(f.properties?.name || t?.label || "Disaster alert"), `${t?.label ?? "GDACS"} · ${String(f.properties?.level ?? "").toLowerCase() || "alert"}`);
    }
    for (const f of icebergs) if (f.geometry.type === "Point") add("icebergs", f, "#7dd3fc", `Iceberg ${f.properties?.name ?? ""}`.trim(), f.properties?.km2 ? `${f.properties.km2} km²` : "drifting");
    for (const f of fires) add("fires", f, "#f97316", String(f.properties?.name || "Wildfire"), f.properties?.acres ? `${Math.round(f.properties.acres).toLocaleString("en-US")} acres` : "wildfire");
    for (const f of flooding) add("gauges", f, "#22c55e", String(f.properties?.name || f.properties?.river || "River gauge"), `${f.properties?.status ?? ""} flooding`.trim());
    for (const f of reports) add("reports", f, "#ef4444", `${String(f.properties?.kind ?? "storm")} report`.replace(/^./, (c) => c.toUpperCase()), String(f.properties?.place ?? ""));
    return nearest(items, me, (x) => x.at, 25, NEAR_HAZARD_KM);
  }, [me, storms, world, icebergs, fires, flooding, reports, centreOf]);

  const pick = (it: Item, zoom: number) => {
    onPick({ layer: it.layer, id: it.f.properties?.id, props: (it.f.properties ?? {}) as Record<string, unknown>, lngLat: it.at });
    onGo(it.at, zoom);
  };
  const head = "px-2 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400";
  const row = "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]";
  return (
    <ul className="space-y-0.5">
      <li className={head}>Warnings where you are</li>
      {inside.map((f, k) => {
        const g = ALERT_GROUPS.find((x) => x.key === f.properties?.group);
        return (
          <li key={String(f.properties?.id ?? k)}>
            <button type="button" onClick={() => pick({ key: "", layer: "alerts", f, at: centreOf(f), color: "", title: "", sub: "" }, 8)} className={row}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g?.color ?? "#f59e0b" }} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{String(f.properties?.product ?? f.properties?.name ?? "Warning")}</span>
            </button>
          </li>
        );
      })}
      {!inside.length && <li className="px-2 py-1 text-[12px] text-slate-500">None — no current warning area covers your location. (Warnings come from the U.S. National Weather Service.)</li>}

      <li className={head}>Nearest live hazards · within {NEAR_HAZARD_KM.toLocaleString("en-US")} km</li>
      {near.map(({ item: it, km }) => (
        <li key={it.key}>
          <button type="button" onClick={() => pick(it, it.layer === "storms" || it.layer === "world" ? 5 : 9)} className={row}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-slate-100">{it.title}</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">{it.sub}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtKm(km)}</span>
          </button>
        </li>
      ))}
      {!near.length && <li className="px-2 py-1 text-[12px] text-slate-500">Nothing active within {NEAR_HAZARD_KM.toLocaleString("en-US")} km right now.</li>}
      <li className="px-2 pt-3 text-[11px] leading-snug text-slate-500">
        Wildfires, river gauges, storm reports and warnings are U.S. feeds; tropical cyclones, GDACS disaster alerts and icebergs cover the world. Your location only sorts this list — it isn&rsquo;t stored or sent anywhere.
      </li>
    </ul>
  );
}
