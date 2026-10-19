import type { AnalysisShape } from "./geometry";
import type { Finding, Report, TerrainResult } from "./report-types";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function downloadReport(report: Report, shape: AnalysisShape, terrain: TerrainResult | null = null) {
  const sections: [string, Finding<unknown>][] = [
    ["Ground elevation", report.elevation], ["FEMA flood mapping", report.flood], ["Mapped waterways", report.waterways],
    ["Wetlands", report.wetlands], ["Mapped faults", report.faults], ["Public parcel records", report.parcels], ["Soil map units", report.soils], ["EPA regulated facilities", report.facilities], ["Census tract context", report.census], ["Colorado highways", report.roads], ["Fatal crashes (2024)", report.crashes],
  ];
  const rows = sections.map(([title, finding]) => {
    const value = finding.value == null ? "No value" : typeof finding.value === "object" ? JSON.stringify(finding.value, null, 2) : String(finding.value);
    return `<section><h2>${escape(title)} <small>${escape(finding.status)}</small></h2><pre>${escape(value)}</pre><p>${escape(finding.note)}</p><p><b>Coverage:</b> ${escape(finding.coverage)}<br><b>Data age:</b> ${escape(finding.freshness)}<br><b>Source:</b> <a href="${escape(finding.url)}">${escape(finding.source)}</a></p></section>`;
  }).join("");
  const terrainSection = terrain ? `<section><h2>Terrain sampling <small>${escape(terrain.status)}</small></h2><pre>${escape(JSON.stringify({ sampledLowMeters: terrain.minMeters, sampledHighMeters: terrain.maxMeters, sampledAscentMeters: terrain.ascentMeters, sampledDescentMeters: terrain.descentMeters, samples: terrain.samples }, null, 2))}</pre><p>${escape(terrain.note)}</p><a href="${escape(terrain.url)}">${escape(terrain.source)}</a></section>` : shape.kind === "pin" ? "" : "<section><h2>Terrain sampling</h2><p>Terrain samples were not available when this report was downloaded.</p></section>";
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Land Intelligence report</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#182333;max-width:850px;margin:48px auto;padding:0 24px}h1{margin-bottom:0}h2{font-size:19px}small{font-size:12px;color:#477b88}section{border-top:1px solid #d8e3e7;padding:14px 0;break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f7f8;padding:14px;border-radius:8px;font:12px/1.5 ui-monospace,monospace}a{color:#087389}footer{border-top:1px solid #d8e3e7;padding-top:20px;color:#536273}@media print{body{margin:0;max-width:none}}</style><h1>Land Intelligence</h1><p>Public GIS screening · checked ${escape(new Date(report.checkedAt).toLocaleString())}</p><p><b>Drawing:</b> ${escape(shape.kind)} · ${escape(shape.points.length)} point(s)</p><pre>${escape(JSON.stringify(shape, null, 2))}</pre>${terrainSection}${rows}<footer>Preliminary public GIS screening. A blank result is not proof of absence. Verify parcel boundaries, flood status, wetlands, soils, site conditions and land use with the responsible agency before making decisions.</footer></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `land-intelligence-${report.checkedAt.slice(0, 10)}.html`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
