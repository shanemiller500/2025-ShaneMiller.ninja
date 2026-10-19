"use client";

import { useEffect, useState } from "react";
import { BadgeDollarSign, Building2, CalendarDays, Database, FileText, Hammer, House, Landmark, MapPinned, Receipt, UserRound, X, type LucideIcon } from "lucide-react";
import type { ParcelRecord } from "./parcel-sources";
import type { ParcelDetail } from "./parcel-detail";
import type { BoulderAccount, BoulderProperty } from "./boulder-property";
import type { FatalCrash } from "./crash";

type SoilSelection = { kind: "soil"; point: [number, number]; properties: Record<string, string | number | null> };
type ParcelSelection = { kind: "parcel"; point: [number, number]; properties: ParcelRecord & { parcelKey: string } };
type CrashSelection = { kind: "crash"; point: [number, number]; properties: FatalCrash };
type OverlaySelection = { kind: "overlay"; results: { id: string; label: string; url: string; status: string; features: Record<string, unknown>[] }[] };
type SoilComponent = { name: string; percentage: number | null; hydric: string; drainage: string; classification: string; slopePercent: number | null };

export function MapInspection({ inspection, loading, components, error, propertyDetail, propertyLoading, propertyError, onClose, onInspectOther, onInspectSoil }: {
  inspection: SoilSelection | ParcelSelection | CrashSelection | OverlaySelection | null; loading: boolean; components: SoilComponent[] | null; error: string;
  propertyDetail: ParcelDetail | null; propertyLoading: boolean; propertyError: string;
  onClose: () => void; onInspectOther: (point: [number, number]) => void; onInspectSoil: (point: [number, number]) => boolean;
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
      <PropertyFacts summary={inspection.properties} detail={propertyDetail} loading={propertyLoading} error={propertyError} />
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSoilUnavailable(!onInspectSoil(inspection.point))} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] text-cyan-200 hover:bg-white/10"><MapPinned className="h-3.5 w-3.5" />Inspect soil here</button><button type="button" onClick={() => onInspectOther(inspection.point)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] text-cyan-200 hover:bg-white/10"><Database className="h-3.5 w-3.5" />Other layers here</button></div>
      {soilUnavailable && <p className="text-[11px] text-amber-200">No soil polygon is visible at this parcel. Turn on the soil layer or zoom in and try again.</p>}
      {(propertyDetail?.parcel.recordUrl || inspection.properties.recordUrl) && <a href={propertyDetail?.parcel.recordUrl || inspection.properties.recordUrl} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-cyan-300 underline">County parcel record ↗</a>}
      {inspection.properties.state === "Colorado" && inspection.properties.county.toLowerCase() === "boulder" && <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-cyan-300 underline"><a href="https://bouldercounty.gov/departments/assessor/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><Landmark className="h-3 w-3" />Assessor search ↗</a><a href="https://bouldercounty.gov/departments/treasurer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><BadgeDollarSign className="h-3 w-3" />Tax account ↗</a><a href="https://bouldercounty.gov/records/recording/search-public-records/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />Recorded deeds ↗</a></div>}
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

const money = (amount: number | null) => amount == null ? "Not in this feed" : `$${amount.toLocaleString()}`;
const fact = (value: string | number | null | undefined) => value == null || value === "" ? "Not in this feed" : String(value);

function FactRows({ rows }: { rows: [string, string][] }) {
  return <dl className="mt-2 space-y-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[112px_1fr] gap-2 text-[11px] leading-snug"><dt className="text-slate-400">{label}</dt><dd className={`break-words ${value === "Not in this feed" ? "text-slate-500" : "text-slate-100"}`}>{value}</dd></div>)}</dl>;
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-semibold text-white"><Icon aria-hidden className="h-4 w-4 shrink-0 text-cyan-300" />{children}</h3>;
}

const recentFirst = <T extends { date: string }>(items: T[]) => [...items].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

function BoulderProfile({ property }: { property: BoulderProperty }) {
  return <div className="space-y-3">
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3"><SectionTitle icon={Database}>Boulder County assessor profile</SectionTitle><p className="mt-1 text-[10px] leading-relaxed text-slate-300">County records for parcel {property.folio}. {property.accounts.length} assessor {property.accounts.length === 1 ? "account" : "accounts"}. {property.sourceDate ? `County data dated ${property.sourceDate}.` : `Snapshot prepared ${new Date(property.updatedAt).toLocaleDateString()}.`}</p></div>
    {property.accounts.map((account) => <BoulderAccountCard key={account.accountNo} account={account} />)}
    <p className="text-[10px] leading-relaxed text-slate-400">County files can contain multiple records per account. A recorded document is not always a market sale, and a permit is not proof that work was completed. Confirm title, taxes and current condition with county records.</p>
    <a href={property.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-cyan-300 underline"><FileText className="h-3.5 w-3.5" />Boulder County data source ↗</a>
  </div>;
}

function BoulderAccountCard({ account }: { account: BoulderAccount }) {
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  return <div className="space-y-2">
    <section className={panel}><SectionTitle icon={Landmark}>Assessor account {account.accountNo}</SectionTitle><FactRows rows={[["Reported owner", account.owners.length ? account.owners.join(" · ") : "Not in this feed"], ["Site address", fact(account.siteAddress)], ["Account type", fact(account.accountType)], ["Land uses", account.landUses.length ? account.landUses.join(" · ") : "Not in this feed"], ["Subdivision", fact(account.subdivision)], ["Tax area", fact(account.taxArea)], ["Mill levy", fact(account.millLevy)], ["Legal description", fact(account.legalDescription)]]} /></section>
    <section className={panel}><SectionTitle icon={BadgeDollarSign}>Assessor values{account.values?.taxYear ? ` · tax year ${account.values.taxYear}` : ""}</SectionTitle><FactRows rows={[["Appraised total", money(account.values?.actualTotal ?? null)], ["Appraised land", money(account.values?.actualLand ?? null)], ["Appraised buildings", money(account.values?.actualBuildings ?? null)], ["Assessed total", money(account.values?.assessedTotal ?? null)]]} /><p className="mt-2 text-[10px] text-slate-400">Appraised and assessed values are not purchase prices or tax bills.</p></section>
    <section className={panel}><SectionTitle icon={Receipt}>Recorded sales and deeds</SectionTitle>{account.sales.length ? <div className="mt-2 space-y-2">{recentFirst(account.sales).map((item, index) => <div key={`${item.reception}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.price == null ? "Recorded document · price not reported" : money(item.price)}</div><div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-300"><CalendarDays className="h-3 w-3 text-cyan-300" />{fact(item.date)}{item.deedType && <span>· {item.deedType}</span>}</div>{item.qualification && <div className="text-slate-400">Sale code: {item.qualification}</div>}{item.reception && <div className="text-slate-400">Reception: {item.reception}</div>}</div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No associated sale or deed rows in this county snapshot.</p>}</section>
    <section className={panel}><SectionTitle icon={Building2}>Buildings</SectionTitle>{account.buildings.length ? <div className="mt-2 space-y-2">{account.buildings.map((item, index) => <div key={`${item.buildingNumber}-${index}`} className="rounded-lg border border-white/10 p-2"><div className="text-[11px] font-medium text-white">{item.design || `Building ${item.buildingNumber || index + 1}`}</div><FactRows rows={[["Built", fact(item.yearBuilt)], ["Effective year", fact(item.effectiveYear)], ["Bedrooms", fact(item.bedrooms)], ["Bathrooms", [item.fullBaths == null ? "" : `${item.fullBaths} full`, item.threeQuarterBaths == null ? "" : `${item.threeQuarterBaths} ¾`, item.halfBaths == null ? "" : `${item.halfBaths} half`].filter(Boolean).join(" · ") || "Not in this feed"], ["Main floor", item.mainFloorSqft == null ? "Not in this feed" : `${item.mainFloorSqft.toLocaleString()} sq ft`], ["Basement", item.basementSqft == null ? "Not in this feed" : `${item.basementSqft.toLocaleString()} sq ft`], ["Garage/carport", item.garageSqft == null ? "Not in this feed" : `${item.garageSqft.toLocaleString()} sq ft`]]} /></div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No building row for this account.</p>}</section>
    <section className={panel}><SectionTitle icon={Hammer}>Permit records</SectionTitle>{account.permits.length ? <div className="mt-2 space-y-2">{recentFirst(account.permits).map((item, index) => <div key={`${item.number}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.description || item.number || "Permit"}</div><div className="text-slate-300">{[item.date, item.number, item.issuedBy].filter(Boolean).join(" · ")}</div>{item.estimatedValue != null && <div className="text-slate-400">Reported work value: {money(item.estimatedValue)}</div>}</div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No permit row in this assessor file.</p>}</section>
  </div>;
}

function PropertyFacts({ summary, detail, loading, error }: { summary: ParcelRecord; detail: ParcelDetail | null; loading: boolean; error: string }) {
  const parcel = detail?.parcel ?? summary;
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  return <>
    <section className={panel}>
      <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200"><MapPinned className="h-3.5 w-3.5" />{parcel.state} · {parcel.county || "County not supplied"}</h3>
      <FactRows rows={[["Parcel ID", fact(parcel.id)], ["Site address", fact(parcel.address)], ["Land use", fact(parcel.landUse)], ["Zoning", fact(parcel.zoning)], ["Mapped area", parcel.acres == null ? "Not in this feed" : `${parcel.acres.toLocaleString()} acres`], ["Owner type", fact(parcel.ownerType)], ["Data received", fact(parcel.received)]]} />
    </section>
    {loading && <p role="status" className="text-[11px] text-cyan-200">Loading public ownership, sales and values…</p>}
    {error && <p role="alert" className="text-[11px] text-amber-200">{error}</p>}
    {detail?.boulder?.status === "ready" && detail.boulder.property && <BoulderProfile property={detail.boulder.property} />}
    {detail?.boulder?.status === "not_loaded" && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-[11px] leading-relaxed text-amber-100">The Boulder County data snapshot has not been loaded on this server. Statewide fields appear below; the assessor and recorder links have the fuller county record.</p>}
    {!loading && detail?.boulder?.status !== "ready" && <>
      <section className={panel}><SectionTitle icon={UserRound}>Ownership</SectionTitle><FactRows rows={[["Reported owner", detail?.owners.length ? detail.owners.join(" · ") : "Not in this feed"]]} /><p className="mt-2 text-[10px] text-slate-400">Owner is a public parcel record entry. Verify current title with the county recorder.</p></section>
      <section className={panel}><SectionTitle icon={Receipt}>Reported sale history</SectionTitle>
        {detail?.sales.length ? <div className="mt-2 space-y-2">{detail.sales.map((item, index) => <div key={`${item.date}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.price == null ? "Price not provided" : money(item.price)}</div><div className="text-slate-300">{item.date || "Date not provided"}</div>{item.reference && <div className="text-slate-400">Recorder reference: {item.reference}</div>}</div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No sale transactions supplied by this statewide feed.</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">These are the source&apos;s reported sale entries, not a complete deed history. A recorded price may reflect a non-market transfer. Check the county recorder for earlier deeds and actual consideration.</p>
      </section>
      <section className={panel}><SectionTitle icon={BadgeDollarSign}>Public values and taxes{detail?.valueYear ? ` · ${detail.valueYear}` : ""}</SectionTitle>
        <FactRows rows={[[detail?.valueLabels.total || "Assessed total", money(detail?.assessedTotal ?? null)], [detail?.valueLabels.land || "Land value", money(detail?.assessedLand ?? parcel.landValue)], [detail?.valueLabels.improvements || "Improvements", money(detail?.assessedImprovements ?? null)], ["Taxable value", money(detail?.taxableValue ?? null)], ["Est. fair market", money(detail?.estimatedMarketValue ?? null)], ["Annual property tax", money(detail?.annualPropertyTax ?? null)]]} />
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Assessed, taxable and estimated values are source labels. They are not the sale price or a current listing price.</p>
      </section>
      <section className={panel}><SectionTitle icon={House}>Building and legal facts</SectionTitle><FactRows rows={[["Year built", fact(detail?.yearBuilt)], ["Living area", detail?.livingAreaSqft ? `${detail.livingAreaSqft.toLocaleString()} sq ft` : "Not in this feed"], ["Buildings", fact(detail?.buildingCount)], ["Deeded area", detail?.deedAcres ? `${detail.deedAcres.toLocaleString()} acres` : "Not in this feed"], ["Legal description", fact(detail?.legalDescription)]]} /><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Bedrooms, bathrooms, listing status, liens and a complete sale chain are not supplied here. County assessor and recorder records may have more detail.</p></section>
    </>}
  </>;
}
