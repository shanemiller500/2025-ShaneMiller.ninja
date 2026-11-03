// Investment scenarios: deterministic arithmetic on user inputs (prefilled from public records where available).
// Client-safe and pure. Nothing here is advice, an appraisal or a lender's quote; every output is a "what if".
import type { ParcelDetail } from "./parcel-detail";
import type { CompResult } from "./comps";
import type { MarketContext } from "./market-data";
import { propertyHistory } from "./property-history";

/** Monthly principal and interest on a fully amortizing fixed-rate loan. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number) {
  if (!(principal > 0) || !(years > 0)) return 0;
  const n = Math.round(years * 12), r = annualRatePct / 100 / 12;
  return r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
}

export type OwnershipInput = { price: number; downPct: number; ratePct: number; years: number; taxAnnual: number; insuranceAnnual: number; hoaMonthly: number };
export type OwnershipResult = { downPayment: number; loan: number; principalInterest: number; tax: number; insurance: number; hoa: number; monthlyTotal: number; totalInterest: number };

export function ownershipCost(input: OwnershipInput): OwnershipResult {
  const downPayment = Math.max(0, input.price) * clampPct(input.downPct);
  const loan = Math.max(0, input.price - downPayment);
  const principalInterest = monthlyPayment(loan, input.ratePct, input.years);
  const [tax, insurance, hoa] = [Math.max(0, input.taxAnnual) / 12, Math.max(0, input.insuranceAnnual) / 12, Math.max(0, input.hoaMonthly)];
  return { downPayment, loan, principalInterest, tax, insurance, hoa, monthlyTotal: principalInterest + tax + insurance + hoa, totalInterest: Math.max(0, principalInterest * Math.round(input.years * 12) - loan) };
}

export type RentalInput = {
  price: number; closingCostPct: number; downPct: number; ratePct: number; years: number;
  monthlyRent: number; vacancyPct: number; taxAnnual: number; insuranceAnnual: number;
  maintenancePct: number; managementPct: number; reservesPct: number; hoaMonthly: number;
};
export type RentalResult = {
  grossRent: number; vacancyLoss: number; effectiveIncome: number; operatingExpenses: number; noi: number;
  capRate: number | null; debtService: number; cashFlow: number; cashInvested: number; cashOnCash: number | null;
  dscr: number | null; breakEvenOccupancy: number | null; grossRentMultiplier: number | null;
};

/** Annual figures. Maintenance, management and reserves are shares of collected rent; vacancy is a share of scheduled rent. */
export function rentalAnalysis(input: RentalInput): RentalResult {
  const price = Math.max(0, input.price);
  const grossRent = Math.max(0, input.monthlyRent) * 12;
  const vacancyLoss = grossRent * clampPct(input.vacancyPct);
  const effectiveIncome = grossRent - vacancyLoss;
  const operatingExpenses = Math.max(0, input.taxAnnual) + Math.max(0, input.insuranceAnnual) + Math.max(0, input.hoaMonthly) * 12
    + effectiveIncome * (clampPct(input.maintenancePct) + clampPct(input.managementPct) + clampPct(input.reservesPct));
  const noi = effectiveIncome - operatingExpenses;
  const downPayment = price * clampPct(input.downPct);
  const debtService = monthlyPayment(price - downPayment, input.ratePct, input.years) * 12;
  const cashInvested = downPayment + price * clampPct(input.closingCostPct);
  const cashFlow = noi - debtService;
  return {
    grossRent, vacancyLoss, effectiveIncome, operatingExpenses, noi,
    capRate: price > 0 ? noi / price : null, debtService, cashFlow, cashInvested,
    cashOnCash: cashInvested > 0 ? cashFlow / cashInvested : null,
    dscr: debtService > 0 ? noi / debtService : null,
    breakEvenOccupancy: grossRent > 0 ? (operatingExpenses + debtService) / grossRent : null,
    grossRentMultiplier: grossRent > 0 ? price / grossRent : null,
  };
}

export type ResidualInput = { units: number; salePricePerUnit: number; buildingSqft: number; hardCostPerSqft: number; softCostPct: number; financingPct: number; saleCostPct: number; profitPct: number };
export type ResidualResult = { grossValue: number; saleCosts: number; hardCosts: number; softCosts: number; financing: number; profit: number; residualLandValue: number; perUnit: number | null };

/**
 * Residual land value = completed value − sale costs − hard − soft − financing − target profit.
 * Soft costs are a share of hard costs; financing a share of hard + soft; profit and sale costs shares of completed value.
 * A negative result means the scenario does not support any land price.
 */
export function residualLandValue(input: ResidualInput): ResidualResult {
  const units = Math.max(0, Math.round(input.units));
  const grossValue = units * Math.max(0, input.salePricePerUnit);
  const hardCosts = Math.max(0, input.buildingSqft) * Math.max(0, input.hardCostPerSqft);
  const softCosts = hardCosts * clampPct(input.softCostPct);
  const financing = (hardCosts + softCosts) * clampPct(input.financingPct);
  const saleCosts = grossValue * clampPct(input.saleCostPct);
  const profit = grossValue * clampPct(input.profitPct);
  const residualLandValue = grossValue - saleCosts - hardCosts - softCosts - financing - profit;
  return { grossValue, saleCosts, hardCosts, softCosts, financing, profit, residualLandValue, perUnit: units ? residualLandValue / units : null };
}

/** Every calculator input; one object drives all three scenarios. */
export type ScenarioInput = OwnershipInput & RentalInput & ResidualInput;
/** A scenario as the user left it, for the printable report. */
export type Scenario = { input: ScenarioInput; defaults: ScenarioDefaults; edited: boolean };

/** Percent input (0–100) as a fraction, clamped to [0, 1]. */
export function clampPct(pct: number) { return Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : 0; }

// ---------------------------------------------------------------------------------------------------------------------
// Prefilled inputs. Each default says where it came from; anything without a public source is labeled an assumption.

export type Default = { value: number; source: string; assumption: boolean };
export type ScenarioDefaults = Record<"price" | "ratePct" | "taxAnnual" | "insuranceAnnual" | "monthlyRent" | "buildingSqft" | "units", Default>;
const fromRecord = (value: number, source: string): Default => ({ value, source, assumption: false });
const assume = (value: number, source: string): Default => ({ value, source, assumption: true });

export function scenarioDefaults(detail: ParcelDetail | null, comps: CompResult | null, market: MarketContext | null): ScenarioDefaults {
  const county = detail?.boulder?.status === "ready" ? detail.boulder.property : null;
  const account = county?.accounts.length === 1 ? county.accounts[0] : null;
  const tractValue = market?.acs.tract?.medianValue;
  const price = comps?.estimate ? fromRecord(comps.estimate.value, "Comparable-sales midpoint (calculated)")
    : account?.values?.actualTotal ? fromRecord(account.values.actualTotal, "County actual value")
    : detail?.estimatedMarketValue ? fromRecord(detail.estimatedMarketValue, detail.valueLabels.market)
    : tractValue?.value && !tractValue.bound ? fromRecord(tractValue.value, "Tract median home value (ACS), not this parcel")
    : assume(0, "Enter a price");
  const rate = market?.rates.thirtyYear?.rate;
  const tax = propertyHistory(detail).taxes[0];
  const taxAnnual = tax ? fromRecord(tax.high, "Estimated tax: assessed value × mill levy (upper end, calculated)")
    : detail?.annualPropertyTax ? fromRecord(detail.annualPropertyTax, "Net property tax, statewide record")
    : assume(Math.round(price.value * 0.01), "Assumption: 1% of price per year");
  const bedrooms = account?.buildings.find((building) => building.bedrooms != null)?.bedrooms ?? null;
  const fmr = market?.fmr.status === "ready" ? market.fmr.data.rents.find((item) => item.bedrooms === Math.min(4, Math.max(0, bedrooms ?? 2))) : undefined;
  const acsRent = market?.acs.tract?.medianRent.value ?? market?.acs.county?.medianRent.value ?? null;
  const monthlyRent = fmr ? fromRecord(fmr.rent, `HUD Fair Market Rent, ${fmr.bedrooms === 0 ? "studio" : `${fmr.bedrooms} bedroom`}`)
    : acsRent ? fromRecord(acsRent, `${market?.acs.tract?.medianRent.value ? "Tract" : "County"} median gross rent (ACS, includes utilities)`)
    : assume(0, "Enter a monthly rent");
  const area = comps?.subject.basis === "building" ? comps.subject.units : detail?.livingAreaSqft ?? null;
  return {
    price,
    ratePct: rate != null ? fromRecord(rate, `Freddie Mac 30-year fixed, ${market?.rates.thirtyYear?.date}`) : assume(7, "Assumption: enter a current rate"),
    taxAnnual,
    insuranceAnnual: assume(Math.round(price.value * 0.005), "Assumption: 0.5% of price per year"),
    monthlyRent,
    buildingSqft: area ? fromRecord(area, comps?.subject.basis === "building" ? "County finished area" : "Statewide living area") : assume(2000, "Assumption: enter planned building area"),
    units: assume(1, "Assumption: planned units"),
  };
}
