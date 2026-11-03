import { crossSourceObservations, lineInsideParcelMeters, parcelDisciplineSummary, parcelMetrics } from "./parcel-analysis";
import { parcelBounds, type InspectionGroup, type ParcelFinding, type ParcelGeometry, type ParcelInspectionReport } from "./parcel-inspection";
import type { ParcelDetail } from "./parcel-detail";
import { RECORD_DATE_ISSUES } from "./record-date";
import { ENTITY_LABELS, boulderSaleClass, propertyHistory } from "./property-history";
import type { CompResult } from "./comps";
import type { MarketContext } from "./market-data";
import { INSPECTION_SECTIONS, SOURCE_RIGHTS, constraintRollup, coverageProfile, sectionAllowed, sectionTitle, type SectionId } from "./inspection-sections";
import { ownershipCost, rentalAnalysis, residualLandValue, type Scenario } from "./investment";

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

const money = (value: number | null) => value == null ? "not reported" : `$${number(value)}`;
/** The same deterministic history as Map Inspection; derived figures are marked "calculated". */
function historyHtml(detail: ParcelDetail) {
  const history = propertyHistory(detail);
  if (!history.sales.length && !history.permits && !history.buildings && !history.taxes.length) return "";
  const sales = history.sales.map((sale) => `<li>${escape(sale.date || (sale.dateIssue ? RECORD_DATE_ISSUES[sale.dateIssue] : "Date not reported"))}; ${escape(money(sale.price))}; ${escape(sale.label)}; ${escape(sale.source === "county" ? "county record" : "statewide record")}${sale.deedType ? `; ${escape(sale.deedType)}` : ""}${sale.parties ? `; ${escape(sale.parties)}` : ""}${sale.reference ? `; ref ${escape(sale.reference)}` : ""}${sale.multiParcel ? "; multi-parcel sale" : ""}${sale.sharedAccount ? "; account spans several parcels" : ""}</li>`).join("");
  const changes = history.priceChanges.map((change) => `<li>Calculated: ${escape(change.from.date)} ${escape(money(change.from.price))} to ${escape(change.to.date)} ${escape(money(change.to.price))}, change ${escape(money(change.change))}${change.annualRate != null ? `, ${escape((change.annualRate * 100).toFixed(1))}% per year` : ""}${change.permitsBetween ? `; ${change.permitsBetween} permit record(s) in between` : ""}</li>`).join("");
  const b = history.buildings, p = history.permits;
  const facts = [
    b && `Buildings / sections: ${b.buildings} / ${b.sections}; finished area ${b.finishedSqft == null ? "not reported" : `${number(b.finishedSqft)} sq ft`}; oldest year built ${b.oldestYear ?? "not reported"}`,
    p && `Permits: ${p.total} records; most recent ${p.last || "not dated"}; ${p.recent} since ${p.recentSince}; reported work value ${p.reportedValue ? money(p.reportedValue) : "not reported"}`,
    ...history.taxes.map((tax) => `Calculated tax estimate${history.taxes.length > 1 ? ` (account ${tax.account})` : ""}: ${tax.low === tax.high ? money(tax.low) : `${money(tax.low)} to ${money(tax.high)}`} from assessed value × ${tax.millLevy} mills ÷ 1,000, before exemptions or credits; not a tax bill`),
    ...history.owners.map((owner) => `Owner: ${owner.name}${owner.role ? ` (${owner.role})` : ""}${owner.share != null ? `, ${Math.round(owner.share * 100)}% share` : ""}; entity type ${ENTITY_LABELS[owner.entity]} (rule-based from the name)`),
  ].filter(Boolean).map((item) => `<li>${escape(item)}</li>`).join("");
  return `<p>Qualified sales: ${history.marketSales}. Qualification comes from the county or state code; calculated figures are arithmetic on these records, not appraisals.</p>${sales ? `<ol>${sales}</ol>` : ""}${changes ? `<ul>${changes}</ul>` : ""}${facts ? `<ul>${facts}</ul>` : ""}`;
}

/** Comparable sales as loaded in Map Inspection; the value range is a calculated figure, never an appraisal. */
function comparablesHtml(result: CompResult | null) {
  if (!result) return "";
  const land = result.subject.basis === "land", unit = land ? "land sq ft" : "finished sq ft";
  const rows = result.comps.map((comp) => `<li>${escape(comp.date)}; ${escape(money(comp.price))}; ${escape(`$${number(comp.perUnit)}`)} per ${escape(unit)}; ${escape(number(comp.units))} ${escape(unit)}${comp.yearBuilt ? `; built ${comp.yearBuilt}` : ""}${comp.distanceMiles != null ? `; ${escape(number(comp.distanceMiles, 2))} mi` : ""}${comp.siteAddress ? `; ${escape(comp.siteAddress)}` : ""}${comp.reception ? `; reception ${escape(comp.reception)}` : ""}${comp.outlier ? "; outlier, not used" : ""}${comp.changedAfterSale ? "; changed after sale" : ""}</li>`).join("");
  const estimate = result.estimate && result.stats ? `<p><b>Calculated comparable-sales range: ${escape(money(result.estimate.low))} to ${escape(money(result.estimate.high))}</b> (midpoint ${escape(money(result.estimate.value))}; ${escape(result.confidence)} confidence). Midpoint = ${escape(number(result.subject.units))} ${escape(unit)} × median $${escape(number(result.stats.median))} (comparables' middle half $${escape(number(result.stats.p25))} to $${escape(number(result.stats.p75))}) from ${result.used} sales. ${result.estimate.rangeBasis === "calibrated" && result.estimate.coverage != null ? `Range width from a backtest of past county sales: about ${Math.round(result.estimate.coverage * 100)}% of actual prices fell inside at this confidence level.` : "Range is the middle half of comparable prices, not checked against outcomes."}</p>` : "<p>No value range: fewer than 3 usable comparable sales.</p>";
  const tier = result.tier ? `within ${result.locationMethod === "distance" ? `${result.tier.radiusMiles} mi, ` : "the same appraisal neighborhood, "}${result.tier.months} months and ±${Math.round(result.tier.sizeBand * 100)}% size` : "";
  return `<p>Qualified, priced, single-parcel county sales of the same building class (${escape(result.subject.type.toLowerCase())}), ${escape(tier)}; county data as of ${escape(result.asOf)}.</p>${estimate}${result.reasons.map((reason) => `<p>${escape(reason)}</p>`).join("")}${rows ? `<ol>${rows}</ol>` : ""}<p>Not an appraisal. Prices are not adjusted for date, condition, features or location; building facts are the county's current record.</p>`;
}

/** Federal market context as loaded in Map Inspection: official estimates with margins, calculated changes labeled. */
function marketHtml(market: MarketContext | null) {
  if (!market) return "";
  const { geography: geo, acs, hpi, permits, rates, fmr } = market;
  const cell = (item: { value: number | null; moe: number | null; reliability: string; bound?: string } | undefined, format: (value: number) => string) => !item || item.value == null ? "not available" : `${item.bound === "at_least" ? "at least " : item.bound === "at_most" ? "at most " : ""}${format(item.value)}${item.moe != null ? ` (±${format(item.moe)})` : ""}${item.reliability === "low" ? ", low reliability" : ""}`;
  const dollars = (value: number) => `$${number(value)}`, share = (value: number) => `${number(value * 100, 1)}%`;
  const areas: [string, typeof acs.tract][] = [["Tract", acs.tract], ["County", acs.county], ["State", acs.state], ["United States", acs.us]];
  const acsRows = areas.filter(([, profile]) => profile).map(([label, profile]) => `<li><b>${escape(label)}</b>: median home value ${escape(cell(profile!.medianValue, dollars))}; median gross rent ${escape(cell(profile!.medianRent, dollars))}; median household income ${escape(cell(profile!.medianIncome, dollars))}; vacancy ${escape(cell(profile!.vacancyRate, share))} (calculated); renter-occupied ${escape(cell(profile!.renterShare, share))} (calculated)</li>`).join("");
  const change = (value: number | null) => value == null ? "not available" : `${value >= 0 ? "+" : ""}${number(value * 100, 1)}%`;
  const hpiRows = ([["Tract (annual, developmental)", hpi.tract], [`Metro ${hpi.metro?.name ?? ""} (quarterly)`, hpi.metro], ["State (quarterly)", hpi.state]] as const).filter(([, item]) => item).map(([label, item]) => `<li>${escape(label)}: ${escape(item!.latest)}; 1-year ${escape(change(item!.oneYear))}; 5-year ${escape(change(item!.fiveYear))} (calculated from the FHFA index)</li>`).join("");
  const permitText = permits ? `<p>Building permits, ${escape(geo.county?.name ?? "county")}: ${number(permits.latestUnits)} housing units in ${permits.latestYear}${permits.fiveYearAverage != null ? `; five-year average ${number(permits.fiveYearAverage)}` : ""}${permits.perThousandHomes != null ? `; ${number(permits.perThousandHomes, 1)} per 1,000 existing homes (calculated)` : ""}.</p>` : "";
  const rateText = rates.thirtyYear?.rate != null ? `<p>30-year fixed mortgage rate (national): ${number(rates.thirtyYear.rate, 2)}% on ${escape(rates.thirtyYear.date ?? "")}.</p>` : "";
  const fmrText = fmr.status === "ready" ? `<p>HUD Fair Market Rents FY${escape(fmr.data.year)}${fmr.data.zip ? ` (ZIP ${escape(fmr.data.zip)})` : ""}: ${fmr.data.rents.map((item) => `${item.bedrooms === 0 ? "studio" : `${item.bedrooms} BR`} $${number(item.rent)}`).join("; ")}.</p>` : `<p>HUD Fair Market Rents: ${escape(fmr.reason)}</p>`;
  return `<p>${escape([geo.tract?.name, geo.county?.name, geo.metro?.name, geo.state.name].filter(Boolean).join(", "))}. Area statistics describe residents and homes across each area, not this parcel. ${escape(acs.vintage)}; margins are 90%.</p><ul>${acsRows}</ul>${hpiRows ? `<ul>${hpiRows}</ul>` : ""}${permitText}${rateText}${fmrText}<p>${market.sources.map((source) => `${link(source.url, source.label)} (${escape(source.vintage)})`).join(" · ")}</p>`;
}

const coverageWord = { yes: "available", partial: "partial", no: "not published" } as const;

function overviewHtml(detail: ParcelDetail | null, geometry: ParcelGeometry) {
  const metrics = parcelMetrics(geometry);
  const [west, south, east, north] = parcelBounds(geometry);
  const parcel = detail?.parcel;
  const facts = parcel ? [["Site address", parcel.address], ["Land use", parcel.landUse], ["Parcel zoning", parcel.zoning], ["Property ID", parcel.propertyId], ["Data received", parcel.received]]
    .filter(([, value]) => value).map(([label, value]) => `<li><b>${escape(label)}:</b> ${escape(value)}</li>`).join("") : "";
  const coverage = parcel ? coverageProfile(parcel.state, parcel.county, detail?.boulder?.status) : [];
  const coverageRows = coverage.map((row) => `<tr><td>${escape(row.label)}</td><td>${coverageWord[row.level]}</td><td>${escape(row.note)}</td></tr>`).join("");
  return `${facts ? `<ul>${facts}</ul>` : "<p>Property details were not available when this report was downloaded.</p>"}${coverageRows ? `<h3>Records available for this jurisdiction</h3><table><thead><tr><th>Record</th><th>Status</th><th>Source detail</th></tr></thead><tbody>${coverageRows}</tbody></table>` : ""}<h3>Map measurements</h3><p>Approximate parcel area: ${number(metrics.areaMeters2, 1)} m² (${number(metrics.areaMeters2 / 4046.8564224, 3)} acres)<br>Approximate mapped boundary length: ${number(metrics.perimeterMeters, 1)} m<br>Bounding box: ${[west, south, east, north].map((value) => number(value, 6)).join(", ")} (longitude/latitude)</p><p>Measurements come from the selected GIS polygon, including mapped holes and separate pieces. They are not survey measurements.</p>`;
}

function ownershipHtml(detail: ParcelDetail | null) {
  if (!detail) return "<p>Property details were not available when this report was downloaded.</p>";
  const parcel = detail.parcel;
  const facts = [
    ["Reported owner", detail.owners?.join("; ")], ["Value year", detail.valueYear],
    [detail.valueLabels?.market || "Est. fair market", detail.estimatedMarketValue == null ? "" : `$${number(detail.estimatedMarketValue)}`],
    [detail.valueLabels?.total || "Assessed total", detail.assessedTotal == null ? "" : `$${number(detail.assessedTotal)}`],
    [detail.valueLabels?.taxable || "Taxable value", detail.taxableValue == null ? "" : `$${number(detail.taxableValue)}`],
    ["Legal description", detail.legalDescription],
  ].filter(([, value]) => value).map(([label, value]) => `<li><b>${escape(label)}:</b> ${escape(value)}</li>`).join("") + (detail.valueNote ? `<li>${escape(detail.valueNote)}</li>` : "");
  const county = detail.boulder;
  if (county?.status !== "ready" || !county.property) return `<ul>${facts}</ul><p>${county?.status === "not_loaded" ? "Boulder assessor snapshot not loaded; county account, building, sale and permit records are not included." : county?.status === "rights_pending" ? "Boulder assessor records are withheld until the county confirms republication rights; see the county assessor for the full record." : "County account, building, sale and permit records are not included."}</p>${link(parcel.recordUrl || parcel.sourceUrl, "Parcel source")}`;
  const property = county.property;
  const accounts = property.accounts.map((account) => {
    const values = account.values;
    const rows = (items: string[], empty: string) => items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p>${empty}</p>`;
    const buildings = account.buildings.map((building) => `${escape(building.design || `Building ${building.buildingNumber || "number not supplied"}`)}; built ${escape(building.yearBuilt ?? "not reported")}; finished area ${escape(building.finishedSqft == null ? "not reported" : `${number(building.finishedSqft)} sq ft`)}; main floor ${escape(building.mainFloorSqft == null ? "not reported" : `${number(building.mainFloorSqft)} sq ft`)}${building.basementSqft ? `; basement ${escape(number(building.basementSqft))} sq ft` : ""}${building.quality ? `; quality ${escape(building.quality)}` : ""}`);
    const sales = account.sales.map((sale) => `${escape(sale.date || (sale.dateIssue ? RECORD_DATE_ISSUES[sale.dateIssue] : "Date not reported"))}; ${escape(sale.price == null ? "price not reported" : `$${number(sale.price)}`)}; reception ${escape(sale.reception || "not supplied")}; ${escape(boulderSaleClass(sale.qualification, sale.price).label)}${sale.deedType ? `; deed type ${escape(sale.deedType)}` : ""}`);
    const permits = account.permits.map((permit) => `${escape(permit.date || (permit.dateIssue ? RECORD_DATE_ISSUES[permit.dateIssue] : "Date not reported"))}; permit ${escape(permit.number || "number not supplied")}; category ${escape(permit.category || "not supplied")}; ${escape(permit.description || "description not supplied")}; issued by ${escape(permit.issuedBy || "not supplied")}`);
    return `<h3>Assessor account ${escape(account.accountNo)}</h3>${(account.linkedParcelCount ?? 1) > 1 ? `<p>This account links to ${account.linkedParcelCount} parcel numbers; buildings, sales and permits may concern another parcel in the account.</p>` : ""}<p>Account type: ${escape(account.accountType || "not supplied")}; land use: ${escape(account.landUses.join(", ") || "not supplied")}</p><p>Tax year: ${escape(values?.taxYear || "not supplied")}; actual value: ${escape(values?.actualTotal == null ? "not supplied" : `$${number(values.actualTotal)}`)}; assessed value: ${escape(values?.assessedTotal == null ? "not supplied" : `$${number(values.assessedTotal)}`)}</p><h3>Buildings</h3>${rows(buildings, "No building rows in this snapshot.")}<h3>Recorded sales and deeds</h3>${rows(sales, "No associated document rows in this snapshot.")}<h3>Permits</h3>${rows(permits, "No permit rows in this snapshot.")}`;
  }).join("");
  return `<ul>${facts}</ul><p>Boulder County assessor parcel ${escape(property.folio)}; snapshot ${escape(property.updatedAt)}${property.sourceDate ? `; county data dated ${escape(property.sourceDate)}` : ""}. Account rows are joined by county folio and account number.</p>${accounts}<p>Recorded documents are not necessarily market sales; permits do not prove completed work. ${link(property.sourceUrl, "Boulder County source")} · ${link("https://bouldercounty.gov/records/recording/search-public-records/", "Recorder search")}</p>`;
}

function engineeringHtml(report: ParcelInspectionReport, geometry: ParcelGeometry) {
  const disciplines = parcelDisciplineSummary(report);
  const summary = disciplines.map((discipline) => `<li><b>${escape(discipline.label)}</b>: ${discipline.groups.length ? `${number(discipline.findings)} mapped feature${discipline.findings === 1 ? "" : "s"}; ${discipline.unavailable} unavailable or partial source${discipline.unavailable === 1 ? "" : "s"}; ${discipline.unqueried} not queried; ${discipline.unknown} coverage unknown; ${discipline.empty} no mapped features; ${discipline.outside} outside coverage` : "property record fields only; parcel coverage varies"}</li>`).join("");
  const observations = crossSourceObservations(report);
  const observationsHtml = observations.length ? `<h3>Combined source observations</h3>${observations.map((item) => `<p>${escape(item.text)}<br><small>Rule: ${escape(item.rule)}</small><br>${item.sources.map((source) => link(source.url, source.label)).join(" · ")}</p>`).join("")}` : "";
  const sections = disciplines.map((discipline) => `<h3>${escape(discipline.label)}</h3><p>${escape(discipline.note)}</p>${discipline.groups.map((group) => groupHtml(group, geometry)).join("")}`).join("");
  return `<p>Checked ${escape(new Date(report.checkedAt).toLocaleString("en-US"))}.</p><h3>Discipline summary</h3><ul>${summary}</ul><p>Counts are returned map features, not a risk score or a count of confirmed site conditions.</p>${observationsHtml}${sections}`;
}

const pctText = (value: number | null, digits = 1) => value == null || !Number.isFinite(value) ? "not applicable" : `${(value * 100).toFixed(digits)}%`;

/** Mapped constraints on the parcel plus the calculator scenario, if it was opened. Inputs keep their record/assumption labels. */
function feasibilityHtml(report: ParcelInspectionReport, scenario: Scenario | null) {
  const rollup = constraintRollup(report)!;
  const rows = rollup.rows.map((row) => `<li><b>${escape(row.label)}</b>: ${row.onParcel} on or crossing the parcel${row.names.length ? ` (${escape(row.names.join("; "))})` : ""}; ${row.nearby} nearby</li>`).join("");
  const constraints = `<h3>Mapped constraints</h3>${rows ? `<ul>${rows}</ul>` : "<p>No mapped feature from the connected engineering sources touches or neighbors this parcel.</p>"}${rollup.unchecked.length ? `<p>Not fully checked: ${escape(rollup.unchecked.join(", "))}. A missing record here is not evidence of absence.</p>` : ""}<p>Confirm permitted uses, density and setbacks with the zoning authority; the map's zoning lookup is a screening reference.</p>`;
  if (!scenario) return `${constraints}<p>The investment calculator was not opened before this report was downloaded, so no scenario is included.</p>`;
  const { input, defaults, edited } = scenario;
  const d = (value: number) => `$${number(Math.round(value))}`;
  const origin = (key: keyof typeof defaults, value: number) => defaults[key].value === value ? ` <small>(${defaults[key].assumption ? "assumption" : "from records"}: ${escape(defaults[key].source)})</small>` : " <small>(entered by the user)</small>";
  const own = ownershipCost(input), rent = rentalAnalysis(input), develop = residualLandValue(input);
  const inputs = `<ul><li>Price ${d(input.price)}${origin("price", input.price)}</li><li>Down payment ${input.downPct}%; interest rate ${input.ratePct}%${origin("ratePct", input.ratePct)}; term ${input.years} years</li><li>Property tax ${d(input.taxAnnual)}/yr${origin("taxAnnual", input.taxAnnual)}; insurance ${d(input.insuranceAnnual)}/yr${origin("insuranceAnnual", input.insuranceAnnual)}; HOA ${d(input.hoaMonthly)}/mo</li><li>Rent ${d(input.monthlyRent)}/mo${origin("monthlyRent", input.monthlyRent)}; vacancy ${input.vacancyPct}%; maintenance ${input.maintenancePct}%, management ${input.managementPct}% and reserves ${input.reservesPct}% of rent; closing costs ${input.closingCostPct}%</li><li>Development: ${input.units} unit(s)${origin("units", input.units)} at ${d(input.salePricePerUnit)} each; ${number(input.buildingSqft)} sq ft${origin("buildingSqft", input.buildingSqft)} at ${d(input.hardCostPerSqft)}/sq ft hard cost; soft costs ${input.softCostPct}%, financing ${input.financingPct}%, sale costs ${input.saleCostPct}%, target profit ${input.profitPct}%</li></ul>`;
  const results = `<ul><li>Ownership: loan ${d(own.loan)}; principal and interest ${d(own.principalInterest)}/mo; monthly total ${d(own.monthlyTotal)}/mo</li><li>Rental: net operating income ${d(rent.noi)}/yr; cap rate ${pctText(rent.capRate, 2)}; cash flow ${d(rent.cashFlow)}/yr; cash-on-cash ${pctText(rent.cashOnCash)}; DSCR ${rent.dscr == null ? "not applicable" : `${rent.dscr.toFixed(2)}×`}; break-even occupancy ${pctText(rent.breakEvenOccupancy)}</li><li>Residual land value: ${d(develop.residualLandValue)}${develop.residualLandValue < 0 ? " (negative: these inputs support no land price)" : ""}</li></ul>`;
  return `${constraints}<h3>Scenario calculator${edited ? " (inputs edited)" : " (record defaults)"}</h3>${inputs}${results}<p>Calculated scenario arithmetic on the inputs above. Not financial advice, a loan quote or an appraisal. Residual land value does not check zoning, density, utilities or site constraints.</p>`;
}

function rightsHtml(used: SectionId[], market: MarketContext | null, detail: ParcelDetail | null, report: ParcelInspectionReport) {
  // Live and token-gated sources are credited only when this report actually contains their data.
  const live = detail?.countyLive?.status === "ready" ? detail.countyLive.kind : null;
  const wells = report.groups.some((group) => group.id === "oil-gas-wells" && group.status !== "outside_coverage");
  const shown: Partial<Record<string, boolean>> = { "hud-fmr": market?.fmr.status === "ready", "denver-sales": live === "sales", "adams-values": live === "values", "co-entities": false, "ecmc-wells": wells };
  const sources = Array.from(new Set(used.flatMap((id) => INSPECTION_SECTIONS.find((section) => section.id === id)!.sources))).filter((id) => shown[id] ?? true);
  return `<section><h2>Sources, rights and attribution</h2><ul>${sources.map((id) => SOURCE_RIGHTS[id]).map((rights) => `<li><b>${escape(rights.label)}</b>: ${escape(rights.basis)}.${rights.attribution ? ` ${escape(rights.attribution)}` : ""} <small>Rights reviewed ${escape(rights.reviewed)}.</small></li>`).join("")}</ul></section>`;
}

/** Standalone printable report built only from the already returned public records, in Map Inspection's section order. */
export function parcelReportHtml(report: ParcelInspectionReport, geometry: ParcelGeometry, heading: ParcelHeading, detail: ParcelDetail | null = null, comparables: CompResult | null = null, market: MarketContext | null = null, scenario: Scenario | null = null) {
  const notLoaded = (what: string) => `<p>${what} had not been opened in Map Inspection when this report was downloaded.</p>`;
  const body: Record<SectionId, () => string> = {
    overview: () => overviewHtml(detail, geometry),
    ownership: () => ownershipHtml(detail),
    sales: () => (detail && historyHtml(detail)) || "<p>The connected sources publish no sale, deed or permit history for this parcel.</p>",
    listings: () => "<p>No listing or lease source is connected. Listing data requires MLS or paid licenses, which this tool does not use.</p>",
    comparables: () => comparablesHtml(comparables) || notLoaded("Comparable sales"),
    market: () => marketHtml(market) || notLoaded("Market intelligence"),
    engineering: () => engineeringHtml(report, geometry),
    feasibility: () => feasibilityHtml(report, scenario),
  };
  // A section whose sources do not allow export says why instead of printing the data.
  const sections = INSPECTION_SECTIONS.map((section) => `<section class="part"><h2>${escape(sectionTitle(section.id))}</h2>${sectionAllowed(section.id, "export") ? body[section.id]() : `<p>Not included: ${escape(section.sources.map((id) => SOURCE_RIGHTS[id].basis).join("; "))}.</p>`}</section>`).join("");
  const exported = INSPECTION_SECTIONS.filter((section) => sectionAllowed(section.id, "export")).map((section) => section.id);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Parcel inspection - ${escape(heading.id)}</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#172333;max-width:900px;margin:36px auto;padding:0 24px}h1{margin-bottom:0}h2{font-size:20px;margin-top:30px;border-top:2px solid #dce8ed;padding-top:14px}h3{font-size:16px;margin-bottom:4px}small{font-size:11px;font-weight:400;color:#476676}section{border-top:1px solid #e3ebee;padding:10px 0}section section{break-inside:avoid}li{margin:8px 0;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #e3ebee;padding:4px 6px;text-align:left;vertical-align:top}a{color:#087389}footer{border-top:2px solid #dce8ed;margin-top:28px;padding-top:14px;color:#52616d}@media print{body{margin:0;max-width:none}a{color:inherit}}</style></head><body><h1>Land Intelligence parcel inspection</h1><p><b>${escape(heading.name)}</b><br>${escape(heading.locality)}<br>Parcel ID: ${escape(heading.id)}<br>Checked: ${escape(new Date(report.checkedAt).toLocaleString("en-US"))}<br>${link(heading.sourceUrl, "Parcel source record")}</p><p>Official records, calculated figures (marked “calculated”) and assumptions are labeled throughout.</p><ol>${INSPECTION_SECTIONS.map((section) => `<li>${escape(section.title)}</li>`).join("")}</ol>${sections}${rightsHtml(exported, market, detail, report)}<footer>Preliminary public GIS screening. An empty, unavailable, outside-coverage, or not-queried result is not proof of absence. Parcel lines are not legal boundaries. Verify conditions, utility alignments and depths, regulatory status, and design criteria with the responsible agency, utility owner, and qualified professional before design or excavation.</footer></body></html>`;
}

export function downloadParcelReport(report: ParcelInspectionReport, geometry: ParcelGeometry, heading: ParcelHeading, detail: ParcelDetail | null = null, comparables: CompResult | null = null, market: MarketContext | null = null, scenario: Scenario | null = null) {
  const html = parcelReportHtml(report, geometry, heading, detail, comparables, market, scenario);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `parcel-inspection-${heading.id.replace(/[^a-z0-9-]/gi, "-")}-${report.checkedAt.slice(0, 10)}.html`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
