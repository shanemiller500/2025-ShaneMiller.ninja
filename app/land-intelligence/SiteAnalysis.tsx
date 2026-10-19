"use client";

import { MapPin, RotateCcw } from "lucide-react";
import type { Coord } from "./geometry";
import type { Report, TerrainResult, TerrainSample } from "./report-types";

export function EvidenceSummary({ report }: { report: Report }) {
  const signals = [
    report.flood.status === "found" ? "FEMA flood mapping" : null,
    report.wetlands.value?.count ? "Mapped wetlands or water" : null,
    report.faults.value?.count ? "Mapped fault traces" : null,
    report.soils.value?.length ? "Soil map units" : null,
    report.facilities.value?.count ? "Nearby EPA facility records" : null,
    report.crashes.value?.count ? "Mapped 2024 fatal crash records" : null,
  ].filter(Boolean) as string[];
  const unavailable = [report.elevation, report.flood, report.waterways, report.wetlands, report.faults, report.parcels, report.roads, report.crashes, report.soils, report.facilities, report.census].filter((finding) => finding.status === "unavailable").length;
  return <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] p-3">
    <h2 className="text-xs font-semibold text-cyan-100">Evidence to review</h2>
    {signals.length ? <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-100">{signals.map((signal) => <li key={signal}>• {signal}</li>)}</ul> : <p className="mt-2 text-[11px] leading-relaxed text-slate-300">No mapped features returned in the selected categories. Check source coverage below before drawing conclusions.</p>}
    {unavailable > 0 && <p className="mt-2 text-[10px] text-amber-200">{unavailable} source{unavailable === 1 ? "" : "s"} unavailable in this check.</p>}
    <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-slate-400">This is a list of returned records, not a risk rating or buildability assessment.</p>
  </section>;
}

const meters = (value: number) => `${Math.round(value).toLocaleString()} m`;

export function TerrainCard({ terrain, loading, error, onLocate, onRetry }: {
  terrain: TerrainResult | null; loading: boolean; error: string; onLocate: (point: Coord) => void; onRetry: () => void;
}) {
  const samples = terrain?.samples ?? [];
  const low = samples.length ? samples.reduce((best, sample) => sample.elevationMeters < best.elevationMeters ? sample : best) : null;
  const high = samples.length ? samples.reduce((best, sample) => sample.elevationMeters > best.elevationMeters ? sample : best) : null;
  const chart = terrain?.shapeKind === "line" && samples.length >= 2 ? chartGeometry(samples) : null;
  return <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-semibold text-white">Terrain sampling</h2><span className="rounded-full bg-slate-400/15 px-2 py-0.5 font-mono text-[9px] uppercase text-slate-300">{loading ? "Checking" : terrain?.status ?? "Waiting"}</span></div>
    {loading && <p className="mt-2 flex items-center gap-2 text-[11px] text-cyan-200"><RotateCcw className="h-3 w-3 animate-spin" />Sampling USGS ground elevations…</p>}
    {error && <div className="mt-2 text-[11px] text-amber-200">{error} <button type="button" onClick={onRetry} className="underline">Try again</button></div>}
    {terrain && <>
      {terrain.status === "found" && terrain.minMeters != null && terrain.maxMeters != null && <>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Metric label="Sampled low" value={meters(terrain.minMeters)} /><Metric label="Sampled high" value={meters(terrain.maxMeters)} /><Metric label="Difference" value={meters(terrain.maxMeters - terrain.minMeters)} /></div>
        {chart && <svg viewBox="0 0 320 100" role="img" aria-label="Coarse route elevation profile" className="mt-3 h-[100px] w-full overflow-visible rounded-lg bg-slate-900/75">
          <path d={chart.area} fill="rgba(34,211,238,.13)" /><path d={chart.path} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {chart.dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r="3.5" fill="#a5f3fc"><title>{`${meters(samples[index].elevationMeters)} at ${((samples[index].distanceMeters ?? 0) / 1000).toFixed(1)} km`}</title></circle>)}
        </svg>}
        {terrain.shapeKind === "line" && terrain.ascentMeters != null && terrain.descentMeters != null && <p className="mt-2 font-mono text-[10px] text-slate-300">Sampled rise {meters(terrain.ascentMeters)} · fall {meters(terrain.descentMeters)}</p>}
        <div className="mt-2 flex flex-wrap gap-2">{low && <button type="button" onClick={() => onLocate(low.point)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"><MapPin className="h-3 w-3" />Low point</button>}{high && <button type="button" onClick={() => onLocate(high.point)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"><MapPin className="h-3 w-3" />High point</button>}</div>
      </>}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{terrain.note}</p>
      {terrain.status !== "found" && <button type="button" onClick={onRetry} className="mt-2 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10">Sample again</button>}
      <a href={terrain.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-cyan-300 underline underline-offset-2">{terrain.source} ↗</a>
    </>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-900/80 p-2"><div className="font-mono text-[13px] text-white">{value}</div><div className="mt-1 text-[9px] text-slate-400">{label}</div></div>;
}

function chartGeometry(samples: TerrainSample[]) {
  const low = Math.min(...samples.map((sample) => sample.elevationMeters));
  const high = Math.max(...samples.map((sample) => sample.elevationMeters));
  const total = samples[samples.length - 1].distanceMeters ?? 0;
  const dots = samples.map((sample, index) => ({ x: 12 + (total ? (sample.distanceMeters ?? 0) / total : index / (samples.length - 1)) * 296, y: 82 - (high === low ? 0.5 : (sample.elevationMeters - low) / (high - low)) * 64 }));
  const path = dots.map((dot, index) => `${index ? "L" : "M"}${dot.x.toFixed(1)},${dot.y.toFixed(1)}`).join(" ");
  return { dots, path, area: `${path} L${dots[dots.length - 1].x.toFixed(1)},88 L${dots[0].x.toFixed(1)},88 Z` };
}
