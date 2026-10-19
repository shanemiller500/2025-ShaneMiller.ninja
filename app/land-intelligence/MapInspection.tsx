"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ParcelRecord } from "./parcel-sources";
import type { FatalCrash } from "./crash";

type SoilSelection = { kind: "soil"; point: [number, number]; properties: Record<string, string | number | null> };
type ParcelSelection = { kind: "parcel"; point: [number, number]; properties: ParcelRecord & { parcelKey: string } };
type CrashSelection = { kind: "crash"; point: [number, number]; properties: FatalCrash };
type OverlaySelection = { kind: "overlay"; results: { id: string; label: string; url: string; status: string; features: Record<string, unknown>[] }[] };
type SoilComponent = { name: string; percentage: number | null; hydric: string; drainage: string; classification: string; slopePercent: number | null };

export function MapInspection({ inspection, loading, components, error, onClose, onInspectOther, onInspectSoil }: {
  inspection: SoilSelection | ParcelSelection | CrashSelection | OverlaySelection | null; loading: boolean; components: SoilComponent[] | null; error: string; onClose: () => void; onInspectOther: (point: [number, number]) => void; onInspectSoil: (point: [number, number]) => boolean;
}) {
  const [soilUnavailable, setSoilUnavailable] = useState(false);
  const parcelKey = inspection?.kind === "parcel" ? inspection.properties.parcelKey : null;
  useEffect(() => setSoilUnavailable(false), [parcelKey]);
  if (!inspection && !loading) return null;
  return <aside className="pointer-events-auto absolute right-3 top-[145px] z-20 max-h-[min(55vh,570px)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-white/15 li-panel bg-slate-950/95 p-4 text-xs shadow-2xl backdrop-blur-xl sm:right-5 sm:top-28" aria-label="Map feature details">
    <div className="flex items-start justify-between gap-3"><div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300">Map inspection</div><h2 className="mt-1 text-sm font-semibold text-white">{inspection?.kind === "soil" ? String(inspection.properties.muname ?? "Soil map unit") : inspection?.kind === "parcel" ? inspection.properties.address || `Parcel ${inspection.properties.id || "record"}` : inspection?.kind === "crash" ? `Fatal crash · ${inspection.properties.date || "2024"}` : "Features at or near this point"}</h2></div><button type="button" aria-label="Close feature details" onClick={onClose} className="rounded-lg p-1 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
    {loading && <p className="mt-3 text-cyan-200">Checking source details…</p>}
    {inspection?.kind === "soil" && <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[11px]">{[["Symbol", inspection.properties.musym], ["Map-unit key", inspection.properties.mukey], ["Kind", inspection.properties.mukind], ["Farmland class", inspection.properties.farmlndcl], ["Survey area", inspection.properties.areasymbol]].filter(([, value]) => value != null && value !== "").map(([label, value]) => <div key={String(label)}><div className="text-slate-400">{label}</div><div className="font-medium text-white">{String(value)}</div></div>)}</div>
      <div><h3 className="font-semibold text-white">Mapped components</h3><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Component percentages and ratings describe the map unit, not a soil sample at the click point.</p></div>
      {components?.length === 0 && <p className="text-slate-300">No component records returned for this map unit.</p>}
      {components?.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><div className="font-semibold text-white">{item.name || "Unnamed component"}{item.percentage != null ? ` · ${item.percentage}%` : ""}</div><div className="mt-1.5 space-y-0.5 text-[11px] text-slate-300">{item.hydric && <div>Hydric rating: {item.hydric}</div>}{item.drainage && <div>Drainage: {item.drainage}</div>}{item.classification && <div>Taxonomy: {item.classification}</div>}{item.slopePercent != null && <div>Representative slope: {item.slopePercent}%</div>}</div></div>)}
      {error && <p className="text-amber-200">{error}</p>}
      <button type="button" onClick={() => onInspectOther(inspection.point)} className="block rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] text-cyan-200 hover:bg-white/10">Inspect other visible layers here</button>
      <a href="https://websoilsurvey.nrcs.usda.gov/" target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] text-cyan-300 underline">Validate in USDA Web Soil Survey ↗</a>
    </div>}
    {inspection?.kind === "parcel" && <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><div className="font-mono text-[10px] uppercase tracking-wider text-cyan-200">{inspection.properties.state} · {inspection.properties.county || "County not supplied"}</div><dl className="mt-2 space-y-1.5">{[["Parcel ID", inspection.properties.id], ["Reported use", inspection.properties.landUse], ["Zoning", inspection.properties.zoning], ["Area", inspection.properties.acres == null ? "" : `${inspection.properties.acres.toLocaleString()} acres`], ["Owner type", inspection.properties.ownerType], ["Reported land value", inspection.properties.landValue == null ? "" : `$${inspection.properties.landValue.toLocaleString()}`], ["Data received", inspection.properties.received]].filter(([, value]) => value !== "").map(([label, value]) => <div key={String(label)} className="grid grid-cols-[105px_1fr] gap-2 text-[11px]"><dt className="text-slate-400">{label}</dt><dd className="break-words text-slate-100">{value}</dd></div>)}</dl></div>
      <p className="text-[10px] leading-relaxed text-slate-400">Fields vary by county. Missing zoning, area or value means this source did not provide it; boundaries are for screening and need county verification.</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSoilUnavailable(!onInspectSoil(inspection.point))} className="rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] text-cyan-200 hover:bg-white/10">Inspect soil here</button><button type="button" onClick={() => onInspectOther(inspection.point)} className="rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] text-cyan-200 hover:bg-white/10">Other layers here</button></div>
      {soilUnavailable && <p className="text-[11px] text-amber-200">No soil polygon is visible at this parcel. Turn on the soil layer or zoom in and try again.</p>}
      {inspection.properties.recordUrl && <a href={inspection.properties.recordUrl} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-cyan-300 underline">County parcel record ↗</a>}
      <a href={inspection.properties.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-cyan-300 underline">{inspection.properties.source} ↗</a>
    </div>}
    {inspection?.kind === "crash" && <div className="mt-3 space-y-3 text-[11px] text-slate-200">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p>{[inspection.properties.city, inspection.properties.county, inspection.properties.state].filter(Boolean).join(", ") || "Location not named"}</p>{inspection.properties.road && <p className="mt-1">Road: {inspection.properties.road}</p>}<p className="mt-1">Fatalities: {inspection.properties.fatalities ?? "Not reported"} · Vehicles: {inspection.properties.vehicles ?? "Not reported"}</p><p className="mt-1">Case: {inspection.properties.id || "Not reported"}</p></div>
      <p className="text-slate-400">2024 FARS initial release. Fatal crashes only; locations and case details are reported by the source.</p>
      <a href={inspection.properties.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-cyan-300 underline">USDOT / NHTSA source ↗</a>
    </div>}
    {inspection?.kind === "overlay" && <div className="mt-3 space-y-2">{inspection.results.flatMap((result) => result.features.map((feature, index) => <section key={`${result.id}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><h3 className="font-semibold text-white">{result.label}</h3><dl className="mt-1.5 space-y-1 text-[11px]">{Object.entries(feature).map(([key, value]) => <div key={key} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-slate-400">{key.replaceAll("_", " ")}</dt><dd className="break-words text-slate-100">{String(value)}</dd></div>)}</dl><a href={result.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-cyan-300 underline">Source service ↗</a></section>))}{!inspection.results.some((result) => result.features.length) && <p className="text-slate-300">No mapped feature returned at this click. Turn on layers or click a visible feature; a blank result does not establish absence.</p>}{inspection.results.some((result) => result.status === "unavailable") && <p className="text-amber-200">Some source services did not respond.</p>}</div>}
  </aside>;
}
