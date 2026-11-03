// Deterministic property history built only from the connected public records. Client-safe (no server modules).
// Every derived value states how it was produced; nothing here is an appraisal, title opinion or tax bill.
import type { BoulderAccount, BoulderBuilding } from "./boulder-property";
import type { CountyAccountValue } from "./colorado-live";
import type { ParcelDetail, ParcelSale } from "./parcel-detail";
import type { RecordDateIssue } from "./record-date";

/** `market`: the source qualifies it as an arm's-length sale. `qualified_changed`: qualified, but the source excludes it from ratio studies. */
export type SaleStatus = "market" | "qualified_changed" | "non_market" | "pending" | "unknown";
export type SaleClass = { status: SaleStatus; label: string; comparable: boolean };

// Boulder County Assessor help manual (2/11/2026): "Qualified sales are deemed arms-length transactions where money is exchanged."
export function boulderSaleClass(code: string, price: number | null): SaleClass {
  const value = code.trim().toUpperCase();
  if (value === "Q") return { status: "market", label: "Qualified sale (county: arm's-length)", comparable: price != null && price > 0 };
  if (value === "U") return { status: "non_market", label: "Unqualified (county)", comparable: false };
  if (value === "P") return { status: "pending", label: "Pending county qualification", comparable: false };
  return { status: "unknown", label: value ? `County sale code ${value}` : "No county sale code", comparable: false };
}

// Florida DOR NAL/SDF user guide (2010, sale qualification codes for 2009 and later). Codes the guide does not define
// (DOR's 2019 list adds 06, 21 and 43) are shown as codes only, never guessed.
const FL_CODES: Record<string, [SaleStatus, string]> = {
  "01": ["market", "Qualified: deed examination"], "02": ["market", "Qualified: verified evidence"],
  "03": ["qualified_changed", "Qualified; property changed after sale"], "04": ["qualified_changed", "Qualified; legal characteristics changed after sale"], "05": ["qualified_changed", "Qualified; multi-parcel transaction"],
  "11": ["non_market", "Disqualified: corrective, quit claim or tax deed, or minimum/no doc stamps"], "12": ["non_market", "Disqualified: financial institution or deed in lieu of foreclosure"],
  "13": ["non_market", "Disqualified: cemetery lot"], "14": ["non_market", "Disqualified: reserved occupancy (life estate)"], "15": ["non_market", "Disqualified: consideration indeterminable"],
  "16": ["non_market", "Disqualified: partial interest"], "17": ["non_market", "Disqualified: religious, charitable or benevolent party"], "18": ["non_market", "Disqualified: government party"],
  "19": ["non_market", "Disqualified: trustee, executor, guardian or receiver"], "20": ["non_market", "Disqualified: utility company party"],
  "30": ["non_market", "Disqualified: affiliated parties"], "31": ["non_market", "Disqualified: trade or exchange"], "32": ["non_market", "Disqualified: abnormal contract-to-sale period"],
  "33": ["non_market", "Disqualified: incomplete common property"], "34": ["non_market", "Disqualified: payment of a prior contract"], "35": ["non_market", "Disqualified: non-typical personal property"],
  "36": ["non_market", "Disqualified: atypical costs of sale"], "37": ["non_market", "Disqualified: not exposed to the open market"], "38": ["non_market", "Disqualified: forced sale or duress"],
  "39": ["non_market", "Disqualified: price differs from doc stamps"], "40": ["non_market", "Disqualified: non-market financing or lease"], "41": ["non_market", "Disqualified: other (DOR approved)"],
  "42": ["non_market", "Disqualified: mortgage fraud notice"], "98": ["pending", "Pending: deed errors"], "99": ["pending", "Pending: sale within 90 days"],
};
export function floridaSaleClass(code: string, price: number | null): SaleClass {
  const value = code.trim().padStart(2, "0");
  const known = FL_CODES[value];
  if (!code.trim()) return { status: "unknown", label: "No DOR qualification code", comparable: false };
  if (!known) return { status: "unknown", label: `DOR transfer code ${value} (not defined in the reference guide)`, comparable: false };
  return { status: known[0], label: `${known[1]} (DOR ${value})`, comparable: known[0] === "market" && price != null && price > 0 };
}

export type EntityType = "individual" | "company" | "trust" | "government" | "organization";
export const ENTITY_LABELS: Record<EntityType, string> = { individual: "Individual(s)", company: "Company", trust: "Trust", government: "Government / public", organization: "Organization / association" };
/** Rule-based reading of an owner name. It never looks up people; it only reads words in the recorded name. */
export function ownerEntityType(name: string): EntityType {
  const n = ` ${name.toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ")} `;
  if (/ (CITY|TOWN|COUNTY|STATE|VILLAGE) OF | UNITED STATES | USA | SCHOOL DIST| HOUSING AUTHORITY | REGENTS | DEPARTMENT OF | METRO(POLITAN)? DIST| WATER DIST| FIRE (PROTECTION )?DIST/.test(n)) return "government";
  if (/ (LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|LP|LLP|LLLP|LTD|PLLC|PC|COMPANY) /.test(n)) return "company";
  if (/ (TRUST|TRUSTEE|TRUSTEES|TR|TRS|REVOCABLE|IRREVOCABLE) /.test(n)) return "trust";
  if (/ (CHURCH|ASSOCIATION|ASSN|HOA|FOUNDATION|SOCIETY|CONDOMINIUM|OWNERS|COOPERATIVE|MINISTRIES|PARISH|CLUB) /.test(n)) return "organization";
  if (/ (HOLDINGS|PROPERTIES|INVESTMENTS?|ENTERPRISES|GROUP|ASSOCIATES|PARTNERS|PARTNERSHIP|VENTURES|CAPITAL|DEVELOPMENT|REALTY|BANK) /.test(n)) return "company";
  return "individual";
}

export type HistorySale = SaleClass & {
  date: string; price: number | null; source: "county" | "state"; reference: string; account?: string; deedType?: string;
  dateIssue?: RecordDateIssue; recordedDate?: string; sharedAccount?: boolean; vacantAtSale?: boolean | null; multiParcel?: boolean; parties?: string;
};
export type PriceChange = { from: HistorySale; to: HistorySale; change: number; years: number; annualRate: number | null; permitsBetween: number };
export type PermitSummary = { total: number; dated: number; withheldDates: number; reportedValue: number; first: string; last: string; recent: number; recentSince: string; categories: { name: string; count: number }[]; latestNewConstruction: string };
export type BuildingSummary = { buildings: number; sections: number; finishedSqft: number | null; units: number | null; oldestYear: number | null; newestEffectiveYear: number | null; basementSqft: number | null; incomplete: number };
export type TaxEstimate = { account: string; taxYear: string; millLevy: number; low: number; high: number; assessed: number; assessedSchool: number | null };
export type OwnerEntry = { name: string; role: string; share: number | null; entity: EntityType; account?: string };
export type PropertyHistory = {
  sales: HistorySale[]; lastMarketSale: HistorySale | null; marketSales: number; priceChanges: PriceChange[];
  permits: PermitSummary | null; buildings: BuildingSummary | null; owners: OwnerEntry[]; taxes: TaxEstimate[]; asOf: string;
};

const time = (date: string) => { const t = Date.parse(date.length === 7 ? `${date}-15` : date.length === 4 ? `${date}-07-01` : date); return Number.isFinite(t) ? t : NaN; };
const newestFirst = (a: { date: string }, b: { date: string }) => (time(b.date) || 0) - (time(a.date) || 0);

function statewideSale(sale: ParcelSale): HistorySale {
  return { status: sale.status ?? "unknown", label: sale.statusLabel ?? "Qualification not reported by this feed", comparable: !!sale.comparable, date: sale.date, price: sale.price, source: sale.origin ?? "state", reference: sale.reference, vacantAtSale: sale.vacantAtSale, multiParcel: sale.multiParcel, deedType: sale.deedType, parties: sale.parties };
}

function countySales(accounts: BoulderAccount[]): HistorySale[] {
  return accounts.flatMap((account) => (account.sales ?? []).map((sale) => {
    const shared = (account.linkedParcelCount ?? 1) > 1;
    const cls = boulderSaleClass(sale.qualification, sale.price);
    // A deed on an account that spans several parcels cannot be priced against this parcel alone.
    return { ...cls, comparable: cls.comparable && !shared && !sale.dateIssue, date: sale.date, price: sale.price, source: "county" as const, reference: sale.reception, account: account.accountNo, deedType: sale.deedType, dateIssue: sale.dateIssue, recordedDate: sale.recordedDate, sharedAccount: shared };
  }));
}

/** Change between consecutive comparable sales of the same account (or the statewide record). Permits filed in between are counted, because improvements change what was sold. */
export function priceChanges(sales: HistorySale[], permitDates: { account?: string; date: string }[] = []): PriceChange[] {
  const groups = new Map<string, HistorySale[]>();
  for (const sale of sales.filter((item) => item.comparable && item.price && Number.isFinite(time(item.date)))) {
    const key = `${sale.source}:${sale.account ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), sale]);
  }
  const changes: PriceChange[] = [];
  for (const group of Array.from(groups.values())) {
    const ordered = [...group].sort((a, b) => time(a.date) - time(b.date));
    for (let i = 1; i < ordered.length; i++) {
      const [from, to] = [ordered[i - 1], ordered[i]];
      const years = (time(to.date) - time(from.date)) / (365.25 * 86_400_000);
      const permitsBetween = permitDates.filter((permit) => (!from.account || permit.account === from.account) && time(permit.date) > time(from.date) && time(permit.date) <= time(to.date)).length;
      changes.push({ from, to, change: to.price! - from.price!, years, annualRate: years >= 0.5 ? Math.pow(to.price! / from.price!, 1 / years) - 1 : null, permitsBetween });
    }
  }
  return changes.sort((a, b) => time(b.to.date) - time(a.to.date));
}

export function summarizePermits(accounts: BoulderAccount[], asOf: string): PermitSummary | null {
  const permits = accounts.flatMap((account) => account.permits ?? []);
  if (!permits.length) return null;
  const dated = permits.filter((permit) => !permit.dateIssue && /^\d{4}-\d{2}-\d{2}$/.test(permit.date)).sort(newestFirst);
  const since = `${Number(asOf.slice(0, 4)) - 5}${asOf.slice(4, 10)}`;
  const counts = new Map<string, number>();
  for (const permit of permits) { const name = permit.category || "Uncategorized"; counts.set(name, (counts.get(name) ?? 0) + 1); }
  return {
    total: permits.length, dated: dated.length, withheldDates: permits.filter((permit) => permit.dateIssue).length,
    reportedValue: permits.reduce((sum, permit) => sum + (permit.estimatedValue ?? 0), 0),
    first: dated.at(-1)?.date ?? "", last: dated[0]?.date ?? "", recent: dated.filter((permit) => permit.date >= since).length, recentSince: since,
    categories: Array.from(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    latestNewConstruction: dated.find((permit) => /NEW CONSTRUCTION/i.test(permit.category))?.date ?? "",
  };
}

const sumOrNull = (values: (number | null | undefined)[]) => { const kept = values.filter((value): value is number => value != null && value > 0); return kept.length ? kept.reduce((a, b) => a + b, 0) : null; };
export function summarizeBuildings(buildings: (BoulderBuilding & { account?: string })[]): BuildingSummary | null {
  if (!buildings.length) return null;
  const years = buildings.map((item) => item.yearBuilt).filter((value): value is number => value != null);
  const effective = buildings.map((item) => item.effectiveYear).filter((value): value is number => value != null);
  return {
    buildings: new Set(buildings.map((item) => `${item.account ?? ""}:${item.buildingNumber}`)).size, sections: buildings.length,
    finishedSqft: sumOrNull(buildings.map((item) => item.finishedSqft)), units: sumOrNull(buildings.map((item) => item.units)),
    oldestYear: years.length ? Math.min(...years) : null, newestEffectiveYear: effective.length ? Math.max(...effective) : null,
    basementSqft: sumOrNull(buildings.map((item) => item.basementSqft)), incomplete: buildings.filter((item) => item.percentComplete != null && item.percentComplete < 1).length,
  };
}

/** Assessed value × mill levy ÷ 1,000. Colorado residential school and non-school assessments differ, so the true bill lies between the two products, before credits or exemptions. */
export function estimateTax(account: BoulderAccount): TaxEstimate | null {
  const values = account.values, mills = account.millLevy;
  if (!values || values.assessedTotal == null || values.assessedTotal <= 0 || mills == null || mills <= 0) return null;
  const school = values.assessedSchool != null && values.assessedSchool > 0 ? values.assessedSchool : null;
  const [lowBase, highBase] = school == null ? [values.assessedTotal, values.assessedTotal] : [Math.min(values.assessedTotal, school), Math.max(values.assessedTotal, school)];
  return { account: account.accountNo, taxYear: values.taxYear, millLevy: mills, low: Math.round(lowBase * mills / 1000), high: Math.round(highBase * mills / 1000), assessed: values.assessedTotal, assessedSchool: school };
}

/** Live county values (Adams): assessed value × the county's total mill levy, the county's own definition of the tax base. */
export function estimateLiveTax(account: CountyAccountValue): TaxEstimate | null {
  if (account.assessedTotal == null || account.millLevy == null) return null;
  const tax = Math.round(account.assessedTotal * account.millLevy / 1000);
  return { account: account.account, taxYear: "", millLevy: account.millLevy, low: tax, high: tax, assessed: account.assessedTotal, assessedSchool: null };
}

export function propertyHistory(detail: ParcelDetail | null, today = new Date().toISOString().slice(0, 10)): PropertyHistory {
  const county = detail?.boulder?.status === "ready" ? detail.boulder.property : null;
  const accounts = county?.accounts ?? [];
  const asOf = county?.sourceDate?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) ? county.sourceDate.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4}).*$/, (_, m, d, y) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`) : today;
  const fromCounty = countySales(accounts);
  // The statewide layer repeats the county's latest deed; keep it only when no county row has the same date and price.
  const fromState = (detail?.sales ?? []).map(statewideSale).filter((sale) => !fromCounty.some((item) => item.date === sale.date && item.price === sale.price));
  const sales = [...fromCounty, ...fromState].sort(newestFirst);
  const permitDates = accounts.flatMap((account) => (account.permits ?? []).filter((permit) => !permit.dateIssue && permit.date).map((permit) => ({ account: account.accountNo, date: permit.date })));
  const market = sales.filter((sale) => sale.status === "market" && sale.price && !sale.dateIssue);
  const owners: OwnerEntry[] = accounts.length
    ? accounts.flatMap((account) => (account.ownerships?.length ? account.ownerships : (account.owners ?? []).map((name) => ({ name, role: "", share: null }))).map((owner) => ({ ...owner, entity: ownerEntityType(owner.name), account: account.accountNo })))
    : (detail?.owners ?? []).map((name) => ({ name, role: "", share: null, entity: ownerEntityType(name) }));
  return {
    sales, lastMarketSale: market[0] ?? null, marketSales: market.length, priceChanges: priceChanges(sales, permitDates),
    permits: summarizePermits(accounts, asOf), buildings: summarizeBuildings(accounts.flatMap((account) => (account.buildings ?? []).map((building) => ({ ...building, account: account.accountNo })))),
    owners, taxes: [...accounts.map(estimateTax), ...(detail?.countyLive?.accounts ?? []).map(estimateLiveTax)].filter((item): item is TaxEstimate => item != null), asOf,
  };
}
