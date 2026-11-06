"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeDollarSign, Building2, Calculator, CalendarDays, ChevronDown, Database, Download, FileText, Hammer, House, Landmark, MapPinned, Receipt, RotateCcw, Scale, ShieldAlert, Sparkles, Sprout, UserRound, Waves, X, type LucideIcon } from "lucide-react";
import type { ParcelRecord } from "./parcel-sources";
import type { ParcelFinding, ParcelGeometry, ParcelInspectionReport } from "./parcel-inspection";
import { ParcelFindings } from "./ParcelFindings";
import { RoadSegmentDetails } from "./RoadSegmentDetails";
import type { ParcelDetail } from "./parcel-detail";
import type { BoulderAccount, BoulderProperty } from "./boulder-property";
import { RECORD_DATE_ISSUES } from "./record-date";
import type { FatalCrash } from "./crash";
import { FACILITY_STATUSES, type EpaFacility } from "./facility";
import type { ZoningLookup } from "./zoning";
import { isOfficial, type CodeLink, type ZoningCode } from "./zoning-code";
import { FILL_FIELDS, formatFilled, isUseCode, missingFields, type FillKey, type FilledValue, type PropertyFill } from "./property-fill";
import { parcelHeadline } from "./parcel-headline";
import { ENTITY_LABELS, boulderSaleClass, propertyHistory, type SaleStatus } from "./property-history";
import { COMP_TIERS, type CompResult } from "./comps";
import { ownershipCost, rentalAnalysis, residualLandValue, scenarioDefaults, type Default, type Scenario } from "./investment";
import { INSPECTION_SECTIONS, constraintRollup, coverageProfile, sectionNumber, type ConstraintRollup, type CoverageRow, type SectionId } from "./inspection-sections";
import { downloadParcelReport } from "./export-parcel-report";
import type { CountyLive, EntityMatch } from "./colorado-live";
import { RECENT_MONTHS, type RecentMonths, type RecentSale } from "./recent-sales";
import type { BoulderComparables } from "./boulder-comps";
import type { MarketContext } from "./market-data";
import type { AcsProfile, Estimate } from "./market";

/** The /comparables response, or a request error. */
export type ComparablesResponse = BoulderComparables | { status: "error"; reason: string };
/** The /market response, or a request error. */
export type MarketResponse = MarketContext | { error: string };

type SoilSelection = { kind: "soil"; point: [number, number]; properties: Record<string, string | number | null> };
type ParcelSelection = { kind: "parcel"; point: [number, number]; properties: ParcelRecord & { parcelKey: string } };
type CrashSelection = { kind: "crash"; point: [number, number]; properties: FatalCrash };
type FacilitySelection = { kind: "facility"; point: [number, number]; properties: EpaFacility };
type OverlaySelection = { kind: "overlay"; results: { id: string; label: string; url: string; status: string; features: Record<string, unknown>[] }[] };
type SoilComponent = { name: string; percentage: number | null; hydric: string; drainage: string; classification: string; slopePercent: number | null };

export function MapInspection({ inspection, loading, components, error, propertyDetail, propertyLoading, propertyError, parcelInspection, parcelGeometry, parcelInspectionLoading, parcelInspectionError, visibleFindingGroups, selectedFindingId, onToggleFindingGroup, onSetFindingGroupsVisible, onSelectFinding, onClose, onInspectOther, onComparablesMap }: {
  inspection: SoilSelection | ParcelSelection | CrashSelection | FacilitySelection | OverlaySelection | null; loading: boolean; components: SoilComponent[] | null; error: string;
  propertyDetail: ParcelDetail | null; propertyLoading: boolean; propertyError: string;
  parcelInspection: ParcelInspectionReport | null; parcelGeometry: ParcelGeometry | null; parcelInspectionLoading: boolean; parcelInspectionError: string;
  visibleFindingGroups: Record<string, boolean>; selectedFindingId: string | null;
  onToggleFindingGroup: (id: string) => void; onSetFindingGroupsVisible: (ids: string[], visible: boolean) => void; onSelectFinding: (finding: ParcelFinding) => void;
  onClose: () => void; onInspectOther: (point: [number, number]) => void;
  /** Comparable-sale markers for the map: the subject and each comparable (empty when none are loaded). */
  onComparablesMap?: (data: GeoJSON.FeatureCollection) => void;
}) {
  // Phones only: the sheet can shrink to its title bar so the map stays usable.
  const [collapsed, setCollapsed] = useState(false);
  // Single-open sections (one provider call at a time, less clutter); engineering subject areas open independently inside section 7.
  const [activeSection, setActiveSection] = useState<SectionId | null>("overview");
  const [openDiscipline, setOpenDiscipline] = useState<string | null>(null);
  const parcelKey = inspection?.kind === "parcel" ? inspection.properties.parcelKey : null;
  // Kept here so the printable report can include comparables once they have been loaded for this parcel.
  const [comparables, setComparables] = useState<{ key: string; data: ComparablesResponse } | null>(null);
  const [market, setMarket] = useState<{ key: string; data: MarketResponse } | null>(null);
  const [fill, setFill] = useState<{ key: string; data: PropertyFill } | null>(null);
  const [scenario, setScenario] = useState<{ key: string; data: Scenario } | null>(null);
  useEffect(() => setCollapsed(false), [inspection]);
  useEffect(() => { setActiveSection(parcelKey ? "overview" : null); setOpenDiscipline(null); }, [parcelKey]);
  // A finding picked on the map opens section 7, where ParcelFindings expands its subject area.
  useEffect(() => { if (selectedFindingId) setActiveSection("engineering"); }, [selectedFindingId]);
  const parcelComparables = comparables && comparables.key === parcelKey ? comparables.data : null;
  const parcelMarket = market && market.key === parcelKey ? market.data : null;
  const parcelFill = fill && fill.key === parcelKey ? fill.data : null;
  const parcelScenario = scenario && scenario.key === parcelKey ? scenario.data : null;
  const parcelReport = parcelInspection?.parcelKey === parcelKey ? parcelInspection : null;
  const rollup = constraintRollup(parcelReport);
  const coverage = inspection?.kind === "parcel" ? coverageProfile(inspection.properties.state, inspection.properties.county, propertyDetail?.boulder?.status) : [];
  const toggleSection = (id: SectionId) => setActiveSection((current) => current === id ? null : id);
  const openSection = (id: SectionId) => { setActiveSection(id); requestAnimationFrame(() => document.getElementById(`li-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const toMap = useRef(onComparablesMap);
  toMap.current = onComparablesMap;
  useEffect(() => { toMap.current?.(comparablesGeoJSON(parcelComparables?.status === "ready" ? parcelComparables.result : null)); }, [parcelComparables]);
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
    {inspection?.kind === "parcel" && <div className="mt-2 space-y-2">
      <ParcelHeadlineCard detail={propertyDetail} loading={propertyLoading} error={propertyError} />
      <InspectionPanel id="overview" open={activeSection === "overview"} onToggle={toggleSection} status={coverage.length ? `${coverage.filter((row) => row.level !== "no").length} of ${coverage.length} record types published here` : undefined}>{() => <>
        <PropertyFacts part="overview" summary={inspection.properties} detail={propertyDetail} loading={propertyLoading} error={propertyError} fill={parcelFill} />
       
        {propertyDetail && propertyDetail.boulder?.status !== "ready" && <PropertyFillBar parcelKey={inspection.properties.parcelKey} point={inspection.point} detail={propertyDetail} fill={parcelFill} onFill={(data) => setFill({ key: inspection.properties.parcelKey, data })} />}
      </>}</InspectionPanel>
      <InspectionPanel id="ownership" open={activeSection === "ownership"} onToggle={toggleSection}>{() => <PropertyFacts part="ownership" summary={inspection.properties} detail={propertyDetail} loading={propertyLoading} error={propertyError} fill={parcelFill} />}</InspectionPanel>
      <InspectionPanel id="sales" open={activeSection === "sales"} onToggle={toggleSection}>{() => <PropertyFacts part="sales" summary={inspection.properties} detail={propertyDetail} loading={propertyLoading} error={propertyError} fill={parcelFill} />}</InspectionPanel>
      <InspectionPanel id="listings" open={activeSection === "listings"} onToggle={toggleSection} status="Not connected: requires MLS or paid listing licenses">{() => <p className="text-[11px] leading-relaxed text-slate-300">No licensed listing or lease source is connected for this area. Sale and rental listings come from MLS systems and commercial feeds that require brokerage or paid licenses, which this free tool does not use. Recorded sales are in section {sectionNumber("sales")}; area rents are in section {sectionNumber("market")}.</p>}</InspectionPanel>
      <InspectionPanel id="comparables" open={activeSection === "comparables"} onToggle={toggleSection} status={parcelComparables?.status === "ready" ? `${parcelComparables.result.used} comparable sales${parcelComparables.result.estimate ? " · value range" : ""}` : coverage.find((row) => row.family === "comparables")?.level === "no" ? inspection.properties.state === "Colorado" ? "Recent recorded sales nearby" : "Boulder County parcels only" : "Loads when opened"}>{() => <><ComparablesSection parcelKey={inspection.properties.parcelKey} data={parcelComparables} onLoaded={(data) => setComparables({ key: inspection.properties.parcelKey, data })} detail={propertyDetail} />{inspection.properties.state === "Colorado" && parcelComparables?.status !== "ready" && parcelComparables != null && <RecentSalesNearby key={inspection.properties.parcelKey} point={inspection.point} parcelId={inspection.properties.id} />}</>}</InspectionPanel>
      <InspectionPanel id="market" open={activeSection === "market"} onToggle={toggleSection} status={parcelMarket && !("error" in parcelMarket) ? [parcelMarket.geography.tract?.name, parcelMarket.geography.county?.name].filter(Boolean).join(" · ") : "Loads when opened"}>{() => <MarketSection point={inspection.point} data={parcelMarket} onLoaded={(data) => setMarket({ key: inspection.properties.parcelKey, data })} />}</InspectionPanel>
      <InspectionPanel id="engineering" open={activeSection === "engineering"} onToggle={toggleSection} status={parcelReport ? `${parcelReport.groups.reduce((sum, group) => sum + group.findings.length, 0)} mapped records across 12 subject areas` : parcelInspectionLoading ? "Checking parcel sources…" : undefined}>{() => <>
        <ParcelFindings report={parcelReport} geometry={parcelGeometry} propertyDetail={propertyDetail} loading={parcelInspectionLoading} error={parcelInspectionError} visible={visibleFindingGroups} selectedId={selectedFindingId} onToggle={onToggleFindingGroup} onSetVisible={onSetFindingGroupsVisible} onSelect={onSelectFinding} openSection={openDiscipline} onOpenSection={setOpenDiscipline} propertyArea={(id) => <><PropertyAreaSummary id={id} summary={inspection.properties} detail={propertyDetail} onOpenFull={() => openSection(id === "legal" ? "ownership" : id === "permits" ? "sales" : "overview")} />{id === "permits" && <ZoningSection point={inspection.point} />}</>} />
        <PointConditions point={inspection.point} />
      </>}</InspectionPanel>
      <InspectionPanel id="feasibility" open={activeSection === "feasibility"} onToggle={toggleSection} status={rollup ? `${rollup.rows.reduce((sum, row) => sum + row.onParcel, 0)} mapped records on the parcel · calculators` : "Zoning, constraints and calculators"}>{() => <>
        <ZoningSection point={inspection.point} />
        <ConstraintSummary rollup={rollup} loading={parcelInspectionLoading} onOpenEngineering={() => openSection("engineering")} />
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><SectionTitle icon={Calculator}>Scenario calculators</SectionTitle><div className="mt-2"><InvestmentSection key={inspection.properties.parcelKey} point={inspection.point} detail={propertyDetail} comps={parcelComparables?.status === "ready" ? parcelComparables.result : null} market={parcelMarket} onMarketLoaded={(data) => setMarket({ key: inspection.properties.parcelKey, data })} onScenario={(data) => setScenario({ key: inspection.properties.parcelKey, data })} /></div></section>
      </>}</InspectionPanel>
      {parcelReport && parcelGeometry ? <button type="button" onClick={() => downloadParcelReport(parcelReport, parcelGeometry, { name: inspection.properties.address || `Parcel ${inspection.properties.id || "record"}`, id: inspection.properties.id || inspection.properties.parcelKey, locality: [inspection.properties.county, inspection.properties.state].filter(Boolean).join(", "), sourceUrl: inspection.properties.recordUrl || inspection.properties.sourceUrl }, propertyDetail, parcelComparables?.status === "ready" ? parcelComparables.result : null, parcelMarket && !("error" in parcelMarket) ? parcelMarket : null, parcelScenario)} className="li-inspection-download flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold"><Download className="h-3.5 w-3.5" />Download printable report (8 sections)</button>
        : <p className="text-[10px] text-slate-400">{parcelInspectionLoading ? "The printable report is available once parcel sources finish." : "The printable report needs the parcel boundary and source check."}</p>}
      <p className="text-[10px] leading-relaxed text-slate-400">The report includes comparables, market data and the calculator scenario once those sections have been opened.</p>
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
    {inspection?.kind === "overlay" && <div className="mt-3 space-y-2">{inspection.results.flatMap((result) => result.features.map((feature, index) => <section key={`${result.id}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><h3 className="font-semibold text-white">{result.label}</h3><dl className="mt-1.5 space-y-1 text-[11px]">{Object.entries(feature).map(([key, value]) => <div key={key} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-slate-400">{key.replaceAll("_", " ")}</dt><dd className="break-words text-slate-100">{/^https:\/\//.test(String(value)) ? <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Open record ↗</a> : String(value)}</dd></div>)}</dl>{result.id === "roads" && Number.isSafeInteger(Number(feature.OBJECTID)) && Number(feature.OBJECTID) > 0 && <RoadOverlayControl segmentId={String(feature.OBJECTID)} />}<a href={result.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-cyan-300 underline">Source service ↗</a></section>))}{!inspection.results.some((result) => result.features.length) && <p className="text-slate-300">No mapped feature returned at this click. Turn on layers or click a visible feature; a blank result does not establish absence.</p>}{inspection.results.some((result) => result.status === "unavailable") && <p className="text-amber-200">Some source services did not respond.</p>}</div>}
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
    {id === "land" && <><FactRows rows={[["Parcel ID", fact(parcel.id)], ["Mapped area", parcel.acres == null ? "Not reported" : `${parcel.acres.toLocaleString()} acres`], ["Land use", fact(parcel.landUse)], ["Parcel zoning", fact(parcel.zoning)], ["Account", fact(detail?.accountNumber || oneAccount?.accountNo)], ["Subdivision", fact(detail?.subdivision || oneAccount?.subdivision)], ["Block / lot", [detail?.block, detail?.lot].filter(Boolean).join(" / ") || "Not in this feed"], [oneAccount?.values?.actualTotal != null ? "County actual value" : detail?.estimatedMarketValue != null ? detail.valueLabels.market : detail?.valueLabels.total ?? "Assessed value", money(oneAccount?.values?.actualTotal ?? detail?.estimatedMarketValue ?? detail?.assessedTotal ?? null)], [oneAccount?.values?.assessedTotal != null ? "County assessed value" : detail?.valueLabels.taxable ?? "Taxable value", money(oneAccount?.values?.assessedTotal ?? detail?.taxableValue ?? null)]]} /><p className="text-[10px] text-slate-400">Value is an assessor field, not a sale or listing price. Statewide data may lag county updates.{detail?.valueNote && !oneAccount ? ` ${detail.valueNote}` : ""}</p></>}
    {id === "legal" && <><FactRows rows={[["Reported owner", accounts.length === 1 && oneAccount?.owners.length ? oneAccount.owners.join(" · ") : detail?.owners.length ? detail.owners.join(" · ") : "Not in this feed"], ["Legal description", fact(detail?.legalDescription || oneAccount?.legalDescription)], ["Deeded area", detail?.deedAcres == null ? "Not in this feed" : `${detail.deedAcres.toLocaleString()} acres`]]} />{sales.length ? <><p className="font-semibold text-white">Recent assessor deed rows</p>{sales.slice(0, 3).map((sale, index) => <p key={`${sale.account}-${sale.reception}-${index}`} className="rounded-md border border-white/10 px-2 py-1.5">{sale.date || (sale.dateIssue ? RECORD_DATE_ISSUES[sale.dateIssue] : "Date not reported")} ·{sale.price == null ? "price not reported" : money(sale.price)}{sale.reception ? ` · reception ${sale.reception}` : ""}{accounts.length > 1 ? ` · account ${sale.account}` : ""}</p>)}{sales.length > 3 && <p className="text-slate-400">{sales.length - 3} more deed rows in the full record.</p>}</> : detail?.sales.length ? <p>Last reported sale: {detail.sales[0].date || "date not reported"} · {money(detail.sales[0].price)}</p> : <p className="text-slate-400">No sale or deed row supplied for this parcel.</p>}<p className="text-[10px] text-slate-400">Owner and deed rows do not establish current title or a market transaction.</p></>}
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
  return <h4 className="flex items-center gap-2 text-xs font-semibold text-white"><Icon aria-hidden className="h-4 w-4 shrink-0 text-cyan-300" />{children}</h4>;
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

/** One numbered inspection section: a disclosure button with a one-line status, content rendered only while open. */
function InspectionPanel({ id, open, onToggle, status, children }: { id: SectionId; open: boolean; onToggle: (id: SectionId) => void; status?: string; children: () => React.ReactNode }) {
  const section = INSPECTION_SECTIONS.find((item) => item.id === id)!;
  return <section id={`li-section-${id}`} className={`scroll-mt-2 overflow-hidden rounded-xl border ${open ? "border-cyan-300/30 bg-white/[0.02]" : "border-white/10"}`}>
    <h3><button type="button" id={`li-section-${id}-title`} aria-expanded={open} aria-controls={`li-section-${id}-body`} onClick={() => onToggle(id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
      <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] ${open ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100" : "border-white/15 text-slate-300"}`}>{sectionNumber(id)}</span>
      <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white">{section.title}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{status ?? section.summary}</span></span>
      <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-cyan-300 transition-transform ${open ? "rotate-180" : ""}`} />
    </button></h3>
    {open && <div id={`li-section-${id}-body`} role="region" aria-labelledby={`li-section-${id}-title`} className="space-y-3 border-t border-white/10 p-2.5">{children()}</div>}
  </section>;
}

const COVERAGE_CHIP = { yes: ["Published", "border-emerald-300/40 text-emerald-200"], partial: ["Partial", "border-amber-300/40 text-amber-200"], no: ["Not published", "border-white/15 text-slate-400"] } as const;

/** Which record families the connected free sources publish for this jurisdiction. */
function CoverageProfile({ rows }: { rows: CoverageRow[] }) {
  return <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3" aria-label="Records available for this jurisdiction">
    <SectionTitle icon={Database}>Records available here</SectionTitle>
    <ul className="mt-2 space-y-1.5">{rows.map((row) => <li key={row.family} className="grid grid-cols-[1fr_auto] items-start gap-2 text-[11px]"><span><span className="text-slate-100">{row.label}</span><span className="block text-[10px] text-slate-400">{row.note}</span></span><span className={`whitespace-nowrap rounded border px-1.5 text-[9px] ${COVERAGE_CHIP[row.level][1]}`}>{COVERAGE_CHIP[row.level][0]}</span></li>)}</ul>
    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">“Not published” means the connected public sources do not supply it here, not that no record exists. The county assessor and recorder are the full sources.</p>
  </section>;
}

/** Mapped records touching the parcel, by subject area, with the sources that could not be checked. */
function ConstraintSummary({ rollup, loading, onOpenEngineering }: { rollup: ConstraintRollup | null; loading: boolean; onOpenEngineering: () => void }) {
  return <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3" aria-busy={loading}>
    <SectionTitle icon={ShieldAlert}>Mapped constraints</SectionTitle>
    {!rollup ? <p className="mt-2 text-[11px] text-slate-400">{loading ? "Checking parcel sources…" : "The parcel source check has not returned."}</p> : <>
      {rollup.rows.length ? <ul className="mt-2 space-y-1.5">{rollup.rows.map((row) => <li key={row.id} className="text-[11px] text-slate-200"><span className="font-medium text-white">{row.label}</span>: {row.onParcel} on or crossing the parcel · {row.nearby} nearby{row.names.length > 0 && <span className="block text-[10px] text-slate-400">{row.names.join(" · ")}</span>}</li>)}</ul> : <p className="mt-2 text-[11px] text-slate-300">No mapped feature from the connected engineering sources touches or neighbors this parcel.</p>}
      {rollup.unchecked.length > 0 && <p className="mt-2 text-[10px] text-amber-200">Not fully checked: {rollup.unchecked.join(", ")}. A missing record is not evidence of absence.</p>}
    </>}
    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Counts are mapped public records, not a risk score. Confirm permitted uses, density and setbacks with the zoning authority.</p>
    <button type="button" onClick={onOpenEngineering} className="li-inspection-action mt-2 rounded-md px-2 py-1.5 text-[10px] font-medium text-cyan-200">Open land and engineering research</button>
  </section>;
}

/** Soil components and mapped features at the tapped point, loaded on request. */
function PointConditions({ point }: { point: [number, number] }) {
  const [open, setOpen] = useState(false);
  return <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="w-full text-left text-[11px] font-medium text-cyan-200">{open ? "Hide" : "Show"} conditions at the tapped point</button><p className="mt-1 text-[10px] text-slate-400">Detailed soil components and mapped features at the click location.</p>{open && <div className="mt-3 space-y-3"><SiteConditions point={point} /></div>}</section>;
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
const SALE_TONE: Record<SaleStatus, string> = { market: "border-emerald-300/40 text-emerald-200", qualified_changed: "border-sky-300/40 text-sky-200", non_market: "border-white/15 text-slate-300", pending: "border-amber-300/40 text-amber-200", unknown: "border-white/15 text-slate-400" };
const sqft = (value: number | null | undefined) => value == null ? "Not in this feed" : `${value.toLocaleString()} sq ft`;
const pct = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
function Calculated() { return <span className="ml-1 rounded border border-violet-300/40 px-1 font-mono text-[8px] uppercase tracking-wider text-violet-200">calculated</span>; }

/** One property history across county deeds and statewide sales; every derived figure is marked as calculated. */
function PropertyHistorySection({ detail }: { detail: ParcelDetail }) {
  const [showAll, setShowAll] = useState(false);
  const history = propertyHistory(detail);
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  const sales = showAll ? history.sales : history.sales.slice(0, 6);
  const last = history.lastMarketSale;
  if (!history.sales.length && !history.permits && !history.buildings && !history.owners.length) return null;
  return <section className={panel} aria-label="Property history">
    <SectionTitle icon={CalendarDays}>Property history</SectionTitle>
    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Built from the connected public records only. Sale qualification comes from the county or state code; purple “calculated” figures are arithmetic on those records, not appraisals or bills.</p>
    <FactRows rows={[
      ["Last qualified sale", last ? `${money(last.price)} · ${last.date}` : history.sales.length ? "None qualified in these records" : "No sale records"],
      ["Qualified sales", String(history.marketSales)], ["Recorded documents", String(history.sales.length)],
    ]} />
    {history.priceChanges.slice(0, 3).map((change, index) => <p key={`${change.to.date}-${index}`} className="mt-2 rounded-md border border-violet-300/20 px-2 py-1.5 text-[11px] text-slate-200">{change.from.date} {money(change.from.price)} → {change.to.date} {money(change.to.price)}: <strong className="text-white">{change.change >= 0 ? "+" : "−"}{money(Math.abs(change.change))}</strong>{change.annualRate != null && <> · {pct(change.annualRate)}/yr</>}<Calculated />{change.permitsBetween > 0 && <span className="block text-[10px] text-amber-200">{change.permitsBetween} permit {change.permitsBetween === 1 ? "record" : "records"} between these sales; improvements may explain part of the change.</span>}</p>)}
    {sales.length > 0 && <ol className="mt-2 space-y-1.5">{sales.map((sale, index) => <li key={`${sale.source}-${sale.reference}-${sale.date}-${index}`} className="border-l-2 border-cyan-400/40 pl-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-2"><span className="font-medium text-white">{sale.price == null ? "No price" : money(sale.price)}</span><span className="text-slate-300">{sale.date || (sale.dateIssue ? <span className="text-amber-200">{RECORD_DATE_ISSUES[sale.dateIssue]}</span> : "Date not reported")}</span><span className={`rounded border px-1 text-[9px] ${SALE_TONE[sale.status]}`}>{sale.label}</span></div>
      <div className="text-[10px] text-slate-400">{[sale.source === "county" ? "County record" : "Statewide record", sale.deedType && (sale.deedType.includes(" ") ? sale.deedType : `deed type ${sale.deedType}`), sale.parties, sale.account && `account ${sale.account}`, sale.reference && `ref ${sale.reference}`, sale.vacantAtSale === true && "price covered vacant land", sale.vacantAtSale === false && "price covered improved property", sale.multiParcel && "multi-parcel sale", sale.sharedAccount && "account spans several parcels"].filter(Boolean).join(" · ")}</div>
    </li>)}</ol>}
    {history.sales.length > 6 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-2 w-full rounded-lg border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-white/10">{showAll ? "Show 6 most recent" : `Show all ${history.sales.length} records`}</button>}
    {history.owners.length > 0 && <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ownership</p>{history.owners.map((owner, index) => <p key={`${owner.account}-${owner.name}-${index}`} className="text-[11px] text-slate-200">{owner.name}<span className="text-slate-400">{[owner.role && ` · ${owner.role}`, owner.share != null && ` · ${Math.round(owner.share * 100)}% share`, ` · ${ENTITY_LABELS[owner.entity]}`].filter(Boolean).join("")}</span></p>)}<p className="mt-1 text-[10px] text-slate-400">Entity type is read from words in the recorded name (rule-based). Joint tenants can each show 100%. Title requires the recorder.</p></div>}
    {history.buildings && <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Buildings on record</p><FactRows rows={[["Buildings / sections", `${history.buildings.buildings} / ${history.buildings.sections}`], ["Finished area (sum)", sqft(history.buildings.finishedSqft)], ["Basement area (sum)", sqft(history.buildings.basementSqft)], ["Residential units", fact(history.buildings.units)], ["Oldest year built", fact(history.buildings.oldestYear)], ["Newest effective year", fact(history.buildings.newestEffectiveYear)], ...(history.buildings.incomplete ? [["Under construction", `${history.buildings.incomplete} section(s) below 100% complete`] as [string, string]] : [])]} /></div>}
    {history.permits && <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Permit activity</p><FactRows rows={[["Permit records", `${history.permits.total}${history.permits.withheldDates ? ` (${history.permits.withheldDates} without a usable date)` : ""}`], ["Most recent", fact(history.permits.last)], ["Earliest dated", fact(history.permits.first)], [`Since ${history.permits.recentSince}`, String(history.permits.recent)], ["Reported work value", history.permits.reportedValue ? money(history.permits.reportedValue) : "Not reported"], ["Latest new construction", fact(history.permits.latestNewConstruction)]]} /><p className="mt-1 text-[10px] text-slate-400">{history.permits.categories.map((item) => `${item.name} ${item.count}`).join(" · ")}. Not every permit reaches the assessor, and a permit does not prove completed work.</p></div>}
    {history.taxes.length > 0 && <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Estimated property tax<Calculated /></p>{history.taxes.map((tax) => <p key={tax.account} className="text-[11px] text-slate-200">{history.taxes.length > 1 ? `Account ${tax.account}: ` : ""}<strong className="text-white">{tax.low === tax.high ? money(tax.low) : `${money(tax.low)}–${money(tax.high)}`}</strong> <span className="text-slate-400">· assessed {money(tax.assessed)}{tax.assessedSchool != null && tax.assessedSchool !== tax.assessed ? ` (school ${money(tax.assessedSchool)})` : ""} × {tax.millLevy} mills ÷ 1,000 · tax year {tax.taxYear || "n/a"}</span></p>)}<p className="mt-1 text-[10px] text-slate-400">School and other levies apply to different assessed values, so the bill falls in this range before exemptions, credits or new levies. It is not a tax bill.</p></div>}
  </section>;
}

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
    {tab === "account" && <section className={panel}><SectionTitle icon={Landmark}>Assessor account {account.accountNo}</SectionTitle><FactRows rows={[["Reported owner", account.ownerships?.length ? account.ownerships.map((owner) => [owner.name, owner.role, owner.share != null ? `${Math.round(owner.share * 100)}%` : ""].filter(Boolean).join(" · ")).join("; ") : account.owners.length ? account.owners.join(" · ") : "Not in this feed"], ["Site address", fact([account.siteAddress, account.city].filter(Boolean).join(", "))], ...(account.unit ? [["Unit", account.unit] as [string, string]] : []), ["Account type", fact(account.accountType)], ["Land uses", account.landUses.length ? account.landUses.join(" · ") : "Not in this feed"], ["Land area (county GIS)", account.land?.length ? account.land.map((land) => land.gisAcres != null ? `${land.gisAcres.toLocaleString()} acres` : sqft(land.gisSqft)).join(" · ") : "Not in this feed"], ["Subdivision", fact(account.subdivision)], ["Appraisal neighborhood", fact(account.neighborhood)], ["Section / township / range", fact(account.plss)], ["Tax area", fact(account.taxArea)], ["Mill levy", fact(account.millLevy)], ["Legal description", fact(account.legalDescription)]]} /><p className="mt-2 text-[10px] text-slate-400">County GIS land area is not survey quality. Ownership updates can lag a recorded deed by 3–6 weeks (county).</p></section>}
    {tab === "values" && <section className={panel}><SectionTitle icon={BadgeDollarSign}>Assessor values{account.values?.taxYear ? ` · tax year ${account.values.taxYear}` : ""}</SectionTitle><FactRows rows={[["Actual value", money(account.values?.actualTotal ?? null)], ["Actual land", money(account.values?.actualLand ?? null)], ["Actual buildings", money(account.values?.actualBuildings ?? null)], ...(account.values?.actualExtraFeatures ? [["Actual extra features", money(account.values.actualExtraFeatures)] as [string, string]] : []), ["Assessed value (non-school)", money(account.values?.assessedTotal ?? null)], ["Assessed value (school)", money(account.values?.assessedSchool ?? null)], ["Assessed land / buildings", account.values?.assessedLand != null || account.values?.assessedBuildings != null ? `${money(account.values?.assessedLand ?? null)} / ${money(account.values?.assessedBuildings ?? null)}` : "Not in this feed"]]} /><p className="mt-2 text-[10px] text-slate-400">Actual value is the county&apos;s valuation; assessed value is the taxable portion (school and other districts use different rates for residential property). Only the current tax year is published, so no value history is shown. Neither is a purchase price or tax bill.</p></section>}
    {tab === "sales" && <section className={panel}><SectionTitle icon={Receipt}>Recorded sales and deeds</SectionTitle>{account.sales.length ? <div className="mt-2 space-y-2">{sales.map((item, index) => <div key={`${item.reception}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.price == null ? "Recorded document · price not reported" : money(item.price)}</div><div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-300"><CalendarDays className="h-3 w-3 text-cyan-300" />{item.date || (item.dateIssue ? <span className="text-amber-200">{RECORD_DATE_ISSUES[item.dateIssue]}{item.dateIssue !== "placeholder" && item.recordedDate ? ` (${item.recordedDate.split(" ")[0]})` : ""}</span> : fact(item.date))}{item.deedType && <span>· deed type {item.deedType}</span>}</div>{<div className="text-slate-400">{boulderSaleClass(item.qualification, item.price).label}</div>}{item.reception && <div className="text-slate-400">Reception: {item.reception}</div>}</div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No associated sale or deed rows in this county snapshot.</p>}</section>}
    {tab === "buildings" && <section className={panel}><SectionTitle icon={Building2}>Buildings</SectionTitle>{account.buildings.length ? <div className="mt-2 space-y-2">{buildings.map((item, index) => <div key={`${item.buildingNumber}-${index}`} className="rounded-lg border border-white/10 p-2"><div className="text-[11px] font-medium text-white">{item.design || `Building ${item.buildingNumber || index + 1}`}{item.section && item.section !== "1" ? ` · section ${item.section}` : ""}</div><FactRows rows={[["Built", fact(item.yearBuilt)], ["Effective year", fact(item.effectiveYear)], ...(item.percentComplete != null && item.percentComplete < 1 ? [["Complete", `${Math.round(item.percentComplete * 100)}% (as of Jan 1)`] as [string, string]] : []), ["Class", fact(item.buildingClass)], ["Quality / construction", [item.quality, item.construction].filter(Boolean).join(" · ") || "Not in this feed"], ["Finished area", sqft(item.finishedSqft)], ["Main floor", sqft(item.mainFloorSqft)], ["Basement", item.basements?.length ? item.basements.map((basement) => `${basement.type.toLowerCase()} ${basement.sqft.toLocaleString()} sq ft`).join(" · ") : sqft(item.basementSqft)], ["Bedrooms", fact(item.bedrooms)], ["Bathrooms", [item.fullBaths == null ? "" : `${item.fullBaths} full`, item.threeQuarterBaths == null ? "" : `${item.threeQuarterBaths} ¾`, item.halfBaths == null ? "" : `${item.halfBaths} half`].filter(Boolean).join(" · ") || "Not in this feed"], ["Garage/carport", item.garageSqft == null ? "Not in this feed" : `${sqft(item.garageSqft)}${item.garageType ? ` · ${item.garageType.toLowerCase()}` : ""}`], ...(item.stories ? [["Stories", String(item.stories)] as [string, string]] : []), ...(item.units ? [["Residential units", String(item.units)] as [string, string]] : []), ["Heating / cooling", [item.heating, item.cooling].filter(Boolean).join(" · ") || "Not in this feed"], ["Exterior / roof", [item.exteriorWall, item.roof].filter(Boolean).join(" · ") || "Not in this feed"]]} /></div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No building row for this account.</p>}<p className="mt-2 text-[10px] text-slate-400">Finished area is above-grade for residential and includes below-grade for commercial (county definition). Buildings are assessed as of January 1.</p></section>}
    {tab === "permits" && <section className={panel}><SectionTitle icon={Hammer}>Permit records</SectionTitle>{account.permits.length ? <div className="mt-2 space-y-2">{permits.map((item, index) => <div key={`${item.number}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.description || item.number || "Permit"}</div><div className="text-slate-300">{[item.date || (item.dateIssue ? RECORD_DATE_ISSUES[item.dateIssue] : ""), item.number ? `Permit ${item.number}` : "", item.category ? `Category: ${item.category}` : "", item.issuedBy ? `Issued by ${item.issuedBy}` : ""].filter(Boolean).join(" · ")}</div>{item.estimatedValue != null && <div className="text-slate-400">Reported work value: {money(item.estimatedValue)}</div>}</div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">No permit row in this assessor file.</p>}</section>}
    {((tab === "sales" && account.sales.length > 5) || (tab === "buildings" && account.buildings.length > 5) || (tab === "permits" && account.permits.length > 5)) && <button type="button" onClick={() => setShowAllRecords((value) => !value)} className="w-full rounded-lg border border-white/20 px-3 py-2 text-[11px] font-semibold text-cyan-200 hover:bg-white/10">{showAllRecords ? "Show first 5 records" : `Show all ${tab === "sales" ? account.sales.length : tab === "buildings" ? account.buildings.length : account.permits.length} ${tab}`}</button>}
  </div>;
}

/** Map points for loaded comparables: the subject (ring), used comparables (filled) and outliers (hollow). */
function comparablesGeoJSON(result: CompResult | null): GeoJSON.FeatureCollection {
  if (!result) return { type: "FeatureCollection", features: [] };
  const unit = result.subject.basis === "land" ? "sq ft land" : "sq ft";
  const features: GeoJSON.Feature[] = result.comps.filter((comp) => comp.point).map((comp) => ({ type: "Feature", properties: { kind: comp.outlier ? "outlier" : "comp", label: `${comp.date} · $${comp.price.toLocaleString()} · $${Math.round(comp.perUnit).toLocaleString()}/${unit}${comp.outlier ? " · outlier, not used" : ""}` }, geometry: { type: "Point", coordinates: comp.point! } }));
  if (result.subject.point) features.unshift({ type: "Feature", properties: { kind: "subject", label: "Subject parcel" }, geometry: { type: "Point", coordinates: result.subject.point } });
  return { type: "FeatureCollection", features };
}

/**
 * Fetch `url` once, when a section first opens and has no data yet. The parent passes a new callback each render, so a
 * ref keeps a re-render from restarting the request. `failure` turns an HTTP error body or a network error into data.
 */
function useLazyLoad<T>(url: string, hasData: boolean, onLoaded: (data: T) => void, failure: (body: { error?: string } | null) => T) {
  const [loading, setLoading] = useState(false);
  const loaded = useRef(onLoaded);
  loaded.current = onLoaded;
  useEffect(() => {
    if (hasData) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then(async (response) => { const json = await response.json(); loaded.current(response.ok ? json : failure(json)); })
      .catch((error) => { if (error.name !== "AbortError") loaded.current(failure(null)); })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // `failure` is a module-level function.
  }, [url, hasData]);
  return loading || !hasData;
}
const comparablesUrl = (parcelKey: string) => `/api/land-intelligence/comparables?key=${encodeURIComponent(parcelKey)}`;
const comparablesError = (body: { error?: string } | null): ComparablesResponse => ({ status: "error", reason: body?.error || "Comparable sales could not be loaded. Try again shortly." });
const marketUrl = (point: [number, number]) => `/api/land-intelligence/market?lng=${point[0].toFixed(6)}&lat=${point[1].toFixed(6)}`;
const marketError = (body: { error?: string } | null): MarketResponse => ({ error: body?.error || "Market data could not be loaded. Try again shortly." });

const CONFIDENCE_TONE = { high: "text-emerald-200", medium: "text-sky-200", low: "text-amber-200", insufficient: "text-slate-300" } as const;

/** Comparable qualified sales and a calculated value range, fetched only when this section is opened. */
function ComparablesSection({ parcelKey, data, onLoaded, detail }: { parcelKey: string; data: ComparablesResponse | null; onLoaded: (data: ComparablesResponse) => void; detail: ParcelDetail | null }) {
  const [showMethod, setShowMethod] = useState(false);
  const loading = useLazyLoad(comparablesUrl(parcelKey), !!data, onLoaded, comparablesError);
  if (loading || !data) return <p role="status" className="text-[11px] text-cyan-200">Finding comparable qualified sales…</p>;
  if (data.status !== "ready") return <p className={`text-[11px] leading-relaxed ${data.status === "error" ? "text-amber-200" : "text-slate-300"}`}>{data.reason}</p>;
  const { result, source } = data;
  const land = result.subject.basis === "land";
  const unit = land ? "land sq ft" : "finished sq ft";
  const perUnit = (value: number) => `$${Math.round(value).toLocaleString()}/${land ? "sq ft land" : "sq ft"}`;
  const county = detail?.boulder?.status === "ready" ? detail.boulder.property?.accounts[0]?.values?.actualTotal ?? null : null;
  return <div className="space-y-2.5 text-[11px] text-slate-200">
    <p className="text-[10px] leading-relaxed text-slate-400">Subject: {result.subject.type.toLowerCase()} · {result.subject.units.toLocaleString()} {unit}{result.subject.yearBuilt ? ` · built ${result.subject.yearBuilt}` : ""}. Qualified, priced, single-parcel county sales {source.windowStart} to {source.asOf}; matched by {result.locationMethod === "distance" ? "distance" : "appraisal neighborhood"}, sale date and size{result.tier ? ` (within ${result.locationMethod === "distance" ? `${result.tier.radiusMiles} mi, ` : ""}${result.tier.months} months, ±${Math.round(result.tier.sizeBand * 100)}% size)` : ""}.</p>
    {result.estimate && result.stats ? <section className="rounded-xl border border-violet-300/30 bg-violet-300/[0.06] p-3">
      <div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] uppercase tracking-wider text-violet-200">Comparable-sales value range<Calculated /></span><span className={`text-[10px] font-semibold ${CONFIDENCE_TONE[result.confidence]}`}>{result.confidence} confidence</span></div>
      <p className="mt-1 text-[15px] font-semibold text-white">{money(result.estimate.low)} – {money(result.estimate.high)}</p>
      <p className="text-[10px] text-slate-300">Midpoint {money(result.estimate.value)} = {result.subject.units.toLocaleString()} {unit} × median {perUnit(result.stats.median)} from {result.used} sale{result.used === 1 ? "" : "s"} (middle half of comparables {perUnit(result.stats.p25)} to {perUnit(result.stats.p75)}).</p>
      <p className="text-[10px] text-slate-300">{result.estimate.rangeBasis === "calibrated" && result.estimate.coverage != null ? `Range width comes from a backtest of past county sales at this confidence level: about ${Math.round(result.estimate.coverage * 10)} in 10 actual prices fell inside a range like this.` : "Range is the middle half of comparable prices; it has not been checked against outcomes."}</p>
      {county != null && <p className="mt-1 text-[10px] text-slate-400">County actual value {money(county)} ({Math.round((county / result.estimate.value) * 100)}% of the midpoint; the county values as of its own appraisal date).</p>}
      <p className="mt-1 text-[10px] text-slate-400">Not an appraisal. Sale prices are not adjusted for date, condition, features or location, and building facts are the county&apos;s current record, not as of each sale.</p>
    </section> : <p className="rounded-lg border border-white/10 px-3 py-2 text-slate-300">No value range: fewer than 3 usable comparable sales were found.</p>}
    {result.reasons.length > 0 && <ul className="space-y-0.5 text-[10px] text-amber-200">{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    {result.comps.length > 0 && <ol className="space-y-1.5">{result.comps.map((comp) => <li key={`${comp.account}-${comp.date}`} className={`border-l-2 pl-2 ${comp.outlier ? "border-amber-300/50 opacity-70" : "border-cyan-400/50"}`}>
      <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-medium text-white">{money(comp.price)}</span><span>{comp.date}</span><span className="text-cyan-100">{perUnit(comp.perUnit)}</span>{comp.outlier && <span className="text-[9px] text-amber-200">outlier · not used</span>}</div>
      <div className="text-[10px] text-slate-400">{[comp.siteAddress && `${comp.siteAddress}${comp.city ? `, ${comp.city}` : ""}`, `${comp.units.toLocaleString()} ${unit}`, comp.yearBuilt && `built ${comp.yearBuilt}`, comp.distanceMiles != null && `${comp.distanceMiles.toFixed(2)} mi`, comp.neighborhood && comp.neighborhood === result.subject.neighborhood && "same neighborhood", comp.changedAfterSale && "changed after sale", comp.reception && `reception ${comp.reception}`].filter(Boolean).join(" · ")}</div>
    </li>)}</ol>}
    <button type="button" aria-expanded={showMethod} onClick={() => setShowMethod((value) => !value)} className="text-[10px] font-medium text-cyan-200 underline">{showMethod ? "Hide method" : "How these were chosen"}</button>
    {showMethod && <div className="space-y-1 text-[10px] leading-relaxed text-slate-400">
      <p>Same county building class (or land class for vacant land). Excluded: unqualified or pending deeds, unpriced deeds, accounts linked to several parcels, buildings built after their sale, and the subject itself. A property that sold twice counts once (latest sale).</p>
      <p>Search steps, first with at least 5 matches: {COMP_TIERS.map((tier) => `${tier.radiusMiles} mi · ${tier.months} months · ±${Math.round(tier.sizeBand * 100)}% size`).join("; then ")}. Ranked by size difference, recency, distance, age difference and later changes; up to 10 shown.</p>
      <p>Figures use the median and interquartile range of price per {land ? "land square foot" : "above-grade finished square foot (basements excluded, county definition)"}; values beyond 1.5× the interquartile range are excluded. Confidence: high = 8+ sales in the nearest step with a tight spread; medium = 5+ sales; low otherwise. The range around the midpoint is the 10th–90th percentile of errors when past Boulder County sales were valued this way from earlier sales (fit on half, checked on the other half).</p>
      <p>Source: Boulder County Assessor sales and buildings{source.centroids ? `; parcel locations derived from ${source.centroids.attribution}` : "; no parcel locations (neighborhood match)"}.</p>
    </div>}
  </div>;
}

type MetricFormat = "money" | "percent" | "ratio" | "year" | "count";
const MARKET_ROWS: [keyof AcsProfile, string, MetricFormat][] = [
  ["medianValue", "Median home value", "money"], ["medianRent", "Median gross rent", "money"], ["medianIncome", "Median household income", "money"],
  ["rentBurden", "Rent as % of income (median)", "ratio"], ["vacancyRate", "Vacancy rate", "percent"], ["renterShare", "Renter-occupied", "percent"],
  ["povertyRate", "Below poverty level", "percent"], ["medianYearBuilt", "Median year built", "year"], ["housingUnits", "Housing units", "count"],
];
const formatMetric = (value: number | null, format: MetricFormat) => value == null ? "—" : format === "money" ? `$${Math.round(value).toLocaleString()}` : format === "percent" ? `${(value * 100).toFixed(1)}%` : format === "ratio" ? `${value.toFixed(1)}%` : format === "year" ? String(value) : Math.round(value).toLocaleString();
function MetricCell({ item, format }: { item: Estimate | undefined; format: MetricFormat }) {
  if (!item || item.value == null) return <td className="px-1 py-1 text-right text-slate-500">—</td>;
  const prefix = item.bound === "at_least" ? "≥" : item.bound === "at_most" ? "≤" : "";
  const title = item.moe != null ? `± ${formatMetric(item.moe, format === "year" ? "count" : format)} (90% margin of error); reliability: ${item.reliability}` : `reliability: ${item.reliability}`;
  return <td title={title} className={`px-1 py-1 text-right tabular-nums ${item.reliability === "low" ? "text-amber-200" : item.reliability === "caution" ? "text-slate-200" : "text-white"}`}>{prefix}{formatMetric(item.value, format)}{item.reliability === "low" ? "*" : ""}</td>;
}
const change = (value: number | null | undefined) => value == null ? "—" : pct(value);

/** Federal housing-market context for the parcel's tract, county, metro and state, fetched when this section opens. */
function MarketSection({ point, data, onLoaded }: { point: [number, number]; data: MarketResponse | null; onLoaded: (data: MarketResponse) => void }) {
  const loading = useLazyLoad(marketUrl(point), !!data, onLoaded, marketError);
  if (loading || !data) return <p role="status" className="text-[11px] text-cyan-200">Loading federal housing market data…</p>;
  if ("error" in data) return <p className="text-[11px] text-amber-200">{data.error}</p>;
  const { geography: geo, acs, hpi, permits, rates, fmr } = data;
  const columns: [string, AcsProfile | null][] = [["Tract", acs.tract], ["County", acs.county], ["State", acs.state], ["U.S.", acs.us]];
  const hpiRows: [string, typeof hpi.tract][] = [["Tract (annual, developmental)", hpi.tract], [`Metro: ${hpi.metro?.name ?? "not in a metro"} (quarterly)`, hpi.metro], [`State: ${geo.state.name} (quarterly)`, hpi.state]];
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  return <div className="space-y-2.5 text-[11px] text-slate-200">
    <p className="text-[10px] text-slate-400">{[geo.tract?.name, geo.county?.name, geo.metro?.name, geo.state.name].filter(Boolean).join(" · ")}. Area statistics describe residents and homes across each area, not this parcel.</p>
    <section className={panel}><SectionTitle icon={House}>Housing and income · {acs.vintage}</SectionTitle>
      <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[320px] text-[10px]"><thead><tr className="text-slate-400"><th className="py-1 text-left font-normal">Official estimate</th>{columns.map(([label]) => <th key={label} className="px-1 py-1 text-right font-normal">{label}</th>)}</tr></thead>
        <tbody>{MARKET_ROWS.map(([key, label, format]) => <tr key={key} className="border-t border-white/5"><td className="py-1 pr-1 text-slate-300">{label}</td>{columns.map(([column, profile]) => <MetricCell key={column} item={profile?.[key] as Estimate | undefined} format={format} />)}</tr>)}
          <tr className="border-t border-white/5"><td className="py-1 pr-1 text-slate-300">Value ÷ income<Calculated /></td>{columns.map(([column, profile]) => <td key={column} className="px-1 py-1 text-right tabular-nums">{profile?.priceToIncome != null ? `${profile.priceToIncome.toFixed(1)}×` : "—"}</td>)}</tr></tbody></table></div>
      <p className="mt-1 text-[10px] text-slate-400">Hover a value for its 90% margin of error. * = low reliability (coefficient of variation above 30%). Vacancy, renter and poverty shares are calculated from published counts with the Census proportion formula; ≥ marks a top-coded median.</p>
    </section>
    <section className={panel}><SectionTitle icon={BadgeDollarSign}>House price index (FHFA)</SectionTitle>
      <FactRows rows={hpiRows.map(([label, item]): [string, string] => [label, item ? `${item.latest} · 1 yr ${change(item.oneYear)} · 5 yr ${change(item.fiveYear)}${item.standardError != null ? ` · index ±${item.standardError}` : ""}` : "Not published for this area"])} />
      <p className="mt-1 text-[10px] text-slate-400">Repeat-sales index of single-family homes, not seasonally adjusted. Changes are calculated from the published index. FHFA suppresses small-tract values; tract indexes are developmental.</p>
    </section>
    <section className={panel}><SectionTitle icon={Hammer}>New construction permits · {geo.county?.name ?? "county"}</SectionTitle>
      {permits ? <><FactRows rows={[[`Housing units permitted, ${permits.latestYear}`, permits.latestUnits.toLocaleString()], ["Previous year", fact(permits.previousUnits?.toLocaleString())], ["Five-year average (calculated)", permits.fiveYearAverage == null ? "—" : Math.round(permits.fiveYearAverage).toLocaleString()], ["Per 1,000 existing homes (calculated)", permits.perThousandHomes == null ? "—" : permits.perThousandHomes.toFixed(1)], ["Share in 2+ unit buildings", permits.multifamilyShare == null ? "—" : pct(permits.multifamilyShare).replace("+", "")]]} />
        <p className="mt-1 text-[10px] text-slate-400">{permits.series.map((item) => `${item.year}: ${item.units.toLocaleString()}`).join(" · ")}. Permits authorize construction; not every permitted unit is built.</p></> : <p className="mt-1 text-slate-400">No county permit record in the Building Permits Survey.</p>}
    </section>
    <section className={panel}><SectionTitle icon={Landmark}>Mortgage rates and rents</SectionTitle>
      <FactRows rows={[
        ["30-year fixed (national)", rates.thirtyYear?.rate != null ? `${rates.thirtyYear.rate.toFixed(2)}% · ${rates.thirtyYear.date}${rates.thirtyYear.yearAgo ? ` · a year earlier ${rates.thirtyYear.yearAgo.rate.toFixed(2)}%` : ""}` : "Unavailable"],
        ["15-year fixed (national)", rates.fifteenYear?.rate != null ? `${rates.fifteenYear.rate.toFixed(2)}% · ${rates.fifteenYear.date}` : "Unavailable"],
        ...(fmr.status === "ready" ? fmr.data.rents.map((item): [string, string] => [`HUD Fair Market Rent, ${item.bedrooms === 0 ? "studio" : `${item.bedrooms} bedroom`}`, `$${item.rent.toLocaleString()}/mo · FY${fmr.data.year}${fmr.data.zip ? ` · ZIP ${fmr.data.zip}` : ""}`]) : [["HUD Fair Market Rents", fmr.reason] as [string, string]]),
      ]} />
      <p className="mt-1 text-[10px] text-slate-400">Fair Market Rents are HUD&apos;s 40th-percentile gross rent benchmark for the area, not this property&apos;s rent.</p>
    </section>
    <details className="text-[10px] text-slate-400"><summary className="cursor-pointer text-cyan-200">Sources and vintages</summary><ul className="mt-1 space-y-1">{data.sources.map((source) => <li key={source.label}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">{source.label}</a> · {source.vintage}</li>)}</ul><p className="mt-1">Imported {new Date(data.builtAt).toLocaleDateString()}.</p></details>
  </div>;
}

/** One number input with the source of its prefilled value (or an "assumption" chip). */
function NumberField({ label, value, onChange, unit, origin, step = 1 }: { label: string; value: number; onChange: (value: number) => void; unit?: string; origin?: Default; step?: number }) {
  return <label className="block text-[10px] text-slate-300"><span className="flex items-center justify-between gap-2"><span>{label}{unit ? ` (${unit})` : ""}</span>{origin && <span className={`truncate rounded border px-1 text-[8px] ${origin.assumption ? "border-amber-300/40 text-amber-200" : "border-emerald-300/30 text-emerald-200"}`} title={origin.source}>{origin.assumption ? "assumption" : "from records"}</span>}</span>
    <input type="number" inputMode="decimal" step={step} min={0} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} className="mt-0.5 w-full rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-[11px] text-white tabular-nums" />
    {origin && <span className="mt-0.5 block truncate text-[9px] text-slate-500" title={origin.source}>{origin.source}</span>}</label>;
}
const ratio = (value: number | null, digits = 1) => value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
const HARD_COST_ORIGIN: Default = { value: 250, source: "Assumption: replace with a contractor estimate", assumption: true };

/** Ownership-cost, rental and residual-land-value scenarios; inputs prefilled from public records, outputs calculated live. */
function InvestmentSection({ point, detail, comps, market, onMarketLoaded, onScenario }: { point: [number, number]; detail: ParcelDetail | null; comps: CompResult | null; market: MarketResponse | null; onMarketLoaded: (data: MarketResponse) => void; onScenario?: (scenario: Scenario) => void }) {
  // Rates and rents come from the market data; load it here if the market section has not.
  const marketLoading = useLazyLoad(marketUrl(point), !!market, onMarketLoaded, marketError);
  const context = market && !("error" in market) ? market : null;
  const defaults = scenarioDefaults(detail, comps, context);
  const initial = () => ({ price: defaults.price.value, downPct: 20, ratePct: defaults.ratePct.value, years: 30, taxAnnual: defaults.taxAnnual.value, insuranceAnnual: defaults.insuranceAnnual.value, hoaMonthly: 0, closingCostPct: 3, monthlyRent: defaults.monthlyRent.value, vacancyPct: 5, maintenancePct: 8, managementPct: 8, reservesPct: 5, units: defaults.units.value, salePricePerUnit: defaults.price.value, buildingSqft: defaults.buildingSqft.value, hardCostPerSqft: HARD_COST_ORIGIN.value, softCostPct: 20, financingPct: 6, saleCostPct: 6, profitPct: 15 });
  const [tab, setTab] = useState<"own" | "rent" | "develop">("own");
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);
  // Until the user edits anything, follow the defaults as market data and comparables arrive.
  const defaultsKey = JSON.stringify(defaults);
  useEffect(() => { if (!touched) setValues(initial()); }, [defaultsKey]);
  const report = useRef(onScenario);
  report.current = onScenario;
  useEffect(() => { report.current?.({ input: values, defaults, edited: touched }); }, [values, touched, defaultsKey]);
  const set = (key: keyof ReturnType<typeof initial>) => (value: number) => { setTouched(true); setValues((current) => ({ ...current, [key]: value })); };
  const own = ownershipCost(values), rent = rentalAnalysis(values), develop = residualLandValue(values);
  const tabs = [["own", "Ownership cost"], ["rent", "Rental"], ["develop", "Development"]] as const;
  const result = (rows: [string, string][]) => <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg border border-violet-300/25 bg-violet-300/[0.05] p-2 text-[10px]">{rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-slate-300">{label}</dt><dd className="text-right font-semibold tabular-nums text-white">{value}</dd></div>)}</dl>;
  const vacancy = context?.acs.tract?.vacancyRate.value;
  const dollars = (value: number) => money(Math.round(value));
  return <div className="space-y-2 text-[11px] text-slate-200">
    <div role="tablist" aria-label="Investment scenario" className="flex gap-1">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-2 py-1.5 text-[10px] font-medium ${tab === id ? "bg-cyan-300/20 text-cyan-100" : "border border-white/10 text-slate-300 hover:bg-white/10"}`}>{label}</button>)}</div>
    {marketLoading && <p role="status" className="text-[10px] text-cyan-200">Loading current mortgage rates and area rents…</p>}
    {tab === "own" && <><div className="grid grid-cols-2 gap-2">
      <NumberField label="Price" unit="$" value={values.price} onChange={set("price")} origin={defaults.price} step={1000} />
      <NumberField label="Down payment" unit="%" value={values.downPct} onChange={set("downPct")} />
      <NumberField label="Interest rate" unit="%" value={values.ratePct} onChange={set("ratePct")} origin={defaults.ratePct} step={0.05} />
      <NumberField label="Term" unit="years" value={values.years} onChange={set("years")} />
      <NumberField label="Property tax" unit="$/yr" value={values.taxAnnual} onChange={set("taxAnnual")} origin={defaults.taxAnnual} step={100} />
      <NumberField label="Insurance" unit="$/yr" value={values.insuranceAnnual} onChange={set("insuranceAnnual")} origin={defaults.insuranceAnnual} step={100} />
      <NumberField label="HOA" unit="$/mo" value={values.hoaMonthly} onChange={set("hoaMonthly")} step={10} />
    </div>{result([["Loan", dollars(own.loan)], ["Principal & interest", `${dollars(own.principalInterest)}/mo`], ["Tax + insurance + HOA", `${dollars(own.tax + own.insurance + own.hoa)}/mo`], ["Monthly total", `${dollars(own.monthlyTotal)}/mo`], ["Interest over term", dollars(own.totalInterest)]])}</>}
    {tab === "rent" && <><div className="grid grid-cols-2 gap-2">
      <NumberField label="Price" unit="$" value={values.price} onChange={set("price")} origin={defaults.price} step={1000} />
      <NumberField label="Monthly rent" unit="$" value={values.monthlyRent} onChange={set("monthlyRent")} origin={defaults.monthlyRent} step={25} />
      <NumberField label="Vacancy" unit="%" value={values.vacancyPct} onChange={set("vacancyPct")} />
      <NumberField label="Down payment" unit="%" value={values.downPct} onChange={set("downPct")} />
      <NumberField label="Interest rate" unit="%" value={values.ratePct} onChange={set("ratePct")} origin={defaults.ratePct} step={0.05} />
      <NumberField label="Closing costs" unit="% of price" value={values.closingCostPct} onChange={set("closingCostPct")} />
      <NumberField label="Property tax" unit="$/yr" value={values.taxAnnual} onChange={set("taxAnnual")} origin={defaults.taxAnnual} step={100} />
      <NumberField label="Insurance" unit="$/yr" value={values.insuranceAnnual} onChange={set("insuranceAnnual")} origin={defaults.insuranceAnnual} step={100} />
      <NumberField label="Maintenance" unit="% of rent" value={values.maintenancePct} onChange={set("maintenancePct")} />
      <NumberField label="Management" unit="% of rent" value={values.managementPct} onChange={set("managementPct")} />
      <NumberField label="Capital reserves" unit="% of rent" value={values.reservesPct} onChange={set("reservesPct")} />
      <NumberField label="HOA" unit="$/mo" value={values.hoaMonthly} onChange={set("hoaMonthly")} step={10} />
    </div>{vacancy != null && <p className="text-[10px] text-slate-400">For reference: the tract&apos;s ACS vacancy rate is {ratio(vacancy)} (includes seasonal and for-sale homes).</p>}
    {result([["Net operating income", `${dollars(rent.noi)}/yr`], ["Cap rate", ratio(rent.capRate, 2)], ["Debt service", `${dollars(rent.debtService)}/yr`], ["Cash flow", `${dollars(rent.cashFlow)}/yr`], ["Cash invested", dollars(rent.cashInvested)], ["Cash-on-cash return", ratio(rent.cashOnCash)], ["Debt coverage (DSCR)", rent.dscr == null ? "—" : `${rent.dscr.toFixed(2)}×`], ["Break-even occupancy", ratio(rent.breakEvenOccupancy)], ["Gross rent multiplier", rent.grossRentMultiplier == null ? "—" : `${rent.grossRentMultiplier.toFixed(1)}×`]])}</>}
    {tab === "develop" && <><div className="grid grid-cols-2 gap-2">
      <NumberField label="Units" value={values.units} onChange={set("units")} origin={defaults.units} />
      <NumberField label="Sale price per unit" unit="$" value={values.salePricePerUnit} onChange={set("salePricePerUnit")} origin={defaults.price} step={1000} />
      <NumberField label="Building area" unit="sq ft" value={values.buildingSqft} onChange={set("buildingSqft")} origin={defaults.buildingSqft} step={50} />
      <NumberField label="Hard cost" unit="$/sq ft" value={values.hardCostPerSqft} onChange={set("hardCostPerSqft")} origin={HARD_COST_ORIGIN} step={5} />
      <NumberField label="Soft costs" unit="% of hard" value={values.softCostPct} onChange={set("softCostPct")} />
      <NumberField label="Financing" unit="% of costs" value={values.financingPct} onChange={set("financingPct")} />
      <NumberField label="Sale costs" unit="% of value" value={values.saleCostPct} onChange={set("saleCostPct")} />
      <NumberField label="Target profit" unit="% of value" value={values.profitPct} onChange={set("profitPct")} />
    </div>{result([["Completed value", dollars(develop.grossValue)], ["Hard + soft costs", dollars(develop.hardCosts + develop.softCosts)], ["Financing + sale costs", dollars(develop.financing + develop.saleCosts)], ["Target profit", dollars(develop.profit)], ["Residual land value", dollars(develop.residualLandValue)], ["Per unit", develop.perUnit == null ? "—" : dollars(develop.perUnit)]])}
    {develop.residualLandValue < 0 && <p className="text-[10px] text-amber-200">Negative: at these inputs the project supports no land price.</p>}
    <p className="text-[10px] text-slate-400">Residual land value = completed value − sale costs − hard and soft costs − financing − target profit. It does not check zoning, density, utilities or the site constraints in the engineering sections.</p></>}
    <div className="flex items-center justify-between gap-2"><p className="text-[10px] text-slate-400">Scenario arithmetic on the inputs above (calculated). Not financial advice, a loan quote or an appraisal.</p>{touched && <button type="button" onClick={() => { setTouched(false); setValues(initial()); }} className="shrink-0 rounded-md border border-white/20 px-2 py-1 text-[10px] text-cyan-200 hover:bg-white/10">Reset to records</button>}</div>
  </div>;
}

/** One line saying where the live county record came from, or that it could not be reached. */
function CountyLiveNote({ live }: { live: CountyLive }) {
  const tone = live.status === "unavailable" ? "border-amber-300/25 bg-amber-300/[0.06] text-amber-100" : "border-cyan-300/20 bg-cyan-300/[0.05] text-slate-200";
  return <p className={`rounded-xl border p-2.5 text-[10px] leading-relaxed ${tone}`}>
    {live.status === "unavailable" ? `${live.source} did not respond; the statewide record is shown instead.` : live.status === "no_record" ? `${live.source}: no record for this parcel (checked live).` : live.kind === "sales" ? `${live.sales} recorded transfers since 2010 from ${live.source}, queried live. Denver does not publish whether a sale was arm's-length, so none is treated as a qualified market sale.` : `${live.source}, queried live.`}
    {" "}<a href={live.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Source ↗</a>
  </p>;
}

/** Adams County assessor accounts for the parcel, as published this week. */
function CountyValuesPanel({ live }: { live: CountyLive }) {
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  if (live.status !== "ready" || !live.accounts?.length) return <CountyLiveNote live={live} />;
  return <section className={panel}>
    <SectionTitle icon={Landmark}>{live.county} County assessor {live.accounts.length === 1 ? "account" : `accounts (${live.accounts.length})`}</SectionTitle>
    {live.accounts.map((account) => <div key={account.account} className="mt-2"><FactRows rows={[
      ["Account", [account.account, account.type].filter(Boolean).join(" · ")],
      ["Actual value", money(account.actualTotal)], ["Actual land / improvements", `${money(account.actualLand)} / ${money(account.actualImprovements)}`],
      ["Assessed value", money(account.assessedTotal)], ["Total mill levy", fact(account.millLevy)],
      ["School district", fact(account.school)], ["Fire district", fact(account.fire)],
      ["Lot size", account.lotSize == null ? "Not in this feed" : `${account.lotSize.toLocaleString()} ${account.lotUnit.toLowerCase()}`.trim()],
      ...(account.alternateAssessed != null ? [["Alternate assessed value", `${money(account.alternateAssessed)} · ${account.alternateMillLevy ?? "—"} mills (published, not defined by the county; not used)`] as [string, string]] : []),
      ["Record changed", fact(account.changed)],
    ]} /></div>)}
    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Queried live from {live.source} (updated weekly; CC BY 4.0). The tax estimate in section {sectionNumber("sales")} uses the county&apos;s definition: assessed value × total mill levy. It is not a tax bill; the Adams County Treasurer has the bill.</p>
    <a href={live.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-cyan-300 underline">Adams County open data ↗</a>
  </section>;
}

type EntityResponse = { matches: EntityMatch[]; error?: string };
/** Colorado business filings with the same name as a business, trust or organization owner. Never merged into the owner record. */
function EntityFilings({ owners }: { owners: { name: string; entity: string }[] }) {
  const names = Array.from(new Set(owners.filter((owner) => owner.entity !== "individual" && owner.entity !== "government").map((owner) => owner.name))).slice(0, 3);
  const [results, setResults] = useState<Record<string, EntityResponse | "loading">>({});
  const key = names.join("|");
  useEffect(() => {
    let live = true;
    for (const name of names) {
      setResults((current) => ({ ...current, [name]: "loading" }));
      fetch(`/api/land-intelligence/entity?name=${encodeURIComponent(name)}`).then(async (response) => { const body = await response.json(); return response.ok ? body : { matches: [], error: body.error ?? "Lookup failed." }; })
        .catch(() => ({ matches: [], error: "The Colorado business registry could not be reached." }))
        .then((body: EntityResponse) => { if (live) setResults((current) => ({ ...current, [name]: body })); });
    }
    return () => { live = false; };
  }, [key]);
  if (!names.length) return null;
  return <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3" aria-label="Colorado business filings">
    <SectionTitle icon={Building2}>Colorado business filings</SectionTitle>
    {names.map((name) => { const result = results[name]; return <div key={name} className="mt-2 text-[11px]">
      <p className="text-slate-400">Owner: <span className="text-slate-100">{name}</span></p>
      {!result || result === "loading" ? <p role="status" className="text-cyan-200">Checking the Secretary of State registry…</p>
        : result.error ? <p className="text-amber-200">{result.error}</p>
        : result.matches.length ? result.matches.map((match) => <div key={match.id} className="mt-1 rounded-md border border-white/10 px-2 py-1.5">
          <p className="font-medium text-white">{match.name} <span className="ml-1 rounded border border-white/20 px-1 text-[9px] text-slate-300">possible match</span></p>
          <p className="text-slate-300">{[match.status, match.type && `type ${match.type}`, match.jurisdiction && `formed in ${match.jurisdiction}`, match.formed && `on ${match.formed}`, (match.principalCity || match.principalState) && `principal office ${[match.principalCity, match.principalState].filter(Boolean).join(", ")}`].filter(Boolean).join(" · ")}</p>
          <a href={match.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-300 underline">Secretary of State record ↗</a>
        </div>) : <p className="text-slate-400">No Colorado filing with this exact name.</p>}
    </div>; })}
    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Matched on the same business name only (punctuation and LLC/Inc. endings ignored), so a match is not proof the filing owns this parcel. Colorado Department of State data, public domain, queried live.</p>
  </section>;
}

type NearbyResponse = { features: { properties: RecentSale }[]; since: string; denver: string; limited: boolean } | { error: string };
/** Recent recorded home sales within half a mile, nearest first. A list only: these sales are not qualified, so no value is estimated. */
function RecentSalesNearby({ point, parcelId }: { point: [number, number]; parcelId: string }) {
  const [months, setMonths] = useState<RecentMonths>(12);
  const [data, setData] = useState<Partial<Record<RecentMonths, NearbyResponse>>>({});
  const current = data[months];
  useEffect(() => {
    if (current) return;
    const controller = new AbortController();
    fetch(`/api/land-intelligence/recent-sales?months=${months}&near=${point[0].toFixed(6)},${point[1].toFixed(6)}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); return response.ok ? body : { error: body.error ?? "Recent sales could not be loaded." }; })
      .catch(() => ({ error: "Recent sales could not be loaded. Try again shortly." }))
      .then((body: NearbyResponse) => { if (!controller.signal.aborted) setData((all) => ({ ...all, [months]: body })); });
    return () => controller.abort();
  }, [months, current, point]);
  const sales = current && !("error" in current) ? current.features.map((feature) => feature.properties).filter((sale) => sale.parcelId !== parcelId) : [];
  const denver = sales.some((sale) => sale.source === "denver");
  return <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3" aria-label="Recent sales nearby">
    <div className="flex items-center justify-between gap-2"><SectionTitle icon={Receipt}>Recent sales nearby</SectionTitle>
      <div role="group" aria-label="Recent sales period" className="flex gap-0.5 text-[10px]">{RECENT_MONTHS.map((option) => <button key={option} type="button" aria-pressed={months === option} onClick={() => setMonths(option)} className={`rounded px-1.5 py-0.5 font-semibold ${months === option ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:bg-white/10"}`}>{option} mo</button>)}</div></div>
    {!current ? <p role="status" className="mt-2 text-[11px] text-cyan-200">Finding recorded sales within half a mile…</p>
      : "error" in current ? <p role="alert" className="mt-2 text-[11px] text-amber-200">{current.error}</p>
      : !sales.length ? <p className="mt-2 text-[11px] text-slate-300">No recorded home sale within half a mile since {current.since}{denver ? "" : ". Outside Denver only each parcel's last sale is published, about a year behind, so a longer period may find more"}.</p>
      : <ol className="mt-2 space-y-1.5">{sales.slice(0, 15).map((sale) => <li key={`${sale.parcelId}-${sale.date}-${sale.reception}`} className="border-l-2 border-cyan-400/40 pl-2 text-[11px]">
        <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold text-white">{money(sale.price)}</span><span className="text-slate-300">{sale.date}</span><span className="text-slate-400">{sale.distanceMiles} mi</span></div>
        <div className="text-[10px] text-slate-400">{[sale.address, sale.propertyClass, sale.source === "denver" ? `${sale.deed}${sale.reception ? ` · reception ${sale.reception}` : ""}` : "statewide last sale"].filter(Boolean).join(" · ")}</div>
      </li>)}</ol>}
    {current && !("error" in current) && current.denver === "unavailable" && <p className="mt-2 text-[10px] text-amber-200">Denver&apos;s sales service did not respond; Denver sales are missing.</p>}
    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Recorded sales from public records, not MLS listings and not verified as arm&apos;s-length, so no value range is calculated. {denver ? "Denver: priced warranty and special-warranty deeds on homes and condos, with multi-parcel deals removed (City and County of Denver, CC BY 3.0, queried live)." : "Outside Denver: each parcel's last sale from the statewide layer, updated yearly."} Turn on &ldquo;Recent home sales&rdquo; to see them on the map.</p>
  </section>;
}

/** Published statewide facts beyond the shared schema; a row appears only where the source supplies it. */
function statewideFacts(detail: ParcelDetail | null): FactRow[] {
  if (!detail) return [];
  const rows: [string, string | number | null | undefined][] = [
    ["Effective year built", detail.effectiveYearBuilt], ["Residential units", detail.residentialUnits], ["Improvement quality", detail.qualityLabel], ["Construction class", detail.constructionLabel],
    ["Homestead just value", detail.homesteadValue != null ? money(detail.homesteadValue) : null], ["Special features value", detail.specialFeaturesValue != null ? money(detail.specialFeaturesValue) : null],
    ["Last physical inspection", detail.lastInspection], ["Public land owner", detail.publicLand], ["School district", detail.schoolDistrict],
    ["Source document", detail.sourceDocument ? [detail.sourceDocument.reference, detail.sourceDocument.date].filter(Boolean).join(" · ") : null],
  ];
  return rows.filter((row): row is [string, string | number] => row[1] != null && row[1] !== "").map(([label, value]) => [label, String(value)]);
}

/** One part of the property record (overview, ownership or sales). Blank feed fields show an AI-found value from `fill` only when a source confirms it. */
function PropertyFacts({ part, summary, detail, loading, error, fill }: { part: "overview" | "ownership" | "sales"; summary: ParcelRecord; detail: ParcelDetail | null; loading: boolean; error: string; fill?: PropertyFill | null }) {
  const parcel = detail?.parcel ?? summary;
  const filled = (key: FillKey, label: string, feed: string): FactRow => { const item = feed === "Not in this feed" ? fill?.fields[key] : undefined; return item ? [label, formatFilled(key, item.value), item] : [label, feed]; };
  // Rows no statewide feed carries appear only once the AI fill confirms them.
  const aiOnly = (key: FillKey): FactRow[] => fill?.fields[key] ? [filled(key, FILL_FIELDS[key].label, "Not in this feed")] : [];
  const landUseRow: FactRow = isUseCode(parcel.landUse) && fill?.fields.landUse ? ["Land use", `${formatFilled("landUse", fill.fields.landUse.value)} (${parcel.landUse})`, fill.fields.landUse] : filled("landUse", "Land use", fact(parcel.landUse));
  const saleRows = [...aiOnly("lastSaleDate"), ...aiOnly("lastSalePrice")];
  const panel = "rounded-xl border border-white/10 bg-white/[0.04] p-3";
  const countyReady = detail?.boulder?.status === "ready";
  if (part === "overview") return <>
    <section className={panel}>
      <h4 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200"><MapPinned aria-hidden="true" className="h-3.5 w-3.5" />{parcel.state} · {parcel.county || "County not supplied"}</h4>
      {/* Section 8 covers zoning when the parcel feed has none. */}
      <FactRows rows={[["Parcel ID", fact(parcel.id)], ["Site address", fact(parcel.address)], landUseRow, ...(parcel.zoning ? [["Parcel zoning", parcel.zoning] as [string, string]] : []), ["Mapped area", parcel.acres == null ? "Not in this feed" : `${parcel.acres.toLocaleString()} acres`], filled("ownerType", "Owner type", fact(parcel.ownerType)), ["Data received", fact(parcel.received)], ["Property ID", fact(parcel.propertyId)]]} />
    </section>
    {loading && <p role="status" className="text-[11px] text-cyan-200">Loading public ownership, sales and values…</p>}
    {error && <p role="alert" className="text-[11px] text-amber-200">{error}</p>}
  </>;
  if (loading) return <p role="status" className="text-[11px] text-cyan-200">Loading public ownership, sales and values…</p>;
  if (!detail) return <p role="alert" className="text-[11px] text-amber-200">{error || "The property record is not available for this parcel."}</p>;
  if (part === "ownership") return <>
    {countyReady && detail.boulder?.status === "ready" && detail.boulder.property && <BoulderProfile property={detail.boulder.property} />}
    {detail.boulder?.status === "rights_pending" && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-[11px] leading-relaxed text-amber-100">Detailed Boulder County assessor records are withheld here until the county confirms they may be republished. Statewide fields appear below; the county assessor site has the full record.</p>}
    {detail.boulder?.status === "not_loaded" && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-[11px] leading-relaxed text-amber-100">The Boulder County data snapshot has not been loaded on this server. Statewide fields appear below; the assessor and recorder links have the fuller county record.</p>}
    {!countyReady && <>
      <section className={panel}><SectionTitle icon={UserRound}>Ownership</SectionTitle><FactRows rows={[["Reported owner", detail.owners.length ? detail.owners.join(" · ") : "Not in this feed"]]} /><p className="mt-2 text-[10px] text-slate-400">Owner is a public parcel record entry. Verify current title with the county recorder.</p></section>
      <section className={panel}><SectionTitle icon={BadgeDollarSign}>Public values and taxes{detail.valueYear ? ` · ${detail.valueYear}` : ""}</SectionTitle>
        <FactRows rows={[filled("assessedTotal", detail.valueLabels.total || "Assessed total", money(detail.assessedTotal ?? null)), filled("assessedLand", detail.valueLabels.land || "Land value", money(detail.assessedLand ?? parcel.landValue)), filled("assessedImprovements", detail.valueLabels.improvements || "Improvements", money(detail.assessedImprovements ?? null)), filled("taxableValue", detail.valueLabels.taxable || "Taxable value", money(detail.taxableValue ?? null)), filled("estimatedMarketValue", detail.valueLabels.market || "Est. fair market", money(detail.estimatedMarketValue ?? null)), filled("annualPropertyTax", "Annual property tax", money(detail.annualPropertyTax ?? null))]} />
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Assessed, taxable and estimated values are source labels. They are not the sale price or a current listing price.{detail.valueNote ? ` ${detail.valueNote}` : ""}</p>
      </section>
      {detail.countyLive?.kind === "values" && <CountyValuesPanel live={detail.countyLive} />}
      <section className={panel}><SectionTitle icon={House}>Building and legal facts</SectionTitle><FactRows rows={[filled("yearBuilt", "Year built", fact(detail.yearBuilt)), filled("livingAreaSqft", "Living area", detail.livingAreaSqft ? `${detail.livingAreaSqft.toLocaleString()} sq ft` : "Not in this feed"), filled("buildingCount", "Buildings", fact(detail.buildingCount)), filled("deedAcres", "Deeded area", detail.deedAcres ? `${detail.deedAcres.toLocaleString()} acres` : "Not in this feed"), filled("legalDescription", "Legal description", fact(detail.legalDescription)), ...aiOnly("bedrooms"), ...aiOnly("bathrooms"), ...statewideFacts(detail)]} /><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Bedrooms, bathrooms, listing status, liens and a complete sale chain are not supplied here. County assessor and recorder records may have more detail.</p></section>
    </>}
    {parcel.state === "Colorado" && <EntityFilings owners={propertyHistory(detail).owners} />}
  </>;
  const history = propertyHistory(detail);
  const hasHistory = history.sales.length > 0 || !!history.permits || !!history.buildings || history.owners.length > 0;
  return <>
    {detail.countyLive?.kind === "sales" && <CountyLiveNote live={detail.countyLive} />}
    {!countyReady && !(detail.countyLive?.kind === "sales" && detail.countyLive.status === "ready") && <section className={panel}><SectionTitle icon={Receipt}>Reported sale history</SectionTitle>
      {detail.sales.length ? <div className="mt-2 space-y-2">{detail.sales.map((item, index) => <div key={`${item.date}-${index}`} className="border-l-2 border-cyan-400/50 pl-2 text-[11px]"><div className="font-medium text-white">{item.price == null ? "Price not provided" : money(item.price)}</div><div className="text-slate-300">{item.date || "Date not provided"}{item.vacantAtSale === true ? " · price covered vacant land" : item.vacantAtSale === false ? " · price covered improved property" : ""}{item.multiParcel ? " · multi-parcel sale" : ""}</div>{item.statusLabel && <div className="text-slate-400">{item.statusLabel}</div>}{item.reference && <div className="text-slate-400">Recorder reference: {item.reference}</div>}</div>)}</div> : saleRows.length ? <FactRows rows={saleRows} /> : <p className="mt-2 text-[11px] text-slate-400">No sale transactions supplied by this statewide feed.</p>}
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">These are the source&apos;s reported sale entries, not a complete deed history. A recorded price may reflect a non-market transfer. Check the county recorder for earlier deeds and actual consideration.</p>
    </section>}
    {hasHistory ? <PropertyHistorySection detail={detail} /> : countyReady && <p className="text-[11px] text-slate-400">No deed, permit or building rows in the county snapshot for this parcel.</p>}
  </>;
}
