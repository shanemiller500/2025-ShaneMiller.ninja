import { crossSourceObservations, lineInsideParcelMeters, parcelDisciplineSummary, parcelMetrics } from "./parcel-analysis";
import { parcelBounds, type InspectionGroup, type ParcelFinding, type ParcelGeometry, type ParcelInspectionReport } from "./parcel-inspection";
import type { ParcelDetail } from "./parcel-detail";

type ParcelHeading = { name: string; id: string; locality: string; sourceUrl: string };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const link = (url: string, label: string) => /^https:\/\//i.test(url) ? `<a href="${escape(url)}">${escape(label)}</a>` : escape(label);
const number = (value: number, digits = 0) => value.toLocaleString("en-US", { maximumFractionDigits: digits });

function relationship(finding: ParcelFinding, geometry: ParcelGeometry) {
  if (finding.relationship === "nearby") return `${number(finding.distanceMeters ?? 0)} m from the parcel boundary`;
  if (finding.geometry.type === "LineString" || finding.geometry.type === "MultiLineString") return `Mapped line intersects; approximately ${number(lineInsideParcelMeters(finding.geometry, geometry), 1)} m falls inside the parcel`;
  return finding.relationship === "inside" ? "Mapped coordinate inside parcel" : "Mapped geometry intersects parcel";
}

function groupHtml(group: InspectionGroup, geometry: ParcelGeometry) {
  const rows = group.findings.map((finding) => `<li><b>${escape(finding.name)}</b><br>${escape(relationship(finding, geometry))}${finding.detail ? `<br>${escape(finding.detail)}` : ""}<br>Record ID: ${escape(finding.sourceRecordId || "not supplied")}${finding.recordDate ? `; record date: ${escape(finding.recordDate)}` : ""}${finding.positionalAccuracyMeters != null ? `; reported position accuracy: ${number(finding.positionalAccuracyMeters)} m` : ""}${finding.verification ? `; verification: ${escape(finding.verification.replaceAll("_", " "))}` : ""}<br>${link(finding.recordUrl, "Source data")}</li>`).join("");
  const coverage = group.coverage === "outside" ? "outside connected area" : group.coverage === "confirmed" ? "confirmed for this source" : "not independently confirmed";
  return `<section><h3>${escape(group.label)} <small>${escape(group.status.replaceAll("_", " "))}</small></h3><p>${escape(group.note)}</p><p>Coverage: ${coverage}${group.recordLimit ? `; up to ${number(group.recordLimit)} records` : ""}${group.checkedAt ? `; checked: ${escape(group.checkedAt)}` : ""}</p>${rows ? `<ol>${rows}</ol>` : "<p>No mapped feature is listed in this source result.</p>"}<p>Provider: ${link(group.sourceUrl, group.source)}</p></section>`;
}

function propertyHtml(detail: ParcelDetail | null) {
  if (!detail) return "<section><h2>Property record and site context</h2><p>Property details were not available when this report was downloaded.</p></section>";
  const parcel = detail.parcel;
  const facts = [
    ["Site address", parcel.address], ["Land use", parcel.landUse], ["Parcel zoning", parcel.zoning],
    ["Data received", parcel.received], ["Value year", detail.valueYear],
    ["Assessed total", detail.assessedTotal == null ? "" : `$${number(detail.assessedTotal)}`],
    ["Legal description", detail.legalDescription],
  ].filter(([, value]) => value).map(([label, value]) => `<li><b>${escape(label)}:</b> ${escape(value)}</li>`).join("");
  const county = detail.boulder;
  if (county?.status !== "ready" || !county.property) return `<section><h2>Property record and site context</h2><ul>${facts}</ul><p>${county?.status === "not_loaded" ? "Boulder assessor snapshot not loaded; county account, building, sale and permit records are not included." : "County account, building, sale and permit records are not included."}</p>${link(parcel.recordUrl || parcel.sourceUrl, "Parcel source")}</section>`;
  const property = county.property;
  const accounts = property.accounts.map((account) => {
    const values = account.values;
    const rows = (items: string[], empty: string) => items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p>${empty}</p>`;
    const buildings = account.buildings.map((building) => `${escape(building.design || `Building ${building.buildingNumber || "number not supplied"}`)}; built ${escape(building.yearBuilt ?? "not reported")}; main floor ${escape(building.mainFloorSqft == null ? "not reported" : `${number(building.mainFloorSqft)} sq ft`)}`);
    const sales = account.sales.map((sale) => `${escape(sale.date || "Date not reported")}; ${escape(sale.price == null ? "price not reported" : `$${number(sale.price)}`)}; reception ${escape(sale.reception || "not supplied")}; qualification ${escape(sale.qualification || "not supplied")}`);
    const permits = account.permits.map((permit) => `${escape(permit.date || "Date not reported")}; permit ${escape(permit.number || "number not supplied")}; category ${escape(permit.category || "not supplied")}; ${escape(permit.description || "description not supplied")}; issued by ${escape(permit.issuedBy || "not supplied")}`);
    return `<h3>Assessor account ${escape(account.accountNo)}</h3>${(account.linkedParcelCount ?? 1) > 1 ? `<p>This account links to ${account.linkedParcelCount} parcel numbers; buildings, sales and permits may concern another parcel in the account.</p>` : ""}<p>Account type: ${escape(account.accountType || "not supplied")}; land use: ${escape(account.landUses.join(", ") || "not supplied")}</p><p>Tax year: ${escape(values?.taxYear || "not supplied")}; appraised total: ${escape(values?.actualTotal == null ? "not supplied" : `$${number(values.actualTotal)}`)}; assessed total: ${escape(values?.assessedTotal == null ? "not supplied" : `$${number(values.assessedTotal)}`)}</p><h3>Buildings</h3>${rows(buildings, "No building rows in this snapshot.")}<h3>Recorded sales and deeds</h3>${rows(sales, "No associated document rows in this snapshot.")}<h3>Permits</h3>${rows(permits, "No permit rows in this snapshot.")}`;
  }).join("");
  return `<section><h2>Property record and site context</h2><ul>${facts}</ul><p>Boulder County assessor parcel ${escape(property.folio)}; snapshot ${escape(property.updatedAt)}${property.sourceDate ? `; county data dated ${escape(property.sourceDate)}` : ""}. Account rows are joined by county folio and account number.</p>${accounts}<p>Recorded documents are not necessarily market sales; permits do not prove completed work. ${link(property.sourceUrl, "Boulder County source")} · ${link("https://bouldercounty.gov/records/recording/search-public-records/", "Recorder search")}</p></section>`;
}

/** Standalone printable report built only from the already returned public records. */
export function parcelReportHtml(report: ParcelInspectionReport, geometry: ParcelGeometry, heading: ParcelHeading, detail: ParcelDetail | null = null) {
  const metrics = parcelMetrics(geometry);
  const [west, south, east, north] = parcelBounds(geometry);
  const disciplines = parcelDisciplineSummary(report);
  const summary = disciplines.map((discipline) => `<li><b>${escape(discipline.label)}</b>: ${discipline.groups.length ? `${number(discipline.findings)} mapped feature${discipline.findings === 1 ? "" : "s"}; ${discipline.unavailable} unavailable or partial source${discipline.unavailable === 1 ? "" : "s"}; ${discipline.unqueried} not queried; ${discipline.unknown} coverage unknown; ${discipline.empty} no mapped features; ${discipline.outside} outside coverage` : "property record fields only; parcel coverage varies"}</li>`).join("");
  const observations = crossSourceObservations(report);
  const observationsHtml = observations.length ? `<section><h2>Combined source observations</h2>${observations.map((item) => `<p>${escape(item.text)}<br><small>Rule: ${escape(item.rule)}</small><br>${item.sources.map((source) => link(source.url, source.label)).join(" · ")}</p>`).join("")}</section>` : "";
  const sections = disciplines.map((discipline) => `<h2>${escape(discipline.label)}</h2><p>${escape(discipline.note)}</p>${discipline.groups.map((group) => groupHtml(group, geometry)).join("")}`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Parcel inspection - ${escape(heading.id)}</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#172333;max-width:900px;margin:36px auto;padding:0 24px}h1{margin-bottom:0}h2{font-size:20px;margin-top:30px;border-top:2px solid #dce8ed;padding-top:14px}h3{font-size:16px;margin-bottom:4px}small{font-size:11px;font-weight:400;color:#476676}section{border-top:1px solid #e3ebee;padding:10px 0;break-inside:avoid}li{margin:8px 0;overflow-wrap:anywhere}a{color:#087389}footer{border-top:2px solid #dce8ed;margin-top:28px;padding-top:14px;color:#52616d}@media print{body{margin:0;max-width:none}a{color:inherit}}</style></head><body><h1>Land Intelligence parcel inspection</h1><p><b>${escape(heading.name)}</b><br>${escape(heading.locality)}<br>Parcel ID: ${escape(heading.id)}<br>Checked: ${escape(new Date(report.checkedAt).toLocaleString("en-US"))}<br>${link(heading.sourceUrl, "Parcel source record")}</p>${propertyHtml(detail)}<section><h2>Map measurements</h2><p>Approximate parcel area: ${number(metrics.areaMeters2, 1)} m² (${number(metrics.areaMeters2 / 4046.8564224, 3)} acres)<br>Approximate mapped boundary length: ${number(metrics.perimeterMeters, 1)} m<br>Bounding box: ${[west, south, east, north].map((value) => number(value, 6)).join(", ")} (longitude/latitude)</p><p>Measurements come from the selected GIS polygon, including mapped holes and separate pieces. They are not survey measurements.</p></section><section><h2>Discipline summary</h2><ul>${summary}</ul><p>Counts are returned map features, not a risk score or a count of confirmed site conditions.</p></section>${observationsHtml}${sections}<footer>Preliminary public GIS screening. An empty, unavailable, outside-coverage, or not-queried result is not proof of absence. Parcel lines are not legal boundaries. Verify conditions, utility alignments and depths, regulatory status, and design criteria with the responsible agency, utility owner, and qualified professional before design or excavation.</footer></body></html>`;
}

export function downloadParcelReport(report: ParcelInspectionReport, geometry: ParcelGeometry, heading: ParcelHeading, detail: ParcelDetail | null = null) {
  const html = parcelReportHtml(report, geometry, heading, detail);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `parcel-inspection-${heading.id.replace(/[^a-z0-9-]/gi, "-")}-${report.checkedAt.slice(0, 10)}.html`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
