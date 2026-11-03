import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { boulderRecordDate, type RecordDateIssue } from "./record-date";

// Optional fields arrive with snapshot schema 2 (boulder-import.mjs); older snapshots simply lack them.
// finishedSqft: residential above-grade finished area; commercial includes below-grade (county help manual).
export type BoulderBuilding = {
  buildingNumber: string; section?: string; design: string; buildingClass?: string; quality?: string; construction?: string;
  yearBuilt: number | null; effectiveYear: number | null; percentComplete?: number | null;
  bedrooms: number | null; fullBaths: number | null; halfBaths: number | null; threeQuarterBaths: number | null;
  finishedSqft?: number | null; mainFloorSqft: number | null; basementSqft: number | null; basements?: { type: string; sqft: number }[]; garageSqft: number | null; garageType?: string;
  stories?: number | null; units?: number | null; heating?: string; cooling?: string; exteriorWall?: string; roof?: string;
};
/** `date` is ISO (YYYY-MM-DD), or empty when the county value failed validation; `recordedDate` keeps the county's text. */
export type BoulderSale = { date: string; price: number | null; qualification: string; deedType: string; reception: string; recordedDate?: string; dateIssue?: RecordDateIssue };
export type BoulderPermit = { number: string; category: string; date: string; description: string; estimatedValue: number | null; issuedBy: string; recordedDate?: string; dateIssue?: RecordDateIssue };
export type BoulderOwnership = { name: string; role: "primary" | "secondary" | ""; share: number | null };
export type BoulderLand = { landClass: string; use: string; unitType: string; units: number | null; gisSqft: number | null; gisAcres: number | null };
export type BoulderValues = {
  taxYear: string; actualTotal: number | null; actualLand: number | null; actualBuildings: number | null; actualExtraFeatures?: number | null;
  assessedTotal: number | null; assessedSchool?: number | null; assessedLand?: number | null; assessedBuildings?: number | null;
};
export type BoulderAccount = {
  accountNo: string; linkedParcelCount?: number; siteAddress: string; owners: string[]; ownerships?: BoulderOwnership[];
  subdivision: string; legalDescription: string; taxArea: string; millLevy: number | null; accountType: string;
  neighborhood?: string; city?: string; unit?: string; plss?: string; landUses: string[]; land?: BoulderLand[];
  buildings: BoulderBuilding[]; sales: BoulderSale[]; permits: BoulderPermit[]; values: BoulderValues | null;
  /** Schema 3: what comparable sales are matched on (boulder-import.mjs accountProfile). */
  profile?: BoulderCompProfile | null;
};
export type BoulderCompProfile = { type: string; basis: "building" | "land"; units: number | null; landSqft: number | null; yearBuilt: number | null; effectiveYear: number | null; bedrooms: number | null; quality: string };
export type BoulderProperty = { folio: string; accounts: BoulderAccount[]; updatedAt: string; sourceDate: string; sourceUrl: string };
/** `rights_pending`: a production server holding a snapshot whose county reuse rights have not been approved. */
export type BoulderLookup = { status: "ready" | "not_loaded" | "not_found" | "rights_pending"; property: BoulderProperty | null };

// County reuse rights are unconfirmed, so production serves the snapshot only once a deployment records approval.
export const publicationApproved = () => process.env.NODE_ENV !== "production" || process.env.LAND_BOULDER_DATA_APPROVED === "true";

function bucketForFolio(folio: string) {
  let hash = 2166136261;
  for (const char of folio) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).slice(-2).padStart(2, "0");
}

export async function loadBoulderProperty(folio: string): Promise<BoulderLookup> {
  if (!/^[A-Za-z0-9]{1,23}$/.test(folio)) return { status: "not_found", property: null };
  const directory = join(process.cwd(), "data", "land-intelligence", "boulder");
  let manifest: { updatedAt: string; sourceDate?: string; sourceUrl: string; snapshot: string; format?: string };
  try { manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")); }
  catch { return { status: "not_loaded", property: null }; }
  if (!/^snapshot-[0-9T-Z-]+$/.test(manifest.snapshot)) return { status: "not_loaded", property: null };
  if (!publicationApproved()) return { status: "rights_pending", property: null };
  try {
    const name = `${bucketForFolio(folio)}.json${manifest.format === "json-gzip-v1" ? ".gz" : ""}`;
    const raw = await readFile(join(directory, manifest.snapshot, name));
    const bucket: Record<string, { folio: string; accounts: BoulderAccount[] }> = JSON.parse(manifest.format === "json-gzip-v1" ? gunzipSync(raw).toString("utf8") : raw.toString("utf8"));
    const record = bucket[folio];
    if (!record) return { status: "not_found", property: null };
    const sourceDate = manifest.sourceDate ?? "";
    const accounts = record.accounts.map((account) => ({
      ...account,
      sales: account.sales.map((sale) => ({ ...sale, recordedDate: sale.date, ...boulderRecordDate(sale.date, sourceDate) })),
      permits: account.permits.map((permit) => ({ ...permit, recordedDate: permit.date, ...boulderRecordDate(permit.date, sourceDate) })),
    }));
    return { status: "ready", property: { ...record, accounts, updatedAt: manifest.updatedAt, sourceDate, sourceUrl: manifest.sourceUrl } };
  } catch { return { status: "not_loaded", property: null }; }
}
