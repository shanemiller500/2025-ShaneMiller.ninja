"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Cable, ChevronDown, Download, Factory, FileCheck2, House, Leaf, Map, MapPinned, Mountain, RotateCcw, Route, Ruler, Scale, ShieldAlert, Waves, type LucideIcon } from "lucide-react";
import { crossSourceObservations, lineInsideParcelMeters, parcelDisciplineSummary, parcelMetrics } from "./parcel-analysis";
import { PARCEL_INSPECTION_GROUPS, type InspectionGroup, type ParcelFinding, type ParcelGeometry, type ParcelInspectionReport } from "./parcel-inspection";
import { downloadParcelReport } from "./export-parcel-report";
import { RoadSegmentDetails } from "./RoadSegmentDetails";
import type { ParcelDetail } from "./parcel-detail";

type Heading = { name: string; id: string; locality: string; sourceUrl: string };
type Props = {
  report: ParcelInspectionReport | null;
  geometry: ParcelGeometry | null;
  propertyDetail: ParcelDetail | null;
  heading: Heading;
  loading: boolean;
  error: string;
  visible: Record<string, boolean>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSetVisible: (ids: string[], visible: boolean) => void;
  onSelect: (finding: ParcelFinding) => void;
  openSection?: string | null;
  onOpenSection?: (id: string | null) => void;
  propertyArea?: (id: string) => ReactNode;
};

const colorFor = (id: string) => PARCEL_INSPECTION_GROUPS.find((item) => item.id === id)?.color ?? "#94a3b8";
const disciplineIcons: Record<string, LucideIcon> = { house: House, map: Map, cable: Cable, ruler: Ruler, scale: Scale, file: FileCheck2, leaf: Leaf, waves: Waves, route: Route, mountain: Mountain, shield: ShieldAlert, factory: Factory };
const statusLabel = (status: InspectionGroup["status"]) => ({
  found: "Mapped features found",
  no_features: "No mapped features returned",
  coverage_unknown: "Coverage unknown",
  outside_coverage: "Outside connected coverage",
  not_queried: "Not queried — owner records needed",
  partial: "Partial source result",
  unavailable: "Source unavailable",
  source_error: "Source error",
})[status];

export function ParcelFindings({ report, geometry, propertyDetail, heading, loading, error, visible, selectedId, onToggle, onSetVisible, onSelect, openSection, onOpenSection, propertyArea }: Props) {
  const [localSection, setLocalSection] = useState<string | null>(null);
  const openDiscipline = onOpenSection ? openSection ?? null : localSection;
  const setOpenDiscipline = onOpenSection ?? setLocalSection;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showAllGroup, setShowAllGroup] = useState<string | null>(null);
  const disciplines = report ? parcelDisciplineSummary(report) : [];
  const observations = report ? crossSourceObservations(report) : [];
  const metrics = report && geometry ? parcelMetrics(geometry) : null;
  const mapped = report?.groups.reduce((sum, group) => sum + group.findings.length, 0) ?? 0;
  const mappedIds = report?.groups.filter((group) => group.findings.length).map((group) => group.id) ?? [];

  useEffect(() => { setOpenGroup(null); setShowAllGroup(null); if (!onOpenSection) setLocalSection(null); }, [report?.parcelKey, onOpenSection]);
  useEffect(() => {
    if (!selectedId || !report) return;
    const group = report.groups.find((item) => item.findings.some((finding) => finding.id === selectedId));
    const discipline = disciplines.find((item) => item.groups.some((itemGroup) => itemGroup.id === group?.id));
    if (group && discipline) {
      setOpenDiscipline(discipline.id);
      setOpenGroup(group.id);
      setShowAllGroup(group.id);
    }
  }, [selectedId, report]);
  useEffect(() => {
    if (!selectedId || !openGroup) return;
    const frame = requestAnimationFrame(() => document.getElementById(`parcel-finding-${selectedId}`)?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [selectedId, openGroup]);

  return <section className="li-inspection rounded-xl border border-cyan-300/20 p-3" aria-busy={loading}>
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-1.5 text-xs font-semibold text-white"><MapPinned className="h-4 w-4 text-cyan-300" />Parcel map findings</h3>{loading && <RotateCcw className="h-3.5 w-3.5 animate-spin text-cyan-200" />}</div>
    <p className="mt-2 text-[11px] leading-relaxed text-slate-300"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-800 bg-yellow-300 align-middle" /> Yellow outlines the selected GIS parcel. Colored dots, lines, and areas are public map records. Tap one to open its source below. Some records are nearby rather than inside the parcel.</p>
    {loading && <p role="status" className="mt-2 text-[11px] text-cyan-200">Checking parcel sources…</p>}
    {error && <p role="alert" className="mt-2 text-[11px] text-amber-200">{error}</p>}
    {report && <>
      <div className="li-inspection-overview mt-3 rounded-xl p-3">
        <p className="text-xs font-semibold text-white">{mapped} mapped record{mapped === 1 ? "" : "s"} across {report.groups.filter((group) => group.findings.length).length} sources</p>
        <p className="mt-1 text-[10px] text-slate-300">Checked {new Date(report.checkedAt).toLocaleString()}</p>
        {metrics && <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[11px]"><div><span className="block text-slate-400">Approx. GIS area</span><strong className="font-semibold text-white">{(metrics.areaMeters2 / 4046.8564224).toLocaleString(undefined, { maximumFractionDigits: 3 })} acres</strong></div><div><span className="block text-slate-400">Mapped boundary</span><strong className="font-semibold text-white">{metrics.perimeterMeters.toLocaleString(undefined, { maximumFractionDigits: 1 })} m</strong></div></div>}
        <p className="mt-1 text-[10px] text-slate-400">{report.geometry ? "Measurements use the full parcel boundary retrieved from the source." : "Map measurements are approximate."} GIS boundaries are not a survey.</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-auto text-[10px] font-semibold uppercase tracking-wide text-cyan-200">Map filters</span><button type="button" onClick={() => onSetVisible(mappedIds, true)} disabled={!mappedIds.length} className="li-inspection-action rounded-md px-2 py-1 text-[10px] font-medium">Show all</button><button type="button" onClick={() => onSetVisible(mappedIds, false)} disabled={!mappedIds.length} className="li-inspection-action rounded-md px-2 py-1 text-[10px] font-medium">Hide all</button></div>
      <p className="mt-1 text-[10px] text-slate-400">Filters change the map only. All source results remain in the report.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">{disciplines.map((discipline) => {
        const expanded = openDiscipline === discipline.id;
        const groupIds = discipline.groups.filter((group) => group.findings.length).map((group) => group.id);
        const visibleCount = groupIds.filter((id) => visible[id] !== false).length;
        const Icon = disciplineIcons[discipline.icon];
        return <section key={discipline.id} className={`li-inspection-discipline overflow-hidden rounded-xl border ${expanded ? "col-span-2" : ""}`}>
          <button type="button" aria-expanded={expanded} onClick={() => { setOpenDiscipline(expanded ? null : discipline.id); setOpenGroup(null); }} className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-white/[0.04]">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white">{discipline.label}</span><span className="mt-0.5 block text-[10px] text-slate-300">{discipline.groups.length ? `${discipline.findings} mapped · ${discipline.groups.length} source${discipline.groups.length === 1 ? "" : "s"}` : "Property record · source fields vary"}{discipline.unknown ? ` · ${discipline.unknown} unknown coverage` : ""}{discipline.unavailable ? ` · ${discipline.unavailable} limited` : ""}{discipline.unqueried ? ` · ${discipline.unqueried} not queried` : ""}</span></span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-cyan-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {expanded && <div className="border-t border-white/10 px-2 pb-2 pt-2">
            <p className="mb-2 px-1 text-[10px] leading-relaxed text-slate-300">{discipline.note}</p>
            {discipline.property && (propertyArea ? propertyArea(discipline.id) : <button type="button" onClick={() => document.querySelector(".li-property-details")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="li-inspection-action mb-2 rounded-md px-2 py-1 text-[10px] font-medium">Open property record above</button>)}
            {discipline.id === "water" && observations.length > 0 && <section className="mb-2 rounded-lg border border-cyan-300/20 p-2.5"><h4 className="text-[11px] font-semibold text-white">Combined source observations</h4>{observations.map((observation) => <div key={observation.id} className="mt-2 text-[10px] leading-relaxed text-slate-300"><p>{observation.text}</p><p className="mt-1 text-slate-400">Rule: {observation.rule}</p><div className="mt-1 flex flex-wrap gap-x-3">{observation.sources.map((source) => <a key={source.label} href={source.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">{source.label} ↗</a>)}</div></div>)}</section>}
            {groupIds.length > 0 && <div className="mb-2 flex items-center justify-between px-1 text-[10px] text-slate-300"><span>{visibleCount} of {groupIds.length} mapped sources visible</span><button type="button" onClick={() => onSetVisible(groupIds, visibleCount !== groupIds.length)} className="li-inspection-action rounded-md px-2 py-1 font-medium">{visibleCount === groupIds.length ? "Hide discipline" : "Show discipline"}</button></div>}
            <div className="space-y-1.5">{discipline.groups.map((group) => <SourceGroup key={group.id} group={group} geometry={geometry} visible={visible[group.id] !== false} expanded={openGroup === group.id} showAll={showAllGroup === group.id} selectedId={selectedId} onToggle={onToggle} onExpand={() => setOpenGroup(openGroup === group.id ? null : group.id)} onShowAll={() => setShowAllGroup(group.id)} onSelect={onSelect} />)}</div>
          </div>}
        </section>;
      })}</div>
      {geometry && <button type="button" onClick={() => downloadParcelReport(report, geometry, heading, propertyDetail)} className="li-inspection-download mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold"><Download className="h-3.5 w-3.5" />Download printable parcel report</button>}
      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">Public GIS screening only. Empty, unavailable, or unqueried results do not prove absence. Confirm utility locations with the owner and a field locate before design or excavation.</p>
    </>}
  </section>;
}

function SourceGroup({ group, geometry, visible, expanded, showAll, selectedId, onToggle, onExpand, onShowAll, onSelect }: {
  group: InspectionGroup; geometry: ParcelGeometry | null; visible: boolean; expanded: boolean; showAll: boolean; selectedId: string | null;
  onToggle: (id: string) => void; onExpand: () => void; onShowAll: () => void; onSelect: (finding: ParcelFinding) => void;
}) {
  const findings = showAll ? group.findings : group.findings.slice(0, 5);
  return <div className="li-inspection-source overflow-hidden rounded-lg border" style={{ borderLeftColor: colorFor(group.id), borderLeftWidth: 3 }}>
    <div className="flex items-center gap-1.5 px-2 py-2">
      <input type="checkbox" aria-label={`Show ${group.label} on map`} title={`Show ${group.label} on map`} checked={group.findings.length > 0 && visible} disabled={!group.findings.length} onChange={() => onToggle(group.id)} className="h-3.5 w-3.5 shrink-0 accent-cyan-500 disabled:opacity-30" />
      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-900/80" style={{ backgroundColor: colorFor(group.id) }} aria-hidden="true" />
      <button type="button" aria-expanded={expanded} onClick={onExpand} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white">{group.label}</span><span className={`block text-[10px] ${group.status === "unavailable" || group.status === "source_error" || group.status === "partial" ? "text-amber-200" : "text-slate-300"}`}>{statusLabel(group.status)}</span></span><span className="text-[10px] font-semibold text-cyan-200">{group.findings.length || "—"}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 text-cyan-300 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
    </div>
    {expanded && <div className="border-t border-white/10 px-2 pb-2 pt-2">
      {group.findings.length > 0 && <div className="space-y-1.5">{findings.map((finding) => <div key={finding.id} id={`parcel-finding-${finding.id}`} className="li-inspection-record rounded-md border"><button type="button" onClick={() => onSelect(finding)} aria-pressed={selectedId === finding.id} className="block w-full px-2.5 py-2 text-left"><span className="block text-[11px] font-semibold text-white">{finding.name}</span><span className="mt-0.5 block text-[10px] text-slate-300">{finding.relationship === "nearby" ? `${finding.distanceMeters?.toLocaleString() ?? "Distance unknown"} m from parcel boundary` : finding.relationship === "inside" ? "Mapped inside parcel" : "Intersects parcel"}</span></button>{selectedId === finding.id && <div className="border-t border-white/10 px-2.5 pb-2 text-[10px] leading-relaxed text-slate-300">{finding.detail && <p className="mt-1.5">{finding.detail}</p>}{geometry && (finding.geometry.type === "LineString" || finding.geometry.type === "MultiLineString") && finding.relationship !== "nearby" && <p className="mt-1">Approx. mapped line inside parcel: {lineInsideParcelMeters(finding.geometry, geometry).toLocaleString(undefined, { maximumFractionDigits: 1 })} m</p>}<p className="mt-1">Record {finding.sourceRecordId || "ID not supplied"}{finding.recordDate ? ` · ${finding.recordDate}` : ""}</p>{finding.positionalAccuracyMeters != null && <p className="mt-1">Reported position accuracy: {finding.positionalAccuracyMeters.toLocaleString()} m</p>}{finding.verification && <p className="mt-1">Source: {finding.verification.replaceAll("_", " ")}</p>}<a href={finding.recordUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-cyan-300 underline">Open source record ↗</a>{group.id === "roads" && <RoadSegmentDetails segmentId={finding.sourceRecordId} />}</div>}</div>)}{!showAll && group.findings.length > findings.length && <button type="button" onClick={onShowAll} className="li-inspection-action w-full rounded-md px-2 py-1.5 text-[10px] font-semibold">Show all {group.findings.length} records</button>}</div>}
      <p className="mt-2 text-[10px] leading-relaxed text-slate-300">{group.note}</p>
      <p className="mt-1 text-[10px] text-slate-400">Coverage: {group.coverage === "outside" ? "outside connected area" : group.coverage === "confirmed" ? "confirmed for this source" : "not independently confirmed"}{group.recordLimit ? ` · Up to ${group.recordLimit} records` : ""}{group.checkedAt ? ` · Checked ${new Date(group.checkedAt).toLocaleString()}` : ""}</p>
      <a href={group.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-cyan-300 underline">{group.source} ↗</a>
    </div>}
  </div>;
}
