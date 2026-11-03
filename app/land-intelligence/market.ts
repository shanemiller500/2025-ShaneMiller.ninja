// Market context arithmetic on official federal estimates. Client-safe and pure. Published estimates keep their margins
// of error; derived figures (shares, changes, ratios) are labeled calculated and use the Census ACS handbook formulas.

export type AcsPair = [number | null, number | null];
export type AcsRaw = Partial<Record<AcsMetric, AcsPair>>;
export type AcsMetric = "population" | "medianIncome" | "housingUnits" | "occupied" | "vacant" | "owner" | "renter" | "medianYearBuilt" | "medianRent" | "rentBurden" | "medianValue" | "povertyUniverse" | "belowPoverty";
export type Reliability = "good" | "caution" | "low" | "unknown";
export type Estimate = { value: number | null; moe: number | null; reliability: Reliability; bound?: "at_least" | "at_most" };
export type AcsProfile = {
  population: Estimate; medianIncome: Estimate; housingUnits: Estimate; medianYearBuilt: Estimate; medianRent: Estimate; rentBurden: Estimate; medianValue: Estimate;
  vacancyRate: Estimate; renterShare: Estimate; povertyRate: Estimate; priceToIncome: number | null;
};
export type HpiChange = { latest: string; index: number; oneYear: number | null; fiveYear: number | null; standardError?: number | null };
export type PermitSummary = { latestYear: number; latestUnits: number; previousUnits: number | null; fiveYearAverage: number | null; perThousandHomes: number | null; multifamilyShare: number | null; series: { year: number; units: number }[] };

// Top- and bottom-coded ACS 2024 medians (the published table shows "2,000,000+", "3,500+", "250,000+", "50.0+", "1939 or earlier").
const BOUNDS: Partial<Record<AcsMetric, [number, "at_least" | "at_most"]>> = {
  medianValue: [2000001, "at_least"], medianRent: [3501, "at_least"], medianIncome: [250001, "at_least"], rentBurden: [50.1, "at_least"], medianYearBuilt: [1939, "at_most"],
};

/** Coefficient of variation from a 90% margin: ≤15% good, ≤30% use with caution, above that low reliability. */
export function reliability(value: number | null, moe: number | null): Reliability {
  if (value == null || moe == null || value <= 0) return "unknown";
  const cv = moe / 1.645 / value;
  return cv <= 0.15 ? "good" : cv <= 0.3 ? "caution" : "low";
}

export function estimate(metric: AcsMetric, pair: AcsPair | undefined): Estimate {
  const [value, moe] = pair ?? [null, null];
  const bound = BOUNDS[metric];
  return { value, moe, reliability: reliability(value, moe), ...(bound && value === bound[0] ? { bound: bound[1] } : {}) };
}

/** Share x/y with the ACS proportion margin; falls back to the ratio formula when the proportion radicand is negative. */
export function proportion(x: AcsPair | undefined, y: AcsPair | undefined): Estimate {
  const [xv, xm] = x ?? [null, null], [yv, ym] = y ?? [null, null];
  if (xv == null || yv == null || yv <= 0) return { value: null, moe: null, reliability: "unknown" };
  const p = xv / yv;
  if (xm == null || ym == null) return { value: p, moe: null, reliability: "unknown" };
  const radicand = xm ** 2 - p ** 2 * ym ** 2;
  const moe = Math.sqrt(radicand >= 0 ? radicand : xm ** 2 + p ** 2 * ym ** 2) / yv;
  return { value: p, moe, reliability: reliability(p, moe) };
}

export function acsProfile(raw: AcsRaw | undefined): AcsProfile | null {
  if (!raw || !Object.keys(raw).length) return null;
  const value = estimate("medianValue", raw.medianValue), income = estimate("medianIncome", raw.medianIncome);
  const occupied: AcsPair = [(raw.owner?.[0] ?? null) != null && raw.renter?.[0] != null ? raw.owner![0]! + raw.renter![0]! : null, raw.occupied?.[1] ?? null];
  return {
    population: estimate("population", raw.population), medianIncome: income, housingUnits: estimate("housingUnits", raw.housingUnits),
    medianYearBuilt: estimate("medianYearBuilt", raw.medianYearBuilt), medianRent: estimate("medianRent", raw.medianRent), rentBurden: estimate("rentBurden", raw.rentBurden), medianValue: value,
    vacancyRate: proportion(raw.vacant, raw.housingUnits), renterShare: proportion(raw.renter, occupied), povertyRate: proportion(raw.belowPoverty, raw.povertyUniverse),
    // Ratio of two medians; meaningless when either is top-coded.
    priceToIncome: value.value && income.value && !value.bound && !income.bound ? value.value / income.value : null,
  };
}

/** Annual tract index: latest non-null year within the last three published years, compared with 1 and 5 years earlier. */
export function tractChange(hpi: { first: number; values: (number | null)[] } | undefined): HpiChange | null {
  if (!hpi) return null;
  const lastIndex = hpi.values.length - 1;
  for (let i = lastIndex; i >= Math.max(0, lastIndex - 2); i--) {
    const index = hpi.values[i];
    if (index == null) continue;
    const back = (years: number) => { const earlier = hpi.values[i - years]; return earlier ? index / earlier - 1 : null; };
    return { latest: String(hpi.first + i), index, oneYear: back(1), fiveYear: back(5) };
  }
  return null;
}

/** Quarterly index: latest quarter, compared with 4 and 20 quarters earlier. */
export function quarterlyChange(series: { last: string; index: (number | null)[]; se?: (number | null)[] } | undefined): HpiChange | null {
  if (!series?.index.length) return null;
  const last = series.index.length - 1, index = series.index[last];
  if (index == null) return null;
  const back = (quarters: number) => { const earlier = series.index[last - quarters]; return earlier ? index / earlier - 1 : null; };
  return { latest: series.last, index, oneYear: back(4), fiveYear: back(20), standardError: series.se?.[last] ?? null };
}

export function permitSummary(permits: { year: number; units: number; single: number; twoToFour: number; fivePlus: number }[] | undefined, housingUnits: number | null): PermitSummary | null {
  if (!permits?.length) return null;
  const sorted = [...permits].sort((a, b) => a.year - b.year), latest = sorted.at(-1)!;
  const lastFive = sorted.slice(-5);
  return {
    latestYear: latest.year, latestUnits: latest.units, previousUnits: sorted.at(-2)?.units ?? null,
    fiveYearAverage: lastFive.length === 5 ? lastFive.reduce((sum, item) => sum + item.units, 0) / 5 : null,
    perThousandHomes: housingUnits ? (latest.units / housingUnits) * 1000 : null,
    multifamilyShare: latest.units ? (latest.twoToFour + latest.fivePlus) / latest.units : null,
    series: sorted.map(({ year, units }) => ({ year, units })),
  };
}
