import { normalizeParcel, type ParcelRecord, type ParcelSource } from "./parcel-sources";

export type ParcelSale = { date: string; price: number | null; reference: string };
export type ParcelDetail = {
  parcel: ParcelRecord;
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
  yearBuilt: number | null;
  livingAreaSqft: number | null;
  buildingCount: number | null;
  deedAcres: number | null;
  valueLabels: { total: string; land: string; improvements: string };
};

// Keep the map response small. Fetch these public attributes only for a clicked parcel.
export const PARCEL_DETAIL_FIELDS: Record<ParcelSource["id"], string> = {
  co: "OBJECTID,parcel_id,countyName,situsAdd,sitAddCty,landAcres,zoningCode,zoningDesc,landUseDsc,dateReceived,URL,owner,owner2,saleDate,salePrice,apprValTot,asedValTot,legalDesc,landSqft",
  ut: "OBJECTID,PARCEL_ID,PARCEL_ADD,PARCEL_CITY,OWN_TYPE,ParcelsCur,County,CoParcel_URL,RECORDER",
  wa: "OBJECTID,PARCEL_ID_NR,ORIG_PARCEL_ID,SITUS_ADDRESS,SITUS_CITY_NM,COUNTY_NM,FIPS_NR,LANDUSE_CD,VALUE_LAND,VALUE_BLDG,DATA_LINK",
  fl: "OBJECTID,PARCEL_ID,ALT_KEY,CO_NO,PHY_ADDR1,PHY_CITY,DOR_UC,LND_SQFOOT,LND_VAL,ASMNT_YR,OWN_NAME,JV,AV_SD,AV_NSD,TV_SD,TV_NSD,ACT_YR_BLT,EFF_YR_BLT,TOT_LVG_AR,NO_BULDNG,S_LEGAL,SALE_PRC1,SALE_YR1,SALE_MO1,OR_BOOK1,OR_PAGE1,CLERK_NO1,SALE_PRC2,SALE_YR2,SALE_MO2,OR_BOOK2,OR_PAGE2,CLERK_NO2",
  nc: "objectid,parno,altparno,cntyname,siteadd,scity,gisacres,parusedesc,owntype,landval,revisedate,ownname,parval,improvval,saledate,legdecfull,structyear",
  wi: "OBJECTID,PARCELID,TAXPARCELID,CONAME,SITEADRESS,GISACRES,PROPCLASS,LNDVALUE,PARCELDATE,TAXROLLYEAR,OWNERNME1,OWNERNME2,CNTASSDVALUE,IMPVALUE,ESTFMKVALUE,NETPRPTA,DEEDACRES",
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
  return match ? match[0] : text;
};
const owners = (...values: unknown[]) => Array.from(new Set(values.map(str).filter(Boolean)));
const sale = (saleDate: string, price: number | null, reference = ""): ParcelSale[] => saleDate || price != null ? [{ date: saleDate, price, reference }] : [];

export function normalizeParcelDetail(source: ParcelSource, a: Record<string, unknown>): ParcelDetail {
  const parcel = normalizeParcel(source, a);
  const detail: ParcelDetail = {
    parcel, owners: [], sales: [], assessedTotal: null, assessedLand: null, assessedImprovements: null,
    taxableValue: null, estimatedMarketValue: null, annualPropertyTax: null, valueYear: "",
    legalDescription: "", yearBuilt: null, livingAreaSqft: null, buildingCount: null, deedAcres: null,
    valueLabels: { total: "Assessed total", land: "Assessed land", improvements: "Assessed improvements" },
  };
  if (source.id === "co") {
    detail.owners = owners(a.owner, a.owner2);
    detail.sales = sale(date(a.saleDate), positive(a.salePrice));
    detail.assessedTotal = positive(a.apprValTot);
    detail.taxableValue = positive(a.asedValTot);
    detail.legalDescription = str(a.legalDesc);
    detail.valueLabels.total = "Appraised total";
  } else if (source.id === "wa") {
    detail.assessedLand = positive(a.VALUE_LAND);
    detail.assessedImprovements = positive(a.VALUE_BLDG);
    detail.valueLabels.land = "Market land value";
    detail.valueLabels.improvements = "Market building value";
  } else if (source.id === "fl") {
    detail.owners = owners(a.OWN_NAME);
    detail.estimatedMarketValue = positive(a.JV);
    detail.assessedLand = positive(a.LND_VAL);
    detail.assessedTotal = positive(a.AV_SD) != null || positive(a.AV_NSD) != null ? (positive(a.AV_SD) ?? 0) + (positive(a.AV_NSD) ?? 0) : null;
    detail.taxableValue = positive(a.TV_SD) != null || positive(a.TV_NSD) != null ? (positive(a.TV_SD) ?? 0) + (positive(a.TV_NSD) ?? 0) : null;
    detail.valueYear = str(a.ASMNT_YR);
    detail.legalDescription = str(a.S_LEGAL);
    detail.yearBuilt = year(a.ACT_YR_BLT);
    detail.livingAreaSqft = positive(a.TOT_LVG_AR);
    detail.buildingCount = positive(a.NO_BULDNG);
    detail.valueLabels.land = "Reported land value";
    for (const i of [1, 2]) {
      const saleYear = year(a[`SALE_YR${i}`]);
      const saleMonth = num(a[`SALE_MO${i}`]);
      const saleDate = saleYear ? saleMonth && saleMonth >= 1 && saleMonth <= 12 ? `${saleYear}-${String(saleMonth).padStart(2, "0")}` : String(saleYear) : "";
      const ref = [str(a[`CLERK_NO${i}`]), [str(a[`OR_BOOK${i}`]), str(a[`OR_PAGE${i}`])].filter(Boolean).join("/")].filter(Boolean).join(" · ");
      detail.sales.push(...sale(saleDate, positive(a[`SALE_PRC${i}`]), ref));
    }
  } else if (source.id === "nc") {
    detail.owners = owners(a.ownname);
    detail.sales = sale(date(a.saledate), null);
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
    detail.annualPropertyTax = positive(a.NETPRPTA);
    detail.deedAcres = positive(a.DEEDACRES);
    detail.valueYear = str(a.TAXROLLYEAR);
  }
  return detail;
}
