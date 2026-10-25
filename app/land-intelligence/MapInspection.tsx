"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeDollarSign, Building2, CalendarDays, ChevronDown, Database, FileText, Hammer, House, Landmark, MapPinned, Receipt, RotateCcw, Scale, Sparkles, Sprout, UserRound, Waves, X, type LucideIcon } from "lucide-react";
import type { ParcelRecord } from "./parcel-sources";
import type { ParcelFinding, ParcelGeometry, ParcelInspectionReport } from "./parcel-inspection";
import { ParcelFindings } from "./ParcelFindings";
import { RoadSegmentDetails } from "./RoadSegmentDetails";
import type { ParcelDetail } from "./parcel-detail";
import type { BoulderAccount, BoulderProperty } from "./boulder-property";
import type { FatalCrash } from "./crash";
import { FACILITY_STATUSES, type EpaFacility } from "./facility";
import type { ZoningLookup } from "./zoning";
import { isOfficial, type CodeLink, type ZoningCode } from "./zoning-code";
import { FILL_FIELDS, formatFilled, isUseCode, missingFields, type FillKey, type FilledValue, type PropertyFill } from "./property-fill";
import { parcelHeadline } from "./parcel-headline";

type SoilSelection = { kind: "soil"; point: [number, number]; properties: Record<string, string | number | null> };
type ParcelSelection = { kind: "parcel"; point: [number, number]; properties: ParcelRecord & { parcelKey: string } };
type CrashSelection = { kind: "crash"; point: [number, number]; properties: FatalCrash };
type FacilitySelection = { kind: "facility"; point: [number, number]; properties: EpaFacility };
type OverlaySelection = { kind: "overlay"; results: { id: string; label: string; url: string; status: string; features: Record<string, unknown>[] }[] };
type SoilComponent = { name: string; percentage: number | null; hydric: string; drainage: string; classification: string; slopePercent: number | null };

export function MapInspection({ inspection, loading, components, error, propertyDetail, propertyLoading, propertyError, parcelInspection, parcelGeometry, parcelInspectionLoading, parcelInspectionError, visibleFindingGroups, selectedFindingId, onToggleFindingGroup, onSetFindingGroupsVisible, onSelectFinding, onClose, onInspectOther }: {
  inspection: SoilSelection | ParcelSelection | CrashSelection | FacilitySelection | OverlaySelection | null; loading: boolean; components: SoilComponent[] | null; error: string;
  propertyDetail: ParcelDetail | null; propertyLoading: boolean; propertyError: string;
  parcelInspection: ParcelInspectionReport | null; parcelGeometry: ParcelGeometry | null; parcelInspectionLoading: boolean; parcelInspectionError: string;
  visibleFindingGroups: Record<string, boolean>; selectedFindingId: string | null;
  onToggleFindingGroup: (id: string) => void; onSetFindingGroupsVisible: (ids: string[], visible: boolean) => void; onSelectFinding: (finding: ParcelFinding) => void;
  onClose: () => void; onInspectOther: (point: [number, number]) => void;
}) {
  // Phones only: the sheet can shrink to its title bar so the map stays usable.
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>("property");
  const parcelKey = inspection?.kind === "parcel" ? inspection.properties.parcelKey : null;
  useEffect(() => setCollapsed(false), [inspection]);
  useEffect(() => setActiveSection(parcelKey ? "property" : null), [parcelKey]);
  if (!inspection && !loading) return null;
  // Bottom sheet on phones; floating card on the right from md (768px) up.
  return <aside className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex max-h-[62dvh] flex-col rounded-t-2xl border-t border-white/15 li-panel bg-slate-950/95 text-xs shadow-[0_-12px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur-xl md:absolute md:inset-x-auto md:bottom-auto md:right-5 md:top-28 md:max-h-[calc(100dvh-200px)] md:w-[400px] md:rounded-2xl md:border md:shadow-2xl" aria-label="Map feature details">
    <div className="shrink-0 px-4 pb-2 pt-2 md:pt-4">
      <button type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} aria-label={collapsed ? "Expand feature details" : "Minimize feature details"} className="mx-auto mb-1 flex h-5 w-16 items-center justify-center md:hidden"><span className="h-1 w-10 rounded-full bg-white/30" /></button>
      <div className="flex items-start justify-between gap-3"><button type="button" onClick={() => setCollapsed(false)} className="min-w-0 text-left md:cursor-default"><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300">Map inspection</div><h2 className="mt-1 truncate text-sm font-semibold text-white md:whitespace-normal">{inspection?.kind === "soil" ? String(inspection.properties.muname ?? "Soil map unit") : inspection?.kind === "parcel" ? inspection.properties.address || `Parcel ${inspection.properties.id || "record"}` : inspection?.kind === "crash" ? `Fatal crash · ${inspection.properties.date || "2024"}` : inspection?.kind === "facility" ? inspection.properties.name : "Features at or near this point"}</h2></button><button type="button" aria-label="Close feature details" onClick={onClose} className="-mr-1 shrink-0 rounded-lg p-2 text-slate-300 hover:bg-white/10 md:p-1"><X className="h-5 w-5 md:h-4 md:w-4" /></button></div>
    </div>
    <div className={`min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${collapsed ? "hidden md:block" : ""}`}>
    {loading && <p className="mt-1 text-cyan-200">Checking source details…</p>}
    {inspection?.kind === "soil" && <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[11px]">{[["Symbol", inspection.properties.musym], ["Map-unit key", inspection.properties.mukey], ["Kind", inspection.properties.mukind], ["Farmland class", inspection.properties.farmlndcl], ["Survey area", inspection.properties.areasymbol]].filter(([, value]) => value != null && value !== "").map(([label, value]) => <div key={String(label)}><div className="text-slate-400">{label}</div><div className="font-medium text-white">{String(value)}</div></div>)}</div>
      <div><h3 className="font-semibold text-white">Mapped components</h3><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Component percentages and ratings describe the map unit, not a soil sample at the click point.</p></div>
      {components?.length === 0 && <p className="text-slate-300">No component records returned for this map unit.</p>}
      {components?.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><div className="font-semibold text-white">{item.name || "Unnamed component"}{item.percentage != null ? ` · ${item.percentage}%` : ""}</div><div className="mt-1.5 space-y-0.5 text-[11px] text-slate-300">{item.hydric && <div>Hydric rating: {item.hydric}</div>}{item.drainage && <div>Drainage: {item.drainage}</div>}{item.classification && <div>Taxonomy: {item.classification}</div>}{item.slopePercent != null && <div>Representative slope: {item.slopePercent}%</div>}</div></div>)}
      {error && <p className="text-amber-200">{error}</p>}
      <button type="button" onClick={() => onInspectOther(inspection.point)} className="block rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] text-cyan-200 hover:bg-white/10">Inspect other visible layers here</button>
      <a href="https://websoilsurvey.nrcs.usda.gov/" target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] text-cyan-300 underline">Validate in USDA Web Soil Survey ↗</a>
    </div>}
    {inspection?.kind === "parcel" && <div className="mt-2 space-y-2.5">
      <ParcelHeadlineCard detail={propertyDetail} loading={propertyLoading} error={propertyError} />
      <section className="li-property-details overflow-hidden rounded-xl border border-white/10"><button type="button" aria-expanded={activeSection === "property"} onClick={() => setActiveSection(activeSection === "property" ? null : "property")} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-semibold text-white"><span>Property record and site context</span><ChevronDown aria-hidden="true" className={`h-4 w-4 text-cyan-300 transition-transform ${activeSection === "property" ? "rotate-180" : ""}`} /></button>{activeSection === "property" && <div className="space-y-3 border-t border-white/10 p-2.5"><ParcelBody key={inspection.properties.parcelKey} inspection={inspection} detail={propertyDetail} loading={propertyLoading} error={propertyError} /></div>}</section>
      <ParcelFindings report={parcelInspection?.parcelKey === inspection.properties.parcelKey ? parcelInspection : null} geometry={parcelGeometry} propertyDetail={propertyDetail} heading={{ name: inspection.properties.address || `Parcel ${inspection.properties.id || "record"}`, id: inspection.properties.id || inspection.properties.parcelKey, locality: [inspection.properties.county, inspection.properties.state].filter(Boolean).join(", "), sourceUrl: inspection.properties.recordUrl || inspection.properties.sourceUrl }} loading={parcelInspectionLoading} error={parcelInspectionError} visible={visibleFindingGroups} selectedId={selectedFindingId} onToggle={onToggleFindingGroup} onSetVisible={onSetFindingGroupsVisible} onSelect={onSelectFinding} openSection={activeSection} onOpenSection={setActiveSection} propertyArea={(id) => <><PropertyAreaSummary id={id} summary={inspection.properties} detail={propertyDetail} onOpenFull={() => { setActiveSection("property"); requestAnimationFrame(() => document.querySelector(".li-property-details")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />{id === "permits" && <ZoningSection point={inspection.point} />}</>} />
      {(propertyDetail?.parcel.recordUrl || inspection.properties.recordUrl) && <a href={propertyDetail?.parcel.recordUrl || inspection.properties.recordUrl} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-cyan-300 underline">County parcel record ↗</a>}
      {inspection.properties.state === "Colorado" && inspection.properties.county.toLowerCase() === "boulder" && <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-cyan-300 underline"><a href="https://maps.bouldercounty.org/boco/PropertySearch/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><Landmark className="h-3 w-3" />Assessor search ↗</a><a href="https://bouldercounty.gov/departments/treasurer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><BadgeDollarSign className="h-3 w-3" />Tax account ↗</a><a href="https://bouldercounty.gov/records/recording/search-public-records/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />Recorded deeds ↗</a></div>}
      <a href={inspection.properties.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-cyan-300 underline">{inspection.properties.source} ↗</a>
    </div>}
    {inspection?.kind === "facility" && <FacilityDetails facility={inspection.properties} />}
    {inspection?.kind === "crash" && <div className="mt-3 space-y-3 text-[11px] text-slate-200">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p>{[inspection.properties.city, inspection.properties.county, inspection.properties.state].filter(Boolean).join(", ") || "Location not named"}</p>{inspection.properties.road && <p className="mt-1">Road: {inspection.properties.road}</p>}<p className="mt-1">Fatalities: {inspection.properties.fatalities ?? "Not reported"} · Vehicles: {inspection.properties.vehicles ?? "Not reported"}</p><p className="mt-1">Case: {inspection.properties.id || "Not reported"}</p></div>
      <p className="text-slate-400">2024 FARS initial release. Fatal crashes only; locations and case details are reported by the source.</p>
      <a href={inspection.properties.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-cyan-300 underline">USDOT / NHTSA source ↗</a>
    </div>}
    {inspection?.kind === "overlay" && <div className="mt-3 space-y-2">{inspection.results.flatMap((result) => result.features.map((feature, index) => <section key={`${result.id}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><h3 className="font-semibold text-white">{result.label}</h3><dl className="mt-1.5 space-y-1 text-[11px]">{Object.entries(feature).map(([key, value]) => <div key={key} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-slate-400">{key.replaceAll("_", " ")}</dt><dd className="break-words text-slate-100">{String(value)}</dd></div>)}</dl>{result.id === "roads" && Number.isSafeInteger(Number(feature.OBJECTID)) && Number(feature.OBJECTID) > 0 && <RoadOverlayControl segmentId={String(feature.OBJECTID)} />}<a href={result.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-cyan-300 underline">Source service ↗</a></section>))}{!inspection.results.some((result) => result.features.length) && <p className="text-slate-300">No mapped feature returned at this click. Turn on layers or click a visible feature; a blank result does not establish absence.</p>}{inspection.results.some((result) => result.status === "unavailable") && <p className="text-amber-200">Some source services did not respond.</p>}</div>}
    </div>
  </aside>;
}

function RoadOverlayControl({ segmentId }: { segmentId: string }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-2"><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="rounded-lg border border-cyan-300/40 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/10">{open ? "Hide" : "View"} crashes, incidents, and conditions for this segment</button>{open && <RoadSegmentDetails segmentId={segmentId} />}</div>;
}

const money = (amount: number | null) => amount == null ? "Not in this feed" : `$${amount.toLocaleString()}`;
const fact = (value: string | number | null | undefined) => value == null || value === "" ? "Not in this feed" : String(value);

function ParcelHeadlineCard({ detail, loading, error }: { detail: ParcelDetail | null; loading: boolean; error: string }) {
  const headline = parcelHeadline(detail);
  return <section className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.07] p-3" aria-busy={loading}>
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0"><div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-cyan-200"><UserRound aria-hidden="true" className="h-3.5 w-3.5" />Owner of record</div><p className="mt-1 break-words text-[12px] font-semibold leading-snug text-white">{loading ? "Loading…" : headline.owner}</p><p className="mt-1 text-[9px] leading-snug text-slate-400">{headline.ownerNote}</p></div>
      <div className="min-w-0 border-l border-white/10 pl-3"><div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-cyan-200"><Receipt aria-hidden="true" className="h-3.5 w-3.5" />{headline.priceLabel}</div><p className="mt-1 text-[15px] font-semibold leading-none text-white">{loading ? "Loading…" : headline.price == null ? "Not reported" : money(headline.price)}</p><p className="mt-1 text-[9px] leading-snug text-slate-400">{headline.priceDate ? `${headline.priceDate} · ` : ""}{headline.priceNote}</p></div>
    </div>
    {headline.value != null && <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-slate-300">{headline.valueLabel}: <strong className="font-semibold text-white">{money(headline.value)}</strong> <span className="text-slate-400">· distinct from sale price</span></p>}
    {error && <p role="alert" className="mt-2 text-[10px] text-amber-200">{error}</p>}
  </section>;
}

function PropertyAreaSummary({ id, summary, detail, onOpenFull }: { id: string; summary: ParcelRecord; detail: ParcelDetail | null; onOpenFull: () => void }) {
  const parcel = detail?.parcel ?? summary;
  const accounts = detail?.boulder?.status === "ready" ? detail.boulder.property?.accounts ?? [] : [];
  const oneAccount = accounts.length === 1 ? accounts[0] : null;
  const buildings = accounts.flatMap((account) => account.buildings.map((building) => ({ ...building, account: account.accountNo })));
  const permits = accounts.flatMap((account) => account.permits.map((permit) => ({ ...permit, account: account.accountNo }))).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const sales = accounts.flatMap((account) => account.sales.map((sale) => ({ ...sale, account: account.accountNo }))).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const sourceUrl = parcel.recordUrl || parcel.sourceUrl;
  return <div className="space-y-2 px-1 pb-1 text-[11px] text-slate-200">
    {id === "buildings" && <><FactRows rows={[["Year built", fact(detail?.yearBuilt ?? oneAccount?.buildings[0]?.yearBuilt)], ["Living area", detail?.livingAreaSqft ? `${detail.livingAreaSqft.toLocaleString()} sq ft` : oneAccount?.buildings[0]?.mainFloorSqft ? `${oneAccount.buildings[0].mainFloorSqft.toLocaleString()} sq ft main floor` : "Not in this feed"], ["Buildings", fact(detail?.buildingCount ?? (buildings.length || null))]]} />{buildings.slice(0, 3).map((building, index) => <p key={`${building.account}-${building.buildingNumber}-${index}`} className="rounded-md border border-white/10 px-2 py-1.5">{building.design || `Building ${building.buildingNumber || index + 1}`} · built {fact(building.yearBuilt)}{accounts.length > 1 ? ` · account ${building.account}` : ""}</p>)}{buildings.length > 3 && <p className="text-slate-400">{buildings.length - 3} more building rows in the full record.</p>}</>}
    {id === "land" && <><FactRows rows={[["Parcel ID", fact(parcel.id)], ["Mapped area", parcel.acres == null ? "Not reported" : `${parcel.acres.toLocaleString()} acres`], ["Land use", fact(parcel.landUse)], ["Parcel zoning", fact(parcel.zoning)], ["Account", fact(detail?.accountNumber || oneAccount?.accountNo)], ["Subdivision", fact(detail?.subdivision || oneAccount?.subdivision)], ["Block / lot", [detail?.block, detail?.lot].filter(Boolean).join(" / ") || "Not in this feed"], ["Appraised value", money(oneAccount?.values?.actualTotal ?? detail?.estimatedMarketValue ?? detail?.assessedTotal ?? null)], ["Taxable value", money(detail?.taxableValue ?? null)]]} /><p className="text-[10px] text-slate-400">Value is an assessor field, not a sale or listing price. Statewide data may lag county updates.</p></>}
    {id === "legal" && <><FactRows rows={[["Reported owner", accounts.length === 1 && oneAccount?.owners.length ? oneAccount.owners.join(" · ") : detail?.owners.length ? detail.owners.join(" · ") : "Not in this feed"], ["Legal description", fact(detail?.legalDescription || oneAccount?.legalDescription)], ["Deeded area", detail?.deedAcres == null ? "Not in this feed" : `${detail.deedAcres.toLocaleString()} acres`]]} />{sales.length ? <><p className="font-semibold text-white">Recent assessor deed rows</p>{sales.slice(0, 3).map((sale, index) => <p key={`${sale.account}-${sale.reception}-${index}`} className="rounded-md border border-white/10 px-2 py-1.5">{sale.date || "Date not reported"} · {sale.price == null ? "price not reported" : money(sale.price)}{sale.reception ? ` · reception ${sale.reception}` : ""}{accounts.length > 1 ? ` · account ${sale.account}` : ""}</p>)}{sales.length > 3 && <p className="text-slate-400">{sales.length - 3} more deed rows in the full record.</p>}</> : detail?.sales.length ? <p>Last reported sale: {detail.sales[0].date || "date not reported"} · {money(detail.sales[0].price)}</p> : <p className="text-slate-400">No sale or deed row supplied for this parcel.</p>}<p className="text-[10px] text-slate-400">Owner and deed rows do not establish current title or a market transaction.</p></>}
    {id === "permits" && <><p>{permits.length ? `${permits.length} assessor permit ${permits.length === 1 ? "row" : "rows"} across ${accounts.length} linked ${accounts.length === 1 ? "account" : "accounts"}.` : "No assessor permit rows connected for this parcel."}</p>{permits.slice(0, 3).map((permit, index) => <p key={`${permit.account}-${permit.number}-${index}`} className="rounded-md border border-white/10 px-2 py-1.5"><span className="font-medium text-white">{permit.description || permit.category || "Permit"}</span><span className="block text-slate-400">{[permit.date, permit.number ? `#${permit.number}` : "", accounts.length > 1 ? `account ${permit.account}` : ""].filter(Boolean).join(" · ")}</span></p>)}{permits.length > 3 && <p className="text-slate-400">{permits.length - 3} more permit rows in the full record.</p>}<p className="text-[10px] text-slate-400">Assessor permit rows do not prove completed work or current approval.</p></>}
    {accounts.some((account) => (account.linkedParcelCount ?? 1) > 1) && <p className="text-[10px] text-amber-200">Some assessor accounts link to multiple parcels. Account building, deed and permit rows may concern another parcel.</p>}
    <div className="flex flex-wrap gap-2 pt-1"><button type="button" onClick={onOpenFull} className="li-inspection-action rounded-md px-2 py-1.5 font-medium text-cyan-200">Full property record</button>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-md px-2 py-1.5 text-cyan-300 underline">Parcel source ↗</a>}</div>
  </div>;
}

// A third element marks a value found by the AI fill; its chip links to the page it came from.
type FactRow = [string, string] | [string, string, FilledValue];
function FactRows({ rows }: { rows: FactRow[] }) {
  return <dl className="mt-2 space-y-2">{rows.map(([label, value, filled]) => <div key={label} className="grid grid-cols-[112px_1fr] gap-2 text-[11px] leading-snug"><dt className="text-slate-400">{label}</dt><dd className={`break-words ${/^(Not in this feed|None mapped here|Source did not respond)$/.test(value) ? "text-slate-500" : "text-slate-100"}`}>{value}{filled && <a href={filled.sourceUrl} target="_blank" rel="noopener noreferrer" title={filled.via === "county" ? `From the county GIS parcel record (field ${filled.field})` : filled.official ? "Found by AI web search in an official public record" : "Found by AI web search on an unofficial site"} className={`ml-1.5 inline-flex items-center whitespace-nowrap rounded border px-1 align-middle font-mono text-[9px] uppercase leading-4 ${filled.via === "county" ? "border-cyan-300/40 text-cyan-200 hover:bg-cyan-300/10" : "border-amber-300/40 text-amber-200 hover:bg-amber-300/10"}`}>{filled.via === "county" ? "County" : `AI${filled.official ? "" : " · unofficial"}`} ↗</a>}</dd></div>)}</dl>;
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-semibold text-white"><Icon aria-hidden className="h-4 w-4 shrink-0 text-cyan-300" />{children}</h3>;
}

// One EPA-regulated facility: what it is, how it is regulated, and its current compliance, with EPA's full report.
function FacilityDetails({ facility }: { facility: EpaFacility }) {
  const status = FACILITY_STATUSES.find((item) => item.id === facility.status) ?? FACILITY_STATUSES[3];
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  return <div className="mt-1 space-y-3">
    <section className={panel}>
      <div className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full border-2 border-white" style={{ background: status.color }} /><span className="text-[12px] font-semibold text-white">{status.label}</span></div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">Current compliance status reported to EPA across this facility&apos;s programs. It describes paperwork and inspections, not measured pollution at this spot.</p>
      <FactRows rows={[["Address", fact(facility.address)], ["Regulated for", fact(facility.programs)], ["Last inspection", fact(facility.lastInspection)], ["Formal actions", facility.formalActions == null ? "Not in this feed" : String(facility.formalActions)], ["Penalties", facility.penalties ? money(facility.penalties) : "None reported"], ["EPA registry ID", fact(facility.id)]]} />
    </section>
    {facility.reportUrl && <a href={facility.reportUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20"><FileText className="h-3.5 w-3.5" />EPA detailed facility report ↗</a>}
    <p className="text-[10px] leading-relaxed text-slate-400">From EPA ECHO (Enforcement and Compliance History Online). Locations are reported by facilities and can be approximate.</p>
  </div>;
}

// The tapped parcel: public record, zoning, conditions at the tapped point, and the optional AI fill for blank fields.
function ParcelBody({ inspection, detail, loading, error }: { inspection: ParcelSelection; detail: ParcelDetail | null; loading: boolean; error: string }) {
  const [fill, setFill] = useState<PropertyFill | null>(null);
  const [pointOpen, setPointOpen] = useState(false);
  const { properties, point } = inspection;
  return <>
    <PropertyFacts summary={properties} detail={detail} loading={loading} error={error} fill={fill} />
    <ZoningSection point={point} />
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><button type="button" aria-expanded={pointOpen} onClick={() => setPointOpen((value) => !value)} className="w-full text-left text-[11px] font-medium text-cyan-200">{pointOpen ? "Hide" : "Show"} conditions at the tapped point</button><p className="mt-1 text-[10px] text-slate-400">Detailed soil components and mapped features at the click location.</p>{pointOpen && <div className="mt-3 space-y-3"><SiteConditions point={point} /></div>}</section>
    {detail && detail.boulder?.status !== "ready" && <PropertyFillBar parcelKey={properties.parcelKey} point={point} detail={detail} fill={fill} onFill={setFill} />}
  </>;
}

type SiteLayer = { id: string; label: string; url: string; status: string; features: Record<string, unknown>[] };
type SoilAtPoint = { unit: { mukey: string; symbol: string; name: string; farmland: string } | null; components: SoilComponent[] };
const SITE_LAYERS: [string, string][] = [["flood", "Flood zone"], ["wetlands", "Wetlands"], ["waterways", "Waterways"], ["faults", "Faults"], ["roads", "State highway"], ["facilities", "EPA facilities"]];
const text = (value: unknown) => value == null ? "" : String(value).trim();
function featureText(id: string, f: Record<string, unknown>) {
  if (id === "flood") return `Zone ${text(f.FLD_ZONE) || "unknown"}${text(f.ZONE_SUBTY) ? ` (${text(f.ZONE_SUBTY).toLowerCase()})` : ""}${text(f.SFHA_TF).toUpperCase() === "T" ? " · special flood hazard area" : ""}`;
  if (id === "wetlands") return [text(f.WETLAND_TYPE), text(f.ATTRIBUTE)].filter(Boolean).join(" · ") || "Mapped wetland";
  if (id === "waterways") return text(f.GNIS_NAME) || "Unnamed waterway";
  if (id === "faults") return [text(f.fault_name) || "Unnamed fault", text(f.age)].filter(Boolean).join(" · ");
  if (id === "roads") return [[text(f.ROUTE), text(f.ALIAS)].filter(Boolean).join(" "), Number(f.AADT) > 0 ? `${Number(f.AADT).toLocaleString()} vehicles/day${text(f.AADTYR) ? ` (${text(f.AADTYR)})` : ""}` : ""].filter(Boolean).join(" · ");
  return text(f.FAC_NAME) || "Regulated facility";
}

// Soil and mapped hazards at the tapped point, loaded with the parcel; no map layer needs to be switched on.
function SiteConditions({ point: [lng, lat] }: { point: [number, number] }) {
  const [soil, setSoil] = useState<SoilAtPoint | null>(null);
  const [soilError, setSoilError] = useState("");
  const [layers, setLayers] = useState<SiteLayer[] | null>(null);
  const [layersError, setLayersError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const load = async (url: string, init?: RequestInit) => { const response = await fetch(url, { ...init, signal: controller.signal }); const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; };
    const failed = (set: (message: string) => void, message: string) => (error: Error) => { if (error.name !== "AbortError") set(message); };
    load(`/api/land-intelligence/soil-detail?lng=${lng.toFixed(6)}&lat=${lat.toFixed(6)}`).then(setSoil).catch(failed(setSoilError, "USDA soil data did not respond."));
    load("/api/land-intelligence/identify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lng, lat, layers: SITE_LAYERS.map(([id]) => id) }) })
      .then((body) => setLayers(body.results)).catch(failed(setLayersError, "Mapped feature services did not respond."));
    return () => controller.abort();
  }, [lng, lat]);
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  const checking = <p role="status" className="mt-2 flex items-center gap-2 text-[11px] text-cyan-200"><RotateCcw className="h-3 w-3 animate-spin" />Checking public sources…</p>;
  return <>
    <section className={panel} aria-busy={!soil && !soilError}>
      <SectionTitle icon={Sprout}>Soil here</SectionTitle>
      {!soil && !soilError && checking}
      {soilError && <p role="alert" className="mt-2 text-[11px] text-amber-200">{soilError}</p>}
      {soil && !soil.unit && <p className="mt-2 text-[11px] text-slate-300">No soil survey map unit at this point.</p>}
      {soil?.unit && <>
        <p className="mt-2 text-[11px] font-medium text-white">{soil.unit.name}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">Map unit {soil.unit.symbol}{soil.unit.farmland ? ` · ${soil.unit.farmland}` : ""}</p>
        {soil.components.length > 0 && <ul className="mt-2 space-y-1.5">{soil.components.slice(0, 3).map((item, index) => <li key={`${item.name}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px] leading-snug"><span className="font-medium text-slate-100">{item.name || "Unnamed component"}{item.percentage != null ? ` · ${item.percentage}%` : ""}</span><span className="block text-slate-300">{[item.drainage, item.hydric ? `hydric: ${item.hydric.toLowerCase()}` : "", item.slopePercent != null ? `${item.slopePercent}% slope` : ""].filter(Boolean).join(" · ")}</span></li>)}</ul>}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Describes the mapped soil unit, not a sample at this spot. <a href="https://websoilsurvey.nrcs.usda.gov/" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">USDA Web Soil Survey ↗</a></p>
      </>}
    </section>
    <section className={panel} aria-busy={!layers && !layersError}>
      <SectionTitle icon={Waves}>Mapped features here</SectionTitle>
      {!layers && !layersError && checking}
      {layersError && <p role="alert" className="mt-2 text-[11px] text-amber-200">{layersError}</p>}
      {layers && <>
        <FactRows rows={SITE_LAYERS.map(([id, label]) => {
          const result = layers.find((item) => item.id === id);
          const found = Array.from(new Set((result?.features ?? []).map((feature) => featureText(id, feature)).filter(Boolean)));
          return [label, result?.status !== "ok" ? "Source did not respond" : found.length ? found.join("; ") : "None mapped here"] as FactRow;
        })} />
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Flood zone and wetlands at the tapped point; other features within 35 m. A blank result is not proof of absence.</p>
        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">{layers.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">{item.label} ↗</a>)}</p>
      </>}
    </section>
  </>;
}

// One deterministic AI pass over the blank public-record fields; a field stays blank unless a live source page confirms it.
function PropertyFillBar({ parcelKey, point, detail, fill, onFill }: { parcelKey: string; point: [number, number]; detail: ParcelDetail; fill: PropertyFill | null; onFill: (fill: PropertyFill) => void }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const blank = missingFields(detail);
  if (!blank.length) return null;
  const run = () => {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setFailure("");
    fetch("/api/land-intelligence/property-fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: parcelKey, lng: point[0], lat: point[1] }), signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "The AI lookup failed."); onFill(body); })
      .catch((error: Error) => { if (error.name !== "AbortError") setFailure(error.message || "The AI lookup failed."); })
      .finally(() => { if (request.current === controller) setBusy(false); });
  };
  const values = fill ? Object.values(fill.fields) : [];
  const fromCounty = values.filter((item) => item?.via === "county").length;
  const fromWeb = values.length - fromCounty;
  return <section className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3" aria-live="polite">
    {!fill ? <>
      <button type="button" onClick={run} disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-60">{busy ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{busy ? "Checking county records, then the web…" : `Find ${blank.length} missing detail${blank.length === 1 ? "" : "s"} with AI`}</button>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Reads the county&apos;s own GIS parcel record first, then searches the web for the rest. Zoning (above) and owner names are not included. A detail stays blank unless a source shows it.</p>
    </> : <>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-300/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-200">AI-assisted · verify</span><span className="text-[11px] font-semibold text-white">{values.length ? `Found ${values.length} of ${blank.length} missing details` : "No confirmed values found"}</span></div>
      {values.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{[fromCounty ? `${fromCounty} from the county GIS record (marked COUNTY ↗)` : "", fromWeb ? `${fromWeb} from web pages that show them (marked AI ↗)` : ""].filter(Boolean).join(" and ")}.</p>}
      {fill.notFound.length > 0 && <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">Still blank: {fill.notFound.map((key) => FILL_FIELDS[key].label).join(", ")}.</p>}
      {fill.countyLayer && <a href={fill.countyLayer.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[11px] text-cyan-300 underline">County GIS record: {fill.countyLayer.name} ↗</a>}
      {fill.recordUrl && <a href={fill.recordUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[11px] text-cyan-300 underline">{isOfficial(fill.recordUrl) ? "County property record ↗" : "Listing page used (unofficial) ↗"}</a>}
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{fill.note}</p>
    </>}
    {failure && <p role="alert" className="mt-2 text-[11px] text-amber-200">{failure}</p>}
  </section>;
}

// Official GIS zoning loads with the parcel; the AI code search only runs when asked, since each one is a paid call.
function ZoningSection({ point: [lng, lat] }: { point: [number, number] }) {
  const [lookup, setLookup] = useState<ZoningLookup | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [code, setCode] = useState<ZoningCode | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const codeRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLookup(null); setLookupError(""); setCode(null); setCodeError(""); setCodeLoading(false);
    codeRequest.current?.abort();
    fetch(`/api/land-intelligence/zoning?lng=${lng.toFixed(6)}&lat=${lat.toFixed(6)}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Zoning lookup failed."); setLookup(body); })
      .catch((error: Error) => { if (error.name !== "AbortError") setLookupError("The zoning lookup did not respond. Try again shortly."); });
    return () => { controller.abort(); codeRequest.current?.abort(); };
  }, [lng, lat]);
  const findCode = () => {
    codeRequest.current?.abort();
    const controller = new AbortController();
    codeRequest.current = controller;
    setCodeLoading(true); setCodeError("");
    fetch("/api/land-intelligence/zoning-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lng, lat }), signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "The code search failed."); setCode(body); })
      .catch((error: Error) => { if (error.name !== "AbortError") setCodeError(error.message || "The code search failed."); })
      .finally(() => { if (codeRequest.current === controller) setCodeLoading(false); });
  };
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  const jurisdiction = lookup?.jurisdiction;
  return <section className={panel} aria-busy={!lookup && !lookupError}>
    <SectionTitle icon={Scale}>Zoning and code</SectionTitle>
    {!lookup && !lookupError && <p role="status" className="mt-2 flex items-center gap-2 text-[11px] text-cyan-200"><RotateCcw className="h-3 w-3 animate-spin" />Finding the governing jurisdiction and zoning district…</p>}
    {lookupError && <p role="alert" className="mt-2 text-[11px] text-amber-200">{lookupError}</p>}
    {lookup && <>
      <FactRows rows={[["Jurisdiction", jurisdiction ? `${jurisdiction.authority} · ${jurisdiction.incorporated ? "incorporated" : "unincorporated county"}` : "Not found"], ["Zoning district", fact(lookup.district?.code)], ["District name", fact(lookup.district?.description)], ...(lookup.district?.futureLandUse ? [["Future land use", lookup.district.futureLandUse] as [string, string]] : [])]} />
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{lookup.note}</p>
      {lookup.source && <a href={lookup.source.layerUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-words text-[10px] text-cyan-300 underline">Source: {lookup.source.name} ↗</a>}
      {jurisdiction && !code && <button type="button" onClick={findCode} disabled={codeLoading} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-60 md:inline-flex md:w-auto md:py-1.5 md:text-[11px]">{codeLoading ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{codeLoading ? "Searching the web for the code…" : lookup.district ? `Find the ${lookup.district.code} code` : "Find the zoning code"}</button>}
      {codeLoading && <p role="status" className="mt-1 text-[10px] text-slate-400">Usually 5–15 seconds.</p>}
      {codeError && <p role="alert" className="mt-2 text-[11px] text-amber-200">{codeError}</p>}
    </>}
    {code && <ZoningCodeResult code={code} />}
  </section>;
}

function ZoningCodeResult({ code }: { code: ZoningCode }) {
  const links: [string, CodeLink | null][] = [["Zoning code", code.code], ["District section", code.districtSection], ["Zoning map", code.zoningMap]];
  const found = links.filter((entry): entry is [string, CodeLink] => Boolean(entry[1]));
  const extraSources = code.sources.filter((source) => !found.some(([, link]) => link.url === source.url));
  return <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-300/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-200">AI-assisted · verify</span><span className="font-mono text-[9px] uppercase text-slate-400">{code.confidence} confidence</span></div>
    {code.districtName && <div className="text-[11px] font-semibold text-white">{code.districtName}</div>}
    {code.summary && <p className="text-[11px] leading-relaxed text-slate-300">{code.summary}</p>}
    {found.length > 0 && <ul className="space-y-1.5">{found.map(([label, link]) => <li key={label} className="text-[11px]"><span className="text-slate-400">{label}: </span><a href={link.url} target="_blank" rel="noopener noreferrer" className="break-words text-cyan-300 underline">{link.title} ↗</a>{!link.official && <span className="ml-1 text-[10px] text-amber-200">(unofficial source)</span>}</li>)}</ul>}
    {code.status === "none" && <p className="text-[11px] text-slate-300">No working code link was found. Check {code.jurisdiction.authority}&apos;s planning or zoning department.</p>}
    {code.standards.length > 0 && <div><h4 className="text-[11px] font-semibold text-white">Standards found</h4><dl className="mt-1 space-y-1.5">{code.standards.map((item, index) => <div key={`${item.label}-${index}`} className="grid grid-cols-[112px_1fr] gap-2 text-[11px] leading-snug"><dt className="text-slate-400">{item.label}</dt><dd className="break-words text-slate-100">{item.value} <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-300 underline">source ↗</a></dd></div>)}</dl></div>}
    {code.permittedUses.length > 0 && <div><h4 className="text-[11px] font-semibold text-white">Uses mentioned</h4><p className="mt-1 text-[11px] leading-relaxed text-slate-300">{code.permittedUses.join(" · ")}</p></div>}
    {extraSources.length > 0 && <div className="text-[10px]"><span className="text-slate-400">Other sources: </span>{extraSources.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-cyan-300 underline">{source.title}</a></span>)}</div>}
    <p className="text-[10px] leading-relaxed text-slate-400">{code.note}</p>
  </div>;
}

const recentFirst = <T extends { date: string }>(items: T[]) => [...items].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

function BoulderProfile({ property }: { property: BoulderProperty }) {
  const [selectedAccount, setSelectedAccount] = useState(property.accounts[0]?.accountNo ?? "");
  const account = property.accounts.find((item) => item.accountNo === selectedAccount) ?? property.accounts[0];
  return <div className="space-y-3">
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3"><SectionTitle icon={Database}>Boulder County assessor profile</SectionTitle><p className="mt-1 text-[10px] leading-relaxed text-slate-300">County records for parcel {property.folio}. {property.accounts.length} assessor {property.accounts.length === 1 ? "account" : "accounts"}. {property.sourceDate ? `County data dated ${property.sourceDate}.` : `Snapshot prepared ${new Date(property.updatedAt).toLocaleDateString()}.`}</p></div>
    {property.accounts.length > 1 && <label className="block text-[10px] text-slate-300">Assessor account <select value={account?.accountNo ?? ""} onChange={(event) => setSelectedAccount(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-900 px-2 py-2 text-[11px] text-white">{property.accounts.map((item) => <option key={item.accountNo} value={item.accountNo}>{item.accountNo} · {item.buildings.length} buildings · {item.sales.length} deeds · {item.permits.length} permits</option>)}</select></label>}
    {account && <BoulderAccountCard key={account.accountNo} account={account} />}
    {property.accounts.some((account) => (account.linkedParcelCount ?? 1) > 1) && <p className="text-[10px] leading-relaxed text-amber-200">Some assessor accounts link to several parcel numbers. Their buildings, sales and permits are account records and may concern another parcel in that account.</p>}
    <p className="text-[10px] leading-relaxed text-slate-400">County files can contain multiple records per account. A recorded document is not always a market sale, and a permit is not proof that work was completed. Confirm title, taxes and current condition with county records.</p>
    <a href={property.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-cyan-300 underline"><FileText className="h-3.5 w-3.5" />Boulder County data source ↗</a>
  </div>;
}

function BoulderAccountCard({ account }: { account: BoulderAccount }) {
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [tab, setTab] = useState<"account" | "values" | "sales" | "buildings" | "permits">("account");
  const sales = showAllRecords ? recentFirst(account.sales) : recentFirst(account.sales).slice(0, 5);
  const buildings = showAllRecords ? account.buildings : account.buildings.slice(0, 5);
  const permits = showAllRecords ? recentFirst(account.permits) : recentFirst(account.permits).slice(0, 5);
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  return <div className="space-y-2">
    <div role="tablist" aria-label={`Assessor account ${account.accountNo} records`} className="flex gap-1 overflow-x-auto pb-1">{([ ["account", "Account"], ["values", "Values"], ["sales", `Deeds ${account.sales.length}`], ["buildings", `Buildings ${account.buildings.length}`], ["permits", `Permits ${account.permits.length}`] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setShowAllRecords(false); }} className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-medium ${tab === id ? "bg-cyan-300/20 text-cyan-100" : "border border-white/10 text-slate-300 hover:bg-white/10"}`}>{label}</button>)}</div>
    {(account.linkedParcelCount ?? 1) > 1 && <p className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[10px] text-amber-100">This account links to {account.linkedParcelCount} parcel numbers. Account records are not assigned to a specific building footprint.</p>}
    {tab === "account" && <section className={panel}><SectionTitle icon={Landmark}>Assessor account {account.accountNo}</SectionTitle><FactRows rows={[["Reported owner", account.owners.length ? account.owners.join(" · ") : "Not in this feed"], ["Site address", fact(account.siteAddress)], ["Account type", fact(account.accountType)], ["Land uses", account.landUses.length ? account.landUses.join(" · ") : "Not in this feed"], ["Subdivision", fact(account.subdivision)], ["Tax area", fact(account.taxArea)], ["Mill levy", fact(account.millLevy)], ["Legal description", fact(account.legalDescription)]]} /></section>}
    {tab === "values" && <section className={panel}><SectionTitle icon={BadgeDollarSign}>Assessor values{account.values?.taxYear ? ` · tax year ${account.values.taxYear}` : ""}</SectionTitle><FactRows rows={[["Appraised total", money(account.values?.actualTotal ?? null)], ["Appraised land", money(account.values?.actualLand ?? null)], ["Appraised buildings", money(account.values?.actualBuildings ?? null)], ["Assessed total", money(account.values?.assessedTotal ?? null)]]} /><p className="mt-2 text-[10px] text-slate-400">Appraised and assessed values are not purchase prices or tax bills.</p></section>}
    {tab === "sales" && <section className={panel}><SectionTitle icon={Receipt}>Recorded sales and deeds</SectionTitle>{account.sales.length ? <div className="mt-2 space-y-2">{sales.map((item, index) => <div key={`${item.reception}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.price == null ? "Recorded document · price not reported" : money(item.price)}</div><div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-300"><CalendarDays className="h-3 w-3 text-cyan-300" />{fact(item.date)}{item.deedType && <span>· {item.deedType}</span>}</div>{item.qualification && <div className="text-slate-400">Sale code: {item.qualification}</div>}{item.reception && <div className="text-slate-400">Reception: {item.reception}</div>}</div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No associated sale or deed rows in this county snapshot.</p>}</section>}
    {tab === "buildings" && <section className={panel}><SectionTitle icon={Building2}>Buildings</SectionTitle>{account.buildings.length ? <div className="mt-2 space-y-2">{buildings.map((item, index) => <div key={`${item.buildingNumber}-${index}`} className="rounded-lg border border-white/10 p-2"><div className="text-[11px] font-medium text-white">{item.design || `Building ${item.buildingNumber || index + 1}`}</div><FactRows rows={[["Built", fact(item.yearBuilt)], ["Effective year", fact(item.effectiveYear)], ["Bedrooms", fact(item.bedrooms)], ["Bathrooms", [item.fullBaths == null ? "" : `${item.fullBaths} full`, item.threeQuarterBaths == null ? "" : `${item.threeQuarterBaths} ¾`, item.halfBaths == null ? "" : `${item.halfBaths} half`].filter(Boolean).join(" · ") || "Not in this feed"], ["Main floor", item.mainFloorSqft == null ? "Not in this feed" : `${item.mainFloorSqft.toLocaleString()} sq ft`], ["Basement", item.basementSqft == null ? "Not in this feed" : `${item.basementSqft.toLocaleString()} sq ft`], ["Garage/carport", item.garageSqft == null ? "Not in this feed" : `${item.garageSqft.toLocaleString()} sq ft`]]} /></div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No building row for this account.</p>}</section>}
    {tab === "permits" && <section className={panel}><SectionTitle icon={Hammer}>Permit records</SectionTitle>{account.permits.length ? <div className="mt-2 space-y-2">{permits.map((item, index) => <div key={`${item.number}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.description || item.number || "Permit"}</div><div className="text-slate-300">{[item.date, item.number ? `Permit ${item.number}` : "", item.category ? `Category: ${item.category}` : "", item.issuedBy ? `Issued by ${item.issuedBy}` : ""].filter(Boolean).join(" · ")}</div>{item.estimatedValue != null && <div className="text-slate-400">Reported work value: {money(item.estimatedValue)}</div>}</div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No permit row in this assessor file.</p>}</section>}
    {((tab === "sales" && account.sales.length > 5) || (tab === "buildings" && account.buildings.length > 5) || (tab === "permits" && account.permits.length > 5)) && <button type="button" onClick={() => setShowAllRecords((value) => !value)} className="w-full rounded-lg border border-white/20 px-3 py-2 text-[11px] font-semibold text-cyan-200 hover:bg-white/10">{showAllRecords ? "Show first 5 records" : `Show all ${tab === "sales" ? account.sales.length : tab === "buildings" ? account.buildings.length : account.permits.length} ${tab}`}</button>}
  </div>;
}

/** Blank feed fields show an AI-found value from `fill` only when a source confirms it. */
function PropertyFacts({ summary, detail, loading, error, fill }: { summary: ParcelRecord; detail: ParcelDetail | null; loading: boolean; error: string; fill?: PropertyFill | null }) {
  const parcel = detail?.parcel ?? summary;
  const filled = (key: FillKey, label: string, feed: string): FactRow => { const item = feed === "Not in this feed" ? fill?.fields[key] : undefined; return item ? [label, formatFilled(key, item.value), item] : [label, feed]; };
  // Rows no statewide feed carries appear only once the AI fill confirms them.
  const aiOnly = (key: FillKey): FactRow[] => fill?.fields[key] ? [filled(key, FILL_FIELDS[key].label, "Not in this feed")] : [];
  const landUseRow: FactRow = isUseCode(parcel.landUse) && fill?.fields.landUse ? ["Land use", `${formatFilled("landUse", fill.fields.landUse.value)} (${parcel.landUse})`, fill.fields.landUse] : filled("landUse", "Land use", fact(parcel.landUse));
  const saleRows = [...aiOnly("lastSaleDate"), ...aiOnly("lastSalePrice")];
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  return <>
    <section className={panel}>
      <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200"><MapPinned className="h-3.5 w-3.5" />{parcel.state} · {parcel.county || "County not supplied"}</h3>
      {/* The zoning section below covers zoning when the parcel feed has none. */}
      <FactRows rows={[["Parcel ID", fact(parcel.id)], ["Site address", fact(parcel.address)], landUseRow, ...(parcel.zoning ? [["Parcel zoning", parcel.zoning] as [string, string]] : []), ["Mapped area", parcel.acres == null ? "Not in this feed" : `${parcel.acres.toLocaleString()} acres`], filled("ownerType", "Owner type", fact(parcel.ownerType)), ["Data received", fact(parcel.received)]]} />
    </section>
    {loading && <p role="status" className="text-[11px] text-cyan-200">Loading public ownership, sales and values…</p>}
    {error && <p role="alert" className="text-[11px] text-amber-200">{error}</p>}
    {detail?.boulder?.status === "ready" && detail.boulder.property && <BoulderProfile property={detail.boulder.property} />}
    {detail?.boulder?.status === "not_loaded" && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-[11px] leading-relaxed text-amber-100">The Boulder County data snapshot has not been loaded on this server. Statewide fields appear below; the assessor and recorder links have the fuller county record.</p>}
    {!loading && detail?.boulder?.status !== "ready" && <>
      <section className={panel}><SectionTitle icon={UserRound}>Ownership</SectionTitle><FactRows rows={[["Reported owner", detail?.owners.length ? detail.owners.join(" · ") : "Not in this feed"]]} /><p className="mt-2 text-[10px] text-slate-400">Owner is a public parcel record entry. Verify current title with the county recorder.</p></section>
      <section className={panel}><SectionTitle icon={Receipt}>Reported sale history</SectionTitle>
        {detail?.sales.length ? <div className="mt-2 space-y-2">{detail.sales.map((item, index) => <div key={`${item.date}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.price == null ? "Price not provided" : money(item.price)}</div><div className="text-slate-300">{item.date || "Date not provided"}</div>{item.reference && <div className="text-slate-400">Recorder reference: {item.reference}</div>}</div>)}</div> : saleRows.length ? <FactRows rows={saleRows} /> : <p className="mt-2 text-[11px] text-slate-400">No sale transactions supplied by this statewide feed.</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">These are the source&apos;s reported sale entries, not a complete deed history. A recorded price may reflect a non-market transfer. Check the county recorder for earlier deeds and actual consideration.</p>
      </section>
      <section className={panel}><SectionTitle icon={BadgeDollarSign}>Public values and taxes{detail?.valueYear ? ` · ${detail.valueYear}` : ""}</SectionTitle>
        <FactRows rows={[filled("assessedTotal", detail?.valueLabels.total || "Assessed total", money(detail?.assessedTotal ?? null)), filled("assessedLand", detail?.valueLabels.land || "Land value", money(detail?.assessedLand ?? parcel.landValue)), filled("assessedImprovements", detail?.valueLabels.improvements || "Improvements", money(detail?.assessedImprovements ?? null)), filled("taxableValue", "Taxable value", money(detail?.taxableValue ?? null)), filled("estimatedMarketValue", "Est. fair market", money(detail?.estimatedMarketValue ?? null)), filled("annualPropertyTax", "Annual property tax", money(detail?.annualPropertyTax ?? null))]} />
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Assessed, taxable and estimated values are source labels. They are not the sale price or a current listing price.</p>
      </section>
      <section className={panel}><SectionTitle icon={House}>Building and legal facts</SectionTitle><FactRows rows={[filled("yearBuilt", "Year built", fact(detail?.yearBuilt)), filled("livingAreaSqft", "Living area", detail?.livingAreaSqft ? `${detail.livingAreaSqft.toLocaleString()} sq ft` : "Not in this feed"), filled("buildingCount", "Buildings", fact(detail?.buildingCount)), filled("deedAcres", "Deeded area", detail?.deedAcres ? `${detail.deedAcres.toLocaleString()} acres` : "Not in this feed"), filled("legalDescription", "Legal description", fact(detail?.legalDescription)), ...aiOnly("bedrooms"), ...aiOnly("bathrooms")]} /><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Bedrooms, bathrooms, listing status, liens and a complete sale chain are not supplied here. County assessor and recorder records may have more detail.</p></section>
    </>}
  </>;
}
