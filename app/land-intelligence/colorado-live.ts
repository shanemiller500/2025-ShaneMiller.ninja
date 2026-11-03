// Colorado records queried live per parcel, so nothing is downloaded or stored: Denver sales and transfers, Adams County
// assessor values, Colorado business-entity filings and ECMC oil and gas wells. Licenses are in inspection-sections.ts.
// Server-side fetchers plus pure parsers (the parsers are unit tested).
import type { ParcelDetail, ParcelSale } from "./parcel-detail";

export const DENVER_SALES = "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_real_property_sales_and_transfers/FeatureServer/51";
export const ADAMS_VALUES = "https://services3.arcgis.com/4PNQOtAivErR7nbT/ArcGIS/rest/services/Property_Values/FeatureServer/0";
export const CO_ENTITIES = "https://data.colorado.gov/resource/4ykn-tg5h.json";
export const ECMC_WELLS = "https://gisdnr.state.co.us/arcgis/rest/services/ECMC_Public/Wells_Public_ECMC/MapServer";

/** ECMC well status codes, labeled as in ECMC's own map legend (Well Status layer, checked 2026-11-02). */
export const WELL_STATUS: Record<string, string> = {
  AC: "Active well", AL: "Abandoned location", AP: "Active permit", DG: "Drilling", EP: "Expired permit", IJ: "Injecting",
  PA: "Plugged and abandoned", PR: "Producing", SI: "Shut-in", SO: "Suspended operations", TA: "Temporarily abandoned", WO: "Waiting on completion",
};
export const wellStatus = (code: unknown) => WELL_STATUS[String(code ?? "").trim().toUpperCase()] ?? (code ? `Status ${String(code).trim()}` : "Status not reported");

/** Denver INSTRUMENT codes with a clear meaning; any other code is shown as published. */
const DENVER_INSTRUMENTS: Record<string, string> = { WD: "Warranty deed", SW: "Special warranty deed", QC: "Quitclaim deed", BS: "Bargain and sale deed", TR: "Trustee's deed", PR: "Personal representative's deed", PT: "Public trustee's deed" };
export const denverInstrument = (code: unknown) => { const key = String(code ?? "").trim().toUpperCase(); return DENVER_INSTRUMENTS[key] ?? (key ? `Instrument ${key}` : "Instrument not reported"); };

const text = (value: unknown) => value == null ? "" : String(value).trim();
const amount = (value: unknown) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; };

async function arcgisRows(url: string, where: string, outFields: string, signal?: AbortSignal, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ where, outFields, returnGeometry: "false", f: "json", ...extra });
  const response = await fetch(`${url}/query?${params}`, { signal: signal ?? AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json.error || !Array.isArray(json.features)) throw new Error("Unexpected response");
  return json.features.map((feature: { attributes: Record<string, unknown> }) => feature.attributes) as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Denver: Real Property Sales and Transfers (2010 to present). PARID is the statewide parcel_id without leading zeros.

/** SALE_YEAR + SALE_MONTHDAY (e.g. 2015 and 120 = 2015-01-20), else the reception date (YYYYMMDD). */
export function denverSaleDate(row: Record<string, unknown>) {
  const year = Number(row.SALE_YEAR), md = text(row.SALE_MONTHDAY).padStart(4, "0");
  const month = Number(md.slice(0, 2)), day = Number(md.slice(2));
  if (Number.isInteger(year) && year > 1850 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const reception = text(row.RECEPTION_DATE);
  return /^\d{8}$/.test(reception) ? `${reception.slice(0, 4)}-${reception.slice(4, 6)}-${reception.slice(6)}` : "";
}

/** Denver publishes no sale qualification, so every transfer is of unknown market character; unpriced ones are labeled non-market. */
export function denverSale(row: Record<string, unknown>): ParcelSale {
  const price = amount(row.SALE_PRICE);
  const priced = price != null && price > 100;
  const deed = denverInstrument(row.INSTRUMENT);
  const parties = [text(row.GRANTOR), text(row.GRANTEE)].some(Boolean) ? `${text(row.GRANTOR) || "seller not reported"} → ${text(row.GRANTEE) || "buyer not reported"}` : "";
  return {
    date: denverSaleDate(row), price: priced ? price : null, reference: text(row.RECEPTION_NUM), origin: "county", deedType: deed, parties,
    status: priced ? "unknown" : "non_market",
    statusLabel: priced ? `${deed} with a recorded price; Denver does not publish whether the sale was qualified` : `${deed}; no consideration recorded`,
    comparable: false,
  };
}

export async function denverSales(parcelId: string, signal?: AbortSignal): Promise<ParcelSale[]> {
  if (!/^\d{1,13}$/.test(parcelId) || !Number(parcelId)) return [];
  const rows = await arcgisRows(DENVER_SALES, `PARID=${Number(parcelId)}`, "RECEPTION_NUM,INSTRUMENT,SALE_YEAR,SALE_MONTHDAY,RECEPTION_DATE,SALE_PRICE,GRANTOR,GRANTEE", signal, { orderByFields: "RECEPTION_DATE DESC", resultRecordCount: "200" });
  return rows.map(denverSale);
}

// ---------------------------------------------------------------------------------------------------------------------
// Adams County: assessor property values (updated weekly). PARCELNB matches the statewide parcel_id.

export type CountyAccountValue = {
  account: string; type: string; actualLand: number | null; actualImprovements: number | null; actualTotal: number | null;
  assessedLand: number | null; assessedImprovements: number | null; assessedTotal: number | null;
  /** County definition: the total mills applied to the assessed value to determine the taxes. */
  millLevy: number | null; school: string; fire: string; lotSize: number | null; lotUnit: string; changed: string;
  /** Published but not defined in the county's field guide, so shown and never used in a calculation. */
  alternateAssessed: number | null; alternateMillLevy: number | null;
};

export function adamsAccount(row: Record<string, unknown>): CountyAccountValue {
  const changed = Number(row.DATECHG);
  return {
    account: text(row.ACCOUNTNO), type: text(row.ACCTTYPE), actualLand: amount(row.ACTLANDVAL), actualImprovements: amount(row.ACTIMPSVAL), actualTotal: amount(row.ACTTOTALVAL),
    assessedLand: amount(row.ASDLANDVAL), assessedImprovements: amount(row.ASDIMPSVAL), assessedTotal: amount(row.ASDTOTALVAL),
    millLevy: amount(row.MILLLEVY), school: text(row.SCHOOLNAME), fire: text(row.FIRENAME), lotSize: amount(row.LOTSIZE), lotUnit: text(row.LOTMEASURE),
    changed: Number.isFinite(changed) && changed > 0 ? new Date(changed).toISOString().slice(0, 10) : "",
    alternateAssessed: amount(row.ALTASDTOTALVAL), alternateMillLevy: amount(row.ALTMILLLEVY),
  };
}

export async function adamsValues(parcelId: string, signal?: AbortSignal): Promise<CountyAccountValue[]> {
  if (!/^\d{6,15}$/.test(parcelId)) return [];
  const rows = await arcgisRows(ADAMS_VALUES, `PARCELNB='${parcelId}'`, "ACCOUNTNO,ACCTTYPE,DATECHG,ACTLANDVAL,ACTIMPSVAL,ACTTOTALVAL,ASDLANDVAL,ASDIMPSVAL,ASDTOTALVAL,LOTSIZE,LOTMEASURE,FIRENAME,SCHOOLNAME,MILLLEVY,ALTASDTOTALVAL,ALTMILLLEVY", signal, { resultRecordCount: "50" });
  return rows.map(adamsAccount);
}

// ---------------------------------------------------------------------------------------------------------------------
// The live county record attached to a Colorado parcel detail.

export type CountyLive = {
  county: "Denver" | "Adams"; kind: "sales" | "values"; status: "ready" | "no_record" | "unavailable";
  source: string; sourceUrl: string; checkedAt: string; sales?: number; accounts?: CountyAccountValue[];
};

const sameSale = (a: ParcelSale, b: ParcelSale) => a.price === b.price && a.date.slice(0, 7) === b.date.slice(0, 7);

/** Denver transfers replace the statewide single last sale (kept only if Denver has no matching row); one Adams account fills the value fields. */
export function applyCountyLive(detail: ParcelDetail, live: { county: "Denver"; sales: ParcelSale[] } | { county: "Adams"; accounts: CountyAccountValue[] }) {
  if (live.county === "Denver") {
    detail.sales = [...live.sales, ...detail.sales.filter((sale) => !live.sales.some((item) => sameSale(item, sale)))];
    return;
  }
  const [only] = live.accounts.length === 1 ? live.accounts : [];
  if (!only) return;
  detail.assessedTotal = only.assessedTotal; detail.assessedLand = only.assessedLand; detail.assessedImprovements = only.assessedImprovements;
  if (only.actualTotal != null) detail.estimatedMarketValue = only.actualTotal;
  detail.valueLabels = { ...detail.valueLabels, total: "County assessed value", land: "Assessed land", improvements: "Assessed improvements", market: "County actual value" };
  detail.taxableValue = null;
  if (only.school) detail.schoolDistrict = only.school;
  detail.valueNote = "Values are the Adams County Assessor's current record (updated weekly). Actual value is the county's valuation, not a sale price; assessed value is the taxable portion.";
}

export async function coloradoCountyLive(detail: ParcelDetail, signal?: AbortSignal): Promise<CountyLive | undefined> {
  const county = detail.parcel.county.toLowerCase();
  const checkedAt = new Date().toISOString();
  if (county === "denver") {
    const base = { county: "Denver" as const, kind: "sales" as const, source: "City and County of Denver, Real Property Sales and Transfers", sourceUrl: "https://opendata-geospatialdenver.hub.arcgis.com/", checkedAt };
    try {
      const sales = await denverSales(detail.parcel.id, signal);
      applyCountyLive(detail, { county: "Denver", sales });
      return { ...base, status: sales.length ? "ready" : "no_record", sales: sales.length };
    } catch { return { ...base, status: "unavailable" }; }
  }
  if (county === "adams") {
    const base = { county: "Adams" as const, kind: "values" as const, source: "Adams County Assessor, Property Values", sourceUrl: "https://data-adcogov.opendata.arcgis.com/", checkedAt };
    try {
      const accounts = await adamsValues(detail.parcel.id, signal);
      applyCountyLive(detail, { county: "Adams", accounts });
      return { ...base, status: accounts.length ? "ready" : "no_record", accounts };
    } catch { return { ...base, status: "unavailable" }; }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// Colorado Department of State business entities (public domain). Owner names match filings only on the same name.

export type EntityMatch = { id: string; name: string; status: string; type: string; jurisdiction: string; formed: string; principalCity: string; principalState: string; url: string };

const SUFFIX = /\b(L\.?\s?L\.?\s?L?\.?\s?P|L\.?\s?L\.?\s?C|L\.?\s?L\.?\s?P|L\.?\s?P|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLLC|PC|TRUST)\.?$/;
/** Upper-case, drop punctuation and trailing entity-type words ("The Standard at Boulder, LLC" → "THE STANDARD AT BOULDER"). */
export function entityCore(name: string) {
  let core = name.toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) { const next = core.replace(SUFFIX, "").trim(); if (next === core) break; core = next; }
  return core;
}

export function entityMatches(owner: string, rows: Record<string, unknown>[]): EntityMatch[] {
  const target = entityCore(owner);
  if (target.length < 3) return [];
  return rows.filter((row) => entityCore(text(row.entityname)) === target)
    .map((row) => ({
      id: text(row.entityid), name: text(row.entityname), status: text(row.entitystatus), type: text(row.entitytype), jurisdiction: text(row.jurisdictonofformation),
      formed: text(row.entityformdate).slice(0, 10), principalCity: text(row.principalcity), principalState: text(row.principalstate),
      url: `https://www.coloradosos.gov/biz/BusinessEntityDetail.do?quitButtonDestination=BusinessEntityResults&nameTyp=ENT&masterFileId=${encodeURIComponent(text(row.entityid))}`,
    }))
    .sort((a, b) => Number(/good standing/i.test(b.status)) - Number(/good standing/i.test(a.status)))
    .slice(0, 3);
}

export async function coloradoEntities(owner: string, signal?: AbortSignal): Promise<EntityMatch[]> {
  const core = entityCore(owner);
  if (core.length < 3) return [];
  // Anchored on the first word (a leading wildcard scans the whole registry). "AND" is skipped because filings write "&".
  const pattern = core.split(" ").filter((word, index) => index === 0 || word !== "AND").join("%");
  const params = new URLSearchParams({ $where: `upper(entityname) like '${pattern}%'`, $limit: "25", $select: "entityid,entityname,entitystatus,entitytype,jurisdictonofformation,entityformdate,principalcity,principalstate" });
  const response = await fetch(`${CO_ENTITIES}?${params}`, { signal: signal ?? AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Unexpected response");
  return entityMatches(owner, rows);
}
