// The unified property inspection: one section list, source rights and jurisdiction coverage shared by Map Inspection
// and the printable report, so the screen and the printout always show the same sections in the same order.
// Client-safe and pure.
import { parcelDisciplineSummary } from "./parcel-analysis";
import type { ParcelInspectionReport } from "./parcel-inspection";

export type SectionId = "overview" | "ownership" | "sales" | "listings" | "comparables" | "market" | "engineering" | "feasibility";
export type InspectionSection = { id: SectionId; title: string; summary: string; sources: SourceId[]; lazy: boolean };

export const INSPECTION_SECTIONS: InspectionSection[] = [
  { id: "overview", title: "Property overview", summary: "Parcel, address, land use, mapped area and what records exist here", sources: ["statewide-parcels"], lazy: false },
  { id: "ownership", title: "Ownership and legal", summary: "Owners, legal description, assessor accounts and values", sources: ["statewide-parcels", "boulder-assessor", "adams-values", "co-entities"], lazy: false },
  { id: "sales", title: "Sales history", summary: "Recorded sales and deeds with qualification, permits and tax estimate", sources: ["statewide-parcels", "boulder-assessor", "denver-sales", "adams-values"], lazy: false },
  { id: "listings", title: "Listings and leases", summary: "No free licensed listing source", sources: ["listings"], lazy: false },
  { id: "comparables", title: "Comparables and valuation", summary: "Qualified nearby sales and a backtested value range; recent recorded sales elsewhere in Colorado", sources: ["boulder-assessor", "denver-sales", "statewide-parcels"], lazy: true },
  { id: "market", title: "Market intelligence", summary: "Census housing, FHFA prices, permits, rates and rents", sources: ["census-acs", "fhfa-hpi", "census-bps", "fred-pmms", "hud-fmr"], lazy: true },
  { id: "engineering", title: "Land and engineering research", summary: "Mapped public records across 12 subject areas", sources: ["federal-gis", "ecmc-wells"], lazy: false },
  { id: "feasibility", title: "Development feasibility", summary: "Zoning, mapped constraints and scenario calculators", sources: ["zoning", "user-input"], lazy: true },
];

export const sectionNumber = (id: SectionId) => INSPECTION_SECTIONS.findIndex((section) => section.id === id) + 1;
export const sectionTitle = (id: SectionId) => `${sectionNumber(id)}. ${INSPECTION_SECTIONS.find((section) => section.id === id)!.title}`;

// ---------------------------------------------------------------------------------------------------------------------
// Rights. A section is displayed or exported only when every source it draws on allows it. Data whose rights are
// unresolved (Boulder) is withheld by the server, so it never reaches the client unless publication is approved.

export type SourceId = "statewide-parcels" | "boulder-assessor" | "denver-sales" | "adams-values" | "co-entities" | "ecmc-wells" | "listings" | "census-acs" | "fhfa-hpi" | "census-bps" | "fred-pmms" | "hud-fmr" | "federal-gis" | "zoning" | "user-input";
export type SourceRights = { label: string; basis: string; display: boolean; export: boolean; attribution?: string; reviewed: string };

export const SOURCE_RIGHTS: Record<SourceId, SourceRights> = {
  "statewide-parcels": { label: "Statewide public parcel services (CO, UT, WA, FL, NC, WI)", basis: "Public records published by each state for public use", display: true, export: true, reviewed: "2026-11-01" },
  "boulder-assessor": { label: "Boulder County Assessor files", basis: "Republication not yet confirmed by the county: served only where approved (LAND_BOULDER_DATA_APPROVED)", display: true, export: true, reviewed: "2026-11-01" },
  "denver-sales": { label: "City and County of Denver, Real Property Sales and Transfers", basis: "Denver Open Data Catalog, CC BY 3.0 (per the city's GIS page); queried live per parcel", display: true, export: true, attribution: "Contains information from the City and County of Denver Open Data Catalog, licensed under CC BY 3.0.", reviewed: "2026-11-02" },
  "adams-values": { label: "Adams County Assessor, Property Values", basis: "Adams County open data, CC BY 4.0 (stated on the dataset); queried live per parcel", display: true, export: true, attribution: "Contains Adams County Assessor data, licensed under CC BY 4.0.", reviewed: "2026-11-02" },
  "co-entities": { label: "Colorado Department of State, Business Entities", basis: "Colorado Information Marketplace, public domain (stated on the dataset); queried live by owner name", display: true, export: true, attribution: "Business filings: Colorado Department of State.", reviewed: "2026-11-02" },
  "ecmc-wells": { label: "Colorado Energy and Carbon Management Commission well locations", basis: "Public state records published by ECMC; no license restriction stated; queried live", display: true, export: true, attribution: "Well data: Colorado Energy and Carbon Management Commission (ECMC).", reviewed: "2026-11-02" },
  listings: { label: "Sale and rental listings", basis: "MLS and listing feeds require paid or brokerage licenses; none is connected", display: false, export: false, reviewed: "2026-11-01" },
  "census-acs": { label: "U.S. Census Bureau, American Community Survey", basis: "Public domain (U.S. government work)", display: true, export: true, reviewed: "2026-11-02" },
  "fhfa-hpi": { label: "FHFA House Price Index", basis: "Public domain (U.S. government work)", display: true, export: true, reviewed: "2026-11-02" },
  "census-bps": { label: "U.S. Census Bureau, Building Permits Survey", basis: "Public domain (U.S. government work)", display: true, export: true, reviewed: "2026-11-02" },
  "fred-pmms": { label: "Freddie Mac Primary Mortgage Market Survey via FRED", basis: "Freddie Mac permits use with attribution", display: true, export: true, attribution: "Source: Freddie Mac, Primary Mortgage Market Survey, retrieved from FRED, Federal Reserve Bank of St. Louis.", reviewed: "2026-11-02" },
  "hud-fmr": { label: "HUD Fair Market Rents", basis: "Public data through the HUD USER API (free token)", display: true, export: true, attribution: "This product uses the HUD User Data API but is not endorsed or certified by HUD User.", reviewed: "2026-11-02" },
  "federal-gis": { label: "Federal, state and local public GIS services", basis: "Public records; each source record links to its provider", display: true, export: true, reviewed: "2026-11-01" },
  zoning: { label: "Municipal and county zoning services", basis: "Public records; official code links are marked", display: true, export: true, reviewed: "2026-11-01" },
  "user-input": { label: "Scenario inputs entered in the calculator", basis: "User-supplied assumptions with public-record defaults", display: true, export: true, reviewed: "2026-11-02" },
};

/** Whether every source behind a section allows the given use. */
export function sectionAllowed(id: SectionId, use: "display" | "export") {
  return INSPECTION_SECTIONS.find((section) => section.id === id)!.sources.every((source) => SOURCE_RIGHTS[source][use]);
}

// ---------------------------------------------------------------------------------------------------------------------
// Jurisdiction coverage: which record families the connected free sources supply, so an empty section reads as
// "not published here" rather than "nothing exists".

export type CoverageLevel = "yes" | "partial" | "no";
export type CoverageFamily = "owner" | "value" | "salePrice" | "buildings" | "tax" | "legal" | "countyDetail" | "comparables" | "market" | "wells";
export const COVERAGE_FAMILIES: Record<CoverageFamily, string> = {
  owner: "Owner of record", value: "Assessor value", salePrice: "Sale prices", buildings: "Building facts", tax: "Property tax",
  legal: "Legal description", countyDetail: "County assessor detail", comparables: "Comparable sales", market: "Market statistics", wells: "Oil and gas wells",
};
type StateCoverage = Record<Exclude<CoverageFamily, "countyDetail" | "comparables" | "market" | "wells">, [CoverageLevel, string]>;

// From the field maps in parcel-sources.ts and parcel-detail.ts (checked against live records, Phases 1–5).
const STATE_COVERAGE: Record<string, StateCoverage> = {
  Colorado: { owner: ["yes", "Statewide parcel owner"], value: ["yes", "County actual value"], salePrice: ["partial", "Last sale only, unqualified"], buildings: ["no", "Not in the statewide file"], tax: ["partial", "Statewide taxable value, not the bill"], legal: ["yes", "Legal description"] },
  Utah: { owner: ["partial", "Owner type only"], value: ["no", "Not published statewide"], salePrice: ["no", "Utah does not disclose sale prices"], buildings: ["no", "Not published statewide"], tax: ["no", "Not published statewide"], legal: ["no", "Not published statewide"] },
  Washington: { owner: ["no", "Not published statewide"], value: ["yes", "Market land and building value"], salePrice: ["no", "Not published statewide"], buildings: ["no", "Not published statewide"], tax: ["no", "Not published statewide"], legal: ["no", "Not published statewide"] },
  Florida: { owner: ["yes", "DOR tax roll owner"], value: ["yes", "Just, assessed and taxable value"], salePrice: ["yes", "Two most recent sales with DOR qualification"], buildings: ["yes", "Year built, living area, quality"], tax: ["partial", "Taxable value, not the bill"], legal: ["yes", "Short legal description"] },
  "North Carolina": { owner: ["yes", "NC OneMap owner"], value: ["yes", "Assessed parcel value"], salePrice: ["partial", "Sale date only, no price"], buildings: ["partial", "Structure count and year"], tax: ["no", "Not published statewide"], legal: ["yes", "Legal description"] },
  Wisconsin: { owner: ["yes", "Statewide parcel owner"], value: ["yes", "Total assessed value (fair market estimate can omit land)"], salePrice: ["no", "Not published statewide"], buildings: ["no", "Not published statewide"], tax: ["yes", "Net property tax"], legal: ["no", "Not published statewide"] },
};

export type CoverageRow = { family: CoverageFamily; label: string; level: CoverageLevel; note: string };

/** Coverage for a parcel's jurisdiction. `countyStatus` is the Boulder snapshot status for Colorado parcels. */
export function coverageProfile(state: string, county: string, countyStatus?: string): CoverageRow[] {
  const statewide = STATE_COVERAGE[state];
  if (!statewide) return [];
  const boulder = state === "Colorado" && county.toLowerCase() === "boulder";
  const countyReady = boulder && countyStatus === "ready";
  const live = state === "Colorado" ? county.toLowerCase() : "";
  const rows: [CoverageFamily, CoverageLevel, string][] = (Object.keys(statewide) as (keyof StateCoverage)[]).map((family) => [family, ...statewide[family]]);
  if (countyReady) for (const row of rows) if (["salePrice", "buildings", "tax"].includes(row[0])) {
    row[1] = "yes";
    row[2] = row[0] === "salePrice" ? "County deeds with qualification" : row[0] === "buildings" ? "County building records" : "Estimated from assessed value and mill levy";
  }
  // Live county records (colorado-live.ts).
  for (const row of rows) {
    if (live === "denver" && row[0] === "salePrice") { row[1] = "yes"; row[2] = "Denver sales and transfers since 2010, unqualified (live)"; }
    if (live === "adams" && row[0] === "value") { row[1] = "yes"; row[2] = "County actual and assessed value, weekly (live)"; }
    if (live === "adams" && row[0] === "tax") { row[1] = "yes"; row[2] = "Estimated from assessed value × county mill levy (live)"; }
  }
  rows.push(
    ["countyDetail", countyReady ? "yes" : live === "adams" || live === "denver" ? "partial" : "no", countyReady ? "Accounts, buildings, deeds, permits" : live === "adams" ? "Assessor accounts, mill levy, school and fire district (live)" : live === "denver" ? "County sales and transfers (live)" : boulder ? (countyStatus === "rights_pending" ? "Withheld until the county confirms rights" : "County snapshot not loaded") : "Not connected for this county"],
    ["comparables", countyReady ? "yes" : "no", countyReady ? "Qualified county sales" : "Needs county sale records"],
    ["market", "yes", "Census, FHFA, permits and rates nationwide"],
  );
  if (state === "Colorado") rows.push(["wells", "yes", "ECMC well locations and status statewide (live)"]);
  return rows.map(([family, level, note]) => ({ family, label: COVERAGE_FAMILIES[family], level, note }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Development feasibility: the mapped records that touch the parcel, by subject area. A count is not a risk score, and
// sources that did not answer are listed so a short list never reads as a clean site.

export type ConstraintRow = { id: string; label: string; onParcel: number; nearby: number; names: string[] };
export type ConstraintRollup = { rows: ConstraintRow[]; unchecked: string[] };

export function constraintRollup(report: ParcelInspectionReport | null): ConstraintRollup | null {
  if (!report) return null;
  const rows: ConstraintRow[] = [], unchecked: string[] = [];
  for (const discipline of parcelDisciplineSummary(report)) {
    if (discipline.property) continue;
    const findings = discipline.groups.flatMap((group) => group.findings);
    const touching = findings.filter((finding) => finding.relationship !== "nearby");
    if (findings.length) rows.push({ id: discipline.id, label: discipline.label, onParcel: touching.length, nearby: findings.length - touching.length, names: Array.from(new Set(touching.map((finding) => finding.name))).slice(0, 3) });
    for (const group of discipline.groups) if (["unavailable", "source_error", "partial", "not_queried", "coverage_unknown"].includes(group.status)) unchecked.push(group.label);
  }
  rows.sort((a, b) => b.onParcel - a.onParcel || b.nearby - a.nearby);
  return { rows, unchecked };
}
