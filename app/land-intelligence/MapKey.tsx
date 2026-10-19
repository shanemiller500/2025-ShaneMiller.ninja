"use client";

import { useState } from "react";
import { PARCEL_CATEGORIES } from "./parcel-sources";
import { SOIL_CATEGORIES } from "./soil";

export function MapKey({ soils, parcels, crashes, soilStatus, parcelStatus, crashStatus }: { soils: boolean; parcels: boolean; crashes: boolean; soilStatus: string; parcelStatus: string; crashStatus: string }) {
  const [tab, setTab] = useState<"parcels" | "soils">("parcels");
  if (!soils && !parcels && !crashes) return null;
  const hasLegend = soils || parcels;
  const active = tab === "parcels" && parcels || !soils ? "parcels" : "soils";
  const categories = active === "parcels" ? PARCEL_CATEGORIES : SOIL_CATEGORIES;
  return <div className="pointer-events-auto absolute bottom-[150px] left-3 z-10 w-[min(330px,calc(100vw-24px))] rounded-2xl border border-white/15 li-panel bg-slate-950/90 p-3 text-[10px] shadow-2xl backdrop-blur-xl sm:bottom-5 sm:left-[390px]">
    {hasLegend && <><div className="flex gap-1 border-b border-white/10 pb-2">{parcels && <button type="button" aria-pressed={active === "parcels"} onClick={() => setTab("parcels")} className={`rounded-lg px-2 py-1 font-semibold ${active === "parcels" ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:bg-white/10"}`}>Parcels</button>}{soils && <button type="button" aria-pressed={active === "soils"} onClick={() => setTab("soils")} className={`rounded-lg px-2 py-1 font-semibold ${active === "soils" ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:bg-white/10"}`}>Soils</button>}</div>
    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">{categories.map((category) => <div key={category.id} className="flex items-center gap-1.5 text-slate-200"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: category.color }} />{category.label}</div>)}</div>
    <p className="mt-2 leading-relaxed text-slate-400">{active === "parcels" ? parcelStatus : soilStatus}</p>
    <p className="mt-1 leading-relaxed text-slate-500">{active === "parcels" ? "Colors group reported land use. Gray also includes missing classifications. Parcel GIS is not a legal boundary survey." : "Soil colors are inferred from map-unit names; component ratings are in the detail card."}</p></>}
    {crashes && <p className="mt-2 border-t border-white/10 pt-2 leading-relaxed text-rose-300">● {crashStatus}</p>}
  </div>;
}
