import { PARCEL_SOURCES, normalizeParcel, type ParcelRecord, type ParcelSource } from "./parcel-sources";
import type { BoulderLookup } from "./boulder-property";
import type { CountyLive } from "./colorado-live";
import { validParcelGeometry, type ParcelGeometry } from "./parcel-inspection";
import { floridaSaleClass, type SaleStatus } from "./property-history";

/** `status`/`comparable` only when the source publishes a qualification; otherwise the sale is of unknown market character. */
export type ParcelSale = {
  date: string; price: number | null; reference: string; status?: SaleStatus; statusLabel?: string; comparable?: boolean; vacantAtSale?: boolean | null; multiParcel?: boolean;
  /** "county" when the row comes from a county sales record (queried live) rather than the statewide layer. */
  origin?: "county"; deedType?: string; /** Seller → buyer as recorded. */ parties?: string;
};
export type ParcelDetail = {
  parcel: ParcelRecord;
  boulder?: BoulderLookup;
  /** A county record queried live for this parcel (Denver sales, Adams values). */
  countyLive?: CountyLive;
  owners: string[];
  sales: ParcelSale[];
  assessedTotal: number | null;
  assessedLand: number | null;
  assessedImprovements: number | null;
  taxableValue: number | null;
  estimatedMarketValue: number | null;
  annualPropertyTax: number | null;
  valueYear: string;
  legalDescription: string;
  accountNumber?: string;
  subdivision?: string;
  block?: string;
  lot?: string;
  yearBuilt: number | null;
  livingAreaSqft: number | null;
  buildingCount: number | null;
  deedAcres: number | null;
  valueLabels: { total: string; land: string; improvements: string; taxable: string; market: string };
  /** Source-specific caution about what the value fields mean, shown with them. */
  valueNote?: string;
  // Further published facts; each is filled only where the statewide source defines it.
  effectiveYearBuilt?: number | null;
  residentialUnits?: number | null;
  /** Florida: just value of the portion granted a homestead exemption. */
  homesteadValue?: number | null;
  /** YYYY-MM of the appraiser's last physical inspection (Florida). */
  lastInspection?: string;
  qualityLabel?: string;
  constructionLabel?: string;
  publicLand?: string;
  specialFeaturesValue?: number | null;
  schoolDistrict?: string;
  /** The recorded document the statewide record cites (North Carolina deed book/page). */
  sourceDocument?: { reference: string; date: string };
};

// Keep the map response small. Fetch these public attributes only for a clicked parcel.
export const PARCEL_DETAIL_FIELDS: Record<ParcelSource["id"], string> = {
  co: "OBJECTID,parcel_id,countyName,situsAdd,sitAddCty,landAcres,zoningCode,zoningDesc,landUseDsc,dateReceived,URL,owner,owner2,account,subName,block,lot,saleDate,salePrice,apprValTot,asedValTot,legalDesc,landSqft",
  ut: "OBJECTID,PARCEL_ID,PARCEL_ADD,PARCEL_CITY,OWN_TYPE,ParcelsCur,County,CoParcel_URL,RECORDER",
  wa: "OBJECTID,PARCEL_ID_NR,ORIG_PARCEL_ID,SITUS_ADDRESS,SITUS_CITY_NM,COUNTY_NM,FIPS_NR,LANDUSE_CD,VALUE_LAND,VALUE_BLDG,DATA_LINK",
  fl: "OBJECTID,PARCEL_ID,ALT_KEY,CO_NO,PHY_ADDR1,PHY_CITY,DOR_UC,LND_SQFOOT,LND_VAL,ASMNT_YR,OWN_NAME,JV,AV_SD,AV_NSD,TV_SD,TV_NSD,ACT_YR_BLT,EFF_YR_BLT,TOT_LVG_AR,NO_BULDNG,S_LEGAL,SALE_PRC1,SALE_YR1,SALE_MO1,OR_BOOK1,OR_PAGE1,CLERK_NO1,QUAL_CD1,VI_CD1,M_PAR_SAL1,SALE_PRC2,SALE_YR2,SALE_MO2,OR_BOOK2,OR_PAGE2,CLERK_NO2,QUAL_CD2,VI_CD2,M_PAR_SAL2,NO_RES_UNT,IMP_QUAL,CONST_CLAS,JV_HMSTD,DT_LAST_IN,PUBLIC_LND,SPEC_FEAT_",
  nc: "objectid,parno,altparno,cntyname,siteadd,scity,gisacres,parusedesc,owntype,landval,revisedate,ownname,parval,improvval,saledate,saledatetx,sourceref,sourcedate,structno,legdecfull,structyear",
  wi: "OBJECTID,PARCELID,TAXPARCELID,CONAME,SITEADRESS,GISACRES,PROPCLASS,LNDVALUE,PARCELDATE,TAXROLLYEAR,OWNERNME1,OWNERNME2,CNTASSDVALUE,IMPVALUE,ESTFMKVALUE,NETPRPTA,DEEDACRES,SCHOOLDIST",
};

const str = (raw: unknown) => raw == null || /^\s*(null|n\/a|unknown)\s*$/i.test(String(raw)) ? "" : String(raw).trim();
const num = (raw: unknown): number | null => {
  const cleaned = str(raw).replace(/[$,\s]/g, "");
  return cleaned && /^-?\d+(?:\.\d+)?$/.test(cleaned) && Number.isFinite(Number(cleaned)) ? Number(cleaned) : null;
};
const positive = (raw: unknown) => { const parsed = num(raw); return parsed != null && parsed > 0 ? parsed : null; };
const year = (raw: unknown) => { const parsed = num(raw); return parsed != null && Number.isInteger(parsed) && parsed >= 1700 && parsed <= new Date().getFullYear() + 1 ? parsed : null; };
const date = (raw: unknown) => {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number") {
    if (raw <= 0) return "";
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
  }
  const text = str(raw);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  // Colorado's statewide layer reports "M/D/YYYY", and some counties (Weld) "YYYYMMDD".
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  return compact && Number(compact[2]) >= 1 && Number(compact[2]) <= 12 && Number(compact[3]) >= 1 && Number(compact[3]) <= 31 ? `${compact[1]}-${compact[2]}-${compact[3]}` : text;
};
/** Statewide sale dates in any published format (ISO, M/D/YYYY, YYYYMMDD, epoch ms) as YYYY-MM-DD where possible. */
export const normalizeSaleDate = (raw: unknown) => date(raw);
const owners = (...values: unknown[]) => Array.from(new Set(values.map(str).filter(Boolean)));
const sale = (saleDate: string, price: number | null, reference = "", extra: Partial<ParcelSale> = {}): ParcelSale[] => saleDate || price != null ? [{ date: saleDate, price, reference, ...extra }] : [];
// Florida DOR NAL user guide: IMP_QUAL 1–6, CONST_CLASS 1–5 (Marshall Valuation Service), PUBLIC_LND owner codes.
const FL_QUALITY = ["", "Minimum / low cost", "Below average", "Average", "Above average", "Excellent", "Superior"];
const FL_CONSTRUCTION = ["", "Fireproof steel (A)", "Reinforced concrete (B)", "Masonry (C)", "Wood (D)", "Steel frame, incombustible (S)"];
const FL_PUBLIC: Record<string, string> = { F: "Federal", S: "State", C: "County or county school district", M: "Municipal", D: "Special taxing district", W: "Water management district", P: "Other public land" };
/** DOR's DT_LAST_INSPT is MMYY ("1123" = November 2023; leading zeros may be dropped, "0000" = unknown). */
export function floridaInspection(raw: unknown) {
  const text = str(raw).padStart(4, "0");
  if (!/^\d{4}$/.test(text) || text === "0000") return "";
  const month = Number(text.slice(0, 2)), yy = Number(text.slice(2));
  if (month < 1 || month > 12) return "";
  const yearFull = yy + (yy <= new Date().getFullYear() % 100 + 1 ? 2000 : 1900);
  return `${yearFull}-${String(month).padStart(2, "0")}`;
}
// NC OneMap fills saledate with 2001-01-01 (978325200000) when the county sent no date; the text field is then blank.
const NC_PLACEHOLDER_SALE = 978325200000;

export const PARCEL_KEY = /^(co|ut|wa|fl|nc|wi):([1-9]\d{0,11})$/;

/** Fetch the exact selected feature in full resolution. Map viewport polygons are simplified and never authorize an inspection. */
export async function queryParcelGeometry(key: string, signal?: AbortSignal): Promise<ParcelGeometry | null> {
  const match = key.match(PARCEL_KEY);
  const source = match && PARCEL_SOURCES.find((item) => item.id === match[1]);
  if (!match || !source) return null;
  const objectIdField = source.id === "nc" ? "objectid" : "OBJECTID";
  const params = new URLSearchParams({
    objectIds: match[2], outFields: objectIdField, returnGeometry: "true", outSR: "4326", f: "geojson",
  });
  const response = await fetch(`${source.url}/query`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Parcel source returned HTTP ${response.status}`);
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new Error("Parcel geometry response exceeded limit");
  const json = JSON.parse(raw);
  if (json.error || json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Invalid parcel geometry response");
  const feature = json.features.find((item: GeoJSON.Feature) => String(item.properties?.[objectIdField] ?? item.id ?? "") === match[2]);
  if (!feature) return null;
  if (!validParcelGeometry(feature.geometry)) throw new Error("Parcel source returned invalid geometry");
  return feature.geometry;
}

/** One clicked parcel's public record by `<source>:<objectid>` key. Null when the key is invalid or the record is gone; throws when the source fails. */
export async function queryParcelDetail(key: string): Promise<ParcelDetail | null> {
  const match = key.match(PARCEL_KEY);
  const source = match && PARCEL_SOURCES.find((item) => item.id === match[1]);
  if (!match || !source) return null;
  const params = new URLSearchParams({ objectIds: match[2], outFields: PARCEL_DETAIL_FIELDS[source.id], returnGeometry: "false", f: "json" });
  const response = await fetch(`${source.url}/query`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params, signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const raw = await response.text();
  if (raw.length > 200_000) throw new Error("Parcel detail response exceeded limit");
  const json = JSON.parse(raw);
  if (json.error) throw new Error(json.error.message || "Source rejected parcel detail request");
  const attributes = json.features?.[0]?.attributes;
  return attributes && typeof attributes === "object" ? normalizeParcelDetail(source, attributes) : null;
}

export function normalizeParcelDetail(source: ParcelSource, a: Record<string, unknown>): ParcelDetail {
  const parcel = normalizeParcel(source, a);
  const detail: ParcelDetail = {
    parcel, owners: [], sales: [], assessedTotal: null, assessedLand: null, assessedImprovements: null,
    taxableValue: null, estimatedMarketValue: null, annualPropertyTax: null, valueYear: "",
    legalDescription: "", yearBuilt: null, livingAreaSqft: null, buildingCount: null, deedAcres: null,
    valueLabels: { total: "Assessed total", land: "Assessed land", improvements: "Assessed improvements", taxable: "Taxable value", market: "Est. fair market" },
  };
  if (source.id === "co") {
    detail.accountNumber = str(a.account);
    detail.subdivision = str(a.subName);
    detail.block = str(a.block);
    detail.lot = str(a.lot);
    detail.owners = owners(a.owner, a.owner2);
    detail.sales = sale(date(a.saleDate), positive(a.salePrice));
    // Checked 2026-11-01 against 24 Boulder assessor accounts: apprValTot ("Parcel Total Value") equals the county's
    // actual (market) value; asedValTot ("Taxable Value") is actual × a statewide class rate (6.25% residential, 27% on a
    // commercial sample) and never matched the county's assessed total, which uses the county's own rates.
    detail.estimatedMarketValue = positive(a.apprValTot);
    detail.taxableValue = positive(a.asedValTot);
    detail.legalDescription = str(a.legalDesc);
    detail.valueLabels.market = "County actual value";
    detail.valueLabels.taxable = "Statewide taxable value";
    detail.valueNote = "Actual value is the county assessor's valuation, not a sale price. The statewide taxable value can differ from the county's assessed value and tax bill; use the county assessor for those.";
  } else if (source.id === "wa") {
    detail.assessedLand = positive(a.VALUE_LAND);
    detail.assessedImprovements = positive(a.VALUE_BLDG);
    detail.valueLabels.land = "Market land value";
    detail.valueLabels.improvements = "Market building value";
  } else if (source.id === "fl") {
    detail.owners = owners(a.OWN_NAME);
    detail.estimatedMarketValue = positive(a.JV);
    detail.valueLabels.market = "Just value";
    detail.assessedLand = positive(a.LND_VAL);
    // DOR NAL fields: _SD is the school-district roll and _NSD the county non-school roll. They are two tax bases for
    // the same parcel, equal on most parcels (286 of 300 checked 2026-11-01), so they are never added together.
    detail.assessedTotal = positive(a.AV_NSD) ?? positive(a.AV_SD);
    detail.taxableValue = num(a.TV_NSD) ?? num(a.TV_SD);
    detail.valueLabels.total = positive(a.AV_NSD) != null ? "Assessed value (county)" : "Assessed value (school)";
    detail.valueLabels.taxable = num(a.TV_NSD) != null ? "Taxable value (county)" : "Taxable value (school)";
    const schoolAssessed = positive(a.AV_SD), schoolTaxable = num(a.TV_SD);
    const schoolDiffers = (schoolAssessed != null && schoolAssessed !== detail.assessedTotal) || (schoolTaxable != null && schoolTaxable !== detail.taxableValue);
    if (schoolDiffers) detail.valueNote = `School-district roll: assessed ${schoolAssessed == null ? "not reported" : `$${schoolAssessed.toLocaleString("en-US")}`}, taxable ${schoolTaxable == null ? "not reported" : `$${schoolTaxable.toLocaleString("en-US")}`}. Florida caps and exemptions apply differently to school and county levies.`;
    detail.valueYear = str(a.ASMNT_YR);
    detail.legalDescription = str(a.S_LEGAL);
    detail.yearBuilt = year(a.ACT_YR_BLT);
    detail.livingAreaSqft = positive(a.TOT_LVG_AR);
    detail.buildingCount = positive(a.NO_BULDNG);
    detail.valueLabels.land = "Reported land value";
    detail.effectiveYearBuilt = year(a.EFF_YR_BLT);
    detail.residentialUnits = positive(a.NO_RES_UNT);
    detail.homesteadValue = positive(a.JV_HMSTD);
    detail.lastInspection = floridaInspection(a.DT_LAST_IN);
    detail.qualityLabel = FL_QUALITY[Number(str(a.IMP_QUAL))] ?? "";
    detail.constructionLabel = FL_CONSTRUCTION[Number(str(a.CONST_CLAS))] ?? "";
    detail.publicLand = FL_PUBLIC[str(a.PUBLIC_LND).toUpperCase()] ?? "";
    detail.specialFeaturesValue = positive(a.SPEC_FEAT_);
    for (const i of [1, 2]) {
      const saleYear = year(a[`SALE_YR${i}`]);
      const saleMonth = num(a[`SALE_MO${i}`]);
      const saleDate = saleYear ? saleMonth && saleMonth >= 1 && saleMonth <= 12 ? `${saleYear}-${String(saleMonth).padStart(2, "0")}` : String(saleYear) : "";
      const ref = [str(a[`CLERK_NO${i}`]), [str(a[`OR_BOOK${i}`]), str(a[`OR_PAGE${i}`])].filter(Boolean).join("/")].filter(Boolean).join(" · ");
      const price = positive(a[`SALE_PRC${i}`]);
      const cls = floridaSaleClass(str(a[`QUAL_CD${i}`]), price);
      const vi = str(a[`VI_CD${i}`]).toUpperCase();
      // A multi-parcel price (DOR "D"/"C") covers several parcels, so it never stands as this parcel's comparable price.
      const multiParcel = /^[DC]$/i.test(str(a[`M_PAR_SAL${i}`]));
      detail.sales.push(...sale(saleDate, price, ref, { status: cls.status, statusLabel: cls.label, comparable: cls.comparable && !multiParcel, vacantAtSale: vi === "V" ? true : vi === "I" ? false : null, multiParcel }));
    }
  } else if (source.id === "nc") {
    detail.owners = owners(a.ownname);
    const saleText = date(a.saledatetx);
    detail.sales = sale(saleText || (num(a.saledate) === NC_PLACEHOLDER_SALE ? "" : date(a.saledate)), null);
    const reference = str(a.sourceref).replace(/^Deed Book\/Page\s*\/?\s*$/i, "");
    if (reference) detail.sourceDocument = { reference, date: date(a.sourcedate) };
    detail.buildingCount = positive(a.structno);
    detail.assessedTotal = positive(a.parval);
    detail.assessedLand = positive(a.landval);
    detail.assessedImprovements = positive(a.improvval);
    detail.legalDescription = str(a.legdecfull);
    detail.yearBuilt = year(a.structyear);
  } else if (source.id === "wi") {
    detail.owners = owners(a.OWNERNME1, a.OWNERNME2);
    detail.assessedTotal = positive(a.CNTASSDVALUE);
    detail.assessedLand = positive(a.LNDVALUE);
    detail.assessedImprovements = positive(a.IMPVALUE);
    detail.estimatedMarketValue = positive(a.ESTFMKVALUE);
    detail.valueLabels.market = "Estimated fair market value";
    const [land, improvements] = [positive(a.LNDVALUE), positive(a.IMPVALUE)];
    if (detail.estimatedMarketValue != null && land != null && improvements != null && detail.estimatedMarketValue === improvements)
      detail.valueNote = "This record's estimated fair market value equals its improvement value alone, so the statewide file appears to omit the land. Use the total assessed value or the municipal assessor.";
    detail.annualPropertyTax = positive(a.NETPRPTA);
    detail.deedAcres = positive(a.DEEDACRES);
    detail.valueYear = str(a.TAXROLLYEAR);
    detail.schoolDistrict = str(a.SCHOOLDIST);
  }
  return detail;
}
