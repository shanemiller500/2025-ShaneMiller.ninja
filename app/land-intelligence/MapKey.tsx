"use client";

import { useEffect, useState } from "react";
import { ECMC_WELLS, WELL_STATUS } from "./colorado-live";
import { FACILITY_STATUSES } from "./facility";
import { PARCEL_CATEGORIES } from "./parcel-sources";
import { SOIL_CATEGORIES } from "./soil";
import type { MarketLayerDef } from "./market-layers";
import { PRICE_CLASSES, RECENT_MONTHS, type RecentMonths } from "./recent-sales";
import { UNDERGROUND_KEY } from "./underground";

// Legend and map filters share the same scrollable layers panel.
export function MapKey({ soils, parcels, crashes, facilities, soilStatus, parcelStatus, crashStatus, facilityStatus, market = null, marketStatus = "", parcelValue = null, comps = false, wells = false, recentSales = null, underground = null }: { soils: boolean; parcels: boolean; crashes: boolean; facilities: boolean; soilStatus: string; parcelStatus: string; crashStatus: string; facilityStatus: string; market?: MarketLayerDef | null; marketStatus?: string; parcelValue?: MarketLayerDef | null; comps?: boolean; wells?: boolean; recentSales?: { months: RecentMonths; onMonths: (months: RecentMonths) => void; status: string } | null; underground?: string | null }) {
  const [tab, setTab] = useState<"parcels" | "soils">("parcels");
  if (!soils && !parcels && !crashes && !facilities && !market && !parcelValue && !comps && !wells && !recentSales && !underground) return null;
  const hasLegend = soils || parcels;
  const active = tab === "parcels" && parcels || !soils ? "parcels" : "soils";
  const categories = active === "parcels" ? PARCEL_CATEGORIES : SOIL_CATEGORIES;
  return <div className="mt-3 border-t border-white/10 pt-3 text-[10px]">
    {hasLegend && <><div className="flex gap-1 border-b border-white/10 pb-2">{parcels && <button type="button" aria-pressed={active === "parcels"} onClick={() => setTab("parcels")} className={`rounded-lg px-2 py-1 font-semibold ${active === "parcels" ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:bg-white/10"}`}>Parcels</button>}{soils && <button type="button" aria-pressed={active === "soils"} onClick={() => setTab("soils")} className={`rounded-lg px-2 py-1 font-semibold ${active === "soils" ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:bg-white/10"}`}>Soils</button>}</div>
    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">{categories.map((category) => <div key={category.id} className="flex items-center gap-1.5 text-slate-200"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: category.color }} />{category.label}</div>)}</div>
    <p className="mt-2 leading-relaxed text-slate-400">{active === "parcels" ? parcelStatus : soilStatus}</p>
    <p className="mt-1 leading-relaxed text-slate-500">{active === "parcels" ? "Colors group reported land use. Gray also includes missing classifications. Parcel GIS is not a legal boundary survey." : "Soil colors are inferred from map-unit names; component ratings are in the detail card."}</p></>}
    {facilities && <div className={hasLegend ? "mt-2 border-t border-white/10 pt-2" : ""}>
      <p className="font-semibold text-slate-100">EPA regulated facilities · current compliance</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">{FACILITY_STATUSES.map((status) => <div key={status.id} className="flex items-center gap-1.5 text-slate-200"><span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white" style={{ background: status.color }} />{status.label}</div>)}</div>
      <p className="mt-1.5 leading-relaxed text-slate-400">{facilityStatus}</p>
    </div>}
    {recentSales && <div className="mt-2 border-t border-white/10 pt-2">
      <div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-100">Recent home sales</p>
        <div role="group" aria-label="Recent sales period" className="flex gap-0.5">{RECENT_MONTHS.map((months) => <button key={months} type="button" aria-pressed={recentSales.months === months} onClick={() => recentSales.onMonths(months)} className={`rounded px-1.5 py-0.5 font-semibold ${recentSales.months === months ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:bg-white/10"}`}>{months} mo</button>)}</div></div>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1" aria-label="Sale price classes">{PRICE_CLASSES.map((item) => <li key={item.label} className="flex items-center gap-1.5 text-slate-200"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/60" style={{ background: item.color }} />{item.label}</li>)}</ul>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-slate-300"><span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-500" />Denver, live</span><span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-amber-400 bg-slate-500" />Statewide last sale (yearly)</span></p>
      <p className="mt-1.5 leading-relaxed text-slate-400">{recentSales.status}</p>
      <p className="mt-1 leading-relaxed text-slate-500">Recorded sales, not MLS data and not verified as market sales. Denver: priced warranty deeds on homes and condos, multi-parcel deals removed. Elsewhere only each parcel&apos;s last sale, a year behind.</p>
    </div>}
    {underground && <div className="mt-2 border-t border-white/10 pt-2">
      <p className="font-semibold text-slate-100">Underground &amp; mines</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-slate-200"><span aria-hidden="true" className="h-3 w-5 shrink-0 rounded-sm border border-purple-200" style={{ background: "repeating-linear-gradient(135deg, #a855f7 0 2px, rgba(88,28,135,.35) 2px 6px)", boxShadow: "0 0 6px #a855f7" }} />{UNDERGROUND_KEY.undermined.label}</p>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1" aria-label="Historical mine symbols">{UNDERGROUND_KEY.kinds.map((kind) => <li key={kind.key} className="flex items-center gap-1.5 text-slate-200"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: kind.color, boxShadow: `0 0 6px ${kind.color}` }} />{kind.label}</li>)}</ul>
      <p className="mt-1.5 flex items-center gap-1.5 text-slate-200"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border-2 border-red-500" style={{ background: UNDERGROUND_KEY.opening.color }} />{UNDERGROUND_KEY.opening.label}; red ring = rated dangerous or worse</p>
      <p className="mt-1.5 leading-relaxed text-slate-400">{underground}</p>
      <p className="mt-1 leading-relaxed text-slate-500">Undermined areas are mostly Colorado&apos;s coal fields; mine symbols come from historical USGS topo maps nationwide. Many workings were never mapped, so a blank area is not proof of solid ground.</p>
    </div>}
    {wells && <WellsLegend />}
    {crashes && <p className="mt-2 border-t border-white/10 pt-2 leading-relaxed text-rose-300">● {crashStatus}</p>}
    {market && <ClassLegend def={market} status={marketStatus} />}
    {parcelValue && <ClassLegend def={parcelValue} status={parcelStatus} />}
    {comps && <div className="mt-2 border-t border-white/10 pt-2 text-slate-200"><p className="font-semibold text-slate-100">Comparable sales (selected parcel)</p><p className="mt-1 flex flex-wrap gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-3 w-3 rounded-full border-[3px] border-yellow-400" />Subject</span><span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2a78d6]" />Used</span><span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-white" />Outlier, not used</span></p></div>}
  </div>;
}

type LegendItem = { label: string; image: string | null };
const visibleWellStatus = (label: string) => !/plugged|abandoned location/i.test(label);
let wellsLegend: Promise<LegendItem[]> | null = null;
/** ECMC's own symbols for its Well Status layer (the map draws ECMC's raster); falls back to the status names alone. */
function loadWellsLegend(): Promise<LegendItem[]> {
  const fallback = Object.entries(WELL_STATUS).filter(([, label]) => visibleWellStatus(label)).map(([code, label]) => ({ label: `${label} (${code})`, image: null }));
  wellsLegend ??= fetch(`${ECMC_WELLS}/legend?f=json`).then((response) => response.json()).then((json) => {
    const items = ((json.layers ?? []).find((layer: { layerId: number }) => layer.layerId === 2)?.legend ?? []).filter((item: { label: string }) => visibleWellStatus(item.label));
    return items.length ? items.map((item: { label: string; imageData: string; contentType: string }) => ({ label: item.label, image: `data:${item.contentType};base64,${item.imageData}` })) : fallback;
  }).catch(() => fallback);
  return wellsLegend;
}

function WellsLegend() {
  const [items, setItems] = useState<LegendItem[] | null>(null);
  useEffect(() => { let live = true; loadWellsLegend().then((result) => { if (live) setItems(result); }); return () => { live = false; }; }, []);
  return <div className="mt-2 border-t border-white/10 pt-2">
    <p className="font-semibold text-slate-100">Oil and gas wells · ECMC status</p>
    {items ? <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1" aria-label="Well status symbols">{items.map((item) => <li key={item.label} className="flex items-center gap-1.5 text-slate-200">{item.image ? <img src={item.image} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm bg-white/80" /> : <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />}{item.label}</li>)}</ul> : <p role="status" className="mt-1 text-slate-400">Loading ECMC symbols…</p>}
    <p className="mt-1.5 leading-relaxed text-slate-500">Colorado only, zoom 10+. Plugged wells and abandoned locations are hidden on the map. Select a parcel to list wells within 2,000 ft, including those records, each linked to its ECMC record.</p>
  </div>;
}

function ClassLegend({ def, status }: { def: MarketLayerDef; status: string }) {
  return <div className="mt-2 border-t border-white/10 pt-2">
    <p className="font-semibold text-slate-100">{def.title}</p>
    <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1" aria-label={`${def.title} classes`}>{def.classes.map((item) => <li key={item.label} className="flex items-center gap-1.5 text-slate-200"><span aria-hidden="true" className="h-2.5 w-4 shrink-0 rounded-sm" style={{ background: item.color }} />{item.label}</li>)}</ul>
    <p className="mt-1.5 leading-relaxed text-slate-400">{status}</p>
    <p className="mt-1 leading-relaxed text-slate-500">{def.note} Unshaded areas have no published value.</p>
  </div>;
}
