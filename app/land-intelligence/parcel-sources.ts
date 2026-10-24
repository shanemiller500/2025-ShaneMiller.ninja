export type ParcelCategory = "residential" | "commercial" | "agricultural" | "industrial" | "public" | "other";
export type ParcelRecord = {
  id: string; state: string; county: string; address: string; acres: number | null;
  zoning: string; landUse: string; ownerType: string; landValue: number | null;
  received: string; source: string; sourceUrl: string; recordUrl: string; category: ParcelCategory;
};

export const PARCEL_CATEGORIES: { id: ParcelCategory; label: string; color: string }[] = [
  { id: "residential", label: "Residential", color: "#72b8a0" },
  { id: "commercial", label: "Commercial", color: "#d6a465" },
  { id: "agricultural", label: "Agriculture", color: "#a8ba75" },
  { id: "industrial", label: "Industrial", color: "#bd8c9a" },
  { id: "public", label: "Public / civic", color: "#8ba8cb" },
  { id: "other", label: "Other / unclassified", color: "#a5aab2" },
];

export const PARCEL_SOURCES = [
  { id: "co", state: "Colorado", bounds: [-109.1, 36.9, -102, 41.1], url: "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/MapServer/0", source: "Colorado GIS Public Parcels", fields: "OBJECTID,parcel_id,countyName,situsAdd,sitAddCty,landAcres,zoningCode,zoningDesc,landUseDsc,dateReceived,URL" },
  { id: "ut", state: "Utah", bounds: [-114.1, 36.9, -109, 42.1], url: "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/UtahStatewideParcels/FeatureServer/0", source: "Utah UGRC Statewide Parcels", fields: "OBJECTID,PARCEL_ID,PARCEL_ADD,PARCEL_CITY,OWN_TYPE,ParcelsCur,County,CoParcel_URL" },
  { id: "wa", state: "Washington", bounds: [-125, 45.5, -116.8, 49.1], url: "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0", source: "Washington WaTech Parcels 2026", fields: "OBJECTID,PARCEL_ID_NR,ORIG_PARCEL_ID,SITUS_ADDRESS,SITUS_CITY_NM,COUNTY_NM,FIPS_NR,LANDUSE_CD,VALUE_LAND,DATA_LINK" },
  { id: "fl", state: "Florida", bounds: [-87.7, 24.3, -80, 31.1], url: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0", source: "Florida DOR Cadastral 2025", fields: "OBJECTID,PARCEL_ID,ALT_KEY,CO_NO,PHY_ADDR1,PHY_CITY,DOR_UC,LND_SQFOOT,LND_VAL,ASMNT_YR" },
  { id: "nc", state: "North Carolina", bounds: [-84.4, 33.7, -75.3, 36.7], url: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1", source: "NC OneMap Parcels", fields: "objectid,parno,altparno,cntyname,siteadd,scity,gisacres,parusedesc,owntype,landval,revisedate" },
  { id: "wi", state: "Wisconsin", bounds: [-92.9, 42.4, -86.2, 47.2], url: "https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels_DB/FeatureServer/0", source: "Wisconsin Statewide Parcels V12", fields: "OBJECTID,PARCELID,TAXPARCELID,CONAME,SITEADRESS,GISACRES,PROPCLASS,LNDVALUE,PARCELDATE,TAXROLLYEAR" },
] as const;

export type ParcelSource = typeof PARCEL_SOURCES[number];
export type Bounds = [number, number, number, number];
export function sourcesForBounds([west, south, east, north]: Bounds) {
  return PARCEL_SOURCES.filter(({ bounds }) => west <= bounds[2] && east >= bounds[0] && south <= bounds[3] && north >= bounds[1]);
}

const value = (raw: unknown) => raw == null || String(raw).toLowerCase() === "null" ? "" : String(raw).trim();
const numeric = (raw: unknown) => raw == null || raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
const date = (raw: unknown) => { const stamp = numeric(raw); if (stamp == null) return ""; const parsed = new Date(stamp); return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : ""; };
const safeUrl = (raw: unknown) => { try { const url = new URL(value(raw)); return url.protocol === "https:" ? url.href : ""; } catch { return ""; } };

export function parcelCategory(landUse: string, ownerType: string): ParcelCategory {
  const use = landUse.toLowerCase();
  const owner = ownerType.toLowerCase();
  // State numeric codes are not interchangeable. Only the residential 11-19
  // group is classified here; other codes stay unclassified until decoded.
  if (/^\d+$/.test(use)) return /^1[1-9]$/.test(use) ? "residential" : "other";
  if (/public|school|park|government|municipal|civic/.test(use) || /federal|state|tribal/.test(owner)) return "public";
  if (/residen|housing|single.family|multi.family|apartment|household|mobile home|condominium|cooperative|retirement home/.test(use)) return "residential";
  if (/farm|ranch|agric|crop|pasture/.test(use)) return "agricultural";
  if (/industrial|manufactur|warehouse|mining/.test(use)) return "industrial";
  if (/commerc|retail|office|hotel|business/.test(use)) return "commercial";
  return "other";
}

// Florida DOR county numbers run alphabetically from 11 (Alachua) to 77 (Washington), with Dade filed under D.
const FLORIDA_COUNTIES = ["Alachua", "Baker", "Bay", "Bradford", "Brevard", "Broward", "Calhoun", "Charlotte", "Citrus", "Clay", "Collier", "Columbia", "Miami-Dade", "DeSoto", "Dixie", "Duval", "Escambia", "Flagler", "Franklin", "Gadsden", "Gilchrist", "Glades", "Gulf", "Hamilton", "Hardee", "Hendry", "Hernando", "Highlands", "Hillsborough", "Holmes", "Indian River", "Jackson", "Jefferson", "Lafayette", "Lake", "Lee", "Leon", "Levy", "Liberty", "Madison", "Manatee", "Marion", "Martin", "Monroe", "Nassau", "Okaloosa", "Okeechobee", "Orange", "Osceola", "Palm Beach", "Pasco", "Pinellas", "Polk", "Putnam", "St. Johns", "St. Lucie", "Santa Rosa", "Sarasota", "Seminole", "Sumter", "Suwannee", "Taylor", "Union", "Volusia", "Wakulla", "Walton", "Washington"];

// Florida DOR use codes (3 digits, "0NN"): 00–09 residential types by name, then the standard groups.
const FLORIDA_RESIDENTIAL_USES = ["Vacant residential", "Single family", "Mobile home", "Multi-family (10+ units)", "Condominium", "Cooperative", "Retirement home", "Miscellaneous residential", "Multi-family (under 10 units)", "Residential common area"];
export function floridaUse(code: string) {
  if (!/^0\d\d$/.test(code)) return code ? `DOR code ${code}` : "";
  const n = Number(code);
  const name = n < 10 ? FLORIDA_RESIDENTIAL_USES[n] : n === 10 ? "Vacant commercial" : n === 40 ? "Vacant industrial" : n === 70 ? "Vacant institutional"
    : n < 40 ? "Commercial" : n < 50 ? "Industrial" : n < 70 ? "Agricultural" : n < 80 ? "Institutional" : n < 90 ? "Government" : "Miscellaneous";
  return `${name} (DOR ${code})`;
}

export function normalizeParcel(source: ParcelSource, a: Record<string, unknown>): ParcelRecord {
  let record: Omit<ParcelRecord, "state" | "source" | "sourceUrl" | "category">;
  if (source.id === "co") record = { id: value(a.parcel_id), county: value(a.countyName), address: [value(a.situsAdd), value(a.sitAddCty)].filter(Boolean).join(", "), acres: numeric(a.landAcres), zoning: value(a.zoningDesc) || value(a.zoningCode), landUse: value(a.landUseDsc), ownerType: "", landValue: null, received: value(a.dateReceived), recordUrl: safeUrl(a.URL) };
  else if (source.id === "ut") record = { id: value(a.PARCEL_ID), county: value(a.County), address: [value(a.PARCEL_ADD), value(a.PARCEL_CITY)].filter(Boolean).join(", "), acres: null, zoning: "", landUse: "", ownerType: value(a.OWN_TYPE), landValue: null, received: date(a.ParcelsCur), recordUrl: safeUrl(a.CoParcel_URL) };
  else if (source.id === "wa") record = { id: value(a.PARCEL_ID_NR) || value(a.ORIG_PARCEL_ID), county: /^\d+$/.test(value(a.COUNTY_NM)) ? `County code ${value(a.FIPS_NR) || value(a.COUNTY_NM)}` : value(a.COUNTY_NM), address: [value(a.SITUS_ADDRESS), value(a.SITUS_CITY_NM)].filter(Boolean).join(", "), acres: null, zoning: "", landUse: value(a.LANDUSE_CD), ownerType: "", landValue: numeric(a.VALUE_LAND), received: "2026", recordUrl: safeUrl(a.DATA_LINK) };
  else if (source.id === "nc") record = { id: value(a.parno) || value(a.altparno), county: value(a.cntyname), address: [value(a.siteadd), value(a.scity)].filter(Boolean).join(", "), acres: numeric(a.gisacres), zoning: "", landUse: value(a.parusedesc), ownerType: value(a.owntype), landValue: numeric(a.landval), received: date(a.revisedate), recordUrl: "" };
  else if (source.id === "wi") record = { id: value(a.PARCELID) || value(a.TAXPARCELID), county: value(a.CONAME), address: value(a.SITEADRESS), acres: numeric(a.GISACRES), zoning: "", landUse: value(a.PROPCLASS), ownerType: "", landValue: numeric(a.LNDVALUE), received: value(a.PARCELDATE) || value(a.TAXROLLYEAR), recordUrl: "" };
  else { const sqft = numeric(a.LND_SQFOOT); record = { id: value(a.PARCEL_ID) || value(a.ALT_KEY), county: FLORIDA_COUNTIES[Number(value(a.CO_NO)) - 11] ?? (value(a.CO_NO) ? `County code ${value(a.CO_NO)}` : ""), address: [value(a.PHY_ADDR1), value(a.PHY_CITY)].filter(Boolean).join(", "), acres: sqft != null && sqft > 0 ? sqft / 43560 : null, zoning: "", landUse: floridaUse(value(a.DOR_UC)), ownerType: "", landValue: numeric(a.LND_VAL), received: value(a.ASMNT_YR), recordUrl: "" }; }
  return { ...record, state: source.state, source: source.source, sourceUrl: source.url, category: parcelCategory(record.landUse, record.ownerType) };
}
