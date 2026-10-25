"use client";

import { useEffect, useState } from "react";
import { CDOT_CRASH_URL, CONDITIONS_URL, ROAD_SOURCE, type RoadSegmentReport, type RoadSourceResult } from "./road-segment";

const statusText = <T,>(source: RoadSourceResult<T>, noun: string) => source.status === "unavailable" ? `${noun} source unavailable` : source.status === "partial" ? `${source.items.length} ${noun.toLowerCase()} shown · incomplete source response` : source.items.length ? `${source.items.length} ${noun.toLowerCase()} mapped nearby` : `No ${noun.toLowerCase()} returned`;
const fact = (value: string | number | null, suffix = "") => value == null || value === "" ? "Not reported" : `${value}${suffix}`;

export function RoadSegmentDetails({ segmentId }: { segmentId: string }) {
  const [report, setReport] = useState<RoadSegmentReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!/^[1-9]\d{0,9}$/.test(segmentId)) { setError("A CDOT segment ID was not supplied."); return; }
    const controller = new AbortController();
    setReport(null); setError(""); setLoading(true);
    fetch(`/api/land-intelligence/road-segment?id=${encodeURIComponent(segmentId)}`, { signal: controller.signal })
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error || "Segment details unavailable."); return json as RoadSegmentReport; })
      .then((value) => { if (!controller.signal.aborted) setReport(value); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message || "Segment details unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [segmentId]);

  return <div className="mt-2 space-y-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed">
    <h5 className="text-[11px] font-semibold text-white">CDOT highway segment {segmentId}</h5>
    {loading && <p role="status" className="text-cyan-200">Loading segment crashes, alerts, and attributes…</p>}
    {error && <><p role="alert" className="text-amber-200">{error}</p><p className="flex flex-wrap gap-x-3 gap-y-1"><a href={`${ROAD_SOURCE}/query?objectIds=${encodeURIComponent(segmentId)}&outFields=*&f=pjson`} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">CDOT segment ↗</a><a href={CDOT_CRASH_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">CDOT crash data ↗</a><a href={CONDITIONS_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Current COtrip conditions ↗</a></p></>}
    {report && <>
      <p className="text-slate-300">{[report.road.route, report.road.alias, report.road.city, report.road.county].filter(Boolean).join(" · ") || "CDOT highway"}{report.road.fromMile != null && report.road.toMile != null ? ` · mile ${report.road.fromMile}–${report.road.toMile}` : ""}</p>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-white/10 p-2 text-slate-300"><p><span className="block text-slate-400">Speed limit</span>{fact(report.road.speedLimit, " mph")}</p><p><span className="block text-slate-400">Traffic volume</span>{report.road.aadt == null ? "Not reported" : `${report.road.aadt.toLocaleString()} vehicles/day${report.road.aadtYear ? ` (${report.road.aadtYear})` : ""}`}</p><p><span className="block text-slate-400">Surface type</span>{fact(report.road.surface)}</p><p><span className="block text-slate-400">Through lanes</span>{fact(report.road.lanes)}</p></div>
      <p className="text-slate-400">Surface type is a CDOT inventory attribute, not a live pavement-condition rating. <a href={report.road.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Segment data ↗</a></p>
      <section className="rounded-md border border-white/10 p-2"><h6 className="font-semibold text-white">Fatal crashes · 2024</h6><p className={report.crashes.status === "unavailable" ? "text-amber-200" : "text-slate-300"}>{statusText(report.crashes, "Fatal crash records")}</p><p className="mt-1 text-slate-400">{report.crashes.note}</p>{report.crashes.items.length > 0 && <ul className="mt-1.5 space-y-1">{report.crashes.items.map((crash, index) => <li key={`${crash.id}-${index}`} className="rounded border border-white/10 p-1.5 text-slate-300"><span className="font-medium text-white">{crash.date || "Date unavailable"} · {crash.fatalities ?? "?"} fatalit{crash.fatalities === 1 ? "y" : "ies"}</span><span className="block">{crash.road || "Road name unavailable"} · mapped {crash.distanceMeters} m from segment</span><a href={crash.recordUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">FARS record ↗</a></li>)}</ul>}<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><a href={report.crashes.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">FARS source ↗</a><a href={report.allCrashDataUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">CDOT all-crash data ↗</a></div></section>
      <section className="rounded-md border border-white/10 p-2"><h6 className="font-semibold text-white">Current COtrip incidents and alerts</h6><p className={report.alerts.status === "unavailable" ? "text-amber-200" : "text-slate-300"}>{statusText(report.alerts, "Active alerts")}</p><p className="mt-1 text-slate-400">{report.alerts.note}</p>{report.alerts.items.length > 0 && <ul className="mt-1.5 space-y-1">{report.alerts.items.map((alert) => <li key={alert.id} className="rounded border border-white/10 p-1.5 text-slate-300"><span className="font-medium text-white">{alert.title}</span><span className="block">{[alert.type, alert.impact, alert.direction, alert.location].filter(Boolean).join(" · ")}</span>{alert.description && <span className="block">{alert.description}</span>}{alert.updatedAt && <span className="block text-slate-400">Updated {new Date(alert.updatedAt).toLocaleString()}</span>}<a href={alert.recordUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Alert data ↗</a></li>)}</ul>}<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><a href={report.conditionsUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Live road conditions on COtrip ↗</a><a href={report.alerts.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Alert source ↗</a></div></section>
      <p className="text-slate-400">Checked {new Date(report.checkedAt).toLocaleString()}. Spatial proximity does not establish that a crash or alert belongs to this exact travel lane or direction.</p>
    </>}
  </div>;
}
