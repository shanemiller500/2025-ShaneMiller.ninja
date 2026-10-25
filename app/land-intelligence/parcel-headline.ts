import type { ParcelDetail } from "./parcel-detail";

export type ParcelHeadline = {
  owner: string;
  ownerNote: string;
  price: number | null;
  priceDate: string;
  priceLabel: string;
  priceNote: string;
  value: number | null;
  valueLabel: string;
};

/** Keep deed consideration, assessor value and listing price distinct. */
export function parcelHeadline(detail: ParcelDetail | null): ParcelHeadline {
  const county = detail?.boulder?.status === "ready" ? detail.boulder.property : null;
  const accounts = county?.accounts ?? [];
  const owners = Array.from(new Set(accounts.flatMap((account) => account.owners).filter(Boolean)));
  const countySales = accounts.flatMap((account) => account.sales.map((sale) => ({ ...sale, account: account.accountNo, shared: (account.linkedParcelCount ?? 1) > 1 })));
  const pricedCounty = countySales.filter((sale) => sale.price != null && sale.price > 0).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))[0];
  const statewideSale = detail?.sales.filter((sale) => sale.price != null && sale.price > 0).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))[0];
  const useStatewidePrice = accounts.length > 1 && !!statewideSale;
  const selectedCountySale = useStatewidePrice ? null : pricedCounty;
  const preferStateOwner = accounts.length > 1 && !!detail?.owners.length;
  const displayOwners = preferStateOwner ? detail!.owners : owners.length ? owners : detail?.owners ?? [];
  const value = accounts.length === 1 ? accounts[0].values?.actualTotal ?? null : detail?.estimatedMarketValue ?? detail?.assessedTotal ?? null;
  return {
    owner: displayOwners.length ? displayOwners.slice(0, 2).join(" · ") : "Not reported by this source",
    ownerNote: displayOwners.length > 2 ? `${displayOwners.length} names reported; see ownership records` : preferStateOwner ? "Statewide parcel owner; verify current title" : accounts.length > 1 ? `From ${accounts.length} linked assessor accounts; verify current title` : "Reported owner; verify current title",
    price: selectedCountySale?.price ?? statewideSale?.price ?? null,
    priceDate: selectedCountySale?.date ?? statewideSale?.date ?? "",
    priceLabel: selectedCountySale ? "Recorded deed price" : "Last reported sale price",
    priceNote: selectedCountySale ? `Assessor account ${selectedCountySale.account}${selectedCountySale.shared ? " links to multiple parcels" : ""}; deed may be a non-market transfer` : statewideSale ? "Statewide parcel field; may be a non-market transfer" : "No price in the connected parcel or assessor records",
    value,
    valueLabel: accounts.length === 1 && accounts[0].values?.actualTotal != null ? "County appraised value" : detail?.estimatedMarketValue != null ? "Estimated market value" : "Assessed/appraised value",
  };
}
