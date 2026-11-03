// Deterministic comparable-sales selection and a calculated value range. Client-safe and pure: the same inputs always
// give the same comps, the same order and the same numbers. No time, feature or location adjustment is applied.

export type CompBasis = "building" | "land";
/** One qualified, priced, single-parcel sale with the account's current comparison profile (boulder-import.mjs). */
export type CompRow = {
  folio: string; account: string; date: string; price: number; reception: string; deedType: string; siteAddress: string; city: string;
  neighborhood: string; subdivision: string; type: string; basis: CompBasis; units: number; landSqft: number | null;
  yearBuilt: number | null; effectiveYear: number | null; bedrooms: number | null; quality: string; point: [number, number] | null; changedAfterSale: boolean;
};
export type CompSubject = {
  folio: string; type: string; basis: CompBasis; units: number; yearBuilt: number | null; neighborhood: string; point: [number, number] | null;
};
export type SelectedComp = CompRow & { perUnit: number; distanceMiles: number | null; monthsAgo: number; sizeRatio: number; score: number; outlier: boolean };
export type CompTier = { id: 1 | 2 | 3; radiusMiles: number; months: number; sizeBand: number };
export type Confidence = "high" | "medium" | "low" | "insufficient";
export type CompResult = {
  subject: CompSubject; asOf: string; tier: CompTier | null; locationMethod: "distance" | "neighborhood";
  comps: SelectedComp[]; used: number; candidates: number;
  stats: { median: number; p25: number; p75: number; min: number; max: number; dispersion: number } | null;
  /** `calibrated`: low/high from a source backtest (about 8 in 10 sales inside); `comparable_spread`: the comps' middle half only. */
  estimate: { value: number; low: number; high: number; rangeBasis: "calibrated" | "comparable_spread"; coverage: number | null } | null;
  confidence: Confidence; reasons: string[];
};

/** price ÷ midpoint − 1 at the 10th and 90th percentile, by confidence, from a holdout backtest of one source. */
export type RangeCalibration = { source: string; checked: string; coverage: number; validated: Record<Exclude<Confidence, "insufficient">, number>; bands: Record<Exclude<Confidence, "insufficient">, [number, number]> };
// Boulder County, 2026-11-01: 5,741 qualified 2024–2026 sales valued from comparables sold before each sale. Bands fit
// on half (2,877) and checked on the other half (2,864): 79% / 78% / 76% of actual prices fell inside.
export const BOULDER_CALIBRATION: RangeCalibration = {
  source: "Boulder County Assessor qualified sales", checked: "2026-11-01", coverage: 0.8,
  validated: { high: 0.79, medium: 0.78, low: 0.76 },
  bands: { high: [-0.151, 0.211], medium: [-0.227, 0.394], low: [-0.367, 0.543] },
};

/** Widening steps: tier 1 is preferred; the first tier with at least MIN_PREFERRED comps is used. */
export const COMP_TIERS: CompTier[] = [
  { id: 1, radiusMiles: 1, months: 24, sizeBand: 0.3 },
  { id: 2, radiusMiles: 2, months: 36, sizeBand: 0.3 },
  { id: 3, radiusMiles: 3, months: 60, sizeBand: 0.5 },
];
export const MAX_COMPS = 10, MIN_PREFERRED = 5, MIN_ESTIMATE = 3;

const EARTH_MILES = 3958.7613;
export function milesBetween([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.sqrt(a));
}
export const monthsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (30.4375 * 86_400_000);

/** Linear-interpolated percentile of ascending values. */
export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return NaN;
  const index = (sorted.length - 1) * p, lower = Math.floor(index), upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** A size band of ±30% means the comp is between 1/1.3 and 1.3 times the subject (symmetric on a log scale). */
const withinSize = (ratio: number, band: number) => ratio >= 1 / (1 + band) && ratio <= 1 + band;

function candidatesFor(subject: CompSubject, rows: CompRow[], asOf: string, tier: CompTier, byDistance: boolean): SelectedComp[] {
  const latestPerAccount = new Map<string, SelectedComp>();
  for (const row of rows) {
    if (row.type !== subject.type || row.folio === subject.folio || !(row.units > 0) || !(row.price > 0)) continue;
    const monthsAgo = monthsBetween(row.date, asOf);
    if (!(monthsAgo >= 0) || monthsAgo > tier.months) continue;
    const sizeRatio = row.units / subject.units;
    if (!withinSize(sizeRatio, tier.sizeBand)) continue;
    const distanceMiles = subject.point && row.point ? milesBetween(subject.point, row.point) : null;
    if (byDistance ? distanceMiles == null || distanceMiles > tier.radiusMiles : !subject.neighborhood || row.neighborhood !== subject.neighborhood) continue;
    // Lower is closer: size difference, recency, distance (or a neighborhood match), age difference, later changes.
    const score = Math.abs(Math.log(sizeRatio)) * 2 + monthsAgo / 24 + (distanceMiles ?? 0)
      + (subject.yearBuilt && row.yearBuilt ? Math.abs(subject.yearBuilt - row.yearBuilt) / 30 : 0.25) + (row.changedAfterSale ? 0.5 : 0)
      + (byDistance && row.neighborhood !== subject.neighborhood ? 0.25 : 0);
    const comp: SelectedComp = { ...row, perUnit: row.price / row.units, distanceMiles, monthsAgo, sizeRatio, score, outlier: false };
    // A property that sold twice counts once: its latest qualified sale.
    const previous = latestPerAccount.get(row.account);
    if (!previous || previous.date < comp.date) latestPerAccount.set(row.account, comp);
  }
  // Deterministic order: score, then most recent, then folio.
  return Array.from(latestPerAccount.values()).sort((a, b) => a.score - b.score || b.date.localeCompare(a.date) || a.folio.localeCompare(b.folio));
}

export function selectComparables(subject: CompSubject, rows: CompRow[], asOf: string, calibration: RangeCalibration | null = null): CompResult {
  const reasons: string[] = [];
  const byDistance = !!subject.point;
  const base = { subject, asOf, locationMethod: byDistance ? "distance" as const : "neighborhood" as const };
  if (!(subject.units > 0)) return { ...base, tier: null, comps: [], used: 0, candidates: 0, stats: null, estimate: null, confidence: "insufficient", reasons: [subject.basis === "land" ? "No county GIS land area for this account." : "No finished building area for this account."] };
  if (!byDistance) reasons.push("No parcel location; comparables are limited to the same county appraisal neighborhood.");
  let chosen: { tier: CompTier; comps: SelectedComp[] } | null = null;
  for (const tier of COMP_TIERS) {
    const comps = candidatesFor(subject, rows, asOf, tier, byDistance);
    chosen = { tier, comps };
    if (comps.length >= MIN_PREFERRED) break;
  }
  const tier = chosen!.tier, candidates = chosen!.comps.length;
  const comps = chosen!.comps.slice(0, MAX_COMPS);
  if (tier.id > 1) reasons.push(`Search widened to ${tier.radiusMiles} mi, ${tier.months} months and ±${Math.round(tier.sizeBand * 100)}% size to find comparables.`);
  // Tukey fences (1.5 × IQR) on $/unit, only with enough comps to define a spread; outliers are shown but not used.
  const values = comps.map((comp) => comp.perUnit).sort((a, b) => a - b);
  if (values.length >= MIN_PREFERRED) {
    const [q1, q3] = [percentile(values, 0.25), percentile(values, 0.75)], iqr = q3 - q1;
    for (const comp of comps) comp.outlier = comp.perUnit < q1 - 1.5 * iqr || comp.perUnit > q3 + 1.5 * iqr;
  }
  const used = comps.filter((comp) => !comp.outlier).map((comp) => comp.perUnit).sort((a, b) => a - b);
  if (comps.some((comp) => comp.outlier)) reasons.push(`${comps.filter((comp) => comp.outlier).length} comparable(s) outside 1.5× the interquartile range were excluded from the figures.`);
  if (comps.some((comp) => comp.changedAfterSale)) reasons.push("Some comparables had new construction, additions or demolition permitted after their sale; today's record may differ from what sold.");
  if (used.length < MIN_ESTIMATE) return { ...base, tier, comps, used: used.length, candidates, stats: null, estimate: null, confidence: "insufficient", reasons: [...reasons, `Fewer than ${MIN_ESTIMATE} usable comparables; no value range is calculated.`] };
  const median = percentile(used, 0.5), p25 = percentile(used, 0.25), p75 = percentile(used, 0.75);
  const dispersion = (p75 - p25) / median;
  const round = (value: number) => Math.round(value / 1000) * 1000;
  const confidence: Confidence = used.length >= 8 && tier.id === 1 && dispersion <= 0.25 ? "high" : used.length >= MIN_PREFERRED && dispersion <= 0.4 ? "medium" : "low";
  const value = round(subject.units * median);
  const band = calibration?.bands[confidence];
  return {
    ...base, tier, comps, used: used.length, candidates,
    stats: { median, p25, p75, min: used[0], max: used[used.length - 1], dispersion },
    estimate: band
      ? { value, low: round(value * (1 + band[0])), high: round(value * (1 + band[1])), rangeBasis: "calibrated", coverage: calibration!.validated[confidence] }
      : { value, low: round(subject.units * p25), high: round(subject.units * p75), rangeBasis: "comparable_spread", coverage: null },
    confidence, reasons,
  };
}
