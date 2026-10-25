import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

export type BoulderBuilding = { buildingNumber: string; design: string; yearBuilt: number | null; effectiveYear: number | null; bedrooms: number | null; fullBaths: number | null; halfBaths: number | null; threeQuarterBaths: number | null; mainFloorSqft: number | null; basementSqft: number | null; garageSqft: number | null };
export type BoulderSale = { date: string; price: number | null; qualification: string; deedType: string; reception: string };
export type BoulderPermit = { number: string; category: string; date: string; description: string; estimatedValue: number | null; issuedBy: string };
export type BoulderAccount = { accountNo: string; linkedParcelCount?: number; siteAddress: string; owners: string[]; subdivision: string; legalDescription: string; taxArea: string; millLevy: number | null; accountType: string; landUses: string[]; buildings: BoulderBuilding[]; sales: BoulderSale[]; permits: BoulderPermit[]; values: { taxYear: string; actualTotal: number | null; actualLand: number | null; actualBuildings: number | null; assessedTotal: number | null } | null };
export type BoulderProperty = { folio: string; accounts: BoulderAccount[]; updatedAt: string; sourceDate: string; sourceUrl: string };
export type BoulderLookup = { status: "ready" | "not_loaded" | "not_found"; property: BoulderProperty | null };

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
  try {
    const name = `${bucketForFolio(folio)}.json${manifest.format === "json-gzip-v1" ? ".gz" : ""}`;
    const raw = await readFile(join(directory, manifest.snapshot, name));
    const bucket: Record<string, { folio: string; accounts: BoulderAccount[] }> = JSON.parse(manifest.format === "json-gzip-v1" ? gunzipSync(raw).toString("utf8") : raw.toString("utf8"));
    const record = bucket[folio];
    return record ? { status: "ready", property: { ...record, updatedAt: manifest.updatedAt, sourceDate: manifest.sourceDate ?? "", sourceUrl: manifest.sourceUrl } } : { status: "not_found", property: null };
  } catch { return { status: "not_loaded", property: null }; }
}
